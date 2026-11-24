-- Record initial student login_logs entry on successful signup (which issues an active 24h session).
-- Apply after 20261123-auth-review-hardening.sql. Idempotent; keeps all private functions/tables locked.
begin;
set local lock_timeout = '5s';

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

revoke all on all functions in schema cw_auth_private from public, anon, authenticated;

-- Idempotent backfill for students currently holding an active signup session with no login_logs yet.
insert into cw_auth_private.login_logs (user_id, logged_in_at)
select u.id, greatest(u.created_at, u.session_expires_at - interval '24 hours')
from public.cw_users u
where u.role = 'student'
  and u.status <> 'rejected'
  and u.session_token is not null
  and u.session_expires_at > now()
  and not exists (
    select 1 from cw_auth_private.login_logs l where l.user_id = u.id
  );

notify pgrst, 'reload schema';
commit;
