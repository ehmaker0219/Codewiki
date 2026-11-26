const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const storage = new Map();
const localStorage = {
  getItem: k => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: k => storage.delete(k)
};

const ctx = vm.createContext({
  window: {},
  localStorage
});
for (const file of ['js/learning-tools.js', 'js/sql-practice-bank.js', 'js/sql-practice.js']) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx);
}

const bank = ctx.window.CodeWikiSqlPracticeBank;
const engine = ctx.window.CodeWikiSqlPractice;
const byId = id => bank.problems.find(p => p.id === id);

assert.equal(bank.problems.length, 30, 'expected exactly 30 ABAP SQL practice problems');
assert.equal(new Set(bank.problems.map(p => p.id)).size, 30, 'problem IDs must be unique');
assert.equal(typeof ctx.window.WIKI_WIDGETS['abap-sql-practice'], 'function', 'widget must register on WIKI_WIDGETS');

// 1. Every problem's classic & new reference answers must pass 100% and return non-empty expected results.
for (const prob of bank.problems) {
  for (const tbl of prob.tables) assert.ok(bank.tables[tbl], `${prob.id}: unknown table ${tbl}`);
  assert.ok(prob.hints.length >= 1, `${prob.id}: missing hints`);
  assert.ok(prob.answers.new, `${prob.id}: missing new syntax answer`);

  const expected = engine.getExpectedResult(prob, bank.tables);
  assert.ok(expected.rows.length > 0, `${prob.id}: expected result must have at least 1 row`);

  const newRes = engine.grade(prob, prob.answers.new, bank);
  assert.equal(newRes.status, 'correct', `${prob.id} (new): ${newRes.title} — ${newRes.message}`);

  if (prob.syntax === 'either') {
    assert.ok(prob.answers.classic, `${prob.id}: dual-mode problem must provide classic answer`);
    const classicRes = engine.grade(prob, prob.answers.classic, bank);
    assert.equal(classicRes.status, 'correct', `${prob.id} (classic): ${classicRes.title} — ${classicRes.message}`);
  }
}

// 2. Verify key semantic edge cases in expected datasets.
const exp16 = engine.getExpectedResult(byId('sql-16'), bank.tables);
assert.ok(exp16.rows.some(r => r[0] === 'AZ' && r[2] === ''), 'sql-16 LEFT OUTER JOIN must keep AZ with empty CONNID');

const exp17 = engine.getExpectedResult(byId('sql-17'), bank.tables);
assert.equal(exp17.rows.length, 5, 'sql-17 must keep all 5 customers');
assert.ok(exp17.rows.some(r => r[0] === '00000004' && r[2] === 0), 'sql-17 customer with only cancelled booking must count 0');
assert.ok(exp17.rows.some(r => r[0] === '00000005' && r[2] === 0), 'sql-17 customer with no bookings must count 0');

const exp21 = engine.getExpectedResult(byId('sql-21'), bank.tables);
assert.ok(exp21.rows.some(r => r[0] === 'MAT-500' && r[2] === ''), 'sql-21 must keep MAT-500 without KO description');

const exp24 = engine.getExpectedResult(byId('sql-24'), bank.tables);
assert.deepEqual(Array.from(exp24.rows, r => r[0]), ['MAT-100', 'MAT-200', 'MAT-300', 'MAT-400'], 'sql-24 EXISTS must return 4 unique ordered materials');

const exp30 = engine.getExpectedResult(byId('sql-30'), bank.tables);
assert.equal(exp30.rows.length, 6, 'sql-30 must return all 6 materials');
assert.ok(exp30.rows.some(r => r[0] === 'MAT-500' && r[1] === '미등록' && r[2] === 0), 'sql-30 COALESCE must default MAT-500 to 미등록 and 0');
assert.ok(exp30.rows.some(r => r[0] === 'MAT-600' && r[1] === '제어 모듈' && r[2] === 0), 'sql-30 COALESCE must default MAT-600 sum to 0');

// 3. Verify diagnostics for common student mistakes.
assert.equal(engine.grade(byId('sql-01'), 'SELECT * FROM scarr INTO TABLE gt_scarr', bank).status, 'error', 'missing period rejected');

const wrongVar = engine.grade(byId('sql-02'), 'SELECT carrid carrname FROM scarr INTO TABLE gt_scarr.', bank);
assert.equal(wrongVar.status, 'error');
assert.match(wrongVar.message, /gt_carr/, 'wrong INTO variable suggests declared target');

const mixedStrict1 = engine.grade(byId('sql-02'), 'SELECT carrid, carrname FROM scarr INTO TABLE gt_carr.', bank);
assert.equal(mixedStrict1.status, 'error', 'comma without @ on INTO rejected as mixed Strict Mode');

const mixedStrict2 = engine.grade(byId('sql-03'), "SELECT * FROM scarr INTO TABLE @gt_eur WHERE currcode = 'EUR'.", bank);
assert.equal(mixedStrict2.status, 'error', 'INTO before WHERE with @ rejected as mixed Strict Mode');

const singleWithTable = engine.grade(byId('sql-10'), "SELECT SINGLE * FROM scarr INTO TABLE gt_scarr WHERE carrid = 'LH'.", bank);
assert.equal(singleWithTable.status, 'error');

const singleWithOrder = engine.grade(byId('sql-10'), "SELECT SINGLE * FROM scarr WHERE carrid = 'LH' ORDER BY carrid INTO @gs_scarr.", bank);
assert.equal(singleWithOrder.status, 'error');

const wrongOrder = engine.grade(byId('sql-09'), 'SELECT carrid, connid, fltime FROM spfli ORDER BY fltime ASCENDING, carrid ASCENDING INTO TABLE @gt_sorted.', bank);
assert.equal(wrongOrder.status, 'mismatch');
assert.match(wrongOrder.title, /정렬 순서/, 'wrong ORDER BY direction diagnosed');

const whereInsteadOfOn = engine.grade(byId('sql-21'), "SELECT a~matnr, a~mtart, b~maktx FROM mara AS a LEFT OUTER JOIN makt AS b ON a~matnr = b~matnr WHERE b~spras = 'KO' ORDER BY a~matnr INTO TABLE @gt_mat_all.", bank);
assert.equal(whereInsteadOfOn.status, 'mismatch');
assert.equal(whereInsteadOfOn.actual.rows.length, 5, 'WHERE filter drops MAT-500 and triggers row-count mismatch');

const colDiff = engine.grade(byId('sql-02'), 'SELECT carrid, currcode FROM scarr INTO TABLE @gt_carr.', bank);
assert.equal(colDiff.status, 'mismatch');
assert.match(colDiff.message, /CARRNAME/, 'column diff pinpoints mismatched column');

const correspondingOk = engine.grade(byId('sql-02'), 'SELECT carrname, carrid FROM scarr INTO CORRESPONDING FIELDS OF TABLE @gt_carr.', bank);
assert.equal(correspondingOk.status, 'correct', 'INTO CORRESPONDING FIELDS OF maps reversed columns by name');

const classicOnNewOnly = engine.grade(byId('sql-25'), 'SELECT carrid connid cityto FROM spfli INTO TABLE gt_lh WHERE carrid = p_carr ORDER BY connid.', bank);
assert.equal(classicOnNewOnly.status, 'error', 'classic syntax rejected on new-only problem');

const missingInline = engine.grade(byId('sql-26'), 'SELECT carrid, connid, fldate, price FROM sflight WHERE carrid = @p_carr ORDER BY fldate INTO TABLE @gt_flights.', bank);
assert.equal(missingInline.status, 'error', 'non-inline target rejected when @DATA(...) required');

const missingAlias = engine.grade(byId('sql-28'), "SELECT connid, fldate, ( seatsmax - seatsocc ) FROM sflight WHERE carrid = 'LH' ORDER BY fldate INTO TABLE @DATA(gt_free).", bank);
assert.equal(missingAlias.status, 'error', 'expression without AS alias rejected for @DATA(...)');

const wrongAlias = engine.grade(byId('sql-28'), "SELECT connid, fldate, ( seatsmax - seatsocc ) AS free_cnt FROM sflight WHERE carrid = 'LH' ORDER BY fldate INTO TABLE @DATA(gt_free).", bank);
assert.equal(wrongAlias.status, 'mismatch', 'wrong AS alias diagnosed on inline problem');

// 4. Verify XSS safety in ABAP syntax highlighting.
const hl = engine.highlightAbap("SELECT '<img onerror=alert(1)>' FROM scarr.");
assert.ok(!hl.includes('<img'), 'highlightAbap must escape raw HTML');
assert.ok(hl.includes('&lt;img'), 'highlightAbap preserves escaped angle brackets');

// 5. Verify mount, per-account progress isolation, and UI interactions.
function makeSlot() {
  const events = {};
  const editor = { id: 'sqlpEditor', value: '', scrollTop: 0, scrollLeft: 0, focus() {} };
  const layer = { innerHTML: '', scrollTop: 0, scrollLeft: 0 };
  const gutter = { textContent: '', scrollTop: 0 };
  return {
    isConnected: true,
    innerHTML: '',
    events,
    editor,
    addEventListener(k, fn) { events[k] = fn; },
    querySelector(sel) {
      if (sel === '#sqlpEditor') return editor;
      if (sel === '#sqlpHighlightLayer') return layer;
      if (sel === '#sqlpGutter') return gutter;
      return null;
    }
  };
}

const slot = makeSlot();
engine.setUser({ id: 'stu-a', role: 'student', status: 'approved' });
engine.mount(slot);
assert.ok(slot.innerHTML.includes('SCARR'), 'initial problem renders SCARR table');
assert.ok(slot.innerHTML.includes('푼 문제 <strong>0</strong> / 30'));

// Grade problem 01 with correct SQL and verify per-user persistence.
slot.editor.value = byId('sql-01').answers.new;
slot.events.input({ target: slot.editor });
slot.events.click({ target: { closest: sel => (sel === '[data-sqlp-grade]' ? {} : null) } });
assert.ok(slot.innerHTML.includes('정답이에요!'), 'correct submission renders success feedback');
assert.ok(slot.innerHTML.includes('푼 문제 <strong>1</strong> / 30'));
assert.deepEqual(JSON.parse(storage.get('codewiki_sql_practice_v1:stu-a')), ['sql-01']);

// Switching to another student isolates solved progress; returning restores stu-a progress.
engine.setUser({ id: 'stu-b', role: 'student', status: 'approved' });
assert.ok(slot.innerHTML.includes('푼 문제 <strong>0</strong> / 30'), 'different student starts with 0 solved');
engine.setUser(null);
assert.ok(slot.innerHTML.includes('푼 문제 <strong>0</strong> / 30'), 'logout clears active solved state');
engine.setUser({ id: 'stu-a', role: 'student', status: 'approved' });
assert.ok(slot.innerHTML.includes('푼 문제 <strong>1</strong> / 30'), 'original student progress restored');

console.log('PASS: 30 ABAP SQL problems (classic + new), Strict Mode checks, JOIN/COALESCE/EXISTS/CASE grading, diagnostics, XSS escaping and per-user state');
