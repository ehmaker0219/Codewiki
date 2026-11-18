// Test the actual committed browser bundle without npm dependencies or a database.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('js/study-editor.js','utf8'),context);
const editor=context.window.CodeWikiStudyEditor;
const plain=value=>JSON.parse(JSON.stringify(value));
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
console.log('PASS: rich-editor Markdown roundtrips, nested formatting/lists, code, literal symbols and inert HTML');
