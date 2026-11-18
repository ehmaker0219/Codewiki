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
 nodes.openPracticeBtn.events.click();assert.equal(nodes.practiceDialog.open,true);
 nodes.practiceCategory.value='forms';nodes.practiceCategory.events.change();
 const first=nodes.practiceQuestion.children[1].textContent;
 await nodes.copyPracticeBtn.events.click();assert.ok(copied.includes(first));assert.match(copied,/FORMS-\d\d/);
 nodes.nextPracticeBtn.events.click();assert.notEqual(nodes.practiceQuestion.children[1].textContent,first);
 nodes.practiceCategory.value='';nodes.practiceCategory.events.change();assert.equal(nodes.nextPracticeBtn.disabled,true);assert.equal(nodes.copyPracticeBtn.disabled,true);
 console.log('PASS: 60 stable IDs, 10 unique prompts per round, round boundary, category selection and question copy');
})().catch(e=>{console.error(e);process.exitCode=1});
