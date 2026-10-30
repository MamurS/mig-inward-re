-- Phase 2 step 6 — self-review of the premium module. One DO block that always
-- ends in an exception: nothing it does is kept. Needs one admin profile; loads
-- the demo data when none is loaded (rolled back with the rest).
-- Usage: paste into the SQL editor and run; the error text reads
-- «ROLLBACK OK: …» with each check, or «FAIL …» naming the broken one.
do $t$
declare
  adm uuid; uw uuid := gen_random_uuid(); uw2 uuid := gen_random_uuid(); fin uuid := gen_random_uuid(); mgmt uuid := gen_random_uuid();
  ok text := ''; n int; v numeric; v2 numeric; sub uuid; inst uuid; rcp uuid; b boolean;
begin
  select id into adm from public.profiles where role = 'admin' order by created_at limit 1;
  if not exists (select 1 from public.submissions where is_demo) then perform public._seed_demo_data(adm); end if;
  insert into auth.users (id, email, aud, role) values
    (uw, 'rv-uw@example.com', 'authenticated', 'authenticated'), (uw2, 'rv-uw2@example.com', 'authenticated', 'authenticated'),
    (fin, 'rv-fin@example.com', 'authenticated', 'authenticated'), (mgmt, 'rv-mgmt@example.com', 'authenticated', 'authenticated');
  update public.profiles set role = 'underwriter', active = true, ui_demo_mode = true where id in (uw, uw2);
  update public.profiles set role = 'finance', active = true, ui_demo_mode = true where id = fin;
  update public.profiles set role = 'management', active = true, ui_demo_mode = true where id = mgmt;
  -- give uw one demo submission of his own (the seed's are the admin's)
  select id into sub from public.submissions where is_demo and status = 'bound' and insured_name = 'DEMO Bursa Automotive Parts';
  perform set_config('app.demo_admin', 'on', true);
  update public.submissions set underwriter_id = uw where id = sub;
  perform set_config('app.demo_admin', 'off', true);

  -- 1. sums: every demo schedule equals our net premium; no installment over-paid; no receipt over-allocated
  select count(*) into n from public.premium_schedule_check_v c join public.submissions s on s.id = c.submission_id
   where s.is_demo and c.has_schedule and c.difference <> 0;
  if n <> 0 then raise exception 'FAIL % demo schedules differ from our net premium', n; end if;
  select count(*) into n from public.premium_installments_v where paid_amount > net_amount and type <> 'return';
  if n <> 0 then raise exception 'FAIL % installments paid over their net', n; end if;
  select count(*) into n from public.premium_receipts_v where allocated_amount > amount or unallocated_amount <> amount - allocated_amount;
  if n <> 0 then raise exception 'FAIL % receipts over-allocated or with a wrong balance', n; end if;
  select count(*) into n from public.premium_installments_v i
   where i.type <> 'return' and i.status <> 'written_off'
     and i.status <> case when i.paid_amount >= i.net_amount then 'paid' when i.paid_amount > 0 then 'partially_paid' else 'open' end::public.installment_status;
  if n <> 0 then raise exception 'FAIL % installment statuses disagree with their payments', n; end if;
  ok := ok || '1 sums; ';

  -- 2. FX: every allocation's installment amount = amount × rate, rounded to cents; the USD → EUR demo one
  select count(*) into n from public.premium_allocations where installment_amount <> round(amount * coalesce(fx_rate, 1), 2);
  if n <> 0 then raise exception 'FAIL % allocations converted wrongly', n; end if;
  select count(*) into n from public.premium_allocations a join public.premium_receipts r on r.id = a.receipt_id
    join public.premium_installments i on i.id = a.installment_id
   where r.currency <> i.currency and a.fx_rate is null;
  if n <> 0 then raise exception 'FAIL % cross-currency allocations without a rate', n; end if;
  select count(*) into n from public.premium_allocations a join public.premium_receipts r on r.id = a.receipt_id
    join public.premium_installments i on i.id = a.installment_id where r.is_demo and r.currency = 'USD' and i.currency = 'EUR';
  if n < 1 then raise exception 'FAIL no demo cross-currency allocation to check'; end if;
  ok := ok || '2 fx; ';

  -- 3. overdue days and buckets: exact days since the due date (Tashkent day), only while something is owed
  select count(*) into n from public.premium_installments_v i
   where i.type <> 'return' and i.outstanding_amount > 0 and i.due_date < public.tashkent_today()
     and i.days_overdue <> public.tashkent_today() - i.due_date;
  if n <> 0 then raise exception 'FAIL % wrong overdue day counts', n; end if;
  select count(*) into n from public.premium_installments_v i
   where coalesce(i.aging_bucket, '-') <> case when i.days_overdue <= 0 or i.days_overdue is null then '-' when i.days_overdue <= 30 then '0-30'
         when i.days_overdue <= 60 then '31-60' when i.days_overdue <= 90 then '61-90' else '90+' end;
  if n <> 0 then raise exception 'FAIL % wrong ageing buckets', n; end if;
  select count(*) into n from public.premium_installments_v where (paid_amount >= net_amount or type = 'return') and days_overdue > 0;
  if n <> 0 then raise exception 'FAIL % paid or return items counted overdue', n; end if;
  select count(distinct aging_bucket) into n from public.premium_installments_v i join public.premium_installments b on b.id = i.id where b.is_demo and i.aging_bucket is not null;
  if n <> 4 then raise exception 'FAIL demo data covers % of the 4 buckets', n; end if;
  ok := ok || '3 overdue days; ';

  -- 4. roles (in demo mode, on demo rows)
  perform set_config('request.jwt.claims', json_build_object('sub', uw, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.generate_premium_schedule(sub, null);  -- own submission: allowed
  begin
    perform public.generate_premium_schedule((select id from public.submissions where is_demo and status = 'bound' and underwriter_id <> uw and insured_name = 'DEMO Samarkand Cotton Cluster'), null);
    raise exception 'FAIL underwriter regenerated someone else''s schedule';
  exception when sqlstate '42501' then null; end;
  begin
    insert into public.premium_receipts (received_date, payer_id, currency, amount)
    values (current_date, (select id from public.counterparties where is_demo limit 1), 'USD', 10);
    raise exception 'FAIL underwriter recorded a receipt';
  exception when sqlstate '42501' then null; end;
  select count(*) into n from public.premium_installments_v; if n = 0 then raise exception 'FAIL underwriter cannot read premium'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', mgmt, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.premium_installments set notes = 'x' where id = (select id from public.premium_installments limit 1);
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FAIL management changed an installment'; end if;
  exception when sqlstate '42501' then null; end;
  begin
    insert into public.premium_receipts (received_date, payer_id, currency, amount)
    values (current_date, (select id from public.counterparties where is_demo limit 1), 'USD', 10);
    raise exception 'FAIL management recorded a receipt';
  exception when sqlstate '42501' then null; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', fin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select id into inst from public.premium_installments_v where type <> 'return' and outstanding_amount > 100 limit 1;
  insert into public.premium_receipts (received_date, payer_id, currency, amount)
  values (current_date, (select mga_id from public.premium_installments_v where id = inst), 'USD', 100) returning id into rcp;
  begin
    insert into public.premium_allocations (receipt_id, installment_id, amount) values (rcp, inst, 101);
    raise exception 'FAIL allocated more than the receipt';
  exception when sqlstate '23514' then null; end;
  ok := ok || '4 roles; ';
  reset role;

  -- 5. demo isolation of every dashboard figure: a real user out of demo mode sees the real sums, in demo mode the demo sums
  update public.profiles set ui_demo_mode = false where id = fin;
  select coalesce(sum(i.outstanding_usd), 0) into v from public.premium_installments_v i join public.premium_installments b on b.id = i.id where not b.is_demo;
  select coalesce(sum(r.amount_usd), 0) into v2 from public.premium_receipts_v r join public.premium_receipts b on b.id = r.id where not b.is_demo and r.received_date >= date_trunc('year', current_date);
  perform set_config('request.jwt.claims', json_build_object('sub', fin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if (select coalesce(sum(outstanding_usd), 0) from public.premium_installments_v) <> v then raise exception 'FAIL outstanding includes demo'; end if;
  if (select coalesce(sum(payable_usd), 0) from public.premium_installments_v where payable_amount > 0)
     <> (select coalesce(sum(payable_usd), 0) from public.premium_installments_v i where payable_amount > 0 and insured_name not like 'DEMO %') then raise exception 'FAIL payable includes demo'; end if;
  if (select coalesce(sum(amount_usd), 0) from public.premium_receipts_v where received_date >= date_trunc('year', current_date)) <> v2 then raise exception 'FAIL receipts include demo'; end if;
  select count(*) into n from public.premium_installments_v where insured_name like 'DEMO %'; if n <> 0 then raise exception 'FAIL demo items listed'; end if;
  select count(*) into n from public.follow_ups_v where type = 'premium_overdue' and entity_label like 'DEMO %'; if n <> 0 then raise exception 'FAIL demo follow-ups listed'; end if;
  reset role;
  update public.profiles set ui_demo_mode = true where id = fin;
  select coalesce(sum(i.outstanding_usd), 0) into v from public.premium_installments_v i join public.premium_installments b on b.id = i.id where b.is_demo;
  set local role authenticated;
  if (select coalesce(sum(outstanding_usd), 0) from public.premium_installments_v) <> v then raise exception 'FAIL demo-mode outstanding is not the demo sum'; end if;
  select count(*) into n from public.premium_installments_v where insured_name not like 'DEMO %'; if n <> 0 then raise exception 'FAIL real items in demo mode'; end if;
  reset role;
  ok := ok || '5 demo isolation (outstanding, overdue, payable, receipts, follow-ups)';

  raise exception 'ROLLBACK OK: %', ok;
end $t$;
