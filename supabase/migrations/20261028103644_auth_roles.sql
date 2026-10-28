-- =====================================================================
-- Phase 0 / Step 1: users, roles and shared helpers
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
-- Portable: standard Postgres + Supabase auth schema only.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------
create type public.app_role as enum ('admin', 'underwriter', 'finance', 'claims', 'management');

-- ---------------------------------------------------------------------
-- Profiles: one row per auth user. role IS NULL = no access yet
-- (a freshly created login sees nothing until an admin assigns a role).
-- ---------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  email              text not null,
  full_name          text,
  role               public.app_role,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'ru', 'uz')),
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.profiles is 'Application users. role NULL or active=false means no data access.';

-- ---------------------------------------------------------------------
-- Generic updated_at trigger (reused by later tables)
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Auto-create a profile when an auth user is created
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep profile email in sync if it changes in auth
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------
-- Role helpers used by every RLS policy.
-- SECURITY DEFINER so policies on profiles do not recurse.
-- ---------------------------------------------------------------------
create or replace function public.auth_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.active
$$;

create or replace function public.has_role(variadic roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.auth_role() = any (roles), false)
$$;

-- Any active user with an assigned role
create or replace function public.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.auth_role() is not null
$$;

-- ---------------------------------------------------------------------
-- Admin RPC: change a user's role / active flag / name
-- ---------------------------------------------------------------------
create or replace function public.admin_update_user(
  p_user_id   uuid,
  p_role      public.app_role,
  p_active    boolean,
  p_full_name text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.profiles;
begin
  if not public.has_role('admin') then
    raise exception 'Only admins can manage users' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() and (p_role is distinct from 'admin' or not p_active) then
    raise exception 'You cannot remove your own admin access' using errcode = '42501';
  end if;

  update public.profiles
     set role      = p_role,
         active    = p_active,
         full_name = coalesce(p_full_name, full_name)
   where id = p_user_id
  returning * into v_row;

  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Users always see their own row (needed to show "no access yet");
-- users with a role see everyone (underwriter names, assignment lists).
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_app_user());

-- Users may edit their own name / language (column grants below limit which columns).
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- Grants (project does not auto-expose new objects)
-- ---------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, preferred_language) on public.profiles to authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;

revoke execute on function public.auth_role() from public, anon;
revoke execute on function public.has_role(public.app_role[]) from public, anon;
revoke execute on function public.is_app_user() from public, anon;
revoke execute on function public.admin_update_user(uuid, public.app_role, boolean, text) from public, anon;

grant execute on function public.auth_role() to authenticated;
grant execute on function public.has_role(public.app_role[]) to authenticated;
grant execute on function public.is_app_user() to authenticated;
grant execute on function public.admin_update_user(uuid, public.app_role, boolean, text) to authenticated;

grant usage on type public.app_role to authenticated;
