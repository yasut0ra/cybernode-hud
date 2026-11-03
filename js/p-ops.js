/* Cybernode HUD panels: network operations */
(() => {
'use strict';
const H = HUD;
const { $, $$, rand, ri, pick, clamp, esc, fmt, TAU, M, REDUCED, C, rgba, mix } = H;

/* ---------- flat world map ---------- */
H.def('worldmap', {
  title: 'World Map', group: 'net', mh: 280,
  desc: 'ドットで描いた平面の世界地図。都市間を回線が飛び、スキャンの帯が横切る',
  icon: '<rect x="2.5" y="5" width="19" height="14" rx="1.5"/><path d="M6 10c2-1 3 1 5 0s2-2 4-1M8 15c2 0 3-1 5 0M17 13h2"/>',
  build(pb) {
    pb.innerHTML = `<canvas class="fill" role="img" aria-label="World map with live network links"></canvas>
      <div class="ov net-stats"><div>GLOBAL<b data-k="g">2,947</b></div><div>REGIONS<b>128</b></div><div>LATENCY<b data-k="lat">42 ms</b></div><div>UPTIME<b>99.97%</b></div></div>
      <ul class="net-log"></ul>`;
    const map = H.surface($('canvas', pb)), logEl = $('.net-log', pb);
    const LAT0 = 80, LAT1 = -58, STEP = 2, dots = [];
    for (let lat = LAT0; lat > LAT1; lat -= STEP)
      for (let lon = -180; lon < 180; lon += STEP)
        if (H.isLand(lon + STEP / 2, lat - STEP / 2)) dots.push([lon + STEP / 2, lat - STEP / 2]);
    const arcs = [], hits = [];
    let timer = .8, links = 0;
    const spawn = (a, b) => { if (a !== b) arcs.push({ a, b, t: 0, dur: rand(1.1, 1.9), ms: ri(20, 240) }); };
    H.on('trace', id => { const b = H.city(id); if (b) spawn(H.CITIES[0], b); });
    setInterval(() => { $('[data-k="g"]', pb).textContent = fmt(2947 + ri(-12, 12)); $('[data-k="lat"]', pb).textContent = ri(36, 52) + ' ms'; }, 1200);
    H.tick((dt, t) => {
      timer -= dt * M;
      if (timer <= 0) { timer = rand(.5, 1.3); if (arcs.length < 7) spawn(pick(H.CITIES), pick(H.CITIES)); }
      for (let i = arcs.length - 1; i >= 0; i--) {
        const A = arcs[i]; A.t += dt / A.dur;
        if (!A.hit && A.t >= 1) {
          A.hit = true; hits.push({ c: A.b, t: 0 }); links++;
          const li = document.createElement('li'); li.innerHTML = `<b>${A.a.id}</b><span>→</span><b>${A.b.id}</b><span>${A.ms}ms</span>`;
          logEl.appendChild(li); while (logEl.children.length > 3) logEl.firstChild.remove();
        }
        if (A.t > 1.6) arcs.splice(i, 1);
      }
      for (let i = hits.length - 1; i >= 0; i--) { hits[i].t += dt; if (hits[i].t > 1) hits.splice(i, 1); }
      if (!H.vis(map.cv)) return;
      const { ctx, w, h } = map; ctx.clearRect(0, 0, w, h);
      const ar = 360 / (LAT0 - LAT1);
      let mw = w - 20, mh = mw / ar; if (mh > h - 20) { mh = h - 20; mw = mh * ar; }
      const ox = (w - mw) / 2, oy = (h - mh) / 2 + 4;
      const X = lon => ox + (lon + 180) / 360 * mw, Y = lat => oy + (LAT0 - lat) / (LAT0 - LAT1) * mh;
      ctx.lineWidth = 1; ctx.strokeStyle = rgba(C.a1, .06); ctx.beginPath();
      for (let lon = -150; lon < 180; lon += 30) { const x = Math.round(X(lon)) + .5; ctx.moveTo(x, oy); ctx.lineTo(x, oy + mh); }
      for (let lat = 60; lat > LAT1; lat -= 30) { const y = Math.round(Y(lat)) + .5; ctx.moveTo(ox, y); ctx.lineTo(ox + mw, y); }
      ctx.stroke();
      const band = ox + ((t * .07 * (M || .5)) % 1.3 - .15) * mw, ds = Math.max(1.2, mw / 360 * STEP * .55);
      ctx.fillStyle = rgba(C.a1, 1);
      for (const [lon, lat] of dots) {
        const x = X(lon), y = Y(lat), d = Math.abs(x - band);
        ctx.globalAlpha = .28 + .12 * Math.sin(lon * .09 + lat * .05 + t * 1.3) + (d < 60 ? (1 - d / 60) * .55 : 0);
        ctx.fillRect(x - ds / 2, y - ds / 2, ds, ds);
      }
      ctx.globalAlpha = 1;
      const bg = ctx.createLinearGradient(band - 60, 0, band + 4, 0);
      bg.addColorStop(0, rgba(C.a1, 0)); bg.addColorStop(1, rgba(C.a1, .12));
      ctx.fillStyle = bg; ctx.fillRect(band - 60, oy, 64, mh);
      ctx.fillStyle = rgba(C.a1, .5); ctx.fillRect(band, oy, 1, mh);
      ctx.font = '500 9px "JetBrains Mono", monospace';
      for (const c of H.CITIES) {
        const x = X(c.lon), y = Y(c.lat), pulse = .5 + .5 * Math.sin(t * 3 + c.ph);
        ctx.fillStyle = rgba(C.a1, .22); ctx.beginPath(); ctx.arc(x, y, 3 + pulse * 3, 0, TAU); ctx.fill();
        ctx.fillStyle = rgba(C.ink, .95); ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
        if (mw > 380) { ctx.fillStyle = rgba(C.ink, .55); ctx.fillText(c.id, x + 5, y - 4); }
      }
      ctx.lineCap = 'round';
      for (const A of arcs) {
        const x0 = X(A.a.lon), y0 = Y(A.a.lat), x2 = X(A.b.lon), y2 = Y(A.b.lat);
        const cx = (x0 + x2) / 2, cy = (y0 + y2) / 2 - Math.hypot(x2 - x0, y2 - y0) * .35;
        const q = s => [(1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * cx + s * s * x2, (1 - s) * (1 - s) * y0 + 2 * (1 - s) * s * cy + s * s * y2];
        const head = Math.min(1, A.t), tail = clamp(A.t - .55, 0, 1), N = 26;
        let prev = q(tail);
        for (let k = 1; k <= N; k++) {
          const s = tail + (head - tail) * k / N, p = q(s), f = k / N;
          ctx.strokeStyle = rgba(mix(C.a2, C.a1, f), .15 + .85 * f); ctx.lineWidth = .8 + 1.4 * f;
          ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); prev = p;
        }
        if (A.t < 1) { ctx.fillStyle = rgba(C.a1, .3); ctx.beginPath(); ctx.arc(prev[0], prev[1], 5, 0, TAU); ctx.fill(); ctx.fillStyle = rgba(C.ink, 1); ctx.beginPath(); ctx.arc(prev[0], prev[1], 1.8, 0, TAU); ctx.fill(); }
      }
      for (const Hh of hits) { ctx.strokeStyle = rgba(C.a3, (1 - Hh.t) * .9); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(X(Hh.c.lon), Y(Hh.c.lat), 2 + Hh.t * 16, 0, TAU); ctx.stroke(); }
    });
  }
});

/* ---------- isometric data center ---------- */
H.def('datacenter', {
  title: 'Data Center 3D', group: 'net', mh: 300, cls: 'dc',
  desc: 'アイソメトリックのデータセンター。ラックの LED が瞬き、冷却フローが床を走る',
  icon: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9"/>',
  build(pb) {
    const STATS = [['Compute', 68, 'var(--a1)'], ['Storage', 54, 'var(--a2)'], ['Network', 72, 'var(--a1)'], ['Power', 91, 'var(--warn)'], ['Cooling', 46, 'var(--ok)']];
    pb.innerHTML = `<div class="cvbox"><canvas class="fill" role="img" aria-label="Isometric data center"></canvas></div>
      <div class="dc-stats">${STATS.map(([k, v, c]) => `<div class="dc-row" data-s="${k}"><span>${k}</span><b>${v}%</b><i style="--v:${v}%;--bc:${c}"></i></div>`).join('')}</div>`;
    const dc = H.surface($('canvas', pb));
    const boxes = [];
    for (const y of [-3.4, 2.2]) for (let x = -4.2; x < 3.6; x += 1.2) boxes.push({ x, y, w: 1, d: 1.2, h: 1.6, rack: true, leds: Array.from({ length: 18 }, () => Math.random() < .5) });
    boxes.push({ x: -.8, y: -.8, w: 1.6, d: 1.6, h: 3.4, tower: true });
    boxes.push({ x: -4.4, y: -1, w: 1, d: 2, h: .8 }, { x: 3.4, y: -1, w: 1, d: 2, h: .8 });
    boxes.sort((a, b) => (a.x + a.w / 2 + a.y + a.d / 2) - (b.x + b.w / 2 + b.y + b.d / 2));
    const flows = Array.from({ length: 14 }, () => ({ lane: ri(0, 3), t: Math.random(), s: rand(.12, .3) }));
    let ledAcc = 0, statAcc = 0;
    H.tick((dt, t) => {
      statAcc += dt;
      if (statAcc > 1.5) {
        statAcc = 0;
        STATS.forEach(s => { s[1] = clamp(s[1] + ri(-4, 4), 30, 98); const r = $(`[data-s="${s[0]}"]`, pb); $('b', r).textContent = s[1] + '%'; $('i', r).style.setProperty('--v', s[1] + '%'); });
      }
      ledAcc += dt;
      if (ledAcc > .12) { ledAcc = 0; for (const b of boxes) if (b.rack) for (let i = 0; i < 2; i++) { const k = ri(0, 17); b.leds[k] = !b.leds[k]; } }
      for (const f of flows) f.t = (f.t + f.s * dt * M) % 1;
      if (!H.vis(dc.cv)) return;
      const { ctx, w, h } = dc; ctx.clearRect(0, 0, w, h);
      const S = Math.min(w / 11.5, h / 7.4), cx = w / 2, cy = h / 2 + S * 1.1;
      const iso = (x, y, z) => [cx + (x - y) * S * .866, cy + (x + y) * S * .5 - z * S];
      const poly = (pts, fill, stroke) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } };
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(C.a1, .08); ctx.beginPath();
      for (let v = -5; v <= 5; v++) { let a = iso(v, -5, 0), b = iso(v, 5, 0); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); a = iso(-5, v, 0); b = iso(5, v, 0); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke();
      const r = 2 + .25 * Math.sin(t * 1.5);
      ctx.strokeStyle = rgba(C.a1, .35); ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, p = iso(Math.cos(a) * r, Math.sin(a) * r, 0); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.stroke();
      ctx.strokeStyle = rgba(C.a1, .9); ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 10; i++) { const a = t * 1.2 * M + i / 10 * .9, p = iso(Math.cos(a) * r, Math.sin(a) * r, 0); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.stroke(); ctx.lineWidth = 1;
      const LANES = [[-5, -1.6, 5, -1.6], [-5, 1.6, 5, 1.6], [-1.6, -5, -1.6, 5], [1.6, -5, 1.6, 5]];
      for (const f of flows) {
        const [x0, y0, x1, y1] = LANES[f.lane];
        for (let k = 0; k < 4; k++) { const s = f.t - k * .015; if (s < 0) continue; const p = iso(x0 + (x1 - x0) * s, y0 + (y1 - y0) * s, 0); ctx.fillStyle = rgba(k ? C.a2 : C.ink, k ? .5 - k * .12 : .9); ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2); }
      }
      for (const b of boxes) {
        const { x, y, w: bw, d, h: bh } = b, p = iso;
        const top = [p(x, y, bh), p(x + bw, y, bh), p(x + bw, y + d, bh), p(x, y + d, bh)];
        const left = [p(x, y + d, 0), p(x + bw, y + d, 0), p(x + bw, y + d, bh), p(x, y + d, bh)];
        const right = [p(x + bw, y, 0), p(x + bw, y + d, 0), p(x + bw, y + d, bh), p(x + bw, y, bh)];
        const edge = b.tower ? rgba(C.a1, .95) : rgba(C.a1, .55);
        poly(left, rgba(C.deep, .92), null); poly(left, rgba(C.a2, b.tower ? .18 : .1), edge);
        poly(right, rgba(C.deep, .92), null); poly(right, rgba(C.a1, b.tower ? .14 : .06), edge);
        poly(top, rgba(C.a1, b.tower ? .3 : .16), edge);
        if (b.rack) {
          for (let k = 0; k < 6; k++) for (let j = 0; j < 3; j++) {
            if (!b.leds[k * 3 + j]) continue;
            const q = p(x + bw * (j + 1) / 4, y + d, bh * (k + .7) / 7);
            ctx.fillStyle = rgba(k === 0 && j === 2 ? C.warn : (j === 1 ? C.ok : C.a1), .95); ctx.fillRect(q[0] - .9, q[1] - .9, 1.8, 1.8);
          }
        }
        if (b.tower) {
          for (let k = 1; k < 8; k++) { const z = bh * k / 8, a = p(x + bw, y + .15, z), c = p(x + bw, y + d - .15, z); ctx.strokeStyle = rgba(C.a1, .25 + .35 * (Math.sin(t * 3 - k * .7) * .5 + .5)); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
          const tip = p(x + bw / 2, y + d / 2, bh + .5), base = p(x + bw / 2, y + d / 2, bh);
          ctx.strokeStyle = rgba(C.a1, .6); ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
          ctx.fillStyle = rgba(C.a3, .4 + .6 * Math.abs(Math.sin(t * 2.6))); ctx.beginPath(); ctx.arc(tip[0], tip[1], 2.2, 0, TAU); ctx.fill();
        }
      }
    });
  }
});

/* ---------- resource meters ---------- */
H.def('meters', {
  title: 'Resource Meters', group: 'sys', mh: 260,
  desc: 'CPU・RAM・GPU・NET・DISK・TEMP の縦型セグメントメータとピークホールド',
  icon: '<path d="M5 20V10M10 20V4M15 20v-7M20 20V8"/><path d="M3 20h18"/>',
  build(pb) {
    pb.innerHTML = '<canvas class="fill" role="img" aria-label="Resource level meters"></canvas>';
    const cvs = H.surface($('canvas', pb));
    const MS = [['CPU', 36, '%'], ['RAM', 71, '%'], ['GPU', 58, '%'], ['NET', 28, '%'], ['DISK', 44, '%'], ['TEMP', 62, '°C']].map(([k, v, u]) => ({ k, v, t: v, peak: v, u }));
    let acc = 0;
    H.tick(dt => {
      acc += dt;
      if (acc > .9) { acc = 0; MS.forEach(m => { m.t = clamp(m.t + rand(-18, 18), 8, 97); }); }
      MS.forEach(m => { m.v += (m.t - m.v) * Math.min(1, dt * 3); m.peak = Math.max(m.peak - dt * 9, m.v); });
      if (!H.vis(cvs.cv)) return;
      const { ctx, w, h } = cvs; ctx.clearRect(0, 0, w, h);
      const list = w < 250 ? MS.slice(0, 4) : MS, n = list.length, pad = 12, cw = (w - pad * 2) / n;
      const top = 28, bot = h - 24, segs = Math.max(6, Math.floor((bot - top) / 7)), sh = (bot - top) / segs;
      ctx.textAlign = 'center';
      list.forEach((m, i) => {
        const cx = pad + cw * (i + .5), bw = Math.min(cw * .55, 34), x = cx - bw / 2;
        const lit = Math.round(m.v / 100 * segs), pk = Math.min(segs - 1, Math.round(m.peak / 100 * segs));
        for (let s = 0; s < segs; s++) {
          const y = bot - (s + 1) * sh, f = s / segs;
          const col = f < .6 ? C.a1 : f < .85 ? C.warn : C.crit;
          ctx.fillStyle = s < lit ? rgba(col, .9) : rgba(C.a1, .07);
          ctx.fillRect(x, y + 1, bw, sh - 2);
        }
        ctx.fillStyle = rgba(C.ink, .95); ctx.fillRect(x - 2, bot - (pk + 1) * sh, bw + 4, 1.5);
        ctx.font = '500 10px "JetBrains Mono", monospace'; ctx.fillStyle = rgba(C.dim, 1); ctx.fillText(m.k, cx, 16);
        ctx.font = '500 11px "JetBrains Mono", monospace'; ctx.fillStyle = rgba(C.ink, 1);
        ctx.fillText(m.u === '%' ? Math.round(m.v) + '%' : Math.round(30 + m.v * .5) + m.u, cx, h - 8);
      });
      ctx.textAlign = 'left';
    });
  }
});

/* ---------- process tree ---------- */
H.def('procs', {
  title: 'Process Tree', group: 'sys', mh: 300, cls: 'pt',
  desc: 'プロセスの親子ツリー。CPU 使用率が揺れ、ワーカーがときどき再起動する',
  icon: '<rect x="3" y="3" width="6" height="5" rx="1"/><rect x="15" y="10" width="6" height="5" rx="1"/><rect x="15" y="17" width="6" height="4" rx="1"/><path d="M6 8v11h9M6 12.5h9"/>',
  build(pb) {
    const TREE = [[0, 'system', 13], [1, 'orchestrator', 412], [2, 'worker', 428], [2, 'worker', 429], [2, 'worker', 430], [1, 'analyzer', 518], [2, 'parser', 601], [2, 'aggregator', 602], [2, 'reporter', 603], [1, 'relay-mesh', 644], [2, 'heartbeat', 645], [1, 'cloak', 702]];
    const prefix = TREE.map(([d], i) => {
      if (!d) return '';
      let s = '';
      for (let lv = 1; lv < d; lv++) {
        let more = false;
        for (let j = i + 1; j < TREE.length && TREE[j][0] >= lv; j++) if (TREE[j][0] === lv) { more = true; break; }
        s += more ? '│  ' : '   ';
      }
      let last = true;
      for (let j = i + 1; j < TREE.length && TREE[j][0] >= d; j++) if (TREE[j][0] === d) { last = false; break; }
      return s + (last ? '└─ ' : '├─ ');
    });
    pb.innerHTML = `<div class="pt-head"><span>PROCESS</span><span>LOAD</span><span>CPU</span></div><div class="pt-rows">${TREE.map(([, n, pid], i) => `<div class="pt-row" data-i="${i}"><span class="pt-name"><span class="g">${prefix[i]}</span><i class="dot"></i>${n} <span class="pid">(${pid})</span></span><span class="pt-bar"><i></i></span><span class="pt-cpu">0%</span></div>`).join('')}</div>`;
    const rows = $$('.pt-row', pb), cpu = TREE.map(() => rand(2, 40));
    let pidNext = 731;
    const update = () => {
      rows.forEach((r, i) => {
        cpu[i] = clamp(cpu[i] + rand(-14, 14), 1, 96);
        $('.pt-bar i', r).style.setProperty('--v', cpu[i].toFixed(0) + '%');
        $('.pt-cpu', r).textContent = cpu[i].toFixed(0) + '%';
        r.classList.toggle('busy', cpu[i] > 70);
      });
    };
    update(); setInterval(update, 1000);
    setInterval(() => {
      if (document.hidden) return;
      const i = pick([2, 3, 4, 6, 7, 8, 10]), r = rows[i];
      $('.pid', r).textContent = `(${pidNext++})`; cpu[i] = 2;
      r.classList.remove('spawn'); void r.offsetWidth; r.classList.add('spawn');
    }, 7000);
  }
});

/* ---------- live metrics table ---------- */
H.def('table', {
  title: 'Live Metrics', group: 'data', mh: 300, cls: 'tb',
  desc: 'ノードごとのリクエスト数・レイテンシ・状態がライブ更新される表。見出しで並び替え',
  icon: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M3 14h18M9 9v11"/>',
  build(pb) {
    const ST = { ok: 'Online', warn: 'Degraded', crit: 'Offline' };
    const rows = [['N-104', 'US-East', 1240392, 38], ['N-105', 'EU-West', 982441, 46], ['N-106', 'AP-South', 765210, 63, 'warn'], ['N-107', 'SA-East', 421983, 57], ['N-108', 'JP-North', 1102337, 41], ['N-109', 'EU-North', 530118, 49], ['N-110', 'US-West', 1388002, 35], ['N-111', 'AF-South', 211874, 88]]
      .map(([id, region, req, lat, st = 'ok']) => ({ id, region, req, lat, st }));
    const COLS = [['id', 'ID'], ['region', 'REGION'], ['req', 'REQUESTS', 1], ['lat', 'LATENCY', 1], ['st', 'STATUS']];
    pb.innerHTML = `<table><thead><tr>${COLS.map(([k, l, n]) => `<th data-k="${k}"${n ? ' class="num"' : ''} tabindex="0">${l}</th>`).join('')}</tr></thead><tbody></tbody></table>`;
    const tbody = $('tbody', pb);
    rows.forEach(r => {
      r.tr = document.createElement('tr');
      r.tr.innerHTML = `<td>${r.id}</td><td>${r.region}</td><td class="num"></td><td class="num"></td><td><span class="pill"></span></td>`;
      [, , r.reqTd, r.latTd, r.stTd] = r.tr.children;
      tbody.appendChild(r.tr);
    });
    const paint = (r, flash) => {
      r.reqTd.textContent = fmt(r.req); r.latTd.textContent = r.lat + ' ms';
      const pill = $('.pill', r.stTd); pill.className = 'pill ' + r.st; pill.textContent = ST[r.st];
      flash.forEach(td => { td.classList.remove('flash'); void td.offsetWidth; td.classList.add('flash'); });
    };
    rows.forEach(r => paint(r, []));
    let sortK = '', dir = 1;
    const sort = k => {
      dir = sortK === k ? -dir : 1; sortK = k;
      $$('th', pb).forEach(th => { if (th.dataset.k === k) th.setAttribute('aria-sort', dir > 0 ? 'ascending' : 'descending'); else th.removeAttribute('aria-sort'); });
      const order = { ok: 0, warn: 1, crit: 2 };
      rows.slice().sort((a, b) => { const x = k === 'st' ? order[a.st] : a[k], y = k === 'st' ? order[b.st] : b[k]; return (x > y ? 1 : x < y ? -1 : 0) * dir; }).forEach(r => tbody.appendChild(r.tr));
    };
    $$('th', pb).forEach(th => { th.addEventListener('click', () => sort(th.dataset.k)); th.addEventListener('keydown', e => { if (e.key === 'Enter') sort(th.dataset.k); }); });
    setInterval(() => {
      if (document.hidden) return;
      rows.forEach(r => {
        const fl = [];
        if (r.st !== 'crit' && Math.random() < .7) { r.req += ri(200, 4000); fl.push(r.reqTd); }
        const nl = clamp(r.lat + ri(-4, 4) + (r.st === 'warn' ? 1 : 0), 18, 140);
        if (Math.abs(nl - r.lat) >= 3) fl.push(r.latTd);
        r.lat = nl;
        const roll = Math.random();
        if (r.st === 'ok' && roll < .015) r.st = 'warn';
        else if (r.st === 'warn' && roll < .12) r.st = 'ok';
        else if (r.st === 'warn' && roll > .985) r.st = 'crit';
        else if (r.st === 'crit' && roll < .3) r.st = 'warn';
        paint(r, fl);
      });
      if (sortK && sortK !== 'id' && sortK !== 'region') { dir = -dir; sort(sortK); }
    }, 1300);
  }
});

/* ---------- alert center ---------- */
const AL_ICON = {
  crit: '<path d="M12 3.5l9 16H3z"/><path d="M12 10v4M12 17v.01"/>',
  warn: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5v.01"/>'
};
H.def('alerts', {
  title: 'Alert Center', group: 'net', mh: 320, cls: 'al',
  desc: '重要度つきの通知が次々に届く。× で消せる',
  icon: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  build(pb, el) {
    const POOL = [['crit', 'High CPU usage', 'Server A'], ['warn', 'Sync delayed', 'Data Hub'], ['info', 'New version available', 'v1.5.0'], ['crit', 'Intrusion attempt blocked', 'Edge FW-2'], ['warn', 'Certificate expires in 7d', '*.cybernode.io'], ['info', 'Backup completed', 'Vault-3'], ['warn', 'Latency above SLO', 'AP-South'], ['crit', 'Disk almost full', 'N-106 /var'], ['info', 'Key rotation scheduled', 'KMS'], ['warn', 'Unusual login location', 'operator@reykjavik'], ['info', 'Deploy finished', 'staging'], ['crit', 'Packet loss 4.2%', 'Relay TYO→FRA']];
    const badge = document.createElement('b'); badge.className = 'badge'; badge.textContent = '0';
    $('.ph .pop', el).before(badge);
    const ago = ts => { const s = (Date.now() - ts) / 1000; return s < 50 ? 'just now' : `${Math.round(s / 60) || 1} min ago`; };
    const count = () => { const n = $$('.al-item:not(.out)', pb).length; badge.textContent = n; badge.hidden = !n; if (!n && !$('.al-empty', pb)) pb.insertAdjacentHTML('beforeend', '<div class="al-empty">ALL CLEAR</div>'); };
    const remove = it => { it.classList.add('out'); setTimeout(() => { it.remove(); count(); }, 340); count(); };
    function add(a, age = 0) {
      const [sev, title, src] = a || pick(POOL), it = document.createElement('div');
      const empty = $('.al-empty', pb); if (empty) empty.remove();
      it.className = 'al-item ' + sev; it.dataset.ts = Date.now() - age * 60000;
      it.innerHTML = `<span class="al-ic">${H.svg(AL_ICON[sev], '')}</span><div style="min-width:0"><div class="al-t">${esc(title)}</div><div class="al-s">${esc(src)} · <span>${ago(+it.dataset.ts)}</span></div></div><button class="al-x" aria-label="通知を消す">×</button>`;
      $('.al-x', it).addEventListener('click', () => remove(it));
      pb.prepend(it);
      const max = Math.max(2, Math.floor(pb.clientHeight / 52));
      const items = $$('.al-item:not(.out)', pb);
      if (items.length > max) remove(items[items.length - 1]);
      count();
      if (sev === 'crit') H.tone(440, .12, 'square', .02, .7);
    }
    add(POOL[2], 12); add(POOL[1], 7); add(POOL[0], 3);
    const loop = () => { if (!document.hidden) add(); setTimeout(loop, rand(4500, 9000)); };
    setTimeout(loop, 5000);
    setInterval(() => $$('.al-item', pb).forEach(it => { $('.al-s span', it).textContent = ago(+it.dataset.ts); }), 10000);
  }
});
})();
