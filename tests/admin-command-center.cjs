const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

// 1. CSV formula-injection neutralization + BOM + RFC4180 quoting in admin-insights.js.
function testCsvAndInsightsUi() {
  const created = [];
  const urls = [];
  let savedBlobText = '';
  const window = {
    WIKI_DOCS: { 'basic-session-review': { id: 'basic-session-review', title: 'Basic Session Review' } },
    CodeWikiLearning: {
      escape: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    }
  };
  const ctx = {
    window,
    Blob: class { constructor(parts) { savedBlobText = parts.join(''); } },
    URL: { createObjectURL: () => { urls.push('created'); return 'blob:test'; }, revokeObjectURL: () => urls.push('revoked') },
    document: {
      createElement: () => {
        const el = { click() { created.push(this.download); }, remove() {} };
        return el;
      },
      body: { appendChild() {} }
    },
    setTimeout: fn => fn()
  };
  vm.runInNewContext(read('js/admin-insights.js'), ctx);
  assert.equal(typeof window.CodeWikiAdminInsights.downloadCsv, 'function');
  window.CodeWikiAdminInsights.downloadCsv('test.csv', ['이름', '메모'], [
    ['홍길동', '=CMD()'],
    ['김철수', '+1+1, "quoted"'],
    ['이영희', '@SUM(A1)'],
    ['박민수', '|DDE()'],
    ['최지우', ' =LEADING_SPACE()']
  ]);
  assert.deepEqual(created, ['test.csv']);
  assert.deepEqual(urls, ['created', 'revoked']);
  assert.ok(savedBlobText.startsWith('\uFEFF'), 'CSV includes UTF-8 BOM for Excel');
  assert.ok(savedBlobText.includes("'=CMD()"), 'CSV neutralizes leading = formula');
  assert.ok(savedBlobText.includes(`"'+1+1, ""quoted"""`), 'CSV quotes commas/quotes and neutralizes leading +');
  assert.ok(savedBlobText.includes("'@SUM(A1)"), 'CSV neutralizes leading @ formula');
  assert.ok(savedBlobText.includes("'|DDE()"), 'CSV neutralizes leading pipe DDE');
  assert.ok(savedBlobText.includes("' =LEADING_SPACE()"), 'CSV neutralizes whitespace-prefixed formula');
  assert.equal(window.CodeWikiAdminInsights.docTitle('basic-session-review'), 'Basic Session Review');
  assert.equal(window.CodeWikiAdminInsights.docTitle('page:study'), '내 공부방');
}

// 2. Student telemetry: runtime sync applies maintenance, feature flags, spotlight, live notice, 1:1 DM, and anonymous events.
async function testTelemetryAndLiveNotice() {
  const rpcCalls = [];
  const docEvents = {};
  const winEvents = {};
  const timers = new Map();
  let timerSeq = 0;
  let openedDocs = [];
  let forcedLogoutMsg = '';
  let liveNoticeShown = null;
  const nodes = new Map();

  function el(id) {
    if (!nodes.has(id)) {
      const classes = new Set(id.endsWith('Overlay') || id.endsWith('Modal') ? ['hidden'] : []);
      const listeners = new Map();
      nodes.set(id, {
        id,
        innerHTML: '',
        hidden: id.endsWith('Banner'),
        onclick: null,
        classList: {
          add: (...c) => c.forEach(x => classes.add(x)),
          remove: (...c) => c.forEach(x => classes.delete(x)),
          contains: c => classes.has(c)
        },
        addEventListener(type, fn) {
          if (!listeners.has(type)) listeners.set(type, []);
          listeners.get(type).push(fn);
        },
        click() {
          for (const fn of listeners.get('click') || []) fn({ target: this });
        },
        querySelector(sel) {
          if (sel === '[data-spotlight-go]') return el('spotlightGoBtn');
          if (sel === '[data-spotlight-dismiss]') return el('spotlightDismissBtn');
          return null;
        },
        focus() {}
      });
    }
    return nodes.get(id);
  }

  let broadcastCb = null;
  const subscribedTopics = [];
  const fakeChannel = {
    on(type, filter, cb) { if (type === 'broadcast' && filter?.event === 'runtime_update') broadcastCb = cb; return fakeChannel; },
    subscribe() { return fakeChannel; },
    async httpSend(event, payload) { rpcCalls.push({ name: 'broadcast:' + event, args: payload }); return { success: true }; }
  };

  let syncResponse = {
    data: {
      maintenance: { enabled: false, message: '' },
      feature_flags: { basicSession: true, sqlGuide: true, dataGame: false, study: true, mentoring: true, knowledgeMap: true, practice: true },
      spotlight: { active: true, doc_id: 'basic-session-review', section_id: 'sec-2', label: 'Basic Session Review', message: '지금 여기 보세요!', sent_at: '2026-11-27T08:00:00Z' },
      active_notice: { id: 'n-1', badge: '긴급', title: '라이브 공지', body: '첫 번째 안내\n\n두 번째 안내', cheer: '화이팅!' },
      direct_messages: [{ id: 'dm-1', title: '1:1 확인', body: '출석번호 확인해 주세요', created_at: '2026-11-27T08:00:00Z' }]
    }
  };

  const window = {
    innerWidth: 1280,
    location: { hash: '#doc/abap-basics' },
    WIKI_DOCS: { 'basic-session-review': { id: 'basic-session-review', title: 'Basic Session Review' } },
    addEventListener: (k, fn) => { winEvents[k] = fn; },
    CodeWikiApp: { openDoc: (...args) => openedDocs.push(args) },
    CodeWikiNotice: {
      showLiveNotice: (notice, onAck) => {
        liveNoticeShown = { notice, onAck };
        el('siteNoticeModal').classList.remove('hidden');
        return true;
      },
      close: () => { el('siteNoticeModal').classList.add('hidden'); }
    },
    CodeWikiAuth: {
      getSessionToken: () => 'stu-tok',
      handleForcedLogout: msg => { forcedLogoutMsg = msg; },
      getSupabaseClient: () => ({
        rpc: async (name, args) => {
          rpcCalls.push({ name, args });
          if (name === 'cw_client_sync') return syncResponse;
          return { data: { ok: true } };
        },
        channel: topic => { subscribedTopics.push(topic); return fakeChannel; },
        removeChannel() {}
      })
    }
  };

  // Pre-hide mentor button as js/mentoring.js does for regular students; feature flags must NOT unhide it!
  el('openMentoringBtn').hidden = true;

  const storage = new Map();
  const ctx = {
    window,
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0)' },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    crypto: { randomUUID: () => '12345678-1234-4234-8234-1234567890ab' },
    AbortController,
    document: {
      hidden: false,
      body: el('body'),
      getElementById: el,
      querySelectorAll: () => [],
      addEventListener: (k, fn) => { docEvents[k] = fn; },
      removeEventListener() {}
    },
    setTimeout: (fn, ms) => { const id = ++timerSeq; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id)
  };

  vm.runInNewContext(read('js/telemetry.js'), ctx);
  const tel = window.CodeWikiTelemetry;

  tel.setUser({ id: 'stu-1', role: 'student', status: 'approved' });
  await flush();

  assert.equal(subscribedTopics[0], 'cw:runtime-signal', 'telemetry uses dedicated runtime channel isolated from presence');
  assert.equal(rpcCalls[0].name, 'cw_client_sync');
  assert.equal(rpcCalls[0].args.p_client_id, '12345678-1234-4234-8234-1234567890ab');
  assert.equal(tel.isFeatureEnabled('dataGame'), false, 'disabled feature flag applied');
  assert.equal(el('body').classList.contains('cw-flag-off-dataGame'), true, 'disabled flag adds restrictive body class');
  assert.equal(el('openMentoringBtn').hidden, true, 'mentor-only button stays hidden for regular student');
  assert.equal(el('liveSpotlightBanner').hidden, false, 'spotlight banner shown');
  assert.ok(el('liveSpotlightBanner').innerHTML.includes('Basic Session Review'));
  assert.equal(liveNoticeShown?.notice?.id, 'n-1', 'live notice forwarded to CodeWikiNotice');
  assert.equal(el('directMessageModal').classList.contains('hidden'), true, '1:1 DM defers until live notice closes');
  await liveNoticeShown.onAck('n-1');
  el('siteNoticeModal').classList.add('hidden');
  winEvents['cw-notice-closed']?.();
  await flush();
  assert.ok(rpcCalls.some(c => c.name === 'cw_ack_notice' && c.args.p_notice_id === 'n-1'));

  // 1:1 DM modal opens cleanly AFTER live notice closes.
  assert.equal(el('directMessageModal').classList.contains('hidden'), false, '1:1 DM modal shown after notice closes');
  el('dmConfirmBtn').click();
  await flush();
  assert.ok(rpcCalls.some(c => c.name === 'cw_ack_direct_message' && c.args.p_message_id === 'dm-1'));
  assert.equal(el('directMessageModal').classList.contains('hidden'), true);

  // Anonymous search empty + quiz answer + sanitized client error telemetry.
  tel.trackSearch('없는키워드', 0);
  const searchTimer = [...timers.values()].find(t => t.ms === 1200);
  assert.ok(searchTimer, 'search tracking debounced');
  searchTimer.fn();
  tel.trackQuizAnswer('data-game', 'q1', 'lv_test', false);
  tel.trackClientError('window.error', 'Fail 12345678-1234-4234-8234-1234567890ab');
  await flush();
  assert.ok(rpcCalls.some(c => c.name === 'cw_track_event' && c.args.p_type === 'search_empty' && c.args.p_target === '없는키워드'));
  assert.ok(rpcCalls.some(c => c.name === 'cw_track_event' && c.args.p_type === 'quiz_answer' && c.args.p_meta.correct === false));
  const errCall = rpcCalls.find(c => c.name === 'cw_track_event' && c.args.p_type === 'client_error');
  assert.ok(errCall && errCall.args.p_meta.message.includes('[redacted]') && !errCall.args.p_meta.message.includes('12345678'), 'UUIDs stripped from error logs');

  // Maintenance mode locks student screen and sets appLayout inert.
  syncResponse = { data: { maintenance: { enabled: true, message: '점검 중입니다' }, feature_flags: {}, spotlight: { active: false }, active_notice: null, direct_messages: [] } };
  await tel.syncNow(true);
  assert.equal(el('maintenanceOverlay').classList.contains('hidden'), false, 'maintenance overlay shown for student');
  assert.equal(el('appLayout').inert, true, 'background appLayout marked inert during maintenance');

  // Logout clears flag classes and unlocks inert.
  tel.setUser(null);
  assert.equal(el('body').classList.contains('cw-flag-off-dataGame'), false, 'flag classes cleared on logout');
  assert.equal(el('appLayout').inert, false, 'appLayout inert cleared on logout');

  // Re-login & Realtime runtime_update broadcast + CW_ADMIN_LOGOUT triggers forced logout.
  syncResponse = { data: { maintenance: { enabled: false, message: '' }, feature_flags: {}, spotlight: { active: false }, active_notice: null, direct_messages: [] } };
  tel.setUser({ id: 'stu-1', role: 'student', status: 'approved' });
  await flush();
  assert.equal(typeof broadcastCb, 'function', 'student subscribes to runtime_update broadcast');
  syncResponse = { error: { code: '42501', details: 'CW_ADMIN_LOGOUT' } };
  await tel.syncNow(true);
  assert.equal(forcedLogoutMsg, '관리자에 의해 로그아웃되었습니다.');

  // Admin notifyRuntimeUpdate uses httpSend on cw:runtime-signal.
  const sent = await tel.notifyRuntimeUpdate();
  assert.equal(sent, true);
  assert.ok(rpcCalls.some(c => c.name === 'broadcast:runtime_update'));
}

// 3. Static wiring checks across index.html, auth.js, app.js.
function testStaticWiring() {
  const html = read('index.html');
  assert.ok(html.includes('id="adminPreviewBanner"'), 'index.html mounts adminPreviewBanner');
  assert.ok(html.includes('id="liveSpotlightBanner"'), 'index.html mounts liveSpotlightBanner');
  assert.ok(html.includes('id="directMessageModal"'), 'index.html mounts directMessageModal');
  assert.ok(html.includes('id="maintenanceOverlay"'), 'index.html mounts maintenanceOverlay');
  assert.ok(html.includes('js/admin-insights.js'), 'index.html loads admin-insights.js');
  assert.ok(html.includes('js/telemetry.js'), 'index.html loads telemetry.js');
  assert.ok(html.indexOf('js/admin-insights.js') < html.indexOf('js/admin-members.js'), 'admin-insights.js loads before admin-members.js');
  assert.ok(html.indexOf('js/telemetry.js') < html.indexOf('js/auth.js'), 'telemetry.js loads before auth.js');

  const authJs = read('js/auth.js');
  assert.ok(authJs.includes('setAdminPreviewMode'), 'auth.js exposes admin preview toggle');
  assert.ok(authJs.includes('openAdminDashboardBtn'), 'auth.js adds 운영 관제실 sidebar link');
  assert.ok(authJs.includes('CodeWikiTelemetry?.setUser?.(user)'), 'auth.js wires telemetry lifecycle');

  const appJs = read('js/app.js');
  assert.ok(appJs.includes("!window.CodeWikiAuth?.isAdminPreviewMode?.() && window.CodeWikiAdminMembers?.openHome()"), 'admin preview mode does not bounce from welcome-abap');
  assert.ok(appJs.includes('!h.startsWith("#admin/")'), 'syncAccess preserves admin sub-tab routes on reload/refresh');
}

// 4. Unified top notification feed, multi-recipient 1:1 DM send, dashboard chart-first order, split analytics & security views.
async function testReorganizedAdminViews() {
  const tableEl = { innerHTML: '' };
  let activeTab = 'notices';
  const dmCalls = [];
  const settingCalls = [];
  let notifyCount = 0;
  let lastMessage = '';
  const confirmDialog = {
    open: false,
    innerHTML: '',
    confirmBtn: { disabled: false, events: {}, addEventListener(t, fn) { this.events[t] = fn; }, focus() {} },
    statusEl: { textContent: '' },
    showModal() { this.open = true; },
    close() { this.open = false; },
    querySelector(sel) {
      if (sel === '#confirmMaintenanceBtn') return this.confirmBtn;
      if (sel === '#maintConfirmStatus') return this.statusEl;
      return null;
    },
    querySelectorAll: () => []
  };
  const session = { id: 'adm-1', token: 'tok' };
  const sampleStudents = [
    { id: 's1', full_name: '김가', username: 'ga', class_name: '6반', status: 'approved' },
    { id: 's2', full_name: '김나', username: 'na', class_name: '6반', status: 'approved' },
    { id: 's3', full_name: '김다', username: 'da', class_name: '1반', status: 'pending' }
  ];
  const controlsPayload = {
    settings: { maintenance: { enabled: false, message: '' }, feature_flags: {}, spotlight: { active: false } },
    notices: [{ id: 'n1', title: '전체 공지 제목', body: '전체 공지 본문', target_class: null, active: true, target_count: 10, read_count: 6, created_at: '2026-11-27T09:00:00Z' }],
    direct_messages: [{ id: 'd1', full_name: '김가', username: 'ga', class_name: '6반', title: '개인 안내', body: '개별 본문', read_at: null, created_at: '2026-11-27T08:00:00Z' }]
  };
  const dashPayload = {
    summary: { total_students: 10, approved: 8, pending: 1, rejected: 1, dau_today: 5, active_7d: 7, avg_completed_docs: 4 },
    roster_classes: [{ class_name: '6반', roster_total: 10, registered_count: 8, approved_count: 8, pending_count: 0 }],
    unregistered_roster: [{ class_name: '6반', student_number: 9, full_name: '미가입' }],
    unit_progress: [
      { doc_id: 'unit-05', completed_count: 2 },
      { doc_id: 'bc430-03', completed_count: 6 }
    ],
    login_heatmap: [{ dow: 1, hour: 10, count: 4 }],
    daily_logins: [{ day: '2026-11-27', unique_students: 5, total_logins: 9 }],
    inactive_students: [],
    study_stats: { active_authors: 4, total_notes: 12, notes_updated_7d: 3 }
  };
  const insPayload = {
    top_docs: [{ doc_id: 'unit-05', views: 18, avg_stay_sec: 245 }],
    top_searches: [{ query: 'internal table', count: 9 }],
    failed_searches: [{ query: 'alv grid', count: 3 }],
    top_copies: [{ doc_id: 'unit-05', count: 7 }],
    hardest_quizzes: [{ source: 'sql-practice', target_key: 'q1', label: 'JOIN 기초', attempts: 10, wrong_count: 4, wrong_rate: 40 }],
    device_breakdown: [{ device_type: 'desktop', count: 20 }],
    security_summary: {
      total_events: 5, alerts_24h: 3, critical_count: 2, high_count: 1, warn_count: 2, info_count: 0,
      login_failures: 2, rate_limit_blocks: 1, tamper_or_origin: 1, unauthorized_admin: 1, suspicious_inputs: 1,
      unique_sources: 1, targeted_accounts_count: 2
    },
    security_events: [
      { id: 10, severity: 'critical', event_type: 'suspicious_input', target_account: "' OR 1=1--", client_fp: 'a1b2c3d4e5f6', source: 'login', reason_code: 'CW_SUSPICIOUS_INPUT', summary: '로그인 입력창에 SQLi/XSS 의심 패턴 감지', details: { field: 'username', sample: "' OR 1=1--" }, created_at: '2026-11-27T09:10:00Z' },
      { id: 9, severity: 'high', event_type: 'origin_denied', target_account: '', client_fp: 'a1b2c3d4e5f6', source: 'edge-auth', reason_code: 'CW_ORIGIN_DENIED', summary: '허용되지 않은 Origin 접근 차단', details: { origin: 'https://evil.test', method: 'POST' }, created_at: '2026-11-27T09:05:00Z' },
      { id: 8, severity: 'warn', event_type: 'login_failed', target_account: 'ga', target_user_id: 's1', user_full_name: '김가', user_class_name: '6반', user_role: 'student', client_fp: 'a1b2c3d4e5f6', source: 'login', reason_code: 'CW_INVALID_CREDENTIALS', summary: '로그인 실패 — 등록 계정(김가 · @ga)', details: { account_exists: true, recent_15m_fails: 3 }, created_at: '2026-11-27T09:01:00Z' }
    ],
    targeted_accounts: [
      { target_account: 'ga', user_id: 's1', full_name: '김가', class_name: '6반', role: 'student', status: 'approved', total_events: 3, login_failures: 2, high_or_critical: 1, unique_sources: 1, event_types: ['login_failed'], last_seen_at: '2026-11-27T09:01:00Z' }
    ],
    attack_breakdown: [
      { event_type: 'login_failed', count: 2, high_or_critical: 0, last_seen_at: '2026-11-27T09:01:00Z' },
      { event_type: 'suspicious_input', count: 1, high_or_critical: 1, last_seen_at: '2026-11-27T09:10:00Z' }
    ],
    top_sources: [
      { client_fp: 'a1b2c3d4e5f6', total_events: 5, high_or_critical: 3, distinct_accounts: 4, event_types: ['login_failed', 'suspicious_input'], last_seen_at: '2026-11-27T09:10:00Z' }
    ],
    multi_device_alerts: [{ user_id: 's1', full_name: '김가', class_name: '6반', username: 'ga', distinct_devices: 2, switches_24h: 3, device_types: ['desktop', 'mobile'] }],
    rate_limits: [{ category: '계정 로그인 시도', attempts: 10, max_attempts: 10, remaining_sec: 180, blocked: true, resets_at: '2026-11-27T10:00:00Z' }],
    client_errors: [{ created_at: '2026-11-27T09:00:00Z', target_key: 'welcome-abap', source: 'error', message: 'boom', device_type: 'desktop' }],
    audit_logs: [{ created_at: '2026-11-27T09:00:00Z', admin_name: '관리자', action: 'publish_notice', target_label: '전체', details: { target_class: '전체' } }]
  };
  let reportedSecBadgeCount = null;
  let secAckCalls = 0;

  const windowObj = {
    WIKI_DOCS: {
      'unit-05': { id: 'unit-05', title: 'BC400 Unit 5 · 복합 데이터 객체' },
      'bc430-03': { id: 'bc430-03', title: 'BC430 Unit 3 · 데이터베이스 테이블' }
    },
    CodeWikiLearning: { escape: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) },
    CodeWikiTelemetry: { notifyRuntimeUpdate: () => { notifyCount++; } }
  };
  const ctx = {
    window: windowObj,
    FormData: class {
      constructor(form) { this._m = form._fields; }
      get(k) { return this._m[k]; }
    },
    document: { createElement: () => ({ innerHTML: '', firstElementChild: null }) },
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(read('js/admin-insights.js'), ctx);

  const host = {
    querySelector: sel => sel === '#membersTable' ? tableEl : null,
    querySelectorAll: () => []
  };
  const ctrl = windowObj.CodeWikiAdminInsights.create({
    host,
    callRpc: async (name, args) => {
      if (name === 'cw_admin_controls_state') return controlsPayload;
      if (name === 'cw_admin_learning_overview') return dashPayload;
      if (name === 'cw_admin_insights_and_security') return insPayload;
      if (name === 'cw_admin_ack_security_alerts') { secAckCalls++; return { ok: true, ack_at: '2026-11-27T09:15:00Z' }; }
      if (name === 'cw_admin_send_direct_message') { dmCalls.push(args); return { ok: true }; }
      if (name === 'cw_admin_update_setting') { settingCalls.push(args); return { ok: true, value: args.p_value }; }
      return {};
    },
    getSession: () => session,
    getStudents: () => sampleStudents,
    isActive: () => true,
    getCurrentTab: () => activeTab,
    getDialog: () => ({ dlg: confirmDialog, version: 1 }),
    getDialogVersion: () => 1,
    setDialogBusy: () => {},
    closeDialog: () => { confirmDialog.open = false; },
    onMessage: msg => { lastMessage = msg; },
    onPresenceRefresh: () => {},
    onSecurityAlertsChange: n => { reportedSecBadgeCount = n; }
  });

  // 1) Unified top notification feed on #admin/notices + multi-select 1:1 DM send
  ctrl.ensureLoaded('notices');
  await flush();
  const feedIdx = tableEl.innerHTML.indexOf('알림 발송 내역');
  const formIdx = tableEl.innerHTML.indexOf('배포 없는 실시간 공지 발송');
  assert.ok(feedIdx > -1 && formIdx > -1 && feedIdx < formIdx, 'unified notification feed renders at the very top');
  assert.ok(tableEl.innerHTML.includes('전체 공지 제목') && tableEl.innerHTML.includes('개인 안내'), 'both broadcast notices and 1:1 DMs appear in one feed box');

  // Filter feed to DM only
  await ctrl.handleClick({ target: { closest: sel => sel === '[data-notice-feed-filter]' ? { dataset: { noticeFeedFilter: 'dm' } } : null } });
  assert.ok(tableEl.innerHTML.includes('개인 안내'));
  assert.ok(!tableEl.innerHTML.includes('전체 공지 제목'), 'DM filter hides broadcast notices');

  // Select 2 recipients and submit inline DM form
  await ctrl.handleClick({ target: { closest: sel => sel === '[data-dm-select-visible]' ? {} : null } });
  await ctrl.handleSubmit({
    preventDefault() {},
    target: { id: 'adminInlineDmForm', _fields: { title: '복수 발송', body: '테스트 내용' } }
  });
  await flush();
  assert.deepEqual(dmCalls.map(c => c.p_target_id), ['s1', 's2'], 'multi-select sends 1:1 DM to every selected approved student');
  assert.equal(notifyCount, 1, 'triggers one realtime broadcast after batch DM send');
  assert.match(lastMessage, /2명에게 1:1 알림을 발송/);

  // 2) Dashboard: DAU & heatmap appear BEFORE 출석부 대조, and 단원별 학습 완료율 is NOT in dashboard
  activeTab = 'dashboard';
  ctrl.ensureLoaded('dashboard');
  await flush();
  const dauIdx = tableEl.innerHTML.indexOf('최근 14일 일별 순방문자');
  const heatIdx = tableEl.innerHTML.indexOf('접속 히트맵');
  const rosterIdx = tableEl.innerHTML.indexOf('출석부 대조 · 미가입자 현황');
  assert.ok(dauIdx > -1 && heatIdx > -1 && rosterIdx > -1 && dauIdx < rosterIdx && heatIdx < rosterIdx, 'DAU and heatmap appear above roster panel');
  assert.equal(tableEl.innerHTML.includes('단원별 학습 완료율'), false, 'unit completion moved out of dashboard into learning analytics');

  // 3) Learning analytics (#admin/insights): contains 단원별 학습 완료율 + bottleneck radar + search fulfillment, and NO security panels
  activeTab = 'insights';
  ctrl.ensureLoaded('insights');
  await flush();
  assert.equal(reportedSecBadgeCount, 3, 'viewing insights reports unread 24h security alerts without auto-clearing them');
  assert.equal(secAckCalls, 0, 'insights tab must not auto-ack security alerts');
  assert.ok(tableEl.innerHTML.includes('단원별 학습 완료율'), 'analytics includes unit completion rate');
  assert.ok(tableEl.innerHTML.includes('학습 병목 · 집중 체류 레이더'), 'analytics includes bottleneck & dwell-time radar');
  assert.ok(tableEl.innerHTML.includes('검색 충족률'), 'analytics includes search fulfillment rate KPI');
  assert.equal(tableEl.innerHTML.includes('다중 기기 / 세션 전환 감지'), false, 'security panels are separated out of analytics');

  // 4) Security inspection (#admin/security): viewing clears sidebar badge via cw_admin_ack_security_alerts;
  //    explicit confirm button immediately calms the threat banner.
  activeTab = 'security';
  ctrl.ensureLoaded('security');
  await flush();
  assert.equal(secAckCalls, 1, 'opening security tab auto-acknowledges unread sidebar alerts');
  assert.equal(reportedSecBadgeCount, 0, 'sidebar security alert badge clears immediately upon viewing security tab');
  assert.ok(tableEl.innerHTML.includes('악의적 접근 시도 또는 Rate Limit 차단이 감지되었습니다'), 'first visit still displays threat banner with confirm button');
  assert.ok(tableEl.innerHTML.includes('data-ack-security-alerts'), 'renders manual confirm & dismiss button');
  assert.ok(tableEl.innerHTML.includes('집중 표적 계정 TOP 10'));
  assert.ok(tableEl.innerHTML.includes('계정 대입 의심'), 'flags source probing >=3 accounts as credential stuffing suspect');
  assert.ok(tableEl.innerHTML.includes('실시간 보안 이벤트 타임라인'));
  assert.ok(tableEl.innerHTML.includes('CW_SUSPICIOUS_INPUT') && tableEl.innerHTML.includes('https://evil.test'));
  assert.equal(tableEl.innerHTML.includes('다중 기기 / 세션 전환 감지'), false, 'multi-device alert panel is removed');
  assert.ok(tableEl.innerHTML.includes('실시간 Rate Limit 버킷 모니터 (최근 1시간)'));
  assert.ok(tableEl.innerHTML.includes('10</strong> / 10회'));
  assert.ok(tableEl.innerHTML.includes('실시간 클라이언트 에러 수집기'));
  assert.ok(tableEl.innerHTML.includes('관리자 작업 감사 로그'));
  assert.equal(tableEl.innerHTML.includes('단원별 학습 완료율'), false, 'analytics panels are not duplicated in security view');

  // Clicking manual confirm button immediately switches banner from danger to confirmed/safe (when no active rate-limit block).
  const prevLimits = insPayload.rate_limits;
  insPayload.rate_limits = [];
  await ctrl.handleClick({ target: { closest: sel => sel === '[data-ack-security-alerts]' ? {} : null } });
  await flush();
  assert.equal(secAckCalls, 2);
  assert.ok(tableEl.innerHTML.includes('admin-sec-banner is-safe'), 'manual confirm switches banner to calm confirmed state');
  insPayload.rate_limits = prevLimits;

  // 4b) Up to 5 login failures on an account must stay 'safe' (non-risk); 6+ failures elevates to 'warn'.
  const origInsPayload = structuredClone(insPayload);
  ctrl.reset();
  Object.assign(insPayload, {
    security_ack_at: null,
    security_summary: {
      total_events: 5, alerts_24h: 0, unacked_alerts_24h: 0, unacked_high_or_critical: 0, critical_count: 0, high_count: 0, warn_count: 0, info_count: 5,
      login_failures: 5, rate_limit_blocks: 0, tamper_or_origin: 0, unauthorized_admin: 0, suspicious_inputs: 0,
      unique_sources: 1, targeted_accounts_count: 1
    },
    security_events: [],
    targeted_accounts: [
      { target_account: 'ga', user_id: 's1', full_name: '김가', class_name: '6반', role: 'student', status: 'approved', total_events: 5, login_failures: 5, high_or_critical: 0, unique_sources: 1, event_types: ['login_failed'], last_seen_at: '2026-11-27T09:01:00Z' }
    ],
    rate_limits: [],
    multi_device_alerts: [{ user_id: 's1', full_name: '김가', class_name: '6반', username: 'ga', distinct_devices: 3, switches_24h: 4, device_types: ['desktop', 'mobile'] }]
  });
  ctrl.ensureLoaded('security');
  await flush();
  assert.equal(reportedSecBadgeCount, 0, '5 login failures and multi-device activity produce 0 sidebar security alerts');
  assert.ok(tableEl.innerHTML.includes('admin-sec-banner is-safe'), '5 login failures stay safe');

  insPayload.targeted_accounts[0].login_failures = 6;
  insPayload.security_summary.login_failures = 6;
  ctrl.invalidate();
  ctrl.ensureLoaded('security');
  await flush();
  assert.ok(tableEl.innerHTML.includes('admin-sec-banner is-warn'), '6 login failures elevate banner to warn');

  Object.assign(insPayload, origInsPayload);
  delete insPayload.security_ack_at;
  ctrl.reset();
  ctrl.ensureLoaded('security');
  await flush();

  // Filter timeline to critical only & test live security search wiring
  await ctrl.handleClick({ target: { closest: sel => sel === '[data-sec-severity]' ? { dataset: { secSeverity: 'critical' } } : null } });
  assert.ok(tableEl.innerHTML.includes('CW_SUSPICIOUS_INPUT'));
  assert.ok(!tableEl.innerHTML.includes('https://evil.test'), 'critical filter hides high-severity origin_denied event');
  await ctrl.handleClick({ target: { closest: sel => sel === '[data-sec-severity]' ? { dataset: { secSeverity: '' } } : null } });
  assert.ok(read('js/admin-members.js').includes("e.target.id==='adminSecEventSearch'&&currentTab()==='security'"), 'admin-members.js forwards #adminSecEventSearch input events');
  assert.equal(ctrl.handleInput({ target: { id: 'adminSecEventSearch', value: 'evil.test' } }), true);
  assert.ok(tableEl.innerHTML.includes('https://evil.test'));
  assert.ok(!tableEl.innerHTML.includes('CW_SUSPICIOUS_INPUT'), 'live search narrows timeline to matching events');
  ctrl.handleInput({ target: { id: 'adminSecEventSearch', value: '' } });

  // 5) Controls (#admin/controls): Maintenance ON/OFF switch requires confirmation dialog before calling RPC
  activeTab = 'controls';
  ctrl.ensureLoaded('controls');
  await flush();
  assert.match(tableEl.innerHTML, /role="switch" aria-checked="false"[^>]*data-toggle-maintenance/);
  await ctrl.handleClick({ target: { closest: sel => sel === '[data-toggle-maintenance]' ? {} : null } });
  assert.equal(confirmDialog.open, true, 'clicking ON/OFF toggle opens confirmation modal');
  assert.equal(settingCalls.length, 0, 'no RPC fired before admin confirms');
  assert.match(confirmDialog.innerHTML, /원격 점검 모드를 켤까요/);
  await confirmDialog.confirmBtn.events.click();
  await flush();
  assert.equal(settingCalls.length, 1);
  assert.equal(settingCalls[0].p_key, 'maintenance');
  assert.equal(settingCalls[0].p_value.enabled, true);
  assert.equal(confirmDialog.open, false);
}

(async () => {
  testCsvAndInsightsUi();
  await testTelemetryAndLiveNotice();
  testStaticWiring();
  await testReorganizedAdminViews();
  console.log('PASS: admin command center CSV sanitization, telemetry sync, live notice, spotlight, 1:1 DM, maintenance, feature flags, unified feed, multi-DM, split analytics & security views');
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
