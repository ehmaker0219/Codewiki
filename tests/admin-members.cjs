const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const nodes=new Map(),requests=[],timers=new Map();let token='admin-session',timerId=0;
function node(id){
 if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',hidden:true,open:false,isConnected:true,events:{},classList:{add(){},remove(){}},
  addEventListener(k,fn){this.events[k]=fn;},setAttribute(){},focus(){},select(){},showModal(){this.open=true;},close(){this.open=false;this.events.close?.();},
  querySelector:s=>node(s.startsWith('#')?s.slice(1):s),querySelectorAll:s=>s==='input,button'?['resetAdminPassword','resetNewPassword','resetConfirmPassword','editNewUsername','submit'].map(node):s==='[data-reset-close]'?[node('close-reset')]:s==='[data-username-close]'?[node('close-username')]:[]});
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
const click=(kind,id,extra={})=>host.events.click({target:{closest:selector=>selector===kind?{dataset:{resetStudent:id,editUsername:id,membersSort:id,membersTab:id,viewLogins:id,...extra}}:null}});
const input=(id,value)=>host.events[id==='membersSearch'?'input':'change']({target:{id,value}});
const submit=()=>node('form').events.submit({preventDefault(){}});
const fixtures=[{id:'s1',username:'student-one',full_name:'<img onerror=alert(1)>',class_name:'1반',student_number:null,mbti:'INTJ',status:'approved',birth_date:'2000-01-02',created_at:'2026-11-19T00:00:00Z'},
 {id:'s2',username:'student-two',full_name:'학생 둘',class_name:'2반',student_number:2,status:'pending'}];
(async()=>{
 api.setUser({id:'s',role:'student',status:'approved'});assert.equal(requests.length,0);assert.equal(host.hidden,true);
 api.setUser({id:'a',role:'admin'});assert.equal(requests.length,1);click('[data-members-tab]','students');assert.equal(requests.length,1,'read coalescing');
 assert.equal(host.innerHTML.includes('data-members-refresh'),false,'students tab hides refresh button');
 requests.shift().resolve({data:fixtures});await flush();assert.equal(host.hidden,false);
 assert.equal(window.location.hash,'#admin/students');
 api.setPresence([{full_name:'<script>bad</script>',class_name:'6반',role:'student'}]);
 assert.match(node('membersPresence').innerHTML,/현재 접속 1명/);assert.ok(!node('membersPresence').innerHTML.includes('<script>'));
 api.setPresence(false);assert.match(node('membersPresence').innerHTML,/확인하지 못했습니다/);
 assert.ok(node('membersTable').innerHTML.includes('&lt;img'));assert.ok(!node('membersTable').innerHTML.includes('<img'));
 const before=requests.length;input('membersSearch','student-two');assert.match(node('membersCount').textContent,/1명/);input('membersClass','1반');assert.match(node('membersCount').textContent,/0명/);assert.equal(requests.length,before,'filters must be local');
 input('membersSearch','');input('membersClass','');
 const order=()=>[...node('membersTable').innerHTML.matchAll(/data-student-id="(.*?)"/g)].map(m=>m[1]);
 assert.equal(node('membersTable').innerHTML.includes('data-reset-student='),false,'students info view omits heavy account action buttons');
 click('[data-members-tab]','accounts');assert.equal(window.location.hash,'#admin/accounts');assert.equal(requests.length,0,'accounts tab reuses cached directory');
 assert.ok(node('membersTable').innerHTML.includes('data-reset-student="s1"'),'accounts tab renders password reset button');
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
 window.location.hash='#admin/students';
 api.setUser({id:'a',role:'admin'});const late=requests.shift();api.setUser({id:'s',role:'student'});late.resolve({data:fixtures});await flush();assert.equal(host.innerHTML,'');assert.equal(host.hidden,true);
 token='other-admin';api.setUser({id:'a2',role:'admin'});requests.shift().resolve({error:{code:'PGRST202'}});await flush();assert.match(node('membersMessage').textContent,/아직 서버에 적용/);
 const sortable=[
  {id:'n1',full_name:'김가',username:'user10',class_name:'10반',student_number:10,birth_date:'2002-01-01',last_login_at:'2026-11-21T10:00:00Z',login_count:3,created_at:'2026-11-19T10:00:00Z',status:'approved'},
  {id:'n2',full_name:'김나',username:'user2',class_name:'2반',student_number:2,birth_date:'1999-01-01',last_login_at:'2026-11-20T10:00:00Z',login_count:1,created_at:'2026-11-18T10:00:00Z',status:'pending'},
  {id:'n3',full_name:'김다',username:'user3',class_name:'1반',student_number:null,birth_date:null,last_login_at:null,login_count:0,created_at:null,status:'rejected'}];
 api.invalidate();requests.shift().resolve({data:sortable});await flush();
 assert.deepEqual(order(),['n1','n2','n3']);
 click('[data-members-sort]','student_number');assert.deepEqual(order(),['n2','n1','n3']);
 assert.match(node('membersTable').innerHTML,/aria-sort="ascending"><button[^>]*data-members-sort="student_number"/);
 click('[data-members-sort]','student_number');assert.deepEqual(order(),['n1','n2','n3']);
 for(const key of ['birth_date','last_login_at','created_at']){click('[data-members-sort]',key);assert.deepEqual(order(),['n2','n1','n3']);click('[data-members-sort]',key);assert.deepEqual(order(),['n1','n2','n3']);}
 click('[data-members-sort]','class_name');assert.deepEqual(order(),['n3','n2','n1']);
 click('[data-members-sort]','username');assert.deepEqual(order(),['n2','n3','n1']);
 input('membersClass','2반');assert.deepEqual(order(),['n2']);input('membersClass','');assert.deepEqual(order(),['n2','n3','n1']);
 assert.equal(requests.length,0,'sorting and filtering must not request the server');
 api.invalidate();requests.shift().resolve({data:sortable});await flush();assert.deepEqual(order(),['n2','n3','n1'],'refresh retains sorting');
 // Login history tab: lazy load, no refresh button, coalescing, escaping, local filtering, drill-down, PGRST202 and stale isolation.
 click('[data-members-tab]','logins');assert.equal(window.location.hash,'#admin/logins');assert.equal(requests.length,1);
 assert.equal(host.innerHTML.includes('data-members-refresh'),false,'login history tab hides refresh button');
 assert.equal(requests[0].name,'cw_admin_login_history');assert.equal(requests[0].args.p_limit,100);
 click('[data-members-tab]','logins');assert.equal(requests.length,1,'login history read coalescing');
 const loginFixtures=[
  {id:2,user_id:'n1',username:'user10',full_name:'<svg onload=alert(1)>',class_name:'10반',student_number:10,status:'approved',logged_in_at:'2026-11-21T10:00:00Z',login_type:'login',ip_address:'203.0.113.7',country_code:'KR',device_type:'mobile',device_model:'iPhone',os_name:'iOS 18.1',browser_name:'Safari 18',language:'ko-KR',user_agent:'<img onerror=1>'},
  {id:1,user_id:'n2',username:'user2',full_name:'김나',class_name:'2반',student_number:2,status:'pending',logged_in_at:'2026-11-20T10:00:00Z',login_type:'revisit',ip_address:'198.51.100.9',country_code:'KR',device_type:'desktop',device_model:'Windows PC',os_name:'Windows 10/11',browser_name:'Whale 3',language:'ko-KR',user_agent:'Mozilla/5.0'}];
 requests.shift().resolve({data:loginFixtures});await flush();
 assert.ok(node('membersTable').innerHTML.includes('&lt;svg'));assert.ok(!node('membersTable').innerHTML.includes('<svg'));
 assert.ok(node('membersTable').innerHTML.includes('203.0.113.7')&&node('membersTable').innerHTML.includes('iPhone')&&node('membersTable').innerHTML.includes('Safari 18')&&node('membersTable').innerHTML.includes('자동 재방문'),'login table displays IP, device, OS, browser, and login type');
 assert.ok(!node('membersTable').innerHTML.includes('<img onerror=1>'),'user-agent tooltip escaped');
 assert.match(node('membersCount').textContent,/2건 \/ 전체 2건/);
 input('membersSearch','203.0.113.7');assert.match(node('membersCount').textContent,/1건 \/ 전체 2건/,'login search matches IP');
 input('membersSearch','whale');assert.match(node('membersCount').textContent,/1건 \/ 전체 2건/,'login search matches browser');
 input('membersSearch','user2');assert.match(node('membersCount').textContent,/1건 \/ 전체 2건/);
 input('membersClass','10반');assert.match(node('membersCount').textContent,/0건 \/ 전체 2건/);
 input('membersSearch','');input('membersClass','');assert.equal(requests.length,0,'login filters must be local');
 click('[data-members-tab]','students');assert.equal(window.location.hash,'#admin/students');assert.equal(requests.length,0,'cached directory reused');
 assert.equal(host.innerHTML.includes('data-members-refresh'),false,'students tab also hides refresh button');
 click('[data-view-logins]','user10');assert.equal(window.location.hash,'#admin/logins');assert.equal(requests.length,0,'cached login history reused');
 assert.match(node('membersCount').textContent,/1건 \/ 전체 2건/);
 api.invalidate();requests.shift().resolve({error:{code:'PGRST202'}});await flush();
 assert.match(node('membersMessage').textContent,/로그인 내역 기능이 아직 서버에 적용/);
 api.invalidate();const lateLogins=requests.shift();api.setUser(null);lateLogins.resolve({data:loginFixtures});await flush();
 assert.equal(host.innerHTML,'');assert.equal(host.hidden,true);assert.equal(timers.size,0);
 // Per-user drill-down race isolation, search focus preservation and invalidate() superseding in-flight reads.
 window.location.hash='#admin/students';
 token='admin-session-3';api.setUser({id:'a3',role:'admin'});
 const staleDir=requests.shift();
 api.invalidate();assert.equal(requests.length,1,'invalidate must supersede in-flight directory read');
 const freshDir=requests.shift();
 staleDir.resolve({data:[sortable[0]]});await flush();
 assert.equal(node('membersTable').innerHTML.includes('user2'),false,'stale pre-invalidate response must not populate directory');
 freshDir.resolve({data:sortable});await flush();
 assert.equal(node('membersTable').innerHTML.includes('user2'),true);
 // Uncached per-user drill-down sends p_user_id; editing search mid-flight supersedes it with global query and ignores stale response.
 click('[data-view-logins]','user10',{viewLoginsId:'n1'});
 assert.equal(requests.length,1);assert.equal(requests[0].name,'cw_admin_login_history');assert.equal(requests[0].args.p_user_id,'n1');
 const staleUserReq=requests.shift();
 const searchEl=node('membersSearch');searchEl.id='membersSearch';searchEl.selectionStart=1;searchEl.selectionEnd=1;
 let searchFocused=false,caretRange=null;
 searchEl.focus=()=>{searchFocused=true;};searchEl.setSelectionRange=(a,b)=>{caretRange=[a,b];};
 host.contains=el=>el===searchEl;context.document.activeElement=searchEl;
 input('membersSearch','u');
 assert.equal(requests.length,1,'typing search during per-user load must supersede with global history request');
 assert.equal(requests[0].args.p_user_id,undefined);
 assert.equal(searchFocused,true,'search input focus preserved across re-render');
 assert.deepEqual(caretRange,[1,1]);
 const globalReq=requests.shift();
 staleUserReq.resolve({data:[loginFixtures[0]]});await flush();
 assert.equal(node('membersTable').innerHTML.includes('user10'),false,'stale per-user response must not poison global cache');
 globalReq.resolve({data:loginFixtures});await flush();
 assert.match(node('membersCount').textContent,/2건 \/ 전체 2건/);
 // Triggering invalidate() while logins is active supersedes in-flight login fetch.
 api.invalidate();const staleLogins2=requests.shift();
 api.invalidate();assert.equal(requests.length,1,'invalidate must supersede in-flight login read');
 const freshLogins2=requests.shift();
 staleLogins2.resolve({data:[loginFixtures[0]]});await flush();
 freshLogins2.resolve({data:loginFixtures});await flush();
 assert.match(node('membersCount').textContent,/2건 \/ 전체 2건/);
 // Username change flow on dedicated accounts tab (#admin/accounts): local validation, duplicate guard, error mapping, table + login cache update, timeout guard.
 click('[data-members-tab]','accounts');
 assert.equal(window.location.hash,'#admin/accounts');
 assert.equal(requests.length,1);requests.shift().resolve({data:sortable.map(r=>({...r}))});await flush();
 input('membersSearch','');
 assert.ok(node('membersTable').innerHTML.includes('data-edit-username="n1"'),'accounts tab renders username edit button');
 click('[data-edit-username]','n1');assert.equal(node('dialog').open,true);
 node('editNewUsername').value='a';await submit();assert.equal(requests.length,0);assert.match(node('studentUsernameMessage').textContent,/2~100자/);
 node('editNewUsername').value='bad space';await submit();assert.equal(requests.length,0);assert.match(node('studentUsernameMessage').textContent,/공백/);
 node('editNewUsername').value='user10';await submit();assert.equal(requests.length,0);assert.match(node('studentUsernameMessage').textContent,/현재 아이디와 같습니다/);
 node('editNewUsername').value='  NewUser10  ';
 const renaming=submit();submit();assert.equal(requests.length,1,'duplicate username change coalesced');
 const renameReq=requests.shift();
 assert.equal(renameReq.name,'cw_admin_update_student_username');
 assert.equal(renameReq.args.p_target_id,'n1');
 assert.equal(renameReq.args.p_new_username,'newuser10');
 renameReq.resolve({error:{code:'CW_USERNAME_TAKEN',message:'raw constraint detail'}});await renaming;
 assert.match(node('studentUsernameMessage').textContent,/이미 사용 중인 아이디/);
 assert.ok(!node('studentUsernameMessage').textContent.includes('raw constraint'));
 node('editNewUsername').value='  NewUser10  ';
 const renamed=submit();
 requests.shift().resolve({data:{ok:true,user_id:'n1',previous_username:'user10',username:'newuser10'}});await renamed;
 assert.equal(node('dialog').open,false);assert.equal(node('dialog').innerHTML,'');
 assert.match(node('membersMessage').textContent,/newuser10/);
 assert.ok(node('membersTable').innerHTML.includes('newuser10'),'directory table updated with new username');
 assert.ok(!node('membersTable').innerHTML.includes('>user10<'),'old username removed from directory table');
 click('[data-members-tab]','logins');
 assert.ok(node('membersTable').innerHTML.includes('newuser10'),'cached login history updated with new username');
 click('[data-members-tab]','accounts');
 click('[data-edit-username]','n2');node('editNewUsername').value='slow_user2';
 const slowRename=submit();[...timers.values()][0]();await slowRename;
 assert.match(node('studentUsernameMessage').textContent,/아이디를 변경하지 못했습니다/);
 requests.shift().resolve({data:{ok:true,user_id:'n2',username:'slow_user2'}});await flush();
 assert.equal(node('dialog').open,true,'late timeout success must not overwrite username dialog');
 console.log('PASS: admin-only directory, username change, login history, escaped fields, local filters, bounded/coalesced reads, reauthentication reset, duplicate guard, credential clearing, timeout and session isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});
