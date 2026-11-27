-- Disposable test database ONLY. Verifies Admin Command Center tables, RLS, RPCs,
-- realtime controls, notice read receipts, 1:1 DMs, single-student logout, anonymous telemetry,
-- multi-device detection, roster coverage, study privacy, and admin audit logs.
begin;
reset role;

do $fixtures$
declare
  v_admin_tok uuid := gen_random_uuid();
  v_stu1_tok uuid := gen_random_uuid();
  v_stu2_tok uuid := gen_random_uuid();
  v_admin_id uuid;
  v_stu1_id uuid;
  v_stu2_id uuid;
begin
  insert into public.cw_class_roster (class_name, student_number, full_name)
  values
    ('6반', 1, '출석일'),
    ('6반', 2, '출석이'),
    ('6반', 3, '미가입학생')
  on conflict (class_name, student_number) do update set full_name = excluded.full_name;

  insert into public.cw_users (username, password_hash, full_name, class_name, student_number, role, status, session_token, session_expires_at)
  values
    ('cmd_admin', extensions.crypt('Admin-Cmd-42!', extensions.gen_salt('bf', 10)), '총괄관리자', '운영팀', null, 'admin', 'approved', v_admin_tok, now() + interval '12 hours'),
    ('cmd_stu1', extensions.crypt('Stu-Cmd-42!', extensions.gen_salt('bf', 10)), '출석일', '6반', 1, 'student', 'approved', v_stu1_tok, now() + interval '24 hours'),
    ('cmd_stu2', extensions.crypt('Stu-Cmd-42!', extensions.gen_salt('bf', 10)), '출석이', '6반', 2, 'student', 'approved', v_stu2_tok, now() + interval '24 hours');

  select id into v_admin_id from public.cw_users where session_token = v_admin_tok;
  select id into v_stu1_id from public.cw_users where session_token = v_stu1_tok;
  select id into v_stu2_id from public.cw_users where session_token = v_stu2_tok;

  insert into public.cw_learning_progress (user_id, doc_id, completed)
  values (v_stu1_id, 'basic-session-review', true), (v_stu1_id, 'abap-basics', true);

  insert into public.cw_study_notes (id, owner_id, title, body)
  values (gen_random_uuid(), v_stu1_id, '비밀 필기 제목', '절대 관리자에게 노출되면 안 되는 내용');

  insert into cw_auth_private.login_logs (user_id, logged_in_at)
  values (v_stu1_id, now() - interval '1 hour'), (v_stu2_id, now() - interval '10 days');

  perform set_config('test.cmd_admin', v_admin_tok::text, true);
  perform set_config('test.cmd_stu1', v_stu1_tok::text, true);
  perform set_config('test.cmd_stu2', v_stu2_tok::text, true);
  perform set_config('test.cmd_stu1_id', v_stu1_id::text, true);
  perform set_config('test.cmd_stu2_id', v_stu2_id::text, true);

  -- Private tables must deny direct anon/authenticated access.
  assert not has_table_privilege('anon', 'cw_auth_private.site_settings', 'SELECT');
  assert not has_table_privilege('anon', 'cw_auth_private.live_notices', 'SELECT');
  assert not has_table_privilege('anon', 'cw_auth_private.live_notice_reads', 'SELECT');
  assert not has_table_privilege('anon', 'cw_auth_private.direct_messages', 'SELECT');
  assert not has_table_privilege('anon', 'cw_auth_private.analytics_events', 'SELECT');
  assert not has_table_privilege('anon', 'cw_auth_private.session_activity', 'SELECT');
  assert not has_table_privilege('anon', 'cw_auth_private.admin_audit_logs', 'SELECT');
  assert not has_table_privilege('anon', 'cw_auth_private.student_tool_grants', 'SELECT');
  assert not has_table_privilege('anon', 'cw_auth_private.security_events', 'SELECT');
  assert not has_function_privilege('anon', 'public.cw_admin_reset_student_password(uuid,uuid,text,text)', 'EXECUTE');
  assert not has_function_privilege('anon', 'public.cw_log_edge_security_event(text,text,text,jsonb)', 'EXECUTE');
end;
$fixtures$;

set local role anon;

do $test$
declare
  a uuid := current_setting('test.cmd_admin')::uuid;
  s1 uuid := current_setting('test.cmd_stu1')::uuid;
  s2 uuid := current_setting('test.cmd_stu2')::uuid;
  id1 uuid := current_setting('test.cmd_stu1_id')::uuid;
  id2 uuid := current_setting('test.cmd_stu2_id')::uuid;
  r jsonb;
  v_notice_id uuid;
  v_dm_id uuid;
  v_denied boolean;
  v_code text;
  v_detail text;
begin
  -- 1. Student cannot call any admin command center RPC.
  v_denied := false;
  begin perform public.cw_admin_learning_overview(s1); exception when insufficient_privilege then v_denied := true; end;
  assert v_denied, 'student called cw_admin_learning_overview';

  v_denied := false;
  begin perform public.cw_admin_controls_state(s1); exception when insufficient_privilege then v_denied := true; end;
  assert v_denied, 'student called cw_admin_controls_state';

  v_denied := false;
  begin perform public.cw_admin_insights_and_security(s1, 14); exception when insufficient_privilege then v_denied := true; end;
  assert v_denied, 'student called cw_admin_insights_and_security';

  v_denied := false;
  begin perform public.cw_admin_live_presence(s1); exception when insufficient_privilege then v_denied := true; end;
  assert v_denied, 'student called cw_admin_live_presence';

  r := public.cw_admin_logout_student(s1, id2);
  assert r->>'code' = 'CW_ADMIN_REQUIRED', 'student called cw_admin_logout_student';

  r := public.cw_admin_publish_notice(s1, '해킹', '내용', '공지', '', null);
  assert r->>'code' = 'CW_ADMIN_REQUIRED', 'student called cw_admin_publish_notice';

  r := public.cw_admin_update_setting(s1, 'maintenance', jsonb_build_object('enabled', true));
  assert r->>'code' = 'CW_ADMIN_REQUIRED', 'student called cw_admin_update_setting';

  r := public.cw_admin_set_student_tools(s1, id1, jsonb_build_object('foundation', true));
  assert r->>'code' = 'CW_ADMIN_REQUIRED', 'student called cw_admin_set_student_tools';

  -- 1b. Per-student dedicated tool permissions (admin grants/revokes, cw_me & cw_client_sync & directory reflect live).
  r := public.cw_me(s1);
  assert (r->'tools'->>'mentoring')::boolean = false and (r->'tools'->>'foundation')::boolean = false;

  r := public.cw_admin_set_student_tools(a, id1, jsonb_build_object('mentoring', true, 'foundation', true, 'injected', 'bad'));
  assert (r->>'ok')::boolean = true;
  assert (r->'tools'->>'mentoring')::boolean = true and (r->'tools'->>'foundation')::boolean = true;
  assert not ((r->'tools') ? 'injected'), 'unknown tool keys must be stripped';

  r := public.cw_me(s1);
  assert (r->'tools'->>'mentoring')::boolean = true and (r->'tools'->>'foundation')::boolean = true;

  r := public.cw_client_sync(s1, 'abap-basics', 'ABAP', 'desktop', 'client-alpha-1111');
  assert (r->'student_tools'->>'mentoring')::boolean = true and (r->'student_tools'->>'foundation')::boolean = true;

  r := public.cw_admin_student_directory(a);
  assert exists (
    select 1 from jsonb_array_elements(r) e
    where (e->>'id')::uuid = id1
      and (e->'tools'->>'mentoring')::boolean = true
      and (e->'tools'->>'foundation')::boolean = true
  ), 'directory must include per-student tool grants';

  -- Partial update preserves omitted key, non-boolean ignored safely without crashing.
  r := public.cw_admin_set_student_tools(a, id1, jsonb_build_object('foundation', false, 'mentoring', 'not-bool'));
  assert (r->>'ok')::boolean = true;
  assert (r->'tools'->>'mentoring')::boolean = true and (r->'tools'->>'foundation')::boolean = false;

  -- 2. Admin publishes live notice, spotlight, maintenance & feature flags.
  r := public.cw_admin_publish_notice(a, '시험 직전 안내', 'Basic Session Review 꼭 보세요.', '긴급 공지', '화이팅!', '6반');
  assert (r->>'ok')::boolean = true;
  v_notice_id := (r->'notice'->>'id')::uuid;

  r := public.cw_admin_update_setting(a, 'spotlight', jsonb_build_object(
    'active', true, 'doc_id', 'basic-session-review', 'section_id', 'sec-1',
    'label', 'Basic Session Review', 'message', '지금 이 문서 집중!'
  ));
  assert (r->>'ok')::boolean = true and (r->'value'->>'active')::boolean = true;

  r := public.cw_admin_update_setting(a, 'feature_flags', jsonb_build_object(
    'basicSession', true, 'sqlGuide', true, 'dataGame', false,
    'study', true, 'mentoring', true, 'knowledgeMap', true, 'practice', true
  ));
  assert (r->'value'->>'dataGame')::boolean = false;

  -- 3. Admin sends 1:1 DM to student 1 only.
  r := public.cw_admin_send_direct_message(a, id1, '출석 확인', '오늘 발표 수고했어요!');
  assert (r->>'ok')::boolean = true;
  v_dm_id := (r->'message'->>'id')::uuid;

  -- 4. Student 1 syncs from two different browsers (triggers multi-device alert) & receives notice + DM + spotlight + flags.
  r := public.cw_client_sync(s1, 'basic-session-review', 'Basic Session Review', 'desktop', 'client-alpha-1111');
  assert (r->'active_notice'->>'id')::uuid = v_notice_id;
  assert jsonb_array_length(r->'direct_messages') = 1;
  assert (r->'spotlight'->>'doc_id') = 'basic-session-review';
  assert (r->'feature_flags'->>'dataGame')::boolean = false;

  r := public.cw_client_sync(s1, 'abap-sql-guide', 'ABAP SQL', 'mobile', 'client-beta-2222');
  assert (r->'active_notice'->>'id')::uuid = v_notice_id;

  -- Student 2 syncs: sees notice, does NOT see student 1's private 1:1 DM.
  r := public.cw_client_sync(s2, 'basic-session-review', 'Basic Session Review', 'desktop', 'client-stu2-3333');
  assert (r->'active_notice'->>'id')::uuid = v_notice_id;
  assert jsonb_array_length(r->'direct_messages') = 0, 'other student saw private 1:1 DM';

  -- Student 1 acknowledges notice & DM; verify read receipts.
  perform public.cw_ack_notice(s1, v_notice_id);
  perform public.cw_ack_direct_message(s1, v_dm_id);
  r := public.cw_client_sync(s1, 'abap-sql-guide', 'ABAP SQL', 'mobile', 'client-beta-2222');
  assert r->>'active_notice' is null, 'acked notice reappeared';
  assert jsonb_array_length(r->'direct_messages') = 0, 'acked DM reappeared';

  r := public.cw_admin_notice_reads(a, v_notice_id);
  assert jsonb_array_length(r->'read_users') = 1;
  assert jsonb_array_length(r->'unread_users') >= 1;

  -- 5. Live presence shows doc breakdown & device types.
  r := public.cw_admin_live_presence(a);
  assert jsonb_array_length(r->'online') >= 2;
  assert jsonb_array_length(r->'by_doc') >= 1;

  -- 6. Anonymous telemetry ingestion & insights aggregation.
  perform public.cw_track_event(s1, 'doc_view', 'basic-session-review', '{}'::jsonb, 'desktop');
  perform public.cw_track_event(s1, 'doc_stay', 'basic-session-review', jsonb_build_object('duration_sec', 95), 'desktop');
  perform public.cw_track_event(s1, 'search', 'se91', '{}'::jsonb, 'desktop');
  perform public.cw_track_event(s1, 'search_empty', '없는키워드xyz', '{}'::jsonb, 'mobile');
  perform public.cw_track_event(s1, 'code_copy', 'basic-session-review', '{}'::jsonb, 'desktop');
  perform public.cw_track_event(s1, 'quiz_answer', 'obj-q1', jsonb_build_object('source', 'data-game', 'label', 'lv_carrid', 'correct', false), 'desktop');
  perform public.cw_track_event(s1, 'client_error', '#doc/basic-session-review', jsonb_build_object('message', 'TypeError: demo', 'source', 'window.error'), 'mobile');

  -- Malformed telemetry payloads are rejected cleanly and never crash insights RPC.
  r := public.cw_track_event(s1, 'quiz_answer', 'bad-q', jsonb_build_object('correct', 'not-a-bool'), 'desktop');
  assert (r->>'ok')::boolean = false, 'malformed quiz_answer boolean must be rejected';
  r := public.cw_track_event(s1, 'doc_stay', 'bad-doc', jsonb_build_object('duration_sec', 'abc'), 'desktop');
  assert (r->>'ok')::boolean = false, 'malformed doc_stay duration must be rejected';
  -- Non-boolean setting values never throw 22P02.
  r := public.cw_admin_update_setting(a, 'maintenance', jsonb_build_object('enabled', 'invalid-bool', 'message', '안전 테스트'));
  assert (r->>'ok')::boolean = true and (r->'value'->>'enabled')::boolean = false;

  r := public.cw_admin_insights_and_security(a, 14);
  assert exists (select 1 from jsonb_array_elements(r->'top_docs') e where e->>'doc_id' = 'basic-session-review' and (e->>'avg_stay_sec')::int = 95);
  assert exists (select 1 from jsonb_array_elements(r->'top_searches') e where e->>'query' = 'se91');
  assert exists (select 1 from jsonb_array_elements(r->'failed_searches') e where e->>'query' = '없는키워드xyz');
  assert exists (select 1 from jsonb_array_elements(r->'top_copies') e where e->>'doc_id' = 'basic-session-review');
  assert exists (select 1 from jsonb_array_elements(r->'hardest_quizzes') e where e->>'target_key' = 'obj-q1' and (e->>'wrong_rate')::numeric = 100);
  assert exists (select 1 from jsonb_array_elements(r->'client_errors') e where e->>'message' = 'TypeError: demo');
  assert exists (select 1 from jsonb_array_elements(r->'multi_device_alerts') e where (e->>'user_id')::uuid = id1 and (e->>'switches_24h')::int >= 1);
  assert exists (select 1 from jsonb_array_elements(r->'audit_logs') e where e->>'action' = 'update_student_tools');
  assert jsonb_array_length(r->'audit_logs') >= 4, 'audit logs missing admin actions';

  -- 7. Learning overview: roster unregistered check, unit progress, study stats privacy (zero private note text!).
  r := public.cw_admin_learning_overview(a);
  assert exists (select 1 from jsonb_array_elements(r->'unregistered_roster') e where e->>'full_name' = '미가입학생');
  assert exists (select 1 from jsonb_array_elements(r->'unit_progress') e where e->>'doc_id' = 'basic-session-review' and (e->>'completed_count')::int >= 1);
  assert (r->'study_stats'->>'total_notes')::int >= 1;
  assert r::text not like '%비밀 필기 제목%' and r::text not like '%노출되면 안 되는%', 'private study note text leaked into overview';

  -- 8. Single-student forced logout revokes ONLY student 1 and keeps student 2 active.
  r := public.cw_admin_logout_student(a, id1);
  assert (r->>'ok')::boolean = true and (r->>'was_active')::boolean = true;

  r := public.cw_me(s1);
  assert (r->>'forced_logout')::boolean = true and r->>'reason' = 'admin_logout_single';

  v_code := null; v_detail := null;
  begin
    perform public.cw_client_sync(s1, 'abap-basics', 'ABAP', 'desktop', 'client-alpha-1111');
    raise exception 'revoked student sync succeeded';
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate, v_detail = pg_exception_detail;
  end;
  assert v_code = '42501' and v_detail = 'CW_ADMIN_LOGOUT', 'expected 42501/CW_ADMIN_LOGOUT, got ' || coalesce(v_code,'') || '/' || coalesce(v_detail,'');

  -- Student 2 remains active!
  r := public.cw_me(s2);
  assert r->>'username' = 'cmd_stu2', 'other student must stay logged in after single logout';

  -- 9. Toggle & delete notice works.
  r := public.cw_admin_update_notice(a, v_notice_id, false, false);
  assert (r->>'ok')::boolean = true and (r->>'active')::boolean = false;
  r := public.cw_admin_update_notice(a, v_notice_id, null, true);
  assert (r->>'ok')::boolean = true and (r->>'deleted')::boolean = true;

  -- 10. Student suspicious search & admin route probes record into security_events,
  --     while legitimate ABAP SQL searches (UNION SELECT, WHERE carrid = 'LH' AND carrid = 'AA') do NOT false-positive,
  --     and oversized JSON integers return {ok:false} instead of throwing 22003.
  r := public.cw_track_event(s2, 'security_probe', '#admin/security', jsonb_build_object('kind', 'admin_route_probe'), 'desktop');
  assert (r->>'ok')::boolean = true;
  r := public.cw_track_event(s2, 'search_empty', '<script>alert(1)</script>', jsonb_build_object('results', 0), 'mobile');
  assert (r->>'ok')::boolean = true;
  r := public.cw_track_event(s2, 'search', 'UNION SELECT', jsonb_build_object('results', 3), 'desktop');
  assert (r->>'ok')::boolean = true;
  r := public.cw_track_event(s2, 'search_empty', 'WHERE carrid = ''LH'' AND carrid = ''AA''', jsonb_build_object('results', 0), 'desktop');
  assert (r->>'ok')::boolean = true;
  r := public.cw_track_event(s2, 'doc_stay', 'abap-basics', jsonb_build_object('duration_sec', 99999999999999999999), 'desktop');
  assert (r->>'ok')::boolean = false, 'oversized duration_sec must return ok:false without 22003 overflow';
end;
$test$;

-- 11. Service-role secure-auth & edge security event logging (zero raw password/IP stored).
set local role service_role;
do $sec_events$
declare
  r jsonb;
  v_fp text := repeat('a', 64);
  v_req uuid := gen_random_uuid();
begin
  -- Failed login against existing admin account & SQLi probe & replay attack.
  r := public.cw_secure_auth('cw_login', jsonb_build_object('p_username', 'cmd_admin', 'p_password', 'Wrong-Secret-Pass-99!'), v_req, clock_timestamp() + interval '60 seconds', v_fp);
  assert r->>'code' = 'CW_INVALID_CREDENTIALS';
  -- Replay same request_id triggers CW_REPLAY log.
  r := public.cw_secure_auth('cw_login', jsonb_build_object('p_username', 'cmd_admin', 'p_password', 'Wrong-Secret-Pass-99!'), v_req, clock_timestamp() + interval '60 seconds', v_fp);
  assert r->>'code' = 'CW_REPLAY';
  -- SQLi username attempt triggers critical suspicious_input event.
  r := public.cw_secure_auth('cw_login', jsonb_build_object('p_username', ''' OR ''1''=''1', 'p_password', 'Another-Secret-77!'), gen_random_uuid(), clock_timestamp() + interval '60 seconds', v_fp);
  assert r->>'code' = 'CW_INVALID_CREDENTIALS';
  -- Edge Function security event log (Origin denied & tampered JWE).
  r := public.cw_log_edge_security_event('origin_denied', 'CW_ORIGIN_DENIED', v_fp, jsonb_build_object('origin', 'https://evil.example', 'method', 'POST'));
  assert (r->>'ok')::boolean = true;
  r := public.cw_log_edge_security_event('envelope_tampered', 'CW_ENVELOPE_INVALID', v_fp, jsonb_build_object('reason', 'decrypt_failed', 'method', 'POST'));
  assert (r->>'ok')::boolean = true;
end;
$sec_events$;

set local role anon;
do $verify_sec_center$
declare
  a uuid := current_setting('test.cmd_admin')::uuid;
  me jsonb;
  sec jsonb;
begin
  me := public.cw_me(a);
  assert (me->>'security_alert_count')::int >= 4, 'cw_me must report 24h security alerts for admin sidebar badge';

  sec := public.cw_admin_insights_and_security(a, 14);
  assert (sec->'security_summary'->>'login_failures')::int >= 2, 'login_failures aggregated';
  assert (sec->'security_summary'->>'tamper_or_origin')::int >= 3, 'replay/origin/tamper aggregated';
  assert (sec->'security_summary'->>'unauthorized_admin')::int >= 4, 'unauthorized admin RPC & route probe aggregated';
  assert (sec->'security_summary'->>'suspicious_inputs')::int = 2, 'only real SQLi/XSS probes flagged (ABAP SQL searches must not false-positive)';
  assert exists (select 1 from jsonb_array_elements(sec->'security_events') e where e->>'event_type' = 'unauthorized_admin_access' and e->>'target_account' = 'cmd_stu1');
  assert exists (select 1 from jsonb_array_elements(sec->'security_events') e where e->>'event_type' = 'origin_denied' and e->'details'->>'origin' = 'https://evil.example');
  assert exists (select 1 from jsonb_array_elements(sec->'security_events') e where e->>'event_type' = 'replay_attack');
  assert exists (select 1 from jsonb_array_elements(sec->'security_events') e where e->>'event_type' = 'admin_route_probe' and e->>'target_account' = 'cmd_stu2');
  assert exists (select 1 from jsonb_array_elements(sec->'targeted_accounts') e where e->>'target_account' = 'cmd_admin' and e->>'role' = 'admin');
  assert exists (select 1 from jsonb_array_elements(sec->'top_sources') e where e->>'client_fp' = repeat('a', 12));
  assert not exists (select 1 from jsonb_array_elements(sec->'rate_limits') e where e->>'category' = '기타 보안 버킷' and (e->>'attempts')::int > 0 and sec::text like '%sec-log:%'), 'internal sec-log buckets excluded';
  assert sec::text not like '%Wrong-Secret-Pass-99!%' and sec::text not like '%Another-Secret-77!%', 'raw passwords must never be stored in security_events';
end;
$verify_sec_center$;

reset role;
rollback;
