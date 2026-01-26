// functions/api/requests/[id].js

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
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
  const [, p] = String(token || "").split(".");
  if (!p) throw new Error("Bad token");
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

  const cookie = req.headers.get("cookie") || "";
  const name = "CLOS_SESSION_V1";
  const mm = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (mm) return decodeURIComponent(mm[1]);

  return "";
}

function normalizeRole(role) {
  const r = String(role || "").trim();
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

function nowIso() {
  return new Date().toISOString();
}

export async function onRequestPatch({ request, env, params }) {
  try {
    const secret = pickJwtSecret(env);
    if (!secret) return json({ ok: false, success: false, error: "Missing JWT secret" }, 500);

    const token = getTokenFromRequest(request);
    if (!token) return json({ ok: false, success: false, error: "Unauthorized" }, 401);

    const payload = await verifyJwtHS256(token, secret);
    const role = normalizeRole(payload?.role);

    const id = String(params?.id || "").trim();
    if (!id) return json({ ok: false, success: false, error: "Missing id" }, 400);

    const body = await request.json().catch(() => ({}));

    // جلب الطلب الحالي للتأكد من الصلاحية
    const getRes = await sbFetch(env, `requests?select=id,agent_name,status&id=eq.${encodeURIComponent(id)}`, {
      method: "GET",
    });
    const current = await getRes.json().catch(() => []);
    const row = Array.isArray(current) ? current[0] : null;
    if (!row) return json({ ok: false, success: false, error: "Request not found" }, 404);

    // صلاحيات
    if (role === "agent") {
      const username = String(payload?.username || "").trim();
      const name = String(payload?.name || "").trim();
      const assignedToMe = row.agent_name === username || row.agent_name === name;
      if (!assignedToMe) return json({ ok: false, success: false, error: "Forbidden" }, 403);
    }

    const patch = {};
    const allowed = new Set([
      "customer_name",
      "phone",
      "district",
      "lat",
      "lng",
      "notes",
      "weight",
      "status",
      "agent_name",
    ]);

    for (const k of Object.keys(body || {})) {
      if (allowed.has(k)) patch[k] = body[k];
    }

    // قواعد تلقائية
    patch.updated_at = nowIso();

    // إسناد: إذا تغيّر agent_name بواسطة موظف/مدير
    if ((role === "staff" || role === "admin") && typeof patch.agent_name === "string") {
      const v = patch.agent_name.trim();
      patch.agent_name = v;
      if (v) {
        patch.status = "مسند";
        patch.assigned_at = nowIso();
      }
    }

    // إغلاق: المندوب/المدير/الموظف
    if (typeof patch.status === "string" && patch.status.trim() === "مكتمل") {
      patch.closed_at = nowIso();
    }

    // وزن: اجعله رقم صحيح
    if (patch.weight !== undefined) {
      const n = Number(patch.weight);
      if (!Number.isFinite(n) || n < 0) {
        return json({ ok: false, success: false, error: "Invalid weight" }, 400);
      }
      patch.weight = Math.trunc(n);
    }

    if (!Object.keys(patch).length) {
      return json({ ok: false, success: false, error: "No valid fields to update" }, 400);
    }

    const updRes = await sbFetch(env, `requests?id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: patch,
    });

    const text = await updRes.text().catch(() => "");
    let out = [];
    try {
      out = text ? JSON.parse(text) : [];
    } catch {
      out = [];
    }

    if (!updRes.ok) {
      return json({ ok: false, success: false, error: `Supabase error (${updRes.status})`, raw: text }, 500);
    }

    return json({ ok: true, success: true, item: Array.isArray(out) ? out[0] : out });
  } catch (e) {
    return json({ ok: false, success: false, error: e?.message || String(e) }, 500);
  }
}
