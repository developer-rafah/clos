export function json(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  });

  return new Response(JSON.stringify(data), { status, headers });
}

export function ok(data = {}, status = 200) {
  return json({ ok: true, success: true, ...data }, status);
}

export function fail(error = "Error", status = 400, extra = {}) {
  return json({ ok: false, success: false, error, ...extra }, status);
}

export function badRequest(error = "Bad request", extra = {}) {
  return fail(error, 400, extra);
}

export function unauthorized(error = "Unauthorized", extra = {}) {
  return fail(error, 401, extra);
}

export function forbidden(error = "Forbidden", extra = {}) {
  return fail(error, 403, extra);
}

export function serverError(error = "Server error", extra = {}) {
  return fail(error, 500, extra);
}
