/* Mentor-only local records. Retain the existing database and historical shared records. */
(() => {
  const model=window.CodeWikiMentoringModel;
  let opening;
  function database(){
    if(!opening)opening=new Promise((resolve,reject)=>{
      const request=indexedDB.open('codewiki-mentoring-team-v1',1);let rejected=false;
      request.onupgradeneeded=()=>{request.result.createObjectStore('team');request.result.createObjectStore('files');};
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>{rejected=true;reject(Error('storage-blocked'));};
      request.onsuccess=()=>{const db=request.result;if(rejected){db.close();return;}db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
    }).catch(error=>{opening=null;throw error;});
    return opening;
  }
  const fileKey=(activity,owner,id)=>`${activity}:${owner}:${id}`;
  function references(state){
    const refs=new Set();
    for(const a of state.activities)for(const f of a.attachments||[])refs.add(fileKey(a.id,model.members[0].id,f.id));
    for(const collection of [state.drafts,state.submissions])for(const item of Object.values(collection))for(const f of item.attachments)refs.add(fileKey(item.activity,item.owner,f.id));
    return refs;
  }
  async function transaction(mode,work){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['team','files'],mode);let result,error;
      tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(error||tx.error||Error('storage'));tx.onerror=()=>{};
      const fail=e=>{error=e;tx.abort();};
      try{work(tx,value=>{result=value;},fail);}catch(e){fail(e);}
    });
  }
  function create(actor){
    if(!model.member(actor))throw Error('forbidden');
    return {
      read:()=>transaction('readonly',(tx,done)=>{
        const req=tx.objectStore('team').get('group');req.onsuccess=()=>done(model.view(req.result||model.empty(),actor));
      }),
      execute:(command,uploads=[])=>transaction('readwrite',(tx,done,fail)=>{
        const table=tx.objectStore('team'),blobs=tx.objectStore('files'),req=table.get('group');
        req.onsuccess=()=>{
          try{
            const before=req.result||model.empty(),after=model.apply(before,actor,command),refs=references(after);
            if(uploads.length&&command.type!=='activity')throw Error('files');
            for(const f of uploads){
              const metadata=after.activities.find(a=>a.id===command.id)?.attachments.find(a=>a.id===f.id);
              if(!metadata||!(f.blob instanceof Blob)||metadata.size!==f.blob.size)throw Error('files');
              blobs.put(f.blob,fileKey(command.id,actor,f.id));
            }
            for(const ref of references(before))if(!refs.has(ref))blobs.delete(ref);
            table.put(after,'group');done(model.view(after,actor));
          }catch(e){fail(e);}
        };
      }),
      file:(activity,owner,id)=>transaction('readonly',(tx,done)=>{
        const req=tx.objectStore('team').get('group');req.onsuccess=()=>{
          const state=model.view(req.result||model.empty(),actor),k=model.key(activity,owner);
          const own=owner===actor?state.activities.find(a=>a.id===activity):null;
          if(![own,state.drafts[k],state.submissions[k]].some(s=>s?.attachments?.some(f=>f.id===id))){done(null);return;}
          const f=tx.objectStore('files').get(fileKey(activity,owner,id));f.onsuccess=()=>done(f.result||null);
        };
      })
    };
  }
  window.CodeWikiMentoringTeamStore={create};
})();
