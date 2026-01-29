// functions/api/auth/login.js
import { ok, fail } from "../../_lib/response.js";
import { signJwt } from "../../_lib/jwt.js";
import { sbSelect } from "../../_lib/supabase.js";
import { normalizeRole } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) return fail(400, "Missing username/password");

    // ✅ نقرأ password (ليس فقط password_hash)
    const { data } = await sbSelect(
      env,
      "users",
      `select=username,password,role,name,area_code&username=eq.${encodeURIComponent(username)}`
    );

    const user = data?.[0];
    if (!user) return fail(401, "Unauthorized");

    const dbPass = String(user.password || "");
    if (dbPass !== password) return fail(401, "Unauthorized");

    const role = normalizeRole(user.role);
    const token = await signJwt(
      {
        username: user.username,
        role,
        name: user.name || user.username,
        area_code: user.area_code ?? null,
      },
      env.JWT_SECRET
    );

    return ok({
      user: { username: user.username, role, name: user.name || user.username, area_code: user.area_code ?? null },
      role,
      token,
    });
  } catch (e) {
    return fail(e.message === "Unauthorized" ? 401 : 500, e.message || "Error");
  }
}
