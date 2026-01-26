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

  const txt = await res.text().catch(() => "");
  let data = {};
  try {
    data = txt ? JSON.parse(txt) : {};
  } catch {
    data = { raw: txt };
  }

  if (!res.ok || data?.ok === false || data?.success === false) {
    const msg = data?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function normalizeKey(v) {
  // توحيد للمقارنة (عربي/انجليزي) بشكل آمن
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeStatus(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function isTaskAssignedToUser(task, user) {
  const uName = normalizeKey(user?.name);
  const uUser = normalizeKey(user?.username);

  // دعم أكثر من اسم حقل محتمل
  const aName = normalizeKey(task?.agent_name ?? task?.agentName ?? task?.agent);
  const aUser = normalizeKey(task?.agent_username ?? task?.agentUsername ?? task?.username);

  if (!uName && !uUser) return false;

  // ✅ الأفضل: agent_name
  if (aName && (aName === uName || aName === uUser)) return true;

  // احتياطي: agent_username
  if (aUser && aUser === uUser) return true;

  return false;
}

function filterAgentTasks(items, user, tab = "assigned") {
  const mine = (Array.isArray(items) ? items : []).filter((t) =>
    isTaskAssignedToUser(t, user)
  );

  const closedSet = new Set(
    [
      "مكتمل",
      "مغلق",
      "مقفول",
      "تم",
      "منتهي",
      "ملغي",
      "ملغى",
      "cancelled",
      "canceled",
      "closed",
      "done",
      "completed",
    ].map(normalizeStatus)
  );

  // التبويب الافتراضي: المسند/غير مكتمل
  if (tab === "closed") {
    return mine.filter((t) => closedSet.has(normalizeStatus(t?.status ?? t?.state)));
  }

  if (tab === "all") return mine;

  // assigned
  return mine.filter((t) => !closedSet.has(normalizeStatus(t?.status ?? t?.state)));
}

function getAgentTab(route) {
  const tab = String(route?.query?.tab || "").trim();
  return tab === "closed" || tab === "all" ? tab : "assigned";
}

function setAgentTabInHash(tab) {
  tab = tab === "closed" || tab === "all" ? tab : "assigned";
  goto(`#/agent?tab=${encodeURIComponent(tab)}`);
}

function showLogin(error = "") {
  setHtml(renderLogin({ error }));
  bindLogin($app, async ({ username, password }) => {
    try {
      setHtml(renderLoading("جاري تسجيل الدخول..."));
      const u = await login(username, password);

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

  // ====== AGENT ======
  if (route.name === "agent") {
    const tab = getAgentTab(route);

    setHtml(renderAgent({ user, pushStatus, tasks: [], tasksError: "" }));
    bindCommonTopBar(user);

    const loadTasks = async () => {
      const currentRoute = parseRoute(getRoute());
      const currentTab = getAgentTab(currentRoute);

      try {
        // ✅ نرسل agent_name كإشارة (حتى لو السيرفر تجاهلها ما تضر)
        const agentName = String(user?.name || user?.username || "").trim();
        const url =
          "/api/requests?" +
          new URLSearchParams({
            tab: currentTab,
            agent_name: agentName,
          }).toString();

        const out = await fetchJsonAuth(url);

        const rawItems = out?.items || out?.data || out?.requests || [];
        const filtered = filterAgentTasks(rawItems, user, currentTab);

        let tasksError = "";
        if (Array.isArray(rawItems) && rawItems.length > 0 && filtered.length === 0) {
          tasksError =
            `تم تحميل ${rawItems.length} طلب/طلبـات من السيرفر، ` +
            `لكن لا يوجد أي طلب مطابق لهذا المندوب بعد التصفية. ` +
            `تحقق من قيم agent_name في جدول requests وأنها تساوي اسم/يوزر المندوب الحالي.`;
        }

        setHtml(
          renderAgent({
            user,
            pushStatus,
            tasks: filtered,
            tasksError,
          })
        );
        bindCommonTopBar(user);
        bindAgentButtons(loadTasks);
      } catch (e) {
        setHtml(
          renderAgent({
            user,
            pushStatus,
            tasks: [],
            tasksError: e?.message || String(e),
          })
        );
        bindCommonTopBar(user);
        bindAgentButtons(loadTasks);
      }
    };

    const bindAgentButtons = (loader) => {
      const r1 = $app.querySelector("#btnAgentRefresh");
      const r2 = $app.querySelector("#btnAgentShowTasks");
      r1?.addEventListener("click", loader);
      r2?.addEventListener("click", loader);

      // ✅ دعم تبويبات لو موجودة في UI (أسماء مختلفة محتملة)
      const tabAssigned =
        $app.querySelector("#tabAssigned") ||
        $app.querySelector("#btnAgentTabAssigned") ||
        $app.querySelector("[data-agent-tab='assigned']");
      const tabClosed =
        $app.querySelector("#tabClosed") ||
        $app.querySelector("#btnAgentTabClosed") ||
        $app.querySelector("[data-agent-tab='closed']");
      const tabAll =
        $app.querySelector("#tabAll") ||
        $app.querySelector("#btnAgentTabAll") ||
        $app.querySelector("[data-agent-tab='all']");

      tabAssigned?.addEventListener("click", () => setAgentTabInHash("assigned"));
      tabClosed?.addEventListener("click", () => setAgentTabInHash("closed"));
      tabAll?.addEventListener("click", () => setAgentTabInHash("all"));
    };

    bindAgentButtons(loadTasks);
    loadTasks().catch(() => {});
    return;
  }

  // ====== STAFF ======
  if (route.name === "staff") {
    setHtml(renderStaff({ user, pushStatus }));
    bindCommonTopBar(user);
    return;
  }

  // ====== ADMIN ======
  if (route.name === "admin") {
    setHtml(renderAdmin({ user, pushStatus }));
    bindCommonTopBar(user);
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
    setHtml(
      `<div class="alert">فشل تحميل الإعدادات: ${String(e?.message || e)}</div>`
    );
    return;
  }

  setHtml(renderLoading("التحقق من الجلسة..."));
  const user = await me();

  if (!user) {
    showLogin();
    return;
  }

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
