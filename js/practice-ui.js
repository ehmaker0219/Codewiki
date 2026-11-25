(() => {
  function createDeck(questions, random = Math.random) {
    let remaining = [], previous = null, round = 0;
    return {next() {
      if (!remaining.length) {
        remaining = [...questions]; round++;
        for (let i = remaining.length-1; i > 0; i--) {
          const j = Math.floor(random() * (i+1));
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
        if (remaining.length > 1 && remaining[remaining.length-1].id === previous) {
          [remaining[0], remaining[remaining.length-1]] = [remaining[remaining.length-1], remaining[0]];
        }
      }
      const question = remaining.pop();
      previous = question.id;
      return {question, seen:questions.length-remaining.length, total:questions.length, round};
    }};
  }
  const trigger=document.getElementById('openPracticeBtn');
  const dialog=document.getElementById('practiceDialog');
  const select=document.getElementById('practiceCategory');
  const output=document.getElementById('practiceQuestion');
  const next=document.getElementById('nextPracticeBtn');
  const copy=document.getElementById('copyPracticeBtn');
  const status=document.getElementById('practiceCopyStatus');
  const decks=new Map();
  let current=null,allowed=false;
  function setUser(user) {
    // Disabled for admin accounts as well as students until re-enabled.
    allowed=false;
    trigger.hidden=true;
    if(dialog.open)dialog.close();
    current=null;select.value='';output.textContent='공부하고 싶은 주제를 선택해 주세요.';status.textContent='';
    next.disabled=true;copy.disabled=true;
  }
  window.CodeWikiPractice={createDeck,setUser};
  setUser(window.CodeWikiAuth?.getCurrentUser()||null);
  window.WIKI_PRACTICE.forEach(category=>{
    const option=document.createElement('option'); option.value=category.id; option.textContent=category.title; select.append(option);
    decks.set(category.id,createDeck(category.questions));
  });
  function showQuestion() {
    if(!allowed)return;
    const category=window.WIKI_PRACTICE.find(c=>c.id===select.value);
    status.textContent='';
    if (!category) {
      current=null; output.textContent='공부하고 싶은 주제를 선택해 주세요.'; next.disabled=true; copy.disabled=true; return;
    }
    const draw=decks.get(category.id).next();
    const question=draw.question;
    current={category,question};
    output.replaceChildren();
    const count=document.createElement('p'); count.className='practice-question-meta'; count.textContent=`${category.title} · ${question.id.toUpperCase()} · ${draw.round}회차 ${draw.seen}/${draw.total}`;
    const title=document.createElement('h3'); title.textContent=question.title;
    const body=document.createElement('p'); body.textContent=question.body;
    const list=document.createElement('ul'); question.conditions.forEach(condition=>{const li=document.createElement('li');li.textContent=condition;list.append(li);});
    output.append(count,title,body,list);next.disabled=false;copy.disabled=false;
  }
  copy.addEventListener('click',async()=>{
    if(!allowed||!current) return;
    const selected=current;
    const {category,question}=selected;
    const text=`[${question.id.toUpperCase()}] ${category.title}\n${question.title}\n\n${question.body}\n\n${question.conditions.map(c=>'- '+c).join('\n')}`;
    try { await navigator.clipboard.writeText(text); if(current===selected)status.textContent='복사했습니다.'; }
    catch { if(current===selected)status.textContent='복사하지 못했습니다. 문제 내용을 선택해 복사해 주세요.'; }
  });
  select.addEventListener('change',showQuestion);
  next.addEventListener('click',showQuestion);
  trigger.addEventListener('click',()=>{if(!allowed)return;if(!select.value&&!current)output.textContent='공부하고 싶은 주제를 선택해 주세요.';dialog.showModal();select.focus();});
  document.getElementById('closePracticeBtn').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{if(allowed)trigger.focus();});
})();
