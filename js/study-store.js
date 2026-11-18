/* Private draft persistence and serialized, revision-checked server writes. */
(() => {
  function create({rpc,storage,owner,token,onChange=()=>{},requestTimeout=15000}) {
    const isConflict=error=>error?.code==='PT409'||error?.code==='40001';
    const key='codewiki_study_draft_v1:'+owner;
    let current=null,dirty=false,alive=true,pending=null,saving=false,sequence=0,status='',cacheFailed=false;
    const emit=()=>{if(alive)onChange();};
    const persist=()=>{
      try {if(current&&dirty)storage.setItem(key,JSON.stringify(current));else storage.removeItem(key);cacheFailed=false;}
      catch {cacheFailed=true;}
    };
    async function call(name,args={}) {
      const controller=new AbortController();let timer;
      try {
        const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{
          reject(Object.assign(new Error('request-timeout'),{code:'TIMEOUT'}));controller.abort();
        },requestTimeout);});
        const request=rpc(name,{p_token:token,...args});
        const result=await Promise.race([typeof request?.abortSignal==='function'?request.abortSignal(controller.signal):request,timeout]);
        if(result.error)throw result.error;return result.data;
      } finally {clearTimeout(timer);}
    }
    function restore() {
      try {
        const d=JSON.parse(storage.getItem(key)||'null');
        if(d&&/^[a-f0-9-]{36}$/i.test(d.id)&&typeof d.title==='string'&&d.title.length<=120&&typeof d.body==='string'&&d.body.length<=200000&&Number.isInteger(d.revision)&&d.revision>=0){current=d;dirty=true;status='이 브라우저의 미저장 필기를 복원했습니다.';}
      } catch {status='임시 필기를 복원하지 못했습니다.';}
    }
    function edit(title,body) {if(!alive||!current||(current.title===title&&current.body===body&&current.revision>0))return;current={...current,title,body};sequence++;dirty=true;status='저장 대기';persist();emit();}
    function select(note) {current=note?{...note}:null;dirty=false;sequence++;status='';persist();emit();}
    async function drain() {
      while(alive&&dirty&&current) {
        const snapshot={...current}, seq=sequence;
        status='저장 중…';emit();
        try {
          const title=snapshot.title.trim()||'제목 없는 노트';
          let data;
          try {data=await call('cw_save_study_note',{p_id:snapshot.id,p_title:title,p_body:snapshot.body,p_revision:snapshot.revision});}
          catch(error){
            // A timed-out response may have committed. Accept only an exact,
            // owner-scoped readback; never overwrite a different server revision.
            if(!isConflict(error))throw error;
            data=await call('cw_get_study_note',{p_id:snapshot.id});
            if(!data||data.title!==title||data.body!==snapshot.body||!Number.isInteger(data.revision)||data.revision<=snapshot.revision)throw error;
          }
          if(!alive)return false;
          current={...current,revision:data.revision,updated_at:data.updated_at||current.updated_at};
          if(sequence===seq){current.title=data.title;dirty=false;status='저장됨';}
          persist();emit();
        } catch(error) {
          if(alive){status=error.code==='TIMEOUT'?'저장 응답이 지연됩니다. 작성 내용은 유지됩니다. 다시 저장해 주세요.':isConflict(error)?'다른 창의 수정 내용이 있습니다. 내려받기로 현재 글을 보관한 뒤 서버 글을 불러오세요.':error.code==='42501'?'로그인이 만료되었습니다. 다시 로그인하면 임시 필기를 복원합니다.':'저장하지 못했습니다. 연결을 확인한 뒤 다시 저장해 주세요.';persist();emit();}
          return false;
        }
      }
      return alive;
    }
    function save() {
      if(pending)return pending;
      if(!alive)return Promise.resolve(false);
      if(!dirty||!current)return Promise.resolve(true);
      saving=true;
      pending=drain().finally(()=>{pending=null;saving=false;emit();});return pending;
    }
    restore();
    return {get current(){return current;},get dirty(){return dirty;},get busy(){return saving;},
      get status(){return cacheFailed?'브라우저 임시 저장을 사용할 수 없습니다. 저장하거나 내려받아 주세요.':status;},
      edit,select,save,call,dispose(){alive=false;},get alive(){return alive;}};
  }
  window.CodeWikiStudyStore={create};
})();
