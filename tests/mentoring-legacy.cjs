const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

// Legacy import must remain owner-scoped and read-only after removing its old write API.
const rows=[
  {owner:'mentor',id:'old',title:'Earlier report',updatedAt:'2026-11-19T00:00:00Z',attachments:[{id:'file-one'}]},
  {owner:'other',id:'private',title:'Another account',updatedAt:'2026-11-23T00:00:00Z'},
  {owner:'mentor',id:'new',title:'Latest report',updatedAt:'2026-11-22T00:00:00Z'}
];
const original=JSON.stringify(rows),transactions=[];
let failRead=false,opens=0;
const db={close(){},transaction(store,mode){
  transactions.push({store,mode});
  const tx={objectStore(name){
    assert.equal(name,'reports');
    return {getAll(range){
      const request={result:structuredClone(rows.filter(row=>row.owner===range.lower[0]))};
      assert.equal(range.lower[0],range.upper[0]);
      queueMicrotask(()=>{
        if(failRead){failRead=false;tx.error=Error('storage-unavailable');tx.onabort();}
        else tx.oncomplete();
      });
      return request;
    }};
  }};
  return tx;
}};
const window={};
vm.runInNewContext(fs.readFileSync('js/mentoring-store.js','utf8'),{
  window,indexedDB:{open(name,version){
    assert.equal(name,'codewiki-mentoring-v1');assert.equal(version,1);opens++;
    const request={result:db};queueMicrotask(()=>request.onsuccess());return request;
  }},IDBKeyRange:{bound:(lower,upper)=>({lower,upper})}
});
(async()=>{
  const create=window.CodeWikiMentoringStore.create;
  assert.throws(()=>create(''),/owner-required/);
  const records=await create('mentor').list();
  assert.deepEqual(records.map(record=>record.id),['new','old']);
  assert.equal(records[1].attachments[0].id,'file-one');
  assert.deepEqual((await create('other').list()).map(record=>record.id),['private']);
  assert.deepEqual(await create('empty').list(),[]);
  assert.equal(opens,1,'reads reuse the database connection');
  failRead=true;await assert.rejects(create('mentor').list(),/storage-unavailable/);
  assert.equal((await create('mentor').list()).length,2,'a failed read can be retried');
  assert.equal(JSON.stringify(rows),original,'imports preserve original reports and attachment references');
  assert.ok(transactions.every(tx=>tx.store==='reports'&&tx.mode==='readonly'),'imports never open a write or attachment transaction');
  console.log('PASS: legacy mentoring imports preserve records, owner isolation, sorting, readonly transactions and retry');
})().catch(error=>{console.error(error);process.exitCode=1;});
