// public/assets/js/auth.js
import { apiGet, apiPost } from "./api.js";

const LS_ME = "CLOS_ME_V1";
const LS_TOKEN = "CLOS_TOKEN_V1";

export function getToken() {
  return String(localStorage.getItem(LS_TOKEN) || "");
}

export async function login(username, password) {
  const out = await apiPost("/api/auth/login", { username, password });

  if (out?.token) localStorage.setItem(LS_TOKEN, String(out.token));
  localStorage.setItem(LS_ME, JSON.stringify(out.user || null));

  return out.user;
}

export async function me() {
  try {
    const out = await apiGet("/api/auth/me");
    if (out?.token) localStorage.setItem(LS_TOKEN, String(out.token));
    localStorage.setItem(LS_ME, JSON.stringify(out.user || null));
    return out.user;
  } catch {
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
  } catch {}
  localStorage.removeItem(LS_ME);
  localStorage.removeItem(LS_TOKEN);
}
