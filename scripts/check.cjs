// Read-only verification; never connects to or changes the production database.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname,'..');
function run(args) {
  const result = spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const file of fs.readdirSync(path.join(root,'js')).filter(file=>file.endsWith('.js'))) run(['--check',`js/${file}`]);
for (const file of fs.readdirSync(path.join(root,'scripts')).filter(file=>file.endsWith('.cjs'))) run(['--check',`scripts/${file}`]);
const tests = fs.readdirSync(path.join(root,'tests')).filter(file=>file.endsWith('.cjs')).sort();
for (const file of tests) run([`tests/${file}`]);
require('./update-assets.cjs').updateAssets(true);
console.log(`PASS: JavaScript syntax, ${tests.length} regression suites, static asset versions`);
