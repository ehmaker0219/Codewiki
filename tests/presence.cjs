const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let now=1000000,token='student-token',seq=0;
const timers=new Map(),requests=[],published=[],events={},wevents={};
const document={hidden:false,addEventListener:(name,fn)=>events[name]=fn};
const window={location:{hash:'#doc/welcome-abap'},addEventListener:(name,fn)=>wevents[name]=fn,
 CodeWikiAdminMembers:{setPresence:value=>published.push(value)},
 CodeWikiAuth:{getSessionToken:()=>token,getSupabaseClient:()=>({rpc:(name,args)=>new Promise(resolve=>requests.push({name,args,resolve}))})}};
vm.runInNewContext(fs.readFileSync('js/presence.js','utf8'),{window,document,AbortController,Date:{now:()=>now},
 setTimeout:(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
const api=window.CodeWikiPresence,flush=()=>new Promise(resolve=>setImmediate(resolve));
const student={id:'s',role:'student',status:'approved'},admin={id:'a',role:'admin',status:'approved'};
(async()=>{
 api.setUser({...student,status:'pending'});assert.equal(requests.length,0);
 api.setUser(student);assert.equal(requests.length,1);assert.equal(requests[0].args.p_list,false);
 api.refresh();api.refresh();assert.equal(requests.length,1,'concurrent requests coalesced');
 requests.shift().resolve({data:null});await flush();
 api.setUser(student);api.refresh();assert.equal(requests.length,0,'profile refresh/throttle');
 document.hidden=true;events.visibilitychange();assert.equal(timers.size,0);
 now+=61000;api.refresh();assert.equal(requests.length,0,'hidden tabs do not ping');
 document.hidden=false;events.visibilitychange();assert.equal(requests.length,1);
 requests.shift().resolve({data:null});await flush();
 api.setUser({...student,status:'rejected'});assert.equal(timers.size,0,'revocation stops heartbeat');
 token='admin-token';window.location.hash='#admin/students';api.setUser(admin);
 assert.equal(requests[0].args.p_list,true);requests.shift().resolve({data:[{full_name:'Admin'}]});await flush();assert.equal(published.at(-1).length,1);
 now+=61000;api.refresh();const late=requests.shift();api.setUser(null);late.resolve({data:[{full_name:'Old account'}]});await flush();assert.equal(published.at(-1),null);assert.equal(timers.size,0,'logout ignores late results and clears timers');
 api.setUser(admin);const hanging=requests.shift();
 [...timers.values()].find(t=>t.ms===15000).fn();await flush();assert.equal(published.at(-1),false,'timeout clears stale list');
 hanging.resolve({data:[{full_name:'Late result'}]});await flush();assert.equal(published.at(-1),false);
 now+=61000;api.refresh();requests.shift().resolve({error:{code:'42501'}});await flush();assert.equal(published.at(-1),false);
 api.setUser(null);assert.equal(timers.size,0);
 // Entering the admin page during an ordinary heartbeat fetches the list once it finishes.
 window.location.hash='#doc/example';api.setUser(admin);const pending=requests.shift();assert.equal(pending.args.p_list,false);
 window.location.hash='#admin/students';wevents.hashchange();pending.resolve({data:null});await flush();assert.equal(requests.length,1);assert.equal(requests[0].args.p_list,true);
 requests.shift().resolve({data:[]});await flush();
 now+=61000;window.location.hash='#admin/logins';wevents.hashchange();assert.equal(requests.length,1);assert.equal(requests[0].args.p_list,true);
 requests.shift().resolve({data:[]});await flush();api.setUser(null);
 console.log('PASS: visible-only presence, one-minute throttle, coalescing, role revocation, timeout, logout isolation and admin-only polling');
})().catch(e=>{console.error(e);process.exitCode=1;});
