-- Admin-only student login history. Apply after 20261120-security-review-hardening.sql.
-- Idempotent; keeps all plaintext credential RPCs closed.
begin;
set local lock_timeout = '5s';

create schema if not exists cw_auth_private;
revoke all on schema cw_auth_private from public, anon, authenticated;

create table if not exists cw_auth_private.login_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.cw_users(id) on delete cascade,
  logged_in_at timestamptz not null default now()
);

create index if not exists cw_login_logs_logged_in_at_idx
  on cw_auth_private.login_logs (logged_in_at desc, id desc);
create index if not exists cw_login_logs_user_id_logged_in_at_idx
  on cw_auth_private.login_logs (user_id, logged_in_at desc);

alter table cw_auth_private.login_logs enable row level security;
revoke all on table cw_auth_private.login_logs from public, anon, authenticated;

-- Record every successful student login inside the hardened private login function.
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
begin
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
revoke all on function cw_auth_private.cw_login(text, text) from public, anon, authenticated;

-- Enrich admin student directory with last_login_at and login_count.
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

-- Admin-only recent student login events (bounded 1..200).
create or replace function public.cw_admin_login_history(
  p_token uuid,
  p_limit integer default 100
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
      order by l.logged_in_at desc, l.id desc
      limit v_limit
    ) e
  ), '[]'::jsonb);
end;
$fn$;

revoke all on function public.cw_admin_student_directory(uuid), public.cw_admin_login_history(uuid, integer) from public;
grant execute on function public.cw_admin_student_directory(uuid), public.cw_admin_login_history(uuid, integer) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
