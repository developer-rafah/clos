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
  try {
    const t1 = (typeof getTokenFromAuth === "function" ? String(getTokenFromAuth() || "").trim() : "");
    if (t1) return t1;
  } catch (e) {}

  try {
    const ss1 = String(sessionStorage.getItem("AUTH_TOKEN") || "").trim();
    if (ss1) return ss1;

    const ss2 = String(sessionStorage.getItem("auth_token") || "").trim();
    if (ss2) return ss2;

    const ls1 = String(localStorage.getItem("AUTH_TOKEN") || "").trim();
    if (ls1) return ls1;

    const ls2 = String(localStorage.getItem("auth_token") || "").trim();
    if (ls2) return ls2;
  } catch (e) {}

  return "";
}

export async function apiGet(path) {
  const res = await fetch(path, { method: "GET", cache: "no-store" });
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

export async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
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

  const reqBody = { action, payload: payload ?? {} };
  if (token) reqBody.token = token;

  const out = await apiPost("/api/gas", reqBody);

  // Worker يرجع { ok, success, gas, status }
  return out?.gas ?? out;
}
