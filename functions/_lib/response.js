export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function ok(data = {}) {
  return json({ ok: true, success: true, ...data }, 200);
}

export function fail(message, status = 400, extra = {}) {
  return json({ ok: false, success: false, error: String(message || "Error"), ...extra }, status);
}

export function text(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}
