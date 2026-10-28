-- Removes everything created by supabase/seed.sql (rows marked DEMO / source 'demo').
-- Run in the SQL editor before going live. Storage files of demo submissions
-- (if any were uploaded) must be deleted from the "documents" bucket separately.
begin;
delete from public.follow_ups where entity_type = 'submission'
  and entity_id in (select id from public.submissions where notes = 'DEMO');
delete from public.documents where entity_type = 'submission'
  and entity_id in (select id from public.submissions where notes = 'DEMO');
delete from public.submissions where notes = 'DEMO';            -- status history cascades
delete from public.counterparties where notes = 'DEMO';
delete from public.fx_rates where source = 'demo';
delete from public.ref_counters where scope = 'SUB'
  and not exists (select 1 from public.submissions);            -- restart numbering only if nothing is left
commit;
