import { loadAppConfig } from "./app-config.js";

const LS_TOKEN = "CLOS_AUTH_TOKEN_V1";
const LS_ME    = "CLOS_AUTH_ME_V1";

const el = (id) => document.getElementById(id);

function setVisible(viewId) {
  const views = ["viewLoading", "viewLogin", "viewFrame"];
  for (const v of views) el(v).classList.add("hidden");
  el(viewId).classList.remove("hidden");
}

function setWhoami(me) {
  const who = el("whoami");
  if (!me) { who.textContent = ""; return; }
  const name = me?.name || me?.full_name || me?.username || "";
  const role = me?.role || "";
  who.textContent = `${name}${role ? " — " + role : ""}`;
}

function getStoredToken() {
  return (localStorage.getItem(LS_TOKEN) || "").trim();
}

function storeSession(token, me) {
  localStorage.setItem(LS_TOKEN, token);
  if (me) localStorage.setItem(LS_ME, JSON.stringify(me));
}

function clearSession() {
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_ME);
}

async function gasPostJson(gasUrl, bodyObj) {
  const res = await fetch(gasUrl, {
    method: "POST",
    headers: { "content-type": "application/json;charset=utf-8" },
    body: JSON.stringify(bodyObj || {}),
  });
  const txt = await res.text();
  let data = null;
  try { data = JSON.parse(txt); } catch { data = { ok:false, success:false, error: txt }; }
  return { httpOk: res.ok, status: res.status, data };
}

async function authLogin(gasUrl, username, password) {
  const { data } = await gasPostJson(gasUrl, {
    action: "auth.login",
    payload: { username, password },
  });
  if (!data?.success || !data?.token) throw new Error(data?.error || "Login failed");
  return data;
}

async function authMe(gasUrl, token) {
  const { data } = await gasPostJson(gasUrl, { action: "auth.me", token });
  if (!data?.success) return null;
  return data;
}

async function authLogout(gasUrl, token) {
  // best-effort
  try { await gasPostJson(gasUrl, { action: "auth.logout", token }); } catch {}
}

function buildIframeUrl(gasUrl, token) {
  // نستخدم مدخل واحد في GAS: page=auto (حسب كودك في doGet)
  const u = new URL(gasUrl);
  u.searchParams.set("page", "auto");
  if (token) u.searchParams.set("token", token);
  // ممكن لاحقًا تمرر wrapper=1 أو origin
  return u.toString();
}

function mountIframe(gasUrl, token) {
  const frame = el("appFrame");
  frame.src = buildIframeUrl(gasUrl, token);
}

function wireUiHandlers(state) {
  el("btnReload").addEventListener("click", () => {
    const frame = el("appFrame");
    if (!frame) return;
    // إذا داخل iframe شغال: reload
    try { frame.contentWindow?.location?.reload(); }
    catch { frame.src = frame.src; }
  });

  el("btnLogout").addEventListener("click", async () => {
    el("btnLogout").disabled = true;
    await authLogout(state.gasUrl, state.token);
    clearSession();
    state.token = "";
    state.me = null;
    setWhoami(null);
    el("btnLogout").classList.add("hidden");
    el("appFrame").src = "about:blank";
    setVisible("viewLogin");
    el("btnLogout").disabled = false;
  });

  el("btnClear").addEventListener("click", () => {
    el("inUser").value = "";
    el("inPass").value = "";
    el("loginErr").textContent = "";
    el("inUser").focus();
  });

  el("loginForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    el("loginErr").textContent = "";

    const username = (el("inUser").value || "").trim();
    const password = (el("inPass").value || "").trim();
    if (!username || !password) {
      el("loginErr").textContent = "فضلاً أدخل اسم المستخدم وكلمة المرور";
      return;
    }

    try {
      setVisible("viewLoading");

      const out = await authLogin(state.gasUrl, username, password);
      const token = out.token;
      const me = out.user || out.me || null;

      state.token = token;
      state.me = me;

      storeSession(token, me);
      setWhoami(me);

      el("btnLogout").classList.remove("hidden");

      setVisible("viewFrame");
      mountIframe(state.gasUrl, token);
    } catch (e) {
      setVisible("viewLogin");
      el("loginErr").textContent = (e && e.message) ? e.message : String(e);
    }
  });
}

async function boot() {
  setVisible("viewLoading");

  // 1) load GAS_URL from /app-config.json (Cloudflare env)
  const cfg = await loadAppConfig({ timeoutMs: 7000 });
  const gasUrl = (cfg?.GAS_URL || "").trim();
  if (!gasUrl) throw new Error("Missing GAS_URL from app-config.json");

  const state = { gasUrl, token: "", me: null };
  wireUiHandlers(state);

  // 2) try restore session
  const token = getStoredToken();
  if (!token) {
    setVisible("viewLogin");
    return;
  }

  // 3) validate token via auth.me
  const meRes = await authMe(gasUrl, token);
  if (!meRes) {
    clearSession();
    setVisible("viewLogin");
    return;
  }

  state.token = token;
  state.me = meRes.user || meRes.me || null;

  setWhoami(state.me);
  el("btnLogout").classList.remove("hidden");

  // 4) show iframe (internal system) with page=auto => role routing happens inside GAS
  setVisible("viewFrame");
  mountIframe(gasUrl, token);
}

boot().catch((err) => {
  console.error(err);
  setVisible("viewLogin");
  el("loginErr").textContent = (err && err.message) ? err.message : String(err);
});
