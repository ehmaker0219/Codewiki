-- Fictional fixtures in isolated test DB only. No production writes.
begin;
reset role;
truncate cw_auth_private.limits, cw_auth_private.used_envelopes, cw_auth_private.login_logs;

do $fixtures$
declare
  a uuid := gen_random_uuid();
  s uuid := gen_random_uuid();
  e uuid := gen_random_uuid();
begin
  insert into public.cw_users(username, password_hash, full_name, class_name, student_number, role, status, session_token, session_expires_at)
  values
    ('login-hist-admin', extensions.crypt('Admin-Hist-42!', extensions.gen_salt('bf')), '관리자', '1반', null, 'admin', 'approved', a, now() + interval '1 hour'),
    ('login-hist-s1', extensions.crypt('Student-Hist-42!', extensions.gen_salt('bf')), '학생일', '2반', 7, 'student', 'approved', s, now() + interval '1 hour'),
    ('login-hist-s2', extensions.crypt('Student-Two-42!', extensions.gen_salt('bf')), '학생이', '2반', 8, 'student', 'pending', null, null),
    ('login-hist-expired', extensions.crypt('Expired-Hist-42!', extensions.gen_salt('bf')), '만료관리자', '1반', null, 'admin', 'approved', e, now() - interval '1 second');
  perform set_config('test.lh_admin', a::text, true);
  perform set_config('test.lh_student', s::text, true);
  perform set_config('test.lh_expired', e::text, true);
end;
$fixtures$;

-- Verify table/function privilege isolation.
do $acl$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    assert not has_table_privilege(r, 'cw_auth_private.login_logs', 'SELECT'), 'client can read login_logs directly';
    assert not has_table_privilege(r, 'cw_auth_private.login_logs', 'INSERT'), 'client can insert login_logs directly';
    assert not has_function_privilege(r, 'cw_auth_private.cw_login(text,text)', 'EXECUTE'), 'client can call private cw_login';
    assert has_function_privilege(r, 'public.cw_admin_login_history(uuid,integer)', 'EXECUTE');
  end loop;
end;
$acl$;

-- Simulate real encrypted-auth logins via service_role.
set local role service_role;
do $logins$
declare r jsonb;
begin
  -- Admin login must NOT be logged into student login history.
  r := public.cw_secure_auth('cw_login', jsonb_build_object('p_username', 'login-hist-admin', 'p_password', 'Admin-Hist-42!'), gen_random_uuid(), clock_timestamp() + interval '60 seconds');
  assert r->>'session_token' is not null, 'admin login failed';
  perform set_config('test.lh_admin', r->>'session_token', true);

  -- Failed student login must NOT be logged.
  r := public.cw_secure_auth('cw_login', jsonb_build_object('p_username', 'login-hist-s1', 'p_password', 'Wrong-Pass-42!'), gen_random_uuid(), clock_timestamp() + interval '60 seconds');
  assert r->>'code' = 'CW_INVALID_CREDENTIALS', 'wrong password accepted';

  -- Two successful logins for s1 and one for s2.
  r := public.cw_secure_auth('cw_login', jsonb_build_object('p_username', 'login-hist-s1', 'p_password', 'Student-Hist-42!'), gen_random_uuid(), clock_timestamp() + interval '60 seconds');
  assert r->>'session_token' is not null;
  perform set_config('test.lh_student', r->>'session_token', true);

  r := public.cw_secure_auth('cw_login', jsonb_build_object('p_username', 'login-hist-s2', 'p_password', 'Student-Two-42!'), gen_random_uuid(), clock_timestamp() + interval '60 seconds');
  assert r->>'session_token' is not null;

  r := public.cw_secure_auth('cw_login', jsonb_build_object('p_username', 'login-hist-s1', 'p_password', 'Student-Hist-42!'), gen_random_uuid(), clock_timestamp() + interval '60 seconds');
  assert r->>'session_token' is not null;
  perform set_config('test.lh_student', r->>'session_token', true);
end;
$logins$;

set local role anon;
do $rpc$
declare
  a uuid := current_setting('test.lh_admin')::uuid;
  s uuid := current_setting('test.lh_student')::uuid;
  e uuid := current_setting('test.lh_expired')::uuid;
  t uuid;
  hist jsonb;
  dir jsonb;
  item jsonb;
begin
  -- Non-admins and expired/invalid tokens must be rejected.
  foreach t in array array[s, e, gen_random_uuid(), null::uuid] loop
    begin
      perform public.cw_admin_login_history(t, 50);
      raise exception 'non-admin read login history';
    exception when insufficient_privilege then null;
    end;
  end loop;

  -- Admin receives 3 student events newest-first, no admin logins, no sensitive fields.
  hist := public.cw_admin_login_history(a, 100);
  assert jsonb_array_length(hist) = 3, 'expected 3 student login rows, got ' || jsonb_array_length(hist);
  assert hist->0->>'username' = 'login-hist-s1', 'newest login should be s1';
  assert hist->1->>'username' = 'login-hist-s2', 'second newest login should be s2';
  assert hist->2->>'username' = 'login-hist-s1', 'oldest login should be s1';
  assert (hist->0->>'student_number')::integer = 7;

  for item in select value from jsonb_array_elements(hist) loop
    assert item->>'username' <> 'login-hist-admin', 'admin login leaked into history';
    assert not (item ?| array['password', 'password_hash', 'session_token', 'session_expires_at']), 'sensitive field leaked';
    assert (select count(*) from jsonb_object_keys(item)) = 8, 'unexpected login history field count';
  end loop;

  -- Limit bounding works (lower bound 1, upper bound clamped).
  assert jsonb_array_length(public.cw_admin_login_history(a, 1)) = 1;
  assert jsonb_array_length(public.cw_admin_login_history(a, 0)) = 1;
  assert jsonb_array_length(public.cw_admin_login_history(a, 9999)) = 3;

  -- Directory includes last_login_at and login_count.
  dir := public.cw_admin_student_directory(a);
  select value into item from jsonb_array_elements(dir) where value->>'username' = 'login-hist-s1';
  assert (item->>'login_count')::integer = 2, 'expected login_count=2 for s1';
  assert item->>'last_login_at' is not null, 'expected last_login_at for s1';
  select value into item from jsonb_array_elements(dir) where value->>'username' = 'login-hist-s2';
  assert (item->>'login_count')::integer = 1, 'expected login_count=1 for s2';
end;
$rpc$;

reset role;
rollback;
