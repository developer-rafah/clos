// functions/api/gas/[[path]].js
function normalizePathParam(pathParam) {
  if (Array.isArray(pathParam)) return pathParam.join("/");
  return String(pathParam || "").trim();
}

function actionFromPath(path) {
  return String(path || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\//g, ".");
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "cache-control": "no-store",
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function fetchWithManualRedirect(url, init, maxHops = 4) {
  let currentUrl = url;
  let hops = 0;

  while (true) {
    const res = await fetch(currentUrl, { ...init, redirect: "manual" });

    if (![301, 302, 303, 307, 308].includes(res.status)) return res;

    if (hops >= maxHops) {
      return new Response(JSON.stringify({ ok: false, error: "Too many redirects from upstream" }), {
        status: 502,
        headers: { ...corsHeaders(), "content-type": "application/json; charset=utf-8" },
      });
    }

    const loc = res.headers.get("location");
    if (!loc) return res;

    currentUrl = new URL(loc, currentUrl).toString();
    hops++;
  }
}

function tryExtractActionFromBody(bodyBuf, contentType) {
  const ct = String(contentType || "").toLowerCase();
  if (!bodyBuf || !ct.includes("application/json")) return "";

  try {
    const text = new TextDecoder("utf-8").decode(bodyBuf);
    const obj = JSON.parse(text);
    return String(obj?.action || "").trim();
  } catch {
    return "";
  }
}

export async function onRequest({ request, env, params }) {
  try {
    // دعم الاسمين لتفادي اختلافاتك بين Worker/Pages
    const gasUrl = String(env.GAS_EXEC_URL || env.GAS_URL || "").trim();
    if (!gasUrl) {
      return new Response(JSON.stringify({ ok: false, error: "GAS_EXEC_URL/GAS_URL is not set" }), {
        status: 500,
        headers: { ...corsHeaders(), "content-type": "application/json; charset=utf-8" },
      });
    }

    const incomingUrl = new URL(request.url);
    const path = normalizePathParam(params.path);
    const pathAction = actionFromPath(path);

    // اقرأ body مرة واحدة (مهم)
    const ct = request.headers.get("content-type") || "application/json";
    let bodyBuf = undefined;
    if (!["GET", "HEAD"].includes(request.method)) {
      bodyBuf = await request.arrayBuffer();
    }

    // لو المسار /api/gas (بدون لاحقة) نستخرج action من query أو من body
    const qAction = String(incomingUrl.searchParams.get("action") || "").trim();
    const bodyAction = tryExtractActionFromBody(bodyBuf, ct);
    const action = pathAction || qAction || bodyAction;

    const target = new URL(gasUrl);
    if (action) target.searchParams.set("action", action);

    // مرّر أي query أخرى للـ GAS
    for (const [k, v] of incomingUrl.searchParams.entries()) {
      target.searchParams.set(k, v);
    }

    const headers = new Headers();
    headers.set("content-type", ct);

    const init = {
      method: request.method,
      headers,
      body: bodyBuf,
    };

    const upstream = await fetchWithManualRedirect(target.toString(), init, 4);
    const text = await upstream.text();

    return new Response(text, {
      status: upstream.status,
      headers: {
        ...corsHeaders(),
        "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 502,
      headers: { ...corsHeaders(), "content-type": "application/json; charset=utf-8" },
    });
  }
}
