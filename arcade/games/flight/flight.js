/* ============================================================
   NEON FLIGHT™ v4  ·  Neon Arcade edition
   Flap through the pillars, grab shards, chain combos, cross
   six realms and survive the score-42 system error.
   © 2026 Neon Inc™
   ============================================================ */
(function () {
'use strict';
const A = window.Arcade, G = A.gfx;
const W = 640, H = 720, GROUND = H - 56;
const PX = 168, PR = 16;
const GRAV = 1750, FLAP = -575, MAXV = 880;
const PW = 74;

const REALMS = [
  { at: 0,   name: 'CYBER GRID',    sky: ['#03031a', '#0a0630'], c1: '#00f0ff', c2: '#ff00ff', fx: 'grid' },
  { at: 15,  name: 'NEON SKYLINE',  sky: ['#12031e', '#2a0738'], c1: '#ff2bd6', c2: '#00f0ff', fx: 'city' },
  { at: 30,  name: 'VOID PULSE',    sky: ['#05010f', '#160433'], c1: '#a64bff', c2: '#00f0ff', fx: 'stars' },
  { at: 50,  name: 'STATIC STORM',  sky: ['#010a06', '#04170d'], c1: '#00ff66', c2: '#d4ff00', fx: 'rain' },
  { at: 75,  name: 'HELL REALM',    sky: ['#140100', '#3a0600'], c1: '#ff3b00', c2: '#ffb300', fx: 'embers' },
  { at: 100, name: 'HEAVEN REALM',  sky: ['#0d1430', '#4a6ea8'], c1: '#e8fbff', c2: '#ffd86b', fx: 'clouds' },
];
const realmIndex = s => { let r = 0; REALMS.forEach((x, i) => { if (s >= x.at) r = i; }); return r; };

let S = null;
const shell = GameShell.create({
  id: 'flight', width: W, height: H, music: 'flight',
  modes: [{ id: 'normal', name: 'FLIGHT', desc: 'Endless run.' }],
  hud: [{ id: 'score', label: 'SCORE', main: true }, { id: 'best', label: 'BEST' }, { id: 'shards', label: 'SHARDS', opt: true }],
  controls: [['SPACE / ↑ / CLICK', 'Flap'], ['TAP', 'Flap on touch'], ['P', 'Pause'], ['M', 'Music']],
  onStart, update, render, onKey,
  onMenu() { shell.setHud('best', A.state().games.flight.best); S = fresh(true); },
});

function fresh(idle) {
  return {
    idle, ready: !idle, dead: false, deadT: 0, t: 0,
    y: H * 0.45, vy: 0, rot: 0, squash: 1, flapT: 0,
    score: 0, shards: 0, combo: 0, comboT: 0, maxCombo: 0,
    pillars: [], gems: [], dist: 0, nextAt: 380, lastGapY: H * 0.45,
    realm: 0, realmFrom: 0, realmBlend: 1, banner: 0,
    glitch: 0, glitched: false, glitchSurvived: false,
    scroll: 0, blink: 0,
  };
}
function onStart() { S = fresh(false); shell.setHud('score', 0); shell.setHud('shards', 0); shell.setHud('best', A.state().games.flight.best); }

/* difficulty: smooth curves, no sudden jumps */
const speed = s => 235 + 215 * (1 - Math.pow(1 - Math.min(s, 120) / 120, 2.2));
const gap = s => Math.max(158, 232 - 74 * (1 - Math.pow(1 - Math.min(s, 100) / 100, 1.6)));
const spacing = s => Math.max(255, 330 - Math.min(s, 80));

function flap() {
  if (!S || S.dead || shell.state !== 'playing') return;
  if (S.ready) { S.ready = false; }
  S.vy = FLAP; S.squash = 0.72; S.flapT = 0.12;
  shell.tone(330 + Math.random() * 40, 0.1, 'triangle', 0.12, 560);
  shell.particles.emit(PX - 10, S.y + 8, { n: 5, color: shell.skin.trail, speed: 90, angle: Math.PI * 0.75, spread: 1, life: 0.35, size: 2.4 });
}
function onKey(code, down, e) {
  if (!down || e.repeat) return;
  if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') flap();
}
document.querySelector('.gs-stage').addEventListener('pointerdown', e => {
  if (e.target.closest('button,a,.gs-ov.show')) return;
  if (shell.state === 'playing') { e.preventDefault(); flap(); }
});

function spawnPillar() {
  const g = gap(S.score);
  const minY = 70 + g / 2, maxY = GROUND - 50 - g / 2;
  const maxShift = 210 + Math.min(S.score, 60);
  let cy = minY + Math.random() * (maxY - minY);
  cy = Math.max(S.lastGapY - maxShift, Math.min(S.lastGapY + maxShift, cy));
  S.lastGapY = cy;
  const p = { x: W + PW, cy, g, passed: false, moving: S.score >= 35 && Math.random() < 0.35, ph: Math.random() * 6, base: cy };
  S.pillars.push(p);
  if (Math.random() < 0.58) { const off = (Math.random() - 0.5) * g * 0.4; S.gems.push({ x: p.x + PW / 2, y: cy + off, off, got: false, bob: Math.random() * 6, pillar: p }); }
  else if (Math.random() < 0.5) S.gems.push({ x: p.x + PW / 2 + spacing(S.score) / 2, y: Math.max(90, Math.min(GROUND - 90, cy + (Math.random() - 0.5) * 160)), got: false, bob: Math.random() * 6 });
}

function update(dt) {
  if (!S) S = fresh(true);
  S.t += dt; S.blink -= dt; if (S.blink < -3) S.blink = 0.14;
  S.squash += (1 - S.squash) * Math.min(1, dt * 12);
  if (S.realmBlend < 1) S.realmBlend = Math.min(1, S.realmBlend + dt * 0.6);
  if (S.banner > 0) S.banner -= dt;
  if (S.idle || S.ready) {
    S.y = H * 0.45 + Math.sin(S.t * 2.6) * 12; S.rot = 0;
    S.scroll += 120 * dt;
    if (S.idle || S.ready) return;
  }
  if (S.dead) {
    S.deadT += dt;
    if (S.y < GROUND - PR) { S.vy = Math.min(MAXV, S.vy + GRAV * dt); S.y = Math.min(GROUND - PR, S.y + S.vy * dt); S.rot = Math.min(Math.PI / 2, S.rot + dt * 6); }
    return;
  }
  if (shell.state !== 'playing') return;

  const sp = speed(S.score) * (S.glitch > 0 ? 1.06 : 1);
  S.scroll += sp * dt; S.dist += sp * dt;
  // physics
  S.vy = Math.min(MAXV, S.vy + GRAV * dt);
  S.y += S.vy * dt;
  if (S.y < PR) { S.y = PR; S.vy = Math.max(0, S.vy); }
  const targetRot = S.vy < 0 ? -0.42 : Math.min(1.25, S.vy / 620);
  S.rot += (targetRot - S.rot) * Math.min(1, dt * (S.vy < 0 ? 18 : 6));
  if (S.vy > 200) S.squash = Math.min(S.squash, 1.0);
  // trail
  if (Math.random() < 0.6) shell.particles.emit(PX - 12, S.y + (Math.random() - 0.5) * 6, { n: 1, color: shell.skin.trail, speed: 40, vx: -sp * 0.5, life: 0.45, size: 2.2, drag: 0.5 });

  // pillars
  if (S.dist >= S.nextAt) { S.nextAt = S.dist + spacing(S.score); spawnPillar(); }
  for (let i = S.pillars.length - 1; i >= 0; i--) {
    const p = S.pillars[i];
    p.x -= sp * dt;
    if (p.moving) p.cy = Math.max(70 + p.g / 2, Math.min(GROUND - 50 - p.g / 2, p.base + Math.sin(S.t * 1.6 + p.ph) * 46));
    if (!p.passed && p.x + PW < PX - PR) { p.passed = true; addScore(); }
    if (p.x < -PW - 20) S.pillars.splice(i, 1);
    // collision (circle vs two rects, slightly forgiving)
    const r = PR - 3;
    if (PX + r > p.x && PX - r < p.x + PW) {
      const top = p.cy - p.g / 2, bot = p.cy + p.g / 2;
      const cx = Math.max(p.x, Math.min(PX, p.x + PW));
      if (S.y - r < top) { const cyy = Math.min(S.y, top); if (Math.hypot(PX - cx, S.y - cyy) < r || S.y < top) return die(); }
      if (S.y + r > bot) { const cyy = Math.max(S.y, bot); if (Math.hypot(PX - cx, S.y - cyy) < r || S.y > bot) return die(); }
    }
  }
  // gems
  for (let i = S.gems.length - 1; i >= 0; i--) {
    const g = S.gems[i];
    g.x -= sp * dt;
    if (g.pillar) g.y = g.pillar.cy + g.off;
    if (!g.got && Math.hypot(g.x - PX, g.y - S.y) < PR + 14) collect(g);
    if (g.x < -30) S.gems.splice(i, 1);
  }
  if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0; }
  if (S.glitch > 0) { S.glitch -= dt; }
  if (S.y + PR >= GROUND) { S.y = GROUND - PR; die(); }
}

function addScore() {
  S.score++;
  shell.setHud('score', S.score, true);
  shell.tone(660, 0.06, 'square', 0.07);
  const r = realmIndex(S.score);
  if (r !== S.realm) {
    S.realmFrom = S.realm; S.realm = r; S.realmBlend = 0; S.banner = 2.6;
    shell.sfx('unlock'); shell.flash(REALMS[r].c1, 0.25);
  }
  if (S.score === 42 && !S.glitched) { S.glitched = true; S.glitch = 5; shell.sfx('explode'); shell.noise(0.8, 0.3, 300, 0.5); shell.shake(10); }
  if (S.glitched && !S.glitchSurvived && S.score >= 46) {
    S.glitchSurvived = true; S.shards += 25; shell.setHud('shards', S.shards, true);
    shell.floaters.add(W / 2, H * 0.3, 'GLITCH SURVIVED +25💎', '#ff3d8b', 22, 1.6); shell.sfx('achieve');
  }
}
function collect(g) {
  g.got = true;
  S.combo = S.comboT > 0 ? S.combo + 1 : 1; S.comboT = 2.8;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  const v = 1 + Math.floor((S.combo - 1) / 2);
  S.shards += v;
  shell.setHud('shards', S.shards, true);
  shell.floaters.add(g.x, g.y - 18, S.combo > 1 ? `+${v} ×${S.combo}` : `+${v}`, '#7df9ff', 16);
  shell.particles.emit(g.x, g.y, { n: 14, color: ['#7df9ff', '#ffffff', REALMS[S.realm].c2], speed: 180, life: 0.5, size: 2.4 });
  shell.sfx('combo', S.combo + 4);
  S.gems.splice(S.gems.indexOf(g), 1);
}
function die() {
  if (S.dead) return;
  S.dead = true; S.deadT = 0; S.vy = -260;
  shell.sfx('explode'); shell.sfx('gameover'); shell.shake(13); shell.flash('#ffffff', 0.45);
  shell.particles.emit(PX, S.y, { n: 46, color: [shell.skin.body, '#ffffff', shell.skin.trail], speed: 320, life: 0.9, size: 3 });
  shell.gameOver(
    { score: S.score, shards: S.shards, maxCombo: S.maxCombo, realm: S.realm, glitch: S.glitchSurvived },
    [['SHARDS', S.shards], ['MAX COMBO', '×' + S.maxCombo], ['REALM', REALMS[S.realm].name], ['DISTANCE', Math.round(S.dist / 10) + 'm']],
    1100,
  );
}

/* ─────────────────────────────────────────────────────────
   RENDER
───────────────────────────────────────────────────────── */
const stars = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * GROUND, z: 0.2 + Math.random() * 0.8 }));
const city = Array.from({ length: 22 }, (_, i) => ({ x: i * 46, w: 30 + Math.random() * 26, h: 70 + Math.random() * 200, win: Math.random() }));
const rain = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 300 + Math.random() * 400 }));
const clouds = Array.from({ length: 9 }, () => ({ x: Math.random() * W * 1.4, y: 60 + Math.random() * (GROUND - 200), s: 0.5 + Math.random() * 0.8 }));

function realmMix(key) {
  const a = REALMS[S.realmFrom][key], b = REALMS[S.realm][key], k = S.realmBlend;
  if (Array.isArray(a)) return a.map((c, i) => G.mixHex(c, b[i], k));
  return G.mixHex(a, b, k);
}
function drawBackground(c, t) {
  const sky = realmMix('sky');
  const gr = c.createLinearGradient(0, 0, 0, GROUND);
  gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]);
  c.fillStyle = gr; c.fillRect(0, 0, W, H);
  const c1 = realmMix('c1'), c2 = realmMix('c2');
  const layers = [REALMS[S.realm].fx];
  if (S.realmBlend < 1) layers.unshift(REALMS[S.realmFrom].fx);
  layers.forEach((fx, li) => {
    c.globalAlpha = layers.length > 1 ? (li === 0 ? 1 - S.realmBlend : S.realmBlend) : 1;
    drawFx(c, fx, t, c1, c2);
  });
  c.globalAlpha = 1;
  // horizon glow
  const hg = c.createLinearGradient(0, GROUND - 140, 0, GROUND);
  hg.addColorStop(0, G.hexA(c2, 0)); hg.addColorStop(1, G.hexA(c2, 0.22));
  c.fillStyle = hg; c.fillRect(0, GROUND - 140, W, 140);
  // ground: perspective grid
  c.fillStyle = '#020208'; c.fillRect(0, GROUND, W, H - GROUND);
  c.strokeStyle = c1; c.lineWidth = 2; c.beginPath(); c.moveTo(0, GROUND); c.lineTo(W, GROUND); c.stroke();
  c.strokeStyle = G.hexA(c1, 0.35); c.lineWidth = 1;
  const off = (S.scroll * 0.9) % 40;
  for (let x = -off - 400; x < W + 400; x += 40) { c.beginPath(); c.moveTo(x, GROUND); c.lineTo(W / 2 + (x - W / 2) * 3, H); c.stroke(); }
  for (let k = 1; k < 5; k++) { const y = GROUND + (H - GROUND) * Math.pow(k / 5, 1.6); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
}
function drawFx(c, fx, t, c1, c2) {
  if (fx === 'grid') {
    c.strokeStyle = G.hexA(c1, 0.07); c.lineWidth = 1;
    const o = (S.scroll * 0.25) % 48;
    for (let x = -o; x < W; x += 48) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, GROUND); c.stroke(); }
    for (let y = 0; y < GROUND; y += 48) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.drawImage(G.softGlow(c2, 160), W * 0.7 - 160, 120 - 160, 320, 320);
  } else if (fx === 'city' || fx === 'stars' || fx === 'clouds') {
    for (const s of stars) {
      const x = ((s.x - S.scroll * 0.05 * s.z) % W + W) % W;
      c.globalAlpha *= 1; c.fillStyle = fx === 'clouds' ? 'rgba(255,255,255,0.5)' : G.hexA('#ffffff', 0.3 + s.z * 0.5);
      const sz = fx === 'stars' ? s.z * 2.4 : s.z * 1.6;
      c.fillRect(x, s.y * (fx === 'city' ? 0.6 : 1), sz, sz);
    }
    if (fx === 'stars') { c.drawImage(G.softGlow(c1, 200), W * 0.3 - 200, 220 - 200, 400, 400); c.drawImage(G.softGlow(c2, 120), W * 0.8 - 120, 420 - 120, 240, 240); }
    if (fx === 'city') {
      // sun
      const sx = W * 0.62, sy = GROUND - 150;
      const sg = c.createLinearGradient(0, sy - 110, 0, sy + 110); sg.addColorStop(0, '#ffd86b'); sg.addColorStop(1, c1);
      c.fillStyle = sg; c.beginPath(); c.arc(sx, sy, 110, Math.PI, 0); c.fill();
      c.fillStyle = REALMS[1].sky[1]; for (let k = 0; k < 6; k++) c.fillRect(sx - 120, sy - 60 + k * 12, 240, 2 + k);
      for (const b of city) {
        const x = ((b.x - S.scroll * 0.3) % (city.length * 46) + city.length * 46) % (city.length * 46) - 50;
        c.fillStyle = '#0a0216'; c.fillRect(x, GROUND - b.h, b.w, b.h);
        c.strokeStyle = G.hexA(c1, 0.5); c.lineWidth = 1; c.strokeRect(x + 0.5, GROUND - b.h + 0.5, b.w - 1, b.h);
        c.fillStyle = G.hexA(c2, 0.45);
        for (let wy = GROUND - b.h + 10; wy < GROUND - 10; wy += 14) for (let wx = x + 5; wx < x + b.w - 6; wx += 9) if (((wx * 7 + wy * 13) | 0) % 5 < b.win * 3) c.fillRect(wx, wy, 3, 5);
      }
    }
    if (fx === 'clouds') {
      for (const cl of clouds) {
        const x = ((cl.x - S.scroll * 0.15 * cl.s) % (W * 1.4) + W * 1.4) % (W * 1.4) - 150;
        c.drawImage(G.softGlow('#ffffff', 90), x - 90 * cl.s * 1.6, cl.y - 50 * cl.s, 180 * cl.s * 1.6, 100 * cl.s);
      }
      c.drawImage(G.softGlow('#ffd86b', 220), W * 0.5 - 220, -120, 440, 440);
    }
  } else if (fx === 'rain') {
    c.strokeStyle = G.hexA(c1, 0.35); c.lineWidth = 1.5;
    for (const r of rain) {
      r.y += r.s * 0.016; if (r.y > GROUND) { r.y = -20; r.x = Math.random() * W; }
      c.beginPath(); c.moveTo(r.x, r.y); c.lineTo(r.x - 4, r.y + 16); c.stroke();
    }
    c.font = '700 14px monospace'; c.fillStyle = G.hexA(c1, 0.12);
    for (let i = 0; i < 18; i++) c.fillText(String.fromCharCode(0x30A0 + ((i * 7 + (t * 6 | 0)) % 90)), (i * 37 - S.scroll * 0.1) % W + W * ((i * 37 - S.scroll * 0.1) % W < 0 ? 1 : 0), (i * 97 + t * 80) % GROUND);
  } else if (fx === 'embers') {
    c.drawImage(G.softGlow('#ff2a00', 260), W / 2 - 260, GROUND - 160, 520, 320);
    for (let i = 0; i < 40; i++) {
      const x = (i * 83 - S.scroll * 0.2 + Math.sin(t + i) * 20) % W, y = GROUND - ((t * (40 + i * 3) + i * 57) % GROUND);
      c.fillStyle = i % 3 ? '#ff6a00' : '#ffd000'; c.globalAlpha *= 1; c.fillRect((x + W) % W, y, 2.5, 2.5);
    }
  }
}

function drawPillar(c, p, c1, c2, t) {
  const top = p.cy - p.g / 2, bot = p.cy + p.g / 2;
  const glitchy = S.glitch > 0 && Math.random() < 0.08;
  const col = glitchy ? '#ffffff' : c1;
  for (const [y0, y1, cap] of [[-10, top, top], [bot, GROUND, bot]]) {
    const h = y1 - y0; if (h <= 0) continue;
    const gr = c.createLinearGradient(p.x, 0, p.x + PW, 0);
    gr.addColorStop(0, G.hexA(col, 0.10)); gr.addColorStop(0.5, G.hexA(col, 0.22)); gr.addColorStop(1, G.hexA(col, 0.06));
    c.fillStyle = gr; c.fillRect(p.x, y0, PW, h);
    c.strokeStyle = G.hexA(col, 0.25); c.lineWidth = 8; c.strokeRect(p.x, y0, PW, h);
    c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(p.x + 1, y0, PW - 2, h);
    // cap
    c.fillStyle = c2; c.fillRect(p.x - 6, cap === top ? top - 12 : bot, PW + 12, 12);
    c.fillStyle = G.hexA('#ffffff', 0.6); c.fillRect(p.x - 6, cap === top ? top - 12 : bot, PW + 12, 2);
  }
  if (p.moving) { c.fillStyle = G.hexA(c2, 0.8); c.font = '900 10px Orbitron, monospace'; c.textAlign = 'center'; c.fillText('↕', p.x + PW / 2, p.cy); }
}

function drawPlayer(c, t) {
  const sk = shell.skin;
  c.save();
  c.translate(PX, S.y);
  c.drawImage(G.softGlow(sk.body, 46), -46, -46, 92, 92);
  c.rotate(S.rot);
  const sx = 1 / Math.sqrt(S.squash), sy = S.squash;
  c.scale(sx, sy);
  c.fillStyle = sk.body;
  if (sk.shape === 'cube') { c.beginPath(); c.roundRect(-PR, -PR, PR * 2, PR * 2, 6); c.fill(); }
  else { c.beginPath(); c.arc(0, 0, PR, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(-5, -8, 6, 3.5, -0.4, 0, Math.PI * 2); c.fill();
  drawEyes(c, sk, t);
  c.restore();
}
function drawEyes(c, sk, t) {
  const closed = S.blink > 0 && !S.dead;
  const style = S.dead ? 'dead' : sk.eyes;
  const ec = sk.eye;
  c.fillStyle = ec; c.strokeStyle = ec; c.lineWidth = 2.2; c.lineCap = 'round';
  for (const ex of [-1, 7]) {
    const x = ex + 1, y = -2;
    if (style === 'dead') { c.beginPath(); c.moveTo(x - 3, y - 3); c.lineTo(x + 3, y + 3); c.moveTo(x + 3, y - 3); c.lineTo(x - 3, y + 3); c.stroke(); continue; }
    if (closed) { c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x + 3, y); c.stroke(); continue; }
    switch (style) {
      case 'visor': if (ex === -1) { c.fillRect(-6, y - 3, 18, 5); c.fillStyle = '#000'; c.fillRect(-2 + Math.sin(t * 3) * 3, y - 2, 4, 3); c.fillStyle = ec; } break;
      case 'pixel': c.fillRect(x - 3, y - 3, 5, 5); c.fillStyle = '#000'; c.fillRect(x - 1, y - 1, 2, 2); c.fillStyle = ec; break;
      case 'happy': c.beginPath(); c.arc(x, y + 1, 3.2, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); break;
      case 'angry': c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(x - 4, y - 6 + (ex < 0 ? 0 : 2)); c.lineTo(x + 4, y - 6 + (ex < 0 ? 2 : 0)); c.stroke(); break;
      case 'heart': heart(c, x, y, 3.6); break;
      case 'stars': star(c, x, y, 4.2, t); break;
      default: c.beginPath(); c.arc(x, y, 3.2, 0, Math.PI * 2); c.fill(); c.fillStyle = '#05051a'; c.beginPath(); c.arc(x + 1, y + Math.max(-1, Math.min(1.5, S.vy / 400)), 1.5, 0, Math.PI * 2); c.fill(); c.fillStyle = ec;
    }
  }
}
function heart(c, x, y, r) { c.beginPath(); c.moveTo(x, y + r); c.bezierCurveTo(x - r * 1.8, y - r * 0.2, x - r * 0.6, y - r * 1.6, x, y - r * 0.4); c.bezierCurveTo(x + r * 0.6, y - r * 1.6, x + r * 1.8, y - r * 0.2, x, y + r); c.fill(); }
function star(c, x, y, r, t) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + t * 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.fill(); }

function drawGem(c, g, t) {
  const y = g.y + Math.sin(t * 4 + g.bob) * 4;
  c.drawImage(G.glowDot('#7df9ff', 22), g.x - 22, y - 22, 44, 44);
  c.save(); c.translate(g.x, y); c.rotate(Math.sin(t * 2 + g.bob) * 0.3);
  c.fillStyle = '#7df9ff'; c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 0); c.lineTo(0, 11); c.lineTo(-8, 0); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.moveTo(0, -11); c.lineTo(3, -2); c.lineTo(-3, -2); c.closePath(); c.fill();
  c.restore();
}

function render(c, alpha, t) {
  if (!S) S = fresh(true);
  drawBackground(c, t);
  const c1 = realmMix('c1'), c2 = realmMix('c2');
  for (const p of S.pillars) drawPillar(c, p, c1, c2, t);
  for (const g of S.gems) drawGem(c, g, t);
  shell.particles.draw(c);
  if (!(S.dead && S.deadT > 1.2)) drawPlayer(c, t);
  shell.floaters.draw(c);

  // combo meter
  if (S.combo > 1 && S.comboT > 0) {
    c.font = '900 14px Orbitron, monospace'; c.textAlign = 'left'; c.fillStyle = '#7df9ff';
    c.fillText(`SHARD COMBO ×${S.combo}`, 14, 28);
    c.fillStyle = 'rgba(125,249,255,0.6)'; c.fillRect(14, 36, 140 * (S.comboT / 2.8), 3);
  }
  // realm banner
  if (S.banner > 0) {
    const k = Math.min(1, S.banner, (2.6 - S.banner) * 3);
    c.globalAlpha = k; c.textAlign = 'center';
    c.font = '700 12px Orbitron, monospace'; c.fillStyle = '#ffffff'; c.fillText('ENTERING', W / 2, H * 0.24);
    c.font = '900 34px Orbitron, monospace'; c.fillStyle = REALMS[S.realm].c1; c.fillText(REALMS[S.realm].name, W / 2, H * 0.24 + 40);
    c.globalAlpha = 1;
  }
  // ready prompt
  if (S.ready && !S.idle) {
    c.textAlign = 'center'; c.font = '900 22px Orbitron, monospace'; c.fillStyle = shell.game.color;
    c.globalAlpha = 0.6 + Math.sin(t * 4) * 0.4; c.fillText('TAP / SPACE TO FLY', W / 2, H * 0.32); c.globalAlpha = 1;
  }
  // glitch post-fx
  if (S.glitch > 0 && !shell.reduceMotion()) {
    const k = Math.min(1, S.glitch);
    for (let i = 0; i < 7; i++) {
      const y = Math.random() * H, h = 4 + Math.random() * 30, dx = (Math.random() - 0.5) * 40 * k;
      c.drawImage(shell.canvas, 0, y * shell.canvas.width / W, shell.canvas.width, h * shell.canvas.width / W, dx, y, W, h);
    }
    c.fillStyle = `rgba(255,0,60,${0.08 * k})`; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'difference'; c.fillStyle = `rgba(0,255,255,${Math.random() < 0.1 ? 0.6 : 0})`; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
    c.textAlign = 'center'; c.font = '900 26px Orbitron, monospace'; c.fillStyle = Math.random() < 0.5 ? '#ff2a6d' : '#00f0ff';
    c.fillText('SYSTEM ERROR 0x2A', W / 2 + (Math.random() - 0.5) * 8, H * 0.18);
  }
}
})();
