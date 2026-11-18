const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('js/auth.js','utf8');
const key = 'codewiki_supa_token_v1';
function boot(storage, rpc) {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, {innerHTML:'', events:{}, classList:{add(){},remove(){}},
      addEventListener(name,fn){this.events[name]=fn;},querySelectorAll:()=>[]});
    return nodes.get(id);
  };
  const context = {window:{supabase:{createClient:()=>({rpc})},scrollTo(){},CodeWikiApp:{hasSelectedTrack:()=>true}},
    document:{getElementById:get,body:get('body')},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
  vm.runInNewContext(source.replace(/  renderAuthState\(\);\s*\}\)\(\);\s*$/,
    '  renderPreLoginLanding = () => {}; window.refresh = renderAuthState;\n})();'),context);
  return {...context,get};
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
  console.log('PASS: session restore across reloads, network failure retention, retry, expiry');
})().catch(error=>{console.error(error);process.exitCode=1;});
