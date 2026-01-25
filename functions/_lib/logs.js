import { sbFetch } from "./supabase.js";

export async function insertLog(env, row) {
  try {
    const payload = {
      username: row.username || null,
      role: row.role || null,
      action: row.action || null,
      request_id: row.request_id || null,
      old_status: row.old_status || null,
      new_status: row.new_status || null,
      agent_name: row.agent_name || null,
      weight: row.weight ?? null,
      source: row.source || "WEB_APP",
      details: row.details || null,
      before_json: row.before_json ?? null,
      after_json: row.after_json ?? null,
      meta_json: row.meta_json ?? null,
    };
    await sbFetch(env, `/rest/v1/logs`, { method: "POST", body: payload });
  } catch (e) {
    // لا نكسر الـ API لو فشل log
    console.log("insertLog failed:", e?.message || e);
  }
}
