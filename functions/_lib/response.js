// functions/_lib/response.js

function toHeaders(input) {
  if (!input) return new Headers();
  if (input instanceof Headers) return new Headers(input);
  return new Headers(input);
}

function normalizeInit(initOrStatus, maybeHeaders) {
  // يدعم:
  // json(data, {status, headers})
  // json(data, statusNumber, headers)
  // ok(payload, statusNumber, headers)
  if (typeof initOrStatus === "number") {
    return { status: initOrStatus, headers: toHeaders(maybeHeaders) };
  }

  // لو مرّر Headers مباشرة
  if (initOrStatus instanceof Headers) {
    return { status: 200, headers: toHeaders(initOrStatus) };
  }

  // لو مرّر object headers فقط
  if (initOrStatus && typeof initOrStatus === "object" && !("status" in initOrStatus) && !("headers" in initOrStatus)) {
    return { status: 200, headers: toHeaders(initOrStatus) };
  }

  const init = initOrStatus && typeof initOrStatus === "object" ? initOrStatus : {};
  return { status: init.status ?? 200, headers: toHeaders(init.headers) };
}

export function json(data, initOrStatus = {}, maybeHeaders) {
  const { status, headers } = normalizeInit(initOrStatus, maybeHeaders);

  // إجبار JSON + منع المتصفح من محاولة تفسيره كـ HTML (nosniff)
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(data, null, 2), { status, headers });
}

export function ok(payload = {}, status = 200, headersOrInit = {}) {
  // ok(payload, 200, headers) أو ok(payload, {status, headers})
  if (typeof status === "object") return json({ ok: true, success: true, ...payload }, status);
  return json({ ok: true, success: true, ...payload }, status, headersOrInit);
}

export function fail(message = "Server Error", status = 500, extra = {}, headersOrInit = {}) {
  const msg = message?.message ? String(message.message) : String(message);
  const body = { ok: false, success: false, error: msg, ...(extra && typeof extra === "object" ? extra : {}) };

  if (typeof status === "object") return json(body, status);
  return json(body, status, headersOrInit);
}

export function badRequest(message, extra = {}) {
  return fail(message, 400, extra);
}

export function unauthorized(message = "Unauthorized", extra = {}) {
  return fail(message, 401, extra);
}

export function forbidden(message = "Forbidden", extra = {}) {
  return fail(message, 403, extra);
}

export function serverError(err, extra = {}) {
  return fail(err, 500, extra);
}
