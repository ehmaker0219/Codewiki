const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
  let user={id:'admin',role:'admin'},token='session',confirmed=false;
  const requests=[],modal={innerHTML:'',events:{},classList:{add(){},remove(){}},addEventListener(k,fn){this.events[k]=fn;}};
  const ctx={window:{confirm:()=>confirmed}};
  for(const file of ['learning-tools','admin'])vm.runInNewContext(fs.readFileSync(`js/${file}.js`,'utf8'),ctx);
  const api=ctx.window.CodeWikiAdmin.create({modal,getToken:()=>token,getUser:()=>user,isRemote:true,onChange:async()=>{},
    client:{rpc:(name,args)=>new Promise(resolve=>requests.push({name,args,resolve}))}});
  const members=[{id:'rejected',status:'rejected',role:'student',full_name:'거절학생',username:'rejected',class_name:'6반'},
    {id:'approved',status:'approved',role:'student',full_name:'승인학생',username:'approved',class_name:'6반'}];
  const click=id=>modal.events.click({target:{closest:s=>s==='[data-uid]'?{getAttribute:k=>k==='data-uid'?id:'delete'}:null}});
  async function open(){
    const p=api.open();await flush();
    requests.shift().resolve({data:members});requests.shift().resolve({data:[]});await p;
  }
  return {api,modal,requests,click,open,confirm:()=>confirmed=true,logout:()=>{token='';user=null;api.setUser(null);}};
}
(async()=>{
  const a=setup();await a.open();
  assert.match(a.modal.innerHTML,/data-uid="rejected" data-next="delete"/);
  assert.doesNotMatch(a.modal.innerHTML,/data-uid="approved" data-next="delete"/);
  a.click('rejected');assert.equal(a.requests.length,0,'cancel must not delete');
  a.confirm();a.click('approved');assert.equal(a.requests.length,0,'approved user protected');
  a.click('rejected');a.click('rejected');assert.equal(a.requests.length,1,'single delete request');
  const request=a.requests.shift();assert.equal(request.name,'cw_admin_delete_rejected_user');assert.equal(request.args.p_target_id,'rejected');
  request.resolve({error:{message:'offline'}});await flush();
  assert.match(a.modal.innerHTML,/가입 요청을 삭제하지 못했습니다/);
  assert.match(a.modal.innerHTML,/data-admin-row-error role="alert"/);
  assert.match(a.modal.innerHTML,/거절학생/);assert.doesNotMatch(a.modal.innerHTML,/ disabled/);
  a.click('rejected');a.requests.shift().resolve({error:{code:'PGRST202'}});await flush();
  assert.match(a.modal.innerHTML,/서버에 적용되지 않아 삭제하지 못했습니다/);
  a.click('rejected');a.requests.shift().resolve({data:null});await flush();
  assert.doesNotMatch(a.modal.innerHTML,/거절학생/);assert.match(a.modal.innerHTML,/승인학생/);
  assert.equal(a.requests.length,0,'successful delete updates local list without refetch');
  await a.open();a.click('rejected');a.logout();a.requests.shift().resolve({data:null});await flush();
  assert.equal(a.modal.innerHTML,'','late delete cannot restore private admin UI after logout');
  console.log('PASS: rejected-only delete, confirmation, duplicate guard, failure recovery, local list update and session isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});
