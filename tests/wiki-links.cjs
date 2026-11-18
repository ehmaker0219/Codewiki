const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, sessionStorage: { getItem: () => null } });
vm.runInContext(fs.readFileSync('js/data.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/ui5-data.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/class-notes.js', 'utf8'), context);
for (const name of ['lesson-days','example-notes','learning-tools']) vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),context);
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
assert.ok(computeBacklinks('abap-dictionary').some(doc => doc.id === 'sap-tcode-reference'));
const callsAfterIndex = context.api.parseCalls();
for (const id of Object.keys(context.window.WIKI_DOCS)) computeBacklinks(id);
assert.equal(context.api.parseCalls(), callsAfterIndex, 'changing target documents must reuse the backlink index');
assert.ok(computeBacklinks('sap-tcode-reference').every(doc => doc.track !== 'ui5'));
for (const doc of Object.values(context.window.WIKI_DOCS).filter(doc => doc.track !== 'ui5')) {
  for (const match of JSON.stringify(doc).matchAll(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g)) {
    assert.ok(context.window.WIKI_DOCS[match[1]], `${doc.id}: missing ${match[1]}`);
  }
}
console.log('PASS: automatic/manual/code links, self-link exclusion, external HTML preservation, backlinks, internal destinations');
