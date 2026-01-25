// public/assets/js/app.js
import { apiGet, clearToken } from "./api.js";
import { getRoute, go, guardRoute, roleToHome } from "./router.js";
import { renderLogin, renderDashboard, renderLoading, renderError } from "./ui.js";

const LS_ME = "CLOS_ME_V1";

function loadMeCache() {
  try {
    const raw = localStorage.getItem(LS_ME);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveMeCache(me) {
  try {
    localStorage.setItem(LS_ME, JSON.stringify(me || null));
  } catch {}
}

async function refreshMe() {
  // IMPORTANT: /api/auth/me يحتاج Authorization Bearer
  const out = await apiGet("/api/auth/me", { auth: true });
  // بعض الردود تكون { user, token } وبعضها { user } فقط
  const me = out?.user || null;
  if (me) saveMeCache(me);
  return me;
}

async function renderByRoute(me) {
  const route = getRoute();
  const g = guardRoute(route, me);

  if (!g.ok) {
    go(g.redirect);
    return;
  }

  if (route === "login") {
    renderLogin({ me });
    return;
  }

  // agent/staff/admin
  renderDashboard({ route, me });
}

async function boot() {
  renderLoading("جارٍ التحقق من الجلسة...");

  let me = loadMeCache();

  // لو الكاش موجود نحاول نكمل بسرعة ثم نعمل refresh بالخلف
  // لكن هنا نخليها مباشرة refresh لضمان عدم 401
  try {
    me = await refreshMe();
  } catch (e) {
    // فشل التحقق => امسح التوكن + المستخدم وودّيه لتسجيل الدخول
    saveMeCache(null);
    clearToken();
    me = null;
  }

  await renderByRoute(me);

  window.addEventListener("hashchange", async () => {
    // عند تغير الصفحة حاول تحديث me (اختياري)
    // لكن إذا فيه ضغط كبير خله كاش فقط
    const cached = loadMeCache();
    await renderByRoute(cached);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((e) => renderError(e?.message || String(e)));
});
