/**
 * ============================================================================
 * [우리 반 전용 인증 & 관리자 승인 시스템: js/auth.js]
 * ----------------------------------------------------------------------------
 * 1. SUPABASE_URL과 SUPABASE_ANON_KEY를 입력하면 실제 Supabase DB로 동작합니다.
 * 2. 비워두면 브라우저(LocalStorage) 기반 '프리뷰 데모 모드'로 즉시 작동하여,
 *    로그인 화면 · 승인 대기 화면 · 관리자 학생 승인 탭을 바로 테스트할 수 있습니다!
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

  // 데모 모드용 초기 샘플 학생 목록 (LocalStorage 저장)
  const DEMO_USERS_KEY = "codewiki_demo_users_v1";
  const DEMO_SESSION_KEY = "codewiki_demo_session_v1";

  const defaultDemoUsers = [
    {
      id: "admin-1",
      full_name: "관리자 (나)",
      email: "admin@codewiki.kr",
      role: "admin",
      status: "approved",
      created_at: "2026-11-17 09:00"
    },
    {
      id: "stu-1",
      full_name: "김민수",
      email: "minsu@student.kr",
      role: "student",
      status: "pending",
      created_at: "2026-11-17 09:15"
    },
    {
      id: "stu-2",
      full_name: "이지은",
      email: "jieun@student.kr",
      role: "student",
      status: "pending",
      created_at: "2026-11-17 09:20"
    },
    {
      id: "stu-3",
      full_name: "박준형",
      email: "jun@student.kr",
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

  function getCurrentDemoUser() {
    const users = getDemoUsers();
    const savedId = localStorage.getItem(DEMO_SESSION_KEY) || "admin-1";
    if (savedId === "logged-out") return null;
    return users.find(u => u.id === savedId) || users[0];
  }

  function setDemoSession(userId) {
    localStorage.setItem(DEMO_SESSION_KEY, userId);
    renderAuthState();
  }

  // =========================================================================
  // UI 렌더링: 상단바 프로필/관리자 버튼 + 게이트 화면(로그인/승인대기) + 관리자 모달
  // =========================================================================
  const authGateOverlay = document.getElementById("authGateOverlay");
  const adminModal = document.getElementById("adminModal");
  const adminBtnWrap = document.getElementById("adminBtnWrap");

  let authFormMode = "login"; // 'login' | 'signup'
  let authMessage = "";

  async function renderAuthState() {
    if (!isSupabaseConfigured) {
      // 데모 모드 동작
      const user = getCurrentDemoUser();
      const allUsers = getDemoUsers();
      const pendingCount = allUsers.filter(u => u.status === "pending").length;

      renderTopbarAuthControls(user, pendingCount);

      if (!user) {
        // 로그아웃 상태 -> 토스 스타일 로그인/가입 신청 게이트 표시
        authGateOverlay.classList.remove("hidden");
        renderLoginSignupGate();
      } else if (user.status !== "approved" && user.role !== "admin") {
        // 승인 대기(pending) 또는 거절(rejected) 상태 -> 대기 안내 게이트 표시
        authGateOverlay.classList.remove("hidden");
        renderPendingGate(user);
      } else {
        // 승인 완료(approved) 또는 관리자(admin) -> 위키 열람 허용!
        authGateOverlay.classList.add("hidden");
      }
      return;
    }

    // 실제 Supabase 연동 모드
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const sessionUser = sessionData?.session?.user;

    if (!sessionUser) {
      renderTopbarAuthControls(null, 0);
      authGateOverlay.classList.remove("hidden");
      renderLoginSignupGate();
      return;
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", sessionUser.id)
      .single();

    if (!profile) {
      authGateOverlay.classList.remove("hidden");
      renderPendingGate({ full_name: sessionUser.email, email: sessionUser.email, status: "pending" });
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

    renderTopbarAuthControls(profile, pendingCount);

    if (profile.status !== "approved" && profile.role !== "admin") {
      authGateOverlay.classList.remove("hidden");
      renderPendingGate(profile);
    } else {
      authGateOverlay.classList.add("hidden");
    }
  }

  // 상단바 우측: 학생 승인 관리 버튼(관리자 전용) & 현재 로그인 상태 칩
  function renderTopbarAuthControls(user, pendingCount) {
    if (!adminBtnWrap) return;

    if (!user) {
      adminBtnWrap.innerHTML = "";
      return;
    }

    const isAdmin = user.role === "admin";
    adminBtnWrap.innerHTML = `
      ${
        isAdmin
          ? `
        <button id="openAdminModalBtn" class="toss-chip-btn active" title="우리 반 학생 가입 승인 및 관리">
          <span>👥 학생 승인 관리</span>
          ${
            pendingCount > 0
              ? `<span class="pending-badge">${pendingCount}</span>`
              : ""
          }
        </button>
      `
          : ""
      }
      <button id="userSwitchBtn" class="toss-chip-btn" title="클릭하여 화면 전환 또는 로그아웃">
        <span>${isAdmin ? "👑" : "🎓"} ${user.full_name}</span>
      </button>
    `;

    const openAdminBtn = document.getElementById("openAdminModalBtn");
    if (openAdminBtn) {
      openAdminBtn.addEventListener("click", () => {
        openAdminApprovalModal();
      });
    }

    const userSwitchBtn = document.getElementById("userSwitchBtn");
    if (userSwitchBtn) {
      userSwitchBtn.addEventListener("click", () => {
        if (!isSupabaseConfigured) {
          // 데모 모드에서는 로그인/승인대기 화면을 바로 체험할 수 있도록 로그아웃 전환
          setDemoSession("logged-out");
        } else {
          supabaseClient.auth.signOut().then(() => renderAuthState());
        }
      });
    }
  }

  // 게이트 1: 로그인 / 우리 반 가입 신청 카드 (토스 스타일)
  function renderLoginSignupGate() {
    const isSignup = authFormMode === "signup";
    authGateOverlay.innerHTML = `
      <div class="auth-card toss-card">
        <div class="auth-logo-wrap">
          <div class="brand-symbol" style="width:48px; height:48px; border-radius:14px;">
            <svg width="30" height="30" viewBox="0 0 120 120" fill="currentColor">
              <path d="M12 12 H54 V54 H41 V40 H15 V28.5 H41 V23.5 H12 Z" />
              <path d="M66 12 H108 V25 H79 V41 H108 V54 H66 Z" />
              <path fill-rule="evenodd" clip-rule="evenodd" d="M33 66 A21 21 0 1 0 33 108 A21 21 0 1 0 33 66 Z M33 79 A8 8 0 1 1 33 95 A8 8 0 1 1 33 79 Z" />
              <path d="M66 66 H108 V108 H95 V94 H69 V82.5 H95 V77.5 H66 Z" />
            </svg>
          </div>
          <h2 class="auth-title">코드위키</h2>
          <p class="auth-desc">우리 반 전용 SAP 학습 아카이브입니다.<br/>관리자 승인 후 모든 개념 문서를 열람할 수 있어요.</p>
        </div>

        <div class="auth-tab-row">
          <button class="auth-tab-btn ${!isSignup ? "active" : ""}" data-mode="login">로그인</button>
          <button class="auth-tab-btn ${isSignup ? "active" : ""}" data-mode="signup">우리 반 가입 신청</button>
        </div>

        ${authMessage ? `<div class="auth-alert">${authMessage}</div>` : ""}

        <form id="authGateForm" class="auth-form">
          ${
            isSignup
              ? `
            <div class="auth-field">
              <label>이름 (실명)</label>
              <input type="text" id="authFullName" placeholder="예: 홍길동 (관리자가 누군지 알아볼 수 있게!)" required />
            </div>
          `
              : ""
          }
          <div class="auth-field">
            <label>이메일</label>
            <input type="email" id="authEmail" placeholder="example@email.com" required />
          </div>
          <div class="auth-field">
            <label>비밀번호</label>
            <input type="password" id="authPassword" placeholder="비밀번호 6자리 이상" required />
          </div>
          <button type="submit" class="toss-primary-btn">
            ${isSignup ? "가입 및 승인 신청하기" : "로그인하기"}
          </button>
        </form>

        ${
          !isSupabaseConfigured
            ? `
          <div class="demo-switcher-box">
            <div class="demo-switcher-title">🧪 [미리보기 체험 모드] 클릭 한 번으로 화면 전환해보기</div>
            <div class="demo-switcher-btns">
              <button class="toss-chip-btn active" data-demo-login="admin-1">👑 내 계정(관리자)으로 입장</button>
              <button class="toss-chip-btn" data-demo-login="stu-1">⏳ 승인 대기 학생(김민수) 화면 보기</button>
            </div>
          </div>
        `
            : ""
        }
      </div>
    `;

    authGateOverlay.querySelectorAll(".auth-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        authFormMode = btn.getAttribute("data-mode");
        authMessage = "";
        renderLoginSignupGate();
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
        // 데모 모드 가입/로그인 시뮬레이션
        const users = getDemoUsers();
        if (isSignup) {
          const newUser = {
            id: "stu-" + Date.now(),
            full_name: fullName || "새 학생",
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
            authMessage = "등록되지 않은 이메일입니다. [우리 반 가입 신청] 탭에서 먼저 신청해 주세요!";
            renderLoginSignupGate();
          }
        }
        return;
      }

      // 실제 Supabase 가입/로그인
      if (isSignup) {
        const { error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        });
        if (error) {
          authMessage = error.message;
          renderLoginSignupGate();
        } else {
          renderAuthState();
        }
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
          authMessage = "이메일 또는 비밀번호를 확인해 주세요.";
          renderLoginSignupGate();
        } else {
          renderAuthState();
        }
      }
    });
  }

  // 게이트 2: 승인 대기 중 화면 (pending 상태 학생에게 보이는 토스 스타일 안내 카드)
  function renderPendingGate(user) {
    const isRejected = user.status === "rejected";
    authGateOverlay.innerHTML = `
      <div class="auth-card toss-card" style="text-align:center;">
        <div style="font-size:44px; margin-bottom:12px;">${isRejected ? "🚫" : "⏳"}</div>
        <h2 class="auth-title">${
          isRejected ? "접근 승인이 반려되었습니다" : "관리자 승인 대기 중이에요"
        }</h2>
        <p class="auth-desc" style="margin-top:8px;">
          <strong>${user.full_name}</strong> (${user.email})님의 가입 신청이 접수되었습니다.<br/>
          우리 반 관리자가 확인 후 <strong>[승인]</strong> 버튼을 누르면 바로 코드위키의 모든 자료를 볼 수 있어요!
        </p>

        <div style="display:flex; gap:10px; justify-content:center; margin-top:24px;">
          <button id="refreshApprovalBtn" class="toss-primary-btn" style="width:auto; padding:0 22px;">
            승인 상태 새로고침
          </button>
          <button id="pendingLogoutBtn" class="toss-chip-btn" style="height:48px; padding:0 18px;">
            로그아웃
          </button>
        </div>

        ${
          !isSupabaseConfigured
            ? `
          <div class="demo-switcher-box" style="margin-top:24px; text-align:left;">
            <div class="demo-switcher-title">🧪 [미리보기 체험 모드]</div>
            <div class="demo-switcher-btns">
              <button class="toss-chip-btn active" id="switchToAdminFromPending">
                👑 관리자 계정으로 전환해서 '${user.full_name}' 승인해주러 가기 →
              </button>
            </div>
          </div>
        `
            : ""
        }
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

    const switchAdminBtn = document.getElementById("switchToAdminFromPending");
    if (switchAdminBtn) {
      switchAdminBtn.addEventListener("click", () => {
        setDemoSession("admin-1");
        openAdminApprovalModal();
      });
    }
  }

  // 모달: 관리자 전용 [우리 반 학생 승인 관리] 패널
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
            <span class="toss-badge-blue">Admin Only</span>
            <h3 class="admin-modal-title">우리 반 학생 승인 관리</h3>
          </div>
          <button id="closeAdminModalBtn" class="icon-btn">✕</button>
        </div>

        <div class="admin-modal-body">
          <!-- 1. 승인 대기 중 목록 -->
          <div class="admin-group-title">
            <span>🟡 승인 대기 중인 친구들</span>
            <span class="count-pill">${pendingList.length}명</span>
          </div>
          ${
            pendingList.length === 0
              ? `<div class="admin-empty-box">현재 승인 대기 중인 신청자가 없습니다.</div>`
              : `<div class="admin-user-list">
                  ${pendingList
                    .map(
                      u => `
                    <div class="admin-user-row">
                      <div>
                        <div class="admin-user-name">${u.full_name}</div>
                        <div class="admin-user-email">${u.email} · 신청: ${u.created_at || ""}</div>
                      </div>
                      <div class="admin-action-btns">
                        <button class="approve-btn" data-uid="${u.id}" data-next="approved">승인하기</button>
                        <button class="reject-btn" data-uid="${u.id}" data-next="rejected">거절</button>
                      </div>
                    </div>
                  `
                    )
                    .join("")}
                </div>`
          }

          <!-- 2. 승인 완료된 우리 반 목록 -->
          <div class="admin-group-title" style="margin-top:26px;">
            <span>🟢 승인 완료된 우리 반 멤버</span>
            <span class="count-pill">${approvedList.length}명</span>
          </div>
          ${
            approvedList.length === 0
              ? `<div class="admin-empty-box">아직 승인된 학생이 없습니다.</div>`
              : `<div class="admin-user-list">
                  ${approvedList
                    .map(
                      u => `
                    <div class="admin-user-row">
                      <div>
                        <div class="admin-user-name">${u.full_name} <span class="approved-tag">열람 가능</span></div>
                        <div class="admin-user-email">${u.email}</div>
                      </div>
                      <div class="admin-action-btns">
                        <button class="revoke-btn" data-uid="${u.id}" data-next="pending">승인 취소</button>
                      </div>
                    </div>
                  `
                    )
                    .join("")}
                </div>`
          }

          <div class="admin-footer-tip">
            💡 <strong>실제 배포 안내:</strong> 현재는 브라우저에서 즉시 테스트 가능한 프리뷰 모드입니다. 프로젝트 루트의 <code>supabase-setup.sql</code> 안내에 따라 무료 Supabase URL과 Key를 <code>js/auth.js</code>에 넣으시면 실제 DB로 즉시 전환됩니다!
          </div>
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
