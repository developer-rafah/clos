// app.js
import { renderLoading, renderLogin, bindLogin, renderAgentPage, bindAgent, bindCommon } from "./ui.js";
import * as Auth from "./auth.js";
import { api } from "./api.js";

let state = {
  user: null,
  view: "assigned", // agent: assigned|closed
  q: "",
  kpis: null,
  items: [],
  error: "",
};

function getRoot() {
  return document.getElementById("app") || document.body;
}

function setHTML(html) {
  getRoot().innerHTML = html;
}

async function safeMe() {
  try {
    const out = await Auth.me();
    return out;
  } catch (e) {
    throw e;
  }
}

function normalizeRole(r) {
  const s = String(r || "").toLowerCase();
  if (s.includes("admin") || s.includes("مدير")) return "admin";
  if (s.includes("staff") || s.includes("موظف")) return "staff";
  if (s.includes("agent") || s.includes("مندوب")) return "agent";
  return s || "agent";
}

async function loadAgentData() {
  // ✅ view=assigned يجب أن يشمل status NULL
  const qp = new URLSearchParams();
  qp.set("view", state.view);
  if (state.q) qp.set("q", state.q);

  const out = await api.get(`/requests?${qp.toString()}`);
  state.items = out.items || [];
  state.kpis = out.kpis || null;
}

function renderAgent() {
  setHTML(
    renderAgentPage({
      user: state.user,
      items: state.items,
      view: state.view,
      q: state.q,
      kpis: state.kpis,
      error: state.error,
    })
  );

  bindCommon(getRoot(), {
    onLogout: () => {
      Auth.logout();
      boot(); // يرجع للـ login
    },
    onRefresh: () => boot(),
  });

  bindAgent(getRoot(), {
    onSwitchView: async (v) => {
      state.view = v;
      await refreshAgent();
    },
    onSearch: async (q) => {
      state.q = q;
      await refreshAgent(false);
    },
    onSaveWeight: async (id, weight) => {
      try {
        setHTML(renderLoading("جاري حفظ الوزن..."));
        await api.patch(`/requests/${encodeURIComponent(id)}`, { weight: Number(weight || 0) });
        await refreshAgent(true);
      } catch (e) {
        state.error = e.message || "فشل حفظ الوزن";
        await refreshAgent(true);
      }
    },
    onClose: async (id) => {
      try {
        setHTML(renderLoading("جاري إغلاق الطلب..."));
        await api.patch(`/requests/${encodeURIComponent(id)}`, { status: "مكتمل", closed_at: new Date().toISOString() });
        await refreshAgent(true);
      } catch (e) {
        state.error = e.message || "فشل إغلاق الطلب";
        await refreshAgent(true);
      }
    },
  });
}

async function refreshAgent(showLoading = true) {
  state.error = "";
  if (showLoading) setHTML(renderLoading("جاري تحميل الطلبات..."));
  await loadAgentData();
  renderAgent();
}

function showLogin(error = "") {
  setHTML(renderLogin({ error }));
  bindLogin(getRoot(), {
    onLogin: async (username, password) => {
      setHTML(renderLoading("جاري تسجيل الدخول..."));
      try {
        const out = await Auth.login(username, password);
        state.user = { ...(out.user || {}), role: normalizeRole(out.role || out.user?.role) };
        await boot();
      } catch (e) {
        showLogin(e.message || "Unauthorized");
      }
    },
    onRetry: () => boot(),
  });
}

async function boot() {
  setHTML(renderLoading());

  try {
    const meOut = await safeMe();
    const user = meOut.user || {};
    user.role = normalizeRole(meOut.role || user.role);

    state.user = user;

    // حسب الدور (حالياً نعرض agent فقط هنا؛ الموظف/المدير سأضع لك Backend جاهز تحت)
    if (user.role === "agent") {
      state.view = state.view || "assigned";
      await refreshAgent(true);
      return;
    }

    // إن لم تكن مندوب: أعرض رسالة بسيطة (إلى أن تضع صفحات staff/admin في UI لاحقاً)
    setHTML(`
      <div class="card">
        <h2>تم تسجيل الدخول</h2>
        <p>الدور الحالي: <b>${user.role}</b></p>
        <p>تم تجهيز الـ API للموظف/المدير بالأسفل. إذا تريد أركّب لك UI كامل لهم ضمن نفس ui.js/app.js قولّي.</p>
        <button id="btnLogout">تسجيل الخروج</button>
      </div>
    `);
    bindCommon(getRoot(), { onLogout: () => { Auth.logout(); boot(); }, onRefresh: () => boot() });
  } catch (e) {
    // ✅ يمنع التعليق على loading
    showLogin(e?.message === "Unauthorized" ? "" : (e?.message || "Unauthorized"));
  }
}

document.addEventListener("DOMContentLoaded", boot);
window.addEventListener("hashchange", boot);
