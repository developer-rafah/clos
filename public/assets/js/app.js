import { parseRoute, getRoute, goto, roleToHome } from "./router.js";
import * as auth from "./auth.js";
import { gas } from "./api.js";
import { renderLogin, bindLogin, renderAgent, renderStaff, renderAdmin, renderHome } from "./ui.js";

const ROOT_ID = "app";

function getRoot() {
  const el = document.getElementById(ROOT_ID);
  if (!el) throw new Error(`Missing #${ROOT_ID}`);
  return el;
}

let state = {
  user: null,
  tasks: [],
  tasksError: "",
  pushStatus: "غير مفعل",
};

function setView(html) {
  getRoot().innerHTML = html;
}

async function enablePushSafe() {
  alert("ميزة الإشعارات غير مفعلة حالياً (Firebase config ناقص).");
}

// ✅ helper: استخرج مصفوفة من أشكال ردود متعددة
function extractArray(any) {
  const candidates = [
    any,
    any?.items,
    any?.data,
    any?.tasks,
    any?.requests,
    any?.result,
    any?.rows,
  ];
  return candidates.find(Array.isArray) || [];
}

async function loadAgentTasks() {
  try {
    // هذا action محمي في GAS (ليس auth.* وليس donate) => يحتاج apiKey صحيح
    const g = await gas("agent.tasks", { username: state.user?.username });

    // ✅ إذا GAS رجّع Object وليس Array، استخرج المصفوفة
    const tasks = extractArray(g);

    state.tasks = tasks;
    state.tasksError = "";
  } catch (e) {
    state.tasks = [];
    state.tasksError = String(e?.message || e);
  }
}

function renderRoute() {
  const route = parseRoute(getRoute());
  const user = state.user;

  // غير مسجل
  if (!user) {
    setView(renderLogin({ error: "" }));
    bindLogin(getRoot(), async ({ username, password }) => {
      try {
        const u = await auth.login(username, password);
        state.user = u;
        goto(roleToHome(u?.role));
      } catch (e) {
        setView(renderLogin({ error: String(e?.message || e) }));
        bindLogin(getRoot(), async ({ username, password }) => {
          const u = await auth.login(username, password);
          state.user = u;
          goto(roleToHome(u?.role));
        });
      }
    });
    return;
  }

  // لو على root ودّه حسب الدور
  if (route.name === "root" || route.name === "" || route.name === "login") {
    goto(roleToHome(user?.role));
    return;
  }

  // صفحات حسب المسار
  if (route.name === "agent") {
    setView(renderAgent({
      user,
      pushStatus: state.pushStatus,
      tasks: state.tasks,
      tasksError: state.tasksError,
    }));
    return;
  }

  if (route.name === "staff") {
    setView(renderStaff({ user, pushStatus: state.pushStatus }));
    return;
  }

  if (route.name === "admin") {
    setView(renderAdmin({ user, pushStatus: state.pushStatus }));
    return;
  }

  setView(renderHome({ user, pushStatus: state.pushStatus }));
}

// ✅ Event delegation
function wireGlobalClicks() {
  const root = getRoot();
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");

    try {
      if (action === "auth.logout") {
        await auth.logout();
        state.user = null;
        state.tasks = [];
        state.tasksError = "";
        goto("#/");
        return;
      }

      if (action === "push.enable") {
        await enablePushSafe();
        return;
      }

      if (action === "agent.refresh") {
        const fresh = await auth.me();
        if (fresh) state.user = fresh;

        await loadAgentTasks(); // يجلب المهام ويعرض الخطأ إن وجد
        renderRoute();
        return;
      }

      if (action === "agent.tasks") {
        await loadAgentTasks();
        renderRoute();
        return;
      }
    } catch (err) {
      state.tasksError = String(err?.message || err);
      renderRoute();
    }
  });
}

async function boot() {
  wireGlobalClicks();

  state.user = await auth.me();

  // تحميل مهام المندوب تلقائيًا
  if (state.user?.role === "مندوب") {
    await loadAgentTasks();
  }

  renderRoute();
}

window.addEventListener("hashchange", () => renderRoute());

boot().catch((e) => {
  console.error(e);
  setView(`<div class="alert">خطأ في تشغيل التطبيق: ${String(e?.message || e)}</div>`);
});
