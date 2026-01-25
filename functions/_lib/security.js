export function parseCookies(cookieHeader) {
  const out = {};
  const s = String(cookieHeader || "");
  if (!s) return out;

  s.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    out[k] = decodeURIComponent(v);
  });

  return out;
}

export function getCookie(request, name) {
  const cookies = parseCookies(request.headers.get("Cookie"));
  return cookies[name];
}

export function buildSetCookie(name, value, opts = {}) {
  const {
    path = "/",
    httpOnly = true,
    secure = true,
    sameSite = "Lax",
    maxAge, // seconds
    expires, // Date
  } = opts;

  let cookie = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
  if (httpOnly) cookie += "; HttpOnly";
  if (secure) cookie += "; Secure";
  if (typeof maxAge === "number") cookie += `; Max-Age=${maxAge}`;
  if (expires instanceof Date) cookie += `; Expires=${expires.toUTCString()}`;
  return cookie;
}

export function clearCookie(name, opts = {}) {
  return buildSetCookie(name, "", {
    ...opts,
    maxAge: 0,
    expires: new Date(0),
  });
}

export function constantTimeEqual(a, b) {
  const aa = String(a || "");
  const bb = String(b || "");
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i++) out |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  return out === 0;
}

export async function sha256Hex(text) {
  const enc = new TextEncoder().encode(String(text || ""));
  const hash = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

