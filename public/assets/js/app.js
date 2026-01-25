// public/assets/js/app.js
import { loadAppConfig } from "./app-config.js";
import { me, login, logout } from "./auth.js";
import { roleToHome, parseRoute, goto, getRoute } from "./router.js";
import { renderLogin, bindLogin, renderLoading, renderAgent, renderStaff, renderAdmin } from "./ui.js";
import { enablePush, getPushStatus } from "./push.js";

const $app = document.getElementById("app");
const $btnRefresh = document.getElementById("btnRefresh") || document.getElementById("btnReload");

function setHtml(html) {
  if (!$app) return;
  $app.innerHTML = html;
}

function safeUserRole(user) {
  return String(user?.role || "").trim();
}

function renderByRoute({ user, routeName, pushStatus }) {
  // routeName: login | agent | staff | admin | root
  if (!user) return;

  const role = safeUserRole(user);

  // حماية بسيطة: لو فتح مسار غير مسموح له، رجعه لصفحة دوره
  const allowedByRole = {
    "مدير": "admin",
    "موظف": "staff",
    "مندوب": "agent",
  };

  const roleHome = allowedByRole[role] || "staff";
  const target = routeName === "root" ? roleHome : routeName;

  if (target !== roleHome) {
    // ليس مسموح
    goto(roleToHome(role));
    return;
  }

  if (target === "admin") setHtml(renderAdmin({ user, pushStatus }));
  else if (target === "agent") setHtml(renderAgent({ user, pushStatus }));
  else setHtml(renderStaff({ user, pushStatus }));
}

async function showLogin(error = "") {
  // (Debug) لمساعدتك تشوف هل التوكن موجود من عدمه في صفحة /#/login
  const debug = {
    hasToken: !!localStorage.getItem("CLOS_TOKEN_V1"),
    tokenPreview: (localStorage.getItem("CLOS_TOKEN_V1") || "").slice(0, 20),
    key: "CLOS_TOKEN_V1",
  };

  setHtml(renderLogin({ error, debug }));

  bindLogin($app, async ({ username, password }) => {
    try {
      setHtml(renderLoading("جاري تسجيل الدخول..."));
      const u = await login(username, password);
      goto(roleToHome(u.role));
      await renderAuthed();
    } catch (e) {
      await showLogin(e?.message || String(e));
    }
  });
}

async function renderAuthed() {
  const user = await me();
  if (!user) {
    goto("#/login");
    return showLogin("لا يوجد جلسة أو انتهت. سجّل دخولك.");
  }

  // لو فتح root، ودّيه للـ home حسب الدور
  const route = parseRoute(getRoute());
  if (route.name === "root") {
    goto(roleToHome(user.role));
  }

  const pushStatus = await getPushStatus().catch(() => "—");
  const route2 = parseRoute(getRoute());

  renderByRoute({ user, routeName: route2.name, pushStatus });
}

function bindActions() {
  // تفويض أحداث لكل الأزرار data-action
  document.addEventListener("click", async (e) => {
    const el = e.target?.closest?.("[data-action]");
    if (!el) return;

    const action = String(el.getAttribute("data-action") || "").trim();

    try {
      if (action === "auth.logout") {
        await logout();
        goto("#/login");
        await showLogin("تم تسجيل الخروج.");
        return;
      }

      if (action === "push.enable") {
        el.setAttribute("disabled", "true");
        await enablePush();
        await renderAuthed();
        return;
      }

      // مكان جاهز لربط وظائف المندوب/الموظف/المدير
      if (action === "agent.refresh" || action === "agent.tasks" ||
          action === "staff.refresh" || action === "staff.action" ||
          action === "admin.users" || action === "admin.reports") {
        alert(`Action: ${action} (ضع كودك هنا)`);
        return;
      }
    } catch (err) {
      try { el.removeAttribute("disabled"); } catch {}
      alert(err?.message || String(err));
    }
  });
}

async function boot() {
  bindActions();
  setHtml(renderLoading("جاري التحضير..."));

  try {
    await loadAppConfig();
  } catch (e) {
    setHtml(`<div class="alert">فشل تحميل الإعدادات: ${String(e?.message || e)}</div>`);
    return;
  }

  const route = parseRoute(getRoute());
  if (route.name === "login") {
    return showLogin();
  }

  // جرّب تفتح كـ Authed
  await renderAuthed();
}

window.addEventListener("hashchange", () => {
  const r = parseRoute(getRoute());
  if (r.name === "login") showLogin();
  else renderAuthed();
});

$btnRefresh?.addEventListener("click", () => location.reload());

// Register SW (لا يسبب تعليق لو فشل)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch(() => {});
}

boot();
