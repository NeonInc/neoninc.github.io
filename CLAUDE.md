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

## Cloud saves (neon-cloud.js)

- `neon-cloud.js` at the root gives every app Google sign-in (Firebase Auth) and cloud saves
  (Firestore). All apps are on the same site, so one sign-in covers all of them.
  Each app loads it with a relative path (`../neon-cloud.js`, `../../../neon-cloud.js` in arcade games).
- The Firebase web config is the `CONFIG` value at the top of `neon-cloud.js`. With `CONFIG = null`
  everything falls back to saving on the device only.
- Data lives under `users/{uid}/` only. The Firestore rules (set in the Firebase console) allow a
  signed-in person to read/write their own `users/{uid}/**` and nothing else. Never write outside it.
  - `users/{uid}/apps/arcade`, `users/{uid}/apps/scent`: `{ json, rank, savedAt }`, whole saves as JSON text
  - `users/{uid}/gym/profile` plus `sessions/`, `body/`, `food/` under it (Neon Gym's own sync code)
- Which copy wins: Neon Arcade by lifetime XP then time saved; Scent Scout by the time of the last
  change the person made. A phone's data from before sign-in is merged into the account once.
- If a different person signs in on a device, the previous person's local saves are cleared and the
  page reloads (their copy is safe in their own account). Keep `PERSONAL_KEYS` up to date if an app
  adds a new save key.
- Firebase SDK files are self-hosted in `vendor/firebase-13.0.0/` (compat builds).
- Testing locally: serve the site on localhost, set `localStorage['neoncloud.emulator']='1'`, run
  `firebase emulators:start --only auth --project demo-neon`, and either the Firestore emulator or a
  stand-in database exposed as `window.__neonTestFirestore`.
