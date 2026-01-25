// public/assets/js/app.js

import { loadAppConfig } from "./app-config.js";
import { login, logout as logoutApi } from "./auth.js";
import { roleToHome, goto, parseRoute } from "./router.js";
import {
  renderLoading,
  renderLogin,
  bindLogin,
  renderAgent,
  renderStaff,
  renderAdmin,
  renderHome,
} from "./ui.js";
import { enablePush, getPushStatus } from "./push.js";

const $app = document.getElementById("app");

function setHtml(html) {
  $app.innerHTML = html;
}

// ✅ مفاتيح التخزين (حسب اللي ظهر عندك)
const LS_TOKEN = "CLOS_TOKEN_V1";
const LS_ME = "CLOS_ME_V1";

// ✅ جلب التوكن من عدة أماكن (احتياط)
function getToken() {
  try {
    const t = String(localStorage.getItem(LS_TOKEN) || "").trim();
    if (t) return t;
  } catch {}
  try {
    const t2 = String(sessionStorage.getItem(LS_TOKEN) || "").trim();
    if (t2) return t2;
  } catch {}
  // احتياط لو نسخة قديمة
  try {
    const t3 = String(localStorage.getItem("AUTH_TOKEN") || localStorage.getItem("auth_token") || "").trim();
    if (t3) return t3;
  } catch {}
  return "";
}

function clearSessionLocal() {
  try { localStorage.removeItem(LS_TOKEN); } catch {}
  try { localStorage.removeItem(LS_ME); } catch {}
  try { sessionStorage.removeItem(LS_TOKEN); } catch {}
}

// ✅ طلبات مع Bearer (هذا هو سبب حل 401)
async function authFetchJson(path, init = {}) {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("authorization", "Bearer " + token);
  // مهم: لا تخلي الكاش يسبب لخبطة
  const res = await fetch(path, { ...init, headers, cache: "no-store" });

  const text = await res.text().catch(() => "");
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  // توحيد فشل الرد
  if (!res.ok || data?.ok === false || data?.success === false) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

async function authMe() {
  // جرّب API
  try {
    const out = await authFetchJson("/api/auth/me", { method: "GET" });
    const user = out?.user || null;
    try { localStorage.setItem(LS_ME, JSON.stringify(user)); } catch {}
    return user;
  } catch (e) {
    // fallback: كاش
    try {
      const raw = localStorage.getItem(LS_ME);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }
}

async function fetchAgentTasks() {
  // عندك هذا يشتغل مع Bearer حسب اختبارك
  const out = await authFetchJson("/api/requests", { method: "GET" });
  // مرن حسب شكل البيانات
  return out?.items || out?.data || out?.requests || [];
}

function bindCommonButtons(user, rerenderFn) {
  const btnLogout = $app.querySelector("#btnLogout");
  const btnEnablePush = $app.querySelector("#btnEnablePush");

  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        // Logout من السيرفر (إن نجح أو فشل) ثم نظّف محليًا
        await logoutApi().catch(() => {});
      } finally {
        clearSessionLocal();
        goto("#/login");
        showLogin("تم تسجيل الخروج.");
      }
    });
  }

  if (btnEnablePush) {
    btnEnablePush.addEventListener("click", async () => {
      try {
        btnEnablePush.disabled = true;
        btnEnablePush.textContent = "جاري التفعيل...";
        await enablePush();
        await rerenderFn(user);
      } catch (e) {
        alert(e?.message || String(e));
      } finally {
        btnEnablePush.disabled = false;
        btnEnablePush.textContent = "تفعيل الإشعارات";
      }
    });
  }
}

async function renderByRoute(user) {
  const { name } = parseRoute();

  const pushStatus = await getPushStatus().catch(() => "—");

  // ✅ root: وجّه حسب الدور
  if (name === "root") {
    goto(roleToHome(user.role));
    return;
  }

  if (name === "login") {
    // لو كان عنده جلسة لا تخليه في login
    goto(roleToHome(user.role));
    return;
  }

  if (name === "agent") {
    setHtml(renderLoading("جاري تحميل مهام المندوب..."));
    let tasks = [];
    let tasksError = "";
    try {
      tasks = await fetchAgentTasks();
    } catch (e) {
      // لو 401/403 رجّع login
      if (e?.status === 401 || e?.status === 403) {
        clearSessionLocal();
        goto("#/login");
        showLogin("انتهت الجلسة. سجّل الدخول مرة أخرى.");
        return;
      }
      tasksError = e?.message || String(e);
    }

    setHtml(renderAgent({ user, pushStatus, tasks, tasksError }));
    bindCommonButtons(user, renderByRoute);

    const btnAgentRefresh = $app.querySelector("#btnAgentRefresh");
    const btnAgentTasks = $app.querySelector("#btnAgentTasks");

    const refresh = async () => {
      setHtml(renderLoading("جاري تحديث البيانات..."));
      await renderByRoute(user);
    };

    btnAgentRefresh?.addEventListener("click", refresh);
    btnAgentTasks?.addEventListener("click", refresh);
    return;
  }

  if (name === "staff") {
    setHtml(renderStaff({ user, pushStatus }));
    bindCommonButtons(user, renderByRoute);
    return;
  }

  if (name === "admin") {
    setHtml(renderAdmin({ user, pushStatus }));
    bindCommonButtons(user, renderByRoute);
    return;
  }

  // fallback
  setHtml(renderHome({ user, pushStatus }));
  bindCommonButtons(user, renderByRoute);
}

function showLogin(error = "") {
  const token = getToken();
  setHtml(renderLogin({
    error,
    debug: {
      hasToken: !!token,
      tokenPreview: token ? token.slice(0, 18) + "..." : "",
      key: LS_TOKEN,
    },
  }));

  bindLogin($app, async ({ username, password }) => {
    try {
      setHtml(renderLoading("جاري تسجيل الدخول..."));
      const u = await login(username, password); // يعتمد على auth.js لتخزين التوكن
      goto(roleToHome(u.role));
      await renderByRoute(u);
    } catch (e) {
      showLogin(e?.message || String(e));
    }
  });
}

async function boot() {
  setHtml(renderLoading("جاري تهيئة النظام..."));

  try {
    await loadAppConfig();
  } catch (e) {
    setHtml(`<div class="alert">فشل تحميل الإعدادات: ${String(e?.message || e)}</div>`);
    return;
  }

  // ✅ Register SW
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  // ✅ إذا ما فيه توكن -> login مباشرة (بدون انتظار me يفشل ويعلّق)
  if (!getToken()) {
    goto("#/login");
    showLogin("");
    return;
  }

  // ✅ فيه توكن -> تحقق me
  const user = await authMe();
  if (!user) {
    clearSessionLocal();
    goto("#/login");
    showLogin("لا يوجد جلسة أو انتهت.. سجّل دخولك من الواجهة.");
    return;
  }

  // ✅ اعرض حسب الراوت
  await renderByRoute(user);
}

window.addEventListener("hashchange", async () => {
  // عند التنقل: لو توكن مفقود -> login
  if (!getToken()) {
    goto("#/login");
    showLogin("");
    return;
  }

  const user = await authMe();
  if (!user) {
    clearSessionLocal();
    goto("#/login");
    showLogin("انتهت الجلسة. سجّل الدخول مرة أخرى.");
    return;
  }

  await renderByRoute(user);
});

boot();
