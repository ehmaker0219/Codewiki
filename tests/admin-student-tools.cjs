const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const flush = () => new Promise(resolve => setImmediate(resolve));

function makeClassList() {
  const set = new Set();
  return {
    add: (...c) => c.forEach(x => set.add(x)),
    remove: (...c) => c.forEach(x => set.delete(x)),
    toggle: (c, f) => {
      const next = f === undefined ? !set.has(c) : Boolean(f);
      if (next) set.add(c);
      else set.delete(c);
      return next;
    },
    contains: c => set.has(c)
  };
}

function makeNode(id) {
  return {
    id,
    hidden: ['adminMembersPage', 'openFoundationBtn', 'foundationPage', 'openMentoringBtn', 'mentoringPage'].includes(id),
    innerHTML: '',
    textContent: '',
    value: '',
    dataset: {},
    style: {},
    events: {},
    classList: makeClassList(),
    addEventListener(type, fn) { this.events[type] = fn; },
    replaceChildren() { this.innerHTML = ''; this.textContent = ''; },
    setAttribute() {},
    focus() {},
    querySelector(sel) {
      if (sel === '#membersTable') return this._table;
      if (sel === '#membersPresence') return this._presence;
      if (sel === '#membersMessage') return this._message;
      if (sel === '#membersCount') return this._count;
      return null;
    },
    querySelectorAll: () => []
  };
}

// 1. Admin #admin/accounts tool toggle UI: RPC payload, duplicate guard, roster sync, runtime notify, error handling.
async function testAccountsToolToggleUi() {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, makeNode(id));
    return nodes.get(id);
  };
  const host = get('adminMembersPage');
  host._table = get('membersTable');
  host._presence = get('membersPresence');
  host._message = get('membersMessage');
  host._count = get('membersCount');

  const requests = [];
  const syncedRosters = [];
  let notifyCount = 0;
  const location = { hash: '#admin/accounts' };

  const windowObj = {
    location,
    addEventListener() {},
    CodeWikiLearning: { escape: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) },
    CodeWikiAuth: {
      getSessionToken: () => 'admin-tok',
      setAdminPreviewMode: () => true,
      setAdminPreviewRoster: list => syncedRosters.push(list.map(u => ({ id: u.id, tools: u.tools }))),
      getSupabaseClient: () => ({
        rpc: (name, args) => new Promise(resolve => requests.push({ name, args, resolve }))
      })
    },
    CodeWikiTelemetry: { notifyRuntimeUpdate: () => { notifyCount++; } }
  };

  const ctx = vm.createContext({
    window: windowObj,
    document: { getElementById: get, querySelectorAll: () => [], createElement: () => makeNode('dialog'), body: { append() {} } },
    history: { replaceState(_a, _b, h) { location.hash = h; } },
    AbortController,
    TextEncoder,
    setTimeout,
    clearTimeout
  });
  vm.runInContext(fs.readFileSync('js/admin-members.js', 'utf8'), ctx);

  ctx.window.CodeWikiAdminMembers.setUser({ id: 'adm-1', role: 'admin', status: 'approved' });
  requests.shift().resolve({
    data: [
      { id: 'stu-1', full_name: '홍길동', username: 'hong', class_name: '6반', student_number: 5, status: 'approved', tools: { mentoring: false, foundation: false } },
      { id: 'stu-2', full_name: '대기학생', username: 'wait', class_name: '6반', student_number: 6, status: 'pending', tools: { mentoring: false, foundation: false } }
    ]
  });
  await flush();

  assert.match(get('membersTable').innerHTML, /data-toggle-tool="mentoring" data-tool-uid="stu-1" aria-pressed="false"/);
  assert.match(get('membersTable').innerHTML, /data-toggle-tool="foundation" data-tool-uid="stu-1" aria-pressed="false"/);
  assert.doesNotMatch(get('membersTable').innerHTML, /data-tool-uid="stu-2"/, 'pending students do not get tool toggles');

  // Toggle foundation ON (duplicate clicks while in-flight coalesced)
  const clickTool = (uid, tool) => host.events.click({
    target: { closest: sel => sel === '[data-toggle-tool]' ? { dataset: { toolUid: uid, toggleTool: tool } } : null }
  });
  clickTool('stu-1', 'foundation');
  clickTool('stu-1', 'foundation');
  assert.equal(requests.length, 1, 'in-flight toggle coalesced');
  assert.equal(requests[0].name, 'cw_admin_set_student_tools');
  assert.deepEqual({ ...requests[0].args.p_tools }, { mentoring: false, foundation: true });

  requests.shift().resolve({ data: { ok: true, user_id: 'stu-1', tools: { mentoring: false, foundation: true } } });
  await flush();

  assert.match(get('membersTable').innerHTML, /data-toggle-tool="foundation" data-tool-uid="stu-1" aria-pressed="true"/);
  assert.match(get('membersMessage').textContent, /홍길동님의 파운데이션 권한을 켰습니다/);
  assert.equal(notifyCount, 1, 'broadcasts runtime update so student browser refreshes immediately');
  assert.equal(syncedRosters.at(-1)[0].tools.foundation, true, 'preview roster synced with new tool grants');

  // PGRST202 failure keeps previous state and surfaces clean Korean notice
  clickTool('stu-1', 'mentoring');
  requests.shift().resolve({ error: { code: 'PGRST202' } });
  await flush();
  assert.match(get('membersTable').innerHTML, /data-toggle-tool="mentoring" data-tool-uid="stu-1" aria-pressed="false"/);
  assert.match(get('membersMessage').textContent, /아직 서버 DB에 적용되지 않았습니다/);
}

// 2. Dynamic DB-backed grants work for ANY student in mentoring.js & foundation.js, and revoking closes active pages.
async function testDynamicStudentGrants() {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, makeNode(id));
    return nodes.get(id);
  };
  const location = { hash: '#doc/welcome-abap' };
  const winEvents = {};
  const dynamicId = '77777777-8888-4999-8aaa-bbbbbbbbbbbb';
  const ownerId = '2eafc83d-09cd-4ea6-98a8-9bbb1ebdeb06';
  const createdStores = [];

  const windowObj = {
    location,
    scrollTo() {},
    addEventListener(type, fn) { (winEvents[type] ??= []).push(fn); },
    CodeWikiAuth: {
      getSessionToken: () => 'stu-tok',
      getCurrentUser: () => null,
      isAdminPreviewMode: () => false,
      getAdminPreviewStudent: () => null
    },
    CodeWikiApp: {
      getCurrentDocId: () => 'welcome-abap',
      renderEditorCode: raw => `<span class="sap-code-line">${raw}</span>`
    },
    CodeWikiMentoringTeamStore: {
      create(actorId) {
        createdStores.push(actorId);
        return { read: async () => ({ activities: [], folders: [], folderAssignments: {}, checklists: {}, drafts: {}, submissions: {}, feedback: {}, comments: [] }) };
      }
    }
  };

  const ctx = vm.createContext({
    window: windowObj,
    location,
    document: { getElementById: get, querySelectorAll: () => [], createElement: () => makeNode('tmp'), body: get('body') },
    history: { replaceState(_a, _b, h) { location.hash = h; } },
    setTimeout,
    clearTimeout,
    structuredClone,
    Intl
  });
  for (const file of ['learning-tools', 'mentoring-model', 'mentoring', 'foundation']) {
    vm.runInContext(fs.readFileSync(`js/${file}.js`, 'utf8'), ctx);
  }

  // Non-hardcoded student with DB grants { mentoring: true, foundation: true } gets BOTH tools!
  const grantedUser = { id: dynamicId, role: 'student', status: 'approved', full_name: '신규멘토', class_name: '3반', tools: { mentoring: true, foundation: true } };
  ctx.window.CodeWikiMentoring.setUser(grantedUser);
  ctx.window.CodeWikiFoundation.setUser(grantedUser);
  assert.equal(get('openMentoringBtn').hidden, false, 'dynamic student receives Mentoring button via DB grant');
  assert.equal(get('openFoundationBtn').hidden, false, 'dynamic student receives Foundation button via DB grant');
  assert.equal(createdStores.at(-1), dynamicId, 'dynamic mentor uses isolated personal mentoring store');

  // Opening #foundation works, then revoking foundation via DB closes #foundation cleanly
  location.hash = '#foundation';
  (winEvents.hashchange || []).forEach(fn => fn());
  assert.equal(get('foundationPage').hidden, false);

  const revokedUser = { ...grantedUser, tools: { mentoring: true, foundation: false } };
  ctx.window.CodeWikiFoundation.setUser(revokedUser);
  assert.equal(get('openFoundationBtn').hidden, true);
  assert.equal(get('foundationPage').hidden, true);
  assert.equal(location.hash, '#doc/welcome-abap', 'revoking active Foundation closes page and returns home');

  // Even the original default owner (이은호) respects an explicit DB grant of false!
  const revokedOwner = { id: ownerId, role: 'student', status: 'approved', full_name: '이은호', tools: { mentoring: false, foundation: false } };
  ctx.window.CodeWikiMentoring.setUser(revokedOwner);
  ctx.window.CodeWikiFoundation.setUser(revokedOwner);
  assert.equal(get('openMentoringBtn').hidden, true, 'explicit DB false overrides static mentor default');
  assert.equal(get('openFoundationBtn').hidden, true, 'explicit DB false overrides static foundation default');
}

(async () => {
  await testAccountsToolToggleUi();
  await testDynamicStudentGrants();
  console.log('PASS: per-student dedicated tool toggles (mentoring/foundation), dynamic mentor registration, live revocation, DB override & error recovery');
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
