/* One-time login announcement modal for approved student accounts. */
(() => {
  const ACTIVE_NOTICE = Object.freeze({
    id: '2026-11-26-textbook-rebuild',
    badge: '공지사항',
    title: '교재 기준 목차 개편 안내',
    items: Object.freeze([
      Object.freeze({
        heading: '목차 기준이 교재 순서로 변경되었습니다',
        body: 'BC400(ABAP 기초)과 BC430(ABAP Dictionary)의 Unit · Lesson · Exercise 흐름에 맞춰 목차를 재편했습니다. 기존 수업일별 보기도 목차 상단 버튼으로 그대로 이용하실 수 있습니다.'
      }),
      Object.freeze({
        heading: '주말 중 내용 보강 예정',
        body: '세부 보완이 필요한 단원과 실습 내용은 주말 중으로 좀 더 면밀히 업데이트할 예정입니다.'
      })
    ]),
    cheer: '다음 주 월요일 시험공부 화이팅입니다!'
  });

  const STORAGE_PREFIX = 'codewiki_notice_seen_v1:';
  const memorySeen = new Set();

  let openUserId = null;
  let previousFocus = null;
  let keydownHandler = null;

  function esc(value) {
    if (window.CodeWikiLearning?.escape) return window.CodeWikiLearning.escape(value ?? '');
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function isEligibleStudent(user) {
    return Boolean(user && user.id != null && user.role === 'student' && user.status === 'approved');
  }

  function storageKey(noticeId, userId) {
    return `${STORAGE_PREFIX}${noticeId}:${String(userId)}`;
  }

  function hasSeen(noticeId, userId) {
    const key = storageKey(noticeId, userId);
    if (memorySeen.has(key)) return true;
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  }

  function markSeen(noticeId, userId) {
    const key = storageKey(noticeId, userId);
    memorySeen.add(key);
    try {
      localStorage.setItem(key, '1');
    } catch { /* Storage can be unavailable; memory fallback still prevents repeat popups. */ }
  }

  function getModal() {
    return document.getElementById('siteNoticeModal');
  }

  function close() {
    const modal = getModal();
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }
    if (modal) {
      modal.classList.add('hidden');
      modal.innerHTML = '';
    }
    openUserId = null;
    const restore = previousFocus;
    previousFocus = null;
    if (restore && typeof restore.focus === 'function') {
      try { restore.focus(); } catch {}
    }
  }

  function dismiss() {
    if (ACTIVE_NOTICE && openUserId != null) {
      markSeen(ACTIVE_NOTICE.id, openUserId);
    }
    close();
  }

  function maybeShow(user) {
    if (!ACTIVE_NOTICE || !isEligibleStudent(user)) return false;
    const userId = String(user.id);
    if (hasSeen(ACTIVE_NOTICE.id, userId)) return false;
    const modal = getModal();
    if (!modal) return false;
    if (openUserId === userId && !modal.classList.contains('hidden')) return true;

    close();
    openUserId = userId;
    previousFocus = document.activeElement || null;

    const itemsHtml = (ACTIVE_NOTICE.items || []).map(item => `
      <li class="site-notice-item">
        <strong>${esc(item.heading)}</strong>
        <p>${esc(item.body)}</p>
      </li>
    `).join('');

    modal.innerHTML = `
      <div class="toss-card site-notice-card" role="dialog" aria-modal="true" aria-labelledby="siteNoticeTitle">
        <div class="site-notice-header">
          <div>
            ${ACTIVE_NOTICE.badge ? `<span class="site-notice-badge">${esc(ACTIVE_NOTICE.badge)}</span>` : ''}
            <h2 id="siteNoticeTitle" class="site-notice-title">${esc(ACTIVE_NOTICE.title)}</h2>
          </div>
          <button type="button" id="siteNoticeCloseBtn" class="icon-btn" aria-label="공지사항 닫기">✕</button>
        </div>
        <ul class="site-notice-list">${itemsHtml}</ul>
        ${ACTIVE_NOTICE.cheer ? `<div class="site-notice-cheer">${esc(ACTIVE_NOTICE.cheer)}</div>` : ''}
        <div class="site-notice-footer">
          <span class="site-notice-hint">이 공지는 처음 1회만 표시됩니다.</span>
          <button type="button" id="siteNoticeConfirmBtn" class="toss-primary-btn site-notice-confirm-btn">확인</button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');

    const closeBtn = document.getElementById('siteNoticeCloseBtn');
    const confirmBtn = document.getElementById('siteNoticeConfirmBtn');
    closeBtn?.addEventListener('click', dismiss);
    confirmBtn?.addEventListener('click', dismiss);
    modal.onclick = e => {
      if (e.target === modal) dismiss();
    };
    keydownHandler = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss();
      }
    };
    document.addEventListener('keydown', keydownHandler);
    confirmBtn?.focus?.();
    return true;
  }

  function setUser(user) {
    if (!isEligibleStudent(user) || (openUserId != null && String(user.id) !== openUserId)) {
      close();
    }
  }

  window.CodeWikiNotice = {
    getActiveNotice: () => ACTIVE_NOTICE,
    maybeShow,
    setUser,
    close
  };
})();
