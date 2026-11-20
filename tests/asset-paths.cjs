const assert = require('node:assert/strict');
const fs = require('node:fs');
const {validateAssets} = require('../scripts/update-assets.cjs');
const html = fs.readFileSync('index.html','utf8');
assert.doesNotThrow(()=>validateAssets(html));
// Reproduce the reviewed corruption, including data-src used by lazy loaders.
const broken = html.replace(/((?:src|href)=")(?:js|css)\/[^"?]+(?:\?[^\"]*)?"/g,'$1=123456abcdef"');
assert.notEqual(broken,html);
assert.throws(()=>validateAssets(broken),/Missing local asset/);
for (const tag of [
  '<script src="=123456abcdef"></script>',
  '<link rel="stylesheet" href="=123456abcdef">',
  '<script id="studyEditorSource" data-src="=123456abcdef"></script>',
  '<script id="objectGameBankSource" data-src="js/absent.js"></script>',
  '<script src="js/absent.js?v=123"></script>',
  "<script src='js/absent.js'></script>",
  '<script src=js/absent.js></script>',
  '<script src=""></script>',
  '<link rel="stylesheet">',
  '<script id="studyEditorSource"></script>',
  '<script id="objectGameBankSource"></script>',
  '<script src="../outside.js"></script>',
  '<script src="js"></script>',
  '<script src="css/style.css"></script>',
  '<link rel="stylesheet" href="js/app.js">',
]) assert.throws(()=>validateAssets(tag),undefined,tag);
assert.doesNotThrow(()=>validateAssets(`
  <script src="js/app.js?v=123"></script>
  <link rel="stylesheet" href="css/style.css?v=123">
  <script id="studyEditorSource" data-src="js/study-editor.js?v=123"></script>
  <script id="objectGameBankSource" data-src="js/object-game-bank.js?v=123"></script>
  <script src="https://cdn.example.com/sdk.js"></script>
  <script>/* inline script */</script>
  <!-- <script src="removed.js"></script> -->
`));
console.log('PASS: real entry-point assets, corrupted/missing paths, CSS/JS types and lazy editor/game sources');
