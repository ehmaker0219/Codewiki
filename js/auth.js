/**
 * ============================================================================
 * [코드위키 인증 & 랜딩 분기 시스템: js/auth.js]
 * ----------------------------------------------------------------------------
 * - 로그인 전 랜딩페이지: 오직 '코드위키 심볼(ㅋㄷㅇㅋ)'과 'Auth(로그인/가입신청)'만 미니멀하게 표시
 * - 로그인(승인) 후 랜딩페이지: 메인 위키 대시보드(상단바 + 좌측 챕터 + 본문 + 우측 목차) 표시
 * ============================================================================
 */
(function () {
  const SUPABASE_URL = "";       // 예: "https://xxxx.supabase.co"
  const SUPABASE_ANON_KEY = "";  // 예: "eyJhbGciOiJIUzI1NiIsInR5..."

  const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  let supabaseClient = null;

  if (isSupabaseConfigured && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  const DEMO_USERS_KEY = "codewiki_demo_users_v2";
  const DEMO_SESSION_KEY = "codewiki_demo_session_v2";

  const defaultDemoUsers = [
    {
      id: "admin-1",
      full_name: "관리자",
      email: "admin@codewiki.kr",
      password: "admin",
      role: "admin",
      status: "approved",
      created_at: "2026-11-17 09:00"
    },
    {
      id: "stu-1",
      full_name: "김민수",
      email: "minsu@student.kr",
      password: "1234",
      role: "student",
      status: "pending",
      created_at: "2026-11-17 09:15"
    },
    {
      id: "stu-2",
      full_name: "이지은",
      email: "jieun@student.kr",
      password: "1234",
      role: "student",
      status: "pending",
      created_at: "2026-11-17 09:20"
    },
    {
      id: "stu-3",
      full_name: "박준형",
      email: "jun@student.kr",
      password: "1234",
      role: "student",
      status: "approved",
      created_at: "2026-11-16 18:30"
    }
  ];

  function getDemoUsers() {
    try {
      const raw = localStorage.getItem(DEMO_USERS_KEY);
      if (!raw) {
        localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(defaultDemoUsers));
        return defaultDemoUsers;
      }
      return JSON.parse(raw);
    } catch (e) {
      return defaultDemoUsers;
    }
  }

  function saveDemoUsers(list) {
    localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(list));
  }

  // 기본값을 비로그인(null)으로 두어, 첫 접속 시 무조건 심볼+Auth 랜딩페이지가 보이도록 설정
  function getCurrentDemoUser() {
    const savedId = localStorage.getItem(DEMO_SESSION_KEY);
    if (!savedId || savedId === "logged-out") return null;
    const users = getDemoUsers();
    return users.find(u => u.id === savedId) || null;
  }

  function setDemoSession(userId) {
    localStorage.setItem(DEMO_SESSION_KEY, userId || "logged-out");
    renderAuthState();
  }

  const authGateOverlay = document.getElementById("authGateOverlay");
  const adminModal = document.getElementById("adminModal");
  const adminSidebarSlot = document.getElementById("adminSidebarSlot");
  const sidebarProfileSlot = document.getElementById("sidebarProfileSlot");

  let authFormMode = "login"; // 'login' | 'signup'
  let authMessage = "";

  let activeUserCache = null;

  window.CodeWikiAuth = {
    getCurrentUser: () => activeUserCache,
    isSupabaseConfigured: () => isSupabaseConfigured,
    getSupabaseClient: () => supabaseClient
  };

  async function renderAuthState() {
    if (!isSupabaseConfigured) {
      const user = getCurrentDemoUser();
      activeUserCache = user;
      const allUsers = getDemoUsers();
      const pendingCount = allUsers.filter(u => u.status === "pending").length;

      if (!user) {
        // 1. 비로그인 상태 -> 위키 숨기고 심볼+Auth 랜딩페이지만 표시
        document.body.classList.remove("authenticated");
        authGateOverlay.classList.remove("hidden");
        renderPreLoginLanding();
      } else if (user.status !== "approved" && user.role !== "admin") {
        // 2. 승인 대기 상태 -> 위키 숨기고 승인 대기 화면 표시
        document.body.classList.remove("authenticated");
        authGateOverlay.classList.remove("hidden");
        renderPendingGate(user);
      } else {
        // 3. 로그인 + 승인 완료 -> 로그인 후 위키 랜딩페이지 표시!
        document.body.classList.add("authenticated");
        authGateOverlay.classList.add("hidden");
        renderTopbarAuthControls(user, pendingCount);
        if (window.CodeWikiBoard) window.CodeWikiBoard.refreshBadge();
        window.scrollTo({ top: 0 });
      }
      return;
    }

    // 실제 Supabase 연동 시
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const sessionUser = sessionData?.session?.user;

    if (!sessionUser) {
      activeUserCache = null;
      document.body.classList.remove("authenticated");
      authGateOverlay.classList.remove("hidden");
      renderPreLoginLanding();
      return;
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", sessionUser.id)
      .single();

    activeUserCache = profile;

    if (!profile || (profile.status !== "approved" && profile.role !== "admin")) {
      document.body.classList.remove("authenticated");
      authGateOverlay.classList.remove("hidden");
      renderPendingGate(
        profile || { full_name: sessionUser.email, email: sessionUser.email, status: "pending" }
      );
      return;
    }

    let pendingCount = 0;
    if (profile.role === "admin") {
      const { count } = await supabaseClient
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      pendingCount = count || 0;
    }

    document.body.classList.add("authenticated");
    authGateOverlay.classList.add("hidden");
    renderTopbarAuthControls(profile, pendingCount);
    if (window.CodeWikiBoard) window.CodeWikiBoard.refreshBadge();
  }

  // 좌측 고정 사이드바 내 [학생 승인 관리 메뉴] + [하단 고정 유저 프로필 카드] 렌더링
  function renderTopbarAuthControls(user, pendingCount) {
    if (!user) return;
    const isAdmin = user.role === "admin";
    const initialChar = (user.full_name || "코").trim().charAt(0);

    // 1) MAIN 섹션 내 관리자 메뉴
    if (adminSidebarSlot) {
      adminSidebarSlot.innerHTML = isAdmin
        ? `
        <button type="button" id="openAdminModalBtn" class="sb-menu-item">
          <svg class="sb-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>학생 승인 관리</span>
          ${pendingCount > 0 ? `<span class="pending-badge" style="margin-left:auto;">${pendingCount}</span>` : ""}
        </button>
      `
        : "";

      document.getElementById("openAdminModalBtn")?.addEventListener("click", openAdminApprovalModal);
    }

    // 2) 좌측 사이드바 최하단 유저 프로필 카드 (Quest-On 하단 프로필 디자인)
    if (sidebarProfileSlot) {
      sidebarProfileSlot.innerHTML = `
        <div class="sb-profile-card">
          <div class="sb-avatar">${initialChar}</div>
          <div class="sb-profile-info">
            <div class="sb-profile-name">
              <span>${user.full_name}</span>
              ${isAdmin ? `<span class="verified-dot" title="관리자">✓</span>` : ""}
            </div>
            <div class="sb-profile-role">${isAdmin ? "관리자" : "우리 반 멤버"}</div>
          </div>
          <button type="button" id="logoutBtn" class="sb-logout-btn" title="로그아웃">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      `;

      document.getElementById("logoutBtn")?.addEventListener("click", () => {
        if (!isSupabaseConfigured) {
          setDemoSession("logged-out");
        } else {
          supabaseClient.auth.signOut().then(() => renderAuthState());
        }
      });
    }
  }

  // [로그인 전 랜딩페이지]: 심볼(ㅋㄷㅇㅋ) + Auth 폼만 미니멀하게 노출
  function renderPreLoginLanding() {
    const isSignup = authFormMode === "signup";

    authGateOverlay.innerHTML = `
      <div class="prelogin-landing">
        <div class="prelogin-symbol-area">
          <div class="prelogin-symbol-box">
            <svg width="64" height="64" viewBox="0 0 120 120" fill="currentColor">
              <path d="M12 12 H54 V54 H41 V40 H15 V28.5 H41 V23.5 H12 Z" />
              <path d="M66 12 H108 V25 H79 V41 H108 V54 H66 Z" />
              <path fill-rule="evenodd" clip-rule="evenodd" d="M33 66 A21 21 0 1 0 33 108 A21 21 0 1 0 33 66 Z M33 79 A8 8 0 1 1 33 95 A8 8 0 1 1 33 79 Z" />
              <path d="M66 66 H108 V108 H95 V94 H69 V82.5 H95 V77.5 H66 Z" />
            </svg>
          </div>
          <h1 class="prelogin-brand-title">코드위키</h1>
        </div>

        <div class="auth-card toss-card">
          <div class="auth-tab-row">
            <button type="button" class="auth-tab-btn ${!isSignup ? "active" : ""}" data-mode="login">로그인</button>
            <button type="button" class="auth-tab-btn ${isSignup ? "active" : ""}" data-mode="signup">가입 신청</button>
          </div>

          ${authMessage ? `<div class="auth-alert">${authMessage}</div>` : ""}

          <form id="authGateForm" class="auth-form">
            ${
              isSignup
                ? `
              <div class="auth-field">
                <label>이름</label>
                <input type="text" id="authFullName" placeholder="실명 입력" required />
              </div>
            `
                : ""
            }
            <div class="auth-field">
              <label>이메일</label>
              <input type="email" id="authEmail" placeholder="이메일 입력" required />
            </div>
            <div class="auth-field">
              <label>비밀번호</label>
              <input type="password" id="authPassword" placeholder="비밀번호 입력" required />
            </div>
            <button type="submit" class="toss-primary-btn">
              ${isSignup ? "승인 요청하기" : "로그인"}
            </button>
          </form>

          ${
            !isSupabaseConfigured
              ? `
            <div class="prelogin-quick-links">
              <button type="button" class="quick-link-btn" data-demo-login="admin-1">관리자 입장</button>
              <span class="quick-divider">·</span>
              <button type="button" class="quick-link-btn" data-demo-login="stu-3">승인된 학생 입장</button>
              <span class="quick-divider">·</span>
              <button type="button" class="quick-link-btn" data-demo-login="stu-1">승인대기 화면</button>
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;

    authGateOverlay.querySelectorAll(".auth-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        authFormMode = btn.getAttribute("data-mode");
        authMessage = "";
        renderPreLoginLanding();
      });
    });

    authGateOverlay.querySelectorAll("[data-demo-login]").forEach(btn => {
      btn.addEventListener("click", () => {
        setDemoSession(btn.getAttribute("data-demo-login"));
      });
    });

    const form = document.getElementById("authGateForm");
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const email = document.getElementById("authEmail").value.trim();
      const password = document.getElementById("authPassword").value.trim();
      const fullNameEl = document.getElementById("authFullName");
      const fullName = fullNameEl ? fullNameEl.value.trim() : "";

      if (!isSupabaseConfigured) {
        const users = getDemoUsers();
        if (isSignup) {
          const newUser = {
            id: "stu-" + Date.now(),
            full_name: fullName || "학생",
            email,
            role: "student",
            status: "pending",
            created_at: "방금 전"
          };
          users.unshift(newUser);
          saveDemoUsers(users);
          setDemoSession(newUser.id);
        } else {
          const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
          if (found) {
            setDemoSession(found.id);
          } else {
            // 데모 편의상 아무 이메일이나 로그인 누르면 관리자 입장 또는 안내
            authMessage = "등록되지 않은 이메일입니다. 가입 신청을 먼저 진행해 주세요.";
            renderPreLoginLanding();
          }
        }
        return;
      }

      if (isSignup) {
        const { error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        });
        if (error) {
          authMessage = error.message;
          renderPreLoginLanding();
        } else {
          renderAuthState();
        }
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
          authMessage = "이메일 또는 비밀번호를 확인해 주세요.";
          renderPreLoginLanding();
        } else {
          renderAuthState();
        }
      }
    });
  }

  // [승인 대기 화면]: 심볼 + 승인 대기 상태 안내
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
          <h2 style="font-size:20px; font-weight:800; color:var(--text-strong);">
            ${isRejected ? "접근 승인이 반려되었습니다" : "관리자 승인을 기다리고 있어요"}
          </h2>
          <p class="auth-desc" style="margin-top:8px;">
            <strong>${user.full_name}</strong> (${user.email})<br/>
            관리자가 가입 요청을 승인하면 열람할 수 있습니다.
          </p>

          <div style="display:flex; flex-direction:column; gap:8px; margin-top:24px;">
            <button id="refreshApprovalBtn" class="toss-primary-btn">
              승인 상태 확인
            </button>
            <button id="pendingLogoutBtn" class="toss-chip-btn" style="width:100%; justify-content:center; height:46px;">
              돌아가기
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("refreshApprovalBtn").addEventListener("click", () => {
      renderAuthState();
    });

    document.getElementById("pendingLogoutBtn").addEventListener("click", () => {
      if (!isSupabaseConfigured) {
        setDemoSession("logged-out");
      } else {
        supabaseClient.auth.signOut().then(() => renderAuthState());
      }
    });
  }

  // 관리자 전용 [학생 승인 관리] 모달
  async function openAdminApprovalModal() {
    adminModal.classList.remove("hidden");
    let users = [];

    if (!isSupabaseConfigured) {
      users = getDemoUsers().filter(u => u.role !== "admin");
    } else {
      const { data } = await supabaseClient
        .from("profiles")
        .select("*")
        .neq("role", "admin")
        .order("created_at", { ascending: false });
      users = data || [];
    }

    const pendingList = users.filter(u => u.status === "pending");
    const approvedList = users.filter(u => u.status === "approved");

    adminModal.innerHTML = `
      <div class="admin-modal-card toss-card">
        <div class="admin-modal-header">
          <div>
            <span class="toss-badge-blue">Admin</span>
            <h3 class="admin-modal-title">학생 승인 관리</h3>
          </div>
          <button id="closeAdminModalBtn" class="icon-btn">✕</button>
        </div>

        <div class="admin-modal-body">
          <div class="admin-group-title">
            <span>승인 대기 중</span>
            <span class="count-pill">${pendingList.length}명</span>
          </div>
          ${
            pendingList.length === 0
              ? `<div class="admin-empty-box">대기 중인 신청자가 없습니다.</div>`
              : `<div class="admin-user-list">
                  ${pendingList
                    .map(
                      u => `
                    <div class="admin-user-row">
                      <div>
                        <div class="admin-user-name">${u.full_name}</div>
                        <div class="admin-user-email">${u.email}</div>
                      </div>
                      <div class="admin-action-btns">
                        <button class="approve-btn" data-uid="${u.id}" data-next="approved">승인</button>
                        <button class="reject-btn" data-uid="${u.id}" data-next="rejected">거절</button>
                      </div>
                    </div>
                  `
                    )
                    .join("")}
                </div>`
          }

          <div class="admin-group-title" style="margin-top:24px;">
            <span>승인 완료 멤버</span>
            <span class="count-pill">${approvedList.length}명</span>
          </div>
          ${
            approvedList.length === 0
              ? `<div class="admin-empty-box">승인된 멤버가 없습니다.</div>`
              : `<div class="admin-user-list">
                  ${approvedList
                    .map(
                      u => `
                    <div class="admin-user-row">
                      <div>
                        <div class="admin-user-name">${u.full_name} <span class="approved-tag">승인됨</span></div>
                        <div class="admin-user-email">${u.email}</div>
                      </div>
                      <div class="admin-action-btns">
                        <button class="revoke-btn" data-uid="${u.id}" data-next="pending">취소</button>
                      </div>
                    </div>
                  `
                    )
                    .join("")}
                </div>`
          }
        </div>
      </div>
    `;

    document.getElementById("closeAdminModalBtn").addEventListener("click", () => {
      adminModal.classList.add("hidden");
    });

    adminModal.querySelectorAll("[data-uid]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const targetId = btn.getAttribute("data-uid");
        const nextStatus = btn.getAttribute("data-next");

        if (!isSupabaseConfigured) {
          const all = getDemoUsers().map(u => (u.id === targetId ? { ...u, status: nextStatus } : u));
          saveDemoUsers(all);
          openAdminApprovalModal();
          renderAuthState();
        } else {
          await supabaseClient.from("profiles").update({ status: nextStatus }).eq("id", targetId);
          openAdminApprovalModal();
          renderAuthState();
        }
      });
    });
  }

  adminModal?.addEventListener("click", e => {
    if (e.target === adminModal) adminModal.classList.add("hidden");
  });

  renderAuthState();
})();
