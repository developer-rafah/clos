import { ok, fail } from "../_lib/response.js";
import { requireAuth } from "../_lib/auth.js";

/**
 * Supabase REST helper (بدون الاعتماد على مكتبات إضافية)
 */
function pickSupabase(env) {
  const url =
    String(env.SUPABASE_URL || env.SUPABASE_REST_URL || "").trim();

  const key =
    String(
      env.SUPABASE_SERVICE_ROLE_KEY ||
      env.SUPABASE_SERVICE_KEY ||
      env.SUPABASE_KEY ||
      env.SUPABASE_ANON_KEY ||
      ""
    ).trim();

  return { url, key };
}

function getCountFromContentRange(cr) {
  // مثال: "0-49/123"
  if (!cr) return null;
  const m = String(cr).match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

function normRole(r) {
  const s = String(r || "").trim().toLowerCase();
  if (s === "مدير" || s === "admin") return "admin";
  if (s === "موظف" || s === "staff") return "staff";
  if (s === "مندوب" || s === "agent") return "agent";
  return s || "agent";
}

function buildOrForAgent(username) {
  // جرّب أشهر الأعمدة المحتملة
  const u = String(username || "").trim();
  const parts = [
    `agent_username.eq.${u}`,
    `assigned_to.eq.${u}`,
    `assigned_username.eq.${u}`,
    `agent.eq.${u}`,
    `username.eq.${u}`,
  ];
  return `(${parts.join(",")})`;
}

async function supaGet(env, table, urlObj) {
  const { url, key } = pickSupabase(env);
  if (!url || !key) return { error: "Missing SUPABASE_URL or SUPABASE key" };

  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/${table}${urlObj.search}`;

  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      accept: "application/json",
      prefer: "count=exact",
    },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { error: data?.message || data?.hint || `Supabase HTTP ${res.status}`, status: res.status, data };
  }

  const count = getCountFromContentRange(res.headers.get("content-range"));
  return { data: Array.isArray(data) ? data : [], count: count ?? null };
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const user = auth.user || {};
  const role = normRole(user.role);

  const u = new URL(request.url);
  const limit = Math.min(Math.max(Number(u.searchParams.get("limit") || 50), 1), 200);
  const offset = Math.max(Number(u.searchParams.get("offset") || 0), 0);
  const debug = u.searchParams.get("debug") === "1";

  const table = String(env.REQUESTS_TABLE || "requests").trim();

  // فلترة اختيارية من العميل (لو حبيت لاحقاً)
  const qStatus = String(u.searchParams.get("status") || "").trim();
  const qArea = String(u.searchParams.get("area_code") || "").trim();

  // ✅ source of truth للربط
  const username = String(user.username || "").trim();
  const area_code = qArea || (user.area_code ? String(user.area_code).trim() : "");

  // base query
  const base = new URLSearchParams();
  base.set("select", "*");
  base.set("limit", String(limit));
  base.set("offset", String(offset));
  // لو عندك created_at
  base.set("order", "created_at.desc");

  if (qStatus) {
    // لو عندك عمود status
    base.set("status", `eq.${qStatus}`);
  }

  // ✅ Admin: يرجع كل شيء
  if (role === "admin") {
    const urlObj = new URL("http://x/"); // placeholder
    urlObj.search = "?" + base.toString();

    const r = await supaGet(env, table, urlObj);
    if (r.error) return fail(r.error, r.status || 500);

    return ok({
      items: r.data,
      pagination: { limit, offset, count: r.count ?? r.data.length },
      role,
      ...(debug ? { debug: { role, username, area_code, status: qStatus } } : {}),
    });
  }

  // ✅ Agent: (assigned_to = username) OR (area_code match + unassigned)
  if (role === "agent") {
    if (!username) return fail("Missing username in token", 400);

    // 1) assigned to me
    const urlAssigned = new URL("http://x/");
    const p1 = new URLSearchParams(base);
    p1.set("or", buildOrForAgent(username));
    urlAssigned.search = "?" + p1.toString();

    const assigned = await supaGet(env, table, urlAssigned);
    if (assigned.error) return fail(assigned.error, assigned.status || 500);

    let items = assigned.data;

    // 2) fallback: unassigned within area_code
    if (area_code) {
      const urlUnassigned = new URL("http://x/");
      const p2 = new URLSearchParams(base);

      // عدّل أسماء الأعمدة حسب جدولك:
      p2.set("area_code", `eq.${area_code}`);
      // نفترض assigned_to موجود
      p2.set("assigned_to", "is.null");

      urlUnassigned.search = "?" + p2.toString();

      const unassigned = await supaGet(env, table, urlUnassigned);
      if (!unassigned.error) {
        // دمج بدون تكرار
        const seen = new Set(items.map((x) => String(x.id || x.code || JSON.stringify(x))));
        for (const it of unassigned.data) {
          const key = String(it.id || it.code || JSON.stringify(it));
          if (!seen.has(key)) items.push(it);
        }
      }
    }

    return ok({
      items,
      pagination: { limit, offset, count: items.length },
      role,
      ...(debug ? { debug: { role, username, area_code, status: qStatus } } : {}),
    });
  }

  // ✅ Staff: فلترة بالمنطقة إذا موجودة
  if (role === "staff") {
    const urlObj = new URL("http://x/");
    const p = new URLSearchParams(base);

    if (area_code) p.set("area_code", `eq.${area_code}`);

    urlObj.search = "?" + p.toString();

    const r = await supaGet(env, table, urlObj);
    if (r.error) return fail(r.error, r.status || 500);

    return ok({
      items: r.data,
      pagination: { limit, offset, count: r.count ?? r.data.length },
      role,
      ...(debug ? { debug: { role, username, area_code, status: qStatus } } : {}),
    });
  }

  // fallback
  return ok({
    items: [],
    pagination: { limit, offset, count: 0 },
    role,
    ...(debug ? { debug: { role, username, area_code, status: qStatus } } : {}),
  });
}
