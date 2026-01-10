/* Service Worker: App Shell cache + Push notifications (FCM/WebPush) */

const CACHE_NAME = "clos-cache-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/assets/css/app.css",
  "/assets/js/app.js",
  "/assets/js/app-config.js",
  "/assets/js/api.js",
  "/assets/js/auth.js",
  "/assets/js/router.js",
  "/assets/js/ui.js",
  "/assets/js/push.js",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/maskable-512.svg",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(APP_SHELL)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // لا نخزن /api
  if (url.pathname.startsWith("/api")) return;

  event.respondWith(
    (async () => {
      try {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        return res;
      } catch {
        // Offline fallback (لو احتجنا)
        return caches.match("/index.html");
      }
    })()
  );
});

/** Push Notifications (FCM delivers as push event) */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const n = payload.notification || {};
  const data = payload.data || payload || {};
  const title = n.title || data.title || "تنبيه جديد";
  const body = n.body || data.body || "لديك تحديث جديد داخل النظام.";
  const url = data.url || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      dir: "rtl",
      lang: "ar",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          await c.focus();
          c.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })()
  );
});
