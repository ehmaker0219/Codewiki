const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map(),listeners=new Map(),calls=[],requests=[];let token='token-a',applied=null,refreshed=0,loggedOut=0;
function node(key){if(!nodes.has(key))nodes.set(key,{value:'',checked:false,disabled:true,isConnected:true,textContent:'',focus(){},addEventListener(type,fn){listeners.set(key+':'+type,fn);},querySelector:node});return nodes.get(key);}
const dialog={innerHTML:'',open:false,setAttribute(){},querySelector:node,showModal(){this.open=true;},close(){this.open=false;}};
const ctx={window:{addEventListener(){},CodeWikiAuth:{getSessionToken:()=>token,getSupabaseClient:()=>({rpc:(name,args)=>{calls.push({name,args});return new Promise(resolve=>requests.push(resolve));}}),applyProfile:p=>applied=p,logout:()=>loggedOut++},CodeWikiBirthdays:{today:()=> '2026-11-18',validDate:()=>true,refresh:()=>refreshed++}},document:{createElement:()=>dialog,body:{append(){}}}};
vm.runInNewContext(fs.readFileSync('js/profile.js','utf8'),ctx);
const api=ctx.window.CodeWikiProfile;
const profile={id:'a',username:'member-a',class_name:'6반',role:'student',full_name:'Original',mbti:'ISTJ',birth_date:'2000-01-02',share_with_class:false};
async function run(){
  api.setUser({id:'a',status:'approved'});
  const opening=api.openSettings();requests.shift()({data:profile});await opening;
  assert.equal(node('#profileName').value,'Original');assert.equal(node('#profileClass').textContent,'6반');
  node('#profileName').value=' Updated ';node('#profileMbti').value='ENFP';node('#profileBirthdayShare').checked=true;
  let saving=listeners.get('form:submit')({preventDefault(){}});
  assert.equal(calls.at(-1).name,'cw_update_my_profile');
  assert.deepEqual(Object.keys(calls.at(-1).args).sort(),['p_birth_date','p_full_name','p_mbti','p_share_with_class','p_token']);
  requests.shift()({error:{message:'offline'}});await saving;
  assert.equal(node('#profileName').value,' Updated ');assert.equal(node('[type=submit]').disabled,false);assert.equal(applied,null);
  saving=listeners.get('form:submit')({preventDefault(){}});
  requests.shift()({data:{...profile,full_name:'Updated',mbti:'ENFP'}});await saving;
  assert.equal(applied.full_name,'Updated');assert.equal(refreshed,1);assert.equal(node('#profileStatus').textContent,'저장했습니다.');
  listeners.get('#logoutBtn:click')();assert.equal(loggedOut,1);
  const stale=api.openSettings();token='token-b';api.setUser({id:'b',status:'approved'});
  requests.shift()({data:profile});await stale;
  assert.equal(dialog.open,false);assert.equal(dialog.innerHTML,'');
  console.log('PASS: profile prefill, restricted payload, error/draft recovery, save refresh, logout, stale-session clearing');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
