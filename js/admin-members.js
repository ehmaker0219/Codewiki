/* Administrator-only directory and student login history. Credentials exist only in the reset form/request. */
(() => {
  const host=document.getElementById('adminMembersPage'),shell=document.getElementById('appShell');
  const esc=window.CodeWikiLearning.escape;
  const statuses={approved:'승인 완료',pending:'승인 대기',rejected:'반려'};
  const columns=[['student_number','번호'],['full_name','이름'],['class_name','반'],['username','아이디'],['birth_date','생년월일'],['mbti','MBTI'],['status','가입 상태'],['completed_docs','학습 진도'],['last_login_at','최근 로그인'],['created_at','가입일']];
  const accountColumns=[['student_number','번호'],['full_name','이름'],['class_name','반'],['username','아이디'],['status','가입 상태']];
  const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
  let sortKey='full_name',sortDirection=1;
  let session=null,active=false,rows=[],rowsLoaded=false,version=0,loading=false,rowsMessage='';
  let logins=[],loginsLoaded=false,loginsVersion=0,loginsLoading=false,loginsMessage='',loginsUserId='';
  let insightsMessage='',dialogVersion=0,insightDialogBusy=false;
  let query='',classFilter='',statusFilter='',selectedUserId='',dialog=null,resetBusy=false,usernameBusy=false,logoutAllBusy=false;
  let online=null,livePresence=null;
  const ADMIN_TAB_HASHES={students:'#admin/students',accounts:'#admin/accounts',approvals:'#admin/approvals',logins:'#admin/logins',notices:'#admin/notices',dashboard:'#admin/dashboard',controls:'#admin/controls',insights:'#admin/insights',security:'#admin/security'};
  const isAdminRoute=()=>Object.values(ADMIN_TAB_HASHES).includes(window.location.hash);
  const currentTab=()=>{
    const h=window.location.hash;
    if(h==='#admin/accounts')return 'accounts';
    if(h==='#admin/approvals')return 'approvals';
    if(h==='#admin/logins')return 'logins';
    if(h==='#admin/notices')return 'notices';
    if(h==='#admin/dashboard')return 'dashboard';
    if(h==='#admin/controls')return 'controls';
    if(h==='#admin/insights')return 'insights';
    if(h==='#admin/security')return 'security';
    return 'students';
  };
  const visible=()=>Boolean(session)&&isAdminRoute();
  const current=(s,v)=>session===s&&version===v&&active;
  const currentLogins=(s,v)=>session===s&&loginsVersion===v&&active;
  const DEVICE_LABELS={desktop:'PC',mobile:'모바일',tablet:'태블릿'};
  const LOGIN_TYPE_LABELS={login:'직접 로그인',signup:'가입 로그인',revisit:'자동 재방문'};
  const STUDENT_TOOL_META=[['mentoring','멘토링'],['foundation','파운데이션']];
  const toolBusyUsers=new Set();
  function resolveStudentTools(u){
    const raw=u?.tools&&typeof u.tools==='object'?u.tools:null;
    const mentoring=typeof raw?.mentoring==='boolean'
      ? raw.mentoring
      : Boolean(window.CodeWikiMentoringModel?.staticMember ? window.CodeWikiMentoringModel.staticMember(u?.id) : window.CodeWikiMentoringModel?.member?.(u?.id));
    const foundation=typeof raw?.foundation==='boolean'
      ? raw.foundation
      : Boolean(u?.id&&window.CodeWikiFoundation?.OWNER_ID===u.id);
    return {mentoring,foundation};
  }
  async function toggleStudentTool(uid,toolKey){
    const student=rows.find(u=>u.id===uid),s=session,v=version;
    if(!student||!active||!s||student.status!=='approved'||toolBusyUsers.has(uid)||!STUDENT_TOOL_META.some(([k])=>k===toolKey))return;
    const currentTools=resolveStudentTools(student);
    const nextTools={...currentTools,[toolKey]:!currentTools[toolKey]};
    const label=STUDENT_TOOL_META.find(([k])=>k===toolKey)?.[1]||toolKey;
    toolBusyUsers.add(uid);
    if(currentTab()==='accounts')renderRows();
    try{
      const result=await call('cw_admin_set_student_tools',{p_target_id:uid,p_tools:nextTools},s);
      if(!current(s,v))return;
      if(result?.ok!==true||!result.tools||typeof result.tools!=='object')throw Error();
      student.tools={mentoring:Boolean(result.tools.mentoring),foundation:Boolean(result.tools.foundation)};
      window.CodeWikiAuth?.setAdminPreviewRoster?.(rows);
      void window.CodeWikiTelemetry?.notifyRuntimeUpdate?.();
      rowsMessage=`${student.full_name}님의 ${label} 권한을 ${student.tools[toolKey]?'켰습니다':'껐습니다'}.`;
    }catch(error){
      if(current(s,v)){
        const messages={
          '42501':'관리자 로그인이 만료되었습니다. 다시 로그인해 주세요.',
          CW_ADMIN_REQUIRED:'관리자 로그인이 만료되었습니다. 다시 로그인해 주세요.',
          CW_STUDENT_NOT_FOUND:'학생 계정을 찾을 수 없습니다.',
          CW_RATE_LIMIT:'요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.',
          PGRST202:'학생별 전용 기능 권한 설정이 아직 서버 DB에 적용되지 않았습니다.'
        };
        rowsMessage=messages[error?.code]||`${student.full_name}님의 ${label} 권한을 변경하지 못했습니다.`;
      }
    }finally{
      if(session===s)toolBusyUsers.delete(uid);
      if(current(s,v)&&currentTab()==='accounts'){
        renderRows();
        const msgEl=host.querySelector('#membersMessage');if(msgEl)msgEl.textContent=rowsMessage;
      }
    }
  }
  function syncSidebarActive(){
    const tab=currentTab();
    document.getElementById('openStudentDirectoryBtn')?.classList[active&&tab==='students'?'add':'remove']('active');
    document.getElementById('openStudentAccountsBtn')?.classList[active&&tab==='accounts'?'add':'remove']('active');
    document.getElementById('openAdminModalBtn')?.classList[active&&tab==='approvals'?'add':'remove']('active');
    document.getElementById('openLoginHistoryBtn')?.classList[active&&tab==='logins'?'add':'remove']('active');
    document.getElementById('openAdminNoticesBtn')?.classList[active&&tab==='notices'?'add':'remove']('active');
    document.getElementById('openAdminDashboardBtn')?.classList[active&&tab==='dashboard'?'add':'remove']('active');
    document.getElementById('openAdminControlsBtn')?.classList[active&&tab==='controls'?'add':'remove']('active');
    document.getElementById('openAdminInsightsBtn')?.classList[active&&tab==='insights'?'add':'remove']('active');
    document.getElementById('openAdminSecurityBtn')?.classList[active&&tab==='security'?'add':'remove']('active');
  }
  function closeReset(){dialogVersion++;insightDialogBusy=false;if(dialog){dialog.classList?.remove?.('profile-dialog-wide');dialog.close();dialog.innerHTML='';}resetBusy=false;usernameBusy=false;logoutAllBusy=false;const lb=host.querySelector('[data-logout-all]');if(lb)lb.disabled=false;}
  function ensureDialog(labelledBy,wide=false){
    dialogVersion++;
    insightDialogBusy=false;
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='profile-dialog';document.body.append(dialog);
      dialog.addEventListener('cancel',e=>{if(resetBusy||usernameBusy||logoutAllBusy||insightDialogBusy)e.preventDefault();});
      dialog.addEventListener('close',()=>{dialogVersion++;insightDialogBusy=false;dialog.classList?.remove?.('profile-dialog-wide');dialog.innerHTML='';});
    }
    dialog.classList?.[wide?'add':'remove']?.('profile-dialog-wide');
    dialog.setAttribute('aria-labelledby',labelledBy);
    return dialogVersion;
  }
  let insightsCtrl=null;
  function getInsightsCtrl(){
    if(!insightsCtrl&&window.CodeWikiAdminInsights?.create){
      insightsCtrl=window.CodeWikiAdminInsights.create({
        host,
        callRpc:(name,args,s)=>call(name,args,s),
        getSession:()=>session,
        getStudents:()=>rows,
        isActive:()=>active,
        getCurrentTab:()=>currentTab(),
        getDialog:(labelledBy,wide)=>{const v=ensureDialog(labelledBy,wide);return {dlg:dialog,version:v};},
        getDialogVersion:()=>dialogVersion,
        setDialogBusy:b=>{insightDialogBusy=Boolean(b);},
        closeDialog:closeReset,
        onMessage:text=>{
          const tab=currentTab();
          if(tab==='logins')loginsMessage=text;
          else if(tab==='students'||tab==='accounts')rowsMessage=text;
          else insightsMessage=text;
          const msgEl=host.querySelector('#membersMessage');if(msgEl)msgEl.textContent=text;
        },
        onPresenceRefresh:()=>window.CodeWikiPresence?.refresh?.(true),
        onSecurityAlertsChange:count=>syncSecuritySidebarBadge(count)
      });
    }
    return insightsCtrl;
  }
  let approvalCtrl=null;
  function syncApprovalSidebarBadge(count){
    const badge=document.getElementById('adminPendingCountBadge');
    if(!badge)return;
    const n=typeof count==='number'?count:Number(window.CodeWikiAuth?.getCurrentUser?.()?.pending_count)||0;
    badge.textContent=n>0?String(n):'';
    badge.hidden=!(n>0);
  }
  function syncSecuritySidebarBadge(count){
    const badge=document.getElementById('adminSecurityAlertBadge');
    if(!badge)return;
    const user=window.CodeWikiAuth?.getCurrentUser?.();
    let n=typeof count==='number'?count:Number(user?.security_alert_count)||0;
    if(typeof count!=='number'&&n>0&&user?.role==='admin'&&!Object.prototype.hasOwnProperty.call(user,'security_ack_at')){
      try{
        const saved=JSON.parse(localStorage.getItem(`codewiki_sec_ack_v1:${user.id}`)||'null');
        if(saved&&saved.ackAt&&(Date.now()-new Date(saved.ackAt).getTime())<86400000&&n<=(Number(saved.ackedCount)||0))n=0;
      }catch{}
    }
    badge.textContent=n>0?String(n):'';
    badge.hidden=!(n>0);
  }
  function getApprovalCtrl(){
    if(!approvalCtrl&&window.CodeWikiAdmin?.create){
      approvalCtrl=window.CodeWikiAdmin.create({
        mode:'page',
        getContainer:()=>host.querySelector('#membersTable'),
        getToken:()=>session?.token||'',
        getUser:()=>window.CodeWikiAuth?.getCurrentUser?.()||(session?{id:session.id,role:'admin'}:null),
        getClient:()=>window.CodeWikiAuth?.getSupabaseClient?.(),
        isActive:()=>active&&currentTab()==='approvals',
        onChange:()=>window.CodeWikiAuth?.refresh?.()||Promise.resolve(),
        onUsersChange:({pendingCount})=>syncApprovalSidebarBadge(pendingCount)
      });
    }
    return approvalCtrl;
  }
  function clear(){
    version++;loginsVersion++;
    rows=[];rowsLoaded=false;loading=false;rowsMessage='';toolBusyUsers.clear();
    logins=[];loginsLoaded=false;loginsLoading=false;loginsMessage='';loginsUserId='';selectedUserId='';
    insightsMessage='';
    livePresence=null;
    insightsCtrl?.reset?.();
    approvalCtrl?.reset?.();
    closeReset();host.innerHTML='';host.hidden=true;active=false;
    shell.classList.remove('members-hidden');
    syncSidebarActive();
  }
  function setUser(user){
    const token=window.CodeWikiAuth?.getSessionToken()||'';
    if(user?.role==='admin'&&session?.id===user.id&&session.token===token){
      syncApprovalSidebarBadge(approvalCtrl?.getPendingCount?.()??(Number(user.pending_count)||0));
      syncSecuritySidebarBadge();
      return;
    }
    clear();online=null;livePresence=null;
    session=user?.role==='admin'&&token?{id:user.id,token}:null;query='';classFilter='';statusFilter='';
    sortKey='full_name';sortDirection=1;
    approvalCtrl?.setUser?.(user);
    const h=window.location.hash;
    if(session&&(!h||h==='#admin/students'||h==='#doc/welcome-abap'||h==='#doc/welcome-ui5'||h==='#map'||h==='#study'||h==='#mentoring'||h==='#data-game'||h==='#foundation'))openHome();else route();
  }
  function openRoute(hash){
    if(!session)return false;
    const target=Object.values(ADMIN_TAB_HASHES).includes(hash)?hash:'#admin/students';
    history.replaceState(null,'',target);route();window.CodeWikiPresence?.refresh();return true;
  }
  function openHome(){return openRoute('#admin/students');}
  function renderPresence(){
    const panel=host.querySelector('#membersPresence');if(!panel)return;
    if(online===false){panel.innerHTML='<strong>접속 상태를 확인하지 못했습니다.</strong><span>잠시 후 자동으로 다시 확인합니다.</span>';return;}
    if(online===null){panel.innerHTML='<strong>접속 상태를 확인하고 있습니다.</strong><span>최근 2분 기준 · 1분마다 갱신</span>';return;}
    if(livePresence&&Array.isArray(livePresence.online)){
      const docTitle=window.CodeWikiAdminInsights?.docTitle||(id=>id);
      const list=livePresence.online;
      const byDoc=Array.isArray(livePresence.by_doc)?livePresence.by_doc:[];
      const docStrip=byDoc.length?`<div class="members-live-docs">${byDoc.map(d=>`<span class="members-live-doc-pill">${esc(d.label||docTitle(d.doc_id))} <b>${d.count}명</b></span>`).join('')}</div>`:'';
      panel.innerHTML=`<strong>현재 접속 ${list.length}명</strong><span>최근 2분 기준 · 실시간 열람 위치 포함</span>${docStrip}<div class="members-online-names">${list.map(u=>{
        const loc=u.role==='admin'?'':(u.current_label||u.current_doc_id?` · ${esc(u.current_label||docTitle(u.current_doc_id))}`:'');
        const dev=u.role==='admin'?'':(u.device_type?` <small class="members-dev-tag">${esc(DEVICE_LABELS[u.device_type]||u.device_type)}</small>`:'');
        return `<span>${esc(u.full_name)}${u.role==='admin'?' (관리자)':` · ${esc(u.class_name||'')}${loc}${dev}`}</span>`;
      }).join('')||'<span>접속 중인 회원이 없습니다.</span>'}</div>`;
      return;
    }
    panel.innerHTML=`<strong>현재 접속 ${online.length}명</strong><span>최근 2분 기준 · 관리자 포함</span><div class="members-online-names">${online.map(u=>`<span>${esc(u.full_name)}${u.role==='admin'?' (관리자)':` · ${esc(u.class_name||'')}`}</span>`).join('')||'<span>접속 중인 회원이 없습니다.</span>'}</div>`;
  }
  async function call(name,args,s){
    const controller=new AbortController();let timer;
    try{
      const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reject({code:'TIMEOUT'});controller.abort();},15000);});
      const client=window.CodeWikiAuth?.getSupabaseClient();
      if(name!=='cw_admin_reset_student_password'&&!client)throw new Error('서버 연결을 확인해 주세요.');
      const request=name==='cw_admin_reset_student_password'
        ? window.CodeWikiAuth.credentialRequest(name,{p_token:s.token,...args})
        : client.rpc(name,{p_token:s.token,...args});
      const result=await Promise.race([typeof request?.abortSignal==='function'?request.abortSignal(controller.signal):request,timeout]);
      if(result.error)throw result.error;if(result.data?.code)throw result.data;return result.data;
    }finally{clearTimeout(timer);}
  }
  function render(){
    const activeEl=document.activeElement;
    const keepSearch=activeEl?.id==='membersSearch'&&host.contains?.(activeEl);
    const selStart=keepSearch&&typeof activeEl.selectionStart==='number'?activeEl.selectionStart:null;
    const selEnd=keepSearch&&typeof activeEl.selectionEnd==='number'?activeEl.selectionEnd:null;
    const tab=currentTab();
    const isDirectoryTab=tab==='students'||tab==='accounts';
    const isTableTab=isDirectoryTab||tab==='logins';
    const source=tab==='logins'?logins:rows;
    const classes=[...new Set(source.map(u=>u.class_name||'기본반'))].sort((a,b)=>a.localeCompare(b,'ko',{numeric:true}));
    if(classFilter&&!classes.includes(classFilter))classes.push(classFilter);
    const meta={
      students:['학생 정보','가입한 학생의 기본 프로필, 학습 진도, 최근 접속 현황을 확인합니다.'],
      accounts:['계정 관리','학생별 화면 미리보기, 아이디 변경, 비밀번호 재설정 및 세션 로그아웃을 관리합니다.'],
      approvals:['학생 승인 관리','가입 신청 학생의 승인·반려 처리와 거절된 요청 정리를 한눈에 관리합니다.'],
      logins:['학생 로그인 내역','학생들의 로그인 및 자동 재방문 기록(접속 기기 · OS · 브라우저 · IP · 국가)을 시간순으로 확인합니다.'],
      notices:['공지 · 1:1 알림','전체 공지 팝업, 수업 스포트라이트 배너, 1:1 학생 알림 발송 및 통합 발송 내역을 관리합니다.'],
      dashboard:['출석부','일별 순방문자, 접속 히트맵, 출석부 가입률, 미가입자 명단 및 장기 미접속 학생을 확인합니다.'],
      controls:['원격 제어','원격 점검 모드(Maintenance)와 학생 메뉴 원격 잠금(Feature Flags)을 제어합니다.'],
      insights:['학습 분석','단원별 학습 완료율, 이해 병목 레이더, 인기 문서, 검색 충족률, 코드 복사 및 퀴즈 오답률을 분석합니다.'],
      security:['보안 검사','로그인 실패(6회 이상 위험)·무차별 시도, 암호화 패킷 위변조, 비인가 API 접근, SQLi/XSS 의심 입력 및 감사 로그를 상세 관제합니다.']
    }[tab]||['학생 정보','가입한 학생의 기본 프로필과 학습 현황을 확인합니다.'];
    const [title,desc]=meta;
    const statusText=tab==='logins'?(loginsLoading?'로그인 내역을 불러오는 중…':loginsMessage):(isDirectoryTab?(loading?'학생 정보를 불러오는 중…':rowsMessage):(tab==='approvals'?'':insightsMessage));
    const hasInsights=Boolean(window.CodeWikiAdminInsights);
    const headingActions=`${(tab==='students'||tab==='logins')&&hasInsights?'<button type="button" class="toss-chip-btn" data-export-csv>CSV 내보내기</button>':''}${tab==='accounts'?`<button type="button" class="toss-chip-btn members-danger-btn" data-logout-all ${logoutAllBusy?'disabled':''}>전원 로그아웃</button>`:''}`;
    host.innerHTML=`<header class="members-heading"><div><h1>${title}</h1><p>${desc}</p></div>${headingActions?`<div class="members-heading-actions">${headingActions}</div>`:''}</header><section id="membersPresence" class="members-presence" aria-label="현재 접속자"></section>
      ${isTableTab?`<div class="members-filters"><label>검색<input id="membersSearch" type="search" placeholder="${tab==='logins'?'이름, 아이디, IP, 기기, 브라우저':'이름 또는 아이디'}" value="${esc(query)}"></label><label>반<select id="membersClass"><option value="">전체 반</option>${classes.map(c=>`<option value="${esc(c)}" ${classFilter===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>상태<select id="membersStatus"><option value="">전체 상태</option>${Object.entries(statuses).map(([id,name])=>`<option value="${id}" ${statusFilter===id?'selected':''}>${name}</option>`).join('')}</select></label><span class="members-count" id="membersCount"></span></div>`:''}
      <p id="membersMessage" role="status"></p><div class="members-table-wrap" id="membersTable"></div>`;
    const msg=host.querySelector('#membersMessage');if(msg)msg.textContent=statusText;
    renderPresence();
    if(isTableTab)renderRows();
    else if(tab==='approvals')getApprovalCtrl()?.render();
    else getInsightsCtrl()?.renderTab(tab);
    if(keepSearch){
      const search=host.querySelector('#membersSearch');
      search?.focus?.({preventScroll:true});
      if(selStart!==null&&selEnd!==null)try{search?.setSelectionRange?.(selStart,selEnd);}catch{}
    }
  }
  function renderRows(){
    const countEl=host.querySelector('#membersCount');
    const tableEl=host.querySelector('#membersTable');
    if(!tableEl)return;
    const q=query.trim().toLocaleLowerCase();
    const matches=u=>(!q||`${u.full_name||''} ${u.username||''}`.toLocaleLowerCase().includes(q))&&(!classFilter||(u.class_name||'기본반')===classFilter)&&(!statusFilter||u.status===statusFilter);
    const matchesLogin=e=>{
      const typeLabel=LOGIN_TYPE_LABELS[e.login_type]||e.login_type||'';
      const devLabel=DEVICE_LABELS[e.device_type]||e.device_type||'';
      const hay=`${e.full_name||''} ${e.username||''} ${e.ip_address||''} ${e.country_code||''} ${devLabel} ${e.device_model||''} ${e.os_name||''} ${e.browser_name||''} ${e.language||''} ${typeLabel} ${e.user_agent||''}`.toLocaleLowerCase();
      return (!q||hay.includes(q))&&(!classFilter||(e.class_name||'기본반')===classFilter)&&(!statusFilter||e.status===statusFilter);
    };
    if(currentTab()==='logins'){
      const filtered=logins.filter(e=>(!selectedUserId||e.user_id===selectedUserId)&&matchesLogin(e));
      if(countEl)countEl.textContent=`${filtered.length}건 / 전체 ${logins.length}건`;
      const renderLoginDevice=e=>{
        const devLabel=DEVICE_LABELS[e.device_type]||'';
        const model=e.device_model||'';
        const os=e.os_name||'';
        const uaAttr=e.user_agent?` title="${esc(e.user_agent)}"`:'';
        if(!devLabel&&!model&&!os)return `<span class="members-cell-muted"${uaAttr}>—</span>`;
        const head=[devLabel?`<span class="members-dev-pill">${esc(devLabel)}</span>`:'',model?`<strong>${esc(model)}</strong>`:''].filter(Boolean).join(' ');
        const sub=os?`<span class="admin-sec-sub">${esc(os)}</span>`:'';
        return `<div class="members-login-env"${uaAttr}>${head||`<strong>${esc(os)}</strong>`}${head?sub:''}</div>`;
      };
      const renderLoginBrowser=e=>{
        const br=e.browser_name||'';
        const lang=e.language||'';
        const uaAttr=e.user_agent?` title="${esc(e.user_agent)}"`:'';
        if(!br&&!lang)return `<span class="members-cell-muted"${uaAttr}>—</span>`;
        return `<div class="members-login-env"${uaAttr}><strong>${esc(br||'브라우저 미확인')}</strong>${lang?`<span class="admin-sec-sub">${esc(lang)}</span>`:''}</div>`;
      };
      const renderLoginIp=e=>{
        if(!e.ip_address&&!e.country_code)return '<span class="members-cell-muted">—</span>';
        const ipHtml=e.ip_address?`<code class="admin-sec-fp">${esc(e.ip_address)}</code>`:'<span class="members-cell-muted">IP 미확인</span>';
        const countryHtml=e.country_code?` <span class="members-country-pill">${esc(e.country_code)}</span>`:'';
        return `<div class="members-ip-cell">${ipHtml}${countryHtml}</div>`;
      };
      tableEl.innerHTML=filtered.length
        ? `<table class="members-table members-logins-table"><caption>${selectedUserId?'선택한 학생 로그인 내역 · 최대 100건 (한국 시간 기준 · 기기/브라우저에 마우스를 올리면 상세 User-Agent 확인)':'최근 학생 로그인 내역 · 최대 100건 (한국 시간 기준 · 기기/브라우저에 마우스를 올리면 상세 User-Agent 확인)'}</caption><colgroup><col class="col-login-time"><col class="col-login-num"><col class="col-login-name"><col class="col-login-class"><col class="col-login-id"><col class="col-login-device"><col class="col-login-browser"><col class="col-login-ip"><col class="col-login-status"></colgroup><thead><tr><th scope="col">로그인 시각</th><th scope="col" class="members-col-center">번호</th><th scope="col">이름</th><th scope="col" class="members-col-center">반</th><th scope="col">아이디</th><th scope="col">기기 · OS</th><th scope="col">브라우저</th><th scope="col">접속 IP</th><th scope="col" class="members-col-right">가입 상태</th></tr></thead><tbody>${filtered.map(e=>{
            const ltype=e.login_type||'login';
            const typeText=LOGIN_TYPE_LABELS[ltype]||'직접 로그인';
            const typeCls=ltype==='revisit'?'is-revisit':(ltype==='signup'?'is-signup':'is-direct');
            return `<tr><td class="members-time-cell"><div>${esc(formatDateTime(e.logged_in_at))}</div><span class="members-login-type ${typeCls}">${esc(typeText)}</span></td><td class="members-col-center members-col-nowrap">${esc(e.student_number??'—')}</td><td class="members-col-nowrap members-name-cell">${esc(e.full_name)}</td><td class="members-col-center members-col-nowrap">${esc(e.class_name||'기본반')}</td><td class="members-id-cell">${esc(e.username)}</td><td>${renderLoginDevice(e)}</td><td>${renderLoginBrowser(e)}</td><td class="members-col-nowrap">${renderLoginIp(e)}</td><td class="members-col-right members-col-nowrap">${esc(statuses[e.status]||e.status)}</td></tr>`;
          }).join('')}</tbody></table>`
        : loginsLoading||loginsMessage?'':`<p class="members-reset-note">${logins.length?'조건에 맞는 로그인 내역이 없습니다.':'기록된 학생 로그인 내역이 없습니다. 로그인 기록 적용 이후의 로그인이 여기에 표시됩니다.'}</p>`;
      return;
    }
    const filtered=rows.filter(matches).sort(compareRows);
    if(countEl)countEl.textContent=`${filtered.length}명 / 전체 ${rows.length}명`;
    const renderSortHeaders=cols=>cols.map(([key,label])=>`<th scope="col" aria-sort="${sortKey===key?(sortDirection===1?'ascending':'descending'):'none'}"><button type="button" class="members-sort" data-members-sort="${key}" aria-label="${label} ${sortKey===key&&sortDirection===1?'내림차순':'오름차순'} 정렬">${label}<span aria-hidden="true">${sortKey===key?(sortDirection===1?'↑':'↓'):'↕'}</span></button></th>`).join('');
    if(currentTab()==='accounts'){
      const hasInsights=Boolean(window.CodeWikiAdminInsights);
      const hasPreview=typeof window.CodeWikiAuth?.setAdminPreviewMode==='function';
      const renderToolToggles=u=>{
        if(u.status!=='approved')return '<span class="admin-feed-dash">—</span>';
        const tools=resolveStudentTools(u);
        const busyUser=toolBusyUsers.has(u.id);
        return `<div class="members-tool-toggles" role="group" aria-label="${esc(u.full_name)} 전용 학습툴">${STUDENT_TOOL_META.map(([key,label])=>{
          const on=Boolean(tools[key]);
          return `<button type="button" class="members-tool-toggle${on?' is-on':''}" data-toggle-tool="${key}" data-tool-uid="${esc(u.id)}" aria-pressed="${on}" ${busyUser?'disabled':''} title="${esc(label)} ${on?'켜짐 (클릭해 끄기)':'꺼짐 (클릭해 켜기)'}"><span class="members-tool-dot" aria-hidden="true"></span>${esc(label)}</button>`;
        }).join('')}</div>`;
      };
      tableEl.innerHTML=filtered.length?`<table class="members-table"><caption>학생 계정, 전용 학습툴 권한(ON/OFF) 및 화면 제어</caption><thead><tr>${renderSortHeaders(accountColumns)}<th scope="col">전용 학습툴</th><th scope="col" class="members-actions-col">계정 · 화면 관리</th></tr></thead><tbody>${filtered.map(u=>`<tr data-student-id="${esc(u.id)}"><td>${esc(u.student_number??'—')}</td><td>${esc(u.full_name)}</td><td>${esc(u.class_name||'기본반')}</td><td>${esc(u.username)}</td><td>${esc(statuses[u.status]||u.status)}</td><td>${renderToolToggles(u)}</td><td class="members-actions-cell"><div class="members-row-actions">${hasPreview&&u.status==='approved'?`<button type="button" class="toss-chip-btn" data-preview-student="${esc(u.id)}">화면 미리보기</button>`:''}<button type="button" class="toss-chip-btn" data-edit-username="${esc(u.id)}">아이디 변경</button><button type="button" class="toss-chip-btn" data-reset-student="${esc(u.id)}">비밀번호 재설정</button>${hasInsights?`<button type="button" class="toss-chip-btn members-danger-btn" data-logout-student="${esc(u.id)}">로그아웃</button>`:''}</div></td></tr>`).join('')}</tbody></table>`:loading||rowsMessage?'':'<p class="members-reset-note">표시할 학생이 없습니다.</p>';
      return;
    }
    tableEl.innerHTML=filtered.length?`<table class="members-table"><caption>학생 기본 정보 · 생년월일은 관리자 전용</caption><thead><tr>${renderSortHeaders(columns)}</tr></thead><tbody>${filtered.map(u=>`<tr data-student-id="${esc(u.id)}"><td>${esc(u.student_number??'—')}</td><td>${esc(u.full_name)}</td><td>${esc(u.class_name||'기본반')}</td><td>${esc(u.username)}</td><td>${esc(u.birth_date||'미등록')}</td><td>${esc(u.mbti||'—')}</td><td>${esc(statuses[u.status]||u.status)}</td><td>${u.completed_docs!=null?`${Number(u.completed_docs)||0}개`:'—'}</td><td>${u.last_login_at?`<button type="button" class="members-login-link" data-view-logins="${esc(u.username)}" data-view-logins-id="${esc(u.id)}" title="로그인 내역 보기">${esc(formatDateTime(u.last_login_at))}${Number(u.login_count)>0?` <small>(${esc(u.login_count)}회)</small>`:''}</button>`:'—'}</td><td>${esc(formatDate(u.created_at))}</td></tr>`).join('')}</tbody></table>`:loading||rowsMessage?'':'<p class="members-reset-note">표시할 학생이 없습니다.</p>';
  }
  function sortValue(row){
    const value=sortKey==='status'?statuses[row.status]:row[sortKey];
    if(value==null||value==='')return null;
    if(sortKey==='student_number'||sortKey==='completed_docs'||sortKey==='birth_date'||sortKey==='last_login_at'||sortKey==='created_at'){
      const number=(sortKey==='student_number'||sortKey==='completed_docs')?Number(value):new Date(value).getTime();
      return Number.isFinite(number)?number:null;
    }
    return String(value);
  }
  function compareRows(a,b){
    const left=sortValue(a),right=sortValue(b);
    // Keep unregistered values last in both directions.
    if(left===null&&right!==null)return 1;
    if(left!==null&&right===null)return -1;
    const result=left===null?0:typeof left==='number'?left-right:collator.compare(left,right);
    return result*sortDirection||collator.compare(a.full_name||'',b.full_name||'')||collator.compare(a.username||'',b.username||'')||collator.compare(a.id,b.id);
  }
  function sortBy(key){
    const tab=currentTab();
    const activeCols=tab==='accounts'?accountColumns:columns;
    if(!active||!session||(tab!=='students'&&tab!=='accounts')||!activeCols.some(([id])=>id===key))return;
    sortDirection=sortKey===key?-sortDirection:1;sortKey=key;
    renderRows();
    host.querySelector(`[data-members-sort="${key}"]`)?.focus({preventScroll:true});
  }
  function formatDate(value){const d=new Date(value);return value&&!Number.isNaN(d.getTime())?d.toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}):'—';}
  function formatDateTime(value){const d=new Date(value);return value&&!Number.isNaN(d.getTime())?d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';}
  async function load(force=false){
    if(!active||!session||(loading&&!force))return;
    const s=session,v=++version;loading=true;rows=[];rowsLoaded=false;rowsMessage='';closeReset();
    if(currentTab()==='students'||currentTab()==='accounts')render();
    try{const result=await call('cw_admin_student_directory',{},s);if(!current(s,v))return;if(!Array.isArray(result))throw Error();rows=result;rowsLoaded=true;loading=false;window.CodeWikiAuth?.setAdminPreviewRoster?.(rows);if(currentTab()==='students'||currentTab()==='accounts')render();}
    catch(error){if(current(s,v)){loading=false;rowsMessage=error?.code==='PGRST202'?'학생 정보 기능이 아직 서버에 적용되지 않았습니다.':'학생 정보를 불러오지 못했습니다. 새로고침해 주세요.';if(currentTab()==='students'||currentTab()==='accounts')render();}}
  }
  async function loadLogins(targetUserId=selectedUserId,force=false){
    const uid=targetUserId||'';
    if(!active||!session||(loginsLoading&&!force&&loginsUserId===uid))return;
    const s=session,v=++loginsVersion;
    loginsLoading=true;logins=[];loginsLoaded=false;loginsUserId=uid;loginsMessage='';
    if(currentTab()==='logins')render();
    try{
      const args=uid?{p_limit:100,p_user_id:uid}:{p_limit:100};
      const result=await call('cw_admin_login_history',args,s);
      if(!currentLogins(s,v))return;if(!Array.isArray(result))throw Error();
      logins=result;loginsLoaded=true;loginsLoading=false;if(currentTab()==='logins')render();
    }catch(error){if(currentLogins(s,v)){loginsLoading=false;loginsMessage=error?.code==='PGRST202'?'로그인 내역 기능이 아직 서버에 적용되지 않았습니다.':'로그인 내역을 불러오지 못했습니다. 새로고침해 주세요.';if(currentTab()==='logins')render();}}
  }
  function switchTab(tab,presetQuery,presetUserId){
    if(!active||!session)return;
    if(presetQuery!==undefined){
      query=presetQuery;classFilter='';statusFilter='';
      selectedUserId=presetUserId||rows.find(r=>r.username===presetQuery)?.id||'';
    } else if(tab==='logins'){
      if(selectedUserId){selectedUserId='';query='';}
    }
    const target=ADMIN_TAB_HASHES[tab]||'#admin/students';
    if(window.location.hash!==target)history.replaceState(null,'',target);
    route();
  }
  function exportCurrentCsv(){
    const dl=window.CodeWikiAdminInsights?.downloadCsv;
    if(!dl)return;
    const q=query.trim().toLocaleLowerCase();
    const matches=u=>(!q||`${u.full_name||''} ${u.username||''}`.toLocaleLowerCase().includes(q))&&(!classFilter||(u.class_name||'기본반')===classFilter)&&(!statusFilter||u.status===statusFilter);
    if(currentTab()==='logins'){
      const matchesLogin=e=>{
        const typeLabel=LOGIN_TYPE_LABELS[e.login_type]||e.login_type||'';
        const devLabel=DEVICE_LABELS[e.device_type]||e.device_type||'';
        const hay=`${e.full_name||''} ${e.username||''} ${e.ip_address||''} ${e.country_code||''} ${devLabel} ${e.device_model||''} ${e.os_name||''} ${e.browser_name||''} ${e.language||''} ${typeLabel} ${e.user_agent||''}`.toLocaleLowerCase();
        return (!q||hay.includes(q))&&(!classFilter||(e.class_name||'기본반')===classFilter)&&(!statusFilter||e.status===statusFilter);
      };
      const filtered=logins.filter(e=>(!selectedUserId||e.user_id===selectedUserId)&&matchesLogin(e));
      dl('codewiki-login-history.csv',['로그인 시각(KST)','구분','번호','이름','반','아이디','가입 상태','접속 IP','국가','기기 유형','기기 모델','운영체제(OS)','브라우저','언어','User-Agent'],filtered.map(e=>[formatDateTime(e.logged_in_at),LOGIN_TYPE_LABELS[e.login_type]||e.login_type||'직접 로그인',e.student_number??'',e.full_name,e.class_name||'기본반',e.username,statuses[e.status]||e.status,e.ip_address||'',e.country_code||'',DEVICE_LABELS[e.device_type]||e.device_type||'',e.device_model||'',e.os_name||'',e.browser_name||'',e.language||'',e.user_agent||'']));
      return;
    }
    const filtered=rows.filter(matches).sort(compareRows);
    dl('codewiki-students.csv',['번호','이름','반','아이디','생년월일','MBTI','가입 상태','완료 문서','최근 로그인(KST)','누적 로그인','가입일'],filtered.map(u=>[u.student_number??'',u.full_name,u.class_name||'기본반',u.username,u.birth_date||'',u.mbti||'',statuses[u.status]||u.status,u.completed_docs??0,formatDateTime(u.last_login_at),u.login_count??0,formatDate(u.created_at)]));
  }
  function route(){
    if(session&&isAdminRoute()&&window.CodeWikiAuth?.isAdminPreviewMode?.()){
      window.CodeWikiAuth.setAdminPreviewMode(false,window.location.hash);
      return;
    }
    if(!visible()){if(active)clear();return;}
    host.hidden=false;shell.classList.add('members-hidden');
    const entering=!active;
    if(entering){
      window.CodeWikiBoard?.closeIfActive();
      window.CodeWikiStudy?.leave();
      window.CodeWikiMentoring?.leave();
      window.CodeWikiFoundation?.leave?.();
      window.CodeWikiObjectGame?.leave();
      window.CodeWikiKnowledgeMap?.leave?.();
      document.getElementById('quizModeBtn')?.classList.add('hidden');
      document.getElementById('sbHomeItem')?.classList.add('active');
      document.getElementById('sbScheduleItem')?.classList.remove('active');
      document.getElementById('sbThinkingFlowItem')?.classList.remove('active');
      document.getElementById('sbProgramCatalogItem')?.classList.remove('active');
      document.getElementById('sbBasicSessionItem')?.classList.remove('active');
      document.getElementById('sbSqlGuideItem')?.classList.remove('active');
      document.querySelectorAll('.nav-doc-link.active').forEach(el=>el.classList.remove('active'));
      active=true;
    }
    syncSidebarActive();
    const tab=currentTab();
    if(tab==='logins'){
      // Reuse complete global cache (<100 rows) without an extra RPC; fetch exact
      // per-user history whenever global history was truncated or uncached.
      const canReuseGlobal=loginsLoaded&&!loginsUserId&&logins.length<100;
      const canReuseSameUser=loginsLoaded&&loginsUserId===selectedUserId;
      if((!loginsLoading||loginsUserId!==selectedUserId)&&!canReuseSameUser&&!(selectedUserId&&canReuseGlobal))void loadLogins(selectedUserId);
      else render();
    }else if(tab==='students'||tab==='accounts'){
      if(!rowsLoaded&&!loading)void load();
      else render();
    }else if(tab==='approvals'){
      render();
      void getApprovalCtrl()?.ensureLoaded();
    }else{
      render();
      getInsightsCtrl()?.ensureLoaded(tab);
    }
  }
  function openReset(id){
    const student=rows.find(u=>u.id===id),s=session,v=version;if(!student||!active||resetBusy||usernameBusy||logoutAllBusy)return;
    ensureDialog('studentResetTitle');
    dialog.innerHTML=`<div class="profile-dialog-header"><h2 id="studentResetTitle">비밀번호 재설정</h2><button type="button" class="icon-btn" data-reset-close aria-label="닫기">✕</button></div><p class="members-reset-note">${esc(student.full_name)} · @${esc(student.username)}<br>변경하면 이 학생의 기존 로그인 세션이 종료됩니다. 현재 비밀번호는 조회할 수 없습니다.</p><form><label for="resetAdminPassword">관리자 비밀번호</label><input id="resetAdminPassword" type="password" autocomplete="current-password" required><label for="resetNewPassword">학생의 새 비밀번호</label><input id="resetNewPassword" type="password" autocomplete="new-password" minlength="8" required><label for="resetConfirmPassword">새 비밀번호 확인</label><input id="resetConfirmPassword" type="password" autocomplete="new-password" minlength="8" required><p class="members-reset-note">8자 이상 입력해 주세요.</p><p id="studentResetMessage" role="status"></p><div class="profile-dialog-actions"><button type="button" class="toss-chip-btn" data-reset-close>취소</button><button type="submit" class="toss-primary-btn">비밀번호 변경</button></div></form>`;
    dialog.querySelectorAll('[data-reset-close]').forEach(b=>b.addEventListener('click',()=>{if(!resetBusy)closeReset();}));
    const form=dialog.querySelector('form'),admin=form.querySelector('#resetAdminPassword'),password=form.querySelector('#resetNewPassword'),confirm=form.querySelector('#resetConfirmPassword'),message=form.querySelector('#studentResetMessage');
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(resetBusy||!current(s,v)||!dialog.open||!form.isConnected)return;
      if(password.value!==confirm.value){message.textContent='새 비밀번호가 서로 다릅니다.';return;}
      if(Array.from(password.value).length<8||new TextEncoder().encode(password.value).length>72){message.textContent='새 비밀번호는 8자 이상, UTF-8 72바이트 이하로 입력해 주세요.';return;}
      resetBusy=true;form.querySelectorAll('input,button').forEach(el=>el.disabled=true);message.textContent='변경 중…';
      try{
        const args={p_target_id:student.id,p_admin_password:admin.value,p_new_password:password.value};
        admin.value='';password.value='';confirm.value='';
        const result=await call('cw_admin_reset_student_password',args,s);
        if(!current(s,v)||!dialog.open||!form.isConnected)return;
        if(result?.ok!==true||result.user_id!==student.id)throw Error();
        closeReset();rowsMessage=`${student.full_name}님의 비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인할 수 있습니다.`;
        const msgEl=host.querySelector('#membersMessage');if(msgEl)msgEl.textContent=rowsMessage;
      }catch(error){if(current(s,v)&&dialog.open&&form.isConnected){
        const messages={CW_ADMIN_REQUIRED:'관리자 로그인이 만료되었습니다. 다시 로그인해 주세요.',CW_ADMIN_PASSWORD:'관리자 비밀번호를 확인해 주세요.',CW_PASSWORD_POLICY:'새 비밀번호가 너무 단순하거나 길이 제한을 벗어납니다.',CW_RATE_LIMIT:'시도 횟수를 초과했습니다. 5분 후 다시 시도해 주세요.',CW_STUDENT_NOT_FOUND:'학생 계정을 찾을 수 없습니다.',CW_ENVELOPE_INVALID:'보안 요청이 만료되었거나 유효하지 않습니다. 다시 시도해 주세요.',CW_REPLAY:'이미 처리된 요청입니다. 결과를 확인한 뒤 다시 시도해 주세요.',CW_AUTH_UNAVAILABLE:'보안 로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',PGRST202:'비밀번호 재설정 기능이 아직 서버에 적용되지 않았습니다.'};
        message.textContent=messages[error?.code]||'변경 결과를 확인하지 못했습니다. 새 비밀번호로 로그인되는지 확인해 주세요.';
      }}finally{if(current(s,v)&&form.isConnected){resetBusy=false;form.querySelectorAll('input,button').forEach(el=>el.disabled=false);}}
    });
    dialog.showModal();admin.focus();
  }
  function openUsernameEdit(id){
    const student=rows.find(u=>u.id===id),s=session,v=version;if(!student||!active||resetBusy||usernameBusy||logoutAllBusy)return;
    ensureDialog('studentUsernameTitle');
    dialog.innerHTML=`<div class="profile-dialog-header"><h2 id="studentUsernameTitle">아이디 변경</h2><button type="button" class="icon-btn" data-username-close aria-label="닫기">✕</button></div><p class="members-reset-note">${esc(student.full_name)} · 현재 아이디: <strong>${esc(student.username)}</strong><br>변경 즉시 새 아이디로 로그인할 수 있으며, 기존 비밀번호와 학습 기록은 그대로 유지됩니다.</p><form><label for="editNewUsername">새 아이디</label><input id="editNewUsername" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" minlength="2" maxlength="100" value="${esc(student.username)}" required><p class="members-reset-note">2~100자, 공백 없이 입력해 주세요. 영문은 소문자로 저장됩니다.</p><p id="studentUsernameMessage" role="status"></p><div class="profile-dialog-actions"><button type="button" class="toss-chip-btn" data-username-close>취소</button><button type="submit" class="toss-primary-btn">아이디 변경</button></div></form>`;
    dialog.querySelectorAll('[data-username-close]').forEach(b=>b.addEventListener('click',()=>{if(!usernameBusy)closeReset();}));
    const form=dialog.querySelector('form'),input=form.querySelector('#editNewUsername'),message=form.querySelector('#studentUsernameMessage');
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(usernameBusy||!current(s,v)||!dialog.open||!form.isConnected)return;
      const nextUsername=input.value.trim().toLowerCase();
      const charCount=Array.from(nextUsername).length,byteCount=new TextEncoder().encode(nextUsername).length;
      if(charCount<2||charCount>100||byteCount>300){message.textContent='아이디는 2~100자(UTF-8 300바이트 이하)로 입력해 주세요.';return;}
      if(/[\s\u0000-\u001f\u007f\u00a0\u3000]/.test(nextUsername)){message.textContent='아이디에는 공백이나 제어 문자를 포함할 수 없습니다.';return;}
      if(nextUsername===student.username){message.textContent='현재 아이디와 같습니다. 다른 아이디를 입력해 주세요.';return;}
      usernameBusy=true;form.querySelectorAll('input,button').forEach(el=>el.disabled=true);message.textContent='변경 중…';
      try{
        const result=await call('cw_admin_update_student_username',{p_target_id:student.id,p_new_username:nextUsername},s);
        if(!current(s,v)||!dialog.open||!form.isConnected)return;
        if(result?.ok!==true||result.user_id!==student.id||typeof result.username!=='string')throw Error();
        student.username=result.username;
        for(const entry of logins)if(entry.user_id===student.id)entry.username=result.username;
        closeReset();
        rowsMessage=`${student.full_name}님의 아이디를 ${result.username}(으)로 변경했습니다.`;
        renderRows();
        const msgEl=host.querySelector('#membersMessage');if(msgEl)msgEl.textContent=rowsMessage;
      }catch(error){if(current(s,v)&&dialog.open&&form.isConnected){
        const messages={
          '42501':'관리자 로그인이 만료되었습니다. 다시 로그인해 주세요.',
          CW_ADMIN_REQUIRED:'관리자 로그인이 만료되었습니다. 다시 로그인해 주세요.',
          CW_STUDENT_NOT_FOUND:'학생 계정을 찾을 수 없습니다.',
          CW_INVALID_USERNAME:'아이디는 공백 없이 2~100자(UTF-8 300바이트 이하)로 입력해 주세요.',
          CW_USERNAME_UNCHANGED:'현재 아이디와 같습니다. 다른 아이디를 입력해 주세요.',
          CW_USERNAME_TAKEN:'이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.',
          CW_RATE_LIMIT:'요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.',
          PGRST202:'아이디 변경 기능이 아직 서버에 적용되지 않았습니다.'
        };
        message.textContent=messages[error?.code]||'아이디를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      }}finally{if(current(s,v)&&form.isConnected){usernameBusy=false;form.querySelectorAll('input,button').forEach(el=>el.disabled=false);}}
    });
    dialog.showModal();input.focus();input.select?.();
  }
  function openLogoutAllConfirm(){
    const s=session,v=version;if(!active||!s||resetBusy||usernameBusy||logoutAllBusy)return;
    ensureDialog('logoutAllTitle');
    dialog.innerHTML=`<div class="profile-dialog-header"><h2 id="logoutAllTitle">전원 로그아웃</h2><button type="button" class="icon-btn" data-logout-close aria-label="닫기">✕</button></div><p class="members-reset-note">현재 로그인 중인 <strong>모든 학생 계정</strong>의 세션을 종료합니다.<br>접속 중인 학생에게는 <strong>"관리자에 의해 로그아웃되었습니다."</strong> 팝업이 표시되고 바로 로그인 화면으로 이동합니다. 관리자 세션은 유지됩니다.</p><p id="logoutAllMessage" role="status"></p><div class="profile-dialog-actions"><button type="button" class="toss-chip-btn" data-logout-close>취소</button><button type="button" id="confirmLogoutAllBtn" class="toss-chip-btn members-danger-btn">전원 로그아웃 실행</button></div>`;
    dialog.querySelectorAll('[data-logout-close]').forEach(b=>b.addEventListener('click',()=>{if(!logoutAllBusy)closeReset();}));
    const confirmBtn=dialog.querySelector('#confirmLogoutAllBtn');
    const message=dialog.querySelector('#logoutAllMessage');
    confirmBtn?.addEventListener('click',async()=>{
      if(logoutAllBusy||!current(s,v)||!dialog.open)return;
      logoutAllBusy=true;
      dialog.querySelectorAll('button').forEach(el=>el.disabled=true);
      if(message)message.textContent='로그아웃 처리 중…';
      try{
        const result=await call('cw_admin_logout_all',{},s);
        if(!current(s,v)||!dialog.open)return;
        if(result?.ok!==true)throw Error();
        const count=Number(result.logged_out_count)||0;
        void window.CodeWikiPresence?.notifySessionCheck?.();
        closeReset();
        const noticeText=count>0
          ? `현재 접속 중이던 학생 ${count}명을 모두 로그아웃했습니다.`
          : '종료할 활성 학생 세션이 없었습니다. 모든 학생 세션이 초기화된 상태입니다.';
        if(currentTab()==='logins')loginsMessage=noticeText;else rowsMessage=noticeText;
        const msgEl=host.querySelector('#membersMessage');if(msgEl)msgEl.textContent=noticeText;
        window.CodeWikiPresence?.refresh?.(true);
      }catch(error){
        if(current(s,v)&&dialog.open){
          const messages={
            '42501':'관리자 로그인이 만료되었습니다. 다시 로그인해 주세요.',
            CW_ADMIN_REQUIRED:'관리자 로그인이 만료되었습니다. 다시 로그인해 주세요.',
            CW_RATE_LIMIT:'요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.',
            PGRST202:'전원 로그아웃 기능이 아직 서버에 적용되지 않았습니다.'
          };
          if(message)message.textContent=messages[error?.code]||'전원 로그아웃 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.';
        }
      }finally{
        if(current(s,v)){
          logoutAllBusy=false;
          const lb=host.querySelector('[data-logout-all]');if(lb)lb.disabled=false;
          if(dialog?.open)dialog.querySelectorAll('button').forEach(el=>el.disabled=false);
        }
      }
    });
    dialog.showModal();
    (dialog.querySelector('.profile-dialog-actions [data-logout-close]')||confirmBtn)?.focus?.();
  }
  host.addEventListener('click',e=>{
    const previewStu=e.target.closest('[data-preview-student]');if(previewStu){const stu=rows.find(u=>u.id===previewStu.dataset.previewStudent);if(stu)window.CodeWikiAuth?.setAdminPreviewMode?.(true,stu);return;}
    if(e.target.closest('[data-export-csv]')){exportCurrentCsv();return;}
    if(e.target.closest('[data-logout-all]')){openLogoutAllConfirm();return;}
    const tab=e.target.closest('[data-members-tab]');if(tab){switchTab(tab.dataset.membersTab);return;}
    const viewLogins=e.target.closest('[data-view-logins]');if(viewLogins){switchTab('logins',viewLogins.dataset.viewLogins,viewLogins.dataset.viewLoginsId);return;}
    const sort=e.target.closest('[data-members-sort]');if(sort){sortBy(sort.dataset.membersSort);return;}
    const toolBtn=e.target.closest('[data-toggle-tool]');if(toolBtn){void toggleStudentTool(toolBtn.dataset.toolUid,toolBtn.dataset.toggleTool);return;}
    const editUsername=e.target.closest('[data-edit-username]');if(editUsername){openUsernameEdit(editUsername.dataset.editUsername);return;}
    const dmBtn=e.target.closest('[data-send-dm]');if(dmBtn){const stu=rows.find(u=>u.id===dmBtn.dataset.sendDm);if(stu)getInsightsCtrl()?.openDirectMessageDialog(stu);return;}
    const singleLogout=e.target.closest('[data-logout-student]');if(singleLogout){const stu=rows.find(u=>u.id===singleLogout.dataset.logoutStudent);if(stu)getInsightsCtrl()?.openSingleLogoutDialog(stu);return;}
    const b=e.target.closest('[data-reset-student]');if(b){openReset(b.dataset.resetStudent);return;}
    if(currentTab()==='approvals'){getApprovalCtrl()?.handleClick(e);return;}
    void getInsightsCtrl()?.handleClick(e);
  });
  host.addEventListener('input',e=>{
    if(e.target.id==='adminApprovalSearch'&&currentTab()==='approvals'){
      getApprovalCtrl()?.handleInput(e);
      return;
    }
    if((e.target.id==='adminDmRecipientSearch'&&currentTab()==='notices')||(e.target.id==='adminSecEventSearch'&&currentTab()==='security')){
      getInsightsCtrl()?.handleInput?.(e);
      return;
    }
    if(e.target.id==='membersSearch'){
      query=e.target.value;
      if(selectedUserId){
        selectedUserId='';
        if(currentTab()==='logins'&&loginsUserId){void loadLogins('');return;}
      }
      renderRows();
    }
  });
  host.addEventListener('change',e=>{
    if(e.target.id==='membersClass'){classFilter=e.target.value;renderRows();return;}
    if(e.target.id==='membersStatus'){statusFilter=e.target.value;renderRows();return;}
    void getInsightsCtrl()?.handleChange(e);
  });
  host.addEventListener('submit',e=>{void getInsightsCtrl()?.handleSubmit(e);});
  window.addEventListener('hashchange',route);
  function invalidate(options={}){
    version++;loginsVersion++;
    rowsLoaded=false;loading=false;loginsLoaded=false;loginsLoading=false;
    insightsCtrl?.invalidate?.();
    if(!options?.skipApprovals)approvalCtrl?.invalidate?.();
    if(active&&session){
      const tab=currentTab();
      if(tab==='logins')void loadLogins(selectedUserId,true);
      else if(tab==='students'||tab==='accounts')void load(true);
      else if(tab==='approvals'){if(!options?.skipApprovals)void getApprovalCtrl()?.ensureLoaded(true);}
      else getInsightsCtrl()?.ensureLoaded(tab);
    }
  }
  window.CodeWikiAdminMembers={
    setUser,openHome,openRoute,invalidate,
    setPresence(value){online=value;if(value===null||value===false)livePresence=null;if(active)renderPresence();},
    setLivePresence(value){livePresence=value;if(active)renderPresence();},
    leave(){if(active){if(isAdminRoute())history.replaceState(null,'','#doc/'+(window.CodeWikiApp?.getCurrentDocId()||'welcome-abap'));clear();}}
  };
})();
