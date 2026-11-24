-- 2026-11-24 Full Code Review Security & Reliability Hardening.
-- Apply LAST, after 20261124-signup-login-log.sql.
-- Idempotent; keeps all private schemas/functions and plaintext credential RPCs locked.
--  1. Upgrade bcrypt work factor from default cost 6 to cost 10 on signup,
--     admin password reset, and opportunistic rehash during successful login.
--  2. Simplify cw_login to a single indexed SELECT ... LIMIT 1, compare unknown
--     usernames against a constant cost-10 dummy hash (no gen_salt overhead),
--     and stop inserting login_logs for rejected student accounts.
--  3. Replace bare cleanup DELETEs with bounded FOR UPDATE SKIP LOCKED deletes
--     to prevent AB-BA deadlocks (40P01) on limits/used_envelopes, and apply
--     180-day retention to cw_auth_private.login_logs.
--  4. Enforce a conservative fallback client bucket when p_client IS NULL so
--     missing/unparseable IP headers cannot jump directly to the 10x global ceiling.
--  5. Add optional p_user_id exact filtering to public.cw_admin_login_history
--     so student drill-down stays complete even when global logins exceed 100 rows.
begin;
set local lock_timeout = '5s';

-- 1-a. Cost-10 bcrypt on legacy private signup.
create or replace function cw_auth_private.cw_signup(
  p_username text,
  p_password text,
  p_full_name text,
  p_class_name text default '기본반',
  p_mbti text default ''
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, public, extensions, pg_temp
as $fn$
declare
  v_clean_id text := lower(trim(p_username));
  v_user public.cw_users;
begin
  if length(v_clean_id) < 2 then
    raise exception '아이디는 2자 이상 입력해 주세요.';
  end if;

  if exists (select 1 from public.cw_users where lower(username) = v_clean_id) then
    raise exception '이미 사용 중인 아이디입니다.';
  end if;

  insert into public.cw_users (username, password_hash, full_name, class_name, mbti, role, status, session_token, session_expires_at)
  values (
    v_clean_id,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    trim(p_full_name),
    coalesce(nullif(trim(p_class_name), ''), '기본반'),
    upper(trim(coalesce(p_mbti, ''))),
    'student',
    'pending',
    gen_random_uuid(),
    now() + interval '24 hours'
  )
  returning * into v_user;

  return jsonb_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'full_name', v_user.full_name,
    'class_name', v_user.class_name,
    'mbti', v_user.mbti,
    'role', v_user.role,
    'status', v_user.status,
    'session_token', v_user.session_token
  );
end;
$fn$;

-- 1-b. Cost-10 bcrypt on roster signup.
create or replace function cw_auth_private.cw_signup_with_roster(
  p_username text, p_password text, p_full_name text, p_class_name text, p_mbti text,
  p_birth_date date, p_share_with_class boolean, p_student_number integer
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, public, extensions, pg_temp
as $fn$
declare
  v_id text := lower(trim(p_username));
  v_name text := trim(p_full_name);
  v_class text := trim(p_class_name);
  v_user public.cw_users;
begin
  if v_id is null or length(v_id) < 2 then
    raise exception '아이디는 2자 이상 입력해 주세요.' using errcode='22023';
  end if;
  if p_password is null or length(p_password) = 0 then
    raise exception '비밀번호를 입력해 주세요.' using errcode='22023';
  end if;
  if v_name is null or length(v_name) not between 1 and 50 then
    raise exception '이름을 확인해 주세요.' using errcode='22023';
  end if;
  if v_class is null or v_class not in ('1반','2반','3반','4반','5반','6반','7반') then
    raise exception '소속 반을 확인해 주세요.' using errcode='22023';
  end if;
  if exists(select 1 from public.cw_users where lower(username)=v_id) then
    raise exception '이미 사용 중인 아이디입니다.' using errcode='23505';
  end if;
  insert into public.cw_users (
    username,password_hash,full_name,class_name,mbti,role,status,
    student_number,session_token,session_expires_at
  ) values (
    v_id,extensions.crypt(p_password,extensions.gen_salt('bf', 10)),v_name,v_class,
    upper(trim(coalesce(p_mbti,''))),'student','pending',
    case when v_class='6반' then p_student_number else null end,
    gen_random_uuid(),now()+interval '24 hours'
  ) returning * into v_user;
  perform public.cw_set_my_birthday(v_user.session_token,p_birth_date,p_share_with_class);
  return jsonb_build_object(
    'id',v_user.id,'username',v_user.username,'full_name',v_user.full_name,
    'class_name',v_user.class_name,'mbti',v_user.mbti,'role',v_user.role,
    'status',v_user.status,'session_token',v_user.session_token
  );
end;
$fn$;

-- 1-c. Cost-10 bcrypt on admin password reset (only callable via cw_secure_auth).
create or replace function public.cw_admin_reset_student_password(
  p_token uuid,p_target_id uuid,p_admin_password text,p_new_password text
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare caller public.cw_users; wait_seconds integer; policy_error text;
begin
  perform set_config('response.status','200',true);
  perform set_config('response.headers','[]',true);
  select * into caller from public.cw_users
    where session_token=p_token and session_expires_at>now() and role='admin' for share;
  if not found then
    return cw_auth_private.error_response(403,'CW_ADMIN_REQUIRED','관리자 로그인이 필요합니다.');
  end if;
  wait_seconds:=cw_auth_private.consume('admin-password-reset:'||caller.id::text,10,300);
  if wait_seconds>0 then
    return cw_auth_private.error_response(429,'CW_RATE_LIMIT','시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.',wait_seconds);
  end if;
  if p_admin_password is null or octet_length(p_admin_password)>4096 then
    return cw_auth_private.error_response(400,'CW_ADMIN_PASSWORD','관리자 비밀번호를 확인해 주세요.');
  end if;
  if caller.password_hash is distinct from extensions.crypt(p_admin_password,caller.password_hash) then
    return cw_auth_private.error_response(400,'CW_ADMIN_PASSWORD','관리자 비밀번호를 확인해 주세요.');
  end if;
  policy_error:=cw_auth_private.password_error(p_new_password);
  if policy_error is not null then
    return cw_auth_private.error_response(400,'CW_PASSWORD_POLICY',policy_error);
  end if;
  -- Never reset another administrator or change approval/profile data.
  update public.cw_users set password_hash=extensions.crypt(p_new_password,extensions.gen_salt('bf', 10)),
    session_token=null,session_expires_at=null
    where id=p_target_id and role='student';
  if not found then
    return cw_auth_private.error_response(404,'CW_STUDENT_NOT_FOUND','학생 계정을 찾을 수 없습니다.');
  end if;
  return jsonb_build_object('ok',true,'user_id',p_target_id);
end;
$fn$;

-- 2. Single-lookup cw_login with constant cost-10 dummy hash, opportunistic
--    cost-10 rehash, and rejected-student exclusion from login_logs.
create or replace function cw_auth_private.cw_login(
  p_username text,
  p_password text
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, public, extensions, pg_temp
as $fn$
declare
  v_user public.cw_users;
  v_new_token uuid := gen_random_uuid();
  v_dummy_hash constant text := '$2a$10$CwTycUXWue0Thq9StjUM0uJ8hG2eJ4kR3nW6z9P2rX5qL1vB8mK7u';
  v_cost integer;
  v_next_hash text;
begin
  select * into v_user
  from public.cw_users
  where lower(username) = lower(trim(p_username))
  limit 1;

  if not found then
    perform extensions.crypt(coalesce(p_password, ''), v_dummy_hash);
    raise exception '아이디 또는 비밀번호를 확인해 주세요.';
  end if;

  if v_user.password_hash is distinct from extensions.crypt(p_password, v_user.password_hash) then
    raise exception '아이디 또는 비밀번호를 확인해 주세요.';
  end if;

  -- Opportunistically upgrade legacy cost-6 hashes to cost-10 on valid login.
  v_cost := coalesce(substring(v_user.password_hash from '^\$2[aby]\$(\d{2})\$')::integer, 0);
  if v_cost < 10 then
    v_next_hash := extensions.crypt(p_password, extensions.gen_salt('bf', 10));
  else
    v_next_hash := v_user.password_hash;
  end if;

  update public.cw_users
  set password_hash = v_next_hash,
      session_token = v_new_token,
      session_expires_at = now() + case when v_user.role = 'admin' then interval '12 hours' else interval '24 hours' end
  where id = v_user.id;

  if v_user.role = 'student' and v_user.status <> 'rejected' then
    insert into cw_auth_private.login_logs (user_id, logged_in_at)
    values (v_user.id, clock_timestamp());
  end if;

  return jsonb_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'full_name', v_user.full_name,
    'class_name', v_user.class_name,
    'mbti', v_user.mbti,
    'role', v_user.role,
    'status', v_user.status,
    'session_token', v_new_token
  );
end;
$fn$;

-- 3. Deadlock-free bounded cleanup + signup login log preservation in request().
create or replace function cw_auth_private.request(
  p_action text,p_username text,p_password text,p_full_name text default null,
  p_class_name text default '기본반',p_mbti text default '',p_birth_date date default null,
  p_share_with_class boolean default false,p_student_number integer default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, extensions, pg_temp
as $fn$
declare v_login boolean:=p_action='login'; v_id text:=lower(trim(p_username));
  v_now timestamptz:=clock_timestamp(); v_wait integer; v_error text; v_result jsonb; v_global text;
begin
  perform set_config('response.status','200',true);
  perform set_config('response.headers','[]',true);
  v_global:=case when v_login then 'login:global' else 'signup:global' end;
  -- Bounded SKIP LOCKED cleanup avoids AB-BA lock inversion with concurrent per-client upserts.
  if not exists(select 1 from cw_auth_private.limits where bucket=v_global and resets_at>v_now) then
    delete from cw_auth_private.limits
    where bucket in (
      select bucket from cw_auth_private.limits
      where resets_at < v_now - interval '1 day'
      order by bucket
      limit 500
      for update skip locked
    );
  end if;
  v_wait:=cw_auth_private.consume(v_global,case when v_login then 3000 else 600 end,case when v_login then 300 else 3600 end);
  if v_wait>0 then
    return cw_auth_private.error_response(429,'CW_RATE_LIMIT','요청이 많습니다. 잠시 후 다시 시도해 주세요.',v_wait);
  end if;
  if v_id is null or char_length(v_id)<2 or (not v_login and char_length(v_id)>100) then
    return cw_auth_private.error_response(400,'CW_INVALID_INPUT','아이디는 2~100자로 입력해 주세요.');
  end if;
  -- Same quota for known and unknown names: a 429 must not confirm an account.
  v_wait:=cw_auth_private.consume(
    case when v_login then 'login:' else 'signup:' end || encode(extensions.digest(v_id,'sha256'),'hex'),
    case when v_login then 10 else 3 end,case when v_login then 300 else 900 end);
  if v_wait>0 then
    return cw_auth_private.error_response(429,'CW_RATE_LIMIT','시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.',v_wait);
  end if;
  if not v_login then
    v_error:=cw_auth_private.password_error(p_password);
    if v_error is not null then return cw_auth_private.error_response(400,'CW_PASSWORD_POLICY',v_error); end if;
    if upper(trim(coalesce(p_mbti,''))) !~ '^([EI][SN][TF][JP])?$' then
      return cw_auth_private.error_response(400,'CW_INVALID_INPUT','MBTI를 확인해 주세요.');
    end if;
  elsif p_password is null or octet_length(p_password)>4096 then
    return cw_auth_private.error_response(400,'CW_INVALID_CREDENTIALS','아이디 또는 비밀번호를 확인해 주세요.');
  end if;
  -- Only application writes roll back on failure; quota updates above survive.
  begin
    if v_login then
      v_result:=cw_auth_private.cw_login(v_id,p_password);
    elsif p_action='roster' then
      v_result:=cw_auth_private.cw_signup_with_roster(v_id,p_password,p_full_name,p_class_name,p_mbti,p_birth_date,p_share_with_class,p_student_number);
    else
      v_result:=cw_auth_private.cw_signup(v_id,p_password,p_full_name,p_class_name,p_mbti);
      if p_action='birthday' then
        perform public.cw_set_my_birthday((v_result->>'session_token')::uuid,p_birth_date,p_share_with_class);
      end if;
    end if;
    -- Signup immediately issues an active 24h session token; log this initial student session.
    if not v_login
       and v_result->>'role' = 'student'
       and v_result->>'id' is not null
       and v_result->>'session_token' is not null then
      insert into cw_auth_private.login_logs (user_id, logged_in_at)
      values ((v_result->>'id')::uuid, clock_timestamp());
    end if;
    return v_result;
  exception when others then
    if v_login then
      return cw_auth_private.error_response(400,'CW_INVALID_CREDENTIALS','아이디 또는 비밀번호를 확인해 주세요.');
    elsif sqlstate in ('P0001','22023') then
      return cw_auth_private.error_response(400,'CW_INVALID_INPUT',sqlerrm);
    elsif sqlstate='23505' then
      return cw_auth_private.error_response(400,'CW_INVALID_INPUT','이미 사용 중인 가입 정보입니다.');
    else
      return cw_auth_private.error_response(400,'CW_SIGNUP_FAILED','가입 신청을 처리하지 못했습니다. 입력 내용을 확인해 주세요.');
    end if;
  end;
end;
$fn$;

-- 4. Encrypted auth gateway: missing-IP fallback bucket + SKIP LOCKED cleanup + 180d login_logs retention.
create or replace function public.cw_secure_auth(
  p_operation text,p_args jsonb,p_request_id uuid,p_expires_at timestamptz,p_client text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp
as $fn$
declare v_now timestamptz:=clock_timestamp(); v_wait integer; v_result jsonb; v_op text; v_client_bucket text;
begin
  perform set_config('response.status','200',true);
  perform set_config('response.headers','[]',true);
  if p_operation is null or p_operation not in ('cw_login','cw_signup_with_roster','cw_admin_reset_student_password')
     or p_request_id is null or p_expires_at is null or p_expires_at<=v_now or p_expires_at>v_now+interval '70 seconds'
     or p_args is null or jsonb_typeof(p_args)<>'object' or octet_length(p_args::text)>12000
     or (p_client is not null and p_client !~ '^[0-9a-f]{64}$') then
    return cw_auth_private.error_response(400,'CW_ENVELOPE_INVALID','보안 요청을 확인해 주세요.');
  end if;
  v_op:=case p_operation when 'cw_login' then 'login' when 'cw_signup_with_roster' then 'signup' else 'reset' end;
  -- Always enforce a client-tier bucket: missing IP headers share a conservative fallback
  -- bucket instead of jumping straight into the 10x global ceiling.
  v_client_bucket:=case when p_client is not null then 'client:'||v_op||':'||p_client else 'client:missing:'||v_op end;
  v_wait:=cw_auth_private.consume(
    v_client_bucket,
    case p_operation when 'cw_login' then 120 else 60 end,
    case p_operation when 'cw_signup_with_roster' then 3600 else 300 end);
  if v_wait>0 then return cw_auth_private.error_response(429,'CW_RATE_LIMIT','요청이 많습니다. 잠시 후 다시 시도해 주세요.',v_wait); end if;
  -- Bounded SKIP LOCKED cleanup of expired nonces and 180-day login_logs once per global window.
  if not exists(select 1 from cw_auth_private.limits where bucket='encrypted-auth:global' and resets_at>v_now) then
    delete from cw_auth_private.used_envelopes
    where request_id in (
      select request_id from cw_auth_private.used_envelopes
      where expires_at < v_now - interval '5 minutes'
      order by request_id
      limit 500
      for update skip locked
    );
    delete from cw_auth_private.login_logs
    where id in (
      select id from cw_auth_private.login_logs
      where logged_in_at < v_now - interval '180 days'
      order by id
      limit 500
      for update skip locked
    );
  end if;
  v_wait:=cw_auth_private.consume('encrypted-auth:global',6000,300);
  if v_wait>0 then return cw_auth_private.error_response(429,'CW_RATE_LIMIT','잠시 후 다시 시도해 주세요.',v_wait); end if;
  insert into cw_auth_private.used_envelopes values(p_request_id,p_expires_at) on conflict do nothing;
  if not found then return cw_auth_private.error_response(409,'CW_REPLAY','이미 처리된 요청입니다.'); end if;
  -- Keep the nonce consumed even if authentication fails. No exception text leaves
  -- this boundary (Postgres errors can contain failing-row/parameter details).
  begin
    if p_operation='cw_login' then
      v_result:=cw_auth_private.request('login',p_args->>'p_username',p_args->>'p_password');
    elsif p_operation='cw_signup_with_roster' then
      v_result:=cw_auth_private.request('roster',p_args->>'p_username',p_args->>'p_password',
        p_args->>'p_full_name',p_args->>'p_class_name',p_args->>'p_mbti',
        (p_args->>'p_birth_date')::date,(p_args->>'p_share_with_class')::boolean,(p_args->>'p_student_number')::integer);
    else
      v_result:=public.cw_admin_reset_student_password((p_args->>'p_token')::uuid,(p_args->>'p_target_id')::uuid,
        p_args->>'p_admin_password',p_args->>'p_new_password');
    end if;
    if v_result ? 'code' then
      return jsonb_build_object('code',v_result->>'code');
    end if;
    if p_operation='cw_admin_reset_student_password' then
      return jsonb_build_object('ok',v_result->'ok','user_id',v_result->'user_id');
    end if;
    return jsonb_build_object('session_token',v_result->'session_token');
  exception when others then
    return cw_auth_private.error_response(400,'CW_INVALID_INPUT','입력 내용을 확인해 주세요.');
  end;
end;
$fn$;

create or replace function public.cw_secure_auth(
  p_operation text,p_args jsonb,p_request_id uuid,p_expires_at timestamptz
) returns jsonb language sql security definer set search_path=pg_catalog,pg_temp
as $fn$ select public.cw_secure_auth(p_operation,p_args,p_request_id,p_expires_at,null::text); $fn$;

-- 5. Keep admin student directory in sync with login_logs even if an older
--    admin migration is reapplied before this final migration, and add exact
--    per-student drill-down (p_user_id) to cw_admin_login_history.
create or replace function public.cw_admin_student_directory(p_token uuid)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
begin
  perform 1 from public.cw_users
    where session_token = p_token and session_expires_at > now() and role = 'admin'
    for share;
  if not found then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', u.id,
      'username', u.username,
      'full_name', u.full_name,
      'class_name', u.class_name,
      'student_number', u.student_number,
      'mbti', u.mbti,
      'status', u.status,
      'birth_date', b.birth_date,
      'created_at', u.created_at,
      'last_login_at', l.last_login_at,
      'login_count', coalesce(l.login_count, 0)
    ) order by u.full_name, u.id)
    from public.cw_users u
    left join public.cw_birthdays b on b.user_id = u.id
    left join (
      select user_id, max(logged_in_at) as last_login_at, count(*)::integer as login_count
      from cw_auth_private.login_logs
      group by user_id
    ) l on l.user_id = u.id
    where u.role = 'student'
  ), '[]'::jsonb);
end;
$fn$;

-- The 3-argument overload has no defaults, so PostgREST resolves 1-2 named
-- arguments to the legacy 2-argument overload and 3 to this overload cleanly.
create or replace function public.cw_admin_login_history(
  p_token uuid,
  p_limit integer,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 200));
begin
  perform 1 from public.cw_users
    where session_token = p_token and session_expires_at > now() and role = 'admin'
    for share;
  if not found then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id,
      'user_id', e.user_id,
      'username', e.username,
      'full_name', e.full_name,
      'class_name', e.class_name,
      'student_number', e.student_number,
      'status', e.status,
      'logged_in_at', e.logged_in_at
    ) order by e.logged_in_at desc, e.id desc)
    from (
      select
        l.id,
        l.user_id,
        u.username,
        u.full_name,
        u.class_name,
        u.student_number,
        u.status,
        l.logged_in_at
      from cw_auth_private.login_logs l
      join public.cw_users u on u.id = l.user_id
      where u.role = 'student'
        and (p_user_id is null or l.user_id = p_user_id)
      order by l.logged_in_at desc, l.id desc
      limit v_limit
    ) e
  ), '[]'::jsonb);
end;
$fn$;

create or replace function public.cw_admin_login_history(
  p_token uuid,
  p_limit integer default 100
)
returns jsonb
language sql
security definer set search_path = pg_catalog, pg_temp
as $fn$
  select public.cw_admin_login_history(p_token, p_limit, null::uuid);
$fn$;

revoke all on function public.cw_admin_student_directory(uuid), public.cw_admin_login_history(uuid, integer), public.cw_admin_login_history(uuid, integer, uuid) from public;
grant execute on function public.cw_admin_student_directory(uuid), public.cw_admin_login_history(uuid, integer), public.cw_admin_login_history(uuid, integer, uuid) to anon, authenticated;

revoke all on function public.cw_secure_auth(text,jsonb,uuid,timestamptz,text) from public,anon,authenticated;
revoke all on function public.cw_secure_auth(text,jsonb,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.cw_secure_auth(text,jsonb,uuid,timestamptz,text) to service_role;
grant execute on function public.cw_secure_auth(text,jsonb,uuid,timestamptz) to service_role;

revoke all on all functions in schema cw_auth_private from public, anon, authenticated;
do $acl$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('cw_login','cw_signup','cw_signup_with_birthday','cw_signup_with_roster','cw_admin_reset_student_password') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  end loop;
end;
$acl$;

notify pgrst, 'reload schema';
commit;
