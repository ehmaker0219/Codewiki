const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function element(){return {children:[],events:{},dataset:{},classList:{add(){}},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items;this.textContent=''},setAttribute(){},addEventListener(k,v){this.events[k]=v},focus(){},remove(){},showModal(){this.open=true},close(){this.open=false;this.events.close?.()}};}
const nodes={};const ctx=vm.createContext({window:{},setTimeout,clearTimeout,document:{getElementById:id=>nodes[id]??=element(),createElement:element,head:element()}});
for(const name of ['object-game-bank','object-game'])vm.runInContext(fs.readFileSync(`js/${name}.js`,'utf8'),ctx);
const api=ctx.window.CodeWikiObjectGame,bank=ctx.window.CodeWikiObjectBank;
assert.equal(bank.questions.length,100);assert.equal(bank.categories.length,16);
assert.equal(new Set(bank.questions.map(q=>q.name)).size,100);
for(const random of [()=>0,()=>0.999,Math.random]){
 const game=api.createGame(bank,random);let previous=null;
 for(let round=1;round<=3;round++){
  const seen=new Set();
  for(let i=1;i<=100;i++){
   const draw=game.next();assert.equal(draw.round,round);assert.equal(draw.seen,i);
   assert.ok(!seen.has(draw.question.id));assert.notEqual(previous,draw.question.id);seen.add(draw.question.id);previous=draw.question.id;
   assert.equal(draw.options.length,4);assert.equal(new Set(draw.options.map(o=>o.id)).size,4);
   assert.ok(draw.options.some(o=>o.id===draw.question.answer));
   assert.equal(game.answer('not-an-option'),null);
   const right=i%2===0;const answer=draw.options.find(o=>(o.id===draw.question.answer)===right).id;
   const result=game.answer(answer);assert.equal(result.correct,right);assert.equal(result.answered,(round-1)*100+i);
   assert.equal(result.score,(round-1)*50+Math.floor(i/2));assert.equal(game.answer(answer),null);
  }
 }
}
(async()=>{
 assert.equal(nodes.openObjectGameBtn.hidden,true);
 for(const user of [null,{id:'a',role:'admin',status:'approved'},{id:'s',role:'student',status:'pending'}]){
  api.setUser(user);await nodes.openObjectGameBtn.events.click();assert.ok(!nodes.objectGameDialog.open);assert.equal(nodes.openObjectGameBtn.hidden,true);
 }
 api.setUser({id:'s',role:'student',status:'approved'});assert.equal(nodes.openObjectGameBtn.hidden,false);
 await nodes.openObjectGameBtn.events.click();assert.equal(nodes.objectGameDialog.open,true);
 const choices=nodes.objectGameContent.children[3];choices.children[0].events.click();
 const score=nodes.objectGameScore.textContent;assert.match(score,/1문제 도전/);choices.children[1].events.click();assert.equal(nodes.objectGameScore.textContent,score);
 const name=nodes.objectGameContent.children[2].textContent;nodes.objectGameNext.events.click();assert.notEqual(nodes.objectGameContent.children[2].textContent,name);
 nodes.closeObjectGameBtn.events.click();await nodes.openObjectGameBtn.events.click();assert.equal(nodes.objectGameScore.textContent,score);
 api.setUser(null);assert.equal(nodes.objectGameDialog.open,false);assert.equal(nodes.objectGameScore.textContent,'');assert.equal(nodes.openObjectGameBtn.hidden,true);
 api.setUser({id:'other',role:'student',status:'approved'});await nodes.openObjectGameBtn.events.click();assert.match(nodes.objectGameContent.children[0].textContent,/1회차 · 1 \/ 100/);
 console.log('PASS: 100 unique questions, 16 types, endless shuffled rounds, four distinct options, single scoring, student-only access, session reset');
})().catch(e=>{console.error(e);process.exitCode=1});
