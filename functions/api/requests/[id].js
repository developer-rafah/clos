// functions/api/requests/[id].js
import { ok, fail } from "../../_lib/response.js";
import { requireAuth } from "../../_lib/auth.js";
import { sbSelect, sbPatch } from "../../_lib/supabase.js";

function enc(v) {
  return encodeURIComponent(String(v));
}

export async function onRequestPatch({ request, env, params }) {
  try {
    const user = await requireAuth(request, env);
    const id = params.id;

    const patch = await request.json();

    // اقرأ الطلب الحالي للتأكد من الصلاحيات
    const { data } = await sbSelect(env, "requests", `select=id,agent_name,status& id=eq.${enc(id)}`);
    const row = data?.[0];
    if (!row) return fail(404, "Not found");

    // مندوب: يسمح فقط على طلباته
    if (user.role === "agent") {
      const ag = row.agent_name || "";
      const okOwner = ag === user.username || ag === (user.name || "");
      if (!okOwner) return fail(403, "Forbidden");
    }

    // نظف patch
    const allowed = {};
    if (patch.weight != null) allowed.weight = Number(patch.weight || 0);
    if (patch.status != null) allowed.status = String(patch.status);
    if (patch.agent_name != null && (user.role === "staff" || user.role === "admin")) {
      allowed.agent_name = String(patch.agent_name || "");
      allowed.assigned_at = new Date().toISOString();
      if (!allowed.status) allowed.status = "مسند";
    }
    if (patch.closed_at != null) allowed.closed_at = String(patch.closed_at);

    const out = await sbPatch(env, "requests", "id", id, allowed);
    return ok({ item: out?.[0] || null });
  } catch (e) {
    return fail(e.message === "Unauthorized" ? 401 : 500, e.message || "Error");
  }
}
