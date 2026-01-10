import { apiPost } from "./api.js";
import { loadAppConfig } from "./app-config.js";

function detectPlatform() {
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "web";
}

function getOrCreateDeviceId() {
  const k = "CLOS_DEVICE_ID_V1";
  let v = localStorage.getItem(k);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(k, v);
  }
  return v;
}

async function ensureServiceWorker() {
  if (!("serviceWorker" in navigator)) throw new Error("Service Worker غير مدعوم");
  const reg = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
  return reg;
}

export async function enablePush() {
  const cfg = await loadAppConfig();
  const fb = cfg?.firebase || {};
  if (!fb?.apiKey || !fb?.projectId || !fb?.messagingSenderId || !fb?.appId || !fb?.vapidPublicKey) {
    throw new Error("Firebase config ناقص في app-config.json");
  }

  const reg = await ensureServiceWorker();

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("تم رفض إذن الإشعارات");

  // Firebase Web SDK (modular) dynamic import
  const [{ initializeApp }, { getMessaging, getToken }] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js"),
  ]);

  const app = initializeApp({
    apiKey: fb.apiKey,
    authDomain: fb.authDomain,
    projectId: fb.projectId,
    messagingSenderId: fb.messagingSenderId,
    appId: fb.appId,
  });

  const messaging = getMessaging(app);
  const fcmToken = await getToken(messaging, {
    vapidKey: fb.vapidPublicKey,
    serviceWorkerRegistration: reg,
  });

  if (!fcmToken) throw new Error("لم يتم الحصول على FCM token");

  const deviceId = getOrCreateDeviceId();

  await apiPost("/api/push/register", {
    fcm_token: fcmToken,
    platform: detectPlatform(),
    device_id: deviceId,
    app_version: cfg?.build || "",
    app_origin: location.origin,
    iframe_origin: document.referrer ? new URL(document.referrer).origin : "",
  });

  return { permission: perm, token: fcmToken };
}

export async function getPushStatus() {
  if (!("Notification" in window)) return "غير مدعوم";
  return Notification.permission === "granted" ? "مفعل ✅" :
         Notification.permission === "denied"  ? "مرفوض ❌" : "غير مفعل";
}
