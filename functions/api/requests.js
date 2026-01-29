// functions/api/requests.js - FULL
import {
  json,
  sbFetch,
  sbHeaders,
  requireUser,
  parseContentRange,
  isClosedStatus,
  isCancelledStatus,
} from "./_shared.js";

function enc(v) {
  return encodeURIComponent(String(v));
}

function buildAndExpr(parts) {
  // parts like: ["status.neq.مكتمل", "or(...)", ...]
  const clean = parts.filter(Boolean);
  if (!clean.length) return "";
  return `&and=${enc(`(${clean.join(",")})`)}`;
}

async function countWithFilter(env, andParts) {
  const andExpr = buildAndExpr(andParts);
  const url = `/rest/v1/requests?select=id${andExpr}`;
  const res = await sbFetch(env, url, {
    method: "HEAD",
    headers: sbHeaders(env, { Prefer: "count=exact" }),
  });
  return parseContentRange(res.headers.get("content-range"));
}

export async function onRequestGet(ctx) {
  try {
    const { request, env } = ctx;
    const me = await requireUser(request, env);

    const url = new URL(request.url);
    const view = (url.searchParams.get("view") || "").trim();
    const q = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

    const select =
      "id,customer_name,phone,district,lat,lng,status,agent_name,weight,created_at,assigned_at,closed_at,updated_at";

    const andParts = [];

    // ===== Role filters =====
    if (me.roleKey === "agent") {
      // الاعتماد على agent_name + fallback (eq + ilike) لمشاكل اختلاف الاسم/username
      const ors = [
        `agent_name.eq.${me.username}`,
        me.name ? `agent_name.eq.${me.name}` : null,
        `agent_name.ilike.*${me.username}*`,
        me.name ? `agent_name.ilike.*${me.name}*` : null,
      ].filter(Boolean);

      andParts.push(`or(${ors.join(",")})`);

      // views للوكيل:
      // assigned: استبعاد المكتمل/الملغي بجميع الصيغ
      // closed: عرض المكتمل فقط
      if ((view || "assigned") === "closed") {
        andParts.push(`or(status.eq.مكتمل,status.eq.مكتملة,status.eq.مغلق)`);
      } else {
        andParts.push(`status.neq.مكتمل`);
        andParts.push(`status.neq.مكتملة`);
        andParts.push(`status.neq.مغلق`);
        andParts.push(`status.neq.ملغي`);
        andParts.push(`status.neq.ملغى`);
        andParts.push(`status.neq.مرفوض`);
      }
    }

    // staff/admin views
    if (me.roleKey === "staff" || me.roleKey === "admin") {
      const v = view || (me.roleKey === "staff" ? "new" : "all");

      if (v === "new") {
        andParts.push(`or(status.is.null,status.eq.جديد)`);
      } else if (v === "assigned") {
        andParts.push(`agent_name.not.is.null`);
        andParts.push(`status.neq.مكتمل`);
        andParts.push(`status.neq.مكتملة`);
        andParts.push(`status.neq.مغلق`);
        andParts.push(`status.neq.ملغي`);
        andParts.push(`status.neq.ملغى`);
        andParts.push(`status.neq.مرفوض`);
      } else if (v === "closed") {
        andParts.push(`or(status.eq.مكتمل,status.eq.مكتملة,status.eq.مغلق)`);
      } else {
        // all
      }
    }

    // ===== Search =====
    if (q) {
      const qq = q.replace(/\s+/g, " ").trim();
      andParts.push(
        `or(id.ilike.*${qq}*,customer_name.ilike.*${qq}*,phone.ilike.*${qq}*,district.ilike.*${qq}*)`
      );
    }

    // ===== Main list fetch with count =====
    const andExpr = buildAndExpr(andParts);
    const listUrl = `/rest/v1/requests?select=${enc(select)}${andExpr}&order=created_at.desc&limit=${limit}&offset=${offset}`;

    const res = await sbFetch(env, listUrl, {
      headers: sbHeaders(env, { Prefer: "count=exact" }),
      method: "GET",
    });

    const items = await res.json();
    const total = parseContentRange(res.headers.get("content-range"));

    // ===== KPIs (حسب الدور/نفس الفلتر الأساسي بدون view) =====
    // نعمل baseAndParts بدون view filters لكن مع role owner filter + search (للدقة نترك search خارج KPI)
    const baseAndParts = [];

    if (me.roleKey === "agent") {
      const ors = [
        `agent_name.eq.${me.username}`,
        me.name ? `agent_name.eq.${me.name}` : null,
        `agent_name.ilike.*${me.username}*`,
        me.name ? `agent_name.ilike.*${me.name}*` : null,
      ].filter(Boolean);
      baseAndParts.push(`or(${ors.join(",")})`);
    }

    // KPI counts
    const totalCount = await countWithFilter(env, [...baseAndParts]);
    const newCount = await countWithFilter(env, [...baseAndParts, `or(status.is.null,status.eq.جديد)`]);
    const assignedCount = await countWithFilter(env, [
      ...baseAndParts,
      `agent_name.not.is.null`,
      `status.neq.مكتمل`,
      `status.neq.مكتملة`,
      `status.neq.مغلق`,
      `status.neq.ملغي`,
      `status.neq.ملغى`,
      `status.neq.مرفوض`,
    ]);
    const closedCount = await countWithFilter(env, [
      ...baseAndParts,
      `or(status.eq.مكتمل,status.eq.مكتملة,status.eq.مغلق)`,
    ]);
    const cancelledCount = await countWithFilter(env, [
      ...baseAndParts,
      `or(status.eq.ملغي,status.eq.ملغى,status.eq.مرفوض)`,
    ]);

    return json({
      ok: true,
      success: true,
      roleKey: me.roleKey,
      items: Array.isArray(items) ? items : [],
      pagination: { limit, offset, count: Array.isArray(items) ? items.length : 0, total },
      kpis: {
        total: totalCount,
        new: newCount,
        assigned: assignedCount,
        closed: closedCount,
        cancelled: cancelledCount,
      },
    });
  } catch (e) {
    const msg = e?.message || "Server error";
    const code = msg === "Unauthorized" ? 401 : 500;
    return json({ ok: false, success: false, error: msg }, code);
  }
}
