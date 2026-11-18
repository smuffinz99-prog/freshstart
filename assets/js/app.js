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

  /* ============================== PHOTOS ==============================
     Before/after photo pairs (WebP in assets/img/photos/).
     Your own job photos: save them with the same file names, both shots
     taken from the same spot. If you replace the hero photos, set slab
     to null so the cleaning strips simply run across the screen.          */
  const PHOTOS = {
    path: 'assets/img/photos/',
    sizes: [720, 1280], /* card + slider files: <name>-<before|after>-<size>.webp */
    hero: {
      desktop: { after: 'hero-after-desktop.webp', before: 'hero-before-desktop.webp', size: [1920, 1080], beforeRect: [0, 0.509, 0.98, 1], crop: [0, 333, 3200, 1800], focus: [0.6, 1] },
      mobile: { after: 'hero-after-mobile.webp', before: 'hero-before-mobile.webp', size: [750, 1538], beforeRect: [0, 0.586, 1, 1], crop: [1720, 0, 1040, 2133], focus: [0.5, 1] },
      /* one concrete slab in the original 3200x2133 photo: front-left, front-right, back-left, back-right (px) */
      slab: [[1552, 1926], [3733, 2428], [1903, 1527], [2841, 1632]],
    },
  };

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
    const fades = $$('.fade', hero), veil = $('.hero__veil', hero);
    const hud = $('.hud', hero), hudLabel = $('.hud__label', hero), hudPct = $('.hud__pct', hero);
    const scrolly = html.classList.contains('scrolly');
    const variantFor = (w, h) => (w / h < 0.8 ? 'mobile' : 'desktop');

    /* No WebGL: show the clean photo as a still. */
    const fail = () => {
      html.classList.remove('gl', 'scrolly', 'gl-ready');
      const v = PHOTOS.hero[variantFor(stage.clientWidth || innerWidth, stage.clientHeight || innerHeight)];
      stage.style.backgroundImage = `url(${PHOTOS.path + v.after})`;
      stage.style.backgroundSize = 'cover';
      stage.style.backgroundPosition = `${v.focus[0] * 100}% ${v.focus[1] * 100}%`;
      hero.classList.add('hero--static');
    };

    /* Show the dirty photo straight away as plain CSS layers (clean shot + dirty strip on top, placed
       exactly like the WebGL view), so slow connections never see an empty hero. WebGL fades in over it. */
    const placeholder = () => {
      if (html.classList.contains('gl-ready')) return;
      const w = stage.clientWidth, h = stage.clientHeight;
      const v = PHOTOS.hero[variantFor(w, h)], [iw, ih] = v.size, b = v.beforeRect;
      const s = Math.max(w / iw, h / ih), W = iw * s, H = ih * s;
      const ox = (w - W) * v.focus[0], oy = (h - H) * v.focus[1];
      stage.style.backgroundImage = `url(${PHOTOS.path + v.before}), url(${PHOTOS.path + v.after})`;
      stage.style.backgroundSize = `${(b[2] - b[0]) * W}px ${(b[3] - b[1]) * H}px, ${W}px ${H}px`;
      stage.style.backgroundPosition = `${ox + b[0] * W}px ${oy + b[1] * H}px, ${ox}px ${oy}px`;
    };

    if (!S || !html.classList.contains('gl')) { fail(); return; }
    placeholder();
    window.addEventListener('resize', debounce(placeholder, 120));
    let eng;
    try { eng = new S.Engine(glc); } catch (e) { fail(); return; }
    eng.onlost = fail;

    const st = {
      w: 0, h: 0, dpr: 1, vname: '', v: null, pair: null, map: [1, 1, 0, 0], H: null, Hinv: null,
      sweep: [0, 1, 0, 1], vmap: [0, 0, 0, 1], rows: 5, margin: 0.04,
      pT: 0, pS: 0, clean: 0, spray: 0, dry: 0, shine: -2, shineT: -1,
      time: 0, visible: true, needs: true, done: false, io: -1, fxLive: false,
      q: 2, fAcc: 0, fN: 0, pk: 1,
    };
    const perf = /[?&]perf=1/.test(location.search) ? (window.__gpFrames = []) : null;
    const fx = fxc.getContext('2d');
    let fxDpr = 1;
    const parts = [], mists = [];
    const mist = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(236,246,255,.9)'); g.addColorStop(0.45, 'rgba(236,246,255,.32)'); g.addColorStop(1, 'rgba(236,246,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c;
    })();

    async function loadVariant(name) {
      if (st.vname === name) return;
      st.vname = name;
      const v = PHOTOS.hero[name];
      try {
        const [after, before] = await Promise.all([S.loadImage(PHOTOS.path + v.after), S.loadImage(PHOTOS.path + v.before)]);
        if (st.vname !== name) return;
        if (st.pair) eng.release(st.pair);
        st.pair = eng.pair(after, before, v.beforeRect);
        st.v = v;
        if (PHOTOS.hero.slab && v.crop) {
          const [cx, cy, cw, ch] = v.crop;
          st.H = S.homography(PHOTOS.hero.slab.map(([x, y]) => [(x - cx) / cw, (y - cy) / ch]), [[0, 0], [1, 0], [0, 1], [1, 1]]);
          st.Hinv = S.invert3(st.H);
        } else { st.H = st.Hinv = null; }
        layout();
      } catch (e) { fail(); }
    }

    /* Fit the photo to the screen and work out how far the cleaning strips need to reach. */
    function layout() {
      const p = st.pair;
      if (!p) return;
      st.map = S.coverMap(st.w, st.h, p.iw, p.ih, st.v.focus[0], st.v.focus[1]);
      if (st.H) {
        let a0 = 1e9, a1 = -1e9, c0 = -1e9, c1 = 1e9;
        for (let gy = 0; gy <= 48; gy++) for (let gx = 0; gx <= 48; gx++) {
          const ix = (gx / 48) * st.map[0] + st.map[2], iy = (gy / 48) * st.map[1] + st.map[3];
          if (eng.maskAt(p, ix, iy) < 0.3) continue;
          const [u, v] = S.apply3(st.H, ix, iy);
          a0 = Math.min(a0, u); a1 = Math.max(a1, u); c0 = Math.max(c0, v); c1 = Math.min(c1, v);
        }
        if (!(a1 > a0)) { a0 = 0; a1 = 1; c0 = 1; c1 = 0; }
        /* strips follow the driveway joints but are spaced evenly on screen,
           starting at the garage and working towards you */
        const m = st.Hinv, um = (a0 + a1) / 2;
        st.vmap = [m[4], m[3] * um + m[5], m[7], m[6] * um + m[8]];
        const Y = (v) => (st.vmap[0] * v + st.vmap[1]) / (st.vmap[2] * v + st.vmap[3]);
        st.sweep = [a0, a1, Y(c0), Y(c1)];
        st.rows = 5;
      } else {
        st.sweep = [0, 1, 0, 1];
        st.rows = clamp(Math.round(st.h / (st.w < 700 ? 130 : 150)), 4, 8);
      }
      st.needs = true;
    }

    function size(force) {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      if (!force && st.w && Math.abs(w - st.w) < 2 && Math.abs(h - st.h) < 2) return;
      st.w = w; st.h = h;
      const mobile = w < 700;
      const caps = mobile ? [1, 1.3, 1.75] : [1, 1.2, 1.5];
      let dpr = Math.min(window.devicePixelRatio || 1, caps[st.q]);
      dpr = Math.min(dpr, eng.maxTex / w, eng.maxTex / h, Math.sqrt(4.5e6 / (w * h)));
      st.dpr = dpr;
      glc.width = Math.round(w * dpr); glc.height = Math.round(h * dpr);
      fxDpr = Math.min(window.devicePixelRatio || 1, 1.5);
      fxc.width = Math.round(w * fxDpr); fxc.height = Math.round(h * fxDpr);
      const want = variantFor(w, h);
      if (want !== st.vname) loadVariant(want); else layout();
      st.needs = true;
    }

    /* sweep coords (a along the strip, c across strips, both 0..1) -> screen px */
    function toScreen(a, c) {
      const u = st.sweep[0] + a * (st.sweep[1] - st.sweep[0]);
      let v = st.sweep[2] + c * (st.sweep[3] - st.sweep[2]);
      if (!st.H) return [u * st.w, v * st.h, u, v];
      const [A, B, C, D] = st.vmap; v = (B - v * D) / (v * C - A);
      const [ix, iy] = S.apply3(st.Hinv, u, v);
      return [((ix - st.map[2]) / st.map[0]) * st.w, ((iy - st.map[3]) / st.map[1]) * st.h, ix, iy];
    }

    function emitSpray(dt) {
      if (!st.pair) return;
      const prog = st.clean * st.rows, cur = Math.min(Math.floor(prog), st.rows - 1), f = prog - cur;
      const span = 1 + 2 * st.margin, dir = cur % 2 === 0 ? 1 : -1;
      const a = (dir > 0 ? f : 1 - f) * span - st.margin;
      const h0 = toScreen(a, (cur + 0.5) / st.rows);
      if (st.H && eng.maskAt(st.pair, h0[2], h0[3]) < 0.25) return;
      const top = toScreen(a, cur / st.rows), bot = toScreen(a, (cur + 1) / st.rows);
      const ahead = toScreen(a + dir * 0.02, (cur + 0.5) / st.rows);
      let dx = ahead[0] - h0[0], dy = ahead[1] - h0[1];
      const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const rowPx = Math.hypot(bot[0] - top[0], bot[1] - top[1]);
      const k = clamp(rowPx / 140, 0.35, 1.6); st.pk = k;
      const n = st.spray * 560 * dt * k;
      const count = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
      const cap = (st.w < 700 ? 300 : 650) * (st.q === 2 ? 1 : st.q === 1 ? 0.6 : 0.3);
      for (let i = 0; i < count && parts.length < cap; i++) {
        const t = 0.08 + Math.random() * 0.84;
        const px = top[0] + (bot[0] - top[0]) * t, py = top[1] + (bot[1] - top[1]) * t;
        const sp = (240 + Math.random() * 820) * k, ang = (Math.random() - 0.5) * 1.35;
        const c = Math.cos(ang), s = Math.sin(ang);
        parts.push({ x: px, y: py, vx: (dx * c - dy * s) * sp, vy: (dx * s + dy * c) * sp * 0.8, life: 0, max: 0.15 + Math.random() * 0.4, s: (0.5 + Math.random() * 1.5) * k });
      }
      if (Math.random() < st.spray * dt * 14 && mists.length < 8) {
        mists.push({ x: h0[0] + dx * 12 * k, y: h0[1] + dy * 12 * k, r: (22 + Math.random() * 28) * k, vx: dx * 110 * k, vy: dy * 110 * k, life: 0, max: 0.3 + Math.random() * 0.35 });
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
      /* six batched paths (3 opacities x 2 widths) instead of one stroke per droplet */
      const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      let wsum = 0;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        if (p.life > p.max) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
        p.vx *= drag; p.vy *= drag;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const al = 1 - p.life / p.max, P = paths[(al > 0.66 ? 2 : al > 0.33 ? 1 : 0) * 2 + (p.s > 1.15 * st.pk ? 1 : 0)];
        P.moveTo(p.x, p.y); P.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
        wsum += p.s;
      }
      const avg = parts.length ? wsum / parts.length : 1;
      for (let i = 0; i < 6; i++) {
        fx.strokeStyle = ['rgba(238,247,255,.2)', 'rgba(238,247,255,.45)', 'rgba(238,247,255,.7)'][i >> 1];
        fx.lineWidth = (i & 1 ? 1.45 : 0.7) * avg;
        fx.stroke(paths[i]);
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
      veil.style.setProperty('--veil', (st.done ? 1 : 1 - Math.min(1, st.clean * 3) * 0.75).toFixed(3));
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
      const t0 = perf ? performance.now() : 0;
      const raw = (now - last) / 1000;
      const dt = Math.min(0.05, Math.max(0.001, raw));
      last = now;
      /* auto quality: if this device can't keep up while cleaning, render fewer pixels */
      if (st.spray > 0.05 && raw < 0.25) {
        st.fAcc += raw; st.fN++;
        if (st.fN >= 45) {
          if (st.fAcc / st.fN > 0.027 && st.q > 0) { st.q--; size(true); }
          st.fAcc = 0; st.fN = 0;
        }
      }
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

      ui();
      if (st.spray > 0) emitSpray(dt);

      if (st.pair && (st.needs || dC !== 0 || st.spray > 0 || (st.dry > 0 && st.dry < 1) || st.shine > -2)) {
        eng.draw(st.pair, glc.width, glc.height, {
          map: st.map, H: st.H, sweep: st.sweep, vmap: st.vmap, prog: st.clean * st.rows, rows: st.rows, margin: st.margin,
          time: st.time, spray: st.spray, dry: st.dry, shine: st.shine, wetDark: 0.64, vig: 0.16, full: reduced ? 1 : 0,
        });
        st.needs = false;
        if (!html.classList.contains('gl-ready')) {
          html.classList.add('gl-ready');
          /* the CSS placeholder is now hidden: drop it so the phone can free those decoded images */
          setTimeout(() => { if (html.classList.contains('gl-ready')) stage.style.backgroundImage = 'none'; }, 1200);
        }
      }
      if (st.fxLive || parts.length || mists.length) drawFx(dt);
      if (perf && st.spray > 0) perf.push(performance.now() - t0);
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
  const photoUrl = (name, state, size) => `${PHOTOS.path}${name}-${state}-${size}.webp`;
  const photoSize = (cssW) => (cssW * Math.min(window.devicePixelRatio || 1, 2) <= 760 ? PHOTOS.sizes[0] : PHOTOS.sizes[1]);

  function initCards() {
    const cards = $$('.svc[data-photo]');
    if (!cards.length) return;
    const items = cards.map((el) => ({
      el, media: $('.svc__media', el), canvas: $('canvas', el), meter: $('.svc__meter', el), name: el.dataset.photo,
      vertical: el.dataset.vertical === '1', target: 0, pS: 0, spray: 0, dry: 0, imgA: null, imgB: null,
      loading: false, done: false, visible: false, ctx: null, cw: 0, ch: 0, crop: null, need: true, dpr: 1,
    }));
    const still = (it) => {
      it.media.style.backgroundImage = `url(${photoUrl(it.name, 'after', photoSize(it.media.clientWidth))})`;
      it.media.classList.add('is-static');
    };
    if (reduced) { items.forEach(still); return; }

    let raf = 0, last = 0;
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    async function load(it) {
      if (it.loading || it.imgA || it.done) return;
      it.loading = true;
      const sz = photoSize(it.media.clientWidth);
      try {
        const [a, b] = await Promise.all([S.loadImage(photoUrl(it.name, 'after', sz)), S.loadImage(photoUrl(it.name, 'before', sz))]);
        it.imgA = a; it.imgB = b; it.need = true; kick();
      } catch (e) { still(it); it.done = true; }
      it.loading = false;
    }
    const near = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) load(items.find((x) => x.el === e.target)); }), { rootMargin: '700px 0px' });
    const vis = new IntersectionObserver((es) => es.forEach((e) => {
      const it = items.find((x) => x.el === e.target);
      it.visible = e.isIntersecting;
      if (it.visible) kick();
    }), { rootMargin: '60px 0px' });
    items.forEach((it) => { near.observe(it.el); vis.observe(it.el); });

    function fit(it) {
      const r = it.media.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(2, Math.round(r.width * dpr)), H = Math.max(2, Math.round(r.height * dpr));
      if (W === it.cw && H === it.ch) return;
      it.canvas.width = it.cw = W; it.canvas.height = it.ch = H; it.dpr = dpr;
      it.ctx = it.canvas.getContext('2d', { alpha: false });
      it.ctx.imageSmoothingQuality = 'high';
      /* cover-fit crop of the photo */
      const iw = it.imgA.naturalWidth, ih = it.imgA.naturalHeight, s = Math.max(W / iw, H / ih);
      const sw = W / s, sh = H / s;
      it.crop = [(iw - sw) / 2, (ih - sh) / 2, sw, sh];
      it.need = true;
    }

    /* One frame: dirty photo, then the clean photo revealed in back-and-forth strips with a soft spray edge,
       a wet sheen behind the nozzle and a foam line at the edge. Plain 2D canvas, cheap on every phone. */
    function paint(it) {
      const { ctx, cw, ch, crop } = it;
      const img = (im) => ctx.drawImage(im, crop[0], crop[1], crop[2], crop[3], 0, 0, cw, ch);
      ctx.globalAlpha = 1;
      if (it.pS >= 0.9999) { img(it.imgA); }
      else {
        img(it.imgB);
        if (it.pS > 0) {
          const rows = 4, vert = it.vertical, L = vert ? ch : cw, A = vert ? cw : ch, rowA = A / rows;
          const margin = L * 0.06, span = L + 2 * margin, total = it.pS * rows;
          const cur = Math.min(Math.floor(total), rows - 1), f = total - cur, dir = cur % 2 === 0 ? 1 : -1;
          const head = (dir > 0 ? f : 1 - f) * span - margin, F = 9 * it.dpr;
          const rect = (path, a0, a1, c0, c1) => (vert ? path.rect(c0, a0, c1 - c0, a1 - a0) : path.rect(a0, c0, a1 - a0, c1 - c0));
          /* solid part: finished strips + current strip up to just behind the edge */
          ctx.save(); ctx.beginPath();
          if (cur > 0) rect(ctx, -2, L + 2, -2, cur * rowA);
          const s0 = dir > 0 ? -2 : head + F, s1 = dir > 0 ? head - F : L + 2;
          if (s1 > s0) rect(ctx, s0, s1, cur * rowA, (cur + 1) * rowA + (cur === rows - 1 ? 2 : 0));
          ctx.clip(); img(it.imgA); ctx.restore();
          /* feathered spray edge */
          for (let k = 0; k < 4; k++) {
            const e0 = head - F + (k * 2 * F) / 4, e1 = e0 + (2 * F) / 4;
            const b0 = dir > 0 ? e0 : 2 * head - e1, b1 = dir > 0 ? e1 : 2 * head - e0;
            ctx.save(); ctx.globalAlpha = 0.8 - k * 0.2; ctx.beginPath(); rect(ctx, b0, b1, cur * rowA, (cur + 1) * rowA); ctx.clip(); img(it.imgA); ctx.restore();
          }
          ctx.globalAlpha = 1;
          /* wet sheen trailing the nozzle */
          const wet = (1 - it.dry) * 0.24;
          if (wet > 0.01) {
            const back = head - dir * L * 0.75;
            const g = vert ? ctx.createLinearGradient(0, head, 0, back) : ctx.createLinearGradient(head, 0, back, 0);
            g.addColorStop(0, `rgba(12,22,18,${wet})`); g.addColorStop(1, 'rgba(12,22,18,0)');
            ctx.fillStyle = g; ctx.beginPath();
            rect(ctx, Math.min(head, back), Math.max(head, back), cur * rowA, (cur + 1) * rowA); ctx.fill();
          }
          /* foam at the edge while it's moving */
          if (it.spray > 0.02) {
            const g = vert ? ctx.createLinearGradient(0, head - F * 2, 0, head + F * 2) : ctx.createLinearGradient(head - F * 2, 0, head + F * 2, 0);
            const al = 0.55 * it.spray;
            g.addColorStop(0, 'rgba(240,248,255,0)'); g.addColorStop(0.5, `rgba(240,248,255,${al})`); g.addColorStop(1, 'rgba(240,248,255,0)');
            ctx.fillStyle = g; ctx.beginPath(); rect(ctx, head - F * 2, head + F * 2, cur * rowA + rowA * 0.08, (cur + 1) * rowA - rowA * 0.08); ctx.fill();
          }
        }
      }
    }

    function loop(now) {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      const vh = window.innerHeight;
      let any = false;
      items.forEach((it) => {
        if (!it.visible || !it.imgA || it.done) return;
        any = true;
        fit(it);
        const r = it.el.getBoundingClientRect();
        /* one-way: once a card is clean it stays clean */
        it.target = Math.max(it.target, clamp((vh * 0.9 - r.top) / (vh * 0.5), 0, 1));
        const prev = it.pS;
        it.pS += (it.target - it.pS) * (1 - Math.exp(-dt * 5));
        if (Math.abs(it.target - it.pS) < 0.0004) it.pS = it.target;
        const d = it.pS - prev;
        const tgt = d > 0 ? clamp((d / dt) * 4 * 0.85, 0, 1) : 0;
        it.spray += (tgt - it.spray) * (1 - Math.exp(-dt * (tgt > it.spray ? 14 : 5)));
        if (it.spray < 0.004) it.spray = 0;
        if (it.pS >= 0.9999) it.dry = Math.min(1, it.dry + dt / 1.1);
        if (it.need || d !== 0 || it.spray > 0 || (it.dry > 0 && it.dry < 1)) {
          paint(it);
          it.meter.style.setProperty('--p', it.pS.toFixed(3));
          it.need = false;
        }
        if (it.dry >= 1) { it.done = true; it.el.classList.add('is-clean'); }
      });
      if (any) raf = requestAnimationFrame(loop);
    }
    window.addEventListener('resize', debounce(() => {
      items.forEach((it) => { if (it.imgA) { it.cw = 0; it.done = false; it.need = true; } });
      kick();
    }, 150));
  }

  /* --------------------------------------------------------------- before / after */
  function initBA() {
    const root = $('[data-ba]');
    if (!root) return;
    const frame = $('.ba__frame', root), div = $('.ba__divider', root);
    const pB = $('.ba__photo--before', root), pA = $('.ba__photo--after', root);
    const tabs = $$('[role="tab"]', root);
    let split = 50, dragging = false, touched = false, started = false, startX = 0, startY = 0, decided = false, pointerType = '';

    const setSplit = (v) => {
      split = clamp(v, 0, 100);
      frame.style.setProperty('--split', split.toFixed(2) + '%');
      div.setAttribute('aria-valuenow', String(Math.round(split)));
      div.setAttribute('aria-valuetext', `${Math.round(100 - split)}% after`);
    };

    function render() {
      const tab = tabs.find((b) => b.getAttribute('aria-selected') === 'true') || tabs[0];
      const sz = photoSize(frame.clientWidth);
      const before = tab.dataset.before || photoUrl(tab.dataset.photo, 'before', sz);
      const after = tab.dataset.after || photoUrl(tab.dataset.photo, 'after', sz);
      frame.classList.add('is-loading');
      let n = 0;
      const ok = () => { if (++n === 2) frame.classList.remove('is-loading'); };
      pB.onload = pA.onload = ok; pB.onerror = pA.onerror = ok;
      pB.src = before; pA.src = after;
      pB.alt = `${tab.textContent.trim()} before cleaning`; pA.alt = `${tab.textContent.trim()} after cleaning`;
      /* warm the cache for the other tabs once this one is showing */
      setTimeout(() => tabs.forEach((b) => { if (b !== tab && b.dataset.photo) { new Image().src = photoUrl(b.dataset.photo, 'before', sz); new Image().src = photoUrl(b.dataset.photo, 'after', sz); } }), 1500);
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
      const keys = [[0, 50], [0.32, 22], [0.7, 78], [1, 50]], dur = 2600, t0 = performance.now();
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
      if (!es[0].isIntersecting || started) return;
      started = true; render();
      const seen = new IntersectionObserver((es2) => { if (es2[0].isIntersecting) { seen.disconnect(); setTimeout(teaser, 400); } }, { threshold: 0.6 });
      seen.observe(frame);
    }, { rootMargin: '500px 0px' });
    io.observe(frame);
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
