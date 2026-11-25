/* Prezi-style minimalist zoomable Knowledge Map for ABAP concepts. */
(() => {
  const WORLD_W = 1800;
  const WORLD_H = 1200;

  const CLUSTER_SPECS = [
    {
      id: 'system', step: '01', title: '시스템과 개발',
      subtitle: 'SAP 구조 · Package · 전송',
      x: 330, y: 290, angles: [-145, -35, 90],
      docs: ['sap-architecture', 'abap-development', 'abap-program-types']
    },
    {
      id: 'basics', step: '02', title: 'ABAP 기본기',
      subtitle: '문법 · 자료형 · 반복문 · 디버깅',
      x: 900, y: 260, angles: [-145, -35, 35, 145],
      docs: ['abap-basics', 'abap-types', 'abap-loops', 'abap-debug-messages']
    },
    {
      id: 'modular', step: '03', title: '모듈화와 객체',
      subtitle: 'FORM · 함수 · BAPI · 클래스',
      x: 1470, y: 290, angles: [-145, -35, 90],
      docs: ['abap-modularization', 'abap-bapi', 'abap-objects']
    },
    {
      id: 'data', step: '04', title: '데이터 처리',
      subtitle: '내부 테이블 · Report · Open SQL · DDIC',
      x: 900, y: 930, angles: [-145, -35, 90],
      docs: ['abap-data-report', 'abap-open-sql', 'abap-dictionary']
    },
    {
      id: 'reference', step: '05', title: '실전 참고',
      subtitle: 'T-Code · 단축키 · 문법 모음',
      x: 330, y: 910, angles: [-145, -35, 90],
      docs: ['sap-tcode-reference', 'sap-gui-shortcuts', 'abap-useful-syntax']
    },
    {
      id: 'erp', step: '06', title: 'ERP 업무 모듈',
      subtitle: 'FI · CO · MM · SD · PP',
      x: 1470, y: 910, upcoming: true, angles: [-144, -72, 0, 72, 144],
      docs: ['erp-fi', 'erp-co', 'erp-mm', 'erp-sd', 'erp-pp']
    }
  ];

  const CLUSTER_FLOWS = [
    ['system', 'basics', false],
    ['basics', 'modular', false],
    ['modular', 'data', false],
    ['basics', 'data', true],
    ['data', 'erp', true],
    ['system', 'reference', true],
    ['reference', 'data', true]
  ];

  const escapeFallback = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const esc = v => (window.CodeWikiLearning?.escape || escapeFallback)(v);
  const plainText = v => (window.CodeWikiLearning?.plain
    ? window.CodeWikiLearning.plain(v)
    : String(v ?? '').replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => label || id).replace(/<[^>]*>/g, '').trim());

  function isPendingDoc(doc) {
    if (!doc) return true;
    return !(doc.sections || []).some(section =>
      !['관련 문서', '참고', '참고 자료', '필기와 참고 자료'].includes(section.title) &&
      (section.blocks || []).length > 0
    );
  }

  function extractDocLinks(doc) {
    const ids = new Set();
    const raw = JSON.stringify(doc?.sections || []);
    for (const match of raw.matchAll(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g)) {
      if (match[1] !== doc.id) ids.add(match[1]);
    }
    return [...ids];
  }

  function buildGraph(docsMap = window.WIKI_DOCS || {}, readDocs = []) {
    const readSet = new Set(readDocs || []);
    const clusters = [];
    const clusterById = new Map();
    const topics = [];
    const topicById = new Map();

    for (const spec of CLUSTER_SPECS) {
      const presentIds = spec.docs.filter(id => Boolean(docsMap[id]));
      const radius = presentIds.length >= 5 ? 174 : 162;
      const children = presentIds.map((docId, idx) => {
        const doc = docsMap[docId];
        const deg = spec.angles[idx] ?? (-90 + (360 / Math.max(1, presentIds.length)) * idx);
        const rad = (deg * Math.PI) / 180;
        const pending = isPendingDoc(doc);
        const summary = plainText(doc.summary || doc.subtitle || '');
        const node = {
          id: doc.id,
          clusterId: spec.id,
          stepNum: doc.stepNum || '',
          title: doc.title,
          summary: summary || '문서 내용을 준비하고 있습니다.',
          pending,
          done: readSet.has(doc.id),
          x: Math.round(spec.x + Math.cos(rad) * radius),
          y: Math.round(spec.y + Math.sin(rad) * radius),
          relatedIds: []
        };
        topics.push(node);
        topicById.set(node.id, node);
        return node;
      });
      const readyCount = children.filter(c => !c.pending).length;
      const doneCount = children.filter(c => c.done).length;
      const cluster = {
        ...spec,
        upcoming: Boolean(spec.upcoming || readyCount === 0),
        readyCount,
        doneCount,
        topics: children
      };
      clusters.push(cluster);
      clusterById.set(cluster.id, cluster);
    }

    for (const node of topics) {
      const doc = docsMap[node.id];
      const linked = extractDocLinks(doc).filter(id => id !== node.id && topicById.has(id));
      node.relatedIds = linked.slice(0, 4);
    }

    const flows = CLUSTER_FLOWS
      .filter(([a, b]) => clusterById.has(a) && clusterById.has(b))
      .map(([from, to, secondary]) => ({ from, to, secondary }));

    const stepOrder = topics.filter(t => !t.pending).map(t => t.id);
    return { clusters, clusterById, topics, topicById, flows, stepOrder };
  }

  function curvePath(x1, y1, x2, y2, bend = 0.14) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const cx = mx - dy * bend;
    const cy = my + dx * bend;
    return `M ${x1} ${y1} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2} ${y2}`;
  }

  const host = document.getElementById('knowledgeMapPage');
  const shell = document.getElementById('appShell');
  const trigger = document.getElementById('openKnowledgeMapBtn');

  let allowed = false;
  let graph = null;
  let mounted = false;
  let selectedClusterId = null;
  let selectedTopicId = null;
  let pendingTopicId = null;
  let camera = { cx: WORLD_W / 2, cy: WORLD_H / 2, zoom: 0.72 };
  let baseFitZoom = 0.72;
  let dragState = null;
  let resizeObserver = null;

  const visible = () => allowed && window.location.hash === '#map';

  function viewportSize() {
    const stage = host?.querySelector('.kmap-stage');
    if (!stage || typeof stage.getBoundingClientRect !== 'function') return { vw: 1120, vh: 680 };
    const rect = stage.getBoundingClientRect();
    return { vw: Math.max(320, rect.width || 1120), vh: Math.max(320, rect.height || 680) };
  }

  function computeFitZoom() {
    const { vw, vh } = viewportSize();
    return Math.max(0.12, Math.min(1.15, Math.min((vw - 56) / 1620, (vh - 110) / 1080)));
  }

  function computeClusterZoom() {
    const { vw, vh } = viewportSize();
    return Math.max(0.75, Math.min(1.65, Math.min((vw - 72) / 560, (vh - 150) / 500)));
  }

  function applyCamera(instant = false) {
    const world = host?.querySelector('.kmap-world');
    if (!world) return;
    const { vw, vh } = viewportSize();
    const tx = vw / 2 - camera.cx * camera.zoom;
    const ty = vh / 2 - camera.cy * camera.zoom;
    world.classList.toggle('is-instant', instant);
    host.querySelector('.kmap-stage')?.classList.toggle('is-compact', vw < 600);
    // Scale only vector edges. Project nodes into screen coordinates so labels
    // retain their native font size instead of rasterizing a scaled text layer.
    const edges = host.querySelector('.kmap-edges');
    if (edges) edges.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${camera.zoom.toFixed(4)})`;
    const place = (element, node) => {
      element.style.left = `${Math.round(tx + node.x * camera.zoom)}px`;
      element.style.top = `${Math.round(ty + node.y * camera.zoom)}px`;
    };
    host.querySelectorAll('.kmap-cluster').forEach(element => {
      const node = graph?.clusterById.get(element.dataset.kmapCluster);
      if (!node) return;
      place(element, node);
      const open = node.id === selectedClusterId;
      const size = open && vw < 600 ? 104
        : Math.min(244, Math.max(open ? 104 : vw < 600 ? 92 : 148, (open ? 146 : 244) * camera.zoom));
      element.style.width = element.style.height = `${Math.round(size / 2) * 2}px`;
    });
    host.querySelectorAll('.kmap-topic').forEach(element => {
      const node = graph?.topicById.get(element.dataset.kmapTopic);
      if (node) place(element, node);
    });
    const zoomLabel = host.querySelector('#kmapZoomLabel');
    if (zoomLabel) {
      const pct = Math.round((camera.zoom / Math.max(0.1, baseFitZoom)) * 100);
      zoomLabel.textContent = `${pct}%`;
    }
  }

  function focusOverview(instant = false) {
    selectedClusterId = null;
    selectedTopicId = null;
    baseFitZoom = computeFitZoom();
    camera = { cx: WORLD_W / 2, cy: WORLD_H / 2, zoom: baseFitZoom };
    syncVisualState();
    applyCamera(instant);
  }

  function focusCluster(clusterId, instant = false) {
    const cluster = graph?.clusterById.get(clusterId);
    if (!cluster) return focusOverview(instant);
    selectedClusterId = cluster.id;
    selectedTopicId = null;
    baseFitZoom = computeFitZoom();
    camera = { cx: cluster.x, cy: cluster.y, zoom: computeClusterZoom() };
    syncVisualState();
    applyCamera(instant);
  }

  function focusTopic(topicId, instant = false) {
    const topic = graph?.topicById.get(topicId);
    if (!topic) return;
    selectedClusterId = topic.clusterId;
    selectedTopicId = topic.id;
    baseFitZoom = computeFitZoom();
    const topicZoom = Math.min(2.15, Math.max(1.25, computeClusterZoom() * 1.24));
    // Shift camera slightly downward so the glowing node sits comfortably above the bottom focus card.
    camera = { cx: topic.x, cy: topic.y + 72, zoom: topicZoom };
    syncVisualState();
    applyCamera(instant);
  }

  function stepPath(delta) {
    if (!graph?.stepOrder.length) return;
    const list = graph.stepOrder;
    if (!selectedTopicId) {
      focusTopic(delta > 0 ? list[0] : list[list.length - 1]);
      return;
    }
    const idx = list.indexOf(selectedTopicId);
    if (idx < 0) {
      focusTopic(list[0]);
      return;
    }
    const nextIdx = (idx + delta + list.length) % list.length;
    focusTopic(list[nextIdx]);
  }

  function zoomBy(factor, clientX, clientY) {
    const stage = host?.querySelector('.kmap-stage');
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const vw = rect.width || 1120;
    const vh = rect.height || 680;
    const px = clientX !== undefined ? clientX - rect.left : vw / 2;
    const py = clientY !== undefined ? clientY - rect.top : vh / 2;
    const minZoom = baseFitZoom;
    const maxZoom = 2.5;
    const nextZoom = Math.max(minZoom, Math.min(maxZoom, camera.zoom * factor));
    if (Math.abs(nextZoom - camera.zoom) < 0.0005) return;
    // Keep the world coordinate under the cursor pinned while zooming.
    const worldX = camera.cx + (px - vw / 2) / camera.zoom;
    const worldY = camera.cy + (py - vh / 2) / camera.zoom;
    camera.zoom = nextZoom;
    camera.cx = worldX - (px - vw / 2) / nextZoom;
    camera.cy = worldY - (py - vh / 2) / nextZoom;
    applyCamera(true);
  }

  function renderBreadcrumb() {
    const nav = host?.querySelector('#kmapBreadcrumb');
    if (!nav || !graph) return;
    const cluster = selectedClusterId ? graph.clusterById.get(selectedClusterId) : null;
    const topic = selectedTopicId ? graph.topicById.get(selectedTopicId) : null;
    const parts = [
      `<button type="button" class="kmap-crumb${!cluster ? ' is-current' : ''}" data-kmap-action="overview">전체 지도</button>`
    ];
    if (cluster) {
      parts.push('<span class="kmap-crumb-sep" aria-hidden="true">›</span>');
      parts.push(`<button type="button" class="kmap-crumb${!topic ? ' is-current' : ''}" data-kmap-cluster="${esc(cluster.id)}">${esc(cluster.title)}</button>`);
    }
    if (topic) {
      parts.push('<span class="kmap-crumb-sep" aria-hidden="true">›</span>');
      parts.push(`<span class="kmap-crumb is-current">${esc(topic.title)}</span>`);
    }
    nav.innerHTML = parts.join('');
  }

  function renderFocusCard() {
    const slot = host?.querySelector('#kmapFocusSlot');
    const hint = host?.querySelector('#kmapHint');
    if (!slot || !graph) return;
    const topic = selectedTopicId ? graph.topicById.get(selectedTopicId) : null;
    if (!topic) {
      slot.innerHTML = '';
      if (hint) {
        hint.hidden = false;
        hint.textContent = selectedClusterId
          ? '세부 개념을 클릭해 줌인 · 배경 클릭 또는 Esc로 전체 보기'
          : '주제를 클릭해 줌인 · 드래그 이동 · 휠 확대/축소';
      }
      return;
    }
    if (hint) hint.hidden = true;
    const cluster = graph.clusterById.get(topic.clusterId);
    const relatedHtml = topic.relatedIds.length
      ? `<div class="kmap-focus-related"><span class="kmap-focus-related-label">연결된 개념</span>${topic.relatedIds.map(id => {
          const target = graph.topicById.get(id);
          return target ? `<button type="button" class="kmap-related-pill" data-kmap-topic="${esc(target.id)}">${esc(target.title)}</button>` : '';
        }).join('')}</div>`
      : '';
    slot.innerHTML = `
      <aside class="kmap-focus-card" role="region" aria-label="${esc(topic.title)} 요약">
        <div class="kmap-focus-top">
          <div>
            <div class="kmap-focus-eyebrow">
              <span>${esc(cluster?.step || '')} · ${esc(cluster?.title || '')}</span>
              ${topic.done ? '<span class="kmap-focus-done">✓ 완료됨</span>' : topic.pending ? '<span class="kmap-topic-pending">준비 중</span>' : ''}
            </div>
            <h2 class="kmap-focus-title">${esc(topic.title)}</h2>
          </div>
          <button type="button" class="icon-btn" data-kmap-action="up" aria-label="줌아웃">✕</button>
        </div>
        <p class="kmap-focus-summary">${esc(topic.summary)}</p>
        ${relatedHtml}
        <div class="kmap-focus-actions">
          <button type="button" class="kmap-focus-back" data-kmap-action="up">← ${esc(cluster?.title || '뒤로')}</button>
          <button type="button" class="kmap-focus-open" data-kmap-open-doc="${esc(topic.id)}">문서 읽기 →</button>
        </div>
      </aside>
    `;
  }

  function renderCrossEdges() {
    const layer = host?.querySelector('#kmapCrossLayer');
    if (!layer || !graph) return;
    const topic = selectedTopicId ? graph.topicById.get(selectedTopicId) : null;
    if (!topic || !topic.relatedIds.length) {
      layer.innerHTML = '';
      return;
    }
    layer.innerHTML = topic.relatedIds.map(targetId => {
      const target = graph.topicById.get(targetId);
      if (!target) return '';
      return `<path class="kmap-cross-edge" d="${curvePath(topic.x, topic.y, target.x, target.y, 0.16)}"/>`;
    }).join('');
  }

  function syncVisualState() {
    if (!host || !graph) return;
    const topic = selectedTopicId ? graph.topicById.get(selectedTopicId) : null;
    const relatedSet = new Set(topic ? topic.relatedIds : []);

    host.querySelectorAll('.kmap-flow-edge').forEach(edge => {
      edge.classList.toggle('is-dim', Boolean(selectedClusterId));
    });

    host.querySelectorAll('.kmap-spoke-edge').forEach(edge => {
      edge.classList.toggle('is-hidden', edge.dataset.cluster !== selectedClusterId);
    });

    host.querySelectorAll('.kmap-cluster').forEach(el => {
      const cid = el.dataset.kmapCluster;
      const isOpen = cid === selectedClusterId;
      el.classList.toggle('is-open', isOpen);
      el.classList.toggle('is-dim', Boolean(selectedClusterId) && !isOpen);
    });

    host.querySelectorAll('.kmap-topic').forEach(el => {
      const tid = el.dataset.kmapTopic;
      const cid = el.dataset.cluster;
      const inOpenCluster = cid === selectedClusterId;
      const isSelected = tid === selectedTopicId;
      const isRelated = Boolean(selectedTopicId) && relatedSet.has(tid);
      el.classList.toggle('is-visible', inOpenCluster);
      el.classList.toggle('is-selected', isSelected);
      el.classList.toggle('is-related', !inOpenCluster && isRelated);
      el.classList.toggle('is-dim', Boolean(selectedTopicId) && inOpenCluster && !isSelected && !isRelated);
      el.tabIndex = inOpenCluster ? 0 : -1;
      el.setAttribute?.('aria-hidden', String(!inOpenCluster));
    });

    renderCrossEdges();
    renderBreadcrumb();
    renderFocusCard();
  }

  function renderCanvas() {
    if (!host || !graph) return;
    const flowPaths = graph.flows.map(({ from, to, secondary }) => {
      const a = graph.clusterById.get(from);
      const b = graph.clusterById.get(to);
      return `<path class="kmap-flow-edge${secondary ? ' is-secondary' : ''}" d="${curvePath(a.x, a.y, b.x, b.y, secondary ? 0.12 : 0.08)}"/>`;
    }).join('');

    const spokePaths = graph.topics.map(t => {
      const c = graph.clusterById.get(t.clusterId);
      return `<path class="kmap-spoke-edge is-hidden" data-cluster="${esc(t.clusterId)}" d="${curvePath(c.x, c.y, t.x, t.y, 0.08)}"/>`;
    }).join('');

    const clusterButtons = graph.clusters.map(c => {
      const metaText = c.upcoming
        ? '준비 중'
        : c.doneCount > 0
          ? `${c.doneCount}/${c.topics.length} 완료`
          : `${c.topics.length}개 주제`;
      const isAllDone = !c.upcoming && c.topics.length > 0 && c.doneCount === c.topics.length;
      return `
        <button type="button" class="kmap-cluster${c.upcoming ? ' is-upcoming' : ''}" data-kmap-cluster="${esc(c.id)}" style="left:${c.x}px;top:${c.y}px;">
          <span class="kmap-cluster-index">${esc(c.step)}</span>
          <span class="kmap-cluster-title">${esc(c.title)}</span>
          <span class="kmap-cluster-meta${isAllDone ? ' is-complete' : ''}">${esc(metaText)}</span>
        </button>
      `;
    }).join('');

    const topicButtons = graph.topics.map(t => `
      <button type="button" class="kmap-topic" tabindex="-1" aria-hidden="true" data-kmap-topic="${esc(t.id)}" data-cluster="${esc(t.clusterId)}" style="left:${t.x}px;top:${t.y}px;">
        <span class="kmap-topic-head">
          ${t.stepNum ? `<span class="kmap-topic-step">${esc(t.stepNum)}</span>` : '<span class="kmap-topic-step">참고</span>'}
          ${t.done ? '<span class="kmap-topic-check" title="학습 완료">✓</span>' : t.pending ? '<span class="kmap-topic-pending">준비 중</span>' : ''}
        </span>
        <span class="kmap-topic-title">${esc(t.title)}</span>
      </button>
    `).join('');

    host.innerHTML = `
      <div class="kmap-stage" role="application" aria-label="ABAP 개념 지도 캔버스">
        <div class="kmap-hud-top">
          <nav id="kmapBreadcrumb" class="kmap-breadcrumb" aria-label="지도 탐색 경로"></nav>
          <div class="kmap-controls" role="group" aria-label="지도 탐색 제어">
            <button type="button" class="kmap-ctrl-btn" data-kmap-action="prev" title="이전 주제 (←)" aria-label="이전 주제">←</button>
            <button type="button" class="kmap-ctrl-btn" data-kmap-action="next" title="다음 주제 (→)" aria-label="다음 주제">→</button>
            <span class="kmap-ctrl-divider" aria-hidden="true"></span>
            <button type="button" class="kmap-ctrl-btn" data-kmap-action="zoom-out" title="축소" aria-label="축소">−</button>
            <span id="kmapZoomLabel" class="kmap-zoom-label">100%</span>
            <button type="button" class="kmap-ctrl-btn" data-kmap-action="zoom-in" title="확대" aria-label="확대">+</button>
            <span class="kmap-ctrl-divider" aria-hidden="true"></span>
            <button type="button" class="kmap-ctrl-btn" data-kmap-action="overview" title="전체 지도 보기 (Esc)">전체 보기</button>
          </div>
        </div>
        <div class="kmap-world">
          <svg class="kmap-edges" viewBox="0 0 ${WORLD_W} ${WORLD_H}" aria-hidden="true">
            <g>${flowPaths}</g>
            <g>${spokePaths}</g>
            <g id="kmapCrossLayer"></g>
          </svg>
          ${clusterButtons}
          ${topicButtons}
        </div>
        <div id="kmapFocusSlot"></div>
        <div id="kmapHint" class="kmap-hint"></div>
      </div>
    `;
    dragState = null;
    bindStageInteractions();
    syncVisualState();
  }

  function bindStageInteractions() {
    const stage = host?.querySelector('.kmap-stage');
    if (!stage) return;

    stage.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.14 : 1 / 1.14;
      zoomBy(factor, e.clientX, e.clientY);
    }, { passive: false });

    stage.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (e.target.closest('.kmap-hud-top, .kmap-focus-card')) return;
      dragState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originCx: camera.cx,
        originCy: camera.cy,
        moved: false,
        onBackground: !e.target.closest('button')
      };
    });

    stage.addEventListener('pointermove', e => {
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (!dragState.moved && Math.hypot(dx, dy) > 6) {
        dragState.moved = true;
        stage.classList.add('is-dragging');
        stage.setPointerCapture?.(e.pointerId);
      }
      if (dragState.moved) {
        camera.cx = dragState.originCx - dx / camera.zoom;
        camera.cy = dragState.originCy - dy / camera.zoom;
        applyCamera(true);
      }
    });

    const endDrag = e => {
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      const { moved, onBackground } = dragState;
      dragState = null;
      stage.classList.remove('is-dragging');
      if (moved) {
        stage.dataset.justDragged = '1';
        setTimeout(() => { delete stage.dataset.justDragged; }, 60);
      } else if (onBackground) {
        stepUp();
      }
    };
    const cancelDrag = e => {
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      dragState = null;
      stage.classList.remove('is-dragging');
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', cancelDrag);
    stage.addEventListener('dblclick', e => {
      if (!e.target.closest('button, .kmap-hud-top, .kmap-focus-card')) focusOverview();
    });

    resizeObserver?.disconnect();
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => {
        if (!visible()) return;
        const prevFit = baseFitZoom;
        baseFitZoom = computeFitZoom();
        if (Math.abs(camera.zoom - prevFit) < 0.005) camera.zoom = baseFitZoom;
        else camera.zoom = Math.max(baseFitZoom, camera.zoom);
        applyCamera(true);
      });
      resizeObserver.observe(stage);
    }
  }

  function stepUp() {
    if (selectedTopicId && selectedClusterId) focusCluster(selectedClusterId);
    else focusOverview();
  }

  let renderedReadKey = null;
  function readDocsKey(readDocs) {
    return [...(readDocs || [])].sort().join(',');
  }

  function refreshGraph(preserveSelection = true) {
    const readDocs = window.CodeWikiProgress?.getReadDocs?.() || [];
    renderedReadKey = readDocsKey(readDocs);
    graph = buildGraph(window.WIKI_DOCS || {}, readDocs);
    if (!visible()) return;
    renderCanvas();
    if (preserveSelection && selectedTopicId && graph.topicById.has(selectedTopicId)) {
      focusTopic(selectedTopicId, true);
    } else if (preserveSelection && selectedClusterId && graph.clusterById.has(selectedClusterId)) {
      focusCluster(selectedClusterId, true);
    } else {
      focusOverview(true);
    }
  }

  function route() {
    const open = visible();
    if (host) host.hidden = !open;
    shell?.classList.toggle('map-hidden', open);
    trigger?.classList.toggle('active', open);
    if (!open) {
      resizeObserver?.disconnect();
      return;
    }
    window.CodeWikiBoard?.closeIfActive?.();
    window.CodeWikiAdminMembers?.leave?.();
    window.CodeWikiStudy?.leave?.();
    window.CodeWikiMentoring?.leave?.();
    window.CodeWikiObjectGame?.leave?.();
    document.querySelectorAll('#sbHomeItem.active, #sbScheduleItem.active, #sbThinkingFlowItem.active, #sbProgramCatalogItem.active, .nav-doc-link.active').forEach(el => el.classList.remove('active'));
    document.getElementById('quizModeBtn')?.classList.add('hidden');
    if (!mounted) {
      mounted = true;
      refreshGraph(false);
    } else {
      refreshGraph(true);
    }
    // A topic requested before the map was visible is focused once it is laid out.
    if (pendingTopicId) {
      const topicId = pendingTopicId;
      pendingTopicId = null;
      focusTopic(topicId);
    }
    window.scrollTo?.({ top: 0, behavior: 'instant' });
  }

  function setUser(user) {
    const nextAllowed = Boolean(user && user.role === 'student' && user.status === 'approved');
    if (!nextAllowed) {
      allowed = false;
      mounted = false;
      selectedClusterId = null;
      selectedTopicId = null;
      pendingTopicId = null;
      dragState = null;
      renderedReadKey = null;
      resizeObserver?.disconnect();
      if (host) {
        host.innerHTML = '';
        host.hidden = true;
      }
      shell?.classList.remove('map-hidden');
      if (trigger) {
        trigger.hidden = true;
        trigger.classList.remove('active');
      }
      return;
    }
    allowed = true;
    if (trigger) trigger.hidden = false;
    route();
  }

  host?.addEventListener('click', e => {
    const stage = host.querySelector('.kmap-stage');
    if (stage?.dataset.justDragged) return;
    const openDocBtn = e.target.closest('[data-kmap-open-doc]');
    if (openDocBtn) {
      const docId = openDocBtn.dataset.kmapOpenDoc;
      if (docId) window.CodeWikiApp?.openDoc?.(docId);
      return;
    }
    const topicBtn = e.target.closest('[data-kmap-topic]');
    if (topicBtn) {
      focusTopic(topicBtn.dataset.kmapTopic);
      return;
    }
    const clusterBtn = e.target.closest('[data-kmap-cluster]');
    if (clusterBtn) {
      focusCluster(clusterBtn.dataset.kmapCluster);
      return;
    }
    const actionBtn = e.target.closest('[data-kmap-action]');
    if (actionBtn) {
      const action = actionBtn.dataset.kmapAction;
      if (action === 'overview') focusOverview();
      else if (action === 'up') stepUp();
      else if (action === 'prev') stepPath(-1);
      else if (action === 'next') stepPath(1);
      else if (action === 'zoom-in') zoomBy(1.22);
      else if (action === 'zoom-out') zoomBy(1 / 1.22);
    }
  });

  window.addEventListener('keydown', e => {
    if (e.defaultPrevented || !visible()) return;
    if (document.querySelector?.('dialog[open], .admin-modal-backdrop:not(.hidden)')) return;
    const active = document.activeElement;
    if (active && (active.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName))) return;
    const searchOpen = document.getElementById('searchDropdown') && !document.getElementById('searchDropdown').classList.contains('hidden');
    if (searchOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      stepUp();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      stepPath(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stepPath(-1);
    }
  });

  trigger?.addEventListener('click', e => {
    if (!allowed) { e.preventDefault(); return; }
    if (window.location.hash === '#map') {
      e.preventDefault();
      focusOverview();
    }
  });

  window.addEventListener('hashchange', route);
  window.addEventListener('cw-progress-change', () => {
    if (!visible() || !mounted) return;
    const nextKey = readDocsKey(window.CodeWikiProgress?.getReadDocs?.() || []);
    if (nextKey !== renderedReadKey) refreshGraph(true);
  });

  window.CodeWikiKnowledgeMap = {
    buildGraph,
    setUser,
    open(topicId) {
      if (!allowed) return;
      if (window.location.hash !== '#map') {
        pendingTopicId = topicId || null;
        window.location.hash = '#map';
        return;
      }
      route();
      if (topicId) focusTopic(topicId);
    },
    leave() {
      if (window.location.hash === '#map') {
        history.replaceState(null, '', '#doc/' + (window.CodeWikiApp?.getCurrentDocId() || 'welcome-abap'));
      }
      route();
    }
  };

  setUser(window.CodeWikiAuth?.getCurrentUser?.() || null);
})();
