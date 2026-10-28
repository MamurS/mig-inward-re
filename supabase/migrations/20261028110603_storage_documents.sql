-- =====================================================================
-- Phase 0 / Step 2d: private Storage bucket for documents
-- Object path: <entity_type>/<entity_id>/<uuid>-<file name>
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
-- Uses only the standard storage schema (works on self-hosted Supabase).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800) -- 50 MB per file
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Read: any active user with a role
create policy documents_bucket_select on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and public.is_app_user());

-- Upload: role allowed to write the entity type in the first path segment
create policy documents_bucket_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.can_write_entity((storage.foldername(name))[1]));

-- Delete: admins, or the uploader if still allowed to write that entity type
create policy documents_bucket_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (public.has_role('admin')
         or (owner_id = auth.uid()::text and public.can_write_entity((storage.foldername(name))[1])))
  );
