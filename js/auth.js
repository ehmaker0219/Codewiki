/**
 * ============================================================================
 * [코드위키 자체 인증 & 수동 승인 시스템: js/auth.js]
 * ----------------------------------------------------------------------------
 * - 구글 로그인이나 이메일 인증을 전혀 사용하지 않는 100% 사이트 내부 전용 로직입니다.
 * - 가입 시 6반은 이름·출석번호를 서버 명단과 대조하며, 모든 반은 관리자 승인 후 열람됩니다.
 * - 추후 다른 반으로 확장될 때를 대비해 소속 반 구분 태그 및 반별 필터를 지원합니다.
 * ============================================================================
 */
(function () {
  const SUPABASE_URL = "https://sqsvecjixslleecobunq.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_XXOOYP_L3cxHLqpgkj0b2Q_p8Kcqviu";

  const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  let supabaseClient = null;

  if (isSupabaseConfigured && window.supabase) {
    // CodeWiki authenticates through its own expiring RPC token, not Supabase
    // Auth sessions. Avoid unrelated Auth storage/refresh locks on every RPC.
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      accessToken: async () => null
    });
  }

  // Remove old local demo credentials without reading or displaying their contents.
  try {
    localStorage.removeItem('codewiki_custom_users_v1');
    localStorage.removeItem('codewiki_custom_session_v1');
  } catch { /* Storage can be unavailable; never enable a local login fallback. */ }
  const secureAuth = window.CodeWikiSecureAuth?.create({url:SUPABASE_URL, apiKey:SUPABASE_ANON_KEY});
  const credentialOperations = new Set(['cw_login','cw_signup_with_roster','cw_admin_reset_student_password']);
  const SUPA_TOKEN_KEY = "codewiki_supa_token_v1";

  // Bound both fetch and adapters that ignore abort. A late response must never
  // resume a timed-out submission; timers are released on every outcome.
  async function authRpc(name, args) {
    const start = signal => credentialOperations.has(name)
      ? secureAuth ? secureAuth.request(name, args, {signal}) : Promise.reject(Error('secure-auth-unavailable'))
      : supabaseClient ? supabaseClient.rpc(name, args) : Promise.reject(Error('supabase-unavailable'));
    if (typeof AbortController !== 'function' || typeof setTimeout !== 'function') {
      return await start(undefined);
    }
    const controller = new AbortController();
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error('auth-timeout'), {code:'TIMEOUT'}));
          controller.abort();
        }, 15000);
      });
      const request = start(controller.signal);
      return await Promise.race([
        typeof request?.abortSignal === 'function' ? request.abortSignal(controller.signal) : request,
        timeout
      ]);
    } finally { clearTimeout(timer); }
  }

  function getSupaToken() {
    try { return localStorage.getItem(SUPA_TOKEN_KEY) || ""; } catch { return ""; }
  }

  function setSupaToken(token) {
    try {
      if (token) {
        localStorage.setItem(SUPA_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(SUPA_TOKEN_KEY);
      }
    } catch {}
  }

  let logoutPending = false;
  async function logout() {
    if (logoutPending) return;
    logoutPending = true;
    try {
      const token = getSupaToken();
      if (token) {
        const { error } = await authRpc("cw_logout", { p_token: token });
        if (error) throw error;
      }
      if (getSupaToken() !== token) {
        await renderAuthState();
        if (getSupaToken()) window.alert("다른 탭에서 로그인 상태가 변경되었습니다. 로그아웃을 다시 눌러 주세요.");
        return;
      }
      setSupaToken("");
      activeUserCache = null;
      syncUserFeatures(null);
      document.getElementById("boardWriteModal")?.classList.add("hidden");
      await renderAuthState();
    } catch (error) {
      // Retain the token so revocation can be retried; do not claim logout succeeded.
      window.alert("서버에서 로그아웃하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      logoutPending = false;
    }
  }

  function escapeHtml(str) {
    if (window.CodeWikiLearning?.escape) return window.CodeWikiLearning.escape(str ?? "");
    return String(str ?? "")
      .replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const authGateOverlay = document.getElementById("authGateOverlay");
  const forcedLogoutModal = document.getElementById("forcedLogoutModal");
  const adminSidebarSlot = document.getElementById("adminSidebarSlot");
  const sidebarProfileSlot = document.getElementById("sidebarProfileSlot");

  let authFormMode = "login"; // 'login' | 'signup'
  let authMessage = "";
  let activeUserCache = null;
  let authStateVersion = 0;
  let forcedLogoutKeydown = null;
  let adminPreviewMode = false;
  let adminPreviewStudent = null;
  let adminPreviewRoster = [];
  let adminPreviewRosterLoading = false;
  let adminPreviewRosterVersion = 0;

  function normalizePreviewStudent(stu) {
    if (!stu || typeof stu !== "object" || !stu.id) return null;
    const tools = stu.tools && typeof stu.tools === "object"
      ? {
          mentoring: typeof stu.tools.mentoring === "boolean" ? stu.tools.mentoring : undefined,
          foundation: typeof stu.tools.foundation === "boolean" ? stu.tools.foundation : undefined
        }
      : null;
    return {
      id: String(stu.id),
      full_name: String(stu.full_name || ""),
      username: String(stu.username || ""),
      class_name: String(stu.class_name || "기본반"),
      status: "approved",
      tools
    };
  }

  function previewTagsFor(student) {
    if (!student || !student.id) return [];
    const tags = [];
    const hasMentoring = typeof student.tools?.mentoring === "boolean"
      ? student.tools.mentoring
      : Boolean(window.CodeWikiMentoringModel?.staticMember ? window.CodeWikiMentoringModel.staticMember(student.id) : window.CodeWikiMentoringModel?.member?.(student.id));
    const hasFoundation = typeof student.tools?.foundation === "boolean"
      ? student.tools.foundation
      : window.CodeWikiFoundation?.OWNER_ID === student.id;
    if (hasMentoring) tags.push("멘토링");
    if (hasFoundation) tags.push("파운데이션");
    return tags;
  }

  function setAdminPreviewRoster(list) {
    const prev = Array.isArray(list) ? list : [];
    adminPreviewRoster = prev
      .filter(u => u && u.id && u.status === "approved")
      .map(normalizePreviewStudent)
      .filter(Boolean)
      .sort((a, b) =>
        a.class_name.localeCompare(b.class_name, "ko", { numeric: true }) ||
        a.full_name.localeCompare(b.full_name, "ko", { numeric: true }) ||
        a.username.localeCompare(b.username, "ko")
      );
    if (adminPreviewStudent) {
      const fresh = adminPreviewRoster.find(s => s.id === adminPreviewStudent.id);
      if (fresh) adminPreviewStudent = fresh;
    }
    if (adminPreviewMode && activeUserCache?.role === "admin") {
      renderAdminPreviewBanner(true);
    }
  }

  async function ensurePreviewRosterLoaded() {
    if (adminPreviewRoster.length || adminPreviewRosterLoading || activeUserCache?.role !== "admin") return;
    const token = getSupaToken();
    if (!token || !supabaseClient) return;
    const ver = ++adminPreviewRosterVersion;
    adminPreviewRosterLoading = true;
    renderAdminPreviewBanner(true);
    try {
      const { data, error } = await authRpc("cw_admin_student_directory", { p_token: token });
      if (ver !== adminPreviewRosterVersion || getSupaToken() !== token || activeUserCache?.role !== "admin") return;
      if (!error && Array.isArray(data)) setAdminPreviewRoster(data);
    } catch {}
    finally {
      if (ver === adminPreviewRosterVersion) {
        adminPreviewRosterLoading = false;
        if (adminPreviewMode && activeUserCache?.role === "admin") renderAdminPreviewBanner(true);
      }
    }
  }

  function syncStudySidebarSlot(user, previewing) {
    const studySidebarSlot = document.getElementById("studySidebarSlot");
    if (!studySidebarSlot) return;
    const show = Boolean(user && ((user.role === "student" && user.status === "approved") || previewing));
    studySidebarSlot.innerHTML = show
      ? `<a href="#study" id="openStudyBtn" class="sb-menu-item${window.location.hash === "#study" ? " active" : ""}"><svg class="sb-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="15" height="17" rx="2"></rect><path d="M9 2v4M16 2v4M3 9h4M3 14h4M3 19h4M10 10h6M10 14h6M10 18h4"></path></svg><span>내 공부방</span></a>`
      : "";
  }

  function renderAdminPreviewBanner(active) {
    const banner = document.getElementById("adminPreviewBanner");
    if (!banner) return;
    if (!active) {
      banner.hidden = true;
      banner.innerHTML = "";
      return;
    }
    const target = adminPreviewStudent;
    const tags = previewTagsFor(target);
    const options = [...adminPreviewRoster];
    if (target && !options.some(s => s.id === target.id)) options.unshift(target);
    const optionHtml = options.map(stu => {
      const t = previewTagsFor(stu);
      const suffix = t.length ? ` [${t.join(" · ")}]` : "";
      const selected = target?.id === stu.id ? " selected" : "";
      return `<option value="${escapeHtml(stu.id)}"${selected}>${escapeHtml(stu.class_name)} · ${escapeHtml(stu.full_name)}${stu.username ? ` (@${escapeHtml(stu.username)})` : ""}${escapeHtml(suffix)}</option>`;
    }).join("");
    const titleHtml = target
      ? `<strong>${escapeHtml(target.full_name)}</strong> (${escapeHtml(target.class_name)}) 화면 미리보기 중${tags.map(t => ` <span class="admin-preview-pill">${escapeHtml(t)}</span>`).join("")}`
      : `<strong>일반 학생 (기본)</strong> 화면 미리보기 중`;
    banner.innerHTML = `<div class="admin-preview-inner"><span class="admin-preview-info">${titleHtml}</span><div class="admin-preview-controls"><label class="admin-preview-picker"><span>대상 학생</span><select id="adminPreviewStudentSelect" aria-label="미리보기 대상 학생 선택"><option value=""${!target ? " selected" : ""}>일반 학생 (기본)</option>${optionHtml}${adminPreviewRosterLoading && !options.length ? '<option disabled>학생 목록 불러오는 중…</option>' : ""}</select></label><button type="button" id="exitAdminPreviewBtn" class="toss-primary-btn">관리자 콘솔로 돌아가기</button></div></div>`;
    banner.hidden = false;
    document.getElementById("adminPreviewStudentSelect")?.addEventListener("change", e => {
      const nextId = e.target.value;
      const found = nextId ? options.find(s => s.id === nextId) || null : null;
      setAdminPreviewMode(true, found);
    });
    document.getElementById("exitAdminPreviewBtn")?.addEventListener("click", () => setAdminPreviewMode(false));
  }

  function setAdminPreviewMode(enabled, targetOrStudent = undefined) {
    if (activeUserCache?.role !== "admin") return false;
    const next = Boolean(enabled);
    if (next) {
      if (targetOrStudent !== undefined) {
        adminPreviewStudent = normalizePreviewStudent(targetOrStudent);
      }
      const entering = !adminPreviewMode;
      adminPreviewMode = true;
      if (entering) {
        window.CodeWikiAdminMembers?.leave?.();
        syncUserFeatures(activeUserCache);
        void ensurePreviewRosterLoaded();
        window.CodeWikiApp?.openDoc?.("welcome-abap");
      } else {
        const prevHash = window.location.hash;
        syncUserFeatures(activeUserCache);
        void ensurePreviewRosterLoaded();
        if (prevHash !== window.location.hash && window.location.hash.startsWith("#doc/")) {
          window.CodeWikiApp?.openDoc?.("welcome-abap");
        }
      }
      return true;
    }
    if (!adminPreviewMode && typeof targetOrStudent !== "string") return false;
    const targetHash = typeof targetOrStudent === "string" && targetOrStudent.startsWith("#admin/")
      ? targetOrStudent
      : "#admin/students";
    adminPreviewMode = false;
    adminPreviewStudent = null;
    window.CodeWikiKnowledgeMap?.leave?.();
    window.CodeWikiObjectGame?.leave?.();
    window.CodeWikiFoundation?.leave?.();
    window.CodeWikiMentoring?.leave?.();
    window.CodeWikiStudy?.leave?.();
    history.replaceState(null, "", targetHash);
    syncUserFeatures(activeUserCache);
    if (!window.CodeWikiAdminMembers?.openRoute?.(targetHash)) {
      window.CodeWikiAdminMembers?.openHome?.();
    }
    return false;
  }

  function closeForcedLogoutPopup() {
    if (forcedLogoutKeydown) {
      document.removeEventListener?.("keydown", forcedLogoutKeydown);
      forcedLogoutKeydown = null;
    }
    if (forcedLogoutModal) {
      forcedLogoutModal.classList.add("hidden");
      forcedLogoutModal.innerHTML = "";
    }
  }

  function showForcedLogoutPopup(message = "관리자에 의해 로그아웃되었습니다.") {
    if (!forcedLogoutModal) return;
    closeForcedLogoutPopup();
    forcedLogoutModal.innerHTML = `
      <div class="toss-card forced-logout-card" role="alertdialog" aria-modal="true" aria-labelledby="forcedLogoutTitle">
        <div class="forced-logout-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </div>
        <h2 id="forcedLogoutTitle" class="forced-logout-title">${escapeHtml(message)}</h2>
        <p class="forced-logout-desc">사이트 업데이트 또는 세션 정리를 위해 접속이 종료되었습니다.<br>다시 로그인해 이용해 주세요.</p>
        <button type="button" id="forcedLogoutConfirmBtn" class="toss-primary-btn forced-logout-confirm-btn">로그인 화면으로</button>
      </div>
    `;
    forcedLogoutModal.classList.remove("hidden");
    const confirmBtn = document.getElementById("forcedLogoutConfirmBtn");
    confirmBtn?.addEventListener?.("click", closeForcedLogoutPopup);
    forcedLogoutModal.onclick = e => {
      if (e.target === forcedLogoutModal) closeForcedLogoutPopup();
    };
    forcedLogoutKeydown = e => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeForcedLogoutPopup();
      }
    };
    document.addEventListener?.("keydown", forcedLogoutKeydown);
    confirmBtn?.focus?.();
  }

  function handleForcedLogout(message = "관리자에 의해 로그아웃되었습니다.") {
    if (!getSupaToken() && !activeUserCache) return;
    authStateVersion++;
    authFormMode = "login";
    authMessage = "";
    setSupaToken("");
    activeUserCache = null;
    syncUserFeatures(null);
    document.getElementById("boardWriteModal")?.classList.add("hidden");
    document.body.classList.remove("authenticated");
    authGateOverlay?.classList.remove("hidden");
    renderPreLoginLanding(message);
    showForcedLogoutPopup(message);
  }

  // Authentication owns session propagation; feature modules don't control each other.
  function syncUserFeatures(user) {
    const isAdmin = user?.role === 'admin';
    if (!isAdmin) {
      adminPreviewMode = false;
      adminPreviewStudent = null;
      adminPreviewRoster = [];
      adminPreviewRosterLoading = false;
      adminPreviewRosterVersion++;
    }
    const previewing = isAdmin && adminPreviewMode;
    document.body.classList[isAdmin && !previewing ? 'add' : 'remove']('admin-workspace');
    document.body.classList[previewing ? 'add' : 'remove']('admin-preview-mode');
    renderAdminPreviewBanner(previewing);
    const operationsLabel = document.getElementById('adminOperationsLabel');
    if (operationsLabel) operationsLabel.hidden = !isAdmin;
    const isApprovedStudent = user?.role === 'student' && user.status === 'approved';
    const canViewStudentUi = isApprovedStudent || previewing;
    const thinkingFlow = document.getElementById('sbThinkingFlowItem');
    if (thinkingFlow) thinkingFlow.hidden = !canViewStudentUi;
    const programCatalog = document.getElementById('sbProgramCatalogItem');
    if (programCatalog) programCatalog.hidden = !canViewStudentUi;
    const basicSession = document.getElementById('sbBasicSessionItem');
    if (basicSession) basicSession.hidden = !canViewStudentUi;
    const sqlGuide = document.getElementById('sbSqlGuideItem');
    if (sqlGuide) sqlGuide.hidden = !canViewStudentUi;
    const learningContents = document.getElementById('learningContentsGroup');
    if (learningContents) learningContents.hidden = !canViewStudentUi;
    const learningTools = document.getElementById('learningToolsGroup');
    if (learningTools) learningTools.hidden = !canViewStudentUi;
    syncStudySidebarSlot(user, previewing);
    if (!user) {
      if (adminSidebarSlot) adminSidebarSlot.innerHTML = "";
      if (sidebarProfileSlot) sidebarProfileSlot.innerHTML = "";
    }
    window.CodeWikiBoard?.setUser?.(user);
    window.CodeWikiProfile?.setUser(user);
    window.CodeWikiProgress?.setUser(user);
    window.CodeWikiBirthdays?.setUser(user);
    window.CodeWikiStudy?.setUser(user);
    window.CodeWikiMentoring?.setUser(user);
    window.CodeWikiFoundation?.setUser?.(user);
    window.CodeWikiPractice?.setUser(user);
    window.CodeWikiObjectGame?.setUser(user);
    window.CodeWikiKnowledgeMap?.setUser?.(user);
    window.CodeWikiSqlPractice?.setUser?.(user);
    window.CodeWikiAdminMembers?.setUser(user);
    window.CodeWikiPresence?.setUser(user);
    window.CodeWikiTelemetry?.setUser?.(user);
    window.CodeWikiNotice?.setUser?.(user);
    window.CodeWikiApp?.syncAccess?.();
  }
  syncUserFeatures(null);

  window.CodeWikiAuth = {
    getCurrentUser: () => activeUserCache,
    getSessionToken: () => getSupaToken(),
    isSupabaseConfigured: () => isSupabaseConfigured,
    getSupabaseClient: () => supabaseClient,
    isAdminPreviewMode: () => Boolean(activeUserCache?.role === "admin" && adminPreviewMode),
    getAdminPreviewStudent: () => (activeUserCache?.role === "admin" && adminPreviewMode && adminPreviewStudent ? { ...adminPreviewStudent } : null),
    setAdminPreviewMode,
    setAdminPreviewRoster,
    logout,
    handleForcedLogout,
    refresh: () => renderAuthState(),
    credentialRequest: (name,args) => {
      if (!credentialOperations.has(name)) return Promise.reject(Error('unsupported-auth-operation'));
      return authRpc(name,args);
    },
    applyStudentTools: tools => {
      if (!activeUserCache || activeUserCache.role !== "student" || activeUserCache.status !== "approved" || !tools || typeof tools !== "object") return;
      const prev = activeUserCache.tools || {};
      const next = {
        mentoring: typeof tools.mentoring === "boolean" ? tools.mentoring : Boolean(prev.mentoring),
        foundation: typeof tools.foundation === "boolean" ? tools.foundation : Boolean(prev.foundation)
      };
      if (prev.mentoring === next.mentoring && prev.foundation === next.foundation && activeUserCache.tools) return;
      const prevHash = window.location.hash;
      activeUserCache = { ...activeUserCache, tools: next };
      window.CodeWikiMentoring?.setUser?.(activeUserCache);
      window.CodeWikiFoundation?.setUser?.(activeUserCache);
      if (prevHash !== window.location.hash && window.location.hash.startsWith("#doc/")) {
        window.CodeWikiApp?.openDoc?.("welcome-abap");
      }
    },
    applyProfile: profile => {
      if (!activeUserCache || activeUserCache.id !== profile.id) return;
      activeUserCache = {...activeUserCache, full_name:profile.full_name, mbti:profile.mbti};
      renderTopbarAuthControls(activeUserCache, activeUserCache.pending_count || 0);
      window.CodeWikiStudy?.setUser(activeUserCache);
    }
  };

  function showApprovedWorkspace(user, pendingCount) {
    document.body.classList.add("authenticated");
    authGateOverlay.classList.add("hidden");
    renderTopbarAuthControls(user, pendingCount);
    if (window.CodeWikiBoard) window.CodeWikiBoard.refreshBadge();
    window.CodeWikiNotice?.maybeShow?.(user);
    if (typeof Event === "function") window.dispatchEvent?.(new Event("cw-workspace-ready"));
    window.scrollTo({ top: 0 });
  }

  async function renderAuthState() {
    const version = ++authStateVersion;
    if (!isSupabaseConfigured || !supabaseClient) {
      activeUserCache = null;
      syncUserFeatures(null);
      document.body.classList.remove('authenticated');
      authGateOverlay.classList.remove('hidden');
      authGateOverlay.innerHTML = '<div class="auth-container"><div class="auth-card"><h2>로그인 서버에 연결할 수 없습니다.</h2><p>연결을 확인한 뒤 새로고침해 주세요.</p></div></div>';
      return;
    }

    // 2) Supabase 자체 DB 연동 모드 (구글/이메일 없이 세션 토큰으로 검증)
    const token = getSupaToken();
    if (!token) {
      activeUserCache = null;
      syncUserFeatures(null);
      document.body.classList.remove("authenticated");
      authGateOverlay.classList.remove("hidden");
      renderPreLoginLanding();
      return;
    }

    if (!activeUserCache) {
      authGateOverlay.classList.remove('hidden');
      authGateOverlay.innerHTML = `<div class="auth-container"><div class="auth-card" role="status">
        <h2 class="auth-status-title">로그인 확인 중</h2>
        <p class="auth-desc">저장된 로그인 정보를 확인하고 있습니다.</p>
      </div></div>`;
    }
    let profile, error;
    try {
      ({ data: profile, error } = await authRpc("cw_me", { p_token: token }));
    } catch (cause) {
      error = cause;
    }

    // Ignore a response from a session that was logged out or replaced while awaiting RPC.
    if (getSupaToken() !== token || version !== authStateVersion) return;

    if (error) {
      // A failed request does not prove that the saved session has expired.
      activeUserCache = null;
      syncUserFeatures(null);
      document.body.classList.remove("authenticated");
      authGateOverlay.classList.remove("hidden");
      authGateOverlay.innerHTML = `<div class="auth-container"><div class="auth-card">
        <h2 class="auth-status-title">로그인 상태를 확인하지 못했습니다</h2>
        <p class="auth-desc">연결을 확인한 뒤 다시 시도해 주세요.</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px;">
          <button type="button" id="retrySessionBtn" class="toss-primary-btn">다시 시도</button>
          <button type="button" id="resetSessionBtn" class="toss-chip-btn" style="width:100%;justify-content:center;height:44px;">다른 계정으로 로그인</button>
        </div>
      </div></div>`;
      document.getElementById("retrySessionBtn").addEventListener("click", () => void renderAuthState());
      document.getElementById("resetSessionBtn").addEventListener("click", () => {
        setSupaToken("");
        activeUserCache = null;
        void renderAuthState();
      });
      return;
    }

    if (profile?.forced_logout) {
      handleForcedLogout("관리자에 의해 로그아웃되었습니다.");
      return;
    }

    if (!profile) {
      setSupaToken("");
      activeUserCache = null;
      syncUserFeatures(null);
      document.body.classList.remove("authenticated");
      authGateOverlay.classList.remove("hidden");
      renderPreLoginLanding();
      return;
    }

    closeForcedLogoutPopup();
    activeUserCache = profile;
    syncUserFeatures(profile);

    if (profile.status !== "approved" && profile.role !== "admin") {
      document.body.classList.remove("authenticated");
      authGateOverlay.classList.remove("hidden");
      renderPendingGate(profile);
      return;
    }

    showApprovedWorkspace(profile, profile.pending_count || 0);
  }

  // 좌측 사이드바 내 [학생 승인 관리 메뉴] + [하단 유저 프로필 카드]
  function renderTopbarAuthControls(user, pendingCount) {
    if (!user) return;
    const isAdmin = user.role === "admin";
    const securityAlerts = Number(user.security_alert_count) || 0;
    syncStudySidebarSlot(user, isAdmin && adminPreviewMode);

    if (adminSidebarSlot) {
      adminSidebarSlot.innerHTML = (isAdmin || (user.role === 'student' && user.status === 'approved'))
        ? `
        ${isAdmin ? `<div class="sb-group-label">학생 관리</div><a href="#admin/students" id="openStudentDirectoryBtn" class="sb-menu-item${window.location.hash === '#admin/students' ? ' active' : ''}"><svg class="sb-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M6 17v-1a3 3 0 0 1 6 0v1M15 8h3M15 12h3M15 16h3"/></svg><span>학생 정보</span></a><a href="#admin/accounts" id="openStudentAccountsBtn" class="sb-menu-item${window.location.hash === '#admin/accounts' ? ' active' : ''}"><svg class="sb-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M3 20v-1a5 5 0 0 1 10 0v1"/><circle cx="17.5" cy="14.5" r="2.5"/><path d="M17.5 10.5v1.5M17.5 17v1.5M13.5 14.5H15M20 14.5h1.5"/></svg><span>계정 관리</span></a><a href="#admin/approvals" id="openAdminModalBtn" class="sb-menu-item${window.location.hash === '#admin/approvals' ? ' active' : ''}"><svg class="sb-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg><span>학생 승인 관리</span><span id="adminPendingCountBadge" class="pending-badge" style="margin-left:auto;"${pendingCount > 0 ? '' : ' hidden'}>${pendingCount > 0 ? pendingCount : ''}</span></a><a href="#admin/logins" id="openLoginHistoryBtn" class="sb-menu-item${window.location.hash === '#admin/logins' ? ' active' : ''}"><svg class="sb-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg><span>로그인 내역</span></a><div class="sb-group-label" style="margin-top:12px;">공지 · 알림</div><a href="#admin/notices" id="openAdminNoticesBtn" class="sb-menu-item${window.location.hash === '#admin/notices' ? ' active' : ''}"><svg class="sb-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span>공지 · 1:1 알림</span></a><div class="sb-group-label" style="margin-top:12px;">운영 관제실</div><a href="#admin/dashboard" id="openAdminDashboardBtn" class="sb-menu-item${window.location.hash === '#admin/dashboard' ? ' active' : ''}"><svg class="sb-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg><span>출석부</span></a><a href="#admin/insights" id="openAdminInsightsBtn" class="sb-menu-item${window.location.hash === '#admin/insights' ? ' active' : ''}"><svg class="sb-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 20V10M12 20V4M6 20v-6"/></svg><span>학습 분석</span></a><a href="#admin/controls" id="openAdminControlsBtn" class="sb-menu-item${window.location.hash === '#admin/controls' ? ' active' : ''}"><svg class="sb-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="2" y1="14" x2="6" y2="14"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="18" y1="16" x2="22" y2="16"/></svg><span>원격 제어</span></a><a href="#admin/security" id="openAdminSecurityBtn" class="sb-menu-item${window.location.hash === '#admin/security' ? ' active' : ''}"><svg class="sb-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>보안 검사</span><span id="adminSecurityAlertBadge" class="pending-badge" style="margin-left:auto;"${securityAlerts > 0 ? '' : ' hidden'}>${securityAlerts > 0 ? securityAlerts : ''}</span></a>` : ''}
      `
        : "";

      ["openStudentDirectoryBtn", "openStudentAccountsBtn", "openAdminModalBtn", "openLoginHistoryBtn", "openAdminNoticesBtn", "openAdminDashboardBtn", "openAdminInsightsBtn", "openAdminControlsBtn", "openAdminSecurityBtn"].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener("click", e => {
          if (adminPreviewMode) {
            e.preventDefault();
            setAdminPreviewMode(false, el.getAttribute("href") || "#admin/students");
          }
        });
      });
    }

    if (sidebarProfileSlot) {
      sidebarProfileSlot.innerHTML = `
        <div class="sb-profile-card sb-profile-simple"><span class="sb-profile-name">${escapeHtml(user.full_name)}</span>
        <button type="button" id="profileSettingsBtn" class="sb-profile-settings"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg><span>프로필 설정</span></button>
        </div>
      `;
      document.getElementById("profileSettingsBtn")?.addEventListener("click", () => window.CodeWikiProfile?.openSettings());
    }
  }

  // [로그인 전 랜딩페이지]: 블루 톤 유지 + 미니멀 폼/컨트롤 배치 (상단 단독 심볼, 플레이스홀더 입력창, 눈 아이콘, 하단 좌우 밑줄 링크)
  function renderPreLoginLanding(infoNotice = "") {
    const isSignup = authFormMode === "signup";

    const eyeOpenSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
    const eyeOffSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    `;

    authGateOverlay.innerHTML = `
      <div class="cw-auth-minimal">
        <div class="cw-auth-logo" aria-label="코드위키">
          <svg width="48" height="48" viewBox="0 0 120 120" fill="currentColor">
            <path d="M12 12 H54 V54 H41 V40 H15 V28.5 H41 V23.5 H12 Z" />
            <path d="M66 12 H108 V25 H79 V41 H108 V54 H66 Z" />
            <path fill-rule="evenodd" clip-rule="evenodd" d="M33 66 A21 21 0 1 0 33 108 A21 21 0 1 0 33 66 Z M33 79 A8 8 0 1 1 33 95 A8 8 0 1 1 33 79 Z" />
            <path d="M66 66 H108 V108 H95 V94 H69 V82.5 H95 V77.5 H66 Z" />
          </svg>
        </div>

        <h1 class="cw-auth-heading">${isSignup ? "코드위키 계정 만들기" : "코드위키에 로그인"}</h1>

        ${authMessage ? `<div class="auth-alert" style="width:100%; text-align:center;">${escapeHtml(authMessage)}</div>` : ""}
        ${infoNotice ? `<div class="cw-auth-notice">${escapeHtml(infoNotice)}</div>` : ""}

        <form id="authGateForm" class="cw-auth-form">
          ${
            isSignup
              ? `
            <div class="cw-input-wrap cw-auth-name-row">
              <input type="text" id="authFullName" class="cw-minimal-input" placeholder="이름" aria-label="이름" autocomplete="name" required />
              <input type="number" id="authStudentNumber" class="cw-minimal-input" placeholder="출석번호" aria-label="6반 출석번호" inputmode="numeric" min="1" max="30" step="1" required />
            </div>

            <div class="cw-auth-date-row">
              <label for="authBirthDate">생년월일</label>
              <input id="authBirthDate" class="cw-minimal-input is-empty" type="date" min="1900-01-01" max="${window.CodeWikiBirthdays.today()}" autocomplete="bday" />
            </div>

            <div class="cw-picker-box">
              <div class="cw-picker-header">
                <span>소속 반</span>
                <span id="classPreviewText" style="color:var(--toss-blue); ">6반</span>
              </div>
              <input type="hidden" id="authClassName" value="6반" />
              <div id="classPickerGrid" style="display:grid; grid-template-columns:repeat(7, 1fr); gap:5px;">
                ${[1, 2, 3, 4, 5, 6, 7]
                  .map(
                    num => `
                  <button
                    type="button"
                    data-class-val="${num}반"
                    style="border:none; border-radius:8px; height:32px; cursor:pointer; transition:all 0.14s;"
                  >${num}반</button>
                `
                  )
                  .join("")}
              </div>
            </div>

            <div class="cw-picker-box">
              <div class="cw-picker-header">
                <span>MBTI</span>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span id="mbtiPreviewBadge" class="toss-badge-blue" style="padding:2px 7px;">ENFP</span>
                  <button type="button" id="mbtiSkipBtn" style="border:none; background:none; color:var(--text-muted); cursor:pointer; text-decoration:underline; padding:0;">잘 모름</button>
                </div>
              </div>
              <input type="hidden" id="authMbti" value="ENFP" />
              <div id="mbtiPickerGrid" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;">
                ${[
                  ["E", "I"],
                  ["S", "N"],
                  ["T", "F"],
                  ["J", "P"]
                ]
                  .map(
                    (pair, idx) => `
                  <div style="display:grid; grid-template-columns:1fr 1fr; background:var(--bg-subtle); border-radius:8px; padding:2.5px; gap:2px;">
                    ${pair
                      .map(
                        ch => `
                      <button
                        type="button"
                        data-mbti-slot="${idx}"
                        data-mbti-char="${ch}"
                        style="border:none; border-radius:6px; height:28px; cursor:pointer; transition:all 0.14s;"
                      >${ch}</button>
                    `
                      )
                      .join("")}
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }

          <div class="cw-input-wrap">
            <input
              type="text"
              id="authUsername"
              class="cw-minimal-input"
              placeholder="${isSignup ? "사용할 아이디 (2자 이상)" : "아이디"}"
              autocomplete="username"
              required
            />
          </div>

          <div class="cw-input-wrap">
            <input
              type="password"
              id="authPassword"
              class="cw-minimal-input has-eye"
              placeholder="${isSignup ? "비밀번호 (8자 이상)" : "비밀번호"}"
              ${isSignup ? 'minlength="8"' : ''}
              autocomplete="${isSignup ? "new-password" : "current-password"}"
              required
            />
            <button type="button" id="togglePwEyeBtn" class="cw-eye-btn" aria-label="비밀번호 표시 전환" tabindex="-1">
              ${eyeOpenSvg}
            </button>
          </div>

          <button type="submit" class="toss-primary-btn cw-auth-submit">
            ${isSignup ? "계정 만들기" : "로그인"}
          </button>
        </form>

        <div class="cw-auth-footer ${isSignup ? "center" : ""}">
          ${
            isSignup
              ? `<button type="button" class="cw-underline-link" data-switch-mode="login">이미 계정이 있으신가요? 로그인</button>`
              : `
                <button type="button" class="cw-underline-link" id="forgotPwLinkBtn">비밀번호를 잊으셨나요?</button>
                <button type="button" class="cw-underline-link" data-switch-mode="signup">계정 만들기</button>
              `
          }
        </div>

      </div>
    `;

    // 비밀번호 우측 눈 아이콘 토글
    const pwInput = document.getElementById("authPassword");
    const eyeBtn = document.getElementById("togglePwEyeBtn");
    eyeBtn?.addEventListener("click", () => {
      if (!pwInput) return;
      const show = pwInput.type === "password";
      pwInput.type = show ? "text" : "password";
      eyeBtn.innerHTML = show ? eyeOffSvg : eyeOpenSvg;
    });

    // 하단 밑줄 링크로 로그인 <-> 계정 만들기 전환
    authGateOverlay.querySelectorAll("[data-switch-mode]").forEach(btn => {
      btn.addEventListener("click", () => {
        authFormMode = btn.getAttribute("data-switch-mode");
        authMessage = "";
        renderPreLoginLanding();
      });
    });

    // 비밀번호 분실 안내
    document.getElementById("forgotPwLinkBtn")?.addEventListener("click", () => {
      authMessage = "";
      renderPreLoginLanding("관리자에게 문의하세요.");
    });

    // 소속 반(1~7반) & MBTI 4글자 토글 스위치 동작 (블루 톤 유지)
    if (isSignup) {
      const hiddenClass = document.getElementById("authClassName");
      const classPreview = document.getElementById("classPreviewText");
      const classGrid = document.getElementById("classPickerGrid");
      let chosenClass = "6반";

      const syncClassUI = () => {
        if (hiddenClass) hiddenClass.value = chosenClass;
        if (classPreview) classPreview.textContent = chosenClass;
        const numberInput = document.getElementById("authStudentNumber");
        if (numberInput) {
          numberInput.hidden = chosenClass !== "6반";
          numberInput.disabled = chosenClass !== "6반";
          numberInput.required = chosenClass === "6반";
        }
        classGrid?.querySelectorAll("[data-class-val]").forEach(btn => {
          const active = btn.getAttribute("data-class-val") === chosenClass;
          btn.style.background = active ? "var(--toss-blue)" : "var(--bg-subtle)";
          btn.style.color = active ? "#ffffff" : "var(--text-sub)";
        });
      };

      classGrid?.querySelectorAll("[data-class-val]").forEach(btn => {
        btn.addEventListener("click", () => {
          chosenClass = btn.getAttribute("data-class-val");
          syncClassUI();
        });
      });

      syncClassUI();

      const mbtiChars = ["E", "N", "F", "P"];
      let mbtiSkipped = false;
      const hiddenMbti = document.getElementById("authMbti");
      const previewBadge = document.getElementById("mbtiPreviewBadge");
      const skipBtn = document.getElementById("mbtiSkipBtn");
      const pickerGrid = document.getElementById("mbtiPickerGrid");

      const syncMbtiUI = () => {
        const val = mbtiSkipped ? "" : mbtiChars.join("");
        if (hiddenMbti) hiddenMbti.value = val;
        if (previewBadge) {
          previewBadge.textContent = mbtiSkipped ? "선택 안 함" : val;
          previewBadge.style.opacity = mbtiSkipped ? "0.55" : "1";
        }
        if (skipBtn) {
          skipBtn.textContent = mbtiSkipped ? "다시 고르기" : "잘 모름";
        }
        if (pickerGrid) {
          pickerGrid.style.opacity = mbtiSkipped ? "0.4" : "1";
          pickerGrid.querySelectorAll("[data-mbti-char]").forEach(btn => {
            const slot = Number(btn.getAttribute("data-mbti-slot"));
            const ch = btn.getAttribute("data-mbti-char");
            const active = !mbtiSkipped && mbtiChars[slot] === ch;
            btn.style.background = active ? "var(--toss-blue)" : "transparent";
            btn.style.color = active ? "#ffffff" : "var(--text-sub)";
          });
        }
      };

      pickerGrid?.querySelectorAll("[data-mbti-char]").forEach(btn => {
        btn.addEventListener("click", () => {
          mbtiSkipped = false;
          const slot = Number(btn.getAttribute("data-mbti-slot"));
          mbtiChars[slot] = btn.getAttribute("data-mbti-char");
          syncMbtiUI();
        });
      });

      skipBtn?.addEventListener("click", () => {
        mbtiSkipped = !mbtiSkipped;
        syncMbtiUI();
      });

      syncMbtiUI();
    }

    const form = document.getElementById("authGateForm");
    const birthInput = document.getElementById("authBirthDate");
    if (birthInput) {
      const syncBirthInput = () => birthInput.classList.toggle("is-empty", !birthInput.value);
      birthInput.addEventListener("input", syncBirthInput);
      birthInput.addEventListener("change", syncBirthInput);
      syncBirthInput();
    }
    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (form.querySelector('button[type="submit"]')?.disabled) return;
      const username = document.getElementById("authUsername").value.trim().toLowerCase();
      const password = document.getElementById("authPassword").value;
      const showSubmitError = message => {
        let notice = form.querySelector('[data-signup-error]');
        if (!notice) {
          notice = document.createElement("p");
          notice.dataset.signupError = "";
          notice.className = "auth-alert";
          notice.setAttribute("role", "alert");
          form.appendChild(notice);
        }
        notice.textContent = message;
        const button = form.querySelector('button[type="submit"]');
        if (button) {
          button.disabled = false;
          button.textContent = isSignup ? "계정 만들기" : "로그인";
        }
      };
      if (isSignup) {
        const charCount = Array.from(password).length;
        const byteCount = [...password].reduce((n, ch) => { const cp = ch.codePointAt(0); return n + (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4); }, 0);
        if (charCount < 8 || byteCount > 72) {
          showSubmitError("비밀번호는 8자 이상, UTF-8 72바이트 이하로 입력해 주세요.");
          return;
        }
      }
      const fullName = document.getElementById("authFullName")?.value.trim() || "";
      const className = document.getElementById("authClassName")?.value.trim() || "기본반";
      const studentNumber = className === "6반" ? Number(document.getElementById("authStudentNumber")?.value) : null;
      if (isSignup && className === "6반" && (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 30)) {
        document.getElementById("authStudentNumber")?.reportValidity();
        return;
      }
      const mbti = document.getElementById("authMbti")?.value.trim().toUpperCase() || "";
      const birthDate = document.getElementById("authBirthDate")?.value || "";
      const shareBirthday = Boolean(birthDate);
      if (isSignup && !window.CodeWikiBirthdays.validDate(birthDate)) {
        document.getElementById("authBirthDate").setCustomValidity("생년월일을 확인해 주세요.");
        document.getElementById("authBirthDate").reportValidity();
        document.getElementById("authBirthDate").addEventListener("input", e=>e.target.setCustomValidity(""), {once:true});
        return;
      }

      if (username.length < 2) {
        showSubmitError("아이디는 2자 이상 입력해 주세요.");
        return;
      }

      // 2) Supabase 자체 RPC 동작
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "처리 중...";
      }

      const tokenBeforeSubmit = getSupaToken();
      const args = isSignup ? {
          p_username: username,
          p_password: password,
          p_full_name: fullName,
          p_class_name: className,
          p_mbti: mbti,
          p_birth_date: birthDate || null,
          p_share_with_class: shareBirthday,
          p_student_number: studentNumber
      } : {p_username: username, p_password: password};
      let data, error;
      try {
        ({ data, error } = await authRpc(isSignup ? "cw_signup_with_roster" : "cw_login", args));
      } catch (cause) {
        error = {message: cause.code === 'TIMEOUT'
          ? (isSignup ? "응답이 지연되고 있습니다. 가입되었을 수 있으니 로그인으로 확인해 주세요." : "응답이 지연되고 있습니다. 잠시 후 다시 로그인해 주세요.")
          : "연결을 확인한 뒤 다시 시도해 주세요."};
      }
      // Switching forms or accounts invalidates this submission, even if the
      // server finishes it later. Never overwrite a newer session.
      if (document.getElementById('authGateForm') !== form || getSupaToken() !== tokenBeforeSubmit) return;
      if (error || !data?.session_token) {
        showSubmitError(error?.message || data?.message || (isSignup ? "가입 신청 중 오류가 발생했습니다." : "아이디 또는 비밀번호를 확인해 주세요."));
      } else {
        authMessage = "";
        setSupaToken(data.session_token);
        renderAuthState();
      }
    });
  }

  // [승인 대기 / 반려 화면]
  function renderPendingGate(user) {
    const isRejected = user.status === "rejected";
    authGateOverlay.innerHTML = `
      <div class="prelogin-landing">
        <div class="prelogin-symbol-area">
          <div class="prelogin-symbol-box">
            <svg width="56" height="56" viewBox="0 0 120 120" fill="currentColor">
              <path d="M12 12 H54 V54 H41 V40 H15 V28.5 H41 V23.5 H12 Z" />
              <path d="M66 12 H108 V25 H79 V41 H108 V54 H66 Z" />
              <path fill-rule="evenodd" clip-rule="evenodd" d="M33 66 A21 21 0 1 0 33 108 A21 21 0 1 0 33 66 Z M33 79 A8 8 0 1 1 33 95 A8 8 0 1 1 33 79 Z" />
              <path d="M66 66 H108 V108 H95 V94 H69 V82.5 H95 V77.5 H66 Z" />
            </svg>
          </div>
          <h1 class="prelogin-brand-title">코드위키</h1>
        </div>

        <div class="auth-card toss-card" style="text-align:center;">
          <div style="display:inline-block; padding:5px 12px; border-radius:999px; font-size:12.5px; font-weight:700; background:${
            isRejected ? "var(--toss-red-soft)" : "var(--toss-blue-soft)"
          }; color:${isRejected ? "var(--toss-red)" : "var(--toss-blue)"}; margin-bottom:14px;">
            ${isRejected ? "승인 반려됨" : "승인 대기 중"}
          </div>
          <h2 class="auth-status-title">
            ${isRejected ? "접근 승인이 반려되었습니다" : "관리자 승인을 기다리고 있어요"}
          </h2>
          <p class="auth-desc" style="margin-top:8px;">
            <strong>[${escapeHtml(user.class_name || "1반")}${user.mbti ? ` · ${escapeHtml(user.mbti)}` : ""}] ${escapeHtml(user.full_name)}</strong> (@${escapeHtml(user.username)})<br/>
            관리자가 가입 요청을 승인하면 열람할 수 있습니다.
          </p>

          <div style="display:flex; flex-direction:column; gap:8px; margin-top:24px;">
            <button id="refreshApprovalBtn" class="toss-primary-btn">
              승인 상태 새로고침
            </button>
            <button id="pendingLogoutBtn" class="toss-chip-btn" style="width:100%; justify-content:center; height:46px;">
              로그아웃 / 돌아가기
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("refreshApprovalBtn").addEventListener("click", () => {
      renderAuthState();
    });

    document.getElementById("pendingLogoutBtn").addEventListener("click", logout);
  }

  window.addEventListener?.('hashchange', () => {
    if (adminPreviewMode && activeUserCache?.role === 'admin' && String(window.location?.hash || '').startsWith('#admin/')) {
      setAdminPreviewMode(false, window.location.hash);
    }
  });

  window.addEventListener?.('storage', event => {
    if (event.key !== null && event.key !== SUPA_TOKEN_KEY) return;
    closeForcedLogoutPopup();
    activeUserCache = null;
    syncUserFeatures(null);
    window.CodeWikiBoard?.closeIfActive();
    document.getElementById('boardWriteModal')?.classList.add('hidden');
    void renderAuthState();
  });

  renderAuthState();
})();
