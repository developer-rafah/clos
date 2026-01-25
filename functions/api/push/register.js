import { ok, fail } from "../../_lib/response.js";
import { getCookie } from "../../_lib/security.js";
import { verifyJwt } from "../../_lib/jwt.js";
import { upsertPushToken } from "../../_lib/supabase.js";

const COOKIE_NAME = "clos_session";

export async function onRequestPost({ request, env }) {
  try {
    const JWT_SECRET = String(env.JWT_SECRET || "").trim();
    if (!JWT_SECRET) return fail("Missing JWT_SECRET", 500);

    const tokenCookie = getCookie(request, COOKIE_NAME);
    if (!tokenCookie) return fail("Unauthorized", 401);

    const v = await verifyJwt(tokenCookie, JWT_SECRET);
    if (!v.ok) return fail("Unauthorized", 401);

    const body = await request.json().catch(() => ({}));
    const fcmToken = String(body.fcm_token || body.token || "").trim();
    if (!fcmToken) return fail("Missing fcm_token", 400);

    const p = v.payload || {};
    const row = {
      fcm_token: fcmToken,
      username: p.username || p.sub || null,
      role: p.role || null,
      platform: String(body.platform || "").trim() || null,
      device_id: String(body.device_id || "").trim() || null,
      user_agent: request.headers.get("user-agent") || null,
      app_origin: String(body.app_origin || "").trim() || null,
      iframe_origin: String(body.iframe_origin || "").trim() || null,
      app_version: String(body.app_version || "").trim() || null,
      enabled: true,
      revoked_at: null,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await upsertPushToken(env, row);
    return ok({ saved: true });
  } catch (e) {
    return fail(e?.message || String(e), 500);
  }
}

