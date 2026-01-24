import { unauthorized, serverError } from "./response.js";
import { getCookie } from "./security.js";
import { verifyJwt } from "./jwt.js";

export const COOKIE_NAME = "clos_session";

function getTokenFromRequest(request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();

  const cookieToken = getCookie(request, COOKIE_NAME);
  if (cookieToken) return cookieToken;

  return "";
}

export async function requireAuth(request, env) {
  const secret = String(env.JWT_SECRET || env.AUTH_JWT_SECRET || "").trim();
  if (!secret) return { user: null, errorResponse: serverError("JWT_SECRET missing in env") };

  const token = getTokenFromRequest(request);
  if (!token) return { user: null, errorResponse: unauthorized("Missing session token") };

  const v = await verifyJwt(token, secret);
  if (!v.ok) return { user: null, errorResponse: unauthorized("Session invalid/expired") };

  const p = v.payload || {};
  const user = {
    username: String(p.username || p.user || "").trim(),
    name: String(p.name || p.full_name || "").trim(),
    role: String(p.role || "").trim(),
  };

  if (!user.username || !user.role) {
    return { user: null, errorResponse: unauthorized("Token missing user fields") };
  }

  return { user, token, errorResponse: null };
}
