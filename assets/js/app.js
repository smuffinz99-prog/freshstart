/* ==========================================================================
   FreshStart Pressure Washing — page behaviour
   Edit CONFIG below for form delivery and contact details.
   ========================================================================== */
(function () {
  'use strict';

  /* =============================== CONFIG =============================== */
  const CONFIG = {
    /* Quote form delivery: FormSubmit (free, no account). Requests and photos are emailed to
       quoteTo. The very first request sends an activation email to that address: click the link
       in it once. FormSubmit then emails you a random string you can paste here instead of the
       address, so it isn't visible in the page (it also goes in the form's action in index.html). */
    quoteTo: 'billyfrench024@gmail.com',
    maxPhotos: 6,
    email: 'freshstartpressurewashing11@gmail.com',
    phoneDisplay: '0491 570 156',

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
      /* Straight-on concrete driveway in front of a garage door (Unsplash, see CREDITS.md). The 'before' is the same
         photo with real concrete grime, oil stains and wheel-path dirt added. */
      desktop: { after: 'hero-after-desktop.webp?v=9', before: 'hero-before-desktop.webp?v=9', size: [1920, 1080], beforeRect: [0, 0, 1, 1], focus: [0.5, 1] },
      mobile: { after: 'hero-after-mobile.webp?v=9', before: 'hero-before-mobile.webp?v=9', size: [750, 1538], beforeRect: [0, 0, 1, 1], focus: [0.5, 1] },
      slab: null, /* strips sweep straight across the screen */
    },
  };

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const html = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const onScroll = (fn) => { let q = false; const run = () => { q = false; fn(); }; window.addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(run); } }, { passive: true }); fn(); };
  const S = window.GPSurface;


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
        /* strips only cover the rows of the screen that actually have dirt on them */
        let y0 = 1, y1 = 0;
        for (let gy = 0; gy <= 64; gy++) for (let gx = 0; gx <= 32; gx++) {
          const ix = (gx / 32) * st.map[0] + st.map[2], iy = (gy / 64) * st.map[1] + st.map[3];
          if (eng.maskAt(p, ix, iy) < 0.3) continue;
          y0 = Math.min(y0, gy / 64); y1 = Math.max(y1, gy / 64);
        }
        if (!(y1 > y0)) { y0 = 0; y1 = 1; }
        y0 = Math.max(0, y0 - 0.015); y1 = Math.min(1, y1 + 0.015);
        st.sweep = [0, 1, y0, y1];
        st.rows = clamp(Math.round(st.h * (y1 - y0) / (st.w < 700 ? 120 : 140)), 3, 8);
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

  /* --------------------------------------------------------------- before / after slider */
  const photoUrl = (name, state, size) => `${PHOTOS.path}${name}-${state}-${size}.webp?v=9`;
  const photoSize = (cssW) => (cssW * Math.min(window.devicePixelRatio || 1, 2) <= 760 ? PHOTOS.sizes[0] : PHOTOS.sizes[1]);

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
  /* Shrink a photo to max 1600px JPEG so six of them fit comfortably under FormSubmit's 10MB limit. */
  async function shrinkPhoto(file) {
    const MAX = 1600;
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { bmp = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); }); }
    const w0 = bmp.width, h0 = bmp.height, k = Math.min(1, MAX / Math.max(w0, h0));
    const c = document.createElement('canvas'); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
    if (!blob) return file;
    const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  }

  function initPhotos(form) {
    const box = $('[data-photos]', form);
    if (!box) return { files: () => [] };
    const input = $('#photo-input', box), grid = $('[data-photos-grid]', box), drop = $('[data-photos-drop]', box), status = $('[data-photos-status]', box);
    const items = []; // { file, url, busy }
    const say = (msg, warn) => { status.hidden = !msg; status.textContent = msg || ''; status.classList.toggle('is-warn', !!warn); };
    const render = () => {
      grid.innerHTML = '';
      items.forEach((it, i) => {
        const li = document.createElement('li'); if (it.busy) li.className = 'is-busy';
        if (it.url) { const im = document.createElement('img'); im.src = it.url; im.alt = 'Photo ' + (i + 1); li.appendChild(im); }
        const x = document.createElement('button'); x.type = 'button'; x.className = 'photos__remove'; x.setAttribute('aria-label', 'Remove photo ' + (i + 1)); x.textContent = '×';
        x.addEventListener('click', () => { if (it.url) URL.revokeObjectURL(it.url); items.splice(i, 1); render(); });
        li.appendChild(x); grid.appendChild(li);
      });
      const n = items.length;
      if (!n) say('');
      else say(n >= CONFIG.maxPhotos ? `${n} photos added. That's the maximum, nice work.` : `${n} photo${n > 1 ? 's' : ''} added. ${n < 3 ? 'A wide shot plus a close-up of the worst bit is perfect.' : 'Looking good.'}`);
    };
    async function add(list) {
      const files = Array.from(list || []).filter((f) => /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name || ''));
      if (!files.length) return;
      const room = CONFIG.maxPhotos - items.length;
      if (room <= 0) { say(`You can add up to ${CONFIG.maxPhotos} photos.`, true); return; }
      const take = files.slice(0, room);
      const slots = take.map(() => { const it = { file: null, url: '', busy: true }; items.push(it); return it; });
      render();
      await Promise.all(take.map(async (f, i) => {
        const it = slots[i];
        try { it.file = await shrinkPhoto(f); } catch (e) { it.file = f; }
        try { it.url = URL.createObjectURL(it.file); } catch (e) {}
        it.busy = false; render();
      }));
      if (files.length > room) say(`Added ${room}. You can add up to ${CONFIG.maxPhotos} photos.`, true);
    }
    input.addEventListener('change', () => { add(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', (e) => add(e.dataTransfer && e.dataTransfer.files));
    return { files: () => items.filter((it) => it.file && !it.busy).map((it) => it.file), busy: () => items.some((it) => it.busy) };
  }

  function initForm() {
    const form = $('#quote-form');
    if (!form) return;
    // "Get a quote" buttons on service cards tick that service in the form
    $$('[data-quote]').forEach((a) => a.addEventListener('click', () => {
      const want = a.dataset.quote;
      $$('input[name="services"]', form).forEach((c) => { if (c.value === want) c.checked = true; });
    }));
    const body = $('.form__body', form), done = $('.form__done', form), err = $('.form__error', form);
    const F = form.elements;
    const photos = initPhotos(form);
    const mark = (name, bad) => { const f = F[name].closest('.field'); if (f) f.classList.toggle('is-invalid', bad); return bad; };

    // back from FormSubmit after a successful send
    const qs = new URLSearchParams(location.search);
    if (qs.has('sent')) {
      body.hidden = true; done.hidden = false;
      history.replaceState(null, '', location.pathname + '#quote');
      setTimeout(() => { const q = $('#quote'); if (q) q.scrollIntoView({ block: 'start' }); done.focus({ preventScroll: true }); }, 350);
    }

    form.addEventListener('input', (e) => { const f = e.target.closest('.field'); if (f) f.classList.remove('is-invalid'); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      err.hidden = true;
      if (F._honey.value) return; // bot
      const bad = [];
      if (mark('name', !F.name.value.trim())) bad.push(F.name);
      if (mark('phone', F.phone.value.replace(/\D/g, '').length < 8)) bad.push(F.phone);
      const em = F.email.value.trim();
      if (mark('email', !!em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))) bad.push(F.email);
      if (mark('suburb', !F.suburb.value.trim())) bad.push(F.suburb);
      if (bad.length) { err.textContent = 'Please check the highlighted fields.'; err.hidden = false; bad[0].focus(); return; }
      if (photos.busy && photos.busy()) { err.textContent = 'Hang on a sec, your photos are still getting ready.'; err.hidden = false; return; }

      const services = $$('input[name="services"]:checked', form).map((c) => c.value);
      F.Services.value = services.join(', ') || 'Not specified';
      F._subject.value = `New quote request: ${F.name.value.trim()} (${F.suburb.value.trim()})`;
      F._next.value = location.origin + location.pathname + '?sent=1#quote';
      $$('input[name="services"]', form).forEach((c) => { c.dataset.n = c.name; c.removeAttribute('name'); }); // sent as one "Services" line

      // attach the shrunk photos as separate file fields
      $$('input[data-photo-field]', form).forEach((x) => x.remove());
      const files = photos.files();
      let attached = 0;
      if (files.length && typeof DataTransfer !== 'undefined') {
        files.forEach((f, i) => {
          try {
            const dt = new DataTransfer(); dt.items.add(f);
            const fi = document.createElement('input'); fi.type = 'file'; fi.name = 'Photo ' + (i + 1); fi.hidden = true; fi.setAttribute('data-photo-field', '');
            fi.files = dt.files; form.appendChild(fi); attached++;
          } catch (ex) {}
        });
      }
      F.message.value = F.message.value.trim() + (files.length && !attached ? '\n\n(Photos could not be attached from this browser. Please reply to ask for them.)' : '');

      if (!CONFIG.quoteTo) { // no delivery set up: fall back to the visitor's email app
        const lines = [`Name: ${F.name.value}`, `Phone: ${F.phone.value}`, `Email: ${em || '-'}`, `Suburb: ${F.suburb.value}`, `Services: ${F.Services.value}`, `Approx. size: ${F.size.value || '-'}`, '', F.message.value];
        window.location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Quote request: ' + F.suburb.value)}&body=${encodeURIComponent(lines.join('\n'))}`;
        return;
      }
      form.classList.add('is-sending');
      $('button[type="submit"] span', form).textContent = files.length ? 'Sending your request and photos...' : 'Sending...';
      HTMLFormElement.prototype.submit.call(form); // real multipart post to FormSubmit, which redirects back here
    });
    // if someone comes back with the browser's back button, put the checkbox names back
    window.addEventListener('pageshow', () => { $$('input[data-n]', form).forEach((c) => { c.name = c.dataset.n; }); form.classList.remove('is-sending'); });
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
    [initNav, initReveal, initHero, initBA, initFAQ, initForm, initFooter, initDock].forEach((fn) => {
      try { fn(); } catch (e) { console.error('[freshstart]', fn.name, e); }
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
