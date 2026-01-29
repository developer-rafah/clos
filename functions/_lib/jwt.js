// functions/_lib/jwt.js
const te = new TextEncoder();

function b64url(bytes) {
  const bin = String.fromCharCode(...bytes);
  const b64 = btoa(bin);
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function ub64url(s) {
  s = s.replaceAll("-", "+").replaceAll("_", "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, te.encode(data));
  return new Uint8Array(sig);
}

async function hmacVerify(secret, data, sigBytes) {
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return await crypto.subtle.verify("HMAC", key, sigBytes, te.encode(data));
}

export async function signJwt(payload, secret, expSeconds = 60 * 60 * 24 * 14) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expSeconds };

  const h = b64url(te.encode(JSON.stringify(header)));
  const p = b64url(te.encode(JSON.stringify(body)));
  const data = `${h}.${p}`;
  const sig = await hmacSign(secret, data);
  return `${data}.${b64url(sig)}`;
}

export async function verifyJwt(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Invalid token");

  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const sigBytes = ub64url(s);

  const ok = await hmacVerify(secret, data, sigBytes);
  if (!ok) throw new Error("Invalid signature");

  const payload = JSON.parse(new TextDecoder().decode(ub64url(p)));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new Error("Token expired");
  return payload;
}
