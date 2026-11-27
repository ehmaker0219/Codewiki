const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const flush = () => new Promise(resolve => setImmediate(resolve));

function createHarness() {
  const nodes = new Map();
  const requests = [];
  let token = 'admin-token';
  let user = { id: 'admin-1', role: 'admin', status: 'approved', pending_count: 1 };
  let confirmResult = true;
  let authRefreshes = 0;

  function makeNode(id) {
    if (!nodes.has(id)) {
      const classes = new Set();
      const el = {
        id,
        innerHTML: '',
        textContent: '',
        value: '',
        hidden: id === 'adminMembersPage',
        open: false,
        isConnected: true,
        events: {},
        classList: {
          add: (...c) => c.forEach(x => classes.add(x)),
          remove: (...c) => c.forEach(x => classes.delete(x)),
          toggle: (c, f) => {
            const on = f === undefined ? !classes.has(c) : Boolean(f);
            if (on) classes.add(c);
            else classes.delete(c);
            return on;
          },
          contains: c => classes.has(c)
        },
        addEventListener(type, fn) { this.events[type] = fn; },
        setAttribute() {},
        focus() {},
        select() {},
        contains: () => false,
        querySelector(sel) {
          if (sel === '#membersTable') return makeNode('membersTable');
          if (sel === '#membersPresence') return makeNode('membersPresence');
          if (sel === '#membersMessage') return makeNode('membersMessage');
          if (sel === '#membersCount') return makeNode('membersCount');
          return null;
        },
        querySelectorAll: () => []
      };
      nodes.set(id, el);
    }
    return nodes.get(id);
  }

  const winEvents = {};
  const location = { hash: '#admin/approvals' };
  const window = {
    location,
    confirm: () => confirmResult,
    addEventListener(type, fn) { winEvents[type] = fn; },
    CodeWikiAuth: {
      getSessionToken: () => token,
      getCurrentUser: () => user,
      getSupabaseClient: () => ({
        rpc: (name, args) => new Promise(resolve => requests.push({ name, args, resolve }))
      }),
      refresh: async () => { authRefreshes++; }
    },
    CodeWikiBirthdays: { refresh() {} },
    CodeWikiPresence: { refresh() {} }
  };

  const ctx = vm.createContext({
    window,
    document: {
      getElementById: id => makeNode(id),
      querySelectorAll: () => [],
      createElement: () => makeNode('dialog'),
      body: { append() {} },
      activeElement: null
    },
    history: { replaceState(_a, _b, hash) { location.hash = hash; } },
    AbortController,
    TextEncoder,
    setTimeout,
    clearTimeout
  });

  for (const file of ['learning-tools', 'admin', 'admin-members']) {
    vm.runInContext(fs.readFileSync(`js/${file}.js`, 'utf8'), ctx);
  }

  return {
    api: ctx.window.CodeWikiAdminMembers,
    host: makeNode('adminMembersPage'),
    table: makeNode('membersTable'),
    badge: makeNode('adminPendingCountBadge'),
    sidebarBtn: makeNode('openAdminModalBtn'),
    requests,
    location,
    setConfirm: v => { confirmResult = v; },
    getAuthRefreshes: () => authRefreshes,
    setUserState: (nextUser, nextToken) => {
      user = nextUser;
      token = nextToken;
      ctx.window.CodeWikiAdminMembers.setUser(nextUser);
    },
    fireHashchange: () => winEvents.hashchange?.(),
    clickHost: (selector, attrs = {}, dataset = {}) => {
      makeNode('adminMembersPage').events.click({
        target: {
          closest: s => s === selector ? {
            dataset,
            getAttribute: k => attrs[k] ?? null
          } : null
        }
      });
    },
    inputHost: (id, value) => {
      makeNode('adminMembersPage').events.input({ target: { id, value } });
    }
  };
}

(async () => {
  const h = createHarness();
  const sampleUsers = [
    { id: 'u1', full_name: '신규학생', username: 'newbie', class_name: '6반', status: 'pending', role: 'student', created_at: '2026-11-27T08:00:00Z' },
    { id: 'u2', full_name: '승인학생', username: 'approved1', class_name: '1반', status: 'approved', role: 'student', mbti: 'ENFP' },
    { id: 'u3', full_name: '반려학생', username: 'rejected1', class_name: '6반', status: 'rejected', role: 'student', created_at: '2026-11-26T05:00:00Z' }
  ];

  // 1. Opening #admin/approvals loads users + birthdays in parallel inside the full page (no modal)
  h.api.setUser({ id: 'admin-1', role: 'admin', status: 'approved', pending_count: 1 });
  await flush();
  assert.equal(h.host.hidden, false);
  assert.equal(h.sidebarBtn.classList.contains('active'), true);
  assert.equal(h.requests.length, 2);
  assert.deepEqual(h.requests.map(r => r.name).sort(), ['cw_admin_birthdays', 'cw_admin_list_users']);

  const listReq = h.requests.splice(h.requests.findIndex(r => r.name === 'cw_admin_list_users'), 1)[0];
  const bdayReq = h.requests.splice(h.requests.findIndex(r => r.name === 'cw_admin_birthdays'), 1)[0];
  listReq.resolve({ data: sampleUsers });
  bdayReq.resolve({ data: [{ user_id: 'u1', birth_date: '2001-03-04' }] });
  await flush();

  assert.match(h.table.innerHTML, /admin-approval-page/);
  assert.doesNotMatch(h.host.innerHTML, /members-tabs/, 'navigation belongs only in the sidebar, not inner page tabs');
  assert.doesNotMatch(h.table.innerHTML, /role="dialog"/, 'approvals must render as a full page, not a modal dialog');
  assert.match(h.table.innerHTML, /신규학생/);
  assert.match(h.table.innerHTML, /2001-03-04/);
  assert.equal(h.badge.textContent, '1');
  assert.equal(h.badge.hidden, false);

  // 2. Local search, class filter, and status filter cause zero extra RPCs
  h.inputHost('adminApprovalSearch', '신규');
  assert.match(h.table.innerHTML, /신규학생/);
  assert.doesNotMatch(h.table.innerHTML, /승인학생/);
  h.inputHost('adminApprovalSearch', '');
  h.clickHost('[data-class-filter]', { 'data-class-filter': '1반' });
  assert.match(h.table.innerHTML, /승인학생/);
  assert.doesNotMatch(h.table.innerHTML, /신규학생/);
  h.clickHost('[data-class-filter]', { 'data-class-filter': 'ALL' });
  h.clickHost('[data-approval-status]', { 'data-approval-status': 'rejected' });
  assert.match(h.table.innerHTML, /반려학생/);
  assert.doesNotMatch(h.table.innerHTML, /승인학생/);
  h.clickHost('[data-approval-status]', { 'data-approval-status': 'ALL' });
  assert.equal(h.requests.length, 0, 'local filters must not call RPC');

  // 3. Approving a pending student sends cw_admin_set_status and reloads approvals ONCE (no double fetch)
  h.clickHost('[data-uid]', { 'data-uid': 'u1', 'data-next': 'approved' });
  await flush();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].name, 'cw_admin_set_status');
  h.requests.shift().resolve({ data: true });
  await flush();
  assert.equal(h.requests.length, 2, 'single approvals refresh (list + birthdays) without duplicate reload');
  const reloadList = h.requests.splice(h.requests.findIndex(r => r.name === 'cw_admin_list_users'), 1)[0];
  const reloadBday = h.requests.splice(h.requests.findIndex(r => r.name === 'cw_admin_birthdays'), 1)[0];
  reloadList.resolve({ data: [{ ...sampleUsers[0], status: 'approved' }, sampleUsers[1], sampleUsers[2]] });
  reloadBday.resolve({ data: [] });
  await flush();
  assert.equal(h.badge.hidden, true);
  assert.equal(h.getAuthRefreshes(), 1);

  // 4. Deleting rejected user updates local list without refetching
  h.setConfirm(false);
  h.clickHost('[data-uid]', { 'data-uid': 'u3', 'data-next': 'delete' });
  assert.equal(h.requests.length, 0, 'cancelled confirm must not delete');
  h.setConfirm(true);
  h.clickHost('[data-uid]', { 'data-uid': 'u3', 'data-next': 'delete' });
  await flush();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].name, 'cw_admin_delete_rejected_user');
  h.requests.shift().resolve({ data: true });
  await flush();
  assert.equal(h.requests.length, 0, 'delete updates locally without refetch');
  assert.doesNotMatch(h.table.innerHTML, /반려학생/);

  // 5. Switching to student / logout clears approval page cleanly
  h.setUserState(null, '');
  assert.equal(h.host.hidden, true);
  assert.equal(h.host.innerHTML, '');

  // 6. Static wiring checks
  const html = fs.readFileSync('index.html', 'utf8');
  assert.doesNotMatch(html, /id="adminModal"/, 'obsolete approval popup backdrop removed');
  const authJs = fs.readFileSync('js/auth.js', 'utf8');
  assert.match(authJs, /href="#admin\/students"\s+id="openStudentDirectoryBtn"/);
  assert.match(authJs, /href="#admin\/accounts"\s+id="openStudentAccountsBtn"/);
  assert.match(authJs, /href="#admin\/approvals"\s+id="openAdminModalBtn"/);
  assert.match(authJs, /href="#admin\/logins"\s+id="openLoginHistoryBtn"/);
  assert.match(authJs, /href="#admin\/notices"\s+id="openAdminNoticesBtn"/);
  assert.match(authJs, /href="#admin\/dashboard"\s+id="openAdminDashboardBtn"/);
  assert.match(authJs, /href="#admin\/insights"\s+id="openAdminInsightsBtn"/);
  assert.match(authJs, /href="#admin\/controls"\s+id="openAdminControlsBtn"/);
  assert.match(authJs, /href="#admin\/security"\s+id="openAdminSecurityBtn"/);
  const presenceJs = fs.readFileSync('js/presence.js', 'utf8');
  assert.match(presenceJs, /'#admin\/accounts'/);
  assert.match(presenceJs, /'#admin\/approvals'/);
  assert.match(presenceJs, /'#admin\/notices'/);
  assert.match(presenceJs, /'#admin\/security'/);
  const insightsJs = fs.readFileSync('js/admin-insights.js', 'utf8');
  assert.match(insightsJs, /function renderNoticesHtml\(\)/);
  assert.match(insightsJs, /function renderSecurityHtml\(\)/);
  assert.match(insightsJs, /id="adminInlineDmForm"/);
  assert.match(insightsJs, /data-notice-feed-filter/);
  assert.match(insightsJs, /data-dm-recipient/);

  console.log('PASS: full-page Student Approvals (#admin/approvals), KPI/local filters, single-fetch approve, local delete, logout isolation, static wiring');
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
