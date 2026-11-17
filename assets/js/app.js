/* ==========================================================================
   Good Pressure — page behaviour
   Edit CONFIG below for form delivery and estimator prices.
   ========================================================================== */
(function () {
  'use strict';

  /* =============================== CONFIG =============================== */
  const CONFIG = {
    /* Quote form delivery. Pick ONE:
       - web3formsKey: free at https://web3forms.com (paste the access key)
       - formEndpoint: e.g. a Formspree URL like https://formspree.io/f/xxxxxx
       Leave both empty and the form opens the visitor's email app instead. */
    web3formsKey: '',
    formEndpoint: '',
    email: 'hello@goodpressure.com.au',
    phoneDisplay: '0491 570 156',

    /* Estimator (AUD, GST incl.). First size = the "from" price. */
    bundleDiscount: 0.10,          // 2+ services
    estimateSpread: [0.92, 1.15],  // shown as a typical range around the estimate
    services: [
      { id: 'driveway', name: 'Driveway', form: 'Driveway', icon: 'driveway', sizes: [['Single', 179], ['Double', 259], ['Large / long', 349]] },
      { id: 'paths', name: 'Paths & patio', form: 'Paths & patio', icon: 'paths', sizes: [['Small', 99], ['Medium', 169], ['Large', 249]] },
      { id: 'house', name: 'House wash', form: 'House wash', icon: 'house', sizes: [['Single storey', 449], ['Double storey', 649], ['Large / split level', 849]] },
      { id: 'roof', name: 'Roof clean', form: 'Roof', icon: 'roof', sizes: [['Small', 549], ['Medium', 749], ['Large', 949]] },
      { id: 'deck', name: 'Deck', form: 'Deck', icon: 'deck', sizes: [['Up to 20 m²', 179], ['20 to 40 m²', 279], ['40 m²+', 379]] },
      { id: 'solar', name: 'Solar panels', form: 'Solar panels', icon: 'solar', count: { min: 8, max: 40, step: 1, start: 12, base: 81, per: 6, unit: 'panels' } },
    ],
  };
  /* ===================================================================== */

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const html = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const money = (n) => '$' + Math.round(n).toLocaleString('en-AU');
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const onScroll = (fn) => { let q = false; const run = () => { q = false; fn(); }; window.addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(run); } }, { passive: true }); fn(); };
  const S = window.GPSurface;

  const ICONS = {
    driveway: '<path d="M8 21l2.2-17h3.6L16 21"/><path d="M12 7.5v2M12 12.5v2M12 17.5v2"/>',
    paths: '<rect x="3.5" y="15" width="6.5" height="5" rx="1.6"/><rect x="9" y="8.5" width="6.5" height="5" rx="1.6"/><rect x="14.5" y="3" width="6" height="4.5" rx="1.6"/>',
    house: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>',
    roof: '<path d="M2.5 14L12 5.5l9.5 8.5"/><path d="M7.2 10.2h9.6M5.2 12h13.6"/><path d="M5 14v6h14v-6"/>',
    deck: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 9.7v4.6M7 14.3V19"/>',
    solar: '<path d="M4.5 17.5L7 6.5h13l-2.5 11z"/><path d="M5.7 12h13.1M10.6 6.5l-1.4 11M15.4 6.5L14 17.5"/><path d="M11 17.5v3M8.5 20.5h5"/>',
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

  /* --------------------------------------------------------------- nav */
  function initNav() {
    const nav = $('#nav'), toggle = $('.nav__toggle'), menu = $('#menu');
    onScroll(() => nav.classList.toggle('is-solid', window.scrollY > 8));
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      menu.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.setAttribute('aria-hidden', String(!open));
      document.body.style.overflow = open ? 'hidden' : '';
    };
    toggle.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setOpen(false)));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) { setOpen(false); toggle.focus(); } });

    const links = $$('.nav__links a');
    const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const inView = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) inView.add(en.target.id); else inView.delete(en.target.id); });
      byId.forEach((a, id) => a.classList.toggle('is-active', inView.has(id)));
    }, { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((a, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* --------------------------------------------------------------- reveal */
  function initReveal() {
    const els = $$('.rv');
    const settle = (el) => setTimeout(() => el.classList.remove('rv', 'is-in'), 1400);
    if (reduced || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.remove('rv')); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); settle(en.target); }
    }), { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    els.forEach((e) => io.observe(e));
  }

  /* --------------------------------------------------------------- hero */
  function initHero() {
    const hero = $('.hero');
    if (!hero) return;
    const stage = $('.hero__stage', hero), glc = $('.hero__gl', hero), fxc = $('.hero__fx', hero);
    const title = $('.hero__title', hero), fades = $$('.fade', hero), veil = $('.hero__veil', hero);
    const hud = $('.hud', hero), hudLabel = $('.hud__label', hero), hudPct = $('.hud__pct', hero);
    const scrolly = html.classList.contains('scrolly');

    const fail = () => { html.classList.remove('gl', 'scrolly', 'gl-ready'); };
    if (!S || !html.classList.contains('gl')) { fail(); return; }
    let eng;
    try { eng = new S.Engine(glc); } catch (e) { fail(); return; }
    eng.onlost = fail;

    // Wrap each headline word with a zero-size baseline marker so we can paint it into the grime.
    $$('.ln', title).forEach((ln) => {
      ln.innerHTML = ln.textContent.trim().split(/\s+/).map((w) => `<span class="w"><i class="bl"></i>${w}</span>`).join(' ');
    });

    const st = {
      w: 0, h: 0, dpr: 1, rows: 6, margin: 0, t: null,
      pT: 0, pS: 0, clean: 0, spray: 0, dry: 0, shine: -2, shineT: -1,
      reveal: reduced ? 1 : 0, revealStart: 0, textReady: false, mask: null, mw: 0, mh: 0,
      time: 0, visible: true, needs: true, done: false, io: -1, fxLive: false,
    };
    const fx = fxc.getContext('2d');
    let fxDpr = 1;
    const parts = [], mists = [];
    const mist = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(236,246,255,.9)'); g.addColorStop(0.45, 'rgba(236,246,255,.32)'); g.addColorStop(1, 'rgba(236,246,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c;
    })();

    let fontsReady = false;
    const fontSpec = () => { const cs = getComputedStyle(title); return `${cs.fontWeight} 100px ${cs.fontFamily.split(',')[0]}`; };

    function size(force) {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      if (!force && st.t && Math.abs(w - st.w) < 2 && Math.abs(h - st.h) < 2) return;
      st.w = w; st.h = h;
      const mobile = w < 700;
      let dpr = Math.min(window.devicePixelRatio || 1, mobile ? 2 : 1.6);
      const cap = Math.min(eng.maxTex, 4096);
      dpr = Math.min(dpr, cap / w, cap / h, Math.sqrt(5.4e6 / (w * h)));
      st.dpr = dpr;
      const W = Math.round(w * dpr), H = Math.round(h * dpr);
      glc.width = W; glc.height = H;
      st.t = eng.target(W, H, st.t);
      eng.bake(st.t, 'concrete', S.SETTINGS.concrete.ppm * dpr * (mobile ? 1.12 : 1), 1.0);
      st.rows = clamp(Math.round(h / (mobile ? 128 : 150)), 4, 8);
      st.margin = 70 * dpr;
      fxDpr = Math.min(window.devicePixelRatio || 1, 1.5);
      fxc.width = Math.round(w * fxDpr); fxc.height = Math.round(h * fxDpr);
      if (fontsReady) buildText();
      st.needs = true;
    }

    function buildText() {
      const t = st.t;
      if (!t) return;
      const c = document.createElement('canvas'); c.width = t.w; c.height = t.h;
      const x = c.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
      const cs = getComputedStyle(title);
      x.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) * st.dpr}px ${cs.fontFamily}`;
      x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
      const ls = (parseFloat(cs.letterSpacing) || 0) * st.dpr;
      const native = 'letterSpacing' in x;
      if (native) x.letterSpacing = ls + 'px';
      const sr = stage.getBoundingClientRect();
      const upper = cs.textTransform === 'uppercase';
      $$('.w', title).forEach((w) => {
        const r = w.firstElementChild.getBoundingClientRect();
        const txt = upper ? w.textContent.toUpperCase() : w.textContent;
        let px = (r.left - sr.left) * st.dpr;
        const py = (r.top - sr.top) * st.dpr;
        if (native || !ls) x.fillText(txt, px, py);
        else for (const ch of txt) { x.fillText(ch, px, py); px += x.measureText(ch).width + ls; }
      });
      eng.setText(t, c);
      // low-res copy so the intro spray knows where the letters are
      const mw = 200, mh = Math.max(1, Math.round(200 * c.height / c.width));
      const s = document.createElement('canvas'); s.width = mw; s.height = mh;
      const sx = s.getContext('2d'); sx.drawImage(c, 0, 0, mw, mh);
      st.mask = sx.getImageData(0, 0, mw, mh).data; st.mw = mw; st.mh = mh;
      st.textReady = true; st.needs = true;
    }

    const onFonts = () => { if (fontsReady) return; fontsReady = true; buildText(); };
    if (document.fonts && document.fonts.load) {
      document.fonts.load(fontSpec()).then(onFonts, onFonts);
      document.fonts.ready.then(() => { if (fontsReady) buildText(); else onFonts(); });
    } else fontsReady = true;
    setTimeout(onFonts, 3000);

    /* nozzle position in CSS px */
    function head() {
      const prog = st.clean * st.rows;
      const cur = Math.min(Math.floor(prog), st.rows - 1);
      const f = prog - cur, dir = cur % 2 === 0 ? 1 : -1;
      const m = st.margin / st.dpr, span = st.w + 2 * m;
      const rowH = st.h / st.rows;
      return { x: (dir > 0 ? f : 1 - f) * span - m, y0: cur * rowH, rowH, dir };
    }

    function emitSpray(dt) {
      const n = st.spray * 640 * dt;
      const count = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
      if (!count) return;
      const hd = head();
      for (let i = 0; i < count && parts.length < 800; i++) {
        const sp = 260 + Math.random() * 950, ang = (Math.random() - 0.5) * 1.35;
        parts.push({
          x: hd.x + hd.dir * Math.random() * 8, y: hd.y0 + hd.rowH * (0.08 + Math.random() * 0.84),
          vx: hd.dir * Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.75,
          life: 0, max: 0.16 + Math.random() * 0.42, s: 0.6 + Math.random() * 1.7,
        });
      }
      if (Math.random() < st.spray * dt * 16 && mists.length < 9) {
        mists.push({ x: hd.x + hd.dir * (10 + Math.random() * 24), y: hd.y0 + hd.rowH * (0.15 + Math.random() * 0.7), r: 22 + Math.random() * 30, vx: hd.dir * (90 + Math.random() * 110), vy: (Math.random() - 0.5) * 24, life: 0, max: 0.3 + Math.random() * 0.35 });
      }
    }

    function emitReveal() {
      if (!st.mask) return;
      const rv = st.reveal * 1.15 - 0.06;
      for (let i = 0; i < 46 && parts.length < 800; i++) {
        const yn = Math.random(), xn = (rv - yn * 0.18) / 0.82;
        if (xn < 0 || xn > 1) continue;
        const mx = Math.min(st.mw - 1, Math.floor(xn * st.mw)), my = Math.min(st.mh - 1, Math.floor(yn * st.mh));
        if (st.mask[(my * st.mw + mx) * 4] < 110) continue;
        const sp = 180 + Math.random() * 520, ang = (Math.random() - 0.5) * 2.2;
        parts.push({ x: xn * st.w, y: yn * st.h, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.7, life: 0, max: 0.14 + Math.random() * 0.3, s: 0.6 + Math.random() * 1.4 });
      }
    }

    function drawFx(dt) {
      fx.setTransform(fxDpr, 0, 0, fxDpr, 0, 0);
      fx.clearRect(0, 0, st.w, st.h);
      for (let i = mists.length - 1; i >= 0; i--) {
        const m = mists[i];
        m.life += dt;
        if (m.life > m.max) { mists[i] = mists[mists.length - 1]; mists.pop(); continue; }
        m.x += m.vx * dt; m.y += m.vy * dt;
        const k = m.life / m.max, r = m.r * (1 + k * 1.3);
        fx.globalAlpha = 0.07 * Math.sin(Math.PI * k);
        fx.drawImage(mist, m.x - r, m.y - r, r * 2, r * 2);
      }
      fx.globalAlpha = 1;
      fx.lineCap = 'round';
      const drag = Math.pow(0.06, dt);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        if (p.life > p.max) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
        p.vx *= drag; p.vy *= drag;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const a = 1 - p.life / p.max;
        fx.strokeStyle = 'rgba(238,247,255,' + (a * 0.78).toFixed(3) + ')';
        fx.lineWidth = p.s;
        fx.beginPath(); fx.moveTo(p.x, p.y); fx.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018); fx.stroke();
      }
      st.fxLive = parts.length > 0 || mists.length > 0;
    }

    let lastPct = -1, lastLabel = '';
    function ui() {
      const io = clamp(st.pS / 0.03, 0, 1);
      if (io !== st.io) {
        st.io = io;
        fades.forEach((el) => {
          el.style.opacity = String(1 - io);
          el.style.transform = io ? `translateY(${(-io * 26).toFixed(1)}px)` : '';
          el.style.visibility = io > 0.99 ? 'hidden' : '';
        });
      }
      veil.style.setProperty('--veil', (1 - st.clean * 0.92).toFixed(3));
      const pct = Math.round(st.clean * 100);
      if (pct !== lastPct) { lastPct = pct; hudPct.textContent = pct + '%'; hud.style.setProperty('--p', st.clean.toFixed(3)); }
      const c = st.clean;
      const label = c <= 0.001 ? 'Scroll to clean' : c < 0.3 ? 'Lifting the grime' : c < 0.58 ? 'Mould & lichen, gone' : c < 0.85 ? 'Oil stains, gone' : c < 0.999 ? 'Almost there' : 'Spotless';
      if (label !== lastLabel) { lastLabel = label; hudLabel.textContent = label; }
      const done = c >= 0.999;
      if (done !== st.done) { st.done = done; hero.classList.toggle('is-done', done); }
    }

    let raf = 0, last = performance.now();
    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      st.time = (st.time + dt) % 600;
      size(false);

      const run = hero.offsetHeight - stage.offsetHeight;
      st.pT = scrolly && run > 0 ? clamp(-hero.getBoundingClientRect().top / run, 0, 1) : 0;
      st.pS += (st.pT - st.pS) * (1 - Math.exp(-dt * 8.5));
      if (Math.abs(st.pT - st.pS) < 0.00002) st.pS = st.pT;
      const prev = st.clean;
      st.clean = clamp((st.pS - 0.04) / 0.84, 0, 1);
      const dC = st.clean - prev;

      const target = dC > 0 ? clamp((dC / dt) * st.rows * 0.9, 0, 1) : 0;
      st.spray += (target - st.spray) * (1 - Math.exp(-dt * (target > st.spray ? 16 : 6)));
      if (st.spray < 0.003) st.spray = 0;

      if (st.clean >= 0.999) {
        st.dry = Math.min(1, st.dry + dt / 1.5);
        if (st.shineT < 0 && st.dry > 0.55) st.shineT = 0;
      } else { st.dry = Math.max(0, st.dry - dt * 2); st.shineT = -1; }
      if (st.shineT >= 0 && st.shineT < 1.6) { st.shineT += dt; st.shine = -0.3 + st.shineT * 1.1; } else st.shine = -2;

      let revealing = false;
      if (st.textReady && st.reveal < 1) {
        if (!st.revealStart) st.revealStart = now + 380;
        const r = clamp((now - st.revealStart) / 1350, 0, 1);
        st.reveal = r >= 1 ? 1 : easeInOut(r);
        revealing = true;
        if (now > st.revealStart && r < 1) emitReveal();
      }

      ui();
      if (st.spray > 0) emitSpray(dt);

      if (st.t && (st.needs || dC !== 0 || st.spray > 0 || revealing || (st.dry > 0 && st.dry < 1) || st.shine > -2)) {
        eng.draw(st.t, {
          prog: st.clean * st.rows, rows: st.rows, margin: st.margin, time: st.time, spray: st.spray,
          textReveal: st.reveal, dry: st.dry, shine: st.shine, wetDark: S.SETTINGS.concrete.wetDark, vig: 0.32,
        });
        st.needs = false;
        if (!html.classList.contains('gl-ready')) html.classList.add('gl-ready');
      }
      if (st.fxLive || parts.length || mists.length) drawFx(dt);

      if (st.visible) raf = requestAnimationFrame(frame);
    }

    size(true);
    const vis = new IntersectionObserver((es) => {
      st.visible = es[0].isIntersecting;
      if (st.visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    });
    vis.observe(stage);
    window.addEventListener('resize', debounce(() => size(false), 120));
    raf = requestAnimationFrame(frame);
  }

  /* --------------------------------------------------------------- service cards */
  function initCards() {
    const cards = $$('[data-surface-card]');
    if (!cards.length) return;
    const eng = S && html.classList.contains('gl') ? S.shared() : null;
    if (!eng) { document.body.classList.add('no-surface'); return; }

    const items = cards.map((el, i) => ({
      el, canvas: $('canvas', el), meter: $('.svc__meter', el), mat: el.dataset.surface,
      seed: 1.7 + i * 2.31, p: 0, pS: 0, spray: 0, dry: 0, t: null, ctx: null, visible: false, need: true,
    }));
    let raf = 0, last = 0, time = 0;
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const it = items.find((x) => x.el === e.target);
      it.visible = e.isIntersecting;
      if (it.visible) kick();
    }), { rootMargin: '240px 0px' });
    items.forEach((it) => io.observe(it.el));

    function prepare(it) {
      const r = it.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(2, Math.round(r.width * dpr)), H = Math.max(2, Math.round(r.height * dpr));
      if (it.t && it.t.w === W && it.t.h === H) return dpr;
      it.canvas.width = W; it.canvas.height = H;
      it.ctx = it.canvas.getContext('2d');
      it.t = eng.target(W, H, it.t);
      eng.bake(it.t, it.mat, S.SETTINGS[it.mat].ppm * dpr, it.seed);
      it.need = true;
      return dpr;
    }

    function loop(now) {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now; time = (time + dt) % 600;
      const vh = window.innerHeight;
      let any = false;
      items.forEach((it) => {
        if (!it.visible) return;
        any = true;
        const dpr = prepare(it);
        const r = it.el.getBoundingClientRect();
        it.p = reduced ? 1 : clamp((vh * 0.9 - r.top) / (vh * 0.48), 0, 1);
        const prev = it.pS;
        it.pS += (it.p - it.pS) * (1 - Math.exp(-dt * 5.5));
        if (Math.abs(it.p - it.pS) < 0.0004) it.pS = it.p;
        const d = it.pS - prev, cfg = S.SETTINGS[it.mat];
        const tgt = d > 0 ? clamp((d / dt) * cfg.rows * 0.85, 0, 1) : 0;
        it.spray += (tgt - it.spray) * (1 - Math.exp(-dt * (tgt > it.spray ? 14 : 5)));
        if (it.spray < 0.004) it.spray = 0;
        it.dry = it.pS >= 0.999 ? Math.min(1, it.dry + dt / 1.2) : Math.max(0, it.dry - dt * 2);
        if (it.need || d !== 0 || it.spray > 0 || (it.dry > 0 && it.dry < 1)) {
          eng.blit(it.t, {
            prog: it.pS * cfg.rows, rows: cfg.rows, vertical: cfg.vertical, margin: 26 * dpr, time,
            spray: it.spray, dry: it.dry, wetDark: cfg.wetDark, vig: 0.36,
          }, it.ctx);
          it.meter.style.setProperty('--p', it.pS.toFixed(3));
          it.el.classList.toggle('is-clean', it.pS >= 0.999);
          it.need = false;
        }
      });
      if (any) raf = requestAnimationFrame(loop);
    }
    window.addEventListener('resize', debounce(kick, 150));
  }

  /* --------------------------------------------------------------- before / after */
  function initBA() {
    const root = $('[data-ba]');
    if (!root) return;
    const frame = $('.ba__frame', root), div = $('.ba__divider', root);
    const cB = $('.ba__img--before', root), cA = $('.ba__img--after', root);
    const pB = $('.ba__photo--before', root), pA = $('.ba__photo--after', root);
    const tabs = $$('[role="tab"]', root);
    const eng = S && html.classList.contains('gl') ? S.shared() : null;
    let split = 50, t = null, dragging = false, touched = false, started = false, startX = 0, startY = 0, decided = false, pointerType = '';

    const setSplit = (v) => {
      split = clamp(v, 0, 100);
      frame.style.setProperty('--split', split.toFixed(2) + '%');
      div.setAttribute('aria-valuenow', String(Math.round(split)));
      div.setAttribute('aria-valuetext', `${Math.round(100 - split)}% after`);
    };

    function render() {
      const tab = tabs.find((b) => b.getAttribute('aria-selected') === 'true') || tabs[0];
      const mat = tab.dataset.surface;
      if (tab.dataset.before && tab.dataset.after) {
        pB.src = tab.dataset.before; pA.src = tab.dataset.after;
        pB.alt = `${tab.textContent} before cleaning`; pA.alt = `${tab.textContent} after cleaning`;
        pB.hidden = pA.hidden = false; cB.hidden = cA.hidden = true;
        return;
      }
      pB.hidden = pA.hidden = true; cB.hidden = cA.hidden = false;
      if (!eng) return;
      const r = frame.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      const k = Math.min(1, 2200 / W);
      W = Math.max(2, Math.round(W * k)); H = Math.max(2, Math.round(H * k));
      t = eng.target(W, H, t);
      const zoom = { concrete: 1.7, pavers: 1.15, tiles: 1.1, timber: 1.1, brick: 1.15 }[mat] || 1;
      eng.bake(t, mat, S.SETTINGS[mat].ppm * dpr * k * zoom, 4.2);
      cB.width = cA.width = W; cB.height = cA.height = H;
      eng.blit(t, { full: -1, vig: 0.22, wetDark: 0.7 }, cB.getContext('2d'));
      eng.blit(t, { full: 1, vig: 0.22, wetDark: 0.7 }, cA.getContext('2d'));
    }

    const pick = (i, focus) => {
      tabs.forEach((b, j) => { b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; });
      if (focus) tabs[i].focus();
      render();
    };
    tabs.forEach((b, i) => {
      b.tabIndex = i === 0 ? 0 : -1;
      b.addEventListener('click', () => pick(i));
      b.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          pick((i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length, true);
        }
      });
    });

    const pct = (e) => { const r = frame.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };
    frame.addEventListener('pointerdown', (e) => {
      dragging = true; decided = false; pointerType = e.pointerType; startX = e.clientX; startY = e.clientY; touched = true;
      if (pointerType === 'mouse') { decided = true; root.classList.add('is-dragging'); setSplit(pct(e)); frame.setPointerCapture(e.pointerId); }
    });
    frame.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      if (!decided) {
        const dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY);
        if (dx < 6 && dy < 6) return;
        if (dy > dx) { dragging = false; return; }
        decided = true; root.classList.add('is-dragging'); frame.setPointerCapture(e.pointerId);
      }
      setSplit(pct(e));
    });
    const end = (e) => {
      if (dragging && !decided && pointerType !== 'mouse' && e.type === 'pointerup') setSplit(pct(e));
      dragging = false; root.classList.remove('is-dragging');
    };
    frame.addEventListener('pointerup', end);
    frame.addEventListener('pointercancel', end);
    div.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 4;
      if (e.key === 'ArrowLeft') { setSplit(split - step); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setSplit(split + step); e.preventDefault(); }
      else if (e.key === 'Home') { setSplit(0); e.preventDefault(); }
      else if (e.key === 'End') { setSplit(100); e.preventDefault(); }
      touched = true;
    });

    function teaser() {
      if (reduced || touched) return;
      const keys = [[0, 50], [0.32, 24], [0.7, 76], [1, 50]], dur = 2600, t0 = performance.now();
      const step = (now) => {
        if (touched) return;
        const k = clamp((now - t0) / dur, 0, 1);
        let i = 0; while (i < keys.length - 2 && k > keys[i + 1][0]) i++;
        const a = keys[i], b = keys[i + 1], local = (k - a[0]) / (b[0] - a[0]);
        setSplit(a[1] + (b[1] - a[1]) * easeInOut(clamp(local, 0, 1)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      if (!started) { started = true; render(); setTimeout(teaser, 500); }
    }, { rootMargin: '300px 0px', threshold: 0 });
    io.observe(frame);
    const seen = new IntersectionObserver((es) => { if (es[0].isIntersecting && started) { seen.disconnect(); } }, { threshold: 0.6 });
    seen.observe(frame);
    let lastW = 0;
    window.addEventListener('resize', debounce(() => { const w = frame.clientWidth; if (started && Math.abs(w - lastW) > 4) { lastW = w; render(); } }, 200));
    setSplit(50);
  }

  /* --------------------------------------------------------------- gauge */
  function initGauge() {
    const g = $('[data-gauge]');
    if (!g) return;
    const ticks = $('.gauge__ticks', g), needle = $('.gauge__needle', g), value = $('.gauge__value', g);
    const num = $('.gauge__num', g), zoneName = $('.gauge__zone-name', g);
    const mTitle = $('.gauge__method-title'), mNote = $('.gauge__method-note');
    const chips = $$('.chip-btn');
    const MAX = 4000, LEN = 754, A0 = -135, A1 = 135;
    let markup = '';
    for (let v = 0; v <= MAX; v += 250) {
      const a = (A0 + (v / MAX) * (A1 - A0)) * Math.PI / 180, major = v % 1000 === 0;
      const r1 = 137, r2 = major ? 119 : 128;
      markup += `<line class="${major ? 'major' : ''}" x1="${(200 + r1 * Math.sin(a)).toFixed(1)}" y1="${(200 - r1 * Math.cos(a)).toFixed(1)}" x2="${(200 + r2 * Math.sin(a)).toFixed(1)}" y2="${(200 - r2 * Math.cos(a)).toFixed(1)}"/>`;
      if (major) markup += `<text x="${(200 + 188 * Math.sin(a)).toFixed(1)}" y="${(200 - 188 * Math.cos(a)).toFixed(1)}">${v ? v / 1000 + 'k' : '0'}</text>`;
    }
    ticks.innerHTML = markup;

    let cur = 0, idx = 0, auto = true, timer = 0, raf = 0;
    const countTo = (to) => {
      const from = cur, t0 = performance.now();
      cancelAnimationFrame(raf);
      const step = (now) => {
        const k = clamp((now - t0) / 950, 0, 1), e = 1 - Math.pow(1 - k, 3);
        cur = Math.round(from + (to - from) * e);
        num.textContent = cur.toLocaleString('en-AU');
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const set = (i, user) => {
      idx = i;
      const b = chips[i], psi = +b.dataset.psi;
      chips.forEach((c, j) => c.setAttribute('aria-pressed', String(j === i)));
      needle.style.setProperty('--a', (A0 + (psi / MAX) * (A1 - A0)).toFixed(2) + 'deg');
      value.style.strokeDashoffset = String(LEN * (1 - psi / MAX));
      mTitle.textContent = b.dataset.method;
      mNote.textContent = b.dataset.note;
      zoneName.textContent = psi <= 600 ? 'Soft wash zone' : psi <= 2000 ? 'Medium pressure' : 'High pressure';
      if (reduced) { cur = psi; num.textContent = psi.toLocaleString('en-AU'); } else countTo(psi);
      if (user) { auto = false; clearInterval(timer); }
    };
    chips.forEach((c, i) => c.addEventListener('click', () => set(i, true)));
    num.textContent = '0';
    needle.style.setProperty('--a', A0 + 'deg');
    const io = new IntersectionObserver((es) => {
      const vis = es[0].isIntersecting;
      clearInterval(timer);
      if (!vis) return;
      if (!g.dataset.started) { g.dataset.started = '1'; setTimeout(() => set(0), 200); }
      if (auto && !reduced) timer = setInterval(() => { if (auto) set((idx + 1) % chips.length); }, 3300);
    }, { threshold: 0.35 });
    io.observe(g);
  }

  /* --------------------------------------------------------------- process water line */
  function initSteps() {
    const list = $('[data-steps]');
    if (!list) return;
    const steps = $$('.step', list);
    onScroll(() => {
      const r = list.getBoundingClientRect(), vh = window.innerHeight;
      const fill = clamp((vh * 0.62 - r.top - 22) / (r.height - 44), 0, 1);
      list.style.setProperty('--fill', fill.toFixed(4));
      list.style.setProperty('--tip', fill > 0.001 && fill < 0.999 ? '1' : '0');
      const y = r.top + 22 + fill * (r.height - 44);
      steps.forEach((s) => s.classList.toggle('is-wet', s.getBoundingClientRect().top + 18 <= y));
    });
  }

  /* --------------------------------------------------------------- estimator */
  const estimate = { items: [], total: 0, lo: 0, hi: 0 };
  function initEstimator() {
    const root = $('[data-estimator]');
    if (!root) return;
    const opts = $('[data-est-options]', root), totalEl = $('[data-est-total]', root), rangeEl = $('[data-est-range]', root);
    const lines = $('[data-est-lines]', root), save = $('[data-est-save]', root), cta = $('[data-est-cta]', root);
    const state = {};
    CONFIG.services.forEach((s) => { state[s.id] = { on: false, size: 0, count: s.count ? s.count.start : 0 }; });

    opts.innerHTML = CONFIG.services.map((s) => {
      const from = s.sizes ? s.sizes[0][1] : s.count.base + s.count.per * s.count.min;
      const choose = s.sizes
        ? s.sizes.map((z, i) => `<button class="size" type="button" data-size="${i}" aria-pressed="${i === 0}">${z[0]}</button>`).join('')
        : `<label class="opt__range"><span class="opt__range-row"><span>Number of ${s.count.unit}</span><b data-count>${s.count.start}</b></span><input type="range" min="${s.count.min}" max="${s.count.max}" step="${s.count.step}" value="${s.count.start}" aria-label="Number of ${s.count.unit}"></label>`;
      return `<div class="opt" data-id="${s.id}">
        <button class="opt__toggle" type="button" aria-pressed="false">
          <span class="opt__icon">${icon(s.icon)}</span>
          <span class="opt__text"><span class="opt__name">${s.name}</span><span class="opt__from">from ${money(from)}</span></span>
          <span class="opt__check" aria-hidden="true"><svg><use href="#i-check"/></svg></span>
        </button>
        <div class="opt__sizes" role="group" aria-label="${s.name} size">${choose}</div>
      </div>`;
    }).join('');

    let shown = 0, raf = 0;
    const animateTotal = (to) => {
      const from = shown, t0 = performance.now();
      cancelAnimationFrame(raf);
      const step = (now) => {
        const k = reduced ? 1 : clamp((now - t0) / 650, 0, 1), e = 1 - Math.pow(1 - k, 3);
        shown = from + (to - from) * e;
        totalEl.textContent = money(shown);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    function compute() {
      let sum = 0;
      estimate.items = [];
      CONFIG.services.forEach((s) => {
        const v = state[s.id];
        if (!v.on) return;
        let price, label;
        if (s.sizes) { price = s.sizes[v.size][1]; label = `${s.name} · ${s.sizes[v.size][0]}`; }
        else { price = s.count.base + s.count.per * v.count; label = `${s.name} · ${v.count} ${s.count.unit}`; }
        sum += price;
        estimate.items.push({ label, price, form: s.form });
      });
      const n = estimate.items.length;
      const disc = n >= 2 ? sum * CONFIG.bundleDiscount : 0;
      const total = sum - disc;
      estimate.total = total;
      estimate.lo = Math.floor((total * CONFIG.estimateSpread[0]) / 10) * 10;
      estimate.hi = Math.ceil((total * CONFIG.estimateSpread[1]) / 10) * 10;
      animateTotal(total);
      rangeEl.textContent = n ? `Typical range ${money(estimate.lo)} to ${money(estimate.hi)}` : 'Pick a service to get started.';
      lines.innerHTML = estimate.items.map((i) => `<li><span>${i.label}</span><span>${money(i.price)}</span></li>`).join('');
      save.hidden = !disc;
      if (disc) $('span', save).textContent = `Bundle discount: ${money(disc)} off`;
    }

    $$('.opt', opts).forEach((el) => {
      const id = el.dataset.id, v = state[id], tog = $('.opt__toggle', el);
      tog.addEventListener('click', () => {
        v.on = !v.on;
        el.classList.toggle('is-on', v.on);
        tog.setAttribute('aria-pressed', String(v.on));
        compute();
      });
      $$('.size', el).forEach((b) => b.addEventListener('click', () => {
        v.size = +b.dataset.size;
        $$('.size', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        compute();
      }));
      const range = $('input[type="range"]', el);
      if (range) range.addEventListener('input', () => { v.count = +range.value; $('[data-count]', el).textContent = range.value; compute(); });
    });

    cta.addEventListener('click', () => {
      const form = $('#quote-form');
      if (!form || !estimate.items.length) return;
      const wanted = new Set(estimate.items.map((i) => i.form));
      $$('input[name="services"]', form).forEach((c) => { if (wanted.has(c.value)) c.checked = true; });
      const msg = form.elements.message;
      const note = `Instant estimate: ${money(estimate.lo)} to ${money(estimate.hi)} for ${estimate.items.map((i) => i.label).join(', ')}.`;
      if (!msg.value.includes('Instant estimate:')) msg.value = msg.value ? `${note}\n${msg.value}` : note;
    });
    compute();
  }

  /* --------------------------------------------------------------- FAQ */
  function initFAQ() {
    $$('.qa').forEach((d) => {
      const s = $('summary', d), a = $('.qa__a', d);
      s.addEventListener('click', (e) => {
        if (reduced) return;
        e.preventDefault();
        if (d.classList.contains('is-anim')) return;
        d.classList.add('is-anim');
        const finish = () => { a.style.cssText = ''; d.classList.remove('is-anim', 'is-closing'); };
        if (d.open) {
          d.classList.add('is-closing');
          a.style.height = a.scrollHeight + 'px';
          requestAnimationFrame(() => requestAnimationFrame(() => { a.style.transition = 'height .4s cubic-bezier(.2,.75,.2,1)'; a.style.height = '0px'; }));
          setTimeout(() => { d.open = false; finish(); }, 420);
        } else {
          d.open = true;
          const h = a.scrollHeight;
          a.style.height = '0px';
          requestAnimationFrame(() => requestAnimationFrame(() => { a.style.transition = 'height .45s cubic-bezier(.2,.75,.2,1)'; a.style.height = h + 'px'; }));
          setTimeout(finish, 470);
        }
      });
    });
  }

  /* --------------------------------------------------------------- quote form */
  function initForm() {
    const form = $('#quote-form');
    if (!form) return;
    const body = $('.form__body', form), done = $('.form__done', form), err = $('.form__error', form);
    const F = form.elements;
    const mark = (name, bad) => { const f = F[name].closest('.field'); if (f) f.classList.toggle('is-invalid', bad); return bad; };

    form.addEventListener('input', (e) => { const f = e.target.closest('.field'); if (f) f.classList.remove('is-invalid'); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      if (F.company.value) return; // honeypot
      const bad = [];
      if (mark('name', !F.name.value.trim())) bad.push(F.name);
      if (mark('phone', F.phone.value.replace(/\D/g, '').length < 8)) bad.push(F.phone);
      const em = F.email.value.trim();
      if (mark('email', !!em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))) bad.push(F.email);
      if (mark('suburb', !F.suburb.value.trim())) bad.push(F.suburb);
      if (bad.length) { err.textContent = 'Please check the highlighted fields.'; err.hidden = false; bad[0].focus(); return; }

      const services = $$('input[name="services"]:checked', form).map((c) => c.value);
      const data = {
        name: F.name.value.trim(), phone: F.phone.value.trim(), email: em, suburb: F.suburb.value.trim(),
        services: services.join(', '), message: F.message.value.trim(),
      };
      form.classList.add('is-sending');
      try {
        if (CONFIG.web3formsKey) {
          const r = await fetch('https://api.web3forms.com/submit', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ access_key: CONFIG.web3formsKey, subject: `New quote request: ${data.name} (${data.suburb})`, from_name: 'Good Pressure website', ...data }),
          });
          const j = await r.json();
          if (!j.success) throw new Error(j.message || 'send failed');
        } else if (CONFIG.formEndpoint) {
          const r = await fetch(CONFIG.formEndpoint, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
          if (!r.ok) throw new Error('send failed');
        } else {
          const lines = [`Name: ${data.name}`, `Phone: ${data.phone}`, `Email: ${data.email || '-'}`, `Suburb: ${data.suburb}`, `Services: ${data.services || '-'}`, '', data.message];
          window.location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Quote request: ' + data.suburb)}&body=${encodeURIComponent(lines.join('\n'))}`;
        }
        body.hidden = true;
        done.hidden = false;
        done.focus();
      } catch (ex) {
        err.textContent = `Sorry, that didn't go through. Please call or text ${CONFIG.phoneDisplay}.`;
        err.hidden = false;
      } finally {
        form.classList.remove('is-sending');
      }
    });
  }

  /* --------------------------------------------------------------- footer wordmark */
  function initFooter() {
    const g = $('.footer__giant');
    if (!g) return;
    // Scale the giant wordmark so it always spans the page, whatever the brand name is.
    const word = $('.giant--dirty', g);
    const fit = () => {
      g.style.fontSize = '100px';
      const w = word.getBoundingClientRect().width;
      if (w) g.style.fontSize = (100 * (g.clientWidth * 0.965) / w).toFixed(2) + 'px';
    };
    fit();
    if (document.fonts) document.fonts.ready.then(fit);
    window.addEventListener('resize', debounce(fit, 100));
    onScroll(() => {
      const r = g.getBoundingClientRect();
      const p = reduced ? 1 : clamp((window.innerHeight - r.top) / (r.height + 40), 0, 1);
      g.style.setProperty('--fp', p.toFixed(4));
    });
  }

  /* --------------------------------------------------------------- mobile dock */
  function initDock() {
    const dock = $('[data-dock]'), hero = $('.hero'), quote = $('#quote'), footer = $('.footer');
    if (!dock || !hero) return;
    onScroll(() => {
      const vh = window.innerHeight;
      const past = hero.getBoundingClientRect().bottom < vh * 1.05;
      const q = quote.getBoundingClientRect(), f = footer.getBoundingClientRect();
      const hide = (q.top < vh * 0.75 && q.bottom > 0) || f.top < vh * 0.9;
      dock.classList.toggle('is-shown', past && !hide);
    });
  }

  /* --------------------------------------------------------------- boot */
  function boot() {
    [initNav, initReveal, initHero, initCards, initBA, initGauge, initSteps, initEstimator, initFAQ, initForm, initFooter, initDock].forEach((fn) => {
      try { fn(); } catch (e) { console.error('[goodpressure]', fn.name, e); }
    });
    $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
    // Preview helpers: ?y=1200 scrolls to a pixel offset, ?to=pricing scrolls to a section.
    const q = new URLSearchParams(location.search);
    if (q.has('y') || q.has('to')) {
      html.style.scrollBehavior = 'auto';
      const go = () => {
        const el = q.get('to') && document.getElementById(q.get('to'));
        window.scrollTo(0, el ? el.getBoundingClientRect().top + window.scrollY : +q.get('y') || 0);
      };
      go(); setTimeout(go, 300);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
