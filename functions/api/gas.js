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

    // donate عادة يكون public — لا نرسل apiKey
    const isPublic = action === "donate" || action.startsWith("auth.");

    const url = new URL(GAS_URL);
    url.searchParams.set("action", action);
    if (!isPublic) url.searchParams.set("apiKey", GAS_API_KEY);

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

    return ok({ gas: data });
  } catch (e) {
    return fail(e?.message || String(e), 500);
  }
}
