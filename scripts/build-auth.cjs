const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
esbuild.buildSync({
  absWorkingDir: root,
  entryPoints: ['auth/transport.mjs'],
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  outfile: 'js/secure-auth.js',
  legalComments: 'eof'
});
fs.copyFileSync(path.join(root, 'node_modules/jose/LICENSE.md'), path.join(root, 'auth/THIRD-PARTY-NOTICES.txt'));
console.log('Built encrypted authentication transport.');
