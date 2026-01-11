import { ok, fail } from "../_lib/response.js";

export async function onRequestPost({ request, env }) {
  try {
    const GAS_URL = String(env.GAS_URL || "").trim();
    if (!GAS_URL) return fail("GAS_URL is not set", 500);

    const GAS_API_KEY = String(env.GAS_API_KEY || "").trim();

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "").trim();
    const payload = body.payload ?? null;

    if (!action) return fail("Missing action", 400);

    // donate + auth.* public
    const isPublic =
  action === "donate" ||
  action.startsWith("auth.") ||
  action.startsWith("agent."); // ✅ token-protected in GAS


    const url = new URL(GAS_URL);
    url.searchParams.set("action", action);

    if (!isPublic) {
      if (!GAS_API_KEY) return fail("GAS_API_KEY is not set", 500);
      url.searchParams.set("apiKey", GAS_API_KEY);
    }

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) return fail(`GAS HTTP ${res.status}`, 502, { gas: data });

    // ✅ إذا GAS رجّع ok:false / success:false اعتبره خطأ
    if (data && typeof data === "object") {
      if (data.ok === false || data.success === false) {
        return fail(data.error || "GAS error", 502, { gas: data });
      }
    }

    return ok({ gas: data });
  } catch (e) {
    return fail(e?.message || String(e), 500);
  }
}
