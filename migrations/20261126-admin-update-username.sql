-- Admin-only student username update RPC.
-- Apply after 20261126-admin-logout-all.sql. Idempotent; keeps private objects locked.
begin;
set local lock_timeout = '5s';

create or replace function public.cw_admin_update_student_username(
  p_token uuid,
  p_target_id uuid,
  p_new_username text
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_caller public.cw_users;
  v_target public.cw_users;
  v_wait integer;
  v_next text;
begin
  perform set_config('response.status', '200', true);
  perform set_config('response.headers', '[]', true);

  select * into v_caller
  from public.cw_users
  where session_token = p_token
    and session_expires_at > now()
    and role = 'admin'
  for share;

  if not found then
    return cw_auth_private.error_response(403, 'CW_ADMIN_REQUIRED', '관리자 로그인이 필요합니다.');
  end if;

  v_wait := cw_auth_private.consume('admin-username-update:' || v_caller.id::text, 30, 300);
  if v_wait > 0 then
    return cw_auth_private.error_response(429, 'CW_RATE_LIMIT', '요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.', v_wait);
  end if;

  v_next := lower(trim(coalesce(p_new_username, '')));
  if char_length(v_next) < 2
     or char_length(v_next) > 100
     or octet_length(v_next) > 300
     or v_next ~ E'[[:space:][:cntrl:]\u00A0\u3000]' then
    return cw_auth_private.error_response(400, 'CW_INVALID_USERNAME', '아이디는 공백 없이 2~100자(UTF-8 300바이트 이하)로 입력해 주세요.');
  end if;

  if p_target_id is null then
    return cw_auth_private.error_response(404, 'CW_STUDENT_NOT_FOUND', '학생 계정을 찾을 수 없습니다.');
  end if;

  -- Lock target student row; never modify administrator accounts.
  select * into v_target
  from public.cw_users
  where id = p_target_id
    and role = 'student'
  for update;

  if not found then
    return cw_auth_private.error_response(404, 'CW_STUDENT_NOT_FOUND', '학생 계정을 찾을 수 없습니다.');
  end if;

  if v_target.username = v_next then
    return cw_auth_private.error_response(400, 'CW_USERNAME_UNCHANGED', '현재 아이디와 같습니다. 다른 아이디를 입력해 주세요.');
  end if;

  if exists (
    select 1
    from public.cw_users
    where lower(username) = v_next
      and id <> p_target_id
  ) then
    return cw_auth_private.error_response(409, 'CW_USERNAME_TAKEN', '이미 사용 중인 아이디입니다.');
  end if;

  begin
    update public.cw_users
    set username = v_next
    where id = p_target_id
      and role = 'student';
  exception when unique_violation then
    return cw_auth_private.error_response(409, 'CW_USERNAME_TAKEN', '이미 사용 중인 아이디입니다.');
  end;

  return jsonb_build_object(
    'ok', true,
    'user_id', v_target.id,
    'previous_username', v_target.username,
    'username', v_next
  );
end;
$fn$;

revoke all on function public.cw_admin_update_student_username(uuid, uuid, text) from public;
grant execute on function public.cw_admin_update_student_username(uuid, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
