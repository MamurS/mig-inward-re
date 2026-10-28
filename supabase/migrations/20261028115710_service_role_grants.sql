-- =====================================================================
-- Server-side access for the service_role (edge functions, maintenance).
-- This project does not auto-expose new objects, so service_role did not get
-- Supabase's usual default grants. service_role is only used server-side
-- (e.g. the admin-users edge function) and is never shipped to the browser.
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
-- =====================================================================

grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Objects created by later migrations get the same server-side access
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
