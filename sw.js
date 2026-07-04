// Bump this version string every time you deploy a new index.html.
// Bumping it forces old caches to be deleted, so the app stops serving
// a stale cached copy — this is the fix for "purana wala hi read ho raha hai".
const CACHE_VERSION = 'v2';
const CACHE_NAME = `qbank-cache-${CACHE_VERSION}`;

// Only small, rarely-changing static files are cached ahead of time.
// index.html itself is NOT pre-cached — it's always fetched fresh from the
// network first (see fetch handler below), so new deploys show up right away.
const PRECACHE_URLS = [
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // activate this new SW immediately, don't wait for old tabs to close
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME) // wipe every old versioned cache
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // take control of open tabs right away
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isHTML = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHTML) {
    // Network-first for the app shell: always try to get the latest
    // index.html; only fall back to cache if offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for everything else (images, manifest, icons) — faster
  // repeat loads, with a network fallback + cache update if missing.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      }).catch(() => cached);
    })
  );
});
