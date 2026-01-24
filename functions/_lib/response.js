export function json(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function badRequest(message, extra = {}) {
  return json({ ok: false, success: false, error: message, ...extra }, { status: 400 });
}

export function unauthorized(message = "Unauthorized", extra = {}) {
  return json({ ok: false, success: false, error: message, ...extra }, { status: 401 });
}

export function forbidden(message = "Forbidden", extra = {}) {
  return json({ ok: false, success: false, error: message, ...extra }, { status: 403 });
}

export function serverError(err, extra = {}) {
  const msg = err?.message ? String(err.message) : String(err);
  return json({ ok: false, success: false, error: msg, ...extra }, { status: 500 });
}
