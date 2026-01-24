import { json as j, fail } from "../../_lib/response.js";

export async function onRequestOptions({ request }) {
  return withCors(new Response(null, { status: 204 }), request);
}

export async function onRequestPost({ request, env }) {
  const GAS_EXEC_URL = String(env.GAS_EXEC_URL || env.GAS_URL || "").trim();
  if (!GAS_EXEC_URL) return withCors(fail("Missing GAS_EXEC_URL", 500), request);

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim();
  if (!action) return withCors(fail("Missing action", 400), request);

  const GAS_API_KEY = String(env.GAS_API_KEY || "").trim();
  const isTokenOnly =
    action === "donate" || action.startsWith("auth.") || action.startsWith("agent.");

  if (!isTokenOnly && GAS_API_KEY) body.apiKey = body.apiKey || GAS_API_KEY;

  const target = new URL(GAS_EXEC_URL);
  target.searchParams.set("action", action);

  let upstream, upstreamText = "";
  try {
    upstream = await fetch(target.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
      body: JSON.stringify(body),
      redirect: "follow",
    });
    upstreamText = await upstream.text().catch(() => "");
  } catch (e) {
    return withCors(fail("Upstream fetch failed: " + (e?.message || String(e)), 502), request);
  }

  let gasPayload;
  try {
    gasPayload = upstreamText ? JSON.parse(upstreamText) : {};
  } catch {
    gasPayload = { raw: upstreamText || "" };
  }

  const ok = upstream.ok && gasPayload?.ok !== false && gasPayload?.success !== false;

  return withCors(
    j(
      {
        ok,
        success: ok,
        status: upstream.status,
        gas: gasPayload,
      },
      200
    ),
    request
  );
}

function withCors(response, request) {
  const origin = request.headers.get("Origin");
  const h = new Headers(response.headers);

  if (origin && origin !== "null") {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Access-Control-Allow-Credentials", "true");
    h.set("Vary", "Origin");
  } else {
    h.set("Access-Control-Allow-Origin", "*");
  }

  h.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: h,
  });
}
