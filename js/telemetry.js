/* Student runtime control sync (live notices, spotlight, 1:1 messages, maintenance, feature flags)
 * and strictly anonymous telemetry (doc views, stay time, searches, code copies, quiz difficulty, errors). */
(() => {
  // Dedicated Realtime topic isolated from presence.js ('cw:session-signal') to prevent Phoenix join/leave collisions.
  const SIGNAL_CHANNEL = 'cw:runtime-signal';
  const RUNTIME_EVENT = 'runtime_update';
  const DEVICE_ID_KEY = 'codewiki_device_id_v1';
  const FLAG_KEYS = Object.freeze([
    'basicSession', 'sqlGuide', 'dataGame', 'study', 'mentoring', 'knowledgeMap', 'practice'
  ]);
  const DEFAULT_FLAGS = Object.freeze({
    basicSession: true,
    sqlGuide: true,
    dataGame: true,
    study: true,
    mentoring: true,
    knowledgeMap: true,
    practice: true
  });

  let session = null;
  let pollTimer = null;
  let wakeTimer = null;
  let navSyncTimer = null;
  let searchTimer = null;
  let signalChannel = null;
  let signalClient = null;
  let currentDoc = { id: '', label: '', enteredAt: 0 };
  let runtimeState = {
    maintenance: { enabled: false, message: '' },
    feature_flags: { ...DEFAULT_FLAGS },
    spotlight: { active: false, doc_id: '', section_id: '', label: '', message: '', sent_at: null }
  };
  let dismissedSpotlightAt = null;
  let lastMaintenanceKey = '';
  let lastSpotlightKey = '';
  let pendingLiveNotice = null;
  let dmQueue = [];
  let activeDmId = null;
  let dmPrevFocus = null;
  let dmKeydown = null;
  let syncUnsupported = false;
  let trackUnsupported = false;
  let memoryClientId = '';
  const ackedDmIds = new Set();
  const recentErrors = new Map();
  const recentCopies = new Map();
  const recentProbes = new Map();

  function esc(value) {
    if (window.CodeWikiLearning?.escape) return window.CodeWikiLearning.escape(value ?? '');
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function getClientId() {
    if (memoryClientId) return memoryClientId;
    try {
      const saved = localStorage.getItem(DEVICE_ID_KEY);
      if (saved && saved.length >= 8 && saved.length <= 64) {
        memoryClientId = saved;
        return saved;
      }
      const next = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : 'cw-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      memoryClientId = next.slice(0, 64);
      localStorage.setItem(DEVICE_ID_KEY, memoryClientId);
      return memoryClientId;
    } catch {
      memoryClientId = 'cw-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      return memoryClientId.slice(0, 64);
    }
  }

  function getDeviceType() {
    try {
      const w = Number(window.innerWidth) || 1280;
      const ua = String(navigator?.userAgent || '').toLowerCase();
      if (/ipad|tablet/.test(ua) || (w > 680 && w <= 1024 && /android|mobile|touch/.test(ua))) return 'tablet';
      if (w <= 680 || /iphone|ipod|android.*mobile|mobile/.test(ua)) return 'mobile';
    } catch {}
    return 'desktop';
  }

  function formatKstTime(value) {
    const d = new Date(value);
    if (!value || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

  function isOverlayOpen(id) {
    const el = document.getElementById(id);
    return Boolean(el && !el.classList.contains('hidden'));
  }

  function resolveCurrentContext() {
    const h = String(window.location?.hash || '');
    if (h === '#study') return { id: 'page:study', label: '내 공부방' };
    if (h === '#mentoring') return { id: 'page:mentoring', label: '멘토링' };
    if (h === '#foundation') return { id: 'page:foundation', label: '파운데이션' };
    if (h === '#map') return { id: 'page:map', label: '개념 지도' };
    if (h === '#data-game') return { id: 'page:data-game', label: 'DATA 미니게임' };
    if (h.startsWith('#admin/')) return { id: 'page:admin', label: '관리자 페이지' };
    if (document.getElementById('appShell')?.classList?.contains('board-mode-shell')) {
      return { id: 'page:board', label: '건의 게시판' };
    }
    if (currentDoc.id) return { id: currentDoc.id, label: currentDoc.label || currentDoc.id };
    if (h.startsWith('#doc/')) {
      const id = h.slice(5).split('/')[0];
      const doc = window.WIKI_DOCS?.[id];
      return { id, label: doc?.title || id };
    }
    return { id: 'welcome-abap', label: '홈' };
  }

  function teardownSignal() {
    clearTimeout(wakeTimer); wakeTimer = null;
    const ch = signalChannel, client = signalClient;
    signalChannel = null; signalClient = null;
    if (ch) {
      try { client?.removeChannel?.(ch); } catch {}
    }
  }

  function setupSignal(s) {
    teardownSignal();
    if (!s || s.role !== 'student') return;
    const client = window.CodeWikiAuth?.getSupabaseClient?.();
    if (typeof client?.channel !== 'function') return;
    try {
      const ch = client.channel(SIGNAL_CHANNEL);
      signalChannel = ch; signalClient = client;
      ch.on('broadcast', { event: RUNTIME_EVENT }, () => {
        if (session !== s || s.stopped) return;
        const now = Date.now();
        if (now - s.wakeAt < 3000) return;
        s.wakeAt = now;
        if (document.hidden) { s.needsSync = true; return; }
        s.needsSync = true;
        clearTimeout(wakeTimer);
        const jitter = 150 + Math.floor(Math.random() * 550);
        wakeTimer = setTimeout(() => {
          wakeTimer = null;
          if (session === s && !s.stopped) void syncNow(true);
        }, jitter);
      }).subscribe();
    } catch { teardownSignal(); }
  }

  async function notifyRuntimeUpdate() {
    const client = window.CodeWikiAuth?.getSupabaseClient?.();
    if (typeof client?.channel !== 'function') return false;
    let ch = null;
    try {
      ch = client.channel(SIGNAL_CHANNEL);
      if (typeof ch.httpSend === 'function') {
        const res = await ch.httpSend(RUNTIME_EVENT, { at: Date.now() });
        return res?.success === true || res === 'ok';
      }
      const status = await ch.send({ type: 'broadcast', event: RUNTIME_EVENT, payload: { at: Date.now() } });
      return status === 'ok';
    } catch { return false; }
    finally {
      if (ch) { try { client.removeChannel?.(ch); } catch {} }
    }
  }

  function clearFeatureFlagClasses() {
    if (!document.body?.classList) return;
    for (const key of FLAG_KEYS) document.body.classList.remove(`cw-flag-off-${key}`);
  }

  function renderMaintenance() {
    const overlay = document.getElementById('maintenanceOverlay');
    if (!overlay) return;
    const show = Boolean(session?.role === 'student' && runtimeState.maintenance?.enabled);
    const msg = runtimeState.maintenance?.message || '현재 사이트 점검 중입니다. 잠시 후 다시 이용해 주세요.';
    const nextKey = show ? `on:${msg}` : 'off';
    const layout = document.getElementById('appLayout');
    if (!show) {
      if (lastMaintenanceKey !== 'off') {
        overlay.classList.add('hidden');
        overlay.innerHTML = '';
        document.body?.classList?.remove('maintenance-locked');
        if (layout) layout.inert = false;
        lastMaintenanceKey = 'off';
      }
      return;
    }
    // Close any active student overlays/dialogs so Escape cannot dismiss hidden notices underneath.
    window.CodeWikiNotice?.close?.();
    closeDmModal();
    document.getElementById('boardWriteModal')?.classList?.add('hidden');
    try {
      document.querySelectorAll?.('dialog[open]')?.forEach?.(d => d.close?.());
    } catch {}
    document.body?.classList?.add('maintenance-locked');
    if (layout) layout.inert = true;
    if (lastMaintenanceKey === nextKey && !overlay.classList.contains('hidden')) return;
    lastMaintenanceKey = nextKey;
    overlay.innerHTML = `
      <div class="toss-card maintenance-card" role="alertdialog" aria-modal="true" aria-labelledby="maintenanceTitle">
        <span class="site-notice-badge">사이트 점검 안내</span>
        <h2 id="maintenanceTitle" class="maintenance-title">잠시 점검 중입니다</h2>
        <p class="maintenance-desc">${esc(msg).replace(/\n/g, '<br>')}</p>
        <div class="maintenance-actions">
          <button type="button" id="maintenanceRetryBtn" class="toss-primary-btn">다시 확인</button>
          <button type="button" id="maintenanceLogoutBtn" class="toss-chip-btn">로그아웃</button>
        </div>
      </div>`;
    overlay.classList.remove('hidden');
    const retryBtn = document.getElementById('maintenanceRetryBtn');
    retryBtn?.addEventListener('click', () => void syncNow(true));
    document.getElementById('maintenanceLogoutBtn')?.addEventListener('click', () => void window.CodeWikiAuth?.logout?.());
    retryBtn?.focus?.();
  }

  function applyFeatureFlags() {
    if (session?.role !== 'student') {
      clearFeatureFlagClasses();
      return;
    }
    const flags = runtimeState.feature_flags || DEFAULT_FLAGS;
    // Use restrictive CSS classes on <body> so feature flags only intersect with module-owned role visibility.
    if (document.body?.classList) {
      for (const key of FLAG_KEYS) {
        const disabled = flags[key] === false;
        document.body.classList[disabled ? 'add' : 'remove'](`cw-flag-off-${key}`);
      }
    }
    if (flags.practice === false) {
      const dlg = document.getElementById('practiceDialog');
      if (dlg?.open) dlg.close?.();
    }

    const h = String(window.location?.hash || '');
    const blocked =
      (flags.basicSession === false && h.startsWith('#doc/basic-session-review')) ||
      (flags.sqlGuide === false && h.startsWith('#doc/abap-sql-guide')) ||
      (flags.dataGame === false && h === '#data-game') ||
      (flags.study === false && h === '#study') ||
      (flags.mentoring === false && h === '#mentoring') ||
      (flags.knowledgeMap === false && h === '#map');
    if (blocked) {
      window.CodeWikiStudy?.leave?.();
      window.CodeWikiMentoring?.leave?.();
      window.CodeWikiFoundation?.leave?.();
      window.CodeWikiObjectGame?.leave?.();
      window.CodeWikiKnowledgeMap?.leave?.();
      try { history.replaceState(null, '', '#doc/welcome-abap'); } catch {}
      window.CodeWikiApp?.openDoc?.('welcome-abap');
    }
  }

  function renderSpotlight() {
    const banner = document.getElementById('liveSpotlightBanner');
    if (!banner) return;
    const sp = runtimeState.spotlight;
    const show = Boolean(
      session?.role === 'student' &&
      !runtimeState.maintenance?.enabled &&
      sp?.active &&
      sp.doc_id &&
      sp.sent_at &&
      dismissedSpotlightAt !== sp.sent_at
    );
    if (!show) {
      if (lastSpotlightKey !== 'off') {
        banner.hidden = true;
        banner.innerHTML = '';
        lastSpotlightKey = 'off';
      }
      return;
    }
    const label = sp.label || window.WIKI_DOCS?.[sp.doc_id]?.title || sp.doc_id;
    const msg = sp.message || '관리자가 지금 함께 볼 문서를 공유했습니다.';
    const nextKey = `${sp.sent_at}|${sp.doc_id}|${sp.section_id || ''}|${label}|${msg}`;
    if (lastSpotlightKey === nextKey && !banner.hidden) return;
    lastSpotlightKey = nextKey;
    banner.innerHTML = `
      <div class="live-spotlight-inner" role="region" aria-label="수업 실시간 안내">
        <span class="live-spotlight-badge">LIVE 안내</span>
        <div class="live-spotlight-text">
          <strong>${esc(label)}</strong>
          <span>${esc(msg)}</span>
        </div>
        <div class="live-spotlight-actions">
          <button type="button" class="toss-primary-btn live-spotlight-go" data-spotlight-go>바로 이동</button>
          <button type="button" class="icon-btn live-spotlight-close" data-spotlight-dismiss aria-label="안내 닫기">✕</button>
        </div>
      </div>`;
    banner.hidden = false;
    banner.querySelector('[data-spotlight-go]')?.addEventListener('click', () => {
      dismissedSpotlightAt = sp.sent_at;
      lastSpotlightKey = 'off';
      banner.hidden = true;
      window.CodeWikiBoard?.closeIfActive?.();
      window.CodeWikiStudy?.leave?.();
      window.CodeWikiMentoring?.leave?.();
      window.CodeWikiFoundation?.leave?.();
      window.CodeWikiObjectGame?.leave?.();
      window.CodeWikiKnowledgeMap?.leave?.();
      window.CodeWikiApp?.openDoc?.(sp.doc_id, null, null, sp.section_id || null);
    });
    banner.querySelector('[data-spotlight-dismiss]')?.addEventListener('click', () => {
      dismissedSpotlightAt = sp.sent_at;
      lastSpotlightKey = 'off';
      banner.hidden = true;
    });
  }

  function closeDmModal() {
    if (dmKeydown) {
      document.removeEventListener('keydown', dmKeydown);
      dmKeydown = null;
    }
    const modal = document.getElementById('directMessageModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.innerHTML = '';
      modal.onclick = null;
    }
    activeDmId = null;
    const restore = dmPrevFocus;
    dmPrevFocus = null;
    if (restore && typeof restore.focus === 'function') {
      try { restore.focus(); } catch {}
    }
  }

  function flushDeferredModals() {
    if (session?.role !== 'student' || runtimeState.maintenance?.enabled) return;
    if (isOverlayOpen('authGateOverlay')) return;
    if (pendingLiveNotice?.id && !isOverlayOpen('siteNoticeModal')) {
      const notice = pendingLiveNotice;
      const shown = window.CodeWikiNotice?.showLiveNotice?.(notice, async noticeId => {
        const s = session;
        if (!s?.token) return false;
        const client = window.CodeWikiAuth?.getSupabaseClient?.();
        if (!client?.rpc) return false;
        const res = await client.rpc('cw_ack_notice', { p_token: s.token, p_notice_id: noticeId });
        return !res?.error && res?.data?.ok !== false;
      });
      if (shown) {
        pendingLiveNotice = null;
        return;
      }
      pendingLiveNotice = null;
    }
    if (!isOverlayOpen('siteNoticeModal')) showNextDm();
  }

  function showNextDm() {
    const modal = document.getElementById('directMessageModal');
    if (!modal || session?.role !== 'student' || runtimeState.maintenance?.enabled) return;
    if (isOverlayOpen('authGateOverlay') || isOverlayOpen('siteNoticeModal')) return;
    if (activeDmId || !dmQueue.length) return;
    const msg = dmQueue[0];
    if (!msg?.id) return;
    activeDmId = msg.id;
    dmPrevFocus = document.activeElement || null;
    const bodyHtml = esc(msg.body || '').replace(/\n/g, '<br>');
    modal.innerHTML = `
      <div class="toss-card site-notice-card dm-notice-card" role="dialog" aria-modal="true" aria-labelledby="dmNoticeTitle">
        <div class="site-notice-header">
          <div>
            <span class="site-notice-badge dm-badge">관리자 1:1 알림</span>
            <h2 id="dmNoticeTitle" class="site-notice-title">${esc(msg.title)}</h2>
          </div>
          <button type="button" id="dmCloseBtn" class="icon-btn" aria-label="알림 닫기">✕</button>
        </div>
        <div class="dm-notice-body">${bodyHtml}</div>
        <div class="site-notice-footer">
          <span class="site-notice-hint">${esc(formatKstTime(msg.created_at))}</span>
          <button type="button" id="dmConfirmBtn" class="toss-primary-btn site-notice-confirm-btn">확인</button>
        </div>
      </div>`;
    modal.classList.remove('hidden');

    const ack = () => {
      const s = session;
      const targetId = msg.id;
      ackedDmIds.add(targetId);
      dmQueue = dmQueue.filter(item => item.id !== targetId);
      closeDmModal();
      if (s?.token) {
        const client = window.CodeWikiAuth?.getSupabaseClient?.();
        Promise.resolve(client?.rpc?.('cw_ack_direct_message', { p_token: s.token, p_message_id: targetId }))
          .then(res => { if (res?.error) ackedDmIds.delete(targetId); })
          .catch(() => { ackedDmIds.delete(targetId); });
      }
      flushDeferredModals();
    };
    document.getElementById('dmCloseBtn')?.addEventListener('click', ack);
    document.getElementById('dmConfirmBtn')?.addEventListener('click', ack);
    modal.onclick = e => { if (e.target === modal) ack(); };
    dmKeydown = e => {
      if (e.key === 'Escape' && !isOverlayOpen('maintenanceOverlay')) {
        e.preventDefault();
        ack();
      }
    };
    document.addEventListener('keydown', dmKeydown);
    document.getElementById('dmConfirmBtn')?.focus?.();
  }

  function applyRuntimeState(data) {
    if (!data || typeof data !== 'object') return;
    runtimeState = {
      maintenance: data.maintenance || { enabled: false, message: '' },
      feature_flags: { ...DEFAULT_FLAGS, ...(data.feature_flags || {}) },
      spotlight: data.spotlight || { active: false, doc_id: '', section_id: '', label: '', message: '', sent_at: null }
    };
    renderMaintenance();
    applyFeatureFlags();
    renderSpotlight();

    if (session?.role === 'student' && data.student_tools && typeof data.student_tools === 'object') {
      window.CodeWikiAuth?.applyStudentTools?.(data.student_tools);
    }

    if (session?.role === 'student' && !runtimeState.maintenance?.enabled) {
      if (data.active_notice?.id) pendingLiveNotice = data.active_notice;
      if (Array.isArray(data.direct_messages) && data.direct_messages.length) {
        const known = new Set(dmQueue.map(m => m.id));
        for (const m of data.direct_messages) {
          if (m?.id && !known.has(m.id) && !ackedDmIds.has(m.id)) dmQueue.push(m);
        }
      }
      flushDeferredModals();
    }
  }

  function schedulePoll(s, delay = 90000) {
    clearTimeout(pollTimer);
    if (session === s && !s.stopped && !document.hidden && !syncUnsupported) {
      pollTimer = setTimeout(() => void syncNow(false), Math.max(5000, delay));
    }
  }

  async function syncNow(force = false) {
    const s = session;
    if (!s || s.stopped || syncUnsupported || s.role !== 'student') return;
    if (s.busy) {
      if (force) s.needsSync = true;
      return;
    }
    if (document.hidden && !force) return;
    const now = Date.now();
    if (!force && !s.needsSync && now - s.lastSyncAt < 25000) {
      schedulePoll(s, 90000 - (now - s.lastSyncAt));
      return;
    }
    s.needsSync = false;
    s.busy = true;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    s.controller = controller;
    let deadline;
    const ctx = resolveCurrentContext();
    try {
      const client = window.CodeWikiAuth?.getSupabaseClient?.();
      if (!client) return;
      const request = client.rpc('cw_client_sync', {
        p_token: s.token,
        p_doc_id: ctx.id,
        p_doc_label: ctx.label,
        p_device_type: getDeviceType(),
        p_client_id: getClientId()
      });
      const timeout = new Promise((_, reject) => {
        deadline = setTimeout(() => {
          controller?.abort?.();
          reject(Error('sync-timeout'));
        }, 15000);
      });
      const result = await Promise.race([
        controller && typeof request?.abortSignal === 'function' ? request.abortSignal(controller.signal) : request,
        timeout
      ]);
      if (session !== s) return;
      if (result.error) {
        if (result.error.code === 'PGRST202') {
          syncUnsupported = true;
          return;
        }
        if (result.error.code === '42501') {
          s.stopped = true;
          clearTimeout(pollTimer);
          teardownSignal();
          const adminLogout = result.error.details === 'CW_ADMIN_LOGOUT' || result.error.detail === 'CW_ADMIN_LOGOUT';
          if (adminLogout && typeof window.CodeWikiAuth?.handleForcedLogout === 'function') {
            window.CodeWikiAuth.handleForcedLogout('관리자에 의해 로그아웃되었습니다.');
          } else {
            void window.CodeWikiAuth?.refresh?.();
          }
          return;
        }
        return;
      }
      s.lastSyncAt = Date.now();
      applyRuntimeState(result.data);
    } catch {
      /* Transient network/timeout failures retry on next poll. */
    } finally {
      clearTimeout(deadline);
      s.busy = false;
      s.controller = null;
      if (session === s && !s.stopped) {
        schedulePoll(s, 90000);
        if (s.needsSync) void syncNow(true);
      }
    }
  }

  function sendEvent(type, target, meta = {}) {
    const s = session;
    if (!s || s.role !== 'student' || trackUnsupported) return;
    const cleanTarget = String(target || '').trim().slice(0, 200);
    if (!cleanTarget) return;
    const client = window.CodeWikiAuth?.getSupabaseClient?.();
    if (!client?.rpc) return;
    Promise.resolve(client.rpc('cw_track_event', {
      p_token: s.token,
      p_type: type,
      p_target: cleanTarget,
      p_meta: meta && typeof meta === 'object' ? meta : {},
      p_device_type: getDeviceType()
    })).then(res => {
      if (res?.error?.code === 'PGRST202') trackUnsupported = true;
    }).catch(() => {});
  }

  function flushDocStay() {
    if (!session || session.role !== 'student' || !currentDoc.id || !currentDoc.enteredAt) return;
    const elapsedSec = Math.round((Date.now() - currentDoc.enteredAt) / 1000);
    currentDoc.enteredAt = Date.now();
    if (elapsedSec >= 3 && elapsedSec <= 3600) {
      sendEvent('doc_stay', currentDoc.id, { duration_sec: elapsedSec });
    }
  }

  function trackDocView(docId, docTitle = '') {
    const id = String(docId || '').trim();
    if (!id) return;
    if (currentDoc.id && currentDoc.id !== id) flushDocStay();
    const changed = currentDoc.id !== id;
    currentDoc = { id, label: String(docTitle || id).slice(0, 120), enteredAt: Date.now() };
    if (!session || session.role !== 'student') return;
    if (changed) sendEvent('doc_view', id, {});
    clearTimeout(navSyncTimer);
    navSyncTimer = setTimeout(() => {
      if (session && !session.stopped) void syncNow(true);
    }, 900);
  }

  function trackSearch(query, resultCount) {
    clearTimeout(searchTimer);
    if (!session || session.role !== 'student') return;
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return;
    searchTimer = setTimeout(() => {
      if (!session || session.role !== 'student') return;
      sendEvent(Number(resultCount) > 0 ? 'search' : 'search_empty', q.slice(0, 80), {
        results: Math.max(0, Number(resultCount) || 0)
      });
    }, 1200);
  }

  function trackCodeCopy(docId) {
    if (!session || session.role !== 'student' || !docId) return;
    const now = Date.now();
    if (now - (recentCopies.get(docId) || 0) < 10000) return;
    recentCopies.set(docId, now);
    sendEvent('code_copy', docId, {});
  }

  function trackQuizAnswer(source, targetKey, label, correct) {
    if (!session || session.role !== 'student' || !targetKey) return;
    sendEvent('quiz_answer', String(targetKey).slice(0, 120), {
      source: String(source || 'quiz').slice(0, 40),
      label: String(label || targetKey).slice(0, 120),
      correct: Boolean(correct)
    });
  }

  function sanitizeErrorText(text) {
    return String(text || '')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[redacted]')
      .slice(0, 260);
  }

  function trackClientError(source, message) {
    if (!session || session.role !== 'student') return;
    const clean = sanitizeErrorText(message);
    if (!clean) return;
    const now = Date.now();
    for (const [key, ts] of recentErrors) {
      if (now - ts > 60000) recentErrors.delete(key);
    }
    if (recentErrors.has(clean) || recentErrors.size >= 5) return;
    recentErrors.set(clean, now);
    const page = sanitizeErrorText(window.location?.hash || '#home').slice(0, 140);
    sendEvent('client_error', page, { source: String(source || 'error').slice(0, 40), message: clean });
  }

  function trackSecurityProbe(kind, target) {
    if (!session || session.role !== 'student') return;
    const cleanKind = String(kind || 'probe').trim().slice(0, 40);
    const cleanTarget = sanitizeErrorText(target || window.location?.hash || '').slice(0, 120);
    if (!cleanTarget) return;
    const now = Date.now();
    const key = `${cleanKind}|${cleanTarget}`;
    if (now - (recentProbes.get(key) || 0) < 15000) return;
    recentProbes.set(key, now);
    sendEvent('security_probe', cleanTarget, { kind: cleanKind });
  }

  function setUser(user) {
    const token = window.CodeWikiAuth?.getSessionToken?.() || '';
    if (session && user && session.id === user.id && session.token === token && session.role === user.role && session.status === user.status) {
      return;
    }
    flushDocStay();
    clearTimeout(pollTimer); clearTimeout(navSyncTimer); clearTimeout(searchTimer);
    session?.controller?.abort?.();
    teardownSignal();
    closeDmModal();
    clearFeatureFlagClasses();
    dmQueue = [];
    ackedDmIds.clear();
    recentCopies.clear();
    recentErrors.clear();
    recentProbes.clear();
    pendingLiveNotice = null;
    currentDoc = { id: '', label: '', enteredAt: 0 };
    dismissedSpotlightAt = null;
    lastMaintenanceKey = '';
    lastSpotlightKey = '';
    runtimeState = {
      maintenance: { enabled: false, message: '' },
      feature_flags: { ...DEFAULT_FLAGS },
      spotlight: { active: false, doc_id: '', section_id: '', label: '', message: '', sent_at: null }
    };
    session = null;
    renderMaintenance();
    renderSpotlight();

    // Only approved student sessions need runtime control sync & anonymous telemetry.
    if (token && user?.role === 'student' && user.status === 'approved') {
      session = {
        id: user.id,
        role: user.role,
        status: user.status,
        token,
        lastSyncAt: 0,
        wakeAt: 0,
        needsSync: false,
        busy: false,
        stopped: false,
        controller: null
      };
      setupSignal(session);
      void syncNow(true);
    }
  }

  function isFeatureEnabled(key) {
    if (!session || session.role !== 'student') return true;
    return runtimeState.feature_flags?.[key] !== false;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      flushDocStay();
      clearTimeout(pollTimer);
    } else if (session && !session.stopped) {
      if (currentDoc.id) currentDoc.enteredAt = Date.now();
      void syncNow(true);
    }
  });

  window.addEventListener('hashchange', () => {
    if (!session || session.role !== 'student') return;
    applyFeatureFlags();
    const h = String(window.location?.hash || '');
    if (h.startsWith('#admin/')) {
      trackSecurityProbe('admin_route_probe', h);
    }
    if (!h.startsWith('#doc/')) {
      flushDocStay();
      const ctx = resolveCurrentContext();
      currentDoc = { id: ctx.id, label: ctx.label, enteredAt: Date.now() };
      clearTimeout(navSyncTimer);
      navSyncTimer = setTimeout(() => { if (session && !session.stopped) void syncNow(true); }, 900);
    }
  });

  window.addEventListener('cw-notice-closed', flushDeferredModals);
  window.addEventListener('cw-workspace-ready', flushDeferredModals);

  window.addEventListener('error', event => {
    const msg = event?.message || event?.error?.message || '';
    if (msg) trackClientError('window.error', msg);
  });

  window.addEventListener('unhandledrejection', event => {
    const reason = event?.reason;
    const msg = typeof reason === 'string' ? reason : (reason?.message || '');
    if (msg && !/aborted|abort/i.test(msg)) trackClientError('unhandledrejection', msg);
  });

  window.CodeWikiTelemetry = {
    setUser,
    syncNow,
    notifyRuntimeUpdate,
    trackDocView,
    trackSearch,
    trackCodeCopy,
    trackQuizAnswer,
    trackClientError,
    trackSecurityProbe,
    isFeatureEnabled,
    getFeatureFlags: () => ({ ...runtimeState.feature_flags }),
    getClientId,
    getDeviceType
  };
})();
