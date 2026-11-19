const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/auth.js','utf8');
const nodes=new Map(),requests=[];
const node=()=>({value:'',events:{},style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},
  addEventListener(k,fn){this.events[k]=fn;},querySelectorAll(){return [];},setAttribute(){},reportValidity(){},
  querySelector(){return null;},appendChild(child){this.notice=child;}});
const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
const buttons=Array.from({length:7},(_,i)=>Object.assign(node(),{getAttribute:()=>`${i+1}반`}));
get('classPickerGrid').querySelectorAll=()=>buttons;
get('authGateForm').querySelector=selector=>selector.includes('submit')?get('submit'):get('authGateForm').notice;
const ctx={window:{supabase:{createClient:()=>({rpc:(name,args)=>new Promise((resolve,reject)=>requests.push({name,args,resolve,reject}))})}},
  document:{getElementById:get,createElement:node},localStorage:{getItem(){return null;},setItem(){}},
  console,AbortController,setTimeout,clearTimeout};
ctx.window.CodeWikiBirthdays={validDate:()=>true,setUser(){},today:()=> '2026-11-19'};
vm.runInNewContext(source.replace(/  renderAuthState\(\);\s*\}\)\(\);\s*$/,
  '  authFormMode="signup"; renderPreLoginLanding(); renderAuthState=()=>{window.success=true;};\n})();'),ctx);
const submit=()=>get('authGateForm').events.submit({preventDefault(){}});
(async()=>{
  assert.equal(get('authClassName').value,'6반');
  assert.equal(get('authStudentNumber').required,true);
  buttons[2].events.click();
  assert.equal(get('authStudentNumber').hidden,true);
  assert.equal(get('authStudentNumber').required,false);
  assert.equal(get('authStudentNumber').disabled,true);
  get('authUsername').value='test-user';get('authPassword').value='test-password';get('authFullName').value='테스트';
  let pending=submit();
  assert.equal(requests[0].args.p_student_number,null);
  requests.shift().resolve({error:{message:'server error'}});await pending;
  assert.equal(get('authFullName').value,'테스트','failed submit preserves inputs');
  assert.equal(get('submit').disabled,false);
  buttons[5].events.click();
  get('authStudentNumber').value='1.5';await submit();assert.equal(requests.length,0);
  get('authStudentNumber').value='22';pending=submit();await submit();
  assert.equal(requests.length,1,'double submit blocked');
  assert.equal(requests[0].name,'cw_signup_with_roster');
  assert.equal(requests[0].args.p_student_number,22);
  requests.shift().reject(new Error('offline'));await pending;
  assert.equal(get('submit').disabled,false,'network error restores submit');
  assert.match(get('authGateForm').notice.textContent,/연결/);
  pending=submit();requests.shift().resolve({data:{session_token:'test-token'}});await pending;
  assert.equal(ctx.window.success,true);
  console.log('PASS: class-specific number field, validation, payload, duplicate submit, error recovery and successful signup');
})().catch(e=>{console.error(e);process.exitCode=1;});
