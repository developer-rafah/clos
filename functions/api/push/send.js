import { ok, fail } from "../../_lib/response.js";
import { getCookie } from "../../_lib/security.js";
import { verifyJwt } from "../../_lib/jwt.js";
import { listPushTokens } from "../../_lib/supabase.js";

const COOKIE_NAME = "clos_session";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function onRequestPost({ request, env }) {
  try {
    const JWT_SECRET = String(env.JWT_SECRET || "").trim();
    const FCM_SERVER_KEY = String(env.FCM_SERVER_KEY || "").trim();
    if (!JWT_SECRET) return fail("Missing JWT_SECRET", 500);
    if (!FCM_SERVER_KEY) return fail("Missing FCM_SERVER_KEY", 500);

    const tokenCookie = getCookie(request, COOKIE_NAME);
    if (!tokenCookie) return fail("Unauthorized", 401);

    const v = await verifyJwt(tokenCookie, JWT_SECRET);
    if (!v.ok) return fail("Unauthorized", 401);

    const me = v.payload || {};
    if (String(me.role || "").trim() !== "مدير") {
      return fail("Forbidden", 403);
    }

    const body = await request.json().catch(() => ({}));
    const title = String(body.title || "إشعار").trim();
    const msg = String(body.body || "").trim();
    const toRole = String(body.toRole || "").trim(); // مثال: "مدير" أو فارغ للجميع
    const data = body.data && typeof body.data === "object" ? body.data : {};

    const rows = await listPushTokens(env, { role: toRole, enabledOnly: true });
    const tokens = rows.map((r) => r.fcm_token).filter(Boolean);

    if (!tokens.length) return ok({ sent: 0, note: "no tokens" });

    const chunks = chunk(tokens, 500);
    let sent = 0;

    for (const part of chunks) {
      const payload = {
        registration_ids: part,
        priority: "high",
        notification: { title, body: msg },
        data: { ...data, url: data.url || "/" },
      };

      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `key=${FCM_SERVER_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      const txt = await res.text();
      if (!res.ok) throw new Error(`FCM error (${res.status}): ${txt}`);

      const out = txt ? JSON.parse(txt) : {};
      sent += Number(out?.success || 0);
    }

    return ok({ sent, totalTokens: tokens.length });
  } catch (e) {
    return fail(e?.message || String(e), 500);
  }
}
