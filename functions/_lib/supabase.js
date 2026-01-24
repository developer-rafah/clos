import { serverError } from "./response.js";

function must(env, key) {
  const v = String(env[key] || "").trim();
  if (!v) throw new Error(`Missing env.${key}`);
  return v;
}

export async function sbFetch(env, path, init = {}) {
  const SUPABASE_URL = must(env, "SUPABASE_URL");
  const SERVICE_KEY = must(env, "SUPABASE_SERVICE_ROLE_KEY");

  const url = `${SUPABASE_URL}${path}`;
  const headers = new Headers(init.headers || {});
  headers.set("apikey", SERVICE_KEY);
  headers.set("authorization", `Bearer ${SERVICE_KEY}`);
  headers.set("cache-control", "no-store");

  const res = await fetch(url, { ...init, headers });
  const text = await res.text().catch(() => "");
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { res, data, text };
}

export async function getUserByUsername(env, username) {
  const u = encodeURIComponent(String(username || "").trim());
  const path = `/rest/v1/users?select=*&username=eq.${u}&limit=1`;

  const { res, data } = await sbFetch(env, path, { method: "GET" });
  if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return Array.isArray(data) ? data[0] : null;
}

export function envProblem(e) {
  return serverError(e?.message || String(e));
}
