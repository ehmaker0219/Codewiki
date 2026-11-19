// Exercise our editor event wiring with a lightweight Editor double. Markdown
// correctness is separately covered against the real bundle in study-editor.cjs.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('editor/study-editor.js','utf8');
let conversions=0,textReads=0,updates=0,changes=0,instance;
const context={
  serializer:{serialize(doc){conversions++;return doc.body;}},
  encodeRichContent:doc=>doc,
  extensions:[],parse:body=>({toJSON:()=>({body})}),queueMicrotask,
  Extension:{create:options=>options},Plugin:class {constructor(options){Object.assign(this,options);}},
  Editor:class {
    constructor(options){instance=this;this.options=options;this.state={doc:options.content};}
    getText(){textReads++;return this.state.doc.body;}
    destroy(){}
  },
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('const serializedDocs='),source.indexOf('const activeTypes=')),context);
vm.runInContext(source.slice(source.indexOf('function create('),source.indexOf('window.CodeWikiStudyEditor=')),context);
const view=context.create({element:{replaceChildren(){}},onChange(){changes++;},onState(){updates++;},onLimit(){}});
view.setContent('long note');
const limit=instance.options.extensions.at(-1).addProseMirrorPlugins()[0];
const nextDoc={body:'long note updated'};
assert.equal(limit.filterTransaction({docChanged:true,doc:nextDoc},instance.state),true);
instance.state.doc=nextDoc;
instance.options.onTransaction();
instance.options.onUpdate({editor:instance});
instance.options.onSelectionUpdate?.();
assert.equal(conversions,1,'limit check and save share one serialization per immutable document');
assert.equal(updates,1,'one toolbar refresh per transaction');assert.equal(changes,1);
assert.equal(view.text(),'long note updated');
for(let i=0;i<20;i++){instance.options.onTransaction();view.text();}
assert.equal(textReads,1,'cursor-only transactions do not traverse the full document text');
assert.equal(conversions,1,'cursor-only transactions do not serialize content');
view.setContent('other note');assert.equal(view.text(),'other note');assert.equal(textReads,2);
view.destroy();assert.equal(view.text(),'','destroy clears cached text');
// A new document shares old immutable blocks; only edited blocks need scanning.
let scans=0,encodings=0;
const blockContext=vm.createContext({
 needsRichData:block=>{scans++;return block.rich;},
 schema:{text:value=>value,nodes:{doc:{create:(_,blocks)=>blocks},codeBlock:{create:(_,body)=>body}}},
});
vm.runInContext(source.slice(source.indexOf('const encodedBlocks='),source.indexOf('const serializedDocs=')),blockContext);
const block=(text,rich=false)=>({rich,descendants(){},toJSON(){encodings++;return {text};}});
const a=block('unchanged table',true),b=block('old paragraph');
const doc=blocks=>({forEach:fn=>blocks.forEach(fn)});
const first=blockContext.encodeRichContent(doc([a,b]));
const changed=block('new paragraph',true);
const second=blockContext.encodeRichContent(doc([a,changed]));
assert.equal(scans,3,'unchanged blocks are not rescanned');
assert.equal(encodings,2,'unchanged rich blocks are not encoded again');
assert.equal(first[0],second[0]);assert.match(second[1],/new paragraph/,'edited block must invalidate cached content');
console.log('PASS: shared serialization, unchanged-block reuse, single toolbar update, cached character counts and note-switch invalidation');
