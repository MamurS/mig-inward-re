-- =====================================================================
-- Phase 0 / Step 2e: RLS performance tuning (Supabase advisor findings)
--  * auth.uid() wrapped in (select ...) so it is evaluated once per query
--  * admin "for all" policies split per action, so SELECT has one policy
--  * indexes on foreign keys used for filtering
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
-- =====================================================================

-- profiles
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_app_user());

drop policy profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- follow_ups
drop policy follow_ups_update on public.follow_ups;
create policy follow_ups_update on public.follow_ups
  for update to authenticated
  using (public.can_write_entity(entity_type::text) or (assigned_to = (select auth.uid()) and public.is_app_user()))
  with check (public.can_write_entity(entity_type::text) or (assigned_to = (select auth.uid()) and public.is_app_user()));

-- documents
drop policy documents_delete on public.documents;
create policy documents_delete on public.documents
  for delete to authenticated
  using (public.has_role('admin') or (uploaded_by = (select auth.uid()) and public.can_write_entity(entity_type::text)));

-- Reference tables: one SELECT policy (all app users) + admin-only writes
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('currencies', 'currencies_admin'),
      ('countries', 'countries_admin'),
      ('lines_of_business', 'lob_admin'),
      ('counterparties', 'counterparties_admin'),
      ('fx_rates', 'fx_rates_admin'),
      ('settings', 'settings_admin')
    ) v(tbl, pol)
  loop
    execute format('drop policy %I on public.%I', t.pol, t.tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_role(''admin''))', t.tbl || '_admin_insert', t.tbl);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_role(''admin'')) with check (public.has_role(''admin''))', t.tbl || '_admin_update', t.tbl);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_role(''admin''))', t.tbl || '_admin_delete', t.tbl);
  end loop;
end $$;

-- Foreign-key indexes used in filters / joins
create index if not exists submissions_currency_idx         on public.submissions (currency);
create index if not exists submissions_insured_country_idx  on public.submissions (insured_country);
create index if not exists counterparties_country_idx       on public.counterparties (country_code);
create index if not exists status_history_document_idx      on public.submission_status_history (document_id) where document_id is not null;
