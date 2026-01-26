// functions/api/requests.js

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function fail(msg, status = 400) {
  return json({ ok: false, success: false, error: msg }, status);
}

function unauthorized(msg = "Unauthorized") {
  return fail(msg, 401);
}

function pickJwtSecret(env) {
  return String(env.JWT_SECRET || env.AUTH_JWT_SECRET || "").trim();
}

function pickSupabase(env) {
  const url = String(env.SUPABASE_URL || "").trim();
  const key = String(
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_KEY ||
    env.SUPABASE_KEY ||
    env.SUPABASE_ANON_KEY ||
    ""
  ).trim();
  return { url, key };
}

function b64urlToU8(s) {
  s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function hmacSha256(secret, data) {
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

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
}

async function verifyJwtHS256(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Bad token");
  const [h, p, s] = parts;

  const header = JSON.parse(new TextDecoder().decode(b64urlToU8(h)));
  if ((header.alg || "").toUpperCase() !== "HS256") throw new Error("Bad alg");

  const payload = JSON.parse(new TextDecoder().decode(b64urlToU8(p)));
  if (payload.exp && Date.now() / 1000 > Number(payload.exp)) throw new Error("Token expired");

  const data = `${h}.${p}`;
  const expected = await hmacSha256(secret, data);
  const given = b64urlToU8(s);

  if (!constantTimeEqual(expected, given)) throw new Error("Bad signature");
  return payload;
}

function getBearerToken(req) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function countFromContentRange(cr) {
  // مثل: 0-49/123
  const m = String(cr || "").match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

export async function onRequestGet({ request, env }) {
  const secret = pickJwtSecret(env);
  if (!secret) return fail("Missing JWT_SECRET in environment", 500);

  const token = getBearerToken(request);
  if (!token) return unauthorized("Missing Bearer token");

  let user;
  try {
    user = await verifyJwtHS256(token, secret);
  } catch (e) {
    return unauthorized(e?.message || "Unauthorized");
  }

  const username = String(user.username || "").trim();
  const role = String(user.role || "agent").trim().toLowerCase();

  const { url: SB_URL, key: SB_KEY } = pickSupabase(env);
  if (!SB_URL || !SB_KEY) return fail("Missing SUPABASE_URL / SUPABASE_KEY", 500);

  const u = new URL(request.url);
  const limit = Math.min(Math.max(Number(u.searchParams.get("limit") || 50), 1), 200);
  const offset = Math.max(Number(u.searchParams.get("offset") || 0), 0);
  const debug = u.searchParams.get("debug") === "1";

  // ✅ جدولك اسمه requests (حسب الصورة)
  const table = String(env.REQUESTS_TABLE || "requests").trim();

  const qs = new URLSearchParams();
  qs.set("select", "*");
  qs.set("order", "created_at.desc");
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));

  // ✅ الفلترة الصحيحة للمندوب (حسب أعمدة جدولك)
  if (role === "agent" || role === "مندوب") {
    if (!username) return fail("Missing username in token", 400);
    qs.set("agent_username", `eq.${username}`);
    // اختيارياً: لا تجلب الملغاة/المغلقة إن أحببت
    // qs.set("cancelled_at", "is.null");
    // qs.set("closed_at", "is.null");
  }

  // admin: بدون فلترة
  // staff: إن رغبت فلترة حسب district/area_code تحتاج عمود لذلك (غير ظاهر في جدولك)

  const endpoint = `${SB_URL.replace(/\/$/, "")}/rest/v1/${table}?${qs.toString()}`;

  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      apikey: SB_KEY,
      authorization: `Bearer ${SB_KEY}`,
      accept: "application/json",
      prefer: "count=exact",
    },
  });

  const data = await res.json().catch(() => []);
  if (!res.ok) {
    return fail(data?.message || data?.hint || `Supabase HTTP ${res.status}`, res.status);
  }

  const total = countFromContentRange(res.headers.get("content-range")) ?? (Array.isArray(data) ? data.length : 0);

  return json({
    ok: true,
    success: true,
    items: Array.isArray(data) ? data : [],
    pagination: { limit, offset, count: total },
    role: role === "مندوب" ? "agent" : role,
    ...(debug ? { debug: { username, role, filter: role === "agent" || role === "مندوب" ? { agent_username: username } : "none" } } : {}),
  });
}
