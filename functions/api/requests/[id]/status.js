import { json, badRequest, forbidden, serverError } from "../../../_lib/response.js";
import { requireAuth } from "../../../_lib/auth.js";
import { sbFetch } from "../../../_lib/supabase.js";
import { insertLog } from "../../../_lib/logs.js";

export async function onRequestPost({ request, env, params }) {
  try {
    const { user, errorResponse } = await requireAuth(request, env, { roles: ["مندوب", "مدير"] });
    if (errorResponse) return errorResponse;

    const id = String(params?.id || "").trim();
    if (!id) return badRequest("Missing id");

    const body = await request.json().catch(() => ({}));
    const new_status = String(body.status || "").trim();
    const cancel_reason = String(body.cancel_reason || "").trim();

    if (!new_status) return badRequest("status is required");

    // اقرأ القديم
    const oldRows = await sbFetch(env, `/rest/v1/requests?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
    const oldRow = Array.isArray(oldRows) ? oldRows[0] : null;
    if (!oldRow) return json({ ok: false, success: false, error: "Not found" }, { status: 404 });

    // المندوب لا يغير إلا طلبه
    if (user.role === "مندوب" && String(oldRow.agent_username || "") !== user.username) {
      return forbidden("لا يمكنك تعديل طلب غير مسند لك");
    }

    const nowIso = new Date().toISOString();

    const patch = {
      status: new_status,
      updated_at: nowIso,
    };

    // حالات خاصة
    if (new_status === "مغلق" || new_status === "مكتمل") patch.closed_at = nowIso;
    if (new_status === "ملغي") {
      patch.cancelled_at = nowIso;
      patch.cancel_reason = cancel_reason || null;
    }

    const updated = await sbFetch(
      env,
      `/rest/v1/requests?id=eq.${encodeURIComponent(id)}`,
      { method: "PATCH", body: patch }
    );

    const newRow = Array.isArray(updated) ? updated[0] : null;

    await insertLog(env, {
      username: user.username,
      role: user.role,
      action: "STATUS_CHANGE",
      request_id: id,
      old_status: oldRow.status || null,
      new_status: new_status,
      agent_name: oldRow.agent_name || null,
      source: "WEB_APP",
      before_json: oldRow,
      after_json: newRow || null,
      details: cancel_reason ? `cancel_reason=${cancel_reason}` : null,
    });

    return json({ ok: true, success: true, data: newRow || updated });
  } catch (e) {
    return serverError(e);
  }
}
