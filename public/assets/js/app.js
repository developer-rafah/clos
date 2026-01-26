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

/** Fetch JSON with Bearer token */
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
  try { data = txt ? JSON.parse(txt) : {}; } catch { data = { raw: txt }; }

  if (!res.ok || data?.ok === false || data?.success === false) {
    const msg = data?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
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

function setInlineMsg(id, msg) {
  const el = $app.querySelector(`[data-msg="${CSS.escape(String(id))}"]`);
  if (el) el.textContent = msg || "";
}

function bindAgentTaskActions(loadTasks) {
  // حفظ الوزن
  $app.querySelectorAll(`[data-action="saveWeight"]`).forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const input = $app.querySelector(`[data-weight-input="${CSS.escape(String(id))}"]`);
      const raw = input ? String(input.value || "").trim() : "";
      const weight = raw === "" ? null : Number(raw);

      if (raw !== "" && (Number.isNaN(weight) || weight < 0)) {
        setInlineMsg(id, "الوزن غير صالح.");
        return;
      }

      try {
        btn.disabled = true;
        setInlineMsg(id, "جاري حفظ الوزن...");
        await fetchJsonAuth("/api/requests", {
          method: "POST",
          body: { id, patch: { weight } },
        });
        setInlineMsg(id, "تم حفظ الوزن ✅");
        await loadTasks();
      } catch (e) {
        setInlineMsg(id, e?.message || "فشل حفظ الوزن");
      } finally {
        btn.disabled = false;
      }
    });
  });

  // إغلاق الطلب
  $app.querySelectorAll(`[data-action="closeRequest"]`).forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (btn.disabled) return;

      const ok = confirm("هل أنت متأكد من إغلاق الطلب؟");
      if (!ok) return;

      try {
        btn.disabled = true;
        setInlineMsg(id, "جاري إغلاق الطلب...");
        await fetchJsonAuth("/api/requests", {
          method: "POST",
          body: {
            id,
            patch: {
              status: "مكتمل",
              closed_at: new Date().toISOString(),
            },
          },
        });
        setInlineMsg(id, "تم إغلاق الطلب ✅");
        await loadTasks();
      } catch (e) {
        setInlineMsg(id, e?.message || "فشل إغلاق الطلب");
        btn.disabled = false;
      }
    });
  });
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
        const out = await fetchJsonAuth("/api/requests");
        const items = out?.items || out?.data || out?.requests || [];
        setHtml(renderAgent({ user, pushStatus, tasks: items, tasksError: "" }));
        bindCommonTopBar(user);

        // زرّين التحديث
        const r1 = $app.querySelector("#btnAgentRefresh");
        const r2 = $app.querySelector("#btnAgentShowTasks");
        r1?.addEventListener("click", loadTasks);
        r2?.addEventListener("click", loadTasks);

        // ✅ أزرار الوزن/الإغلاق
        bindAgentTaskActions(loadTasks);
      } catch (e) {
        setHtml(renderAgent({ user, pushStatus, tasks: [], tasksError: e?.message || String(e) }));
        bindCommonTopBar(user);

        const r1 = $app.querySelector("#btnAgentRefresh");
        const r2 = $app.querySelector("#btnAgentShowTasks");
        r1?.addEventListener("click", loadTasks);
        r2?.addEventListener("click", loadTasks);
      }
    };

    // اربط أزرار التحديث أولاً
    const r1 = $app.querySelector("#btnAgentRefresh");
    const r2 = $app.querySelector("#btnAgentShowTasks");
    r1?.addEventListener("click", loadTasks);
    r2?.addEventListener("click", loadTasks);

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
