// public/assets/js/app.js

import { loadAppConfig } from "./app-config.js";
import { me, login, logout } from "./auth.js";
import { roleToHome, goto, parseRoute, getRoute } from "./router.js";
import {
  renderLogin,
  bindLogin,
  renderLoading,
  renderAgent,
  renderStaff,
  renderAdmin,
  renderHome,
} from "./ui.js";
import { enablePush, getPushStatus } from "./push.js";

const $app = document.getElementById("app");
const $btnRefresh = document.getElementById("btnRefresh");

const TOKEN_KEY = "CLOS_TOKEN_V1";

function setHtml(html) {
  $app.innerHTML = html;
}

function getToken() {
  try {
    return String(localStorage.getItem(TOKEN_KEY) || "").trim();
  } catch {
    return "";
  }
}

/** Fetch JSON with Bearer token (يحُل 401/403 عند نسيان الهيدر) */
async function fetchJsonAuth(path, { method = "GET", body } = {}) {
  const token = getToken();
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;

  const res = await fetch(path, {
    method,
    cache: "no-store",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // اقرأ JSON أو نص
  const txt = await res.text().catch(() => "");
  let data = {};
  try { data = txt ? JSON.parse(txt) : {}; } catch { data = { raw: txt }; }

  if (!res.ok || data?.ok === false || data?.success === false) {
    const msg = data?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function showLogin(error = "") {
  setHtml(renderLogin({ error }));
  bindLogin($app, async ({ username, password }) => {
    try {
      setHtml(renderLoading("جاري تسجيل الدخول..."));
      const u = await login(username, password);

      // بعد تسجيل الدخول: روح لصفحة الدور
      goto(roleToHome(u.role));
      await renderForUser(u);
    } catch (e) {
      showLogin(e?.message || String(e));
    }
  });
}

/** رندر حسب الدور + حسب route */
async function renderForUser(user) {
  const route = parseRoute(getRoute());

  // لو المستخدم داخل root، وجّهه حسب دوره
  if (route.name === "root") {
    goto(roleToHome(user.role));
    return;
  }

  // حماية: إذا فتح صفحة لا تخص دوره
  const expected = roleToHome(user.role).replace("#/", "");
  if (expected && route.name !== expected) {
    goto(roleToHome(user.role));
    return;
  }

  const pushStatus = await getPushStatus();

  // صفحات حسب الدور
  if (route.name === "agent") {
    // أول رندر (بدون مهام) ثم نجيبها
    setHtml(renderAgent({ user, pushStatus, tasks: [], tasksError: "" }));
    bindCommonTopBar(user);

    const btnRefresh = $app.querySelector("#btnAgentRefresh");
    const btnShow = $app.querySelector("#btnAgentShowTasks");

    const loadTasks = async () => {
      try {
        // API الحقيقي للمهام (عندك يشتغل بـ Bearer)
        const out = await fetchJsonAuth("/api/requests");
        const items = out?.items || out?.data || out?.requests || [];
        setHtml(renderAgent({ user, pushStatus, tasks: items, tasksError: "" }));
        bindCommonTopBar(user);
        bindAgentButtons(user, loadTasks);
      } catch (e) {
        setHtml(renderAgent({ user, pushStatus, tasks: [], tasksError: e?.message || String(e) }));
        bindCommonTopBar(user);
        bindAgentButtons(user, loadTasks);
      }
    };

    const bindAgentButtons = (u, loader) => {
      const r1 = $app.querySelector("#btnAgentRefresh");
      const r2 = $app.querySelector("#btnAgentShowTasks");
      r1?.addEventListener("click", loader);
      r2?.addEventListener("click", loader);
    };

    bindAgentButtons(user, loadTasks);
    // جلب تلقائي أول مرة (بدون تعليق الصفحة إذا فشل)
    loadTasks().catch(() => {});
    return;
  }

  if (route.name === "staff") {
    setHtml(renderStaff({ user, pushStatus }));
    bindCommonTopBar(user);
    // هنا لاحقاً تضع API الموظف
    return;
  }

  if (route.name === "admin") {
    setHtml(renderAdmin({ user, pushStatus }));
    bindCommonTopBar(user);
    // هنا لاحقاً تضع API المدير
    return;
  }

  // fallback
  setHtml(renderHome({ user, pushStatus }));
  bindCommonTopBar(user);
}

function bindCommonTopBar(user) {
  const btnLogout = $app.querySelector("#btnLogout");
  const btnEnablePush = $app.querySelector("#btnEnablePush");

  btnLogout?.addEventListener("click", async () => {
    await logout();
    location.hash = "#/";
    showLogin("تم تسجيل الخروج.");
  });

  btnEnablePush?.addEventListener("click", async () => {
    try {
      btnEnablePush.disabled = true;
      btnEnablePush.textContent = "جاري التفعيل...";
      await enablePush();
      // إعادة رندر بعد التفعيل
      const u = await me();
      if (!u) return showLogin();
      await renderForUser(u);
    } catch (e) {
      btnEnablePush.disabled = false;
      btnEnablePush.textContent = "تفعيل الإشعارات";
      alert(e?.message || String(e));
    }
  });
}

async function boot() {
  try {
    setHtml(renderLoading("تحميل الإعدادات..."));
    await loadAppConfig();
  } catch (e) {
    setHtml(`<div class="alert">فشل تحميل الإعدادات: ${String(e?.message || e)}</div>`);
    return;
  }

  // حاول تجيب المستخدم
  setHtml(renderLoading("التحقق من الجلسة..."));
  const user = await me();

  if (!user) {
    showLogin();
    return;
  }

  // لو داخل root، وجّهه حسب الدور
  const r = getRoute();
  if (r === "#/" || r === "" || r === "#") goto(roleToHome(user.role));

  await renderForUser(user);
}

// عند تغير الهاش
window.addEventListener("hashchange", async () => {
  const user = await me();
  if (!user) return showLogin();
  await renderForUser(user);
});

// زر تحديث عام (اختياري)
$btnRefresh?.addEventListener("click", () => location.reload());

// Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch(() => {});
}

boot().catch((e) => {
  console.error(e);
  showLogin(e?.message || String(e));
});
