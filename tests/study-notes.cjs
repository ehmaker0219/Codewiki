const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{}};
for(const file of ['study-markdown','study-store'])vm.runInNewContext(fs.readFileSync('js/'+file+'.js','utf8'),context);
const md=context.window.CodeWikiStudyMarkdown;
assert.match(md.render('## 제목\n\n**굵게** ==강조== *기울임*'),/<h2>제목<\/h2>.*<strong>굵게<\/strong>.*<mark>강조<\/mark>.*<em>기울임<\/em>/);
const malicious='<img src=x onerror=alert(1)> <script>alert(1)</script>';
for(const text of [malicious,'**'+malicious+'**','=='+malicious+'==','```html\n'+malicious+'\n```','`'+malicious+'`']) {
  assert.ok(!md.render(text).includes('<img'));assert.ok(!md.render(text).includes('<script>'));
}
assert.match(md.render('```abap\n**code**\n```'),/<pre><code>\*\*code\*\*<\/code><\/pre>/);
assert.match(md.render('- one\n- two\n\n1. first\n2. second'),/<ul><li>one<\/li><li>two<\/li><\/ul><ol>/);
assert.equal(md.format('abc def',4,7,'heading').text,'## abc def');
assert.equal(md.format('abc\ndef',4,7,'list').text,'abc\n- def');
assert.equal(md.format('hello',0,5,'highlight').text,'==hello==');
assert.equal(md.format('hello',0,5,'bold').text,'**hello**');

const create=context.window.CodeWikiStudyStore.create;
const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const note={id:'11111111-1111-4111-8111-111111111111',title:'Title',body:'',revision:0};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const requests=[];
 let store=create({rpc:(name,args)=>new Promise(resolve=>requests.push({name,args,resolve})),storage,owner:'admin',token:'session'});
 store.select(note);store.edit('Title','first');
 const saving=store.save();store.save();assert.equal(requests.length,1,'serialize duplicate saves');
 store.edit('Title','typed while saving');
 requests[0].resolve({data:{title:'Title',revision:1,updated_at:'2026-11-18T00:00:00Z'}});await tick();
 assert.equal(requests.length,2);assert.equal(requests[1].args.p_revision,1);assert.equal(requests[1].args.p_body,'typed while saving');
 requests[1].resolve({data:{title:'Title',revision:2}});await saving;
 assert.equal(store.dirty,false);assert.equal(memory.size,0);
 store.edit('Draft','unsaved');const fail=store.save();requests[2].resolve({error:{message:'offline'}});assert.equal(await fail,false);
 assert.equal(store.current.body,'unsaved');assert.equal(store.dirty,true);
 store.dispose();
 store=create({rpc:async()=>({error:{code:'40001'}}),storage,owner:'admin',token:'new-session'});
 assert.equal(store.current.body,'unsaved','restore private draft after reopening');
 assert.equal(await store.save(),false);assert.match(store.status,/다른 창/);assert.equal(store.current.body,'unsaved');
 const other=create({rpc:async()=>({}),storage,owner:'other',token:'other-session'});
 assert.equal(other.current,null,'another account never sees the draft');
 let finish;const old=create({rpc:()=>new Promise(r=>finish=r),storage,owner:'old',token:'old'});
 old.select(note);old.edit('Old','draft');const pending=old.save();old.dispose();finish({data:{title:'Saved',revision:1}});await pending;
 assert.equal(old.current.revision,0,'late save cannot revive disposed session');
 const noCache=create({rpc:async()=>({data:{title:'Saved',revision:1}}),storage:{getItem(){return null;},setItem(){throw Error();},removeItem(){throw Error();}},owner:'private',token:'x'});
 noCache.select(note);noCache.edit('Saved','text');assert.match(noCache.status,/임시 저장/);assert.equal(await noCache.save(),true,'server saves work when browser cache is unavailable');
 console.log('PASS: safe Markdown, formatting, serialized autosave, in-flight edits, failed saves, conflicts, private draft restore, stale sessions');
})().catch(error=>{console.error(error);process.exitCode=1;});
