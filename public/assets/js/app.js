// app.js (APP MODULE) - FULL
import { api } from "./api.js";
import * as Auth from "./auth.js";
import * as UI from "./ui.js";
import { getRoute, goto, ensureHomeForRole } from "./router.js";

const ROOT_ID = "app";

const state = {
  user: null,
  roleKey: null, // admin | staff | agent
  view: null, // agent: assigned|closed, staff/admin: new|assigned|closed|all
  q: "",
  limit: 20,
  offset: 0,
  items: [],
  pagination: { limit: 20, offset: 0, count: 0, total: 0 },
  kpis: { total: 0, new: 0, assigned: 0, closed: 0, cancelled: 0 },
  agents: [], // for staff/admin assignment dropdown
  isLoading: false,
  lastError: null,
};

function $(sel, root = document) {
  return root.querySelector(sel);
}

function getRootEl() {
  return document.getElementById(ROOT_ID) || document.body;
}

function setHtml(html) {
  getRootEl().innerHTML = html;
}

function setLoading(on, text = "جاري التحميل ...") {
  state.isLoading = on;
  const overlay = $("#loadingOverlay");
  if (!overlay) return;
  overlay.style.display = on ? "flex" : "none";
  const t = $("#loadingText", overlay);
  if (t) t.textContent = text;
}

function toast(msg, type = "error") {
  UI.toast(msg, type);
}

function safeRoleKey(user) {
  // server returns roleKey, but be defensive
  return user?.roleKey || user?.role || "agent";
}

async function withBusy(fn, loadingText) {
  try {
    setLoading(true, loadingText || "جاري التحميل ...");
    await fn();
  } catch (e) {
    console.error(e);
    state.lastError = e;
    toast(e?.message || "حدث خطأ غير متوقع");
    // لا تترك الصفحة عالقة: اعرض واجهة مع زر إعادة المحاولة
    renderCurrent({ fallbackError: e });
  } finally {
    setLoading(false);
  }
}

async function loadSession() {
  const token = Auth.getToken();
  if (!token) {
    state.user = null;
    state.roleKey = null;
    return;
  }
  const out = await Auth.me(); // throws on 401
  state.user = out.user;
  state.roleKey = safeRoleKey(out.user);
}

function resetList() {
  state.offset = 0;
  state.items = [];
  state.pagination = { limit: state.limit, offset: 0, count: 0, total: 0 };
}

function defaultViewForRole(roleKey) {
  if (roleKey === "agent") return "assigned";
  if (roleKey === "staff") return "new";
  return "all"; // admin
}

async function loadAgentsIfNeeded() {
  if (state.roleKey !== "staff" && state.roleKey !== "admin") return;
  if (state.agents.length) return;
  const out = await api.get("/api/users?role=agent");
  state.agents = Array.isArray(out.items) ? out.items : [];
}

async function fetchRequests({ append = false } = {}) {
  const params = new URLSearchParams();
  params.set("view", state.view || defaultViewForRole(state.roleKey));
  params.set("limit", String(state.limit));
  params.set("offset", String(state.offset));
  if (state.q && state.q.trim()) params.set("q", state.q.trim());

  const out = await api.get(`/api/requests?${params.toString()}`);

  state.kpis = out.kpis || state.kpis;
  state.pagination = out.pagination || state.pagination;

  if (append) state.items = state.items.concat(out.items || []);
  else state.items = out.items || [];

  // مهم: خزّن roleKey لو رجع من السيرفر
  if (out.roleKey) state.roleKey = out.roleKey;
}

function renderCurrent({ fallbackError } = {}) {
  const route = getRoute();
  const user = state.user;
  const roleKey = state.roleKey;

  // لم يسجل دخول
  if (!user || route.name === "login") {
    setHtml(UI.renderLogin({ error: fallbackError?.message || null }));
    return;
  }

  // تأكد المسار مناسب للدور
  ensureHomeForRole(roleKey);

  // بناء الشاشة حسب الدور
  if (roleKey === "agent") {
    setHtml(
      UI.renderAgent({
        user,
        view: state.view,
        q: state.q,
        items: state.items,
        pagination: state.pagination,
        kpis: state.kpis,
      })
    );
    return;
  }

  if (roleKey === "staff") {
    setHtml(
      UI.renderStaff({
        user,
        view: state.view,
        q: state.q,
        items: state.items,
        pagination: state.pagination,
        kpis: state.kpis,
        agents: state.agents,
        error: fallbackError?.message || null,
      })
    );
    return;
  }

  // admin
  setHtml(
    UI.renderAdmin({
      user,
      view: state.view,
      q: state.q,
      items: state.items,
      pagination: state.pagination,
      kpis: state.kpis,
      agents: state.agents,
      error: fallbackError?.message || null,
    })
  );
}

async function route() {
  const route = getRoute();

  await withBusy(async () => {
    await loadSession();

    // لا يوجد جلسة => login
    if (!state.user) {
      if (route.name !== "login") goto("#/login");
      renderCurrent();
      return;
    }

    // يوجد جلسة
    const roleKey = state.roleKey;
    if (route.name === "root") {
      goto(`#/${roleKey}`);
      return;
    }

    // default view
    if (!state.view) state.view = defaultViewForRole(roleKey);

    // تحميل agents لو لزم
    await loadAgentsIfNeeded();

    // تحميل الطلبات
    resetList();
    await fetchRequests({ append: false });

    renderCurrent();
  }, "تحميل البيانات ...");
}

async function doLogin(username, password) {
  await withBusy(async () => {
    const out = await Auth.login(username, password);
    state.user = out.user;
    state.roleKey = safeRoleKey(out.user);
    state.view = defaultViewForRole(state.roleKey);
    state.q = "";
    state.agents = [];
    resetList();

    // توجه للصفحة المناسبة
    goto(`#/${state.roleKey}`);
    await loadAgentsIfNeeded();
    await fetchRequests();
    renderCurrent();
  }, "جاري تسجيل الدخول ...");
}

async function doLogout() {
  await withBusy(async () => {
    Auth.logout();
    state.user = null;
    state.roleKey = null;
    state.view = null;
    state.q = "";
    state.items = [];
    state.agents = [];
    goto("#/login");
    renderCurrent();
  }, "تسجيل الخروج ...");
}

async function assignRequest(id, agentName) {
  // staff/admin فقط
  await withBusy(async () => {
    await api.patch(`/api/requests/${encodeURIComponent(id)}`, {
      agent_name: agentName,
      status: "مسند",
      assigned_at: new Date().toISOString(),
    });

    // بعد الإسناد: أعد التحميل
    resetList();
    await fetchRequests();
    renderCurrent();
    toast("تم إسناد الطلب ✅", "success");
  }, "جاري إسناد الطلب ...");
}

async function closeRequest(id) {
  await withBusy(async () => {
    await api.patch(`/api/requests/${encodeURIComponent(id)}`, {
      status: "مكتمل",
      closed_at: new Date().toISOString(),
    });
    resetList();
    await fetchRequests();
    renderCurrent();
    toast("تم إغلاق الطلب ✅", "success");
  }, "جاري إغلاق الطلب ...");
}

async function saveWeight(id, weight) {
  await withBusy(async () => {
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) throw new Error("الوزن غير صحيح");
    await api.patch(`/api/requests/${encodeURIComponent(id)}`, {
      weight: w,
      updated_at: new Date().toISOString(),
    });
    // تحديث سريع بدون إعادة تحميل كامل
    const item = state.items.find((x) => x.id === id);
    if (item) item.weight = w;
    renderCurrent();
    toast("تم حفظ الوزن ✅", "success");
  }, "جاري حفظ الوزن ...");
}

function onClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;

  // عام
  if (action === "logout") return void doLogout();
  if (action === "retry") return void route();
  if (action === "refresh") {
    return void withBusy(async () => {
      resetList();
      await fetchRequests();
      renderCurrent();
    }, "تحديث ...");
  }

  // Tabs / View
  if (action === "setView") {
    const v = btn.dataset.view;
    if (!v) return;
    state.view = v;
    return void withBusy(async () => {
      resetList();
      await fetchRequests();
      renderCurrent();
    }, "جاري تحميل الطلبات ...");
  }

  // Search
  if (action === "search") {
    const input = $("#searchInput");
    state.q = input ? input.value : "";
    return void withBusy(async () => {
      resetList();
      await fetchRequests();
      renderCurrent();
    }, "بحث ...");
  }

  // Load More
  if (action === "loadMore") {
    state.offset += state.limit;
    return void withBusy(async () => {
      await fetchRequests({ append: true });
      renderCurrent();
    }, "تحميل المزيد ...");
  }

  // Agent actions
  if (action === "closeRequest") {
    const id = btn.dataset.id;
    if (!id) return;
    return void closeRequest(id);
  }

  if (action === "saveWeight") {
    const id = btn.dataset.id;
    if (!id) return;
    const input = $(`#weight-${CSS.escape(id)}`);
    const weight = input ? input.value : "";
    return void saveWeight(id, weight);
  }

  // Staff/Admin assign
  if (action === "assign") {
    const id = btn.dataset.id;
    if (!id) return;
    const sel = $(`#agent-${CSS.escape(id)}`);
    const agentName = sel ? sel.value : "";
    if (!agentName) return void toast("اختر مندوب أولاً");
    return void assignRequest(id, agentName);
  }
}

function onSubmit(e) {
  const form = e.target.closest("form");
  if (!form) return;

  if (form.id === "loginForm") {
    e.preventDefault();
    const username = (form.querySelector('input[name="username"]')?.value || "").trim();
    const password = (form.querySelector('input[name="password"]')?.value || "").trim();
    if (!username || !password) return void toast("أدخل اسم المستخدم وكلمة المرور");
    return void doLogin(username, password);
  }
}

function bindGlobal() {
  const root = getRootEl();

  // Event delegation (حتى لو تغيرت الصفحة بالكامل)
  root.addEventListener("click", onClick);
  root.addEventListener("submit", onSubmit);

  // overlay ثابت حتى لا يضيع عند render
  if (!$("#loadingOverlay")) {
    const overlay = document.createElement("div");
    overlay.id = "loadingOverlay";
    overlay.style.cssText = `
      position:fixed; inset:0; display:none; align-items:center; justify-content:center;
      background:rgba(0,0,0,.35); z-index:9999; backdrop-filter: blur(6px);
    `;
    overlay.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:#fff">
        <div style="width:44px;height:44px;border-radius:50%;border:4px solid rgba(255,255,255,.25);border-top-color:#7b61ff;animation:spin 1s linear infinite"></div>
        <div id="loadingText" style="font-size:18px">جاري التحميل ...</div>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;
    document.body.appendChild(overlay);
  }

  // toast container
  UI.ensureToastRoot();
}

(async function boot() {
  bindGlobal();
  // route on load + hash changes
  window.addEventListener("hashchange", () => route());
  if (!location.hash) goto("#/");
  await route();
})();
