import { ok, fail } from "../../_lib/response.js";
import { getCookie } from "../../_lib/security.js";
import { verifyJwt } from "../../_lib/jwt.js";
import { listPushTokens } from "../../_lib/supabase.js";

const COOKIE_NAME = "clos_session";

// --- Small helpers ---
function base64UrlEncode(bytes) {
  // bytes: ArrayBuffer | Uint8Array
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  const b64 = btoa(s);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeText(text) {
  return base64UrlEncode(new TextEncoder().encode(text));
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function safeStringifyData(obj) {
  // FCM data values must be strings
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        results[i] = { ok: false, error: e?.message || String(e) };
      }
    }
  }

  const workers = [];
  const n = Math.max(1, Math.min(limit, items.length));
  for (let i = 0; i < n; i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

// --- Access token cache (per isolate) ---
let cachedToken = null; // { token: string, expMs: number }

// Create OAuth2 access token using Service Account (JWT Bearer)
async function getAccessTokenFromServiceAccount(serviceAccount) {
  const nowSec = Math.floor(Date.now() / 1000);

  // reuse token if valid for at least 60s
  if (cachedToken && cachedToken.token && Date.now() < cachedToken.expMs - 60_000) {
    return cachedToken.token;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSec,
    exp: nowSec + 3600,
  };

  const encodedHeader = base64UrlEncodeText(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeText(JSON.stringify(payload));
  const unsignedJwt = `${encodedHeader}.${encodedPayload}`;

  const keyData = pemToArrayBuffer(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    cryptoKey,
    new TextEncoder().encode(unsignedJwt)
  );

  const jwt = `${unsignedJwt}.${base64UrlEncode(signature)}`;

  const form = new URLSearchParams();
  form.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  form.set("assertion", jwt);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const txt = await res.text();
  if (!res.ok) throw new Error(`OAuth token error (${res.status}): ${txt}`);

  const json = JSON.parse(txt);
  const accessToken = String(json.access_token || "");
  const expiresIn = Number(json.expires_in || 3600);

  if (!accessToken) throw new Error("Missing access_token from OAuth response");

  cachedToken = {
    token: accessToken,
    expMs: Date.now() + expiresIn * 1000,
  };

  return accessToken;
}

function getServiceAccountFromEnv(env) {
  // Preferred: Base64 JSON
  const b64 = String(env.FIREBASE_SERVICE_ACCOUNT_B64 || "").trim();
  if (b64) {
    const jsonStr = atob(b64);
    return JSON.parse(jsonStr);
  }

  // Optional: raw JSON (not recommended if multi-line issues)
  const raw = String(env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (raw) return JSON.parse(raw);

  return null;
}

async function sendFcmV1({ accessToken, projectId, token, title, body, data }) {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const payload = {
    message: {
      token,
      notification: { title, body },
      data: safeStringifyData({ ...data, url: data?.url || "/" }),
      // Optional webpush link behavior (if you handle it on SW)
      // webpush: { fcmOptions: { link: data?.url || "/" } }
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const txt = await res.text();
  if (!res.ok) {
    // FCM may return 404/400 for invalid/unregistered tokens
    return { ok: false, status: res.status, error: txt };
  }

  return { ok: true };
}

export async function onRequestPost({ request, env }) {
  try {
    const JWT_SECRET = String(env.JWT_SECRET || "").trim();
    if (!JWT_SECRET) return fail("Missing JWT_SECRET", 500);

    // ✅ Service Account instead of FCM_SERVER_KEY
    const serviceAccount = getServiceAccountFromEnv(env);
    if (!serviceAccount) {
      return fail("Missing FIREBASE_SERVICE_ACCOUNT_B64 (or FIREBASE_SERVICE_ACCOUNT_JSON)", 500);
    }

    const projectId =
      String(env.FIREBASE_PROJECT_ID || "").trim() ||
      String(serviceAccount.project_id || "").trim();

    if (!projectId) return fail("Missing FIREBASE_PROJECT_ID", 500);

    const tokenCookie = getCookie(request, COOKIE_NAME);
    if (!tokenCookie) return fail("Unauthorized", 401);

    const v = await verifyJwt(tokenCookie, JWT_SECRET);
    if (!v.ok) return fail("Unauthorized", 401);

    const me = v.payload || {};
    if (String(me.role || "").trim() !== "مدير") {
      return fail("Forbidden", 403);
    }

    const bodyJson = await request.json().catch(() => ({}));
    const title = String(bodyJson.title || "إشعار").trim();
    const msg = String(bodyJson.body || "").trim();
    const toRole = String(bodyJson.toRole || "").trim(); // "مدير" أو فارغ للجميع
    const data = bodyJson.data && typeof bodyJson.data === "object" ? bodyJson.data : {};

    const rows = await listPushTokens(env, { role: toRole, enabledOnly: true });
    const tokens = rows.map((r) => r.fcm_token).filter(Boolean);

    if (!tokens.length) return ok({ sent: 0, note: "no tokens" });

    const accessToken = await getAccessTokenFromServiceAccount(serviceAccount);

    // إرسال مع توازي محدود (بدل batch legacy)
    const CONCURRENCY = 25; // عدّلها حسب الحاجة
    const results = await mapWithConcurrency(tokens, CONCURRENCY, async (t) => {
      return await sendFcmV1({
        accessToken,
        projectId,
        token: t,
        title,
        body: msg,
        data,
      });
    });

    const sent = results.filter((r) => r && r.ok).length;
    const failed = results.filter((r) => !r?.ok).length;

    return ok({
      sent,
      failed,
      totalTokens: tokens.length,
      note: failed ? "Some tokens failed (may be invalid/unregistered)" : undefined,
    });
  } catch (e) {
    return fail(e?.message || String(e), 500);
  }
}

