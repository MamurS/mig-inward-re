-- =====================================================================
-- Step 3: underwriters may add and edit counterparties (MGAs, brokers,
-- cedents). Deleting stays admin-only.
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
-- =====================================================================

drop policy counterparties_admin_insert on public.counterparties;
create policy counterparties_insert on public.counterparties
  for insert to authenticated
  with check (public.has_role('admin', 'underwriter'));

drop policy counterparties_admin_update on public.counterparties;
create policy counterparties_update on public.counterparties
  for update to authenticated
  using (public.has_role('admin', 'underwriter'))
  with check (public.has_role('admin', 'underwriter'));
