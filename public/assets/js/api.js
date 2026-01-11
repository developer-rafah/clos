import { getToken } from "./auth.js";

/**
 * نعتبر النجاح إذا:
 * - HTTP OK
 * - و (ok !== false) و (success !== false)
 */
function assertOk(res, data) {
  const okFlag = (data?.ok !== false) && (data?.success !== false);
  if (!res.ok || !okFlag) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data;
}

function buildAuthHeaders(extra = {}) {
  const token = getToken();
  const h = { ...extra };

  // ✅ أرسل Authorization إذا فيه token (مفيد لـ /api/auth/*)
  if (token) h["Authorization"] = `Bearer ${token}`;

  return h;
}

export async function apiGet(path) {
  const res = await fetch(path, {
    method: "GET",
    cache: "no-store",
    headers: buildAuthHeaders(),
  });

  const data = await res.json().catch(() => ({}));
  return assertOk(res, data);
}

export async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    cache: "no-store",
    headers: buildAuthHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(body ?? {}),
  });

  const data = await res.json().catch(() => ({}));
  return assertOk(res, data);
}

/**
 * Proxy to GAS عبر /api/gas
 * ✅ نرسل { action, payload, token }
 * ✅ ونرجع الاستجابة كاملة كما هي (بدون out.gas)
 */
export async function gas(action, payload = {}) {
  const token = getToken();
  const out = await apiPost("/api/gas", { action, payload, token });
  return out; // ✅ مهم جداً
}
