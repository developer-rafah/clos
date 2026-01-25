import { unauthorized, forbidden, serverError } from "./response.js";
import { getCookie } from "./security.js";
import { verifyJwt } from "./jwt.js";

export const COOKIE_NAME = "clos_session";

function pickJwtSecret(env) {
  const s = String(env.JWT_SECRET || "").trim();
  if (s) return s;

  // fallback للتوافق مع إعداداتك القديمة
  const s2 = String(env.AUTH_JWT_SECRET || "").trim();
  return s2;
}

export async function requireAuth(request, env, opts = {}) {
  const { roles } = opts;

  const secret = pickJwtSecret(env);
  if (!secret) {
    return { errorResponse: serverError("Missing JWT_SECRET in environment") };
  }

  // 1) Cookie
  let token = getCookie(request, COOKIE_NAME);

  // 2) Authorization: Bearer
  if (!token) {
    const auth = request.headers.get("Authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) token = m[1];
  }

  if (!token) return { errorResponse: unauthorized("Unauthorized") };

  const v = await verifyJwt(token, secret);
  if (!v.ok) return { errorResponse: unauthorized("Unauthorized", { reason: v.error }) };

  const p = v.payload || {};
  const user = {
    username: p.username || p.sub,
    name: p.name,
    role: p.role,
    area_code: p.area_code,
    token,
  };

  if (!user.username || !user.role) return { errorResponse: unauthorized("Unauthorized") };

  if (Array.isArray(roles) && roles.length && !roles.includes(user.role)) {
    return { errorResponse: forbidden("Forbidden") };
  }

  return { user };
}

