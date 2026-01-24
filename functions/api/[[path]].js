function normalizeActionFromPath(path) {
  // path مثل: "auth/login" => "auth.login"
  // أو: "requests/list" => "requests.list"
  return String(path || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\//g, ".");
}

function withCors(headers = {}) {
  return {
    ...headers,
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: withCors() });
}

export async function onRequest({ request, env, params }) {
  try {
    const gasUrl = (env.GAS_URL || "").trim();
    if (!gasUrl) {
      return new Response(JSON.stringify({ ok: false, error: "GAS_URL is not set" }), {
        status: 500,
        headers: withCors({ "content-type": "application/json; charset=utf-8" }),
      });
    }

    const path = params.path || "";
    const action = normalizeActionFromPath(path);

    const url = new URL(gasUrl);
    // نمرر action عبر Query
    url.searchParams.set("action", action);

    // نمرر أي query params من /api?... إلى GAS أيضاً
    const incomingUrl = new URL(request.url);
    for (const [k, v] of incomingUrl.searchParams.entries()) {
      url.searchParams.set(k, v);
    }

    // تجهيز headers
    const reqHeaders = new Headers();
    reqHeaders.set("content-type", request.headers.get("content-type") || "application/json");

    // ✅ حل مشكلة one-time body مع redirect: اقرأ body كـ buffer
    let bodyBuf = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      // مهم: نحول الـ stream إلى buffer
      bodyBuf = await request.arrayBuffer();
    }

    const upstream = await fetch(url.toString(), {
      method: request.method,
      headers: reqHeaders,
      body: bodyBuf,
      redirect: "follow",
    });

    const text = await upstream.text();

    // مرر status و body كما هي
    return new Response(text, {
      status: upstream.status,
      headers: withCors({
        "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "no-store",
      }),
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: (e && e.message) ? e.message : String(e),
      }),
      {
        status: 502,
        headers: withCors({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }),
      }
    );
  }
}
