-- Phase D — AI-assisted data entry. Additive: two settings, a usage log and a
-- result cache. The Edge Function `ai-extract` writes both tables with the
-- service role; users read their own usage, admins read everything.
-- Provider, model, endpoint and API key live in Edge Function secrets only
-- (AI_PROVIDER, AI_MODEL, ANTHROPIC_API_KEY, OLLAMA_BASE_URL, OLLAMA_API_KEY),
-- never here and never in the browser.

insert into public.settings (key, value, description) values
  ('ai_enabled', 'false'::jsonb, 'AI-assisted data entry on or off (needs the provider key in the Edge Function secrets)'),
  ('ai_roles', '["admin", "underwriter", "finance", "claims"]'::jsonb, 'Roles that may use AI-assisted data entry'),
  ('ai_daily_limit', '100'::jsonb, 'AI requests per user per day (cached answers do not count)')
on conflict (key) do nothing;

create table public.ai_usage_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles (id),
  kind          text not null check (kind in ('submission', 'bordereau_mapping')),
  provider      text,
  model         text,
  status        text not null check (status in ('ok', 'cached', 'error', 'refused', 'limit', 'disabled', 'too_big')),
  file_name     text,
  file_bytes    int,
  file_sha256   text,
  input_tokens  int,
  output_tokens int,
  duration_ms   int,
  error         text,
  created_at    timestamptz not null default now(),
  is_demo       boolean not null default public.demo_mode()
);
comment on table public.ai_usage_log is 'Every AI-assisted extraction: who, what, which model, tokens, outcome (written by the ai-extract Edge Function)';
create index ai_usage_log_user_idx on public.ai_usage_log (user_id, created_at desc);
create index ai_usage_log_created_idx on public.ai_usage_log (created_at desc);

create table public.ai_cache (
  cache_key   text not null,
  is_demo     boolean not null default false,
  kind        text not null,
  model       text not null,
  result      jsonb not null,
  hits        int not null default 0,
  created_at  timestamptz not null default now(),
  last_hit_at timestamptz,
  primary key (cache_key, is_demo)
);
comment on table public.ai_cache is 'AI extraction results by content hash + kind + model + prompt version, so the same file is never sent twice';

alter table public.ai_usage_log enable row level security;
alter table public.ai_cache     enable row level security;

create policy ai_usage_log_select on public.ai_usage_log for select to authenticated
  using (public.has_role('admin') or user_id = auth.uid());
create policy ai_cache_select on public.ai_cache for select to authenticated using (public.has_role('admin'));
create policy ai_usage_log_demo on public.ai_usage_log as restrictive for all to authenticated
  using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));
create policy ai_cache_demo on public.ai_cache as restrictive for all to authenticated
  using (is_demo = (select public.demo_mode())) with check (is_demo = (select public.demo_mode()));

revoke all on public.ai_usage_log, public.ai_cache from anon, authenticated;
grant select on public.ai_usage_log, public.ai_cache to authenticated;
grant all on public.ai_usage_log, public.ai_cache to service_role;

-- the demo guard: rows never move between worlds (the function sets is_demo from the caller's mode)
create trigger zz_demo_guard before insert or update or delete on public.ai_usage_log for each row execute function public.demo_guard();
create trigger zz_demo_guard before insert or update or delete on public.ai_cache     for each row execute function public.demo_guard();

create trigger audit_ai_usage_log after insert or update or delete on public.ai_usage_log for each row execute function public.audit_trigger();
create trigger audit_ai_cache     after insert or update or delete on public.ai_cache     for each row execute function public.audit_trigger();

-- the usage log with the user's name, for Admin › AI
create or replace view public.ai_usage_v
with (security_invoker = true)
as
select l.id, l.user_id, coalesce(p.full_name, p.email) as user_name, p.role as user_role, l.kind, l.provider, l.model, l.status,
       l.file_name, l.file_bytes, l.input_tokens, l.output_tokens, l.duration_ms, l.error, l.created_at,
       public.search_norm(concat_ws(' ', p.full_name, p.email, l.kind, l.model, l.status, l.file_name, l.error)) as search_text
  from public.ai_usage_log l
  left join public.profiles p on p.id = l.user_id;
grant select on public.ai_usage_v to authenticated;

-- may this user use AI now? (the screens show or hide the buttons; the function checks again)
create or replace function public.ai_available()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select (value)::text::boolean from public.settings where key = 'ai_enabled'), false)
     and coalesce((select value ? (public.auth_role())::text from public.settings where key = 'ai_roles'), false)
$$;
revoke execute on function public.ai_available() from public, anon;
grant execute on function public.ai_available() to authenticated;
