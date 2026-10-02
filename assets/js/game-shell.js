/* ============================================================
   NEON ARCADE  ·  game-shell.js
   Shared game page frame: top HUD, start menu with modes and
   skins, pause menu with settings, results screen that reports
   the run to the arcade account, fixed-timestep loop, high-DPI
   canvas scaling, touch buttons.
   © 2026 Neon Inc™
   ============================================================ */
(function (global) {
'use strict';
const A = global.Arcade;
const { esc, fmt } = A.util;
const STEP = 1 / 120;

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

function create(opts) {
  const game = A.gameById(opts.id);
  const W = opts.width, H = opts.height;
  document.body.classList.add('na-game');
  document.body.style.setProperty('--gc', game.color);
  document.title = `${game.name} — NEON ARCADE`;
  if (global.matchMedia && matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  global.addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });

  /* ── DOM ── */
  const app = el('div', 'gs-app');
  const hudHTML = (opts.hud || []).map(h => `<div class="gs-stat${h.main ? ' main' : ''}${h.opt ? ' opt' : ''}"><span class="l">${h.label}</span><span class="v" data-hud="${h.id}">${h.init ?? 0}</span></div>`).join('');
  app.innerHTML = `
    <header class="gs-top">
      <a class="gs-back" href="${opts.home || '../../index.html'}" aria-label="Back to the arcade"><b>‹</b><span>ARCADE</span></a>
      <div class="gs-title">${game.icon} ${game.name}</div>
      <div class="gs-hud">${hudHTML}</div>
      <div class="gs-btns">
        <button class="na-icon-btn" data-act="music" aria-label="Toggle music" title="Music (M)">♪</button>
        <button class="na-icon-btn" data-act="pause" aria-label="Pause" title="Pause (P / Esc)">❚❚</button>
      </div>
    </header>
    <main class="gs-stage"><div class="gs-frame"><canvas aria-label="${game.name} game area"></canvas>
      <div class="gs-ov" data-ov="menu"></div>
      <div class="gs-ov" data-ov="pause"></div>
      <div class="gs-ov" data-ov="results"></div>
    </div></main>
    <div class="gs-touch"></div>`;
  document.body.appendChild(app);

  const stage = app.querySelector('.gs-stage');
  const frame = app.querySelector('.gs-frame');
  const canvas = app.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const ov = { menu: app.querySelector('[data-ov=menu]'), pause: app.querySelector('[data-ov=pause]'), results: app.querySelector('[data-ov=results]') };
  const hudEls = {}; app.querySelectorAll('[data-hud]').forEach(e => hudEls[e.dataset.hud] = e);
  const musicBtn = app.querySelector('[data-act=music]');
  const pauseBtn = app.querySelector('[data-act=pause]');

  /* ── API object ── */
  const lastModeKey = `na_mode_${opts.id}`;
  let savedMode = null; try { savedMode = localStorage.getItem(lastModeKey); } catch (_) {}
  const api = {
    W, H, canvas, ctx, game,
    state: 'menu',
    mode: (opts.modes || []).find(m => m.id === savedMode)?.id || opts.modes?.[0]?.id || 'normal',
    keys: new Set(),
    time: 0, scale: 1,
    particles: new A.gfx.Particles(700),
    floaters: new A.gfx.Floaters(),
    skin: A.equipped(opts.id)?.data || {},
    shakeMag: 0, flashA: 0, flashC: '#fff',
  };
  api.reduceMotion = () => !!A.settings().reduceMotion;
  api.setHud = (id, v, bump) => {
    const e = hudEls[id]; if (!e) return;
    const s = typeof v === 'number' ? fmt(v) : String(v);
    if (e.textContent !== s) { e.textContent = s; if (bump && !api.reduceMotion()) { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); } }
  };
  api.shake = mag => { if (A.settings().shake && !api.reduceMotion()) api.shakeMag = Math.max(api.shakeMag, mag); };
  api.flash = (color = '#fff', a = 0.35) => { if (api.reduceMotion()) a *= 0.3; api.flashC = color; api.flashA = Math.max(api.flashA, a); };
  api.toLogical = (cx, cy) => { const r = canvas.getBoundingClientRect(); return { x: (cx - r.left) / r.width * W, y: (cy - r.top) / r.height * H }; };
  api.sfx = (n, a) => A.audio.sfx(n, a);
  api.tone = (...a) => A.audio.tone(...a);
  api.noise = (...a) => A.audio.noise(...a);

  /* ── sizing ── */
  let backing = 1;
  function resize() {
    const sr = stage.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(stage).paddingLeft) * 2 || 0;
    const aw = Math.max(100, sr.width - pad), ah = Math.max(100, sr.height - pad);
    const s = Math.min(aw / W, ah / H);
    const cw = Math.floor(W * s), ch = Math.floor(H * s);
    frame.style.width = cw + 'px'; frame.style.height = ch + 'px';
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    backing = canvas.width / W; api.scale = s;
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  /* ── overlays ── */
  function show(name) { Object.entries(ov).forEach(([k, e]) => e.classList.toggle('show', k === name)); }

  function skinRow() {
    const skins = A.REWARDS.filter(r => r.game === opts.id);
    const cur = A.equipped(opts.id);
    return `<div class="gs-label">SKIN · <span data-skinname>${esc(cur.name.toUpperCase())}</span></div><div class="gs-skins">${skins.map(r => {
      const st = A.unlockStatus(r); const sw = A.rewardSwatch(r);
      const bg = sw.length > 1 ? `linear-gradient(135deg, ${sw.join(',')})` : sw[0];
      return `<button class="gs-skin${r.id === cur.id ? ' sel' : ''}${st.owned ? '' : ' locked'}" data-skin="${r.id}" title="${esc(r.name)}${st.owned ? '' : ' — ' + esc(st.reason)}" aria-label="${esc(r.name)} skin${st.owned ? '' : ', locked'}">${st.owned ? `<i style="background:${bg}"></i>` : ''}</button>`;
    }).join('')}</div>`;
  }

  function renderMenu() {
    const rec = A.state().games[opts.id];
    const modes = opts.modes || [];
    ov.menu.innerHTML = `
      <div class="big-title">${esc(game.name)}</div>
      <div class="sub">${esc(game.tagline)}</div>
      <div class="best-line">BEST <b>${opts.formatScore ? opts.formatScore(rec.best, null) : fmt(rec.best)}</b> · ${fmt(rec.plays)} RUNS</div>
      ${modes.length > 1 ? `<div class="gs-modes">${modes.map(m => {
        const b = opts.modeBest ? opts.modeBest(rec, m.id) : (rec.bests[m.id] ? fmt(rec.bests[m.id]) : '');
        return `<button class="gs-mode${m.id === api.mode ? ' sel' : ''}" data-mode="${m.id}"><div><div class="mn">${esc(m.name)}</div><div class="md">${esc(m.desc)}</div></div>${b ? `<div class="mb">★ ${b}</div>` : ''}</button>`;
      }).join('')}</div>` : ''}
      ${skinRow()}
      <button class="na-btn solid" data-act="play" style="--bc:var(--gc);min-width:200px">▶ PLAY <span class="kbd">ENTER</span></button>
      <div class="gs-controls">${(opts.controls || []).map(c => `<span><kbd>${c[0]}</kbd>${c[1]}</span>`).join('')}</div>`;
  }

  function renderPause() {
    const s = A.settings();
    ov.pause.innerHTML = `
      <div class="big-title">PAUSED</div>
      <div class="gs-row">
        <button class="na-btn solid" data-act="resume" style="--bc:var(--gc)">▶ RESUME</button>
        <button class="na-btn" data-act="restart" style="--bc:var(--gc)">↻ RESTART</button>
        <button class="na-btn ghost" data-act="quit">✕ QUIT RUN</button>
      </div>
      <div class="gs-settings">
        <label class="na-toggle">Music <input type="checkbox" data-set="music" ${s.music ? 'checked' : ''}></label>
        <label class="na-toggle">Sound effects <input type="checkbox" data-set="sfx" ${s.sfx ? 'checked' : ''}></label>
        <label class="na-toggle" style="flex-direction:column;align-items:stretch;gap:6px">Volume <input class="na-range" type="range" min="0" max="1" step="0.05" value="${s.volume}" data-set="volume"></label>
        <label class="na-toggle">Screen shake <input type="checkbox" data-set="shake" ${s.shake ? 'checked' : ''}></label>
        <label class="na-toggle">CRT scanlines <input type="checkbox" data-set="crt" ${s.crt ? 'checked' : ''}></label>
        <label class="na-toggle">Reduce motion <input type="checkbox" data-set="reduceMotion" ${s.reduceMotion ? 'checked' : ''}></label>
      </div>`;
  }

  let resultsAt = 0;
  function renderResults(res, display) {
    const tc = A.tier(res.levelAfter).color;
    const need = A.xpNeeded(res.levelAfter);
    const pctAfter = Math.round(res.xpAfter / need * 100);
    const pctBefore = res.levelAfter > res.levelBefore ? 0 : Math.round(res.xpBefore / need * 100);
    const scoreTxt = opts.formatScore ? opts.formatScore(res.score, res) : fmt(res.score);
    const chips = [];
    res.newAch.forEach(a => chips.push(`<div class="gs-chip ach"><span class="ci">${a.icon}</span><div><b>${esc(a.name)}</b><br><small style="color:var(--dim)">${esc(a.desc)}</small></div><span class="cr">+${a.xp} XP${a.shards ? ` · +${a.shards}💎` : ''}</span></div>`));
    res.unlocked.forEach(r => chips.push(`<div class="gs-chip unl"><span class="ci">${A.rewardIcon(r)}</span><div><b>UNLOCKED: ${esc(r.name)}</b><br><small style="color:var(--dim)">${r.type === 'skin' ? esc(A.gameById(r.game).name) + ' skin' : r.type}</small></div></div>`));
    res.quests.forEach(q => chips.push(`<div class="gs-chip${q.done ? ' qd' : ''}"><span class="ci">${q.done ? '✅' : '📜'}</span><div style="flex:1">${esc(q.label)}<div class="gs-qbar" style="max-width:none;margin-top:5px"><i style="width:${Math.round(q.progress / q.target * 100)}%"></i></div></div><span class="cr">${q.done ? 'CLAIM IN HUB' : `${fmt(q.progress)}/${fmt(q.target)}`}</span></div>`));
    ov.results.innerHTML = `
      <div class="gs-res">
        <div class="gs-label">${esc(opts.overTitle?.(res) || 'GAME OVER')}${res.mode && (opts.modes || []).length > 1 ? ' · ' + esc((opts.modes.find(m => m.id === res.mode) || {}).name || '') : ''}</div>
        <div class="gs-res-score">${scoreTxt}</div>
        <div>${res.isBest && res.prevBest > 0 ? '<span class="gs-newbest">★ NEW BEST</span>' : res.isBest ? '<span class="gs-newbest">★ FIRST SCORE SET</span>' : `<span class="best-line">BEST <b>${opts.formatScore ? opts.formatScore(res.best, null) : fmt(res.best)}</b></span>`}</div>
        ${display?.length ? `<div class="gs-res-stats">${display.map(d => `<div><span>${esc(d[0])}</span><b>${esc(String(d[1]))}</b></div>`).join('')}</div>` : ''}
        <div class="gs-xpbox" style="--tc:${tc}">
          <div class="gs-xphead"><span>LV ${res.levelAfter} · ${esc(A.tier(res.levelAfter).name)}</span><b>+${fmt(res.xp)} XP · +${fmt(res.shards)} 💎</b></div>
          <div class="gs-xpbar"><i data-xp style="width:${pctBefore}%"></i></div>
          <div class="gs-xplines">${res.breakdown.map(b => `<span>${esc(b.label)} <b>+${fmt(b.xp)}</b></span>`).join('')}</div>
        </div>
        ${chips.length ? `<div class="gs-chips">${chips.join('')}</div>` : ''}
        <div class="gs-row">
          <button class="na-btn solid" data-act="again" style="--bc:var(--gc)">↻ PLAY AGAIN <span class="kbd">ENTER</span></button>
          <button class="na-btn" data-act="menu" style="--bc:var(--gc)">☰ MODES</button>
          <a class="na-btn ghost" href="${opts.home || '../../index.html'}">⌂ ARCADE</a>
        </div>
      </div>`;
    const bar = ov.results.querySelector('[data-xp]');
    setTimeout(() => { bar.style.width = (res.levelAfter > res.levelBefore ? 100 : pctAfter) + '%'; }, 120);
    if (res.levelAfter > res.levelBefore) {
      setTimeout(() => { bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth; bar.style.transition = ''; bar.style.width = pctAfter + '%'; A.ui.levelUp(res.levelAfter, A.REWARDS.filter(r => res.unlocked.includes(r))); }, 1100);
    } else if (res.newAch.length || res.unlocked.length) {
      setTimeout(() => A.audio.sfx('achieve'), 500);
    }
  }

  /* ── flow ── */
  function updateMusicBtn() { const on = A.settings().music; musicBtn.style.opacity = on ? 1 : 0.45; musicBtn.setAttribute('aria-pressed', on); }
  updateMusicBtn();

  function toMenu() {
    api.state = 'menu'; api.skin = A.equipped(opts.id).data;
    renderMenu(); show('menu'); pauseBtn.style.visibility = 'hidden';
    opts.onMenu && opts.onMenu();
  }
  function start() {
    try { localStorage.setItem(lastModeKey, api.mode); } catch (_) {}
    api.skin = A.equipped(opts.id).data;
    api.state = 'playing'; api.time = 0;
    api.particles.clear(); api.floaters.clear(); api.shakeMag = 0; api.flashA = 0;
    show(null); pauseBtn.style.visibility = 'visible';
    A.audio.sfx('start');
    A.audio.playMusic(opts.music || 'hub'); A.audio.pauseMusic(false);
    opts.onStart(api.mode);
    canvas.focus?.();
  }
  function pause() {
    if (api.state !== 'playing') return;
    api.state = 'paused'; renderPause(); show('pause'); A.audio.sfx('pause'); A.audio.pauseMusic(true);
    opts.onPause && opts.onPause();
  }
  function resume() {
    if (api.state !== 'paused') return;
    api.state = 'playing'; show(null); A.audio.pauseMusic(false); last = performance.now();
    opts.onResume && opts.onResume();
  }
  api.pause = pause; api.resume = resume; api.restart = start; api.toMenu = toMenu;

  api.gameOver = (stats, display = [], delay = 900) => {
    if (api.state === 'over') return null;
    api.state = 'over'; pauseBtn.style.visibility = 'hidden';
    stats.mode = stats.mode || api.mode;
    stats.timeMs = stats.timeMs ?? Math.round(api.time * 1000);
    const res = A.reportRun(opts.id, stats);
    api.lastResult = res;
    A.audio.pauseMusic(true);
    setTimeout(() => { if (api.state !== 'over') return; renderResults(res, display); show('results'); resultsAt = performance.now(); }, delay);
    return res;
  };

  /* ── events ── */
  app.addEventListener('click', e => {
    const b = e.target.closest('[data-act],[data-mode],[data-skin]');
    if (!b) return;
    if (b.dataset.mode) { api.mode = b.dataset.mode; A.audio.sfx('click'); ov.menu.querySelectorAll('.gs-mode').forEach(x => x.classList.toggle('sel', x === b)); return; }
    if (b.dataset.skin) {
      if (b.classList.contains('locked')) { A.audio.sfx('error'); A.ui.toast('🔒', 'LOCKED', b.title.split(' — ')[1] || '', '#ff2a6d', 2200); return; }
      A.equip(b.dataset.skin); api.skin = A.equipped(opts.id).data; A.audio.sfx('select');
      ov.menu.querySelectorAll('.gs-skin').forEach(x => x.classList.toggle('sel', x === b));
      const nm = ov.menu.querySelector('[data-skinname]'); if (nm) nm.textContent = A.equipped(opts.id).name.toUpperCase();
      opts.onSkin && opts.onSkin(api.skin);
      return;
    }
    const act = b.dataset.act;
    if (act === 'play' || act === 'again' || act === 'restart') start();
    else if (act === 'pause') api.state === 'paused' ? resume() : pause();
    else if (act === 'resume') resume();
    else if (act === 'quit' || act === 'menu') { A.audio.sfx('back'); toMenu(); }
    else if (act === 'music') { A.setSetting('music', !A.settings().music); updateMusicBtn(); if (A.settings().music && api.state === 'playing') A.audio.playMusic(opts.music || 'hub'); }
  });
  app.addEventListener('change', e => {
    const k = e.target.dataset.set; if (!k) return;
    A.setSetting(k, e.target.type === 'checkbox' ? e.target.checked : parseFloat(e.target.value));
    if (k === 'music') updateMusicBtn();
  });
  app.addEventListener('input', e => { if (e.target.dataset.set === 'volume') A.setSetting('volume', parseFloat(e.target.value)); });

  const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
  global.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'range') return;
    const code = e.code;
    if (code === 'KeyM' && !e.repeat) { musicBtn.click(); return; }
    if (api.state === 'playing') {
      if ((code === 'Escape' || code === 'KeyP') && !e.repeat) { pause(); e.preventDefault(); return; }
      if (GAME_KEYS.has(code)) e.preventDefault();
      api.keys.add(code);
      opts.onKey && opts.onKey(code, true, e);
      return;
    }
    if (api.state === 'paused') { if ((code === 'Escape' || code === 'KeyP') && !e.repeat) { resume(); e.preventDefault(); } return; }
    if (api.state === 'menu' && (code === 'Enter' || code === 'Space') && !e.repeat && !e.target.closest?.('button,a')) { e.preventDefault(); start(); return; }
    if (api.state === 'menu' && (code === 'ArrowUp' || code === 'ArrowDown') && opts.modes?.length > 1) {
      e.preventDefault();
      const i = opts.modes.findIndex(m => m.id === api.mode);
      const ni = (i + (code === 'ArrowDown' ? 1 : -1) + opts.modes.length) % opts.modes.length;
      ov.menu.querySelector(`[data-mode="${opts.modes[ni].id}"]`)?.click();
      return;
    }
    if (api.state === 'over' && (code === 'Enter' || code === 'Space') && !e.repeat && ov.results.classList.contains('show') && performance.now() - resultsAt > 500) { e.preventDefault(); start(); }
    if (api.state === 'over' && code === 'Escape' && ov.results.classList.contains('show')) toMenu();
  });
  global.addEventListener('keyup', e => {
    api.keys.delete(e.code);
    if (api.state === 'playing') opts.onKey && opts.onKey(e.code, false, e);
  });
  global.addEventListener('blur', () => { api.keys.clear(); if (opts.pauseOnBlur !== false) pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  /* ── touch buttons ── */
  const touchBar = app.querySelector('.gs-touch');
  if (opts.touch) {
    const group = list => `<div class="gs-tgroup">${list.map(b => `<button class="gs-tbtn${b.wide ? ' wide' : ''}" data-tkey="${b.key}" aria-label="${esc(b.aria || b.label)}">${b.label}${b.sub ? `<small>${b.sub}</small>` : ''}</button>`).join('')}</div>`;
    touchBar.innerHTML = group(opts.touch.left || []) + group(opts.touch.right || []);
    touchBar.classList.add('has-btns');
    touchBar.querySelectorAll('[data-tkey]').forEach(b => {
      const key = b.dataset.tkey;
      const down = e => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); b.classList.add('on'); if (api.state === 'playing') { api.keys.add(key); opts.onKey && opts.onKey(key, true, { repeat: false, synthetic: true }); } if (navigator.vibrate) try { navigator.vibrate(6); } catch (_) {} };
      const up = e => { if (!b.classList.contains('on')) return; b.classList.remove('on'); api.keys.delete(key); if (api.state === 'playing') opts.onKey && opts.onKey(key, false, { synthetic: true }); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', e => e.preventDefault());
    });
    new ResizeObserver(resize).observe(touchBar);
  }

  /* ── loop ── */
  let last = performance.now(), acc = 0, rafT = 0;
  function frameFn(now) {
    requestAnimationFrame(frameFn);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.25) dt = 0.25;
    rafT += dt;
    if (api.state !== 'paused') {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 12) {
        if (api.state === 'playing') api.time += STEP;
        opts.update(STEP);
        api.particles.update(STEP); api.floaters.update(STEP);
        acc -= STEP; n++;
      }
      if (n >= 12) acc = 0;
      api.shakeMag *= Math.exp(-dt * 10); if (api.shakeMag < 0.2) api.shakeMag = 0;
      api.flashA *= Math.exp(-dt * 6); if (api.flashA < 0.01) api.flashA = 0;
    }
    ctx.setTransform(backing, 0, 0, backing, 0, 0);
    ctx.save();
    if (api.shakeMag) ctx.translate((Math.random() - 0.5) * api.shakeMag * 2, (Math.random() - 0.5) * api.shakeMag * 2);
    opts.render(ctx, acc / STEP, rafT);
    ctx.restore();
    if (api.flashA) { ctx.globalAlpha = api.flashA; ctx.fillStyle = api.flashC; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }

  // start
  const boot = () => { toMenu(); requestAnimationFrame(t => { last = t; frameFn(t); }); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot, boot); else boot();
  // first gesture unlocks audio + menu music
  const unlock = () => { A.audio.ctx(); if (api.state === 'menu' && A.settings().music) A.audio.playMusic(opts.music || 'hub'); };
  global.addEventListener('pointerdown', unlock, { once: true });
  global.addEventListener('keydown', unlock, { once: true });
  return api;
}

global.GameShell = { create };
})(window);
