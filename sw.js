// Service worker: keeps the site installable, and caches only static,
// rarely-changing assets (photos, fonts, sounds, logos) stale-while-revalidate
// so repeat visits show them instantly. Menu data, orders, order-status and
// every /api call always go straight to the network, never a cache.
const CACHE = 'olv-static-v1';
const STATIC = /^\/assets\/(photos|fonts|sounds|motion\/vendor)\/|^\/assets\/[^/]+\.(webp|png|jpg|svg)$/;
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || !STATIC.test(u.pathname) || r.headers.has('range')) {
    e.respondWith(fetch(r));
    return;
  }
  e.respondWith(caches.open(CACHE).then((c) => c.match(r).then((hit) => {
    const net = fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; });
    if (hit) { net.catch(() => {}); return hit; }
    return net;
  })));
});
