import { json, badRequest, serverError } from "../../../_lib/response.js";
import { requireAuth } from "../../../_lib/auth.js";
import { sbFetch } from "../../../_lib/supabase.js";
import { insertLog } from "../../../_lib/logs.js";

export async function onRequestPost({ request, env, params }) {
  try {
    const { user, errorResponse } = await requireAuth(request, env, { roles: ["موظف", "مدير"] });
    if (errorResponse) return errorResponse;

    const id = String(params?.id || "").trim();
    if (!id) return badRequest("Missing id");

    const body = await request.json().catch(() => ({}));
    const agent_username = String(body.agent_username || "").trim();
    const agent_name = String(body.agent_name || "").trim();

    if (!agent_username) return badRequest("agent_username is required");

    // اقرأ القديم
    const oldRows = await sbFetch(env, `/rest/v1/requests?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
    const oldRow = Array.isArray(oldRows) ? oldRows[0] : null;
    if (!oldRow) return json({ ok: false, success: false, error: "Not found" }, { status: 404 });

    const nowIso = new Date().toISOString();

    // تحديث الطلب
    const updated = await sbFetch(
      env,
      `/rest/v1/requests?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: {
          agent_username,
          agent_name: agent_name || oldRow.agent_name || null,
          assigned_at: nowIso,
          status: "مسند",
          updated_at: nowIso,
        },
      }
    );

    const newRow = Array.isArray(updated) ? updated[0] : null;

    // Log
    await insertLog(env, {
      username: user.username,
      role: user.role,
      action: "ASSIGN",
      request_id: id,
      old_status: oldRow.status || null,
      new_status: "مسند",
      agent_name: agent_name || null,
      source: "WEB_APP",
      before_json: oldRow,
      after_json: newRow || null,
      details: `assigned to ${agent_username}`,
    });

    return json({ ok: true, success: true, data: newRow || updated });
  } catch (e) {
    return serverError(e);
  }
}
