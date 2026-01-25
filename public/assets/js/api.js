// public/assets/js/api.js
import { getToken as getTokenFromAuth } from "./auth.js";

async function parseJsonSafe(res) {
  const txt = await res.text().catch(() => "");
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}

/** ✅ توكن متوافق (يدعم CLOS_TOKEN_V1) */
function getTokenCompat() {
  // 1) من auth.js إن وُجد
  try {
    const t1 =
      typeof getTokenFromAuth === "function"
        ? String(getTokenFromAuth() || "").trim()
        : "";
    if (t1) return t1;
  } catch {}

  // 2) من التخزين (الأهم عندك)
  const keys = [
    "CLOS_TOKEN_V1",
    "CLOS_TOKEN",
    "AUTH_TOKEN",
    "auth_token",
    "token",
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

function withAuthHeaders(headers = {}, { auth = "auto" } = {}) {
  // auth: "auto" => أرسل التوكن إذا موجود
  // auth: true   => لازم توكن (لو غير موجود لا يرسل لكن لاحقاً ستأخذ 401)
  // auth: false  => لا ترسل توكن
  const token = getTokenCompat();
  const shouldSend = auth === true || (auth === "auto" && !!token);

  if (!shouldSend || !token) return headers;

  return {
    ...headers,
    authorization: `Bearer ${token}`,
  };
}

function throwIfNotOk(res, data) {
  if (!res.ok || data?.ok === false || data?.success === false) {
    const deeper = data?.gas?.error || data?.gas?.message;
    throw new Error(deeper || data?.error || `HTTP ${res.status}`);
  }
}

export async function apiGet(path, opts = {}) {
  const res = await fetch(path, {
    method: "GET",
    cache: "no-store",
    headers: withAuthHeaders({}, opts),
  });
  const data = await parseJsonSafe(res);
  throwIfNotOk(res, data);
  return data;
}

export async function apiPost(path, body, opts = {}) {
  const res = await fetch(path, {
    method: "POST",
    cache: "no-store",
    headers: withAuthHeaders(
      { "content-type": "application/json" },
      opts
    ),
    body: JSON.stringify(body ?? {}),
  });

  const data = await parseJsonSafe(res);
  throwIfNotOk(res, data);
  return data;
}

/** ✅ Proxy to GAS */
export async function gas(action, payload, opts = {}) {
  action = String(action || "").trim();
  if (!action) throw new Error("Missing action");

  // auth.* و donate لا يحتاجون token
  const isPublic = action === "donate" || action.startsWith("auth.");

  // إذا ليس public: لازم نرسل Bearer
  const out = await apiPost(
    "/api/gas",
    { action, payload: payload ?? {} },
    { auth: isPublic ? "auto" : true, ...opts }
  );

  // Worker يرجع { ok, success, gas, status }
  return out?.gas ?? out;
}

// ✅ للمساعدة في الاختبارات من الكونسول
export function debugToken() {
  const t = getTokenCompat();
  return {
    hasToken: !!t,
    tokenPreview: t ? t.slice(0, 20) + "..." : "",
    key: "CLOS_TOKEN_V1",
  };
}
