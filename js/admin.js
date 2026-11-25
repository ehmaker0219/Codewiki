/* Admin approval UI. Authentication owns the session and injects data access. */
(() => {
  function create({modal, getToken, getUser, client, onChange}) {
    const escape = window.CodeWikiLearning.escape;
    const rpcCall = (name, args) => window.CodeWikiLearning?.rpcWithTimeout
      ? window.CodeWikiLearning.rpcWithTimeout(() => client.rpc(name, args))
      : client.rpc(name, args);
    const groups = [
      {status:'pending', title:'승인 대기 중', empty:'대기 중인 신청자가 없습니다.', actions:[['approved','승인','approve'],['rejected','거절','reject']]},
      {status:'approved', title:'승인 완료 멤버', empty:'승인된 멤버가 없습니다.', actions:[['pending','승인 취소','revoke']]},
      {status:'rejected', title:'반려됨', actions:[['approved','다시 승인','approve'],['delete','삭제','reject']]}
    ];
    let users = [], filter = 'ALL', generation = 0, sessionKey = '', busy = false, errorMessage = '', errorTarget = '';
    const className = user => user.class_name || '기본반';
    const current = (version, token, id) => generation === version && getToken() === token && getUser()?.id === id && getUser()?.role === 'admin';

    function close() {
      generation++;
      users = [];
      busy = false;
      errorMessage = '';
      errorTarget = '';
      modal.classList.add('hidden');
      modal.innerHTML = '';
    }

    function setUser(user) {
      const key = user?.role === 'admin' ? JSON.stringify([user.id, getToken()]) : '';
      if (key !== sessionKey || !key) { sessionKey = key; filter = 'ALL'; close(); }
    }

    function renderRow(user, group) {
      const date = user.birthday_error ? '조회 실패' : escape(user.birth_date || '미등록');
      return `<div class="admin-user-entry"><div class="admin-user-row">
        <div>
          <div class="admin-user-name">
            <span class="cat-type-pill" style="margin-right:4px;">${escape(className(user))}</span>
            ${user.mbti && group.status !== 'rejected' ? `<span class="toss-badge-blue" style="font-size:11px;padding:2px 6px;margin-right:4px;">${escape(user.mbti)}</span>` : ''}
            ${escape(user.full_name)} ${group.status === 'approved' ? '<span class="approved-tag">승인됨</span>' : ''}
          </div>
          <div class="admin-user-email">@${escape(user.username)}${group.status === 'pending' ? ' · '+escape(user.created_at || '') : ''}</div>
          <div class="admin-user-email">생년월일: ${date} · 관리자 전용</div>
        </div>
        <div class="admin-action-btns">${group.actions.map(([next,label,style]) =>
          `<button class="${style}-btn" data-uid="${escape(user.id)}" data-next="${next}" ${busy ? 'disabled' : ''}>${label}</button>`).join('')}</div>
      </div>${errorMessage && errorTarget === String(user.id) ? `<p class="admin-row-error" data-admin-row-error role="alert">${escape(errorMessage)} <button class="toss-chip-btn" data-admin-retry>목록 새로고침</button></p>` : ''}</div>`;
    }

    function render() {
      const doc = globalThis.document;
      const hadFocus = Boolean(doc?.activeElement && modal.contains?.(doc.activeElement));
      const focusedFilter = hadFocus ? doc.activeElement.getAttribute?.('data-class-filter') : null;
      const counts = new Map();
      for (const user of users) counts.set(className(user), (counts.get(className(user)) || 0) + 1);
      const classes = [...counts.keys()].sort((a,b) => a.localeCompare(b,'ko',{numeric:true}));
      if (filter !== 'ALL' && !counts.has(filter)) filter = 'ALL';
      const visible = filter === 'ALL' ? users : users.filter(user => className(user) === filter);
      modal.innerHTML = `<div class="admin-modal-card toss-card" role="dialog" aria-modal="true" aria-labelledby="adminApprovalTitle" tabindex="-1" style="max-width:560px;">
        <div class="admin-modal-header"><div><span class="toss-badge-blue">Admin</span><h3 id="adminApprovalTitle" class="admin-modal-title">학생 승인 관리</h3></div>
          <button id="closeAdminModalBtn" class="icon-btn" aria-label="닫기">✕</button></div>
        ${classes.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">${[['ALL','전체',users.length],...classes.map(name=>[name,name,counts.get(name)])].map(([id,label,count]) =>
          `<button type="button" class="toss-chip-btn ${filter === id ? 'active' : ''}" data-class-filter="${escape(id)}" style="height:30px;font-size:12px;">${escape(label)} (${count})</button>`).join('')}</div>` : ''}
        ${errorMessage && !errorTarget ? `<p role="alert">${escape(errorMessage)} <button class="toss-chip-btn" data-admin-retry>다시 시도</button></p>` : ''}
        <div class="admin-modal-body">${groups.map((group,index) => {
          const members = visible.filter(user => user.status === group.status);
          if (!members.length && !group.empty) return '';
          return `<div class="admin-group-title" ${index ? 'style="margin-top:24px;"' : ''}><span>${group.title}</span><span class="count-pill">${members.length}명</span></div>`+
            (members.length ? `<div class="admin-user-list">${members.map(user=>renderRow(user,group)).join('')}</div>` : `<div class="admin-empty-box">${busy ? '불러오는 중…' : group.empty}</div>`);
        }).join('')}</div></div>`;
      if (hadFocus && !modal.classList.contains('hidden')) {
        const target = focusedFilter !== null
          ? [...(modal.querySelectorAll?.('[data-class-filter]') || [])].find(el => el.getAttribute?.('data-class-filter') === focusedFilter)
          : null;
        (target || modal.querySelector?.('.admin-modal-card'))?.focus?.({preventScroll:true});
      }
    }

    async function open() {
      if (getUser()?.role !== 'admin') return;
      const version = ++generation, token = getToken(), id = getUser().id;
      users = []; busy = true; errorMessage = ''; errorTarget = '';
      modal.classList.remove('hidden'); render();
      modal.querySelector?.('.admin-modal-card')?.focus?.();
      try {
        // Independent reads run together; birthday failure doesn't hide approval requests.
        const [list, birthdays] = await Promise.all([
          rpcCall('cw_admin_list_users',{p_token:token}),
          Promise.resolve().then(()=>rpcCall('cw_admin_birthdays',{p_token:token})).catch(error=>({error}))
        ]);
        if (!current(version,token,id)) return;
        if (list.error) throw list.error;
        const dates = new Map((birthdays.data || []).map(row=>[row.user_id,row.birth_date]));
        users = (list.data || []).map(user=>({...user,birth_date:dates.get(user.id),birthday_error:Boolean(birthdays.error)}));
      } catch { if (current(version,token,id)) errorMessage = '회원 목록을 불러오지 못했습니다.'; }
      if (current(version,token,id)) { busy = false; render(); }
    }

    async function updateStatus(button) {
      if (busy || getUser()?.role !== 'admin') return;
      const version = generation, token = getToken(), id = getUser().id;
      const target = button.getAttribute('data-uid'), next = button.getAttribute('data-next');
      const deleting = next === 'delete';
      if (deleting) {
        const member = users.find(user => String(user.id) === target);
        if (!member || member.status !== 'rejected' || member.role === 'admin') return;
        if (!window.confirm(`${member.full_name}님의 거절된 가입 요청과 계정 정보를 삭제할까요?\n삭제 후 같은 아이디로 다시 가입 신청할 수 있습니다. 이 작업은 되돌릴 수 없습니다.`)) return;
      }
      busy = true; errorMessage = ''; errorTarget = ''; render();
      try {
        const result = deleting
          ? await rpcCall('cw_admin_delete_rejected_user',{p_token:token,p_target_id:target})
          : await rpcCall('cw_admin_set_status',{p_token:token,p_target_id:target,p_next_status:next});
        if (result.error) throw result.error;
        if (!current(version,token,id)) return;
        if (deleting) {
          users = users.filter(user=>String(user.id) !== target);
          busy = false; render();
          window.CodeWikiAdminMembers?.invalidate?.();
          window.CodeWikiBirthdays?.refresh?.({ force: true });
          if (getToken() === token && getUser()?.id === id) await onChange();
          return;
        }
        window.CodeWikiAdminMembers?.invalidate?.();
        window.CodeWikiBirthdays?.refresh?.({ force: true });
        await open();
        if (getToken() === token && getUser()?.id === id) await onChange();
      } catch (error) {
        if (current(version,token,id)) {
          busy = false;
          errorTarget = target;
          errorMessage = deleting
            ? error?.code === 'PGRST202' ? '삭제 기능이 서버에 적용되지 않아 삭제하지 못했습니다.' : '가입 요청을 삭제하지 못했습니다. 목록을 새로 불러온 뒤 다시 시도해 주세요.'
            : '승인 상태를 변경하지 못했습니다. 다시 시도해 주세요.';
          render();
          modal.querySelector?.('[data-admin-row-error]')?.scrollIntoView?.({block:'nearest'});
        }
      }
    }

    // One listener survives rerenders; filtering uses the fetched snapshot, not another RPC.
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('#closeAdminModalBtn')) { close(); return; }
      const classButton = event.target.closest('[data-class-filter]');
      if (classButton) { filter = classButton.getAttribute('data-class-filter'); render(); return; }
      if (event.target.closest('[data-admin-retry]')) { if (!busy) void open(); return; }
      const action = event.target.closest('[data-uid]');
      if (action) void updateStatus(action);
    });
    const onEscape = event => { if (event.key === 'Escape' && !modal.classList.contains('hidden')) close(); };
    modal.addEventListener('keydown', onEscape);
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('keydown', onEscape);
    }
    return {open, close, setUser};
  }
  window.CodeWikiAdmin = {create};
})();
