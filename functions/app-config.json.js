export async function onRequestGet({ env }) {
  const cfg = {
    // أهم شيء
    GAS_URL: env.GAS_URL || "",

    // اختياري (سنستخدمه لاحقًا للأمان في postMessage)
    WRAPPER_ORIGIN: env.WRAPPER_ORIGIN || "",

    // اختياري (للمراحل القادمة)
    FIREBASE_VAPID_KEY: env.FIREBASE_VAPID_KEY || "",
    FIREBASE_CONFIG_JSON: env.FIREBASE_CONFIG_JSON || "",

    BUILD: env.BUILD || ""
  };

  return new Response(JSON.stringify(cfg, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
