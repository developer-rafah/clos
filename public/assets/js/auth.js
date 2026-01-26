// public/assets/js/auth.js
import { apiFetch, setToken, clearToken, getToken } from "./api.js";

export async function login(username, password) {
  const out = await apiFetch("/api/auth/login", {
    method: "POST",
    body: { username, password },
    headers: { "content-type": "application/json" },
  });

  if (out?.token) setToken(out.token);
  return out?.user || null;
}

export async function me() {
  const t = getToken();
  if (!t) return null;
  try {
    const out = await apiFetch("/api/auth/me", { method: "GET" });
    return out?.user || out?.me || out || null;
  } catch {
    clearToken();
    return null;
  }
}

export async function logout() {
  clearToken();
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {}
}
