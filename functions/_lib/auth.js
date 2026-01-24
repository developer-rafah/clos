import { unauthorized, forbidden } from "./response.js";

/** base64url -> Uint8Array */
function b64urlToBytes(b64url) {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** base64url -> JSON */
function b64urlToJson(b64url) {
  const bytes = b64urlToBytes(b64url);
  const txt = new TextDecoder().decode(bytes);
  return JSON.parse(txt);
}

async function verifyHs256({ token, secret }) {
  const [h, p, s] = String(token || "").split(".");
  if (!h || !p || !s) throw new Error("Invalid token format");

  const header = b64urlToJson(h);
  if (header?.alg !== "HS256") throw new Error("Unsupported JWT alg");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const data = new TextEncoder().encode(`${h}.${p}`);
  const sig = b64urlToBytes(s);

  const ok = await crypto.subtle.verify("HMAC", key, sig, data);
  if (!ok) throw new Error("Invalid token signature");

  const payload = b64urlToJson(p);

  // exp check (إن وُجد)
  if (payload?.exp && Date.now() / 1000 > Number(payload.exp)) {
    throw new Error("Token expired");
  }

  return payload;
}

/**
 * قراءة user من Authorization Bearer
 */
export async function requireAuth(request, env, { roles = null } = {}) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (!token) return { errorResponse: unauthorized("Missing Bearer token") };

  const secret = String(env.JWT_SECRET || env.AUTH_JWT_SECRET || "").trim();
if (!secret) return { errorResponse: unauthorized("Missing JWT secret (JWT_SECRET)") };

  let payload;
  try {
    payload = await verifyHs256({ token, secret });
  } catch (e) {
    return { errorResponse: unauthorized(`Invalid token: ${e?.message || e}`) };
  }

  const user = {
    token,
    username: String(payload.username || payload.user || "").trim(),
    role: String(payload.role || "").trim(),
    name: String(payload.name || payload.full_name || payload.username || "").trim(),
    userId: String(payload.userId || payload.id || payload.username || "").trim(),
    raw: payload,
  };

  if (!user.username || !user.role) {
    return { errorResponse: unauthorized("Token missing username/role") };
  }

  if (roles && Array.isArray(roles)) {
    const ok = roles.includes(user.role);
    if (!ok) return { errorResponse: forbidden("ليس لديك صلاحية") };
  }

  return { user };
}
