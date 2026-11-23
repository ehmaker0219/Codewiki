/* Read-only import of legacy reports. Keep the original records and attachments intact. */
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
    return {
      async list(){
        const db=await database();
        return new Promise((resolve,reject)=>{
          const tx=db.transaction('reports','readonly');
          const request=tx.objectStore('reports').getAll(IDBKeyRange.bound([owner,''],[owner,'\uffff']));
          tx.oncomplete=()=>resolve(request.result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
          tx.onabort=()=>reject(tx.error||new Error('storage-aborted'));
          tx.onerror=()=>{};
        });
      }
    };
  }
  window.CodeWikiMentoringStore={create};
})();
