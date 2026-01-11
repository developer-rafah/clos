// auth.js

const KEYS = ["AUTH_TOKEN", "auth_token"];

export function getToken() {
  for (const k of KEYS) {
    const v =
      (sessionStorage.getItem(k) || "").trim() ||
      (localStorage.getItem(k) || "").trim();
    if (v) return v;
  }
  return "";
}

export function setToken(token) {
  token = String(token || "").trim();
  if (!token) return;
  // احفظ في الاثنين للتوافق مع ملفاتك الحالية
  try { sessionStorage.setItem("AUTH_TOKEN", token); } catch {}
  try { sessionStorage.setItem("auth_token", token); } catch {}
  try { localStorage.setItem("AUTH_TOKEN", token); } catch {}
  try { localStorage.setItem("auth_token", token); } catch {}
}

export function clearToken() {
  for (const k of KEYS) {
    try { sessionStorage.removeItem(k); } catch {}
    try { localStorage.removeItem(k); } catch {}
  }
}
