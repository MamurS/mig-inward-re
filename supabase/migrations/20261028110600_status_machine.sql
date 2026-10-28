-- =====================================================================
-- Phase 0 / Step 2c: submission status machine
--   received     → under_review
--   under_review → declined | offered
--   offered      → bound | ntu | no_response
--   no_response  → bound | ntu          (late answer arrives)
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
-- =====================================================================

create or replace function public.submission_next_statuses(p_from public.submission_status)
returns public.submission_status[]
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'received'     then array['under_review']::public.submission_status[]
    when 'under_review' then array['declined', 'offered']::public.submission_status[]
    when 'offered'      then array['bound', 'ntu', 'no_response']::public.submission_status[]
    when 'no_response'  then array['bound', 'ntu']::public.submission_status[]
    else array[]::public.submission_status[]
  end
$$;

-- Internal worker. p_actor is NULL for system jobs (pg_cron).
create or replace function public.apply_submission_status(
  p_submission_id     uuid,
  p_to_status         public.submission_status,
  p_actor             uuid,
  p_comment           text    default null,
  p_written_share_pct numeric default null,
  p_offer_valid_until date    default null,
  p_signed_share_pct  numeric default null,
  p_document_id       uuid    default null
)
returns public.submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  s          public.submissions;
  v_comment  text := nullif(trim(coalesce(p_comment, '')), '');
  v_written  numeric(9, 6);
  v_valid    date;
  v_signed   numeric(9, 6);
  v_first    int;
  v_from     public.submission_status;
begin
  select * into s from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  if not (p_to_status = any (public.submission_next_statuses(s.status))) then
    raise exception 'Status change % → % is not allowed', s.status, p_to_status using errcode = '23514';
  end if;

  v_from    := s.status;
  v_written := coalesce(p_written_share_pct, s.written_share_pct);
  v_valid   := coalesce(p_offer_valid_until, s.offer_valid_until);
  v_signed  := s.signed_share_pct;

  -- Rules per target status
  if p_to_status = 'offered' then
    if v_written is null or v_written <= 0 or v_written > 100 then
      raise exception 'An offer needs a written share above 0 %% and at most 100 %%' using errcode = '23514';
    end if;
    if v_valid is null then
      raise exception 'An offer needs an "offer valid until" date' using errcode = '23514';
    end if;
  elsif p_to_status = 'bound' then
    v_signed := p_signed_share_pct;
    if v_signed is null or v_signed <= 0 then
      raise exception 'Binding needs a signed share above 0 %%' using errcode = '23514';
    end if;
    if v_signed > v_written then
      raise exception 'Signed share (%) cannot exceed written share (%)', v_signed, v_written using errcode = '23514';
    end if;
  elsif p_to_status in ('declined', 'ntu') then
    if v_comment is null then
      raise exception 'A reason is required for %', p_to_status using errcode = '23514';
    end if;
  end if;

  if p_document_id is not null
     and not exists (select 1 from public.documents d
                      where d.id = p_document_id and d.entity_type = 'submission' and d.entity_id = s.id) then
    raise exception 'The confirmation document does not belong to this submission' using errcode = '23514';
  end if;

  -- Apply (the update trigger only lets status change while this flag is on)
  perform set_config('app.status_change', 'on', true);

  update public.submissions
     set status            = p_to_status,
         written_share_pct = v_written,
         offer_valid_until = v_valid,
         signed_share_pct  = v_signed,
         decision_reason   = case when p_to_status in ('declined', 'ntu') then v_comment else decision_reason end,
         status_changed_at = now(),
         offered_at        = case when p_to_status = 'offered' then now() else offered_at end,
         bound_at          = case when p_to_status = 'bound' then now() else bound_at end,
         updated_by        = coalesce(p_actor, updated_by)
   where id = s.id
  returning * into s;

  perform set_config('app.status_change', 'off', true);

  insert into public.submission_status_history
    (submission_id, from_status, to_status, written_share_pct, signed_share_pct, comment, document_id, changed_by)
  values
    (s.id, v_from, p_to_status, s.written_share_pct, s.signed_share_pct, v_comment, p_document_id, p_actor);

  -- Reminders
  if p_to_status = 'offered' then
    v_first := public.setting_int('follow_up_first_days', 7);
    insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_to, created_by)
    values ('submission', s.id, 'request_update', 'Request update on offer',
            now() + make_interval(days => v_first), coalesce(s.underwriter_id, p_actor), p_actor);
  elsif p_to_status in ('bound', 'ntu', 'declined', 'no_response') then
    update public.follow_ups
       set done_at = now(),
           done_by = p_actor,
           outcome = format('Closed automatically: status changed to %s', p_to_status)
     where entity_type = 'submission' and entity_id = s.id and done_at is null
       and type in ('request_update', 'offer_expiry');
  end if;

  return s;
end;
$$;

-- Public RPC used by the app (underwriters and admins)
create or replace function public.change_submission_status(
  p_submission_id     uuid,
  p_to_status         public.submission_status,
  p_comment           text    default null,
  p_written_share_pct numeric default null,
  p_offer_valid_until date    default null,
  p_signed_share_pct  numeric default null,
  p_document_id       uuid    default null
)
returns public.submissions
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin', 'underwriter') then
    raise exception 'Only underwriters and admins can change a submission status' using errcode = '42501';
  end if;
  return public.apply_submission_status(
    p_submission_id, p_to_status, auth.uid(), p_comment,
    p_written_share_pct, p_offer_valid_until, p_signed_share_pct, p_document_id);
end;
$$;

-- Record the initial "received" history entry automatically on insert.
create or replace function public.submissions_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.submission_status_history (submission_id, from_status, to_status, written_share_pct, comment, changed_by, changed_at)
  values (new.id, null, new.status, new.written_share_pct, 'Submission registered', new.created_by, new.created_at);
  return null;
end;
$$;

create trigger submissions_after_insert
after insert on public.submissions
for each row execute function public.submissions_after_insert();

-- Grants
revoke execute on function public.submission_next_statuses(public.submission_status) from public, anon;
grant  execute on function public.submission_next_statuses(public.submission_status) to authenticated;

revoke execute on function public.apply_submission_status(uuid, public.submission_status, uuid, text, numeric, date, numeric, uuid)
  from public, anon, authenticated;

revoke execute on function public.change_submission_status(uuid, public.submission_status, text, numeric, date, numeric, uuid)
  from public, anon;
grant  execute on function public.change_submission_status(uuid, public.submission_status, text, numeric, date, numeric, uuid)
  to authenticated;

revoke execute on function public.submissions_after_insert() from public, anon, authenticated;
