const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const requests=[],rpcNames=[],events={},user={id:'student-a',status:'approved',role:'student'};
let token='session-a';
const ctx={Event:class{},Intl,Date,AbortController,setTimeout,clearTimeout,document:{getElementById:()=>null},window:{
  dispatchEvent(){},addEventListener(name,fn){events[name]=fn;},
  CodeWikiAuth:{getSessionToken:()=>token,getSupabaseClient:()=>({rpc:name=>{rpcNames.push(name);return new Promise(resolve=>requests.push(resolve));}})}
}};
vm.runInNewContext(fs.readFileSync('js/birthdays.js','utf8'),ctx);
const api=ctx.window.CodeWikiBirthdays;
async function verify(){
  for(const [date,valid] of [['2000-02-29',true],['2001-02-29',false],['2000-02-30',false],['1899-12-31',false],['2999-01-01',false],['',true]])assert.equal(api.validDate(date),valid);
  api.setUser(user);
  assert.equal(rpcNames.at(-1),'cw_list_birthdays');
  requests.shift()({data:[{full_name:'Test',month:2,day:29,birth_date:'2000-02-29',year:2000},
    {full_name:'최테스트',month:8,day:2},{full_name:'이테스트',month:4,day:3},{full_name:'김테스트',month:9,day:1},
    {full_name:'Invalid',month:2,day:30},{full_name:'Invalid',month:4,day:31}],error:null});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(Object.keys(api.forDate('2028-02-29')[0]).sort(),['day','full_name','month']);
  assert.equal(api.forDate('2027-02-28').length,0);
  assert.equal(api.getMembers().filter(p=>p.full_name!=='Test').map(p=>p.full_name).join(','),'김테스트,이테스트,최테스트');
  const copy=api.getMembers();copy[0].full_name='Modified';
  assert.ok(!api.getMembers().some(p=>p.full_name==='Modified'));
  void api.refresh();
  const stale=requests.shift();
  token='session-b';api.setUser({...user,id:'student-b'});
  stale({data:[{full_name:'Stale',month:11,day:18}],error:null});
  requests.shift()({data:[],error:null});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(api.forDate('2026-11-18').length,0);
  events.storage({key:'codewiki_supa_token_v1',newValue:null});
  assert.equal(api.getStatus(),'idle');
  api.setUser({id:'admin',role:'admin',status:'approved',class_name:'관리자'});
  assert.equal(rpcNames.at(-1),'cw_admin_student_directory');
  const read=api.refresh();assert.equal(requests.length,1); // repeated clicks share one read
  requests.shift()({data:[
    {full_name:'김학생',class_name:'6반',status:'approved',birth_date:'2000-02-29',username:'private'},
    {full_name:'이학생',class_name:'6반',status:'approved',birth_date:'1999-12-03'},
    {full_name:'다른 반',class_name:'1반',status:'approved',birth_date:'2001-05-06'},
    {full_name:'대기',class_name:'6반',status:'pending',birth_date:'2001-05-06'},
    {full_name:'미등록',class_name:'6반',status:'approved',birth_date:null},
    {full_name:'잘못된 날짜',class_name:'6반',status:'approved',birth_date:'2001-02-29'}
  ],error:null});await read;
  assert.equal(api.getClassName(),'6반');assert.equal(api.getMembers().length,2);
  assert.equal(Object.keys(api.getMembers()[0]).sort().join(','),'day,full_name,month');
  const count=rpcNames.length;api.setClass('1반');assert.equal(api.getMembers()[0].full_name,'다른 반');assert.equal(rpcNames.length,count);
  api.setClass('잘못된 반');assert.equal(api.getClassName(),'1반');
  api.setUser({id:'admin',role:'student',status:'approved',class_name:'6반'});
  assert.equal(api.getMembers().length,0);assert.equal(api.getClasses().length,0);assert.equal(rpcNames.at(-1),'cw_list_birthdays');
  requests.shift()({data:[],error:null});await new Promise(resolve=>setImmediate(resolve));
  api.setUser(null);
  console.log('PASS: date validation, peer privacy, admin class directory, coalesced reads, field whitelist, role changes and stale-session clearing');
}
verify().catch(e=>{console.error(e);process.exitCode=1;});
