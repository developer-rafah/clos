// functions/api/auth/me.js - FULL
import { json, requireUser } from "../_shared.js";

export async function onRequestGet(ctx) {
  try {
    const { request, env } = ctx;
    const u = await requireUser(request, env);
    return json({
      ok: true,
      success: true,
      user: {
        username: u.username,
        name: u.name,
        role: u.roleLabel,
        roleKey: u.roleKey,
        area_code: u.area_code,
      },
    });
  } catch (e) {
    return json({ ok: false, success: false, error: "Unauthorized" }, 401);
  }
}
