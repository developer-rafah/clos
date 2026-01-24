export async function onRequestGet({ request, env }) {
  try {
    /* =========================
     * 1) التحقق من التوكن
     * ========================= */
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return json(401, {
        ok: false,
        error: "Missing Authorization token",
      });
    }

    /* =========================
     * 2) قراءة المستخدم من Supabase Auth
     * ========================= */
    const meRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });

    if (!meRes.ok) {
      return json(401, {
        ok: false,
        error: "Invalid or expired token",
      });
    }

    const me = await meRes.json();
    const role =
      me?.user_metadata?.role ||
      me?.app_metadata?.role ||
      "";

    if (!role) {
      return json(403, {
        ok: false,
        error: "User role not found",
      });
    }

    /* =========================
     * 3) بناء Query حسب الدور
     * ========================= */
    let query = "select=*";

    if (role === "مندوب") {
      // المندوب → الطلبات المسندة له فقط
      query += `&agent=eq.${encodeURIComponent(me.email)}`;
    }

    if (role === "موظف") {
      // الموظف → غير المسندة أو التابعة له
      query += `&or=(agent.is.null,agent.eq.${encodeURIComponent(me.email)})`;
    }

    // المدير → لا فلترة

    query += "&order=created_at.desc";

    /* =========================
     * 4) جلب الطلبات
     * ========================= */
    const reqRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/requests?${query}`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!reqRes.ok) {
      const errText = await reqRes.text();
      return json(500, {
        ok: false,
        error: "Supabase fetch failed",
        details: errText,
      });
    }

    const rows = await reqRes.json();

    /* =========================
     * 5) الرد النهائي
     * ========================= */
    return json(200, {
      ok: true,
      success: true,
      role,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    return json(500, {
      ok: false,
      error: err.message || String(err),
    });
  }
}

/* =========================
 * Helper: JSON Response
 * ========================= */
function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
