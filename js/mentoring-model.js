/* Local prototype policy, not a replacement for server-side authorization. */
(() => {
  const members=Object.freeze([
    {id:'2eafc83d-09cd-4ea6-98a8-9bbb1ebdeb06',name:'이은호',role:'mentor'}
  ].map(Object.freeze));
  const states=Object.freeze({active:'진행 중',review:'정리 중',complete:'완료'});
  const member=id=>members.find(m=>m.id===id);
  const key=(activity,owner)=>activity+':'+owner;
  const empty=()=>({activities:[],drafts:{},submissions:{},feedback:{},comments:[]});
  function fail(message){throw new Error(message);}
  function text(value,max=100000){if(typeof value!=='string'||value.length>max)fail('invalid');return value;}
  function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail('invalid');return value;}
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
    const next=structuredClone(state),{type,id}=command;
    const activity=next.activities.find(a=>a.id===id);
    const mentor=()=>{if(actor.role!=='mentor')fail('forbidden');};
    if(type==='create'){
      mentor();if(!/^[\w-]{1,80}$/.test(id)||activity)fail('invalid');
      next.activities.unshift({id,title:'새 멘토링 활동',date:date(command.date),goals:'',task:'',result:'',code:'',attachments:[],summary:'',nextPlan:'',status:'active',revision:1,createdAt:now,updatedAt:now});
      return next;
    }
    if(!activity)fail('missing');
    if(type==='activity'){
      mentor();revision(activity,command.revision);
      const v=command.value;if(!Object.hasOwn(states,v.status))fail('invalid');date(v.date);
      const title=text(v.title,120).trim();if(!title)fail('title');
      Object.assign(activity,{title,date:v.date,status:v.status,goals:text(v.goals),task:text(v.task),result:text(v.result||''),code:text(v.code||''),attachments:files(v.attachments||[]),summary:text(v.summary),nextPlan:text(v.nextPlan),revision:activity.revision+1,updatedAt:now});
    }else if(type==='delete'){
      mentor();revision(activity,command.revision);next.activities=next.activities.filter(a=>a.id!==id);
      for(const collection of [next.drafts,next.submissions,next.feedback])for(const k of Object.keys(collection))if(collection[k].activity===id)delete collection[k];
      next.comments=next.comments.filter(c=>c.activity!==id);
    }else fail('invalid');
    return next;
  }
  function view(state,actorId){
    if(!member(actorId))fail('forbidden');
    const next=structuredClone(state);
    next.drafts=Object.fromEntries(Object.entries(next.drafts).filter(([,d])=>d.owner===actorId));
    return next;
  }
  window.CodeWikiMentoringModel={members,states,member,key,empty,apply,view};
})();
