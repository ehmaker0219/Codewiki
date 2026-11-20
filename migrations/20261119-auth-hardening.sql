-- Apply LAST, after birthdays and class-roster-signup. No production test writes.
-- Failed requests return an error body/status instead of RAISE: quota writes
-- must commit even when authentication or signup fails.
begin;
create schema if not exists cw_auth_private;
revoke all on schema cw_auth_private from public, anon, authenticated;

create table if not exists cw_auth_private.limits (
  bucket text primary key,
  attempts integer not null,
  resets_at timestamptz not null
);
create index if not exists cw_auth_limits_expiry on cw_auth_private.limits(resets_at);
alter table cw_auth_private.limits enable row level security;
revoke all on cw_auth_private.limits from public, anon, authenticated;

-- Preserve existing signup/roster/session behavior behind an inaccessible schema.
-- Reapplying this migration must not wrap a wrapper recursively.
do $move$
begin
  if to_regprocedure('cw_auth_private.cw_login(text,text)') is null then
    alter function public.cw_login(text,text) set schema cw_auth_private;
  end if;
  if to_regprocedure('cw_auth_private.cw_signup(text,text,text,text,text)') is null then
    alter function public.cw_signup(text,text,text,text,text) set schema cw_auth_private;
  end if;
  if to_regprocedure('cw_auth_private.cw_signup_with_roster(text,text,text,text,text,date,boolean,integer)') is null then
    alter function public.cw_signup_with_roster(text,text,text,text,text,date,boolean,integer) set schema cw_auth_private;
  end if;
end;
$move$;

create or replace function cw_auth_private.consume(p_bucket text, p_max integer, p_seconds integer)
returns integer language plpgsql set search_path = pg_catalog, pg_temp
as $fn$
declare v_now timestamptz := clock_timestamp(); v_until timestamptz;
begin
  -- Atomic upsert: concurrent calls cannot all pass the final quota slot.
  insert into cw_auth_private.limits as l values(p_bucket,1,v_now+make_interval(secs=>p_seconds))
  on conflict(bucket) do update set
    attempts=case when l.resets_at<=v_now then 1 else l.attempts+1 end,
    resets_at=case when l.resets_at<=v_now then excluded.resets_at else l.resets_at end
  where l.resets_at<=v_now or l.attempts<p_max
  returning resets_at into v_until;
  if found then return 0; end if;
  select resets_at into v_until from cw_auth_private.limits where bucket=p_bucket;
  return greatest(1,ceil(extract(epoch from v_until-v_now))::integer);
end;
$fn$;

create or replace function cw_auth_private.error_response(p_status integer,p_code text,p_message text,p_wait integer default null)
returns jsonb language plpgsql set search_path = pg_catalog, pg_temp
as $fn$
begin
  perform set_config('response.status',p_status::text,true);
  if p_wait is not null then
    perform set_config('response.headers',jsonb_build_array(jsonb_build_object('Retry-After',p_wait::text))::text,true);
  end if;
  return jsonb_build_object('code',p_code,'message',p_message,'details',null,'hint',null,'retry_after',p_wait);
end;
$fn$;

create or replace function cw_auth_private.password_error(p_password text)
returns text language plpgsql set search_path = pg_catalog, pg_temp
as $fn$
begin
  if p_password is null or char_length(p_password)<8 then
    return '비밀번호는 8자 이상 입력해 주세요.';
  end if;
  -- bcrypt only considers 72 bytes; reject instead of silently truncating.
  if octet_length(p_password)>72 then
    return '비밀번호는 UTF-8 기준 72바이트 이하로 입력해 주세요.';
  end if;
  if lower(p_password) in ('password','12345678','123456789','qwerty12','admin123','password1234','password123!','123456789012','1234567890123456','qwerty123456','qwertyuiop12','admin12345678','abcdefghijkl')
    or length(replace(p_password,left(p_password,1),''))=0 then
    return '쉽게 추측할 수 있는 비밀번호입니다. 다른 비밀번호를 입력해 주세요.';
  end if;
  return null;
end;
$fn$;

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
  -- No client-provided IP/header is trusted. Global ceilings also cover username rotation.
  -- Cleanup only when a global window opens; ordinary note/read requests do no work here.
  if not exists(select 1 from cw_auth_private.limits where bucket=v_global and resets_at>clock_timestamp()) then
    delete from cw_auth_private.limits where resets_at<clock_timestamp()-interval '1 day';
  end if;
  v_wait:=cw_auth_private.consume(v_global,case when v_login then 300 else 60 end,case when v_login then 300 else 3600 end);
  if v_wait>0 then
    return cw_auth_private.error_response(429,'CW_RATE_LIMIT','요청이 많습니다. 잠시 후 다시 시도해 주세요.',v_wait);
  end if;
  if v_id is null or char_length(v_id)<2 or (not v_login and char_length(v_id)>100) then
    return cw_auth_private.error_response(400,'CW_INVALID_INPUT','아이디는 2~100자로 입력해 주세요.');
  end if;
  -- Unknown login names need only the global counter; avoid unbounded per-name rows.
  if not v_login or exists(select 1 from public.cw_users where lower(username)=v_id) then
    v_wait:=cw_auth_private.consume(
      case when v_login then 'login:' else 'signup:' end || encode(extensions.digest(v_id,'sha256'),'hex'),
      case when v_login then 10 else 3 end,case when v_login then 300 else 900 end);
    if v_wait>0 then
      return cw_auth_private.error_response(429,'CW_RATE_LIMIT','시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.',v_wait);
    end if;
  end if;
  if not v_login then
    v_error:=cw_auth_private.password_error(p_password);
    if v_error is not null then return cw_auth_private.error_response(400,'CW_PASSWORD_POLICY',v_error); end if;
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

create or replace function public.cw_login(p_username text,p_password text)
returns jsonb language sql security definer set search_path = pg_catalog, pg_temp
as $fn$ select cw_auth_private.request('login',p_username,p_password); $fn$;
create or replace function public.cw_signup(p_username text,p_password text,p_full_name text,p_class_name text default '기본반',p_mbti text default '')
returns jsonb language sql security definer set search_path = pg_catalog, pg_temp
as $fn$ select cw_auth_private.request('legacy',p_username,p_password,p_full_name,p_class_name,p_mbti); $fn$;
create or replace function public.cw_signup_with_birthday(p_username text,p_password text,p_full_name text,p_class_name text,p_mbti text,p_birth_date date,p_share_with_class boolean)
returns jsonb language sql security definer set search_path = pg_catalog, pg_temp
as $fn$ select cw_auth_private.request('birthday',p_username,p_password,p_full_name,p_class_name,p_mbti,p_birth_date,p_share_with_class); $fn$;
create or replace function public.cw_signup_with_roster(p_username text,p_password text,p_full_name text,p_class_name text,p_mbti text,p_birth_date date,p_share_with_class boolean,p_student_number integer default null)
returns jsonb language sql security definer set search_path = pg_catalog, pg_temp
as $fn$ select cw_auth_private.request('roster',p_username,p_password,p_full_name,p_class_name,p_mbti,p_birth_date,p_share_with_class,p_student_number); $fn$;

revoke all on all functions in schema cw_auth_private from public, anon, authenticated;
-- Also close obsolete overloads left by older installations.
do $acl$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('cw_login','cw_signup','cw_signup_with_birthday','cw_signup_with_roster') loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
  end loop;
end;
$acl$;
grant execute on function public.cw_login(text,text),public.cw_signup(text,text,text,text,text),
 public.cw_signup_with_birthday(text,text,text,text,text,date,boolean),
 public.cw_signup_with_roster(text,text,text,text,text,date,boolean,integer) to anon, authenticated;
-- Reapplying an old hardening migration must not reopen plaintext endpoints.
do $transport_guard$
declare f record;
begin
  if to_regprocedure('public.cw_secure_auth(text,jsonb,uuid,timestamptz)') is not null then
    for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('cw_login','cw_signup','cw_signup_with_birthday','cw_signup_with_roster') loop
      execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    end loop;
  end if;
end;
$transport_guard$;
notify pgrst,'reload schema';
commit;
