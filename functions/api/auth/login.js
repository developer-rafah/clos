import { ok, fail } from "../../_lib/response.js";
import { getUserByUsername } from "../../_lib/supabase.js";
import { constantTimeEqual, setCookie } from "../../_lib/security.js";
import { signJwt } from "../../_lib/jwt.js";

const COOKIE_NAME = "clos_session";

export async function onRequestPost({ request, env }) {
  try {
    const JWT_SECRET = String(env.JWT_SECRET || "").trim();
    if (!JWT_SECRET) return fail("Missing JWT_SECRET", 500);

    const body = await request.json().catch(() => ({}));
    const username = String(body.username || body.user || "").trim();
    const password = String(body.password || body.pass || "").trim();

    if (!username || !password) return fail("Missing credentials", 400);

    const u = await getUserByUsername(env, username);
    if (!u) return fail("بيانات الدخول غير صحيحة", 401);
    if (u.active === false) return fail("الحساب غير مفعل", 403);

    const dbPass = String(u.password || "").trim();
    if (!dbPass || !constantTimeEqual(dbPass, password)) {
      return fail("بيانات الدخول غير صحيحة", 401);
    }

    const user = {
      username: String(u.username || username),
      name: String(u.full_name || u.username || username),
      role: String(u.role || ""),
    };

    const token = await signJwt(
      { sub: user.username, username: user.username, name: user.name, role: user.role },
      JWT_SECRET,
      { expSec: 60 * 60 * 24 * 14 }
    );

    const headers = new Headers();
    headers.append("set-cookie", setCookie(COOKIE_NAME, token, { maxAge: 60 * 60 * 24 * 14 }));

    return ok({ user, token }, 200, headers);
  } catch (e) {
    return fail(e?.message || String(e), 500);
  }
}
