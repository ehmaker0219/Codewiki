const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{WIKI_DOCS:{},addEventListener(){}}};
for(const name of ['schedule-data','schedule'])vm.runInNewContext(fs.readFileSync(`js/${name}.js`,'utf8'),ctx);
const data=ctx.window.WIKI_SCHEDULE, api=ctx.window.CodeWikiSchedule;
assert.equal(data.entries.length,193);
assert.equal(new Set(data.entries.map(e=>e.date)).size,193);
assert.equal(data.entries.filter(e=>e.kind==='holiday').length,13);
assert.equal(data.entries.filter(e=>e.kind==='assessment').length,4);
assert.equal(data.milestones.length,8);
const entries=new Map(data.entries.map(e=>[e.date,e]));
for(const [date,title] of [['2026-10-19','UX399'],['2026-11-11','BC400/BC430'],['2026-11-27','휴강'],['2027-01-01','신정'],['2027-01-07','평가3'],['2027-06-17','S4D430(RAP)'],['2027-07-14','수료식']])assert.equal(entries.get(date).title,title);
assert.equal(entries.get('2027-01-07').milestones[0],'평가3 (ABAP2)'); // preserve original label
assert.equal(api.months[0],'2026-10');assert.equal(api.months.at(-1),'2027-07');assert.equal(api.months.length,10);
assert.equal(api.monthCells('2027-02').filter(Boolean).length,28);
assert.equal(api.monthCells('2026-11')[0],'2026-11-01');
assert.equal(api.monthCells('2026-10')[4],'2026-10-01');
for(const month of api.months){
 const cells=api.monthCells(month);assert.equal(cells.length%7,0);
 for(const key of cells.filter(Boolean))assert.ok(key.startsWith(month));
}
assert.ok(data.entries.every(e=>e.date>=data.start && e.date<=data.end && new Date(e.date+'T12:00:00').getDay()%6!==0));
assert.ok(data.entries.filter(e=>e.kind!=='holiday').every(e=>data.phases.some(p=>p.id===e.phaseId&&p.ranges.some(r=>r.start<=e.date&&r.end>=e.date))));
// Exercise controls against a lightweight DOM surface and inspect rendered content.
const nodes=new Map();const listeners={};
const node=id=>nodes.get(id)|| (nodes.set(id,{addEventListener(type,fn){listeners[id+':'+type]=fn},focus(){}}),nodes.get(id));
const container={innerHTML:'',querySelector:node,querySelectorAll(selector){
  if(selector!=='[data-birthday-member]')return [];
  return [...this.innerHTML.matchAll(/data-birthday-member="(\d+)"/g)].map(([,index])=>({dataset:{birthdayMember:index},addEventListener(type,fn){listeners['member-'+index+':'+type]=fn;}}));
},scrollIntoView(){}};
api.render(container);
assert.ok(container.innerHTML.includes('교육 일정'));
assert.match(container.innerHTML,/id="scheduleBirthdays" aria-pressed="false"/);
assert.match(container.innerHTML,/<svg width="18"/);
listeners['#scheduleMonth:change']({target:{value:'2027-02'}});
assert.ok(container.innerHTML.includes('2027년 2월'));
assert.ok(container.innerHTML.includes('설날'));
listeners['#scheduleFilter:change']({target:{value:'assessment'}});
assert.ok(container.innerHTML.includes('평가4'));
listeners['#scheduleMonth:change']({target:{value:'2027-04'}});
assert.ok(container.innerHTML.includes('이번 달에는 선택한 분류의 일정이 없습니다.'));
const people=[{full_name:'김테스트',month:8,day:2},{full_name:'<Birthday>',month:2,day:6},{full_name:'윤테스트',month:2,day:29}];
ctx.window.CodeWikiBirthdays={forDate:key=>people.filter(p=>p.month===Number(key.slice(5,7))&&p.day===Number(key.slice(8))),getStatus:()=> 'ready',getMembers:()=>people};
listeners['#scheduleMonth:change']({target:{value:'2027-02'}});
listeners['#scheduleBirthdays:click']();
assert.match(container.innerHTML,/id="scheduleBirthdays" aria-pressed="true"/);
assert.ok(container.innerHTML.includes('🎂 &lt;Birthday&gt; 생일'));
assert.ok(container.innerHTML.includes('이름을 선택하면 생일이 표시됩니다.'));
listeners['#scheduleMonth:change']({target:{value:'2026-11'}});
listeners['member-1:click']();
assert.ok(container.innerHTML.includes('value="2027-02" selected'));
assert.match(container.innerHTML,/data-calendar-day="2027-02-06" aria-pressed="true"/);
assert.ok(container.innerHTML.includes('<strong>&lt;Birthday&gt;</strong><p>🎂 2월 6일</p>'));
listeners['member-0:click']();
assert.ok(container.innerHTML.includes('<strong>김테스트</strong><p>🎂 8월 2일</p>')); // outside education months remains discoverable
assert.ok(container.innerHTML.includes('value="2027-08" selected'));
assert.match(container.innerHTML,/data-calendar-day="2027-08-02" aria-pressed="true"/);
assert.ok(!container.innerHTML.includes('이번 달에는 선택한 분류의 일정이 없습니다.'));
listeners['member-2:click']();
assert.ok(container.innerHTML.includes('value="2028-02" selected'));
assert.match(container.innerHTML,/data-calendar-day="2028-02-29" aria-pressed="true"/);
ctx.window.CodeWikiBirthdays.getMembers=()=>[];
api.render(container);
assert.ok(container.innerHTML.includes('공개된 생일이 아직 없습니다.'));
assert.ok(!container.innerHTML.includes('<strong>김테스트</strong>'));
listeners['#scheduleBirthdays:click']();
assert.match(container.innerHTML,/id="scheduleBirthdays" aria-pressed="false"/);
assert.ok(!container.innerHTML.includes('id="birthdayDirectoryTitle"'));
console.log('PASS: 193 source dates, 13 closures, 4 assessments, 8 milestones, year boundaries, phase ranges, month/filter/empty-state rendering');
