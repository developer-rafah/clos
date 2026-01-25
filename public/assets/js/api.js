/**
 * api.js
 * - إرسال Bearer Token تلقائيًا من localStorage
 * - دعم GAS proxy
 * - توفير دوال global للتجربة في console
 */

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
 * ✅ يقرأ التوكن من CLOS_TOKEN_V1
 * يدعم:
 * - token string مباشرة
 * - أو JSON مثل {"token":"..."} أو {"access_token":"..."}
 */
function getToken() {
  try {
    const raw = String(localStorage.getItem("CLOS_TOKEN_V1") || "").trim();
    if (!raw) return "";

    // لو كان JSON
    if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
      try {
        const obj = JSON.parse(raw);
        return String(obj?.token || obj?.access_token || obj?.jwt || "").trim();
      } catch {
        // لو فشل parse اعتبره نص
        return raw;
      }
    }

    // نص مباشر
    return raw;
  } catch {
    return "";
  }
}

function withAuthHeaders(extraHeaders = {}, needsJson = false, auth = false) {
  const headers = new Headers(extraHeaders);

  if (needsJson && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (auth) {
    const token = getToken();
    if (!token) throw new Error("Unauthorized: missing token (CLOS_TOKEN_V1 is empty)");
    headers.set("authorization", `Bearer ${token}`);
  }

  return headers;
}

function throwIfNotOk(res, data) {
  if (!res.ok || data?.ok === false || data?.success === false) {
    const deeper = data?.gas?.error || data?.gas?.message;
    throw new Error(deeper || data?.error || `HTTP ${res.status}`);
  }
}

/** ✅ GET */
export async function apiGet(path, { auth = false, headers = {} } = {}) {
  const res = await fetch(path, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
    headers: withAuthHeaders(headers, false, auth),
  });

  const data = await parseJsonSafe(res);
  throwIfNotOk(res, data);
  return data;
}

/** ✅ POST */
export async function apiPost(path, body = {}, { auth = false, headers = {} } = {}) {
  const res = await fetch(path, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: withAuthHeaders(headers, true, auth),
    body: JSON.stringify(body ?? {}),
  });

  const data = await parseJsonSafe(res);
  throwIfNotOk(res, data);
  return data;
}

/** ✅ GAS proxy */
export async function gas(action, payload = {}) {
  action = String(action || "").trim();
  if (!action) throw new Error("Missing action");

  const isPublic = action === "donate" || action.startsWith("auth.");

  const body = { action, payload };

  // بعض أكشنز GAS تحتاج token داخل body
  if (!isPublic) {
    const token = getToken();
    if (!token) throw new Error("Unauthorized: missing token (CLOS_TOKEN_V1 is empty)");
    body.token = token;
  }

  const out = await apiPost("/api/gas", body, { auth: false });
  return out?.gas ?? out;
}

/** ✅ تشخيص سريع */
export function __debugToken() {
  return getToken();
}

/* =========================
   ✅ اجعلها متاحة في console
========================= */
if (typeof window !== "undefined") {
  window.apiGet = apiGet;
  window.apiPost = apiPost;
  window.gas = gas;
  window.__debugToken = __debugToken;
}
