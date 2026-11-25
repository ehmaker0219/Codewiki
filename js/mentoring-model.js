/* Local prototype policy, not a replacement for server-side authorization. */
(() => {
  const members=Object.freeze([
    {
      id:'2eafc83d-09cd-4ea6-98a8-9bbb1ebdeb06',
      name:'이은호',
      role:'mentor',
      group:'3조',
      participants:Object.freeze(['이은호','김성재','김은철','김지수']),
      legacyParticipants:Object.freeze(['이은호','김성재','김은철']),
      storageKey:'group'
    },
    {
      id:'9ed5fcaf-8785-4e3b-8050-ad94482a7068',
      name:'김태규',
      role:'mentor',
      group:'1조',
      participants:Object.freeze(['김태규','최영환','박찬규']),
      legacyParticipants:null,
      storageKey:'mentor:9ed5fcaf-8785-4e3b-8050-ad94482a7068'
    },
    {
      id:'0fd93ee1-9425-4094-8428-31237942091f',
      name:'이예진',
      role:'mentor',
      group:'2조',
      participants:Object.freeze(['이예진','김하임','이수현']),
      legacyParticipants:null,
      storageKey:'mentor:0fd93ee1-9425-4094-8428-31237942091f'
    }
  ].map(Object.freeze));
  const defaultTitle='1회차_N주차_6반_3조_이은호';
  const defaultParticipants=members[0].participants;
  const participantsSchemaVersion=2;
  const defaultLocation='CL6 강의장';
  const defaultStartTime='18:00';
  const defaultEndTime='20:00';
  const baseProcessSteps=Object.freeze([
    Object.freeze({id:'notice',label:'천승환 파트너님께 공지 및 구글시트 반영 확인'}),
    Object.freeze({id:'studyroom',label:'(스터디룸 사용 시 사전확인)'}),
    Object.freeze({id:'session',label:'(멘토링 진행)'}),
    Object.freeze({id:'report',label:'멘토링 종료 후 결과 보고서 작성'}),
    Object.freeze({id:'discord',label:'결과보고서 스레드에 양식과 함께 제출'}),
    Object.freeze({id:'sheet',label:'구글시트-{name}에 탭 추가 및 작성'})
  ]);
  const processStepIds=new Set(baseProcessSteps.map(s=>s.id));
  const weekdays=Object.freeze(['일','월','화','수','목','금','토']);
  const states=Object.freeze({active:'진행 중',review:'정리 중',complete:'완료'});
  const member=id=>members.find(m=>m.id===id);
  const resolveMentor=actorOrId=>{
    if(actorOrId&&typeof actorOrId==='object'&&actorOrId.id)return member(actorOrId.id)||actorOrId;
    if(typeof actorOrId==='string')return member(actorOrId)||members[0];
    return members[0];
  };
  const participantsFor=actorOrId=>[...(resolveMentor(actorOrId).participants||defaultParticipants)];
  const storageKeyFor=actorOrId=>{const m=resolveMentor(actorOrId);return m.storageKey||('mentor:'+m.id);};
  const processStepsFor=actorOrId=>{
    const name=resolveMentor(actorOrId).name;
    return baseProcessSteps.map(step=>Object.freeze({id:step.id,label:step.label.replace('{name}',name)}));
  };
  const processSteps=Object.freeze(processStepsFor(members[0]));
  const key=(activity,owner)=>activity+':'+owner;
  const empty=()=>({activities:[],folders:[],folderAssignments:{},checklists:{},drafts:{},submissions:{},feedback:{},comments:[]});
  function fail(message){throw new Error(message);}
  function ensureFolders(state){
    if(!Array.isArray(state.folders))state.folders=[];
    if(!state.folderAssignments||typeof state.folderAssignments!=='object'||Array.isArray(state.folderAssignments))state.folderAssignments={};
    if(!state.checklists||typeof state.checklists!=='object'||Array.isArray(state.checklists))state.checklists={};
    return state;
  }
  function text(value,max=100000){if(typeof value!=='string'||value.length>max)fail('invalid');return value;}
  function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail('invalid');return value;}
  const startTimes=Object.freeze(Array.from({length:29},(_,i)=>{const s=i+19;return `${String(Math.floor(s/2)).padStart(2,'0')}:${s%2?'30':'00'}`;}));
  const endTimes=Object.freeze([...startTimes.slice(1),'24:00']);
  function timeRange(startValue,endValue){
    const start=startValue==null?'':startValue,end=endValue==null?'':endValue;
    if(typeof start!=='string'||typeof end!=='string')fail('time');
    if(!start&&!end)return {startTime:'',endTime:''};
    if(!startTimes.includes(start)||!endTimes.includes(end)||start>=end)fail('time');
    return {startTime:start,endTime:end};
  }
  function normalizeParticipants(items,actorOrId){
    if(items===undefined)return participantsFor(actorOrId);
    if(!Array.isArray(items)||items.length>20)fail('invalid');
    const seen=new Set(),out=[];
    for(const item of items){
      const name=text(item,40).trim();
      if(!name||seen.has(name))continue;
      seen.add(name);out.push(name);
    }
    return out;
  }
  function nextRoundNumber(activities=[]){
    const list=Array.isArray(activities)?activities:[];
    let maxRound=0;
    for(const item of list){
      const match=/(\d+)\s*회차/.exec(String(item?.title||''));
      if(match){
        const n=Number(match[1]);
        if(Number.isSafeInteger(n)&&n>maxRound)maxRound=n;
      }
    }
    return Math.max(maxRound,list.length)+1;
  }
  function defaultTitleFor(activities=[],actorOrId){
    const m=resolveMentor(actorOrId);
    return `${nextRoundNumber(activities)}회차_N주차_6반_${m.group||'N조'}_${m.name}`;
  }
  function inferRound(activity,activities=[]){
    const fromTitle=/(\d+)\s*회차/.exec(String(activity?.title||''));
    if(fromTitle)return `${fromTitle[1]}회차`;
    const list=Array.isArray(activities)?activities:[];
    if(activity?.id&&list.length){
      const ordered=[...list].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
      const idx=ordered.findIndex(item=>item.id===activity.id);
      if(idx>=0)return `${idx+1}회차`;
    }
    return '1회차';
  }
  function pdfFileTitle(title){
    const clean=String(title??'').replace(/[\r\n\t]+/g,' ').trim();
    if(!clean)return '멘토링 활동 결과보고서';
    return clean.endsWith('멘토링 활동 결과보고서')?clean:`${clean} 멘토링 활동 결과보고서`;
  }
  function formatDiscordDate(isoDate){
    if(typeof isoDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(isoDate))return String(isoDate||'');
    const [,m,d]=isoDate.split('-');
    const parsed=new Date(isoDate+'T12:00:00Z');
    const dayName=Number.isNaN(parsed.getTime())?'':weekdays[parsed.getUTCDay()];
    return `${Number(m)}/${Number(d)}${dayName?`(${dayName})`:''}`;
  }
  function resolveParticipants(activity,actorOrId){
    const m=resolveMentor(actorOrId);
    const defaults=m.participants||defaultParticipants;
    const raw=activity?.participants;
    if(!Array.isArray(raw))return [...defaults];
    const legacy=m.legacyParticipants;
    if(legacy&&activity?.participantsVersion!==participantsSchemaVersion&&raw.length===legacy.length&&legacy.every((n,i)=>raw[i]===n)){
      return [...defaults];
    }
    return raw.filter(Boolean);
  }
  function formatDiscordTemplate(activity,activities=[],actorOrId){
    const m=resolveMentor(actorOrId);
    const round=inferRound(activity,activities);
    const datePart=formatDiscordDate(activity?.date);
    const timePart=activity?.startTime&&activity?.endTime?` ${activity.startTime} ~ ${activity.endTime}`:'';
    const people=resolveParticipants(activity,m);
    const location=typeof activity?.location==='string'?activity.location.trim():defaultLocation;
    const body=String(activity?.task||'').trim();
    const lines=[
      `[CL6 ${m.name} 멘토링 ${round}]`,
      '',
      `일시: ${datePart}${timePart}`,
      `참여 인원: ${people.length}명${people.length?` (${people.join(',')})`:''}`,
      `장소: ${location}`,
      '',
      '내용:',
      body
    ];
    return lines.join('\n');
  }
  function revision(old,expected){if((old?.revision||0)!==expected)fail('conflict');}
  function files(items){
    if(!Array.isArray(items)||items.length>10)fail('files');
    const seen=new Set();let total=0;
    return items.map(f=>{
      if(!/^[\w-]{1,80}$/.test(f.id)||seen.has(f.id)||!Number.isSafeInteger(f.size)||f.size<0||f.size>5*1024*1024)fail('files');
      seen.add(f.id);total+=f.size;if(total>20*1024*1024)fail('files');
      return {id:f.id,name:text(f.name,255),size:f.size,type:text(f.type,120)};
    });
  }
  function apply(state,actorId,command,now=new Date().toISOString()){
    const actor=member(actorId);if(!actor)fail('forbidden');
    const next=ensureFolders(structuredClone(state)),{type,id}=command;
    const mentor=()=>{if(actor.role!=='mentor')fail('forbidden');};
    if(type==='folder-save'){
      mentor();if(!/^[\w-]{1,80}$/.test(id))fail('invalid');
      const name=text(command.name,60).trim();if(!name)fail('folder-name');
      const norm=name.toLocaleLowerCase('ko');
      if(next.folders.some(f=>f.id!==id&&String(f.name||'').trim().toLocaleLowerCase('ko')===norm))fail('duplicate-folder');
      const folder=next.folders.find(f=>f.id===id);
      if(command.revision===0){
        if(folder)fail('conflict');
        next.folders.push({id,name,revision:1,createdAt:now,updatedAt:now});
      }else{
        if(!folder)fail('missing');
        revision(folder,command.revision);
        Object.assign(folder,{name,revision:folder.revision+1,updatedAt:now});
      }
      return next;
    }
    if(type==='folder-delete'){
      mentor();const folder=next.folders.find(f=>f.id===id);if(!folder)fail('missing');
      revision(folder,command.revision);
      next.folders=next.folders.filter(f=>f.id!==id);
      for(const [actId,fId] of Object.entries(next.folderAssignments))if(fId===id)delete next.folderAssignments[actId];
      return next;
    }
    const activity=next.activities.find(a=>a.id===id);
    if(type==='create'){
      mentor();if(!/^[\w-]{1,80}$/.test(id)||activity)fail('invalid');
      if(command.folderId!=null&&command.folderId!==''){
        if(typeof command.folderId!=='string')fail('invalid');
        if(next.folders.some(f=>f.id===command.folderId))next.folderAssignments[id]=command.folderId;
      }
      next.activities.unshift({id,title:defaultTitleFor(next.activities,actor),date:date(command.date),startTime:defaultStartTime,endTime:defaultEndTime,participants:participantsFor(actor),participantsVersion:participantsSchemaVersion,location:defaultLocation,goals:'',task:'',result:'',code:'',attachments:[],summary:'',nextPlan:'',status:'active',revision:1,createdAt:now,updatedAt:now});
      return next;
    }
    if(!activity)fail('missing');
    if(type==='folder-move'){
      mentor();
      const folderId=command.folderId==null?'':command.folderId;
      if(typeof folderId!=='string')fail('invalid');
      if(folderId){
        if(!next.folders.some(f=>f.id===folderId))fail('missing');
        next.folderAssignments[id]=folderId;
      }else delete next.folderAssignments[id];
      return next;
    }
    if(type==='checklist'){
      mentor();
      let source;
      if(typeof command.stepId==='string'){
        if(!processStepIds.has(command.stepId))fail('invalid');
        const current=new Set(Array.isArray(next.checklists[id])?next.checklists[id]:[]);
        if(command.value)current.add(command.stepId);else current.delete(command.stepId);
        source=baseProcessSteps.map(s=>s.id).filter(stepId=>current.has(stepId));
      }else{
        if(!Array.isArray(command.checked))fail('invalid');
        source=command.checked;
      }
      const seen=new Set(),cleaned=[];
      for(const stepId of source){
        if(typeof stepId!=='string'||!processStepIds.has(stepId))fail('invalid');
        if(!seen.has(stepId)){seen.add(stepId);cleaned.push(stepId);}
      }
      if(cleaned.length)next.checklists[id]=cleaned;
      else delete next.checklists[id];
      return next;
    }
    if(type==='activity'){
      mentor();revision(activity,command.revision);
      const v=command.value;
      const nextStatus=v.status==null||v.status===''?(activity.status||'active'):(Object.hasOwn(states,v.status)?v.status:fail('invalid'));
      date(v.date);
      const times=timeRange(v.startTime,v.endTime);
      const title=text(v.title,120).trim();if(!title)fail('title');
      const participants=normalizeParticipants(v.participants,actor);
      const location=text(v.location==null?defaultLocation:v.location,120).trim();
      Object.assign(activity,{title,date:v.date,startTime:times.startTime,endTime:times.endTime,participants,participantsVersion:participantsSchemaVersion,location,status:nextStatus,goals:text(v.goals||''),task:text(v.task),result:text(v.result||''),code:text(v.code||''),attachments:files(v.attachments||[]),summary:text(v.summary||''),nextPlan:text(v.nextPlan||''),revision:activity.revision+1,updatedAt:now});
    }else if(type==='delete'){
      mentor();revision(activity,command.revision);next.activities=next.activities.filter(a=>a.id!==id);
      delete next.folderAssignments[id];
      delete next.checklists[id];
      for(const collection of [next.drafts,next.submissions,next.feedback])for(const k of Object.keys(collection))if(collection[k].activity===id)delete collection[k];
      next.comments=next.comments.filter(c=>c.activity!==id);
    }else fail('invalid');
    return next;
  }
  function view(state,actorId){
    if(!member(actorId))fail('forbidden');
    const next=ensureFolders(structuredClone(state));
    next.drafts=Object.fromEntries(Object.entries(next.drafts).filter(([,d])=>d.owner===actorId));
    return next;
  }
  window.CodeWikiMentoringModel={members,defaultTitle,defaultTitleFor,defaultParticipants,participantsFor,storageKeyFor,defaultLocation,defaultStartTime,defaultEndTime,processSteps,processStepsFor,states,startTimes,endTimes,member,key,empty,apply,view,inferRound,pdfFileTitle,resolveParticipants,formatDiscordTemplate};
})();
