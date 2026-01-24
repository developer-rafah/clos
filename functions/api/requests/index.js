import { ok, badRequest, serverError } from "../../_lib/response.js";
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

// GET /api/requests
// filters: status, q, area_code, limit, offset, select
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env, { roles: ["agent", "staff", "admin"] });
  if (auth.errorResponse) return auth.errorResponse;
  const user = auth.user;

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
  if (user.role === "agent") {
    query.push(`agent_username=eq.${encodeURIComponent(user.username)}`);
  } else if (user.role === "staff") {
    const ac = area_code || user.area_code;
    if (!ac) return badRequest("Missing area_code for staff user (token must include area_code)");
    query.push(`area_code=eq.${encodeURIComponent(ac)}`);
  } else if (user.role !== "admin") {
    return badRequest("Invalid role");
  }

  // extra filters
  if (status) query.push(`status=eq.${encodeURIComponent(status)}`);

  if (q) {
    // بحث في donor_name أو phone (حسب الموجود في مشروعك)
    const safe = q.replace(/[%]/g, "\\%").replace(/_/g, "\\_");
    query.push(
      `or=(${encodeURIComponent(`donor_name.ilike.*${safe}*,phone.ilike.*${safe}*`)})`
    );
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
    role: user.role,
  });
}
