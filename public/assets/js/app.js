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

// ✅ ربط الإشعارات الحقيقي
import { enablePush, getPushStatus } from "./push.js";

// مكان عرض الواجهة
const ROOT_ID = "app";

function getRoot() {
  const el = document.getElementById(ROOT_ID);
  if (!el) throw new Error(`Missing #${ROOT_ID} in HTML`);
  return el;
}

async function computePushStatusText() {
  try {
    return await getPushStatus();
  } catch (e) {
    // لو صار خطأ غير متوقع، لا نوقف الواجهة
    return "—";
  }
}

function mapPushErrorToMessage(e) {
  const msg = String(e?.message || e || "");

  // أهم الحالات المتوقعة في مشروعك:
  if (msg.includes("HTTP 401") || msg.toLowerCase().includes("unauthorized")) {
    return "لازم تسجّل دخول أولًا لتفعيل الإشعارات.";
  }
  if (msg.includes("تم رفض إذن الإشعارات")) {
    return "تم رفض الإشعارات من المتصفح. فعّلها من إعدادات الموقع ثم جرّب مرة أخرى.";
  }
  if (msg.includes("Service Worker غير مدعوم")) {
    return "متصفحك لا يدعم Service Worker، لذلك الإشعارات غير مدعومة.";
  }
  if (msg.includes("Firebase config ناقص")) {
    return "إعدادات Firebase ناقصة. تأكد أن /app-config.json يحتوي القيم المطلوبة.";
  }
  if (msg.includes("لم يتم الحصول على FCM token")) {
    return "فشل الحصول على توكن الإشعارات. جرّب تحديث الصفحة أو إعادة تفعيل الإشعارات.";
  }

  return msg || "حدث خطأ أثناء تفعيل الإشعارات.";
}

async function onEnablePushClicked() {
  try {
    await enablePush();
    alert("تم تفعيل الإشعارات ✅");
  } catch (e) {
    alert(mapPushErrorToMessage(e));
  }
}

function bindCommonButtons(root) {
  const btnLogout = root.querySelector("#btnLogout");
  btnLogout?.addEventListener("click", async () => {
    await auth.logout();
    goto("#/");
  });

  const btnEnablePush = root.querySelector("#btnEnablePush");
  btnEnablePush?.addEventListener("click", async () => {
    await onEnablePushClicked();

    // بعد المحاولة، نعيد الرسم لتحديث حالة pushStatus في الواجهة
    await renderApp();
  });
}

function enforceRoleAccess(user, routeName) {
  const role = String(user?.role || "").trim();

  // من له صلاحية الدخول لأي صفحة؟
  const allow = {
    admin: role === "مدير",
    staff: role === "موظف" || role === "مدير",
    agent: role === "مندوب" || role === "مدير",
  };

  if (routeName === "admin" && !allow.admin) return false;
  if (routeName === "staff" && !allow.staff) return false;
  if (routeName === "agent" && !allow.agent) return false;

  return true;
}

async function renderByRoute(root, user, routeName) {
  // حماية صلاحيات
  if (!enforceRoleAccess(user, routeName)) {
    goto(roleToHome(user?.role));
    return;
  }

  // ✅ حالة الإشعارات الحقيقية
  const pushStatus = await computePushStatusText();

  // عرض حسب المسار
  if (routeName === "agent") {
    root.innerHTML = renderAgent({ user, pushStatus });
    bindCommonButtons(root);

    root.querySelector("#btnAgentRefresh")?.addEventListener("click", async () => {
      const fresh = await auth.me();
      if (fresh) {
        const ps = await computePushStatusText();
        root.innerHTML = renderAgent({ user: fresh, pushStatus: ps });
        bindCommonButtons(root);
      }
    });

    return;
  }

  if (routeName === "staff") {
    root.innerHTML = renderStaff({ user, pushStatus });
    bindCommonButtons(root);

    root.querySelector("#btnStaffRefresh")?.addEventListener("click", async () => {
      const fresh = await auth.me();
      if (fresh) {
        const ps = await computePushStatusText();
        root.innerHTML = renderStaff({ user: fresh, pushStatus: ps });
        bindCommonButtons(root);
      }
    });

    return;
  }

  if (routeName === "admin") {
    root.innerHTML = renderAdmin({ user, pushStatus });
    bindCommonButtons(root);

    root.querySelector("#btnAdminUsers")?.addEventListener("click", () => {
      alert("هنا صفحة إدارة المستخدمين (لم تُبن بعد).");
    });

    return;
  }

  // fallback: الصفحة العامة
  root.innerHTML = renderHome({ user, pushStatus });
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
  await renderByRoute(root, user, route.name);
}

window.addEventListener("hashchange", () => {
  renderApp().catch((e) => console.error(e));
});

// تشغيل أولي
renderApp().catch((e) => console.error(e));
