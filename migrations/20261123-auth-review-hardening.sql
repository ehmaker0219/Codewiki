-- Code-review hardening. Apply LAST, after 20261121-login-history.sql.
-- Idempotent; keeps every plaintext credential RPC closed to public/anon/authenticated.
--  1. Login responses no longer reveal whether a username exists: the per-name
--     quota is consumed for every name, and an unknown name still costs one bcrypt.
--  2. Signup validates MBTI on the server (empty or ^[EI][SN][TF][JP]$).
--  3. Case-insensitive username lookups use an index instead of a full scan.
--  4. Per-client limits (hashed platform IP from the secure-auth Edge Function)
--     run before the shared ceilings, so one client can no longer lock out every
--     login/signup. Ceilings are raised; a classroom sharing one IP stays within
--     the per-client limits (login 120 / 5 min, signup 60 / hour).
begin;
set local lock_timeout = '5s';

-- 1-a. Always consume the per-name bucket. Growth stays bounded by the per-client
-- and global login limits and the existing daily cleanup of expired rows.
create or replace function cw_auth_private.request(
  p_action text,p_username text,p_password text,p_full_name text default null,
  p_class_name text default '기본반',p_mbti text default '',p_birth_date date default null,
  p_share_with_class boolean default false,p_student_number integer default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, extensions, pg_temp
as $fn$
declare v_login boolean:=p_action='login'; v_id text:=lower(trim(p_username));
  v_wait integer; v_error text; v_result jsonb; v_global text;
begin
  perform set_config('response.status','200',true);
  perform set_config('response.headers','[]',true);
  v_global:=case when v_login then 'login:global' else 'signup:global' end;
  -- Per-client limits run earlier in cw_secure_auth (hashed platform IP); these
  -- ceilings are a last resort and also cover username rotation.
  -- Cleanup only when a global window opens; ordinary note/read requests do no work here.
  if not exists(select 1 from cw_auth_private.limits where bucket=v_global and resets_at>clock_timestamp()) then
    delete from cw_auth_private.limits where resets_at<clock_timestamp()-interval '1 day';
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
    -- Same rule as profile edits; the signup form only sends a valid type or ''.
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

-- 1-b. Unknown usernames still pay one bcrypt so response time does not reveal
-- whether an account exists. Login history behavior is unchanged.
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
  v_hash text;
  v_new_token uuid := gen_random_uuid();
begin
  select password_hash into v_hash
  from public.cw_users
  where lower(username) = lower(trim(p_username))
  limit 1;

  if v_hash is null then
    perform crypt(coalesce(p_password, ''), gen_salt('bf'));
    raise exception '아이디 또는 비밀번호를 확인해 주세요.';
  end if;

  select * into v_user
  from public.cw_users
  where lower(username) = lower(trim(p_username))
    and password_hash = crypt(p_password, password_hash);

  if not found then
    raise exception '아이디 또는 비밀번호를 확인해 주세요.';
  end if;

  update public.cw_users
  set session_token = v_new_token,
      session_expires_at = now() + case when v_user.role = 'admin' then interval '12 hours' else interval '24 hours' end
  where id = v_user.id;

  if v_user.role = 'student' then
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

-- 3. Case-insensitive username index. Unique when existing rows allow it;
-- otherwise a plain index still removes the sequential scan.
do $idx$
begin
  if to_regclass('public.cw_users_lower_username_idx') is null then
    begin
      create unique index cw_users_lower_username_idx on public.cw_users (lower(username));
    exception when unique_violation then
      create index cw_users_lower_username_idx on public.cw_users (lower(username));
    end;
  end if;
end;
$idx$;

-- 4. Per-client limits in the encrypted gateway. The new 5-argument overload has
-- no default, so PostgREST resolves 4 named arguments to the legacy overload and
-- 5 to the new one without ambiguity. The legacy overload (used until the Edge
-- Function is redeployed) delegates with no client key and keeps its behavior.
create or replace function public.cw_secure_auth(
  p_operation text,p_args jsonb,p_request_id uuid,p_expires_at timestamptz,p_client text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp
as $fn$
declare v_now timestamptz:=clock_timestamp(); v_wait integer; v_result jsonb;
begin
  perform set_config('response.status','200',true);
  perform set_config('response.headers','[]',true);
  if p_operation is null or p_operation not in ('cw_login','cw_signup_with_roster','cw_admin_reset_student_password')
     or p_request_id is null or p_expires_at is null or p_expires_at<=v_now or p_expires_at>v_now+interval '70 seconds'
     or p_args is null or jsonb_typeof(p_args)<>'object' or octet_length(p_args::text)>12000
     or (p_client is not null and p_client !~ '^[0-9a-f]{64}$') then
    return cw_auth_private.error_response(400,'CW_ENVELOPE_INVALID','보안 요청을 확인해 주세요.');
  end if;
  -- Per-client first: a client over its limit never consumes the shared ceilings.
  if p_client is not null then
    v_wait:=cw_auth_private.consume(
      'client:'||case p_operation when 'cw_login' then 'login' when 'cw_signup_with_roster' then 'signup' else 'reset' end||':'||p_client,
      case p_operation when 'cw_login' then 120 else 60 end,
      case p_operation when 'cw_signup_with_roster' then 3600 else 300 end);
    if v_wait>0 then return cw_auth_private.error_response(429,'CW_RATE_LIMIT','요청이 많습니다. 잠시 후 다시 시도해 주세요.',v_wait); end if;
  end if;
  -- A bounded global quota caps nonce storage and bcrypt work. Existing per-user
  -- login/signup/reset limits still run below. Cleanup once per quota window.
  if not exists(select 1 from cw_auth_private.limits where bucket='encrypted-auth:global' and resets_at>v_now) then
    delete from cw_auth_private.used_envelopes where expires_at<v_now-interval '5 minutes';
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
