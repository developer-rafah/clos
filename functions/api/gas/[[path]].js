import { json } from "../../_lib/response.js";

function withCors(response, request) {
  const origin = request.headers.get("Origin");
  const h = new Headers(response.headers);

  if (origin && origin !== "null") {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Vary", "Origin");
    h.set("Access-Control-Allow-Credentials", "true");
  } else {
    h.set("Access-Control-Allow-Origin", "*");
  }

  h.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  h.set("cache-control", "no-store");
  h.set("x-content-type-options", "nosniff");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: h,
  });
}

export async function onRequestOptions({ request }) {
  return withCors(new Response(null, { status: 204 }), request);
}

/**
 * ✅ هذا هو التصدير الذي كان ناقصًا
 * Cloudflare Pages Functions يستخدم onRequest كـ entrypoint
 */
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") return onRequestOptions(context);

  if (request.method !== "POST") {
    return withCors(json({ ok: false, success: false, error: "Method not allowed" }, 405), request);
  }

  const GAS_EXEC_URL = String(env.GAS_EXEC_URL || env.GAS_URL || "").trim();
  if (!GAS_EXEC_URL) {
    return withCors(json({ ok: false, success: false, error: "Missing GAS_EXEC_URL" }, 500), request);
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim();
  if (!action) {
    return withCors(json({ ok: false, success: false, error: "Missing action" }, 400), request);
  }

  const isTokenOnly =
    action === "donate" || action.startsWith("auth.") || action.startsWith("agent.");

  const GAS_API_KEY = String(env.GAS_API_KEY || "").trim();
  if (!isTokenOnly && GAS_API_KEY) {
    body.apiKey = body.apiKey || GAS_API_KEY;
  }

  const target = new URL(GAS_EXEC_URL);
  target.searchParams.set("action", action);

  let upstream;
  let upstreamText = "";

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
    return withCors(
      json(
        { ok: false, success: false, error: "Upstream fetch failed: " + (e?.message || String(e)) },
        502
      ),
      request
    );
  }

  let gasPayload;
  try {
    gasPayload = upstreamText ? JSON.parse(upstreamText) : {};
  } catch {
    gasPayload = { raw: upstreamText || "" };
  }

  const okFlag = upstream.ok && gasPayload?.ok !== false && gasPayload?.success !== false;

  return withCors(
    json(
      {
        ok: okFlag,
        success: okFlag,
        status: upstream.status,
        gas: gasPayload,
      },
      200
    ),
    request
  );
}
