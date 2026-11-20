begin;
reset role;
truncate cw_auth_private.limits,cw_auth_private.used_envelopes;
insert into public.cw_users(username,password_hash,full_name,class_name,role,status,session_token,session_expires_at)
values('encrypted-admin-fixture',extensions.crypt('Synthetic-Admin-42!',extensions.gen_salt('bf')),'Fixture','2반','admin','approved',
  '12345678-1234-4234-8234-123456789012',now()+interval '1 hour');
do $test$
declare f record; r text;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('cw_login','cw_signup','cw_signup_with_birthday','cw_signup_with_roster','cw_admin_reset_student_password','cw_secure_auth') loop
    foreach r in array array['anon','authenticated'] loop
      assert not has_function_privilege(r,f.signature,'EXECUTE'),'plaintext or gateway bypass permission';
    end loop;
  end loop;
  assert has_function_privilege('service_role','public.cw_secure_auth(text,jsonb,uuid,timestamptz)','EXECUTE');
  assert not has_table_privilege('anon','cw_auth_private.used_envelopes','SELECT');
end;
$test$;
set role service_role;
do $test$
declare r jsonb; n uuid:=gen_random_uuid(); token uuid; uid uuid;
  args jsonb:=jsonb_build_object('p_username','encrypted-fixture','p_password','Synthetic-Fixture-42!',
    'p_full_name','Fixture','p_class_name','2반','p_mbti','INTJ','p_birth_date',null,'p_share_with_class',false,'p_student_number',null);
begin
  r:=public.cw_secure_auth('cw_signup_with_roster',args,n,clock_timestamp()+interval '60 seconds');
  token:=(r->>'session_token')::uuid;assert token is not null,'encrypted signup failed';
  uid:=(public.cw_me(token)->>'id')::uuid;
  assert (select count(*) from jsonb_object_keys(r))=1,'signup response has extra fields';
  r:=public.cw_secure_auth('cw_signup_with_roster',args,n,clock_timestamp()+interval '60 seconds');
  assert r->>'code'='CW_REPLAY','same envelope executed twice';
  args:=jsonb_build_object('p_username','encrypted-fixture','p_password','Synthetic-Fixture-42!');
  r:=public.cw_secure_auth('cw_login',args,gen_random_uuid(),clock_timestamp()+interval '60 seconds');
  assert (r->>'session_token')::uuid<>token,'login failed';
  assert (select count(*) from jsonb_object_keys(r))=1,'login response has extra fields';
  n:=gen_random_uuid();args:=args||'{"p_password":"wrong-synthetic-password"}'::jsonb;
  r:=public.cw_secure_auth('cw_login',args,n,clock_timestamp()+interval '60 seconds');
  assert r='{"code":"CW_INVALID_CREDENTIALS"}'::jsonb,'failure leaked details';
  r:=public.cw_secure_auth('cw_login',args,n,clock_timestamp()+interval '60 seconds');
  assert r->>'code'='CW_REPLAY','failed request reused';
  r:=public.cw_secure_auth('cw_login',args,gen_random_uuid(),clock_timestamp()-interval '1 second');
  assert r->>'code'='CW_ENVELOPE_INVALID','expired accepted';
  r:=public.cw_secure_auth('cw_login',args,gen_random_uuid(),clock_timestamp()+interval '1 hour');
  assert r->>'code'='CW_ENVELOPE_INVALID','unbounded expiration accepted';
  r:=public.cw_secure_auth('cw_admin_reset_student_password',jsonb_build_object('p_token',token,'p_target_id',gen_random_uuid(),
    'p_admin_password','Synthetic-Fixture-42!','p_new_password','Synthetic-Reset-42!'),gen_random_uuid(),clock_timestamp()+interval '60 seconds');
  assert r='{"code":"CW_ADMIN_REQUIRED"}'::jsonb,'student reset bypass';
  n:=gen_random_uuid();
  r:=public.cw_secure_auth('cw_admin_reset_student_password',jsonb_build_object('p_token','12345678-1234-4234-8234-123456789012','p_target_id',uid,
    'p_admin_password','Synthetic-Admin-42!','p_new_password','Synthetic-Reset-42!'),n,clock_timestamp()+interval '60 seconds');
  assert r=jsonb_build_object('ok',true,'user_id',uid),'reset failed or leaked details';
  r:=public.cw_secure_auth('cw_admin_reset_student_password',jsonb_build_object('p_token','12345678-1234-4234-8234-123456789012','p_target_id',uid,
    'p_admin_password','Synthetic-Admin-42!','p_new_password','Synthetic-Reset-42!'),n,clock_timestamp()+interval '60 seconds');
  assert r->>'code'='CW_REPLAY','reset replayed';
  r:=public.cw_secure_auth('cw_login',jsonb_build_object('p_username','encrypted-fixture','p_password','Synthetic-Reset-42!'),gen_random_uuid(),clock_timestamp()+interval '60 seconds');
  assert r->>'session_token' is not null,'new password login failed';
end;
$test$;
reset role;
rollback;
