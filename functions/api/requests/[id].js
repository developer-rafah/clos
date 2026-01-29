// functions/api/requests/[id].js - FULL
import { json, sbFetch, sbHeaders, requireUser } from "../_shared.js";

function enc(v) {
  return encodeURIComponent(String(v));
}

export async function onRequestPatch(ctx) {
  try {
    const { request, env, params } = ctx;
    const me = await requireUser(request, env);
    const id = params.id;
    if (!id) return json({ ok: false, success: false, error: "Missing id" }, 400);

    const body = await request.json().catch(() => ({}));
    const patch = {};

    // staff/admin يستطيعون الإسناد + تغيير status
    if (me.roleKey === "admin" || me.roleKey === "staff") {
      if (body.agent_name !== undefined) patch.agent_name = String(body.agent_name || "").trim() || null;
      if (body.status !== undefined) patch.status = String(body.status || "").trim() || null;
      if (body.assigned_at !== undefined) patch.assigned_at = body.assigned_at || null;
    }

    // agent يستطيع حفظ الوزن + إغلاق طلبه فقط
    if (me.roleKey === "agent") {
      if (body.weight !== undefined) patch.weight = body.weight;
      if (body.status !== undefined) patch.status = String(body.status || "").trim() || null;
      if (body.closed_at !== undefined) patch.closed_at = body.closed_at || null;
    }

    if (body.updated_at !== undefined) patch.updated_at = body.updated_at || null;

    // لا تحديثات؟
    if (!Object.keys(patch).length) return json({ ok: false, success: false, error: "No updates" }, 400);

    const url = `/rest/v1/requests?id=eq.${enc(id)}`;
    const res = await sbFetch(env, url, {
      method: "PATCH",
      headers: sbHeaders(env, { Prefer: "return=representation" }),
      body: JSON.stringify(patch),
    });

    const out = await res.json();
    return json({ ok: true, success: true, item: out?.[0] || null });
  } catch (e) {
    const msg = e?.message || "Server error";
    const code = msg === "Unauthorized" ? 401 : 500;
    return json({ ok: false, success: false, error: msg }, code);
  }
}
