-- Transaction-only verification for 20261124-review-hardening.sql.
-- Isolated in-memory PostgreSQL only; never run against production.
begin;
reset role;
truncate cw_auth_private.limits, cw_auth_private.used_envelopes, cw_auth_private.login_logs;

do $fixtures$
declare
  admin_tok uuid := gen_random_uuid();
  s_legacy uuid;
  s_rejected uuid;
  s_other uuid;
begin
  insert into public.cw_users(username, password_hash, full_name, class_name, student_number, role, status, session_token, session_expires_at)
  values ('rh-admin', extensions.crypt('Admin-Review-42!', extensions.gen_salt('bf', 10)), '관리자', '1반', null, 'admin', 'approved', admin_tok, now() + interval '1 hour');

  -- Legacy cost-6 student hash (must opportunistically upgrade to cost 10 on login).
  insert into public.cw_users(username, password_hash, full_name, class_name, student_number, role, status)
  values ('rh-legacy6', extensions.crypt('Legacy-Cost6-42!', extensions.gen_salt('bf', 6)), '레거시학생', '2반', 1, 'student', 'approved')
  returning id into s_legacy;

  -- Rejected student (login must NOT create login_logs).
  insert into public.cw_users(username, password_hash, full_name, class_name, student_number, role, status)
  values ('rh-rejected', extensions.crypt('Rejected-Stu-42!', extensions.gen_salt('bf', 10)), '반려학생', '2반', 2, 'student', 'rejected')
  returning id into s_rejected;

  -- Second student whose username shares a prefix with rh-legacy6 tests exact p_user_id filtering.
  insert into public.cw_users(username, password_hash, full_name, class_name, student_number, role, status)
  values ('rh-legacy60', extensions.crypt('Other-Stu-42!', extensions.gen_salt('bf', 10)), '다른학생', '2반', 3, 'student', 'approved')
  returning id into s_other;

  insert into public.cw_class_roster(class_name, student_number, full_name)
  values ('6반', 28, '코스트텐학생')
  on conflict (class_name, student_number) do update set full_name = excluded.full_name;

  perform set_config('test.rh_admin', admin_tok::text, true);
  perform set_config('test.rh_legacy_id', s_legacy::text, true);
  perform set_config('test.rh_rejected_id', s_rejected::text, true);
  perform set_config('test.rh_other_id', s_other::text, true);
end;
$fixtures$;

-- 1. Signup produces cost-10 bcrypt hash and logs initial student session.
set local role service_role;
do $signup_cost10$
declare r jsonb;
begin
  r := public.cw_secure_auth(
    'cw_signup_with_roster',
    jsonb_build_object(
      'p_username', 'rh-new-cost10',
      'p_password', 'Fresh-Cost10-42!',
      'p_full_name', '코스트텐학생',
      'p_class_name', '6반',
      'p_mbti', 'ENFP',
      'p_birth_date', null,
      'p_share_with_class', false,
      'p_student_number', 28
    ),
    gen_random_uuid(),
    clock_timestamp() + interval '60 seconds',
    repeat('c', 64)
  );
  assert r->>'session_token' is not null, 'cost-10 signup failed';
end;
$signup_cost10$;

reset role;
do $check_signup_hash$
declare h text;
begin
  select password_hash into h from public.cw_users where username = 'rh-new-cost10';
  assert h like '$2a$10$%' or h like '$2b$10$%', 'signup hash must be bcrypt cost 10, got: ' || coalesce(left(h, 8), 'null');
end;
$check_signup_hash$;

-- 2. Legacy cost-6 hash is opportunistically upgraded to cost-10 on valid login,
--    while rejected student login does NOT insert into login_logs.
set local role service_role;
do $rehash_and_rejected$
declare r jsonb;
begin
  r := public.cw_secure_auth(
    'cw_login',
    jsonb_build_object('p_username', 'rh-legacy6', 'p_password', 'Legacy-Cost6-42!'),
    gen_random_uuid(),
    clock_timestamp() + interval '60 seconds',
    repeat('d', 64)
  );
  assert r->>'session_token' is not null, 'legacy cost-6 login failed';

  r := public.cw_secure_auth(
    'cw_login',
    jsonb_build_object('p_username', 'rh-rejected', 'p_password', 'Rejected-Stu-42!'),
    gen_random_uuid(),
    clock_timestamp() + interval '60 seconds',
    repeat('d', 64)
  );
  assert r->>'session_token' is not null, 'rejected login token issue';

  -- Admin password reset also stores cost-10 hash.
  r := public.cw_secure_auth(
    'cw_admin_reset_student_password',
    jsonb_build_object(
      'p_token', current_setting('test.rh_admin'),
      'p_target_id', current_setting('test.rh_other_id'),
      'p_admin_password', 'Admin-Review-42!',
      'p_new_password', 'Reset-Cost10-42!'
    ),
    gen_random_uuid(),
    clock_timestamp() + interval '60 seconds',
    repeat('e', 64)
  );
  assert (r->>'ok')::boolean = true, 'admin reset failed';
end;
$rehash_and_rejected$;

reset role;
do $verify_rehash_and_logs$
declare
  h1 text;
  h2 text;
  rej_count integer;
begin
  select password_hash into h1 from public.cw_users where username = 'rh-legacy6';
  assert h1 like '$2a$10$%' or h1 like '$2b$10$%', 'legacy cost-6 hash was not upgraded to cost 10';
  select password_hash into h2 from public.cw_users where username = 'rh-legacy60';
  assert h2 like '$2a$10$%' or h2 like '$2b$10$%', 'reset hash was not cost 10';
  select count(*) into rej_count from cw_auth_private.login_logs where user_id = current_setting('test.rh_rejected_id')::uuid;
  assert rej_count = 0, 'rejected student login must not be recorded in login_logs';
end;
$verify_rehash_and_logs$;

-- 3. Exact p_user_id drill-down works even when >100 newer global logins exist.
do $setup_drilldown$
declare
  i integer;
  other_id uuid := current_setting('test.rh_other_id')::uuid;
  legacy_id uuid := current_setting('test.rh_legacy_id')::uuid;
begin
  -- Make legacy_id's login older than 120 newer logins for other_id, plus one >180d expired log.
  update cw_auth_private.login_logs set logged_in_at = now() - interval '2 days' where user_id = legacy_id;
  for i in 1..120 loop
    insert into cw_auth_private.login_logs (user_id, logged_in_at)
    values (other_id, now() - make_interval(mins => 130 - i));
  end loop;
  insert into cw_auth_private.login_logs (user_id, logged_in_at)
  values (other_id, now() - interval '200 days');
end;
$setup_drilldown$;

set local role anon;
do $verify_drilldown$
declare
  a uuid := current_setting('test.rh_admin')::uuid;
  legacy_id uuid := current_setting('test.rh_legacy_id')::uuid;
  global_hist jsonb;
  user_hist jsonb;
begin
  assert jsonb_array_length(public.cw_admin_login_history(a)) = 100, '1-arg default overload resolves cleanly';
  global_hist := public.cw_admin_login_history(a, 100);
  assert jsonb_array_length(global_hist) = 100, 'global history capped at 100';
  -- Without p_user_id, legacy_id is pushed past the 100-row global cap.
  assert not exists (
    select 1 from jsonb_array_elements(global_hist) e where (e->>'user_id')::uuid = legacy_id
  ), 'legacy_id should be outside global top 100';
  -- With p_user_id, legacy_id is returned accurately and exclusively.
  user_hist := public.cw_admin_login_history(a, 100, legacy_id);
  assert jsonb_array_length(user_hist) = 1, 'exact per-student drill-down must return legacy_id log';
  assert (user_hist->0->>'user_id')::uuid = legacy_id;
  assert user_hist->0->>'username' = 'rh-legacy6';
end;
$verify_drilldown$;

-- 4. Missing IP (p_client IS NULL) enforces client:missing:* fallback bucket (120/5m),
--    and expired 200-day login_logs get pruned when encrypted-auth:global resets.
reset role;
truncate cw_auth_private.limits;
set local role service_role;
do $missing_ip_limit$
declare r jsonb; i integer;
begin
  for i in 1..120 loop
    r := public.cw_secure_auth(
      'cw_login',
      jsonb_build_object('p_username', 'null-ip-' || i),
      gen_random_uuid(),
      clock_timestamp() + interval '60 seconds',
      null
    );
    assert r->>'code' = 'CW_INVALID_CREDENTIALS', 'within null-IP bucket: ' || coalesce(r->>'code', 'null');
  end loop;
  r := public.cw_secure_auth(
    'cw_login',
    jsonb_build_object('p_username', 'null-ip-over'),
    gen_random_uuid(),
    clock_timestamp() + interval '60 seconds',
    null
  );
  assert r->>'code' = 'CW_RATE_LIMIT', 'missing IP must hit fallback 120/5m bucket instead of 10x global ceiling';
end;
$missing_ip_limit$;

reset role;
do $verify_retention_and_acl$
declare old_logs integer;
begin
  select count(*) into old_logs from cw_auth_private.login_logs where logged_in_at < now() - interval '180 days';
  assert old_logs = 0, 'login_logs older than 180 days must be pruned on global window reset';
  assert to_regprocedure('public.cw_admin_login_history(uuid,integer)') is not null, '2-arg legacy overload preserved for non-destructive compatibility';
  assert has_function_privilege('anon', 'public.cw_admin_login_history(uuid,integer)', 'EXECUTE');
  assert has_function_privilege('anon', 'public.cw_admin_login_history(uuid,integer,uuid)', 'EXECUTE');
  assert not has_function_privilege('anon', 'public.cw_admin_reset_student_password(uuid,uuid,text,text)', 'EXECUTE');
  assert not has_function_privilege('anon', 'cw_auth_private.cw_signup(text,text,text,text,text)', 'EXECUTE');
  assert not has_function_privilege('anon', 'cw_auth_private.cw_signup_with_roster(text,text,text,text,text,date,boolean,integer)', 'EXECUTE');
end;
$verify_retention_and_acl$;

rollback;
