function normalizeBase(url) {
  return String(url || "").trim().replace(/\/+$/g, "");
}

export function sbConfig(env) {
  const url = normalizeBase(env.SUPABASE_URL);
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return { url, key };
}

/**
 * يدعم شكلين:
 * 1) sbFetch(env, "/rest/v1/requests?select=*", { method:"GET" })
 * 2) sbFetch(env, { table:"requests", query:"select=*", method:"GET", body:null, prefer:"return=representation" })
 */
export async function sbFetch(env, arg1, arg2 = {}) {
  const { url, key } = sbConfig(env);

  let path = "";
  let method = "GET";
  let headers = {};
  let body = undefined;
  let prefer = "return=representation";

  if (typeof arg1 === "string") {
    path = arg1;
    method = String(arg2.method || "GET").toUpperCase();
    headers = arg2.headers || {};
    body = arg2.body;
  } else {
    const p = arg1 || {};
    method = String(p.method || "GET").toUpperCase();
    headers = p.headers || {};
    body = p.body;
    prefer = p.prefer || prefer;

    const table = String(p.table || "").trim();
    const query = String(p.query || "").trim();
    if (!table) throw new Error("sbFetch: Missing table");

    path = `/rest/v1/${table}${query ? (query.startsWith("?") ? query : `?${query}`) : ""}`;
  }

  const fullUrl = `${url}${path}`;

  const finalHeaders = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "content-type": "application/json",
    Prefer: prefer,
    ...headers,
  };

  const res = await fetch(fullUrl, {
    method,
    headers: finalHeaders,
    body: body == null ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = typeof data === "string" ? data : JSON.stringify(data);
    const err = new Error(`Supabase error (${res.status}): ${msg}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function getUserByUsername(env, username) {
  const u = String(username || "").trim();
  const rows = await sbFetch(env, {
    method: "GET",
    table: "users",
    query: `select=username,password,role,full_name,active&username=eq.${encodeURIComponent(u)}&limit=1`,
    prefer: "return=representation",
  });
  return Array.isArray(rows) ? rows[0] || null : null;
}
