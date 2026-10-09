/* ============================================================
   NEON DRIFTER™  ·  Neon Arcade edition
   Old-school top-down drifting. Slide through corners to build
   drift points, chain drifts for a multiplier, bank them before
   you hit a wall. Two tracks + a 90-second free-drift mode.
   © 2026 Neon Inc™
   ============================================================ */
(function () {
'use strict';
const A = window.Arcade, G = A.gfx;
const PORTRAIT = window.matchMedia && matchMedia('(max-aspect-ratio: 4/5)').matches;
const W = PORTRAIT ? 540 : 900, H = PORTRAIT ? 760 : 620;

/* ─────────────────────────────────────────────────────────
   TRACKS  (closed Catmull-Rom loops, world units = px)
───────────────────────────────────────────────────────── */
const TRACK_DEFS = {
  circuit: { name: 'NEON CIRCUIT', hw: 112, par: 50, pts: [[500, 420], [1400, 300], [2200, 420], [2640, 900], [2420, 1420], [1820, 1520], [1500, 1160], [1120, 1220], [900, 1660], [420, 1600], [260, 1000]] },
  canyon:  { name: 'HAIRPIN CANYON', hw: 100, par: 62, pts: [[340, 320], [1040, 260], [1260, 660], [760, 860], [700, 1200], [1340, 1220], [1820, 720], [2420, 600], [2660, 1200], [2160, 1720], [1220, 1800], [420, 1680], [220, 1000]] },
};
function buildTrack(def) {
  const P = def.pts, n = P.length, raw = [];
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (let k = 0; k < 60; k++) {
      const t = k / 60, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      raw.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  // resample to an even 12px spacing
  let total = 0; const acc = [0];
  for (let i = 1; i <= raw.length; i++) { const a = raw[i - 1], b = raw[i % raw.length]; total += Math.hypot(b[0] - a[0], b[1] - a[1]); acc.push(total); }
  const N = Math.round(total / 12), pts = [];
  let j = 0;
  for (let i = 0; i < N; i++) {
    const d = i / N * total;
    while (acc[j + 1] < d) j++;
    const a = raw[j], b = raw[(j + 1) % raw.length], k = (d - acc[j]) / (acc[j + 1] - acc[j] || 1);
    pts.push({ x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k });
  }
  for (let i = 0; i < N; i++) {
    const a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N];
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
    pts[i].tx = tx / l; pts[i].ty = ty / l; pts[i].nx = -ty / l; pts[i].ny = tx / l;
  }
  for (let i = 0; i < N; i++) { // curvature for kerbs
    const a = pts[(i - 4 + N) % N], b = pts[(i + 4) % N];
    pts[i].curve = Math.abs(a.tx * b.ty - a.ty * b.tx);
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
  // decorative neon blocks placed away from the road
  const rng = A.util.seededRNG(def.pts.length * 977), blocks = [];
  for (let k = 0; k < 220 && blocks.length < 70; k++) {
    const w = 60 + rng() * 140, h = 60 + rng() * 140;
    const x = minX - 500 + rng() * (maxX - minX + 1000), y = minY - 500 + rng() * (maxY - minY + 1000);
    let ok = true;
    for (let i = 0; i < N; i += 3) { const p = pts[i]; if (p.x > x - def.hw - 40 && p.x < x + w + def.hw + 40 && p.y > y - def.hw - 40 && p.y < y + h + def.hw + 40) { ok = false; break; } }
    if (ok) blocks.push({ x, y, w, h, c: ['#ff2a6d', '#00f0ff', '#c04bff', '#ff8a00'][Math.floor(rng() * 4)] });
  }
  return { ...def, pts, N, len: total, minX, minY, maxX, maxY, blocks };
}
const TRACKS = {}; Object.keys(TRACK_DEFS).forEach(k => TRACKS[k] = buildTrack(TRACK_DEFS[k]));

const MODES = [
  { id: 'circuit', name: 'NEON CIRCUIT', desc: '3-lap drift attack on flowing sweepers.' },
  { id: 'canyon',  name: 'HAIRPIN CANYON', desc: '3-lap drift attack. Tight hairpins, big angles.' },
  { id: 'free',    name: 'FREE DRIFT 90', desc: '90 seconds on the circuit. Pure drift score.' },
];

/* ─────────────────────────────────────────────────────────
   CAR PHYSICS
───────────────────────────────────────────────────────── */
const CAR = { len: 38, wid: 20, maxV: 560, accel: 560, brake: 980, reverse: 170, turn: 3.1 };
function newCar(track, idx) {
  const p = track.pts[idx];
  return { x: p.x, y: p.y, h: Math.atan2(p.ty, p.tx), vx: 0, vy: 0, steer: 0, idx, slip: 0, speed: 0, wallT: 0 };
}
function stepCar(c, track, input, dt) {
  const sp = Math.hypot(c.vx, c.vy);
  // smooth steering input
  c.steer += (input.steer - c.steer) * Math.min(1, dt * 12);
  // slip in the current heading decides whether we're sliding
  let fx = Math.cos(c.h), fy = Math.sin(c.h);
  const vF0 = c.vx * fx + c.vy * fy, vR0 = c.vx * -fy + c.vy * fx;
  const slip = sp > 30 ? Math.atan2(vR0, Math.abs(vF0)) : 0;
  const sliding = Math.abs(slip) > 0.2;
  // steering: needs speed, a little stronger mid-slide (oversteer)
  const steerK = Math.min(1, sp / 110) * (1 - 0.28 * Math.min(1, sp / CAR.maxV));
  c.h += c.steer * CAR.turn * steerK * dt * Math.sign(vF0 || 1);
  // self-aligning: the car wants to point where it's going. Steering INTO the slide with
  // the throttle on fights that, so a held power-slide settles at a big, steady angle;
  // counter-steering or lifting off lets it straighten out.
  const into = sliding && input.steer && Math.sign(input.steer) === -Math.sign(slip);
  const align = input.hand ? 0.9 : into ? (input.gas ? 1.15 : 1.9) : sliding ? 3.4 : 4.2;
  if (vF0 > 0) c.h += slip * align * dt;
  // now split velocity along the NEW heading — the car turned, the momentum didn't
  fx = Math.cos(c.h); fy = Math.sin(c.h);
  const rx = -fy, ry = fx;
  let vF = c.vx * fx + c.vy * fy, vR = c.vx * rx + c.vy * ry;
  // engine / brakes
  if (input.gas) vF += CAR.accel * dt * Math.max(0, 1 - vF / CAR.maxV);
  if (input.brake) { if (vF > 20) vF -= CAR.brake * dt; else vF = Math.max(-CAR.reverse, vF - CAR.accel * 0.6 * dt); }
  if (!input.gas && !input.brake) vF *= Math.exp(-0.55 * dt);
  if (input.hand) vF *= Math.exp(-0.7 * dt);
  // tyres can only provide so much sideways force: corner too fast and the rear lets go
  const counter = sliding && input.steer && Math.sign(input.steer) === Math.sign(slip);
  let latAcc = sliding ? (counter ? 980 : into && input.gas ? 470 : 600) : 1050;
  if (input.gas && Math.abs(input.steer) > 0.5 && sp > 300) latAcc = Math.min(latAcc, 760); // power-over
  if (input.hand) latAcc = 170;
  // sideways speed partly turns into forward speed (that's what keeps a drift flowing)
  const dv = Math.min(Math.abs(vR), latAcc * dt);
  vR -= Math.sign(vR) * dv;
  vF += dv * 0.35 * Math.sign(vF || 1);
  if (sp < 90) vR *= Math.exp(-8 * dt);
  vF = Math.min(vF, CAR.maxV);
  c.vx = fx * vF + rx * vR; c.vy = fy * vF + ry * vR;
  const nrx = rx, nry = ry, nfx = fx, nfy = fy;
  c.x += c.vx * dt; c.y += c.vy * dt;
  c.speed = Math.hypot(c.vx, c.vy);
  c.slip = c.speed > 30 ? Math.atan2(c.vx * nrx + c.vy * nry, Math.abs(c.vx * nfx + c.vy * nfy)) : 0;
  // track position (local search around last index)
  let best = Infinity, bi = c.idx;
  for (let k = -24; k <= 24; k++) {
    const i = (c.idx + k + track.N) % track.N, p = track.pts[i];
    const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  c.idx = bi;
  const p = track.pts[bi];
  const lat = (c.x - p.x) * p.nx + (c.y - p.y) * p.ny;
  const lim = track.hw - 12;
  c.hit = 0;
  if (Math.abs(lat) > lim) {
    const s = Math.sign(lat), over = Math.abs(lat) - lim;
    c.x -= p.nx * s * over; c.y -= p.ny * s * over;
    const vn = c.vx * p.nx * s + c.vy * p.ny * s;
    if (vn > 0) { c.vx -= p.nx * s * vn * 1.35; c.vy -= p.ny * s * vn * 1.35; c.hit = vn; }
    c.vx *= 0.985; c.vy *= 0.985;
    if (c.hit > 0) { c.vx *= 0.82; c.vy *= 0.82; }
  }
  c.lat = lat;
  c.fwd = c.vx * p.tx + c.vy * p.ty;
}

/* ─────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────── */
let S = null;
const shell = GameShell.create({
  id: 'drifter', width: W, height: H, music: 'drifter', modes: MODES,
  hud: [{ id: 'score', label: 'SCORE', main: true }, { id: 'lap', label: 'LAP', init: '–' }, { id: 'speed', label: 'KM/H', opt: true }],
  controls: [['↑ / W', 'Gas'], ['↓ / S', 'Brake'], ['← →', 'Steer'], ['SPACE', 'Handbrake drift'], ['P', 'Pause']],
  touch: {
    left: [{ key: 'ArrowLeft', label: '◀' }, { key: 'ArrowRight', label: '▶' }],
    right: [{ key: 'Space', label: 'DRIFT', aria: 'Handbrake' }, { key: 'ArrowDown', label: '▼', aria: 'Brake' }, { key: 'ArrowUp', label: '▲', aria: 'Gas', wide: true }],
  },
  modeBest: (rec, mode) => rec.bests[mode] ? A.util.fmt(rec.bests[mode]) : '',
  onStart, update, render,
  onMenu() { S = demoState(); shell.setHud('lap', '–'); shell.setHud('speed', 0); },
});

function baseState(mode, demo) {
  const track = TRACKS[mode === 'canyon' ? 'canyon' : 'circuit'];
  const car = newCar(track, 6);
  return {
    mode, demo, track, car, t: 0, countdown: demo ? 0 : 3.2, over: false, overT: 0,
    score: 0, pending: 0, drifting: false, driftT: 0, grace: 0, combo: 1, comboT: 0, maxCombo: 1,
    drifts: 0, bestDrift: 0, crashes: 0, clean: true, wallT: 0,
    lap: 1, laps: mode === 'free' ? Infinity : 3, cp: 0, lapStart: 0, bestLap: 0, lapTimes: [],
    timeLeft: mode === 'free' ? 90 : 0, wrongT: 0,
    skids: [], cam: { x: car.x, y: car.y, z: 1 }, banner: null,
  };
}
function demoState() { const s = baseState('circuit', true); s.car.vx = Math.cos(s.car.h) * 200; s.car.vy = Math.sin(s.car.h) * 200; return s; }
function onStart(mode) {
  S = baseState(mode, false);
  shell.setHud('score', 0); shell.setHud('lap', mode === 'free' ? '1:30' : '1/3'); shell.setHud('speed', 0);
}

/* ─────────────────────────────────────────────────────────
   DRIFT SCORING
───────────────────────────────────────────────────────── */
function bankDrift() {
  if (S.pending < 40) { S.pending = 0; S.driftT = 0; return; }
  const pts = Math.round(S.pending * S.combo);
  S.score += pts; S.drifts++; S.bestDrift = Math.max(S.bestDrift, pts);
  shell.setHud('score', S.score, true);
  S.banner = { text: `+${A.util.fmt(pts)}`, sub: S.combo > 1 ? `DRIFT ×${S.combo}` : 'DRIFT', t: 1.1, color: S.combo >= 4 ? '#ffd700' : '#ff8a00' };
  shell.sfx('coin');
  if (S.driftT > 0.7) { S.combo = Math.min(8, S.combo + 1); S.maxCombo = Math.max(S.maxCombo, S.combo); }
  S.comboT = 2.6;
  S.pending = 0; S.driftT = 0;
}
function crash() {
  if (S.pending > 40) { S.banner = { text: 'CRASHED', sub: `-${A.util.fmt(Math.round(S.pending * S.combo))}`, t: 1.1, color: '#ff2a6d' }; shell.sfx('error'); }
  S.pending = 0; S.driftT = 0; S.drifting = false; S.grace = 0; S.combo = 1; S.comboT = 0;
  S.clean = false; S.crashes++;
}

/* ─────────────────────────────────────────────────────────
   UPDATE
───────────────────────────────────────────────────────── */
let engineT = 0, skidT = 0;
function update(dt) {
  if (!S) S = demoState();
  if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
  if (S.demo) { demoDrive(dt); return; }
  if (S.over) { S.overT += dt; const c = S.car; c.vx *= Math.exp(-dt * 1.2); c.vy *= Math.exp(-dt * 1.2); c.x += c.vx * dt; c.y += c.vy * dt; followCam(dt); return; }
  if (shell.state !== 'playing') return;
  if (S.countdown > 0) {
    const before = Math.ceil(S.countdown);
    S.countdown -= dt;
    const after = Math.ceil(S.countdown);
    if (after !== before) shell.tone(after > 0 ? 440 : 880, after > 0 ? 0.12 : 0.3, 'square', 0.14);
    followCam(dt);
    return;
  }
  S.t += dt;
  const k = shell.keys;
  const input = {
    gas: k.has('ArrowUp') || k.has('KeyW'),
    brake: k.has('ArrowDown') || k.has('KeyS'),
    hand: k.has('Space') || k.has('ShiftLeft'),
    steer: (k.has('ArrowLeft') || k.has('KeyA') ? -1 : 0) + (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0),
  };
  const c = S.car, prevIdx = c.idx;
  stepCar(c, S.track, input, dt);
  if (c.hit > 60) {
    shell.shake(Math.min(10, c.hit / 40)); shell.sfx('hit');
    shell.particles.emit(c.x, c.y, { n: 14, color: ['#ffd36b', '#ffffff'], speed: 260, life: 0.4, size: 2 });
    S.clean = false;
    if (c.hit > 190) crash();
    else if (S.pending > 0 && S.wallT <= 0) { S.pending *= 0.5; S.wallT = 0.4; S.banner = { text: 'SCRAPE', sub: 'HALF POINTS', t: 0.8, color: '#ff8a00' }; }
  }
  if (S.wallT > 0) S.wallT -= dt;

  // drift detection with a short grace so transitions don't split a drift
  const slipA = Math.abs(c.slip);
  const nowDrifting = c.speed > 150 && slipA > 0.24 && slipA < 1.7 && c.fwd > 0;
  if (nowDrifting) {
    S.drifting = true; S.grace = 0.45; S.driftT += dt;
    S.pending += c.speed * Math.min(slipA, 1.1) * dt * 1.6 * (1 + Math.max(0, c.speed - 320) / 360);
    if ((skidT += dt) > 0.025) { skidT = 0; addSkid(c); }
    if (Math.random() < 0.5) {
      const bx = c.x - Math.cos(c.h) * 16, by = c.y - Math.sin(c.h) * 16;
      shell.particles.emit(bx, by, { n: 1, color: ['rgba(200,200,255,1)', shell.skin.trail], speed: 40, life: 0.6, size: 4, drag: 2 });
    }
  } else if (S.drifting) {
    S.grace -= dt;
    if (S.grace <= 0) { S.drifting = false; bankDrift(); }
  }
  if (!S.drifting && S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 1; }

  // engine + tyre audio
  engineT -= dt;
  if (engineT <= 0) {
    engineT = 0.09;
    const f = 60 + c.speed * 0.32;
    shell.tone(f, 0.11, 'sawtooth', 0.035 + (input.gas ? 0.02 : 0));
    if (nowDrifting) shell.noise(0.1, 0.05 + Math.min(0.06, slipA * 0.05), 2200, 2);
  }

  // laps: checkpoints at 1/3 and 2/3 of the track
  const N = S.track.N, prog = c.idx / N, prevProg = prevIdx / N;
  if (S.cp === 0 && prog > 0.33 && prog < 0.5) S.cp = 1;
  if (S.cp === 1 && prog > 0.66 && prog < 0.85) S.cp = 2;
  if (S.cp === 2 && prevProg > 0.9 && prog < 0.1) completeLap();
  // wrong way
  if (c.fwd < -60) S.wrongT += dt; else S.wrongT = Math.max(0, S.wrongT - dt * 2);

  if (S.mode === 'free') {
    S.timeLeft -= dt;
    shell.setHud('lap', A.util.fmtTime(Math.max(0, S.timeLeft) * 1000).replace(/\.\d+$/, ''));
    if (S.timeLeft <= 0) finish(false);
  }
  shell.setHud('speed', Math.round(c.speed * 0.36));
  followCam(dt);
  // fade skids
  for (let i = S.skids.length - 1; i >= 0; i--) { S.skids[i].a -= dt * 0.12; if (S.skids[i].a <= 0) S.skids.splice(i, 1); }
}
function addSkid(c) {
  const bx = Math.cos(c.h), by = Math.sin(c.h), rx = -by, ry = bx;
  const back = -CAR.len * 0.32, side = CAR.wid * 0.42;
  const L = { x: c.x + bx * back + rx * side, y: c.y + by * back + ry * side };
  const R = { x: c.x + bx * back - rx * side, y: c.y + by * back - ry * side };
  if (c.lastSkid) S.skids.push({ a1: c.lastSkid.L, b1: L, a2: c.lastSkid.R, b2: R, a: 1 });
  c.lastSkid = { L, R };
  if (S.skids.length > 900) S.skids.splice(0, 60);
  clearTimeout(c.skidReset); c.skidReset = setTimeout(() => { c.lastSkid = null; }, 80);
}
function completeLap() {
  const lapMs = Math.round((S.t - S.lapStart) * 1000);
  S.lapStart = S.t; S.cp = 0; S.lapTimes.push(lapMs);
  S.bestLap = S.bestLap ? Math.min(S.bestLap, lapMs) : lapMs;
  if (S.mode === 'free') { S.lap++; shell.floaters.add(W / 2, H * 0.3, `LAP ${A.util.fmtTime(lapMs)}`, '#ffd36b', 20, 1.4); shell.sfx('unlock'); return; }
  if (S.lap >= S.laps) { finish(true); return; }
  S.lap++; shell.setHud('lap', `${S.lap}/${S.laps}`, true);
  shell.floaters.add(W / 2, H * 0.3, S.lap === S.laps ? 'FINAL LAP' : `LAP ${S.lap}`, '#ffd36b', 26, 1.4);
  shell.sfx('unlock');
}
function finish(completed) {
  if (S.over) return;
  if (S.drifting) bankDrift();
  S.over = true; S.overT = 0;
  let timeBonus = 0;
  if (completed) { timeBonus = Math.max(0, Math.round((S.track.par - S.t) * 120)); S.score += timeBonus; }
  shell.setHud('score', S.score, true);
  shell.sfx(completed ? 'levelup' : 'gameover'); shell.flash('#ffffff', 0.3);
  const lapsDone = S.mode === 'free' ? S.lapTimes.length : (completed ? S.laps : S.lap - 1);
  const stats = { score: S.score, drifts: S.drifts, bestDrift: S.bestDrift, maxCombo: S.maxCombo, laps: lapsDone, finished: completed, clean: completed && S.clean, crashes: S.crashes };
  if (S.bestLap) stats.lapMs = S.bestLap;
  shell.gameOver(stats, [['DRIFTS', S.drifts], ['BEST DRIFT', A.util.fmt(S.bestDrift)], ['MAX CHAIN', '×' + S.maxCombo], ['BEST LAP', S.bestLap ? A.util.fmtTime(S.bestLap) : '—'], ['TIME BONUS', '+' + A.util.fmt(timeBonus)], ['WALL HITS', S.crashes]], 1200);
}
function followCam(dt) {
  const c = S.car, lead = 0.35;
  const tx = c.x + c.vx * lead, ty = c.y + c.vy * lead;
  S.cam.x += (tx - S.cam.x) * Math.min(1, dt * 4);
  S.cam.y += (ty - S.cam.y) * Math.min(1, dt * 4);
  const tz = (PORTRAIT ? 0.82 : 1) * (1.05 - Math.min(0.25, c.speed / 2000));
  S.cam.z += (tz - S.cam.z) * Math.min(1, dt * 2);
}
function demoDrive(dt) {
  S.t += dt;
  const c = S.car, tr = S.track;
  const tgt = tr.pts[(c.idx + 14) % tr.N];
  const want = Math.atan2(tgt.y - c.y, tgt.x - c.x);
  let d = want - c.h; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  stepCar(c, tr, { gas: true, brake: false, hand: Math.abs(d) > 0.55 && c.speed > 300, steer: Math.max(-1, Math.min(1, d * 2.4)) }, dt);
  if (c.speed > 150 && Math.abs(c.slip) > 0.24 && (skidT += dt) > 0.03) { skidT = 0; addSkid(c); }
  for (let i = S.skids.length - 1; i >= 0; i--) { S.skids[i].a -= dt * 0.25; if (S.skids[i].a <= 0) S.skids.splice(i, 1); }
  followCam(dt);
}

/* ─────────────────────────────────────────────────────────
   RENDER
───────────────────────────────────────────────────────── */
function trackPath(c, tr, off) {
  c.beginPath();
  for (let i = 0; i <= tr.N; i++) { const p = tr.pts[i % tr.N]; const x = p.x + p.nx * off, y = p.y + p.ny * off; i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.closePath();
}
function drawCar(c, car, t) {
  const sk = shell.skin;
  c.save(); c.translate(car.x, car.y); c.rotate(car.h);
  c.drawImage(G.softGlow(sk.body, 50), -50, -50, 100, 100);
  // shadow
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.roundRect(-CAR.len / 2 + 3, -CAR.wid / 2 + 4, CAR.len, CAR.wid, 6); c.fill();
  // wheels
  c.fillStyle = '#05050d';
  const steerA = car.steer * 0.45;
  for (const [x, y, front] of [[11, -10, 1], [11, 10, 1], [-11, -10, 0], [-11, 10, 0]]) { c.save(); c.translate(x, y); if (front) c.rotate(steerA); c.fillRect(-5, -2.5, 10, 5); c.restore(); }
  // body
  c.fillStyle = sk.body; c.beginPath(); c.roundRect(-CAR.len / 2, -CAR.wid / 2, CAR.len, CAR.wid, 6); c.fill();
  c.fillStyle = sk.stripe; c.fillRect(-CAR.len / 2 + 2, -2, CAR.len - 4, 4);
  // cabin
  c.fillStyle = 'rgba(5,5,20,0.85)'; c.beginPath(); c.roundRect(-6, -CAR.wid / 2 + 3, 15, CAR.wid - 6, 3); c.fill();
  // lights
  c.fillStyle = '#ffffff'; c.fillRect(CAR.len / 2 - 3, -CAR.wid / 2 + 2, 3, 4); c.fillRect(CAR.len / 2 - 3, CAR.wid / 2 - 6, 3, 4);
  c.fillStyle = '#ff2a6d'; c.fillRect(-CAR.len / 2, -CAR.wid / 2 + 2, 2, 4); c.fillRect(-CAR.len / 2, CAR.wid / 2 - 6, 2, 4);
  c.globalCompositeOperation = 'lighter';
  c.drawImage(G.softGlow('#ffffff', 40), CAR.len / 2, -40, 120, 80);
  c.restore();
}
function render(c, alpha, t) {
  if (!S) S = demoState();
  const tr = S.track, cam = S.cam;
  c.fillStyle = '#04030c'; c.fillRect(0, 0, W, H);
  c.save();
  c.translate(W / 2, H / 2); c.scale(cam.z, cam.z); c.translate(-cam.x, -cam.y);
  const vx0 = cam.x - W / 2 / cam.z, vy0 = cam.y - H / 2 / cam.z, vx1 = cam.x + W / 2 / cam.z, vy1 = cam.y + H / 2 / cam.z;
  // ground grid
  c.strokeStyle = 'rgba(192,75,255,0.07)'; c.lineWidth = 1 / cam.z;
  const gs = 80;
  for (let x = Math.floor(vx0 / gs) * gs; x < vx1; x += gs) { c.beginPath(); c.moveTo(x, vy0); c.lineTo(x, vy1); c.stroke(); }
  for (let y = Math.floor(vy0 / gs) * gs; y < vy1; y += gs) { c.beginPath(); c.moveTo(vx0, y); c.lineTo(vx1, y); c.stroke(); }
  // blocks
  for (const b of tr.blocks) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    c.fillStyle = 'rgba(10,6,24,0.9)'; c.fillRect(b.x, b.y, b.w, b.h);
    c.strokeStyle = G.hexA(b.c, 0.5); c.lineWidth = 2; c.strokeRect(b.x, b.y, b.w, b.h);
    c.fillStyle = G.hexA(b.c, 0.18);
    for (let wx = b.x + 10; wx < b.x + b.w - 10; wx += 18) for (let wy = b.y + 10; wy < b.y + b.h - 10; wy += 18) if (((wx * 13 + wy * 7) | 0) % 3 === 0) c.fillRect(wx, wy, 8, 8);
  }
  // road
  c.lineJoin = 'round';
  trackPath(c, tr, 0);
  c.strokeStyle = G.hexA(shell.game.color, 0.12); c.lineWidth = tr.hw * 2 + 30; c.stroke();
  c.strokeStyle = '#0d0b1c'; c.lineWidth = tr.hw * 2; c.stroke();
  // centre dashes
  c.setLineDash([26, 30]); c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 3; c.stroke(); c.setLineDash([]);
  // edges
  for (const s of [-1, 1]) {
    trackPath(c, tr, tr.hw * s);
    c.strokeStyle = G.hexA(s < 0 ? '#ff2a6d' : '#00f0ff', 0.25); c.lineWidth = 10; c.stroke();
    c.strokeStyle = s < 0 ? '#ff2a6d' : '#00f0ff'; c.lineWidth = 2.5; c.stroke();
  }
  // kerbs on tight corners
  for (let i = 0; i < tr.N; i += 2) {
    const p = tr.pts[i]; if (p.curve < 0.32) continue;
    if (p.x < vx0 - 100 || p.x > vx1 + 100 || p.y < vy0 - 100 || p.y > vy1 + 100) continue;
    for (const s of [-1, 1]) { c.fillStyle = (i / 2) % 2 ? '#ffffff' : (s < 0 ? '#ff2a6d' : '#00f0ff'); c.globalAlpha = 0.55; c.beginPath(); c.arc(p.x + p.nx * (tr.hw - 6) * s, p.y + p.ny * (tr.hw - 6) * s, 4, 0, Math.PI * 2); c.fill(); }
  }
  c.globalAlpha = 1;
  // start line (checkered)
  const s0 = tr.pts[0];
  c.save(); c.translate(s0.x, s0.y); c.rotate(Math.atan2(s0.ty, s0.tx));
  for (let i = -tr.hw; i < tr.hw; i += 10) for (let j = 0; j < 2; j++) { c.fillStyle = ((i / 10 | 0) + j) % 2 ? '#ffffff' : '#111'; c.fillRect(j * 10 - 10, i, 10, 10); }
  c.restore();
  // skids
  c.lineCap = 'round';
  for (const s of S.skids) {
    c.strokeStyle = G.hexA(shell.skin.trail, 0.4 * s.a); c.lineWidth = 4;
    c.beginPath(); c.moveTo(s.a1.x, s.a1.y); c.lineTo(s.b1.x, s.b1.y); c.moveTo(s.a2.x, s.a2.y); c.lineTo(s.b2.x, s.b2.y); c.stroke();
  }
  shell.particles.draw(c);
  drawCar(c, S.car, t);
  c.restore();
  shell.floaters.draw(c);

  if (S.demo) return;
  // minimap
  const mm = PORTRAIT ? 110 : 150, mx = W - mm - 12, my = 12;
  const sc = mm / Math.max(tr.maxX - tr.minX, tr.maxY - tr.minY);
  c.fillStyle = 'rgba(5,4,16,0.75)'; c.strokeStyle = 'rgba(255,138,0,0.35)'; c.lineWidth = 1;
  c.beginPath(); c.roundRect(mx - 8, my - 8, mm + 16, (tr.maxY - tr.minY) * sc + 16, 8); c.fill(); c.stroke();
  c.beginPath();
  for (let i = 0; i <= tr.N; i += 4) { const p = tr.pts[i % tr.N]; const x = mx + (p.x - tr.minX) * sc, y = my + (p.y - tr.minY) * sc; i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.closePath(); c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 3; c.stroke();
  c.fillStyle = shell.skin.body; c.beginPath(); c.arc(mx + (S.car.x - tr.minX) * sc, my + (S.car.y - tr.minY) * sc, 4, 0, Math.PI * 2); c.fill();

  // drift meter
  const cx = W / 2;
  if (S.drifting || S.pending > 0) {
    c.textAlign = 'center';
    c.font = '900 30px Orbitron, monospace'; c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillText(A.util.fmt(S.pending * S.combo), cx + 2, 64);
    c.fillStyle = S.combo >= 4 ? '#ffd700' : '#ff8a00'; c.fillText(A.util.fmt(S.pending * S.combo), cx, 62);
    c.font = '700 12px Orbitron, monospace'; c.fillStyle = '#ffd36b'; c.fillText(`DRIFT ×${S.combo}  ·  ${Math.round(Math.abs(S.car.slip) * 57)}°`, cx, 84);
  } else if (S.combo > 1 && S.comboT > 0) {
    c.textAlign = 'center'; c.font = '700 12px Orbitron, monospace'; c.fillStyle = '#ffd36b';
    c.fillText(`CHAIN ×${S.combo} — DRIFT AGAIN`, cx, 70);
    c.fillStyle = 'rgba(255,211,107,0.6)'; c.fillRect(cx - 60, 78, 120 * (S.comboT / 2.6), 3);
  }
  if (S.banner) {
    const b = S.banner, k = Math.min(1, b.t * 3);
    c.globalAlpha = k; c.textAlign = 'center';
    c.font = '900 24px Orbitron, monospace'; c.fillStyle = b.color; c.fillText(b.text, cx, H * 0.26);
    c.font = '700 12px Orbitron, monospace'; c.fillStyle = '#ffffff'; c.fillText(b.sub, cx, H * 0.26 + 20);
    c.globalAlpha = 1;
  }
  // lap timer + bottom info
  c.textAlign = 'left'; c.font = '700 12px Orbitron, monospace'; c.fillStyle = 'rgba(255,255,255,0.75)';
  if (S.mode !== 'free') c.fillText(`LAP ${S.lap}/${S.laps}   ${A.util.fmtTime((S.t - S.lapStart) * 1000)}`, 14, H - 18);
  if (S.bestLap) { c.fillStyle = '#ffd36b'; c.fillText(`BEST ${A.util.fmtTime(S.bestLap)}`, 14, H - 36); }
  if (S.mode !== 'free') shell.setHud('lap', `${Math.min(S.lap, S.laps)}/${S.laps}`);
  // speed gauge
  const sp = Math.round(S.car.speed * 0.36);
  c.textAlign = 'right'; c.font = '900 28px Orbitron, monospace'; c.fillStyle = '#ffffff'; c.fillText(sp, W - 18, H - 20);
  c.font = '700 10px Orbitron, monospace'; c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillText('KM/H', W - 18, H - 52);
  if (S.wrongT > 1.2 && !S.over) { c.textAlign = 'center'; c.font = '900 26px Orbitron, monospace'; c.fillStyle = `rgba(255,42,109,${0.6 + Math.sin(t * 10) * 0.4})`; c.fillText('WRONG WAY', cx, H / 2 - 60); }
  if (S.countdown > 0) {
    const n = Math.ceil(S.countdown), k = S.countdown - Math.floor(S.countdown);
    c.textAlign = 'center'; c.font = `900 ${60 + k * 30}px Orbitron, monospace`; c.globalAlpha = 0.4 + k * 0.6;
    c.fillStyle = n > 0 ? '#ff8a00' : '#00ff66'; c.fillText(n > 0 ? n : 'GO', cx, H / 2 - 40); c.globalAlpha = 1;
    c.font = '700 12px Orbitron, monospace'; c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillText(document.body.classList.contains('touch') ? 'HOLD ▲ FOR GAS · TAP DRIFT INTO CORNERS' : 'HOLD ↑ FOR GAS · SPACE TO HANDBRAKE INTO CORNERS', cx, H / 2 + 10);
  }
}
})();
