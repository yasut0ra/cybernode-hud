/* Cybernode HUD panels: data, security and system utilities */
(() => {
'use strict';
const H = HUD;
const { $, $$, rand, ri, pick, clamp, sleep, esc, fmt, p2, hhmm, svg, TAU, M, REDUCED, C, rgba, mix } = H;
const gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += Math.random(); return (s - 2) * 1.7; };

/* ---------- activity heatmap ---------- */
H.def('heatmap', {
  title: 'Activity Heatmap', group: 'data', mh: 260,
  desc: '曜日 × 時間のアクティビティ。マウスを乗せると件数が出る',
  icon: '<rect x="3" y="4" width="5" height="5"/><rect x="10" y="4" width="5" height="5"/><rect x="17" y="4" width="4" height="5"/><rect x="3" y="11" width="5" height="5"/><rect x="10" y="11" width="5" height="5"/><rect x="3" y="18" width="5" height="3"/>',
  build(pb) {
    pb.innerHTML = '<canvas class="fill" role="img" aria-label="Weekly activity heatmap"></canvas>';
    const cvs = H.surface($('canvas', pb));
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const base = (d, hr) => clamp(.12 + .62 * Math.exp(-((hr - 14) ** 2) / 26) * (d < 5 ? 1 : .55) + .18 * Math.exp(-((hr - 21) ** 2) / 6) + rand(-.08, .12), 0, 1);
    const V = DAYS.map((_, d) => Array.from({ length: 24 }, (_, hr) => base(d, hr))), T = V.map(r => r.slice());
    let hover = null, acc = 0, lay = null;
    cvs.cv.addEventListener('pointermove', e => {
      if (!lay) return;
      const r = cvs.cv.getBoundingClientRect(), x = (e.clientX - r.left) * cvs.w / r.width, y = (e.clientY - r.top) * cvs.h / r.height;
      const hr = Math.floor((x - lay.l) / lay.cw), d = Math.floor((y - lay.t) / lay.ch);
      hover = hr >= 0 && hr < 24 && d >= 0 && d < 7 ? [d, hr] : null;
    });
    cvs.cv.addEventListener('pointerleave', () => { hover = null; });
    H.tick((dt, t) => {
      acc += dt;
      if (acc > 1.2) { acc = 0; for (let k = 0; k < 18; k++) { const d = ri(0, 6), hr = ri(0, 23); T[d][hr] = clamp(base(d, hr) + rand(-.15, .25), 0, 1); } }
      for (let d = 0; d < 7; d++) for (let hr = 0; hr < 24; hr++) V[d][hr] += (T[d][hr] - V[d][hr]) * Math.min(1, dt * 1.5);
      if (!H.vis(cvs.cv)) return;
      const { ctx, w, h } = cvs; ctx.clearRect(0, 0, w, h);
      const l = 34, r = 8, tp = 10, b = 20, cw = (w - l - r) / 24, ch = (h - tp - b) / 7, gap = Math.min(2, cw * .15);
      lay = { l, t: tp, cw, ch };
      const now = new Date(), nd = (now.getDay() + 6) % 7, nh = now.getHours();
      for (let d = 0; d < 7; d++) for (let hr = 0; hr < 24; hr++) {
        const v = V[d][hr], col = v < .5 ? mix(C.deep, C.a2, v * 2) : mix(C.a2, C.a1, (v - .5) * 2);
        ctx.fillStyle = rgba(col, .25 + v * .75);
        ctx.fillRect(l + hr * cw + gap / 2, tp + d * ch + gap / 2, cw - gap, ch - gap);
      }
      const pulse = .5 + .5 * Math.sin(t * 3);
      ctx.strokeStyle = rgba(C.a1, .35 + .4 * pulse); ctx.lineWidth = 1;
      ctx.strokeRect(l + nh * cw + .5, tp + .5, cw - 1, ch * 7 - 1);
      ctx.strokeStyle = rgba(C.ink, .9); ctx.lineWidth = 1.5; ctx.strokeRect(l + nh * cw + 1, tp + nd * ch + 1, cw - 2, ch - 2);
      ctx.font = '9px "JetBrains Mono", monospace'; ctx.fillStyle = rgba(C.dim, 1); ctx.textBaseline = 'middle';
      DAYS.forEach((dn, d) => { ctx.fillStyle = rgba(d === nd ? C.a1 : C.dim, 1); ctx.fillText(dn, 6, tp + d * ch + ch / 2); });
      ctx.textAlign = 'center'; ctx.fillStyle = rgba(C.dim, 1);
      for (let hr = 0; hr < 24; hr += 4) ctx.fillText(p2(hr), l + hr * cw + cw / 2, h - b / 2);
      if (hover) {
        const [d, hr] = hover, txt = `${DAYS[d]} ${p2(hr)}:00 · ${fmt(V[d][hr] * 1200)} events`;
        ctx.font = '10px "JetBrains Mono", monospace';
        const tw = ctx.measureText(txt).width + 14, x = clamp(l + hr * cw + cw / 2 - tw / 2, 4, w - tw - 4), y = Math.max(4, tp + d * ch - 24);
        ctx.fillStyle = rgba(C.void, .92); ctx.fillRect(x, y, tw, 20); ctx.strokeStyle = rgba(C.a1, .8); ctx.strokeRect(x + .5, y + .5, tw - 1, 19);
        ctx.fillStyle = rgba(C.ink, 1); ctx.fillText(txt, x + tw / 2, y + 10.5);
        ctx.strokeStyle = rgba(C.ink, 1); ctx.strokeRect(l + hr * cw + .5, tp + d * ch + .5, cw - 1, ch - 1);
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    });
  }
});

/* ---------- anomaly detection ---------- */
H.def('anomaly', {
  title: 'Anomaly Detection', group: 'sec', mh: 260,
  desc: '期待レンジ（±2σ の帯）から外れた点を検知してマークし、異常スコアを出す',
  icon: '<path d="M3 15l4-3 3 2 3-8 3 10 2-4h3"/><circle cx="13" cy="6" r="1.5"/>',
  build(pb) {
    pb.innerHTML = '<canvas class="fill" role="img" aria-label="Anomaly detection chart"></canvas><div class="ov score"><span>ANOMALY SCORE</span><b data-k="s">0.12</b><span class="lvl" data-k="lvl">LOW</span></div>';
    const cvs = H.surface($('canvas', pb)), sEl = $('[data-k="s"]', pb), lEl = $('[data-k="lvl"]', pb);
    const N = 120, SIG = 6, pts = [];
    let T = 0, burst = 0, burstAmp = 0, acc = 0, score = .12;
    const baseAt = x => 50 + 12 * Math.sin(x * .12) + 5 * Math.sin(x * .31);
    const push = () => {
      T++;
      if (!burst && Math.random() < .018) { burst = ri(2, 5); burstAmp = rand(14, 28) * (Math.random() < .7 ? 1 : -1); }
      const b = baseAt(T), extra = burst ? burstAmp * rand(.7, 1.1) : 0; if (burst) burst--;
      pts.push({ v: b + gauss() * 2.2 + extra, b }); if (pts.length > N) pts.shift();
    };
    for (let i = 0; i < N; i++) push();
    H.tick(dt => {
      acc += dt * (M || .3); while (acc > .14) { acc -= .14; push(); }
      const recent = pts.slice(-24).reduce((m, p) => Math.max(m, Math.abs(p.v - p.b) / SIG), 0);
      score += (clamp(recent / 5, .04, .99) - score) * Math.min(1, dt * 2);
      sEl.textContent = score.toFixed(2);
      const lvl = score < .4 ? ['LOW', 'var(--ok)'] : score < .7 ? ['MEDIUM', 'var(--warn)'] : ['HIGH', 'var(--crit)'];
      if (lEl.textContent !== lvl[0]) { lEl.textContent = lvl[0]; lEl.style.setProperty('--sc', lvl[1]); }
      if (!H.vis(cvs.cv)) return;
      const { ctx, w, h } = cvs; ctx.clearRect(0, 0, w, h);
      const tp = 46, bt = h - 12, X = i => 8 + i / (N - 1) * (w - 16), Y = v => bt - (v - 10) / 90 * (bt - tp);
      ctx.lineWidth = 1; ctx.strokeStyle = rgba(C.a1, .07);
      for (let i = 0; i <= 4; i++) { const y = Math.round(tp + (bt - tp) * i / 4) + .5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.beginPath();
      pts.forEach((p, i) => { const y = Y(p.b + 2 * SIG); i ? ctx.lineTo(X(i), y) : ctx.moveTo(X(i), y); });
      for (let i = N - 1; i >= 0; i--) ctx.lineTo(X(i), Y(pts[i].b - 2 * SIG));
      ctx.closePath(); ctx.fillStyle = rgba(C.a1, .08); ctx.fill();
      ctx.setLineDash([3, 4]); ctx.strokeStyle = rgba(C.a1, .3);
      [2, -2].forEach(k => { ctx.beginPath(); pts.forEach((p, i) => { const y = Y(p.b + k * SIG); i ? ctx.lineTo(X(i), y) : ctx.moveTo(X(i), y); }); ctx.stroke(); });
      ctx.setLineDash([]);
      const line = new Path2D(); pts.forEach((p, i) => i ? line.lineTo(X(i), Y(p.v)) : line.moveTo(X(i), Y(p.v)));
      const f = new Path2D(line); f.lineTo(X(N - 1), bt); f.lineTo(X(0), bt); f.closePath();
      const g = ctx.createLinearGradient(0, tp, 0, bt); g.addColorStop(0, rgba(C.a2, .35)); g.addColorStop(1, rgba(C.a2, 0));
      ctx.fillStyle = g; ctx.fill(f);
      ctx.strokeStyle = rgba(C.a2, .25); ctx.lineWidth = 3; ctx.stroke(line);
      ctx.strokeStyle = rgba(mix(C.a2, C.ink, .3), 1); ctx.lineWidth = 1.2; ctx.stroke(line);
      ctx.font = '9px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      let lastLabel = -99;
      pts.forEach((p, i) => {
        const z = (p.v - p.b) / SIG; if (Math.abs(z) <= 2) return;
        const x = X(i), y = Y(p.v);
        ctx.strokeStyle = rgba(C.crit, .35); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, tp - 4); ctx.lineTo(x, bt); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = rgba(C.crit, .25); ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(C.crit, 1); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.stroke(); ctx.lineWidth = 1;
        if (i - lastLabel > 10) { lastLabel = i; ctx.fillStyle = rgba(C.crit, 1); ctx.fillText(`${z > 0 ? '+' : ''}${z.toFixed(1)}σ`, x, tp - 8); }
      });
      ctx.textAlign = 'left'; ctx.fillStyle = rgba(C.dim, 1); ctx.fillText('req/s · window 120', 10, 16);
    });
  }
});

/* ---------- widgets ---------- */
const WI = {
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18z"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 6.5 4.25 4.25 0 0 0 7 15z"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  drops: '<path d="M8 3v6M12 7v8M16 3v5M8 13v8M16 12v9"/>',
  zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.8 2.6 14.2 0 17M12 3.5c-2.6 2.8-2.6 14.2 0 17"/>'
};
H.def('widgets', {
  title: 'Widgets', group: 'sys', mh: 380,
  desc: '時計・天気・ウォッチリスト・メモ・クイックアクションをまとめた小物パネル',
  icon: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="18" height="8" rx="1.5"/>',
  build(pb) {
    const W = [['SYS', 'var(--a1)'], ['NET', 'var(--a2)'], ['DB', 'var(--a3)']];
    pb.innerHTML = `<div class="wg" style="height:100%">
      <div class="tile w-clock"><h4>CLOCK · JST</h4><b data-k="t">00:00</b><span data-k="d"></span></div>
      <div class="tile w-weather"><h4>WEATHER · TOKYO</h4><div><span data-k="ic">${svg(WI.cloud, '')}</span><b data-k="temp">18°C</b></div><span data-k="cond">Cloudy · 64%</span></div>
      <div class="tile w-watch"><h4>WATCHLIST</h4><ul>${W.map(([k, c]) => `<li data-w="${k}" style="--lc:${c}"><span>${k}</span><svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><polyline points=""/></svg><span class="chg">+0.0%</span></li>`).join('')}</ul></div>
      <div class="tile w-notes"><h4>NOTES</h4>${['Rotate relay keys', 'Review PR #42', 'Feed the cat'].map((n, i) => `<button aria-pressed="${i === 1}">${n}</button>`).join('')}</div>
      <div class="tile w-act"><h4>QUICK ACTIONS</h4><div>
        <button class="icb" data-q="breach" title="Access sequence" aria-label="アクセスシーケンス">${svg(WI.lock)}</button>
        <button class="icb" data-q="rain" title="Code rain" aria-label="コードレイン切替">${svg(WI.drops)}</button>
        <button class="icb" data-q="glitch" title="Glitch" aria-label="グリッチ">${svg(WI.zap)}</button>
        <button class="icb" data-q="trace" title="Trace" aria-label="回線をトレース">${svg(WI.globe)}</button></div></div>
    </div>`;
    const series = W.map(() => Array.from({ length: 30 }, () => 50 + rand(-8, 8)));
    const draw = () => W.forEach(([k], i) => {
      const s = series[i], li = $(`[data-w="${k}"]`, pb), mn = Math.min(...s), mxv = Math.max(...s), rg = mxv - mn || 1;
      $('polyline', li).setAttribute('points', s.map((v, j) => `${(j / (s.length - 1) * 100).toFixed(1)},${(18 - (v - mn) / rg * 16).toFixed(1)}`).join(' '));
      const chg = (s[s.length - 1] - s[0]) / s[0] * 100, el = $('.chg', li);
      el.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(1) + '%'; el.className = 'chg ' + (chg >= 0 ? 'good' : 'bad');
    });
    const tickClock = () => { const d = new Date(); $('[data-k="t"]', pb).textContent = hhmm(d); $('[data-k="d"]', pb).textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
    let temp = 18;
    const COND = [['Cloudy', WI.cloud], ['Light rain', WI.rain], ['Clear', WI.sun], ['Fog', WI.cloud]];
    draw(); tickClock();
    setInterval(tickClock, 1000);
    setInterval(() => { series.forEach(s => { s.shift(); s.push(clamp(s[s.length - 1] + rand(-5, 5.4), 20, 90)); }); draw(); }, 1500);
    setInterval(() => {
      temp = clamp(temp + rand(-.6, .6), 12, 24); $('[data-k="temp"]', pb).textContent = Math.round(temp) + '°C';
      if (Math.random() < .25) { const [c, ic] = pick(COND); $('[data-k="ic"]', pb).innerHTML = svg(ic, ''); $('[data-k="cond"]', pb).textContent = `${c} · ${ri(48, 82)}%`; }
    }, 6000);
    pb.addEventListener('click', e => {
      const n = e.target.closest('.w-notes button'); if (n) { n.setAttribute('aria-pressed', String(n.getAttribute('aria-pressed') !== 'true')); H.tone(900, .03, 'square', .015); return; }
      const q = e.target.closest('[data-q]'); if (!q) return;
      ({ breach: () => H.runBreach(), rain: () => H.toggleFx('rain'), glitch: () => H.glitch(700), trace: () => H.emit('trace', pick(H.CITIES.slice(1)).id) })[q.dataset.q]();
    });
  }
});

/* ---------- authentication (display only) ---------- */
H.def('auth', {
  title: 'Authentication', group: 'sec', mh: 340, cls: 'au',
  desc: 'ログイン → 二段階認証 → ACCESS GRANTED を自動で演じる認証画面（入力欄は演出だけ）',
  icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  build(pb) {
    pb.innerHTML = `<div class="au-card" role="button" tabindex="0" aria-label="認証シーケンスをもう一度再生">
        <div class="au-h">${svg(WI.lock, '')}<b>Project Nexus</b><span>SECURE GATEWAY · NODE TYO-07</span></div>
        <div class="au-f" data-f="u">${svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>', '')}<span class="v"></span></div>
        <div class="au-f" data-f="p">${svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>', '')}<span class="v"></span></div>
        <div class="au-otp" aria-hidden="true">${'<i></i>'.repeat(6)}</div>
        <div class="au-btn">SIGN IN</div>
        <div class="au-status">AWAITING OPERATOR</div>
      </div>`;
    const card = $('.au-card', pb), fu = $('[data-f="u"]', pb), fp = $('[data-f="p"]', pb), otp = $$('.au-otp i', pb), btn = $('.au-btn', pb), st = $('.au-status', pb);
    let run = 0;
    const setF = (f, txt, ph, focus) => { $('.v', f).innerHTML = txt ? esc(txt) + (focus ? '<i class="cur"></i>' : '') : `<span class="ph-t">${ph}</span>${focus ? '<i class="cur"></i>' : ''}`; f.classList.toggle('focus', !!focus); };
    const status = (t, cls = '') => { st.textContent = t; st.className = 'au-status ' + cls; };
    async function play() {
      const id = ++run, alive = () => id === run, w = ms => sleep(REDUCED ? 0 : ms);
      setF(fu, '', 'Username'); setF(fp, '', 'Password'); otp.forEach(i => { i.textContent = ''; i.classList.remove('on'); });
      btn.className = 'au-btn'; btn.textContent = 'SIGN IN'; status('AWAITING OPERATOR');
      await w(1200); if (!alive()) return;
      const user = pick(['operator', 'ghost', 'nyx', 'root', 'kurogane']);
      for (let i = 1; i <= user.length; i++) { setF(fu, user.slice(0, i), '', true); H.tone(2000, .012, 'square', .01); await w(rand(70, 140)); if (!alive()) return; }
      setF(fu, user); await w(300);
      const pl = ri(8, 12);
      for (let i = 1; i <= pl; i++) { setF(fp, '•'.repeat(i), '', true); await w(rand(60, 110)); if (!alive()) return; }
      setF(fp, '•'.repeat(pl)); await w(400);
      btn.className = 'au-btn busy'; btn.textContent = 'VERIFYING';
      for (let i = 0; i < 3; i++) { status('CHECKING CREDENTIALS' + '.'.repeat(i + 1)); await w(380); if (!alive()) return; }
      let tries = Math.random() < .25 ? 2 : 1;
      while (tries--) {
        status('ENTER 6-DIGIT CODE');
        otp.forEach(i => { i.textContent = ''; i.classList.remove('on'); });
        for (const i of otp) { await w(rand(120, 220)); if (!alive()) return; i.textContent = ri(0, 9); i.classList.add('on'); H.tone(1500, .02, 'square', .012); }
        await w(500); if (!alive()) return;
        if (tries) { status('INVALID CODE · RETRY', 'err'); H.tone(200, .15, 'sawtooth', .02); await w(900); if (!alive()) return; }
      }
      btn.className = 'au-btn okay'; btn.textContent = 'ACCESS GRANTED';
      status('SESSION 0x2A · CLEARANCE LEVEL 4', 'ok');
      H.tone(660, .1, 'sine', .03); H.tone(990, .16, 'sine', .03, 0, .1);
      await w(4200); if (alive()) play();
    }
    card.addEventListener('click', play);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
    play();
  }
});

/* ---------- settings ---------- */
H.def('settings', {
  title: 'Settings', group: 'sys', mh: 400, cls: 'sg',
  desc: 'アクセント色とエフェクトの設定。画面下のバーと同じもので、全ページで共有される',
  icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  build(pb) {
    const LBL = { scan: ['Scanlines', '画面の走査線'], parallax: ['Parallax', 'マウスに合わせて壁が傾く'], rain: ['Code rain', '背景にコードレイン'], blur: ['Window blur', 'ガラスのぼかし。切ると軽くなる'], sfx: ['Sound effects', 'タイプ音やアラート音'] };
    const row = k => `<div class="sg-row"><span>${LBL[k][0]}<small>${LBL[k][1]}</small></span><button class="switch" role="switch" data-k="${k}" aria-checked="${H.settings[k]}" aria-label="${LBL[k][0]}"></button></div>`;
    pb.innerHTML = `<h3>APPEARANCE</h3>
      <div class="sg-row"><span>Accent<small>テーマカラー</small></span><div class="sg-sw">${Object.entries(H.ACCENTS).map(([k, c]) => `<button class="sw-btn" data-accent="${k}" style="--c1:${c[0]};--c2:${c[1]}" aria-label="${k}" aria-pressed="${k === H.settings.accent}"></button>`).join('')}</div></div>
      <h3>EFFECTS</h3>${['scan', 'parallax', 'rain', 'blur'].map(row).join('')}
      <h3>AUDIO</h3>${row('sfx')}
      <h3>SYSTEM</h3>
      <div class="sg-row"><span>Build<small>Cybernode HUD</small></span><span class="mono" style="color:var(--dim)">4.3.0</span></div>
      <div class="sg-row"><span>Reset<small>設定を初期値に戻す</small></span><button class="btn" data-a="reset">RESET</button></div>`;
    pb.addEventListener('click', e => {
      const s = e.target.closest('.switch'); if (s) { H.toggleFx(s.dataset.k); return; }
      const a = e.target.closest('.sw-btn'); if (a) { H.setAccent(a.dataset.accent); H.glitch(180); return; }
      if (e.target.closest('[data-a="reset"]')) { H.setAccent('neon'); H.setFx('scan', true); H.setFx('parallax', true); H.setFx('rain', false); H.setFx('blur', true); H.setFx('sfx', false); }
    });
    H.on('settings', () => $$('.switch', pb).forEach(s => s.setAttribute('aria-checked', String(H.settings[s.dataset.k]))));
  }
});
})();
