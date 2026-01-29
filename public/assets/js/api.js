// api.js - FULL
import { getToken, clearToken } from "./auth.js";

async function parseBody(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    try { return await res.json(); } catch { return null; }
  }
  try { return await res.text(); } catch { return null; }
}

async function request(method, url, { body, auth = true, headers = {} } = {}) {
  const h = { Accept: "application/json", ...headers };
  if (body !== undefined) h["Content-Type"] = "application/json";
  if (auth) {
    const t = getToken();
    if (t) h["Authorization"] = `Bearer ${t}`;
  }

  const res = await fetch(url, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await parseBody(res);

  if (!res.ok) {
    const msg = (data && data.error) || (typeof data === "string" ? data : `HTTP ${res.status}`);
    if (res.status === 401) clearToken();
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  get: (url, opts) => request("GET", url, opts),
  post: (url, body, opts) => request("POST", url, { ...opts, body }),
  patch: (url, body, opts) => request("PATCH", url, { ...opts, body }),
  del: (url, opts) => request("DELETE", url, opts),
};
