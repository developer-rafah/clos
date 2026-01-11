import { loadAppConfig } from "./app-config.js";
import { me, login, logout } from "./auth.js";
import { roleToHome, getRoute, goto } from "./router.js";
import { renderLogin, bindLogin, renderHome } from "./ui.js";
import { enablePush, getPushStatus } from "./push.js";

const $app = document.getElementById("app");
const $btnRefresh = document.getElementById("btnRefresh");

function setHtml(html) {
  $app.innerHTML = html;
}

async function boot() {
  try {
    await loadAppConfig(); // تأكد config جاهز
  } catch (e) {
    setHtml(`<div class="alert">فشل تحميل الإعدادات: ${String(e?.message || e)}</div>`);
    return;
  }

  const user = await me();
  if (!user) {
    showLogin();
    return;
  }

  // توجيه تلقائي حسب الدور
  const r = getRoute();
  if (r === "#/" || r === "" || r === "#") goto(roleToHome(user.role));
  await renderForUser(user);
}

function showLogin(error = "") {
  setHtml(renderLogin({ error, onSubmit: null }));
  bindLogin($app, async ({ username, password }) => {
    try {
      const u = await login(username, password);
      goto(roleToHome(u.role));
      await renderForUser(u);
    } catch (e) {
      showLogin(e?.message || String(e));
    }
  });
}

async function renderForUser(user) {
  const pushStatus = await getPushStatus();
  setHtml(renderHome({ user, pushStatus }));

  const btnLogout = $app.querySelector("#btnLogout");
  const btnEnablePush = $app.querySelector("#btnEnablePush");

  btnLogout.addEventListener("click", async () => {
    // ✅ لا Logout إلا يدويًا
    await logout();
    location.hash = "#/";
    showLogin("تم تسجيل الخروج.");
  });

  btnEnablePush.addEventListener("click", async () => {
    try {
      btnEnablePush.disabled = true;
      btnEnablePush.textContent = "جاري التفعيل...";
      await enablePush();
      await renderForUser(user);
    } catch (e) {
      btnEnablePush.disabled = false;
      btnEnablePush.textContent = "تفعيل الإشعارات";
      alert(e?.message || String(e));
    }
  });
}

window.addEventListener("hashchange", async () => {
  const user = await me();
  if (!user) return showLogin();
  await renderForUser(user);
});

$btnRefresh?.addEventListener("click", () => location.reload());

// ✅ Register SW for offline + push
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch(() => {});
}

boot();
