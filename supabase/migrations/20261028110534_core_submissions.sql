-- =====================================================================
-- Phase 0 / Step 2b: core tables — submissions, status history,
-- follow-ups, documents, audit log
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums. Future phases extend with ALTER TYPE ... ADD VALUE (non-breaking).
-- ---------------------------------------------------------------------
create type public.business_type as enum ('facultative', 'binder');

create type public.submission_status as enum (
  'received', 'under_review', 'declined', 'offered', 'bound', 'ntu', 'no_response'
);

-- Generic "thing a follow-up / document belongs to"
create type public.entity_type as enum ('submission', 'premium', 'claim', 'bordereau');

create type public.follow_up_type as enum ('request_update', 'offer_expiry', 'other');

create type public.doc_type as enum (
  'submission', 'slip', 'bordereau', 'invoice', 'debit_note', 'credit_note',
  'claim_notice', 'loss_advice', 'correspondence', 'other'
);

-- ---------------------------------------------------------------------
-- Reference number counters (SUB-2026-0001; later CLM-, PRM-, ...)
-- ---------------------------------------------------------------------
create table public.ref_counters (
  scope      text not null,
  year       int  not null,
  last_value int  not null default 0,
  primary key (scope, year)
);

create or replace function public.next_ref_no(p_scope text, p_year int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next int;
begin
  insert into public.ref_counters as c (scope, year, last_value)
  values (p_scope, p_year, 1)
  on conflict (scope, year) do update set last_value = c.last_value + 1
  returning last_value into v_next;
  return format('%s-%s-%s', p_scope, p_year, lpad(v_next::text, 4, '0'));
end;
$$;

-- ---------------------------------------------------------------------
-- Submissions
-- Shares / percentages are stored as percent: 12.5 = 12.5 %
-- ---------------------------------------------------------------------
create table public.submissions (
  id                 uuid primary key default gen_random_uuid(),
  ref_no             text not null unique,
  received_at        date not null default current_date,
  source_party_id    uuid not null references public.counterparties (id),
  mga_id             uuid not null references public.counterparties (id),
  broker_id          uuid references public.counterparties (id),
  business_type      public.business_type not null default 'facultative',
  insured_name       text not null check (length(trim(insured_name)) > 0),
  insured_country    char(2) references public.countries (code),
  risk_description   text,
  lob_id             uuid references public.lines_of_business (id),
  period_from        date,
  period_to          date,
  currency           char(3) not null references public.currencies (code),
  sum_insured_100    numeric(18, 2) check (sum_insured_100 >= 0),
  limit_100          numeric(18, 2) check (limit_100 >= 0),
  deductible         numeric(18, 2) check (deductible >= 0),
  gross_premium_100  numeric(18, 2) check (gross_premium_100 >= 0),
  commission_pct     numeric(9, 6) not null default 0 check (commission_pct between 0 and 100),
  brokerage_pct      numeric(9, 6) not null default 0 check (brokerage_pct between 0 and 100),
  written_share_pct  numeric(9, 6) check (written_share_pct > 0 and written_share_pct <= 100),
  signed_share_pct   numeric(9, 6) check (signed_share_pct > 0 and signed_share_pct <= 100),
  offer_valid_until  date,
  payment_terms_days int check (payment_terms_days between 0 and 3650),
  ppw_date           date,
  status             public.submission_status not null default 'received',
  decision_reason    text,
  underwriter_id     uuid references public.profiles (id),
  next_follow_up_at  timestamptz,
  status_changed_at  timestamptz not null default now(),
  offered_at         timestamptz,
  bound_at           timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  created_by         uuid references public.profiles (id),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.profiles (id),

  constraint submissions_period_chk
    check (period_from is null or period_to is null or period_to >= period_from),
  constraint submissions_deductions_chk
    check (commission_pct + brokerage_pct <= 100),
  -- Status rules, enforced on every write path
  constraint submissions_offer_chk
    check (status not in ('offered', 'bound', 'ntu', 'no_response')
           or (written_share_pct > 0 and offer_valid_until is not null)),
  constraint submissions_bound_chk
    check (status <> 'bound'
           or (signed_share_pct > 0 and signed_share_pct <= written_share_pct)),
  constraint submissions_reason_chk
    check (status not in ('declined', 'ntu')
           or length(trim(coalesce(decision_reason, ''))) > 0)
);

create index submissions_status_idx      on public.submissions (status);
create index submissions_mga_idx         on public.submissions (mga_id);
create index submissions_broker_idx      on public.submissions (broker_id);
create index submissions_source_idx      on public.submissions (source_party_id);
create index submissions_lob_idx         on public.submissions (lob_id);
create index submissions_underwriter_idx on public.submissions (underwriter_id);
create index submissions_received_idx    on public.submissions (received_at desc);
create index submissions_bound_at_idx    on public.submissions (bound_at) where status = 'bound';

-- Validate counterparty types (mga_id must be an MGA, broker_id a broker)
create or replace function public.submissions_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.counterparties where id = new.mga_id and type = 'mga') then
    raise exception 'mga_id must reference a counterparty of type MGA' using errcode = '23514';
  end if;
  if new.broker_id is not null
     and not exists (select 1 from public.counterparties where id = new.broker_id and type = 'broker') then
    raise exception 'broker_id must reference a counterparty of type broker' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger submissions_validate
before insert or update of mga_id, broker_id on public.submissions
for each row execute function public.submissions_validate();

-- Insert: ref number + audit columns
create or replace function public.submissions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ref_no is null then
    new.ref_no := public.next_ref_no('SUB', extract(year from new.received_at)::int);
  end if;
  new.created_by := coalesce(new.created_by, auth.uid());
  new.updated_by := coalesce(new.updated_by, auth.uid());
  new.underwriter_id := coalesce(new.underwriter_id, auth.uid());
  new.status_changed_at := coalesce(new.status_changed_at, now());
  return new;
end;
$$;

create trigger submissions_before_insert
before insert on public.submissions
for each row execute function public.submissions_before_insert();

-- Update: status may only change through change_submission_status();
-- maintenance-only changes (next_follow_up_at) do not touch updated_*.
create or replace function public.submissions_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.status_change', true), '') <> 'on' then
    raise exception 'Status can only be changed with change_submission_status()' using errcode = '42501';
  end if;

  if new.ref_no is distinct from old.ref_no then
    raise exception 'ref_no cannot be changed' using errcode = '42501';
  end if;

  if (to_jsonb(new) - array['next_follow_up_at', 'updated_at', 'updated_by'])
     is distinct from (to_jsonb(old) - array['next_follow_up_at', 'updated_at', 'updated_by']) then
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), old.updated_by);
  end if;
  return new;
end;
$$;

create trigger submissions_before_update
before update on public.submissions
for each row execute function public.submissions_before_update();

-- ---------------------------------------------------------------------
-- Documents (generic: entity_type + entity_id). Files live in the
-- private Storage bucket "documents" at <entity_type>/<entity_id>/<uuid>-<file>
-- ---------------------------------------------------------------------
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  entity_type  public.entity_type not null,
  entity_id    uuid not null,
  doc_type     public.doc_type not null default 'other',
  file_name    text not null check (length(trim(file_name)) > 0),
  storage_path text not null unique,
  mime_type    text,
  size_bytes   bigint check (size_bytes >= 0),
  version      int not null default 1 check (version >= 1),
  description  text,
  uploaded_by  uuid references public.profiles (id) default auth.uid(),
  uploaded_at  timestamptz not null default now(),
  constraint documents_path_chk check (storage_path like entity_type::text || '/' || entity_id::text || '/%')
);

create index documents_entity_idx on public.documents (entity_type, entity_id);

-- ---------------------------------------------------------------------
-- Status history (append-only)
-- ---------------------------------------------------------------------
create table public.submission_status_history (
  id                bigint generated always as identity primary key,
  submission_id     uuid not null references public.submissions (id) on delete cascade,
  from_status       public.submission_status,
  to_status         public.submission_status not null,
  written_share_pct numeric(9, 6),
  signed_share_pct  numeric(9, 6),
  comment           text,
  document_id       uuid references public.documents (id) on delete set null,
  changed_by        uuid references public.profiles (id),
  changed_at        timestamptz not null default now()
);

create index submission_status_history_sub_idx on public.submission_status_history (submission_id, changed_at);

create or replace function public.forbid_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

-- Append-only: block UPDATE (DELETE only via cascade from submissions, by admin)
create trigger submission_status_history_no_update
before update on public.submission_status_history
for each row execute function public.forbid_change();

-- ---------------------------------------------------------------------
-- Follow-ups (generic: entity_type + entity_id)
-- ---------------------------------------------------------------------
create table public.follow_ups (
  id          uuid primary key default gen_random_uuid(),
  entity_type public.entity_type not null,
  entity_id   uuid not null,
  type        public.follow_up_type not null default 'other',
  title       text,
  due_at      timestamptz not null,
  assigned_to uuid references public.profiles (id),
  done_at     timestamptz,
  done_by     uuid references public.profiles (id),
  outcome     text,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) default auth.uid(),
  updated_at  timestamptz not null default now(),
  -- Closing a follow-up requires an outcome comment
  constraint follow_ups_outcome_chk
    check (done_at is null or length(trim(coalesce(outcome, ''))) > 0)
);

create index follow_ups_entity_idx on public.follow_ups (entity_type, entity_id);
create index follow_ups_open_assignee_idx on public.follow_ups (assigned_to, due_at) where done_at is null;

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

create trigger follow_ups_before_write
before insert or update on public.follow_ups
for each row execute function public.follow_ups_before_write();

-- Keep submissions.next_follow_up_at = earliest open follow-up
create or replace function public.refresh_next_follow_up(p_entity_type public.entity_type, p_entity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_entity_type = 'submission' then
    update public.submissions s
       set next_follow_up_at = (select min(f.due_at) from public.follow_ups f
                                 where f.entity_type = 'submission' and f.entity_id = s.id and f.done_at is null)
     where s.id = p_entity_id;
  end if;
end;
$$;

create or replace function public.follow_ups_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_next_follow_up(old.entity_type, old.entity_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_next_follow_up(new.entity_type, new.entity_id);
  end if;
  return null;
end;
$$;

create trigger follow_ups_after_write
after insert or update or delete on public.follow_ups
for each row execute function public.follow_ups_after_write();

-- ---------------------------------------------------------------------
-- Documents: version numbering (same entity + doc type + file name)
-- ---------------------------------------------------------------------
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
  return new;
end;
$$;

create trigger documents_before_insert
before insert on public.documents
for each row execute function public.documents_before_insert();

-- ---------------------------------------------------------------------
-- Generic audit log
-- ---------------------------------------------------------------------
create table public.audit_log (
  id             bigint generated always as identity primary key,
  table_name     text not null,
  record_id      text not null,
  action         text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changed_fields text[],
  old_data       jsonb,
  new_data       jsonb,
  changed_by     uuid,
  changed_at     timestamptz not null default now()
);

create index audit_log_record_idx on public.audit_log (table_name, record_id, changed_at desc);

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old     jsonb;
  v_new     jsonb;
  v_fields  text[];
  v_ignore  text[] := array['updated_at', 'updated_by', 'next_follow_up_at'];
  v_id      text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into v_fields
      from jsonb_each(v_new) n
     where n.value is distinct from v_old -> n.key
       and n.key <> all (v_ignore);
    if v_fields is null then
      return null; -- only maintenance columns changed
    end if;
  end if;

  v_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'key', v_old ->> 'key');

  insert into public.audit_log (table_name, record_id, action, changed_fields, old_data, new_data, changed_by)
  values (tg_table_name, coalesce(v_id, '?'), tg_op, v_fields, v_old, v_new, auth.uid());
  return null;
end;
$$;

create trigger audit_submissions     after insert or update or delete on public.submissions     for each row execute function public.audit_trigger();
create trigger audit_follow_ups      after insert or update or delete on public.follow_ups      for each row execute function public.audit_trigger();
create trigger audit_documents       after insert or update or delete on public.documents       for each row execute function public.audit_trigger();
create trigger audit_counterparties  after insert or update or delete on public.counterparties  for each row execute function public.audit_trigger();
create trigger audit_settings        after insert or update or delete on public.settings        for each row execute function public.audit_trigger();
create trigger audit_profiles        after insert or update or delete on public.profiles        for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- Who may write records of an entity type (used by follow-ups, documents, storage)
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
    when 'claim'      then public.has_role('admin', 'claims')
    else false
  end
$$;

-- ---------------------------------------------------------------------
-- Reporting view with calculated figures (respects RLS of base tables)
--   share basis       = signed share if bound, else written share
--   our gross premium = gross_premium_100 × share
--   deductions        = commission + brokerage (both % of our gross)
--   our net premium   = our gross − deductions
--   USD               = amount × fx rate at bound date (else received date)
-- ---------------------------------------------------------------------
create view public.submissions_v
with (security_invoker = true)
as
with base as (
  select
    s.*,
    case when s.status = 'bound' then s.signed_share_pct else s.written_share_pct end as share_pct,
    public.fx_rate_to_usd(s.currency, coalesce(s.bound_at::date, s.received_at)) as fx_rate_to_usd
  from public.submissions s
), calc as (
  select
    b.*,
    round(b.gross_premium_100 * b.share_pct / 100, 2) as our_gross_premium,
    round(b.sum_insured_100   * b.share_pct / 100, 2) as our_sum_insured,
    round(b.limit_100         * b.share_pct / 100, 2) as our_limit
  from base b
), ded as (
  select
    c.*,
    round(c.our_gross_premium * c.commission_pct / 100, 2) as commission_amount,
    round(c.our_gross_premium * c.brokerage_pct / 100, 2)  as brokerage_amount
  from calc c
)
select
  d.*,
  d.commission_amount + d.brokerage_amount                                         as deductions_amount,
  d.our_gross_premium - d.commission_amount - d.brokerage_amount                   as our_net_premium,
  round(d.gross_premium_100 * d.fx_rate_to_usd, 2)                                 as gross_premium_100_usd,
  round(d.our_gross_premium * d.fx_rate_to_usd, 2)                                 as our_gross_premium_usd,
  round((d.our_gross_premium - d.commission_amount - d.brokerage_amount) * d.fx_rate_to_usd, 2) as our_net_premium_usd,
  round(d.sum_insured_100 * d.fx_rate_to_usd, 2)                                   as sum_insured_100_usd,
  mga.name    as mga_name,
  brk.name    as broker_name,
  src.name    as source_party_name,
  src.type    as source_party_type,
  lob.code    as lob_code,
  lob.name    as lob_name,
  coalesce(uw.full_name, uw.email) as underwriter_name,
  (d.status = 'offered' and d.offer_valid_until < current_date)                   as offer_expired,
  (d.next_follow_up_at is not null and d.next_follow_up_at < now())               as follow_up_overdue,
  case when d.status in ('offered', 'no_response')
       then (current_date - d.offered_at::date) end                                as days_since_offered
from ded d
join public.counterparties mga on mga.id = d.mga_id
join public.counterparties src on src.id = d.source_party_id
left join public.counterparties brk on brk.id = d.broker_id
left join public.lines_of_business lob on lob.id = d.lob_id
left join public.profiles uw on uw.id = d.underwriter_id;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.ref_counters              enable row level security;
alter table public.submissions               enable row level security;
alter table public.submission_status_history enable row level security;
alter table public.follow_ups                enable row level security;
alter table public.documents                 enable row level security;
alter table public.audit_log                 enable row level security;

-- ref_counters: only internal functions write; admins may look
create policy ref_counters_admin_select on public.ref_counters
  for select to authenticated using (public.has_role('admin'));

-- submissions
create policy submissions_select on public.submissions
  for select to authenticated using (public.is_app_user());
create policy submissions_insert on public.submissions
  for insert to authenticated with check (public.has_role('admin', 'underwriter') and status = 'received');
create policy submissions_update on public.submissions
  for update to authenticated
  using (public.has_role('admin', 'underwriter'))
  with check (public.has_role('admin', 'underwriter'));
create policy submissions_delete on public.submissions
  for delete to authenticated using (public.has_role('admin'));

-- status history: read-only for users; written by change_submission_status()
create policy submission_status_history_select on public.submission_status_history
  for select to authenticated using (public.is_app_user());

-- follow-ups
create policy follow_ups_select on public.follow_ups
  for select to authenticated using (public.is_app_user());
create policy follow_ups_insert on public.follow_ups
  for insert to authenticated with check (public.can_write_entity(entity_type::text));
create policy follow_ups_update on public.follow_ups
  for update to authenticated
  using (public.can_write_entity(entity_type::text) or (assigned_to = auth.uid() and public.is_app_user()))
  with check (public.can_write_entity(entity_type::text) or (assigned_to = auth.uid() and public.is_app_user()));
create policy follow_ups_delete on public.follow_ups
  for delete to authenticated using (public.has_role('admin'));

-- documents
create policy documents_select on public.documents
  for select to authenticated using (public.is_app_user());
create policy documents_insert on public.documents
  for insert to authenticated with check (public.can_write_entity(entity_type::text));
create policy documents_update on public.documents
  for update to authenticated
  using (public.can_write_entity(entity_type::text))
  with check (public.can_write_entity(entity_type::text));
create policy documents_delete on public.documents
  for delete to authenticated
  using (public.has_role('admin') or (uploaded_by = auth.uid() and public.can_write_entity(entity_type::text)));

-- audit log: read-only
create policy audit_log_select on public.audit_log
  for select to authenticated using (public.is_app_user());

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke all on public.ref_counters, public.submissions, public.submission_status_history,
              public.follow_ups, public.documents, public.audit_log, public.submissions_v
  from anon, authenticated;

grant select on public.ref_counters to authenticated;

-- submissions: status, shares-at-binding, decision and system columns only via functions
grant select, delete on public.submissions to authenticated;
grant insert (received_at, source_party_id, mga_id, broker_id, business_type, insured_name, insured_country,
              risk_description, lob_id, period_from, period_to, currency, sum_insured_100, limit_100,
              deductible, gross_premium_100, commission_pct, brokerage_pct, written_share_pct,
              offer_valid_until, payment_terms_days, ppw_date, underwriter_id, notes)
  on public.submissions to authenticated;
grant update (received_at, source_party_id, mga_id, broker_id, business_type, insured_name, insured_country,
              risk_description, lob_id, period_from, period_to, currency, sum_insured_100, limit_100,
              deductible, gross_premium_100, commission_pct, brokerage_pct, written_share_pct,
              offer_valid_until, payment_terms_days, ppw_date, underwriter_id, notes)
  on public.submissions to authenticated;

grant select on public.submissions_v to authenticated;
grant select on public.submission_status_history to authenticated;

grant select, delete on public.follow_ups to authenticated;
grant insert (entity_type, entity_id, type, title, due_at, assigned_to, done_at, outcome) on public.follow_ups to authenticated;
grant update (type, title, due_at, assigned_to, done_at, outcome) on public.follow_ups to authenticated;

grant select, delete on public.documents to authenticated;
grant insert (entity_type, entity_id, doc_type, file_name, storage_path, mime_type, size_bytes, description)
  on public.documents to authenticated;
grant update (doc_type, description) on public.documents to authenticated;

grant select on public.audit_log to authenticated;

grant usage on type public.business_type, public.submission_status, public.entity_type,
                   public.follow_up_type, public.doc_type to authenticated;

-- Functions: internal ones are not callable from the API
revoke execute on function public.next_ref_no(text, int)                              from public, anon, authenticated;
revoke execute on function public.submissions_validate()                              from public, anon, authenticated;
revoke execute on function public.submissions_before_insert()                         from public, anon, authenticated;
revoke execute on function public.submissions_before_update()                         from public, anon, authenticated;
revoke execute on function public.forbid_change()                                     from public, anon, authenticated;
revoke execute on function public.follow_ups_before_write()                           from public, anon, authenticated;
revoke execute on function public.refresh_next_follow_up(public.entity_type, uuid)    from public, anon, authenticated;
revoke execute on function public.follow_ups_after_write()                            from public, anon, authenticated;
revoke execute on function public.documents_before_insert()                           from public, anon, authenticated;
revoke execute on function public.audit_trigger()                                     from public, anon, authenticated;
revoke execute on function public.can_write_entity(text)                              from public, anon;
grant  execute on function public.can_write_entity(text) to authenticated;
