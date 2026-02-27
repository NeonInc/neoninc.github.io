/* ============================================================
   NEON FLIGHT™  ·  game.js  ·  Neon Inc™ v3.0
   © 2026 Neon Inc™. All rights reserved.
   ============================================================ */
'use strict';

/* ─────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────── */
const C = {
  GRAVITY:1640, JUMP_VELOCITY:-590,
  PILLAR_WIDTH:62, PLAYER_RADIUS:18, PLAYER_X_RATIO:0.22,
  SHARD_RADIUS:10, SHARD_CHANCE:0.55, SHARD_VALUE:10,
  COMBO_WINDOW:2800,
  BLINK_INTERVAL:3200, BLINK_DURATION:140,
  SQUASH_JUMP:0.72, SQUASH_FALL:1.18,
  BOB_AMP:3.0, BOB_FREQ:1.6,
  SHAKE_FRAMES:14, SHAKE_AMP:9,
  ZOOM_MAX:1.045, POPUP_DUR:1200,
  PILLAR_OVERHANG:240,
};

/* ─────────────────────────────────────────────────────────
   EVENT BUS  (decoupled, event-driven communication)
───────────────────────────────────────────────────────── */
const Events = (() => {
  const map = {};
  return {
    on(name, cb)   { (map[name] = map[name]||[]).push(cb); },
    off(name, cb)  { if(map[name]) map[name]=map[name].filter(f=>f!==cb); },
    emit(name, d)  { (map[name]||[]).slice().forEach(cb=>{ try{cb(d);}catch(e){console.warn('[Events]',e);} }); },
    clear(name)    { delete map[name]; },
  };
})();

/* ─────────────────────────────────────────────────────────
   DIFFICULTY MANAGER
───────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────
   SMOOTH DIFFICULTY  —  no stage-boundary speed jumps
   Speed: 265 → 500  (plateaus ~score 120)
   Gap:   230 → 155  (floors ~score 100)
   Rate:  2.0 → 1.35 (floors ~score 80)
   Named milestones are cosmetic banners only.
───────────────────────────────────────────────────────── */
const MILESTONES = [
  { score:0,   name:'CYBER ENTRY'  },
  { score:15,  name:'GRID BREAK'   },
  { score:30,  name:'NEON CORE'    },
  { score:50,  name:'STATIC STORM' },
  { score:75,  name:'VOID PHASE'   },
  { score:100, name:'LEGENDARY'    },
];

const DifficultyManager = (() => {
  let curMilestone = MILESTONES[0];

  function getSpeed(score){
    // Smooth power curve — zero jumps, caps at 500 around score 120
    const t = Math.min(score, 120) / 120;
    const eased = 1 - Math.pow(1 - t, 2.4);
    return Math.round(265 + 235 * eased);
  }
  function getGap(score){
    // 230px → 155px floor, smooth ease-in
    const t = Math.min(score, 100) / 100;
    const eased = 1 - Math.pow(1 - t, 1.6);
    return Math.max(155, Math.round(230 - 75 * eased));
  }
  function getInterval(score){
    // 2.0s → 1.35s floor
    const t = Math.min(score, 80) / 80;
    return Math.max(1.35, 2.0 - 0.65 * t);
  }
  function milestoneFor(score){
    let m = MILESTONES[0];
    MILESTONES.forEach(ms => { if(score >= ms.score) m = ms; });
    return m;
  }
  function update(score){
    const m = milestoneFor(score);
    if(m.score !== curMilestone.score){ curMilestone = m; return true; }
    return false;
  }
  function syncTo(score){ curMilestone = milestoneFor(score); }
  function getStageName(score){ return milestoneFor(score).name; }
  function getDiffMult(score){ return getSpeed(score) / 310; }
  function reset(){ curMilestone = MILESTONES[0]; }
  return {
    update, syncTo, getSpeed, getGap,
    getInterval, // now takes score arg
    getStageName, getDiffMult, reset,
    get current(){ return curMilestone; },
  };
})();

/* ─────────────────────────────────────────────────────────
   SAVE / DATA
───────────────────────────────────────────────────────── */
const ECOSYSTEM_KEY = 'neonArcade_playerData';
function loadData(){
  try{
    const raw=localStorage.getItem(ECOSYSTEM_KEY);
    if(raw){
      const d=JSON.parse(raw);
      if(!d.totalShards)       d.totalShards=0;
      if(!d.highScores)        d.highScores={};
      if(!d.highScores.flight) d.highScores.flight=0;
      d.flight=Object.assign({
        activeSkin:'neon-orb',bodyColor:'#00f0ff',eyeColor:'#ffffff',
        eyeStyle:'normal',customEye:false,trailColor:'#00f0ff',trailShape:'dot',
        background:'grid',particles:true,trailDensity:2,sound:true,
        shake:true,lightMode:false,
        unlockedBgs:['grid'],unlockedSkins:['neon-orb'],unlockedEyes:['normal'],
        achievements:[],gamesPlayed:0,totalScore:0,maxCombo:1,
        realmsEntered:[],survivedGlitch:false,bgsSeen:['grid'],
      }, d.flight||{});
      return d;
    }
  }catch(_){}
  return {
    totalShards:0,totalCurrency:0,playerLevel:1,
    highScores:{flight:0},
    flight:{
      activeSkin:'neon-orb',bodyColor:'#00f0ff',eyeColor:'#ffffff',
      eyeStyle:'normal',customEye:false,trailColor:'#00f0ff',trailShape:'dot',
      background:'grid',particles:true,trailDensity:2,sound:true,
      shake:true,lightMode:false,
      unlockedBgs:['grid'],unlockedSkins:['neon-orb'],unlockedEyes:['normal'],
      achievements:[],gamesPlayed:0,totalScore:0,maxCombo:1,
      realmsEntered:[],survivedGlitch:false,bgsSeen:['grid'],
    },
  };
}
function save(){ try{ localStorage.setItem(ECOSYSTEM_KEY,JSON.stringify(PD)); }catch(_){} }
function updateGlobalLevel(){ PD.playerLevel=1+Math.floor(PD.totalShards/200); save(); }
let PD=loadData(), FD=PD.flight;

/* ─────────────────────────────────────────────────────────
   SKIN / BG / EYE CATALOGS
───────────────────────────────────────────────────────── */
const SKINS = [
  { id:'neon-orb',     label:'NEON ORB',     bodyColor:'#00f0ff', eyeColor:'#ffffff', eyeStyle:'normal', trailColor:'#00f0ff', trailShape:'dot',      req:null },
  { id:'cyber-cube',   label:'CYBER CUBE',   bodyColor:'#ff00ff', eyeColor:'#00ffff', eyeStyle:'cyber',  trailColor:'#ff00ff', trailShape:'spark',     req:{type:'score',val:15},   reqLabel:'Score 15' },
  { id:'plasma-core',  label:'PLASMA CORE',  bodyColor:'#ff4400', eyeColor:'#ffcc00', eyeStyle:'angry',  trailColor:'#ff6600', trailShape:'triangle',  req:{type:'score',val:30},   reqLabel:'Score 30' },
  { id:'pixel-buddy',  label:'PIXEL BUDDY',  bodyColor:'#00ff88', eyeColor:'#ffffff', eyeStyle:'pixel',  trailColor:'#00ff44', trailShape:'dot',       req:{type:'shards',val:100}, reqLabel:'100 💎' },
  { id:'ghost-pulse',  label:'GHOST PULSE',  bodyColor:'#8866ff', eyeColor:'#ddbbff', eyeStyle:'happy',  trailColor:'#aa88ff', trailShape:'spark',     req:{type:'shards',val:250}, reqLabel:'250 💎' },
  { id:'synth-sprite', label:'SYNTH SPRITE', bodyColor:'#ffcc00', eyeColor:'#ff8800', eyeStyle:'cyber',  trailColor:'#ffaa00', trailShape:'triangle',  req:{type:'score',val:50},   reqLabel:'Score 50' },
];

const BACKGROUNDS = [
  { id:'grid',     label:'CYBER GRID',      req:null },
  { id:'city',     label:'NEON SKYLINE',    req:{type:'score',val:5},    reqLabel:'Score 5' },
  { id:'starfield',label:'STARFIELD',       req:{type:'score',val:20},   reqLabel:'Score 20' },
  { id:'vaporwave',label:'VAPORWAVE',       req:{type:'shards',val:100}, reqLabel:'100 💎' },
  { id:'void',     label:'VOID PULSE',      req:{type:'shards',val:250}, reqLabel:'250 💎' },
  { id:'matrix',   label:'DATA MATRIX',     req:{type:'score',val:40},   reqLabel:'Score 40' },
  { id:'aurora',   label:'AURORA',          req:{type:'score',val:30},   reqLabel:'Score 30' },
  { id:'neonrain', label:'NEON RAIN',       req:{type:'shards',val:150}, reqLabel:'150 💎' },
  { id:'neural',   label:'NEURAL NETWORK',  req:{type:'score',val:60},   reqLabel:'Score 60' },
  { id:'hell',     label:'HELL REALM',      req:{type:'realm',val:'hell'},   reqLabel:'Enter Hell Realm' },
  { id:'heaven',   label:'HEAVEN REALM',    req:{type:'realm',val:'heaven'}, reqLabel:'Enter Heaven Realm' },
];

// Pillar styles per background — theme-driven visuals
const PILLAR_STYLES = {
  grid:      { base:'#00f0ff', glow:'#00f0ff', accent:'#ff00ff', edge:.55 },
  city:      { base:'#ff00ff', glow:'#ff00cc', accent:'#00ffff', edge:.50 },
  starfield: { base:'#aaddff', glow:'#aaddff', accent:'#ffffff', edge:.40 },
  vaporwave: { base:'#ff44cc', glow:'#ff00ff', accent:'#ffee44', edge:.55 },
  void:      { base:'#aa00ff', glow:'#ff00ff', accent:'#00ffff', edge:.45 },
  matrix:    { base:'#00ff44', glow:'#00dd33', accent:'#88ffaa', edge:.60 },
  aurora:    { base:'#00ff88', glow:'#00ccff', accent:'#cc00ff', edge:.50 },
  neonrain:  { base:'#00ccff', glow:'#ff00cc', accent:'#ffffff', edge:.50 },
  neural:    { base:'#ff8800', glow:'#ffaa00', accent:'#ffffff', edge:.50 },
  hell:      { base:'#ff2200', glow:'#ff4400', accent:'#ff8800', edge:.60 },
  heaven:    { base:'#88eeff', glow:'#ffffff', accent:'#ffffaa', edge:.50 },
};

const EYE_STYLES = [
  { id:'normal',  label:'NORMAL',    icon:'👀', desc:'Classic',              req:null },
  { id:'happy',   label:'HAPPY',     icon:'😊', desc:'Cheerful arcs',        req:{type:'ach',val:'first_flight'} },
  { id:'googly',  label:'GOOGLY',    icon:'🫠', desc:'Physics-based wobbly', req:{type:'ach',val:'speed_demon'} },
  { id:'sleepy',  label:'SLEEPY',    icon:'😴', desc:'Heavy-lidded',         req:{type:'ach',val:'hoarder'} },
  { id:'stars',   label:'STAR EYES', icon:'🌟', desc:'Sparkling irises',     req:{type:'ach',val:'on_fire'} },
  { id:'wink',    label:'WINK',      icon:'😉', desc:'One-eye-closed',       req:{type:'ach',val:'combo_king'} },
  { id:'dizzy',   label:'DIZZY',     icon:'😵', desc:'Spinning spirals',     req:{type:'ach',val:'glitch_hunter'} },
  { id:'heart',   label:'HEART',     icon:'❤️',  desc:'Heart-shaped pupils',  req:{type:'ach',val:'veteran'} },
  { id:'big',     label:'BIG EYES',  icon:'😳', desc:'Wide & surprised',     req:{type:'ach',val:'supersonic'} },
  { id:'angry',   label:'ANGRY',     icon:'😠', desc:'Furrowed brows',       req:{type:'score',val:20}, reqLabel:'Score 20' },
  { id:'pixel',   label:'PIXEL',     icon:'🎮', desc:'8-bit pixels',         req:{type:'score',val:30}, reqLabel:'Score 30' },
  { id:'cyber',   label:'CYBER',     icon:'🤖', desc:'HUD visor',            req:{type:'shards',val:200}, reqLabel:'200 💎' },
];

const ACHIEVEMENTS = [
  { id:'first_flight',  icon:'🕊', name:'FIRST FLIGHT',   desc:'Play your first game',            check:(fd,pd)=>fd.gamesPlayed>=1,                     unlock:{type:'eye', id:'happy'} },
  { id:'speed_demon',   icon:'💨', name:'SPEED DEMON',    desc:'Reach Stage 3 (score 25)',         check:(fd,pd)=>pd.highScores.flight>=25,               unlock:{type:'eye', id:'googly'} },
  { id:'on_fire',       icon:'🔥', name:'ON FIRE',        desc:'Score 25+ in a run',              check:(fd,pd)=>pd.highScores.flight>=25,               unlock:{type:'eye', id:'stars'} },
  { id:'supersonic',    icon:'⚡', name:'SUPERSONIC',     desc:'Score 50+ in a run',              check:(fd,pd)=>pd.highScores.flight>=50,               unlock:{type:'eye', id:'big'} },
  { id:'combo_king',    icon:'💫', name:'COMBO KING',     desc:'Reach a ×4 combo',               check:(fd,pd)=>fd.maxCombo>=4,                         unlock:{type:'eye', id:'wink'} },
  { id:'hoarder',       icon:'💎', name:'HOARDER',        desc:'Collect 100 total shards',         check:(fd,pd)=>pd.totalShards>=100,                    unlock:{type:'eye', id:'sleepy'} },
  { id:'loaded',        icon:'💰', name:'LOADED',         desc:'Collect 300 total shards',         check:(fd,pd)=>pd.totalShards>=300,                    unlock:{type:'bg',  id:'vaporwave'} },
  { id:'glitch_hunter', icon:'⚡', name:'GLITCH HUNTER',  desc:'Survive the Score-42 event',      check:(fd,pd)=>fd.survivedGlitch,                      unlock:{type:'eye', id:'dizzy'} },
  { id:'veteran',       icon:'🎖', name:'VETERAN',        desc:'Play 10 games',                   check:(fd,pd)=>fd.gamesPlayed>=10,                     unlock:{type:'eye', id:'heart'} },
  { id:'hell_diver',    icon:'🔥', name:'HELL DIVER',     desc:'Enter Hell Realm',                check:(fd,pd)=>(fd.realmsEntered||[]).includes('hell'),   unlock:{type:'bg', id:'hell'} },
  { id:'ascended',      icon:'✨', name:'ASCENDED',       desc:'Enter Heaven Realm',              check:(fd,pd)=>(fd.realmsEntered||[]).includes('heaven'), unlock:{type:'bg', id:'heaven'} },
  { id:'world_traveler',icon:'🌍', name:'WORLD TRAVELER', desc:'Play on 5 different backgrounds',  check:(fd,pd)=>(fd.bgsSeen||[]).length>=5,             unlock:{type:'bg',  id:'aurora'} },
  { id:'rain_dancer',   icon:'🌧', name:'RAIN DANCER',    desc:'Play on 7 different backgrounds',  check:(fd,pd)=>(fd.bgsSeen||[]).length>=7,             unlock:{type:'bg',  id:'neonrain'} },
  { id:'perfectionist', icon:'💯', name:'PERFECTIONIST',  desc:'Score 75+ in a run',              check:(fd,pd)=>pd.highScores.flight>=75,               unlock:{type:'skin',id:'ghost-pulse'} },
];

function checkUnlocks(score){
  const out=[];
  SKINS.forEach(sk=>{ if(!sk.req||FD.unlockedSkins.includes(sk.id)) return; const {type,val}=sk.req; if((type==='score'&&score>=val)||(type==='shards'&&PD.totalShards>=val)){ FD.unlockedSkins.push(sk.id); out.push(sk.label); } });
  BACKGROUNDS.forEach(bg=>{ if(!bg.req||FD.unlockedBgs.includes(bg.id)) return; const {type,val}=bg.req; if((type==='score'&&score>=val)||(type==='shards'&&PD.totalShards>=val)){ FD.unlockedBgs.push(bg.id); out.push(bg.label); } });
  EYE_STYLES.forEach(ey=>{ if(!ey.req||ey.req.type==='ach') return; if(FD.unlockedEyes.includes(ey.id)) return; const {type,val}=ey.req; if((type==='score'&&score>=val)||(type==='shards'&&PD.totalShards>=val)){ FD.unlockedEyes.push(ey.id); out.push(ey.label+' Eyes'); } });
  return out;
}

function checkAchievements(){
  const newOnes=[];
  ACHIEVEMENTS.forEach(a=>{
    if(FD.achievements.includes(a.id)) return;
    if(!a.check(FD,PD)) return;
    FD.achievements.push(a.id);
    if(a.unlock.type==='eye'  && !FD.unlockedEyes.includes(a.unlock.id))  FD.unlockedEyes.push(a.unlock.id);
    if(a.unlock.type==='bg'   && !FD.unlockedBgs.includes(a.unlock.id))   FD.unlockedBgs.push(a.unlock.id);
    if(a.unlock.type==='skin' && !FD.unlockedSkins.includes(a.unlock.id)) FD.unlockedSkins.push(a.unlock.id);
    newOnes.push(a);
  });
  if(newOnes.length){ save(); newOnes.forEach(a=>showAchievementToast(a)); }
  return newOnes;
}

function applySkin(id){ const s=SKINS.find(x=>x.id===id); if(!s) return; FD.activeSkin=s.id; FD.bodyColor=s.bodyColor; FD.eyeColor=s.eyeColor; FD.trailColor=s.trailColor; FD.trailShape=s.trailShape; if(!FD.customEye) FD.eyeStyle=s.eyeStyle; save(); }
function applyEye(id){ FD.eyeStyle=id; FD.customEye=(id!=='normal'); save(); }

/* ─────────────────────────────────────────────────────────
   AUDIO
───────────────────────────────────────────────────────── */
let _ac=null;
function getAC(){ if(!_ac) _ac=new(window.AudioContext||window.webkitAudioContext)(); if(_ac.state==='suspended') _ac.resume(); return _ac; }
function tone(freq,dur,type='sine',gain=0.18,bend=null){
  if(!FD.sound) return;
  try{ const ac=getAC(),o=ac.createOscillator(),g=ac.createGain(); o.connect(g);g.connect(ac.destination);o.type=type; o.frequency.setValueAtTime(freq,ac.currentTime); if(bend) o.frequency.exponentialRampToValueAtTime(bend,ac.currentTime+dur); g.gain.setValueAtTime(gain,ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+dur); o.start();o.stop(ac.currentTime+dur+.01); }catch(_){}
}
function noiseHit(dur=.12,gain=.14,freq=600){
  if(!FD.sound) return;
  try{ const ac=getAC(),buf=ac.createBuffer(1,ac.sampleRate*dur,ac.sampleRate),d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; const src=ac.createBufferSource(),flt=ac.createBiquadFilter(),g=ac.createGain(); flt.type='bandpass';flt.frequency.value=freq;flt.Q.value=3; src.buffer=buf;src.connect(flt);flt.connect(g);g.connect(ac.destination); g.gain.setValueAtTime(gain,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+dur); src.start();src.stop(ac.currentTime+dur); }catch(_){}
}
const SFX={
  jump   :()=>{ tone(320,.12,'sine',.14,520); },
  shard  :()=>{ tone(880,.1,'sine',.18,1200); noiseHit(.06,.06,1500); },
  combo  :(n)=>{ tone(440+n*80,.1,'triangle',.14,700+n*60); },
  pillar :()=>{ tone(110,.09,'square',.07,90); },
  death  :()=>{ [300,220,160,80].forEach((f,i)=>setTimeout(()=>tone(f,.3,'sawtooth',.24),i*110)); setTimeout(()=>noiseHit(.5,.2,200),50); },
  levelUp:()=>{ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,.18,'sine',.18),i*105)); },
  unlock :()=>{ tone(660,.2,'sine',.2,1100); setTimeout(()=>tone(880,.15,'sine',.16),180); },
  stage  :()=>{ tone(440,.15,'triangle',.2,660); setTimeout(()=>tone(660,.2,'triangle',.18,880),180); },
  sysErr :()=>{ noiseHit(.6,.3,200); tone(80,.8,'sawtooth',.22); setTimeout(()=>noiseHit(.3,.2,400),400); },
  anomaly:()=>{ [110,150,200].forEach((f,i)=>setTimeout(()=>tone(f,.5,'sawtooth',.28),i*180)); setTimeout(()=>noiseHit(.5,.3,100),600); },
};

/* ─────────────────────────────────────────────────────────
   CANVAS + RESIZE
───────────────────────────────────────────────────────── */
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H;
function resize(){ W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; if(BackgroundManager) BackgroundManager.init(); }
window.addEventListener('resize',resize);

/* ─────────────────────────────────────────────────────────
   STATE MACHINE
───────────────────────────────────────────────────────── */
const STATE={LOADING:0,MENU:1,PLAYING:2,PAUSED:3,DEAD:4};
let gameState=STATE.LOADING;
function showScreen(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('visible')); if(id) document.getElementById(id)?.classList.add('visible'); }

/* ─────────────────────────────────────────────────────────
   REALM MANAGER
───────────────────────────────────────────────────────── */
const RealmManager=(()=>{
  // All gravity/portal/timer mechanics removed. Dev panel uses VibeManager directly.
  function enterRealm(type){
    if(type==='hell')   VibeManager.applyVibe('hell',   true);
    if(type==='heaven') VibeManager.applyVibe('heaven', true);
  }
  function reset(){} function update(){}
  return {
    enterRealm, reset, update,
    showBanner(){ },
    getActiveBg(){ return null; },
    getGravMult(){ return 1; },     // gravity ALWAYS 1.0
    getCurrent()  { return null; },
    isGlitching() { return false; },
    isSysErr()    { return false; },
  };
})();

/* ──────────────────────────────────────────────────────────
   VIBE MANAGER  -- score-triggered visual milestones only
   Zero physics. Zero gravity changes. Zero portal pillars.
   CSS body classes style the score counter per milestone.
   bgFade crossfades the background. No forced deaths ever.

   Score 100  -> LEGENDARY    (gold glow)
   Score 200  -> SPECTRAL     (electric violet)
   Score 333  -> CURSED       (toxic green flicker)
   Score 666  -> HELL BREACH  (blood-red ember, hell bg)
   Score 999  -> DIVINE ASCENT (white-gold halo, heaven bg)
────────────────────────────────────────────────────────── */
const VibeManager = (() => {
  const VIBES = [
    { score:0,   id:'default',  name:null,            bg:null,     cls:'' },
    { score:100, id:'legend',   name:'LEGENDARY',      bg:null,     cls:'vibe-legend'  },
    { score:200, id:'spectral', name:'SPECTRAL',       bg:null,     cls:'vibe-spectral'},
    { score:333, id:'cursed',   name:'CURSED',         bg:null,     cls:'vibe-cursed'  },
    { score:666, id:'hell',     name:'HELL BREACH',    bg:'hell',   cls:'vibe-hell'    },
    { score:999, id:'heaven',   name:'DIVINE ASCENT',  bg:'heaven', cls:'vibe-heaven'  },
  ];

  let curVibe = VIBES[0];
  let sessionBgOverride = null;

  function vibeFor(score){
    let v = VIBES[0];
    VIBES.forEach(m => { if(score >= m.score) v = m; });
    return v;
  }

  function applyVibe(vibeId, forcedByDev=false){
    const v = VIBES.find(m => m.id === vibeId) || VIBES[0];
    VIBES.forEach(m => { if(m.cls) document.body.classList.remove(m.cls); });
    if(v.cls) document.body.classList.add(v.cls);
    if(v.bg){ sessionBgOverride = v.bg; crossfadeBg(); }
    if(v.name && typeof gameState!=='undefined' && gameState === STATE.PLAYING) showVibeBanner(v);
    if(!forcedByDev){
      if(v.id==='hell')    { tone(55,.5,'sawtooth',.28,40); setTimeout(()=>tone(90,.4,'sawtooth',.18),500); }
      if(v.id==='heaven')  { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,.3,'sine',.18),i*120)); }
      if(v.id==='legend')  { [523,659,784].forEach((f,i)=>setTimeout(()=>tone(f,.2,'sine',.16),i*100)); }
      if(v.id==='cursed')  { tone(160,.4,'sawtooth',.22,60); setTimeout(()=>tone(90,.3,'sawtooth',.18,50),300); }
      if(v.id==='spectral'){ [440,550,660].forEach((f,i)=>setTimeout(()=>tone(f,.15,'sine',.18),i*100)); }
    }
  }

  function crossfadeBg(){
    const fade = document.getElementById('bgFade');
    if(!fade) return;
    fade.style.transition = 'opacity 0.25s';
    fade.style.opacity = '0.9';
    setTimeout(() => { fade.style.transition = 'opacity 0.7s'; fade.style.opacity = '0'; }, 300);
  }

  function showVibeBanner(v){
    const el  = document.getElementById('realmBanner');
    const txt = document.getElementById('realmBannerText');
    if(!el||!txt) return;
    // Emoji prefixes inline so they work cross-platform
    const labels = {
      legend:'[*] LEGENDARY', spectral:'[~] SPECTRAL', cursed:'[X] CURSED',
      hell:'[!!] HELL BREACH', heaven:'[+] DIVINE ASCENT',
    };
    txt.textContent = labels[v.id] || v.name;
    const themeMap = { legend:'realm-heaven', spectral:'realm-glitch', cursed:'realm-glitch', hell:'realm-hell', heaven:'realm-heaven' };
    el.className = 'realm-banner ' + (themeMap[v.id] || 'realm-exit');
    el.dataset.vibe = v.id;
    clearTimeout(el._t);
    el.classList.remove('hidden');
    el._t = setTimeout(() => el.classList.add('hidden'), 3200);
  }

  function update(score){
    const v = vibeFor(score);
    if(v.id !== curVibe.id){ curVibe = v; applyVibe(v.id); }
  }

  function reset(){
    curVibe = VIBES[0]; sessionBgOverride = null;
    VIBES.forEach(m => { if(m.cls) document.body.classList.remove(m.cls); });
  }

  return { update, reset, applyVibe, getSessionBg(){ return sessionBgOverride; } };
})();

/* ─────────────────────────────────────────────────────────
   BACKGROUND MANAGER  (single draw cycle, no duplicate calls)
───────────────────────────────────────────────────────── */
const BackgroundManager=(()=>{
  let t=0, buildings=[], stars=[], voidP=[], matDrops=[], matCols=[];
  let hellP=[], heavenP=[], rainDrops=[], neuralNodes=[], neuralEdges=[];
  // Offscreen canvas for matrix — prevents flicker from double alpha-overlay
  let matCanvas=null, matCtx=null;

  function initCity(){
    buildings=[];
    for(let L=0;L<3;L++){
      let x=0; const cnt=6+L*4;
      for(let i=0;i<cnt;i++){
        const w=40+Math.random()*80,h=60+Math.random()*(H*(.25+L*.12));
        buildings.push({x,y:H-h,w,h,layer:L,hue:[180,270,300][i%3],wins:Array.from({length:Math.floor(h/20)*Math.floor(w/16)},()=>Math.random()>.35)});
        x+=w+4+Math.random()*20;
      }
      while(x<W*2.5){ const w=40+Math.random()*80,h=60+Math.random()*(H*(.25+L*.12)); buildings.push({x,y:H-h,w,h,layer:L,hue:[180,270,300][Math.floor(Math.random()*3)],wins:Array.from({length:Math.floor(h/20)*Math.floor(w/16)},()=>Math.random()>.35)}); x+=w+4+Math.random()*20; }
    }
  }
  function initStars(){ stars=Array.from({length:220},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()<.05?2.2:Math.random()<.15?1.4:.6,speed:.4+Math.random()*.8,tw:Math.random()*Math.PI*2})); }
  function initVoid(){ voidP=Array.from({length:120},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5,r:.8+Math.random()*2.2,life:Math.random(),hue:Math.random()<.5?180:300})); }
  function initMat(){
    const cols=Math.floor(W/18);
    matCols=Array.from({length:cols},(_,i)=>({x:i*18+9}));
    matDrops=Array.from({length:Math.floor(cols*.6)},()=>({col:Math.floor(Math.random()*cols),y:Math.random()*H,len:5+Math.floor(Math.random()*18),speed:120+Math.random()*160}));
    // Dedicated offscreen canvas for matrix trail effect
    matCanvas=document.createElement('canvas'); matCanvas.width=W; matCanvas.height=H;
    matCtx=matCanvas.getContext('2d'); matCtx.fillStyle='#000200'; matCtx.fillRect(0,0,W,H);
  }
  function initHell(){ hellP=Array.from({length:100},()=>({x:Math.random()*W,y:H+Math.random()*H*.4,vx:(Math.random()-.5)*2,vy:-60-Math.random()*120,life:1,sz:2+Math.random()*7,hue:Math.random()*35})); }
  function initHeaven(){ heavenP=Array.from({length:80},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.8,vy:-20-Math.random()*40,life:Math.random(),sz:1+Math.random()*4})); }
  function initRain(){ rainDrops=Array.from({length:180},()=>({x:Math.random()*W,y:Math.random()*H,speed:280+Math.random()*360,len:12+Math.random()*28,hue:[180,300,120,210][Math.floor(Math.random()*4)],alpha:.18+Math.random()*.45})); }
  function initNeural(){
    const cnt=32;
    neuralNodes=Array.from({length:cnt},()=>({ x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-.5)*.35, vy:(Math.random()-.5)*.35, r:2+Math.random()*4, hue:Math.random()<.5?30:200, pulse:Math.random()*Math.PI*2 }));
    neuralEdges=[];
    for(let i=0;i<cnt;i++) for(let j=i+1;j<cnt;j++){ if(Math.hypot(neuralNodes[i].x-neuralNodes[j].x,neuralNodes[i].y-neuralNodes[j].y)<W*.22) neuralEdges.push([i,j]); }
  }

  function drawGrid(){
    ctx.fillStyle='#050510'; ctx.fillRect(0,0,W,H);
    const hz=H*.52;
    ctx.save(); ctx.strokeStyle='rgba(0,240,255,0.12)'; ctx.lineWidth=1;
    for(let i=0;i<=18;i++){const y=hz+(H-hz)*(i/18);ctx.globalAlpha=.04+.18*(i/18);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    for(let i=0;i<=24;i++){const r=i/24,bx=r*W;ctx.globalAlpha=.06+.06*Math.abs(r-.5);ctx.beginPath();ctx.moveTo(W/2,hz);ctx.lineTo(bx,H);ctx.stroke();}
    ctx.globalAlpha=1; ctx.restore();
    const hg=ctx.createLinearGradient(0,hz-40,0,hz+60);
    hg.addColorStop(0,'rgba(0,240,255,0)');hg.addColorStop(.5,`rgba(0,240,255,${.055+.03*Math.sin(t*.8)})`);hg.addColorStop(1,'rgba(0,240,255,0)');
    ctx.fillStyle=hg; ctx.fillRect(0,hz-40,W,100);
  }

  function drawCity(dt){
    const sg=ctx.createLinearGradient(0,0,0,H);
    sg.addColorStop(0,'#02000a');sg.addColorStop(.6,'#08001c');sg.addColorStop(1,'#120030');
    ctx.fillStyle=sg; ctx.fillRect(0,0,W,H);
    for(let i=0;i<40;i++){const s=stars[i];if(!s)continue;ctx.globalAlpha=.4+.4*Math.sin(s.tw+t*1.2);ctx.fillStyle='rgba(255,255,255,.7)';ctx.fillRect(s.x,s.y*.5,s.r,s.r);}
    ctx.globalAlpha=1;
    const spd=(window.Game?.speed||290);
    for(let L=2;L>=0;L--){
      const par=.1+L*.3, al=.35+L*.25;
      ctx.save(); ctx.globalAlpha=al;
      buildings.filter(b=>b.layer===L).forEach(b=>{
        const bx=((b.x-t*spd*par*.001*60)%(W*2.5)+W*2.5)%(W*2.5)-W*.5;
        const h2=b.hue+L*30;
        ctx.fillStyle=`hsl(${h2},90%,${18+L*6}%)`; ctx.fillRect(bx,b.y,b.w,b.h);
        ctx.fillStyle=`hsl(${h2+20},100%,72%)`;
        let wi=0;
        for(let wy=b.y+6;wy<b.y+b.h-6;wy+=14) for(let wx=bx+6;wx<bx+b.w-6;wx+=14){
          if(b.wins[wi++]&&Math.random()>.002){ctx.globalAlpha=(.5+.4*Math.sin(t*.3+wi))*al;ctx.fillRect(wx,wy,8,7);}
        }
        ctx.globalAlpha=(.3+.2*Math.sin(t+b.x))*al;
        ctx.fillStyle=`hsl(${h2},100%,60%)`;ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=12;
        ctx.fillRect(bx,b.y,b.w,2);ctx.shadowBlur=0;
      });
      ctx.restore();
    }
  }

  function drawStarfield(dt){
    ctx.fillStyle='#000308'; ctx.fillRect(0,0,W,H);
    const spd=(window.Game?.speed||290);
    stars.forEach(s=>{
      s.x-=s.speed*(spd/290)*dt; if(s.x<0){s.x=W;s.y=Math.random()*H;}
      const a=.5+.45*Math.sin(s.tw+t*2.2);
      ctx.save();ctx.globalAlpha=a;
      ctx.fillStyle=s.r>1.8?'#ff88ff':s.r>1?'#aaddff':'#fff';
      ctx.shadowColor=s.r>1?'#aaddff':'#fff';ctx.shadowBlur=s.r>1?8:3;
      ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();ctx.restore();
    });
    const ng=ctx.createRadialGradient(W*.3,H*.4,0,W*.3,H*.4,H*.5);
    ng.addColorStop(0,`rgba(80,0,160,${.04+.02*Math.sin(t*.4)})`);ng.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=ng; ctx.fillRect(0,0,W,H);
  }

  function drawVaporwave(dt){
    const sky=ctx.createLinearGradient(0,0,0,H*.58);
    sky.addColorStop(0,'#06001a');sky.addColorStop(.45,'#200040');sky.addColorStop(1,'#88004a');
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H*.58);
    const sx=W*.5,sy=H*.36,sr=H*.14;
    ctx.save(); ctx.beginPath();ctx.arc(sx,sy,sr,0,Math.PI*2);ctx.clip();
    const sunG=ctx.createLinearGradient(sx,sy-sr,sx,sy+sr);
    sunG.addColorStop(0,'#ffee66');sunG.addColorStop(.4,'#ff6699');sunG.addColorStop(1,'#cc0066');
    ctx.fillStyle=sunG;ctx.fillRect(sx-sr,sy-sr,sr*2,sr*2);
    ctx.fillStyle='rgba(8,0,18,0.92)';
    for(let i=0;i<8;i++){const ly=sy+sr*.05+i*(sr*.12);ctx.fillRect(sx-sr,ly,sr*2,2+i*1.6);}
    ctx.restore();
    const hg=ctx.createLinearGradient(0,H*.52,0,H*.62);
    hg.addColorStop(0,'rgba(255,60,180,0)');hg.addColorStop(.5,`rgba(255,60,180,${.32+.1*Math.sin(t*.9)})`);hg.addColorStop(1,'rgba(255,60,180,0)');
    ctx.fillStyle=hg;ctx.fillRect(0,H*.52,W,H*.1);
    const fl=ctx.createLinearGradient(0,H*.58,0,H);
    fl.addColorStop(0,'#120022');fl.addColorStop(1,'#060010');
    ctx.fillStyle=fl;ctx.fillRect(0,H*.58,W,H*.42);
    const gameSpd=window.Game?.speed||290;
    const scroll=(t*gameSpd*.0018)%1;
    ctx.save(); ctx.strokeStyle='rgba(255,40,200,0.55)';
    for(let i=0;i<=14;i++){const norm=((i/14)+scroll)%1,yp=H*.58+Math.pow(norm,1.6)*(H*.42),alpha=Math.pow(norm,.6)*.8;ctx.globalAlpha=alpha;ctx.lineWidth=.8+norm*1.2;ctx.beginPath();ctx.moveTo(0,yp);ctx.lineTo(W,yp);ctx.stroke();}
    ctx.lineWidth=.7;const vp={x:W*.5,y:H*.58};
    for(let i=0;i<=20;i++){const bx=(i/20)*W;ctx.globalAlpha=.12+.18*Math.abs(i/20-.5);ctx.beginPath();ctx.moveTo(vp.x+(bx-vp.x)*.05,vp.y);ctx.lineTo(bx,H);ctx.stroke();}
    ctx.restore();
    ctx.save();ctx.globalAlpha=.9;ctx.strokeStyle=`rgba(255,80,220,${.7+.2*Math.sin(t*1.2)})`;ctx.lineWidth=1.8;ctx.shadowColor='#ff00cc';ctx.shadowBlur=18;ctx.beginPath();ctx.moveTo(0,H*.58);ctx.lineTo(W,H*.58);ctx.stroke();ctx.restore();
  }

  function drawAurora(dt){
    const sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#000c0a');sky.addColorStop(.6,'#001810');sky.addColorStop(1,'#000a06');
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    stars.forEach(s=>{
      if(s.y>H*.65) return;
      const a=.25+.5*Math.sin(s.tw+t*1.6);
      ctx.save();ctx.globalAlpha=a;ctx.fillStyle=s.r>1.6?'#ccffee':'#e8fff4';ctx.shadowColor='#00ff88';ctx.shadowBlur=s.r>1.5?5:0;ctx.beginPath();ctx.arc(s.x,s.y,s.r*.75,0,Math.PI*2);ctx.fill();ctx.restore();
    });
    [{col:'0,255,140',base:H*.07,amp:H*.055,ph:0,freq:.0055,spd:.28,a:.16},{col:'0,190,255',base:H*.16,amp:H*.045,ph:2.2,freq:.007,spd:.44,a:.13},{col:'150,0,255',base:H*.23,amp:H*.06,ph:4.8,freq:.004,spd:.2,a:.11},{col:'0,255,200',base:H*.12,amp:H*.04,ph:1.5,freq:.009,spd:.55,a:.09}].forEach(b=>{
      ctx.save();ctx.beginPath();
      for(let xi=0;xi<=W;xi+=6){const wy=b.base+Math.sin(xi*b.freq+t*b.spd+b.ph)*b.amp+Math.sin(xi*b.freq*1.8+t*b.spd*.7+b.ph+1)*b.amp*.38;xi===0?ctx.moveTo(0,wy):ctx.lineTo(xi,wy);}
      ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();
      const topY=b.base-b.amp*1.4,botY=b.base+b.amp+H*.14;
      const g=ctx.createLinearGradient(0,topY,0,botY);
      g.addColorStop(0,`rgba(${b.col},0)`);g.addColorStop(.2,`rgba(${b.col},${b.a})`);g.addColorStop(.55,`rgba(${b.col},${b.a*.6})`);g.addColorStop(1,`rgba(${b.col},0)`);
      ctx.fillStyle=g;ctx.fill();ctx.restore();
    });
    const gnd=ctx.createLinearGradient(0,H*.68,0,H);gnd.addColorStop(0,'rgba(0,12,8,0)');gnd.addColorStop(1,'rgba(0,5,3,.96)');ctx.fillStyle=gnd;ctx.fillRect(0,H*.68,W,H*.32);
  }

  function drawNeonRain(dt){
    // Full clear first to prevent double-overlay
    ctx.fillStyle='rgba(3,0,10,.22)';ctx.fillRect(0,0,W,H);
    rainDrops.forEach(d=>{
      d.y+=d.speed*dt;if(d.y>H+d.len){d.y=-d.len;d.x=Math.random()*W;}
      const alpha=d.alpha*(0.65+0.35*Math.sin(t*4+d.x*.01));
      const rg=ctx.createLinearGradient(d.x,d.y-d.len,d.x,d.y);
      rg.addColorStop(0,`hsla(${d.hue},100%,65%,0)`);rg.addColorStop(1,`hsla(${d.hue},100%,70%,${alpha})`);
      ctx.save();ctx.strokeStyle=rg;ctx.lineWidth=1.1;ctx.shadowColor=`hsl(${d.hue},100%,60%)`;ctx.shadowBlur=5;ctx.beginPath();ctx.moveTo(d.x,d.y-d.len);ctx.lineTo(d.x,d.y);ctx.stroke();ctx.restore();
    });
    const pool=ctx.createLinearGradient(0,H*.72,0,H);pool.addColorStop(0,'rgba(0,200,255,0)');pool.addColorStop(.4,'rgba(0,200,255,.045)');pool.addColorStop(1,'rgba(255,0,200,.03)');ctx.fillStyle=pool;ctx.fillRect(0,H*.72,W,H*.28);
    ctx.fillStyle='rgba(6,0,16,.88)';ctx.fillRect(0,H*.76,W,H*.24);
    ctx.fillStyle=`rgba(0,220,255,${.12+.06*Math.sin(t*.4)})`;
    for(let bi=0;bi<W;bi+=22){const bh=30+((bi*7)%60);ctx.fillRect(bi,H*.76-bh,18,bh);for(let wy=H*.76-bh+6;wy<H*.76-6;wy+=8)for(let wx=bi+3;wx<bi+14;wx+=6)if(((bi+wy)%13)<6)ctx.fillRect(wx,wy,4,5);}
    const hz=H*.755;const hneon=ctx.createLinearGradient(0,hz-3,0,hz+3);hneon.addColorStop(0,'rgba(0,200,255,0)');hneon.addColorStop(.5,`rgba(0,220,255,${.6+.3*Math.sin(t*2)})`);hneon.addColorStop(1,'rgba(0,200,255,0)');ctx.fillStyle=hneon;ctx.fillRect(0,hz-3,W,6);
  }

  function drawVoid(dt){
    ctx.fillStyle='#000005';ctx.fillRect(0,0,W,H);
    voidP.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;p.life+=dt*.4;
      if(p.x<0||p.x>W||p.y<0||p.y>H){p.x=Math.random()*W;p.y=Math.random()*H;p.life=0;}
      ctx.save();ctx.globalAlpha=.15+.15*Math.sin(p.life*2);ctx.fillStyle=`hsl(${p.hue},100%,62%)`;ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=6;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.restore();
    });
    const vgn=ctx.createRadialGradient(W/2,H/2,H*.1,W/2,H/2,H*.75);vgn.addColorStop(0,'rgba(0,0,0,0)');vgn.addColorStop(1,'rgba(0,0,20,.82)');ctx.fillStyle=vgn;ctx.fillRect(0,0,W,H);
  }

  function drawMatrix(dt){
    if(!matCanvas||matCanvas.width!==W||matCanvas.height!==H){ initMat(); }
    // Draw trail effect onto offscreen canvas
    matCtx.fillStyle='rgba(0,2,0,.15)';
    matCtx.fillRect(0,0,W,H);
    matCtx.font='bold 13px monospace';
    const CH='01アイウエオ0101ABCDEF';
    matDrops.forEach(d=>{
      d.y+=d.speed*dt;
      if(d.y>H+d.len*16){d.y=-d.len*16;d.col=Math.floor(Math.random()*matCols.length);}
      const col=matCols[d.col]; if(!col) return;
      for(let i=0;i<d.len;i++){
        const py=d.y-i*16; if(py<0||py>H) continue;
        const a=i===0?1:.7*(1-i/d.len);
        matCtx.fillStyle=i===0?`rgba(180,255,180,${a})`:`rgba(0,${120+Math.floor(a*135)},0,${a*.7})`;
        matCtx.fillText(CH[Math.floor(Math.random()*CH.length)],col.x-6,py);
      }
    });
    // Dark overlay for depth
    matCtx.fillStyle='rgba(0,0,2,.4)';matCtx.fillRect(0,0,W,H);
    // Scan line sweep
    const sY=(t*120)%H;
    const sg=matCtx.createLinearGradient(0,sY-30,0,sY+30);
    sg.addColorStop(0,'rgba(0,255,80,0)');sg.addColorStop(.5,'rgba(0,255,80,.06)');sg.addColorStop(1,'rgba(0,255,80,0)');
    matCtx.fillStyle=sg;matCtx.fillRect(0,sY-30,W,60);
    // Blit offscreen to main canvas in single pass
    ctx.drawImage(matCanvas,0,0);
  }

  function drawHell(dt){
    const sg=ctx.createLinearGradient(0,0,0,H);sg.addColorStop(0,'#080000');sg.addColorStop(.5,'#180400');sg.addColorStop(1,'#220800');ctx.fillStyle=sg;ctx.fillRect(0,0,W,H);
    const lg=ctx.createLinearGradient(0,H*.7,0,H);lg.addColorStop(0,'rgba(180,20,0,0)');lg.addColorStop(1,`rgba(255,50,0,${.35+.1*Math.sin(t*2.2)})`);ctx.fillStyle=lg;ctx.fillRect(0,H*.7,W,H*.3);
    hellP.forEach(p=>{
      p.y+=p.vy*dt;p.x+=p.vx*dt;p.life-=dt*.55;
      if(p.life<=0||p.y<-30){p.x=Math.random()*W;p.y=H+10;p.life=1;p.vy=-60-Math.random()*120;p.vx=(Math.random()-.5)*2;}
      ctx.save();ctx.globalAlpha=p.life*.75;const fg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.sz*2.5);fg.addColorStop(0,`rgba(255,${Math.floor(120+p.hue*3)},0,0.95)`);fg.addColorStop(.5,'rgba(200,30,0,0.4)');fg.addColorStop(1,'rgba(100,0,0,0)');ctx.fillStyle=fg;ctx.beginPath();ctx.arc(p.x,p.y,p.sz*2.5,0,Math.PI*2);ctx.fill();ctx.restore();
    });
    ctx.save();ctx.strokeStyle=`rgba(255,30,0,${.07+.04*Math.sin(t*1.5)})`;ctx.lineWidth=1;for(let i=0;i<=14;i++){const y=H*i/14;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}for(let i=0;i<=18;i++){const x=W*i/18;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}ctx.restore();
    const ev=ctx.createRadialGradient(W/2,H*.9,0,W/2,H*.9,W*.8);ev.addColorStop(0,`rgba(255,40,0,${.15+.06*Math.sin(t*.8)})`);ev.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=ev;ctx.fillRect(0,0,W,H);
  }

  function drawHeaven(dt){
    const sg=ctx.createLinearGradient(0,0,0,H);sg.addColorStop(0,'#e0f8ff');sg.addColorStop(.4,'#c0f0ff');sg.addColorStop(1,'#a8eaff');ctx.fillStyle=sg;ctx.fillRect(0,0,W,H);
    const sx=W/2,sy=H*.15;const sunG=ctx.createRadialGradient(sx,sy,0,sx,sy,H*.55);sunG.addColorStop(0,`rgba(255,255,255,${.65+.15*Math.sin(t*.5)})`);sunG.addColorStop(.25,`rgba(220,248,255,${.3+.1*Math.sin(t*.5)})`);sunG.addColorStop(1,'rgba(160,230,255,0)');ctx.fillStyle=sunG;ctx.fillRect(0,0,W,H);
    heavenP.forEach(p=>{
      p.y+=p.vy*dt;p.x+=p.vx*dt;p.life-=dt*.18;
      if(p.life<=0||p.y<-30){p.x=Math.random()*W;p.y=H+10;p.life=1+Math.random()*.5;p.vy=-20-Math.random()*40;p.vx=(Math.random()-.5)*.8;}
      ctx.save();ctx.globalAlpha=Math.min(1,p.life)*.55;const hg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.sz*4);hg.addColorStop(0,'rgba(255,255,255,0.95)');hg.addColorStop(.4,'rgba(200,245,255,0.4)');hg.addColorStop(1,'rgba(180,240,255,0)');ctx.fillStyle=hg;ctx.beginPath();ctx.arc(p.x,p.y,p.sz*4,0,Math.PI*2);ctx.fill();ctx.restore();
    });
    ctx.save();ctx.strokeStyle=`rgba(255,220,80,${.06+.03*Math.sin(t*1.4)})`;ctx.lineWidth=1;for(let i=0;i<=18;i++){const y=H*i/18;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.restore();
    const vgn=ctx.createRadialGradient(W/2,H/2,H*.15,W/2,H/2,H*.75);vgn.addColorStop(0,'rgba(255,255,255,0)');vgn.addColorStop(1,`rgba(180,235,255,${.18+.06*Math.sin(t*.4)})`);ctx.fillStyle=vgn;ctx.fillRect(0,0,W,H);
  }

  function drawNeural(dt){
    ctx.fillStyle='#060310';ctx.fillRect(0,0,W,H);
    const spd=(window.Game?.speed||290);
    neuralNodes.forEach(n=>{
      n.x-=n.vx*(spd/290)*dt*12; n.y+=n.vy*dt*12;
      if(n.x<0) n.x=W; if(n.x>W) n.x=0;
      if(n.y<0) n.y=H; if(n.y>H) n.y=0;
      n.pulse+=dt*2.2;
    });
    // Draw edges
    ctx.save();
    neuralEdges.forEach(([i,j])=>{
      const ni=neuralNodes[i],nj=neuralNodes[j];
      const dist=Math.hypot(ni.x-nj.x,ni.y-nj.y);
      const maxDist=W*.22;
      if(dist>maxDist) return;
      const alpha=(1-dist/maxDist)*(.2+.12*Math.sin(t*1.5+i));
      const hue=ni.hue;
      ctx.strokeStyle=`hsla(${hue},100%,65%,${alpha})`;
      ctx.lineWidth=.7;ctx.shadowColor=`hsl(${hue},100%,60%)`;ctx.shadowBlur=3;
      ctx.beginPath();ctx.moveTo(ni.x,ni.y);ctx.lineTo(nj.x,nj.y);ctx.stroke();
    });
    ctx.restore();
    // Draw nodes
    neuralNodes.forEach(n=>{
      const pulse=.6+.4*Math.sin(n.pulse);
      ctx.save();
      ctx.globalAlpha=pulse;ctx.fillStyle=`hsl(${n.hue},100%,70%)`;ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=n.r*4*pulse;
      ctx.beginPath();ctx.arc(n.x,n.y,n.r*pulse,0,Math.PI*2);ctx.fill();ctx.restore();
    });
    const ov=ctx.createRadialGradient(W/2,H/2,H*.05,W/2,H/2,H*.7);ov.addColorStop(0,'rgba(0,0,0,0)');ov.addColorStop(1,'rgba(0,0,12,.7)');ctx.fillStyle=ov;ctx.fillRect(0,0,W,H);
  }

  function getPillarStyle(){
    const bg=VibeManager.getSessionBg()||FD.background;
    return PILLAR_STYLES[bg]||PILLAR_STYLES.grid;
  }

  function renderBgThumb(c,id,w,h){
    c.fillStyle='#050510';c.fillRect(0,0,w,h);
    switch(id){
      case 'grid': c.strokeStyle='rgba(0,240,255,0.3)';c.lineWidth=.5;for(let i=0;i<=5;i++){c.beginPath();c.moveTo(0,i*h/5);c.lineTo(w,i*h/5);c.stroke();}for(let i=0;i<=8;i++){c.beginPath();c.moveTo(i*w/8,0);c.lineTo(i*w/8,h);c.stroke();}break;
      case 'city': c.fillStyle='#0a001c';c.fillRect(0,0,w,h);c.fillStyle='#1a0040';[0,12,22,35,48,58,70].forEach((x,i)=>{const bh=14+i*3;c.fillRect(x,h-bh,10,bh);});c.strokeStyle='#ff00ff';c.lineWidth=.8;c.beginPath();c.moveTo(0,h*.7);c.lineTo(w,h*.7);c.stroke();break;
      case 'starfield': c.fillStyle='#000308';c.fillRect(0,0,w,h);for(let i=0;i<50;i++){c.fillStyle='rgba(255,255,255,.7)';c.fillRect(Math.random()*w,Math.random()*h,.8,.8);}break;
      case 'vaporwave': const vg=c.createLinearGradient(0,0,0,h);vg.addColorStop(0,'#0a0020');vg.addColorStop(.6,'#3a0050');vg.addColorStop(1,'#cc3366');c.fillStyle=vg;c.fillRect(0,0,w,h);c.fillStyle='#ff88bb';c.beginPath();c.arc(w*.5,h*.45,h*.2,0,Math.PI*2);c.fill();break;
      case 'void': c.fillStyle='#000005';c.fillRect(0,0,w,h);for(let i=0;i<20;i++){c.save();c.globalAlpha=.3;c.fillStyle=i%2?'#00f0ff':'#ff00ff';c.beginPath();c.arc(Math.random()*w,Math.random()*h,.8+Math.random()*1.5,0,Math.PI*2);c.fill();c.restore();}break;
      case 'matrix': c.fillStyle='#000200';c.fillRect(0,0,w,h);c.fillStyle='rgba(0,200,0,.7)';c.font='7px monospace';for(let i=0;i<w;i+=8)for(let j=0;j<h;j+=8)if(Math.random()>.55)c.fillText(Math.random()>.5?'1':'0',i,j+6);break;
      case 'hell': const hg=c.createLinearGradient(0,0,0,h);hg.addColorStop(0,'#080000');hg.addColorStop(1,'#3a0800');c.fillStyle=hg;c.fillRect(0,0,w,h);c.fillStyle='rgba(255,60,0,0.35)';c.fillRect(0,h*.65,w,h*.35);break;
      case 'heaven': const hvg=c.createLinearGradient(0,0,0,h);hvg.addColorStop(0,'#e0f8ff');hvg.addColorStop(1,'#a8eaff');c.fillStyle=hvg;c.fillRect(0,0,w,h);c.fillStyle='rgba(255,255,200,0.6)';c.beginPath();c.arc(w*.5,h*.3,h*.28,0,Math.PI*2);c.fill();break;
      case 'aurora': c.fillStyle='#000c0a';c.fillRect(0,0,w,h);[{col:'rgba(0,255,140,.18)',y:h*.18},{col:'rgba(0,190,255,.14)',y:h*.32},{col:'rgba(150,0,255,.12)',y:h*.45}].forEach(b=>{const ag=c.createLinearGradient(0,b.y-h*.1,0,b.y+h*.18);ag.addColorStop(0,'rgba(0,0,0,0)');ag.addColorStop(.4,b.col);ag.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=ag;c.fillRect(0,b.y-h*.1,w,h*.28);});break;
      case 'neonrain': c.fillStyle='#030009';c.fillRect(0,0,w,h);for(let i=0;i<30;i++){const rx=Math.random()*w,rl=6+Math.random()*14,rh=[180,300,120][Math.floor(Math.random()*3)];c.strokeStyle=`hsla(${rh},100%,65%,.45)`;c.lineWidth=.8;c.beginPath();c.moveTo(rx,Math.random()*h*.7);c.lineTo(rx,Math.random()*h*.7+rl);c.stroke();}break;
      case 'neural': c.fillStyle='#060310';c.fillRect(0,0,w,h);for(let i=0;i<12;i++){const nx=Math.random()*w,ny=Math.random()*h;c.fillStyle=i%2===0?'rgba(255,140,0,.8)':'rgba(0,160,255,.8)';c.beginPath();c.arc(nx,ny,1.5,0,Math.PI*2);c.fill();}break;
    }
  }

  return {
    init(){ if(W&&H){ initStars();initVoid();initMat();initCity();initHell();initHeaven();initRain();initNeural(); } },
    draw(dt){
      t+=dt;
      const bg=VibeManager.getSessionBg()||FD.background;
      switch(bg){
        case 'grid':      drawGrid();          break;
        case 'city':      drawCity(dt);        break;
        case 'starfield': drawStarfield(dt);   break;
        case 'vaporwave': drawVaporwave(dt);   break;
        case 'void':      drawVoid(dt);        break;
        case 'matrix':    drawMatrix(dt);      break;
        case 'aurora':    drawAurora(dt);      break;
        case 'neonrain':  drawNeonRain(dt);    break;
        case 'neural':    drawNeural(dt);      break;
        case 'hell':      drawHell(dt);        break;
        case 'heaven':    drawHeaven(dt);      break;
        default:          drawGrid();          break;
      }
    },
    reset(){ t=0; initHell();initHeaven();initRain();initNeural(); },
    getPillarStyle,
    renderBgThumb,
  };
})();

/* ─────────────────────────────────────────────────────────
   PLAYER
───────────────────────────────────────────────────────── */
const Player=(()=>{
  let x,y,vy,scaleX=1,scaleY=1,blinkTimer=0,blinking=false,bobT=0,bobOffset=0;
  let alive=true, deathP=[], trail=[], glowT=0;

  function reset(){ x=W*C.PLAYER_X_RATIO;y=H/2;vy=0;scaleX=1;scaleY=1;bobT=0;bobOffset=0;blinkTimer=C.BLINK_INTERVAL;blinking=false;alive=true;trail=[];deathP=[];glowT=0; }
  function jump(){ if(!alive) return; vy=C.JUMP_VELOCITY;scaleX=1.22;scaleY=C.SQUASH_JUMP;SFX.jump(); }
  function update(dt){
    if(!alive){ deathP.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vx*=.88;p.vy+=30*dt;p.life-=dt*1.4;});deathP=deathP.filter(p=>p.life>0);return; }
    vy+=C.GRAVITY*RealmManager.getGravMult()*dt;
    bobT+=dt;bobOffset=Math.sin(bobT*C.BOB_FREQ*Math.PI*2)*C.BOB_AMP;
    y+=vy*dt;
    const tSY=vy<0?C.SQUASH_JUMP:(vy>400?C.SQUASH_FALL:1);
    scaleY=lerp(scaleY,tSY,dt*10);scaleX=lerp(scaleX,2-scaleY,dt*10);
    glowT+=dt;
    blinkTimer-=dt*1000;
    if(blinkTimer<=0){ if(blinking){blinking=false;blinkTimer=C.BLINK_INTERVAL+(Math.random()-.5)*800;}else{blinking=true;blinkTimer=C.BLINK_DURATION;} }
    if(FD.particles){
      const dens=FD.trailDensity,cy=y+bobOffset;
      if(trail.length===0||Math.hypot(trail[0].x-x,trail[0].y-cy)>5/dens) trail.unshift({x,y:cy,life:1});
    }
    if(trail.length>60) trail.length=60;
    const spd2=Game.speed||290;
    trail.forEach(p=>{ p.x-=spd2*dt; p.life-=dt*4.5; });
    trail=trail.filter(p=>p.life>0&&(x-p.x)<115);
  }

  function trailCol(){ return FD.trailColor; }
  function drawTrail(px,py,life,idx){
    const a=life*.8,sz=C.PLAYER_RADIUS*.42*life,col=trailCol();
    ctx.save();ctx.globalAlpha=a;ctx.fillStyle=col;ctx.shadowColor=col;ctx.shadowBlur=8*life;
    const sh=FD.trailShape;
    if(sh==='dot'){ctx.beginPath();ctx.arc(px,py,sz,0,Math.PI*2);ctx.fill();}
    else if(sh==='spark'){ctx.translate(px,py);ctx.rotate(idx*.4+life*3);for(let i=0;i<4;i++){ctx.save();ctx.rotate(i*Math.PI*.5);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(sz*.5,sz*2.4);ctx.lineTo(0,sz*.8);ctx.closePath();ctx.fill();ctx.restore();}}
    else if(sh==='triangle'){ctx.translate(px,py);ctx.rotate(idx*.35+life*2);ctx.beginPath();ctx.moveTo(0,-sz*1.4);ctx.lineTo(sz*1.2,sz*.9);ctx.lineTo(-sz*1.2,sz*.9);ctx.closePath();ctx.fill();}
    ctx.restore();
  }

  function draw(c2){
    if(!alive){ deathP.forEach(p=>{c2.save();c2.globalAlpha=p.life*.9;c2.fillStyle=p.col;c2.shadowColor=p.col;c2.shadowBlur=10;const s=p.sz*p.life;c2.fillRect(p.x-s/2,p.y-s/2,s,s);c2.restore();}); return; }
    trail.forEach((p,i)=>{ const dx=x-p.x; if(dx<12) return; const fadeIn=Math.min(1,(dx-12)/28); drawTrail(p.x,p.y,p.life*fadeIn,i); });
    c2.save();c2.translate(x,y+bobOffset);c2.scale(scaleX,scaleY);
    const R=C.PLAYER_RADIUS,glow=.7+.3*Math.sin(glowT*3);
    const realm=RealmManager.getCurrent();
    let bc=FD.bodyColor,ec=FD.eyeColor;
    // Vibe player colours applied via CSS body classes (vibe-hell, vibe-heaven)
    if(RealmManager.isSysErr()){bc=`hsl(${(Date.now()*.1)%360},100%,55%)`;ec='#ff0000';}
    const halo=c2.createRadialGradient(0,0,R*.4,0,0,R*2.4);halo.addColorStop(0,hexAlpha(bc,.32*glow));halo.addColorStop(1,hexAlpha(bc,0));c2.fillStyle=halo;c2.beginPath();c2.arc(0,0,R*2.4,0,Math.PI*2);c2.fill();
    c2.shadowColor=bc;c2.shadowBlur=18*glow;
    const bg2=c2.createRadialGradient(-R*.28,-R*.28,0,0,0,R);bg2.addColorStop(0,lightenColor(bc,60));bg2.addColorStop(.55,bc);bg2.addColorStop(1,darkenColor(bc,40));
    c2.fillStyle=bg2;roundedRect(c2,-R,-R,R*2,R*2,R*.52);c2.fill();
    c2.shadowBlur=0;c2.fillStyle='rgba(255,255,255,0.22)';c2.beginPath();c2.ellipse(-R*.18,-R*.3,R*.55,R*.32,-.3,0,Math.PI*2);c2.fill();
    drawEyes(c2,R,ec);
    c2.restore();
  }

  function drawEyes(c2,R,ec){
    if(blinking) return;
    const style=FD.eyeStyle,pc=darkenColor(ec,55);
    const ex1=-R*.30,ex2=R*.30,ey=-R*.06,er=R*.30;
    c2.shadowColor=ec;c2.shadowBlur=12;
    if(style==='normal'){
      [ex1,ex2].forEach(ex=>{ c2.fillStyle='rgba(255,255,255,0.93)';c2.beginPath();c2.arc(ex,ey,er,0,Math.PI*2);c2.fill();c2.fillStyle=ec;c2.shadowBlur=8;c2.beginPath();c2.arc(ex,ey,er*.72,0,Math.PI*2);c2.fill();c2.fillStyle=pc;c2.shadowBlur=0;c2.beginPath();c2.arc(ex+er*.15,ey+er*.1,er*.44,0,Math.PI*2);c2.fill();c2.fillStyle='rgba(255,255,255,.88)';c2.beginPath();c2.arc(ex-er*.18,ey-er*.22,er*.2,0,Math.PI*2);c2.fill(); });
    } else if(style==='googly'){
      const vyOff=Math.max(-er*.55,Math.min(er*.55,(vy||0)*0.012));
      [ex1,ex2].forEach((ex,i)=>{ c2.fillStyle='rgba(255,255,255,0.95)';c2.beginPath();c2.arc(ex,ey,er*1.1,0,Math.PI*2);c2.fill();c2.strokeStyle='rgba(0,0,0,.1)';c2.lineWidth=1;c2.stroke();const wobble=Math.sin(glowT*8+i*Math.PI)*.08;const clx=Math.max(ex-er*.45,Math.min(ex+er*.45,ex+wobble*er));const cly=Math.max(ey-er*.45,Math.min(ey+er*.45,ey+vyOff));c2.fillStyle='#111';c2.shadowBlur=0;c2.beginPath();c2.arc(clx,cly,er*.52,0,Math.PI*2);c2.fill();c2.fillStyle='rgba(255,255,255,.85)';c2.beginPath();c2.arc(clx-er*.14,cly-er*.18,er*.16,0,Math.PI*2);c2.fill(); });
    } else if(style==='sleepy'){
      [ex1,ex2].forEach(ex=>{ c2.fillStyle='rgba(255,255,255,0.88)';c2.beginPath();c2.arc(ex,ey,er,0,Math.PI*2);c2.fill();c2.fillStyle=ec;c2.beginPath();c2.arc(ex,ey,er*.7,0,Math.PI*2);c2.fill();c2.fillStyle=pc;c2.shadowBlur=0;c2.beginPath();c2.arc(ex,ey+er*.1,er*.38,0,Math.PI*2);c2.fill();c2.fillStyle='rgba(5,5,22,0.65)';c2.beginPath();c2.ellipse(ex,ey-er*.35,er*1.08,er*.72,0,Math.PI,0);c2.fill();c2.strokeStyle='rgba(0,0,0,.5)';c2.lineWidth=1.5;for(let i=-2;i<=2;i++){c2.beginPath();c2.moveTo(ex+i*er*.22,ey-er*.85);c2.lineTo(ex+i*er*.26,ey-er*1.1);c2.stroke();} });
    } else if(style==='stars'){
      [ex1,ex2].forEach(ex=>{ c2.fillStyle='rgba(255,255,255,0.9)';c2.beginPath();c2.arc(ex,ey,er,0,Math.PI*2);c2.fill();c2.fillStyle=ec;c2.shadowColor=ec;c2.shadowBlur=10;c2.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2+glowT*1.4;const r=i%2===0?er*.75:er*.33;i===0?c2.moveTo(ex+Math.cos(a)*r,ey+Math.sin(a)*r):c2.lineTo(ex+Math.cos(a)*r,ey+Math.sin(a)*r);}c2.closePath();c2.fill();c2.fillStyle='rgba(255,255,255,.8)';c2.shadowBlur=0;c2.beginPath();c2.arc(ex-er*.22,ey-er*.25,er*.16,0,Math.PI*2);c2.fill(); });
    } else if(style==='wink'){
      [[ex1,true],[ex2,false]].forEach(([ex,open])=>{ if(open){c2.fillStyle='rgba(255,255,255,0.92)';c2.beginPath();c2.arc(ex,ey,er,0,Math.PI*2);c2.fill();c2.fillStyle=ec;c2.beginPath();c2.arc(ex,ey,er*.72,0,Math.PI*2);c2.fill();c2.fillStyle=pc;c2.shadowBlur=0;c2.beginPath();c2.arc(ex+er*.15,ey+er*.1,er*.44,0,Math.PI*2);c2.fill();c2.fillStyle='rgba(255,255,255,.88)';c2.beginPath();c2.arc(ex-er*.18,ey-er*.22,er*.2,0,Math.PI*2);c2.fill();}else{c2.strokeStyle=ec;c2.lineWidth=3;c2.lineCap='round';c2.shadowBlur=8;c2.beginPath();c2.arc(ex,ey+er*.22,er*.72,Math.PI,0);c2.stroke();[[-er*.5,-er*.9],[0,-er*1.05],[er*.5,-er*.9]].forEach(([dx,dy])=>{c2.lineWidth=2;c2.beginPath();c2.moveTo(ex+dx*.8,ey+dy*.4);c2.lineTo(ex+dx,ey+dy*.6);c2.stroke();});} });
    } else if(style==='dizzy'){
      [ex1,ex2].forEach((ex,ei)=>{ c2.fillStyle='rgba(255,255,255,0.9)';c2.beginPath();c2.arc(ex,ey,er,0,Math.PI*2);c2.fill();c2.save();c2.translate(ex,ey);c2.rotate(glowT*3+ei*Math.PI);c2.strokeStyle=ec;c2.lineWidth=2;c2.lineCap='round';c2.shadowBlur=6;for(let arm=0;arm<2;arm++){c2.save();c2.rotate(arm*Math.PI);c2.beginPath();for(let i=0;i<=18;i++){const a=i*.4,r=i*(er*.042);c2.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c2.stroke();c2.restore();}c2.restore();c2.fillStyle=pc;c2.shadowBlur=0;c2.beginPath();c2.arc(ex,ey,er*.18,0,Math.PI*2);c2.fill(); });
    } else if(style==='happy'){
      [ex1,ex2].forEach(ex=>{ c2.strokeStyle=ec;c2.lineWidth=3;c2.lineCap='round';c2.shadowBlur=10;c2.beginPath();c2.arc(ex,ey+er*.32,er*.78,-Math.PI,0);c2.stroke();c2.fillStyle=hexAlpha(ec,.3);c2.shadowBlur=6;c2.beginPath();c2.arc(ex,ey+er*.98,er*.36,0,Math.PI*2);c2.fill(); });
    } else if(style==='heart'){
      [ex1,ex2].forEach(ex=>{ c2.save();c2.translate(ex,ey-.5);c2.scale(.85,.85);const s=er;c2.fillStyle=ec;c2.shadowColor=ec;c2.shadowBlur=12;c2.beginPath();c2.moveTo(0,s*.4);c2.bezierCurveTo(s*1.1,-s*.4,s*1.9,s*.4,0,s*1.6);c2.bezierCurveTo(-s*1.9,s*.4,-s*1.1,-s*.4,0,s*.4);c2.fill();c2.fillStyle='rgba(255,255,255,.45)';c2.shadowBlur=0;c2.beginPath();c2.arc(-s*.3,-s*.08,s*.22,0,Math.PI*2);c2.fill();c2.restore(); });
    } else if(style==='big'){
      [ex1,ex2].forEach(ex=>{ const br=er*1.38;c2.fillStyle='rgba(255,255,255,0.95)';c2.shadowBlur=14;c2.beginPath();c2.arc(ex,ey,br,0,Math.PI*2);c2.fill();c2.fillStyle=ec;c2.beginPath();c2.arc(ex,ey,br*.74,0,Math.PI*2);c2.fill();c2.fillStyle=pc;c2.shadowBlur=0;c2.beginPath();c2.arc(ex+br*.12,ey+br*.08,br*.48,0,Math.PI*2);c2.fill();c2.fillStyle='rgba(255,255,255,.9)';c2.beginPath();c2.arc(ex-br*.2,ey-br*.25,br*.22,0,Math.PI*2);c2.fill();c2.fillStyle='rgba(255,255,255,.5)';c2.beginPath();c2.arc(ex+br*.18,ey-br*.18,br*.1,0,Math.PI*2);c2.fill(); });
    } else if(style==='angry'){
      [ex1,ex2].forEach((ex,i)=>{ c2.fillStyle='rgba(255,255,255,0.88)';c2.beginPath();c2.arc(ex,ey,er,0,Math.PI*2);c2.fill();c2.fillStyle=ec;c2.beginPath();c2.arc(ex,ey,er*.72,0,Math.PI*2);c2.fill();c2.fillStyle=pc;c2.shadowBlur=0;c2.beginPath();c2.arc(ex+(i===0?.06:-.06)*R,ey+er*.1,er*.46,0,Math.PI*2);c2.fill();c2.strokeStyle=ec;c2.lineWidth=2.5;c2.lineCap='round';c2.shadowBlur=6;c2.beginPath();if(i===0){c2.moveTo(ex-er*.85,ey-er*1.1);c2.lineTo(ex+er*.28,ey-er*1.42);}else{c2.moveTo(ex-er*.28,ey-er*1.42);c2.lineTo(ex+er*.85,ey-er*1.1);}c2.stroke(); });
    } else if(style==='pixel'){
      const ps=R*.16;const grid=[[-2,-2],[-1,-2],[0,-2],[1,-2],[-2,-1],[1,-1],[-2,0],[-1,0],[0,0],[1,0],[-2,1],[-1,1],[0,1],[1,1]];
      [ex1,ex2].forEach(ex=>{ grid.forEach(([gx,gy])=>{ c2.fillStyle=hexAlpha(ec,Math.abs(gx)>1&&Math.abs(gy)>0?.45:1);c2.shadowBlur=Math.abs(gx)<1&&Math.abs(gy)<1?8:0;c2.fillRect(ex+gx*ps-ps/2,ey+gy*ps-ps/2,ps,ps); }); });
    } else if(style==='cyber'){
      [ex1,ex2].forEach(ex=>{ c2.fillStyle='rgba(0,0,0,.72)';c2.fillRect(ex-er*1.1,ey-er*.45,er*2.2,er*.9);c2.fillStyle=ec;c2.fillRect(ex-er,ey-er*.35,er*2,er*.7);c2.fillStyle=pc;c2.shadowBlur=0;c2.fillRect(ex-er*.28,ey-er*.28,er*.56,er*.56);c2.fillStyle='rgba(255,255,255,.45)';c2.fillRect(ex-er*.9,ey-er*.06,er*1.8,er*.14);c2.fillStyle=ec;c2.shadowBlur=8;[[ex-er,ey-er*.35],[ex+er,ey-er*.35],[ex-er,ey+er*.35],[ex+er,ey+er*.35]].forEach(([dx,dy])=>{c2.beginPath();c2.arc(dx,dy,2.5,0,Math.PI*2);c2.fill();});const scanY=ey-er*.3+((glowT*120)%(er*.6));c2.fillStyle='rgba(255,255,255,.15)';c2.fillRect(ex-er,scanY,er*2,2); });
    }
    c2.shadowBlur=0;
  }

  function die(){
    alive=false;
    for(let i=0;i<40;i++){ const a=Math.random()*Math.PI*2,spd=2+Math.random()*6; deathP.push({x,y:y+bobOffset,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-3,life:1+Math.random()*.5,col:[FD.bodyColor,FD.eyeColor,'#fff'][Math.floor(Math.random()*3)],sz:3+Math.random()*5}); }
  }

  return { reset,jump,update,draw,die, getY(){return y+bobOffset;}, getBaseY(){return y;}, getVY(){return vy;}, isAlive(){return alive;} };
})();

/* ─────────────────────────────────────────────────────────
   PILLARS  (theme-styled per background)
───────────────────────────────────────────────────────── */
const Pillars=(()=>{
  let list=[],spawnTimer=0;
  function reset(){ list=[];spawnTimer=0; }

  function spawn(score){
    const gap=DifficultyManager.getGap(score),safe=80;
    const topH=safe+Math.random()*(H-gap-safe*2);
    // All portal/realm mechanics removed — pure normal pillars
    list.push({x:W+C.PILLAR_WIDTH*.5,topH,botY:topH+gap,passed:false,glowT:Math.random()*Math.PI*2});
  }

  function update(dt,score){
    spawnTimer+=dt;
    if(spawnTimer>=DifficultyManager.getInterval(score)){ spawnTimer=0; spawn(score); }
    list.forEach(p=>{ p.x-=Game.speed*dt; p.glowT+=dt*2.2; if(!p.passed&&p.x+C.PILLAR_WIDTH*.5<W*C.PLAYER_X_RATIO){ p.passed=true; Game.onPillarPassed(p); } });
    list=list.filter(p=>p.x>-C.PILLAR_WIDTH);
  }

  function draw(){
    list.forEach(p=>{
      const gw=.7+.3*Math.sin(p.glowT);
      // Get themed pillar style from BackgroundManager
      const style=BackgroundManager.getPillarStyle();
      const realm=RealmManager.getCurrent();
      let base=style.base,glow=style.glow,acc=style.accent;
      // Realm overrides

      const gr=ctx.createLinearGradient(p.x,0,p.x+C.PILLAR_WIDTH,0);
      gr.addColorStop(0,hexAlpha(base,.7));gr.addColorStop(.5,hexAlpha(base,.9+.08*gw));gr.addColorStop(1,hexAlpha(acc,.7));

      ctx.save();
      ctx.shadowColor=glow;ctx.shadowBlur=16*gw;ctx.fillStyle=gr;
      // Top pillar
      roundedRect(ctx,p.x-C.PILLAR_WIDTH*.5,0,C.PILLAR_WIDTH,p.topH,6);ctx.fill();
      ctx.strokeStyle=`rgba(255,255,255,${style.edge*gw})`;ctx.lineWidth=1.5;ctx.shadowBlur=8;
      ctx.beginPath();ctx.moveTo(p.x-C.PILLAR_WIDTH*.5+1,0);ctx.lineTo(p.x-C.PILLAR_WIDTH*.5+1,p.topH);ctx.stroke();
      ctx.beginPath();ctx.moveTo(p.x+C.PILLAR_WIDTH*.5-1,0);ctx.lineTo(p.x+C.PILLAR_WIDTH*.5-1,p.topH);ctx.stroke();
      ctx.fillStyle=`rgba(255,255,255,${.22*gw})`;ctx.fillRect(p.x-C.PILLAR_WIDTH*.5,p.topH-3,C.PILLAR_WIDTH,3);
      // Bottom pillar
      ctx.shadowColor=glow;ctx.shadowBlur=16*gw;ctx.fillStyle=gr;
      roundedRect(ctx,p.x-C.PILLAR_WIDTH*.5,p.botY,C.PILLAR_WIDTH,H-p.botY+C.PILLAR_OVERHANG,6);ctx.fill();
      ctx.strokeStyle=`rgba(255,255,255,${style.edge*gw})`;ctx.lineWidth=1.5;ctx.shadowBlur=8;
      ctx.beginPath();ctx.moveTo(p.x-C.PILLAR_WIDTH*.5+1,p.botY);ctx.lineTo(p.x-C.PILLAR_WIDTH*.5+1,H+C.PILLAR_OVERHANG);ctx.stroke();
      ctx.beginPath();ctx.moveTo(p.x+C.PILLAR_WIDTH*.5-1,p.botY);ctx.lineTo(p.x+C.PILLAR_WIDTH*.5-1,H+C.PILLAR_OVERHANG);ctx.stroke();
      ctx.fillStyle=`rgba(255,255,255,${.22*gw})`;ctx.fillRect(p.x-C.PILLAR_WIDTH*.5,p.botY,C.PILLAR_WIDTH,3);

      // No portal labels — portals removed
            ctx.restore();
    });
  }

  function collidesWith(px,py,pr){
    for(const p of list){ if(px+pr>p.x-C.PILLAR_WIDTH*.5&&px-pr<p.x+C.PILLAR_WIDTH*.5){ if(py-pr<p.topH||py+pr>p.botY) return true; } }
    return false;
  }

  return { reset,update,draw,collidesWith, get list(){return list;} };
})();

/* ─────────────────────────────────────────────────────────
   SHARDS
───────────────────────────────────────────────────────── */
const Shards=(()=>{
  let list=[];
  function reset(){ list=[]; }
  function trySpawn(){
    if(Math.random()>C.SHARD_CHANCE) return;
    const lp=Pillars.list?.[Pillars.list.length-1]; if(!lp) return;
    const cy=lp.topH+(lp.botY-lp.topH)*.5;
    list.push({x:lp.x,y:cy,collected:false,glowT:Math.random()*Math.PI*2,spinT:0});
  }
  function spawnBonus(x,y,count=3){
    for(let i=0;i<count;i++) list.push({x:x+(i-1)*32,y:y+(Math.random()-.5)*40,collected:false,glowT:Math.random()*Math.PI*2,spinT:0});
  }
  function update(dt){ list.forEach(s=>{s.x-=Game.speed*dt;s.glowT+=dt*3.5;s.spinT+=dt*3;}); list=list.filter(s=>!s.collected&&s.x>-20); }
  function draw(){
    list.forEach(s=>{
      const gw=.7+.3*Math.sin(s.glowT),R=C.SHARD_RADIUS;
      ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.spinT);
      ctx.shadowColor='#ffd700';ctx.shadowBlur=16*gw;ctx.fillStyle=`rgba(255,215,0,${.85+.12*gw})`;
      ctx.beginPath();ctx.moveTo(0,-R*1.4);ctx.lineTo(R*.9,0);ctx.lineTo(0,R*1.4);ctx.lineTo(-R*.9,0);ctx.closePath();ctx.fill();
      ctx.fillStyle=`rgba(255,255,200,${.55*gw})`;ctx.beginPath();ctx.moveTo(0,-R*1.4);ctx.lineTo(R*.9,0);ctx.lineTo(0,-R*.4);ctx.closePath();ctx.fill();
      ctx.restore();
    });
  }
  function checkCollect(px,py){ const got=[]; list.forEach(s=>{if(!s.collected&&Math.hypot(s.x-px,s.y-py)<C.SHARD_RADIUS+C.PLAYER_RADIUS*.9){s.collected=true;got.push({x:s.x,y:s.y});}}); return got; }
  return { reset,trySpawn,spawnBonus,update,draw,checkCollect, get list(){return list;} };
})();

/* ─────────────────────────────────────────────────────────
   POPUPS
───────────────────────────────────────────────────────── */
const Popups=(()=>{
  let list=[];
  function spawn(x,y,text,color='#ffd700'){ list.push({x,y,text,color,life:1,vy:-60}); }
  function update(dt){ list.forEach(p=>{p.y+=p.vy*dt;p.vy*=.96;p.life-=dt/C.POPUP_DUR*1000;}); list=list.filter(p=>p.life>0); }
  function draw(){ list.forEach(p=>{ ctx.save();ctx.globalAlpha=p.life;ctx.font=`bold ${Math.round(14+4*p.life)}px 'Orbitron',monospace`;ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=10;ctx.textAlign='center';ctx.fillText(p.text,p.x,p.y);ctx.restore(); }); }
  function reset(){ list=[]; }
  return {spawn,update,draw,reset};
})();

/* ─────────────────────────────────────────────────────────
   GAME CONTROLLER
───────────────────────────────────────────────────────── */
const Game=(()=>{
  let score=0,shakeFrames=0,shakeAmt=0,zoomLevel=1;
  let comboCount=1,comboTimer=0,maxCombo=1,shardsThisRun=0;
  let running=false,deathHandled=false;
  // Score event flags

  function reset(){
    score=0;shakeFrames=0;shakeAmt=0;zoomLevel=1;
    comboCount=1;comboTimer=0;maxCombo=1;shardsThisRun=0;
    deathHandled=false;running=true;
    DifficultyManager.reset(); RealmManager.reset(); VibeManager.reset();
    Pillars.reset(); Shards.reset(); Popups.reset();
    BackgroundManager.reset(); Player.reset();
    updateHUD();
    document.getElementById('hudStage').textContent=DifficultyManager.getStageName(0);
  }

  function onPillarPassed(pillar){
    score++;
    const stageChanged=DifficultyManager.update(score);
    if(stageChanged){ showStageBanner(DifficultyManager.current.name); SFX.stage(); }
    // Score milestones handled by VibeManager.update() in Game.update()
    Shards.trySpawn(); SFX.pillar(); updateHUD();
    Events.emit('score',{score});
    const el=document.getElementById('hudScore');
    const elBig=document.getElementById('hudScoreBig');
    el.style.transform='scale(1.45)'; setTimeout(()=>el.style.transform='',140);
    elBig.style.transform='translateX(-50%) scale(1.3)'; setTimeout(()=>elBig.style.transform='translateX(-50%)',160);
  }

  // Direct score setter for dev panel — fully syncs all systems
  function setScore(targetScore){
    const prev=score;
    score=Math.max(0,targetScore);
    // Sync difficulty stage (silent — no banner spam)
    DifficultyManager.syncTo(score);
    // Show banner for current stage
    showStageBanner(DifficultyManager.current.name);
    // Fire score events that would have triggered
    updateHUD();
    Events.emit('score',{score});
  }

  function onShardCollected(sx,sy){
    comboTimer=C.COMBO_WINDOW; comboCount=Math.min(comboCount+1,6); maxCombo=Math.max(maxCombo,comboCount);
    shardsThisRun+=C.SHARD_VALUE; PD.totalShards+=C.SHARD_VALUE; PD.totalCurrency=PD.totalShards;
    save(); SFX.shard();
    if(comboCount>1) SFX.combo(comboCount);
    const lbl=comboCount>1?`+${C.SHARD_VALUE} ×${comboCount} COMBO`:`+${C.SHARD_VALUE} 💎`;
    Popups.spawn(sx,sy,lbl,comboCount>2?'#ff00ff':'#ffd700');
    updateHUD();
  }

  function showStageBanner(name){
    const bn=document.getElementById('stageBanner');
    document.getElementById('stageBannerName').textContent=name;
    document.getElementById('hudStage').textContent=name;
    bn.classList.remove('hidden','banner-show');
    void bn.offsetWidth;
    bn.classList.add('banner-show');
    setTimeout(()=>bn.classList.add('hidden'),2700);
  }

  function update(dt){
    if(!running) return;
    if(comboTimer>0){comboTimer-=dt*1000;if(comboTimer<=0){comboCount=1;document.getElementById('hudComboWrap').classList.add('hidden');}}
    if(comboCount>1){document.getElementById('hudComboWrap').classList.remove('hidden');document.getElementById('hudCombo').textContent=`COMBO ×${comboCount}`;}
    if(shakeFrames>0) shakeFrames--; else shakeAmt=Math.max(0,shakeAmt-1);
    const spd=DifficultyManager.getSpeed(score);
    const sm=spd/290;
    const tz=Math.min(C.ZOOM_MAX,1+(sm-1)*.04);
    zoomLevel=lerp(zoomLevel,tz,dt*2.5);
    VibeManager.update(score);
    Player.update(dt);
    const px=W*C.PLAYER_X_RATIO, py=Player.getY(), py2=Player.getBaseY();
    if(py-C.PLAYER_RADIUS<0||py+C.PLAYER_RADIUS>H){ triggerDeath(); return; }
    if(Player.isAlive()&&Pillars.collidesWith(px,py2,C.PLAYER_RADIUS*.86)){ triggerDeath(); return; }
    Shards.checkCollect(px,py2).forEach(s=>onShardCollected(s.x,s.y));
    Pillars.update(dt,score); Shards.update(dt); Popups.update(dt);
  }

  function triggerDeath(){
    if(deathHandled) return;
    deathHandled=true; running=false;
    Player.die(); SFX.death();
    if(FD.shake){shakeFrames=C.SHAKE_FRAMES;shakeAmt=C.SHAKE_AMP;}
    setTimeout(()=>showGameOver(),1100);
  }

  function showGameOver(){
    const prev=PD.highScores.flight,isNew=score>prev;
    if(isNew){ PD.highScores.flight=score; SFX.levelUp(); }
    FD.gamesPlayed++; FD.totalScore+=score;
    FD.maxCombo=Math.max(FD.maxCombo||1,maxCombo);
    if(!FD.bgsSeen) FD.bgsSeen=[];
    if(!FD.bgsSeen.includes(FD.background)) FD.bgsSeen.push(FD.background);
    updateGlobalLevel();
    const unlocks=checkUnlocks(score);
    if(unlocks.length) SFX.unlock();
    save();
    setTimeout(()=>checkAchievements(),700);
    // Hub integration
    try{ hubReportSession('flight',{score,shards:shardsThisRun,hubXP:score*10+Math.floor(shardsThisRun*.5)}); }catch(_){}
    document.getElementById('goScore').textContent=score;
    document.getElementById('goBest').textContent=Math.max(score,prev);
    document.getElementById('goShards').textContent='+'+shardsThisRun+' 💎';
    document.getElementById('goCombo').textContent='×'+maxCombo;
    document.getElementById('newBestBadge').classList.toggle('hidden',!isNew);
    const ub=document.getElementById('unlockBox');
    if(unlocks.length){ub.classList.remove('hidden');ub.textContent='🔓 UNLOCKED: '+unlocks.join(', ');}
    else ub.classList.add('hidden');
    gameState=STATE.DEAD;
    setTimeout(()=>showScreen('gameOverScreen'),180);
  }

  function draw(){
    ctx.save();
    let sx=0,sy=0;
    if(shakeFrames>0||shakeAmt>0){sx=(Math.random()-.5)*shakeAmt*2;sy=(Math.random()-.5)*shakeAmt*2;}
    ctx.translate(W/2+sx,H/2+sy); ctx.scale(zoomLevel,zoomLevel); ctx.translate(-W/2,-H/2);
    // Background is drawn in main loop BEFORE Game.draw() — do NOT draw it again here
    Pillars.draw(); Shards.draw(); Player.draw(ctx); Popups.draw();
    ctx.restore();

  }

  function updateHUD(){
    document.getElementById('hudScore').textContent=score;
    document.getElementById('hudScoreBig').textContent=score;
    document.getElementById('hudBest').textContent='BEST: '+PD.highScores.flight;
    document.getElementById('hudShards').textContent='💎 '+PD.totalShards;
    document.getElementById('hudStage').textContent=DifficultyManager.getStageName(score);
    document.getElementById('menuShards').textContent=PD.totalShards;
    document.getElementById('menuBest').textContent=PD.highScores.flight;
    document.getElementById('playerLevel').textContent=PD.playerLevel||1;
  }

  return {
    reset,update,draw,onPillarPassed,updateHUD,setScore,
    get score(){ return score; },
    get speed(){ return DifficultyManager.getSpeed(score); },
    get running(){ return running; },
  };
})();
window.Game=Game;

/* ─────────────────────────────────────────────────────────
   DEV MANAGER
───────────────────────────────────────────────────────── */
const DevManager=(()=>{
  const DEV_KEY='neon2026';
  let active=new URLSearchParams(window.location.search).get('dev')===DEV_KEY;
  let typed='';

  function init(){
    if(active) activate();
    document.addEventListener('keydown',e=>{
      if(gameState!==STATE.MENU&&gameState!==STATE.LOADING) return;
      typed=(typed+e.key).slice(-7);
      if(typed.toLowerCase()==='neondev'){ activate(); typed=''; }
    });
  }

  function activate(){
    active=true;
    document.getElementById('devBtn')?.classList.remove('hidden');
    console.log('%c[DEV MODE ACTIVE] — ?dev=neon2026','color:#00f0ff;font-weight:bold');
  }

  function openPanel(){
    document.getElementById('devScoreInput').value=42;
    updateStatus();
    showScreen('devPanel');
  }

  function closePanel(){ showScreen('mainMenu'); }

  function updateStatus(){
    const el=document.getElementById('devStatus'); if(!el) return;
    const isPlaying=gameState===STATE.PLAYING;
    el.innerHTML=`
      <div class="dev-stat"><span>Stage:</span><span>${isPlaying?DifficultyManager.current.name:'—'}</span></div>
      <div class="dev-stat"><span>Realm:</span><span>${RealmManager.getCurrent()||'none'}</span></div>
      <div class="dev-stat"><span>Diff ×:</span><span>${isPlaying?DifficultyManager.getDiffMult(Game.score).toFixed(2):'—'}</span></div>
      <div class="dev-stat"><span>Score:</span><span>${isPlaying?Game.score:'—'}</span></div>
      <div class="dev-stat"><span>BG:</span><span>${FD.background}</span></div>
    `;
  }

  function jumpScore(target){
    const wasPlaying=gameState===STATE.PLAYING;
    if(!wasPlaying){
      beginGame();
      setTimeout(()=>{ Game.setScore(target); updateStatus(); },120);
    } else {
      Game.setScore(target);
      updateStatus();
    }
    closePanel();
  }

  function forceVibe(vibeId){
    if(gameState!==STATE.PLAYING){
      beginGame();
      setTimeout(()=>{ VibeManager.applyVibe(vibeId, true); updateStatus(); },160);
    } else {
      VibeManager.applyVibe(vibeId, true);
      updateStatus();
    }
    closePanel();
  }

  function unlockAll(){
    SKINS.forEach(s=>{if(!FD.unlockedSkins.includes(s.id))FD.unlockedSkins.push(s.id);});
    BACKGROUNDS.forEach(b=>{if(!FD.unlockedBgs.includes(b.id))FD.unlockedBgs.push(b.id);});
    EYE_STYLES.forEach(e=>{if(!FD.unlockedEyes.includes(e.id))FD.unlockedEyes.push(e.id);});
    ACHIEVEMENTS.forEach(a=>{if(!FD.achievements.includes(a.id))FD.achievements.push(a.id);});
    save(); alert('All unlocks granted ✓');
  }

  function resetSave(){
    if(confirm('Reset ALL save data? This cannot be undone.')){ localStorage.removeItem(ECOSYSTEM_KEY); location.reload(); }
  }

  return { init, activate, openPanel, closePanel, updateStatus, jumpScore, forceVibe, unlockAll, resetSave, get active(){ return active; } };
})();

/* ─────────────────────────────────────────────────────────
   MAIN LOOP  (single background draw per frame)
───────────────────────────────────────────────────────── */
let lastTime=0,loopActive=false;
function mainLoop(ts){
  if(!loopActive) return;
  requestAnimationFrame(mainLoop);
  const dt=Math.min((ts-lastTime)/1000,.05); lastTime=ts;
  // Always draw background first — exactly once per frame
  if(gameState===STATE.PLAYING){
    BackgroundManager.draw(dt);
    Game.update(dt);
    Game.draw();
  } else if(gameState===STATE.DEAD){
    BackgroundManager.draw(dt);
    Game.draw();
  } else if(gameState===STATE.MENU||gameState===STATE.PAUSED){
    BackgroundManager.draw(dt);
    drawMenuPreview(ts);
  }
  // Update dev panel status if open
  if(gameState===STATE.PLAYING) DevManager.updateStatus();
}
function startLoop(){ loopActive=true; lastTime=performance.now(); requestAnimationFrame(mainLoop); }
function stopLoop()  { loopActive=false; }

/* ─────────────────────────────────────────────────────────
   MENU PREVIEW
───────────────────────────────────────────────────────── */
let previewT=0;
function drawMenuPreview(ts){
  previewT=ts*.001;
  ['menuPreview','custPreview'].forEach(id=>{
    const cvs=document.getElementById(id); if(!cvs||cvs.offsetParent===null) return;
    const c=cvs.getContext('2d'),W2=cvs.width,H2=cvs.height;
    c.clearRect(0,0,W2,H2);c.fillStyle='rgba(5,5,22,.9)';c.fillRect(0,0,W2,H2);
    const R=16,cx=W2/2,cy=H2/2+Math.sin(previewT*C.BOB_FREQ*Math.PI*2)*C.BOB_AMP;
    const halo=c.createRadialGradient(cx,cy,R*.4,cx,cy,R*2.5);
    halo.addColorStop(0,hexAlpha(FD.bodyColor,.28));halo.addColorStop(1,hexAlpha(FD.bodyColor,0));
    c.fillStyle=halo;c.beginPath();c.arc(cx,cy,R*2.5,0,Math.PI*2);c.fill();
    c.shadowColor=FD.bodyColor;c.shadowBlur=16;
    const bg2=c.createRadialGradient(cx-R*.28,cy-R*.28,0,cx,cy,R);
    bg2.addColorStop(0,lightenColor(FD.bodyColor,60));bg2.addColorStop(.55,FD.bodyColor);bg2.addColorStop(1,darkenColor(FD.bodyColor,40));
    c.fillStyle=bg2;roundedRect(c,cx-R,cy-R,R*2,R*2,R*.52);c.fill();
    c.shadowBlur=0;c.fillStyle='rgba(255,255,255,.2)';c.beginPath();c.ellipse(cx-R*.18,cy-R*.3,R*.5,R*.28,-.3,0,Math.PI*2);c.fill();
    for(let i=1;i<=5;i++){c.save();c.globalAlpha=.6*(1-i/5);c.fillStyle=FD.trailColor;c.shadowColor=FD.trailColor;c.shadowBlur=5;c.beginPath();c.arc(cx-i*9,cy,R*.28*(1-i*.14),0,Math.PI*2);c.fill();c.restore();}
  });
}

/* ─────────────────────────────────────────────────────────
   INPUT  (mouse click jump at document level — avoids UI conflicts)
───────────────────────────────────────────────────────── */
function handleJump(){
  if(gameState===STATE.PLAYING&&Game.running){ Player.jump(); getAC(); }
}
document.addEventListener('keydown',e=>{
  if(e.code==='Space'||e.code==='ArrowUp'){ e.preventDefault(); handleJump(); }
  if((e.code==='Escape'||e.code==='KeyP')&&gameState===STATE.PLAYING) togglePause();
});
document.addEventListener('touchstart',e=>{ e.preventDefault(); handleJump(); },{passive:false});
// Mouse click: document-level, filter out UI elements
document.addEventListener('mousedown',e=>{
  if(e.target.closest('button,input,label,select,a,.tab-btn,.skin-item,.bg-item,.eye-item,.ach-item,.dev-realm-btn,.dev-input')) return;
  handleJump();
});

/* ─────────────────────────────────────────────────────────
   UI WIRING
───────────────────────────────────────────────────────── */
document.getElementById('menuPlayBtn').onclick      =()=>beginGame();
document.getElementById('hubNavBtn')?.addEventListener('click',()=>{
  if(window.parent!==window){ window.parent.postMessage({type:'returnToHub'},'*'); }
  else{ window.location.href='../index.html'; }
});
document.getElementById('menuCustomizeBtn').onclick =()=>openCustomize();
document.getElementById('menuSettingsBtn').onclick  =()=>openSettings();
document.getElementById('menuAchBtn').onclick       =()=>{ buildAchievementsUI(); showScreen('achievementsScreen'); };
document.getElementById('achBackBtn').onclick       =()=>goToMenu();
document.getElementById('devBtn').onclick           =()=>DevManager.openPanel();
document.getElementById('devCloseBtn').onclick      =()=>DevManager.closePanel();
document.getElementById('pauseBtn').onclick         =togglePause;
document.getElementById('pauseResumeBtn').onclick   =resumeGame;
document.getElementById('pauseMenuBtn').onclick     =quitToMenu;
document.getElementById('goRestartBtn').onclick     =()=>beginGame();
document.getElementById('goMenuBtn').onclick        =quitToMenu;
document.getElementById('custBackBtn').onclick      =()=>{ save();goToMenu(); };
document.getElementById('settBackBtn').onclick      =()=>{ save();goToMenu(); };
document.getElementById('devJumpScore')?.addEventListener('click',()=>{ const v=parseInt(document.getElementById('devScoreInput').value)||0; DevManager.jumpScore(v); });
document.getElementById('devVibeLegend')?.addEventListener('click',()=>DevManager.forceVibe('legend'));
document.getElementById('devVibeSpectral')?.addEventListener('click',()=>DevManager.forceVibe('spectral'));
document.getElementById('devVibeCursed')?.addEventListener('click',()=>DevManager.forceVibe('cursed'));
document.getElementById('devVibeHell')?.addEventListener('click',()=>DevManager.forceVibe('hell'));
document.getElementById('devVibeHeaven')?.addEventListener('click',()=>DevManager.forceVibe('heaven'));
document.getElementById('devVibeReset')?.addEventListener('click',()=>{ VibeManager.reset(); DevManager.closePanel(); });
document.getElementById('devUnlockAll')?.addEventListener('click',()=>DevManager.unlockAll());
document.getElementById('devResetSave')?.addEventListener('click',()=>DevManager.resetSave());

function beginGame(){ getAC(); gameState=STATE.PLAYING; Game.reset(); showScreen('gameHUD'); }
function togglePause(){ if(gameState===STATE.PLAYING){gameState=STATE.PAUSED;showScreen('pauseOverlay');}else if(gameState===STATE.PAUSED)resumeGame(); }
function resumeGame() { gameState=STATE.PLAYING; lastTime=performance.now(); showScreen('gameHUD'); }
function quitToMenu() { gameState=STATE.MENU; goToMenu(); }
function goToMenu()   { Game.updateHUD(); showScreen('mainMenu'); }
function openCustomize(){ gameState=STATE.MENU; buildCustomizeUI(); showScreen('customizeScreen'); }
function openSettings() { gameState=STATE.MENU; populateSettings(); showScreen('settingsScreen'); }

/* ─────────────────────────────────────────────────────────
   CUSTOMIZE UI
───────────────────────────────────────────────────────── */
function buildCustomizeUI(){
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-pane').forEach(p=>p.classList.add('hidden'));
      document.getElementById('tab-'+btn.dataset.tab)?.classList.remove('hidden');
    };
  });
  buildSkinGrid(); buildBgGrid(); buildEyeGrid();
}

function buildSkinGrid(){
  const grid=document.getElementById('skinGrid'); grid.innerHTML='';
  SKINS.forEach(skin=>{
    const unlocked=!skin.req||FD.unlockedSkins.includes(skin.id);
    const selected=FD.activeSkin===skin.id;
    const div=document.createElement('div');
    div.className='skin-item'+(selected?' selected':'')+(unlocked?'':' locked');
    const sw=document.createElement('canvas');sw.className='skin-swatch';sw.width=38;sw.height=38;drawSkinSwatch(sw.getContext('2d'),skin,38);div.appendChild(sw);
    const lbl=document.createElement('div');lbl.className='skin-label';lbl.textContent=skin.label;div.appendChild(lbl);
    if(!unlocked){const bd=document.createElement('div');bd.className='lock-badge';bd.textContent=skin.reqLabel||'LOCKED';div.appendChild(bd);}
    if(unlocked) div.onclick=()=>{ applySkin(skin.id); buildSkinGrid(); };
    grid.appendChild(div);
  });
}

function drawSkinSwatch(c,skin,size){
  c.fillStyle='rgba(5,5,22,.9)';c.fillRect(0,0,size,size);
  const R=size*.35,cx=size*.5,cy=size*.5;
  c.shadowColor=skin.bodyColor;c.shadowBlur=10;
  const g=c.createRadialGradient(cx-R*.2,cy-R*.2,0,cx,cy,R);g.addColorStop(0,lightenColor(skin.bodyColor,60));g.addColorStop(.55,skin.bodyColor);g.addColorStop(1,darkenColor(skin.bodyColor,40));
  c.fillStyle=g;roundedRect(c,cx-R,cy-R,R*2,R*2,R*.52);c.fill();
  c.shadowBlur=0;c.fillStyle='rgba(255,255,255,.2)';c.beginPath();c.ellipse(cx-R*.18,cy-R*.3,R*.5,R*.28,-.3,0,Math.PI*2);c.fill();
  c.fillStyle=skin.eyeColor;c.shadowColor=skin.eyeColor;c.shadowBlur=4;
  const er=R*.22;[cx-R*.28,cx+R*.28].forEach(ex=>{c.beginPath();c.arc(ex,cy-R*.08,er,0,Math.PI*2);c.fill();});
  c.shadowBlur=0;
}

function buildBgGrid(){
  const grid=document.getElementById('bgGrid'); grid.innerHTML='';
  BACKGROUNDS.forEach(bg=>{
    const unlocked=!bg.req||FD.unlockedBgs.includes(bg.id);
    const selected=FD.background===bg.id;
    const div=document.createElement('div');
    div.className='bg-item'+(selected?' selected':'')+(unlocked?'':' locked');
    const th=document.createElement('canvas');th.width=80;th.height=44;BackgroundManager.renderBgThumb(th.getContext('2d'),bg.id,80,44);
    const pv=document.createElement('div');pv.className='bg-preview';pv.appendChild(th);div.appendChild(pv);
    const nm=document.createElement('div');nm.className='bg-name';nm.textContent=bg.label;div.appendChild(nm);
    if(!unlocked){const rq=document.createElement('div');rq.className='bg-req';rq.textContent=bg.reqLabel||'LOCKED';div.appendChild(rq);}
    else{const bd=document.createElement('div');bd.className='theme-badge';bd.textContent=selected?'✓ ACTIVE':'APPLY';div.appendChild(bd);}
    if(unlocked) div.onclick=()=>{ FD.background=bg.id; save(); buildBgGrid(); };
    grid.appendChild(div);
  });
}

/* ─────────────────────────────────────────────────────────
   EYE GRID
───────────────────────────────────────────────────────── */
function buildEyeGrid(){
  const grid=document.getElementById('eyeGrid'); if(!grid) return;
  grid.innerHTML='';
  EYE_STYLES.forEach(ey=>{
    const unlocked=!ey.req||(ey.req.type==='ach'&&FD.achievements.includes(ey.req.val))||(ey.req.type==='score'&&PD.highScores.flight>=ey.req.val)||(ey.req.type==='shards'&&PD.totalShards>=ey.req.val)||FD.unlockedEyes.includes(ey.id);
    const selected=FD.eyeStyle===ey.id;
    const div=document.createElement('div');
    div.className='eye-item'+(selected?' selected':'')+(unlocked?'':' locked');
    const cvs=document.createElement('canvas');cvs.width=54;cvs.height=54;cvs.className='eye-swatch';drawEyeSwatch(cvs.getContext('2d'),ey,54);div.appendChild(cvs);
    const lbl=document.createElement('div');lbl.className='eye-label';lbl.textContent=ey.label;div.appendChild(lbl);
    const reqStr=unlocked?ey.desc:(ey.req?.type==='ach'?'Earn trophy':ey.reqLabel||'LOCKED');
    const desc=document.createElement('div');desc.className='eye-desc';desc.textContent=reqStr;div.appendChild(desc);
    if(unlocked) div.onclick=()=>{ applyEye(ey.id); buildEyeGrid(); };
    grid.appendChild(div);
  });
}

function drawEyeSwatch(c,ey,sz){
  c.fillStyle='rgba(5,5,22,.95)';c.fillRect(0,0,sz,sz);
  const R=sz*.28,cx=sz*.5,cy=sz*.55;
  c.shadowColor='#00f0ff';c.shadowBlur=8;c.fillStyle='rgba(0,240,255,.8)';roundedRect(c,cx-R,cy-R,R*2,R*2,R*.5);c.fill();c.shadowBlur=0;
  const ec=FD.eyeColor||'#ffffff',er=R*.32,ex1=cx-R*.3,ex2=cx+R*.3,eyY=cy-R*.06;
  c.shadowColor=ec;c.shadowBlur=5;
  const id=ey.id;
  if(id==='happy'||id==='sleepy'||id==='wink'){
    c.strokeStyle=ec;c.lineWidth=2;c.lineCap='round';c.beginPath();c.arc(ex1,eyY+er*.3,er*.65,-Math.PI,0);c.stroke();
    if(id==='sleepy'){c.fillStyle='rgba(255,255,255,.85)';c.beginPath();c.arc(ex2,eyY,er,0,Math.PI*2);c.fill();c.fillStyle='rgba(5,5,22,.6)';c.beginPath();c.ellipse(ex2,eyY-er*.35,er*1.05,er*.65,0,Math.PI,0);c.fill();}
    else{c.fillStyle='rgba(255,255,255,.92)';c.beginPath();c.arc(ex2,eyY,er,0,Math.PI*2);c.fill();c.fillStyle=ec;c.beginPath();c.arc(ex2,eyY,er*.65,0,Math.PI*2);c.fill();}
  } else if(id==='angry'){
    [ex1,ex2].forEach((ex,i)=>{c.fillStyle='rgba(255,255,255,.88)';c.beginPath();c.arc(ex,eyY,er,0,Math.PI*2);c.fill();c.strokeStyle=ec;c.lineWidth=2;c.beginPath();if(i===0){c.moveTo(ex-er*.7,eyY-er*.95);c.lineTo(ex+er*.2,eyY-er*1.28);}else{c.moveTo(ex-er*.2,eyY-er*1.28);c.lineTo(ex+er*.7,eyY-er*.95);}c.stroke();});
  } else {
    [ex1,ex2].forEach(ex=>{c.fillStyle='rgba(255,255,255,.92)';c.beginPath();c.arc(ex,eyY,er*(id==='big'?1.35:1),0,Math.PI*2);c.fill();c.fillStyle=ec;c.shadowBlur=4;c.beginPath();c.arc(ex,eyY,er*(id==='big'?.88:.65),0,Math.PI*2);c.fill();c.fillStyle='#000';c.shadowBlur=0;c.beginPath();c.arc(ex+er*.1,eyY+er*.08,er*(id==='big'?.48:.4),0,Math.PI*2);c.fill();});
  }
  c.shadowBlur=0;c.font=`${Math.round(sz*.26)}px serif`;c.textAlign='right';c.fillStyle='rgba(255,255,255,.9)';c.fillText(ey.icon,sz-2,sz*.28);
}

/* ─────────────────────────────────────────────────────────
   SETTINGS UI
───────────────────────────────────────────────────────── */
function populateSettings(){
  document.getElementById('settParticles').checked=FD.particles;
  document.getElementById('settDensity').value=FD.trailDensity;
  document.getElementById('densityVal').textContent=FD.trailDensity;
  document.getElementById('settSound').checked=FD.sound;
  document.getElementById('settShake').checked=FD.shake;
  document.getElementById('settLight').checked=FD.lightMode;
  document.getElementById('settParticles').onchange=e=>{FD.particles=e.target.checked;save();};
  document.getElementById('settDensity').oninput=e=>{FD.trailDensity=parseInt(e.target.value);document.getElementById('densityVal').textContent=e.target.value;save();};
  document.getElementById('settSound').onchange=e=>{FD.sound=e.target.checked;save();};
  document.getElementById('settShake').onchange=e=>{FD.shake=e.target.checked;save();};
  document.getElementById('settLight').onchange=e=>{FD.lightMode=e.target.checked;document.body.classList.toggle('light-mode',FD.lightMode);save();};
}

/* ─────────────────────────────────────────────────────────
   ACHIEVEMENTS SCREEN
───────────────────────────────────────────────────────── */
function buildAchievementsUI(){
  const grid=document.getElementById('achGrid'); if(!grid) return;
  grid.innerHTML='';
  ACHIEVEMENTS.forEach(a=>{
    const earned=FD.achievements.includes(a.id);
    const div=document.createElement('div');
    div.className='ach-item'+(earned?' earned':'');
    div.innerHTML=`<div class="ach-icon">${earned?a.icon:'🔒'}</div><div class="ach-info"><div class="ach-name">${a.name}</div><div class="ach-desc">${earned?a.desc:'???'}</div></div>${earned?'<div class="ach-check">✓</div>':''}`;
    grid.appendChild(div);
  });
}

/* ─────────────────────────────────────────────────────────
   ACHIEVEMENT TOAST
───────────────────────────────────────────────────────── */
let _toastQ=[],_toastBusy=false;
function showAchievementToast(a){ _toastQ.push(a); if(!_toastBusy) _nextToast(); }
function _nextToast(){
  if(!_toastQ.length){_toastBusy=false;return;}
  _toastBusy=true;
  const a=_toastQ.shift();
  const el=document.getElementById('achToast'); if(!el){_toastBusy=false;return;}
  document.getElementById('achToastIcon').textContent=a.icon;
  document.getElementById('achToastName').textContent=a.name;
  document.getElementById('achToastDesc').textContent=a.desc;
  el.classList.remove('toast-hide');el.classList.add('toast-show');
  SFX.unlock();
  setTimeout(()=>{ el.classList.remove('toast-show');el.classList.add('toast-hide'); setTimeout(()=>{ el.classList.remove('toast-hide');_nextToast(); },500); },3200);
}

/* ─────────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────────── */
function lerp(a,b,t){ return a+(b-a)*Math.min(1,t); }
function hexAlpha(hex,alpha){
  try{const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;}
  catch(_){return `rgba(0,240,255,${alpha})`;}
}
function lightenColor(hex,amt){
  try{return `rgb(${Math.min(255,parseInt(hex.slice(1,3),16)+amt)},${Math.min(255,parseInt(hex.slice(3,5),16)+amt)},${Math.min(255,parseInt(hex.slice(5,7),16)+amt)})`;}
  catch(_){return '#ffffff';}
}
function darkenColor(hex,amt){
  try{return `rgb(${Math.max(0,parseInt(hex.slice(1,3),16)-amt)},${Math.max(0,parseInt(hex.slice(3,5),16)-amt)},${Math.max(0,parseInt(hex.slice(5,7),16)-amt)})`;}
  catch(_){return '#000000';}
}
function roundedRect(c,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
}

/* ─────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────── */
function boot(){
  resize();
  BackgroundManager.init();
  if(FD.lightMode) document.body.classList.add('light-mode');
  const sk=SKINS.find(s=>s.id===FD.activeSkin)||SKINS[0];
  if(!FD.customEye) applySkin(sk.id);
  else{ FD.bodyColor=sk.bodyColor;FD.eyeColor=sk.eyeColor;FD.trailColor=sk.trailColor;FD.trailShape=sk.trailShape; }
  DevManager.init();
  gameState=STATE.LOADING; showScreen('loadingScreen'); startLoop();
  setTimeout(()=>{
    document.getElementById('bgFade').style.opacity='1';
    setTimeout(()=>{
      gameState=STATE.MENU; showScreen('mainMenu'); Game.updateHUD();
      document.getElementById('bgFade').style.opacity='0';
      if(FD.gamesPlayed>0) setTimeout(()=>checkAchievements(),800);
    },380);
  },2200);
  console.log('[NeonArcade] Neon Flight™ v3.0 — Neon Inc™ © 2026');
}
boot();

/* ─────────────────────────────────────────────────────────
   NEON ARCADE HUB BRIDGE
───────────────────────────────────────────────────────── */
function hubXpNeeded(lv){ return 100+(lv-1)*75; }
function hubDefaultData(){ return {level:1,xp:0,shards:0,streak:0,lastPlay:'',stats:{snake:{games:0,best:0,apples:0},flight:{games:0,best:0,shards:0}},quests:{date:'',slots:[],progress:{},claimed:{}},crossAch:{}}; }
function hubReportSession(game,data){
  const HUB_KEY='neonArcade_hub';
  try{
    const raw=localStorage.getItem(HUB_KEY);
    const hub=raw?Object.assign(hubDefaultData(),JSON.parse(raw)):hubDefaultData();
    hub.stats=hub.stats||{};
    if(game==='flight'){ hub.stats.flight=hub.stats.flight||{}; hub.stats.flight.games=(hub.stats.flight.games||0)+1; hub.stats.flight.best=Math.max(hub.stats.flight.best||0,data.score||0); hub.stats.flight.shards=(hub.stats.flight.shards||0)+(data.shards||0); }
    hub.shards=(hub.shards||0)+(data.shards||0);
    hub.xp=(hub.xp||0)+(data.hubXP||0);
    while(hub.xp>=hubXpNeeded(hub.level||1)){ hub.xp-=hubXpNeeded(hub.level); hub.level=(hub.level||1)+1; }
    const today=new Date().toISOString().slice(0,10);
    if(hub.quests&&hub.quests.date===today&&hub.quests.slots){
      hub.quests.slots.forEach(q=>{
        if(hub.quests.claimed&&hub.quests.claimed[q.id]) return;
        const p=hub.quests.progress||{};
        if(q.game==='flight'||q.game==='both'){
          if(q.type==='score'&&q.game==='flight') p[q.id]=Math.max(p[q.id]||0,data.score||0);
          if(q.type==='plays') p[q.id]=(p[q.id]||0)+1;
          if(q.type==='shards') p[q.id]=(p[q.id]||0)+(data.shards||0);
          if(q.type==='total_plays') p[q.id]=(p[q.id]||0)+1;
          if(q.type==='total_shards') p[q.id]=(p[q.id]||0)+(data.shards||0);
          if(q.type==='play_both'){ hub._playedFlightToday=true; p[q.id]=(hub._playedFlightToday&&hub._playedSnakeToday)?1:0; }
        }
        hub.quests.progress=p;
      });
    }
    hub.lastPlay=today;
    localStorage.setItem(HUB_KEY,JSON.stringify(hub));
  }catch(e){ console.warn('[HubBridge]',e); }
}
