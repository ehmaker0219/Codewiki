const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeNode(id = '') {
  const classes = new Set(id === 'siteNoticeModal' ? ['admin-modal-backdrop', 'hidden'] : []);
  const listeners = new Map();
  let focused = false;
  const node = {
    id,
    innerHTML: '',
    onclick: null,
    classList: {
      add: (...names) => names.forEach(n => classes.add(n)),
      remove: (...names) => names.forEach(n => classes.delete(n)),
      contains: name => classes.has(name)
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    click() {
      for (const fn of listeners.get('click') || []) fn({ target: node, preventDefault() {} });
      if (typeof node.onclick === 'function') node.onclick({ target: node });
    },
    focus() { focused = true; },
    isFocused: () => focused
  };
  return node;
}

function createHarness(storageImpl) {
  const modal = makeNode('siteNoticeModal');
  let closeBtn = null;
  let confirmBtn = null;
  const docListeners = new Map();
  const prevFocus = makeNode('prevFocus');
  const document = {
    activeElement: prevFocus,
    getElementById(id) {
      if (id === 'siteNoticeModal') return modal;
      if (id === 'siteNoticeCloseBtn') return closeBtn;
      if (id === 'siteNoticeConfirmBtn') return confirmBtn;
      return null;
    },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, new Set());
      docListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      docListeners.get(type)?.delete(fn);
    },
    dispatchKey(key) {
      let prevented = false;
      for (const fn of [...(docListeners.get('keydown') || [])]) {
        fn({ key, preventDefault() { prevented = true; } });
      }
      return prevented;
    },
    keydownCount: () => (docListeners.get('keydown')?.size || 0)
  };
  Object.defineProperty(modal, 'innerHTML', {
    get() { return this._html || ''; },
    set(val) {
      this._html = String(val);
      closeBtn = this._html.includes('siteNoticeCloseBtn') ? makeNode('siteNoticeCloseBtn') : null;
      confirmBtn = this._html.includes('siteNoticeConfirmBtn') ? makeNode('siteNoticeConfirmBtn') : null;
    }
  });
  const store = new Map();
  const localStorage = storageImpl || {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); }
  };
  const window = { document, localStorage };
  const ctx = vm.createContext({ window, document, localStorage });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'notice.js'), 'utf8'), ctx, { filename: 'js/notice.js' });
  return {
    notice: ctx.window.CodeWikiNotice,
    modal,
    document,
    prevFocus,
    store,
    getConfirmBtn: () => confirmBtn,
    getCloseBtn: () => closeBtn
  };
}

// 1. Approved student sees notice once; confirm marks seen and suppresses repeats.
{
  const h = createHarness();
  const studentA = { id: 'stu-1', role: 'student', status: 'approved' };
  const studentB = { id: 'stu-2', role: 'student', status: 'approved' };
  const admin = { id: 'adm-1', role: 'admin', status: 'approved' };
  const pending = { id: 'stu-3', role: 'student', status: 'pending' };

  assert.equal(h.notice.maybeShow(admin), false, 'admin must never see student notice');
  assert.equal(h.notice.maybeShow(pending), false, 'pending student must not see notice');
  assert.equal(h.modal.classList.contains('hidden'), true);

  assert.equal(h.notice.maybeShow(studentA), true, 'approved student sees notice on first entry');
  assert.equal(h.modal.classList.contains('hidden'), false);
  assert.ok(h.modal.innerHTML.includes('Basic Session Review'), 'notice mentions Basic Session Review update');
  assert.ok(h.modal.innerHTML.includes('ZPROG_CL5_T14_005'), 'notice mentions official instructor solution');
  assert.ok(h.modal.innerHTML.includes('월요일 시험공부 화이팅'), 'notice includes exam cheer');
  assert.equal(h.document.keydownCount(), 1, 'single Escape listener attached');
  assert.equal(h.getConfirmBtn().isFocused(), true, 'confirm button receives focus');

  // Calling maybeShow again while open is a no-op (no duplicate listeners).
  assert.equal(h.notice.maybeShow(studentA), true);
  assert.equal(h.document.keydownCount(), 1);

  h.getConfirmBtn().click();
  assert.equal(h.modal.classList.contains('hidden'), true);
  assert.equal(h.document.keydownCount(), 0, 'Escape listener cleaned up on close');
  assert.equal(h.prevFocus.isFocused(), true, 'previous focus restored');

  // Re-login as studentA never shows it again; studentB still sees it once.
  assert.equal(h.notice.maybeShow(studentA), false, 'studentA does not see notice a second time');
  assert.equal(h.notice.maybeShow(studentB), true, 'different student sees notice once');
  assert.equal(h.document.dispatchKey('Escape'), true, 'Escape dismisses notice');
  assert.equal(h.modal.classList.contains('hidden'), true);
  assert.equal(h.notice.maybeShow(studentB), false, 'Escape marks notice seen');
}

// 2. Logout closes an open notice without marking it seen.
{
  const h = createHarness();
  const student = { id: 'stu-logout', role: 'student', status: 'approved' };
  assert.equal(h.notice.maybeShow(student), true);
  h.notice.setUser(null);
  assert.equal(h.modal.classList.contains('hidden'), true);
  assert.equal(h.document.keydownCount(), 0);
  assert.equal(h.notice.maybeShow(student), true, 're-login after undismissed logout still shows notice');
  h.modal.onclick({ target: h.modal });
  assert.equal(h.modal.classList.contains('hidden'), true);
  assert.equal(h.notice.maybeShow(student), false, 'backdrop dismiss marks notice seen');
}

// 3. Throwing storage degrades safely to in-memory once-per-session suppression.
{
  const brokenStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); }
  };
  const h = createHarness(brokenStorage);
  const student = { id: 'stu-priv', role: 'student', status: 'approved' };
  assert.equal(h.notice.maybeShow(student), true);
  h.getCloseBtn().click();
  assert.equal(h.notice.maybeShow(student), false);
}

// 4. Static wiring checks across index.html and auth.js.
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.ok(indexHtml.includes('id="siteNoticeModal"'), 'index.html mounts notice modal');
assert.ok(indexHtml.indexOf('js/notice.js') > 0 && indexHtml.indexOf('js/notice.js') < indexHtml.indexOf('js/auth.js'),
  'notice.js loads before auth.js');
const authJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth.js'), 'utf8');
assert.ok(authJs.includes('CodeWikiNotice?.setUser?.(user)'), 'auth.js propagates logout/user changes to notice');
assert.ok(authJs.includes('CodeWikiNotice?.maybeShow?.(user'), 'auth.js triggers notice on workspace entry');

console.log('PASS: one-time student login notice, per-account persistence, role gating, Escape/backdrop/logout cleanup and storage fallback');
