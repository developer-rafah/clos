// APP MODULE

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
import { apiGet, apiPost } from "./api.js";

const $app = document.getElementById("app");
const $btnRefresh = document.getElementById("btnRefresh");

function setHtml(html) {
  $app.innerHTML = html;
}

function toStr(x) {
  return String(x ?? "").trim();
}

function isClosedStatus(status) {
  const s = toStr(status);
  return /مكتمل|مغلق|منجز|تم|مغلقه|منتهي/i.test(s);
}

function belongsToAgent(req, user) {
  const au = toStr(req?.agent_username);
  const an = toStr(req?.agent_name);
  const u1 = toStr(user?.username);
  const u2 = toStr(user?.name);

  // يقبل أي تخزين سابق (username أو name)
  return (
    (au && u1 && au === u1) ||
    (an && u1 && an === u1) ||
    (an && u2 && an === u2)
  );
}

function filterByView(list, view, user) {
  const items = Array.isArray(list) ? list : [];

  if (view === "closed") {
    return items.filter((x) => !!x?.closed_at || isClosedStatus(x?.status));
  }

  if (view === "assigned") {
    // المسندة: ليست مكتملة + تخص المندوب
    return items.filter((x) => !x?.closed_at && !isClosedStatus(x?.status) && belongsToAgent(x, user));
  }

  if (view === "new") {
    // جديدة: غير مسندة وغير مكتملة
    return items.filter((x) => !x?.closed_at && !isClosedStatus(x?.status) && !toStr(x?.agent_username) && !toStr(x?.agent_name));
  }

  if (view === "all") return items;

  // افتراضي
  return items;
}

function applySearch(list, q) {
  const query = toStr(q).toLowerCase();
  if (!query) return list;
  return list.filter((x) => {
    const hay = [
      x?.id,
      x?.customer_name,
      x?.customer,
      x?.phone,
      x?.district,
      x?.agent_name,
      x?.agent_username,
      x?.status,
    ].map((v) => toStr(v).toLowerCase()).join(" | ");
    return hay.includes(query);
  });
}

async function fetchAllPages(basePath, { pageLimit = 200, maxPages = 25 } = {}) {
  let all = [];
  let total = null;
  let offset = 0;

  for (let i = 0; i < maxPages; i++) {
    const sep = basePath.includes("?") ? "&" : "?";
    const path = `${basePath}${sep}limit=${pageLimit}&offset=${offset}`;

    const out = await apiGet(path);
    const batch = out?.items || out?.data || out?.requests || [];
    const count = out?.pagination?.count;

    if (Number.isFinite(Number(count))) total = Number(count);

    all = all.concat(Array.isArray(batch) ? batch : []);
    offset += pageLimit;

    // توقف ذكي
    if (!batch || batch.length < pageLimit) break;
    if (total != null && all.length >= total) break;
  }

  return { items: all, total };
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

function bindCommonTopBar() {
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

/* =========================
 * AGENT PAGE
 * ========================= */
async function renderAgentPage(user) {
  const pushStatus = await getPushStatus();

  let view = "assigned"; // ✅ افتراضي: المسند فقط
  let q = "";
  let serverItems = [];
  let shownItems = [];
  let total = null;

  const rerender = (err = "") => {
    setHtml(renderAgent({
      user,
      pushStatus,
      tasks: shownItems,
      tasksError: err,
      view,
      q,
      stats: { loaded: shownItems.length, total },
    }));
    bindCommonTopBar();
    bindAgentHandlers();
  };

  const load = async () => {
    try {
      rerender(""); // يرسم الهيكل أولاً
      // حتى لو السيرفر لا يدعم scope، نحن نفلتر محليًا
      const out = await fetchAllPages(`/api/requests?scope=${encodeURIComponent(view)}`);
      serverItems = out.items || [];
      total = out.total;

      const filtered = filterByView(serverItems, view, user);
      shownItems = applySearch(filtered, q);

      rerender("");
    } catch (e) {
      serverItems = [];
      shownItems = [];
      total = null;
      rerender(e?.message || String(e));
    }
  };

  function bindAgentHandlers() {
    // Tabs
    $app.querySelector("#tabAssigned")?.addEventListener("click", async () => {
      view = "assigned";
      await load();
    });
    $app.querySelector("#tabClosed")?.addEventListener("click", async () => {
      view = "closed";
      await load();
    });

    // Search
    const $search = $app.querySelector("#agentSearch");
    $search?.addEventListener("input", () => {
      q = toStr($search.value);
      const filtered = filterByView(serverItems, view, user);
      shownItems = applySearch(filtered, q);
      rerender("");
    });

    // Refresh
    $app.querySelector("#btnAgentRefresh")?.addEventListener("click", load);

    // Delegation for card buttons
    $app.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;

      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");
      if (!id) return;

      if (act === "saveWeight") {
        const inp = $app.querySelector(`[data-weight-input="1"][data-id="${CSS.escape(id)}"]`);
        const w = toStr(inp?.value);
        try {
          btn.disabled = true;
          await apiPost("/api/requests", { action: "weight", id, weight: w });
          await load();
        } catch (err) {
          alert(err?.message || String(err));
        } finally {
          btn.disabled = false;
        }
      }

      if (act === "closeRequest") {
        if (!confirm("تأكيد إغلاق الطلب؟")) return;
        const inp = $app.querySelector(`[data-weight-input="1"][data-id="${CSS.escape(id)}"]`);
        const w = toStr(inp?.value);
        try {
          btn.disabled = true;
          await apiPost("/api/requests", { action: "close", id, weight: w });
          await load();
        } catch (err) {
          alert(err?.message || String(err));
        } finally {
          btn.disabled = false;
        }
      }
    }, { once: true }); // لأننا نعمل rerender كثير
  }

  // أول رندر ثم تحميل
  rerender("");
  await load();
}

/* =========================
 * STAFF PAGE
 * ========================= */
async function renderStaffPage(user) {
  const pushStatus = await getPushStatus();

  let view = "new";
  let q = "";
  let agents = [];
  let serverItems = [];
  let shownItems = [];
  let total = null;

  const rerender = (err = "") => {
    setHtml(renderStaff({
      user,
      pushStatus,
      view,
      q,
      agents,
      requests: shownItems,
      err,
      stats: { loaded: shownItems.length, total },
    }));
    bindCommonTopBar();
    bindStaffHandlers();
  };

  const loadAgents = async () => {
    try {
      const out = await apiGet("/api/users?role=agent");
      const items = out?.items || [];
      agents = items.map((u) => ({
        value: toStr(u.username),
        label: `${toStr(u.name) || toStr(u.username)} (${toStr(u.username)})`,
      }));
    } catch {
      agents = []; // fallback
    }
  };

  const load = async () => {
    try {
      rerender("");
      await loadAgents();

      const out = await fetchAllPages(`/api/requests?scope=${encodeURIComponent(view)}`);
      serverItems = out.items || [];
      total = out.total;

      const filtered = filterByView(serverItems, view, user);
      shownItems = applySearch(filtered, q);

      rerender("");
    } catch (e) {
      serverItems = [];
      shownItems = [];
      total = null;
      rerender(e?.message || String(e));
    }
  };

  function bindStaffHandlers() {
    $app.querySelector("#tabStaffNew")?.addEventListener("click", async () => { view = "new"; await load(); });
    $app.querySelector("#tabStaffAssigned")?.addEventListener("click", async () => { view = "assigned"; await load(); });
    $app.querySelector("#tabStaffClosed")?.addEventListener("click", async () => { view = "closed"; await load(); });

    const $search = $app.querySelector("#staffSearch");
    $search?.addEventListener("input", () => {
      q = toStr($search.value);
      const filtered = filterByView(serverItems, view, user);
      shownItems = applySearch(filtered, q);
      rerender("");
    });

    $app.querySelector("#btnStaffRefresh")?.addEventListener("click", load);

    // Assign
    $app.addEventListener("click", async (e) => {
      const btn = e.target.closest(`[data-act="assignRequest"]`);
      if (!btn) return;

      const id = btn.getAttribute("data-id");
      const sel = $app.querySelector(`[data-agent-select="1"][data-id="${CSS.escape(id)}"]`);
      const agentUsername = toStr(sel?.value);
      if (!agentUsername) return alert("اختر مندوب أولاً");

      const agent = agents.find((x) => x.value === agentUsername);
      const agentName = agent ? agent.label.split(" (")[0] : agentUsername;

      try {
        btn.disabled = true;
        await apiPost("/api/requests", {
          action: "assign",
          id,
          agent_username: agentUsername,
          agent_name: agentName,
        });
        await load();
      } catch (err) {
        alert(err?.message || String(err));
      } finally {
        btn.disabled = false;
      }
    }, { once: true });
  }

  rerender("");
  await load();
}

/* =========================
 * ADMIN PAGE
 * ========================= */
async function renderAdminPage(user) {
  const pushStatus = await getPushStatus();

  let view = "all";
  let q = "";
  let serverItems = [];
  let shownItems = [];
  let total = null;

  const rerender = (err = "") => {
    setHtml(renderAdmin({
      user,
      pushStatus,
      view,
      q,
      requests: shownItems,
      err,
      stats: { loaded: shownItems.length, total },
    }));
    bindCommonTopBar();
    bindAdminHandlers();
  };

  const load = async () => {
    try {
      rerender("");
      const out = await fetchAllPages(`/api/requests?scope=${encodeURIComponent(view)}`);
      serverItems = out.items || [];
      total = out.total;

      // مدير: فلترة حسب view محليًا
      let filtered = serverItems;
      if (view === "new") filtered = filterByView(serverItems, "new", user);
      if (view === "assigned") {
        filtered = serverItems.filter((x) => !x?.closed_at && !isClosedStatus(x?.status) && (toStr(x?.agent_username) || toStr(x?.agent_name)));
      }
      if (view === "closed") filtered = filterByView(serverItems, "closed", user);
      if (view === "all") filtered = serverItems;

      shownItems = applySearch(filtered, q);
      rerender("");
    } catch (e) {
      serverItems = [];
      shownItems = [];
      total = null;
      rerender(e?.message || String(e));
    }
  };

  function bindAdminHandlers() {
    $app.querySelector("#tabAdminAll")?.addEventListener("click", async () => { view = "all"; await load(); });
    $app.querySelector("#tabAdminNew")?.addEventListener("click", async () => { view = "new"; await load(); });
    $app.querySelector("#tabAdminAssigned")?.addEventListener("click", async () => { view = "assigned"; await load(); });
    $app.querySelector("#tabAdminClosed")?.addEventListener("click", async () => { view = "closed"; await load(); });

    const $search = $app.querySelector("#adminSearch");
    $search?.addEventListener("input", () => {
      q = toStr($search.value);
      // إعادة تطبيق البحث على آخر نتائج محمّلة
      let filtered = serverItems;
      if (view === "new") filtered = filterByView(serverItems, "new", user);
      if (view === "assigned") {
        filtered = serverItems.filter((x) => !x?.closed_at && !isClosedStatus(x?.status) && (toStr(x?.agent_username) || toStr(x?.agent_name)));
      }
      if (view === "closed") filtered = filterByView(serverItems, "closed", user);
      if (view === "all") filtered = serverItems;

      shownItems = applySearch(filtered, q);
      rerender("");
    });

    $app.querySelector("#btnAdminRefresh")?.addEventListener("click", load);
  }

  rerender("");
  await load();
}

/* =========================
 * MAIN ROUTER
 * ========================= */
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

  if (route.name === "agent") {
    await renderAgentPage(user);
    return;
  }

  if (route.name === "staff") {
    await renderStaffPage(user);
    return;
  }

  if (route.name === "admin") {
    await renderAdminPage(user);
    return;
  }

  const pushStatus = await getPushStatus();
  setHtml(renderHome({ user, pushStatus }));
  bindCommonTopBar();
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
