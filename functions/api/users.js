// functions/api/users.js - FULL
import { json, sbFetch, sbHeaders, requireUser, normalizeRole } from "./_shared.js";

export async function onRequestGet(ctx) {
  try {
    const { request, env } = ctx;
    const me = await requireUser(request, env);

    // فقط admin/staff
    if (me.roleKey !== "admin" && me.roleKey !== "staff") {
      return json({ ok: false, success: false, error: "Forbidden" }, 403);
    }

    const url = new URL(request.url);
    const role = url.searchParams.get("role") || "";

    // نريد قائمة المندوبين فقط غالباً
    let filter = "";
    if (role === "agent") {
      // في جدول users قد يكون role عربي
      // نجلب كل المستخدمين ونفلتر بالـ normalizeRole
      filter = ""; 
    }

    const q = `/rest/v1/users?select=username,role,name,area_code${filter}`;
    const res = await sbFetch(env, q, { headers: sbHeaders(env), method: "GET" });
    const rows = await res.json();

    const items = (rows || [])
      .map((u) => {
        const r = normalizeRole(u.role);
        return {
          username: u.username,
          name: u.name || u.username,
          role: r.roleLabel,
          roleKey: r.roleKey,
          area_code: u.area_code ?? null,
        };
      })
      .filter((x) => (role === "agent" ? x.roleKey === "agent" : true));

    return json({ ok: true, success: true, items });
  } catch (e) {
    return json({ ok: false, success: false, error: e?.message || "Server error" }, 500);
  }
}
