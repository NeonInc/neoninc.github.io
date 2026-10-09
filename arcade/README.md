# 🌌 NEON ARCADE

**Neon Arcade** is a browser arcade of retro neon games that all share one player account. Every run earns XP, shards and progress toward daily quests, achievements and unlockable rewards — no install, no sign-up, no server.

Play: **https://neoninc.github.io/arcade/**

Part of the Neon Inc hub at **https://neoninc.github.io/**. The arcade lives in the `arcade/` folder of the `neoninc.github.io` repo.

---

## 🎮 The games

| Game | Genre | Highlights |
|---|---|---|
| 🐍 **Neon Snake** | Arcade classic | Smooth gliding movement, buffered turns, combo chains, golden / ×2 / volatile / bad apples, the Grid Warden boss, Free Aim mode |
| 🚀 **Neon Flight** | Reflex | Six realms (Cyber Grid → Heaven), shard combos, moving pillars, the score-42 system error |
| 🧩 **Neon Stack** | Puzzle | Falling blocks with SRS rotation + wall kicks, hold, ghost, 5-piece preview, T-spins, back-to-back, all-clears · Marathon / Sprint 40 / Ultra 2:00 |
| 🧱 **Neon Breaker** | Action | Multi-hit, steel and explosive bricks, power-ups (wide, multi-ball, laser, slow, catch, +life), 10 handcrafted levels then endless generated ones |
| 🛸 **Void Drift** | Shooter | Vector-style asteroids: thrust, wrap-around, splitting rocks, hunting saucers, hyperspace |
| 🏎️ **Neon Drifter** | Racing | Old-school top-down drifting on two tracks: hold big slides for points, chain drifts for a multiplier, bank before you hit a wall · Free Drift 90 mode |
| ⌨️ **Keystorm** | Typing | 30s / 60s speed tests with live WPM, accuracy and a WPM graph, switch-style key sounds per skin · Word Storm: zap falling words before they hit the city |
| 🃏 **Mind Match** | Memory | Flip and match pairs of neon symbols: six arcade stages of growing grids against the clock, or a relaxed fewest-moves board |
| 💠 **Neon Gems** | Match-3 | Swap gems, trigger cascades; line gems, bombs and prisms · Blitz 90s and 30 Moves |
| 🎱 **Neon Pool** | Sports | 8-ball against a CPU opponent with solids/stripes, fouls and ball in hand · Time Rush: pot as many as you can in 3 minutes |

Every game works with keyboard, mouse and touch (on-screen buttons and gestures on phones).

## 👤 One account across the arcade

- **Levels & rank tiers** — from NULL.SIGNAL to NEON LEGEND (level 100+)
- **Shards** — currency earned from runs, quests and achievements
- **Daily quests** — three a day (two game-specific, one arcade-wide), one free swap per day
- **Play streak** — +5% XP per streak day, up to +50%
- **87 achievements** — arcade-wide and per game
- **The Vault** — avatars, titles, hub colour themes and skins for every game, unlocked by level, achievements or shards
- **Results screen** — XP breakdown, level-ups, quest progress and unlocks after every run
- **Save codes** — progress lives in the browser; *Profile → Save & Transfer* exports a code you can import on another device

Progress from the previous version (v2 hub level, shards and best scores) is carried over automatically.

## 🧱 Project structure

```
arcade/
index.html                 Hub (library, quests, achievements, vault, profile)
manifest.webmanifest
assets/
  css/arcade.css           Shared look + game shell styles
  css/hub.css              Hub styles
  js/arcade-core.js        Account, progression, quests, achievements, vault, audio, FX helpers
  js/game-shell.js         Shared game page: HUD, menus, pause, results, loop, touch controls
  js/hub.js                Hub UI
  icon.svg
games/
  snake/  flight/  stack/  breaker/  drift/          (index.html + one game script each)
  drifter/  typer/  memory/  gems/  pool/
(repo root) snake/ flappy/ games/   Redirects from older arcade URLs
```

### Adding a new game

1. Add an entry to `GAMES` in `arcade/assets/js/arcade-core.js` (id, name, colour, path, and `xp` / `shards` formulas).
2. Optionally add achievements, quests and skins for it in the same file.
3. Create `arcade/games/<id>/index.html` (copy any existing one) and a script that calls `GameShell.create({...})` and reports the run with `shell.gameOver(stats)`.

The hub, quests, Vault and profile pick it up automatically.

## 🚀 Tech

Pure HTML5 Canvas, CSS and vanilla JavaScript — no frameworks, no build step, no dependencies. Fixed-timestep game loops, high-DPI canvases, cached glow sprites instead of canvas blur for smooth frame rates, Web Audio synth effects and chiptune music, `localStorage` saves.

## 🏷 Version

Neon Arcade v4.0 · © 2026 Neon Inc™

The previous version (5 games) is kept on the `backup-v3` branch.
