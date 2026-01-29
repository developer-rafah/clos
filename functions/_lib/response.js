// functions/_lib/response.js
export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function ok(payload = {}) {
  return json({ ok: true, success: true, ...payload }, 200);
}

export function fail(status = 400, message = "Bad Request", extra = {}) {
  return json({ ok: false, success: false, error: message, ...extra }, status);
}
