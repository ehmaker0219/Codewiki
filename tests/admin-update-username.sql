-- Disposable test database ONLY. Verifies cw_admin_update_student_username validation, permissions, uniqueness and login continuity.
begin;

do $fixtures$
declare
  v_admin_token uuid := gen_random_uuid();
  v_stu1_token uuid := gen_random_uuid();
  v_expired_token uuid := gen_random_uuid();
  v_admin_id uuid;
  v_stu1_id uuid;
  v_stu2_id uuid;
begin
  insert into public.cw_users (username, password_hash, full_name, class_name, student_number, role, status, session_token, session_expires_at)
  values
    ('adm_rename_test', extensions.crypt('Admin-Pass-123!', extensions.gen_salt('bf', 10)), '관리자이름', '운영팀', null, 'admin', 'approved', v_admin_token, now() + interval '12 hours'),
    ('영환테스트', extensions.crypt('Student-Pass-123!', extensions.gen_salt('bf', 10)), '학생일', '2반', null, 'student', 'approved', v_stu1_token, now() + interval '24 hours'),
    ('taken_user', extensions.crypt('Student-Pass-123!', extensions.gen_salt('bf', 10)), '학생이', '2반', null, 'student', 'approved', null, null),
    ('adm_rename_exp', extensions.crypt('Admin-Pass-123!', extensions.gen_salt('bf', 10)), '만료관리자', '운영팀', null, 'admin', 'approved', v_expired_token, now() - interval '1 minute');

  select id into v_admin_id from public.cw_users where session_token = v_admin_token;
  select id into v_stu1_id from public.cw_users where session_token = v_stu1_token;
  select id into v_stu2_id from public.cw_users where username = 'taken_user';

  insert into public.cw_birthdays (user_id, birth_date, share_with_class)
  values (v_stu1_id, date '1999-05-05', true);

  insert into cw_auth_private.login_logs (user_id, logged_in_at)
  values (v_stu1_id, now() - interval '10 minutes');

  perform set_config('test.rename_admin', v_admin_token::text, true);
  perform set_config('test.rename_student', v_stu1_token::text, true);
  perform set_config('test.rename_expired', v_expired_token::text, true);
  perform set_config('test.rename_admin_id', v_admin_id::text, true);
  perform set_config('test.rename_stu1_id', v_stu1_id::text, true);
  perform set_config('test.rename_stu2_id', v_stu2_id::text, true);

  assert not has_function_privilege('public', 'public.cw_admin_update_student_username(uuid,uuid,text)', 'EXECUTE'),
    'PUBLIC execute must be revoked on cw_admin_update_student_username';
  assert has_function_privilege('anon', 'public.cw_admin_update_student_username(uuid,uuid,text)', 'EXECUTE'),
    'anon execute must be granted on cw_admin_update_student_username';
end;
$fixtures$;

set local role anon;

do $test$
declare
  a uuid := current_setting('test.rename_admin')::uuid;
  s uuid := current_setting('test.rename_student')::uuid;
  e uuid := current_setting('test.rename_expired')::uuid;
  aid uuid := current_setting('test.rename_admin_id')::uuid;
  uid1 uuid := current_setting('test.rename_stu1_id')::uuid;
  t uuid;
  bad text;
  r jsonb;
  item jsonb;
begin
  -- Non-admin / expired / unknown / null tokens rejected.
  foreach t in array array[s, e, gen_random_uuid(), null::uuid] loop
    r := public.cw_admin_update_student_username(t, uid1, 'valid_new_id');
    assert r->>'code' = 'CW_ADMIN_REQUIRED', 'expected CW_ADMIN_REQUIRED, got ' || coalesce(r::text, 'null');
    assert current_setting('response.status') = '403';
  end loop;

  -- Invalid usernames rejected.
  foreach bad in array array['', ' ', 'a', repeat('a', 101), repeat('가', 101), 'bad name', E'bad\tname', E'bad\nname', E'bad\u3000name', null::text] loop
    r := public.cw_admin_update_student_username(a, uid1, bad);
    assert r->>'code' = 'CW_INVALID_USERNAME', 'expected CW_INVALID_USERNAME for ' || coalesce(bad, 'null') || ', got ' || coalesce(r::text, 'null');
    assert current_setting('response.status') = '400';
  end loop;

  -- Admin accounts and missing UUIDs cannot be renamed.
  r := public.cw_admin_update_student_username(a, aid, 'hijacked_admin');
  assert r->>'code' = 'CW_STUDENT_NOT_FOUND', 'admin account must not be renamed';
  assert current_setting('response.status') = '404';

  r := public.cw_admin_update_student_username(a, gen_random_uuid(), 'ghost_student');
  assert r->>'code' = 'CW_STUDENT_NOT_FOUND';
  assert current_setting('response.status') = '404';

  r := public.cw_admin_update_student_username(a, null::uuid, 'null_target');
  assert r->>'code' = 'CW_STUDENT_NOT_FOUND';

  -- Unchanged username rejected.
  r := public.cw_admin_update_student_username(a, uid1, '  영환테스트  ');
  assert r->>'code' = 'CW_USERNAME_UNCHANGED', 'expected CW_USERNAME_UNCHANGED, got ' || coalesce(r::text, 'null');
  assert current_setting('response.status') = '400';

  -- Duplicate usernames (case-insensitive, including admin usernames) rejected with 409.
  r := public.cw_admin_update_student_username(a, uid1, 'TAKEN_USER');
  assert r->>'code' = 'CW_USERNAME_TAKEN', 'expected CW_USERNAME_TAKEN, got ' || coalesce(r::text, 'null');
  assert current_setting('response.status') = '409';

  r := public.cw_admin_update_student_username(a, uid1, 'ADM_RENAME_TEST');
  assert r->>'code' = 'CW_USERNAME_TAKEN', 'must not collide with admin username';
  assert current_setting('response.status') = '409';

  -- Valid rename normalizes whitespace and case, preserves session/profile/history.
  r := public.cw_admin_update_student_username(a, uid1, '  YoungHwan.27  ');
  assert r = jsonb_build_object(
    'ok', true,
    'user_id', uid1,
    'previous_username', '영환테스트',
    'username', 'younghwan.27'
  ), 'unexpected rename payload: ' || coalesce(r::text, 'null');
  assert current_setting('response.status') = '200';

  -- Existing student session remains active and reflects new username.
  r := public.cw_me(s);
  assert r->>'username' = 'younghwan.27', 'cw_me should return updated username';
  assert r->>'status' = 'approved' and r->>'full_name' = '학생일';

  -- Directory and login history reflect updated username immediately.
  select value into item
  from jsonb_array_elements(public.cw_admin_student_directory(a))
  where value->>'id' = uid1::text;
  assert item->>'username' = 'younghwan.27', 'directory must show updated username';
  assert item->>'birth_date' = '1999-05-05';

  select value into item
  from jsonb_array_elements(public.cw_admin_login_history(a, 10, uid1))
  limit 1;
  assert item->>'username' = 'younghwan.27', 'login history must show updated username';
end;
$test$;

reset role;

-- Verify password login works ONLY with new username and rate limit enforces 429.
do $verify$
declare
  v_login jsonb;
  v_admin_id uuid := current_setting('test.rename_admin_id')::uuid;
  v_stu1_id uuid := current_setting('test.rename_stu1_id')::uuid;
begin
  v_login := cw_auth_private.request('login', '영환테스트', 'Student-Pass-123!');
  assert v_login->>'code' = 'CW_INVALID_CREDENTIALS', 'old username must no longer log in';

  v_login := cw_auth_private.request('login', 'YOUNGHWAN.27', 'Student-Pass-123!');
  assert v_login->>'session_token' is not null, 'new username must log in with existing password';
  assert v_login->>'id' = v_stu1_id::text;

  update cw_auth_private.limits
  set attempts = 30
  where bucket = 'admin-username-update:' || v_admin_id::text;
end;
$verify$;

set local role anon;
do $quota$
declare
  r jsonb;
begin
  r := public.cw_admin_update_student_username(
    current_setting('test.rename_admin')::uuid,
    current_setting('test.rename_stu1_id')::uuid,
    'another_new_id'
  );
  assert r->>'code' = 'CW_RATE_LIMIT', 'expected CW_RATE_LIMIT, got ' || coalesce(r::text, 'null');
  assert current_setting('response.status') = '429';
  assert (r->>'retry_after')::int > 0;
end;
$quota$;
reset role;

rollback;
