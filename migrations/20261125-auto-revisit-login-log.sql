-- Record automatic student revisit sessions in cw_auth_private.login_logs when a
-- returning student restores an existing 24h session via cw_me() or resumes an
-- already-open tab via cw_presence_heartbeat() on a new KST day or after >= 2h away.
-- Apply after 20261124-review-hardening.sql. Idempotent; keeps private objects locked.
begin;
set local lock_timeout = '5s';

create or replace function cw_auth_private.record_student_revisit(
  p_user_id uuid,
  p_role text,
  p_status text,
  p_prev_seen timestamptz
)
returns void
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_now timestamptz := clock_timestamp();
  v_last_log timestamptz;
  v_should_log boolean;
begin
  if p_user_id is null or p_role <> 'student' or p_status = 'rejected' then
    return;
  end if;

  -- Fast unlocked check using (user_id, logged_in_at desc) index; 99.9% of calls
  -- exit immediately without acquiring any lock or performing a write.
  select l.logged_in_at into v_last_log
  from cw_auth_private.login_logs l
  where l.user_id = p_user_id
  order by l.logged_in_at desc
  limit 1;

  v_should_log :=
    v_last_log is null
    or (v_last_log at time zone 'Asia/Seoul')::date < (v_now at time zone 'Asia/Seoul')::date
    or (
      v_last_log < v_now - interval '2 hours'
      and (p_prev_seen is null or p_prev_seen < v_now - interval '2 hours')
    );

  if not v_should_log then
    return;
  end if;

  -- Serialize concurrent revisit detections (e.g. cw_me + heartbeat or multiple tabs)
  -- per user and re-check so only one revisit entry is recorded.
  perform pg_advisory_xact_lock(hashtextextended('cw_revisit:' || p_user_id::text, 0));

  select l.logged_in_at into v_last_log
  from cw_auth_private.login_logs l
  where l.user_id = p_user_id
  order by l.logged_in_at desc
  limit 1;

  if v_last_log is null
     or (v_last_log at time zone 'Asia/Seoul')::date < (v_now at time zone 'Asia/Seoul')::date
     or (
       v_last_log < v_now - interval '2 hours'
       and (p_prev_seen is null or p_prev_seen < v_now - interval '2 hours')
     ) then
    insert into cw_auth_private.login_logs (user_id, logged_in_at)
    values (p_user_id, v_now);
  end if;
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

  if not found or (coalesce(p_list, false) and caller.role <> 'admin') then
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

revoke all on function cw_auth_private.record_student_revisit(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.cw_me(uuid), public.cw_presence_heartbeat(uuid, boolean) from public;
grant execute on function public.cw_me(uuid), public.cw_presence_heartbeat(uuid, boolean) to anon, authenticated;

-- Idempotent backfill for students already active today (KST) under a previous-day 24h session.
insert into cw_auth_private.login_logs (user_id, logged_in_at)
select p.user_id, p.last_seen
from public.cw_presence p
join public.cw_users u on u.id = p.user_id
where u.role = 'student'
  and u.status <> 'rejected'
  and (p.last_seen at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
  and not exists (
    select 1
    from cw_auth_private.login_logs l
    where l.user_id = p.user_id
      and (l.logged_in_at at time zone 'Asia/Seoul')::date >= (p.last_seen at time zone 'Asia/Seoul')::date
  );

notify pgrst, 'reload schema';
commit;
