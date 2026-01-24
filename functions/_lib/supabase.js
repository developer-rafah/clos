import { serverError } from "./response.js";

function normalizeUrl(u) {
  return String(u || "").replace(/\/+$/, "");
}

export function sbHeaders(env) {
  const url = String(env.SUPABASE_URL || "").trim();
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  return { url: normalizeUrl(url), key };
}

export async function sbFetch(env, path, { method = "GET", headers = {}, body = null } = {}) {
  const { url, key } = sbHeaders(env);

  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
      Prefer: "return=representation",
      ...headers,
    },
    body: body ? JSON.stringify(body) : null,
  });

  const text = await res.text();
  const json = text ? safeJson(text) : null;

  if (!res.ok) {
    const err = new Error(`Supabase error (${res.status}): ${text}`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }

  return json;
}

function safeJson(txt) {
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}
