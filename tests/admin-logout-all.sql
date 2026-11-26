-- Disposable test database ONLY. Verifies cw_admin_logout_all, forced_logout detection and access controls.
begin;

do $$
declare
  v_admin_token uuid := gen_random_uuid();
  v_stu1_token uuid := gen_random_uuid();
  v_stu2_token uuid := gen_random_uuid();
  v_expired_token uuid := gen_random_uuid();
  v_admin_id uuid;
  v_stu1_id uuid;
  v_stu2_id uuid;
  v_exp_id uuid;
  v_res jsonb;
  v_detail text;
  v_code text;
  v_denied boolean := false;
begin
  insert into public.cw_users (username, password_hash, full_name, class_name, role, status, session_token, session_expires_at)
  values ('adm_logout_all', extensions.crypt('Admin-Pass-123!', extensions.gen_salt('bf', 10)), '관리자테스트', '운영팀', 'admin', 'approved', v_admin_token, now() + interval '12 hours')
  returning id into v_admin_id;

  insert into public.cw_users (username, password_hash, full_name, class_name, role, status, session_token, session_expires_at)
  values ('stu_logout_1', extensions.crypt('Stu-Pass-123!', extensions.gen_salt('bf', 10)), '학생일', '1반', 'student', 'approved', v_stu1_token, now() + interval '24 hours')
  returning id into v_stu1_id;

  insert into public.cw_users (username, password_hash, full_name, class_name, role, status, session_token, session_expires_at)
  values ('stu_logout_2', extensions.crypt('Stu-Pass-123!', extensions.gen_salt('bf', 10)), '학생이', '1반', 'student', 'pending', v_stu2_token, now() + interval '24 hours')
  returning id into v_stu2_id;

  insert into public.cw_users (username, password_hash, full_name, class_name, role, status, session_token, session_expires_at)
  values ('stu_logout_exp', extensions.crypt('Stu-Pass-123!', extensions.gen_salt('bf', 10)), '학생만료', '1반', 'student', 'approved', v_expired_token, now() - interval '1 hour')
  returning id into v_exp_id;

  -- Seed presence for admin and active student.
  set local role anon;
  perform public.cw_presence_heartbeat(v_admin_token, true);
  perform public.cw_presence_heartbeat(v_stu1_token, false);

  -- Direct access to private forced_logouts table must be denied.
  begin
    perform 1 from cw_auth_private.forced_logouts;
    raise exception 'expected permission denial on forced_logouts';
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then raise exception 'forced_logouts must not be readable by anon'; end if;

  -- Student cannot call cw_admin_logout_all.
  v_denied := false;
  begin
    perform public.cw_admin_logout_all(v_stu1_token);
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then raise exception 'student must not execute cw_admin_logout_all'; end if;

  -- Unknown token cannot call cw_admin_logout_all.
  v_denied := false;
  begin
    perform public.cw_admin_logout_all(gen_random_uuid());
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then raise exception 'unknown token must not execute cw_admin_logout_all'; end if;

  -- Admin logs out all active non-admin sessions.
  v_res := public.cw_admin_logout_all(v_admin_token);
  if coalesce((v_res->>'ok')::boolean, false) is not true then
    raise exception 'expected ok=true, got %', v_res;
  end if;
  if (v_res->>'logged_out_count')::integer < 2 then
    raise exception 'expected at least 2 active student sessions logged out, got %', v_res;
  end if;

  -- Admin session remains valid and online presence excludes students.
  v_res := public.cw_me(v_admin_token);
  if v_res->>'role' <> 'admin' then
    raise exception 'admin session must remain active after logout_all, got %', v_res;
  end if;

  v_res := public.cw_presence_heartbeat(v_admin_token, true);
  if exists (select 1 from jsonb_array_elements(v_res) e where e->>'role' <> 'admin') then
    raise exception 'presence must clear student rows after logout_all, got %', v_res;
  end if;

  -- Revoked active student tokens report forced_logout via cw_me and CW_ADMIN_LOGOUT via heartbeat.
  v_res := public.cw_me(v_stu1_token);
  if coalesce((v_res->>'forced_logout')::boolean, false) is not true or v_res->>'reason' <> 'admin_logout_all' then
    raise exception 'expected forced_logout marker for stu1, got %', v_res;
  end if;

  v_res := public.cw_me(v_stu2_token);
  if coalesce((v_res->>'forced_logout')::boolean, false) is not true then
    raise exception 'expected forced_logout marker for pending stu2, got %', v_res;
  end if;

  -- Already-expired and random unknown tokens still return null (not forced_logout).
  if public.cw_me(v_expired_token) is not null then
    raise exception 'already-expired token must not show forced_logout';
  end if;
  if public.cw_me(gen_random_uuid()) is not null then
    raise exception 'random token must return null';
  end if;

  -- Heartbeat with revoked student token raises 42501 with detail CW_ADMIN_LOGOUT.
  v_code := null; v_detail := null;
  begin
    perform public.cw_presence_heartbeat(v_stu1_token, false);
    raise exception 'expected heartbeat rejection for revoked student';
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate, v_detail = pg_exception_detail;
  end;
  if v_code <> '42501' or v_detail <> 'CW_ADMIN_LOGOUT' then
    raise exception 'expected 42501/CW_ADMIN_LOGOUT, got %/%', v_code, v_detail;
  end if;

  -- Calling logout_all again when nobody is active returns logged_out_count = 0.
  v_res := public.cw_admin_logout_all(v_admin_token);
  if (v_res->>'logged_out_count')::integer <> 0 then
    raise exception 'expected 0 active sessions on immediate repeat, got %', v_res;
  end if;

  reset role;
end $$;

rollback;
