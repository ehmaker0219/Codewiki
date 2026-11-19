const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function node(){return {innerHTML:'',events:{},input:{value:'',focus(){}},querySelector(){return this.input;},
 addEventListener(name,fn){this.events[name]=fn;},removeEventListener(name){delete this.events[name];}};}
function harness(){
 const element=node(),moveElement=node(),requests=[],notes=[{id:'n1'},{id:'n2'}];let changes=0,confirm=true;
 const current={id:'n1',title:'A',body:'unsaved body',revision:2};
 const context={window:{CodeWikiLearning:{escape:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))},confirm:()=>confirm},crypto:{randomUUID}};
 vm.runInNewContext(fs.readFileSync('js/study-folders.js','utf8'),context);
 const api=context.window.CodeWikiStudyFolders.create({element,moveElement,call:(name,args)=>new Promise((resolve,reject)=>requests.push({name,args,resolve,reject})),getNote:()=>current,getNotes:()=>notes,onChange:()=>changes++});
 return {api,element,moveElement,requests,current,changes:()=>changes,confirm:value=>confirm=value,
 click:dataset=>element.events.click({target:{closest:()=>({dataset})}}),
 submit:name=>{element.input.value=name;element.events.submit({preventDefault(){}});},
 move:value=>moveElement.events.change({target:{id:'studyMoveFolder',value}})};
}
(async()=>{
 const h=harness();const pending=h.api.load();h.api.load();assert.equal(h.requests.length,1);
 h.requests.shift().resolve({folders:[{id:'f1',name:'ABAP <script>',revision:1}],assignments:[{note_id:'n1',folder_id:'f1'}]});await pending;
 assert.ok(h.element.innerHTML.includes('ABAP &lt;script&gt;'));assert.ok(!h.element.innerHTML.includes('<script>'));
 h.click({folderFilter:'f1'});assert.equal(h.api.includesNote({id:'n1'}),true);assert.equal(h.api.includesNote({id:'n2'}),false);
 const before=JSON.stringify(h.current);h.move('');assert.equal(h.requests[0].name,'cw_move_study_note');
 assert.equal(h.api.includesNote({id:'n1'}),true,'move is not optimistic');h.move('f1');assert.equal(h.requests.length,1);
 h.requests.shift().resolve({note_id:'n1',folder_id:null});await tick();assert.equal(h.api.includesNote({id:'n1'}),false);assert.equal(JSON.stringify(h.current),before,'move modified unsaved body/revision');
 h.move('f1');h.requests.shift().reject({code:'TIMEOUT'});await tick();assert.equal(h.api.includesNote({id:'n1'}),false);assert.match(h.element.innerHTML,/다시 불러온/);
 h.click({folderAction:'new'});h.submit('새 폴더');h.submit('duplicate');assert.equal(h.requests.length,1);
 const create=h.requests.shift();create.resolve({id:create.args.p_id,name:create.args.p_name,revision:1});await tick();
 const id=create.args.p_id;assert.ok(h.element.innerHTML.includes('새 폴더'));
 h.move(id);h.requests.shift().resolve({note_id:'n1',folder_id:id});await tick();assert.equal(h.api.includesNote({id:'n1'}),true);
 h.click({folderAction:'rename'});h.submit('변경 이름');const rename=h.requests.shift();assert.equal(rename.args.p_revision,1);
 rename.resolve({id,name:'변경 이름',revision:2});await tick();assert.ok(h.element.innerHTML.includes('변경 이름'));
 h.click({folderAction:'rename'});h.submit('ABAP');h.requests.shift().reject({code:'23505'});await tick();assert.match(h.element.innerHTML,/같은 이름/);assert.ok(h.element.innerHTML.includes('변경 이름'));
 h.confirm(false);h.click({folderAction:'delete'});assert.equal(h.requests.length,0);h.confirm(true);h.click({folderAction:'delete'});
 assert.equal(h.requests[0].args.p_revision,2);h.requests.shift().resolve(null);await tick();
 assert.equal(h.api.includesNote({id:'n1'}),true,'deleted folder notes are unfiled');assert.equal(JSON.stringify(h.current),before);
 h.current.revision=0;h.api.refresh();assert.match(h.moveElement.innerHTML,/disabled/);h.move('f1');assert.equal(h.requests.length,0,'unsaved note cannot be moved');
 const late=h.api.load();const count=h.changes();h.api.dispose();h.requests.shift().resolve({folders:[],assignments:[]});await late;
 assert.equal(h.changes(),count,'late result revived disposed session');assert.deepEqual(h.element.events,{});
 console.log('PASS: folder filters, safe names, coalesced reads, create/rename/delete, confirmed moves, draft preservation, failure recovery and logout isolation');
})().catch(error=>{console.error(error);process.exitCode=1;});
