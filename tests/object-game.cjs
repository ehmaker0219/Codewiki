const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function element(tag='div'){return {tagName:tag.toUpperCase(),children:[],events:{},dataset:{},classList:{add(){},remove(){},toggle(){}},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items;this.textContent=''},setAttribute(){},addEventListener(k,v){this.events[k]=v},focus(){},remove(){},showModal(){this.open=true},close(){this.open=false;this.events.close?.()}};}
const nodes={},events={};const location={hash:"#doc/welcome-abap"};const ctx=vm.createContext({history:{replaceState(_a,_b,hash){location.hash=hash}},window:{location,scrollTo(){},addEventListener(name,fn){events[name]=fn}},setTimeout,clearTimeout,document:{getElementById:id=>nodes[id]??=element(),createElement:element,querySelectorAll:()=>[],head:element()}});
for(const name of ['object-game-bank','object-game'])vm.runInContext(fs.readFileSync(`js/${name}.js`,'utf8'),ctx);
const api=ctx.window.CodeWikiObjectGame,bank=ctx.window.CodeWikiObjectBank;
const total=bank.questions.length;
assert.ok(total>=200,'the expanded bank should include many declaration-based comparisons');assert.equal(bank.categories.length,20);
assert.equal(new Set(bank.questions.map(q=>JSON.stringify([q.name,q.prompt||'']))).size,total);
for(const question of bank.questions)for(const [,name] of (question.prompt||'').matchAll(/^(?:PARAMETERS|SELECT-OPTIONS)\s+(\w+)/gm)){
 assert.ok(name.length<=8,'selection-screen field names are limited to eight characters: '+name);
}
const selectionQuestions=bank.questions.filter(q=>/^selectionTable-\d+$/.test(q.id));
assert.equal(selectionQuestions.length,6);
assert.ok(selectionQuestions.every(q=>q.answer==='selectionTable'&&q.explanation.includes('SELECT-OPTIONS')));
assert.throws(()=>api.createGame({...bank,questions:[]}),/Invalid question bank/);
assert.throws(()=>api.createGame({...bank,questions:[bank.questions[0]]}),/Invalid question bank/);
assert.throws(()=>api.createGame({...bank,categories:bank.categories.slice(0,3)}),/Invalid question bank/);
for(const prompt of [null,1,'','   ',{}])assert.throws(()=>api.createGame({...bank,questions:[{...bank.questions[0],prompt},bank.questions[1]]}),/Invalid question prompt/);
for(const distractors of [null,'domain',['unknown'],[bank.questions[0].answer],['domain','domain'],['domain','dataElement','tableType','databaseTable']]){
 assert.throws(()=>api.createGame({...bank,questions:[{...bank.questions[0],distractors},bank.questions[1]]}),/Invalid question distractors/);
}
for(let count=0;count<=3;count++){
 const distractors=['domain','dataElement','tableType'].slice(0,count);
 const game=api.createGame({...bank,questions:[{...bank.questions[0],distractors},bank.questions[1]]},()=>0);
 const draw=game.next();assert.equal(draw.options.length,4);assert.equal(new Set(draw.options.map(o=>o.id)).size,4);
 for(const id of distractors)assert.ok(draw.options.some(o=>o.id===id));
}
for(const random of [()=>0,()=>0.999,Math.random]){
 const game=api.createGame(bank,random);let previous=null;
 for(let round=1;round<=3;round++){
  const seen=new Set();
  for(let i=1;i<=total;i++){
   const draw=game.next();assert.equal(draw.round,round);assert.equal(draw.seen,i);
   assert.ok(!seen.has(draw.question.id));assert.notEqual(previous,draw.question.id);seen.add(draw.question.id);previous=draw.question.id;
   assert.equal(draw.options.length,4);assert.equal(new Set(draw.options.map(o=>o.id)).size,4);
   assert.ok(draw.options.some(o=>o.id===draw.question.answer));
   for(const id of draw.question.distractors||[])assert.ok(draw.options.some(o=>o.id===id),'designated confusing alternatives must be included');
   assert.equal(game.answer('not-an-option'),null);
   const right=i%2===0;const answer=draw.options.find(o=>(o.id===draw.question.answer)===right).id;
   const result=game.answer(answer);assert.equal(result.correct,right);assert.equal(result.answered,(round-1)*total+i);
   assert.equal(result.score,(round-1)*Math.floor(total/2)+Math.floor(i/2));assert.equal(game.answer(answer),null);
  }
 }
}
const outputChild=className=>nodes.objectGameContent.children.find(child=>child.className===className);
const renderedQuestion=()=>JSON.stringify([outputChild('object-game-name')?.textContent,outputChild('object-game-prompt')?.textContent]);
function assertQuestionView(){
 assert.ok(outputChild('object-game-name'));assert.equal(outputChild('object-game-options').children.length,4);
 assert.ok(outputChild('object-game-hint'));assert.ok(outputChild('object-game-feedback'));
 assert.ok(nodes.objectGameContent.children.every(child=>['object-game-name','object-game-prompt','object-game-options','object-game-hint','object-game-feedback'].includes(child.className)),'no round or source metadata should return');
}
(async()=>{
 assert.equal(nodes.openObjectGameBtn.hidden,true);
 for(const user of [null,{id:'a',role:'admin',status:'approved'},{id:'s',role:'student',status:'pending'}]){
  api.setUser(user);await nodes.openObjectGameBtn.events.click();assert.equal(nodes.objectGamePage.hidden,true);assert.equal(nodes.openObjectGameBtn.hidden,true);
 }
 api.setUser({id:'s',role:'student',status:'approved'});assert.equal(nodes.openObjectGameBtn.hidden,false);
 await nodes.openObjectGameBtn.events.click();await events.hashchange();assert.equal(location.hash,'#data-game');assert.equal(nodes.objectGamePage.hidden,false);
 const choices=outputChild('object-game-options');choices.children[0].events.click();
 const score=nodes.objectGameScore.textContent;assert.match(score,/1문제 도전/);choices.children[1].events.click();assert.equal(nodes.objectGameScore.textContent,score);
 const displayed=renderedQuestion();nodes.objectGameNext.events.click();assert.notEqual(renderedQuestion(),displayed);
 api.leave();assert.equal(nodes.objectGamePage.hidden,true);assert.ok(location.hash.startsWith('#doc/'));await nodes.openObjectGameBtn.events.click();await events.hashchange();assert.equal(nodes.objectGameScore.textContent,score);
 api.setUser(null);assert.equal(nodes.objectGamePage.hidden,true);assert.equal(nodes.objectGameScore.textContent,'');assert.equal(nodes.openObjectGameBtn.hidden,true);
 api.setUser({id:'other',role:'student',status:'approved'});await nodes.openObjectGameBtn.events.click();await events.hashchange();assertQuestionView();
 api.leave();api.setUser(null);delete ctx.window.CodeWikiObjectBank;
 api.setUser({id:'loading',role:'student',status:'approved'});await nodes.openObjectGameBtn.events.click();const loading=events.hashchange();api.leave();
 ctx.window.CodeWikiObjectBank=bank;ctx.document.head.children.at(-1).onload();await loading;
 assert.equal(nodes.objectGamePage.hidden,true);assert.equal(nodes.objectGameContent.children.length,0);
 await nodes.openObjectGameBtn.events.click();await events.hashchange();assert.equal(nodes.objectGamePage.hidden,false);assertQuestionView();
 api.leave();api.setUser(null);
 const payload='DATA ls_flight TYPE bc400_s_flight.\n<img src=x onerror="alert(1)">';
 const template={...bank.questions[0],prompt:undefined,distractors:undefined};
 ctx.window.CodeWikiObjectBank={categories:bank.categories,questions:[
  {...template,id:'prompt-fixture',name:'ls_flight',prompt:payload,distractors:['domain','dataElement','tableType']},
  {...template,id:'name-fixture',name:'SCARR'}
 ]};
 api.setUser({id:'prompt-reader',role:'student',status:'approved'});await nodes.openObjectGameBtn.events.click();await events.hashchange();
 if(!outputChild('object-game-prompt'))nodes.objectGameNext.events.click();
 const prompt=outputChild('object-game-prompt');assert.equal(prompt.tagName,'PRE');assert.equal(prompt.textContent,payload);assert.equal(prompt.innerHTML,undefined);assert.equal(prompt.children.length,0);
 assertQuestionView();nodes.objectGameNext.events.click();assert.equal(outputChild('object-game-prompt'),undefined,'the next name-only question must clear the previous prompt');assertQuestionView();
 api.leave();api.setUser(null);ctx.window.CodeWikiObjectBank=bank;
 console.log(`PASS: ${total} unique contextual questions, ${bank.categories.length} types, required distractors, inert prompts, endless shuffled rounds, four distinct options, single scoring, page navigation, student-only access, session reset`);
})().catch(e=>{console.error(e);process.exitCode=1});
