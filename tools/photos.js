/* Turn your own before/after job photos into the site's optimised WebP files.

     node tools/photos.js <slot> <before-photo> <after-photo>

   slot: driveway | roof | brick | deck | pavers | solar | hero
   Take both photos from the same spot and angle. Any JPG/PNG/WebP straight off a phone works.
   Uses headless Microsoft Edge or Google Chrome. Zero dependencies (Node 22+). */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'img', 'photos');
const SLOTS = ['driveway', 'roof', 'brick', 'deck', 'pavers', 'solar', 'hero'];
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const [slot, beforePath, afterPath] = process.argv.slice(2);
if (!SLOTS.includes(slot) || !beforePath || !afterPath) {
  console.log('Usage: node tools/photos.js <' + SLOTS.join('|') + '> <before-photo> <after-photo>');
  process.exit(1);
}
for (const p of [beforePath, afterPath]) if (!fs.existsSync(p)) { console.error('File not found: ' + p); process.exit(1); }

/* outputs: [file suffix, width, height, focusX, focusY] (focus = which part of the photo to keep when cropping) */
const JOBS = slot === 'hero'
  ? [['desktop', 1920, 1080, 0.5, 0.75], ['mobile', 750, 1538, 0.5, 0.75]]
  : [['720', 720, 480, 0.5, 0.5], ['1280', 1280, 853, 0.5, 0.5]];

(async () => {
  const exe = BROWSERS.find((p) => fs.existsSync(p));
  if (!exe) { console.error('Could not find Edge or Chrome. Edit BROWSERS in this file.'); process.exit(1); }
  const files = { '/before': path.resolve(beforePath), '/after': path.resolve(afterPath) };
  const srv = await new Promise((res) => {
    const s = http.createServer((req, rsp) => {
      const f = files[req.url.split('?')[0]];
      if (!f) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
      fs.createReadStream(f).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(s));
  });
  const base = `http://127.0.0.1:${srv.address().port}`;
  const port = 9500 + Math.floor(Math.random() * 300);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-photos-'));
  const browser = spawn(exe, ['--headless=new', '--no-first-run', '--disable-extensions', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 80 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch (e) {} if (!target) await sleep(250); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception ? r.result.exceptionDetails.exception.description : 'script error');
    return r.result.result.value;
  };
  await send('Page.navigate', { url: base + '/missing' });
  await sleep(400);
  fs.mkdirSync(OUT, { recursive: true });
  let total = 0;
  for (const [state, quality] of [['before', 0.62], ['after', 0.72]]) {
    for (const [suffix, w, h, fx, fy] of JOBS) {
      const url = await ev(`(async () => {
        const blob = await (await fetch('${base}/${state}')).blob();
        const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
        const s = Math.max(${w} / bmp.width, ${h} / bmp.height), sw = ${w} / s, sh = ${h} / s;
        const sx = (bmp.width - sw) * ${fx}, sy = (bmp.height - sh) * ${fy};
        let cur = document.createElement('canvas'); cur.width = Math.round(sw); cur.height = Math.round(sh);
        cur.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, cur.width, cur.height);
        while (cur.width / 2 >= ${w}) { const n = document.createElement('canvas'); n.width = Math.round(cur.width / 2); n.height = Math.round(cur.height / 2); const x = n.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, n.width, n.height); cur = n; }
        const o = document.createElement('canvas'); o.width = ${w}; o.height = ${h};
        const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(cur, 0, 0, ${w}, ${h});
        return o.toDataURL('image/webp', ${quality});
      })()`);
      const name = `${slot}-${state}-${suffix}.webp`, buf = Buffer.from(url.split(',')[1], 'base64');
      fs.writeFileSync(path.join(OUT, name), buf); total += buf.length;
      console.log('  wrote assets/img/photos/' + name + '  (' + Math.round(buf.length / 1024) + ' KB)');
    }
  }
  console.log('Done, ' + Math.round(total / 1024) + ' KB total.');
  if (slot === 'hero') {
    console.log('\nOne more step for the hero: in assets/js/app.js, find PHOTOS.hero and set');
    console.log("  desktop: { ..., size: [1920, 1080], beforeRect: [0, 0, 1, 1], focus: [0.5, 1] }");
    console.log("  mobile:  { ..., size: [750, 1538], beforeRect: [0, 0, 1, 1], focus: [0.5, 1] }");
    console.log('  slab: null');
    console.log('(and update the two hero preload <link> tags in index.html if you renamed anything).');
  }
  ws.close(); browser.kill(); srv.close();
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} process.exit(0); }, 500);
})().catch((e) => { console.error('Error: ' + e.message); process.exit(1); });
