const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync(name, 'utf8');

// 1. Board state never survives an account switch, logout or loss of approval.
(() => {
  const elements = new Map();
  const element = () => {
    const classes = new Set();
    return {innerHTML:'', textContent:'', classList:{add:c=>classes.add(c), remove:c=>classes.delete(c), contains:c=>classes.has(c)},
      addEventListener(){}, querySelectorAll(){return [];}, querySelector(){return null;}};
  };
  const get = id => elements.get(id) || (elements.set(id, element()), elements.get(id));
  const opened = [];
  const context = {window:{CodeWikiAuth:{isSupabaseConfigured:()=>true, getSessionToken:()=>'t', getCurrentUser:()=>null,
      getSupabaseClient:()=>({rpc:async()=>({data:[]})})},
    CodeWikiApp:{openDoc:id=>opened.push(id), getCurrentDocId:()=>'abap-basics'}},
    document:{getElementById:get, querySelector:get, querySelectorAll:()=>[]}, console};
  vm.runInNewContext(read('js/board.js'), context);
  const board = context.window.CodeWikiBoard;
  const admin = {id:'a', role:'admin', status:'approved'}, student = {id:'s', role:'student', status:'approved'};
  board.setUser(admin);
  get('boardWriteModal').innerHTML = 'unsent admin reply';
  board.setUser({...admin});
  assert.equal(get('boardWriteModal').innerHTML, 'unsent admin reply', 'refreshing the same user keeps the modal');
  board.setUser(student);
  assert.equal(get('boardWriteModal').innerHTML, '', 'switching account clears the hidden modal');
  get('boardWriteModal').innerHTML = 'student draft';
  board.setUser({...student, status:'pending'});
  assert.equal(get('boardWriteModal').innerHTML, '', 'losing approval resets board state');
  board.setUser(student);
  return board.openBoardView().then(() => {
    get('articleContainer').innerHTML = '<button>admin action</button>';
    board.setUser(null);
    assert.equal(get('articleContainer').innerHTML, '', 'logout removes the rendered board');
    assert.deepEqual(opened, ['abap-basics'], 'the current document is rendered again');
  });
})().then(() => {
  // 2. Admin workspace hides knowledge map, practice, and the empty primary learning nav section.
  const css = read('css/style.css');
  const hiddenForAdmin = css.match(/((?:\.admin-workspace #[\w-]+,\s*)*\.admin-workspace #[\w-]+)\s*\{\s*display:none;\s*\}/g) || [];
  assert.ok(
    hiddenForAdmin.some(rule => rule.includes('#openPracticeBtn') && rule.includes('#openKnowledgeMapBtn') && rule.includes('#primaryNavSection')),
    'admin CSS must hide knowledge map, practice, and primary learning nav'
  );

  // 3. The disabled UI5 track is not loaded on startup.
  assert.ok(!/src="js\/ui5-data\.js/.test(read('index.html')), 'ui5-data.js must not load at startup');

  // 4. Navigation renders once: a hash change defers to the hashchange handler, and admin redirects from student home / student-only docs.
  const app = read('js/app.js');
  const slice = app.slice(app.indexOf('  // When the hash changes, render once'), app.indexOf('  window.CodeWikiApp = {'));
  const renders = [];
  let adminHomeCalls = 0, currentRole = 'student';
  const scrolled = [], appliedViews = [];
  const targetSection = { hidden: true, dataset: { sectionTab: 'l2' }, offsetWidth: 1,
    classList: { add(c){ this.added = c; }, remove(){} }, scrollIntoView(opts){ scrolled.push(opts); } };
  const nav = {window:{location:{hash:'#study'}, WIKI_DOCS:{'abap-basics':{}, 'welcome-abap':{isHome:true}, 'abap-thinking-flow':{studentOnly:true}}, scrollTo(){},
      CodeWikiAuth:{getCurrentUser:()=>({role:currentRole})}, CodeWikiAdminMembers:{openHome(){adminHomeCalls++;}}},
    document:{getElementById:id=>id==='sec-3'?targetSection:null, querySelectorAll:()=>[]},
    articleContainer:{_applyDocView(tab, mode){ appliedViews.push([tab, mode]); if (tab === 'l2') targetSection.hidden = false; }, querySelector:()=>({hidden:false})},
    currentDocId:'abap-basics', history:{replaceState(_a,_b,h){ nav.window.location.hash = h; }},
    getHomeDocId:()=>'welcome-abap', renderDocument:id=>renders.push(id), sessionStorage:{setItem(){}}, TRACK_SESSION_KEY:'k', currentTrack:'abap'};
  vm.runInNewContext(slice + '\nwindow.navigateTo = navigateTo; window.isDocAccessible = isDocAccessible; window.pending = () => pendingNavigation; window.consumeSection = consumePendingSection;', nav);
  nav.window.navigateTo('abap-basics');
  assert.equal(nav.window.location.hash, '#doc/abap-basics');
  assert.deepEqual(renders, [], 'a hash change must not also render synchronously');
  assert.equal(nav.window.pending(), 'abap-basics');
  nav.window.navigateTo('abap-basics');
  assert.deepEqual(renders, ['abap-basics'], 'same-hash navigation renders immediately');
  nav.window.navigateTo('abap-basics', 'l2', null, 'sec-3');
  assert.deepEqual(appliedViews, [['l2', null]], 'hidden target section activates its tab before scrolling');
  assert.equal(scrolled.length, 1, 'same-doc section jump scrolls directly to target section');
  assert.equal(targetSection.classList.added, 'search-jump-highlight', 'target section receives jump highlight');
  currentRole = 'admin';
  assert.equal(nav.window.isDocAccessible(nav.window.WIKI_DOCS['welcome-abap']), false, 'student home must not be accessible to admin');
  assert.equal(nav.window.isDocAccessible(nav.window.WIKI_DOCS['abap-thinking-flow']), false, 'studentOnly docs must not be accessible to admin');
  nav.window.navigateTo('welcome-abap');
  assert.equal(adminHomeCalls, 1, 'admin navigating to student home redirects to admin home');

  // 5. Legacy mentoring records without updatedAt can still be listed.
  const store = read('js/mentoring-store.js');
  assert.match(store, /String\(b\?\.updatedAt\|\|''\)\.localeCompare\(String\(a\?\.updatedAt\|\|''\)\)/);

  // 6. Quiz blanks are keyboard operable.
  assert.match(app, /class="quiz-token"[^>]*tabindex="0" role="button"/);
  console.log('PASS: board account-switch reset, admin practice access, no UI5 startup load, single navigation render, legacy sort and keyboard quiz blanks');
}).catch(error => { console.error(error); process.exitCode = 1; });
