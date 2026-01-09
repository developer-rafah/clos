const statusEl = document.getElementById("status");
const hintEl = document.getElementById("hint");
const frame = document.getElementById("gasFrame");

function setStatus() {
  statusEl.textContent = navigator.onLine ? "متصل" : "غير متصل";
}
window.addEventListener("online", setStatus);
window.addEventListener("offline", setStatus);
setStatus();

const SESSION_KEY = "clos_session";
const getSavedSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
};
const saveSession = (s) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
const clearSession = () => localStorage.removeItem(SESSION_KEY);

async function loadConfig() {
  const res = await fetch("/config", { cache: "no-store" });
  const cfg = await res.json();
  if (!cfg.ok) throw new Error("Config error: " + (cfg.error || "unknown"));
  return cfg;
}

function loadIframe(GAS_BASE) {
  const s = getSavedSession();
  const url = s?.sid
    ? `${GAS_BASE}?sid=${encodeURIComponent(s.sid)}&from=wrapper`
    : `${GAS_BASE}?from=wrapper`;
  frame.src = url;
}

(async () => {
  // Register SW (caching)
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }

  // Load runtime config
  let cfg;
  try {
    cfg = await loadConfig();
  } catch (e) {
    hintEl.textContent = "تعذر تحميل إعدادات التطبيق. راجع config.";
    console.error(e);
    return;
  }

  const { GAS_BASE, WRAPPER_ORIGIN, GAS_ORIGINS, FIREBASE } = cfg;

  // زر فتح كامل (fallback)
  document.getElementById("btnFull").addEventListener("click", () => {
    window.location.href = frame.src || GAS_BASE;
  });

  // ابدأ بتحميل النظام
  loadIframe(GAS_BASE);

  // استقبال session من GAS
  window.addEventListener("message", (event) => {
    if (!GAS_ORIGINS.includes(event.origin)) return;
    const data = event.data || {};

    if (data.type === "SESSION" && data.sid && data.role) {
      saveSession({ sid: data.sid, role: data.role, t: Date.now() });
      hintEl.textContent = `تم تسجيل الدخول (${data.role}) ✅`;
      loadIframe(GAS_BASE);
    }

    if (data.type === "LOGOUT") {
      clearSession();
      hintEl.textContent = "تم تسجيل الخروج.";
      loadIframe(GAS_BASE);
    }
  });

  // Firebase Web Push
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
  const { getMessaging, getToken } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js");

  const app = initializeApp({
    apiKey: FIREBASE.apiKey,
    authDomain: FIREBASE.authDomain,
    projectId: FIREBASE.projectId,
    messagingSenderId: FIREBASE.messagingSenderId,
    appId: FIREBASE.appId,
  });

  const messaging = getMessaging(app);

  async function enablePush() {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("لم يتم منح إذن الإشعارات.");

    // SW خاص بالإشعارات
    const fcmSwReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: FIREBASE.vapidKey,
      serviceWorkerRegistration: fcmSwReg,
    });

    if (!token) throw new Error("تعذر الحصول على FCM Token.");

    // أرسل token للـ GAS داخل iframe
    for (const origin of GAS_ORIGINS) {
      frame.contentWindow?.postMessage(
        { type: "FCM_TOKEN", token, wrapperOrigin: WRAPPER_ORIGIN },
        origin
      );
    }

    return token;
  }

  document.getElementById("btnPush").addEventListener("click", async () => {
    try {
      hintEl.textContent = "جارٍ تفعيل الإشعارات...";
      await enablePush();
      hintEl.textContent = "تم تفعيل الإشعارات ✅";
    } catch (e) {
      hintEl.textContent = e?.message || "حدث خطأ في تفعيل الإشعارات.";
    }
  });
})();
