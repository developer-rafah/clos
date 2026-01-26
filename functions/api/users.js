// functions/api/users.js

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function pickJwtSecret(env) {
  return String(env.JWT_SECRET || env.AUTH_JWT_SECRET || "").trim();
}

function pickSupabase(env) {
  const url = String(env.SUPABASE_URL || env.SUPABASE_API_URL || "").trim();
  const key = String(
    env.SUPABASE_SERVICE_ROLE_KEY ||
      env.SUPABASE_SERVICE_KEY ||
      env.SUPABASE_KEY ||
      env.SUPABASE_ANON_KEY ||
      ""
  ).trim();
  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)");
  return { url, key };
}

function base64UrlToBytes(str) {
  str = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) str += "=".repeat(4 - pad);
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJwtNoVerify(token) {
  const [, p] = String(token || "").split(".");
  if (!p) throw new Error("Bad token");
  const payloadBytes = base64UrlToBytes(p);
  const payloadJson = new TextDecoder().decode(payloadBytes);
  return JSON.parse(payloadJson);
}

async function verifyJwtHS256(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Bad token");
  const [h, p, s] = parts;

  const signingInput = `${h}.${p}`;
  const sigBytes = base64UrlToBytes(s);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(signingInput)
  );

  if (!ok) throw new Error("Invalid signature");

  const payload = decodeJwtNoVerify(token);
  if (payload?.exp && Date.now() / 1000 > Number(payload.exp)) throw new Error("Token expired");
  return payload;
}

function getTokenFromRequest(req) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  return "";
}

function normalizeRole(role) {
  const r = String(role || "").trim();
  if (r === "مندوب" || r === "agent") return "agent";
  if (r === "موظف" || r === "staff") return "staff";
  if (r === "مدير" || r === "admin" || r === "مشرف") return "admin";
  return r || "agent";
}

async function sbFetch(env, path) {
  const { url, key } = pickSupabase(env);
  return fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
  });
}

export async function onRequestGet({ request, env }) {
  try {
    const secret = pickJwtSecret(env);
    if (!secret) return json({ ok: false, success: false, error: "Missing JWT secret" }, 500);

    const token = getTokenFromRequest(request);
    if (!token) return json({ ok: false, success: false, error: "Unauthorized" }, 401);

    const payload = await verifyJwtHS256(token, secret);
    const role = normalizeRole(payload?.role);
    if (role !== "staff" && role !== "admin") {
      return json({ ok: false, success: false, error: "Forbidden" }, 403);
    }

    // المندوبين فقط
    const res = await sbFetch(env, "users?select=username,name,role&order=username.asc");
    const users = await res.json().catch(() => []);
    const agents = (Array.isArray(users) ? users : []).filter((u) => {
      const r = String(u.role || "").trim();
      return r === "مندوب" || r === "agent";
    });

    return json({ ok: true, success: true, agents });
  } catch (e) {
    return json({ ok: false, success: false, error: e?.message || String(e) }, 500);
  }
}
