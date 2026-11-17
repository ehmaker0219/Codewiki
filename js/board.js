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
  const DEMO_POSTS_KEY = "codewiki_feedback_posts_v2";

  const initialSamplePosts = [];

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
    const token = window.CodeWikiAuth?.getSessionToken();
    if (!isSupa || !client) {
      return getLocalPosts();
    }
    if (!token) return [];
    const { data } = await client.rpc("cw_list_posts", { p_token: token });
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
          <h1 class="article-main-title">건의 게시판</h1>
        </div>
        <button id="openWriteModalFromBoard" class="toss-primary-btn" style="width:auto; padding:0 20px; height:40px; margin-top:0;">
          + 글쓰기
        </button>
      </div>

      <div class="board-filter-bar">
        <div class="board-filter-tabs">
          <button class="toss-chip-btn ${currentFilter === "all" ? "active" : ""}" data-filter="all">
            전체 (${posts.length})
          </button>
          <button class="toss-chip-btn ${currentFilter === "open" ? "active" : ""}" data-filter="open">
            <span class="board-status-dot is-open" aria-hidden="true"></span> 반영 대기 (${openCount})
          </button>
          <button class="toss-chip-btn ${currentFilter === "done" ? "active" : ""}" data-filter="done">
            <span class="board-status-dot is-done" aria-hidden="true"></span> 반영 완료 (${doneCount})
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
                            ? `<a href="#doc/${escapeHtml(post.target_doc_id)}" class="doc-ref-pill" data-jump-doc="${escapeHtml(post.target_doc_id)}">
                                📄 ${escapeHtml(post.target_doc_title || post.target_doc_id)}
                               </a>`
                            : `<span class="doc-ref-pill">📄 전체 / 새 주제</span>`
                        }
                      </div>
                      <div class="board-post-meta">
                        ${post.author_class ? `<span style="opacity:0.8;">[${escapeHtml(post.author_class)}]</span> ` : ""}${post.author_mbti ? `<span class="toss-badge-blue" style="font-size:10.5px; padding:1px 6px; margin-right:4px;">${escapeHtml(post.author_mbti)}</span>` : ""}<strong>${escapeHtml(post.author_name)}</strong> · ${String(post.created_at).slice(0, 16)}
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
          await client.rpc("cw_update_post", {
            p_token: window.CodeWikiAuth?.getSessionToken(),
            p_post_id: pid,
            p_status: nextStatus,
            p_admin_note: target.admin_note || ""
          });
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
        openReplyModal(target, btn);
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
          await client.rpc("cw_delete_post", {
            p_token: window.CodeWikiAuth?.getSessionToken(),
            p_post_id: pid
          });
        }
        await refreshBadge();
        openBoardView();
      });
    });
  }

  function openReplyModal(target, trigger) {
    writeModal.classList.remove("hidden");
    writeModal.innerHTML = `
      <div class="admin-modal-card toss-card" role="dialog" aria-modal="true" aria-labelledby="replyTitle" style="max-width:540px;">
        <div class="admin-modal-header">
          <h3 id="replyTitle" class="admin-modal-title">관리자 답변 메모</h3>
          <button type="button" id="closeReplyBtn" class="icon-btn" aria-label="답변 창 닫기">✕</button>
        </div>
        <p>${escapeHtml(target.title)}</p>
        <form id="replyForm" class="auth-form">
          <div class="auth-field">
            <label for="replyNote">답변 내용</label>
            <textarea id="replyNote" rows="5" placeholder="작성자에게 전달할 답변을 입력하세요."></textarea>
          </div>
          <label><input id="replyDone" type="checkbox" ${target.status === "done" ? "checked" : ""}> 반영 완료로 표시</label>
          <p id="replyError" role="alert" style="color:var(--toss-red, #c53030);"></p>
          <button type="submit" id="saveReplyBtn" class="toss-chip-btn">답변 저장</button>
        </form>
      </div>`;
    const form = document.getElementById("replyForm");
    const input = document.getElementById("replyNote");
    const save = document.getElementById("saveReplyBtn");
    const close = document.getElementById("closeReplyBtn");
    let saving = false;
    input.value = target.admin_note || "";
    input.focus();
    const dismiss = () => {
      if (saving) return;
      writeModal.classList.add("hidden");
      trigger?.focus();
    };
    close.addEventListener("click", dismiss);
    form.addEventListener("keydown", e => { if (e.key === "Escape") dismiss(); });
    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (saving) return;
      saving = true;
      save.disabled = close.disabled = true;
      save.textContent = "저장 중…";
      const errorBox = document.getElementById("replyError");
      errorBox.textContent = "";
      try {
        const note = input.value.trim();
        const status = document.getElementById("replyDone").checked ? "done" : "open";
        const isSupa = window.CodeWikiAuth?.isSupabaseConfigured();
        const client = window.CodeWikiAuth?.getSupabaseClient();
        if (isSupa) {
          if (!client) throw new Error("서버 연결을 확인한 뒤 다시 시도해 주세요.");
          const { error } = await client.rpc("cw_update_post", {
            p_token: window.CodeWikiAuth?.getSessionToken(),
            p_post_id: target.id, p_status: status, p_admin_note: note
          });
          if (error) throw error;
        } else {
          saveLocalPosts(getLocalPosts().map(p => p.id === target.id ? { ...p, admin_note: note, status } : p));
        }
        writeModal.classList.add("hidden");
        await refreshBadge();
        await openBoardView();
      } catch (error) {
        errorBox.textContent = `답변을 저장하지 못했습니다. ${error.message || "잠시 후 다시 시도해 주세요."}`;
      } finally {
        saving = false;
        save.disabled = close.disabled = false;
        save.textContent = "답변 저장";
      }
    });
  }

  function closeBoardViewAndReturn(targetDocId) {
    isBoardViewActive = false;
    if (openBoardBtn) openBoardBtn.classList.remove("active");
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
            <input type="text" id="postTitle" placeholder="건의 제목을 입력하세요" required />
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
          author_class: currentUser?.class_name || "",
          author_mbti: currentUser?.mbti || "",
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
        await client.rpc("cw_create_post", {
          p_token: window.CodeWikiAuth?.getSessionToken(),
          p_category: category,
          p_target_doc_id: targetDocId || null,
          p_target_doc_title: targetDocTitle || null,
          p_title: title,
          p_content: content
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
        document.querySelector(".app-shell")?.classList.remove("board-mode-shell");
      }
    },
    refreshBadge
  };

  refreshBadge();
})();
