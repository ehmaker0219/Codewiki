/* Administrator-only directory. Credentials exist only in the reset form/request. */
(() => {
  const host=document.getElementById('adminMembersPage'),shell=document.getElementById('appShell');
  const esc=window.CodeWikiLearning.escape;
  const statuses={approved:'승인 완료',pending:'승인 대기',rejected:'반려'};
  let session=null,active=false,rows=[],version=0,loading=false,query='',classFilter='',statusFilter='',dialog=null,resetBusy=false;
  const visible=()=>Boolean(session)&&window.location.hash==='#admin/students';
  const current=(s,v)=>session===s&&version===v&&active;
  function closeReset(){if(dialog){dialog.close();dialog.innerHTML='';}resetBusy=false;}
  function clear(){version++;rows=[];loading=false;closeReset();host.innerHTML='';host.hidden=true;active=false;shell.classList.remove('members-hidden');document.getElementById('openStudentDirectoryBtn')?.classList.remove('active');}
  function setUser(user){
    const token=window.CodeWikiAuth?.getSessionToken()||'';
    if(user?.role==='admin'&&session?.id===user.id&&session.token===token)return;
    clear();session=user?.role==='admin'&&token?{id:user.id,token}:null;query='';classFilter='';statusFilter='';route();
  }
  async function call(name,args,s){
    const controller=new AbortController();let timer;
    try{
      const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reject({code:'TIMEOUT'});controller.abort();},15000);});
      const request=window.CodeWikiAuth.getSupabaseClient().rpc(name,{p_token:s.token,...args});
      const result=await Promise.race([typeof request?.abortSignal==='function'?request.abortSignal(controller.signal):request,timeout]);
      if(result.error)throw result.error;if(result.data?.code)throw result.data;return result.data;
    }finally{clearTimeout(timer);}
  }
  function render(){
    host.innerHTML=`<header class="members-heading"><div><h1>학생 정보</h1><p>가입한 학생의 계정과 프로필을 관리합니다.</p></div><button type="button" class="toss-chip-btn" data-members-refresh ${loading?'disabled':''}>새로고침</button></header>
      <div class="members-filters"><label>검색<input id="membersSearch" type="search" placeholder="이름 또는 아이디" value="${esc(query)}"></label><label>반<select id="membersClass"><option value="">전체 반</option>${[...new Set(rows.map(u=>u.class_name||'기본반'))].sort((a,b)=>a.localeCompare(b,'ko',{numeric:true})).map(c=>`<option value="${esc(c)}" ${classFilter===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>상태<select id="membersStatus"><option value="">전체 상태</option>${Object.entries(statuses).map(([id,name])=>`<option value="${id}" ${statusFilter===id?'selected':''}>${name}</option>`).join('')}</select></label><span class="members-count" id="membersCount"></span></div>
      <p id="membersMessage" role="status">${loading?'학생 정보를 불러오는 중…':''}</p><div class="members-table-wrap" id="membersTable"></div>`;
    renderRows();
  }
  function renderRows(){
    const q=query.trim().toLocaleLowerCase();
    const filtered=rows.filter(u=>(!q||`${u.full_name} ${u.username}`.toLocaleLowerCase().includes(q))&&(!classFilter||(u.class_name||'기본반')===classFilter)&&(!statusFilter||u.status===statusFilter)).sort((a,b)=>a.full_name.localeCompare(b.full_name,'ko')||a.username.localeCompare(b.username));
    host.querySelector('#membersCount').textContent=`${filtered.length}명 / 전체 ${rows.length}명`;
    host.querySelector('#membersTable').innerHTML=filtered.length?`<table class="members-table"><caption>학생 계정 목록 · 생년월일은 관리자 전용</caption><thead><tr>${['이름','반','번호','아이디','생년월일','MBTI','가입 상태','가입일','비밀번호'].map(t=>`<th scope="col">${t}</th>`).join('')}</tr></thead><tbody>${filtered.map(u=>`<tr><td>${esc(u.full_name)}</td><td>${esc(u.class_name||'기본반')}</td><td>${esc(u.student_number??'—')}</td><td>${esc(u.username)}</td><td>${esc(u.birth_date||'미등록')}</td><td>${esc(u.mbti||'—')}</td><td>${esc(statuses[u.status]||u.status)}</td><td>${esc(formatDate(u.created_at))}</td><td><button type="button" class="toss-chip-btn" data-reset-student="${esc(u.id)}">재설정</button></td></tr>`).join('')}</tbody></table>`:loading?'':'<p class="members-reset-note">표시할 학생이 없습니다.</p>';
  }
  function formatDate(value){const d=new Date(value);return value&&!Number.isNaN(d.getTime())?d.toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}):'—';}
  async function load(){
    if(!active||!session||loading)return;
    const s=session,v=++version;loading=true;rows=[];closeReset();render();
    try{const result=await call('cw_admin_student_directory',{},s);if(!current(s,v))return;if(!Array.isArray(result))throw Error();rows=result;loading=false;render();}
    catch(error){if(current(s,v)){loading=false;render();host.querySelector('#membersMessage').textContent=error?.code==='PGRST202'?'학생 정보 기능이 아직 서버에 적용되지 않았습니다.':'학생 정보를 불러오지 못했습니다. 새로고침해 주세요.';}}
  }
  function route(){
    if(!visible()){if(active)clear();return;}
    host.hidden=false;shell.classList.add('members-hidden');
    document.getElementById('openStudentDirectoryBtn')?.classList.add('active');
    if(active)return;
    window.CodeWikiBoard?.closeIfActive();
    ['sbHomeItem','sbScheduleItem'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
    document.querySelectorAll('.nav-doc-link.active').forEach(el=>el.classList.remove('active'));
    active=true;void load();
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
        closeReset();host.querySelector('#membersMessage').textContent=`${student.full_name}님의 비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인할 수 있습니다.`;
      }catch(error){if(current(s,v)&&dialog.open&&form.isConnected){
        const messages={CW_ADMIN_REQUIRED:'관리자 로그인이 만료되었습니다. 다시 로그인해 주세요.',CW_ADMIN_PASSWORD:'관리자 비밀번호를 확인해 주세요.',CW_PASSWORD_POLICY:'새 비밀번호가 너무 단순하거나 길이 제한을 벗어납니다.',CW_RATE_LIMIT:'시도 횟수를 초과했습니다. 5분 후 다시 시도해 주세요.',CW_STUDENT_NOT_FOUND:'학생 계정을 찾을 수 없습니다.',PGRST202:'비밀번호 재설정 기능이 아직 서버에 적용되지 않았습니다.'};
        message.textContent=messages[error?.code]||'변경 결과를 확인하지 못했습니다. 새 비밀번호로 로그인되는지 확인해 주세요.';
      }}finally{if(current(s,v)&&form.isConnected){resetBusy=false;form.querySelectorAll('input,button').forEach(el=>el.disabled=false);}}
    });
    dialog.showModal();admin.focus();
  }
  host.addEventListener('click',e=>{if(e.target.closest('[data-members-refresh]'))void load();const b=e.target.closest('[data-reset-student]');if(b)openReset(b.dataset.resetStudent);});
  host.addEventListener('input',e=>{if(e.target.id==='membersSearch'){query=e.target.value;renderRows();}});
  host.addEventListener('change',e=>{if(e.target.id==='membersClass')classFilter=e.target.value;else if(e.target.id==='membersStatus')statusFilter=e.target.value;else return;renderRows();});
  window.addEventListener('hashchange',route);
  window.CodeWikiAdminMembers={setUser,leave(){if(active){if(window.location.hash==='#admin/students')history.replaceState(null,'','#doc/'+(window.CodeWikiApp?.getCurrentDocId()||'welcome-abap'));clear();}}};
})();
