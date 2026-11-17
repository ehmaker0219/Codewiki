const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4175);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
http.createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html';
    if (name !== 'index.html' && !/^(css|js|assets)\/[a-zA-Z0-9_./-]+$/.test(name)) throw new Error('Not found');
    if (name.split('/').some(part => part === '..' || part.startsWith('.'))) throw new Error('Not found');
    const file = path.join(root, name);
    const content = await fs.readFile(file);
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    res.end(content);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`CodeWiki: http://localhost:${port}/`));
