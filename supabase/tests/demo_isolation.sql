-- Demo data isolation. Runs in one DO block and always ends in an exception, so
-- nothing it does is kept. Needs one admin profile. Loads the demo data first
-- when none is loaded (rolled back with the rest).
-- Usage: paste into the SQL editor and run; the error text should read
-- «ROLLBACK OK: 1 … 8 …». Any «FAIL …» names the broken rule.
do $t$
declare
  fin uuid := gen_random_uuid(); uw uuid := gen_random_uuid(); adm uuid;
  n int; tot numeric; real_cp uuid; real_sub uuid; real_rcp uuid; demo_inst uuid; ok text := '';
  res jsonb; b boolean; ref text;
begin
  select id into adm from public.profiles where role = 'admin' order by created_at limit 1;
  if not exists (select 1 from public.submissions where is_demo) then perform public._seed_demo_data(adm); end if;
  insert into auth.users (id, email, aud, role) values
    (fin, 'demo-test-fin@example.com', 'authenticated', 'authenticated'),
    (uw,  'demo-test-uw@example.com',  'authenticated', 'authenticated');
  update public.profiles set role = 'finance', active = true where id = fin;
  update public.profiles set role = 'underwriter', active = true where id = uw;

  -- 1. a real user, demo mode off: no demo row anywhere; dashboard totals exclude them
  perform set_config('request.jwt.claims', json_build_object('sub', fin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.submissions_v where insured_name like 'DEMO %'; if n <> 0 then raise exception 'FAIL submissions_v %', n; end if;
  select count(*) into n from public.counterparties where is_demo; if n <> 0 then raise exception 'FAIL counterparties %', n; end if;
  select count(*) into n from public.premium_installments_v where insured_name like 'DEMO %'; if n <> 0 then raise exception 'FAIL installments %', n; end if;
  select count(*) into n from public.premium_receipts where is_demo; if n <> 0 then raise exception 'FAIL receipts %', n; end if;
  select count(*) into n from public.premium_allocations where is_demo; if n <> 0 then raise exception 'FAIL allocations %', n; end if;
  select count(*) into n from public.follow_ups where is_demo; if n <> 0 then raise exception 'FAIL follow-ups %', n; end if;
  reset role;
  select coalesce(sum(our_gross_premium), 0) into tot from public.submissions_v where insured_name not like 'DEMO %';
  set local role authenticated;
  if (select coalesce(sum(our_gross_premium), 0) from public.submissions_v) <> tot then raise exception 'FAIL dashboard total includes demo'; end if;
  ok := ok || '1 hidden when off; ';

  -- 2. real data stays real; the «DEMO » prefix is reserved
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uw, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.counterparties (name, type) values ('Real Test MGA', 'mga') returning id, is_demo into real_cp, b;
  if b then raise exception 'FAIL real counterparty saved as demo'; end if;
  begin insert into public.counterparties (name, type) values ('DEMO Fake', 'mga'); raise exception 'FAIL prefix allowed';
  exception when sqlstate '23514' then ok := ok || '2 prefix reserved; '; end;
  insert into public.submissions (received_at, source_party_id, mga_id, business_type, insured_name, currency, underwriter_id)
    values (current_date, real_cp, real_cp, 'facultative', 'Real Insured', 'USD', uw) returning id, ref_no into real_sub, ref;
  if ref like 'DEMO%' then raise exception 'FAIL real ref %', ref; end if;
  reset role;

  -- 3. real and demo never link (a real receipt paying a demo installment)
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', fin, 'role', 'authenticated')::text, true);
    insert into public.premium_receipts (received_date, payer_id, currency, amount) values (current_date, real_cp, 'USD', 100) returning id into real_rcp;
    select id into demo_inst from public.premium_installments where is_demo limit 1;
    insert into public.premium_allocations (receipt_id, installment_id, amount) values (real_rcp, demo_inst, 50);
    raise exception 'FAIL real receipt paid a demo installment';
  exception when sqlstate '23514' then ok := ok || '3 mixing refused; ';
  end;

  -- 4. demo mode on: only demo rows
  update public.profiles set ui_demo_mode = true where id = fin;
  perform set_config('request.jwt.claims', json_build_object('sub', fin, 'role', 'authenticated')::text, true); -- undone with the sub-block above
  set local role authenticated;
  select count(*) into n from public.submissions_v where insured_name not like 'DEMO %'; if n <> 0 then raise exception 'FAIL real submissions in demo mode'; end if;
  select count(*) into n from public.counterparties where not is_demo; if n <> 0 then raise exception 'FAIL real counterparties in demo mode'; end if;
  select count(*) into n from public.submissions_v; if n = 0 then raise exception 'FAIL no demo rows in demo mode'; end if;
  ok := ok || '4 only demo when on; ';
  -- 5. … and writes only demo data
  begin insert into public.counterparties (name, type, is_demo) values ('X', 'mga', false); raise exception 'FAIL wrote real data in demo mode';
  exception when sqlstate '42501' then ok := ok || '5 writes in own mode; '; end;
  reset role;

  -- 6. the daily jobs create nothing for demo rows
  select count(*) into n from public.follow_ups where is_demo;
  perform public.run_daily_follow_ups(); perform public.run_daily_premium_follow_ups();
  if (select count(*) from public.follow_ups where is_demo) <> n then raise exception 'FAIL a job created demo follow-ups'; end if;
  ok := ok || '6 jobs skip demo; ';

  -- 7. the link check is clean; delete removes all demo data and only that
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  select count(*) into n from public.demo_link_violations(); if n <> 0 then raise exception 'FAIL % demo/real links', n; end if;
  res := public.delete_demo_data();
  if exists (select 1 from public.submissions where is_demo) or exists (select 1 from public.counterparties where is_demo)
     or exists (select 1 from public.follow_ups where is_demo) or exists (select 1 from public.premium_receipts where is_demo) then
    raise exception 'FAIL delete left demo rows';
  end if;
  if not exists (select 1 from public.submissions where id = real_sub) then raise exception 'FAIL delete removed real data'; end if;
  ok := ok || '7 delete ' || res::text || '; ';

  -- 8. only an admin may delete
  perform set_config('request.jwt.claims', json_build_object('sub', fin, 'role', 'authenticated')::text, true);
  begin perform public.delete_demo_data(); raise exception 'FAIL finance deleted demo data';
  exception when sqlstate '42501' then ok := ok || '8 admin only'; end;

  raise exception 'ROLLBACK OK: %', ok;
end $t$;
