-- Phase 3 — claims rules, roles and demo isolation. One DO block that always
-- ends in an exception: nothing it does is kept. Needs no real account: every identity is a test user created inside the rolled-back transaction.
-- Usage: paste into the SQL editor and run; the error text reads
-- «ROLLBACK OK: …» with each check, or «FAIL …» naming the broken one.
do $t$
declare
  adm uuid; cl uuid := gen_random_uuid(); fin uuid := gen_random_uuid(); uw uuid := gen_random_uuid(); uw2 uuid := gen_random_uuid(); mg uuid := gen_random_uuid();
  mga uuid; sub uuid; sub_eur uuid; c1 uuid; c2 uuid; n int; v numeric; ok text := ''; inst uuid; inst_eur uuid; p public.claim_payments;
begin
  -- a test admin of our own (never a real account): created here, gone with the rollback
  adm := gen_random_uuid();
  insert into auth.users (id, email, aud, role) values (adm, 'at-admin@example.com', 'authenticated', 'authenticated');
  update public.profiles set role = 'admin', active = true, ui_demo_mode = false where id = adm;
  insert into auth.users (id, email, aud, role) values
    (cl, 'ct-claims@example.com', 'authenticated', 'authenticated'), (fin, 'ct-fin@example.com', 'authenticated', 'authenticated'),
    (uw, 'ct-uw@example.com', 'authenticated', 'authenticated'), (uw2, 'ct-uw2@example.com', 'authenticated', 'authenticated'),
    (mg, 'ct-mgmt@example.com', 'authenticated', 'authenticated');
  update public.profiles set role = 'claims', active = true, ui_demo_mode = false where id = cl;
  update public.profiles set role = 'finance', active = true, ui_demo_mode = false where id = fin;
  update public.profiles set role = 'underwriter', active = true, ui_demo_mode = false where id in (uw, uw2);
  update public.profiles set role = 'management', active = true, ui_demo_mode = false where id = mg;

  -- a real bound risk of uw: USD, 10 % signed, then an endorsement to 15 % (history), and a EUR one
  perform set_config('request.jwt.claims', json_build_object('sub', uw, 'role', 'authenticated')::text, true);
  insert into public.counterparties (name, type) values ('Claims Test MGA', 'mga') returning id into mga;
  insert into public.submissions (received_at, source_party_id, mga_id, business_type, insured_name, currency, underwriter_id,
                                  period_from, period_to, gross_premium_100, commission_pct, brokerage_pct)
  values (current_date - 200, mga, mga, 'facultative', 'Claims Test Insured', 'USD', uw, current_date - 180, current_date + 185, 1000000, 20, 0)
  returning id into sub;
  perform public.apply_submission_status(sub, 'under_review', uw, null, null, null, null, null);
  perform public.apply_submission_status(sub, 'offered', uw, 'Quote', 10, current_date + 30, null, null);
  perform public.apply_submission_status(sub, 'bound', uw, 'Firm', null, null, 10, null);
  alter table public.submission_status_history disable trigger submission_status_history_no_update;
  update public.submission_status_history set changed_at = now() - interval '150 days' where submission_id = sub;
  alter table public.submission_status_history enable trigger submission_status_history_no_update;
  insert into public.submission_status_history (submission_id, from_status, to_status, signed_share_pct, comment, changed_by, changed_at)
  values (sub, 'bound', 'bound', 15, 'Endorsement: line increased', uw, now() - interval '50 days');
  perform set_config('app.status_change', 'on', true);
  update public.submissions set written_share_pct = 15, signed_share_pct = 15 where id = sub;
  perform set_config('app.status_change', 'off', true);
  perform public.generate_premium_schedule(sub, null);
  select id into inst from public.premium_installments where submission_id = sub limit 1;
  insert into public.submissions (received_at, source_party_id, mga_id, business_type, insured_name, currency, underwriter_id, period_from, period_to, gross_premium_100, commission_pct, brokerage_pct)
  values (current_date - 100, mga, mga, 'facultative', 'Claims Test EUR', 'EUR', uw, current_date - 90, current_date + 275, 500000, 20, 0) returning id into sub_eur;
  perform public.apply_submission_status(sub_eur, 'under_review', uw, null, null, null, null, null);
  perform public.apply_submission_status(sub_eur, 'offered', uw, 'Quote', 10, current_date + 30, null, null);
  perform public.apply_submission_status(sub_eur, 'bound', uw, 'Firm', null, null, 10, null);
  perform public.generate_premium_schedule(sub_eur, null);
  select id into inst_eur from public.premium_installments where submission_id = sub_eur limit 1;

  -- 1. roles: claims creates claims and reserves; finance, underwriters and management cannot
  perform set_config('request.jwt.claims', json_build_object('sub', cl, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.claims (submission_id, date_of_loss, currency, estimate_100, cause, handler_id)
  values (sub, current_date - 100, 'USD', 1000000, 'Fire', cl) returning id into c1;
  if (select claim_no from public.claims where id = c1) !~ '^CLM-\d{4}-\d{4}$' then raise exception 'FAIL claim number %', (select claim_no from public.claims where id = c1); end if;
  insert into public.claim_reserves (claim_id, amount, reason) values (c1, 50000, 'Initial');
  begin insert into public.claim_payments (claim_id, currency, amount) values (c1, 'USD', 10); raise exception 'FAIL claims role paid';
  exception when sqlstate '42501' then null; end;
  reset role;
  foreach n in array array[1, 2, 3] loop
    perform set_config('request.jwt.claims', json_build_object('sub', (array[fin, uw, mg])[n], 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin insert into public.claims (submission_id, date_of_loss, currency) values (sub, current_date - 10, 'USD'); raise exception 'FAIL role % created a claim', n;
    exception when sqlstate '42501' then null; end;
    begin insert into public.claim_reserves (claim_id, amount, reason) values (c1, 1, 'x'); raise exception 'FAIL role % reserved', n;
    exception when sqlstate '42501' then null; end;
    reset role;
  end loop;
  ok := ok || '1 roles; ';

  -- 2. who reads: the own underwriter yes, another underwriter no, management and finance yes
  perform set_config('request.jwt.claims', json_build_object('sub', uw2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if exists (select 1 from public.claims_v where id = c1) or exists (select 1 from public.claim_reserves where claim_id = c1) then raise exception 'FAIL another underwriter reads the claim'; end if;
  reset role;
  foreach n in array array[1, 2, 3] loop
    perform set_config('request.jwt.claims', json_build_object('sub', (array[uw, mg, fin])[n], 'role', 'authenticated')::text, true);
    set local role authenticated;
    if not exists (select 1 from public.claims_v where id = c1 and outstanding = 50000) then raise exception 'FAIL role % cannot read the claim', n; end if;
    reset role;
  end loop;
  ok := ok || '2 reading; ';

  -- 3. our share at the signed line on the date of loss: 10 % before the endorsement, 15 % after
  if (select signed_share_pct from public.claims where id = c1) <> 10 then raise exception 'FAIL share before endorsement %', (select signed_share_pct from public.claims where id = c1); end if;
  perform set_config('request.jwt.claims', json_build_object('sub', cl, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.claims (submission_id, date_of_loss, currency, estimate_100) values (sub, current_date - 20, 'USD', 100000) returning id into c2;
  if (select signed_share_pct from public.claims where id = c2) <> 15 then raise exception 'FAIL share after endorsement'; end if;
  if (select estimate_our_share from public.claims_v where id = c2) <> 15000 then raise exception 'FAIL estimate our share'; end if;
  ok := ok || '3 signed line at DOL; ';

  -- 4. coverage check: outside the period or another currency needs a comment
  begin insert into public.claims (submission_id, date_of_loss, currency) values (sub, current_date - 400, 'EUR'); raise exception 'FAIL silent accept';
  exception when sqlstate '23514' then null; end;
  insert into public.claims (submission_id, date_of_loss, currency, coverage_comment) values (sub, current_date - 400, 'EUR', 'Held covered')
  returning coverage_issues::text into ok; -- reuse ok briefly
  if ok not like '%before_inception%' or ok not like '%currency%' then raise exception 'FAIL issues not stored: %', ok; end if;
  ok := '1 roles; 2 reading; 3 signed line at DOL; 4 coverage; ';

  -- 5. status rules
  begin update public.claims set status = 'closed' where id = c2; raise exception 'FAIL notified → closed';
  exception when sqlstate '23514' then null; end;
  begin update public.claims set status = 'declined' where id = c2; raise exception 'FAIL decline without reason';
  exception when sqlstate '23514' then null; end;
  update public.claims set status = 'open' where id = c1;
  begin update public.claims set status = 'closed' where id = c1; raise exception 'FAIL closed with outstanding';
  exception when sqlstate '23514' then null; end;
  update public.claims set status = 'closed', close_comment = 'Reserve released on the next bordereau' where id = c1;
  begin insert into public.claim_reserves (claim_id, amount, reason) values (c1, 1, 'x'); raise exception 'FAIL reserve on a closed claim';
  exception when sqlstate '23514' then null; end;
  update public.claims set status = 'reopened' where id = c1;
  ok := ok || '5 status rules; ';

  -- 6. append-only
  begin update public.claim_reserves set amount = 1 where claim_id = c1; raise exception 'FAIL reserve edited';
  exception when sqlstate '42501' then null; end;
  begin delete from public.claim_reserves where claim_id = c1; raise exception 'FAIL reserve deleted';
  exception when sqlstate '42501' then null; end;
  insert into public.claim_reserves (claim_id, amount, reason) values (c1, -5000, 'Correction');
  if (select outstanding from public.claims_v where id = c1) <> 45000 then raise exception 'FAIL correction'; end if;
  ok := ok || '6 append-only; ';

  -- 7. large loss: 15 % of a 2m reserve-equivalent crosses 250k → flag + management and admin follow-ups; a user cannot set it
  begin update public.claims set large_loss = true where id = c2; raise exception 'FAIL user set the large-loss mark';
  exception when sqlstate '42501' then null; end;
  insert into public.claim_reserves (claim_id, amount, reason) values (c2, 260000, 'Adjuster');
  if not (select large_loss from public.claims where id = c2) then raise exception 'FAIL large loss not flagged'; end if;
  select count(*) into n from public.follow_ups_v where entity_id = c2 and type = 'large_loss' and assigned_role in ('management', 'admin');
  if n <> 2 then raise exception 'FAIL % large-loss follow-ups', n; end if;
  if (select entity_ref from public.follow_ups_v where entity_id = c2 limit 1) <> (select claim_no from public.claims where id = c2) then raise exception 'FAIL follow-up ref'; end if;
  ok := ok || '7 large loss; ';
  reset role;

  -- 8. payments (finance): cash in the claim currency; offset creates a receipt and its allocations, in full only; cross-currency needs a rate
  perform set_config('request.jwt.claims', json_build_object('sub', cl, 'role', 'authenticated')::text, true);
  insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_role) values ('claim', c2, 'cash_call_due', 'Cash call', now() + interval '3 days', 'finance');
  perform set_config('request.jwt.claims', json_build_object('sub', fin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  p := public.create_claim_payment(jsonb_build_object('claim_id', c2, 'amount', 100000, 'type', 'cash_call'));
  if exists (select 1 from public.follow_ups where entity_id = c2 and type = 'cash_call_due' and done_at is null) then raise exception 'FAIL cash call left open'; end if;
  begin
    perform public.create_claim_payment(jsonb_build_object('claim_id', c2, 'amount', 1000, 'method', 'offset_against_premium'),
                                        jsonb_build_array(jsonb_build_object('installment_id', inst, 'amount', 600)));
    raise exception 'FAIL partial offset';
  exception when sqlstate '23514' then null; end;
  p := public.create_claim_payment(jsonb_build_object('claim_id', c2, 'amount', 1000, 'method', 'offset_against_premium'),
                                   jsonb_build_array(jsonb_build_object('installment_id', inst, 'amount', 1000)));
  if p.offset_receipt_id is null or not exists (select 1 from public.premium_allocations where receipt_id = p.offset_receipt_id and installment_id = inst and amount = 1000) then
    raise exception 'FAIL offset allocation'; end if;
  if (select paid_amount from public.premium_installments_v where id = inst) <> 1000 then raise exception 'FAIL offset did not pay the installment'; end if;
  begin
    perform public.create_claim_payment(jsonb_build_object('claim_id', c2, 'amount', 500, 'method', 'offset_against_premium'),
                                        jsonb_build_array(jsonb_build_object('installment_id', inst_eur, 'amount', 500)));
    raise exception 'FAIL cross-currency offset without a rate';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  if (select paid_total from public.claims_v where id = c2) <> 101000 then raise exception 'FAIL paid total'; end if;
  if (select incurred from public.claims_v where id = c2) <> 260000 then raise exception 'FAIL incurred'; end if;
  ok := ok || '8 payments, offset, cash call; ';
  reset role;

  -- 9. recoveries reduce incurred
  perform set_config('request.jwt.claims', json_build_object('sub', cl, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.claim_recoveries (claim_id, type, amount) values (c2, 'subrogation', 10000);
  if (select incurred from public.claims_v where id = c2) <> 250000 then raise exception 'FAIL recovery'; end if;
  reset role;
  ok := ok || '9 recoveries; ';

  -- 10. review job: a stale real claim gets a reminder, demo claims never
  perform set_config('request.jwt.claims', json_build_object('sub', cl, 'role', 'authenticated')::text, true);
  insert into public.claims (submission_id, notified_date, date_of_loss, currency, handler_id, status) values (sub, current_date - 120, current_date - 125, 'USD', cl, 'open') returning id into c1;
  select count(*) into n from public.follow_ups f join public.claims c on c.id = f.entity_id where f.type = 'claim_review' and c.is_demo;
  perform public.run_daily_claim_follow_ups();
  if not exists (select 1 from public.follow_ups where entity_id = c1 and type = 'claim_review' and assigned_to = cl) then raise exception 'FAIL no review reminder'; end if;
  if (select count(*) from public.follow_ups f join public.claims c on c.id = f.entity_id where f.type = 'claim_review' and c.is_demo) <> n then
    raise exception 'FAIL the job reminded on demo claims'; end if;
  ok := ok || '10 review job skips demo; ';

  -- 11. demo isolation: a real user sees no demo claims; demo mode only demo ones; the link check is clean
  perform set_config('request.jwt.claims', json_build_object('sub', mg, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if exists (select 1 from public.claims_v where claim_no like 'DEMO-%') then raise exception 'FAIL real user sees demo claims'; end if;
  if exists (select 1 from public.claim_payments_v where claim_no like 'DEMO-%') then raise exception 'FAIL real user sees demo payments'; end if;
  reset role;
  update public.profiles set ui_demo_mode = true where id = mg;
  set local role authenticated;
  if exists (select 1 from public.claims_v where claim_no not like 'DEMO-%') then raise exception 'FAIL demo mode sees real claims'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  select count(*) into n from public.demo_link_violations(); if n <> 0 then raise exception 'FAIL % demo/real links', n; end if;
  perform public.delete_demo_data();
  if exists (select 1 from public.claims where is_demo) or exists (select 1 from public.claim_reserves where is_demo) then raise exception 'FAIL demo claims left'; end if;
  if not exists (select 1 from public.claims where id = c2) then raise exception 'FAIL delete removed a real claim'; end if;
  ok := ok || '11 demo isolation and delete';

  raise exception 'ROLLBACK OK: %', ok;
end $t$;
