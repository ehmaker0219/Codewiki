const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const app = fs.readFileSync('js/app.js','utf8');
let completed = ['a'], writes = 0, mark = null;
const link = {getAttribute:()=> 'a',querySelector:()=>mark,insertAdjacentHTML(){writes++;mark={remove(){writes++;mark=null;}};}};
const context = {window:{CodeWikiProgress:{getStatus:()=> 'syncing',needsRetry:()=>false}},
  getReadDocs:()=>completed,currentDocId:'a',document:{getElementById:()=>null},
  categoryNav:{querySelectorAll:()=>[link],set innerHTML(value){throw Error('Unexpected full navigation rerender');}}};
vm.runInNewContext(app.slice(app.indexOf('  function refreshProgress()'),app.indexOf('  function getCategoryName')),context);
context.refreshProgress();assert.equal(writes,1);
context.refreshProgress();context.refreshProgress();assert.equal(writes,1,'sync status events must not rewrite completion marks');
completed=[];context.refreshProgress();assert.equal(writes,2);

const events = {}, visits = [];
const target = {hasAttribute:()=>false,getAttribute:()=> 'newly-rendered'};
const delegated = {document:{addEventListener:(name,fn)=>events[name]=fn},window:{},
  hoverPreviewCard:{classList:{add(){}}},navigateTo:id=>visits.push(id)};
vm.runInNewContext(app.slice(app.indexOf('  function initWikiLinks()'),app.indexOf('  function movePreviewCard')),delegated);
delegated.initWikiLinks();
events.click({target:{closest:()=>target},preventDefault(){}});
assert.deepEqual(visits,['newly-rendered'],'new links work without rebinding after rendering');
events.click({ctrlKey:true,target:{closest:()=>target},preventDefault(){throw Error('Modified link click should use browser navigation');}});
assert.equal(visits.length,1);
console.log('PASS: incremental completion marks, no status-only DOM writes, delegated dynamic links and modified clicks');
