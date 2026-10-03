/* ============================================================
   NEON ARCADE  ·  arcade-core.js  ·  Neon Inc™ v3.0
   One shared account for every game: XP, levels, rank tiers,
   shards, streaks, daily quests, achievements, the Vault,
   settings, audio, music and shared visual helpers.
   © 2026 Neon Inc™. All rights reserved.
   ============================================================ */
(function (global) {
'use strict';

const STORE_KEY  = 'neonArcade_v3';
const LEGACY_HUB = 'neonArcade_hub';
const VERSION    = '3.0';

/* ─────────────────────────────────────────────────────────
   SMALL UTILS
───────────────────────────────────────────────────────── */
const pad2 = n => String(n).padStart(2, '0');
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dateKey(d); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => Math.round(n || 0).toLocaleString('en-US');
const fmtTime = ms => { const s = Math.max(0, ms) / 1000; const m = Math.floor(s / 60); return `${m}:${(s % 60).toFixed(2).padStart(5, '0')}`; };
function seededRNG(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ─────────────────────────────────────────────────────────
   GAME REGISTRY
   xp / shards turn a run's stats into account rewards.
───────────────────────────────────────────────────────── */
const GAMES = [
  {
    id: 'snake', name: 'NEON SNAKE', short: 'SNAKE', icon: '🐍', color: '#00ff66', path: 'games/snake/index.html',
    tagline: 'Dominate the grid. Chain combos, survive bad apples and take down the boss.',
    genre: 'ARCADE CLASSIC', added: '2025-01-01',
    xp: s => 15 + Math.round((s.score || 0) * 2.2) + (s.boss ? 120 : 0),
    shards: s => Math.floor((s.score || 0) / 3) + (s.boss ? 40 : 0),
  },
  {
    id: 'flight', name: 'NEON FLIGHT', short: 'FLIGHT', icon: '🚀', color: '#00f0ff', path: 'games/flight/index.html',
    tagline: 'Precision flight through digital chaos. Grab shards, cross realms, survive the glitch.',
    genre: 'REFLEX', added: '2025-01-01',
    xp: s => 15 + Math.round((s.score || 0) * 4.5),
    shards: s => (s.shards || 0) + Math.floor((s.score || 0) / 5),
  },
  {
    id: 'stack', name: 'NEON STACK', short: 'STACK', icon: '🧩', color: '#c04bff', path: 'games/stack/index.html',
    tagline: 'Falling-block puzzler. Hold, spin, clear quads and chase the perfect stack.',
    genre: 'PUZZLE', added: '2026-10-01',
    xp: s => 15 + (s.lines || 0) * 3 + Math.floor((s.score || 0) / 600) + (s.sprintDone ? 60 : 0),
    shards: s => (s.lines || 0) + (s.quads || 0) * 4 + (s.tspins || 0) * 3,
  },
  {
    id: 'breaker', name: 'NEON BREAKER', short: 'BREAKER', icon: '🧱', color: '#ff2a6d', path: 'games/breaker/index.html',
    tagline: 'Smash the neon wall. Multi-ball, lasers and a wall that fights back.',
    genre: 'ACTION', added: '2026-10-01',
    xp: s => 15 + Math.floor((s.score || 0) / 35) + ((s.level || 1) - 1) * 25,
    shards: s => Math.floor((s.score || 0) / 90) + ((s.level || 1) - 1) * 4,
  },
  {
    id: 'drift', name: 'VOID DRIFT', short: 'DRIFT', icon: '🛸', color: '#ffd700', path: 'games/drift/index.html',
    tagline: 'Vector-space survival. Thrust, wrap, split rocks and hunt the saucers.',
    genre: 'SHOOTER', added: '2026-10-01',
    xp: s => 15 + Math.floor((s.score || 0) / 90) + ((s.wave || 1) - 1) * 20,
    shards: s => Math.floor((s.score || 0) / 220) + ((s.wave || 1) - 1) * 3 + (s.ufos || 0) * 5,
  },
  {
    id: 'drifter', name: 'NEON DRIFTER', short: 'DRIFTER', icon: '🏎️', color: '#ff8a00', path: 'games/drifter/index.html',
    tagline: 'Old-school top-down drifting. Slide the corners, chain combos, bank the points.',
    genre: 'RACING', added: '2026-10-03',
    xp: s => 15 + Math.floor((s.score || 0) / 220) + (s.laps || 0) * 12,
    shards: s => Math.floor((s.score || 0) / 900) + (s.laps || 0) * 3,
  },
  {
    id: 'typer', name: 'KEYSTORM', short: 'KEYSTORM', icon: '⌨️', color: '#b6ff00', path: 'games/typer/index.html',
    tagline: 'Type fast, type clean. Speed tests with live WPM, and a word storm to survive.',
    genre: 'TYPING', added: '2026-10-03',
    xp: s => 15 + (s.words || 0) * 2 + Math.round((s.wpm || 0) * 0.6),
    shards: s => Math.floor((s.words || 0) / 3) + Math.floor((s.wpm || 0) / 10),
  },
  {
    id: 'memory', name: 'MIND MATCH', short: 'MATCH', icon: '🃏', color: '#ff4fd8', path: 'games/memory/index.html',
    tagline: 'Flip, remember, match. Six stages of growing grids against the clock.',
    genre: 'MEMORY', added: '2026-10-03',
    xp: s => 15 + Math.floor((s.score || 0) / 40) + (s.stage || 0) * 15,
    shards: s => Math.floor((s.score || 0) / 160) + (s.stage || 0) * 3,
  },
  {
    id: 'gems', name: 'NEON GEMS', short: 'GEMS', icon: '💠', color: '#4d7cff', path: 'games/gems/index.html',
    tagline: 'Swap, match three, trigger cascades. Line gems, bombs and prisms.',
    genre: 'MATCH-3', added: '2026-10-03',
    xp: s => 15 + Math.floor((s.score || 0) / 260),
    shards: s => Math.floor((s.score || 0) / 1100) + (s.specials || 0),
  },
  {
    id: 'pool', name: 'NEON POOL', short: 'POOL', icon: '🎱', color: '#19ffd2', path: 'games/pool/index.html',
    tagline: '8-ball against the CPU, or a three-minute potting rush. Line it up.',
    genre: 'SPORTS', added: '2026-10-03',
    xp: s => 15 + Math.floor((s.score || 0) / 30) + (s.win ? 100 : 0),
    shards: s => Math.floor((s.score || 0) / 120) + (s.win ? 25 : 0),
  },
];
const gameById = id => GAMES.find(g => g.id === id);

/* ─────────────────────────────────────────────────────────
   LEVELS & RANK TIERS  (carried over from v2)
───────────────────────────────────────────────────────── */
const TIERS = [
  { from: 1,   to: 3,        name: 'NULL.SIGNAL',    icon: '◌',  color: '#9aa0b5' },
  { from: 4,   to: 7,        name: 'GHOST',          icon: '👻', color: '#aaddff' },
  { from: 8,   to: 12,       name: 'NEON CRAWLER',   icon: '🔷', color: '#00f0ff' },
  { from: 13,  to: 18,       name: 'GRID RUNNER',    icon: '⚡', color: '#00ff88' },
  { from: 19,  to: 25,       name: 'BYTE HUNTER',    icon: '🎯', color: '#ff8800' },
  { from: 26,  to: 35,       name: 'STATIC PHANTOM', icon: '👾', color: '#ff00ff' },
  { from: 36,  to: 45,       name: 'SYNTH RIDER',    icon: '🌊', color: '#ff44cc' },
  { from: 46,  to: 60,       name: 'VOID WALKER',    icon: '🌌', color: '#8f6bff' },
  { from: 61,  to: 80,       name: 'SIGNAL SHADE',   icon: '💫', color: '#ffcc00' },
  { from: 81,  to: 99,       name: 'QUANTUM GHOST',  icon: '🔮', color: '#ff0088' },
  { from: 100, to: Infinity, name: 'NEON LEGEND',    icon: '👑', color: '#ffd700' },
];
const tier = lv => TIERS.find(t => lv >= t.from && lv <= t.to) || TIERS[TIERS.length - 1];
const xpNeeded = lv => 100 + (lv - 1) * 75;

/* ─────────────────────────────────────────────────────────
   VAULT — every unlockable in the arcade
   unlock: { level } | { ach } | { cost } (cost may combine with level)
───────────────────────────────────────────────────────── */
const R = (id, type, name, unlock, data = {}, game = null) => ({ id, type, name, unlock, data, game });
const REWARDS = [
  // ── AVATARS ──
  R('av_signal', 'avatar', 'Signal',   { default: true }, { glyph: '◌' }),
  R('av_invader','avatar', 'Invader',  { default: true }, { glyph: '👾' }),
  R('av_bot',    'avatar', 'Unit',     { default: true }, { glyph: '🤖' }),
  R('av_ghost',  'avatar', 'Ghost',    { level: 3 },      { glyph: '👻' }),
  R('av_saucer', 'avatar', 'Saucer',   { level: 6 },      { glyph: '🛸' }),
  R('av_snake',  'avatar', 'Serpent',  { ach: 'snake_50' },  { glyph: '🐍' }),
  R('av_rocket', 'avatar', 'Rocket',   { ach: 'flight_25' }, { glyph: '🚀' }),
  R('av_block',  'avatar', 'Block',    { ach: 'stack_quad' }, { glyph: '🧩' }),
  R('av_brick',  'avatar', 'Brick',    { ach: 'breaker_lv3' }, { glyph: '🧱' }),
  R('av_comet',  'avatar', 'Comet',    { ach: 'drift_wave5' }, { glyph: '☄️' }),
  R('av_car',    'avatar', 'Racer',    { ach: 'drifter_finish' }, { glyph: '🏎️' }),
  R('av_keys',   'avatar', 'Keys',     { ach: 'typer_40' },  { glyph: '⌨️' }),
  R('av_card',   'avatar', 'Joker',    { ach: 'memory_s3' }, { glyph: '🃏' }),
  R('av_jewel',  'avatar', 'Jewel',    { ach: 'gems_10k' },  { glyph: '💠' }),
  R('av_8ball',  'avatar', 'Eight',    { ach: 'pool_win' },  { glyph: '🎱' }),
  R('av_gem',    'avatar', 'Shard',    { cost: 150 },     { glyph: '💎' }),
  R('av_bolt',   'avatar', 'Bolt',     { cost: 200 },     { glyph: '⚡' }),
  R('av_skull',  'avatar', 'Static',   { cost: 300, level: 8 }, { glyph: '💀' }),
  R('av_dragon', 'avatar', 'Dragon',   { cost: 600, level: 15 }, { glyph: '🐉' }),
  R('av_orb',    'avatar', 'Oracle',   { level: 25 },     { glyph: '🔮' }),
  R('av_crown',  'avatar', 'Crown',    { level: 50 },     { glyph: '👑' }),

  // ── TITLES ──
  R('ti_rookie',  'title', 'ROOKIE',          { default: true }),
  R('ti_player',  'title', 'PLAYER ONE',      { level: 2 }),
  R('ti_ghost',   'title', 'GRID GHOST',      { level: 5 }),
  R('ti_explorer','title', 'ARCADE EXPLORER', { ach: 'arc_explorer' }),
  R('ti_combo',   'title', 'COMBO ADDICT',    { ach: 'snake_combo10' }),
  R('ti_slayer',  'title', 'BOSS SLAYER',     { ach: 'snake_boss' }),
  R('ti_pilot',   'title', 'ACE PILOT',       { ach: 'flight_50' }),
  R('ti_stacker', 'title', 'MASTER STACKER',  { ach: 'stack_lv10' }),
  R('ti_wrecker', 'title', 'WALL WRECKER',    { ach: 'breaker_lv5' }),
  R('ti_void',    'title', 'VOID HUNTER',     { ach: 'drift_wave10' }),
  R('ti_regular', 'title', 'ARCADE REGULAR',  { ach: 'arc_runs100' }),
  R('ti_drift',   'title', 'DRIFT KING',      { ach: 'drifter_50k' }),
  R('ti_typist',  'title', 'SPEED TYPIST',    { ach: 'typer_80' }),
  R('ti_mind',    'title', 'PHOTOGRAPHIC',    { ach: 'memory_perfect' }),
  R('ti_jewel',   'title', 'GEM CUTTER',      { ach: 'gems_50k' }),
  R('ti_shark',   'title', 'POOL SHARK',      { ach: 'pool_wins10' }),
  R('ti_baller',  'title', 'SHARD BARON',     { cost: 800 }),
  R('ti_night',   'title', 'NIGHT SHIFT',     { cost: 250 }),
  R('ti_legend',  'title', 'NEON LEGEND',     { level: 100 }),

  // ── HUB THEMES ──
  R('th_neon',    'theme', 'Neon Classic', { default: true }, { a1: '#00f0ff', a2: '#ff00ff' }),
  R('th_vapor',   'theme', 'Vaporwave',    { level: 5 },      { a1: '#ff6fff', a2: '#44ffee' }),
  R('th_matrix',  'theme', 'Data Matrix',  { cost: 300 },     { a1: '#00ff66', a2: '#b6ff00' }),
  R('th_crimson', 'theme', 'Crimson Core', { cost: 400 },     { a1: '#ff1744', a2: '#ff8800' }),
  R('th_sunset',  'theme', 'Outrun Sunset',{ level: 12 },     { a1: '#ff8a00', a2: '#ff2a6d' }),
  R('th_ice',     'theme', 'Cryo',         { cost: 500, level: 10 }, { a1: '#9be8ff', a2: '#7d8cff' }),
  R('th_royal',   'theme', 'Royal Static', { ach: 'arc_allround' }, { a1: '#ffd700', a2: '#c04bff' }),

  // ── SNAKE SKINS ──
  R('snake_neon',    'skin', 'Neon Viper',  { default: true }, { body: '#00ff66', head: '#eaffef', glow: '#00ff66' }, 'snake'),
  R('snake_cyan',    'skin', 'Cyan Pulse',  { level: 2 },      { body: '#00f0ff', head: '#e8fdff', glow: '#00f0ff' }, 'snake'),
  R('snake_fire',    'skin', 'Firewall',    { level: 6 },      { body: '#ff6a00', head: '#fff2a8', glow: '#ff8800', anim: 'fire' }, 'snake'),
  R('snake_ice',     'skin', 'Cryo Coil',   { cost: 150 },     { body: '#88ddff', head: '#ffffff', glow: '#aaeeff' }, 'snake'),
  R('snake_gold',    'skin', 'Gold Rush',   { ach: 'snake_combo10' }, { body: '#ffd700', head: '#fffbe0', glow: '#ffcc00', anim: 'shimmer' }, 'snake'),
  R('snake_void',    'skin', 'Void Eater',  { ach: 'snake_boss' }, { body: '#9955ff', head: '#ffffff', glow: '#bb66ff', anim: 'void' }, 'snake'),
  R('snake_rainbow', 'skin', 'Prism',       { cost: 600, level: 15 }, { body: '#ff00ff', head: '#ffffff', glow: '#ffffff', anim: 'rainbow' }, 'snake'),

  // ── FLIGHT SKINS ──
  R('flight_orb',    'skin', 'Neon Orb',     { default: true }, { body: '#00f0ff', eye: '#ffffff', trail: '#00f0ff', eyes: 'normal' }, 'flight'),
  R('flight_cube',   'skin', 'Cyber Cube',   { level: 3 },      { body: '#ff00ff', eye: '#00ffff', trail: '#ff00ff', eyes: 'visor', shape: 'cube' }, 'flight'),
  R('flight_plasma', 'skin', 'Plasma Core',  { ach: 'flight_25' }, { body: '#ff4400', eye: '#ffcc00', trail: '#ff6600', eyes: 'angry' }, 'flight'),
  R('flight_pixel',  'skin', 'Pixel Buddy',  { cost: 200 },     { body: '#00ff88', eye: '#ffffff', trail: '#00ff44', eyes: 'pixel', shape: 'cube' }, 'flight'),
  R('flight_ghost',  'skin', 'Ghost Pulse',  { cost: 350 },     { body: '#8866ff', eye: '#ffffff', trail: '#aa88ff', eyes: 'happy' }, 'flight'),
  R('flight_heart',  'skin', 'Glitch Heart', { ach: 'flight_glitch' }, { body: '#ff3d8b', eye: '#ffffff', trail: '#ff77aa', eyes: 'heart' }, 'flight'),
  R('flight_sprite', 'skin', 'Synth Sprite', { ach: 'flight_100' }, { body: '#ffcc00', eye: '#ff8800', trail: '#ffaa00', eyes: 'stars' }, 'flight'),

  // ── STACK SKINS  (piece order: I O T S Z J L) ──
  R('stack_neon',  'skin', 'Neon Prime', { default: true }, { pieces: ['#00f0ff', '#ffe600', '#c04bff', '#00ff66', '#ff2a6d', '#2f6bff', '#ff8a00'], style: 'glass' }, 'stack'),
  R('stack_vapor', 'skin', 'Vapor',      { level: 4 },      { pieces: ['#44ffee', '#ffd1f7', '#ff6fff', '#8affc1', '#ff77aa', '#9a7bff', '#ffb36b'], style: 'glass' }, 'stack'),
  R('stack_mono',  'skin', 'Wireframe',  { cost: 200 },     { pieces: ['#00f0ff', '#00f0ff', '#00f0ff', '#00f0ff', '#00f0ff', '#00f0ff', '#00f0ff'], style: 'outline' }, 'stack'),
  R('stack_boy',   'skin', 'Pocket DMG', { cost: 250 },     { pieces: ['#9bbc0f', '#8bac0f', '#9bbc0f', '#8bac0f', '#9bbc0f', '#8bac0f', '#9bbc0f'], style: 'pixel' }, 'stack'),
  R('stack_ember', 'skin', 'Ember',      { ach: 'stack_lv10' }, { pieces: ['#ff3b00', '#ffb300', '#ff1744', '#ff8a00', '#ff4f6d', '#ff6a00', '#ffd000'], style: 'glass' }, 'stack'),
  R('stack_gold',  'skin', 'Bullion',    { ach: 'stack_100lines' }, { pieces: ['#ffe680', '#ffd700', '#ffcc33', '#f2c200', '#ffdd55', '#e6b800', '#fff0a8'], style: 'glass' }, 'stack'),

  // ── BREAKER SKINS ──
  R('breaker_neon',   'skin', 'Hot Pink',  { default: true }, { paddle: '#ff2a6d', ball: '#ffffff', glow: '#ff2a6d' }, 'breaker'),
  R('breaker_cyan',   'skin', 'Cold Line', { level: 3 },      { paddle: '#00f0ff', ball: '#e8fdff', glow: '#00f0ff' }, 'breaker'),
  R('breaker_lime',   'skin', 'Acid',      { cost: 150 },     { paddle: '#b6ff00', ball: '#f4ffd6', glow: '#b6ff00' }, 'breaker'),
  R('breaker_sun',    'skin', 'Solar',     { ach: 'breaker_lv5' }, { paddle: '#ff8a00', ball: '#ffe680', glow: '#ffaa00' }, 'breaker'),
  R('breaker_plasma', 'skin', 'Plasma',    { ach: 'breaker_multi' }, { paddle: '#c04bff', ball: '#ffffff', glow: '#e07bff', anim: 'rainbow' }, 'breaker'),

  // ── DRIFT SKINS ──
  R('drift_neon',  'skin', 'Interceptor', { default: true }, { ship: '#00f0ff', flame: '#ff00ff', bullet: '#ffffff' }, 'drift'),
  R('drift_viper', 'skin', 'Viper',       { level: 4 },      { ship: '#00ff66', flame: '#b6ff00', bullet: '#eaffef' }, 'drift'),
  R('drift_ruby',  'skin', 'Ruby Wing',   { cost: 200 },     { ship: '#ff2a6d', flame: '#ff8a00', bullet: '#ffd1dc' }, 'drift'),
  R('drift_ghost', 'skin', 'Phantom',     { ach: 'drift_ufo' }, { ship: '#c04bff', flame: '#00f0ff', bullet: '#f0d9ff' }, 'drift'),
  R('drift_solar', 'skin', 'Solar Flare', { ach: 'drift_wave10' }, { ship: '#ffd700', flame: '#ff4400', bullet: '#fff6c8' }, 'drift'),

  // ── DRIFTER CARS ──
  R('drifter_neon',  'skin', 'Sunset Runner', { default: true }, { body: '#ff8a00', stripe: '#ffd36b', trail: '#ff2a6d' }, 'drifter'),
  R('drifter_cyan',  'skin', 'Ice Coupe',     { level: 4 },      { body: '#00f0ff', stripe: '#e8fdff', trail: '#2f6bff' }, 'drifter'),
  R('drifter_venom', 'skin', 'Venom',         { cost: 250 },     { body: '#b6ff00', stripe: '#101a00', trail: '#00ff66' }, 'drifter'),
  R('drifter_phant', 'skin', 'Phantom GT',    { ach: 'drifter_combo' }, { body: '#c04bff', stripe: '#ffffff', trail: '#ff00ff' }, 'drifter'),
  R('drifter_gold',  'skin', 'Gold Rush',     { ach: 'drifter_50k' }, { body: '#ffd700', stripe: '#1a1200', trail: '#ff8a00' }, 'drifter'),

  // ── KEYSTORM: colour + keyboard sound ──
  R('typer_lime',  'skin', 'Blue Switch',  { default: true }, { c1: '#b6ff00', c2: '#00f0ff', snd: 'click' }, 'typer'),
  R('typer_thock', 'skin', 'Thock Board',  { level: 3 },      { c1: '#ffb36b', c2: '#ff2a6d', snd: 'thock' }, 'typer'),
  R('typer_type',  'skin', 'Typewriter',   { cost: 200 },     { c1: '#f2e6c9', c2: '#ff8a00', snd: 'type' }, 'typer'),
  R('typer_laser', 'skin', 'Laser Keys',   { ach: 'typer_60' }, { c1: '#00f0ff', c2: '#ff00ff', snd: 'laser' }, 'typer'),
  R('typer_8bit',  'skin', '8-Bit',        { ach: 'typer_rain' }, { c1: '#ffe600', c2: '#c04bff', snd: 'chip' }, 'typer'),

  // ── MIND MATCH card backs ──
  R('memory_neon',  'skin', 'Neon Grid',  { default: true }, { back: '#ff4fd8', glow: '#ff4fd8', pat: 'grid' }, 'memory'),
  R('memory_cyan',  'skin', 'Circuit',    { level: 3 },      { back: '#00f0ff', glow: '#00f0ff', pat: 'circuit' }, 'memory'),
  R('memory_gold',  'skin', 'Royal',      { cost: 200 },     { back: '#ffd700', glow: '#ffb300', pat: 'diamond' }, 'memory'),
  R('memory_void',  'skin', 'Void',       { ach: 'memory_s6' }, { back: '#8f6bff', glow: '#c04bff', pat: 'stars' }, 'memory'),

  // ── NEON GEMS palettes ──
  R('gems_neon',   'skin', 'Prism',      { default: true }, { gems: ['#ff2a6d', '#ff8a00', '#ffe600', '#00ff66', '#00b3ff', '#c04bff'] }, 'gems'),
  R('gems_candy',  'skin', 'Candy',      { level: 4 },      { gems: ['#ff77aa', '#ffb36b', '#fff27a', '#8affc1', '#7ad7ff', '#d59bff'] }, 'gems'),
  R('gems_ember',  'skin', 'Ember',      { cost: 250 },     { gems: ['#ff1744', '#ff6a00', '#ffd000', '#ff4fd8', '#ff9e80', '#ffe0b2'] }, 'gems'),
  R('gems_ocean',  'skin', 'Deep Sea',   { ach: 'gems_prism' }, { gems: ['#00f0ff', '#00ffaa', '#4d7cff', '#7df9ff', '#2f6bff', '#b388ff'] }, 'gems'),

  // ── NEON POOL tables ──
  R('pool_teal',   'skin', 'Teal Felt',  { default: true }, { felt: '#063a35', line: '#19ffd2', rail: '#0b1a26', cue: '#ffd36b' }, 'pool'),
  R('pool_blue',   'skin', 'Midnight',   { level: 5 },      { felt: '#0a1650', line: '#4d7cff', rail: '#070a1c', cue: '#e8fdff' }, 'pool'),
  R('pool_red',    'skin', 'Vegas Red',  { cost: 300 },     { felt: '#3d0614', line: '#ff2a6d', rail: '#16050b', cue: '#ffd700' }, 'pool'),
  R('pool_violet', 'skin', 'Violet Lounge', { ach: 'pool_wins10' }, { felt: '#2a0a45', line: '#c04bff', rail: '#12051d', cue: '#00f0ff' }, 'pool'),
];
const rewardById = id => REWARDS.find(r => r.id === id);

/* ─────────────────────────────────────────────────────────
   ACHIEVEMENTS
   check(g, st): g = this game's record (or null for arcade-wide), st = whole state
   Records keep: plays, best, totals{}, maxes{}, mins{}, flags{}, modes{}
───────────────────────────────────────────────────────── */
const A = (id, game, icon, name, desc, check, xp = 100, shards = 20) => ({ id, game, icon, name, desc, check, xp, shards });
const t = (g, k) => (g && g.totals[k]) || 0;
const m = (g, k) => (g && g.maxes[k]) || 0;
const f = (g, k) => !!(g && g.flags[k]);
const totalPlays = st => GAMES.reduce((n, gm) => n + (st.games[gm.id]?.plays || 0), 0);
const gamesPlayed = st => GAMES.filter(gm => (st.games[gm.id]?.plays || 0) > 0).length;

const ACHIEVEMENTS = [
  // ── ARCADE-WIDE ──
  A('arc_first',     'arcade', '🎮', 'INSERT COIN',     'Play your first game in the arcade.',       (g, st) => totalPlays(st) >= 1, 50, 20),
  A('arc_explorer',  'arcade', '🗺️', 'ARCADE EXPLORER', 'Play all five games.',                        (g, st) => gamesPlayed(st) >= GAMES.length, 300, 80),
  A('arc_runs25',    'arcade', '💀', 'DEDICATED',       'Play 25 runs across the arcade.',             (g, st) => totalPlays(st) >= 25, 250, 40),
  A('arc_runs100',   'arcade', '🏆', 'ARCADE REGULAR',  'Play 100 runs across the arcade.',            (g, st) => totalPlays(st) >= 100, 700, 120),
  A('arc_lv5',       'arcade', '⚡', 'RISING SIGNAL',   'Reach account level 5.',                      (g, st) => st.level >= 5, 150, 30),
  A('arc_lv10',      'arcade', '🌟', 'GRID PIONEER',    'Reach account level 10.',                     (g, st) => st.level >= 10, 300, 60),
  A('arc_lv25',      'arcade', '👾', 'PHANTOM STATUS',  'Reach account level 25.',                     (g, st) => st.level >= 25, 800, 150),
  A('arc_lv50',      'arcade', '🌌', 'VOID ASCENDANT',  'Reach account level 50.',                     (g, st) => st.level >= 50, 1500, 300),
  A('arc_streak3',   'arcade', '🔥', 'ON A ROLL',       'Play 3 days in a row.',                       (g, st) => st.bestStreak >= 3, 150, 30),
  A('arc_streak7',   'arcade', '📅', 'WEEKLY RITUAL',   'Play 7 days in a row.',                       (g, st) => st.bestStreak >= 7, 500, 100),
  A('arc_quests5',   'arcade', '📜', 'QUEST TAKER',     'Claim 5 daily quests.',                       (g, st) => st.questsClaimed >= 5, 150, 30),
  A('arc_quests30',  'arcade', '🗡️', 'QUEST MASTER',    'Claim 30 daily quests.',                      (g, st) => st.questsClaimed >= 30, 600, 120),
  A('arc_rich',      'arcade', '💰', 'SHARD MAGNATE',   'Earn 2,000 shards in total.',                 (g, st) => st.shardsEarned >= 2000, 400, 0),
  A('arc_collector', 'arcade', '🎁', 'COLLECTOR',       'Own 20 items from the Vault.',                (g, st) => ownedCount(st) >= 20, 400, 80),
  A('arc_allround',  'arcade', '👑', 'ALL-ROUNDER',     'Earn the first milestone badge in every game.', (g, st) => ['snake_50', 'flight_25', 'stack_quad', 'breaker_lv3', 'drift_wave5', 'drifter_finish', 'typer_40', 'memory_s3', 'gems_10k', 'pool_win'].every(id => st.ach[id]), 1000, 250),

  // ── SNAKE ──
  A('snake_first',   'snake', '🍎', 'FIRST BITE',     'Eat your first apple.',                 g => t(g, 'apples') >= 1, 40, 10),
  A('snake_50',      'snake', '🐍', 'GRID SERPENT',   'Score 50 in one run.',                  g => g.best >= 50, 150, 30),
  A('snake_150',     'snake', '🐉', 'APEX COIL',      'Score 150 in one run.',                 g => g.best >= 150, 400, 80),
  A('snake_combo5',  'snake', '🔥', 'ON FIRE',        'Reach a ×5 combo.',                     g => m(g, 'maxCombo') >= 5, 120, 25),
  A('snake_combo10', 'snake', '💥', 'UNSTOPPABLE',    'Reach a ×10 combo.',                    g => m(g, 'maxCombo') >= 10, 300, 60),
  A('snake_golden',  'snake', '✨', 'GOLDEN TOUCH',   'Eat 10 golden apples in total.',        g => t(g, 'goldens') >= 10, 150, 30),
  A('snake_immune',  'snake', '🧬', 'IMMUNE',         'Survive 5 bad apples in total.',        g => t(g, 'badSurvived') >= 5, 150, 30),
  A('snake_boss',    'snake', '👑', 'BOSS SLAYER',    'Defeat the Grid Warden.',               g => f(g, 'boss'), 400, 100),
  A('snake_free',    'snake', '🌀', 'FREE SPIRIT',    'Score 30 in Free Aim mode.',            g => (g.bests.free || 0) >= 30, 150, 30),
  A('snake_42',      'snake', '🌐', 'THE ANSWER',     'End a run on exactly 42.',              g => f(g, 'answer42'), 142, 42),

  // ── FLIGHT ──
  A('flight_first',  'flight', '🕊️', 'FIRST FLIGHT',  'Pass your first pillar.',               g => g.best >= 1, 40, 10),
  A('flight_25',     'flight', '💨', 'SPEED DEMON',   'Score 25 in one run.',                  g => g.best >= 25, 150, 30),
  A('flight_50',     'flight', '⚡', 'SUPERSONIC',    'Score 50 in one run.',                  g => g.best >= 50, 300, 60),
  A('flight_100',    'flight', '✨', 'ASCENDED',      'Score 100 and reach the Heaven realm.', g => g.best >= 100, 600, 120),
  A('flight_glitch', 'flight', '👾', 'GLITCH HUNTER', 'Survive the score-42 system error.',    g => f(g, 'glitch'), 250, 50),
  A('flight_hell',   'flight', '🔥', 'HELL DIVER',    'Reach the Hell realm (score 75).',       g => m(g, 'realm') >= 4, 400, 80),
  A('flight_combo',  'flight', '💫', 'COMBO KING',    'Reach a ×5 shard combo.',               g => m(g, 'maxCombo') >= 5, 150, 30),
  A('flight_hoard',  'flight', '💎', 'HOARDER',       'Collect 300 shards in Flight.',         g => t(g, 'shards') >= 300, 200, 0),

  // ── STACK ──
  A('stack_first',   'stack', '🧱', 'FIRST CLEAR',    'Clear your first line.',                g => t(g, 'lines') >= 1, 40, 10),
  A('stack_quad',    'stack', '🟦', 'QUAD!',          'Clear four lines at once.',             g => t(g, 'quads') >= 1, 150, 30),
  A('stack_tspin',   'stack', '🌀', 'SPIN DOCTOR',    'Land a T-spin line clear.',             g => t(g, 'tspins') >= 1, 200, 40),
  A('stack_lv10',    'stack', '📈', 'LEVEL TEN',      'Reach level 10 in Marathon.',           g => m(g, 'level') >= 10, 400, 80),
  A('stack_combo',   'stack', '🔗', 'CHAIN REACTION', 'Reach a ×5 clear combo.',               g => m(g, 'maxCombo') >= 5, 200, 40),
  A('stack_sprint',  'stack', '🏁', 'SPRINTER',       'Finish a 40-line Sprint.',              g => f(g, 'sprintDone'), 200, 40),
  A('stack_sprint2', 'stack', '⏱️', 'SUB TWO',        'Finish Sprint in under 2:00.',          g => (g.mins.sprintMs || Infinity) <= 120000, 500, 100),
  A('stack_100lines','stack', '💯', 'CENTURION',      'Clear 100 lines in total.',             g => t(g, 'lines') >= 100, 300, 60),
  A('stack_50k',     'stack', '🏆', 'HIGH STACKER',   'Score 50,000 in one game.',             g => g.best >= 50000, 400, 80),

  // ── BREAKER ──
  A('breaker_first', 'breaker', '💥', 'FIRST CRACK',  'Break your first brick.',               g => t(g, 'bricks') >= 1, 40, 10),
  A('breaker_lv3',   'breaker', '🧱', 'WALL BREACH',  'Reach level 3.',                        g => m(g, 'level') >= 3, 150, 30),
  A('breaker_lv5',   'breaker', '🔨', 'DEMOLITION',   'Reach level 5.',                        g => m(g, 'level') >= 5, 300, 60),
  A('breaker_lv10',  'breaker', '🏗️', 'URBAN RENEWAL','Reach level 10.',                       g => m(g, 'level') >= 10, 600, 120),
  A('breaker_multi', 'breaker', '🔮', 'MULTIBALL',    'Have 5 balls in play at once.',         g => m(g, 'maxBalls') >= 5, 200, 40),
  A('breaker_clean', 'breaker', '🛡️', 'FLAWLESS',     'Clear a level without losing a ball.',  g => f(g, 'flawless'), 250, 50),
  A('breaker_1k',    'breaker', '📦', 'BRICK LAYER',  'Break 1,000 bricks in total.',          g => t(g, 'bricks') >= 1000, 400, 80),

  // ── DRIFT ──
  A('drift_first',   'drift', '☄️', 'FIRST CONTACT', 'Destroy your first asteroid.',           g => t(g, 'rocks') >= 1, 40, 10),
  A('drift_wave5',   'drift', '🌠', 'DEEP SPACE',    'Reach wave 5.',                          g => m(g, 'wave') >= 5, 150, 30),
  A('drift_wave10',  'drift', '🌌', 'EVENT HORIZON', 'Reach wave 10.',                         g => m(g, 'wave') >= 10, 500, 100),
  A('drift_ufo',     'drift', '🛸', 'SAUCER HUNTER', 'Shoot down a saucer.',                   g => t(g, 'ufos') >= 1, 200, 40),
  A('drift_aim',     'drift', '🎯', 'SHARPSHOOTER',  'Finish a run with 60%+ accuracy (30+ shots).', g => f(g, 'sharp'), 300, 60),
  A('drift_10k',     'drift', '💫', 'STAR DUST',     'Score 10,000 in one run.',               g => g.best >= 10000, 300, 60),
  A('drift_500',     'drift', '🪨', 'ROCK BREAKER',  'Destroy 500 asteroids in total.',        g => t(g, 'rocks') >= 500, 400, 80),

  // ── DRIFTER ──
  A('drifter_first',  'drifter', '🛞', 'SIDEWAYS',       'Bank your first drift.',                 g => t(g, 'drifts') >= 1, 40, 10),
  A('drifter_finish', 'drifter', '🏁', 'CHECKERED FLAG', 'Finish a 3-lap drift run.',              g => f(g, 'finished'), 150, 30),
  A('drifter_big',    'drifter', '💨', 'BIG SLIDE',      'Bank a single drift worth 3,000.',       g => m(g, 'bestDrift') >= 3000, 200, 40),
  A('drifter_combo',  'drifter', '🔥', 'CHAIN SLIDER',   'Reach a ×5 drift chain.',                g => m(g, 'maxCombo') >= 5, 250, 50),
  A('drifter_50k',    'drifter', '👑', 'DRIFT KING',     'Score 30,000 in one run.',               g => g.best >= 30000, 400, 80),
  A('drifter_clean',  'drifter', '✨', 'CLEAN LINE',     'Finish a run without touching a wall.',  g => f(g, 'clean'), 300, 60),

  // ── KEYSTORM ──
  A('typer_first',   'typer', '⌨️', 'HELLO WORLD',    'Type your first word.',                   g => t(g, 'words') >= 1, 40, 10),
  A('typer_40',      'typer', '🚀', 'WARMED UP',      'Reach 40 WPM in a speed test.',           g => m(g, 'wpm') >= 40, 150, 30),
  A('typer_60',      'typer', '⚡', 'QUICK FINGERS',  'Reach 60 WPM in a speed test.',           g => m(g, 'wpm') >= 60, 250, 50),
  A('typer_80',      'typer', '🔥', 'BLAZING',        'Reach 80 WPM in a speed test.',           g => m(g, 'wpm') >= 80, 400, 80),
  A('typer_perfect', 'typer', '🎯', 'FLAWLESS',       'Finish a test at 100% accuracy (25+ words).', g => f(g, 'perfect'), 250, 50),
  A('typer_rain',    'typer', '🌧️', 'STORM CHASER',   'Survive to wave 8 in Word Storm.',        g => m(g, 'wave') >= 8, 300, 60),
  A('typer_1k',      'typer', '📚', 'WORDSMITH',      'Type 1,000 words in total.',              g => t(g, 'words') >= 1000, 400, 80),

  // ── MIND MATCH ──
  A('memory_first',   'memory', '🃏', 'FIRST PAIR',    'Match your first pair.',                  g => t(g, 'pairs') >= 1, 40, 10),
  A('memory_s3',      'memory', '🧠', 'SHARP MIND',    'Clear stage 3 in Arcade.',                g => m(g, 'stage') >= 3, 150, 30),
  A('memory_s6',      'memory', '🌌', 'TOTAL RECALL',  'Clear all 6 stages in Arcade.',           g => m(g, 'stage') >= 6, 500, 100),
  A('memory_perfect', 'memory', '📸', 'PHOTOGRAPHIC',  'Clear a stage with no mismatches.',       g => f(g, 'perfect'), 250, 50),
  A('memory_combo',   'memory', '🔗', 'ON A STREAK',   'Match 5 pairs in a row.',                 g => m(g, 'maxCombo') >= 5, 200, 40),
  A('memory_relax',   'memory', '🧘', 'ZEN MASTER',    'Clear Relax mode in 30 moves or fewer.',  g => f(g, 'zen30'), 250, 50),

  // ── NEON GEMS ──
  A('gems_first',   'gems', '💠', 'FIRST MATCH',   'Make your first match.',                    g => t(g, 'matches') >= 1, 40, 10),
  A('gems_10k',     'gems', '💎', 'POLISHED',      'Score 10,000 in one game.',                 g => g.best >= 10000, 150, 30),
  A('gems_50k',     'gems', '👑', 'CROWN JEWELS',  'Score 50,000 in one game.',                 g => g.best >= 50000, 400, 80),
  A('gems_cascade', 'gems', '🌊', 'CASCADE',       'Trigger a ×5 cascade.',                     g => m(g, 'maxCascade') >= 5, 250, 50),
  A('gems_prism',   'gems', '🌈', 'PRISMATIC',     'Create a prism gem (match five).',          g => t(g, 'prisms') >= 1, 250, 50),
  A('gems_100',     'gems', '💥', 'DEMOLITION',    'Set off 100 special gems in total.',        g => t(g, 'specials') >= 100, 400, 80),

  // ── NEON POOL ──
  A('pool_first',  'pool', '🎱', 'FIRST POT',      'Pot your first ball.',                      g => t(g, 'pots') >= 1, 40, 10),
  A('pool_win',    'pool', '🏆', 'EIGHT DOWN',     'Beat the CPU at 8-ball.',                   g => t(g, 'wins') >= 1, 200, 40),
  A('pool_run',    'pool', '🔥', 'ON THE RUN',     'Pot 4 balls in a single turn.',             g => m(g, 'maxRun') >= 4, 250, 50),
  A('pool_clean',  'pool', '✨', 'NO MISTAKES',    'Win 8-ball without a single foul.',         g => f(g, 'cleanWin'), 300, 60),
  A('pool_rush',   'pool', '⏱️', 'RUSH HOUR',      'Pot 15 balls in one Time Rush.',            g => (g.bests.rush || 0) >= 1500, 300, 60),
  A('pool_wins10', 'pool', '🦈', 'POOL SHARK',     'Win 10 games of 8-ball.',                   g => t(g, 'wins') >= 10, 500, 100),
];

/* ─────────────────────────────────────────────────────────
   DAILY QUESTS
   kind: best (single-run stat ≥ target) | sum (stat summed today) | plays
   cross kinds: variety (different games today) | runs | shards
───────────────────────────────────────────────────────── */
const Q = (id, game, kind, stat, target, label, xp, shards) => ({ id, game, kind, stat, target, label, xp, shards });
const QUESTS = [
  Q('q_snk_s30',  'snake', 'best', 'score', 30,  'Score 30+ in Neon Snake', 150, 30),
  Q('q_snk_s70',  'snake', 'best', 'score', 70,  'Score 70+ in Neon Snake', 260, 50),
  Q('q_snk_ap25', 'snake', 'sum',  'apples', 25, 'Eat 25 apples in Snake today', 180, 35),
  Q('q_snk_c4',   'snake', 'best', 'maxCombo', 4, 'Reach a ×4 combo in Snake', 180, 35),
  Q('q_snk_g3',   'snake', 'sum',  'goldens', 3, 'Eat 3 golden apples', 160, 30),
  Q('q_flt_s15',  'flight', 'best', 'score', 15, 'Score 15+ in Neon Flight', 150, 30),
  Q('q_flt_s35',  'flight', 'best', 'score', 35, 'Score 35+ in Neon Flight', 280, 55),
  Q('q_flt_sh30', 'flight', 'sum',  'shards', 30, 'Collect 30 shards in Flight', 180, 0),
  Q('q_flt_p4',   'flight', 'plays', null, 4,    'Play 4 Flight runs', 140, 25),
  Q('q_stk_l20',  'stack', 'sum',  'lines', 20,  'Clear 20 lines in Neon Stack', 180, 35),
  Q('q_stk_l60',  'stack', 'sum',  'lines', 60,  'Clear 60 lines in Neon Stack', 320, 60),
  Q('q_stk_q1',   'stack', 'sum',  'quads', 1,   'Clear a QUAD in Neon Stack', 220, 45),
  Q('q_stk_lv5',  'stack', 'best', 'level', 5,   'Reach level 5 in Stack Marathon', 220, 45),
  Q('q_stk_ts',   'stack', 'sum',  'tspins', 1,  'Land a T-spin clear', 260, 50),
  Q('q_brk_lv3',  'breaker', 'best', 'level', 3,  'Reach level 3 in Neon Breaker', 200, 40),
  Q('q_brk_b150', 'breaker', 'sum',  'bricks', 150, 'Break 150 bricks today', 180, 35),
  Q('q_brk_pw5',  'breaker', 'sum',  'powerups', 5, 'Catch 5 power-ups in Breaker', 160, 30),
  Q('q_brk_s3k',  'breaker', 'best', 'score', 3000, 'Score 3,000+ in Neon Breaker', 220, 45),
  Q('q_drf_w4',   'drift', 'best', 'wave', 4,     'Reach wave 4 in Void Drift', 200, 40),
  Q('q_drf_r60',  'drift', 'sum',  'rocks', 60,   'Destroy 60 asteroids today', 180, 35),
  Q('q_drf_u1',   'drift', 'sum',  'ufos', 1,     'Shoot down a saucer', 220, 45),
  Q('q_drf_s5k',  'drift', 'best', 'score', 5000, 'Score 5,000+ in Void Drift', 240, 45),
  Q('q_dft_d10',  'drifter', 'sum',  'drifts', 8,  'Bank 8 drifts in Neon Drifter', 180, 35),
  Q('q_dft_s15k', 'drifter', 'best', 'score', 8000, 'Score 8,000+ in Neon Drifter', 240, 45),
  Q('q_dft_c3',   'drifter', 'best', 'maxCombo', 3, 'Reach a ×3 drift chain', 200, 40),
  Q('q_typ_w50',  'typer', 'best', 'wpm', 50,      'Hit 50 WPM in a Keystorm test', 220, 45),
  Q('q_typ_100',  'typer', 'sum',  'words', 100,   'Type 100 words in Keystorm', 180, 35),
  Q('q_typ_acc',  'typer', 'best', 'accuracy', 97, 'Finish a test at 97%+ accuracy', 200, 40),
  Q('q_mem_s2',   'memory', 'best', 'stage', 2,    'Clear stage 2 in Mind Match', 180, 35),
  Q('q_mem_p20',  'memory', 'sum',  'pairs', 20,   'Match 20 pairs today', 180, 35),
  Q('q_mem_c3',   'memory', 'best', 'maxCombo', 3, 'Match 3 pairs in a row', 200, 40),
  Q('q_gem_s8k',  'gems', 'best', 'score', 8000,   'Score 8,000+ in Neon Gems', 220, 45),
  Q('q_gem_sp5',  'gems', 'sum',  'specials', 5,   'Set off 5 special gems', 200, 40),
  Q('q_gem_c3',   'gems', 'best', 'maxCascade', 3, 'Trigger a ×3 cascade', 180, 35),
  Q('q_pol_p10',  'pool', 'sum',  'pots', 10,      'Pot 10 balls in Neon Pool', 180, 35),
  Q('q_pol_w1',   'pool', 'sum',  'wins', 1,       'Win a game of 8-ball', 260, 50),
  Q('q_pol_r2',   'pool', 'best', 'maxRun', 2,     'Pot 2 balls in one turn', 180, 35),
  Q('q_x_var3',   'arcade', 'variety', null, 3,   'Play 3 different games today', 220, 50),
  Q('q_x_var5',   'arcade', 'variety', null, 5,   'Play 5 different games today', 450, 100),
  Q('q_x_runs6',  'arcade', 'runs', null, 6,      'Play 6 runs across the arcade', 200, 40),
  Q('q_x_sh150',  'arcade', 'shards', null, 150,  'Earn 150 shards from runs today', 300, 0),
];
const questById = id => QUESTS.find(q => q.id === id);

/* ─────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────── */
function blankGame() { return { plays: 0, best: 0, bests: {}, totals: {}, maxes: {}, mins: {}, flags: {}, timeMs: 0, last: 0 }; }
function defaults() {
  const games = {}; GAMES.forEach(g => games[g.id] = blankGame());
  const equipped = { avatar: 'av_signal', title: 'ti_rookie', theme: 'th_neon' };
  GAMES.forEach(g => { const d = REWARDS.find(r => r.game === g.id && r.unlock.default); if (d) equipped[g.id] = d.id; });
  return {
    v: 3, created: Date.now(),
    profile: { name: '', created: false },
    level: 1, xp: 0, lifetimeXP: 0, shards: 0, shardsEarned: 0,
    streak: 0, bestStreak: 0, lastPlay: '',
    games,
    day: { date: '', runs: 0, shards: 0, games: [], first: [] },
    quests: { date: '', ids: [], progress: [], claimed: [], rerolls: 0 },
    questsClaimed: 0,
    ach: {}, owned: {}, equipped,
    settings: { volume: 0.7, sfx: true, music: true, crt: true, shake: true, reduceMotion: false },
    history: [], seen: {},
  };
}

function merge(base, data) {
  if (!data || typeof data !== 'object') return base;
  Object.keys(data).forEach(k => {
    const v = data[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], v);
    else if (v !== undefined) base[k] = v;
  });
  return base;
}

function migrateLegacy(st) {
  // Bring over v2 hub progress (level, XP, shards, streak, bests)
  try {
    const raw = localStorage.getItem(LEGACY_HUB);
    if (!raw) return false;
    const old = JSON.parse(raw);
    st.level  = Math.max(1, old.level | 0 || 1);
    st.xp     = Math.max(0, old.xp | 0);
    st.shards = Math.max(0, old.shards | 0);
    st.shardsEarned = st.shards;
    st.streak = old.streak | 0; st.bestStreak = st.streak;
    st.lastPlay = '';
    const sn = old.stats?.snake, fl = old.stats?.flight;
    if (sn) { const g = st.games.snake; g.plays = sn.games | 0; g.best = sn.best | 0; g.bests.classic = g.best; g.totals.apples = sn.apples | 0; }
    if (fl) { const g = st.games.flight; g.plays = fl.games | 0; g.best = fl.best | 0; g.bests.normal = g.best; g.totals.shards = fl.shards | 0; }
    st.migrated = true;
    return true;
  } catch (_) { return false; }
}

let S = null;
let storageOK = true;
function load() {
  const st = defaults();
  let raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch (_) { storageOK = false; }
  if (raw) { try { merge(st, JSON.parse(raw)); } catch (_) {} }
  else if (storageOK) { migrateLegacy(st); }
  GAMES.forEach(g => { st.games[g.id] = merge(blankGame(), st.games[g.id]); });
  S = st;
  ensureDay(); ensureQuests();
  return S;
}
function save() {
  if (!S) return;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (_) { storageOK = false; }
}
function state() { return S || load(); }

const listeners = new Set();
function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => { try { fn(S); } catch (e) { console.warn(e); } }); }
global.addEventListener('storage', e => { if (e.key === STORE_KEY) { load(); emit(); applyTheme(); } });

/* ─────────────────────────────────────────────────────────
   DAY / STREAK / QUESTS
───────────────────────────────────────────────────────── */
function ensureDay() {
  const today = dateKey();
  if (S.day.date !== today) S.day = { date: today, runs: 0, shards: 0, games: [], first: [] };
}
function touchStreak() {
  const today = dateKey();
  if (S.lastPlay === today) return false;
  S.streak = S.lastPlay === yesterdayKey() ? S.streak + 1 : 1;
  S.bestStreak = Math.max(S.bestStreak, S.streak);
  S.lastPlay = today;
  return true;
}
function liveStreak() {
  // Streak counts while you've played today or yesterday
  if (!S.lastPlay) return 0;
  return (S.lastPlay === dateKey() || S.lastPlay === yesterdayKey()) ? S.streak : 0;
}

function ensureQuests() {
  const today = dateKey();
  if (S.quests.date === today && S.quests.ids.length === 3) return S.quests;
  const rng = seededRNG(hashStr(today + '|neon'));
  const ids = GAMES.map(g => g.id);
  const g1 = ids[Math.floor(rng() * ids.length)];
  let g2 = g1; while (g2 === g1) g2 = ids[Math.floor(rng() * ids.length)];
  const pick = list => list[Math.floor(rng() * list.length)];
  S.quests = {
    date: today,
    ids: [pick(QUESTS.filter(q => q.game === g1)).id, pick(QUESTS.filter(q => q.game === g2)).id, pick(QUESTS.filter(q => q.game === 'arcade')).id],
    progress: [0, 0, 0], claimed: [false, false, false], rerolls: 0,
  };
  return S.quests;
}
function questList() {
  ensureDay(); ensureQuests();
  return S.quests.ids.map((id, i) => {
    const q = questById(id);
    const p = Math.min(q.target, S.quests.progress[i] || 0);
    return { ...q, index: i, progress: p, done: p >= q.target, claimed: !!S.quests.claimed[i] };
  });
}
function advanceQuests(gameId, stats, shardsEarned) {
  const changes = [];
  S.quests.ids.forEach((id, i) => {
    if (S.quests.claimed[i]) return;
    const q = questById(id); if (!q) return;
    const before = S.quests.progress[i] || 0;
    let val = before;
    if (q.game === gameId) {
      if (q.kind === 'best')  val = Math.max(before, stats[q.stat] || 0);
      if (q.kind === 'sum')   val = before + (stats[q.stat] || 0);
      if (q.kind === 'plays') val = before + 1;
    } else if (q.game === 'arcade') {
      if (q.kind === 'variety') val = S.day.games.length;
      if (q.kind === 'runs')    val = S.day.runs;
      if (q.kind === 'shards')  val = S.day.shards;
    } else return;
    S.quests.progress[i] = val;
    if (val !== before) changes.push({ ...q, index: i, before: Math.min(before, q.target), progress: Math.min(val, q.target), done: val >= q.target, justDone: before < q.target && val >= q.target });
  });
  return changes;
}
function claimQuest(i) {
  const list = questList(); const q = list[i];
  if (!q || q.claimed || !q.done) return null;
  S.quests.claimed[i] = true;
  S.questsClaimed++;
  const lvBefore = S.level;
  grantXP(q.xp); grantShards(q.shards);
  const res = { quest: q, xp: q.xp, shards: q.shards, levelBefore: lvBefore, levelAfter: S.level, newAch: checkAchievements(), unlocked: [] };
  res.unlocked = levelUnlocks(lvBefore, S.level).concat(achUnlocks(res.newAch));
  save(); emit();
  return res;
}
function rerollQuest(i) {
  ensureQuests();
  if (S.quests.rerolls >= 1 || S.quests.claimed[i]) return false;
  const cur = questById(S.quests.ids[i]);
  const taken = new Set(S.quests.ids);
  const pool = QUESTS.filter(q => !taken.has(q.id) && (cur.game === 'arcade' ? q.game === 'arcade' : q.game !== 'arcade'));
  if (!pool.length) return false;
  S.quests.ids[i] = pool[Math.floor(Math.random() * pool.length)].id;
  S.quests.progress[i] = 0;
  S.quests.rerolls++;
  save(); emit();
  return true;
}

/* ─────────────────────────────────────────────────────────
   XP / SHARDS / ACHIEVEMENTS / VAULT
───────────────────────────────────────────────────────── */
function grantXP(n) {
  n = Math.max(0, Math.round(n)); S.xp += n; S.lifetimeXP += n;
  while (S.xp >= xpNeeded(S.level)) { S.xp -= xpNeeded(S.level); S.level++; }
}
function grantShards(n) { n = Math.max(0, Math.round(n)); S.shards += n; S.shardsEarned += n; }

function checkAchievements() {
  const earned = [];
  // loop so achievement XP that levels you up can chain into level achievements
  for (let pass = 0; pass < 4; pass++) {
    let any = false;
    ACHIEVEMENTS.forEach(a => {
      if (S.ach[a.id]) return;
      const g = a.game === 'arcade' ? null : S.games[a.game];
      let ok = false; try { ok = a.check(g, S); } catch (_) {}
      if (!ok) return;
      S.ach[a.id] = Date.now(); earned.push(a); any = true;
      grantXP(a.xp); grantShards(a.shards);
    });
    if (!any) break;
  }
  return earned;
}

function ownedCount(st) { return REWARDS.filter(r => isOwned(r, st)).length; }
function unlockStatus(r, st = S) {
  const u = r.unlock;
  if (u.default) return { ok: true, owned: true };
  if (st.owned[r.id]) return { ok: true, owned: true };
  const lvlOk = !u.level || st.level >= u.level;
  const achOk = !u.ach || !!st.ach[u.ach];
  if (u.cost) {
    if (!lvlOk) return { ok: false, owned: false, reason: `Reach level ${u.level}`, cost: u.cost };
    return { ok: false, owned: false, buyable: true, cost: u.cost, affordable: st.shards >= u.cost, reason: `${fmt(u.cost)} shards` };
  }
  if (lvlOk && achOk) return { ok: true, owned: true };
  if (!lvlOk) return { ok: false, owned: false, reason: `Reach level ${u.level}` };
  const a = ACHIEVEMENTS.find(x => x.id === u.ach);
  return { ok: false, owned: false, reason: a ? `Achievement: ${a.name}` : 'Locked' };
}
function isOwned(r, st = S) { if (typeof r === 'string') r = rewardById(r); return !!r && unlockStatus(r, st).owned; }
function buy(id) {
  const r = rewardById(id); if (!r) return { ok: false };
  const s = unlockStatus(r);
  if (s.owned) return { ok: true, already: true };
  if (!s.buyable) return { ok: false, reason: s.reason };
  if (S.shards < s.cost) return { ok: false, reason: 'Not enough shards' };
  S.shards -= s.cost; S.owned[id] = Date.now();
  const newAch = checkAchievements();
  save(); emit();
  return { ok: true, newAch };
}
function equip(id) {
  const r = rewardById(id); if (!r || !isOwned(r)) return false;
  const slot = r.type === 'skin' ? r.game : r.type;
  S.equipped[slot] = id;
  save(); emit(); if (r.type === 'theme') applyTheme();
  return true;
}
function equipped(slot) {
  const st = state();
  let r = rewardById(st.equipped[slot]);
  if (!r || !isOwned(r)) {
    r = slot === 'avatar' || slot === 'title' || slot === 'theme'
      ? REWARDS.find(x => x.type === slot && x.unlock.default)
      : REWARDS.find(x => x.game === slot && x.unlock.default);
  }
  return r;
}
function levelUnlocks(from, to) {
  if (to <= from) return [];
  return REWARDS.filter(r => r.unlock.level && !r.unlock.cost && r.unlock.level > from && r.unlock.level <= to);
}
function achUnlocks(achs) {
  const ids = new Set(achs.map(a => a.id));
  return REWARDS.filter(r => r.unlock.ach && ids.has(r.unlock.ach) && !r.unlock.cost);
}

/* ─────────────────────────────────────────────────────────
   REPORT A RUN  — the single entry point every game calls
   stats: { score, mode, ...numeric stats, ...boolean flags, timeMs }
───────────────────────────────────────────────────────── */
function reportRun(gameId, stats) {
  state();
  const game = gameById(gameId); if (!game) return null;
  ensureDay(); ensureQuests();
  const g = S.games[gameId];
  const levelBefore = S.level, xpBefore = S.xp;
  const prevBest = g.best;
  const mode = stats.mode || 'normal';
  const prevModeBest = g.bests[mode] || 0;
  const score = Math.max(0, Math.round(stats.score || 0));

  // record
  g.plays++; g.last = Date.now();
  g.best = Math.max(g.best, score);
  g.bests[mode] = Math.max(prevModeBest, score);
  g.timeMs += stats.timeMs || 0;
  Object.entries(stats).forEach(([k, v]) => {
    if (k === 'score' || k === 'mode') return;
    if (typeof v === 'number' && isFinite(v)) {
      g.totals[k] = (g.totals[k] || 0) + v;
      g.maxes[k] = Math.max(g.maxes[k] || 0, v);
      if (/Ms$/.test(k) && v > 0) g.mins[k] = Math.min(g.mins[k] ?? Infinity, v);
    } else if (v === true) g.flags[k] = true;
  });

  // streak + day
  const streakStarted = touchStreak();
  const firstToday = !S.day.first.includes(gameId);
  if (firstToday) S.day.first.push(gameId);
  if (!S.day.games.includes(gameId)) S.day.games.push(gameId);
  S.day.runs++;

  // rewards
  const breakdown = [];
  const baseXP = Math.max(5, Math.round(game.xp(stats)));
  breakdown.push({ label: 'Run', xp: baseXP });
  if (firstToday) breakdown.push({ label: 'First run today', xp: 40 });
  if (score > prevBest && prevBest > 0) breakdown.push({ label: 'New best', xp: 50 });
  const streak = S.streak;
  const sub = breakdown.reduce((n, b) => n + b.xp, 0);
  const streakPct = Math.min(50, Math.max(0, streak - 1) * 5);
  if (streakPct) breakdown.push({ label: `Streak ×${streak} (+${streakPct}%)`, xp: Math.round(sub * streakPct / 100) });
  const runXP = breakdown.reduce((n, b) => n + b.xp, 0);
  const runShards = Math.max(0, Math.round(game.shards(stats)));
  grantXP(runXP); grantShards(runShards);
  S.day.shards += runShards;

  const quests = advanceQuests(gameId, stats, runShards);
  const newAch = checkAchievements();
  const unlocked = levelUnlocks(levelBefore, S.level).concat(achUnlocks(newAch));

  S.history.unshift({ game: gameId, mode, score, xp: runXP, shards: runShards, ts: Date.now() });
  S.history = S.history.slice(0, 40);
  save(); emit();

  return {
    game, score, mode, isBest: score > prevBest, isModeBest: score > prevModeBest && prevModeBest > 0, prevBest, best: g.best, modeBest: g.bests[mode],
    xp: runXP, breakdown, shards: runShards,
    levelBefore, xpBefore, levelAfter: S.level, xpAfter: S.xp,
    quests, newAch, unlocked, streak, streakStarted,
  };
}

/* ─────────────────────────────────────────────────────────
   PROFILE / SAVE CODES
───────────────────────────────────────────────────────── */
function setProfile(p) {
  state();
  if (typeof p.name === 'string') S.profile.name = p.name.replace(/[^\w .\-]/g, '').trim().slice(0, 14).toUpperCase();
  S.profile.created = true;
  save(); emit();
}
function displayName() { const n = state().profile.name; return n || 'PLAYER'; }
function exportSave() {
  const json = JSON.stringify(state());
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `NA3-${hashStr(json).toString(36)}-${b64}`;
}
function importSave(code) {
  try {
    code = String(code).trim();
    const m2 = code.match(/^NA3-([a-z0-9]+)-(.+)$/s);
    if (!m2) return { ok: false, reason: 'That is not a Neon Arcade save code.' };
    const json = decodeURIComponent(escape(atob(m2[2].replace(/\s/g, ''))));
    if (hashStr(json).toString(36) !== m2[1]) return { ok: false, reason: 'Save code is damaged or incomplete.' };
    const data = JSON.parse(json);
    if (data.v !== 3) return { ok: false, reason: 'Unsupported save version.' };
    const st = merge(defaults(), data);
    GAMES.forEach(g => { st.games[g.id] = merge(blankGame(), st.games[g.id]); });
    S = st; ensureDay(); ensureQuests(); save(); emit(); applyTheme();
    return { ok: true };
  } catch (_) { return { ok: false, reason: 'Could not read that save code.' }; }
}
function resetAll() {
  try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(LEGACY_HUB); } catch (_) {}
  S = defaults(); ensureDay(); ensureQuests(); save(); emit(); applyTheme();
}

/* ─────────────────────────────────────────────────────────
   SETTINGS + THEME
───────────────────────────────────────────────────────── */
function settings() { return state().settings; }
function setSetting(k, v) {
  state().settings[k] = v; save(); emit();
  if (k === 'volume' || k === 'sfx' || k === 'music') Audio.refresh();
  applyBodyFlags();
}
function applyTheme() {
  const r = equipped('theme'); if (!r || !global.document) return;
  const root = document.documentElement;
  root.style.setProperty('--a1', r.data.a1);
  root.style.setProperty('--a2', r.data.a2);
  applyBodyFlags();
}
function applyBodyFlags() {
  if (!global.document || !document.body) return;
  const s = settings();
  document.body.classList.toggle('crt-on', !!s.crt);
  document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
}

/* volume slider markup + behaviour, shared by hub and game menus */
function volumeRow() {
  const v = Math.round(settings().volume * 100);
  return `<div class="na-vol"><span>Volume</span><input class="na-range" type="range" min="0" max="100" step="1" value="${v}" style="--p:${v}%" data-set="volume" aria-label="Volume"><b>${v}%</b></div>`;
}
function bindVolume(root) {
  let lastBlip = 0;
  root.addEventListener('input', e => {
    const r = e.target; if (r.dataset.set !== 'volume') return;
    const v = Math.max(0, Math.min(100, parseInt(r.value, 10) || 0));
    r.style.setProperty('--p', v + '%');
    const lbl = r.parentElement.querySelector('b'); if (lbl) lbl.textContent = v + '%';
    setSetting('volume', v / 100);
    const now = performance.now();
    if (now - lastBlip > 90 && settings().sfx) { lastBlip = now; Audio.ctx(); Audio.tone(660, 0.07, 'square', 0.14); }
  });
}

/* ─────────────────────────────────────────────────────────
   AUDIO — synth SFX + tiny chiptune sequencer
───────────────────────────────────────────────────────── */
const Audio = (() => {
  let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  function ctx() {
    if (!ac) {
      const AC = global.AudioContext || global.webkitAudioContext; if (!AC) return null;
      ac = new AC();
      master = ac.createGain(); master.connect(ac.destination);
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      comp.connect(master);
      sfxBus = ac.createGain(); sfxBus.connect(comp);
      musicBus = ac.createGain(); musicBus.connect(comp);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      refresh();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function refresh() {
    if (!ac) return;
    const s = settings();
    // perceptual curve: the slider feels linear to the ear
    master.gain.setTargetAtTime(Math.pow(Math.max(0, Math.min(1, s.volume)), 1.7), ac.currentTime, 0.015);
    sfxBus.gain.value = s.sfx ? 0.55 : 0;
    musicBus.gain.value = s.music ? 0.16 : 0;
  }
  function tone(freq, dur = 0.1, type = 'sine', gain = 0.3, bend = null, delay = 0, bus = null) {
    const a = ctx(); if (!a || !settings().sfx && !bus) return;
    const t0 = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, bend), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur = 0.15, gain = 0.25, freq = 1200, q = 1, delay = 0, type = 'bandpass', bus = null) {
    const a = ctx(); if (!a || !settings().sfx && !bus) return;
    const t0 = a.currentTime + delay;
    const src = a.createBufferSource(); src.buffer = noiseBuf;
    const fl = a.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = q;
    const g = a.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl); fl.connect(g); g.connect(bus || sfxBus);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
  }
  const arp = (notes, step = 0.07, type = 'square', gain = 0.16, dur = 0.12) => notes.forEach((n, i) => tone(n, dur, type, gain, null, i * step));
  const SFX = {
    click:   () => tone(880, 0.05, 'square', 0.08),
    hover:   () => tone(1320, 0.03, 'sine', 0.04),
    select:  () => { tone(660, 0.06, 'square', 0.1); tone(990, 0.08, 'square', 0.08, null, 0.05); },
    back:    () => { tone(660, 0.06, 'square', 0.08); tone(440, 0.08, 'square', 0.07, null, 0.05); },
    start:   () => arp([392, 523, 659, 784], 0.06, 'square', 0.12),
    pause:   () => arp([784, 523], 0.06, 'triangle', 0.14),
    coin:    () => { tone(988, 0.06, 'square', 0.12); tone(1319, 0.18, 'square', 0.12, null, 0.06); },
    power:   () => arp([523, 659, 784, 1047, 1319], 0.045, 'triangle', 0.16, 0.1),
    hit:     () => { tone(220, 0.08, 'square', 0.12, 110); noise(0.06, 0.12, 900); },
    explode: () => { noise(0.45, 0.4, 400, 0.7, 0, 'lowpass'); tone(120, 0.35, 'sawtooth', 0.16, 40); },
    small:   () => { noise(0.12, 0.2, 1600, 1.2); },
    levelup: () => arp([523, 659, 784, 1047, 784, 1047, 1319], 0.08, 'square', 0.13, 0.16),
    unlock:  () => { arp([659, 880, 1175], 0.08, 'triangle', 0.18, 0.2); tone(1760, 0.4, 'sine', 0.08, null, 0.25); },
    achieve: () => { arp([784, 988, 1175, 1568], 0.07, 'square', 0.12, 0.14); },
    error:   () => { tone(180, 0.18, 'square', 0.12); tone(140, 0.22, 'square', 0.12, null, 0.12); },
    gameover:() => arp([392, 330, 262, 196], 0.13, 'sawtooth', 0.12, 0.22),
    combo:   n => tone(440 * Math.pow(2, Math.min(n, 16) / 12), 0.09, 'square', 0.12),
  };
  function sfx(name, arg) { try { SFX[name] && SFX[name](arg); } catch (_) {} }

  /* ── Music sequencer ── */
  const N = s => { // 'A3' -> freq
    if (!s) return null;
    const m3 = s.match(/^([A-G])(#|b)?(\d)$/); if (!m3) return null;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m3[1]] + (m3[2] === '#' ? 1 : m3[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (base + (parseInt(m3[3]) + 1) * 12 - 69) / 12);
  };
  const seq = str => str.split(/\s+/).filter(Boolean).map(x => x === '.' ? null : N(x));
  const TRACKS = {
    hub:     { bpm: 96,  bass: seq('A2 . . A2 . . A2 . F2 . . F2 . . F2 . C3 . . C3 . . C3 . G2 . . G2 . . E2 .'), lead: seq('E4 . A4 . C5 . A4 . F4 . A4 . C5 . A4 . G4 . C5 . E5 . C5 . D5 . B4 . G4 . E4 .'), wave: 'triangle' },
    snake:   { bpm: 128, bass: seq('E2 . E3 . E2 . E3 . G2 . G3 . A2 . A3 . C3 . C3 . B2 . B3 . A2 . G2 . F#2 . D3 .'), lead: seq('E5 . G5 . B5 . G5 . E5 . . . D5 . E5 . G5 . A5 . . . G5 . E5 . D5 . B4 . . . A4 . B4 . D5 . E5 .'), wave: 'square' },
    flight:  { bpm: 140, bass: seq('D2 . D3 D2 . D3 D2 . Bb1 . Bb2 Bb1 . Bb2 Bb1 . C2 . C3 C2 . C3 C2 . A1 . A2 A1 . A2 C3 .'), lead: seq('A4 . D5 . F5 . A5 . G5 . F5 . D5 . . . F5 . E5 . C5 . E5 . G5 . F5 . E5 . C#5 . A4 .'), wave: 'square' },
    stack:   { bpm: 136, bass: seq('A2 . E3 . A2 . E3 . G#2 . E3 . G#2 . E3 . A2 . E3 . A2 . E3 . B2 . E3 . G#2 . E3 .'), lead: seq('E5 . . B4 C5 . D5 . . C5 B4 . A4 . . A4 C5 . E5 . . D5 C5 . B4 . . C5 D5 . E5 .'), wave: 'square' },
    breaker: { bpm: 124, bass: seq('C2 . C3 . C2 . C3 . Eb2 . Eb3 . Eb2 . Eb3 . F2 . F3 . F2 . F3 . G2 . G3 . Bb2 . B2 .'), lead: seq('G4 . C5 . Eb5 . G5 . F5 . Eb5 . C5 . . . Bb4 . C5 . Eb5 . F5 . G5 . F5 . D5 . B4 .'), wave: 'triangle' },
    drift:   { bpm: 112, bass: seq('B1 . . B1 . . B1 . G1 . . G1 . . G1 . D2 . . D2 . . D2 . A1 . . A1 . . C#2 .'), lead: seq('F#4 . B4 . D5 . F#5 . . . E5 . D5 . B4 . . . A4 . D5 . F#5 . A5 . . . G5 . F#5 . E5 . C#5 .'), wave: 'sawtooth' },
    drifter: { bpm: 150, bass: seq('E2 E2 E3 E2 E2 E3 E2 E3 D2 D2 D3 D2 D2 D3 D2 D3 C2 C2 C3 C2 C2 C3 C2 C3 D2 D2 D3 D2 B1 B2 D2 D3'), lead: seq('B4 . E5 . G5 . B5 . A5 . G5 . F#5 . D5 . E5 . G5 . A5 . . . G5 . F#5 . D5 . . . E5 .'), wave: 'sawtooth' },
    typer:   { bpm: 118, bass: seq('F2 . . F2 . F3 . . Ab2 . . Ab2 . Ab3 . . Db2 . . Db2 . Db3 . . Eb2 . . Eb2 . Eb3 . .'), lead: seq('C5 . . . Ab4 . . . F4 . . . Ab4 . C5 . Db5 . . . C5 . . . Ab4 . . . Bb4 . G4 .'), wave: 'triangle' },
    memory:  { bpm: 100, bass: seq('D2 . A2 . D3 . A2 . Bb1 . F2 . Bb2 . F2 . G1 . D2 . G2 . D2 . A1 . E2 . A2 . C#3 .'), lead: seq('F5 . E5 . D5 . A4 . . . Bb4 . A4 . G4 . D5 . . . C5 . Bb4 . A4 . E4 . F4 . G4 . A4 .'), wave: 'triangle' },
    gems:    { bpm: 126, bass: seq('C3 . G2 . C3 . G2 . A2 . E2 . A2 . E2 . F2 . C3 . F2 . C3 . G2 . D3 . G2 . B2 .'), lead: seq('E5 G5 C6 . G5 E5 . . C5 E5 A5 . E5 C5 . . A4 C5 F5 . C5 A4 . . B4 D5 G5 . D5 B4 . .'), wave: 'square' },
    pool:    { bpm: 92,  bass: seq('A1 . . . C2 . . . D2 . . . E2 . G2 . A1 . . . C2 . . . D2 . . . Eb2 . E2 .'), lead: seq('. . E4 G4 A4 . . . . . C5 . A4 . G4 . . . E4 G4 A4 . . . D5 . C5 . A4 . . .'), wave: 'triangle' },
  };
  let musicTimer = null, track = null, step = 0, nextTime = 0, musicPaused = false;
  function schedule() {
    if (!ac || !track || musicPaused) return;
    const stepDur = 60 / track.bpm / 4;
    while (nextTime < ac.currentTime + 0.12) {
      const b = track.bass[step % track.bass.length];
      const l = track.lead[step % track.lead.length];
      const delay = Math.max(0, nextTime - ac.currentTime);
      if (b) tone(b, stepDur * 1.8, 'square', 0.22, null, delay, musicBus);
      if (l) tone(l, stepDur * 1.6, track.wave, 0.13, null, delay, musicBus);
      if (step % 4 === 2) noise(0.03, 0.06, 7000, 1, delay, 'highpass', musicBus);
      if (step % 8 === 0) tone(110, 0.08, 'sine', 0.3, 45, delay, musicBus);
      nextTime += stepDur; step++;
    }
  }
  function playMusic(name) {
    const a = ctx(); if (!a) return;
    if (track === TRACKS[name] && musicTimer) { musicPaused = false; return; }
    stopMusic();
    track = TRACKS[name] || TRACKS.hub; step = 0; nextTime = a.currentTime + 0.05; musicPaused = false;
    musicTimer = setInterval(schedule, 30);
  }
  function stopMusic() { clearInterval(musicTimer); musicTimer = null; track = null; }
  function pauseMusic(p) { musicPaused = p; if (!p && ac) nextTime = ac.currentTime + 0.05; }
  return { ctx, tone, noise, sfx, refresh, playMusic, stopMusic, pauseMusic, arp };
})();

/* ─────────────────────────────────────────────────────────
   GFX HELPERS — cached glow sprites + additive particles
   (canvas shadowBlur is the #1 cause of stutter, so glows
    are rendered once into offscreen canvases and reused)
───────────────────────────────────────────────────────── */
const spriteCache = new Map();
function sprite(key, w, h, draw) {
  let c = spriteCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  draw(c.getContext('2d'), c.width, c.height);
  spriteCache.set(key, c);
  return c;
}
function glowDot(color, r = 16) {
  return sprite(`dot|${color}|${r}`, r * 2, r * 2, (g, w) => {
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.18, color);
    gr.addColorStop(0.45, hexA(color, 0.35)); gr.addColorStop(1, hexA(color, 0));
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}
function softGlow(color, r = 32) {
  return sprite(`glow|${color}|${r}`, r * 2, r * 2, (g, w) => {
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, hexA(color, 0.55)); gr.addColorStop(0.5, hexA(color, 0.16)); gr.addColorStop(1, hexA(color, 0));
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}
function hexA(hex, a) {
  if (hex.startsWith('hsl')) return hex.replace('hsl(', 'hsla(').replace(')', `,${a})`);
  let h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = (pa >> 16 & 255) + ((pb >> 16 & 255) - (pa >> 16 & 255)) * t;
  const g = (pa >> 8 & 255) + ((pb >> 8 & 255) - (pa >> 8 & 255)) * t;
  const bl = (pa & 255) + ((pb & 255) - (pa & 255)) * t;
  return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl)).toString(16).slice(1);
}

class Particles {
  constructor(max = 600) { this.p = []; this.max = max; }
  emit(x, y, o = {}) {
    const n = o.n || 12;
    for (let i = 0; i < n; i++) {
      if (this.p.length >= this.max) this.p.shift();
      const a = o.angle != null ? o.angle + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2) : Math.random() * Math.PI * 2;
      const sp = (o.speed || 160) * (0.35 + Math.random() * 0.75);
      const life = (o.life || 0.6) * (0.6 + Math.random() * 0.6);
      this.p.push({ x, y, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp + (o.vy || 0), life, max: life, size: (o.size || 3) * (0.6 + Math.random() * 0.8), color: Array.isArray(o.color) ? o.color[i % o.color.length] : (o.color || '#ffffff'), g: o.gravity || 0, drag: o.drag ?? 1.8, shape: o.shape || 'dot' });
    }
  }
  update(dt) {
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i];
      q.life -= dt; if (q.life <= 0) { this.p.splice(i, 1); continue; }
      const d = Math.exp(-q.drag * dt);
      q.vx *= d; q.vy = q.vy * d + q.g * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
  }
  draw(c) {
    if (!this.p.length) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const q of this.p) {
      const k = q.life / q.max;
      c.globalAlpha = Math.min(1, k * 1.4);
      if (q.shape === 'line') {
        c.strokeStyle = q.color; c.lineWidth = q.size * 0.5;
        c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04); c.stroke();
      } else {
        const s = q.size * (0.5 + k) * 3;
        c.drawImage(glowDot(q.color, 16), q.x - s, q.y - s, s * 2, s * 2);
      }
    }
    c.restore();
  }
  clear() { this.p.length = 0; }
}

/* floating score text */
class Floaters {
  constructor() { this.list = []; }
  add(x, y, text, color = '#fff', size = 18, life = 0.9) { this.list.push({ x, y, text, color, size, life, max: life }); if (this.list.length > 40) this.list.shift(); }
  update(dt) { for (let i = this.list.length - 1; i >= 0; i--) { const f2 = this.list[i]; f2.life -= dt; f2.y -= 42 * dt; if (f2.life <= 0) this.list.splice(i, 1); } }
  draw(c) {
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const f2 of this.list) {
      const k = f2.life / f2.max;
      c.globalAlpha = Math.min(1, k * 2);
      const s = f2.size * (1 + (1 - k) * 0.15);
      c.font = `900 ${s}px Orbitron, monospace`;
      c.fillStyle = hexA(f2.color.startsWith('#') ? f2.color : '#ffffff', 0.35);
      c.fillText(f2.text, f2.x, f2.y + 2);
      c.fillStyle = f2.color; c.fillText(f2.text, f2.x, f2.y);
    }
    c.restore();
  }
  clear() { this.list.length = 0; }
}

/* ─────────────────────────────────────────────────────────
   UI — toasts + level-up overlay (works on any page)
───────────────────────────────────────────────────────── */
const UI = (() => {
  let stack = null, queue = [], showing = 0;
  function host() {
    if (!stack) { stack = document.createElement('div'); stack.className = 'na-toasts'; stack.setAttribute('aria-live', 'polite'); document.body.appendChild(stack); }
    return stack;
  }
  function toast(icon, title, sub = '', color = 'var(--a1)', ms = 3400) {
    queue.push({ icon, title, sub, color, ms }); pump();
  }
  function pump() {
    if (showing >= 3 || !queue.length) return;
    const tq = queue.shift(); showing++;
    const el = document.createElement('div');
    el.className = 'na-toast';
    el.style.setProperty('--tc', tq.color);
    el.innerHTML = `<div class="na-toast-ic">${tq.icon}</div><div><div class="na-toast-t">${esc(tq.title)}</div>${tq.sub ? `<div class="na-toast-s">${esc(tq.sub)}</div>` : ''}</div>`;
    host().appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => { el.remove(); showing--; pump(); }, 350); }, tq.ms);
  }
  function levelUp(lv, unlocked = []) {
    const tr = tier(lv);
    const el = document.createElement('div');
    el.className = 'na-levelup';
    el.innerHTML = `<div class="na-lu-inner" style="--tc:${tr.color}">
      <div class="na-lu-sup">LEVEL UP</div>
      <div class="na-lu-num">${lv}</div>
      <div class="na-lu-tier">${tr.icon} ${tr.name}</div>
      ${unlocked.length ? `<div class="na-lu-unl">${unlocked.slice(0, 4).map(r => `<span>${rewardIcon(r)} ${esc(r.name)}</span>`).join('')}</div>` : ''}
    </div>`;
    document.body.appendChild(el);
    Audio.sfx('levelup');
    requestAnimationFrame(() => el.classList.add('in'));
    const close = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); };
    el.addEventListener('click', close);
    setTimeout(close, 2800);
  }
  return { toast, levelUp };
})();

function rewardIcon(r) {
  if (r.type === 'avatar') return r.data.glyph;
  if (r.type === 'title') return '🏷️';
  if (r.type === 'theme') return '🎨';
  return gameById(r.game)?.icon || '🎁';
}
function rewardSwatch(r) {
  const d = r.data;
  if (r.type === 'theme') return [d.a1, d.a2];
  if (r.game === 'snake') return [d.body, d.head];
  if (r.game === 'flight') return [d.body, d.trail];
  if (r.game === 'stack') return d.pieces.slice(0, 4);
  if (r.game === 'breaker') return [d.paddle, d.ball];
  if (r.game === 'drift') return [d.ship, d.flame];
  if (r.game === 'drifter') return [d.body, d.stripe, d.trail];
  if (r.game === 'typer') return [d.c1, d.c2];
  if (r.game === 'memory') return [d.back, '#05051a', d.glow];
  if (r.game === 'gems') return d.gems.slice(0, 5);
  if (r.game === 'pool') return [d.felt, d.line, d.cue];
  return [];
}

/* ─────────────────────────────────────────────────────────
   PUBLIC API
───────────────────────────────────────────────────────── */
global.Arcade = {
  VERSION, GAMES, TIERS, REWARDS, ACHIEVEMENTS, QUESTS,
  load, save, state, onChange, gameById, rewardById, tier, xpNeeded,
  reportRun, questList, claimQuest, rerollQuest,
  unlockStatus, isOwned, buy, equip, equipped, rewardIcon, rewardSwatch, ownedCount: () => ownedCount(state()),
  setProfile, displayName, exportSave, importSave, resetAll, liveStreak: () => { state(); return liveStreak(); },
  settings, setSetting, applyTheme, volumeRow, bindVolume,
  storageOK: () => storageOK,
  audio: Audio, ui: UI,
  gfx: { sprite, glowDot, softGlow, hexA, mixHex, Particles, Floaters },
  util: { clamp, fmt, fmtTime, esc, dateKey, seededRNG },
};

load();
if (global.document) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyTheme); else applyTheme();
}
})(window);
