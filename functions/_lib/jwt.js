function b64urlEncode(bytes) {
  let str = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecodeToBytes(s) {
  const b64 = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSHA256(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return new Uint8Array(sig);
}

export async function signJwt(payload, secret, { expSec = 60 * 60 * 24 * 14 } = {}) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const body = {
    ...payload,
    iat: payload?.iat ?? now,
    exp: payload?.exp ?? now + expSec,
  };

  const h = b64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const p = b64urlEncode(new TextEncoder().encode(JSON.stringify(body)));
  const toSign = `${h}.${p}`;
  const sig = await hmacSHA256(toSign, secret);
  const s = b64urlEncode(sig);
  return `${toSign}.${s}`;
}

export async function verifyJwt(token, secret) {
  try {
    const t = String(token || "").trim();
    const [h, p, s] = t.split(".");
    if (!h || !p || !s) return { ok: false, error: "Malformed token" };

    const toSign = `${h}.${p}`;
    const expected = await hmacSHA256(toSign, secret);
    const given = b64urlDecodeToBytes(s);

    if (expected.length !== given.length) return { ok: false, error: "Bad signature" };
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ given[i];
    if (diff !== 0) return { ok: false, error: "Bad signature" };

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecodeToBytes(p)));
    const now = Math.floor(Date.now() / 1000);
    if (payload?.exp && now > Number(payload.exp)) return { ok: false, error: "Expired" };

    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: e?.message || "Verify failed" };
  }
}
