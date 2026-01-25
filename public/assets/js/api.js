// public/assets/js/api.js
// API helper for same-origin Cloudflare Pages Functions
// - Adds Authorization Bearer token when { auth:true }
// - Reads token from multiple keys (CLOS_TOKEN_V1 + legacy keys)

function parseJsonSafeText(txt) {
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}

async function readResponse(res) {
  const txt = await res.text().catch(() => "");
  const data = parseJsonSafeText(txt);
  return { txt, data };
}

/** ✅ توكن متوافق مع كل الإصدارات */
export function getTokenCompat() {
  // key used in your screenshots
  const keys = [
    "CLOS_TOKEN_V1",
    "AUTH_TOKEN",
    "auth_token",
    "token",
    "jwt",
  ];

  try {
    for (const k of keys) {
      const v = String(localStorage.getItem(k) || "").trim();
      if (v) return v;
    }
  } catch {}

  try {
    for (const k of keys) {
      const v = String(sessionStorage.getItem(k) || "").trim();
      if (v) return v;
    }
  } catch {}

  return "";
}

export function setToken(token) {
  const t = String(token || "").trim();
  if (!t) return clearToken();
  try {
    localStorage.setItem("CLOS_TOKEN_V1", t);
  } catch {}
}

export function clearToken() {
  try {
    localStorage.removeItem("CLOS_TOKEN_V1");
    localStorage.removeItem("AUTH_TOKEN");
    localStorage.removeItem("auth_token");
    sessionStorage.removeItem("AUTH_TOKEN");
    sessionStorage.removeItem("auth_token");
  } catch {}
}

function buildHeaders({ auth = false, headers = {} } = {}) {
  const h = new Headers(headers || {});
  if (!h.has("accept")) h.set("accept", "application/json");

  if (auth) {
    const token = getTokenCompat();
    if (token) h.set("authorization", `Bearer ${token}`);
  }

  return h;
}

function throwIfNotOk(res, data) {
  // اعتبر الفشل لو:
  // - HTTP ليس 2xx
  // - أو ok=false
  // - أو success=false
  if (!res.ok || data?.ok === false || data?.success === false) {
    const msg =
      data?.error ||
      data?.message ||
      data?.gas?.error ||
      data?.gas?.message ||
      `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
}

export async function apiGet(path, opts = {}) {
  const res = await fetch(path, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
    headers: buildHeaders(opts),
  });

  const { data } = await readResponse(res);
  throwIfNotOk(res, data);
  return data;
}

export async function apiPost(path, body, opts = {}) {
  const res = await fetch(path, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: buildHeaders({
      ...opts,
      headers: {
        "content-type": "application/json",
        ...(opts.headers || {}),
      },
    }),
    body: JSON.stringify(body ?? {}),
  });

  const { data } = await readResponse(res);
  throwIfNotOk(res, data);
  return data;
}

/** ✅ Proxy to GAS */
export async function gas(action, payload) {
  action = String(action || "").trim();
  if (!action) throw new Error("Missing action");

  // auth.* و donate لا يحتاجون token
  const isPublic = action === "donate" || action.startsWith("auth.");

  const token = getTokenCompat();
  if (!isPublic && !token) throw new Error("Unauthorized: missing token (not saved)");

  const reqBody = { action, payload: payload ?? {} };
  if (token) reqBody.token = token;

  const out = await apiPost("/api/gas", reqBody, { auth: false });
  return out?.gas ?? out;
}
