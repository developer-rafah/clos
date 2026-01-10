/* Service Worker: safe caching (avoid stale HTML) + Push notifications */

const VERSION = "v3"; // ✅ غيّرها عند أي إصدار جديد (v4, v5...)
const CACHE_STATIC = `clos-static-${VERSION}`;
const CACHE_HTML = `clos-html-${VERSION}`;

// ملفات ثابتة (لا تضع app.js إذا كنت تغيّره كثيرًا بدون versioning)
// الأفضل أن تعتمد على network-first + cache للأصول بشكل ديناميكي
const STATIC_PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/assets/css/app.css",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/maskable-512.svg",
];

// Helpers
async function cachePut(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
}

async function cacheMatch(cacheName, request) {
  const cache = await caches.open(cacheName);
  return cache.match(request);
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const c = await caches.open(CACHE_STATIC);
      await c.addAll(STATIC_PRECACHE);
    })().catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // احذف أي كاش قديم
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (k.startsWith("clos-") && k !== CACHE_STATIC && k !== CACHE_HTML) {
            return caches.delete(k);
          }
          return null;
        })
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // لا تتدخل مع الـ API
  if (url.pathname.startsWith("/api")) return;

  // طلبات التنقل (HTML / SPA routes)
  // ✅ Network-first: دائماً حاول تجيب الجديد
  const isNavigation =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          // خزّن نسخة HTML لتعمل أوفلاين
          await cachePut(CACHE_HTML, req, fresh.clone());
          return fresh;
        } catch {
          // أوفلاين: رجّع آخر HTML مخزن
          const cached = await cacheMatch(CACHE_HTML, req);
          if (cached) return cached;

          // fallback: index.html
          const fallback = await cacheMatch(CACHE_HTML, "/index.html");
          if (fallback) return fallback;

          // آخر محاولة: من static cache
          const fromStatic = await caches.match("/index.html");
          return fromStatic || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // الأصول الثابتة (CSS/JS/SVG/Images): Stale-while-revalidate
  const isAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest";

  if (isAsset) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        const fetchPromise = (async () => {
          try {
            const fresh = await fetch(req);
            // خزّن في static cache
            await cachePut(CACHE_STATIC, req, fresh.clone());
            return fresh;
          } catch {
            return null;
          }
        })();

        // قدّم الكاش فورًا لو موجود، وحدّث بالخلفية
        if (cached) {
          event.waitUntil(fetchPromise);
          return cached;
        }

        // لو ما فيه كاش، انتظر الشبكة
        const fresh = await fetchPromise;
        return fresh || new Response("Offline", { status: 503 });
      })()
    );
    return;
  }

  // أي شيء آخر: جرّب الشبكة ثم كاش عام
  event.respondWith(
    (async () => {
      try {
        return await fetch(req);
      } catch {
        const cached = await caches.match(req);
        return cached || new Response("Offline", { status: 503 });
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
  const targetUrl = data.url || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      dir: "rtl",
      lang: "ar",
      data: { url: targetUrl },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification?.data?.url) || "/";

  event.waitUntil(
    (async () => {
      const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          await c.focus();
          try { await c.navigate(targetUrl); } catch {}
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })()
  );
});
