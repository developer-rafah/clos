// functions/_lib/jwt.js

function b64urlToBytes(b64url) {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function importHmacKey(secret, usages) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages
  );
}

async function hmacSignBytes(secret, dataStr) {
  const key = await importHmacKey(secret, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(dataStr));
  return new Uint8Array(sig);
}

async function hmacVerify(secret, dataStr, sigBytes) {
  const key = await importHmacKey(secret, ["verify"]);
  return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(dataStr));
}

export async function signJwt(payload, secret, { expSec = 60 * 60 * 24 * 14 } = {}) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expSec };

  const p1 = bytesToB64url(new TextEncoder().encode(JSON.stringify(header)));
  const p2 = bytesToB64url(new TextEncoder().encode(JSON.stringify(body)));
  const signingInput = `${p1}.${p2}`;

  const sig = await hmacSignBytes(secret, signingInput);
  const p3 = bytesToB64url(sig);

  return `${signingInput}.${p3}`;
}

/**
 * يرجّع payload (object) أو null
 */
export async function verifyJwtHS256(token, secret) {
  token = String(token || "").trim();
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [h, p, s] = parts;

  const header = safeJsonParse(new TextDecoder().decode(b64urlToBytes(h)));
  const payload = safeJsonParse(new TextDecoder().decode(b64urlToBytes(p)));
  if (!header || !payload) return null;

  if (header.alg !== "HS256") return null;

  const data = `${h}.${p}`;
  const sigBytes = b64urlToBytes(s);

  const ok = await hmacVerify(secret, data, sigBytes);
  if (!ok) return null;

  // exp (اختياري)
  const now = Math.floor(Date.now() / 1000);
  if (payload?.exp && now > Number(payload.exp)) return null;

  return payload;
}

/**
 * توافق مع كودك الحالي: يرجّع { ok, payload? , error? }
 */
export async function verifyJwt(token, secret) {
  try {
    const payload = await verifyJwtHS256(token, secret);
    if (!payload) return { ok: false, error: "Unauthorized" };
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return "";
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!m) return "";
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/**
 * يقرأ التوكن من:
 * 1) Authorization: Bearer <token>
 * 2) Cookie: clos_session (الأساسي)
 * 3) Cookie: clos_token (للتوافق)
 */
export function getTokenFromRequest(request) {
  // 1) Bearer
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();

  // 2) Cookies
  const cookie = request.headers.get("cookie") || "";
  const fromSession = getCookieValue(cookie, "clos_session");
  if (fromSession) return fromSession;

  const fromToken = getCookieValue(cookie, "clos_token");
  if (fromToken) return fromToken;

  return "";
}
