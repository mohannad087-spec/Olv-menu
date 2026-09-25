// Minimal service worker: only exists so the site qualifies as an installable
// app (Chrome's "Add to Home Screen" requires a registered SW with a fetch
// handler). It intentionally does no caching — menu, orders and order-status
// must always come straight from the network, never a stale cache.
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => { e.respondWith(fetch(e.request)); });
