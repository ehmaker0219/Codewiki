-- Security threshold tuning & rich admin-only login history metadata:
-- 1. Treat up to 5 login failures per account within 15 minutes as normal 'info' (non-risk);
--    escalate only from the 6th failure onward ('high' for student/unknown, 'critical' for admin).
-- 2. Disable multi-device / session-switching detection completely (stop logging session_activity,
--    exclude multi-device counts from cw_me and cw_admin_insights_and_security).
-- 3. Enrich cw_auth_private.login_logs & public.cw_admin_login_history with login_type,
--    validated connecting IP, country_code, device_type, device_model, os_name, browser_name,
--    language, and truncated User-Agent across direct logins, signups, and auto-revisits.
-- Apply after 20261127-admin-command-center.sql. Idempotent; keeps all private objects locked.
begin;
set local lock_timeout = '5s';

-- 0. Additive metadata columns on private admin-only login_logs & admin security ack watermark.
alter table cw_auth_private.login_logs
  add column if not exists login_type text not null default 'login',
  add column if not exists ip_address text,
  add column if not exists country_code text,
  add column if not exists device_type text,
  add column if not exists device_model text,
  add column if not exists os_name text,
  add column if not exists browser_name text,
  add column if not exists language text,
  add column if not exists user_agent text;

create table if not exists cw_auth_private.admin_security_reads (
  admin_id uuid primary key references public.cw_users(id) on delete cascade,
  ack_at timestamptz not null default now()
);
alter table cw_auth_private.admin_security_reads enable row level security;
revoke all on table cw_auth_private.admin_security_reads from public, anon, authenticated;

-- 1. Private helpers: effective security severity & login metadata sanitization/extraction.
create or replace function cw_auth_private.effective_security_severity(
  p_event_type text,
  p_severity text,
  p_details jsonb
)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $fn$
  select case
    when p_event_type = 'login_failed'
      and not (
        case
          when p_details is not null and jsonb_typeof(p_details->'malformed_password') = 'boolean'
            then (p_details->>'malformed_password')::boolean
          else false
        end
      )
      and (
        not (coalesce(p_details->>'recent_15m_fails', '') ~ '^[0-9]{1,6}$')
        or (p_details->>'recent_15m_fails')::integer <= 5
      )
    then 'info'
    else coalesce(nullif(p_severity, ''), 'warn')
  end;
$fn$;

create or replace function cw_auth_private.sanitize_login_meta(p_meta jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_ip text;
  v_country text;
  v_dev text;
  v_model text;
  v_os text;
  v_browser text;
  v_lang text;
  v_ua text;
begin
  if p_meta is null or jsonb_typeof(p_meta) <> 'object' then
    return '{}'::jsonb;
  end if;

  v_ip := nullif(left(regexp_replace(trim(coalesce(p_meta->>'ip', p_meta->>'ip_address', '')), '[^0-9a-fA-F.:]', '', 'g'), 45), '');
  if v_ip is not null then
    if v_ip ~* '^::ffff:[0-9]{1,3}(\.[0-9]{1,3}){3}$' then
      v_ip := substring(v_ip from 8);
    end if;
    if not (v_ip ~ '^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$'
            or (position(':' in v_ip) > 0 and v_ip ~ '^[0-9a-fA-F:]{2,45}$')) then
      v_ip := null;
    else
      v_ip := lower(v_ip);
    end if;
  end if;

  v_country := upper(trim(coalesce(p_meta->>'country', p_meta->>'country_code', '')));
  if v_country = 'T1' then
    v_country := 'TOR';
  elsif v_country = 'TOR' or (v_country ~ '^[A-Z]{2}$' and v_country <> 'XX') then
    null;
  else
    v_country := null;
  end if;

  v_dev := lower(trim(coalesce(p_meta->>'device_type', '')));
  if v_dev not in ('desktop', 'mobile', 'tablet') then
    v_dev := null;
  end if;

  v_model := nullif(left(regexp_replace(trim(coalesce(p_meta->>'device_model', '')), '[[:cntrl:]]', '', 'g'), 64), '');
  v_os := nullif(left(regexp_replace(trim(coalesce(p_meta->>'os', p_meta->>'os_name', '')), '[[:cntrl:]]', '', 'g'), 48), '');
  v_browser := nullif(left(regexp_replace(trim(coalesce(p_meta->>'browser', p_meta->>'browser_name', '')), '[[:cntrl:]]', '', 'g'), 48), '');

  v_lang := nullif(left(regexp_replace(trim(coalesce(p_meta->>'language', '')), '[[:cntrl:]]', '', 'g'), 24), '');
  if v_lang is not null and v_lang !~ '^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$' then
    v_lang := null;
  end if;

  v_ua := nullif(left(regexp_replace(trim(coalesce(p_meta->>'user_agent', '')), '[[:cntrl:]]', ' ', 'g'), 260), '');

  return jsonb_strip_nulls(jsonb_build_object(
    'ip', v_ip,
    'country', v_country,
    'device_type', v_dev,
    'device_model', v_model,
    'os', v_os,
    'browser', v_browser,
    'language', v_lang,
    'user_agent', v_ua
  ));
end;
$fn$;

-- Extract device/OS/browser/IP/country from PostgREST request.headers for automatic revisit logs.
create or replace function cw_auth_private.extract_request_login_meta(p_device_hint text default null)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_hdr_raw text;
  v_hdr jsonb := '{}'::jsonb;
  v_ip text;
  v_xff text;
  v_country text;
  v_ua text;
  v_ch_plat text;
  v_ch_mob text;
  v_ch_model text;
  v_lang text;
  v_dev text;
  v_model text;
  v_os text;
  v_browser text;
  v_m text[];
begin
  v_hdr_raw := nullif(current_setting('request.headers', true), '');
  if v_hdr_raw is not null then
    begin
      v_hdr := v_hdr_raw::jsonb;
    exception when others then
      v_hdr := '{}'::jsonb;
    end;
  end if;

  v_ip := nullif(trim(coalesce(v_hdr->>'cf-connecting-ip', '')), '');
  if v_ip is null then
    v_ip := nullif(trim(coalesce(v_hdr->>'x-real-ip', '')), '');
  end if;
  if v_ip is null then
    v_xff := nullif(trim(coalesce(v_hdr->>'x-forwarded-for', '')), '');
    if v_xff is not null then
      v_ip := nullif(trim(split_part(v_xff, ',', 1)), '');
    end if;
  end if;

  v_country := nullif(trim(coalesce(v_hdr->>'cf-ipcountry', '')), '');
  v_ua := nullif(trim(coalesce(v_hdr->>'user-agent', '')), '');
  v_ch_plat := nullif(trim(both '"' from trim(coalesce(v_hdr->>'sec-ch-ua-platform', ''))), '');
  v_ch_mob := trim(coalesce(v_hdr->>'sec-ch-ua-mobile', ''));
  v_ch_model := nullif(trim(both '"' from trim(coalesce(v_hdr->>'sec-ch-ua-model', ''))), '');
  if v_ch_model in ('', 'K') then v_ch_model := null; end if;

  v_lang := nullif(trim(split_part(split_part(coalesce(v_hdr->>'accept-language', ''), ',', 1), ';', 1)), '');

  if v_ua is not null then
    -- OS & device model
    if v_ua ~* 'iPhone' then
      v_dev := 'mobile';
      v_model := 'iPhone';
      v_m := regexp_match(v_ua, 'OS ([0-9]+)[._]([0-9]+)');
      v_os := case when v_m is not null then 'iOS ' || v_m[1] || '.' || v_m[2] else 'iOS' end;
    elsif v_ua ~* 'iPad' then
      v_dev := 'tablet';
      v_model := 'iPad';
      v_m := regexp_match(v_ua, 'OS ([0-9]+)[._]([0-9]+)');
      v_os := case when v_m is not null then 'iPadOS ' || v_m[1] || '.' || v_m[2] else 'iPadOS' end;
    elsif v_ua ~* 'Android' then
      v_m := regexp_match(v_ua, 'Android ([0-9]+(?:\.[0-9]+)?)');
      v_os := case when v_m is not null then 'Android ' || v_m[1] else 'Android' end;
      v_m := regexp_match(v_ua, '\y(SM-[A-Z0-9]+)\y');
      if v_m is not null then
        if v_m[1] ~ '^SM-[TX]' then
          v_dev := 'tablet';
          v_model := 'Galaxy Tab (' || v_m[1] || ')';
        else
          v_dev := case when v_ua ~* 'Mobile' then 'mobile' else 'tablet' end;
          v_model := 'Galaxy (' || v_m[1] || ')';
        end if;
      else
        v_dev := case when v_ua ~* 'Tablet' or v_ua !~* 'Mobile' then 'tablet' else 'mobile' end;
        v_m := regexp_match(v_ua, '\y(Pixel [0-9]+[a-zA-Z0-9 ]{0,12})');
        if v_m is not null then
          v_model := trim(v_m[1]);
        elsif v_ch_model is not null then
          v_model := v_ch_model;
        else
          v_model := case when v_dev = 'tablet' then 'Android 태블릿' else 'Android 기기' end;
        end if;
      end if;
    elsif v_ua ~* 'Windows NT' then
      v_dev := 'desktop';
      v_model := 'Windows PC';
      v_os := case
        when v_ua ~* 'Windows NT 10\.0' then 'Windows 10/11'
        when v_ua ~* 'Windows NT 6\.[123]' then 'Windows 7/8'
        else 'Windows'
      end;
    elsif v_ua ~* 'Macintosh|Mac OS X' then
      v_dev := 'desktop';
      v_model := 'Mac';
      v_m := regexp_match(v_ua, 'Mac OS X ([0-9]+)[._]([0-9]+)');
      v_os := case when v_m is not null then 'macOS ' || v_m[1] || '.' || v_m[2] else 'macOS' end;
    elsif v_ua ~* 'CrOS' then
      v_dev := 'desktop';
      v_model := 'Chromebook';
      v_os := 'ChromeOS';
    elsif v_ua ~* 'Linux' then
      v_dev := 'desktop';
      v_model := 'Linux PC';
      v_os := 'Linux';
    end if;

    -- Browser (specific Korean/in-app/Chromium forks before generic Chrome/Safari)
    if v_ua ~* 'KAKAOTALK' then
      v_browser := 'KakaoTalk 인앱';
    elsif v_ua ~* 'NAVER\(' or v_ua ~* 'NAVER/' then
      v_browser := 'NAVER 앱';
    elsif v_ua ~* 'Instagram' then
      v_browser := 'Instagram 인앱';
    elsif v_ua ~* 'Whale/' then
      v_m := regexp_match(v_ua, 'Whale/([0-9]+)');
      v_browser := case when v_m is not null then 'Whale ' || v_m[1] else 'Whale' end;
    elsif v_ua ~* 'SamsungBrowser/' then
      v_m := regexp_match(v_ua, 'SamsungBrowser/([0-9]+)');
      v_browser := case when v_m is not null then 'Samsung Internet ' || v_m[1] else 'Samsung Internet' end;
    elsif v_ua ~* 'Edg(A|iOS)?/' then
      v_m := regexp_match(v_ua, 'Edg(?:A|iOS)?/([0-9]+)');
      v_browser := case when v_m is not null then 'Edge ' || v_m[1] else 'Edge' end;
    elsif v_ua ~* 'OPR/' then
      v_m := regexp_match(v_ua, 'OPR/([0-9]+)');
      v_browser := case when v_m is not null then 'Opera ' || v_m[1] else 'Opera' end;
    elsif v_ua ~* 'CriOS/' then
      v_m := regexp_match(v_ua, 'CriOS/([0-9]+)');
      v_browser := case when v_m is not null then 'Chrome ' || v_m[1] else 'Chrome' end;
    elsif v_ua ~* 'FxiOS/|Firefox/' then
      v_m := regexp_match(v_ua, '(?:FxiOS|Firefox)/([0-9]+)');
      v_browser := case when v_m is not null then 'Firefox ' || v_m[1] else 'Firefox' end;
    elsif v_ua ~* 'Chrome/' then
      v_m := regexp_match(v_ua, 'Chrome/([0-9]+)');
      v_browser := case when v_m is not null then 'Chrome ' || v_m[1] else 'Chrome' end;
    elsif v_ua ~* 'Safari/' then
      v_m := regexp_match(v_ua, 'Version/([0-9]+)');
      v_browser := case when v_m is not null then 'Safari ' || v_m[1] else 'Safari' end;
    end if;
  end if;

  if v_dev is null then
    if v_ch_mob = '?1' then v_dev := 'mobile';
    elsif p_device_hint in ('desktop', 'mobile', 'tablet') then v_dev := p_device_hint;
    elsif v_ch_mob = '?0' then v_dev := 'desktop';
    end if;
  end if;

  if v_os is null and v_ch_plat is not null then
    v_os := left(v_ch_plat, 48);
  end if;

  return cw_auth_private.sanitize_login_meta(jsonb_build_object(
    'ip', v_ip,
    'country', v_country,
    'device_type', v_dev,
    'device_model', v_model,
    'os', v_os,
    'browser', v_browser,
    'language', v_lang,
    'user_agent', v_ua
  ));
end;
$fn$;

create or replace function cw_auth_private.insert_login_log(
  p_user_id uuid,
  p_logged_in_at timestamptz,
  p_login_type text default 'login',
  p_meta jsonb default null
)
returns void
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_type text := case when p_login_type in ('login', 'signup', 'revisit') then p_login_type else 'login' end;
  v_raw text;
  v_meta jsonb := '{}'::jsonb;
begin
  if p_user_id is null then return; end if;

  if p_meta is not null and jsonb_typeof(p_meta) = 'object' and p_meta <> '{}'::jsonb then
    v_meta := cw_auth_private.sanitize_login_meta(p_meta);
  else
    v_raw := nullif(current_setting('codewiki.login_meta', true), '');
    if v_raw is not null then
      begin
        v_meta := cw_auth_private.sanitize_login_meta(v_raw::jsonb);
      exception when others then
        v_meta := '{}'::jsonb;
      end;
    end if;
  end if;

  insert into cw_auth_private.login_logs (
    user_id, logged_in_at, login_type, ip_address, country_code,
    device_type, device_model, os_name, browser_name, language, user_agent
  ) values (
    p_user_id,
    coalesce(p_logged_in_at, clock_timestamp()),
    v_type,
    v_meta->>'ip',
    v_meta->>'country',
    v_meta->>'device_type',
    v_meta->>'device_model',
    v_meta->>'os',
    v_meta->>'browser',
    v_meta->>'language',
    v_meta->>'user_agent'
  );
end;
$fn$;

-- 2. Enrich cw_login & record_student_revisit with login metadata.
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
  v_dummy_hash constant text := '$2a$10$CwTycUXWue0Thq9StjUM0uJ8hG2eJ4kR3nW6z9P2rX5qL1vB8mK7u';
  v_cost integer;
  v_next_hash text;
begin
  select * into v_user
  from public.cw_users
  where lower(username) = lower(trim(p_username))
  limit 1;

  if not found then
    perform extensions.crypt(coalesce(p_password, ''), v_dummy_hash);
    raise exception '아이디 또는 비밀번호를 확인해 주세요.';
  end if;

  if v_user.password_hash is distinct from extensions.crypt(p_password, v_user.password_hash) then
    raise exception '아이디 또는 비밀번호를 확인해 주세요.';
  end if;

  v_cost := coalesce(substring(v_user.password_hash from '^\$2[aby]\$(\d{2})\$')::integer, 0);
  if v_cost < 10 then
    v_next_hash := extensions.crypt(p_password, extensions.gen_salt('bf', 10));
  else
    v_next_hash := v_user.password_hash;
  end if;

  update public.cw_users
  set password_hash = v_next_hash,
      session_token = v_new_token,
      session_expires_at = now() + case when v_user.role = 'admin' then interval '12 hours' else interval '24 hours' end
  where id = v_user.id;

  if v_user.role = 'student' and v_user.status <> 'rejected' then
    perform cw_auth_private.insert_login_log(v_user.id, clock_timestamp(), 'login', null);
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
  v_meta jsonb;
begin
  if p_user_id is null or p_role <> 'student' or p_status = 'rejected' then
    return;
  end if;

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
    v_meta := cw_auth_private.extract_request_login_meta(nullif(current_setting('codewiki.revisit_device', true), ''));
    perform cw_auth_private.insert_login_log(p_user_id, v_now, 'revisit', v_meta);
  end if;
end;
$fn$;

-- 3. cw_me: count only unacknowledged effective high/critical security_events in 24h (no multi-device alerts).
create or replace function public.cw_me(p_token uuid)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_user public.cw_users;
  v_pending_count int := 0;
  v_security_alert_count int := 0;
  v_security_ack_at timestamptz := null;
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

    select r.ack_at into v_security_ack_at
    from cw_auth_private.admin_security_reads r
    where r.admin_id = v_user.id;

    select count(*)::integer into v_security_alert_count
    from cw_auth_private.security_events e
    where cw_auth_private.effective_security_severity(e.event_type, e.severity, e.details) in ('high', 'critical')
      and e.created_at >= now() - interval '24 hours'
      and (v_security_ack_at is null or e.created_at > v_security_ack_at);
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
    'security_ack_at', v_security_ack_at,
    'tools', case
      when v_user.role = 'student' and v_user.status = 'approved'
        then cw_auth_private.get_student_tools_json(v_user.id)
      else '{}'::jsonb
    end
  );
end;
$fn$;

create or replace function public.cw_admin_ack_security_alerts(p_token uuid)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_caller public.cw_users;
  v_wait integer;
  v_ack_at timestamptz;
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
    perform cw_auth_private.record_unauthorized_admin_call(p_token, 'cw_admin_ack_security_alerts');
    return cw_auth_private.error_response(403, 'CW_ADMIN_REQUIRED', '관리자 로그인이 필요합니다.');
  end if;

  v_wait := cw_auth_private.consume('admin-sec-ack:' || v_caller.id::text, 60, 60);
  if v_wait > 0 then
    return cw_auth_private.error_response(429, 'CW_RATE_LIMIT', '요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.', v_wait);
  end if;

  select greatest(clock_timestamp(), coalesce(max(created_at), clock_timestamp()))
  into v_ack_at
  from cw_auth_private.security_events;

  insert into cw_auth_private.admin_security_reads (admin_id, ack_at)
  values (v_caller.id, v_ack_at)
  on conflict (admin_id) do update
    set ack_at = greatest(cw_auth_private.admin_security_reads.ack_at, excluded.ack_at);

  return jsonb_build_object('ok', true, 'ack_at', v_ack_at);
end;
$fn$;

-- 4. cw_client_sync: stop logging multi-device session_activity; pass device hint for revisit metadata.
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
  v_sync_wait integer := 0;
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
      perform set_config('codewiki.revisit_device', v_device, true);
      perform cw_auth_private.record_student_revisit(v_caller.id, v_caller.role, v_caller.status, v_prev_seen);
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

-- 5. Admin-only login history RPC with full device, OS, browser, IP, country, language, and login type.
create or replace function public.cw_admin_login_history(
  p_token uuid,
  p_limit integer,
  p_user_id uuid
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
      'logged_in_at', e.logged_in_at,
      'login_type', e.login_type,
      'ip_address', e.ip_address,
      'country_code', e.country_code,
      'device_type', e.device_type,
      'device_model', e.device_model,
      'os_name', e.os_name,
      'browser_name', e.browser_name,
      'language', e.language,
      'user_agent', e.user_agent
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
        l.logged_in_at,
        coalesce(l.login_type, 'login') as login_type,
        l.ip_address,
        l.country_code,
        l.device_type,
        l.device_model,
        l.os_name,
        l.browser_name,
        l.language,
        l.user_agent
      from cw_auth_private.login_logs l
      join public.cw_users u on u.id = l.user_id
      where u.role = 'student'
        and (p_user_id is null or l.user_id = p_user_id)
      order by l.logged_in_at desc, l.id desc
      limit v_limit
    ) e
  ), '[]'::jsonb);
end;
$fn$;

create or replace function public.cw_admin_login_history(
  p_token uuid,
  p_limit integer default 100
)
returns jsonb
language sql
security definer set search_path = pg_catalog, pg_temp
as $fn$
  select public.cw_admin_login_history(p_token, p_limit, null::uuid);
$fn$;

-- 6. cw_admin_insights_and_security: empty multi_device_alerts + effective severity (<=5 login fails = info).
create or replace function public.cw_admin_insights_and_security(
  p_token uuid,
  p_days integer default 14
)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_caller public.cw_users;
  v_ack_at timestamptz := null;
  v_days integer := greatest(1, least(coalesce(p_days, 14), 30));
  v_since timestamptz := now() - make_interval(days => v_days);
begin
  select * into v_caller from public.cw_users
    where session_token = p_token and session_expires_at > now() and role = 'admin'
    for share;
  if not found then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  select r.ack_at into v_ack_at
  from cw_auth_private.admin_security_reads r
  where r.admin_id = v_caller.id;

  return jsonb_build_object(
    'window_days', v_days,
    'security_ack_at', v_ack_at,
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
    'multi_device_alerts', '[]'::jsonb,
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
              when bucket like 'admin-tools:%' or bucket like 'admin-sec-ack:%' then 60
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
        'alerts_24h', count(*) filter (where eff_sev in ('high', 'critical') and created_at >= now() - interval '24 hours')::integer,
        'unacked_alerts_24h', count(*) filter (where eff_sev in ('high', 'critical') and created_at >= now() - interval '24 hours' and (v_ack_at is null or created_at > v_ack_at))::integer,
        'unacked_high_or_critical', count(*) filter (where eff_sev in ('high', 'critical') and (v_ack_at is null or created_at > v_ack_at))::integer,
        'critical_count', count(*) filter (where eff_sev = 'critical')::integer,
        'high_count', count(*) filter (where eff_sev = 'high')::integer,
        'warn_count', count(*) filter (where eff_sev = 'warn')::integer,
        'info_count', count(*) filter (where eff_sev = 'info')::integer,
        'login_failures', count(*) filter (where event_type = 'login_failed')::integer,
        'rate_limit_blocks', count(*) filter (where event_type = 'rate_limit_blocked')::integer,
        'tamper_or_origin', count(*) filter (where event_type in ('envelope_tampered', 'origin_denied', 'replay_attack', 'method_abuse'))::integer,
        'unauthorized_admin', count(*) filter (where event_type in ('unauthorized_admin_access', 'admin_route_probe', 'admin_password_failed'))::integer,
        'suspicious_inputs', count(*) filter (where event_type = 'suspicious_input')::integer,
        'unique_sources', count(distinct nullif(client_fp, ''))::integer,
        'targeted_accounts_count', count(distinct nullif(lower(target_account), '')) filter (where target_account <> '' and target_account <> '미인증 요청')::integer
      )
      from (
        select
          e.event_type,
          e.target_account,
          e.client_fp,
          e.created_at,
          cw_auth_private.effective_security_severity(e.event_type, e.severity, e.details) as eff_sev
        from cw_auth_private.security_events e
        where e.created_at >= v_since
      ) s
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
          e.id,
          cw_auth_private.effective_security_severity(e.event_type, e.severity, e.details) as severity,
          e.event_type, e.target_account, e.target_user_id,
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
          count(*) filter (where cw_auth_private.effective_security_severity(e.event_type, e.severity, e.details) in ('high', 'critical'))::integer as high_or_critical,
          count(distinct nullif(e.client_fp, ''))::integer as unique_sources,
          array_agg(distinct e.event_type) as event_types,
          max(e.created_at) as last_seen_at
        from cw_auth_private.security_events e
        where e.created_at >= v_since
          and e.target_account <> ''
          and e.target_account <> '미인증 요청'
        group by lower(e.target_account)
        order by count(*) filter (where cw_auth_private.effective_security_severity(e.event_type, e.severity, e.details) in ('high', 'critical')) desc, count(*) desc, max(e.created_at) desc
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
          e.event_type,
          count(*)::integer as cnt,
          count(*) filter (where cw_auth_private.effective_security_severity(e.event_type, e.severity, e.details) in ('high', 'critical'))::integer as high_or_critical,
          max(e.created_at) as last_seen_at
        from cw_auth_private.security_events e
        where e.created_at >= v_since
        group by e.event_type
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
          e.client_fp,
          count(*)::integer as total_events,
          count(*) filter (where cw_auth_private.effective_security_severity(e.event_type, e.severity, e.details) in ('high', 'critical'))::integer as high_or_critical,
          count(distinct nullif(lower(e.target_account), '')) filter (where e.target_account <> '' and e.target_account <> '미인증 요청')::integer as distinct_accounts,
          array_agg(distinct e.event_type) as event_types,
          max(e.created_at) as last_seen_at
        from cw_auth_private.security_events e
        where e.created_at >= v_since
          and e.client_fp <> ''
        group by e.client_fp
        order by count(*) filter (where cw_auth_private.effective_security_severity(e.event_type, e.severity, e.details) in ('high', 'critical')) desc, count(*) desc, max(e.created_at) desc
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

-- 7. cw_auth_private.request: keep 1..5 login failures within 15m as 'info'; enrich signup login_log metadata.
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
    if not v_login
       and v_result->>'role' = 'student'
       and v_result->>'id' is not null
       and v_result->>'session_token' is not null then
      perform cw_auth_private.insert_login_log((v_result->>'id')::uuid, clock_timestamp(), 'signup', null);
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
      -- Up to 5 failures within 15m stay 'info' (normal typo); 6th+ failure escalates to risk alert.
      perform cw_auth_private.record_security_event(
        case
          when v_recent_fails >= 5 and v_match.role = 'admin' then 'critical'
          when v_recent_fails >= 5 then 'high'
          else 'info'
        end,
        'login_failed', left(v_id, 80), v_match.id, v_fp, 'login', 'CW_INVALID_CREDENTIALS',
        case
          when v_recent_fails >= 5 and v_match.role = 'admin' then '관리자 계정(@' || left(v_id, 40) || ') 반복 로그인 실패 (' || (v_recent_fails + 1)::text || '회)'
          when v_recent_fails >= 5 and v_match.id is not null then '반복 로그인 실패 (' || (v_recent_fails + 1)::text || '회) — 등록 계정(' || v_match.full_name || ' · @' || left(v_id, 40) || ')'
          when v_recent_fails >= 5 then '반복 로그인 실패 (' || (v_recent_fails + 1)::text || '회) — 미등록 아이디(@' || left(v_id, 40) || ')'
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

-- 8. cw_secure_auth 6-arg main + 5-arg & 4-arg unambiguous wrappers (all service_role-only).
create or replace function public.cw_secure_auth(
  p_operation text, p_args jsonb, p_request_id uuid, p_expires_at timestamptz, p_client text, p_meta jsonb
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
     or (p_client is not null and p_client !~ '^[0-9a-f]{64}$')
     or (p_meta is not null and (jsonb_typeof(p_meta) <> 'object' or octet_length(p_meta::text) > 2000)) then
    perform cw_auth_private.record_security_event(
      'high', 'envelope_tampered', '', null, v_fp, 'secure-auth', 'CW_ENVELOPE_INVALID',
      '보안 인증 게이트웨이 봉투 형식/만료 검증 실패',
      jsonb_build_object('operation', left(coalesce(p_operation, 'unknown'), 40))
    );
    return cw_auth_private.error_response(400, 'CW_ENVELOPE_INVALID', '보안 요청을 확인해 주세요.');
  end if;

  if p_operation in ('cw_login', 'cw_signup_with_roster') and p_meta is not null then
    perform set_config('codewiki.login_meta', cw_auth_private.sanitize_login_meta(p_meta)::text, true);
  else
    perform set_config('codewiki.login_meta', '{}', true);
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
  p_operation text, p_args jsonb, p_request_id uuid, p_expires_at timestamptz, p_client text
)
returns jsonb
language sql
security definer set search_path = pg_catalog, pg_temp
as $fn$
  select public.cw_secure_auth(p_operation, p_args, p_request_id, p_expires_at, p_client, null::jsonb);
$fn$;

create or replace function public.cw_secure_auth(
  p_operation text, p_args jsonb, p_request_id uuid, p_expires_at timestamptz
)
returns jsonb
language sql
security definer set search_path = pg_catalog, pg_temp
as $fn$
  select public.cw_secure_auth(p_operation, p_args, p_request_id, p_expires_at, null::text, null::jsonb);
$fn$;

-- 9. Strict least-privilege grants.
revoke all on all functions in schema cw_auth_private from public, anon, authenticated;

revoke all on function
  public.cw_secure_auth(text, jsonb, uuid, timestamptz, text, jsonb),
  public.cw_secure_auth(text, jsonb, uuid, timestamptz, text),
  public.cw_secure_auth(text, jsonb, uuid, timestamptz)
from public, anon, authenticated;

grant execute on function
  public.cw_secure_auth(text, jsonb, uuid, timestamptz, text, jsonb),
  public.cw_secure_auth(text, jsonb, uuid, timestamptz, text),
  public.cw_secure_auth(text, jsonb, uuid, timestamptz)
to service_role;

revoke all on function
  public.cw_me(uuid),
  public.cw_admin_ack_security_alerts(uuid),
  public.cw_client_sync(uuid, text, text, text, text),
  public.cw_admin_login_history(uuid, integer),
  public.cw_admin_login_history(uuid, integer, uuid),
  public.cw_admin_insights_and_security(uuid, integer)
from public;

grant execute on function
  public.cw_me(uuid),
  public.cw_admin_ack_security_alerts(uuid),
  public.cw_client_sync(uuid, text, text, text, text),
  public.cw_admin_login_history(uuid, integer),
  public.cw_admin_login_history(uuid, integer, uuid),
  public.cw_admin_insights_and_security(uuid, integer)
to anon, authenticated;

notify pgrst, 'reload schema';
commit;
