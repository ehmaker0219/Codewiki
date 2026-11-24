const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

// Exercise the page's real event handlers without touching the browser's records or IndexedDB.
const nodes=new Map(),events={},location={hash:'#mentoring'};
let document,stored,storeCalls=0,failNext=false,pending=null,holdNext=false;
function element(id=''){
  let inert=false;
  return {id,tagName:'DIV',dataset:{},events:{},hidden:false,open:false,isConnected:true,value:'',textContent:'',innerHTML:'',
    classList:{add(){},remove(){},toggle(){}},
    get inert(){return inert;},set inert(value){inert=value;if(value&&document)document.activeElement=document.body;},
    addEventListener(type,fn){this.events[type]=fn;},
    querySelector(selector){
      if(selector.startsWith('#'))return node(selector.slice(1));
      const action=/\[data-action=["']?([\w-]+)/.exec(selector);
      if(action)return node('action-'+action[1]);
      if(selector.includes('dialog'))return node('mentoringImport').open?node('mentoringImport'):null;
      return null;
    },querySelectorAll(){return [];},
    replaceChildren(){this.innerHTML='';},setAttribute(){},contains(other){return other?.inHost===true;},
    focus(){document.activeElement=this;},setSelectionRange(start,end,direction){this.selectionStart=start;this.selectionEnd=end;this.selectionDirection=direction;},
    close(){this.open=false;},showModal(){this.open=true;},closest(selector){return selector==='button'&&this.tagName==='BUTTON'?this:null;}
  };
}
function node(id){if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id);}
document={body:element('body'),activeElement:null,getElementById:node,querySelectorAll:()=>[],
  querySelector(selector){return selector.includes('dialog')&&node('mentoringImport').open?node('mentoringImport'):null;},
  addEventListener(type,fn){events[type]=fn;},createElement:()=>element()};
document.activeElement=document.body;
const window={addEventListener(type,fn){events[type]=fn;},scrollTo(){},
  CodeWikiAuth:{getSessionToken:()=> 'test-session'},CodeWikiLearning:{escape:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}};
const context=vm.createContext({window,document,location,structuredClone,Date,Intl,URL,Map,Set,setTimeout,clearTimeout,
  crypto:{randomUUID:()=> 'new-activity'},confirm:()=>true,history:{replaceState(_a,_b,hash){location.hash=hash;}}});
vm.runInContext(fs.readFileSync('js/mentoring-model.js','utf8'),context);
const model=window.CodeWikiMentoringModel,mentor=model.members[0],activityId='keyboard-test';
stored=model.apply(model.empty(),mentor.id,{type:'create',id:activityId,date:'2026-11-23'});
window.CodeWikiMentoringTeamStore={create:()=>({
  read:async()=>structuredClone(stored),
  async execute(command){
    storeCalls++;
    if(holdNext){holdNext=false;await new Promise(resolve=>{pending=resolve;});}
    if(failNext){failNext=false;throw Error('storage');}
    stored=model.apply(stored,mentor.id,command);
    return structuredClone(stored);
  }
})};
vm.runInContext(fs.readFileSync('js/mentoring.js','utf8'),context);
const api=window.CodeWikiMentoring,host=node('mentoringPage');
const user={id:mentor.id,role:'student',status:'approved'};
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
function input(value,field='task'){
  const control=node('field-'+field);
  Object.assign(control,{tagName:'TEXTAREA',inHost:true,dataset:{scope:'activity',field},value,selectionStart:2,selectionEnd:4,selectionDirection:'forward'});
  document.activeElement=control;host.events.input({target:control});return control;
}
function shortcut(overrides={}){
  const event={key:'s',ctrlKey:true,metaKey:false,altKey:false,shiftKey:false,repeat:false,isComposing:false,defaultPrevented:false,target:document.activeElement,
    preventDefault(){this.defaultPrevented=true;},...overrides};
  events.keydown(event);return event;
}
function clickSave(){const button=node('action-save');button.tagName='BUTTON';button.dataset.action='save';host.events.click({target:button});}
function hasUnsaved(){let prevented=false;events.beforeunload({preventDefault(){prevented=true;}});return prevented;}

(async()=>{
  api.setUser(user);await flush();
  assert.equal(typeof events.keydown,'function','mentoring must register a save shortcut');
  assert.equal(host.hidden,false);
  assert.ok(!node('mentoringEditor').innerHTML.includes('data-action="import"'),'study-note import button must be removed');
  assert.ok(!node('mentoringEditor').innerHTML.includes('내 공부방 필기 가져오기'),'study-note import label must be removed');
  const field=input('Keyboard save body');holdNext=true;
  assert.equal(shortcut().defaultPrevented,true,'Ctrl+S must suppress the browser Save Page dialog');
  assert.equal(storeCalls,1);assert.equal(hasUnsaved(),true,'pending saves must retain the dirty state');
  shortcut();shortcut({repeat:true});assert.equal(storeCalls,1,'pending or repeated shortcuts must not duplicate writes');
  pending();await flush();
  assert.equal(stored.activities[0].task,'Keyboard save body');assert.equal(hasUnsaved(),false);
  assert.equal(document.activeElement,field,'saving should return focus to the same input');
  assert.deepEqual([field.selectionStart,field.selectionEnd],[2,4],'saving should preserve the text selection');
  assert.match(node('mentoringStatus').textContent,/마지막 저장/);
  // Trailing blur/change event with the already-saved value must NOT re-dirty the form.
  host.events.change({target:field});
  assert.equal(hasUnsaved(),false,'trailing change with identical value must not mark form dirty');
  const savedCalls=storeCalls;shortcut();await flush();assert.equal(storeCalls,savedCalls,'unchanged records should not write again');

  input('Command save body');shortcut({ctrlKey:false,metaKey:true,key:'S'});await flush();
  assert.equal(stored.activities[0].task,'Command save body','Command+S should save on macOS');
  input('Button save body');clickSave();await flush();assert.equal(stored.activities[0].task,'Button save body');

  input('Retry this body');failNext=true;shortcut();await flush();
  assert.equal(stored.activities[0].task,'Button save body');assert.equal(hasUnsaved(),true,'failed saves must keep the draft');
  assert.match(node('mentoringStatus').textContent,/처리하지 못|저장하지 못/);
  shortcut();await flush();assert.equal(stored.activities[0].task,'Retry this body');assert.equal(hasUnsaved(),false);

  input('Guarded body');const guardedCalls=storeCalls;
  for(const event of [{ctrlKey:false},{altKey:true},{shiftKey:true},{repeat:true},{isComposing:true},{defaultPrevented:true}])shortcut(event);
  node('mentoringImport').open=true;shortcut();node('mentoringImport').open=false;
  await flush();assert.equal(storeCalls,guardedCalls,'modified, composing, handled, repeat and dialog shortcuts must not save');
  location.hash='#study';events.hashchange();assert.equal(shortcut().defaultPrevented,false);await flush();assert.equal(storeCalls,guardedCalls);
  location.hash='#mentoring';events.hashchange();shortcut();await flush();assert.equal(stored.activities[0].task,'Guarded body');

  input('Save without stealing focus');holdNext=true;shortcut();
  const otherControl=node('other-control');document.activeElement=otherControl;pending();await flush();
  assert.equal(document.activeElement,otherControl,'finishing a save must not take focus back from another control');

  input('Save from old session');holdNext=true;shortcut();const callsAtLogout=storeCalls;
  api.setUser(null);pending();await flush();
  assert.equal(host.hidden,true);assert.equal(host.inert,false);assert.equal(shortcut().defaultPrevented,false);assert.equal(storeCalls,callsAtLogout);
  assert.equal(document.activeElement,document.body,'finishing an old-session save must not restore its input focus');
  api.setUser(user);await flush();assert.equal(hasUnsaved(),false,'old session completion must not restore its dirty draft');
  api.setUser(null);
  stored=model.empty();api.setUser(user);await flush();const emptyCalls=storeCalls;shortcut();await flush();assert.equal(storeCalls,emptyCalls,'empty mentoring pages have no record to save');
  console.log('PASS: mentoring Ctrl/Command+S, button save, pending/repeat guards, no-op writes, failure retry, route/dialog/session isolation and empty state');
})().catch(error=>{console.error(error);process.exitCode=1;});
