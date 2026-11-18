const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const source=fs.readFileSync('js/progress.js','utf8');
function browser(server,storage=new Map()){
 let token='a';const events={};
 const win={addEventListener:(name,fn)=>events[name]=fn,dispatchEvent:()=>{},CodeWikiAuth:{getSessionToken:()=>token,getSupabaseClient:()=>({rpc:(name,args)=>server(name,args)})}};
 vm.runInNewContext(source,{window:win,Event,document:{addEventListener(){},visibilityState:'visible'},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}});
 return {api:win.CodeWikiProgress,storage,events,login(id){token=id;win.CodeWikiProgress.setUser(id?{id,status:'approved'}:null)}};
}
(async()=>{
 const data={a:{},b:{}};let offline=false, deferred=null;
 const server=async(name,args)=>{
  if(offline)throw Error('offline');
  if(deferred && name==='cw_get_progress'){const fn=deferred;deferred=null;return await fn();}
  const values=data[args.p_token];
  if(name==='cw_get_progress')return {data:Object.entries(values).map(([doc_id,completed])=>({doc_id,completed}))};
  values[args.p_doc_id]=args.p_completed;return {data:null};
 };
 const one=browser(server,new Map([['codewiki_read_docs_v2','["unowned-legacy"]']]));
 one.login('a');await tick();assert.equal(one.api.getReadDocs().length,0);
 one.api.toggle('abap-basics');await tick();assert.equal(data.a['abap-basics'],true);
 const two=browser(server);two.login('a');await tick();assert.ok(two.api.getReadDocs().includes('abap-basics'));
 one.login('b');await tick();assert.equal(one.api.getReadDocs().length,0);
 one.login('a');await tick();offline=true;one.api.toggle('abap-basics');await tick();assert.equal(one.api.getReadDocs().length,0);assert.ok(one.api.needsRetry());
 offline=false;await one.api.sync();assert.equal(data.a['abap-basics'],false);
 await two.api.sync();assert.equal(two.api.getReadDocs().length,0);
 let resolve;deferred=()=>new Promise(r=>resolve=r);
 const stale=one.api.sync();one.login('b');await tick();resolve({data:[{doc_id:'private-a',completed:true}]});await stale;
 assert.ok(!one.api.getReadDocs().includes('private-a'));
 one.login(null);assert.equal(one.api.getReadDocs().length,0);
 one.login('a');await tick();deferred=()=>new Promise(r=>resolve=r);
 const pending=one.api.sync();one.api.toggle('abap-loops');resolve({data:[]});await pending;
 assert.equal(data.a['abap-loops'],true);
 console.log('PASS: account isolation, second device, completion/uncompletion, offline retry, stale responses, in-flight edits and unowned legacy records');
})().catch(e=>{console.error(e);process.exitCode=1});
