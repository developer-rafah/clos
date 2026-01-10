import { ok, fail } from "../../_lib/response.js";
import { getCookie } from "../../_lib/security.js";
import { verifyJwt } from "../../_lib/jwt.js";

const COOKIE_NAME = "clos_session";

export async function onRequestGet({ request, env }) {
  try {
    const JWT_SECRET = String(env.JWT_SECRET || "").trim();
    if (!JWT_SECRET) return fail("Missing JWT_SECRET", 500);

    const token = getCookie(request, COOKIE_NAME);
    if (!token) return fail("Unauthorized", 401);

    const v = await verifyJwt(token, JWT_SECRET);
    if (!v.ok) return fail("Unauthorized", 401, { reason: v.error });

    const p = v.payload || {};
    return ok({
      user: { username: p.username || p.sub || "", name: p.name || "", role: p.role || "" },
      token,
    });
  } catch (e) {
    return fail(e?.message || String(e), 500);
  }
}
