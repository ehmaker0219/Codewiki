// In-memory PostgreSQL only. No connection string, network, or production writes.
// Uses the pinned development dependency; CODEWIKI_PGLITE_PATH can override it.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const modulePath = process.env.CODEWIKI_PGLITE_PATH || '@electric-sql/pglite';
const {PGlite} = require(modulePath);
const {pgcrypto} = require(path.isAbsolute(modulePath) ? path.join(modulePath,'dist/contrib/pgcrypto.cjs') : '@electric-sql/pglite/contrib/pgcrypto');
const root = path.resolve(__dirname,'..');
const appliedMigrations = new Set();
const read = file => {
  if (/^migrations\/[^/]+\.sql$/.test(file)) appliedMigrations.add(file.slice('migrations/'.length));
  return fs.readFileSync(path.join(root,file),'utf8');
};
(async () => {
  const db = new PGlite({extensions:{pgcrypto}});
  try {
    await db.exec('create role anon; create role authenticated; create role service_role; create schema extensions;');
    await db.exec(read('supabase-setup.sql'));
    for (const file of ['20261118-birthdays.sql','20261118-profile.sql','20261118-session-retention.sql',
      '20261118-learning-progress.sql','20261118-study-notes.sql','20261118-study-conflict-response.sql',
      '20261119-class-roster-signup.sql','20261119-delete-rejected-signups.sql','20261119-study-folders.sql']) {
      await db.exec(read(`migrations/${file}`));
      if(file==='20261119-study-folders.sql')await db.exec(read(`migrations/${file}`));
    }
    for (const file of ['security-regression.sql','birthdays.sql','learning-progress.sql','class-roster.sql','admin-delete.sql']) await db.exec(read(`tests/${file}`));
    // Demonstrate the original failure through a real caller, then remove the fixture.
    await db.exec('set role anon;');
    const before = await db.query("select public.cw_signup('auth-before','','Test','1반','') as result");
    assert.ok(before.rows[0].result.session_token, 'baseline accepts an empty password');
    await db.exec("reset role; delete from public.cw_users where username='auth-before';");
    // Historical overload must not stay reachable after migration.
    await db.exec("create function public.cw_login(integer,text) returns jsonb language sql as $$select '{}'::jsonb$$;");
    const migration=read('migrations/20261119-auth-hardening.sql');
    await db.exec(migration);
    await db.exec(migration); // idempotence: no wrapper recursion or loss of quota state
    // An outdated runbook must not replace hardened RPCs, even on accidental rerun.
    const definition=()=>db.query("select pg_get_functiondef('public.cw_login(text,text)'::regprocedure) as body");
    const guardedLogin=(await definition()).rows[0].body;
    for (const unsafe of ['supabase-setup.sql','migrations/20261118-birthdays.sql','migrations/20261119-class-roster-signup.sql']) {
      await assert.rejects(db.exec(read(unsafe)),error=>error.code==='55000',`${unsafe} rerun must be blocked`);
      await db.exec('rollback;');
    }
    assert.equal((await definition()).rows[0].body,guardedLogin,'setup rerun replaced login guard');
    // Separate committed requests: failure must not undo its quota update.
    await db.exec('set role anon;');
    const failure=await db.query("select public.cw_login('missing-user','wrong') as result");
    assert.equal(failure.rows[0].result.code,'CW_INVALID_CREDENTIALS');
    await db.exec('reset role;');
    const count=await db.query("select attempts from cw_auth_private.limits where bucket='login:global'");
    assert.equal(count.rows[0].attempts,1,'failed request commits its quota');
    await db.exec('truncate cw_auth_private.limits;');
    await db.exec(read('tests/auth-hardening.sql'));
    for (const file of ['security-regression.sql','session-retention.sql','admin-delete.sql','study-notes.sql','study-folders.sql']) await db.exec(read(`tests/${file}`));
    // Historical admin-only tests run above, then verify the expanded final policy.
    await db.exec(read('migrations/20261119-student-study.sql'));
    await db.exec(read('migrations/20261119-student-study.sql'));
    await db.exec(read('tests/student-study.sql'));
    await require('./test-study-transfer.cjs')(db,read);
    await db.exec(read('migrations/20261119-student-only-study.sql'));
    await db.exec(read('migrations/20261119-student-only-study.sql'));
    await db.exec(read('tests/student-only-study.sql'));
    await db.exec(read('migrations/20261119-admin-members.sql'));
    await db.exec(read('migrations/20261119-admin-members.sql'));
    await db.exec(read('tests/admin-members.sql'));
    await db.exec(read('migrations/20261119-presence.sql'));
    await db.exec(read('migrations/20261119-presence.sql'));
    await db.exec(read('tests/presence.sql'));
    await db.exec(read('migrations/20261119-profile-student-number.sql'));
    await db.exec(read('migrations/20261119-profile-student-number.sql'));
    await db.exec(read('tests/profile.sql'));
    await db.exec(read('migrations/20261120-encrypted-auth.sql'));
    await db.exec(read('migrations/20261120-encrypted-auth.sql'));
    // Old migration reruns must not reopen direct credential endpoints.
    await db.exec(read('migrations/20261119-auth-hardening.sql'));
    await db.exec(read('migrations/20261119-admin-members.sql'));
    await db.exec(read('tests/encrypted-auth.sql'));
    await db.exec(read('migrations/20261120-security-review-hardening.sql'));
    await db.exec(read('migrations/20261120-security-review-hardening.sql'));
    await db.exec(read('tests/security-review-hardening.sql'));
    await db.exec(read('tests/encrypted-auth.sql'));
    await db.exec(read('tests/learning-progress.sql'));
    await db.exec(read('migrations/20261121-login-history.sql'));
    await db.exec(read('migrations/20261121-login-history.sql'));
    await db.exec(read('tests/login-history.sql'));
    await db.exec(read('tests/encrypted-auth.sql'));
    await db.exec(read('tests/security-review-hardening.sql'));
    await db.exec(read('migrations/20261123-auth-review-hardening.sql'));
    await db.exec(read('migrations/20261123-auth-review-hardening.sql'));
    await db.exec(read('tests/auth-review-hardening.sql'));
    await db.exec(read('tests/login-history.sql'));
    await db.exec(read('tests/encrypted-auth.sql'));
    await db.exec(read('tests/security-review-hardening.sql'));
    // A new migration file must also be exercised here, not silently skipped.
    const onDisk = fs.readdirSync(path.join(root,'migrations')).filter(file=>file.endsWith('.sql')).sort();
    const missing = onDisk.filter(file=>!appliedMigrations.has(file));
    assert.deepEqual(missing,[],'migrations not exercised by test-auth-db: '+missing.join(', '));
    console.log('PASS: PostgreSQL auth hardening, unsafe setup rerun blocked, session/admin authorization, login history, username-enumeration/MBTI hardening, study ownership/revisions and private folder regressions');
  } finally { await db.close(); }
})().catch(error => { console.error(error.message); process.exitCode=1; });
