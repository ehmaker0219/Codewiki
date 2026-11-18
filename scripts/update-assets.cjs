// Keep static hosting cache keys tied to file contents. No build dependency needed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname,'..');
function updateAssets(check = false) {
  const indexPath = path.join(root,'index.html');
  const html = fs.readFileSync(indexPath,'utf8');
  const updated = html.replace(/((?:src|href)=")(js\/[^"?]+\.js|css\/[^"?]+\.css)(?:\?v=[^"&]*)?(")/g, (_,prefix,file,quote) => {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex').slice(0,12);
    return `${prefix}${file}?v=${hash}${quote}`;
  });
  if (check && updated !== html) throw new Error('Asset versions are stale. Run: node scripts/update-assets.cjs');
  if (!check && updated !== html) fs.writeFileSync(indexPath,updated);
}
if (require.main === module) { updateAssets(process.argv.includes('--check')); console.log('Asset versions are current.'); }
module.exports = {updateAssets};
