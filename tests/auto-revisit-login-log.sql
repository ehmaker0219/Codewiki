-- Transaction-only verification for 20261125-auto-revisit-login-log.sql.
-- Isolated in-memory PostgreSQL only; never run against production.
begin;
reset role;
truncate cw_auth_private.limits, cw_auth_private.used_envelopes, cw_auth_private.login_logs, public.cw_presence;

do $fixtures$
declare
  admin_tok uuid := gen_random_uuid();
  s_day_tok uuid := gen_random_uuid();
  s_gap_tok uuid := gen_random_uuid();
  s_cont_tok uuid := gen_random_uuid();
  s_rej_tok uuid := gen_random_uuid();
  s_day_id uuid;
  s_gap_id uuid;
  s_cont_id uuid;
  s_rej_id uuid;
  v_today_kst timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  insert into public.cw_users(username, password_hash, full_name, class_name, student_number, role, status, session_token, session_expires_at)
  values ('rv-admin', 'fixture', '관리자', '1반', null, 'admin', 'approved', admin_tok, now() + interval '1 hour');

  insert into public.cw_users(username, password_hash, full_name, class_name, student_number, role, status, session_token, session_expires_at)
  values ('rv-nextday', 'fixture', '다음날학생', '2반', 1, 'student', 'approved', s_day_tok, now() + interval '6 hours')
  returning id into s_day_id;

  insert into public.cw_users(username, password_hash, full_name, class_name, student_number, role, status, session_token, session_expires_at)
  values ('rv-gap', 'fixture', '재방문학생', '2반', 2, 'student', 'approved', s_gap_tok, now() + interval '6 hours')
  returning id into s_gap_id;

  insert into public.cw_users(username, password_hash, full_name, class_name, student_number, role, status, session_token, session_expires_at)
  values ('rv-continuous', 'fixture', '연속접속학생', '2반', 3, 'student', 'approved', s_cont_tok, now() + interval '6 hours')
  returning id into s_cont_id;

  insert into public.cw_users(username, password_hash, full_name, class_name, student_number, role, status, session_token, session_expires_at)
  values ('rv-rejected', 'fixture', '반려학생', '2반', 4, 'student', 'rejected', s_rej_tok, now() + interval '6 hours')
  returning id into s_rej_id;

  -- 1) Logged in yesterday (KST); session still valid today.
  insert into cw_auth_private.login_logs(user_id, logged_in_at)
  values (s_day_id, v_today_kst - interval '1 hour');
  insert into public.cw_presence(user_id, session_token, last_seen)
  values (s_day_id, s_day_tok, v_today_kst - interval '50 minutes');

  -- 2) Logged in 3h ago and left 3h ago (real absence >= 2h).
  insert into cw_auth_private.login_logs(user_id, logged_in_at)
  values (s_gap_id, now() - interval '3 hours');
  insert into public.cw_presence(user_id, session_token, last_seen)
  values (s_gap_id, s_gap_tok, now() - interval '3 hours');

  -- 3) Logged in 3h ago (same KST day if after 03:00, or recent) and stayed active (last_seen 1m ago).
  insert into cw_auth_private.login_logs(user_id, logged_in_at)
  values (s_cont_id, greatest(v_today_kst + interval '1 minute', now() - interval '3 hours'));
  insert into public.cw_presence(user_id, session_token, last_seen)
  values (s_cont_id, s_cont_tok, now() - interval '1 minute');

  -- 4) Rejected student with yesterday's log must never record a revisit.
  insert into cw_auth_private.login_logs(user_id, logged_in_at)
  values (s_rej_id, v_today_kst - interval '2 hours');

  perform set_config('test.rv_admin', admin_tok::text, true);
  perform set_config('test.rv_day_tok', s_day_tok::text, true);
  perform set_config('test.rv_gap_tok', s_gap_tok::text, true);
  perform set_config('test.rv_cont_tok', s_cont_tok::text, true);
  perform set_config('test.rv_rej_tok', s_rej_tok::text, true);
  perform set_config('test.rv_day_id', s_day_id::text, true);
  perform set_config('test.rv_gap_id', s_gap_id::text, true);
  perform set_config('test.rv_cont_id', s_cont_id::text, true);
  perform set_config('test.rv_rej_id', s_rej_id::text, true);
end;
$fixtures$;

set local role anon;
do $exercise$
declare
  v_admin uuid := current_setting('test.rv_admin')::uuid;
  v_day uuid := current_setting('test.rv_day_tok')::uuid;
  v_gap uuid := current_setting('test.rv_gap_tok')::uuid;
  v_cont uuid := current_setting('test.rv_cont_tok')::uuid;
  v_rej uuid := current_setting('test.rv_rej_tok')::uuid;
begin
  -- Private helper must not be callable directly by anon.
  begin
    perform cw_auth_private.record_student_revisit(gen_random_uuid(), 'student', 'approved', null);
    raise exception 'anon called private revisit helper';
  exception when insufficient_privilege then null;
  end;

  -- Admin cw_me and heartbeat must not log into student login_logs.
  perform public.cw_me(v_admin);
  perform public.cw_presence_heartbeat(v_admin, false);

  -- Next-day return via cw_me records exactly 1 new log; subsequent cw_me + heartbeat do not duplicate.
  assert public.cw_me(v_day)->>'username' = 'rv-nextday';
  perform public.cw_me(v_day);
  perform public.cw_presence_heartbeat(v_day, false);

  -- Returning after >=2h absence via already-open tab (heartbeat only) records exactly 1 new log; repeat does not duplicate.
  perform public.cw_presence_heartbeat(v_gap, false);
  perform public.cw_presence_heartbeat(v_gap, false);
  perform public.cw_me(v_gap);

  -- Continuous same-day browsing (last_seen 1m ago) must NOT add spurious extra logs.
  perform public.cw_me(v_cont);
  perform public.cw_presence_heartbeat(v_cont, false);

  -- Rejected student calling cw_me must NOT record a revisit.
  perform public.cw_me(v_rej);
end;
$exercise$;

reset role;
do $verify$
declare
  c_day integer;
  c_gap integer;
  c_cont integer;
  c_rej integer;
  c_admin integer;
begin
  select count(*) into c_day from cw_auth_private.login_logs where user_id = current_setting('test.rv_day_id')::uuid;
  assert c_day = 2, 'next-day revisit must add exactly 1 row (expected 2, got ' || c_day || ')';

  select count(*) into c_gap from cw_auth_private.login_logs where user_id = current_setting('test.rv_gap_id')::uuid;
  assert c_gap = 2, 'absence>=2h revisit via heartbeat must add exactly 1 row (expected 2, got ' || c_gap || ')';

  select count(*) into c_cont from cw_auth_private.login_logs where user_id = current_setting('test.rv_cont_id')::uuid;
  assert c_cont = 1, 'continuous same-day activity must not add duplicate rows (expected 1, got ' || c_cont || ')';

  select count(*) into c_rej from cw_auth_private.login_logs where user_id = current_setting('test.rv_rej_id')::uuid;
  assert c_rej = 1, 'rejected student must not add revisit rows (expected 1, got ' || c_rej || ')';

  select count(*) into c_admin
  from cw_auth_private.login_logs l join public.cw_users u on u.id = l.user_id
  where u.role = 'admin';
  assert c_admin = 0, 'admin must never be recorded in login_logs';

  assert not has_function_privilege('anon', 'cw_auth_private.record_student_revisit(uuid,text,text,timestamptz)', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'cw_auth_private.record_student_revisit(uuid,text,text,timestamptz)', 'EXECUTE');
end;
$verify$;

rollback;
