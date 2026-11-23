const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function element(){return {children:[],events:{},dataset:{},classList:{add(){},remove(){},toggle(){}},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items;this.textContent=''},setAttribute(){},addEventListener(k,v){this.events[k]=v},focus(){},remove(){},showModal(){this.open=true},close(){this.open=false;this.events.close?.()}};}
const nodes={},events={};const location={hash:"#doc/welcome-abap"};const ctx=vm.createContext({history:{replaceState(_a,_b,hash){location.hash=hash}},window:{location,scrollTo(){},addEventListener(name,fn){events[name]=fn}},setTimeout,clearTimeout,document:{getElementById:id=>nodes[id]??=element(),createElement:element,querySelectorAll:()=>[],head:element()}});
for(const name of ['object-game-bank','object-game'])vm.runInContext(fs.readFileSync(`js/${name}.js`,'utf8'),ctx);
const api=ctx.window.CodeWikiObjectGame,bank=ctx.window.CodeWikiObjectBank;
const total=bank.questions.length;
assert.equal(total,109);assert.equal(bank.categories.length,17);
assert.equal(new Set(bank.questions.map(q=>q.name)).size,total);
const selectionQuestions=bank.questions.filter(q=>q.name.startsWith('so_'));
assert.equal(selectionQuestions.length,6);
assert.ok(selectionQuestions.every(q=>q.answer==='selectionTable'&&q.explanation.includes('SELECT-OPTIONS')));
assert.throws(()=>api.createGame({...bank,questions:[]}),/Invalid question bank/);
assert.throws(()=>api.createGame({...bank,questions:[bank.questions[0]]}),/Invalid question bank/);
assert.throws(()=>api.createGame({...bank,categories:bank.categories.slice(0,3)}),/Invalid question bank/);
for(const random of [()=>0,()=>0.999,Math.random]){
 const game=api.createGame(bank,random);let previous=null;
 for(let round=1;round<=3;round++){
  const seen=new Set();
  for(let i=1;i<=total;i++){
   const draw=game.next();assert.equal(draw.round,round);assert.equal(draw.seen,i);
   assert.ok(!seen.has(draw.question.id));assert.notEqual(previous,draw.question.id);seen.add(draw.question.id);previous=draw.question.id;
   assert.equal(draw.options.length,4);assert.equal(new Set(draw.options.map(o=>o.id)).size,4);
   assert.ok(draw.options.some(o=>o.id===draw.question.answer));
   assert.equal(game.answer('not-an-option'),null);
   const right=i%2===0;const answer=draw.options.find(o=>(o.id===draw.question.answer)===right).id;
   const result=game.answer(answer);assert.equal(result.correct,right);assert.equal(result.answered,(round-1)*total+i);
   assert.equal(result.score,(round-1)*Math.floor(total/2)+Math.floor(i/2));assert.equal(game.answer(answer),null);
  }
 }
}
(async()=>{
 assert.equal(nodes.openObjectGameBtn.hidden,true);
 for(const user of [null,{id:'a',role:'admin',status:'approved'},{id:'s',role:'student',status:'pending'}]){
  api.setUser(user);await nodes.openObjectGameBtn.events.click();assert.equal(nodes.objectGamePage.hidden,true);assert.equal(nodes.openObjectGameBtn.hidden,true);
 }
 api.setUser({id:'s',role:'student',status:'approved'});assert.equal(nodes.openObjectGameBtn.hidden,false);
 await nodes.openObjectGameBtn.events.click();await events.hashchange();assert.equal(location.hash,'#data-game');assert.equal(nodes.objectGamePage.hidden,false);
 const choices=nodes.objectGameContent.children[1];choices.children[0].events.click();
 const score=nodes.objectGameScore.textContent;assert.match(score,/1문제 도전/);choices.children[1].events.click();assert.equal(nodes.objectGameScore.textContent,score);
 const name=nodes.objectGameContent.children[0].textContent;nodes.objectGameNext.events.click();assert.notEqual(nodes.objectGameContent.children[0].textContent,name);
 api.leave();assert.equal(nodes.objectGamePage.hidden,true);assert.ok(location.hash.startsWith('#doc/'));await nodes.openObjectGameBtn.events.click();await events.hashchange();assert.equal(nodes.objectGameScore.textContent,score);
 api.setUser(null);assert.equal(nodes.objectGamePage.hidden,true);assert.equal(nodes.objectGameScore.textContent,'');assert.equal(nodes.openObjectGameBtn.hidden,true);
 api.setUser({id:'other',role:'student',status:'approved'});await nodes.openObjectGameBtn.events.click();await events.hashchange();assert.equal(nodes.objectGameContent.children[0].className,'object-game-name');assert.equal(nodes.objectGameContent.children.length,4);
 api.leave();api.setUser(null);delete ctx.window.CodeWikiObjectBank;
 api.setUser({id:'loading',role:'student',status:'approved'});await nodes.openObjectGameBtn.events.click();const loading=events.hashchange();api.leave();
 ctx.window.CodeWikiObjectBank=bank;ctx.document.head.children.at(-1).onload();await loading;
 assert.equal(nodes.objectGamePage.hidden,true);assert.equal(nodes.objectGameContent.children.length,0);
 await nodes.openObjectGameBtn.events.click();await events.hashchange();assert.equal(nodes.objectGamePage.hidden,false);assert.equal(nodes.objectGameContent.children[0].className,'object-game-name');assert.equal(nodes.objectGameContent.children.length,4);
 console.log('PASS: 109 unique questions, 17 types including SELECT-OPTIONS, endless shuffled rounds, four distinct options, single scoring, page navigation, student-only access, session reset');
})().catch(e=>{console.error(e);process.exitCode=1});
