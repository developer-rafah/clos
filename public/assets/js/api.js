// api.js
const TOKEN_KEY = "CLOS_TOKEN_V1";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token || "");
  } catch {}
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

function toQuery(params = {}) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export async function apiFetch(path, opts = {}) {
  const {
    method = "GET",
    body,
    auth = true,
    headers = {},
    query,
    signal,
  } = opts;

  const url = `${path}${query ? toQuery(query) : ""}`;

  const h = new Headers(headers);
  h.set("Accept", "application/json");

  if (body !== undefined) h.set("Content-Type", "application/json");

  if (auth) {
    const t = getToken();
    if (t) h.set("Authorization", `Bearer ${t}`);
  }

  const res = await fetch(url, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    credentials: "same-origin",
    cache: "no-store",
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");

  if (!res.ok) {
    const msg =
      (payload && typeof payload === "object" && (payload.error || payload.message)) ||
      (typeof payload === "string" && payload) ||
      `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

export const apiGet = (path, opts) => apiFetch(path, { ...(opts || {}), method: "GET" });
export const apiPost = (path, body, opts) => apiFetch(path, { ...(opts || {}), method: "POST", body });
export const apiPatch = (path, body, opts) => apiFetch(path, { ...(opts || {}), method: "PATCH", body });
export const apiDelete = (path, opts) => apiFetch(path, { ...(opts || {}), method: "DELETE" });
