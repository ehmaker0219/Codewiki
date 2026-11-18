const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const flush = () => new Promise(resolve => setImmediate(resolve));
function node() {
  const classes = new Set();
  return {innerHTML:'', textContent:'', events:{}, classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},
    addEventListener(event,fn){this.events[event]=fn;},querySelectorAll:()=>[]};
}

async function board() {
  let token = 'a';
  const requests = [], nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id,node()); return nodes.get(id); };
  const context = {document:{getElementById:get,querySelector:get,querySelectorAll:()=>[]}, window:{CodeWikiAuth:{
    getSessionToken:()=>token,getCurrentUser:()=>({id:token,role:'student'}),isSupabaseConfigured:()=>true,
    getSupabaseClient:()=>({rpc:()=>new Promise(resolve=>requests.push(resolve))})
  }}};
  vm.runInNewContext(fs.readFileSync('js/board.js','utf8'),context);
  const api = context.window.CodeWikiBoard, article = get('articleContainer');
  const first = api.openBoardView();
  await flush();
  assert.equal(requests.length,1,'badge and board share one read');
  api.closeIfActive(); article.innerHTML = 'new document';
  requests.shift()({data:[]}); await first;
  assert.equal(article.innerHTML,'new document','late board response cannot overwrite a document');

  const second = api.openBoardView(); await flush();
  token = 'b'; article.innerHTML = 'new session';
  requests.shift()({data:[]}); await second;
  assert.equal(article.innerHTML,'new session','old account response is ignored');

  const failed = api.openBoardView(); await flush();
  requests.shift()({error:{message:'offline'}}); await failed;
  assert.match(article.innerHTML,/불러오지 못했습니다/);
  const retry = api.openBoardView(); await flush();
  requests.shift()({data:[]}); await retry;
  assert.match(article.innerHTML,/등록된 건의글이 없습니다/);
}

async function admin() {
  let token = 'admin-a', user = {id:'a',role:'admin'};
  const modal = node(), requests = [], calls = [];
  const context = {window:{}};
  for (const file of ['learning-tools','admin']) vm.runInNewContext(fs.readFileSync(`js/${file}.js`,'utf8'),context);
  const api = context.window.CodeWikiAdmin.create({modal,getToken:()=>token,getUser:()=>user,isRemote:true,onChange:async()=>{},
    client:{rpc:(name,args)=>{calls.push({name,args});return new Promise(resolve=>requests.push({name,resolve}));}}});
  const answer = (name,result) => { const i = requests.findIndex(r=>r.name===name); assert.notEqual(i,-1); requests.splice(i,1)[0].resolve(result); };
  const click = (selector,attributes={}) => modal.events.click({target:{closest:s=>s===selector ? {getAttribute:key=>attributes[key]} : null}});
  api.setUser(user);
  let opening = api.open(); await flush();
  assert.equal(requests.length,2,'independent list/birthday reads start together');
  const members = [{id:'member',status:'pending',full_name:'<img src=x>',username:'test',class_name:'6반'}];
  answer('cw_admin_list_users',{data:members}); answer('cw_admin_birthdays',{data:[{user_id:'member',birth_date:'2000-01-01'}]});
  await opening;
  assert.match(modal.innerHTML,/2000-01-01/);
  assert.ok(!modal.innerHTML.includes('<img'));
  click('[data-class-filter]',{'data-class-filter':'6반'});
  assert.equal(calls.length,2,'class filter must not fetch again');
  click('[data-uid]',{'data-uid':'member','data-next':'approved'}); await flush();
  answer('cw_admin_set_status',{error:{message:'offline'}}); await flush();
  assert.match(modal.innerHTML,/승인 상태를 변경하지 못했습니다/);
  assert.match(modal.innerHTML,/승인 대기 중/);
  assert.ok(!modal.innerHTML.includes(' disabled'));

  opening = api.open(); await flush(); api.close();
  answer('cw_admin_list_users',{data:members}); answer('cw_admin_birthdays',{data:[]}); await opening;
  assert.equal(modal.innerHTML,'','closing must invalidate pending requests');
  opening = api.open(); await flush(); token = 'student-b'; user = {id:'b',role:'student'}; api.setUser(user);
  answer('cw_admin_list_users',{data:members}); answer('cw_admin_birthdays',{data:[]}); await opening;
  assert.equal(modal.innerHTML,'','admin information is cleared on session change');
  await api.open(); assert.equal(requests.length,0,'non-admin cannot open the approval UI');
}

async function createPost() {
  const nodes = new Map(), requests = [];
  const get = id => { if (!nodes.has(id)) nodes.set(id,node()); return nodes.get(id); };
  const context = {document:{getElementById:get,querySelector:get,querySelectorAll:()=>[]},window:{CodeWikiAuth:{
    getSessionToken:()=> 'session',getCurrentUser:()=>({id:'a'}),isSupabaseConfigured:()=>true,
    getSupabaseClient:()=>({rpc:(name)=>name === 'cw_create_post' ? new Promise(resolve=>requests.push(resolve)) : Promise.resolve({data:[]})})
  }}};
  vm.runInNewContext(fs.readFileSync('js/board.js','utf8'),context);
  context.window.CodeWikiBoard.openWriteModal('');
  get('postCategory').value='질문·기타';get('postTargetDoc').value='';
  get('postTitle').value='Draft title';get('postContent').value='Keep my draft';
  const submit = () => get('boardWriteForm').events.submit({preventDefault(){}});
  const first = submit(); await submit();
  assert.equal(requests.length,1,'double submit must send one write');
  requests.shift()({error:{message:'offline'}}); await first;
  assert.match(get('postError').textContent,/작성 내용은 유지/);
  assert.equal(get('postContent').value,'Keep my draft');
  assert.equal(get('boardWriteModal').classList.contains('hidden'),false);
  assert.equal(get('submitPostBtn').disabled,false);
  const retry = submit();requests.shift()({data:true});await retry;
  assert.equal(get('boardWriteModal').classList.contains('hidden'),true);
  context.window.CodeWikiBoard.openWriteModal('');
  const stale = submit();
  get('closeWriteModalBtn').events.click();
  context.window.CodeWikiBoard.openWriteModal('');
  get('postContent').value='A different draft';
  requests.shift()({data:true});await stale;
  assert.equal(get('boardWriteModal').classList.contains('hidden'),false,'an earlier save cannot close a newly opened form');
  assert.equal(get('postContent').value,'A different draft');
}

(async()=>{await board();await admin();await createPost();console.log('PASS: coalesced reads, parallel admin reads, local filters, failed writes/retry, double-submit guard, draft retention, stale view/session/closed-modal responses');})()
  .catch(error=>{console.error(error);process.exitCode=1;});
