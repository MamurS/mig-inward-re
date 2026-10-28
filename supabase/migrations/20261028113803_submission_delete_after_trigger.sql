-- =====================================================================
-- Fix: delete a submission's follow-ups AFTER the submission row is gone
-- (doing it BEFORE re-updated the row being deleted via refresh_next_follow_up).
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
-- =====================================================================

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
  return old;
end;
$$;

create or replace function public.submissions_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follow_ups f where f.entity_type = 'submission' and f.entity_id = old.id;
  return null;
end;
$$;

create trigger submissions_after_delete
after delete on public.submissions
for each row execute function public.submissions_after_delete();

revoke execute on function public.submissions_after_delete() from public, anon, authenticated;
