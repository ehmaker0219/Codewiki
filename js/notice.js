/* One-time login announcement modal for approved student accounts. */
(() => {
  const ACTIVE_NOTICE = Object.freeze({
    id: '2026-11-26-basic-session-review',
    badge: '업데이트 공지',
    title: 'Basic Session Review · 시험 대비 업데이트 안내',
    items: Object.freeze([
      Object.freeze({
        heading: 'Basic Session Review 탭 신규 추가',
        body: '오늘 진행한 Basic Session 시험 대비 문제의 강사님 핵심 강조점, 자주 놓치는 포인트 8선, 사내 강사님 공식 답안(ZPROG_CL5_T14_005), 이해도 체크리스트 13항목을 좌측 사이드바 Basic Session Review 탭에 정리했습니다.'
      }),
      Object.freeze({
        heading: '객체 생성 가이드 보강 & 검색 섹션 바로 이동',
        body: 'Change Request(SE09), Package(SE80), Report Program(SE38), T-Code(SE93), Message Class(SE91 · REPORT MESSAGE-ID), Text Element, Function Group · Function Module(SE37), Global Class(SE24) 생성 절차를 단원별로 채웠고, 검색창에서 결과를 누르면 일치한 파트까지 바로 이동하도록 개선했습니다.'
      })
    ]),
    cheer: '다음 주 월요일 시험공부 화이팅입니다!'
  });

  const STORAGE_PREFIX = 'codewiki_notice_seen_v1:';
  const memorySeen = new Set();

  let openUserId = null;
  let openLiveNoticeId = null;
  let activeLiveAck = null;
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

  function isCoveredByHigherModal() {
    const dm = document.getElementById('directMessageModal');
    const maint = document.getElementById('maintenanceOverlay');
    return Boolean((dm && !dm.classList.contains('hidden')) || (maint && !maint.classList.contains('hidden')));
  }

  function close() {
    const wasOpen = Boolean(openUserId != null || openLiveNoticeId != null);
    const modal = getModal();
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }
    if (modal) {
      modal.classList.add('hidden');
      modal.innerHTML = '';
      modal.onclick = null;
    }
    openUserId = null;
    openLiveNoticeId = null;
    activeLiveAck = null;
    const restore = previousFocus;
    previousFocus = null;
    if (restore && typeof restore.focus === 'function') {
      try { restore.focus(); } catch {}
    }
    if (wasOpen && typeof Event === 'function') {
      try { window.dispatchEvent?.(new Event('cw-notice-closed')); } catch {}
    }
  }

  function dismiss() {
    if (openLiveNoticeId) {
      const ackId = openLiveNoticeId;
      const ackFn = activeLiveAck;
      const uid = openUserId;
      const key = uid != null ? storageKey('live:' + ackId, uid) : '';
      if (key) memorySeen.add(key);
      close();
      if (typeof ackFn === 'function') {
        try {
          Promise.resolve(ackFn(ackId)).then(ok => {
            if (ok === false) {
              if (key) memorySeen.delete(key);
            } else if (uid != null) {
              markSeen('live:' + ackId, uid);
            }
          }).catch(() => {
            if (key) memorySeen.delete(key);
          });
        } catch {
          if (key) memorySeen.delete(key);
        }
      } else if (uid != null) {
        markSeen('live:' + ackId, uid);
      }
      return;
    }
    if (ACTIVE_NOTICE && openUserId != null) {
      markSeen(ACTIVE_NOTICE.id, openUserId);
    }
    close();
  }

  function showLiveNotice(notice, onAck) {
    const user = window.CodeWikiAuth?.getCurrentUser?.();
    if (!notice?.id || !isEligibleStudent(user) || isCoveredByHigherModal()) return false;
    const userId = String(user.id);
    const liveKey = 'live:' + String(notice.id);
    if (hasSeen(liveKey, userId)) return false;
    const modal = getModal();
    if (!modal) return false;
    // Never interrupt an already-visible notice (e.g., static update notice); caller retries on cw-notice-closed.
    if (!modal.classList.contains('hidden')) {
      return openLiveNoticeId === String(notice.id);
    }

    close();
    openUserId = userId;
    openLiveNoticeId = String(notice.id);
    activeLiveAck = typeof onAck === 'function' ? onAck : null;
    previousFocus = document.activeElement || null;

    const paragraphs = String(notice.body || '')
      .split(/\n{2,}/)
      .map(block => block.trim())
      .filter(Boolean)
      .map(block => `<li class="site-notice-item"><p>${esc(block).replace(/\n/g, '<br>')}</p></li>`)
      .join('');

    modal.innerHTML = `
      <div class="toss-card site-notice-card" role="dialog" aria-modal="true" aria-labelledby="siteNoticeTitle">
        <div class="site-notice-header">
          <div>
            ${notice.badge ? `<span class="site-notice-badge">${esc(notice.badge)}</span>` : ''}
            <h2 id="siteNoticeTitle" class="site-notice-title">${esc(notice.title)}</h2>
          </div>
          <button type="button" id="siteNoticeCloseBtn" class="icon-btn" aria-label="공지사항 닫기">✕</button>
        </div>
        <ul class="site-notice-list">${paragraphs}</ul>
        ${notice.cheer ? `<div class="site-notice-cheer">${esc(notice.cheer)}</div>` : ''}
        <div class="site-notice-footer">
          <span class="site-notice-hint">관리자가 발송한 실시간 공지입니다.</span>
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
      if (e.key === 'Escape' && !isCoveredByHigherModal()) {
        e.preventDefault();
        dismiss();
      }
    };
    document.addEventListener('keydown', keydownHandler);
    confirmBtn?.focus?.();
    return true;
  }

  function maybeShow(user) {
    if (!ACTIVE_NOTICE || !isEligibleStudent(user) || isCoveredByHigherModal()) return false;
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
      if (e.key === 'Escape' && !isCoveredByHigherModal()) {
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
    showLiveNotice,
    setUser,
    close
  };
})();
