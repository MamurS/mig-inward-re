-- =====================================================================
-- Phase 2 / Step 2: review follow-ups to step 1 (additive).
--  * Return premium is payable TO the MGA: it is no longer folded into
--    outstanding (receivable). Views show it in its own payable columns.
--  * Write-off records who did it (written_off_by), set by the trigger.
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
-- =====================================================================

alter table public.premium_installments
  add column if not exists written_off_by uuid references public.profiles (id);

create index if not exists premium_installments_written_off_by_idx
  on public.premium_installments (written_off_by) where written_off_by is not null;

-- Same rules as before, plus: written_off_by follows written_off_at
create or replace function public.premium_installments_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid numeric;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.submissions s where s.id = new.submission_id and s.status = 'bound') then
      raise exception 'Premium installments can only be added to a bound submission' using errcode = '23514';
    end if;
    if new.installment_no is null then
      new.installment_no := coalesce((select max(i.installment_no) from public.premium_installments i
                                       where i.submission_id = new.submission_id), 0) + 1;
    end if;
  else
    if new.submission_id is distinct from old.submission_id or new.installment_no is distinct from old.installment_no then
      raise exception 'An installment cannot move to another submission or number' using errcode = '42501';
    end if;
    select coalesce(sum(a.installment_amount), 0) into v_paid
      from public.premium_allocations a where a.installment_id = old.id;
    if v_paid > 0 then
      if new.currency is distinct from old.currency or new.type is distinct from old.type then
        raise exception 'Currency and type cannot change once receipts are allocated' using errcode = '23514';
      end if;
      if new.gross_amount - new.commission_amount - new.brokerage_amount < v_paid then
        raise exception 'Net amount cannot be less than what is already paid (%)', v_paid using errcode = '23514';
      end if;
    end if;
  end if;

  -- Write-off and settling return premium are finance decisions
  if (new.written_off_at is distinct from (case when tg_op = 'UPDATE' then old.written_off_at end)
      or new.settled_at is distinct from (case when tg_op = 'UPDATE' then old.settled_at end))
     and auth.uid() is not null and not public.has_role('admin', 'finance') then
    raise exception 'Only finance can write off an installment or settle return premium' using errcode = '42501';
  end if;
  if new.written_off_at is null then
    new.written_off_reason := null;
    new.written_off_by := null;
  elsif tg_op = 'INSERT' or old.written_off_at is null then
    new.written_off_by := auth.uid();
  else
    new.written_off_by := old.written_off_by;
  end if;

  new.status := public.premium_installment_status(
    new.id, new.type, new.gross_amount - new.commission_amount - new.brokerage_amount, new.settled_at, new.written_off_at);
  return new;
end;
$$;

-- Installments: outstanding = receivable only; return premium shows as payable.
-- Existing columns keep their names and order; new ones are appended.
create or replace view public.premium_installments_v
with (security_invoker = true)
as
with paid as (
  select a.installment_id, sum(a.installment_amount) as paid_amount, max(r.received_date) as last_receipt_date
    from public.premium_allocations a
    join public.premium_receipts r on r.id = a.receipt_id
   group by a.installment_id
), base as (
  select
    i.*,
    coalesce(p.paid_amount, 0) as paid_amount,
    p.last_receipt_date,
    -- receivable: what the MGA still owes us (never negative, never return premium)
    case
      when i.status = 'written_off' or i.type = 'return' then 0
      else i.net_amount - coalesce(p.paid_amount, 0)
    end as outstanding_amount,
    -- payable: return premium we still owe the MGA (shown as a positive amount)
    case when i.type = 'return' and i.settled_at is null and i.status <> 'written_off'
         then -i.net_amount else 0 end as payable_amount,
    public.tashkent_today() as today
  from public.premium_installments i
  left join paid p on p.installment_id = i.id
)
select
  b.id, b.submission_id, b.installment_no, b.type, b.due_date, b.currency,
  b.gross_amount, b.commission_amount, b.brokerage_amount, b.net_amount, b.status,
  b.basis_signed_share_pct, b.settled_at, b.written_off_at, b.written_off_reason, b.notes,
  b.created_at, b.created_by, b.updated_at, b.updated_by,
  b.paid_amount,
  b.outstanding_amount,
  b.last_receipt_date,
  case when b.type <> 'return' and b.outstanding_amount > 0 and b.due_date < b.today
       then b.today - b.due_date else 0 end                                         as days_overdue,
  case when b.type = 'return' or b.outstanding_amount <= 0 or b.due_date >= b.today then null
       when b.today - b.due_date <= 30 then '0-30'
       when b.today - b.due_date <= 60 then '31-60'
       when b.today - b.due_date <= 90 then '61-90'
       else '90+' end                                                               as aging_bucket,
  public.fx_rate_to_usd(b.currency, b.today)                                        as fx_rate_to_usd,
  round(b.net_amount * public.fx_rate_to_usd(b.currency, b.today), 2)               as net_amount_usd,
  round(b.outstanding_amount * public.fx_rate_to_usd(b.currency, b.today), 2)       as outstanding_usd,
  (b.type = 'original' and b.basis_signed_share_pct is distinct from s.signed_share_pct) as basis_mismatch,
  s.ref_no, s.insured_name, s.status as submission_status, s.signed_share_pct,
  s.mga_id, mga.name as mga_name, s.broker_id, brk.name as broker_name,
  s.underwriter_id, coalesce(uw.full_name, uw.email) as underwriter_name,
  b.payable_amount,
  round(b.payable_amount * public.fx_rate_to_usd(b.currency, b.today), 2)           as payable_usd,
  b.written_off_by,
  coalesce(wo.full_name, wo.email)                                                  as written_off_by_name
from base b
join public.submissions s on s.id = b.submission_id
join public.counterparties mga on mga.id = s.mga_id
left join public.counterparties brk on brk.id = s.broker_id
left join public.profiles uw on uw.id = s.underwriter_id
left join public.profiles wo on wo.id = b.written_off_by;

-- Schedule check: total_net now counts receivable installments only
-- (original + additional); return premium is its own payable_total.
create or replace view public.premium_schedule_check_v
with (security_invoker = true)
as
select
  v.id                                                     as submission_id,
  v.ref_no,
  v.currency,
  v.signed_share_pct,
  v.our_gross_premium                                      as expected_gross,
  v.our_net_premium                                        as expected_net,
  coalesce(sum(i.net_amount) filter (where i.type = 'original'), 0)   as scheduled_net,
  coalesce(sum(i.gross_amount) filter (where i.type = 'original'), 0) as scheduled_gross,
  v.our_net_premium - coalesce(sum(i.net_amount) filter (where i.type = 'original'), 0) as difference,
  coalesce(sum(i.net_amount) filter (where i.type <> 'return'), 0)    as total_net,
  count(i.id)                                              as installment_count,
  count(i.id) > 0                                          as has_schedule,
  coalesce(bool_or(i.type = 'original' and i.basis_signed_share_pct is distinct from v.signed_share_pct), false) as basis_mismatch,
  coalesce(-sum(i.net_amount) filter (where i.type = 'return'), 0)    as payable_total
from public.submissions_v v
left join public.premium_installments i on i.submission_id = v.id
where v.status = 'bound'
group by v.id, v.ref_no, v.currency, v.signed_share_pct, v.our_gross_premium, v.our_net_premium;

-- written_off_by is set by the trigger only (no column grant)
grant select on public.premium_installments_v, public.premium_schedule_check_v to authenticated;
