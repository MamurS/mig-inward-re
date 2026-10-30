-- Phase D — AI-assisted entry: who may use it, who reads the usage log, the
-- cache stays with admins, demo isolation. One DO block that always ends in an
-- exception: nothing it does is kept. Needs no real account: every identity is a test user created inside the rolled-back transaction.
-- Usage: paste into the SQL editor and run; the error text reads
-- «ROLLBACK OK: …» with each check, or «FAIL …» naming the broken one.
do $t$
declare
  adm uuid; uw uuid := gen_random_uuid(); uw2 uuid := gen_random_uuid(); mg uuid := gen_random_uuid(); n int; ok text := '';
begin
  -- a test admin of our own (never a real account): created here, gone with the rollback
  adm := gen_random_uuid();
  insert into auth.users (id, email, aud, role) values (adm, 'at-admin@example.com', 'authenticated', 'authenticated');
  update public.profiles set role = 'admin', active = true, ui_demo_mode = false where id = adm;
  insert into auth.users (id, email, aud, role) values
    (uw, 'at-uw@example.com', 'authenticated', 'authenticated'), (uw2, 'at-uw2@example.com', 'authenticated', 'authenticated'),
    (mg, 'at-mgmt@example.com', 'authenticated', 'authenticated');
  update public.profiles set role = 'underwriter', active = true, ui_demo_mode = false where id in (uw, uw2);
  update public.profiles set role = 'management', active = true, ui_demo_mode = false where id = mg;

  -- 1. ai_available follows the switch and the roles
  update public.settings set value = 'true'::jsonb where key = 'ai_enabled';
  update public.settings set value = '["admin", "underwriter"]'::jsonb where key = 'ai_roles';
  perform set_config('request.jwt.claims', json_build_object('sub', uw, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if not public.ai_available() then raise exception 'FAIL underwriter cannot use AI when on'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', mg, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if public.ai_available() then raise exception 'FAIL management can use AI though not in the roles'; end if;
  reset role;
  update public.settings set value = 'false'::jsonb where key = 'ai_enabled';
  perform set_config('request.jwt.claims', json_build_object('sub', uw, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if public.ai_available() then raise exception 'FAIL AI available while switched off'; end if;
  reset role;
  ok := ok || '1 switch and roles; ';

  -- 2. the log: written by the function (service role: no user), read by its user and admins only; users cannot write it
  perform set_config('request.jwt.claims', '', true);
  insert into public.ai_usage_log (user_id, kind, provider, model, status, is_demo) values
    (uw, 'submission', 'anthropic', 'claude-haiku-5-5', 'ok', false),
    (uw2, 'submission', 'anthropic', 'claude-haiku-5-5', 'error', false),
    (uw, 'bordereau_mapping', 'anthropic', 'claude-haiku-5-5', 'ok', true);
  insert into public.ai_cache (cache_key, is_demo, kind, model, result) values ('k1', false, 'submission', 'claude-haiku-5-5', '{}');
  perform set_config('request.jwt.claims', json_build_object('sub', uw, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.ai_usage_v where user_id in (uw, uw2);
  if n <> 1 then raise exception 'FAIL underwriter sees % log rows (own real one only)', n; end if;
  if exists (select 1 from public.ai_cache) then raise exception 'FAIL underwriter reads the cache'; end if;
  begin insert into public.ai_usage_log (user_id, kind, status) values (uw, 'submission', 'ok'); raise exception 'FAIL user wrote the log';
  exception when insufficient_privilege then null; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  update public.profiles set ui_demo_mode = false where id = adm;
  set local role authenticated;
  select count(*) into n from public.ai_usage_v where user_id in (uw, uw2);
  if n <> 2 then raise exception 'FAIL admin sees % real log rows', n; end if;
  if not exists (select 1 from public.ai_cache where cache_key = 'k1') then raise exception 'FAIL admin cannot read the cache'; end if;
  reset role;
  ok := ok || '2 log and cache access; ';

  -- 3. demo isolation: the demo row only in demo mode
  update public.profiles set ui_demo_mode = true where id = uw;
  perform set_config('request.jwt.claims', json_build_object('sub', uw, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.ai_usage_v where user_id = uw;
  if n <> 1 or not exists (select 1 from public.ai_usage_v where kind = 'bordereau_mapping') then raise exception 'FAIL demo mode sees % rows', n; end if;
  reset role;
  ok := ok || '3 demo isolation';

  raise exception 'ROLLBACK OK: %', ok;
end
$t$;
