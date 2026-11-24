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
      window.CodeWikiApp?.resetTrackChoice();
      adminModal?.classList.add("hidden");
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
  const trackSelectOverlay = document.getElementById("trackSelectOverlay");
  const adminModal = document.getElementById("adminModal");
  const adminSidebarSlot = document.getElementById("adminSidebarSlot");
  const sidebarProfileSlot = document.getElementById("sidebarProfileSlot");

  let authFormMode = "login"; // 'login' | 'signup'
  let authMessage = "";
  let activeUserCache = null;
  let authStateVersion = 0;
  const adminApproval = window.CodeWikiAdmin?.create({
    modal: adminModal, getToken: getSupaToken, getUser: () => activeUserCache,
    client: supabaseClient, onChange: renderAuthState
  });

  // Authentication owns session propagation; feature modules don't control each other.
  function syncUserFeatures(user) {
    const isAdmin = user?.role === 'admin';
    document.body.classList[isAdmin ? 'add' : 'remove']('admin-workspace');
    const operationsLabel = document.getElementById('adminOperationsLabel');
    if (operationsLabel) operationsLabel.hidden = !isAdmin;
    const isApprovedStudent = user?.role === 'student' && user.status === 'approved';
    const thinkingFlow = document.getElementById('sbThinkingFlowItem');
    if (thinkingFlow) thinkingFlow.hidden = !isApprovedStudent;
    const programCatalog = document.getElementById('sbProgramCatalogItem');
    if (programCatalog) programCatalog.hidden = !isApprovedStudent;
    const learningContents = document.getElementById('learningContentsGroup');
    if (learningContents) learningContents.hidden = !isApprovedStudent;
    const learningTools = document.getElementById('learningToolsGroup');
    if (learningTools) learningTools.hidden = !isApprovedStudent;
    if (!user) {
      if (adminSidebarSlot) adminSidebarSlot.innerHTML = "";
      if (sidebarProfileSlot) sidebarProfileSlot.innerHTML = "";
      const studySidebarSlot = document.getElementById('studySidebarSlot');
      if (studySidebarSlot) studySidebarSlot.innerHTML = "";
    }
    window.CodeWikiBoard?.setUser?.(user);
    window.CodeWikiProfile?.setUser(user);
    window.CodeWikiProgress?.setUser(user);
    window.CodeWikiBirthdays?.setUser(user);
    window.CodeWikiStudy?.setUser(user);
    window.CodeWikiMentoring?.setUser(user);
    window.CodeWikiPractice?.setUser(user);
    window.CodeWikiObjectGame?.setUser(user);
    window.CodeWikiKnowledgeMap?.setUser?.(user);
    adminApproval?.setUser(user);
    window.CodeWikiAdminMembers?.setUser(user);
    window.CodeWikiPresence?.setUser(user);
    window.CodeWikiApp?.syncAccess?.();
  }
  syncUserFeatures(null);

  window.CodeWikiAuth = {
    getCurrentUser: () => activeUserCache,
    getSessionToken: () => getSupaToken(),
    isSupabaseConfigured: () => isSupabaseConfigured,
    getSupabaseClient: () => supabaseClient,
    logout,
    refresh: () => renderAuthState(),
    credentialRequest: (name,args) => {
      if (!credentialOperations.has(name)) return Promise.reject(Error('unsupported-auth-operation'));
      return authRpc(name,args);
    },
    applyProfile: profile => {
      if (!activeUserCache || activeUserCache.id !== profile.id) return;
      activeUserCache = {...activeUserCache, full_name:profile.full_name, mbti:profile.mbti};
      renderTopbarAuthControls(activeUserCache, activeUserCache.pending_count || 0);
      window.CodeWikiStudy?.setUser(activeUserCache);
    }
  };

  function showApprovedWorkspaceOrTrackGate(user, pendingCount) {
    document.body.classList.add("authenticated");
    authGateOverlay.classList.add("hidden");
    renderTopbarAuthControls(user, pendingCount);
    if (window.CodeWikiBoard) window.CodeWikiBoard.refreshBadge();

    if (user.role !== 'admin' && !window.CodeWikiApp?.hasSelectedTrack()) {
      document.body.classList.add("track-selecting");
      trackSelectOverlay?.classList.remove("hidden");
      renderTrackSelectGate(user);
    } else {
      document.body.classList.remove("track-selecting");
      trackSelectOverlay?.classList.add("hidden");
    }
    window.scrollTo({ top: 0 });
  }

  // [로그인 직후 트랙 대형 선택 화면]: 군더더기 없는 미니멀 2버튼 구성
  function renderTrackSelectGate() {
    if (!trackSelectOverlay) return;

    trackSelectOverlay.innerHTML = `
      <div class="track-select-inner">
        <h1 class="track-select-heading" style="margin-bottom:32px;">학습할 트랙을 선택하세요</h1>

        <div class="track-choice-grid">
          <button type="button" class="track-big-card track-abap" data-pick-track="abap" style="min-height:210px; align-items:center; justify-content:center; text-align:center;">
            <div class="track-card-icon-wrap" style="margin:0 auto 18px;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
            </div>
            <div class="track-card-title">ABAP</div>
          </button>

          <button type="button" class="track-big-card track-ui5" data-pick-track="ui5" disabled title="업데이트 준비 중" style="min-height:210px; align-items:center; justify-content:center; text-align:center;">
            <div class="track-card-icon-wrap" style="margin:0 auto 18px;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
            </div>
            <div class="track-card-title">UI5 / Fiori · 준비 중</div>
          </button>
        </div>
      </div>
    `;

    trackSelectOverlay.querySelectorAll("[data-pick-track]").forEach(card => {
      card.addEventListener("click", () => {
        const chosen = card.getAttribute("data-pick-track");
        window.CodeWikiApp?.selectTrack(chosen);
        document.body.classList.remove("track-selecting");
        trackSelectOverlay.classList.add("hidden");
      });
    });
  }

  async function renderAuthState() {
    const version = ++authStateVersion;
    if (!isSupabaseConfigured || !supabaseClient) {
      activeUserCache = null;
      syncUserFeatures(null);
      document.body.classList.remove('authenticated', 'track-selecting');
      trackSelectOverlay?.classList.add('hidden');
      authGateOverlay.classList.remove('hidden');
      authGateOverlay.innerHTML = '<div class="auth-container"><div class="auth-card"><h2>로그인 서버에 연결할 수 없습니다.</h2><p>연결을 확인한 뒤 새로고침해 주세요.</p></div></div>';
      return;
    }

    // 2) Supabase 자체 DB 연동 모드 (구글/이메일 없이 세션 토큰으로 검증)
    const token = getSupaToken();
    if (!token) {
      activeUserCache = null;
      syncUserFeatures(null);
      document.body.classList.remove("authenticated", "track-selecting");
      trackSelectOverlay?.classList.add("hidden");
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
      document.body.classList.remove("authenticated", "track-selecting");
      trackSelectOverlay?.classList.add("hidden");
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

    if (!profile) {
      setSupaToken("");
      activeUserCache = null;
      syncUserFeatures(null);
      document.body.classList.remove("authenticated", "track-selecting");
      trackSelectOverlay?.classList.add("hidden");
      authGateOverlay.classList.remove("hidden");
      renderPreLoginLanding();
      return;
    }

    activeUserCache = profile;
    syncUserFeatures(profile);

    if (profile.status !== "approved" && profile.role !== "admin") {
      document.body.classList.remove("authenticated", "track-selecting");
      trackSelectOverlay?.classList.add("hidden");
      authGateOverlay.classList.remove("hidden");
      renderPendingGate(profile);
      return;
    }

    showApprovedWorkspaceOrTrackGate(profile, profile.pending_count || 0);
  }

  // 좌측 사이드바 내 [학생 승인 관리 메뉴] + [하단 유저 프로필 카드]
  function renderTopbarAuthControls(user, pendingCount) {
    if (!user) return;
    const isAdmin = user.role === "admin";

    const studySidebarSlot = document.getElementById('studySidebarSlot');
    if (studySidebarSlot) studySidebarSlot.innerHTML = user.role === 'student' && user.status === 'approved' ? `<a href="#study" id="openStudyBtn" class="sb-menu-item${window.location.hash === '#study' ? ' active' : ''}"><svg class="sb-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="15" height="17" rx="2"></rect><path d="M9 2v4M16 2v4M3 9h4M3 14h4M3 19h4M10 10h6M10 14h6M10 18h4"></path></svg><span>내 공부방</span></a>` : '';

    if (adminSidebarSlot) {
      adminSidebarSlot.innerHTML = (isAdmin || (user.role === 'student' && user.status === 'approved'))
        ? `
        ${isAdmin ? `<div class="sb-group-label">학생 관리</div><a href="#admin/students" id="openStudentDirectoryBtn" class="sb-menu-item${window.location.hash === '#admin/students' ? ' active' : ''}"><svg class="sb-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M6 17v-1a3 3 0 0 1 6 0v1M15 8h3M15 12h3M15 16h3"/></svg><span>학생 정보</span></a><a href="#admin/logins" id="openLoginHistoryBtn" class="sb-menu-item${window.location.hash === '#admin/logins' ? ' active' : ''}"><svg class="sb-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg><span>로그인 내역</span></a><button type="button" id="openAdminModalBtn" class="sb-menu-item">
          <svg class="sb-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>학생 승인 관리</span>
          ${pendingCount > 0 ? `<span class="pending-badge" style="margin-left:auto;">${pendingCount}</span>` : ""}
        </button>` : ''}
      `
        : "";

      document.getElementById("openAdminModalBtn")?.addEventListener("click", openAdminApprovalModal);
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
        window.CodeWikiApp?.resetTrackChoice();
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

  window.addEventListener?.('storage', event => {
    if (event.key !== null && event.key !== SUPA_TOKEN_KEY) return;
    activeUserCache = null;
    syncUserFeatures(null);
    window.CodeWikiBoard?.closeIfActive();
    document.getElementById('boardWriteModal')?.classList.add('hidden');
    void renderAuthState();
  });

  function openAdminApprovalModal() {
    return adminApproval?.open();
  }

  renderAuthState();
})();
