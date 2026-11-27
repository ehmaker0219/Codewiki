/* Admin approval UI. Authentication owns the session and injects data access.
 * Supports both full-page console mode (#admin/approvals) and legacy modal mode. */
(() => {
  function create({modal, mode = 'modal', getContainer, getToken, getUser, client, getClient, isActive, onChange, onUsersChange}) {
    const isPage = mode === 'page';
    const escape = window.CodeWikiLearning.escape;
    const resolveClient = () => (typeof getClient === 'function' ? getClient() : client);
    const rpcCall = (name, args) => {
      const c = resolveClient();
      if (!c) return Promise.reject(new Error('서버 연결을 확인해 주세요.'));
      return window.CodeWikiLearning?.rpcWithTimeout
        ? window.CodeWikiLearning.rpcWithTimeout(() => c.rpc(name, args))
        : c.rpc(name, args);
    };
    const groups = [
      {status:'pending', title:'승인 대기 중', empty:'대기 중인 신청자가 없습니다.', actions:[['approved','승인','approve'],['rejected','거절','reject']]},
      {status:'approved', title:'승인 완료 멤버', empty:'승인된 멤버가 없습니다.', actions:[['pending','승인 취소','revoke']]},
      {status:'rejected', title:'반려됨', actions:[['approved','다시 승인','approve'],['delete','삭제','reject']]}
    ];
    let users = [], filter = 'ALL', statusFilter = 'ALL', searchQuery = '', loaded = false;
    let generation = 0, sessionKey = '', busy = false, errorMessage = '', errorTarget = '';
    const className = user => user.class_name || '기본반';
    const hostEl = () => (typeof getContainer === 'function' ? getContainer() : modal);
    const isViewActive = () => (typeof isActive === 'function' ? Boolean(isActive()) : true);
    const sameSession = (version, token, id) => generation === version && getToken() === token && getUser()?.id === id && getUser()?.role === 'admin';
    const current = (version, token, id) => sameSession(version, token, id) && isViewActive();

    function formatDateTime(value) {
      if (!value) return '—';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString('ko-KR', {timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
    }

    function notifyPendingCount() {
      if (typeof onUsersChange === 'function') {
        const pending = users.filter(u => u.status === 'pending').length;
        onUsersChange({users, pendingCount: pending});
      }
    }

    function resetState(clearFilters = false) {
      generation++;
      users = [];
      loaded = false;
      busy = false;
      errorMessage = '';
      errorTarget = '';
      if (clearFilters) {
        filter = 'ALL';
        statusFilter = 'ALL';
        searchQuery = '';
      }
    }

    function close() {
      resetState(false);
      if (!isPage && modal) {
        modal.classList.add('hidden');
        modal.innerHTML = '';
      }
    }

    function invalidate() {
      generation++;
      loaded = false;
      busy = false;
      errorMessage = '';
      errorTarget = '';
    }

    function setUser(user) {
      const key = user?.role === 'admin' ? JSON.stringify([user.id, getToken()]) : '';
      if (key !== sessionKey || !key) {
        sessionKey = key;
        resetState(true);
        if (!isPage && modal) {
          modal.classList.add('hidden');
          modal.innerHTML = '';
        }
      }
    }

    function renderModalRow(user, group) {
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

    function renderPageRow(user, group) {
      const date = user.birthday_error ? '조회 실패' : escape(user.birth_date || '미등록');
      const mbtiCell = user.mbti && group.status !== 'rejected'
        ? `<span class="admin-meta-pill">${escape(user.mbti)}</span>`
        : '—';
      const statusCell = group.status === 'approved'
        ? '<span class="admin-status-pill is-on">승인됨</span>'
        : `<span class="members-time-cell">${escape(formatDateTime(user.created_at))}</span>`;
      const actionButtons = group.actions.map(([next, label, style]) => {
        const extra = next === 'delete' ? ' members-danger-btn' : '';
        return `<button type="button" class="${style}-btn admin-approval-action-btn${extra}" data-uid="${escape(user.id)}" data-next="${next}" ${busy ? 'disabled' : ''}>${label}</button>`;
      }).join('');
      const errorRow = errorMessage && errorTarget === String(user.id)
        ? `<tr class="admin-row-error-tr"><td colspan="7"><p class="admin-row-error" data-admin-row-error role="alert">${escape(errorMessage)} <button type="button" class="toss-chip-btn" data-admin-retry>목록 새로고침</button></p></td></tr>`
        : '';
      return `<tr>
        <td><span class="cat-type-pill">${escape(className(user))}</span></td>
        <td>${escape(user.full_name)}</td>
        <td>@${escape(user.username)}</td>
        <td>${mbtiCell}</td>
        <td>${date}</td>
        <td>${statusCell}</td>
        <td class="members-actions-cell"><div class="members-row-actions">${actionButtons}</div></td>
      </tr>${errorRow}`;
    }

    function renderPage(container) {
      const doc = globalThis.document;
      const activeEl = doc?.activeElement;
      const hadFocus = Boolean(activeEl && container.contains?.(activeEl));
      const keepSearch = hadFocus && activeEl.id === 'adminApprovalSearch';
      const selStart = keepSearch && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null;
      const selEnd = keepSearch && typeof activeEl.selectionEnd === 'number' ? activeEl.selectionEnd : null;
      const focusedClass = hadFocus ? activeEl.getAttribute?.('data-class-filter') : null;
      const focusedStatus = hadFocus ? activeEl.getAttribute?.('data-approval-status') : null;

      const counts = new Map();
      let pendingTotal = 0, approvedTotal = 0, rejectedTotal = 0;
      for (const user of users) {
        counts.set(className(user), (counts.get(className(user)) || 0) + 1);
        if (user.status === 'pending') pendingTotal++;
        else if (user.status === 'approved') approvedTotal++;
        else if (user.status === 'rejected') rejectedTotal++;
      }
      const classes = [...counts.keys()].sort((a,b) => a.localeCompare(b,'ko',{numeric:true}));
      if (filter !== 'ALL' && !counts.has(filter)) filter = 'ALL';

      const q = searchQuery.trim().toLocaleLowerCase();
      const visible = users.filter(user => {
        if (filter !== 'ALL' && className(user) !== filter) return false;
        if (statusFilter !== 'ALL' && user.status !== statusFilter) return false;
        if (q && !`${user.full_name || ''} ${user.username || ''} ${className(user)}`.toLocaleLowerCase().includes(q)) return false;
        return true;
      });

      const statusOptions = [
        ['ALL', '전체 상태', users.length],
        ['pending', '승인 대기', pendingTotal],
        ['approved', '승인 완료', approvedTotal],
        ['rejected', '반려됨', rejectedTotal]
      ];

      const visibleGroups = statusFilter === 'ALL' ? groups : groups.filter(g => g.status === statusFilter);
      const sectionsHtml = visibleGroups.map(group => {
        const members = visible.filter(user => user.status === group.status);
        if (!members.length && !group.empty && statusFilter === 'ALL') return '';
        const dateColLabel = group.status === 'approved' ? '상태' : '신청일시';
        const badgeClass = group.status === 'pending' && members.length > 0 ? 'admin-unread-pill' : 'admin-meta-pill';
        const emptyMsg = busy && !loaded
          ? '회원 목록을 불러오는 중…'
          : (q || filter !== 'ALL' ? '현재 검색/필터 조건에 맞는 학생이 없습니다.' : (group.empty || '해당 상태의 학생이 없습니다.'));
        return `<section class="admin-panel admin-approval-section${group.status === 'pending' && members.length > 0 ? ' is-pending-highlight' : ''}">
          <div class="admin-panel-head">
            <div>
              <h3>${group.title} <span class="${badgeClass}">${members.length}명</span></h3>
              <p>${group.status === 'pending' ? '신규 가입 신청자입니다. 반과 이름을 확인한 뒤 승인 또는 거절하세요.' : group.status === 'approved' ? '현재 사이트 이용이 승인된 학생 목록입니다.' : '반려된 가입 요청입니다. 다시 승인하거나 계정 정보를 삭제할 수 있습니다.'}</p>
            </div>
          </div>
          ${members.length ? `<div class="members-table-wrap"><table class="members-table admin-approval-table">
            <thead><tr><th scope="col">반</th><th scope="col">이름</th><th scope="col">아이디</th><th scope="col">MBTI</th><th scope="col">생년월일</th><th scope="col">${dateColLabel}</th><th scope="col" class="members-actions-col">승인 처리</th></tr></thead>
            <tbody>${members.map(user => renderPageRow(user, group)).join('')}</tbody>
          </table></div>` : `<div class="admin-empty-box">${emptyMsg}</div>`}
        </section>`;
      }).join('');

      container.innerHTML = `<div class="admin-approval-page">
        <div class="admin-kpi-grid">
          <div class="admin-kpi-card"><span class="admin-kpi-label">전체 회원 · 신청</span><strong class="admin-kpi-value">${users.length}명</strong><span class="admin-kpi-sub">승인 관리 대상 전체</span></div>
          <div class="admin-kpi-card${pendingTotal > 0 ? ' is-attention' : ''}"><span class="admin-kpi-label">승인 대기 중</span><strong class="admin-kpi-value">${pendingTotal}명</strong><span class="admin-kpi-sub">${pendingTotal > 0 ? '처리가 필요한 신청자' : '대기 신청자 없음'}</span></div>
          <div class="admin-kpi-card"><span class="admin-kpi-label">승인 완료</span><strong class="admin-kpi-value">${approvedTotal}명</strong><span class="admin-kpi-sub">정상 이용 가능</span></div>
          <div class="admin-kpi-card"><span class="admin-kpi-label">반려됨</span><strong class="admin-kpi-value">${rejectedTotal}명</strong><span class="admin-kpi-sub">재승인 또는 삭제 가능</span></div>
        </div>

        <div class="admin-approval-toolbar">
          <div class="admin-approval-controls">
            <label class="admin-approval-search"><span class="sr-only">학생 검색</span><input id="adminApprovalSearch" type="search" placeholder="이름, 아이디 또는 반 검색" value="${escape(searchQuery)}"></label>
            <div class="admin-chip-group" role="group" aria-label="상태 필터">
              ${statusOptions.map(([id, label, count]) => `<button type="button" class="toss-chip-btn${statusFilter === id ? ' active' : ''}" data-approval-status="${id}">${label} (${count})</button>`).join('')}
            </div>
          </div>
          <button type="button" class="toss-chip-btn" data-admin-retry ${busy ? 'disabled' : ''}>${busy ? '불러오는 중…' : '목록 새로고침'}</button>
        </div>

        ${classes.length ? `<div class="admin-approval-class-row" role="group" aria-label="반별 필터">
          ${[['ALL','전체 반',users.length], ...classes.map(name => [name, name, counts.get(name)])].map(([id, label, count]) =>
            `<button type="button" class="toss-chip-btn${filter === id ? ' active' : ''}" data-class-filter="${escape(id)}">${escape(label)} (${count})</button>`).join('')}
        </div>` : ''}

        ${errorMessage && !errorTarget ? `<p class="admin-approval-error" role="alert">${escape(errorMessage)} <button type="button" class="toss-chip-btn" data-admin-retry>다시 시도</button></p>` : ''}

        <div class="admin-approval-groups">${sectionsHtml}</div>
      </div>`;

      if (keepSearch) {
        const input = container.querySelector?.('#adminApprovalSearch');
        input?.focus?.({preventScroll:true});
        if (selStart !== null && selEnd !== null) try { input?.setSelectionRange?.(selStart, selEnd); } catch {}
      } else if (focusedClass !== null) {
        const btn = [...(container.querySelectorAll?.('[data-class-filter]') || [])].find(el => el.getAttribute?.('data-class-filter') === focusedClass);
        btn?.focus?.({preventScroll:true});
      } else if (focusedStatus !== null) {
        const btn = [...(container.querySelectorAll?.('[data-approval-status]') || [])].find(el => el.getAttribute?.('data-approval-status') === focusedStatus);
        btn?.focus?.({preventScroll:true});
      }
    }

    function render() {
      const container = hostEl();
      if (!container) return;
      if (isPage) {
        if (!isViewActive()) return;
        renderPage(container);
        return;
      }
      const doc = globalThis.document;
      const hadFocus = Boolean(doc?.activeElement && container.contains?.(doc.activeElement));
      const focusedFilter = hadFocus ? doc.activeElement.getAttribute?.('data-class-filter') : null;
      const counts = new Map();
      for (const user of users) counts.set(className(user), (counts.get(className(user)) || 0) + 1);
      const classes = [...counts.keys()].sort((a,b) => a.localeCompare(b,'ko',{numeric:true}));
      if (filter !== 'ALL' && !counts.has(filter)) filter = 'ALL';
      const visible = filter === 'ALL' ? users : users.filter(user => className(user) === filter);
      container.innerHTML = `<div class="admin-modal-card toss-card" role="dialog" aria-modal="true" aria-labelledby="adminApprovalTitle" tabindex="-1" style="max-width:560px;">
        <div class="admin-modal-header"><div><span class="toss-badge-blue">Admin</span><h3 id="adminApprovalTitle" class="admin-modal-title">학생 승인 관리</h3></div>
          <button id="closeAdminModalBtn" class="icon-btn" aria-label="닫기">✕</button></div>
        ${classes.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">${[['ALL','전체',users.length],...classes.map(name=>[name,name,counts.get(name)])].map(([id,label,count]) =>
          `<button type="button" class="toss-chip-btn ${filter === id ? 'active' : ''}" data-class-filter="${escape(id)}" style="height:30px;font-size:12px;">${escape(label)} (${count})</button>`).join('')}</div>` : ''}
        ${errorMessage && !errorTarget ? `<p role="alert">${escape(errorMessage)} <button class="toss-chip-btn" data-admin-retry>다시 시도</button></p>` : ''}
        <div class="admin-modal-body">${groups.map((group,index) => {
          const members = visible.filter(user => user.status === group.status);
          if (!members.length && !group.empty) return '';
          return `<div class="admin-group-title" ${index ? 'style="margin-top:24px;"' : ''}><span>${group.title}</span><span class="count-pill">${members.length}명</span></div>`+
            (members.length ? `<div class="admin-user-list">${members.map(user=>renderModalRow(user,group)).join('')}</div>` : `<div class="admin-empty-box">${busy ? '불러오는 중…' : group.empty}</div>`);
        }).join('')}</div></div>`;
      if (hadFocus && !container.classList.contains('hidden')) {
        const target = focusedFilter !== null
          ? [...(container.querySelectorAll?.('[data-class-filter]') || [])].find(el => el.getAttribute?.('data-class-filter') === focusedFilter)
          : null;
        (target || container.querySelector?.('.admin-modal-card'))?.focus?.({preventScroll:true});
      }
    }

    async function load(force = false) {
      if (getUser()?.role !== 'admin' || !isViewActive()) return;
      if (busy && !force) return;
      const version = ++generation, token = getToken(), id = getUser().id;
      if (!isPage) users = [];
      busy = true; errorMessage = ''; errorTarget = '';
      if (!isPage && modal) {
        modal.classList.remove('hidden');
      }
      render();
      if (!isPage && modal) modal.querySelector?.('.admin-modal-card')?.focus?.();
      try {
        // Independent reads run together; birthday failure doesn't hide approval requests.
        const [list, birthdays] = await Promise.all([
          rpcCall('cw_admin_list_users', {p_token: token}),
          Promise.resolve().then(() => rpcCall('cw_admin_birthdays', {p_token: token})).catch(error => ({error}))
        ]);
        if (!sameSession(version, token, id)) return;
        if (list.error) throw list.error;
        const dates = new Map((birthdays.data || []).map(row => [row.user_id, row.birth_date]));
        users = (list.data || []).map(user => ({...user, birth_date: dates.get(user.id), birthday_error: Boolean(birthdays.error)}));
        loaded = true;
        notifyPendingCount();
      } catch {
        if (sameSession(version, token, id)) errorMessage = '회원 목록을 불러오지 못했습니다.';
      }
      if (sameSession(version, token, id)) {
        busy = false;
        if (isViewActive()) render();
      }
    }

    function ensureLoaded(force = false) {
      if (!isViewActive() || getUser()?.role !== 'admin') return;
      if (loaded && !force) { render(); return; }
      return load(force);
    }

    async function open() {
      return load(true);
    }

    async function updateStatus(button) {
      if (busy || getUser()?.role !== 'admin' || !isViewActive()) return;
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
          ? await rpcCall('cw_admin_delete_rejected_user', {p_token: token, p_target_id: target})
          : await rpcCall('cw_admin_set_status', {p_token: token, p_target_id: target, p_next_status: next});
        if (result.error) throw result.error;
        if (!sameSession(version, token, id)) return;
        if (deleting) {
          users = users.filter(user => String(user.id) !== target);
          busy = false;
          notifyPendingCount();
          if (isViewActive()) render();
          window.CodeWikiAdminMembers?.invalidate?.({skipApprovals: true});
          window.CodeWikiBirthdays?.refresh?.({force: true});
          if (getToken() === token && getUser()?.id === id) await onChange?.();
          return;
        }
        window.CodeWikiAdminMembers?.invalidate?.({skipApprovals: true});
        window.CodeWikiBirthdays?.refresh?.({force: true});
        if (isViewActive()) {
          await load(true);
        } else {
          loaded = false;
          busy = false;
        }
        if (getToken() === token && getUser()?.id === id) await onChange?.();
      } catch (error) {
        if (sameSession(version, token, id)) {
          busy = false;
          errorTarget = target;
          errorMessage = deleting
            ? error?.code === 'PGRST202' ? '삭제 기능이 서버에 적용되지 않아 삭제하지 못했습니다.' : '가입 요청을 삭제하지 못했습니다. 목록을 새로 불러온 뒤 다시 시도해 주세요.'
            : '승인 상태를 변경하지 못했습니다. 다시 시도해 주세요.';
          if (isViewActive()) {
            render();
            hostEl()?.querySelector?.('[data-admin-row-error]')?.scrollIntoView?.({block:'nearest'});
          }
        }
      }
    }

    function handleClick(event) {
      if (!isPage && (event.target === modal || event.target.closest('#closeAdminModalBtn'))) { close(); return true; }
      const statusButton = event.target.closest?.('[data-approval-status]');
      if (statusButton) {
        statusFilter = statusButton.getAttribute('data-approval-status') || 'ALL';
        render();
        return true;
      }
      const classButton = event.target.closest?.('[data-class-filter]');
      if (classButton) {
        filter = classButton.getAttribute('data-class-filter');
        render();
        return true;
      }
      if (event.target.closest?.('[data-admin-retry]')) {
        if (!busy) void load(true);
        return true;
      }
      const action = event.target.closest?.('[data-uid]');
      if (action) {
        void updateStatus(action);
        return true;
      }
      return false;
    }

    function handleInput(event) {
      if (event.target?.id === 'adminApprovalSearch') {
        searchQuery = event.target.value || '';
        render();
        return true;
      }
      return false;
    }

    if (!isPage && modal) {
      // One listener survives rerenders; filtering uses the fetched snapshot, not another RPC.
      modal.addEventListener('click', handleClick);
      const onEscape = event => { if (event.key === 'Escape' && !modal.classList.contains('hidden')) close(); };
      modal.addEventListener('keydown', onEscape);
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('keydown', onEscape);
      }
    }

    return {
      open,
      close,
      setUser,
      reset: () => resetState(false),
      invalidate,
      ensureLoaded,
      render,
      handleClick,
      handleInput,
      getPendingCount: () => loaded ? users.filter(u => u.status === 'pending').length : null
    };
  }
  window.CodeWikiAdmin = {create};
})();
