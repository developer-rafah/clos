function b64uEncode(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64uDecodeToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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

export async function signJwt(payload, secret, { expSec = 60 * 60 * 24 * 14 } = {}) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expSec };

  const part1 = b64uEncode(new TextEncoder().encode(JSON.stringify(header)));
  const part2 = b64uEncode(new TextEncoder().encode(JSON.stringify(body)));
  const signingInput = `${part1}.${part2}`;

  const sig = await hmacSign(secret, signingInput);
  const part3 = b64uEncode(sig);

  return `${signingInput}.${part3}`;
}

export async function verifyJwt(token, secret) {
  token = String(token || "").trim();
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: "Invalid token format" };

  const [p1, p2, p3] = parts;
  const signingInput = `${p1}.${p2}`;

  const sig = await hmacSign(secret, signingInput);
  const expected = b64uEncode(sig);
  if (expected !== p3) return { ok: false, error: "Bad signature" };

  const payloadJson = new TextDecoder().decode(b64uDecodeToBytes(p2));
  const payload = JSON.parse(payloadJson);

  const now = Math.floor(Date.now() / 1000);
  if (payload?.exp && now > Number(payload.exp)) return { ok: false, error: "Expired" };

  return { ok: true, payload };
}
