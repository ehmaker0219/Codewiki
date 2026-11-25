const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

// Exercise the page's real event handlers without touching the browser's records or IndexedDB.
const nodes=new Map(),events={},location={hash:'#mentoring'};
let document,stored,storeCalls=0,failNext=false,pending=null,holdNext=false;
let downloadedFiles=[];
function element(id=''){
  let inert=false;
  const classes=new Set();
  return {id,tagName:'DIV',className:'',dataset:{},events:{},children:[],hidden:false,open:false,isConnected:true,value:'',textContent:'',innerHTML:'',scrollTop:0,attributes:{},href:'',download:'',
    classList:{add(c){classes.add(c);},remove(c){classes.delete(c);},toggle(c,force){if(force===undefined){if(classes.has(c))classes.delete(c);else classes.add(c);}else if(force)classes.add(c);else classes.delete(c);},contains(c){return classes.has(c);}},
    get inert(){return inert;},set inert(value){inert=value;if(value&&document)document.activeElement=document.body;},
    addEventListener(type,fn){this.events[type]=fn;},
    click(){if(this.download)downloadedFiles.push({download:this.download,href:this.href});},
    append(...items){this.children.push(...items);},prepend(...items){this.children.unshift(...items);},
    querySelector(selector){
      if(selector.startsWith('#'))return node(selector.slice(1));
      const action=/\[data-action=["']?([\w-]+)/.exec(selector);
      if(action)return node('action-'+action[1]);
      if(selector.includes('dialog'))return node('mentoringImport').open?node('mentoringImport'):null;
      return null;
    },querySelectorAll(){return [];},
    replaceChildren(){this.innerHTML='';this.children=[];},setAttribute(k,v){this.attributes[k]=String(v);},contains(other){return other?.inHost===true;},
    focus(){document.activeElement=this;},setSelectionRange(start,end,direction){this.selectionStart=start;this.selectionEnd=end;this.selectionDirection=direction;},
    close(){this.open=false;},showModal(){this.open=true;},
    closest(selector){
      if(selector==='button'&&this.tagName==='BUTTON')return this;
      if(selector==='.mentoring-folder-form'&&this.className.includes('mentoring-folder-form'))return this;
      if(selector==='[data-select]'&&this.dataset.select!==undefined)return this;
      if(selector==='[data-folder-filter]'&&this.dataset.folderFilter!==undefined)return this;
      return null;
    }
  };
}
function node(id){if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id);}
document={title:'코드위키',body:element('body'),activeElement:null,getElementById:node,querySelectorAll:()=>[],
  querySelector(selector){return selector.includes('dialog')&&node('mentoringImport').open?node('mentoringImport'):null;},
  addEventListener(type,fn){events[type]=fn;},createElement:()=>element()};
document.activeElement=document.body;
let copiedText='',printedTitles=[],pdfRequests=[];
const window={addEventListener(type,fn){events[type]=fn;},scrollTo(){},print(){printedTitles.push(document.title);},
  CodeWikiAuth:{getSessionToken:()=> 'test-session'},
  CodeWikiLearning:{escape:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))},
  CodeWikiMentoringPdf:{
    safePdfFilename:title=>String(title||'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')+'.pdf',
    async generate(report){pdfRequests.push(report);return new Blob(['%PDF-1.4'],{type:'application/pdf'});}
  }};
let uuidCounter=0;
const context=vm.createContext({window,document,location,structuredClone,Date,Intl,URL,Map,Set,setTimeout,clearTimeout,
  navigator:{clipboard:{async writeText(text){copiedText=text;}}},
  crypto:{randomUUID:()=> 'new-id-'+(++uuidCounter)},confirm:()=>true,history:{replaceState(_a,_b,hash){location.hash=hash;}}});
vm.runInContext(fs.readFileSync('js/mentoring-model.js','utf8'),context);
const model=window.CodeWikiMentoringModel,mentor=model.members[0],activityId='keyboard-test';
const taegyu=model.members.find(m=>m.name==='김태규'),yejin=model.members.find(m=>m.name==='이예진');
stored=model.apply(model.empty(),mentor.id,{type:'create',id:activityId,date:'2026-11-23'});
let activeStoreMentor=mentor.id;
window.CodeWikiMentoringTeamStore={create:actorId=>({
  read:async()=>structuredClone(stored),
  file:async()=>new Blob(['img']),
  async execute(command){
    storeCalls++;
    if(holdNext){holdNext=false;await new Promise(resolve=>{pending=resolve;});}
    if(failNext){failNext=false;throw Error('storage');}
    stored=model.apply(stored,actorId||activeStoreMentor,command);
    return structuredClone(stored);
  }
})};
vm.runInContext(fs.readFileSync('js/mentoring.js','utf8'),context);
const api=window.CodeWikiMentoring,host=node('mentoringPage');
const user={id:mentor.id,role:'student',status:'approved'};
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
function input(value,field='task'){
  const control=node('field-'+field);
  Object.assign(control,{tagName:'TEXTAREA',inHost:true,dataset:{scope:'activity',field},value,selectionStart:2,selectionEnd:4,selectionDirection:'forward'});
  document.activeElement=control;host.events.input({target:control});return control;
}
function shortcut(overrides={}){
  const event={key:'s',ctrlKey:true,metaKey:false,altKey:false,shiftKey:false,repeat:false,isComposing:false,defaultPrevented:false,target:document.activeElement,
    preventDefault(){this.defaultPrevented=true;},...overrides};
  events.keydown(event);return event;
}
function clickAction(action){const button=node('action-'+action);button.tagName='BUTTON';button.dataset.action=action;host.events.click({target:button});}
function clickSave(){clickAction('save');}
function hasUnsaved(){let prevented=false;events.beforeunload({preventDefault(){prevented=true;}});return prevented;}

(async()=>{
  api.setUser(user);await flush();
  assert.equal(typeof events.keydown,'function','mentoring must register a save shortcut');
  assert.equal(host.hidden,false);
  assert.ok(!node('mentoringEditor').innerHTML.includes('data-action="import"'),'study-note import button must be removed');
  assert.ok(!node('mentoringEditor').innerHTML.includes('내 공부방 필기 가져오기'),'study-note import label must be removed');
  assert.ok(!node('mentoringEditor').innerHTML.includes('data-field="nextPlan"'),'nextPlan field must be removed');
  assert.ok(!node('mentoringEditor').innerHTML.includes('data-field="summary"'),'closing summary section must be removed');
  assert.ok(!node('mentoringEditor').innerHTML.includes('data-field="sessionRound"'),'sessionRound input must be removed');
  assert.ok(!node('mentoringEditor').innerHTML.includes('data-field="goals"'),'goals field must be removed');
  assert.ok(!node('mentoringEditor').innerHTML.includes('data-field="result"'),'result description field must be removed');
  assert.ok(!node('mentoringEditor').innerHTML.includes('data-field="status"'),'status select must be removed');
  assert.ok(!node('mentoringList').innerHTML.includes('진행 중'),'list must not show status label');
  assert.ok(node('mentoringFolders').innerHTML.includes('전체 활동')&&node('mentoringFolders').innerHTML.includes('미분류'),'folder filing sidebar must render');
  assert.ok(!node('mentoringFolders').innerHTML.includes(' disabled'),'folder buttons must be enabled once initial load finishes');
  assert.ok(node('mentoringFolderMove').innerHTML.includes('mentoringMoveFolder'),'folder move select must render');
  assert.ok(!node('mentoringFolderMove').innerHTML.includes(' disabled'),'folder move select must be enabled once initial load finishes');
  assert.ok(node('mentoringProcess').innerHTML.includes('멘토링 process')&&node('mentoringProcess').innerHTML.includes('천승환 파트너님께 공지 및 구글시트 반영 확인')&&node('mentoringProcess').innerHTML.includes('구글시트-이은호에 탭 추가 및 작성'),'process checklist must render all steps');
  const field=input('Keyboard save body');holdNext=true;
  assert.equal(shortcut().defaultPrevented,true,'Ctrl+S must suppress the browser Save Page dialog');
  assert.equal(storeCalls,1);assert.equal(hasUnsaved(),true,'pending saves must retain the dirty state');
  shortcut();shortcut({repeat:true});assert.equal(storeCalls,1,'pending or repeated shortcuts must not duplicate writes');
  pending();await flush();
  assert.equal(stored.activities[0].task,'Keyboard save body');assert.equal(hasUnsaved(),false);
  assert.equal(document.activeElement,field,'saving should return focus to the same input');
  assert.deepEqual([field.selectionStart,field.selectionEnd],[2,4],'saving should preserve the text selection');
  assert.match(node('mentoringStatus').textContent,/마지막 저장/);
  // Trailing blur/change event with the already-saved value must NOT re-dirty the form.
  host.events.change({target:field});
  assert.equal(hasUnsaved(),false,'trailing change with identical value must not mark form dirty');
  const savedCalls=storeCalls;shortcut();await flush();assert.equal(storeCalls,savedCalls,'unchanged records should not write again');

  input('Command save body');shortcut({ctrlKey:false,metaKey:true,key:'S'});await flush();
  assert.equal(stored.activities[0].task,'Command save body','Command+S should save on macOS');
  input('Button save body');clickSave();await flush();assert.equal(stored.activities[0].task,'Button save body');

  input('Retry this body');failNext=true;shortcut();await flush();
  assert.equal(stored.activities[0].task,'Button save body');assert.equal(hasUnsaved(),true,'failed saves must keep the draft');
  assert.match(node('mentoringStatus').textContent,/처리하지 못|저장하지 못/);
  shortcut();await flush();assert.equal(stored.activities[0].task,'Retry this body');assert.equal(hasUnsaved(),false);

  input('Guarded body');const guardedCalls=storeCalls;
  for(const event of [{ctrlKey:false},{altKey:true},{shiftKey:true},{repeat:true},{isComposing:true},{defaultPrevented:true}])shortcut(event);
  node('mentoringImport').open=true;shortcut();node('mentoringImport').open=false;
  await flush();assert.equal(storeCalls,guardedCalls,'modified, composing, handled, repeat and dialog shortcuts must not save');
  location.hash='#study';events.hashchange();assert.equal(shortcut().defaultPrevented,false);await flush();assert.equal(storeCalls,guardedCalls);
  location.hash='#mentoring';events.hashchange();shortcut();await flush();assert.equal(stored.activities[0].task,'Guarded body');

  // Participant checkboxes, Discord template dialog (edit/copy/reset), and PDF default document.title.
  input('1회차_2주차_6반_3조_이은호','title');
  input('18:00','startTime');input('20:00','endTime');
  const participantBox=element('part-k');participantBox.dataset={participant:'김은철'};participantBox.checked=false;
  host.events.change({target:participantBox});
  assert.equal(node('mentoringParticipantCount').textContent,'3');
  clickAction('discord');
  assert.equal(node('mentoringDiscord').open,true);
  assert.match(node('mentoringDiscordText').value,/\[CL6 이은호 멘토링 1회차\]/);
  assert.match(node('mentoringDiscordText').value,/일시: 11\/23\(월\) 18:00 ~ 20:00/);
  assert.match(node('mentoringDiscordText').value,/참여 인원: 3명 \(이은호,김성재,김지수\)/);
  assert.match(node('mentoringDiscordText').value,/장소: CL6 강의장/);
  assert.match(node('mentoringDiscordPdfHint').textContent,/1회차_2주차_6반_3조_이은호 멘토링 활동 결과보고서\.pdf/);
  const callsDuringDiscord=storeCalls;shortcut();await flush();assert.equal(storeCalls,callsDuringDiscord,'Ctrl+S must not save while Discord modal is open');
  node('mentoringDiscordText').value+='\n추가 메모';
  clickAction('copy-discord');await flush();
  assert.match(copiedText,/추가 메모$/);
  clickAction('reset-discord');assert.ok(!node('mentoringDiscordText').value.includes('추가 메모'));
  clickAction('close-discord');assert.equal(node('mentoringDiscord').open,false);

  clickAction('pdf');await flush();
  assert.equal(printedTitles.length,0,'direct PDF download must not open browser print dialog');
  assert.equal(downloadedFiles.length,1,'PDF save must trigger direct file download');
  assert.equal(downloadedFiles[0].download,'1회차_2주차_6반_3조_이은호 멘토링 활동 결과보고서.pdf');
  assert.equal(pdfRequests[0].mentorName,'이은호');
  // Report preview renders image gallery (multi-column) and non-image attachment cards cleanly.
  stored.activities[0].attachments=[
    {id:'img-1',name:'capture1.png',type:'image/png',size:2048},
    {id:'img-2',name:'capture2.webp',type:'image/webp',size:4096},
    {id:'doc-1',name:'report.pdf',type:'application/pdf',size:1536*1024}
  ];
  node('report-files').children=[];
  clickAction('refresh');await flush();
  clickAction('preview');await flush();
  assert.ok(!node('mentoringReport').innerHTML.includes('활동 목표'),'report must omit removed goals section');
  assert.ok(!node('mentoringReport').innerHTML.includes('활동 마무리'),'report must omit removed closing section');
  assert.ok(!node('mentoringReport').innerHTML.includes('결과물 설명'),'report must omit removed result description section');
  assert.ok(!node('mentoringReport').innerHTML.includes('진행 중')&&!node('mentoringReport').innerHTML.includes('완료'),'report must omit status label');
  assert.ok(!node('mentoringReport').innerHTML.includes('멘토링 process'),'report must omit internal process checklist');
  assert.match(node('mentoringReport').innerHTML,/첨부 자료 \(3건\)/);
  assert.equal(node('report-files').children.length,2,'images gallery and non-image file list rendered separately');
  assert.equal(node('report-files').children[0].className,'mentoring-report-gallery is-multi');
  assert.equal(node('report-files').children[0].children.length,2);
  assert.equal(node('report-files').children[1].className,'mentoring-report-file-list');
  assert.equal(node('report-files').children[1].children[0].children[0].textContent,'PDF');
  assert.equal(document.title,'1회차_2주차_6반_3조_이은호 멘토링 활동 결과보고서');
  clickAction('pdf');await flush();
  assert.equal(pdfRequests.at(-1).images.length,2,'direct PDF export must include previewable images');
  assert.equal(pdfRequests.at(-1).otherFiles.length,1,'direct PDF export must include non-image files');
  clickAction('preview');await flush();
  assert.equal(document.title,'코드위키','returning to editor restores original page title');
  clickAction('preview');await flush();
  assert.equal(document.title,'1회차_2주차_6반_3조_이은호 멘토링 활동 결과보고서');
  document.title='다른 문서 | 코드위키';
  location.hash='#doc/abap-dictionary';events.hashchange();
  assert.equal(document.title,'다른 문서 | 코드위키','leaving mentoring must not clobber another page title');
  assert.equal(node('mentoringReport').hidden,true,'leaving mentoring during report preview resets report panel');
  assert.equal(node('mentoringEditor').hidden,false,'returning to mentoring shows editor instead of revoked report blobs');
  document.title='코드위키';
  location.hash='#mentoring';events.hashchange();

  // Folder filing: collapse toggle, create/rename/duplicate/delete, dropdown & drag-and-drop move preserving unsaved drafts.
  clickAction('toggle-library');
  assert.equal(node('mentoringLibraryContent').hidden,true,'toggle must collapse library');
  assert.equal(node('mentoringLayout').classList.contains('library-collapsed'),true);
  clickAction('toggle-library');
  assert.equal(node('mentoringLibraryContent').hidden,false,'toggle must expand library');

  const clickFolderAction=act=>{const b=element();b.tagName='BUTTON';b.dataset={folderAction:act};host.events.click({target:b});};
  const clickFolderFilter=filter=>{const b=element();b.tagName='BUTTON';b.dataset={folderFilter:filter};host.events.click({target:b});};
  const submitFolder=name=>{
    node('mentoringFolderName').value=name;
    const form=element();form.className='mentoring-folder-form';
    host.events.submit({target:form,preventDefault(){}});
  };
  input('Unsaved draft kept across folder ops');
  clickFolderAction('new');
  submitFolder('ABAP 기초');await flush();
  assert.equal(stored.folders.length,1);
  const f1Id=stored.folders[0].id;
  assert.ok(node('mentoringFolders').innerHTML.includes('ABAP 기초'));
  assert.ok(!node('mentoringFolders').innerHTML.includes(' disabled'),'folder controls must re-enable after folder creation');
  assert.equal(hasUnsaved(),true,'creating a folder must not lose unsaved activity edits');
  assert.ok(!node('mentoringList').innerHTML.includes('1회차_2주차_6반_3조_이은호'),'selected empty folder filters out unfiled activity');

  // Move via dropdown while dirty — draft stays intact and Ctrl+S succeeds with no conflict.
  const moveSel=node('mentoringMoveFolder');moveSel.value=f1Id;
  host.events.change({target:moveSel});await flush();
  assert.equal(stored.folderAssignments[activityId],f1Id);
  assert.ok(!node('mentoringFolderMove').innerHTML.includes(' disabled'),'folder move select must re-enable after move');
  assert.equal(hasUnsaved(),true,'moving activity to folder must preserve unsaved draft');
  assert.ok(node('mentoringList').innerHTML.includes('1회차_2주차_6반_3조_이은호'),'moved activity appears in selected folder');
  shortcut();await flush();
  assert.equal(stored.activities[0].task,'Unsaved draft kept across folder ops','saving after folder move must succeed without conflict');
  assert.equal(hasUnsaved(),false);

  // Creating a new activity while a folder is selected files it into that folder.
  clickAction('new');await flush();
  const createdId=stored.activities[0].id;
  assert.equal(stored.folderAssignments[createdId],f1Id,'new activity inside selected folder must be assigned to that folder');

  // Drag-and-drop: ignore external drops and drops on 'all', move on valid target folder.
  const unfiledTarget=element();unfiledTarget.dataset={folderFilter:''};
  let extPrevented=false;
  host.events.drop({target:unfiledTarget,preventDefault(){extPrevented=true;}});await flush();
  assert.equal(extPrevented,false,'external drop without local drag must be ignored');
  assert.equal(stored.folderAssignments[createdId],f1Id);

  const dragBtn=element();dragBtn.dataset={select:createdId};
  host.events.dragstart({target:dragBtn,preventDefault(){},dataTransfer:{setData(){}}});
  assert.equal(dragBtn.classList.contains('dragging'),true);
  const allTarget=element();allTarget.dataset={folderFilter:'all'};
  let allPrevented=false;
  host.events.dragover({target:allTarget,preventDefault(){allPrevented=true;},dataTransfer:{}});
  assert.equal(allPrevented,false,'all folder must not accept drops');
  let validPrevented=false;
  host.events.dragover({target:unfiledTarget,preventDefault(){validPrevented=true;},dataTransfer:{}});
  assert.equal(validPrevented,true);assert.equal(unfiledTarget.classList.contains('drag-over'),true);
  host.events.drop({target:unfiledTarget,preventDefault(){}});await flush();
  assert.equal(stored.folderAssignments[createdId],undefined,'dropping on unfiled must remove folder assignment');
  assert.equal(dragBtn.classList.contains('dragging'),false);assert.equal(unfiledTarget.classList.contains('drag-over'),false);

  // Rename + duplicate check + delete folder (unfiles activities without deleting them).
  clickFolderAction('rename');submitFolder('ABAP 심화');await flush();
  assert.equal(stored.folders[0].name,'ABAP 심화');
  clickFolderAction('new');submitFolder('abap 심화');await flush();
  assert.equal(stored.folders.length,1,'case-insensitive duplicate folder name must be rejected');
  assert.match(node('mentoringFolders').innerHTML,/같은 이름/);
  clickFolderAction('cancel');
  clickFolderFilter(f1Id);
  clickFolderAction('delete');await flush();
  assert.equal(stored.folders.length,0);
  assert.equal(stored.folderAssignments[activityId],undefined,'deleting folder must unfile its activities');
  assert.equal(stored.activities.length,2,'deleting folder must not delete activities');

  // Mentoring process checklist persists immediately without clobbering unsaved edits or causing save conflicts.
  const activeActId=stored.activities[0].id;
  input('Draft preserved during checklist toggle');
  const stepBox=element('mentoringStep-notice');stepBox.dataset={processStep:'notice'};stepBox.checked=true;
  host.events.change({target:stepBox});await flush();
  assert.deepEqual(Array.from(stored.checklists[activeActId]),['notice']);
  assert.match(node('mentoringProcess').innerHTML,/1 \/ 6/);
  assert.equal(hasUnsaved(),true,'toggling process checklist must preserve unsaved draft');
  shortcut();await flush();
  assert.equal(stored.activities[0].task,'Draft preserved during checklist toggle','saving after checklist toggle must succeed without conflict');
  assert.equal(hasUnsaved(),false);

  input('Save without stealing focus');holdNext=true;shortcut();
  const otherControl=node('other-control');document.activeElement=otherControl;pending();await flush();
  assert.equal(document.activeElement,otherControl,'finishing a save must not take focus back from another control');

  input('Save from old session');holdNext=true;shortcut();const callsAtLogout=storeCalls;
  api.setUser(null);pending();await flush();
  assert.equal(host.hidden,true);assert.equal(host.inert,false);assert.equal(shortcut().defaultPrevented,false);assert.equal(storeCalls,callsAtLogout);
  assert.equal(document.activeElement,document.body,'finishing an old-session save must not restore its input focus');
  api.setUser(user);await flush();assert.equal(hasUnsaved(),false,'old session completion must not restore its dirty draft');
  api.setUser(null);
  stored=model.empty();api.setUser(user);await flush();const emptyCalls=storeCalls;shortcut();await flush();assert.equal(storeCalls,emptyCalls,'empty mentoring pages have no record to save');

  // Additional mentors (김태규, 이예진) render their own defaults (badge, title, participants, process step 6, Discord, report author).
  for(const [other,expectedTitle,expectedPeople] of [
    [taegyu,'1회차_N주차_6반_1조_김태규','김태규,최영환,박찬규'],
    [yejin,'1회차_N주차_6반_2조_이예진','이예진,김하임,이수현']
  ]){
    activeStoreMentor=other.id;
    stored=model.apply(model.empty(),other.id,{type:'create',id:'act-'+other.id,date:'2026-11-25'});
    api.setUser({id:other.id,role:'student',status:'approved'});await flush();
    assert.equal(host.hidden,false,other.name+' must have mentoring access');
    assert.ok(host.innerHTML.includes(other.name+' · 멘토'),'header badge must show logged-in mentor name');
    assert.ok(node('mentoringEditor').innerHTML.includes(expectedTitle),'default title must use mentor name');
    assert.ok(node('mentoringProcess').innerHTML.includes('구글시트-'+other.name+'에 탭 추가 및 작성'),'process step 6 must use mentor name');
    clickAction('discord');
    assert.match(node('mentoringDiscordText').value,new RegExp('\\[CL6 '+other.name+' 멘토링 1회차\\]'));
    assert.ok(node('mentoringDiscordText').value.includes('('+expectedPeople+')'));
    clickAction('close-discord');
    clickAction('preview');await flush();
    assert.ok(node('mentoringReport').innerHTML.includes('<dd>'+other.name+'</dd>'),'report author must show logged-in mentor name');
    api.setUser(null);
  }
  console.log('PASS: mentoring Ctrl/Command+S, button save, pending/repeat guards, no-op writes, failure retry, route/dialog/session isolation, multi-mentor defaults and empty state');
})().catch(error=>{console.error(error);process.exitCode=1;});
