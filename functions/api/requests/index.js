import { ok, badRequest, serverError, forbidden } from "../../_lib/response.js";
import { requireAuth } from "../../_lib/auth.js";
import { sbFetch } from "../../_lib/supabase.js";

function parseIntSafe(v, def) {
  const n = parseInt(String(v || ""), 10);
  return Number.isFinite(n) ? n : def;
}

function parseCount(contentRange) {
  // مثال: "0-9/123"
  const m = String(contentRange || "").match(/\/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * ✅ تطبيع الأدوار:
 * - يدعم العربي/الإنجليزي ويحوّلها لقيم ثابتة: agent | staff | admin
 */
function normalizeRole(roleRaw) {
  const r = String(roleRaw || "").trim().toLowerCase();

  // English
  if (r === "admin") return "admin";
  if (r === "staff") return "staff";
  if (r === "agent") return "agent";

  // Arabic common
  if (roleRaw === "مشرف" || roleRaw === "مدير") return "admin";
  if (roleRaw === "موظف" || roleRaw === "ستاف") return "staff";
  if (roleRaw === "مندوب") return "agent";

  return r; // fallback
}

// GET /api/requests
// filters: status, q, area_code, limit, offset, select
export async function onRequestGet({ request, env }) {
  // ✅ لا تقيّد roles هنا بالقيم الإنجليزية فقط
  // نسمح بالمندوب/الموظف/المشرف أيضًا، ثم نطبّع الدور
  const auth = await requireAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const user = auth.user;
  const role = normalizeRole(user.role);

  // ✅ تحقق صلاحية الوصول
  if (!["agent", "staff", "admin"].includes(role)) {
    // Forbidden أدق من badRequest هنا
    return forbidden("Forbidden");
  }

  const url = new URL(request.url);

  const limit = Math.min(parseIntSafe(url.searchParams.get("limit"), 50), 200);
  const offset = Math.max(parseIntSafe(url.searchParams.get("offset"), 0), 0);

  const status = (url.searchParams.get("status") || "").trim();
  const q = (url.searchParams.get("q") || "").trim();
  const area_code = (url.searchParams.get("area_code") || "").trim();
  const select = (url.searchParams.get("select") || "*").trim();

  const query = [];
  query.push(`select=${encodeURIComponent(select)}`);
  query.push(`order=created_at.desc`);
  query.push(`limit=${limit}`);
  query.push(`offset=${offset}`);

  // role filters
  if (role === "agent") {
    query.push(`agent_username=eq.${encodeURIComponent(user.username)}`);
  } else if (role === "staff") {
    const ac = area_code || user.area_code;
    if (!ac) return badRequest("Missing area_code for staff user (token must include area_code)");
    query.push(`area_code=eq.${encodeURIComponent(ac)}`);
  } else if (role !== "admin") {
    return forbidden("Forbidden");
  }

  // extra filters
  if (status) query.push(`status=eq.${encodeURIComponent(status)}`);

  if (q) {
    // بحث في donor_name أو phone (حسب الموجود في مشروعك)
    const safe = q.replace(/[%]/g, "\\%").replace(/_/g, "\\_");
    query.push(`or=(${encodeURIComponent(`donor_name.ilike.*${safe}*,phone.ilike.*${safe}*`)})`);
  }

  const path = `/rest/v1/requests?${query.join("&")}`;

  let out;
  try {
    out = await sbFetch(env, path, {
      method: "GET",
      headers: {
        Prefer: "count=exact",
      },
    });
  } catch (e) {
    return serverError(e?.message || String(e));
  }

  if (!out.res.ok) {
    return serverError("Supabase error", { details: out.data });
  }

  const count = parseCount(out.res.headers.get("content-range"));
  return ok({
    items: Array.isArray(out.data) ? out.data : [],
    pagination: { limit, offset, count },
    role, // ✅ الدور بعد التطبيع
  });
}
