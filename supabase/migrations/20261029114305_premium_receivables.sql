-- =====================================================================
-- Phase 2 / Step 1b: premium receivables — installments, receipts,
-- allocations, views, schedule generation, daily overdue follow-ups.
-- Additive only: new tables / views / functions / policies, one new
-- nullable column (follow_ups.assigned_role), one new setting. No existing
-- row, number or rule changes.
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
--
-- Conventions (as Phase 0–1): money numeric(18,2), percentages numeric(9,6),
-- FX numeric(20,10). Amounts are in the installment's currency unless named
-- otherwise. "Today" for overdue maths is Tashkent's date (UTC+5).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.installment_type as enum ('original', 'additional', 'return');
create type public.installment_status as enum ('open', 'partially_paid', 'paid', 'written_off');

-- Tashkent's calendar date (days overdue, ageing)
create or replace function public.tashkent_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Tashkent')::date
$$;

-- ---------------------------------------------------------------------
-- Installments: what we expect to be paid, per submission.
--   return premium: negative amounts; not collected through receipts —
--   marked settled with a date (settled_at).
-- ---------------------------------------------------------------------
create table public.premium_installments (
  id                     uuid primary key default gen_random_uuid(),
  submission_id          uuid not null references public.submissions (id) on delete restrict,
  installment_no         int  not null check (installment_no > 0),
  type                   public.installment_type not null default 'original',
  due_date               date not null,
  currency               char(3) not null references public.currencies (code),
  gross_amount           numeric(18, 2) not null,
  commission_amount      numeric(18, 2) not null default 0,
  brokerage_amount       numeric(18, 2) not null default 0,
  net_amount             numeric(18, 2) generated always as (gross_amount - commission_amount - brokerage_amount) stored,
  status                 public.installment_status not null default 'open',
  -- the signed share the amounts were built on (a later change is flagged, never recalculated)
  basis_signed_share_pct numeric(9, 6),
  settled_at             date,
  written_off_at         timestamptz,
  written_off_reason     text,
  notes                  text,
  created_at             timestamptz not null default now(),
  created_by             uuid references public.profiles (id),
  updated_at             timestamptz not null default now(),
  updated_by             uuid references public.profiles (id),

  unique (submission_id, installment_no),
  constraint premium_installments_sign_chk check (
    case when type = 'return'
         then gross_amount < 0 and commission_amount <= 0 and brokerage_amount <= 0
         else gross_amount > 0 and commission_amount >= 0 and brokerage_amount >= 0
    end),
  constraint premium_installments_net_chk check (
    case when type = 'return' then gross_amount - commission_amount - brokerage_amount <= 0
         else gross_amount - commission_amount - brokerage_amount >= 0 end),
  constraint premium_installments_settled_chk check (settled_at is null or type = 'return'),
  constraint premium_installments_writeoff_chk check (
    written_off_at is null or length(trim(coalesce(written_off_reason, ''))) > 0)
);

create index premium_installments_submission_idx on public.premium_installments (submission_id);
create index premium_installments_due_idx        on public.premium_installments (due_date) where status in ('open', 'partially_paid');
create index premium_installments_currency_idx   on public.premium_installments (currency);

create trigger premium_installments_audit_columns
before insert or update on public.premium_installments
for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------------
-- Receipts: money received (RCP-2026-0001)
-- ---------------------------------------------------------------------
create table public.premium_receipts (
  id             uuid primary key default gen_random_uuid(),
  ref_no         text not null unique,
  received_date  date not null default current_date,
  payer_id       uuid not null references public.counterparties (id),
  currency       char(3) not null references public.currencies (code),
  amount         numeric(18, 2) not null check (amount > 0),
  bank_reference text,
  notes          text,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles (id)
);

create index premium_receipts_payer_idx    on public.premium_receipts (payer_id);
create index premium_receipts_date_idx     on public.premium_receipts (received_date desc);
create index premium_receipts_currency_idx on public.premium_receipts (currency);

create trigger premium_receipts_audit_columns
before insert or update on public.premium_receipts
for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------------
-- Allocations: which receipt pays which installment.
--   amount             — in the receipt's currency
--   fx_rate            — installment currency per 1 receipt currency (1 if equal)
--   installment_amount — amount × fx_rate, in the installment's currency (stored)
-- ---------------------------------------------------------------------
create table public.premium_allocations (
  id                 uuid primary key default gen_random_uuid(),
  receipt_id         uuid not null references public.premium_receipts (id) on delete cascade,
  installment_id     uuid not null references public.premium_installments (id) on delete restrict,
  amount             numeric(18, 2) not null check (amount > 0),
  fx_rate            numeric(20, 10) check (fx_rate > 0),
  installment_amount numeric(18, 2) not null check (installment_amount > 0),
  created_at         timestamptz not null default now(),
  created_by         uuid references public.profiles (id),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.profiles (id),
  unique (receipt_id, installment_id)
);

create index premium_allocations_installment_idx on public.premium_allocations (installment_id);

create trigger premium_allocations_audit_columns
before insert or update on public.premium_allocations
for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------------
-- Status of an installment, from its own columns and its allocations
-- ---------------------------------------------------------------------
create or replace function public.premium_installment_status(
  p_id uuid, p_type public.installment_type, p_net numeric, p_settled_at date, p_written_off_at timestamptz
)
returns public.installment_status
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_written_off_at is not null then 'written_off'::public.installment_status
    when p_type = 'return' then case when p_settled_at is not null then 'paid' else 'open' end::public.installment_status
    else (
      select case
        when coalesce(sum(a.installment_amount), 0) >= p_net then 'paid'
        when coalesce(sum(a.installment_amount), 0) > 0      then 'partially_paid'
        else 'open'
      end::public.installment_status
      from public.premium_allocations a
      where a.installment_id = p_id
    )
  end
$$;

-- Close open overdue follow-ups once an installment no longer needs chasing
create or replace function public.premium_close_overdue_follow_ups(p_installment_id uuid, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.follow_ups
     set done_at = now(), outcome = p_reason
   where entity_type = 'premium' and entity_id = p_installment_id
     and type = 'premium_overdue' and done_at is null
$$;

-- ---------------------------------------------------------------------
-- Installments: numbering, rules, status
-- ---------------------------------------------------------------------
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
  end if;

  new.status := public.premium_installment_status(
    new.id, new.type, new.gross_amount - new.commission_amount - new.brokerage_amount, new.settled_at, new.written_off_at);
  return new;
end;
$$;

create trigger premium_installments_before_write
before insert or update on public.premium_installments
for each row execute function public.premium_installments_before_write();

create or replace function public.premium_installments_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.follow_ups f where f.entity_type = 'premium' and f.entity_id = old.id;
    return null;
  end if;
  if new.status in ('paid', 'written_off') then
    perform public.premium_close_overdue_follow_ups(new.id,
      case new.status when 'paid' then 'Closed automatically: installment paid'
                      else 'Closed automatically: installment written off' end);
  end if;
  return null;
end;
$$;

create trigger premium_installments_after_write
after insert or update or delete on public.premium_installments
for each row execute function public.premium_installments_after_write();

-- ---------------------------------------------------------------------
-- Receipts: number, immutable number, amount ≥ allocated
-- ---------------------------------------------------------------------
create or replace function public.premium_receipts_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alloc numeric;
begin
  if tg_op = 'INSERT' then
    new.ref_no := public.next_ref_no('RCP', extract(year from new.received_date)::int);
  else
    if new.ref_no is distinct from old.ref_no then
      raise exception 'ref_no cannot be changed' using errcode = '42501';
    end if;
    select coalesce(sum(a.amount), 0) into v_alloc from public.premium_allocations a where a.receipt_id = old.id;
    if v_alloc > 0 and new.currency is distinct from old.currency then
      raise exception 'Currency cannot change once the receipt is allocated' using errcode = '23514';
    end if;
    if new.amount < v_alloc then
      raise exception 'Amount cannot be less than what is already allocated (%)', v_alloc using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger premium_receipts_before_write
before insert or update on public.premium_receipts
for each row execute function public.premium_receipts_before_write();

-- ---------------------------------------------------------------------
-- Allocations: FX, caps, installment status
-- ---------------------------------------------------------------------
create or replace function public.premium_allocations_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt     public.premium_receipts;
  v_installment public.premium_installments;
  v_receipt_used numeric;
  v_inst_paid    numeric;
begin
  if tg_op = 'UPDATE' and (new.receipt_id <> old.receipt_id or new.installment_id <> old.installment_id) then
    raise exception 'An allocation cannot move to another receipt or installment; delete it and allocate again'
      using errcode = '42501';
  end if;

  -- Lock both sides so concurrent allocations cannot overshoot the caps
  select * into v_receipt from public.premium_receipts where id = new.receipt_id for update;
  select * into v_installment from public.premium_installments where id = new.installment_id for update;
  if v_receipt.id is null or v_installment.id is null then
    raise exception 'Receipt or installment not found' using errcode = '23503';
  end if;

  if v_installment.type = 'return' then
    raise exception 'Return premium is settled, not paid through receipts' using errcode = '23514';
  end if;
  if v_installment.status = 'written_off' then
    raise exception 'Installment % is written off', v_installment.installment_no using errcode = '23514';
  end if;

  if v_receipt.currency = v_installment.currency then
    new.fx_rate := 1;
  elsif new.fx_rate is null then
    raise exception 'Exchange rate required: % per 1 %', v_installment.currency, v_receipt.currency using errcode = '23502';
  end if;
  new.installment_amount := round(new.amount * new.fx_rate, 2);

  select coalesce(sum(a.amount), 0) into v_receipt_used
    from public.premium_allocations a where a.receipt_id = new.receipt_id and a.id <> new.id;
  if v_receipt_used + new.amount > v_receipt.amount then
    raise exception 'Allocation exceeds the receipt: % % left to allocate',
      v_receipt.amount - v_receipt_used, v_receipt.currency using errcode = '23514';
  end if;

  select coalesce(sum(a.installment_amount), 0) into v_inst_paid
    from public.premium_allocations a where a.installment_id = new.installment_id and a.id <> new.id;
  if v_inst_paid + new.installment_amount > v_installment.net_amount then
    raise exception 'Allocation exceeds the installment: % % outstanding',
      v_installment.net_amount - v_inst_paid, v_installment.currency using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger premium_allocations_before_write
before insert or update on public.premium_allocations
for each row execute function public.premium_allocations_before_write();

create or replace function public.premium_refresh_installment(p_installment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new public.installment_status;
begin
  select public.premium_installment_status(i.id, i.type, i.net_amount, i.settled_at, i.written_off_at)
    into v_new from public.premium_installments i where i.id = p_installment_id;
  update public.premium_installments i set status = v_new
   where i.id = p_installment_id and i.status is distinct from v_new;
end;
$$;

create or replace function public.premium_allocations_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public.premium_refresh_installment(old.installment_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform public.premium_refresh_installment(new.installment_id); end if;
  return null;
end;
$$;

create trigger premium_allocations_after_write
after insert or update or delete on public.premium_allocations
for each row execute function public.premium_allocations_after_write();

-- Change log
create trigger audit_premium_installments after insert or update or delete on public.premium_installments for each row execute function public.audit_trigger();
create trigger audit_premium_receipts     after insert or update or delete on public.premium_receipts     for each row execute function public.audit_trigger();
create trigger audit_premium_allocations  after insert or update or delete on public.premium_allocations  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- Who may change a submission's schedule: finance, admin, or the
-- submission's own underwriter
-- ---------------------------------------------------------------------
create or replace function public.can_edit_premium_schedule(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin', 'finance')
      or (public.has_role('underwriter')
          and exists (select 1 from public.submissions s
                       where s.id = p_submission_id and s.underwriter_id = auth.uid()))
$$;

-- ---------------------------------------------------------------------
-- generate_premium_schedule(submission, installments)
--   p_installments: null → one installment of our full premium, due on the
--   PPW date, else inception (else bound date) + payment terms.
--   Otherwise a JSON array of { "due_date": "2026-11-30", "gross_amount": "1250.00" };
--   commission and brokerage follow the submission's percentages, with the
--   rounding difference on the last row. The total may differ from the
--   expected premium (the schedule-check view shows the difference).
--   Regenerating replaces the 'original' installments; refused while any of
--   them has receipts allocated or is written off. Additional / return
--   installments are never touched.
-- ---------------------------------------------------------------------
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
      'due_date', coalesce(s.ppw_date, coalesce(s.period_from, s.bound_at::date) + coalesce(s.payment_terms_days, 0)),
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

-- ---------------------------------------------------------------------
-- Views (security_invoker: the base tables' RLS applies)
-- ---------------------------------------------------------------------
create view public.premium_installments_v
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
    case
      when i.status = 'written_off' then 0
      when i.type = 'return' then case when i.settled_at is null then i.net_amount else 0 end
      else i.net_amount - coalesce(p.paid_amount, 0)
    end as outstanding_amount,
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
  s.underwriter_id, coalesce(uw.full_name, uw.email) as underwriter_name
from base b
join public.submissions s on s.id = b.submission_id
join public.counterparties mga on mga.id = s.mga_id
left join public.counterparties brk on brk.id = s.broker_id
left join public.profiles uw on uw.id = s.underwriter_id;

create view public.premium_receipts_v
with (security_invoker = true)
as
select
  r.*,
  coalesce(a.allocated_amount, 0)                                  as allocated_amount,
  r.amount - coalesce(a.allocated_amount, 0)                       as unallocated_amount,
  coalesce(a.allocation_count, 0)                                  as allocation_count,
  public.fx_rate_to_usd(r.currency, r.received_date)               as fx_rate_to_usd,
  round(r.amount * public.fx_rate_to_usd(r.currency, r.received_date), 2) as amount_usd,
  p.name as payer_name,
  p.type as payer_type
from public.premium_receipts r
join public.counterparties p on p.id = r.payer_id
left join (
  select receipt_id, sum(amount) as allocated_amount, count(*) as allocation_count
    from public.premium_allocations group by receipt_id
) a on a.receipt_id = r.id;

-- Per bound submission: expected net premium (signed share) vs the schedule
create view public.premium_schedule_check_v
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
  coalesce(sum(i.net_amount), 0)                           as total_net,
  count(i.id)                                              as installment_count,
  count(i.id) > 0                                          as has_schedule,
  coalesce(bool_or(i.type = 'original' and i.basis_signed_share_pct is distinct from v.signed_share_pct), false) as basis_mismatch
from public.submissions_v v
left join public.premium_installments i on i.submission_id = v.id
where v.status = 'bound'
group by v.id, v.ref_no, v.currency, v.signed_share_pct, v.our_gross_premium, v.our_net_premium;

-- ---------------------------------------------------------------------
-- Follow-ups: a team can own one (finance), and premium / receipt
-- follow-ups validate their target. Additive: new nullable column.
-- ---------------------------------------------------------------------
alter table public.follow_ups add column if not exists assigned_role public.app_role;

create index if not exists follow_ups_open_role_idx on public.follow_ups (assigned_role, due_at)
  where done_at is null and assigned_role is not null;

create or replace function public.follow_ups_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.entity_type = 'submission'
     and not exists (select 1 from public.submissions where id = new.entity_id) then
    raise exception 'Submission % does not exist', new.entity_id using errcode = '23503';
  end if;
  if new.entity_type = 'premium'
     and not exists (select 1 from public.premium_installments where id = new.entity_id) then
    raise exception 'Installment % does not exist', new.entity_id using errcode = '23503';
  end if;
  if new.entity_type = 'receipt'
     and not exists (select 1 from public.premium_receipts where id = new.entity_id) then
    raise exception 'Receipt % does not exist', new.entity_id using errcode = '23503';
  end if;
  if new.done_at is not null and (tg_op = 'INSERT' or old.done_at is null) then
    new.done_by := coalesce(new.done_by, auth.uid());
  end if;
  if new.done_at is null then
    new.done_by := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Same column order as before; premium / receipt targets and the role appended at the end
create or replace view public.follow_ups_v
with (security_invoker = true)
as
select
  f.id, f.entity_type, f.entity_id, f.type, f.title, f.due_at, f.assigned_to, f.done_at, f.done_by,
  f.outcome, f.created_at, f.created_by, f.updated_at,
  case f.entity_type
    when 'submission' then s.ref_no
    when 'premium'    then s.ref_no || ' #' || pi.installment_no
    when 'receipt'    then r.ref_no end                         as entity_ref,
  case f.entity_type
    when 'receipt' then rp.name
    else s.insured_name end                                     as entity_label,
  s.status                                                      as submission_status,
  s.mga_id,
  mga.name                                                      as mga_name,
  s.offer_valid_until,
  coalesce(a.full_name, a.email)                                as assigned_to_name,
  coalesce(d.full_name, d.email)                                as done_by_name,
  (f.done_at is null and f.due_at < now())                      as is_overdue,
  case when f.done_at is null and f.due_at < now()
       then (current_date - f.due_at::date) end                 as days_overdue,
  f.assigned_role,
  s.id                                                          as submission_id,
  pi.installment_no
from public.follow_ups f
left join public.premium_installments pi on f.entity_type = 'premium' and pi.id = f.entity_id
left join public.submissions s
       on s.id = case f.entity_type when 'submission' then f.entity_id when 'premium' then pi.submission_id end
left join public.premium_receipts r on f.entity_type = 'receipt' and r.id = f.entity_id
left join public.counterparties rp on rp.id = r.payer_id
left join public.counterparties mga on mga.id = s.mga_id
left join public.profiles a on a.id = f.assigned_to
left join public.profiles d on d.id = f.done_by;

-- ---------------------------------------------------------------------
-- Entity write rights: 'receipt' joins 'premium' (finance, admin)
-- ---------------------------------------------------------------------
create or replace function public.can_write_entity(p_entity_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_entity_type
    when 'submission' then public.has_role('admin', 'underwriter')
    when 'bordereau'  then public.has_role('admin', 'underwriter')
    when 'premium'    then public.has_role('admin', 'finance')
    when 'receipt'    then public.has_role('admin', 'finance')
    when 'claim'      then public.has_role('admin', 'claims')
    else false
  end
$$;

-- An underwriter may add / delete documents on installments of their own submissions
-- Takes text so storage policies can pass a path segment safely (no cast error on odd paths)
create or replace function public.is_own_installment(p_installment_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_installment_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and public.has_role('underwriter')
     and exists (select 1 from public.premium_installments i
                   join public.submissions s on s.id = i.submission_id
                  where i.id = p_installment_id::uuid and s.underwriter_id = auth.uid())
$$;

-- Documents may now belong to installments and receipts as well
create or replace function public.documents_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.version := coalesce((select max(d.version) from public.documents d
                            where d.entity_type = new.entity_type and d.entity_id = new.entity_id
                              and d.doc_type = new.doc_type and lower(d.file_name) = lower(new.file_name)), 0) + 1;
  new.uploaded_by := coalesce(auth.uid(), new.uploaded_by);
  new.uploaded_at := now();
  if new.entity_type = 'submission'
     and not exists (select 1 from public.submissions where id = new.entity_id) then
    raise exception 'Submission % does not exist', new.entity_id using errcode = '23503';
  end if;
  if new.entity_type = 'premium'
     and not exists (select 1 from public.premium_installments where id = new.entity_id) then
    raise exception 'Installment % does not exist', new.entity_id using errcode = '23503';
  end if;
  if new.entity_type = 'receipt'
     and not exists (select 1 from public.premium_receipts where id = new.entity_id) then
    raise exception 'Receipt % does not exist', new.entity_id using errcode = '23503';
  end if;
  return new;
end;
$$;

-- Deleting an installment or receipt is refused while documents are attached
create or replace function public.premium_before_delete_docs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.documents d
              where d.entity_type = (case tg_table_name when 'premium_receipts' then 'receipt' else 'premium' end)::public.entity_type
                and d.entity_id = old.id) then
    raise exception 'Delete the attached documents first' using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger premium_installments_before_delete before delete on public.premium_installments
for each row execute function public.premium_before_delete_docs();
create trigger premium_receipts_before_delete before delete on public.premium_receipts
for each row execute function public.premium_before_delete_docs();

create or replace function public.premium_receipts_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follow_ups f where f.entity_type = 'receipt' and f.entity_id = old.id;
  return null;
end;
$$;

create trigger premium_receipts_after_delete after delete on public.premium_receipts
for each row execute function public.premium_receipts_after_delete();

-- ---------------------------------------------------------------------
-- Setting
-- ---------------------------------------------------------------------
insert into public.settings (key, value, description)
values ('premium_grace_days', '0'::jsonb, 'Days after an installment''s due date before the first overdue follow-up')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Daily premium job (08:15 Tashkent): one open «premium_overdue» follow-up
-- per unpaid installment past due + grace days, owned by the finance team;
-- after it is closed the next one comes follow_up_repeat_days later.
-- The existing daily-follow-ups job is untouched.
-- ---------------------------------------------------------------------
create or replace function public.run_daily_premium_follow_ups()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grace   int := public.setting_int('premium_grace_days', 0);
  v_repeat  int := public.setting_int('follow_up_repeat_days', 7);
  v_today   date := public.tashkent_today();
  v_run     bigint;
  v_created int := 0;
  v_result  jsonb;
begin
  insert into public.job_runs (job, started_by) values ('daily_premium_follow_ups', auth.uid()) returning id into v_run;

  begin
    insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_role, created_by)
    select 'premium', i.id, 'premium_overdue', 'Premium overdue',
           greatest(now(),
                    coalesce((select max(f.done_at) + make_interval(days => v_repeat) from public.follow_ups f
                               where f.entity_type = 'premium' and f.entity_id = i.id and f.type = 'premium_overdue'),
                             now())),
           'finance', null
      from public.premium_installments i
     where i.type <> 'return'
       and i.status in ('open', 'partially_paid')
       and i.due_date + v_grace < v_today
       and not exists (select 1 from public.follow_ups f
                        where f.entity_type = 'premium' and f.entity_id = i.id
                          and f.type = 'premium_overdue' and f.done_at is null)
       -- after a closed one, wait the repeat interval
       and not exists (select 1 from public.follow_ups f
                        where f.entity_type = 'premium' and f.entity_id = i.id and f.type = 'premium_overdue'
                          and f.done_at > now() - make_interval(days => v_repeat));
    get diagnostics v_created = row_count;

    v_result := jsonb_build_object('premium_overdue_follow_ups', v_created);
    update public.job_runs set finished_at = now(), result = v_result where id = v_run;
  exception when others then
    update public.job_runs set finished_at = now(), error = sqlerrm where id = v_run;
    v_result := jsonb_build_object('error', sqlerrm);
  end;
  return v_result;
end;
$$;

create or replace function public.run_daily_premium_follow_ups_now()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Only admins can run jobs' using errcode = '42501';
  end if;
  return public.run_daily_premium_follow_ups();
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('daily-premium-follow-ups', '15 3 * * *', 'select public.run_daily_premium_follow_ups()');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- RLS
--   receipts / allocations: finance + admin write; every app user reads
--   installments: finance + admin, or the submission's own underwriter
-- ---------------------------------------------------------------------
alter table public.premium_installments enable row level security;
alter table public.premium_receipts     enable row level security;
alter table public.premium_allocations  enable row level security;

create policy premium_installments_select on public.premium_installments
  for select to authenticated using (public.is_app_user());
create policy premium_installments_insert on public.premium_installments
  for insert to authenticated with check (public.can_edit_premium_schedule(submission_id));
create policy premium_installments_update on public.premium_installments
  for update to authenticated
  using (public.can_edit_premium_schedule(submission_id))
  with check (public.can_edit_premium_schedule(submission_id));
create policy premium_installments_delete on public.premium_installments
  for delete to authenticated using (public.can_edit_premium_schedule(submission_id));

create policy premium_receipts_select on public.premium_receipts
  for select to authenticated using (public.is_app_user());
create policy premium_receipts_insert on public.premium_receipts
  for insert to authenticated with check (public.has_role('admin', 'finance'));
create policy premium_receipts_update on public.premium_receipts
  for update to authenticated using (public.has_role('admin', 'finance')) with check (public.has_role('admin', 'finance'));
create policy premium_receipts_delete on public.premium_receipts
  for delete to authenticated using (public.has_role('admin', 'finance'));

create policy premium_allocations_select on public.premium_allocations
  for select to authenticated using (public.is_app_user());
create policy premium_allocations_insert on public.premium_allocations
  for insert to authenticated with check (public.has_role('admin', 'finance'));
create policy premium_allocations_update on public.premium_allocations
  for update to authenticated using (public.has_role('admin', 'finance')) with check (public.has_role('admin', 'finance'));
create policy premium_allocations_delete on public.premium_allocations
  for delete to authenticated using (public.has_role('admin', 'finance'));

-- Follow-ups owned by a team: its members may work them (additional permissive policy)
create policy follow_ups_update_team on public.follow_ups
  for update to authenticated
  using (assigned_role is not null and assigned_role = public.auth_role())
  with check (assigned_role is not null and assigned_role = public.auth_role());

-- Documents on own installments for underwriters (additional permissive policies)
create policy documents_insert_own_installment on public.documents
  for insert to authenticated
  with check (entity_type = 'premium' and public.is_own_installment(entity_id::text));
create policy documents_delete_own_installment on public.documents
  for delete to authenticated
  using (entity_type = 'premium' and uploaded_by = (select auth.uid()) and public.is_own_installment(entity_id::text));

create policy documents_bucket_insert_own_installment on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 'premium'
              and public.is_own_installment((storage.foldername(name))[2]));
create policy documents_bucket_delete_own_installment on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'premium'
         and owner_id = auth.uid()::text
         and public.is_own_installment((storage.foldername(name))[2]));

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke all on public.premium_installments, public.premium_receipts, public.premium_allocations,
              public.premium_installments_v, public.premium_receipts_v, public.premium_schedule_check_v
  from anon, authenticated;

grant select, delete on public.premium_installments to authenticated;
grant insert (submission_id, installment_no, type, due_date, currency, gross_amount, commission_amount,
              brokerage_amount, basis_signed_share_pct, settled_at, written_off_at, written_off_reason, notes)
  on public.premium_installments to authenticated;
grant update (type, due_date, currency, gross_amount, commission_amount, brokerage_amount,
              basis_signed_share_pct, settled_at, written_off_at, written_off_reason, notes)
  on public.premium_installments to authenticated;

grant select, delete on public.premium_receipts to authenticated;
grant insert (received_date, payer_id, currency, amount, bank_reference, notes) on public.premium_receipts to authenticated;
grant update (received_date, payer_id, currency, amount, bank_reference, notes) on public.premium_receipts to authenticated;

grant select, delete on public.premium_allocations to authenticated;
grant insert (receipt_id, installment_id, amount, fx_rate) on public.premium_allocations to authenticated;
grant update (amount, fx_rate) on public.premium_allocations to authenticated;

grant select on public.premium_installments_v, public.premium_receipts_v, public.premium_schedule_check_v to authenticated;

grant update (assigned_role) on public.follow_ups to authenticated;
grant insert (assigned_role) on public.follow_ups to authenticated;

grant usage on type public.installment_type, public.installment_status to authenticated;

-- Functions: RPCs the app calls
revoke execute on function public.generate_premium_schedule(uuid, jsonb)   from public, anon;
grant  execute on function public.generate_premium_schedule(uuid, jsonb)   to authenticated;
revoke execute on function public.run_daily_premium_follow_ups_now()       from public, anon;
grant  execute on function public.run_daily_premium_follow_ups_now()       to authenticated;
revoke execute on function public.can_edit_premium_schedule(uuid)          from public, anon;
grant  execute on function public.can_edit_premium_schedule(uuid)          to authenticated;
revoke execute on function public.is_own_installment(text)                 from public, anon;
grant  execute on function public.is_own_installment(text)                 to authenticated;
revoke execute on function public.tashkent_today()                         from public, anon;
grant  execute on function public.tashkent_today()                         to authenticated;

-- Internal: not callable from the API
revoke execute on function public.premium_installment_status(uuid, public.installment_type, numeric, date, timestamptz) from public, anon, authenticated;
revoke execute on function public.premium_close_overdue_follow_ups(uuid, text) from public, anon, authenticated;
revoke execute on function public.premium_installments_before_write()     from public, anon, authenticated;
revoke execute on function public.premium_installments_after_write()      from public, anon, authenticated;
revoke execute on function public.premium_receipts_before_write()         from public, anon, authenticated;
revoke execute on function public.premium_receipts_after_delete()         from public, anon, authenticated;
revoke execute on function public.premium_allocations_before_write()      from public, anon, authenticated;
revoke execute on function public.premium_allocations_after_write()       from public, anon, authenticated;
revoke execute on function public.premium_refresh_installment(uuid)       from public, anon, authenticated;
revoke execute on function public.premium_before_delete_docs()            from public, anon, authenticated;
revoke execute on function public.run_daily_premium_follow_ups()          from public, anon, authenticated;
