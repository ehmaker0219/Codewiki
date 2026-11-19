const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/auth.js','utf8');
function harness(mode) {
  const nodes=new Map(),requests=[],saved=new Map();
  const node=()=>({value:'',events:{},style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},
    addEventListener(k,fn){this.events[k]=fn;},querySelectorAll(){return [];},setAttribute(){},reportValidity(){},
    querySelector(){return null;},appendChild(child){this.notice=child;}});
  const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
  get('authGateForm').querySelector=s=>s.includes('submit')?get('submit'):get('authGateForm').notice;
  const ctx={window:{supabase:{createClient:()=>({rpc:(name,args)=>new Promise((resolve,reject)=>requests.push({name,args,resolve,reject}))})}},
    document:{getElementById:get,createElement:node},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},
    console,AbortController,setTimeout,clearTimeout};
  ctx.window.CodeWikiBirthdays={validDate:()=>true,setUser(){},today:()=> '2026-11-19'};
  vm.runInNewContext(source.replace(/  renderAuthState\(\);\s*\}\)\(\);\s*$/,
    `  authFormMode=${JSON.stringify(mode)}; renderPreLoginLanding(); renderAuthState=()=>{window.success=true;};\n})();`),ctx);
  get('authUsername').value='test-user';get('authFullName').value='테스트';get('authClassName').value='2반';
  return {ctx,get,requests,saved,submit:()=>get('authGateForm').events.submit({preventDefault(){}})};
}
(async()=>{
  for(const mode of ['signup','login']) {
    const h=harness(mode);
    h.get('authPassword').value=mode==='signup'?'Ab9!tes':' old ';
    if(mode==='signup') {
      await h.submit();assert.equal(h.requests.length,0,'short signup sent to server');
      assert.match(h.get('authGateForm').notice.textContent,/8자/);
      h.get('authPassword').value='Ab9!test';
    }
    let pending=h.submit();await h.submit();
    assert.equal(h.requests.length,1,'duplicate submission');
    assert.equal(h.requests[0].args.p_password,h.get('authPassword').value,'password was trimmed');
    h.requests.shift().resolve({error:{code:'CW_RATE_LIMIT',message:'잠시 후 다시 시도해 주세요.'}});await pending;
    assert.match(h.get('authGateForm').notice.textContent,/잠시/);
    assert.equal(h.get('submit').disabled,false);
    assert.equal(h.get('authUsername').value,'test-user');
    assert.equal(h.ctx.window.success,undefined);
    // Defensive handling for RPC adapters returning an error body with HTTP 200.
    pending=h.submit();h.requests.shift().resolve({data:{code:'CW_PASSWORD_POLICY',message:'비밀번호 정책 오류'}});await pending;
    assert.equal(h.ctx.window.success,undefined,'error body treated as successful session');
    assert.equal(h.saved.size,0,'error body saved an invalid token');
    pending=h.submit();h.requests.shift().reject(new Error('offline'));await pending;
    assert.equal(h.get('submit').disabled,false);
    assert.match(h.get('authGateForm').notice.textContent,/연결/);
    pending=h.submit();h.requests.shift().resolve({data:{session_token:'test-session'}});await pending;
    assert.equal(h.ctx.window.success,true);
    assert.equal(h.saved.get('codewiki_supa_token_v1'),'test-session');
  }
  console.log('PASS: signup minimum length, legacy login, exact passwords, 429/error bodies, network recovery, duplicate submission and valid tokens');
})().catch(e=>{console.error(e);process.exitCode=1;});
