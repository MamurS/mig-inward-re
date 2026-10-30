-- Part E — whole-system audit: the database fixes.
--
-- 1. RLS speed. A bare is_app_user() / auth_role() / has_role(<roles>) in a
--    policy runs once per row (about 0.08 ms each: a second per 10,000 rows,
--    per table in the query). Written as a sub-select «(select f())» Postgres
--    runs it once per query. Every such policy in public and storage is
--    rewritten that way; the rules and their results do not change.
--    Measured with 10,000 submissions (rolled back): agenda 3.1 s → 0.07 s,
--    submissions register 3.9 s → 1.0 s (with the app no longer downloading
--    search_text). Row-dependent checks (can_write_entity(folder),
--    can_read_claims_of(id)…) stay as they are.
-- 2. Privileges. Supabase's default privileges gave anon and authenticated
--    TRUNCATE / TRIGGER / REFERENCES on five newer views (no data reachable —
--    views cannot be truncated and RLS applies — but «never grant to anon»).
--    Revoked, and the default privileges fixed so new tables and views never
--    get them again.
-- 3. Audit log on the reference data (countries, currencies, FX rates, lines
--    of business); the audit record id also understands code / currency+date keys.

-- 1 -----------------------------------------------------------------------
do $rw$
declare
  p record;
  q text;
  c text;
  pat constant text := '(?<!SELECT )(is_app_user\(\)|auth_role\(\)|has_role\(VARIADIC ARRAY\[[^\]]*\]\))';
begin
  perform set_config('search_path', 'public, extensions', true);
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and coalesce(qual, '') || coalesce(with_check, '') ~ pat
  loop
    q := regexp_replace(p.qual, pat, '( SELECT public.\1 )', 'g');
    c := regexp_replace(p.with_check, pat, '( SELECT public.\1 )', 'g');
    execute format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename)
      || case when q is not null then format(' using (%s)', q) else '' end
      || case when c is not null then format(' with check (%s)', c) else '' end;
  end loop;
end
$rw$;

-- 2 -----------------------------------------------------------------------
revoke all on public.ai_usage_v, public.binder_capacity_v, public.binders_v, public.claim_payments_v, public.claims_v from anon;
revoke truncate, trigger, references on public.ai_usage_v, public.binder_capacity_v, public.binders_v, public.claim_payments_v, public.claims_v from authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke truncate, trigger, references on tables from authenticated;

-- 3 -----------------------------------------------------------------------
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
      return null;
    end if;
  end if;

  v_id := coalesce(
    v_new ->> 'id', v_old ->> 'id', v_new ->> 'key', v_old ->> 'key', v_new ->> 'code', v_old ->> 'code',
    (coalesce(v_new, v_old) ->> 'currency') || '@' || (coalesce(v_new, v_old) ->> 'rate_date'));

  insert into public.audit_log (table_name, record_id, action, changed_fields, old_data, new_data, changed_by)
  values (tg_table_name, coalesce(v_id, '?'), tg_op, v_fields, v_old, v_new, auth.uid());
  return null;
end;
$$;
revoke execute on function public.audit_trigger() from public, anon, authenticated;

create trigger audit_countries after insert or update or delete on public.countries for each row execute function public.audit_trigger();
create trigger audit_currencies after insert or update or delete on public.currencies for each row execute function public.audit_trigger();
create trigger audit_fx_rates after insert or update or delete on public.fx_rates for each row execute function public.audit_trigger();
create trigger audit_lines_of_business after insert or update or delete on public.lines_of_business for each row execute function public.audit_trigger();
