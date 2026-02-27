/*
==========================================================
Neon Snake — V5 Release Edition
© 2025 Neon Inc — All Rights Reserved

This game, its source code, design, mechanics,
art style, and assets are the intellectual property
of Neon Inc.

No part of this software may be copied, modified,
distributed, or used without explicit written permission
from Neon Inc.
==========================================================
*/


/* =====================================================
   NEON SNAKE  ·  game.js  ·  Neon Inc  v5.0
   Release Edition
   ===================================================== */
'use strict';

/* ═══════════════════════════════════════════════════
   §1  CONFIG
═══════════════════════════════════════════════════ */
const CFG = {
  GRID         : 22,
  BASE_SPEED   : 150,    // ms per tick (start)
  MIN_SPEED    : 85,     // ms per tick (cap — stays playable forever)
  // Speed is now continuous: no more 8ms step jumps every 5 apples
  COMBO_WINDOW : 4500,   // ms between apples to chain combo

  FA_SPEED     : 2.6,    // px/frame
  FA_TURN      : 0.068,  // radians/frame max turn
  FA_SEG_DIST  : 12,     // px between body segments in trail
  FA_HEAD_R    : 9,
  FA_SEG_R     : 7,
  FA_FOOD_R    : 11,

  SPECIAL_CHANCE : 0.20,
  W_GOLDEN  : 0.50,
  W_BAD     : 0.25,
  W_COMBO   : 0.16,
  W_VOLATILE: 0.09,

  GOLDEN_TTL    : 9000,
  INFECTION_DUR : 7000,   // how long bad apple lasts
  BAD_COOLDOWN  : 20000,  // min time before another bad apple spawns
  COMBO_DUR     : 5500,   // 2× score multi duration
  MINI_TTL      : 4500,

  BOSS_TRIGGER  : 30,     // apples to trigger boss
  BOSS_HP       : 9,      // hits to kill
  BOSS_R        : 22,

  DRAIN_INTERVAL: 2200,   // ms between score drain ticks while infected

  RANKS : [
    { min:0,  name:'GLOW INITIATE',  cls:'rank-0' },
    { min:8,  name:'GRID WALKER',    cls:'rank-1' },
    { min:18, name:'PULSE RIDER',    cls:'rank-2' },
    { min:32, name:'NEON ARCHITECT', cls:'rank-3' },
    { min:50, name:'RADIANT MASTER', cls:'rank-4' },
  ],

  MILESTONE_NEXT : [5, 10, 20, 30, 50, 75, 100],
};

/* ═══════════════════════════════════════════════════
   §2  AUDIO ENGINE
═══════════════════════════════════════════════════ */
let _ac = null;
function getAC() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  if (_ac.state === 'suspended') _ac.resume();
  return _ac;
}
const vol   = () => parseFloat(document.getElementById('volumeSlider')?.value ?? 0.5);
const sfxOn = () => document.getElementById('sfxToggle')?.checked !== false;

function tone(freq, dur, type = 'sine', gain = 0.25, bend = null) {
  if (!sfxOn()) return;
  try {
    const ac = getAC(), o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime);
    if (bend) o.frequency.exponentialRampToValueAtTime(bend, ac.currentTime + dur);
    g.gain.setValueAtTime(gain * vol(), ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.start(); o.stop(ac.currentTime + dur + 0.01);
  } catch (_) {}
}

const SFX = {
  eat      : () => { tone(440, .11, 'sine', .28, 900); },
  eatGold  : () => { tone(660, .14, 'sine', .3,  1350); },
  eatBad   : () => { tone(120, .32, 'sawtooth', .38, 60); },
  eatCombo : () => { tone(550, .1,  'triangle', .28, 820); },
  eatVol   : () => { tone(300, .18, 'square', .3, 600); },
  die      : () => { [260,190,115].forEach((f,i) => setTimeout(() => tone(f,.22,'sawtooth',.32), i*145)); },
  levelUp  : () => { [523,659,784,1047].forEach((f,i) => setTimeout(() => tone(f,.2,'sine',.22), i*115)); },
  comboUp  : (c) => { tone(330 + c*50, .09, 'triangle', .18); },
  bossIn   : () => { [80,60,40].forEach((f,i) => setTimeout(() => tone(f,.5,'sawtooth',.36), i*200)); },
  bossHit  : (hp) => { tone(900 - hp*60, .1, 'square', .22); },
  bossDef  : () => { [300,400,600,900,1200].forEach((f,i) => setTimeout(() => tone(f,.25,'sine',.28), i*120)); },
  infect   : () => { tone(160, .4, 'sawtooth', .35, 60); setTimeout(() => tone(90,.3,'sawtooth',.3,50), 300); },
  recover  : () => { tone(440,.1,'sine',.22,660); },
  rainbow  : () => { [261,330,392,523,659,784,1047].forEach((f,i) => setTimeout(() => tone(f,.18,'sine',.2), i*100)); },
};

/* ═══════════════════════════════════════════════════
   §3  PERSISTENCE
═══════════════════════════════════════════════════ */
const LS  = (k, d = '') => localStorage.getItem('ns5_' + k) ?? d;
const LSS = (k, v)      => localStorage.setItem('ns5_' + k, v);

let level        = parseInt(LS('level', '1'));
let xp           = parseInt(LS('xp', '0'));
let highScoreC   = parseInt(LS('hsc', '0'));
let highScoreF   = parseInt(LS('hsf', '0'));
let selectedSkin = LS('skin', 'default');
let selectedTrail= LS('trail', 'none');
let selectedTheme= LS('theme', 'neon');
let unlockedSkins  = JSON.parse(LS('unlockedSkins',  '["default","trail"]'));
let unlockedTrails = JSON.parse(LS('unlockedTrails', '["none"]'));
let unlockedThemes = JSON.parse(LS('unlockedThemes', '["neon"]'));

let ls = JSON.parse(LS('lifestats', '{}'));
['games','apples','distance','bosses','badSurvived','totalScore'].forEach(k => { if (!ls[k]) ls[k] = 0; });

// Daily streak
const today     = new Date().toDateString();
const lastPlay  = LS('lastplay', '');
const yesterday = new Date(Date.now() - 86400000).toDateString();
let streak      = parseInt(LS('streak', '0'));
if (lastPlay !== today) {
  streak = (lastPlay === yesterday) ? streak + 1 : 1;
  LSS('streak', streak);
}

function xpToNext() { return 100 + level * 50; }

function saveAll() {
  LSS('level', level); LSS('xp', xp);
  LSS('hsc', highScoreC); LSS('hsf', highScoreF);
  LSS('skin', selectedSkin); LSS('trail', selectedTrail); LSS('theme', selectedTheme);
  LSS('unlockedSkins',  JSON.stringify(unlockedSkins));
  LSS('unlockedTrails', JSON.stringify(unlockedTrails));
  LSS('unlockedThemes', JSON.stringify(unlockedThemes));
  LSS('lifestats', JSON.stringify(ls));
  LSS('lastplay', today);
  LSS('streak', streak);
  LSS('achievements', JSON.stringify(achievements));
}

function grantSkin(id)  { if (!unlockedSkins.includes(id))  unlockedSkins.push(id); }
function grantTrail(id) { if (!unlockedTrails.includes(id)) unlockedTrails.push(id); }
function grantTheme(id) { if (!unlockedThemes.includes(id)) unlockedThemes.push(id); }

/* ═══════════════════════════════════════════════════
   §4  THEME ENGINE
═══════════════════════════════════════════════════ */
const THEMES = {
  neon: {
    label: 'NEON CLASSIC', colors: ['#02020c','#00f0ff','#ff00ff'],
    vars: {
      '--bg':'#02020c','--bg2':'#060616','--panel':'rgba(6,6,24,0.97)','--panel2':'#0c0c2a',
      '--border':'rgba(0,240,255,0.13)','--accent':'#00f0ff','--accent2':'#ff00ff',
      '--accent3':'#7b2fff','--grid':'rgba(255,255,255,0.022)',
    },
    unlockLevel: 1, achieveReq: null,
  },
  vaporwave: {
    label: 'VAPORWAVE', colors: ['#0a0020','#ff6fff','#44ffee'],
    vars: {
      '--bg':'#0a0020','--bg2':'#120030','--panel':'rgba(10,0,30,0.97)','--panel2':'#1a0040',
      '--border':'rgba(255,100,255,0.18)','--accent':'#ff6fff','--accent2':'#44ffee',
      '--accent3':'#cc44ff','--grid':'rgba(255,100,255,0.04)',
    },
    unlockLevel: 3, achieveReq: null,
  },
  darkpulse: {
    label: 'DARK PULSE', colors: ['#000408','#00ff44','#ff8800'],
    vars: {
      '--bg':'#000408','--bg2':'#000c10','--panel':'rgba(0,4,8,0.98)','--panel2':'#001218',
      '--border':'rgba(0,255,68,0.14)','--accent':'#00ff44','--accent2':'#ff8800',
      '--accent3':'#00ccff','--grid':'rgba(0,255,68,0.025)',
    },
    unlockLevel: 5, achieveReq: null,
  },
  pastel: {
    label: 'SOFT PASTEL', colors: ['#1a0828','#ffaadd','#aaffdd'],
    vars: {
      '--bg':'#1a0828','--bg2':'#220a34','--panel':'rgba(22,6,36,0.97)','--panel2':'#2c0e44',
      '--border':'rgba(255,150,220,0.18)','--accent':'#ffaadd','--accent2':'#aaffdd',
      '--accent3':'#ddaaff','--grid':'rgba(255,150,220,0.04)',
    },
    unlockLevel: 1, achieveReq: 'm_level6',
  },
  cybergrid: {
    label: 'CYBER GRID', colors: ['#000c08','#00ffcc','#ff3300'],
    vars: {
      '--bg':'#000c08','--bg2':'#001410','--panel':'rgba(0,10,6,0.98)','--panel2':'#001c14',
      '--border':'rgba(0,255,180,0.2)','--accent':'#00ffcc','--accent2':'#ff3300',
      '--accent3':'#ffcc00','--grid':'rgba(0,255,180,0.06)',
    },
    unlockLevel: 1, achieveReq: 'c_boss',
  },
  bossarena: {
    label: 'BOSS ARENA', colors: ['#080002','#ff1744','#ff8800'],
    vars: {
      '--bg':'#080002','--bg2':'#0f0005','--panel':'rgba(8,0,2,0.98)','--panel2':'#180008',
      '--border':'rgba(255,23,68,0.22)','--accent':'#ff1744','--accent2':'#ff8800',
      '--accent3':'#ff3300','--grid':'rgba(255,23,68,0.04)',
    },
    unlockLevel: 1, achieveReq: 'boss_classic',
  },
};

const THEME_LIST = Object.entries(THEMES).map(([id, t]) => ({id, ...t}));

function themeAvail(id) {
  const t = THEMES[id]; if (!t) return false;
  if (unlockedThemes.includes(id)) return true;
  if (t.achieveReq && achievements[t.achieveReq]) return true;
  if (!t.achieveReq && level >= t.unlockLevel) return true;
  return false;
}

function applyTheme(id) {
  selectedTheme = id;
  const t = THEMES[id]; if (!t) return;
  const root = document.documentElement;
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

/* ═══════════════════════════════════════════════════
   §5  ACHIEVEMENTS
═══════════════════════════════════════════════════ */
const ADEFS = [
  // ── CLASSIC ──
  { id:'c_first',    cat:'classic', icon:'🍎', name:'FIRST BITE',      desc:'Eat your first apple in Classic.' },
  { id:'c_10run',    cat:'classic', icon:'💪', name:'SOLID RUN',       desc:'Eat 10 apples in one Classic run.' },
  { id:'c_30run',    cat:'classic', icon:'🏃', name:'MARATHON',        desc:'Eat 30 apples in one Classic run.' },
  { id:'c_combo5',   cat:'classic', icon:'🔥', name:'ON FIRE',         desc:'Reach ×5 combo in Classic.' },
  { id:'c_combo10',  cat:'classic', icon:'💥', name:'UNSTOPPABLE',     desc:'Reach ×10 combo in Classic.',  reward:'Gold skin' },
  { id:'c_speed',    cat:'classic', icon:'⚡', name:'SPEED DEMON',     desc:'Hit max snake speed.' },
  { id:'c_survive3', cat:'classic', icon:'⏱', name:'ENDURANCE',       desc:'Survive 3 minutes in Classic.' },
  { id:'c_golden',   cat:'classic', icon:'✨', name:'GOLDEN TOUCH',    desc:'Eat a golden apple.' },
  { id:'c_bad',      cat:'classic', icon:'☠️', name:'BAD APPLE',       desc:'Eat a bad apple and recover.' },
  { id:'c_bad3',     cat:'classic', icon:'🧬', name:'IMMUNE',          desc:'Survive 3 bad apples total.',   reward:'Pastel trail' },
  { id:'c_volatile', cat:'classic', icon:'💣', name:'VOLATILE',        desc:'Eat a volatile apple.' },
  { id:'c_42',       cat:'classic', icon:'🌐', name:'THE ANSWER',      desc:'Score exactly 42 in Classic.' },
  // ── FREE AIM ──
  { id:'f_first',    cat:'free',    icon:'🖱', name:'FREE SPIRIT',     desc:'Eat your first apple in Free Aim.' },
  { id:'f_10run',    cat:'free',    icon:'🌀', name:'SMOOTH OPERATOR', desc:'Eat 10 apples in Free Aim.' },
  { id:'f_30run',    cat:'free',    icon:'🏄', name:'SURFER',          desc:'Eat 30 apples in Free Aim.' },
  { id:'f_survive3', cat:'free',    icon:'🌊', name:'CURRENT',         desc:'Survive 3 minutes in Free Aim.' },
  { id:'f_golden',   cat:'free',    icon:'🌟', name:'TREASURE HUNTER', desc:'Eat 5 golden apples in Free Aim.' },
  // ── BOSS ──
  { id:'boss_classic',cat:'boss',   icon:'👑', name:'BOSS SLAYER',     desc:'Defeat the boss in Classic.',   reward:'Void skin + Cyber Grid theme' },
  { id:'boss_free',  cat:'boss',    icon:'🤖', name:'MECHANIZED',      desc:'Defeat the boss in Free Aim.',  reward:'Boss skin' },
  { id:'boss_ascend',cat:'boss',    icon:'🌌', name:'ASCENDED',        desc:'Enter Ascended Mode.',          reward:'Plasma skin' },
  { id:'boss_3',     cat:'boss',    icon:'💀', name:'BOSS HUNTER',     desc:'Defeat 3 total bosses.',        reward:'Boss Arena theme' },
  { id:'boss_p3',    cat:'boss',    icon:'🔥', name:'PHASE THREE',     desc:'Reach boss phase 3.' },
  // ── LIFETIME / META ──
  { id:'m_games10',  cat:'meta',    icon:'🎮', name:'DEDICATED',       desc:'Play 10 total games.' },
  { id:'m_games50',  cat:'meta',    icon:'🕹',  name:'HARDCORE',        desc:'Play 50 total games.',          reward:'Electric trail' },
  { id:'m_level3',   cat:'meta',    icon:'📈', name:'LEVELING UP',     desc:'Reach Level 3.' },
  { id:'m_level6',   cat:'meta',    icon:'🚀', name:'RISING FAST',     desc:'Reach Level 6.',                reward:'Soft Pastel theme + Ice skin' },
  { id:'m_level10',  cat:'meta',    icon:'🏆', name:'VETERAN',         desc:'Reach Level 10.',               reward:'Ribbon trail' },
  { id:'m_apples',   cat:'meta',    icon:'💯', name:'CENTENNIAL',      desc:'Eat 100 lifetime apples.' },
  { id:'m_dist',     cat:'meta',    icon:'📏', name:'LONG JOURNEY',    desc:'Travel 5000 lifetime blocks.' },
  { id:'m_dist2',    cat:'meta',    icon:'🗺',  name:'EXPLORER',        desc:'Travel 15000 lifetime blocks.', reward:'Spark trail' },
  { id:'m_bad5',     cat:'meta',    icon:'🦠', name:'RESILIENT',       desc:'Survive 5 total bad apples.',   reward:'Pastel skin' },
  { id:'m_hs',       cat:'meta',    icon:'👑', name:'THE BEST',        desc:'Beat your high score.' },
  { id:'m_skins3',   cat:'meta',    icon:'🎨', name:'COLLECTOR',       desc:'Unlock 3 or more skins.' },
  { id:'m_neon',     cat:'meta',    icon:'🌈', name:'NEON MASTER',     desc:'Discover rainbow mode.' },
];

// Mapping achievements → unlocks
const ACH_UNLOCKS = {
  c_combo10  : { skin:'gold' },
  c_bad3     : { trail:'pastel' },
  boss_classic: { skin:'void', theme:'cybergrid' },
  boss_free  : { skin:'boss' },
  boss_ascend: { skin:'plasma' },
  boss_3     : { theme:'bossarena' },
  m_level6   : { theme:'pastel', skin:'ice' },
  m_level10  : { trail:'ribbon' },
  m_bad5     : { skin:'pastel_snake' },
  m_games50  : { trail:'electric' },
  m_dist2    : { trail:'spark' },
};

let achievements  = JSON.parse(LS('achievements', '{}'));
let _sessAchieves = [];

function checkUnlock(id) {
  if (achievements[id]) return false;
  achievements[id] = true;
  _sessAchieves.push(id);
  showAchieveToast(id);
  const u = ACH_UNLOCKS[id];
  if (u) {
    if (u.skin)  grantSkin(u.skin);
    if (u.trail) grantTrail(u.trail);
    if (u.theme) grantTheme(u.theme);
  }
  return true;
}

function showAchieveToast(id) {
  const def = ADEFS.find(a => a.id === id);
  if (!def) return;
  const el = document.getElementById('achieveToast');
  el.innerHTML = `${def.icon} Achievement Unlocked<br><b>${def.name}</b>`;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3500);
}

/* ═══════════════════════════════════════════════════
   §6  SKIN + TRAIL SYSTEM  (animated support)
═══════════════════════════════════════════════════ */
const SKIN_DATA = {
  default:     { head:'#ffffff', body:'#00f0ff', glow:'#00f0ff', food:'#ff00ff', foodGlow:'#ff00ff' },
  trail:       { head:'#ffffff', body:'#00f0ff', glow:'#00f0ff', food:'#ff00ff', foodGlow:'#ff00ff' },
  fire:        { head:'#ffffaa', body:'#ff6600', glow:'#ff8800', food:'#ffaa00', foodGlow:'#ff6600',
    bodyFn:(t,i)=>`hsl(${18+Math.sin(t*.005+i*.8)*12},100%,${44+Math.sin(t*.007+i)*.10*100}%)`,
    glowFn:(t,i)=>`rgba(255,${Math.round(80+60*Math.sin(t*.007+i))},0,0.9)` },
  gold:        { head:'#ffffff', body:'#ffd700', glow:'#ffcc00', food:'#ffd700', foodGlow:'#ffaa00',
    bodyFn:(t,i)=>`hsl(${42+Math.sin(t*.004-i*.6)*12},100%,${50+Math.sin(t*.005+i*.4)*12}%)` },
  ice:         { head:'#eeffff', body:'#88ddff', glow:'#aaeeff', food:'#ccffff', foodGlow:'#88eeff',
    bodyFn:(t,i)=>`hsl(${192+Math.sin(t*.003+i*1.2)*24},100%,${65+Math.sin(t*.004+i*.5)*14}%)` },
  void:        { head:'#ffffff', body:'#9955ff', glow:'#aa44ff', food:'#cc44ff', foodGlow:'#9900ff',
    bodyFn:(t,i)=>`hsl(${270+Math.sin(t*.004+i*.7)*38},100%,58%)`,
    glowFn:(t,i)=>`hsl(${(280+i*10)%360},100%,65%)` },
  plasma:      { head:'#ffffff', body:'#00ff88', glow:'#00ff88', food:'#00ffaa', foodGlow:'#00ff66',
    bodyFn:(t,i)=>`hsl(${148+Math.sin(t*.006+i*.7)*52},100%,${52+Math.sin(t*.005+i*.4)*16}%)` },
  boss:        { head:'#ffffff', body:'#ff1744', glow:'#ff1744', food:'#ff9800', foodGlow:'#ff6d00',
    bodyFn:(t,i)=>`hsl(${Math.round(Math.sin(t*.008+i*.5)*18)},100%,48%)`,
    glowFn:(t,i)=>`rgba(255,${Math.round(20+30*Math.sin(t*.01+i))},0,0.9)` },
  pastel_snake:{ head:'#fff0ff', body:'#ffaaff', glow:'#ff88ee', food:'#aaffdd', foodGlow:'#88ffcc',
    bodyFn:(t,i)=>`hsl(${(t*.022+i*15)%360},75%,76%)`,
    glowFn:(t,i)=>`hsl(${(t*.022+i*15)%360},75%,68%)` },
};

const SKIN_LIST = [
  { id:'default',      name:'DEFAULT',     unlockLevel:1, achieveReq:null },
  { id:'trail',        name:'NEON TRAIL',  unlockLevel:2, achieveReq:null },
  { id:'fire',         name:'🔥 FIRE',     unlockLevel:4, achieveReq:null },
  { id:'gold',         name:'✨ GOLD',     unlockLevel:1, achieveReq:'c_combo10' },
  { id:'ice',          name:'❄️ ICE',      unlockLevel:1, achieveReq:'m_level6' },
  { id:'void',         name:'🌌 VOID',     unlockLevel:1, achieveReq:'boss_classic' },
  { id:'plasma',       name:'⚡ PLASMA',   unlockLevel:1, achieveReq:'boss_ascend' },
  { id:'pastel_snake', name:'🌸 PASTEL',   unlockLevel:1, achieveReq:'m_bad5' },
  { id:'boss',         name:'👑 BOSS',     unlockLevel:1, achieveReq:'boss_free' },
];

// Trail system — separate from skin, controls body trail rendering
const TRAIL_DATA = {
  none:     { label:'NO TRAIL',      render: null },
  ribbon:   { label:'RIBBON',        render:'ribbon' },
  pastel:   { label:'PASTEL GLOW',   render:'pastel' },
  electric: { label:'ELECTRIC SPARK',render:'electric' },
  spark:    { label:'SPARK BURST',   render:'spark' },
  particle: { label:'PARTICLE TRAIL',render:'particle' },
};

const TRAIL_LIST = [
  { id:'none',     label:'NO TRAIL',       unlockLevel:1, achieveReq:null },
  { id:'ribbon',   label:'🎀 RIBBON',      unlockLevel:1, achieveReq:'m_level10' },
  { id:'pastel',   label:'🌸 PASTEL GLOW', unlockLevel:1, achieveReq:'c_bad3' },
  { id:'electric', label:'⚡ ELECTRIC',    unlockLevel:1, achieveReq:'m_games50' },
  { id:'spark',    label:'✦ SPARK BURST',  unlockLevel:1, achieveReq:'m_dist2' },
  { id:'particle', label:'• PARTICLE',     unlockLevel:3, achieveReq:null },
];

function skinAvail(def) {
  if (unlockedSkins.includes(def.id)) return true;
  if (def.achieveReq && achievements[def.achieveReq]) return true;
  if (!def.achieveReq && level >= def.unlockLevel) return true;
  return false;
}
function trailAvail(def) {
  if (unlockedTrails.includes(def.id)) return true;
  if (def.achieveReq && achievements[def.achieveReq]) return true;
  if (!def.achieveReq && level >= def.unlockLevel) return true;
  return false;
}

function getSkinColor(id, t, i, len) {
  if (rainbowMode && Date.now() < rainbowEnd)
    return `hsl(${((Date.now() * .18) - i * 16) % 360},100%,62%)`;
  const sk = SKIN_DATA[id] || SKIN_DATA.default;
  return sk.bodyFn ? sk.bodyFn(t, i, len) : sk.body;
}
function getSkinGlow(id, t, i) {
  if (rainbowMode && Date.now() < rainbowEnd)
    return `hsl(${((Date.now() * .18) - i * 16) % 360},100%,62%)`;
  const sk = SKIN_DATA[id] || SKIN_DATA.default;
  return sk.glowFn ? sk.glowFn(t, i) : sk.glow;
}

// Rainbow state
let rainbowMode = false, rainbowEnd = 0;

/* ═══════════════════════════════════════════════════
   §7  ANIMATED BACKGROUND
═══════════════════════════════════════════════════ */
const bgCvs = document.getElementById('bgCvs');
const bgCtx = bgCvs.getContext('2d');
let bgLines = [];

function resizeBG() {
  bgCvs.width  = window.innerWidth;
  bgCvs.height = window.innerHeight;
  bgLines = [];
  for (let i = 0; i < 30; i++) {
    bgLines.push({
      x:Math.random()*bgCvs.width, y:Math.random()*bgCvs.height,
      vx:(Math.random()-.5)*.45,   vy:(Math.random()-.5)*.45,
      len:40+Math.random()*110,    alpha:.03+Math.random()*.07,
      hue:Math.random()<.5?180:300,
    });
  }
}
window.addEventListener('resize', resizeBG);
resizeBG();

function drawBG(t) {
  if (document.getElementById('bgToggle')?.checked === false) { bgCtx.clearRect(0,0,bgCvs.width,bgCvs.height); return; }
  bgCtx.clearRect(0,0,bgCvs.width,bgCvs.height);
  for (const ln of bgLines) {
    ln.x += ln.vx; ln.y += ln.vy;
    if (ln.x < -200 || ln.x > bgCvs.width + 200)  ln.vx *= -1;
    if (ln.y < -200 || ln.y > bgCvs.height + 200) ln.vy *= -1;
    const p = .5 + .5 * Math.sin(t * .001 + ln.hue);
    const ax = ln.vx || .001, ay = ln.vy || .001;
    const ex = ln.x + (ax/Math.abs(ax)) * ln.len * .7;
    const ey = ln.y + (ay/Math.abs(ay)) * ln.len * .7;
    const g = bgCtx.createLinearGradient(ln.x,ln.y,ex,ey);
    g.addColorStop(0,  `hsla(${ln.hue},100%,60%,0)`);
    g.addColorStop(.5, `hsla(${ln.hue},100%,60%,${ln.alpha*(0.6+0.4*p)})`);
    g.addColorStop(1,  `hsla(${ln.hue},100%,60%,0)`);
    bgCtx.save(); bgCtx.strokeStyle = g; bgCtx.lineWidth = 1.5;
    bgCtx.beginPath(); bgCtx.moveTo(ln.x,ln.y); bgCtx.lineTo(ex,ey); bgCtx.stroke(); bgCtx.restore();
  }
}

/* ═══════════════════════════════════════════════════
   §8  CANVAS SETUP
═══════════════════════════════════════════════════ */
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
canvas.width = canvas.height = 660;
const TILE   = canvas.width / CFG.GRID; // ~30px

/* ═══════════════════════════════════════════════════
   §9  GAME STATE
═══════════════════════════════════════════════════ */
const STATE = { MENU:0, MODESEL:1, PLAYING:2, BOSSDEF:3, END:4 };
let gameState  = STATE.MENU;
let gameMode   = 'classic';
let paused     = false;
let ascendMode = false;

// Per-run shared
let score = 0, apples = 0, combo = 1, comboTimer = 0;
let comboMulti = 1, comboMultiEnd = 0;
let shakeAmt = 0;
let particles = [];
let runStart  = 0;
let dangerPulse = 0;
let cameraZoom = 1, targetZoom = 1;

// Infection state (bad apple)
let infected     = false;
let infectEnd    = 0;
let infectCoolEnd= 0;
let drainNext    = 0;      // timestamp for next score drain
let _glitchFrames= 0;      // frames of chromatic glitch remaining

// Classic mode
let cSnake = [], cPrev = [], cLerpT = 0;
let cLastTick = 0, cTickDue = false;
let cDir = {x:1,y:0}, cNextDir = {x:1,y:0};
let cSpeed = CFG.BASE_SPEED;

// Free Aim mode
let fHead = {x:330,y:330,angle:0}, fTrail = [], fLen = 5;
let fMouseX = 495, fMouseY = 330;

// Food
let normalFood = null, specialFood = null, miniApples = [];

// Boss (3 phases)
const boss = {
  active:false, defeated:false, phase:0,
  x:330, y:110, vx:0, vy:0,
  hp:0, maxHp:0, animT:0,
};

/* ═══════════════════════════════════════════════════
   §10  UTILITY
═══════════════════════════════════════════════════ */
const lerp  = (a,b,t) => a + (b-a)*t;
const clamp = (v,mn,mx) => Math.max(mn, Math.min(mx, v));
const dist  = (ax,ay,bx,by) => Math.hypot(ax-bx, ay-by);
const ease  = t => t < .5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2;

function rr(x,y,w,h,r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

const shakeEnabled     = () => document.getElementById('shakeToggle')?.checked !== false;
const particlesEnabled = () => document.getElementById('particleToggle')?.checked !== false;

function triggerShake(amt) {
  if (shakeEnabled()) shakeAmt = Math.max(shakeAmt, amt);
}
function gridToPx(gx,gy) { return { x:(gx+.5)*TILE, y:(gy+.5)*TILE }; }

/* ═══════════════════════════════════════════════════
   §11  PARTICLES
═══════════════════════════════════════════════════ */
function spawnParticles(px,py,color,count=12,speed=2.4) {
  if (!particlesEnabled()) return;
  for (let i=0; i<count; i++) {
    const a = (Math.PI*2*i/count) + Math.random()*.6;
    const s = speed*.6 + Math.random()*speed;
    particles.push({x:px,y:py,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,color,size:2+Math.random()*3.5});
  }
}
function tickParticles() {
  for (const p of particles) { p.x+=p.vx; p.y+=p.vy; p.vx*=.87; p.vy*=.87; p.life-=.032; }
  particles = particles.filter(p => p.life > 0);
}
function drawParticles() {
  ctx.save();
  for (const p of particles) {
    ctx.globalAlpha = p.life*p.life;
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 10;
    const s = p.size*p.life; ctx.fillRect(p.x-s/2,p.y-s/2,s,s);
  }
  ctx.restore();
}

/* ═══════════════════════════════════════════════════
   §12  SCORE POPUP + MILESTONE HINTS
═══════════════════════════════════════════════════ */
function showScorePopup(px, py, text, color='#00f0ff') {
  const el  = document.getElementById('scorePopup');
  const r   = canvas.getBoundingClientRect();
  const sx  = r.width/canvas.width, sy = r.height/canvas.height;
  el.textContent = text;
  el.style.color = color;
  el.style.textShadow = `0 0 12px ${color}`;
  el.style.left = (r.left + px*sx) + 'px';
  el.style.top  = (r.top  + py*sy - 18) + 'px';
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('pop'), 700);
}

let _lastMilestone = 0;
function checkMilestone() {
  const next = CFG.MILESTONE_NEXT.find(m => m > _lastMilestone && apples >= m);
  if (!next) return;
  _lastMilestone = next;
  const remaining = CFG.MILESTONE_NEXT.find(m => m > next);
  if (!remaining) return;
  const el = document.getElementById('milestoneHint');
  el.textContent = `🎯 ${remaining - apples} apples to next milestone`;
  el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ═══════════════════════════════════════════════════
   §13  FOOD SYSTEM
═══════════════════════════════════════════════════ */
function freeCell() {
  if (gameMode === 'classic') {
    const occ = [...cSnake, ...(normalFood?[normalFood]:[]), ...(specialFood?[specialFood]:[])];
    let p, tries = 0;
    do { p = {x:Math.floor(Math.random()*CFG.GRID),y:Math.floor(Math.random()*CFG.GRID)}; tries++; }
    while (occ.some(s=>s.x===p.x&&s.y===p.y) && tries<300);
    return p;
  } else {
    const m=50; return {x:m+Math.random()*(canvas.width-m*2),y:m+Math.random()*(canvas.height-m*2)};
  }
}

function spawnNormal() { normalFood = freeCell(); }

function trySpawnSpecial() {
  if (specialFood) return;
  const now = Date.now();
  if (now < infectCoolEnd) return;
  if (Math.random() > CFG.SPECIAL_CHANCE) return;
  const r = Math.random();
  let type;
  if      (r < CFG.W_GOLDEN)                          type = 'golden';
  else if (r < CFG.W_GOLDEN + CFG.W_BAD)              type = 'bad';
  else if (r < CFG.W_GOLDEN + CFG.W_BAD + CFG.W_COMBO)type = 'combo';
  else                                                  type = 'volatile';
  specialFood = {type, ...freeCell(), spawnTime:now};
}

const FOOD_COLORS = {normal:'#ff00ff',golden:'#ffd700',bad:'#ff1744',combo:'#00ff88',volatile:'#ff6d00',mini:'#ff88ff'};

function spawnVolatileMinis(px,py) {
  for (let i=0; i<3; i++) {
    if (gameMode==='classic') {
      miniApples.push({
        x:(Math.floor(px/TILE)+Math.round((Math.random()-.5)*4)+CFG.GRID)%CFG.GRID,
        y:(Math.floor(py/TILE)+Math.round((Math.random()-.5)*4)+CFG.GRID)%CFG.GRID,
        spawnTime:Date.now(), isGrid:true
      });
    } else {
      const a=Math.random()*Math.PI*2, r=28+Math.random()*44;
      miniApples.push({
        x:clamp(px+Math.cos(a)*r,15,canvas.width-15),
        y:clamp(py+Math.sin(a)*r,15,canvas.height-15),
        spawnTime:Date.now(), isGrid:false
      });
    }
  }
}

/* ═══════════════════════════════════════════════════
   §14  BOSS  (3 phases)
═══════════════════════════════════════════════════ */
function bossPhaseFor(hp) {
  const pct = hp / boss.maxHp;
  if (pct > 0.66) return 1;
  if (pct > 0.33) return 2;
  return 3;
}

function spawnBoss() {
  boss.active   = true;
  boss.defeated = false;
  boss.hp       = CFG.BOSS_HP;
  boss.maxHp    = CFG.BOSS_HP;
  boss.phase    = 1;
  boss.animT    = 0;
  boss.x        = canvas.width / 2;
  boss.y        = 80;
  const spd     = ascendMode ? CFG.BOSS_SPEED * 1.7 : (CFG.BOSS_SPEED || 2.0);
  boss.vx       = spd;
  boss.vy       = spd * 1.18;
  SFX.bossIn();
  triggerShake(16);
  const el = document.getElementById('bossAlert');
  el.querySelector('#bossAlertTxt').textContent = '⚡ BOSS INCOMING ⚡';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
  document.getElementById('bossHPWrap').style.display = 'flex';
  updateBossHP();
  document.getElementById('vignette').className = 'vig-boss1';
}

function updateBossHP() {
  const pct = (boss.hp / boss.maxHp) * 100;
  document.getElementById('bossHPFill').style.width = pct + '%';
  document.getElementById('bossHPNum').textContent  = boss.hp;
  // Phase color change
  const fill = document.getElementById('bossHPFill');
  const newPhase = bossPhaseFor(boss.hp);
  if (newPhase === 2) fill.style.background = 'linear-gradient(90deg,#ff6d00,#ffcc00)';
  if (newPhase === 3) fill.style.background = 'linear-gradient(90deg,#0044ff,#00ccff)';
}

function tickBoss() {
  if (!boss.active || boss.defeated) return;
  boss.animT += 0.06;

  const newPhase = bossPhaseFor(boss.hp);
  if (newPhase !== boss.phase) {
    boss.phase = newPhase;
    if (newPhase === 2) {
      boss.vx *= 1.35; boss.vy *= 1.35;
      document.getElementById('vignette').className = 'vig-boss2';
      triggerShake(8);
    }
    if (newPhase === 3) {
      boss.vx *= 1.5; boss.vy *= 1.5;
      document.getElementById('vignette').className = 'vig-boss3';
      triggerShake(12);
      checkUnlock('boss_p3');
    }
  }

  // Bounce
  const r = CFG.BOSS_R;
  if (boss.x - r < 0 || boss.x + r > canvas.width)  boss.vx *= -1;
  if (boss.y - r < 0 || boss.y + r > canvas.height) boss.vy *= -1;
  boss.x += boss.vx; boss.y += boss.vy;

  // Speed cap
  const spd = Math.hypot(boss.vx, boss.vy);
  const cap = ascendMode ? 7 : (boss.phase === 3 ? 5.5 : boss.phase === 2 ? 4.2 : 3.2);
  if (spd < cap) { boss.vx *= 1.0008; boss.vy *= 1.0008; }

  // Collision
  const hx = gameMode==='classic' ? (cSnake[0]?.x+.5)*TILE : fHead.x;
  const hy = gameMode==='classic' ? (cSnake[0]?.y+.5)*TILE : fHead.y;
  if (dist(hx,hy,boss.x,boss.y) < r+9) endGame();
}

function damageBoss() {
  if (!boss.active || boss.defeated) return;
  boss.hp--;
  updateBossHP();
  triggerShake(5);
  spawnParticles(boss.x, boss.y, '#ff1744', 18, 3.2);
  SFX.bossHit(boss.hp);
  if (boss.hp <= 0) defeatBoss();
}

function defeatBoss() {
  boss.defeated = true; boss.active = false;
  triggerShake(22);
  spawnParticles(boss.x,boss.y,'#ff1744',40,5);
  spawnParticles(boss.x,boss.y,'#ffd700',32,4.2);
  SFX.bossDef();
  document.getElementById('bossHPWrap').style.display = 'none';
  document.getElementById('vignette').className = '';
  ls.bosses++;
  score += 15; xp += 250;
  checkUnlock(gameMode==='classic' ? 'boss_classic' : 'boss_free');
  if (ls.bosses >= 3) checkUnlock('boss_3');
  gameState = STATE.BOSSDEF;
  hidePanels();
  const newUnlocks = [];
  if (!unlockedSkins.includes('void') && gameMode==='classic') newUnlocks.push('🌌 Void Skin');
  if (!unlockedThemes.includes('cybergrid') && gameMode==='classic') newUnlocks.push('⚡ Cyber Grid Theme');
  document.getElementById('bossReward').innerHTML = `+250 XP &nbsp;·&nbsp; +15 Score<br>${newUnlocks.join('<br>')||'Rewards added!'}`;
  document.getElementById('bossPanel').classList.remove('hidden');
}

/* ═══════════════════════════════════════════════════
   §15  INPUT
═══════════════════════════════════════════════════ */
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiIdx = 0, menuTyped = '';

document.addEventListener('keydown', e => {
  // Konami
  if (e.key === KONAMI[konamiIdx]) { konamiIdx++; if (konamiIdx===KONAMI.length){konamiIdx=0;activateRainbow();} }
  else { konamiIdx=0; if(e.key===KONAMI[0]) konamiIdx=1; }
  if (gameState===STATE.MENU) { menuTyped=(menuTyped+e.key.toLowerCase()).slice(-4); if(menuTyped==='neon') showNeonSecret(); }

  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  if (e.key===' '||e.key==='Escape') { togglePause(); return; }
  if (gameState!==STATE.PLAYING||paused) return;
  if (gameMode==='classic') processClassicKey(e.key);
});

function processClassicKey(key) {
  const mode = document.getElementById('controlSelect')?.value||'both';
  const ar = mode==='both'||mode==='arrows', w = mode==='both'||mode==='wasd';
  if (ar) {
    if (key==='ArrowUp'    && cDir.y===0) cNextDir={x:0,y:-1};
    if (key==='ArrowDown'  && cDir.y===0) cNextDir={x:0,y:1};
    if (key==='ArrowLeft'  && cDir.x===0) cNextDir={x:-1,y:0};
    if (key==='ArrowRight' && cDir.x===0) cNextDir={x:1,y:0};
  }
  if (w) {
    if (key==='w' && cDir.y===0) cNextDir={x:0,y:-1};
    if (key==='s' && cDir.y===0) cNextDir={x:0,y:1};
    if (key==='a' && cDir.x===0) cNextDir={x:-1,y:0};
    if (key==='d' && cDir.x===0) cNextDir={x:1,y:0};
  }
}

function bindDPad() {
  const map = {dUp:{x:0,y:-1},dDown:{x:0,y:1},dLeft:{x:-1,y:0},dRight:{x:1,y:0}};
  Object.entries(map).forEach(([id,dir]) => {
    const btn = document.getElementById(id); if (!btn) return;
    const press = () => {
      if (gameState!==STATE.PLAYING||paused||gameMode!=='classic') return;
      if (dir.x!==0 && cDir.x===0) cNextDir=dir;
      if (dir.y!==0 && cDir.y===0) cNextDir=dir;
    };
    btn.addEventListener('touchstart', e=>{press();e.preventDefault();},{passive:false});
    btn.addEventListener('mousedown', press);
  });
}

canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  fMouseX = (e.clientX-r.left)*(canvas.width/r.width);
  fMouseY = (e.clientY-r.top)*(canvas.height/r.height);
});

let _swipe = null;
canvas.addEventListener('touchstart', e=>{
  const r=canvas.getBoundingClientRect(),sx=canvas.width/r.width,sy=canvas.height/r.height;
  if (gameMode==='freeaim') { fMouseX=(e.touches[0].clientX-r.left)*sx; fMouseY=(e.touches[0].clientY-r.top)*sy; }
  else _swipe={x:e.touches[0].clientX,y:e.touches[0].clientY};
  e.preventDefault();
},{passive:false});
canvas.addEventListener('touchmove', e=>{
  const r=canvas.getBoundingClientRect();
  if (gameMode==='freeaim') { fMouseX=(e.touches[0].clientX-r.left)*(canvas.width/r.width); fMouseY=(e.touches[0].clientY-r.top)*(canvas.height/r.height); }
  e.preventDefault();
},{passive:false});
canvas.addEventListener('touchend', e=>{
  if (!_swipe||gameMode!=='classic'||gameState!==STATE.PLAYING||paused){_swipe=null;return;}
  const dx=e.changedTouches[0].clientX-_swipe.x, dy=e.changedTouches[0].clientY-_swipe.y;
  if (Math.abs(dx)>Math.abs(dy)) {
    if (dx> 22&&cDir.x===0) cNextDir={x:1,y:0};
    if (dx<-22&&cDir.x===0) cNextDir={x:-1,y:0};
  } else {
    if (dy> 22&&cDir.y===0) cNextDir={x:0,y:1};
    if (dy<-22&&cDir.y===0) cNextDir={x:0,y:-1};
  }
  _swipe=null; e.preventDefault();
},{passive:false});

/* ═══════════════════════════════════════════════════
   §16  PAUSE
═══════════════════════════════════════════════════ */
function togglePause() {
  if (gameState!==STATE.PLAYING) return;
  paused = !paused;
  document.getElementById('pauseBtn').textContent = paused?'▶':'⏸';
  if (paused) drawPause();
}
function drawPause() {
  ctx.save();
  ctx.fillStyle = 'rgba(2,2,12,.84)'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font = "bold 2.2rem 'Orbitron',monospace";
  ctx.fillStyle='#fff'; ctx.shadowColor='#00f0ff'; ctx.shadowBlur=26;
  ctx.fillText('PAUSED', canvas.width/2, canvas.height/2-16);
  ctx.font = ".68rem 'Rajdhani',sans-serif"; ctx.fillStyle='rgba(255,255,255,.36)'; ctx.shadowBlur=0;
  ctx.fillText('SPACE or ESC to resume', canvas.width/2, canvas.height/2+22);
  ctx.restore();
}

/* ═══════════════════════════════════════════════════
   §17  START GAME / ASCEND
═══════════════════════════════════════════════════ */
function startGame(mode) {
  gameMode = mode; ascendMode = false;
  score=0; apples=0; combo=1; comboTimer=0; comboMulti=1; comboMultiEnd=0;
  shakeAmt=0; particles=[]; paused=false; dangerPulse=0; cameraZoom=1; targetZoom=1;
  infected=false; infectEnd=0; infectCoolEnd=0; drainNext=0; _glitchFrames=0;
  boss.active=false; boss.defeated=false;
  normalFood=null; specialFood=null; miniApples=[];
  rainbowMode=false; rainbowEnd=0;
  _sessAchieves=[]; _lastMilestone=0;
  runStart = Date.now();

  if (mode==='classic') {
    const mx=Math.floor(CFG.GRID/2);
    cSnake=[{x:mx,y:mx}]; cPrev=[{x:mx,y:mx}];
    cDir={x:1,y:0}; cNextDir={x:1,y:0};
    cLerpT=0; cSpeed=CFG.BASE_SPEED;
    cLastTick=performance.now(); cTickDue=false;
  } else {
    fHead={x:canvas.width/2,y:canvas.height/2,angle:0};
    fTrail=[]; fLen=5;
    fMouseX=canvas.width*.75; fMouseY=canvas.height/2;
  }

  ls.games++;
  spawnNormal();
  gameState = STATE.PLAYING;
  hidePanels();

  document.getElementById('topBar').style.display='flex';
  document.getElementById('pauseBtn').textContent='⏸';
  document.getElementById('bossHPWrap').style.display='none';
  document.getElementById('wrapCombo').style.display='none';
  document.getElementById('wrapMulti').style.display='none';
  document.getElementById('vignette').className='';
  document.getElementById('infectionBar').classList.remove('active');
  document.getElementById('glitchLayer').classList.remove('active');
  updateHUD();
}

function startAscend() {
  ascendMode = true; gameState = STATE.PLAYING;
  boss.active=false; boss.defeated=true;
  document.getElementById('vignette').className='vig-ascend';
  hidePanels();
  if (gameMode==='classic') cSpeed = Math.max(CFG.MIN_SPEED, cSpeed - 18);
  checkUnlock('boss_ascend');
}

/* ═══════════════════════════════════════════════════
   §18  INFECTION SYSTEM (bad apple rework)
═══════════════════════════════════════════════════ */
function startInfection() {
  infected  = true;
  infectEnd = Date.now() + CFG.INFECTION_DUR;
  infectCoolEnd = Date.now() + CFG.BAD_COOLDOWN;
  drainNext = Date.now() + CFG.DRAIN_INTERVAL;
  document.getElementById('vignette').className = 'vig-bad';
  document.getElementById('infectionBar').classList.add('active');
  document.getElementById('glitchLayer').classList.add('active');
  _glitchFrames = 20;
  SFX.infect();
  triggerShake(10);
}

function tickInfection() {
  if (!infected) return;
  const now = Date.now();
  if (now >= infectEnd) {
    endInfection(); return;
  }
  // Update infection timer bar
  const left = (infectEnd - now) / CFG.INFECTION_DUR;
  document.getElementById('infectionFill').style.width = (left*100)+'%';
  // Score drain
  if (now >= drainNext) {
    drainNext = now + CFG.DRAIN_INTERVAL;
    if (score > 0) {
      score = Math.max(0, score - 1);
      showScorePopup(
        gameMode==='classic' ? (cSnake[0]?.x+.5)*TILE : fHead.x,
        gameMode==='classic' ? (cSnake[0]?.y+.5)*TILE : fHead.y,
        '-1', '#ff1744'
      );
    }
  }
  // Glitch frames
  if (_glitchFrames > 0) _glitchFrames--;
  else if (Math.random() < .04) _glitchFrames = 4; // random glitch
}

function endInfection() {
  infected = false;
  document.getElementById('vignette').className = '';
  document.getElementById('infectionBar').classList.remove('active');
  document.getElementById('glitchLayer').classList.remove('active');
  ls.badSurvived++;
  checkUnlock('c_bad');
  if (ls.badSurvived >= 3) checkUnlock('c_bad3');
  if (ls.badSurvived >= 5) checkUnlock('m_bad5');
  SFX.recover();
  triggerShake(3);
}

/* ═══════════════════════════════════════════════════
   §19  EAT LOGIC
═══════════════════════════════════════════════════ */
function processEat(type, px, py) {
  const now = Date.now();

  // ── BAD APPLE ──
  if (type==='bad') {
    if (!infected) startInfection();
    // While infected, eating another bad apple restarts infection
    else { infectEnd = now + CFG.INFECTION_DUR; }
    // When infected, good apples drain instead — handled in processEat for normal below
    return false; // no grow
  }

  apples++; ls.apples++;

  // Combo chain
  if (comboTimer > 0 && now - comboTimer < CFG.COMBO_WINDOW) {
    combo++;
    SFX.comboUp(combo);
    if (combo >= 5)  checkUnlock('c_combo5');
    if (combo >= 10) checkUnlock('c_combo10');
    targetZoom = 1 + Math.min((Math.max(0,combo-4)) * .015, .08);
  } else {
    combo = 1;
  }
  comboTimer = now;

  if (type==='combo') {
    comboMulti=2; comboMultiEnd=now+CFG.COMBO_DUR;
    document.getElementById('wrapMulti').style.display='flex';
    SFX.eatCombo();
  }
  if (type==='volatile') { SFX.eatVol(); triggerShake(6); spawnVolatileMinis(px,py); }

  // While infected — normal apples DRAIN instead of giving
  if (infected && type==='normal') {
    score = Math.max(0, score - 1);
    showScorePopup(px, py, '-1 ☠', '#ff1744');
    SFX.eatBad();
    triggerShake(3);
    spawnParticles(px, py, '#ff1744', 8);
    return true; // still grow
  }

  if (type==='golden') SFX.eatGold(); else SFX.eat();

  const pts  = (type==='golden' ? 3 : 1) * combo * comboMulti;
  score += pts;
  ls.totalScore = (ls.totalScore||0) + pts;

  const col = FOOD_COLORS[type] || FOOD_COLORS.normal;
  spawnParticles(px, py, col, type==='golden'?22:12);
  triggerShake(type==='golden' ? 5 : 2);
  showScorePopup(px, py, `+${pts}`, col);

  if (combo > 1) {
    document.getElementById('wrapCombo').style.display='flex';
    document.getElementById('hudCombo').textContent = '×'+combo;
  }
  const sc = document.getElementById('hudScore');
  sc.style.transform='scale(1.42)'; setTimeout(()=>sc.style.transform='',145);

  // Boss damage if active
  if (boss.active && !boss.defeated) damageBoss();

  trySpawnSpecial();
  checkMilestone();

  // Achievements
  if (apples===1) checkUnlock(gameMode==='classic'?'c_first':'f_first');
  if (apples>=10) checkUnlock(gameMode==='classic'?'c_10run':'f_10run');
  if (apples>=30) checkUnlock(gameMode==='classic'?'c_30run':'f_30run');
  if (score===42) checkUnlock('c_42');
  if (type==='golden') checkUnlock(gameMode==='classic'?'c_golden':'f_golden');
  if (type==='volatile') checkUnlock('c_volatile');

  // Boss trigger
  if (!boss.active && !boss.defeated && apples >= CFG.BOSS_TRIGGER) spawnBoss();

  return true; // grow
}

/* ═══════════════════════════════════════════════════
   §20  CLASSIC TICK  ← ANIMATION BUG FIX
═══════════════════════════════════════════════════ */
function classicTick() {
  cDir = cNextDir;

  // Save positions BEFORE moving
  cPrev = cSnake.map(s => ({...s}));

  const head = {
    x: (cSnake[0].x + cDir.x + CFG.GRID) % CFG.GRID,
    y: (cSnake[0].y + cDir.y + CFG.GRID) % CFG.GRID,
  };

  // Self collision
  if (cSnake.some(s => s.x===head.x && s.y===head.y)) { endGame(); return; }

  cSnake.unshift(head);
  ls.distance++;

  const now = Date.now();
  let grew = false;

  const hpx = (head.x+.5)*TILE, hpy = (head.y+.5)*TILE;

  // Normal food
  if (normalFood && head.x===normalFood.x && head.y===normalFood.y) {
    grew = processEat('normal', hpx, hpy);
    if (grew !== false) spawnNormal();
    else spawnNormal(); // bad apple doesn't grow but respawn food
  }
  // Special food
  if (specialFood && head.x===specialFood.x && head.y===specialFood.y) {
    const r = processEat(specialFood.type, hpx, hpy);
    if (r !== false) grew = true;
    specialFood = null;
  } else if (specialFood?.type==='golden' && now-specialFood.spawnTime>CFG.GOLDEN_TTL) {
    specialFood = null;
  }
  // Mini apples
  for (let i=miniApples.length-1; i>=0; i--) {
    const m=miniApples[i];
    if (m.isGrid && head.x===m.x && head.y===m.y) {
      if (processEat('normal',hpx,hpy)) grew=true;
      miniApples.splice(i,1);
    } else if (now-m.spawnTime>CFG.MINI_TTL) miniApples.splice(i,1);
  }

  if (!grew) cSnake.pop();

  // Combo + multi decay
  if (comboTimer>0 && now-comboTimer>CFG.COMBO_WINDOW) {
    combo=1; comboTimer=0;
    document.getElementById('wrapCombo').style.display='none'; targetZoom=1;
  }
  if (comboMulti>1 && now>comboMultiEnd) { comboMulti=1; document.getElementById('wrapMulti').style.display='none'; }

  // Infection tick
  tickInfection();

  // ── Smooth speed scaling — continuous curve, no step jumps ──
  // 150ms → 85ms floor, eases over ~70 apples, caps permanently at MIN_SPEED
  const smoothSpeed = Math.max(CFG.MIN_SPEED, Math.round(
    CFG.BASE_SPEED - (CFG.BASE_SPEED - CFG.MIN_SPEED) * (1 - Math.pow(1 - Math.min(apples, 80) / 80, 2.2))
  ));
  if (smoothSpeed < cSpeed) {
    cSpeed = smoothSpeed;
    if (cSpeed <= CFG.MIN_SPEED) checkUnlock('c_speed');
  }

  // Near-death glow
  const nx=(cSnake[0].x+cDir.x+CFG.GRID)%CFG.GRID, ny=(cSnake[0].y+cDir.y+CFG.GRID)%CFG.GRID;
  const isDanger = cSnake.slice(1).some(s=>s.x===nx&&s.y===ny) ||
    (boss.active && dist((nx+.5)*TILE,(ny+.5)*TILE,boss.x,boss.y)<CFG.BOSS_R+14);
  dangerPulse = isDanger ? Math.min(dangerPulse+.16,1) : Math.max(0,dangerPulse-.1);

  tickBoss();
  tickParticles();

  if (Date.now()-runStart>=180000) checkUnlock('c_survive3');
  updateHUD();
}

/* ═══════════════════════════════════════════════════
   §21  FREE AIM UPDATE (per frame)
═══════════════════════════════════════════════════ */
function freeAimUpdate() {
  const tx=fMouseX-fHead.x, ty=fMouseY-fHead.y;
  let da = Math.atan2(ty,tx) - fHead.angle;
  while (da> Math.PI) da-=Math.PI*2;
  while (da<-Math.PI) da+=Math.PI*2;
  fHead.angle += clamp(da, -CFG.FA_TURN, CFG.FA_TURN);

  // Smooth speed scaling: 2.6 → 4.2 px/frame cap, eases over ~60 apples
  const fAScale = 1 + Math.min(apples, 60) / 60 * 0.62;
  const spd = CFG.FA_SPEED * fAScale * (ascendMode?1.4:1);
  fHead.x += Math.cos(fHead.angle)*spd;
  fHead.y += Math.sin(fHead.angle)*spd;

  // Wrap
  if (fHead.x<0)               fHead.x+=canvas.width;
  if (fHead.x>canvas.width)    fHead.x-=canvas.width;
  if (fHead.y<0)               fHead.y+=canvas.height;
  if (fHead.y>canvas.height)   fHead.y-=canvas.height;

  fTrail.unshift({x:fHead.x,y:fHead.y});
  const maxLen = fLen*CFG.FA_SEG_DIST + CFG.FA_SEG_DIST*5;
  if (fTrail.length>maxLen) fTrail.length=maxLen;

  ls.distance += spd;

  const now = Date.now();

  // Self collision
  const skip = Math.min(30, fTrail.length);
  for (let i=skip; i<fTrail.length; i+=CFG.FA_SEG_DIST) {
    if (dist(fHead.x,fHead.y,fTrail[i].x,fTrail[i].y)<CFG.FA_HEAD_R+CFG.FA_SEG_R-2) { endGame(); return; }
  }

  // Food
  if (normalFood && dist(fHead.x,fHead.y,normalFood.x,normalFood.y)<CFG.FA_HEAD_R+CFG.FA_FOOD_R) {
    const grew=processEat('normal',fHead.x,fHead.y); if(grew)fLen++; spawnNormal();
  }
  if (specialFood) {
    if (dist(fHead.x,fHead.y,specialFood.x,specialFood.y)<CFG.FA_HEAD_R+CFG.FA_FOOD_R) {
      const grew=processEat(specialFood.type,fHead.x,fHead.y); if(grew)fLen++;
      specialFood=null;
    } else if (specialFood.type==='golden'&&now-specialFood.spawnTime>CFG.GOLDEN_TTL) specialFood=null;
  }
  for (let i=miniApples.length-1;i>=0;i--) {
    const m=miniApples[i];
    if (!m.isGrid && dist(fHead.x,fHead.y,m.x,m.y)<CFG.FA_HEAD_R+CFG.FA_FOOD_R) {
      if(processEat('normal',fHead.x,fHead.y)) fLen++; miniApples.splice(i,1);
    } else if (now-m.spawnTime>CFG.MINI_TTL) miniApples.splice(i,1);
  }

  // Decays
  if (comboTimer>0&&now-comboTimer>CFG.COMBO_WINDOW){combo=1;comboTimer=0;document.getElementById('wrapCombo').style.display='none';targetZoom=1;}
  if (comboMulti>1&&now>comboMultiEnd){comboMulti=1;document.getElementById('wrapMulti').style.display='none';}

  tickInfection();
  tickBoss();
  tickParticles();

  if (Date.now()-runStart>=180000) checkUnlock('f_survive3');
  updateHUD();
}

/* ═══════════════════════════════════════════════════
   §22  DRAW
═══════════════════════════════════════════════════ */
function drawGrid() {
  ctx.save(); ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--grid')||'rgba(255,255,255,.022)'; ctx.lineWidth=.5;
  for (let i=0;i<=CFG.GRID;i++) {
    ctx.beginPath();ctx.moveTo(i*TILE,0);ctx.lineTo(i*TILE,canvas.height);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,i*TILE);ctx.lineTo(canvas.width,i*TILE);ctx.stroke();
  }
  ctx.restore();
}

// ── TRAIL RENDERING HELPERS ──
function drawTrailEffect(x,y,i,len,t,r) {
  const trl = TRAIL_DATA[selectedTrail];
  if (!trl||!trl.render||!particlesEnabled()) return;
  const fade = 1-i/len;
  ctx.save(); ctx.globalAlpha = fade*.25;
  switch(trl.render) {
    case 'ribbon': {
      ctx.fillStyle=`hsl(${(t*.03+i*8)%360},100%,65%)`;
      ctx.shadowColor=`hsl(${(t*.03+i*8)%360},100%,65%)`; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(x,y,r*.85,0,Math.PI*2); ctx.fill(); break;
    }
    case 'pastel': {
      ctx.fillStyle=`hsl(${(t*.02+i*14)%360},70%,78%)`;
      ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); break;
    }
    case 'electric': {
      if (Math.random()<.35) {
        ctx.strokeStyle=`rgba(80,200,255,${fade*.8})`;
        ctx.lineWidth=1.5; ctx.shadowColor='#50c8ff'; ctx.shadowBlur=10;
        ctx.beginPath();
        ctx.moveTo(x+(Math.random()-.5)*8,y+(Math.random()-.5)*8);
        ctx.lineTo(x+(Math.random()-.5)*14,y+(Math.random()-.5)*14); ctx.stroke();
      } break;
    }
    case 'spark': {
      if (Math.random()<.25 && particlesEnabled()) {
        particles.push({x,y,vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3,life:.6,color:ctx.fillStyle||'#ffcc00',size:2});
      } break;
    }
    case 'particle': {
      if (Math.random()<.18 && particlesEnabled()) {
        const sk=SKIN_DATA[selectedSkin]||SKIN_DATA.default;
        particles.push({x,y,vx:(Math.random()-.5)*1.5,vy:(Math.random()-.5)*1.5,life:.8,color:sk.glow||'#00f0ff',size:1.8});
      } break;
    }
  }
  ctx.restore();
}

function drawClassicSnake(t) {
  const len = cSnake.length;
  const e   = ease(cLerpT);
  const sk  = SKIN_DATA[selectedSkin] || SKIN_DATA.default;

  for (let i=len-1; i>=0; i--) {
    const cur=cSnake[i], prv=cPrev[i]??cPrev[cPrev.length-1]??cur;
    let dx=cur.x-prv.x, dy=cur.y-prv.y;
    if (dx> CFG.GRID/2) dx-=CFG.GRID;
    if (dx<-CFG.GRID/2) dx+=CFG.GRID;
    if (dy> CFG.GRID/2) dy-=CFG.GRID;
    if (dy<-CFG.GRID/2) dy+=CFG.GRID;
    const lx=(prv.x+dx*e)*TILE, ly=(prv.y+dy*e)*TILE;

    const isHead=i===0;
    const t_=1-i/len;
    const taper = i>=len-3 ? (.68+.11*(len-1-i)) : 1;
    const sz=(TILE-3)*taper, off=(TILE-sz)/2;

    // Trail layer underneath
    if (!isHead) drawTrailEffect(lx+TILE/2,ly+TILE/2,i,len,t,sz*.5);

    ctx.save();
    ctx.globalAlpha = isHead ? 1 : lerp(.36,.92,t_);
    if (isHead && dangerPulse>.1) {
      ctx.fillStyle  = `rgb(255,${Math.round(lerp(255,0,dangerPulse))},${Math.round(lerp(255,50,dangerPulse))})`;
      ctx.shadowColor= '#ff2244'; ctx.shadowBlur=22+dangerPulse*26;
    } else {
      ctx.fillStyle  = isHead ? sk.head : getSkinColor(selectedSkin,t,i,len);
      ctx.shadowColor= getSkinGlow(selectedSkin,t,i);
      ctx.shadowBlur = isHead ? 20 : 7 + (.5+.5*Math.sin(t*.003+i*.55))*8;
    }
    if (isHead) rr(lx+1,ly+1,TILE-3,TILE-3,6);
    else rr(lx+off,ly+off,sz,sz,4);
    ctx.fill();
    ctx.restore();
    if (isHead) drawClassicEyes({x:lx,y:ly});
  }
}

function drawClassicEyes(pos) {
  const p=TILE*.27, q=TILE*.68, er=2.5;
  let e1,e2;
  if      (cDir.x===1)  {e1={x:q,y:p};e2={x:q,y:q};}
  else if (cDir.x===-1) {e1={x:p,y:p};e2={x:p,y:q};}
  else if (cDir.y===-1) {e1={x:p,y:p};e2={x:q,y:p};}
  else                   {e1={x:p,y:q};e2={x:q,y:q};}
  ctx.save(); ctx.fillStyle='#001020'; ctx.shadowBlur=0;
  ctx.beginPath();ctx.arc(pos.x+e1.x,pos.y+e1.y,er,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(pos.x+e2.x,pos.y+e2.y,er,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawFreeAimSnake(t) {
  const sk=SKIN_DATA[selectedSkin]||SKIN_DATA.default;
  const maxIdx=fTrail.length-1;
  for (let i=fLen-1; i>=0; i--) {
    const idx=clamp(i*CFG.FA_SEG_DIST,0,maxIdx);
    const p=fTrail[idx]||fHead;
    const isHead=i===0;
    const t_=1-i/fLen;
    const r=isHead?CFG.FA_HEAD_R+1:lerp(CFG.FA_SEG_R*.6,CFG.FA_SEG_R,t_);

    if (!isHead) drawTrailEffect(p.x,p.y,i,fLen,t,r);

    ctx.save();
    ctx.globalAlpha=isHead?1:lerp(.35,.9,t_);
    ctx.fillStyle=isHead?sk.head:getSkinColor(selectedSkin,t,i,fLen);
    ctx.shadowColor=getSkinGlow(selectedSkin,t,i); ctx.shadowBlur=isHead?20:8;
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
    ctx.restore();

    if (isHead) {
      const ex=Math.cos(fHead.angle),ey=Math.sin(fHead.angle);
      const px2=Math.cos(fHead.angle-Math.PI/2),py2=Math.sin(fHead.angle-Math.PI/2);
      ctx.save();ctx.fillStyle='#001020';ctx.shadowBlur=0;
      ctx.beginPath();ctx.arc(p.x+ex*5+px2*4,p.y+ey*5+py2*4,2.2,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(p.x+ex*5-px2*4,p.y+ey*5-py2*4,2.2,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
  }

  // ── Neon cursor crosshair at mouse target ──────────────────
  const cx=fMouseX, cy=fMouseY;
  const cr=8, cgap=4, carm=10;
  const cpulse=0.65+0.35*Math.sin(t*0.009);
  ctx.save();
  ctx.globalAlpha=cpulse;
  ctx.strokeStyle='rgba(0,240,255,0.9)';
  ctx.shadowColor='#00f0ff'; ctx.shadowBlur=10;
  ctx.lineWidth=1.5;
  // 4 arms with gap
  ctx.beginPath();
  ctx.moveTo(cx-(cr+cgap),cy); ctx.lineTo(cx-(cr+cgap+carm),cy); // left
  ctx.moveTo(cx+(cr+cgap),cy); ctx.lineTo(cx+(cr+cgap+carm),cy); // right
  ctx.moveTo(cx,cy-(cr+cgap)); ctx.lineTo(cx,cy-(cr+cgap+carm)); // up
  ctx.moveTo(cx,cy+(cr+cgap)); ctx.lineTo(cx,cy+(cr+cgap+carm)); // down
  ctx.stroke();
  // Centre ring
  ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2); ctx.stroke();
  // Centre dot
  ctx.shadowBlur=6;
  ctx.fillStyle='rgba(0,240,255,0.8)';
  ctx.beginPath(); ctx.arc(cx,cy,1.8,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawFood(food, type, t) {
  if (!food) return;
  const now=Date.now();
  if (type==='golden'&&specialFood&&(CFG.GOLDEN_TTL-(now-specialFood.spawnTime))<2800&&Math.floor(t/215)%2===0) return;
  const col=(FOOD_COLORS[type]||FOOD_COLORS.normal);
  const pulse=Math.sin(t*.0048)*(type==='mini'?.7:2.1);

  if (gameMode==='classic') {
    const px=food.x*TILE-pulse/2+1.5, py=food.y*TILE-pulse/2+1.5, sz=TILE-4+pulse;
    ctx.save(); ctx.fillStyle=col; ctx.shadowColor=col; ctx.shadowBlur=16+Math.sin(t*.004)*8;
    rr(px,py,sz,sz,5); ctx.fill();
    if (type==='golden'&&specialFood) {
      const left=CFG.GOLDEN_TTL-(now-specialFood.spawnTime),pct=left/CFG.GOLDEN_TTL;
      ctx.strokeStyle='rgba(255,215,0,.5)';ctx.lineWidth=2;ctx.shadowBlur=8;
      ctx.beginPath();ctx.arc(food.x*TILE+TILE/2,food.y*TILE+TILE/2,TILE*.76,-Math.PI/2,-Math.PI/2+Math.PI*2*pct);ctx.stroke();
    }
    if (type==='bad') {
      ctx.strokeStyle='rgba(255,60,60,.9)';ctx.lineWidth=2.5;ctx.lineCap='round';
      const m=TILE/2,r2=TILE*.22;
      ctx.beginPath();ctx.moveTo(food.x*TILE+m-r2,food.y*TILE+m-r2);ctx.lineTo(food.x*TILE+m+r2,food.y*TILE+m+r2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(food.x*TILE+m+r2,food.y*TILE+m-r2);ctx.lineTo(food.x*TILE+m-r2,food.y*TILE+m+r2);ctx.stroke();
    }
    ctx.fillStyle='rgba(255,255,255,.4)';ctx.shadowBlur=0;ctx.globalAlpha=.6;
    rr(px+3,py+3,sz*.36,sz*.27,2);ctx.fill();
    ctx.restore();
  } else {
    const r=type==='mini'?6:CFG.FA_FOOD_R+pulse/2;
    ctx.save(); ctx.fillStyle=col; ctx.shadowColor=col; ctx.shadowBlur=18;
    ctx.beginPath();ctx.arc(food.x,food.y,r,0,Math.PI*2);ctx.fill();
    if (type==='golden'&&specialFood){
      const left=CFG.GOLDEN_TTL-(now-specialFood.spawnTime),pct=left/CFG.GOLDEN_TTL;
      ctx.strokeStyle='rgba(255,215,0,.5)';ctx.lineWidth=2;ctx.shadowBlur=8;
      ctx.beginPath();ctx.arc(food.x,food.y,r+7,-Math.PI/2,-Math.PI/2+Math.PI*2*pct);ctx.stroke();
    }
    if (type==='bad') {
      ctx.strokeStyle='rgba(255,60,60,.9)';ctx.lineWidth=2;ctx.lineCap='round';
      const cr=r*.65;
      ctx.beginPath();ctx.moveTo(food.x-cr,food.y-cr);ctx.lineTo(food.x+cr,food.y+cr);ctx.stroke();
      ctx.beginPath();ctx.moveTo(food.x+cr,food.y-cr);ctx.lineTo(food.x-cr,food.y+cr);ctx.stroke();
    }
    ctx.fillStyle='rgba(255,255,255,.42)';ctx.shadowBlur=0;ctx.globalAlpha=.58;
    ctx.beginPath();ctx.arc(food.x-r*.25,food.y-r*.3,r*.35,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
}

function drawBoss(t) {
  if (!boss.active||boss.defeated) return;
  const pulse=Math.sin(boss.animT)*.35+1;
  const phase=boss.phase;

  const bodyColor=phase===3?'#0066ff':phase===2?'#ff6d00':'#ff1744';
  const rimColor =phase===3?'rgba(0,120,255,.5)':phase===2?'rgba(255,110,0,.5)':'rgba(255,23,68,.5)';

  ctx.save();
  // Outer glow ring
  ctx.strokeStyle=rimColor; ctx.lineWidth=3; ctx.shadowColor=bodyColor; ctx.shadowBlur=24;
  ctx.beginPath();ctx.arc(boss.x,boss.y,CFG.BOSS_R+9+Math.sin(boss.animT*2)*5,0,Math.PI*2);ctx.stroke();
  // Phase 3: second ring
  if (phase===3) {
    ctx.strokeStyle='rgba(100,200,255,.35)';ctx.lineWidth=2;ctx.shadowBlur=14;
    ctx.beginPath();ctx.arc(boss.x,boss.y,CFG.BOSS_R+20+Math.sin(boss.animT*3)*6,0,Math.PI*2);ctx.stroke();
  }
  // Body
  const grd=ctx.createRadialGradient(boss.x,boss.y,0,boss.x,boss.y,CFG.BOSS_R*pulse);
  grd.addColorStop(0,phase===3?'#88aaff':phase===2?'#ff9900':'#ff6d00');
  grd.addColorStop(.5,bodyColor);
  grd.addColorStop(1,'rgba(0,0,0,.1)');
  ctx.fillStyle=grd; ctx.shadowBlur=30;
  ctx.beginPath();ctx.arc(boss.x,boss.y,CFG.BOSS_R*pulse,0,Math.PI*2);ctx.fill();
  // Eyes
  ctx.fillStyle='rgba(255,255,255,.88)';ctx.shadowBlur=0;
  ctx.beginPath();ctx.arc(boss.x-8,boss.y-5,5,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(boss.x+8,boss.y-5,5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=phase===3?'#002288':'#1a0000';
  ctx.beginPath();ctx.arc(boss.x-8,boss.y-5,3,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(boss.x+8,boss.y-5,3,0,Math.PI*2);ctx.fill();
  // HP label
  ctx.font="bold .5rem 'Orbitron',monospace"; ctx.fillStyle='rgba(255,220,220,.9)';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(boss.hp+'HP', boss.x, boss.y+15);
  ctx.restore();
}

function drawGlitchOverlay(t) {
  if (!infected||_glitchFrames<=0) return;
  // Chromatic aberration strips
  ctx.save(); ctx.globalAlpha=.08;
  ctx.fillStyle='rgba(255,0,0,1)';   ctx.fillRect(Math.random()*8-4,0,canvas.width,canvas.height);
  ctx.fillStyle='rgba(0,255,255,1)'; ctx.fillRect(Math.random()*8-4,0,canvas.width,canvas.height);
  ctx.restore();
  // Random horizontal glitch bar
  if (Math.random()<.5) {
    const y=Math.random()*canvas.height, h=2+Math.random()*6;
    ctx.save(); ctx.globalAlpha=.12; ctx.fillStyle='rgba(255,50,50,1)';
    ctx.fillRect(0,y,canvas.width,h); ctx.restore();
  }
}

function drawAscendOverlay(t) {
  if (!ascendMode) return;
  ctx.save(); ctx.globalAlpha=.05+.02*Math.sin(t*.002);
  ctx.fillStyle='#00ff88'; ctx.globalCompositeOperation='screen';
  ctx.fillRect(0,0,canvas.width,canvas.height); ctx.restore();
}

function renderFrame(t) {
  cameraZoom = lerp(cameraZoom, targetZoom, .08);
  ctx.save();
  const cx=canvas.width/2, cy=canvas.height/2;
  ctx.translate(cx,cy); ctx.scale(cameraZoom,cameraZoom); ctx.translate(-cx,-cy);

  if (shakeAmt>.2) {
    ctx.translate((Math.random()-.5)*shakeAmt,(Math.random()-.5)*shakeAmt);
    shakeAmt=Math.max(0,shakeAmt*.74);
  } else shakeAmt=0;

  ctx.clearRect(-80,-80,canvas.width+160,canvas.height+160);
  drawGrid();
  drawParticles();
  drawFood(normalFood,'normal',t);
  drawFood(specialFood,specialFood?.type,t);
  miniApples.forEach(m=>drawFood(m,'mini',t));
  if (gameMode==='classic') drawClassicSnake(t);
  else drawFreeAimSnake(t);
  drawBoss(t);
  drawGlitchOverlay(t);
  drawAscendOverlay(t);
  ctx.restore();
}

/* ═══════════════════════════════════════════════════
   §23  MENU IDLE ANIMATION
═══════════════════════════════════════════════════ */
let idleSnake = null;
function initIdleSnake() {
  const segs=[];
  for (let i=0; i<8; i++) segs.push({x:canvas.width/2-i*14,y:canvas.height/2});
  idleSnake={segs,angle:0,vx:1.2,vy:.6,t:0};
}

function drawIdleSnake(t) {
  if (gameState!==STATE.MENU||!idleSnake) return;
  const s=idleSnake;
  s.t=t;
  // Bounce head
  s.segs[0].x+=s.vx; s.segs[0].y+=s.vy;
  if (s.segs[0].x<40||s.segs[0].x>canvas.width-40)  s.vx*=-1;
  if (s.segs[0].y<40||s.segs[0].y>canvas.height-40) s.vy*=-1;
  // Trail follow
  for (let i=1;i<s.segs.length;i++) {
    const prev=s.segs[i-1],cur=s.segs[i];
    const dx=prev.x-cur.x,dy=prev.y-cur.y;
    const d=Math.hypot(dx,dy);
    if (d>14) { cur.x+=dx/d*2.5; cur.y+=dy/d*2.5; }
  }
  ctx.save();
  ctx.globalAlpha=.18;
  for (let i=s.segs.length-1;i>=0;i--) {
    const seg=s.segs[i], r=i===0?10:7;
    const h=((t*.1)+i*28)%360;
    ctx.fillStyle=`hsl(${h},100%,62%)`; ctx.shadowColor=`hsl(${h},100%,62%)`; ctx.shadowBlur=12;
    ctx.beginPath();ctx.arc(seg.x,seg.y,r*(1-i*.06),0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

/* ═══════════════════════════════════════════════════
   §24  MAIN LOOP  (FIXED classic timing)
═══════════════════════════════════════════════════ */
function loop(t) {
  requestAnimationFrame(loop);

  drawBG(t);

  if (rainbowMode && Date.now() > rainbowEnd) rainbowMode=false;

  if (gameState===STATE.MENU) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawGrid();
    drawIdleSnake(t);
    return;
  }

  if (gameState!==STATE.PLAYING||paused) return;

  if (gameMode==='classic') {
    // ── FIXED ANIMATION TIMING ──
    // Use += cSpeed to prevent drift accumulation
    if (t - cLastTick >= cSpeed) {
      cLastTick += cSpeed;
      // Prevent spiral: if we fall far behind, skip ahead
      if (t - cLastTick >= cSpeed) cLastTick = t;
      cLerpT = 0;
      classicTick();
    }
    // Lerp AFTER tick so t=0 immediately after tick fires
    cLerpT = Math.min((t - cLastTick) / cSpeed, 1);
  } else {
    freeAimUpdate();
  }

  renderFrame(t);
}
requestAnimationFrame(loop);

/* ═══════════════════════════════════════════════════
   §25  END GAME
═══════════════════════════════════════════════════ */
function endGame() {
  if (gameState===STATE.END) return;
  gameState = STATE.END;
  triggerShake(20); SFX.die();
  const px=gameMode==='classic'?(cSnake[0]?.x+.5)*TILE:fHead.x;
  const py=gameMode==='classic'?(cSnake[0]?.y+.5)*TILE:fHead.y;
  spawnParticles(px,py,'#ff1744',38,4.5);
  document.getElementById('topBar').style.display='none';
  document.getElementById('bossHPWrap').style.display='none';
  document.getElementById('infectionBar').classList.remove('active');
  document.getElementById('glitchLayer').classList.remove('active');
  document.getElementById('vignette').className='';

  // XP calc
  const xpGained = apples*10 + (combo>5?(combo-5)*15:0) + (boss.defeated?250:0) + (ascendMode?100:0);
  xp += xpGained;
  let leveled=false, unlockText='';
  while (xp >= xpToNext()) {
    xp -= xpToNext(); level++; leveled=true;
    const sk=SKIN_LIST.find(s=>s.unlockLevel===level&&!s.achieveReq);
    if (sk) { unlockText=`🎉 ${sk.name} Skin unlocked!`; grantSkin(sk.id); }
  }
  if (leveled) setTimeout(SFX.levelUp, 380);
  if (level>=3)  checkUnlock('m_level3');
  if (level>=6)  checkUnlock('m_level6');
  if (level>=10) checkUnlock('m_level10');

  const hs=gameMode==='classic'?highScoreC:highScoreF;
  const isNewHS=score>hs;
  if (isNewHS) { if(gameMode==='classic')highScoreC=score;else highScoreF=score; checkUnlock('m_hs'); }

  if (ls.games>=10) checkUnlock('m_games10');
  if (ls.games>=50) checkUnlock('m_games50');
  if (ls.apples>=100) checkUnlock('m_apples');
  if (ls.distance>=5000) checkUnlock('m_dist');
  if (ls.distance>=15000) checkUnlock('m_dist2');
  if (SKIN_LIST.filter(s=>skinAvail(s)).length>=3) checkUnlock('m_skins3');

  let rIdx=0;
  for (let i=CFG.RANKS.length-1;i>=0;i--) { if(score>=CFG.RANKS[i].min){rIdx=i;break;} }
  const rank=CFG.RANKS[rIdx];

  saveAll();

  // ── HUB INTEGRATION ──
  try {
    const _hubXP = Math.floor(score * 2.5 + apples * 4 + (boss.defeated ? 200 : 0) + (ascendMode ? 100 : 0));
    const _hubShards = Math.floor(apples * 3);
    hubReportSession('snake', { score, apples, combo, shards: _hubShards, hubXP: _hubXP });
  } catch(_e) {}
  // ────────────────────

  const secs=Math.floor((Date.now()-runStart)/1000);
  const mm=String(Math.floor(secs/60)).padStart(2,'0'), ss=String(secs%60).padStart(2,'0');

  document.getElementById('endTitle').textContent=isNewHS?'★ BEST RUN ★':'RUN COMPLETE';
  const rb=document.getElementById('rankBadge');
  rb.textContent=rank.name; rb.className='rank-badge '+rank.cls;

  document.getElementById('endStats').innerHTML=`
    ${isNewHS?'<span class="crown-line">👑 NEW HIGH SCORE!</span>':''}
    Score <b>${score}</b> &nbsp;·&nbsp; Apples <b>${apples}</b><br>
    Best Combo <b>×${combo}</b> &nbsp;·&nbsp; Time <b>${mm}:${ss}</b><br>
    <small style="opacity:.5;font-size:.82rem">+${xpGained} XP &nbsp;·&nbsp; ${gameMode==='classic'?'CLASSIC':'FREE AIM'}${ascendMode?' ⚡ASCENDED':''}</small>
  `;
  document.getElementById('unlockStats').textContent=unlockText;
  const newA=_sessAchieves.filter((id,i,a)=>a.indexOf(id)===i);
  document.getElementById('endAchieves').textContent=newA.length
    ? `🏅 ${newA.map(id=>ADEFS.find(a=>a.id===id)?.name||id).join(', ')}` : '';

  document.getElementById('endPanel').classList.remove('hidden');
  setTimeout(()=>{
    const pct=clamp((xp/xpToNext())*100,0,100);
    document.getElementById('xpBarFill').style.width=pct+'%';
    document.getElementById('xpLabel').textContent=`XP ${xp} / ${xpToNext()} — LEVEL ${level}`;
    // "Almost there" milestone on end screen
    const nextSkin=SKIN_LIST.find(s=>!skinAvail(s)&&s.unlockLevel&&s.unlockLevel>level);
    if (nextSkin) document.getElementById('xpMilestone').textContent=`🎯 ${nextSkin.name} unlocks at Level ${nextSkin.unlockLevel}`;
  },300);
}

/* ═══════════════════════════════════════════════════
   §26  HUD
═══════════════════════════════════════════════════ */
function updateHUD() {
  document.getElementById('hudScore').textContent=score;
  document.getElementById('hudLevel').textContent=level;
  document.getElementById('hudBest').textContent=gameMode==='classic'?highScoreC:highScoreF;
}

/* ═══════════════════════════════════════════════════
   §27  EASTER EGGS
═══════════════════════════════════════════════════ */
function activateRainbow(){
  rainbowMode=true; rainbowEnd=Date.now()+15000;
  checkUnlock('m_neon'); SFX.rainbow();
}
function showNeonSecret(){
  const el=document.getElementById('achieveToast');
  el.innerHTML='🌐 <b>DEV MODE</b><br><small>Konami → rainbow in-game.</small>';
  el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),4000);
}

/* ═══════════════════════════════════════════════════
   §28  UI BUILDERS
═══════════════════════════════════════════════════ */
function hidePanels() { document.querySelectorAll('.panel').forEach(p=>p.classList.add('hidden')); }

function backToMenu() {
  gameState=STATE.MENU; paused=false;
  hidePanels();
  document.getElementById('topBar').style.display='none';
  document.getElementById('bossHPWrap').style.display='none';
  document.getElementById('infectionBar').classList.remove('active');
  document.getElementById('glitchLayer').classList.remove('active');
  document.getElementById('vignette').className='';
  document.getElementById('mainMenu').classList.remove('hidden');
  refreshMenuUI();
  initIdleSnake();
}

function refreshMenuUI() {
  document.getElementById('menuHS').textContent    = Math.max(highScoreC,highScoreF) ? `BEST: ${Math.max(highScoreC,highScoreF)}` : '';
  document.getElementById('menuStreak').textContent= streak>1 ? `🔥 ${streak}-DAY STREAK` : '';
}

function buildSkins() {
  const c=document.getElementById('custSkins'); c.innerHTML='';
  SKIN_LIST.forEach(s=>{
    const avail=skinAvail(s);
    const sk=SKIN_DATA[s.id]||SKIN_DATA.default;
    const div=document.createElement('div');
    div.className='skin-item'+(selectedSkin===s.id?' active':'')+(avail?'':' locked');
    let badge=avail ? (selectedSkin===s.id?'✓ ON':s.achieveReq?'Achieved':'Lv.'+s.unlockLevel)
                    : (s.achieveReq ? '🔒 Achievement' : `🔒 Lv.${s.unlockLevel}`);
    const isAnim=!!(sk.bodyFn||sk.glowFn);
    div.innerHTML=`
      <div style="display:flex;align-items:center;gap:8px">
        <div class="skin-swatch" style="background:${sk.body};box-shadow:0 0 8px ${sk.glow}"></div>
        <span>${s.name}${isAnim?'<span class="anim-tag">✦</span>':''}</span>
      </div>
      <span class="skin-badge">${badge}</span>`;
    if (avail) div.onclick=()=>{ selectedSkin=s.id; saveAll(); buildSkins(); };
    c.appendChild(div);
  });
}

function buildTrails() {
  const c=document.getElementById('custTrails'); c.innerHTML='';
  TRAIL_LIST.forEach(tr=>{
    const avail=trailAvail(tr);
    const div=document.createElement('div');
    div.className='skin-item'+(selectedTrail===tr.id?' active':'')+(avail?'':' locked');
    let badge=avail?(selectedTrail===tr.id?'✓ ON':tr.achieveReq?'Achieved':'Lv.'+tr.unlockLevel)
                   :(tr.achieveReq?'🔒 Achievement':`🔒 Lv.${tr.unlockLevel}`);
    div.innerHTML=`<span>${tr.label}</span><span class="skin-badge">${badge}</span>`;
    if (avail) div.onclick=()=>{ selectedTrail=tr.id; saveAll(); buildTrails(); };
    c.appendChild(div);
  });
}

function buildThemes() {
  const c=document.getElementById('custThemes'); c.innerHTML='';
  THEME_LIST.forEach(th=>{
    const avail=themeAvail(th.id);
    const div=document.createElement('div');
    div.className='theme-item'+(selectedTheme===th.id?' t-active':'')+(avail?'':' t-locked');
    let badge=avail?(selectedTheme===th.id?'✓ ON':th.achieveReq?'Achieved':'Lv.'+th.unlockLevel)
                   :(th.achieveReq?'🔒 Achievement':`🔒 Lv.${th.unlockLevel}`);
    const [c1,c2,c3]=th.colors;
    div.innerHTML=`
      <div style="display:flex;align-items:center">
        <div class="theme-swatch">
          <div class="t-dot" style="background:${c1};border:1px solid rgba(255,255,255,.2)"></div>
          <div class="t-dot" style="background:${c2}"></div>
          <div class="t-dot" style="background:${c3}"></div>
        </div>
        <span>${th.label}</span>
      </div>
      <span class="theme-badge">${badge}</span>`;
    if (avail) div.onclick=()=>{ applyTheme(th.id); saveAll(); buildThemes(); };
    c.appendChild(div);
  });
}

let achCat='all';
function buildAchievements(cat) {
  achCat=cat||achCat;
  const c=document.getElementById('achieveList'); c.innerHTML='';
  const list=ADEFS.filter(a=>achCat==='all'||a.cat===achCat);
  const sorted=[...list.filter(a=>achievements[a.id]),...list.filter(a=>!achievements[a.id])];
  sorted.forEach(a=>{
    const done=!!achievements[a.id];
    const div=document.createElement('div');
    div.className='ach-item'+(done?' done':'');
    div.innerHTML=`
      <div class="ach-icon">${done?a.icon:'❓'}</div>
      <div class="ach-info">
        <div class="ach-name">${done?a.name:'???'}</div>
        <div class="ach-desc">${done?a.desc:'Keep playing to unlock.'}</div>
        ${done&&a.reward?`<div class="ach-reward">🎁 ${a.reward}</div>`:''}
      </div>`;
    c.appendChild(div);
  });
  const total=ADEFS.length, done=Object.values(achievements).filter(Boolean).length;
  document.getElementById('achieveCount').textContent=`${done} / ${total} achieved`;
}

function buildStats() {
  const g=document.getElementById('statsGrid'); g.innerHTML='';
  [
    {val:ls.games,lbl:'GAMES PLAYED'}, {val:ls.apples,lbl:'LIFETIME APPLES'},
    {val:Math.floor(ls.distance),lbl:'BLOCKS TRAVELED'}, {val:ls.bosses,lbl:'BOSSES DEFEATED'},
    {val:ls.badSurvived||0,lbl:'BAD APPLES SURVIVED'}, {val:highScoreC,lbl:'CLASSIC BEST'},
    {val:highScoreF,lbl:'FREE AIM BEST'}, {val:level,lbl:'CURRENT LEVEL'},
    {val:streak,lbl:'DAY STREAK 🔥'}, {val:ls.totalScore||0,lbl:'TOTAL SCORE EARNED'},
  ].forEach(it=>{
    const div=document.createElement('div'); div.className='stat-cell';
    div.innerHTML=`<div class="stat-val">${it.val.toLocaleString()}</div><div class="stat-lbl">${it.lbl}</div>`;
    g.appendChild(div);
  });
}

/* ═══════════════════════════════════════════════════
   §29  EVENT WIRING
═══════════════════════════════════════════════════ */
document.getElementById('playBtn').onclick=()=>{ hidePanels(); document.getElementById('modePanel').classList.remove('hidden'); };
document.getElementById('modeClassic').onclick=()=>startGame('classic');
document.getElementById('modeFreeAim').onclick=()=>startGame('freeaim');
document.getElementById('backFromMode').onclick=backToMenu;

document.getElementById('customizeBtn').onclick=()=>{
  hidePanels(); buildSkins(); buildTrails(); buildThemes();
  document.getElementById('customizePanel').classList.remove('hidden');
};
document.getElementById('backFromCustomize').onclick=backToMenu;

document.getElementById('achieveBtn').onclick=()=>{ hidePanels(); buildAchievements('all'); document.getElementById('achievePanel').classList.remove('hidden'); };
document.getElementById('backFromAchieve').onclick=backToMenu;

document.getElementById('statsBtn').onclick=()=>{ hidePanels(); buildStats(); document.getElementById('statsPanel').classList.remove('hidden'); };
document.getElementById('backFromStats').onclick=backToMenu;

document.getElementById('settingsBtn').onclick=()=>{ hidePanels(); document.getElementById('settingsPanel').classList.remove('hidden'); };
document.getElementById('backFromSettings').onclick=backToMenu;

document.getElementById('playAgainBtn').onclick=()=>startGame(gameMode);
document.getElementById('backToMenuBtn').onclick=backToMenu;
document.getElementById('pauseBtn').onclick=togglePause;
document.getElementById('ascendBtn').onclick=startAscend;
document.getElementById('claimBtn').onclick=endGame;

document.getElementById('lightToggle').addEventListener('change',function(){
  document.body.classList.toggle('light-mode',this.checked);
});

// Customize tab switching
document.querySelectorAll('.cust-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.cust-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.cust-section').forEach(s=>s.classList.add('hidden'));
    const sec=document.getElementById('cust'+tab.dataset.section.charAt(0).toUpperCase()+tab.dataset.section.slice(1));
    if (sec) sec.classList.remove('hidden');
  });
});

// Achievement tab switching
document.querySelectorAll('.a-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.a-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    buildAchievements(tab.dataset.cat);
  });
});

/* ═══════════════════════════════════════════════════
   §30  BOOT
═══════════════════════════════════════════════════ */
bindDPad();
applyTheme(selectedTheme);
refreshMenuUI();
initIdleSnake();

/* ═══════════════════════════════════════════════════
   §HUB  NEON ARCADE HUB INTEGRATION
═══════════════════════════════════════════════════ */
function hubXpNeeded(lv) { return 100 + (lv - 1) * 75; }
function hubDefaultData() {
  return {
    level:1, xp:0, shards:0, streak:0, lastPlay:'',
    stats:{ snake:{games:0,best:0,apples:0}, flight:{games:0,best:0,shards:0} },
    quests:{ date:'', slots:[], progress:{}, claimed:{} },
    crossAch:{},
  };
}
// Hub navigation
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hubNavBtn')?.addEventListener('click', () => {
    window.location.href = '../hub.html';
  });
  document.getElementById('hubFloatBack')?.addEventListener('click', () => {
    window.location.href = '../hub.html';
  });
});

function hubReportSession(game, data) {
  const HUB_KEY = 'neonArcade_hub';
  try {
    const raw = localStorage.getItem(HUB_KEY);
    const hub = raw ? Object.assign(hubDefaultData(), JSON.parse(raw)) : hubDefaultData();
    hub.stats = hub.stats || {};
    if (game === 'snake') {
      hub.stats.snake = hub.stats.snake || {};
      hub.stats.snake.games = (hub.stats.snake.games || 0) + 1;
      hub.stats.snake.best = Math.max(hub.stats.snake.best || 0, data.score || 0);
      hub.stats.snake.apples = (hub.stats.snake.apples || 0) + (data.apples || 0);
    }
    hub.shards = (hub.shards || 0) + (data.shards || 0);
    hub.xp = (hub.xp || 0) + (data.hubXP || 0);
    while (hub.xp >= hubXpNeeded(hub.level || 1)) { hub.xp -= hubXpNeeded(hub.level); hub.level = (hub.level || 1) + 1; }
    // Quest progress
    const today = new Date().toISOString().slice(0,10);
    if (hub.quests && hub.quests.date === today && hub.quests.slots) {
      hub.quests.slots.forEach(q => {
        if (hub.quests.claimed && hub.quests.claimed[q.id]) return;
        const p = hub.quests.progress || {};
        if (q.game === 'snake' || q.game === 'both') {
          if (q.type === 'score' && q.game === 'snake') p[q.id] = Math.max(p[q.id]||0, data.score||0);
          if (q.type === 'plays') p[q.id] = (p[q.id]||0) + 1;
          if (q.type === 'apples') p[q.id] = (p[q.id]||0) + (data.apples||0);
          if (q.type === 'combo') p[q.id] = Math.max(p[q.id]||0, data.combo||0);
          if (q.type === 'total_plays') p[q.id] = (p[q.id]||0) + 1;
          if (q.type === 'total_shards') p[q.id] = (p[q.id]||0) + (data.shards||0);
          if (q.type === 'play_both') { if (!hub._playedSnakeToday) { hub._playedSnakeToday=true; } p[q.id] = (hub._playedSnakeToday&&hub._playedFlightToday)?1:0; }
        }
        hub.quests.progress = p;
      });
    }
    hub.lastPlay = today;
    localStorage.setItem(HUB_KEY, JSON.stringify(hub));
  } catch(e) { console.warn('[HubBridge]', e); }
}
