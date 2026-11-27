const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('js/auth.js','utf8');
const key = 'codewiki_supa_token_v1';
function boot(storage, rpc) {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) {
      const classes = new Set();
      nodes.set(id, {innerHTML:'', events:{},
        classList:{add(...n){n.forEach(c=>classes.add(c));},remove(...n){n.forEach(c=>classes.delete(c));},contains:c=>classes.has(c)},
        addEventListener(name,fn){this.events[name]=fn;},querySelectorAll:()=>[]});
    }
    return nodes.get(id);
  };
  const timers=new Map();let timerId=0;
  let noticeShownFor = null;
  let readyEvents = 0;
  const context = {window:{location:{hash:'#study'},supabase:{createClient:(url,key,options)=>{assert.equal(typeof options.accessToken,'function');return {rpc};}},scrollTo(){},
      CodeWikiNotice:{maybeShow(u){noticeShownFor=u?.id||null;}},
      dispatchEvent(ev){if(ev?.type==='cw-workspace-ready')readyEvents++;}},
    Event: class Event { constructor(type){ this.type = type; } },
    AbortController,setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
    document:{getElementById:get,body:get('body')},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
  vm.runInNewContext(source.replace(/  renderAuthState\(\);\s*\}\)\(\);\s*$/,
    '  renderPreLoginLanding = () => {}; window.refresh = renderAuthState;\n})();'),context);
  return {...context,get,timers,getNoticeShownFor:()=>noticeShownFor,getReadyEvents:()=>readyEvents};
}
(async()=>{
  const saved = new Map([[key,'saved-session']]);
  const profile = {id:'student',role:'student',status:'approved',full_name:'Test'};
  let mode = 'valid';
  const rpc = async (name,args) => {
    assert.equal(name,'cw_me'); assert.equal(args.p_token,'saved-session');
    if (mode==='throw') throw new Error('offline');
    if (mode==='error') return {error:{message:'network error'}};
    return {data:mode==='expired'?null:profile};
  };
  let app = boot(saved,rpc);
  await app.window.refresh();
  assert.equal(app.window.CodeWikiAuth.getCurrentUser().id,'student');
  assert.equal(app.get('body').classList.contains('authenticated'),true,'approved student enters workspace directly');
  assert.equal(app.get('body').classList.contains('track-selecting'),false,'retired track-selection gate must not activate');
  assert.equal(app.get('authGateOverlay').classList.contains('hidden'),true);
  assert.equal(app.getNoticeShownFor(),'student','login notice runs immediately without a track gate');
  assert.equal(app.getReadyEvents(),1,'workspace-ready event fires for deferred runtime modals');
  assert.equal(app.get('learningContentsGroup').hidden,false);
  assert.equal(app.get('sbThinkingFlowItem').hidden,false);
  assert.equal(app.get('sbProgramCatalogItem').hidden,false);
  assert.equal(app.get('sbBasicSessionItem').hidden,false);
  assert.equal(app.get('sbSqlGuideItem').hidden,false);
  assert.match(app.get('studySidebarSlot').innerHTML,/id="openStudyBtn"/);
  assert.ok(!app.get('adminSidebarSlot').innerHTML.includes('id="openAdminModalBtn"'),'student does not receive admin controls');
  profile.role='admin';await app.window.refresh();
  assert.equal(app.get('learningContentsGroup').hidden,true);
  assert.equal(app.get('sbThinkingFlowItem').hidden,true,'thinking flow stays student-only');
  assert.equal(app.get('sbProgramCatalogItem').hidden,true,'program catalog stays student-only');
  assert.equal(app.get('sbBasicSessionItem').hidden,true,'Basic Session Review stays student-only');
  assert.equal(app.get('sbSqlGuideItem').hidden,true,'ABAP SQL guide stays student-only');
  assert.ok(!app.get('studySidebarSlot').innerHTML.includes('id="openStudyBtn"'),'admin study menu is retired');
  assert.match(app.get('adminSidebarSlot').innerHTML,/id="openAdminModalBtn"/);
  profile.role='student';
  app = boot(saved,rpc); // New page/browser session using persisted storage.
  await app.window.refresh();
  assert.equal(app.window.CodeWikiAuth.getCurrentUser().id,'student');
  for (mode of ['error','throw']) {
    await app.window.refresh();
    assert.equal(saved.get(key),'saved-session');
    assert.equal(app.window.CodeWikiAuth.getCurrentUser(),null,'do not grant offline access');
    assert.match(app.get('authGateOverlay').innerHTML,/다시 시도/);
  }
  mode='valid'; await app.window.refresh();
  assert.equal(app.window.CodeWikiAuth.getCurrentUser().id,'student');
  mode='expired'; await app.window.refresh();
  assert.equal(saved.has(key),false);
  assert.equal(app.window.CodeWikiAuth.getCurrentUser(),null);
  let resolveLate;
  const hanging=boot(new Map([[key,'saved-session']]),()=>new Promise(resolve=>resolveLate=resolve));
  const pending=hanging.window.refresh();
  assert.match(hanging.get('authGateOverlay').innerHTML,/로그인 확인 중/,'pending authentication must render a visible screen');
  [...hanging.timers.values()][0]();await pending;
  assert.match(hanging.get('authGateOverlay').innerHTML,/다시 시도/,'unresponsive authentication offers retry');
  assert.equal(hanging.localStorage.getItem(key),'saved-session','timeout preserves session and private drafts');
  resolveLate({data:profile});await Promise.resolve();
  assert.equal(hanging.window.CodeWikiAuth.getCurrentUser(),null,'late timed-out response cannot restore access');
  console.log('PASS: session restore, visible pending screen, timeout/retry, token retention, expiry and unused Auth isolation');
})().catch(error=>{console.error(error);process.exitCode=1;});
