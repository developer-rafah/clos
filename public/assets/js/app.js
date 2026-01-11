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
  const root = getRoot();
  root.innerHTML = html;
}

async function enablePushSafe() {
  alert("ميزة الإشعارات غير مفعلة حالياً (Firebase config ناقص).");
}

async function loadAgentTasks() {
  try {
    // ✅ غيّر اسم الأكشن حسب الموجود عندك في Google Apps Script
    // ابدأ بهذا، وإن لم يعطِ بيانات، سنبدله حسب أكشنات GAS عندك:
    const data = await gas("agent.tasks", { username: state.user?.username });

    // نتوقع أن GAS يرجّع array أو {items:[]}
    const tasks = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
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

// ✅ Event delegation: حدث واحد فقط لكل الأزرار
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
        // تحديث بيانات المستخدم من السيرفر
        const fresh = await auth.me();
        if (fresh) state.user = fresh;
        // اختياري: مع التحديث نجلب المهام أيضًا
        await loadAgentTasks();
        renderRoute();
        return;
      }

      if (action === "agent.tasks") {
        await loadAgentTasks();
        renderRoute();
        return;
      }
    } catch (err) {
      // عرض الخطأ داخل صفحة المندوب بدل الصمت
      state.tasksError = String(err?.message || err);
      renderRoute();
    }
  });
}

async function boot() {
  wireGlobalClicks();

  // حمّل المستخدم إن كان مسجل
  state.user = await auth.me();

  // لو مندوب، حاول تحميل المهام تلقائيًا (اختياري)
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
