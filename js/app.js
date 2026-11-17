/**
 * ============================================================================
 * [코어 렌더링 엔진: js/app.js]
 * ----------------------------------------------------------------------------
 * 위키독스(WikiDocs) 스타일의 순차 커리큘럼 플로우(좌측 챕터 트리 + 하단 이전/다음
 * 네비게이션 + 학습 완료 체크)와 나무위키식 상호 링크/역링크를 렌더링합니다.
 * ============================================================================
 */
(function () {
  const TRACK_SESSION_KEY = "codewiki_selected_track_v1";
  if (sessionStorage.getItem(TRACK_SESSION_KEY) === "ui5") {
    sessionStorage.setItem(TRACK_SESSION_KEY, "abap");
  }
  let currentTrack = "abap";
  let currentDocId = currentTrack === "ui5" ? "welcome-ui5" : "welcome-abap";
  const READ_DOCS_KEY = "codewiki_read_docs_v2";
  const expandedCategories = new Set();
  // 문서 데이터는 data.js와 ui5-data.js에서 앱 시작 전에 로드됩니다.
  const documents = Object.values(window.WIKI_DOCS || {});
  const aliases = [];
  const exactAliases = new Map();
  const backlinks = new Map();
  for (const doc of documents) {
    if (doc.track === "ui5") continue;
    for (const alias of new Set([doc.title, ...(doc.aliases || [])])) {
      const clean = alias.trim();
      if (!clean) continue;
      aliases.push({ alias: clean, docId: doc.id, regex: buildAliasRegex(clean) });
      const key = clean.toLowerCase();
      if (!exactAliases.has(key)) exactAliases.set(key, doc.id);
    }
  }
  aliases.sort((a, b) => b.alias.length - a.alias.length);
  const searchIndex = documents.filter(doc => doc.track !== "ui5").map(doc => ({
    doc,
    fields: [doc.title, doc.subtitle, doc.summary, ...(doc.tcodes || [])]
      .filter(Boolean).map(value => value.toLowerCase())
  }));

  const categoryNav = document.getElementById("categoryNav");
  const quickRefGroup = document.getElementById("quickRefGroup");
  const quickRefLabel = document.getElementById("quickRefLabel");
  const tcodeList = document.getElementById("tcodeList");
  const appShell = document.getElementById("appShell");
  const sidebarRight = document.getElementById("sidebarRight");
  const tocCardWrap = document.getElementById("tocCardWrap");
  const metaCardWrap = document.getElementById("metaCardWrap");
  const backlinkCardWrap = document.getElementById("backlinkCardWrap");
  const articleContainer = document.getElementById("articleContainer");
  const tocList = document.getElementById("tocList");
  const summarySpecBox = document.getElementById("summarySpecBox");
  const backlinkBox = document.getElementById("backlinkBox");
  const hoverPreviewCard = document.getElementById("hoverPreviewCard");
  const sbHomeItem = document.getElementById("sbHomeItem");
  const brandTrackToggle = document.getElementById("brandTrackToggle");

  function isDocumentPending(doc) {
    return !(doc.sections || []).some(section =>
      !["관련 문서", "참고", "참고 자료", "필기와 참고 자료"].includes(section.title) &&
      (section.blocks || []).length > 0
    );
  }

  function getHomeDocId(track) {
    return track === "ui5" ? "welcome-ui5" : "welcome-abap";
  }

  function syncTrackChrome() {
    const isUi5 = currentTrack === "ui5";

    brandTrackToggle?.querySelectorAll("[data-track-switch]").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-track-switch") === currentTrack);
    });

    if (quickRefLabel) {
      quickRefLabel.textContent = isUi5 ? "REFERENCE" : "T-CODES";
    }

    const homeId = getHomeDocId(currentTrack);
    if (sbHomeItem) {
      sbHomeItem.setAttribute("href", `#doc/${homeId}`);
      sbHomeItem.setAttribute("data-doc", homeId);
    }
    const brandHomeLink = document.getElementById("brandHomeLink");
    if (brandHomeLink) {
      brandHomeLink.setAttribute("href", `#doc/${homeId}`);
    }
  }

  function getReadDocs() {
    try {
      const stored = JSON.parse(localStorage.getItem(READ_DOCS_KEY) || "[]");
      return Array.isArray(stored) ? stored : [];
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

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildAliasRegex(alias) {
    const escaped = escapeRegExp(alias);
    const leftBound = /^[A-Za-z0-9_$]/.test(alias) ? "(?<![A-Za-z0-9_$])" : "";
    const rightBound = /[A-Za-z0-9_]$/.test(alias) ? "(?![A-Za-z0-9_])" : "";
    return new RegExp(`${leftBound}${escaped}${rightBound}`, "gi");
  }

  function findDocIdByExactAlias(word) {
    return exactAliases.get(word.trim().toLowerCase()) || null;
  }

  // 인라인 문법 파서 + 나무위키식 자동 키워드 하이퍼링크 엔진
  function parseInline(text, sourceDocId = currentDocId) {
    if (!text) return "";
    const tokens = [];
    const stash = html => {
      const idx = tokens.length;
      tokens.push(html);
      return `\uE000${idx}\uE001`;
    };

    let out = String(text);
    // Existing HTML links and code are opaque; never link inside attributes.
    out = out.replace(/<(a|code|pre)\b[^>]*>[\s\S]*?<\/\1>/gi, stash);
    out = out.replace(/<[^>]+>/g, stash);

    // 1) 수동 명시 링크 [[문서ID|표시이름]] 보호 및 변환
    out = out.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, targetId, label) => {
      const id = targetId.trim();
      const targetDoc = window.WIKI_DOCS[id];
      const textLabel = label ? label.trim() : targetDoc ? targetDoc.title : id;
      if (targetDoc?.track === "ui5" || id === sourceDocId) return stash(textLabel);
      if (!targetDoc) {
        return stash(
          `<a href="#missing/${id}" class="wiki-link missing-wiki-link" data-missing-doc="${textLabel}" title="아직 미작성된 문서입니다. 클릭하여 추가 건의하기">${textLabel}</a>`
        );
      }
      return stash(`<a href="#doc/${id}" class="wiki-link" data-doc="${id}">${textLabel}</a>`);
    });

    // 2) 암기 모드 빈칸 토큰 {{키워드}} 보호
    out = out.replace(/\{\{(.+?)\}\}/g, (_, inner) =>
      stash(`<span class="quiz-token" title="클릭하여 정답 확인">${inner}</span>`)
    );

    // 3) 인라인 코드 `코드` 변환 (만약 등록된 T-Code/개념 키워드라면 링크도 함께 연결!)
    out = out.replace(/`([^`]+)`/g, (_, codeStr) => {
      const matchedDocId = findDocIdByExactAlias(codeStr);
      if (matchedDocId && matchedDocId !== sourceDocId) {
        return stash(
          `<a href="#doc/${matchedDocId}" class="wiki-link code-wiki-link" data-doc="${matchedDocId}"><code>${codeStr}</code></a>`
        );
      }
      return stash(`<code>${codeStr}</code>`);
    });

    // 4) 평문 속 등록 키워드(aliases) 자동 감지 → 하이퍼링크 연결 (현재 보고 있는 자기 자신 문서는 제외)
    for (const entry of aliases) {
      if (entry.docId === sourceDocId) continue;
      out = out.replace(entry.regex, matchedText =>
        stash(`<a href="#doc/${entry.docId}" class="wiki-link" data-doc="${entry.docId}">${matchedText}</a>`)
      );
    }

    // 5) 굵은 글씨 및 취소선 메모 적용
    out = out
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/~~(.+?)~~/g, '<del class="wiki-del" title="취소선 메모">$1</del>');

    // 6) 보호해 둔 토큰 복원
    let guard = 0;
    while (out.includes("\uE000") && guard < 5) {
      out = out.replace(/\uE000(\d+)\uE001/g, (_, idx) => tokens[Number(idx)] || "");
      guard++;
    }

    return out;
  }

  // 특정 문서를 참조하는 역링크(Backlinks) 자동 검색 (수동 [[링크]] + 자동 aliases 언급 모두 포함!)
  function computeBacklinks(targetId) {
    if (backlinks.has(targetId)) return backlinks.get(targetId);
    const targetDoc = window.WIKI_DOCS[targetId];
    if (!targetDoc) return [];

    // Derive backlinks from the same inline renderer as the visible content.
    // Metadata, code samples and aliases inside external URLs are not references.
    const inlineValues = doc => {
      const values = [doc.summary, ...Object.values(doc.specs || {})];
      const walk = block => {
        if (!block || typeof block !== "object" || block.type === "code") return;
        for (const [key, value] of Object.entries(block)) {
          if (["type", "title", "id", "widget", "widgetId", "code", "label"].includes(key)) continue;
          if (typeof value === "string") values.push(value);
          else if (Array.isArray(value)) value.forEach(item => {
            if (typeof item === "string") values.push(item);
            else if (Array.isArray(item)) item.forEach(cell => values.push(String(cell)));
            else walk(item);
          });
        }
      };
      (doc.sections || []).forEach(section => (section.blocks || []).forEach(walk));
      return values.filter(Boolean);
    };
    const matches = documents.filter(doc => {
      if (doc.id === targetId || doc.track === "ui5") return false;
      return inlineValues(doc).some(value =>
        parseInline(value, doc.id).includes(`data-doc="${targetId}"`)
      );
    });
    backlinks.set(targetId, matches);
    return matches;
  }

  // 좌측 고정 사이드바 렌더링 (불필요한 빈 요소 자동 숨김)
  function renderNavigation() {
    syncTrackChrome();

    const allDocs = Object.values(window.WIKI_DOCS).filter(
      d => (d.track || "abap") === currentTrack
    );
    const readSet = new Set(getReadDocs());

    const homeId = getHomeDocId(currentTrack);
    if (sbHomeItem) {
      sbHomeItem.classList.toggle("active", currentDocId === homeId);
    }

    const curDoc = window.WIKI_DOCS[currentDocId];
    if (curDoc?.categoryId) {
      expandedCategories.add(curDoc.categoryId);
    }

    const trackCategories = (window.WIKI_CATEGORIES || []).filter(
      c => (c.track || "abap") === currentTrack
    );

    categoryNav.innerHTML = trackCategories
      .map(cat => {
        const docsInCat = allDocs.filter(d => d.categoryId === cat.id);
        if (cat.id === "abap-curriculum") {
          return `<div class="curriculum-flat-list">${docsInCat.map(d => `
            <a href="#doc/${d.id}" class="nav-doc-link ${d.id === currentDocId ? "active" : ""}" data-doc="${d.id}">
              ${d.stepNum ? `<span class="step-num-badge">${d.stepNum}</span>` : ""}
              <span class="nav-doc-title-text">${d.title}${isDocumentPending(d) ? ' <small class="pending-doc-badge">준비 중</small>' : ""}</span>
              ${readSet.has(d.id) ? `<span class="read-check-mark" title="완료">✓</span>` : ""}
            </a>`).join("")}</div>`;
        }
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
                docsInCat.length > 0
                  ? `<svg class="sb-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                     </svg>`
                  : ""
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
                    ${d.stepNum ? `<span class="step-num-badge">${d.stepNum}</span>` : ""}
                    <span class="nav-doc-title-text">${d.title}${isDocumentPending(d) ? ' <small class="pending-doc-badge">준비 중</small>' : ""}</span>
                    ${readSet.has(d.id) ? `<span class="read-check-mark" title="완료">✓</span>` : ""}
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

    // 좌측 빠른 사전: 등록된 데이터가 있을 때만 노출
    const tcodes = (window.WIKI_TCODES || []).filter(t => (t.track || "abap") === currentTrack);
    if (quickRefGroup) {
      quickRefGroup.classList.toggle("hidden", tcodes.length === 0);
    }
    if (tcodes.length > 0 && tcodeList) {
      tcodeList.innerHTML = tcodes
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
            <pre><code>${(block.code || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
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
    if (docId === "erp-setup") {
      docId = "sap-architecture";
      history.replaceState(null, "", "#doc/sap-architecture");
    }
    if (window.WIKI_DOCS[docId]?.track === "ui5") {
      docId = "welcome-abap";
      history.replaceState(null, "", "#doc/welcome-abap");
    }
    const allDocsObj = window.WIKI_DOCS || {};
    const targetDoc = allDocsObj[docId] || allDocsObj[getHomeDocId(currentTrack)] || Object.values(allDocsObj)[0];
    if (!targetDoc) return;

    if (targetDoc.track && targetDoc.track !== currentTrack) {
      currentTrack = targetDoc.track;
      if (sessionStorage.getItem(TRACK_SESSION_KEY)) {
        sessionStorage.setItem(TRACK_SESSION_KEY, currentTrack);
      }
    }

    const docList = Object.values(allDocsObj).filter(
      d => (d.track || "abap") === currentTrack
    );
    const currentIndex = docList.findIndex(d => d.id === targetDoc.id);
    const doc = currentIndex >= 0 ? docList[currentIndex] : targetDoc;
    currentDocId = doc.id;

    const prevDoc = currentIndex > 0 ? docList[currentIndex - 1] : null;
    const nextDoc = currentIndex >= 0 && currentIndex < docList.length - 1 ? docList[currentIndex + 1] : null;
    const isRead = getReadDocs().includes(doc.id);

    const trackLabel = currentTrack === "ui5" ? "UI5 / Fiori" : "ABAP";
    const catName = doc.categoryId ? getCategoryName(doc.categoryId) : `${trackLabel} · HOME`;

    let widgetCounter = 0;
    const sections = doc.sections || [];
    const hasMetaTop = Boolean(doc.categoryId || doc.stepNum || (doc.tcodes && doc.tcodes.length > 0));
    const showFooter = !doc.isHome || prevDoc || nextDoc;

    // Preserve the shared TOC node before replacing the current document.
    if (tocCardWrap) sidebarRight?.prepend(tocCardWrap);
    articleContainer.innerHTML = `
      ${
        hasMetaTop
          ? `
        <div class="article-top-meta">
          <div style="display:flex; align-items:center; gap:8px;">
            ${doc.categoryId ? `<span class="category-crumb">${getCategoryName(doc.categoryId)}</span>` : ""}
            ${doc.stepNum ? `<span class="tcode-pill-badge">${doc.stepNum}</span>` : ""}
          </div>
          <div class="tcode-badge-row">
            ${(doc.tcodes || [])
              .map(tc => {
                const tcDocId = findDocIdByExactAlias(tc);
                if (tcDocId && tcDocId !== doc.id) {
                  return `<a href="#doc/${tcDocId}" class="tcode-pill-badge wiki-link" data-doc="${tcDocId}" style="text-decoration:none;">${tc}</a>`;
                }
                return `<span class="tcode-pill-badge">${tc}</span>`;
              })
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      <h1 class="article-main-title">${doc.title}</h1>
      ${doc.subtitle ? `<div class="article-subtitle">${doc.subtitle}</div>` : `<div style="margin-bottom:20px;"></div>`}

      ${
        doc.summary
          ? `
        <div class="summary-hero-box">
          <div class="summary-hero-text">${parseInline(doc.summary)}</div>
        </div>
      `
          : ""
      }

      ${isDocumentPending(doc) ? '<div class="pending-doc-notice" role="status"><strong>준비 중</strong><p>아직 본문이 작성되지 않았습니다. 아래 학습 목차에 맞춰 내용을 보강할 예정입니다.</p></div>' : ""}
      <div id="documentTocSlot"></div>
      <div class="doc-sections-wrap">
        ${
          sections.length === 0
            ? `
          <div style="padding:48px 20px; text-align:center; color:var(--text-muted); font-size:13.5px;">
            본문 준비 중입니다.
          </div>
        `
            : sections
                .map(
                  (sec, sIdx) => `
          <section class="doc-section" id="sec-${sIdx + 1}">
            <h2 class="doc-sec-title">
              <span class="doc-sec-num">${sIdx + 1}.</span>
              <span>${sec.title}</span>
            </h2>
            ${!(sec.blocks || []).length ? '<p class="pending-section-note">준비 중 · 본문을 작성하고 있습니다.</p>' : ""}
            ${(sec.blocks || [])
              .map(b => {
                widgetCounter++;
                return renderBlock(b, widgetCounter);
              })
              .join("")}
          </section>
        `
                )
                .join("")
        }
      </div>

      ${
        showFooter
          ? `
        <div class="wikidocs-pager-wrap">
          ${
            !doc.isHome
              ? `
            <div class="read-complete-bar" style="justify-content:space-between; flex-wrap:wrap; gap:10px;">
              <button id="suggestDocEditBtn" class="toss-chip-btn">
                <span>수정 건의</span>
              </button>
              <button id="toggleReadBtn" class="toss-chip-btn ${isRead ? "active" : ""}">
                <span>${isRead ? "✓ 완료됨" : "학습 완료"}</span>
              </button>
            </div>
          `
              : ""
          }
          ${
            prevDoc || nextDoc
              ? `
            <div class="pager-grid">
              ${
                prevDoc
                  ? `
                <a href="#doc/${prevDoc.id}" class="pager-card prev-pager" data-doc="${prevDoc.id}">
                  <span class="pager-dir">← 이전</span>
                  <strong class="pager-title">${prevDoc.title}</strong>
                </a>
              `
                  : `<div></div>`
              }
              ${
                nextDoc
                  ? `
                <a href="#doc/${nextDoc.id}" class="pager-card next-pager" data-doc="${nextDoc.id}">
                  <span class="pager-dir">다음 →</span>
                  <strong class="pager-title">${nextDoc.title}</strong>
                </a>
              `
                  : `<div></div>`
              }
            </div>
          `
              : ""
          }
        </div>
      `
          : ""
      }
    `;

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

    articleContainer.querySelectorAll("[data-widget-id]").forEach(slot => {
      const wId = slot.getAttribute("data-widget-id");
      if (window.WIKI_WIDGETS && typeof window.WIKI_WIDGETS[wId] === "function") {
        window.WIKI_WIDGETS[wId](slot);
      }
    });

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

    // 암기 모드 버튼: 현재 문서에 빈칸 토큰이 있을 때만 표시
    const quizTokens = articleContainer.querySelectorAll(".quiz-token");
    const quizModeBtn = document.getElementById("quizModeBtn");
    if (quizModeBtn) {
      quizModeBtn.classList.toggle("hidden", quizTokens.length === 0);
    }
    quizTokens.forEach(token => {
      token.addEventListener("click", () => {
        token.classList.toggle("revealed");
      });
    });

    // 우측 보조 카드: 실제 내용이 있는 카드만 표시하고, 하나도 없으면 우측 컬럼 전체 숨김!
    const hasToc = sections.length >= 2;
    const specEntries = Object.entries(doc.specs || {});
    const hasSpecs = specEntries.length > 0;
    const backlinks = computeBacklinks(doc.id);
    const hasBacklinks = backlinks.length > 0;

    tocCardWrap?.classList.toggle("hidden", !hasToc);
    metaCardWrap?.classList.toggle("hidden", !hasSpecs);
    backlinkCardWrap?.classList.toggle("hidden", !hasBacklinks);

    document.getElementById("documentTocSlot")?.append(tocCardWrap);
    const hasAnyRightCard = hasSpecs || hasBacklinks;
    sidebarRight?.classList.toggle("hidden", !hasAnyRightCard);
    appShell?.classList.toggle("single-col", !hasAnyRightCard);

    if (hasToc) {
      tocList.innerHTML = sections
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
    }

    if (hasSpecs) {
      summarySpecBox.innerHTML = specEntries
        .map(
          ([k, v]) => `
          <div class="spec-row">
            <span class="spec-key">${k}</span>
            <span class="spec-val">${parseInline(String(v))}</span>
          </div>
        `
        )
        .join("");
    }

    if (hasBacklinks) {
      backlinkBox.innerHTML = backlinks
        .map(
          b => `
          <a href="#doc/${b.id}" class="backlink-pill wiki-link" data-doc="${b.id}">
            ↰ ${b.title}
          </a>
        `
        )
        .join("");
    }

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

  function selectTrack(track) {
    if (track === "ui5") return;
    const nextTrack = track === "ui5" ? "ui5" : "abap";
    currentTrack = nextTrack;
    sessionStorage.setItem(TRACK_SESSION_KEY, nextTrack);
    if (window.CodeWikiBoard) window.CodeWikiBoard.closeIfActive();
    const homeId = getHomeDocId(nextTrack);
    window.location.hash = `#doc/${homeId}`;
    renderDocument(homeId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  window.CodeWikiApp = {
    openDoc: navigateTo,
    getCurrentDocId: () => currentDocId,
    getTrack: () => currentTrack,
    hasSelectedTrack: () => Boolean(sessionStorage.getItem(TRACK_SESSION_KEY)),
    resetTrackChoice: () => sessionStorage.removeItem(TRACK_SESSION_KEY),
    selectTrack
  };

  function bindWikiLinks() {
    document.querySelectorAll("[data-missing-doc]").forEach(el => {
      el.onclick = e => {
        e.preventDefault();
        if (window.CodeWikiBoard) {
          window.CodeWikiBoard.openWriteModal("");
        }
      };
    });

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

      const matches = searchIndex.filter(entry => entry.fields.some(field => field.includes(q)))
        .map(entry => entry.doc);

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
    const brandHomeLink = document.getElementById("brandHomeLink");

    brandHomeLink?.addEventListener("click", e => {
      e.preventDefault();
      navigateTo(getHomeDocId(currentTrack));
    });

    brandTrackToggle?.querySelectorAll("[data-track-switch]").forEach(btn => {
      btn.addEventListener("click", () => {
        const nextTrack = btn.getAttribute("data-track-switch");
        if (nextTrack && nextTrack !== currentTrack) {
          selectTrack(nextTrack);
        }
      });
    });

    window.addEventListener("hashchange", () => {
      const h = window.location.hash;
      if (h.startsWith("#doc/")) {
        const target = h.replace("#doc/", "");
        if ((window.WIKI_DOCS[target] || target === "erp-setup") && target !== currentDocId) {
          if (window.CodeWikiBoard) window.CodeWikiBoard.closeIfActive();
          renderDocument(target);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    });

    toggleBtn?.addEventListener("click", () => {
      const isCollapsed = appLayout?.classList.toggle("sidebar-collapsed");
      toggleBtn.title = isCollapsed ? "사이드바 펼치기" : "사이드바 접기";
    });

    const quizModeBtn = document.getElementById("quizModeBtn");
    quizModeBtn?.addEventListener("click", () => {
      const isQuiz = document.body.classList.toggle("quiz-mode");
      quizModeBtn.classList.toggle("active", isQuiz);
      const labelEl = quizModeBtn.querySelector("span:last-child");
      if (labelEl) labelEl.textContent = isQuiz ? "암기 모드 ON" : "암기 모드";
      if (!isQuiz) {
        document.querySelectorAll(".quiz-token.revealed").forEach(el => el.classList.remove("revealed"));
      }
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
      if (window.WIKI_DOCS[target] || target === "erp-setup") currentDocId = target;
    }

    renderDocument(currentDocId);
  }

  init();
})();
