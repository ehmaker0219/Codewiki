/**
 * ============================================================================
 * [우리 반 위키 수정·업데이트 건의 게시판: js/board.js]
 * ----------------------------------------------------------------------------
 * - 로그인한 우리 반 학생들이 공부하다가 추가/수정할 내용을 남기는 게시판입니다.
 * - 관리자(본인)는 건의글을 확인하고 [AI 요청용 복사]로 손쉽게 업데이트한 뒤,
 *   [반영 완료] 상태로 변경하거나 한 줄 답변을 남길 수 있습니다.
 * - 현재는 LocalStorage 기반으로 즉시 작동하며, 추후 Supabase 연동 시 자동 전환됩니다.
 * ============================================================================
 */
(function () {
  const DEMO_POSTS_KEY = "codewiki_feedback_posts_v1";

  const initialSamplePosts = [
    {
      id: 102,
      author_id: "stu-3",
      author_name: "박준형",
      category: "내용 추가",
      target_doc_id: "ch02-ddic",
      target_doc_title: "[02-2] Data Dictionary (SE11) 및 테이블 관리",
      title: "SE11 테이블 만들 때 통화/수량 참조필드 에러 내용도 넣어주세요!",
      content: "오늘 실습하다가 CURR(금액) 필드 넣었을 때 Currency/Quantity Fields 탭에 CUKY 연결 안 해서 활성화 에러 다들 엄청 났는데, 주의사항 콜아웃 박스로 추가되면 좋을 것 같아요!",
      status: "open",
      admin_note: "",
      created_at: "2026-11-17 10:15"
    },
    {
      id: 101,
      author_id: "stu-3",
      author_name: "박준형",
      category: "수정 요청",
      target_doc_id: "ch01-erp-overview",
      target_doc_title: "[01-1] SAP ERP 시스템 개요 및 화면 구성",
      title: "자주 쓰는 단축키 정리 표 건의합니다",
      content: "/n (현재 트랜잭션 종료 후 이동), /o (새 세션 창 열기), /nex (저장 없이 즉시 로그오프) 비교 표가 01-1에 있으면 편할 것 같습니다!",
      status: "done",
      admin_note: "좋은 아이디어! 01-1 정리할 때 상단 표로 바로 반영할게 🙌",
      created_at: "2026-11-16 19:40"
    }
  ];

  function getLocalPosts() {
    try {
      const raw = localStorage.getItem(DEMO_POSTS_KEY);
      if (!raw) {
        localStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(initialSamplePosts));
        return initialSamplePosts;
      }
      return JSON.parse(raw);
    } catch (e) {
      return initialSamplePosts;
    }
  }

  function saveLocalPosts(posts) {
    localStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(posts));
  }

  async function fetchPosts() {
    const isSupa = window.CodeWikiAuth?.isSupabaseConfigured();
    const client = window.CodeWikiAuth?.getSupabaseClient();
    if (!isSupa || !client) {
      return getLocalPosts();
    }
    const { data } = await client
      .from("feedback_posts")
      .select("*")
      .order("created_at", { ascending: false });
    return data || [];
  }

  let currentFilter = "all"; // 'all' | 'open' | 'done'
  let isBoardViewActive = false;

  const articleContainer = document.getElementById("articleContainer");
  const navboxCard = document.getElementById("navboxCard");
  const sidebarRight = document.querySelector(".sidebar-right");
  const writeModal = document.getElementById("boardWriteModal");
  const openBoardBtn = document.getElementById("openBoardBtn");
  const boardOpenCountBadge = document.getElementById("boardOpenCountBadge");

  // 상단 게시판 미반영 건수 배지 업데이트
  async function refreshBadge() {
    const posts = await fetchPosts();
    const openCount = posts.filter(p => p.status === "open").length;
    if (boardOpenCountBadge) {
      if (openCount > 0) {
        boardOpenCountBadge.textContent = openCount;
        boardOpenCountBadge.classList.remove("hidden");
      } else {
        boardOpenCountBadge.classList.add("hidden");
      }
    }
  }

  // 게시판 뷰 열기 (중앙 메인 영역을 건의 게시판으로 전환)
  async function openBoardView() {
    isBoardViewActive = true;
    if (openBoardBtn) openBoardBtn.classList.add("active");
    if (navboxCard) navboxCard.classList.add("hidden");
    if (sidebarRight) sidebarRight.classList.add("hidden");
    document.querySelector(".app-shell")?.classList.add("board-mode-shell");

    // 좌측 메뉴 활성 표시 잠시 해제
    document.querySelectorAll(".nav-doc-link.active").forEach(el => el.classList.remove("active"));
    document.getElementById("sbHomeItem")?.classList.remove("active");

    const posts = await fetchPosts();
    const currentUser = window.CodeWikiAuth?.getCurrentUser();
    const isAdmin = currentUser?.role === "admin";

    const openCount = posts.filter(p => p.status === "open").length;
    const doneCount = posts.filter(p => p.status === "done").length;

    const filtered = posts.filter(p => {
      if (currentFilter === "open") return p.status === "open";
      if (currentFilter === "done") return p.status === "done";
      return true;
    });

    articleContainer.innerHTML = `
      <div class="board-header-wrap">
        <div>
          <span class="category-crumb">우리 반 참여 공간</span>
          <h1 class="article-main-title" style="margin-top:10px;">수정 · 업데이트 건의 게시판</h1>
          <p class="article-subtitle" style="margin-bottom:0;">
            공부하다가 오타를 발견했거나 새로 추가했으면 하는 수업 내용이 있다면 자유롭게 남겨주세요!
          </p>
        </div>
        <button id="openWriteModalFromBoard" class="toss-primary-btn" style="width:auto; padding:0 22px; height:44px; margin-top:0;">
          + 건의글 남기기
        </button>
      </div>

      <div class="board-filter-bar">
        <div class="board-filter-tabs">
          <button class="toss-chip-btn ${currentFilter === "all" ? "active" : ""}" data-filter="all">
            전체 (${posts.length})
          </button>
          <button class="toss-chip-btn ${currentFilter === "open" ? "active" : ""}" data-filter="open">
            🟡 반영 대기 (${openCount})
          </button>
          <button class="toss-chip-btn ${currentFilter === "done" ? "active" : ""}" data-filter="done">
            🟢 반영 완료 (${doneCount})
          </button>
        </div>
        <button id="backToWikiBtn" class="toss-chip-btn">
          ← 위키 문서로 돌아가기
        </button>
      </div>

      <div class="board-post-list">
        ${
          filtered.length === 0
            ? `<div class="admin-empty-box" style="padding:40px 20px;">등록된 건의글이 없습니다. 첫 의견을 남겨보세요!</div>`
            : filtered
                .map(post => {
                  const isDone = post.status === "done";
                  const canDelete = isAdmin || (currentUser && post.author_id === currentUser.id);
                  return `
                  <div class="board-post-card ${isDone ? "post-done" : ""}">
                    <div class="board-post-top">
                      <div class="board-post-badges">
                        <span class="status-pill ${isDone ? "done" : "open"}">
                          ${isDone ? "✓ 반영 완료" : "● 확인 대기 중"}
                        </span>
                        <span class="cat-type-pill">${post.category}</span>
                        ${
                          post.target_doc_id
                            ? `<a href="#doc/${post.target_doc_id}" class="doc-ref-pill" data-jump-doc="${post.target_doc_id}">
                                📄 ${post.target_doc_title || post.target_doc_id}
                               </a>`
                            : `<span class="doc-ref-pill">📄 전체 / 새 주제</span>`
                        }
                      </div>
                      <div class="board-post-meta">
                        <strong>${post.author_name}</strong> · ${String(post.created_at).slice(0, 16)}
                      </div>
                    </div>

                    <h3 class="board-post-title">${escapeHtml(post.title)}</h3>
                    <p class="board-post-content">${escapeHtml(post.content)}</p>

                    ${
                      post.admin_note
                        ? `
                      <div class="board-admin-reply">
                        <span class="reply-badge">관리자 답변</span>
                        <span>${escapeHtml(post.admin_note)}</span>
                      </div>
                    `
                        : ""
                    }

                    <div class="board-post-actions">
                      ${
                        isAdmin
                          ? `
                        <button class="board-action-btn copy-prompt-btn" data-post-id="${post.id}" title="클릭 후 AI 채팅창에 그대로 붙여넣어 수정을 지시하세요!">
                          📋 AI 수정 요청용 복사
                        </button>
                        <button class="board-action-btn toggle-status-btn" data-post-id="${post.id}">
                          ${isDone ? "대기 상태로 되돌리기" : "✓ 반영 완료 처리"}
                        </button>
                        <button class="board-action-btn reply-note-btn" data-post-id="${post.id}">
                          💬 답변 메모
                        </button>
                      `
                          : ""
                      }
                      ${
                        canDelete
                          ? `
                        <button class="board-action-btn delete-post-btn" data-post-id="${post.id}">
                          삭제
                        </button>
                      `
                          : ""
                      }
                    </div>
                  </div>
                `;
                })
                .join("")
        }
      </div>
    `;

    // 필터 탭 이벤트
    articleContainer.querySelectorAll("[data-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        currentFilter = btn.getAttribute("data-filter");
        openBoardView();
      });
    });

    // 위키로 돌아가기 버튼
    document.getElementById("backToWikiBtn")?.addEventListener("click", () => {
      closeBoardViewAndReturn();
    });

    // 글쓰기 모달 열기
    document.getElementById("openWriteModalFromBoard")?.addEventListener("click", () => {
      openWriteModal("");
    });

    // 문서 바로가기 링크 클릭
    articleContainer.querySelectorAll("[data-jump-doc]").forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        const docId = link.getAttribute("data-jump-doc");
        closeBoardViewAndReturn(docId);
      });
    });

    // 관리자: AI 프롬프트 복사 버튼
    articleContainer.querySelectorAll(".copy-prompt-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const pid = Number(btn.getAttribute("data-post-id"));
        const post = posts.find(p => p.id === pid);
        if (!post) return;
        const promptText = `[코드위키 건의사항 반영 요청]\n- 구분: ${post.category}\n- 대상 문서: ${
          post.target_doc_title || "새 문서/전체"
        } (${post.target_doc_id || "신규"})\n- 건의 제목: ${post.title}\n- 상세 내용: ${post.content}\n\n위 건의 내용을 바탕으로 코드위키 문서를 알맞은 시각적 블록으로 업데이트해줘!`;
        navigator.clipboard.writeText(promptText);
        btn.textContent = "✓ 복사됨! AI에게 붙여넣기 하세요";
        setTimeout(() => {
          btn.textContent = "📋 AI 수정 요청용 복사";
        }, 2000);
      });
    });

    // 관리자: 반영 완료 / 대기 토글
    articleContainer.querySelectorAll(".toggle-status-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const pid = Number(btn.getAttribute("data-post-id"));
        const target = posts.find(p => p.id === pid);
        if (!target) return;
        const nextStatus = target.status === "done" ? "open" : "done";

        const isSupa = window.CodeWikiAuth?.isSupabaseConfigured();
        const client = window.CodeWikiAuth?.getSupabaseClient();
        if (!isSupa || !client) {
          const updated = getLocalPosts().map(p => (p.id === pid ? { ...p, status: nextStatus } : p));
          saveLocalPosts(updated);
        } else {
          await client.from("feedback_posts").update({ status: nextStatus }).eq("id", pid);
        }
        await refreshBadge();
        openBoardView();
      });
    });

    // 관리자: 한 줄 답변 메모 남기기
    articleContainer.querySelectorAll(".reply-note-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const pid = Number(btn.getAttribute("data-post-id"));
        const target = posts.find(p => p.id === pid);
        if (!target) return;
        const note = window.prompt("건의한 친구에게 보여줄 관리자 답변 메모를 입력하세요:", target.admin_note || "반영 완료했어! 고마워 🙌");
        if (note === null) return;

        const isSupa = window.CodeWikiAuth?.isSupabaseConfigured();
        const client = window.CodeWikiAuth?.getSupabaseClient();
        if (!isSupa || !client) {
          const updated = getLocalPosts().map(p =>
            p.id === pid ? { ...p, admin_note: note.trim(), status: note.trim() ? "done" : p.status } : p
          );
          saveLocalPosts(updated);
        } else {
          await client
            .from("feedback_posts")
            .update({ admin_note: note.trim(), status: note.trim() ? "done" : target.status })
            .eq("id", pid);
        }
        await refreshBadge();
        openBoardView();
      });
    });

    // 삭제 버튼
    articleContainer.querySelectorAll(".delete-post-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const pid = Number(btn.getAttribute("data-post-id"));
        const isSupa = window.CodeWikiAuth?.isSupabaseConfigured();
        const client = window.CodeWikiAuth?.getSupabaseClient();
        if (!isSupa || !client) {
          const updated = getLocalPosts().filter(p => p.id !== pid);
          saveLocalPosts(updated);
        } else {
          await client.from("feedback_posts").delete().eq("id", pid);
        }
        await refreshBadge();
        openBoardView();
      });
    });
  }

  function closeBoardViewAndReturn(targetDocId) {
    isBoardViewActive = false;
    if (openBoardBtn) openBoardBtn.classList.remove("active");
    if (navboxCard) navboxCard.classList.remove("hidden");
    if (sidebarRight) sidebarRight.classList.remove("hidden");
    document.querySelector(".app-shell")?.classList.remove("board-mode-shell");

    if (window.CodeWikiApp) {
      window.CodeWikiApp.openDoc(targetDocId || window.CodeWikiApp.getCurrentDocId());
    }
  }

  // 건의글 작성 모달 열기 (특정 문서 하단에서 누르면 preselectedDocId가 자동 선택됨!)
  function openWriteModal(preselectedDocId) {
    const docs = Object.values(window.WIKI_DOCS || {});
    const currentUser = window.CodeWikiAuth?.getCurrentUser();
    const authorName = currentUser?.full_name || "익명 학생";

    writeModal.classList.remove("hidden");
    writeModal.innerHTML = `
      <div class="admin-modal-card toss-card" style="max-width:540px;">
        <div class="admin-modal-header">
          <div>
            <span class="toss-badge-blue">건의하기</span>
            <h3 class="admin-modal-title">수정 · 업데이트 의견 남기기</h3>
          </div>
          <button id="closeWriteModalBtn" class="icon-btn">✕</button>
        </div>

        <form id="boardWriteForm" class="auth-form">
          <div class="auth-field">
            <label>작성자</label>
            <input type="text" value="${escapeHtml(authorName)}" disabled style="opacity:0.7;" />
          </div>

          <div class="auth-field">
            <label>건의 유형</label>
            <select id="postCategory" class="toss-select">
              <option value="내용 추가">➕ 내용 추가 요청 (수업 내용 보충)</option>
              <option value="수정 요청">✏️ 기존 내용 수정 요청</option>
              <option value="오타·오류">🚨 오타 · 오류 제보</option>
              <option value="질문·기타">💬 질문 · 기타 의견</option>
            </select>
          </div>

          <div class="auth-field">
            <label>관련 문서 (선택)</label>
            <select id="postTargetDoc" class="toss-select">
              <option value="">전체 / 새로운 문서 주제 건의</option>
              ${docs
                .map(
                  d => `
                <option value="${d.id}" ${d.id === preselectedDocId ? "selected" : ""}>
                  ${d.stepNum ? `[${d.stepNum}] ` : ""}${d.title}
                </option>
              `
                )
                .join("")}
            </select>
          </div>

          <div class="auth-field">
            <label>제목</label>
            <input type="text" id="postTitle" placeholder="예: SE11 도메인 고정값 설명도 추가해주세요!" required />
          </div>

          <div class="auth-field">
            <label>상세 내용</label>
            <textarea id="postContent" class="toss-textarea" rows="4" placeholder="수업에서 배운 내용이나 고쳐야 할 부분을 편하게 적어주세요." required></textarea>
          </div>

          <button type="submit" class="toss-primary-btn">건의글 등록하기</button>
        </form>
      </div>
    `;

    document.getElementById("closeWriteModalBtn").addEventListener("click", () => {
      writeModal.classList.add("hidden");
    });

    document.getElementById("boardWriteForm").addEventListener("submit", async e => {
      e.preventDefault();
      const category = document.getElementById("postCategory").value;
      const targetDocId = document.getElementById("postTargetDoc").value;
      const targetDocObj = window.WIKI_DOCS?.[targetDocId];
      const targetDocTitle = targetDocObj
        ? `${targetDocObj.stepNum ? `[${targetDocObj.stepNum}] ` : ""}${targetDocObj.title}`
        : "";
      const title = document.getElementById("postTitle").value.trim();
      const content = document.getElementById("postContent").value.trim();

      const isSupa = window.CodeWikiAuth?.isSupabaseConfigured();
      const client = window.CodeWikiAuth?.getSupabaseClient();

      if (!isSupa || !client) {
        const list = getLocalPosts();
        const now = new Date();
        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
          now.getDate()
        ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        list.unshift({
          id: Date.now(),
          author_id: currentUser?.id || "guest",
          author_name: authorName,
          category,
          target_doc_id: targetDocId,
          target_doc_title: targetDocTitle,
          title,
          content,
          status: "open",
          admin_note: "",
          created_at: timeStr
        });
        saveLocalPosts(list);
      } else {
        await client.from("feedback_posts").insert({
          author_id: currentUser?.id,
          author_name: authorName,
          category,
          target_doc_id: targetDocId || null,
          target_doc_title: targetDocTitle || null,
          title,
          content,
          status: "open"
        });
      }

      writeModal.classList.add("hidden");
      await refreshBadge();
      openBoardView();
    });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  writeModal?.addEventListener("click", e => {
    if (e.target === writeModal) writeModal.classList.add("hidden");
  });

  openBoardBtn?.addEventListener("click", () => {
    if (isBoardViewActive) {
      closeBoardViewAndReturn();
    } else {
      openBoardView();
    }
  });

  window.CodeWikiBoard = {
    openBoardView,
    openWriteModal,
    closeIfActive() {
      if (isBoardViewActive) {
        isBoardViewActive = false;
        if (openBoardBtn) openBoardBtn.classList.remove("active");
        if (navboxCard) navboxCard.classList.remove("hidden");
        if (sidebarRight) sidebarRight.classList.remove("hidden");
        document.querySelector(".app-shell")?.classList.remove("board-mode-shell");
      }
    },
    refreshBadge
  };

  refreshBadge();
})();
