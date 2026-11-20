// Keep static hosting cache keys tied to file contents. No build dependency needed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname,'..');
const updatedTime = /<time id="siteUpdatedAt"[^>]*>[\s\S]*?<\/time>/;
// Inspect asset tags independently of the versioning regex. A malformed URL
// must fail validation instead of silently disappearing from the hash check.
function validateAssets(html, assetRoot = root) {
  const tags = html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<(script|link)\b[^>]*>/gi);
  for (const [tag, tagName] of tags) {
    const attrs = Object.fromEntries([...tag.matchAll(/\s([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
      .map(([,name,double,single,bare])=>[name.toLowerCase(),double ?? single ?? bare]));
    const script = tagName.toLowerCase() === 'script';
    const stylesheet = (attrs.rel || '').toLowerCase().split(/\s+/).includes('stylesheet');
    if (stylesheet && !attrs.href) throw new Error('Stylesheet is missing its href');
    if (['studyEditorSource','objectGameBankSource'].includes(attrs.id) && !attrs['data-src']) {
      throw new Error(`Lazy asset ${attrs.id} is missing its data-src`);
    }
    for (const key of script ? ['src','data-src'] : ['href']) {
      if (!(key in attrs)) continue;
      const url = attrs[key];
      if (/^https:\/\//i.test(url)) continue;
      const file = url.split(/[?#]/)[0];
      if (!file || /[\\:%]/.test(file) || file.startsWith('/') || file.split('/').includes('..')) {
        throw new Error(`Invalid local asset URL: ${url}`);
      }
      const target = path.join(assetRoot,file);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error(`Missing local asset: ${url}`);
      if ((script && !file.endsWith('.js')) || (stylesheet && !file.endsWith('.css'))) {
        throw new Error(`Unexpected asset type: ${url}`);
      }
    }
  }
}
function stampUpdatedTime(html, now = new Date()) {
  if (!updatedTime.test(html)) throw new Error('Missing site update footer');
  // Exclude the generated timestamp itself. Unchanged builds retain their update time.
  const content = html.replace(updatedTime, '<time id="siteUpdatedAt"></time>').replace(/\r\n/g,'\n');
  const version = crypto.createHash('sha256').update(content).digest('hex').slice(0,16);
  const old = html.match(updatedTime)[0];
  if (old.includes(`data-version="${version}"`) && /datetime="[^\"]+"/.test(old)) return html;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(now).map(part=>[part.type,part.value]));
  const label = `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute} (KST)`;
  return html.replace(updatedTime, `<time id="siteUpdatedAt" datetime="${now.toISOString()}" data-version="${version}">${label}</time>`);
}
function updateAssets(check = false) {
  const indexPath = path.join(root,'index.html');
  const html = fs.readFileSync(indexPath,'utf8');
  validateAssets(html);
  const versioned = html.replace(/((?:src|href)=")(js\/[^"?]+\.js|css\/[^"?]+\.css)(?:\?v=[^"&]*)?(")/g, (_,prefix,file,quote) => {
    const content = fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
    const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0,12);
    return `${prefix}${file}?v=${hash}${quote}`;
  });
  const updated = stampUpdatedTime(versioned);
  if (check && updated !== html) throw new Error('Asset versions are stale. Run: node scripts/update-assets.cjs');
  if (!check && updated !== html) fs.writeFileSync(indexPath,updated);
}
if (require.main === module) { updateAssets(process.argv.includes('--check')); console.log('Asset versions are current.'); }
module.exports = {updateAssets, stampUpdatedTime, validateAssets};
