(() => {
  const host=document.getElementById('studyWorkspace');
  const shell=document.getElementById('appShell');
  const esc=window.CodeWikiLearning.escape;
  let session=null,store=null,notes=[],timer=null,editor=null,loading=false,loadVersion=0,transition=false;
  let editorLoad=null,mounted=false;
  const visible=()=>Boolean(session)&&window.location.hash==='#study';
  const date=value=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'새 노트';
  const byId=id=>host.querySelector('#'+id);
  const titleCollator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
  function titleDate(title) {
    // Class-note filenames: 261118WED, 20261118, or 2026-11-18 (also / and .).
    const match=title.match(/(?:^|\D)(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?=\D|$)/)
      ||title.match(/(?:^|\D)(\d{4})(\d{2})(\d{2})(?=\D|$)/)
      ||title.match(/(?:^|\D)(\d{2})(\d{2})(\d{2})(?=\D|$)/);
    if(!match)return 0;
    const year=Number(match[1])+(match[1].length===2?2000:0),month=Number(match[2]),day=Number(match[3]);
    const value=new Date(Date.UTC(year,month-1,day));
    return value.getUTCFullYear()===year&&value.getUTCMonth()===month-1&&value.getUTCDate()===day?year*10000+month*100+day:0;
  }
  const compareTitles=(a,b)=>titleDate(b.title)-titleDate(a.title)||titleCollator.compare(a.title,b.title)||a.id.localeCompare(b.id);
  function lock(value){
    transition=value;const editor=byId('studyEditor');if(editor)editor.inert=value;
    ['studyNew','studyImport'].forEach(id=>{const button=byId(id);if(button)button.disabled=value;});
  }
  function setUser(user) {
    const token=window.CodeWikiAuth?.getSessionToken()||'';
    if(user?.role==='admin'&&session?.id===user.id&&session.token===token)return;
    clearTimeout(timer);store?.dispose();store=null;session=null;notes=[];loadVersion++;transition=false;
    editor?.destroy();editor=null;mounted=false;host.innerHTML='';
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
    if(open){window.CodeWikiBoard?.closeIfActive();document.getElementById('sbHomeItem')?.classList.remove('active');document.getElementById('sbScheduleItem')?.classList.remove('active');document.querySelectorAll('.nav-doc-link.active').forEach(el=>el.classList.remove('active'));if(!window.CodeWikiStudyEditor){loadEditor();return;}if(!mounted)mount();void list();}
    else if(store?.dirty)void store.save();
  }
  function loadEditor() {
    if(editorLoad)return;
    host.innerHTML='<p role="status">필기 편집기를 준비하고 있습니다…</p>';
    // Load the editor only when an administrator opens the study workspace.
    editorLoad=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=document.getElementById('studyEditorSource').dataset.src;
      script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error('editor-load'));};
      document.head.append(script);
    });
    editorLoad.then(()=>{editorLoad=null;if(visible())route();}).catch(()=>{
      editorLoad=null;if(!visible())return;
      host.innerHTML='<p role="status">편집기를 불러오지 못했습니다.</p><button id="studyRetryEditor" type="button" class="toss-chip-btn">다시 시도</button>';
      byId('studyRetryEditor').addEventListener('click',loadEditor);
    });
  }
  function mount() {
    mounted=true;
    host.innerHTML=`<header class="study-header"><div><span class="study-eyebrow">PERSONAL STUDY</span><h1>${esc(session.name)}님의 공부방</h1><p>오늘 배운 내용을 나만의 언어로.</p></div><span class="study-private">나만 보는 노트</span></header>
      <div class="study-layout"><aside class="study-library"><div class="study-library-heading"><h2>내 필기</h2><button type="button" id="studyNew" class="toss-primary-btn">+ 새 노트</button></div>
      <label class="sr-only" for="studySearch">노트 제목 검색</label><input id="studySearch" type="search" placeholder="노트 제목 검색"><div class="study-import"><button type="button" id="studyImport" class="toss-chip-btn" title="TXT·MD 파일을 여러 개 선택할 수 있습니다">TXT · MD 가져오기</button><input type="file" id="studyFile" accept=".txt,.md,text/plain,text/markdown" multiple hidden><p id="studyImportStatus" role="status" aria-live="polite"></p></div>
      <p id="studyListStatus" role="status"></p><button type="button" id="studyRetryList" class="toss-chip-btn" hidden>목록 다시 불러오기</button><div id="studyList" class="study-list"></div></aside>
      <section class="study-notebook"><div id="studyEmpty" class="study-empty"><span aria-hidden="true">✎</span><h2>첫 페이지를 펼쳐 보세요</h2><p>새 노트를 만들거나 메모장 파일을 가져오세요.</p></div>
      <div id="studyEditor" hidden><label class="sr-only" for="studyTitle">노트 제목</label><input id="studyTitle" class="study-title" maxlength="120" placeholder="노트 제목">
      <div class="study-editor-meta"><span id="studyStatus" role="status" aria-live="polite"></span><div><button type="button" id="studyDownload" class="toss-chip-btn">내려받기</button><button type="button" id="studySave" class="toss-primary-btn">저장</button></div></div>
      <div class="study-toolbar" role="group" aria-label="글 서식">${[['bold','굵게','Ctrl+B'],['highlight','형광펜',''],['italic','기울임','Ctrl+I'],['heading','제목',''],['list','목록',''],['quote','인용',''],['code','코드','']].map(([key,label,shortcut])=>`<button type="button" data-format="${key}" aria-pressed="false" title="${label}${shortcut?' ('+shortcut+')':''}">${label}</button>`).join('')}<div class="study-history"><button type="button" data-history="undo" title="실행 취소 (Ctrl+Z)">↶ 실행 취소</button><button type="button" data-history="redo" title="다시 실행 (Ctrl+Shift+Z)">↷ 다시 실행</button></div></div>
      <div id="studyBody" class="study-rich-editor"></div>
      <footer class="study-note-footer"><span id="studyCount"></span><div><button type="button" id="studyReload">서버 글 불러오기</button><button type="button" id="studyDelete">노트 삭제</button></div></footer></div></section></div>`;
    byId('studyNew').addEventListener('click',()=>void createNote());
    byId('studyRetryList').addEventListener('click',()=>void list());
    byId('studySearch').addEventListener('input',renderList);
    byId('studyImport').addEventListener('click',()=>byId('studyFile').click());
    byId('studyFile').addEventListener('change',async e=>{
      const files=Array.from(e.target.files||[]);e.target.value='';
      await importFiles(files);
    });
    editor=window.CodeWikiStudyEditor.create({element:byId('studyBody'),onChange:body=>changed(body),onState:updateToolbar,
      onLimit:()=>window.alert('본문은 20만 자까지 저장할 수 있습니다. 새 노트로 나눠 작성해 주세요.')});
    byId('studyTitle').addEventListener('input',()=>changed());
    byId('studySave').addEventListener('click',()=>void store.save());
    byId('studyDownload').addEventListener('click',download);
    byId('studyReload').addEventListener('click',()=>void reload());
    byId('studyDelete').addEventListener('click',()=>void remove());
    host.querySelectorAll('[data-format],[data-history]').forEach(button=>{
      button.addEventListener('mousedown',e=>e.preventDefault());
      button.addEventListener('click',()=>{editor.command(button.dataset.format||button.dataset.history);updateToolbar();});
    });
    host.addEventListener('keydown',shortcuts);
    fill();
  }
  function shortcuts(e) {
    if(!(e.ctrlKey||e.metaKey))return;
    if(e.key.toLowerCase()==='s'){e.preventDefault();void store?.save();}
  }
  function changed(body=store.current?.body||'') {
    if(!store?.current)return;
    store.edit(byId('studyTitle').value,body);
    clearTimeout(timer);timer=setTimeout(()=>void store?.save(),1200);
    updateToolbar();
  }
  function updateToolbar() {
    if(!editor)return;
    host.querySelectorAll('[data-format]').forEach(button=>button.setAttribute('aria-pressed',String(editor.active(button.dataset.format))));
    host.querySelectorAll('[data-history]').forEach(button=>button.disabled=!editor.can(button.dataset.history));
    byId('studyCount').textContent=editor.text().length.toLocaleString('ko-KR')+'자';
  }
  function update() {
    if(!store||!byId('studyStatus'))return;
    const savedAt=store.current?.updated_at;
    byId('studyStatus').textContent=[store.status,savedAt?'마지막 저장 '+date(savedAt):''].filter(Boolean).join(' · ');
    byId('studySave').disabled=store.busy;
    if(store.current&&!store.dirty&&store.current.revision){
      const note={...store.current,body:undefined},index=notes.findIndex(n=>n.id===note.id);
      // Selection and save timestamps never affect title-based list ordering.
      if(index<0)notes.unshift(note);else notes[index]=note;
      renderList();
    }
  }
  function fill() {
    const n=store?.current;
    byId('studyEditor').hidden=!n;byId('studyEmpty').hidden=Boolean(n);
    if(n){byId('studyTitle').value=n.title;editor.setContent(n.body);updateToolbar();}
    else editor?.destroy();
    update();renderList();
  }
  function renderList() {
    if(!byId('studyList'))return;
    const q=byId('studySearch').value.trim().toLocaleLowerCase();
    const items=notes.filter(n=>n.title.toLocaleLowerCase().includes(q)).sort(compareTitles);
    byId('studyList').innerHTML=items.map(n=>`<button type="button" class="study-note-link${store?.current?.id===n.id?' active':''}" data-note="${esc(n.id)}"><strong>${esc(n.title)}</strong><span>${esc(date(n.updated_at))}</span></button>`).join('')||(!loading?'<p class="study-list-empty">'+(q?'검색 결과가 없습니다.':'저장된 노트가 없습니다.')+'</p>':'');
    byId('studyList').querySelectorAll('[data-note]').forEach(b=>b.addEventListener('click',()=>void select(b.dataset.note)));
  }
  async function list() {
    const s=store,version=++loadVersion;if(!s)return;loading=true;byId('studyListStatus').textContent='목록 불러오는 중…';byId('studyRetryList').hidden=true;
    try {
      const data=await s.call('cw_list_study_notes');if(store!==s||loadVersion!==version)return;
      notes=data||[];byId('studyListStatus').textContent='';
      // Open the most recently edited note only on an empty workspace. A restored
      // draft or a note chosen/created while loading always takes precedence.
      if(!s.current&&!transition&&visible()&&notes.length){
        const latest=notes.reduce((a,b)=>(Date.parse(b.updated_at)||0)>(Date.parse(a.updated_at)||0)?b:a);
        await select(latest.id);
      }
    }
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
  async function importFiles(files) {
    if(!files.length||transition||!store)return;
    const s=store,skipped=[];let completed=0,stopped=false;
    lock(true);clearTimeout(timer);
    try {
      if(!await s.save()||store!==s){stopped=true;return;}
      for(let i=0;i<files.length;i++){
        const file=files[i];
        byId('studyImportStatus').textContent=`가져오는 중 ${i+1}/${files.length} · ${file.name}`;
        if(!/\.(txt|md)$/i.test(file.name)||file.size>800000){skipped.push(file.name);continue;}
        let body;
        try {body=await file.text();}
        catch {if(store!==s)return;skipped.push(file.name);continue;}
        if(store!==s)return;
        if(body.length>200000){skipped.push(file.name);continue;}
        const title=file.name.replace(/\.(txt|md)$/i,'').slice(0,120);
        s.select({id:crypto.randomUUID(),title,body,revision:0});s.edit(title,body);fill();
        // Await each save so a failure never replaces the unsaved imported draft.
        const saved=await s.save();if(store!==s)return;
        if(!saved){stopped=true;break;}
        completed++;
      }
    } finally {
      if(store===s){
        lock(false);
        byId('studyImportStatus').textContent=`${completed}개 가져오기 완료${skipped.length?' · '+skipped.length+'개 제외':''}${stopped?' · 저장 실패로 중단됨. 현재 노트를 저장한 뒤 나머지 파일을 다시 선택해 주세요.':''}`;
        if(skipped.length)window.alert('가져오지 못한 파일: '+skipped.join(', ')+'\nUTF-8 TXT·MD 파일인지 확인해 주세요. 파일당 본문은 20만 자까지 지원합니다.');
      }
    }
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
