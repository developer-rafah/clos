import { json, badRequest, unauthorized, serverError } from "../../_lib/response.js";
import { setCookie, constantTimeEqual } from "../../_lib/security.js";
import { signJwt } from "../../_lib/jwt.js";
import { getUserByUsername } from "../../_lib/supabase.js";
import { COOKIE_NAME } from "../../_lib/auth.js";

const SESSION_TTL_SEC = 60 * 60 * 24 * 14;

export async function onRequestPost({ request, env }) {
  try {
    const secret = String(env.JWT_SECRET || env.AUTH_JWT_SECRET || "").trim();
    if (!secret) return serverError("JWT_SECRET missing in env");

    const body = await request.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body");

    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();
    if (!username || !password) return badRequest("Missing username/password");

    const row = await getUserByUsername(env, username);
    if (!row) return unauthorized("Invalid credentials");

    if (row.active === false) return unauthorized("User disabled");

    const dbPass = String(row.password || "").trim();
    if (!constantTimeEqual(dbPass, password)) return unauthorized("Invalid credentials");

    const user = {
      username: String(row.username || username).trim(),
      name: String(row.full_name || row.username || username).trim(),
      role: String(row.role || "").trim(),
    };

    if (!user.role) return serverError("User role missing in DB");

    const token = await signJwt(user, secret, { expSec: SESSION_TTL_SEC });

    const cookie = setCookie(COOKIE_NAME, token, {
      maxAge: SESSION_TTL_SEC,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
    });

    return json(
      {
        ok: true,
        success: true,
        user,
        token,
      },
      { status: 200, headers: { "set-cookie": cookie } }
    );
  } catch (e) {
    return serverError(e);
  }
}
