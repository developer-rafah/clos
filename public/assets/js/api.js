// public/assets/js/api.js
// API helper for Clos (Cloudflare Pages Functions)
// - Supports Bearer token from localStorage/sessionStorage
// - Avoids "loading forever" by throwing clear errors
// - Use: apiGet("/api/requests", { auth: true })

const TOKEN_KEYS = [
  "CLOS_TOKEN_V1",
  "CLOS_TOKEN",
  "AUTH_TOKEN",
  "auth_token",
  "token",
];

function _safeStr(v) {
  return String(v ?? "").trim();
}

export function getToken() {
  try {
    // 1) localStorage first (your current key)
    for (const k of TOKEN_KEYS) {
      const t = _safeStr(localStorage.getItem(k));
      if (t) return t;
    }
  } catch (_) {}

  try {
    // 2) sessionStorage fallback
    for (const k of TOKEN_KEYS) {
      const t = _safeStr(sessionStorage.getItem(k));
      if (t) return t;
    }
  } catch (_) {}

  return "";
}

export function setToken(token) {
  const t = _safeStr(token);
  try {
    if (t) localStorage.setItem("CLOS_TOKEN_V1", t);
    else localStorage.removeItem("CLOS_TOKEN_V1");
  } catch (_) {}
}

export function clearToken() {
  try {
    for (const k of TOKEN_KEYS) {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    }
  } catch (_) {}
}

async function parseJsonSafe(res) {
  const txt = await res.text().catch(() => "");
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}

function buildHeaders({ auth = false, headers = {} } = {}) {
  const out = new Headers(headers);

  // لا تكتب Content-Type إلا لو بنرسل JSON (في POST)
  // (نتركها للـ apiPost)

  if (auth) {
    const token = getToken();
    if (!token) throw new Error("Unauthorized: missing token");
    out.set("authorization", `Bearer ${token}`);
  }

  return out;
}

function normalizeError(res, data) {
  // رسائل واضحة
  const msg =
    data?.error ||
    data?.message ||
    data?.gas?.error ||
    data?.gas?.message ||
    (typeof data?.raw === "string" ? data.raw : "") ||
    `HTTP ${res.status}`;

  const err = new Error(msg);
  err.status = res.status;
  err.data = data;
  return err;
}

async function request(path, opts = {}) {
  const {
    method = "GET",
    body,
    auth = false,
    headers = {},
    cache = "no-store",
    credentials = "include",
  } = opts;

  const init = {
    method,
    cache,
    credentials,
    headers: buildHeaders({ auth, headers }),
  };

  if (body !== undefined) {
    init.headers.set("content-type", "application/json; charset=utf-8");
    init.body = JSON.stringify(body ?? {});
  }

  const res = await fetch(path, init);
  const data = await parseJsonSafe(res);

  // اعتبر الفشل لو:
  // - HTTP ليس 2xx
  // - أو ok=false
  // - أو success=false
  if (!res.ok || data?.ok === false || data?.success === false) {
    throw normalizeError(res, data);
  }

  return data;
}

export async function apiGet(path, opts = {}) {
  return request(path, { ...opts, method: "GET" });
}

export async function apiPost(path, body, opts = {}) {
  return request(path, { ...opts, method: "POST", body });
}

// ===== Convenience endpoints =====

export async function me() {
  return apiGet("/api/auth/me", { auth: true });
}

export async function logoutApi() {
  // لو عندك endpoint logout
  try {
    await apiPost("/api/auth/logout", {}, { auth: true });
  } catch (_) {}
  clearToken();
  return { ok: true, success: true };
}

export function debugToken() {
  const t = getToken();
  return {
    hasToken: !!t,
    tokenPreview: t ? t.slice(0, 18) + "..." : "",
    key: "CLOS_TOKEN_V1",
  };
}

// للتجارب في الـ Console (اختياري)
try {
  window.__closApi = { apiGet, apiPost, me, getToken, setToken, clearToken, debugToken };
} catch (_) {}
