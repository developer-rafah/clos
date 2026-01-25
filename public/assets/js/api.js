/**
 * api.js
 * واجهة موحدة للتعامل مع API + GAS
 * متوافق مع Cloudflare Pages + JWT في LocalStorage
 */

/* =========================
   أدوات مساعدة
========================= */

async function parseJsonSafe(res) {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * استخراج التوكن بشكل موحّد
 * المصدر المعتمد: localStorage فقط (واضح + ثابت)
 */
function getToken() {
  try {
    return String(localStorage.getItem("CLOS_TOKEN_V1") || "").trim();
  } catch {
    return "";
  }
}

/* =========================
   طلبات API عامة
========================= */

export async function apiGet(path, { auth = false } = {}) {
  const headers = {};

  if (auth) {
    const token = getToken();
    if (!token) throw new Error("Unauthorized: missing token");
    headers["authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method: "GET",
    headers,
    credentials: "include",
    cache: "no-store",
  });

  const data = await parseJsonSafe(res);

  if (!res.ok || data?.ok === false || data?.success === false) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }

  return data;
}

export async function apiPost(path, body = {}, { auth = false } = {}) {
  const headers = {
    "content-type": "application/json",
  };

  if (auth) {
    const token = getToken();
    if (!token) throw new Error("Unauthorized: missing token");
    headers["authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method: "POST",
    headers,
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(body),
  });

  const data = await parseJsonSafe(res);

  if (!res.ok || data?.ok === false || data?.success === false) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }

  return data;
}

/* =========================
   GAS Proxy
========================= */

/**
 * gas(action, payload)
 * - auth.* و donate → بدون توكن
 * - غير ذلك → يتطلب JWT
 */
export async function gas(action, payload = {}) {
  action = String(action || "").trim();
  if (!action) throw new Error("Missing action");

  const isPublic =
    action === "donate" ||
    action.startsWith("auth.");

  const body = {
    action,
    payload,
  };

  if (!isPublic) {
    const token = getToken();
    if (!token) throw new Error("Unauthorized: missing token");
    body.token = token;
  }

  const res = await apiPost("/api/gas", body);

  // Cloudflare Worker يعيد { ok, success, gas }
  return res?.gas ?? res;
}

/* =========================
   أدوات مساعدة اختيارية
========================= */

/** حفظ التوكن بعد login */
export function saveToken(token) {
  if (!token) return;
  localStorage.setItem("CLOS_TOKEN_V1", token);
}

/** حذف التوكن عند logout */
export function clearToken() {
  localStorage.removeItem("CLOS_TOKEN_V1");
}
