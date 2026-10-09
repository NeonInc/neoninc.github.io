/*
  NEON INC HUB · the app list
  ---------------------------------------------------------------
  This is the ONLY place the hub's tiles come from.
  To add a new Neon Inc app, add one entry below. Nothing else changes.

    id       short unique name (lower-case, no spaces)
    name     shown on the tile
    tagline  one short line under the name
    url      where the tile opens. Same-site apps use a relative path
             like 'neon-gym/' (= https://neoninc.github.io/neon-gym/)
    repo     the GitHub repo name under NeonInc (used for "updated" time
             and the small source link)
    icon     image for the tile (any path the browser can load)
    color    two accent colours for the tile glow
    updated  wording for the "updated …" line (optional)
*/
window.NEON_APPS = [
  {
    id: 'scent',
    name: 'Scent Scout',
    tagline: 'Cheapest fragrance prices across SA stores, delivery included',
    url: 'scent-scout/',
    repo: 'scent-scout',
    icon: 'scent-scout/favicon.svg',
    color: ['#ff5fa8', '#9b5cff'],
    updated: 'Prices updated',
  },
  {
    id: 'arcade',
    name: 'Neon Arcade',
    tagline: '10 retro neon games with one shared account',
    url: 'arcade/',
    repo: 'neoninc.github.io',
    icon: 'arcade/assets/icon.svg',
    color: ['#00f0ff', '#ff00ff'],
  },
  {
    id: 'gym',
    name: 'Neon Gym',
    tagline: 'Gym plan, training log and food counter',
    url: 'neon-gym/',
    repo: 'neon-gym',
    icon: 'neon-gym/icon.svg',
    color: ['#00e5f4', '#ff2bd6'],
  },
];
