-- Disposable test database ONLY, after auth-hardening. Fictional fixtures.
begin;
insert into public.cw_class_roster values('6반',1,'테스트학생')
on conflict(class_name,student_number) do update set full_name=excluded.full_name;

set local role anon;
do $test$
declare r jsonb; bad text; n integer:=0;
begin
  foreach bad in array array['','x','Ab9!tes',repeat('x',8),'password','12345678','password1234',repeat('가나',13),repeat('ab',37)] loop
    n:=n+1;
    r:=public.cw_signup('weak-legacy-'||n,bad,'Test','1반','');
    assert r->>'code'='CW_PASSWORD_POLICY','legacy signup accepted weak password';
    r:=public.cw_signup_with_birthday('weak-birth-'||n,bad,'Test','2반','',null,false);
    assert r->>'code'='CW_PASSWORD_POLICY','birthday signup accepted weak password';
    r:=public.cw_signup_with_roster('weak-roster-'||n,bad,'Test','3반','',null,false,null);
    assert r->>'code'='CW_PASSWORD_POLICY','roster signup accepted weak password';
  end loop;
  assert current_setting('response.status')='400','password error must use HTTP 400';
  r:=public.cw_signup('eight-legacy','Ab9!test','Test','1반','');
  assert r->>'session_token' is not null,'8-character legacy signup rejected';
  r:=public.cw_signup_with_birthday('eight-birthday','Ab9!test','Test','2반','',null,false);
  assert r->>'session_token' is not null,'8-character birthday signup rejected';
  r:=public.cw_signup_with_roster('eight-roster','Ab9!test','Test','3반','',null,false,null);
  assert r->>'session_token' is not null,'8-character roster signup rejected';
  r:=public.cw_login('eight-roster','Ab9!test');
  assert r->>'session_token' is not null,'8-character password login failed';
  r:=public.cw_signup('valid-legacy','Long test phrase 42','Test','1반','');
  assert r->>'status'='pending' and r->>'role'='student','legacy approval semantics changed';
  r:=public.cw_signup('valid-unicode',repeat('가나',12),'Test','1반','');
  assert r->>'session_token' is not null,'72-byte unicode password rejected';
  r:=public.cw_login('valid-unicode',repeat('가나',12));
  assert r->>'session_token' is not null,'unicode password round trip failed';
  r:=public.cw_signup_with_birthday('valid-birthday','Long test phrase 42','Test','2반','',date '2000-01-01',true);
  assert public.cw_get_my_birthday((r->>'session_token')::uuid)->>'birth_date'='2000-01-01','birthday missing';
  r:=public.cw_signup_with_roster('valid-roster','Long test phrase 42','테스트학생','6반','',null,false,1);
  assert r->>'status'='pending','valid class roster failed';
  r:=public.cw_signup_with_roster('invalid-birthday','Long test phrase 42','Test','2반','',(now() at time zone 'Asia/Seoul')::date+1,false,null);
  assert r->>'code'='CW_INVALID_INPUT','future birthday accepted';
  r:=public.cw_signup('legacy-roster-bypass','Long test phrase 42','테스트학생','6반','');
  assert r->>'code'='CW_INVALID_INPUT','legacy bypassed roster';
  r:=public.cw_signup_with_birthday('birth-roster-bypass','Long test phrase 42','테스트학생','6반','',null,false);
  assert r->>'code'='CW_INVALID_INPUT','birthday bypassed roster';
  r:=public.cw_signup_with_roster('bad-roster','Long test phrase 42','Wrong name','6반','',null,false,1);
  assert r->>'code'='CW_INVALID_INPUT','roster mismatch accepted';
  -- Alternate RPC names share the same username quota (including casing/space).
  perform public.cw_signup('shared-user','','Test','1반','');
  perform public.cw_signup_with_birthday(' SHARED-USER ','x','Test','1반','',null,false);
  perform public.cw_signup_with_roster('shared-user','x','Test','2반','',null,false,null);
  r:=public.cw_signup('shared-user','Long test phrase 42','Test','1반','');
  assert r->>'code'='CW_RATE_LIMIT','signup alias bypass';
  assert current_setting('response.status')='429' and (r->>'retry_after')::int>0,'rate response invalid';
  begin
    perform cw_auth_private.cw_login('valid-legacy','Long test phrase 42');
    raise exception 'raw function reachable';
  exception when insufficient_privilege then null; end;
  begin
    delete from cw_auth_private.limits;
    raise exception 'quota table writable';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;
do $test$
begin
  assert not exists(select 1 from public.cw_users where username like 'weak-%' or username='invalid-birthday'),'failed signup left data';
  assert (select attempts=1 from cw_auth_private.limits where bucket='signup:'||encode(extensions.digest('invalid-birthday','sha256'),'hex')),'failed insert rolled back quota';
  assert not has_function_privilege('anon','public.cw_login(integer,text)','execute'),'obsolete overload exposed';
  assert not has_function_privilege('authenticated','cw_auth_private.cw_login(text,text)','execute'),'raw function grant exposed';
  assert not has_schema_privilege('anon','cw_auth_private','usage'),'private schema exposed';
end;
$test$;
-- Existing weak passwords still log in; approval and expiry rules remain unchanged.
insert into public.cw_users(username,password_hash,full_name,class_name,role,status)
values('old-member',extensions.crypt('old',extensions.gen_salt('bf')),'Old','1반','student','approved'),
('old-admin',extensions.crypt('old',extensions.gen_salt('bf')),'Admin','1반','admin','approved');
insert into public.cw_users(username,password_hash,full_name,class_name,role,status)
values(repeat('long-id',16),extensions.crypt('old',extensions.gen_salt('bf')),'Old','1반','student','approved');
truncate cw_auth_private.limits;
set local role anon;
do $test$
declare r jsonb;
begin
  r:=public.cw_login('old-member','old');
  assert r->>'role'='student' and public.cw_me((r->>'session_token')::uuid) is not null,'existing member login broken';
  r:=public.cw_login('old-admin','old');
  assert r->>'role'='admin','existing admin login broken';
  r:=public.cw_login(repeat('long-id',16),'old');
  assert r->>'session_token' is not null,'existing long username locked out';
  for i in 1..10 loop
    r:=public.cw_login(' VALID-LEGACY ','wrong');
    assert r->>'code'='CW_INVALID_CREDENTIALS','unexpected early limit';
  end loop;
  r:=public.cw_login('valid-legacy','Long test phrase 42');
  assert r->>'code'='CW_RATE_LIMIT','login failure quota rolled back';
  r:=public.cw_login('valid-birthday','Long test phrase 42');
  assert r->>'session_token' is not null,'other account incorrectly blocked';
end;
$test$;
reset role;
do $test$
begin
  assert (select session_expires_at between now()+interval '23 hours' and now()+interval '25 hours' from public.cw_users where username='old-member'),'student expiry changed';
  assert (select session_expires_at between now()+interval '11 hours' and now()+interval '13 hours' from public.cw_users where username='old-admin'),'admin expiry changed';
end;
$test$;
update cw_auth_private.limits set resets_at=now()-interval '1 second' where bucket like 'login:%';
set local role anon;
do $test$
declare r jsonb;
begin
  r:=public.cw_login('valid-legacy','Long test phrase 42');
  assert r->>'session_token' is not null,'cooldown did not expire';
end;
$test$;
reset role;
truncate cw_auth_private.limits;
set local role authenticated;
do $test$
declare r jsonb;
begin
  -- Rotation cannot bypass the global ceilings, even with arbitrary forwarded headers.
  for i in 1..300 loop
    perform set_config('request.headers',jsonb_build_object('x-forwarded-for','192.0.2.'||(i%255))::text,true);
    r:=public.cw_login('unknown-'||i,'wrong');
    assert r->>'code'='CW_INVALID_CREDENTIALS','unexpected global login cap';
  end loop;
  r:=public.cw_login('old-member','old');
  assert r->>'code'='CW_RATE_LIMIT','global login ceiling bypassed';
  for i in 1..60 loop
    r:=public.cw_signup('global-signup-'||i,'x','Test','1반','');
    assert r->>'code'='CW_PASSWORD_POLICY','unexpected global signup cap';
  end loop;
  r:=public.cw_signup_with_roster('global-last','Long test phrase 42','Test','1반','',null,false,null);
  assert r->>'code'='CW_RATE_LIMIT','global signup ceiling bypassed';
end;
$test$;
reset role;
do $test$
begin
  assert (select count(*)=62 from cw_auth_private.limits),'unknown login names grew per-name storage';
end;
$test$;
rollback;
