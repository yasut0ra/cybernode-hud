/* Cybernode HUD panels: the original console set */
(() => {
'use strict';
const H = HUD;
const { $, $$, rand, ri, pick, clamp, sleep, esc, fmt, p2, TAU, D2R, M, REDUCED, C, rgba, mix } = H;
const CHECK = '<i class="st"><svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 4.5"/></svg><b class="spin"></b></i>';
const HUB = '<path d="M12 2.5l8.5 4.9v9.2L12 21.5l-8.5-4.9V7.4z"/><path d="M12 8v8M8.2 10.2L12 12l3.8-1.8"/>';
const hexByte = () => ri(0, 255).toString(16).toUpperCase().padStart(2, '0');

/* ---------- workspace nav ---------- */
H.def('nav', {
  title: 'Workspace', group: 'sys', mh: 300, cls: 'nav',
  desc: 'ビュー切り替えメニューと、ミニのパケットストリーム',
  icon: '<rect x="3" y="4" width="7" height="16" rx="1"/><path d="M13 6h8M13 10h8M13 14h8M13 18h5"/>',
  build(pb) {
    const cur = H.current;
    pb.innerHTML = `<nav class="menu" aria-label="Views">${Object.entries(H.VIEWS).map(([k, v]) => `<a class="mi${k === cur ? ' on' : ''}" href="view.html#${k}"${k === cur ? ' aria-current="page"' : ''}>${H.svg(v.icon, '')}<span>${esc(v.title)}</span></a>`).join('')}<a class="mi" href="index.html">${H.svg(HUB, '')}<span>Hub</span></a></nav><div class="hx-label">PACKET STREAM</div><div class="hexmini" aria-hidden="true"></div>`;
    const hexEl = $('.hexmini', pb), lines = [];
    let addr = 0x3fa0, acc = 0;
    const line = () => {
      addr = (addr + 6) & 0xffff;
      let s = `<span class="hx-a">${addr.toString(16).toUpperCase().padStart(4, '0')}</span> `;
      for (let i = 0; i < 6; i++) { const b = hexByte(); s += (Math.random() < .09 ? `<em>${b}</em>` : b) + ' '; }
      return `<div>${s}</div>`;
    };
    for (let i = 0; i < 34; i++) lines.push(line());
    hexEl.innerHTML = lines.join('');
    H.tick(dt => {
      acc += dt * M; if (acc < .12) return; acc = 0;
      if (!hexEl.offsetParent || !H.vis(pb)) return;
      lines.push(line()); if (lines.length > 34) lines.shift();
      hexEl.innerHTML = lines.join('');
    });
    H.watch(pb);
  }
});

/* ---------- packet stream ---------- */
H.def('hex', {
  title: 'Packet Stream', group: 'sec', mh: 280, cls: 'hexbig',
  desc: '16進ダンプとパケットヘッダが流れ続けるキャプチャ画面',
  icon: '<path d="M4 6h3M10 6h3M16 6h4M4 12h5M12 12h3M18 12h2M4 18h2M9 18h6M18 18h2"/>',
  build(pb) {
    pb.innerHTML = '<div class="hx-lines" aria-hidden="true"></div><div class="hx-foot"><span>if0 · PROMISC · BPF "tcp or udp"</span><span><b class="hx-rate">0</b> pkt/s</span></div>';
    const box = $('.hx-lines', pb), rateEl = $('.hx-rate', pb), lines = [];
    const IPS = ['10.24.7.91', '172.16.0.8', '192.168.4.20', '10.0.3.17', '203.0.113.5', '198.51.100.23'];
    let cw = 6.6, addr = 0x7f3a0000, acc = 0, rateAcc = 1;
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;display:inline-block;white-space:pre';
    probe.textContent = '0'.repeat(20); box.appendChild(probe);
    const measure = () => { cw = probe.offsetWidth / 20 || 6.6; };
    const perLine = () => clamp(Math.floor((box.clientWidth / cw - 11) / 4), 4, 32);
    const maxLines = () => Math.ceil(box.clientHeight / 16) + 1;
    function mk() {
      if (Math.random() < .07) return `<div class="hdr">── ${pick(['TCP', 'UDP', 'TLS', 'DNS'])} ${pick(IPS)}:${ri(1024, 65000)} → ${pick(IPS)}:${pick([443, 22, 53, 8080, 5432])} len=${ri(60, 1500)} ──</div>`;
      const n = perLine(); addr += n;
      let hex = '', asc = '';
      for (let i = 0; i < n; i++) {
        const b = ri(0, 255), hx = b.toString(16).toUpperCase().padStart(2, '0');
        hex += (Math.random() < .06 ? `<em>${hx}</em>` : hx) + ' ';
        asc += b > 32 && b < 127 ? esc(String.fromCharCode(b)) : '.';
      }
      return `<div><span class="hx-a">${addr.toString(16).toUpperCase().padStart(8, '0')}</span>  ${hex} <span class="hx-s">${asc}</span></div>`;
    }
    const render = () => { box.innerHTML = lines.join(''); box.appendChild(probe); };
    measure();
    for (let i = 0; i < maxLines(); i++) lines.push(mk());
    render();
    new ResizeObserver(measure).observe(box);
    H.watch(pb);
    H.tick(dt => {
      rateAcc += dt; if (rateAcc > .5) { rateAcc = 0; rateEl.textContent = fmt(ri(800, 2400)); }
      acc += dt * M; if (acc < .085 || !H.vis(pb)) return; acc = 0;
      lines.push(mk()); const m = maxLines(); while (lines.length > m) lines.shift();
      render();
    });
  }
});

/* ---------- globe ---------- */
H.def('globe', {
  title: 'Global Network', group: 'net', mh: 320,
  desc: 'ドットで描いた地球儀が自転し、都市間を光の弧が走る。ドラッグで回せる',
  icon: H.VIEWS.ops.icon,
  build(pb) {
    pb.innerHTML = `<canvas class="fill cv-grab" role="img" aria-label="Rotating globe with live network links"></canvas>
      <div class="ov net-stats"><div>NODES<b data-k="nodes">3,482</b></div><div>ONLINE<b data-k="online">99.8%</b></div><div>LINKS<b data-k="links">0</b></div></div>
      <ul class="net-log"></ul>`;
    const globe = H.surface($('canvas', pb)), logEl = $('.net-log', pb);
    const GN = (() => {
      const N = 7200, ga = Math.PI * (3 - Math.sqrt(5)), xs = [], ys = [], zs = [], ls = [];
      for (let i = 0; i < N; i++) {
        const y = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - y * y), th = i * ga, x = Math.cos(th) * r, z = Math.sin(th) * r;
        const land = H.isLand(Math.atan2(x, z) / D2R, Math.asin(y) / D2R);
        if (land || i % 3 === 0) { xs.push(x); ys.push(y); zs.push(z); ls.push(land ? 1 : 0); }
      }
      return { n: xs.length, x: Float32Array.from(xs), y: Float32Array.from(ys), z: Float32Array.from(zs), l: Uint8Array.from(ls) };
    })();
    const CITIES = H.CITIES, TILT = .42, arcs = [], hits = [];
    let gRot = -152 * D2R, gVel = 0, gDrag = null, linkCount = 0, arcTimer = 1.2;
    function spawnArc(a, b) {
      const va = a.v, vb = b.v, ang = Math.acos(clamp(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1));
      if (ang < .05 || ang > 3) return;
      const s0 = Math.sin(ang), pts = [];
      for (let i = 0; i <= 40; i++) {
        const s = i / 40, k1 = Math.sin((1 - s) * ang) / s0, k2 = Math.sin(s * ang) / s0, lift = 1 + ang * .16 * Math.sin(Math.PI * s);
        pts.push([(va[0] * k1 + vb[0] * k2) * lift, (va[1] * k1 + vb[1] * k2) * lift, (va[2] * k1 + vb[2] * k2) * lift]);
      }
      arcs.push({ a, b, pts, t: 0, dur: .9 + ang * .55, ms: Math.round(18 + ang * 70 + rand(0, 20)), hit: false });
    }
    H.on('trace', id => { const dst = H.city(id); if (dst && dst !== CITIES[0]) spawnArc(CITIES[0], dst); });
    function logLink(A) {
      linkCount++; $('[data-k="links"]', pb).textContent = fmt(linkCount);
      const li = document.createElement('li');
      li.innerHTML = `<b>${A.a.id}</b><span>→</span><b>${A.b.id}</b><span>${A.ms}ms</span>`;
      logEl.appendChild(li);
      while (logEl.children.length > 3) logEl.firstChild.remove();
    }
    setInterval(() => { $('[data-k="nodes"]', pb).textContent = fmt(3482 + ri(-9, 9)); $('[data-k="online"]', pb).textContent = (99.6 + Math.random() * .35).toFixed(1) + '%'; }, 1000);
    const cv = globe.cv;
    cv.addEventListener('pointerdown', e => { gDrag = { x: e.clientX, r: gRot, lx: e.clientX, lt: performance.now() }; gVel = 0; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', e => {
      if (!gDrag) return;
      const now = performance.now();
      gRot = gDrag.r + (e.clientX - gDrag.x) * .008;
      gVel = clamp((e.clientX - gDrag.lx) * .008 / Math.max(.016, (now - gDrag.lt) / 1000), -5, 5);
      gDrag.lx = e.clientX; gDrag.lt = now;
    });
    const endDrag = () => { gDrag = null; cv.style.cursor = ''; };
    cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

    H.tick((dt, t) => {
      if (!gDrag) { gRot += (.14 * M + gVel) * dt; gVel *= Math.pow(.06, dt); }
      arcTimer -= dt * M;
      if (arcTimer <= 0) { arcTimer = rand(.45, 1.2); if (arcs.length < 8) { const a = pick(CITIES), b = pick(CITIES); if (a !== b) spawnArc(a, b); } }
      for (let i = arcs.length - 1; i >= 0; i--) {
        const A = arcs[i]; A.t += dt / A.dur;
        if (!A.hit && A.t >= 1) { A.hit = true; hits.push({ c: A.b, t: 0 }); logLink(A); }
        if (A.t > 1.6) arcs.splice(i, 1);
      }
      for (let i = hits.length - 1; i >= 0; i--) { hits[i].t += dt; if (hits[i].t > 1) hits.splice(i, 1); }
      if (!H.vis(cv)) return;
      const { ctx, w, h } = globe; ctx.clearRect(0, 0, w, h);
      const R = Math.min(w * .4, h * .41), cx = w * .56, cy = h * .5;
      const cr = Math.cos(gRot), sr = Math.sin(gRot), ct = Math.cos(TILT), st = Math.sin(TILT);
      const prj = v => {
        const x = v[0] * cr + v[2] * sr, z = -v[0] * sr + v[2] * cr, y = v[1] * ct - z * st, zz = v[1] * st + z * ct;
        return [cx + x * R, cy - y * R, zz, x * x + y * y];
      };
      let g = ctx.createRadialGradient(cx, cy, R * .9, cx, cy, R * 1.32);
      g.addColorStop(0, rgba(C.a1, .2)); g.addColorStop(.3, rgba(C.a1, .07)); g.addColorStop(1, rgba(C.a1, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.32, 0, TAU); ctx.fill();
      g = ctx.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R);
      g.addColorStop(0, rgba(C.a1, .12)); g.addColorStop(1, rgba(C.deep, .35));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      ctx.lineWidth = 1; ctx.setLineDash([2, 6]); ctx.lineDashOffset = -t * 18 * M;
      ctx.strokeStyle = rgba(C.a1, .3); ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 2; ctx.strokeStyle = rgba(C.a2, .7);
      const oa = t * .5 * M;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, oa, oa + .55); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, oa + Math.PI, oa + Math.PI + .3); ctx.stroke();
      ctx.lineWidth = .7;
      const line = (fn, n, a) => {
        ctx.strokeStyle = rgba(C.a1, a); ctx.beginPath(); let pen = false;
        for (let k = 0; k <= n; k++) { const p = prj(fn(k / n)); if (p[2] > 0) { pen ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); pen = true; } else pen = false; }
        ctx.stroke();
      };
      for (const la of [-60, -30, 0, 30, 60]) line(s => H.toVec(s * 360 - 180, la), 72, la === 0 ? .22 : .09);
      for (let lo = -180; lo < 180; lo += 30) line(s => H.toVec(lo, s * 180 - 90), 36, .07);
      const ds = Math.max(1.2, R * .013), half = ds / 2;
      ctx.fillStyle = rgba(C.a1, 1);
      for (let i = 0; i < GN.n; i++) {
        const x0 = GN.x[i], y0 = GN.y[i], z0 = GN.z[i], land = GN.l[i];
        const x = x0 * cr + z0 * sr, z = -x0 * sr + z0 * cr, y = y0 * ct - z * st, zz = y0 * st + z * ct;
        let a;
        if (zz > 0) a = land ? .32 + .68 * zz : .05 + .08 * zz;
        else if (land) a = .05 + .05 * (1 + zz);
        else continue;
        ctx.globalAlpha = a; ctx.fillRect(cx + x * R - half, cy - y * R - half, ds, ds);
      }
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1; ctx.strokeStyle = rgba(C.a1, .55); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.font = '500 9px "JetBrains Mono", monospace';
      for (const c of CITIES) {
        const p = prj(c.v); if (p[2] <= 0) continue;
        const pulse = .5 + .5 * Math.sin(t * 3 + c.ph);
        ctx.fillStyle = rgba(C.a1, .2 * p[2]); ctx.beginPath(); ctx.arc(p[0], p[1], 4 + pulse * 3, 0, TAU); ctx.fill();
        ctx.fillStyle = rgba(C.ink, .3 + .7 * p[2]); ctx.beginPath(); ctx.arc(p[0], p[1], 1.7, 0, TAU); ctx.fill();
        if (p[2] > .3 && R > 70) { ctx.fillStyle = rgba(C.ink, .6 * p[2]); ctx.fillText(c.id, p[0] + 6, p[1] - 5); }
      }
      ctx.lineCap = 'round';
      for (const A of arcs) {
        const n = A.pts.length - 1, head = Math.min(1, A.t), tail = clamp(A.t - .55, 0, 1);
        const i0 = Math.floor(tail * n), i1 = Math.ceil(head * n);
        let prev = null;
        for (let k = i0; k <= i1; k++) {
          const p = prj(A.pts[k]); p.on = p[2] > 0 || p[3] > 1;
          if (prev && p.on && prev.on) {
            const f = (k - i0) / Math.max(1, i1 - i0);
            ctx.strokeStyle = rgba(mix(C.a2, C.a1, f), .15 + .85 * f); ctx.lineWidth = .8 + 1.5 * f;
            ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
          }
          prev = p;
        }
        if (A.t < 1 && prev && prev.on) {
          ctx.fillStyle = rgba(C.a1, .3); ctx.beginPath(); ctx.arc(prev[0], prev[1], 6, 0, TAU); ctx.fill();
          ctx.fillStyle = rgba(C.ink, 1); ctx.beginPath(); ctx.arc(prev[0], prev[1], 2, 0, TAU); ctx.fill();
        }
      }
      for (const Hh of hits) {
        const p = prj(Hh.c.v); if (p[2] <= 0) continue;
        ctx.strokeStyle = rgba(C.a3, (1 - Hh.t) * .9); ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(p[0], p[1], 3 + Hh.t * 18, 0, TAU); ctx.stroke();
      }
    });
  }
});

/* ---------- code editor ---------- */
const FILES = [
  { name: 'project_main.py', lang: 'py', src:
`from core.link import handshake
from utils.ghost import Cloak

def trace_signal(host):
    session = handshake(host, cipher="xchacha20")
    if session.verified():
        return session.stream(mode="ghost")
    return False

if __name__ == "__main__":
    relay = "10.24.7.91"
    with Cloak(layers=3):
        trace_signal(relay)` },
  { name: 'uplink.rs', lang: 'rs', src:
`use std::time::Duration;

#[derive(Debug)]
struct Uplink { node: &'static str, hops: u8 }

impl Uplink {
    // jitter keeps the relay hard to read
    fn pulse(&self) -> Duration {
        let ms = 40 + self.hops as u64 * 7;
        Duration::from_millis(ms)
    }
}

fn main() {
    let up = Uplink { node: "TYO", hops: 6 };
    println!("{:?}", up.pulse());
}` },
  { name: 'config.yaml', lang: 'yaml', src:
`# cybernode relay config
relay:
  node: TYO-07
  hops: 6
  cipher: "xchacha20"
  jitter_ms: 40
mesh:
  regions: [tyo, fra, sfo, sin]
  heartbeat: 2.5
  failover: true
logging:
  level: info
  sink: "/var/log/cybernode"` }
];
H.FILES = FILES.map(f => f.name);
const KW = {
  py: /^(?:from|import|def|if|else|elif|return|with|as|for|in|while|class|None|True|False|and|or|not|lambda|yield|try|except)$/,
  rs: /^(?:use|struct|impl|fn|let|mut|pub|self|Self|as|match|if|else|return|for|in|while|loop|u8|u64|i32|str)$/,
  yaml: /^(?:true|false|null|info|debug|warn)$/
};
const RE = {
  py: /(#.*)|("(?:[^"\\\n]|\\.)*")|(\b\d+(?:\.\d+)?\b)|(@\w+)|([A-Za-z_]\w*)|(\s+|.)/g,
  rs: /(\/\/.*)|("(?:[^"\\\n]|\\.)*"|'\w+)|(\b\d+(?:\.\d+)?\b)|(#\[[^\]]*\]|\w+!)|([A-Za-z_]\w*)|(\s+|.)/g,
  yaml: /(#.*)|("(?:[^"\\\n]|\\.)*")|(\b\d+(?:\.\d+)?\b)|(^[ \t]*[\w-]+(?=:))|([A-Za-z_][\w-]*)|(\s+|.)/gm
};
function tokenize(f) {
  const re = new RegExp(RE[f.lang].source, RE[f.lang].flags), out = [];
  let m;
  while ((m = re.exec(f.src))) {
    if (m[1]) out.push([m[1], 'tok-c']);
    else if (m[2]) out.push([m[2], 'tok-s']);
    else if (m[3]) out.push([m[3], 'tok-n']);
    else if (m[4]) out.push([m[4], f.lang === 'yaml' ? 'tok-f' : 'tok-a']);
    else if (m[5]) {
      const wd = m[5], next = f.src[re.lastIndex];
      out.push([wd, KW[f.lang].test(wd) ? 'tok-k' : next === '(' ? 'tok-f' : /^[A-Z]/.test(wd) ? 'tok-t' : '']);
    } else out.push([m[6], '']);
  }
  return out;
}
H.def('code', {
  title: 'Editor', group: 'dev', mh: 320, cls: 'code',
  desc: 'Python / Rust / YAML がシンタックスハイライト付きでタイピングされるエディタ',
  icon: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  build(pb, el) {
    const tabs = document.createElement('div'); tabs.className = 'tabs';
    tabs.innerHTML = FILES.map((f, i) => `<button class="tab" data-f="${i}">${f.name}<i aria-hidden="true">×</i></button>`).join('');
    $('.ph h2', el).replaceWith(tabs);
    pb.innerHTML = `<div class="tree">
        <div class="tr-root">▾ /workspace</div><div class="dir">core/</div><div class="dir">modules/</div><div class="dir">scanners/</div><div class="dir">packets/</div><div class="dir">utils/</div>
        ${FILES.map((f, i) => `<div class="file" data-f="${i}">${f.name}</div>`).join('')}<div class="file">README.md</div>
      </div>
      <div class="editor"><ol class="gutter" aria-hidden="true"></ol><div class="src"></div></div>`;
    const srcEl = $('.src', pb), gutEl = $('.gutter', pb), edEl = $('.editor', pb);
    const code = { f: 0, n: 0, toks: [], phase: 'type', hold: 0, acc: 0 };
    function loadFile(i) {
      code.f = i; code.toks = tokenize(FILES[i]); code.n = REDUCED ? FILES[i].src.length : 0; code.phase = 'type'; code.acc = 0;
      $$('.tab', tabs).forEach(t => t.classList.toggle('on', +t.dataset.f === i));
      $$('.tree .file', pb).forEach(t => t.classList.toggle('on', t.dataset.f === String(i)));
      render();
    }
    function render() {
      let left = code.n, html = '<div class="cl">', lines = 1;
      for (const [txt, cls] of code.toks) {
        if (left <= 0) break;
        const part = txt.length > left ? txt.slice(0, left) : txt; left -= part.length;
        part.split('\n').forEach((s, i) => { if (i) { html += '</div><div class="cl">'; lines++; } if (s) html += cls ? `<span class="${cls}">${esc(s)}</span>` : esc(s); });
      }
      html += '<span class="caret"></span></div>';
      const k = html.lastIndexOf('<div class="cl">');
      srcEl.innerHTML = html.slice(0, k) + '<div class="cl cur">' + html.slice(k + 16);
      if (gutEl.children.length !== lines) gutEl.innerHTML = Array.from({ length: lines }, (_, i) => `<li${i === lines - 1 ? ' class="cur"' : ''}>${i + 1}</li>`).join('');
      edEl.scrollTop = edEl.scrollHeight;
    }
    tabs.addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) loadFile(+b.dataset.f); });
    pb.addEventListener('click', e => { const f = e.target.closest('.file[data-f]'); if (f) loadFile(+f.dataset.f); });
    H.on('open-file', name => { const i = FILES.findIndex(f => f.name === name); if (i >= 0) { loadFile(i); H.focusPanel('code'); } });
    H.tick(dt => {
      const src = FILES[code.f].src;
      if (code.phase === 'type') {
        code.acc += dt; let n = code.n;
        while (code.acc > 1 / 34 && n < src.length) {
          code.acc -= 1 / 34; n++;
          while (src[n] === ' ' && (src[n - 1] === '\n' || src[n - 1] === ' ')) n++;
          if (src[n - 1] === '\n') { code.acc -= rand(.12, .4); break; }
        }
        if (n !== code.n) { code.n = n; render(); }
        if (code.n >= src.length) { code.phase = 'hold'; code.hold = 5; }
      } else if ((code.hold -= dt) <= 0) loadFile((code.f + 1) % FILES.length);
    });
    loadFile(0);
  }
});

/* ---------- system dashboard ---------- */
H.def('sys', {
  title: 'System Dashboard', group: 'sys', mh: 300, cls: 'sys',
  desc: 'CPU・RAM・GPU のリングゲージ、負荷のスパークライン、稼働時間',
  icon: '<circle cx="12" cy="13" r="8"/><path d="M12 13l4-3M8 5.5L6.5 3M16 5.5L17.5 3"/>',
  build(pb) {
    const gauge = (k, l, cls = '') => `<div class="gauge ${cls}" data-g="${k}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="g-tick" cx="50" cy="50" r="46"/><circle class="g-track" cx="50" cy="50" r="38"/><circle class="g-val" cx="50" cy="50" r="38" stroke-dasharray="0 238.8"/><circle class="g-orb" cx="50" cy="50" r="30"/></svg><div class="g-lab"><span>${l}</span><b>0%</b></div></div>`;
    pb.innerHTML = `<div class="gauges">${gauge('cpu', 'CPU')}${gauge('ram', 'RAM', 'g2')}${gauge('gpu', 'GPU')}</div>
      <div class="sys-bot"><div class="spark"><canvas class="fill" aria-hidden="true"></canvas></div>
      <dl class="kvl"><dt>Uptime</dt><dd data-k="up">12d 04:17:36</dd><dt>Processes</dt><dd data-k="procs">1,428</dd><dt>Net ↑</dt><dd data-k="nu">1.96 GB/s</dd><dt>Net ↓</dt><dd data-k="nd">412 MB/s</dd></dl></div>`;
    const GC = 2 * Math.PI * 38;
    const G = ['cpu', 'ram', 'gpu'].map((k, i) => ({ v: [24, 68, 42][i], t: [24, 68, 42][i], lo: [6, 50, 12][i], hi: [94, 88, 97][i], j: [16, 5, 14][i], arc: $(`[data-g="${k}"] .g-val`, pb), lab: $(`[data-g="${k}"] b`, pb), r: -1 }));
    const spark = H.surface($('.spark canvas', pb)), sv = Array.from({ length: 40 }, () => rand(15, 45));
    let acc = 0, sAcc = 0, procs = 1428, nu = 1.96, nd = 412;
    const upBase = 12 * 86400 + 4 * 3600 + 17 * 60 + 36, t0 = Date.now();
    setInterval(() => {
      const s = Math.floor(upBase + (Date.now() - t0) / 1000);
      $('[data-k="up"]', pb).textContent = `${Math.floor(s / 86400)}d ${p2(Math.floor(s % 86400 / 3600))}:${p2(Math.floor(s % 3600 / 60))}:${p2(s % 60)}`;
    }, 1000);
    H.tick(dt => {
      acc += dt;
      if (acc > 1.3) {
        acc = 0;
        G.forEach(g => { g.t = clamp(g.t + rand(-g.j, g.j), g.lo, g.hi); });
        procs = clamp(procs + ri(-6, 6), 1380, 1490); nu = clamp(nu + rand(-.3, .3), .8, 3.6); nd = clamp(nd + rand(-60, 60), 120, 900);
        $('[data-k="procs"]', pb).textContent = fmt(procs); $('[data-k="nu"]', pb).textContent = nu.toFixed(2) + ' GB/s'; $('[data-k="nd"]', pb).textContent = Math.round(nd) + ' MB/s';
      }
      for (const g of G) {
        g.v += (g.t - g.v) * Math.min(1, dt * 2.2);
        g.arc.setAttribute('stroke-dasharray', `${(g.v / 100 * GC).toFixed(1)} ${GC.toFixed(1)}`);
        const r = Math.round(g.v); if (r !== g.r) { g.r = r; g.lab.textContent = r + '%'; }
      }
      sAcc += dt; if (sAcc > .45) { sAcc = 0; sv.shift(); sv.push(G[0].v); }
      if (H.vis(spark.cv)) H.drawSeries(spark, sv, C.a1, 100);
    });
  }
});

/* ---------- terminal ---------- */
H.def('term', {
  title: 'Terminal 01 — root@cybernode:~', nocase: true, group: 'dev', mh: 340, cls: 'term',
  desc: '入力できるターミナル。help・scan・trace・breach・theme・open など',
  icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
  build(pb) {
    pb.innerHTML = '<div class="term-out" aria-live="polite"></div><label class="term-in"><span class="ps1">root@cybernode:~$</span><input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Terminal command" placeholder="help"></label>';
    const out = $('.term-out', pb), input = $('input', pb);
    const PS1 = '<span class="p">root@cybernode</span><span class="dim">:</span><span class="hl">~</span><span class="dim">$</span> ';
    const print = (html = '', cls = '') => {
      const d = document.createElement('div'); d.className = 'ln ' + cls; d.innerHTML = html; out.appendChild(d);
      while (out.children.length > 160) out.firstChild.remove();
      out.scrollTop = out.scrollHeight; return d;
    };
    let introOn = true, busy = false, hi = 0;
    const hist = [];
    async function typeCmd(cmd) {
      const l = print(PS1);
      for (const ch of cmd) { if (!introOn) return l; l.append(ch); out.scrollTop = out.scrollHeight; H.tone(rand(1500, 2200), .015, 'square', .012); await sleep(REDUCED ? 0 : rand(40, 95)); }
      return l;
    }
    async function intro() {
      const steps = [
        () => sleep(1300),
        () => typeCmd('sweep --sector 7G'),
        async () => { print('<span class="dim">Scanning…</span>'); await sleep(600); },
        async () => { print('Host is up <span class="dim">(0.023s latency)</span>.'); await sleep(200); },
        async () => { print('Ports: <span class="ok">22/open</span> ssh, <span class="ok">80/open</span> http, <span class="ok">443/open</span> https'); await sleep(700); },
        () => typeCmd('uplink --auto'),
        async () => { print('<span class="p">[*]</span> Loading module…'); await sleep(420); },
        async () => { print('<span class="p">[*]</span> Negotiating handshake…'); await sleep(520); },
        async () => { print('[✓] Access granted.', 'big'); H.tone(660, .08, 'sine', .03); H.tone(990, .12, 'sine', .03, 0, .08); await sleep(300); },
        async () => { print('<span class="dim">type</span> <span class="hl">help</span> <span class="dim">— コマンド一覧</span>'); }
      ];
      for (const s of steps) { if (!introOn) return; await s(); }
      introOn = false;
    }
    const names = () => [...Object.keys(H.VIEWS), 'hub', ...Object.keys(H.DEFS)];
    const CMDS = {
      help: { run() {
        [['help', 'コマンド一覧'], ['scan', 'ターゲットを再スキャン'], ['trace <city>', '回線をトレース (lon nyc sfo syd…)'], ['decrypt', '暗号メッセージを解読'], ['breach', 'アクセスシーケンス'], ['theme <name>', 'neon · phosphor · amber · ice'], ['matrix', 'コードレイン ON/OFF'], ['glitch', '画面グリッチ'], ['open <name>', 'ビューやパネルを開く (ops, dev, globe…)'], ['ls', 'ビューとパネルの一覧'], ['whoami date clear', '']]
          .forEach(([k, d]) => print(`  <span class="hl">${esc(k.padEnd(14))}</span> <span class="dim">${d}</span>`));
      } },
      scan: { async run() {
        print('<span class="dim">sweeping sector 7G …</span>');
        const l = print(''), N = 22;
        for (let p = 0; p < 100; p += ri(3, 9)) { const k = Math.round(p / 100 * N); l.innerHTML = `<span class="p">[${'█'.repeat(k)}${'░'.repeat(N - k)}]</span> ${p}%`; await sleep(REDUCED ? 0 : 55); }
        l.innerHTML = `<span class="p">[${'█'.repeat(N)}]</span> 100%`;
        print('<span class="ok">✓</span> 3 services fingerprinted · 0 alerts raised');
        H.emit('scan'); H.focusPanel('target');
      } },
      trace: { async run([to]) {
        const others = H.CITIES.slice(1);
        let dst = to ? H.city(to) : null;
        if (to && !dst) { print(`<span class="err">unknown node:</span> ${esc(to)} <span class="dim">(${others.map(c => c.id.toLowerCase()).join(' ')})</span>`); return; }
        if (dst === H.CITIES[0]) { print('<span class="dim">already home.</span>'); return; }
        dst = dst || pick(others);
        print(`<span class="dim">routing</span> TYO <span class="p">→</span> ${dst.id} <span class="dim">via ${ri(4, 9)} hops…</span>`);
        H.emit('trace', dst.id);
        if (!H.focusPanel('globe')) H.focusPanel('worldmap');
        await sleep(900); print(`<span class="ok">✓</span> link stable · ${ri(80, 220)}ms`);
      } },
      decrypt: { async run() {
        print('<span class="dim">cipher:</span> ' + Array.from({ length: 12 }, () => hexByte().toLowerCase()).join(' '));
        const l = print('<span class="dim">plain :</span> '), s = document.createElement('span'); s.className = 'ok'; l.append(s);
        H.decode(s, '合言葉は「ねこ」。猫はキーボードの横で寝ている。', 1800);
        await sleep(1900);
      } },
      breach: { async run() { print('<span class="dim">running access sequence…</span>'); H.focusPanel('security'); H.runBreach(); await sleep(400); } },
      theme: { run([n]) {
        if (!n || !H.ACCENTS[n]) { print('<span class="dim">themes:</span> ' + Object.keys(H.ACCENTS).map(x => `<span class="hl">${x}</span>`).join(' · ')); return; }
        H.setAccent(n); print(`<span class="ok">✓</span> accent → ${n}`);
      } },
      matrix: { run() { H.toggleFx('rain'); print(`code rain ${H.settings.rain ? '<span class="ok">ON</span>' : '<span class="dim">OFF</span>'}`); } },
      glitch: { run() { H.glitch(800); } },
      open: { run([n]) {
        if (!n || !names().includes(n)) { print('<span class="dim">usage:</span> open <span class="hl">&lt;' + Object.keys(H.VIEWS).join('|') + '|hub|panel&gt;</span>'); return; }
        print(`<span class="dim">opening</span> ${esc(n)} …`); setTimeout(() => H.go(n), 350);
      } },
      ls: { run() {
        print('<span class="p">views/</span>  ' + Object.keys(H.VIEWS).join('  '));
        print('<span class="p">panels/</span> ' + Object.keys(H.DEFS).join('  '));
      } },
      whoami: { run() { print('guest<span class="dim">@cybernode</span> · clearance <span class="hl">0x2A</span>'); } },
      date: { run() { print(new Date().toString()); } },
      clear: { run() { out.innerHTML = ''; } },
      sudo: { hidden: true, run() { print('<span class="warn">nice try.</span>'); } },
      exit: { hidden: true, run() { print('<span class="dim">there is no exit.</span>'); } },
      echo: { hidden: true, run(a) { print(esc(a.join(' '))); } }
    };
    async function runCmd(raw) {
      const line = raw.trim(); print(PS1 + esc(line));
      if (!line) return;
      hist.push(line); hi = hist.length;
      const [cmd, ...args] = line.split(/\s+/), c = CMDS[cmd.toLowerCase()];
      if (!c) { print(`<span class="err">command not found:</span> ${esc(cmd)} <span class="dim">— try help</span>`); H.tone(220, .12, 'sawtooth', .02); return; }
      busy = true;
      try { await c.run(args); } finally { busy = false; out.scrollTop = out.scrollHeight; }
    }
    H.on('clear-terminal', () => { out.innerHTML = ''; });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); if (busy) return; const v = input.value; input.value = ''; introOn = false; runCmd(v); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) { hi--; input.value = hist[hi]; } }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi < hist.length) { hi++; input.value = hist[hi] || ''; } }
      else if (e.key === 'Tab' && input.value.trim()) {
        e.preventDefault();
        const m = Object.keys(CMDS).filter(k => !CMDS[k].hidden && k.startsWith(input.value.trim().toLowerCase()));
        if (m.length === 1) input.value = m[0] + ' '; else if (m.length > 1) print(m.join('  '), 'dim');
      } else if (e.key.length === 1) H.tone(rand(1800, 2400), .012, 'square', .008);
    });
    pb.addEventListener('click', () => { if (!String(getSelection())) input.focus({ preventScroll: true }); });
    intro();
  }
});

/* ---------- network monitor ---------- */
H.def('netmon', {
  title: 'Network Monitor', group: 'net', mh: 240,
  desc: 'IN / OUT トラフィックの波形がリアルタイムで流れるモニタ',
  icon: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  build(pb) {
    pb.innerHTML = '<canvas class="fill" aria-hidden="true"></canvas><div class="ov" style="top:8px;left:12px;letter-spacing:.12em">eth0 · 10 GbE</div><div class="ov" style="top:8px;right:12px;display:flex;gap:14px"><span><i class="sw"></i>IN <b data-k="in">1.96 GB/s</b></span><span><i class="sw out"></i>OUT <b data-k="out">412 MB/s</b></span></div>';
    const wave = H.surface($('canvas', pb));
    const WN = 200, wIn = new Float32Array(WN), wOut = new Float32Array(WN);
    let acc = 0, wT = 0, spIn = 0, spOut = 0, count = 0, rAcc = 0;
    function sample() {
      wT += .08; count++;
      if (Math.random() < .035) spIn = rand(.25, .5);
      if (Math.random() < .025) spOut = rand(.15, .35);
      spIn *= .85; spOut *= .85;
      wIn.copyWithin(0, 1); wOut.copyWithin(0, 1);
      wIn[WN - 1] = clamp(.38 + .14 * Math.sin(wT * .6) + .08 * Math.sin(wT * 2.1 + 1) + spIn + rand(-.1, .12), .03, .98);
      wOut[WN - 1] = clamp(.2 + .07 * Math.sin(wT * .45 + 2) + .05 * Math.sin(wT * 3.3) + spOut + rand(-.06, .07), .02, .9);
    }
    for (let i = 0; i < WN; i++) sample();
    H.tick(dt => {
      acc += dt; while (acc >= .033) { sample(); acc -= .033; }
      rAcc += dt;
      if (rAcc > .5) { rAcc = 0; $('[data-k="in"]', pb).textContent = (wIn[WN - 1] * 4.2).toFixed(2) + ' GB/s'; $('[data-k="out"]', pb).textContent = Math.round(wOut[WN - 1] * 1400) + ' MB/s'; }
      if (!H.vis(wave.cv)) return;
      const { ctx, w, h } = wave; ctx.clearRect(0, 0, w, h);
      const top = 30, bot = h - 10, Hh = bot - top, right = w - 26, step = right / (WN - 1);
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) { const y = Math.round(top + Hh * i / 4) + .5; ctx.strokeStyle = rgba(C.a1, i === 4 ? .25 : .07); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = rgba(C.a1, .06); ctx.beginPath();
      for (let i = 0; i < WN; i++) if ((count - (WN - 1 - i)) % 25 === 0) { const x = Math.round(i * step) + .5; ctx.moveTo(x, top); ctx.lineTo(x, bot); }
      ctx.stroke();
      const series = (arr, col, alpha) => {
        const p = new Path2D();
        for (let i = 0; i < WN; i++) { const x = i * step, y = bot - arr[i] * Hh; i ? p.lineTo(x, y) : p.moveTo(x, y); }
        const f = new Path2D(p); f.lineTo(right, bot); f.lineTo(0, bot); f.closePath();
        const g = ctx.createLinearGradient(0, top, 0, bot); g.addColorStop(0, rgba(col, alpha)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g; ctx.fill(f);
        ctx.strokeStyle = rgba(col, .25); ctx.lineWidth = 3; ctx.stroke(p);
        ctx.strokeStyle = rgba(col, .95); ctx.lineWidth = 1.1; ctx.stroke(p);
        const ly = bot - arr[WN - 1] * Hh;
        ctx.fillStyle = rgba(col, .28); ctx.beginPath(); ctx.arc(right, ly, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = rgba(C.ink, 1); ctx.beginPath(); ctx.arc(right, ly, 2, 0, TAU); ctx.fill();
      };
      series(wOut, C.a2, .35); series(wIn, C.a1, .45);
      ctx.fillStyle = rgba(C.dim, .8); ctx.font = '9px "JetBrains Mono", monospace'; ctx.textAlign = 'right';
      ['4G', '2G', '0'].forEach((s, i) => ctx.fillText(s, w - 4, top + Hh * i / 2 + 3));
      ctx.textAlign = 'left';
    });
  }
});

/* ---------- target analysis ---------- */
H.def('target', {
  title: 'Target Analysis', group: 'sec', mh: 280, cls: 'target',
  desc: '回転するワイヤーフレームのビルを走査線がスキャンし、工程が順に完了していく',
  icon: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><rect x="9" y="7" width="6" height="11"/><path d="M10.5 10h3M10.5 13h3"/>',
  build(pb) {
    const STEPS = ['Reconnaissance', 'Surface Mapping', 'Handshake', 'Privilege Escalation', 'Persistence'];
    pb.innerHTML = `<div class="tower"><canvas class="fill" aria-hidden="true"></canvas></div>
      <div class="steps"><ol>${STEPS.map(s => `<li class="step"><span>${s}</span>${CHECK}<b class="bar"></b></li>`).join('')}</ol>
      <div class="tgt-meta"><span>HOST <b>10.24.7.91</b></span><b data-k="prog">0%</b></div></div>`;
    const tower = H.surface($('canvas', pb));
    const TIERS = [[1, 0, 1.15], [.78, 1.15, 2.05], [.56, 2.05, 2.8], [.32, 2.8, 3.25]];
    const sq = (hw, y) => [[-hw, y, -hw], [hw, y, -hw], [hw, y, hw], [-hw, y, hw]];
    const E = [];
    for (const [s, y0, y1] of TIERS) {
      const hw = s / 2, b = sq(hw, y0), tp = sq(hw, y1);
      for (let i = 0; i < 4; i++) E.push([b[i], b[(i + 1) % 4], 0], [tp[i], tp[(i + 1) % 4], 0], [b[i], tp[i], 0]);
      for (let y = y0 + .16; y < y1 - .05; y += .16) { const r = sq(hw, y); for (let i = 0; i < 4; i++) E.push([r[i], r[(i + 1) % 4], 1]); }
    }
    E.push([[0, 3.25, 0], [0, 3.85, 0], 0]);
    for (let v = -1.2; v <= 1.21; v += .4) E.push([[v, 0, -1.2], [v, 0, 1.2], 2], [[-1.2, 0, v], [1.2, 0, v], 2]);
    let ang = .6, ph = 0;
    H.tick(dt => {
      ang += dt * .35 * M; ph += dt * M;
      if (!H.vis(tower.cv)) return;
      const { ctx, w, h } = tower; ctx.clearRect(0, 0, w, h); if (w < 10) return;
      const ca = Math.cos(ang), sa = Math.sin(ang), ct = Math.cos(.4), st = Math.sin(.4);
      const S = Math.min(h / 4.9, w / 3.2), cx = w / 2, cy = h / 2 + S * .1;
      const P = p => { const x = p[0] * ca + p[2] * sa, z = -p[0] * sa + p[2] * ca, y = p[1] - 1.75, y2 = y * ct - z * st, z2 = y * st + z * ct, k = 7 / (7 - z2); return [cx + x * k * S, cy - y2 * k * S]; };
      const ys = REDUCED ? 3.25 : clamp(1.62 + 1.75 * Math.sin(ph * .8), 0, 3.25);
      const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      for (const [a, b, type] of E) {
        const pa = P(a), pb2 = P(b), idx = type === 2 ? 4 : ((a[1] + b[1]) / 2 <= ys ? 0 : 2) + type;
        paths[idx].moveTo(pa[0], pa[1]); paths[idx].lineTo(pb2[0], pb2[1]);
      }
      ctx.lineWidth = 1; ctx.strokeStyle = rgba(C.a1, .1); ctx.stroke(paths[4]);
      ctx.strokeStyle = rgba(C.a1, .22); ctx.beginPath();
      for (let i = 0; i <= 48; i++) { const an = i / 48 * TAU, q = P([Math.cos(an) * 1.35, 0, Math.sin(an) * 1.35]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      ctx.stroke();
      const o = P([0, 0, 0]);
      for (let i = 0; i < 6; i++) { const an = ph * 1.6 - i * .09, q = P([Math.cos(an) * 1.35, 0, Math.sin(an) * 1.35]); ctx.strokeStyle = rgba(C.a1, .5 - i * .08); ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
      ctx.strokeStyle = rgba(C.a2, .14); ctx.stroke(paths[3]);
      ctx.strokeStyle = rgba(C.a2, .42); ctx.stroke(paths[2]);
      ctx.strokeStyle = rgba(C.a1, .34); ctx.stroke(paths[1]);
      ctx.strokeStyle = rgba(C.a1, .9); ctx.lineWidth = 1.2; ctx.stroke(paths[0]);
      const tier = TIERS.find(([, y0, y1]) => ys >= y0 && ys <= y1) || TIERS[TIERS.length - 1];
      const corners = sq(tier[0] / 2 * 1.2, ys).map(P);
      ctx.beginPath(); corners.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath();
      ctx.fillStyle = rgba(C.a1, .14); ctx.fill(); ctx.strokeStyle = rgba(C.a1, .95); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = rgba(C.ink, 1); corners.forEach(q => { ctx.beginPath(); ctx.arc(q[0], q[1], 1.6, 0, TAU); ctx.fill(); });
      const rc = corners.reduce((m, q) => q[0] > m[0] ? q : m);
      ctx.font = '9px "JetBrains Mono", monospace'; ctx.fillStyle = rgba(C.a1, .9);
      const lbl = `${Math.round(ys * 42)}m`; ctx.fillText(lbl, Math.min(rc[0] + 5, w - ctx.measureText(lbl).width - 4), rc[1] + 3);
      const tip = P([0, 3.85, 0]); ctx.fillStyle = rgba(C.a3, .4 + .6 * Math.abs(Math.sin(ph * 3))); ctx.beginPath(); ctx.arc(tip[0], tip[1], 2, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(C.a1, .35); ctx.lineWidth = 1; const m = 8, L = 10;
      ctx.beginPath();
      ctx.moveTo(m, m + L); ctx.lineTo(m, m); ctx.lineTo(m + L, m);
      ctx.moveTo(w - m - L, m); ctx.lineTo(w - m, m); ctx.lineTo(w - m, m + L);
      ctx.moveTo(m, h - m - L); ctx.lineTo(m, h - m); ctx.lineTo(m + L, h - m);
      ctx.moveTo(w - m - L, h - m); ctx.lineTo(w - m, h - m); ctx.lineTo(w - m, h - m - L);
      ctx.stroke();
    });
    const els = $$('.step', pb), progEl = $('[data-k="prog"]', pb), tg = { i: 0, t: 0, dur: 1.6, hold: 0 };
    function restart() {
      els.forEach(s => { s.classList.remove('run', 'done'); $('.bar', s).style.width = '0'; });
      tg.i = 0; tg.t = 0; tg.hold = 0; tg.dur = rand(1.1, 2.2); els[0].classList.add('run');
    }
    H.on('scan', restart);
    H.tick(dt => {
      if (tg.i >= els.length) { if ((tg.hold -= dt) <= 0) restart(); return; }
      tg.t += dt;
      const el = els[tg.i], p = Math.min(1, tg.t / tg.dur);
      $('.bar', el).style.width = (p * 100).toFixed(1) + '%';
      progEl.textContent = Math.round((tg.i + p) / els.length * 100) + '%';
      if (p >= 1) {
        el.classList.remove('run'); el.classList.add('done'); H.tone(1320, .05, 'sine', .02);
        tg.i++; tg.t = 0; tg.dur = rand(1.1, 2.4);
        if (tg.i < els.length) els[tg.i].classList.add('run'); else tg.hold = 4;
      }
    });
    restart();
  }
});

/* ---------- data analysis ---------- */
H.def('analysis', {
  title: 'Data Analysis', group: 'data', mh: 300, cls: 'data',
  desc: '棒グラフ・プロトコル比率のドーナツ・推移グラフ・KPI',
  icon: '<path d="M5 20v-8M10 20V6M15 20v-9M20 20V9"/>',
  build(pb) {
    pb.innerHTML = `<div class="bars" aria-hidden="true"></div>
      <div class="donut"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="dn-track" cx="50" cy="50" r="40"/><g class="dn-rot">
        <circle class="dn s1 act" cx="50" cy="50" r="40" stroke-dasharray="104 251.3" stroke-dashoffset="0"/>
        <circle class="dn s2" cx="50" cy="50" r="40" stroke-dasharray="64 251.3" stroke-dashoffset="-106.3"/>
        <circle class="dn" cx="50" cy="50" r="40" stroke-dasharray="44 251.3" stroke-dashoffset="-172.6" style="stroke:var(--a3)"/>
        <circle class="dn" cx="50" cy="50" r="40" stroke-dasharray="30 251.3" stroke-dashoffset="-218.9" style="stroke:var(--mute)"/>
      </g><circle class="dn-inner" cx="50" cy="50" r="31"/></svg><div class="dn-lab"><b>42%</b><span>TCP</span></div></div>
      <div class="cvbox"><canvas class="fill" aria-hidden="true"></canvas></div>
      <table class="kpi"><tbody>
        <tr><td>Users</td><td data-k="users">12,430</td><td class="good">↑ 8.2%</td></tr>
        <tr><td>Traffic</td><td data-k="traffic">4.78 TB</td><td class="good">↑ 14.6%</td></tr>
        <tr><td>Requests</td><td data-k="req">28.4 M</td><td class="good">↑ 9.1%</td></tr>
        <tr><td>Errors</td><td data-k="err">0.12%</td><td class="good">↓ 35.7%</td></tr>
      </tbody></table>`;
    const barsEl = $('.bars', pb), vals = Array.from({ length: 20 }, () => rand(.25, .95));
    barsEl.innerHTML = vals.map(v => `<i style="--h:${(v * 100).toFixed(1)}%"></i>`).join('');
    const bars = [...barsEl.children], line = H.surface($('canvas', pb));
    const lt = Array.from({ length: 28 }, (_, i) => 45 + 20 * Math.sin(i / 3) + rand(-8, 8)), lv = lt.slice();
    const DN = [['TCP', 42], ['UDP', 26], ['QUIC', 18], ['ICMP', 14]], segs = $$('.dn', pb);
    const k = { users: 12430, traffic: 4.78, req: 28.4, err: .12 };
    let a1 = 0, a2 = 0, a3 = 0, di = 0;
    H.tick(dt => {
      a1 += dt;
      if (a1 > 1.6) {
        a1 = 0;
        bars.forEach((b, i) => { vals[i] = clamp(vals[i] + rand(-.25, .25), .12, 1); b.style.setProperty('--h', (vals[i] * 100).toFixed(1) + '%'); });
        lt.shift(); lt.push(clamp(lt[lt.length - 1] + rand(-14, 14), 12, 92));
      }
      for (let i = 0; i < lv.length; i++) lv[i] += (lt[i] - lv[i]) * Math.min(1, dt * 3);
      if (H.vis(line.cv)) H.drawSeries(line, lv, C.a2, 100);
      a2 += dt;
      if (a2 > 2.2) {
        a2 = 0;
        k.users += ri(-6, 18); k.traffic += rand(0, .02); k.req += rand(0, .2); k.err = clamp(k.err + rand(-.01, .01), .05, .3);
        $('[data-k="users"]', pb).textContent = fmt(k.users); $('[data-k="traffic"]', pb).textContent = k.traffic.toFixed(2) + ' TB';
        $('[data-k="req"]', pb).textContent = k.req.toFixed(1) + ' M'; $('[data-k="err"]', pb).textContent = k.err.toFixed(2) + '%';
      }
      a3 += dt;
      if (a3 > 2.6) {
        a3 = 0; di = (di + 1) % DN.length;
        segs.forEach((s, i) => s.classList.toggle('act', i === di));
        H.decode($('.dn-lab span', pb), DN[di][0], 300); $('.dn-lab b', pb).textContent = DN[di][1] + '%';
      }
    });
  }
});

/* ---------- security core ---------- */
H.def('security', {
  title: 'Security Core', group: 'sec', mh: 440, cls: 'sec',
  desc: '回転リングのロック。クリックで解錠シーケンスと ACCESS GRANTED 演出',
  icon: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  build(pb) {
    const CHECKS = ['ACCESS', 'ENCRYPTION', 'TUNNEL', 'ANONYMITY', 'INTEGRITY'];
    pb.innerHTML = `<div class="lockwrap" role="button" tabindex="0" aria-label="アクセスシーケンスを実行">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <defs><radialGradient id="lkGlow"><stop offset="0" style="stop-color:var(--a1);stop-opacity:.32"/><stop offset="1" style="stop-color:var(--a1);stop-opacity:0"/></radialGradient></defs>
          <circle cx="100" cy="100" r="80" fill="url(#lkGlow)"/>
          <g class="rg rg-c"><circle cx="100" cy="100" r="97" fill="none" class="s1" stroke-opacity=".35" stroke-width="1" stroke-dasharray="1 5"/></g>
          <g class="rg rg-a"><circle cx="100" cy="100" r="89" fill="none" class="s1" stroke-opacity=".85" stroke-width="2.5" stroke-dasharray="70 12 10 12 120 20 40 18"/></g>
          <g class="rg rg-b"><circle cx="100" cy="100" r="79" fill="none" class="s1" stroke-opacity=".45" stroke-width="7" stroke-dasharray="1.2 3.2"/></g>
          <g class="rg rg-d"><circle cx="100" cy="100" r="71" fill="none" class="s2" stroke-width="2" stroke-dasharray="40 71.5"/></g>
          <circle cx="100" cy="100" r="63" fill="none" class="s1" stroke-opacity=".9" stroke-width="1.5"/>
          <g class="lk">
            <path class="lk-shackle s1" d="M84 92V78a16 16 0 0 1 32 0v14" fill="none" stroke-width="7" stroke-linecap="round"/>
            <rect class="s1" x="72" y="90" width="56" height="44" rx="8" stroke-width="3" style="fill:color-mix(in oklab,var(--a1) 16%,transparent)"/>
            <circle class="f1" cx="100" cy="108" r="5.5"/>
            <path class="s1" d="M100 112v10" fill="none" stroke-width="4" stroke-linecap="round"/>
          </g>
        </svg></div>
      <div class="sec-side"><ul class="checks">${CHECKS.map(c => `<li class="pass"><span>${c}</span>${CHECK}</li>`).join('')}</ul>
        <div class="sec-meta"><span>AES-256 · TLS 1.3</span><span data-k="key">KEY 7F:3A:9C</span></div></div>
      <div class="segbar" aria-hidden="true">${'<i></i>'.repeat(40)}</div>`;
    const lock = $('.lockwrap', pb), checks = $$('.checks li', pb), segs = $$('.segbar i', pb);
    let busy = false, level = 40, shown = 40, chase = 0, segOn = -1, segHot = -1;
    async function seq(withBreach) {
      if (busy) return; busy = true;
      lock.classList.add('open'); checks.forEach(l => l.classList.remove('pass')); level = 0;
      $('[data-k="key"]', pb).textContent = 'KEY ' + [hexByte(), hexByte(), hexByte()].join(':');
      H.tone(330, .25, 'sawtooth', .015, 2);
      for (let i = 0; i < checks.length; i++) { await sleep(380); checks[i].classList.add('pass'); level = (i + 1) * 8; H.tone(880 + i * 180, .07, 'sine', .03); }
      await sleep(400);
      lock.classList.remove('open');
      if (withBreach) H.showBreach();
      busy = false;
    }
    H.on('breach', () => seq(true));
    lock.addEventListener('click', () => seq(true));
    lock.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seq(true); } });
    setTimeout(() => seq(false), 2600);
    setInterval(() => { if (!document.hidden) seq(false); }, 16000);
    H.tick(dt => {
      shown += (level - shown) * Math.min(1, dt * 8);
      chase = (chase + dt * 18 * M) % 48;
      const on = Math.round(shown), hot = Math.floor(chase);
      if (on !== segOn || hot !== segHot) {
        segOn = on; segHot = hot;
        segs.forEach((s, i) => { s.classList.toggle('on', i < on); s.classList.toggle('hot', i === hot && i < on); });
      }
    });
  }
});

/* ---------- data flow ---------- */
H.def('flow', {
  title: 'Data Flow', group: 'data', mh: 260, cls: 'flow',
  desc: 'ソースからシンクへ、ベジェ曲線の上をパケットが流れる',
  icon: '<path d="M3 6h5c4 0 4 12 8 12h5M3 18h5c4 0 4-12 8-12h5"/>',
  build(pb) {
    const SRC = [16, 58, 100, 142], SNK = [26, 80, 134];
    const LINKS = [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2], [2, 1], [2, 2], [3, 1], [3, 2]];
    let s = '<defs><linearGradient id="flg" x1="64" y1="0" x2="236" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:var(--a2)"/><stop offset="1" style="stop-color:var(--a1)"/></linearGradient></defs>';
    for (const [a, b] of LINKS) {
      const y1 = SRC[a] + 16, y2 = SNK[b] + 16, d = `M64 ${y1}C150 ${y1} 150 ${y2} 236 ${y2}`;
      s += `<path class="fl-base" d="${d}"/><path class="fl-dash" d="${d}" style="animation-duration:${rand(1.4, 2.6).toFixed(2)}s"/>`;
    }
    for (const y of SRC) {
      s += `<rect class="fl-box" x="6" y="${y}" width="58" height="32" rx="3"/>`;
      for (let k = 0; k < 3; k++) s += `<rect class="fbar src" x="11" y="${y + 6 + k * 7.5}" width="48" height="4" rx="1"/>`;
      s += `<circle class="fl-port" cx="64" cy="${y + 16}" r="2.4"/>`;
    }
    for (const y of SNK) {
      s += `<rect class="fl-box" x="236" y="${y}" width="58" height="32" rx="3"/>`;
      for (let k = 0; k < 4; k++) s += `<rect class="fbar snk" x="241" y="${y + 5 + k * 6}" width="48" height="3" rx="1"/>`;
      s += `<circle class="fl-port" cx="236" cy="${y + 16}" r="2.4"/>`;
    }
    pb.innerHTML = `<svg viewBox="0 0 300 190" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${s}<g class="pk"></g></svg><div class="meta-row"><span>THROUGHPUT <b data-k="thru">3.20 GB/s</b></span><span>DROP <b>0.00%</b></span></div>`;
    const svgEl = $('svg', pb), fbars = $$('.fbar', pb);
    H.watch(svgEl);
    const packets = $$('.fl-dash', pb).map(p => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('r', '2.2'); c.setAttribute('class', 'fl-pk'); $('.pk', pb).appendChild(c);
      return { p, c, len: p.getTotalLength(), t: Math.random(), s: rand(.22, .45) };
    });
    let acc = 99;
    H.tick(dt => {
      acc += dt;
      if (acc > 1.5) { acc = 0; fbars.forEach(b => { b.style.transform = `scaleX(${rand(.15, 1).toFixed(2)})`; }); $('[data-k="thru"]', pb).textContent = rand(2.6, 3.9).toFixed(2) + ' GB/s'; }
      if (!H.vis(svgEl)) return;
      for (const k of packets) {
        k.t = (k.t + k.s * dt * M) % 1;
        const pt = k.p.getPointAtLength(k.t * k.len);
        k.c.setAttribute('cx', pt.x.toFixed(1)); k.c.setAttribute('cy', pt.y.toFixed(1));
      }
    });
  }
});
})();
