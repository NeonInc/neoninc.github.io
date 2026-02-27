/* ============================================================
   NEON ARCADE HUB  ·  hub.js  ·  Neon Inc™ v2.0
   Shared progression · Daily quests · Cross-game achievements
   © 2026 Neon Inc™. All rights reserved.
   ============================================================ */
'use strict';

/* ─────────────────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────────────────── */
const HUB_KEY        = 'neonArcade_hub';
const LIGHT_KEY      = 'neonArcade_light';
const GAME_PATHS = { flight: 'flappy/index.html', snake: 'snake/index.html' };

/* ─────────────────────────────────────────────────────────
   LEVEL TIERS
───────────────────────────────────────────────────────── */
const TIERS = [
  { from:1,   to:3,        name:'NULL.SIGNAL',    icon:'◌',  color:'#888888' },
  { from:4,   to:7,        name:'GHOST',          icon:'👻', color:'#aaddff' },
  { from:8,   to:12,       name:'NEON CRAWLER',   icon:'🔷', color:'#00f0ff' },
  { from:13,  to:18,       name:'GRID RUNNER',    icon:'⚡', color:'#00ff88' },
  { from:19,  to:25,       name:'BYTE HUNTER',    icon:'🎯', color:'#ff8800' },
  { from:26,  to:35,       name:'STATIC PHANTOM', icon:'👾', color:'#ff00ff' },
  { from:36,  to:45,       name:'SYNTH RIDER',    icon:'🌊', color:'#ff44cc' },
  { from:46,  to:60,       name:'VOID WALKER',    icon:'🌌', color:'#8844ff' },
  { from:61,  to:80,       name:'SIGNAL SHADE',   icon:'💫', color:'#ffcc00' },
  { from:81,  to:99,       name:'QUANTUM GHOST',  icon:'🔮', color:'#ff0088' },
  { from:100, to:Infinity, name:'NEON LEGEND',    icon:'👑', color:'#ffd700' },
];
const getTier   = lv => TIERS.find(t => lv >= t.from && lv <= t.to) || TIERS[TIERS.length-1];
const xpNeeded  = lv => 100 + (lv - 1) * 75;

/* ─────────────────────────────────────────────────────────
   DAILY QUEST POOL
───────────────────────────────────────────────────────── */
const QUEST_POOL = [
  // flight
  { id:'flt_s15',  game:'flight', type:'score',        target:15,  label:'Score 15+ in Neon Flight',         icon:'✈️',  xpR:120, shrR:25 },
  { id:'flt_s30',  game:'flight', type:'score',        target:30,  label:'Score 30+ in Neon Flight',         icon:'✈️',  xpR:220, shrR:45 },
  { id:'flt_s60',  game:'flight', type:'score',        target:60,  label:'Score 60+ in Neon Flight',         icon:'🚀',  xpR:450, shrR:90 },
  { id:'flt_sh20', game:'flight', type:'shards',       target:20,  label:'Collect 20 shards in one Flight',  icon:'💎',  xpR:150, shrR:30 },
  { id:'flt_sh50', game:'flight', type:'shards',       target:50,  label:'Collect 50 shards in one run',     icon:'💎',  xpR:300, shrR:60 },
  { id:'flt_p3',   game:'flight', type:'plays',        target:3,   label:'Play 3 Neon Flight runs',          icon:'🛫',  xpR:130, shrR:25 },
  // snake
  { id:'snk_s25',  game:'snake',  type:'score',        target:25,  label:'Score 25+ in Neon Snake',          icon:'🐍',  xpR:120, shrR:25 },
  { id:'snk_s80',  game:'snake',  type:'score',        target:80,  label:'Score 80+ in Neon Snake',          icon:'🐍',  xpR:280, shrR:55 },
  { id:'snk_s200', game:'snake',  type:'score',        target:200, label:'Score 200+ in Neon Snake',         icon:'👑',  xpR:550, shrR:110 },
  { id:'snk_ap5',  game:'snake',  type:'apples',       target:5,   label:'Eat 5 apples in one Snake game',   icon:'🍎',  xpR:100, shrR:20 },
  { id:'snk_ap15', game:'snake',  type:'apples',       target:15,  label:'Eat 15 apples in Snake',           icon:'🍎',  xpR:220, shrR:45 },
  { id:'snk_c3',   game:'snake',  type:'combo',        target:3,   label:'Reach a ×3 combo in Snake',        icon:'🔥',  xpR:160, shrR:32 },
  { id:'snk_p3',   game:'snake',  type:'plays',        target:3,   label:'Play 3 Neon Snake games today',    icon:'🎮',  xpR:130, shrR:25 },
  // cross
  { id:'x_both1',  game:'both',   type:'play_both',    target:1,   label:'Play both games today',             icon:'⬡',  xpR:200, shrR:50 },
  { id:'x_tp5',    game:'both',   type:'total_plays',  target:5,   label:'Play 5 games across both titles',   icon:'🎯',  xpR:250, shrR:50 },
  { id:'x_ts60',   game:'both',   type:'total_shards', target:60,  label:'Earn 60+ shards today (both games)',icon:'💰',  xpR:320, shrR:0  },
  { id:'x_ts120',  game:'both',   type:'total_shards', target:120, label:'Earn 120+ shards today',            icon:'💰',  xpR:600, shrR:0  },
];

function seededRNG(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function genTodayQuests(hub) {
  const today = new Date().toISOString().slice(0, 10);
  if (hub.quests?.date === today && hub.quests.slots?.length === 3) return hub.quests;
  const rng   = seededRNG(parseInt(today.replace(/-/g, ''), 10));
  const pick  = pool => pool[Math.floor(rng() * pool.length)];
  hub.quests  = {
    date     : today,
    slots    : [
      pick(QUEST_POOL.filter(q => q.game === 'flight')),
      pick(QUEST_POOL.filter(q => q.game === 'snake')),
      pick(QUEST_POOL.filter(q => q.game === 'both')),
    ],
    progress : hub.quests?.date === today ? (hub.quests.progress || {}) : {},
    claimed  : hub.quests?.date === today ? (hub.quests.claimed  || {}) : {},
  };
  return hub.quests;
}

/* ─────────────────────────────────────────────────────────
   CROSS-GAME ACHIEVEMENTS
───────────────────────────────────────────────────────── */
const CROSS_ACH = [
  { id:'xa_first',   icon:'🎮', name:'BOTH WORLDS',    desc:'Play both Neon Snake & Neon Flight',   check:h=>(h.stats?.snake?.games||0)>=1&&(h.stats?.flight?.games||0)>=1,       reward:'100 XP + 30 Shards' },
  { id:'xa_ded10',   icon:'💀', name:'DEDICATED',      desc:'Play 10 total games across both',      check:h=>(h.stats?.snake?.games||0)+(h.stats?.flight?.games||0)>=10,          reward:'250 XP' },
  { id:'xa_ded50',   icon:'🏆', name:'ARCADE REGULAR', desc:'Play 50 total games across both',      check:h=>(h.stats?.snake?.games||0)+(h.stats?.flight?.games||0)>=50,          reward:'700 XP + 100 Shards' },
  { id:'xa_sh100',   icon:'💎', name:'SHARD HOARDER',  desc:'Accumulate 100 Flight shards total',   check:h=>(h.stats?.flight?.shards||0)>=100,                                    reward:'200 XP + 50 Shards' },
  { id:'xa_sh500',   icon:'💰', name:'SHARD MAGNATE',  desc:'Reach 500 hub shards',                 check:h=>(h.shards||0)>=500,                                                  reward:'500 XP' },
  { id:'xa_lv5',     icon:'⚡', name:'RISING SIGNAL',  desc:'Reach Hub Level 5',                    check:h=>(h.level||1)>=5,                                                     reward:'300 XP' },
  { id:'xa_lv10',    icon:'🌟', name:'GRID PIONEER',   desc:'Reach Hub Level 10',                   check:h=>(h.level||1)>=10,                                                    reward:'500 XP' },
  { id:'xa_lv25',    icon:'👾', name:'PHANTOM STATUS', desc:'Reach Hub Level 25',                   check:h=>(h.level||1)>=25,                                                    reward:'1500 XP' },
  { id:'xa_streak3', icon:'🔥', name:'ON A ROLL',      desc:'Maintain a 3-day play streak',         check:h=>(h.streak||0)>=3,                                                    reward:'150 XP' },
  { id:'xa_flts50',  icon:'🚀', name:'NEON ACE',       desc:'Score 50+ in Neon Flight',             check:h=>(h.stats?.flight?.best||0)>=50,                                      reward:'200 XP + 40 Shards' },
  { id:'xa_snk100',  icon:'🐍', name:'GRID SERPENT',   desc:'Score 100+ in Neon Snake',             check:h=>(h.stats?.snake?.best||0)>=100,                                      reward:'200 XP + 40 Shards' },
  { id:'xa_dual',    icon:'👑', name:'DUAL CHAMPION',  desc:'Score 50+ Flight AND 100+ Snake',      check:h=>(h.stats?.flight?.best||0)>=50&&(h.stats?.snake?.best||0)>=100,       reward:'500 XP + 100 Shards' },
];

function checkCrossAch(hub) {
  const earned = [];
  CROSS_ACH.forEach(a => {
    if (hub.crossAch[a.id]) return;
    if (!a.check(hub)) return;
    hub.crossAch[a.id] = true;
    earned.push(a);
    const xp  = parseInt(a.reward.match(/(\d+) XP/)?.[1]  || 0);
    const shr = parseInt(a.reward.match(/(\d+) Shards/)?.[1] || 0);
    hub.xp     = (hub.xp     || 0) + xp;
    hub.shards = (hub.shards || 0) + shr;
    while (hub.xp >= xpNeeded(hub.level || 1)) { hub.xp -= xpNeeded(hub.level); hub.level++; }
  });
  return earned;
}

/* ─────────────────────────────────────────────────────────
   SAVE / LOAD
───────────────────────────────────────────────────────── */
function defaultHub() {
  return {
    level: 1, xp: 0, shards: 0, streak: 0, lastPlay: '',
    stats: { snake: { games:0, best:0, apples:0 }, flight: { games:0, best:0, shards:0 } },
    quests: { date:'', slots:[], progress:{}, claimed:{} },
    crossAch: {},
  };
}
function loadHub() {
  try {
    const r = localStorage.getItem(HUB_KEY);
    if (r) {
      const d = JSON.parse(r);
      const hub = defaultHub();
      Object.assign(hub, d);
      hub.stats       = Object.assign(defaultHub().stats, d.stats || {});
      hub.stats.snake  = Object.assign(defaultHub().stats.snake,  (d.stats||{}).snake  || {});
      hub.stats.flight = Object.assign(defaultHub().stats.flight, (d.stats||{}).flight || {});
      hub.crossAch    = d.crossAch || {};
      return hub;
    }
  } catch(_) {}
  return defaultHub();
}
function saveHub(h) {
  try { localStorage.setItem(HUB_KEY, JSON.stringify(h)); } catch(_) {}
}

/* ─────────────────────────────────────────────────────────
   STREAK
───────────────────────────────────────────────────────── */
function updateStreak(hub) {
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (hub.lastPlay === today) return;
  hub.streak   = hub.lastPlay === yest ? (hub.streak || 0) + 1 : 1;
  hub.lastPlay = today;
}

/* ─────────────────────────────────────────────────────────
   BACKGROUND CANVAS
───────────────────────────────────────────────────────── */
const bgCvs = document.getElementById('hubBg');
const bgCtx = bgCvs.getContext('2d');
let BW, BH, BT = 0, BLast = 0, BParts = [];

function resizeBg() {
  BW = bgCvs.width  = window.innerWidth;
  BH = bgCvs.height = window.innerHeight;
  BParts = Array.from({ length: 72 }, () => ({
    x   : Math.random() * BW,
    y   : Math.random() * BH,
    vx  : (Math.random() - 0.5) * 0.45,
    vy  : (Math.random() - 0.5) * 0.35,
    r   : 0.6 + Math.random() * 2.2,
    hue : Math.random() < 0.5 ? 186 : 300,
    life: Math.random() * Math.PI * 2,
  }));
}

function drawBg(dt) {
  if (BT === 0) { bgCtx.fillStyle = '#02020c'; bgCtx.fillRect(0, 0, BW, BH); }

  bgCtx.fillStyle = 'rgba(2,2,12,0.18)';
  bgCtx.fillRect(0, 0, BW, BH);

  // Perspective grid
  const hz = BH * 0.56;
  bgCtx.save();
  bgCtx.strokeStyle = 'rgba(0,240,255,0.045)';
  bgCtx.lineWidth = 1;
  const hLines = 18;
  for (let i = 0; i <= hLines; i++) {
    const y = hz + (BH - hz) * (i / hLines);
    bgCtx.globalAlpha = 0.012 + 0.1 * (i / hLines);
    bgCtx.beginPath(); bgCtx.moveTo(0, y); bgCtx.lineTo(BW, y); bgCtx.stroke();
  }
  const vLines = 24;
  for (let i = 0; i <= vLines; i++) {
    const r  = i / vLines;
    const bx = r * BW;
    bgCtx.globalAlpha = 0.012 + 0.06 * Math.abs(r - 0.5) * 2;
    bgCtx.beginPath(); bgCtx.moveTo(BW * 0.5, hz); bgCtx.lineTo(bx, BH); bgCtx.stroke();
  }
  bgCtx.globalAlpha = 1;
  bgCtx.restore();

  // Floating particles
  BParts.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.life += dt * 1.6;
    if (p.x < 0 || p.x > BW) p.vx *= -1;
    if (p.y < 0 || p.y > BH) p.vy *= -1;
    bgCtx.save();
    bgCtx.globalAlpha = 0.09 + 0.06 * Math.sin(p.life);
    bgCtx.fillStyle   = `hsl(${p.hue},100%,66%)`;
    bgCtx.shadowColor = bgCtx.fillStyle;
    bgCtx.shadowBlur  = 8;
    bgCtx.beginPath(); bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2); bgCtx.fill();
    bgCtx.restore();
  });

  // Horizon glow
  const hg = bgCtx.createLinearGradient(0, hz - 50, 0, hz + 50);
  hg.addColorStop(0, 'rgba(0,240,255,0)');
  hg.addColorStop(0.5, `rgba(0,240,255,${0.028 + 0.012 * Math.sin(BT * 0.55)})`);
  hg.addColorStop(1, 'rgba(0,240,255,0)');
  bgCtx.fillStyle = hg;
  bgCtx.fillRect(0, hz - 50, BW, 100);

  // Vignette
  const vg = bgCtx.createRadialGradient(BW * 0.5, BH * 0.5, BH * 0.06, BW * 0.5, BH * 0.5, BH * 0.82);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,14,0.75)');
  bgCtx.fillStyle = vg;
  bgCtx.fillRect(0, 0, BW, BH);
}

function bgLoop(ts) {
  requestAnimationFrame(bgLoop);
  const dt = Math.min((ts - BLast) / 1000, 0.05);
  BLast = ts; BT += dt;
  drawBg(dt);
}

/* ─────────────────────────────────────────────────────────
   MINI CANVAS PREVIEWS (game cards)
───────────────────────────────────────────────────────── */
function initMiniCanvas(id, drawFn) {
  const cvs = document.getElementById(id);
  if (!cvs) return;
  const c = cvs.getContext('2d');
  let t = 0;
  (function frame() {
    requestAnimationFrame(frame);
    t += 0.016;
    cvs.width  = cvs.offsetWidth  || 200;
    cvs.height = cvs.offsetHeight || 120;
    drawFn(c, cvs.width, cvs.height, t);
  })();
}

/* Flight mini preview */
function drawFlightMini(c, w, h, t) {
  // Background
  c.fillStyle = '#050514'; c.fillRect(0, 0, w, h);
  c.save();
  c.strokeStyle = 'rgba(0,240,255,0.07)'; c.lineWidth = 0.7;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(i*(w/4),0); c.lineTo(i*(w/4),h); c.stroke(); }
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(0,i*(h/3)); c.lineTo(w,i*(h/3)); c.stroke(); }
  c.restore();

  // Animated pillars (two pairs)
  const speed = 55;
  const pairs = [
    { x: ((w * 0.72) - ((t * speed) % (w * 1.2)) + w * 1.2) % (w * 1.2) - w * 0.2, gap: 0.38, topH: 0.22 },
    { x: ((w * 1.22) - ((t * speed) % (w * 1.2)) + w * 1.2) % (w * 1.2) - w * 0.2, gap: 0.42, topH: 0.18 },
  ];
  pairs.forEach(p => {
    const topH = p.topH * h, botY = topH + p.gap * h;
    c.save();
    c.fillStyle = 'rgba(0,240,255,0.75)';
    c.shadowColor = '#00f0ff'; c.shadowBlur = 12;
    c.fillRect(p.x - 12, 0, 24, topH);
    c.fillRect(p.x - 12, botY, 24, h - botY + 20);
    c.restore();
  });

  // Player
  const py = h * 0.5 + Math.sin(t * 2.4) * 10;
  const px = w * 0.3;
  c.save();
  c.shadowColor = '#00f0ff'; c.shadowBlur = 22;
  c.fillStyle = '#00f0ff';
  c.beginPath(); c.roundRect(px - 10, py - 10, 20, 20, 5); c.fill();
  c.shadowBlur = 0;
  for (let i = 1; i <= 5; i++) {
    c.globalAlpha = 0.7 * (1 - i * 0.16);
    c.fillStyle = '#00f0ff';
    c.beginPath(); c.arc(px - 13 - i * 9, py, 4.5 * (1 - i * 0.14), 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  c.fillStyle = '#ffffff';
  [[-3, -2], [3, -2]].forEach(([ex, ey]) => {
    c.beginPath(); c.arc(px + ex, py + ey, 2.2, 0, Math.PI * 2); c.fill();
  });
  c.restore();
}

/* Snake mini preview */
function drawSnakeMini(c, w, h, t) {
  c.fillStyle = '#040c04'; c.fillRect(0, 0, w, h);
  c.save();
  c.strokeStyle = 'rgba(0,255,80,0.06)'; c.lineWidth = 0.7;
  const gs = 18;
  for (let x = 0; x < w; x += gs) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,h); c.stroke(); }
  for (let y = 0; y < h; y += gs) { c.beginPath(); c.moveTo(0,y); c.lineTo(w,y); c.stroke(); }
  c.restore();

  const cx = w * 0.5, cy = h * 0.5, sr = 7;
  const segs = [];
  for (let i = 0; i < 9; i++) {
    const a = t * 1.7 - i * 0.52;
    segs.push({ x: cx + Math.cos(a) * sr * (i + 1), y: cy + Math.sin(a * 1.4) * sr * (i + 1) * 0.52 });
  }
  segs.forEach((s, i) => {
    const al = 1 - i / segs.length;
    c.save();
    c.globalAlpha = al;
    c.fillStyle = '#00ff44'; c.shadowColor = '#00ff44'; c.shadowBlur = 14 * al;
    c.beginPath(); c.arc(s.x, s.y, sr * (1 - i * 0.07), 0, Math.PI * 2); c.fill();
    c.restore();
  });

  const h0 = segs[0];
  c.fillStyle = '#001800'; c.shadowBlur = 0;
  [[-2.5, -1.5], [2.5, -1.5]].forEach(([ex, ey]) => {
    c.beginPath(); c.arc(h0.x + ex, h0.y + ey, 1.8, 0, Math.PI * 2); c.fill();
  });

  const fa = t * 0.75;
  const fx = cx - 18 + Math.cos(fa) * 16, fy = cy + 8 + Math.sin(fa * 0.8) * 10;
  c.save(); c.fillStyle = '#ff1744'; c.shadowColor = '#ff4466'; c.shadowBlur = 16;
  c.beginPath(); c.arc(fx, fy, 5, 0, Math.PI * 2); c.fill(); c.restore();
}

/* ─────────────────────────────────────────────────────────
   RENDER HUB UI
───────────────────────────────────────────────────────── */
function renderAll(hub) {
  renderHeader(hub);
  renderCards(hub);
  renderQuests(hub, 'questsGrid');
  renderQuests(hub, 'questsGrid2');
  renderCrossAch(hub);
  renderProfile(hub);
}

function renderHeader(hub) {
  const tier = getTier(hub.level || 1);
  const pct  = Math.min(100, Math.round(((hub.xp||0) / xpNeeded(hub.level||1)) * 100));

  document.getElementById('ppTierIcon').textContent  = tier.icon;
  document.getElementById('ppLevelNum').textContent  = hub.level || 1;
  document.getElementById('ppLevelNum').style.color  = tier.color;
  document.getElementById('ppLevelNum').style.textShadow = `0 0 10px ${tier.color}`;
  document.getElementById('ppTierName').textContent  = tier.name;
  document.getElementById('ppTierName').style.color  = tier.color;

  const xpBar = document.getElementById('ppXPBar');
  xpBar.style.width      = pct + '%';
  xpBar.style.background = tier.color;
  xpBar.style.boxShadow  = `0 0 6px ${tier.color}`;

  const sEl = document.getElementById('ppShards');
  sEl.textContent = (hub.shards || 0).toLocaleString();

  const streak = hub.streak || 0;
  document.getElementById('ppStreak').textContent = streak >= 2 ? `🔥 ${streak}d` : '';
}

function renderCards(hub) {
  document.getElementById('csFlightBest').textContent  = hub.stats?.flight?.best  || 0;
  document.getElementById('csFlightPlays').textContent = hub.stats?.flight?.games || 0;
  document.getElementById('csSnakeBest').textContent   = hub.stats?.snake?.best   || 0;
  document.getElementById('csSnakePlays').textContent  = hub.stats?.snake?.games  || 0;
}

function renderQuests(hub, gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';
  const qData = hub.quests;
  if (!qData.slots?.length) {
    grid.innerHTML = '<div style="text-align:center;color:var(--dim);padding:20px;font-size:.55rem;">No quests available.</div>';
    return;
  }
  qData.slots.forEach(q => {
    const prog    = qData.progress[q.id] || 0;
    const claimed = !!(qData.claimed[q.id]);
    const done    = prog >= q.target;
    const pct     = Math.min(100, Math.round((prog / q.target) * 100));
    const badgeCls = q.game === 'flight' ? 'qbadge-flight' : q.game === 'snake' ? 'qbadge-snake' : 'qbadge-both';
    const badgeTxt = q.game === 'flight' ? '✈ FLIGHT' : q.game === 'snake' ? '⊞ SNAKE' : '⬡ BOTH';

    const div = document.createElement('div');
    div.className = 'quest-card' + (done ? (claimed ? ' quest-claimed' : ' quest-done') : '');
    div.innerHTML = `
      <div class="quest-icon">${q.icon}</div>
      <div class="quest-body">
        <div class="quest-header">
          <span class="quest-game-badge ${badgeCls}">${badgeTxt}</span>
          <span class="quest-label">${q.label}</span>
        </div>
        <div class="quest-bar-bg"><div class="quest-bar-fill" style="width:${pct}%"></div></div>
        <div class="quest-prog">${prog} / ${q.target}</div>
      </div>
      <div class="quest-action">
        ${done && !claimed
          ? `<button class="quest-claim-btn" data-qid="${q.id}">CLAIM<span class="quest-claim-xp">+${q.xpR}XP ${q.shrR?'+'+q.shrR+'💎':''}</span></button>`
          : claimed
          ? '<div class="quest-done-badge">✓</div>'
          : `<div class="quest-reward-txt">+${q.xpR} XP<br>+${q.shrR} 💎</div>`
        }
      </div>`;
    grid.appendChild(div);
    div.querySelector('.quest-claim-btn')?.addEventListener('click', () => claimQuest(q.id));
  });
}

function claimQuest(qid) {
  const hub = loadHub();
  if (hub.quests.claimed[qid]) return;
  const q = hub.quests.slots.find(x => x.id === qid);
  if (!q || (hub.quests.progress[qid] || 0) < q.target) return;
  hub.quests.claimed[qid] = true;
  hub.xp     = (hub.xp     || 0) + q.xpR;
  hub.shards = (hub.shards || 0) + q.shrR;
  while (hub.xp >= xpNeeded(hub.level || 1)) { hub.xp -= xpNeeded(hub.level); hub.level++; }
  const newAch = checkCrossAch(hub);
  saveHub(hub);
  renderAll(hub);
  pulseShards();
  if (newAch.length) showAchToast(newAch[0]);
}

function pulseShards() {
  const el = document.getElementById('ppShards');
  el.classList.add('pulse');
  setTimeout(() => el.classList.remove('pulse'), 500);
}

function renderCrossAch(hub) {
  const grid  = document.getElementById('crossAchGrid');
  const count = document.getElementById('crossAchCount');
  if (!grid) return;
  grid.innerHTML = '';
  CROSS_ACH.forEach(a => {
    const earned = !!hub.crossAch[a.id];
    const div    = document.createElement('div');
    div.className = 'xach-card' + (earned ? ' earned' : '');
    div.innerHTML = `
      <div class="xach-icon">${earned ? a.icon : '🔒'}</div>
      <div class="xach-body">
        <div class="xach-name">${earned ? a.name : '???'}</div>
        <div class="xach-desc">${earned ? a.desc : 'Complete to reveal'}</div>
        ${earned ? `<div class="xach-reward">🎁 ${a.reward}</div>` : ''}
      </div>
      ${earned ? '<div class="xach-check">✓</div>' : ''}`;
    grid.appendChild(div);
  });
  const n = CROSS_ACH.filter(a => hub.crossAch[a.id]).length;
  if (count) count.textContent = `${n} / ${CROSS_ACH.length}`;
}

function renderProfile(hub) {
  const tier = getTier(hub.level || 1);
  const pct  = Math.min(100, Math.round(((hub.xp||0) / xpNeeded(hub.level||1)) * 100));

  document.getElementById('profileAvatar').textContent     = tier.icon;
  document.getElementById('profileLevel').textContent      = hub.level || 1;
  const tn = document.getElementById('profileTierName');
  tn.textContent   = tier.name;
  tn.style.color   = tier.color;

  const streak = hub.streak || 0;
  document.getElementById('profileStreak').textContent = streak >= 2 ? `🔥 ${streak}-DAY STREAK` : '';

  const pxb = document.getElementById('profileXPBar');
  pxb.style.width      = pct + '%';
  pxb.style.background = tier.color;
  pxb.style.boxShadow  = `0 0 10px ${tier.color}`;
  document.getElementById('profileXPLabel').textContent = `${hub.xp||0} / ${xpNeeded(hub.level||1)} XP`;

  document.getElementById('profileShards').textContent = (hub.shards||0).toLocaleString();

  document.getElementById('pFlightBest').textContent  = hub.stats?.flight?.best  || 0;
  document.getElementById('pFlightPlays').textContent = hub.stats?.flight?.games || 0;
  document.getElementById('pSnakeBest').textContent   = hub.stats?.snake?.best   || 0;
  document.getElementById('pSnakePlays').textContent  = hub.stats?.snake?.games  || 0;
  document.getElementById('pTotalGames').textContent  = (hub.stats?.snake?.games||0) + (hub.stats?.flight?.games||0);

  // Tier ladder
  const ladder = document.getElementById('tierLadder');
  if (ladder && !ladder.childElementCount) {
    TIERS.forEach(t => {
      const isCurrentTier = (hub.level||1) >= t.from && (hub.level||1) <= t.to;
      const isPast = (hub.level||1) > t.to;
      const row = document.createElement('div');
      row.className = 'tier-row' + (isCurrentTier ? ' current-tier' : '');
      row.innerHTML = `
        <div class="tier-row-icon">${t.icon}</div>
        <div class="tier-row-info">
          <div class="tier-row-name" style="color:${t.color}">${t.name}</div>
          <div class="tier-row-range">Levels ${t.from}${t.to === Infinity ? '+' : '–' + t.to}</div>
        </div>
        ${isPast || isCurrentTier ? '<div class="tier-row-check">✓</div>' : ''}`;
      ladder.appendChild(row);
    });
  }
}

/* ─────────────────────────────────────────────────────────
   ACHIEVEMENT TOAST
───────────────────────────────────────────────────────── */
function showAchToast(a) {
  document.getElementById('toastIcon').textContent = a.icon;
  document.getElementById('toastName').textContent = a.name;
  document.getElementById('toastDesc').textContent = a.desc;
  const el = document.getElementById('achToast');
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3600);
}

/* ─────────────────────────────────────────────────────────
   LEVEL UP OVERLAY
───────────────────────────────────────────────────────── */
function showLevelUp(level) {
  const tier = getTier(level);
  document.getElementById('luNum').textContent      = level;
  document.getElementById('luTierName').textContent = tier.name;
  document.getElementById('luTierName').style.color = tier.color;
  const el = document.getElementById('levelUpOverlay');
  el.classList.add('active');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('active'), 3400);
}

/* ─────────────────────────────────────────────────────────
   GAME LAUNCH  (page navigation — works with local files)
───────────────────────────────────────────────────────── */
function launchGame(game) {
  // Animate card press
  const cardId = game === 'flight' ? 'flightCard' : 'snakeCard';
  const card = document.getElementById(cardId);
  if (card) {
    card.style.transform = 'scale(0.96)';
    card.style.opacity   = '0.7';
  }
  // Short delay for visual feedback, then navigate
  setTimeout(() => {
    window.location.href = GAME_PATHS[game];
  }, 180);
}

/* ─────────────────────────────────────────────────────────
   TABS
───────────────────────────────────────────────────────── */
function initTabs() {
  document.querySelectorAll('.hub-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.hub-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.hub-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const sec = document.getElementById('sec-' + btn.dataset.tab);
      if (sec) sec.classList.add('active');
    });
  });
}

/* ─────────────────────────────────────────────────────────
   LIGHT MODE
───────────────────────────────────────────────────────── */
function initLightMode() {
  const isLight = localStorage.getItem(LIGHT_KEY) === '1';
  const check   = document.getElementById('lightCheck');
  const knob    = document.querySelector('.lt-knob');
  if (isLight) {
    document.body.classList.add('hub-light');
    check.checked = true;
    if (knob) knob.textContent = '☀️';
  }
  check.addEventListener('change', () => {
    const light = check.checked;
    document.body.classList.toggle('hub-light', light);
    localStorage.setItem(LIGHT_KEY, light ? '1' : '0');
    if (knob) knob.textContent = light ? '☀️' : '🌙';
  });
}



/* ─────────────────────────────────────────────────────────
   PERIODIC REFRESH (picks up game data while iframe is open)
───────────────────────────────────────────────────────── */
let hubState = {};

function periodicRefresh() {
  const fresh  = loadHub();
  const prevLv = hubState.level || 1;
  genTodayQuests(fresh);
  const newAch = checkCrossAch(fresh);
  if (newAch.length) saveHub(fresh);
  Object.assign(hubState, fresh);
  renderAll(hubState);
  if ((fresh.level||1) > prevLv && prevLv > 0) {
    showLevelUp(fresh.level);
    saveHub(hubState);
  }
  if (newAch.length) setTimeout(() => showAchToast(newAch[0]), 400);
}

/* ─────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────── */
function boot() {
  resizeBg();
  window.addEventListener('resize', resizeBg);
  requestAnimationFrame(bgLoop);

  initTabs();
  initLightMode();

  hubState = loadHub();
  updateStreak(hubState);
  genTodayQuests(hubState);
  const initAch = checkCrossAch(hubState);
  saveHub(hubState);
  renderAll(hubState);

  // Animate XP bars on load
  setTimeout(() => {
    const pct = Math.min(100, Math.round(((hubState.xp||0) / xpNeeded(hubState.level||1)) * 100));
    document.getElementById('ppXPBar').style.transition      = 'width 1.1s cubic-bezier(.4,0,.2,1)';
    document.getElementById('profileXPBar').style.transition = 'width 1.1s cubic-bezier(.4,0,.2,1)';
    document.getElementById('ppXPBar').style.width           = pct + '%';
    document.getElementById('profileXPBar').style.width      = pct + '%';
  }, 350);

  if (initAch.length) setTimeout(() => showAchToast(initAch[0]), 1200);

  // Mini canvas animations
  initMiniCanvas('flightCvs', drawFlightMini);
  initMiniCanvas('snakeCvs',  drawSnakeMini);

  // Launch buttons
  document.getElementById('launchFlight').addEventListener('click', () => launchGame('flight'));
  document.getElementById('launchSnake').addEventListener('click',  () => launchGame('snake'));

  // Settings modal
  document.getElementById('hubSettingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('open');
  });
  document.getElementById('modalClose').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('open');
  });
  document.getElementById('settingsModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
  });
  document.getElementById('resetHubBtn').addEventListener('click', () => {
    if (confirm('Reset ALL hub progress? (Game saves are separate and will not be affected.)')) {
      localStorage.removeItem(HUB_KEY);
      location.reload();
    }
  });

  // Poll for updates every 6 seconds
  setInterval(periodicRefresh, 6000);
}

document.addEventListener('DOMContentLoaded', boot);
