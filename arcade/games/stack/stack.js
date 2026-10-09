/* ============================================================
   NEON STACK™  ·  Neon Arcade edition
   Falling-block puzzler: SRS rotation + wall kicks, 7-bag,
   hold, ghost, 5-piece preview, lock delay, DAS/ARR, T-spins,
   back-to-back, combos, all-clears.
   Modes: Marathon · Sprint 40 · Ultra 2:00
   © 2026 Neon Inc™
   ============================================================ */
(function () {
'use strict';
const A = window.Arcade, G = A.gfx;
const COLS = 10, ROWS = 20, HIDDEN = 2, CS = 30;
// Two layouts: side panels on wide screens, a tall board with a slim column on phones
const PORTRAIT = window.matchMedia && matchMedia('(max-aspect-ratio: 4/5)').matches;
const W = PORTRAIT ? 432 : 600, H = PORTRAIT ? 640 : 660, BX = PORTRAIT ? 10 : 150, BY = PORTRAIT ? 20 : 24;
const SX = PORTRAIT ? 322 : 16, SW = PORTRAIT ? 100 : 118; // side column (hold + stats)
const L = PORTRAIT
  ? { hold: [SX, BY, SW, 84, 52, 16], next: [SX, BY + 94, SW, 296, 48, 50, 16, 13], stats: [SX, BY + 400, SW, 200], rowGap: 40, val: 15, ix: SX }
  : { hold: [16, BY, 118, 96, 58, 20], next: [BX + 300 + 16, BY, 118, 380, 62, 68, 22, 17], stats: [16, BY + 112, 118, 220], rowGap: 45, val: 18, ix: BX + 300 + 16 };
const DAS = 0.135, ARR = 0.032, SOFT = 0.028, LOCK = 0.5, MAX_RESETS = 15;
const ORDER = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const SHAPES = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};
// SRS kick data (y up in the spec → we negate y because our rows grow downward)
const KICKS = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],     '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],    '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const KICKS_I = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};
const MODES = [
  { id: 'marathon', name: 'MARATHON', desc: 'Endless. Level up every 10 lines.' },
  { id: 'sprint',   name: 'SPRINT 40', desc: 'Clear 40 lines as fast as you can.' },
  { id: 'ultra',    name: 'ULTRA 2:00', desc: 'Score as much as possible in two minutes.' },
];
const CLEAR_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'];

let S = null, lastSprintMs = 0;
const shell = GameShell.create({
  id: 'stack', width: W, height: H, music: 'stack', modes: MODES,
  hud: [{ id: 'score', label: 'SCORE', main: true }, { id: 'lines', label: 'LINES' }, { id: 'level', label: 'LEVEL', opt: true }],
  controls: [['← →', 'Move'], ['↓', 'Soft drop'], ['SPACE', 'Hard drop'], ['↑ / X', 'Rotate'], ['Z', 'Rotate back'], ['C / SHIFT', 'Hold'], ['P', 'Pause']],
  touch: {
    left: [{ key: 'ArrowLeft', label: '◀' }, { key: 'ArrowDown', label: '▼' }, { key: 'ArrowRight', label: '▶' }],
    right: [{ key: 'KeyX', label: '⟳' }, { key: 'KeyC', label: 'HOLD', sub: '' }, { key: 'Space', label: '⤓' }],
  },
  formatScore: (score, res) => res && res.mode === 'sprint' && S && S.sprintDone ? A.util.fmtTime(lastSprintMs) : A.util.fmt(score),
  overTitle: res => res.mode === 'sprint' ? (S && S.sprintDone ? 'SPRINT COMPLETE' : 'TOPPED OUT') : res.mode === 'ultra' ? (S && S.ultraDone ? 'TIME!' : 'TOPPED OUT') : 'GAME OVER',
  modeBest: (rec, mode) => mode === 'sprint' ? (rec.mins.sprintMs ? A.util.fmtTime(rec.mins.sprintMs) : '') : (rec.bests[mode] ? A.util.fmt(rec.bests[mode]) : ''),
  onStart, update, render, onKey,
  onMenu() { S = demoState(); },
});

/* ─────────────────────────────────────────────────────────
   PIECES
───────────────────────────────────────────────────────── */
function rotateCells(type, rot) {
  // rotate around the piece's SRS box centre
  const size = type === 'I' ? 4 : type === 'O' ? 4 : 3;
  let cells = SHAPES[type].map(c => [...c]);
  if (type === 'O') return cells;
  for (let r = 0; r < rot; r++) cells = cells.map(([x, y]) => [size - 1 - y, x]);
  return cells;
}
const CELLS = {}; ORDER.forEach(t => { CELLS[t] = [0, 1, 2, 3].map(r => rotateCells(t, r)); });
const colorOf = type => (shell.skin.pieces || [])[ORDER.indexOf(type)] || '#ffffff';

function newBoard() { return Array.from({ length: ROWS + HIDDEN }, () => Array(COLS).fill(null)); }
function bagRefill() {
  const b = [...ORDER];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  S.queue.push(...b);
}
function collides(type, rot, x, y) {
  for (const [cx, cy] of CELLS[type][rot]) {
    const bx = x + cx, by = y + cy;
    if (bx < 0 || bx >= COLS || by >= ROWS + HIDDEN) return true;
    if (by >= 0 && S.board[by][bx]) return true;
  }
  return false;
}
function spawn(type) {
  if (!type) { if (S.queue.length < 7) bagRefill(); type = S.queue.shift(); }
  const p = { type, rot: 0, x: type === 'O' ? 3 : 3, y: HIDDEN - 1 + (type === 'I' ? -1 : 0), lockT: 0, resets: 0, lowest: 0, lastRot: false, kick: 0 };
  p.lowest = p.y;
  if (collides(p.type, p.rot, p.x, p.y)) { p.y--; if (collides(p.type, p.rot, p.x, p.y)) { S.piece = p; topOut(); return; } }
  S.piece = p; S.canHold = true; S.fallT = 0;
  // drop one row immediately so the piece is visible
  if (!collides(p.type, p.rot, p.x, p.y + 1)) p.y++;
}

/* ─────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────── */
function baseState(mode) {
  return {
    mode, board: newBoard(), queue: [], piece: null, hold: null, canHold: true,
    score: 0, lines: 0, level: 1, combo: -1, maxCombo: 0, b2b: false,
    quads: 0, tspins: 0, allClears: 0, pieces: 0,
    fallT: 0, das: { dir: 0, t: 0, arr: 0 }, soft: false, softT: 0,
    clearing: null, over: false, overT: 0, sprintDone: false, ultraDone: false,
    t: 0, banner: null, lockFlash: [], drops: [],
  };
}
function onStart(mode) {
  S = baseState(mode); bagRefill(); bagRefill(); spawn();
  shell.setHud('score', 0); shell.setHud('lines', mode === 'sprint' ? '0/40' : 0); shell.setHud('level', 1);
}
function demoState() {
  const s = baseState('demo'); S = s; bagRefill(); bagRefill(); spawn();
  // decorative half-built stack for the title screen
  for (let y = ROWS + HIDDEN - 7; y < ROWS + HIDDEN; y++) for (let x = 0; x < COLS; x++) if (Math.random() < 0.55 + (y - 14) * 0.06 && x !== 8) s.board[y][x] = ORDER[(x + y) % 7];
  return s;
}

const gravity = lv => Math.pow(0.8 - (lv - 1) * 0.007, lv - 1); // seconds per row

/* ─────────────────────────────────────────────────────────
   ACTIONS
───────────────────────────────────────────────────────── */
function tryMove(dx, dy) {
  const p = S.piece; if (!p) return false;
  if (collides(p.type, p.rot, p.x + dx, p.y + dy)) return false;
  p.x += dx; p.y += dy; p.lastRot = false;
  if (dy > 0 && p.y > p.lowest) { p.lowest = p.y; p.resets = 0; p.lockT = 0; }
  else if (dx) resetLock();
  return true;
}
function resetLock() { const p = S.piece; if (p.lockT > 0 && p.resets < MAX_RESETS) { p.lockT = 0; p.resets++; } }
function rotate(dir) {
  const p = S.piece; if (!p || p.type === 'O') return false;
  const to = (p.rot + dir + 4) % 4;
  const table = (p.type === 'I' ? KICKS_I : KICKS)[`${p.rot}>${to}`];
  for (let i = 0; i < table.length; i++) {
    const [kx, ky] = table[i];
    if (!collides(p.type, to, p.x + kx, p.y - ky)) {
      p.x += kx; p.y -= ky; p.rot = to; p.lastRot = true; p.kick = i;
      resetLock();
      if (S.mode !== 'demo') shell.tone(520 + dir * 40, 0.04, 'square', 0.06);
      return true;
    }
  }
  return false;
}
function ghostY() { const p = S.piece; let y = p.y; while (!collides(p.type, p.rot, p.x, y + 1)) y++; return y; }
function hardDrop() {
  const p = S.piece; if (!p) return;
  const gy = ghostY(); const dist = gy - p.y;
  if (dist > 0) { p.lastRot = false; }
  S.score += dist * 2;
  // streak effect
  CELLS[p.type][p.rot].forEach(([cx, cy]) => S.drops.push({ x: p.x + cx, y0: p.y + cy, y1: gy + cy, t: 0.18, c: colorOf(p.type) }));
  p.y = gy;
  shell.shake(3);
  lockPiece();
}
function holdPiece() {
  if (!S.canHold || !S.piece) return;
  const cur = S.piece.type;
  shell.tone(700, 0.05, 'triangle', 0.08);
  if (S.hold) { const h = S.hold; S.hold = cur; spawn(h); } else { S.hold = cur; spawn(); }
  S.canHold = false;
}

function tspinCheck(p) {
  if (p.type !== 'T' || !p.lastRot) return null;
  const cx = p.x + 1, cy = p.y + 1;
  const filled = (x, y) => x < 0 || x >= COLS || y >= ROWS + HIDDEN || (y >= 0 && !!S.board[y][x]);
  const corners = [[cx - 1, cy - 1], [cx + 1, cy - 1], [cx + 1, cy + 1], [cx - 1, cy + 1]];
  const occ = corners.map(([x, y]) => filled(x, y));
  if (occ.filter(Boolean).length < 3) return null;
  const front = { 0: [0, 1], 1: [1, 2], 2: [2, 3], 3: [3, 0] }[p.rot];
  const frontBoth = occ[front[0]] && occ[front[1]];
  return frontBoth || p.kick === 4 ? 'full' : 'mini';
}

function lockPiece() {
  const p = S.piece; if (!p) return;
  const ts = tspinCheck(p);
  let above = true;
  for (const [cx, cy] of CELLS[p.type][p.rot]) {
    const bx = p.x + cx, by = p.y + cy;
    if (by >= 0) S.board[by][bx] = p.type;
    if (by >= HIDDEN) above = false;
    S.lockFlash.push({ x: bx, y: by, t: 0.2 });
  }
  S.piece = null; S.pieces++;
  shell.tone(160, 0.06, 'square', 0.1, 90);
  if (above) { topOut(); return; }
  const full = [];
  for (let y = 0; y < ROWS + HIDDEN; y++) if (S.board[y].every(Boolean)) full.push(y);
  scoreClear(full.length, ts);
  if (full.length) {
    S.clearing = { rows: full, t: 0.3, max: 0.3 };
    full.forEach(y => { for (let x = 0; x < COLS; x++) shell.particles.emit(BX + x * CS + CS / 2, BY + (y - HIDDEN) * CS + CS / 2, { n: 3, color: [colorOf(S.board[y][x]), '#ffffff'], speed: 220, life: 0.6, size: 2.6 }); });
  } else spawn();
}

function scoreClear(n, ts) {
  const lv = S.level;
  let pts = 0, name = '', difficult = false;
  if (ts) {
    S.tspins += n > 0 ? 1 : 0;
    pts = ts === 'mini' ? [100, 200, 400][n] || 400 : [400, 800, 1200, 1600][n];
    name = (ts === 'mini' ? 'T-SPIN MINI' : 'T-SPIN') + (n ? ' ' + CLEAR_NAMES[n] : '');
    difficult = n > 0;
  } else if (n) {
    pts = [0, 100, 300, 500, 800][n]; name = CLEAR_NAMES[n];
    difficult = n === 4; if (n === 4) S.quads++;
  }
  if (n) {
    S.combo++;
    S.maxCombo = Math.max(S.maxCombo, S.combo);
    if (difficult && S.b2b) { pts = Math.floor(pts * 1.5); name = 'B2B ' + name; }
    S.b2b = difficult ? true : S.b2b && !n ? S.b2b : difficult;
    if (S.combo > 0) pts += 50 * S.combo;
  } else S.combo = -1;
  pts *= lv;
  S.score += pts;
  if (n) {
    S.lines += n;
    // all clear?
    const rest = S.board.filter(r => !r.every(Boolean));
    if (rest.every(r => r.every(c => !c))) { S.score += 3000 * lv; S.allClears++; name += ' · ALL CLEAR'; shell.flash('#ffffff', 0.5); }
    const sub = S.combo > 0 ? `COMBO ×${S.combo + 1}` : '';
    S.banner = { text: name, sub, t: 1.6, color: n === 4 || ts ? '#ffd700' : colorOf('T') };
    if (n === 4 || ts) { shell.shake(9); shell.sfx('power'); shell.flash(n === 4 ? '#00f0ff' : '#c04bff', 0.22); }
    else shell.sfx('combo', n * 3 + Math.max(0, S.combo));
    if (S.mode === 'marathon') {
      const nl = Math.floor(S.lines / 10) + 1;
      if (nl > S.level) { S.level = nl; shell.sfx('levelup'); shell.floaters.add(BX + COLS * CS / 2, BY + 300, `LEVEL ${nl}`, '#00f0ff', 26, 1.4); }
    }
    if (S.mode === 'sprint' && S.lines >= 40) { S.sprintDone = true; finish(); }
  } else if (ts) S.banner = { text: name, sub: '', t: 1.2, color: '#c04bff' };
  shell.setHud('score', S.score, true);
  shell.setHud('lines', S.mode === 'sprint' ? `${Math.min(40, S.lines)}/40` : S.lines, n > 0);
  shell.setHud('level', S.level);
}

function finishClear() {
  const rows = S.clearing.rows;
  S.board = S.board.filter((_, y) => !rows.includes(y));
  while (S.board.length < ROWS + HIDDEN) S.board.unshift(Array(COLS).fill(null));
  S.clearing = null;
  if (!S.over) spawn();
}
function topOut() {
  if (S.mode === 'demo') { S = demoState(); return; }
  if (S.over) return;
  S.over = true; S.overT = 0;
  shell.sfx('explode'); shell.sfx('gameover'); shell.shake(10); shell.flash('#ff2a6d', 0.4);
  report();
}
function finish() {
  if (S.over) return;
  S.over = true; S.overT = 0; S.piece = null;
  shell.sfx('levelup'); shell.flash('#ffffff', 0.4);
  report();
}
function report() {
  const ms = Math.round(S.t * 1000);
  if (S.sprintDone) lastSprintMs = ms;
  const stats = { score: S.score, lines: S.lines, level: S.mode === 'marathon' ? S.level : 0, quads: S.quads, tspins: S.tspins, maxCombo: Math.max(0, S.maxCombo + 1), allClears: S.allClears, pieces: S.pieces };
  if (S.sprintDone) { stats.sprintDone = true; stats.sprintMs = ms; }
  const pps = S.t > 0 ? (S.pieces / S.t).toFixed(2) : '0';
  shell.gameOver(stats, [['LINES', S.lines], ['QUADS', S.quads], ['T-SPINS', S.tspins], ['PIECES/S', pps], ['TIME', A.util.fmtTime(ms)]], 1300);
}

/* ─────────────────────────────────────────────────────────
   INPUT
───────────────────────────────────────────────────────── */
function onKey(code, down, e) {
  if (!S || S.over || S.mode === 'demo') return;
  if (code === 'ArrowLeft' || code === 'ArrowRight') {
    const d = code === 'ArrowLeft' ? -1 : 1;
    if (down) { if (e && e.repeat) return; S.das = { dir: d, t: 0, arr: 0 }; if (S.piece && !S.clearing) tryMove(d, 0) && shell.tone(300, 0.025, 'square', 0.04); }
    else if (S.das.dir === d) {
      const other = d === -1 ? 'ArrowRight' : 'ArrowLeft';
      S.das = shell.keys.has(other) ? { dir: -d, t: 0, arr: 0 } : { dir: 0, t: 0, arr: 0 };
    }
    return;
  }
  if (code === 'ArrowDown') { S.soft = down; S.softT = 0; return; }
  if (!down || (e && e.repeat) || !S.piece || S.clearing) return;
  if (code === 'Space') hardDrop();
  else if (code === 'ArrowUp' || code === 'KeyX' || code === 'KeyW') rotate(1);
  else if (code === 'KeyZ' || code === 'ControlLeft' || code === 'ControlRight') rotate(-1);
  else if (code === 'KeyA') { rotate(1); rotate(1); }
  else if (code === 'KeyC' || code === 'ShiftLeft' || code === 'ShiftRight') holdPiece();
}
// touch gestures on the board: tap rotate, drag to move, flick down to drop
let tp = null;
shell.canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' || shell.state !== 'playing') return;
  const p = shell.toLogical(e.clientX, e.clientY);
  tp = { x: p.x, y: p.y, sx: p.x, t: performance.now(), moved: false };
});
shell.canvas.addEventListener('pointermove', e => {
  if (!tp || !S || !S.piece || S.clearing) return;
  const p = shell.toLogical(e.clientX, e.clientY);
  while (p.x - tp.x > CS * 0.9) { tryMove(1, 0); tp.x += CS * 0.9; tp.moved = true; }
  while (tp.x - p.x > CS * 0.9) { tryMove(-1, 0); tp.x -= CS * 0.9; tp.moved = true; }
  if (p.y - tp.y > CS * 1.2 && Math.abs(p.x - tp.sx) < CS) { tryMove(0, 1); tp.y += CS; tp.moved = true; }
});
shell.canvas.addEventListener('pointerup', e => {
  if (!tp || !S || !S.piece || S.clearing) { tp = null; return; }
  const p = shell.toLogical(e.clientX, e.clientY);
  const dt = performance.now() - tp.t;
  if (!tp.moved && dt < 260) rotate(p.x < BX + CS * 5 && p.x < BX ? -1 : 1);
  else if (p.y - tp.y > 60 && dt < 280) hardDrop();
  tp = null;
});

/* ─────────────────────────────────────────────────────────
   UPDATE
───────────────────────────────────────────────────────── */
function update(dt) {
  if (!S) S = demoState();
  for (let i = S.lockFlash.length - 1; i >= 0; i--) { S.lockFlash[i].t -= dt; if (S.lockFlash[i].t <= 0) S.lockFlash.splice(i, 1); }
  for (let i = S.drops.length - 1; i >= 0; i--) { S.drops[i].t -= dt; if (S.drops[i].t <= 0) S.drops.splice(i, 1); }
  if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
  if (S.mode === 'demo') { demoUpdate(dt); return; }
  if (S.over) { S.overT += dt; return; }
  if (shell.state !== 'playing') return;
  S.t += dt;
  if (S.mode === 'ultra' && S.t >= 120) { S.ultraDone = true; S.t = 120; finish(); return; }
  if (S.clearing) { S.clearing.t -= dt; if (S.clearing.t <= 0) finishClear(); return; }
  const p = S.piece; if (!p) return;

  // DAS / ARR
  if (S.das.dir) {
    S.das.t += dt;
    if (S.das.t >= DAS) {
      S.das.arr += dt;
      while (S.das.arr >= ARR) { S.das.arr -= ARR; if (!tryMove(S.das.dir, 0)) { S.das.arr = 0; break; } }
    }
  }
  // gravity / soft drop
  const g = gravity(S.mode === 'marathon' ? S.level : 1);
  const onGround = collides(p.type, p.rot, p.x, p.y + 1);
  if (S.soft && !onGround) {
    S.softT += dt;
    const iv = Math.min(SOFT, g / 20);
    while (S.softT >= iv) { S.softT -= iv; if (tryMove(0, 1)) S.score += 1; else break; }
    shell.setHud('score', S.score);
  } else if (!onGround) {
    S.fallT += dt;
    while (S.fallT >= g) { S.fallT -= g; if (!tryMove(0, 1)) break; }
  }
  if (collides(p.type, p.rot, p.x, p.y + 1)) {
    p.lockT += dt;
    if (p.lockT >= LOCK || p.resets >= MAX_RESETS && p.lockT > 0.05) lockPiece();
  } else if (p.lockT > 0 && !onGround) p.lockT = 0;
}

let demoT = 0;
function demoUpdate(dt) {
  demoT += dt;
  if (!S.piece) spawn();
  if (demoT < 0.4) return;
  demoT = 0;
  const p = S.piece;
  if (Math.random() < 0.25) { const d = Math.random() < 0.5 ? -1 : 1; if (!collides(p.type, p.rot, p.x + d, p.y)) p.x += d; }
  if (!collides(p.type, p.rot, p.x, p.y + 1)) { p.y++; return; }
  // settle silently (no scoring / sounds on the title screen)
  for (const [cx, cy] of CELLS[p.type][p.rot]) if (p.y + cy >= 0) S.board[p.y + cy][p.x + cx] = p.type;
  S.piece = null;
  S.board = S.board.filter(r => !r.every(Boolean));
  while (S.board.length < ROWS + HIDDEN) S.board.unshift(Array(COLS).fill(null));
  if (S.board[HIDDEN + 3].some(Boolean)) S = demoState(); else spawn();
}

/* ─────────────────────────────────────────────────────────
   RENDER
───────────────────────────────────────────────────────── */
function blockSprite(color, style) {
  return G.sprite(`blk|${color}|${style}`, CS * 2, CS * 2, (c, w) => {
    c.scale(2, 2);
    const s = CS;
    if (style === 'outline') {
      c.fillStyle = G.hexA(color, 0.08); c.fillRect(1, 1, s - 2, s - 2);
      c.strokeStyle = color; c.lineWidth = 2; c.strokeRect(2.5, 2.5, s - 5, s - 5);
      c.fillStyle = color; c.fillRect(s / 2 - 2, s / 2 - 2, 4, 4);
      return;
    }
    if (style === 'pixel') {
      c.fillStyle = '#0f380f'; c.fillRect(1, 1, s - 2, s - 2);
      c.fillStyle = color; c.fillRect(3, 3, s - 6, s - 6);
      c.fillStyle = '#306230'; c.fillRect(8, 8, s - 16, s - 16);
      return;
    }
    const gr = c.createLinearGradient(0, 0, s, s);
    gr.addColorStop(0, G.mixHex(color, '#ffffff', 0.35)); gr.addColorStop(0.5, color); gr.addColorStop(1, G.mixHex(color, '#000000', 0.35));
    c.fillStyle = gr; c.beginPath(); c.roundRect(1, 1, s - 2, s - 2, 4); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(4, 3, s - 8, 2.5);
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(4, 6, 4, s - 12);
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; c.beginPath(); c.roundRect(1.5, 1.5, s - 3, s - 3, 4); c.stroke();
  });
}
function drawBlock(c, type, x, y, alpha = 1, size = CS) {
  const col = colorOf(type);
  c.globalAlpha = alpha;
  c.drawImage(blockSprite(col, shell.skin.style || 'glass'), x, y, size, size);
  c.globalAlpha = 1;
}
function drawMini(c, type, cx, cy, size) {
  if (!type) return;
  const cells = CELLS[type][0];
  const xs = cells.map(q => q[0]), ys = cells.map(q => q[1]);
  const w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1;
  const ox = cx - w * size / 2 - Math.min(...xs) * size, oy = cy - h * size / 2 - Math.min(...ys) * size;
  for (const [x, y] of cells) drawBlock(c, type, ox + x * size, oy + y * size, 1, size);
}
const boardBg = () => G.sprite('stack-bg', W * 2, H * 2, (c) => {
  c.scale(2, 2);
  const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#07041a'); gr.addColorStop(1, '#030210');
  c.fillStyle = gr; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(BX, BY, COLS * CS, ROWS * CS);
  c.strokeStyle = 'rgba(192,75,255,0.07)'; c.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) { c.beginPath(); c.moveTo(BX + x * CS, BY); c.lineTo(BX + x * CS, BY + ROWS * CS); c.stroke(); }
  for (let y = 0; y <= ROWS; y++) { c.beginPath(); c.moveTo(BX, BY + y * CS); c.lineTo(BX + COLS * CS, BY + y * CS); c.stroke(); }
});
function panel(c, x, y, w, h, label) {
  c.fillStyle = 'rgba(255,255,255,0.03)'; c.strokeStyle = 'rgba(192,75,255,0.3)'; c.lineWidth = 1.5;
  c.beginPath(); c.roundRect(x, y, w, h, 10); c.fill(); c.stroke();
  c.font = '700 10px Orbitron, monospace'; c.textAlign = 'center'; c.fillStyle = 'rgba(227,246,255,0.5)'; c.fillText(label, x + w / 2, y + 17);
}

function render(c, alpha, t) {
  if (!S) S = demoState();
  c.drawImage(boardBg(), 0, 0, W, H);
  // danger glow
  let height = 0; for (let y = 0; y < ROWS + HIDDEN; y++) if (S.board[y].some(Boolean)) { height = ROWS + HIDDEN - y; break; }
  const danger = S.mode !== 'demo' && height >= 16;
  c.strokeStyle = danger ? `rgba(255,42,109,${0.6 + Math.sin(t * 8) * 0.3})` : 'rgba(192,75,255,0.55)';
  c.lineWidth = 2; c.strokeRect(BX - 1, BY - 1, COLS * CS + 2, ROWS * CS + 2);
  c.drawImage(G.softGlow(danger ? '#ff2a6d' : '#c04bff', 60), BX - 40, BY + ROWS * CS - 40, COLS * CS + 80, 80);

  // board
  c.save(); c.beginPath(); c.rect(BX, BY - 4, COLS * CS, ROWS * CS + 4); c.clip();
  for (let y = HIDDEN; y < ROWS + HIDDEN; y++) {
    const clearing = S.clearing && S.clearing.rows.includes(y);
    for (let x = 0; x < COLS; x++) {
      const v = S.board[y][x]; if (!v) continue;
      const px = BX + x * CS, py = BY + (y - HIDDEN) * CS;
      if (S.over && S.overT > 0) { drawBlock(c, v, px, py, 0.25 + 0.75 * Math.max(0, 1 - S.overT * 0.8)); continue; }
      drawBlock(c, v, px, py);
      if (clearing) { const k = S.clearing.t / S.clearing.max; c.fillStyle = `rgba(255,255,255,${0.85 * k})`; c.fillRect(px, py, CS, CS); }
    }
  }
  // clearing sweep line
  if (S.clearing) {
    const k = 1 - S.clearing.t / S.clearing.max;
    for (const y of S.clearing.rows) { const py = BY + (y - HIDDEN) * CS; c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(BX + COLS * CS * k - 6, py, 12, CS); }
  }
  // lock flashes + hard-drop streaks
  for (const f of S.lockFlash) if (f.y >= HIDDEN) { c.fillStyle = `rgba(255,255,255,${f.t * 2})`; c.fillRect(BX + f.x * CS, BY + (f.y - HIDDEN) * CS, CS, CS); }
  for (const d of S.drops) {
    const k = d.t / 0.18, x = BX + d.x * CS, y0 = BY + (Math.max(HIDDEN, d.y0) - HIDDEN) * CS, y1 = BY + (d.y1 - HIDDEN) * CS;
    const gr = c.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, G.hexA(d.c, 0)); gr.addColorStop(1, G.hexA(d.c, 0.45 * k));
    c.fillStyle = gr; c.fillRect(x + 4, y0, CS - 8, y1 - y0);
  }
  // ghost + active piece
  const p = S.piece;
  if (p && !S.over) {
    if (S.mode !== 'demo') {
      const gy = ghostY(); const col = colorOf(p.type);
      for (const [cx, cy] of CELLS[p.type][p.rot]) {
        const y = gy + cy; if (y < HIDDEN) continue;
        c.strokeStyle = G.hexA(col, 0.6); c.lineWidth = 1.5; c.strokeRect(BX + (p.x + cx) * CS + 3, BY + (y - HIDDEN) * CS + 3, CS - 6, CS - 6);
        c.fillStyle = G.hexA(col, 0.08); c.fillRect(BX + (p.x + cx) * CS + 3, BY + (y - HIDDEN) * CS + 3, CS - 6, CS - 6);
      }
    }
    const lockK = p.lockT > 0 ? 1 - Math.min(1, p.lockT / LOCK) * 0.45 : 1;
    for (const [cx, cy] of CELLS[p.type][p.rot]) {
      const y = p.y + cy; if (y < HIDDEN - 1) continue;
      drawBlock(c, p.type, BX + (p.x + cx) * CS, BY + (y - HIDDEN) * CS, lockK);
    }
  }
  c.restore();

  // HOLD
  const [hx, hy, hw, hh, hcy, hs] = L.hold;
  panel(c, hx, hy, hw, hh, 'HOLD');
  if (S.hold) { c.globalAlpha = S.canHold ? 1 : 0.35; drawMini(c, S.hold, hx + hw / 2, hy + hcy, hs); c.globalAlpha = 1; }
  // stats
  const [sx, sy, sw, sh] = L.stats;
  panel(c, sx, sy, sw, sh, S.mode === 'sprint' ? 'SPRINT' : S.mode === 'ultra' ? 'ULTRA' : 'STATS');
  const rows = [];
  if (S.mode === 'sprint') rows.push(['LEFT', Math.max(0, 40 - S.lines)], ['TIME', A.util.fmtTime(S.t * 1000)]);
  else if (S.mode === 'ultra') rows.push(['TIME', A.util.fmtTime(Math.max(0, 120 - S.t) * 1000)], ['LINES', S.lines]);
  else rows.push(['LEVEL', S.level], ['LINES', S.lines]);
  rows.push(['QUADS', S.quads], ['T-SPIN', S.tspins]);
  rows.forEach(([k, v], i) => {
    c.textAlign = 'left'; c.font = '700 9px Orbitron, monospace'; c.fillStyle = 'rgba(227,246,255,0.45)'; c.fillText(k, sx + 12, sy + 38 + i * L.rowGap);
    c.font = `900 ${L.val}px Orbitron, monospace`; c.fillStyle = i === 0 ? '#e07bff' : '#e3f6ff'; c.fillText(String(v), sx + 12, sy + 38 + L.val + 4 + i * L.rowGap);
  });
  if (S.mode === 'marathon') { // level progress
    const k = (S.lines % 10) / 10;
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(sx + 12, sy + sh - 14, sw - 24, 4); c.fillStyle = '#c04bff'; c.fillRect(sx + 12, sy + sh - 14, (sw - 24) * k, 4);
  }
  // NEXT
  const [nx, ny, nw, nh, n0, ngap, ns1, ns2] = L.next;
  panel(c, nx, ny, nw, nh, 'NEXT');
  S.queue.slice(0, 5).forEach((tp2, i) => drawMini(c, tp2, nx + nw / 2, ny + n0 + i * ngap, i === 0 ? ns1 : ns2));
  // combo / b2b indicators
  const ix = PORTRAIT ? BX + 150 : L.ix + 59, iy = PORTRAIT ? BY + 50 : BY + 410;
  if (S.b2b) { c.font = '900 12px Orbitron, monospace'; c.textAlign = 'center'; c.fillStyle = PORTRAIT ? 'rgba(255,215,0,0.55)' : '#ffd700'; c.fillText('B2B READY', ix, iy); }
  if (S.combo > 0) { c.font = '900 22px Orbitron, monospace'; c.textAlign = 'center'; c.fillStyle = PORTRAIT ? 'rgba(0,240,255,0.6)' : '#00f0ff'; c.fillText(`×${S.combo + 1}`, ix, iy + 38); c.font = '700 9px Orbitron, monospace'; c.fillStyle = 'rgba(227,246,255,0.5)'; c.fillText('COMBO', ix, iy + 54); }

  shell.particles.draw(c);
  shell.floaters.draw(c);

  // clear banner
  if (S.banner) {
    const b = S.banner, k = Math.min(1, b.t * 2.5), pop = 1 + Math.max(0, b.t - 1.3) * 0.8;
    c.save(); c.globalAlpha = k; c.textAlign = 'center';
    c.translate(BX + COLS * CS / 2, BY + ROWS * CS * 0.4);
    c.font = '900 26px Orbitron, monospace';
    const fit = Math.min(1, (COLS * CS - 24) / c.measureText(b.text).width);
    c.scale(pop * fit, pop * fit);
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText(b.text, 2, 3);
    c.fillStyle = b.color; c.fillText(b.text, 0, 0);
    if (b.sub) { c.font = '900 14px Orbitron, monospace'; c.fillStyle = '#00f0ff'; c.fillText(b.sub, 0, 26); }
    c.restore();
  }
  if (S.mode !== 'demo' && S.t < 1.4 && S.pieces === 0 && !S.over) {
    c.globalAlpha = Math.min(1, (1.4 - S.t) * 2); c.font = '900 30px Orbitron, monospace'; c.textAlign = 'center'; c.fillStyle = '#c04bff';
    c.fillText(S.mode === 'sprint' ? '40 LINES. GO!' : S.mode === 'ultra' ? '2 MINUTES. GO!' : 'GO!', BX + COLS * CS / 2, BY + 220); c.globalAlpha = 1;
  }
}
})();
