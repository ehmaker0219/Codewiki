/**
 * ============================================================================
 * [코어 렌더링 엔진: js/app.js]
 * ----------------------------------------------------------------------------
 * 위키독스(WikiDocs) 스타일의 순차 커리큘럼 플로우(좌측 챕터 트리 + 하단 이전/다음
 * 네비게이션 + 학습 완료 체크)와 나무위키식 상호 링크/역링크를 렌더링합니다.
 * ============================================================================
 */
(function () {
  let currentDocId = "welcome-guide";
  const READ_DOCS_KEY = "codewiki_read_docs_v1";
  const expandedCategories = new Set(["ch00", "ch01", "ch02"]);

  const categoryNav = document.getElementById("categoryNav");
  const totalDocCount = document.getElementById("totalDocCount");
  const tcodeList = document.getElementById("tcodeList");
  const navboxBody = document.getElementById("navboxBody");
  const articleContainer = document.getElementById("articleContainer");
  const tocList = document.getElementById("tocList");
  const summarySpecBox = document.getElementById("summarySpecBox");
  const backlinkBox = document.getElementById("backlinkBox");
  const hoverPreviewCard = document.getElementById("hoverPreviewCard");
  const sbHomeItem = document.getElementById("sbHomeItem");

  function getReadDocs() {
    try {
      return JSON.parse(localStorage.getItem(READ_DOCS_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function toggleReadDoc(docId) {
    const list = new Set(getReadDocs());
    if (list.has(docId)) {
      list.delete(docId);
    } else {
      list.add(docId);
    }
    localStorage.setItem(READ_DOCS_KEY, JSON.stringify([...list]));
    renderDocument(currentDocId);
  }

  function getCategoryName(categoryId) {
    const found = (window.WIKI_CATEGORIES || []).find(c => c.id === categoryId);
    return found ? found.name : categoryId;
  }

  // 인라인 문법 파서: [[id|이름]], {{빈칸키워드}}, ~~취소선~~, **굵게**, `코드`
  function parseInline(text) {
    if (!text) return "";
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/~~(.+?)~~/g, '<del class="wiki-del" title="취소선 메모">$1</del>')
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\{\{(.+?)\}\}/g, '<span class="quiz-token" title="클릭하여 정답 확인">$1</span>')
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, targetId, label) => {
        const id = targetId.trim();
        const targetDoc = window.WIKI_DOCS[id];
        const textLabel = label ? label.trim() : targetDoc ? targetDoc.title : id;
        return `<a href="#doc/${id}" class="wiki-link" data-doc="${id}">${textLabel}</a>`;
      });
  }

  // 특정 문서를 참조하는 역링크(Backlinks) 자동 검색
  function computeBacklinks(targetId) {
    const escaped = targetId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\[\\[${escaped}(?:\\|[^\\]]+)?\\]\\]`, "i");
    return Object.values(window.WIKI_DOCS).filter(doc => {
      if (doc.id === targetId) return false;
      const raw = JSON.stringify(doc.sections || []) + (doc.summary || "");
      return pattern.test(raw);
    });
  }

  // 좌측 고정 사이드바(Quest-On 스타일 폴더 트리) & 상단 둘러보기 틀 렌더링
  function renderNavigation() {
    const allDocs = Object.values(window.WIKI_DOCS);
    const readSet = new Set(getReadDocs());
    totalDocCount.textContent = `${readSet.size}/${allDocs.length} 완료`;

    if (sbHomeItem) {
      sbHomeItem.classList.toggle("active", currentDocId === "welcome-guide");
    }

    // 현재 보고 있는 문서의 부모 폴더는 자동 펼침
    const curDoc = window.WIKI_DOCS[currentDocId];
    if (curDoc?.categoryId) {
      expandedCategories.add(curDoc.categoryId);
    }

    // 1) 좌측 사이드바 폴더 리스트 (Quest-On FOLDERS 감성)
    categoryNav.innerHTML = (window.WIKI_CATEGORIES || [])
      .map(cat => {
        const docsInCat = allDocs.filter(d => d.categoryId === cat.id);
        const isOpen = expandedCategories.has(cat.id);
        const hasActiveChild = docsInCat.some(d => d.id === currentDocId);

        return `
          <div class="sb-folder-group ${isOpen ? "open" : ""}">
            <button type="button" class="sb-folder-row ${hasActiveChild ? "has-active" : ""}" data-toggle-cat="${cat.id}">
              <svg class="sb-folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span class="sb-folder-name">${cat.name}</span>
              ${
                docsInCat.length === 0
                  ? `<span class="empty-ch-tag">예정</span>`
                  : `<svg class="sb-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                     </svg>`
              }
            </button>
            ${
              isOpen && docsInCat.length > 0
                ? `
              <div class="sb-folder-children">
                ${docsInCat
                  .map(
                    d => `
                  <a href="#doc/${d.id}" class="nav-doc-link ${d.id === currentDocId ? "active" : ""}" data-doc="${d.id}">
                    <span class="step-num-badge">${d.stepNum || "문서"}</span>
                    <span class="nav-doc-title-text">${d.title}</span>
                    ${readSet.has(d.id) ? `<span class="read-check-mark" title="학습 완료">✓</span>` : ""}
                  </a>
                `
                  )
                  .join("")}
              </div>
            `
                : ""
            }
          </div>
        `;
      })
      .join("");

    // 폴더 클릭 시 펼치기/접기 토글
    categoryNav.querySelectorAll("[data-toggle-cat]").forEach(btn => {
      btn.addEventListener("click", () => {
        const catId = btn.getAttribute("data-toggle-cat");
        if (expandedCategories.has(catId)) {
          expandedCategories.delete(catId);
        } else {
          expandedCategories.add(catId);
        }
        renderNavigation();
        bindWikiLinks();
      });
    });

    // 2) 상단 나무위키식 둘러보기 틀
    navboxBody.innerHTML = (window.WIKI_CATEGORIES || [])
      .map(cat => {
        const docsInCat = allDocs.filter(d => d.categoryId === cat.id);
        if (docsInCat.length === 0) return "";
        return `
          <div class="navbox-grid-row">
            <div class="navbox-cat-name">${cat.name}</div>
            <div class="navbox-links-wrap">
              ${docsInCat
                .map(
                  d => `
                <a href="#doc/${d.id}" class="wiki-link" data-doc="${d.id}">
                  ${d.stepNum ? `<small style="opacity:0.75;">[${d.stepNum}]</small> ` : ""}${d.title}
                </a>
              `
                )
                .join("")}
            </div>
          </div>
        `;
      })
      .join("");

    // 3) 좌측 T-Code 사전
    tcodeList.innerHTML = (window.WIKI_TCODES || [])
      .map(
        t => `
        <div class="tcode-chip" data-doc="${t.docId}" title="${t.label}">
          <code>${t.code}</code>
          <span>${t.label}</span>
        </div>
      `
      )
      .join("");

    tcodeList.querySelectorAll(".tcode-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        navigateTo(chip.getAttribute("data-doc"));
      });
    });
  }

  // 개별 블록(Block) 렌더러 (8종 블록 지원: practice 따라하기 블록 포함)
  function renderBlock(block, blockIdx) {
    switch (block.type) {
      case "text":
        return (block.paragraphs || [])
          .map(p => `<p class="block-p">${parseInline(p)}</p>`)
          .join("");

      case "practice":
        return `
          <div class="block-practice">
            ${block.title ? `<div class="practice-header">🖥️ ${parseInline(block.title)}</div>` : ""}
            <div class="practice-steps">
              ${(block.steps || [])
                .map(
                  st => `
                <div class="practice-step-row">
                  <div class="practice-step-num">${st.step}</div>
                  <div class="practice-step-body">
                    <div class="practice-step-action">${parseInline(st.action)}</div>
                    ${st.detail ? `<div class="practice-step-detail">${parseInline(st.detail)}</div>` : ""}
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        `;

      case "flow":
        return `
          <div class="block-flow">
            ${block.caption ? `<div class="flow-caption">${parseInline(block.caption)}</div>` : ""}
            <div class="flow-steps-row">
              ${(block.steps || [])
                .map(
                  (st, i, arr) => `
                  <div class="flow-step-card">
                    ${st.badge ? `<span class="flow-step-badge">${st.badge}</span>` : ""}
                    <div class="flow-step-title">${parseInline(st.title)}</div>
                    <div class="flow-step-desc">${parseInline(st.desc)}</div>
                  </div>
                  ${i < arr.length - 1 ? `<div class="flow-arrow">→</div>` : ""}
                `
                )
                .join("")}
            </div>
          </div>
        `;

      case "compare":
        return `
          <div class="block-compare-grid">
            ${(block.items || [])
              .map(
                item => `
                <div class="compare-card">
                  ${item.tag ? `<div class="compare-card-tag">${item.tag}</div>` : ""}
                  <div class="compare-card-title">${parseInline(item.title)}</div>
                  <ul class="compare-point-list">
                    ${(item.points || []).map(pt => `<li>${parseInline(pt)}</li>`).join("")}
                  </ul>
                </div>
              `
              )
              .join("")}
          </div>
        `;

      case "callout":
        return `
          <div class="block-callout type-${block.style || "tip"}">
            <div class="callout-title">${parseInline(block.title)}</div>
            <div class="callout-body">${parseInline(block.body)}</div>
          </div>
        `;

      case "table":
        return `
          <div class="block-table-wrap">
            <table class="toss-table">
              <thead>
                <tr>
                  ${(block.headers || []).map(h => `<th>${parseInline(h)}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${(block.rows || [])
                  .map(
                    row => `
                  <tr>
                    ${row.map(cell => `<td>${parseInline(cell)}</td>`).join("")}
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `;

      case "code":
        return `
          <div class="block-code-wrap">
            <div class="code-top-bar">
              <span>${block.label || "ABAP Code"}</span>
              <button class="copy-code-btn" data-code="${encodeURIComponent(block.code || "")}">복사</button>
            </div>
            <pre><code>${(block.code || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
          </div>
        `;

      case "widget":
        return `<div class="block-widget-slot" data-widget-id="${block.widgetId}" id="widget-slot-${blockIdx}"></div>`;

      case "nested": {
        const renderLayer = (node, depth) => {
          if (!node) return "";
          return `
            <div class="nested-box depth-${Math.min(depth, 2)}">
              <div class="nested-header">
                <div class="nested-title-group">
                  ${node.badge ? `<span class="nested-badge">${parseInline(node.badge)}</span>` : ""}
                  <span class="nested-title">${parseInline(node.title)}</span>
                </div>
                ${node.code ? `<span class="tcode-pill-badge">${node.code}</span>` : ""}
              </div>
              ${node.desc ? `<div class="nested-desc">${parseInline(node.desc)}</div>` : ""}
              ${
                node.items && node.items.length > 0
                  ? `
                <div class="nested-items-grid">
                  ${node.items
                    .map(
                      it => `
                    <div class="nested-leaf-chip">
                      <span class="nested-leaf-name">${parseInline(it.name)}</span>
                      ${it.sub ? `<span class="nested-leaf-sub">${parseInline(it.sub)}</span>` : ""}
                    </div>
                  `
                    )
                    .join("")}
                </div>
              `
                  : ""
              }
              ${(node.children || []).map(child => renderLayer(child, depth + 1)).join("")}
            </div>
          `;
        };

        return `
          <div class="block-nested-wrap">
            ${block.caption ? `<div class="nested-caption">${parseInline(block.caption)}</div>` : ""}
            ${renderLayer(block.root, 0)}
          </div>
        `;
      }

      default:
        return "";
    }
  }

  // 메인 문서 렌더링 (하단 위키독스식 이전/다음 챕터 이동 바 포함)
  function renderDocument(docId) {
    const docList = Object.values(window.WIKI_DOCS);
    const currentIndex = docList.findIndex(d => d.id === docId);
    const doc = currentIndex >= 0 ? docList[currentIndex] : docList[0];
    if (!doc) return;
    currentDocId = doc.id;

    const prevDoc = currentIndex > 0 ? docList[currentIndex - 1] : null;
    const nextDoc = currentIndex >= 0 && currentIndex < docList.length - 1 ? docList[currentIndex + 1] : null;
    const isRead = getReadDocs().includes(doc.id);

    const catName = getCategoryName(doc.categoryId);

    let widgetCounter = 0;
    articleContainer.innerHTML = `
      <div class="article-top-meta">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="category-crumb">${catName}</span>
          ${doc.stepNum ? `<span class="tcode-pill-badge">Chapter ${doc.stepNum}</span>` : ""}
        </div>
        <div class="tcode-badge-row">
          ${(doc.tcodes || []).map(tc => `<span class="tcode-pill-badge">T-Code · ${tc}</span>`).join("")}
        </div>
      </div>

      <h1 class="article-main-title">${doc.title}</h1>
      <div class="article-subtitle">${doc.subtitle || ""}</div>

      ${
        doc.summary
          ? `
        <div class="summary-hero-box">
          <span class="summary-hero-icon">📌</span>
          <div class="summary-hero-text">${parseInline(doc.summary)}</div>
        </div>
      `
          : ""
      }

      <div class="doc-sections-wrap">
        ${(doc.sections || [])
          .map(
            (sec, sIdx) => `
          <section class="doc-section" id="sec-${sIdx + 1}">
            <h2 class="doc-sec-title">
              <span class="doc-sec-num">${sIdx + 1}.</span>
              <span>${sec.title}</span>
            </h2>
            ${(sec.blocks || [])
              .map(b => {
                widgetCounter++;
                return renderBlock(b, widgetCounter);
              })
              .join("")}
          </section>
        `
          )
          .join("")}
      </div>

      <!-- 위키독스 스타일 하단 건의하기 & 학습 완료 체크 & [이전 챕터 / 다음 챕터] 네비게이션 -->
      <div class="wikidocs-pager-wrap">
        <div class="read-complete-bar" style="justify-content:space-between; flex-wrap:wrap; gap:10px;">
          <button id="suggestDocEditBtn" class="toss-chip-btn">
            <span>✏️ 이 문서 수정·추가 건의하기</span>
          </button>
          <button id="toggleReadBtn" class="toss-chip-btn ${isRead ? "active" : ""}">
            <span>${isRead ? "✓ 이 챕터 학습 완료됨" : "○ 이 챕터 학습 완료 체크하기"}</span>
          </button>
        </div>
        <div class="pager-grid">
          ${
            prevDoc
              ? `
            <a href="#doc/${prevDoc.id}" class="pager-card prev-pager" data-doc="${prevDoc.id}">
              <span class="pager-dir">← 이전 페이지 (${prevDoc.stepNum || "Prev"})</span>
              <strong class="pager-title">${prevDoc.title}</strong>
            </a>
          `
              : `<div class="pager-card disabled-pager"><span class="pager-dir">첫 번째 페이지입니다</span></div>`
          }
          ${
            nextDoc
              ? `
            <a href="#doc/${nextDoc.id}" class="pager-card next-pager" data-doc="${nextDoc.id}">
              <span class="pager-dir">다음 페이지 (${nextDoc.stepNum || "Next"}) →</span>
              <strong class="pager-title">${nextDoc.title}</strong>
            </a>
          `
              : `<div class="pager-card disabled-pager" style="text-align:right;"><span class="pager-dir">마지막 페이지입니다</span></div>`
          }
        </div>
      </div>
    `;

    // 학습 완료 토글 버튼 & 이 문서 건의하기 버튼
    const toggleReadBtn = document.getElementById("toggleReadBtn");
    if (toggleReadBtn) {
      toggleReadBtn.addEventListener("click", () => toggleReadDoc(doc.id));
    }

    const suggestDocEditBtn = document.getElementById("suggestDocEditBtn");
    if (suggestDocEditBtn) {
      suggestDocEditBtn.addEventListener("click", () => {
        if (window.CodeWikiBoard) window.CodeWikiBoard.openWriteModal(doc.id);
      });
    }

    // 인터랙티브 위젯 슬롯 마운트
    articleContainer.querySelectorAll("[data-widget-id]").forEach(slot => {
      const wId = slot.getAttribute("data-widget-id");
      if (window.WIKI_WIDGETS && typeof window.WIKI_WIDGETS[wId] === "function") {
        window.WIKI_WIDGETS[wId](slot);
      }
    });

    // 코드 복사 버튼 이벤트
    articleContainer.querySelectorAll(".copy-code-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const raw = decodeURIComponent(btn.getAttribute("data-code"));
        navigator.clipboard.writeText(raw);
        btn.textContent = "복사됨 ✓";
        setTimeout(() => {
          btn.textContent = "복사";
        }, 1400);
      });
    });

    // 암기 모드 빈칸 토큰 클릭 시 정답 토글
    articleContainer.querySelectorAll(".quiz-token").forEach(token => {
      token.addEventListener("click", () => {
        token.classList.toggle("revealed");
      });
    });

    // 우측 목차(TOC) 업데이트
    tocList.innerHTML = (doc.sections || [])
      .map(
        (sec, sIdx) => `
        <a href="#sec-${sIdx + 1}" class="toc-link" data-target="sec-${sIdx + 1}">
          ${sIdx + 1}. ${sec.title}
        </a>
      `
      )
      .join("");

    tocList.querySelectorAll(".toc-link").forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        const el = document.getElementById(link.getAttribute("data-target"));
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    // 우측 핵심 요약 스펙 업데이트
    const specEntries = Object.entries(doc.specs || {});
    summarySpecBox.innerHTML =
      specEntries.length === 0
        ? `<div style="font-size:13px; color:var(--text-muted);">등록된 요약 스펙이 없습니다.</div>`
        : specEntries
            .map(
              ([k, v]) => `
            <div class="spec-row">
              <span class="spec-key">${k}</span>
              <span class="spec-val">${v}</span>
            </div>
          `
            )
            .join("");

    // 우측 역링크 업데이트
    const backlinks = computeBacklinks(doc.id);
    backlinkBox.innerHTML =
      backlinks.length === 0
        ? `<div style="font-size:13px; color:var(--text-muted);">아직 이 문서를 가리키는 문서가 없습니다.</div>`
        : backlinks
            .map(
              b => `
            <a href="#doc/${b.id}" class="backlink-pill wiki-link" data-doc="${b.id}">
              ↰ ${b.title}
            </a>
          `
            )
            .join("");

    renderNavigation();
    bindWikiLinks();
  }

  function navigateTo(docId) {
    if (!window.WIKI_DOCS[docId]) return;
    if (window.CodeWikiBoard) window.CodeWikiBoard.closeIfActive();
    window.location.hash = `#doc/${docId}`;
    renderDocument(docId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  window.CodeWikiApp = {
    openDoc: navigateTo,
    getCurrentDocId: () => currentDocId
  };

  function bindWikiLinks() {
    document.querySelectorAll("[data-doc]").forEach(el => {
      el.onclick = e => {
        e.preventDefault();
        const targetId = el.getAttribute("data-doc");
        hoverPreviewCard.classList.add("hidden");
        navigateTo(targetId);
      };

      if (el.classList.contains("wiki-link")) {
        el.onmouseenter = e => {
          const targetId = el.getAttribute("data-doc");
          const targetDoc = window.WIKI_DOCS[targetId];
          if (!targetDoc) return;

          hoverPreviewCard.innerHTML = `
            <span class="preview-cat-badge">${getCategoryName(targetDoc.categoryId)}</span>
            <div class="preview-doc-title">${targetDoc.title}</div>
            <div class="preview-doc-summary">${(targetDoc.summary || "").replace(/~~.+?~~/g, "").replace(/\{\{(.+?)\}\}/g, "$1")}</div>
          `;
          hoverPreviewCard.classList.remove("hidden");
          movePreviewCard(e);
        };

        el.onmousemove = movePreviewCard;
        el.onmouseleave = () => hoverPreviewCard.classList.add("hidden");
      }
    });
  }

  function movePreviewCard(e) {
    let x = e.clientX + 16;
    let y = e.clientY + 16;
    if (x + 320 > window.innerWidth) x = e.clientX - 326;
    if (y + 160 > window.innerHeight) y = e.clientY - 150;
    hoverPreviewCard.style.left = `${x}px`;
    hoverPreviewCard.style.top = `${y}px`;
  }

  function initSearch() {
    const searchInput = document.getElementById("searchInput");
    const searchDropdown = document.getElementById("searchDropdown");

    window.addEventListener("keydown", e => {
      if (e.key === "/" && document.activeElement !== searchInput && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
        e.preventDefault();
        searchInput.focus();
      } else if (e.key === "Escape") {
        searchDropdown.classList.add("hidden");
      }
    });

    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) {
        searchDropdown.classList.add("hidden");
        return;
      }

      const matches = Object.values(window.WIKI_DOCS).filter(
        d =>
          d.title.toLowerCase().includes(q) ||
          (d.subtitle && d.subtitle.toLowerCase().includes(q)) ||
          (d.summary && d.summary.toLowerCase().includes(q)) ||
          (d.tcodes && d.tcodes.some(tc => tc.toLowerCase().includes(q)))
      );

      if (matches.length === 0) {
        searchDropdown.innerHTML = `<div class="search-item"><span class="search-item-sub">일치하는 문서가 없습니다.</span></div>`;
      } else {
        searchDropdown.innerHTML = matches
          .map(
            d => `
          <div class="search-item" data-doc="${d.id}">
            <div>
              <div class="search-item-title">${d.stepNum ? `[${d.stepNum}] ` : ""}${d.title}</div>
              <div class="search-item-sub">${d.subtitle || getCategoryName(d.categoryId)}</div>
            </div>
            <span class="tcode-pill-badge">${(d.tcodes || [])[0] || "문서"}</span>
          </div>
        `
          )
          .join("");

        searchDropdown.querySelectorAll(".search-item[data-doc]").forEach(item => {
          item.addEventListener("click", () => {
            const target = item.getAttribute("data-doc");
            searchDropdown.classList.add("hidden");
            searchInput.value = "";
            navigateTo(target);
          });
        });
      }
      searchDropdown.classList.remove("hidden");
    });

    document.addEventListener("click", e => {
      if (!e.target.closest(".search-box")) {
        searchDropdown.classList.add("hidden");
      }
    });
  }

  function initControls() {
    const appLayout = document.getElementById("appLayout");
    const toggleBtn = document.getElementById("sidebarToggleBtn");

    toggleBtn?.addEventListener("click", () => {
      const isCollapsed = appLayout?.classList.toggle("sidebar-collapsed");
      toggleBtn.title = isCollapsed ? "사이드바 펼치기" : "사이드바 접기";
    });

    const navboxBodyEl = document.getElementById("navboxBody");
    const navboxFoldBtn = document.getElementById("navboxFoldBtn");
    document.getElementById("navboxToggle").addEventListener("click", () => {
      const hidden = navboxBodyEl.classList.toggle("hidden");
      navboxFoldBtn.textContent = hidden ? "펼치기 ▼" : "접기 ▲";
    });

    const quizModeBtn = document.getElementById("quizModeBtn");
    quizModeBtn.addEventListener("click", () => {
      const isQuiz = document.body.classList.toggle("quiz-mode");
      quizModeBtn.classList.toggle("active", isQuiz);
      quizModeBtn.querySelector("span:last-child").textContent = isQuiz ? "암기 모드 ON" : "암기 모드 OFF";
      if (!isQuiz) {
        document.querySelectorAll(".quiz-token.revealed").forEach(el => el.classList.remove("revealed"));
      }
    });

    const humorModeBtn = document.getElementById("humorModeBtn");
    humorModeBtn.addEventListener("click", () => {
      const hideHumor = document.body.classList.toggle("hide-humor");
      humorModeBtn.classList.toggle("active", !hideHumor);
      humorModeBtn.querySelector("span").textContent = hideHumor ? "취소선 메모 OFF" : "취소선 메모 ON";
    });

    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const themeIcon = document.getElementById("themeIcon");
    themeToggleBtn.addEventListener("click", () => {
      const root = document.documentElement;
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      themeIcon.textContent = next === "light" ? "🌙" : "☀️";
    });
  }

  function init() {
    initSearch();
    initControls();

    const hash = window.location.hash;
    if (hash.startsWith("#doc/")) {
      const target = hash.replace("#doc/", "");
      if (window.WIKI_DOCS[target]) currentDocId = target;
    }

    renderDocument(currentDocId);
  }

  init();
})();
