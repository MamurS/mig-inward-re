-- Phase C — binders and bordereaux: rules, roles, effects and demo isolation.
-- One DO block that always ends in an exception: nothing it does is kept.
-- Needs one admin profile and one line of business.
-- Usage: paste into the SQL editor and run; the error text reads
-- «ROLLBACK OK: …» with each check, or «FAIL …» naming the broken one.
do $t$
declare
  adm uuid; uw uuid := gen_random_uuid(); fin uuid := gen_random_uuid(); cl uuid := gen_random_uuid(); mg uuid := gen_random_uuid();
  mga uuid; other uuid; lob uuid; bnd uuid; sub uuid; x public.bordereaux; n int; v numeric; ok text := ''; m0 date; m1 date;
  c1 uuid;
begin
  select id into adm from public.profiles where role = 'admin' order by created_at limit 1;
  select id into lob from public.lines_of_business order by code limit 1;
  insert into auth.users (id, email, aud, role) values
    (uw, 'bt-uw@example.com', 'authenticated', 'authenticated'), (fin, 'bt-fin@example.com', 'authenticated', 'authenticated'),
    (cl, 'bt-claims@example.com', 'authenticated', 'authenticated'), (mg, 'bt-mgmt@example.com', 'authenticated', 'authenticated');
  update public.profiles set role = 'underwriter', active = true, ui_demo_mode = false where id = uw;
  update public.profiles set role = 'finance', active = true, ui_demo_mode = false where id = fin;
  update public.profiles set role = 'claims', active = true, ui_demo_mode = false where id = cl;
  update public.profiles set role = 'management', active = true, ui_demo_mode = false where id = mg;
  m0 := date_trunc('month', current_date - 150)::date;          -- the binder's first month
  m1 := (m0 + interval '1 month')::date;

  -- 1. roles: an underwriter gives a binder to an MGA; finance cannot; a binder needs an MGA
  perform set_config('request.jwt.claims', json_build_object('sub', uw, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.counterparties (name, type) values ('Binder Test MGA', 'mga') returning id into mga;
  insert into public.counterparties (name, type) values ('Binder Test Broker', 'broker') returning id into other;
  insert into public.binders (binder_ref, mga_id, underwriter_id, period_from, period_to, currency, our_share_pct, commission_pct, brokerage_pct,
                              limit_per_risk, aggregate_limit, territories)
  values ('BT-001', mga, uw, m0, m0 + 364, 'USD', 20, 25, 5, 300000, 1000000, '{UZ,KZ}') returning id into bnd;
  insert into public.binder_lobs (binder_id, lob_id, limit_100) values (bnd, lob, 250000);
  begin insert into public.binders (binder_ref, mga_id, period_from, period_to, currency, our_share_pct) values ('BT-002', other, m0, m0 + 30, 'USD', 10);
    raise exception 'FAIL a binder for a broker';
  exception when sqlstate '23514' then null; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', fin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin insert into public.binders (binder_ref, mga_id, period_from, period_to, currency, our_share_pct) values ('BT-003', mga, m0, m0 + 30, 'USD', 10);
    raise exception 'FAIL finance created a binder';
  exception when sqlstate '42501' then null; end;
  reset role;
  ok := ok || '1 roles; ';

  -- 2. the binder submission: only business_type binder, only the binder's MGA; bound to carry premium and claims
  perform set_config('request.jwt.claims', json_build_object('sub', uw, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.submissions (received_at, source_party_id, mga_id, business_type, insured_name, currency, underwriter_id,
                                  period_from, period_to, gross_premium_100, commission_pct, brokerage_pct, binder_id)
  values (m0 - 10, mga, mga, 'binder', 'Binder Test Programme', 'USD', uw, m0, m0 + 364, 500000, 25, 5, bnd) returning id into sub;
  begin update public.submissions set business_type = 'facultative' where id = sub; raise exception 'FAIL a facultative risk on a binder';
  exception when sqlstate '23514' then null; end;
  reset role;
  perform public.apply_submission_status(sub, 'under_review', uw, null, null, null, null, null);
  perform public.apply_submission_status(sub, 'offered', uw, 'Quote', 20, current_date + 30, null, null);
  perform public.apply_submission_status(sub, 'bound', uw, 'Firm', null, null, 20, null);
  ok := ok || '2 binder submission; ';

  -- 3. risk bordereau: every line re-checked (period, territory, limit per risk, line limit), then capacity
  perform set_config('request.jwt.claims', json_build_object('sub', uw, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.import_bordereau(jsonb_build_object('binder_id', bnd, 'kind', 'risk', 'period_start', m0, 'period_end', m1 - 1),
          jsonb_build_array(jsonb_build_object('line_no', 1, 'dup_key', 'P1|x', 'policy_ref', 'P1', 'period_from', m0 - 40, 'currency', 'USD', 'limit_100', 1000)));
    raise exception 'FAIL a line outside the binder period';
  exception when sqlstate '23514' then null; end;
  begin perform public.import_bordereau(jsonb_build_object('binder_id', bnd, 'kind', 'risk', 'period_start', m0, 'period_end', m1 - 1),
          jsonb_build_array(jsonb_build_object('line_no', 1, 'dup_key', 'P1|x', 'policy_ref', 'P1', 'period_from', m0, 'currency', 'USD', 'insured_country', 'RU', 'limit_100', 1000)));
    raise exception 'FAIL a territory outside the binder';
  exception when sqlstate '23514' then null; end;
  begin perform public.import_bordereau(jsonb_build_object('binder_id', bnd, 'kind', 'risk', 'period_start', m0, 'period_end', m1 - 1),
          jsonb_build_array(jsonb_build_object('line_no', 1, 'dup_key', 'P1|x', 'policy_ref', 'P1', 'period_from', m0, 'currency', 'USD', 'limit_100', 400000)));
    raise exception 'FAIL above the limit per risk';
  exception when sqlstate '23514' then null; end;
  begin perform public.import_bordereau(jsonb_build_object('binder_id', bnd, 'kind', 'risk', 'period_start', m0, 'period_end', m1 - 1),
          jsonb_build_array(jsonb_build_object('line_no', 1, 'dup_key', 'P1|x', 'policy_ref', 'P1', 'period_from', m0, 'currency', 'USD', 'lob_id', lob, 'limit_100', 260000)));
    raise exception 'FAIL above the line limit';
  exception when sqlstate '23514' then null; end;
  begin perform public.import_bordereau(jsonb_build_object('binder_id', bnd, 'kind', 'risk', 'period_start', m0, 'period_end', m1 - 1),
          jsonb_build_array(jsonb_build_object('line_no', 1, 'dup_key', 'P1|x', 'status', 'warning', 'policy_ref', 'P1', 'period_from', m0, 'currency', 'USD', 'limit_100', 1000)));
    raise exception 'FAIL a warning without a comment';
  exception when sqlstate '23514' then null; end;
  -- received 40 days after the month end: late (due 30 days); 850,000 of 1,000,000 → the 80 % alert
  x := public.import_bordereau(jsonb_build_object('binder_id', bnd, 'kind', 'risk', 'period_start', m0, 'period_end', m1 - 1, 'received_date', m1 + 39, 'file_name', 'risk.xlsx'),
         jsonb_build_array(
           jsonb_build_object('line_no', 1, 'dup_key', 'P1|' || m0, 'policy_ref', 'P1', 'insured_name', 'A', 'insured_country', 'UZ', 'period_from', m0, 'currency', 'USD', 'lob_id', lob, 'limit_100', 250000),
           jsonb_build_object('line_no', 2, 'dup_key', 'P2|' || m0, 'policy_ref', 'P2', 'insured_name', 'B', 'insured_country', 'KZ', 'period_from', m0 + 3, 'currency', 'USD', 'limit_100', 300000),
           jsonb_build_object('line_no', 3, 'dup_key', 'P3|' || m0, 'policy_ref', 'P3', 'insured_name', 'C', 'period_from', m0 + 5, 'currency', 'USD', 'limit_100', 300000,
                              'status', 'warning', 'comment', 'Country to follow', 'messages', '["No country"]'::jsonb)), 1);
  if x.ref_no !~ '^BDX-\d{4}-\d{4}$' or x.line_count <> 3 or x.warning_count <> 1 or x.rejected_count <> 1 then
    raise exception 'FAIL bordereau % lines % warnings % rejected %', x.ref_no, x.line_count, x.warning_count, x.rejected_count; end if;
  -- the same line again is refused (never imported twice)
  begin perform public.import_bordereau(jsonb_build_object('binder_id', bnd, 'kind', 'risk', 'period_start', m1, 'period_end', (m1 + interval '1 month')::date - 1),
          jsonb_build_array(jsonb_build_object('line_no', 1, 'dup_key', 'P1|' || m0, 'policy_ref', 'P1', 'period_from', m0, 'currency', 'USD', 'limit_100', 1000)));
    raise exception 'FAIL a duplicate line';
  exception when unique_violation then null; end;
  -- lines are records
  begin update public.bordereau_lines set limit_100 = 1 where bordereau_id = x.id; raise exception 'FAIL a line was changed';
  exception when sqlstate '42501' then null; end;
  reset role;
  select capacity_pct into v from public.binders_v where id = bnd;
  if v <> 85.0 then raise exception 'FAIL capacity % %%', v; end if;
  select count(*) into n from public.follow_ups where entity_id = bnd and type = 'capacity_alert' and title = 'Capacity 80 % used';
  if n <> 2 then raise exception 'FAIL % capacity alerts (management + underwriter)', n; end if;
  ok := ok || '3 risk lines checked, duplicates refused, capacity 85 % alerted; ';

  -- 4. periods: the first month's risk bordereau is late; the first premium one is missing
  if (select state from public.binder_periods(bnd) where period_start = m0 and kind = 'risk') <> 'late' then raise exception 'FAIL risk period not late'; end if;
  if (select state from public.binder_periods(bnd) where period_start = m0 and kind = 'premium') <> 'missing' then raise exception 'FAIL premium period not missing'; end if;
  perform public.run_daily_bordereau_follow_ups();
  if not exists (select 1 from public.follow_ups where entity_id = bnd and type = 'bordereau_missing' and title = 'Missing premium bordereau ' || to_char(m0, 'MM.YYYY')) then
    raise exception 'FAIL no missing-bordereau follow-up'; end if;
  select count(*) into n from public.follow_ups where entity_id = bnd and type = 'bordereau_missing';
  perform public.run_daily_bordereau_follow_ups();
  if (select count(*) from public.follow_ups where entity_id = bnd and type = 'bordereau_missing') <> n then raise exception 'FAIL the job repeated follow-ups'; end if;
  if (select entity_ref from public.follow_ups_v where entity_id = bnd limit 1) <> 'BT-001' then raise exception 'FAIL follow-up does not show the binder'; end if;
  ok := ok || '4 periods late / missing, job once; ';

  -- 5. premium bordereau (finance): totals must match or be explained; one installment, our share, net of deductions
  perform set_config('request.jwt.claims', json_build_object('sub', fin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.import_bordereau(jsonb_build_object('binder_id', bnd, 'kind', 'premium', 'period_start', m0, 'period_end', m1 - 1, 'stated_total', 31000, 'computed_total', 30000),
          jsonb_build_array(jsonb_build_object('line_no', 1, 'dup_key', 'P1|NB', 'policy_ref', 'P1', 'period_from', m0, 'currency', 'USD', 'gross_premium_100', 30000)));
    raise exception 'FAIL totals differ without a comment';
  exception when sqlstate '23514' then null; end;
  x := public.import_bordereau(jsonb_build_object('binder_id', bnd, 'kind', 'premium', 'period_start', m0, 'period_end', m1 - 1, 'stated_total', 31000, 'computed_total', 30000,
                                                  'totals_comment', 'MGA total includes a fee'),
         jsonb_build_array(jsonb_build_object('line_no', 1, 'dup_key', 'P1|NB', 'policy_ref', 'P1', 'period_from', m0, 'currency', 'USD', 'gross_premium_100', 10000),
                           jsonb_build_object('line_no', 2, 'dup_key', 'P2|NB', 'policy_ref', 'P2', 'period_from', m0 + 3, 'currency', 'USD', 'gross_premium_100', 20000)));
  reset role;
  if cardinality(x.installment_ids) <> 1 then raise exception 'FAIL % installments', cardinality(x.installment_ids); end if;
  perform 1 from public.premium_installments i where i.id = x.installment_ids[1] and i.submission_id = sub and i.type = 'additional'
    and i.gross_amount = 6000 and i.commission_amount = 1500 and i.brokerage_amount = 300 and i.net_amount = 4200 and i.due_date = m1 - 1 + 30;
  if not found then raise exception 'FAIL installment amounts or due date'; end if;
  ok := ok || '5 premium: comment on totals, installment 20 % net 4,200 due +30; ';

  -- 6. claims bordereau (claims role): a claim per cedent reference, never duplicated; the reserve follows paid + outstanding
  perform set_config('request.jwt.claims', json_build_object('sub', cl, 'role', 'authenticated')::text, true);
  set local role authenticated;
  x := public.import_bordereau(jsonb_build_object('binder_id', bnd, 'kind', 'claims', 'period_start', m1, 'period_end', (m1 + interval '1 month')::date - 1),
         jsonb_build_array(jsonb_build_object('line_no', 1, 'dup_key', 'C-77|' || m1, 'claim_ref', 'C-77', 'policy_ref', 'P1', 'date_of_loss', m1 + 2, 'currency', 'USD',
                                              'paid_100', 0, 'outstanding_100', 50000, 'cause', 'Fire')));
  select c.id into c1 from public.claims c where c.submission_id = sub and c.cedent_claim_ref = 'C-77';
  if c1 is null or (select sum(amount) from public.claim_reserves where claim_id = c1) <> 10000 then raise exception 'FAIL first claims bordereau'; end if;
  if (select claim_id from public.bordereau_lines where bordereau_id = x.id) <> c1 then raise exception 'FAIL the line does not point at the claim'; end if;
  x := public.import_bordereau(jsonb_build_object('binder_id', bnd, 'kind', 'claims', 'period_start', (m1 + interval '1 month')::date, 'period_end', (m1 + interval '2 months')::date - 1),
         jsonb_build_array(jsonb_build_object('line_no', 1, 'dup_key', 'C-77|' || (m1 + interval '1 month')::date, 'claim_ref', 'C-77', 'date_of_loss', m1 + 2, 'currency', 'USD',
                                              'paid_100', 20000, 'outstanding_100', 40000)));
  reset role;
  if (select count(*) from public.claims where submission_id = sub) <> 1 then raise exception 'FAIL the claim was duplicated'; end if;
  if (select sum(amount) from public.claim_reserves where claim_id = c1) <> 12000 then raise exception 'FAIL reserve not moved to 12,000'; end if;
  -- an underwriter cannot import claims (no claim rights)
  perform set_config('request.jwt.claims', json_build_object('sub', uw, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.import_bordereau(jsonb_build_object('binder_id', bnd, 'kind', 'claims', 'period_start', m0, 'period_end', m1 - 1),
          jsonb_build_array(jsonb_build_object('line_no', 1, 'dup_key', 'C-99|x', 'claim_ref', 'C-99', 'date_of_loss', m0 + 2, 'currency', 'USD', 'outstanding_100', 1)));
    raise exception 'FAIL an underwriter imported claims';
  exception when sqlstate '42501' then null; end;
  reset role;
  ok := ok || '6 claims matched by reference, reserve 10,000 → 12,000; ';

  -- 7. demo isolation: a real user sees no demo binders; the link check is clean; delete removes only demo binders
  perform set_config('request.jwt.claims', json_build_object('sub', mg, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if exists (select 1 from public.binders_v where binder_ref like 'DEMO-%') then raise exception 'FAIL real user sees demo binders'; end if;
  if not exists (select 1 from public.binders_v where id = bnd) then raise exception 'FAIL management cannot read the binder'; end if;
  reset role;
  update public.profiles set ui_demo_mode = true where id = mg;
  set local role authenticated;
  if exists (select 1 from public.binders_v where binder_ref not like 'DEMO-%') then raise exception 'FAIL demo mode sees real binders'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  select count(*) into n from public.demo_link_violations(); if n <> 0 then raise exception 'FAIL % demo/real links', n; end if;
  perform public.delete_demo_data();
  if exists (select 1 from public.binders where is_demo) or exists (select 1 from public.bordereaux where is_demo) then raise exception 'FAIL demo binders left'; end if;
  if not exists (select 1 from public.binders where id = bnd) then raise exception 'FAIL delete removed a real binder'; end if;
  ok := ok || '7 demo isolation and delete';

  raise exception 'ROLLBACK OK: %', ok;
end
$t$;
