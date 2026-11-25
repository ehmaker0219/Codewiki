const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes={}; let copied='';
function element(){return {value:'',disabled:true,children:[],events:{},append(...x){this.children.push(...x)},replaceChildren(){this.children=[]},addEventListener(k,v){this.events[k]=v},focus(){},showModal(){this.open=true},close(){this.open=false}}}
const ctx=vm.createContext({window:{},navigator:{clipboard:{writeText:async text=>{copied=text}}},document:{getElementById:id=>nodes[id]??=element(),createElement:element}});
for(const name of ['data','ui5-data','class-notes','practice','practice-ui']) vm.runInContext(fs.readFileSync(`js/${name}.js`,'utf8'),ctx);
(async()=>{
 assert.equal(ctx.window.WIKI_PRACTICE.length,6);
 const ids=new Set();
 for(const c of ctx.window.WIKI_PRACTICE){
  assert.ok(ctx.window.WIKI_DOCS[c.doc]);assert.equal(c.questions.length,10);
  for(const q of c.questions){assert.ok(q.id && q.body && q.conditions.length>=2);assert.ok(!ids.has(q.id));ids.add(q.id);}
  for(const random of [()=>0,()=>0.999,Math.random]){
   const deck=ctx.window.CodeWikiPractice.createDeck(c.questions,random);let last=null;
   for(let round=1;round<=4;round++){
    const seen=new Set();for(let i=1;i<=10;i++){
     const draw=deck.next();assert.ok(!seen.has(draw.question.id));assert.notEqual(draw.question.id,last);
     seen.add(draw.question.id);last=draw.question.id;assert.equal(draw.seen,i);assert.equal(draw.round,round);
    }
    assert.equal(seen.size,10);
   }
  }
 }
 assert.equal(nodes.openPracticeBtn.hidden,true);
 ctx.window.CodeWikiPractice.setUser({role:'student',status:'approved'});
 assert.equal(nodes.openPracticeBtn.hidden,true);
 nodes.openPracticeBtn.events.click();assert.ok(!nodes.practiceDialog.open,'student cannot open practice');
 ctx.window.CodeWikiPractice.setUser({role:'admin',status:'approved'});
 assert.equal(nodes.openPracticeBtn.hidden,true,'admin must not see practice button');
 nodes.openPracticeBtn.events.click();assert.ok(!nodes.practiceDialog.open,'admin cannot open practice');
 nodes.practiceCategory.value='forms';nodes.practiceCategory.events.change();
 assert.equal(nodes.nextPracticeBtn.disabled,true);assert.equal(nodes.copyPracticeBtn.disabled,true);
 await nodes.copyPracticeBtn.events.click();assert.equal(copied,'');
 ctx.window.CodeWikiPractice.setUser(null);
 assert.equal(nodes.openPracticeBtn.hidden,true);assert.ok(!nodes.practiceDialog.open);
 assert.equal(nodes.practiceCategory.value,'');assert.equal(nodes.copyPracticeBtn.disabled,true);
 console.log('PASS: 60 stable IDs, unique rounds, hidden practice for admin/student and logout cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
