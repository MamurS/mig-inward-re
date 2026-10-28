-- =====================================================================
-- Step 4: follow-up view, daily reminder job (pg_cron), job log
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
-- pg_cron is a standard extension (also in self-hosted Supabase images).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Follow-ups with what they belong to (generic: submissions now; premium,
-- claims later add their own joins here)
-- ---------------------------------------------------------------------
create view public.follow_ups_v
with (security_invoker = true)
as
select
  f.*,
  case f.entity_type when 'submission' then s.ref_no end       as entity_ref,
  case f.entity_type when 'submission' then s.insured_name end as entity_label,
  s.status                                                     as submission_status,
  s.mga_id,
  mga.name                                                     as mga_name,
  s.offer_valid_until,
  coalesce(a.full_name, a.email)                               as assigned_to_name,
  coalesce(d.full_name, d.email)                               as done_by_name,
  (f.done_at is null and f.due_at < now())                     as is_overdue,
  case when f.done_at is null and f.due_at < now()
       then (current_date - f.due_at::date) end                as days_overdue
from public.follow_ups f
left join public.submissions s on f.entity_type = 'submission' and s.id = f.entity_id
left join public.counterparties mga on mga.id = s.mga_id
left join public.profiles a on a.id = f.assigned_to
left join public.profiles d on d.id = f.done_by;

revoke all on public.follow_ups_v from anon, authenticated;
grant select on public.follow_ups_v to authenticated;

-- ---------------------------------------------------------------------
-- Job log (what the scheduled jobs did)
-- ---------------------------------------------------------------------
create table public.job_runs (
  id          bigint generated always as identity primary key,
  job         text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  result      jsonb,
  error       text,
  started_by  uuid references public.profiles (id)
);

create index job_runs_job_idx on public.job_runs (job, started_at desc);

alter table public.job_runs enable row level security;
create policy job_runs_select on public.job_runs
  for select to authenticated using (public.has_role('admin', 'management'));

revoke all on public.job_runs from anon, authenticated;
grant select on public.job_runs to authenticated;

-- ---------------------------------------------------------------------
-- Daily job
--  1. if enabled: offers older than auto_no_response_days → no_response
--  2. offered submissions with no open follow-up → next request_update
--     (due follow_up_repeat_days after the last closed one, not before now)
--  3. offers past offer_valid_until → one "offer_expiry" follow-up
-- ---------------------------------------------------------------------
create or replace function public.run_daily_follow_ups()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_repeat    int     := public.setting_int('follow_up_repeat_days', 7);
  v_auto      boolean := public.setting_bool('auto_no_response_enabled', false);
  v_auto_days int     := public.setting_int('auto_no_response_days', 30);
  v_run       bigint;
  v_noresp    int := 0;
  v_repeats   int := 0;
  v_expiry    int := 0;
  v_result    jsonb;
  r           record;
begin
  insert into public.job_runs (job, started_by) values ('daily_follow_ups', auth.uid()) returning id into v_run;

  begin
    if v_auto then
      for r in
        select s.id from public.submissions s
         where s.status = 'offered' and s.offered_at < now() - make_interval(days => v_auto_days)
      loop
        perform public.apply_submission_status(
          r.id, 'no_response', null,
          format('Automatically set: no answer %s days after the offer', v_auto_days));
        v_noresp := v_noresp + 1;
      end loop;
    end if;

    insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_to, created_by)
    select 'submission', s.id, 'request_update', 'Request update on offer',
           greatest(now(),
                    coalesce((select max(f.done_at) from public.follow_ups f
                               where f.entity_type = 'submission' and f.entity_id = s.id),
                             s.offered_at, now())
                    + make_interval(days => v_repeat)),
           s.underwriter_id, null
      from public.submissions s
     where s.status = 'offered'
       and not exists (select 1 from public.follow_ups f
                        where f.entity_type = 'submission' and f.entity_id = s.id and f.done_at is null);
    get diagnostics v_repeats = row_count;

    insert into public.follow_ups (entity_type, entity_id, type, title, due_at, assigned_to, created_by)
    select 'submission', s.id, 'offer_expiry', 'Offer validity has passed',
           s.offer_valid_until::timestamptz, s.underwriter_id, null
      from public.submissions s
     where s.status = 'offered'
       and s.offer_valid_until < current_date
       and not exists (select 1 from public.follow_ups f
                        where f.entity_type = 'submission' and f.entity_id = s.id
                          and f.type = 'offer_expiry' and f.created_at >= coalesce(s.offered_at, s.created_at));
    get diagnostics v_expiry = row_count;

    v_result := jsonb_build_object('moved_to_no_response', v_noresp, 'repeat_follow_ups', v_repeats, 'expiry_flags', v_expiry);
    update public.job_runs set finished_at = now(), result = v_result where id = v_run;
  exception when others then
    update public.job_runs set finished_at = now(), error = sqlerrm where id = v_run;
    v_result := jsonb_build_object('error', sqlerrm);
  end;

  return v_result;
end;
$$;

-- Admin "run now" button
create or replace function public.run_daily_follow_ups_now()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Only admins can run jobs' using errcode = '42501';
  end if;
  return public.run_daily_follow_ups();
end;
$$;

revoke execute on function public.run_daily_follow_ups()     from public, anon, authenticated;
revoke execute on function public.run_daily_follow_ups_now() from public, anon;
grant  execute on function public.run_daily_follow_ups_now() to authenticated;

-- ---------------------------------------------------------------------
-- Schedule: every day 03:15 UTC (08:15 Tashkent)
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('daily-follow-ups', '15 3 * * *', 'select public.run_daily_follow_ups()');
  end if;
end $$;
