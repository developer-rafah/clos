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

// ✅ هذه الدوال مطلوبة لأن api/push/register.js و api/push/send.js يستوردونها

export async function upsertPushToken(env, tokenRow) {
  // tokenRow مثال متوقع:
  // { username, endpoint, p256dh, auth, platform, area_code, updated_at }
  // نخزّنها بجدول push_tokens (لازم يكون موجود)
  const row = tokenRow || {};
  const endpoint = String(row.endpoint || "").trim();
  if (!endpoint) throw new Error("upsertPushToken: missing endpoint");

  const payload = {
    endpoint,
    username: row.username ?? null,
    p256dh: row.p256dh ?? null,
    auth: row.auth ?? null,
    platform: row.platform ?? null,
    area_code: row.area_code ?? null,
    updated_at: new Date().toISOString(),
  };

  // نستخدم upsert عن طريق POST + Prefer: resolution=merge-duplicates
  const { res, data } = await sbFetch(env, `/rest/v1/push_tokens`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: payload,
  });

  if (!res.ok) {
    throw new Error("upsertPushToken supabase error: " + (typeof data === "string" ? data : JSON.stringify(data)));
  }

  return Array.isArray(data) ? data[0] : data;
}

export async function listPushTokens(env, filters = {}) {
  // filters مثال:
  // { area_code, username, role }
  const qs = new URLSearchParams();
  qs.set("select", "endpoint,username,p256dh,auth,platform,area_code,updated_at");

  const area = String(filters.area_code || "").trim();
  const user = String(filters.username || "").trim();

  if (area) qs.set("area_code", `eq.${area}`);
  if (user) qs.set("username", `eq.${user}`);

  // أحدث أولًا
  qs.set("order", "updated_at.desc");

  const { res, data } = await sbFetch(env, `/rest/v1/push_tokens?${qs.toString()}`, {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error("listPushTokens supabase error: " + (typeof data === "string" ? data : JSON.stringify(data)));
  }

  return Array.isArray(data) ? data : [];
}
