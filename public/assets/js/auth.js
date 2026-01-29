// auth.js
import { api } from "./api.js";
import { CONFIG } from "./app-config.js";

export function setToken(token) {
  if (token) localStorage.setItem(CONFIG.TOKEN_KEY, token);
  else localStorage.removeItem(CONFIG.TOKEN_KEY);
}

export function getToken() {
  return localStorage.getItem(CONFIG.TOKEN_KEY) || "";
}

export async function login(username, password) {
  const out = await api.post("/auth/login", { username, password });
  if (out?.token) setToken(out.token);
  return out; // { ok, user, token, role }
}

export async function me() {
  return await api.get("/auth/me"); // { ok, user, role }
}

export function logout() {
  setToken("");
}
