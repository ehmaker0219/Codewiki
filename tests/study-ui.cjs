const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const elements=new Map(),saved=new Map(),memory=new Map(),calls=[],alerts=[];
let failSaveTitle='',deferList=false,finishList,timerSchedules=0,deferSave=false,finishSave;
let downloadedBlob,downloadedName;
function get(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',hidden:false,events:{},dataset:{},
  classList:{toggle(){},remove(){},add(){}},addEventListener(name,handler){this.events[name]=handler;},
  querySelector(selector){return get(selector.replace(/^#/,''));},querySelectorAll(selector){
    if(id!=='studyList'||selector!=='[data-note]')return [];
    return [...this.innerHTML.matchAll(/data-note="([^"]+)"/g)].map(([,noteId])=>{
      const button=get('note-'+noteId);button.dataset.note=noteId;return button;
    });
  },focus(){},attributes:{},setAttribute(name,value){this.attributes[name]=value;},getAttribute(name){return this.attributes[name]??null;}});return elements.get(id);}
const context={window:{location:{hash:'#study'},addEventListener(){},alert:m=>alerts.push(m),confirm:()=>true},
  document:{getElementById:get,querySelectorAll:()=>[],createElement(tag){assert.equal(tag,'a');return {click(){downloadedName=this.download;}};}},
  Blob,URL:{createObjectURL(blob){downloadedBlob=blob;return 'blob:test';},revokeObjectURL(){}},
  localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},
  crypto:{randomUUID},AbortController,setTimeout:()=>++timerSchedules,clearTimeout(){},history:{replaceState(){}},console};
const client={rpc:async(name,args)=>{
 calls.push(name);
 if(name==='cw_list_study_notes'){
   const data=[...saved.values()];
   if(deferList)return new Promise(resolve=>{finishList=()=>resolve({data});});
   return {data};
 }
 if(name==='cw_get_study_note')return {data:saved.get(args.p_id)};
 if(name==='cw_save_study_note'){if(deferSave)await new Promise(resolve=>{finishSave=resolve;});if(args.p_title===failSaveTitle)return {error:{message:'offline'}};if((saved.get(args.p_id)?.revision||0)!==args.p_revision)return {error:{code:'PT409'}};const note={id:args.p_id,title:args.p_title,body:args.p_body,revision:args.p_revision+1,updated_at:new Date().toISOString()};saved.set(note.id,note);return {data:note};}
 if(name==='cw_delete_study_note'){saved.delete(args.p_id);return {data:null};}
 throw Error('unexpected RPC');
}};
context.window.CodeWikiAuth={getSessionToken:()=> 'test',getSupabaseClient:()=>client};
let editorCallbacks,editorBody='',destroyed=0;
context.window.CodeWikiStudyEditor={create(options){editorCallbacks=options;return {
 setContent(body){editorBody=body;},text:()=>editorBody,active:()=>false,can:()=>false,
 destroy(){destroyed++;editorBody='';},command(){},
};}};
for(const file of ['learning-tools','study-store','study'])vm.runInNewContext(fs.readFileSync('js/'+file+'.js','utf8'),context);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const api=context.window.CodeWikiStudy;
 api.setUser({id:'admin',role:'admin',status:'approved'});await flush();assert.equal(calls.length,0);assert.equal(get('studyWorkspace').hidden,true);
 api.setUser({id:'student',role:'student'});await flush();assert.equal(calls.length,0);assert.equal(get('studyWorkspace').hidden,true);
 const fixtures=[
  {title:'261117TUE',updated_at:'2026-11-18T02:00:00Z'},
  {title:'261118 수요일',updated_at:'2026-11-18T01:00:00Z'},
  {title:'261112THU',updated_at:'2026-11-18T03:00:00Z'},
  {title:'2026-11-19 목요일',updated_at:'2026-11-18T01:00:00Z'},
  {title:'20261120FRI',updated_at:'2026-11-18T01:00:00Z'},
  {title:'복습',updated_at:'2026-11-18T01:00:00Z'},
  {title:'개념',updated_at:'2026-11-18T01:00:00Z'},
 ].map(note=>({...note,id:randomUUID(),body:note.title,revision:1}));
 fixtures.forEach(note=>saved.set(note.id,note));
 api.setUser({id:'study-owner',role:'student',status:'approved',full_name:'Test Student'});await flush();
 assert.equal(get('studyTitle').value,'261112THU','initial note follows modification time, not the title date');
 assert.match(get('studyStatus').textContent,/마지막 저장 .*12:00/,'confirmed timestamp is in the save status row');
 assert.equal((get('studyWorkspace').innerHTML.match(/id="studyStatus"/g)||[]).length,1);
 assert.ok(!get('studyWorkspace').innerHTML.includes('studySaveSummary'),'save status is not duplicated');
 assert.equal(get('studySave').getAttribute('aria-label'),'저장됨');
 assert.equal(get('studySave').getAttribute('aria-busy'),'false');
 assert.equal((get('studyWorkspace').innerHTML.match(/id="studyDelete"/g)||[]).length,1,'one delete action after moving it to the heading');
 const renderedTitles=()=>get('studyList').querySelectorAll('[data-note]').map(button=>saved.get(button.dataset.note).title);
 assert.deepEqual(renderedTitles(),['20261120FRI','2026-11-19 목요일','261118 수요일','261117TUE','261112THU','개념','복습']);
 await get('note-'+fixtures[1].id).events.click();await flush();
 assert.equal(get('studyTitle').value,'261118 수요일');
 assert.equal(renderedTitles()[2],'261118 수요일','selection does not change title ordering');
 const beforeTyping=calls.length,beforeTimers=timerSchedules;
 editorCallbacks.onChange('restored draft');
 await flush();assert.equal(calls.length,beforeTyping,'typing persists locally without a network request');
 assert.equal(timerSchedules,beforeTimers,'typing does not queue an autosave timer');
 api.setUser(null);api.setUser({id:'study-owner',role:'student',status:'approved',full_name:'Test Student'});await flush();
 assert.equal(get('studyTitle').value,'261118 수요일','restored draft takes priority over recent server note');
 assert.equal(editorBody,'restored draft');
 const callsBeforeCollapse=calls.length,editorBeforeCollapse=editorCallbacks;
 get('studySearch').value='261118';
 assert.equal(get('studyLibraryToggle').getAttribute('aria-expanded'),'true');
 get('studyLibraryToggle').events.click();
 assert.equal(get('studyLibraryContent').hidden,true);
 assert.equal(get('studyLibraryToggle').getAttribute('aria-expanded'),'false');
 assert.equal(get('studyLibraryToggle').getAttribute('aria-label'),'내 필기 펼치기');
 get('studyLibraryToggle').events.click();
 assert.equal(get('studyLibraryContent').hidden,false);
 assert.equal(get('studyLibraryToggle').getAttribute('aria-expanded'),'true');
 assert.equal(get('studyLibraryToggle').title,'내 필기 접기');
 assert.equal(get('studySearch').value,'261118');
 assert.equal(editorBody,'restored draft');
 assert.equal(editorCallbacks,editorBeforeCollapse,'collapse preserves the active editor');
 assert.equal(calls.length,callsBeforeCollapse,'collapse does not read or write server data');
 get('studySearch').value='';
 saved.set(fixtures[1].id,{...fixtures[1],body:'Changed on server',revision:3});
 await get('studySave').events.click();await flush();
 assert.equal(get('studySave').getAttribute('aria-label'),'현재 글로 저장');
 assert.equal(get('studySave').title,'현재 글로 저장 (Ctrl+S)','conflict overwrite action and save shortcut remain explicit with icon-only UI');
 assert.equal(get('studySave').getAttribute('aria-busy'),'false');
 assert.match(get('studyStatus').textContent,/서버에 다른 버전/);
 assert.equal(editorBody,'restored draft');
 await get('studySave').events.click();await flush();
 assert.equal(saved.get(fixtures[1].id).body,'restored draft','explicit conflict resolution saves current text');
 assert.equal(get('studySave').getAttribute('aria-label'),'저장됨');
 assert.match(get('studyStatus').textContent,/저장됨 · 마지막 저장/);
 // Exercise the actual download handler, Blob and reimport path with the real
 // editor codec: a lossy plain-Markdown conversion must not pass as a backup.
 const codecContext={window:{}};
 vm.runInNewContext(fs.readFileSync('js/study-editor.js','utf8'),codecContext);
 const codec=codecContext.window.CodeWikiStudyEditor;
 const richParagraph={type:'paragraph',attrs:{textAlign:'center'},content:[{type:'text',text:'중요 **기호**',marks:[
   {type:'underline'},{type:'fontSize',attrs:{size:24}},{type:'textColor',attrs:{color:'#ff0000'}}]}]};
 const table=JSON.parse(JSON.stringify(codec.parse('| 항목 | 내용 |\n| --- | --- |\n| A | B |').content[0]));
 table.content[1].content[0].content.push({type:'paragraph',content:[{type:'text',text:'표 안의 두 번째 문단'}]});
 const backupBody=codec.serialize({type:'doc',content:[richParagraph,table]});
 assert.match(backupBody,/codewiki-rich-v1/);assert.match(backupBody,/codewiki-table-v1/);
 editorBody=backupBody;editorCallbacks.onChange(backupBody);
 const callsBeforeDownload=calls.length;
 get('studyDownload').events.click();
 const backup=await downloadedBlob.text();
 assert.equal(backup,backupBody,'download preserves the current unsaved body byte for byte');
 assert.equal(downloadedName,'261118 수요일.md');
 assert.equal(calls.length,callsBeforeDownload,'download does not write to the server');
 deferSave=true;
 const saveCalls=calls.filter(name=>name==='cw_save_study_note').length;
 get('studySave').events.click();await flush();
 assert.equal(get('studySave').getAttribute('aria-busy'),'true','spinner stays active during a delayed request');
 assert.equal(get('studySave').getAttribute('aria-label'),'저장 중…');
 assert.equal(get('studySave').disabled,true);
 get('studySave').events.click();await flush();
 assert.equal(calls.filter(name=>name==='cw_save_study_note').length,saveCalls+1,'duplicate save clicks do not send extra requests');
 deferSave=false;finishSave();await flush();
 assert.equal(get('studySave').getAttribute('aria-busy'),'false','spinner stops on success');
 assert.equal(get('studySave').disabled,false);
 await get('studyFile').events.change({target:{files:[{name:downloadedName,size:downloadedBlob.size,text:async()=>backup}],value:'file'}});
 await flush();
 assert.equal(editorBody,backupBody,'reimport retains rich text and multiline tables');
 assert.deepEqual(codec.parse(editorBody),codec.parse(backupBody));
 assert.ok([...saved.values()].some(note=>note.body===backupBody),'reimport saves the lossless body');
 api.setUser(null);saved.clear();memory.clear();
 api.setUser({id:'study-owner',role:'student',status:'approved',full_name:'Test Student'});await flush();assert.equal(get('studyWorkspace').hidden,false);
 const importFile=async file=>{await get('studyFile').events.change({target:{files:[file],value:'file'}});await flush();};
 await importFile({name:'수업 필기.txt',size:30,text:async()=> '## 필기\n**중요** ==복습=='});
 assert.equal(saved.size,1);assert.equal(get('studyTitle').value,'수업 필기');assert.equal(editorBody,'## 필기\n**중요** ==복습==');
 const savedAt=[...saved.values()][0].updated_at;
 const expectedTime=new Date(savedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
 assert.equal(get('studyStatus').textContent,'저장됨 · 마지막 저장 '+expectedTime,'successful save shows server timestamp to the minute');
 assert.ok(!get('studyWorkspace').innerHTML.includes('<textarea'));
 get('studyTitle').value='새 제목';get('studyTitle').events.input();await get('studySave').events.click();await flush();
 assert.equal([...saved.values()][0].body,'## 필기\n**중요** ==복습==','title edits preserve original body');
 await importFile({name:'bad.html',size:10,text:async()=>'<script>bad</script>'});assert.equal(saved.size,1);assert.equal(alerts.length,1);
 await importFile({name:'huge.txt',size:900000,text:async()=>''});assert.equal(saved.size,1);assert.equal(alerts.length,2);
 editorCallbacks.onChange('edited');await get('studySave').events.click();await flush();
 assert.equal([...saved.values()][0].body,'edited');
 await get('studyDelete').events.click();await flush();assert.equal(saved.size,0);assert.equal(get('studyEditor').hidden,true);
 await importFile({name:'첫째.md',size:10,text:async()=> '첫 번째 노트'});
 const firstId=[...saved.keys()][0];
 await importFile({name:'둘째.md',size:10,text:async()=> '두 번째 노트'});
 const order=()=>get('studyList').querySelectorAll('[data-note]').map(button=>button.dataset.note);
 const initialOrder=order();assert.equal(initialOrder[1],firstId,'undated notes follow Korean title order');
 await get('note-'+firstId).events.click();await flush();
 assert.equal(editorBody,'첫 번째 노트');assert.deepEqual(order(),initialOrder,'selecting a lower note does not move it');
 get('studyTitle').value='첫째 수정';get('studyTitle').events.input();
 await get('studySave').events.click();await flush();
 assert.deepEqual(order(),initialOrder,'saving an existing note preserves its position');
 assert.ok(get('studyList').innerHTML.includes('첫째 수정'),'row title still refreshes');
 // A slow list snapshot must not undo a save, resurrect a deletion or hide an import.
 deferList=true;
 const reads=calls.filter(name=>name==='cw_list_study_notes').length;
 get('studyRetryList').events.click();get('studyRetryList').events.click();
 assert.equal(calls.filter(name=>name==='cw_list_study_notes').length,reads+1,'coalesce overlapping list requests');
 get('studyTitle').value='첫째 최신';get('studyTitle').events.input();
 await get('studySave').events.click();await flush();
 const secondId=[...saved.keys()].find(id=>id!==firstId);
 await get('note-'+secondId).events.click();await flush();
 await get('studyDelete').events.click();await flush();
 await importFile({name:'늦은 목록보다 새 메모.md',size:10,text:async()=> 'new note'});
 deferList=false;finishList();await flush();
 assert.deepEqual(new Set(order()),new Set(saved.keys()),'late list keeps additions and deletions');
 assert.ok(get('studyList').innerHTML.includes('첫째 최신'),'late list keeps updated titles');
 const beforeProfile=editorBody;
 api.setUser({id:'study-owner',role:'student',status:'approved',full_name:'Updated Student'});
 assert.equal(get('studyHeading').textContent,'Updated Student님의 공부방');
 assert.equal(editorBody,beforeProfile,'profile refresh preserves current editor');
 const importMany=files=>get('studyFile').events.change({target:{files,value:'files'}});
 assert.match(get('studyWorkspace').innerHTML,/id="studyFile"[^>]*multiple/);
 const beforeBatch=saved.size;
 await importMany([
   {name:'여러 파일 A.txt',size:10,text:async()=> 'A'},
   {name:'invalid.pdf',size:10,text:async()=> 'skip'},
   {name:'빈 파일.md',size:0,text:async()=> ''},
   {name:'여러 파일 B.md',size:10,text:async()=> '**B**'},
 ]);
 assert.equal(saved.size,beforeBatch+3,'one saved note per valid file, including empty files');
 assert.equal(get('studyImportStatus').textContent,'3개 가져오기 완료 · 1개 제외');
 assert.equal(editorBody,'**B**');assert.equal(get('studyImport').disabled,false);
 failSaveTitle='저장 실패';let unread=true;
 await importMany([
   {name:'먼저 성공.md',size:10,text:async()=> 'saved'},
   {name:'저장 실패.md',size:10,text:async()=> 'keep this draft'},
   {name:'나중 파일.md',size:10,text:async()=> {unread=false;return 'later';}},
 ]);
 assert.equal(saved.size,beforeBatch+4);assert.equal(editorBody,'keep this draft');assert.equal(unread,true);
 assert.match(get('studyImportStatus').textContent,/1개 가져오기 완료.*저장 실패로 중단/);
 assert.equal(get('studySave').getAttribute('aria-busy'),'false','spinner also stops after a failed save');
 assert.equal(get('studySave').disabled,false,'failed save can be retried');
 assert.ok([...memory.values()].some(value=>value.includes('keep this draft')));
 failSaveTitle='';await get('studySave').events.click();await flush();
 assert.equal(saved.size,beforeBatch+5,'failed import remains retryable without creating a duplicate');
 let finishRead;
 const late=importMany([{name:'늦은 파일.md',size:10,text:()=>new Promise(resolve=>finishRead=resolve)}]);
 await flush();
 api.setUser(null);assert.equal(get('studyWorkspace').innerHTML,'');assert.equal(get('studyWorkspace').hidden,true);
 finishRead('old session');await late;
 assert.equal(saved.size,beforeBatch+5,'logout cancels remaining imports');
 assert.ok(destroyed>=2,'editor content and history cleared on delete/logout');
 // Approved students share the editor; denied accounts never start a store.
 saved.clear();
 api.setUser({id:'student',role:'student',status:'approved',full_name:'Student'});await flush();
 assert.equal(get('studyWorkspace').hidden,false);
 assert.match(get('studyWorkspace').innerHTML,/Student님의 공부방/);
 await importFile({name:'학생 필기.md',size:10,text:async()=> 'student private note'});
 assert.equal(saved.size,1);assert.equal(editorBody,'student private note');
 editorBody='student unsaved draft';editorCallbacks.onChange(editorBody);
 api.setUser({id:'student',role:'student',status:'approved',full_name:'Student renamed'});
 assert.equal(editorBody,'student unsaved draft');
 assert.equal(get('studyHeading').textContent,'Student renamed님의 공부방');
 api.setUser({id:'student',role:'student',status:'rejected'});await flush();
 assert.equal(get('studyWorkspace').hidden,true);assert.equal(editorBody,'');
 const deniedCalls=calls.length;
 api.setUser({id:'student',role:'student',status:'pending'});await flush();assert.equal(calls.length,deniedCalls);
 saved.clear();
 api.setUser({id:'student-b',role:'student',status:'approved',full_name:'Other Student'});await flush();
 assert.equal(editorBody,'','another student must not inherit a draft');
 api.setUser({id:'student',role:'student',status:'approved',full_name:'Student'});await flush();
 assert.equal(editorBody,'student unsaved draft','owner draft remains isolated and restorable');
 api.setUser(null);
 console.log('PASS: study UI, stable note order, late list merges, coalesced reads, profile refresh, batch import and logout cancellation');
})().catch(error=>{console.error(error);process.exitCode=1;});
