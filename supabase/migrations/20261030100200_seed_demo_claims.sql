-- Demo claims (Phase 3), loaded with the rest of the demo data and deleted
-- with it. Nine claims on the demo risks, every status and feature:
-- open with reserve history and a payment (and a review reminder: no reserve
-- movement for over 90 days), a large loss with a paid and an open cash call,
-- a claim closed at zero, an offset against premium, a notified claim
-- awaiting documents, a EUR claim with a salvage recovery, a declined claim,
-- a loss before inception accepted with a comment, a closed-and-reopened one.

create or replace function public._seed_demo_claims(p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c   uuid;
  v_sub uuid;
  v_ins uuid;
  v_was boolean;
  d     date := public.tashkent_today();
begin
  if exists (select 1 from public.claims where is_demo) then
    raise exception 'Demo claims are already loaded — delete the demo data first' using errcode = '23505';
  end if;
  if not exists (select 1 from public.submissions where is_demo) then
    raise exception 'Load the demo submissions first' using errcode = '23514';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
  perform set_config('app.demo_admin', 'on', true);
  -- rows that take the user's mode by default (the offset receipt) must be demo: seed in demo mode, then restore
  select ui_demo_mode into v_was from public.profiles where id = p_actor;
  update public.profiles set ui_demo_mode = true where id = p_actor;

  -- 1. fire at the chemical plant: reserve history, a payment, no movement for 160 days → review reminder
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Navoiyazot Chemical Plant';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id)
  values (v_sub, d - 210, d - 215, 'Fire', 'Ammonia unit 2, Navoi', 'Fire in the compressor hall; production stopped for 6 weeks', 'SRU-CL-2026-014', 'USD', 2500000, 'open', p_actor)
  returning id into v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values
    (v_c, d - 205, 120000, 'Initial reserve per loss advice'),
    (v_c, d - 160, 40000, 'Adjuster report: business interruption extended');
  insert into public.claim_payments (claim_id, payment_date, currency, amount, type, method, bank_reference)
  values (v_c, d - 100, 'USD', 50000, 'indemnity', 'cash', 'SWIFT DEMO-CLP-0001');
  insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_to, is_demo)
  values ('claim', v_c, 'claim_review', 'Review the reserve', now() - interval '3 days', p_actor, true);

  -- 2. aircraft hull: large loss (5 % of 8m = 400k), a cash call paid and another due
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Emirates Aviation Services Hull';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id)
  values (v_sub, d - 28, d - 30, 'Hard landing', 'Sharjah International Airport', 'Hard landing; main gear collapse, wing damage', 'GPP-H-0911', 'USD', 8000000, 'open', p_actor)
  returning id into v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values (v_c, d - 25, 400000, 'Initial reserve: repair estimate');
  insert into public.claim_payments (claim_id, payment_date, currency, amount, type, method, bank_reference)
  values (v_c, d - 10, 'USD', 150000, 'cash_call', 'cash', 'SWIFT DEMO-CLP-0002');
  insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_role, is_demo)
  values ('claim', v_c, 'cash_call_due', 'Cash call: USD 100,000 to the MGA', now() + interval '5 days', 'finance', true);

  -- 3. flood at the mall: reserved, paid in full, closed at zero
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Tashkent City Mall';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id)
  values (v_sub, d - 98, d - 100, 'Flood', 'Basement parking and retail level -1', 'Water ingress after a burst main', 'TRB-2026-077', 'USD', 400000, 'open', p_actor)
  returning id into v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values (v_c, d - 95, 30000, 'Reserve per loss adjuster');
  insert into public.claim_payments (claim_id, payment_date, currency, amount, type, method, bank_reference)
  values (v_c, d - 60, 'USD', 30000, 'indemnity', 'cash', 'SWIFT DEMO-CLP-0003');
  update public.claims set status = 'closed' where id = v_c;

  -- 4. cargo theft: paid by offset against the MGA's overdue premium
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Almalyk MMC Fleet Cargo Programme';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id)
  values (v_sub, d - 58, d - 60, 'Theft', 'Rail siding, Almalyk', 'Two containers of copper concentrate stolen in transit', 'CSM-C-118', 'USD', 150000, 'open', p_actor)
  returning id into v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values (v_c, d - 55, 25000, 'Reserve per survey');
  select i.id into v_ins from public.premium_installments i where i.submission_id = v_sub and i.type = 'original' order by i.installment_no limit 1;
  perform public.create_claim_payment(
    jsonb_build_object('claim_id', v_c, 'payment_date', d - 40, 'amount', 20000, 'type', 'indemnity', 'method', 'offset_against_premium',
                       'notes', 'Offset against overdue premium, agreed with the MGA'),
    jsonb_build_array(jsonb_build_object('installment_id', v_ins, 'amount', 20000)));

  -- 5. cyber incident: just notified, waiting for documents
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Kazakh Telecom Cyber Programme';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id)
  values (v_sub, d - 10, d - 12, 'Ransomware', 'Almaty data centre', 'Ransomware attack; billing systems down for 3 days', 'GPP-CY-0042', 'USD', 1000000, 'notified', p_actor)
  returning id into v_c;
  insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_to, is_demo)
  values ('claim', v_c, 'awaiting_documents', 'Forensic report and proof of loss from the MGA', now() + interval '7 days', p_actor, true);

  -- 6. trade credit (EUR, no FX rate stored): reserve and a salvage recovery
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Georgian Wine Exporters Credit';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id)
  values (v_sub, d - 38, d - 40, 'Buyer insolvency', 'Hamburg, Germany', 'German distributor insolvent; unpaid invoices', 'MRP-TC-2026-5', 'EUR', 400000, 'open', p_actor)
  returning id into v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values (v_c, d - 35, 60000, 'Reserve: insured debt, our share');
  insert into public.claim_recoveries (claim_id, recovery_date, type, amount, notes) values (v_c, d - 10, 'salvage', 5000, 'Stock recovered from the buyer''s warehouse');

  -- 7. declined: excluded peril
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Izmir Port Logistics Centre';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id)
  values (v_sub, d - 45, d - 50, 'Roof collapse', 'Warehouse B', 'Roof collapsed after years of corrosion', 'ANA-P-0310', 'USD', 900000, 'notified', p_actor)
  returning id into v_c;
  update public.claims set status = 'declined', decline_reason = 'Excluded peril: gradual deterioration (wear and tear), policy exclusion 4.2' where id = v_c;

  -- 8. loss before inception, accepted with a comment (coverage check)
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Samarkand Cotton Cluster';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id, coverage_comment)
  values (v_sub, d - 25, d - 35, 'Fire', 'Gin No. 3, Samarkand', 'Fire in the cotton store', 'TUA-F-0021', 'USD', 120000, 'open', p_actor,
          'Loss date per the adjuster; the MGA confirms cover was held from binding — accepted by the claims manager')
  returning id into v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values (v_c, d - 20, 15000, 'Initial reserve');

  -- 9. machinery breakdown (EUR): paid, closed, reopened with hidden damage
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Bursa Automotive Parts';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id)
  values (v_sub, d - 8, d - 10, 'Machinery breakdown', 'Press line 4, Bursa', 'Hydraulic press failure', 'ANA-E-0007', 'EUR', 150000, 'open', p_actor)
  returning id into v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values (v_c, d - 7, 12000, 'Repair quote');
  insert into public.claim_payments (claim_id, payment_date, currency, amount, type, method, bank_reference)
  values (v_c, d - 4, 'EUR', 12000, 'indemnity', 'cash', 'SWIFT DEMO-CLP-0004');
  update public.claims set status = 'closed' where id = v_c;
  update public.claims set status = 'reopened' where id = v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values (v_c, d - 1, 8000, 'Hidden damage found on reopening');

  update public.profiles set ui_demo_mode = coalesce(v_was, false) where id = p_actor;
  perform set_config('app.demo_admin', 'off', true);
  return public.demo_data_counts_all();
end;
$$;
revoke execute on function public._seed_demo_claims(uuid) from public, anon, authenticated;

-- Admin › Load demo data: submissions, premium and claims
create or replace function public.seed_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Only an admin can load demo data' using errcode = '42501';
  end if;
  perform public._seed_demo_data(auth.uid());
  return public._seed_demo_claims(auth.uid());
end;
$$;
revoke execute on function public.seed_demo_data() from public, anon;
grant execute on function public.seed_demo_data() to authenticated;
