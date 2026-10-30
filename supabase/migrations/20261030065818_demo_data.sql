-- Demo data in the production project (there is no staging), kept apart safely.
--
-- 1. Every business table gets is_demo (counterparties, submissions,
--    premium_installments, premium_receipts, premium_allocations, follow_ups,
--    documents). Existing rows are real (false).
-- 2. Each user has a demo-mode switch (profiles.ui_demo_mode). A RESTRICTIVE
--    row-level policy on every business table lets a user see and write only
--    rows whose is_demo equals their mode — so lists, search, dashboard totals,
--    exports and every view (security_invoker) follow it without exception.
-- 3. A guard trigger keeps the two worlds apart: children take the flag of
--    what they belong to (installment ← submission, allocation ← receipt,
--    follow-up / document ← its record); a submission / receipt can only use
--    counterparties of the same kind; an allocation can only pay an
--    installment of the same kind; is_demo never changes; a user can only
--    write rows of their current mode, also through SECURITY DEFINER RPCs.
-- 4. Demo names start with «DEMO » (counterparties, insured), demo numbers
--    with DEMO- (DEMO-SUB-…, DEMO-RCP-…): own counters, never the real ones.
-- 5. Daily jobs ignore demo rows (no follow-ups, no automatic status moves).
-- 6. Admin only: delete_demo_data(), seed_demo_data() (next migration),
--    demo_link_violations() (proves nothing real and demo is linked).

-- ---------------------------------------------------------------------
-- The switch
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists ui_demo_mode boolean not null default false;
grant update (ui_demo_mode) on public.profiles to authenticated;

-- The caller's own demo mode (false for the system: jobs, triggers without a user).
create or replace function public.demo_mode()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.ui_demo_mode from public.profiles p where p.id = auth.uid()), false)
$$;
revoke execute on function public.demo_mode() from public, anon;
grant execute on function public.demo_mode() to authenticated;

-- ---------------------------------------------------------------------
-- The flag
-- ---------------------------------------------------------------------
alter table public.counterparties       add column if not exists is_demo boolean not null default false;
alter table public.submissions          add column if not exists is_demo boolean not null default false;
alter table public.premium_installments add column if not exists is_demo boolean not null default false;
alter table public.premium_receipts     add column if not exists is_demo boolean not null default false;
alter table public.premium_allocations  add column if not exists is_demo boolean not null default false;
alter table public.follow_ups           add column if not exists is_demo boolean not null default false;
alter table public.documents            add column if not exists is_demo boolean not null default false;

-- New rows default to the writer's mode (children are then set from their parent by the guard)
alter table public.counterparties       alter column is_demo set default public.demo_mode();
alter table public.submissions          alter column is_demo set default public.demo_mode();
alter table public.premium_installments alter column is_demo set default public.demo_mode();
alter table public.premium_receipts     alter column is_demo set default public.demo_mode();
alter table public.premium_allocations  alter column is_demo set default public.demo_mode();
alter table public.follow_ups           alter column is_demo set default public.demo_mode();
alter table public.documents            alter column is_demo set default public.demo_mode();

create index if not exists counterparties_is_demo_idx on public.counterparties (is_demo);
create index if not exists submissions_is_demo_idx    on public.submissions (is_demo);
create index if not exists premium_installments_is_demo_idx on public.premium_installments (is_demo);
create index if not exists premium_receipts_is_demo_idx     on public.premium_receipts (is_demo);
create index if not exists follow_ups_is_demo_idx           on public.follow_ups (is_demo);

-- Recognisable in any screenshot or export
alter table public.counterparties add constraint counterparties_demo_name_chk check ((name like 'DEMO %') = is_demo);
alter table public.submissions    add constraint submissions_demo_name_chk    check ((insured_name like 'DEMO %') = is_demo);
alter table public.submissions    add constraint submissions_demo_ref_chk     check ((ref_no like 'DEMO-%') = is_demo);
alter table public.premium_receipts add constraint premium_receipts_demo_ref_chk check ((ref_no like 'DEMO-%') = is_demo);

-- Is the record a follow-up / document belongs to demo? (null: not found)
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
  end
$$;
revoke execute on function public.entity_is_demo(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- The guard
-- ---------------------------------------------------------------------
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

-- «zz_» so it runs after the tables' own BEFORE triggers (numbering, audit columns)
create trigger zz_demo_guard before insert or update or delete on public.counterparties       for each row execute function public.demo_guard();
create trigger zz_demo_guard before insert or update or delete on public.submissions          for each row execute function public.demo_guard();
create trigger zz_demo_guard before insert or update or delete on public.premium_installments for each row execute function public.demo_guard();
create trigger zz_demo_guard before insert or update or delete on public.premium_receipts     for each row execute function public.demo_guard();
create trigger zz_demo_guard before insert or update or delete on public.premium_allocations  for each row execute function public.demo_guard();
create trigger zz_demo_guard before insert or update or delete on public.follow_ups           for each row execute function public.demo_guard();
create trigger zz_demo_guard before insert or update or delete on public.documents            for each row execute function public.demo_guard();

-- ---------------------------------------------------------------------
-- Numbering: demo rows have their own counters (DEMO-SUB-…, DEMO-RCP-…)
-- ---------------------------------------------------------------------
create or replace function public.submissions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ref_no is null then
    new.ref_no := public.next_ref_no(case when new.is_demo then 'DEMO-SUB' else 'SUB' end, extract(year from new.received_at)::int);
  end if;
  new.created_by := coalesce(new.created_by, auth.uid());
  new.updated_by := coalesce(new.updated_by, auth.uid());
  new.underwriter_id := coalesce(new.underwriter_id, auth.uid());
  new.status_changed_at := coalesce(new.status_changed_at, now());
  return new;
end;
$$;

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
    new.ref_no := public.next_ref_no(case when new.is_demo then 'DEMO-RCP' else 'RCP' end, extract(year from new.received_date)::int);
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

-- ---------------------------------------------------------------------
-- Who sees what: one restrictive policy per business table
-- ---------------------------------------------------------------------
create policy counterparties_demo       on public.counterparties       as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));
create policy submissions_demo          on public.submissions          as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));
create policy premium_installments_demo on public.premium_installments as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));
create policy premium_receipts_demo     on public.premium_receipts     as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));
create policy premium_allocations_demo  on public.premium_allocations  as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));
create policy follow_ups_demo           on public.follow_ups           as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));
create policy documents_demo            on public.documents            as restrictive for all to authenticated using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));
-- status history has no flag of its own: it shows only for submissions the user can see
create policy submission_status_history_demo on public.submission_status_history as restrictive for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id));

-- ---------------------------------------------------------------------
-- Daily jobs: real rows only
-- ---------------------------------------------------------------------
create or replace function public.run_daily_follow_ups()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_repeat    int     := public.setting_int('follow_up_repeat_days', 7);
  v_auto      boolean := public.setting_bool('auto_no_response_enabled', false);
  v_auto_days int     := public.setting_int('auto_no_response_days', 30);
  v_run       bigint;
  v_noresp    int := 0;
  v_repeats   int := 0;
  v_expiry    int := 0;
  v_result    jsonb;
  r           record;
begin
  insert into public.job_runs (job, started_by) values ('daily_follow_ups', auth.uid()) returning id into v_run;

  begin
    if v_auto then
      for r in
        select s.id from public.submissions s
         where s.status = 'offered' and not s.is_demo and s.offered_at < now() - make_interval(days => v_auto_days)
      loop
        perform public.apply_submission_status(
          r.id, 'no_response', null,
          format('Automatically set: no answer %s days after the offer', v_auto_days));
        v_noresp := v_noresp + 1;
      end loop;
    end if;

    insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_to, created_by, is_demo)
    select 'submission', s.id, 'request_update', 'Request update on offer',
           greatest(now(),
                    coalesce((select max(f.done_at) from public.follow_ups f
                               where f.entity_type = 'submission' and f.entity_id = s.id),
                             s.offered_at, now())
                    + make_interval(days => v_repeat)),
           s.underwriter_id, null, false
      from public.submissions s
     where s.status = 'offered'
       and not s.is_demo
       and not exists (select 1 from public.follow_ups f
                        where f.entity_type = 'submission' and f.entity_id = s.id and f.done_at is null);
    get diagnostics v_repeats = row_count;

    insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_to, created_by, is_demo)
    select 'submission', s.id, 'offer_expiry', 'Offer validity has passed',
           s.offer_valid_until::timestamptz, s.underwriter_id, null, false
      from public.submissions s
     where s.status = 'offered'
       and not s.is_demo
       and s.offer_valid_until < current_date
       and not exists (select 1 from public.follow_ups f
                        where f.entity_type = 'submission' and f.entity_id = s.id
                          and f.type = 'offer_expiry' and f.created_at >= coalesce(s.offered_at, s.created_at));
    get diagnostics v_expiry = row_count;

    v_result := jsonb_build_object('moved_to_no_response', v_noresp, 'repeat_follow_ups', v_repeats, 'expiry_flags', v_expiry);
    update public.job_runs set finished_at = now(), result = v_result where id = v_run;
  exception when others then
    update public.job_runs set finished_at = now(), error = sqlerrm where id = v_run;
    v_result := jsonb_build_object('error', sqlerrm);
  end;

  return v_result;
end;
$$;

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
    insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_role, created_by, is_demo)
    select 'premium', i.id, 'premium_overdue', 'Premium overdue',
           greatest(now(),
                    coalesce((select max(f.done_at) + make_interval(days => v_repeat) from public.follow_ups f
                               where f.entity_type = 'premium' and f.entity_id = i.id and f.type = 'premium_overdue'),
                             now())),
           'finance', null, false
      from public.premium_installments i
     where i.type <> 'return'
       and not i.is_demo
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

-- ---------------------------------------------------------------------
-- Proof that the worlds never touch (admin): one row per violation; empty = clean
-- ---------------------------------------------------------------------
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
     where (s.insured_name like 'DEMO %') <> s.is_demo or (s.ref_no like 'DEMO-%') <> s.is_demo;
end;
$$;
revoke execute on function public.demo_link_violations() from public, anon;
grant execute on function public.demo_link_violations() to authenticated;

-- ---------------------------------------------------------------------
-- Delete all demo data (admin). Returns counts and the storage paths of
-- deleted demo documents (the app removes those files through the Storage API).
-- ---------------------------------------------------------------------
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

  delete from public.premium_allocations where is_demo;   get diagnostics n = row_count; v_out := v_out || jsonb_build_object('allocations', n);
  delete from public.premium_receipts where is_demo;      get diagnostics n = row_count; v_out := v_out || jsonb_build_object('receipts', n);
  delete from public.follow_ups where is_demo;            get diagnostics n = row_count; v_out := v_out || jsonb_build_object('follow_ups', n);
  -- evidence links first, then the documents themselves
  delete from public.submission_status_history h using public.submissions s where s.id = h.submission_id and s.is_demo;
  delete from public.documents where is_demo;             get diagnostics n = row_count; v_out := v_out || jsonb_build_object('documents', n);
  delete from public.premium_installments where is_demo;  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('installments', n);
  delete from public.submissions where is_demo;           get diagnostics n = row_count; v_out := v_out || jsonb_build_object('submissions', n);
  delete from public.counterparties where is_demo;        get diagnostics n = row_count; v_out := v_out || jsonb_build_object('counterparties', n);
  delete from public.ref_counters where scope like 'DEMO-%';

  perform set_config('app.demo_admin', 'off', true);
  return v_out || jsonb_build_object('document_paths', to_jsonb(v_paths));
end;
$$;
revoke execute on function public.delete_demo_data() from public, anon;
grant execute on function public.delete_demo_data() to authenticated;

-- Is there any demo data? (admin page: show the actions) — counts only, no rows
create or replace function public.demo_data_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.has_role('admin') then jsonb_build_object(
    'counterparties', (select count(*) from public.counterparties where is_demo),
    'submissions',    (select count(*) from public.submissions where is_demo),
    'installments',   (select count(*) from public.premium_installments where is_demo),
    'receipts',       (select count(*) from public.premium_receipts where is_demo),
    'follow_ups',     (select count(*) from public.follow_ups where is_demo)) end
$$;
revoke execute on function public.demo_data_counts() from public, anon;
grant execute on function public.demo_data_counts() to authenticated;
