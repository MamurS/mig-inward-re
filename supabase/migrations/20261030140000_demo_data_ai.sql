-- Phase D: «Delete all demo data» and the demo counts also cover the AI usage
-- log and the AI cache (rows written while the user was in Demo mode).
-- Same functions as in 20261030110100_binders.sql, two more tables.

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
  delete from public.ai_usage_log where is_demo;          get diagnostics n = row_count; v_out := v_out || jsonb_build_object('ai_usage', n);
  delete from public.ai_cache where is_demo;
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
    'bordereau_lines', (select count(*) from public.bordereau_lines where is_demo),
    'ai_usage',       (select count(*) from public.ai_usage_log where is_demo))
$$;

-- create or replace keeps the existing privileges (admin-checked RPC for
-- authenticated; demo_data_counts_all stays internal, behind demo_data_counts)
grant execute on function public.delete_demo_data() to authenticated;
