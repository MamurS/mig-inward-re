-- Phase C — binders and bordereaux. Additive: new tables, views, functions;
-- submissions gets binder_id; replaced functions keep their signatures;
-- follow_ups_v keeps its columns. Every new table: RLS, explicit grants, audit,
-- is_demo + the demo guard.
--
-- A binder is the MGA's delegated authority (period, lines, territories, our
-- share, commission, limits per risk / aggregate / per line, currency,
-- bordereau frequency and due days). Bordereaux (risk, premium, claims) are
-- imported line by line; the database re-checks every line (errors are
-- refused, warnings need a comment, duplicates are refused), then: a premium
-- bordereau becomes one premium installment (our share) per currency on the
-- binder's bound submission; a claims bordereau creates or updates claims
-- matched by the cedent's claim reference (never silently duplicated); a risk
-- bordereau feeds capacity used.

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.binders (
  id                 uuid primary key default gen_random_uuid(),
  binder_ref         text not null unique,
  mga_id             uuid not null references public.counterparties (id),
  broker_id          uuid references public.counterparties (id),
  underwriter_id     uuid references public.profiles (id),
  period_from        date not null,
  period_to          date not null,
  currency           char(3) not null references public.currencies (code),
  our_share_pct      numeric(9, 6) not null check (our_share_pct > 0 and our_share_pct <= 100),
  commission_pct     numeric(9, 6) not null default 0 check (commission_pct >= 0 and commission_pct < 100),
  brokerage_pct      numeric(9, 6) not null default 0 check (brokerage_pct >= 0 and brokerage_pct < 100),
  limit_per_risk     numeric(18, 2) check (limit_per_risk > 0),
  aggregate_limit    numeric(18, 2) check (aggregate_limit > 0),
  territories        char(2)[] not null default '{}',
  bordereau_frequency public.bordereau_frequency not null default 'monthly',
  bordereau_due_days int not null default 30 check (bordereau_due_days between 0 and 365),
  bordereau_kinds    public.bordereau_kind[] not null default '{risk,premium,claims}',
  status             public.binder_status not null default 'active',
  capacity_alerted_pct int not null default 0,
  notes              text,
  created_at         timestamptz not null default now(),
  created_by         uuid references public.profiles (id) default auth.uid(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.profiles (id),
  is_demo            boolean not null default public.demo_mode(),
  constraint binders_period_chk check (period_to >= period_from),
  constraint binders_demo_ref_chk check ((binder_ref like 'DEMO-%') = is_demo)
);
comment on table public.binders is 'Delegated authorities given to MGAs; limits are at 100 % in the binder currency';
create index binders_mga_idx on public.binders (mga_id);
create index binders_is_demo_idx on public.binders (is_demo);

create table public.binder_lobs (
  binder_id  uuid not null references public.binders (id) on delete cascade,
  lob_id     uuid not null references public.lines_of_business (id),
  limit_100  numeric(18, 2) check (limit_100 > 0),
  is_demo    boolean not null default public.demo_mode(),
  primary key (binder_id, lob_id)
);
comment on table public.binder_lobs is 'Lines a binder may write, with an optional per-line limit (100 %)';

alter table public.submissions add column if not exists binder_id uuid references public.binders (id);
create index if not exists submissions_binder_idx on public.submissions (binder_id);

create table public.bordereau_templates (
  id          uuid primary key default gen_random_uuid(),
  mga_id      uuid not null references public.counterparties (id),
  kind        public.bordereau_kind not null,
  name        text not null,
  mapping     jsonb not null default '{}'::jsonb,
  header_row  int not null default 1 check (header_row between 1 and 50),
  sheet       text,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) default auth.uid(),
  updated_at  timestamptz not null default now(),
  is_demo     boolean not null default public.demo_mode(),
  unique (mga_id, kind, name)
);
comment on table public.bordereau_templates is 'An MGA''s column mapping for one kind of bordereau, reused on the next upload';

create table public.bordereaux (
  id             uuid primary key default gen_random_uuid(),
  ref_no         text not null unique,
  binder_id      uuid not null references public.binders (id),
  kind           public.bordereau_kind not null,
  period_start   date not null,
  period_end     date not null,
  received_date  date not null default current_date,
  template_id    uuid references public.bordereau_templates (id),
  file_name      text,
  stated_total   numeric(18, 2),
  computed_total numeric(18, 2),
  totals_comment text,
  line_count     int not null default 0,
  warning_count  int not null default 0,
  rejected_count int not null default 0,
  installment_ids uuid[] not null default '{}',
  notes          text,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id) default auth.uid(),
  is_demo        boolean not null default public.demo_mode(),
  constraint bordereaux_period_chk check (period_end >= period_start),
  constraint bordereaux_demo_ref_chk check ((ref_no like 'DEMO-%') = is_demo)
);
comment on table public.bordereaux is 'An imported bordereau (the original file is a document on it)';
create index bordereaux_binder_idx on public.bordereaux (binder_id, kind, period_start);

create table public.bordereau_lines (
  id                uuid primary key default gen_random_uuid(),
  bordereau_id      uuid not null references public.bordereaux (id),
  binder_id         uuid not null references public.binders (id),
  kind              public.bordereau_kind not null,
  line_no           int not null,
  dup_key           text not null,
  policy_ref        text,
  claim_ref         text,
  insured_name      text,
  insured_country   char(2),
  lob_id            uuid references public.lines_of_business (id),
  period_from       date,
  period_to         date,
  currency          char(3) references public.currencies (code),
  sum_insured_100   numeric(18, 2),
  limit_100         numeric(18, 2),
  gross_premium_100 numeric(18, 2),
  date_of_loss      date,
  notified_date     date,
  cause             text,
  paid_100          numeric(18, 2),
  outstanding_100   numeric(18, 2),
  raw               jsonb not null default '{}'::jsonb,
  messages          jsonb not null default '[]'::jsonb,
  status            public.bordereau_line_status not null default 'ok',
  comment           text,
  claim_id          uuid references public.claims (id),
  is_demo           boolean not null default public.demo_mode(),
  constraint bordereau_lines_warning_comment_chk check (status = 'ok' or length(trim(coalesce(comment, ''))) > 0),
  constraint bordereau_lines_required_chk check (
    case kind
      when 'risk'    then policy_ref is not null and period_from is not null and currency is not null
      when 'premium' then policy_ref is not null and gross_premium_100 is not null and currency is not null
      when 'claims'  then claim_ref is not null and date_of_loss is not null and currency is not null
    end)
);
comment on table public.bordereau_lines is 'Imported bordereau lines (the database refuses error lines and duplicates)';
create index bordereau_lines_bordereau_idx on public.bordereau_lines (bordereau_id, line_no);
-- never the same line twice on one binder (risk: policy + inception; premium: policy + transaction; claims: claim + period)
create unique index bordereau_lines_dup_uq on public.bordereau_lines (binder_id, kind, dup_key);

-- ---------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------
create or replace function public.binders_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.is_demo := coalesce((select c.is_demo from public.counterparties c where c.id = new.mga_id), new.is_demo);
    if new.is_demo and new.binder_ref not like 'DEMO-%' then new.binder_ref := 'DEMO-' || new.binder_ref; end if;
    if not new.is_demo and new.binder_ref like 'DEMO-%' then
      raise exception 'References starting with DEMO- are reserved for demo data' using errcode = '23514';
    end if;
  end if;
  if not exists (select 1 from public.counterparties c where c.id = new.mga_id and c.type = 'mga') then
    raise exception 'A binder is given to an MGA' using errcode = '23514';
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke execute on function public.binders_before_write() from public, anon, authenticated;
create trigger binders_before_write before insert or update on public.binders for each row execute function public.binders_before_write();

-- a binder submission belongs to a binder of its MGA
create or replace function public.submissions_binder_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.binder_id is not null then
    if new.business_type <> 'binder' then
      raise exception 'Only a binder submission links to a binder' using errcode = '23514';
    end if;
    if not exists (select 1 from public.binders b where b.id = new.binder_id and b.mga_id = new.mga_id and b.is_demo = new.is_demo) then
      raise exception 'The binder must belong to the submission''s MGA' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.submissions_binder_check() from public, anon, authenticated;
create trigger submissions_binder_check before insert or update of binder_id, business_type, mga_id on public.submissions
  for each row execute function public.submissions_binder_check();

create or replace function public.bordereaux_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.is_demo := coalesce((select b.is_demo from public.binders b where b.id = new.binder_id), new.is_demo);
  new.ref_no := public.next_ref_no(case when new.is_demo then 'DEMO-BDX' else 'BDX' end, extract(year from new.received_date)::int);
  new.created_at := now();
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;
revoke execute on function public.bordereaux_before_insert() from public, anon, authenticated;
create trigger bordereaux_before_insert before insert on public.bordereaux for each row execute function public.bordereaux_before_insert();

-- Every line is re-checked here, whatever the screen showed: an error line is refused.
create or replace function public.bordereau_lines_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  b        public.binders;
  v_bdx    public.bordereaux;
  v_limit  numeric;
  v_amount numeric;
begin
  select * into v_bdx from public.bordereaux x where x.id = new.bordereau_id;
  select * into b from public.binders x where x.id = v_bdx.binder_id;
  new.binder_id := b.id;
  new.kind := v_bdx.kind;
  new.is_demo := v_bdx.is_demo;
  if new.kind in ('risk', 'premium') and new.period_from is not null and (new.period_from < b.period_from or new.period_from > b.period_to) then
    raise exception 'Line %: inception % is outside the binder period', new.line_no, new.period_from using errcode = '23514';
  end if;
  if new.lob_id is not null and not exists (select 1 from public.binder_lobs l where l.binder_id = b.id and l.lob_id = new.lob_id) then
    raise exception 'Line %: this line of business is not in the binder', new.line_no using errcode = '23514';
  end if;
  if new.insured_country is not null and cardinality(b.territories) > 0 and not (new.insured_country = any (b.territories)) then
    raise exception 'Line %: territory % is not in the binder', new.line_no, new.insured_country using errcode = '23514';
  end if;
  if new.kind = 'risk' and new.currency = b.currency then
    v_amount := coalesce(new.limit_100, new.sum_insured_100);
    if v_amount is not null and b.limit_per_risk is not null and v_amount > b.limit_per_risk then
      raise exception 'Line %: % is above the binder''s limit per risk (%)', new.line_no, v_amount, b.limit_per_risk using errcode = '23514';
    end if;
    select l.limit_100 into v_limit from public.binder_lobs l where l.binder_id = b.id and l.lob_id = new.lob_id;
    if v_amount is not null and v_limit is not null and v_amount > v_limit then
      raise exception 'Line %: % is above the line''s limit (%)', new.line_no, v_amount, v_limit using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.bordereau_lines_before_insert() from public, anon, authenticated;
create trigger bordereau_lines_before_insert before insert on public.bordereau_lines for each row execute function public.bordereau_lines_before_insert();

-- lines and bordereaux are records: never changed (an import is all or nothing); demo delete only
create or replace function public.bordereau_no_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('app.demo_admin', true), '') = 'on' then
    return old;
  end if;
  -- the import records which claim a claims line matched, once
  if tg_op = 'UPDATE' and old.claim_id is null and (to_jsonb(new) - 'claim_id') = (to_jsonb(old) - 'claim_id') then
    return new;
  end if;
  raise exception 'An imported bordereau is a record and is not changed' using errcode = '42501';
end;
$$;
revoke execute on function public.bordereau_no_change() from public, anon, authenticated;
create trigger bordereau_lines_no_change before update or delete on public.bordereau_lines for each row execute function public.bordereau_no_change();
create trigger bordereaux_no_delete before delete on public.bordereaux for each row execute function public.bordereau_no_change();

-- ---------------------------------------------------------------------
-- Capacity: aggregate used = the risk lines' limits (or sums insured) at 100 %,
-- in the binder currency (other currencies through USD rates; none → counted apart)
-- ---------------------------------------------------------------------
create or replace view public.binder_capacity_v
with (security_invoker = true)
as
select b.id as binder_id,
       b.aggregate_limit,
       coalesce(sum(case when l.currency = b.currency then coalesce(l.limit_100, l.sum_insured_100)
                         else coalesce(l.limit_100, l.sum_insured_100) * public.fx_rate_to_usd(l.currency, l.period_from)
                              / nullif(public.fx_rate_to_usd(b.currency, l.period_from), 0) end), 0)::numeric(18, 2) as used_100,
       count(*) filter (where l.currency <> b.currency and (public.fx_rate_to_usd(l.currency, l.period_from) is null
                                                           or public.fx_rate_to_usd(b.currency, l.period_from) is null)) as missing_rate,
       count(l.id) as risk_lines
  from public.binders b
  left join public.bordereau_lines l on l.binder_id = b.id and l.kind = 'risk'
 group by b.id, b.aggregate_limit;
grant select on public.binder_capacity_v to authenticated;

-- Expected bordereaux per period and kind, with their state:
-- received (on time), late (received after the due date), missing (due date passed, none), upcoming (not due yet)
create or replace function public.binder_periods(p_binder_id uuid)
returns table (period_start date, period_end date, kind public.bordereau_kind, due_date date, state text, bordereau_id uuid, ref_no text, received_date date)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (select * from public.binders where id = p_binder_id),
  p as (
    select gs::date as period_start,
           (gs + case when b.bordereau_frequency = 'monthly' then interval '1 month' else interval '3 months' end - interval '1 day')::date as period_end,
           b.bordereau_due_days, k as kind
      from b,
           generate_series(date_trunc(case when b.bordereau_frequency = 'monthly' then 'month' else 'quarter' end, b.period_from::timestamp),
                           least(b.period_to, public.tashkent_today())::timestamp,
                           case when b.bordereau_frequency = 'monthly' then interval '1 month' else interval '3 months' end) gs,
           unnest(b.bordereau_kinds) k)
  select p.period_start, p.period_end, p.kind, p.period_end + p.bordereau_due_days as due_date,
         case when x.id is not null and x.received_date > p.period_end + p.bordereau_due_days then 'late'
              when x.id is not null then 'received'
              when p.period_end + p.bordereau_due_days < public.tashkent_today() then 'missing'
              else 'upcoming' end as state,
         x.id, x.ref_no, x.received_date
    from p
    left join lateral (select bx.id, bx.ref_no, bx.received_date from public.bordereaux bx
                        where bx.binder_id = p_binder_id and bx.kind = p.kind and bx.period_start = p.period_start
                        order by bx.received_date limit 1) x on true
   order by p.period_start, p.kind
$$;
revoke execute on function public.binder_periods(uuid) from public, anon;
grant execute on function public.binder_periods(uuid) to authenticated;

create or replace view public.binders_v
with (security_invoker = true)
as
select b.id, b.binder_ref, b.mga_id, m.name as mga_name, b.broker_id, br.name as broker_name, b.underwriter_id,
       coalesce(u.full_name, u.email) as underwriter_name, b.period_from, b.period_to, b.currency, b.our_share_pct,
       b.commission_pct, b.brokerage_pct, b.limit_per_risk, b.aggregate_limit, b.territories, b.bordereau_frequency,
       b.bordereau_due_days, b.bordereau_kinds, b.status, b.notes, b.created_at, b.updated_at,
       s.id as submission_id, s.ref_no as submission_ref, s.status as submission_status,
       cap.used_100 as capacity_used_100, cap.missing_rate as capacity_missing_rate, cap.risk_lines,
       case when b.aggregate_limit > 0 then round(cap.used_100 / b.aggregate_limit * 100, 1) end as capacity_pct,
       (select count(*) from public.binder_periods(b.id) p where p.state = 'missing')::int as missing_count,
       (select count(*) from public.binder_periods(b.id) p where p.state = 'late')::int as late_count,
       (select max(x.received_date) from public.bordereaux x where x.binder_id = b.id) as last_received,
       (select string_agg(l.code, ', ' order by l.code) from public.binder_lobs bl join public.lines_of_business l on l.id = bl.lob_id where bl.binder_id = b.id) as lob_codes,
       public.search_norm(concat_ws(' ', b.binder_ref, m.name, br.name, s.ref_no, b.notes, array_to_string(b.territories, ' '))) as search_text
  from public.binders b
  join public.counterparties m on m.id = b.mga_id
  left join public.counterparties br on br.id = b.broker_id
  left join public.profiles u on u.id = b.underwriter_id
  left join public.binder_capacity_v cap on cap.binder_id = b.id
  left join lateral (select x.id, x.ref_no, x.status from public.submissions x where x.binder_id = b.id
                      order by (x.status = 'bound') desc, x.bound_at desc nulls last limit 1) s on true;
grant select on public.binders_v to authenticated;

-- ---------------------------------------------------------------------
-- Import: the bordereau, its lines and their effects, all or nothing.
-- SECURITY INVOKER: the caller's RLS decides what they may import (premium
-- needs the right to add installments; claims, the claims role).
-- p_bordereau: {binder_id, kind, period_start, period_end, received_date, template_id, file_name, stated_total, computed_total, totals_comment, notes}
-- p_lines: [{line_no, dup_key, status, comment, messages, raw, policy_ref, claim_ref, insured_name, insured_country, lob_id,
--            period_from, period_to, currency, sum_insured_100, limit_100, gross_premium_100, date_of_loss, notified_date,
--            cause, paid_100, outstanding_100}]
-- p_rejected: how many lines the reviewer left out (errors)
-- ---------------------------------------------------------------------
create or replace function public.import_bordereau(p_bordereau jsonb, p_lines jsonb, p_rejected int default 0)
returns public.bordereaux
language plpgsql
security invoker
set search_path = ''
as $$
declare
  b       public.binders;
  v_bdx   public.bordereaux;
  v_sub   uuid;
  v_l     jsonb;
  v_line  public.bordereau_lines;
  v_claim public.claims;
  v_ids   uuid[] := '{}';
  v_id    uuid;
  v_target numeric;
  v_now   numeric;
  r       record;
begin
  select * into b from public.binders where id = (p_bordereau ->> 'binder_id')::uuid;
  if b.id is null then
    raise exception 'Binder not found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A bordereau needs at least one line to import' using errcode = '22023';
  end if;
  if (p_bordereau ->> 'stated_total') is not null and (p_bordereau ->> 'computed_total') is not null
     and (p_bordereau ->> 'stated_total')::numeric <> (p_bordereau ->> 'computed_total')::numeric
     and coalesce(trim(p_bordereau ->> 'totals_comment'), '') = '' then
    raise exception 'The lines total % differs from the MGA''s stated total %: a comment is needed',
      p_bordereau ->> 'computed_total', p_bordereau ->> 'stated_total' using errcode = '23514';
  end if;

  insert into public.bordereaux (binder_id, kind, period_start, period_end, received_date, template_id, file_name,
                                 stated_total, computed_total, totals_comment, notes, rejected_count)
  values (b.id, (p_bordereau ->> 'kind')::public.bordereau_kind, (p_bordereau ->> 'period_start')::date, (p_bordereau ->> 'period_end')::date,
          coalesce((p_bordereau ->> 'received_date')::date, current_date), nullif(p_bordereau ->> 'template_id', '')::uuid,
          nullif(p_bordereau ->> 'file_name', ''), nullif(p_bordereau ->> 'stated_total', '')::numeric, nullif(p_bordereau ->> 'computed_total', '')::numeric,
          nullif(trim(p_bordereau ->> 'totals_comment'), ''), nullif(trim(p_bordereau ->> 'notes'), ''), coalesce(p_rejected, 0))
  returning * into v_bdx;

  -- the binder's bound submission carries its premium and claims
  select s.id into v_sub from public.submissions s where s.binder_id = b.id and s.status = 'bound' order by s.bound_at desc nulls last limit 1;
  if v_bdx.kind in ('premium', 'claims') and v_sub is null then
    raise exception 'Bind the binder''s submission first: premium and claims are kept on it' using errcode = '23514';
  end if;

  for v_l in select * from jsonb_array_elements(p_lines) loop
    insert into public.bordereau_lines (bordereau_id, binder_id, kind, line_no, dup_key, status, comment, messages, raw,
      policy_ref, claim_ref, insured_name, insured_country, lob_id, period_from, period_to, currency, sum_insured_100, limit_100,
      gross_premium_100, date_of_loss, notified_date, cause, paid_100, outstanding_100)
    values (v_bdx.id, b.id, v_bdx.kind, (v_l ->> 'line_no')::int, v_l ->> 'dup_key',
      coalesce(nullif(v_l ->> 'status', ''), 'ok')::public.bordereau_line_status, nullif(trim(v_l ->> 'comment'), ''),
      coalesce(v_l -> 'messages', '[]'::jsonb), coalesce(v_l -> 'raw', '{}'::jsonb),
      nullif(v_l ->> 'policy_ref', ''), nullif(v_l ->> 'claim_ref', ''), nullif(v_l ->> 'insured_name', ''), nullif(v_l ->> 'insured_country', ''),
      nullif(v_l ->> 'lob_id', '')::uuid, nullif(v_l ->> 'period_from', '')::date, nullif(v_l ->> 'period_to', '')::date, nullif(v_l ->> 'currency', ''),
      nullif(v_l ->> 'sum_insured_100', '')::numeric, nullif(v_l ->> 'limit_100', '')::numeric, nullif(v_l ->> 'gross_premium_100', '')::numeric,
      nullif(v_l ->> 'date_of_loss', '')::date, nullif(v_l ->> 'notified_date', '')::date, nullif(v_l ->> 'cause', ''),
      nullif(v_l ->> 'paid_100', '')::numeric, nullif(v_l ->> 'outstanding_100', '')::numeric)
    returning * into v_line;

    if v_bdx.kind = 'claims' then
      -- our share of paid + outstanding is the claim's reserve total; match by the cedent's reference
      v_target := round((coalesce(v_line.paid_100, 0) + coalesce(v_line.outstanding_100, 0)) * b.our_share_pct / 100, 2);
      select * into v_claim from public.claims c where c.submission_id = v_sub and c.cedent_claim_ref = v_line.claim_ref;
      if v_claim.id is null then
        insert into public.claims (submission_id, notified_date, date_of_loss, currency, cause, cedent_claim_ref, estimate_100, status, coverage_comment, notes)
        values (v_sub, coalesce(v_line.notified_date, v_bdx.received_date), v_line.date_of_loss, v_line.currency, v_line.cause, v_line.claim_ref,
                coalesce(v_line.paid_100, 0) + coalesce(v_line.outstanding_100, 0), 'open', coalesce(v_line.comment, 'Reported on bordereau ' || v_bdx.ref_no), 'From bordereau ' || v_bdx.ref_no)
        returning * into v_claim;
      end if;
      v_now := coalesce((select sum(r2.amount) from public.claim_reserves r2 where r2.claim_id = v_claim.id), 0);
      if v_target <> v_now and v_claim.status in ('notified', 'open', 'reopened') then
        insert into public.claim_reserves (claim_id, movement_date, amount, reason)
        values (v_claim.id, v_bdx.period_end, v_target - v_now, 'Bordereau ' || v_bdx.ref_no || ' line ' || v_line.line_no);
      end if;
      -- record the match on the line (the only change a line ever takes)
      update public.bordereau_lines set claim_id = v_claim.id where id = v_line.id;
    end if;
  end loop;

  -- premium: one installment (our share) per currency on the binder's submission
  if v_bdx.kind = 'premium' then
    for r in select l.currency, sum(l.gross_premium_100) as gross_100 from public.bordereau_lines l where l.bordereau_id = v_bdx.id group by l.currency loop
      v_target := round(r.gross_100 * b.our_share_pct / 100, 2);
      continue when v_target = 0;
      insert into public.premium_installments (submission_id, type, due_date, currency, gross_amount, commission_amount, brokerage_amount, notes)
      values (v_sub, (case when v_target < 0 then 'return' else 'additional' end)::public.installment_type, v_bdx.period_end + b.bordereau_due_days, r.currency,
              v_target, round(v_target * b.commission_pct / 100, 2), round(v_target * b.brokerage_pct / 100, 2),
              'Bordereau ' || v_bdx.ref_no || ' (' || to_char(v_bdx.period_start, 'MM.YYYY') || ')')
      returning id into v_id;
      v_ids := v_ids || v_id;
    end loop;
  end if;

  -- capacity: tell the underwriter and management when it crosses 80 % and 100 %
  if v_bdx.kind = 'risk' then
    perform public.binder_capacity_alert(b.id);
  end if;

  update public.bordereaux x set line_count = (select count(*) from public.bordereau_lines l where l.bordereau_id = x.id),
         warning_count = (select count(*) from public.bordereau_lines l where l.bordereau_id = x.id and l.status = 'warning'),
         installment_ids = v_ids
   where x.id = v_bdx.id
  returning * into v_bdx;
  return v_bdx;
end;
$$;
revoke execute on function public.import_bordereau(jsonb, jsonb, int) from public, anon;
grant execute on function public.import_bordereau(jsonb, jsonb, int) to authenticated;

-- the capacity alert (definer: follow-ups for management and the underwriter,
-- whoever imports). It works out the level itself, so calling it is harmless.
create or replace function public.binder_capacity_alert(p_binder_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b     public.binders;
  v_cap numeric;
  v_pct int;
begin
  select * into b from public.binders where id = p_binder_id;
  if b.id is null or b.aggregate_limit is null then
    return;
  end if;
  select c.used_100 into v_cap from public.binder_capacity_v c where c.binder_id = b.id;
  v_pct := case when v_cap >= b.aggregate_limit then 100 when v_cap >= b.aggregate_limit * 0.8 then 80 else 0 end;
  if v_pct <= b.capacity_alerted_pct then
    return;
  end if;
  update public.binders set capacity_alerted_pct = v_pct where id = p_binder_id;
  insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_to, assigned_role, is_demo)
  values ('binder', b.id, 'capacity_alert', format('Capacity %s %% used', v_pct), now(), null, 'management', b.is_demo),
         ('binder', b.id, 'capacity_alert', format('Capacity %s %% used', v_pct), now(), b.underwriter_id,
          case when b.underwriter_id is null then 'underwriter'::public.app_role end, b.is_demo);
end;
$$;
revoke execute on function public.binder_capacity_alert(uuid) from public, anon;
grant execute on function public.binder_capacity_alert(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Daily job: a follow-up when a period's bordereau is past due (skips demo rows)
-- ---------------------------------------------------------------------
create or replace function public.run_daily_bordereau_follow_ups()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run     bigint;
  v_created int := 0;
  v_result  jsonb;
  b         record;
  p         record;
begin
  insert into public.job_runs (job, started_by) values ('daily_bordereau_follow_ups', auth.uid()) returning id into v_run;
  begin
    for b in select * from public.binders where not is_demo and status = 'active' loop
      for p in select * from public.binder_periods(b.id) where state = 'missing' loop
        if not exists (select 1 from public.follow_ups f
                        where f.entity_type = 'binder' and f.entity_id = b.id and f.type = 'bordereau_missing'
                          and f.title = format('Missing %s bordereau %s', p.kind, to_char(p.period_start, 'MM.YYYY'))) then
          insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_to, assigned_role, is_demo)
          values ('binder', b.id, 'bordereau_missing', format('Missing %s bordereau %s', p.kind, to_char(p.period_start, 'MM.YYYY')), now(),
                  b.underwriter_id, case when b.underwriter_id is null then 'underwriter'::public.app_role end, false);
          v_created := v_created + 1;
        end if;
      end loop;
    end loop;
    v_result := jsonb_build_object('bordereau_missing_follow_ups', v_created);
    update public.job_runs set finished_at = now(), result = v_result where id = v_run;
  exception when others then
    update public.job_runs set finished_at = now(), error = sqlerrm where id = v_run;
    v_result := jsonb_build_object('error', sqlerrm);
  end;
  return v_result;
end;
$$;
revoke execute on function public.run_daily_bordereau_follow_ups() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('daily-bordereau-follow-ups') where exists (select 1 from cron.job where jobname = 'daily-bordereau-follow-ups');
    perform cron.schedule('daily-bordereau-follow-ups', '25 3 * * *', 'select public.run_daily_bordereau_follow_ups()');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Who may read / write
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
    when 'bordereau'  then public.has_role('admin', 'underwriter', 'finance', 'claims')
    when 'binder'     then public.has_role('admin', 'underwriter')
    when 'premium'    then public.has_role('admin', 'finance')
    when 'receipt'    then public.has_role('admin', 'finance')
    when 'claim'      then public.has_role('admin', 'claims')
    else false
  end
$$;

alter table public.binders             enable row level security;
alter table public.binder_lobs         enable row level security;
alter table public.bordereau_templates enable row level security;
alter table public.bordereaux          enable row level security;
alter table public.bordereau_lines     enable row level security;

create policy binders_select on public.binders for select to authenticated using (public.is_app_user());
create policy binders_insert on public.binders for insert to authenticated with check (public.has_role('admin', 'underwriter'));
create policy binders_update on public.binders for update to authenticated using (public.has_role('admin', 'underwriter')) with check (public.has_role('admin', 'underwriter'));
create policy binders_delete on public.binders for delete to authenticated using (public.has_role('admin'));

create policy binder_lobs_select on public.binder_lobs for select to authenticated using (public.is_app_user());
create policy binder_lobs_write on public.binder_lobs for all to authenticated using (public.has_role('admin', 'underwriter')) with check (public.has_role('admin', 'underwriter'));

create policy bordereau_templates_select on public.bordereau_templates for select to authenticated using (public.is_app_user());
create policy bordereau_templates_write on public.bordereau_templates for all to authenticated
  using (public.has_role('admin', 'underwriter', 'finance', 'claims')) with check (public.has_role('admin', 'underwriter', 'finance', 'claims'));

create policy bordereaux_select on public.bordereaux for select to authenticated using (public.is_app_user());
create policy bordereaux_insert on public.bordereaux for insert to authenticated with check (public.has_role('admin', 'underwriter', 'finance', 'claims'));
create policy bordereaux_update on public.bordereaux for update to authenticated using (public.has_role('admin', 'underwriter', 'finance', 'claims')) with check (public.has_role('admin', 'underwriter', 'finance', 'claims'));

create policy bordereau_lines_select on public.bordereau_lines for select to authenticated using (public.is_app_user());
create policy bordereau_lines_insert on public.bordereau_lines for insert to authenticated with check (public.has_role('admin', 'underwriter', 'finance', 'claims'));
create policy bordereau_lines_update on public.bordereau_lines for update to authenticated using (public.has_role('admin', 'claims')) with check (public.has_role('admin', 'claims'));

create policy binders_demo             on public.binders             as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));
create policy binder_lobs_demo         on public.binder_lobs         as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));
create policy bordereau_templates_demo on public.bordereau_templates as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));
create policy bordereaux_demo          on public.bordereaux          as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));
create policy bordereau_lines_demo     on public.bordereau_lines     as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));

revoke all on public.binders, public.binder_lobs, public.bordereau_templates, public.bordereaux, public.bordereau_lines from anon, authenticated;
grant select, delete on public.binders to authenticated;
grant insert (binder_ref, mga_id, broker_id, underwriter_id, period_from, period_to, currency, our_share_pct, commission_pct, brokerage_pct,
              limit_per_risk, aggregate_limit, territories, bordereau_frequency, bordereau_due_days, bordereau_kinds, status, notes) on public.binders to authenticated;
grant update (binder_ref, broker_id, underwriter_id, period_from, period_to, currency, our_share_pct, commission_pct, brokerage_pct,
              limit_per_risk, aggregate_limit, territories, bordereau_frequency, bordereau_due_days, bordereau_kinds, status, notes) on public.binders to authenticated;
grant select, insert, update, delete on public.binder_lobs to authenticated;
grant select, delete on public.bordereau_templates to authenticated;
grant insert (mga_id, kind, name, mapping, header_row, sheet) on public.bordereau_templates to authenticated;
grant update (name, mapping, header_row, sheet, updated_at) on public.bordereau_templates to authenticated;
grant select on public.bordereaux, public.bordereau_lines to authenticated;
grant insert (binder_id, kind, period_start, period_end, received_date, template_id, file_name, stated_total, computed_total, totals_comment, notes, rejected_count)
  on public.bordereaux to authenticated;
grant update (line_count, warning_count, installment_ids) on public.bordereaux to authenticated;
grant insert on public.bordereau_lines to authenticated;
grant update (claim_id) on public.bordereau_lines to authenticated;
grant insert (binder_id), update (binder_id) on public.submissions to authenticated;
grant all on public.binders, public.binder_lobs, public.bordereau_templates, public.bordereaux, public.bordereau_lines to service_role;

create trigger audit_binders             after insert or update or delete on public.binders             for each row execute function public.audit_trigger();
create trigger audit_binder_lobs         after insert or update or delete on public.binder_lobs         for each row execute function public.audit_trigger();
create trigger audit_bordereau_templates after insert or update or delete on public.bordereau_templates for each row execute function public.audit_trigger();
create trigger audit_bordereaux          after insert or update or delete on public.bordereaux          for each row execute function public.audit_trigger();
create trigger audit_bordereau_lines     after insert or update or delete on public.bordereau_lines     for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- Demo data: the guard, the link check, delete and counts know binders and bordereaux
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
    when 'binder'     then (select b.is_demo from public.binders b where b.id = p_entity_id)
    when 'bordereau'  then (select x.is_demo from public.bordereaux x where x.id = p_entity_id)
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
    when 'binders', 'bordereau_templates' then
      if exists (select 1 from public.counterparties c where c.id in (new.mga_id, (to_jsonb(new) ->> 'broker_id')::uuid) and c.is_demo <> new.is_demo) then
        raise exception 'A % binder or template cannot use % counterparties',
          case when new.is_demo then 'demo' else 'real' end, case when new.is_demo then 'real' else 'demo' end using errcode = '23514';
      end if;
    when 'binder_lobs', 'bordereaux' then
      select b.is_demo into v_parent from public.binders b where b.id = new.binder_id;
      new.is_demo := coalesce(v_parent, new.is_demo);
    when 'bordereau_lines' then
      select x.is_demo into v_parent from public.bordereaux x where x.id = new.bordereau_id;
      new.is_demo := coalesce(v_parent, new.is_demo);
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


-- «zz_» so it runs after the tables' own BEFORE triggers
create trigger zz_demo_guard before insert or update or delete on public.binders             for each row execute function public.demo_guard();
create trigger zz_demo_guard before insert or update or delete on public.binder_lobs         for each row execute function public.demo_guard();
create trigger zz_demo_guard before insert or update or delete on public.bordereau_templates for each row execute function public.demo_guard();
create trigger zz_demo_guard before insert or update or delete on public.bordereaux          for each row execute function public.demo_guard();
create trigger zz_demo_guard before insert or update or delete on public.bordereau_lines     for each row execute function public.demo_guard();

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
    select 'binder ↔ MGA', b.id, b.binder_ref from public.binders b join public.counterparties c on c.id in (b.mga_id, b.broker_id) where c.is_demo <> b.is_demo
    union all
    select 'submission ↔ binder', s.id, s.ref_no || ' ↔ ' || b.binder_ref from public.submissions s join public.binders b on b.id = s.binder_id where s.is_demo <> b.is_demo
    union all
    select 'bordereau ↔ binder', x.id, x.ref_no from public.bordereaux x join public.binders b on b.id = x.binder_id where x.is_demo <> b.is_demo
    union all
    select 'bordereau line ↔ bordereau', l.id, x.ref_no || ' line ' || l.line_no from public.bordereau_lines l join public.bordereaux x on x.id = l.bordereau_id where l.is_demo <> x.is_demo
    union all
    select 'template ↔ MGA', t.id, t.name from public.bordereau_templates t join public.counterparties c on c.id = t.mga_id where t.is_demo <> c.is_demo
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
    select 'name / number', c.id, c.claim_no from public.claims c where (c.claim_no like 'DEMO-%') <> c.is_demo
    union all
    select 'name / number', b.id, b.binder_ref from public.binders b where (b.binder_ref like 'DEMO-%') <> b.is_demo
    union all
    select 'name / number', x.id, x.ref_no from public.bordereaux x where (x.ref_no like 'DEMO-%') <> x.is_demo;
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

  -- bordereau lines point at claims
  delete from public.bordereau_lines where is_demo;       get diagnostics n = row_count; v_out := v_out || jsonb_build_object('bordereau_lines', n);
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
  delete from public.bordereaux where is_demo;            get diagnostics n = row_count; v_out := v_out || jsonb_build_object('bordereaux', n);
  delete from public.bordereau_templates where is_demo;   get diagnostics n = row_count; v_out := v_out || jsonb_build_object('bordereau_templates', n);
  delete from public.submissions where is_demo;           get diagnostics n = row_count; v_out := v_out || jsonb_build_object('submissions', n);
  delete from public.binder_lobs where is_demo;
  delete from public.binders where is_demo;               get diagnostics n = row_count; v_out := v_out || jsonb_build_object('binders', n);
  delete from public.counterparties where is_demo;        get diagnostics n = row_count; v_out := v_out || jsonb_build_object('counterparties', n);
  delete from public.ref_counters where scope like 'DEMO-%';

  perform set_config('app.demo_admin', 'off', true);
  return v_out || jsonb_build_object('document_paths', to_jsonb(v_paths));
end;
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
    'claim_payments', (select count(*) from public.claim_payments where is_demo),
    'binders',        (select count(*) from public.binders where is_demo),
    'bordereaux',     (select count(*) from public.bordereaux where is_demo),
    'bordereau_lines', (select count(*) from public.bordereau_lines where is_demo))
$$;

-- follow-ups show the binder's reference and MGA (same columns)
create or replace view public.follow_ups_v
with (security_invoker = true)
as
 SELECT f.id, f.entity_type, f.entity_id, f.type, f.title, f.due_at, f.assigned_to, f.done_at, f.done_by, f.outcome,
    f.created_at, f.created_by, f.updated_at,
        CASE f.entity_type
            WHEN 'submission'::public.entity_type THEN s.ref_no
            WHEN 'premium'::public.entity_type THEN ((s.ref_no || ' #'::text) || pi.installment_no)
            WHEN 'receipt'::public.entity_type THEN r.ref_no
            WHEN 'claim'::public.entity_type THEN cl.claim_no
            WHEN 'binder'::public.entity_type THEN bd.binder_ref
            ELSE NULL::text
        END AS entity_ref,
        CASE f.entity_type
            WHEN 'receipt'::public.entity_type THEN rp.name
            WHEN 'binder'::public.entity_type THEN mga.name
            ELSE s.insured_name
        END AS entity_label,
    s.status AS submission_status,
    coalesce(s.mga_id, bd.mga_id) AS mga_id,
    mga.name AS mga_name,
    s.offer_valid_until,
    COALESCE(a.full_name, a.email) AS assigned_to_name,
    COALESCE(d.full_name, d.email) AS done_by_name,
    ((f.done_at IS NULL) AND (f.due_at < now())) AS is_overdue,
        CASE
            WHEN ((f.done_at IS NULL) AND (f.due_at < now())) THEN (CURRENT_DATE - (f.due_at)::date)
            ELSE NULL::integer
        END AS days_overdue,
    f.assigned_role,
    s.id AS submission_id,
    pi.installment_no
   FROM public.follow_ups f
     LEFT JOIN public.premium_installments pi ON f.entity_type = 'premium'::public.entity_type AND pi.id = f.entity_id
     LEFT JOIN public.claims cl ON f.entity_type = 'claim'::public.entity_type AND cl.id = f.entity_id
     LEFT JOIN public.binders bd ON f.entity_type = 'binder'::public.entity_type AND bd.id = f.entity_id
     LEFT JOIN public.submissions s ON s.id =
        CASE f.entity_type
            WHEN 'submission'::public.entity_type THEN f.entity_id
            WHEN 'premium'::public.entity_type THEN pi.submission_id
            WHEN 'claim'::public.entity_type THEN cl.submission_id
            ELSE NULL::uuid
        END
     LEFT JOIN public.premium_receipts r ON f.entity_type = 'receipt'::public.entity_type AND r.id = f.entity_id
     LEFT JOIN public.counterparties rp ON rp.id = r.payer_id
     LEFT JOIN public.counterparties mga ON mga.id = coalesce(s.mga_id, bd.mga_id)
     LEFT JOIN public.profiles a ON a.id = f.assigned_to
     LEFT JOIN public.profiles d ON d.id = f.done_by;
