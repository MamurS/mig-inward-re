-- Phase 3 — Claims (docs/specs/inward-re-phase-3-claims-prompt.md), migration 2.
-- Additive: new tables, views, functions; replaced functions keep their
-- signatures; follow_ups_v keeps its columns. Every new table: RLS, explicit
-- grants, audit trigger, is_demo + the demo guard.
--
-- Money is our share, in the claim currency (= the submission currency unless
-- a comment accepted otherwise). Our share = the SIGNED line at the date of
-- loss (snapshot on the claim). Reserves are append-only movements;
-- outstanding = reserves − payments; incurred = paid + outstanding −
-- recoveries = reserves − recoveries.

-- ---------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------
insert into public.settings (key, value, description) values
  ('large_loss_threshold_usd', '250000'::jsonb, 'Large loss: our share (estimate or reserves) in USD at or above this'),
  ('claim_review_days', '90'::jsonb, 'Remind the handler when an open claim has had no reserve movement for this many days')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.claims (
  id                uuid primary key default gen_random_uuid(),
  claim_no          text not null unique,
  submission_id     uuid not null references public.submissions (id),
  notified_date     date not null default current_date,
  date_of_loss      date not null,
  cause             text,
  location          text,
  description       text,
  cedent_claim_ref  text,
  currency          char(3) not null references public.currencies (code),
  estimate_100      numeric(18, 2) check (estimate_100 >= 0),
  signed_share_pct  numeric(9, 6) not null check (signed_share_pct >= 0 and signed_share_pct <= 100),
  status            public.claim_status not null default 'notified',
  decline_reason    text,
  close_comment     text,
  handler_id        uuid references public.profiles (id),
  large_loss        boolean not null default false,
  large_loss_at     timestamptz,
  coverage_issues   text[] not null default '{}',
  coverage_comment  text,
  notes             text,
  status_changed_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  created_by        uuid references public.profiles (id) default auth.uid(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references public.profiles (id),
  is_demo           boolean not null default public.demo_mode(),
  constraint claims_demo_no_chk check ((claim_no like 'DEMO-%') = is_demo)
);
comment on table public.claims is 'Claims on our bound risks; money is our share in the claim currency';
create index claims_submission_idx on public.claims (submission_id);
create index claims_status_idx on public.claims (status);
create index claims_handler_idx on public.claims (handler_id);
create index claims_is_demo_idx on public.claims (is_demo);
-- bordereaux (phase C) match claims by the cedent's reference: never two on one risk
create unique index claims_cedent_ref_uq on public.claims (submission_id, cedent_claim_ref) where cedent_claim_ref is not null;

create table public.claim_reserves (
  id            uuid primary key default gen_random_uuid(),
  claim_id      uuid not null references public.claims (id),
  movement_date date not null default current_date,
  amount        numeric(18, 2) not null check (amount <> 0),
  reason        text not null check (length(trim(reason)) > 0),
  entered_by    uuid references public.profiles (id) default auth.uid(),
  created_at    timestamptz not null default now(),
  is_demo       boolean not null default public.demo_mode()
);
comment on table public.claim_reserves is 'Append-only reserve movements (our share, claim currency); correct with a new movement';
create index claim_reserves_claim_idx on public.claim_reserves (claim_id, movement_date);

create table public.claim_payments (
  id                uuid primary key default gen_random_uuid(),
  claim_id          uuid not null references public.claims (id),
  payment_date      date not null default current_date,
  currency          char(3) not null references public.currencies (code),
  amount            numeric(18, 2) not null check (amount > 0),
  type              public.claim_payment_type not null default 'indemnity',
  payee_id          uuid references public.counterparties (id),
  method            public.claim_payment_method not null default 'cash',
  bank_reference    text,
  notes             text,
  offset_receipt_id uuid references public.premium_receipts (id),
  entered_by        uuid references public.profiles (id) default auth.uid(),
  created_at        timestamptz not null default now(),
  is_demo           boolean not null default public.demo_mode(),
  constraint claim_payments_offset_chk check ((method = 'offset_against_premium') = (offset_receipt_id is not null))
);
comment on table public.claim_payments is 'Our share paid on a claim (append-only); an offset against premium carries its receipt';
create index claim_payments_claim_idx on public.claim_payments (claim_id, payment_date);
create unique index claim_payments_offset_receipt_uq on public.claim_payments (offset_receipt_id) where offset_receipt_id is not null;

create table public.claim_recoveries (
  id            uuid primary key default gen_random_uuid(),
  claim_id      uuid not null references public.claims (id),
  recovery_date date not null default current_date,
  type          public.claim_recovery_type not null,
  amount        numeric(18, 2) not null check (amount > 0),
  notes         text,
  entered_by    uuid references public.profiles (id) default auth.uid(),
  created_at    timestamptz not null default now(),
  is_demo       boolean not null default public.demo_mode()
);
comment on table public.claim_recoveries is 'Salvage, subrogation and other recoveries (our share, claim currency; append-only)';
create index claim_recoveries_claim_idx on public.claim_recoveries (claim_id);

-- ---------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------

-- Our signed line on the date of loss: the last line signed on or before it, else the current one
create or replace function public.claim_signed_share(p_submission_id uuid, p_date_of_loss date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select h.signed_share_pct from public.submission_status_history h
      where h.submission_id = p_submission_id and h.signed_share_pct is not null and h.changed_at::date <= p_date_of_loss
      order by h.changed_at desc limit 1),
    (select s.signed_share_pct from public.submissions s where s.id = p_submission_id),
    (select s.written_share_pct from public.submissions s where s.id = p_submission_id),
    0)
$$;
revoke execute on function public.claim_signed_share(uuid, date) from public, anon, authenticated;

-- Coverage check: codes of what does not fit (empty = fine). The form shows them inline; saving with any needs a comment.
create or replace function public.claim_coverage_issues(p_submission_id uuid, p_date_of_loss date, p_currency text)
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_remove(array[
    case when s.id is null then 'no_submission' end,
    case when s.status is distinct from 'bound' then 'not_bound' end,
    case when s.period_from is null or s.period_to is null then 'no_period' end,
    case when p_date_of_loss < s.period_from then 'before_inception' end,
    case when p_date_of_loss > s.period_to then 'after_expiry' end,
    case when p_date_of_loss > public.tashkent_today() then 'future_loss' end,
    case when p_currency is distinct from s.currency then 'currency' end
  ], null), '{}')
  from (select 1) one
  left join public.submissions s on s.id = p_submission_id
$$;
revoke execute on function public.claim_coverage_issues(uuid, date, text) from public, anon;
grant execute on function public.claim_coverage_issues(uuid, date, text) to authenticated;

-- What is still open on a claim, in its currency
create or replace function public.claim_outstanding(p_claim_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select sum(r.amount) from public.claim_reserves r where r.claim_id = p_claim_id), 0)
       - coalesce((select sum(p.amount) from public.claim_payments p where p.claim_id = p_claim_id), 0)
$$;
revoke execute on function public.claim_outstanding(uuid) from public, anon, authenticated;

create or replace function public.claims_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub record;
  v_out numeric;
begin
  if tg_op = 'INSERT' then
    select s.is_demo, s.status into v_sub from public.submissions s where s.id = new.submission_id;
    if not found then
      raise exception 'Submission not found' using errcode = 'P0002';
    end if;
    -- the claim belongs to its risk's world; numbering follows it
    new.is_demo := v_sub.is_demo;
    new.claim_no := public.next_ref_no(case when new.is_demo then 'DEMO-CLM' else 'CLM' end, extract(year from new.notified_date)::int);
    if new.status not in ('notified', 'open') then
      raise exception 'A new claim starts as notified or open' using errcode = '23514';
    end if;
    new.created_at := now();
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    if new.claim_no is distinct from old.claim_no or new.submission_id is distinct from old.submission_id then
      raise exception 'Claim number and submission cannot change' using errcode = '42501';
    end if;
    if new.large_loss is distinct from old.large_loss and coalesce(current_setting('app.claim_large_loss', true), '') <> 'on' then
      raise exception 'The large-loss mark is set by the system' using errcode = '42501';
    end if;

    if new.status is distinct from old.status then
      if not (
        (old.status = 'notified' and new.status in ('open', 'declined')) or
        (old.status = 'open'     and new.status in ('closed', 'declined')) or
        (old.status = 'reopened' and new.status in ('closed', 'declined')) or
        (old.status in ('closed', 'declined') and new.status = 'reopened')
      ) then
        raise exception 'A claim cannot go from % to %', old.status, new.status using errcode = '23514';
      end if;
      if new.status = 'declined' and coalesce(trim(new.decline_reason), '') = '' then
        raise exception 'Declining a claim needs a reason' using errcode = '23514';
      end if;
      if new.status = 'closed' then
        v_out := public.claim_outstanding(new.id);
        if v_out <> 0 and coalesce(trim(new.close_comment), '') = '' then
          raise exception 'Outstanding is % %: close it with a comment, or bring it to zero first', v_out, new.currency using errcode = '23514';
        end if;
      end if;
      new.status_changed_at := now();
    end if;
  end if;

  -- our line at the date of loss, and the coverage check (re-done when what it checks changes)
  if tg_op = 'INSERT' or new.date_of_loss is distinct from old.date_of_loss or new.currency is distinct from old.currency then
    new.signed_share_pct := public.claim_signed_share(new.submission_id, new.date_of_loss);
    new.coverage_issues := public.claim_coverage_issues(new.submission_id, new.date_of_loss, new.currency);
    if cardinality(new.coverage_issues) > 0 and coalesce(trim(new.coverage_comment), '') = '' then
      raise exception 'Coverage check: % — add a comment to continue', array_to_string(new.coverage_issues, ', ') using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke execute on function public.claims_before_write() from public, anon, authenticated;
create trigger claims_before_write before insert or update on public.claims for each row execute function public.claims_before_write();

-- Large loss: our share (the larger of estimate and reserves) in USD ≥ the threshold. Sticky; tells management and admin once.
create or replace function public.claim_check_large_loss(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c        record;
  v_rate   numeric;
  v_amount numeric;
  v_limit  numeric := coalesce((select (s.value #>> '{}')::numeric from public.settings s where s.key = 'large_loss_threshold_usd'), 250000);
begin
  select cl.id, cl.currency, cl.large_loss, cl.is_demo, round(coalesce(cl.estimate_100, 0) * cl.signed_share_pct / 100, 2) as estimate_share,
         coalesce((select sum(r.amount) from public.claim_reserves r where r.claim_id = cl.id), 0) as reserves
    into c from public.claims cl where cl.id = p_claim_id;
  if c.id is null or c.large_loss then
    return;
  end if;
  v_rate := public.fx_rate_to_usd(c.currency, public.tashkent_today());
  if v_rate is null then
    return; -- no rate yet: cannot tell (the claim page says so)
  end if;
  v_amount := greatest(c.estimate_share, c.reserves) * v_rate;
  if v_amount < v_limit then
    return;
  end if;
  perform set_config('app.claim_large_loss', 'on', true);
  update public.claims set large_loss = true, large_loss_at = now() where id = p_claim_id;
  perform set_config('app.claim_large_loss', 'off', true);
  insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_role, created_by, is_demo)
  values ('claim', p_claim_id, 'large_loss', 'Large loss', now(), 'management', auth.uid(), c.is_demo),
         ('claim', p_claim_id, 'large_loss', 'Large loss', now(), 'admin', auth.uid(), c.is_demo);
end;
$$;
revoke execute on function public.claim_check_large_loss(uuid) from public, anon, authenticated;

create or replace function public.claims_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'claims' then
    if tg_op = 'INSERT' or new.estimate_100 is distinct from old.estimate_100 then
      perform public.claim_check_large_loss(new.id);
    end if;
  elsif tg_table_name = 'claim_reserves' then
    perform public.claim_check_large_loss(new.claim_id);
  elsif tg_table_name = 'claim_payments' and new.type = 'cash_call' then
    -- a cash call paid closes the open cash-call follow-ups of that claim
    update public.follow_ups f set done_at = now(), outcome = 'Cash call paid on ' || to_char(new.payment_date, 'DD.MM.YYYY')
     where f.entity_type = 'claim' and f.entity_id = new.claim_id and f.type = 'cash_call_due' and f.done_at is null;
  end if;
  return null;
end;
$$;
revoke execute on function public.claims_after_write() from public, anon, authenticated;
create trigger claims_after_write after insert or update on public.claims for each row execute function public.claims_after_write();
create trigger claim_reserves_after_insert after insert on public.claim_reserves for each row execute function public.claims_after_write();
create trigger claim_payments_after_insert after insert on public.claim_payments for each row execute function public.claims_after_write();

-- Movements, payments, recoveries: on a live claim, entered by the caller, never edited or deleted
create or replace function public.claim_movement_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if coalesce(current_setting('app.demo_admin', true), '') = 'on' and tg_op = 'DELETE' then
      return old; -- «Delete all demo data»
    end if;
    raise exception 'Claim movements are never changed: record a correcting one' using errcode = '42501';
  end if;
  select cl.status, cl.currency, cl.claim_no, s.mga_id into c
    from public.claims cl join public.submissions s on s.id = cl.submission_id where cl.id = new.claim_id;
  if not found then
    raise exception 'Claim not found' using errcode = 'P0002';
  end if;
  if tg_table_name in ('claim_reserves', 'claim_payments') and c.status in ('closed', 'declined') then
    raise exception 'Claim % is %: reopen it first', c.claim_no, c.status using errcode = '23514';
  end if;
  if tg_table_name = 'claim_payments' and new.currency is distinct from c.currency then
    raise exception 'Pay in the claim currency (%)', c.currency using errcode = '23514';
  end if;
  -- an offset carries the MGA's receipt for exactly this amount (made by create_claim_payment)
  if tg_table_name = 'claim_payments' and new.method = 'offset_against_premium'
     and not exists (select 1 from public.premium_receipts r
                      where r.id = new.offset_receipt_id and r.payer_id = c.mga_id and r.currency = new.currency and r.amount = new.amount) then
    raise exception 'An offset needs the MGA''s receipt for the same amount' using errcode = '23514';
  end if;
  new.entered_by := coalesce(auth.uid(), new.entered_by);
  new.created_at := now();
  return new;
end;
$$;
revoke execute on function public.claim_movement_before_write() from public, anon, authenticated;
create trigger claim_reserves_before_write   before insert or update or delete on public.claim_reserves   for each row execute function public.claim_movement_before_write();
create trigger claim_payments_before_write   before insert or update or delete on public.claim_payments   for each row execute function public.claim_movement_before_write();
create trigger claim_recoveries_before_write before insert or update or delete on public.claim_recoveries for each row execute function public.claim_movement_before_write();

-- A payment and, for an offset against premium, its receipt and allocations — all or nothing.
-- SECURITY INVOKER: RLS and grants apply (finance / admin pay; receipts' own rules hold).
-- p_payment: {claim_id, payment_date, amount, type, payee_id, method, bank_reference, notes}
-- p_allocations (offset only): [{installment_id, amount, fx_rate}] — must allocate the whole amount
create or replace function public.create_claim_payment(p_payment jsonb, p_allocations jsonb default '[]'::jsonb)
returns public.claim_payments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c        record;
  v_method public.claim_payment_method := coalesce(nullif(p_payment ->> 'method', ''), 'cash')::public.claim_payment_method;
  v_amount numeric := (p_payment ->> 'amount')::numeric;
  v_date   date := coalesce((p_payment ->> 'payment_date')::date, current_date);
  v_rcp    public.premium_receipts;
  v_a      jsonb;
  v_sum    numeric := 0;
  v_row    public.claim_payments;
begin
  select cl.id, cl.claim_no, cl.currency, s.mga_id into c
    from public.claims cl join public.submissions s on s.id = cl.submission_id
   where cl.id = (p_payment ->> 'claim_id')::uuid;
  if c.id is null then
    raise exception 'Claim not found' using errcode = 'P0002';
  end if;

  if v_method = 'offset_against_premium' then
    if jsonb_typeof(coalesce(p_allocations, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)) = 0 then
      raise exception 'An offset needs the installments it pays' using errcode = '22023';
    end if;
    -- the offset is a receipt from the MGA, paid by what we owe on the claim
    insert into public.premium_receipts (received_date, payer_id, currency, amount, bank_reference, notes)
    values (v_date, c.mga_id, c.currency, v_amount, 'Offset ' || c.claim_no,
            coalesce(nullif(trim(p_payment ->> 'notes'), ''), 'Claim payment offset against premium'))
    returning * into v_rcp;
    for v_a in select * from jsonb_array_elements(p_allocations) loop
      insert into public.premium_allocations (receipt_id, installment_id, amount, fx_rate)
      values (v_rcp.id, (v_a ->> 'installment_id')::uuid, (v_a ->> 'amount')::numeric, nullif(v_a ->> 'fx_rate', '')::numeric);
      v_sum := v_sum + (v_a ->> 'amount')::numeric;
    end loop;
    if v_sum <> v_amount then
      raise exception 'An offset must be allocated in full: % of % allocated', v_sum, v_amount using errcode = '23514';
    end if;
  end if;

  insert into public.claim_payments (claim_id, payment_date, currency, amount, type, payee_id, method, bank_reference, notes, offset_receipt_id)
  values (c.id, v_date, c.currency, v_amount,
          coalesce(nullif(p_payment ->> 'type', ''), 'indemnity')::public.claim_payment_type,
          coalesce(nullif(p_payment ->> 'payee_id', '')::uuid, c.mga_id), v_method,
          coalesce(nullif(trim(p_payment ->> 'bank_reference'), ''), v_rcp.bank_reference),
          nullif(trim(p_payment ->> 'notes'), ''), v_rcp.id)
  returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.create_claim_payment(jsonb, jsonb) from public, anon;
grant execute on function public.create_claim_payment(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Who may read / write
-- ---------------------------------------------------------------------
create or replace function public.can_read_claims_of(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin', 'management', 'claims', 'finance')
      or (public.has_role('underwriter')
          and exists (select 1 from public.submissions s where s.id = p_submission_id and s.underwriter_id = auth.uid()))
$$;
revoke execute on function public.can_read_claims_of(uuid) from public, anon;
grant execute on function public.can_read_claims_of(uuid) to authenticated;

alter table public.claims           enable row level security;
alter table public.claim_reserves   enable row level security;
alter table public.claim_payments   enable row level security;
alter table public.claim_recoveries enable row level security;

create policy claims_select on public.claims for select to authenticated using (public.can_read_claims_of(submission_id));
create policy claims_insert on public.claims for insert to authenticated with check (public.has_role('admin', 'claims'));
create policy claims_update on public.claims for update to authenticated using (public.has_role('admin', 'claims')) with check (public.has_role('admin', 'claims'));
create policy claims_delete on public.claims for delete to authenticated using (public.has_role('admin'));

create policy claim_reserves_select on public.claim_reserves for select to authenticated
  using (exists (select 1 from public.claims c where c.id = claim_id));
create policy claim_reserves_insert on public.claim_reserves for insert to authenticated
  with check (public.has_role('admin', 'claims') and exists (select 1 from public.claims c where c.id = claim_id));

create policy claim_payments_select on public.claim_payments for select to authenticated
  using (exists (select 1 from public.claims c where c.id = claim_id));
create policy claim_payments_insert on public.claim_payments for insert to authenticated
  with check (public.has_role('admin', 'finance') and exists (select 1 from public.claims c where c.id = claim_id));

create policy claim_recoveries_select on public.claim_recoveries for select to authenticated
  using (exists (select 1 from public.claims c where c.id = claim_id));
create policy claim_recoveries_insert on public.claim_recoveries for insert to authenticated
  with check (public.has_role('admin', 'claims') and exists (select 1 from public.claims c where c.id = claim_id));

-- demo: each user sees and writes only their own world
create policy claims_demo           on public.claims           as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));
create policy claim_reserves_demo   on public.claim_reserves   as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));
create policy claim_payments_demo   on public.claim_payments   as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));
create policy claim_recoveries_demo on public.claim_recoveries as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));

revoke all on public.claims, public.claim_reserves, public.claim_payments, public.claim_recoveries from anon, authenticated;
grant select, delete on public.claims to authenticated;
grant insert (submission_id, notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100,
              status, handler_id, coverage_comment, notes) on public.claims to authenticated;
grant update (notified_date, date_of_loss, cause, location, description, cedent_claim_ref, currency, estimate_100,
              status, decline_reason, close_comment, handler_id, coverage_comment, notes) on public.claims to authenticated;
grant select on public.claim_reserves, public.claim_payments, public.claim_recoveries to authenticated;
grant insert (claim_id, movement_date, amount, reason) on public.claim_reserves to authenticated;
grant insert (claim_id, payment_date, currency, amount, type, payee_id, method, bank_reference, notes, offset_receipt_id) on public.claim_payments to authenticated;
grant insert (claim_id, recovery_date, type, amount, notes) on public.claim_recoveries to authenticated;
grant all on public.claims, public.claim_reserves, public.claim_payments, public.claim_recoveries to service_role;

-- audit log
create trigger audit_claims           after insert or update or delete on public.claims           for each row execute function public.audit_trigger();
create trigger audit_claim_reserves   after insert or update or delete on public.claim_reserves   for each row execute function public.audit_trigger();
create trigger audit_claim_payments   after insert or update or delete on public.claim_payments   for each row execute function public.audit_trigger();
create trigger audit_claim_recoveries after insert or update or delete on public.claim_recoveries for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- Views (security_invoker: the tables' RLS applies)
-- ---------------------------------------------------------------------
create view public.claims_v
with (security_invoker = true)
as
with r as (select claim_id, sum(amount) as total, max(movement_date) as last_date from public.claim_reserves group by claim_id),
     p as (select claim_id, sum(amount) as total, max(payment_date) as last_date from public.claim_payments group by claim_id),
     rc as (select claim_id, sum(amount) as total from public.claim_recoveries group by claim_id),
     cc as (select entity_id as claim_id, min(due_at) as due_at from public.follow_ups
             where entity_type = 'claim' and type = 'cash_call_due' and done_at is null group by entity_id),
     base as (
       select c.*,
              coalesce(r.total, 0) as reserves_total,
              coalesce(p.total, 0) as paid_total,
              coalesce(rc.total, 0) as recoveries_total,
              r.last_date as last_reserve_date,
              p.last_date as last_payment_date,
              cc.due_at as cash_call_due_at,
              public.fx_rate_to_usd(c.currency, public.tashkent_today()) as fx_rate_to_usd
         from public.claims c
         left join r on r.claim_id = c.id
         left join p on p.claim_id = c.id
         left join rc on rc.claim_id = c.id
         left join cc on cc.claim_id = c.id)
select
  b.id, b.claim_no, b.submission_id, b.notified_date, b.date_of_loss, b.cause, b.location, b.description, b.cedent_claim_ref,
  b.currency, b.estimate_100, b.signed_share_pct, b.status, b.decline_reason, b.close_comment, b.handler_id, b.large_loss,
  b.large_loss_at, b.coverage_issues, b.coverage_comment, b.notes, b.status_changed_at, b.created_at, b.created_by,
  b.updated_at, b.updated_by,
  s.ref_no, s.insured_name, s.mga_id, mga.name as mga_name, s.broker_id, br.name as broker_name,
  s.lob_id, l.code as lob_code, l.name as lob_name, s.underwriter_id, coalesce(uw.full_name, uw.email) as underwriter_name,
  s.period_from, s.period_to, extract(year from s.period_from)::int as underwriting_year,
  coalesce(h.full_name, h.email) as handler_name,
  round(coalesce(b.estimate_100, 0) * b.signed_share_pct / 100, 2) as estimate_our_share,
  b.reserves_total, b.paid_total, b.recoveries_total,
  b.reserves_total - b.paid_total                       as outstanding,
  b.reserves_total - b.recoveries_total                 as incurred,
  b.last_reserve_date, b.last_payment_date,
  public.tashkent_today() - coalesce(b.last_reserve_date, b.notified_date) as days_since_reserve,
  b.cash_call_due_at,
  b.fx_rate_to_usd,
  round((b.reserves_total - b.paid_total) * b.fx_rate_to_usd, 2)      as outstanding_usd,
  round(b.paid_total * b.fx_rate_to_usd, 2)                           as paid_usd,
  round((b.reserves_total - b.recoveries_total) * b.fx_rate_to_usd, 2) as incurred_usd,
  round(b.recoveries_total * b.fx_rate_to_usd, 2)                     as recoveries_usd,
  round(round(coalesce(b.estimate_100, 0) * b.signed_share_pct / 100, 2) * b.fx_rate_to_usd, 2) as estimate_our_share_usd,
  public.search_norm(concat_ws(' ', b.claim_no, b.cedent_claim_ref, s.ref_no, s.insured_name, mga.name, br.name, b.cause, b.location,
                               b.description, l.code, l.name, l.name_ru, l.name_uz)) as search_text
from base b
join public.submissions s on s.id = b.submission_id
left join public.counterparties mga on mga.id = s.mga_id
left join public.counterparties br on br.id = s.broker_id
left join public.lines_of_business l on l.id = s.lob_id
left join public.profiles uw on uw.id = s.underwriter_id
left join public.profiles h on h.id = b.handler_id;

-- payments with the claim and USD on the payment date (dashboard: paid this year)
create view public.claim_payments_v
with (security_invoker = true)
as
select p.id, p.claim_id, p.payment_date, p.currency, p.amount, p.type, p.payee_id, cp.name as payee_name, p.method,
       p.bank_reference, p.notes, p.offset_receipt_id, rcp.ref_no as offset_receipt_no, p.entered_by,
       coalesce(e.full_name, e.email) as entered_by_name, p.created_at,
       c.claim_no, s.mga_id, mga.name as mga_name,
       public.fx_rate_to_usd(p.currency, p.payment_date) as fx_rate_to_usd,
       round(p.amount * public.fx_rate_to_usd(p.currency, p.payment_date), 2) as amount_usd
from public.claim_payments p
join public.claims c on c.id = p.claim_id
join public.submissions s on s.id = c.submission_id
left join public.counterparties cp on cp.id = p.payee_id
left join public.counterparties mga on mga.id = s.mga_id
left join public.premium_receipts rcp on rcp.id = p.offset_receipt_id
left join public.profiles e on e.id = p.entered_by;

grant select on public.claims_v, public.claim_payments_v to authenticated;

-- follow-ups: a claim shows its claim number and insured (same columns as before)
create or replace view public.follow_ups_v
with (security_invoker = true)
as
select
  f.id, f.entity_type, f.entity_id, f.type, f.title, f.due_at, f.assigned_to, f.done_at, f.done_by,
  f.outcome, f.created_at, f.created_by, f.updated_at,
  case f.entity_type
    when 'submission' then s.ref_no
    when 'premium'    then s.ref_no || ' #' || pi.installment_no
    when 'receipt'    then r.ref_no
    when 'claim'      then cl.claim_no end                      as entity_ref,
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
left join public.claims cl on f.entity_type = 'claim' and cl.id = f.entity_id
left join public.submissions s
       on s.id = case f.entity_type when 'submission' then f.entity_id when 'premium' then pi.submission_id when 'claim' then cl.submission_id end
left join public.premium_receipts r on f.entity_type = 'receipt' and r.id = f.entity_id
left join public.counterparties rp on rp.id = r.payer_id
left join public.counterparties mga on mga.id = s.mga_id
left join public.profiles a on a.id = f.assigned_to
left join public.profiles d on d.id = f.done_by;

-- ---------------------------------------------------------------------
-- Daily job: remind the handler of an open claim with no reserve movement for claim_review_days
-- ---------------------------------------------------------------------
create or replace function public.run_daily_claim_follow_ups()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days    int := public.setting_int('claim_review_days', 90);
  v_today   date := public.tashkent_today();
  v_run     bigint;
  v_created int := 0;
  v_result  jsonb;
begin
  insert into public.job_runs (job, started_by) values ('daily_claim_follow_ups', auth.uid()) returning id into v_run;
  begin
    insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_to, assigned_role, created_by, is_demo)
    select 'claim', c.id, 'claim_review', 'Review the reserve', now(),
           c.handler_id, case when c.handler_id is null then 'claims'::public.app_role end, null, false
      from public.claims c
     where not c.is_demo
       and c.status in ('notified', 'open', 'reopened')
       and v_today - coalesce((select max(r.movement_date) from public.claim_reserves r where r.claim_id = c.id), c.notified_date) >= v_days
       and not exists (select 1 from public.follow_ups f
                        where f.entity_type = 'claim' and f.entity_id = c.id and f.type = 'claim_review' and f.done_at is null)
       and not exists (select 1 from public.follow_ups f
                        where f.entity_type = 'claim' and f.entity_id = c.id and f.type = 'claim_review'
                          and f.done_at > now() - make_interval(days => v_days));
    get diagnostics v_created = row_count;
    v_result := jsonb_build_object('claim_review_follow_ups', v_created);
    update public.job_runs set finished_at = now(), result = v_result where id = v_run;
  exception when others then
    update public.job_runs set finished_at = now(), error = sqlerrm where id = v_run;
    v_result := jsonb_build_object('error', sqlerrm);
  end;
  return v_result;
end;
$$;
revoke execute on function public.run_daily_claim_follow_ups() from public, anon, authenticated;

create or replace function public.run_daily_claim_follow_ups_now()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Only an admin can run the job' using errcode = '42501';
  end if;
  return public.run_daily_claim_follow_ups();
end;
$$;
revoke execute on function public.run_daily_claim_follow_ups_now() from public, anon;
grant execute on function public.run_daily_claim_follow_ups_now() to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('daily-claim-follow-ups') where exists (select 1 from cron.job where jobname = 'daily-claim-follow-ups');
    perform cron.schedule('daily-claim-follow-ups', '20 3 * * *', 'select public.run_daily_claim_follow_ups()');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Demo data: the guard, the link check, delete and counts know the claims
-- ---------------------------------------------------------------------
create or replace function public.entity_is_demo(p_entity_type text, p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_entity_type
    when 'submission' then (select s.is_demo from public.submissions s where s.id = p_entity_id)
    when 'premium'    then (select i.is_demo from public.premium_installments i where i.id = p_entity_id)
    when 'receipt'    then (select r.is_demo from public.premium_receipts r where r.id = p_entity_id)
    when 'claim'      then (select c.is_demo from public.claims c where c.id = p_entity_id)
  end
$$;

create or replace function public.demo_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   boolean := auth.uid() is not null
                      and coalesce(current_setting('app.demo_admin', true), '') <> 'on'; -- seed / delete run as admin
  v_mode   boolean := public.demo_mode();
  v_parent boolean;
  v_kind   text;
begin
  if tg_op = 'DELETE' then
    if v_user and old.is_demo <> v_mode then
      raise exception 'You are in % mode: this row is %', case when v_mode then 'demo' else 'normal' end,
        case when old.is_demo then 'demo data' else 'real data' end using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and new.is_demo is distinct from old.is_demo then
    raise exception 'A row cannot move between demo and real data' using errcode = '42501';
  end if;

  -- children belong to their parent's world; parents and children never mix
  case tg_table_name
    when 'premium_installments' then
      select s.is_demo into v_parent from public.submissions s where s.id = new.submission_id;
      new.is_demo := coalesce(v_parent, new.is_demo);
    when 'premium_allocations' then
      select r.is_demo into v_parent from public.premium_receipts r where r.id = new.receipt_id;
      new.is_demo := coalesce(v_parent, new.is_demo);
      if exists (select 1 from public.premium_installments i where i.id = new.installment_id and i.is_demo <> new.is_demo) then
        raise exception 'A % receipt cannot pay a % installment',
          case when new.is_demo then 'demo' else 'real' end, case when new.is_demo then 'real' else 'demo' end using errcode = '23514';
      end if;
    when 'follow_ups', 'documents' then
      v_parent := public.entity_is_demo(new.entity_type::text, new.entity_id);
      new.is_demo := coalesce(v_parent, new.is_demo);
    when 'submissions' then
      if exists (select 1 from public.counterparties c
                  where c.id in (new.mga_id, new.broker_id, new.source_party_id) and c.is_demo <> new.is_demo) then
        raise exception 'A % submission cannot use % counterparties',
          case when new.is_demo then 'demo' else 'real' end, case when new.is_demo then 'real' else 'demo' end using errcode = '23514';
      end if;
      if new.is_demo and new.insured_name not like 'DEMO %' then new.insured_name := 'DEMO ' || new.insured_name; end if;
      if not new.is_demo and new.insured_name like 'DEMO %' then
        raise exception 'Names starting with «DEMO » are reserved for demo data' using errcode = '23514';
      end if;
    when 'premium_receipts' then
      if exists (select 1 from public.counterparties c where c.id = new.payer_id and c.is_demo <> new.is_demo) then
        raise exception 'A % receipt cannot come from a % payer',
          case when new.is_demo then 'demo' else 'real' end, case when new.is_demo then 'real' else 'demo' end using errcode = '23514';
      end if;
    when 'counterparties' then
      if new.is_demo and new.name not like 'DEMO %' then new.name := 'DEMO ' || new.name; end if;
      if not new.is_demo and new.name like 'DEMO %' then
        raise exception 'Names starting with «DEMO » are reserved for demo data' using errcode = '23514';
      end if;
    when 'claims' then
      select s.is_demo into v_parent from public.submissions s where s.id = new.submission_id;
      new.is_demo := coalesce(v_parent, new.is_demo);
    when 'claim_reserves', 'claim_recoveries' then
      select c.is_demo into v_parent from public.claims c where c.id = new.claim_id;
      new.is_demo := coalesce(v_parent, new.is_demo);
    when 'claim_payments' then
      select c.is_demo into v_parent from public.claims c where c.id = new.claim_id;
      new.is_demo := coalesce(v_parent, new.is_demo);
      if exists (select 1 from public.premium_receipts r where r.id = new.offset_receipt_id and r.is_demo <> new.is_demo)
         or exists (select 1 from public.counterparties c where c.id = new.payee_id and c.is_demo <> new.is_demo) then
        raise exception 'A % claim payment cannot use % premium or payees',
          case when new.is_demo then 'demo' else 'real' end, case when new.is_demo then 'real' else 'demo' end using errcode = '23514';
      end if;
    else
      null;
  end case;

  -- a user writes only in their own world (also through SECURITY DEFINER functions)
  if v_user and new.is_demo <> v_mode then
    v_kind := case when new.is_demo then 'demo data' else 'real data' end;
    raise exception 'You are in % mode: you cannot change %', case when v_mode then 'demo' else 'normal' end, v_kind using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.demo_guard() from public, anon, authenticated;

-- «zz_» so it runs after the tables' own BEFORE triggers
create trigger zz_demo_guard before insert or update or delete on public.claims           for each row execute function public.demo_guard();
create trigger zz_demo_guard before insert or update or delete on public.claim_reserves   for each row execute function public.demo_guard();
create trigger zz_demo_guard before insert or update or delete on public.claim_payments   for each row execute function public.demo_guard();
create trigger zz_demo_guard before insert or update or delete on public.claim_recoveries for each row execute function public.demo_guard();

create or replace function public.demo_link_violations()
returns table (kind text, row_id uuid, detail text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Only an admin can run the demo data check' using errcode = '42501';
  end if;
  return query
    select 'submission ↔ counterparty'::text, s.id, s.ref_no || ' ↔ ' || c.name
      from public.submissions s join public.counterparties c on c.id in (s.mga_id, s.broker_id, s.source_party_id)
     where c.is_demo <> s.is_demo
    union all
    select 'installment ↔ submission', i.id, s.ref_no || ' #' || i.installment_no
      from public.premium_installments i join public.submissions s on s.id = i.submission_id where i.is_demo <> s.is_demo
    union all
    select 'receipt ↔ payer', r.id, r.ref_no || ' ↔ ' || c.name
      from public.premium_receipts r join public.counterparties c on c.id = r.payer_id where r.is_demo <> c.is_demo
    union all
    select 'allocation ↔ receipt', a.id, r.ref_no
      from public.premium_allocations a join public.premium_receipts r on r.id = a.receipt_id where a.is_demo <> r.is_demo
    union all
    select 'allocation ↔ installment', a.id, r.ref_no || ' → installment ' || i.id
      from public.premium_allocations a join public.premium_receipts r on r.id = a.receipt_id
      join public.premium_installments i on i.id = a.installment_id where a.is_demo <> i.is_demo
    union all
    select 'claim ↔ submission', c.id, c.claim_no || ' ↔ ' || s.ref_no
      from public.claims c join public.submissions s on s.id = c.submission_id where c.is_demo <> s.is_demo
    union all
    select 'reserve ↔ claim', r.id, c.claim_no from public.claim_reserves r join public.claims c on c.id = r.claim_id where r.is_demo <> c.is_demo
    union all
    select 'payment ↔ claim', p.id, c.claim_no from public.claim_payments p join public.claims c on c.id = p.claim_id where p.is_demo <> c.is_demo
    union all
    select 'payment ↔ offset receipt', p.id, c.claim_no || ' → ' || r.ref_no
      from public.claim_payments p join public.claims c on c.id = p.claim_id join public.premium_receipts r on r.id = p.offset_receipt_id
     where p.is_demo <> r.is_demo
    union all
    select 'payment ↔ payee', p.id, c.claim_no || ' → ' || cp.name
      from public.claim_payments p join public.claims c on c.id = p.claim_id join public.counterparties cp on cp.id = p.payee_id
     where p.is_demo <> cp.is_demo
    union all
    select 'recovery ↔ claim', r.id, c.claim_no from public.claim_recoveries r join public.claims c on c.id = r.claim_id where r.is_demo <> c.is_demo
    union all
    select 'follow-up ↔ record', f.id, f.entity_type || ' ' || f.entity_id
      from public.follow_ups f where public.entity_is_demo(f.entity_type::text, f.entity_id) is distinct from f.is_demo
       and public.entity_is_demo(f.entity_type::text, f.entity_id) is not null
    union all
    select 'document ↔ record', d.id, d.entity_type || ' ' || d.entity_id
      from public.documents d where public.entity_is_demo(d.entity_type::text, d.entity_id) is distinct from d.is_demo
       and public.entity_is_demo(d.entity_type::text, d.entity_id) is not null
    union all
    select 'name / number', c.id, c.name from public.counterparties c where (c.name like 'DEMO %') <> c.is_demo
    union all
    select 'name / number', s.id, s.ref_no from public.submissions s
     where (s.insured_name like 'DEMO %') <> s.is_demo or (s.ref_no like 'DEMO-%') <> s.is_demo
    union all
    select 'name / number', c.id, c.claim_no from public.claims c where (c.claim_no like 'DEMO-%') <> c.is_demo;
end;
$$;

create or replace function public.delete_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paths text[];
  v_out   jsonb := '{}'::jsonb;
  n       int;
begin
  if not public.has_role('admin') then
    raise exception 'Only an admin can delete demo data' using errcode = '42501';
  end if;
  perform set_config('app.demo_admin', 'on', true);

  select coalesce(array_agg(d.storage_path), '{}') into v_paths from public.documents d where d.is_demo;

  -- claims first (payments point at offset receipts)
  delete from public.claim_payments where is_demo;        get diagnostics n = row_count; v_out := v_out || jsonb_build_object('claim_payments', n);
  delete from public.claim_recoveries where is_demo;      get diagnostics n = row_count; v_out := v_out || jsonb_build_object('claim_recoveries', n);
  delete from public.claim_reserves where is_demo;        get diagnostics n = row_count; v_out := v_out || jsonb_build_object('claim_reserves', n);
  delete from public.premium_allocations where is_demo;   get diagnostics n = row_count; v_out := v_out || jsonb_build_object('allocations', n);
  delete from public.premium_receipts where is_demo;      get diagnostics n = row_count; v_out := v_out || jsonb_build_object('receipts', n);
  delete from public.follow_ups where is_demo;            get diagnostics n = row_count; v_out := v_out || jsonb_build_object('follow_ups', n);
  -- evidence links first, then the documents themselves
  delete from public.submission_status_history h using public.submissions s where s.id = h.submission_id and s.is_demo;
  delete from public.documents where is_demo;             get diagnostics n = row_count; v_out := v_out || jsonb_build_object('documents', n);
  delete from public.claims where is_demo;                get diagnostics n = row_count; v_out := v_out || jsonb_build_object('claims', n);
  delete from public.premium_installments where is_demo;  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('installments', n);
  delete from public.submissions where is_demo;           get diagnostics n = row_count; v_out := v_out || jsonb_build_object('submissions', n);
  delete from public.counterparties where is_demo;        get diagnostics n = row_count; v_out := v_out || jsonb_build_object('counterparties', n);
  delete from public.ref_counters where scope like 'DEMO-%';

  perform set_config('app.demo_admin', 'off', true);
  return v_out || jsonb_build_object('document_paths', to_jsonb(v_paths));
end;
$$;

create or replace function public.demo_data_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.has_role('admin') then public.demo_data_counts_all() end
$$;

create or replace function public.demo_data_counts_all()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'counterparties', (select count(*) from public.counterparties where is_demo),
    'submissions',    (select count(*) from public.submissions where is_demo),
    'installments',   (select count(*) from public.premium_installments where is_demo),
    'receipts',       (select count(*) from public.premium_receipts where is_demo),
    'allocations',    (select count(*) from public.premium_allocations where is_demo),
    'follow_ups',     (select count(*) from public.follow_ups where is_demo),
    'claims',         (select count(*) from public.claims where is_demo),
    'claim_reserves', (select count(*) from public.claim_reserves where is_demo),
    'claim_payments', (select count(*) from public.claim_payments where is_demo))
$$;
