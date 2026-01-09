import { getConfig } from './app-config.js';
import { getSession } from './auth.js';

/**
 * IMPORTANT:
 * - Use Content-Type: text/plain to avoid CORS preflight with GAS.
 * - Send token inside body, not Authorization header.
 */
export async function gasCall(action, payload = {}) {
  const { GAS_URL } = await getConfig();
  const session = getSession();

  const body = {
    action,
    payload,
    token: session?.token || null
  };

  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Bad JSON from GAS: ${text.slice(0, 200)}`);
  }

  if (!res.ok || data?.ok === false) {
    const msg = data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}
