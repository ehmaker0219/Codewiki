/* Owner-scoped library metadata. Folder edits never save or replace note bodies. */
(() => {
  const esc=window.CodeWikiLearning.escape;
  const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
  const icon='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 5h6l2 3h10v12H3z" stroke-linejoin="round"/></svg>';
  function create({element,moveElement,listElement,call,getNote,getNotes,onChange}) {
    let folders=[],assignments=new Map(),filter='all',editing=null,ready=false,pending=false,alive=true,loading=null;
    let message='',markup='',moveMarkup='';
    let draggedNote=null,dragSource=null,dropTarget=null;
    const folderOf=id=>assignments.get(id)||'';
    const notify=()=>{if(alive){refresh();onChange();}};
    function refresh(){
      if(!alive)return;
      // Keep the typed folder name and focus when a background list/save refresh
      // re-renders the form; the name is otherwise only captured on submit.
      const input=editing?element.querySelector?.('#studyFolderName'):null;
      const hadFocus=Boolean(input)&&input===globalThis.document?.activeElement;
      if(input&&typeof input.value==='string')editing={...editing,name:input.value};
      const notes=getNotes(),counts=new Map();
      notes.forEach(n=>counts.set(folderOf(n.id),(counts.get(folderOf(n.id))||0)+1));
      const disabled=!ready||pending||Boolean(loading),selected=folders.find(f=>f.id===filter);
      const button=(id,name,count)=>`<button type="button" data-folder-filter="${esc(id)}" class="study-folder-link${filter===id?' active':''}" aria-pressed="${filter===id}" ${disabled?'disabled':''}>${icon}<span>${esc(name)}</span><small>${count}</small></button>`;
      const html=`<div class="study-folder-heading"><span>폴더</span><div><button type="button" data-folder-action="reload" aria-label="폴더 새로고침" title="폴더 새로고침" ${pending||loading?'disabled':''}>↻</button><button type="button" data-folder-action="new" ${disabled?'disabled':''}>+ 새 폴더</button></div></div>
        <nav aria-label="내 필기 폴더">${button('all','전체 필기',notes.length)}${button('','미분류',counts.get('')||0)}${[...folders].sort((a,b)=>collator.compare(a.name,b.name)).map(f=>button(f.id,f.name,counts.get(f.id)||0)).join('')}</nav>
        ${selected?`<div class="study-folder-actions"><button type="button" data-folder-action="rename" ${disabled?'disabled':''}>이름 변경</button><button type="button" data-folder-action="delete" ${disabled?'disabled':''}>폴더 삭제</button></div>`:''}
        ${editing?`<form class="study-folder-form"><label for="studyFolderName">${editing.revision?'폴더 이름 변경':'새 폴더 이름'}</label><input id="studyFolderName" maxlength="60" required value="${esc(editing.name)}" ${pending?'disabled':''}><div><button type="submit" ${pending?'disabled':''}>${pending?'저장 중…':'확인'}</button><button type="button" data-folder-action="cancel" ${pending?'disabled':''}>취소</button></div></form>`:''}
        <p class="study-folder-status" role="status">${esc(loading?'폴더 불러오는 중…':message)}</p>
        ${message?`<button type="button" data-folder-action="reload" ${pending||loading?'disabled':''}>폴더 다시 불러오기</button>`:''}`;
      if(markup!==html){
        element.innerHTML=html;markup=html;
        if(hadFocus){const next=element.querySelector?.('#studyFolderName');next?.focus();try{next?.setSelectionRange?.(next.value.length,next.value.length);}catch{}}
      }
      const note=getNote();
      const move=`<label for="studyMoveFolder">폴더</label><select id="studyMoveFolder" aria-label="메모를 폴더로 이동" ${disabled||!note?.revision?'disabled':''} title="${note?.revision?'선택한 폴더로 이동':'노트를 저장한 뒤 폴더를 선택하세요'}"><option value="">미분류</option>${[...folders].sort((a,b)=>collator.compare(a.name,b.name)).map(f=>`<option value="${esc(f.id)}" ${folderOf(note?.id)===f.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select>`;
      if(move!==moveMarkup){moveElement.innerHTML=move;moveMarkup=move;}
    }
    async function load(){
      if(!alive||pending)return;
      if(loading)return loading;
      loading=(async()=>{
        try{
          const data=await call('cw_get_study_folders');if(!alive)return;
          if(!Array.isArray(data?.folders)||!Array.isArray(data?.assignments))throw new Error('invalid-folder-list');
          folders=data.folders;assignments=new Map(data.assignments.map(a=>[a.note_id,a.folder_id]));ready=true;editing=null;message='';
          if(filter!=='all'&&!folders.some(f=>f.id===filter))filter='';
        }catch{if(alive)message='폴더를 불러오지 못했습니다. 다시 시도해 주세요.';}
        finally{loading=null;notify();}
      })();refresh();return loading;
    }
    async function mutate(action){
      if(!alive||!ready||pending||loading)return;
      pending=true;message='';refresh();
      try{await action();}
      catch(error){if(alive)message=error?.code==='23505'?'같은 이름의 폴더가 있습니다.':error?.code==='PT409'?'폴더나 메모가 변경되었습니다. 폴더를 다시 불러와 주세요.':'변경 결과를 확인하지 못했습니다. 폴더를 다시 불러온 뒤 시도해 주세요.';}
      finally{pending=false;notify();}
    }
    function click(e){
      const target=e.target.closest('[data-folder-filter],[data-folder-action]');if(!target||pending||loading)return;
      if(target.dataset.folderFilter!==undefined){filter=target.dataset.folderFilter;editing=null;message='';notify();return;}
      const action=target.dataset.folderAction;
      if(action==='reload'){void load();return;}
      if(!ready)return;
      if(action==='cancel'){editing=null;refresh();return;}
      if(action==='new'||action==='rename'){
        editing=action==='new'?{id:crypto.randomUUID(),name:'',revision:0}:{...folders.find(f=>f.id===filter)};
        message='';refresh();element.querySelector('#studyFolderName')?.focus();return;
      }
      if(action==='delete'){
        const folder=folders.find(f=>f.id===filter);if(!folder)return;
        if(!window.confirm(`‘${folder.name}’ 폴더를 삭제할까요? 안의 메모는 삭제되지 않고 미분류로 이동합니다.`))return;
        void mutate(async()=>{
          await call('cw_delete_study_folder',{p_id:folder.id,p_revision:folder.revision});if(!alive)return;
          folders=folders.filter(f=>f.id!==folder.id);assignments.forEach((id,note)=>{if(id===folder.id)assignments.delete(note);});
          filter='';editing=null;
        });
      }
    }
    function submit(e){
      e.preventDefault();if(!editing||pending||loading)return;
      const name=element.querySelector('#studyFolderName').value.trim();
      if(!name){message='폴더 이름을 입력해 주세요.';refresh();element.querySelector('#studyFolderName')?.focus();return;}
      if(name.length>60){message='폴더 이름은 60자 이하로 입력해 주세요.';refresh();return;}
      editing={...editing,name};const draft={...editing};
      void mutate(async()=>{
        const saved=await call('cw_save_study_folder',{p_id:draft.id,p_name:draft.name,p_revision:draft.revision});if(!alive)return;
        if(!saved?.id||!Number.isInteger(saved.revision))throw new Error('invalid-folder');
        folders=folders.filter(f=>f.id!==saved.id);folders.push(saved);filter=saved.id;editing=null;
      });
    }
    function moveNote(id,folder){
      if(!alive||pending||loading||!ready||!getNotes().some(n=>n.id===id))return;
      if(folder&&!folders.some(f=>f.id===folder))return;
      if((folder||'')===folderOf(id))return;
      // Reflect only confirmed server state, including after a failed move.
      moveMarkup='';
      void mutate(async()=>{
        const result=await call('cw_move_study_note',{p_note_id:id,p_folder_id:folder});if(!alive)return;
        if(result?.note_id!==id||result.folder_id!==folder)throw new Error('invalid-move');
        if(folder)assignments.set(id,folder);else assignments.delete(id);
      });
    }
    function move(e){
      const note=getNote();
      if(e.target.id==='studyMoveFolder'&&note?.revision)moveNote(note.id,e.target.value||null);
    }
    function clearTarget(){dropTarget?.classList.remove('drag-over');dropTarget=null;}
    function dragEnd(){clearTarget();dragSource?.classList.remove('dragging');dragSource=null;draggedNote=null;}
    function dragStart(e){
      dragEnd();
      const source=e.target.closest('[data-note]');
      if(!alive||!ready||pending||loading||!source||!e.dataTransfer||!getNotes().some(n=>n.id===source.dataset.note)){
        e.preventDefault();return;
      }
      draggedNote=source.dataset.note;dragSource=source;
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('application/x-codewiki-note',draggedNote);
      source.classList.add('dragging');
    }
    function targetFor(e){
      if(!alive||!draggedNote||!ready||pending||loading)return null;
      const target=e.target.closest('[data-folder-filter]'),id=target?.dataset.folderFilter;
      return target&&!target.disabled&&id!=='all'&&(id===''||folders.some(f=>f.id===id))&&id!==folderOf(draggedNote)?target:null;
    }
    function dragOver(e){
      const target=targetFor(e);
      if(target!==dropTarget){clearTarget();dropTarget=target;target?.classList.add('drag-over');}
      if(target){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';}
    }
    function dragLeave(e){if(dropTarget&&!dropTarget.contains(e.relatedTarget))clearTarget();}
    function drop(e){
      const target=targetFor(e),id=draggedNote,folder=target?.dataset.folderFilter||null;
      if(target)e.preventDefault();
      dragEnd();
      if(target)moveNote(id,folder);
    }
    element.addEventListener('click',click);element.addEventListener('submit',submit);moveElement.addEventListener('change',move);
    const dragEvents={dragover:dragOver,dragenter:dragOver,dragleave:dragLeave,drop};
    Object.entries(dragEvents).forEach(([name,fn])=>element.addEventListener(name,fn));
    listElement?.addEventListener('dragstart',dragStart);listElement?.addEventListener('dragend',dragEnd);
    refresh();
    return {load,refresh,includesNote:note=>filter==='all'||folderOf(note.id)===filter,
      dispose(){alive=false;dragEnd();element.removeEventListener('click',click);element.removeEventListener('submit',submit);moveElement.removeEventListener('change',move);
        Object.entries(dragEvents).forEach(([name,fn])=>element.removeEventListener(name,fn));
        listElement?.removeEventListener('dragstart',dragStart);listElement?.removeEventListener('dragend',dragEnd);}};
  }
  window.CodeWikiStudyFolders={create};
})();
