-- Fictional fixtures in isolated test DB only. No production account changes.
begin;
do $fixtures$
declare a uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); uid uuid;
begin
  insert into public.cw_users(username,password_hash,full_name,class_name,role,status,session_token,session_expires_at)
    values ('directory-admin',extensions.crypt('Admin-test-42!',extensions.gen_salt('bf')),'Test admin','1반','admin','approved',a,now()+interval '1 hour'),
      ('directory-student',extensions.crypt('Old-student-42!',extensions.gen_salt('bf')),'Test student','2반','student','approved',s,now()+interval '1 hour'),
      ('directory-expired',extensions.crypt('Expired-test-42!',extensions.gen_salt('bf')),'Expired admin','1반','admin','approved',e,now()-interval '1 second');
  select id into uid from public.cw_users where session_token=s;
  insert into public.cw_birthdays(user_id,birth_date,share_with_class) values(uid,'2000-01-02',false);
  perform set_config('test.directory_admin',a::text,true);perform set_config('test.directory_student',s::text,true);
  perform set_config('test.directory_expired',e::text,true);perform set_config('test.directory_target',uid::text,true);
  select id into uid from public.cw_users where session_token=a;
  perform set_config('test.directory_admin_id',uid::text,true);
end;
$fixtures$;
set local role anon;
do $test$
declare a uuid:=current_setting('test.directory_admin')::uuid;s uuid:=current_setting('test.directory_student')::uuid;
  e uuid:=current_setting('test.directory_expired')::uuid;uid uuid:=current_setting('test.directory_target')::uuid;
  r jsonb; item jsonb; t uuid; bad text;
begin
  r:=public.cw_admin_student_directory(a);
  select value into item from jsonb_array_elements(r) where value->>'id'=uid::text;
  assert item->>'username'='directory-student';assert item->>'birth_date'='2000-01-02';
  assert (select count(*) from jsonb_object_keys(item))=9,'unexpected directory fields';
  for item in select value from jsonb_array_elements(r) loop
    assert not (item ?| array['password','password_hash','session_token','session_expires_at']);
    assert item->>'id'<>current_setting('test.directory_admin_id');
  end loop;
  foreach t in array array[s,e,gen_random_uuid(),null::uuid] loop
    begin perform public.cw_admin_student_directory(t);raise exception 'non-admin directory';exception when insufficient_privilege then null;end;
    r:=public.cw_admin_reset_student_password(t,uid,'Admin-test-42!','New-student-42!');
    assert r->>'code'='CW_ADMIN_REQUIRED';assert current_setting('response.status')='403';
  end loop;
  r:=public.cw_admin_reset_student_password(a,uid,'wrong','New-student-42!');assert r->>'code'='CW_ADMIN_PASSWORD';
  foreach bad in array array['short','password',repeat('가나',13)] loop
    r:=public.cw_admin_reset_student_password(a,uid,'Admin-test-42!',bad);assert r->>'code'='CW_PASSWORD_POLICY';
  end loop;
  r:=public.cw_admin_reset_student_password(a,current_setting('test.directory_admin_id')::uuid,'Admin-test-42!','New-student-42!');
  assert r->>'code'='CW_STUDENT_NOT_FOUND','admin password may not be reset here';
  r:=public.cw_admin_reset_student_password(a,gen_random_uuid(),'Admin-test-42!','New-student-42!');assert r->>'code'='CW_STUDENT_NOT_FOUND';
  r:=public.cw_admin_reset_student_password(a,uid,'Admin-test-42!','New-student-42!');
  assert r=jsonb_build_object('ok',true,'user_id',uid),'reset response leaked extra fields';
  assert public.cw_me(s) is null,'previous student session remains valid';
end;
$test$;
reset role;
do $verify$
declare u public.cw_users;
begin
  select * into u from public.cw_users where id=current_setting('test.directory_target')::uuid;
  assert u.password_hash=extensions.crypt('New-student-42!',u.password_hash);
  assert u.password_hash<>extensions.crypt('Old-student-42!',u.password_hash);
  assert u.password_hash<>'New-student-42!';
  assert u.session_token is null and u.session_expires_at is null;
  assert u.role='student' and u.status='approved' and u.full_name='Test student';
  assert (select birth_date from public.cw_birthdays where user_id=u.id)=date '2000-01-02';
  assert (select attempts from cw_auth_private.limits where bucket='admin-password-reset:'||current_setting('test.directory_admin_id'))=7,'failed requests did not persist quota';
  update cw_auth_private.limits set attempts=10 where bucket='admin-password-reset:'||current_setting('test.directory_admin_id');
end;
$verify$;
set local role anon;
do $quota$
declare r jsonb;
begin
  r:=public.cw_admin_reset_student_password(current_setting('test.directory_admin')::uuid,current_setting('test.directory_target')::uuid,'Admin-test-42!','Another-test-42!');
  assert r->>'code'='CW_RATE_LIMIT';assert current_setting('response.status')='429';assert (r->>'retry_after')::int>0;
end;
$quota$;
reset role;
rollback;
