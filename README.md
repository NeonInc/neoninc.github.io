# NEON INC

Every Neon Inc app in one place: **https://neoninc.github.io/**

| App | Opens at | Code |
|---|---|---|
| 🧴 Scent Scout | https://neoninc.github.io/scent-scout/ | [NeonInc/scent-scout](https://github.com/NeonInc/scent-scout) (`docs/` folder) |
| 🕹️ Neon Arcade | https://neoninc.github.io/arcade/ | this repo, `arcade/` folder |
| 🏋️ Neon Gym | https://neoninc.github.io/neon-gym/ | [NeonInc/neon-gym](https://github.com/NeonInc/neon-gym) |

On a phone, open the hub in Chrome and tap **⋮ → Add to Home screen**.

## What's in this repo

```
index.html            The hub page
apps.js               The list of apps on the hub (the only file to edit to add one)
manifest.webmanifest  Install-as-app settings for the hub
icon.svg, icon-*.png  Hub icons
arcade/               Neon Arcade (its own README is inside)
games/ snake/ flappy/ Redirects from older arcade URLs, so old bookmarks still work
```

## Adding a new app

1. Build the app in its own repo under NeonInc and turn on GitHub Pages for it.
   It will then open at `https://neoninc.github.io/<repo-name>/`.
2. Add one entry to `apps.js` here.

## How the tiles work

- Each tile opens the app's URL. Apps are separate, so changing one app never affects the hub or the others.
- The small status line (arcade level, workouts this week, watchlist count) is read from the app's own save on this device. It's read-only. If an app changes how it saves, the tile just shows less.
- "Updated …" comes from GitHub's public API and is cached for 15 minutes.

© 2026 Neon Inc™
