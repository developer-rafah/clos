importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

let messagingReady = false;

async function ensureFirebase() {
  if (messagingReady) return;

  const res = await fetch("/config", { cache: "no-store" });
  const cfg = await res.json();
  if (!cfg.ok) throw new Error("Config error in SW");

  firebase.initializeApp({
    apiKey: cfg.FIREBASE.apiKey,
    authDomain: cfg.FIREBASE.authDomain,
    projectId: cfg.FIREBASE.projectId,
    messagingSenderId: cfg.FIREBASE.messagingSenderId,
    appId: cfg.FIREBASE.appId,
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || "تنبيه جديد";
    const options = {
      body: payload?.notification?.body || "لديك تحديث جديد",
      icon: "/icons/icon-192.png",
      data: payload?.data || {}
    };
    self.registration.showNotification(title, options);
  });

  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow("/"));
  });

  messagingReady = true;
}

ensureFirebase().catch(() => {
  // لا تكسر SW — فقط لن يعمل background push إلى أن تنجح تهيئته.
});
