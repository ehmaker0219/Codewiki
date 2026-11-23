/* Mentor-only local notebook. No mentoring data is sent to production. */
(() => {
  const model=window.CodeWikiMentoringModel,{members,states,key,member}=model;
  const mentor=members[0];
  const host=document.getElementById('mentoringPage'),trigger=document.getElementById('openMentoringBtn'),shell=document.getElementById('appShell');
  const esc=window.CodeWikiLearning.escape;
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('cw-mentoring-team-local'):null;
  const savedDateFormat=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const activityDateFormat=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'});
  const shortDate=v=>{const date=new Date(v);return Number.isNaN(date.getTime())?date.toString():savedDateFormat.format(date);};
  const today=()=>activityDateFormat.format(new Date());
  let session=null,actor=null,store=null,state=model.empty(),selected=null,editing=null,dirty=false;
  const uploads=new Map();
  let loaded=false,busy=false,preview=false,version=0,urls=[],importVersion=0;
  const $=id=>host.querySelector('#'+id);
  const visible=()=>Boolean(session)&&location.hash==='#mentoring';
  const activity=()=>state.activities.find(a=>a.id===selected);
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
    const a=activity();dirty=false;uploads.clear();preview=false;revoke();
    editing=a?{activity:{result:'',code:'',attachments:[],...structuredClone(a)}}:null;
  }
  function setUser(user){
    const token=window.CodeWikiAuth?.getSessionToken();
    const valid=user?.role==='student'&&user.status==='approved'&&token&&member(user.id);
    if(valid&&session?.id===user.id&&session.token===token)return;
    version++;importVersion++;revoke();$('mentoringImport')?.close();
    session=valid?{id:user.id,token}:null;actor=valid?member(user.id):null;
    store=actor?window.CodeWikiMentoringTeamStore.create(actor.id):null;
    state=model.empty();selected=null;editing=null;dirty=false;uploads.clear();loaded=false;busy=false;host.inert=false;
    host.replaceChildren();trigger.hidden=!session;route();
  }
  function frame(){
    host.innerHTML=`<header class="mentoring-heading"><div><span class="mentoring-eyebrow">MENTORING NOTES</span><h1>내 멘토링</h1><p>진행한 활동과 결과물을 기록하고 보고서로 정리하세요.</p></div><div class="mentoring-role"><span>이은호 · 멘토</span>${button('new','+ 활동 만들기',true)}</div></header>
      <div class="mentoring-layout"><aside class="mentoring-library"><h2>내 활동 기록</h2><label class="sr-only" for="mentoringSearch">활동 검색</label><input id="mentoringSearch" type="search" placeholder="활동 제목 검색"><div id="mentoringList"></div></aside><div class="mentoring-main">
      <div class="mentoring-actions"><span id="mentoringStatus" role="status"></span><div class="mentoring-action-buttons">${button('refresh','새로고침')}<span class="mentoring-action-divider" aria-hidden="true"></span>${button('preview','결과보고서')}${button('print','인쇄 / PDF')}${button('save','저장',true)}</div></div>
      <div id="mentoringUpdates" class="mentoring-help" role="status" hidden>새 내용이 있습니다. 새로고침하면 확인할 수 있습니다.</div>
      <div id="mentoringEditor"></div><article id="mentoringReport" class="mentoring-report" hidden></article></div></div>
      <dialog id="mentoringImport" class="profile-dialog" aria-labelledby="mentoringImportTitle"><div class="profile-dialog-header"><h2 id="mentoringImportTitle">내 기록 가져오기</h2>${button('close-import','닫기')}</div><p class="mentoring-help" id="mentoringImportHelp"></p><div id="mentoringImportList"></div></dialog>`;
  }
  function renderList(){
    const query=$('mentoringSearch').value.trim().toLowerCase();
    $('mentoringList').innerHTML=state.activities.filter(a=>a.title.toLowerCase().includes(query)).map(a=>`<button type="button" class="mentoring-record${a.id===selected?' active':''}" data-select="${esc(a.id)}" aria-pressed="${a.id===selected}"><strong>${esc(a.title)}</strong><span>${esc(a.date)} · ${esc(states[a.status])}</span></button>`).join('')||'<p class="mentoring-help">등록된 활동이 없습니다.</p>';
  }
  function field(name,label,value,kind='textarea'){
    const attrs=`data-scope="activity" data-field="${name}"`;
    return `<label class="mentoring-field"><span>${label}</span>${kind==='textarea'?`<textarea ${attrs} rows="4" maxlength="100000">${esc(value||'')}</textarea>`:`<input ${attrs} type="${kind}" maxlength="120" value="${esc(value||'')}">`}</label>`;
  }
  function textBlock(label,value,code=false){return `<section class="mentoring-text-block"><h3>${label}</h3><${code?'pre':'div'} class="mentoring-report-text">${esc(value||'아직 작성하지 않았습니다.')}</${code?'pre':'div'}></section>`;}
  function attachments(items,owner,editable=false){
    return items.map(f=>`<div class="mentoring-attachment"><span>${esc(f.name)} <small>${Math.max(1,Math.ceil(f.size/1024))} KB</small></span><button type="button" data-download="${esc(f.id)}" data-owner="${esc(owner)}">내려받기</button>${editable?`<button type="button" data-remove="${esc(f.id)}">제거</button>`:''}</div>`).join('');
  }
  function archive(){
    const subs=Object.values(state.submissions).filter(v=>v.activity===selected),comments=state.comments.filter(c=>c.activity===selected);
    if(!subs.length&&!comments.length)return '';
    const names={'d181e98f-1459-4a0f-b696-befb30e35327':'김성재','fdd0fbb5-cc2d-4f74-94af-56d4d507d65f':'김은철',[mentor.id]:'이은호'};
    return '<details class="mentoring-archive"><summary>이전 공유 기록 보관</summary><p class="mentoring-help">기존에 공유된 내용만 보관합니다. 새 제출이나 댓글은 받지 않습니다.</p>'+subs.map(sub=>textBlock(esc(names[sub.owner]||'이전 참여자'),sub.body)+(sub.code?textBlock('코드',sub.code,true):'')+textBlock('소감',sub.reflection)+attachments(sub.attachments,sub.owner)+textBlock('기존 피드백',state.feedback[key(selected,sub.owner)]?.body)).join('')+comments.map(c=>textBlock(esc(names[c.author]||'이전 참여자')+' · '+shortDate(c.createdAt),c.body)).join('')+'</details>';
  }
  function render(){
    renderList();revoke();preview=false;$('mentoringReport').hidden=true;$('mentoringEditor').hidden=false;
    host.querySelector('[data-action=preview]').textContent='결과보고서';
    for(const action of ['save','preview','print'])host.querySelector('[data-action='+action+']').disabled=!activity();
    if(!activity()){$('mentoringEditor').innerHTML='<div class="mentoring-empty"><h2>첫 활동을 만들어 주세요</h2><p>목표와 진행 내용, 결과물을 기록해 보고서로 정리하세요.</p>'+button('new','+ 활동 만들기',true)+'</div>';return;}
    const a=editing.activity;
    $('mentoringEditor').innerHTML='<div class="mentoring-form"><section class="mentoring-form-section"><div class="mentoring-section-title"><h2>활동 정보</h2><label class="mentoring-state-field">활동 상태 <select data-scope="activity" data-field="status">'+Object.entries(states).map(([v,label])=>'<option value="'+v+'" '+(a.status===v?'selected':'')+'>'+label+'</option>').join('')+'</select></label></div>'+
      '<div class="mentoring-fields mentoring-identity-fields">'+field('title','활동 제목',a.title,'text')+field('date','활동 날짜',a.date,'date')+'</div>'+field('goals','활동 목표',a.goals)+'</section>'+
      '<section class="mentoring-form-section"><div class="mentoring-section-title"><h2>진행 내용</h2><div class="mentoring-inline-actions">'+button('import','내 공부방 필기 가져오기')+button('legacy','이전 개인 기록 가져오기')+'</div></div>'+field('task','활동 내용',a.task)+'</section>'+
      '<section class="mentoring-form-section"><div class="mentoring-section-title"><h2>결과물</h2></div>'+field('result','결과물 설명',a.result)+field('code','작성한 코드',a.code)+
      '<div class="mentoring-upload"><label for="mentoringFiles">파일 첨부</label><input type="file" id="mentoringFiles" aria-describedby="mentoringFileHelp" multiple><p class="mentoring-help" id="mentoringFileHelp">파일당 5MB · 활동당 20MB, 10개까지</p></div><div id="mentoringOwnFiles">'+attachments(a.attachments,actor.id,true)+'</div></section>'+
      '<section class="mentoring-form-section"><div class="mentoring-section-title"><h2>활동 마무리</h2></div><div class="mentoring-fields">'+field('summary','활동 성과 · 소감',a.summary)+field('nextPlan','다음 활동 계획',a.nextPlan)+'</div></section>'+archive()+'<footer class="mentoring-form-footer">'+button('delete','활동 삭제')+'</footer></div>';
    if(!dirty)status('마지막 저장 · '+shortDate(lastChange()));
  }
  async function load(){
    const ticket=version,db=store;const data=await db.read();if(ticket!==version)throw Error('session-changed');
    state=data;loaded=true;selected=state.activities.some(a=>a.id===selected)?selected:state.activities[0]?.id||null;
    resetEditing();render();status('로컬 기록을 불러왔습니다.');
  }
  function errorMessage(error){return ({conflict:'다른 탭에서 이 항목을 수정했습니다. 입력 내용을 복사한 뒤 새로고침해 주세요.',forbidden:'현재 역할에서는 수정할 수 없습니다.',title:'활동 제목을 입력해 주세요.',invalid:'입력한 날짜와 내용을 확인해 주세요.',files:'첨부파일 크기나 개수 제한을 확인해 주세요.',missing:'활동을 찾지 못했습니다. 새로고침해 주세요.'})[error.message]||'처리하지 못했습니다. 브라우저 저장 공간을 확인하고 다시 시도해 주세요.';}
  async function run(fn){
    if(busy||!visible())return;const ticket=version;
    const focused=host.contains(document.activeElement)?document.activeElement:null;
    const selection=typeof focused?.selectionStart==='number'?[focused.selectionStart,focused.selectionEnd,focused.selectionDirection]:null;
    busy=true;host.inert=true;
    try{await fn();}catch(e){if(ticket===version)status(errorMessage(e));}
    finally{if(ticket===version){
      busy=false;host.inert=false;
      if(visible()&&focused?.isConnected&&(document.activeElement===document.body||document.activeElement===focused)){
        focused.focus({preventScroll:true});if(selection)focused.setSelectionRange(...selection);
      }
    }}
  }
  async function execute(command,files=[]){
    const ticket=version,db=store;const data=await db.execute(command,files);
    channel?.postMessage('changed');if(ticket!==version)throw Error('session-changed');state=data;
  }
  async function save(){
    if(!editing)return;
    if(dirty){
      status('저장 중…');
      await execute({type:'activity',id:selected,revision:editing.activity.revision,value:editing.activity},[...uploads].map(([id,blob])=>({id,blob})));
      editing.activity={result:'',code:'',attachments:[],...structuredClone(activity())};dirty=false;uploads.clear();renderList();
    }
    if(activity())status('마지막 저장 · '+shortDate(lastChange()));
  }
  async function refresh(){
    if(dirty&&!confirm('저장하지 않은 변경사항을 버리고 최신 내용을 불러올까요?'))return;
    await load();$('mentoringUpdates').hidden=true;
  }
  async function select(id){await save();selected=id;resetEditing();render();}
  async function create(){await save();const id=crypto.randomUUID();await execute({type:'create',id,date:today()});selected=id;resetEditing();render();}
  async function remove(){if(!confirm('이 활동과 첨부파일, 보관된 이전 기록을 삭제할까요?'))return;await execute({type:'delete',id:selected,revision:editing.activity.revision});selected=state.activities[0]?.id||null;resetEditing();render();}
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
    preview=true;revoke();$('mentoringEditor').hidden=true;$('mentoringReport').hidden=false;host.querySelector('[data-action=preview]').textContent='활동으로 돌아가기';
    $('mentoringReport').innerHTML='<header><p>멘토링 활동 결과보고서</p><h1>'+esc(a.title)+'</h1><span>'+esc(a.date)+' · '+states[a.status]+'</span></header><dl class="mentoring-report-info"><div><dt>작성자 · 멘토</dt><dd>이은호</dd></div></dl>'+textBlock('활동 목표',a.goals)+textBlock('진행 내용',a.task)+textBlock('결과물 설명',a.result)+(a.code?textBlock('작성한 코드',a.code,true):'')+'<div id="report-files"></div>'+textBlock('활동 성과 · 소감',a.summary)+textBlock('다음 활동 계획',a.nextPlan)+'<footer>코드위키 · 멘토링 활동 기록</footer>';
    for(const f of a.attachments||[]){
      const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=f.name;figure.append(caption);
      if(['image/png','image/jpeg','image/webp'].includes(f.type)){
        const blob=await store.file(a.id,actor.id,f.id);if(ticket!==version||!visible()||!preview)return;
        if(blob){const url=URL.createObjectURL(blob);urls.push(url);const img=document.createElement('img');img.src=url;img.alt=f.name;figure.prepend(img);}
      }else caption.textContent+=' · 별도 첨부파일';
      $('report-files').append(figure);
    }
  }
  async function print(){await report();const ticket=version;if(!preview)return;await Promise.all([...$('mentoringReport').querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));if(ticket!==version||!visible())return;document.body.classList.add('mentoring-print');try{window.print();}finally{document.body.classList.remove('mentoring-print');}}
  async function rpc(name,args,s){
    const controller=new AbortController();let timeout;
    try{return await Promise.race([Promise.resolve().then(()=>{const client=window.CodeWikiAuth?.getSupabaseClient();if(!client)throw Error('no-client');const req=client.rpc(name,{p_token:s.token,...args});return typeof req.abortSignal==='function'?req.abortSignal(controller.signal):req;}).then(r=>{if(r.error)throw r.error;return r.data;}),new Promise((_,reject)=>{timeout=setTimeout(()=>{controller.abort();reject(Error('timeout'));},15000);})]);}finally{clearTimeout(timeout);}
  }
  let importItems=[],importMode='study';
  async function openImport(mode){
    if(!editing)return;
    const ticket=version,request=++importVersion,s=session;importMode=mode;importItems=[];
    $('mentoringImport').showModal();$('mentoringImportHelp').textContent=mode==='legacy'?'이전 개인 기록의 본문을 복사합니다. 첨부파일을 포함한 원본 기록은 그대로 보존됩니다.':'내 필기를 복사합니다. 원본 필기는 변경하지 않습니다.';$('mentoringImportList').textContent='불러오는 중…';
    try{
      const items=mode==='legacy'?await window.CodeWikiMentoringStore.create(actor.id).list():await rpc('cw_list_study_notes',{},s);
      if(ticket!==version||request!==importVersion||!$('mentoringImport').open)return;
      importItems=Array.isArray(items)?items:[];$('mentoringImportList').innerHTML=importItems.map((n,i)=>`<button type="button" class="mentoring-import-note" data-import-index="${i}">${esc(n.title||'제목 없는 기록')}</button>`).join('')||'가져올 기록이 없습니다.';
    }catch{if(ticket===version&&request===importVersion)$('mentoringImportList').textContent='불러오지 못했습니다. 닫은 뒤 다시 시도해 주세요.';}
  }
  async function importNote(index){
    const n=importItems[index];if(!n)return;const ticket=version,request=++importVersion,id=selected;$('mentoringImportList').textContent='가져오는 중…';
    try{
      const note=importMode==='legacy'?n:await rpc('cw_get_study_note',{p_id:n.id},session);
      if(ticket!==version||request!==importVersion||id!==selected||!$('mentoringImport').open)return;
      const rawText=importMode==='legacy'?[note.goals,note.activity,note.code,note.result,note.reflection,note.feedback,note.nextPlan].filter(Boolean).join('\n\n'):note.body;
      if(typeof rawText!=='string')throw Error('invalid');
      const text=importMode==='legacy'||!window.CodeWikiLearning?.stripStudyRichBlocks?rawText:window.CodeWikiLearning.stripStudyRichBlocks(rawText);
      const value=[editing.activity.task,`[${note.title}]\n${text}`].filter(Boolean).join('\n\n');if(value.length>100000)throw Error('invalid');
      editing.activity.task=value;dirty=true;$('mentoringImport').close();render();status('내용을 가져왔습니다. 저장해 주세요.');
    }catch{if(ticket===version&&request===importVersion)$('mentoringImportList').textContent='가져오지 못했습니다. 내용 길이를 확인한 뒤 다시 시도해 주세요.';}
  }

  function route(){
    const open=visible(),entering=open&&host.hidden;host.hidden=!open;shell.classList.toggle('mentoring-hidden',open);trigger.classList.toggle('active',open);
    if(!open){$('mentoringImport')?.close();importVersion++;return;}
    window.CodeWikiBoard?.closeIfActive();document.querySelectorAll('#sbHomeItem.active,#sbScheduleItem.active,#sbThinkingFlowItem.active,.nav-doc-link.active').forEach(el=>el.classList.remove('active'));
    if(entering)window.scrollTo({top:0,behavior:'instant'});if(!loaded&&!busy){frame();void run(load);}
  }
  host.addEventListener('input',e=>{
    if(e.target.id==='mentoringSearch'){renderList();return;}if(!editing||busy)return;
    const {scope,field}=e.target.dataset;
    if(scope==='activity'&&['title','date','goals','task','result','code','summary','nextPlan','status'].includes(field)){editing.activity[field]=e.target.value;dirty=true;status('저장하지 않은 변경사항이 있습니다.');}
  });
  host.addEventListener('change',e=>{
    if(e.target.id==='mentoringFiles'&&!busy){addFiles([...e.target.files]);e.target.value='';}
  });
  host.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||!visible()||busy)return;
    if(b.dataset.select)return void run(()=>select(b.dataset.select));
    if(b.dataset.download)return void run(()=>download(b.dataset.owner,b.dataset.download));
    if(b.dataset.remove){editing.activity.attachments=editing.activity.attachments.filter(f=>f.id!==b.dataset.remove);uploads.delete(b.dataset.remove);dirty=true;$('mentoringOwnFiles').innerHTML=attachments(editing.activity.attachments,actor.id,true);status('파일 제거 후 저장해 주세요.');return;}
    if(b.dataset.importIndex!==undefined)return void importNote(Number(b.dataset.importIndex));
    const action=b.dataset.action;if(action==='import'||action==='legacy')return void openImport(action==='legacy'?'legacy':'study');
    if(action==='close-import'){importVersion++;$('mentoringImport').close();return;}
    const actions={new:create,save,refresh,delete:remove,preview:()=>preview?render():report(),print};
    if(actions[action])void run(actions[action]);
  });
  window.addEventListener('keydown',e=>{
    if(!visible()||!editing||e.defaultPrevented||e.isComposing||!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey||e.key.toLowerCase()!=='s')return;
    e.preventDefault();
    if(e.repeat||busy||$('mentoringImport')?.open)return;
    void run(save);
  });
  channel?.addEventListener('message',()=>{if(visible()&&loaded)$('mentoringUpdates').hidden=false;});
  window.addEventListener('hashchange',route);
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  trigger.addEventListener('click',()=>{if(session){location.hash='#mentoring';route();}});
  window.CodeWikiMentoring={setUser,leave(){if(location.hash==='#mentoring')history.replaceState(null,'','#doc/'+(window.CodeWikiApp?.getCurrentDocId()||'welcome-abap'));route();}};
})();
