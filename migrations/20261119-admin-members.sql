-- Apply after auth-hardening, birthdays and class-roster-signup.
begin;
set local lock_timeout='5s';
create or replace function public.cw_admin_student_directory(p_token uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp
as $fn$
begin
  if not exists(select 1 from public.cw_users where session_token=p_token and session_expires_at>now() and role='admin') then
    raise exception '관리자 권한이 필요합니다.' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',u.id,'username',u.username,'full_name',u.full_name,'class_name',u.class_name,
    'student_number',u.student_number,'mbti',u.mbti,'status',u.status,
    'birth_date',b.birth_date,'created_at',u.created_at) order by u.full_name,u.id)
    from public.cw_users u left join public.cw_birthdays b on b.user_id=u.id
    where u.role='student'),'[]'::jsonb);
end;
$fn$;

create or replace function public.cw_admin_reset_student_password(
  p_token uuid,p_target_id uuid,p_admin_password text,p_new_password text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp
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
  update public.cw_users set password_hash=extensions.crypt(p_new_password,extensions.gen_salt('bf')),
    session_token=null,session_expires_at=null
    where id=p_target_id and role='student';
  if not found then
    return cw_auth_private.error_response(404,'CW_STUDENT_NOT_FOUND','학생 계정을 찾을 수 없습니다.');
  end if;
  return jsonb_build_object('ok',true,'user_id',p_target_id);
end;
$fn$;
revoke all on function public.cw_admin_student_directory(uuid),public.cw_admin_reset_student_password(uuid,uuid,text,text) from public;
grant execute on function public.cw_admin_student_directory(uuid),public.cw_admin_reset_student_password(uuid,uuid,text,text) to anon,authenticated;
do $transport_guard$
begin
  if exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='cw_secure_auth'
  ) then
    revoke all on function public.cw_admin_reset_student_password(uuid,uuid,text,text) from public,anon,authenticated;
  end if;
end;
$transport_guard$;
notify pgrst,'reload schema';
commit;
