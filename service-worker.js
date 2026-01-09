/* Simple SW for static caching */
const CACHE_NAME = "clos-pwa-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/service-worker.js",
  "/firebase-messaging-sw.js",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/maskable-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : null));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // لا تكاش config (دائمًا جديد)
  if (url.pathname === "/app-config.json") return;

  // Cache-first للأصول
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    const res = await fetch(req);
    // خزّن فقط GET و status OK
    if (req.method === "GET" && res && res.ok) {
      const copy = res.clone();
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, copy);
    }
    return res;
  })());
});
