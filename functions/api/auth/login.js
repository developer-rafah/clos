// functions/api/auth/login.js - FULL
import { json, sbFetch, sbHeaders, jwtSign, normalizeRole } from "../_shared.js";

export async function onRequestPost(ctx) {
  try {
    const { request, env } = ctx;
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();
    if (!username || !password) return json({ ok: false, success: false, error: "Missing credentials" }, 400);

    // users table: username, password, role, (optional) name, area_code
    const q = `/rest/v1/users?select=username,password,role,name,area_code&username=eq.${encodeURIComponent(username)}&limit=1`;
    const res = await sbFetch(env, q, { headers: sbHeaders(env), method: "GET" });
    const rows = await res.json();
    const user = rows?.[0];
    if (!user) return json({ ok: false, success: false, error: "Unauthorized" }, 401);
    if (String(user.password) !== password) return json({ ok: false, success: false, error: "Unauthorized" }, 401);

    const { roleKey, roleLabel } = normalizeRole(user.role);
    const payload = {
      sub: user.username,
      username: user.username,
      name: user.name || user.username,
      role: roleKey,
      roleLabel,
      area_code: user.area_code ?? null,
    };

    const token = await jwtSign(payload, env.JWT_SECRET, 60 * 60 * 24 * 30);

    return json({
      ok: true,
      success: true,
      user: { username: payload.username, name: payload.name, role: roleLabel, roleKey, area_code: payload.area_code },
      token,
    });
  } catch (e) {
    return json({ ok: false, success: false, error: e?.message || "Server error" }, 500);
  }
}
