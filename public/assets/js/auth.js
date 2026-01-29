// auth.js - FULL
import { api } from "./api.js";

const KEY = "CLOS_TOKEN_V1";

export function getToken() {
  return localStorage.getItem(KEY) || "";
}

export function setToken(t) {
  localStorage.setItem(KEY, t);
}

export function clearToken() {
  localStorage.removeItem(KEY);
}

export async function login(username, password) {
  const out = await api.post("/api/auth/login", { username, password }, { auth: false });
  if (out?.token) setToken(out.token);
  return out;
}

export async function me() {
  return await api.get("/api/auth/me");
}

export function logout() {
  clearToken();
}
