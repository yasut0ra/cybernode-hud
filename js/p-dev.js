/* Cybernode HUD panels: development workspace */
(() => {
'use strict';
const H = HUD;
const { $, $$, rand, ri, pick, clamp, sleep, esc, fmt, hhmm, svg, TAU, M, REDUCED, C, rgba, mix } = H;
const IC = {
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  back: '<path d="M15 6l-6 6 6 6"/>', fwd: '<path d="M9 6l6 6-6 6"/>', up: '<path d="M6 15l6-6 6 6"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  play: '<path d="M7 5l12 7-12 7z"/>'
};

/* ---------- file explorer ---------- */
H.def('files', {
  title: 'File Explorer', group: 'dev', mh: 300, cls: 'fe',
  desc: 'フォルダをたどってファイルを選ぶ。.py / .rs / .yaml はエディタで開ける',
  icon: IC.folder,
  build(pb) {
    const FS = {
      '': [['README.md', '6.2 KB'], ['requirements.txt', '1.4 KB'], ['LICENSE', '1.1 KB']],
      core: [['project_main.py', '4.2 KB'], ['uplink.rs', '2.8 KB'], ['config.yaml', '0.6 KB'], ['__init__.py', '0.1 KB']],
      modules: [['scanner.py', '6.1 KB'], ['relay.py', '3.4 KB'], ['cloak.py', '2.2 KB'], ['mesh.go', '8.9 KB']],
      data: [['nodes.csv', '1.2 MB'], ['regions.json', '48 KB'], ['events.parquet', '212 MB']],
      assets: [['logo.svg', '3.1 KB'], ['hud.css', '24 KB'], ['glyphs.woff2', '86 KB']],
      docs: [['ARCHITECTURE.md', '11 KB'], ['RUNBOOK.md', '7.4 KB'], ['threat-model.pdf', '1.8 MB']],
      utils: [['ghost.py', '2.9 KB'], ['link.py', '3.7 KB'], ['timing.py', '1.1 KB']]
    };
    const DIRS = Object.keys(FS).filter(Boolean);
    pb.innerHTML = `<div class="fe-bar"><div class="fe-nav">
        <button class="icb" data-a="back" aria-label="戻る">${svg(IC.back)}</button><button class="icb" data-a="fwd" aria-label="進む">${svg(IC.fwd)}</button><button class="icb" data-a="up" aria-label="上の階層へ">${svg(IC.up)}</button></div>
        <div class="fe-path">${svg(IC.search)}<span></span></div><span class="fe-sync">SYNCED</span></div>
      <div class="fe-body"><div class="fe-tree"></div><div class="fe-list"></div></div>
      <div class="fe-foot"><span data-k="count"></span><span data-k="sel"></span></div>`;
    const tree = $('.fe-tree', pb), list = $('.fe-list', pb), path = $('.fe-path span', pb), syncEl = $('.fe-sync', pb);
    const hist = [''];
    let hi = 0, cur = '', sel = '', idle = 0;
    const openable = n => (H.FILES || []).includes(n);
    function render() {
      path.textContent = '/workspace/project' + (cur ? '/' + cur : '');
      tree.innerHTML = `<button class="fe-row${cur === '' ? ' sel' : ''}" data-d="">${svg(IC.folder, 'dir-ic')}<span class="nm">project</span></button>` +
        DIRS.map(d => `<button class="fe-row${cur === d ? ' sel' : ''}" data-d="${d}" style="padding-left:24px">${svg(IC.folder, 'dir-ic')}<span class="nm">${d}/</span></button>`).join('');
      const items = (cur ? [] : DIRS.map(d => [d + '/', '', true])).concat(FS[cur].map(([n, s]) => [n, s, false]));
      list.innerHTML = items.map(([n, s, dir]) => `<button class="fe-row${sel === n ? ' sel' : ''}${!dir && openable(n) ? ' open-able' : ''}" ${dir ? `data-d="${n.slice(0, -1)}"` : `data-f="${esc(n)}"`}>${svg(dir ? IC.folder : IC.file, dir ? 'dir-ic' : '')}<span class="nm">${esc(n)}</span><span class="sz">${s}</span></button>`).join('');
      $('[data-k="count"]', pb).textContent = `${items.length} items`;
      $('[data-a="back"]', pb).disabled = hi === 0; $('[data-a="fwd"]', pb).disabled = hi >= hist.length - 1; $('[data-a="up"]', pb).disabled = cur === '';
    }
    const status = t => { $('[data-k="sel"]', pb).textContent = t; };
    function go(d, push = true) { if (push) { hist.splice(hi + 1); hist.push(d); hi = hist.length - 1; } cur = d; sel = ''; status(''); render(); H.tone(900, .03, 'square', .015); }
    function open(n) {
      if (!openable(n)) { status('プレビュー非対応'); return; }
      if (H.has('open-file')) { H.emit('open-file', n); status('→ Editor'); }
      else status('エディタは DEV ビューで開けます');
    }
    pb.addEventListener('click', e => {
      idle = 0;
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'back' && hi > 0) { hi--; go(hist[hi], false); }
      else if (b.dataset.a === 'fwd' && hi < hist.length - 1) { hi++; go(hist[hi], false); }
      else if (b.dataset.a === 'up') go('');
      else if (b.dataset.d !== undefined) go(b.dataset.d);
      else if (b.dataset.f) {
        if (sel === b.dataset.f) open(sel);
        else { sel = b.dataset.f; render(); status(openable(sel) ? `${sel} · もう一度クリックで開く` : sel); }
      }
    });
    render();
    setInterval(() => {
      syncEl.textContent = 'SYNCING…'; syncEl.classList.add('busy');
      setTimeout(() => { syncEl.textContent = 'SYNCED'; syncEl.classList.remove('busy'); }, 1400);
    }, 9000);
    H.tick(dt => {
      idle += dt * M;
      if (idle < 7) return;
      idle = 0;
      if (Math.random() < .5 || !FS[cur].length) go(pick(DIRS));
      else { sel = pick(FS[cur])[0]; render(); status(sel); }
    });
  }
});

/* ---------- command palette ---------- */
H.def('palette', {
  title: 'Command Palette', group: 'dev', mh: 320, cls: 'cp',
  desc: '⌘K / Ctrl+K で呼び出すコマンドパレット。ビュー移動・テーマ変更・演出が本当に実行できる',
  icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6"/>',
  build(pb) {
    const A = [
      ['Run access sequence', 'ACTION', () => H.runBreach()],
      ['Trace route → London', 'ACTION', () => H.emit('trace', 'LON')],
      ['Trace route → New York', 'ACTION', () => H.emit('trace', 'NYC')],
      ['Trace route → Sydney', 'ACTION', () => H.emit('trace', 'SYD')],
      ['Rescan target', 'ACTION', () => H.emit('scan')],
      ['Clear terminal', 'ACTION', () => H.emit('clear-terminal')],
      ['Glitch screen', 'FX', () => H.glitch(700)],
      ['Toggle code rain', 'FX', () => H.toggleFx('rain')],
      ['Toggle scanlines', 'FX', () => H.toggleFx('scan')],
      ['Toggle window blur', 'FX', () => H.toggleFx('blur')],
      ['Toggle sound effects', 'FX', () => H.toggleFx('sfx')],
      ...Object.keys(H.ACCENTS).map(k => [`Theme: ${k[0].toUpperCase() + k.slice(1)}`, 'THEME', () => H.setAccent(k)]),
      ...Object.entries(H.VIEWS).map(([k, v]) => [`Open view: ${v.title}`, 'VIEW', () => H.go(k)]),
      ['Open hub', 'VIEW', () => H.go('hub')]
    ];
    pb.innerHTML = `<label class="cp-in">${svg(IC.search)}<input type="text" placeholder="Type a command, view or theme…" aria-label="コマンドを検索" autocomplete="off" spellcheck="false"><kbd>⌘K</kbd></label>
      <ul class="cp-list" role="listbox" aria-label="Commands"></ul><div class="cp-foot"><span>↑↓ 選択 · Enter 実行 · Esc 閉じる</span><span data-k="n"></span></div>`;
    const input = $('input', pb), list = $('.cp-list', pb);
    let shown = [], idx = 0, demo = 0, idle = 0;
    function match(label, q) {
      if (!q) return { s: 0, at: [] };
      const L = label.toLowerCase(), at = []; let j = 0, s = 0, run = 0;
      for (let i = 0; i < L.length && j < q.length; i++) if (L[i] === q[j]) { at.push(i); run = at.length > 1 && at[at.length - 2] === i - 1 ? run + 1 : 0; s += 1 + run * 2 - i * .01; j++; }
      return j === q.length ? { s, at } : null;
    }
    function render() {
      const q = input.value.trim().toLowerCase();
      shown = A.map((a, i) => ({ a, i, m: match(a[0], q) })).filter(x => x.m).sort((x, y) => y.m.s - x.m.s || x.i - y.i);
      idx = clamp(idx, 0, Math.max(0, shown.length - 1));
      list.innerHTML = shown.length ? shown.map(({ a, m }, k) => {
        const lab = [...a[0]].map((ch, i) => m.at.includes(i) ? `<mark>${esc(ch)}</mark>` : esc(ch)).join('');
        return `<li class="cp-item${k === idx ? ' on' : ''}" role="option" aria-selected="${k === idx}" data-k="${k}">${svg(IC.play)}<span>${lab}</span><span class="tag">${a[1]}</span></li>`;
      }).join('') : '<li class="cp-empty">一致するコマンドがありません</li>';
      $('[data-k="n"]', pb).textContent = `${shown.length} / ${A.length}`;
      const on = $('.cp-item.on', list); if (on) on.scrollIntoView({ block: 'nearest' });
    }
    const fire = (k, exec) => {
      const li = $(`.cp-item[data-k="${k}"]`, list); if (!li || !shown[k]) return;
      li.classList.remove('fire'); void li.offsetWidth; li.classList.add('fire');
      H.tone(1400, .05, 'square', .02);
      if (exec) { const run = shown[k].a[2]; setTimeout(() => { run(); input.value = ''; idx = 0; render(); }, 140); }
    };
    input.addEventListener('input', () => { idx = 0; render(); });
    input.addEventListener('focus', () => { demo++; idle = 0; if (input.dataset.demo) { input.value = ''; delete input.dataset.demo; render(); } });
    input.addEventListener('keydown', e => {
      idle = 0;
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, shown.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); fire(idx, true); }
      else if (e.key === 'Escape') { input.value = ''; idx = 0; render(); input.blur(); }
    });
    list.addEventListener('mousemove', e => { const li = e.target.closest('.cp-item'); if (li && +li.dataset.k !== idx) { idx = +li.dataset.k; $$('.cp-item', list).forEach(x => { x.classList.toggle('on', x === li); x.setAttribute('aria-selected', String(x === li)); }); } });
    list.addEventListener('click', e => { const li = e.target.closest('.cp-item'); if (li) { idx = +li.dataset.k; fire(idx, true); } });
    document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); H.focusPanel('palette'); } });
    async function runDemo() {
      const id = ++demo, q = pick(['thm', 'trace', 'rain', 'open dev', 'scan', 'glitch', 'blur']);
      input.dataset.demo = '1'; input.value = ''; idx = 0; render();
      for (const ch of q) { await sleep(150); if (id !== demo) return; input.value += ch; render(); }
      for (let i = 0; i < ri(0, 2); i++) { await sleep(500); if (id !== demo) return; idx = Math.min(idx + 1, shown.length - 1); render(); }
      await sleep(700); if (id !== demo) return; fire(idx, false);
      await sleep(1400); if (id !== demo) return;
      input.value = ''; delete input.dataset.demo; idx = 0; render();
    }
    render();
    H.tick(dt => {
      if (document.activeElement === input) return;
      idle += dt * M;
      if (idle > 7) { idle = 0; runDemo(); }
    });
  }
});

/* ---------- kanban ---------- */
H.def('kanban', {
  title: 'Project Tasks', group: 'dev', mh: 300, cls: 'kb',
  desc: 'カンバン。カードが自動で右の列へ進んでいく。ドラッグで動かすこともできる',
  icon: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>',
  build(pb) {
    const COLS = [['todo', 'To Do', 'var(--a2)', 15], ['prog', 'In Progress', 'var(--a1)', 4], ['rev', 'Review', 'var(--warn)', 2], ['done', 'Done', 'var(--ok)', 24]];
    const POOL = ['Design UI v2', 'Build module', 'Write docs', 'API integration', 'Data pipeline', 'QA testing', 'UX polish', 'Release v1.4', 'Deploy relay', 'Refactor mesh', 'Rotate keys', 'Fix latency bug', 'Audit logs', 'Tune anomaly model', 'Cache warmup', 'Ship hotfix', 'Pen-test report', 'Migrate DB'];
    pb.innerHTML = COLS.map(([k, l, c]) => `<div class="kb-col" data-col="${k}" style="--kc:${c}"><div class="kb-h"><span>${l}</span><b>0</b></div><div class="kb-list"></div></div>`).join('');
    const lists = {}, base = {};
    COLS.forEach(([k, , , b]) => { lists[k] = $(`[data-col="${k}"] .kb-list`, pb); base[k] = b; });
    let q = POOL.slice().sort(() => Math.random() - .5), drag = null;
    const live = k => $$('.kb-card:not(.gone)', lists[k]);
    const counts = () => COLS.forEach(([k]) => { $(`[data-col="${k}"] .kb-h b`, pb).textContent = base[k] + live(k).length; });
    function card(t, fresh) {
      const c = document.createElement('div'); c.className = 'kb-card' + (fresh ? ' new' : ''); c.draggable = true;
      c.innerHTML = `<span>${esc(t)}</span>`;
      c.addEventListener('dragstart', e => { drag = c; c.classList.add('drag'); try { e.dataTransfer.setData('text/plain', t); } catch (err) {} });
      c.addEventListener('dragend', () => { c.classList.remove('drag'); drag = null; $$('.kb-col', pb).forEach(x => x.classList.remove('over')); });
      return c;
    }
    const next = () => { if (!q.length) q = POOL.slice().sort(() => Math.random() - .5); return q.pop(); };
    [['todo', 3], ['prog', 2], ['rev', 2], ['done', 2]].forEach(([k, n]) => { for (let i = 0; i < n; i++) lists[k].appendChild(card(next())); });
    counts();
    $$('.kb-col', pb).forEach(col => {
      col.addEventListener('dragover', e => { if (drag) { e.preventDefault(); col.classList.add('over'); } });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('over'); if (drag) { lists[col.dataset.col].prepend(drag); counts(); } });
    });
    function move(c, to) {
      const r0 = c.getBoundingClientRect();
      lists[to].prepend(c);
      const r1 = c.getBoundingClientRect();
      if (!REDUCED && c.animate) c.animate([{ transform: `translate(${r0.left - r1.left}px,${r0.top - r1.top}px)` }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    const ORDER = ['todo', 'prog', 'rev', 'done'];
    const step = () => {
      if (!drag && !document.hidden) {
        const from = pick(['todo', 'prog', 'prog', 'rev', 'rev']), cs = live(from);
        if (cs.length) {
          const c = cs[cs.length - 1], to = ORDER[ORDER.indexOf(from) + 1];
          move(c, to);
          if (to === 'done') {
            H.tone(1320, .06, 'sine', .02);
            const d = live('done');
            if (d.length > 3) { const old = d[d.length - 1]; base.done++; old.classList.add('gone'); setTimeout(() => old.remove(), 420); }
          }
          if (live('todo').length < 2) { lists.todo.appendChild(card(next(), true)); base.todo = Math.max(0, base.todo - 1); }
          counts();
        }
      }
      setTimeout(step, rand(2200, 3800));
    };
    setTimeout(step, 2000);
  }
});

/* ---------- comms ---------- */
H.def('chat', {
  title: 'Comms', group: 'dev', mh: 340, cls: 'ch',
  desc: 'チームチャット。ボットが勝手に喋り、話しかけると返事をする（breach や trace にも反応）',
  icon: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  build(pb) {
    const U = { orion: ['Orion', 'var(--a1)'], nova: ['Nova', 'var(--a3)'], echo: ['Echo', 'var(--ok)'], you: ['you', 'var(--warn)'] };
    const L = {
      general: ['Build completed successfully.', 'Can you review the latest changes?', 'Looks good! Ready for staging.', 'コーヒー切れた。誰か補充して', '猫がまたキーボードの上で寝てる', 'deploy は 15 分後でいい？', 'ミーティング 5 分押し'],
      ops: ['Latency spike on AP-South, investigating.', 'Worker 429 restarted, healthy now.', 'Disk on N-106 at 81%.', 'Failover drill complete. RTO 42s.', 'Heartbeat OK across 128 regions.', 'Relay TYO→FRA packet loss back under 0.1%.'],
      updates: ['v1.5.0 build is out.', 'Changelog: new anomaly model (0.87 F1).', 'Security patch applied to relay mesh.', 'Key rotation finished for all regions.', 'Docs: RUNBOOK.md updated.']
    };
    const CH = Object.keys(L), logs = {}, unread = {};
    CH.forEach(c => { logs[c] = []; unread[c] = 0; });
    pb.innerHTML = `<div class="ch-tabs" role="tablist">${CH.map((c, i) => `<button class="ch-tab${i ? '' : ' on'}" role="tab" data-c="${c}"># ${c}<b hidden>0</b></button>`).join('')}</div>
      <div class="ch-log" aria-live="polite"></div><div class="typing" hidden><i></i><i></i><i></i><span></span></div>
      <form class="ch-in"><input type="text" placeholder="Type a message…" aria-label="メッセージ" autocomplete="off"><button class="icb" aria-label="送信">${svg('<path d="M4 12l16-8-6 16-2-6z"/>')}</button></form>`;
    const logEl = $('.ch-log', pb), typing = $('.typing', pb), input = $('input', pb);
    let cur = 'general';
    const node = m => {
      const [name, col] = U[m.who], d = document.createElement('div');
      d.className = 'msg' + (m.who === 'you' ? ' me' : ''); d.style.setProperty('--uc', col);
      d.innerHTML = `<span class="av">${name[0].toUpperCase()}</span><div><div class="msg-h">${name}<time>${m.at}</time></div><div class="msg-b">${esc(m.text)}</div></div>`;
      return d;
    };
    const show = () => { logEl.innerHTML = ''; logs[cur].forEach(m => logEl.appendChild(node(m))); logEl.scrollTop = logEl.scrollHeight; };
    const badge = c => { const b = $(`[data-c="${c}"] b`, pb); b.textContent = unread[c]; b.hidden = !unread[c]; };
    function post(c, who, text, at = hhmm()) {
      const m = { who, text, at }; logs[c].push(m); if (logs[c].length > 60) logs[c].shift();
      if (c === cur) { logEl.appendChild(node(m)); while (logEl.children.length > 60) logEl.firstChild.remove(); logEl.scrollTop = logEl.scrollHeight; }
      else { unread[c]++; badge(c); }
      if (who !== 'you') H.tone(c === cur ? 1046 : 784, .05, 'sine', .015);
    }
    async function say(c, who, text, after) {
      if (c === cur) { typing.hidden = false; $('span', typing).textContent = `${U[who][0]} is typing`; }
      await sleep(rand(900, 1800));
      typing.hidden = true; post(c, who, text); if (after) after();
    }
    const now = Date.now(), ago = m => hhmm(new Date(now - m * 60000));
    post('general', 'orion', L.general[0], ago(9)); post('general', 'nova', L.general[1], ago(5)); post('general', 'echo', L.general[2], ago(2));
    post('ops', 'orion', L.ops[4], ago(14)); post('updates', 'echo', L.updates[0], ago(30));
    unread.ops = 1; unread.updates = 1; CH.forEach(badge);
    $('.ch-tabs', pb).addEventListener('click', e => {
      const b = e.target.closest('.ch-tab'); if (!b) return;
      cur = b.dataset.c; unread[cur] = 0; badge(cur);
      $$('.ch-tab', pb).forEach(t => t.classList.toggle('on', t === b)); typing.hidden = true; show();
    });
    function reply(text) {
      const s = text.toLowerCase();
      if (/breach|hack|ハック|侵入|突破/.test(s)) return ['nova', 'シーケンス開始。3、2、1…', () => H.runBreach()];
      if (/trace|london|ロンドン|ルート/.test(s)) return ['orion', 'TYO → LON にルートを張るね', () => H.emit('trace', 'LON')];
      if (/rain|matrix|雨|レイン/.test(s)) return ['echo', 'コードレイン、オンにしといた', () => H.setFx('rain', true)];
      if (/theme|テーマ|色/.test(s)) return ['orion', '色なら下のバーか、ターミナルで theme amber みたいに変えられるよ'];
      if (/help|使い方|ヘルプ|どうやって/.test(s)) return ['orion', 'ターミナルで help、⌘K でコマンドパレット。パネル右上の ↗ で単体表示'];
      if (/猫|ねこ|cat/.test(s)) return ['echo', 'キーボードの横で寝てる。起こさないであげて'];
      if (/glitch|グリッチ|バグ/.test(s)) return ['nova', 'ちょっと揺らすね', () => H.glitch(600)];
      return [pick(['orion', 'nova', 'echo']), pick(['了解', '見とく', 'ログ確認中…', 'それは仕様です', 'あとでペアプロしよう', 'ok, merging.', 'いいね、それでいこう'])];
    }
    $('form', pb).addEventListener('submit', e => {
      e.preventDefault();
      const v = input.value.trim(); if (!v) return;
      input.value = ''; post(cur, 'you', v);
      const [who, text, after] = reply(v); say(cur, who, text, after);
    });
    const chatter = () => {
      if (!document.hidden) { const c = Math.random() < .55 ? cur : pick(CH); say(c, pick(['orion', 'nova', 'echo']), pick(L[c])); }
      setTimeout(chatter, rand(6000, 12000));
    };
    setTimeout(chatter, 4000);
  }
});

/* ---------- node graph ---------- */
H.def('graph', {
  title: 'Node Graph', group: 'data', mh: 280,
  desc: 'Ingest → Transform / Enrich / Predict → Analyze → Store / Alert を流れるパイプライン',
  icon: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.5 12c5 0 5-6 9-6M7.5 12c5 0 5 6 9 6"/>',
  build(pb) {
    pb.innerHTML = '<canvas class="fill" role="img" aria-label="Data pipeline node graph"></canvas><div class="ov" style="top:8px;right:12px">EVENTS/s <b data-k="eps">0</b></div>';
    const cvs = H.surface($('canvas', pb));
    const N = [['Ingest', 0, .5, 'a1'], ['Transform', .35, .17, 'a1'], ['Enrich', .35, .5, 'a1'], ['Predict', .35, .83, 'a2'], ['Analyze', .66, .42, 'a1'], ['Store', 1, .24, 'ok'], ['Alert', 1, .74, 'a3']]
      .map(([name, x, y, c]) => ({ name, x, y, c, flash: 0, n: ri(1200, 9000) }));
    const E = [[0, 1], [0, 2], [0, 3], [1, 4], [2, 4], [3, 4], [3, 6], [4, 5], [4, 6]];
    const out = i => E.map((e, k) => e[0] === i ? k : -1).filter(k => k >= 0);
    const pk = []; let spawn = 0, eps = 0, epsAcc = 0;
    H.tick(dt => {
      spawn += dt * M;
      if (spawn > .22) { spawn = 0; pk.push({ e: pick(out(0)), t: 0, s: rand(.45, .8) }); }
      for (let i = pk.length - 1; i >= 0; i--) {
        const p = pk[i]; p.t += p.s * dt;
        if (p.t >= 1) {
          const to = E[p.e][1], nd = N[to]; nd.flash = 1; nd.n++; eps++; pk.splice(i, 1);
          const o = out(to).filter(k => E[k][1] !== 6 || Math.random() < .18);
          if (o.length) pk.push({ e: pick(o), t: 0, s: rand(.45, .8) });
        }
      }
      N.forEach(n => { n.flash = Math.max(0, n.flash - dt * 2.5); });
      epsAcc += dt; if (epsAcc > 1) { $('[data-k="eps"]', pb).textContent = fmt(eps * 37 + ri(0, 40)); eps = 0; epsAcc = 0; }
      if (!H.vis(cvs.cv)) return;
      const { ctx, w, h } = cvs; ctx.clearRect(0, 0, w, h);
      const nw = clamp(w * .19, 66, 108), nh = 24, padY = 22;
      const P = n => [nw / 2 + 6 + n.x * (w - nw - 12), padY + n.y * (h - padY * 2)];
      const bez = (e, t) => {
        const a = P(N[E[e][0]]), b = P(N[E[e][1]]), x0 = a[0] + nw / 2, x3 = b[0] - nw / 2, dx = (x3 - x0) * .5, u = 1 - t;
        return [u * u * u * x0 + 3 * u * u * t * (x0 + dx) + 3 * u * t * t * (x3 - dx) + t * t * t * x3, u * u * u * a[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * b[1]];
      };
      ctx.lineWidth = 1.2;
      E.forEach((e, k) => {
        const a = P(N[e[0]]), b = P(N[e[1]]), x0 = a[0] + nw / 2, x3 = b[0] - nw / 2, dx = (x3 - x0) * .5;
        const g = ctx.createLinearGradient(x0, 0, x3, 0); g.addColorStop(0, rgba(C.a2, .45)); g.addColorStop(1, rgba(C[N[e[1]].c], .45));
        ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(x0, a[1]); ctx.bezierCurveTo(x0 + dx, a[1], x3 - dx, b[1], x3, b[1]); ctx.stroke();
      });
      for (const p of pk) {
        for (let k = 0; k < 4; k++) { const tt = p.t - k * .025; if (tt < 0) continue; const q = bez(p.e, tt); ctx.fillStyle = k ? rgba(C.a1, .45 - k * .1) : rgba(C.ink, 1); ctx.beginPath(); ctx.arc(q[0], q[1], k ? 1.6 : 2.2, 0, TAU); ctx.fill(); }
      }
      ctx.font = '600 11px "Chakra Petch", sans-serif'; ctx.textBaseline = 'middle';
      for (const n of N) {
        const [x, y] = P(n), col = C[n.c], x0 = x - nw / 2, y0 = y - nh / 2;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y0, nw, nh, 5) : ctx.rect(x0, y0, nw, nh);
        ctx.fillStyle = rgba(C.deep, .9); ctx.fill();
        ctx.fillStyle = rgba(col, .12 + n.flash * .35); ctx.fill();
        ctx.strokeStyle = rgba(col, .55 + n.flash * .45); ctx.lineWidth = 1 + n.flash; ctx.stroke();
        if (n.flash > .5) { ctx.shadowColor = rgba(col, 1); ctx.shadowBlur = 12 * n.flash; ctx.stroke(); ctx.shadowBlur = 0; }
        ctx.fillStyle = rgba(col, 1); ctx.fillRect(x0 + 7, y - 3, 6, 6);
        ctx.fillStyle = rgba(C.ink, 1); ctx.fillText(n.name, x0 + 18, y + .5, nw - 22);
        ctx.font = '9px "JetBrains Mono", monospace'; ctx.fillStyle = rgba(C.dim, 1); ctx.fillText(fmt(n.n), x0 + 2, y + nh / 2 + 9);
        ctx.font = '600 11px "Chakra Petch", sans-serif';
      }
      ctx.textBaseline = 'alphabetic';
    });
  }
});

/* ---------- release timeline ---------- */
H.def('timeline', {
  title: 'Release Timeline', group: 'dev', mh: 240, cls: 'tl',
  desc: 'リリース v1.5 のガントチャート。NOW ラインが進むと各工程が埋まっていく',
  icon: '<path d="M3 6h9M6 12h12M10 18h10"/><path d="M3 3v18"/>',
  build(pb) {
    const T = [['Planning', 0, 1.6, 'var(--a2)'], ['Development', 1.2, 3.4, 'var(--a1)'], ['Testing', 3, 2.2, 'var(--a3)'], ['Deployment', 4.6, 1.3, 'var(--ok)']];
    pb.innerHTML = `<div class="tl-weeks">${[1, 2, 3, 4, 5, 6].map(w => `<span>W${w}</span>`).join('')}</div>
      <div class="tl-labels">${T.map(t => `<span>${t[0]}</span>`).join('')}</div>
      <div class="tl-track"><i class="tl-now"></i>${T.map(([, s, l, c]) => `<div class="tl-bar" style="--s:${s / 6 * 100}%;--w:${l / 6 * 100}%;--bc:${c}"><i></i></div>`).join('')}<i class="tl-ms" style="left:${4.6 / 6 * 100}%" title="Beta"></i><i class="tl-ms" style="left:${5.9 / 6 * 100}%" title="v1.5"></i></div>
      <div class="tl-pct">${T.map(() => '<span>0%</span>').join('')}</div>`;
    const bars = $$('.tl-bar i', pb), pcts = $$('.tl-pct span', pb), nowEl = $('.tl-now', pb);
    let wk = 2.2;
    H.tick(dt => {
      wk += dt * .11 * (M || 1); if (wk > 6.3) wk = 0;
      const x = clamp(wk, 0, 6);
      nowEl.style.setProperty('--x', (x / 6 * 100).toFixed(2) + '%');
      T.forEach(([, s, l], i) => { const p = clamp((x - s) / l, 0, 1); bars[i].style.setProperty('--p', (p * 100).toFixed(1) + '%'); pcts[i].textContent = Math.round(p * 100) + '%'; });
    });
  }
});
})();
