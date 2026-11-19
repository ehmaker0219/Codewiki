// Receives the isolated in-memory test database, never a production connection.
const assert=require('node:assert/strict');
module.exports=async function testStudyTransfer(db,read){
  await db.exec('begin;');
  try {
    const accounts=(await db.query(`insert into public.cw_users(username,password_hash,full_name,role,status,session_token,session_expires_at)
      values ('transfer-admin','not-a-password-hash','Source','admin','approved',gen_random_uuid(),now()+interval '1 hour'),
             ('transfer-student','not-a-password-hash','Target','student','approved',gen_random_uuid(),now()+interval '1 hour')
      returning id,role,session_token`)).rows;
    const source=accounts.find(a=>a.role==='admin'),target=accounts.find(a=>a.role==='student');
    const sourceNote=(await db.query("select public.cw_save_study_note($1,gen_random_uuid(),'Original','**Original body**',0) as n",[source.session_token])).rows[0].n;
    const targetNote=(await db.query("select public.cw_save_study_note($1,gen_random_uuid(),'Existing','Existing body',0) as n",[target.session_token])).rows[0].n;
    const folder=(await db.query("select public.cw_save_study_folder($1,gen_random_uuid(),'ABAP',0) as f",[source.session_token])).rows[0].f;
    await db.query('select public.cw_move_study_note($1,$2,$3)',[source.session_token,sourceNote.id,folder.id]);
    const snapshot=async()=>{
      const result={};
      for(const table of ['cw_study_notes','cw_study_folders','cw_study_note_folders']){
        result[table]=(await db.query(`select to_jsonb(t) as row from public.${table} t order by ${table==='cw_study_note_folders'?'note_id':'id'}`)).rows.map(r=>r.row);
      }
      return result;
    };
    const transfer=read('scripts/transfer-study-owner.sql');
    await db.query("select set_config('codewiki.transfer_from',$1,true),set_config('codewiki.transfer_to',$2,true)",[source.id,target.id]);
    // Reject collisions atomically, without overwriting existing student folders.
    const collision=(await db.query("select public.cw_save_study_folder($1,gen_random_uuid(),'ABAP',0) as f",[target.session_token])).rows[0].f;
    const beforeConflict=await snapshot();await db.exec('savepoint overlap;');
    await assert.rejects(db.exec(transfer),e=>e.code==='23505');await db.exec('rollback to overlap;');
    assert.deepEqual(await snapshot(),beforeConflict);
    await db.query('select public.cw_delete_study_folder($1,$2,1)',[target.session_token,collision.id]);
    const before=await snapshot();
    await db.exec(transfer);
    const after=await snapshot();
    for(const table of Object.keys(before))assert.deepEqual(after[table],before[table].map(row=>({...row,owner_id:target.id})),`${table}: only owner may change`);
    await db.exec(transfer);assert.deepEqual(await snapshot(),after,'repeated transfer must not duplicate notes');
    // The approved student can open both their existing note and the moved note.
    for(const note of [sourceNote,targetNote])assert.equal((await db.query('select public.cw_get_study_note($1,$2) as n',[target.session_token,note.id])).rows[0].n.body,note.body);
    await db.exec('savepoint invalid;');
    await db.query("select set_config('codewiki.transfer_from',$1,true),set_config('codewiki.transfer_to',$2,true)",[target.id,source.id]);
    await assert.rejects(db.exec(transfer),e=>e.code==='22023');await db.exec('rollback to invalid;');
    // Maintenance SQL is not callable by an ordinary API role.
    await db.exec('savepoint unprivileged; set local role anon;');
    await assert.rejects(db.exec(transfer),e=>e.code==='42501');await db.exec('rollback to unprivileged;');
    console.log('PASS: study ownership transfer preserves bodies, timestamps, revisions, folders and existing target data; collision/role checks and idempotence');
  } finally {await db.exec('rollback;');}
};
