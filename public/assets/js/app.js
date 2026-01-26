// public/assets/js/app.js

import { loadAppConfig } from "./app-config.js";
import { me, login, logout } from "./auth.js";
import { apiGet } from "./api.js";
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

function setHtml(html) {
  $app.innerHTML = html;
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

function normalizeTasks(out) {
  const candidates = [out?.items, out?.data, out?.requests, out];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

/** رندر حسب الدور + حسب route */
async function renderForUser(user) {
  const route = parseRoute(getRoute());

  if (route.name === "root") {
    goto(roleToHome(user.role));
    return;
  }

  const expected = roleToHome(user.role).replace("#/", "");
  if (expected && route.name !== expected) {
    goto(roleToHome(user.role));
    return;
  }

  const pushStatus = await getPushStatus();

  if (route.name === "agent") {
    setHtml(renderAgent({ user, pushStatus, tasks: [], tasksError: "" }));
    bindCommonTopBar(user);

    const loadTasks = async () => {
      try {
        // ✅ موحد عبر apiGet + auth:true
        const out = await apiGet("/api/requests", { auth: true });
        const items = normalizeTasks(out);

        setHtml(renderAgent({ user, pushStatus, tasks: items, tasksError: "" }));
        bindCommonTopBar(user);
        bindAgentButtons(loadTasks);
      } catch (e) {
        // ✅ لو الجلسة انتهت: رجّع المستخدم لتسجيل الدخول
        if (e?.status === 401 || e?.status === 403) {
          await logout();
          showLogin("انتهت الجلسة. فضلاً أعد تسجيل الدخول.");
          return;
        }

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
    };

    bindAgentButtons(loadTasks);
    loadTasks().catch(() => {});
    return;
  }

  if (route.name === "staff") {
    setHtml(renderStaff({ user, pushStatus }));
    bindCommonTopBar(user);
    return;
  }

  if (route.name === "admin") {
    setHtml(renderAdmin({ user, pushStatus }));
    bindCommonTopBar(user);
    return;
  }

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
    setHtml(`<div class="alert">فشل تحميل الإعدادات: ${String(e?.message || e)}</div>`);
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

window.addEventListener("hashchange", async () => {
  const user = await me();
  if (!user) return showLogin();
  await renderForUser(user);
});

$btnRefresh?.addEventListener("click", () => location.reload());

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch(() => {});
}

boot().catch((e) => {
  console.error(e);
  showLogin(e?.message || String(e));
});
