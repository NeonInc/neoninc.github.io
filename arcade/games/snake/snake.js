/* ============================================================
   NEON SNAKE™ v6  ·  Neon Arcade edition
   Smooth interpolated grid movement, buffered turns, combos,
   special apples, the Grid Warden boss, and Free Aim mode.
   © 2026 Neon Inc™
   ============================================================ */
(function () {
'use strict';
const A = window.Arcade, G = A.gfx;
const W = 600, H = 600, N = 20, T = W / N;

const MODES = [
  { id: 'classic', name: 'CLASSIC', desc: 'Grid snake. Walls bite. Boss at 30 apples.' },
  { id: 'free',    name: 'FREE AIM', desc: 'Steer freely with keys, mouse or touch.' },
];
const SPECIALS = {
  golden:   { color: '#ffd700', label: '+5', ttl: 8 },
  combo:    { color: '#00b3ff', label: '×2', ttl: 8 },
  volatile: { color: '#ff7a00', label: 'BOOM', ttl: 7 },
  bad:      { color: '#9dff00', label: '☠', ttl: 9 },
};
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };

let S = null; // run state

const shell = GameShell.create({
  id: 'snake', width: W, height: H, music: 'snake', modes: MODES,
  hud: [{ id: 'score', label: 'SCORE', main: true }, { id: 'best', label: 'BEST' }, { id: 'combo', label: 'COMBO', init: '×1', opt: true }],
  controls: [['←↑↓→ / WASD', 'Steer'], ['SWIPE', 'Touch steer'], ['P', 'Pause'], ['M', 'Music']],
  touch: { left: [{ key: 'ArrowLeft', label: '◀' }, { key: 'ArrowRight', label: '▶' }], right: [{ key: 'ArrowUp', label: '▲' }, { key: 'ArrowDown', label: '▼' }] },
  onStart, update, render, onKey,
  onMenu() { shell.setHud('best', A.state().games.snake.best); idleSetup(); },
});

/* ─────────────────────────────────────────────────────────
   RUN SETUP
───────────────────────────────────────────────────────── */
function baseState(mode) {
  return {
    mode, dead: false, deadT: 0,
    score: 0, apples: 0, combo: 0, maxCombo: 0, comboT: 0,
    goldens: 0, badSurvived: 0, bosses: 0, nextBoss: 30,
    x2: 0, infected: 0, drainT: 0, rainbow: 0, badCooldown: 0,
    food: null, special: null, minis: [],
    boss: null, t: 0,
  };
}
function onStart(mode) {
  S = baseState(mode);
  if (mode === 'classic') {
    const cy = Math.floor(N / 2);
    S.cells = [{ x: 6, y: cy }, { x: 5, y: cy }, { x: 4, y: cy }, { x: 3, y: cy }];
    S.prev = S.cells.map(c => ({ ...c }));
    S.dir = 'right'; S.queue = []; S.grow = 0; S.tick = 0;
  } else {
    S.head = { x: W * 0.3, y: H / 2 }; S.ang = 0; S.turn = 0;
    S.trail = [];
    for (let i = 0; i < 40; i++) S.trail.push({ x: S.head.x - i * 3, y: S.head.y });
    S.len = 110; S.pointer = null;
  }
  spawnFood();
  shell.setHud('score', 0); shell.setHud('combo', '×1'); shell.setHud('best', A.state().games.snake.best);
}

/* menu attract: slow demo snake on the title screen */
function idleSetup() {
  S = baseState('idle');
  S.head = { x: W / 2, y: H / 2 }; S.ang = 0; S.trail = []; S.len = 260; S.idle = true;
  for (let i = 0; i < 80; i++) S.trail.push({ x: S.head.x - i * 3, y: S.head.y });
}

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const cellPx = c => ({ x: (c.x + 0.5) * T, y: (c.y + 0.5) * T });
const tickMs = () => 58 + 80 * Math.exp(-S.apples / 30);
const freeSpeed = () => Math.min(300, 150 + S.apples * 2.4);

function headPos(alpha = 0) {
  if (S.mode === 'free' || S.idle) return S.head;
  const a = S.prev[0], b = S.cells[0];
  return { x: ((a.x + (b.x - a.x) * alpha) + 0.5) * T, y: ((a.y + (b.y - a.y) * alpha) + 0.5) * T };
}
function occupied(px, py, margin) {
  if (S.mode === 'classic') return S.cells.some(c => Math.abs((c.x + .5) * T - px) < margin && Math.abs((c.y + .5) * T - py) < margin);
  return S.trail.some((p, i) => i % 3 === 0 && dist(p.x, p.y, px, py) < margin);
}
function freeSpot(minHeadDist = 110) {
  const h = headPos();
  for (let tries = 0; tries < 200; tries++) {
    let x, y;
    if (S.mode === 'classic') { const c = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }; ({ x, y } = cellPx(c)); }
    else { x = rnd(40, W - 40); y = rnd(40, H - 40); }
    if (dist(x, y, h.x, h.y) < minHeadDist && tries < 150) continue;
    if (occupied(x, y, S.mode === 'classic' ? T * 0.6 : 26)) continue;
    if (S.food && dist(x, y, S.food.x, S.food.y) < 40) continue;
    if (S.special && dist(x, y, S.special.x, S.special.y) < 40) continue;
    if (S.boss && dist(x, y, S.boss.x, S.boss.y) < 90) continue;
    return { x, y };
  }
  return { x: W / 2, y: H / 2 };
}
function spawnFood() { S.food = { ...freeSpot(), born: S.t }; }
function maybeSpecial() {
  if (S.special || Math.random() > 0.24) return;
  const r = Math.random();
  let type = r < 0.45 ? 'golden' : r < 0.68 ? 'combo' : r < 0.86 ? 'volatile' : 'bad';
  if (type === 'bad' && (S.badCooldown > 0 || S.apples < 6)) type = 'golden';
  S.special = { type, ...freeSpot(80), ttl: SPECIALS[type].ttl, born: S.t };
}

/* ─────────────────────────────────────────────────────────
   EATING
───────────────────────────────────────────────────────── */
function addScore(n, x, y, color = '#ffffff', label) {
  const mult = S.x2 > 0 ? 2 : 1;
  const pts = n * mult;
  S.score += pts;
  shell.setHud('score', S.score, true);
  shell.floaters.add(x, y - 14, label || `+${pts}`, color, label ? 20 : 17);
}
function eatApple(x, y) {
  S.apples++;
  S.combo = S.comboT > 0 ? S.combo + 1 : 1;
  S.comboT = 4.5;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  shell.setHud('combo', '×' + S.combo, S.combo > 1);
  const pts = 1 + Math.min(4, Math.floor((S.combo - 1) / 2));
  addScore(pts, x, y, S.combo >= 3 ? '#ffd700' : '#ffffff', S.combo >= 3 ? `+${pts * (S.x2 > 0 ? 2 : 1)} ×${S.combo}` : null);
  grow(1);
  shell.particles.emit(x, y, { n: 14, color: [shell.skin.body, '#ffffff'], speed: 170, life: 0.5, size: 2.5 });
  shell.sfx('combo', Math.min(S.combo, 12));
  if (S.boss && !S.boss.dying) hitBoss();
  else if (!S.boss && S.apples >= S.nextBoss) spawnBoss();
  spawnFood(); maybeSpecial();
}
function eatSpecial(sp) {
  const c = SPECIALS[sp.type].color;
  shell.particles.emit(sp.x, sp.y, { n: 26, color: [c, '#ffffff'], speed: 230, life: 0.7, size: 3 });
  if (sp.type === 'golden') { S.goldens++; addScore(5, sp.x, sp.y, c, `+${5 * (S.x2 > 0 ? 2 : 1)} GOLD`); grow(2); shell.sfx('coin'); }
  if (sp.type === 'combo')  { S.x2 = 6; shell.floaters.add(sp.x, sp.y - 14, '×2 SCORE', c, 20); shell.sfx('power'); }
  if (sp.type === 'volatile') {
    addScore(3, sp.x, sp.y, c, 'BOOM +3'); shell.shake(9); shell.flash(c, 0.25); shell.sfx('explode');
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + Math.random();
      const x = Math.max(30, Math.min(W - 30, sp.x + Math.cos(a) * 90)), y = Math.max(30, Math.min(H - 30, sp.y + Math.sin(a) * 90));
      S.minis.push({ x, y, ttl: 4.5 });
    }
  }
  if (sp.type === 'bad') { S.infected = 7; S.drainT = 1.2; S.badCooldown = 20; shell.flash('#6aff00', 0.3); shell.sfx('error'); shell.floaters.add(sp.x, sp.y - 14, 'INFECTED', c, 20); }
  S.special = null;
}
function grow(n) {
  if (S.mode === 'classic') S.grow += n;
  else S.len += 13 * n;
}

/* ─────────────────────────────────────────────────────────
   BOSS — the Grid Warden
───────────────────────────────────────────────────────── */
function spawnBoss() {
  const lvl = S.bosses;
  const h = headPos();
  const x = h.x < W / 2 ? W - 90 : 90, y = h.y < H / 2 ? H - 90 : 90;
  const sp = 120 + lvl * 25;
  const a = Math.random() * Math.PI * 2;
  S.boss = { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, hp: 8 + lvl * 3, max: 8 + lvl * 3, r: 24, phase: 1, hitT: 0, spawnT: 1.4, dying: 0 };
  shell.sfx('explode'); shell.shake(8); shell.flash('#ff1744', 0.25);
  shell.floaters.add(W / 2, H / 2, 'GRID WARDEN', '#ff1744', 30, 1.6);
}
function hitBoss() {
  const b = S.boss;
  b.hp--; b.hitT = 0.25;
  shell.particles.emit(b.x, b.y, { n: 18, color: ['#ff1744', '#ff8a00'], speed: 260, life: 0.5 });
  shell.sfx('hit'); shell.shake(5);
  const ph = b.hp <= b.max / 3 ? 3 : b.hp <= b.max * 2 / 3 ? 2 : 1;
  if (ph !== b.phase) { b.phase = ph; b.vx *= 1.3; b.vy *= 1.3; shell.floaters.add(b.x, b.y - 40, `PHASE ${ph}`, '#ff8a00', 20); }
  if (b.hp <= 0) {
    b.dying = 1; S.bosses++; S.nextBoss = S.apples + 40;
    addScore(25, b.x, b.y, '#ffd700', 'WARDEN DOWN +25');
    S.rainbow = 8; shell.sfx('levelup'); shell.shake(14); shell.flash('#ffffff', 0.5);
    shell.particles.emit(b.x, b.y, { n: 80, color: ['#ff1744', '#ffd700', '#ffffff', '#ff00ff'], speed: 420, life: 1.2, size: 3.5 });
  }
}
function updateBoss(dt) {
  const b = S.boss; if (!b) return;
  if (b.dying) { b.dying -= dt * 1.5; if (b.dying <= 0) S.boss = null; return; }
  b.hitT = Math.max(0, b.hitT - dt);
  if (b.spawnT > 0) { b.spawnT -= dt; return; }
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); } if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
  if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); } if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy); }
  if (b.phase === 3) { // phase 3 drifts toward the player
    const h = headPos(S.mode === 'classic' ? S.tick / tickMs() : 0);
    const a = Math.atan2(h.y - b.y, h.x - b.x), sp = Math.hypot(b.vx, b.vy);
    const cur = Math.atan2(b.vy, b.vx);
    let d = a - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    const na = cur + Math.max(-0.6 * dt, Math.min(0.6 * dt, d));
    b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
  }
  const h = headPos(S.mode === 'classic' ? S.tick / tickMs() : 0);
  if (dist(h.x, h.y, b.x, b.y) < b.r + 8) die('WARDEN');
}

/* ─────────────────────────────────────────────────────────
   UPDATE
───────────────────────────────────────────────────────── */
function update(dt) {
  if (!S) idleSetup();
  if (S.idle) { updateIdle(dt); return; }
  S.t += dt;
  if (S.dead) { S.deadT += dt; return; }
  if (shell.state !== 'playing') return;

  // timers
  if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) { S.combo = 0; shell.setHud('combo', '×1'); } }
  if (S.x2 > 0) S.x2 -= dt;
  if (S.rainbow > 0) S.rainbow -= dt;
  if (S.badCooldown > 0) S.badCooldown -= dt;
  if (S.infected > 0) {
    S.infected -= dt; S.drainT -= dt;
    if (S.drainT <= 0) { S.drainT = 1.2; if (S.score > 0) { S.score--; shell.setHud('score', S.score); const h = headPos(); shell.floaters.add(h.x, h.y - 20, '-1', '#9dff00', 14); } }
    if (S.infected <= 0) { S.badSurvived++; shell.floaters.add(W / 2, 60, 'RECOVERED', '#9dff00', 22); shell.sfx('power'); }
  }
  if (S.special) { S.special.ttl -= dt; if (S.special.ttl <= 0) S.special = null; }
  for (let i = S.minis.length - 1; i >= 0; i--) { S.minis[i].ttl -= dt; if (S.minis[i].ttl <= 0) S.minis.splice(i, 1); }

  if (S.mode === 'classic') updateClassic(dt); else updateFree(dt);
  updateBoss(dt);
}

function updateClassic(dt) {
  S.tick += dt * 1000;
  const iv = tickMs();
  if (S.tick < iv) return;
  S.tick -= iv; if (S.tick > iv) S.tick = 0;
  // turn buffer
  while (S.queue.length) {
    const nd = S.queue.shift();
    const [dx, dy] = DIRS[nd], [cx, cy] = DIRS[S.dir];
    if (dx === -cx && dy === -cy) continue;
    if (nd === S.dir) continue;
    S.dir = nd; break;
  }
  const [dx, dy] = DIRS[S.dir];
  const head = S.cells[0];
  const nx = head.x + dx, ny = head.y + dy;
  if (nx < 0 || ny < 0 || nx >= N || ny >= N) { die('WALL'); return; }
  const willGrow = S.grow > 0;
  const body = willGrow ? S.cells : S.cells.slice(0, -1);
  if (body.some(c => c.x === nx && c.y === ny)) { die('SELF'); return; }
  S.prev = S.cells.map(c => ({ ...c }));
  S.cells.unshift({ x: nx, y: ny });
  if (willGrow) { S.grow--; S.prev.push({ ...S.prev[S.prev.length - 1] }); }
  else S.cells.pop();
  // the tail's previous position for smooth interpolation
  // (prev[i] = where segment i was before this tick)
  const hp = cellPx({ x: nx, y: ny });
  checkEat(hp.x, hp.y, T * 0.6);
}

function updateFree(dt) {
  let turn = 0;
  if (shell.keys.has('ArrowLeft') || shell.keys.has('KeyA')) turn -= 1;
  if (shell.keys.has('ArrowRight') || shell.keys.has('KeyD')) turn += 1;
  if (turn) S.ang += turn * 3.8 * dt;
  else if (S.pointer) {
    const ta = Math.atan2(S.pointer.y - S.head.y, S.pointer.x - S.head.x);
    if (dist(S.pointer.x, S.pointer.y, S.head.x, S.head.y) > 14) {
      let d = ta - S.ang; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      S.ang += Math.max(-5 * dt, Math.min(5 * dt, d));
    }
  }
  const sp = freeSpeed();
  S.head = { x: S.head.x + Math.cos(S.ang) * sp * dt, y: S.head.y + Math.sin(S.ang) * sp * dt };
  const h = S.head;
  if (h.x < 9 || h.y < 9 || h.x > W - 9 || h.y > H - 9) { die('WALL'); return; }
  const last = S.trail[0];
  if (!last || dist(last.x, last.y, h.x, h.y) >= 3) S.trail.unshift({ x: h.x, y: h.y });
  trimTrail();
  // self hit: skip the first ~40px of body
  let d = 0;
  for (let i = 1; i < S.trail.length; i++) {
    d += dist(S.trail[i].x, S.trail[i].y, S.trail[i - 1].x, S.trail[i - 1].y);
    if (d > 44 && dist(S.trail[i].x, S.trail[i].y, h.x, h.y) < 11) { die('SELF'); return; }
  }
  checkEat(h.x, h.y, 22);
}
function trimTrail() {
  let d = 0;
  for (let i = 1; i < S.trail.length; i++) {
    d += dist(S.trail[i].x, S.trail[i].y, S.trail[i - 1].x, S.trail[i - 1].y);
    if (d > S.len) { S.trail.length = i + 1; return; }
  }
}
function checkEat(x, y, r) {
  if (S.food && dist(x, y, S.food.x, S.food.y) < r) eatApple(S.food.x, S.food.y);
  if (S.special && dist(x, y, S.special.x, S.special.y) < r) eatSpecial(S.special);
  for (let i = S.minis.length - 1; i >= 0; i--) {
    const m = S.minis[i];
    if (dist(x, y, m.x, m.y) < r) { S.minis.splice(i, 1); addScore(1, m.x, m.y, '#ff7a00'); grow(1); shell.sfx('coin'); shell.particles.emit(m.x, m.y, { n: 10, color: '#ff7a00', speed: 150, life: 0.4 }); }
  }
}

function die(why) {
  if (S.dead) return;
  S.dead = true; S.deadT = 0;
  shell.sfx('explode'); shell.sfx('gameover'); shell.shake(14); shell.flash('#ff1744', 0.45);
  const pts = S.mode === 'classic' ? S.cells.map(cellPx) : S.trail.filter((_, i) => i % 4 === 0);
  pts.forEach((p, i) => setTimeout(() => shell.particles.emit(p.x, p.y, { n: 6, color: [shell.skin.body, '#ffffff'], speed: 200, life: 0.7, size: 2.6 }), Math.min(i * 18, 700)));
  const stats = {
    score: S.score, apples: S.apples, maxCombo: S.maxCombo, goldens: S.goldens,
    badSurvived: S.badSurvived, bosses: S.bosses, boss: S.bosses > 0, answer42: S.score === 42,
    length: S.mode === 'classic' ? S.cells.length : Math.round(S.len / 13),
  };
  shell.gameOver(stats, [['APPLES', S.apples], ['MAX COMBO', '×' + S.maxCombo], ['GOLDEN', S.goldens], ['BOSSES', S.bosses]], 1100);
}

function updateIdle(dt) {
  S.t += dt;
  S.ang += Math.sin(S.t * 0.7) * 1.4 * dt + 0.5 * dt;
  const sp = 120;
  S.head = { x: S.head.x + Math.cos(S.ang) * sp * dt, y: S.head.y + Math.sin(S.ang) * sp * dt };
  if (S.head.x < 60 || S.head.x > W - 60 || S.head.y < 60 || S.head.y > H - 60) S.ang += 2.2 * dt;
  const last = S.trail[0];
  if (dist(last.x, last.y, S.head.x, S.head.y) >= 3) S.trail.unshift({ ...S.head });
  trimTrail();
}

/* ─────────────────────────────────────────────────────────
   INPUT
───────────────────────────────────────────────────────── */
function onKey(code, down) {
  if (!down || !S || S.dead) return;
  const d = KEYMAP[code]; if (!d) return;
  if (S.mode === 'classic') {
    const lastDir = S.queue.length ? S.queue[S.queue.length - 1] : S.dir;
    if (d === lastDir) return;
    if (S.queue.length < 3) S.queue.push(d);
  }
}
// swipe + pointer steering
let touchStart = null;
shell.canvas.addEventListener('pointerdown', e => {
  touchStart = { x: e.clientX, y: e.clientY };
  if (S && S.mode === 'free') S.pointer = shell.toLogical(e.clientX, e.clientY);
});
window.addEventListener('pointermove', e => {
  if (!S || S.mode !== 'free' || shell.state !== 'playing') return;
  if (e.pointerType === 'mouse' || touchStart) S.pointer = shell.toLogical(e.clientX, e.clientY);
  if (touchStart && e.pointerType !== 'mouse') e.preventDefault();
}, { passive: false });
window.addEventListener('pointerup', e => {
  if (touchStart && S && S.mode === 'classic' && shell.state === 'playing') {
    const dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 18) onKey(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp'), true);
  }
  if (S && S.mode === 'free' && e.pointerType !== 'mouse') S.pointer = null;
  touchStart = null;
});
// swipes anywhere on the stage (not just the canvas)
document.querySelector('.gs-stage').addEventListener('touchmove', e => { if (shell.state === 'playing') e.preventDefault(); }, { passive: false });

/* ─────────────────────────────────────────────────────────
   RENDER
───────────────────────────────────────────────────────── */
const bg = () => G.sprite('snake-bg', W * 2, H * 2, (c, w, h) => {
  c.scale(2, 2);
  const gr = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.75);
  gr.addColorStop(0, '#04140c'); gr.addColorStop(1, '#010604');
  c.fillStyle = gr; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(0,255,102,0.055)'; c.lineWidth = 1;
  for (let i = 0; i <= N; i++) { c.beginPath(); c.moveTo(i * T, 0); c.lineTo(i * T, H); c.stroke(); c.beginPath(); c.moveTo(0, i * T); c.lineTo(W, i * T); c.stroke(); }
  c.fillStyle = 'rgba(0,255,102,0.14)';
  for (let x = 0; x <= N; x++) for (let y = 0; y <= N; y++) c.fillRect(x * T - 1, y * T - 1, 2, 2);
});

function segColor(i, n, t) {
  const sk = shell.skin;
  if (S.rainbow > 0) return `hsl(${(t * 220 - i * 14) % 360},100%,62%)`;
  if (S.infected > 0 && Math.sin(t * 18) > -0.3) return i % 2 ? '#9dff00' : '#5bbf00';
  switch (sk.anim) {
    case 'rainbow': return `hsl(${(t * 90 + i * 12) % 360},100%,64%)`;
    case 'fire': return `hsl(${14 + Math.sin(t * 5 + i * 0.7) * 14},100%,${50 + Math.sin(t * 7 + i) * 8}%)`;
    case 'shimmer': return `hsl(${46 + Math.sin(t * 3 - i * 0.5) * 8},100%,${52 + Math.sin(t * 4 + i * 0.4) * 12}%)`;
    case 'void': return `hsl(${270 + Math.sin(t * 2.5 + i * 0.6) * 30},100%,62%)`;
    default: return sk.body;
  }
}

function drawSnake(c, pts, width, t, dirAng) {
  if (pts.length < 2) return;
  const sk = shell.skin;
  const glow = S.infected > 0 ? '#9dff00' : S.rainbow > 0 ? '#ffffff' : sk.glow;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  // glow passes (single path, cheap)
  c.beginPath(); c.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  c.globalAlpha = 0.10; c.strokeStyle = glow; c.lineWidth = width * 2.1; c.stroke();
  c.globalAlpha = 0.22; c.lineWidth = width * 1.35; c.stroke();
  c.globalAlpha = 1;
  // body core, per segment so animated skins shimmer along the length
  const n = pts.length;
  const uniform = !sk.anim && !(S.rainbow > 0) && !(S.infected > 0);
  if (uniform) { c.strokeStyle = sk.body; c.lineWidth = width; c.stroke(); }
  else for (let i = n - 1; i > 0; i--) {
    c.strokeStyle = segColor(i, n, t); c.lineWidth = width;
    c.beginPath(); c.moveTo(pts[i].x, pts[i].y); c.lineTo(pts[i - 1].x, pts[i - 1].y); c.stroke();
  }
  // inner highlight
  c.beginPath(); c.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  c.globalAlpha = 0.35; c.strokeStyle = '#ffffff'; c.lineWidth = width * 0.22; c.stroke(); c.globalAlpha = 1;
  // head
  const h = pts[0];
  c.drawImage(G.softGlow(glow, 40), h.x - 40, h.y - 40, 80, 80);
  c.fillStyle = S.infected > 0 ? '#e6ffd0' : sk.head;
  c.beginPath(); c.arc(h.x, h.y, width * 0.66, 0, Math.PI * 2); c.fill();
  // eyes
  const ex = Math.cos(dirAng), ey = Math.sin(dirAng), px = -ey, py = ex;
  c.fillStyle = '#04110a';
  for (const s of [-1, 1]) {
    c.beginPath(); c.arc(h.x + ex * width * 0.22 + px * s * width * 0.3, h.y + ey * width * 0.22 + py * s * width * 0.3, width * 0.13, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

function drawOrb(c, x, y, r, color, t, label) {
  const pulse = 1 + Math.sin(t * 6) * 0.08;
  c.drawImage(G.softGlow(color, 48), x - 48 * pulse, y - 48 * pulse, 96 * pulse, 96 * pulse);
  c.fillStyle = color; c.beginPath(); c.arc(x, y, r * pulse, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.35, r * 0.28, 0, Math.PI * 2); c.fill();
  if (label) { c.font = '900 11px Orbitron, monospace'; c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.fillText(label, x, y - r - 9); }
}

function render(c, alpha, t) {
  c.drawImage(bg(), 0, 0, W, H);
  if (!S) return;
  // border pulse when infected / boss
  if (S.boss && !S.boss.dying) { c.strokeStyle = `rgba(255,23,68,${0.35 + Math.sin(t * 8) * 0.2})`; c.lineWidth = 4; c.strokeRect(2, 2, W - 4, H - 4); }
  if (S.infected > 0) { c.fillStyle = `rgba(110,255,0,${0.04 + Math.sin(t * 10) * 0.02})`; c.fillRect(0, 0, W, H); }

  // food
  if (S.food) drawOrb(c, S.food.x, S.food.y, T * 0.3, '#ff2a6d', t + S.food.x);
  if (S.special) {
    const sp = S.special, def = SPECIALS[sp.type];
    const blink = sp.ttl < 2.5 && Math.sin(t * 20) < 0;
    if (!blink) drawOrb(c, sp.x, sp.y, T * 0.36, def.color, t * 1.5, def.label);
    // ttl ring
    c.strokeStyle = def.color; c.lineWidth = 2; c.globalAlpha = 0.6;
    c.beginPath(); c.arc(sp.x, sp.y, T * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (sp.ttl / def.ttl)); c.stroke(); c.globalAlpha = 1;
  }
  for (const m of S.minis) if (!(m.ttl < 1.5 && Math.sin(t * 20) < 0)) drawOrb(c, m.x, m.y, T * 0.2, '#ff7a00', t * 2 + m.x);

  // snake
  if (S.idle || S.mode === 'free') {
    if (!(S.dead && S.deadT > 0.05)) drawSnake(c, S.trail, 15, t, S.ang);
  } else if (!(S.dead && S.deadT > 0.05)) {
    const a = S.dead ? 1 : Math.min(1, S.tick / tickMs());
    const cur = S.cells, prev = S.prev, n = cur.length;
    const lerp = (p, q) => ({ x: ((p.x + (q.x - p.x) * a) + 0.5) * T, y: ((p.y + (q.y - p.y) * a) + 0.5) * T });
    const pts = [lerp(prev[0], cur[0])];
    for (let i = 1; i < n; i++) pts.push(cellPx(cur[i]));
    pts.push(lerp(prev[n - 1] || cur[n - 1], cur[n - 1]));
    const [dx, dy] = DIRS[S.dir];
    drawSnake(c, pts, T * 0.58, t, Math.atan2(dy, dx));
  }

  // boss
  if (S.boss) {
    const b = S.boss;
    const sc = b.dying ? 1 + (1 - b.dying) * 1.5 : b.spawnT > 0 ? 1 - b.spawnT / 1.4 : 1;
    c.save(); c.globalAlpha = b.dying ? Math.max(0, b.dying) : b.spawnT > 0 ? 0.5 + Math.sin(t * 30) * 0.3 : 1;
    const col = b.hitT > 0 ? '#ffffff' : b.phase === 3 ? '#ff00aa' : '#ff1744';
    c.drawImage(G.softGlow(col, 80), b.x - 80 * sc, b.y - 80 * sc, 160 * sc, 160 * sc);
    c.translate(b.x, b.y); c.rotate(t * (1 + b.phase));
    c.strokeStyle = col; c.lineWidth = 3;
    for (let k = 0; k < 2; k++) { c.rotate(Math.PI / 4); c.strokeRect(-b.r * sc, -b.r * sc, b.r * 2 * sc, b.r * 2 * sc); }
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, b.r * 0.5 * sc, 0, Math.PI * 2); c.fill();
    c.restore();
    if (!b.dying) { // hp bar
      const w = 220, x0 = W / 2 - w / 2;
      c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(x0, 14, w, 6);
      c.fillStyle = '#ff1744'; c.fillRect(x0, 14, w * (b.hp / b.max), 6);
      c.font = '700 10px Orbitron, monospace'; c.textAlign = 'center'; c.fillStyle = '#ff6d8a'; c.fillText('GRID WARDEN', W / 2, 34);
    }
  }

  shell.particles.draw(c);
  shell.floaters.draw(c);

  // status line
  if (!S.idle && !S.dead) {
    const tags = [];
    if (S.x2 > 0) tags.push(['×2 ' + S.x2.toFixed(1), '#00b3ff']);
    if (S.infected > 0) tags.push(['INFECTED ' + S.infected.toFixed(1), '#9dff00']);
    if (S.rainbow > 0) tags.push(['PRISM MODE', '#ff00ff']);
    if (S.combo >= 2 && S.comboT > 0) tags.push([`COMBO ×${S.combo}`, '#ffd700']);
    c.font = '700 11px Orbitron, monospace'; c.textAlign = 'left';
    tags.forEach((tg, i) => { c.fillStyle = tg[1]; c.fillText(tg[0], 12, H - 14 - i * 16); });
    if (S.comboT > 0 && S.combo >= 2) { c.fillStyle = 'rgba(255,215,0,0.6)'; c.fillRect(12, H - 8, 110 * (S.comboT / 4.5), 3); }
    if (S.t < 2.2 && S.apples === 0) {
      c.globalAlpha = Math.min(1, 2.2 - S.t); c.font = '900 22px Orbitron, monospace'; c.textAlign = 'center'; c.fillStyle = shell.game.color;
      c.fillText(S.mode === 'free' ? 'STEER WITH ← → OR MOUSE' : 'GO!', W / 2, H * 0.3); c.globalAlpha = 1;
    }
  }
}
})();
