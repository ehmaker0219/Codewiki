-- Fictional fixtures in isolated test DB only. No production writes.
begin;
reset role;
truncate cw_auth_private.limits, cw_auth_private.used_envelopes, cw_auth_private.login_logs;

do $fixtures$
declare
  a uuid := gen_random_uuid();
begin
  insert into public.cw_users(username, password_hash, full_name, class_name, student_number, role, status, session_token, session_expires_at)
  values ('signup-log-admin', extensions.crypt('Admin-SignLog-42!', extensions.gen_salt('bf')), '관리자', '1반', null, 'admin', 'approved', a, now() + interval '1 hour');
  insert into public.cw_class_roster(class_name, student_number, full_name)
  values ('6반', 29, '신규학생')
  on conflict (class_name, student_number) do update set full_name = excluded.full_name;
  perform set_config('test.sl_admin', a::text, true);
end;
$fixtures$;

-- Failed signup must NOT create a login_logs row; valid signup must create 1 row.
set local role service_role;
do $signups$
declare r jsonb;
begin
  -- Wrong roster number fails atomically.
  r := public.cw_secure_auth(
    'cw_signup_with_roster',
    jsonb_build_object(
      'p_username', 'signup-log-bad',
      'p_password', 'Valid-Pass-42!',
      'p_full_name', '신규학생',
      'p_class_name', '6반',
      'p_mbti', 'INTJ',
      'p_birth_date', null,
      'p_share_with_class', false,
      'p_student_number', 1
    ),
    gen_random_uuid(),
    clock_timestamp() + interval '60 seconds',
    repeat('a', 64)
  );
  assert r->>'code' = 'CW_INVALID_INPUT', 'bad roster signup should fail';

  -- Valid signup succeeds and logs initial session.
  r := public.cw_secure_auth(
    'cw_signup_with_roster',
    jsonb_build_object(
      'p_username', 'signup-log-ok',
      'p_password', 'Valid-Pass-42!',
      'p_full_name', '신규학생',
      'p_class_name', '6반',
      'p_mbti', 'INTJ',
      'p_birth_date', null,
      'p_share_with_class', false,
      'p_student_number', 29
    ),
    gen_random_uuid(),
    clock_timestamp() + interval '60 seconds',
    repeat('b', 64)
  );
  assert r->>'session_token' is not null, 'valid signup failed';
end;
$signups$;

set local role anon;
do $verify_initial$
declare
  a uuid := current_setting('test.sl_admin')::uuid;
  hist jsonb;
  dir jsonb;
  item jsonb;
begin
  hist := public.cw_admin_login_history(a, 50);
  assert jsonb_array_length(hist) = 1, 'expected 1 signup login log, got ' || jsonb_array_length(hist);
  assert hist->0->>'username' = 'signup-log-ok';
  assert (hist->0->>'student_number')::integer = 29;

  dir := public.cw_admin_student_directory(a);
  select value into item from jsonb_array_elements(dir) where value->>'username' = 'signup-log-ok';
  assert (item->>'login_count')::integer = 1, 'expected login_count=1 after signup';
  assert item->>'last_login_at' is not null, 'expected last_login_at after signup';
end;
$verify_initial$;

-- Subsequent login by the same student increments login_count to 2.
set local role service_role;
do $relogin$
declare r jsonb;
begin
  r := public.cw_secure_auth(
    'cw_login',
    jsonb_build_object('p_username', 'signup-log-ok', 'p_password', 'Valid-Pass-42!'),
    gen_random_uuid(),
    clock_timestamp() + interval '60 seconds',
    repeat('b', 64)
  );
  assert r->>'session_token' is not null, 'relogin failed';
end;
$relogin$;

set local role anon;
do $verify_relogin$
declare
  a uuid := current_setting('test.sl_admin')::uuid;
  hist jsonb;
  dir jsonb;
  item jsonb;
begin
  hist := public.cw_admin_login_history(a, 50);
  assert jsonb_array_length(hist) = 2, 'expected 2 login logs after relogin';
  dir := public.cw_admin_student_directory(a);
  select value into item from jsonb_array_elements(dir) where value->>'username' = 'signup-log-ok';
  assert (item->>'login_count')::integer = 2, 'expected login_count=2 after relogin';
end;
$verify_relogin$;

reset role;
rollback;
