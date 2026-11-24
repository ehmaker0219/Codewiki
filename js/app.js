/**
 * ============================================================================
 * [코어 렌더링 엔진: js/app.js]
 * ----------------------------------------------------------------------------
 * 주제별·수업일별 목차, 계정별 학습 완료, 본문 검색과 상호 링크를 렌더링합니다.
 * ============================================================================
 */
(function () {
  const TRACK_SESSION_KEY = "codewiki_selected_track_v1";
  try {
    if (sessionStorage.getItem(TRACK_SESSION_KEY) === "ui5") {
      sessionStorage.setItem(TRACK_SESSION_KEY, "abap");
    }
  } catch {}
  let currentTrack = "abap";
  let currentDocId = "welcome-abap";
  let navigationView = 'topic';
  try { navigationView = localStorage.getItem('codewiki_nav_view') === 'date' ? 'date' : 'topic'; } catch {}
  const expandedCategories = new Set();
  // 문서 데이터는 data.js 등에서 앱 시작 전에 로드됩니다. UI5 트랙(ui5-data.js)은
  // 준비 중이라 시작 시 로드하지 않습니다.
  const documents = Object.values(window.WIKI_DOCS || {});
  const aliases = [];
  const exactAliases = new Map();
  const backlinks = new Map();
  let backlinksIndexed = false;
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
  const searchIndex = window.CodeWikiLearning.indexDocuments(documents);

  const categoryNav = document.getElementById("categoryNav");
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
    if (doc.isCalendar) return false;
    return !(doc.sections || []).some(section =>
      !["관련 문서", "참고", "참고 자료", "필기와 참고 자료"].includes(section.title) &&
      (section.blocks || []).length > 0
    );
  }

  function getHomeDocId(track) {
    return track === "ui5" ? "welcome-ui5" : "welcome-abap";
  }

  function syncTrackChrome() {
    brandTrackToggle?.querySelectorAll("[data-track-switch]").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-track-switch") === currentTrack);
    });

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
    return window.CodeWikiProgress?.getReadDocs() || [];
  }

  function toggleReadDoc(docId) {
    window.CodeWikiProgress?.toggle(docId);
  }

  function refreshProgress() {
    const readSet = new Set(getReadDocs());
    const read = readSet.has(currentDocId);
    const button = document.getElementById('toggleReadBtn');
    if (button) { button.classList.toggle('active', read); button.textContent = read ? '✓ 완료됨' : '학습 완료'; }
    const status = document.getElementById('readSyncStatus');
    if (status) status.textContent = window.CodeWikiProgress?.getStatus() || '';
    const retry = document.getElementById('retryReadSync');
    if (retry) retry.hidden = !window.CodeWikiProgress?.needsRetry();
    // Update only completion marks: preserve focus, open folders and scroll position.
    categoryNav.querySelectorAll('[data-doc]').forEach(link => {
      const mark = link.querySelector('.read-check-mark');
      if (readSet.has(link.getAttribute('data-doc'))) {
        if (!mark) link.insertAdjacentHTML('beforeend', '<span class="read-check-mark" title="완료">✓</span>');
      } else {
        mark?.remove();
      }
    });
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
    // Static labels can opt out of automatic links without changing their typography.
    out = out.replace(/<span data-no-autolink>[\s\S]*?<\/span>/gi, stash);
    out = out.replace(/<[^>]+>/g, stash);

    const esc = window.CodeWikiLearning.escape;

    // 1) 수동 명시 링크 [[문서ID|표시이름]] 보호 및 변환
    out = out.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, targetId, label) => {
      const id = targetId.trim();
      const targetDoc = window.WIKI_DOCS[id];
      const textLabel = label ? label.trim() : targetDoc ? targetDoc.title : id;
      if (targetDoc?.track === "ui5" || id === sourceDocId) return stash(esc(textLabel));
      if (!targetDoc) {
        return stash(
          `<a href="#missing/${esc(id)}" class="wiki-link missing-wiki-link" data-missing-doc="${esc(textLabel)}" title="아직 미작성된 문서입니다. 클릭하여 추가 건의하기">${esc(textLabel)}</a>`
        );
      }
      return stash(`<a href="#doc/${esc(id)}" class="wiki-link" data-doc="${esc(id)}">${esc(textLabel)}</a>`);
    });

    // 2) 암기 모드 빈칸 토큰 {{키워드}} 보호
    out = out.replace(/\{\{(.+?)\}\}/g, (_, inner) =>
      stash(`<span class="quiz-token" title="클릭하여 정답 확인" tabindex="0" role="button">${inner}</span>`)
    );

    // 3) 인라인 코드 `코드` 변환 (만약 등록된 T-Code/개념 키워드라면 링크도 함께 연결!)
    out = out.replace(/`([^`]+)`/g, (_, codeStr) => {
      const matchedDocId = findDocIdByExactAlias(codeStr);
      const safeCode = esc(codeStr);
      if (matchedDocId && matchedDocId !== sourceDocId) {
        return stash(
          `<a href="#doc/${esc(matchedDocId)}" class="wiki-link code-wiki-link" data-doc="${esc(matchedDocId)}"><code>${safeCode}</code></a>`
        );
      }
      return stash(`<code>${safeCode}</code>`);
    });

    // 4) 평문 속 등록 키워드(aliases) 자동 감지 → 하이퍼링크 연결 (현재 보고 있는 자기 자신 문서는 제외)
    for (const entry of aliases) {
      // Protect the whole term even on its own page, before shorter aliases run.
      out = out.replace(entry.regex, matchedText =>
        stash(entry.docId === sourceDocId ? esc(matchedText) :
          `<a href="#doc/${esc(entry.docId)}" class="wiki-link" data-doc="${esc(entry.docId)}">${esc(matchedText)}</a>`)
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
    if (backlinksIndexed) return backlinks.get(targetId) || [];
    const targetDoc = window.WIKI_DOCS[targetId];
    if (!targetDoc) return [];

    // Derive backlinks from the same inline renderer as the visible content.
    // Metadata, code samples and aliases inside external URLs are not references.
    const inlineValues = doc => {
      const values = [doc.summary, ...Object.values(doc.specs || {}).map(String)];
      const walkNested = node => {
        if (!node) return;
        values.push(node.badge, node.title, node.desc);
        (node.items || []).forEach(item => values.push(item.name, item.sub));
        (node.children || []).forEach(walkNested);
      };
      const walk = block => {
        if (!block || typeof block !== "object") return;
        // Match only the fields passed to parseInline by renderBlock.
        switch (block.type) {
          case "text":
            values.push(...(block.paragraphs || []));
            break;
          case "practice":
            values.push(block.title);
            (block.steps || []).forEach(step => values.push(step.action, step.detail));
            break;
          case "flow":
            values.push(block.caption);
            (block.steps || []).forEach(step => values.push(step.title, step.desc));
            break;
          case "compare":
            (block.items || []).forEach(item => values.push(item.title, ...(item.points || [])));
            break;
          case "callout":
            values.push(block.title, block.body);
            break;
          case "table":
            values.push(...(block.headers || []));
            (block.rows || []).forEach(row => values.push(...row));
            break;
          case "nested":
            values.push(block.caption);
            walkNested(block.root);
            break;
        }
      };
      (doc.sections || []).forEach(section => (section.blocks || []).forEach(walk));
      return values.filter(Boolean);
    };
    // Documents are immutable after startup. Parse each source once and invert its links.
    for (const doc of documents) {
      if (doc.track === "ui5") continue;
      const targets = new Set();
      for (const value of inlineValues(doc)) {
        for (const match of parseInline(value, doc.id).matchAll(/data-doc="([^"]+)"/g)) {
          if (match[1] !== doc.id && window.WIKI_DOCS[match[1]]) targets.add(match[1]);
        }
      }
      for (const id of targets) {
        if (!backlinks.has(id)) backlinks.set(id, []);
        backlinks.get(id).push(doc);
      }
    }
    backlinksIndexed = true;
    return backlinks.get(targetId) || [];
  }

  function renderDateNavigation(allDocs, readSet) {
    const esc = window.CodeWikiLearning?.escape || (v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
    let lastWeek = null;
    return (window.WIKI_LESSON_DAYS || []).filter(day => day.track === currentTrack).map(day => {
      const validWeek = Number.isInteger(day.week) && day.week > 0;
      const divider = validWeek && day.week !== lastWeek
        ? '<div class="nav-week-divider" role="separator" aria-label="' + esc(day.week + '주차') + '"><span aria-hidden="true">' + esc(day.week + '주차') + '</span></div>'
        : '';
      if (validWeek) lastWeek = day.week;
      return divider +
        '<a href="#doc/' + esc(day.docId) + '" class="nav-doc-link ' + (day.docId === currentDocId ? 'active' : '') + '" data-doc="' + esc(day.docId) + '"><span>' + esc(day.title) + '</span>' +
        (readSet.has(day.docId) ? '<span class="read-check-mark" title="완료">✓</span>' : '') + '</a>';
    }).join('');
  }

  function textbookUnitLabel(doc) {
    return doc.textbookParts?.length ? '교재 Unit ' + doc.textbookParts.map(part => part.unit).join(' · ') : '';
  }

  function renderTextbookNavLabel(doc) {
    const label = textbookUnitLabel(doc);
    return label ? `<small class="nav-textbook-label">${window.CodeWikiLearning.escape(label)}</small>` : '';
  }

  function renderTextbookReferences(doc) {
    if (!doc.textbookParts?.length) return '';
    const esc = window.CodeWikiLearning.escape;
    return `<details class="textbook-references">
      <summary>${esc(textbookUnitLabel(doc))}<span class="textbook-reference-hint">Lesson · 페이지 보기</span></summary>
      <div class="textbook-reference-body">
        ${doc.textbookParts.map(part => `<div class="textbook-reference-unit">
          <h3>Unit ${esc(part.unit)}: ${esc(part.title)}</h3>
          <ul>${part.entries.map(entry => `<li><span>${esc(entry.title)}</span><span class="textbook-page">p. ${esc(entry.page)}</span></li>`).join('')}</ul>
        </div>`).join('')}
        <a href="#doc/abap-textbook" class="wiki-link" data-doc="abap-textbook">전체 교재 목차 보기</a>
      </div>
    </details>`;
  }

  // 좌측 고정 사이드바 렌더링 (불필요한 빈 요소 자동 숨김)
  function renderNavigation() {
    const esc = window.CodeWikiLearning.escape;
    document.getElementById('sbScheduleItem')?.classList.toggle('active', currentDocId === 'education-schedule');
    document.getElementById('sbThinkingFlowItem')?.classList.toggle('active', currentDocId === 'abap-thinking-flow');
    document.getElementById('sbProgramCatalogItem')?.classList.toggle('active', currentDocId === 'sap-gui-programs');
    document.getElementById('sbTextbookItem')?.classList.toggle('active', currentDocId === 'abap-textbook');
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

    document.querySelectorAll('[data-nav-view]').forEach(button => {
      const selected = button.dataset.navView === navigationView;
      button.setAttribute('aria-pressed', String(selected));
      button.onclick = () => {
        navigationView = button.dataset.navView;
        try { localStorage.setItem('codewiki_nav_view', navigationView); } catch {}
        renderNavigation();
      };
    });
    categoryNav.innerHTML = (navigationView === 'date' ? renderDateNavigation(allDocs, readSet) : '') + trackCategories
      .filter(cat => navigationView !== 'date' || cat.id !== `${currentTrack}-curriculum`)
      .map(cat => {
        const docsInCat = allDocs.filter(d => d.categoryId === cat.id);
        if (cat.id === "abap-curriculum") {
          return `<div class="curriculum-flat-list">${docsInCat.map(d => `
            <a href="#doc/${esc(d.id)}" class="nav-doc-link ${d.id === currentDocId ? "active" : ""}" data-doc="${esc(d.id)}">
              ${d.stepNum ? `<span class="step-num-badge">${esc(d.stepNum)}</span>` : ""}
              <span class="nav-doc-title-text">${esc(d.title)}${isDocumentPending(d) ? ' <small class="pending-doc-badge">준비 중</small>' : ""}${renderTextbookNavLabel(d)}</span>
              ${readSet.has(d.id) ? `<span class="read-check-mark" title="완료">✓</span>` : ""}
            </a>`).join("")}</div>`;
        }
        const isOpen = expandedCategories.has(cat.id);
        const hasActiveChild = docsInCat.some(d => d.id === currentDocId);

        return `
          <div class="sb-folder-group ${isOpen ? "open" : ""}">
            <button type="button" class="sb-folder-row ${hasActiveChild ? "has-active" : ""}" data-toggle-cat="${esc(cat.id)}">
              <svg class="sb-folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span class="sb-folder-name">${esc(cat.name)}</span>
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
                  <a href="#doc/${esc(d.id)}" class="nav-doc-link ${d.id === currentDocId ? "active" : ""}" data-doc="${esc(d.id)}">
                    ${d.stepNum ? `<span class="step-num-badge">${esc(d.stepNum)}</span>` : ""}
                    <span class="nav-doc-title-text">${esc(d.title)}${isDocumentPending(d) ? ' <small class="pending-doc-badge">준비 중</small>' : ""}${renderTextbookNavLabel(d)}</span>
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
      });
    });

  }

  function renderEditorCode(raw, abap = true, numbered = true) {
    const escape = value => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const keywords = new Set(('REPORT DATA TYPES TYPE LIKE VALUE CONSTANTS CLEAR WRITE PARAMETERS SELECT-OPTIONS FOR IN INITIALIZATION TABLES START-OF-SELECTION END-OF-SELECTION AT SELECTION-SCREEN OUTPUT BEGIN OF END INCLUDE TABLE LINE STANDARD SORTED HASHED KEY UNIQUE NON-UNIQUE APPEND INSERT READ MODIFY DELETE SORT ASCENDING DESCENDING CORRESPONDING FIELDS GROUP AS COUNT SUM AVG MIN MAX ORDER HAVING JOIN LEFT OUTER INNER ON IF ELSE ELSEIF ENDIF DO TIMES ENDDO WHILE ENDWHILE LOOP AT ENDLOOP EXIT CONTINUE MOD DIV IS NOT INITIAL AND OR BETWEEN CA CS NE EQ CONCATENATE INTO SEPARATED BY FORM ENDFORM PERFORM USING CHANGING SELECT FROM WHERE ENDSELECT CALL FUNCTION METHOD CLASS DEFINITION IMPLEMENTATION PUBLIC PRIVATE PROTECTED SECTION METHODS CLASS-METHODS ENDMETHOD ENDCLASS CREATE OBJECT REF TO IMPORTING EXPORTING RETURNING EXCEPTIONS TRY CATCH ENDTRY MESSAGE WITH LENGTH DECIMALS DEFAULT MOVE TRANSLATE CONDENSE ULINE').split(' '));
    return String(raw).split('\n').map((line,i) => {
      let body = escape(line);
      if (abap) {
        if (line.startsWith('*')) body = '<span class="sap-code-comment">' + escape(line) + '</span>';
        else body = line.replace(/'(?:''|[^'])*'|`[^`]*`|\|[^|]*\||".*$|[a-zA-Z_][a-zA-Z0-9_-]*|[^a-zA-Z_'`|"&<>]+|[&<>]/g, token => {
          const kind = token.startsWith('"') ? 'comment' : ["'", '`', '|'].includes(token[0]) ? 'string' : keywords.has(token.toUpperCase()) ? 'keyword' : '';
          return kind ? '<span class="sap-code-' + kind + '">' + escape(token) + '</span>' : escape(token);
        });
      }
      return numbered
        ? '<span class="sap-code-line"><span class="sap-code-number" aria-hidden="true">' + (i+1) + '</span><span class="sap-code-source">' + body + '</span></span>'
        : '<span class="sap-code-line"><span class="sap-code-source">' + body + '</span></span>';
    }).join('\n');
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
              <span>${window.CodeWikiLearning.escape(block.label || "ABAP Code")}</span>
              <button class="copy-code-btn" data-code="${encodeURIComponent(block.code || "")}">복사</button>
            </div>
            ${block.example ? '<div class="code-example-meta"><span>' + window.CodeWikiLearning.escape(block.example.kind) + '</span><span>' + window.CodeWikiLearning.escape(block.example.verification) + '</span></div>' : ''}
            <pre><code>${renderEditorCode(block.code || '', currentTrack === 'abap')}</code></pre>
            ${block.example ? '<details class="code-example-guide"><summary>실행 방법 · 예상 결과</summary><p>' + window.CodeWikiLearning.escape(block.example.placement) + '</p>' +
              (block.example.requirements ? '<p>' + window.CodeWikiLearning.escape(block.example.requirements) + '</p>' : '') +
              '<dl><dt>입력 예시</dt><dd>' + window.CodeWikiLearning.escape(block.example.input || '코드에 지정된 값') + '</dd><dt>예상 결과</dt><dd>' + window.CodeWikiLearning.escape(block.example.expected || '변수의 변화를 디버거에서 확인하세요.') + '</dd></dl></details>' : ''}
          </div>
        `;

      case "widget":
        return `<div class="block-widget-slot" data-widget-id="${block.widgetId}" id="widget-slot-${blockIdx}"></div>`;

      case "nested": {
        const renderLayer = (node, depth) => {
          if (!node) return "";
          return `
            <div class="nested-box depth-${Math.min(depth, 4)}">
              <div class="nested-header">
                <div class="nested-title-group">
                  ${node.badge ? `<span class="nested-badge">${parseInline(node.badge)}</span>` : ""}
                  <span class="nested-title">${parseInline(node.title)}</span>
                </div>
                ${node.code ? `<span class="tcode-pill-badge">${window.CodeWikiLearning.escape(node.code)}</span>` : ""}
              </div>
              ${node.desc ? `<div class="nested-desc">${parseInline(node.desc)}</div>` : ""}
              ${node.snippet ? `<pre class="nested-abap-pre"><code>${renderEditorCode(node.snippet, true, false)}</code></pre>` : ""}
              ${
                node.items && node.items.length > 0
                  ? `
                <div class="nested-items-grid${node.layout === "stack" ? " layout-stack" : node.layout === "wide" ? " layout-wide" : ""}">
                  ${node.items
                    .map(
                      it => `
                    <div class="nested-leaf-chip">
                      <span class="nested-leaf-name">${parseInline(it.name)}${it.example ? ` <code>${window.CodeWikiLearning.escape(it.example)}</code>` : ""}</span>
                      ${it.sequence?.length ? `<ol class="nested-leaf-sequence" aria-label="선언 순서">${it.sequence.map(value => `<li><code>${window.CodeWikiLearning.escape(value)}</code></li>`).join("")}</ol>` : ""}
                      ${it.sub ? `<span class="nested-leaf-sub">${parseInline(it.sub)}</span>` : ""}
                      ${it.snippet ? `<pre class="nested-abap-pre"><code>${renderEditorCode(it.snippet, true, false)}</code></pre>` : ""}
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

  // 메인 문서 렌더링
  function renderDocument(docId) {
    if ((docId === 'welcome-abap' || docId === 'welcome-ui5') && window.CodeWikiAdminMembers?.openHome()) return;
    window.CodeWikiAdminMembers?.leave();
    window.CodeWikiKnowledgeMap?.leave?.();
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
      try {
        if (sessionStorage.getItem(TRACK_SESSION_KEY)) {
          sessionStorage.setItem(TRACK_SESSION_KEY, currentTrack);
        }
      } catch {}
    }

    const doc = targetDoc;
    currentDocId = doc.id;

    articleContainer.classList.toggle('calendar-article', Boolean(doc.isCalendar));
    if (doc.isCalendar) {
      // Keep the shared TOC alive when moving from an article to the calendar.
      if (tocCardWrap) sidebarRight?.prepend(tocCardWrap);
      sidebarRight?.classList.add('hidden');
      appShell?.classList.add('single-col');
      document.getElementById('quizModeBtn')?.classList.add('hidden');
      window.CodeWikiSchedule.render(articleContainer);
      renderNavigation();
      return;
    }

    const isRead = getReadDocs().includes(doc.id);
    const esc = window.CodeWikiLearning.escape;

    let widgetCounter = 0;
    const sections = doc.sections || [];
    const hasMetaTop = Boolean(doc.categoryId || doc.stepNum || (doc.tcodes && doc.tcodes.length > 0));
    const showFooter = !doc.isHome;

    // Preserve the shared TOC node before replacing the current document.
    if (tocCardWrap) sidebarRight?.prepend(tocCardWrap);
    articleContainer.innerHTML = `
      ${doc.topWidgetId ? `<div class="doc-top-widget" data-widget-id="${esc(doc.topWidgetId)}"></div>` : ""}
      ${
        hasMetaTop
          ? `
        <div class="article-top-meta">
          <div style="display:flex; align-items:center; gap:8px;">
            ${doc.categoryId ? `<span class="category-crumb">${esc(getCategoryName(doc.categoryId))}</span>` : ""}
            ${doc.stepNum ? `<span class="tcode-pill-badge">${esc(doc.stepNum)}</span>` : ""}
          </div>
          <div class="tcode-badge-row">
            ${(doc.tcodes || [])
              .map(tc => {
                const tcDocId = findDocIdByExactAlias(tc);
                if (tcDocId && tcDocId !== doc.id) {
                  return `<a href="#doc/${esc(tcDocId)}" class="tcode-pill-badge wiki-link" data-doc="${esc(tcDocId)}" style="text-decoration:none;">${esc(tc)}</a>`;
                }
                return `<span class="tcode-pill-badge">${esc(tc)}</span>`;
              })
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      <h1 class="article-main-title">${esc(doc.title)}</h1>
      ${doc.subtitle ? `<div class="article-subtitle">${esc(doc.subtitle)}</div>` : `<div style="margin-bottom:20px;"></div>`}
      ${renderTextbookReferences(doc)}

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
              ${doc.hideSectionNumbers ? "" : `<span class="doc-sec-num">${sIdx + 1}.</span>`}
              <span>${esc(sec.title)}</span>
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
            <div class="read-complete-bar" style="justify-content:space-between; flex-wrap:wrap; gap:10px;">
              <button id="suggestDocEditBtn" class="toss-chip-btn">
                <span>수정 건의</span>
              </button>
<span id="readSyncStatus" role="status" class="read-sync-status"></span><button id="retryReadSync" class="toss-chip-btn" hidden>동기화 재시도</button>
              <button id="toggleReadBtn" class="toss-chip-btn ${isRead ? "active" : ""}">
                <span>${isRead ? "✓ 완료됨" : "학습 완료"}</span>
              </button>
            </div>
        </div>
      `
          : ""
      }
    `;

    const toggleReadBtn = document.getElementById("toggleReadBtn");
    if (toggleReadBtn) {
      toggleReadBtn.addEventListener("click", () => toggleReadDoc(doc.id));
    }

    document.getElementById('retryReadSync')?.addEventListener('click', () => window.CodeWikiProgress?.sync());
    refreshProgress();

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
        const reset = label => {
          btn.textContent = label;
          setTimeout(() => { btn.textContent = "복사"; }, 1400);
        };
        if (!navigator.clipboard?.writeText) { reset("복사 불가"); return; }
        navigator.clipboard.writeText(raw).then(() => reset("복사됨 ✓")).catch(() => reset("복사 실패"));
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
      // Keyboard users reveal blanks with Enter/Space, like the mouse click.
      token.addEventListener("keydown", e => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        token.classList.toggle("revealed");
      });
    });

    // 우측 보조 카드: 실제 내용이 있는 카드만 표시하고, 하나도 없으면 우측 컬럼 전체 숨김!
    const hasToc = !doc.hideToc && sections.length >= 2;
    const specEntries = Object.entries(doc.specs || {});
    const hasSpecs = specEntries.length > 0;
    const backlinks = computeBacklinks(doc.id);
    const groups = window.CodeWikiLearning.relatedGroups(doc, backlinks, documents);
    const hasBacklinks = groups.concepts.length + groups.dates.length > 0;

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
            ${doc.hideSectionNumbers ? "" : `${sIdx + 1}. `}${esc(sec.title)}
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
            <span class="spec-key">${esc(k)}</span>
            <span class="spec-val">${parseInline(String(v))}</span>
          </div>
        `
        )
        .join("");
    }

    if (hasBacklinks) {
      const link = b => '<a href="#doc/' + esc(b.id) + '" class="backlink-pill wiki-link" data-doc="' + esc(b.id) + '">' + esc(b.title) + '</a>';
      const group = (title, items) => !items.length ? '' : '<div class="related-group"><h3>' + title + '</h3>' + items.slice(0,5).map(link).join('') +
        (items.length > 5 ? '<details><summary>더 보기 (' + (items.length-5) + ')</summary>' + items.slice(5).map(link).join('') + '</details>' : '') + '</div>';
      backlinkBox.innerHTML = group('관련 개념', groups.concepts) + group('이 내용을 배운 날짜', groups.dates);
    }

    renderNavigation();
  }

  // When the hash changes, render once from the hashchange handler (after every
  // other view has routed away) instead of rendering here and again there.
  let pendingNavigation = null;
  function showDocument(docId) {
    if (window.CodeWikiBoard) window.CodeWikiBoard.closeIfActive();
    const hash = `#doc/${docId}`;
    if (window.location.hash !== hash) {
      pendingNavigation = docId;
      window.location.hash = hash;
      return;
    }
    renderDocument(docId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigateTo(docId) {
    if (!window.WIKI_DOCS[docId]) return;
    showDocument(docId);
  }

  function selectTrack(track) {
    if (track === "ui5") return;
    currentTrack = "abap";
    try { sessionStorage.setItem(TRACK_SESSION_KEY, currentTrack); } catch {}
    showDocument(getHomeDocId(currentTrack));
  }

  window.CodeWikiApp = {
    openDoc: navigateTo,
    getCurrentDocId: () => currentDocId,
    getTrack: () => currentTrack,
    hasSelectedTrack: () => { try { return Boolean(sessionStorage.getItem(TRACK_SESSION_KEY)); } catch { return false; } },
    resetTrackChoice: () => { try { sessionStorage.removeItem(TRACK_SESSION_KEY); } catch {} },
    selectTrack
  };

  function initWikiLinks() {
    // Delegate once so newly rendered document/sidebar links need no rebinding.
    document.addEventListener('click', e => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest?.('[data-doc], [data-missing-doc]');
      if (!link) return;
      e.preventDefault();
      hoverPreviewCard.classList.add('hidden');
      if (link.hasAttribute('data-missing-doc')) window.CodeWikiBoard?.openWriteModal('');
      else navigateTo(link.getAttribute('data-doc'));
    });
    document.addEventListener('mouseover', e => {
      const link = e.target.closest?.('.wiki-link[data-doc]');
      if (!link || link.contains(e.relatedTarget)) return;
      const targetDoc = window.WIKI_DOCS[link.getAttribute('data-doc')];
      if (!targetDoc) return;
      const esc = window.CodeWikiLearning?.escape || (v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
      hoverPreviewCard.innerHTML = `
        <span class="preview-cat-badge">${esc(getCategoryName(targetDoc.categoryId))}</span>
        <div class="preview-doc-title">${esc(targetDoc.title)}</div>
        <div class="preview-doc-summary">${esc((targetDoc.summary || '').replace(/~~.+?~~/g, '').replace(/\{\{(.+?)\}\}/g, '$1'))}</div>
      `;
      hoverPreviewCard.classList.remove('hidden');
      movePreviewCard(e);
    });
    document.addEventListener('mousemove', e => {
      if (hoverPreviewCard.classList.contains('hidden')) return;
      if (e.target.closest?.('.wiki-link[data-doc]')) movePreviewCard(e);
    });
    document.addEventListener('mouseout', e => {
      const link = e.target.closest?.('.wiki-link[data-doc]');
      if (link && !link.contains(e.relatedTarget)) hoverPreviewCard.classList.add('hidden');
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
      if (e.key === "/" && document.activeElement !== searchInput && !document.activeElement?.isContentEditable && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchInput.focus();
      } else if (e.key === "Escape") {
        searchDropdown.classList.add("hidden");
      }
    });

    document.querySelector('.search-box').addEventListener('keydown', e => {
      const items = [...searchDropdown.querySelectorAll('[data-search-doc]')];
      if (searchDropdown.classList.contains('hidden') || !items.length) return;
      const at = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const down = e.key === 'ArrowDown';
        const next = at < 0 ? (down ? 0 : items.length - 1) : (at + (down ? 1 : -1) + items.length) % items.length;
        items[next].focus();
      } else if (e.key === 'Enter' && document.activeElement === searchInput) { e.preventDefault(); items[0].click(); }
    });
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) {
        searchDropdown.classList.add("hidden");
        return;
      }

      const results = window.CodeWikiLearning.search(searchIndex, q);
      if (!results.length) {
        searchDropdown.innerHTML = '<div class="search-item">일치하는 문서가 없습니다.</div>';
      } else {
        const {escape:esc, highlight} = window.CodeWikiLearning;
        searchDropdown.innerHTML = results.map(({doc:d, snippet}) =>
          '<button type="button" class="search-item" data-search-doc="' + esc(d.id) + '"><span><span class="search-item-title">' + highlight(d.title,q) +
          '</span><span class="search-item-sub">' + highlight(snippet,q) + '</span></span><span class="tcode-pill-badge">' + (d.isDailyLesson ? '수업일' : '주제') + '</span></button>'
        ).join('');
        searchDropdown.querySelectorAll('[data-search-doc]').forEach(item => item.addEventListener('click', () => {
          searchDropdown.classList.add('hidden'); searchInput.value = ''; navigateTo(item.dataset.searchDoc);
        }));
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
    // Keep wheel gestures over the fixed sidebar from scrolling the document,
    // including its non-scrolling header/footer and short menu lists.
    const sidebar = document.querySelector('.docked-sidebar');
    const sidebarScroll = document.querySelector('.sidebar-scroll-body');
    sidebar?.addEventListener('wheel', e => {
      if (e.ctrlKey || !e.deltaY || !sidebarScroll) return;
      const atBoundary = e.deltaY < 0 ? sidebarScroll.scrollTop <= 0
        : sidebarScroll.scrollTop + sidebarScroll.clientHeight >= sidebarScroll.scrollHeight - 1;
      if (!sidebarScroll.contains(e.target) || atBoundary) e.preventDefault();
    }, {passive:false});

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
      const requested = pendingNavigation;
      pendingNavigation = null;
      if (h.startsWith("#doc/")) {
        const target = h.replace("#doc/", "");
        const appHidden = appShell?.classList.contains('object-game-hidden') || appShell?.classList.contains('mentoring-hidden') || appShell?.classList.contains('study-hidden') || appShell?.classList.contains('members-hidden') || appShell?.classList.contains('board-mode-shell') || appShell?.classList.contains('map-hidden');
        if ((window.WIKI_DOCS[target] || target === "erp-setup") && (target !== currentDocId || appHidden || requested === target)) {
          if (window.CodeWikiBoard) window.CodeWikiBoard.closeIfActive();
          renderDocument(target);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    });

    const setSidebarCollapsed = collapsed => {
      appLayout?.classList[collapsed ? "add" : "remove"]("sidebar-collapsed");
      if (!toggleBtn) return;
      toggleBtn.title = collapsed ? "사이드바 펼치기" : "사이드바 접기";
      toggleBtn.setAttribute("aria-expanded", String(!collapsed));
    };
    // On narrow screens the fixed sidebar overlays the page: start collapsed and
    // close it after choosing a destination.
    const narrow = window.matchMedia?.("(max-width: 820px)");
    setSidebarCollapsed(Boolean(narrow?.matches));
    toggleBtn?.addEventListener("click", () => {
      setSidebarCollapsed(!appLayout?.classList.contains("sidebar-collapsed"));
    });
    sidebar?.addEventListener("click", e => {
      if (!narrow?.matches) return;
      if (e.target.closest?.("a[href], button[id^='open'], [data-doc], #openBoardBtn")) setSidebarCollapsed(true);
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
    themeToggleBtn.addEventListener("click", () => {
      const root = document.documentElement;
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      const label = next === "light" ? "다크 모드로 전환" : "라이트 모드로 전환";
      themeToggleBtn.title = label;
      themeToggleBtn.setAttribute("aria-label", label);
    });
  }

  function init() {
    window.addEventListener('cw-progress-change', refreshProgress);
    initWikiLinks();
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
