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

/**
 * ✅ Token reader (حل 1)
 * يقرأ من:
 * - auth.js (لو فيه)
 * - localStorage/sessionStorage
 * - أهم مفتاح عندك: CLOS_TOKEN_V1
 *
 * يدعم أن القيمة تكون:
 * - string token مباشرة
 * - أو JSON مثل { token: "..." } أو { access_token: "..." }
 */
function getTokenCompat() {
  // 1) من auth.js إن وُجد
  try {
    const t = typeof getTokenFromAuth === "function" ? String(getTokenFromAuth() || "").trim() : "";
    if (t) return t;
  } catch (_) {}

  // 2) من التخزينات (حسب مفاتيح مشروعك الحالية)
  const keys = [
    "CLOS_TOKEN_V1",     // ✅ المفتاح المؤكد عندك
    "CLOS_TOKEN",
    "clos_token",
    "AUTH_TOKEN",
    "auth_token",
    "token",
    "access_token",
    "clos_session",
  ];

  try {
    for (const k of keys) {
      // sessionStorage
      let v = sessionStorage.getItem(k);
      if (!v) v = localStorage.getItem(k);
      v = String(v || "").trim();
      if (!v) continue;

      // إذا مخزن JSON
      if ((v.startsWith("{") && v.endsWith("}")) || (v.startsWith("[") && v.endsWith("]"))) {
        try {
          const obj = JSON.parse(v);
          const token =
            String(obj?.token || obj?.access_token || obj?.jwt || obj?.data?.token || obj?.data?.access_token || "")
              .trim();
          if (token) return token;
        } catch (_) {
          // لو فشل parse اعتبره token نصي
        }
      }

      // token نصي
      return v;
    }
  } catch (_) {}

  return "";
}

function withAuthHeaders(extraHeaders = {}, needsJson = false) {
  const headers = new Headers(extraHeaders);

  // ✅ أضف Authorization تلقائيًا (حل 1)
  const token = getTokenCompat();
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  // content-type فقط إذا في body
  if (needsJson && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return headers;
}

function throwIfNotOk(res, data) {
  if (!res.ok || data?.ok === false || data?.success === false) {
    const deeper = data?.gas?.error || data?.gas?.message;
    throw new Error(deeper || data?.error || `HTTP ${res.status}`);
  }
}

/** ✅ GET (يرسل Bearer token تلقائيًا) */
export async function apiGet(path, options = {}) {
  const res = await fetch(path, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
    headers: withAuthHeaders(options.headers, false),
    ...options,
  });

  const data = await parseJsonSafe(res);
  throwIfNotOk(res, data);
  return data;
}

/** ✅ POST (يرسل Bearer token تلقائيًا) */
export async function apiPost(path, body, options = {}) {
  const res = await fetch(path, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: withAuthHeaders(options.headers, true),
    body: JSON.stringify(body ?? {}),
    ...options,
  });

  const data = await parseJsonSafe(res);
  throwIfNotOk(res, data);
  return data;
}

/** ✅ Proxy to GAS */
export async function gas(action, payload) {
  action = String(action || "").trim();
  if (!action) throw new Error("Missing action");

  // ✅ auth.* و donate لا يحتاجون token داخل body
  const isPublic = action === "donate" || action.startsWith("auth.");

  const token = getTokenCompat();
  if (!isPublic && !token) {
    throw new Error("Unauthorized: missing token (not saved)");
  }

  // ✅ نرسل wrapper كامل
  const reqBody = { action, payload: payload ?? {} };

  // ✅ بعض GAS actions تعتمد على token داخل body (نحافظ عليها)
  if (token) reqBody.token = token;

  const out = await apiPost("/api/gas", reqBody);

  // Worker يرجع { ok, success, gas, status }
  return out?.gas ?? out;
}

/**
 * ✅ helper للتشخيص (اختياري)
 * استعملها بالكونسول: window.__closToken()
 */
export function __closToken() {
  return getTokenCompat();
}
