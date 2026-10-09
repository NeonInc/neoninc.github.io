/* ============================================================
   NEON POOL™  ·  Neon Arcade edition
   8-ball against a CPU opponent (fouls, ball in hand, groups),
   or Time Rush: pot as many balls as you can in three minutes.
   Aim with the mouse, pull back to set power, release to shoot.
   On touch: drag back from the cue ball like a slingshot.
   © 2026 Neon Inc™
   ============================================================ */
(function () {
'use strict';
const A = window.Arcade, G = A.gfx;
const PORTRAIT = window.matchMedia && matchMedia('(max-aspect-ratio: 4/5)').matches;
const W = PORTRAIT ? 520 : 960, H = PORTRAIT ? 1030 : 600;
const TW = 800, TH = 400, R = 11, RAIL = 34;
// table origin on screen (cloth top-left in table space = 0,0)
const OX = PORTRAIT ? 60 : 80, OY = PORTRAIT ? 120 : 108;
const POCKETS = [[-4, -4, 24], [TW / 2, -9, 20], [TW + 4, -4, 24], [-4, TH + 4, 24], [TW / 2, TH + 9, 20], [TW + 4, TH + 4, 24]];
const BALL_COL = ['#ffffff', '#ffd400', '#2f6bff', '#ff2a3d', '#b04bff', '#ff8a00', '#00d66b', '#c2185b', '#141414', '#ffd400', '#2f6bff', '#ff2a3d', '#b04bff', '#ff8a00', '#00d66b', '#c2185b'];
const MAXV = 1500;
const MODES = [
  { id: 'eight', name: '8-BALL vs CPU', desc: 'Solids or stripes, then sink the 8. Fouls give ball in hand.' },
  { id: 'rush',  name: 'TIME RUSH 3:00', desc: 'Solo. Pot anything. Runs multiply your score.' },
];

// table ↔ screen
const toScreen = (x, y) => PORTRAIT ? { x: OX + TH - y, y: OY + x } : { x: OX + x, y: OY + y };
const toTable = (sx, sy) => PORTRAIT ? { x: sy - OY, y: OX + TH - sx } : { x: sx - OX, y: sy - OY };

let S = null;
const shell = GameShell.create({
  id: 'pool', width: W, height: H, music: 'pool', modes: MODES,
  hud: [{ id: 'score', label: 'SCORE', main: true }, { id: 'info', label: 'BALLS', init: '7' }, { id: 'turn', label: 'TURN', init: 'YOU', opt: true }],
  controls: [['MOUSE', 'Aim'], ['CLICK + PULL BACK', 'Power & shoot'], ['TOUCH', 'Drag back from the cue ball'], ['← → / SPACE', 'Keyboard aim & shoot']],
  overTitle: res => res.mode === 'rush' ? "TIME'S UP" : res.win ? 'YOU WIN!' : 'CPU WINS',
  onStart, update, render, onKey,
  onMenu() { S = demoState(); },
});

/* ─────────────────────────────────────────────────────────
   SETUP
───────────────────────────────────────────────────────── */
const kind = n => n === 0 ? 'cue' : n === 8 ? 'eight' : n < 8 ? 'solids' : 'stripes';
function rack() {
  const balls = [{ n: 0, x: TW * 0.25, y: TH / 2, vx: 0, vy: 0, in: false }];
  const apexX = TW * 0.72, d = R * 2 + 0.6;
  // 8 in the middle, a solid and a stripe in the back corners
  let pool = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  pool.sort(() => Math.random() - 0.5);
  const solidC = pool.find(n => n < 8), stripeC = pool.find(n => n > 8);
  pool = pool.filter(n => n !== solidC && n !== stripeC);
  const order = [];
  for (let row = 0; row < 5; row++) for (let k = 0; k <= row; k++) {
    let n;
    if (row === 2 && k === 1) n = 8;
    else if (row === 4 && k === 0) n = Math.random() < 0.5 ? solidC : stripeC;
    else if (row === 4 && k === 4) n = order.includes(solidC) ? stripeC : solidC;
    else n = pool.shift();
    order.push(n);
    balls.push({ n, x: apexX + row * d * 0.866, y: TH / 2 + (k - row / 2) * d, vx: 0, vy: 0, in: false });
  }
  return balls;
}
function baseState(mode) {
  return {
    mode, balls: rack(), turn: 0, groups: [null, null], phase: 'aim', aim: 0, power: 0, charging: false, chargeDir: 1,
    hand: 'kitchen', handPos: { x: TW * 0.25, y: TH / 2 }, shot: null, msg: null, over: false,
    score: 0, pots: 0, wins: 0, fouls: 0, run: 0, maxRun: 0, turnPots: 0, broke: false,
    time: 180, rushRun: 0, racks: 0, cpu: null, t: 0, pointer: null, drag: null,
  };
}
function demoState() {
  const s = baseState('demo'); s.demo = true; s.hand = null; s.aim = 0; s.demoT = 1.2; return s;
}
function onStart(mode) {
  S = baseState(mode);
  S.aim = 0;
  setMsg(mode === 'rush' ? 'BREAK! POT ANYTHING' : 'YOUR BREAK', '#19ffd2');
  shell.setHud('score', 0);
  document.querySelector('.gs-stat:nth-child(2) .l').textContent = mode === 'rush' ? 'TIME' : 'BALLS';
  shell.setHud('info', mode === 'rush' ? '3:00' : '–');
  shell.setHud('turn', 'YOU');
}
function setMsg(text, color = '#ffffff', t = 1.8) { S.msg = { text, color, t }; }
const cue = () => S.balls[0];
const live = () => S.balls.filter(b => !b.in);
const myGroupLeft = p => S.groups[p] ? S.balls.filter(b => !b.in && kind(b.n) === S.groups[p]).length : 7;

/* ─────────────────────────────────────────────────────────
   PHYSICS
───────────────────────────────────────────────────────── */
function nearPocket(b) { for (const [px, py, pr] of POCKETS) if (Math.hypot(b.x - px, b.y - py) < pr + R + 6) return [px, py, pr]; return null; }
function physics(dt) {
  const sub = 4, h = dt / sub;
  let moving = false;
  for (let s = 0; s < sub; s++) {
    for (const b of S.balls) {
      if (b.in) continue;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) {
        const ns = Math.max(0, sp * Math.exp(-0.55 * h) - 95 * h);
        if (ns < 2.5) { b.vx = b.vy = 0; } else { b.vx *= ns / sp; b.vy *= ns / sp; moving = true; }
      }
      b.x += b.vx * h; b.y += b.vy * h;
      const np = nearPocket(b);
      if (np) {
        if (Math.hypot(b.x - np[0], b.y - np[1]) < np[2] || b.x < -R || b.x > TW + R || b.y < -R || b.y > TH + R) pot(b, np);
      } else {
        if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * 0.76; railHit(b); }
        if (b.x > TW - R) { b.x = TW - R; b.vx = -Math.abs(b.vx) * 0.76; railHit(b); }
        if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * 0.76; railHit(b); }
        if (b.y > TH - R) { b.y = TH - R; b.vy = -Math.abs(b.vy) * 0.76; railHit(b); }
      }
    }
    // collisions
    const L = S.balls;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (a.in) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j]; if (b.in) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= 4 * R * R || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        const overlap = 2 * R - d;
        a.x -= nx * overlap / 2; a.y -= ny * overlap / 2; b.x += nx * overlap / 2; b.y += ny * overlap / 2;
        const rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rv <= 0) continue;
        const imp = rv * 0.97;
        a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny;
        if (S.shot) {
          if (a.n === 0 && S.shot.first == null) S.shot.first = b.n;
          if (b.n === 0 && S.shot.first == null) S.shot.first = a.n;
        }
        clack(rv);
      }
    }
  }
  return moving || S.balls.some(b => !b.in && (b.vx || b.vy));
}
let lastClack = 0;
function clack(v) {
  const now = performance.now(); if (now - lastClack < 25 || S.demo) return; lastClack = now;
  const g = Math.min(0.22, v / 3000);
  shell.tone(1800 + Math.random() * 400, 0.025, 'triangle', g); shell.noise(0.02, g * 0.8, 4000, 3);
}
function railHit(b) { if (S.shot) S.shot.rails++; const v = Math.hypot(b.vx, b.vy); if (v > 120 && !S.demo) shell.tone(140, 0.05, 'sine', Math.min(0.14, v / 6000)); }
function pot(b, p) {
  b.in = true; b.vx = b.vy = 0;
  const s = toScreen(p[0], p[1]);
  if (!S.demo) {
    shell.tone(90, 0.18, 'sine', 0.2, 50); shell.noise(0.15, 0.12, 500, 1, 0, 'lowpass');
    shell.particles.emit(s.x, s.y, { n: 18, color: [BALL_COL[b.n] === '#141414' ? '#ffffff' : BALL_COL[b.n], shell.skin.line], speed: 160, life: 0.6, size: 2.6 });
  }
  if (S.shot) S.shot.potted.push(b.n);
}

/* ─────────────────────────────────────────────────────────
   SHOOTING
───────────────────────────────────────────────────────── */
function shoot(angle, power) {
  const c = cue(), sp = Math.max(0.04, Math.min(1, power)) * MAXV;
  c.vx = Math.cos(angle) * sp; c.vy = Math.sin(angle) * sp;
  S.shot = { first: null, potted: [], rails: 0, shooter: S.turn, power };
  S.phase = 'roll'; S.power = 0; S.charging = false; S.drag = null;
  if (!S.demo) { shell.tone(220, 0.06, 'square', 0.12 + power * 0.1, 120); shell.noise(0.04, 0.2 * power + 0.05, 1800, 1); shell.shake(power * 3); }
}
function endShot() {
  const sh = S.shot; S.shot = null;
  if (S.mode === 'rush') return endRushShot(sh);
  const me = sh.shooter, opp = 1 - me, isPlayer = me === 0;
  const objPotted = sh.potted.filter(n => n !== 0);
  const scratch = sh.potted.includes(0);
  const eight = sh.potted.includes(8);
  const myG = S.groups[me];
  // my group was already fully cleared before this shot → the 8 is my legal ball
  const clearedBefore = !!myG && S.balls.filter(b => kind(b.n) === myG).every(b => b.in && !sh.potted.includes(b.n));
  let foul = null;
  if (scratch) foul = 'SCRATCH';
  else if (sh.first == null) foul = 'NO BALL HIT';
  else if (myG && kind(sh.first) !== myG && !(sh.first === 8 && clearedBefore)) foul = 'WRONG BALL FIRST';
  else if (!myG && sh.first === 8 && S.broke) foul = 'HIT THE 8 FIRST';
  const wasBreak = !S.broke; S.broke = true;

  // 8-ball outcomes
  if (eight) {
    if (wasBreak) { respot8(); }
    else { const win = clearedBefore && !foul; return gameEnd(win ? me : opp, win ? 'POTTED THE 8' : foul ? `FOUL ON THE 8 (${foul})` : 'EARLY 8'); }
  }
  // group assignment on the first clean pot after the break
  let assigned = false;
  if (!S.groups[0] && !foul && !wasBreak) {
    const first = objPotted.find(n => n !== 8);
    if (first) { const g = kind(first); S.groups[me] = g; S.groups[opp] = g === 'solids' ? 'stripes' : 'solids'; assigned = true; setMsg(`${isPlayer ? 'YOU ARE' : 'CPU IS'} ${g.toUpperCase()}`, '#ffd36b', 2); }
  }
  // scoring for the player
  const ownPots = objPotted.filter(n => n !== 8 && (!S.groups[me] || kind(n) === S.groups[me]));
  if (isPlayer) {
    S.pots += ownPots.length;
    S.turnPots += ownPots.length;
    S.maxRun = Math.max(S.maxRun, S.turnPots);
    if (ownPots.length) { const pts = ownPots.length * 50 * Math.max(1, S.turnPots); S.score += pts; shell.setHud('score', S.score, true); const c = toScreen(TW / 2, TH / 2); shell.floaters.add(c.x, OY - 30 + (PORTRAIT ? 0 : 0), `+${pts}`, '#19ffd2', 18); }
  }
  if (foul) {
    if (isPlayer) S.fouls++;
    setMsg(`FOUL: ${foul}`, '#ff2a6d', 2);
    if (!S.demo) shell.sfx('error');
    if (scratch) { const c = cue(); c.in = false; c.x = TW * 0.25; c.y = TH / 2; c.vx = c.vy = 0; }
    switchTurn(true, `FOUL: ${foul}`);
    return;
  }
  const continueTurn = wasBreak ? objPotted.length > 0 : ownPots.length > 0;
  if (continueTurn) { if (!assigned) setMsg(isPlayer ? 'NICE — SHOOT AGAIN' : 'CPU SHOOTS AGAIN', isPlayer ? '#19ffd2' : '#ff4fd8', 1.3); S.phase = 'aim'; startTurn(); }
  else switchTurn(false);
  updateInfo();
}
function respot8() {
  const b = S.balls.find(x => x.n === 8); b.in = false; b.vx = b.vy = 0;
  let x = TW * 0.72, y = TH / 2;
  while (S.balls.some(o => o !== b && !o.in && Math.hypot(o.x - x, o.y - y) < 2 * R + 1)) x += 2 * R;
  b.x = x; b.y = y; setMsg('8 ON THE BREAK — RESPOTTED', '#ffd36b');
}
function switchTurn(ballInHand, reason) {
  if (S.turn === 0) S.turnPots = 0;
  S.turn = 1 - S.turn;
  S.hand = ballInHand ? 'any' : null;
  const next = S.turn === 0 ? (ballInHand ? 'BALL IN HAND — YOUR SHOT' : 'YOUR TURN') : (ballInHand ? 'CPU HAS BALL IN HAND' : "CPU'S TURN");
  setMsg(reason ? `${reason} · ${next}` : next, reason ? '#ff2a6d' : S.turn === 0 ? '#19ffd2' : '#ff4fd8', reason ? 2.2 : 1.5);
  shell.setHud('turn', S.turn === 0 ? 'YOU' : 'CPU', true);
  S.phase = 'aim'; startTurn();
  updateInfo();
}
function startTurn() {
  S.power = 0; S.charging = false;
  if (S.turn === 1 && S.mode === 'eight') S.cpu = { think: 0.9 + Math.random() * 0.5, plan: null };
  else S.cpu = null;
}
function updateInfo() {
  if (S.mode !== 'eight') return;
  shell.setHud('info', S.groups[0] ? `${myGroupLeft(0)} ${S.groups[0] === 'solids' ? '●' : '◐'}` : 'OPEN');
}
function gameEnd(winner, why) {
  S.over = true; S.phase = 'over';
  const win = winner === 0;
  // win bonus, plus 60 for every ball the CPU still had on the table
  if (win) { S.wins = 1; S.score += 1000 + (S.groups[1] ? myGroupLeft(1) : 7) * 60; }
  shell.setHud('score', S.score, true);
  setMsg(win ? 'YOU WIN!' : 'CPU WINS', win ? '#ffd700' : '#ff2a6d', 5);
  shell.sfx(win ? 'levelup' : 'gameover');
  if (win) shell.flash('#ffffff', 0.35);
  shell.gameOver({ score: S.score, pots: S.pots, wins: win ? 1 : 0, win, maxRun: S.maxRun, fouls: S.fouls, cleanWin: win && S.fouls === 0 },
    [['RESULT', win ? 'WIN' : 'LOSS'], ['HOW', why], ['BALLS POTTED', S.pots], ['BEST RUN', S.maxRun], ['FOULS', S.fouls]], 1600);
}

/* ── Time Rush ── */
function endRushShot(sh) {
  const obj = sh.potted.filter(n => n !== 0);
  if (sh.potted.includes(0)) {
    S.time = Math.max(0, S.time - 5); S.rushRun = 0;
    setMsg('SCRATCH −5s · BALL IN HAND', '#ff2a6d'); shell.sfx('error');
    const c = cue(); c.in = false; c.vx = c.vy = 0; S.hand = 'any'; S.handPos = { x: TW * 0.25, y: TH / 2 };
  } else if (obj.length) {
    S.rushRun += obj.length;
    const pts = obj.length * 100 * Math.min(5, S.rushRun);
    S.score += pts; S.pots += obj.length; S.maxRun = Math.max(S.maxRun, S.rushRun);
    shell.setHud('score', S.score, true);
    setMsg(S.rushRun > 1 ? `RUN ×${Math.min(5, S.rushRun)}  +${pts}` : `+${pts}`, '#19ffd2', 1.2);
  } else { S.rushRun = 0; if (sh.first == null) setMsg('MISS', '#ff8a00', 0.8); }
  S.broke = true;
  if (S.balls.every(b => b.n === 0 || b.in)) {
    S.racks++; S.time += 15; S.score += 500; shell.setHud('score', S.score, true);
    setMsg('RACK CLEARED! +500 +15s', '#ffd700', 2); shell.sfx('levelup');
    const keepCue = cue(); S.balls = rack(); S.balls[0] = keepCue; S.broke = false;
    if (S.balls.slice(1).some(b => Math.hypot(b.x - keepCue.x, b.y - keepCue.y) < 2 * R + 2)) { keepCue.x = TW * 0.25; keepCue.y = TH / 2; }
  }
  if (S.time <= 0) return rushEnd();
  S.phase = 'aim';
}
function rushEnd() {
  if (S.over) return;
  S.over = true; S.phase = 'over';
  shell.sfx('levelup');
  shell.gameOver({ score: S.score, pots: S.pots, maxRun: S.maxRun, racks: S.racks },
    [['BALLS', S.pots], ['BEST RUN', S.maxRun], ['RACKS', S.racks]], 1000);
}

/* ─────────────────────────────────────────────────────────
   CPU
───────────────────────────────────────────────────────── */
function pathClear(x1, y1, x2, y2, ignore) {
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
  for (const b of S.balls) {
    if (b.in || ignore.includes(b)) continue;
    const t = Math.max(0, Math.min(1, ((b.x - x1) * dx + (b.y - y1) * dy) / L2));
    if (Math.hypot(x1 + dx * t - b.x, y1 + dy * t - b.y) < 2 * R - 0.5) return false;
  }
  return true;
}
function legalTargets(p) {
  const g = S.groups[p];
  if (!g) return live().filter(b => b.n !== 0 && b.n !== 8);
  const mine = live().filter(b => kind(b.n) === g);
  return mine.length ? mine : live().filter(b => b.n === 8);
}
function bestShot(from) {
  const c = from || cue();
  let best = null;
  for (const b of legalTargets(1)) for (const [px, py] of POCKETS) {
    const tx = px - b.x, ty = py - b.y, td = Math.hypot(tx, ty);
    const gx = b.x - tx / td * 2 * R, gy = b.y - ty / td * 2 * R;
    if (gx < R || gx > TW - R || gy < R || gy > TH - R) continue;
    const ax = gx - c.x, ay = gy - c.y, ad = Math.hypot(ax, ay);
    const cut = Math.acos(Math.max(-1, Math.min(1, (ax * tx + ay * ty) / (ad * td))));
    if (cut > 1.3) continue;
    if (!pathClear(c.x, c.y, gx, gy, [c, b])) continue;
    if (!pathClear(b.x, b.y, px, py, [b])) continue;
    const diff = (ad + td * 1.6) / Math.pow(Math.cos(cut), 1.6);
    if (!best || diff < best.diff) best = { b, angle: Math.atan2(ay, ax), diff, dist: ad + td, cut };
  }
  return best;
}
function cpuPlan() {
  // ball in hand: try spots behind the easiest ball
  if (S.hand) {
    let bestPos = null, bestD = Infinity;
    for (const b of legalTargets(1)) for (const [px, py] of POCKETS) {
      const tx = px - b.x, ty = py - b.y, td = Math.hypot(tx, ty);
      for (const back of [90, 140, 200]) {
        const x = b.x - tx / td * (2 * R + back), y = b.y - ty / td * (2 * R + back);
        if (x < R + 2 || x > TW - R - 2 || y < R + 2 || y > TH - R - 2) continue;
        if (S.balls.some(o => !o.in && o.n !== 0 && Math.hypot(o.x - x, o.y - y) < 2 * R + 2)) continue;
        const shot = bestShot({ x, y });
        if (shot && shot.diff < bestD) { bestD = shot.diff; bestPos = { x, y }; }
      }
    }
    const c = cue();
    if (bestPos) { c.x = bestPos.x; c.y = bestPos.y; } else { c.x = TW * 0.25; c.y = TH / 2; }
    S.hand = null;
  }
  const shot = bestShot();
  if (shot) {
    const err = (Math.random() - 0.5) * (0.018 + shot.cut * 0.012 + shot.dist / 60000);
    const power = Math.max(0.3, Math.min(0.95, 0.28 + shot.dist / 1250 / Math.max(0.35, Math.cos(shot.cut))));
    return { angle: shot.angle + err, power };
  }
  // safety: tap the nearest legal ball
  const c = cue();
  const ts = legalTargets(1).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
  const t = ts.find(b => pathClear(c.x, c.y, b.x, b.y, [c, b])) || ts[0];
  return { angle: Math.atan2(t.y - c.y, t.x - c.x) + (Math.random() - 0.5) * 0.05, power: 0.45 };
}

/* ─────────────────────────────────────────────────────────
   INPUT
───────────────────────────────────────────────────────── */
function myTurn() { return S && !S.demo && !S.over && S.phase === 'aim' && (S.mode === 'rush' || S.turn === 0); }
function placeOK(x, y) {
  if (x < R || x > TW - R || y < R || y > TH - R) return false;
  if (S.hand === 'kitchen' && x > TW * 0.25) return false;
  return !S.balls.some(b => b.n !== 0 && !b.in && Math.hypot(b.x - x, b.y - y) < 2 * R + 1);
}
function aimAt(p) { const c = cue(); S.aim = Math.atan2(p.y - c.y, p.x - c.x); }
shell.canvas.addEventListener('pointermove', e => {
  if (!S || S.demo) return;
  const sp = shell.toLogical(e.clientX, e.clientY), p = toTable(sp.x, sp.y);
  S.pointer = p;
  if (!myTurn()) return;
  if (S.hand) { const x = Math.max(R, Math.min((S.hand === 'kitchen' ? TW * 0.25 : TW - R), p.x)), y = Math.max(R, Math.min(TH - R, p.y)); S.handPos = { x, y }; if (placeOK(x, y)) { cue().x = x; cue().y = y; } return; }
  if (S.drag) {
    const c = cue();
    if (S.drag.mode === 'sling') { const dx = c.x - p.x, dy = c.y - p.y; S.aim = Math.atan2(dy, dx); S.power = Math.min(1, Math.hypot(dx, dy) / 190); }
    else if (S.drag.mode === 'pull') { const back = -((p.x - S.drag.x) * Math.cos(S.aim) + (p.y - S.drag.y) * Math.sin(S.aim)); S.power = Math.max(0, Math.min(1, back / 190)); }
    else if (S.drag.mode === 'aim') aimAt(p);
    return;
  }
  if (e.pointerType === 'mouse') aimAt(p);
});
shell.canvas.addEventListener('pointerdown', e => {
  if (!myTurn()) return;
  shell.canvas.setPointerCapture?.(e.pointerId);
  const sp = shell.toLogical(e.clientX, e.clientY), p = toTable(sp.x, sp.y);
  if (S.hand) {
    const x = Math.max(R, Math.min(S.hand === 'kitchen' ? TW * 0.25 : TW - R, p.x)), y = Math.max(R, Math.min(TH - R, p.y));
    if (placeOK(x, y)) { cue().x = x; cue().y = y; S.hand = null; shell.tone(600, 0.05, 'sine', 0.08); }
    else shell.sfx('error');
    return;
  }
  const c = cue(), dc = Math.hypot(p.x - c.x, p.y - c.y);
  if (dc < 46) S.drag = { mode: 'sling' };
  else if (e.pointerType === 'mouse') { aimAt(p); S.drag = { mode: 'pull', x: p.x, y: p.y }; }
  else { aimAt(p); S.drag = { mode: 'aim' }; }
});
const release = () => {
  if (!S || !S.drag) return;
  const d = S.drag; S.drag = null;
  if ((d.mode === 'sling' || d.mode === 'pull') && S.power > 0.04 && myTurn()) shoot(S.aim, S.power);
  else S.power = 0;
};
shell.canvas.addEventListener('pointerup', release);
shell.canvas.addEventListener('pointercancel', () => { if (S) { S.drag = null; S.power = 0; } });
document.querySelector('.gs-stage').addEventListener('touchmove', e => { if (shell.state === 'playing') e.preventDefault(); }, { passive: false });
function onKey(code, down) {
  if (!S || !myTurn()) { if (S && code === 'Space' && !down) S.charging = false; return; }
  if (S.hand && down) {
    const step = shell.keys.has('ShiftLeft') ? 2 : 8;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[code];
    if (mv) { const x = cue().x + mv[0], y = cue().y + mv[1]; if (placeOK(x, y)) { cue().x = x; cue().y = y; } return; }
    if (code === 'Enter' || code === 'Space') { if (placeOK(cue().x, cue().y)) S.hand = null; return; }
    return;
  }
  if (code === 'Space') {
    if (down && !S.charging) { S.charging = true; S.power = 0; S.chargeDir = 1; }
    else if (!down && S.charging) { S.charging = false; if (S.power > 0.04) shoot(S.aim, S.power); }
  }
}

/* ─────────────────────────────────────────────────────────
   UPDATE
───────────────────────────────────────────────────────── */
function update(dt) {
  if (!S) S = demoState();
  S.t += dt;
  if (S.msg) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
  if (S.demo) return demoUpdate(dt);
  if (shell.state !== 'playing' && !S.over) return;
  if (S.phase === 'roll') { if (!physics(dt)) endShot(); }
  else if (S.over) physics(dt);
  if (S.over) return;
  if (S.mode === 'rush') {
    S.time -= dt;
    shell.setHud('info', `${Math.floor(Math.max(0, S.time) / 60)}:${String(Math.ceil(Math.max(0, S.time)) % 60).padStart(2, '0')}`);
    if (S.time <= 0 && S.phase === 'aim') rushEnd();
  }
  if (S.phase !== 'aim') return;
  // keyboard aim + charge
  if (myTurn() && !S.hand) {
    const rot = (shell.keys.has('ArrowLeft') || shell.keys.has('KeyA') ? -1 : 0) + (shell.keys.has('ArrowRight') || shell.keys.has('KeyD') ? 1 : 0);
    if (rot) S.aim += rot * dt * (shell.keys.has('ShiftLeft') || shell.keys.has('ShiftRight') ? 0.15 : 1.1);
    if (S.charging) { S.power += S.chargeDir * dt * 0.9; if (S.power >= 1) { S.power = 1; S.chargeDir = -1; } if (S.power <= 0.02) { S.power = 0.02; S.chargeDir = 1; } }
  }
  // CPU turn
  if (S.cpu) {
    S.cpu.think -= dt;
    if (!S.cpu.plan && S.cpu.think < 0.6) { S.cpu.plan = cpuPlan(); S.cpu.from = S.aim; }
    if (S.cpu.plan) {
      let d = S.cpu.plan.angle - S.aim; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      S.aim += d * Math.min(1, dt * 6);
      S.power = Math.min(S.cpu.plan.power, S.power + dt * 1.3 * (S.cpu.think < 0.3 ? 1 : 0));
    }
    if (S.cpu.think <= -0.25 && S.cpu.plan) { const p = S.cpu.plan; S.cpu = null; shoot(p.angle, p.power); }
  }
}
function demoUpdate(dt) {
  if (S.phase === 'roll') { if (!physics(dt)) { S.phase = 'aim'; S.shot = null; S.demoT = 1.4; } return; }
  S.demoT -= dt;
  const ts = live().filter(b => b.n !== 0);
  if (!ts.length || ts.length < 4) { S = demoState(); return; }
  const c = cue(), t = ts[0];
  const want = Math.atan2(t.y - c.y, t.x - c.x);
  S.aim += (want - S.aim) * Math.min(1, dt * 3);
  if (S.demoT <= 0) { shoot(S.aim, S.broke ? 0.45 : 0.9); S.broke = true; }
}

/* ─────────────────────────────────────────────────────────
   RENDER
───────────────────────────────────────────────────────── */
function ballSprite(n) {
  return G.sprite(`pool-ball|${n}`, R * 4, R * 4, c => {
    c.scale(2, 2); c.translate(R, R);
    const col = BALL_COL[n];
    c.save(); c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.clip();
    if (n >= 9) { c.fillStyle = '#f4f4f4'; c.fillRect(-R, -R, R * 2, R * 2); c.fillStyle = col; c.fillRect(-R, -R * 0.55, R * 2, R * 1.1); }
    else { c.fillStyle = col; c.fillRect(-R, -R, R * 2, R * 2); }
    const sh = c.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.1);
    sh.addColorStop(0, 'rgba(255,255,255,0.55)'); sh.addColorStop(0.35, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = sh; c.fillRect(-R, -R, R * 2, R * 2);
    c.restore();
    if (n > 0) {
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0, R * 0.45, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#111'; c.font = `700 ${n > 9 ? 7 : 8}px Rajdhani, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), 0, 0.5);
    }
  });
}
function tableSprite() {
  const sk = shell.skin;
  return G.sprite(`pool-table|${sk.felt}|${sk.line}`, (TW + RAIL * 2) * 2, (TH + RAIL * 2) * 2, c => {
    c.scale(2, 2); c.translate(RAIL, RAIL);
    // rail
    c.fillStyle = sk.rail; c.beginPath(); c.roundRect(-RAIL, -RAIL, TW + RAIL * 2, TH + RAIL * 2, 22); c.fill();
    c.strokeStyle = sk.line; c.lineWidth = 2.5; c.beginPath(); c.roundRect(-RAIL + 3, -RAIL + 3, TW + RAIL * 2 - 6, TH + RAIL * 2 - 6, 19); c.stroke();
    // diamonds
    c.fillStyle = G.hexA(sk.line, 0.8);
    for (let i = 1; i < 8; i++) { if (i === 4) continue; const x = i * TW / 8; [[x, -RAIL / 2], [x, TH + RAIL / 2]].forEach(([dx, dy]) => { c.beginPath(); c.moveTo(dx, dy - 3); c.lineTo(dx + 3, dy); c.lineTo(dx, dy + 3); c.lineTo(dx - 3, dy); c.fill(); }); }
    for (let i = 1; i < 4; i++) { const y = i * TH / 4; [[-RAIL / 2, y], [TW + RAIL / 2, y]].forEach(([dx, dy]) => { c.beginPath(); c.moveTo(dx, dy - 3); c.lineTo(dx + 3, dy); c.lineTo(dx, dy + 3); c.lineTo(dx - 3, dy); c.fill(); }); }
    // cloth
    const g = c.createRadialGradient(TW / 2, TH / 2, 40, TW / 2, TH / 2, TW * 0.65);
    g.addColorStop(0, G.mixHex(sk.felt, '#ffffff', 0.08)); g.addColorStop(1, G.mixHex(sk.felt, '#000000', 0.35));
    c.fillStyle = g; c.fillRect(0, 0, TW, TH);
    c.strokeStyle = G.hexA(sk.line, 0.07); c.lineWidth = 1;
    for (let x = 0; x <= TW; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, TH); c.stroke(); }
    for (let y = 0; y <= TH; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(TW, y); c.stroke(); }
    // head string + spot
    c.strokeStyle = G.hexA(sk.line, 0.25); c.setLineDash([6, 8]); c.beginPath(); c.moveTo(TW * 0.25, 0); c.lineTo(TW * 0.25, TH); c.stroke(); c.setLineDash([]);
    c.fillStyle = G.hexA(sk.line, 0.4); c.beginPath(); c.arc(TW * 0.72, TH / 2, 3, 0, Math.PI * 2); c.fill();
    // cushion edge glow
    c.strokeStyle = G.hexA(sk.line, 0.55); c.lineWidth = 2; c.strokeRect(0, 0, TW, TH);
    // pockets
    for (const [px, py, pr] of POCKETS) {
      c.fillStyle = '#000'; c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.fill();
      c.strokeStyle = sk.line; c.lineWidth = 2; c.beginPath(); c.arc(px, py, pr + 1, 0, Math.PI * 2); c.stroke();
    }
  });
}
function render(c, alpha, t) {
  const sk = shell.skin;
  c.fillStyle = '#03030d'; c.fillRect(0, 0, W, H);
  c.drawImage(G.softGlow(sk.line, 200), W / 2 - W * 0.6, H / 2 - H * 0.6, W * 1.2, H * 1.2);
  if (!S) return;
  // table space
  c.save();
  if (PORTRAIT) { c.translate(OX + TH, OY); c.rotate(Math.PI / 2); } else c.translate(OX, OY);
  c.drawImage(tableSprite(), -RAIL, -RAIL, TW + RAIL * 2, TH + RAIL * 2);
  const cb = cue();
  const aiming = !S.over && S.phase === 'aim' && !cb.in && !S.hand && (S.turn === 0 || S.mode === 'rush' || S.cpu || S.demo);
  // aim guide
  if (aiming && (myTurn() || (S.cpu && S.cpu.plan))) drawGuide(c, cb, t);
  // balls
  for (const b of S.balls) {
    if (b.in) continue;
    c.drawImage(G.softGlow('#000000', 16), b.x - R * 1.2 + 2, b.y - R * 1.2 + 3, R * 2.4, R * 2.4);
    c.drawImage(ballSprite(b.n), b.x - R, b.y - R, R * 2, R * 2);
  }
  // ball in hand ghost
  if (S.hand && myTurn()) {
    const ok = placeOK(cb.x, cb.y);
    c.strokeStyle = ok ? '#19ffd2' : '#ff2a6d'; c.lineWidth = 2; c.setLineDash([4, 4]);
    c.beginPath(); c.arc(cb.x, cb.y, R + 6 + Math.sin(t * 6) * 2, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    if (S.hand === 'kitchen') { c.fillStyle = G.hexA(sk.line, 0.06); c.fillRect(0, 0, TW * 0.25, TH); }
  }
  // cue stick
  if (aiming && !cb.in) {
    const pull = 12 + S.power * 70 + (S.cpu && S.cpu.think < 0 ? -S.cpu.think * 0 : 0);
    const ax = Math.cos(S.aim), ay = Math.sin(S.aim);
    const sx = cb.x - ax * (R + pull), sy = cb.y - ay * (R + pull);
    const ex = sx - ax * 300, ey = sy - ay * 300;
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 9; c.beginPath(); c.moveTo(sx + 3, sy + 4); c.lineTo(ex + 3, ey + 4); c.stroke();
    const g = c.createLinearGradient(sx, sy, ex, ey); g.addColorStop(0, '#f6f0e0'); g.addColorStop(0.03, '#3a86ff'); g.addColorStop(0.05, sk.cue); g.addColorStop(0.7, G.mixHex(sk.cue, '#000000', 0.3)); g.addColorStop(1, '#1b1b1b');
    c.strokeStyle = g; c.lineWidth = 7; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
    c.lineWidth = 1; c.strokeStyle = G.hexA(sk.line, 0.6); c.beginPath(); c.moveTo(sx - ax * 120, sy - ay * 120); c.lineTo(sx - ax * 125, sy - ay * 125); c.stroke();
  }
  c.restore();
  if (S.demo) return;
  drawUI(c, t);
  shell.particles.draw(c);
  shell.floaters.draw(c);
}
function drawGuide(c, cb, t) {
  const ax = Math.cos(S.aim), ay = Math.sin(S.aim);
  // ray-cast for first ball or rail
  let hit = null, tMin = Infinity;
  for (const b of S.balls) {
    if (b.in || b === cb) continue;
    const fx = b.x - cb.x, fy = b.y - cb.y, proj = fx * ax + fy * ay; if (proj <= 0) continue;
    const perp2 = fx * fx + fy * fy - proj * proj, rr = 4 * R * R; if (perp2 > rr) continue;
    const tt = proj - Math.sqrt(rr - perp2); if (tt < tMin) { tMin = tt; hit = b; }
  }
  let tx = Infinity;
  if (ax > 0) tx = Math.min(tx, (TW - R - cb.x) / ax); if (ax < 0) tx = Math.min(tx, (R - cb.x) / ax);
  if (ay > 0) tx = Math.min(tx, (TH - R - cb.y) / ay); if (ay < 0) tx = Math.min(tx, (R - cb.y) / ay);
  const len = Math.min(tMin, tx);
  const gx = cb.x + ax * len, gy = cb.y + ay * len;
  const col = S.turn === 1 && S.mode === 'eight' ? '#ff4fd8' : '#ffffff';
  c.strokeStyle = G.hexA(col, 0.55); c.lineWidth = 1.5; c.setLineDash([6, 6]); c.lineDashOffset = -t * 30;
  c.beginPath(); c.moveTo(cb.x + ax * R, cb.y + ay * R); c.lineTo(gx, gy); c.stroke(); c.setLineDash([]);
  c.strokeStyle = G.hexA(col, 0.7); c.beginPath(); c.arc(gx, gy, R, 0, Math.PI * 2); c.stroke();
  if (hit) {
    const nx = (hit.x - gx) / (2 * R), ny = (hit.y - gy) / (2 * R);
    const legal = S.mode === 'rush' || S.turn === 1 || legalTargets(0).includes(hit);
    c.strokeStyle = legal ? shell.skin.line : '#ff2a6d'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(hit.x, hit.y); c.lineTo(hit.x + nx * 90, hit.y + ny * 90); c.stroke();
    // cue deflection (90° rule)
    const dot = ax * nx + ay * ny, cx = ax - dot * nx, cy = ay - dot * ny;
    c.strokeStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + cx * 50, gy + cy * 50); c.stroke();
    if (!legal) { c.strokeStyle = '#ff2a6d'; c.lineWidth = 2; c.beginPath(); c.moveTo(hit.x - 7, hit.y - 7); c.lineTo(hit.x + 7, hit.y + 7); c.moveTo(hit.x + 7, hit.y - 7); c.lineTo(hit.x - 7, hit.y + 7); c.stroke(); }
  }
}
function drawUI(c, t) {
  const sk = shell.skin;
  // player panels
  const panel = (x, y, w, label, p, active) => {
    c.fillStyle = active ? G.hexA(p === 0 ? '#19ffd2' : '#ff4fd8', 0.12) : 'rgba(255,255,255,0.04)';
    c.strokeStyle = active ? (p === 0 ? '#19ffd2' : '#ff4fd8') : 'rgba(255,255,255,0.1)'; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(x, y, w, 50, 10); c.fill(); c.stroke();
    c.textAlign = 'left'; c.font = '900 13px Orbitron, monospace'; c.fillStyle = p === 0 ? '#19ffd2' : '#ff4fd8'; c.fillText(label, x + 12, y + 20);
    c.font = '700 10px Orbitron, monospace'; c.fillStyle = 'rgba(255,255,255,0.6)';
    c.fillText(S.groups[p] ? S.groups[p].toUpperCase() : 'OPEN TABLE', x + 12, y + 38);
    // remaining balls
    const g = S.groups[p];
    const list = g ? S.balls.filter(b => kind(b.n) === g) : [];
    list.sort((a, b) => a.n - b.n).forEach((b, i) => { c.globalAlpha = b.in ? 0.18 : 1; c.drawImage(ballSprite(b.n), x + w - 12 - (list.length - i) * 18, y + 16, 16, 16); });
    if (g && list.every(b => b.in)) { c.globalAlpha = 1; c.drawImage(ballSprite(8), x + w - 30, y + 16, 16, 16); }
    c.globalAlpha = 1;
  };
  if (S.mode === 'eight') {
    const w = PORTRAIT ? (W - 36) / 2 : 300;
    panel(PORTRAIT ? 12 : OX - RAIL, 14, w, 'YOU', 0, S.turn === 0 && !S.over);
    panel(PORTRAIT ? W - 12 - w : OX + TW + RAIL - w, 14, w, 'CPU', 1, S.turn === 1 && !S.over);
    if (S.cpu && !S.over) { c.textAlign = 'center'; c.font = '700 11px Orbitron, monospace'; c.fillStyle = '#ff4fd8'; c.fillText('CPU IS LINING UP' + '.'.repeat(1 + Math.floor(t * 3) % 3), W / 2, PORTRAIT ? 92 : 44); }
  } else {
    c.textAlign = 'center'; c.font = '900 34px Orbitron, monospace';
    c.fillStyle = S.time < 15 ? '#ff2a6d' : '#19ffd2'; c.fillText(String(Math.max(0, Math.ceil(S.time))), W / 2, PORTRAIT ? 70 : 52);
    c.font = '700 11px Orbitron, monospace'; c.fillStyle = 'rgba(255,255,255,0.6)';
    c.fillText(S.rushRun > 1 ? `RUN ×${Math.min(5, S.rushRun)}` : 'SECONDS', W / 2, PORTRAIT ? 90 : 72);
  }
  // power meter
  const by = PORTRAIT ? H - 46 : H - 34, bw = PORTRAIT ? W - 120 : 420, bx = (W - bw) / 2;
  c.fillStyle = 'rgba(255,255,255,0.07)'; c.beginPath(); c.roundRect(bx, by, bw, 10, 5); c.fill();
  if (S.power > 0) {
    const g = c.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#19ffd2'); g.addColorStop(0.6, '#ffd700'); g.addColorStop(1, '#ff2a6d');
    c.fillStyle = g; c.beginPath(); c.roundRect(bx, by, bw * S.power, 10, 5); c.fill();
  }
  c.textAlign = 'center'; c.font = '700 10px Orbitron, monospace'; c.fillStyle = 'rgba(255,255,255,0.45)';
  const hint = S.hand && myTurn() ? (S.hand === 'kitchen' ? 'PLACE THE CUE BALL BEHIND THE LINE — CLICK / TAP TO SET' : 'BALL IN HAND — CLICK / TAP TO PLACE THE CUE BALL')
    : myTurn() ? (document.body.classList.contains('touch') ? 'DRAG BACK FROM THE CUE BALL, RELEASE TO SHOOT' : 'AIM WITH THE MOUSE · CLICK AND PULL BACK, RELEASE TO SHOOT') : '';
  c.fillText(hint || 'POWER', W / 2, by - 8);
  // message
  if (S.msg) {
    const m = S.msg, k = Math.min(1, m.t * 2);
    const my = PORTRAIT ? OY + TW / 2 : OY + TH / 2;
    c.globalAlpha = k; c.fillStyle = 'rgba(3,3,13,0.7)'; c.fillRect(0, my - 32, W, 52);
    c.font = `900 ${PORTRAIT ? 20 : 24}px Orbitron, monospace`; c.fillStyle = m.color; c.fillText(m.text, W / 2, my + 2);
    c.globalAlpha = 1;
  }
}
})();
