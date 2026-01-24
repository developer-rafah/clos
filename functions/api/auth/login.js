import { ok, badRequest, unauthorized, serverError } from "../../_lib/response.js";
import { signJwt } from "../../_lib/jwt.js";
import { buildSetCookie, constantTimeEqual, sha256Hex } from "../../_lib/security.js";
import { COOKIE_NAME } from "../../_lib/auth.js";
import { getUserByUsername, envProblem } from "../../_lib/supabase.js";

function pickJwtSecret(env) {
  return String(env.JWT_SECRET || env.AUTH_JWT_SECRET || "").trim();
}

export async function onRequestPost({ request, env }) {
  const secret = pickJwtSecret(env);
  if (!secret) return serverError("Missing JWT_SECRET in environment");

  const body = await request.json().catch(() => ({}));
  const username = String(body.username || "").trim();
  const password = String(body.password || "").trim();
  if (!username || !password) return badRequest("Missing username/password");

  let user;
  try {
    user = await getUserByUsername(env, username);
  } catch (e) {
    return envProblem(e);
  }

  if (!user) return unauthorized("Invalid credentials");

  // ندعم أكثر من اسم حقل حسب قاعدة بياناتك
  const stored = String(user.password_hash || user.password || "").trim();
  if (!stored) return unauthorized("Invalid credentials");

  let passOk = false;

  // لو مخزن SHA256 (64 hex)
  if (/^[a-f0-9]{64}$/i.test(stored)) {
    const hashed = await sha256Hex(password);
    passOk = constantTimeEqual(hashed.toLowerCase(), stored.toLowerCase());
  } else {
    // plaintext (غير مفضل لكنه شائع في مشاريع بسيطة)
    passOk = constantTimeEqual(password, stored);
  }

  if (!passOk) return unauthorized("Invalid credentials");

  const payload = {
    username: user.username || username,
    name: user.name || user.full_name || "",
    role: user.role || "agent",
    area_code: user.area_code || null,
  };

  const token = await signJwt(payload, secret, { expiresInSec: 60 * 60 * 24 * 7 }); // 7 أيام

  const setCookie = buildSetCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return ok(
    {
      user: { username: payload.username, name: payload.name, role: payload.role },
      token,
    },
    200,
    { "set-cookie": setCookie }
  );
}
