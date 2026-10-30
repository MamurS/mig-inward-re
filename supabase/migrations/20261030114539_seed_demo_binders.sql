-- Demo binders (Phase C), loaded with the rest of the demo data and deleted
-- with it. The bound «Almalyk MMC Fleet Cargo Programme» gets its binder
-- (Caspian Specialty MGA, 20 %, USD 5m per risk, USD 40m aggregate) with
-- monthly risk bordereaux (one received late), premium bordereaux (each one a
-- premium installment), a claims bordereau (two claims, matched by the
-- cedent's reference), capacity at 85 % (the 80 % alert), the months still
-- missing, and Caspian's saved column mapping. The «Aktau Port Cargo
-- Programme» (offered, not bound) gets a draft binder.
-- Everything goes through import_bordereau, as a user's upload would.

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
                             'cause', 'Overturned truck, Kungrad', 'paid_100', 0, 'outstanding_100', 600000),
          jsonb_build_object('line_no', 2, 'dup_key', 'CSP-CL-102|' || m, 'claim_ref', 'CSP-CL-102', 'policy_ref', 'ALM-3-2',
                             'insured_name', 'Almalyk MMC shipment 3/2', 'date_of_loss', m + 4, 'notified_date', m + 6, 'currency', 'USD',
                             'cause', 'Wet damage in rail wagon', 'paid_100', 50000, 'outstanding_100', 30000)));
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

-- Admin › Load demo data: submissions, premium, claims and binders
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
  perform public._seed_demo_claims(auth.uid());
  return public._seed_demo_binders(auth.uid());
end;
$$;
revoke execute on function public.seed_demo_data() from public, anon;
grant execute on function public.seed_demo_data() to authenticated;
