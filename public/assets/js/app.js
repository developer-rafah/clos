// public/assets/js/app.js

import { getRoute, goto, parseRoute, roleToHome } from "./router.js";
import * as auth from "./auth.js";
import {
  renderLogin,
  bindLogin,
  renderAgent,
  renderStaff,
  renderAdmin,
  renderHome,
} from "./ui.js";

// مكان عرض الواجهة
const ROOT_ID = "app";

function getRoot() {
  const el = document.getElementById(ROOT_ID);
  if (!el) throw new Error(`Missing #${ROOT_ID} in HTML`);
  return el;
}

/**
 * Stub بسيط للإشعارات (عشان ما يوقف التطبيق لو Firebase ناقص)
 * لاحقًا تقدر تربطه بـ push.js
 */
async function enablePushSafe() {
  try {
    alert("ميزة الإشعارات غير مفعلة بعد (تحتاج Firebase config).");
  } catch {}
}

function bindCommonButtons(root) {
  const btnLogout = root.querySelector("#btnLogout");
  btnLogout?.addEventListener("click", async () => {
    await auth.logout();
    goto("#/");
  });

  const btnEnablePush = root.querySelector("#btnEnablePush");
  btnEnablePush?.addEventListener("click", async () => {
    await enablePushSafe();
  });
}

function enforceRoleAccess(user, routeName) {
  const role = String(user?.role || "").trim();

  // من له صلاحية الدخول لأي صفحة؟
  const allow = {
    admin: role === "مدير",
    staff: role === "موظف" || role === "مدير", // المدير ممكن يشوفها
    agent: role === "مندوب" || role === "مدير", // المدير ممكن يشوفها
  };

  if (routeName === "admin" && !allow.admin) return false;
  if (routeName === "staff" && !allow.staff) return false;
  if (routeName === "agent" && !allow.agent) return false;

  return true;
}

function renderByRoute(root, user, routeName) {
  // حماية صلاحيات
  if (!enforceRoleAccess(user, routeName)) {
    // ارجعه للصفحة المناسبة لدوره
    goto(roleToHome(user?.role));
    return;
  }

  // عرض حسب المسار
  if (routeName === "agent") {
    root.innerHTML = renderAgent({ user, pushStatus: "غير مفعل" });
    bindCommonButtons(root);

    root.querySelector("#btnAgentRefresh")?.addEventListener("click", async () => {
      // مثال: تحديث user من السيرفر
      const fresh = await auth.me();
      if (fresh) {
        root.innerHTML = renderAgent({ user: fresh, pushStatus: "غير مفعل" });
        bindCommonButtons(root);
      }
    });

    return;
  }

  if (routeName === "staff") {
    root.innerHTML = renderStaff({ user, pushStatus: "غير مفعل" });
    bindCommonButtons(root);

    root.querySelector("#btnStaffRefresh")?.addEventListener("click", async () => {
      const fresh = await auth.me();
      if (fresh) {
        root.innerHTML = renderStaff({ user: fresh, pushStatus: "غير مفعل" });
        bindCommonButtons(root);
      }
    });

    return;
  }

  if (routeName === "admin") {
    root.innerHTML = renderAdmin({ user, pushStatus: "غير مفعل" });
    bindCommonButtons(root);

    root.querySelector("#btnAdminUsers")?.addEventListener("click", () => {
      alert("هنا صفحة إدارة المستخدمين (لم تُبن بعد).");
    });

    return;
  }

  // fallback: الصفحة العامة
  root.innerHTML = renderHome({ user, pushStatus: "غير مفعل" });
  bindCommonButtons(root);
}

async function renderApp() {
  const root = getRoot();
  const route = parseRoute(getRoute());

  // 1) هل المستخدم مسجل؟
  const user = await auth.me();

  // 2) لو غير مسجل => login
  if (!user) {
    root.innerHTML = renderLogin({ error: "" });
    bindLogin(root, async ({ username, password }) => {
      try {
        const u = await auth.login(username, password);
        goto(roleToHome(u?.role));
      } catch (e) {
        root.innerHTML = renderLogin({ error: String(e?.message || e) });
        bindLogin(root, async ({ username, password }) => {
          const u = await auth.login(username, password);
          goto(roleToHome(u?.role));
        });
      }
    });
    return;
  }

  // 3) لو مسجل وهو على #/ أو #/login => ودّه لصفحته
  if (route.name === "root" || route.name === "" || route.name === "login") {
    goto(roleToHome(user?.role));
    return;
  }

  // 4) ارسم الصفحة المطلوبة
  renderByRoute(root, user, route.name);
}

window.addEventListener("hashchange", () => {
  renderApp().catch((e) => console.error(e));
});

// تشغيل أولي
renderApp().catch((e) => console.error(e));
