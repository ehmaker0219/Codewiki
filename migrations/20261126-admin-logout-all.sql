-- Admin-only mass logout of all non-admin (student) sessions with explicit forced-logout detection.
-- Apply after 20261125-auto-revisit-login-log.sql. Idempotent; keeps private objects locked.
begin;
set local lock_timeout = '5s';

create table if not exists cw_auth_private.forced_logouts (
  session_token uuid primary key,
  reason text not null default 'admin_logout_all',
  created_at timestamptz not null default now()
);

create index if not exists idx_cw_forced_logouts_created_at
  on cw_auth_private.forced_logouts (created_at);

alter table cw_auth_private.forced_logouts enable row level security;
revoke all on table cw_auth_private.forced_logouts from public, anon, authenticated;

create or replace function public.cw_admin_logout_all(p_token uuid)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  caller public.cw_users;
  v_wait integer;
  v_logged_out integer := 0;
begin
  perform set_config('response.status', '200', true);
  perform set_config('response.headers', '[]', true);

  select * into caller
  from public.cw_users
  where session_token = p_token
    and session_expires_at > now()
    and role = 'admin'
  for share;

  if not found then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  v_wait := cw_auth_private.consume('admin-logout-all:' || caller.id::text, 10, 60);
  if v_wait > 0 then
    return cw_auth_private.error_response(429, 'CW_RATE_LIMIT', '요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.', v_wait);
  end if;

  -- Bounded SKIP LOCKED cleanup of aged forced-logout markers.
  delete from cw_auth_private.forced_logouts
  where session_token in (
    select session_token
    from cw_auth_private.forced_logouts
    where created_at < now() - interval '2 days'
    order by session_token
    limit 500
    for update skip locked
  );

  with locked_users as (
    select id, session_token, session_expires_at
    from public.cw_users
    where role <> 'admin'
      and (session_token is not null or session_expires_at is not null)
    order by id
    for no key update
  ),
  recorded as (
    insert into cw_auth_private.forced_logouts (session_token, reason, created_at)
    select session_token, 'admin_logout_all', now()
    from locked_users
    where session_token is not null
      and session_expires_at > now()
    on conflict (session_token) do update
      set reason = excluded.reason,
          created_at = excluded.created_at
    returning session_token
  ),
  cleared as (
    update public.cw_users u
    set session_token = null,
        session_expires_at = null
    from locked_users l
    where u.id = l.id
    returning u.id
  ),
  cleared_presence as (
    delete from public.cw_presence
    where user_id in (
      select p.user_id
      from public.cw_presence p
      join public.cw_users u on u.id = p.user_id
      where u.role <> 'admin'
      order by p.user_id
      for update
    )
  )
  select count(*) into v_logged_out from recorded;

  return jsonb_build_object(
    'ok', true,
    'logged_out_count', v_logged_out
  );
end;
$fn$;

create or replace function public.cw_me(p_token uuid)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_user public.cw_users;
  v_pending_count int := 0;
  v_prev_seen timestamptz;
begin
  select * into v_user
  from public.cw_users
  where session_token = p_token and session_expires_at > now();

  if not found then
    if p_token is not null and exists (
      select 1
      from cw_auth_private.forced_logouts f
      where f.session_token = p_token
        and f.created_at > now() - interval '2 days'
    ) then
      return jsonb_build_object('forced_logout', true, 'reason', 'admin_logout_all');
    end if;
    return null;
  end if;

  if v_user.role = 'admin' then
    select count(*) into v_pending_count
    from public.cw_users
    where role <> 'admin' and status = 'pending';
  elsif v_user.role = 'student' and v_user.status <> 'rejected' then
    select p.last_seen into v_prev_seen
    from public.cw_presence p
    where p.user_id = v_user.id;

    perform cw_auth_private.record_student_revisit(v_user.id, v_user.role, v_user.status, v_prev_seen);
  end if;

  return jsonb_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'full_name', v_user.full_name,
    'class_name', v_user.class_name,
    'mbti', v_user.mbti,
    'role', v_user.role,
    'status', v_user.status,
    'pending_count', v_pending_count
  );
end;
$fn$;

create or replace function public.cw_presence_heartbeat(p_token uuid, p_list boolean default false)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  caller public.cw_users;
  v_prev_seen timestamptz;
begin
  select * into caller
  from public.cw_users
  where session_token = p_token
    and session_expires_at > now()
    and (role = 'admin' or status = 'approved');

  if not found then
    if p_token is not null and exists (
      select 1
      from cw_auth_private.forced_logouts f
      where f.session_token = p_token
        and f.created_at > now() - interval '2 days'
    ) then
      raise exception '관리자에 의해 로그아웃되었습니다.'
        using errcode = '42501', detail = 'CW_ADMIN_LOGOUT';
    end if;
    raise exception '접근 권한이 없습니다.' using errcode = '42501';
  end if;

  if coalesce(p_list, false) and caller.role <> 'admin' then
    raise exception '접근 권한이 없습니다.' using errcode = '42501';
  end if;

  if caller.role = 'student' then
    select p.last_seen into v_prev_seen
    from public.cw_presence p
    where p.user_id = caller.id;
  end if;

  insert into public.cw_presence(user_id, session_token, last_seen)
  values (caller.id, p_token, now())
  on conflict (user_id) do update
    set session_token = excluded.session_token,
        last_seen = excluded.last_seen
    where public.cw_presence.last_seen < now() - interval '55 seconds'
       or public.cw_presence.session_token <> excluded.session_token;

  if caller.role = 'student' then
    perform cw_auth_private.record_student_revisit(caller.id, caller.role, caller.status, v_prev_seen);
  end if;

  if not coalesce(p_list, false) then
    return null;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', u.id,
      'full_name', u.full_name,
      'class_name', u.class_name,
      'role', u.role
    ) order by u.full_name, u.id)
    from public.cw_presence p
    join public.cw_users u on u.id = p.user_id
    where p.last_seen > now() - interval '2 minutes'
      and p.session_token = u.session_token
      and u.session_expires_at > now()
      and (u.role = 'admin' or u.status = 'approved')
  ), '[]'::jsonb);
end;
$fn$;

revoke all on function public.cw_admin_logout_all(uuid), public.cw_me(uuid), public.cw_presence_heartbeat(uuid, boolean) from public;
grant execute on function public.cw_admin_logout_all(uuid), public.cw_me(uuid), public.cw_presence_heartbeat(uuid, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
