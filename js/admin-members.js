/* Administrator-only directory and student login history. Credentials exist only in the reset form/request. */
(() => {
  const host=document.getElementById('adminMembersPage'),shell=document.getElementById('appShell');
  const esc=window.CodeWikiLearning.escape;
  const statuses={approved:'승인 완료',pending:'승인 대기',rejected:'반려'};
  const columns=[['student_number','번호'],['full_name','이름'],['class_name','반'],['username','아이디'],['birth_date','생년월일'],['mbti','MBTI'],['status','가입 상태'],['last_login_at','최근 로그인'],['created_at','가입일']];
  const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
  let sortKey='full_name',sortDirection=1;
  let session=null,active=false,rows=[],rowsLoaded=false,version=0,loading=false,rowsMessage='';
  let logins=[],loginsLoaded=false,loginsVersion=0,loginsLoading=false,loginsMessage='';
  let query='',classFilter='',statusFilter='',dialog=null,resetBusy=false;
  let online=null;
  const isAdminRoute=()=>window.location.hash==='#admin/students'||window.location.hash==='#admin/logins';
  const currentTab=()=>window.location.hash==='#admin/logins'?'logins':'students';
  const visible=()=>Boolean(session)&&isAdminRoute();
  const current=(s,v)=>session===s&&version===v&&active;
  const currentLogins=(s,v)=>session===s&&loginsVersion===v&&active;
  function syncSidebarActive(){
    const tab=currentTab();
    document.getElementById('openStudentDirectoryBtn')?.classList[active&&tab==='students'?'add':'remove']('active');
    document.getElementById('openLoginHistoryBtn')?.classList[active&&tab==='logins'?'add':'remove']('active');
  }
  function closeReset(){if(dialog){dialog.close();dialog.innerHTML='';}resetBusy=false;}
  function clear(){
    version++;loginsVersion++;
    rows=[];rowsLoaded=false;loading=false;rowsMessage='';
    logins=[];loginsLoaded=false;loginsLoading=false;loginsMessage='';
    closeReset();host.innerHTML='';host.hidden=true;active=false;
    shell.classList.remove('members-hidden');
    syncSidebarActive();
  }
  function setUser(user){
    const token=window.CodeWikiAuth?.getSessionToken()||'';
    if(user?.role==='admin'&&session?.id===user.id&&session.token===token)return;
    clear();online=null;session=user?.role==='admin'&&token?{id:user.id,token}:null;query='';classFilter='';statusFilter='';
    sortKey='full_name';sortDirection=1;
    const h=window.location.hash;
    if(session&&(!h||h==='#admin/students'||h==='#doc/welcome-abap'||h==='#doc/welcome-ui5'))openHome();else route();
  }
  function openHome(){if(!session)return false;history.replaceState(null,'','#admin/students');route();window.CodeWikiPresence?.refresh();return true;}
  function renderPresence(){
    const panel=host.querySelector('#membersPresence');if(!panel)return;
    panel.innerHTML=online===false?'<strong>접속 상태를 확인하지 못했습니다.</strong><span>잠시 후 자동으로 다시 확인합니다.</span>':online===null?'<strong>접속 상태를 확인하고 있습니다.</strong><span>최근 2분 기준 · 1분마다 갱신</span>':`<strong>현재 접속 ${online.length}명</strong><span>최근 2분 기준 · 관리자 포함</span><div class="members-online-names">${online.map(u=>`<span>${esc(u.full_name)}${u.role==='admin'?' (관리자)':` · ${esc(u.class_name||'')}`}</span>`).join('')||'<span>접속 중인 회원이 없습니다.</span>'}</div>`;
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
    const tab=currentTab();
    const busy=tab==='logins'?loginsLoading:loading;
    const source=tab==='logins'?logins:rows;
    const classes=[...new Set(source.map(u=>u.class_name||'기본반'))].sort((a,b)=>a.localeCompare(b,'ko',{numeric:true}));
    if(classFilter&&!classes.includes(classFilter))classes.push(classFilter);
    const title=tab==='logins'?'학생 로그인 내역':'학생 정보';
    const desc=tab==='logins'?'학생들의 최근 로그인 기록을 시간순으로 확인합니다.':'가입한 학생의 계정과 프로필을 관리합니다.';
    const statusText=tab==='logins'?(loginsLoading?'로그인 내역을 불러오는 중…':loginsMessage):(loading?'학생 정보를 불러오는 중…':rowsMessage);
    host.innerHTML=`<header class="members-heading"><div><h1>${title}</h1><p>${desc}</p></div><button type="button" class="toss-chip-btn" data-members-refresh ${busy?'disabled':''}>새로고침</button></header><section id="membersPresence" class="members-presence" aria-label="현재 접속자"></section>
      <div class="members-tabs" role="tablist" aria-label="학생 관리 보기"><button type="button" class="members-tab" role="tab" aria-selected="${tab==='students'}" data-members-tab="students">학생 목록</button><button type="button" class="members-tab" role="tab" aria-selected="${tab==='logins'}" data-members-tab="logins">로그인 내역</button></div>
      <div class="members-filters"><label>검색<input id="membersSearch" type="search" placeholder="이름 또는 아이디" value="${esc(query)}"></label><label>반<select id="membersClass"><option value="">전체 반</option>${classes.map(c=>`<option value="${esc(c)}" ${classFilter===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>상태<select id="membersStatus"><option value="">전체 상태</option>${Object.entries(statuses).map(([id,name])=>`<option value="${id}" ${statusFilter===id?'selected':''}>${name}</option>`).join('')}</select></label><span class="members-count" id="membersCount"></span></div>
      <p id="membersMessage" role="status">${esc(statusText)}</p><div class="members-table-wrap" id="membersTable"></div>`;
    const msg=host.querySelector('#membersMessage');if(msg)msg.textContent=statusText;
    renderPresence();renderRows();
  }
  function renderRows(){
    const q=query.trim().toLocaleLowerCase();
    const matches=u=>(!q||`${u.full_name||''} ${u.username||''}`.toLocaleLowerCase().includes(q))&&(!classFilter||(u.class_name||'기본반')===classFilter)&&(!statusFilter||u.status===statusFilter);
    if(currentTab()==='logins'){
      const filtered=logins.filter(matches);
      host.querySelector('#membersCount').textContent=`${filtered.length}건 / 전체 ${logins.length}건`;
      host.querySelector('#membersTable').innerHTML=filtered.length
        ? `<table class="members-table"><caption>최근 학생 로그인 내역 · 최대 100건 (한국 시간 기준)</caption><thead><tr><th scope="col">로그인 시각</th><th scope="col">번호</th><th scope="col">이름</th><th scope="col">반</th><th scope="col">아이디</th><th scope="col">가입 상태</th></tr></thead><tbody>${filtered.map(e=>`<tr><td class="members-time-cell">${esc(formatDateTime(e.logged_in_at))}</td><td>${esc(e.student_number??'—')}</td><td>${esc(e.full_name)}</td><td>${esc(e.class_name||'기본반')}</td><td>${esc(e.username)}</td><td>${esc(statuses[e.status]||e.status)}</td></tr>`).join('')}</tbody></table>`
        : loginsLoading||loginsMessage?'':`<p class="members-reset-note">${logins.length?'조건에 맞는 로그인 내역이 없습니다.':'기록된 학생 로그인 내역이 없습니다. 로그인 기록 적용 이후의 로그인이 여기에 표시됩니다.'}</p>`;
      return;
    }
    const filtered=rows.filter(matches).sort(compareRows);
    host.querySelector('#membersCount').textContent=`${filtered.length}명 / 전체 ${rows.length}명`;
    host.querySelector('#membersTable').innerHTML=filtered.length?`<table class="members-table"><caption>학생 계정 목록 · 생년월일은 관리자 전용</caption><thead><tr>${columns.map(([key,label])=>`<th scope="col" aria-sort="${sortKey===key?(sortDirection===1?'ascending':'descending'):'none'}"><button type="button" class="members-sort" data-members-sort="${key}" aria-label="${label} ${sortKey===key&&sortDirection===1?'내림차순':'오름차순'} 정렬">${label}<span aria-hidden="true">${sortKey===key?(sortDirection===1?'↑':'↓'):'↕'}</span></button></th>`).join('')}<th scope="col">비밀번호</th></tr></thead><tbody>${filtered.map(u=>`<tr><td>${esc(u.student_number??'—')}</td><td>${esc(u.full_name)}</td><td>${esc(u.class_name||'기본반')}</td><td>${esc(u.username)}</td><td>${esc(u.birth_date||'미등록')}</td><td>${esc(u.mbti||'—')}</td><td>${esc(statuses[u.status]||u.status)}</td><td>${u.last_login_at?`<button type="button" class="members-login-link" data-view-logins="${esc(u.username)}" title="로그인 내역 보기">${esc(formatDateTime(u.last_login_at))}${Number(u.login_count)>0?` <small>(${esc(u.login_count)}회)</small>`:''}</button>`:'—'}</td><td>${esc(formatDate(u.created_at))}</td><td><button type="button" class="toss-chip-btn" data-reset-student="${esc(u.id)}">재설정</button></td></tr>`).join('')}</tbody></table>`:loading?'':'<p class="members-reset-note">표시할 학생이 없습니다.</p>';
  }
  function sortValue(row){
    const value=sortKey==='status'?statuses[row.status]:row[sortKey];
    if(value==null||value==='')return null;
    if(sortKey==='student_number'||sortKey==='birth_date'||sortKey==='last_login_at'||sortKey==='created_at'){
      const number=sortKey==='student_number'?Number(value):new Date(value).getTime();
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
    if(!active||!session||currentTab()!=='students'||!columns.some(([id])=>id===key))return;
    sortDirection=sortKey===key?-sortDirection:1;sortKey=key;
    renderRows();
    host.querySelector(`[data-members-sort="${key}"]`)?.focus({preventScroll:true});
  }
  function formatDate(value){const d=new Date(value);return value&&!Number.isNaN(d.getTime())?d.toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}):'—';}
  function formatDateTime(value){const d=new Date(value);return value&&!Number.isNaN(d.getTime())?d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';}
  async function load(){
    if(!active||!session||loading)return;
    const s=session,v=++version;loading=true;rows=[];rowsLoaded=false;rowsMessage='';closeReset();render();
    try{const result=await call('cw_admin_student_directory',{},s);if(!current(s,v))return;if(!Array.isArray(result))throw Error();rows=result;rowsLoaded=true;loading=false;render();}
    catch(error){if(current(s,v)){loading=false;rowsMessage=error?.code==='PGRST202'?'학생 정보 기능이 아직 서버에 적용되지 않았습니다.':'학생 정보를 불러오지 못했습니다. 새로고침해 주세요.';render();}}
  }
  async function loadLogins(){
    if(!active||!session||loginsLoading)return;
    const s=session,v=++loginsVersion;loginsLoading=true;logins=[];loginsLoaded=false;loginsMessage='';render();
    try{const result=await call('cw_admin_login_history',{p_limit:100},s);if(!currentLogins(s,v))return;if(!Array.isArray(result))throw Error();logins=result;loginsLoaded=true;loginsLoading=false;render();}
    catch(error){if(currentLogins(s,v)){loginsLoading=false;loginsMessage=error?.code==='PGRST202'?'로그인 내역 기능이 아직 서버에 적용되지 않았습니다.':'로그인 내역을 불러오지 못했습니다. 새로고침해 주세요.';render();}}
  }
  function switchTab(tab,presetQuery){
    if(!active||!session)return;
    if(presetQuery!==undefined){query=presetQuery;classFilter='';statusFilter='';}
    const target=tab==='logins'?'#admin/logins':'#admin/students';
    if(window.location.hash!==target)history.replaceState(null,'',target);
    route();
  }
  function route(){
    if(!visible()){if(active)clear();return;}
    host.hidden=false;shell.classList.add('members-hidden');
    const entering=!active;
    if(entering){
      window.CodeWikiBoard?.closeIfActive();
      window.CodeWikiStudy?.leave();
      window.CodeWikiMentoring?.leave();
      window.CodeWikiObjectGame?.leave();
      window.CodeWikiKnowledgeMap?.leave?.();
      document.getElementById('sbHomeItem')?.classList.add('active');
      document.getElementById('sbScheduleItem')?.classList.remove('active');
      document.querySelectorAll('.nav-doc-link.active').forEach(el=>el.classList.remove('active'));
      active=true;
    }
    syncSidebarActive();
    if(currentTab()==='logins'){
      if(!loginsLoaded&&!loginsLoading)void loadLogins();
      else render();
    }else{
      if(!rowsLoaded&&!loading)void load();
      else render();
    }
  }
  function openReset(id){
    const student=rows.find(u=>u.id===id),s=session,v=version;if(!student||!active||resetBusy)return;
    if(!dialog){dialog=document.createElement('dialog');dialog.className='profile-dialog';dialog.setAttribute('aria-labelledby','studentResetTitle');document.body.append(dialog);
      dialog.addEventListener('cancel',e=>{if(resetBusy)e.preventDefault();});dialog.addEventListener('close',()=>{dialog.innerHTML='';});}
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
        const messages={CW_ADMIN_REQUIRED:'관리자 로그인이 만료되었습니다. 다시 로그인해 주세요.',CW_ADMIN_PASSWORD:'관리자 비밀번호를 확인해 주세요.',CW_PASSWORD_POLICY:'새 비밀번호가 너무 단순하거나 길이 제한을 벗어납니다.',CW_RATE_LIMIT:'시도 횟수를 초과했습니다. 5분 후 다시 시도해 주세요.',CW_STUDENT_NOT_FOUND:'학생 계정을 찾을 수 없습니다.',PGRST202:'비밀번호 재설정 기능이 아직 서버에 적용되지 않았습니다.'};
        message.textContent=messages[error?.code]||'변경 결과를 확인하지 못했습니다. 새 비밀번호로 로그인되는지 확인해 주세요.';
      }}finally{if(current(s,v)&&form.isConnected){resetBusy=false;form.querySelectorAll('input,button').forEach(el=>el.disabled=false);}}
    });
    dialog.showModal();admin.focus();
  }
  host.addEventListener('click',e=>{
    if(e.target.closest('[data-members-refresh]')){if(currentTab()==='logins')void loadLogins();else void load();return;}
    const tab=e.target.closest('[data-members-tab]');if(tab){switchTab(tab.dataset.membersTab);return;}
    const viewLogins=e.target.closest('[data-view-logins]');if(viewLogins){switchTab('logins',viewLogins.dataset.viewLogins);return;}
    const sort=e.target.closest('[data-members-sort]');if(sort){sortBy(sort.dataset.membersSort);return;}
    const b=e.target.closest('[data-reset-student]');if(b)openReset(b.dataset.resetStudent);
  });
  host.addEventListener('input',e=>{if(e.target.id==='membersSearch'){query=e.target.value;renderRows();}});
  host.addEventListener('change',e=>{if(e.target.id==='membersClass')classFilter=e.target.value;else if(e.target.id==='membersStatus')statusFilter=e.target.value;else return;renderRows();});
  window.addEventListener('hashchange',route);
  window.CodeWikiAdminMembers={setUser,openHome,setPresence(value){online=value;if(active)renderPresence();},leave(){if(active){if(isAdminRoute())history.replaceState(null,'','#doc/'+(window.CodeWikiApp?.getCurrentDocId()||'welcome-abap'));clear();}}};
})();
