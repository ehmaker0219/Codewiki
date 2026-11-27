-- Admin Command Center: roster coverage, learning analytics, live presence context,
-- realtime notices with read receipts, spotlight, 1:1 direct messages, single-student logout,
-- maintenance mode, feature flags, anonymous telemetry, multi-device detection & audit logs.
-- Apply after 20261126-admin-update-username.sql. Idempotent; keeps all private objects locked.
begin;
set local lock_timeout = '5s';

create schema if not exists cw_auth_private;
revoke all on schema cw_auth_private from public, anon, authenticated;

-- 1. Additive presence context columns (legacy 2-arg cw_presence_heartbeat stays untouched).
alter table public.cw_presence
  add column if not exists current_doc_id text,
  add column if not exists current_label text,
  add column if not exists device_type text,
  add column if not exists client_id text;

-- 2. Private operational tables (RLS enabled + REVOKE ALL from public/anon/authenticated).
create table if not exists cw_auth_private.site_settings (
  key text primary key check (key in ('maintenance', 'feature_flags', 'spotlight')),
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.cw_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists cw_auth_private.live_notices (
  id uuid primary key default gen_random_uuid(),
  badge text not null default '실시간 공지',
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  cheer text not null default '',
  target_class text,
  active boolean not null default true,
  created_by uuid references public.cw_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cw_live_notices_active_created
  on cw_auth_private.live_notices (active, created_at desc);

create table if not exists cw_auth_private.live_notice_reads (
  notice_id uuid not null references cw_auth_private.live_notices(id) on delete cascade,
  user_id uuid not null references public.cw_users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, user_id)
);
create index if not exists idx_cw_live_notice_reads_user
  on cw_auth_private.live_notice_reads (user_id, read_at desc);

create table if not exists cw_auth_private.direct_messages (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.cw_users(id) on delete cascade,
  sender_id uuid references public.cw_users(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists idx_cw_direct_messages_target_unread
  on cw_auth_private.direct_messages (target_user_id, created_at desc)
  where read_at is null;
create index if not exists idx_cw_direct_messages_created
  on cw_auth_private.direct_messages (created_at desc);

-- Strictly anonymous analytics table: NO user_id column by design.
create table if not exists cw_auth_private.analytics_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in (
    'doc_view', 'doc_stay', 'search', 'search_empty', 'code_copy', 'quiz_answer', 'client_error'
  )),
  target_key text not null check (char_length(target_key) between 1 and 200),
  meta jsonb not null default '{}'::jsonb,
  device_type text not null default 'desktop' check (device_type in ('desktop', 'mobile', 'tablet')),
  created_at timestamptz not null default now()
);
create index if not exists idx_cw_analytics_type_created
  on cw_auth_private.analytics_events (event_type, created_at desc);
create index if not exists idx_cw_analytics_created
  on cw_auth_private.analytics_events (created_at);

-- Lightweight random per-browser token log for multi-device/session-switching security alerts.
create table if not exists cw_auth_private.session_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.cw_users(id) on delete cascade,
  client_id text not null check (char_length(client_id) between 8 and 64),
  device_type text not null default 'desktop' check (device_type in ('desktop', 'mobile', 'tablet')),
  seen_at timestamptz not null default now()
);
create index if not exists idx_cw_session_activity_user_seen
  on cw_auth_private.session_activity (user_id, seen_at desc);
create index if not exists idx_cw_session_activity_seen
  on cw_auth_private.session_activity (seen_at);

create table if not exists cw_auth_private.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references public.cw_users(id) on delete set null,
  admin_name text not null,
  action text not null,
  target_user_id uuid references public.cw_users(id) on delete set null,
  target_label text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_cw_admin_audit_created
  on cw_auth_private.admin_audit_logs (created_at desc, id desc);
create index if not exists idx_cw_admin_audit_action_created
  on cw_auth_private.admin_audit_logs (action, created_at desc);

create table if not exists cw_auth_private.student_tool_grants (
  user_id uuid primary key references public.cw_users(id) on delete cascade,
  tools jsonb not null default '{"mentoring":false,"foundation":false}'::jsonb,
  updated_by uuid references public.cw_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Detailed security event log (30-day retention, zero raw passwords/tokens/IPs).
create table if not exists cw_auth_private.security_events (
  id bigint generated always as identity primary key,
  severity text not null check (severity in ('info', 'warn', 'high', 'critical')),
  event_type text not null check (char_length(event_type) between 1 and 60),
  target_account text not null default '',
  target_user_id uuid references public.cw_users(id) on delete set null,
  client_fp text not null default '',
  source text not null default '',
  reason_code text not null default '',
  summary text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_cw_security_events_created
  on cw_auth_private.security_events (created_at desc, id desc);
create index if not exists idx_cw_security_events_high_created
  on cw_auth_private.security_events (created_at desc)
  where severity in ('high', 'critical');
create index if not exists idx_cw_security_events_type_created
  on cw_auth_private.security_events (event_type, created_at desc);
create index if not exists idx_cw_security_events_target_created
  on cw_auth_private.security_events (target_account, created_at desc)
  where target_account <> '';
create index if not exists idx_cw_security_events_fp_created
  on cw_auth_private.security_events (client_fp, created_at desc)
  where client_fp <> '';

alter table cw_auth_private.site_settings enable row level security;
alter table cw_auth_private.live_notices enable row level security;
alter table cw_auth_private.live_notice_reads enable row level security;
alter table cw_auth_private.direct_messages enable row level security;
alter table cw_auth_private.analytics_events enable row level security;
alter table cw_auth_private.session_activity enable row level security;
alter table cw_auth_private.admin_audit_logs enable row level security;
alter table cw_auth_private.student_tool_grants enable row level security;
alter table cw_auth_private.security_events enable row level security;

revoke all on table
  cw_auth_private.site_settings,
  cw_auth_private.live_notices,
  cw_auth_private.live_notice_reads,
  cw_auth_private.direct_messages,
  cw_auth_private.analytics_events,
  cw_auth_private.session_activity,
  cw_auth_private.admin_audit_logs,
  cw_auth_private.student_tool_grants,
  cw_auth_private.security_events
from public, anon, authenticated;

-- Seed existing mentor / foundation grants once (preserves any later admin edits on rerun).
insert into cw_auth_private.student_tool_grants (user_id, tools)
select u.id, v.tools
from (values
  ('2eafc83d-09cd-4ea6-98a8-9bbb1ebdeb06'::uuid, jsonb_build_object('mentoring', true, 'foundation', true)),
  ('9ed5fcaf-8785-4e3b-8050-ad94482a7068'::uuid, jsonb_build_object('mentoring', true, 'foundation', false)),
  ('0fd93ee1-9425-4094-8428-31237942091f'::uuid, jsonb_build_object('mentoring', true, 'foundation', false))
) as v(id, tools)
join public.cw_users u on u.id = v.id and u.role = 'student'
on conflict (user_id) do nothing;

-- Default site settings (idempotent).
insert into cw_auth_private.site_settings (key, value)
values
  ('maintenance', jsonb_build_object('enabled', false, 'message', '현재 사이트 점검 중입니다. 잠시 후 다시 이용해 주세요.', 'updated_at', null)),
  ('feature_flags', jsonb_build_object(
    'basicSession', true,
    'sqlGuide', true,
    'dataGame', true,
    'study', true,
    'mentoring', true,
    'knowledgeMap', true,
    'practice', true
  )),
  ('spotlight', jsonb_build_object('active', false, 'doc_id', '', 'section_id', '', 'label', '', 'message', '', 'sent_at', null))
on conflict (key) do nothing;

-- 3. Private helpers for audit logging and settings reading.
create or replace function cw_auth_private.log_admin_action(
  p_admin_id uuid,
  p_admin_name text,
  p_action text,
  p_target_user_id uuid default null,
  p_target_label text default '',
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
begin
  insert into cw_auth_private.admin_audit_logs (
    admin_id, admin_name, action, target_user_id, target_label, details
  ) values (
    p_admin_id,
    coalesce(nullif(trim(p_admin_name), ''), '관리자'),
    left(coalesce(p_action, 'unknown'), 60),
    p_target_user_id,
    left(coalesce(p_target_label, ''), 160),
    coalesce(p_details, '{}'::jsonb)
  );

  -- Bounded SKIP LOCKED cleanup (> 180 days).
  delete from cw_auth_private.admin_audit_logs
  where id in (
    select id from cw_auth_private.admin_audit_logs
    where created_at < now() - interval '180 days'
    order by id
    limit 200
    for update skip locked
  );
end;
$fn$;

create or replace function cw_auth_private.get_site_settings_json()
returns jsonb
language sql
security definer set search_path = pg_catalog, pg_temp
as $fn$
  select jsonb_build_object(
    'maintenance', coalesce(
      (select value from cw_auth_private.site_settings where key = 'maintenance'),
      jsonb_build_object('enabled', false, 'message', '현재 사이트 점검 중입니다. 잠시 후 다시 이용해 주세요.', 'updated_at', null)
    ),
    'feature_flags', jsonb_build_object(
      'basicSession', true,
      'sqlGuide', true,
      'dataGame', true,
      'study', true,
      'mentoring', true,
      'knowledgeMap', true,
      'practice', true
    ) || coalesce(
      (select value from cw_auth_private.site_settings where key = 'feature_flags'),
      '{}'::jsonb
    ),
    'spotlight', coalesce(
      (select value from cw_auth_private.site_settings where key = 'spotlight'),
      jsonb_build_object('active', false, 'doc_id', '', 'section_id', '', 'label', '', 'message', '', 'sent_at', null)
    )
  );
$fn$;

create or replace function cw_auth_private.get_student_tools_json(p_user_id uuid)
returns jsonb
language sql
security definer set search_path = pg_catalog, pg_temp
as $fn$
  select jsonb_build_object('mentoring', false, 'foundation', false) || coalesce(
    (select tools from cw_auth_private.student_tool_grants where user_id = p_user_id),
    '{}'::jsonb
  );
$fn$;

create or replace function cw_auth_private.has_suspicious_payload(
  p_text text,
  p_allow_sql_keywords boolean default false
)
returns boolean
language sql
immutable
set search_path = pg_catalog, pg_temp
as $fn$
  select coalesce(p_text, '') ~* (
    case when p_allow_sql_keywords then
      '(''\s*(or|and)\s+(?:[''"]?\d+[''"]?\s*=\s*[''"]?\d+|''[^'']{1,20}''\s*=\s*''[^'']{1,20}''|\ytrue\y)|''\s*--|;\s*(drop|delete|truncate|alter|exec)\s+|<\s*script\y|javascript\s*:|on(error|load|mouseover|focus)\s*=|\.\./|\.\.\\|%2e%2e|%3cscript)'
    else
      '(\yunion\s+(all\s+)?select\y|''\s*(or|and)\s+(?:[''"]?\d+[''"]?\s*=\s*[''"]?\d+|''[^'']{1,20}''\s*=\s*''[^'']{1,20}''|\ytrue\y)|''\s*--|;\s*(drop|delete|truncate|alter|exec)\s+|<\s*script\y|javascript\s*:|on(error|load|mouseover|focus)\s*=|\.\./|\.\.\\|%2e%2e|%3cscript)'
    end
  );
$fn$;

create or replace function cw_auth_private.record_security_event(
  p_severity text,
  p_event_type text,
  p_target_account text default '',
  p_target_user_id uuid default null,
  p_client_fp text default '',
  p_source text default '',
  p_reason_code text default '',
  p_summary text default '',
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer set search_path = pg_catalog, extensions, pg_temp
as $fn$
declare
  v_now timestamptz := clock_timestamp();
  v_sev text := case when p_severity in ('info', 'warn', 'high', 'critical') then p_severity else 'warn' end;
  v_type text := left(coalesce(nullif(trim(p_event_type), ''), 'unknown'), 60);
  v_acct text := left(regexp_replace(trim(coalesce(p_target_account, '')), '[[:cntrl:]]', '', 'g'), 80);
  v_fp text := left(regexp_replace(trim(coalesce(p_client_fp, '')), '[^0-9a-zA-Z_-]', '', 'g'), 24);
  v_src text := left(regexp_replace(trim(coalesce(p_source, '')), '[[:cntrl:]]', '', 'g'), 40);
  v_code text := left(regexp_replace(trim(coalesce(p_reason_code, '')), '[[:cntrl:]]', '', 'g'), 60);
  v_sum text := left(regexp_replace(trim(coalesce(p_summary, '')), '[[:cntrl:]]', ' ', 'g'), 240);
  v_details jsonb := case when p_details is not null and jsonb_typeof(p_details) = 'object' and octet_length(p_details::text) <= 2000 then p_details else '{}'::jsonb end;
  v_sig text;
  v_wait integer;
begin
  -- Opportunistic 30-day retention cleanup using SKIP LOCKED when the global log window rolls over.
  if not exists (select 1 from cw_auth_private.limits where bucket = 'sec-log:global' and resets_at > v_now) then
    delete from cw_auth_private.security_events
    where id in (
      select id from cw_auth_private.security_events
      where created_at < v_now - interval '30 days'
      order by id
      limit 400
      for update skip locked
    );
  end if;

  -- Check per-signature cap FIRST so a single noisy attacker cannot exhaust the global quota.
  v_sig := encode(extensions.digest(v_type || '|' || lower(v_acct) || '|' || v_fp || '|' || v_code, 'sha256'), 'hex');
  v_wait := cw_auth_private.consume('sec-log:sig:' || left(v_sig, 32), 30, 60);
  if v_wait > 0 then return; end if;

  -- Isolate unauthenticated Edge noise into its own sub-quota so login/admin alerts are never blinded.
  if v_src = 'edge-auth' then
    v_wait := cw_auth_private.consume('sec-log:edge', 120, 60);
    if v_wait > 0 then return; end if;
  end if;

  -- Global bounded write cap prevents log-flood DoS while preserving full attack visibility.
  v_wait := cw_auth_private.consume('sec-log:global', 400, 60);
  if v_wait > 0 then return; end if;

  insert into cw_auth_private.security_events (
    severity, event_type, target_account, target_user_id, client_fp, source, reason_code, summary, details, created_at
  ) values (
    v_sev, v_type, v_acct, p_target_user_id, v_fp, v_src, v_code, v_sum, v_details, v_now
  );
exception when others then
  -- Security logging must never interrupt authentication or leak diagnostics.
  null;
end;
$fn$;

create or replace function cw_auth_private.record_unauthorized_admin_call(
  p_token uuid,
  p_rpc_name text
)
returns void
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_actor public.cw_users;
  v_rpc text := left(coalesce(nullif(trim(p_rpc_name), ''), 'admin_rpc'), 60);
  v_fp text := coalesce(nullif(current_setting('codewiki.client_fp', true), ''), '');
begin
  if p_token is not null then
    select * into v_actor
    from public.cw_users
    where session_token = p_token
      and session_expires_at > now()
    limit 1;
  end if;

  if v_actor.id is not null then
    perform cw_auth_private.record_security_event(
      'critical',
      'unauthorized_admin_access',
      v_actor.username,
      v_actor.id,
      v_fp,
      'admin-rpc',
      'CW_ADMIN_REQUIRED',
      '비관리자 계정(' || v_actor.full_name || ' · @' || v_actor.username || ')의 관리자 API(' || v_rpc || ') 직접 호출 차단',
      jsonb_build_object(
        'rpc', v_rpc,
        'actor_role', v_actor.role,
        'actor_name', v_actor.full_name,
        'class_name', v_actor.class_name,
        'token_state', 'non_admin_session'
      )
    );
  else
    perform cw_auth_private.record_security_event(
      'high',
      'unauthorized_admin_access',
      '미인증 요청',
      null,
      v_fp,
      'admin-rpc',
      'CW_ADMIN_REQUIRED',
      '유효하지 않은 토큰으로 관리자 API(' || v_rpc || ') 호출 차단',
      jsonb_build_object(
        'rpc', v_rpc,
        'token_state', case when p_token is null then 'null' else 'invalid_or_expired' end
      )
    );
  end if;
exception when others then
  null;
end;
$fn$;

revoke all on function
  cw_auth_private.log_admin_action(uuid, text, text, uuid, text, jsonb),
  cw_auth_private.get_site_settings_json(),
  cw_auth_private.get_student_tools_json(uuid),
  cw_auth_private.has_suspicious_payload(text, boolean),
  cw_auth_private.record_security_event(text, text, text, uuid, text, text, text, text, jsonb),
  cw_auth_private.record_unauthorized_admin_call(uuid, text)
from public, anon, authenticated;

-- 4. Enrich existing admin mutation RPCs with audit logging & preserve exact contracts.
create or replace function public.cw_me(p_token uuid)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_user public.cw_users;
  v_pending_count int := 0;
  v_security_alert_count int := 0;
  v_prev_seen timestamptz;
  v_forced_reason text;
begin
  select * into v_user
  from public.cw_users
  where session_token = p_token and session_expires_at > now();

  if not found then
    if p_token is not null then
      select f.reason into v_forced_reason
      from cw_auth_private.forced_logouts f
      where f.session_token = p_token
        and f.created_at > now() - interval '2 days';
      if found then
        return jsonb_build_object('forced_logout', true, 'reason', coalesce(v_forced_reason, 'admin_logout_all'));
      end if;
    end if;
    return null;
  end if;

  if v_user.role = 'admin' then
    select count(*) into v_pending_count
    from public.cw_users
    where role <> 'admin' and status = 'pending';

    select (
      (select count(*)::integer
       from cw_auth_private.security_events
       where severity in ('high', 'critical')
         and created_at >= now() - interval '24 hours')
      +
      (select count(*)::integer
       from (
         select sa.user_id
         from cw_auth_private.session_activity sa
         join public.cw_users su on su.id = sa.user_id
         where su.role = 'student'
           and sa.seen_at >= now() - interval '24 hours'
         group by sa.user_id
         having count(distinct sa.client_id) >= 2
       ) md)
    ) into v_security_alert_count;
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
    'pending_count', v_pending_count,
    'security_alert_count', v_security_alert_count,
    'tools', case
      when v_user.role = 'student' and v_user.status = 'approved'
        then cw_auth_private.get_student_tools_json(v_user.id)
      else '{}'::jsonb
    end
  );
end;
$fn$;

create or replace function public.cw_admin_set_status(
  p_token uuid,
  p_target_id uuid,
  p_next_status text
)
returns void
language plpgsql
security definer set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_caller public.cw_users;
  v_target public.cw_users;
begin
  select * into v_caller from public.cw_users
    where session_token = p_token and session_expires_at > now() and role = 'admin'
    for share;
  if not found then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  if p_next_status is null or p_next_status not in ('pending', 'approved', 'rejected') then
    raise exception '잘못된 상태 값입니다.' using errcode = '22023';
  end if;

  select * into v_target from public.cw_users
    where id = p_target_id and role <> 'admin'
    for no key update;
  if not found then
    return;
  end if;

  update public.cw_users
  set status = p_next_status,
      session_token = case when p_next_status = 'approved' then session_token else null end,
      session_expires_at = case when p_next_status = 'approved' then session_expires_at else null end
  where id = v_target.id;

  perform cw_auth_private.log_admin_action(
    v_caller.id,
    v_caller.full_name,
    'set_status',
    v_target.id,
    v_target.full_name || ' (@' || v_target.username || ')',
    jsonb_build_object('from', v_target.status, 'to', p_next_status)
  );
end;
$fn$;

create or replace function public.cw_admin_delete_rejected_user(p_token uuid, p_target_id uuid)
returns void
language plpgsql
security definer set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_caller public.cw_users;
  v_target public.cw_users;
begin
  select * into v_caller from public.cw_users
    where session_token = p_token and session_expires_at > now() and role = 'admin'
    for share;
  if not found then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  delete from public.cw_users
    where id = p_target_id and role = 'student' and status = 'rejected'
    returning * into v_target;
  if not found then
    raise exception '거절된 학생 가입 요청만 삭제할 수 있습니다. 목록을 새로 불러와 주세요.' using errcode = '22023';
  end if;

  perform cw_auth_private.log_admin_action(
    v_caller.id,
    v_caller.full_name,
    'delete_rejected',
    null,
    v_target.full_name || ' (@' || v_target.username || ')',
    jsonb_build_object('class_name', v_target.class_name)
  );
end;
$fn$;

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
    perform cw_auth_private.record_unauthorized_admin_call(p_token, 'cw_admin_update_student_username');
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

  perform cw_auth_private.log_admin_action(
    v_caller.id,
    v_caller.full_name,
    'update_username',
    v_target.id,
    v_target.full_name,
    jsonb_build_object('from', v_target.username, 'to', v_next)
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', v_target.id,
    'previous_username', v_target.username,
    'username', v_next
  );
end;
$fn$;

create or replace function public.cw_admin_reset_student_password(
  p_token uuid, p_target_id uuid, p_admin_password text, p_new_password text
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare caller public.cw_users; v_target public.cw_users; wait_seconds integer; policy_error text;
begin
  perform set_config('response.status', '200', true);
  perform set_config('response.headers', '[]', true);
  select * into caller from public.cw_users
    where session_token = p_token and session_expires_at > now() and role = 'admin' for share;
  if not found then
    perform cw_auth_private.record_unauthorized_admin_call(p_token, 'cw_admin_reset_student_password');
    return cw_auth_private.error_response(403, 'CW_ADMIN_REQUIRED', '관리자 로그인이 필요합니다.');
  end if;
  wait_seconds := cw_auth_private.consume('admin-password-reset:' || caller.id::text, 10, 300);
  if wait_seconds > 0 then
    perform cw_auth_private.record_security_event(
      'high', 'rate_limit_blocked', caller.username, caller.id,
      coalesce(nullif(current_setting('codewiki.client_fp', true), ''), ''),
      'admin-rpc', 'CW_RATE_LIMIT',
      '관리자 비밀번호 재설정 요청 횟수 초과 차단',
      jsonb_build_object('bucket_type', 'admin-password-reset', 'retry_after', wait_seconds)
    );
    return cw_auth_private.error_response(429, 'CW_RATE_LIMIT', '시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.', wait_seconds);
  end if;
  if p_admin_password is null or octet_length(p_admin_password) > 4096 then
    perform cw_auth_private.record_security_event(
      'high', 'admin_password_failed', caller.username, caller.id,
      coalesce(nullif(current_setting('codewiki.client_fp', true), ''), ''),
      'admin-rpc', 'CW_ADMIN_PASSWORD',
      '관리자 본인 확인 비밀번호 검증 실패 (형식 오류)',
      jsonb_build_object('rpc', 'cw_admin_reset_student_password')
    );
    return cw_auth_private.error_response(400, 'CW_ADMIN_PASSWORD', '관리자 비밀번호를 확인해 주세요.');
  end if;
  if caller.password_hash is distinct from extensions.crypt(p_admin_password, caller.password_hash) then
    perform cw_auth_private.record_security_event(
      'high', 'admin_password_failed', caller.username, caller.id,
      coalesce(nullif(current_setting('codewiki.client_fp', true), ''), ''),
      'admin-rpc', 'CW_ADMIN_PASSWORD',
      '학생 비밀번호 재설정 중 관리자 비밀번호 불일치',
      jsonb_build_object('rpc', 'cw_admin_reset_student_password')
    );
    return cw_auth_private.error_response(400, 'CW_ADMIN_PASSWORD', '관리자 비밀번호를 확인해 주세요.');
  end if;
  policy_error := cw_auth_private.password_error(p_new_password);
  if policy_error is not null then
    return cw_auth_private.error_response(400, 'CW_PASSWORD_POLICY', policy_error);
  end if;

  update public.cw_users
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      session_token = null,
      session_expires_at = null
  where id = p_target_id and role = 'student'
  returning * into v_target;

  if not found then
    return cw_auth_private.error_response(404, 'CW_STUDENT_NOT_FOUND', '학생 계정을 찾을 수 없습니다.');
  end if;

  perform cw_auth_private.log_admin_action(
    caller.id,
    caller.full_name,
    'reset_password',
    v_target.id,
    v_target.full_name || ' (@' || v_target.username || ')',
    '{}'::jsonb
  );

  return jsonb_build_object('ok', true, 'user_id', p_target_id);
end;
$fn$;

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
      for update of p
    )
  )
  select count(*) into v_logged_out from recorded;

  perform cw_auth_private.log_admin_action(
    caller.id,
    caller.full_name,
    'logout_all',
    null,
    '전체 학생',
    jsonb_build_object('logged_out_count', v_logged_out)
  );

  return jsonb_build_object(
    'ok', true,
    'logged_out_count', v_logged_out
  );
end;
$fn$;

-- Enrich student directory with completed_docs count from cw_learning_progress.
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
      'login_count', coalesce(l.login_count, 0),
      'completed_docs', coalesce(pr.completed_docs, 0),
      'tools', jsonb_build_object('mentoring', false, 'foundation', false) || coalesce(tg.tools, '{}'::jsonb)
    ) order by u.full_name, u.id)
    from public.cw_users u
    left join public.cw_birthdays b on b.user_id = u.id
    left join cw_auth_private.student_tool_grants tg on tg.user_id = u.id
    left join (
      select user_id, max(logged_in_at) as last_login_at, count(*)::integer as login_count
      from cw_auth_private.login_logs
      group by user_id
    ) l on l.user_id = u.id
    left join (
      select user_id, count(*)::integer as completed_docs
      from public.cw_learning_progress
      where completed = true
      group by user_id
    ) pr on pr.user_id = u.id
    where u.role = 'student'
  ), '[]'::jsonb);
end;
$fn$;

-- 5. Individual student forced logout RPC.
create or replace function public.cw_admin_logout_student(
  p_token uuid,
  p_target_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_caller public.cw_users;
  v_target public.cw_users;
  v_wait integer;
  v_was_active boolean := false;
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
    perform cw_auth_private.record_unauthorized_admin_call(p_token, 'cw_admin_logout_student');
    return cw_auth_private.error_response(403, 'CW_ADMIN_REQUIRED', '관리자 로그인이 필요합니다.');
  end if;

  v_wait := cw_auth_private.consume('admin-logout-student:' || v_caller.id::text, 30, 60);
  if v_wait > 0 then
    return cw_auth_private.error_response(429, 'CW_RATE_LIMIT', '요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.', v_wait);
  end if;

  if p_target_id is null then
    return cw_auth_private.error_response(404, 'CW_STUDENT_NOT_FOUND', '학생 계정을 찾을 수 없습니다.');
  end if;

  select * into v_target
  from public.cw_users
  where id = p_target_id
    and role = 'student'
  for no key update;

  if not found then
    return cw_auth_private.error_response(404, 'CW_STUDENT_NOT_FOUND', '학생 계정을 찾을 수 없습니다.');
  end if;

  if v_target.session_token is not null and v_target.session_expires_at > now() then
    v_was_active := true;
    insert into cw_auth_private.forced_logouts (session_token, reason, created_at)
    values (v_target.session_token, 'admin_logout_single', now())
    on conflict (session_token) do update
      set reason = excluded.reason,
          created_at = excluded.created_at;
  end if;

  delete from cw_auth_private.forced_logouts
  where session_token in (
    select session_token
    from cw_auth_private.forced_logouts
    where created_at < now() - interval '2 days'
    order by session_token
    limit 200
    for update skip locked
  );

  update public.cw_users
  set session_token = null,
      session_expires_at = null
  where id = v_target.id;

  delete from public.cw_presence where user_id = v_target.id;

  perform cw_auth_private.log_admin_action(
    v_caller.id,
    v_caller.full_name,
    'logout_student',
    v_target.id,
    v_target.full_name || ' (@' || v_target.username || ')',
    jsonb_build_object('was_active', v_was_active)
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', v_target.id,
    'was_active', v_was_active
  );
end;
$fn$;

-- 6. Student runtime sync (live presence context, multi-device log, maintenance, feature flags, spotlight, live notice, 1:1 DMs).
create or replace function public.cw_client_sync(
  p_token uuid,
  p_doc_id text default null,
  p_doc_label text default null,
  p_device_type text default 'desktop',
  p_client_id text default null
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_caller public.cw_users;
  v_device text := case when p_device_type in ('desktop', 'mobile', 'tablet') then p_device_type else 'desktop' end;
  v_doc_id text := left(nullif(trim(coalesce(p_doc_id, '')), ''), 120);
  v_doc_label text := left(nullif(trim(coalesce(p_doc_label, '')), ''), 120);
  v_client_id text := left(nullif(trim(coalesce(p_client_id, '')), ''), 64);
  v_prev_seen timestamptz;
  v_last_client text;
  v_last_act timestamptz;
  v_sync_wait integer := 0;
  v_act_wait integer := 0;
  v_settings jsonb;
  v_notice jsonb := null;
  v_dms jsonb := '[]'::jsonb;
begin
  select * into v_caller
  from public.cw_users
  where session_token = p_token
    and session_expires_at > now()
    and (role = 'admin' or status = 'approved');

  if not found then
    if p_token is not null and exists (
      select 1 from cw_auth_private.forced_logouts f
      where f.session_token = p_token
        and f.created_at > now() - interval '2 days'
    ) then
      raise exception '관리자에 의해 로그아웃되었습니다.'
        using errcode = '42501', detail = 'CW_ADMIN_LOGOUT';
    end if;
    raise exception '접근 권한이 없습니다.' using errcode = '42501';
  end if;

  v_sync_wait := cw_auth_private.consume('client-sync:' || v_caller.id::text, 60, 60);

  if v_caller.role = 'student' and v_sync_wait = 0 then
    select p.last_seen into v_prev_seen
    from public.cw_presence p
    where p.user_id = v_caller.id;
  end if;

  if v_sync_wait = 0 then
    insert into public.cw_presence (user_id, session_token, last_seen, current_doc_id, current_label, device_type, client_id)
    values (v_caller.id, p_token, now(), v_doc_id, v_doc_label, v_device, v_client_id)
    on conflict (user_id) do update
      set session_token = excluded.session_token,
          last_seen = case
            when public.cw_presence.last_seen < now() - interval '55 seconds'
              or public.cw_presence.session_token <> excluded.session_token
            then excluded.last_seen
            else public.cw_presence.last_seen
          end,
          current_doc_id = coalesce(excluded.current_doc_id, public.cw_presence.current_doc_id),
          current_label = coalesce(excluded.current_label, public.cw_presence.current_label),
          device_type = excluded.device_type,
          client_id = coalesce(excluded.client_id, public.cw_presence.client_id)
      where public.cw_presence.last_seen < now() - interval '55 seconds'
         or public.cw_presence.session_token <> excluded.session_token
         or public.cw_presence.current_doc_id is distinct from coalesce(excluded.current_doc_id, public.cw_presence.current_doc_id)
         or public.cw_presence.device_type is distinct from excluded.device_type
         or public.cw_presence.client_id is distinct from coalesce(excluded.client_id, public.cw_presence.client_id);
  end if;

  if v_caller.role = 'student' then
    if v_sync_wait = 0 then
      perform cw_auth_private.record_student_revisit(v_caller.id, v_caller.role, v_caller.status, v_prev_seen);

      if v_client_id is not null and char_length(v_client_id) >= 8 then
        select a.client_id, a.seen_at into v_last_client, v_last_act
        from cw_auth_private.session_activity a
        where a.user_id = v_caller.id
        order by a.seen_at desc, a.id desc
        limit 1;

        if v_last_client is null or v_last_client <> v_client_id or v_last_act < now() - interval '5 minutes' then
          v_act_wait := cw_auth_private.consume('session-activity:' || v_caller.id::text, 20, 300);
          if v_act_wait = 0 then
            insert into cw_auth_private.session_activity (user_id, client_id, device_type, seen_at)
            values (v_caller.id, v_client_id, v_device, now());

            delete from cw_auth_private.session_activity
            where id in (
              select id from cw_auth_private.session_activity
              where seen_at < now() - interval '7 days'
              order by id
              limit 300
              for update skip locked
            );
          end if;
        end if;
      end if;
    end if;

    select jsonb_build_object(
      'id', n.id,
      'badge', n.badge,
      'title', n.title,
      'body', n.body,
      'cheer', n.cheer,
      'target_class', n.target_class,
      'created_at', n.created_at
    ) into v_notice
    from cw_auth_private.live_notices n
    where n.active = true
      and (n.target_class is null or n.target_class = '' or n.target_class = v_caller.class_name)
      and not exists (
        select 1 from cw_auth_private.live_notice_reads r
        where r.notice_id = n.id and r.user_id = v_caller.id
      )
    order by n.created_at desc
    limit 1;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id,
      'title', m.title,
      'body', m.body,
      'created_at', m.created_at
    ) order by m.created_at asc), '[]'::jsonb) into v_dms
    from (
      select id, title, body, created_at
      from cw_auth_private.direct_messages
      where target_user_id = v_caller.id
        and read_at is null
      order by created_at asc
      limit 10
    ) m;
  end if;

  v_settings := cw_auth_private.get_site_settings_json();

  return jsonb_build_object(
    'maintenance', v_settings->'maintenance',
    'feature_flags', v_settings->'feature_flags',
    'spotlight', v_settings->'spotlight',
    'active_notice', v_notice,
    'direct_messages', v_dms,
    'student_tools', case
      when v_caller.role = 'student' and v_caller.status = 'approved'
        then cw_auth_private.get_student_tools_json(v_caller.id)
      else '{}'::jsonb
    end
  );
end;
$fn$;

-- 7. Student notice read receipt & 1:1 DM acknowledgment RPCs.
create or replace function public.cw_ack_notice(
  p_token uuid,
  p_notice_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_caller public.cw_users;
begin
  select * into v_caller
  from public.cw_users
  where session_token = p_token
    and session_expires_at > now()
    and role = 'student'
    and status = 'approved';

  if not found then
    raise exception '접근 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_notice_id is null or not exists (
    select 1 from cw_auth_private.live_notices n
    where n.id = p_notice_id
      and n.active = true
      and (n.target_class is null or n.target_class = '' or n.target_class = v_caller.class_name)
  ) then
    return jsonb_build_object('ok', false);
  end if;

  insert into cw_auth_private.live_notice_reads (notice_id, user_id, read_at)
  values (p_notice_id, v_caller.id, now())
  on conflict (notice_id, user_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$fn$;

create or replace function public.cw_ack_direct_message(
  p_token uuid,
  p_message_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_caller public.cw_users;
begin
  select * into v_caller
  from public.cw_users
  where session_token = p_token
    and session_expires_at > now()
    and role = 'student'
    and status = 'approved';

  if not found then
    raise exception '접근 권한이 없습니다.' using errcode = '42501';
  end if;

  update cw_auth_private.direct_messages
  set read_at = now()
  where id = p_message_id
    and target_user_id = v_caller.id
    and read_at is null;

  return jsonb_build_object('ok', true);
end;
$fn$;

-- 8. Anonymous student analytics & client-error ingestion RPC (NO user_id stored).
create or replace function public.cw_track_event(
  p_token uuid,
  p_type text,
  p_target text,
  p_meta jsonb default '{}'::jsonb,
  p_device_type text default 'desktop'
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_caller public.cw_users;
  v_wait integer;
  v_target text := left(trim(coalesce(p_target, '')), 200);
  v_device text := case when p_device_type in ('desktop', 'mobile', 'tablet') then p_device_type else 'desktop' end;
  v_raw jsonb := case when p_meta is not null and jsonb_typeof(p_meta) = 'object' and octet_length(p_meta::text) <= 2000 then p_meta else '{}'::jsonb end;
  v_meta jsonb := '{}'::jsonb;
  v_dur integer;
  v_results integer;
begin
  select * into v_caller
  from public.cw_users
  where session_token = p_token
    and session_expires_at > now()
    and role = 'student'
    and status = 'approved';

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  if p_type is null or p_type not in ('doc_view', 'doc_stay', 'search', 'search_empty', 'code_copy', 'quiz_answer', 'client_error', 'security_probe')
     or char_length(v_target) = 0 then
    return jsonb_build_object('ok', false);
  end if;

  if p_type = 'security_probe' then
    v_wait := cw_auth_private.consume('track-event:' || v_caller.id::text, 120, 60);
    if v_wait > 0 then
      return jsonb_build_object('ok', false, 'throttled', true);
    end if;
    perform cw_auth_private.record_security_event(
      case when coalesce(v_raw->>'kind', '') = 'admin_route_probe' then 'warn' else 'high' end,
      case when coalesce(v_raw->>'kind', '') = 'admin_route_probe' then 'admin_route_probe' else 'suspicious_input' end,
      v_caller.username,
      v_caller.id,
      '',
      'client',
      case when coalesce(v_raw->>'kind', '') = 'admin_route_probe' then 'CW_ADMIN_ROUTE_PROBE' else 'CW_SUSPICIOUS_INPUT' end,
      case when coalesce(v_raw->>'kind', '') = 'admin_route_probe'
        then '학생 계정(' || v_caller.full_name || ')이 관리자 경로(' || left(v_target, 60) || ') 직접 접근 시도'
        else '학생 화면에서 의심스러운 입력/경로 탐색 감지 (' || left(v_target, 60) || ')'
      end,
      jsonb_build_object(
        'path', left(v_target, 100),
        'kind', left(coalesce(nullif(trim(v_raw->>'kind'), ''), 'probe'), 40),
        'class_name', v_caller.class_name,
        'device_type', v_device
      )
    );
    return jsonb_build_object('ok', true);
  end if;

  -- Strictly sanitize per-event JSONB schema so malformed student payloads can never break analytics reads.
  if p_type = 'doc_stay' then
    if jsonb_typeof(v_raw->'duration_sec') = 'number' and (v_raw->>'duration_sec') ~ '^[0-9]{1,6}$' then
      v_dur := greatest(1, least((v_raw->>'duration_sec')::integer, 3600));
    else
      return jsonb_build_object('ok', false);
    end if;
    v_meta := jsonb_build_object('duration_sec', v_dur);
  elsif p_type = 'quiz_answer' then
    if jsonb_typeof(v_raw->'correct') <> 'boolean' then
      return jsonb_build_object('ok', false);
    end if;
    v_meta := jsonb_build_object(
      'source', left(coalesce(nullif(trim(v_raw->>'source'), ''), 'quiz'), 40),
      'label', left(coalesce(nullif(trim(v_raw->>'label'), ''), v_target), 120),
      'correct', (v_raw->>'correct')::boolean
    );
  elsif p_type in ('search', 'search_empty') then
    v_results := case
      when jsonb_typeof(v_raw->'results') = 'number' and (v_raw->>'results') ~ '^[0-9]{1,6}$'
      then greatest(0, least((v_raw->>'results')::integer, 500))
      else 0
    end;
    v_meta := jsonb_build_object('results', v_results);
    -- Inspect zero-result queries with ABAP SQL keywords allowed so legitimate Open SQL searches never false-positive.
    if p_type = 'search_empty' and cw_auth_private.has_suspicious_payload(v_target, true) then
      perform cw_auth_private.record_security_event(
        'high', 'suspicious_input', v_caller.username, v_caller.id, '', 'search', 'CW_SUSPICIOUS_INPUT',
        '검색창에 SQLi/XSS 의심 패턴 입력 감지',
        jsonb_build_object('query', left(v_target, 80), 'class_name', v_caller.class_name, 'device_type', v_device)
      );
    end if;
  elsif p_type = 'client_error' then
    v_meta := jsonb_build_object(
      'source', left(coalesce(nullif(trim(v_raw->>'source'), ''), 'error'), 40),
      'message', left(trim(coalesce(v_raw->>'message', '')), 260)
    );
  else
    v_meta := '{}'::jsonb;
  end if;

  v_wait := cw_auth_private.consume('track-event:' || v_caller.id::text, 120, 60);
  if v_wait > 0 then
    return jsonb_build_object('ok', false, 'throttled', true);
  end if;

  insert into cw_auth_private.analytics_events (event_type, target_key, meta, device_type)
  values (p_type, v_target, v_meta, v_device);

  -- Bounded SKIP LOCKED cleanup (> 30 days) on ~2% of writes.
  if (hashtext(v_target || clock_timestamp()::text) & 63) = 0 then
    delete from cw_auth_private.analytics_events
    where id in (
      select id from cw_auth_private.analytics_events
      where created_at < now() - interval '30 days'
      order by id
      limit 500
      for update skip locked
    );
  end if;

  return jsonb_build_object('ok', true);
end;
$fn$;

-- 9. Admin remote controls RPCs (live notices, read receipts, 1:1 DMs, settings).
create or replace function public.cw_admin_publish_notice(
  p_token uuid,
  p_title text,
  p_body text,
  p_badge text default '실시간 공지',
  p_cheer text default '',
  p_target_class text default null
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_caller public.cw_users;
  v_wait integer;
  v_title text := trim(coalesce(p_title, ''));
  v_body text := trim(coalesce(p_body, ''));
  v_badge text := left(coalesce(nullif(trim(p_badge), ''), '실시간 공지'), 40);
  v_cheer text := left(trim(coalesce(p_cheer, '')), 200);
  v_class text := nullif(trim(coalesce(p_target_class, '')), '');
  v_row cw_auth_private.live_notices;
begin
  perform set_config('response.status', '200', true);
  perform set_config('response.headers', '[]', true);

  select * into v_caller from public.cw_users
    where session_token = p_token and session_expires_at > now() and role = 'admin'
    for share;
  if not found then
    perform cw_auth_private.record_unauthorized_admin_call(p_token, 'cw_admin_publish_notice');
    return cw_auth_private.error_response(403, 'CW_ADMIN_REQUIRED', '관리자 로그인이 필요합니다.');
  end if;

  v_wait := cw_auth_private.consume('admin-notice:' || v_caller.id::text, 20, 60);
  if v_wait > 0 then
    return cw_auth_private.error_response(429, 'CW_RATE_LIMIT', '요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.', v_wait);
  end if;

  if char_length(v_title) not between 1 and 160 or char_length(v_body) not between 1 and 4000 then
    return cw_auth_private.error_response(400, 'CW_INVALID_INPUT', '공지 제목(1~160자)과 내용(1~4000자)을 확인해 주세요.');
  end if;

  insert into cw_auth_private.live_notices (badge, title, body, cheer, target_class, active, created_by)
  values (v_badge, v_title, v_body, v_cheer, v_class, true, v_caller.id)
  returning * into v_row;

  perform cw_auth_private.log_admin_action(
    v_caller.id,
    v_caller.full_name,
    'publish_notice',
    null,
    v_row.title,
    jsonb_build_object('notice_id', v_row.id, 'target_class', coalesce(v_row.target_class, '전체'))
  );

  return jsonb_build_object(
    'ok', true,
    'notice', jsonb_build_object(
      'id', v_row.id,
      'badge', v_row.badge,
      'title', v_row.title,
      'body', v_row.body,
      'cheer', v_row.cheer,
      'target_class', v_row.target_class,
      'active', v_row.active,
      'created_at', v_row.created_at
    )
  );
end;
$fn$;

create or replace function public.cw_admin_update_notice(
  p_token uuid,
  p_notice_id uuid,
  p_active boolean default null,
  p_delete boolean default false
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_caller public.cw_users;
  v_row cw_auth_private.live_notices;
begin
  perform set_config('response.status', '200', true);
  perform set_config('response.headers', '[]', true);

  select * into v_caller from public.cw_users
    where session_token = p_token and session_expires_at > now() and role = 'admin'
    for share;
  if not found then
    perform cw_auth_private.record_unauthorized_admin_call(p_token, 'cw_admin_update_notice');
    return cw_auth_private.error_response(403, 'CW_ADMIN_REQUIRED', '관리자 로그인이 필요합니다.');
  end if;

  if coalesce(p_delete, false) then
    delete from cw_auth_private.live_notices where id = p_notice_id returning * into v_row;
    if not found then
      return cw_auth_private.error_response(404, 'CW_NOT_FOUND', '공지를 찾을 수 없습니다.');
    end if;
    perform cw_auth_private.log_admin_action(v_caller.id, v_caller.full_name, 'delete_notice', null, v_row.title, jsonb_build_object('notice_id', v_row.id));
    return jsonb_build_object('ok', true, 'deleted', true);
  end if;

  update cw_auth_private.live_notices
  set active = coalesce(p_active, not active),
      updated_at = now()
  where id = p_notice_id
  returning * into v_row;

  if not found then
    return cw_auth_private.error_response(404, 'CW_NOT_FOUND', '공지를 찾을 수 없습니다.');
  end if;

  perform cw_auth_private.log_admin_action(v_caller.id, v_caller.full_name, 'toggle_notice', null, v_row.title, jsonb_build_object('notice_id', v_row.id, 'active', v_row.active));

  return jsonb_build_object('ok', true, 'active', v_row.active);
end;
$fn$;

create or replace function public.cw_admin_notice_reads(
  p_token uuid,
  p_notice_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_notice cw_auth_private.live_notices;
begin
  perform 1 from public.cw_users
    where session_token = p_token and session_expires_at > now() and role = 'admin'
    for share;
  if not found then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  select * into v_notice from cw_auth_private.live_notices where id = p_notice_id;
  if not found then
    raise exception '공지를 찾을 수 없습니다.' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'notice', jsonb_build_object(
      'id', v_notice.id,
      'title', v_notice.title,
      'target_class', v_notice.target_class,
      'active', v_notice.active,
      'created_at', v_notice.created_at
    ),
    'read_users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id,
        'full_name', u.full_name,
        'username', u.username,
        'class_name', u.class_name,
        'student_number', u.student_number,
        'read_at', r.read_at
      ) order by r.read_at desc)
      from cw_auth_private.live_notice_reads r
      join public.cw_users u on u.id = r.user_id
      where r.notice_id = v_notice.id
        and u.role = 'student'
    ), '[]'::jsonb),
    'unread_users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id,
        'full_name', u.full_name,
        'username', u.username,
        'class_name', u.class_name,
        'student_number', u.student_number
      ) order by u.class_name, u.student_number nulls last, u.full_name)
      from public.cw_users u
      where u.role = 'student'
        and u.status = 'approved'
        and (v_notice.target_class is null or v_notice.target_class = '' or u.class_name = v_notice.target_class)
        and not exists (
          select 1 from cw_auth_private.live_notice_reads r
          where r.notice_id = v_notice.id and r.user_id = u.id
        )
    ), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.cw_admin_send_direct_message(
  p_token uuid,
  p_target_id uuid,
  p_title text,
  p_body text
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_caller public.cw_users;
  v_target public.cw_users;
  v_wait integer;
  v_title text := trim(coalesce(p_title, ''));
  v_body text := trim(coalesce(p_body, ''));
  v_row cw_auth_private.direct_messages;
begin
  perform set_config('response.status', '200', true);
  perform set_config('response.headers', '[]', true);

  select * into v_caller from public.cw_users
    where session_token = p_token and session_expires_at > now() and role = 'admin'
    for share;
  if not found then
    perform cw_auth_private.record_unauthorized_admin_call(p_token, 'cw_admin_send_direct_message');
    return cw_auth_private.error_response(403, 'CW_ADMIN_REQUIRED', '관리자 로그인이 필요합니다.');
  end if;

  v_wait := cw_auth_private.consume('admin-dm:' || v_caller.id::text, 30, 60);
  if v_wait > 0 then
    return cw_auth_private.error_response(429, 'CW_RATE_LIMIT', '요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.', v_wait);
  end if;

  if char_length(v_title) not between 1 and 120 or char_length(v_body) not between 1 and 1000 then
    return cw_auth_private.error_response(400, 'CW_INVALID_INPUT', '제목(1~120자)과 내용(1~1000자)을 입력해 주세요.');
  end if;

  select * into v_target from public.cw_users where id = p_target_id and role = 'student';
  if not found then
    return cw_auth_private.error_response(404, 'CW_STUDENT_NOT_FOUND', '학생 계정을 찾을 수 없습니다.');
  end if;

  insert into cw_auth_private.direct_messages (target_user_id, sender_id, title, body)
  values (v_target.id, v_caller.id, v_title, v_body)
  returning * into v_row;

  perform cw_auth_private.log_admin_action(
    v_caller.id,
    v_caller.full_name,
    'send_direct_message',
    v_target.id,
    v_target.full_name || ' (@' || v_target.username || ')',
    jsonb_build_object('title', v_row.title)
  );

  return jsonb_build_object(
    'ok', true,
    'message', jsonb_build_object(
      'id', v_row.id,
      'target_user_id', v_row.target_user_id,
      'title', v_row.title,
      'body', v_row.body,
      'created_at', v_row.created_at
    )
  );
end;
$fn$;

create or replace function public.cw_admin_update_setting(
  p_token uuid,
  p_key text,
  p_value jsonb
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_caller public.cw_users;
  v_wait integer;
  v_clean jsonb;
  v_action text;
begin
  perform set_config('response.status', '200', true);
  perform set_config('response.headers', '[]', true);

  select * into v_caller from public.cw_users
    where session_token = p_token and session_expires_at > now() and role = 'admin'
    for share;
  if not found then
    perform cw_auth_private.record_unauthorized_admin_call(p_token, 'cw_admin_update_setting');
    return cw_auth_private.error_response(403, 'CW_ADMIN_REQUIRED', '관리자 로그인이 필요합니다.');
  end if;

  v_wait := cw_auth_private.consume('admin-setting:' || v_caller.id::text, 40, 60);
  if v_wait > 0 then
    return cw_auth_private.error_response(429, 'CW_RATE_LIMIT', '요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.', v_wait);
  end if;

  if p_key is null or p_key not in ('maintenance', 'feature_flags', 'spotlight')
     or p_value is null or jsonb_typeof(p_value) <> 'object' then
    return cw_auth_private.error_response(400, 'CW_INVALID_INPUT', '설정 값을 확인해 주세요.');
  end if;

  if p_key = 'maintenance' then
    v_clean := jsonb_build_object(
      'enabled', case when jsonb_typeof(p_value->'enabled') = 'boolean' then (p_value->>'enabled')::boolean else false end,
      'message', left(coalesce(nullif(trim(p_value->>'message'), ''), '현재 사이트 점검 중입니다. 잠시 후 다시 이용해 주세요.'), 500),
      'updated_at', now()
    );
    v_action := 'update_maintenance';
  elsif p_key = 'feature_flags' then
    v_clean := jsonb_build_object(
      'basicSession', case when jsonb_typeof(p_value->'basicSession') = 'boolean' then (p_value->>'basicSession')::boolean else true end,
      'sqlGuide', case when jsonb_typeof(p_value->'sqlGuide') = 'boolean' then (p_value->>'sqlGuide')::boolean else true end,
      'dataGame', case when jsonb_typeof(p_value->'dataGame') = 'boolean' then (p_value->>'dataGame')::boolean else true end,
      'study', case when jsonb_typeof(p_value->'study') = 'boolean' then (p_value->>'study')::boolean else true end,
      'mentoring', case when jsonb_typeof(p_value->'mentoring') = 'boolean' then (p_value->>'mentoring')::boolean else true end,
      'knowledgeMap', case when jsonb_typeof(p_value->'knowledgeMap') = 'boolean' then (p_value->>'knowledgeMap')::boolean else true end,
      'practice', case when jsonb_typeof(p_value->'practice') = 'boolean' then (p_value->>'practice')::boolean else true end
    );
    v_action := 'update_feature_flags';
  else
    v_clean := jsonb_build_object(
      'active', case when jsonb_typeof(p_value->'active') = 'boolean' then (p_value->>'active')::boolean else false end,
      'doc_id', left(trim(coalesce(p_value->>'doc_id', '')), 120),
      'section_id', left(trim(coalesce(p_value->>'section_id', '')), 120),
      'label', left(trim(coalesce(p_value->>'label', '')), 140),
      'message', left(trim(coalesce(p_value->>'message', '')), 300),
      'sent_at', case when jsonb_typeof(p_value->'active') = 'boolean' and (p_value->>'active')::boolean then now() else null end
    );
    v_action := 'update_spotlight';
  end if;

  insert into cw_auth_private.site_settings (key, value, updated_by, updated_at)
  values (p_key, v_clean, v_caller.id, now())
  on conflict (key) do update
    set value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  perform cw_auth_private.log_admin_action(
    v_caller.id,
    v_caller.full_name,
    v_action,
    null,
    p_key,
    v_clean
  );

  return jsonb_build_object('ok', true, 'key', p_key, 'value', v_clean);
end;
$fn$;

-- 10. Admin read RPCs: Live Presence, Learning/Roster Overview, Controls State, Insights & Security.
create or replace function public.cw_admin_live_presence(p_token uuid)
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

  return jsonb_build_object(
    'online', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id,
        'full_name', u.full_name,
        'class_name', u.class_name,
        'role', u.role,
        'current_doc_id', p.current_doc_id,
        'current_label', p.current_label,
        'device_type', coalesce(p.device_type, 'desktop'),
        'last_seen', p.last_seen
      ) order by (u.role = 'admin') desc, u.full_name, u.id)
      from public.cw_presence p
      join public.cw_users u on u.id = p.user_id
      where p.last_seen > now() - interval '2 minutes'
        and p.session_token = u.session_token
        and u.session_expires_at > now()
        and (u.role = 'admin' or u.status = 'approved')
    ), '[]'::jsonb),
    'by_doc', coalesce((
      select jsonb_agg(jsonb_build_object(
        'doc_id', d.doc_id,
        'label', d.label,
        'count', d.cnt
      ) order by d.cnt desc, d.label)
      from (
        select
          coalesce(nullif(p.current_doc_id, ''), 'other') as doc_id,
          coalesce(nullif(max(p.current_label), ''), nullif(max(p.current_doc_id), ''), '탐색 중') as label,
          count(*)::integer as cnt
        from public.cw_presence p
        join public.cw_users u on u.id = p.user_id
        where p.last_seen > now() - interval '2 minutes'
          and p.session_token = u.session_token
          and u.session_expires_at > now()
          and u.role = 'student'
          and u.status = 'approved'
        group by coalesce(nullif(p.current_doc_id, ''), 'other')
      ) d
    ), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.cw_admin_learning_overview(p_token uuid)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  perform 1 from public.cw_users
    where session_token = p_token and session_expires_at > now() and role = 'admin'
    for share;
  if not found then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'total_students', count(*)::integer,
        'approved', count(*) filter (where u.status = 'approved')::integer,
        'pending', count(*) filter (where u.status = 'pending')::integer,
        'rejected', count(*) filter (where u.status = 'rejected')::integer,
        'dau_today', (
          select count(distinct l.user_id)::integer
          from cw_auth_private.login_logs l
          join public.cw_users su on su.id = l.user_id
          where su.role = 'student' and su.status = 'approved'
            and (l.logged_in_at at time zone 'Asia/Seoul')::date = v_today
        ),
        'active_7d', (
          select count(distinct l.user_id)::integer
          from cw_auth_private.login_logs l
          join public.cw_users su on su.id = l.user_id
          where su.role = 'student' and su.status = 'approved'
            and l.logged_in_at >= now() - interval '7 days'
        ),
        'avg_completed_docs', coalesce((
          select round(avg(cnt)::numeric, 1)
          from (
            select count(p.doc_id) filter (where p.completed) as cnt
            from public.cw_users su
            left join public.cw_learning_progress p on p.user_id = su.id
            where su.role = 'student' and su.status = 'approved'
            group by su.id
          ) t
        ), 0)
      )
      from public.cw_users u
      where u.role = 'student'
    ),
    'roster_classes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'class_name', r.class_name,
        'roster_total', r.roster_total,
        'registered_count', r.registered_count,
        'approved_count', r.approved_count,
        'pending_count', r.pending_count
      ) order by r.class_name)
      from (
        select
          cr.class_name,
          count(distinct cr.student_number)::integer as roster_total,
          count(distinct cr.student_number) filter (where u.id is not null)::integer as registered_count,
          count(distinct cr.student_number) filter (where u.status = 'approved')::integer as approved_count,
          count(distinct cr.student_number) filter (where u.status = 'pending')::integer as pending_count
        from public.cw_class_roster cr
        left join public.cw_users u
          on u.role = 'student'
         and u.status <> 'rejected'
         and u.class_name = cr.class_name
         and u.student_number = cr.student_number
        group by cr.class_name
      ) r
    ), '[]'::jsonb),
    'unregistered_roster', coalesce((
      select jsonb_agg(jsonb_build_object(
        'class_name', cr.class_name,
        'student_number', cr.student_number,
        'full_name', cr.full_name
      ) order by cr.class_name, cr.student_number)
      from public.cw_class_roster cr
      where not exists (
        select 1 from public.cw_users u
        where u.role = 'student'
          and u.status <> 'rejected'
          and u.class_name = cr.class_name
          and u.student_number = cr.student_number
      )
    ), '[]'::jsonb),
    'unit_progress', coalesce((
      select jsonb_agg(jsonb_build_object(
        'doc_id', up.doc_id,
        'completed_count', up.completed_count,
        'last_completed_at', up.last_completed_at
      ) order by up.completed_count desc, up.doc_id)
      from (
        select p.doc_id, count(*)::integer as completed_count, max(p.updated_at) as last_completed_at
        from public.cw_learning_progress p
        join public.cw_users u on u.id = p.user_id
        where p.completed = true
          and u.role = 'student'
          and u.status = 'approved'
        group by p.doc_id
      ) up
    ), '[]'::jsonb),
    'login_heatmap', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dow', h.dow,
        'hour', h.hour,
        'count', h.cnt
      ))
      from (
        select
          extract(dow from l.logged_in_at at time zone 'Asia/Seoul')::integer as dow,
          extract(hour from l.logged_in_at at time zone 'Asia/Seoul')::integer as hour,
          count(*)::integer as cnt
        from cw_auth_private.login_logs l
        join public.cw_users u on u.id = l.user_id
        where u.role = 'student'
          and l.logged_in_at >= now() - interval '30 days'
        group by 1, 2
      ) h
    ), '[]'::jsonb),
    'daily_logins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', to_char(d.day, 'YYYY-MM-DD'),
        'unique_students', coalesce(dl.unique_students, 0),
        'total_logins', coalesce(dl.total_logins, 0)
      ) order by d.day asc)
      from generate_series(v_today - 13, v_today, interval '1 day') as d(day)
      left join (
        select
          (l.logged_in_at at time zone 'Asia/Seoul')::date as day,
          count(distinct l.user_id)::integer as unique_students,
          count(*)::integer as total_logins
        from cw_auth_private.login_logs l
        join public.cw_users u on u.id = l.user_id
        where u.role = 'student'
          and (l.logged_in_at at time zone 'Asia/Seoul')::date >= v_today - 13
        group by 1
      ) dl on dl.day = d.day::date
    ), '[]'::jsonb),
    'inactive_students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'full_name', s.full_name,
        'username', s.username,
        'class_name', s.class_name,
        'student_number', s.student_number,
        'last_login_at', s.last_login_at,
        'days_inactive', s.days_inactive,
        'completed_docs', s.completed_docs
      ) order by s.last_login_at asc nulls first, s.full_name)
      from (
        select
          u.id,
          u.full_name,
          u.username,
          u.class_name,
          u.student_number,
          l.last_login_at,
          greatest(0, floor(extract(epoch from (now() - coalesce(l.last_login_at, u.created_at))) / 86400))::integer as days_inactive,
          coalesce(pr.completed_docs, 0) as completed_docs
        from public.cw_users u
        left join (
          select user_id, max(logged_in_at) as last_login_at
          from cw_auth_private.login_logs
          group by user_id
        ) l on l.user_id = u.id
        left join (
          select user_id, count(*)::integer as completed_docs
          from public.cw_learning_progress
          where completed = true
          group by user_id
        ) pr on pr.user_id = u.id
        where u.role = 'student' and u.status = 'approved'
      ) s
    ), '[]'::jsonb),
    -- Strictly aggregate study-note metadata ONLY (no titles, no body content, no per-student private data).
    'study_stats', (
      select jsonb_build_object(
        'active_authors', count(distinct n.owner_id)::integer,
        'total_notes', count(n.id)::integer,
        'notes_updated_7d', count(n.id) filter (where n.updated_at >= now() - interval '7 days')::integer,
        'avg_notes_per_author', case when count(distinct n.owner_id) > 0
          then round((count(n.id)::numeric / count(distinct n.owner_id)), 1)
          else 0 end
      )
      from public.cw_study_notes n
      join public.cw_users u on u.id = n.owner_id
      where u.role = 'student'
    )
  );
end;
$fn$;

create or replace function public.cw_admin_controls_state(p_token uuid)
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

  return jsonb_build_object(
    'settings', cw_auth_private.get_site_settings_json(),
    'notices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id,
        'badge', n.badge,
        'title', n.title,
        'body', n.body,
        'cheer', n.cheer,
        'target_class', n.target_class,
        'active', n.active,
        'created_at', n.created_at,
        'read_count', (
          select count(*)::integer
          from cw_auth_private.live_notice_reads r
          join public.cw_users u on u.id = r.user_id
          where r.notice_id = n.id
            and u.role = 'student'
            and u.status = 'approved'
            and (n.target_class is null or n.target_class = '' or u.class_name = n.target_class)
        ),
        'target_count', (
          select count(*)::integer
          from public.cw_users u
          where u.role = 'student' and u.status = 'approved'
            and (n.target_class is null or n.target_class = '' or u.class_name = n.target_class)
        )
      ) order by n.created_at desc)
      from (
        select * from cw_auth_private.live_notices
        order by created_at desc
        limit 20
      ) n
    ), '[]'::jsonb),
    'direct_messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'target_user_id', m.target_user_id,
        'full_name', u.full_name,
        'username', u.username,
        'class_name', u.class_name,
        'title', m.title,
        'body', m.body,
        'created_at', m.created_at,
        'read_at', m.read_at
      ) order by m.created_at desc)
      from (
        select * from cw_auth_private.direct_messages
        order by created_at desc
        limit 30
      ) m
      join public.cw_users u on u.id = m.target_user_id
    ), '[]'::jsonb)
  );
end;
$fn$;

create or replace function public.cw_admin_insights_and_security(
  p_token uuid,
  p_days integer default 14
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 14), 30));
  v_since timestamptz := now() - make_interval(days => v_days);
begin
  perform 1 from public.cw_users
    where session_token = p_token and session_expires_at > now() and role = 'admin'
    for share;
  if not found then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'window_days', v_days,
    'top_docs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'doc_id', d.doc_id,
        'views', d.views,
        'avg_stay_sec', d.avg_stay_sec
      ) order by d.views desc, d.doc_id)
      from (
        select
          v.target_key as doc_id,
          count(*)::integer as views,
          coalesce((
            select round(avg(greatest(1, least((s.meta->>'duration_sec')::numeric, 3600))))::integer
            from cw_auth_private.analytics_events s
            where s.event_type = 'doc_stay'
              and s.target_key = v.target_key
              and s.created_at >= v_since
              and (s.meta->>'duration_sec') ~ '^[0-9]+$'
          ), 0) as avg_stay_sec
        from cw_auth_private.analytics_events v
        where v.event_type = 'doc_view'
          and v.created_at >= v_since
        group by v.target_key
        order by views desc, v.target_key
        limit 15
      ) d
    ), '[]'::jsonb),
    'top_searches', coalesce((
      select jsonb_agg(jsonb_build_object('query', s.q, 'count', s.cnt) order by s.cnt desc, s.q)
      from (
        select lower(target_key) as q, count(*)::integer as cnt
        from cw_auth_private.analytics_events
        where event_type = 'search' and created_at >= v_since
        group by lower(target_key)
        order by cnt desc, q
        limit 20
      ) s
    ), '[]'::jsonb),
    'failed_searches', coalesce((
      select jsonb_agg(jsonb_build_object('query', s.q, 'count', s.cnt) order by s.cnt desc, s.q)
      from (
        select lower(target_key) as q, count(*)::integer as cnt
        from cw_auth_private.analytics_events
        where event_type = 'search_empty' and created_at >= v_since
        group by lower(target_key)
        order by cnt desc, q
        limit 20
      ) s
    ), '[]'::jsonb),
    'top_copies', coalesce((
      select jsonb_agg(jsonb_build_object('doc_id', c.target_key, 'count', c.cnt) order by c.cnt desc, c.target_key)
      from (
        select target_key, count(*)::integer as cnt
        from cw_auth_private.analytics_events
        where event_type = 'code_copy' and created_at >= v_since
        group by target_key
        order by cnt desc, target_key
        limit 15
      ) c
    ), '[]'::jsonb),
    'hardest_quizzes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'target_key', q.target_key,
        'source', q.source,
        'label', q.label,
        'attempts', q.attempts,
        'wrong_count', q.wrong_count,
        'wrong_rate', q.wrong_rate
      ) order by q.wrong_rate desc, q.attempts desc, q.target_key)
      from (
        select
          target_key,
          coalesce(nullif(meta->>'source', ''), 'quiz') as source,
          coalesce(nullif(max(meta->>'label'), ''), target_key) as label,
          count(*)::integer as attempts,
          count(*) filter (where meta->'correct' is distinct from 'true'::jsonb)::integer as wrong_count,
          round((count(*) filter (where meta->'correct' is distinct from 'true'::jsonb)::numeric * 100) / nullif(count(*), 0), 1) as wrong_rate
        from cw_auth_private.analytics_events
        where event_type = 'quiz_answer' and created_at >= v_since
        group by target_key, coalesce(nullif(meta->>'source', ''), 'quiz')
        order by wrong_rate desc, attempts desc
        limit 15
      ) q
    ), '[]'::jsonb),
    'device_breakdown', coalesce((
      select jsonb_agg(jsonb_build_object('device_type', d.device_type, 'count', d.cnt) order by d.cnt desc)
      from (
        select device_type, count(*)::integer as cnt
        from cw_auth_private.analytics_events
        where event_type = 'doc_view' and created_at >= v_since
        group by device_type
      ) d
    ), '[]'::jsonb),
    'multi_device_alerts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'full_name', u.full_name,
        'username', u.username,
        'class_name', u.class_name,
        'distinct_devices', m.distinct_devices,
        'switches_24h', m.switches_24h,
        'device_types', m.device_types,
        'last_seen_at', m.last_seen_at
      ) order by m.switches_24h desc, m.distinct_devices desc, m.last_seen_at desc)
      from (
        select
          seq.user_id,
          count(distinct seq.client_id)::integer as distinct_devices,
          count(*) filter (where seq.prev_client is not null and seq.prev_client <> seq.client_id)::integer as switches_24h,
          array_agg(distinct seq.device_type) as device_types,
          max(seq.seen_at) as last_seen_at
        from (
          select
            user_id,
            client_id,
            device_type,
            seen_at,
            lag(client_id) over (partition by user_id order by seen_at, id) as prev_client
          from cw_auth_private.session_activity
          where seen_at >= now() - interval '24 hours'
        ) seq
        group by seq.user_id
        having count(distinct seq.client_id) >= 2
      ) m
      join public.cw_users u on u.id = m.user_id
      where u.role = 'student'
    ), '[]'::jsonb),
    'rate_limits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'category', rl.category,
        'attempts', rl.attempts,
        'max_attempts', rl.max_attempts,
        'resets_at', rl.resets_at,
        'remaining_sec', rl.remaining_sec,
        'blocked', rl.blocked
      ) order by rl.blocked desc, rl.attempts desc, rl.resets_at desc)
      from (
        select
          rl_raw.category,
          rl_raw.attempts,
          rl_raw.max_attempts,
          rl_raw.resets_at,
          rl_raw.remaining_sec,
          (rl_raw.resets_at > now() and rl_raw.attempts >= rl_raw.max_attempts) as blocked
        from (
          select
            bucket,
            case
              when bucket = 'login:global' then '전체 로그인 상한'
              when bucket = 'signup:global' then '전체 가입 상한'
              when bucket = 'encrypted-auth:global' then '보안 인증 게이트웨이'
              when bucket like 'login:%' then '계정 로그인 시도'
              when bucket like 'signup:%' then '계정 가입 시도'
              when bucket like 'client:missing:%' then 'IP 미확인 클라이언트'
              when bucket like 'client:%' then '클라이언트 IP 요청'
              when bucket like 'admin-%' then '관리자 작업 제한'
              when bucket like 'track-event:%' then '이벤트 수집 제한'
              when bucket like 'session-activity:%' then '기기 전환 기록 제한'
              when bucket like 'client-sync:%' then '실시간 동기화 제한'
              else '기타 보안 버킷'
            end as category,
            attempts,
            case
              when bucket = 'login:global' then 3000
              when bucket = 'signup:global' then 600
              when bucket = 'encrypted-auth:global' then 6000
              when bucket like 'login:%' then 10
              when bucket like 'signup:%' then 3
              when bucket like 'client:login:%' or bucket = 'client:missing:login' then 120
              when bucket like 'client:%' then 60
              when bucket like 'admin-password-reset:%' or bucket like 'admin-logout-all:%' then 10
              when bucket like 'admin-notice:%' then 20
              when bucket like 'admin-setting:%' then 40
              when bucket like 'admin-tools:%' then 60
              when bucket like 'track-event:%' then 120
              when bucket like 'session-activity:%' then 20
              when bucket like 'client-sync:%' then 60
              else 30
            end as max_attempts,
            resets_at,
            greatest(0, floor(extract(epoch from (resets_at - now()))))::integer as remaining_sec
          from cw_auth_private.limits
          where resets_at > now() - interval '1 hour'
            and bucket not like 'sec-log:%'
        ) rl_raw
        where (rl_raw.resets_at > now() and rl_raw.attempts >= rl_raw.max_attempts)
           or (rl_raw.bucket not like 'track-event:%'
               and rl_raw.bucket not like 'client-sync:%'
               and rl_raw.bucket not like 'session-activity:%')
        order by (rl_raw.resets_at > now() and rl_raw.attempts >= rl_raw.max_attempts) desc, rl_raw.attempts desc, rl_raw.resets_at desc
        limit 40
      ) rl
    ), '[]'::jsonb),
    'security_summary', (
      select jsonb_build_object(
        'total_events', count(*)::integer,
        'alerts_24h', count(*) filter (where severity in ('high', 'critical') and created_at >= now() - interval '24 hours')::integer,
        'critical_count', count(*) filter (where severity = 'critical')::integer,
        'high_count', count(*) filter (where severity = 'high')::integer,
        'warn_count', count(*) filter (where severity = 'warn')::integer,
        'info_count', count(*) filter (where severity = 'info')::integer,
        'login_failures', count(*) filter (where event_type = 'login_failed')::integer,
        'rate_limit_blocks', count(*) filter (where event_type = 'rate_limit_blocked')::integer,
        'tamper_or_origin', count(*) filter (where event_type in ('envelope_tampered', 'origin_denied', 'replay_attack', 'method_abuse'))::integer,
        'unauthorized_admin', count(*) filter (where event_type in ('unauthorized_admin_access', 'admin_route_probe', 'admin_password_failed'))::integer,
        'suspicious_inputs', count(*) filter (where event_type = 'suspicious_input')::integer,
        'unique_sources', count(distinct nullif(client_fp, ''))::integer,
        'targeted_accounts_count', count(distinct nullif(lower(target_account), '')) filter (where target_account <> '' and target_account <> '미인증 요청')::integer
      )
      from cw_auth_private.security_events
      where created_at >= v_since
    ),
    'security_events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', se.id,
        'severity', se.severity,
        'event_type', se.event_type,
        'target_account', se.target_account,
        'target_user_id', se.target_user_id,
        'user_full_name', se.user_full_name,
        'user_class_name', se.user_class_name,
        'user_role', se.user_role,
        'user_status', se.user_status,
        'client_fp', se.client_fp,
        'source', se.source,
        'reason_code', se.reason_code,
        'summary', se.summary,
        'details', se.details,
        'created_at', se.created_at
      ) order by se.created_at desc, se.id desc)
      from (
        select
          e.id, e.severity, e.event_type, e.target_account, e.target_user_id,
          u.full_name as user_full_name, u.class_name as user_class_name, u.role as user_role, u.status as user_status,
          e.client_fp, e.source, e.reason_code, e.summary, e.details, e.created_at
        from cw_auth_private.security_events e
        left join public.cw_users u on u.id = e.target_user_id
        where e.created_at >= v_since
        order by e.created_at desc, e.id desc
        limit 150
      ) se
    ), '[]'::jsonb),
    'targeted_accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'target_account', ta.target_account,
        'user_id', u.id,
        'full_name', u.full_name,
        'class_name', u.class_name,
        'role', u.role,
        'status', u.status,
        'total_events', ta.total_events,
        'login_failures', ta.login_failures,
        'high_or_critical', ta.high_or_critical,
        'unique_sources', ta.unique_sources,
        'event_types', ta.event_types,
        'last_seen_at', ta.last_seen_at
      ) order by ta.high_or_critical desc, ta.total_events desc, ta.last_seen_at desc)
      from (
        select
          lower(e.target_account) as account_key,
          max(e.target_account) as target_account,
          count(*)::integer as total_events,
          count(*) filter (where e.event_type = 'login_failed')::integer as login_failures,
          count(*) filter (where e.severity in ('high', 'critical'))::integer as high_or_critical,
          count(distinct nullif(e.client_fp, ''))::integer as unique_sources,
          array_agg(distinct e.event_type) as event_types,
          max(e.created_at) as last_seen_at
        from cw_auth_private.security_events e
        where e.created_at >= v_since
          and e.target_account <> ''
          and e.target_account <> '미인증 요청'
        group by lower(e.target_account)
        order by count(*) filter (where e.severity in ('high', 'critical')) desc, count(*) desc, max(e.created_at) desc
        limit 10
      ) ta
      left join public.cw_users u on lower(u.username) = ta.account_key
    ), '[]'::jsonb),
    'attack_breakdown', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_type', ab.event_type,
        'count', ab.cnt,
        'high_or_critical', ab.high_or_critical,
        'last_seen_at', ab.last_seen_at
      ) order by ab.cnt desc, ab.high_or_critical desc, ab.event_type)
      from (
        select
          event_type,
          count(*)::integer as cnt,
          count(*) filter (where severity in ('high', 'critical'))::integer as high_or_critical,
          max(created_at) as last_seen_at
        from cw_auth_private.security_events
        where created_at >= v_since
        group by event_type
      ) ab
    ), '[]'::jsonb),
    'top_sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'client_fp', ts.client_fp,
        'total_events', ts.total_events,
        'high_or_critical', ts.high_or_critical,
        'distinct_accounts', ts.distinct_accounts,
        'event_types', ts.event_types,
        'last_seen_at', ts.last_seen_at
      ) order by ts.high_or_critical desc, ts.total_events desc, ts.last_seen_at desc)
      from (
        select
          client_fp,
          count(*)::integer as total_events,
          count(*) filter (where severity in ('high', 'critical'))::integer as high_or_critical,
          count(distinct nullif(lower(target_account), '')) filter (where target_account <> '' and target_account <> '미인증 요청')::integer as distinct_accounts,
          array_agg(distinct event_type) as event_types,
          max(created_at) as last_seen_at
        from cw_auth_private.security_events
        where created_at >= v_since
          and client_fp <> ''
        group by client_fp
        order by count(*) filter (where severity in ('high', 'critical')) desc, count(*) desc, max(created_at) desc
        limit 10
      ) ts
    ), '[]'::jsonb),
    'client_errors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'target_key', e.target_key,
        'message', coalesce(e.meta->>'message', ''),
        'source', coalesce(e.meta->>'source', ''),
        'device_type', e.device_type,
        'created_at', e.created_at
      ) order by e.created_at desc, e.id desc)
      from (
        select id, target_key, meta, device_type, created_at
        from cw_auth_private.analytics_events
        where event_type = 'client_error'
          and created_at >= v_since
        order by created_at desc, id desc
        limit 30
      ) e
    ), '[]'::jsonb),
    'audit_logs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'admin_name', a.admin_name,
        'action', a.action,
        'target_label', a.target_label,
        'details', a.details,
        'created_at', a.created_at
      ) order by a.created_at desc, a.id desc)
      from (
        select id, admin_name, action, target_label, details, created_at
        from cw_auth_private.admin_audit_logs
        order by created_at desc, id desc
        limit 100
      ) a
    ), '[]'::jsonb)
  );
end;
$fn$;

-- 10b. Admin per-student dedicated tool permissions RPC.
create or replace function public.cw_admin_set_student_tools(
  p_token uuid,
  p_target_id uuid,
  p_tools jsonb
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_caller public.cw_users;
  v_target public.cw_users;
  v_wait integer;
  v_before jsonb;
  v_next jsonb;
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
    perform cw_auth_private.record_unauthorized_admin_call(p_token, 'cw_admin_set_student_tools');
    return cw_auth_private.error_response(403, 'CW_ADMIN_REQUIRED', '관리자 로그인이 필요합니다.');
  end if;

  v_wait := cw_auth_private.consume('admin-tools:' || v_caller.id::text, 60, 60);
  if v_wait > 0 then
    return cw_auth_private.error_response(429, 'CW_RATE_LIMIT', '요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.', v_wait);
  end if;

  if p_target_id is null or p_tools is null or jsonb_typeof(p_tools) <> 'object' then
    return cw_auth_private.error_response(400, 'CW_INVALID_INPUT', '권한 설정 형식이 올바르지 않습니다.');
  end if;

  select * into v_target
  from public.cw_users
  where id = p_target_id
    and role = 'student'
  for no key update;

  if not found then
    return cw_auth_private.error_response(404, 'CW_STUDENT_NOT_FOUND', '학생 계정을 찾을 수 없습니다.');
  end if;

  v_before := cw_auth_private.get_student_tools_json(v_target.id);
  v_next := jsonb_build_object(
    'mentoring', case
      when jsonb_typeof(p_tools->'mentoring') = 'boolean' then (p_tools->'mentoring')::boolean
      else coalesce((v_before->>'mentoring')::boolean, false)
    end,
    'foundation', case
      when jsonb_typeof(p_tools->'foundation') = 'boolean' then (p_tools->'foundation')::boolean
      else coalesce((v_before->>'foundation')::boolean, false)
    end
  );

  insert into cw_auth_private.student_tool_grants (user_id, tools, updated_by, updated_at)
  values (v_target.id, v_next, v_caller.id, now())
  on conflict (user_id) do update
    set tools = excluded.tools,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  perform cw_auth_private.log_admin_action(
    v_caller.id,
    v_caller.full_name,
    'update_student_tools',
    v_target.id,
    v_target.full_name || ' (@' || v_target.username || ')',
    jsonb_build_object('before', v_before, 'after', v_next)
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', v_target.id,
    'tools', v_next
  );
end;
$fn$;

-- 10c. Security-instrumented auth request, encrypted auth gateway, and service-role Edge Function security logger.
create or replace function cw_auth_private.request(
  p_action text, p_username text, p_password text, p_full_name text default null,
  p_class_name text default '기본반', p_mbti text default '', p_birth_date date default null,
  p_share_with_class boolean default false, p_student_number integer default null
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, extensions, pg_temp
as $fn$
declare
  v_login boolean := p_action = 'login';
  v_id text := lower(trim(coalesce(p_username, '')));
  v_now timestamptz := clock_timestamp();
  v_wait integer;
  v_error text;
  v_result jsonb;
  v_global text;
  v_fp text := coalesce(nullif(current_setting('codewiki.client_fp', true), ''), '');
  v_match public.cw_users;
  v_recent_fails integer := 0;
  v_suspicious_field text := '';
begin
  perform set_config('response.status', '200', true);
  perform set_config('response.headers', '[]', true);
  v_global := case when v_login then 'login:global' else 'signup:global' end;

  -- Detect SQLi/XSS injection probes in username or signup name without altering caller error contracts.
  if cw_auth_private.has_suspicious_payload(p_username) then
    v_suspicious_field := 'username';
  elsif not v_login and cw_auth_private.has_suspicious_payload(p_full_name) then
    v_suspicious_field := 'full_name';
  end if;
  if v_suspicious_field <> '' then
    perform cw_auth_private.record_security_event(
      'critical', 'suspicious_input', left(v_id, 80), null, v_fp,
      case when v_login then 'login' else 'signup' end, 'CW_SUSPICIOUS_INPUT',
      case when v_login then '로그인 입력창에 SQLi/XSS 의심 패턴 감지' else '회원가입 입력창에 SQLi/XSS 의심 패턴 감지' end,
      jsonb_build_object(
        'field', v_suspicious_field,
        'sample', left(case when v_suspicious_field = 'username' then coalesce(p_username, '') else coalesce(p_full_name, '') end, 80)
      )
    );
  end if;

  -- Bounded SKIP LOCKED cleanup avoids AB-BA lock inversion with concurrent per-client upserts.
  if not exists (select 1 from cw_auth_private.limits where bucket = v_global and resets_at > v_now) then
    delete from cw_auth_private.limits
    where bucket in (
      select bucket from cw_auth_private.limits
      where resets_at < v_now - interval '1 day'
      order by bucket
      limit 500
      for update skip locked
    );
  end if;
  v_wait := cw_auth_private.consume(v_global, case when v_login then 3000 else 600 end, case when v_login then 300 else 3600 end);
  if v_wait > 0 then
    perform cw_auth_private.record_security_event(
      'critical', 'rate_limit_blocked', left(v_id, 80), null, v_fp,
      case when v_login then 'login' else 'signup' end, 'CW_RATE_LIMIT',
      case when v_login then '전체 로그인 상한 초과 차단 (대규모 시도 감지)' else '전체 회원가입 상한 초과 차단 (가입 도배 감지)' end,
      jsonb_build_object('bucket_type', v_global, 'retry_after', v_wait)
    );
    return cw_auth_private.error_response(429, 'CW_RATE_LIMIT', '요청이 많습니다. 잠시 후 다시 시도해 주세요.', v_wait);
  end if;
  if p_username is null or char_length(v_id) < 2 or (not v_login and char_length(v_id) > 100) then
    return cw_auth_private.error_response(400, 'CW_INVALID_INPUT', '아이디는 2~100자로 입력해 주세요.');
  end if;
  -- Same quota for known and unknown names: a 429 must not confirm an account.
  v_wait := cw_auth_private.consume(
    case when v_login then 'login:' else 'signup:' end || encode(extensions.digest(v_id, 'sha256'), 'hex'),
    case when v_login then 10 else 3 end, case when v_login then 300 else 900 end
  );
  if v_wait > 0 then
    select * into v_match from public.cw_users where lower(username) = v_id limit 1;
    perform cw_auth_private.record_security_event(
      case when v_match.role = 'admin' then 'critical' else 'high' end,
      'rate_limit_blocked', left(v_id, 80), v_match.id, v_fp,
      case when v_login then 'login' else 'signup' end, 'CW_RATE_LIMIT',
      case when v_login
        then case when v_match.role = 'admin'
          then '관리자 계정(@' || left(v_id, 40) || ') 로그인 무차별 시도 횟수 초과 차단'
          else '계정(@' || left(v_id, 40) || ') 로그인 5분 10회 한도 초과 차단'
        end
        else '계정(@' || left(v_id, 40) || ') 회원가입 15분 3회 한도 초과 차단'
      end,
      jsonb_build_object(
        'bucket_type', case when v_login then 'login:account' else 'signup:account' end,
        'retry_after', v_wait,
        'account_exists', v_match.id is not null,
        'account_role', coalesce(v_match.role, 'unknown')
      )
    );
    return cw_auth_private.error_response(429, 'CW_RATE_LIMIT', '시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.', v_wait);
  end if;
  if not v_login then
    v_error := cw_auth_private.password_error(p_password);
    if v_error is not null then
      perform cw_auth_private.record_security_event(
        'info', 'signup_failed', left(v_id, 80), null, v_fp, 'signup', 'CW_PASSWORD_POLICY',
        '회원가입 비밀번호 정책 미충족 (@' || left(v_id, 40) || ')',
        jsonb_build_object('class_name', left(coalesce(p_class_name, ''), 20))
      );
      return cw_auth_private.error_response(400, 'CW_PASSWORD_POLICY', v_error);
    end if;
    if upper(trim(coalesce(p_mbti, ''))) !~ '^([EI][SN][TF][JP])?$' then
      return cw_auth_private.error_response(400, 'CW_INVALID_INPUT', 'MBTI를 확인해 주세요.');
    end if;
  elsif p_password is null or octet_length(p_password) > 4096 then
    select * into v_match from public.cw_users where lower(username) = v_id limit 1;
    perform cw_auth_private.record_security_event(
      case when v_match.role = 'admin' then 'high' else 'warn' end,
      'login_failed', left(v_id, 80), v_match.id, v_fp, 'login', 'CW_INVALID_CREDENTIALS',
      '비정상 비밀번호 형식 로그인 시도 (@' || left(v_id, 40) || ')',
      jsonb_build_object('account_exists', v_match.id is not null, 'account_role', coalesce(v_match.role, 'unknown'), 'malformed_password', true)
    );
    return cw_auth_private.error_response(400, 'CW_INVALID_CREDENTIALS', '아이디 또는 비밀번호를 확인해 주세요.');
  end if;
  -- Only application writes roll back on failure; quota updates above survive.
  begin
    if v_login then
      v_result := cw_auth_private.cw_login(v_id, p_password);
    elsif p_action = 'roster' then
      v_result := cw_auth_private.cw_signup_with_roster(v_id, p_password, p_full_name, p_class_name, p_mbti, p_birth_date, p_share_with_class, p_student_number);
    else
      v_result := cw_auth_private.cw_signup(v_id, p_password, p_full_name, p_class_name, p_mbti);
      if p_action = 'birthday' then
        perform public.cw_set_my_birthday((v_result->>'session_token')::uuid, p_birth_date, p_share_with_class);
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
      select * into v_match from public.cw_users where lower(username) = v_id limit 1;
      select count(*)::integer into v_recent_fails
      from cw_auth_private.security_events
      where event_type = 'login_failed'
        and lower(target_account) = v_id
        and created_at >= v_now - interval '15 minutes';
      perform cw_auth_private.record_security_event(
        case when v_match.role = 'admin' or v_recent_fails >= 4 then 'high' else 'warn' end,
        'login_failed', left(v_id, 80), v_match.id, v_fp, 'login', 'CW_INVALID_CREDENTIALS',
        case
          when v_match.role = 'admin' then '관리자 계정(@' || left(v_id, 40) || ') 로그인 실패'
          when v_match.id is not null then '로그인 실패 — 등록 계정(' || v_match.full_name || ' · @' || left(v_id, 40) || ')'
          else '로그인 실패 — 미등록 아이디(@' || left(v_id, 40) || ') 시도'
        end,
        jsonb_build_object(
          'account_exists', v_match.id is not null,
          'account_role', coalesce(v_match.role, 'unknown'),
          'account_status', coalesce(v_match.status, 'none'),
          'recent_15m_fails', v_recent_fails + 1
        )
      );
      return cw_auth_private.error_response(400, 'CW_INVALID_CREDENTIALS', '아이디 또는 비밀번호를 확인해 주세요.');
    elsif sqlstate in ('P0001', '22023') then
      perform cw_auth_private.record_security_event(
        'info', 'signup_failed', left(v_id, 80), null, v_fp, 'signup', 'CW_INVALID_INPUT',
        '회원가입 검증 실패 (@' || left(v_id, 40) || ')',
        jsonb_build_object('class_name', left(coalesce(p_class_name, ''), 20), 'sqlstate', sqlstate)
      );
      return cw_auth_private.error_response(400, 'CW_INVALID_INPUT', sqlerrm);
    elsif sqlstate = '23505' then
      perform cw_auth_private.record_security_event(
        'info', 'signup_failed', left(v_id, 80), null, v_fp, 'signup', 'CW_DUPLICATE_SIGNUP',
        '중복 정보로 회원가입 시도 (@' || left(v_id, 40) || ')',
        jsonb_build_object('class_name', left(coalesce(p_class_name, ''), 20))
      );
      return cw_auth_private.error_response(400, 'CW_INVALID_INPUT', '이미 사용 중인 가입 정보입니다.');
    else
      perform cw_auth_private.record_security_event(
        'warn', 'signup_failed', left(v_id, 80), null, v_fp, 'signup', 'CW_SIGNUP_FAILED',
        '회원가입 처리 실패 (@' || left(v_id, 40) || ')',
        jsonb_build_object('class_name', left(coalesce(p_class_name, ''), 20))
      );
      return cw_auth_private.error_response(400, 'CW_SIGNUP_FAILED', '가입 신청을 처리하지 못했습니다. 입력 내용을 확인해 주세요.');
    end if;
  end;
end;
$fn$;

create or replace function public.cw_secure_auth(
  p_operation text, p_args jsonb, p_request_id uuid, p_expires_at timestamptz, p_client text
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_now timestamptz := clock_timestamp();
  v_wait integer;
  v_result jsonb;
  v_op text;
  v_client_bucket text;
  v_fp text;
begin
  perform set_config('response.status', '200', true);
  perform set_config('response.headers', '[]', true);
  v_fp := case when p_client is not null and p_client ~ '^[0-9a-f]{64}$' then left(p_client, 12) else 'no-ip' end;
  perform set_config('codewiki.client_fp', v_fp, true);

  if p_operation is null or p_operation not in ('cw_login', 'cw_signup_with_roster', 'cw_admin_reset_student_password')
     or p_request_id is null or p_expires_at is null or p_expires_at <= v_now or p_expires_at > v_now + interval '70 seconds'
     or p_args is null or jsonb_typeof(p_args) <> 'object' or octet_length(p_args::text) > 12000
     or (p_client is not null and p_client !~ '^[0-9a-f]{64}$') then
    perform cw_auth_private.record_security_event(
      'high', 'envelope_tampered', '', null, v_fp, 'secure-auth', 'CW_ENVELOPE_INVALID',
      '보안 인증 게이트웨이 봉투 형식/만료 검증 실패',
      jsonb_build_object('operation', left(coalesce(p_operation, 'unknown'), 40))
    );
    return cw_auth_private.error_response(400, 'CW_ENVELOPE_INVALID', '보안 요청을 확인해 주세요.');
  end if;

  v_op := case p_operation when 'cw_login' then 'login' when 'cw_signup_with_roster' then 'signup' else 'reset' end;
  v_client_bucket := case when p_client is not null then 'client:' || v_op || ':' || p_client else 'client:missing:' || v_op end;
  v_wait := cw_auth_private.consume(
    v_client_bucket,
    case p_operation when 'cw_login' then 120 else 60 end,
    case p_operation when 'cw_signup_with_roster' then 3600 else 300 end
  );
  if v_wait > 0 then
    perform cw_auth_private.record_security_event(
      'critical', 'rate_limit_blocked', left(lower(trim(coalesce(p_args->>'p_username', ''))), 80), null, v_fp,
      'secure-auth', 'CW_RATE_LIMIT',
      '동일 출처(IP 지문) 과다 인증 요청 차단',
      jsonb_build_object(
        'bucket_type', case when p_client is not null then 'client:' || v_op else 'client:missing:' || v_op end,
        'operation', p_operation,
        'retry_after', v_wait
      )
    );
    return cw_auth_private.error_response(429, 'CW_RATE_LIMIT', '요청이 많습니다. 잠시 후 다시 시도해 주세요.', v_wait);
  end if;

  -- Bounded SKIP LOCKED cleanup of expired nonces and 180-day login_logs once per global window.
  if not exists (select 1 from cw_auth_private.limits where bucket = 'encrypted-auth:global' and resets_at > v_now) then
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

  v_wait := cw_auth_private.consume('encrypted-auth:global', 6000, 300);
  if v_wait > 0 then
    perform cw_auth_private.record_security_event(
      'critical', 'rate_limit_blocked', '', null, v_fp, 'secure-auth', 'CW_RATE_LIMIT',
      '보안 인증 게이트웨이 전체 요청 상한 초과 차단',
      jsonb_build_object('bucket_type', 'encrypted-auth:global', 'retry_after', v_wait)
    );
    return cw_auth_private.error_response(429, 'CW_RATE_LIMIT', '잠시 후 다시 시도해 주세요.', v_wait);
  end if;

  insert into cw_auth_private.used_envelopes values (p_request_id, p_expires_at) on conflict do nothing;
  if not found then
    perform cw_auth_private.record_security_event(
      'high', 'replay_attack', left(lower(trim(coalesce(p_args->>'p_username', ''))), 80), null, v_fp,
      'secure-auth', 'CW_REPLAY',
      '암호화 인증 패킷 재전송(Replay) 공격 차단',
      jsonb_build_object('operation', p_operation)
    );
    return cw_auth_private.error_response(409, 'CW_REPLAY', '이미 처리된 요청입니다.');
  end if;

  begin
    if p_operation = 'cw_login' then
      v_result := cw_auth_private.request('login', p_args->>'p_username', p_args->>'p_password');
    elsif p_operation = 'cw_signup_with_roster' then
      v_result := cw_auth_private.request('roster', p_args->>'p_username', p_args->>'p_password',
        p_args->>'p_full_name', p_args->>'p_class_name', p_args->>'p_mbti',
        (p_args->>'p_birth_date')::date, (p_args->>'p_share_with_class')::boolean, (p_args->>'p_student_number')::integer);
    else
      v_result := public.cw_admin_reset_student_password((p_args->>'p_token')::uuid, (p_args->>'p_target_id')::uuid,
        p_args->>'p_admin_password', p_args->>'p_new_password');
    end if;
    if v_result ? 'code' then
      return jsonb_build_object('code', v_result->>'code');
    end if;
    if p_operation = 'cw_admin_reset_student_password' then
      return jsonb_build_object('ok', v_result->'ok', 'user_id', v_result->'user_id');
    end if;
    return jsonb_build_object('session_token', v_result->'session_token');
  exception when others then
    return cw_auth_private.error_response(400, 'CW_INVALID_INPUT', '입력 내용을 확인해 주세요.');
  end;
end;
$fn$;

create or replace function public.cw_secure_auth(
  p_operation text, p_args jsonb, p_request_id uuid, p_expires_at timestamptz
)
returns jsonb
language sql
security definer set search_path = pg_catalog, pg_temp
as $fn$
  select public.cw_secure_auth(p_operation, p_args, p_request_id, p_expires_at, null::text);
$fn$;

-- Service-role-only Edge Function security event logger (Origin denied, tampered JWE, method abuse).
create or replace function public.cw_log_edge_security_event(
  p_event_type text,
  p_reason_code text,
  p_client text default null,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_type text := trim(coalesce(p_event_type, ''));
  v_code text := left(trim(coalesce(p_reason_code, '')), 60);
  v_fp text := case when p_client is not null and p_client ~ '^[0-9a-f]{64}$' then left(p_client, 12) else 'no-ip' end;
  v_raw jsonb := case when p_details is not null and jsonb_typeof(p_details) = 'object' and octet_length(p_details::text) <= 2000 then p_details else '{}'::jsonb end;
  v_clean jsonb;
  v_sev text;
  v_sum text;
begin
  if v_type not in ('origin_denied', 'envelope_tampered', 'method_abuse') then
    return jsonb_build_object('ok', false);
  end if;

  v_clean := jsonb_strip_nulls(jsonb_build_object(
    'origin', nullif(left(trim(coalesce(v_raw->>'origin', '')), 120), ''),
    'method', nullif(left(trim(coalesce(v_raw->>'method', '')), 16), ''),
    'reason', nullif(left(trim(coalesce(v_raw->>'reason', '')), 60), ''),
    'has_query', case when jsonb_typeof(v_raw->'has_query') = 'boolean' then (v_raw->'has_query') else null end
  ));

  v_sev := case when v_type in ('origin_denied', 'envelope_tampered') then 'high' else 'warn' end;
  v_sum := case v_type
    when 'origin_denied' then '허용되지 않은 Origin(' || coalesce(nullif(v_clean->>'origin', ''), '미제공') || ')에서 인증 서버 접근 차단'
    when 'envelope_tampered' then '위변조·손상된 JWE 암호화 인증 요청 차단 (' || coalesce(nullif(v_clean->>'reason', ''), 'invalid') || ')'
    else '허용되지 않은 HTTP 메서드(' || coalesce(nullif(v_clean->>'method', ''), '?') || ')로 인증 서버 접근 차단'
  end;

  perform cw_auth_private.record_security_event(
    v_sev, v_type, '', null, v_fp, 'edge-auth', v_code, v_sum, v_clean
  );

  return jsonb_build_object('ok', true);
end;
$fn$;

-- 11. Strict least-privilege function grants.
revoke all on function
  public.cw_me(uuid),
  public.cw_admin_set_status(uuid, uuid, text),
  public.cw_admin_delete_rejected_user(uuid, uuid),
  public.cw_admin_update_student_username(uuid, uuid, text),
  public.cw_admin_logout_all(uuid),
  public.cw_admin_student_directory(uuid),
  public.cw_admin_logout_student(uuid, uuid),
  public.cw_client_sync(uuid, text, text, text, text),
  public.cw_ack_notice(uuid, uuid),
  public.cw_ack_direct_message(uuid, uuid),
  public.cw_track_event(uuid, text, text, jsonb, text),
  public.cw_admin_publish_notice(uuid, text, text, text, text, text),
  public.cw_admin_update_notice(uuid, uuid, boolean, boolean),
  public.cw_admin_notice_reads(uuid, uuid),
  public.cw_admin_send_direct_message(uuid, uuid, text, text),
  public.cw_admin_update_setting(uuid, text, jsonb),
  public.cw_admin_set_student_tools(uuid, uuid, jsonb),
  public.cw_admin_live_presence(uuid),
  public.cw_admin_learning_overview(uuid),
  public.cw_admin_controls_state(uuid),
  public.cw_admin_insights_and_security(uuid, integer)
from public;

-- Keep credential & edge security RPCs closed to anon/authenticated (service_role only).
revoke all on function
  public.cw_admin_reset_student_password(uuid, uuid, text, text),
  public.cw_secure_auth(text, jsonb, uuid, timestamptz, text),
  public.cw_secure_auth(text, jsonb, uuid, timestamptz),
  public.cw_log_edge_security_event(text, text, text, jsonb)
from public, anon, authenticated;
grant execute on function
  public.cw_admin_reset_student_password(uuid, uuid, text, text),
  public.cw_secure_auth(text, jsonb, uuid, timestamptz, text),
  public.cw_secure_auth(text, jsonb, uuid, timestamptz),
  public.cw_log_edge_security_event(text, text, text, jsonb)
to service_role;

revoke all on all functions in schema cw_auth_private from public, anon, authenticated;

grant execute on function
  public.cw_me(uuid),
  public.cw_admin_set_status(uuid, uuid, text),
  public.cw_admin_delete_rejected_user(uuid, uuid),
  public.cw_admin_update_student_username(uuid, uuid, text),
  public.cw_admin_logout_all(uuid),
  public.cw_admin_student_directory(uuid),
  public.cw_admin_logout_student(uuid, uuid),
  public.cw_client_sync(uuid, text, text, text, text),
  public.cw_ack_notice(uuid, uuid),
  public.cw_ack_direct_message(uuid, uuid),
  public.cw_track_event(uuid, text, text, jsonb, text),
  public.cw_admin_publish_notice(uuid, text, text, text, text, text),
  public.cw_admin_update_notice(uuid, uuid, boolean, boolean),
  public.cw_admin_notice_reads(uuid, uuid),
  public.cw_admin_send_direct_message(uuid, uuid, text, text),
  public.cw_admin_update_setting(uuid, text, jsonb),
  public.cw_admin_set_student_tools(uuid, uuid, jsonb),
  public.cw_admin_live_presence(uuid),
  public.cw_admin_learning_overview(uuid),
  public.cw_admin_controls_state(uuid),
  public.cw_admin_insights_and_security(uuid, integer)
to anon, authenticated;

notify pgrst, 'reload schema';
commit;
