function normalizePathParam(pathParam) {
  // Cloudflare قد يمرر params.path كسلسلة أو كمصفوفة
  if (Array.isArray(pathParam)) return pathParam.join("/");
  return String(pathParam || "").trim();
}

function actionFromPath(path) {
  // "auth/login" => "auth.login"
  return String(path || "")
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

async function fetchWithManualRedirect(url, init, maxHops = 3) {
  // نمنع auto-follow لأننا نحتاج نحافظ على body
  let currentUrl = url;
  let hops = 0;

  while (true) {
    const res = await fetch(currentUrl, { ...init, redirect: "manual" });

    // ليس redirect
    if (![301, 302, 303, 307, 308].includes(res.status)) return res;

    if (hops >= maxHops) {
      return new Response(
        JSON.stringify({ ok: false, error: "Too many redirects from upstream" }),
        { status: 502, headers: withCors({ "content-type": "application/json; charset=utf-8" }) }
      );
    }

    const loc = res.headers.get("location");
    if (!loc) return res;

    // GAS يعطينا location نسبي/مطلق
    const next = new URL(loc, currentUrl).toString();

    // ⚠️ مهم: نُبقي نفس method ونفس body (حتى لو 302/303)
    currentUrl = next;
    hops++;
  }
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

    const incomingUrl = new URL(request.url);

    const path = normalizePathParam(params.path);
    const action = actionFromPath(path);

    const target = new URL(gasUrl);
    target.searchParams.set("action", action);

    // تمرير query parameters إلى GAS
    for (const [k, v] of incomingUrl.searchParams.entries()) {
      target.searchParams.set(k, v);
    }

    // headers الأساسية (نقل Content-Type فقط يكفي عادة)
    const headers = new Headers();
    const ct = request.headers.get("content-type") || "application/json";
    headers.set("content-type", ct);

    // ✅ اقرأ body مرة واحدة كـ buffer لإعادة استخدامه بعد redirect
    let bodyBuf = undefined;
    if (!["GET", "HEAD"].includes(request.method)) {
      bodyBuf = await request.arrayBuffer();
    }

    const init = {
      method: request.method,
      headers,
      body: bodyBuf,
    };

    const upstream = await fetchWithManualRedirect(target.toString(), init, 4);

    const text = await upstream.text();

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

