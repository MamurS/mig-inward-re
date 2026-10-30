-- Phase C (binders and bordereaux), migration 1: types and enum values only.
create type public.binder_status as enum ('draft', 'active', 'expired', 'cancelled');
create type public.bordereau_kind as enum ('risk', 'premium', 'claims');
create type public.bordereau_frequency as enum ('monthly', 'quarterly');
create type public.bordereau_line_status as enum ('ok', 'warning');

alter type public.entity_type add value if not exists 'binder';
alter type public.follow_up_type add value if not exists 'bordereau_missing';
alter type public.follow_up_type add value if not exists 'capacity_alert';

grant usage on type public.binder_status, public.bordereau_kind, public.bordereau_frequency, public.bordereau_line_status to authenticated;
