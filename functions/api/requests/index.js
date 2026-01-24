import { json, badRequest, serverError } from "../../_lib/response.js";
import { requireAuth } from "../../_lib/auth.js";
import { sbFetch } from "../../_lib/supabase.js";

function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, v);
  }
  return sp.toString();
}

/**
 * GET /api/requests
 * Query:
 *  - limit (default 30, max 200)
 *  - offset (default 0)
 *  - status (optional)
 *  - q (optional: بحث بالاسم/الهاتف)
 */
export async function onRequestGet({ request, env }) {
  try {
    const { user, errorResponse } = await requireAuth(request, env);
    if (errorResponse) return errorResponse;

    const url = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "30", 10), 1), 200);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);
    const status = String(url.searchParams.get("status") || "").trim();
    const q = String(url.searchParams.get("q") || "").trim();

    // تحديد الفلاتر حسب الدور
    // الأدوار عندك: "مدير" / "موظف" / "مندوب"
    const role = user.role;

    // select
    const columns = [
      "id",
      "customer_name",
      "phone",
      "district",
      "lat",
      "lng",
      "status",
      "agent_name",
      "agent_username",
      "weight",
      "created_at",
      "assigned_at",
      "closed_at",
      "cancelled_at",
      "cancel_reason",
      "source",
      "notes",
      "updated_at",
    ].join(",");

    // base filters
    const filters = [];

    // status filter (اختياري)
    if (status) {
      filters.push(`status=eq.${encodeURIComponent(status)}`);
    }

    // q filter بسيط (إما phone أو customer_name)
    // PostgREST OR: or=(customer_name.ilike.*x*,phone.ilike.*x*)
    if (q) {
      const qEsc = q.replace(/\*/g, ""); // حماية
      filters.push(`or=(${[
        `customer_name.ilike.*${encodeURIComponent(qEsc)}*`,
        `phone.ilike.*${encodeURIComponent(qEsc)}*`,
        `id.ilike.*${encodeURIComponent(qEsc)}*`,
      ].join(",")})`);
    }

    // role filters
    if (role === "مندوب") {
      // يرى طلباته فقط
      filters.push(`agent_username=eq.${encodeURIComponent(user.username)}`);
    } else if (role === "موظف") {
      // الافتراضي: يعرض "جديد" فقط إن لم يحدد status
      if (!status) {
        filters.push(`status=eq.${encodeURIComponent("جديد")}`);
      }
    } else if (role === "مدير") {
      // كل شيء
    } else {
      return badRequest("Unknown role: " + role);
    }

    // pagination + ordering
    const query = [
      `select=${encodeURIComponent(columns)}`,
      ...filters,
      `order=created_at.desc`,
      `limit=${limit}`,
      `offset=${offset}`,
    ].join("&");

    const data = await sbFetch(env, `/rest/v1/requests?${query}`, { method: "GET" });

    return json({
      ok: true,
      success: true,
      role,
      pagination: { limit, offset, returned: Array.isArray(data) ? data.length : 0 },
      data: data || [],
    });
  } catch (e) {
    return serverError(e);
  }
}
