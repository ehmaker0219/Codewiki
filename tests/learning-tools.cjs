const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const ctx={window:{}};
for(const name of ['data','ui5-data','class-notes','lesson-days','example-notes','learning-tools']) vm.runInNewContext(fs.readFileSync(`js/${name}.js`,'utf8'),ctx);
const docs=ctx.window.WIKI_DOCS, tools=ctx.window.CodeWikiLearning;
const index=tools.indexDocuments(Object.values(docs));
for(const term of ['CHANGING','sy-subrc','lv_double','LZDEMOTOP']) assert.ok(tools.search(index,term).some(r=>r.snippet.toLowerCase().includes(term.toLowerCase())),term);
assert.equal(tools.search(index,'ABAP 기초')[0].doc.id,'abap-basics');
assert.equal(tools.search(index,'zz-nonexistent-123').length,0);
assert.equal(tools.highlight('<img onerror="oops">','img'),'&lt;<mark>img</mark> onerror=&quot;oops&quot;&gt;');
const daily=n=>docs['lesson-2026-11-'+n];
assert.equal(daily('11').sourceFile,'261111WED.md');
assert.ok(!daily('11').sections.some(s=>/초기값|트랜잭션 코드 생성/.test(s.title)));
assert.ok(daily('12').sections.some(s=>s.title==='텍스트 심볼과 번역'));
assert.ok(!daily('13').sections.some(s=>s.title==='예외와 반환 코드'));
assert.ok(daily('16').sections.some(s=>s.title==='서브루틴 매개변수'));
assert.ok(!daily('16').sections.some(s=>/함수 그룹|BAPI|클래스/.test(s.title)));
assert.ok(daily('17').sections.some(s=>s.title==='함수 그룹과 함수 모듈'));
assert.ok(daily('17').sections.some(s=>s.title==='예외와 반환 코드'));
assert.deepEqual(Array.from(docs['abap-bapi'].lessonDates),['2026-11-17']);
assert.deepEqual(Array.from(docs['abap-objects'].lessonDates),['2026-11-17']);
const groups=tools.relatedGroups(docs['abap-modularization'],[daily('13'),docs['abap-objects']],Object.values(docs));
assert.ok(groups.concepts.every(d=>!d.isDailyLesson));
assert.deepEqual(Array.from(groups.dates.map(d=>d.id)),['lesson-2026-11-16','lesson-2026-11-17']);
let codes=0;
for(const doc of Object.values(docs).filter(d=>d.track==='abap'))for(const sec of doc.sections||[])for(const b of sec.blocks||[])if(b.type==='code'){
 codes++;assert.ok(b.example?.kind && b.example.expected && b.example.input,b.label);assert.equal(b.example.verification,'SAP 실행 미확인');
}
assert.ok(codes>=17);
console.log('PASS: full-text/code search, safe highlights, exact lesson dates, related groups, example guidance');
