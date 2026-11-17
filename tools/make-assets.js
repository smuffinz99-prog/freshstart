/* Regenerates the PNG brand assets (logos, icons, social image) from brand.html and og.html.
   Uses headless Microsoft Edge or Google Chrome. Zero dependencies (Node 22+).
     node tools/make-assets.js
   Outputs into assets/img/. Re-run after changing the name, colours or logo. */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'img');
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const file = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0]));
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    }).listen(0, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  const exe = BROWSERS.find((p) => fs.existsSync(p));
  if (!exe) { console.error('Could not find Edge or Chrome. Edit BROWSERS in this file.'); process.exit(1); }
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-assets-'));
  const browser = spawn(exe, ['--headless=new', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--hide-scrollbars',
    '--no-first-run', '--disable-extensions', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

  let target;
  for (let i = 0; i < 80 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch (e) {}
    if (!target) await sleep(250);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result || {}); pending.delete(d.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
  const open = async (url, w, h) => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: base + url });
    for (let i = 0; i < 100; i++) { if (await evaluate('document.readyState') === 'complete') break; await sleep(100); }
    await evaluate('document.fonts.ready.then(() => true)');
    await sleep(400);
  };
  const save = (name, b64) => { fs.writeFileSync(path.join(OUT, name), Buffer.from(b64, 'base64')); console.log('  wrote assets/img/' + name); };
  const shotEl = async (sel, name, scale, css) => {
    if (css) await evaluate(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(css)}; document.head.appendChild(s); return true; })()`);
    const r = await evaluate(`(() => { const b = document.querySelector('${sel}').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
    const res = await send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale }, captureBeyondViewport: true });
    save(name, res.data);
  };

  await send('Page.enable');
  console.log('Rendering brand assets...');

  // Social share image (WebGL surface + headline)
  await open('/og.html', 1200, 630);
  for (let i = 0; i < 100; i++) { if (await evaluate('document.body.dataset.ready') === '1') break; await sleep(150); }
  await sleep(300);
  save('og-image.png', (await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } })).data);

  // Logos with transparent backgrounds
  await open('/brand.html', 1280, 900);
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  const clear = 'html, body, .tile { background: transparent !important; box-shadow: none !important; } .grid { grid-template-columns: 1fr !important; } .tile { min-height: 0 !important; }';
  await shotEl('#asset-logo-ink', 'logo-ink.png', 4, clear);
  await shotEl('#asset-logo-white', 'logo-white.png', 4);
  await shotEl('#asset-logo-stacked', 'logo-stacked.png', 4);
  await shotEl('#asset-mark-color', 'logo-mark-512.png', 512 / 140);
  await shotEl('#asset-icon', 'icon-512.png', 512 / 180, '.icon { border-radius: 0 !important; }');
  await shotEl('#asset-icon', 'icon-192.png', 192 / 180);
  await shotEl('#asset-icon', 'apple-touch-icon.png', 1);

  // Favicon PNG fallback
  await open('/assets/img/favicon.svg', 32, 32);
  save('favicon-32.png', (await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 32, height: 32, scale: 1 } })).data);

  ws.close(); browser.kill(); srv.close();
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} process.exit(0); }, 600);
})();
