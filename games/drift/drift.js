/* ============================================================
   VOID DRIFT™  ·  Neon Arcade edition
   Vector-space survival: thrust, wrap, split rocks, hunt
   saucers. Extra life every 10,000 points.
   © 2026 Neon Inc™
   ============================================================ */
(function () {
'use strict';
const A = window.Arcade, G = A.gfx;
const W = 720, H = 720;
const ROT = 4.4, THRUST = 400, DRAG = 0.45, MAXV = 540;
const BULLET_V = 680, BULLET_LIFE = 0.85, FIRE_CD = 0.15, MAX_BULLETS = 7;
const SIZES = { 3: { r: 46, pts: 20 }, 2: { r: 26, pts: 50 }, 1: { r: 14, pts: 100 } };
const ROCK_COLORS = ['#ffd700', '#ff8a00', '#ff2a6d', '#c04bff', '#00f0ff'];

let S = null;
const shell = GameShell.create({
  id: 'drift', width: W, height: H, music: 'drift',
  modes: [{ id: 'normal', name: 'SURVIVAL', desc: 'Endless waves.' }],
  hud: [{ id: 'score', label: 'SCORE', main: true }, { id: 'wave', label: 'WAVE' }, { id: 'lives', label: 'SHIPS', init: '▲▲▲', opt: true }],
  controls: [['← →', 'Rotate'], ['↑', 'Thrust'], ['SPACE', 'Fire'], ['SHIFT / H', 'Hyperspace'], ['P', 'Pause']],
  touch: {
    left: [{ key: 'ArrowLeft', label: '⟲' }, { key: 'ArrowRight', label: '⟳' }],
    right: [{ key: 'KeyH', label: 'HYP', aria: 'Hyperspace' }, { key: 'ArrowUp', label: '▲', aria: 'Thrust' }, { key: 'Space', label: '●', aria: 'Fire', wide: true }],
  },
  onStart, update, render, onKey,
  onMenu() { S = baseState(true); spawnWave(); },
});

const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random() }));

function baseState(demo = false) {
  return {
    demo, wave: 0, score: 0, lives: 3, nextLife: 10000,
    ship: { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, inv: 2.5, alive: true, thrust: false, respawn: 0, hyper: 0 },
    bullets: [], ebullets: [], rocks: [], ufo: null, ufoT: 16, fireCd: 0,
    rocksHit: 0, ufos: 0, shots: 0, hits: 0, t: 0, banner: 0, waveT: 0, camX: 0, camY: 0,
    dead: false, deadT: 0, debris: [],
  };
}
function onStart() {
  S = baseState(false); spawnWave();
  shell.setHud('score', 0); shell.setHud('wave', 1); shell.setHud('lives', '▲▲▲');
}

function makeRock(size, x, y, speedK = 1) {
  const r = SIZES[size].r, n = 9 + Math.floor(Math.random() * 4);
  const verts = Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; const rr = r * (0.72 + Math.random() * 0.36); return [Math.cos(a) * rr, Math.sin(a) * rr]; });
  const a = Math.random() * Math.PI * 2, sp = (40 + Math.random() * 60) * (4 - size) ** 0.55 * speedK;
  return { size, r, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 1.6, verts, color: ROCK_COLORS[(size * 2 + Math.floor(Math.random() * 2)) % ROCK_COLORS.length], hitT: 0 };
}
function spawnWave() {
  S.wave++;
  const n = Math.min(11, 3 + S.wave), k = 1 + (S.wave - 1) * 0.07;
  for (let i = 0; i < n; i++) {
    let x, y;
    do { x = Math.random() * W; y = Math.random() * H; } while (Math.hypot(x - S.ship.x, y - S.ship.y) < 200);
    S.rocks.push(makeRock(3, x, y, k));
  }
  S.banner = 2; S.ufoT = Math.max(9, 20 - S.wave);
  if (!S.demo) { shell.setHud('wave', S.wave, true); if (S.wave > 1) shell.sfx('unlock'); }
}

/* ─────────────────────────────────────────────────────────
   INPUT
───────────────────────────────────────────────────────── */
function onKey(code, down, e) {
  if (!down || e.repeat || !S || S.demo) return;
  if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyH') hyperspace();
}
function hyperspace() {
  const sh = S.ship; if (!sh.alive || sh.hyper > 0) return;
  shell.particles.emit(sh.x, sh.y, { n: 24, color: [shell.skin.ship, '#ffffff'], speed: 220, life: 0.5 });
  sh.x = 60 + Math.random() * (W - 120); sh.y = 60 + Math.random() * (H - 120); sh.vx = sh.vy = 0; sh.hyper = 3; sh.inv = Math.max(sh.inv, 0.6);
  shell.particles.emit(sh.x, sh.y, { n: 24, color: [shell.skin.ship, '#ffffff'], speed: 220, life: 0.5 });
  shell.tone(200, 0.3, 'sine', 0.15, 1600);
}
function fire() {
  const sh = S.ship;
  if (S.fireCd > 0 || S.bullets.length >= MAX_BULLETS || !sh.alive) return;
  S.fireCd = FIRE_CD; S.shots++;
  const nx = Math.cos(sh.a), ny = Math.sin(sh.a);
  S.bullets.push({ x: sh.x + nx * 16, y: sh.y + ny * 16, vx: nx * BULLET_V + sh.vx * 0.6, vy: ny * BULLET_V + sh.vy * 0.6, life: BULLET_LIFE });
  shell.tone(880, 0.06, 'square', 0.06, 440);
}

/* ─────────────────────────────────────────────────────────
   UPDATE
───────────────────────────────────────────────────────── */
const wrap = o => { if (o.x < -o.r) o.x += W + o.r * 2; if (o.x > W + o.r) o.x -= W + o.r * 2; if (o.y < -o.r) o.y += H + o.r * 2; if (o.y > H + o.r) o.y -= H + o.r * 2; };
const wrapP = o => { if (o.x < 0) o.x += W; if (o.x > W) o.x -= W; if (o.y < 0) o.y += H; if (o.y > H) o.y -= H; };

function update(dt) {
  if (!S) { S = baseState(true); spawnWave(); }
  S.t += dt;
  if (S.banner > 0) S.banner -= dt;
  for (const r of S.rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt; r.r = SIZES[r.size].r; wrap(r); if (r.hitT > 0) r.hitT -= dt; }
  for (let i = S.debris.length - 1; i >= 0; i--) { const d = S.debris[i]; d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.va * dt; d.life -= dt; if (d.life <= 0) S.debris.splice(i, 1); }
  if (S.demo) { S.ship.alive = false; return; }
  if (S.dead) { S.deadT += dt; return; }
  if (shell.state !== 'playing') return;

  const sh = S.ship;
  S.fireCd -= dt;
  if (sh.hyper > 0) sh.hyper -= dt;
  if (sh.alive) {
    if (sh.inv > 0) sh.inv -= dt;
    const rot = (shell.keys.has('ArrowLeft') || shell.keys.has('KeyA') ? -1 : 0) + (shell.keys.has('ArrowRight') || shell.keys.has('KeyD') ? 1 : 0);
    sh.a += rot * ROT * dt;
    sh.thrust = shell.keys.has('ArrowUp') || shell.keys.has('KeyW');
    if (sh.thrust) {
      sh.vx += Math.cos(sh.a) * THRUST * dt; sh.vy += Math.sin(sh.a) * THRUST * dt;
      if (Math.random() < 0.8) shell.particles.emit(sh.x - Math.cos(sh.a) * 12, sh.y - Math.sin(sh.a) * 12, { n: 1, color: [shell.skin.flame, '#ffffff'], speed: 160, angle: sh.a + Math.PI, spread: 0.5, vx: sh.vx, vy: sh.vy, life: 0.3, size: 2.4 });
    }
    const d = Math.exp(-DRAG * dt); sh.vx *= d; sh.vy *= d;
    const sp = Math.hypot(sh.vx, sh.vy); if (sp > MAXV) { sh.vx *= MAXV / sp; sh.vy *= MAXV / sp; }
    sh.x += sh.vx * dt; sh.y += sh.vy * dt; wrapP(sh);
    S.camX += sh.vx * dt; S.camY += sh.vy * dt;
    if (shell.keys.has('Space')) fire();
  } else if (S.lives > 0) {
    sh.respawn -= dt;
    if (sh.respawn <= 0 && !S.rocks.some(r => Math.hypot(r.x - W / 2, r.y - H / 2) < r.r + 90)) {
      Object.assign(sh, { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, inv: 2.5, alive: true });
    }
  }

  // bullets
  for (let i = S.bullets.length - 1; i >= 0; i--) {
    const b = S.bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; wrapP(b); b.life -= dt;
    let hit = false;
    for (let j = S.rocks.length - 1; j >= 0 && !hit; j--) { const r = S.rocks[j]; if ((b.x - r.x) ** 2 + (b.y - r.y) ** 2 < (r.r * 0.92) ** 2) { hit = true; splitRock(j, b); } }
    if (!hit && S.ufo && Math.hypot(b.x - S.ufo.x, b.y - S.ufo.y) < S.ufo.r + 3) { hit = true; killUfo(); }
    if (hit) { S.hits++; }
    if (hit || b.life <= 0) S.bullets.splice(i, 1);
  }
  // enemy bullets
  for (let i = S.ebullets.length - 1; i >= 0; i--) {
    const b = S.ebullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; wrapP(b); b.life -= dt;
    if (sh.alive && sh.inv <= 0 && Math.hypot(b.x - sh.x, b.y - sh.y) < 11) { S.ebullets.splice(i, 1); killShip(); continue; }
    if (b.life <= 0) S.ebullets.splice(i, 1);
  }
  // ship vs rocks
  if (sh.alive && sh.inv <= 0) for (let j = S.rocks.length - 1; j >= 0; j--) { const r = S.rocks[j]; if (Math.hypot(r.x - sh.x, r.y - sh.y) < r.r * 0.85 + 10) { splitRock(j, null); killShip(); break; } }
  // ufo
  updateUfo(dt);
  // next wave
  if (!S.rocks.length && !S.ufo) { S.waveT += dt; if (S.waveT > 1.6) { S.waveT = 0; spawnWave(); } }
}

function addScore(n, x, y, color) {
  S.score += n; shell.setHud('score', S.score, true);
  if (x != null) shell.floaters.add(x, y, '+' + n, color || '#ffffff', 14, 0.7);
  if (S.score >= S.nextLife) { S.nextLife += 10000; S.lives++; shell.setHud('lives', '▲'.repeat(Math.min(S.lives, 6))); shell.sfx('unlock'); shell.floaters.add(W / 2, H * 0.3, 'EXTRA SHIP', '#00ff66', 22, 1.4); }
}
function splitRock(j, bullet) {
  const r = S.rocks[j];
  S.rocks.splice(j, 1); S.rocksHit++;
  addScore(SIZES[r.size].pts, r.x, r.y - r.r, r.color);
  shell.particles.emit(r.x, r.y, { n: 6 + r.size * 6, color: [r.color, '#ffffff'], speed: 90 + r.size * 50, life: 0.7, size: 2.4 });
  for (let i = 0; i < r.size + 2; i++) S.debris.push({ x: r.x, y: r.y, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, a: Math.random() * 6, va: (Math.random() - 0.5) * 8, len: 4 + r.size * 4, life: 0.6, max: 0.6, color: r.color });
  if (r.size === 3) { shell.sfx('explode'); shell.shake(5); } else shell.sfx('small');
  if (r.size > 1) {
    const k = 1 + (S.wave - 1) * 0.07;
    for (let i = 0; i < 2; i++) {
      const nr = makeRock(r.size - 1, r.x, r.y, k);
      if (bullet) { const a = Math.atan2(bullet.vy, bullet.vx) + (i ? 0.7 : -0.7), sp = Math.hypot(nr.vx, nr.vy) * 1.1; nr.vx = Math.cos(a) * sp; nr.vy = Math.sin(a) * sp; }
      S.rocks.push(nr);
    }
  }
}
function killShip() {
  const sh = S.ship; if (!sh.alive) return;
  sh.alive = false; sh.respawn = 1.6; S.lives--;
  shell.sfx('explode'); shell.shake(14); shell.flash(shell.skin.ship, 0.35);
  shell.particles.emit(sh.x, sh.y, { n: 50, color: [shell.skin.ship, shell.skin.flame, '#ffffff'], speed: 300, life: 1, size: 3 });
  for (let i = 0; i < 6; i++) S.debris.push({ x: sh.x, y: sh.y, vx: (Math.random() - 0.5) * 160 + sh.vx * 0.3, vy: (Math.random() - 0.5) * 160 + sh.vy * 0.3, a: Math.random() * 6, va: (Math.random() - 0.5) * 6, len: 14, life: 1.4, max: 1.4, color: shell.skin.ship });
  shell.setHud('lives', S.lives > 0 ? '▲'.repeat(Math.min(S.lives, 6)) : '—');
  if (S.lives <= 0) {
    S.dead = true; S.deadT = 0; shell.sfx('gameover');
    const acc = S.shots ? Math.round(S.hits / S.shots * 100) : 0;
    shell.gameOver(
      { score: S.score, wave: S.wave, rocks: S.rocksHit, ufos: S.ufos, accuracy: acc, sharp: S.shots >= 30 && acc >= 60 },
      [['WAVE', S.wave], ['ROCKS', S.rocksHit], ['SAUCERS', S.ufos], ['ACCURACY', acc + '%']], 1300);
  }
}
function updateUfo(dt) {
  if (!S.ufo) {
    if (S.wave < 2 || S.demo) return;
    S.ufoT -= dt;
    if (S.ufoT <= 0) {
      const small = S.wave >= 5 && Math.random() < 0.5 + Math.min(0.3, S.wave * 0.02);
      const left = Math.random() < 0.5;
      S.ufo = { x: left ? -30 : W + 30, y: 80 + Math.random() * (H - 160), vx: (left ? 1 : -1) * (small ? 150 : 110), vy: 0, r: small ? 12 : 20, small, fireT: 1, zig: 2, dir: left ? 1 : -1 };
      shell.tone(300, 0.6, 'sawtooth', 0.06, 600);
    }
    return;
  }
  const u = S.ufo;
  u.zig -= dt; if (u.zig <= 0) { u.zig = 1 + Math.random() * 1.5; u.vy = (Math.random() - 0.5) * 180; }
  u.x += u.vx * dt; u.y += u.vy * dt; if (u.y < 30 || u.y > H - 30) u.vy *= -1;
  if (Math.sin(S.t * 14) > 0.95) shell.tone(u.small ? 1100 : 760, 0.05, 'square', 0.03);
  u.fireT -= dt;
  if (u.fireT <= 0 && S.ship.alive) {
    u.fireT = u.small ? 1.0 : 1.5;
    let a = Math.random() * Math.PI * 2;
    if (u.small) a = Math.atan2(S.ship.y - u.y, S.ship.x - u.x) + (Math.random() - 0.5) * Math.max(0.08, 0.5 - S.wave * 0.03);
    S.ebullets.push({ x: u.x, y: u.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, life: 1.6 });
    shell.tone(500, 0.08, 'square', 0.05, 250);
  }
  if ((u.dir > 0 && u.x > W + 40) || (u.dir < 0 && u.x < -40)) { S.ufo = null; S.ufoT = Math.max(8, 18 - S.wave); return; }
  for (let j = S.rocks.length - 1; j >= 0; j--) { const r = S.rocks[j]; if (Math.hypot(r.x - u.x, r.y - u.y) < r.r + u.r * 0.7) { S.ufo = null; S.ufoT = 12; shell.particles.emit(u.x, u.y, { n: 30, color: ['#ff00ff', '#ffffff'], speed: 260, life: 0.8 }); shell.sfx('explode'); return; } }
  if (S.ship.alive && S.ship.inv <= 0 && Math.hypot(S.ship.x - u.x, S.ship.y - u.y) < u.r + 10) { killUfo(true); killShip(); }
}
function killUfo(noScore) {
  const u = S.ufo; if (!u) return;
  if (!noScore) { S.ufos++; addScore(u.small ? 1000 : 200, u.x, u.y - 20, '#ff00ff'); }
  shell.particles.emit(u.x, u.y, { n: 44, color: ['#ff00ff', '#00f0ff', '#ffffff'], speed: 320, life: 0.9, size: 3 });
  shell.sfx('explode'); shell.shake(9); shell.flash('#ff00ff', 0.2);
  S.ufo = null; S.ufoT = Math.max(8, 18 - S.wave);
}

/* ─────────────────────────────────────────────────────────
   RENDER — vector lines with a cheap two-pass glow
───────────────────────────────────────────────────────── */
function glowPath(c, color, width, build) {
  c.beginPath(); build();
  c.strokeStyle = G.hexA(color, 0.18); c.lineWidth = width * 4; c.stroke();
  c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
const bg = () => G.sprite('drift-bg', W * 2, H * 2, c => {
  c.scale(2, 2);
  c.fillStyle = '#02020a'; c.fillRect(0, 0, W, H);
  const n1 = c.createRadialGradient(W * 0.25, H * 0.3, 0, W * 0.25, H * 0.3, 320); n1.addColorStop(0, 'rgba(192,75,255,0.16)'); n1.addColorStop(1, 'rgba(192,75,255,0)');
  c.fillStyle = n1; c.fillRect(0, 0, W, H);
  const n2 = c.createRadialGradient(W * 0.8, H * 0.75, 0, W * 0.8, H * 0.75, 280); n2.addColorStop(0, 'rgba(0,240,255,0.12)'); n2.addColorStop(1, 'rgba(0,240,255,0)');
  c.fillStyle = n2; c.fillRect(0, 0, W, H);
});
function drawShip(c, sh, t) {
  const sk = shell.skin;
  if (sh.inv > 0 && Math.sin(t * 30) < 0) return;
  c.save(); c.translate(sh.x, sh.y); c.rotate(sh.a);
  c.drawImage(G.softGlow(sk.ship, 34), -34, -34, 68, 68);
  c.lineJoin = 'round';
  glowPath(c, sk.ship, 2, () => { c.moveTo(18, 0); c.lineTo(-12, -11); c.lineTo(-7, 0); c.lineTo(-12, 11); c.closePath(); });
  if (sh.thrust && Math.random() < 0.85) glowPath(c, sk.flame, 2, () => { c.moveTo(-9, -5); c.lineTo(-18 - Math.random() * 10, 0); c.lineTo(-9, 5); });
  c.restore();
}
function render(c, alpha, t) {
  if (!S) return;
  c.drawImage(bg(), 0, 0, W, H);
  const sh = S.ship;
  for (const s of stars) {
    const px = ((s.x - S.camX * s.z * 0.12 + S.t * 4 * s.z) % W + W) % W, py = ((s.y - S.camY * s.z * 0.12) % H + H) % H;
    c.fillStyle = `rgba(255,255,255,${0.15 + s.z * 0.55})`; c.fillRect(px, py, s.z * 1.8 + 0.4, s.z * 1.8 + 0.4);
  }
  c.lineJoin = 'round';
  for (const r of S.rocks) {
    const col = r.hitT > 0 ? '#ffffff' : r.color;
    c.save(); c.translate(r.x, r.y); c.rotate(r.rot);
    c.fillStyle = G.hexA(r.color, 0.06);
    glowPath(c, col, 2, () => { r.verts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); });
    c.fill();
    c.restore();
    // draw wrapped ghost near edges so rocks slide smoothly across borders
    for (const [ox, oy] of [[W, 0], [-W, 0], [0, H], [0, -H]]) {
      const gx = r.x + ox, gy = r.y + oy;
      if (gx > -r.r && gx < W + r.r && gy > -r.r && gy < H + r.r) {
        c.save(); c.translate(gx, gy); c.rotate(r.rot);
        glowPath(c, col, 2, () => { r.verts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); });
        c.restore();
      }
    }
  }
  for (const d of S.debris) {
    c.globalAlpha = d.life / d.max;
    c.save(); c.translate(d.x, d.y); c.rotate(d.a);
    c.strokeStyle = d.color; c.lineWidth = 2; c.beginPath(); c.moveTo(-d.len / 2, 0); c.lineTo(d.len / 2, 0); c.stroke(); c.restore();
  }
  c.globalAlpha = 1;
  if (S.ufo) {
    const u = S.ufo, k = u.r / 20;
    c.save(); c.translate(u.x, u.y);
    c.drawImage(G.softGlow('#ff00ff', 40), -40, -40, 80, 80);
    glowPath(c, '#ff00ff', 2, () => { c.moveTo(-22 * k, 0); c.lineTo(22 * k, 0); c.lineTo(12 * k, 8 * k); c.lineTo(-12 * k, 8 * k); c.closePath(); c.moveTo(-22 * k, 0); c.lineTo(-12 * k, -7 * k); c.lineTo(12 * k, -7 * k); c.lineTo(22 * k, 0); c.moveTo(-6 * k, -7 * k); c.lineTo(-4 * k, -14 * k); c.lineTo(4 * k, -14 * k); c.lineTo(6 * k, -7 * k); });
    c.restore();
  }
  for (const b of S.bullets) { c.drawImage(G.glowDot(shell.skin.flame, 12), b.x - 9, b.y - 9, 18, 18); c.fillStyle = shell.skin.bullet; c.fillRect(b.x - 1.5, b.y - 1.5, 3, 3); }
  for (const b of S.ebullets) { c.drawImage(G.glowDot('#ff00ff', 12), b.x - 10, b.y - 10, 20, 20); }
  if (!S.demo && sh.alive) drawShip(c, sh, t);
  shell.particles.draw(c);
  shell.floaters.draw(c);
  if (!S.demo && S.banner > 0) {
    c.globalAlpha = Math.min(1, S.banner); c.textAlign = 'center'; c.font = '900 36px Orbitron, monospace'; c.fillStyle = '#ffd700';
    c.fillText(`WAVE ${S.wave}`, W / 2, H * 0.32); c.globalAlpha = 1;
  }
  if (!S.demo && !sh.alive && S.lives > 0) { c.textAlign = 'center'; c.font = '700 14px Orbitron, monospace'; c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillText('REDEPLOYING…', W / 2, H / 2 + 50); }
  if (!S.demo && sh.hyper > 0 && sh.alive) { c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(14, H - 18, 80, 4); c.fillStyle = shell.skin.ship; c.fillRect(14, H - 18, 80 * (1 - sh.hyper / 3), 4); c.font = '700 9px Orbitron, monospace'; c.textAlign = 'left'; c.fillText('HYPERSPACE', 14, H - 24); }
}
})();
