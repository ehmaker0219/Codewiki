const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const flush = () => new Promise(resolve => setImmediate(resolve));

// 1. Admin page: 전원 로그아웃 button, confirmation dialog, RPC, broadcast notify, presence force-refresh, error & stale guards.
async function testAdminMembersLogoutAll() {
  const nodes = new Map();
  const requests = [];
  let notifyCount = 0;
  const refreshCalls = [];
  let timerId = 0;
  const timers = new Map();

  function node(id) {
    if (!nodes.has(id)) {
      nodes.set(id, {
        id, innerHTML: '', textContent: '', value: '', hidden: true, open: false, isConnected: true, disabled: false,
        events: {}, classList: { add() {}, remove() {} },
        addEventListener(k, fn) { this.events[k] = fn; },
        setAttribute() {}, focus() {},
        showModal() { this.open = true; },
        close() { this.open = false; this.events.close?.(); },
        querySelector: s => node(s.startsWith('#') ? s.slice(1) : s),
        querySelectorAll: s => s === 'button' ? [node('confirmLogoutAllBtn'), node('cancelLogoutAllBtn')] : s === '[data-logout-close]' ? [node('cancelLogoutAllBtn')] : []
      });
    }
    return nodes.get(id);
  }

  const window = {
    location: { hash: '#admin/students' },
    addEventListener() {},
    CodeWikiLearning: { escape: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) },
    CodeWikiPresence: {
      refresh: force => refreshCalls.push(Boolean(force)),
      notifySessionCheck: () => { notifyCount++; return Promise.resolve(true); }
    },
    CodeWikiAuth: {
      getSessionToken: () => 'admin-token',
      getSupabaseClient: () => ({ rpc: (name, args) => new Promise((resolve, reject) => requests.push({ name, args, resolve, reject })) })
    }
  };
  const ctx = {
    window,
    document: { getElementById: node, querySelectorAll: () => [], createElement: () => node('dialog'), body: { append() {} } },
    history: { replaceState: (a, b, h) => { window.location.hash = h; } },
    AbortController, TextEncoder,
    setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id)
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'admin-members.js'), 'utf8'), ctx);
  const api = window.CodeWikiAdminMembers;
  const host = node('adminMembersPage');

  api.setUser({ id: 'adm-1', role: 'admin' });
  requests.shift().resolve({ data: [] });
  await flush();
  assert.ok(host.innerHTML.includes('data-logout-all'), 'admin header renders 전원 로그아웃 button');

  // Open confirmation dialog and trigger logout-all with duplicate-click guard.
  host.events.click({ target: { closest: sel => sel === '[data-logout-all]' ? {} : null } });
  assert.equal(node('dialog').open, true, 'confirmation dialog opens');
  assert.ok(node('dialog').innerHTML.includes('관리자에 의해 로그아웃되었습니다.'));

  const confirmBtn = node('confirmLogoutAllBtn');
  confirmBtn.events.click();
  confirmBtn.events.click();
  assert.equal(requests.length, 1, 'duplicate confirm clicks coalesced');
  assert.equal(requests[0].name, 'cw_admin_logout_all');
  assert.equal(requests[0].args.p_token, 'admin-token');

  requests.shift().resolve({ data: { ok: true, logged_out_count: 5 } });
  await flush();
  assert.equal(node('dialog').open, false, 'dialog closes on success');
  assert.equal(notifyCount, 1, 'triggers Realtime session_check broadcast after DB revocation');
  assert.equal(refreshCalls.at(-1), true, 'force-refreshes presence list after mass logout');
  assert.match(node('membersMessage').textContent, /5명/);

  // PGRST202 error shows safe message inside dialog.
  host.events.click({ target: { closest: sel => sel === '[data-logout-all]' ? {} : null } });
  node('confirmLogoutAllBtn').events.click();
  requests.shift().resolve({ error: { code: 'PGRST202', message: 'raw postgres detail' } });
  await flush();
  assert.equal(node('dialog').open, true);
  assert.match(node('logoutAllMessage').textContent, /아직 서버에 적용/);
  assert.ok(!node('logoutAllMessage').textContent.includes('raw postgres'));
}

// 2. Presence: Realtime broadcast wakeup, spoofed-broadcast safety, authoritative CW_ADMIN_LOGOUT redirect, hidden tab deferral & cleanup.
async function testPresenceRealtimeWakeup() {
  let now = 2000000;
  let seq = 0;
  const timers = new Map();
  const requests = [];
  const forcedLogouts = [];
  const removedChannels = [];
  const sentBroadcasts = [];
  let broadcastCb = null;
  const docEvents = {};

  const fakeChannel = {
    on(type, filter, cb) {
      if (type === 'broadcast' && filter?.event === 'session_check') broadcastCb = cb;
      return fakeChannel;
    },
    subscribe() { return fakeChannel; },
    async send(msg) { sentBroadcasts.push(msg); return 'ok'; }
  };

  const document = { hidden: false, addEventListener: (k, fn) => { docEvents[k] = fn; } };
  const window = {
    location: { hash: '#doc/unit-01' },
    addEventListener() {},
    CodeWikiAdminMembers: { setPresence() {} },
    CodeWikiAuth: {
      getSessionToken: () => 'stu-token',
      handleForcedLogout: msg => forcedLogouts.push(msg),
      getSupabaseClient: () => ({
        rpc: (name, args) => new Promise(resolve => requests.push({ name, args, resolve })),
        channel: () => fakeChannel,
        removeChannel: ch => removedChannels.push(ch)
      })
    }
  };

  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'presence.js'), 'utf8'), {
    window, document, AbortController,
    Date: { now: () => now },
    Math: { floor: Math.floor, max: Math.max, min: Math.min, random: () => 0 },
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id)
  });

  const api = window.CodeWikiPresence;
  const student = { id: 's1', role: 'student', status: 'approved' };
  api.setUser(student);
  assert.equal(requests.length, 1);
  assert.equal(typeof broadcastCb, 'function', 'student subscribes to session_check broadcast');
  requests.shift().resolve({ data: null });
  await flush();

  // Spoofed broadcast wakeup: checks immediately after jitter, stays logged in if server says OK.
  now += 5000;
  broadcastCb();
  assert.equal(requests.length, 0, 'waits jitter before pinging');
  const wakeEntry = [...timers.entries()].find(([, t]) => t.ms === 150);
  assert.ok(wakeEntry, 'schedules jittered wakeup check');
  timers.delete(wakeEntry[0]);
  wakeEntry[1].fn();
  assert.equal(requests.length, 1, 'bypasses 55s throttle on wakeup');
  requests.shift().resolve({ data: null });
  await flush();
  assert.equal(forcedLogouts.length, 0, 'valid token stays logged in even after spoofed broadcast');

  // Immediate repeat broadcast within 10s is rate-limited.
  now += 2000;
  broadcastCb();
  assert.equal([...timers.values()].some(t => t.ms === 150), false, 'broadcast wakeup throttled to once per 10s');

  // Real admin logout broadcast after 11s -> server rejects with CW_ADMIN_LOGOUT -> instant forced logout + channel cleanup.
  now += 11000;
  broadcastCb();
  const wakeEntry2 = [...timers.entries()].find(([, t]) => t.ms === 150);
  timers.delete(wakeEntry2[0]);
  wakeEntry2[1].fn();
  assert.equal(requests.length, 1);
  requests.shift().resolve({ error: { code: '42501', details: 'CW_ADMIN_LOGOUT', message: '관리자에 의해 로그아웃되었습니다.' } });
  await flush();
  assert.deepEqual(forcedLogouts, ['관리자에 의해 로그아웃되었습니다.']);
  assert.equal(removedChannels.length, 1, 'Realtime channel removed on forced logout');

  // Admin notifySessionCheck sends broadcast and cleans up temporary channel.
  const sent = await api.notifySessionCheck();
  assert.equal(sent, true);
  assert.equal(sentBroadcasts.length, 1);
  assert.equal(sentBroadcasts[0].event, 'session_check');
  assert.equal(removedChannels.length, 2);
}

// 3. Auth: cw_me returning forced_logout clears token, opens login screen and displays popup.
async function testAuthForcedLogoutPopup() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth.js'), 'utf8');
  const key = 'codewiki_supa_token_v1';
  const saved = new Map([[key, 'revoked-token']]);
  const nodes = new Map();
  const docListeners = new Map();
  let landingNotice = '';
  let trackResetCount = 0;

  function get(id) {
    if (!nodes.has(id)) {
      const classes = new Set(id.endsWith('Modal') || id.endsWith('Overlay') ? ['hidden'] : []);
      const listeners = new Map();
      nodes.set(id, {
        id, innerHTML: '', onclick: null,
        classList: {
          add: (...n) => n.forEach(c => classes.add(c)),
          remove: (...n) => n.forEach(c => classes.delete(c)),
          contains: c => classes.has(c)
        },
        addEventListener(k, fn) { if (!listeners.has(k)) listeners.set(k, []); listeners.get(k).push(fn); },
        click() { for (const fn of listeners.get('click') || []) fn({ target: this }); },
        querySelectorAll: () => [],
        focus() {}
      });
    }
    return nodes.get(id);
  }

  const context = {
    onLandingNotice: msg => { landingNotice = msg || ''; },
    window: {
      location: { hash: '#doc/unit-01' },
      supabase: { createClient: () => ({ rpc: async () => ({ data: { forced_logout: true, reason: 'admin_logout_all' } }) }) },
      scrollTo() {},
      CodeWikiApp: { hasSelectedTrack: () => true, resetTrackChoice: () => { trackResetCount++; } }
    },
    AbortController, setTimeout, clearTimeout,
    document: {
      getElementById: get,
      body: get('body'),
      addEventListener(k, fn) { if (!docListeners.has(k)) docListeners.set(k, new Set()); docListeners.get(k).add(fn); },
      removeEventListener(k, fn) { docListeners.get(k)?.delete(fn); }
    },
    localStorage: { getItem: k => saved.get(k), setItem: (k, v) => saved.set(k, v), removeItem: k => saved.delete(k) }
  };

  vm.runInNewContext(
    source.replace(/  renderAuthState\(\);\s*\}\)\(\);\s*$/, '  renderPreLoginLanding = msg => { onLandingNotice(msg); }; window.refresh = renderAuthState;\n})();'),
    context
  );

  await context.window.refresh();
  assert.equal(saved.has(key), false, 'revoked token cleared immediately');
  assert.equal(context.window.CodeWikiAuth.getCurrentUser(), null);
  assert.equal(trackResetCount, 1, 'track choice reset');
  assert.equal(get('authGateOverlay').classList.contains('hidden'), false, 'login page shown immediately');
  assert.equal(landingNotice, '관리자에 의해 로그아웃되었습니다.');
  assert.equal(get('forcedLogoutModal').classList.contains('hidden'), false, 'forced-logout popup shown');
  assert.ok(get('forcedLogoutModal').innerHTML.includes('관리자에 의해 로그아웃되었습니다.'));
  assert.equal(docListeners.get('keydown')?.size || 0, 1);

  // Confirm button closes popup and cleans up keydown listener.
  get('forcedLogoutConfirmBtn').click();
  assert.equal(get('forcedLogoutModal').classList.contains('hidden'), true);
  assert.equal(docListeners.get('keydown')?.size || 0, 0);

  // Repeat handleForcedLogout when already logged out is a no-op.
  context.window.CodeWikiAuth.handleForcedLogout('관리자에 의해 로그아웃되었습니다.');
  assert.equal(get('forcedLogoutModal').classList.contains('hidden'), true);
}

(async () => {
  await testAdminMembersLogoutAll();
  await testPresenceRealtimeWakeup();
  await testAuthForcedLogoutPopup();
  console.log('PASS: admin mass logout UI, realtime wakeup + spoof safety, CW_ADMIN_LOGOUT redirect, forced-logout popup and cleanup');
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
