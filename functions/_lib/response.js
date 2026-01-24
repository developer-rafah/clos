export function json(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

export function ok(data = {}, headers = {}) {
  return json({ ok: true, success: true, ...data }, { status: 200, headers });
}

export function fail(message = "Error", status = 400, extra = {}) {
  return json({ ok: false, success: false, error: message, ...extra }, { status });
}

export function badRequest(message = "Bad Request", extra = {}) {
  return fail(message, 400, extra);
}

export function unauthorized(message = "Unauthorized", extra = {}) {
  return fail(message, 401, extra);
}

export function forbidden(message = "Forbidden", extra = {}) {
  return fail(message, 403, extra);
}

export function serverError(err, extra = {}) {
  const msg =
    typeof err === "string"
      ? err
      : err?.message
      ? err.message
      : "Internal Server Error";

  return fail(msg, 500, {
    ...extra,
    details:
      typeof err === "object"
        ? {
            name: err?.name,
            status: err?.status,
          }
        : undefined,
  });
}
