# Notes for Claude: neoninc.github.io

This repo serves https://neoninc.github.io/ and holds TWO things. Keep them apart.

1. **The Neon Inc hub** (repo root): `index.html`, `apps.js`, `manifest.webmanifest`, `icon*`.
   It links to every Neon Inc app.
2. **Neon Arcade** (`arcade/` folder): https://neoninc.github.io/arcade/

## Rules

- Working on the arcade? Only change files inside `arcade/`. Never replace the root
  `index.html` with the arcade page. The arcade's own home page is `arcade/index.html`.
- Never move the arcade back to the repo root, and don't rename `arcade/`. The hub and old
  bookmarks rely on that path.
- Keep the redirect folders at the root (`games/`, `snake/`, `flappy/`). They forward old
  arcade links into `arcade/`. If you add a new arcade game, it does NOT need a redirect.
- Adding a new app to the hub = add one entry to `apps.js`. Don't hard-code tiles in `index.html`.
- The hub reads these save keys read-only to show tile status. If you change one in an app,
  update the matching function in `STATS` in `index.html`:
  - Neon Arcade: `localStorage['neonArcade_v3']` (`level`, `shards`, `streak`)
  - Neon Gym: `localStorage['menlyn-log-v2']` (`sessions[*].date`, `.done`, `.sets`)
  - Scent Scout: `localStorage['scentscout.watch2']` (array of `{ gk, ... }`)
- The other apps live in their own repos (`NeonInc/neon-gym`, `NeonInc/scent-scout`). Edit them there.
- `neon-arcade` and `neon-snake` repos are old versions. The live arcade is here in `arcade/`.
