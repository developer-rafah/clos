import { json, fail } from "./_lib/response.js";

export async function onRequestGet({ env }) {
  const gas = String(env.GAS_URL || "").trim();
  if (!gas) return fail("GAS_URL is not set", 500);

  // Firebase public config (لا تعتبر أسرار)
  const firebase = {
    apiKey: String(env.FIREBASE_API_KEY || "").trim(),
    authDomain: String(env.FIREBASE_AUTH_DOMAIN || "").trim(),
    projectId: String(env.FIREBASE_PROJECT_ID || "").trim(),
    messagingSenderId: String(env.FIREBASE_MESSAGING_SENDER_ID || "").trim(),
    appId: String(env.FIREBASE_APP_ID || "").trim(),
    vapidPublicKey: String(env.FIREBASE_VAPID_PUBLIC_KEY || "").trim(),
  };

  return json(
    {
      ok: true,
      success: true,
      build: new Date().toISOString(),
      // لا نرسل GAS_URL للواجهة (لأسباب أمنية) — الواجهة تتعامل مع /api/gas فقط
      apiBase: "/api",
      firebase,
      pwa: { enabled: true },
    },
    200,
    {
      "cache-control": "public, max-age=60",
    }
  );
}
