// app.js (APP MODULE) - Robust + No Infinite Loading
// يعتمد على Namespace imports لتجنب انهيار التطبيق عند نقص export في ui.js
// ويضيف Timeout + Error Handling حتى لا تبقى "جاري التحميل" للأبد.

import * as UI from "./ui.js";
import * as Router from "./router.js";
import * as Auth from "./auth.js";
import * as Api from "./api.js";
import * as Config from "./app-config.js";
import * as Push from "./push.js";

const APP_EL = document.getElementById("app") || document.body;

const TOKEN_KEY_FALLBACK = "CLOS_TOKEN_V1";
const REQUEST_TIMEOUT_MS = 15000;

const state = {
  user: null,
  pushStatus: { supported: false, enabled: false },
  agent: { view: "assigned", q: "", limit: 200 },
  staff: { view: "new", q: "", limit: 200 },
  admin: { view: "all", q: "", limit: 200 },
};

function setHtml(html) {
  APP_EL.innerHTML = html || "";
}

function defaultLoading(text = "جاري التحميل ...") {
  return `
    <div class="shell">
      <div style="display:flex;align-items:center;justify-content:center;min-height:60vh;color:#fff;opacity:.9">
        <div style="text-align:center">
          <div style="width:46px;height:46px;border-radius:50%;border:4px solid rgba(255,255,255,.25);border-top-color:#7c5cff;display:inline-block;animation:spin 1s linear infinite"></div>
          <div style="margin-top:14px;font-size:18px">${escapeHtml(text)}</div>
        </div>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}} .shell{padding:24px}</style>
    </div>
  `;
}

function defaultErrorScreen(title, message) {
  return `
    <div style="padding:24px;color:#fff">
      <h2 style="margin:0 0 8px 0">${escapeHtml(title || "حدث خطأ")}</h2>
      <div style="opacity:.9;line-height:1.6">${escapeHtml(message || "")}</div>
      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
        <button id="btnReload" style="padding:10px 14px;border-radius:12px;border:0;background:#7c5cff;color:#fff;cursor:pointer">إعادة المحاولة</button>
        <button id="btnToLogin" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;cursor:pointer">تسجيل الدخول</button>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getToken() {
  // حاول من auth.js إن كانت توفر دالة، وإلا fallback على localStorage
  if (typeof Auth.getToken === "function") return Auth.getToken();
  return localStorage.getItem(TOKEN_KEY_FALLBACK);
}

function setToken(token) {
  if (typeof Auth.setToken === "function") return Auth.setToken(token);
  if (token) localStorage.setItem(TOKEN_KEY_FALLBACK, token);
}

function clearToken() {
  if (typeof Auth.clearToken === "function") return Auth.clearToken();
  localStorage.removeItem(TOKEN_KEY_FALLBACK);
}

async function fetchJson(url, { method = "GET", body, auth = true, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = { "Content-Type": "application/json" };
    if (auth) {
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { ok: false, success: false, error: text || `HTTP ${res.status}` };
    }

    if (!res.ok || json?.ok === false || json?.success === false) {
      const msg = json?.error || json?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return json;
  } finally {
    clearTimeout(t);
  }
}

// واجهات API: إذا api.js يوفر apiGet/apiPost/apiPatch استخدمها، وإلا fallback على fetchJson
async function apiGet(path) {
  if (typeof Api.apiGet === "function") return Api.apiGet(path);
  return fetchJson(path, { method: "GET" });
}
async function apiPost(path, body) {
  if (typeof Api.apiPost === "function") return Api.apiPost(path, body);
  return fetchJson(path, { method: "POST", body });
}
async function apiPatch(path, body) {
  if (typeof Api.apiPatch === "function") return Api.apiPatch(path, body);
  return fetchJson(path, { method: "PATCH", body });
}

function roleToHome(role) {
  if (typeof Router.roleToHome === "function") return Router.roleToHome(role);
  if (role === "admin" || role === "مدير") return "#/admin";
  if (role === "staff" || role === "موظف") return "#/staff";
  return "#/agent";
}
function goto(hash) {
  if (typeof Router.goto === "function") return Router.goto(hash);
  window.location.hash = hash;
}
function getRoute() {
  if (typeof Router.getRoute === "function") return Router.getRoute();
  return window.location.hash || "#/";
}
function parseRoute(hash) {
  if (typeof Router.parseRoute === "function") return Router.parseRoute(hash);
  const clean = (hash || "#/").replace(/^#\/?/, "");
  const [name, ...rest] = clean.split("/");
  return { name: name || "root", parts: rest };
}

function renderLoading(msg) {
  return (typeof UI.renderLoading === "function" ? UI.renderLoading(msg) : defaultLoading(msg));
}

function showError(title, err) {
  const msg = (err && (err.message || String(err))) || "غير معروف";
  setHtml(defaultErrorScreen(title, msg));
  const r = document.getElementById("btnReload");
  const l = document.getElementById("btnToLogin");
  r?.addEventListener("click", () => safeRender(renderCurrentRoute));
  l?.addEventListener("click", () => showLogin());
  console.error(err);
}

async function loadPushStatus() {
  try {
    state.pushStatus.supported = typeof Push.getPushStatus === "function";
    if (typeof Push.getPushStatus === "function") {
      state.pushStatus = await Push.getPushStatus();
    }
  } catch (e) {
    // لا تمنع التطبيق
    console.warn("push status error:", e);
  }
}

function showLogin(errorText = "") {
  const html =
    (typeof UI.renderLogin === "function" && UI.renderLogin({ error: errorText })) ||
    `
      <div style="padding:24px;color:#fff;max-width:420px;margin:0 auto">
        <h2 style="margin:0 0 14px 0">تسجيل الدخول</h2>
        <form id="loginForm" style="display:grid;gap:10px">
          <input id="username" placeholder="اسم المستخدم" style="padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.2);color:#fff" />
          <input id="password" type="password" placeholder="كلمة المرور" style="padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.2);color:#fff" />
          <button type="submit" style="padding:12px;border-radius:12px;border:0;background:#7c5cff;color:#fff;cursor:pointer">دخول</button>
          <div id="loginError" style="color:#ffb4b4;min-height:20px">${escapeHtml(errorText)}</div>
        </form>
      </div>
    `;

  setHtml(html);

  // إن كانت ui.js توفر bindLogin استعملها، وإلا bind يدوي
  if (typeof UI.bindLogin === "function") {
    try {
      UI.bindLogin({
        onSubmit: async ({ username, password }) => {
          await doLogin(username, password);
        },
      });
      return;
    } catch (e) {
      console.warn("UI.bindLogin failed, fallback manual binding:", e);
    }
  }

  const form = document.getElementById("loginForm");
  const errEl = document.getElementById("loginError");
  form?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    errEl.textContent = "";
    const username = document.getElementById("username")?.value?.trim();
    const password = document.getElementById("password")?.value ?? "";
    if (!username || !password) {
      errEl.textContent = "يرجى إدخال اسم المستخدم وكلمة المرور";
      return;
    }
    try {
      await doLogin(username, password);
    } catch (e) {
      errEl.textContent = e?.message || "فشل تسجيل الدخول";
    }
  });
}

async function doLogin(username, password) {
  setHtml(renderLoading("جاري تسجيل الدخول ..."));
  let out;
  if (typeof Auth.login === "function") {
    out = await Auth.login(username, password);
  } else {
    out = await apiPost("/api/auth/login", { username, password });
  }
  if (out?.token) setToken(out.token);
  // user قد يرجع داخل out.user أو داخل out.data
  state.user = out?.user || out?.data?.user || out?.user || null;
  if (!state.user) {
    // إذا لم يرجع user، اجلبه من /me
    const meOut = await apiGet("/api/auth/me");
    state.user = meOut?.user || meOut;
  }
  await loadPushStatus();
  goto(roleToHome(state.user.role));
  await safeRender(renderCurrentRoute);
}

async function doLogout() {
  try {
    if (typeof Auth.logout === "function") await Auth.logout();
  } catch {}
  clearToken();
  state.user = null;
  showLogin();
}

async function getMe() {
  if (typeof Auth.me === "function") return Auth.me();
  const out = await apiGet("/api/auth/me");
  return out?.user || out;
}

function bindGlobalActions() {
  // Event Delegation: أي UI (قديمة/جديدة) نلتقط الأزرار
  APP_EL.onclick = async (ev) => {
    const a = ev.target.closest("[data-action]");
    if (!a) return;

    const action = a.dataset.action;
    const id = a.dataset.id;

    try {
      switch (action) {
        case "logout":
          await doLogout();
          return;

        case "agentTab":
          state.agent.view = a.dataset.view || "assigned";
          await safeRender(renderCurrentRoute);
          return;

        case "agentRefresh":
          await safeRender(renderCurrentRoute);
          return;

        case "staffTab":
          state.staff.view = a.dataset.view || "new";
          await safeRender(renderCurrentRoute);
          return;

        case "adminTab":
          state.admin.view = a.dataset.view || "all";
          await safeRender(renderCurrentRoute);
          return;

        case "reqCall": {
          const phone = a.dataset.phone;
          if (phone) window.open(`tel:${phone}`, "_self");
          return;
        }

        case "reqWhatsapp": {
          const phone = (a.dataset.phone || "").replace(/\D/g, "");
          if (phone) window.open(`https://wa.me/${phone}`, "_blank");
          return;
        }

        case "reqMap": {
          const lat = a.dataset.lat;
          const lng = a.dataset.lng;
          if (lat && lng) {
            window.open(`https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`, "_blank");
          }
          return;
        }

        case "reqSaveWeight": {
          if (!id) return;
          // ابحث عن input الوزن داخل نفس البطاقة أو عبر selector عام
          const card = a.closest("[data-req-card]") || document;
          const input =
            card.querySelector(`[data-weight-input="${id}"]`) ||
            card.querySelector(`input[name="weight"]`) ||
            document.getElementById(`weight-${id}`);
          const weightVal = input?.value;
          const weight = weightVal !== undefined ? Number(weightVal) : NaN;
          if (!Number.isFinite(weight) || weight < 0) throw new Error("الوزن غير صحيح");

          await apiPatch(`/api/requests/${encodeURIComponent(id)}`, { weight });
          await safeRender(renderCurrentRoute);
          return;
        }

        case "reqClose": {
          if (!id) return;
          // اغلاق الطلب (مكتمل)
          await apiPatch(`/api/requests/${encodeURIComponent(id)}`, { status: "مكتمل" });
          await safeRender(renderCurrentRoute);
          return;
        }

        default:
          return;
      }
    } catch (e) {
      alert(e?.message || "حدث خطأ");
      console.error(e);
    }
  };
}

async function renderAgent() {
  const user = state.user;
  setHtml(renderLoading("تحميل طلبات المندوب ..."));

  const q = (state.agent.q || "").trim();
  const view = state.agent.view || "assigned";
  const limit = state.agent.limit || 200;

  const qs = new URLSearchParams();
  qs.set("view", view); // assigned | closed | all
  qs.set("limit", String(limit));
  if (q) qs.set("q", q);

  const out = await apiGet(`/api/requests?${qs.toString()}`);
  const items = out?.items || [];
  const pagination = out?.pagination || null;

  const html =
    (typeof UI.renderAgent === "function" &&
      UI.renderAgent({
        user,
        items,
        view,
        q,
        pagination,
        pushStatus: state.pushStatus,
        error: "",
      })) ||
    `
      <div style="padding:24px;color:#fff">
        <h2 style="margin:0 0 8px 0">لوحة المندوب</h2>
        <div style="opacity:.85;margin-bottom:14px">مرحبًا ${escapeHtml(user?.name || user?.username || "")}</div>
        <pre style="white-space:pre-wrap;background:rgba(0,0,0,.25);padding:12px;border-radius:12px">${escapeHtml(
          JSON.stringify(items, null, 2)
        )}</pre>
      </div>
    `;

  setHtml(html);

  // دعم واجهات قديمة إن وُجدت
  const btnLogout = document.getElementById("btnLogout");
  btnLogout?.addEventListener("click", doLogout);

  const search = document.getElementById("agentSearch");
  const btnSearch = document.getElementById("btnAgentSearch");
  const btnAssigned = document.getElementById("btnAgentAssigned");
  const btnClosed = document.getElementById("btnAgentClosed");
  const btnRefresh = document.getElementById("btnAgentRefresh");

  btnRefresh?.addEventListener("click", () => safeRender(renderCurrentRoute));
  btnAssigned?.addEventListener("click", () => {
    state.agent.view = "assigned";
    safeRender(renderCurrentRoute);
  });
  btnClosed?.addEventListener("click", () => {
    state.agent.view = "closed";
    safeRender(renderCurrentRoute);
  });
  btnSearch?.addEventListener("click", () => {
    state.agent.q = search?.value || "";
    safeRender(renderCurrentRoute);
  });
}

async function renderStaff() {
  const user = state.user;
  setHtml(renderLoading("تحميل لوحة الموظف ..."));

  const q = (state.staff.q || "").trim();
  const view = state.staff.view || "new";
  const limit = state.staff.limit || 200;

  const qs = new URLSearchParams();
  qs.set("view", view);
  qs.set("limit", String(limit));
  if (q) qs.set("q", q);

  let out;
  try {
    out = await apiGet(`/api/requests?${qs.toString()}`);
  } catch (e) {
    // مثال معروف عندك: Missing area_code...
    const html =
      (typeof UI.renderStaff === "function" &&
        UI.renderStaff({
          user,
          items: [],
          view,
          q,
          pagination: null,
          error: e?.message || "خطأ",
        })) ||
      defaultErrorScreen("لوحة الموظف", e?.message || "تعذر تحميل البيانات");
    setHtml(html);
    document.getElementById("btnReload")?.addEventListener("click", () => safeRender(renderCurrentRoute));
    document.getElementById("btnToLogin")?.addEventListener("click", showLogin);
    return;
  }

  const items = out?.items || [];
  const pagination = out?.pagination || null;

  const html =
    (typeof UI.renderStaff === "function" &&
      UI.renderStaff({
        user,
        items,
        view,
        q,
        pagination,
        error: "",
      })) ||
    `
      <div style="padding:24px;color:#fff">
        <h2 style="margin:0 0 8px 0">لوحة الموظف</h2>
        <pre style="white-space:pre-wrap;background:rgba(0,0,0,.25);padding:12px;border-radius:12px">${escapeHtml(
          JSON.stringify(items, null, 2)
        )}</pre>
      </div>
    `;

  setHtml(html);
  document.getElementById("btnLogout")?.addEventListener("click", doLogout);
}

async function renderAdmin() {
  const user = state.user;
  setHtml(renderLoading("تحميل لوحة المدير ..."));

  const q = (state.admin.q || "").trim();
  const view = state.admin.view || "all";
  const limit = state.admin.limit || 200;

  const qs = new URLSearchParams();
  qs.set("view", view);
  qs.set("limit", String(limit));
  if (q) qs.set("q", q);

  let out;
  try {
    out = await apiGet(`/api/requests?${qs.toString()}`);
  } catch (e) {
    const html =
      (typeof UI.renderAdmin === "function" &&
        UI.renderAdmin({
          user,
          items: [],
          view,
          q,
          pagination: null,
          kpis: null,
          agents: [],
          error: e?.message || "خطأ",
        })) ||
      defaultErrorScreen("لوحة المدير", e?.message || "تعذر تحميل البيانات");
    setHtml(html);
    document.getElementById("btnReload")?.addEventListener("click", () => safeRender(renderCurrentRoute));
    document.getElementById("btnToLogin")?.addEventListener("click", showLogin);
    return;
  }

  const items = out?.items || [];
  const pagination = out?.pagination || null;

  // مؤشرات بسيطة من نفس البيانات (بدون اعتماد على backend)
  const kpis = {
    total: items.length,
    new: items.filter((x) => x?.status === "جديد").length,
    assigned: items.filter((x) => x?.status === "مسند").length,
    closed: items.filter((x) => x?.status === "مكتمل").length,
    cancelled: items.filter((x) => x?.status === "ملغي").length,
  };

  // اجلب المستخدمين (إن كان endpoint موجود)
  let agents = [];
  try {
    const u = await apiGet("/api/users?role=agent&limit=500");
    agents = u?.items || u?.users || [];
  } catch {
    agents = [];
  }

  const html =
    (typeof UI.renderAdmin === "function" &&
      UI.renderAdmin({
        user,
        items,
        view,
        q,
        pagination,
        kpis,
        agents,
        error: "",
      })) ||
    `
      <div style="padding:24px;color:#fff">
        <h2 style="margin:0 0 8px 0">لوحة المدير</h2>
        <div style="opacity:.85;margin-bottom:14px">الإجمالي: ${kpis.total} | جديد: ${kpis.new} | مسند: ${kpis.assigned} | مكتمل: ${kpis.closed}</div>
        <pre style="white-space:pre-wrap;background:rgba(0,0,0,.25);padding:12px;border-radius:12px">${escapeHtml(
          JSON.stringify(items, null, 2)
        )}</pre>
      </div>
    `;

  setHtml(html);
  document.getElementById("btnLogout")?.addEventListener("click", doLogout);
}

async function renderCurrentRoute() {
  if (!state.user) {
    showLogin();
    return;
  }

  const user = state.user;
  const route = parseRoute(getRoute());

  // لو المستخدم على root حوله تلقائيًا
  if (!route?.name || route.name === "root") {
    goto(roleToHome(user.role));
    return;
  }

  // حماية من عدم تطابق الدور مع الصفحة
  const role = String(user.role || "").toLowerCase();
  if (route.name === "admin" && !(role.includes("admin") || user.role === "مدير")) {
    goto(roleToHome(user.role));
    return;
  }
  if (route.name === "staff" && !(role.includes("staff") || user.role === "موظف")) {
    goto(roleToHome(user.role));
    return;
  }
  if (route.name === "agent" && !(role.includes("agent") || user.role === "مندوب")) {
    goto(roleToHome(user.role));
    return;
  }

  // Render
  if (route.name === "agent") return renderAgent();
  if (route.name === "staff") return renderStaff();
  if (route.name === "admin") return renderAdmin();

  // أي route غير معروف → بدل ترك التحميل، اعرض خطأ واضح
  setHtml(defaultErrorScreen("Route غير معروف", `المسار الحالي: ${route.name}`));
  document.getElementById("btnReload")?.addEventListener("click", () => safeRender(renderCurrentRoute));
  document.getElementById("btnToLogin")?.addEventListener("click", showLogin);
}

async function safeRender(fn) {
  try {
    await fn();
  } catch (e) {
    showError("حدث خطأ أثناء العرض", e);
  }
}

async function boot() {
  // لا تترك تحميل بلا نهاية إذا حدث أي خطأ غير ملتقط
  window.addEventListener("unhandledrejection", (e) => {
    e.preventDefault?.();
    showError("Unhandled Promise Rejection", e.reason || e);
  });
  window.addEventListener("error", (e) => {
    showError("JavaScript Error", e.error || e.message || e);
  });

  setHtml(renderLoading("جاري التحميل ..."));

  // تحميل config إن وُجد (لا تفشل التطبيق لو لم يوجد)
  try {
    if (typeof Config.loadAppConfig === "function") await Config.loadAppConfig();
    if (typeof Api.setBaseUrlFromConfig === "function") Api.setBaseUrlFromConfig();
  } catch (e) {
    console.warn("config load warning:", e);
  }

  bindGlobalActions();

  // جلسة المستخدم
  try {
    state.user = await getMe();
  } catch {
    state.user = null;
  }

  if (!state.user) {
    showLogin();
    return;
  }

  await loadPushStatus();

  // لو على root → حوله
  const route = parseRoute(getRoute());
  if (!route?.name || route.name === "root") goto(roleToHome(state.user.role));

  await safeRender(renderCurrentRoute);

  window.addEventListener("hashchange", () => safeRender(renderCurrentRoute));
}

boot().catch((e) => showError("فشل تشغيل التطبيق", e));
