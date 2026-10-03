/* ============================================================
   NEON ARCADE HUB  ·  hub.js  ·  Neon Inc™ v3.0
   Library, account, daily quests, achievements, Vault, profile.
   ============================================================ */
(function () {
'use strict';
const A = window.Arcade, G = A.gfx;
const { esc, fmt } = A.util;
const $ = s => document.querySelector(s);
const NEW_SINCE = '2026-10-03';
const CATS = { action: ['snake', 'flight', 'breaker', 'drift', 'drifter'], puzzle: ['stack', 'memory', 'gems'], skill: ['typer', 'pool'] };
let libFilter = 'all';

let tab = 'arcade', achFilter = 'all', vaultFilter = 'avatar';

/* ─────────────────────────────────────────────────────────
   BACKGROUND — synthwave horizon, cheap to draw
───────────────────────────────────────────────────────── */
const bg = $('#hubBg'), bx = bg.getContext('2d');
let BW = 0, BH = 0, dots = [];
function bgResize() {
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  BW = innerWidth; BH = innerHeight;
  bg.width = BW * dpr; bg.height = BH * dpr; bx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dots = Array.from({ length: Math.round(BW * BH / 22000) }, () => ({ x: Math.random() * BW, y: Math.random() * BH * 0.6, r: Math.random() * 1.6 + 0.3, p: Math.random() * 6 }));
}
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#00f0ff'; }
let a1 = '#00f0ff', a2 = '#ff00ff';
function bgDraw(t) {
  const hz = BH * 0.62;
  const sky = bx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#03030d'); sky.addColorStop(1, G.mixHex('#03030d', a2, 0.12));
  bx.fillStyle = sky; bx.fillRect(0, 0, BW, hz);
  bx.fillStyle = '#03030d'; bx.fillRect(0, hz, BW, BH - hz);
  for (const d of dots) { bx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 1.3 + d.p); bx.fillStyle = '#ffffff'; bx.fillRect(d.x, d.y, d.r, d.r); }
  bx.globalAlpha = 1;
  // sun
  const sr = Math.min(BW, BH) * 0.16, sx = BW * 0.5, sy = hz - sr * 0.15;
  bx.drawImage(G.softGlow(a2, 128), sx - sr * 2.4, sy - sr * 2.4, sr * 4.8, sr * 4.8);
  const sg = bx.createLinearGradient(0, sy - sr, 0, sy + sr); sg.addColorStop(0, G.mixHex(a2, '#ffd86b', 0.6)); sg.addColorStop(1, a2);
  bx.save(); bx.beginPath(); bx.arc(sx, sy, sr, Math.PI, 0); bx.closePath(); bx.clip();
  bx.fillStyle = sg; bx.fillRect(sx - sr, sy - sr, sr * 2, sr);
  bx.fillStyle = '#03030d'; for (let k = 0; k < 6; k++) bx.fillRect(sx - sr, sy - sr * 0.5 + k * sr * 0.1, sr * 2, 1.5 + k * 1.3);
  bx.restore();
  // grid
  bx.strokeStyle = G.hexA(a1, 0.22); bx.lineWidth = 1;
  const off = (t * 0.35) % 1;
  for (let i = 0; i < 16; i++) { const k = (i + off) / 16, y = hz + (BH - hz) * k * k; bx.globalAlpha = 0.15 + k * 0.85; bx.beginPath(); bx.moveTo(0, y); bx.lineTo(BW, y); bx.stroke(); }
  bx.globalAlpha = 1;
  for (let i = -14; i <= 14; i++) { bx.beginPath(); bx.moveTo(BW / 2 + i * 22, hz); bx.lineTo(BW / 2 + i * BW * 0.16, BH); bx.stroke(); }
  bx.strokeStyle = a1; bx.globalAlpha = 0.6; bx.beginPath(); bx.moveTo(0, hz); bx.lineTo(BW, hz); bx.stroke(); bx.globalAlpha = 1;
  // dim layer so UI stays readable
  bx.fillStyle = 'rgba(3,3,13,0.55)'; bx.fillRect(0, 0, BW, BH);
}

/* ─────────────────────────────────────────────────────────
   GAME CARD PREVIEWS
───────────────────────────────────────────────────────── */
const PREVIEW = {
  snake(c, w, h, t) {
    c.fillStyle = '#020a05'; c.fillRect(0, 0, w, h);
    const s = h / 9; c.strokeStyle = 'rgba(0,255,102,0.07)'; c.lineWidth = 1;
    for (let x = 0; x < w; x += s) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y < h; y += s) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    const pts = []; for (let i = 0; i < 26; i++) { const a = t * 1.4 - i * 0.16; pts.push([w / 2 + Math.cos(a) * w * 0.3, h / 2 + Math.sin(a * 2) * h * 0.26]); }
    c.lineCap = c.lineJoin = 'round';
    c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.strokeStyle = 'rgba(0,255,102,0.18)'; c.lineWidth = s * 1.3; c.stroke();
    c.strokeStyle = '#00ff66'; c.lineWidth = s * 0.6; c.stroke();
    c.fillStyle = '#eaffef'; c.beginPath(); c.arc(pts[0][0], pts[0][1], s * 0.4, 0, Math.PI * 2); c.fill();
    const fx = w * 0.78, fy = h * 0.3 + Math.sin(t * 3) * 3;
    c.drawImage(G.softGlow('#ff2a6d', 30), fx - 30, fy - 30, 60, 60); c.fillStyle = '#ff2a6d'; c.beginPath(); c.arc(fx, fy, s * 0.3, 0, Math.PI * 2); c.fill();
  },
  flight(c, w, h, t) {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#03031a'); g.addColorStop(1, '#14063a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.drawImage(G.softGlow('#ff00ff', 80), w * 0.62, -h * 0.2, h * 1.2, h * 1.2);
    const gw = w * 0.11, sp = w * 0.42;
    for (let i = 0; i < 4; i++) {
      const x = ((i * sp - t * 70) % (sp * 4) + sp * 4) % (sp * 4) - gw;
      const gy = h * (0.45 + Math.sin(i * 2.3) * 0.15), gap = h * 0.42;
      c.fillStyle = 'rgba(0,240,255,0.16)'; c.strokeStyle = '#00f0ff'; c.lineWidth = 2;
      c.fillRect(x, -2, gw, gy - gap / 2); c.strokeRect(x, -2, gw, gy - gap / 2);
      c.fillRect(x, gy + gap / 2, gw, h); c.strokeRect(x, gy + gap / 2, gw, h);
      c.fillStyle = '#ff00ff'; c.fillRect(x - 3, gy - gap / 2 - 5, gw + 6, 5); c.fillRect(x - 3, gy + gap / 2, gw + 6, 5);
    }
    const py = h * 0.5 + Math.sin(t * 2.6) * h * 0.12, px = w * 0.28;
    for (let i = 1; i < 7; i++) { c.globalAlpha = 0.5 - i * 0.07; c.fillStyle = '#00f0ff'; c.beginPath(); c.arc(px - i * 8, py + Math.sin(t * 2.6 - i * 0.2) * 4, 5 - i * 0.5, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
    c.drawImage(G.softGlow('#00f0ff', 30), px - 30, py - 30, 60, 60);
    c.fillStyle = '#00f0ff'; c.beginPath(); c.arc(px, py, h * 0.07, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(px + 3, py - 2, 2, 0, Math.PI * 2); c.arc(px + 8, py - 2, 2, 0, Math.PI * 2); c.fill();
  },
  stack(c, w, h, t) {
    c.fillStyle = '#05031a'; c.fillRect(0, 0, w, h);
    const s = h / 11, cols = 10, bx0 = w / 2 - cols * s / 2;
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(bx0, 0, cols * s, h);
    c.strokeStyle = 'rgba(192,75,255,0.5)'; c.strokeRect(bx0, -1, cols * s, h + 2);
    const pal = ['#00f0ff', '#ffe600', '#c04bff', '#00ff66', '#ff2a6d', '#2f6bff', '#ff8a00'];
    const rows = [[1, 1, 1, 0, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 0, 1, 1, 1, 1], [0, 1, 1, 1, 1, 1, 1, 1, 0, 1]];
    const blk = (x, y, col) => { c.fillStyle = col; c.fillRect(bx0 + x * s + 1, y + 1, s - 2, s - 2); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(bx0 + x * s + 3, y + 2, s - 6, 2); };
    rows.forEach((r, ri) => r.forEach((v, x) => v && blk(x, h - (ri + 1) * s, pal[(x + ri * 3) % 7])));
    const fall = (t * 2.2) % 9, y = Math.min(fall, 6.3) * s;
    [[3, 0], [4, 0], [5, 0], [4, 1]].forEach(([x, yy]) => blk(x, y + yy * s, '#c04bff'));
    const gy = h - 4 * s;
    c.strokeStyle = 'rgba(192,75,255,0.45)'; [[3, 0], [4, 0], [5, 0], [4, 1]].forEach(([x, yy]) => c.strokeRect(bx0 + x * s + 3, gy + yy * s + 3, s - 6, s - 6));
  },
  breaker(c, w, h, t) {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0c0218'); g.addColorStop(1, '#030108'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    const pal = ['#ff2a6d', '#ff8a00', '#ffd700', '#00ff66', '#00f0ff'];
    const bw = w / 10, bh = h / 14;
    for (let r = 0; r < 5; r++) for (let i = 0; i < 9; i++) { if ((i * 3 + r * 7 + Math.floor(t / 2)) % 11 === 0) continue; c.fillStyle = pal[r]; c.fillRect(bw * 0.5 + i * bw + 2, h * 0.12 + r * (bh + 3), bw - 4, bh); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(bw * 0.5 + i * bw + 4, h * 0.12 + r * (bh + 3) + 1, bw - 8, 1.5); }
    const bxp = w / 2 + Math.sin(t * 1.7) * w * 0.36, byp = h * 0.62 + Math.cos(t * 3.4) * h * 0.18;
    c.drawImage(G.glowDot('#ff2a6d', 18), bxp - 18, byp - 18, 36, 36); c.fillStyle = '#fff'; c.beginPath(); c.arc(bxp, byp, 4, 0, Math.PI * 2); c.fill();
    const px = w / 2 + Math.sin(t * 1.7 - 0.3) * w * 0.33;
    c.drawImage(G.softGlow('#ff2a6d', 40), px - 50, h * 0.88 - 24, 100, 48);
    c.fillStyle = '#ff2a6d'; c.beginPath(); c.roundRect(px - w * 0.09, h * 0.88, w * 0.18, 7, 4); c.fill();
  },
  drift(c, w, h, t) {
    c.fillStyle = '#02020a'; c.fillRect(0, 0, w, h);
    c.drawImage(G.softGlow('#c04bff', 90), -w * 0.1, -h * 0.3, w * 0.7, h * 1.2);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${0.2 + (i % 5) * 0.12})`; c.fillRect((i * 97 + t * (4 + i % 3 * 3)) % w, (i * 53) % h, 1.5, 1.5); }
    const rock = (x, y, r, rot, col) => { c.save(); c.translate(x, y); c.rotate(rot); c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, rr = r * (0.75 + ((i * 7) % 4) * 0.09); i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(rr, 0); } c.closePath(); c.strokeStyle = G.hexA(col, 0.2); c.lineWidth = 6; c.stroke(); c.strokeStyle = col; c.lineWidth = 1.6; c.stroke(); c.restore(); };
    rock((w * 0.2 + t * 14) % (w + 60) - 30, h * 0.3, h * 0.15, t * 0.4, '#ffd700');
    rock((w * 0.75 - t * 10 + w * 2) % (w + 60) - 30, h * 0.65, h * 0.2, -t * 0.3, '#ff2a6d');
    rock((w * 0.5 + t * 20) % (w + 60) - 30, h * 0.82, h * 0.08, t, '#c04bff');
    const sx = w * 0.45, sy = h * 0.45, a = t * 0.8;
    c.save(); c.translate(sx, sy); c.rotate(a); c.beginPath(); c.moveTo(12, 0); c.lineTo(-8, -7); c.lineTo(-4, 0); c.lineTo(-8, 7); c.closePath();
    c.strokeStyle = 'rgba(0,240,255,0.25)'; c.lineWidth = 6; c.stroke(); c.strokeStyle = '#00f0ff'; c.lineWidth = 2; c.stroke(); c.restore();
    for (let i = 0; i < 3; i++) { const d = ((t * 160 + i * 50) % 150); c.fillStyle = '#fff'; c.fillRect(sx + Math.cos(a) * (16 + d), sy + Math.sin(a) * (16 + d), 2.5, 2.5); }
  },
  drifter(c, w, h, t) {
    c.fillStyle = '#05040c'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,138,0,0.06)'; for (let x = 0; x < w; x += 22) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    const cx = w * 0.5, cy = h * 0.62, rx = w * 0.42, ry = h * 0.45;
    c.lineWidth = h * 0.3; c.strokeStyle = '#120d24'; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 2; c.strokeStyle = '#00f0ff'; c.beginPath(); c.ellipse(cx, cy, rx + h * 0.15, ry + h * 0.15, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#ff2a6d'; c.beginPath(); c.ellipse(cx, cy, rx - h * 0.15, ry - h * 0.15, 0, 0, Math.PI * 2); c.stroke();
    const a = t * 1.3, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry, head = a + Math.PI / 2 + 0.55;
    for (let i = 1; i < 18; i++) { const b = a - i * 0.06; c.fillStyle = `rgba(255,42,109,${0.4 - i * 0.02})`; for (const s of [-1, 1]) c.fillRect(cx + Math.cos(b) * (rx + s * 5) - 1.5, cy + Math.sin(b) * (ry + s * 5) - 1.5, 3, 3); }
    c.save(); c.translate(x, y); c.rotate(head);
    c.drawImage(G.softGlow('#ff8a00', 30), -30, -30, 60, 60);
    c.fillStyle = '#ff8a00'; c.beginPath(); c.roundRect(-13, -7, 26, 14, 4); c.fill(); c.fillStyle = '#ffd36b'; c.fillRect(-13, -1.5, 26, 3); c.fillStyle = '#111'; c.fillRect(1, -5, 6, 10);
    c.restore();
    c.drawImage(G.softGlow('#ffffff', 30), x - 50 - Math.cos(a) * 10, y - 20, 50, 40);
  },
  typer(c, w, h, t) {
    c.fillStyle = '#04060f'; c.fillRect(0, 0, w, h);
    const word = 'neon arcade', shown = Math.floor((t * 6) % (word.length + 8));
    c.font = `500 ${Math.round(h * 0.17)}px "JetBrains Mono", ui-monospace, monospace`; c.textAlign = 'left'; c.textBaseline = 'middle';
    const tw = c.measureText(word).width, x0 = (w - tw) / 2, cw = tw / word.length;
    for (let i = 0; i < word.length; i++) { c.fillStyle = i < shown ? '#b6ff00' : 'rgba(255,255,255,0.25)'; c.fillText(word[i], x0 + i * cw, h * 0.36); }
    const cx = x0 + Math.min(shown, word.length) * cw; c.fillStyle = '#b6ff00'; c.fillRect(cx, h * 0.27, 2, h * 0.18);
    const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'], k = Math.min(w / 12, h / 6.5);
    const hot = word[Math.min(shown, word.length - 1)];
    rows.forEach((r, ri) => [...r].forEach((ch, i) => {
      const x = w / 2 - r.length * k / 2 + i * k + ri * k * 0.3, y = h * 0.56 + ri * (k + 3);
      const lit = ch === hot && shown < word.length;
      c.fillStyle = lit ? 'rgba(182,255,0,0.35)' : 'rgba(255,255,255,0.04)'; c.strokeStyle = lit ? '#b6ff00' : 'rgba(0,240,255,0.3)';
      c.beginPath(); c.roundRect(x, y, k - 4, k - 4, 4); c.fill(); c.stroke();
    }));
    c.font = `900 ${Math.round(h * 0.09)}px Orbitron, monospace`; c.textAlign = 'right'; c.fillStyle = '#00f0ff'; c.fillText(`${60 + Math.round(Math.sin(t) * 12)} WPM`, w - 10, h * 0.12);
  },
  memory(c, w, h, t) {
    c.fillStyle = '#0a0414'; c.fillRect(0, 0, w, h);
    const cols = 5, rows = 2, cw = Math.min(w / (cols + 1), h / (rows * 1.45)), ch = cw * 1.3;
    const ox = (w - cols * (cw + 6)) / 2, oy = (h - rows * (ch + 6)) / 2;
    const cols8 = ['#00f0ff', '#ff2a6d', '#ffe600', '#00ff66', '#c04bff'];
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
      const k = r * cols + i, up = Math.sin(t * 1.6 + k * 1.3) > 0.45 || (k === 2 || k === 7);
      const x = ox + i * (cw + 6), y = oy + r * (ch + 6), col = cols8[(k * 3 + r) % 5];
      c.fillStyle = up ? '#0d0d26' : 'rgba(255,79,216,0.14)'; c.strokeStyle = up ? col : '#ff4fd8'; c.lineWidth = 1.5;
      c.beginPath(); c.roundRect(x, y, cw, ch, 6); c.fill(); c.stroke();
      if (up) { c.fillStyle = col; c.beginPath(); c.arc(x + cw / 2, y + ch / 2, cw * 0.22, 0, Math.PI * 2); c.fill(); }
    }
  },
  gems(c, w, h, t) {
    c.fillStyle = '#070a24'; c.fillRect(0, 0, w, h);
    const n = 8, s = Math.min(w / (n + 1), h / 5.2), ox = (w - n * s) / 2, oy = (h - 4.4 * s) / 2;
    const cols = ['#ff2a6d', '#ff8a00', '#ffe600', '#00ff66', '#00b3ff', '#c04bff'];
    for (let r = 0; r < 4; r++) for (let i = 0; i < n; i++) {
      const k = (r * 7 + i * 3 + (i > 2 && i < 6 && r === 1 ? 0 : 1)) % 6, col = r === 1 && i > 2 && i < 6 ? cols[2] : cols[k];
      const pulse = r === 1 && i > 2 && i < 6 ? 1 + Math.max(0, Math.sin(t * 4)) * 0.18 : 1;
      const x = ox + (i + 0.5) * s, y = oy + (r + 0.5) * s * 1.1, rr = s * 0.34 * pulse;
      c.fillStyle = col; c.beginPath();
      if (k % 3 === 0) c.arc(x, y, rr, 0, Math.PI * 2); else if (k % 3 === 1) { c.moveTo(x, y - rr); c.lineTo(x + rr, y); c.lineTo(x, y + rr); c.lineTo(x - rr, y); } else c.rect(x - rr * 0.8, y - rr * 0.8, rr * 1.6, rr * 1.6);
      c.fill();
    }
    c.drawImage(G.softGlow('#ffe600', 40), ox + 2.5 * s, oy + 0.6 * s, s * 3, s * 1.4);
  },
  pool(c, w, h, t) {
    c.fillStyle = '#03030d'; c.fillRect(0, 0, w, h);
    const tw = w * 0.84, th = Math.min(h * 0.78, tw / 2), x0 = (w - tw) / 2, y0 = (h - th) / 2;
    c.fillStyle = '#0b1a26'; c.beginPath(); c.roundRect(x0 - 8, y0 - 8, tw + 16, th + 16, 10); c.fill();
    c.strokeStyle = '#19ffd2'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#063a35'; c.fillRect(x0, y0, tw, th);
    [[0, 0], [tw / 2, 0], [tw, 0], [0, th], [tw / 2, th], [tw, th]].forEach(([px, py]) => { c.fillStyle = '#000'; c.beginPath(); c.arc(x0 + px, y0 + py, 6, 0, Math.PI * 2); c.fill(); });
    const r = th * 0.06, cols = ['#ffd400', '#2f6bff', '#ff2a3d', '#b04bff', '#141414', '#ff8a00'];
    const hit = (t * 0.5) % 1;
    for (let row = 0; row < 3; row++) for (let k = 0; k <= row; k++) {
      const bx = x0 + tw * 0.68 + row * r * 1.8 + (hit > 0.5 ? (row + 1) * (hit - 0.5) * 30 : 0), by = y0 + th / 2 + (k - row / 2) * r * 2.1 + (hit > 0.5 ? (k - row / 2) * (hit - 0.5) * 40 : 0);
      c.fillStyle = cols[(row * 2 + k) % 6]; c.beginPath(); c.arc(bx, by, r, 0, Math.PI * 2); c.fill();
    }
    const cxp = hit < 0.5 ? x0 + tw * 0.25 + hit * 2 * tw * 0.4 : x0 + tw * 0.62, cyp = y0 + th / 2;
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cxp, cyp, r, 0, Math.PI * 2); c.fill();
    if (hit < 0.5) { c.strokeStyle = '#ffd36b'; c.lineWidth = 3; c.beginPath(); c.moveTo(cxp - r - 6 - (0.5 - hit) * 20, cyp); c.lineTo(cxp - r - 90, cyp); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.setLineDash([3, 4]); c.lineWidth = 1; c.beginPath(); c.moveTo(cxp + r, cyp); c.lineTo(x0 + tw * 0.68 - r, cyp); c.stroke(); c.setLineDash([]);
  },
};
const previews = [];
function mountPreviews() {
  previews.length = 0;
  document.querySelectorAll('canvas[data-preview]').forEach(cv => {
    const p = { cv, c: cv.getContext('2d'), id: cv.dataset.preview, vis: true, w: 0, h: 0 };
    const fit = () => { const r = cv.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 2); p.w = r.width; p.h = r.height; cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr); p.c.setTransform(dpr, 0, 0, dpr, 0, 0); };
    new ResizeObserver(fit).observe(cv); fit();
    new IntersectionObserver(es => es.forEach(e => p.vis = e.isIntersecting)).observe(cv);
    previews.push(p);
  });
}

let lastT = performance.now(), T = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (document.hidden) return;
  const still = A.settings().reduceMotion;
  T += still ? 0 : dt;
  bgDraw(T);
  if (tab === 'arcade') for (const p of previews) if (p.vis && p.w) PREVIEW[p.id](p.c, p.w, p.h, T + p.id.length);
}

/* ─────────────────────────────────────────────────────────
   HEADER
───────────────────────────────────────────────────────── */
function renderHeader() {
  const st = A.state(), tr = A.tier(st.level);
  document.documentElement.style.setProperty('--tc', tr.color);
  $('#hAvatar').textContent = A.equipped('avatar').data.glyph;
  $('#hName').textContent = A.displayName();
  $('#hLevel').textContent = `LV ${st.level}`;
  $('#hXP').style.width = Math.round(st.xp / A.xpNeeded(st.level) * 100) + '%';
  const sh = $('#hShards'), prev = sh.textContent;
  sh.textContent = fmt(st.shards);
  if (prev && prev !== sh.textContent) { const w = $('.h-shards'); w.classList.remove('pulse'); void w.offsetWidth; w.classList.add('pulse'); }
  const streak = A.liveStreak();
  $('#hStreak').hidden = streak < 2; $('#hStreak b').textContent = streak;
  const claimable = A.questList().some(q => q.done && !q.claimed);
  $('#questDot').hidden = !claimable;
  $('#musicBtn').style.opacity = A.settings().music ? 1 : 0.45;
}

/* ─────────────────────────────────────────────────────────
   ARCADE TAB
───────────────────────────────────────────────────────── */
function gameAchProgress(id) { const list = A.ACHIEVEMENTS.filter(a => a.game === id); return [list.filter(a => A.state().ach[a.id]).length, list.length]; }
function isNew(g) { return g.added >= NEW_SINCE && !A.state().games[g.id].plays; }
function scoreText(g, rec) {
  if (g.id === 'stack' && rec.mins.sprintMs && !rec.best) return A.util.fmtTime(rec.mins.sprintMs);
  if (g.id === 'typer') { const w = Math.max(rec.bests.t30 || 0, rec.bests.t60 || 0); return w ? w + ' WPM' : fmt(rec.best); }
  return fmt(rec.best);
}
function relTime(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago';
}
function heroBlock() {
  const st = A.state(), tr = A.tier(st.level), quests = A.questList();
  const ready = quests.filter(q => q.done && !q.claimed).length, open = quests.filter(q => !q.done).length;
  const last = st.history[0] && A.gameById(st.history[0].game);
  const fresh = A.GAMES.find(isNew);
  const streak = A.liveStreak(), playedToday = st.lastPlay === A.util.dateKey();
  let msg = `${A.GAMES.length} neon games, one account. Every run earns XP, shards and progress toward rewards in the Vault.`;
  if (ready) msg = `You have ${ready} quest reward${ready > 1 ? 's' : ''} ready to claim.`;
  else if (streak >= 1 && !playedToday) msg = `Play a run today to keep your ${streak}-day streak alive.`;
  else if (open) msg = `${open} daily quest${open > 1 ? 's' : ''} left today. Quests reset at midnight.`;
  const [achGot, achAll] = [Object.keys(st.ach).length, A.ACHIEVEMENTS.length];
  const cta = ready ? `<button class="na-btn solid" data-goto="quests">🎁 CLAIM REWARDS</button>`
    : last ? `<a class="na-btn solid" href="${last.path}" style="--bc:${last.color}">▶ CONTINUE · ${esc(last.short)}</a>`
    : `<a class="na-btn solid" href="${(fresh || A.GAMES[0]).path}" style="--bc:${(fresh || A.GAMES[0]).color}">▶ PLAY ${esc((fresh || A.GAMES[0]).short)}</a>`;
  return `<div class="hero" style="--tc:${tr.color}">
    <div style="position:relative;z-index:1">
      <div class="hero-hi">${st.history.length ? 'WELCOME BACK' : 'READY PLAYER'}</div>
      <div class="hero-name"><span>${esc(A.displayName())}</span></div>
      <div class="hero-title">${esc(A.equipped('title').name)} · ${tr.icon} ${tr.name}</div>
      <div class="hero-sub">${esc(msg)}</div>
      <div class="hero-actions">${cta}${fresh && last ? `<a class="na-btn" href="${fresh.path}" style="--bc:${fresh.color}">✦ TRY ${esc(fresh.short)}</a>` : ''}<button class="na-btn ghost" data-goto="vault">💎 VAULT</button></div>
    </div>
    <div class="hero-stats">
      <div class="hs"><span>LEVEL</span><b style="color:${tr.color}">${st.level}</b><small>${fmt(st.xp)} / ${fmt(A.xpNeeded(st.level))} XP</small></div>
      <div class="hs"><span>SHARDS</span><b style="color:#7df9ff">${fmt(st.shards)}</b><small>${fmt(st.shardsEarned)} earned</small></div>
      <div class="hs"><span>STREAK</span><b style="color:#ff8a00">${streak}🔥</b><small>best ${st.bestStreak} days</small></div>
      <div class="hs"><span>AWARDS</span><b style="color:var(--gold)">${achGot}<small style="font-size:.9rem">/${achAll}</small></b><small>${A.ownedCount()} vault items</small></div>
    </div>
  </div>`;
}
function gameCards() {
  const st = A.state();
  const list = A.GAMES.filter(g => libFilter === 'all' || (libFilter === 'new' ? g.added >= NEW_SINCE : (CATS[libFilter] || []).includes(g.id)));
  return `<div class="games">${list.map(g => {
    const rec = st.games[g.id]; const [got, all] = gameAchProgress(g.id);
    return `<a class="gcard" href="${g.path}" style="--gc:${g.color}" aria-label="Play ${esc(g.name)}">
      <canvas data-preview="${g.id}" aria-hidden="true"></canvas><div class="gcard-scan"></div>
      <div class="gcard-body">
        <div class="gcard-top"><span class="na-tag gcard-genre">${esc(g.genre)}</span>${isNew(g) ? '<span class="na-tag gcard-new">NEW</span>' : ''}</div>
        <div class="gcard-name">${g.icon} ${esc(g.name)}</div>
        <div class="gcard-tag">${esc(g.tagline)}</div>
        <div class="gcard-stats"><span>BEST <b>${scoreText(g, rec)}</b></span><span>RUNS <b>${fmt(rec.plays)}</b></span><span>AWARDS <b>${got}/${all}</b></span></div>
        <div class="gcard-ach"><i style="width:${Math.round(got / all * 100)}%"></i></div>
        <div class="gcard-play"><span class="na-btn">▶ PLAY</span></div>
      </div></a>`;
  }).join('')}</div>`;
}
function questCards(compact) {
  const list = A.questList();
  return `<div class="quests">${list.map(q => {
    const g = A.gameById(q.game);
    const icon = g ? g.icon : '🌐', color = g ? g.color : 'var(--a1)';
    const pct = Math.round(q.progress / q.target * 100);
    const st = A.state();
    const canReroll = !compact && !q.claimed && !q.done && st.quests.rerolls < 1;
    return `<div class="quest${q.done ? ' done' : ''}${q.claimed ? ' claimed' : ''}">
      <div class="q-ic">${icon}</div>
      <div class="q-body"><div class="q-game" style="color:${color}">${g ? esc(g.name) : 'ARCADE-WIDE'}</div><div class="q-label">${esc(q.label)}</div>
        <div class="q-bar"><i style="width:${pct}%"></i></div><div class="q-prog">${fmt(q.progress)} / ${fmt(q.target)}</div></div>
      <div class="q-side">
        ${q.claimed ? '<span class="na-tag" style="color:var(--good)">✓ CLAIMED</span>'
          : q.done ? `<button class="na-btn solid small" data-claim="${q.index}" style="--bc:var(--good)">CLAIM +${q.xp} XP${q.shards ? ` +${q.shards}💎` : ''}</button>`
          : `<div class="q-rew"><b>+${q.xp} XP</b>${q.shards ? `<br>+${q.shards} 💎` : ''}</div>`}
        ${canReroll ? `<button class="q-reroll" data-reroll="${q.index}">↻ SWAP QUEST</button>` : ''}
      </div></div>`;
  }).join('')}</div>`;
}
function recentRuns() {
  const h = A.state().history.slice(0, 6);
  if (!h.length) return `<div class="empty">No runs yet — pick a game above and your history will show up here.</div>`;
  return `<div class="recent">${h.map(r => { const g = A.gameById(r.game); return `<div class="rrow"><span class="ri">${g.icon}</span><span class="rn" style="color:${g.color}">${esc(g.short)}</span><span class="rt">${relTime(r.ts)}</span><span class="rs">${fmt(r.score)}</span><span class="rx">+${fmt(r.xp)} XP</span></div>`; }).join('')}</div>`;
}
function renderArcade() {
  $('#sec-arcade').innerHTML = `
    ${heroBlock()}
    <div class="sec-hd"><div class="sec-t">GAME LIBRARY</div><div class="sec-x">${A.GAMES.length} TITLES</div></div>
    <div class="chips" role="group" aria-label="Filter games">${[['all', 'ALL'], ['new', '✦ NEW'], ['action', 'ACTION'], ['puzzle', 'PUZZLE'], ['skill', 'SKILL']].map(([id, l]) => `<button class="chip${libFilter === id ? ' on' : ''}" data-libf="${id}">${l}</button>`).join('')}</div>
    <div id="libGrid">${gameCards()}</div>
    <div class="sec-hd"><div class="sec-t">TODAY'S QUESTS</div><button class="sec-x" data-goto="quests">ALL QUESTS ›</button></div>
    ${questCards(true)}
    <div class="sec-hd"><div class="sec-t">RECENT RUNS</div></div>
    ${recentRuns()}`;
  mountPreviews();
}

/* ─────────────────────────────────────────────────────────
   QUESTS TAB
───────────────────────────────────────────────────────── */
function msToMidnight() { const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); return m - n; }
function renderQuests() {
  const st = A.state(), streak = A.liveStreak();
  const ms = msToMidnight(), hh = Math.floor(ms / 3600000), mm = Math.floor(ms % 3600000 / 60000);
  const days = []; const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const lit = st.lastPlay === A.util.dateKey() ? i < streak : i >= 1 && i <= streak;
    days.push(`<div class="streak-day${lit || (i === 0 && st.lastPlay === A.util.dateKey()) ? ' on' : ''}${i === 0 ? ' today' : ''}"><b>🔥</b>${d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</div>`);
  }
  $('#sec-quests').innerHTML = `
    <div class="sec-hd"><div class="sec-t">DAILY QUESTS</div><div class="sec-x">RESET IN ${hh}H ${mm}M</div></div>
    ${questCards(false)}
    <div class="quest-meta"><span>Progress counts automatically while you play. Claim rewards here.</span><span>${st.quests.rerolls < 1 ? '1 FREE SWAP LEFT TODAY' : 'SWAP USED TODAY'}</span></div>
    <div class="sec-hd"><div class="sec-t">PLAY STREAK</div><div class="sec-x">${streak} DAY${streak === 1 ? '' : 'S'} · BEST ${st.bestStreak}</div></div>
    <div class="na-panel" style="padding:16px">
      <div style="color:var(--dim);font-weight:600">Play at least one run a day to grow your streak. Every streak day adds <b style="color:var(--text)">+5% XP</b> to your runs, up to +50%.</div>
      <div class="streak-row">${days.join('')}</div>
    </div>`;
}

/* ─────────────────────────────────────────────────────────
   ACHIEVEMENTS TAB
───────────────────────────────────────────────────────── */
function renderAchievements() {
  const st = A.state();
  const filters = [['all', 'ALL'], ['arcade', '🌐 ARCADE'], ...A.GAMES.map(g => [g.id, `${g.icon} ${g.short}`])];
  const list = A.ACHIEVEMENTS.filter(a => achFilter === 'all' || a.game === achFilter);
  const got = A.ACHIEVEMENTS.filter(a => st.ach[a.id]).length;
  const sorted = [...list].sort((a, b) => (st.ach[b.id] ? 1 : 0) - (st.ach[a.id] ? 1 : 0));
  $('#sec-achievements').innerHTML = `
    <div class="ach-sum"><div class="big">${got}<span style="font-size:1rem;color:var(--dim)"> / ${A.ACHIEVEMENTS.length}</span></div><div style="flex:1"><div class="sec-x" style="margin-bottom:6px">ACHIEVEMENTS UNLOCKED</div><div class="bar"><i style="width:${Math.round(got / A.ACHIEVEMENTS.length * 100)}%"></i></div></div></div>
    <div class="chips">${filters.map(([id, l]) => `<button class="chip${achFilter === id ? ' on' : ''}" data-achf="${id}">${l}</button>`).join('')}</div>
    <div class="achs">${sorted.map(a => {
      const has = st.ach[a.id]; const g = A.gameById(a.game);
      const unl = A.REWARDS.filter(r => r.unlock.ach === a.id);
      return `<div class="ach${has ? ' got' : ''}"><div class="ai">${a.icon}</div><div style="flex:1;min-width:0">
        <div class="an">${esc(a.name)}</div><div class="ad">${esc(a.desc)}</div>
        <div class="ar">${has ? '✓ ' : ''}+${a.xp} XP${a.shards ? ` · +${a.shards} 💎` : ''}${unl.length ? ` · 🎁 ${unl.map(r => esc(r.name)).join(', ')}` : ''}</div></div>
        <div class="ag" title="${g ? esc(g.name) : 'Arcade'}">${g ? g.icon : '🌐'}</div></div>`;
    }).join('')}</div>`;
}

/* ─────────────────────────────────────────────────────────
   VAULT TAB
───────────────────────────────────────────────────────── */
function preview(r) {
  if (r.type === 'avatar') return `<div class="iprev">${r.data.glyph}</div>`;
  if (r.type === 'title') return `<div class="iprev"><div class="tt">${esc(r.name)}</div></div>`;
  const sw = A.rewardSwatch(r);
  if (r.type === 'theme') return `<div class="iprev" style="background:linear-gradient(135deg,${sw[0]}55,#05051a 50%,${sw[1]}55)"><div class="tt" style="background:linear-gradient(90deg,${sw[0]},${sw[1]});-webkit-background-clip:text;background-clip:text;color:transparent">NEON</div></div>`;
  return `<div class="iprev"><div class="sw">${sw.map(c => `<i style="background:${c};box-shadow:inset 0 0 20px rgba(0,0,0,.35)"></i>`).join('')}</div></div>`;
}
function renderVault() {
  const st = A.state();
  const filters = [['avatar', '👤 AVATARS'], ['title', '🏷️ TITLES'], ['theme', '🎨 THEMES'], ...A.GAMES.map(g => [g.id, `${g.icon} ${g.short}`])];
  const list = A.REWARDS.filter(r => vaultFilter === r.type || vaultFilter === r.game);
  const slot = ['avatar', 'title', 'theme'].includes(vaultFilter) ? vaultFilter : vaultFilter;
  const eqId = A.equipped(slot)?.id;
  $('#sec-vault').innerHTML = `
    <div class="vault-top"><div class="vault-bal"><span style="font-size:2rem">💎</span><div><small>YOUR SHARDS</small><div class="vb">${fmt(st.shards)}</div></div></div>
      <div class="vault-note">Earn shards from every run, quests and achievements. Spend them here on skins, avatars, titles and hub themes. Level and achievement rewards unlock automatically.</div></div>
    <div class="chips">${filters.map(([id, l]) => `<button class="chip${vaultFilter === id ? ' on' : ''}" data-vaultf="${id}">${l}</button>`).join('')}</div>
    <div class="items">${list.map(r => {
      const s = A.unlockStatus(r); const eq = r.id === eqId;
      let action;
      if (eq) action = `<span class="na-btn small solid" style="--bc:var(--a1)">✓ EQUIPPED</span>`;
      else if (s.owned) action = `<button class="na-btn small" data-equip="${r.id}">EQUIP</button>`;
      else if (s.buyable) action = `<button class="na-btn small${s.affordable ? ' solid' : ''}" data-buy="${r.id}" style="--bc:#7df9ff" ${s.affordable ? '' : 'aria-disabled="true"'}>💎 ${fmt(s.cost)}</button>`;
      else action = `<div class="ilock">🔒 ${esc(s.reason)}${s.cost ? ` · 💎 ${fmt(s.cost)}` : ''}</div>`;
      return `<div class="item${eq ? ' eq' : ''}${s.owned ? '' : ' locked'}">${preview(r)}<div><div class="iname">${esc(r.name)}</div><div class="isub">${r.type === 'skin' ? esc(A.gameById(r.game).short) + ' SKIN' : r.type.toUpperCase()}</div></div>${action}</div>`;
    }).join('')}</div>`;
}

/* ─────────────────────────────────────────────────────────
   PROFILE TAB
───────────────────────────────────────────────────────── */
function renderProfile() {
  const st = A.state(), tr = A.tier(st.level);
  const totalRuns = A.GAMES.reduce((n, g) => n + st.games[g.id].plays, 0);
  const totalTime = A.GAMES.reduce((n, g) => n + st.games[g.id].timeMs, 0);
  const hrs = Math.floor(totalTime / 3600000), mins = Math.floor(totalTime % 3600000 / 60000);
  const statDefs = {
    snake: rec => [['Best score', fmt(rec.best)], ['Apples eaten', fmt(rec.totals.apples || 0)], ['Best combo', '×' + (rec.maxes.maxCombo || 0)], ['Bosses beaten', fmt(rec.totals.bosses || 0)]],
    flight: rec => [['Best score', fmt(rec.best)], ['Shards grabbed', fmt(rec.totals.shards || 0)], ['Furthest realm', ['Cyber Grid', 'Skyline', 'Void', 'Storm', 'Hell', 'Heaven'][rec.maxes.realm || 0]], ['Best combo', '×' + (rec.maxes.maxCombo || 0)]],
    stack: rec => [['Marathon best', fmt(rec.bests.marathon || 0)], ['Sprint 40', rec.mins.sprintMs ? A.util.fmtTime(rec.mins.sprintMs) : '—'], ['Ultra best', fmt(rec.bests.ultra || 0)], ['Lines cleared', fmt(rec.totals.lines || 0)]],
    breaker: rec => [['Best score', fmt(rec.best)], ['Highest level', rec.maxes.level || 0], ['Bricks broken', fmt(rec.totals.bricks || 0)], ['Power-ups', fmt(rec.totals.powerups || 0)]],
    drift: rec => [['Best score', fmt(rec.best)], ['Highest wave', rec.maxes.wave || 0], ['Asteroids', fmt(rec.totals.rocks || 0)], ['Saucers', fmt(rec.totals.ufos || 0)]],
    drifter: rec => [['Best score', fmt(rec.best)], ['Best drift', fmt(rec.maxes.bestDrift || 0)], ['Best chain', '×' + (rec.maxes.maxCombo || 0)], ['Drifts banked', fmt(rec.totals.drifts || 0)]],
    typer: rec => [['Best WPM', (rec.maxes.wpm || 0) + ' WPM'], ['Best accuracy', (rec.maxes.accuracy || 0) + '%'], ['Storm best', fmt(rec.bests.storm || 0)], ['Words typed', fmt(rec.totals.words || 0)]],
    memory: rec => [['Best score', fmt(rec.best)], ['Stages cleared', (rec.maxes.stage || 0) + '/6'], ['Best chain', rec.maxes.maxCombo || 0], ['Pairs matched', fmt(rec.totals.pairs || 0)]],
    gems: rec => [['Blitz best', fmt(rec.bests.blitz || 0)], ['30 Moves best', fmt(rec.bests.moves || 0)], ['Best cascade', '×' + (rec.maxes.maxCascade || 0)], ['Specials', fmt(rec.totals.specials || 0)]],
    pool: rec => [['8-ball wins', fmt(rec.totals.wins || 0)], ['Rush best', fmt(rec.bests.rush || 0)], ['Balls potted', fmt(rec.totals.pots || 0)], ['Best run', rec.maxes.maxRun || 0]],
  };
  $('#sec-profile').innerHTML = `
    <div class="pcard" style="--tc:${tr.color}">
      <div class="pav">${A.equipped('avatar').data.glyph}<button data-goto-vault="avatar" aria-label="Change avatar">✎</button></div>
      <div>
        <div class="pname-row"><div class="pname">${esc(A.displayName())}</div><button class="na-btn small ghost" data-rename>RENAME</button></div>
        <div class="ptitle">${esc(A.equipped('title').name)} <button class="q-reroll" data-goto-vault="title">change</button></div>
        <div class="ptier"><div class="lv">${st.level}</div><div class="xp"><div class="tn">${tr.icon} ${tr.name}</div><div class="xpb"><i style="width:${Math.round(st.xp / A.xpNeeded(st.level) * 100)}%"></i></div><small>${fmt(st.xp)} / ${fmt(A.xpNeeded(st.level))} XP TO LEVEL ${st.level + 1}</small></div></div>
      </div>
    </div>
    <div class="sec-hd"><div class="sec-t">CAREER</div></div>
    <div class="pstats">
      <div class="hs"><span>TOTAL RUNS</span><b>${fmt(totalRuns)}</b></div>
      <div class="hs"><span>TIME PLAYED</span><b>${hrs}h ${mins}m</b></div>
      <div class="hs"><span>LIFETIME XP</span><b>${fmt(st.lifetimeXP)}</b></div>
      <div class="hs"><span>SHARDS EARNED</span><b style="color:#7df9ff">${fmt(st.shardsEarned)}</b></div>
      <div class="hs"><span>QUESTS DONE</span><b>${fmt(st.questsClaimed)}</b></div>
      <div class="hs"><span>AWARDS</span><b style="color:var(--gold)">${Object.keys(st.ach).length}/${A.ACHIEVEMENTS.length}</b></div>
      <div class="hs"><span>VAULT</span><b>${A.ownedCount()}/${A.REWARDS.length}</b></div>
      <div class="hs"><span>BEST STREAK</span><b style="color:#ff8a00">${st.bestStreak}🔥</b></div>
    </div>
    <div class="sec-hd"><div class="sec-t">GAME RECORDS</div></div>
    <div class="gstats">${A.GAMES.map(g => { const rec = st.games[g.id]; return `<div class="gs" style="--gc:${g.color}"><div class="gt">${g.icon} ${esc(g.name)}</div>${statDefs[g.id](rec).map(([k, v]) => `<div class="gr"><span>${k}</span><b>${v}</b></div>`).join('')}<div class="gr"><span>Runs</span><b>${fmt(rec.plays)}</b></div></div>`; }).join('')}</div>
    <div class="sec-hd"><div class="sec-t">RANK LADDER</div></div>
    <div class="ladder">${A.TIERS.map(t => `<div class="rung${st.level > t.to ? ' past' : ''}${st.level >= t.from && st.level <= t.to ? ' cur' : ''}" style="--rc:${t.color}"><span class="rgi">${t.icon}</span><div><div class="rgn">${t.name}</div><div class="rgl">Level ${t.from}${t.to === Infinity ? '+' : '–' + t.to}</div></div></div>`).join('')}</div>
    <div class="sec-hd"><div class="sec-t">SAVE &amp; TRANSFER</div></div>
    <div class="save-box">
      <div class="na-panel"><h4>EXPORT SAVE CODE</h4><p>Your account lives in this browser. Copy this code to move your level, shards, unlocks and records to another device or browser.</p><textarea readonly id="exportBox" aria-label="Your save code"></textarea><div class="gs-row" style="justify-content:flex-start"><button class="na-btn small" data-export>⧉ GENERATE &amp; COPY</button></div></div>
      <div class="na-panel"><h4>IMPORT SAVE CODE</h4><p>Paste a code from another device. This replaces the progress in this browser.</p><textarea id="importBox" placeholder="NA3-…" aria-label="Paste a save code"></textarea><div class="gs-row" style="justify-content:flex-start"><button class="na-btn small" data-import>⤓ IMPORT</button><button class="na-btn small ghost" data-reset style="--bc:var(--bad);color:var(--bad)">⚠ RESET ALL</button></div></div>
    </div>`;
}

/* ─────────────────────────────────────────────────────────
   MODALS
───────────────────────────────────────────────────────── */
function openModal(html, onMount) {
  const m = $('#modal'); $('#modalCard').innerHTML = html; m.hidden = false;
  onMount && onMount($('#modalCard'));
  const f = $('#modalCard').querySelector('input,button'); f && f.focus();
}
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && A.state().profile.created) closeModal(); if (e.target.closest('[data-close]')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden && A.state().profile.created) closeModal(); });

function onboarding() {
  const st = A.state();
  let pick = A.equipped('avatar').id;
  const avs = A.REWARDS.filter(r => r.type === 'avatar');
  openModal(`
    <div class="modal-hd"><h3>${st.migrated ? 'WELCOME BACK' : 'CREATE YOUR PLAYER'}</h3></div>
    ${st.migrated ? `<div class="welcome-back">Your v2 progress came with you: <b>level ${st.level}</b>, <b>${fmt(st.shards)} shards</b> and your best scores.</div>` : ''}
    <p>Pick a callsign and avatar. One account follows you across every game in the arcade.</p>
    <input class="field" id="nameIn" maxlength="14" placeholder="CALLSIGN" value="${esc(st.profile.name)}" autocomplete="off" spellcheck="false" aria-label="Callsign">
    <div class="av-grid">${avs.map(r => { const ok = A.isOwned(r); return `<button class="av-opt${r.id === pick ? ' on' : ''}" data-av="${r.id}" ${ok ? '' : 'disabled'} title="${esc(r.name)}${ok ? '' : ' — ' + esc(A.unlockStatus(r).reason)}">${r.data.glyph}</button>`; }).join('')}</div>
    <p style="font-size:.9rem;margin:0">More avatars, titles and skins unlock as you level up.</p>
    <div class="modal-actions"><button class="na-btn solid" id="obGo">ENTER THE ARCADE ▶</button></div>`, card => {
    card.addEventListener('click', e => { const b = e.target.closest('[data-av]'); if (!b) return; pick = b.dataset.av; card.querySelectorAll('.av-opt').forEach(x => x.classList.toggle('on', x === b)); A.audio.sfx('click'); });
    const go = () => {
      const name = card.querySelector('#nameIn').value.trim() || 'PLAYER' + Math.floor(Math.random() * 900 + 100);
      A.setProfile({ name }); A.equip(pick); closeModal(); A.audio.sfx('start');
      A.ui.toast(A.equipped('avatar').data.glyph, `WELCOME, ${A.displayName()}`, 'Your account is ready. Pick a game to start earning XP.', 'var(--a1)');
      startMusic(); renderAll();
    };
    card.querySelector('#obGo').addEventListener('click', go);
    card.querySelector('#nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });
}
function renameModal() {
  openModal(`<div class="modal-hd"><h3>RENAME</h3><button class="na-icon-btn" data-close aria-label="Close">✕</button></div>
    <input class="field" id="nameIn" maxlength="14" value="${esc(A.state().profile.name)}" autocomplete="off" spellcheck="false" aria-label="Callsign">
    <div class="modal-actions"><button class="na-btn ghost" data-close>CANCEL</button><button class="na-btn solid" id="saveName">SAVE</button></div>`, card => {
    const save = () => { const v = card.querySelector('#nameIn').value.trim(); if (v) { A.setProfile({ name: v }); A.audio.sfx('select'); } closeModal(); renderAll(); };
    card.querySelector('#saveName').addEventListener('click', save);
    card.querySelector('#nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  });
}
function settingsModal() {
  const s = A.settings();
  openModal(`<div class="modal-hd"><h3>SETTINGS</h3><button class="na-icon-btn" data-close aria-label="Close">✕</button></div>
    <label class="na-toggle">Music <input type="checkbox" data-set="music" ${s.music ? 'checked' : ''}></label>
    <label class="na-toggle">Sound effects <input type="checkbox" data-set="sfx" ${s.sfx ? 'checked' : ''}></label>
    ${A.volumeRow()}
    <label class="na-toggle">Screen shake <input type="checkbox" data-set="shake" ${s.shake ? 'checked' : ''}></label>
    <label class="na-toggle">CRT scanlines <input type="checkbox" data-set="crt" ${s.crt ? 'checked' : ''}></label>
    <label class="na-toggle">Reduce motion <input type="checkbox" data-set="reduceMotion" ${s.reduceMotion ? 'checked' : ''}></label>
    <p style="margin-top:12px;font-size:.9rem">Settings apply to the hub and every game.${A.storageOK() ? '' : ' <b style="color:var(--bad)">Your browser is blocking storage, so progress cannot be saved.</b>'}</p>`, card => {
    card.addEventListener('change', e => { const k = e.target.dataset.set; if (!k || k === 'volume') return; A.setSetting(k, e.target.checked); if (k === 'music') A.settings().music ? startMusic() : A.audio.stopMusic(); renderHeader(); });
    A.bindVolume(card);
  });
}
function confirmBuy(r) {
  const s = A.unlockStatus(r);
  if (!s.affordable) { A.audio.sfx('error'); A.ui.toast('💎', 'NOT ENOUGH SHARDS', `You need ${fmt(s.cost - A.state().shards)} more.`, '#ff2a6d', 2600); return; }
  openModal(`<div class="modal-hd"><h3>UNLOCK ITEM</h3><button class="na-icon-btn" data-close aria-label="Close">✕</button></div>
    <div class="item" style="pointer-events:none;margin-bottom:12px">${preview(r)}<div class="iname">${esc(r.name)}</div></div>
    <p>Spend <b style="color:#7df9ff">${fmt(s.cost)} 💎</b>? You'll have ${fmt(A.state().shards - s.cost)} left.</p>
    <div class="modal-actions"><button class="na-btn ghost" data-close>CANCEL</button><button class="na-btn solid" id="doBuy" style="--bc:#7df9ff">UNLOCK &amp; EQUIP</button></div>`, card => {
    card.querySelector('#doBuy').addEventListener('click', () => {
      const res = A.buy(r.id);
      closeModal();
      if (res.ok) { A.equip(r.id); A.audio.sfx('unlock'); A.ui.toast(A.rewardIcon(r), 'UNLOCKED', r.name, '#7df9ff'); (res.newAch || []).forEach(a => A.ui.toast(a.icon, a.name, 'Achievement unlocked', 'var(--gold)')); }
      renderAll();
    });
  });
}

/* ─────────────────────────────────────────────────────────
   EVENTS
───────────────────────────────────────────────────────── */
function setTab(t, push = true) {
  tab = t;
  document.querySelectorAll('.h-tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  document.querySelectorAll('.h-sec').forEach(s => s.classList.toggle('active', s.id === 'sec-' + t));
  renderTab();
  $('#main').scrollTop = 0;
  if (push) history.replaceState(null, '', t === 'arcade' ? location.pathname : '#' + t);
}
function renderTab() {
  ({ arcade: renderArcade, quests: renderQuests, achievements: renderAchievements, vault: renderVault, profile: renderProfile })[tab]();
}
function renderAll() { renderHeader(); renderTab(); }

document.querySelector('.h-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { A.audio.sfx('click'); setTab(b.dataset.tab); } });
$('#playerChip').addEventListener('click', () => { A.audio.sfx('click'); setTab('profile'); });
$('#settingsBtn').addEventListener('click', () => { A.audio.sfx('click'); settingsModal(); });
$('#musicBtn').addEventListener('click', () => { A.setSetting('music', !A.settings().music); A.settings().music ? startMusic() : A.audio.stopMusic(); renderHeader(); });

$('#main').addEventListener('click', e => {
  const t = e.target;
  const goto = t.closest('[data-goto]'); if (goto) { A.audio.sfx('click'); setTab(goto.dataset.goto); return; }
  const gv = t.closest('[data-goto-vault]'); if (gv) { vaultFilter = gv.dataset.gotoVault; setTab('vault'); return; }
  const claim = t.closest('[data-claim]');
  if (claim) {
    const res = A.claimQuest(+claim.dataset.claim);
    if (res) {
      A.audio.sfx('coin');
      A.ui.toast('🎁', 'QUEST COMPLETE', `+${res.xp} XP${res.shards ? ` · +${res.shards} shards` : ''}`, 'var(--good)');
      res.newAch.forEach(a => A.ui.toast(a.icon, a.name, 'Achievement unlocked', 'var(--gold)'));
      if (res.levelAfter > res.levelBefore) A.ui.levelUp(res.levelAfter, res.unlocked);
      renderAll();
    }
    return;
  }
  const rr = t.closest('[data-reroll]'); if (rr) { if (A.rerollQuest(+rr.dataset.reroll)) { A.audio.sfx('select'); renderAll(); } return; }
  const lf = t.closest('[data-libf]'); if (lf) { libFilter = lf.dataset.libf; A.audio.sfx('click'); document.querySelectorAll('[data-libf]').forEach(b => b.classList.toggle('on', b === lf)); $('#libGrid').innerHTML = gameCards(); mountPreviews(); return; }
  const af = t.closest('[data-achf]'); if (af) { achFilter = af.dataset.achf; A.audio.sfx('click'); renderAchievements(); return; }
  const vf = t.closest('[data-vaultf]'); if (vf) { vaultFilter = vf.dataset.vaultf; A.audio.sfx('click'); renderVault(); return; }
  const eq = t.closest('[data-equip]'); if (eq) { A.equip(eq.dataset.equip); A.audio.sfx('select'); renderAll(); return; }
  const buy = t.closest('[data-buy]'); if (buy) { confirmBuy(A.rewardById(buy.dataset.buy)); return; }
  if (t.closest('[data-rename]')) { renameModal(); return; }
  if (t.closest('[data-export]')) {
    const code = A.exportSave(); const box = $('#exportBox'); box.value = code; box.select();
    (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => A.ui.toast('⧉', 'SAVE CODE COPIED', 'Paste it into Profile → Import on your other device.', 'var(--a1)'), () => A.ui.toast('⧉', 'SAVE CODE READY', 'Select the text and copy it.', 'var(--a1)'));
    return;
  }
  if (t.closest('[data-import]')) {
    const v = $('#importBox').value; if (!v.trim()) return;
    if (!confirm('Replace the progress in this browser with this save code?')) return;
    const res = A.importSave(v);
    if (res.ok) { A.audio.sfx('unlock'); A.ui.toast('✓', 'SAVE IMPORTED', `Welcome back, ${A.displayName()}.`, 'var(--good)'); renderAll(); }
    else { A.audio.sfx('error'); A.ui.toast('⚠', 'IMPORT FAILED', res.reason, '#ff2a6d'); }
    return;
  }
  if (t.closest('[data-reset]')) {
    if (confirm('Reset ALL arcade progress? Level, shards, unlocks and records will be erased. Export a save code first if you want a backup.') && confirm('Are you sure? This cannot be undone.')) { A.resetAll(); renderAll(); onboarding(); }
    return;
  }
  const card = t.closest('.gcard');
  if (card) { e.preventDefault(); A.audio.sfx('start'); card.style.transform = 'scale(.97)'; setTimeout(() => { location.href = card.getAttribute('href'); }, 160); }
});

/* ─────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────── */
function startMusic() { if (A.settings().music) A.audio.playMusic('hub'); }
function boot() {
  a1 = cssVar('--a1'); a2 = cssVar('--a2');
  bgResize(); addEventListener('resize', bgResize);
  const initial = (location.hash || '').slice(1);
  setTab(['quests', 'achievements', 'vault', 'profile'].includes(initial) ? initial : 'arcade', false);
  renderHeader();
  requestAnimationFrame(loop);
  A.onChange(() => { a1 = cssVar('--a1'); a2 = cssVar('--a2'); renderHeader(); });
  addEventListener('pageshow', e => { if (e.persisted) { A.load(); renderAll(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderHeader(); });
  if (!A.state().profile.created) onboarding();
  const unlock = () => { A.audio.ctx(); if (A.state().profile.created) startMusic(); };
  addEventListener('pointerdown', unlock, { once: true });
  addEventListener('keydown', unlock, { once: true });
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot, boot); else boot();
})();
