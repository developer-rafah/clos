// functions/api/_shared.js - FULL (Workers/Pages Functions)

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export function getBearerToken(req) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function b64url(bytes) {
  const bin = String.fromCharCode(...bytes);
  const b64 = btoa(bin);
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function unb64url(s) {
  s = s.replaceAll("-", "+").replaceAll("_", "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

export async function jwtSign(payload, secret, expSeconds = 60 * 60 * 24 * 7) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expSeconds };

  const p1 = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const p2 = b64url(new TextEncoder().encode(JSON.stringify(body)));
  const data = `${p1}.${p2}`;
  const sig = await hmacSign(secret, data);
  return `${data}.${b64url(sig)}`;
}

export async function jwtVerify(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Bad token");
  const [p1, p2, p3] = parts;

  const data = `${p1}.${p2}`;
  const sig = await hmacSign(secret, data);
  const expected = b64url(sig);
  if (expected !== p3) throw new Error("Invalid signature");

  const payload = JSON.parse(new TextDecoder().decode(unb64url(p2)));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new Error("Token expired");
  return payload;
}

export function normalizeRole(roleText) {
  const r = String(roleText || "").trim();
  if (r === "مدير" || r === "admin") return { roleKey: "admin", roleLabel: "مدير" };
  if (r === "موظف" || r === "staff") return { roleKey: "staff", roleLabel: "موظف" };
  return { roleKey: "agent", roleLabel: "مندوب" };
}

export function isClosedStatus(s) {
  const st = String(s || "").trim();
  return st === "مكتمل" || st === "مكتملة" || st === "مغلق";
}

export function isCancelledStatus(s) {
  const st = String(s || "").trim();
  return st === "ملغي" || st === "ملغى" || st === "مرفوض";
}

export function sbHeaders(env, extra = {}) {
  const SB_KEY =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.SUPABASE_KEY;

  return {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    "content-type": "application/json",
    ...extra,
  };
}

export async function sbFetch(env, path, init = {}) {
  const SB_URL = env.SUPABASE_URL || env.SUPABASE_REST_URL;
  if (!SB_URL) throw new Error("Missing SUPABASE_URL");
  const url = `${SB_URL.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, init);
  return res;
}

export async function requireUser(req, env) {
  const token = getBearerToken(req);
  if (!token) throw new Error("Unauthorized");
  const secret = env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  const payload = await jwtVerify(token, secret);
  const { roleKey, roleLabel } = normalizeRole(payload.role || payload.roleLabel || payload.roleKey);
  return {
    username: payload.username || payload.sub,
    name: payload.name || payload.username || payload.sub,
    area_code: payload.area_code ?? null,
    roleKey,
    roleLabel,
  };
}

export function parseContentRange(cr) {
  // format: "0-0/45" or "*/45"
  if (!cr) return 0;
  const m = String(cr).match(/\/(\d+)\s*$/);
  return m ? Number(m[1]) : 0;
}
