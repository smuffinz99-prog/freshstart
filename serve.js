/* Tiny zero-dependency static server for local preview.  node serve.js [port] */
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = +process.env.PORT || +process.argv[2] || 8013, ROOT = path.resolve(__dirname);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.resolve(ROOT, '.' + p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) {
      fs.readFile(path.join(ROOT, '404.html'), (e2, b2) => {
        res.writeHead(404, { 'Content-Type': TYPES['.html'] });
        res.end(e2 ? 'Not found' : b2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(PORT, () => console.log('FreshStart Pressure Washing preview on http://localhost:' + PORT));
