const esbuild = require('esbuild');
const fs = require('node:fs');
esbuild.buildSync({entryPoints:['auth/transport.mjs'], bundle:true, minify:true, format:'iife',
  platform:'browser', target:['es2022'], outfile:'js/secure-auth.js', legalComments:'eof'});
fs.copyFileSync('node_modules/jose/LICENSE.md','auth/THIRD-PARTY-NOTICES.txt');
console.log('Built encrypted authentication transport.');
