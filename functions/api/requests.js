// functions/api/requests.js

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function pickJwtSecret(env) {
  return String(env.JWT_SECRET || env.AUTH_JWT_SECRET || "").trim();
}

function pickSupabase(env) {
  const url = String(env.SUPABASE_URL || env.SUPABASE_API_URL || "").trim();
  const key = String(
    env.SUPABASE_SERVICE_ROLE_KEY ||
      env.SUPABASE_SERVICE_KEY ||
      env.SUPABASE_KEY ||
      env.SUPABASE_ANON_KEY ||
      ""
  ).trim();

  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)");
  return { url, key };
}

function base64UrlToBytes(str) {
  str = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) str += "=".repeat(4 - pad);
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJwtNoVerify(token) {
  const [h, p] = String(token || "").split(".");
  if (!h || !p) throw new Error("Bad token");
  const payloadBytes = base64UrlToBytes(p);
  const payloadJson = new TextDecoder().decode(payloadBytes);
  return JSON.parse(payloadJson);
}

async function verifyJwtHS256(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Bad token");
  const [h, p, s] = parts;

  const signingInput = `${h}.${p}`;
  const sigBytes = base64UrlToBytes(s);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(signingInput)
  );

  if (!ok) throw new Error("Invalid signature");

  const payload = decodeJwtNoVerify(token);
  if (payload?.exp && Date.now() / 1000 > Number(payload.exp)) {
    throw new Error("Token expired");
  }
  return payload;
}

function getTokenFromRequest(req) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();

  // fallback cookie
  const cookie = req.headers.get("cookie") || "";
  const name = "CLOS_SESSION_V1";
  const mm = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (mm) return decodeURIComponent(mm[1]);

  return "";
}

function normalizeRole(role) {
  const r = String(role || "").trim();
  // دعم العربي/الإنجليزي
  if (r === "مندوب" || r === "agent") return "agent";
  if (r === "موظف" || r === "staff") return "staff";
  if (r === "مدير" || r === "admin" || r === "مشرف") return "admin";
  return r || "agent";
}

async function sbFetch(env, path, { method = "GET", headers = {}, body } = {}) {
  const { url, key } = pickSupabase(env);
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

function parseContentRangeCount(contentRange) {
  // مثال: "0-49/120"
  if (!contentRange) return null;
  const m = String(contentRange).match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

export async function onRequestGet({ request, env }) {
  try {
    const secret = pickJwtSecret(env);
    if (!secret) return json({ ok: false, success: false, error: "Missing JWT secret" }, 500);

    const token = getTokenFromRequest(request);
    if (!token) return json({ ok: false, success: false, error: "Unauthorized" }, 401);

    const payload = await verifyJwtHS256(token, secret);
    const role = normalizeRole(payload?.role);

    const u = new URL(request.url);
    const view = String(u.searchParams.get("view") || "assigned").trim(); // assigned | closed | new | all
    const q = String(u.searchParams.get("q") || "").trim();
    const agent = String(u.searchParams.get("agent") || "").trim(); // للمدير/الموظف
    const status = String(u.searchParams.get("status") || "").trim(); // حالة صريحة
    const debug = u.searchParams.get("debug") === "1";

    const limit = Math.max(1, Math.min(200, Number(u.searchParams.get("limit") || 50)));
    const offset = Math.max(0, Number(u.searchParams.get("offset") || 0));

    const clauses = [];

    // ✅ فلترة حسب الدور
    if (role === "agent") {
      const username = String(payload?.username || "").trim();
      const name = String(payload?.name || "").trim();

      // نعتمد agent_name (وقد يكون مخزن كـ username عربي/إنجليزي)
      // نضع OR بين username و name للمرونة (لو بعض البيانات قديمة)
      clauses.push(`or(agent_name.eq.${encodeURIComponent(username)},agent_name.eq.${encodeURIComponent(name)})`);

      // ✅ افتراضي المندوب: المسند فقط (أي غير مكتمل وغير ملغي)
      if (view === "closed") {
        clauses.push(`status.eq.${encodeURIComponent("مكتمل")}`);
      } else if (view === "all") {
        // لا شيء
      } else {
        clauses.push(`status.neq.${encodeURIComponent("مكتمل")}`);
        clauses.push(`status.neq.${encodeURIComponent("ملغي")}`);
      }
    }

    if (role === "staff") {
      // ❗ أزلنا شرط area_code نهائياً (لأن عندك غير موجود)
      if (view === "closed") {
        clauses.push(`status.eq.${encodeURIComponent("مكتمل")}`);
      } else if (view === "assigned") {
        clauses.push(`agent_name.not.is.null`);
        clauses.push(`status.neq.${encodeURIComponent("مكتمل")}`);
        clauses.push(`status.neq.${encodeURIComponent("ملغي")}`);
      } else if (view === "new") {
        // جديد: غير مسند أو status=جديد
        clauses.push(
          `or(agent_name.is.null,agent_name.eq.${encodeURIComponent("")},status.eq.${encodeURIComponent("جديد")})`
        );
      } else if (view === "all") {
        // لا شيء
      }
    }

    if (role === "admin") {
      // المدير يرى الكل + فلاتر اختيارية
      if (view === "closed") clauses.push(`status.eq.${encodeURIComponent("مكتمل")}`);
      if (view === "assigned") {
        clauses.push(`agent_name.not.is.null`);
        clauses.push(`status.neq.${encodeURIComponent("مكتمل")}`);
        clauses.push(`status.neq.${encodeURIComponent("ملغي")}`);
      }
      if (view === "new") clauses.push(`or(agent_name.is.null,agent_name.eq.${encodeURIComponent("")},status.eq.${encodeURIComponent("جديد")})`);
    }

    // فلترة اختيارية بالوكيل (للموظف/المدير)
    if (agent && role !== "agent") {
      clauses.push(`agent_name.eq.${encodeURIComponent(agent)}`);
    }

    // فلترة اختيارية بالحالة (للموظف/المدير)
    if (status && role !== "agent") {
      clauses.push(`status.eq.${encodeURIComponent(status)}`);
    }

    // بحث
    if (q) {
      const qq = encodeURIComponent(`*${q}*`);
      clauses.push(
        `or(id.ilike.${qq},customer_name.ilike.${qq},phone.ilike.${qq},district.ilike.${qq},notes.ilike.${qq})`
      );
    }

    const params = new URLSearchParams();
    params.set("select", "*");
    params.set("order", "created_at.desc");
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    if (clauses.length) {
      // نجمّعها كلها داخل AND واحد
      // داخل AND يمكن وضع or(...) و status.eq... إلخ
      params.set("and", `(${clauses.join(",")})`);
    }

    const path = `requests?${params.toString()}`;

    const res = await sbFetch(env, path, {
      method: "GET",
      headers: { Prefer: "count=exact" },
    });

    const text = await res.text().catch(() => "");
    let data = [];
    try {
      data = text ? JSON.parse(text) : [];
    } catch {
      data = [];
    }

    if (!res.ok) {
      return json(
        { ok: false, success: false, error: `Supabase error (${res.status})`, raw: text },
        500
      );
    }

    const total = parseContentRangeCount(res.headers.get("content-range"));

    return json({
      ok: true,
      success: true,
      items: Array.isArray(data) ? data : [],
      pagination: { limit, offset, count: total ?? (Array.isArray(data) ? data.length : 0) },
      role,
      ...(debug ? { debug: { path: `/rest/v1/${path}`, clauses } } : {}),
    });
  } catch (e) {
    return json({ ok: false, success: false, error: e?.message || String(e) }, 500);
  }
}
