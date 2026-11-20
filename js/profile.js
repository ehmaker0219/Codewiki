(() => {
  let session=null,dialog;
  function setUser(user) {
    const token=window.CodeWikiAuth?.getSessionToken()||'';
    const approved=user&&(user.status==='approved'||user.role==='admin');
    if(approved&&session?.id===user.id&&session.token===token)return;
    session=approved&&token?{id:user.id,token}:null;
    dialog?.close();if(dialog)dialog.innerHTML='';
  }
  async function openSettings() {
    const s=session;if(!s)return;
    if(!dialog){dialog=document.createElement('dialog');dialog.className='profile-dialog';dialog.setAttribute('aria-labelledby','profileTitle');document.body.append(dialog);}
    dialog.innerHTML=`<div class="profile-dialog-header"><h2 id="profileTitle">프로필 설정</h2><button type="button" class="icon-btn" data-close-profile aria-label="프로필 설정 닫기">✕</button></div>
      <form id="profileForm">
        <dl class="profile-account"><dt>아이디</dt><dd id="profileUsername">—</dd><dt>소속 반</dt><dd id="profileClass">—</dd><dt>출석번호</dt><dd id="profileStudentNumber">—</dd><dt>권한</dt><dd id="profileRole">—</dd></dl>
        <label for="profileName">이름</label><input id="profileName" type="text" autocomplete="name" required maxlength="50" disabled>
        <label for="profileMbti">MBTI</label><select id="profileMbti" disabled><option value="">선택 안 함</option>${['ISTJ','ISFJ','INFJ','INTJ','ISTP','ISFP','INFP','INTP','ESTP','ESFP','ENFP','ENTP','ESTJ','ESFJ','ENFJ','ENTJ'].map(m=>`<option>${m}</option>`).join('')}</select>
        <div class="profile-section-title">생일</div><label for="profileBirthDate">생년월일 (선택)</label><input id="profileBirthDate" type="date" min="1900-01-01" max="${window.CodeWikiBirthdays.today()}" disabled>
        <label class="birthday-share"><input id="profileBirthdayShare" type="checkbox" disabled>반 친구들에게 생일 표시</label>
        <p class="birthday-help">생년월일은 본인과 관리자만 확인합니다. 공개 시 같은 반에는 이름과 월·일만 표시됩니다. 날짜를 비우고 저장하면 생일 정보가 삭제됩니다.</p>
        <p id="profileStatus" role="status">불러오는 중…</p>
        <div class="profile-dialog-actions"><button type="button" id="logoutBtn" class="toss-chip-btn">로그아웃</button><button type="submit" class="toss-primary-btn" disabled>저장</button></div>
      </form>`;
    const form=dialog.querySelector('form'),name=form.querySelector('#profileName'),mbti=form.querySelector('#profileMbti'),date=form.querySelector('#profileBirthDate'),share=form.querySelector('#profileBirthdayShare'),message=form.querySelector('#profileStatus'),save=form.querySelector('[type=submit]');
    const current=()=>session===s&&dialog.open&&form.isConnected;
    const rpcCall=(name,args)=>{
      const client=window.CodeWikiAuth?.getSupabaseClient();
      if(!client)return Promise.reject(new Error('서버 연결을 확인해 주세요.'));
      return window.CodeWikiLearning?.rpcWithTimeout
        ? window.CodeWikiLearning.rpcWithTimeout(()=>client.rpc(name,args))
        : client.rpc(name,args);
    };
    dialog.querySelector('[data-close-profile]').addEventListener('click',()=>dialog.close());
    form.querySelector('#logoutBtn').addEventListener('click',()=>window.CodeWikiAuth.logout());
    if(!dialog.open)dialog.showModal();
    try {
      const result=await rpcCall('cw_get_my_profile',{p_token:s.token});
      if(!current())return;if(result.error)throw result.error;
      const p=result.data;
      form.querySelector('#profileUsername').textContent=p.username;
      form.querySelector('#profileClass').textContent=p.class_name;
      form.querySelector('#profileStudentNumber').textContent=p.student_number==null?'미등록':`${p.student_number}번`;
      form.querySelector('#profileRole').textContent=p.role==='admin'?'관리자':'회원';
      name.value=p.full_name;mbti.value=p.mbti||'';date.value=p.birth_date||'';share.checked=Boolean(p.share_with_class);
      name.disabled=false;mbti.disabled=false;date.disabled=false;share.disabled=!date.value;save.disabled=false;message.textContent='';
      date.addEventListener('input',()=>{share.disabled=!date.value;if(!date.value)share.checked=false;});
    } catch {if(current())message.textContent='프로필을 불러오지 못했습니다. 창을 닫고 다시 시도해 주세요.';}
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(!current()||save.disabled)return;
      if(!name.value.trim()){message.textContent='이름을 입력해 주세요.';name.focus();return;}
      if(!window.CodeWikiBirthdays.validDate(date.value)){message.textContent='생년월일을 확인해 주세요.';date.focus();return;}
      save.disabled=true;message.textContent='저장 중…';
      try {
        const result=await rpcCall('cw_update_my_profile',{p_token:s.token,p_full_name:name.value.trim(),p_mbti:mbti.value,p_birth_date:date.value||null,p_share_with_class:Boolean(date.value&&share.checked)});
        if(session!==s)return;if(result.error)throw result.error;
        window.CodeWikiAuth.applyProfile(result.data);
        void window.CodeWikiBirthdays.refresh();
        if(current()){name.value=result.data.full_name;message.textContent='저장했습니다.';}
      } catch {if(current())message.textContent='저장하지 못했습니다. 입력한 내용은 유지됩니다. 다시 시도해 주세요.';}
      finally {if(current())save.disabled=false;}
    });
  }
  window.CodeWikiProfile={setUser,openSettings};
  window.addEventListener('storage',e=>{if(e.key==='codewiki_supa_token_v1'&&session&&e.newValue!==session.token)setUser(null);});
})();
