// public/assets/js/api.js

async function readJsonOrText(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  // حاول JSON
  if (ct.includes("application/json")) {
    const data = await res.json().catch(() => null);
    return { data, text: null };
  }

  // fallback نص
  const text = await res.text().catch(() => "");
  // حاول parse لو كان نص JSON رغم content-type
  try {
    const data = text ? JSON.parse(text) : null;
    return { data, text };
  } catch {
    return { data: null, text };
  }
}

export async function apiGet(path) {
  const res = await fetch(path, { method: "GET", cache: "no-store", credentials: "include" });
  const { data, text } = await readJsonOrText(res);

  // لو نجح
  if (res.ok && data && data.ok !== false) return data;

  // لو فشل
  const msg =
    (data && (data.error || data.message)) ||
    (text ? text.slice(0, 300) : "") ||
    `HTTP ${res.status}`;

  throw new Error(msg);
}

export async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  const { data, text } = await readJsonOrText(res);

  // لو نجح
  if (res.ok && data && data.ok !== false) return data;

  // لو فشل
  const msg =
    (data && (data.error || data.message)) ||
    (text ? text.slice(0, 300) : "") ||
    `HTTP ${res.status}`;

  throw new Error(msg);
}

/** Proxy to GAS (hide GAS_URL) */
export async function gas(action, payload) {
  const out = await apiPost("/api/gas", { action, payload });

  // Cloudflare قد يرجّع ok:true وبداخل gas خطأ
  const g = out?.gas;

  if (g && typeof g === "object") {
    if (g.ok === false || g.success === false) {
      throw new Error(g.error || "GAS returned an error");
    }
  }

  return g;
}
