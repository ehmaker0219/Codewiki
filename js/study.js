(() => {
  const host=document.getElementById('studyWorkspace');
  const shell=document.getElementById('appShell');
  const esc=window.CodeWikiLearning.escape;
  let session=null,store=null,notes=[],timer=null,view='split',loading=false,loadVersion=0,transition=false;
  const visible=()=>Boolean(session)&&window.location.hash==='#study';
  const date=value=>value?new Date(value).toLocaleString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'새 노트';
  const byId=id=>host.querySelector('#'+id);
  function lock(value){transition=value;const editor=byId('studyEditor');if(editor)editor.inert=value;}
  function setUser(user) {
    const token=window.CodeWikiAuth?.getSessionToken()||'';
    if(user?.role==='admin'&&session?.id===user.id&&session.token===token)return;
    clearTimeout(timer);store?.dispose();store=null;session=null;notes=[];loadVersion++;transition=false;
    host.innerHTML='';
    if(user?.role==='admin'&&token) {
      session={id:user.id,name:user.full_name,token};
      store=window.CodeWikiStudyStore.create({owner:user.id,token,storage:localStorage,
        rpc:(...args)=>window.CodeWikiAuth.getSupabaseClient().rpc(...args),onChange:update});
    }
    route();
  }
  function route() {
    const open=visible();
    host.hidden=!open;shell.classList.toggle('study-hidden',open);
    document.getElementById('openStudyBtn')?.classList.toggle('active',open);
    if(open){window.CodeWikiBoard?.closeIfActive();document.getElementById('sbHomeItem')?.classList.remove('active');document.getElementById('sbScheduleItem')?.classList.remove('active');document.querySelectorAll('.nav-doc-link.active').forEach(el=>el.classList.remove('active'));if(!host.innerHTML)mount();void list();}
    else if(store?.dirty)void store.save();
  }
  function mount() {
    host.innerHTML=`<header class="study-header"><div><span class="study-eyebrow">PERSONAL STUDY</span><h1>${esc(session.name)}님의 공부방</h1><p>오늘 배운 내용을 나만의 언어로.</p></div><span class="study-private">나만 보는 노트</span></header>
      <div class="study-layout"><aside class="study-library"><div class="study-library-heading"><h2>내 필기</h2><button type="button" id="studyNew" class="toss-primary-btn">+ 새 노트</button></div>
      <label class="sr-only" for="studySearch">노트 제목 검색</label><input id="studySearch" type="search" placeholder="노트 제목 검색"><div class="study-import"><button type="button" id="studyImport" class="toss-chip-btn">TXT · MD 가져오기</button><input type="file" id="studyFile" accept=".txt,.md,text/plain,text/markdown" hidden></div>
      <p id="studyListStatus" role="status"></p><button type="button" id="studyRetryList" class="toss-chip-btn" hidden>목록 다시 불러오기</button><div id="studyList" class="study-list"></div></aside>
      <section class="study-notebook"><div id="studyEmpty" class="study-empty"><span aria-hidden="true">✎</span><h2>첫 페이지를 펼쳐 보세요</h2><p>새 노트를 만들거나 메모장 파일을 가져오세요.</p></div>
      <div id="studyEditor" hidden><label class="sr-only" for="studyTitle">노트 제목</label><input id="studyTitle" class="study-title" maxlength="120" placeholder="노트 제목">
      <div class="study-editor-meta"><span id="studyStatus" role="status" aria-live="polite"></span><div><button type="button" id="studyDownload" class="toss-chip-btn">내려받기</button><button type="button" id="studySave" class="toss-primary-btn">저장</button></div></div>
      <div class="study-toolbar" role="group" aria-label="글 서식">${[['bold','굵게','Ctrl+B'],['highlight','형광펜',''],['italic','기울임',''],['heading','제목',''],['list','목록',''],['quote','인용',''],['code','코드','']].map(([key,label,shortcut])=>`<button type="button" data-format="${key}" title="${label}${shortcut?' ('+shortcut+')':''}">${label}</button>`).join('')}<div class="study-view">${[['edit','작성'],['split','나란히'],['preview','미리보기']].map(([key,label])=>`<button type="button" data-study-view="${key}" aria-pressed="${view===key}">${label}</button>`).join('')}</div></div>
      <div class="study-pages" data-view="split"><div class="study-source"><label for="studyBody">마크다운 작성</label><textarea id="studyBody" maxlength="200000" spellcheck="false" placeholder="배운 내용을 적어 보세요.\n\n**굵게** · ==형광펜==\n\n위 도구로 선택한 글자에 서식을 넣을 수 있어요."></textarea></div><div class="study-rendered"><span class="study-preview-label">미리보기</span><div id="studyPreview" class="study-markdown"></div></div></div>
      <footer class="study-note-footer"><span id="studyCount"></span><div><button type="button" id="studyReload">서버 글 불러오기</button><button type="button" id="studyDelete">노트 삭제</button></div></footer></div></section></div>`;
    byId('studyNew').addEventListener('click',()=>void createNote());
    byId('studyRetryList').addEventListener('click',()=>void list());
    byId('studySearch').addEventListener('input',renderList);
    byId('studyImport').addEventListener('click',()=>byId('studyFile').click());
    byId('studyFile').addEventListener('change',async e=>{
      const file=e.target.files[0],s=store;e.target.value='';if(!file)return;
      if(!/\.(txt|md)$/i.test(file.name)||file.size>800000){window.alert('TXT 또는 MD 파일을 선택해 주세요. 본문은 20만 자까지 지원합니다.');return;}
      try {const body=await file.text();if(store!==s)return;if(body.length>200000)throw new Error();await createNote(file.name.replace(/\.(txt|md)$/i,''),body);}
      catch {window.alert('파일을 읽을 수 없거나 본문이 너무 깁니다. UTF-8 텍스트 파일로 저장해 주세요.');}
    });
    ['studyTitle','studyBody'].forEach(id=>byId(id).addEventListener('input',changed));
    byId('studySave').addEventListener('click',()=>void store.save());
    byId('studyDownload').addEventListener('click',download);
    byId('studyReload').addEventListener('click',()=>void reload());
    byId('studyDelete').addEventListener('click',()=>void remove());
    host.querySelectorAll('[data-format]').forEach(button=>button.addEventListener('click',()=>format(button.dataset.format)));
    host.querySelectorAll('[data-study-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.studyView)));
    host.addEventListener('keydown',shortcuts);
    fill();
  }
  function shortcuts(e) {
    if(!(e.ctrlKey||e.metaKey))return;
    if(e.key.toLowerCase()==='s'){e.preventDefault();void store?.save();}
    if(e.key.toLowerCase()==='b'&&e.target.id==='studyBody'){e.preventDefault();format('bold');}
  }
  function setView(next) {view=next;host.querySelector('.study-pages').dataset.view=next;host.querySelectorAll('[data-study-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.studyView===next)));}
  function changed() {
    store.edit(byId('studyTitle').value,byId('studyBody').value);
    clearTimeout(timer);timer=setTimeout(()=>void store?.save(),1200);
    preview();
  }
  function preview(){byId('studyPreview').innerHTML=window.CodeWikiStudyMarkdown.render(store.current?.body||'');byId('studyCount').textContent=(store.current?.body.length||0).toLocaleString('ko-KR')+'자';}
  function format(kind) {
    const input=byId('studyBody');const result=window.CodeWikiStudyMarkdown.format(input.value,input.selectionStart,input.selectionEnd,kind);
    if(result.text.length>200000)return;
    input.value=result.text;input.focus();input.setSelectionRange(result.start,result.end);changed();
  }
  function update() {
    if(!store||!byId('studyStatus'))return;
    byId('studyStatus').textContent=store.status||(store.current?.updated_at?'마지막 저장 '+date(store.current.updated_at):'');
    byId('studySave').disabled=store.busy;
    if(store.current&&!store.dirty&&store.current.revision){notes=notes.filter(n=>n.id!==store.current.id);notes.unshift({...store.current,body:undefined});renderList();}
  }
  function fill() {
    const n=store?.current;
    byId('studyEditor').hidden=!n;byId('studyEmpty').hidden=Boolean(n);
    if(n){byId('studyTitle').value=n.title;byId('studyBody').value=n.body;preview();setView(view);}
    update();renderList();
  }
  function renderList() {
    if(!byId('studyList'))return;
    const q=byId('studySearch').value.trim().toLocaleLowerCase();
    const items=notes.filter(n=>n.title.toLocaleLowerCase().includes(q));
    byId('studyList').innerHTML=items.map(n=>`<button type="button" class="study-note-link${store?.current?.id===n.id?' active':''}" data-note="${esc(n.id)}"><strong>${esc(n.title)}</strong><span>${esc(date(n.updated_at))}</span></button>`).join('')||(!loading?'<p class="study-list-empty">'+(q?'검색 결과가 없습니다.':'저장된 노트가 없습니다.')+'</p>':'');
    byId('studyList').querySelectorAll('[data-note]').forEach(b=>b.addEventListener('click',()=>void select(b.dataset.note)));
  }
  async function list() {
    const s=store,version=++loadVersion;if(!s)return;loading=true;byId('studyListStatus').textContent='목록 불러오는 중…';byId('studyRetryList').hidden=true;
    try {const data=await s.call('cw_list_study_notes');if(store!==s||loadVersion!==version)return;notes=data||[];byId('studyListStatus').textContent='';}
    catch {if(store===s&&loadVersion===version){byId('studyListStatus').textContent='목록을 불러오지 못했습니다.';byId('studyRetryList').hidden=false;}}
    finally {if(store===s&&loadVersion===version){loading=false;renderList();}}
  }
  async function select(id) {
    if(transition||store?.current?.id===id)return;lock(true);const s=store;
    try {if(!await s.save()||store!==s)return;const n=await s.call('cw_get_study_note',{p_id:id});if(store!==s)return;if(!n)throw new Error();if(s.dirty){window.alert('현재 노트를 편집 중입니다. 저장 후 다시 선택해 주세요.');return;}s.select(n);fill();}
    catch {if(store===s)window.alert('노트를 불러오지 못했습니다. 다시 시도해 주세요.');}
    finally {if(store===s)lock(false);}
  }
  async function createNote(title='',body='') {
    if(transition||!store)return;lock(true);const s=store;
    try {if(!await s.save()||store!==s)return;s.select({id:crypto.randomUUID(),title:title.slice(0,120),body,revision:0});s.edit(title.slice(0,120),body);fill();byId('studyTitle').focus();if(body)await s.save();}
    finally {if(store===s){lock(false);byId('studyTitle').focus();}}
  }
  function download() {
    const n=store?.current;if(!n)return;
    const blob=new Blob([n.body],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=(n.title||'필기').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function reload() {
    const s=store,n=s?.current;if(!n||transition||s.busy)return;
    if(s.dirty&&!window.confirm('미저장 내용을 서버 글로 바꿀까요? 필요한 내용은 먼저 내려받아 주세요.'))return;
    lock(true);clearTimeout(timer);
    const originalTitle=n.title,originalBody=n.body;
    try {const fresh=await s.call('cw_get_study_note',{p_id:n.id});if(store!==s)return;if(!fresh){window.alert('서버에 없는 노트입니다. 현재 글은 유지합니다.');return;}if(s.current.title!==originalTitle||s.current.body!==originalBody){window.alert('불러오는 동안 작성한 내용이 있어 현재 글을 유지합니다.');return;}s.select(fresh);fill();}
    catch {if(store===s)window.alert('서버 글을 불러오지 못했습니다.');}
    finally {if(store===s)lock(false);}
  }
  async function remove() {
    const s=store,n=s?.current;if(!n||transition||s.busy)return;
    if(!window.confirm('이 노트를 삭제할까요? 삭제한 노트는 복구할 수 없습니다.'))return;
    lock(true);clearTimeout(timer);
    try {if(n.revision)await s.call('cw_delete_study_note',{p_id:n.id,p_revision:n.revision});if(store!==s)return;s.select(null);notes=notes.filter(item=>item.id!==n.id);fill();}
    catch {if(store===s)window.alert('삭제하지 못했습니다. 서버 글을 다시 확인해 주세요.');}
    finally {if(store===s)lock(false);}
  }
  window.CodeWikiStudy={setUser,leave(){if(visible()){history.replaceState(null,'','#doc/'+(window.CodeWikiApp?.getCurrentDocId()||'welcome-abap'));route();}}};
  window.addEventListener('hashchange',route);
  window.addEventListener('beforeunload',e=>{if(store?.dirty){e.preventDefault();e.returnValue='';}});
  window.addEventListener('online',()=>{if(store?.dirty)void store.save();});
})();
