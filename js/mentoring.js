/* Mentor-only local notebook. No mentoring data is sent to production. */
(() => {
  const model=window.CodeWikiMentoringModel,{participantsFor,defaultLocation,defaultStartTime,defaultEndTime,processStepsFor,startTimes,endTimes,key,member,pdfFileTitle,resolveParticipants,formatDiscordTemplate}=model;
  const host=document.getElementById('mentoringPage'),trigger=document.getElementById('openMentoringBtn'),shell=document.getElementById('appShell');
  const esc=window.CodeWikiLearning.escape;
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('cw-mentoring-team-local'):null;
  const savedDateFormat=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const activityDateFormat=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'});
  const folderCollator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
  const folderIcon='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 5h6l2 3h10v12H3z" stroke-linejoin="round"/></svg>';
  const toggleIcon='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>';
  const shortDate=v=>{if(!v)return '—';const date=new Date(v);return Number.isNaN(date.getTime())?'—':savedDateFormat.format(date);};
  const today=()=>activityDateFormat.format(new Date());
  let session=null,actor=null,store=null,state=model.empty(),selected=null,editing=null,dirty=false;
  const uploads=new Map();
  let loaded=false,busy=false,preview=false,version=0,urls=[],importVersion=0;
  let savedDocTitle=null,appliedDocTitle='';
  let libraryCollapsed=false,folderFilter='all',folderEditing=null,renderedFolderEditId=null,folderMessage='',folderMarkup='',folderMoveMarkup='',listMarkup='';
  let draggedActivity=null,dragSource=null,dropTarget=null;
  const $=id=>host.querySelector('#'+id);
  const visible=()=>Boolean(session)&&location.hash==='#mentoring';
  const activity=()=>state.activities.find(a=>a.id===selected);
  const folderList=()=>Array.isArray(state.folders)?state.folders:[];
  const folderOf=id=>{
    const assigned=state.folderAssignments?.[id]||'';
    return assigned&&folderList().some(f=>f.id===assigned)?assigned:'';
  };
  const checkedStepsOf=id=>Array.isArray(state.checklists?.[id])?state.checklists[id]:[];
  const includesActivity=a=>folderFilter==='all'||folderOf(a.id)===folderFilter;
  function clearDragTarget(){dropTarget?.classList?.remove('drag-over');dropTarget=null;}
  function clearDragState(){clearDragTarget();dragSource?.classList?.remove('dragging');dragSource=null;draggedActivity=null;}
  function normalizeFolderFilter(){
    if(folderFilter!=='all'&&folderFilter!==''&&!folderList().some(f=>f.id===folderFilter))folderFilter='';
  }
  function applyReportTitle(title){
    const next=pdfFileTitle(title);
    if(savedDocTitle===null)savedDocTitle=document.title||'';
    appliedDocTitle=next;
    document.title=next;
  }
  function restoreReportTitle(){
    if(savedDocTitle!==null&&document.title===appliedDocTitle)document.title=savedDocTitle;
    savedDocTitle=null;appliedDocTitle='';
  }
  function hydrateActivity(a){
    const copy=structuredClone(a);
    const missingTimes=copy.startTime===undefined&&copy.endTime===undefined;
    return {
      startTime:missingTimes?defaultStartTime:'',endTime:missingTimes?defaultEndTime:'',goals:'',result:'',code:'',summary:'',nextPlan:'',attachments:[],...copy,
      participants:resolveParticipants(copy,actor),
      participantsVersion:2,
      location:typeof copy.location==='string'?copy.location:defaultLocation
    };
  }
  function lastChange(){
    const times=[activity()?.updatedAt];
    for(const collection of [state.drafts,state.submissions,state.feedback])for(const item of Object.values(collection))if(item.activity===selected)times.push(item.updatedAt);
    times.push(...state.comments.filter(c=>c.activity===selected).map(c=>c.createdAt));
    return times.filter(Boolean).sort().at(-1);
  }
  const button=(action,label,primary=false)=>`<button type="button" class="${primary?'toss-primary-btn':'toss-chip-btn'}" data-action="${action}"${action==='save'?' title="저장 (Ctrl+S / ⌘S)" aria-keyshortcuts="Control+s Meta+s"':''}>${label}</button>`;
  function status(message){if($('mentoringStatus'))$('mentoringStatus').textContent=message;}
  function revoke(){urls.forEach(u=>URL.revokeObjectURL(u));urls=[];}
  function resetEditing(){
    const a=activity();dirty=false;uploads.clear();preview=false;revoke();restoreReportTitle();
    editing=a?{activity:hydrateActivity(a)}:null;
  }
  function setUser(user){
    const token=window.CodeWikiAuth?.getSessionToken();
    const valid=user?.role==='student'&&user.status==='approved'&&token&&member(user.id);
    if(valid&&session?.id===user.id&&session.token===token)return;
    version++;importVersion++;revoke();restoreReportTitle();clearDragState();$('mentoringImport')?.close();$('mentoringDiscord')?.close();
    session=valid?{id:user.id,token}:null;actor=valid?member(user.id):null;
    store=actor?window.CodeWikiMentoringTeamStore.create(actor.id):null;
    state=model.empty();selected=null;editing=null;dirty=false;preview=false;importItems=[];uploads.clear();loaded=false;busy=false;host.inert=false;
    libraryCollapsed=false;folderFilter='all';folderEditing=null;renderedFolderEditId=null;folderMessage='';folderMarkup='';folderMoveMarkup='';listMarkup='';
    host.replaceChildren();trigger.hidden=!session;route();
  }
  function setLibraryCollapsed(collapsed){
    libraryCollapsed=Boolean(collapsed);
    $('mentoringLayout')?.classList.toggle('library-collapsed',libraryCollapsed);
    if($('mentoringLibraryContent'))$('mentoringLibraryContent').hidden=libraryCollapsed;
    const toggle=$('mentoringLibraryToggle'),label=libraryCollapsed?'내 활동 펼치기':'내 활동 접기';
    if(toggle){
      toggle.setAttribute('aria-expanded',String(!libraryCollapsed));
      toggle.setAttribute('aria-label',label);
      toggle.title=label;
    }
  }
  function frame(){
    folderMarkup='';folderMoveMarkup='';listMarkup='';renderedFolderEditId=null;
    host.innerHTML=`<header class="mentoring-heading"><div><span class="mentoring-eyebrow">MENTORING NOTES</span><h1>내 멘토링</h1><p>진행한 활동과 결과물을 기록하고 보고서로 정리하세요.</p></div><span class="mentoring-role">${esc(actor.name)} · 멘토</span></header>
      <div class="mentoring-layout" id="mentoringLayout"><aside class="mentoring-library" aria-label="내 활동 기록"><div class="mentoring-library-heading"><h2>내 활동</h2><div class="mentoring-library-actions"><button type="button" id="mentoringNew" class="toss-primary-btn" data-action="new">+ 새 활동</button><button type="button" id="mentoringLibraryToggle" class="mentoring-library-toggle" data-action="toggle-library" aria-controls="mentoringLibraryContent" aria-expanded="true" aria-label="내 활동 접기" title="내 활동 접기">${toggleIcon}</button></div></div>
      <div class="mentoring-library-content" id="mentoringLibraryContent"><label class="sr-only" for="mentoringSearch">활동 검색</label><input id="mentoringSearch" type="search" placeholder="활동 제목 검색"><div id="mentoringFolders" class="mentoring-folders"></div><div id="mentoringList" class="mentoring-list"></div></div></aside><div class="mentoring-main">
      <div class="mentoring-actions"><span id="mentoringStatus" role="status"></span><div class="mentoring-action-buttons">${button('refresh','새로고침')}<span class="mentoring-action-divider" aria-hidden="true"></span>${button('discord','디스코드 양식')}${button('preview','결과보고서')}${button('pdf','PDF 저장')}${button('save','저장',true)}</div></div>
      <div id="mentoringUpdates" class="mentoring-help" role="status" hidden>새 내용이 있습니다. 새로고침하면 확인할 수 있습니다.</div>
      <div id="mentoringEditor"></div><article id="mentoringReport" class="mentoring-report" hidden></article></div></div>
      <dialog id="mentoringImport" class="profile-dialog" aria-labelledby="mentoringImportTitle"><div class="profile-dialog-header"><h2 id="mentoringImportTitle">내 기록 가져오기</h2>${button('close-import','닫기')}</div><p class="mentoring-help" id="mentoringImportHelp"></p><div id="mentoringImportList"></div></dialog>
      <dialog id="mentoringDiscord" class="profile-dialog mentoring-discord-dialog" aria-labelledby="mentoringDiscordTitle"><div class="profile-dialog-header"><h2 id="mentoringDiscordTitle">디스코드 제출 양식</h2>${button('close-discord','닫기')}</div><p class="mentoring-help" id="mentoringDiscordHelp"></p><label class="sr-only" for="mentoringDiscordText">디스코드 제출 메시지</label><textarea id="mentoringDiscordText" class="mentoring-discord-textarea" rows="12"></textarea><p class="mentoring-help mentoring-discord-pdf-hint" id="mentoringDiscordPdfHint"></p><p id="mentoringDiscordStatus" class="mentoring-discord-status" role="status"></p><div class="mentoring-discord-actions">${button('reset-discord','다시 생성')}${button('pdf-from-discord','PDF 저장')}${button('copy-discord','클립보드 복사',true)}</div></dialog>`;
    setLibraryCollapsed(libraryCollapsed);
  }
  const formatTimeRange=a=>a?.startTime&&a?.endTime?`${a.startTime} ~ ${a.endTime}`:'';
  function timeSelect(name,label,value,options,minAfter=''){
    return `<select data-scope="activity" data-field="${name}" aria-label="활동 ${label} 시간"><option value="">${label}</option>${options.map(t=>`<option value="${t}"${value===t?' selected':''}${minAfter&&t<=minAfter?' disabled':''}>${t}</option>`).join('')}</select>`;
  }
  function renderFolders(){
    const el=$('mentoringFolders');if(!el)return;
    normalizeFolderFilter();
    const activeEl=document.activeElement;
    const sameForm=Boolean(folderEditing)&&renderedFolderEditId===folderEditing.id;
    const input=sameForm?el.querySelector?.('#mentoringFolderName'):null;
    const hadFocus=Boolean(input)&&input===activeEl;
    const selStart=hadFocus&&typeof input.selectionStart==='number'?input.selectionStart:null;
    const selEnd=hadFocus&&typeof input.selectionEnd==='number'?input.selectionEnd:null;
    const focusedFilter=!hadFocus&&activeEl?.dataset?.folderFilter!==undefined&&el.contains?.(activeEl)?activeEl.dataset.folderFilter:null;
    if(sameForm&&input&&typeof input.value==='string')folderEditing={...folderEditing,name:input.value};
    const folders=[...folderList()].sort((a,b)=>folderCollator.compare(a.name,b.name));
    const counts=new Map();
    for(const a of state.activities)counts.set(folderOf(a.id),(counts.get(folderOf(a.id))||0)+1);
    const disabled=!loaded||busy,selectedFolder=folders.find(f=>f.id===folderFilter);
    const link=(id,name,count)=>`<button type="button" data-folder-filter="${esc(id)}" class="mentoring-folder-link${folderFilter===id?' active':''}" aria-pressed="${folderFilter===id}" ${disabled?'disabled':''}>${folderIcon}<span>${esc(name)}</span><small>${count}</small></button>`;
    const html=`<div class="mentoring-folder-heading"><span>폴더</span><div><button type="button" data-folder-action="reload" aria-label="폴더 새로고침" title="폴더 새로고침" ${busy?'disabled':''}>↻</button><button type="button" data-folder-action="new" ${disabled?'disabled':''}>+ 새 폴더</button></div></div>
      <nav aria-label="내 활동 폴더">${link('all','전체 활동',state.activities.length)}${link('','미분류',counts.get('')||0)}${folders.map(f=>link(f.id,f.name,counts.get(f.id)||0)).join('')}</nav>
      ${selectedFolder?`<div class="mentoring-folder-actions"><button type="button" data-folder-action="rename" ${disabled?'disabled':''}>이름 변경</button><button type="button" data-folder-action="delete" ${disabled?'disabled':''}>폴더 삭제</button></div>`:''}
      ${folderEditing?`<form class="mentoring-folder-form"><label for="mentoringFolderName">${folderEditing.revision?'폴더 이름 변경':'새 폴더 이름'}</label><input id="mentoringFolderName" maxlength="60" required value="${esc(folderEditing.name)}" ${busy?'disabled':''}><div><button type="submit" ${busy?'disabled':''}>${busy?'저장 중…':'확인'}</button><button type="button" data-folder-action="cancel" ${busy?'disabled':''}>취소</button></div></form>`:''}
      <p class="mentoring-folder-status" role="status">${esc(folderMessage)}</p>`;
    if(folderMarkup!==html){
      el.innerHTML=html;folderMarkup=html;renderedFolderEditId=folderEditing?folderEditing.id:null;
      if(hadFocus){
        const next=el.querySelector?.('#mentoringFolderName');
        next?.focus({preventScroll:true});
        try{const start=selStart??next.value.length,end=selEnd??next.value.length;next?.setSelectionRange?.(start,end);}catch{}
      }else if(focusedFilter!==null){
        const target=[...(el.querySelectorAll?.('[data-folder-filter]')||[])].find(node=>node.dataset?.folderFilter===focusedFilter);
        target?.focus({preventScroll:true});
      }
    }
  }
  function renderFolderMove(){
    const el=$('mentoringFolderMove');if(!el)return;
    const current=activity();
    const focusedMove=document.activeElement?.id==='mentoringMoveFolder'&&el.contains?.(document.activeElement);
    const folders=[...folderList()].sort((a,b)=>folderCollator.compare(a.name,b.name));
    const currentFolder=current?folderOf(current.id):'';
    const disabled=!loaded||busy||!current;
    const html=`<label for="mentoringMoveFolder">폴더</label><select id="mentoringMoveFolder" aria-label="활동을 폴더로 이동" ${disabled?'disabled':''} title="선택한 폴더로 이동"><option value="">미분류</option>${folders.map(f=>`<option value="${esc(f.id)}"${currentFolder===f.id?' selected':''}>${esc(f.name)}</option>`).join('')}</select>`;
    if(folderMoveMarkup!==html){
      el.innerHTML=html;folderMoveMarkup=html;
      if(focusedMove)el.querySelector?.('#mentoringMoveFolder')?.focus({preventScroll:true});
    }
  }
  function renderList(){
    const listEl=$('mentoringList');if(!listEl)return;
    const query=$('mentoringSearch').value.trim().toLocaleLowerCase();
    const items=state.activities.filter(a=>includesActivity(a)&&a.title.toLocaleLowerCase().includes(query));
    const emptyText=query?'검색 결과가 없습니다.':(folderFilter!=='all'&&state.activities.length?'이 폴더에 활동이 없습니다.':'등록된 활동이 없습니다.');
    const markup=items.map(a=>{const range=formatTimeRange(a);return `<button type="button" class="mentoring-record${a.id===selected?' active':''}" data-select="${esc(a.id)}" aria-pressed="${a.id===selected}" draggable="true" title="폴더로 드래그하여 이동"><strong>${esc(a.title)}</strong><span>${esc(a.date)}${range?' · '+esc(range):''}</span></button>`;}).join('')||`<p class="mentoring-help">${emptyText}</p>`;
    if(markup===listMarkup)return;
    const scrollTop=listEl.scrollTop;
    listEl.innerHTML=markup;listMarkup=markup;
    listEl.scrollTop=scrollTop;
  }
  function field(name,label,value,kind='textarea'){
    const attrs=`data-scope="activity" data-field="${name}"`;
    return `<label class="mentoring-field"><span>${label}</span>${kind==='textarea'?`<textarea ${attrs} rows="4" maxlength="100000">${esc(value||'')}</textarea>`:`<input ${attrs} type="${kind}" maxlength="120" value="${esc(value||'')}">`}</label>`;
  }
  function textBlock(label,value,code=false){return `<section class="mentoring-text-block"><h3>${label}</h3><${code?'pre':'div'} class="mentoring-report-text">${esc(value||'아직 작성하지 않았습니다.')}</${code?'pre':'div'}></section>`;}
  function formatFileSize(bytes){
    const size=Math.max(0,Number(bytes)||0);
    if(size>=1024*1024)return (size/(1024*1024)).toFixed(1).replace(/\.0$/,'')+' MB';
    return Math.max(1,Math.ceil(size/1024))+' KB';
  }
  function isPreviewableImage(file){
    if(['image/png','image/jpeg','image/webp','image/gif'].includes(file?.type))return true;
    return !file?.type&&/\.(?:png|jpe?g|webp|gif)$/i.test(String(file?.name||''));
  }
  function fileExtensionLabel(name){
    const match=/\.([a-z0-9]{1,6})$/i.exec(String(name||'').trim());
    return match?match[1].toUpperCase():'FILE';
  }
  function attachments(items,owner,editable=false){
    return items.map(f=>`<div class="mentoring-attachment"><span>${esc(f.name)} <small>${formatFileSize(f.size)}</small></span><button type="button" data-download="${esc(f.id)}" data-owner="${esc(owner)}">내려받기</button>${editable?`<button type="button" data-remove="${esc(f.id)}">제거</button>`:''}</div>`).join('');
  }
  function archive(){
    const subs=Object.values(state.submissions).filter(v=>v.activity===selected),comments=state.comments.filter(c=>c.activity===selected);
    if(!subs.length&&!comments.length)return '';
    const names={'d181e98f-1459-4a0f-b696-befb30e35327':'김성재','fdd0fbb5-cc2d-4f74-94af-56d4d507d65f':'김은철',[actor.id]:actor.name};
    return '<details class="mentoring-archive"><summary>이전 공유 기록 보관</summary><p class="mentoring-help">기존에 공유된 내용만 보관합니다. 새 제출이나 댓글은 받지 않습니다.</p>'+subs.map(sub=>textBlock(esc(names[sub.owner]||'이전 참여자'),sub.body)+(sub.code?textBlock('코드',sub.code,true):'')+textBlock('소감',sub.reflection)+attachments(sub.attachments||[],sub.owner)+textBlock('기존 피드백',state.feedback[key(selected,sub.owner)]?.body)).join('')+comments.map(c=>textBlock(esc(names[c.author]||'이전 참여자')+' · '+shortDate(c.createdAt),c.body)).join('')+'</details>';
  }
  function renderProcess(){
    const el=$('mentoringProcess');if(!el)return;
    const current=activity();if(!current){el.innerHTML='';return;}
    const steps=processStepsFor(actor);
    const checked=new Set(checkedStepsOf(current.id));
    const doneCount=steps.filter(s=>checked.has(s.id)).length;
    const allDone=doneCount===steps.length;
    el.innerHTML=`<div class="mentoring-section-title mentoring-process-header"><h2>멘토링 process</h2><span class="mentoring-process-badge${allDone?' is-done':''}" id="mentoringProcessCount">${doneCount} / ${steps.length}${allDone?' 완료':''}</span></div>`+
      `<ol class="mentoring-process-list">${steps.map((step,index)=>{
        const isChecked=checked.has(step.id);
        return `<li class="mentoring-process-item${isChecked?' is-checked':''}"><label for="mentoringStep-${esc(step.id)}"><input type="checkbox" id="mentoringStep-${esc(step.id)}" data-process-step="${esc(step.id)}"${isChecked?' checked':''}><span class="mentoring-process-num">${index+1}.</span><span class="mentoring-process-label">${esc(step.label)}</span></label></li>`;
      }).join('')}</ol>`;
  }
  function render(){
    renderFolders();renderList();revoke();preview=false;restoreReportTitle();$('mentoringReport').hidden=true;$('mentoringEditor').hidden=false;
    host.querySelector('[data-action=preview]').textContent='결과보고서';
    for(const action of ['save','preview','pdf','discord'])host.querySelector('[data-action='+action+']').disabled=!activity();
    if(!activity()){folderMoveMarkup='';$('mentoringEditor').innerHTML='<div class="mentoring-empty"><h2>첫 활동을 만들어 주세요</h2><p>진행 내용과 결과물을 기록해 보고서로 정리하세요.</p>'+button('new','+ 활동 만들기',true)+'</div>';return;}
    const a=editing.activity;
    const presetParticipants=participantsFor(actor);
    const participants=Array.isArray(a.participants)?a.participants:[...presetParticipants];
    const chipNames=[...presetParticipants,...participants.filter(name=>!presetParticipants.includes(name))];
    folderMoveMarkup='';
    $('mentoringEditor').innerHTML='<div class="mentoring-form"><section class="mentoring-form-section mentoring-process-section" id="mentoringProcess" aria-label="멘토링 process 체크리스트"></section>'+
      '<section class="mentoring-form-section"><div class="mentoring-section-title"><h2>활동 정보</h2><div id="mentoringFolderMove" class="mentoring-folder-move"></div></div>'+
      '<div class="mentoring-fields mentoring-identity-fields">'+field('title','활동 제목',a.title,'text')+field('date','활동 날짜',a.date,'date')+'<div class="mentoring-field"><span id="mentoringTimeLabel">활동 시간</span><div class="mentoring-time-range" role="group" aria-labelledby="mentoringTimeLabel">'+timeSelect('startTime','시작',a.startTime,startTimes)+'<span class="mentoring-time-sep" aria-hidden="true">~</span>'+timeSelect('endTime','종료',a.endTime,endTimes,a.startTime)+'</div></div></div>'+
      '<div class="mentoring-fields mentoring-meta-fields"><label class="mentoring-field"><span>장소</span><input data-scope="activity" data-field="location" type="text" maxlength="120" placeholder="'+esc(defaultLocation)+'" value="'+esc(a.location??defaultLocation)+'"></label><div class="mentoring-field"><span id="mentoringParticipantsLabel">참여 인원 (<span id="mentoringParticipantCount">'+participants.length+'</span>명)</span><div class="mentoring-participants" role="group" aria-labelledby="mentoringParticipantsLabel">'+chipNames.map(name=>`<label class="mentoring-participant-chip"><input type="checkbox" data-participant="${esc(name)}"${participants.includes(name)?' checked':''}><span>${esc(name)}</span></label>`).join('')+'</div></div></div></section>'+
      '<section class="mentoring-form-section"><div class="mentoring-section-title"><h2>진행 내용</h2><div class="mentoring-inline-actions">'+button('legacy','이전 개인 기록 가져오기')+'</div></div>'+field('task','활동 내용',a.task)+'</section>'+
      '<section class="mentoring-form-section"><div class="mentoring-section-title"><h2>결과물</h2></div>'+field('code','작성한 코드',a.code)+
      '<div class="mentoring-upload"><label for="mentoringFiles">파일 첨부</label><input type="file" id="mentoringFiles" aria-describedby="mentoringFileHelp" multiple><p class="mentoring-help" id="mentoringFileHelp">파일당 5MB · 활동당 20MB, 10개까지</p></div><div id="mentoringOwnFiles">'+attachments(a.attachments,actor.id,true)+'</div></section>'+archive()+'<footer class="mentoring-form-footer">'+button('delete','활동 삭제')+'</footer></div>';
    renderProcess();
    renderFolderMove();
    if(!dirty)status('마지막 저장 · '+shortDate(lastChange()));
  }
  async function load(){
    const ticket=version,db=store;const data=await db.read();if(ticket!==version)throw Error('session-changed');
    state=data;loaded=true;normalizeFolderFilter();folderEditing=null;folderMessage='';
    selected=state.activities.some(a=>a.id===selected)?selected:state.activities[0]?.id||null;
    resetEditing();render();status('로컬 기록을 불러왔습니다.');
  }
  function errorMessage(error){return ({conflict:'다른 탭에서 이 항목을 수정했습니다. 입력 내용을 복사한 뒤 새로고침해 주세요.',forbidden:'현재 역할에서는 수정할 수 없습니다.',title:'활동 제목을 입력해 주세요.',time:'활동 시작·종료 시간을 올바르게 선택해 주세요.',invalid:'입력한 날짜와 내용을 확인해 주세요.',files:'첨부파일 크기나 개수 제한을 확인해 주세요.',missing:'활동을 찾지 못했습니다. 새로고침해 주세요.','folder-name':'폴더 이름을 입력해 주세요.','duplicate-folder':'같은 이름의 폴더가 있습니다.','canvas-export-unavailable':'PDF 파일을 생성하지 못했습니다. 새로고침한 뒤 다시 시도해 주세요.'})[error.message]||'처리하지 못했습니다. 브라우저 저장 공간을 확인하고 다시 시도해 주세요.';}
  function folderErrorMessage(error){return ({'duplicate-folder':'같은 이름의 폴더가 있습니다.','folder-name':'폴더 이름을 입력해 주세요.',conflict:'폴더가 다른 탭에서 변경되었습니다. 폴더를 새로고침해 주세요.',missing:'폴더나 활동을 찾지 못했습니다. 폴더를 새로고침해 주세요.'})[error?.message]||'변경 결과를 확인하지 못했습니다. 폴더를 새로고침한 뒤 시도해 주세요.';}
  async function run(fn){
    if(busy||!visible())return;const ticket=version;
    const focused=host.contains(document.activeElement)?document.activeElement:null;
    const focusedId=focused?.id||'';
    const selection=typeof focused?.selectionStart==='number'?[focused.selectionStart,focused.selectionEnd,focused.selectionDirection]:null;
    let focusTarget=null;
    busy=true;host.inert=true;
    try{focusTarget=(await fn())||null;}catch(e){
      if(ticket===version){
        status(errorMessage(e));
        if(e?.message==='time'&&editing){
          const missingField=!editing.activity.startTime?'startTime':'endTime';
          focusTarget=host.querySelector(`[data-field="${missingField}"]`);
        }
      }
    }
    finally{if(ticket===version){
      busy=false;host.inert=false;
      if(loaded){renderFolders();renderFolderMove();}
      const target=focusTarget?.isConnected?focusTarget:(focusTarget?.id?$(focusTarget.id):null);
      if(visible()&&target?.isConnected){target.focus({preventScroll:true});}
      else if(visible()&&focused?.isConnected&&(document.activeElement===document.body||document.activeElement===focused)){
        focused.focus({preventScroll:true});if(selection)focused.setSelectionRange(...selection);
      }else if(visible()&&focusedId&&document.activeElement===document.body){
        $(focusedId)?.focus?.({preventScroll:true});
      }
    }}
  }
  async function execute(command,files=[]){
    const ticket=version,db=store,actorId=actor?.id;const data=await db.execute(command,files);
    channel?.postMessage({type:'changed',actorId});if(ticket!==version)throw Error('session-changed');state=data;loaded=true;
  }
  async function save(){
    if(!editing)return;
    if(dirty){
      status('저장 중…');
      await execute({type:'activity',id:selected,revision:editing.activity.revision,value:editing.activity},[...uploads].map(([id,blob])=>({id,blob})));
      editing.activity=hydrateActivity(activity());dirty=false;uploads.clear();renderFolders();renderList();
    }
    if(activity())status('마지막 저장 · '+shortDate(lastChange()));
  }
  async function refresh(){
    if(dirty&&!confirm('저장하지 않은 변경사항을 버리고 최신 내용을 불러올까요?'))return;
    await load();$('mentoringUpdates').hidden=true;
  }
  async function reloadFolders(){
    if(!dirty){await load();$('mentoringUpdates').hidden=true;return;}
    const ticket=version,db=store;const data=await db.read();if(ticket!==version)throw Error('session-changed');
    state={...state,folders:Array.isArray(data.folders)?data.folders:[],folderAssignments:data.folderAssignments&&typeof data.folderAssignments==='object'?data.folderAssignments:{}};
    normalizeFolderFilter();folderEditing=null;folderMessage='';
    renderFolders();renderFolderMove();renderList();
    status('폴더 목록을 새로고침했습니다.');
  }
  async function saveFolder(draft){
    folderMessage='';
    try{
      await execute({type:'folder-save',id:draft.id,name:draft.name,revision:draft.revision});
      folderFilter=draft.id;folderEditing=null;
      renderFolders();renderFolderMove();renderList();
      status(draft.revision?'폴더 이름을 변경했습니다.':'새 폴더를 만들었습니다.');
    }catch(e){
      if(e?.message==='session-changed')throw e;
      folderMessage=folderErrorMessage(e);
      renderFolders();
      return $('mentoringFolderName');
    }
  }
  async function deleteFolder(folder){
    folderMessage='';
    try{
      await execute({type:'folder-delete',id:folder.id,revision:folder.revision});
      folderFilter='';folderEditing=null;
      renderFolders();renderFolderMove();renderList();
      status('폴더를 삭제했습니다. 안의 활동은 미분류로 이동했습니다.');
    }catch(e){
      if(e?.message==='session-changed')throw e;
      folderMessage=folderErrorMessage(e);
      renderFolders();
    }
  }
  async function moveActivityToFolder(activityId,folderId){
    const targetFolder=folderId||'';
    if(!loaded||!state.activities.some(a=>a.id===activityId))return;
    if(targetFolder&&!folderList().some(f=>f.id===targetFolder))return;
    if(targetFolder===folderOf(activityId))return;
    folderMessage='';folderMoveMarkup='';
    try{
      await execute({type:'folder-move',id:activityId,folderId:targetFolder||null});
      renderFolders();renderFolderMove();renderList();
      status(targetFolder?'활동을 선택한 폴더로 이동했습니다.':'활동을 미분류로 이동했습니다.');
    }catch(e){
      if(e?.message==='session-changed')throw e;
      folderMessage=folderErrorMessage(e);
      renderFolders();renderFolderMove();renderList();
    }
  }
  async function toggleProcessStep(activityId,stepId,isChecked){
    if(!loaded||!state.activities.some(a=>a.id===activityId))return;
    const steps=processStepsFor(actor);
    try{
      await execute({type:'checklist',id:activityId,stepId,value:Boolean(isChecked)});
      renderProcess();
      if(!dirty)status(`멘토링 process (${checkedStepsOf(activityId).length}/${steps.length}) 저장됨`);
    }catch(e){
      if(e?.message!=='session-changed')renderProcess();
      throw e;
    }
  }
  async function select(id){if(id===selected&&!preview)return;await save();selected=id;resetEditing();render();}
  async function create(){
    await save();const id=crypto.randomUUID();
    const targetFolder=folderFilter&&folderFilter!=='all'&&folderList().some(f=>f.id===folderFilter)?folderFilter:null;
    await execute({type:'create',id,date:today(),...(targetFolder?{folderId:targetFolder}:{})});
    selected=id;resetEditing();render();
  }
  async function remove(){
    if(!confirm('이 활동과 첨부파일, 보관된 이전 기록을 삭제할까요?'))return;
    await execute({type:'delete',id:selected,revision:editing.activity.revision});
    selected=state.activities.find(includesActivity)?.id||state.activities[0]?.id||null;
    resetEditing();render();
  }
  function addFiles(files){
    const a=editing?.activity;if(!a)return;const skipped=[];
    for(const f of files){if(f.size>5*1024*1024||a.attachments.length>=10||a.attachments.reduce((n,f)=>n+f.size,0)+f.size>20*1024*1024){skipped.push(f.name);continue;}const id=crypto.randomUUID();uploads.set(id,f);a.attachments.push({id,name:f.name.slice(0,255),type:String(f.type||'').slice(0,120),size:f.size});dirty=true;}
    $('mentoringOwnFiles').innerHTML=attachments(a.attachments,actor.id,true);status(skipped.length?'제외된 파일: '+skipped.join(', '):'파일을 추가했습니다. 저장해 주세요.');
  }
  async function download(owner,id){
    const ticket=version,entry=owner===actor.id?editing.activity:state.submissions[key(selected,owner)];
    const f=entry?.attachments.find(f=>f.id===id)||state.submissions[key(selected,owner)]?.attachments.find(f=>f.id===id);if(!f)return;
    const blob=(owner===actor.id&&uploads.get(id))||await store.file(selected,owner,id);if(ticket!==version||!blob)return;
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function report(){
    await save();const ticket=version,a=activity();if(!a)return;
    preview=true;revoke();applyReportTitle(a.title);$('mentoringEditor').hidden=true;$('mentoringReport').hidden=false;host.querySelector('[data-action=preview]').textContent='활동으로 돌아가기';
    const range=formatTimeRange(a);
    const people=resolveParticipants(a,actor);
    const locationText=typeof a.location==='string'?a.location.trim():defaultLocation;
    const files=Array.isArray(a.attachments)?a.attachments:[];
    const infoItems=`<div><dt>작성자 · 멘토</dt><dd>${esc(actor.name)}</dd></div><div><dt>참여 인원</dt><dd>${esc(`${people.length}명${people.length?` (${people.join(',')})`:''}`)}</dd></div>${locationText?`<div><dt>장소</dt><dd>${esc(locationText)}</dd></div>`:''}`;
    const filesSection=files.length?`<section class="mentoring-report-files"><h3>첨부 자료 (${files.length}건)</h3><div id="report-files"></div></section>`:'';
    $('mentoringReport').innerHTML='<header><p>멘토링 활동 결과보고서</p><h1>'+esc(a.title)+'</h1><span>'+esc(a.date)+(range?' · '+esc(range):'')+'</span></header><dl class="mentoring-report-info">'+infoItems+'</dl>'+textBlock('진행 내용',a.task)+(a.code?textBlock('작성한 코드',a.code,true):'')+filesSection+'<footer>코드위키 · 멘토링 활동 기록</footer>';
    if(!files.length)return;
    const container=$('report-files');
    const images=files.filter(isPreviewableImage),others=files.filter(f=>!isPreviewableImage(f));
    if(images.length){
      const gallery=document.createElement('div');
      gallery.className='mentoring-report-gallery'+(images.length>1?' is-multi':' is-single');
      container.append(gallery);
      let imageIndex=0;
      for(const f of images){
        imageIndex++;
        const blob=await store.file(a.id,actor.id,f.id);if(ticket!==version||!visible()||!preview)return;
        const figure=document.createElement('figure');figure.className='mentoring-report-figure';
        let url='';
        if(blob){try{url=URL.createObjectURL(blob);}catch{url='';}}
        if(url){
          const frame=document.createElement('div');frame.className='mentoring-report-media';
          urls.push(url);
          const img=document.createElement('img');img.src=url;img.alt=f.name;
          frame.append(img);figure.append(frame);
        }else{
          const miss=document.createElement('div');miss.className='mentoring-report-media-missing';
          miss.textContent='이미지를 불러오지 못했습니다.';figure.append(miss);
        }
        const caption=document.createElement('figcaption');caption.className='mentoring-report-caption';
        const indexTag=document.createElement('span');indexTag.className='mentoring-file-index';indexTag.textContent=`그림 ${imageIndex}`;
        const nameEl=document.createElement('span');nameEl.className='mentoring-file-name';nameEl.textContent=f.name;
        const sizeEl=document.createElement('span');sizeEl.className='mentoring-file-size';sizeEl.textContent=formatFileSize(f.size);
        caption.append(indexTag,nameEl,sizeEl);
        figure.append(caption);
        gallery.append(figure);
      }
    }
    if(others.length){
      const list=document.createElement('ul');list.className='mentoring-report-file-list';
      for(const f of others){
        const item=document.createElement('li');item.className='mentoring-report-file-item';
        const badge=document.createElement('span');badge.className='mentoring-file-ext';badge.textContent=fileExtensionLabel(f.name);
        const meta=document.createElement('div');meta.className='mentoring-file-meta';
        const nameEl=document.createElement('strong');nameEl.className='mentoring-file-name';nameEl.textContent=f.name;
        const subEl=document.createElement('span');subEl.className='mentoring-file-sub';subEl.textContent=`${formatFileSize(f.size)} · 별도 첨부파일`;
        meta.append(nameEl,subEl);
        const dl=document.createElement('button');dl.type='button';dl.className='toss-chip-btn mentoring-report-download';
        dl.dataset.download=f.id;dl.dataset.owner=actor.id;dl.textContent='내려받기';
        item.append(badge,meta,dl);
        list.append(item);
      }
      container.append(list);
    }
  }
  async function downloadPdf(){
    await save();const ticket=version,a=activity();if(!a)return;
    const pdfApi=window.CodeWikiMentoringPdf;
    if(!pdfApi?.generate){status('PDF 생성기를 불러오지 못했습니다. 새로고침해 주세요.');return;}
    status('PDF 파일을 만드는 중…');
    const files=Array.isArray(a.attachments)?a.attachments:[];
    const imageFiles=files.filter(isPreviewableImage),otherFiles=files.filter(f=>!isPreviewableImage(f));
    const images=[];
    for(const f of imageFiles){
      const blob=await store.file(a.id,actor.id,f.id);
      if(ticket!==version||!visible())return;
      images.push({id:f.id,name:f.name,size:f.size,type:f.type,blob});
    }
    const pdfTitle=pdfFileTitle(a.title);
    const filename=pdfApi.safePdfFilename(pdfTitle);
    const blob=await pdfApi.generate({
      title:a.title,
      pdfTitle,
      date:a.date,
      timeRange:formatTimeRange(a),
      mentorName:actor.name,
      participants:resolveParticipants(a,actor),
      location:typeof a.location==='string'?a.location.trim():defaultLocation,
      task:a.task,
      code:a.code,
      images,
      otherFiles
    });
    if(ticket!==version||!visible())return;
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=filename;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    status('PDF 파일을 저장했습니다.');
  }
  function openDiscord(){
    if(!editing)return;
    const text=formatDiscordTemplate(editing.activity,state.activities,actor);
    $('mentoringDiscordText').value=text;
    $('mentoringDiscordHelp').textContent=dirty?'작성 중인 내용(미저장 포함)을 반영했습니다. 필요하면 아래에서 수정한 뒤 복사해 디스코드에 붙여넣어 주세요.':'활동 기록을 바탕으로 디스코드 제출 양식을 만들었습니다. 필요하면 수정한 뒤 복사해 디스코드에 붙여넣어 주세요.';
    const pdfName=window.CodeWikiMentoringPdf?.safePdfFilename(pdfFileTitle(editing.activity.title))||(pdfFileTitle(editing.activity.title)+'.pdf');
    $('mentoringDiscordPdfHint').textContent='저장될 PDF 파일명: '+pdfName;
    $('mentoringDiscordStatus').textContent='';
    $('mentoringDiscord').showModal();
    $('mentoringDiscordText')?.focus?.({preventScroll:true});
  }
  async function copyDiscord(){
    const text=$('mentoringDiscordText')?.value||'';
    try{
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);}
      else{
        const box=$('mentoringDiscordText');
        box?.select?.();
        if(!document.execCommand?.('copy'))throw Error('copy-unavailable');
      }
      if($('mentoringDiscordStatus'))$('mentoringDiscordStatus').textContent='디스코드 양식을 복사했습니다. 디스코드에 붙여넣기(Ctrl+V) 하세요.';
      status('디스코드 양식을 복사했습니다.');
    }catch{
      if($('mentoringDiscordStatus'))$('mentoringDiscordStatus').textContent='클립보드 복사에 실패했습니다. 위 텍스트를 직접 선택해 복사해 주세요.';
    }
  }
  let importItems=[];
  async function openImport(){
    if(!editing)return;
    const ticket=version,request=++importVersion;importItems=[];
    $('mentoringImport').showModal();$('mentoringImportHelp').textContent='이전 개인 기록의 본문을 복사합니다. 첨부파일을 포함한 원본 기록은 그대로 보존됩니다.';$('mentoringImportList').textContent='불러오는 중…';
    try{
      const items=await window.CodeWikiMentoringStore.create(actor.id).list();
      if(ticket!==version||request!==importVersion||!$('mentoringImport').open)return;
      importItems=Array.isArray(items)?items:[];$('mentoringImportList').innerHTML=importItems.map((n,i)=>`<button type="button" class="mentoring-import-note" data-import-index="${i}">${esc(n.title||'제목 없는 기록')}</button>`).join('')||'가져올 기록이 없습니다.';
    }catch{if(ticket===version&&request===importVersion)$('mentoringImportList').textContent='불러오지 못했습니다. 닫은 뒤 다시 시도해 주세요.';}
  }
  function importNote(index){
    const note=importItems[index];if(!note||!editing||!$('mentoringImport')?.open)return;
    const text=[note.goals,note.activity,note.code,note.result,note.reflection,note.feedback,note.nextPlan].filter(Boolean).join('\n\n');
    const value=[editing.activity.task,`[${note.title||'제목 없는 기록'}]\n${text}`].filter(Boolean).join('\n\n');
    if(value.length>100000){$('mentoringImportHelp').textContent='내용이 10만 자를 넘어 가져올 수 없습니다. 일부 내용을 정리한 뒤 다시 시도해 주세요.';return;}
    importVersion++;
    editing.activity.task=value;dirty=true;$('mentoringImport').close();render();status('내용을 가져왔습니다. 저장해 주세요.');
  }

  function route(){
    const open=visible(),entering=open&&host.hidden;host.hidden=!open;shell.classList.toggle('mentoring-hidden',open);trigger.classList.toggle('active',open);
    if(!open){
      clearDragState();$('mentoringImport')?.close();$('mentoringDiscord')?.close();importVersion++;revoke();restoreReportTitle();
      if(loaded&&preview){
        preview=false;
        if($('mentoringReport')){$('mentoringReport').hidden=true;$('mentoringReport').innerHTML='';}
        if($('mentoringEditor'))$('mentoringEditor').hidden=false;
        const previewBtn=host.querySelector('[data-action=preview]');
        if(previewBtn)previewBtn.textContent='결과보고서';
      }
      return;
    }
    window.CodeWikiBoard?.closeIfActive();document.querySelectorAll('#sbHomeItem.active,#sbScheduleItem.active,#sbThinkingFlowItem.active,#sbProgramCatalogItem.active,#sbBasicSessionItem.active,#sbSqlGuideItem.active,.nav-doc-link.active').forEach(el=>el.classList.remove('active'));document.getElementById('quizModeBtn')?.classList.add('hidden');
    if(entering)window.scrollTo({top:0,behavior:'instant'});if(!loaded&&!busy&&!dirty){frame();void run(load);}
  }
  function syncEndTimeOptions(startValue){
    const endSelect=host.querySelector('[data-field="endTime"]');
    if(!endSelect?.options)return;
    for(const opt of endSelect.options) opt.disabled=Boolean(startValue&&opt.value&&opt.value<=startValue);
    if(startValue&&editing?.activity.endTime&&editing.activity.endTime<=startValue){
      editing.activity.endTime='';endSelect.value='';
    }
  }
  function updateParticipant(target){
    if(!editing||busy)return;
    const name=target.dataset?.participant;
    if(!name)return;
    const presetParticipants=participantsFor(actor);
    const current=new Set(Array.isArray(editing.activity.participants)?editing.activity.participants:presetParticipants);
    if(target.checked)current.add(name);else current.delete(name);
    const ordered=[...presetParticipants.filter(n=>current.has(n)),...[...current].filter(n=>!presetParticipants.includes(n))];
    editing.activity.participants=ordered;
    if($('mentoringParticipantCount'))$('mentoringParticipantCount').textContent=String(ordered.length);
    dirty=true;status('저장하지 않은 변경사항이 있습니다.');
  }
  function updateField(target){
    if(!editing||busy)return;
    const {scope,field}=target.dataset||{};
    if(scope==='activity'&&['title','date','startTime','endTime','location','task','code'].includes(field)){
      if(editing.activity[field]===target.value)return;
      editing.activity[field]=target.value;
      if(field==='startTime')syncEndTimeOptions(target.value);
      dirty=true;status('저장하지 않은 변경사항이 있습니다.');
    }
  }
  function dropTargetFor(e){
    if(!visible()||!loaded||busy||!draggedActivity)return null;
    const target=e.target?.closest?.('[data-folder-filter]'),id=target?.dataset?.folderFilter;
    return target&&!target.disabled&&id!==undefined&&id!=='all'&&(id===''||folderList().some(f=>f.id===id))&&id!==folderOf(draggedActivity)?target:null;
  }
  host.addEventListener('input',e=>{
    if(e.target.id==='mentoringSearch'){renderList();return;}
    updateField(e.target);
  });
  host.addEventListener('change',e=>{
    if(e.target.id==='mentoringFiles'&&!busy){addFiles([...e.target.files]);e.target.value='';return;}
    if(e.target.id==='mentoringMoveFolder'&&!busy&&selected){void run(()=>moveActivityToFolder(selected,e.target.value||null));return;}
    if(e.target.dataset?.processStep&&!busy&&selected){void run(()=>toggleProcessStep(selected,e.target.dataset.processStep,Boolean(e.target.checked)));return;}
    if(e.target.dataset?.participant){updateParticipant(e.target);return;}
    updateField(e.target);
  });
  host.addEventListener('submit',e=>{
    if(!visible()||busy||!folderEditing)return;
    const form=e.target?.closest?.('.mentoring-folder-form');if(!form)return;
    e.preventDefault();
    const input=$('mentoringFolderName');
    const name=String(input?.value||'').trim();
    if(!name){folderMessage='폴더 이름을 입력해 주세요.';renderFolders();$('mentoringFolderName')?.focus?.({preventScroll:true});return;}
    if(name.length>60){folderMessage='폴더 이름은 60자 이하로 입력해 주세요.';renderFolders();return;}
    folderEditing={...folderEditing,name};
    const draft={...folderEditing};
    void run(()=>saveFolder(draft));
  });
  host.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||!visible()||busy)return;
    if(b.dataset.folderFilter!==undefined){
      folderFilter=b.dataset.folderFilter;folderEditing=null;folderMessage='';
      renderFolders();renderList();return;
    }
    if(b.dataset.folderAction){
      const act=b.dataset.folderAction;
      if(act==='reload')return void run(reloadFolders);
      if(!loaded)return;
      if(act==='cancel'){folderEditing=null;folderMessage='';renderFolders();return;}
      if(act==='new'||act==='rename'){
        const existing=folderList().find(f=>f.id===folderFilter);
        if(act==='rename'&&!existing)return;
        folderEditing=act==='new'?{id:crypto.randomUUID(),name:'',revision:0}:{id:existing.id,name:existing.name,revision:existing.revision};
        folderMessage='';renderFolders();$('mentoringFolderName')?.focus?.({preventScroll:true});return;
      }
      if(act==='delete'){
        const folder=folderList().find(f=>f.id===folderFilter);if(!folder)return;
        if(!confirm(`‘${folder.name}’ 폴더를 삭제할까요? 안의 활동은 삭제되지 않고 미분류로 이동합니다.`))return;
        return void run(()=>deleteFolder(folder));
      }
      return;
    }
    if(b.dataset.select)return void run(()=>select(b.dataset.select));
    if(b.dataset.download)return void run(()=>download(b.dataset.owner,b.dataset.download));
    if(b.dataset.remove){editing.activity.attachments=editing.activity.attachments.filter(f=>f.id!==b.dataset.remove);uploads.delete(b.dataset.remove);dirty=true;$('mentoringOwnFiles').innerHTML=attachments(editing.activity.attachments,actor.id,true);status('파일 제거 후 저장해 주세요.');return;}
    if(b.dataset.importIndex!==undefined)return void importNote(Number(b.dataset.importIndex));
    const action=b.dataset.action;
    if(action==='toggle-library'){setLibraryCollapsed(!libraryCollapsed);return;}
    if(action==='legacy')return void openImport();
    if(action==='close-import'){importVersion++;$('mentoringImport').close();return;}
    if(action==='discord'){openDiscord();return;}
    if(action==='close-discord'){$('mentoringDiscord').close();return;}
    if(action==='reset-discord'){if(editing&&$('mentoringDiscordText')){$('mentoringDiscordText').value=formatDiscordTemplate(editing.activity,state.activities,actor);if($('mentoringDiscordStatus'))$('mentoringDiscordStatus').textContent='활동 기록 기준으로 양식을 다시 생성했습니다.';}return;}
    if(action==='copy-discord'){void copyDiscord();return;}
    if(action==='pdf-from-discord'){$('mentoringDiscord').close();void run(downloadPdf);return;}
    const actions={new:create,save,refresh,delete:remove,preview:()=>preview?render():report(),pdf:downloadPdf};
    if(actions[action])void run(actions[action]);
  });
  host.addEventListener('dragstart',e=>{
    clearDragState();
    const source=e.target?.closest?.('[data-select]');
    if(!visible()||!loaded||busy||!source||!e.dataTransfer||!state.activities.some(a=>a.id===source.dataset?.select)){
      if(source)e.preventDefault();
      return;
    }
    draggedActivity=source.dataset.select;dragSource=source;
    e.dataTransfer.effectAllowed='move';
    e.dataTransfer.setData('application/x-codewiki-mentoring-activity',draggedActivity);
    source.classList?.add('dragging');
  });
  host.addEventListener('dragend',clearDragState);
  const onDragOver=e=>{
    const target=dropTargetFor(e);
    if(target!==dropTarget){clearDragTarget();dropTarget=target;target?.classList?.add('drag-over');}
    if(target){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';}
  };
  host.addEventListener('dragover',onDragOver);
  host.addEventListener('dragenter',onDragOver);
  host.addEventListener('dragleave',e=>{if(dropTarget&&!dropTarget.contains?.(e.relatedTarget))clearDragTarget();});
  host.addEventListener('drop',e=>{
    const target=dropTargetFor(e),id=draggedActivity,folderId=target?.dataset?.folderFilter||null;
    if(target)e.preventDefault();
    clearDragState();
    if(target&&id)void run(()=>moveActivityToFolder(id,folderId));
  });
  window.addEventListener('keydown',e=>{
    if(!visible())return;
    if(e.key==='Escape'&&folderEditing&&document.activeElement?.id==='mentoringFolderName'){
      e.preventDefault();folderEditing=null;folderMessage='';renderFolders();return;
    }
    if(!editing||e.defaultPrevented||e.isComposing||!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey||e.key.toLowerCase()!=='s')return;
    e.preventDefault();
    if(e.repeat||busy||$('mentoringImport')?.open||$('mentoringDiscord')?.open)return;
    void run(save);
  });
  // Note another tab's save even while this tab shows a different view; the
  // banner is visible as soon as the user returns to #mentoring.
  channel?.addEventListener('message',e=>{
    if(!loaded||!$('mentoringUpdates'))return;
    if(e?.data&&typeof e.data==='object'&&e.data.actorId&&e.data.actorId!==actor?.id)return;
    $('mentoringUpdates').hidden=false;
  });
  window.addEventListener('hashchange',route);
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  trigger.addEventListener('click',()=>{if(session){location.hash='#mentoring';route();}});
  window.CodeWikiMentoring={setUser,leave(){if(location.hash==='#mentoring')history.replaceState(null,'','#doc/'+(window.CodeWikiApp?.getCurrentDocId()||'welcome-abap'));route();}};
})();
