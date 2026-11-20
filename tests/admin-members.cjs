const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const nodes=new Map(),requests=[],timers=new Map();let token='admin-session',timerId=0;
function node(id){
 if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',hidden:true,open:false,isConnected:true,events:{},classList:{add(){},remove(){}},
  addEventListener(k,fn){this.events[k]=fn;},setAttribute(){},focus(){},showModal(){this.open=true;},close(){this.open=false;this.events.close?.();},
  querySelector:s=>node(s.startsWith('#')?s.slice(1):s),querySelectorAll:s=>s==='input,button'?['resetAdminPassword','resetNewPassword','resetConfirmPassword','submit'].map(node):s==='[data-reset-close]'?[node('close-reset')]:[]});
 return nodes.get(id);
}
const window={location:{hash:'#admin/students'},events:{},addEventListener(k,fn){this.events[k]=fn;},CodeWikiLearning:{escape:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))},
 CodeWikiAuth:{getSessionToken:()=>token,getSupabaseClient:()=>({rpc:(name,args)=>new Promise((resolve,reject)=>requests.push({name,args,resolve,reject}))})}};
window.CodeWikiAuth.credentialRequest=(name,args)=>window.CodeWikiAuth.getSupabaseClient().rpc(name,args);
const context={window,document:{getElementById:node,querySelectorAll:()=>[],createElement:()=>node('dialog'),body:{append(){}}},
 history:{replaceState:(a,b,hash)=>window.location.hash=hash},AbortController,TextEncoder,
 setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)};
vm.runInNewContext(fs.readFileSync('js/admin-members.js','utf8'),context);
const api=window.CodeWikiAdminMembers,host=node('adminMembersPage');
const click=(kind,id)=>host.events.click({target:{closest:selector=>selector===kind?{dataset:{resetStudent:id,membersSort:id}}:null}});
const input=(id,value)=>host.events[id==='membersSearch'?'input':'change']({target:{id,value}});
const submit=()=>node('form').events.submit({preventDefault(){}});
const fixtures=[{id:'s1',username:'student-one',full_name:'<img onerror=alert(1)>',class_name:'1반',student_number:null,mbti:'INTJ',status:'approved',birth_date:'2000-01-02',created_at:'2026-11-19T00:00:00Z'},
 {id:'s2',username:'student-two',full_name:'학생 둘',class_name:'2반',student_number:2,status:'pending'}];
(async()=>{
 api.setUser({id:'s',role:'student',status:'approved'});assert.equal(requests.length,0);assert.equal(host.hidden,true);
 api.setUser({id:'a',role:'admin'});assert.equal(requests.length,1);click('[data-members-refresh]');assert.equal(requests.length,1,'read coalescing');
 requests.shift().resolve({data:fixtures});await flush();assert.equal(host.hidden,false);
 assert.equal(window.location.hash,'#admin/students');
 api.setPresence([{full_name:'<script>bad</script>',class_name:'6반',role:'student'}]);
 assert.match(node('membersPresence').innerHTML,/현재 접속 1명/);assert.ok(!node('membersPresence').innerHTML.includes('<script>'));
 api.setPresence(false);assert.match(node('membersPresence').innerHTML,/확인하지 못했습니다/);
 assert.ok(node('membersTable').innerHTML.includes('&lt;img'));assert.ok(!node('membersTable').innerHTML.includes('<img'));
 const before=requests.length;input('membersSearch','student-two');assert.match(node('membersCount').textContent,/1명/);input('membersClass','1반');assert.match(node('membersCount').textContent,/0명/);assert.equal(requests.length,before,'filters must be local');
 input('membersSearch','');input('membersClass','');
 click('[data-reset-student]','s1');assert.equal(node('dialog').open,true);
 node('resetAdminPassword').value='admin password';node('resetNewPassword').value='New-test-42!';node('resetConfirmPassword').value='different';await submit();assert.equal(requests.length,0);assert.match(node('studentResetMessage').textContent,/서로 다릅니다/);
 node('resetConfirmPassword').value='New-test-42!';const sending=submit();submit();assert.equal(requests.length,1,'duplicate reset');
 const reset=requests.shift();assert.equal(reset.name,'cw_admin_reset_student_password');assert.equal(reset.args.p_target_id,'s1');
 assert.equal(node('resetAdminPassword').value,'');assert.equal(node('resetNewPassword').value,'');
 reset.resolve({error:{code:'CW_ADMIN_PASSWORD',message:'private server detail'}});await sending;assert.match(node('studentResetMessage').textContent,/관리자 비밀번호/);assert.ok(!node('studentResetMessage').textContent.includes('private server'));
 node('resetAdminPassword').value='correct admin';node('resetNewPassword').value=node('resetConfirmPassword').value='New-test-42!';const saved=submit();requests.shift().resolve({data:{ok:true,user_id:'s1'}});await saved;
 assert.equal(node('dialog').open,false);assert.equal(node('dialog').innerHTML,'');assert.match(node('membersMessage').textContent,/변경했습니다/);
 click('[data-reset-student]','s2');node('resetAdminPassword').value='correct admin';node('resetNewPassword').value=node('resetConfirmPassword').value='New-test-42!';const slow=submit();[...timers.values()][0]();await slow;
 assert.match(node('studentResetMessage').textContent,/변경 결과를 확인하지 못했습니다/);requests.shift().resolve({data:{ok:true,user_id:'s2'}});await flush();assert.equal(node('dialog').open,true,'late timeout success must not overwrite UI');
 api.setUser(null);assert.equal(host.innerHTML,'');assert.equal(node('dialog').innerHTML,'');
 api.setUser({id:'a',role:'admin'});const late=requests.shift();api.setUser({id:'s',role:'student'});late.resolve({data:fixtures});await flush();assert.equal(host.innerHTML,'');assert.equal(host.hidden,true);
 token='other-admin';api.setUser({id:'a2',role:'admin'});requests.shift().resolve({error:{code:'PGRST202'}});await flush();assert.match(node('membersMessage').textContent,/아직 서버에 적용/);
 const sortable=[
  {id:'n1',full_name:'김가',username:'user10',class_name:'10반',student_number:10,birth_date:'2002-01-01',created_at:'2026-11-19T10:00:00Z',status:'approved'},
  {id:'n2',full_name:'김나',username:'user2',class_name:'2반',student_number:2,birth_date:'1999-01-01',created_at:'2026-11-18T10:00:00Z',status:'pending'},
  {id:'n3',full_name:'김다',username:'user3',class_name:'1반',student_number:null,birth_date:null,created_at:null,status:'rejected'}];
 const order=()=>[...node('membersTable').innerHTML.matchAll(/data-reset-student="(.*?)"/g)].map(m=>m[1]);
 click('[data-members-refresh]');requests.shift().resolve({data:sortable});await flush();
 assert.deepEqual(order(),['n1','n2','n3']);
 click('[data-members-sort]','student_number');assert.deepEqual(order(),['n2','n1','n3']);
 assert.match(node('membersTable').innerHTML,/aria-sort="ascending"><button[^>]*data-members-sort="student_number"/);
 click('[data-members-sort]','student_number');assert.deepEqual(order(),['n1','n2','n3']);
 for(const key of ['birth_date','created_at']){click('[data-members-sort]',key);assert.deepEqual(order(),['n2','n1','n3']);click('[data-members-sort]',key);assert.deepEqual(order(),['n1','n2','n3']);}
 click('[data-members-sort]','class_name');assert.deepEqual(order(),['n3','n2','n1']);
 click('[data-members-sort]','username');assert.deepEqual(order(),['n2','n3','n1']);
 input('membersClass','2반');assert.deepEqual(order(),['n2']);input('membersClass','');assert.deepEqual(order(),['n2','n3','n1']);
 assert.equal(requests.length,0,'sorting and filtering must not request the server');
 click('[data-members-refresh]');requests.shift().resolve({data:sortable});await flush();assert.deepEqual(order(),['n2','n3','n1'],'refresh retains sorting');
 api.leave();assert.equal(host.hidden,true);assert.equal(host.innerHTML,'');assert.equal(timers.size,0);
 console.log('PASS: admin-only directory, escaped fields, local filters, bounded/coalesced reads, reauthentication reset, duplicate guard, credential clearing, timeout and session isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});
