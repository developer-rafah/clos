// functions/api/requests.js
import { ok, fail } from "../_lib/response.js";
import { requireAuth } from "../_lib/auth.js";

function pickSupabase(env) {
  const url = String(env.SUPABASE_URL || "").trim();
  const key = String(
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_KEY ||
    env.SUPABASE_KEY ||
    env.SUPABASE_ANON_KEY ||
    ""
  ).trim();
  return { url, key };
}

function countFromContentRange(cr) {
  const m = String(cr || "").match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const user = auth.user || {};
  const role = String(user.role || "").trim();          // عندك بالعربي "مندوب"
  const username = String(user.username || "").trim();  // "radh"
  const name = String(user.name || "").trim();          // "فهد"

  const u = new URL(request.url);
  const limit = Math.min(Math.max(Number(u.searchParams.get("limit") || 50), 1), 200);
  const offset = Math.max(Number(u.searchParams.get("offset") || 0), 0);

  const { url: SB_URL, key: SB_KEY } = pickSupabase(env);
  if (!SB_URL || !SB_KEY) return fail("Missing SUPABASE_URL / SUPABASE_KEY", 500);

  const table = String(env.REQUESTS_TABLE || "requests").trim();

  const qs = new URLSearchParams();
  qs.set("select", "*");
  qs.set("order", "created_at.desc");
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));

  // ✅ فلترة المندوب (agent) — بياناتك تستخدم agent_name كثيرًا
  if (role === "مندوب" || String(role).toLowerCase() === "agent") {
    if (!username && !name) return fail("Missing username/name in token", 400);

    const orParts = [];
    if (username) {
      orParts.push(`agent_username.eq.${username}`);
      orParts.push(`agent_name.eq.${username}`);
    }
    if (name) orParts.push(`agent_name.eq.${name}`);

    qs.set("or", `(${orParts.join(",")})`);
  }

  const endpoint = `${SB_URL.replace(/\/$/, "")}/rest/v1/${table}?${qs.toString()}`;

  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      apikey: SB_KEY,
      authorization: `Bearer ${SB_KEY}`,
      accept: "application/json",
      prefer: "count=exact",
    },
  });

  const data = await res.json().catch(() => []);
  if (!res.ok) return fail(data?.message || data?.hint || `Supabase HTTP ${res.status}`, res.status);

  const total = countFromContentRange(res.headers.get("content-range")) ??
                (Array.isArray(data) ? data.length : 0);

  return ok({
    ok: true,
    success: true,
    items: Array.isArray(data) ? data : [],
    pagination: { limit, offset, count: total },
    role: (role === "مندوب") ? "agent" : role,
  });
}
