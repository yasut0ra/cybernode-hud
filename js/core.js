/* Cybernode HUD core: theme, settings, effects, canvas helpers, panel registry, views and page boot */
(() => {
'use strict';
const H = window.HUD = {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const M = REDUCED ? 0 : 1;
const TAU = Math.PI * 2, D2R = Math.PI / 180;
const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => Math.round(n).toLocaleString('en-US');
const p2 = n => String(n).padStart(2, '0');
const hhmm = (d = new Date()) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
const svg = (inner, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;

/* ---------- persisted settings ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('cybernode.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('cybernode.' + k, JSON.stringify(v)); } catch (e) {} }
};
const ACCENTS = { neon: ['#38f3ff', '#a66bff'], phosphor: ['#4dff9a', '#19d3c5'], amber: ['#ffb547', '#ff5e3a'], ice: ['#bfe9ff', '#7b9dff'] };
const FX = [['scan', 'SCANLINES', '走査線'], ['parallax', 'PARALLAX', 'マウスで傾く視差'], ['rain', 'CODE RAIN', '背景のコードレイン'], ['blur', 'BLUR', 'ガラスのぼかし（重い）'], ['sfx', 'SFX', '効果音']];
const settings = {
  accent: ACCENTS[store.get('accent')] ? store.get('accent') : 'neon',
  scan: store.get('scan', true), parallax: store.get('parallax', true), rain: store.get('rain', false), blur: store.get('blur', true), sfx: false
};

/* ---------- event bus ---------- */
const handlers = {};
const on = (e, f) => { (handlers[e] = handlers[e] || []).push(f); };
const has = e => !!(handlers[e] && handlers[e].length);
const emit = (e, d) => (handlers[e] || []).forEach(f => { try { f(d); } catch (err) { console.error(err); } });

/* ---------- theme colours for canvas ---------- */
const C = {};
const hex2rgb = h => { h = h.trim().replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (c1, c2, f) => [c1[0] + (c2[0] - c1[0]) * f | 0, c1[1] + (c2[1] - c1[1]) * f | 0, c1[2] + (c2[2] - c1[2]) * f | 0];
function readTheme() { const cs = getComputedStyle(root); for (const k of ['a1', 'a2', 'a3', 'ok', 'warn', 'crit', 'info', 'ink', 'dim', 'mute', 'void', 'deep']) C[k] = hex2rgb(cs.getPropertyValue('--' + k)); }
function applyAccent() { if (settings.accent === 'neon') delete root.dataset.accent; else root.dataset.accent = settings.accent; readTheme(); }
function setAccent(name) { if (!ACCENTS[name]) return; settings.accent = name; store.set('accent', name); applyAccent(); emit('theme', name); emit('settings', 'accent'); }
function setFx(k, v) {
  settings[k] = !!v; if (k !== 'sfx') store.set(k, settings[k]);
  document.body.classList.toggle(k + '-on', settings[k]);
  emit('settings', k);
  if (k === 'sfx' && v) tone(1200, .06, 'square', .03);
}
const toggleFx = k => setFx(k, !settings[k]);
applyAccent();

/* ---------- sound ---------- */
let actx = null;
function tone(f = 880, d = .05, type = 'square', v = .025, slide = 0, delay = 0) {
  if (!settings.sfx) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t0 + d);
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
    o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + d + .02);
  } catch (e) {}
}

/* ---------- frame loop ---------- */
const tasks = [];
const tick = f => { tasks.push(f); };
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  if (REDUCED && dt < .4) return;
  last = now; dt = Math.min(dt, REDUCED ? .4 : .05);
  const t = now / 1000;
  for (const f of tasks) {
    if (f.dead) continue;
    try { f(dt, t, now); } catch (e) { f.dead = true; console.error(e); }
  }
}

/* ---------- canvas surfaces ---------- */
const surfaces = [];
const io = new IntersectionObserver(es => es.forEach(e => { e.target._vis = e.isIntersecting; }));
const watch = el => io.observe(el);
const vis = el => el._vis !== false;
const ro = new ResizeObserver(es => es.forEach(e => { const o = surfaces.find(s => s.cv === e.target); if (o) { o.fit(); if (o.onResize) o.onResize(); } }));
function surface(cv, cap = 2, onResize) {
  if (typeof cv === 'string') cv = $(cv);
  const ctx = cv.getContext('2d');
  const o = { cv, ctx, w: 0, h: 0, onResize };
  o.fit = () => {
    const d = Math.min(window.devicePixelRatio || 1, cap);
    o.w = cv.clientWidth; o.h = cv.clientHeight;
    const W = Math.max(1, Math.round(o.w * d)), H = Math.max(1, Math.round(o.h * d));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    ctx.setTransform(d, 0, 0, d, 0, 0);
  };
  o.fit(); surfaces.push(o); ro.observe(cv); io.observe(cv);
  return o;
}

/* ---------- text decode ---------- */
const SCR = '!<>-_\\/[]{}=+*^?#%01ABCDEFXZ';
function decode(el, text, dur = 700) {
  el.dataset.text = text;
  if (REDUCED) { el.textContent = text; return; }
  const id = (el._dec = (el._dec || 0) + 1), start = performance.now(), chars = [...text], at = chars.map(() => Math.random() * dur);
  const step = now => {
    if (el._dec !== id) return;
    const e = now - start;
    el.textContent = chars.map((c, i) => (c === ' ' || e >= at[i]) ? c : SCR[Math.random() * SCR.length | 0]).join('');
    if (e < dur) requestAnimationFrame(step); else el.textContent = text;
  };
  requestAnimationFrame(step);
}

/* ---------- shared chart ---------- */
function drawSeries(o, vals, col, max, grid = true) {
  const { ctx, w, h } = o; ctx.clearRect(0, 0, w, h); if (w < 4 || h < 4) return;
  if (grid) { ctx.lineWidth = 1; ctx.strokeStyle = rgba(C.a1, .08); for (let i = 1; i < 4; i++) { const y = Math.round(h * i / 4) + .5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); } }
  const n = vals.length, sx = (w - 6) / (n - 1), Y = v => h - 3 - (v / max) * (h - 8);
  const p = new Path2D(); p.moveTo(0, Y(vals[0]));
  for (let i = 1; i < n; i++) { const xm = (i - .5) * sx; p.bezierCurveTo(xm, Y(vals[i - 1]), xm, Y(vals[i]), i * sx, Y(vals[i])); }
  const f = new Path2D(p); f.lineTo((n - 1) * sx, h); f.lineTo(0, h); f.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, rgba(col, .38)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.fill(f);
  ctx.lineWidth = 3; ctx.strokeStyle = rgba(col, .2); ctx.stroke(p);
  ctx.lineWidth = 1.3; ctx.strokeStyle = rgba(col, 1); ctx.stroke(p);
  const ex = (n - 1) * sx, ey = Y(vals[n - 1]);
  ctx.fillStyle = rgba(col, .25); ctx.beginPath(); ctx.arc(ex, ey, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = rgba(C.ink, 1); ctx.beginPath(); ctx.arc(ex, ey, 1.8, 0, TAU); ctx.fill();
}

/* ---------- overlays: glitch + breach ---------- */
let glSlices = [], glitchUntil = 0, breachT = 0;
function glitch(ms = 600) { if (REDUCED) return; glitchUntil = performance.now() + ms; document.body.classList.add('glitching'); tone(90, ms / 1000, 'sawtooth', .02, .5); }
tick((dt, t, now) => {
  if (!glitchUntil) return;
  if (now > glitchUntil) { glitchUntil = 0; document.body.classList.remove('glitching'); return; }
  glSlices.forEach(s => { s.style.top = rand(0, 100) + '%'; s.style.height = rand(.3, 4) + '%'; s.style.transform = `translateX(${rand(-30, 30)}px)`; s.style.opacity = Math.random() < .3 ? 0 : rand(.4, 1); });
});
function showBreach() {
  const b = $('#breach'); if (!b) return;
  b.hidden = false; decode($('.breach-text', b), 'ACCESS GRANTED', 900); glitch(260);
  tone(523, .25, 'triangle', .03); tone(784, .3, 'triangle', .03, 0, .12); tone(1046, .5, 'triangle', .03, 0, .24);
  clearTimeout(breachT); breachT = setTimeout(hideBreach, 3000);
}
function hideBreach() { const b = $('#breach'); if (b) b.hidden = true; }
const runBreach = () => { if (has('breach')) emit('breach'); else showBreach(); };
function buildOverlays() {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="fx fx-vig" aria-hidden="true"></div>
    <div class="fx fx-scan" aria-hidden="true"></div>
    <div class="gl" aria-hidden="true">${'<i></i>'.repeat(7)}</div>
    <div class="breach" id="breach" hidden>
      <div class="breach-rings" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="breach-text">ACCESS GRANTED</div>
      <div class="breach-bar"><i></i></div>
      <div class="breach-sub">clearance elevated · session 0x2A · クリックで閉じる</div>
    </div>`);
  glSlices = $$('.gl i');
  $('#breach').addEventListener('click', hideBreach);
  addEventListener('keydown', e => { if (e.key === 'Escape') hideBreach(); });
}

/* ---------- background: city, floor grid, motes, code rain ---------- */
let mx = 0, my = 0, tmx = 0, tmy = 0;
function buildBackground() {
  document.body.insertAdjacentHTML('afterbegin', '<canvas id="bg" aria-hidden="true"></canvas><canvas id="rain" aria-hidden="true"></canvas>');
  let sky = null, beacons = [], bgPhase = 0;
  const bg = surface('#bg', 1, () => buildSky());
  const motes = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: rand(.5, 2.2), s: rand(.004, .016), p: Math.random() * TAU, c: Math.random() < .3 }));
  function buildSky() {
    const { w, h } = bg; if (!w) return;
    const base = h * .8; beacons = [];
    sky = [{ hMax: .5, wMin: 22, wMax: 60 }, { hMax: .4, wMin: 40, wMax: 120 }].map((L, li) => {
      const c = document.createElement('canvas'); c.width = w + 80; c.height = h;
      const x = c.getContext('2d');
      for (let px = 0; px < w + 80;) {
        const bw = rand(L.wMin, L.wMax);
        const edge = Math.min(1, Math.abs((px - 40 + bw / 2) / w - .5) * 2.2);
        const bh = h * rand(.06, L.hMax) * (.3 + edge * .85), top = base - bh;
        x.fillStyle = li ? rgba(C.void, .97) : rgba(C.deep, .8); x.fillRect(px, top, bw, bh);
        x.fillStyle = rgba(C.a1, li ? .18 : .08); x.fillRect(px, top, bw, 1);
        x.fillStyle = rgba(C.a1, li ? .05 : .025); x.fillRect(px, top, 1, bh);
        const cols = [C.a1, C.a2, C.a3, [255, 210, 150]];
        for (let wy = top + 6; wy < base - 4; wy += li ? 8 : 6)
          for (let wx = px + 4; wx < px + bw - 4; wx += li ? 7 : 5)
            if (Math.random() < (li ? .1 : .08)) { x.fillStyle = rgba(pick(cols), rand(.12, li ? .55 : .28)); x.fillRect(wx, wy, li ? 2.5 : 1.6, li ? 3.5 : 2.2); }
        if (bh > h * .14 && Math.random() < .35) {
          const ax = px + bw / 2, ah = rand(10, 36);
          x.strokeStyle = rgba(C.a1, li ? .3 : .15); x.beginPath(); x.moveTo(ax, top); x.lineTo(ax, top - ah); x.stroke();
          beacons.push({ x: ax, y: top - ah, li, p: Math.random() * TAU });
        }
        px += bw + rand(-4, 10);
      }
      return c;
    });
  }
  buildSky();
  on('theme', buildSky);
  tick((dt, t) => {
    const { ctx, w, h } = bg; if (!w) return;
    bgPhase = (bgPhase + dt * .32 * M) % 1;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgba(C.deep, 1)); g.addColorStop(.65, rgba(C.void, 1)); g.addColorStop(1, rgba(C.void, 1));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const glow = (x, y, r, c, a) => { const rg = ctx.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, rgba(c, a)); rg.addColorStop(1, rgba(c, 0)); ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
    const big = Math.max(w, h);
    glow(w * .85 - mx * 20, h * .15, big * .55, C.a2, .24);
    glow(w * .1 - mx * 10, h * .72, big * .42, C.a1, .12);
    if (sky) {
      sky.forEach((L, i) => ctx.drawImage(L, -40 - mx * (i ? 22 : 9), my * (i ? 8 : 3)));
      for (const b of beacons) { const a = .5 + .5 * Math.sin(t * 2.4 + b.p); ctx.fillStyle = rgba(C.a3, .2 + .7 * a * a); ctx.fillRect(b.x - 40 - mx * (b.li ? 22 : 9) - 1, b.y + my * (b.li ? 8 : 3) - 1, 2.5, 2.5); }
    }
    const hz = h * .8;
    ctx.save(); ctx.beginPath(); ctx.rect(0, hz, w, h - hz); ctx.clip();
    ctx.fillStyle = rgba(C.void, .9); ctx.fillRect(0, hz, w, h - hz);
    ctx.lineWidth = 1;
    const vx = w / 2 - mx * 40;
    ctx.strokeStyle = rgba(C.a1, .1); ctx.beginPath();
    for (let i = -30; i <= 30; i++) { ctx.moveTo(vx + i * 6, hz); ctx.lineTo(vx + i * w / 11, h); }
    ctx.stroke();
    for (let k = 0; k < 16; k++) { const p = (k + bgPhase) / 16, y = hz + (h - hz) * p * p; ctx.strokeStyle = rgba(C.a1, .02 + .16 * p); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.restore();
    const hg = ctx.createLinearGradient(0, 0, w, 0);
    hg.addColorStop(0, rgba(C.a1, 0)); hg.addColorStop(.5, rgba(C.a1, .5)); hg.addColorStop(1, rgba(C.a1, 0));
    ctx.fillStyle = hg; ctx.fillRect(0, hz - 1, w, 2);
    for (const m of motes) {
      m.y -= m.s * dt * M; if (m.y < -.05) { m.y = 1.05; m.x = Math.random(); }
      const tw = .5 + .5 * Math.sin(t * 1.7 + m.p), x = m.x * w - mx * 14 * m.r, y = m.y * h, c = m.c ? C.a2 : C.a1;
      ctx.fillStyle = rgba(c, .05 * tw); ctx.beginPath(); ctx.arc(x, y, m.r * 4, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(c, .25 + .45 * tw); ctx.beginPath(); ctx.arc(x, y, m.r, 0, TAU); ctx.fill();
    }
  });

  const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789ABCDEF<>/{}[]=+*';
  let drops = [], rainAcc = 0;
  const rain = surface('#rain', 1, () => { rain.ctx.clearRect(0, 0, rain.w, rain.h); resetRain(); });
  function resetRain() { drops = Array.from({ length: Math.ceil(rain.w / 16) }, () => rand(-50, 0)); }
  resetRain();
  on('settings', k => { if (k === 'rain' && settings.rain) { rain.ctx.clearRect(0, 0, rain.w, rain.h); resetRain(); } });
  tick(dt => {
    if (!settings.rain) return;
    rainAcc += dt; if (rainAcc < .055) return; rainAcc = 0;
    const { ctx, w, h } = rain;
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,.13)'; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '14px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    for (let i = 0; i < drops.length; i++) {
      const y = drops[i] * 16, x = i * 16 + 8;
      if (y > 0) { ctx.fillStyle = rgba(C.a1, .85); ctx.fillText(pick(GLYPHS), x, y - 16); ctx.fillStyle = rgba(C.ink, 1); ctx.fillText(pick(GLYPHS), x, y); }
      drops[i] += 1;
      if (y > h && Math.random() > .97) drops[i] = rand(-20, 0);
    }
  });
}

/* ---------- panels + views ---------- */
const DEFS = {};
const def = (name, d) => { DEFS[name] = Object.assign({ name, group: 'sys', mh: 280 }, d); };
const GROUPS = { net: ['NETWORK', 'ネットワーク監視'], sec: ['SECURITY', '侵入・認証・脅威'], dev: ['DEVELOP', 'コード・ターミナル・タスク'], data: ['DATA', 'グラフと分析'], sys: ['SYSTEM', '設定・ナビ・ウィジェット'] };
const I = {
  main: '<path d="M4 7h16L12 21z"/><path d="M8.5 10h7L12 16z"/>',
  ops: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.8 2.6 14.2 0 17M12 3.5c-2.6 2.8-2.6 14.2 0 17"/>',
  dev: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  sec: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  data: '<path d="M5 20v-8M10 20V6M15 20v-9M20 20V9"/>',
  wall: '<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="5" rx="1"/><rect x="14" y="13" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="5" rx="1"/>',
  hub: '<path d="M12 2.5l8.5 4.9v9.2L12 21.5l-8.5-4.9V7.4z"/><path d="M12 8v8M8.2 10.2L12 12l3.8-1.8"/>'
};
const VIEWS = {
  main: { short: 'Main', title: 'Main Console', jp: '最初のコンソール。ネットワーク・コード・ターミナル・セキュリティをひと目で', panels: [['nav', 2, 3, 6], ['globe', 3, 1, 3], ['code', 4, 1, 3], ['sys', 3, 1, 3], ['term', 3, 1, 3], ['netmon', 4, 1, 6], ['target', 3, 1, 3], ['analysis', 3, 1, 3], ['security', 4, 1, 3], ['flow', 3, 1, 3]] },
  ops: { short: 'Ops', title: 'Network Ops', jp: '世界地図・データセンター・トラフィック・アラートを監視する運用室', panels: [['worldmap', 6, 1, 6], ['datacenter', 3, 1, 3], ['meters', 3, 1, 3], ['globe', 3, 1, 3], ['netmon', 6, 1, 6], ['alerts', 3, 1, 3], ['procs', 3, 1, 3], ['table', 6, 1, 6], ['hex', 3, 1, 3]] },
  dev: { short: 'Dev', title: 'Dev Studio', jp: 'エディタ・ターミナル・ファイル・コマンドパレット・カンバン・チャット', panels: [['files', 3, 1, 3], ['code', 5, 1, 3], ['palette', 4, 1, 6], ['term', 4, 2, 3], ['kanban', 5, 1, 6], ['chat', 3, 1, 3], ['graph', 4, 1, 3], ['timeline', 4, 1, 6]] },
  sec: { short: 'Security', title: 'Security Center', jp: 'ロック解除・認証・スキャン・異常検知・脅威マップ', panels: [['security', 5, 2, 6], ['auth', 4, 1, 3], ['target', 3, 1, 3], ['anomaly', 4, 1, 3], ['alerts', 3, 1, 3], ['hex', 3, 1, 3], ['term', 5, 1, 3], ['worldmap', 4, 1, 6]] },
  data: { short: 'Data', title: 'Data Lab', jp: 'ヒートマップ・ライブ表・異常検知・パイプラインなど数字まわり', panels: [['analysis', 4, 1, 3], ['heatmap', 5, 1, 3], ['widgets', 3, 2, 6], ['table', 5, 1, 6], ['anomaly', 4, 1, 3], ['sys', 3, 1, 3], ['flow', 3, 1, 3], ['graph', 3, 1, 3], ['meters', 3, 1, 3]] },
  wall: { short: 'Wall', title: 'The Wall', jp: '全パネルを1ページに敷き詰めた壁。スクロールして眺める用', scroll: true, panels: [
    ['nav', 2, 2, 6], ['worldmap', 4, 1, 6], ['graph', 3, 1, 3], ['code', 3, 1, 3],
    ['term', 4, 1, 3], ['files', 3, 1, 3], ['palette', 3, 1, 6],
    ['analysis', 3, 1, 3], ['heatmap', 3, 1, 3], ['procs', 3, 1, 3], ['meters', 3, 1, 3],
    ['chat', 3, 1, 3], ['kanban', 5, 1, 6], ['alerts', 4, 1, 3],
    ['table', 4, 1, 6], ['globe', 3, 2, 3], ['netmon', 5, 1, 6],
    ['auth', 4, 1, 3], ['timeline', 5, 1, 6],
    ['anomaly', 4, 1, 3], ['datacenter', 5, 1, 3], ['widgets', 3, 1, 6],
    ['security', 5, 2, 6], ['target', 3, 1, 3], ['flow', 4, 1, 3],
    ['sys', 3, 1, 3], ['settings', 4, 1, 3],
    ['hex', 12, 1, 6]
  ] }
};
Object.keys(VIEWS).forEach(k => { VIEWS[k].icon = I[k]; });

const PANELS = [];
function makePanel(name, i, [c, r, t, rt] = []) {
  const d = DEFS[name];
  const el = document.createElement('section');
  el.className = 'panel'; el.id = 'p-' + name; el.dataset.p = name;
  el.style.cssText = `--i:${i};--c:${c || 4};--r:${r || 1};--t:${t || 3};--rt:${rt || 1};--mh:${d.mh}px`;
  el.dataset.depth = (.7 + (i * 37 % 8) / 10).toFixed(2);
  el.innerHTML = `<header class="ph"><span class="dots"><i></i><i></i><i></i></span><h2${d.nocase ? ' class="nocase"' : ''}>${esc(d.title)}</h2><a class="pop" href="view.html#${name}" target="_blank" rel="noopener" title="このパネルを単体で開く" aria-label="${esc(d.title)} を単体で開く">↗</a><span class="wc" aria-hidden="true"><i></i><i></i><i></i></span></header><div class="pb ${d.cls || ''}"></div><i class="brk" aria-hidden="true"></i><i class="halo" aria-hidden="true"></i>`;
  return el;
}
function buildPanel(el) {
  const d = DEFS[el.dataset.p], pb = $('.pb', el);
  try { d.build(pb, el); } catch (e) { console.error(e); pb.innerHTML = `<div class="pb-err">panel failed: ${esc(e.message)}</div>`; }
  const h2 = $('.ph h2', el);
  const p = { el, bry: 0, brx: 0, lift: 0, hover: false, boost: 0, depth: +el.dataset.depth, z: '' };
  el.addEventListener('pointerenter', () => { p.hover = true; });
  el.addEventListener('pointerleave', () => { p.hover = false; });
  el.addEventListener('animationend', e => { if (e.animationName === 'ping') el.classList.remove('ping'); }, true);
  if (h2) {
    const txt = h2.textContent, i = parseFloat(el.style.getPropertyValue('--i')) || 0;
    setTimeout(() => decode(h2, txt, 650), 200 + i * 70);
    $('.ph', el).addEventListener('pointerenter', () => decode(h2, txt, 420));
  }
  PANELS.push(p);
}
function focusPanel(name) {
  const el = document.getElementById('p-' + name); if (!el) return false;
  const p = PANELS.find(q => q.el === el); if (p) p.boost = 1.2;
  el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping');
  const r = el.getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
  tone(1000, .04, 'square', .02);
  return true;
}
const go = key => { location.href = key === 'hub' ? 'index.html' : 'view.html#' + key; };

/* ---------- holographic wall motion ---------- */
let solo = false, wall = false;
function layoutPanels() {
  const ws = $('#ws'); if (!ws) return;
  const W = ws.clientWidth || 1, Hh = ws.clientHeight || 1;
  PANELS.forEach(p => {
    const cx = (p.el.offsetLeft + p.el.offsetWidth / 2) / W * 2 - 1;
    const cy = (p.el.offsetTop + p.el.offsetHeight / 2) / Hh * 2 - 1;
    p.bry = -cx * 8; p.brx = wall ? 0 : cy * 4.5;
  });
}
addEventListener('pointermove', e => { tmx = e.clientX / innerWidth * 2 - 1; tmy = e.clientY / innerHeight * 2 - 1; }, { passive: true });
tick(dt => {
  const flat = solo || innerWidth <= 760;
  const live = settings.parallax && !REDUCED;
  const k = Math.min(1, dt * 4);
  mx += ((live ? tmx : 0) - mx) * k; my += ((live ? tmy : 0) - my) * k;
  for (const p of PANELS) {
    p.lift += ((p.hover ? 1 : 0) + p.boost - p.lift) * Math.min(1, dt * 9);
    p.boost = Math.max(0, p.boost - dt * .9);
    const z = p.hover ? '5' : '';
    if (z !== p.z) { p.el.style.zIndex = z; p.z = z; }
    if (flat) { if (p.el.style.transform) p.el.style.transform = ''; continue; }
    const rx = p.brx + my * 2.5, ry = p.bry - mx * 3.5;
    const tx = -mx * p.depth * 7, ty = -my * p.depth * 5, tz = p.lift * 16;
    p.el.style.transform = `perspective(1500px) translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,${tz.toFixed(2)}px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
  }
});

/* ---------- page chrome ---------- */
const LOGO = '<svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><path d="M4 7h32L20 35z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M12.5 12h15L20 25.5z" fill="currentColor" opacity=".35"/></svg>';
function topbar(sub, current) {
  const links = Object.entries(VIEWS).map(([k, v]) => `<a href="view.html#${k}"${k === current ? ' aria-current="page"' : ''}>${v.short.toUpperCase()}</a>`).join('');
  return `<header class="topbar">
    <a class="brand" href="index.html" title="Hub に戻る">${LOGO}<div><h1 class="brand-name" data-text="CYBERNODE">CYBERNODE</h1><div class="brand-sub">${esc(sub)}</div></div></a>
    <nav class="views" aria-label="Views"><a href="index.html"${current === 'hub' ? ' aria-current="page"' : ''}>HUB</a>${links}</nav>
    <div class="topstats">
      <span class="chip"><i></i>SECURE LINK</span>
      <span class="kv"><b>NODE</b>TYO-07</span>
      <span class="kv"><b>LAT</b><span data-lat>23</span>ms</span>
      <span class="clock"><span data-date></span><span data-clock>00:00:00</span></span>
    </div>
  </header>`;
}
function dock(hint) {
  return `<footer class="dock">
    <div class="dg"><span class="dl">ACCENT</span>${Object.entries(ACCENTS).map(([k, c]) => `<button class="sw-btn" data-accent="${k}" style="--c1:${c[0]};--c2:${c[1]}" aria-label="${k}" aria-pressed="${k === settings.accent}"></button>`).join('')}</div>
    <div class="dg"><span class="dl">FX</span>${FX.map(([k, l, jp]) => `<button class="tg" data-k="${k}" aria-pressed="${settings[k]}" title="${jp}"><i></i>${l}</button>`).join('')}</div>
    <div class="hint">${hint}</div>
  </footer>`;
}
function wireDock(scope) {
  $$('.sw-btn[data-accent]', scope).forEach(b => b.addEventListener('click', () => { setAccent(b.dataset.accent); glitch(180); tone(700, .08, 'triangle', .03, 1.5); }));
  $$('.tg[data-k]', scope).forEach(b => b.addEventListener('click', () => toggleFx(b.dataset.k)));
}
on('settings', () => {
  $$('.sw-btn[data-accent]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.accent === settings.accent)));
  $$('.tg[data-k]').forEach(b => b.setAttribute('aria-pressed', String(settings[b.dataset.k])));
});
function clockTick() {
  const d = new Date();
  $$('[data-clock]').forEach(e => { e.textContent = `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; });
  $$('[data-date]').forEach(e => { e.textContent = `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`; });
  $$('[data-lat]').forEach(e => { e.textContent = ri(18, 31); });
}

/* ---------- hub ---------- */
function miniLayout(v) {
  const cells = v.panels.reduce((s, [, c, r]) => s + c * (r || 1), 0);
  return `<div class="mini" style="grid-template-rows:repeat(${Math.ceil(cells / 12)},1fr)" aria-hidden="true">${v.panels.map(([, c, r]) => `<i style="grid-column:span ${c};grid-row:span ${r || 1}"></i>`).join('')}</div>`;
}
function renderHub(shell) {
  let i = 0;
  const viewCards = Object.entries(VIEWS).map(([k, v]) => `<a class="card" href="view.html#${k}" style="--i:${i++}">
      <div class="card-t">${svg(v.icon)}<span>${esc(v.title)}</span><em>${v.panels.length} PANELS</em></div>
      ${miniLayout(v)}
      <p>${esc(v.jp)}</p>
    </a>`).join('');
  const groups = Object.entries(GROUPS).map(([g, [label, jp]]) => {
    const list = Object.values(DEFS).filter(d => d.group === g);
    if (!list.length) return '';
    return `<section class="hub-sec"><header><h3>${label}</h3><span>${jp}</span></header><div class="cards sm">${list.map(d => `<a class="card" href="view.html#${d.name}" style="--i:${i++}">
        <div class="card-t">${svg(d.icon || I.hub)}<span>${esc(d.title)}</span><em>SOLO</em></div>
        <p>${esc(d.desc || '')}</p>
      </a>`).join('')}</div></section>`;
  }).join('');
  shell.insertAdjacentHTML('beforeend', `<main class="hub-main">
    <div class="hub-hero">
      <div class="eyebrow">SELECT A CONSOLE</div>
      <h2>Cybernode HUD</h2>
      <p>ハッカーごっこ用のホログラム UI 集。まとめて眺めるビューと、パネル 1 枚だけを大きく映す単体ページがあります。VR ゴーグルのブラウザでウィンドウを何枚か並べると、それっぽい作業部屋になります。</p>
    </div>
    <section class="hub-sec"><header><h3>VIEWS</h3><span>パネルをまとめたコンソール</span></header><div class="cards">${viewCards}</div></section>
    ${groups}
    <section class="hub-sec"><header><h3>VR SETUP</h3><span>ゴーグルで使うときのコツ</span></header>
      <ul class="vr">
        <li><b>ウィンドウを 3 枚並べる</b><span>Quest などのブラウザで、正面に MAIN、左右に OPS と DEV や SECURITY を開くと囲まれ感が出ます。</span></li>
        <li><b>単体ページで大きく</b><span>どのパネルも右上の ↗ から 1 枚だけのページで開けます。ターミナルや地球儀を大画面にするのに便利です。</span></li>
        <li><b>重いときは BLUR を切る</b><span>下のバーの BLUR（ガラスのぼかし）を OFF にすると描画がかなり軽くなります。設定はページをまたいで保存されます。</span></li>
      </ul>
    </section>
  </main>`);
}

/* ---------- boot ---------- */
function boot() {
  const page = document.body.dataset.page || 'view';
  buildBackground();
  const shell = document.createElement('div'); shell.className = 'shell';
  document.body.appendChild(shell);
  buildOverlays();
  ['scan', 'parallax', 'rain', 'blur'].forEach(k => document.body.classList.toggle(k + '-on', settings[k]));

  let key = '';
  if (page === 'hub') {
    shell.insertAdjacentHTML('beforeend', topbar('HOLO-OPS CONSOLE · HUB', 'hub'));
    renderHub(shell);
    shell.insertAdjacentHTML('beforeend', dock('ビューかパネルを選んで開く · 設定はすべてのページで共有'));
    document.title = 'Cybernode HUD';
  } else {
    key = decodeURIComponent(location.hash.slice(1));
    if (!VIEWS[key] && !DEFS[key]) key = 'main';
    H.current = key;
    const ws = document.createElement('main'); ws.className = 'ws'; ws.id = 'ws';
    if (VIEWS[key]) {
      const v = VIEWS[key]; wall = !!v.scroll;
      document.body.classList.add('view-' + key); if (wall) document.body.classList.add('wall');
      shell.insertAdjacentHTML('beforeend', topbar(`${v.title.toUpperCase()} · ${v.panels.length} PANELS`, key));
      shell.appendChild(ws);
      v.panels.forEach(([name, ...span], i) => { if (DEFS[name]) ws.appendChild(makePanel(name, i + 1, span)); });
      shell.insertAdjacentHTML('beforeend', dock('<kbd>help</kbd> をターミナルに入力 · <kbd>⌘K</kbd> でコマンドパレット · ↗ でパネルを単体表示'));
      document.title = `${v.title} · Cybernode HUD`;
    } else {
      solo = true; document.body.classList.add('solo');
      const d = DEFS[key];
      shell.insertAdjacentHTML('beforeend', topbar(`SOLO · ${d.title.toUpperCase()}`, ''));
      shell.appendChild(ws);
      ws.appendChild(makePanel(key, 0, [12, 1, 6]));
      document.title = `${d.title} · Cybernode HUD`;
    }
    $$('.panel', ws).forEach(buildPanel);
    new ResizeObserver(layoutPanels).observe(ws);
    layoutPanels();
  }
  wireDock(shell);
  decode($('.brand-name'), 'CYBERNODE', 1100);
  clockTick(); setInterval(clockTick, 1000);
  addEventListener('hashchange', () => location.reload());
  requestAnimationFrame(frame);
}

Object.assign(H, {
  $, $$, REDUCED, M, TAU, D2R, rand, ri, pick, clamp, sleep, esc, fmt, p2, hhmm, svg,
  store, settings, ACCENTS, FX, setAccent, setFx, toggleFx,
  on, emit, has, C, rgba, mix, tone, tick, surface, watch, vis, decode, drawSeries,
  glitch, showBreach, runBreach, def, DEFS, VIEWS, GROUPS, focusPanel, go, boot
});
})();
