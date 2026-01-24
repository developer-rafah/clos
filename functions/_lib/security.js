export function constantTimeEqual(a, b) {
  const aa = String(a ?? "");
  const bb = String(b ?? "");
  if (aa.length !== bb.length) return false;

  let out = 0;
  for (let i = 0; i < aa.length; i++) out |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  return out === 0;
}

export function parseCookies(header) {
  const out = {};
  const h = String(header || "");
  if (!h) return out;

  h.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) return;
    out[k] = decodeURIComponent(v);
  });

  return out;
}

export function getCookie(request, name) {
  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies[name] ?? null;
}

export function setCookie(name, value, opts = {}) {
  const {
    maxAge,
    path = "/",
    httpOnly = true,
    secure = true,
    sameSite = "Lax",
    domain,
  } = opts;

  let s = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
  if (typeof maxAge === "number") s += `; Max-Age=${Math.floor(maxAge)}`;
  if (domain) s += `; Domain=${domain}`;
  if (httpOnly) s += `; HttpOnly`;
  if (secure) s += `; Secure`;
  return s;
}

export function clearCookie(name, opts = {}) {
  return setCookie(name, "", { ...opts, maxAge: 0 });
}
