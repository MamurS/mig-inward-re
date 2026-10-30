-- Phase 2 defaults (docs/decisions.md): with no PPW date and no payment terms
-- on the submission, the first installment is due inception + 60 days.
-- Admin › Settings › Premium changes it.
insert into public.settings (key, value, description)
values ('premium_default_terms_days', '60'::jsonb, 'Payment terms used when a submission has no PPW date and no payment terms: due = inception + these days')
on conflict (key) do nothing;

create or replace function public.generate_premium_schedule(p_submission_id uuid, p_installments jsonb default null)
returns setof public.premium_installments
language plpgsql
security definer
set search_path = ''
as $$
declare
  s            record;
  v_rows       jsonb;
  v_count      int;
  v_total      numeric := 0;
  v_comm_total numeric;
  v_brok_total numeric;
  v_comm_sum   numeric := 0;
  v_brok_sum   numeric := 0;
  v_next_no    int;
  v_due        date;
  v_gross      numeric;
  v_comm       numeric;
  v_brok       numeric;
  i            int;
  v_row        public.premium_installments;
begin
  if not public.can_edit_premium_schedule(p_submission_id) then
    raise exception 'You cannot change the premium schedule of this submission' using errcode = '42501';
  end if;

  select v.id, v.status, v.currency, v.signed_share_pct, v.commission_pct, v.brokerage_pct,
         v.our_gross_premium, v.ppw_date, v.period_from, v.bound_at, v.payment_terms_days
    into s
    from public.submissions_v v where v.id = p_submission_id;
  if s.id is null then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;
  if s.status <> 'bound' then
    raise exception 'A premium schedule needs a bound submission' using errcode = '23514';
  end if;

  if exists (select 1 from public.premium_installments pi
              where pi.submission_id = p_submission_id and pi.type = 'original'
                and (pi.written_off_at is not null
                     or exists (select 1 from public.premium_allocations a where a.installment_id = pi.id))) then
    raise exception 'Receipts are already allocated to this schedule; edit the installments instead of regenerating'
      using errcode = '23514';
  end if;

  if p_installments is null or jsonb_typeof(p_installments) <> 'array' or jsonb_array_length(p_installments) = 0 then
    if s.our_gross_premium is null or s.our_gross_premium <= 0 then
      raise exception 'The submission has no premium to schedule' using errcode = '23514';
    end if;
    v_rows := jsonb_build_array(jsonb_build_object(
      'due_date', coalesce(s.ppw_date, coalesce(s.period_from, s.bound_at::date) + coalesce(s.payment_terms_days, public.setting_int('premium_default_terms_days', 60))),
      'gross_amount', s.our_gross_premium));
  else
    v_rows := p_installments;
  end if;

  v_count := jsonb_array_length(v_rows);
  for i in 0 .. v_count - 1 loop
    if (v_rows -> i ->> 'due_date') is null or (v_rows -> i ->> 'gross_amount') is null
       or (v_rows -> i ->> 'gross_amount')::numeric <= 0 then
      raise exception 'Installment %: a due date and a positive amount are needed', i + 1 using errcode = '22023';
    end if;
    v_total := v_total + round((v_rows -> i ->> 'gross_amount')::numeric, 2);
  end loop;
  v_comm_total := round(v_total * s.commission_pct / 100, 2);
  v_brok_total := round(v_total * s.brokerage_pct / 100, 2);

  delete from public.premium_installments pi where pi.submission_id = p_submission_id and pi.type = 'original';
  v_next_no := coalesce((select max(pi.installment_no) from public.premium_installments pi
                          where pi.submission_id = p_submission_id), 0);

  for i in 0 .. v_count - 1 loop
    v_due   := (v_rows -> i ->> 'due_date')::date;
    v_gross := round((v_rows -> i ->> 'gross_amount')::numeric, 2);
    if i < v_count - 1 then
      v_comm := round(v_gross * s.commission_pct / 100, 2);
      v_brok := round(v_gross * s.brokerage_pct / 100, 2);
    else
      v_comm := v_comm_total - v_comm_sum;
      v_brok := v_brok_total - v_brok_sum;
    end if;
    v_comm_sum := v_comm_sum + v_comm;
    v_brok_sum := v_brok_sum + v_brok;
    v_next_no := v_next_no + 1;

    insert into public.premium_installments
      (submission_id, installment_no, type, due_date, currency, gross_amount, commission_amount, brokerage_amount,
       basis_signed_share_pct)
    values (p_submission_id, v_next_no, 'original', v_due, s.currency, v_gross, v_comm, v_brok, s.signed_share_pct)
    returning * into v_row;
    return next v_row;
  end loop;
end;
$$;
