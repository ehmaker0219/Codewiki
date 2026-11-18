// Exercise the actual global search handler without mounting the whole app.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/app.js','utf8').split('function initSearch() {')[1];
const handler=source.match(/window\.addEventListener\("keydown", e => \{[\s\S]*?\n    \}\);/)[0];
let keydown,focused=0,prevented=0,hidden=0;
const document={activeElement:{tagName:'BODY'}};
vm.runInNewContext(handler,{document,window:{addEventListener:(event,fn)=>{keydown=fn;}},
 searchInput:{focus(){focused++;}},searchDropdown:{classList:{add(){hidden++;}}}});
const slash=()=>keydown({key:'/',preventDefault(){prevented++;}});
for(const active of [{tagName:'INPUT'},{tagName:'TEXTAREA'},{tagName:'DIV',isContentEditable:true}]){
 document.activeElement=active;slash();
 assert.equal(focused,0,'typing / in a form or rich editor must not focus search');
 assert.equal(prevented,0,'keep the slash available to the editor');
}
document.activeElement={tagName:'BODY'};slash();
assert.equal(focused,1);assert.equal(prevented,1);
keydown({key:'Escape'});assert.equal(hidden,1);
console.log('PASS: slash search shortcut preserves rich-editor and form input');
