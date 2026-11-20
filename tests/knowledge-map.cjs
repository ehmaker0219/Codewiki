const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let viewport = { width: 1200, height: 740, left: 0, top: 0 };
let clusterElements = [], topicElements = [], flowElements = [], spokeElements = [];

function makeElement() {
  const classes = new Set();
  const el = {
    innerHTML: '',
    textContent: '',
    hidden: true,
    dataset: {},
    style: {},
    events: {},
    classList: {
      add: c => classes.add(c),
      remove: c => classes.delete(c),
      toggle: (c, force) => (force === undefined ? (classes.has(c) ? classes.delete(c) : classes.add(c)) : force ? classes.add(c) : classes.delete(c)),
      contains: c => classes.has(c)
    },
    addEventListener(name, fn) { this.events[name] = fn; },
    getBoundingClientRect: () => ({ ...viewport }),
    querySelector(sel) {
      if (sel === '.kmap-stage') return stage;
      if (sel === '.kmap-world') return world;
      if (sel === '.kmap-edges') return edges;
      if (sel === '#kmapBreadcrumb') return breadcrumb;
      if (sel === '#kmapFocusSlot') return focusSlot;
      if (sel === '#kmapHint') return hint;
      if (sel === '#kmapCrossLayer') return crossLayer;
      if (sel === '#kmapZoomLabel') return zoomLabel;
      return null;
    },
    querySelectorAll(sel) {
      return ({ '.kmap-cluster': clusterElements, '.kmap-topic': topicElements,
        '.kmap-flow-edge': flowElements, '.kmap-spoke-edge': spokeElements })[sel] || [];
    }
  };
  return el;
}

const host = makeElement();
const shell = makeElement();
const trigger = makeElement();
const stage = makeElement();
const world = makeElement();
const edges = makeElement();
const breadcrumb = makeElement();
const focusSlot = makeElement();
const hint = makeElement();
const crossLayer = makeElement();
const zoomLabel = makeElement();

// Keep actual rendered node identities instead of returning empty query results.
// This exercises camera projection and visual-state updates against the real markup.
function renderedElements(html, className) {
  const elements = [];
  for (const [, attributes] of html.matchAll(/<(?:button|path)\b([^>]+)>/g)) {
    const classes = attributes.match(/\bclass="([^"]*)"/)?.[1].split(/\s+/) || [];
    if (!classes.includes(className)) continue;
    const element = makeElement();
    classes.forEach(name => element.classList.add(name));
    for (const [, name, value] of attributes.matchAll(/\bdata-([a-z-]+)="([^"]*)"/g)) {
      element.dataset[name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    }
    elements.push(element);
  }
  return elements;
}
let hostHtml = '';
Object.defineProperty(host, 'innerHTML', {
  get: () => hostHtml,
  set(html) {
    hostHtml = html;
    clusterElements = renderedElements(html, 'kmap-cluster');
    topicElements = renderedElements(html, 'kmap-topic');
    flowElements = renderedElements(html, 'kmap-flow-edge');
    spokeElements = renderedElements(html, 'kmap-spoke-edge');
  }
});

const openedDocs = [];
const winEvents = {};
const location = { hash: '#doc/welcome-abap' };
const ctx = vm.createContext({
  window: {
    location,
    scrollTo() {},
    addEventListener(name, fn) { winEvents[name] = fn; },
    CodeWikiApp: { openDoc: id => openedDocs.push(id), getCurrentDocId: () => 'welcome-abap' },
    CodeWikiProgress: { getReadDocs: () => ['abap-basics', 'abap-types'] }
  },
  document: {
    activeElement: null,
    getElementById: id => ({ knowledgeMapPage: host, appShell: shell, openKnowledgeMapBtn: trigger }[id] || null),
    querySelectorAll: () => []
  },
  history: { replaceState(_a, _b, hash) { location.hash = hash; } },
  setTimeout,
  clearTimeout
});

for (const file of ['data', 'ui5-data', 'class-notes', 'learning-tools', 'knowledge-map']) {
  vm.runInContext(fs.readFileSync(`js/${file}.js`, 'utf8'), ctx);
}

const api = ctx.window.CodeWikiKnowledgeMap;
assert.ok(api && typeof api.buildGraph === 'function');

// 1. Every cluster and topic maps to real WIKI_DOCS entries with valid coordinates and links.
const graph = api.buildGraph(ctx.window.WIKI_DOCS, ['abap-basics', 'abap-types']);
assert.equal(graph.clusters.length, 6);
assert.ok(graph.topics.length >= 20);
assert.equal(graph.clusterById.get('basics').doneCount, 2);
assert.equal(graph.topicById.get('abap-basics').done, true);
assert.equal(graph.topicById.get('abap-open-sql').done, false);
assert.ok(graph.topicById.get('abap-open-sql').relatedIds.includes('abap-data-report'));
assert.ok(graph.stepOrder.includes('sap-architecture') && graph.stepOrder.includes('abap-open-sql'));
assert.ok(!graph.stepOrder.includes('erp-fi'), 'pending ERP stubs excluded from active learning path');

// 2. Unapproved users cannot access the map; approved users and admins can.
api.setUser({ id: 'pending-u', role: 'student', status: 'pending' });
location.hash = '#map';
winEvents.hashchange();
assert.equal(host.hidden, true);
assert.equal(trigger.hidden, true);

api.setUser({ id: 'student-1', role: 'student', status: 'approved' });
assert.equal(trigger.hidden, false);
assert.equal(host.hidden, false);
assert.equal(shell.classList.contains('map-hidden'), true);
assert.match(host.innerHTML, /ABAP 기본기/);
assert.match(breadcrumb.innerHTML, /전체 지도/);
assert.equal(clusterElements.length, graph.clusters.length);
assert.equal(topicElements.length, graph.topics.length);

function edgeCamera() {
  const match = edges.style.transform?.match(/^translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)$/);
  assert.ok(match, 'vector edges have a camera transform');
  const [tx, ty, zoom] = match.slice(1).map(Number);
  return { tx, ty, zoom };
}
function assertProjectedNodes() {
  const { tx, ty, zoom } = edgeCamera();
  for (const [elements, nodes, key] of [[clusterElements, graph.clusterById, 'kmapCluster'], [topicElements, graph.topicById, 'kmapTopic']]) {
    for (const element of elements) {
      const node = nodes.get(element.dataset[key]);
      // Edges round camera values and nodes round pixels; allow <1px discrepancy.
      assert.ok(Math.abs(parseFloat(element.style.left) - (tx + node.x * zoom)) < 1, node.id + ' x aligns with its edge');
      assert.ok(Math.abs(parseFloat(element.style.top) - (ty + node.y * zoom)) < 1, node.id + ' y aligns with its edge');
      assert.doesNotMatch(element.style.transform || '', /scale/, 'node labels are not scaled by JavaScript');
    }
  }
  assert.doesNotMatch(world.style.transform || '', /scale/, 'label parent retains native text size');
}
function assertOverviewBounds() {
  for (const element of clusterElements) {
    const x = parseFloat(element.style.left), y = parseFloat(element.style.top);
    const radius = parseFloat(element.style.width) / 2;
    assert.ok(x - radius >= 0 && x + radius <= viewport.width, element.dataset.kmapCluster + ' fits horizontally');
    assert.ok(y - radius >= 0 && y + radius <= viewport.height, element.dataset.kmapCluster + ' fits vertically');
    for (const other of clusterElements) {
      if (other === element) continue;
      const distance = Math.hypot(x - parseFloat(other.style.left), y - parseFloat(other.style.top));
      assert.ok(distance >= radius + parseFloat(other.style.width) / 2, 'overview circles do not overlap');
    }
  }
}
assertProjectedNodes();
assertOverviewBounds();
assert.equal(stage.classList.contains('is-compact'), false);
const mapCss = fs.readFileSync('css/knowledge-map.css', 'utf8');
assert.doesNotMatch(mapCss.match(/\.kmap-world\s*\{([^}]+)\}/)?.[1] || '', /\b(?:transform|will-change)\s*:/, 'CSS does not scale or rasterize the shared text layer');

// 3. Clicking a cluster zooms into it; clicking a topic opens focus card with 1-line summary and doc CTA.
host.events.click({ target: { closest: sel => sel === '[data-kmap-cluster]' ? { dataset: { kmapCluster: 'basics' } } : null } });
assert.match(breadcrumb.innerHTML, /ABAP 기본기/);
assert.equal(focusSlot.innerHTML, '');
assertProjectedNodes();
assert.equal(clusterElements.find(el => el.dataset.kmapCluster === 'basics').classList.contains('is-open'), true);
const visibleTopics = topicElements.filter(el => el.classList.contains('is-visible'));
assert.equal(visibleTopics.length, graph.clusterById.get('basics').topics.length);
assert.ok(visibleTopics.every(el => el.dataset.cluster === 'basics'));

host.events.click({ target: { closest: sel => sel === '[data-kmap-topic]' ? { dataset: { kmapTopic: 'abap-types' } } : null } });
assert.match(focusSlot.innerHTML, /자료형과 초기값/);
assert.match(focusSlot.innerHTML, /문서 읽기/);
assert.match(crossLayer.innerHTML, /kmap-cross-edge/);
assertProjectedNodes();

// 4. Escape steps up cleanly: Topic -> Cluster -> Overview.
winEvents.keydown({ key: 'Escape', preventDefault() {} });
assert.equal(focusSlot.innerHTML, '');
assert.match(breadcrumb.innerHTML, /ABAP 기본기/);
winEvents.keydown({ key: 'Escape', preventDefault() {} });
assert.doesNotMatch(breadcrumb.innerHTML, /ABAP 기본기/);

// 5. Clicking open-doc CTA calls CodeWikiApp.openDoc.
host.events.click({ target: { closest: sel => sel === '[data-kmap-open-doc]' ? { dataset: { kmapOpenDoc: 'abap-open-sql' } } : null } });
assert.deepEqual(openedDocs, ['abap-open-sql']);

// Zoom and drag move projected nodes and vector edges together without shrinking labels.
const beforeZoom = edgeCamera(), pointer = { x: 440, y: 280 };
stage.events.wheel({ deltaY: -1, clientX: pointer.x, clientY: pointer.y, preventDefault() {} });
const afterZoom = edgeCamera();
assert.ok(afterZoom.zoom > beforeZoom.zoom);
assert.ok(Math.abs((pointer.x - beforeZoom.tx) / beforeZoom.zoom - (pointer.x - afterZoom.tx) / afterZoom.zoom) < 1, 'wheel zoom preserves cursor world x');
assert.ok(Math.abs((pointer.y - beforeZoom.ty) / beforeZoom.zoom - (pointer.y - afterZoom.ty) / afterZoom.zoom) < 1, 'wheel zoom preserves cursor world y');
assertProjectedNodes();
const beforeDrag = { x: parseFloat(clusterElements[0].style.left), y: parseFloat(clusterElements[0].style.top) };
stage.events.pointerdown({ button: 0, pointerId: 1, clientX: 450, clientY: 300, target: { closest: () => null } });
stage.events.pointermove({ pointerId: 1, clientX: 495, clientY: 273 });
assert.equal(parseFloat(clusterElements[0].style.left) - beforeDrag.x, 45);
assert.equal(parseFloat(clusterElements[0].style.top) - beforeDrag.y, -27);
assertProjectedNodes();
stage.events.pointerup({ pointerId: 1 });

// Small screens still fit all six readable overview nodes, including lower-row circles.
viewport = { width: 320, height: 600, left: 0, top: 0 };
winEvents.keydown({ key: 'Escape', preventDefault() {} });
assert.equal(stage.classList.contains('is-compact'), true);
assertProjectedNodes();
assertOverviewBounds();
const minimumZoom = edgeCamera().zoom;
stage.events.wheel({ deltaY: 1, clientX: 160, clientY: 300, preventDefault() {} });
assert.equal(edgeCamera().zoom, minimumZoom, 'zoom-out stops at a readable full-map view');

// 6. Logout clears map DOM and hides trigger/host.
api.setUser(null);
assert.equal(host.hidden, true);
assert.equal(host.innerHTML, '');
assert.equal(trigger.hidden, true);
assert.equal(shell.classList.contains('map-hidden'), false);

// 7. Untrusted HTML in doc metadata is escaped.
const unsafeDocs = { 'abap-basics': { id: 'abap-basics', title: '<img src=x>', summary: '<script>bad</script>', sections: [{ title: '본문', blocks: [{ type: 'text', paragraphs: ['ok'] }] }] } };
const escapedGraph = api.buildGraph(unsafeDocs, []);
assert.equal(escapedGraph.topicById.get('abap-basics').summary, 'bad');

console.log('PASS: knowledge map graph, native-size node projection, compact fit/non-overlap, cursor zoom/drag, Escape navigation, doc CTA and logout isolation');
