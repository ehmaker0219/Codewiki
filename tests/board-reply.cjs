const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/board.js','utf8');
const fn = source.slice(source.indexOf('  function openReplyModal'), source.indexOf('  function closeBoardViewAndReturn'));
function setup(error) {
  const nodes = {};
  const node = id => nodes[id] ||= {value:'',checked:false,disabled:false,textContent:'',events:{},focus(){},addEventListener(event,fn){this.events[event]=fn;}};
  const calls=[];
  const modal={classList:{add(){modal.hidden=true;},remove(){modal.hidden=false;}}};
  const context=vm.createContext({document:{getElementById:node},writeModal:modal,escapeHtml:s=>s,window:{CodeWikiAuth:{isSupabaseConfigured:()=>true,getSessionToken:()=> 'test-token',getSupabaseClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return {error};}})}},refreshBadge:async()=>{},openBoardView:async()=>{}});
  vm.runInContext(fn,context);
  context.openReplyModal({id:7,title:'test',status:'open',admin_note:'existing'});
  return {node,calls,modal};
}
(async()=>{
  const ok=setup(null);
  assert.equal(ok.node('replyNote').value,'existing');
  ok.node('replyNote').value='new reply';
  await ok.node('replyForm').events.submit({preventDefault(){}});
  assert.equal(ok.calls[0].args.p_admin_note,'new reply');
  assert.equal(ok.calls[0].args.p_status,'open');
  assert.equal(ok.modal.hidden,true);
  const fail=setup({message:'권한 오류'});
  fail.node('replyNote').value='keep draft';
  await fail.node('replyForm').events.submit({preventDefault(){}});
  assert.equal(fail.modal.hidden,false);
  assert.equal(fail.node('replyNote').value,'keep draft');
  assert.match(fail.node('replyError').textContent,/권한 오류/);
  assert.equal(fail.node('saveReplyBtn').disabled,false);
  console.log('PASS: reply modal prefill, save payload, status preservation, failure recovery and draft retention');
})();
