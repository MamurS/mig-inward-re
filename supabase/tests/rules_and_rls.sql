-- Behaviour checks for status rules and RLS. Runs inside a transaction and ROLLS BACK.
-- Needs no real account: the test identity is a user created inside this transaction (rolled back),
-- so no real user's role, demo mode or settings ever change, even for a moment.
-- Usage: paste into the SQL editor and run; every row (52 checks) should say PASS.
begin;

create temp table t_results (test text, result text) on commit drop;
grant all on t_results to authenticated, anon;

create or replace function pg_temp.expect_error(p_test text, p_sql text, p_like text)
returns void language plpgsql as $$
begin
  execute p_sql;
  insert into t_results values (p_test, 'FAIL: no error');
exception when others then
  insert into t_results values (p_test,
    case when sqlerrm ilike '%' || p_like || '%' then 'PASS' else 'FAIL: ' || sqlerrm end);
end $$;

create or replace function pg_temp.expect_ok(p_test text, p_sql text)
returns void language plpgsql as $$
begin
  execute p_sql;
  insert into t_results values (p_test, 'PASS');
exception when others then
  insert into t_results values (p_test, 'FAIL: ' || sqlerrm);
end $$;

grant execute on function pg_temp.expect_error(text, text, text), pg_temp.expect_ok(text, text) to authenticated, anon;

-- the test identity (never a real account); in Demo mode only when there is no real data to test on
insert into auth.users (id, email, aud, role) values ('a7000000-0000-4000-8000-000000000001'::uuid, 'at-rls@example.com', 'authenticated', 'authenticated');
update public.profiles set role = 'admin', active = true,
  ui_demo_mode = not exists (select 1 from public.submissions where not is_demo)
 where id = 'a7000000-0000-4000-8000-000000000001'::uuid;

do $$
declare
  v_uid uuid := 'a7000000-0000-4000-8000-000000000001'::uuid;  -- the test identity
  v_world boolean := (select ui_demo_mode from public.profiles where id = 'a7000000-0000-4000-8000-000000000001'::uuid);
  v_rev uuid := (select id from public.submissions where status = 'under_review' and is_demo = v_world order by ref_no limit 1);
  v_rec uuid := (select id from public.submissions where status = 'received' and is_demo = v_world order by ref_no limit 1);
  v_off uuid := (select id from public.submissions where status = 'offered' and is_demo = v_world order by ref_no limit 1);
  v_fu  uuid;
  v_n   int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

  -- ---------------- as UNDERWRITER ----------------
  update public.profiles set role = 'underwriter' where id = v_uid;
  execute 'set local role authenticated';

  perform pg_temp.expect_error('UW: direct status update blocked',
    format('update public.submissions set status = %L where id = %L', 'bound', v_off), 'permission denied');
  perform pg_temp.expect_error('UW: cannot jump received → bound',
    format('select public.change_submission_status(%L, %L)', v_rec, 'bound'), 'not allowed');
  perform pg_temp.expect_error('UW: offer needs valid-until date',
    format('select public.change_submission_status(%L, %L, null, 10)', v_rev, 'offered'), 'valid until');
  perform pg_temp.expect_error('UW: offer needs written share',
    format('select public.change_submission_status(%L, %L, null, null, current_date + 30)', v_rev, 'offered'), 'written share');
  perform pg_temp.expect_error('UW: signed > written rejected',
    format('select public.change_submission_status(%L, %L, null, null, null, 99)', v_off, 'bound'), 'cannot exceed');
  perform pg_temp.expect_error('UW: signed missing rejected',
    format('select public.change_submission_status(%L, %L)', v_off, 'bound'), 'signed share');
  perform pg_temp.expect_error('UW: NTU needs reason',
    format('select public.change_submission_status(%L, %L, %L)', v_off, 'ntu', '  '), 'reason is required');
  perform pg_temp.expect_error('UW: decline needs reason',
    format('select public.change_submission_status(%L, %L)', v_rev, 'declined'), 'reason is required');

  perform pg_temp.expect_ok('UW: valid offer accepted',
    format('select public.change_submission_status(%L, %L, %L, 12.5, current_date + 30)', v_rev, 'offered', 'Quote sent'));
  select count(*) into v_n from public.follow_ups
   where entity_id = v_rev and type = 'request_update' and done_at is null
     and due_at::date = (now() + interval '7 days')::date;
  insert into t_results values ('UW: offer creates follow-up at +7 days', case when v_n = 1 then 'PASS' else 'FAIL: ' || v_n end);
  select count(*) into v_n from public.submission_status_history where submission_id = v_rev and to_status = 'offered' and changed_by = v_uid;
  insert into t_results values ('UW: transition written to history', case when v_n = 1 then 'PASS' else 'FAIL' end);

  perform pg_temp.expect_ok('UW: valid bind (signed < written) accepted',
    format('select public.change_submission_status(%L, %L, %L, null, null, 5)', v_rev, 'bound', 'Firm order'));
  select count(*) into v_n from public.follow_ups where entity_id = v_rev and done_at is null and type = 'request_update';
  insert into t_results values ('UW: bind closes open follow-ups', case when v_n = 0 then 'PASS' else 'FAIL: ' || v_n end);

  select id into v_fu from public.follow_ups where done_at is null limit 1;
  perform pg_temp.expect_error('UW: closing follow-up needs outcome',
    format('update public.follow_ups set done_at = now() where id = %L', v_fu), 'follow_ups_outcome_chk');
  perform pg_temp.expect_ok('UW: closing follow-up with outcome',
    format('update public.follow_ups set done_at = now(), outcome = %L where id = %L', 'MGA replied', v_fu));

  perform pg_temp.expect_error('UW: history is append-only (update)',
    'update public.submission_status_history set comment = ''x''', 'permission denied');
  perform pg_temp.expect_error('UW: history cannot be inserted directly',
    format('insert into public.submission_status_history (submission_id, to_status) values (%L, %L)', v_rev, 'bound'), 'permission denied');
  perform pg_temp.expect_error('UW: audit log cannot be changed',
    'delete from public.audit_log', 'permission denied');
  perform pg_temp.expect_error('UW: cannot set ref_no',
    format('update public.submissions set ref_no = %L where id = %L', 'X', v_rev), 'permission denied');
  update public.currencies set name = 'x' where code = 'USD';  -- RLS: affects 0 rows
  select count(*) into v_n from public.currencies where name = 'x';
  insert into t_results values ('UW: cannot edit reference data', case when v_n = 0 then 'PASS' else 'FAIL' end);
  perform pg_temp.expect_ok('UW: can create submission',
    'insert into public.submissions (source_party_id, mga_id, insured_name, currency) select id, id, ''Test insured'', ''USD'' from public.counterparties where type = ''mga'' limit 1');
  select count(*) into v_n from public.audit_log where table_name = 'submissions' and action = 'INSERT' and changed_by = v_uid;
  insert into t_results values ('Audit log records the insert with user', case when v_n >= 1 then 'PASS' else 'FAIL' end);
  -- in Demo mode the insured gets «DEMO » and the ref «DEMO-» in front
  select count(*) into v_n from public.submissions where insured_name in ('Test insured', 'DEMO Test insured') and ref_no ~ ('^(DEMO-)?SUB-' || extract(year from current_date) || '-\d{4}$');
  insert into t_results values ('Ref no generated SUB-YYYY-NNNN', case when v_n = 1 then 'PASS' else 'FAIL' end);

  -- ---------------- as FINANCE ----------------
  execute 'reset role';
  update public.profiles set role = 'finance' where id = v_uid;
  execute 'set local role authenticated';

  select count(*) into v_n from public.submissions_v;
  insert into t_results values ('FIN: can read submissions view', case when v_n > 0 then 'PASS' else 'FAIL' end);
  perform pg_temp.expect_error('FIN: cannot change status',
    format('select public.change_submission_status(%L, %L)', v_rec, 'under_review'), 'Only underwriters');
  perform pg_temp.expect_error('FIN: cannot insert submission',
    'insert into public.submissions (source_party_id, mga_id, insured_name, currency) select id, id, ''X'', ''USD'' from public.counterparties where type = ''mga'' limit 1',
    'row-level security');
  update public.submissions set notes = 'hacked' where id = v_rec;
  select count(*) into v_n from public.submissions where notes = 'hacked';
  insert into t_results values ('FIN: update affects 0 rows', case when v_n = 0 then 'PASS' else 'FAIL' end);
  perform pg_temp.expect_error('FIN: cannot add submission follow-up',
    format('insert into public.follow_ups (entity_type, entity_id, due_at) values (%L, %L, now())', 'submission', v_rec),
    'row-level security');

  -- ---------------- as MANAGEMENT ----------------
  execute 'reset role';
  update public.profiles set role = 'management' where id = v_uid;
  execute 'set local role authenticated';
  select count(*) into v_n from public.submission_status_history;
  insert into t_results values ('MGMT: can read history', case when v_n > 0 then 'PASS' else 'FAIL' end);
  perform pg_temp.expect_error('MGMT: cannot change status',
    format('select public.change_submission_status(%L, %L)', v_rec, 'under_review'), 'Only underwriters');

  -- ---------------- NO ROLE ----------------
  execute 'reset role';
  update public.profiles set role = null where id = v_uid;
  execute 'set local role authenticated';
  select count(*) into v_n from public.submissions;
  insert into t_results values ('NO ROLE: sees 0 submissions', case when v_n = 0 then 'PASS' else 'FAIL: ' || v_n end);

  -- ---------------- ANON ----------------
  execute 'reset role';
  execute 'set local role anon';
  perform pg_temp.expect_error('ANON: cannot read submissions', 'select 1 from public.submissions', 'permission denied');
  perform pg_temp.expect_error('ANON: cannot read view', 'select 1 from public.submissions_v', 'permission denied');
  perform pg_temp.expect_error('ANON: cannot call status RPC',
    format('select public.change_submission_status(%L, %L)', v_rec, 'under_review'), 'permission denied');
  execute 'reset role';
end $$;

-- ---------------- delete rules (as table owner) ----------------
do $$
declare v_sub uuid := (select id from public.submissions where status = 'offered' order by ref_no limit 1);
        v_doc uuid;
begin
  insert into public.documents (entity_type, entity_id, doc_type, file_name, storage_path)
  values ('submission', v_sub, 'slip', 't.pdf', 'submission/' || v_sub || '/t.pdf') returning id into v_doc;
  begin
    delete from public.submissions where id = v_sub;
    insert into t_results values ('Delete submission with documents blocked', 'FAIL');
  exception when others then
    insert into t_results values ('Delete submission with documents blocked', case when sqlerrm like 'Delete the documents%' then 'PASS' else 'FAIL ' || sqlerrm end);
  end;
  perform public.apply_submission_status(v_sub, 'bound', null, 'x', null, null, (select written_share_pct from public.submissions where id = v_sub), v_doc);
  begin
    delete from public.documents where id = v_doc;
    insert into t_results values ('Delete evidence document blocked', 'FAIL');
  exception when others then
    insert into t_results values ('Delete evidence document blocked', case when sqlerrm like '%confirmation evidence%' then 'PASS' else 'FAIL ' || sqlerrm end);
  end;
  delete from public.submission_status_history where submission_id = v_sub;
  delete from public.documents where id = v_doc;
  delete from public.submissions where id = v_sub;
  insert into t_results values ('Delete submission removes its follow-ups',
    case when not exists (select 1 from public.follow_ups where entity_id = v_sub) then 'PASS' else 'FAIL' end);
end $$;

-- ---------------- Steps 4–5 objects, storage, calculations ----------------
do $$
declare
  v_uid uuid := 'a7000000-0000-4000-8000-000000000001'::uuid;  -- the test identity, as in the first block
  v_world boolean := (select ui_demo_mode from public.profiles where id = 'a7000000-0000-4000-8000-000000000001'::uuid);
  v_rec uuid := (select id from public.submissions where status = 'received' and is_demo = v_world order by ref_no limit 1);
  v_fu  uuid;
  v_n   int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

  -- underwriter
  update public.profiles set role = 'underwriter', active = true where id = v_uid;
  execute 'set local role authenticated';
  perform pg_temp.expect_ok('UW: can add counterparty',
    'insert into public.counterparties (name, type) values (''Test MGA X'', ''mga'')');
  delete from public.counterparties where name in ('Test MGA X', 'DEMO Test MGA X');
  select count(*) into v_n from public.counterparties where name in ('Test MGA X', 'DEMO Test MGA X');
  insert into t_results values ('UW: cannot delete counterparty', case when v_n = 1 then 'PASS' else 'FAIL' end);
  select count(*) into v_n from public.job_runs;
  insert into t_results values ('UW: job log hidden', case when v_n = 0 then 'PASS' else 'FAIL: ' || v_n end);
  perform pg_temp.expect_error('UW: cannot run daily job', 'select public.run_daily_follow_ups_now()', 'Only admins');
  perform pg_temp.expect_error('UW: internal job function not callable', 'select public.run_daily_follow_ups()', 'permission denied');
  perform pg_temp.expect_ok('UW: can upload to submission folder',
    format('insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)', 'documents', 'submission/' || v_rec || '/t.pdf', v_uid));
  perform pg_temp.expect_error('UW: cannot upload to claim folder',
    format('insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)', 'documents', 'claim/' || v_rec || '/t.pdf', v_uid), 'row-level security');
  insert into public.follow_ups (entity_type, entity_id, type, due_at, assigned_to) values ('submission', v_rec, 'other', now(), v_uid) returning id into v_fu;

  -- finance: may close a follow-up assigned to them, nothing else
  execute 'reset role';
  update public.profiles set role = 'finance' where id = v_uid;
  execute 'set local role authenticated';
  perform pg_temp.expect_error('FIN: cannot add counterparty',
    'insert into public.counterparties (name, type) values (''Test MGA Y'', ''mga'')', 'row-level security');
  perform pg_temp.expect_error('FIN: cannot upload submission documents',
    format('insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)', 'documents', 'submission/' || v_rec || '/f.pdf', v_uid), 'row-level security');
  perform pg_temp.expect_ok('FIN: can close a follow-up assigned to them',
    format('update public.follow_ups set done_at = now(), outcome = %L where id = %L', 'done', v_fu));
  select count(*) into v_n from public.follow_ups_v where id = v_fu and done_at is not null;
  insert into t_results values ('FIN: agenda view shows the closed item', case when v_n = 1 then 'PASS' else 'FAIL' end);

  -- management sees the job log
  execute 'reset role';
  update public.profiles set role = 'management' where id = v_uid;
  execute 'set local role authenticated';
  perform pg_temp.expect_ok('MGMT: can read job log', 'select count(*) from public.job_runs');

  -- no role sees nothing
  execute 'reset role';
  update public.profiles set role = null where id = v_uid;
  execute 'set local role authenticated';
  select count(*) into v_n from public.follow_ups_v;
  insert into t_results values ('NO ROLE: agenda view empty', case when v_n = 0 then 'PASS' else 'FAIL: ' || v_n end);
  select count(*) into v_n from storage.objects where bucket_id = 'documents';
  insert into t_results values ('NO ROLE: cannot see stored files', case when v_n = 0 then 'PASS' else 'FAIL: ' || v_n end);
  execute 'reset role';

  -- calculations: recompute every row independently and compare with the view
  select count(*) into v_n
  from public.submissions s join public.submissions_v v on v.id = s.id
  where v.our_gross_premium is distinct from round(s.gross_premium_100 * (case when s.status = 'bound' then s.signed_share_pct else s.written_share_pct end) / 100, 2)
     or v.our_net_premium is distinct from v.our_gross_premium - round(v.our_gross_premium * s.commission_pct / 100, 2) - round(v.our_gross_premium * s.brokerage_pct / 100, 2)
     or v.our_gross_premium_usd is distinct from round(v.our_gross_premium * public.fx_rate_to_usd(s.currency, coalesce(s.bound_at::date, s.received_at)), 2)
     or (s.status = 'bound' and s.signed_share_pct > s.written_share_pct);
  insert into t_results values ('Calculations: view matches independent recompute (all rows)', case when v_n = 0 then 'PASS' else 'FAIL: ' || v_n || ' rows' end);
end $$;

select * from t_results;
rollback;
