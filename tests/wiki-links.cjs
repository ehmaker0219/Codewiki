const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, sessionStorage: { getItem: () => null } });
vm.runInContext(fs.readFileSync('js/data.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/ui5-data.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/class-notes.js', 'utf8'), context);
for (const name of ['lesson-days','textbook','example-notes','learning-tools']) vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),context);
// Keep backlink fixtures isolated from explicit related-document links in real pages.
const backlinkFixtures = {
  'test-nested-links': [{ type: 'nested', root: { title: 'DATA TYPE', children: [
    { title: 'DATA ELEMENT', items: [{ name: 'Data Browser', sub: 'TYPE REF TO' }] }
  ] } }],
  'test-title-links': [
    { type: 'flow', steps: [{ title: 'DATA TYPE', desc: '설명' }] },
    { type: 'compare', items: [{ title: 'DATA ELEMENT', points: [] }] },
    { type: 'practice', title: 'Data Browser', steps: [] },
    { type: 'callout', title: 'TYPE REF TO', body: '설명' }
  ],
  'test-non-links': [
    { type: 'code', label: 'DATA TYPE', code: 'DATA ELEMENT' },
    { type: 'nested', root: { title: '예시', sequence: ['DATA TYPE'], code: 'Data Browser', items: [{ name: '예시', snippet: 'TYPE REF TO' }] } },
    { type: 'flow', steps: [{ badge: 'DATA TYPE', title: '예시', desc: '설명' }] },
    { type: 'compare', items: [{ tag: 'DATA ELEMENT', title: '예시', points: [] }] },
    { type: 'practice', title: '예시', steps: [{ step: 'Data Browser', action: '예시' }] },
    { type: 'widget', widget: 'TYPE REF TO' },
    { type: 'text', paragraphs: ['<a href="https://example.com/DATA%20TYPE">DATA ELEMENT</a>'] }
  ]
};
for (const [id, blocks] of Object.entries(backlinkFixtures)) {
  context.window.WIKI_DOCS[id] = { id, title: id, track: 'abap', sections: [{ title: 'DATA TYPE', blocks }] };
}
const app = fs.readFileSync('js/app.js', 'utf8');
const setup = app.slice(app.indexOf('  const TRACK_SESSION_KEY'), app.indexOf('  const categoryNav'));
const helpers = app.slice(app.indexOf('  function escapeRegExp'), app.indexOf('  // 좌측 고정 사이드바'));
vm.runInContext(setup + helpers + `
let parseCalls = 0;
const originalParse = parseInline;
parseInline = (...args) => { parseCalls++; return originalParse(...args); };
globalThis.api = { parseInline, computeBacklinks, parseCalls: () => parseCalls };`, context);
const { parseInline, computeBacklinks } = context.api;
assert.match(parseInline('ABAP Dictionary와 함수 모듈, SE38'), /data-doc="abap-dictionary"/);
assert.match(parseInline('함수 모듈'), /data-doc="abap-modularization"/);
assert.match(parseInline('`SE38`'), /data-doc="sap-tcode-reference"/);
assert.equal(parseInline('SE38', 'sap-tcode-reference'), 'SE38');
const external = '<a href="https://example.com/SE38">SE38</a>';
assert.equal(parseInline(external), external);
assert.equal((parseInline('[[abap-dictionary|ABAP Dictionary]]').match(/<a /g) || []).length, 1);
const compoundTargets = {
  'DATA TYPE': 'abap-types',
  'DATA ELEMENT': 'abap-dictionary',
  'Data Browser': 'sap-tcode-reference',
  'TYPE REF TO': 'abap-objects'
};
for (const [term, target] of Object.entries(compoundTargets)) {
  for (const variant of new Set([term, term.toLowerCase(), term.toUpperCase()])) {
    const expected = `<a href="#doc/${target}" class="wiki-link" data-doc="${target}">${variant}</a>`;
    assert.equal(parseInline(variant), expected, `${variant} must link as one complete term`);
    assert.equal(parseInline(variant, target), variant, 'self references must not fall back to shorter aliases');
    assert.equal(parseInline('`' + variant + '`'), `<a href="#doc/${target}" class="wiki-link code-wiki-link" data-doc="${target}"><code>${variant}</code></a>`);
    assert.equal(parseInline('`' + variant + '`', target), `<code>${variant}</code>`);
  }
}
assert.equal(parseInline('Data Type'), '<a href="#doc/abap-types" class="wiki-link" data-doc="abap-types">Data Type</a>');
assert.equal((parseInline('DATA TYPE, DATA ELEMENT, Data Browser, TYPE REF TO').match(/<a /g) || []).length, 4);
assert.equal((parseInline('DATA TYPE', 'abap-basics').match(/data-doc="abap-types"/g) || []).length, 1);
assert.equal((parseInline('DATA TYPEX').match(/data-doc="abap-types"/g) || []).length, 0, 'aliases must end at a word boundary');
assert.equal((parseInline('DATA · TYPE').match(/data-doc="abap-basics"/g) || []).length, 2, 'standalone syntax keeps its original destination');
assert.equal(parseInline('`DATA lv TYPE i`'), '<code>DATA lv TYPE i</code>');
assert.equal(parseInline('[[abap-basics|DATA TYPE]]'), '<a href="#doc/abap-basics" class="wiki-link" data-doc="abap-basics">DATA TYPE</a>');
assert.equal(parseInline('<code>DATA TYPE</code>'), '<code>DATA TYPE</code>');
for (const target of Object.values(compoundTargets)) {
  const sources = computeBacklinks(target).map(doc => doc.id);
  assert.ok(sources.includes('test-nested-links'), `${target}: nested visible links must have backlinks`);
  assert.ok(sources.includes('test-title-links'), `${target}: block titles must have backlinks`);
  assert.ok(!sources.includes('test-non-links'), `${target}: escaped content and metadata must not have backlinks`);
}
assert.ok(computeBacklinks('abap-dictionary').some(doc => doc.id === 'sap-tcode-reference'));
const callsAfterIndex = context.api.parseCalls();
for (const id of Object.keys(context.window.WIKI_DOCS)) computeBacklinks(id);
assert.equal(context.api.parseCalls(), callsAfterIndex, 'changing target documents must reuse the backlink index');
assert.ok(computeBacklinks('sap-tcode-reference').every(doc => doc.track !== 'ui5'));
const aliasOwners = new Map();
for (const doc of Object.values(context.window.WIKI_DOCS).filter(doc => doc.track !== 'ui5')) {
  for (const alias of [doc.title, ...(doc.aliases || [])]) {
    const key = alias.trim().toLowerCase();
    assert.ok(!aliasOwners.has(key) || aliasOwners.get(key) === doc.id, `${alias}: conflicting link destinations`);
    aliasOwners.set(key, doc.id);
  }
  for (const match of JSON.stringify(doc).matchAll(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g)) {
    assert.ok(context.window.WIKI_DOCS[match[1]], `${doc.id}: missing ${match[1]}`);
  }
}
console.log('PASS: whole-term automatic/manual/code links, self-link exclusion, rendered backlinks, unambiguous destinations, cached index');
