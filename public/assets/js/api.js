// api.js
import { CONFIG } from "./app-config.js";

function getToken() {
  return localStorage.getItem(CONFIG.TOKEN_KEY) || "";
}

async function safeReadText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export async function request(path, options = {}) {
  const url = path.startsWith("http") ? path : `${CONFIG.API_BASE}${path}`;
  const token = getToken();

  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  // لا نضيف Authorization إذا لم يوجد توكن (لـ login)
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...options, headers });

  const txt = await safeReadText(res);
  let data = null;
  try {
    data = txt ? JSON.parse(txt) : null;
  } catch {
    data = { ok: false, success: false, error: txt || res.statusText };
  }

  if (!res.ok || (data && data.ok === false)) {
    const msg =
      (data && (data.error || data.message)) ||
      `${res.status} ${res.statusText}` ||
      "Request failed";
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data;
}

export const api = {
  get: (p) => request(p, { method: "GET" }),
  post: (p, body) => request(p, { method: "POST", body: JSON.stringify(body) }),
  patch: (p, body) => request(p, { method: "PATCH", body: JSON.stringify(body) }),
};
