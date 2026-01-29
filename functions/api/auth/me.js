// functions/api/auth/me.js
import { ok, fail } from "../../_lib/response.js";
import { requireAuth } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  try {
    const u = await requireAuth(request, env);
    return ok({
      user: { username: u.username, role: u.role, name: u.name || u.username, area_code: u.area_code ?? null },
      role: u.role,
    });
  } catch (e) {
    return fail(401, "Unauthorized");
  }
}
