-- Demo data realism: loss ratios a reinsurer would recognise. Before this,
-- the demo claims' reserves were several times the risks' premium (portfolio
-- loss ratios of 300–1 400 %). Calibrated so that, on the day the demo world
-- is loaded, every MGA's loss ratio (our share, USD; incurred / written and
-- incurred / earned, src/features/claims/ratios.ts) sits between 20 % and
-- 90 %, except Silk Road (≈ 65 % written / ≈ 120 % earned: the large hull
-- loss) — docs/decisions.md row 37 lists the targets. Same stories: a large
-- loss (flagged on the estimate, our share USD 280 000), a cash call paid and
-- one open, an offset against premium, a review reminder, a declined claim,
-- a reopened claim, a salvage recovery, a claim on a EUR risk.
-- What changed: claim estimates / reserves / payments, the binder's claims
-- bordereau, the received dates of three bound risks (Georgian, Bursa,
-- Samarkand Cotton: an MGA whose only risk started a month ago cannot show an
-- earned ratio in range), and «Georgian Wine Exporters Credit» is now
-- «Georgian Mineral Water Exporters Credit». Functions only: the demo world
-- already loaded keeps its rows until it is deleted and loaded again
-- (Admin › Demo data).

create or replace function public._seed_demo_data(p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r      record;
  v_id   uuid;
  v_step text;
  v_ago  int;
  v_ts   timestamptz;
  v_sub  jsonb := '{}'::jsonb;  -- insured → submission id
  v_rcp  uuid;
  v_amt  numeric;
  n_sub  int := 0;
  cp     jsonb := '{}'::jsonb;  -- name → counterparty id
  v_cp   uuid;
begin
  if exists (select 1 from public.submissions where is_demo) or exists (select 1 from public.counterparties where is_demo) then
    raise exception 'Demo data is already loaded — delete it first' using errcode = '23505';
  end if;

  -- act as the admin who asked (numbering, «who», permission checks inside the RPCs), outside the demo-mode guard
  perform set_config('request.jwt.claims', json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
  perform set_config('app.demo_admin', 'on', true);

  -- ------------------------------------------------------------- counterparties
  for r in select * from (values
    ('DEMO Anatolia MGA', 'mga', 'TR', 'Elif Demir', 'Managing Director', 'elif.demir@anatolia-mga.example', '+90 212 000 1001'),
    ('DEMO Silk Road Underwriting', 'mga', 'AE', 'Farhod Karimov', 'Managing Director', 'f.karimov@silkroad-ua.example', '+971 4 000 1002'),
    ('DEMO Caspian Specialty MGA', 'mga', 'KZ', 'Aigerim Nurlanova', 'Head of Underwriting', 'a.nurlanova@caspian-mga.example', '+7 727 000 1003'),
    ('DEMO Meridian Risk Partners', 'mga', 'GB', 'James Whitfield', 'Class Underwriter', 'j.whitfield@meridianrisk.example', '+44 20 0000 1004'),
    ('DEMO Turan Underwriting Agency', 'mga', 'UZ', 'Bobur Aliev', 'Chief Underwriter', 'b.aliev@turan-ua.example', '+998 71 000 1005'),
    ('DEMO Tashkent Re Brokers', 'broker', 'UZ', 'Dilnoza Rakhimova', 'Account Executive', 'd.rakhimova@tashre.example', '+998 71 000 2001'),
    ('DEMO Gulf Placement Partners', 'broker', 'AE', 'Omar Haddad', 'Partner', 'o.haddad@gulfpp.example', '+971 4 000 2002'),
    ('DEMO Bosphorus Re Brokers', 'broker', 'TR', 'Kerem Aydin', 'Senior Broker', 'k.aydin@bosphorus-re.example', '+90 212 000 2003')
  ) as t(name, type, country, contact, role, email, phone)
  loop
    insert into public.counterparties (name, type, country_code, contacts, is_demo, created_by)
    values (r.name, r.type::public.counterparty_type, r.country,
            jsonb_build_array(jsonb_build_object('name', r.contact, 'role', r.role, 'email', r.email, 'phone', r.phone)), true, p_actor)
    returning id into v_cp;
    cp := cp || jsonb_build_object(r.name, v_cp);
  end loop;

  -- ------------------------------------------------------------- submissions
  alter table public.submission_status_history disable trigger submission_status_history_no_update;

  for r in
    select * from (values
      -- insured, country, lob, mga, broker, biz, ccy, si, limit, ded, gp100, comm, brok, written, signed,
      -- path, days ago: received, review, offer, no_resp, final, offer validity days, reason, risk
      ('Navoiyazot Chemical Plant', 'UZ', 'PROP', 'Silk Road Underwriting', 'Tashkent Re Brokers', 'facultative', 'USD', 180000000, 60000000, 500000, 720000, 22.5, 5.0, 10.0, 8.0, array['under_review','offered','bound'], 400, 396, 390, null, 380, 30, null, 'Chemical plant, fire & explosion, BI 12 months'),
      ('Tashkent City Mall', 'UZ', 'PROP', 'Silk Road Underwriting', 'Tashkent Re Brokers', 'facultative', 'USD', 95000000, 95000000, 250000, 285000, 25.0, 5.0, 15.0, 12.5, array['under_review','offered','bound'], 280, 277, 268, null, 250, 30, null, 'Shopping mall PD/BI, earthquake zone 8'),
      ('Almalyk MMC Fleet Cargo Programme', 'UZ', 'CARGO', 'Caspian Specialty MGA', null, 'binder', 'USD', 40000000, 5000000, 25000, 410000, 27.5, 0, 20.0, 20.0, array['under_review','offered','bound'], 200, 198, 192, null, 180, 30, null, 'Annual cargo open cover, copper concentrate'),
      ('Kazakh Telecom Cyber Programme', 'KZ', 'CYBER', 'Caspian Specialty MGA', 'Gulf Placement Partners', 'facultative', 'USD', 20000000, 20000000, 250000, 640000, 20.0, 7.5, 10.0, 7.5, array['under_review','offered','bound'], 140, 137, 131, null, 120, 30, null, 'Primary cyber tower, USD 20m xs 250k'),
      ('Georgian Mineral Water Exporters Credit', 'GE', 'CRED', 'Meridian Risk Partners', null, 'facultative', 'EUR', 12000000, 12000000, 100000, 168000, 30.0, 0, 15.0, 15.0, array['under_review','offered','no_response','bound'], 150, 148, 140, 105, 90, 30, null, 'Trade credit whole turnover, EU buyers'),
      ('Emirates Aviation Services Hull', 'AE', 'AVIA', 'Silk Road Underwriting', 'Gulf Placement Partners', 'facultative', 'USD', 310000000, 310000000, 1000000, 1550000, 17.5, 5.0, 5.0, 5.0, array['under_review','offered','bound'], 90, 88, 82, null, 70, 30, null, 'Hull all risks + war, 6 narrow-body aircraft'),
      ('Izmir Port Logistics Centre', 'TR', 'PROP', 'Anatolia MGA', 'Bosphorus Re Brokers', 'facultative', 'USD', 120000000, 120000000, 500000, 600000, 22.5, 5.0, 10.0, 10.0, array['under_review','offered','bound'], 130, 127, 120, null, 110, 30, null, 'Container terminal PD/BI, earthquake zone 1'),
      ('Samarkand Cotton Cluster', 'UZ', 'AGRI', 'Turan Underwriting Agency', 'Tashkent Re Brokers', 'facultative', 'USD', 45000000, 45000000, 100000, 315000, 20.0, 5.0, 15.0, 12.0, array['under_review','offered','bound'], 200, 198, 192, null, 180, 30, null, 'Cotton gins and warehouses, fire'),
      ('Bursa Automotive Parts', 'TR', 'ENG', 'Anatolia MGA', null, 'facultative', 'EUR', 80000000, 80000000, 250000, 288000, 20.0, 0, 10.0, 10.0, array['under_review','offered','bound'], 160, 158, 153, null, 145, 30, null, 'Machinery breakdown, press lines'),
      ('Bukhara Gas Compressor Station', 'UZ', 'ENER', 'Silk Road Underwriting', 'Tashkent Re Brokers', 'facultative', 'USD', 75000000, 75000000, 1000000, 525000, 20.0, 5.0, 10.0, null, array['under_review','offered','no_response'], 80, 78, 70, 35, null, 30, null, 'Onshore energy PD, gas compression'),
      ('Konya Solar Field', 'TR', 'ENG', 'Anatolia MGA', 'Bosphorus Re Brokers', 'facultative', 'USD', 65000000, 65000000, 200000, 195000, 22.5, 5.0, 12.5, null, array['under_review','offered','no_response'], 70, 68, 62, 28, null, 30, null, 'Operational PV plant, hail and fire'),
      ('Ankara Metro Rolling Stock', 'TR', 'ENG', 'Meridian Risk Partners', null, 'facultative', 'EUR', 140000000, 140000000, 500000, 392000, 25.0, 0, 7.5, null, array['under_review','offered','ntu'], 75, 73, 65, null, 45, 30, 'Placed with another reinsurer at a lower rate', 'CAR/EAR rolling stock delivery & testing'),
      ('Termez River Port', 'UZ', 'CARGO', 'Turan Underwriting Agency', null, 'facultative', 'USD', 15000000, 5000000, 20000, 90000, 25.0, 0, 15.0, null, array['under_review','offered','ntu'], 58, 56, 50, null, 22, 21, 'Client renewed with the incumbent', 'River port storage and handling'),
      ('Ferghana Textile Mills', 'UZ', 'PROP', 'Caspian Specialty MGA', 'Tashkent Re Brokers', 'facultative', 'UZS', 250000000000, 250000000000, 1000000000, 1875000000, 20.0, 5.0, null, null, array['under_review','declined'], 55, 52, null, null, 48, null, 'Poor fire protection; 5-year loss ratio above 140%', 'Textile mills fire & allied perils'),
      ('Bishkek Hydro Cascade', 'KG', 'ENER', 'Caspian Specialty MGA', null, 'facultative', 'USD', 210000000, 100000000, 2000000, 840000, 20.0, 0, null, null, array['under_review','declined'], 40, 38, null, null, 33, null, 'Outside appetite: dam risk, no loss history available', 'Hydro power plants cascade, PD/BI'),
      ('Antalya Resort Hotels', 'TR', 'PROP', 'Anatolia MGA', 'Bosphorus Re Brokers', 'facultative', 'USD', 90000000, 90000000, 250000, 270000, 25.0, 5.0, null, null, array['under_review','declined'], 30, 28, null, null, 24, null, 'Wildfire exposure above our aggregate', '5 coastal resort hotels PD/BI'),
      ('Riyadh Logistics Hub', 'SA', 'PROP', 'Silk Road Underwriting', 'Gulf Placement Partners', 'facultative', 'USD', 60000000, 60000000, 250000, 132000, 22.5, 5.0, 10.0, null, array['under_review','offered'], 60, 58, 50, null, null, 21, null, 'Warehouse complex PD, high-value stock'),
      ('Muscat Desalination Plant', 'OM', 'ENER', 'Silk Road Underwriting', 'Gulf Placement Partners', 'facultative', 'USD', 120000000, 120000000, 500000, 480000, 20.0, 5.0, 7.5, null, array['under_review','offered'], 35, 33, 28, null, null, 45, null, 'Desalination plant operational PD/BI'),
      ('Baku Data Centre', 'AZ', 'CYBER', 'Caspian Specialty MGA', null, 'facultative', 'USD', 15000000, 15000000, 100000, 300000, 20.0, 0, 10.0, null, array['under_review','offered'], 25, 23, 18, null, null, 30, null, 'Cyber & tech E&O, tier-III data centre'),
      ('London Market D&O Lineslip — Central Asia', 'GB', 'FINL', 'Meridian Risk Partners', null, 'binder', 'GBP', 25000000, 25000000, 50000, 450000, 27.5, 0, 12.5, null, array['under_review','offered'], 20, 18, 12, null, null, 30, null, 'D&O lineslip for Central Asian listed companies'),
      ('Aktau Port Cargo Programme', 'KZ', 'CARGO', 'Caspian Specialty MGA', 'Tashkent Re Brokers', 'binder', 'USD', 30000000, 4000000, 15000, 270000, 25.0, 5.0, 15.0, null, array['under_review','offered'], 10, 8, 3, null, null, 30, null, 'Port storage & transit cargo binder'),
      ('Nukus Wind Farm', 'UZ', 'ENG', 'Turan Underwriting Agency', 'Tashkent Re Brokers', 'facultative', 'USD', 110000000, 110000000, 300000, 330000, 20.0, 5.0, 10.0, null, array['under_review','offered'], 16, 14, 9, null, null, 30, null, 'CAR 100 MW wind farm'),
      ('Gulf Pharma Distribution', 'AE', 'CARGO', 'Silk Road Underwriting', 'Gulf Placement Partners', 'facultative', 'USD', 18000000, 3000000, 10000, 126000, 25.0, 5.0, null, null, array['under_review'], 15, 13, null, null, null, null, null, 'Cold-chain pharma cargo, GCC distribution'),
      ('Caspian Offshore Supply Vessels', 'AZ', 'HULL', 'Caspian Specialty MGA', null, 'facultative', 'USD', 48000000, 48000000, 150000, 336000, 20.0, 0, null, null, array['under_review'], 12, 10, null, null, null, null, null, 'Hull & machinery, 4 offshore supply vessels'),
      ('Samarkand Solar Park', 'UZ', 'ENG', 'Meridian Risk Partners', 'Tashkent Re Brokers', 'facultative', 'USD', 85000000, 85000000, 250000, 212500, 22.5, 5.0, null, null, array['under_review'], 9, 7, null, null, null, null, null, 'CAR 200 MW solar PV, 18-month construction'),
      ('Tashkent Metro Extension Lot 3', 'UZ', 'ENG', 'Silk Road Underwriting', 'Tashkent Re Brokers', 'facultative', 'UZS', 900000000000, 900000000000, 2500000000, 4050000000, 20.0, 5.0, null, null, array['under_review'], 6, 5, null, null, null, null, null, 'CAR tunnelling works, 6.4 km'),
      ('Almaty Grain Terminal JSC', 'KZ', 'AGRI', 'Caspian Specialty MGA', null, 'facultative', 'USD', 22000000, 22000000, 50000, 154000, 20.0, 0, null, null, array[]::text[], 4, null, null, null, null, null, null, 'Grain elevator & stock, fire/explosion'),
      ('Navoi Mining Logistics LLC', 'UZ', 'PROP', 'Turan Underwriting Agency', 'Tashkent Re Brokers', 'facultative', 'USD', 35000000, 35000000, 100000, 105000, 22.5, 5.0, null, null, array[]::text[], 2, null, null, null, null, null, null, 'Mining logistics depot PD'),
      ('Dubai Marina Tower 7', 'AE', 'PROP', 'Meridian Risk Partners', 'Gulf Placement Partners', 'facultative', 'AED', 550000000, 550000000, 1000000, 1100000, 25.0, 5.0, null, null, array[]::text[], 1, null, null, null, null, null, null, 'Residential high-rise PD, terrorism excluded'),
      ('Gaziantep Textile Park', 'TR', 'PROP', 'Anatolia MGA', 'Bosphorus Re Brokers', 'facultative', 'USD', 70000000, 70000000, 250000, 210000, 22.5, 5.0, null, null, array[]::text[], 0, null, null, null, null, null, null, 'Textile park fire & earthquake')
    ) as t(insured, country, lob, mga, broker, biz, ccy, si, lim, ded, gp, comm, brok, written, signed,
           path, d_received, d_review, d_offer, d_noresp, d_final, validity, reason, risk)
    order by d_received desc
  loop
    insert into public.submissions (
      received_at, source_party_id, mga_id, broker_id, business_type, insured_name, insured_country,
      risk_description, lob_id, period_from, period_to, currency, sum_insured_100, limit_100, deductible,
      gross_premium_100, commission_pct, brokerage_pct, written_share_pct, payment_terms_days,
      underwriter_id, created_by, created_at, is_demo)
    values (
      current_date - r.d_received,
      coalesce((cp ->> ('DEMO ' || r.broker))::uuid, (cp ->> ('DEMO ' || r.mga))::uuid),
      (cp ->> ('DEMO ' || r.mga))::uuid,
      (cp ->> ('DEMO ' || r.broker))::uuid,
      r.biz::public.business_type, 'DEMO ' || r.insured, r.country, r.risk,
      (select id from public.lines_of_business where code = r.lob),
      current_date - r.d_received + 30, current_date - r.d_received + 395,
      r.ccy, r.si, r.lim, r.ded, r.gp, r.comm, r.brok, r.written, 90,
      p_actor, p_actor, now() - make_interval(days => r.d_received), true)
    returning id into v_id;
    v_sub := v_sub || jsonb_build_object(r.insured, v_id);
    n_sub := n_sub + 1;

    foreach v_step in array r.path loop
      v_ago := case v_step when 'under_review' then r.d_review when 'offered' then r.d_offer when 'no_response' then r.d_noresp else r.d_final end;
      v_ts := now() - make_interval(days => v_ago);
      perform public.apply_submission_status(
        v_id, v_step::public.submission_status, p_actor,
        case when v_step in ('declined', 'ntu') then r.reason when v_step = 'bound' then 'Firm order received from MGA'
             when v_step = 'offered' then 'Quote sent' else null end,
        case when v_step = 'offered' then r.written end,
        case when v_step = 'offered' then (current_date - r.d_offer + r.validity) end,
        case when v_step = 'bound' then r.signed end,
        null);
      update public.submission_status_history set changed_at = v_ts where submission_id = v_id and to_status = v_step::public.submission_status;
      perform set_config('app.status_change', 'on', true);
      update public.submissions
         set status_changed_at = v_ts,
             offered_at = case when v_step = 'offered' then v_ts else offered_at end,
             bound_at   = case when v_step = 'bound'   then v_ts else bound_at end
       where id = v_id;
      perform set_config('app.status_change', 'off', true);
      if v_step = 'offered' then
        update public.follow_ups set created_at = v_ts, due_at = v_ts + interval '7 days'
         where entity_type = 'submission' and entity_id = v_id and done_at is null;
      elsif v_step in ('bound', 'ntu', 'no_response', 'declined') then
        update public.follow_ups set done_at = v_ts where entity_type = 'submission' and entity_id = v_id and done_at is not null and done_at > v_ts;
      end if;
    end loop;
  end loop;

  alter table public.submission_status_history enable trigger submission_status_history_no_update;

  -- ------------------------------------------------------------- premium schedules (bound)
  -- due dates in days from today: negative = overdue. Ageing: 0-30, 31-60, 61-90, 90+ all present.
  perform public.generate_premium_schedule((v_sub ->> 'Navoiyazot Chemical Plant')::uuid,
    jsonb_build_array(jsonb_build_object('due_date', current_date - 100, 'gross_amount', 57600)));
  perform public.generate_premium_schedule((v_sub ->> 'Tashkent City Mall')::uuid, jsonb_build_array(
    jsonb_build_object('due_date', current_date - 220, 'gross_amount', 8906.25),
    jsonb_build_object('due_date', current_date - 130, 'gross_amount', 8906.25),
    jsonb_build_object('due_date', current_date - 40,  'gross_amount', 8906.25),
    jsonb_build_object('due_date', current_date + 50,  'gross_amount', 8906.25)));
  perform public.generate_premium_schedule((v_sub ->> 'Almalyk MMC Fleet Cargo Programme')::uuid,
    jsonb_build_array(jsonb_build_object('due_date', current_date - 75, 'gross_amount', 82000)));
  perform public.generate_premium_schedule((v_sub ->> 'Kazakh Telecom Cyber Programme')::uuid, jsonb_build_array(
    jsonb_build_object('due_date', current_date - 20, 'gross_amount', 24000),
    jsonb_build_object('due_date', current_date + 70, 'gross_amount', 24000)));
  perform public.generate_premium_schedule((v_sub ->> 'Georgian Mineral Water Exporters Credit')::uuid, jsonb_build_array(
    jsonb_build_object('due_date', current_date - 15, 'gross_amount', 12600),
    jsonb_build_object('due_date', current_date + 80, 'gross_amount', 12600)));
  perform public.generate_premium_schedule((v_sub ->> 'Emirates Aviation Services Hull')::uuid, jsonb_build_array(
    jsonb_build_object('due_date', current_date - 10, 'gross_amount', 19375),
    jsonb_build_object('due_date', current_date + 80, 'gross_amount', 19375),
    jsonb_build_object('due_date', current_date + 170, 'gross_amount', 19375),
    jsonb_build_object('due_date', current_date + 260, 'gross_amount', 19375)));
  perform public.generate_premium_schedule((v_sub ->> 'Izmir Port Logistics Centre')::uuid, jsonb_build_array(
    jsonb_build_object('due_date', current_date - 50, 'gross_amount', 20000),
    jsonb_build_object('due_date', current_date + 40, 'gross_amount', 20000),
    jsonb_build_object('due_date', current_date + 130, 'gross_amount', 20000)));
  perform public.generate_premium_schedule((v_sub ->> 'Samarkand Cotton Cluster')::uuid,
    jsonb_build_array(jsonb_build_object('due_date', current_date - 5, 'gross_amount', 37800)));
  perform public.generate_premium_schedule((v_sub ->> 'Bursa Automotive Parts')::uuid,
    jsonb_build_array(jsonb_build_object('due_date', current_date + 15, 'gross_amount', 28800)));

  -- a return premium: payable to the MGA, not receivable
  insert into public.premium_installments (submission_id, type, due_date, currency, gross_amount, commission_amount, brokerage_amount, notes)
  values ((v_sub ->> 'Tashkent City Mall')::uuid, 'return', current_date - 12, 'USD', -2000, -500, -100, 'Reduced sum insured — endorsement 2');

  -- ------------------------------------------------------------- receipts
  -- Tashkent Re Brokers pay the mall's #1 in full and part of #2 (#2 stays partly paid, 90+)
  insert into public.premium_receipts (received_date, payer_id, currency, amount, bank_reference, is_demo)
  values (current_date - 200, (cp ->> 'DEMO Tashkent Re Brokers')::uuid, 'USD', 11234.38, 'SWIFT MT103 DEMO-TRB-55120', true) returning id into v_rcp;
  insert into public.premium_allocations (receipt_id, installment_id, amount)
  select v_rcp, i.id, i.net_amount from public.premium_installments i where i.submission_id = (v_sub ->> 'Tashkent City Mall')::uuid and i.installment_no = 1;
  insert into public.premium_allocations (receipt_id, installment_id, amount)
  select v_rcp, i.id, 11234.38 - (select net_amount from public.premium_installments where submission_id = i.submission_id and installment_no = 1)
    from public.premium_installments i where i.submission_id = (v_sub ->> 'Tashkent City Mall')::uuid and i.installment_no = 2;

  -- Silk Road pays Navoiyazot in full
  insert into public.premium_receipts (received_date, payer_id, currency, amount, bank_reference, is_demo)
  select current_date - 95, (cp ->> 'DEMO Silk Road Underwriting')::uuid, 'USD', i.net_amount, 'SWIFT MT103 DEMO-SRU-40211', true
    from public.premium_installments i where i.submission_id = (v_sub ->> 'Navoiyazot Chemical Plant')::uuid
  returning id into v_rcp;
  insert into public.premium_allocations (receipt_id, installment_id, amount)
  select v_rcp, i.id, i.net_amount from public.premium_installments i where i.submission_id = (v_sub ->> 'Navoiyazot Chemical Plant')::uuid;

  -- Gulf Placement Partners pay Emirates #1 in full
  insert into public.premium_receipts (received_date, payer_id, currency, amount, bank_reference, is_demo)
  select current_date - 8, (cp ->> 'DEMO Gulf Placement Partners')::uuid, 'USD', i.net_amount, 'SWIFT MT103 DEMO-GPP-77310', true
    from public.premium_installments i where i.submission_id = (v_sub ->> 'Emirates Aviation Services Hull')::uuid and i.installment_no = 1
  returning id into v_rcp;
  insert into public.premium_allocations (receipt_id, installment_id, amount)
  select v_rcp, i.id, i.net_amount from public.premium_installments i where i.submission_id = (v_sub ->> 'Emirates Aviation Services Hull')::uuid and i.installment_no = 1;

  -- Meridian pays in USD for a EUR installment (0.9205 EUR per USD): Georgian Mineral Water #1 in full
  select floor(i.net_amount / 0.9205 * 100) / 100 into v_amt
    from public.premium_installments i where i.submission_id = (v_sub ->> 'Georgian Mineral Water Exporters Credit')::uuid and i.installment_no = 1;
  insert into public.premium_receipts (received_date, payer_id, currency, amount, bank_reference, notes, is_demo)
  values (current_date - 12, (cp ->> 'DEMO Meridian Risk Partners')::uuid, 'USD', v_amt, 'SWIFT MT103 DEMO-MRP-10021', 'Paid in USD; converted at 0.9205 EUR per USD', true)
  returning id into v_rcp;
  insert into public.premium_allocations (receipt_id, installment_id, amount, fx_rate)
  select v_rcp, i.id, v_amt, 0.9205 from public.premium_installments i where i.submission_id = (v_sub ->> 'Georgian Mineral Water Exporters Credit')::uuid and i.installment_no = 1;

  -- Anatolia: USD 15,000 received, 10,000 allocated to Izmir #1 (partly paid, 31-60), 5,000 still unallocated
  insert into public.premium_receipts (received_date, payer_id, currency, amount, bank_reference, is_demo)
  values (current_date - 30, (cp ->> 'DEMO Anatolia MGA')::uuid, 'USD', 15000, 'SWIFT MT103 DEMO-ANA-30117', true) returning id into v_rcp;
  insert into public.premium_allocations (receipt_id, installment_id, amount)
  select v_rcp, i.id, 10000 from public.premium_installments i where i.submission_id = (v_sub ->> 'Izmir Port Logistics Centre')::uuid and i.installment_no = 1;

  -- ------------------------------------------------------------- finance follow-ups on overdue premium
  insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_role, created_by, is_demo)
  select 'premium', i.id, 'premium_overdue', 'Premium overdue', now() - make_interval(days => least(i.days_overdue, 3)), 'finance', null, true
    from public.premium_installments_v i join public.premium_installments b on b.id = i.id
   where b.is_demo and i.type <> 'return' and i.days_overdue > 0 and i.outstanding_amount > 0;

  perform set_config('app.demo_admin', 'off', true);
  return public.demo_data_counts_all();
end;
$$;
revoke execute on function public._seed_demo_data(uuid) from public, anon, authenticated;

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
  values (v_sub, d - 210, d - 215, 'Fire', 'Ammonia unit 2, Navoi', 'Fire in the compressor hall; production stopped for 10 days', 'SRU-CL-2026-014', 'USD', 300000, 'open', p_actor)
  returning id into v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values
    (v_c, d - 205, 14000, 'Initial reserve per loss advice'),
    (v_c, d - 160, 4000, 'Adjuster report: business interruption extended');
  insert into public.claim_payments (claim_id, payment_date, currency, amount, type, method, bank_reference)
  values (v_c, d - 100, 'USD', 11000, 'indemnity', 'cash', 'SWIFT DEMO-CLP-0001');
  insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_to, is_demo)
  values ('claim', v_c, 'claim_review', 'Review the reserve', now() - interval '3 days', p_actor, true);

  -- 2. aircraft hull: large loss on the estimate (5 % of 5.6m = 280k ≥ 250k); reserved for the first cash calls
  --    while the adjuster prices the repair: one cash call paid and another due
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Emirates Aviation Services Hull';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id)
  values (v_sub, d - 28, d - 30, 'Hard landing', 'Sharjah International Airport', 'Hard landing; main gear collapse, wing damage', 'GPP-H-0911', 'USD', 5600000, 'open', p_actor)
  returning id into v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values (v_c, d - 25, 60000, 'Initial reserve: first cash calls, repair estimate awaited');
  insert into public.claim_payments (claim_id, payment_date, currency, amount, type, method, bank_reference)
  values (v_c, d - 10, 'USD', 35000, 'cash_call', 'cash', 'SWIFT DEMO-CLP-0002');
  insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_role, is_demo)
  values ('claim', v_c, 'cash_call_due', 'Cash call: USD 25,000 to the MGA', now() + interval '5 days', 'finance', true);

  -- 3. flood at the mall: reserved, paid in full, closed at zero
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Tashkent City Mall';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id)
  values (v_sub, d - 98, d - 100, 'Flood', 'Basement parking and retail level -1', 'Water ingress after a burst main', 'TRB-2026-077', 'USD', 40000, 'open', p_actor)
  returning id into v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values (v_c, d - 95, 4000, 'Reserve per loss adjuster');
  insert into public.claim_payments (claim_id, payment_date, currency, amount, type, method, bank_reference)
  values (v_c, d - 60, 'USD', 4000, 'indemnity', 'cash', 'SWIFT DEMO-CLP-0003');
  update public.claims set status = 'closed' where id = v_c;

  -- 4. cargo theft: paid by offset against the MGA's overdue premium
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Almalyk MMC Fleet Cargo Programme';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id)
  values (v_sub, d - 58, d - 60, 'Theft', 'Rail siding, Almalyk', 'A container of copper concentrate stolen in transit', 'CSM-C-118', 'USD', 40000, 'open', p_actor)
  returning id into v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values (v_c, d - 55, 8000, 'Reserve per survey');
  select i.id into v_ins from public.premium_installments i where i.submission_id = v_sub and i.type = 'original' order by i.installment_no limit 1;
  perform public.create_claim_payment(
    jsonb_build_object('claim_id', v_c, 'payment_date', d - 40, 'amount', 6000, 'type', 'indemnity', 'method', 'offset_against_premium',
                       'notes', 'Offset against overdue premium, agreed with the MGA'),
    jsonb_build_array(jsonb_build_object('installment_id', v_ins, 'amount', 6000)));

  -- 5. cyber incident: just notified, waiting for documents
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Kazakh Telecom Cyber Programme';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id)
  values (v_sub, d - 10, d - 12, 'Ransomware', 'Almaty data centre', 'Ransomware attack; billing systems down for 3 days', 'GPP-CY-0042', 'USD', 1000000, 'notified', p_actor)
  returning id into v_c;
  insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_to, is_demo)
  values ('claim', v_c, 'awaiting_documents', 'Forensic report and proof of loss from the MGA', now() + interval '7 days', p_actor, true);

  -- 6. trade credit (EUR, no FX rate stored): reserve and a salvage recovery
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Georgian Mineral Water Exporters Credit';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id)
  values (v_sub, d - 38, d - 40, 'Buyer insolvency', 'Hamburg, Germany', 'German distributor insolvent; unpaid invoices', 'MRP-TC-2026-5', 'EUR', 32000, 'open', p_actor)
  returning id into v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values (v_c, d - 35, 4800, 'Reserve: insured debt, our share');
  insert into public.claim_recoveries (claim_id, recovery_date, type, amount, notes) values (v_c, d - 10, 'salvage', 400, 'Unsold stock recovered from the buyer''s warehouse');

  -- 7. declined: excluded peril
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Izmir Port Logistics Centre';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id)
  values (v_sub, d - 45, d - 50, 'Roof collapse', 'Warehouse B', 'Roof collapsed after years of corrosion', 'ANA-P-0310', 'USD', 900000, 'notified', p_actor)
  returning id into v_c;
  update public.claims set status = 'declined', decline_reason = 'Excluded peril: gradual deterioration (wear and tear), policy exclusion 4.2' where id = v_c;

  -- 8. loss before inception, accepted with a comment (coverage check)
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Samarkand Cotton Cluster';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id, coverage_comment)
  values (v_sub, d - 165, d - 175, 'Fire', 'Gin No. 3, Samarkand', 'Fire in the cotton store', 'TUA-F-0021', 'USD', 75000, 'open', p_actor,
          'Loss date per the adjuster; the MGA confirms cover was held from binding — accepted by the claims manager')
  returning id into v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values
    (v_c, d - 160, 6000, 'Initial reserve'),
    (v_c, d - 25, 3000, 'Adjuster''s final report: stock values confirmed');

  -- 9. machinery breakdown (EUR): paid, closed, reopened with hidden damage
  select id into v_sub from public.submissions where is_demo and insured_name = 'DEMO Bursa Automotive Parts';
  insert into public.claims (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100, status, handler_id)
  values (v_sub, d - 8, d - 10, 'Machinery breakdown', 'Press line 4, Bursa', 'Hydraulic press failure', 'ANA-E-0007', 'EUR', 160000, 'open', p_actor)
  returning id into v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values (v_c, d - 7, 10000, 'Repair quote');
  insert into public.claim_payments (claim_id, payment_date, currency, amount, type, method, bank_reference)
  values (v_c, d - 4, 'EUR', 10000, 'indemnity', 'cash', 'SWIFT DEMO-CLP-0004');
  update public.claims set status = 'closed' where id = v_c;
  update public.claims set status = 'reopened' where id = v_c;
  insert into public.claim_reserves (claim_id, movement_date, amount, reason) values (v_c, d - 1, 5500, 'Hidden damage found on reopening');

  update public.profiles set ui_demo_mode = coalesce(v_was, false) where id = p_actor;
  perform set_config('app.demo_admin', 'off', true);
  return public.demo_data_counts_all();
end;
$$;
revoke execute on function public._seed_demo_claims(uuid) from public, anon, authenticated;

create or replace function public._seed_demo_binders(p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d      date := public.tashkent_today();
  v_was  boolean;
  v_mga  uuid;
  v_brk  uuid;
  v_lob  uuid;
  v_sub  uuid;
  v_akt  uuid;
  v_bnd  uuid;
  v_tpl  uuid;
  s      public.submissions;
  m      date;
  m_end  date;
  i      int := 0;
  k      int;
  lines  jsonb;
  prem   jsonb;
  v_lim  numeric;
  v_from date;
  -- risks per month: limit at 100 % (USD); the total is 34m of the 40m aggregate (85 %)
  risk_limits numeric[][] := array[
    [3000000, 2500000, 2000000, 2000000, 1500000, 1000000],
    [4000000, 2500000, 1500000, 1000000, 1000000, 0],
    [3000000, 2000000, 1500000, 1500000, 0, 0],
    [2500000, 1000000, 500000, 0, 0, 0]];
  countries text[] := array['UZ', 'KZ', 'TM', 'UZ', 'KZ', 'UZ'];
begin
  if exists (select 1 from public.binders where is_demo) then
    raise exception 'Demo binders are already loaded — delete the demo data first' using errcode = '23505';
  end if;
  select * into s from public.submissions where is_demo and insured_name = 'DEMO Almalyk MMC Fleet Cargo Programme';
  if s.id is null then
    raise exception 'Load the demo submissions first' using errcode = '23514';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
  perform set_config('app.demo_admin', 'on', true);
  select ui_demo_mode into v_was from public.profiles where id = p_actor;
  update public.profiles set ui_demo_mode = true where id = p_actor;

  v_mga := s.mga_id;
  v_lob := s.lob_id;
  v_sub := s.id;

  insert into public.binders (binder_ref, mga_id, underwriter_id, period_from, period_to, currency, our_share_pct, commission_pct, brokerage_pct,
                              limit_per_risk, aggregate_limit, territories, bordereau_frequency, bordereau_due_days, status, notes)
  values ('ALM-CARGO-' || extract(year from s.period_from), v_mga, p_actor, s.period_from, s.period_to, 'USD', 20, 27.5, 0,
          5000000, 40000000, '{UZ,KZ,TM}', 'monthly', 30, 'active', 'Copper concentrate and fleet cargo, Almalyk MMC; open cover')
  returning id into v_bnd;
  insert into public.binder_lobs (binder_id, lob_id, limit_100) values (v_bnd, v_lob, 5000000);
  perform set_config('app.status_change', 'on', true);
  update public.submissions set binder_id = v_bnd where id = v_sub;
  perform set_config('app.status_change', 'off', true);

  insert into public.bordereau_templates (mga_id, kind, name, mapping, header_row)
  values (v_mga, 'risk', 'Caspian risk bordereau', jsonb_build_object(
            'policy_ref', 'Certificate No', 'insured_name', 'Assured', 'insured_country', 'Country', 'period_from', 'Inception',
            'period_to', 'Expiry', 'currency', 'Currency', 'limit_100', 'Limit 100%', 'sum_insured_100', 'Sum Insured 100%'), 1),
         (v_mga, 'premium', 'Caspian premium bordereau', jsonb_build_object(
            'policy_ref', 'Certificate No', 'insured_name', 'Assured', 'period_from', 'Inception', 'currency', 'Currency',
            'gross_premium_100', 'Gross Premium 100%'), 1);
  select id into v_tpl from public.bordereau_templates where mga_id = v_mga and kind = 'risk' and is_demo;

  -- one month after another, while its bordereaux are due (received 20 days after the month end; month 2's risk one 45 days)
  m := date_trunc('month', s.period_from)::date;
  while i < 4 loop
    i := i + 1;
    m_end := (m + interval '1 month')::date - 1;
    exit when m_end + 45 > d;
    lines := '[]'::jsonb;
    prem := '[]'::jsonb;
    for k in 1 .. 6 loop
      v_lim := risk_limits[i][k];
      continue when v_lim = 0;
      v_from := greatest(s.period_from, m) + (k - 1) * 3;
      lines := lines || jsonb_build_object('line_no', k, 'dup_key', format('ALM-%s-%s|%s', i, k, v_from),
        'policy_ref', format('ALM-%s-%s', i, k), 'insured_name', format('Almalyk MMC shipment %s/%s', i, k),
        'insured_country', countries[k], 'period_from', v_from, 'period_to', v_from + 60, 'currency', 'USD',
        'lob_id', v_lob, 'limit_100', v_lim, 'sum_insured_100', v_lim);
      prem := prem || jsonb_build_object('line_no', k, 'dup_key', format('ALM-%s-%s|NB', i, k),
        'policy_ref', format('ALM-%s-%s', i, k), 'insured_name', format('Almalyk MMC shipment %s/%s', i, k),
        'period_from', v_from, 'currency', 'USD', 'lob_id', v_lob, 'gross_premium_100', round(v_lim * 0.0035, 2));
    end loop;
    perform public.import_bordereau(jsonb_build_object('binder_id', v_bnd, 'kind', 'risk', 'period_start', m, 'period_end', m_end,
              'received_date', m_end + case when i = 2 then 45 else 20 end, 'template_id', v_tpl,
              'file_name', format('Caspian_risk_%s.xlsx', to_char(m, 'YYYY-MM'))), lines);
    if i <= 3 then
      perform public.import_bordereau(jsonb_build_object('binder_id', v_bnd, 'kind', 'premium', 'period_start', m, 'period_end', m_end,
                'received_date', m_end + 20, 'file_name', format('Caspian_premium_%s.xlsx', to_char(m, 'YYYY-MM')),
                'stated_total', (select sum((l ->> 'gross_premium_100')::numeric) from jsonb_array_elements(prem) l),
                'computed_total', (select sum((l ->> 'gross_premium_100')::numeric) from jsonb_array_elements(prem) l)), prem);
    end if;
    if i = 3 then
      perform public.import_bordereau(jsonb_build_object('binder_id', v_bnd, 'kind', 'claims', 'period_start', m, 'period_end', m_end,
                'received_date', m_end + 20, 'file_name', format('Caspian_claims_%s.xlsx', to_char(m, 'YYYY-MM'))),
        jsonb_build_array(
          jsonb_build_object('line_no', 1, 'dup_key', 'CSP-CL-101|' || m, 'claim_ref', 'CSP-CL-101', 'policy_ref', 'ALM-2-1',
                             'insured_name', 'Almalyk MMC shipment 2/1', 'date_of_loss', m - 10, 'notified_date', m - 5, 'currency', 'USD',
                             'cause', 'Overturned truck, Kungrad', 'paid_100', 0, 'outstanding_100', 70000),
          jsonb_build_object('line_no', 2, 'dup_key', 'CSP-CL-102|' || m, 'claim_ref', 'CSP-CL-102', 'policy_ref', 'ALM-3-2',
                             'insured_name', 'Almalyk MMC shipment 3/2', 'date_of_loss', m + 4, 'notified_date', m + 6, 'currency', 'USD',
                             'cause', 'Wet damage in rail wagon', 'paid_100', 20000, 'outstanding_100', 10000)));
    end if;
    m := (m + interval '1 month')::date;
  end loop;

  -- the offered Aktau programme: its binder is a draft until it is bound
  select * into s from public.submissions where is_demo and insured_name = 'DEMO Aktau Port Cargo Programme';
  if s.id is not null then
    insert into public.binders (binder_ref, mga_id, broker_id, underwriter_id, period_from, period_to, currency, our_share_pct, commission_pct, brokerage_pct,
                                limit_per_risk, aggregate_limit, territories, bordereau_frequency, bordereau_due_days, status, notes)
    values ('AKT-CARGO-' || extract(year from s.period_from), s.mga_id, s.broker_id, p_actor, s.period_from, s.period_to, s.currency, 15, 25, 5,
            4000000, 30000000, '{KZ}', 'quarterly', 45, 'draft', 'Port storage and transit; waiting for the firm order')
    returning id into v_akt;
    insert into public.binder_lobs (binder_id, lob_id, limit_100) values (v_akt, s.lob_id, null);
    perform set_config('app.status_change', 'on', true);
    update public.submissions set binder_id = v_akt where id = s.id;
    perform set_config('app.status_change', 'off', true);
  end if;

  update public.profiles set ui_demo_mode = coalesce(v_was, false) where id = p_actor;
  perform set_config('app.demo_admin', 'off', true);
  return public.demo_data_counts_all();
end;
$$;
revoke execute on function public._seed_demo_binders(uuid) from public, anon, authenticated;
