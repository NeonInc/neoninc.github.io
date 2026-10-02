/* ============================================================
   NEON BREAKER™  ·  Neon Arcade edition
   Brick breaker with multi-hit, steel and explosive bricks,
   power-ups (wide, multi-ball, laser, slow, catch, life),
   combo scoring and endless procedurally built levels.
   © 2026 Neon Inc™
   ============================================================ */
(function () {
'use strict';
const A = window.Arcade, G = A.gfx;
const W = 640, H = 720;
const COLS = 12, BW = 48, BH = 20, GAP = 4, X0 = (W - (COLS * BW + (COLS - 1) * GAP)) / 2, Y0 = 84;
const PY = H - 56, PH = 14, BR = 7;
const ROW_COLORS = ['#ff2a6d', '#ff8a00', '#ffd700', '#00ff66', '#00f0ff', '#2f6bff', '#c04bff', '#ff4fd8'];
const POWERS = {
  wide:  { label: 'W', color: '#00f0ff', name: 'WIDE' },
  multi: { label: 'M', color: '#ff00ff', name: 'MULTI-BALL' },
  laser: { label: 'L', color: '#ff2a6d', name: 'LASER' },
  slow:  { label: 'S', color: '#00ff66', name: 'SLOW' },
  catch: { label: 'C', color: '#ffd700', name: 'CATCH' },
  life:  { label: '♥', color: '#ff4fd8', name: '+1 LIFE' },
};
// Level maps: . empty, 1-3 hp, # steel, * explosive, P power brick
const LEVELS = [
  ['............', '.1111111111.', '.1111111111.', '.1111111111.', '.1111111111.', '............', '.1111111111.'],
  ['11..1111..11', '11..1111..11', '222222222222', '1....11....1', '1.P..11..P.1', '111111111111'],
  ['.....22.....', '....2112....', '...211112...', '..21111112..', '.2111**1112.', '..21111112..', '...211112...', '....2112....', '.....22.....'],
  ['#..........#', '1#22222222#1', '11#111111#11', '111#1PP1#111', '1111#11#1111', '11111##11111'],
  ['333333333333', '1.1.1.1.1.1.', '.2.2.2.2.2.2', '1.1.1.1.1.1.', '.*.*.*.*.*.*', '1P1.1.1.1P1.'],
  ['..11....11..', '.1221..1221.', '123321123321', '123321123321', '.1221..1221.', '..11....11..', '............', '##........##'],
  ['P1111111111P', '1##########1', '1#22222222#1', '1#2*3333*2#1', '1#22222222#1', '1####..####1', '111111111111'],
  ['*1*1*1*1*1*1', '1*1*1*1*1*1*', '222222222222', '333333333333', '1.1.1.1.1.1.', '.P........P.'],
  ['3..3..3..3..', '.3..3..3..3.', '..3..3..3..3', '3..3..3..3..', '.*..*..*..*.', '222222222222', '111111111111'],
  ['############', '#3333333333#', '#3*2222222*3', '#3211PP1123#', '#3222..2223#', '#33333333.3#', '.1111111111.'],
];

let S = null;
const shell = GameShell.create({
  id: 'breaker', width: W, height: H, music: 'breaker',
  modes: [{ id: 'normal', name: 'ARCADE', desc: 'Three lives, endless levels.' }],
  hud: [{ id: 'score', label: 'SCORE', main: true }, { id: 'level', label: 'LEVEL' }, { id: 'lives', label: 'LIVES', init: '♥♥♥', opt: true }],
  controls: [['MOUSE / ← →', 'Move paddle'], ['SPACE / CLICK', 'Launch'], ['DRAG', 'Touch move'], ['P', 'Pause']],
  onStart, update, render, onKey,
  onMenu() { S = baseState(true); buildLevel(1); S.balls.push(newBall(true)); },
});

/* ─────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────── */
function baseState(demo = false) {
  return {
    demo, level: 1, score: 0, lives: 3, bricks: [], balls: [], caps: [], shots: [],
    px: W / 2, pw: 112, targetX: W / 2, pv: 0,
    wide: 0, laser: 0, slow: 0, catch: 0, laserT: 0,
    combo: 0, maxCombo: 0, broken: 0, powerups: 0, maxBalls: 1, flawless: false, lostThisLevel: false,
    t: 0, banner: 0, bannerText: '', dead: false, deadT: 0, clearT: 0, trails: [],
  };
}
function onStart() {
  S = baseState(false); buildLevel(1); S.balls.push(newBall(true));
  shell.setHud('score', 0); shell.setHud('level', 1); shell.setHud('lives', '♥♥♥');
}
function newBall(stuck, x, y, vx, vy) {
  return { x: x ?? S.px, y: y ?? PY - BR - 1, vx: vx || 0, vy: vy || 0, stuck, off: 0, trail: [] };
}
function genLevel(n) {
  // symmetric procedural layout for levels past the handcrafted set
  const rng = A.util.seededRNG(n * 7919);
  const rows = 6 + Math.min(4, Math.floor(n / 4));
  const half = COLS / 2, out = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < half; c++) {
      const v = rng();
      const hp = Math.min(3, 1 + Math.floor(rng() * (1 + n / 8)));
      line += v < 0.12 ? '.' : v < 0.17 && n > 12 ? '#' : v < 0.22 ? '*' : v < 0.25 ? 'P' : String(hp);
    }
    out.push(line + line.split('').reverse().join(''));
  }
  return out;
}
function buildLevel(n) {
  S.level = n; S.bricks = []; S.caps = []; S.shots = []; S.lostThisLevel = false;
  const map = n <= LEVELS.length ? LEVELS[n - 1] : genLevel(n);
  map.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === '.') return;
    const b = { x: X0 + c * (BW + GAP), y: Y0 + r * (BH + GAP), r, c, hp: 1, max: 1, type: 'normal', color: ROW_COLORS[r % ROW_COLORS.length], hitT: 0 };
    if (ch === '#') { b.type = 'steel'; b.hp = Infinity; b.color = '#9aa7c7'; }
    else if (ch === '*') { b.type = 'bomb'; b.color = '#ff6a00'; }
    else if (ch === 'P') { b.type = 'power'; b.color = '#ffffff'; }
    else { b.hp = b.max = parseInt(ch, 10) + (n > 10 ? Math.floor((n - 10) / 6) : 0); b.hp = b.max = Math.min(b.hp, 4); }
    S.bricks.push(b);
  }));
  S.banner = 2; S.bannerText = `LEVEL ${n}`;
  if (!S.demo) { shell.setHud('level', n); }
}
const baseSpeed = () => Math.min(700, 400 + (S.level - 1) * 18 + Math.min(120, S.t * 0.8));
const paddleW = () => (S.wide > 0 ? 176 : 112);

/* ─────────────────────────────────────────────────────────
   INPUT
───────────────────────────────────────────────────────── */
function launch() {
  for (const b of S.balls) if (b.stuck) {
    const a = -Math.PI / 2 + Math.max(-0.9, Math.min(0.9, b.off / (paddleW() / 2) * 0.9)) + (b.off === 0 ? (Math.random() - 0.5) * 0.3 : 0);
    const sp = baseSpeed();
    b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.stuck = false;
    shell.tone(520, 0.08, 'square', 0.1, 820);
  }
}
function onKey(code, down, e) {
  if (!down || e.repeat) return;
  if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') launch();
}
let usingPointer = false;
const stage = document.querySelector('.gs-stage');
stage.addEventListener('pointermove', e => { if (!S || S.demo || shell.state !== 'playing') return; usingPointer = true; S.targetX = shell.toLogical(e.clientX, e.clientY).x; });
stage.addEventListener('pointerdown', e => {
  if (e.target.closest('button,a,.gs-ov.show') || !S || S.demo || shell.state !== 'playing') return;
  usingPointer = true; S.targetX = shell.toLogical(e.clientX, e.clientY).x;
  if (e.pointerType === 'mouse') launch(); else S.touchDown = performance.now();
});
stage.addEventListener('pointerup', e => { if (S && S.touchDown && performance.now() - S.touchDown < 250) launch(); if (S) S.touchDown = 0; });
stage.addEventListener('touchmove', e => { if (shell.state === 'playing') e.preventDefault(); }, { passive: false });

/* ─────────────────────────────────────────────────────────
   UPDATE
───────────────────────────────────────────────────────── */
function update(dt) {
  if (!S) { S = baseState(true); buildLevel(1); S.balls.push(newBall(true)); }
  for (const b of S.bricks) if (b.hitT > 0) b.hitT -= dt;
  if (S.banner > 0) S.banner -= dt;
  if (S.demo) return demoUpdate(dt);
  if (S.dead) { S.deadT += dt; return; }
  if (shell.state !== 'playing') return;
  S.t += dt;
  ['wide', 'laser', 'slow', 'catch'].forEach(k => { if (S[k] > 0) S[k] = Math.max(0, S[k] - dt); });

  // paddle
  const keyDir = (shell.keys.has('ArrowLeft') || shell.keys.has('KeyA') ? -1 : 0) + (shell.keys.has('ArrowRight') || shell.keys.has('KeyD') ? 1 : 0);
  if (keyDir) { usingPointer = false; S.pv += keyDir * 5200 * dt; S.pv = Math.max(-820, Math.min(820, S.pv)); S.targetX = S.px + S.pv * dt; }
  else S.pv *= Math.exp(-dt * 18);
  const prevX = S.px;
  S.pw += (paddleW() - S.pw) * Math.min(1, dt * 10);
  S.px += (S.targetX - S.px) * Math.min(1, dt * (usingPointer ? 28 : 60));
  S.px = Math.max(S.pw / 2 + 4, Math.min(W - S.pw / 2 - 4, S.px));
  S.targetX = Math.max(S.pw / 2 + 4, Math.min(W - S.pw / 2 - 4, S.targetX));
  const pVel = (S.px - prevX) / dt;

  // lasers
  if (S.laser > 0) { S.laserT -= dt; if (S.laserT <= 0) { S.laserT = 0.32; S.shots.push({ x: S.px - S.pw / 2 + 10, y: PY - 6 }, { x: S.px + S.pw / 2 - 10, y: PY - 6 }); shell.tone(1200, 0.05, 'square', 0.05, 600); } }
  for (let i = S.shots.length - 1; i >= 0; i--) {
    const s = S.shots[i]; s.y -= 900 * dt;
    let hit = s.y < 0;
    for (const b of S.bricks) if (!hit && s.x > b.x && s.x < b.x + BW && s.y > b.y && s.y < b.y + BH) { hitBrick(b, null); hit = true; }
    if (hit) S.shots.splice(i, 1);
  }

  // balls (sub-stepped so fast balls never tunnel)
  const slowK = S.slow > 0 ? 0.68 : 1;
  for (let bi = S.balls.length - 1; bi >= 0; bi--) {
    const b = S.balls[bi];
    if (b.stuck) { b.x = S.px + b.off; b.y = PY - BR - 1; continue; }
    // keep speed on target
    const sp = Math.hypot(b.vx, b.vy), want = baseSpeed() * slowK;
    if (Math.abs(sp - want) > 1) { const k = 1 + (want / sp - 1) * Math.min(1, dt * 3); b.vx *= k; b.vy *= k; }
    const steps = Math.ceil(Math.hypot(b.vx, b.vy) * dt / (BR * 0.8));
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      b.x += b.vx * sdt; b.y += b.vy * sdt;
      if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx); wallTick(); }
      if (b.x > W - BR) { b.x = W - BR; b.vx = -Math.abs(b.vx); wallTick(); }
      if (b.y < BR) { b.y = BR; b.vy = Math.abs(b.vy); wallTick(); }
      // paddle
      if (b.vy > 0 && b.y + BR >= PY - PH / 2 && b.y - BR <= PY + PH / 2 && b.x > S.px - S.pw / 2 - BR && b.x < S.px + S.pw / 2 + BR) {
        const off = (b.x - S.px) / (S.pw / 2);
        const ang = -Math.PI / 2 + Math.max(-1, Math.min(1, off)) * 1.05 + Math.max(-0.15, Math.min(0.15, pVel / 4000));
        const spd = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(ang) * spd; b.vy = Math.sin(ang) * spd;
        b.y = PY - PH / 2 - BR - 0.5;
        S.combo = 0;
        shell.tone(300 + Math.abs(off) * 200, 0.06, 'square', 0.1);
        shell.particles.emit(b.x, PY - PH / 2, { n: 6, color: shell.skin.glow, speed: 120, angle: -Math.PI / 2, spread: 1.6, life: 0.3, size: 2 });
        if (S.catch > 0) { b.stuck = true; b.off = b.x - S.px; break; }
      }
      // bricks
      for (const br of S.bricks) {
        if (b.x + BR < br.x || b.x - BR > br.x + BW || b.y + BR < br.y || b.y - BR > br.y + BH) continue;
        const cx = Math.max(br.x, Math.min(b.x, br.x + BW)), cy = Math.max(br.y, Math.min(b.y, br.y + BH));
        const dx = b.x - cx, dy = b.y - cy;
        if (dx * dx + dy * dy > BR * BR) continue;
        // resolve along the shallowest axis
        const penX = Math.min(b.x + BR - br.x, br.x + BW - (b.x - BR));
        const penY = Math.min(b.y + BR - br.y, br.y + BH - (b.y - BR));
        if (penX < penY) { b.vx = b.x < br.x + BW / 2 ? -Math.abs(b.vx) : Math.abs(b.vx); b.x += b.vx > 0 ? penX : -penX; }
        else { b.vy = b.y < br.y + BH / 2 ? -Math.abs(b.vy) : Math.abs(b.vy); b.y += b.vy > 0 ? penY : -penY; }
        hitBrick(br, b);
        break;
      }
      // never let the ball go too flat
      const spd = Math.hypot(b.vx, b.vy);
      if (Math.abs(b.vy) < spd * 0.22) { b.vy = Math.sign(b.vy || -1) * spd * 0.22; b.vx = Math.sign(b.vx) * Math.sqrt(spd * spd - b.vy * b.vy); }
    }
    b.trail.unshift({ x: b.x, y: b.y }); if (b.trail.length > 10) b.trail.pop();
    if (b.y - BR > H) { S.balls.splice(bi, 1); }
  }
  if (!S.balls.length) loseLife();

  // capsules
  for (let i = S.caps.length - 1; i >= 0; i--) {
    const c = S.caps[i]; c.y += 170 * dt; c.rot += dt * 3;
    if (c.y > PY - PH && c.y < PY + PH && Math.abs(c.x - S.px) < S.pw / 2 + 14) { applyPower(c.type); S.caps.splice(i, 1); continue; }
    if (c.y > H + 20) S.caps.splice(i, 1);
  }
  // level clear
  if (!S.clearT && !S.bricks.some(b => b.type !== 'steel')) {
    S.clearT = 1.4;
    if (!S.lostThisLevel) { S.flawless = true; shell.floaters.add(W / 2, H * 0.5, 'FLAWLESS +1000', '#ffd700', 24, 1.6); addScore(1000); }
    shell.sfx('levelup'); shell.flash('#ffffff', 0.3);
  }
  if (S.clearT) {
    S.clearT -= dt;
    if (S.clearT <= 0) { S.clearT = 0; buildLevel(S.level + 1); S.balls = [newBall(true)]; S.wide = S.laser = S.catch = S.slow = 0; addScore(500 * (S.level - 1)); }
  }
}
function wallTick() { shell.tone(220, 0.03, 'square', 0.04); }

function addScore(n) { S.score += Math.round(n); shell.setHud('score', S.score, true); }
function hitBrick(br, ball) {
  br.hitT = 0.12;
  if (br.type === 'steel') { shell.tone(1400, 0.05, 'triangle', 0.07); return; }
  br.hp--;
  S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
  const mult = 1 + Math.min(2, (S.combo - 1) * 0.1);
  addScore(10 * mult);
  if (br.hp > 0) { shell.tone(500 + br.hp * 120, 0.05, 'square', 0.08); return; }
  destroyBrick(br, mult);
}
function destroyBrick(br, mult = 1) {
  const i = S.bricks.indexOf(br); if (i < 0) return;
  S.bricks.splice(i, 1); S.broken++;
  const pts = Math.round((40 + br.max * 20) * mult);
  addScore(pts);
  if (S.combo >= 4) shell.floaters.add(br.x + BW / 2, br.y, `+${pts} ×${S.combo}`, '#ffd700', 15);
  shell.particles.emit(br.x + BW / 2, br.y + BH / 2, { n: 12, color: [br.color, '#ffffff'], speed: 200, life: 0.55, size: 2.6, gravity: 300 });
  shell.sfx('combo', Math.min(S.combo, 14));
  if (br.type === 'bomb') {
    shell.sfx('explode'); shell.shake(8); shell.flash('#ff6a00', 0.18);
    shell.particles.emit(br.x + BW / 2, br.y + BH / 2, { n: 34, color: ['#ff6a00', '#ffd700', '#ffffff'], speed: 340, life: 0.7, size: 3 });
    const around = S.bricks.filter(o => o !== br && Math.abs(o.r - br.r) <= 1 && Math.abs(o.c - br.c) <= 1 && o.type !== 'steel');
    setTimeout(() => around.forEach(o => { if (S.bricks.includes(o)) { o.hp = 0; destroyBrick(o, mult); } }), 60);
  }
  const chance = br.type === 'power' ? 1 : 0.13;
  if (Math.random() < chance) {
    const pool = ['wide', 'wide', 'multi', 'multi', 'laser', 'slow', 'catch', 'catch', 'life'];
    let type = pool[Math.floor(Math.random() * pool.length)];
    if (type === 'life' && Math.random() < 0.6) type = 'multi';
    S.caps.push({ x: br.x + BW / 2, y: br.y + BH / 2, type, rot: 0 });
  }
}
function applyPower(type) {
  const p = POWERS[type];
  S.powerups++;
  shell.floaters.add(S.px, PY - 30, p.name, p.color, 18);
  shell.sfx('power'); shell.flash(p.color, 0.12);
  if (type === 'wide') S.wide = 14;
  if (type === 'laser') { S.laser = 10; S.laserT = 0; }
  if (type === 'slow') S.slow = 9;
  if (type === 'catch') S.catch = 14;
  if (type === 'life') { S.lives = Math.min(6, S.lives + 1); shell.setHud('lives', '♥'.repeat(S.lives)); }
  if (type === 'multi') {
    const src = S.balls.filter(b => !b.stuck).slice(0, 3);
    if (!src.length) { launch(); src.push(...S.balls); }
    for (const b of src) for (const da of [-0.45, 0.45]) {
      const sp = Math.hypot(b.vx, b.vy) || baseSpeed(), a = Math.atan2(b.vy || -1, b.vx) + da;
      if (S.balls.length < 12) S.balls.push(newBall(false, b.x, b.y, Math.cos(a) * sp, Math.sin(a) * sp));
    }
    S.maxBalls = Math.max(S.maxBalls, S.balls.length);
  }
}
function loseLife() {
  if (S.dead) return;
  S.lives--; S.lostThisLevel = true; S.combo = 0;
  S.wide = S.laser = S.catch = S.slow = 0; S.caps = [];
  shell.setHud('lives', S.lives > 0 ? '♥'.repeat(S.lives) : '—');
  shell.shake(10); shell.flash('#ff2a6d', 0.35);
  if (S.lives <= 0) {
    S.dead = true; S.deadT = 0; shell.sfx('explode'); shell.sfx('gameover');
    shell.gameOver(
      { score: S.score, level: S.level, bricks: S.broken, powerups: S.powerups, maxBalls: S.maxBalls, maxCombo: S.maxCombo, flawless: S.flawless },
      [['LEVEL', S.level], ['BRICKS', S.broken], ['MAX COMBO', '×' + S.maxCombo], ['POWER-UPS', S.powerups]], 1000);
  } else { shell.sfx('error'); S.balls = [newBall(true)]; }
}

function demoUpdate(dt) {
  S.t += dt;
  const b = S.balls[0];
  if (b.stuck) { b.stuck = false; b.vx = 230; b.vy = -320; }
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < BR || b.x > W - BR) b.vx *= -1;
  if (b.y < BR) b.vy = Math.abs(b.vy);
  if (b.y > PY - PH / 2 - BR && b.vy > 0) { b.vy = -Math.abs(b.vy); }
  S.px += (b.x - S.px) * Math.min(1, dt * 8);
  b.trail.unshift({ x: b.x, y: b.y }); if (b.trail.length > 10) b.trail.pop();
  for (const br of S.bricks) if (b.x > br.x - BR && b.x < br.x + BW + BR && b.y > br.y - BR && b.y < br.y + BH + BR) { br.hitT = 0.15; b.vy *= -1; b.y += b.vy * dt * 2; break; }
}

/* ─────────────────────────────────────────────────────────
   RENDER
───────────────────────────────────────────────────────── */
const bgSprite = () => G.sprite('breaker-bg', W * 2, H * 2, c => {
  c.scale(2, 2);
  const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0c0218'); gr.addColorStop(1, '#030108');
  c.fillStyle = gr; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(255,42,109,0.05)'; c.lineWidth = 1;
  for (let i = -H; i < W; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + H, H); c.stroke(); }
  const vg = c.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, H * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
});
function brickSprite(color, type, hp, max) {
  return G.sprite(`brk|${color}|${type}|${hp}|${max}`, BW * 2, BH * 2, c => {
    c.scale(2, 2);
    if (type === 'steel') {
      const gr = c.createLinearGradient(0, 0, 0, BH); gr.addColorStop(0, '#d7def0'); gr.addColorStop(0.5, '#7f8aa8'); gr.addColorStop(1, '#4b5470');
      c.fillStyle = gr; c.beginPath(); c.roundRect(0.5, 0.5, BW - 1, BH - 1, 3); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.35)'; [6, BW - 6].forEach(x => { c.beginPath(); c.arc(x, BH / 2, 2, 0, Math.PI * 2); c.fill(); });
      return;
    }
    const k = type === 'normal' && max > 1 ? 0.45 + 0.55 * (hp / max) : 1;
    const gr = c.createLinearGradient(0, 0, 0, BH);
    gr.addColorStop(0, G.mixHex(color, '#ffffff', 0.4 * k)); gr.addColorStop(1, G.mixHex(color, '#000000', 0.45));
    c.globalAlpha = 0.35 + 0.65 * k;
    c.fillStyle = gr; c.beginPath(); c.roundRect(0.5, 0.5, BW - 1, BH - 1, 4); c.fill();
    c.globalAlpha = 1;
    c.strokeStyle = color; c.lineWidth = 1.2; c.beginPath(); c.roundRect(1, 1, BW - 2, BH - 2, 4); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(4, 3, BW - 8, 2);
    if (type === 'bomb') { c.fillStyle = '#1a0500'; c.font = '900 12px Orbitron, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✸', BW / 2, BH / 2 + 1); }
    if (type === 'power') { const g2 = c.createLinearGradient(0, 0, BW, 0); ['#ff2a6d', '#ffd700', '#00ff66', '#00f0ff', '#c04bff'].forEach((cc, i) => g2.addColorStop(i / 4, cc)); c.fillStyle = g2; c.globalAlpha = 0.8; c.fillRect(2, 2, BW - 4, BH - 4); c.globalAlpha = 1; c.fillStyle = '#fff'; c.font = '900 11px Orbitron, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', BW / 2, BH / 2 + 1); }
    if (type === 'normal' && max > 1 && hp < max) { c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(BW * 0.3, 2); c.lineTo(BW * 0.42, BH * 0.55); c.lineTo(BW * 0.36, BH - 2); if (hp < max - 1) { c.moveTo(BW * 0.7, 2); c.lineTo(BW * 0.6, BH * 0.5); c.lineTo(BW * 0.68, BH - 2); } c.stroke(); }
  });
}
function render(c, alpha, t) {
  if (!S) return;
  c.drawImage(bgSprite(), 0, 0, W, H);
  const sk = shell.skin;
  const rainbow = sk.anim === 'rainbow';
  const pc = rainbow ? `hsl(${(t * 120) % 360},100%,62%)` : sk.paddle;

  // bricks
  for (const b of S.bricks) {
    if (b.type !== 'steel') c.drawImage(G.softGlow(b.color, 30), b.x - 6, b.y - 10, BW + 12, BH + 20);
  }
  for (const b of S.bricks) {
    c.drawImage(brickSprite(b.color, b.type, b.hp, b.max), b.x, b.y, BW, BH);
    if (b.hitT > 0) { c.fillStyle = `rgba(255,255,255,${b.hitT * 5})`; c.fillRect(b.x, b.y, BW, BH); }
  }
  // capsules
  for (const cp of S.caps) {
    const p = POWERS[cp.type];
    c.drawImage(G.softGlow(p.color, 30), cp.x - 30, cp.y - 30, 60, 60);
    c.save(); c.translate(cp.x, cp.y);
    c.fillStyle = G.hexA(p.color, 0.25); c.strokeStyle = p.color; c.lineWidth = 2;
    c.beginPath(); c.roundRect(-17, -9, 34, 18, 9); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.font = '900 12px Orbitron, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.label, 0, 1);
    c.restore();
  }
  // lasers
  c.fillStyle = '#ff2a6d';
  for (const s of S.shots) { c.drawImage(G.glowDot('#ff2a6d', 10), s.x - 10, s.y - 4, 20, 20); c.fillRect(s.x - 1.5, s.y, 3, 14); }
  // paddle
  const px = S.px - S.pw / 2;
  c.drawImage(G.softGlow(pc.startsWith('#') ? pc : sk.glow, 60), S.px - S.pw / 2 - 30, PY - 40, S.pw + 60, 80);
  c.fillStyle = pc; c.beginPath(); c.roundRect(px, PY - PH / 2, S.pw, PH, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(px + 8, PY - PH / 2 + 2, S.pw - 16, 2);
  if (S.laser > 0) { c.fillStyle = '#ff2a6d'; c.fillRect(px + 6, PY - PH / 2 - 8, 6, 10); c.fillRect(px + S.pw - 12, PY - PH / 2 - 8, 6, 10); }
  if (S.catch > 0) { c.strokeStyle = '#ffd700'; c.lineWidth = 1.5; c.setLineDash([4, 4]); c.beginPath(); c.roundRect(px - 3, PY - PH / 2 - 3, S.pw + 6, PH + 6, 9); c.stroke(); c.setLineDash([]); }
  // balls
  for (const b of S.balls) {
    for (let i = b.trail.length - 1; i > 0; i--) { const p = b.trail[i]; c.globalAlpha = (1 - i / b.trail.length) * 0.35; c.drawImage(G.glowDot(sk.glow, 14), p.x - BR * 1.4, p.y - BR * 1.4, BR * 2.8, BR * 2.8); }
    c.globalAlpha = 1;
    c.drawImage(G.glowDot(sk.glow, 24), b.x - 24, b.y - 24, 48, 48);
    c.fillStyle = sk.ball; c.beginPath(); c.arc(b.x, b.y, BR, 0, Math.PI * 2); c.fill();
    if (b.stuck && !S.demo) { // aim guide
      const a = -Math.PI / 2 + Math.max(-0.9, Math.min(0.9, b.off / (S.pw / 2) * 0.9));
      c.strokeStyle = G.hexA(sk.glow, 0.5); c.setLineDash([5, 7]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x + Math.cos(a) * 110, b.y + Math.sin(a) * 110); c.stroke(); c.setLineDash([]);
    }
  }
  shell.particles.draw(c);
  shell.floaters.draw(c);
  // active power timers
  const act = [['wide', 14], ['laser', 10], ['slow', 9], ['catch', 14]].filter(([k]) => S[k] > 0);
  act.forEach(([k, max], i) => {
    const p = POWERS[k], x = 14 + i * 74, y = H - 20;
    c.fillStyle = G.hexA(p.color, 0.2); c.fillRect(x, y, 64, 6); c.fillStyle = p.color; c.fillRect(x, y, 64 * S[k] / max, 6);
    c.font = '700 9px Orbitron, monospace'; c.textAlign = 'left'; c.fillText(p.name, x, y - 5);
  });
  // banner / launch hint
  if (!S.demo && S.banner > 0) {
    c.globalAlpha = Math.min(1, S.banner); c.textAlign = 'center'; c.font = '900 34px Orbitron, monospace'; c.fillStyle = '#ff2a6d';
    c.fillText(S.bannerText, W / 2, H * 0.55); c.globalAlpha = 1;
  }
  if (!S.demo && S.balls.some(b => b.stuck) && !S.dead && S.banner <= 0.5) {
    c.textAlign = 'center'; c.font = '700 13px Orbitron, monospace'; c.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 4) * 0.3})`;
    c.fillText('SPACE / CLICK / TAP TO LAUNCH', W / 2, PY - 90);
  }
  if (S.clearT > 0) { c.textAlign = 'center'; c.font = '900 30px Orbitron, monospace'; c.fillStyle = '#ffd700'; c.fillText('LEVEL CLEAR', W / 2, H * 0.5); }
}
})();
