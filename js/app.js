/**
 * ============================================================================
 * [코어 렌더링 엔진: js/app.js]
 * ----------------------------------------------------------------------------
 * 주제별·수업일별 목차, 계정별 학습 완료, 본문 검색과 상호 링크를 렌더링합니다.
 * ============================================================================
 */
(function () {
  let currentTrack = "abap";
  let currentDocId = "welcome-abap";
  let navigationView = 'topic';
  try { navigationView = localStorage.getItem('codewiki_nav_view') === 'date' ? 'date' : 'topic'; } catch {}
  const expandedCategories = new Set(["abap-curriculum", "abap-bc430"]);
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
    const leftBound = /^[A-Za-z0-9_$#]/.test(alias) ? "(?<![A-Za-z0-9_$#])" : "";
    const rightBound = /[A-Za-z0-9_#]$/.test(alias) ? "(?![A-Za-z0-9_#])" : "";
    return new RegExp(`${leftBound}${escaped}${rightBound}`, "gi");
  }

  function findDocIdByExactAlias(word) {
    return exactAliases.get(word.trim().toLowerCase()) || null;
  }

  // 인라인 문법 파서 + 나무위키식 자동 키워드 하이퍼링크 엔진
  function canLinkDoc(doc) {
    if (typeof isDocAccessible === "function") return isDocAccessible(doc);
    if (!doc || doc.track === "ui5") return false;
    return !((doc.studentOnly || doc.isHome) && window.CodeWikiAuth?.getCurrentUser?.()?.role === "admin");
  }

  function parseInline(text, sourceDocId = currentDocId, checkAccess = true) {
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
    // Allowlist only known formatting tags; escape literal angle brackets (e.g. <>, <fs_row>).
    out = out.replace(/<(?:br\s*\/?|\/?(?:strong|mark|span|small|em|del)\b[^>]*)>/gi, stash);

    const esc = window.CodeWikiLearning.escape;

    // 1) 수동 명시 링크 [[문서ID|표시이름]] 보호 및 변환
    out = out.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, targetId, label) => {
      const rawId = targetId.trim();
      const id = window.WIKI_DOC_REDIRECTS?.[rawId] || rawId;
      const tabHint = window.WIKI_DOC_REDIRECT_TABS?.[rawId] || "";
      const targetDoc = window.WIKI_DOCS[id];
      const textLabel = label ? label.trim() : targetDoc ? targetDoc.title : rawId;
      if (targetDoc?.track === "ui5" || id === sourceDocId || (checkAccess && targetDoc && !canLinkDoc(targetDoc))) return stash(esc(textLabel));
      if (!targetDoc) {
        return stash(
          `<a href="#missing/${esc(rawId)}" class="wiki-link missing-wiki-link" data-missing-doc="${esc(textLabel)}" title="아직 미작성된 문서입니다. 클릭하여 추가 건의하기">${esc(textLabel)}</a>`
        );
      }
      return stash(`<a href="#doc/${esc(id)}" class="wiki-link" data-doc="${esc(id)}"${tabHint ? ` data-doc-tab="${esc(tabHint)}"` : ""}>${esc(textLabel)}</a>`);
    });

    // 2) 암기 모드 빈칸 토큰 {{키워드}} 보호
    out = out.replace(/\{\{(.+?)\}\}/g, (_, inner) =>
      stash(`<span class="quiz-token" title="클릭하여 정답 확인" tabindex="0" role="button">${esc(inner)}</span>`)
    );

    // 3) 인라인 코드 `코드` 변환 (만약 등록된 T-Code/개념 키워드라면 링크도 함께 연결!)
    out = out.replace(/`([^`]+)`/g, (_, codeStr) => {
      const matchedDocId = findDocIdByExactAlias(codeStr);
      const safeCode = esc(codeStr);
      if (matchedDocId && matchedDocId !== sourceDocId && (!checkAccess || canLinkDoc(window.WIKI_DOCS[matchedDocId]))) {
        return stash(
          `<a href="#doc/${esc(matchedDocId)}" class="wiki-link code-wiki-link" data-doc="${esc(matchedDocId)}"><code>${safeCode}</code></a>`
        );
      }
      return stash(`<code>${safeCode}</code>`);
    });

    // Escape remaining literal HTML characters before injecting generated markup.
    out = esc(out);

    // 4) 평문 속 등록 키워드(aliases) 자동 감지 → 하이퍼링크 연결 (현재 보고 있는 자기 자신 문서는 제외)
    for (const entry of aliases) {
      // Protect the whole term even on its own page, before shorter aliases run.
      out = out.replace(entry.regex, matchedText =>
        stash(entry.docId === sourceDocId || (checkAccess && !canLinkDoc(window.WIKI_DOCS[entry.docId])) ? matchedText :
          `<a href="#doc/${esc(entry.docId)}" class="wiki-link" data-doc="${esc(entry.docId)}">${matchedText}</a>`)
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
        for (const match of parseInline(value, doc.id, false).matchAll(/data-doc="([^"]+)"/g)) {
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
        '<a href="#doc/' + esc(day.docId) + '" class="nav-doc-link ' + (day.docId === currentDocId ? 'active' : '') + '" data-doc="' + esc(day.docId) + '" title="' + esc(day.title) + '"><span class="nav-doc-title-text">' + esc(day.title) + '</span>' +
        (readSet.has(day.docId) ? '<span class="read-check-mark" title="완료">✓</span>' : '') + '</a>';
    }).join('');
  }

  function textbookUnitLabel(doc) {
    if (!doc.textbookParts?.length) return '';
    const grouped = new Map();
    for (const part of doc.textbookParts) {
      const course = part.course || 'BC400';
      if (!grouped.has(course)) grouped.set(course, []);
      grouped.get(course).push(part.unit);
    }
    if (grouped.size === 1 && grouped.has('BC400')) {
      return '교재 Unit ' + grouped.get('BC400').join(' · ');
    }
    return [...grouped.entries()].map(([course, units]) => `${course} Unit ${units.join(' · ')}`).join(' · ');
  }

  function renderTextbookNavLabel(doc) {
    const label = textbookUnitLabel(doc);
    return label ? `<small class="nav-textbook-label">${window.CodeWikiLearning.escape(label)}</small>` : '';
  }

  function renderUnitMetaBanner(doc) {
    if (!doc.unitMeta) return '';
    const esc = window.CodeWikiLearning.escape;
    const m = doc.unitMeta;
    const pending = isDocumentPending(doc);
    const coursePrefix = m.course ? `${m.course} · ` : '';
    const unitPillClass = m.course === 'BC430' ? 'is-bc430' : 'is-unit';
    const textbookTab = m.course === 'BC430' ? 'bc430' : 'bc400';
    const textbookLinkLabel = m.course === 'BC430' ? 'BC430 교재 목차 →' : 'BC400 교재 목차 →';
    return `<div class="unit-meta-banner">
      <div class="unit-meta-pills">
        <span class="unit-meta-pill ${unitPillClass}">${esc(coursePrefix)}Unit ${esc(m.number)} · p. ${esc(m.page)}</span>
        <span class="unit-meta-pill">Lesson ${esc(m.lessonCount)}개</span>
        ${m.exerciseRange ? `<span class="unit-meta-pill is-exercise">${esc(m.exerciseRange)}</span>` : ''}
        ${m.dates ? `<span class="unit-meta-pill is-dates">수업일 ${esc(m.dates)}</span>` : (pending ? '<span class="unit-meta-pill is-pending">수업 예정 · 준비 중</span>' : '')}
      </div>
      <a href="#doc/abap-textbook" class="unit-meta-link wiki-link" data-doc="abap-textbook" data-doc-tab="${textbookTab}">${textbookLinkLabel}</a>
    </div>`;
  }

  function renderTextbookReferences(doc) {
    if (doc.unitMeta || !doc.textbookParts?.length) return '';
    const esc = window.CodeWikiLearning.escape;
    const courses = [...new Set(doc.textbookParts.map(part => part.course || 'BC400'))];
    const textbookLinks = courses.map(course => {
      const tab = course === 'BC430' ? 'bc430' : 'bc400';
      return `<a href="#doc/abap-textbook" class="wiki-link" data-doc="abap-textbook" data-doc-tab="${tab}">${esc(course)} 교재 목차 보기</a>`;
    }).join(' · ');
    return `<details class="textbook-references">
      <summary>${esc(textbookUnitLabel(doc))}<span class="textbook-reference-hint">Lesson · 페이지 보기</span></summary>
      <div class="textbook-reference-body">
        ${doc.textbookParts.map(part => `<div class="textbook-reference-unit">
          <h3>Unit ${esc(part.unit)}: ${esc(part.title)}</h3>
          <ul>${part.entries.map(entry => `<li><span>${esc(entry.title)}</span><span class="textbook-page">p. ${esc(entry.page)}</span></li>`).join('')}</ul>
        </div>`).join('')}
        ${textbookLinks}
      </div>
    </details>`;
  }

  function syncSqlSidebarActive(modeId = null) {
    const isSql = currentDocId === 'abap-sql-guide';
    const sqlDoc = window.WIKI_DOCS?.['abap-sql-guide'];
    const activeMode = isSql
      ? (modeId || activeDocModes.get('abap-sql-guide') || sqlDoc?.defaultSyntaxMode || 'new')
      : null;
    document.querySelectorAll('.sb-sql-mode-link[data-doc-mode]').forEach(el => {
      el.classList.toggle('active', Boolean(isSql && el.dataset.docMode === activeMode));
    });
  }

  // 좌측 고정 사이드바 렌더링 (불필요한 빈 요소 자동 숨김)
  function renderNavigation() {
    const esc = window.CodeWikiLearning.escape;
    document.getElementById('sbScheduleItem')?.classList.toggle('active', currentDocId === 'education-schedule');
    document.getElementById('sbThinkingFlowItem')?.classList.toggle('active', currentDocId === 'abap-thinking-flow');
    document.getElementById('sbProgramCatalogItem')?.classList.toggle('active', currentDocId === 'sap-gui-programs');
    document.getElementById('sbBasicSessionItem')?.classList.toggle('active', currentDocId === 'basic-session-review');
    syncSqlSidebarActive();
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
      .filter(cat => navigationView !== 'date' || (cat.id !== `${currentTrack}-curriculum` && cat.id !== 'abap-bc430'))
      .map(cat => {
        const docsInCat = allDocs.filter(d => d.categoryId === cat.id);
        const renderNavRow = d => {
          const pending = isDocumentPending(d);
          const labelTitle = d.unitMeta ? d.unitMeta.koTitle : d.title;
          const badgeClass = d.unitMeta?.course === "BC430" ? " is-bc430" : "";
          const tooltip = d.unitMeta ? `${d.title} (${d.unitMeta.enTitle})` : d.title;
          const unitDetail = d.unitMeta
            ? `p. ${d.unitMeta.page}${d.unitMeta.exerciseRange ? ` · ${d.unitMeta.exerciseRange}` : (d.unitMeta.lessonCount ? ` · Lesson ${d.unitMeta.lessonCount}개` : "")}`
            : "";
          const subMeta = d.unitMeta
            ? `<small class="nav-textbook-label">${esc(unitDetail)}${pending ? ' <span class="pending-doc-badge">준비 중</span>' : ""}</small>`
            : renderTextbookNavLabel(d);
          const titlePending = !d.unitMeta && pending ? ' <small class="pending-doc-badge">준비 중</small>' : "";
          return `
            <a href="#doc/${esc(d.id)}" class="nav-doc-link ${d.id === currentDocId ? "active" : ""}" data-doc="${esc(d.id)}" title="${esc(tooltip)}">
              ${d.stepNum ? `<span class="step-num-badge${badgeClass}">${esc(d.stepNum)}</span>` : ""}
              <span class="nav-doc-title-text"><span class="nav-doc-title-main">${esc(labelTitle)}${titlePending}</span>${subMeta}</span>
              ${readSet.has(d.id) ? `<span class="read-check-mark" title="완료">✓</span>` : ""}
            </a>`;
        };
        const isOpen = expandedCategories.has(cat.id);
        const hasActiveChild = docsInCat.some(d => d.id === currentDocId);

        return `
          <div class="sb-folder-group ${isOpen ? "open" : ""}">
            <button type="button" class="sb-folder-row ${hasActiveChild ? "has-active" : ""}" data-toggle-cat="${esc(cat.id)}" aria-expanded="${isOpen}">
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
                ${docsInCat.map(renderNavRow).join("")}
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
        categoryNav.querySelector(`[data-toggle-cat="${catId}"]`)?.focus({ preventScroll: true });
      });
    });

  }

  function renderEditorCode(raw, abap = true, numbered = true) {
    const escape = value => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const keywords = new Set(('REPORT MESSAGE-ID DATA TYPES TYPE LIKE VALUE CONSTANTS CLEAR WRITE PARAMETERS MATCHCODE LISTBOX VISIBLE SELECT-OPTIONS RANGE FOR IN INITIALIZATION TABLES START-OF-SELECTION END-OF-SELECTION AT SELECTION-SCREEN OUTPUT BEGIN OF END INCLUDE TABLE LINE STANDARD SORTED HASHED KEY UNIQUE NON-UNIQUE APPEND INSERT READ MODIFY TRANSPORTING ASSIGNING FIELD-SYMBOL DELETE SORT ASCENDING DESCENDING CORRESPONDING FIELDS GROUP AS COUNT SUM AVG MIN MAX ORDER HAVING JOIN LEFT OUTER INNER ON IF ELSE ELSEIF ENDIF DO TIMES ENDDO WHILE ENDWHILE LOOP AT ENDLOOP EXIT CONTINUE RETURN MOD DIV IS NOT INITIAL AND OR BETWEEN CA CS NE EQ CONCATENATE INTO SEPARATED BY FORM ENDFORM PERFORM USING CHANGING SELECT SINGLE BYPASSING BUFFER FROM WHERE ENDSELECT CALL FUNCTION METHOD CLASS DEFINITION IMPLEMENTATION PUBLIC PRIVATE PROTECTED SECTION METHODS CLASS-METHODS ENDMETHOD ENDCLASS CREATE OBJECT REF TO IMPORTING EXPORTING RETURNING EXCEPTIONS TRY CATCH ENDTRY MESSAGE WITH LENGTH DECIMALS DEFAULT MOVE TRANSLATE CONDENSE ULINE').split(' '));
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
    const esc = window.CodeWikiLearning.escape;
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
                  <div class="practice-step-num">${esc(st.step)}</div>
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
                    ${st.badge ? `<span class="flow-step-badge">${esc(st.badge)}</span>` : ""}
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
                  ${item.tag ? `<div class="compare-card-tag">${esc(item.tag)}</div>` : ""}
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

      case "callout": {
        const style = /^[a-z-]+$/.test(block.style || "") ? block.style : "tip";
        return `
          <div class="block-callout type-${style}">
            <div class="callout-title">${parseInline(block.title)}</div>
            <div class="callout-body">${parseInline(block.body)}</div>
          </div>
        `;
      }

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
        return `<div class="block-widget-slot" data-widget-id="${esc(block.widgetId)}" id="widget-slot-${blockIdx}"></div>`;

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
  const activeDocTabs = new Map();
  const activeDocModes = new Map();
  function renderDocument(docId) {
    const parsed = parseDocHash(docId);
    if (parsed.modeHint && window.WIKI_DOCS[parsed.docId]?.syntaxModes?.some(m => m.id === parsed.modeHint)) {
      activeDocModes.set(parsed.docId, parsed.modeHint);
    }
    docId = parsed.rawId;
    if ((docId === 'welcome-abap' || docId === 'welcome-ui5') && !window.CodeWikiAuth?.isAdminPreviewMode?.() && window.CodeWikiAdminMembers?.openHome()) return;
    const redirectTab = parsed.redirectTab;
    const redirectedDocId = parsed.docId !== docId ? parsed.docId : null;
    if (redirectedDocId && window.WIKI_DOCS[redirectedDocId]) {
      if (redirectTab) activeDocTabs.set(redirectedDocId, redirectTab);
      docId = redirectedDocId;
      history.replaceState(null, "", `#doc/${docId}`);
    }
    if (window.WIKI_DOCS[docId]?.studentOnly && window.CodeWikiAuth?.getCurrentUser?.()?.role === "admin" && !window.CodeWikiAuth?.isAdminPreviewMode?.()) {
      if (window.CodeWikiAdminMembers?.openHome()) return;
    }
    if (window.WIKI_DOCS[docId] && !isDocAccessible(window.WIKI_DOCS[docId]) && window.CodeWikiAuth?.getCurrentUser?.()?.role === "student") {
      docId = "welcome-abap";
      history.replaceState(null, "", "#doc/welcome-abap");
    }
    window.CodeWikiAdminMembers?.leave();
    window.CodeWikiKnowledgeMap?.leave?.();
    window.CodeWikiFoundation?.leave?.();
    if (window.WIKI_DOCS[docId]?.track === "ui5") {
      docId = "welcome-abap";
      history.replaceState(null, "", "#doc/welcome-abap");
    }
    const allDocsObj = window.WIKI_DOCS || {};
    const targetDoc = allDocsObj[docId] || allDocsObj[getHomeDocId(currentTrack)] || Object.values(allDocsObj)[0];
    if (!targetDoc) return;

    if (targetDoc.track && targetDoc.track !== currentTrack) {
      currentTrack = targetDoc.track;
    }

    const doc = targetDoc;
    currentDocId = doc.id;
    window.CodeWikiTelemetry?.trackDocView?.(doc.id, doc.title);
    if (doc.categoryId) {
      expandedCategories.add(doc.categoryId);
    }
    articleContainer._applyDocView = null;
    articleContainer._syncTocVisibility = null;

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
    const hasSectionTabs = Array.isArray(doc.sectionTabs) && doc.sectionTabs.length > 0;
    const hasSyntaxModes = Array.isArray(doc.syntaxModes) && doc.syntaxModes.length > 0;
    const initialMode = hasSyntaxModes
      ? (doc.syntaxModes.some(m => m.id === activeDocModes.get(doc.id))
        ? activeDocModes.get(doc.id)
        : (doc.syntaxModes.some(m => m.id === doc.defaultSyntaxMode) ? doc.defaultSyntaxMode : doc.syntaxModes[0].id))
      : null;
    const syntaxModeMap = hasSyntaxModes ? new Map(doc.syntaxModes.map(m => [m.id, m])) : null;
    const hasMetaTop = Boolean(doc.categoryId || doc.stepNum || (doc.tcodes && doc.tcodes.length > 0));
    const showFooter = !doc.isHome;

    // Preserve the shared TOC node before replacing the current document.
    if (tocCardWrap) sidebarRight?.prepend(tocCardWrap);
    appShell?.classList.remove("sql-practice-wide");
    articleContainer.classList.remove("sql-practice-mode");
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
      ${renderUnitMetaBanner(doc)}
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
      ${doc.tabsAboveToc ? "" : '<div id="documentTocSlot"></div>'}
      ${
        hasSyntaxModes
          ? `
        <div class="doc-syntax-panel" id="docSyntaxPanel" data-syntax-mode="${esc(initialMode)}">
          <div class="doc-syntax-header">
            <div class="doc-syntax-switch" role="tablist" aria-label="${esc(doc.title)} 탭 선택">
              ${doc.syntaxModes
                .map(
                  mode => `<button type="button" class="doc-syntax-btn" role="tab" id="docSyntax-${esc(mode.id)}" data-doc-mode="${esc(mode.id)}" aria-selected="false" tabindex="-1"><span class="doc-syntax-label">${esc(mode.label)}</span>${mode.badge ? `<span class="doc-syntax-badge">${esc(mode.badge)}</span>` : ""}</button>`
                )
                .join("")}
            </div>
            <span class="doc-syntax-current" id="docSyntaxCurrent"></span>
          </div>
          <p class="doc-syntax-desc" id="docSyntaxDesc"></p>
        </div>
        ${doc.syntaxModes
          .filter(m => m.widgetId)
          .map(m => `<div class="doc-mode-widget-panel" role="tabpanel" aria-labelledby="docSyntax-${esc(m.id)}" data-mode-panel="${esc(m.id)}" data-lazy-widget-id="${esc(m.widgetId)}" hidden></div>`)
          .join("")}
      `
          : ""
      }
      ${
        hasSectionTabs
          ? `
        <div class="doc-tab-shell">
          <div class="doc-tab-bar" role="tablist" aria-label="${esc(doc.title)} 주제 탭">
            ${doc.hideAllTab ? "" : `<button type="button" class="doc-tab-btn" role="tab" id="docTab-all" data-doc-tab="all" aria-selected="false" tabindex="-1"><span class="doc-tab-label">전체 보기</span><span class="doc-tab-count">${sections.filter(sec => sec.tab).length || sections.length}</span></button>`}
            ${doc.sectionTabs
              .map(tab => {
                const count = sections.filter(sec => sec.tab === tab.id).length;
                const kindClass = tab.kind ? ` kind-${esc(tab.kind)}` : "";
                const pendingClass = tab.pending ? " is-pending" : "";
                return `<button type="button" class="doc-tab-btn${pendingClass}" role="tab" id="docTab-${esc(tab.id)}" data-doc-tab="${esc(tab.id)}" aria-selected="false" tabindex="-1">${tab.badge ? `<span class="doc-tab-kind${kindClass}${pendingClass}">${esc(tab.badge)}</span>` : ""}<span class="doc-tab-label">${esc(tab.label)}</span>${tab.hideCount ? "" : `<span class="doc-tab-count">${count}</span>`}</button>`;
              })
              .join("")}
          </div>
          <p class="doc-tab-desc" id="docTabDesc"></p>
        </div>
      `
          : ""
      }
      ${doc.tabsAboveToc ? '<div id="documentTocSlot"></div>' : ""}
      <div class="doc-sections-wrap"${hasSectionTabs ? ' role="tabpanel" id="docTabPanel"' : ""}${hasSyntaxModes ? ` data-active-mode="${esc(initialMode)}"` : ""}>
        ${
          sections.length === 0
            ? `
          <div style="padding:48px 20px; text-align:center; color:var(--text-muted); font-size:13.5px;">
            본문 준비 중입니다.
          </div>
        `
            : sections
                .map(
                  (sec, sIdx) => {
                    const secMode = sec.mode || "both";
                    const modePill = hasSyntaxModes
                      ? `<span class="doc-sec-mode-pill mode-${esc(secMode)}">${esc(secMode === "both" ? "공통" : (syntaxModeMap.get(secMode)?.label || secMode))}</span>`
                      : "";
                    const unitPill = (sec.badge || sec.page)
                      ? `<span class="doc-sec-unit-pill${sec.kind === "exercise" ? " is-exercise" : ""}">${esc([sec.badge, sec.page].filter(Boolean).join(" · "))}</span>`
                      : "";
                    return `
          <section class="doc-section" id="sec-${sIdx + 1}"${sec.tab ? ` data-section-tab="${esc(sec.tab)}"` : ""}${hasSyntaxModes ? ` data-section-mode="${esc(secMode)}"` : ""}>
            <h2 class="doc-sec-title">
              ${doc.hideSectionNumbers ? "" : `<span class="doc-sec-num">${sIdx + 1}.</span>`}
              ${unitPill}
              <span>${esc(sec.title)}</span>
              ${modePill}
            </h2>
            ${!(sec.blocks || []).length ? `<p class="pending-section-note">${esc(sec.pendingNote || "준비 중 · 본문을 작성하고 있습니다.")}</p>` : ""}
            ${(sec.blocks || [])
              .map(b => {
                widgetCounter++;
                return renderBlock(b, widgetCounter);
              })
              .join("")}
          </section>
        `;
                  }
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

    if (hasSectionTabs || hasSyntaxModes) {
      const tabButtons = [...articleContainer.querySelectorAll(".doc-tab-btn[data-doc-tab]")];
      const modeButtons = [...articleContainer.querySelectorAll(".doc-syntax-btn[data-doc-mode]")];
      const modePanels = [...articleContainer.querySelectorAll(".doc-mode-widget-panel[data-mode-panel]")];
      const sectionNodes = [...articleContainer.querySelectorAll(".doc-section")];
      const tabShell = articleContainer.querySelector(".doc-tab-shell");
      const sectionsWrap = articleContainer.querySelector(".doc-sections-wrap");
      const tabDesc = document.getElementById("docTabDesc");
      const tabPanel = document.getElementById("docTabPanel");
      const syntaxPanel = document.getElementById("docSyntaxPanel");
      const syntaxCurrent = document.getElementById("docSyntaxCurrent");
      const syntaxDesc = document.getElementById("docSyntaxDesc");
      const tabMap = hasSectionTabs ? new Map(doc.sectionTabs.map(t => [t.id, t])) : new Map();
      const allowAllTab = !doc.hideAllTab;
      const defaultTabId = hasSectionTabs
        ? ((allowAllTab && doc.defaultTab === "all") || tabMap.has(doc.defaultTab) ? doc.defaultTab : doc.sectionTabs[0].id)
        : "all";

      let currentMode = initialMode;
      let currentTab = hasSectionTabs
        ? (activeDocTabs.has(doc.id) && ((allowAllTab && activeDocTabs.get(doc.id) === "all") || tabMap.has(activeDocTabs.get(doc.id)))
            ? activeDocTabs.get(doc.id)
            : defaultTabId)
        : "all";

      const matchesMode = (secMode, modeId) => !hasSyntaxModes || !secMode || secMode === "both" || secMode === modeId;

      const syncTocVisibility = () => {
        if (!doc.filterTocByTab || !tocList) return;
        tocList.querySelectorAll(".toc-link").forEach(link => {
          const targetEl = document.getElementById(link.getAttribute("data-target"));
          link.hidden = Boolean(targetEl?.hidden);
        });
      };

      const applyDocView = (nextTabId, nextModeId, focusEl = null) => {
        let activeModeMeta = null;
        if (hasSyntaxModes) {
          currentMode = syntaxModeMap.has(nextModeId) ? nextModeId : initialMode;
          activeDocModes.set(doc.id, currentMode);
          activeModeMeta = syntaxModeMap.get(currentMode);
          if (syntaxPanel) syntaxPanel.dataset.syntaxMode = currentMode;
          if (sectionsWrap) sectionsWrap.dataset.activeMode = currentMode;
          modeButtons.forEach(btn => {
            const active = btn.dataset.docMode === currentMode;
            btn.classList.toggle("active", active);
            btn.setAttribute("aria-selected", String(active));
            btn.tabIndex = active ? 0 : -1;
            if (active && focusEl === "mode") btn.focus();
          });
          if (syntaxCurrent && activeModeMeta) {
            syntaxCurrent.textContent = `현재 화면 · ${activeModeMeta.bannerTitle || activeModeMeta.label}`;
          }
          if (syntaxDesc && activeModeMeta) {
            syntaxDesc.textContent = activeModeMeta.desc || "";
          }
          if (doc.id === "abap-sql-guide") {
            syncSqlSidebarActive(currentMode);
            const expectedHash = `#doc/${doc.id}/${currentMode}`;
            if (window.location.hash.startsWith(`#doc/${doc.id}`) && window.location.hash !== expectedHash) {
              history.replaceState(null, "", expectedHash);
            }
          }
        }

        const isWidgetMode = Boolean(activeModeMeta?.widgetId);
        modePanels.forEach(panel => {
          const active = isWidgetMode && panel.dataset.modePanel === currentMode;
          panel.hidden = !active;
          if (active && !panel.dataset.widgetMounted) {
            const wId = panel.dataset.lazyWidgetId;
            if (window.WIKI_WIDGETS && typeof window.WIKI_WIDGETS[wId] === "function") {
              panel.dataset.widgetMounted = "1";
              window.WIKI_WIDGETS[wId](panel);
            }
          }
        });
        if (tabShell) tabShell.hidden = isWidgetMode;
        if (sectionsWrap) sectionsWrap.hidden = isWidgetMode;
        const isPracticeWide = isWidgetMode && activeModeMeta?.widgetId === "abap-sql-practice";
        articleContainer.classList.toggle("sql-practice-mode", isPracticeWide);
        appShell?.classList.toggle("sql-practice-wide", isPracticeWide);
        if (isWidgetMode) {
          syncTocVisibility();
          return;
        }

        const modeSections = sections.filter(sec => matchesMode(sec.mode || "both", currentMode));
        const tabbedModeSections = modeSections.filter(sec => sec.tab);
        const totalAllCount = tabbedModeSections.length || modeSections.length;

        if (hasSectionTabs) {
          currentTab = (allowAllTab && nextTabId === "all") || tabMap.has(nextTabId) ? nextTabId : defaultTabId;
          activeDocTabs.set(doc.id, currentTab);
          tabButtons.forEach(btn => {
            const id = btn.dataset.docTab;
            const active = id === currentTab;
            btn.classList.toggle("active", active);
            btn.setAttribute("aria-selected", String(active));
            btn.tabIndex = active ? 0 : -1;
            const labelNode = btn.querySelector(".doc-tab-label");
            const countNode = btn.querySelector(".doc-tab-count");
            if (id === "all") {
              if (countNode) countNode.textContent = String(totalAllCount);
            } else {
              const meta = tabMap.get(id);
              if (labelNode && meta) labelNode.textContent = (hasSyntaxModes && meta.labelByMode?.[currentMode]) || meta.label;
              if (countNode) countNode.textContent = String(modeSections.filter(sec => sec.tab === id).length);
            }
            if (active && focusEl === "tab") btn.focus();
          });
          if (tabPanel) tabPanel.setAttribute("aria-labelledby", `docTab-${currentTab}`);
          if (tabDesc) {
            const modePrefix = hasSyntaxModes ? `${syntaxModeMap.get(currentMode)?.label || ""} ` : "";
            const meta = tabMap.get(currentTab);
            tabDesc.textContent = currentTab === "all"
              ? `${modePrefix}전체 ${totalAllCount}개 항목을 한 번에 보고 있습니다.`
              : ((hasSyntaxModes && meta?.descByMode?.[currentMode]) || meta?.desc || "");
          }
        }

        sectionNodes.forEach(sec => {
          const modeOk = matchesMode(sec.dataset.sectionMode || "both", currentMode);
          const tabOk = !hasSectionTabs || currentTab === "all" || sec.dataset.sectionTab === currentTab;
          sec.hidden = !(modeOk && tabOk);
        });
        syncTocVisibility();
      };
      articleContainer._applyDocView = (tabId, modeId) => applyDocView(tabId ?? currentTab, modeId ?? currentMode);
      articleContainer._syncTocVisibility = syncTocVisibility;

      modeButtons.forEach((btn, idx) => {
        btn.addEventListener("click", () => applyDocView(currentTab, btn.dataset.docMode));
        btn.addEventListener("keydown", e => {
          let nextIdx = -1;
          if (e.key === "ArrowRight") nextIdx = (idx + 1) % modeButtons.length;
          else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + modeButtons.length) % modeButtons.length;
          else if (e.key === "Home") nextIdx = 0;
          else if (e.key === "End") nextIdx = modeButtons.length - 1;
          if (nextIdx >= 0) {
            e.preventDefault();
            applyDocView(currentTab, modeButtons[nextIdx].dataset.docMode, "mode");
          }
        });
      });

      tabButtons.forEach((btn, idx) => {
        btn.addEventListener("click", () => applyDocView(btn.dataset.docTab, currentMode));
        btn.addEventListener("keydown", e => {
          let nextIdx = -1;
          if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabButtons.length;
          else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabButtons.length) % tabButtons.length;
          else if (e.key === "Home") nextIdx = 0;
          else if (e.key === "End") nextIdx = tabButtons.length - 1;
          if (nextIdx >= 0) {
            e.preventDefault();
            applyDocView(tabButtons[nextIdx].dataset.docTab, currentMode, "tab");
          }
        });
      });

      applyDocView(currentTab, currentMode);
    }

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
          clearTimeout(btn._copyTimer);
          btn._copyTimer = setTimeout(() => { btn.textContent = "복사"; }, 1400);
        };
        if (!navigator.clipboard?.writeText) { reset("복사 불가"); return; }
        navigator.clipboard.writeText(raw).then(() => {
          reset("복사됨 ✓");
          window.CodeWikiTelemetry?.trackCodeCopy?.(doc.id);
        }).catch(() => reset("복사 실패"));
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
    const backlinks = computeBacklinks(doc.id).filter(isDocAccessible);
    const groups = window.CodeWikiLearning.relatedGroups(doc, backlinks, documents.filter(isDocAccessible));
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
          if (el) {
            if (el.hidden && typeof articleContainer._applyDocView === "function") {
              articleContainer._applyDocView(el.dataset.sectionTab || "all");
            }
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      });
      if (typeof articleContainer._syncTocVisibility === "function") {
        articleContainer._syncTocVisibility();
      }
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
      const backlinkLabel = b => (b.unitMeta ? b.unitMeta.koTitle : b.title);
      const link = b => '<a href="#doc/' + esc(b.id) + '" class="backlink-pill wiki-link" data-doc="' + esc(b.id) + '" title="' + esc(b.title) + '">' + esc(backlinkLabel(b)) + '</a>';
      const group = (title, items) => !items.length ? '' : '<div class="related-group"><h3>' + title + '</h3>' + items.slice(0,5).map(link).join('') +
        (items.length > 5 ? '<details><summary>더 보기 (' + (items.length-5) + ')</summary>' + items.slice(5).map(link).join('') + '</details>' : '') + '</div>';
      backlinkBox.innerHTML = group('관련 개념', groups.concepts) + group('이 내용을 배운 날짜', groups.dates);
    }

    renderNavigation();
  }

  // When the hash changes, render once from the hashchange handler (after every
  // other view has routed away) instead of rendering here and again there.
  function parseDocHash(rawTarget) {
    const parts = String(rawTarget || "").split("/");
    const rawId = parts[0] || "";
    const modeHint = parts[1] || null;
    const redirectTab = window.WIKI_DOC_REDIRECT_TABS?.[rawId] || null;
    const docId = window.WIKI_DOC_REDIRECTS?.[rawId] || rawId;
    return { rawId, docId, redirectTab, modeHint };
  }
  const STUDENT_ONLY_HASHES = new Set(["#map", "#study", "#mentoring", "#data-game", "#foundation"]);
  function isDocAccessible(doc) {
    if (!doc || doc.track === "ui5") return false;
    const role = window.CodeWikiAuth?.getCurrentUser?.()?.role;
    const previewing = Boolean(window.CodeWikiAuth?.isAdminPreviewMode?.());
    if ((doc.studentOnly || doc.isHome) && role === "admin" && !previewing) return false;
    if (role === "student") {
      if (doc.id === "basic-session-review" && window.CodeWikiTelemetry?.isFeatureEnabled?.("basicSession") === false) return false;
      if (doc.id === "abap-sql-guide" && window.CodeWikiTelemetry?.isFeatureEnabled?.("sqlGuide") === false) return false;
    }
    return true;
  }

  let pendingNavigation = null;
  let pendingSectionTarget = null;
  let sectionHighlightTimer = null;
  let renderedAdminRole = null;

  function focusDocumentSection(sectionId, tabId = null, modeId = null) {
    if (!sectionId || typeof document === "undefined") return false;
    const articleEl = typeof articleContainer !== "undefined" ? articleContainer : null;
    const wrapHidden = Boolean(articleEl?.querySelector?.(".doc-sections-wrap")?.hidden);
    const activeMode = modeId || (wrapHidden && typeof currentDocId !== "undefined" ? (window.WIKI_DOCS?.[currentDocId]?.defaultSyntaxMode || "new") : null);
    if (activeMode && typeof articleEl?._applyDocView === "function") {
      articleEl._applyDocView(null, activeMode);
    }
    const el = document.getElementById(sectionId);
    if (!el) return false;
    if ((el.hidden || wrapHidden) && typeof articleEl?._applyDocView === "function") {
      articleEl._applyDocView(el.dataset.sectionTab || tabId || "all", activeMode);
    }
    if (el.hidden) return false;
    el.scrollIntoView?.({ behavior: "smooth", block: "start" });
    document.querySelectorAll?.(".doc-section.search-jump-highlight").forEach(node => node.classList.remove("search-jump-highlight"));
    void el.offsetWidth;
    el.classList?.add("search-jump-highlight");
    if (typeof clearTimeout === "function") clearTimeout(sectionHighlightTimer);
    if (typeof setTimeout === "function") {
      sectionHighlightTimer = setTimeout(() => el.classList?.remove("search-jump-highlight"), 2200);
    }
    return true;
  }

  function consumePendingSection(docId) {
    const target = pendingSectionTarget;
    if (!target || target.docId !== docId) return false;
    pendingSectionTarget = null;
    return focusDocumentSection(target.sectionId, target.tabId, target.modeId);
  }

  function showDocument(docId, modeId = null) {
    if (window.CodeWikiBoard) window.CodeWikiBoard.closeIfActive();
    const targetDoc = window.WIKI_DOCS[docId];
    const validMode = modeId && targetDoc?.syntaxModes?.some(m => m.id === modeId) ? modeId : null;
    const hash = validMode ? `#doc/${docId}/${validMode}` : `#doc/${docId}`;
    const shellEl = typeof appShell !== "undefined" ? appShell : null;
    const articleEl = typeof articleContainer !== "undefined" ? articleContainer : null;
    const appHidden = shellEl?.classList.contains('object-game-hidden') || shellEl?.classList.contains('mentoring-hidden') || shellEl?.classList.contains('foundation-hidden') || shellEl?.classList.contains('study-hidden') || shellEl?.classList.contains('members-hidden') || shellEl?.classList.contains('board-mode-shell') || shellEl?.classList.contains('map-hidden');
    if (typeof currentDocId !== "undefined" && docId === currentDocId && !appHidden) {
      if (validMode && typeof articleEl?._applyDocView === "function") {
        if (window.location.hash !== hash) history.replaceState(null, "", hash);
        articleEl._applyDocView(null, validMode);
        if (!consumePendingSection(docId)) window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (pendingSectionTarget?.docId === docId) {
        if (window.location.hash !== hash) history.replaceState(null, "", hash);
        if (!consumePendingSection(docId)) window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    if (window.location.hash !== hash) {
      pendingNavigation = validMode ? `${docId}/${validMode}` : docId;
      window.location.hash = hash;
      return;
    }
    renderDocument(validMode ? `${docId}/${validMode}` : docId);
    if (!consumePendingSection(docId)) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigateTo(docId, tabId = null, modeId = null, sectionId = null) {
    const parsed = parseDocHash(docId);
    docId = parsed.docId;
    if (!window.WIKI_DOCS[docId]) return;
    if (!isDocAccessible(window.WIKI_DOCS[docId])) {
      pendingSectionTarget = null;
      window.CodeWikiAdminMembers?.openHome?.();
      return;
    }
    const nextTab = tabId || parsed.redirectTab;
    const nextMode = modeId || parsed.modeHint;
    pendingSectionTarget = sectionId ? { docId, sectionId, tabId: nextTab || null, modeId: nextMode || null } : null;
    if (nextTab && !sectionId && typeof activeDocTabs !== "undefined") activeDocTabs.set(docId, nextTab);
    if (nextMode && typeof activeDocModes !== "undefined" && window.WIKI_DOCS[docId].syntaxModes?.some(m => m.id === nextMode)) {
      activeDocModes.set(docId, nextMode);
    }
    showDocument(docId, nextMode);
  }

  function selectTrack(track) {
    if (track === "ui5") return;
    currentTrack = "abap";
    const h = window.location.hash;
    if (STUDENT_ONLY_HASHES.has(h)) return;
    if (h.startsWith("#doc/")) {
      const parsed = parseDocHash(h.replace("#doc/", ""));
      if (isDocAccessible(window.WIKI_DOCS[parsed.docId])) {
        if (parsed.redirectTab) activeDocTabs.set(parsed.docId, parsed.redirectTab);
        if (parsed.modeHint && window.WIKI_DOCS[parsed.docId]?.syntaxModes?.some(m => m.id === parsed.modeHint)) {
          activeDocModes.set(parsed.docId, parsed.modeHint);
        }
        showDocument(parsed.docId, parsed.modeHint);
        return;
      }
    }
    showDocument(getHomeDocId(currentTrack));
  }

  window.CodeWikiApp = {
    openDoc: navigateTo,
    renderEditorCode,
    getCurrentDocId: () => currentDocId,
    getTrack: () => currentTrack,
    selectTrack,
    syncAccess: () => {
      const user = window.CodeWikiAuth?.getCurrentUser?.();
      const isAdmin = user?.role === "admin" && !window.CodeWikiAuth?.isAdminPreviewMode?.();
      const h = window.location.hash;
      const roleChanged = renderedAdminRole !== null && renderedAdminRole !== isAdmin;
      renderedAdminRole = isAdmin;
      if (isAdmin && !h.startsWith("#admin/") && (STUDENT_ONLY_HASHES.has(h) || (window.WIKI_DOCS[currentDocId] && !isDocAccessible(window.WIKI_DOCS[currentDocId])))) {
        window.CodeWikiAdminMembers?.openHome?.();
        return;
      }
      if (!isAdmin && user?.role === "student" && user.status === "approved" && h.startsWith("#admin/")) {
        window.CodeWikiTelemetry?.trackSecurityProbe?.("admin_route_probe", h);
        showDocument(getHomeDocId(currentTrack));
        return;
      }
      const appHidden = appShell?.classList.contains('object-game-hidden') || appShell?.classList.contains('mentoring-hidden') || appShell?.classList.contains('foundation-hidden') || appShell?.classList.contains('study-hidden') || appShell?.classList.contains('members-hidden') || appShell?.classList.contains('board-mode-shell') || appShell?.classList.contains('map-hidden');
      if (roleChanged && !appHidden && (!h || h.startsWith("#doc/")) && isDocAccessible(window.WIKI_DOCS[currentDocId])) {
        renderDocument(currentDocId);
      }
    }
  };

  function initWikiLinks() {
    // Delegate once so newly rendered document/sidebar links need no rebinding.
    document.addEventListener('click', e => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest?.('[data-doc], [data-missing-doc]');
      if (!link) return;
      e.preventDefault();
      hoverPreviewCard.classList.add('hidden');
      if (link.hasAttribute('data-missing-doc')) window.CodeWikiBoard?.openWriteModal('', link.getAttribute('data-missing-doc') || '');
      else navigateTo(link.getAttribute('data-doc'), link.getAttribute('data-doc-tab'), link.getAttribute('data-doc-mode'));
    });
    document.addEventListener('mouseover', e => {
      const link = e.target.closest?.('.wiki-link[data-doc]');
      if (!link || link.contains(e.relatedTarget)) return;
      const targetDoc = window.WIKI_DOCS[link.getAttribute('data-doc')];
      if (!targetDoc || !isDocAccessible(targetDoc)) return;
      const esc = window.CodeWikiLearning?.escape || (v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
      const catLabel = getCategoryName(targetDoc.categoryId);
      const summaryText = window.CodeWikiLearning?.plain
        ? window.CodeWikiLearning.plain(targetDoc.summary || '')
        : String(targetDoc.summary || '').replace(/~~.+?~~/g, '').replace(/\{\{(.+?)\}\}/g, '$1');
      hoverPreviewCard.innerHTML = `
        ${catLabel ? `<span class="preview-cat-badge">${esc(catLabel)}</span>` : ''}
        <div class="preview-doc-title">${esc(targetDoc.title)}</div>
        <div class="preview-doc-summary">${esc(summaryText)}</div>
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
    const rect = hoverPreviewCard.getBoundingClientRect?.() || { width: 320, height: 160 };
    const width = rect.width || 320;
    const height = rect.height || 160;
    let x = e.clientX + 16;
    let y = e.clientY + 16;
    if (x + width + 8 > window.innerWidth) x = e.clientX - width - 16;
    if (y + height + 8 > window.innerHeight) y = e.clientY - height - 16;
    x = Math.max(8, Math.min(x, Math.max(8, window.innerWidth - width - 8)));
    y = Math.max(8, Math.min(y, Math.max(8, window.innerHeight - height - 8)));
    hoverPreviewCard.style.left = `${x}px`;
    hoverPreviewCard.style.top = `${y}px`;
  }

  function initSearch() {
    const searchInput = document.getElementById("searchInput");
    const searchDropdown = document.getElementById("searchDropdown");

    window.addEventListener("keydown", e => {
      const modalOpen = Boolean(document.querySelector?.("dialog[open], .admin-modal-backdrop:not(.hidden)"));
      if (e.key === "/" && !modalOpen && document.activeElement !== searchInput && !document.activeElement?.isContentEditable && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchInput.focus();
      } else if (e.key === "Escape" && !searchDropdown.classList.contains?.("hidden")) {
        e.preventDefault?.();
        const inDropdown = searchDropdown.contains?.(document.activeElement);
        searchDropdown.classList.add("hidden");
        if (inDropdown) searchInput.focus?.();
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
        window.CodeWikiTelemetry?.trackSearch?.("", 0);
        return;
      }

      const results = window.CodeWikiLearning.search(searchIndex, q).filter(({doc: d}) => isDocAccessible(d));
      window.CodeWikiTelemetry?.trackSearch?.(q, results.length);
      if (!results.length) {
        searchDropdown.innerHTML = '<div class="search-item">일치하는 문서가 없습니다.</div>';
      } else {
        const {escape:esc, highlight} = window.CodeWikiLearning;
        searchDropdown.innerHTML = results.map(({doc:d, snippet, sectionId, sectionTitle, sectionTab, sectionMode}) =>
          '<button type="button" class="search-item" data-search-doc="' + esc(d.id) + '"' +
          (sectionId ? ' data-search-section="' + esc(sectionId) + '"' : '') +
          (sectionTab ? ' data-search-tab="' + esc(sectionTab) + '"' : '') +
          (sectionMode ? ' data-search-mode="' + esc(sectionMode) + '"' : '') +
          '><span><span class="search-item-title">' + highlight(d.title,q) +
          '</span>' +
          (sectionTitle ? '<span class="search-item-section">↳ ' + highlight(sectionTitle,q) + '</span>' : '') +
          '<span class="search-item-sub">' + highlight(snippet,q) + '</span></span><span class="tcode-pill-badge">' + (d.isDailyLesson ? '수업일' : '주제') + '</span></button>'
        ).join('');
        searchDropdown.querySelectorAll('[data-search-doc]').forEach(item => item.addEventListener('click', () => {
          searchDropdown.classList.add('hidden');
          searchInput.value = '';
          navigateTo(item.dataset.searchDoc, item.dataset.searchTab || null, item.dataset.searchMode || null, item.dataset.searchSection || null);
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
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
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
      const isAdmin = window.CodeWikiAuth?.getCurrentUser?.()?.role === "admin" && !window.CodeWikiAuth?.isAdminPreviewMode?.();
      if (isAdmin && STUDENT_ONLY_HASHES.has(h)) {
        if (window.CodeWikiBoard) window.CodeWikiBoard.closeIfActive();
        window.CodeWikiAdminMembers?.openHome?.();
        return;
      }
      if (!isAdmin && window.CodeWikiAuth?.getCurrentUser?.()?.role === "student" && h.startsWith("#admin/")) {
        window.CodeWikiTelemetry?.trackSecurityProbe?.("admin_route_probe", h);
        if (window.CodeWikiBoard) window.CodeWikiBoard.closeIfActive();
        history.replaceState(null, "", "#doc/welcome-abap");
        renderDocument("welcome-abap");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const appHidden = appShell?.classList.contains('object-game-hidden') || appShell?.classList.contains('mentoring-hidden') || appShell?.classList.contains('foundation-hidden') || appShell?.classList.contains('study-hidden') || appShell?.classList.contains('members-hidden') || appShell?.classList.contains('board-mode-shell') || appShell?.classList.contains('map-hidden');
      if (h.startsWith("#doc/")) {
        const target = h.replace("#doc/", "");
        const parsed = parseDocHash(target);
        const resolved = parsed.docId;
        const targetDoc = window.WIKI_DOCS[resolved];
        const validMode = parsed.modeHint && targetDoc?.syntaxModes?.some(m => m.id === parsed.modeHint) ? parsed.modeHint : null;
        if (isAdmin && (!targetDoc || !isDocAccessible(targetDoc))) {
          if (window.CodeWikiBoard) window.CodeWikiBoard.closeIfActive();
          window.CodeWikiAdminMembers?.openHome?.();
          return;
        }
        if (!isAdmin && targetDoc && !isDocAccessible(targetDoc)) {
          if (window.CodeWikiBoard) window.CodeWikiBoard.closeIfActive();
          history.replaceState(null, "", "#doc/welcome-abap");
          renderDocument("welcome-abap");
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        if (targetDoc && validMode && resolved === currentDocId && !appHidden && typeof articleContainer._applyDocView === "function") {
          articleContainer._applyDocView(null, validMode);
          if (!consumePendingSection(resolved)) window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        if (targetDoc && (resolved !== currentDocId || appHidden || requested === resolved || requested === target || Boolean(parsed.redirectTab) || Boolean(validMode))) {
          if (window.CodeWikiBoard) window.CodeWikiBoard.closeIfActive();
          renderDocument(target);
          if (!consumePendingSection(resolved)) window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } else if (!h) {
        if (isAdmin) {
          if (window.CodeWikiBoard) window.CodeWikiBoard.closeIfActive();
          window.CodeWikiAdminMembers?.openHome?.();
          return;
        }
        if (window.CodeWikiBoard) window.CodeWikiBoard.closeIfActive();
        renderDocument(currentDocId);
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

    const THEME_STORAGE_KEY = "codewiki_theme_v1";
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const applyTheme = next => {
      const theme = next === "dark" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", theme);
      const label = theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환";
      if (themeToggleBtn) {
        themeToggleBtn.title = label;
        themeToggleBtn.setAttribute("aria-label", label);
      }
    };
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === "dark" || savedTheme === "light") applyTheme(savedTheme);
    } catch {}
    themeToggleBtn?.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      applyTheme(next);
      try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch {}
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
      const parsed = parseDocHash(target);
      if (window.WIKI_DOCS[parsed.docId]) currentDocId = target;
    }

    renderDocument(currentDocId);
    renderedAdminRole = window.CodeWikiAuth?.getCurrentUser?.()?.role === "admin";
  }

  init();
})();
