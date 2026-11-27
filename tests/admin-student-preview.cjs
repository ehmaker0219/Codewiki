const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const OWNER_ID = '2eafc83d-09cd-4ea6-98a8-9bbb1ebdeb06'; // 이은호 (mentor + foundation)
const MENTOR_ID = '9ed5fcaf-8785-4e3b-8050-ad94482a7068'; // 김태규 (mentor only)
const REGULAR_ID = '11111111-2222-4333-8444-555555555555'; // 일반 학생
const ADMIN_ID = 'a56f9325-c658-4be4-893a-4b2c1fd0a1f5';

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
    hidden: ['openFoundationBtn', 'foundationPage', 'openMentoringBtn', 'mentoringPage', 'studyWorkspace', 'adminPreviewBanner'].includes(id),
    innerHTML: '',
    textContent: '',
    value: '',
    dataset: {},
    style: {},
    events: {},
    classList: makeClassList(),
    addEventListener(type, fn) { this.events[type] = fn; },
    replaceChildren() { this.innerHTML = ''; this.textContent = ''; },
    querySelector: () => null,
    querySelectorAll: () => [],
    setAttribute() {},
    focus() {}
  };
}

(async () => {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, makeNode(id));
    return nodes.get(id);
  };
  const location = { hash: '#admin/students' };
  const winEvents = {};
  let previewMode = false;
  let previewStudent = null;
  let storeCreated = 0;
  let studyStoreCreated = 0;

  const windowObj = {
    location,
    scrollTo() {},
    addEventListener(type, fn) { (winEvents[type] ??= []).push(fn); },
    CodeWikiAuth: {
      getSessionToken: () => 'admin-token',
      getCurrentUser: () => ({ id: ADMIN_ID, role: 'admin', status: 'approved', full_name: '관리자' }),
      isAdminPreviewMode: () => previewMode,
      getAdminPreviewStudent: () => (previewMode && previewStudent ? { ...previewStudent } : null),
      getSupabaseClient: () => ({ rpc: () => { throw new Error('preview mode must not call student RPCs'); } })
    },
    CodeWikiApp: {
      getCurrentDocId: () => 'welcome-abap',
      renderEditorCode: raw => `<span class="sap-code-line">${raw}</span>`
    },
    CodeWikiMentoringTeamStore: {
      create() { storeCreated++; return { read: async () => ({}) }; }
    },
    CodeWikiStudyStore: {
      create() { studyStoreCreated++; return { dispose() {} }; }
    }
  };

  const ctx = vm.createContext({
    window: windowObj,
    location,
    document: {
      getElementById: get,
      querySelectorAll: () => [],
      createElement: () => makeNode('tmp'),
      body: get('body')
    },
    history: { replaceState(_a, _b, h) { location.hash = h; } },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout,
    clearTimeout,
    structuredClone,
    Intl
  });

  for (const file of ['learning-tools', 'mentoring-model', 'mentoring', 'foundation', 'study']) {
    vm.runInContext(fs.readFileSync(`js/${file}.js`, 'utf8'), ctx);
  }

  const adminUser = { id: ADMIN_ID, role: 'admin', status: 'approved', full_name: '관리자' };
  const fireHash = () => (winEvents.hashchange || []).forEach(fn => fn());
  const syncAll = () => {
    ctx.window.CodeWikiMentoring.setUser(adminUser);
    ctx.window.CodeWikiFoundation.setUser(adminUser);
    ctx.window.CodeWikiStudy.setUser(adminUser);
  };

  // 1. Normal admin (not previewing): all student-specific tools hidden
  syncAll();
  assert.equal(get('openFoundationBtn').hidden, true);
  assert.equal(get('openMentoringBtn').hidden, true);

  // 2. Previewing regular student: neither mentoring nor foundation shown, study preview is read-only
  previewMode = true;
  previewStudent = { id: REGULAR_ID, full_name: '박민수', class_name: '6반', status: 'approved' };
  syncAll();
  assert.equal(get('openFoundationBtn').hidden, true, 'regular student has no Foundation');
  assert.equal(get('openMentoringBtn').hidden, true, 'regular student has no Mentoring');
  location.hash = '#study';
  fireHash();
  assert.equal(get('studyWorkspace').hidden, false);
  assert.match(get('studyWorkspace').innerHTML, /박민수님의 공부방/);
  assert.match(get('studyWorkspace').innerHTML, /학생 개인 노트 보호 안내/);
  assert.equal(studyStoreCreated, 0, 'study preview must not instantiate personal study store');

  // 3. Switching preview to 김태규 (mentor only): Mentoring visible (read-only), Foundation still hidden
  previewStudent = { id: MENTOR_ID, full_name: '김태규', class_name: '6반', status: 'approved' };
  syncAll();
  assert.equal(get('openMentoringBtn').hidden, false, 'mentor preview shows Mentoring');
  assert.equal(get('openFoundationBtn').hidden, true, 'non-owner mentor has no Foundation');
  location.hash = '#mentoring';
  fireHash();
  assert.equal(get('mentoringPage').hidden, false);
  assert.match(get('mentoringPage').innerHTML, /김태규 · 멘토 \(1조\)/);
  assert.match(get('mentoringPage').innerHTML, /읽기 전용/);
  assert.equal(storeCreated, 0, 'mentoring preview must not open IndexedDB store');

  // 4. Switching preview to 이은호: BOTH Mentoring (3조) AND Foundation visible & navigable!
  previewStudent = { id: OWNER_ID, full_name: '이은호', class_name: '6반', status: 'approved' };
  syncAll();
  assert.equal(get('openMentoringBtn').hidden, false);
  assert.equal(get('openFoundationBtn').hidden, false, '이은호 preview unlocks Foundation');
  location.hash = '#foundation';
  fireHash();
  assert.equal(get('foundationPage').hidden, false);
  assert.match(get('foundationPage').innerHTML, /REPORT zabap_f##_##\./);

  // 5. Switching from 이은호 on #foundation to regular student closes #foundation and resets hash
  previewStudent = { id: REGULAR_ID, full_name: '박민수', class_name: '6반', status: 'approved' };
  syncAll();
  assert.equal(get('openFoundationBtn').hidden, true);
  assert.equal(get('foundationPage').hidden, true);
  assert.equal(location.hash, '#doc/welcome-abap');

  // 6. Exiting preview hides everything cleanly
  previewMode = false;
  previewStudent = null;
  syncAll();
  assert.equal(get('openFoundationBtn').hidden, true);
  assert.equal(get('openMentoringBtn').hidden, true);
  assert.equal(get('studyWorkspace').hidden, true);
  assert.equal(storeCreated, 0);
  assert.equal(studyStoreCreated, 0);

  // 7. Static wiring in auth.js & admin-members.js
  const authJs = fs.readFileSync('js/auth.js', 'utf8');
  assert.match(authJs, /getAdminPreviewStudent/);
  assert.match(authJs, /setAdminPreviewRoster/);
  assert.match(authJs, /id="adminPreviewStudentSelect"/);
  const membersJs = fs.readFileSync('js/admin-members.js', 'utf8');
  assert.doesNotMatch(membersJs, /data-admin-preview/, 'global header preview button must be removed');
  assert.match(membersJs, /data-preview-student=/);
  assert.match(membersJs, /setAdminPreviewRoster/);

  console.log('PASS: per-student preview switching (regular / mentor / 이은호 Foundation), read-only study/mentoring protection, zero student RPC/IDB touches, static wiring');
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
