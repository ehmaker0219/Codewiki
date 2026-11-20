/* Local-only reports. Blobs are kept separately so typing never rewrites attachments. */
(() => {
  let opening;
  function database(){
    if(!opening)opening=new Promise((resolve,reject)=>{
      const request=indexedDB.open('codewiki-mentoring-v1',1);let rejected=false;
      request.onupgradeneeded=()=>{
        request.result.createObjectStore('reports',{keyPath:['owner','id']});
        request.result.createObjectStore('files',{keyPath:['owner','report','id']});
      };
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>{rejected=true;reject(new Error('storage-blocked'));};
      request.onsuccess=()=>{const db=request.result;if(rejected){db.close();return;}db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
    }).catch(error=>{opening=null;throw error;});
    return opening;
  }
  function create(owner){
    if(!owner)throw Error('owner-required');
    async function transaction(mode,work){
      const db=await database();
      return new Promise((resolve,reject)=>{
        const tx=db.transaction(['reports','files'],mode);let result,error;
        tx.oncomplete=()=>resolve(result);
        tx.onabort=()=>reject(error||tx.error||new Error('storage-aborted'));
        tx.onerror=()=>{};
        const fail=cause=>{error=cause;tx.abort();};
        try{work(tx, value=>{result=value;},fail);}catch(e){fail(e);}
      });
    }
    return {
      list:()=>transaction('readonly',(tx,done)=>{
        const request=tx.objectStore('reports').getAll(IDBKeyRange.bound([owner,''],[owner,'\uffff']));
        request.onsuccess=()=>done(request.result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
      }),
      save:(report,files=[])=>transaction('readwrite',(tx,done,fail)=>{
        const reports=tx.objectStore('reports'),blobs=tx.objectStore('files');
        const request=reports.get([owner,report.id]);
        request.onsuccess=()=>{
          const previous=request.result;
          if((previous?.revision||0)!==report.revision){fail(new Error('conflict'));return;}
          const next={...report,owner,revision:report.revision+1,updatedAt:new Date().toISOString()};
          const ids=new Set(next.attachments.map(f=>f.id));
          for(const file of previous?.attachments||[])if(!ids.has(file.id))blobs.delete([owner,report.id,file.id]);
          for(const file of files)if(ids.has(file.id))blobs.put({owner,report:report.id,id:file.id,blob:file.blob});
          reports.put(next);done(next);
        };
      }),
      file:(report,id)=>transaction('readonly',(tx,done)=>{
        const request=tx.objectStore('files').get([owner,report,id]);request.onsuccess=()=>done(request.result?.blob||null);
      }),
      remove:report=>transaction('readwrite',(tx,done,fail)=>{
        const reports=tx.objectStore('reports'),request=reports.get([owner,report.id]);
        request.onsuccess=()=>{
          if(request.result?.revision!==report.revision){fail(new Error('conflict'));return;}
          for(const file of request.result.attachments)tx.objectStore('files').delete([owner,report.id,file.id]);
          reports.delete([owner,report.id]);done(true);
        };
      })
    };
  }
  window.CodeWikiMentoringStore={create};
})();
