/* ============================================================
   MIND MATCH™  ·  Neon Arcade edition
   Flip cards, remember the symbols, match the pairs.
   Arcade: six stages of growing grids against the clock.
   Relax: one 24-card board, no timer, fewest moves wins.
   © 2026 Neon Inc™
   ============================================================ */
(function () {
'use strict';
const A = window.Arcade, G = A.gfx;
const PORTRAIT = window.matchMedia && matchMedia('(max-aspect-ratio: 4/5)').matches;
const W = PORTRAIT ? 540 : 780, H = PORTRAIT ? 780 : 620;
const STAGES = [[4, 3], [4, 4], [5, 4], [6, 4], [6, 5], [6, 6]];
const MODES = [
  { id: 'arcade', name: 'ARCADE', desc: 'Six stages, bigger grids, beat the clock.' },
  { id: 'relax',  name: 'RELAX', desc: 'One 24-card board, no timer. Fewest moves wins.' },
];
const SYMBOLS = [
  ['circle', '#00f0ff'], ['triangle', '#ff2a6d'], ['square', '#ffe600'], ['diamond', '#00ff66'], ['star', '#ffd700'], ['hex', '#c04bff'],
  ['heart', '#ff4fd8'], ['bolt', '#ffb300'], ['ring', '#4d7cff'], ['cross', '#ff6a00'], ['moon', '#e8f0ff'], ['arrow', '#19ffd2'],
  ['spiral', '#b6ff00'], ['eye', '#ff77aa'], ['note', '#7df9ff'], ['crown', '#ffcc33'], ['flower', '#ff5ea8'], ['planet', '#9a7bff'],
];

let S = null;
const shell = GameShell.create({
  id: 'memory', width: W, height: H, music: 'memory', modes: MODES,
  hud: [{ id: 'score', label: 'SCORE', main: true }, { id: 'stage', label: 'STAGE', init: '1/6' }, { id: 'time', label: 'TIME', opt: true }],
  controls: [['CLICK / TAP', 'Flip a card'], ['ARROWS', 'Move'], ['ENTER / SPACE', 'Flip'], ['P', 'Pause']],
  overTitle: res => res.mode === 'relax' ? 'BOARD CLEARED' : S && S.won ? 'ALL STAGES CLEAR' : "TIME'S UP",
  onStart, update, render, onKey,
  onMenu() { S = null; },
});

/* ─────────────────────────────────────────────────────────
   SETUP
───────────────────────────────────────────────────────── */
function onStart(mode) {
  S = { mode, stage: 0, score: 0, pairs: 0, combo: 0, maxCombo: 0, moves: 0, mismatchesStage: 0, perfect: false, zen30: false,
        time: 0, cleared: 0, over: false, won: false, cards: [], open: [], lockT: 0, peek: 0, cursor: 0, t: 0, banner: null, mouse: null };
  buildStage();
  shell.setHud('score', 0);
}
function buildStage() {
  let [cols, rows] = S.mode === 'relax' ? [6, 4] : STAGES[S.stage];
  if (PORTRAIT && cols > rows) [cols, rows] = [rows, cols];
  const n = cols * rows / 2;
  const syms = SYMBOLS.slice().sort(() => Math.random() - 0.5).slice(0, n);
  const deck = syms.concat(syms).map((s, i) => ({ sym: s[0], color: s[1], id: i }));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const top = 70, pad = 18, gap = PORTRAIT ? 10 : 12;
  const cw = Math.min((W - pad * 2 - gap * (cols - 1)) / cols, ((H - top - pad) - gap * (rows - 1)) / rows / 1.3);
  const ch = cw * 1.3;
  const ox = (W - (cw * cols + gap * (cols - 1))) / 2, oy = top + ((H - top - pad) - (ch * rows + gap * (rows - 1))) / 2;
  S.cols = cols; S.rows = rows; S.cw = cw; S.ch = ch;
  S.cards = deck.map((d, i) => ({ ...d, c: i % cols, r: Math.floor(i / cols), x: ox + (i % cols) * (cw + gap), y: oy + Math.floor(i / cols) * (ch + gap),
    up: true, flip: 1, matched: false, gone: 0, shake: 0, deal: i * 0.025 }));
  S.open = []; S.lockT = 0; S.mismatchesStage = 0; S.cursor = 0;
  S.peek = S.mode === 'relax' ? 0 : 0.9 + n * 0.09;
  if (S.mode === 'relax') S.cards.forEach(c => { c.up = false; c.flip = 0; });
  S.time = S.mode === 'relax' ? 0 : Math.round(12 + n * 4.2);
  S.stageTotal = n;
  shell.setHud('stage', S.mode === 'relax' ? 'RELAX' : `${S.stage + 1}/${STAGES.length}`, true);
  shell.setHud('time', S.mode === 'relax' ? '0' : fmtSec(S.time));
  document.querySelector('.gs-stat:nth-child(3) .l').textContent = S.mode === 'relax' ? 'MOVES' : 'TIME';
  S.banner = { text: S.mode === 'relax' ? 'FIND ALL 12 PAIRS' : `STAGE ${S.stage + 1}`, sub: S.peek ? 'MEMORIZE…' : '', t: 1.6 };
  if (S.stage > 0) shell.sfx('unlock');
}
const fmtSec = s => `${Math.floor(s / 60)}:${String(Math.max(0, Math.ceil(s)) % 60).padStart(2, '0')}`;

/* ─────────────────────────────────────────────────────────
   INPUT
───────────────────────────────────────────────────────── */
function cardAt(x, y) { return S.cards.find(c => !c.matched && x >= c.x && x <= c.x + S.cw && y >= c.y && y <= c.y + S.ch); }
shell.canvas.addEventListener('pointerdown', e => {
  if (!S || shell.state !== 'playing') return;
  const p = shell.toLogical(e.clientX, e.clientY);
  const c = cardAt(p.x, p.y); if (c) { S.cursor = S.cards.indexOf(c); flipCard(c); }
});
shell.canvas.addEventListener('pointermove', e => { if (S) S.mouse = shell.toLogical(e.clientX, e.clientY); });
function onKey(code, down) {
  if (!down || !S || S.over) return;
  const cur = S.cards[S.cursor] || S.cards[0];
  const move = (dc, dr) => {
    let c = cur.c, r = cur.r;
    for (let k = 0; k < S.cols * S.rows; k++) {
      c = (c + dc + S.cols) % S.cols; r = (r + dr + S.rows) % S.rows;
      const i = r * S.cols + c; if (!S.cards[i].matched) { S.cursor = i; S.mouse = null; shell.tone(900, 0.02, 'sine', 0.04); return; }
      if (!dc && !dr) return;
    }
  };
  if (code === 'ArrowLeft' || code === 'KeyA') move(-1, 0);
  if (code === 'ArrowRight' || code === 'KeyD') move(1, 0);
  if (code === 'ArrowUp' || code === 'KeyW') move(0, -1);
  if (code === 'ArrowDown' || code === 'KeyS') move(0, 1);
  if (code === 'Enter' || code === 'Space') flipCard(cur);
}

function flipCard(c) {
  if (S.over || S.peek > 0 || c.matched || S.next) return;
  // a mismatch is still showing: any click hides it straight away (even on one of those two cards)
  if (S.open.length === 2) { closeOpen(); c.flip = Math.min(c.flip, 0.5); }
  if (c.up) return;
  c.up = true; S.open.push(c);
  shell.tone(1200 + Math.random() * 100, 0.035, 'triangle', 0.08);
  shell.noise(0.03, 0.06, 3000, 2);
  if (S.open.length === 2) {
    S.moves++;
    if (S.mode === 'relax') shell.setHud('time', S.moves);
    const [a, b] = S.open;
    if (a.sym === b.sym) match(a, b);
    else { S.lockT = 0.75; S.combo = 0; S.mismatchesStage++; a.shake = b.shake = 0.35; shell.sfx('error'); }
  }
}
function closeOpen() { S.open.forEach(o => { if (!o.matched) o.up = false; }); S.open = []; S.lockT = 0; }
function match(a, b) {
  a.matched = b.matched = true; S.open = [];
  S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo); S.pairs++;
  const pts = 100 * Math.min(S.combo, 6) + (S.mode === 'arcade' ? S.stage * 20 : 0);
  S.score += pts; shell.setHud('score', S.score, true);
  if (S.mode === 'arcade') S.time += 2;
  [a, b].forEach(c => shell.particles.emit(c.x + S.cw / 2, c.y + S.ch / 2, { n: 18, color: [c.color, '#ffffff'], speed: 200, life: 0.6, size: 2.6 }));
  shell.floaters.add((a.x + b.x) / 2 + S.cw / 2, (a.y + b.y) / 2 + S.ch / 2, S.combo > 1 ? `+${pts} ×${S.combo}` : `+${pts}`, a.color, 18);
  [523, 659, 784, 1047].slice(0, 2 + Math.min(2, S.combo - 1)).forEach((f, i) => shell.tone(f * (1 + Math.min(S.combo, 6) * 0.06), 0.12, 'square', 0.1, null, i * 0.05));
  if (S.cards.every(c => c.matched)) stageClear();
}
function stageClear() {
  S.cleared++;
  const perfect = S.mismatchesStage === 0;
  if (perfect) S.perfect = true;
  let bonus = 0;
  if (S.mode === 'arcade') bonus = Math.round(S.time * 15) + (perfect ? 500 : 0);
  else { bonus = Math.max(0, 3000 - Math.max(0, S.moves - 12) * 70) + (perfect ? 500 : 0); if (S.moves <= 30) S.zen30 = true; }
  S.score += bonus; shell.setHud('score', S.score, true);
  S.banner = { text: perfect ? 'PERFECT!' : 'CLEAR!', sub: `BONUS +${A.util.fmt(bonus)}`, t: 1.8 };
  shell.sfx('levelup'); shell.flash('#ffffff', 0.25);
  S.lockT = 1.9; S.next = true;
}
function endRun(won) {
  if (S.over) return;
  S.over = true; S.won = won;
  if (!won && S.mode === 'arcade') { shell.sfx('gameover'); S.cards.forEach(c => { if (!c.matched) { c.up = true; } }); }
  shell.gameOver(
    { score: S.score, pairs: S.pairs, stage: S.mode === 'arcade' ? S.cleared : 0, maxCombo: S.maxCombo, perfect: S.perfect, zen30: S.zen30, moves: S.moves },
    S.mode === 'relax' ? [['MOVES', S.moves], ['PAIRS', S.pairs], ['BEST CHAIN', S.maxCombo], ['PERFECT', S.perfect ? 'YES' : 'NO']]
      : [['STAGES', `${S.cleared}/6`], ['PAIRS', S.pairs], ['BEST CHAIN', S.maxCombo], ['PERFECT', S.perfect ? 'YES' : 'NO']], won ? 1400 : 1100);
}

/* ─────────────────────────────────────────────────────────
   UPDATE
───────────────────────────────────────────────────────── */
function update(dt) {
  if (!S) return;
  S.t += dt;
  if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
  for (const c of S.cards) {
    if (c.deal > 0) c.deal -= dt;
    c.flip += ((c.up ? 1 : 0) - c.flip) * Math.min(1, dt * 14);
    if (c.shake > 0) c.shake -= dt;
    if (c.matched) c.gone = Math.min(1, c.gone + dt * 1.6);
  }
  if (S.over || shell.state !== 'playing') return;
  if (S.peek > 0) { S.peek -= dt; if (S.peek <= 0) { S.cards.forEach(c => c.up = false); shell.tone(500, 0.12, 'triangle', 0.1, 900); } return; }
  if (S.lockT > 0) {
    S.lockT -= dt;
    if (S.lockT <= 0) {
      if (S.next) { S.next = false; if (S.mode === 'relax' || S.stage >= STAGES.length - 1) { endRun(true); return; } S.stage++; buildStage(); }
      else closeOpen();
    }
  }
  if (S.mode === 'arcade' && !S.next) {
    S.time -= dt;
    shell.setHud('time', fmtSec(S.time));
    if (S.time <= 0) { S.time = 0; endRun(false); }
  }
}

/* ─────────────────────────────────────────────────────────
   RENDER
───────────────────────────────────────────────────────── */
function symbol(c, sym, x, y, r, col) {
  c.save(); c.translate(x, y);
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = r * 0.16; c.lineJoin = 'round'; c.lineCap = 'round';
  const poly = (n, rr, rot = -Math.PI / 2) => { c.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); };
  switch (sym) {
    case 'circle': c.beginPath(); c.arc(0, 0, r * 0.8, 0, Math.PI * 2); c.fill(); break;
    case 'triangle': poly(3, r); c.fill(); break;
    case 'square': c.fillRect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44); break;
    case 'diamond': poly(4, r); c.fill(); break;
    case 'star': c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); break;
    case 'hex': poly(6, r * 0.92, 0); c.fill(); break;
    case 'heart': c.beginPath(); c.moveTo(0, r * 0.85); c.bezierCurveTo(-r * 1.5, -r * 0.1, -r * 0.6, -r * 1.2, 0, -r * 0.35); c.bezierCurveTo(r * 0.6, -r * 1.2, r * 1.5, -r * 0.1, 0, r * 0.85); c.fill(); break;
    case 'bolt': c.beginPath(); c.moveTo(r * 0.2, -r); c.lineTo(-r * 0.55, r * 0.1); c.lineTo(-r * 0.02, r * 0.1); c.lineTo(-r * 0.25, r); c.lineTo(r * 0.55, -r * 0.15); c.lineTo(r * 0.02, -r * 0.15); c.closePath(); c.fill(); break;
    case 'ring': c.lineWidth = r * 0.3; c.beginPath(); c.arc(0, 0, r * 0.68, 0, Math.PI * 2); c.stroke(); break;
    case 'cross': c.lineWidth = r * 0.42; c.beginPath(); c.moveTo(-r * 0.7, -r * 0.7); c.lineTo(r * 0.7, r * 0.7); c.moveTo(r * 0.7, -r * 0.7); c.lineTo(-r * 0.7, r * 0.7); c.stroke(); break;
    case 'moon': c.beginPath(); c.arc(0, 0, r * 0.85, Math.PI * 0.35, Math.PI * 1.65); c.arc(r * 0.38, 0, r * 0.62, Math.PI * 1.5, Math.PI * 0.5, true); c.closePath(); c.fill(); break;
    case 'arrow': c.beginPath(); c.moveTo(0, -r); c.lineTo(r * 0.8, 0); c.lineTo(r * 0.3, 0); c.lineTo(r * 0.3, r); c.lineTo(-r * 0.3, r); c.lineTo(-r * 0.3, 0); c.lineTo(-r * 0.8, 0); c.closePath(); c.fill(); break;
    case 'spiral': c.lineWidth = r * 0.18; c.beginPath(); for (let a = 0; a < Math.PI * 5; a += 0.15) { const rr = r * 0.08 + a * r * 0.055; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.stroke(); break;
    case 'eye': c.beginPath(); c.moveTo(-r, 0); c.quadraticCurveTo(0, -r * 1.05, r, 0); c.quadraticCurveTo(0, r * 1.05, -r, 0); c.stroke(); c.beginPath(); c.arc(0, 0, r * 0.32, 0, Math.PI * 2); c.fill(); break;
    case 'note': c.beginPath(); c.ellipse(-r * 0.32, r * 0.55, r * 0.34, r * 0.26, -0.4, 0, Math.PI * 2); c.fill(); c.lineWidth = r * 0.16; c.beginPath(); c.moveTo(-r * 0.02, r * 0.55); c.lineTo(-r * 0.02, -r * 0.9); c.quadraticCurveTo(r * 0.6, -r * 0.6, r * 0.55, -r * 0.1); c.stroke(); break;
    case 'crown': c.beginPath(); c.moveTo(-r, r * 0.6); c.lineTo(-r, -r * 0.45); c.lineTo(-r * 0.45, r * 0.05); c.lineTo(0, -r * 0.75); c.lineTo(r * 0.45, r * 0.05); c.lineTo(r, -r * 0.45); c.lineTo(r, r * 0.6); c.closePath(); c.fill(); break;
    case 'flower': for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; c.beginPath(); c.arc(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52, r * 0.36, 0, Math.PI * 2); c.fill(); } c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0, r * 0.26, 0, Math.PI * 2); c.fill(); break;
    case 'planet': c.beginPath(); c.arc(0, 0, r * 0.52, 0, Math.PI * 2); c.fill(); c.lineWidth = r * 0.14; c.beginPath(); c.ellipse(0, 0, r, r * 0.32, -0.4, 0, Math.PI * 2); c.stroke(); break;
  }
  c.restore();
}
function faceSprite(sym, col, w, h) {
  return G.sprite(`mm-face|${sym}|${col}|${Math.round(w)}`, w * 2, h * 2, (c) => {
    c.scale(2, 2);
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0d0d26'); g.addColorStop(1, '#06061a');
    c.fillStyle = g; c.beginPath(); c.roundRect(1, 1, w - 2, h - 2, 10); c.fill();
    c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 9); c.stroke();
    const r = Math.min(w, h) * 0.3;
    c.globalAlpha = 0.35; c.drawImage(G.softGlow(col, 64), w / 2 - r * 2, h / 2 - r * 2, r * 4, r * 4); c.globalAlpha = 1;
    symbol(c, sym, w / 2, h / 2, r, col);
  });
}
function backSprite(w, h) {
  const sk = shell.skin;
  return G.sprite(`mm-back|${sk.back}|${sk.pat}|${Math.round(w)}`, w * 2, h * 2, (c) => {
    c.scale(2, 2);
    c.fillStyle = G.mixHex(sk.back, '#05051a', 0.82); c.beginPath(); c.roundRect(1, 1, w - 2, h - 2, 10); c.fill();
    c.save(); c.beginPath(); c.roundRect(6, 6, w - 12, h - 12, 7); c.clip();
    c.strokeStyle = G.hexA(sk.back, 0.35); c.fillStyle = G.hexA(sk.back, 0.35); c.lineWidth = 1;
    if (sk.pat === 'grid') { for (let x = 0; x < w; x += 9) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 9) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }
    if (sk.pat === 'diamond') { for (let i = -h; i < w + h; i += 12) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.moveTo(i, h); c.lineTo(i + h, 0); c.stroke(); } }
    if (sk.pat === 'circuit') { const rng = A.util.seededRNG(7); for (let k = 0; k < 18; k++) { let x = rng() * w, y = rng() * h; c.beginPath(); c.moveTo(x, y); for (let s = 0; s < 3; s++) { rng() < 0.5 ? x += (rng() - 0.5) * 40 : y += (rng() - 0.5) * 40; c.lineTo(x, y); } c.stroke(); c.fillRect(x - 1.5, y - 1.5, 3, 3); } }
    if (sk.pat === 'stars') { const rng = A.util.seededRNG(3); for (let k = 0; k < 40; k++) c.fillRect(rng() * w, rng() * h, 1.5, 1.5); }
    c.restore();
    c.strokeStyle = sk.back; c.lineWidth = 2; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 9); c.stroke();
    c.strokeStyle = G.hexA(sk.back, 0.5); c.lineWidth = 1; c.beginPath(); c.roundRect(6.5, 6.5, w - 13, h - 13, 7); c.stroke();
    // centre emblem
    c.fillStyle = sk.back; c.globalAlpha = 0.9;
    c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 - Math.PI / 2, r = Math.min(w, h) * 0.16; c.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } c.closePath(); c.stroke();
    c.globalAlpha = 1;
  });
}
const bgS = () => G.sprite('mm-bg', W, H, c => {
  const g = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, '#120720'); g.addColorStop(1, '#04020b');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,79,216,0.05)'; for (let x = 0; x < W; x += 24) for (let y = 0; y < H; y += 24) c.fillRect(x, y, 2, 2);
});

function render(c, alpha, t) {
  c.drawImage(bgS(), 0, 0, W, H);
  if (!S) { renderIdle(c, t); return; }
  const hover = S.mouse ? cardAt(S.mouse.x, S.mouse.y) : null;
  for (const card of S.cards) {
    if (card.gone >= 1) {
      c.strokeStyle = G.hexA(card.color, 0.18); c.lineWidth = 1; c.setLineDash([4, 5]);
      c.beginPath(); c.roundRect(card.x + 2, card.y + 2, S.cw - 4, S.ch - 4, 9); c.stroke(); c.setLineDash([]);
      continue;
    }
    const deal = Math.max(0, card.deal);
    const sx = Math.abs(Math.cos((1 - card.flip) * Math.PI)); // 1 → face, flips through 0
    const face = card.flip > 0.5;
    let dx = 0; if (card.shake > 0) dx = Math.sin(card.shake * 60) * 5 * (card.shake / 0.35);
    const lift = (hover === card || (!S.mouse && S.cards[S.cursor] === card)) && !card.up && !S.over ? -4 : 0;
    const cx = card.x + S.cw / 2 + dx, cy = card.y + S.ch / 2 + lift - deal * 300;
    c.save(); c.translate(cx, cy);
    if (card.matched) { const k = card.gone; c.globalAlpha = 1 - k; c.scale(1 + k * 0.25, 1 + k * 0.25); }
    c.scale(Math.max(0.02, sx), 1);
    const spr = face ? faceSprite(card.sym, card.color, S.cw, S.ch) : backSprite(S.cw, S.ch);
    if (face && card.up) c.drawImage(G.softGlow(card.color, 50), -S.cw * 0.75, -S.ch * 0.65, S.cw * 1.5, S.ch * 1.3);
    c.drawImage(spr, -S.cw / 2, -S.ch / 2, S.cw, S.ch);
    if (card.shake > 0) { c.fillStyle = `rgba(255,42,109,${card.shake})`; c.beginPath(); c.roundRect(-S.cw / 2, -S.ch / 2, S.cw, S.ch, 10); c.fill(); }
    c.restore();
    // keyboard cursor
    if (!S.mouse && S.cards[S.cursor] === card && !S.over && S.peek <= 0) {
      c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.roundRect(card.x - 4, card.y - 4 + lift, S.cw + 8, S.ch + 8, 12); c.stroke();
    }
  }
  // timer bar
  if (S.mode === 'arcade') {
    const max = 12 + S.stageTotal * 4.2;
    const k = Math.max(0, Math.min(1, S.time / max));
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(18, 40, W - 36, 6);
    c.fillStyle = k < 0.25 ? '#ff2a6d' : shell.game.color; c.fillRect(18, 40, (W - 36) * k, 6);
    if (k < 0.25 && Math.sin(t * 12) > 0) c.drawImage(G.softGlow('#ff2a6d', 30), 18, 25, (W - 36) * k, 36);
  }
  c.textAlign = 'left'; c.font = '700 12px Orbitron, monospace'; c.fillStyle = 'rgba(255,255,255,0.6)';
  c.fillText(S.mode === 'relax' ? `MOVES ${S.moves}` : `STAGE ${S.stage + 1} · ${S.cols}×${S.rows}`, 18, 28);
  if (S.combo >= 2) { c.textAlign = 'right'; c.fillStyle = shell.game.color; c.fillText(`CHAIN ×${S.combo}`, W - 18, 28); }
  shell.particles.draw(c);
  shell.floaters.draw(c);
  if (S.banner) {
    const b = S.banner; c.globalAlpha = Math.min(1, b.t * 2); c.textAlign = 'center';
    c.fillStyle = 'rgba(4,2,11,0.55)'; c.fillRect(0, H / 2 - 54, W, 96);
    c.font = '900 38px Orbitron, monospace'; c.fillStyle = shell.game.color; c.fillText(b.text, W / 2, H / 2);
    if (b.sub) { c.font = '700 14px Orbitron, monospace'; c.fillStyle = '#ffffff'; c.fillText(b.sub, W / 2, H / 2 + 28); }
    c.globalAlpha = 1;
  }
}
function renderIdle(c, t) {
  const w = 74, h = 96, n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i - (n - 1) / 2) * 0.16, x = W / 2 + (i - (n - 1) / 2) * 52, y = H * 0.72 + Math.abs(i - 3) * 8;
    const s = SYMBOLS[(i * 5 + Math.floor(t / 2)) % SYMBOLS.length];
    const up = Math.sin(t * 1.4 + i * 0.9) > 0.3;
    c.save(); c.translate(x, y); c.rotate(a);
    c.drawImage(up ? faceSprite(s[0], s[1], w, h) : backSprite(w, h), -w / 2, -h / 2, w, h);
    c.restore();
  }
}
})();
