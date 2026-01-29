// auth.js
import { apiGet, apiPost, clearToken, setToken } from "./api.js";

export async function login(username, password) {
  const out = await apiPost(
    "/api/auth/login",
    { username, password },
    { auth: false }
  );

  if (out?.token) setToken(out.token);
  return out?.user || null;
}

export async function me() {
  const out = await apiGet("/api/auth/me");
  return out?.user || null;
}

export function logout() {
  clearToken();
}
