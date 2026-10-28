-- =====================================================================
-- Step 6 self-review: Supabase Cloud's "automatic RLS" setting installs
-- public.rls_auto_enable() (an event-trigger helper) that anon and
-- authenticated could call over the API. Nobody needs to call it directly.
-- Guarded so this migration is a no-op on self-hosted Supabase.
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
