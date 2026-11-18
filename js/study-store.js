/* Private draft persistence and serialized, revision-checked server writes. */
(() => {
  function create({rpc,storage,owner,token,onChange=()=>{}}) {
    const key='codewiki_study_draft_v1:'+owner;
    let current=null,dirty=false,alive=true,pending=null,sequence=0,status='',cacheFailed=false;
    const emit=()=>{if(alive)onChange();};
    const persist=()=>{
      try {if(current&&dirty)storage.setItem(key,JSON.stringify(current));else storage.removeItem(key);cacheFailed=false;}
      catch {cacheFailed=true;}
    };
    async function call(name,args={}) {
      const result=await rpc(name,{p_token:token,...args});
      if(result.error)throw result.error;return result.data;
    }
    function restore() {
      try {
        const d=JSON.parse(storage.getItem(key)||'null');
        if(d&&/^[a-f0-9-]{36}$/i.test(d.id)&&typeof d.title==='string'&&d.title.length<=120&&typeof d.body==='string'&&d.body.length<=200000&&Number.isInteger(d.revision)&&d.revision>=0){current=d;dirty=true;status='이 브라우저의 미저장 필기를 복원했습니다.';}
      } catch {status='임시 필기를 복원하지 못했습니다.';}
    }
    function edit(title,body) {if(!alive||!current)return;current={...current,title,body};sequence++;dirty=true;status='저장 대기';persist();emit();}
    function select(note) {current=note?{...note}:null;dirty=false;sequence++;status='';persist();emit();}
    async function drain() {
      while(alive&&dirty&&current) {
        const snapshot={...current}, seq=sequence;
        status='저장 중…';emit();
        try {
          const data=await call('cw_save_study_note',{p_id:snapshot.id,p_title:snapshot.title.trim()||'제목 없는 노트',p_body:snapshot.body,p_revision:snapshot.revision});
          if(!alive)return false;
          current={...current,revision:data.revision,updated_at:data.updated_at};
          if(sequence===seq){current.title=data.title;dirty=false;status='저장됨';}
          persist();emit();
        } catch(error) {
          if(alive){status=error.code==='40001'?'다른 창의 수정 내용이 있습니다. 내려받기로 현재 글을 보관한 뒤 서버 글을 불러오세요.':error.code==='42501'?'로그인이 만료되었습니다. 다시 로그인하면 임시 필기를 복원합니다.':'저장하지 못했습니다. 연결을 확인한 뒤 다시 저장해 주세요.';persist();emit();}
          return false;
        }
      }
      return alive;
    }
    function save() {
      if(pending)return pending;
      if(!alive)return Promise.resolve(false);
      pending=drain().finally(()=>{pending=null;emit();});return pending;
    }
    restore();
    return {get current(){return current;},get dirty(){return dirty;},get busy(){return Boolean(pending);},
      get status(){return cacheFailed?'브라우저 임시 저장을 사용할 수 없습니다. 저장하거나 내려받아 주세요.':status;},
      edit,select,save,call,dispose(){alive=false;},get alive(){return alive;}};
  }
  window.CodeWikiStudyStore={create};
})();
