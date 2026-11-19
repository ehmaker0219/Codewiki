(() => {
  function shuffle(items, random) {
    const result=[...items];
    for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
    return result;
  }
  function createGame(bank, random=Math.random) {
    const ids=new Set(),categories=new Set(bank.categories.map(c=>c.id));
    if(bank.questions.length!==100 || categories.size!==bank.categories.length)throw new Error('Invalid question bank');
    for(const q of bank.questions){
      if(ids.has(q.id)||!q.name||!q.hint||!q.explanation||!categories.has(q.answer))throw new Error('Invalid question');
      ids.add(q.id);
    }
    let deck=[],previous=null,current=null,round=0,seen=0,answered=0,correct=0,choice=null;
    return {
      next(){
        if(!deck.length){
          deck=shuffle(bank.questions,random);round++;seen=0;
          if(deck.at(-1).id===previous)[deck[0],deck[deck.length-1]]=[deck.at(-1),deck[0]];
        }
        const question=deck.pop();previous=question.id;seen++;choice=null;
        const alternatives=bank.categories.filter(c=>c.id!==question.answer);
        const near=shuffle(alternatives.filter(c=>c.family===question.family),random);
        const far=shuffle(alternatives.filter(c=>c.family!==question.family),random);
        const options=shuffle([bank.categories.find(c=>c.id===question.answer),...[...near,...far].slice(0,3)],random);
        current={question,options,round,seen,total:bank.questions.length};return current;
      },
      answer(id){
        if(!current||choice!==null||!current.options.some(o=>o.id===id))return null;
        choice=id;answered++;if(id===current.question.answer)correct++;
        return {correct:id===current.question.answer,answered,score:correct};
      }
    };
  }
  const byId=id=>document.getElementById(id);
  const trigger=byId('openObjectGameBtn'),dialog=byId('objectGameDialog'),output=byId('objectGameContent');
  const next=byId('objectGameNext'),status=byId('objectGameScore');
  let userId=null,game=null,current=null,bankPromise=null,epoch=0;
  function setUser(user){
    const id=user?.role==='student'&&user.status==='approved'?user.id:null;
    if(id!==userId){epoch++;game=null;current=null;output.replaceChildren();status.textContent='';next.disabled=true;if(dialog.open)dialog.close();}
    userId=id;trigger.hidden=!id;
    const toolsGroup=byId('learningToolsGroup');if(toolsGroup)toolsGroup.hidden=!id;
  }
  function loadBank(){
    if(window.CodeWikiObjectBank)return Promise.resolve(window.CodeWikiObjectBank);
    if(!bankPromise){
      bankPromise=new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        const finish=(error)=>{clearTimeout(timer);script.remove();error?reject(error):resolve(window.CodeWikiObjectBank);};
        const timer=setTimeout(()=>finish(new Error('timeout')),10000);
        script.src=byId('objectGameBankSource').dataset.src;
        script.onload=()=>finish(window.CodeWikiObjectBank?null:new Error('missing bank'));
        script.onerror=()=>finish(new Error('load failed'));
        document.head.append(script);
      }).catch(error=>{bankPromise=null;throw error;});
    }
    return bankPromise;
  }
  function element(tag,className,text){const el=document.createElement(tag);el.className=className;if(text!==undefined)el.textContent=text;return el;}
  function draw(){
    if(!userId||!game)return;
    current=game.next();const {question,options,round,seen,total}=current;
    output.replaceChildren();
    const meta=element('p','object-game-meta',`${round}회차 · ${seen} / ${total}`);
    const context=element('p','object-game-context',question.context);
    const name=element('h3','object-game-name',question.name);name.tabIndex=-1;
    const choices=element('div','object-game-options');choices.setAttribute('role','group');choices.setAttribute('aria-label','요소 종류 선택');
    const feedback=element('div','object-game-feedback');feedback.setAttribute('role','status');
    options.forEach((option,i)=>{
      const button=element('button','object-game-option');button.type='button';
      button.append(element('span','object-game-option-number',String(i+1)),element('span','',option.label));
      button.addEventListener('click',()=>{
        if(!userId)return;const result=game.answer(option.id);if(!result)return;
        for(const child of choices.children){child.disabled=true;if(child.dataset.answer===question.answer)child.classList.add('is-correct');}
        if(!result.correct)button.classList.add('is-wrong');
        const answer=options.find(o=>o.id===question.answer).label;
        feedback.replaceChildren(element('strong','',result.correct?'정답이에요!':`정답은 ${answer}입니다.`),element('p','',question.explanation),element('p','object-game-rule',question.hint));
        status.textContent=`${result.answered}문제 도전 · ${result.score}개 정답`;
        next.textContent='다음 문제 →';next.focus();
      });
      button.dataset.answer=option.id;choices.append(button);
    });
    const hint=element('details','object-game-hint');hint.append(element('summary','','힌트 보기'),element('p','',question.hint));
    output.append(meta,context,name,choices,hint,feedback);next.disabled=false;next.textContent='다음 문제 →';name.focus();
  }
  async function open(){
    if(!userId)return;
    if(!dialog.open)dialog.showModal();
    if(game){next.focus();return;}
    const request=++epoch;output.textContent='문제를 준비하고 있습니다…';next.disabled=true;
    try{const bank=await loadBank();if(request!==epoch||!userId||!dialog.open)return;game=createGame(bank);draw();}
    catch{if(request!==epoch||!userId||!dialog.open)return;output.textContent='문제를 불러오지 못했습니다. 다시 시도해 주세요.';next.disabled=false;next.textContent='다시 시도';}
  }
  window.CodeWikiObjectGame={createGame,setUser};
  trigger.addEventListener('click',open);
  next.addEventListener('click',()=>game?draw():open());
  byId('closeObjectGameBtn').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{epoch++;if(userId)trigger.focus();});
  setUser(window.CodeWikiAuth?.getCurrentUser()||null);
})();
