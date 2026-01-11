import { getToken } from "./auth.js";

async function parseJsonSafe(res) {
  const txt = await res.text().catch(() => "");
  if (!txt) return {};
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
}

export async function apiGet(path) {
  const res = await fetch(path, { method: "GET", cache: "no-store" });
  const data = await parseJsonSafe(res);
  if (!res.ok || data?.ok === false || data?.success === false) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  const data = await parseJsonSafe(res);

  // دعم شكلين للرد:
  // 1) { success:true, ... }  من GAS مباشرة
  // 2) { ok:true, gas:{ success:true, ... } } من وسيط /api/gas
  const ok1 = (res.ok && data?.ok !== false && data?.success !== false);
  if (!ok1) throw new Error(data?.error || `HTTP ${res.status}`);

  return data;
}

/** Proxy to GAS */
export async function gas(action, payload) {
  const token = getToken();
  if (!token) throw new Error("Unauthorized: missing token (not saved)");

  const out = await apiPost("/api/gas", { action, payload, token });

  // لو الوسيط يرجع { gas: {...} } رجّعها، وإلا رجّع out نفسه
  return out?.gas ?? out;
}
