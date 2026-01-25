import { json, badRequest, forbidden, serverError } from "../../_lib/response.js";
import { requireAuth } from "../../_lib/auth.js";
import { sbFetch } from "../../_lib/supabase.js";

export async function onRequestGet({ request, env, params }) {
  try {
    const { user, errorResponse } = await requireAuth(request, env);
    if (errorResponse) return errorResponse;

    const id = String(params?.id || "").trim();
    if (!id) return badRequest("Missing id");

    const rows = await sbFetch(
      env,
      `/rest/v1/requests?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
      { method: "GET" }
    );

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return json({ ok: false, success: false, error: "Not found" }, { status: 404 });

    // صلاحية: المندوب لا يرى إلا طلبه
    if (user.role === "مندوب" && String(row.agent_username || "") !== user.username) {
      return forbidden("ليس لديك صلاحية لعرض هذا الطلب");
    }

    // الموظف: يمكنه رؤية الجديد عادة (نتركه مفتوح)
    return json({ ok: true, success: true, data: row });
  } catch (e) {
    return serverError(e);
  }
}

