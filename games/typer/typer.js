/* ============================================================
   KEYSTORM™  ·  Neon Arcade edition
   Typing speed tests (30s / 60s) with live WPM, accuracy and
   switch-style key sounds, plus Word Storm: words fall on the
   city, type them to zap them out of the sky.
   © 2026 Neon Inc™
   ============================================================ */
(function () {
'use strict';
const A = window.Arcade, G = A.gfx;
const PORTRAIT = window.matchMedia && matchMedia('(max-aspect-ratio: 4/5)').matches;
const W = PORTRAIT ? 540 : 900, H = PORTRAIT ? 720 : 560;
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

const WORDS = ('the be of and a to in he have it that for they with as not on she at by this we you do but from or which one would all will there say who make when can more if no man out other so what time up go about than into could state only new year some take come these know see use get like then first any work now may such give over think most even find day also after way many must look before great back through long where much should well people down own just because good each those feel seem how high too place little world very still nation hand old life tell write become here show house both between need mean call develop under last right move thing general school never same another begin while number part turn real leave might want point form off child few small since against ask late home interest large person end open public follow during present without again hold govern around possible head consider word program problem however lead system set order eye plan run keep face fact group play stand increase early course change help line city light night music power drive space pixel neon arcade signal laser rocket planet gamer level score combo bonus shift glow retro synth wave pulse grid cyber hyper turbo quick swift spark flash orbit vector galaxy matrix circuit static vapor chrome volt boost glitch byte coin quest dream storm thunder echo shadow crystal phantom rhythm silver golden velvet midnight sunset ocean river forest winter summer garden market window kitchen yellow purple orange simple random spirit motion number friend future silent bright faster double triple master').split(' ');
const STORM_WORDS = WORDS.filter(w => w.length >= 3);
const MODES = [
  { id: 't30', name: '30 SECONDS', desc: 'Short sprint. How fast can you go?' },
  { id: 't60', name: '60 SECONDS', desc: 'The classic one-minute speed test.' },
  { id: 'storm', name: 'WORD STORM', desc: 'Words rain on the city. Type them to zap them.' },
];

let S = null;
const shell = GameShell.create({
  id: 'typer', width: W, height: H, music: 'typer', modes: MODES, textInput: true,
  hud: [{ id: 'main', label: 'WPM', main: true }, { id: 'acc', label: 'ACC', init: '100%' }, { id: 'time', label: 'TIME', init: '0:30', opt: true }],
  controls: [['TYPE', 'Words'], ['SPACE', 'Next word'], ['BACKSPACE', 'Fix'], ['ESC', 'Pause']],
  formatScore: (score, res) => res && res.mode !== 'storm' ? `${score} WPM` : A.util.fmt(score),
  modeBest: (rec, mode) => rec.bests[mode] ? (mode === 'storm' ? A.util.fmt(rec.bests[mode]) : rec.bests[mode] + ' WPM') : '',
  overTitle: res => res.mode === 'storm' ? 'CITY OVERRUN' : "TIME'S UP",
  onStart, update, render, onKey,
  onMenu() { S = null; hideInput(); shell.setHud('main', 0); },
  onPause() { hideInput(); },
  onResume() { focusInput(); },
});

/* ─────────────────────────────────────────────────────────
   KEY SOUNDS — five switch styles, picked by the equipped skin
───────────────────────────────────────────────────────── */
function keySound(kind) {
  const snd = shell.skin.snd || 'click';
  const pitch = 0.92 + Math.random() * 0.16;
  if (kind === 'error') { shell.tone(110, 0.09, 'square', 0.1, 80); shell.noise(0.05, 0.08, 400, 1); return; }
  if (kind === 'word') { shell.tone(snd === 'chip' ? 880 : 1320, 0.05, snd === 'chip' ? 'square' : 'sine', 0.06); return; }
  const space = kind === 'space';
  switch (snd) {
    case 'thock': shell.noise(0.05, 0.22, (space ? 260 : 420) * pitch, 1.4, 0, 'lowpass'); shell.tone((space ? 90 : 140) * pitch, 0.05, 'sine', 0.16, 60); break;
    case 'type':  shell.noise(0.035, 0.26, 2600 * pitch, 3); shell.tone(220 * pitch, 0.03, 'square', 0.05); if (space) shell.noise(0.08, 0.12, 900, 1); break;
    case 'laser': shell.tone((space ? 600 : 1500) * pitch, 0.06, 'sawtooth', 0.06, space ? 200 : 500); break;
    case 'chip':  shell.tone((space ? 330 : 660 + Math.random() * 220), 0.04, 'square', 0.07); break;
    default:      shell.noise(0.025, 0.2, 4200 * pitch, 2.5, 0, 'highpass'); shell.tone((space ? 900 : 2200) * pitch, 0.018, 'square', 0.05); shell.noise(0.03, 0.08, 700, 1, 0.012);
  }
}

/* ─────────────────────────────────────────────────────────
   MOBILE KEYBOARD — a hidden input that receives text
───────────────────────────────────────────────────────── */
// make sure the monospace font is ready before measuring the text layout
if (document.fonts && document.fonts.load) document.fonts.load(`500 32px "JetBrains Mono"`).then(() => { measureCtx = null; if (S && S.test) layout(); }, () => {});
const input = document.createElement('input');
Object.assign(input, { type: 'text', autocomplete: 'off', spellcheck: false });
input.setAttribute('autocapitalize', 'off'); input.setAttribute('autocorrect', 'off'); input.setAttribute('aria-label', 'Type here');
input.style.cssText = 'position:absolute;left:50%;top:40%;width:2px;height:2px;opacity:0;border:0;padding:0;font-size:16px;pointer-events:none;';
document.querySelector('.gs-frame').appendChild(input);
const isTouch = () => document.body.classList.contains('touch');
function focusInput() { if (isTouch() && shell.state === 'playing') { input.style.pointerEvents = 'auto'; try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); } } }
function hideInput() { input.blur(); input.style.pointerEvents = 'none'; }
input.addEventListener('beforeinput', e => {
  if (shell.state !== 'playing') return;
  if (e.inputType === 'deleteContentBackward') { e.preventDefault(); typeChar('\b'); }
  else if (e.inputType === 'insertText' && e.data) { e.preventDefault(); for (const ch of e.data) typeChar(ch); }
  else if (e.inputType === 'insertLineBreak') { e.preventDefault(); typeChar(' '); }
});
input.addEventListener('input', () => { // composition keyboards that ignore preventDefault
  if (input.value) { for (const ch of input.value) typeChar(ch); input.value = ''; }
});
// focus on release: focusing during pointerdown gets undone by the browser's own tap handling
document.querySelector('.gs-stage').addEventListener('click', e => { if (!e.target.closest('button,a')) focusInput(); });

/* ─────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────── */
function pickWords(n) { const out = []; let last = ''; while (out.length < n) { const w = WORDS[Math.floor(Math.random() * WORDS.length)]; if (w !== last) { out.push(w); last = w; } } return out; }
function onStart(mode) {
  const test = mode !== 'storm';
  S = {
    mode, test, t: 0, started: !test, over: false, overT: 0,
    dur: mode === 't30' ? 30 : 60,
    words: [], wi: 0, typed: '', lines: [], caret: { x: 0, y: 0 },
    keys: 0, correctKeys: 0, errors: 0, correctWords: 0, streak: 0, maxStreak: 0, samples: [], lastSample: 0,
    // storm
    drops: [], target: null, buffer: '', shields: 5, wave: 1, waveWords: 0, spawnT: 1.2, score: 0, zaps: [], banner: { text: test ? '' : 'WAVE 1', t: test ? 0 : 1.6 },
    pulse: 0, shake: 0,
  };
  if (test) { S.words = pickWords(160).map(w => ({ w, typed: '', done: false })); layout(); }
  shell.setHud('main', 0); shell.setHud('acc', '100%');
  shell.setHud('time', test ? `0:${String(S.dur).padStart(2, '0')}` : '♥♥♥♥♥');
  if (test) document.querySelector('.gs-stat:nth-child(1) .l').textContent = 'WPM';
  else document.querySelector('.gs-stat:nth-child(1) .l').textContent = 'SCORE';
  document.querySelector('.gs-stat:nth-child(3) .l').textContent = test ? 'TIME' : 'SHIELDS';
  setTimeout(focusInput, 50);
}

/* layout words into lines (test modes) */
const FS = PORTRAIT ? 26 : 32, LH = FS * 1.75, TX = PORTRAIT ? 28 : 70, TW = W - TX * 2, TY = PORTRAIT ? 230 : 190;
let measureCtx = null;
function mw(text) { measureCtx = measureCtx || document.createElement('canvas').getContext('2d'); measureCtx.font = `500 ${FS}px ${MONO}`; return measureCtx.measureText(text).width; }
let CHW = 0;
function layout() {
  CHW = mw('m');
  const lines = []; let line = [], x = 0;
  S.words.forEach((o, i) => {
    const w = (o.w.length + 1) * CHW;
    if (x + w > TW && line.length) { lines.push(line); line = []; x = 0; }
    o.line = lines.length; o.x = x; line.push(i); x += w;
  });
  if (line.length) lines.push(line);
  S.lines = lines;
}

/* ─────────────────────────────────────────────────────────
   TYPING
───────────────────────────────────────────────────────── */
function onKey(code, down, e) {
  if (!down || !S || S.over) return;
  if (e && e.synthetic) return;
  if (code === 'Backspace') { typeChar('\b'); return; }
  const k = e && e.key;
  if (k && k.length === 1) typeChar(k);
}
function typeChar(ch) {
  if (!S || S.over || shell.state !== 'playing') return;
  if (S.test) typeTest(ch); else typeStorm(ch);
}
function typeTest(ch) {
  const cur = S.words[S.wi];
  if (!S.started && ch !== ' ' && ch !== '\b') { S.started = true; S.t = 0; }
  if (!S.started) return;
  if (ch === '\b') { if (cur.typed.length) { cur.typed = cur.typed.slice(0, -1); keySound('key'); } return; }
  if (ch === ' ') {
    if (!cur.typed.length) return;
    S.keys++;
    const ok = cur.typed === cur.w;
    cur.done = true; cur.ok = ok;
    if (ok) { S.correctKeys += cur.w.length + 1; S.correctWords++; S.streak++; S.maxStreak = Math.max(S.maxStreak, S.streak); keySound('word'); burstWord(S.wi); }
    else { S.errors += Math.max(0, cur.w.length - cur.typed.length); S.streak = 0; keySound('error'); }
    keySound('space');
    S.wi++;
    if (S.wi > S.words.length - 40) { S.words.push(...pickWords(80).map(w => ({ w, typed: '', done: false }))); layout(); }
    return;
  }
  S.keys++;
  const idx = cur.typed.length;
  if (idx >= cur.w.length + 8) return;
  cur.typed += ch;
  if (cur.w[idx] === ch) { keySound('key'); S.pulse = Math.min(1, S.pulse + 0.06); }
  else { S.errors++; keySound('error'); S.shake = 0.12; S.streak = 0; }
}
function diffCount(a, b) { let n = Math.abs(a.length - b.length); for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) n++; return n; }
function burstWord(i) {
  const o = S.words[i]; const p = wordPos(o);
  if (!p) return;
  shell.particles.emit(p.x + o.w.length * CHW / 2, p.y - FS * 0.35, { n: 6 + o.w.length, color: [shell.skin.c1, '#ffffff'], speed: 120, life: 0.45, size: 2 });
}
function wordPos(o) {
  const first = Math.max(0, (S.words[S.wi] ? S.words[S.wi].line : 0) - 1);
  const row = o.line - first; if (row < 0 || row > 2) return null;
  return { x: TX + o.x, y: TY + row * LH };
}

/* ── storm typing ── */
function typeStorm(ch) {
  if (ch === '\b') { if (S.buffer.length) { S.buffer = S.buffer.slice(0, -1); keySound('key'); if (!S.buffer) S.target = null; } return; }
  if (ch === ' ') { if (S.buffer) { S.buffer = ''; S.target = null; keySound('space'); } return; }
  S.keys++;
  const next = S.buffer + ch.toLowerCase();
  if (!S.target || !S.target.alive) {
    const cands = S.drops.filter(d => d.alive && d.w.startsWith(next)).sort((a, b) => b.y - a.y);
    if (!cands.length) { S.errors++; keySound('error'); S.shake = 0.1; return; }
    S.target = cands[0];
  }
  if (!S.target.w.startsWith(next)) { S.errors++; keySound('error'); S.shake = 0.1; return; }
  S.buffer = next; S.correctKeys++; keySound('key');
  if (S.buffer === S.target.w) zap(S.target);
}
function zap(d) {
  d.alive = false;
  const pts = d.w.length * 10 * S.wave * (d.gold ? 3 : 1);
  S.score += pts; S.correctWords++; S.streak++; S.maxStreak = Math.max(S.maxStreak, S.streak);
  S.correctKeys += 1;
  shell.setHud('main', S.score, true);
  S.zaps.push({ x: d.x, y: d.y, t: 0.25, gold: d.gold });
  shell.particles.emit(d.x, d.y, { n: 18 + d.w.length * 2, color: d.gold ? ['#ffd700', '#ffffff'] : [shell.skin.c1, shell.skin.c2, '#ffffff'], speed: 220, life: 0.7, size: 2.6 });
  shell.floaters.add(d.x, d.y - 18, '+' + pts, d.gold ? '#ffd700' : shell.skin.c1, 16);
  shell.sfx('combo', Math.min(12, S.streak));
  if (d.gold) { S.shields = Math.min(5, S.shields + 1); shell.setHud('time', '♥'.repeat(S.shields)); shell.sfx('coin'); }
  S.buffer = ''; S.target = null;
  S.waveWords++;
  if (S.waveWords >= 10 + S.wave * 2) { S.wave++; S.waveWords = 0; S.banner = { text: `WAVE ${S.wave}`, t: 1.6 }; shell.sfx('unlock'); }
}
function spawnDrop() {
  const maxLen = Math.min(12, 4 + S.wave);
  const pool = STORM_WORDS.filter(w => w.length <= maxLen && w.length >= Math.min(6, 2 + Math.floor(S.wave / 2)));
  let w; for (let k = 0; k < 20; k++) { w = pool[Math.floor(Math.random() * pool.length)]; if (!S.drops.some(d => d.alive && d.w[0] === w[0])) break; }
  const tw = w.length * 13 + 30;
  S.drops.push({ w, x: tw / 2 + 10 + Math.random() * (W - tw - 20), y: -16, v: 24 + S.wave * 6 + Math.random() * 10, alive: true, gold: Math.random() < 0.06 });
}

/* ─────────────────────────────────────────────────────────
   UPDATE
───────────────────────────────────────────────────────── */
function stats() {
  const mins = Math.max(S.t, 0.5) / 60;
  const wpm = Math.round((S.correctKeys / 5) / mins);
  const raw = Math.round((S.keys / 5) / mins);
  const acc = S.keys ? Math.max(0, Math.round((1 - S.errors / Math.max(S.keys, 1)) * 100)) : 100;
  return { wpm, raw, acc };
}
function update(dt) {
  if (!S) return;
  for (let i = S.zaps.length - 1; i >= 0; i--) { S.zaps[i].t -= dt; if (S.zaps[i].t <= 0) S.zaps.splice(i, 1); }
  if (S.banner.t > 0) S.banner.t -= dt;
  S.pulse = Math.max(0, S.pulse - dt * 0.5); S.shake = Math.max(0, S.shake - dt);
  if (S.over) { S.overT += dt; return; }
  if (shell.state !== 'playing') return;
  if (S.test) {
    if (!S.started) return;
    S.t += dt;
    const left = Math.max(0, S.dur - S.t);
    shell.setHud('time', `0:${String(Math.ceil(left)).padStart(2, '0')}`);
    const st = stats();
    if (S.t > 1) { shell.setHud('main', st.wpm); shell.setHud('acc', st.acc + '%'); }
    if (S.t - S.lastSample >= 1) { S.lastSample = Math.floor(S.t); S.samples.push(st.wpm); }
    if (left <= 0) endTest();
    return;
  }
  // storm
  S.t += dt;
  S.spawnT -= dt;
  const alive = S.drops.filter(d => d.alive).length;
  if (S.spawnT <= 0 && alive < 4 + S.wave) { spawnDrop(); S.spawnT = Math.max(0.7, 2.0 - S.wave * 0.15) * (0.75 + Math.random() * 0.5); }
  const ground = H - 74;
  for (const d of S.drops) {
    if (!d.alive) continue;
    d.y += d.v * dt;
    if (d.y >= ground) {
      d.alive = false;
      if (S.target === d) { S.target = null; S.buffer = ''; }
      S.shields--; S.streak = 0;
      shell.setHud('time', S.shields > 0 ? '♥'.repeat(S.shields) : '—');
      shell.shake(9); shell.flash('#ff2a6d', 0.3); shell.sfx('explode');
      shell.particles.emit(d.x, ground, { n: 30, color: ['#ff2a6d', '#ff8a00', '#ffffff'], speed: 260, life: 0.8, gravity: 300 });
      if (S.shields <= 0) { endStorm(); return; }
    }
  }
  S.drops = S.drops.filter(d => d.alive || d.y < -100);
  const st = stats();
  shell.setHud('acc', st.acc + '%');
}
function endTest() {
  S.over = true; hideInput();
  const st = stats();
  shell.sfx('levelup');
  const perfect = st.acc === 100 && S.correctWords >= 25;
  shell.gameOver(
    { score: st.wpm, wpm: st.wpm, accuracy: st.acc, words: S.correctWords, keys: S.keys, maxStreak: S.maxStreak, perfect },
    [['WPM', st.wpm], ['RAW', st.raw], ['ACCURACY', st.acc + '%'], ['WORDS', S.correctWords], ['ERRORS', S.errors], ['BEST STREAK', S.maxStreak]], 700);
}
function endStorm() {
  S.over = true; hideInput();
  const st = stats();
  shell.sfx('gameover');
  shell.gameOver(
    { score: S.score, words: S.correctWords, wave: S.wave, stormWpm: st.wpm, maxStreak: S.maxStreak },
    [['WAVE', S.wave], ['WORDS', S.correctWords], ['WPM', st.wpm], ['ACCURACY', st.acc + '%'], ['BEST STREAK', S.maxStreak]], 1100);
}

/* ─────────────────────────────────────────────────────────
   RENDER
───────────────────────────────────────────────────────── */
const bg = () => G.sprite('typer-bg-' + (shell.skin.c1 || ''), W, H, c => {
  const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#04060f'); gr.addColorStop(1, '#070312');
  c.fillStyle = gr; c.fillRect(0, 0, W, H);
  c.strokeStyle = G.hexA(shell.skin.c1 || '#b6ff00', 0.05); c.lineWidth = 1;
  for (let x = 0; x < W; x += 30) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y < H; y += 30) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
});
const city = Array.from({ length: 26 }, (_, i) => ({ x: i * (W / 25), w: W / 25 - 4, h: 26 + ((i * 37) % 44) }));

function render(c, alpha, t) {
  c.drawImage(bg(), 0, 0, W, H);
  const c1 = shell.skin.c1 || '#b6ff00', c2 = shell.skin.c2 || '#00f0ff';
  if (!S) { renderIdle(c, t, c1, c2); return; }
  c.save();
  if (S.shake > 0 && !shell.reduceMotion()) c.translate((Math.random() - 0.5) * 6 * S.shake * 8, 0);
  if (S.test) renderTest(c, t, c1, c2); else renderStorm(c, t, c1, c2);
  c.restore();
  shell.particles.draw(c);
  shell.floaters.draw(c);
}
function renderIdle(c, t, c1, c2) {
  // a gentle keyboard pulse behind the menu
  const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  const k = PORTRAIT ? 40 : 54;
  rows.forEach((r, ri) => [...r].forEach((ch, i) => {
    const x = W / 2 - r.length * k / 2 + i * k + ri * k * 0.25, y = H * 0.6 + ri * (k + 6);
    const lit = Math.sin(t * 3 + i * 0.7 + ri) > 0.85;
    c.strokeStyle = G.hexA(lit ? c1 : c2, lit ? 0.8 : 0.18); c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(x, y, k - 6, k - 6, 8); c.stroke();
  }));
}
function renderTest(c, t, c1, c2) {
  const st = stats();
  const left = Math.max(0, S.dur - S.t);
  // big timer + live wpm
  c.textAlign = 'left'; c.font = `900 ${PORTRAIT ? 44 : 56}px Orbitron, monospace`;
  c.fillStyle = c1; c.fillText(S.started ? String(Math.ceil(left)) : String(S.dur), TX, TY - LH - 20);
  c.textAlign = 'right'; c.font = `700 ${PORTRAIT ? 13 : 15}px Orbitron, monospace`; c.fillStyle = 'rgba(255,255,255,0.55)';
  c.fillText(S.started ? `${st.wpm} WPM  ·  ${st.acc}%` : '', TX + TW, TY - LH - 30);
  // time bar
  c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(TX, TY - LH - 6, TW, 3);
  c.fillStyle = c1; c.fillRect(TX, TY - LH - 6, TW * (S.started ? left / S.dur : 1), 3);
  // text window
  const cur = S.words[S.wi];
  const first = Math.max(0, cur.line - 1);
  c.font = `500 ${FS}px ${MONO}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  for (let row = 0; row < 3; row++) {
    const li = first + row; const line = S.lines[li]; if (!line) continue;
    const y = TY + row * LH;
    const fade = row === 2 ? 0.55 : 1;
    for (const wi of line) {
      const o = S.words[wi]; let x = TX + o.x;
      const isCur = wi === S.wi;
      for (let i = 0; i < Math.max(o.w.length, o.typed.length); i++) {
        const want = o.w[i], got = o.typed[i];
        let col, ch = want ?? got;
        if (got == null) col = wi < S.wi ? 'rgba(255,42,109,0.55)' : `rgba(227,246,255,${0.32 * fade})`;
        else if (want == null) { col = 'rgba(255,42,109,0.7)'; ch = got; }
        else if (got === want) col = o.done && !o.ok ? 'rgba(255,255,255,0.75)' : '#ffffff';
        else col = '#ff2a6d';
        c.fillStyle = col; c.fillText(ch, x, y);
        x += CHW;
      }
      if (o.done && !o.ok) { c.strokeStyle = 'rgba(255,42,109,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(TX + o.x, y + 6); c.lineTo(TX + o.x + o.w.length * CHW, y + 6); c.stroke(); }
      if (isCur) { c.fillStyle = G.hexA(c1, 0.08); c.fillRect(TX + o.x - 4, y - FS, Math.max(o.w.length, o.typed.length) * CHW + 8, FS * 1.35); }
    }
  }
  // caret
  const cx = TX + cur.x + cur.typed.length * CHW, cy = TY + (cur.line - first) * LH;
  S.caret.x += (cx - S.caret.x) * 0.45; S.caret.y += (cy - S.caret.y) * 0.45;
  if (Math.abs(S.caret.x - cx) > 200) S.caret.x = cx;
  const blink = S.started ? 1 : (Math.sin(t * 6) > 0 ? 1 : 0.2);
  c.globalAlpha = blink; c.fillStyle = c1;
  c.drawImage(G.softGlow(c1, 20), S.caret.x - 18, S.caret.y - FS - 6, 36, FS + 20);
  c.fillRect(S.caret.x - 1, S.caret.y - FS * 0.88, 3, FS * 1.08);
  c.globalAlpha = 1;
  // streak + live graph
  const by = TY + LH * 3 + 10;
  if (S.streak >= 3) { c.textAlign = 'left'; c.font = '900 14px Orbitron, monospace'; c.fillStyle = c2; c.fillText(`STREAK ×${S.streak}`, TX, by); }
  if (S.samples.length > 1) {
    const gw = PORTRAIT ? TW : 260, gh = 54, gx = TX + TW - gw, gy = by + 10;
    const max = Math.max(60, ...S.samples) * 1.15;
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.strokeRect(gx, gy - gh, gw, gh);
    c.beginPath(); S.samples.forEach((v, i) => { const x = gx + i / (S.dur - 1) * gw, y = gy - v / max * gh; i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.strokeStyle = c2; c.lineWidth = 2; c.stroke();
    c.font = '700 9px Orbitron, monospace'; c.textAlign = 'right'; c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillText('WPM', gx + gw, gy - gh - 4);
  }
  if (!S.started) {
    c.textAlign = 'center'; c.font = `700 ${PORTRAIT ? 13 : 15}px Orbitron, monospace`;
    c.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 4) * 0.3})`;
    c.fillText(isTouch() ? 'TAP HERE AND START TYPING — THE TIMER STARTS ON YOUR FIRST KEY' : 'START TYPING — THE TIMER STARTS ON YOUR FIRST KEY', W / 2, H - 50);
  }
  // keyboard-pulse glow under the text
  if (S.pulse > 0.05) c.drawImage(G.softGlow(c1, 160), W / 2 - 300, TY + LH * 2 - 40, 600, 120 * S.pulse + 30);
}
function renderStorm(c, t, c1, c2) {
  const ground = H - 74;
  // city
  for (const b of city) {
    const h = b.h + (S.shields < 2 ? Math.sin(t * 10 + b.x) * 2 : 0);
    c.fillStyle = '#080416'; c.fillRect(b.x, ground + 10 - h, b.w, h + 60);
    c.strokeStyle = G.hexA(S.shields <= 1 ? '#ff2a6d' : c2, 0.6); c.lineWidth = 1; c.strokeRect(b.x + 0.5, ground + 10 - h + 0.5, b.w - 1, h + 60);
    c.fillStyle = G.hexA(c1, 0.35); for (let wy = ground + 16 - h; wy < H; wy += 10) for (let wx = b.x + 4; wx < b.x + b.w - 4; wx += 7) if (((wx * 13 + wy * 7) | 0) % 3 === 0) c.fillRect(wx, wy, 2, 4);
  }
  c.strokeStyle = G.hexA(c2, 0.5); c.setLineDash([6, 8]); c.beginPath(); c.moveTo(0, ground); c.lineTo(W, ground); c.stroke(); c.setLineDash([]);
  // cannon
  const gx = W / 2, gy = H - 30;
  c.fillStyle = c1; c.beginPath(); c.moveTo(gx - 22, gy + 12); c.lineTo(gx, gy - 18); c.lineTo(gx + 22, gy + 12); c.closePath(); c.fill();
  c.drawImage(G.softGlow(c1, 40), gx - 40, gy - 40, 80, 80);
  // zaps
  for (const z of S.zaps) {
    const k = z.t / 0.25;
    c.strokeStyle = G.hexA(z.gold ? '#ffd700' : c1, k); c.lineWidth = 5 * k + 1;
    c.beginPath(); c.moveTo(gx, gy - 18); c.lineTo(z.x, z.y); c.stroke();
  }
  // falling words
  c.font = `700 ${PORTRAIT ? 20 : 22}px ${MONO}`; c.textBaseline = 'middle';
  for (const d of S.drops) {
    if (!d.alive) continue;
    const isT = d === S.target;
    const tw = c.measureText(d.w).width;
    const danger = d.y > ground - 120;
    const col = d.gold ? '#ffd700' : danger ? '#ff2a6d' : c2;
    c.fillStyle = 'rgba(4,4,16,0.85)'; c.strokeStyle = G.hexA(col, isT ? 1 : 0.55); c.lineWidth = isT ? 2 : 1;
    c.beginPath(); c.roundRect(d.x - tw / 2 - 10, d.y - 16, tw + 20, 32, 8); c.fill(); c.stroke();
    if (isT || d.gold) c.drawImage(G.softGlow(col, 40), d.x - tw / 2 - 30, d.y - 34, tw + 60, 68);
    c.textAlign = 'left';
    let x = d.x - tw / 2;
    const done = isT ? S.buffer.length : 0;
    c.fillStyle = c1; c.fillText(d.w.slice(0, done), x, d.y + 1);
    x += c.measureText(d.w.slice(0, done)).width;
    c.fillStyle = '#ffffff'; c.fillText(d.w.slice(done), x, d.y + 1);
    // trail
    c.fillStyle = G.hexA(col, 0.25); c.fillRect(d.x - 1, d.y - 16 - 18, 2, 18);
  }
  c.textBaseline = 'alphabetic';
  // typed buffer
  c.textAlign = 'center'; c.font = `700 18px ${MONO}`; c.fillStyle = c1;
  c.fillText(S.buffer + (Math.sin(t * 8) > 0 ? '_' : ' '), gx, H - 6);
  // wave + streak
  c.textAlign = 'left'; c.font = '700 12px Orbitron, monospace'; c.fillStyle = 'rgba(255,255,255,0.6)';
  c.fillText(`WAVE ${S.wave}`, 14, 22);
  if (S.streak >= 3) { c.fillStyle = c2; c.fillText(`STREAK ×${S.streak}`, 14, 40); }
  if (S.banner.t > 0) {
    c.globalAlpha = Math.min(1, S.banner.t); c.textAlign = 'center'; c.font = '900 40px Orbitron, monospace'; c.fillStyle = c1;
    c.fillText(S.banner.text, W / 2, H * 0.38); c.globalAlpha = 1;
  }
  if (S.t < 3) { c.textAlign = 'center'; c.font = '700 13px Orbitron, monospace'; c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillText('TYPE A FALLING WORD TO ZAP IT · GOLD WORDS RESTORE A SHIELD', W / 2, H * 0.46); }
}
})();
