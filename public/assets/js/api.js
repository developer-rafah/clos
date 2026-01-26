// public/assets/js/api.js

const TOKEN_KEY = "CLOS_TOKEN_V1";

export function getToken() {
  try {
    return String(localStorage.getItem(TOKEN_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, String(token || "").trim());
  } catch {}
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export async function apiFetch(path, { method = "GET", body, headers = {} } = {}) {
  const token = getToken();
  const h = { ...headers };

  // JSON افتراضي
  if (!h["content-type"] && !(body instanceof FormData)) {
    h["content-type"] = "application/json";
  }

  if (token) h.authorization = "Bearer " + token;

  const res = await fetch(path, {
    method,
    cache: "no-store",
    headers: h,
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });

  const txt = await res.text().catch(() => "");
  let data = {};
  try {
    data = txt ? JSON.parse(txt) : {};
  } catch {
    data = { raw: txt };
  }

  if (!res.ok || data?.ok === false || data?.success === false) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const apiGet = (p) => apiFetch(p, { method: "GET" });
export const apiPost = (p, b) => apiFetch(p, { method: "POST", body: b });
export const apiPatch = (p, b) => apiFetch(p, { method: "PATCH", body: b });
