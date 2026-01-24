// functions/_lib/auth.js
import { unauthorized, forbidden, serverError } from "./response.js";
import { getTokenFromRequest, verifyJwtHS256 } from "./jwt.js";

function norm(s) {
  return String(s || "").trim();
}

function normRole(s) {
  return norm(s).toLowerCase();
}

function normalizeRoles(roles) {
  if (!roles) return null;
  if (Array.isArray(roles)) return roles.map(normRole).filter(Boolean);
  if (typeof roles === "string") return [normRole(roles)];
  return null;
}

/**
 * ✅ يدعم Bearer + Cookie (clos_session/clos_token)
 * ✅ يقرأ السر من JWT_SECRET ثم AUTH_JWT_SECRET للتوافق
 * يرجّع: { user } أو { errorResponse }
 */
export async function requireAuth(request, env, { roles = null } = {}) {
  const token = getTokenFromRequest(request);
  if (!token) return { errorResponse: unauthorized("Unauthorized") };

  const secret = norm(env.JWT_SECRET || env.AUTH_JWT_SECRET);
  if (!secret) return { errorResponse: serverError("Missing JWT_SECRET (or AUTH_JWT_SECRET)") };

  const payload = await verifyJwtHS256(token, secret);
  if (!payload) return { errorResponse: unauthorized("Unauthorized") };

  const user = {
    token,
    username: norm(payload.username || payload.user || payload.sub),
    role: norm(payload.role),
    name: norm(payload.name || payload.full_name || payload.username || payload.sub),
    userId: norm(payload.userId || payload.id || payload.username || payload.sub),
    raw: payload,
  };

  if (!user.username || !user.role) {
    return { errorResponse: unauthorized("Token missing username/role") };
  }

  const allow = normalizeRoles(roles);
  if (allow && !allow.includes(normRole(user.role))) {
    return { errorResponse: forbidden("ليس لديك صلاحية") };
  }

  return { user };
}
