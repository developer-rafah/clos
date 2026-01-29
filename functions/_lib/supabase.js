// functions/_lib/supabase.js
function sbHeaders(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_KEY;
  if (!env.SUPABASE_URL || !key) throw new Error("Supabase env missing");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function sbSelect(env, table, query, { count = false } = {}) {
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const url = `${base}/rest/v1/${table}?${query}`;
  const headers = { ...sbHeaders(env) };
  if (count) headers.Prefer = "count=exact";

  const res = await fetch(url, { headers });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || res.statusText);

  const data = txt ? JSON.parse(txt) : [];
  let total = null;
  const range = res.headers.get("content-range");
  if (range && range.includes("/")) {
    total = Number(range.split("/").pop());
    if (Number.isNaN(total)) total = null;
  }
  return { data, total };
}

export async function sbPatch(env, table, idField, idValue, patch) {
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const url = `${base}/rest/v1/${table}?${encodeURIComponent(idField)}=eq.${encodeURIComponent(idValue)}`;
  const headers = { ...sbHeaders(env), Prefer: "return=representation" };

  const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(patch) });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || res.statusText);
  return txt ? JSON.parse(txt) : [];
}
