(() => {
  const host=document.getElementById('studyWorkspace');
  const shell=document.getElementById('appShell');
  const esc=window.CodeWikiLearning.escape;
  let session=null,store=null,notes=[],editor=null,loading=false,loadVersion=0,transition=false;
  let editorLoad=null,mounted=false;
  let listChanges=null,listMarkup=null;
  let folders=null;
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
    if(value)closeToolMenus();
    transition=value;const editor=byId('studyEditor');if(editor)editor.inert=value;
    ['studyNew','studyImport'].forEach(id=>{const button=byId(id);if(button)button.disabled=value;});
  }
  function setUser(user) {
    const token=window.CodeWikiAuth?.getSessionToken()||'';
    const allowed=user?.role==='student'&&user.status==='approved';
    if(allowed&&session?.id===user.id&&session.token===token){
      session.name=user.full_name;
      if(mounted)byId('studyHeading').textContent=session.name+'님의 공부방';
      return;
    }
    folders?.dispose();folders=null;
    store?.dispose();store=null;session=null;notes=[];loadVersion++;transition=false;
    loading=false;listChanges=null;listMarkup=null;
    editor?.destroy();editor=null;mounted=false;host.innerHTML='';
    if(allowed&&token) {
      session={id:user.id,name:user.full_name,token};
      store=window.CodeWikiStudyStore.create({owner:user.id,token,storage:localStorage,
        rpc:(...args)=>{const c=window.CodeWikiAuth.getSupabaseClient();return c?c.rpc(...args):Promise.reject(Error('supabase-unavailable'));},onChange:update});
    }
    route();
  }
  function route() {
    const open=visible();
    host.hidden=!open;shell.classList.toggle('study-hidden',open);
    document.getElementById('openStudyBtn')?.classList.toggle('active',open);
    if(open){window.CodeWikiBoard?.closeIfActive();document.getElementById('sbHomeItem')?.classList.remove('active');document.getElementById('sbScheduleItem')?.classList.remove('active');document.querySelectorAll('.nav-doc-link.active').forEach(el=>el.classList.remove('active'));if(!window.CodeWikiStudyEditor){loadEditor();return;}if(!mounted)mount();else void folders?.load();void list();}
  }
  function loadEditor() {
    if(editorLoad)return;
    host.innerHTML='<p role="status">필기 편집기를 준비하고 있습니다…</p>';
    // Load the editor only when an eligible member opens their study workspace.
    editorLoad=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=document.getElementById('studyEditorSource').dataset.src;
      script.onload=()=>{if(window.CodeWikiStudyEditor)resolve();else{script.remove();reject(new Error('editor-init'));}};
      script.onerror=()=>{script.remove();reject(new Error('editor-load'));};
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
    const icon=(paths)=>`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
    const line=path=>icon(`<path d="${path}"/>`);
    const icons={bold:'<b>B</b>',italic:'<i>I</i>',underline:'<u>U</u>',strike:'<s>S</s>',
      list:line('M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01'),
      orderedList:line('M10 6h11M10 12h11M10 18h11M3 3h1v6M2 9h4M2 14c0-3 4-3 4 0 0 2-4 2-4 5h4'),
      alignLeft:line('M3 5h18M3 10h12M3 15h18M3 20h12'),
      alignCenter:line('M3 5h18M6 10h12M3 15h18M6 20h12'),
      alignRight:line('M3 5h18M9 10h12M3 15h18M9 20h12'),
      alignJustify:line('M3 5h18M3 10h18M3 15h18M3 20h18'),
      indent:line('M10 5h11M10 10h11M10 15h11M10 20h11M2 9l4 3-4 3'),
      outdent:line('M10 5h11M10 10h11M10 15h11M10 20h11M6 9l-4 3 4 3'),
      quote:line('M4 7h6v6H4zM14 7h6v6h-6zM10 13c0 3-2 5-5 5M20 13c0 3-2 5-5 5'),
      code:line('m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18'),
      clear:line('m14 3 7 7-10 10H7l-5-5L14 3M7 10l7 7M12 20h10'),
    };
    const formatButtons=items=>items.map(([key,label])=>`<button type="button" data-format="${key}" aria-label="${label}" ${key==='clear'?'':'aria-pressed="false"'} title="${label}">${icons[key]||label}</button>`).join('');
    const palette=(kind,label,colors)=>`<details class="study-color-menu"><summary aria-label="${label}" title="${label}${kind==='highlight'?' (Ctrl+Alt+H)':''}"><span class="study-color-symbol ${kind}" aria-hidden="true">${kind==='highlight'?'▰':'A'}</span><span class="study-menu-arrow" aria-hidden="true">⌄</span></summary><div class="study-color-options" role="group" aria-label="${label} 선택"><span>${label}</span><button type="button" data-color-kind="${kind}" data-color="" class="study-color-reset">${kind==='highlight'?'강조 없음':'자동 색상'}</button><div class="study-swatches">${colors.map(([color,name])=>`<button type="button" data-color-kind="${kind}" data-color="${color}" style="--swatch:${color}" aria-label="${label} ${name}" title="${name}"></button>`).join('')}</div></div></details>`;
    const tableMenus=[
      ['행 추가',[['addRowBefore','↑ 위쪽','위 행 추가'],['addRow','↓ 아래쪽','아래 행 추가']]],
      ['행 삭제',[['deleteRowBefore','↑ 위쪽','위 행 삭제'],['deleteRow','↓ 아래쪽','아래 행 삭제']]],
      ['열 추가',[['addColumnBefore','← 왼쪽','왼쪽 열 추가'],['addColumn','→ 오른쪽','오른쪽 열 추가']]],
      ['열 삭제',[['deleteColumnBefore','← 왼쪽','왼쪽 열 삭제'],['deleteColumn','→ 오른쪽','오른쪽 열 삭제']]],
    ];
    host.innerHTML=`<header class="study-header"><div><span class="study-eyebrow">PERSONAL STUDY</span><h1 id="studyHeading">${esc(session.name)}님의 공부방</h1><p>오늘 배운 내용을 나만의 언어로.</p></div><span class="study-private">나만 보는 노트</span></header>
      <div class="study-layout" id="studyLayout"><aside class="study-library" aria-label="내 필기"><div class="study-library-heading"><h2>내 필기</h2><div class="study-library-actions"><button type="button" id="studyNew" class="toss-primary-btn">+ 새 노트</button><button type="button" id="studyLibraryToggle" class="study-library-toggle" aria-controls="studyLibraryContent" aria-expanded="true" aria-label="내 필기 접기" title="내 필기 접기">${line('m14 6-6 6 6 6')}</button></div></div>
      <div class="study-library-content" id="studyLibraryContent">
      <label class="sr-only" for="studySearch">노트 제목 검색</label><input id="studySearch" type="search" placeholder="노트 제목 검색"><div class="study-import"><button type="button" id="studyImport" class="toss-chip-btn" title="TXT·MD 파일을 여러 개 선택할 수 있습니다">TXT · MD 가져오기</button><input type="file" id="studyFile" accept=".txt,.md,text/plain,text/markdown" multiple hidden><p id="studyImportStatus" role="status" aria-live="polite"></p></div>
      <div id="studyFolders" class="study-folders"></div><p id="studyListStatus" role="status"></p><button type="button" id="studyRetryList" class="toss-chip-btn" hidden>목록 다시 불러오기</button><div id="studyList" class="study-list"></div></div></aside>
      <section class="study-notebook"><div id="studyEmpty" class="study-empty"><span aria-hidden="true">✎</span><h2>첫 페이지를 펼쳐 보세요</h2><p>새 노트를 만들거나 메모장 파일을 가져오세요.</p></div>
      <div id="studyEditor" hidden><div class="study-note-heading"><label class="sr-only" for="studyTitle">노트 제목</label><input id="studyTitle" class="study-title" maxlength="120" placeholder="노트 제목">
      <div class="study-note-actions" role="group" aria-label="노트 작업"><button type="button" id="studyDelete" class="study-action-icon study-delete-icon" aria-label="노트 삭제" title="노트 삭제">${line('M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6')}</button><span class="study-action-divider" aria-hidden="true"></span><button type="button" id="studyDownload" class="toss-chip-btn study-action-icon" aria-label="노트 내려받기" title="노트 내려받기">${line('M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5')}</button><button type="button" id="studySave" class="toss-primary-btn study-action-icon" aria-label="저장" title="저장" aria-busy="false"><span class="study-save-symbol">${icon('<path d="M5 3h12l4 4v14H3V3h2Z"/><path d="M7 3v6h9V3M7 21v-8h10v8M13 5v2"/>')}</span><span class="study-save-spinner" aria-hidden="true"></span></button></div></div>
      <div id="studyFolderMove" class="study-folder-move"></div>
      <div class="study-editor-meta"><span id="studyStatus" role="status" aria-live="polite"></span></div>
      <div class="study-editor-tools">
      <div class="study-toolbar study-word-tools" role="toolbar" aria-label="필기 서식 도구">
        <div class="study-tool-group"><button type="button" data-history="undo" aria-label="실행 취소" title="실행 취소">${line('M9 4 3 10l6 6M3 10h11a6 6 0 0 1 0 12')}</button><button type="button" data-history="redo" aria-label="다시 실행" title="다시 실행">${line('m15 4 6 6-6 6m6-6H10a6 6 0 0 0 0 12')}</button></div>
        <div class="study-tool-group"><label class="sr-only" for="studyParagraphStyle">문단 스타일</label><select id="studyParagraphStyle" title="문단 스타일 (제목 1~3: Ctrl+Alt+1~3)"><option value="paragraph">일반 텍스트</option>${[1,2,3,4,5,6].map(n=>`<option value="h${n}">제목 ${n}</option>`).join('')}<option value="code" disabled>코드 블록</option></select></div>
        <div class="study-tool-group study-size-group"><button type="button" data-size-step="-1" aria-label="글자 작게" title="글자 작게">−</button><label class="sr-only" for="studyFontSize">글자 크기</label><select id="studyFontSize" title="글자 크기"><option value="">기본</option>${(window.CodeWikiStudyEditor.fontSizes||[]).map(size=>`<option value="${size}">${size}</option>`).join('')}</select><button type="button" data-size-step="1" aria-label="글자 크게" title="글자 크게">+</button></div>
        <div class="study-tool-group">${formatButtons([['bold','굵게'],['italic','기울임'],['underline','밑줄'],['strike','취소선']])}</div>
        <div class="study-tool-group">${palette('textColor','글자색',window.CodeWikiStudyEditor.textColors||[])}${palette('highlight','형광펜',window.CodeWikiStudyEditor.highlightColors||[])}</div>
        <div class="study-tool-group">${formatButtons([['alignLeft','왼쪽 정렬'],['alignCenter','가운데 정렬'],['alignRight','오른쪽 정렬'],['alignJustify','양쪽 정렬']])}</div>
        <div class="study-tool-group">${formatButtons([['list','글머리 기호'],['orderedList','번호 목록'],['outdent','목록 내어쓰기'],['indent','목록 들여쓰기']])}</div>
        <div class="study-tool-group">${formatButtons([['quote','인용'],['code','코드 블록']])}<button type="button" data-table="table" title="표 삽입" aria-label="표 삽입">${icon('<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>')}</button>${formatButtons([['clear','서식 지우기']])}</div>
      </div>
      <div id="studyTableTools" class="study-table-tools" role="group" aria-label="표 편집" hidden><span>표 편집</span>${tableMenus.map(([label,items])=>`<details class="study-table-menu"><summary>${label}<span aria-hidden="true"> ▾</span></summary><div class="study-table-options" role="group" aria-label="${label} 방향">${items.map(([key,text,label])=>`<button type="button" data-table="${key}" aria-label="${label}" title="${label}">${text}</button>`).join('')}</div></details>`).join('')}<button type="button" data-table="deleteTable">표 삭제</button></div>
      </div>
      <div id="studyBody" class="study-rich-editor"></div>
      <footer class="study-note-footer"><span id="studyCount"></span><div><button type="button" id="studyReload">서버 글 불러오기</button></div></footer></div></section></div>`;
    setLibraryCollapsed(false);
    byId('studyLibraryToggle').addEventListener('click',()=>setLibraryCollapsed(!byId('studyLibraryContent').hidden));
    byId('studyNew').addEventListener('click',()=>void createNote());
    byId('studyRetryList').addEventListener('click',()=>{void list();void folders?.load();});
    byId('studySearch').addEventListener('input',renderList);
    byId('studyImport').addEventListener('click',()=>byId('studyFile').click());
    byId('studyFile').addEventListener('change',async e=>{
      const files=Array.from(e.target.files||[]);e.target.value='';
      await importFiles(files);
    });
    editor=window.CodeWikiStudyEditor.create({element:byId('studyBody'),onChange:body=>changed(body),onState:updateToolbar,
      onLimit:()=>window.alert('본문은 20만 자까지 저장할 수 있습니다. 새 노트로 나눠 작성해 주세요.')});
    byId('studyTitle').addEventListener('input',()=>changed());
    byId('studyFontSize').addEventListener('change',e=>{editor.setFontSize(e.target.value);updateToolbar();});
    byId('studyParagraphStyle').addEventListener('change',e=>{editor.setParagraphStyle(e.target.value);updateToolbar();});
    host.querySelectorAll('[data-color-kind],[data-size-step]').forEach(button=>{
      button.addEventListener('mousedown',e=>e.preventDefault());
      button.addEventListener('click',()=>{
        closeToolMenus();
        if(button.dataset.colorKind)editor.setColor(button.dataset.colorKind,button.dataset.color);
        else {
          const sizes=window.CodeWikiStudyEditor.fontSizes,current=Number(editor.fontSize())||14;
          const step=Number(button.dataset.sizeStep),index=sizes.indexOf(current);
          editor.setFontSize(String(sizes[Math.max(0,Math.min(sizes.length-1,index+step))]));
        }
      });
    });
    byId('studySave').addEventListener('click',()=>void store.save({resolveConflict:store.conflicted}));
    byId('studyDownload').addEventListener('click',download);
    byId('studyReload').addEventListener('click',()=>void reload());
    byId('studyDelete').addEventListener('click',()=>void remove());
    host.querySelectorAll('[data-format],[data-history],[data-table]').forEach(button=>{
      const kind=button.dataset.format||button.dataset.history||button.dataset.table;
      const shortcut=window.CodeWikiStudyEditor.shortcut?.(kind,/Mac|iPhone|iPad/.test(window.navigator?.platform||''));
      if(shortcut)button.title=(button.title||button.textContent.trim())+' ('+shortcut+')';
      button.addEventListener('mousedown',e=>e.preventDefault());
      button.addEventListener('click',()=>{closeToolMenus();editor.command(kind);});
    });
    host.querySelectorAll('.study-table-menu,.study-color-menu').forEach(menu=>{
      menu.querySelector('summary').addEventListener('mousedown',e=>e.preventDefault());
      menu.addEventListener('toggle',()=>{if(menu.open)closeToolMenus(menu);});
    });
    const folderStore=store;
    folders=window.CodeWikiStudyFolders?.create({element:byId('studyFolders'),moveElement:byId('studyFolderMove'),listElement:byId('studyList'),
      call:(...args)=>folderStore.call(...args),getNote:()=>folderStore.current,getNotes:()=>notes,onChange:renderList});
    void folders?.load();
    fill();
  }
  function setLibraryCollapsed(collapsed) {
    byId('studyLayout').classList.toggle('library-collapsed',collapsed);
    byId('studyLibraryContent').hidden=collapsed;
    const button=byId('studyLibraryToggle'),label=collapsed?'내 필기 펼치기':'내 필기 접기';
    button.setAttribute('aria-expanded',String(!collapsed));
    button.setAttribute('aria-label',label);
    button.title=label;
  }
  function shortcuts(e) {
    if(e.key==='Escape'){
      const menu=host.querySelector('.study-table-menu[open],.study-color-menu[open]');
      if(menu){e.preventDefault();closeToolMenus();menu.querySelector('summary').focus();}
      return;
    }
    if(!(e.ctrlKey||e.metaKey))return;
    if(e.key.toLowerCase()==='s'){e.preventDefault();void store?.save();}
  }
  function closeToolMenus(except=null){
    host.querySelectorAll('.study-table-menu[open],.study-color-menu[open]').forEach(menu=>{if(menu!==except)menu.open=false;});
  }
  function changed(body=store?.current?.body||'') {
    if(!store?.current)return;
    store.edit(byId('studyTitle').value,body);
  }
  function updateToolbar() {
    if(!editor)return;
    byId('studyFontSize').value=String(editor.fontSize?.()||'');
    byId('studyFontSize').disabled=editor.active('code');
    byId('studyParagraphStyle').value=editor.paragraphStyle?.()||'paragraph';
    host.querySelectorAll('[data-format]').forEach(button=>{
      if(button.dataset.format!=='clear')button.setAttribute('aria-pressed',String(editor.active(button.dataset.format)));
      button.disabled=!editor.can(button.dataset.format);
    });
    host.querySelectorAll('[data-size-step]').forEach(button=>button.disabled=editor.active('code'));
    host.querySelectorAll('.study-color-menu').forEach(menu=>{menu.inert=editor.active('code');});
    host.querySelectorAll('[data-color-kind]').forEach(button=>button.setAttribute('aria-pressed',String((editor.color?.(button.dataset.colorKind)||'')===button.dataset.color)));
    host.querySelectorAll('[data-history]').forEach(button=>button.disabled=!editor.can(button.dataset.history));
    host.querySelectorAll('[data-table]').forEach(button=>button.disabled=!editor.can(button.dataset.table));
    byId('studyTableTools').hidden=!editor.active('table');
    if(byId('studyTableTools').hidden)host.querySelectorAll('.study-table-menu[open]').forEach(menu=>menu.open=false);
    byId('studyCount').textContent=editor.text().length.toLocaleString('ko-KR')+'자';
  }
  function update() {
    if(!store||!byId('studyStatus'))return;
    const savedAt=store.current?.updated_at;
    byId('studyStatus').textContent=[store.status,savedAt?'마지막 저장 '+date(savedAt):''].filter(Boolean).join(' · ');
    const saveButton=byId('studySave');
    const saveLabel=store.busy?'저장 중…':store.conflicted?'현재 글로 저장':store.dirty?'저장':'저장됨';
    saveButton.disabled=store.busy;
    saveButton.setAttribute('aria-busy',String(store.busy));
    saveButton.setAttribute('aria-label',saveLabel);
    saveButton.title=saveLabel+' ('+(/Mac|iPhone|iPad/.test(window.navigator?.platform||'')?'⌘':'Ctrl')+'+S)';
    if(store.current&&!store.dirty&&store.current.revision){
      const titleInput=byId('studyTitle');
      if(titleInput&&titleInput.value!==store.current.title)titleInput.value=store.current.title;
      const note={...store.current,body:undefined},index=notes.findIndex(n=>n.id===note.id);
      const previous=notes[index];
      if(previous&&previous.title===note.title&&previous.updated_at===note.updated_at&&previous.revision===note.revision)return;
      // Selection and save timestamps never affect title-based list ordering.
      if(index<0)notes.unshift(note);else notes[index]=note;
      listChanges?.set(note.id,note);
      folders?.refresh();
      renderList();
    }
  }
  function fill() {
    closeToolMenus();
    const n=store?.current;
    byId('studyEditor').hidden=!n;byId('studyEmpty').hidden=Boolean(n);
    if(n){byId('studyTitle').value=n.title;editor.setContent(n.body);updateToolbar();}
    else editor?.destroy();
    update();folders?.refresh();renderList();
  }
  function renderList() {
    if(!byId('studyList'))return;
    const q=byId('studySearch').value.trim().toLocaleLowerCase();
    const items=notes.filter(n=>(!folders||folders.includesNote(n))&&n.title.toLocaleLowerCase().includes(q)).sort(compareTitles);
    const markup=items.map(n=>`<button type="button" class="study-note-link${store?.current?.id===n.id?' active':''}" data-note="${esc(n.id)}" draggable="true" title="폴더로 드래그하여 이동"><strong>${esc(n.title)}</strong><span>${esc(date(n.updated_at))}</span></button>`).join('')||(!loading?'<p class="study-list-empty">'+(q?'검색 결과가 없습니다.':'저장된 노트가 없습니다.')+'</p>':'');
    if(markup===listMarkup)return;
    byId('studyList').innerHTML=markup;listMarkup=markup;
    byId('studyList').querySelectorAll('[data-note]').forEach(b=>b.addEventListener('click',()=>void select(b.dataset.note)));
  }
  async function list() {
    if(!store||loading)return;
    const s=store,version=++loadVersion,changes=new Map();listChanges=changes;
    loading=true;byId('studyListStatus').textContent='목록 불러오는 중…';byId('studyRetryList').hidden=true;
    try {
      const data=await s.call('cw_list_study_notes');if(store!==s||loadVersion!==version)return;
      // Preserve saves/deletions completed while this older list was in flight.
      const merged=new Map((data||[]).map(note=>[note.id,note]));
      changes.forEach((note,id)=>{if(note)merged.set(id,note);else merged.delete(id);});
      notes=[...merged.values()];byId('studyListStatus').textContent='';
      // Open the most recently edited note only on an empty workspace. A restored
      // draft or a note chosen/created while loading always takes precedence.
      if(!s.current&&!transition&&visible()&&notes.length){
        const latest=notes.reduce((a,b)=>(Date.parse(b.updated_at)||0)>(Date.parse(a.updated_at)||0)?b:a);
        await select(latest.id);
      }
    }
    catch {if(store===s&&loadVersion===version){byId('studyListStatus').textContent='목록을 불러오지 못했습니다.';byId('studyRetryList').hidden=false;}}
    finally {if(store===s&&loadVersion===version){loading=false;listChanges=null;folders?.refresh();renderList();}}
  }
  async function select(id) {
    if(transition||store?.current?.id===id)return;lock(true);const s=store;
    try {if(s.dirty){window.alert('현재 글을 저장한 뒤 다른 노트를 선택해 주세요.');return;}const n=await s.call('cw_get_study_note',{p_id:id});if(store!==s)return;if(!n)throw new Error();if(s.dirty){window.alert('현재 노트를 편집 중입니다. 저장 후 다시 선택해 주세요.');return;}if(!s.select(n))return;fill();}
    catch {if(store===s)window.alert('노트를 불러오지 못했습니다. 다시 시도해 주세요.');}
    finally {if(store===s)lock(false);}
  }
  async function createNote(title='',body='') {
    if(transition||!store)return;lock(true);const s=store;let created=false;
    try {if(s.dirty){window.alert('현재 글을 저장한 뒤 새 노트를 만들어 주세요.');return;}if(!s.select({id:crypto.randomUUID(),title:title.slice(0,120),body,revision:0}))return;created=true;s.edit(title.slice(0,120),body);fill();if(body)await s.save();}
    finally {if(store===s){lock(false);if(created)byId('studyTitle').focus();}}
  }
  async function importFiles(files) {
    if(!files.length||transition||!store)return;
    const s=store,skipped=[];let completed=0,stopped=false;
    lock(true);
    try {
      if(s.dirty){window.alert('현재 글을 저장한 뒤 파일을 가져와 주세요.');stopped=true;return;}
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
    // Keep the lossless editor payload: this download is also the note's backup.
    const blob=new Blob([n.body],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=(n.title||'필기').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function reload() {
    const s=store,n=s?.current;if(!n||transition||s.busy)return;
    if(s.dirty&&!window.confirm('미저장 내용을 서버 글로 바꿀까요? 필요한 내용은 먼저 내려받아 주세요.'))return;
    lock(true);
    const originalTitle=n.title,originalBody=n.body;
    try {const fresh=await s.call('cw_get_study_note',{p_id:n.id});if(store!==s)return;if(!fresh){window.alert('서버에 없는 노트입니다. 현재 글은 유지합니다.');return;}if(s.current.title!==originalTitle||s.current.body!==originalBody){window.alert('불러오는 동안 작성한 내용이 있어 현재 글을 유지합니다.');return;}if(!s.select(fresh))return;fill();}
    catch {if(store===s)window.alert('서버 글을 불러오지 못했습니다.');}
    finally {if(store===s)lock(false);}
  }
  async function remove() {
    const s=store,n=s?.current;if(!n||transition||s.busy)return;
    if(!window.confirm('이 노트를 삭제할까요? 삭제한 노트는 복구할 수 없습니다.'))return;
    lock(true);
    try {if(n.revision)await s.call('cw_delete_study_note',{p_id:n.id,p_revision:n.revision});if(store!==s)return;s.select(null);notes=notes.filter(item=>item.id!==n.id);listChanges?.set(n.id,null);fill();}
    catch {if(store===s)window.alert('삭제하지 못했습니다. 서버 글을 다시 확인해 주세요.');}
    finally {if(store===s)lock(false);}
  }
  window.CodeWikiStudy={setUser,leave(){if(visible()){history.replaceState(null,'','#doc/'+(window.CodeWikiApp?.getCurrentDocId()||'welcome-abap'));route();}}};
  host.addEventListener('keydown',shortcuts);
  window.addEventListener('hashchange',route);
  window.addEventListener('pointerdown',e=>{
    if(host.hidden)return;
    host.querySelectorAll('.study-table-menu[open],.study-color-menu[open]').forEach(menu=>{if(!menu.contains(e.target))menu.open=false;});
  });
  window.addEventListener('beforeunload',e=>{if(store?.dirty){e.preventDefault();e.returnValue='';}});
})();
