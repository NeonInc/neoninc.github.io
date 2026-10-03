/* ============================================================
   NEON GEMS™  ·  Neon Arcade edition
   Swap neighbouring gems to make rows of three. Match four for a
   line gem, an L or T for a bomb, five in a row for a prism.
   Cascades multiply your score.
   Modes: Blitz 90s · 30 Moves
   © 2026 Neon Inc™
   ============================================================ */
(function () {
'use strict';
const A = window.Arcade, G = A.gfx;
const N = 8, CELL = 66, W = 8 * CELL + 52, H = 8 * CELL + 170;
const BX = 26, BY = 128;
const SHAPES = ['circle', 'diamond', 'square', 'triangle', 'hex', 'star'];
const MODES = [
  { id: 'blitz', name: 'BLITZ 90', desc: '90 seconds. Score as much as you can.' },
  { id: 'moves', name: '30 MOVES', desc: 'No clock. Make every swap count.' },
];

let S = null, uid = 0;
const shell = GameShell.create({
  id: 'gems', width: W, height: H, music: 'gems', modes: MODES,
  hud: [{ id: 'score', label: 'SCORE', main: true }, { id: 'left', label: 'TIME', init: '1:30' }, { id: 'casc', label: 'BEST ×', init: '0', opt: true }],
  controls: [['DRAG / SWIPE', 'Swap gems'], ['CLICK + CLICK', 'Swap neighbours'], ['ARROWS + SPACE', 'Keyboard'], ['P', 'Pause']],
  overTitle: res => res.mode === 'moves' ? 'OUT OF MOVES' : "TIME'S UP",
  onStart, update, render, onKey,
  onMenu() { S = demoState(); },
});
const colorOf = t => t < 0 ? '#ffffff' : (shell.skin.gems || [])[t] || '#ffffff';

/* ─────────────────────────────────────────────────────────
   BOARD
───────────────────────────────────────────────────────── */
const gem = (t, r, c, sp = null) => ({ t, sp, r, c, x: c, y: r, vy: 0, id: ++uid, die: 0, pop: 0, born: 0 });
function freshBoard() {
  const g = [];
  for (let r = 0; r < N; r++) { g.push([]); for (let c = 0; c < N; c++) {
    let t; do { t = Math.floor(Math.random() * 6); } while ((c >= 2 && g[r][c - 1].t === t && g[r][c - 2].t === t) || (r >= 2 && g[r - 1][c].t === t && g[r - 2][c].t === t));
    g[r].push(gem(t, r, c));
  } }
  return g;
}
function baseState(mode) {
  const st = { mode, grid: freshBoard(), state: 'idle', sel: null, cursor: { r: 3, c: 3 }, score: 0, cascade: 0, maxCascade: 0,
    matches: 0, specials: 0, prisms: 0, time: 90, moves: 30, over: false, ending: false, idleT: 0, hint: null, swap: null,
    t: 0, banner: null, lastMove: null, kbd: false, shake: 0, beams: [] };
  return st;
}
function demoState() { const s = baseState('demo'); s.demo = true; return s; }
function onStart(mode) {
  S = baseState(mode);
  // drop-in intro
  S.grid.forEach(row => row.forEach(g => { g.y = g.r - N - 1 - Math.random() * 2; }));
  S.state = 'fall';
  shell.setHud('score', 0); shell.setHud('casc', 0);
  document.querySelector('.gs-stat:nth-child(2) .l').textContent = mode === 'moves' ? 'MOVES' : 'TIME';
  shell.setHud('left', mode === 'moves' ? 30 : '1:30');
  if (!hasMove()) shuffle();
}
const inB = (r, c) => r >= 0 && c >= 0 && r < N && c < N;
const at = (r, c) => inB(r, c) ? S.grid[r][c] : null;

/* ─────────────────────────────────────────────────────────
   MATCH FINDING
───────────────────────────────────────────────────────── */
function runs(grid) {
  const out = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N;) {
    const t = grid[r][c] && grid[r][c].t; let e = c + 1;
    if (t >= 0) while (e < N && grid[r][e] && grid[r][e].t === t) e++;
    if (t >= 0 && e - c >= 3) out.push({ dir: 'h', t, cells: Array.from({ length: e - c }, (_, k) => [r, c + k]) });
    c = e;
  }
  for (let c = 0; c < N; c++) for (let r = 0; r < N;) {
    const t = grid[r][c] && grid[r][c].t; let e = r + 1;
    if (t >= 0) while (e < N && grid[e][c] && grid[e][c].t === t) e++;
    if (t >= 0 && e - r >= 3) out.push({ dir: 'v', t, cells: Array.from({ length: e - r }, (_, k) => [r + k, c]) });
    r = e;
  }
  return out;
}
function groups(grid) {
  // merge crossing runs of the same colour into L / T groups
  const rs = runs(grid), used = new Set(), out = [];
  rs.forEach((a, i) => {
    if (used.has(i)) return;
    const g = { t: a.t, runs: [a], cells: new Map() };
    a.cells.forEach(([r, c]) => g.cells.set(r * N + c, [r, c]));
    rs.forEach((b, j) => {
      if (j === i || used.has(j) || b.t !== a.t || b.dir === a.dir) return;
      if (b.cells.some(([r, c]) => g.cells.has(r * N + c))) { used.add(j); g.runs.push(b); b.cells.forEach(([r, c]) => g.cells.set(r * N + c, [r, c])); }
    });
    used.add(i); out.push(g);
  });
  return out;
}
function wouldMatch(r1, c1, r2, c2) {
  const g = S.grid, a = g[r1][c1], b = g[r2][c2];
  if (a.sp === 'prism' || b.sp === 'prism') return true;
  g[r1][c1] = b; g[r2][c2] = a;
  const check = (r, c) => {
    const t = g[r][c].t; if (t < 0) return false;
    let h = 1, k = c - 1; while (k >= 0 && g[r][k].t === t) { h++; k--; } k = c + 1; while (k < N && g[r][k].t === t) { h++; k++; }
    let v = 1; k = r - 1; while (k >= 0 && g[k][c].t === t) { v++; k--; } k = r + 1; while (k < N && g[k][c].t === t) { v++; k++; }
    return h >= 3 || v >= 3;
  };
  const ok = check(r1, c1) || check(r2, c2);
  g[r1][c1] = a; g[r2][c2] = b;
  return ok;
}
function findMove() {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (c < N - 1 && wouldMatch(r, c, r, c + 1)) return [[r, c], [r, c + 1]];
    if (r < N - 1 && wouldMatch(r, c, r + 1, c)) return [[r, c], [r + 1, c]];
  }
  return null;
}
const hasMove = () => !!findMove();
function shuffle() {
  const all = S.grid.flat();
  for (let tries = 0; tries < 50; tries++) {
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { S.grid[r][c] = all[r * N + c]; S.grid[r][c].r = r; S.grid[r][c].c = c; }
    if (!runs(S.grid).length && hasMove()) break;
  }
  if (!S.demo) { S.banner = { text: 'SHUFFLE', t: 1.2 }; shell.tone(400, 0.3, 'triangle', 0.1, 900); }
}

/* ─────────────────────────────────────────────────────────
   SWAPPING
───────────────────────────────────────────────────────── */
function trySwap(r1, c1, r2, c2) {
  if (S.state !== 'idle' || S.over || S.ending || !inB(r2, c2) || Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
  const a = S.grid[r1][c1], b = S.grid[r2][c2];
  S.sel = null; S.hint = null; S.idleT = 0;
  S.grid[r1][c1] = b; S.grid[r2][c2] = a; a.r = r2; a.c = c2; b.r = r1; b.c = c1;
  S.swap = { a, b, valid: true }; S.lastMove = [[r2, c2], [r1, c1]];
  S.state = 'swap';
  shell.tone(520, 0.07, 'sine', 0.08, 780);
}
function afterSwap() {
  const { a, b } = S.swap;
  // prism swaps fire immediately
  if (a.sp === 'prism' || b.sp === 'prism') {
    useMove();
    const other = a.sp === 'prism' ? b : a, prism = a.sp === 'prism' ? a : b;
    const kill = new Set([prism.id]);
    if (other.sp === 'prism') S.grid.flat().forEach(g => kill.add(g.id));
    else { S.grid.flat().forEach(g => { if (g.t === other.t) { kill.add(g.id); if (other.sp && other.sp !== 'prism') g.sp = g.sp || other.sp; } }); }
    S.beams.push({ x: prism.c, y: prism.r, t: 0.5, targets: S.grid.flat().filter(g => kill.has(g.id)).map(g => [g.c, g.r]), color: colorOf(other.t) });
    shell.sfx('power'); shell.flash('#ffffff', 0.3); shell.shake(8);
    S.specials++;
    S.swap = null; S.cascade = 0;
    clearCells(S.grid.flat().filter(g => kill.has(g.id)).map(g => [g.r, g.c]), null);
    return;
  }
  if (!groups(S.grid).length) {
    // invalid: swap back
    const r1 = a.r, c1 = a.c, r2 = b.r, c2 = b.c;
    S.grid[r1][c1] = b; S.grid[r2][c2] = a; a.r = r2; a.c = c2; b.r = r1; b.c = c1;
    S.swap = null; S.state = 'back';
    shell.sfx('error');
    return;
  }
  useMove();
  S.swap = null; S.cascade = 0;
  resolve();
}
function useMove() { if (S.mode === 'moves') { S.moves--; shell.setHud('left', S.moves, true); } }

/* ─────────────────────────────────────────────────────────
   RESOLVING
───────────────────────────────────────────────────────── */
function resolve() {
  const gs = groups(S.grid);
  if (!gs.length) {
    S.state = 'idle'; S.cascade = 0; S.idleT = 0;
    if (!S.demo && !hasMove()) shuffle();
    if (!S.demo && S.mode === 'moves' && S.moves <= 0) finish();
    if (!S.demo && S.ending) finish();
    return;
  }
  S.cascade++;
  S.maxCascade = Math.max(S.maxCascade, S.cascade);
  if (!S.demo) shell.setHud('casc', S.maxCascade);
  const toClear = [], created = [];
  gs.forEach(g => {
    const cells = [...g.cells.values()];
    const straight5 = g.runs.some(r => r.cells.length >= 5);
    const lt = g.runs.length > 1 && g.runs.some(r => r.dir === 'h') && g.runs.some(r => r.dir === 'v');
    const four = !straight5 && !lt && g.runs.some(r => r.cells.length === 4);
    // pivot: where the player moved, else the middle / crossing
    let pivot = null;
    if (S.lastMove) for (const [r, c] of S.lastMove) if (g.cells.has(r * N + c)) { pivot = [r, c]; break; }
    if (!pivot && lt) { const h = g.runs.find(r => r.dir === 'h'), v = g.runs.find(r => r.dir === 'v'); pivot = h.cells.find(([r, c]) => v.cells.some(([r2, c2]) => r2 === r && c2 === c)); }
    if (!pivot) pivot = cells[Math.floor(cells.length / 2)];
    let sp = null;
    if (straight5) sp = 'prism'; else if (lt) sp = 'bomb'; else if (four) sp = g.runs.find(r => r.cells.length === 4).dir === 'h' ? 'v' : 'h';
    if (sp) created.push({ r: pivot[0], c: pivot[1], t: sp === 'prism' ? -1 : g.t, sp });
    cells.forEach(cell => { if (!(sp && cell[0] === pivot[0] && cell[1] === pivot[1])) toClear.push(cell); });
    // score
    const base = cells.length * 20 + (sp === 'prism' ? 500 : sp === 'bomb' ? 250 : sp ? 120 : 0);
    const pts = base * S.cascade;
    S.score += pts; S.matches++;
    if (!S.demo) {
      const [cr, cc] = pivot;
      shell.floaters.add(BX + (cc + 0.5) * CELL, BY + (cr + 0.5) * CELL, S.cascade > 1 ? `+${pts} ×${S.cascade}` : `+${pts}`, colorOf(g.t), S.cascade > 2 ? 20 : 16);
    }
  });
  if (!S.demo) shell.setHud('score', S.score, true);
  created.forEach(cr => {
    const g = S.grid[cr.r][cr.c];
    g.t = cr.t; g.sp = cr.sp; g.pop = 0.4;
    if (cr.sp === 'prism') S.prisms++;
    if (!S.demo) shell.sfx('unlock');
  });
  S.lastMove = null;
  if (!S.demo) {
    if (S.cascade >= 2) shell.tone(440 * Math.pow(2, Math.min(S.cascade, 10) / 6), 0.14, 'square', 0.12);
    shell.sfx('combo', 3 + S.cascade * 2);
    if (S.cascade >= 3) S.banner = { text: S.cascade >= 6 ? 'UNREAL!' : S.cascade >= 5 ? 'INCREDIBLE!' : S.cascade >= 4 ? 'AWESOME!' : 'GREAT!', t: 1.1 };
  }
  clearCells(toClear, created);
}
function clearCells(cells, created) {
  // expand through specials caught in the blast
  const kill = new Map(), queue = [];
  const createdKeys = new Set((created || []).map(c => c.r * N + c.c));
  const add = (r, c) => { if (!inB(r, c)) return; const k = r * N + c; if (kill.has(k) || createdKeys.has(k)) return; kill.set(k, [r, c]); const g = S.grid[r][c]; if (g && g.sp) queue.push(g); };
  cells.forEach(([r, c]) => add(r, c));
  while (queue.length) {
    const g = queue.shift();
    S.specials++;
    if (g.sp === 'h') { for (let c = 0; c < N; c++) add(g.r, c); S.beams.push({ dir: 'h', r: g.r, t: 0.35, color: colorOf(g.t) }); }
    if (g.sp === 'v') { for (let r = 0; r < N; r++) add(r, g.c); S.beams.push({ dir: 'v', c: g.c, t: 0.35, color: colorOf(g.t) }); }
    if (g.sp === 'bomb') { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) add(g.r + dr, g.c + dc); S.beams.push({ dir: 'b', r: g.r, c: g.c, t: 0.4, color: colorOf(g.t) }); }
    if (g.sp === 'prism') { const t = Math.floor(Math.random() * 6); S.grid.flat().forEach(o => { if (o.t === t) add(o.r, o.c); }); }
    if (!S.demo) { shell.sfx(g.sp === 'bomb' ? 'explode' : 'hit'); shell.shake(g.sp === 'bomb' ? 8 : 4); }
  }
  let extra = 0;
  kill.forEach(([r, c]) => {
    const g = S.grid[r][c]; if (!g) return;
    g.die = 0.001; extra++;
    if (!S.demo) shell.particles.emit(BX + (c + 0.5) * CELL, BY + (r + 0.5) * CELL, { n: 7, color: [colorOf(g.t), '#ffffff'], speed: 190, life: 0.5, size: 2.4 });
  });
  const bonus = Math.max(0, extra - cells.length) * 15 * Math.max(1, S.cascade);
  if (bonus && !S.demo) { S.score += bonus; shell.setHud('score', S.score); }
  S.state = 'clear'; S.clearT = 0.2;
}
function collapse() {
  for (let c = 0; c < N; c++) {
    let write = N - 1;
    for (let r = N - 1; r >= 0; r--) {
      const g = S.grid[r][c];
      if (g && !g.die) { S.grid[write][c] = g; g.r = write; g.c = c; write--; }
    }
    let spawnY = -1;
    for (let r = write; r >= 0; r--) {
      const g = gem(Math.floor(Math.random() * 6), r, c); g.y = spawnY--; g.x = c;
      S.grid[r][c] = g;
    }
  }
  S.state = 'fall';
}
function finish() {
  if (S.over) return;
  S.over = true; S.state = 'idle';
  shell.sfx('levelup');
  shell.gameOver({ score: S.score, matches: S.matches, maxCascade: S.maxCascade, specials: S.specials, prisms: S.prisms },
    [['MATCHES', S.matches], ['BEST CASCADE', '×' + S.maxCascade], ['SPECIALS', S.specials], ['PRISMS', S.prisms]], 900);
}

/* ─────────────────────────────────────────────────────────
   INPUT
───────────────────────────────────────────────────────── */
let drag = null;
function cellAt(x, y) { const c = Math.floor((x - BX) / CELL), r = Math.floor((y - BY) / CELL); return inB(r, c) ? [r, c] : null; }
shell.canvas.addEventListener('pointerdown', e => {
  if (!S || S.demo || shell.state !== 'playing') return;
  const p = shell.toLogical(e.clientX, e.clientY), cell = cellAt(p.x, p.y);
  S.kbd = false;
  if (!cell) { S.sel = null; return; }
  drag = { x: p.x, y: p.y, cell };
  if (S.sel && Math.abs(S.sel[0] - cell[0]) + Math.abs(S.sel[1] - cell[1]) === 1) { trySwap(S.sel[0], S.sel[1], cell[0], cell[1]); drag = null; return; }
  S.sel = cell; shell.tone(900, 0.03, 'sine', 0.05);
});
window.addEventListener('pointermove', e => {
  if (!drag || !S) return;
  const p = shell.toLogical(e.clientX, e.clientY), dx = p.x - drag.x, dy = p.y - drag.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) > CELL * 0.4) {
    const [r, c] = drag.cell;
    if (Math.abs(dx) > Math.abs(dy)) trySwap(r, c, r, c + Math.sign(dx)); else trySwap(r, c, r + Math.sign(dy), c);
    drag = null;
  }
});
window.addEventListener('pointerup', () => { drag = null; });
document.querySelector('.gs-stage').addEventListener('touchmove', e => { if (shell.state === 'playing') e.preventDefault(); }, { passive: false });
function onKey(code, down) {
  if (!down || !S || S.demo) return;
  const d = { ArrowUp: [-1, 0], KeyW: [-1, 0], ArrowDown: [1, 0], KeyS: [1, 0], ArrowLeft: [0, -1], KeyA: [0, -1], ArrowRight: [0, 1], KeyD: [0, 1] }[code];
  S.kbd = true;
  if (d) {
    if (S.sel) { trySwap(S.sel[0], S.sel[1], S.sel[0] + d[0], S.sel[1] + d[1]); S.cursor = { r: Math.max(0, Math.min(N - 1, S.cursor.r + d[0])), c: Math.max(0, Math.min(N - 1, S.cursor.c + d[1])) }; return; }
    S.cursor = { r: Math.max(0, Math.min(N - 1, S.cursor.r + d[0])), c: Math.max(0, Math.min(N - 1, S.cursor.c + d[1])) };
    shell.tone(900, 0.02, 'sine', 0.03);
  }
  if (code === 'Space' || code === 'Enter') { S.sel = S.sel ? null : [S.cursor.r, S.cursor.c]; shell.tone(700, 0.04, 'sine', 0.06); }
}

/* ─────────────────────────────────────────────────────────
   UPDATE
───────────────────────────────────────────────────────── */
function settle(dt) {
  let moving = false;
  for (const row of S.grid) for (const g of row) {
    if (!g) continue;
    if (g.pop > 0) g.pop -= dt;
    // horizontal + swap ease
    const tx = g.c, ty = g.r;
    if (S.state === 'fall' && g.y < ty) {
      g.vy = Math.min(g.vy + 40 * dt, 18); g.y += g.vy * dt;
      if (g.y >= ty) { g.y = ty; if (g.vy > 4 && !S.demo && Math.random() < 0.08) shell.tone(1400 + Math.random() * 400, 0.02, 'sine', 0.03); g.vy = 0; } else moving = true;
    } else {
      const k = Math.min(1, dt * 16);
      g.x += (tx - g.x) * k; g.y += (ty - g.y) * k;
      if (Math.abs(g.x - tx) > 0.02 || Math.abs(g.y - ty) > 0.02) moving = true; else { g.x = tx; g.y = ty; }
    }
  }
  return moving;
}
function update(dt) {
  if (!S) S = demoState();
  S.t += dt;
  if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
  for (let i = S.beams.length - 1; i >= 0; i--) { S.beams[i].t -= dt; if (S.beams[i].t <= 0) S.beams.splice(i, 1); }
  if (S.demo) { demo(dt); return; }
  if (shell.state !== 'playing' && !S.over) return;
  const moving = settle(dt);
  if (S.state === 'swap' && !moving) afterSwap();
  else if (S.state === 'back' && !moving) S.state = 'idle';
  else if (S.state === 'clear') {
    S.clearT -= dt;
    for (const row of S.grid) for (const g of row) if (g && g.die) g.die += dt;
    if (S.clearT <= 0) collapse();
  } else if (S.state === 'fall' && !moving) resolve();
  if (S.over) return;
  if (S.mode === 'blitz' && !S.ending) {
    S.time -= dt;
    shell.setHud('left', `${Math.floor(Math.max(0, S.time) / 60)}:${String(Math.ceil(Math.max(0, S.time)) % 60).padStart(2, '0')}`);
    if (S.time <= 10 && Math.ceil(S.time) !== Math.ceil(S.time + dt)) shell.tone(880, 0.06, 'square', 0.06);
    if (S.time <= 0) { S.ending = true; S.banner = { text: "TIME'S UP", t: 1.4 }; if (S.state === 'idle') finish(); }
  }
  if (S.state === 'idle') {
    S.idleT += dt;
    if (S.idleT > 6 && !S.hint) S.hint = findMove();
  }
}
let demoT = 0;
function demo(dt) {
  const moving = settle(dt);
  if (S.state === 'clear') { S.clearT -= dt; for (const row of S.grid) for (const g of row) if (g && g.die) g.die += dt; if (S.clearT <= 0) collapse(); return; }
  if (S.state === 'fall' && !moving) { resolve(); return; }
  if (S.state === 'swap' && !moving) { afterSwap(); return; }
  if (S.state === 'back' && !moving) S.state = 'idle';
  if (S.state === 'idle' && (demoT += dt) > 1.6) { demoT = 0; const m = findMove(); if (m) trySwap(m[0][0], m[0][1], m[1][0], m[1][1]); else S = demoState(); }
}

/* ─────────────────────────────────────────────────────────
   RENDER
───────────────────────────────────────────────────────── */
function shapePath(c, shape, r) {
  c.beginPath();
  const poly = (n, rr, rot) => { for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); };
  if (shape === 'circle') c.arc(0, 0, r * 0.88, 0, Math.PI * 2);
  else if (shape === 'diamond') poly(4, r, -Math.PI / 2);
  else if (shape === 'square') c.roundRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6, r * 0.25);
  else if (shape === 'triangle') { c.moveTo(0, -r); c.lineTo(r * 0.95, r * 0.75); c.lineTo(-r * 0.95, r * 0.75); c.closePath(); }
  else if (shape === 'hex') poly(6, r * 0.95, 0);
  else if (shape === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.5 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); }
}
function gemSprite(t, col) {
  const s = CELL;
  return G.sprite(`gem|${t}|${col}`, s * 2, s * 2, c => {
    c.scale(2, 2); c.translate(s / 2, s / 2);
    const r = s * 0.36, shape = SHAPES[t];
    c.globalAlpha = 0.5; c.drawImage(G.softGlow(col, 40), -s * 0.55, -s * 0.55, s * 1.1, s * 1.1); c.globalAlpha = 1;
    shapePath(c, shape, r);
    const gr = c.createLinearGradient(-r, -r, r, r);
    gr.addColorStop(0, G.mixHex(col, '#ffffff', 0.55)); gr.addColorStop(0.45, col); gr.addColorStop(1, G.mixHex(col, '#000000', 0.5));
    c.fillStyle = gr; c.fill();
    c.strokeStyle = G.mixHex(col, '#ffffff', 0.4); c.lineWidth = 1.5; c.stroke();
    // facet highlight
    c.save(); shapePath(c, shape, r); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(-r * 0.3, -r * 0.42, r * 0.5, r * 0.22, -0.5, 0, Math.PI * 2); c.fill();
    c.restore();
  });
}
function drawGem(c, g, t) {
  const x = BX + (g.x + 0.5) * CELL, y = BY + (g.y + 0.5) * CELL;
  if (y < BY - CELL * 0.5) return;
  let sc = 1;
  if (g.die) sc = 1 + g.die * 2.5;
  if (g.pop > 0) sc = 1 + Math.sin((0.4 - g.pop) / 0.4 * Math.PI) * 0.3;
  c.save(); c.translate(x, y); c.scale(sc, sc);
  if (g.die) c.globalAlpha = Math.max(0, 1 - g.die * 5);
  if (g.sp === 'prism') {
    const r = CELL * 0.36;
    c.rotate(t * 1.5);
    for (let i = 0; i < 6; i++) { c.fillStyle = `hsl(${(i * 60 + t * 120) % 360},100%,60%)`; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, i * Math.PI / 3, (i + 1) * Math.PI / 3); c.closePath(); c.fill(); }
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0, r * 0.35, 0, Math.PI * 2); c.fill();
    c.globalAlpha *= 0.6; c.drawImage(G.softGlow('#ffffff', 40), -CELL * 0.6, -CELL * 0.6, CELL * 1.2, CELL * 1.2);
  } else {
    const col = colorOf(g.t);
    c.drawImage(gemSprite(g.t, col), -CELL / 2, -CELL / 2, CELL, CELL);
    if (g.sp === 'h' || g.sp === 'v') {
      c.save(); if (g.sp === 'v') c.rotate(Math.PI / 2);
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (const off of [-7, 0, 7]) c.fillRect(-CELL * 0.32, off - 1.5, CELL * 0.64, 3);
      c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.5; c.strokeRect(-CELL * 0.42, -CELL * 0.42, CELL * 0.84, CELL * 0.84);
    }
    if (g.sp === 'bomb') {
      const pulse = 0.5 + Math.sin(t * 8) * 0.5;
      c.strokeStyle = `rgba(255,255,255,${0.5 + pulse * 0.5})`; c.lineWidth = 2.5;
      c.beginPath(); c.arc(0, 0, CELL * (0.4 + pulse * 0.04), 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fill();
    }
  }
  c.restore();
}
const boardBg = () => G.sprite('gems-board', W, H, c => {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#070a24'); g.addColorStop(1, '#03030f');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let r = 0; r < N; r++) for (let col = 0; col < N; col++) {
    c.fillStyle = (r + col) % 2 ? 'rgba(77,124,255,0.07)' : 'rgba(77,124,255,0.12)';
    c.fillRect(BX + col * CELL, BY + r * CELL, CELL, CELL);
  }
  c.strokeStyle = 'rgba(77,124,255,0.6)'; c.lineWidth = 2; c.strokeRect(BX - 3, BY - 3, N * CELL + 6, N * CELL + 6);
});

function render(c, alpha, t) {
  c.drawImage(boardBg(), 0, 0, W, H);
  if (!S) return;
  // top info
  c.textAlign = 'center'; c.font = '700 12px Orbitron, monospace'; c.fillStyle = 'rgba(255,255,255,0.55)';
  if (!S.demo) {
    const label = S.mode === 'moves' ? 'MOVES LEFT' : 'TIME LEFT';
    const val = S.mode === 'moves' ? String(S.moves) : String(Math.max(0, Math.ceil(S.time)));
    c.fillText(label, W / 2, 34);
    c.font = '900 42px Orbitron, monospace';
    const low = S.mode === 'moves' ? S.moves <= 5 : S.time <= 10;
    c.fillStyle = low ? '#ff2a6d' : shell.game.color; c.fillText(val, W / 2, 80);
    const k = S.mode === 'moves' ? S.moves / 30 : Math.max(0, S.time) / 90;
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(BX, 100, N * CELL, 5);
    c.fillStyle = low ? '#ff2a6d' : shell.game.color; c.fillRect(BX, 100, N * CELL * k, 5);
    c.textAlign = 'left'; c.font = '700 11px Orbitron, monospace'; c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillText(`SPECIALS ${S.specials}`, BX, 34);
    c.textAlign = 'right'; c.fillText(S.cascade > 1 ? `CASCADE ×${S.cascade}` : '', BX + N * CELL, 34);
  }
  // board
  c.save(); c.beginPath(); c.rect(BX, BY, N * CELL, N * CELL); c.clip();
  const shakeX = S.shake;
  for (const row of S.grid) for (const g of row) if (g && !g.die) drawGem(c, g, t);
  for (const row of S.grid) for (const g of row) if (g && g.die) drawGem(c, g, t);
  // beams
  for (const b of S.beams) {
    const k = b.t / 0.4;
    c.globalAlpha = Math.min(1, k * 1.5);
    if (b.dir === 'h') { c.drawImage(G.softGlow(b.color, 40), BX - 20, BY + b.r * CELL - 10, N * CELL + 40, CELL + 20); c.fillStyle = '#fff'; c.fillRect(BX, BY + (b.r + 0.5) * CELL - 3, N * CELL, 6); }
    if (b.dir === 'v') { c.drawImage(G.softGlow(b.color, 40), BX + b.c * CELL - 10, BY - 20, CELL + 20, N * CELL + 40); c.fillStyle = '#fff'; c.fillRect(BX + (b.c + 0.5) * CELL - 3, BY, 6, N * CELL); }
    if (b.dir === 'b') { const rr = CELL * (1.8 - k * 0.6); c.drawImage(G.softGlow(b.color, 60), BX + (b.c + 0.5) * CELL - rr, BY + (b.r + 0.5) * CELL - rr, rr * 2, rr * 2); }
    if (b.targets) { c.strokeStyle = b.color; c.lineWidth = 2; for (const [tc, tr] of b.targets) { c.beginPath(); c.moveTo(BX + (b.x + 0.5) * CELL, BY + (b.y + 0.5) * CELL); c.lineTo(BX + (tc + 0.5) * CELL, BY + (tr + 0.5) * CELL); c.stroke(); } }
    c.globalAlpha = 1;
  }
  c.restore();
  if (!S.demo) {
    // selection / cursor / hint
    if (S.sel) { const [r, cc] = S.sel; c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.roundRect(BX + cc * CELL + 3, BY + r * CELL + 3, CELL - 6, CELL - 6, 10); c.stroke(); }
    if (S.kbd) { c.strokeStyle = shell.game.color; c.lineWidth = 2; c.setLineDash([6, 4]); c.strokeRect(BX + S.cursor.c * CELL + 1, BY + S.cursor.r * CELL + 1, CELL - 2, CELL - 2); c.setLineDash([]); }
    if (S.hint && S.state === 'idle') {
      const a = 0.4 + Math.sin(t * 6) * 0.4;
      S.hint.forEach(([r, cc]) => { c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 2; c.beginPath(); c.roundRect(BX + cc * CELL + 5, BY + r * CELL + 5, CELL - 10, CELL - 10, 10); c.stroke(); });
    }
  }
  shell.particles.draw(c);
  shell.floaters.draw(c);
  if (S.banner) {
    const b = S.banner, k = Math.min(1, b.t * 3), pop = 1 + Math.max(0, b.t - 0.9) * 0.6;
    c.save(); c.globalAlpha = k; c.translate(W / 2, BY + N * CELL / 2); c.scale(pop, pop); c.textAlign = 'center';
    c.font = '900 40px Orbitron, monospace'; c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillText(b.text, 3, 4);
    const gr = c.createLinearGradient(-150, 0, 150, 0); (shell.skin.gems || ['#fff']).forEach((col, i, arr) => gr.addColorStop(i / Math.max(1, arr.length - 1), col));
    c.fillStyle = gr; c.fillText(b.text, 0, 0); c.restore();
  }
}
})();
