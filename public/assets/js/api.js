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

/** ✅ توكن متوافق مع كل الإصدارات (يحُل مشكلة null) */
function getTokenCompat() {
  // 1) من auth.js
  try {
    const t1 =
      typeof getTokenFromAuth === "function"
        ? String(getTokenFromAuth() || "").trim()
        : "";
    if (t1) return t1;
  } catch (_) {}

  // 2) من التخزينات
  try {
    const keys = [
      "clos_token",
      "CLOS_TOKEN",
      "AUTH_TOKEN",
      "auth_token",
      "token",
      "access_token",
      "clos_session",
    ];

    for (const k of keys) {
      const s1 = String(sessionStorage.getItem(k) || "").trim();
      if (s1) return s1;

      const l1 = String(localStorage.getItem(k) || "").trim();
      if (l1) return l1;
    }
  } catch (_) {}

  return "";
}

function buildHeaders(extraHeaders, needsJson) {
  const headers = new Headers(extraHeaders || {});

  // ✅ ضيف التوكن تلقائيًا (حل 1)
  const token = getTokenCompat();
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  // content-type فقط لو فيه body
  if (needsJson && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return headers;
}

/** ✅ GET مع Bearer token تلقائيًا */
export async function apiGet(path) {
  const res = await fetch(path, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
    headers: buildHeaders({}, false),
  });

  const data = await parseJsonSafe(res);

  // ✅ اعتبر الفشل لو:
  // - HTTP ليس 2xx
  // - أو ok=false
  // - أو success=false
  if (!res.ok || data?.ok === false || data?.success === false) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }

  return data;
}

/** ✅ POST مع Bearer token تلقائيًا */
export async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: buildHeaders({}, true),
    body: JSON.stringify(body ?? {}),
  });

  const data = await parseJsonSafe(res);

  if (!res.ok || data?.ok === false || data?.success === false) {
    // حاول استخراج رسالة أوضح إن كانت موجودة داخل gas
    const deeper = data?.gas?.error || data?.gas?.message;
    throw new Error(deeper || data?.error || `HTTP ${res.status}`);
  }

  return data;
}

/** ✅ Proxy to GAS */
export async function gas(action, payload) {
  action = String(action || "").trim();
  if (!action) throw new Error("Missing action");

  // ✅ auth.* و donate لا يحتاجون token
  const isPublic = action === "donate" || action.startsWith("auth.");

  const token = getTokenCompat();

  if (!isPublic) {
    // agent.* وكل باقي الأكشنز تحتاج توكن
    if (!token) throw new Error("Unauthorized: missing token (not saved)");
  }

  // ✅ نرسل wrapper كامل
  const reqBody = { action, payload: payload ?? {} };

  // ✅ بعض أكشنز GAS تحتاج token داخل body (حافظنا على ذلك)
  if (token) reqBody.token = token;

  const out = await apiPost("/api/gas", reqBody);

  // Worker يرجع { ok, success, gas, status }
  return out?.gas ?? out;
}
