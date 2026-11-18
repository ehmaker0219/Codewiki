const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const elements=new Map(),saved=new Map(),memory=new Map(),calls=[],alerts=[];
function get(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',hidden:false,events:{},dataset:{},
  classList:{toggle(){},remove(){},add(){}},addEventListener(name,handler){this.events[name]=handler;},
  querySelector(selector){return get(selector.replace(/^#/,''));},querySelectorAll:()=>[],focus(){},setAttribute(){}});return elements.get(id);}
const context={window:{location:{hash:'#study'},addEventListener(){},alert:m=>alerts.push(m),confirm:()=>true},
  document:{getElementById:get,querySelectorAll:()=>[]},localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},
  crypto:{randomUUID},setTimeout:()=>1,clearTimeout(){},history:{replaceState(){}},console};
const client={rpc:async(name,args)=>{
 calls.push(name);
 if(name==='cw_list_study_notes')return {data:[...saved.values()]};
 if(name==='cw_get_study_note')return {data:saved.get(args.p_id)};
 if(name==='cw_save_study_note'){const note={id:args.p_id,title:args.p_title,body:args.p_body,revision:args.p_revision+1,updated_at:new Date().toISOString()};saved.set(note.id,note);return {data:note};}
 if(name==='cw_delete_study_note'){saved.delete(args.p_id);return {data:null};}
 throw Error('unexpected RPC');
}};
context.window.CodeWikiAuth={getSessionToken:()=> 'test',getSupabaseClient:()=>client};
for(const file of ['learning-tools','study-markdown','study-store','study'])vm.runInNewContext(fs.readFileSync('js/'+file+'.js','utf8'),context);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const api=context.window.CodeWikiStudy;
 api.setUser({id:'student',role:'student'});await flush();assert.equal(calls.length,0);assert.equal(get('studyWorkspace').hidden,true);
 api.setUser({id:'admin',role:'admin',full_name:'Test Admin'});await flush();assert.equal(get('studyWorkspace').hidden,false);
 const importFile=async file=>{await get('studyFile').events.change({target:{files:[file],value:'file'}});await flush();};
 await importFile({name:'수업 필기.txt',size:30,text:async()=> '## 필기\n**중요** ==복습=='});
 assert.equal(saved.size,1);assert.equal(get('studyTitle').value,'수업 필기');assert.equal(get('studyBody').value,'## 필기\n**중요** ==복습==');
 assert.match(get('studyPreview').innerHTML,/<strong>중요<\/strong> <mark>복습<\/mark>/);
 await importFile({name:'bad.html',size:10,text:async()=>'<script>bad</script>'});assert.equal(saved.size,1);assert.equal(alerts.length,1);
 await importFile({name:'huge.txt',size:900000,text:async()=>''});assert.equal(saved.size,1);assert.equal(alerts.length,2);
 get('studyBody').value='edited';get('studyBody').events.input();await get('studySave').events.click();await flush();
 assert.equal([...saved.values()][0].body,'edited');
 await get('studyDelete').events.click();await flush();assert.equal(saved.size,0);assert.equal(get('studyEditor').hidden,true);
 api.setUser(null);assert.equal(get('studyWorkspace').innerHTML,'');assert.equal(get('studyWorkspace').hidden,true);
 console.log('PASS: study UI admin gate, TXT import, size/type rejection, preview, save/delete and logout cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
