(() => {
  const data = window.WIKI_SCHEDULE;
  const labels = {ui:'UI 수업', abap:'ABAP 수업', project:'프로젝트·행사', assessment:'평가', holiday:'휴강'};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const localDate = key => new Date(key+'T12:00:00');
  const today = () => dateKey(new Date());
  const weekdays = ['일','월','화','수','목','금','토'];
  const months = [];
  for (let date=localDate(data.start.slice(0,7)+'-01');dateKey(date).slice(0,7)<=data.end.slice(0,7);date.setMonth(date.getMonth()+1)) months.push(dateKey(date).slice(0,7));
  const byDate = new Map(data.entries.map(entry=>[entry.date,entry]));
  let month = months.includes(today().slice(0,7)) ? today().slice(0,7) : today()<data.start ? months[0] : months[months.length-1];
  let selected = today().startsWith(month) ? today() : month+'-01';
  let filter='all', view='calendar';
  let selectedBirthday='';
  let container;
  const birthdayKey = person => JSON.stringify([person.full_name,person.month,person.day]);
  const birthdayMembers = () => window.CodeWikiBirthdays?.getMembers?.()||[];
  const birthdaysFor = key => (filter==='all'||filter==='birthday') ? window.CodeWikiBirthdays?.forDate(key)||[] : [];
  const birthdayBadges = key => birthdaysFor(key).map(b=>`<span class="schedule-birthday">🎂 ${esc(b.full_name)} 생일</span>`).join('');
  const matches = entry => Boolean(entry && (filter==='all' || entry.kind===filter));
  const monthEntries = () => data.entries.filter(entry=>entry.date.startsWith(month) && matches(entry));
  const phaseFor = entry => data.phases.find(phase=>phase.id===entry?.phaseId);
  const fullDate = key => `${key.replaceAll('-','.')} (${weekdays[localDate(key).getDay()]})`;
  const monthTitle = key => `${key.slice(0,4)}년 ${Number(key.slice(5))}월`;
  function birthdayDate(person) {
    const suffix=`${String(person.month).padStart(2,'0')}-${String(person.day).padStart(2,'0')}`;
    const valid=key=>dateKey(localDate(key))===key;
    const candidates=months.filter(m=>Number(m.slice(5))===person.month).map(m=>`${m}-${String(person.day).padStart(2,'0')}`).filter(valid);
    const inRange=candidates.find(key=>key.slice(0,4)===month.slice(0,4))||candidates[0];
    if(inRange) return inRange;
    // Birthdays outside the course months remain reachable; leap days use the next leap year.
    let year=Number(month.slice(0,4));
    while(!valid(`${year}-${suffix}`)) year++;
    return `${year}-${suffix}`;
  }
  function includeMonth(target) {
    const start=target<months[0]?target:months[0];
    const end=target>months[months.length-1]?target:months[months.length-1];
    months.length=0;
    for(let date=localDate(start+'-01');dateKey(date).slice(0,7)<=end;date.setMonth(date.getMonth()+1)) months.push(dateKey(date).slice(0,7));
  }
  function monthCells(key) {
    const first=localDate(key+'-01');
    const count=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
    const size=Math.ceil((first.getDay()+count)/7)*7;
    return Array.from({length:size},(_,i)=>{
      const day=i-first.getDay()+1;
      return day<1 || day>count ? null : `${key}-${String(day).padStart(2,'0')}`;
    });
  }
  function dayButton(key) {
    if (!key) return '<div class="schedule-day empty" aria-hidden="true"></div>';
    const entry=byDate.get(key), visible=matches(entry), day=localDate(key).getDay();
    const heading=(entry ? entry.title : day===0 || day===6 ? '주말' : '등록 일정 없음')+birthdaysFor(key).map(b=>' · '+b.full_name+' 생일').join('');
    const badge=visible ? `<span class="schedule-event kind-${entry.kind}">${esc(entry.title)}</span>${entry.milestones.map(m=>`<span class="schedule-milestone">${esc(m)}</span>`).join('')}` : '';
    return `<button type="button" class="schedule-day ${selected===key?'selected':''} ${today()===key?'today':''} ${day===0?'sunday':day===6?'saturday':''}" data-calendar-day="${key}" aria-pressed="${selected===key}" aria-label="${esc(fullDate(key)+' · '+heading+(entry?.milestones.length?' · '+entry.milestones.join(', '):''))}" ${today()===key?'aria-current="date"':''}>
      <span class="schedule-date-number">${Number(key.slice(-2))}${today()===key?'<small>오늘</small>':''}</span>${badge}${birthdayBadges(key)}</button>`;
  }
  function detail() {
    if(filter==='birthday') return birthdayDirectory();
    const entry=byDate.get(selected), phase=phaseFor(entry);
    const hasLesson=Boolean(window.WIKI_DOCS['lesson-'+selected]);
    return `<section class="schedule-detail" aria-labelledby="scheduleDetailTitle" aria-live="polite">
      <p class="schedule-eyebrow">선택한 날짜</p><h2 id="scheduleDetailTitle">${fullDate(selected)}</h2>
      ${!matches(entry) ? `<p class="schedule-empty">${entry?'선택한 분류의 일정이 없습니다.':selected<data.start||selected>data.end?'교육기간 밖의 날짜입니다.':[0,6].includes(localDate(selected).getDay())?'주말 · 등록된 교육 일정이 없습니다.':'등록된 교육 일정이 없습니다.'}</p>` : `
        <span class="schedule-kind kind-${entry.kind}">${labels[entry.kind]}</span><h3>${esc(entry.title)}</h3>
        <dl><dt>시간</dt><dd>${entry.kind==='holiday'?'수업 없음':data.hours}</dd>
        ${phase?`<dt>교육 단계</dt><dd>${esc(phase.name)}</dd>`:''}<dt>교육 주차</dt><dd>${entry.week}주차</dd></dl>
        ${entry.isBreak?'<p>BREAK · 수업 없는 날</p>':''}${entry.holiday?`<p>${esc(entry.holiday)} · 원본 휴강 일정</p>`:''}
        ${entry.milestones.length?`<div class="schedule-detail-milestones">${entry.milestones.map(m=>`<p>${esc(m)}</p>`).join('')}</div>`:''}
        ${phase&&entry.kind!=='holiday'?`<div class="schedule-phase-note"><strong>${esc(phase.name)} 주요 학습 내용</strong><p>${esc(phase.description)}</p></div>`:''}
        ${hasLesson?`<a class="schedule-note-link" href="#doc/lesson-${selected}" data-schedule-doc="lesson-${selected}">이날 수업 필기 보기 →</a>`:''}
        `}
      ${birthdaysFor(selected).length?`<div class="schedule-birthday-detail"><h3>우리 반 생일</h3>${birthdaysFor(selected).map(b=>`<p>🎂 ${esc(b.full_name)} · ${Number(selected.slice(5,7))}월 ${Number(selected.slice(8))}일</p>`).join('')}</div>`:''}
    </section>`;
  }
  function birthdayDirectory() {
    const people=birthdayMembers();
    const person=people.find(p=>birthdayKey(p)===selectedBirthday);
    const status=window.CodeWikiBirthdays?.getStatus();
    return `<section class="schedule-detail birthday-directory" aria-labelledby="birthdayDirectoryTitle">
      <p class="schedule-eyebrow">가나다순 · ${people.length}명</p><h2 id="birthdayDirectoryTitle">우리 반 생일</h2>
      ${people.length?`<div class="birthday-member-list" role="group" aria-label="반 회원 이름">${people.map((p,i)=>`<button type="button" data-birthday-member="${i}" aria-pressed="${birthdayKey(p)===selectedBirthday}" aria-controls="birthdayMemberDetail">${esc(p.full_name)}</button>`).join('')}</div>`:
        `<p class="birthday-directory-empty">${status==='loading'?'이름을 불러오는 중…':status==='error'?'이름을 불러오지 못했습니다. 아래의 다시 시도를 눌러 주세요.':'공개된 생일이 아직 없습니다.'}</p>`}
      <div id="birthdayMemberDetail" class="birthday-member-detail" aria-live="polite">${person?`<strong>${esc(person.full_name)}</strong><p>🎂 ${person.month}월 ${person.day}일</p>`:people.length?'<p>이름을 선택하면 생일이 표시됩니다.</p>':''}</div>
    </section>`;
  }
  function render() {
    const entries=monthEntries(), index=months.indexOf(month);
    const listDates=monthCells(month).filter(key=>key && (matches(byDate.get(key)) || birthdaysFor(key).length));
    const active=entries.filter(e=>e.kind!=='holiday').length, off=entries.filter(e=>e.kind==='holiday').length;
    container.innerHTML=`<header class="schedule-header"><div><p class="schedule-eyebrow">SAP CODE 아카데미 2기</p><h1 class="article-main-title">교육 일정</h1><p>${data.start.replaceAll('-','.')} – ${data.end.replaceAll('-','.')} <span>월–금 ${data.hours}</span></p></div><div class="schedule-header-actions"><span class="schedule-revision">${data.revision.replaceAll('-','.')} 기준</span><div class="schedule-view-controls" role="group" aria-label="일정 보기 방식"><button type="button" data-schedule-view="calendar" aria-pressed="${view==='calendar'}">달력</button><button type="button" data-schedule-view="list" aria-pressed="${view==='list'}">목록</button></div></div></header>
      <div class="schedule-controls"><button type="button" id="scheduleToday" ${!months.includes(today().slice(0,7))?'disabled title="오늘은 교육기간 밖입니다."':''}>오늘</button><div class="schedule-month-controls"><button type="button" data-month-step="-1" aria-label="이전 달" ${index===0?'disabled':''}>‹</button><label class="visually-hidden" for="scheduleMonth">월 선택</label><select id="scheduleMonth">${months.map(m=>`<option value="${m}" ${m===month?'selected':''}>${monthTitle(m)}</option>`).join('')}</select><button type="button" data-month-step="1" aria-label="다음 달" ${index===months.length-1?'disabled':''}>›</button></div>
      <div class="schedule-view-controls"><label class="visually-hidden" for="scheduleFilter">일정 분류</label><select id="scheduleFilter"><option value="all">전체 일정</option>${Object.entries(labels).map(([key,label])=>`<option value="${key}" ${filter===key?'selected':''}>${label}</option>`).join('')}<option value="birthday" ${filter==='birthday'?'selected':''}>우리 반 생일</option></select></div></div>
      <div class="schedule-month-meta"><p id="scheduleMonthSummary" aria-live="polite">${monthTitle(month)} · 교육 ${active}일 · 휴강 ${off}일${filter!=='all'?' · '+(filter==='birthday'?'우리 반 생일':labels[filter]):''}</p><div class="schedule-legend" aria-label="일정 색상 범례">${Object.entries(labels).map(([key,label])=>`<span><i class="kind-${key}" aria-hidden="true"></i>${label}</span>`).join('')}</div></div>
      <div class="schedule-layout"><div class="schedule-main">
        ${view==='calendar'?`<div class="schedule-calendar" role="group" aria-label="${monthTitle(month)} 교육 일정"><div class="schedule-weekdays">${weekdays.map(d=>`<span>${d}</span>`).join('')}</div><div class="schedule-grid">${monthCells(month).map(dayButton).join('')}</div></div>`:
          `<div class="schedule-list">${listDates.length?listDates.map(key=>{const e=byDate.get(key);return `<button type="button" class="schedule-list-item ${selected===key?'selected':''}" data-calendar-day="${key}" aria-pressed="${selected===key}"><span>${fullDate(key)}</span><span>${matches(e)?`<span class="schedule-event kind-${e.kind}">${esc(e.title)}</span>`:''}${birthdayBadges(key)}</span><span>${matches(e)?esc(e.milestones.join(' · ')):''}</span></button>`}).join(''):'<p class="schedule-empty">이번 달에는 선택한 분류의 일정이 없습니다.</p>'}</div>`}
        ${view==='calendar'&&!listDates.length?'<p class="schedule-empty">이번 달에는 선택한 분류의 일정이 없습니다.</p>':''}
      </div>${detail()}</div>
      <details class="schedule-overview"><summary>전체 과정과 주요 일정</summary><div class="schedule-phase-grid">${data.phases.map(p=>`<section><h3>${esc(p.name)}</h3><p class="schedule-phase-period">${esc(p.period)}</p><p>${esc(p.description)}</p></section>`).join('')}</div><h2>주요 일정</h2><div class="schedule-key-dates">${data.milestones.map(m=>`<button type="button" data-schedule-jump="${m.date}"><time>${m.date.replaceAll('-','.')}</time><span>${esc(m.title)}</span></button>`).join('')}</div></details>
      <p class="schedule-birthday-status">${window.CodeWikiBirthdays?.getStatus()==='error'?'반 생일을 불러오지 못했습니다. <button type="button" id="retryBirthdays" class="toss-chip-btn">다시 시도</button>':window.CodeWikiBirthdays?.getStatus()==='loading'?'반 생일을 불러오는 중…':'생일은 공개를 선택한 같은 반 회원만 표시됩니다.'}</p>
      <footer class="schedule-footer"><p>${esc(data.note)}</p></footer>`;
    container.querySelector('#retryBirthdays')?.addEventListener('click',()=>window.CodeWikiBirthdays?.refresh());
    container.querySelectorAll('[data-birthday-member]').forEach(b=>b.addEventListener('click',()=>{
      const person=birthdayMembers()[Number(b.dataset.birthdayMember)];
      if(!person) return;
      selectedBirthday=birthdayKey(person);
      selected=birthdayDate(person);month=selected.slice(0,7);includeMonth(month);view='calendar';render();
      const day=container.querySelector(`[data-calendar-day="${selected}"]`);
      day?.focus();day?.scrollIntoView?.({block:'nearest',inline:'nearest'});
    }));
    container.querySelectorAll('[data-month-step]').forEach(b=>b.addEventListener('click',()=>changeMonth(months[index+Number(b.dataset.monthStep)])));
    container.querySelector('#scheduleMonth').addEventListener('change',e=>changeMonth(e.target.value));
    container.querySelector('#scheduleFilter').addEventListener('change',e=>{filter=e.target.value;selected=(filter==='birthday'?monthCells(month).find(key=>key&&birthdaysFor(key).length):monthEntries()[0]?.date)||month+'-01';render();container.querySelector('#scheduleFilter').focus();});
    container.querySelector('#scheduleToday').addEventListener('click',()=>{month=today().slice(0,7);selected=today();filter='all';render();container.querySelector('#scheduleToday').focus();});
    container.querySelectorAll('[data-schedule-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.scheduleView;render();container.querySelector(`[data-schedule-view="${view}"]`).focus();}));
    container.querySelectorAll('[data-calendar-day]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.calendarDay;render();container.querySelector(`[data-calendar-day="${selected}"]`)?.focus();}));
    container.querySelectorAll('[data-schedule-jump]').forEach(b=>b.addEventListener('click',()=>{month=b.dataset.scheduleJump.slice(0,7);selected=b.dataset.scheduleJump;filter='all';render();container.querySelector(`[data-calendar-day="${selected}"]`)?.focus();container.scrollIntoView({behavior:'smooth',block:'start'});}));
    container.querySelectorAll('[data-schedule-doc]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();window.CodeWikiApp.openDoc(a.dataset.scheduleDoc);}));
  }
  function changeMonth(next) { if(!months.includes(next))return;month=next;selected=monthEntries()[0]?.date||month+'-01';render();container.querySelector('#scheduleMonth').focus(); }
  window.addEventListener('cw-birthdays-change',()=>{if(container?.querySelector('#scheduleMonth'))render();});
  window.CodeWikiSchedule={render(target){container=target;render();},monthCells,months};
  window.WIKI_DOCS['education-schedule']={id:'education-schedule',track:'abap',title:'교육 일정',subtitle:data.period,summary:'수업·평가·프로젝트·휴강을 월별로 확인합니다.',aliases:['교육 일정','캘린더'],isCalendar:true,sections:[],tcodes:[],specs:{}};
})();
