export function sbConfig(env) {
  const url = String(env.SUPABASE_URL || "").trim().replace(/\/+$/g, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return { url, key };
}

export async function sbFetch(env, { method, table, query = "", body = null, prefer = "return=representation" }) {
  const { url, key } = sbConfig(env);
  const endpoint = `${url}/rest/v1/${table}${query ? `?${query}` : ""}`;

  const res = await fetch(endpoint, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
      Prefer: prefer,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase error (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

export async function getUserByUsername(env, username) {
  const rows = await sbFetch(env, {
    method: "GET",
    table: "users",
    query: `select=username,password,role,full_name,active&username=eq.${encodeURIComponent(username)}`,
    prefer: "return=representation",
  });
  return rows?.[0] || null;
}

export async function upsertPushToken(env, row) {
  // يعتمد على وجود unique index على fcm_token (موصى به)
  // إذا غير موجود، سيتم إدخال مكرر. (يمكن حلها لاحقًا بإنشاء unique index)
  return sbFetch(env, {
    method: "POST",
    table: "push_tokens",
    query: `on_conflict=fcm_token`,
    body: row,
    prefer: "resolution=merge-duplicates,return=representation",
  });
}

export async function listPushTokens(env, { role = "", enabledOnly = true } = {}) {
  let q = `select=fcm_token,username,role,platform,device_id,enabled,last_seen_at`;
  if (enabledOnly) q += `&enabled=eq.true`;
  if (role) q += `&role=eq.${encodeURIComponent(role)}`;
  const rows = await sbFetch(env, { method: "GET", table: "push_tokens", query: q });
  return rows || [];
}
