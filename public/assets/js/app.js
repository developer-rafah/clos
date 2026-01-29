// app.js
import * as UI from "./ui.js";
import * as Auth from "./auth.js";
import { apiGet, apiPatch, apiPost } from "./api.js";
import { getRoute, goto, roleHome } from "./router.js";

const root = document.getElementById("app") || document.body;

const state = {
  user: null,
  view: "",
  q: "",
  offset: 0,
  limit: 20,
  items: [],
  pagination: null,
  agents: [],
  stats: {},
  loading: false,
  role: "",
};

function setHTML(html) {
  root.innerHTML = html;
}

function roleKey(role) {
  if (role === "مندوب") return "agent";
  if (role === "موظف") return "staff";
  if (role === "مدير") return "admin";
  return role || "admin";
}

function parseDefaultView(role) {
  if (role === "agent") return "assigned";
  if (role === "staff") return "new";
  return "all";
}

function safeMsg(err) {
  return err?.message || "حدث خطأ غير متوقع";
}

async function loadAgentsIfNeeded(role) {
  if (role === "agent") return [];
  // جلب المندوبين للاسناد
  const out = await apiGet("/api/users", { query: { role: "agent" } }).catch(() => ({ items: [] }));
  return out?.items || out?.users || [];
}

async function loadStatsIfSupported(role) {
  // لو عندك endpoint stats لاحقًا؛ الآن نعملها من counts عبر requests?view=...&limit=0
  // لتخفيف الضغط: نجيب count فقط من pagination.count
  async function count(view) {
    const out = await apiGet("/api/requests", { query: { view, limit: 1, offset: 0 } });
    return out?.pagination?.count ?? (out?.items?.length ?? 0);
  }

  if (role === "agent") return {};
  const [n, a, c, t] = await Promise.all([
    count("new").catch(() => 0),
    count("assigned").catch(() => 0),
    count("closed").catch(() => 0),
    count("all").catch(() => 0),
  ]);
  return { new: n, assigned: a, closed: c, total: t };
}

async function loadRequests({ role, view, q, offset, limit }) {
  const out = await apiGet("/api/requests", {
    query: { view, q, offset, limit },
  });
  return out;
}

function renderPage({ error } = {}) {
  const role = state.role;
  const payload = {
    user: state.user,
    items: state.items,
    view: state.view,
    q: state.q,
    pagination: state.pagination,
    agents: state.agents,
    stats: state.stats,
    error: error || "",
  };

  if (role === "agent") return UI.renderAgent(payload);
  if (role === "staff") return UI.renderStaff(payload);
  return UI.renderAdmin(payload);
}

async function ensureAuth() {
  if (state.user) return state.user;
  try {
    const u = await Auth.me();
    if (!u) throw new Error("Unauthorized");
    state.user = u;
    state.role = roleKey(u.role);
    return u;
  } catch {
    state.user = null;
    state.role = "";
    return null;
  }
}

function showLogin(error) {
  setHTML(UI.renderLogin({ error }));
  UI.bindLogin(root, async (username, password) => {
    setHTML(UI.renderLoading("... جاري تسجيل الدخول"));
    const u = await Auth.login(username, password);
    if (!u) throw new Error("بيانات الدخول غير صحيحة");
    state.user = u;
    state.role = roleKey(u.role);
    goto(roleHome(state.role), {});
    await route();
  });
}

async function route() {
  if (state.loading) return;
  state.loading = true;

  try {
    const u = await ensureAuth();
    if (!u) {
      showLogin();
      return;
    }

    const { path, query } = getRoute();
    const role = state.role;

    // حماية المسارات
    const wanted =
      path === "/agent" || path === "/staff" || path === "/admin"
        ? path
        : roleHome(role);

    if (path !== wanted) {
      goto(wanted, query);
      state.loading = false;
      return;
    }

    // view/q/pagination
    state.view = query.view || parseDefaultView(role);
    state.q = query.q || "";
    state.offset = Number(query.offset || 0) || 0;
    state.limit = Number(query.limit || state.limit) || state.limit;

    setHTML(UI.renderLoading("... جاري التحميل"));

    // تحميل بيانات مساعدة
    state.agents = await loadAgentsIfNeeded(role).catch(() => []);
    state.stats = await loadStatsIfSupported(role).catch(() => ({}));

    const out = await loadRequests({
      role,
      view: state.view,
      q: state.q,
      offset: state.offset,
      limit: state.limit,
    });

    state.items = out?.items || [];
    state.pagination = out?.pagination || {
      limit: state.limit,
      offset: state.offset,
      count: state.items.length,
    };

    setHTML(renderPage());
  } catch (err) {
    // أهم شيء: لا تترك الشاشة على "جاري التحميل"
    setHTML(renderPage({ error: safeMsg(err) }));
  } finally {
    state.loading = false;
  }
}

// ============ Actions (Event Delegation) ============
function getSearchValue() {
  return root.querySelector('input[data-role="search"]')?.value?.trim() || "";
}

async function doRefresh({ keepOffset = false } = {}) {
  const { path } = getRoute();
  const q = getSearchValue();
  goto(path, {
    view: state.view,
    q,
    offset: keepOffset ? state.offset : 0,
    limit: state.limit,
  });
  await route();
}

async function doLoadMore() {
  const { path } = getRoute();
  const nextOffset = (state.pagination?.offset ?? state.offset) + (state.pagination?.limit ?? state.limit);
  goto(path, {
    view: state.view,
    q: state.q,
    offset: nextOffset,
    limit: state.limit,
  });
  await route();
}

async function doSetView(view) {
  const { path } = getRoute();
  goto(path, { view, q: state.q, offset: 0, limit: state.limit });
  await route();
}

async function doAssign(id) {
  const sel = root.querySelector(`select[data-id="${CSS.escape(id)}"][data-role="agentSelect"]`);
  const agent_username = sel?.value || "";
  if (!agent_username) throw new Error("اختر مندوب أولاً");

  // ✅ نعتمد agent_name كـ “المعرف” (username) لضمان الثبات
  await apiPatch(`/api/requests/${encodeURIComponent(id)}`, { agent_name: agent_username });
}

async function doSaveWeight(id) {
  const inp = root.querySelector(`input[data-id="${CSS.escape(id)}"][data-role="weightInput"]`);
  const weight = inp?.value ?? "";
  if (weight === "") throw new Error("أدخل الوزن أولاً");
  await apiPatch(`/api/requests/${encodeURIComponent(id)}`, { weight });
}

async function doClose(id) {
  await apiPatch(`/api/requests/${encodeURIComponent(id)}`, { close: true });
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  try {
    if (action === "logout") {
      Auth.logout();
      state.user = null;
      state.role = "";
      showLogin("تم تسجيل الخروج");
      return;
    }

    if (action === "refresh") {
      await doRefresh();
      return;
    }

    if (action === "loadMore") {
      await doLoadMore();
      return;
    }

    if (action === "setView") {
      await doSetView(btn.dataset.view || "");
      return;
    }

    if (action === "reqAssign") {
      setHTML(UI.renderLoading("... جاري الإسناد"));
      await doAssign(id);
      await doRefresh({ keepOffset: false });
      return;
    }

    if (action === "reqWeight") {
      setHTML(UI.renderLoading("... جاري حفظ الوزن"));
      await doSaveWeight(id);
      await doRefresh({ keepOffset: true });
      return;
    }

    if (action === "reqClose") {
      setHTML(UI.renderLoading("... جاري إغلاق الطلب"));
      await doClose(id);
      await doRefresh({ keepOffset: false });
      return;
    }

    if (action === "enablePush") {
      // عندك push.js ممكن تربطه هنا لاحقاً
      alert("ميزة الإشعارات تعتمد على Service Worker (يمكن تفعيلها لاحقاً).");
      return;
    }
  } catch (err) {
    // لا تترك المستخدم على Loading
    setHTML(renderPage({ error: safeMsg(err) }));
  }
});

document.addEventListener("keydown", async (e) => {
  // Enter في البحث
  if (e.key === "Enter" && e.target && e.target.matches('input[data-role="search"]')) {
    e.preventDefault();
    await doRefresh();
  }
});

window.addEventListener("hashchange", route);

(async function boot() {
  // افتراضي
  if (!location.hash) location.hash = "#/";
  await route();
})();
