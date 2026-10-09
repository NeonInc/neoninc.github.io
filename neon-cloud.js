/*
  NEON CLOUD · shared sign-in and cloud saves for every Neon Inc app
  ---------------------------------------------------------------
  Served at https://neoninc.github.io/neon-cloud.js and loaded by the hub and each app.
  All the apps live on the same site, so signing in once (on the hub or in any app)
  signs you in everywhere.

  - Sign-in: Google, through Firebase Authentication.
  - Storage: Cloud Firestore. Everything a person saves lives under users/{their uid}/,
    and the database rules only let a signed-in person read and write their own folder.
  - Nothing changes for people who don't sign in: apps keep saving on the device.
  - If CONFIG is null, this file does nothing and every app works as before.

  Data layout
    users/{uid}/apps/arcade     { json, rank, savedAt }   Neon Arcade save (whole state)
    users/{uid}/apps/scent      { json, rank, savedAt }   Scent Scout watchlist
    users/{uid}/gym/profile     Neon Gym profile, with sessions/, body/, food/ under it

  Local testing: on localhost, set localStorage 'neoncloud.emulator' = '1' and run the
  Firebase emulators (auth :9099, firestore :8080) with project id demo-neon.
*/
(function (global) {
  'use strict';

  // ── Paste the Firebase web config here (Project settings → Your apps → Web app) ──
  var CONFIG = null;

  var SDK = 'vendor/firebase-13.0.0/';
  var OWNER_KEY = 'neoncloud.owner';

  // Where this file is served from, so the SDK loads from the same place.
  var BASE = (function () {
    try { return new URL('.', document.currentScript.src).href; } catch (e) { return '/'; }
  })();

  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var EMU = false;
  try { EMU = isLocal && localStorage.getItem('neoncloud.emulator') === '1'; } catch (e) {}
  if (EMU) CONFIG = { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-neon', appId: 'demo-app' };

  /* ── Apps whose whole save is one blob in localStorage ──
     rank(data) decides which copy is newer. Neon Arcade compares lifetime XP first,
     so progress can never be overwritten by an older or emptier copy. */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function parse(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function fireStorage(key) {
    try { global.dispatchEvent(new StorageEvent('storage', { key: key })); } catch (e) {}
  }

  var BLOBS = {
    arcade: {
      key: 'neonArcade_v3',
      read: function () { return parse(lsGet('neonArcade_v3')); },
      write: function (d) { lsSet('neonArcade_v3', JSON.stringify(d)); fireStorage('neonArcade_v3'); },
      rank: function (d) { return [d.lifetimeXP || 0, d.updatedAt || 0]; },
      empty: function (d) { return !d || !(d.lifetimeXP > 0 || (d.profile && d.profile.created)); },
    },
    scent: {
      key: 'scentscout.watch2',
      read: function () {
        if (lsGet('scentscout.watch2.default') === '1') return null; // untouched starter list
        var w = parse(lsGet('scentscout.watch2'));
        if (!Array.isArray(w)) return null;
        return { watch: w, at: +lsGet('scentscout.watch2.at') || 0 };
      },
      write: function (d) {
        lsSet('scentscout.watch2', JSON.stringify(d.watch || []));
        lsSet('scentscout.watch2.at', String(d.at || Date.now()));
        lsDel('scentscout.watch2.default');
        fireStorage('scentscout.watch2');
      },
      rank: function (d) { return [d.at || 0]; },
      empty: function (d) { return !d || !(d.watch || []).some(function (x) { return x && x.gk; }); },
      // A phone's list from before sign-in has no timestamp: combine it with the account's list.
      merge: function (local, cloud) {
        if (local.at) return null;
        var seen = {}, out = [];
        (cloud.watch || []).concat(local.watch || []).forEach(function (x) {
          var id = x && (x.gk || x.q); if (!id || seen[id]) return; seen[id] = 1; out.push(x);
        });
        return { watch: out, at: Date.now() };
      },
    },
  };
  // Keys that belong to a person. Cleared when a different person signs in on this device.
  var PERSONAL_KEYS = ['neonArcade_v3', 'neonArcade_hub', 'scentscout.watch2', 'scentscout.watch2.at', 'scentscout.watch2.default', 'scentscout.watch', 'menlyn-log-v2'];

  function cmp(a, b) {
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  }

  /* ── State ── */
  var app = null, auth = null, fs = null, fsPromise = null;
  var user = null, authKnown = false;
  var userCbs = [], statusCbs = [];
  var status = CONFIG ? 'loading' : 'off';
  var readyResolve, ready = new Promise(function (r) { readyResolve = r; });
  if (!CONFIG) readyResolve(null);

  function setStatus(s) {
    if (s === status) return;
    status = s;
    statusCbs.slice().forEach(function (cb) { try { cb(s, user); } catch (e) {} });
    paintBadges();
  }
  function emitUser() {
    userCbs.slice().forEach(function (cb) { try { cb(user); } catch (e) {} });
    paintBadges();
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = res; s.onerror = function () { rej(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function boot() {
    if (!CONFIG) return;
    loadScript(BASE + SDK + 'firebase-app-compat.js')
      .then(function () { return loadScript(BASE + SDK + 'firebase-auth-compat.js'); })
      .then(function () {
        var fb = global.firebase;
        app = fb.apps.length ? fb.app() : fb.initializeApp(CONFIG);
        auth = fb.auth();
        if (EMU) auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
        auth.onAuthStateChanged(onAuth);
        // Finish a redirect sign-in if one was used as a fallback.
        auth.getRedirectResult().catch(function () {});
      })
      .catch(function () { setStatus('error'); authKnown = true; readyResolve(null); });
  }

  function onAuth(u) {
    var prev = user;
    user = u ? { uid: u.uid, name: u.displayName || '', email: u.email || '', photo: u.photoURL || '' } : null;

    if (user) {
      var owner = lsGet(OWNER_KEY);
      if (owner && owner !== user.uid) {
        // Someone else's progress is on this device. Clear it so it can't end up in this account,
        // then reload so open apps drop it from memory. Their copy is safe in their own account.
        PERSONAL_KEYS.forEach(lsDel);
        lsSet(OWNER_KEY, user.uid);
        location.reload();
        return;
      }
      lsSet(OWNER_KEY, user.uid);
      setStatus('synced');
    } else {
      setStatus('signed-out');
    }
    var first = !authKnown;
    authKnown = true;
    if (first) readyResolve(user);
    if (first || (prev && prev.uid) !== (user && user.uid)) emitUser();
  }

  function firestore() {
    if (!CONFIG) return Promise.reject(new Error('Cloud not configured'));
    if (fsPromise) return fsPromise;
    // Local tests can swap in a stand-in database (only on localhost in emulator mode).
    if (EMU && global.__neonTestFirestore) return (fsPromise = Promise.resolve(global.__neonTestFirestore));
    fsPromise = ready.then(function () { return loadScript(BASE + SDK + 'firebase-firestore-compat.js'); })
      .then(function () {
        fs = global.firebase.firestore();
        if (EMU) fs.useEmulator('127.0.0.1', 8080);
        // Keep a copy on the device so the apps work offline and catch up later.
        return fs.enablePersistence({ synchronizeTabs: true }).catch(function () {}).then(function () { return fs; });
      });
    fsPromise.catch(function () { fsPromise = null; });
    return fsPromise;
  }

  function userRef(path) {
    if (!user) return Promise.reject(new Error('Not signed in'));
    var uid = user.uid;
    return firestore().then(function (db) { return db.doc('users/' + uid + '/' + path); });
  }

  /* ── Blob sync ── */
  function readCloud(id) {
    return userRef('apps/' + id).then(function (ref) {
      return ref.get().then(function (snap) {
        var d = snap.exists ? snap.data() : null;
        return { ref: ref, data: d && d.json ? parse(d.json) : null };
      });
    });
  }
  function writeCloud(ref, def, data) {
    return ref.set({
      json: JSON.stringify(data),
      rank: def.rank(data),
      savedAt: Date.now(),
    });
  }

  // Bring this device and the account in line for one app. Resolves to
  // 'none' | 'same' | 'pushed' | 'pulled' | 'merged' | 'off'.
  function sync(id) {
    var def = BLOBS[id];
    if (!def || !CONFIG) return Promise.resolve('off');
    return ready.then(function (u) {
      if (!u || !user) return 'off';
      setStatus('saving');
      return readCloud(id).then(function (c) {
        var local = def.read(), cloud = c.data, result;
        var localEmpty = def.empty(local), cloudEmpty = def.empty(cloud);
        if (localEmpty && cloudEmpty) result = 'none';
        else if (cloudEmpty) result = 'pushed';
        else if (localEmpty) result = 'pulled';
        else {
          var merged = def.merge ? def.merge(local, cloud) : null;
          if (merged) { def.write(merged); return writeCloud(c.ref, def, merged).then(function () { return 'merged'; }); }
          var o = cmp(def.rank(local), def.rank(cloud));
          result = o > 0 ? 'pushed' : o < 0 ? 'pulled' : 'same';
        }
        if (result === 'pulled') { def.write(cloud); return result; }
        if (result === 'pushed') return writeCloud(c.ref, def, local).then(function () { return result; });
        return result;
      });
    }).then(function (r) { if (user) setStatus('synced'); return r; },
            function (e) { setStatus(navigator.onLine === false ? 'offline' : 'error'); throw e; });
  }

  // Call after saving locally. Debounced; never overwrites a cloud copy that ranks higher.
  var pushTimers = {};
  function push(id) {
    if (!CONFIG || !user || !BLOBS[id]) return;
    clearTimeout(pushTimers[id]);
    setStatus('saving');
    pushTimers[id] = setTimeout(function () { sync(id).catch(function () {}); }, 1500);
  }
  function syncAll() {
    var ids = Object.keys(BLOBS);
    return Promise.all(ids.map(function (id) { return sync(id).catch(function () { return 'error'; }); }))
      .then(function (r) { var out = {}; ids.forEach(function (id, i) { out[id] = r[i]; }); return out; });
  }
  global.addEventListener('online', function () { if (user) Object.keys(pushTimers).forEach(push); });

  /* ── Sign in / out ── */
  function signIn() {
    if (!CONFIG) return Promise.reject(new Error('Cloud not configured'));
    return ready.then(function () {
      var p = new global.firebase.auth.GoogleAuthProvider();
      p.setCustomParameters({ prompt: 'select_account' });
      return auth.signInWithPopup(p).catch(function (e) {
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
          return auth.signInWithRedirect(p);
        }
        if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) return null;
        throw e;
      });
    });
  }
  function signOut() { return auth ? auth.signOut() : Promise.resolve(); }

  /* ── Small account badge any app can drop into its header ── */
  var badges = [];
  var BADGE_CSS =
    '.nc-badge{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px 0 10px;border-radius:999px;' +
    'border:1px solid rgba(255,255,255,.16);background:rgba(10,10,28,.72);color:#e6f6ff;font:600 13px/1 Rajdhani,"Segoe UI",system-ui,sans-serif;' +
    'letter-spacing:.02em;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}' +
    '.nc-badge:hover{border-color:rgba(0,240,255,.6)}.nc-badge:focus-visible{outline:2px solid #00f0ff;outline-offset:2px}' +
    '.nc-badge .nc-dot{width:8px;height:8px;border-radius:50%;background:#7a8199;flex:none}' +
    '.nc-badge[data-s=synced] .nc-dot{background:#00ff88;box-shadow:0 0 8px #00ff88}' +
    '.nc-badge[data-s=saving] .nc-dot{background:#ffd700;animation:ncp 1s ease-in-out infinite}' +
    '.nc-badge[data-s=error] .nc-dot,.nc-badge[data-s=offline] .nc-dot{background:#ff8a00}' +
    '.nc-badge img{width:20px;height:20px;border-radius:50%;margin-left:-4px}' +
    '@keyframes ncp{50%{opacity:.35}}' +
    '@media(max-width:600px){.nc-badge.nc-compact{padding:0 9px}.nc-badge.nc-compact .nc-t{display:none}.nc-badge.nc-compact img{margin:0}}';
  function firstName(u) { return (u.name || u.email || 'You').split(/[\s@]/)[0]; }
  function badgeText() {
    if (!user) return 'Sign in to save';
    var n = firstName(user);
    return { saving: n + ' · saving…', offline: n + ' · offline', error: n + ' · not synced' }[status] || n + ' · saved';
  }
  function paintBadges() {
    badges.forEach(function (b) {
      var hide = !CONFIG || !authKnown;
      b.hidden = hide;
      if (hide) return;
      b.setAttribute('data-s', user ? status : 'signed-out');
      b.title = user ? 'Signed in as ' + (user.email || user.name) + '. Tap to sign out.' : 'Sign in with Google to keep your progress on every device';
      b.innerHTML = '';
      if (user && user.photo) { var i = document.createElement('img'); i.src = user.photo; i.alt = ''; i.referrerPolicy = 'no-referrer'; b.appendChild(i); }
      else { var d = document.createElement('span'); d.className = 'nc-dot'; b.appendChild(d); }
      var t = document.createElement('span'); t.className = 'nc-t'; t.textContent = badgeText(); b.appendChild(t);
    });
  }
  function badge(container, opts) {
    if (!CONFIG || !container) return null;
    if (!document.getElementById('nc-css')) {
      var st = document.createElement('style'); st.id = 'nc-css'; st.textContent = BADGE_CSS; document.head.appendChild(st);
    }
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'nc-badge' + (opts && opts.className ? ' ' + opts.className : '');
    b.hidden = true;
    b.addEventListener('click', function () {
      if (!user) { signIn().catch(function (e) { alert('Sign-in didn\'t work: ' + ((e && e.message) || e)); }); return; }
      if (confirm('Signed in as ' + (user.email || user.name) + '.\n\nSign out on this device? Your progress stays saved in your account.')) signOut();
    });
    if (opts && opts.prepend) container.insertBefore(b, container.firstChild); else container.appendChild(b);
    badges.push(b);
    paintBadges();
    return b;
  }

  global.NeonCloud = {
    enabled: !!CONFIG,
    emulator: EMU,
    ready: ready,
    user: function () { return user; },
    status: function () { return status; },
    onUser: function (cb) { userCbs.push(cb); if (authKnown || !CONFIG) { try { cb(user); } catch (e) {} } },
    onStatus: function (cb) { statusCbs.push(cb); },
    setStatus: setStatus,
    signIn: signIn,
    signOut: signOut,
    firestore: firestore,
    userRef: userRef,
    sync: sync,
    syncAll: syncAll,
    push: push,
    badge: badge,
  };

  boot();
})(window);
