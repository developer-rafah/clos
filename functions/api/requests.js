// functions/api/requests.js

import { ok, badRequest, unauthorized, serverError } from "../_lib/response.js";
import { requireAuth } from "../_lib/auth.js";

function pickSupabase(env) {
  const url = String(
    env.SUPABASE_URL ||
    env.SUPABASE_PROJECT_URL ||
    env.SUPABASE_REST_URL ||
    ""
  ).trim();

  const key = String(
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_KEY ||
    env.SUPABASE_KEY ||
    ""
  ).trim();

  return { url, key };
}

async function sb(env, path, { method = "GET", body, prefer } = {}) {
  const { url, key } = pickSupabase(env);
  if (!url || !key) throw new Error("Supabase env is missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");

  const headers = {
    apikey: key,
    authorization: `Bearer ${key}`,
  };
  if (prefer) headers.Prefer = prefer;
  if (body !== undefined) headers["content-type"] = "application/json";

  const res = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const txt = await res.text().catch(() => "");
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = { raw: txt }; }

  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error_description ||
      data?.error ||
      `Supabase HTTP ${res.status}`;
    const e = new Error(msg);
    e.status = res.status;
    e.data = data;
    throw e;
  }

  return data;
}

function isAgentRole(role) {
  const r = String(role || "").trim();
  return r === "مندوب" || r.toLowerCase() === "agent";
}

function matchesOwner(row, user) {
  const u = String(user?.username || "").trim();
  const n = String(user?.name || "").trim();

  const au = String(row?.agent_username || "").trim();
  const an = String(row?.agent_name || "").trim();

  return (au && au === u) || (an && (an === n || an === u));
}

/** GET: جلب الطلبات */
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const { user } = auth;
  const url = new URL(request.url);

  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

  // فلاتر اختيارية
  const status = String(url.searchParams.get("status") || "").trim();

  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "created_at.desc");
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  if (status) params.set("status", `eq.${status}`);

  // لو مندوب: فلترة على agent_username أو agent_name
  if (isAgentRole(user.role)) {
    const u = String(user.username || "").trim();
    const n = String(user.name || "").trim();
    // OR filter
    params.set("or", `(agent_username.eq.${u},agent_name.eq.${n || u})`);
  }

  const items = await sb(env, `/rest/v1/requests?${params.toString()}`, {
    method: "GET",
    prefer: "count=exact",
  });

  // count لن يخرج في body هنا، لكن نعيد pagination منطقية
  return ok({
    items: Array.isArray(items) ? items : [],
    pagination: { limit, offset, count: Array.isArray(items) ? items.length : 0 },
    role: isAgentRole(user.role) ? "agent" : "staff",
  });
}

/** POST: تحديث طلب (وزن/حالة/إغلاق) */
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const { user } = auth;

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || "").trim();
  const patch = body?.patch && typeof body.patch === "object" ? body.patch : null;

  if (!id || !patch) return badRequest("Missing id/patch");

  // اقرأ الطلب أولاً للتحقق من الملكية لو مندوب
  const q = new URLSearchParams();
  q.set("select", "id,agent_username,agent_name,status");
  q.set("id", `eq.${id}`);

  const rows = await sb(env, `/rest/v1/requests?${q.toString()}`, { method: "GET" });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return badRequest("Request not found");

  if (isAgentRole(user.role) && !matchesOwner(row, user)) {
    return unauthorized("Not allowed to update this request");
  }

  // allowed fields فقط
  const upd = {};
  if ("weight" in patch) {
    const w = patch.weight;
    if (w === null || w === "") {
      upd.weight = null;
    } else {
      const n = Number(w);
      if (Number.isNaN(n) || n < 0) return badRequest("Invalid weight");
      // weight عندك int4، نخزن رقم صحيح
      upd.weight = Math.round(n);
    }
  }

  if ("status" in patch) {
    upd.status = String(patch.status || "").trim();
  }

  if ("notes" in patch) {
    upd.notes = String(patch.notes || "").trim();
  }

  if ("closed_at" in patch) {
    const v = String(patch.closed_at || "").trim();
    upd.closed_at = v || null;
  }

  // تحديث timestamp
  upd.updated_at = new Date().toISOString();

  if (Object.keys(upd).length === 0) return badRequest("No valid fields to update");

  // PATCH update
  const uq = new URLSearchParams();
  uq.set("id", `eq.${id}`);

  const updated = await sb(env, `/rest/v1/requests?${uq.toString()}`, {
    method: "PATCH",
    body: upd,
    prefer: "return=representation",
  });

  return ok({ item: Array.isArray(updated) ? updated[0] : updated });
}
