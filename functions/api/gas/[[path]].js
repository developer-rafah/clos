import { json, fail } from "../../_lib/response.js";

function corsHeaders(req) {
  const origin = req.headers.get("Origin") || "*";
  return {
    "access-control-allow-origin": origin === "null" ? "*" : origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization, X-Requested-With",
    "access-control-allow-credentials": "true",
    vary: "Origin",
  };
}

function normalizeActionFromPath(path) {
  return String(path || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\//g, ".");
}

async function fetchWithManualRedirect(url, init, maxHops = 4) {
  let currentUrl = url;
  let currentInit = { ...init, redirect: "manual" };

  for (let i = 0; i <= maxHops; i++) {
    const res = await fetch(currentUrl, currentInit);

    if (![301, 302, 303, 307, 308].includes(res.status)) return res;

    const loc = res.headers.get("location");
    if (!loc) return res;

    const next = new URL(loc, currentUrl).toString();

    // نحافظ على الـ body (حتى لو 302/303) عشان GAS أحياناً يعيد توجيه
    currentUrl = next;
  }

  throw new Error("Too many redirects while proxying to GAS");
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function onRequest({ request, env, params }) {
  try {
    const GAS_EXEC_URL = String(env.GAS_EXEC_URL || env.GAS_URL || "").trim();
    if (!GAS_EXEC_URL) {
      return new Response(JSON.stringify({ ok: false, success: false, error: "Missing GAS_EXEC_URL/GAS_URL" }), {
        status: 500,
        headers: { ...corsHeaders(request), "content-type": "application/json; charset=utf-8" },
      });
    }

    // GET للـ health/debug
    if (request.method === "GET") {
      return new Response(
        JSON.stringify({ ok: true, success: true, service: "gas-proxy", hint: "Use POST with JSON {action, ...}" }),
        { status: 200, headers: { ...corsHeaders(request), "content-type": "application/json; charset=utf-8" } }
      );
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, success: false, error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders(request), "content-type": "application/json; charset=utf-8" },
      });
    }

    const body = await request.json().catch(() => ({}));

    const path = params?.path; // optional catch-all
    const actionFromPath = path ? normalizeActionFromPath(path) : "";
    const action = String(body.action || actionFromPath || "").trim();

    if (!action) {
      return new Response(JSON.stringify({ ok: false, success: false, error: "Missing action" }), {
        status: 400,
        headers: { ...corsHeaders(request), "content-type": "application/json; charset=utf-8" },
      });
    }

    // actions لا تحتاج apiKey
    const isTokenOnly =
      action === "donate" ||
      action.startsWith("auth.") ||
      action.startsWith("agent.");

    const GAS_API_KEY = String(env.GAS_API_KEY || "").trim();
    if (!isTokenOnly && GAS_API_KEY) {
      body.apiKey = body.apiKey || GAS_API_KEY;
    }

    // نبني target
    const target = new URL(GAS_EXEC_URL);
    target.searchParams.set("action", action);

    // نرسل wrapper كامل (مثل Worker)
    const outBody = { ...body, action };

    // لازم نقرأ body مرة واحدة — هنا خلاص عندنا JSON جاهز
    const init = {
      method: "POST",
      headers: { "content-type": "application/json", "cache-control": "no-store" },
      body: JSON.stringify(outBody),
      redirect: "manual",
    };

    const upstream = await fetchWithManualRedirect(target.toString(), init, 4);
    const text = await upstream.text().catch(() => "");

    let gasPayload;
    try {
      gasPayload = text ? JSON.parse(text) : {};
    } catch {
      gasPayload = { raw: text || "" };
    }

    const ok = upstream.ok && gasPayload?.ok !== false && gasPayload?.success !== false;

    return new Response(
      JSON.stringify({ ok, success: ok, status: upstream.status, gas: gasPayload }),
      {
        status: 200,
        headers: { ...corsHeaders(request), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      }
    );
  } catch (e) {
    return fail("Upstream error: " + (e?.message || String(e)), 502);
  }
}
