/* Private draft persistence and serialized, revision-checked server writes. */
(() => {
  function resolveTabId(explicit) {
    if (explicit !== undefined) return explicit;
    try {
      const ss = globalThis.sessionStorage;
      if (!ss) return null;
      const storageKey = 'codewiki_study_tab_v1';
      let id = ss.getItem(storageKey);
      if (!id) {
        id = globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
        ss.setItem(storageKey, id);
      }
      return id;
    } catch { return null; }
  }
  function create({rpc,storage,owner,token,onChange=()=>{},requestTimeout=15000,tabId}) {
    const isConflict=error=>error?.code==='PT409'||error?.code==='40001';
    const key='codewiki_study_draft_v1:'+owner;
    const myTab=resolveTabId(tabId);
    const conflictMessage='서버에 다른 버전이 있습니다. 현재 글로 저장하면 서버 글을 바꿉니다.';
    let current=null,dirty=false,alive=true,pending=null,saving=false,conflicted=false,sequence=0,inFlightSeq=-1,queued=false,status='',cacheFailed=false;
    // Drafts are stored per note in one owner-scoped slot tagged by tabId.
    // A tab only removes the draft it wrote itself, so opening or saving a note
    // in another tab never deletes or overwrites a different tab's unsaved draft.
    let ownedId=null;
    const emit=()=>{if(alive)onChange();};
    const validDraft=d=>d&&/^[a-f0-9-]{36}$/i.test(d.id)&&typeof d.title==='string'&&d.title.length<=120&&typeof d.body==='string'&&d.body.length<=200000&&Number.isInteger(d.revision)&&d.revision>=0;
    const isOwnDraft=d=>!d?.ownerTab||!myTab||d.ownerTab===myTab;
    function readDrafts() {
      let raw=null;
      try {raw=JSON.parse(storage.getItem(key)||'null');} catch {return {};}
      if(!raw||typeof raw!=='object')return {};
      if(raw.v===2&&raw.drafts&&typeof raw.drafts==='object')return {...raw.drafts};
      return validDraft(raw)?{[raw.id]:raw}:{}; // legacy single-draft format
    }
    const persist=()=>{
      try {
        const drafts=readDrafts();
        if(current&&dirty){
          if(ownedId&&ownedId!==current.id&&isOwnDraft(drafts[ownedId]))delete drafts[ownedId];
          drafts[current.id]={...current,saveConflict:conflicted,savedAt:Date.now(),...(myTab?{ownerTab:myTab}:{})};
          ownedId=current.id;
        } else if(ownedId){
          if(isOwnDraft(drafts[ownedId]))delete drafts[ownedId];
          ownedId=null;
        } else {cacheFailed=false;return;}
        if(Object.keys(drafts).length)storage.setItem(key,JSON.stringify({v:2,drafts}));else storage.removeItem(key);
        cacheFailed=false;
      }
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
    function applyRestoredDraft(rawDraft) {
      const d={...rawDraft};
      const own=isOwnDraft(d);
      conflicted=d.saveConflict===true;delete d.saveConflict;delete d.savedAt;delete d.ownerTab;
      current=d;dirty=true;ownedId=own?d.id:null;
      status=conflicted?conflictMessage:'이 브라우저의 미저장 필기를 복원했습니다.';
    }
    function restore() {
      try {
        const drafts=Object.values(readDrafts()).filter(validDraft);
        if(!drafts.length)return;
        const ownDrafts=myTab?drafts.filter(d=>!d.ownerTab||d.ownerTab===myTab):drafts;
        if(!ownDrafts.length)return;
        const latest=ownDrafts.reduce((a,b)=>(Number(b.savedAt)||0)>(Number(a.savedAt)||0)?b:a);
        applyRestoredDraft(latest);
      } catch {status='임시 필기를 복원하지 못했습니다.';}
    }
    function getDraft(id) {
      if(!id)return null;
      const d=readDrafts()[id];
      return validDraft(d)&&isOwnDraft(d)?d:null;
    }
    function restoreDraft(id) {
      if(saving)return false;
      const d=getDraft(id);
      if(!d)return false;
      applyRestoredDraft(d);
      sequence++;
      emit();
      return true;
    }
    function edit(title,body) {if(!alive||!current||(current.title===title&&current.body===body&&current.revision>0))return;current={...current,title,body};sequence++;dirty=true;status=conflicted?conflictMessage:'저장 대기';persist();emit();}
    function select(note) {if(saving)return false;current=note?{...note}:null;dirty=false;conflicted=false;sequence++;status='';persist();emit();return true;}
    async function drain(overrideRevision=null) {
      let nextOverride=overrideRevision;
      do {
        queued=false;
        if(alive&&dirty&&current) {
          const snapshot={...current}, seq=sequence;
          const baseRevision=nextOverride!==null?nextOverride:snapshot.revision;
          const resolving=nextOverride!==null;
          nextOverride=null;
          inFlightSeq=seq;
          status='저장 중…';emit();
          try {
            const title=snapshot.title.trim()||'제목 없는 노트';
            let data;
            try {data=await call('cw_save_study_note',{p_id:snapshot.id,p_title:title,p_body:snapshot.body,p_revision:baseRevision});}
            catch(error){
              // A timed-out response may have committed. Accept only an exact,
              // owner-scoped readback; never overwrite a different server revision.
              if(!isConflict(error))throw error;
              try {data=await call('cw_get_study_note',{p_id:snapshot.id});}
              catch {throw error;}
              if(!data||data.title!==title||data.body!==snapshot.body||!Number.isInteger(data.revision)||data.revision<=baseRevision)throw error;
            }
            if(!alive)return false;
            if(!data||!Number.isInteger(data.revision)||data.revision<=baseRevision)throw Object.assign(new Error('invalid-save-response'),{code:'INVALID_RESPONSE'});
            conflicted=false;
            current={...current,revision:data.revision,updated_at:data.updated_at||current.updated_at};
            if(sequence===seq){current.title=data.title;dirty=false;status='저장됨';}
            else status='저장 대기';
            persist();emit();
          } catch(error) {
            if(alive){
              conflicted=resolving||isConflict(error);
              status=isConflict(error)?conflictMessage:error.code==='TIMEOUT'?'저장 응답이 지연됩니다. 작성 내용은 유지됩니다. 다시 저장해 주세요.':error.code==='42501'?'로그인이 만료되었습니다. 다시 로그인하면 임시 필기를 복원합니다.':error.code==='22023'?'제목은 120자, 본문은 20만 자까지 저장할 수 있습니다.':error.code==='INVALID_RESPONSE'?'저장 결과를 확인하지 못했습니다. 작성 내용은 유지됩니다.':'저장하지 못했습니다. 작성 내용은 유지됩니다. 다시 시도해 주세요.';
              persist();emit();
            }
            return false;
          }
        }
      } while(queued&&alive&&dirty&&current&&!conflicted);
      return alive&&!dirty;
    }
    function save({resolveConflict=false}={}) {
      if(pending){
        if(alive&&!conflicted&&dirty&&sequence!==inFlightSeq)queued=true;
        return pending;
      }
      if(!alive)return Promise.resolve(false);
      if(conflicted&&!resolveConflict)return Promise.resolve(false);
      if(!dirty||!current)return Promise.resolve(true);
      saving=true;
      pending=(async()=>{
        let targetRevision=null;
        if(conflicted){
          // Explicit "save my version" only. Read the latest owner-scoped revision
          // once, then pass it as a local baseRevision without mutating current.revision
          // or clearing conflicted until cw_save_study_note actually succeeds.
          status='서버 버전 확인 중…';emit();
          try {
            const fresh=await call('cw_get_study_note',{p_id:current.id});
            if(!alive)return false;
            if(fresh&&(!Number.isInteger(fresh.revision)||fresh.revision<1))throw new Error('invalid-revision');
            targetRevision=fresh?.revision||0;
          } catch {
            if(alive){status='서버 버전을 확인하지 못했습니다. 현재 글은 유지됩니다.';persist();emit();}
            return false;
          }
        }
        return drain(targetRevision);
      })().finally(()=>{pending=null;saving=false;queued=false;inFlightSeq=-1;emit();});return pending;
    }
    restore();
    return {get current(){return current;},get dirty(){return dirty;},get busy(){return saving;},
      get status(){return cacheFailed?'브라우저 임시 저장을 사용할 수 없습니다. 저장하거나 내려받아 주세요.':status;},
      edit,select,save,call,getDraft,restoreDraft,dispose(){alive=false;},get conflicted(){return conflicted;},get alive(){return alive;}};
  }
  window.CodeWikiStudyStore={create};
})();
