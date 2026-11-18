// Test the actual committed browser bundle without npm dependencies or a database.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('js/study-editor.js','utf8'),context);
const editor=context.window.CodeWikiStudyEditor;
// Ignore new optional schema defaults when checking compatibility with older notes.
const plain=value=>JSON.parse(JSON.stringify(value),(key,item)=>{
 if(key!=='attrs'||!item)return item;
 if(item.textAlign===null)delete item.textAlign;
 if(item.color===null)delete item.color;
 return Object.keys(item).length?item:undefined;
});
const roundtrip=source=>{
 const first=editor.parse(source),second=editor.parse(editor.serialize(first));
 assert.deepEqual(plain(second),plain(first),source);
 return plain(first);
};
const rich=roundtrip('## 필기\n\n**굵게** ==강조== *기울임* **==두 가지 서식==**');
assert.equal(rich.content[0].type,'heading');
assert.equal(rich.content[1].content[0].marks[0].type,'bold');
assert.equal(rich.content[1].content[2].marks[0].type,'highlight');
for(const source of [
 '- one\n  - nested\n- two\n\n3. third\n4. fourth',
 '> 인용\n> **중요**\n\n다음 줄\n이어서 작성',
 '```abap\nWRITE: / \'Hello\'.\n**literal** ==literal==\n```',
 '````\n``` inside code\n````',
 '- Item\n\n  ```abap\n  WRITE / 1.\n  \n  ```',
 '`inline code`와 **일반 서식**',
 '<img src=x onerror=alert(1)> <script>alert(1)</script>',
 '![image](https://example.com/a.png) [link](javascript:alert(1))',
 '\\*\\*literal\\*\\* \\=\\=literal\\=\\= & < >',
 '첫 줄  \n둘째 줄',
])roundtrip(source);
const literal={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'**기호** ==같음== <script> & 한글 😀'}]}]};
assert.deepEqual(plain(editor.parse(editor.serialize(literal))),literal,'typed syntax remains literal after saving');
const attack=editor.parse('<img src=x onerror=alert(1)>\n<script>alert(1)</script>');
assert.ok(!JSON.stringify(attack).includes('"type":"image"'));
assert.match(attack.content[0].content[0].text,/<img/,'HTML stays literal text');
const table=roundtrip('| 항목 | 내용 |\n| --- | --- |\n| **변수** | ==설명== |\n| `a` | A \\| B |').content[0];
assert.equal(table.type,'table');
assert.equal(table.content.length,3);
assert.equal(table.content[0].content[0].type,'tableHeader');
assert.ok(!editor.serialize({type:'doc',content:[table]}).includes('codewiki-table-v1'),'simple tables export as Markdown');
const complex=plain(table);
complex.content[1].content[0].content.push({type:'paragraph',content:[{type:'text',text:'두 번째 줄 <script> | ` ```'}]});
complex.content[1].content[1].content=[{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'목록'}]}]}]}];
const complexDoc={type:'doc',content:[complex]};
const stored=editor.serialize(complexDoc);
assert.match(stored,/codewiki-table-v1/);
assert.deepEqual(plain(editor.parse(stored)),complexDoc,'multiline and list cells survive saving');
for(const cellTable of [table,complex]){
 const nested={type:'doc',content:[{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'표를 포함한 항목'}]},cellTable]}]}]};
 assert.deepEqual(plain(editor.parse(editor.serialize(nested))),nested,'tables inside lists preserve indentation and structure');
 const quote={type:'doc',content:[{type:'blockquote',content:[cellTable]}]};
 assert.deepEqual(plain(editor.parse(editor.serialize(quote))),quote,'tables inside quotes preserve indentation and structure');
}
roundtrip('```codewiki-table-v1\n{"type":"image","attrs":{"src":"javascript:alert(1)"}}\n```');
roundtrip('```codewiki-table-v1\ninvalid JSON\n```');
const noHeader=plain(table);
noHeader.content[0].content.forEach(cell=>cell.type='tableCell');
assert.deepEqual(plain(editor.parse(editor.serialize({type:'doc',content:[noHeader]}))),{type:'doc',content:[noHeader]},'deleting the header row does not turn data cells into headers');
for(const size of editor.fontSizes){
 const paragraph={type:'paragraph',content:[{type:'text',text:'큰 글씨 **기호** <script>',marks:[{type:'bold'},{type:'highlight'},{type:'fontSize',attrs:{size}}]}]};
 const sizedDoc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'ordinary Markdown'}]},paragraph]};
 const encoded=editor.serialize(sizedDoc);
 assert.match(encoded,/^ordinary Markdown\n/,'unsized text remains ordinary Markdown');
 assert.match(encoded,/codewiki-rich-v1/);
 assert.deepEqual(plain(editor.parse(encoded)),sizedDoc,'font sizes and combined marks survive save/reopen');
 for(const nested of [
   {type:'blockquote',content:[paragraph]},
   {type:'bulletList',content:[{type:'listItem',content:[paragraph]}]},
   {type:'heading',attrs:{level:2},content:paragraph.content},
 ]){
   const doc={type:'doc',content:[nested]};
   assert.deepEqual(plain(editor.parse(editor.serialize(doc))),doc,'font size survives nested formatting');
 }
 const sizedTable=plain(table);sizedTable.content[1].content[0].content=[paragraph];
 const doc={type:'doc',content:[sizedTable]};
 assert.deepEqual(plain(editor.parse(editor.serialize(doc))),doc,'font size survives table cells');
}
for(const size of [0,999,'20px;position:fixed']){
 const invalid={type:'paragraph',content:[{type:'text',text:'invalid',marks:[{type:'fontSize',attrs:{size}}]}]};
 const source='```codewiki-rich-v1\n'+JSON.stringify(invalid)+'\n```';
 assert.equal(editor.parse(source).content[0].type,'codeBlock','invalid sizes remain inert code');
}
assert.equal(editor.parse('```codewiki-rich-v1\n{"type":"image","attrs":{"src":"javascript:alert(1)"}}\n```').content[0].type,'codeBlock');
for(const mark of [{type:'underline'},{type:'strike'},{type:'textColor',attrs:{color:'#174ea6'}},{type:'highlight',attrs:{color:'#c8e6c9'}}]){
 const paragraph={type:'paragraph',attrs:{textAlign:'center'},content:[{type:'text',text:'워드 서식 **기호**',marks:[mark]}]};
 for(const block of [paragraph,{type:'orderedList',attrs:{start:3,type:null},content:[{type:'listItem',content:[paragraph]}]}]){
  const doc={type:'doc',content:[block]};
  assert.deepEqual(plain(editor.parse(editor.serialize(doc))),doc,'colors, underline, strike and aligned numbered lists survive saving');
 }
}
for(const alignment of ['left','center','right','justify']){
 const doc={type:'doc',content:[{type:'heading',attrs:{level:2,textAlign:alignment},content:[{type:'text',text:'정렬된 제목'}]}]};
 assert.deepEqual(plain(editor.parse(editor.serialize(doc))),doc,'root block alignment survives saving');
}
for(const invalid of [
 {type:'paragraph',attrs:{textAlign:'center;position:fixed'},content:[{type:'text',text:'bad'}]},
 {type:'paragraph',content:[{type:'text',text:'bad',marks:[{type:'textColor',attrs:{color:'url(javascript:alert(1))'}}]}]},
 {type:'paragraph',content:[{type:'text',text:'bad',marks:[{type:'highlight',attrs:{color:'red;position:fixed'}}]}]},
])assert.equal(editor.parse('```codewiki-rich-v1\n'+JSON.stringify(invalid)+'\n```').content[0].type,'codeBlock');
console.log('PASS: rich-editor Markdown/table/font-size/color/alignment roundtrips, legacy defaults and inert invalid imports');
