const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const OWNER_ID = '2eafc83d-09cd-4ea6-98a8-9bbb1ebdeb06';
const ADMIN_ID = 'a56f9325-c658-4be4-893a-4b2c1fd0a1f5';

function makeClassList(initial = []) {
  const set = new Set(initial);
  return {
    add: (...cls) => cls.forEach(c => set.add(c)),
    remove: (...cls) => cls.forEach(c => set.delete(c)),
    toggle: (c, force) => {
      const next = force === undefined ? !set.has(c) : Boolean(force);
      if (next) set.add(c);
      else set.delete(c);
      return next;
    },
    contains: c => set.has(c)
  };
}

function makeElement(id = '') {
  return {
    id,
    hidden: id === 'foundationPage' || id === 'openFoundationBtn',
    innerHTML: '',
    textContent: '',
    dataset: {},
    style: {},
    events: {},
    classList: makeClassList(),
    addEventListener(type, fn) { this.events[type] = fn; },
    replaceChildren() { this.innerHTML = ''; this.textContent = ''; },
    querySelector(sel) {
      if (sel === '#foundationCopyStatus') return this._statusEl ??= makeElement('foundationCopyStatus');
      return null;
    },
    querySelectorAll() { return []; },
    remove() {}
  };
}

function createHarness(initialHash = '#doc/welcome-abap') {
  const nodes = {
    foundationPage: makeElement('foundationPage'),
    openFoundationBtn: makeElement('openFoundationBtn'),
    appShell: makeElement('appShell'),
    quizModeBtn: makeElement('quizModeBtn')
  };
  const winEvents = {};
  const location = { hash: initialHash };
  let sessionToken = 'valid-token';
  const copied = [];
  const peerLeaves = [];

  const ctx = vm.createContext({
    history: {
      replaceState(_s, _t, hash) { location.hash = hash; }
    },
    navigator: {
      clipboard: {
        writeText: async text => { copied.push(text); }
      }
    },
    window: {
      location,
      scrollTo() {},
      addEventListener(type, fn) { winEvents[type] = fn; },
      CodeWikiAuth: {
        getCurrentUser: () => null,
        getSessionToken: () => sessionToken
      },
      CodeWikiApp: {
        getCurrentDocId: () => 'welcome-abap',
        renderEditorCode: raw => String(raw).split('\n').map((line, i) =>
          `<span class="sap-code-line"><span class="sap-code-number" aria-hidden="true">${i + 1}</span><span class="sap-code-source">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span></span>`
        ).join('\n')
      },
      CodeWikiBoard: { closeIfActive() { peerLeaves.push('board'); } },
      CodeWikiAdminMembers: { leave() { peerLeaves.push('admin'); } },
      CodeWikiStudy: { leave() { peerLeaves.push('study'); } },
      CodeWikiMentoring: { leave() { peerLeaves.push('mentoring'); } },
      CodeWikiObjectGame: { leave() { peerLeaves.push('object-game'); } },
      CodeWikiKnowledgeMap: { leave() { peerLeaves.push('map'); } }
    },
    document: {
      getElementById: id => nodes[id] || null,
      querySelectorAll: () => [],
      createElement: () => makeElement()
    },
    setTimeout,
    clearTimeout
  });

  vm.runInContext(fs.readFileSync('js/foundation.js', 'utf8'), ctx);
  return {
    api: ctx.window.CodeWikiFoundation,
    nodes,
    location,
    copied,
    peerLeaves,
    fireHashchange: () => winEvents.hashchange?.(),
    setToken: next => { sessionToken = next; }
  };
}

(async () => {
  // 1. Strict owner-only gating
  const h = createHarness('#doc/welcome-abap');
  assert.equal(h.api.OWNER_ID, OWNER_ID);
  assert.equal(h.nodes.openFoundationBtn.hidden, true);
  assert.equal(h.nodes.foundationPage.hidden, true);

  const deniedUsers = [
    null,
    { id: OWNER_ID, role: 'student', status: 'pending' },
    { id: OWNER_ID, role: 'admin', status: 'approved' },
    { id: ADMIN_ID, role: 'admin', status: 'approved' },
    { id: '00000000-0000-4000-8000-000000000099', role: 'student', status: 'approved', full_name: '다른학생' }
  ];
  for (const user of deniedUsers) {
    h.api.setUser(user);
    assert.equal(h.nodes.openFoundationBtn.hidden, true);
    assert.equal(h.nodes.foundationPage.hidden, true);
    assert.equal(h.nodes.appShell.classList.contains('foundation-hidden'), false);
    h.location.hash = '#foundation';
    h.fireHashchange();
    assert.equal(h.nodes.foundationPage.hidden, true);
    assert.equal(h.nodes.foundationPage.innerHTML, '');
  }

  // Missing token must fail closed even for owner
  h.setToken('');
  h.api.setUser({ id: OWNER_ID, role: 'student', status: 'approved', full_name: '이은호' });
  assert.equal(h.nodes.openFoundationBtn.hidden, true);
  assert.equal(h.nodes.foundationPage.hidden, true);

  // Valid owner session unlocks sidebar button and #foundation page
  h.setToken('live-owner-token');
  h.location.hash = '#doc/welcome-abap';
  h.api.setUser({ id: OWNER_ID, role: 'student', status: 'approved', full_name: '이은호' });
  assert.equal(h.nodes.openFoundationBtn.hidden, false);
  assert.equal(h.nodes.foundationPage.hidden, true);

  h.nodes.openFoundationBtn.events.click();
  assert.equal(h.location.hash, '#foundation');
  h.fireHashchange();
  assert.equal(h.nodes.foundationPage.hidden, false);
  assert.equal(h.nodes.appShell.classList.contains('foundation-hidden'), true);
  assert.equal(h.nodes.openFoundationBtn.classList.contains('active'), true);
  assert.deepEqual(h.peerLeaves, ['board', 'admin', 'study', 'mentoring', 'object-game', 'map']);
  assert.match(h.nodes.foundationPage.innerHTML, /파운데이션/);
  assert.match(h.nodes.foundationPage.innerHTML, /REPORT zabap_f##_##\./);

  // 2. Template integrity (CL_SALV_TABLE & CL_DEMO_OUTPUT modes) & 9-part split
  const tpl = h.api.getTemplate('salv');
  const demoTpl = h.api.getTemplate('demo');
  assert.ok(tpl.startsWith('*&---------------------------------------------------------------------*\n*& Report ZABAP_F##_##'));
  assert.ok(tpl.endsWith('    CATCH cx_salv_msg.\n  ENDTRY.\nENDFORM.'));
  assert.match(tpl, /PERFORM display_salv CHANGING gt_output\./);
  assert.match(tpl, /FORM display_demo USING pt_output TYPE tt_output\./);
  assert.match(tpl, /CALL METHOD cl_demo_output=>display/);
  assert.match(demoTpl, /PERFORM display_demo USING gt_output\./);
  assert.match(demoTpl, /FORM display_demo USING pt_output TYPE tt_output\./);

  const parts = h.api.getParts('salv');
  assert.equal(parts.length, 10, 'header + 9 numbered parts');
  assert.deepEqual(Array.from(parts, p => p.num), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(parts.map(p => p.code).join('\n'), tpl, 're-joined parts must equal full template byte-for-byte');
  assert.equal(h.api.getParts('demo').map(p => p.code).join('\n'), demoTpl, 're-joined demo parts must equal demo template');

  // Switching output mode to CL_DEMO_OUTPUT updates full copy payload
  const fakeModeBtn = makeElement('demoMode');
  fakeModeBtn.dataset.outputMode = 'demo';
  h.nodes.foundationPage.events.click({
    target: { closest: sel => sel === '[data-output-mode]' ? fakeModeBtn : null }
  });
  assert.match(h.nodes.foundationPage.innerHTML, /CL_DEMO_OUTPUT 출력/);

  // 3. Copy full (CL_DEMO_OUTPUT mode) & part actions + tab switching
  const fakeCopyBtn = makeElement('copyFull');
  fakeCopyBtn.dataset.copyTarget = 'full';
  h.nodes.foundationPage.events.click({
    target: { closest: sel => sel === '[data-copy-target]' ? fakeCopyBtn : null }
  });
  await Promise.resolve();
  assert.equal(h.copied[0], demoTpl);

  const fakeTabBtn = makeElement('partsTab');
  fakeTabBtn.dataset.foundationTab = 'parts';
  h.nodes.foundationPage.events.click({
    target: { closest: sel => sel === '[data-foundation-tab]' ? fakeTabBtn : null }
  });
  assert.match(h.nodes.foundationPage.innerHTML, /PART 01/);
  assert.match(h.nodes.foundationPage.innerHTML, /PART 09/);

  const fakePartCopyBtn = makeElement('copyPart4');
  fakePartCopyBtn.dataset.copyTarget = 'part-4';
  h.nodes.foundationPage.events.click({
    target: { closest: sel => sel === '[data-copy-target]' ? fakePartCopyBtn : null }
  });
  await Promise.resolve();
  assert.ok(h.copied[1].includes('SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-001.'));

  // 4. Leave & logout cleanup
  h.api.leave();
  assert.equal(h.nodes.foundationPage.hidden, true);
  assert.equal(h.nodes.appShell.classList.contains('foundation-hidden'), false);
  assert.equal(h.location.hash, '#doc/welcome-abap');

  // 5. Deep-link reload preservation for owner vs cleanup for non-owner
  const reloadHarness = createHarness('#foundation');
  assert.equal(reloadHarness.location.hash, '#foundation', 'initial null user preserves deep-link hash');
  reloadHarness.api.setUser({ id: OWNER_ID, role: 'student', status: 'approved', full_name: '이은호' });
  assert.equal(reloadHarness.nodes.foundationPage.hidden, false);
  assert.equal(reloadHarness.location.hash, '#foundation');

  const nonOwnerReload = createHarness('#foundation');
  nonOwnerReload.api.setUser({ id: '00000000-0000-4000-8000-000000000088', role: 'student', status: 'approved' });
  assert.equal(nonOwnerReload.nodes.foundationPage.hidden, true);
  assert.equal(nonOwnerReload.location.hash, '#doc/welcome-abap');

  // 6. Static wiring checks
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="openFoundationBtn"[^>]*hidden/);
  assert.match(html, /id="foundationPage"[^>]*hidden/);
  assert.match(html, /src="js\/foundation\.js(?:\?v=[^"]+)?"/);

  const authJs = fs.readFileSync('js/auth.js', 'utf8');
  assert.match(authJs, /CodeWikiFoundation\?\.setUser\?\.\(user\)/);

  const appJs = fs.readFileSync('js/app.js', 'utf8');
  assert.match(appJs, /"#foundation"/);
  assert.match(appJs, /foundation-hidden/);
  assert.match(appJs, /CodeWikiFoundation\?\.leave\?\.\(\)/);
  assert.match(appJs, /renderEditorCode,/);

  const telemetryJs = fs.readFileSync('js/telemetry.js', 'utf8');
  assert.match(telemetryJs, /h === '#foundation'/);

  console.log('PASS: owner-only Foundation gating, verbatim 342-line template, 9-part split, clipboard copy, reload flow, static wiring');
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
