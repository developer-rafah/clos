// functions/api/auth/me.js

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function unauthorized(msg = "Unauthorized") {
  return json({ ok: false, success: false, error: msg }, 401);
}

function serverError(msg = "Server error") {
  return json({ ok: false, success: false, error: msg }, 500);
}

function pickJwtSecret(env) {
  return String(env.JWT_SECRET || env.AUTH_JWT_SECRET || "").trim();
}

function b64urlToU8(s) {
  s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function u8ToB64url(u8) {
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

  // exp check
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

export async function onRequestGet({ request, env }) {
  const secret = pickJwtSecret(env);
  if (!secret) return serverError("Missing JWT_SECRET in environment");

  const token = getBearerToken(request);
  if (!token) return unauthorized("Missing Bearer token");

  try {
    const payload = await verifyJwtHS256(token, secret);

    // ✅ أعد نفس الحقول + area_code (إن وُجد)
    return json({
      ok: true,
      success: true,
      user: {
        username: payload.username || "",
        name: payload.name || "",
        role: payload.role || "agent",
        area_code: payload.area_code ?? null,
      },
      token,
    });
  } catch (e) {
    return unauthorized(e?.message || "Unauthorized");
  }
}
