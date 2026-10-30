-- =====================================================================
-- DEMO DATA ONLY — do not run on a production database you care about.
-- 3 MGAs, 2 brokers, monthly FX rates, 22 submissions across all statuses.
-- Statuses are applied through apply_submission_status() so history and
-- follow-ups are realistic; timestamps are then back-dated.
-- Underwriter / actor = the first admin profile (if any).
-- Remove later with: supabase/demo_cleanup.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- FX rates: 1st of each month, Jan 2025 → current month (demo values)
-- ---------------------------------------------------------------------
insert into public.fx_rates (currency, rate_date, rate_to_usd, source)
select c.currency, d::date, c.rate * (1 + c.drift * extract(epoch from (d - date '2025-01-01')) / (86400 * 365)), 'demo'
from (values
  ('EUR', 1.0800000000, 0.020),
  ('GBP', 1.2700000000, 0.010),
  ('UZS', 0.0000785000, -0.050),
  ('AED', 0.2722800000, 0.000),
  ('KZT', 0.0020000000, -0.060),
  ('TRY', 0.0290000000, -0.250)
) as c(currency, rate, drift)
cross join generate_series(date '2025-01-01', date_trunc('month', current_date), interval '1 month') d
on conflict (currency, rate_date) do nothing;

-- ---------------------------------------------------------------------
-- Counterparties
-- ---------------------------------------------------------------------
insert into public.counterparties (name, type, country_code, contacts, notes) values
  ('Silk Road Underwriting Agency', 'mga', 'AE',
   '[{"name":"Farhod Karimov","role":"Managing Director","email":"f.karimov@silkroad-ua.example","phone":"+971 4 000 1001"}]', 'DEMO'),
  ('Caspian Specialty MGA', 'mga', 'KZ',
   '[{"name":"Aigerim Nurlanova","role":"Head of Underwriting","email":"a.nurlanova@caspian-mga.example","phone":"+7 727 000 2002"}]', 'DEMO'),
  ('Meridian Risk Partners', 'mga', 'GB',
   '[{"name":"James Whitfield","role":"Class Underwriter","email":"j.whitfield@meridianrisk.example","phone":"+44 20 0000 3003"}]', 'DEMO'),
  ('Tashkent Re Brokers', 'broker', 'UZ',
   '[{"name":"Dilnoza Rakhimova","role":"Account Executive","email":"d.rakhimova@tashre.example","phone":"+998 71 000 4004"}]', 'DEMO'),
  ('Gulf Placement Partners', 'broker', 'AE',
   '[{"name":"Omar Haddad","role":"Partner","email":"o.haddad@gulfpp.example","phone":"+971 4 000 5005"}]', 'DEMO')
on conflict (name, type) do nothing;

-- ---------------------------------------------------------------------
-- Submissions
-- ---------------------------------------------------------------------
do $$
declare
  v_uid   uuid := (select id from public.profiles where role = 'admin' order by created_at limit 1);
  v_start timestamptz := now();  -- transaction start: audit rows of this run carry exactly this time
  r       record;
  v_id    uuid;
  v_step  text;
  v_ago   int;
  v_ts    timestamptz;
begin
  if exists (select 1 from public.counterparties c join public.submissions s on s.mga_id = c.id where c.notes = 'DEMO') then
    raise notice 'Demo submissions already present — skipping';
    return;
  end if;

  if v_uid is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  end if;

  alter table public.submission_status_history disable trigger submission_status_history_no_update;

  for r in
    select * from (values
      -- insured, country, lob, mga, broker, biz, ccy, si, limit, deductible, gp100, comm, brok, written, signed,
      -- path, days ago: received, review, offer, no_resp, final, offer validity days, reason, risk
      ('Navoiyazot Chemical Plant', 'UZ', 'PROP', 'Silk Road Underwriting Agency', 'Tashkent Re Brokers', 'facultative', 'USD',
        180000000, 60000000, 500000, 720000, 22.5, 5.0, 10.0, 8.0,
        array['under_review','offered','bound'], 400, 396, 390, null, 380, 30, null, 'Chemical plant, fire & explosion, BI 12 months'),
      ('Tashkent City Mall', 'UZ', 'PROP', 'Silk Road Underwriting Agency', 'Tashkent Re Brokers', 'facultative', 'USD',
        95000000, 95000000, 250000, 285000, 25.0, 5.0, 15.0, 12.5,
        array['under_review','offered','bound'], 280, 277, 268, null, 250, 30, null, 'Shopping mall PD/BI, earthquake zone 8'),
      ('Almalyk MMC Fleet Cargo Programme', 'UZ', 'CARGO', 'Caspian Specialty MGA', null, 'binder', 'USD',
        40000000, 5000000, 25000, 410000, 27.5, 0, 20.0, 20.0,
        array['under_review','offered','bound'], 200, 198, 192, null, 180, 30, null, 'Annual cargo open cover, copper concentrate'),
      ('Kazakh Telecom Cyber Programme', 'KZ', 'CYBER', 'Caspian Specialty MGA', 'Gulf Placement Partners', 'facultative', 'USD',
        20000000, 20000000, 250000, 640000, 20.0, 7.5, 10.0, 7.5,
        array['under_review','offered','bound'], 140, 137, 131, null, 120, 30, null, 'Primary cyber tower, USD 20m xs 250k'),
      ('Georgian Mineral Water Exporters Credit', 'GE', 'CRED', 'Meridian Risk Partners', null, 'facultative', 'EUR',
        12000000, 12000000, 100000, 168000, 30.0, 0, 15.0, 15.0,
        array['under_review','offered','no_response','bound'], 150, 148, 140, 105, 90, 30, null, 'Trade credit whole turnover, EU buyers'),
      ('Emirates Aviation Services Hull', 'AE', 'AVIA', 'Silk Road Underwriting Agency', 'Gulf Placement Partners', 'facultative', 'USD',
        310000000, 310000000, 1000000, 1550000, 17.5, 5.0, 5.0, 5.0,
        array['under_review','offered','bound'], 90, 88, 82, null, 70, 30, null, 'Hull all risks + war, 6 narrow-body aircraft'),
      ('Bukhara Gas Compressor Station', 'UZ', 'ENER', 'Silk Road Underwriting Agency', 'Tashkent Re Brokers', 'facultative', 'USD',
        75000000, 75000000, 1000000, 525000, 20.0, 5.0, 10.0, null,
        array['under_review','offered','no_response'], 80, 78, 70, 35, null, 30, null, 'Onshore energy PD, gas compression'),
      ('Ankara Metro Rolling Stock', 'TR', 'ENG', 'Meridian Risk Partners', null, 'facultative', 'EUR',
        140000000, 140000000, 500000, 392000, 25.0, 0, 7.5, null,
        array['under_review','offered','ntu'], 75, 73, 65, null, 45, 30, 'Placed with another reinsurer at a lower rate', 'CAR/EAR rolling stock delivery & testing'),
      ('Riyadh Logistics Hub', 'SA', 'PROP', 'Silk Road Underwriting Agency', 'Gulf Placement Partners', 'facultative', 'USD',
        60000000, 60000000, 250000, 132000, 22.5, 5.0, 10.0, null,
        array['under_review','offered'], 60, 58, 50, null, null, 21, null, 'Warehouse complex PD, high-value stock'),
      ('Ferghana Textile Mills', 'UZ', 'PROP', 'Caspian Specialty MGA', 'Tashkent Re Brokers', 'facultative', 'UZS',
        250000000000, 250000000000, 1000000000, 1875000000, 20.0, 5.0, null, null,
        array['under_review','declined'], 55, 52, null, null, 48, null, 'Poor fire protection; 5-year loss ratio above 140%', 'Textile mills fire & allied perils'),
      ('Bishkek Hydro Cascade', 'KG', 'ENER', 'Caspian Specialty MGA', null, 'facultative', 'USD',
        210000000, 100000000, 2000000, 840000, 20.0, 0, null, null,
        array['under_review','declined'], 40, 38, null, null, 33, null, 'Outside appetite: dam risk, no loss history available', 'Hydro power plants cascade, PD/BI'),
      ('Muscat Desalination Plant', 'OM', 'ENER', 'Silk Road Underwriting Agency', 'Gulf Placement Partners', 'facultative', 'USD',
        120000000, 120000000, 500000, 480000, 20.0, 5.0, 7.5, null,
        array['under_review','offered'], 35, 33, 28, null, null, 45, null, 'Desalination plant operational PD/BI'),
      ('Baku Data Centre', 'AZ', 'CYBER', 'Caspian Specialty MGA', null, 'facultative', 'USD',
        15000000, 15000000, 100000, 300000, 20.0, 0, 10.0, null,
        array['under_review','offered'], 25, 23, 18, null, null, 30, null, 'Cyber & tech E&O, tier-III data centre'),
      ('London Market D&O Lineslip — Central Asia', 'GB', 'FINL', 'Meridian Risk Partners', null, 'binder', 'GBP',
        25000000, 25000000, 50000, 450000, 27.5, 0, 12.5, null,
        array['under_review','offered'], 20, 18, 12, null, null, 30, null, 'D&O lineslip for Central Asian listed companies'),
      ('Gulf Pharma Distribution', 'AE', 'CARGO', 'Silk Road Underwriting Agency', 'Gulf Placement Partners', 'facultative', 'USD',
        18000000, 3000000, 10000, 126000, 25.0, 5.0, null, null,
        array['under_review'], 15, 13, null, null, null, null, null, 'Cold-chain pharma cargo, GCC distribution'),
      ('Caspian Offshore Supply Vessels', 'AZ', 'HULL', 'Caspian Specialty MGA', null, 'facultative', 'USD',
        48000000, 48000000, 150000, 336000, 20.0, 0, null, null,
        array['under_review'], 12, 10, null, null, null, null, null, 'Hull & machinery, 4 offshore supply vessels'),
      ('Aktau Port Cargo Programme', 'KZ', 'CARGO', 'Caspian Specialty MGA', 'Tashkent Re Brokers', 'binder', 'USD',
        30000000, 4000000, 15000, 270000, 25.0, 5.0, 15.0, null,
        array['under_review','offered'], 10, 8, 3, null, null, 30, null, 'Port storage & transit cargo binder'),
      ('Samarkand Solar Park', 'UZ', 'ENG', 'Meridian Risk Partners', 'Tashkent Re Brokers', 'facultative', 'USD',
        85000000, 85000000, 250000, 212500, 22.5, 5.0, null, null,
        array['under_review'], 9, 7, null, null, null, null, null, 'CAR 200 MW solar PV, 18-month construction'),
      ('Tashkent Metro Extension Lot 3', 'UZ', 'ENG', 'Silk Road Underwriting Agency', 'Tashkent Re Brokers', 'facultative', 'UZS',
        900000000000, 900000000000, 2500000000, 4050000000, 20.0, 5.0, null, null,
        array['under_review'], 6, 5, null, null, null, null, null, 'CAR tunnelling works, 6.4 km'),
      ('Almaty Grain Terminal JSC', 'KZ', 'AGRI', 'Caspian Specialty MGA', null, 'facultative', 'USD',
        22000000, 22000000, 50000, 154000, 20.0, 0, null, null,
        array[]::text[], 4, null, null, null, null, null, null, 'Grain elevator & stock, fire/explosion'),
      ('Navoi Mining Logistics LLC', 'UZ', 'PROP', 'Silk Road Underwriting Agency', 'Tashkent Re Brokers', 'facultative', 'USD',
        35000000, 35000000, 100000, 105000, 22.5, 5.0, null, null,
        array[]::text[], 2, null, null, null, null, null, null, 'Mining logistics depot PD'),
      ('Dubai Marina Tower 7', 'AE', 'PROP', 'Meridian Risk Partners', 'Gulf Placement Partners', 'facultative', 'AED',
        550000000, 550000000, 1000000, 1100000, 25.0, 5.0, null, null,
        array[]::text[], 1, null, null, null, null, null, null, 'Residential high-rise PD, terrorism excluded')
    ) as t(insured, country, lob, mga, broker, biz, ccy, si, lim, ded, gp, comm, brok, written, signed,
           path, d_received, d_review, d_offer, d_noresp, d_final, validity, reason, risk)
    order by d_received desc
  loop
    insert into public.submissions (
      received_at, source_party_id, mga_id, broker_id, business_type, insured_name, insured_country,
      risk_description, lob_id, period_from, period_to, currency, sum_insured_100, limit_100, deductible,
      gross_premium_100, commission_pct, brokerage_pct, written_share_pct, payment_terms_days,
      underwriter_id, created_by, created_at, notes)
    values (
      current_date - r.d_received,
      coalesce((select id from public.counterparties where name = r.broker and type = 'broker'),
               (select id from public.counterparties where name = r.mga and type = 'mga')),
      (select id from public.counterparties where name = r.mga and type = 'mga'),
      (select id from public.counterparties where name = r.broker and type = 'broker'),
      r.biz::public.business_type, r.insured, r.country, r.risk,
      (select id from public.lines_of_business where code = r.lob),
      current_date - r.d_received + 30, current_date - r.d_received + 395,
      r.ccy, r.si, r.lim, r.ded, r.gp, r.comm, r.brok, r.written, 90,
      v_uid, v_uid, now() - make_interval(days => r.d_received), 'DEMO')
    returning id into v_id;

    foreach v_step in array r.path loop
      v_ago := case v_step
                 when 'under_review' then r.d_review
                 when 'offered'      then r.d_offer
                 when 'no_response'  then r.d_noresp
                 else r.d_final end;
      v_ts := now() - make_interval(days => v_ago);

      perform public.apply_submission_status(
        v_id, v_step::public.submission_status, v_uid,
        case when v_step in ('declined', 'ntu') then r.reason
             when v_step = 'bound' then 'Firm order received from MGA'
             when v_step = 'offered' then 'Quote sent'
             else null end,
        case when v_step = 'offered' then r.written end,
        case when v_step = 'offered' then (current_date - r.d_offer + r.validity) end,
        case when v_step = 'bound' then r.signed end,
        null);

      -- back-date this step
      update public.submission_status_history
         set changed_at = v_ts
       where submission_id = v_id and to_status = v_step::public.submission_status;

      perform set_config('app.status_change', 'on', true);
      update public.submissions
         set status_changed_at = v_ts,
             offered_at = case when v_step = 'offered' then v_ts else offered_at end,
             bound_at   = case when v_step = 'bound'   then v_ts else bound_at end
       where id = v_id;
      perform set_config('app.status_change', 'off', true);

      if v_step = 'offered' then
        update public.follow_ups
           set created_at = v_ts, due_at = v_ts + interval '7 days'
         where entity_type = 'submission' and entity_id = v_id and done_at is null;
      elsif v_step in ('bound', 'ntu', 'no_response') then
        update public.follow_ups
           set done_at = v_ts
         where entity_type = 'submission' and entity_id = v_id and done_at is not null and done_at > v_ts;
      end if;
    end loop;
  end loop;

  -- An extra manual follow-up on the oldest open offer (shows "other" type on the agenda)
  insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_to, created_by)
  select 'submission', s.id, 'other', 'Call MGA about revised terms', now() - interval '2 days', v_uid, v_uid
    from public.submissions s
   where s.status = 'offered' and s.notes = 'DEMO'
   order by s.offered_at limit 1;

  alter table public.submission_status_history enable trigger submission_status_history_no_update;

  -- Seed noise is not a real change log (counterparty inserts above share this transaction)
  delete from public.audit_log where changed_at >= v_start;
end $$;

commit;
