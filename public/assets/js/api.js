// public/assets/js/api.js

async function parseJsonSafe(res) {
  const txt = await res.text().catch(() => "");
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}

/** ✅ توكن متوافق (يدعم عدة مفاتيح) — بدون circular imports */
function getTokenCompat() {
  const keys = ["CLOS_TOKEN_V1", "CLOS_TOKEN", "AUTH_TOKEN", "auth_token", "token"];

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
  // auth: true   => لازم توكن (لو غير موجود: ارمي خطأ واضح)
  // auth: false  => لا ترسل توكن
  const token = getTokenCompat();

  if (auth === true && !token) {
    const err = new Error("انتهت الجلسة أو لا يوجد توكن. فضلاً أعد تسجيل الدخول.");
    err.status = 401;
    throw err;
  }

  const shouldSend = auth === true || (auth === "auto" && !!token);
  if (!shouldSend || !token) return headers;

  return {
    ...headers,
    Authorization: `Bearer ${token}`, // استخدمنا الشكل القياسي
  };
}

function throwIfNotOk(res, data) {
  if (res.ok && data?.ok !== false && data?.success !== false) return;

  const deeper = data?.gas?.error || data?.gas?.message;
  const msg = deeper || data?.error || data?.message || `HTTP ${res.status}`;

  const err = new Error(msg);
  err.status = res.status;
  err.data = data;
  throw err;
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
    headers: withAuthHeaders({ "content-type": "application/json" }, opts),
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

  const out = await apiPost(
    "/api/gas",
    { action, payload: payload ?? {} },
    { auth: isPublic ? "auto" : true, ...opts }
  );

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
