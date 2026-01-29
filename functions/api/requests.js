// functions/api/requests.js
import { ok, fail } from "../_lib/response.js";
import { requireAuth } from "../_lib/auth.js";
import { sbSelect } from "../_lib/supabase.js";

function enc(v) {
  return encodeURIComponent(String(v));
}

function statusOrForAssigned() {
  // ✅ تضمين NULL/فارغ ضمن المسندة (حل جذري)
  // PostgREST OR syntax: or=(status.is.null,status.eq.,status.eq.مسند,status.eq.جديد,status.eq.قيد التنفيذ)
  return `or=(status.is.null,status.eq.,status.eq.${enc("مسند")},status.eq.${enc("جديد")},status.eq.${enc("قيد التنفيذ")})`;
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await requireAuth(request, env);

    const url = new URL(request.url);
    const view = url.searchParams.get("view") || "assigned";
    const q = (url.searchParams.get("q") || "").trim();

    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

    const select =
      "select=id,customer_name,customer_nam,phone,district,lat,lng,status,agent_name,weight,notes,created_at,assigned_at,closed_at,source";

    const clauses = [];

    // بحث
    if (q) {
      clauses.push(
        `or=(id.ilike.*${enc(q)}*,customer_name.ilike.*${enc(q)}*,customer_nam.ilike.*${enc(q)}*,phone.ilike.*${enc(
          q
        )}*,district.ilike.*${enc(q)}*)`
      );
    }

    // فلترة حسب الدور
    if (user.role === "agent") {
      // ✅ نعتمد agent_name (وتقبل الاسم أو اليوزر)
      clauses.push(`or=(agent_name.eq.${enc(user.username)},agent_name.eq.${enc(user.name || "")})`);

      if (view === "closed") {
        clauses.push(`status.eq.${enc("مكتمل")}`);
      } else {
        // assigned (default)
        clauses.push(statusOrForAssigned());
      }
    }

    if (user.role === "staff") {
      // ✅ لا يوجد area_code شرط نهائياً
      if (view === "new") {
        clauses.push(`or=(agent_name.is.null,agent_name.eq.)`);
        clauses.push(statusOrForAssigned());
      } else if (view === "assigned") {
        clauses.push(`agent_name.not.is.null`);
        clauses.push(statusOrForAssigned());
      } else if (view === "closed") {
        clauses.push(`status.eq.${enc("مكتمل")}`);
      }
    }

    if (user.role === "admin") {
      if (view === "new") {
        clauses.push(`or=(agent_name.is.null,agent_name.eq.)`);
        clauses.push(statusOrForAssigned());
      } else if (view === "assigned") {
        clauses.push(`agent_name.not.is.null`);
        clauses.push(statusOrForAssigned());
      } else if (view === "closed") {
        clauses.push(`status.eq.${enc("مكتمل")}`);
      } // else all
    }

    const query = [
      select,
      ...clauses,
      `order=created_at.desc`,
      `limit=${limit}`,
      `offset=${offset}`,
    ].join("&");

    const { data, total } = await sbSelect(env, "requests", query, { count: true });

    // KPIs بسيطة (من نفس الفلاتر حسب الدور)
    const kpis = {
      total: total ?? (data?.length || 0),
      assigned: null,
      closed: null,
    };

    // نحسب KPIs دقيقة عبر استعلامين count فقط (خفيفة)
    // إذا تبغاها أسرع، قلّي وأخليها اختيارية.
    const baseClauses = clauses.filter((c) => !c.startsWith("status.eq") && !c.startsWith("or=(status"));
    const assignedQuery = [select, ...baseClauses, statusOrForAssigned(), "limit=1", "offset=0"].join("&");
    const closedQuery = [select, ...baseClauses, `status.eq.${enc("مكتمل")}`, "limit=1", "offset=0"].join("&");

    const a = await sbSelect(env, "requests", assignedQuery, { count: true });
    const c = await sbSelect(env, "requests", closedQuery, { count: true });

    kpis.assigned = a.total ?? 0;
    kpis.closed = c.total ?? 0;

    return ok({
      items: data || [],
      pagination: { limit, offset, count: total ?? (data?.length || 0) },
      role: user.role,
      kpis,
    });
  } catch (e) {
    return fail(e.message === "Unauthorized" ? 401 : 500, e.message || "Error");
  }
}
