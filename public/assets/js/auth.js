import { apiGet, apiPost } from "./api.js";

const LS_ME = "CLOS_ME_V1";
const LS_TOKEN = "CLOS_TOKEN_V1";

export function getToken() {
  try {
    return String(localStorage.getItem(LS_TOKEN) || "").trim();
  } catch {
    return "";
  }
}

function clearSession() {
  try {
    localStorage.removeItem(LS_ME);
    localStorage.removeItem(LS_TOKEN);
  } catch {}
}

export async function login(username, password) {
  const out = await apiPost("/api/auth/login", { username, password }, { auth: false });

  if (out?.token) localStorage.setItem(LS_TOKEN, String(out.token).trim());
  localStorage.setItem(LS_ME, JSON.stringify(out.user || null));

  return out.user;
}

export async function me() {
  const token = getToken();

  try {
    const out = await apiGet("/api/auth/me", { auth: "auto" });

    if (out?.token) localStorage.setItem(LS_TOKEN, String(out.token).trim());
    localStorage.setItem(LS_ME, JSON.stringify(out.user || null));

    return out.user;
  } catch (e) {
    const status = e?.status;

    // ✅ لو Unauthorized/Forbidden أو لا يوجد توكن: لا تُرجع cache (هذه كانت المشكلة)
    if (status === 401 || status === 403 || !token) {
      clearSession();
      return null;
    }

    // ✅ فقط في أخطاء الشبكة/السيرفر (غير 401/403): اسمح بـ cache كـ fallback
    try {
      const raw = localStorage.getItem(LS_ME);
      if (raw) return JSON.parse(raw);
    } catch {}

    return null;
  }
}

export async function logout() {
  try {
    await apiPost("/api/auth/logout", {}, { auth: "auto" });
  } catch {}
  clearSession();
}
