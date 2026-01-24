const te = new TextEncoder();

function b64urlEncode(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecodeToBytes(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const s = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return crypto.subtle.sign("HMAC", key, te.encode(data));
}

export async function signJwt(payload, secret, opts = {}) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const exp = opts.expiresInSec ? now + opts.expiresInSec : undefined;

  const body = { ...payload, iat: now };
  if (exp) body.exp = exp;

  const h = b64urlEncode(te.encode(JSON.stringify(header)));
  const p = b64urlEncode(te.encode(JSON.stringify(body)));
  const data = `${h}.${p}`;

  const sig = await hmacSha256(secret, data);
  const s = b64urlEncode(new Uint8Array(sig));
  return `${data}.${s}`;
}

export async function verifyJwt(token, secret) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return { ok: false, error: "Invalid token format" };

    const [h, p, s] = parts;
    const data = `${h}.${p}`;

    const key = await crypto.subtle.importKey(
      "raw",
      te.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBytes = b64urlDecodeToBytes(s);
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, te.encode(data));
    if (!valid) return { ok: false, error: "Bad signature" };

    const payloadJson = new TextDecoder().decode(b64urlDecodeToBytes(p));
    const payload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) return { ok: false, error: "Token expired" };

    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}
