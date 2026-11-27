const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const element = () => ({ innerHTML: '', textContent: '', classList: {add(){}, remove(){}},
  addEventListener(){}, querySelectorAll(){return [];} });

async function boardTest() {
  const elements = new Map();
  const get = id => elements.get(id) || (elements.set(id, element()), elements.get(id));
  const posts = [];
  const context = { window: {CodeWikiAuth: {
    isSupabaseConfigured: () => true, getSessionToken: () => 'test-token',
    getCurrentUser: () => ({id:'student', role:'student'}),
    getSupabaseClient: () => ({rpc: async () => ({data:posts})})
  }}, document: {getElementById:get, querySelector:get, querySelectorAll:()=>[]}, console };
  vm.runInNewContext(source('js/board.js'), context);
  const payloads = ['"><img src=x onerror=alert(1)>', '</a><svg onload=alert(1)>', '&quot; onmouseover=alert(1) x="'];
  for (const payload of [...payloads, 'abap-intro']) {
    posts[0] = {id:1, status:'open', category:'질문·기타', target_doc_id:payload,
      target_doc_title:payload, title:'Normal title', content:'Normal content', author_name:'Student', created_at:'2026-11-17'};
    await context.window.CodeWikiBoard.openBoardView();
    const html = get('articleContainer').innerHTML;
    const escaped = payload.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    assert.ok(html.includes(`data-jump-doc="${escaped}"`));
    assert.ok(html.includes(`📄 ${escaped}`));
    assert.ok(!html.includes('<img') && !html.includes('<svg onload'));
    assert.ok(html.includes('Normal title') && html.includes('Normal content'));
    posts[0].target_doc_title = null;
    await context.window.CodeWikiBoard.openBoardView();
    assert.ok(get('articleContainer').innerHTML.includes(`📄 ${escaped}`));
  }
}

async function logoutTest() {
  const auth = source('js/auth.js');
  assert.match(source('js/profile.js'), /#logoutBtn'\)[\s\S]*?addEventListener\('click'[\s\S]*?window\.CodeWikiAuth\.logout\(\)/);
  assert.match(auth, /getElementById\("pendingLogoutBtn"\)\.addEventListener\("click", logout\)/);
  for (const mode of ['success','rpc-error','throw','empty','replaced']) {
    const saved = new Map(mode === 'empty' ? [] : [['codewiki_supa_token_v1','test-token']]);
    const calls = [];
    const client = {rpc: async (name,args) => {
      calls.push(name); assert.equal(name,'cw_logout'); assert.equal(args.p_token,'test-token');
      assert.equal(saved.get('codewiki_supa_token_v1'),'test-token');
      if(mode==='throw') throw new Error('offline');
      if(mode==='replaced') saved.set('codewiki_supa_token_v1','new-token');
      return {error: mode==='rpc-error' ? {message:'failed'} : null};
    }};
    const context = {window:{supabase:{createClient:()=>client}, CodeWikiApp:{syncAccess:()=>calls.push('sync')}, alert:()=>calls.push('alert')},
      localStorage:{getItem:k=>saved.get(k), setItem:(k,v)=>saved.set(k,v), removeItem:k=>saved.delete(k)},
      document:{body:element(),getElementById:element}, console};
    // Expose the actual closure only in the test harness; replace unrelated UI rendering.
    vm.runInNewContext(auth.replace(/  renderAuthState\(\);\s*\}\)\(\);\s*$/, '  renderAuthState = async () => {}; window.testLogout = logout;\n})();'),context);
    calls.length = 0; // Ignore initial boot syncUserFeatures(null).
    await context.window.testLogout();
    if(mode==='success'||mode==='empty') {
      assert.equal(saved.has('codewiki_supa_token_v1'),false);
      assert.deepEqual(calls,mode==='empty'?['sync']:['cw_logout','sync']);
    } else if(mode==='replaced') {
      assert.equal(saved.get('codewiki_supa_token_v1'),'new-token');
      assert.deepEqual(calls,['cw_logout','alert']);
    } else {
      assert.equal(saved.get('codewiki_supa_token_v1'),'test-token');
      assert.deepEqual(calls,['cw_logout','alert']);
      await context.window.testLogout(); // failed requests remain retryable
      assert.equal(calls.length,4);
    }
  }
  assert.ok(!auth.includes('admin1234'));
  // An in-flight approval/profile refresh must not restore a logged-out session.
  let resolveProfile;
  const saved = new Map([['codewiki_supa_token_v1','old-token']]);
  const context = {window:{supabase:{createClient:()=>({rpc:()=>new Promise(resolve=>{resolveProfile=resolve;})})}},
    localStorage:{getItem:k=>saved.get(k)}, document:{body:element(),getElementById:element}, AbortController,setTimeout,clearTimeout,console};
  vm.runInNewContext(auth.replace(/  renderAuthState\(\);\s*\}\)\(\);\s*$/, '  window.testRefresh = renderAuthState;\n})();'),context);
  const refresh = context.window.testRefresh();
  saved.delete('codewiki_supa_token_v1');
  resolveProfile({data:{id:'admin',role:'admin',status:'approved'},error:null});
  await refresh;
  assert.equal(context.window.CodeWikiAuth.getCurrentUser(),null);
}

(async()=>{await boardTest(); await logoutTest(); console.log('PASS: stored HTML payloads, ID fallback, normal posts, logout success/error/retry, both handlers, no frontend default credential');})().catch(e=>{console.error(e);process.exitCode=1;});
