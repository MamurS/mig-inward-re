-- =====================================================================
-- Step 3 fixes found in end-to-end testing
-- 1. A document used as confirmation evidence in the (append-only) status
--    history cannot be deleted — clear error instead of a trigger failure.
-- 2. Deleting a submission (admin only) also deletes its follow-ups and is
--    refused while documents are still attached (their files must be removed
--    through the Storage API first).
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
-- =====================================================================

alter table public.submission_status_history
  drop constraint submission_status_history_document_id_fkey,
  add constraint submission_status_history_document_id_fkey
    foreign key (document_id) references public.documents (id) on delete restrict;

create or replace function public.documents_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.submission_status_history h where h.document_id = old.id) then
    raise exception 'This document is the confirmation evidence of a status change and cannot be deleted'
      using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger documents_before_delete
before delete on public.documents
for each row execute function public.documents_before_delete();

create or replace function public.submissions_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.documents d where d.entity_type = 'submission' and d.entity_id = old.id) then
    raise exception 'Delete the documents of % before deleting it', old.ref_no using errcode = '23503';
  end if;
  delete from public.follow_ups f where f.entity_type = 'submission' and f.entity_id = old.id;
  return old;
end;
$$;

create trigger submissions_before_delete
before delete on public.submissions
for each row execute function public.submissions_before_delete();

revoke execute on function public.documents_before_delete()   from public, anon, authenticated;
revoke execute on function public.submissions_before_delete() from public, anon, authenticated;
