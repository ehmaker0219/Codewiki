-- Transaction-only fixtures for 20261123-auth-review-hardening.sql.
begin;
do $test$
declare r jsonb; i integer;
begin
  truncate cw_auth_private.limits;
  insert into public.cw_users(username,password_hash,full_name,class_name,role,status)
  values ('review-known',extensions.crypt('Long test phrase 42',extensions.gen_salt('bf')),'Known','2반','student','approved');

  -- Known and unknown names hit the per-name limit on the same attempt.
  for i in 1..10 loop
    r:=cw_auth_private.request('login','review-known','wrong password');
    assert r->>'code'='CW_INVALID_CREDENTIALS','known name failure code';
  end loop;
  r:=cw_auth_private.request('login','review-known','wrong password');
  assert r->>'code'='CW_RATE_LIMIT','known name must be limited after 10 attempts';
  for i in 1..10 loop
    r:=cw_auth_private.request('login','review-missing','wrong password');
    assert r->>'code'='CW_INVALID_CREDENTIALS','unknown name failure code';
  end loop;
  r:=cw_auth_private.request('login','review-missing','wrong password');
  assert r->>'code'='CW_RATE_LIMIT','unknown names must be limited exactly like known names';

  -- Correct credentials still work (case-insensitive) and record student logins.
  truncate cw_auth_private.limits;
  r:=cw_auth_private.request('login','REVIEW-KNOWN','Long test phrase 42');
  assert r->>'session_token' is not null,'valid login failed';
  assert exists(select 1 from cw_auth_private.login_logs l join public.cw_users u on u.id=l.user_id where u.username='review-known'),'login history missing';

  -- Server-side MBTI validation on every signup path.
  r:=cw_auth_private.request('legacy','review-mbti-bad','Long test phrase 42','Test','2반','<b>x</b>');
  assert r->>'code'='CW_INVALID_INPUT','invalid MBTI accepted';
  r:=cw_auth_private.request('roster','review-mbti-bad2','Long test phrase 42','Test','2반','ABCD',null,false,null);
  assert r->>'code'='CW_INVALID_INPUT','invalid roster MBTI accepted';
  assert not exists(select 1 from public.cw_users where username like 'review-mbti-bad%'),'invalid MBTI created a user';
  r:=cw_auth_private.request('legacy','review-mbti-ok','Long test phrase 42','Test','2반','intj');
  assert r->>'session_token' is not null,'valid lowercase MBTI rejected';
  assert (select mbti from public.cw_users where username='review-mbti-ok')='INTJ','MBTI not normalized';
  r:=cw_auth_private.request('legacy','review-mbti-empty','Long test phrase 42','Test','2반','');
  assert r->>'session_token' is not null,'empty MBTI rejected';

  assert to_regclass('public.cw_users_lower_username_idx') is not null,'lower(username) index missing';
  assert not has_function_privilege('anon','cw_auth_private.request(text,text,text,text,text,text,date,boolean,integer)','execute'),'private request reachable';
  assert not has_function_privilege('anon','cw_auth_private.cw_login(text,text)','execute'),'private login reachable';
  assert not has_function_privilege('anon','public.cw_login(text,text)','execute'),'plaintext login reopened';
  assert has_function_privilege('service_role','public.cw_secure_auth(text,jsonb,uuid,timestamptz,text)','execute'),'gateway overload not granted';
  assert has_function_privilege('service_role','public.cw_secure_auth(text,jsonb,uuid,timestamptz)','execute'),'legacy gateway not granted';
  assert not has_function_privilege('anon','public.cw_secure_auth(text,jsonb,uuid,timestamptz,text)','execute'),'gateway reachable by anon';
  assert not has_function_privilege('authenticated','public.cw_secure_auth(text,jsonb,uuid,timestamptz,text)','execute'),'gateway reachable by authenticated';
end;
$test$;

-- Per-client limits: one client cannot lock out others or exhaust the shared ceilings.
do $test$
declare r jsonb; i integer; attacker text:=repeat('a',64); other text:=repeat('b',64);
  -- No password: rejected before bcrypt, so the loop stays fast.
  login_args jsonb;
begin
  truncate cw_auth_private.limits;
  for i in 1..120 loop
    login_args:=jsonb_build_object('p_username','client-flood-'||i);
    r:=public.cw_secure_auth('cw_login',login_args,gen_random_uuid(),clock_timestamp()+interval '60 seconds',attacker);
    assert r->>'code'='CW_INVALID_CREDENTIALS','within per-client limit: '||coalesce(r->>'code','null');
  end loop;
  r:=public.cw_secure_auth('cw_login',jsonb_build_object('p_username','client-flood-x'),gen_random_uuid(),clock_timestamp()+interval '60 seconds',attacker);
  assert r->>'code'='CW_RATE_LIMIT','client over 120 logins / 5 min must be limited';
  for i in 1..30 loop
    r:=public.cw_secure_auth('cw_login',jsonb_build_object('p_username','client-flood-x'),gen_random_uuid(),clock_timestamp()+interval '60 seconds',attacker);
    assert r->>'code'='CW_RATE_LIMIT','limited client stays limited';
  end loop;
  assert (select attempts from cw_auth_private.limits where bucket='login:global')=120,'rejected client requests must not consume the shared login ceiling';
  assert (select attempts from cw_auth_private.limits where bucket='encrypted-auth:global')=120,'rejected client requests must not consume the gateway ceiling';
  r:=public.cw_secure_auth('cw_login',jsonb_build_object('p_username','client-other'),gen_random_uuid(),clock_timestamp()+interval '60 seconds',other);
  assert r->>'code'='CW_INVALID_CREDENTIALS','another client is unaffected';
  r:=public.cw_secure_auth('cw_login',jsonb_build_object('p_username','client-legacy'),gen_random_uuid(),clock_timestamp()+interval '60 seconds');
  assert r->>'code'='CW_INVALID_CREDENTIALS','legacy 4-argument gateway still works';
  r:=public.cw_secure_auth('cw_login',jsonb_build_object('p_username','client-bad'),gen_random_uuid(),clock_timestamp()+interval '60 seconds','203.0.113.7');
  assert r->>'code'='CW_ENVELOPE_INVALID','raw or malformed client keys are rejected';
  assert not exists(select 1 from cw_auth_private.limits where bucket like '%203.0.113.7%'),'raw IP must never be stored';
end;
$test$;
rollback;
