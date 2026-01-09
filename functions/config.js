export async function onRequestGet({ env }) {
  // ⚠️ لا تضع أسرار هنا. فقط قيم public لازمة للعميل.
  const cfg = {
    GAS_BASE: env.GAS_BASE,                 // رابط WebApp الأساسي
    WRAPPER_ORIGIN: env.WRAPPER_ORIGIN,     // https://clos.rafah.org.sa

    FIREBASE: {
      apiKey: env.FB_API_KEY,
      authDomain: env.FB_AUTH_DOMAIN,
      projectId: env.FB_PROJECT_ID,
      messagingSenderId: env.FB_SENDER_ID,
      appId: env.FB_APP_ID,
      vapidKey: env.FB_VAPID_KEY,
    },

    // origins المحتملة للـ iframe من Google
    GAS_ORIGINS: [
      "https://script.google.com",
      "https://script.googleusercontent.com",
    ],
  };

  // تحقق سريع
  const missing = [];
  if (!cfg.GAS_BASE) missing.push("GAS_BASE");
  if (!cfg.WRAPPER_ORIGIN) missing.push("WRAPPER_ORIGIN");
  if (!cfg.FIREBASE.apiKey) missing.push("FB_API_KEY");
  if (!cfg.FIREBASE.projectId) missing.push("FB_PROJECT_ID");
  if (!cfg.FIREBASE.messagingSenderId) missing.push("FB_SENDER_ID");
  if (!cfg.FIREBASE.appId) missing.push("FB_APP_ID");
  if (!cfg.FIREBASE.vapidKey) missing.push("FB_VAPID_KEY");
  if (missing.length) {
    return new Response(JSON.stringify({ ok: false, error: "Missing env vars", missing }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  return new Response(JSON.stringify({ ok: true, ...cfg }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // يفضل no-store أثناء التطوير
      "cache-control": "no-store",
    }
  });
}
