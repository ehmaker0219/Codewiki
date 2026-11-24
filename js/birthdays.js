(() => {
  let session=null, rows=[], status='idle', requestVersion=0, pending=null, controller=null;
  let classes=[], selectedClass='6반';
  const emit=()=>window.dispatchEvent(new Event('cw-birthdays-change'));
  const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
  function validDate(value) {
    if(!value) return true;
    const d=new Date(value+'T12:00:00Z');
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===value && value>='1900-01-01' && value<=today();
  }
  function refresh({ force = false } = {}) {
    const s=session;
    if(!s) return Promise.resolve();
    if(pending && !force)return pending;
    if(force) controller?.abort();
    const version=++requestVersion;
    rows=[];status='loading'; emit();
    const abort=new AbortController();controller=abort;
    const task=(async()=>{
    let timer;
    try {
      const name=s.role==='admin'?'cw_admin_student_directory':'cw_list_birthdays';
      const request=window.CodeWikiAuth.getSupabaseClient().rpc(name,{p_token:s.token});
      const result=await Promise.race([typeof request.abortSignal==='function'?request.abortSignal(abort.signal):request,
        new Promise((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('timeout'));},15000);})]);
      if(session!==s||version!==requestVersion) return;
      if(result.error) throw result.error;
      if(!Array.isArray(result.data))throw Error('invalid-response');
      let people=result.data;
      if(s.role==='admin'){
        // This existing RPC enforces administrator authorization on the server.
        people=people.filter(r=>r.status==='approved');
        classes=[...new Set(people.map(r=>r.class_name||'기본반'))].sort((a,b)=>a.localeCompare(b,'ko',{numeric:true}));
        if(!classes.includes(selectedClass))selectedClass=classes.includes('6반')?'6반':classes[0]||'6반';
        people=people.filter(r=>r.birth_date&&validDate(r.birth_date)).map(r=>({full_name:r.full_name,month:Number(r.birth_date.slice(5,7)),day:Number(r.birth_date.slice(8,10)),class_name:r.class_name||'기본반'}));
      }
      // Whitelist public fields even if the server response ever gains extra fields.
      rows=people.filter(r=>typeof r.full_name==='string' && Number.isInteger(r.month) && r.month>=1 && r.month<=12 && Number.isInteger(r.day) && r.day>=1 && r.day<=new Date(Date.UTC(2000,r.month,0)).getUTCDate())
        .map(r=>({full_name:r.full_name,month:r.month,day:r.day,...(s.role==='admin'?{class_name:r.class_name}:{})}));
      status='ready';
    } catch { if(session===s&&version===requestVersion) {rows=[];status='error';} }
    finally{clearTimeout(timer);if(session===s&&version===requestVersion){pending=null;controller=null;emit();}}
    })();pending=task;void task.finally(()=>{if(pending===task)pending=null;});return task;
  }
  function setUser(user) {
    const token=window.CodeWikiAuth?.getSessionToken()||'';
    const approved=user && (user.status==='approved'||user.role==='admin');
    if(approved && session?.id===user.id && session.token===token && session.role===user.role && session.className===user.class_name) return;
    controller?.abort();requestVersion++;pending=null;controller=null;
    session=approved&&token?{id:user.id,token,role:user.role,className:user.class_name}:null;
    rows=[];classes=[];selectedClass='6반';status='idle';
    emit();
    if(session) void refresh();
  }
  const publicRows=()=>rows.filter(r=>session?.role!=='admin'||r.class_name===selectedClass).map(({full_name,month,day})=>({full_name,month,day}));
  window.CodeWikiBirthdays={setUser,refresh,validDate,today,
    getMembers:()=>publicRows().sort((a,b)=>a.full_name.localeCompare(b.full_name,'ko')||a.month-b.month||a.day-b.day),
    forDate:key=>publicRows().filter(r=>r.month===Number(key.slice(5,7))&&r.day===Number(key.slice(8,10))),
    getClasses:()=>classes.slice(),getClassName:()=>session?.role==='admin'?selectedClass:session?.className||'',
    setClass:name=>{if(session?.role==='admin'&&classes.includes(name)&&name!==selectedClass){selectedClass=name;emit();}},
    getStatus:()=>status};
  window.addEventListener('storage',e=>{if((e.key===null||e.key==='codewiki_supa_token_v1')&&session&&e.newValue!==session.token)setUser(null);});
})();
