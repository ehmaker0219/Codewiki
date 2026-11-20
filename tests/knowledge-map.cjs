const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

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
    getBoundingClientRect: () => ({ width: 1200, height: 740, left: 0, top: 0 }),
    querySelector(sel) {
      if (sel === '.kmap-stage') return stage;
      if (sel === '.kmap-world') return world;
      if (sel === '#kmapBreadcrumb') return breadcrumb;
      if (sel === '#kmapFocusSlot') return focusSlot;
      if (sel === '#kmapHint') return hint;
      if (sel === '#kmapCrossLayer') return crossLayer;
      if (sel === '#kmapZoomLabel') return zoomLabel;
      return null;
    },
    querySelectorAll() { return []; }
  };
  return el;
}

const host = makeElement();
const shell = makeElement();
const trigger = makeElement();
const stage = makeElement();
const world = makeElement();
const breadcrumb = makeElement();
const focusSlot = makeElement();
const hint = makeElement();
const crossLayer = makeElement();
const zoomLabel = makeElement();

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

// 3. Clicking a cluster zooms into it; clicking a topic opens focus card with 1-line summary and doc CTA.
host.events.click({ target: { closest: sel => sel === '[data-kmap-cluster]' ? { dataset: { kmapCluster: 'basics' } } : null } });
assert.match(breadcrumb.innerHTML, /ABAP 기본기/);
assert.equal(focusSlot.innerHTML, '');

host.events.click({ target: { closest: sel => sel === '[data-kmap-topic]' ? { dataset: { kmapTopic: 'abap-types' } } : null } });
assert.match(focusSlot.innerHTML, /자료형과 초기값/);
assert.match(focusSlot.innerHTML, /문서 읽기/);
assert.match(crossLayer.innerHTML, /kmap-cross-edge/);

// 4. Escape steps up cleanly: Topic -> Cluster -> Overview.
winEvents.keydown({ key: 'Escape', preventDefault() {} });
assert.equal(focusSlot.innerHTML, '');
assert.match(breadcrumb.innerHTML, /ABAP 기본기/);
winEvents.keydown({ key: 'Escape', preventDefault() {} });
assert.doesNotMatch(breadcrumb.innerHTML, /ABAP 기본기/);

// 5. Clicking open-doc CTA calls CodeWikiApp.openDoc.
host.events.click({ target: { closest: sel => sel === '[data-kmap-open-doc]' ? { dataset: { kmapOpenDoc: 'abap-open-sql' } } : null } });
assert.deepEqual(openedDocs, ['abap-open-sql']);

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

console.log('PASS: knowledge map graph, zoom transitions, Escape navigation, doc CTA, progress sync and logout isolation');
