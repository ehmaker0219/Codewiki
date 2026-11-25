const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

// Verify IndexedDB team store: onclose reconnection, file cleanup, legacy null-attachments safety and role enforcement.
const teamStore=new Map(),fileStore=new Map();
let opens=0,lastDb=null;
function makeDb(){
  const db={
    close(){this.onclose?.();},
    transaction(stores,mode){
      assert.deepEqual(Array.from(stores),['team','files']);
      const tx={
        error:null,
        objectStore(name){
          const map=name==='team'?teamStore:fileStore;
          return {
            get(k){
              const req={result:undefined};
              queueMicrotask(()=>{
                if(tx._aborted)return;
                req.result=map.has(k)?structuredClone(map.get(k)):undefined;
                req.onsuccess?.();
                queueMicrotask(()=>{if(!tx._aborted)tx.oncomplete?.();});
              });
              return req;
            },
            put(v,k){assert.equal(mode,'readwrite');map.set(k,v);},
            delete(k){assert.equal(mode,'readwrite');map.delete(k);}
          };
        },
        abort(){tx._aborted=true;queueMicrotask(()=>tx.onabort?.());}
      };
      return tx;
    }
  };
  lastDb=db;
  return db;
}
class FakeBlob {
  constructor(text){this.size=Buffer.byteLength(text);this.text=text;}
}
const window={};
const ctx=vm.createContext({
  window,structuredClone,Blob:FakeBlob,Map,Set,Date,
  indexedDB:{
    open(name,version){
      assert.equal(name,'codewiki-mentoring-team-v1');assert.equal(version,1);opens++;
      const req={result:makeDb()};
      queueMicrotask(()=>req.onsuccess());
      return req;
    }
  }
});
vm.runInContext(fs.readFileSync('js/mentoring-model.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('js/mentoring-team-store.js','utf8'),ctx);

(async()=>{
  const model=window.CodeWikiMentoringModel;
  const mentor=model.members[0].id;
  const create=window.CodeWikiMentoringTeamStore.create;
  assert.throws(()=>create('unknown-actor'),/forbidden/);
  const store=create(mentor);

  // Legacy submission with missing attachments array must not crash reference scanning.
  const seeded=model.empty();
  seeded.submissions['legacy-act:other']={activity:'legacy-act',owner:'other',body:'old'};
  teamStore.set('group',seeded);

  const created=await store.execute({type:'create',id:'act-1',date:'2026-11-24'});
  assert.equal(created.activities.length,1);
  assert.equal(opens,1);

  const blob=new FakeBlob('hello');
  const updated=await store.execute({
    type:'activity',id:'act-1',revision:1,
    value:{title:'멘토링',date:'2026-11-24',startTime:'14:00',endTime:'15:30',goals:'',task:'',result:'',code:'',summary:'',nextPlan:'',status:'active',
      attachments:[{id:'f1',name:'note.txt',type:'text/plain',size:blob.size}]}
  },[{id:'f1',blob}]);
  assert.equal(updated.activities[0].attachments.length,1);
  assert.equal((await store.file('act-1',mentor,'f1')).text,'hello');

  // Unexpected db.onclose clears the cached connection so the next call reopens cleanly.
  lastDb.onclose();
  const afterClose=await store.read();
  assert.equal(opens,2,'onclose must reset cached IndexedDB connection');
  assert.equal(afterClose.activities[0].startTime,'14:00');
  assert.equal(afterClose.activities[0].endTime,'15:30');

  // Deleting the activity garbage-collects its stored file blobs.
  await store.execute({type:'delete',id:'act-1',revision:2});
  assert.equal(fileStore.size,0,'deleting activity removes orphaned blobs');

  // Additional mentors (김태규, 이예진) get isolated storage keys and blobs without touching 이은호's legacy 'group' record.
  const taegyu=model.members.find(m=>m.name==='김태규').id;
  const yejin=model.members.find(m=>m.name==='이예진').id;
  const tgStore=create(taegyu),yjStore=create(yejin);
  await store.execute({type:'create',id:'eh-1',date:'2026-11-25'});
  const tgBlob=new FakeBlob('tg-file');
  await tgStore.execute({type:'create',id:'tg-1',date:'2026-11-25'});
  await tgStore.execute({
    type:'activity',id:'tg-1',revision:1,
    value:{title:'1회차_2주차_6반_1조_김태규',date:'2026-11-25',startTime:'18:00',endTime:'20:00',task:'',attachments:[{id:'tf1',name:'a.txt',type:'text/plain',size:tgBlob.size}]}
  },[{id:'tf1',blob:tgBlob}]);
  await yjStore.execute({type:'create',id:'yj-1',date:'2026-11-25'});
  assert.equal((await store.read()).activities[0].id,'eh-1');
  assert.equal((await tgStore.read()).activities[0].id,'tg-1');
  assert.equal((await yjStore.read()).activities[0].id,'yj-1');
  assert.equal((await tgStore.file('tg-1',taegyu,'tf1')).text,'tg-file');
  assert.equal(await yjStore.file('tg-1',taegyu,'tf1'),null,'another mentor cannot read another mentor file');
  await yjStore.execute({type:'delete',id:'yj-1',revision:1});
  assert.equal((await tgStore.file('tg-1',taegyu,'tf1')).text,'tg-file','deleting one mentor activity must not delete another mentor blobs');
  console.log('PASS: mentoring team store onclose reconnection, blob cleanup, legacy null-attachments safety, per-mentor isolation and role enforcement');
})().catch(e=>{console.error(e);process.exitCode=1;});
