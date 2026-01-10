// public/assets/js/auth.js
import { apiGet, apiPost } from "./api.js";

const LS_ME = "CLOS_ME_V1";

export async function login(username, password) {
  const out = await apiPost("/api/auth/login", { username, password });
  localStorage.setItem(LS_ME, JSON.stringify(out.user || null));
  return out.user;
}

export async function me() {
  try {
    const out = await apiGet("/api/auth/me");
    localStorage.setItem(LS_ME, JSON.stringify(out.user || null));
    return out.user;
  } catch (e) {
    // fallback بسيط من التخزين (واجهة فقط)
    const raw = localStorage.getItem(LS_ME);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
    return null;
  }
}

export async function logout() {
  try {
    await apiPost("/api/auth/logout", {});
  } finally {
    localStorage.removeItem(LS_ME);
  }
}
