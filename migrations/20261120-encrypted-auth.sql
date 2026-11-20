-- Apply after all previous authentication/admin migrations, coordinated with the
-- secure-auth Edge Function and new frontend. Never paste private keys into SQL.
begin;
set local lock_timeout='5s';
create table if not exists cw_auth_private.used_envelopes (
  request_id uuid primary key,
  expires_at timestamptz not null
);
create index if not exists cw_used_envelopes_expiry on cw_auth_private.used_envelopes(expires_at);
alter table cw_auth_private.used_envelopes enable row level security;
revoke all on cw_auth_private.used_envelopes from public,anon,authenticated;

create or replace function public.cw_secure_auth(
  p_operation text,p_args jsonb,p_request_id uuid,p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp
as $fn$
declare v_now timestamptz:=clock_timestamp(); v_wait integer; v_result jsonb;
begin
  perform set_config('response.status','200',true);
  perform set_config('response.headers','[]',true);
  if p_operation is null or p_operation not in ('cw_login','cw_signup_with_roster','cw_admin_reset_student_password')
     or p_request_id is null or p_expires_at is null or p_expires_at<=v_now or p_expires_at>v_now+interval '70 seconds'
     or p_args is null or jsonb_typeof(p_args)<>'object' or octet_length(p_args::text)>12000 then
    return cw_auth_private.error_response(400,'CW_ENVELOPE_INVALID','보안 요청을 확인해 주세요.');
  end if;
  -- A bounded global quota caps nonce storage and bcrypt work. Existing per-user
  -- login/signup/reset limits still run below. Cleanup once per quota window.
  if not exists(select 1 from cw_auth_private.limits where bucket='encrypted-auth:global' and resets_at>v_now) then
    delete from cw_auth_private.used_envelopes where expires_at<v_now-interval '5 minutes';
  end if;
  v_wait:=cw_auth_private.consume('encrypted-auth:global',600,300);
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
revoke all on function public.cw_secure_auth(text,jsonb,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.cw_secure_auth(text,jsonb,uuid,timestamptz) to service_role;

-- Close every historical overload, including the legacy birthday/signup paths.
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
notify pgrst,'reload schema';
commit;
