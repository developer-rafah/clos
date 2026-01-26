// public/assets/js/app.js
import { parseRoute, goto, roleToHome } from "./router.js";
import { loadAppConfig } from "./app-config.js";
import { initPush, enablePush, getPushStatus } from "./push.js";
import {
  renderLoading,
  renderLogin,
  renderAgent,
  renderStaff,
  renderAdmin,
  renderHome,
  renderAlert,
} from "./ui.js";

const TOKEN_KEY = "CLOS_TOKEN_V1";
const AUTH_TIMEOUT_MS = 9000;
const API_TIMEOUT_MS = 12000;

const $app = document.getElementById("app");

let suppressNextHash = false;
let lastUser = null;
let lastPushStatus = null;

function setHtml(html) {
  if (!$app) return;
  $app.innerHTML = html;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function qs(sel, root = document) {
  return root.querySelector(sel);
}

function buildHash(path, query = {}) {
  const base = path.startsWith("#") ? path : `#${path.startsWith("/") ? "" : "/"}${path}`;
  const q = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchJsonAuth(path, { method = "GET", body, timeoutMs = API_TIMEOUT_MS, headers = {} } = {}) {
  const token = getToken();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(path, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const ct = res.headers.get("content-type") || "";
    const raw = await res.text();
    const data = ct.includes("application/json") ? safeJsonParse(raw) : null;

    if (!res.ok) {
      const err = new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
      err.status = res.status;
      err.payload = data ?? raw;
      throw err;
    }

    // لو السيرفر رجع JSON صحيح
    return data ?? { ok: true, success: true, raw };
  } catch (e) {
    // AbortError = Timeout غالباً
    if (e?.name === "AbortError") {
      const err = new Error("انتهى زمن الانتظار (Timeout). تأكد من اتصال الشبكة أو استجابة السيرفر.");
      err.status = 408;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function safeMe() {
  const token = getToken();
  if (!token) return null;

  try {
    const out = await fetchJsonAuth("/api/auth/me", { timeoutMs: AUTH_TIMEOUT_MS });
    // API يرجع غالباً { ok:true, success:true, user:{...} }
    return out.user || null;
  } catch (e) {
    if (e?.status === 401) clearToken();
    return null;
  }
}

async function safeLogin(username, password) {
  const out = await fetchJsonAuth("/api/auth/login", {
    method: "POST",
    body: { username, password },
    timeoutMs: AUTH_TIMEOUT_MS,
  });

  if (!out?.token || !out?.user) {
    throw new Error(out?.error || "فشل تسجيل الدخول: رد غير متوقع من السيرفر.");
  }

  setToken(out.token);
  return out.user;
}

function normalizeRoleLabel(role) {
  // نعرض كما هي (عربية غالباً)
  return role || "";
}

function showFatalError(err) {
  const msg =
    err?.message ||
    (typeof err === "string" ? err : "حدث خطأ غير متوقع");

  setHtml(
    renderAlert?.({
      type: "error",
      title: "تعذر تحميل الصفحة",
      message: msg,
      actions: [
        { id: "btnReload", label: "إعادة المحاولة" },
        { id: "btnLogout", label: "تسجيل خروج" },
      ],
    }) ||
      `<div style="padding:24px;color:#fff">خطأ: ${msg}</div>`
  );

  qs("#btnReload")?.addEventListener("click", () => location.reload());
  qs("#btnLogout")?.addEventListener("click", () => {
    clearToken();
    goto("#/login");
    renderCurrentRoute().catch(() => {});
  });
}

function bindCommonTopBar(user) {
  qs("#btnLogout")?.addEventListener("click", () => {
    clearToken();
    goto("#/login");
    renderCurrentRoute().catch(() => {});
  });

  const $push = qs("#btnPush");
  if ($push) {
    $push.addEventListener("click", async () => {
      try {
        $push.disabled = true;
        $push.textContent = "جاري التفعيل...";
        await enablePush();
        lastPushStatus = await getPushStatus().catch(() => lastPushStatus);
        // إعادة رسم بسيطة للصفحة الحالية لتحديث حالة زر الاشعارات
        await renderCurrentRoute();
      } catch (e) {
        alert(e?.message || "فشل تفعيل الإشعارات");
      } finally {
        $push.disabled = false;
      }
    });
  }

  // عرض الاسم/الدور إن كانت الـ UI تعتمد عناصر معينة
  qs("#userName") && (qs("#userName").textContent = user?.name || user?.username || "");
  qs("#userRole") && (qs("#userRole").textContent = normalizeRoleLabel(user?.role));
}

async function loadRequests({ view = "assigned", q = "", limit = 50, offset = 0 } = {}) {
  const url = new URL("/api/requests", window.location.origin);
  url.searchParams.set("view", view);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  if (q) url.searchParams.set("q", q);
  return await fetchJsonAuth(url.toString().replace(window.location.origin, ""), { timeoutMs: API_TIMEOUT_MS });
}

async function loadUsers({ role } = {}) {
  const url = new URL("/api/users", window.location.origin);
  if (role) url.searchParams.set("role", role);
  return await fetchJsonAuth(url.toString().replace(window.location.origin, ""), { timeoutMs: API_TIMEOUT_MS });
}

async function loadAdminKpis() {
  // نجيب العدّادات بسرعة عبر limit=1 ونقرأ pagination.count
  const [all, assigned, closed, fresh] = await Promise.allSettled([
    loadRequests({ view: "all", limit: 1, offset: 0 }),
    loadRequests({ view: "assigned", limit: 1, offset: 0 }),
    loadRequests({ view: "closed", limit: 1, offset: 0 }),
    loadRequests({ view: "new", limit: 1, offset: 0 }),
  ]);

  const getCount = (r) => (r?.status === "fulfilled" ? Number(r.value?.pagination?.count || 0) : 0);

  return {
    total: getCount(all),
    assigned: getCount(assigned),
    closed: getCount(closed),
    fresh: getCount(fresh),
  };
}

async function renderAgentPage(route, user) {
  const view = route?.query?.view || "assigned"; // assigned | closed
  const q = route?.query?.q || "";

  setHtml(renderAgent({ user, pushStatus: lastPushStatus, view, q, items: [], tasks: [] }));
  bindCommonTopBar(user);

  // Bind controls (اختياري حسب UI)
  qs("#btnRefresh")?.addEventListener("click", async () => {
    await renderAgentPage(parseRoute(window.location.hash), user);
  });

  qs("#btnTabAssigned")?.addEventListener("click", () => {
    suppressNextHash = true;
    goto(buildHash("#/agent", { view: "assigned", q }));
    renderCurrentRoute().catch(() => {});
  });
  qs("#btnTabClosed")?.addEventListener("click", () => {
    suppressNextHash = true;
    goto(buildHash("#/agent", { view: "closed", q }));
    renderCurrentRoute().catch(() => {});
  });

  const $search = qs("#q");
  if ($search) {
    $search.value = q;
    $search.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      suppressNextHash = true;
      goto(buildHash("#/agent", { view, q: $search.value.trim() }));
      renderCurrentRoute().catch(() => {});
    });
  }

  try {
    const out = await loadRequests({ view, q, limit: 200, offset: 0 });
    const items = out.items || [];
    setHtml(renderAgent({ user, pushStatus: lastPushStatus, view, q, items, tasks: items, pagination: out.pagination }));
    bindCommonTopBar(user);
    bindAgentActions(); // تفويض أزرار (إغلاق/وزن/اتصال/واتساب/خريطة) إذا كانت موجودة بالـ UI
  } catch (e) {
    setHtml(
      renderAgent({
        user,
        pushStatus: lastPushStatus,
        view,
        q,
        items: [],
        tasks: [],
        tasksError: e?.message || "فشل جلب الطلبات",
        error: e?.message || "فشل جلب الطلبات",
      })
    );
    bindCommonTopBar(user);
  }
}

function bindAgentActions() {
  // Event Delegation: أي زر يحمل data-action و data-id
  $app?.addEventListener(
    "click",
    async (e) => {
      const btn = e.target?.closest?.("[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      if (!action) return;

      try {
        if (action === "call") {
          const phone = btn.getAttribute("data-phone");
          if (phone) window.location.href = `tel:${phone}`;
          return;
        }
        if (action === "whatsapp") {
          const phone = btn.getAttribute("data-phone");
          if (phone) window.open(`https://wa.me/${phone.replace(/[^\d]/g, "")}`, "_blank");
          return;
        }
        if (action === "map") {
          const lat = btn.getAttribute("data-lat");
          const lng = btn.getAttribute("data-lng");
          if (lat && lng) window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
          return;
        }
        if (action === "open") {
          if (id) {
            suppressNextHash = true;
            goto(`#/requests/${encodeURIComponent(id)}`);
            renderCurrentRoute().catch(() => {});
          }
          return;
        }

        // العمليات التالية تعتمد على API لديك (PATCH /api/requests/:id)
        if (!id) return;

        if (action === "saveWeight") {
          const inputSel = btn.getAttribute("data-input") || `#weight_${CSS.escape(id)}`;
          const v = qs(inputSel)?.value;
          const weight = v === "" || v == null ? null : Number(v);
          await fetchJsonAuth(`/api/requests/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: { weight },
            timeoutMs: API_TIMEOUT_MS,
          });
          await renderCurrentRoute();
          return;
        }

        if (action === "close") {
          await fetchJsonAuth(`/api/requests/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: { status: "مكتمل", closed_at: new Date().toISOString() },
            timeoutMs: API_TIMEOUT_MS,
          });
          await renderCurrentRoute();
          return;
        }
      } catch (err) {
        alert(err?.message || "فشل تنفيذ العملية");
      }
    },
    { passive: true }
  );
}

async function renderStaffPage(route, user) {
  // staff: استقبال جديد + مسند + مكتمل
  const view = route?.query?.view || "new"; // new | assigned | closed
  const q = route?.query?.q || "";

  setHtml(renderStaff({ user, pushStatus: lastPushStatus, view, q, items: [] }));
  bindCommonTopBar(user);

  try {
    const [reqOut, agentsOut] = await Promise.allSettled([
      loadRequests({ view, q, limit: 200, offset: 0 }),
      loadUsers({ role: "agent" }),
    ]);

    const items = reqOut.status === "fulfilled" ? reqOut.value.items || [] : [];
    const agents = agentsOut.status === "fulfilled" ? agentsOut.value.items || agentsOut.value.users || [] : [];

    setHtml(
      renderStaff({
        user,
        pushStatus: lastPushStatus,
        view,
        q,
        items,
        agents,
        pagination: reqOut.status === "fulfilled" ? reqOut.value.pagination : undefined,
        error: reqOut.status === "rejected" ? (reqOut.reason?.message || "فشل جلب الطلبات") : null,
      })
    );
    bindCommonTopBar(user);
  } catch (e) {
    setHtml(renderStaff({ user, pushStatus: lastPushStatus, view, q, items: [], error: e?.message || "خطأ" }));
    bindCommonTopBar(user);
  }
}

async function renderAdminPage(route, user) {
  const view = route?.query?.view || "all";
  const q = route?.query?.q || "";

  setHtml(renderAdmin({ user, pushStatus: lastPushStatus, view, q, items: [] }));
  bindCommonTopBar(user);

  try {
    const [reqOut, kpis] = await Promise.all([loadRequests({ view, q, limit: 200, offset: 0 }), loadAdminKpis()]);
    setHtml(
      renderAdmin({
        user,
        pushStatus: lastPushStatus,
        view,
        q,
        items: reqOut.items || [],
        pagination: reqOut.pagination,
        kpis,
      })
    );
    bindCommonTopBar(user);
  } catch (e) {
    setHtml(renderAdmin({ user, pushStatus: lastPushStatus, view, q, items: [], error: e?.message || "خطأ" }));
    bindCommonTopBar(user);
  }
}

async function renderHomePage(route, user) {
  setHtml(renderHome({ user, pushStatus: lastPushStatus }));
  bindCommonTopBar(user);
}

async function showLoginPage(message = "") {
  setHtml(renderLogin({ message }));
  const form = qs("#loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = qs("#username")?.value?.trim();
    const password = qs("#password")?.value;

    if (!username || !password) {
      await showLoginPage("أدخل اسم المستخدم وكلمة المرور");
      return;
    }

    setHtml(renderLoading("جاري تسجيل الدخول..."));
    try {
      const user = await safeLogin(username, password);
      lastUser = user;

      const target = roleToHome(user.role) || "#/home";
      suppressNextHash = true;
      goto(target);
      await renderCurrentRoute();
    } catch (err) {
      clearToken();
      await showLoginPage(err?.message || "فشل تسجيل الدخول");
    }
  });
}

async function renderRoute(route, user) {
  // لو ما في مستخدم => صفحة الدخول
  if (!user) {
    // لو المستخدم على صفحة غير login، حوّله
    if (route?.name !== "login") {
      suppressNextHash = true;
      goto("#/login");
    }
    await showLoginPage("");
    return;
  }

  // تأكد من تطابق الدور مع الصفحة
  const expected = (roleToHome(user.role) || "#/home").replace("#/", "");
  if (route?.name !== expected && route?.name !== "request_details") {
    // بدل ما نترك شاشة التحميل، نعرض انتقال
    setHtml(renderLoading("جاري فتح اللوحة..."));
    suppressNextHash = true;
    goto(roleToHome(user.role) || "#/home");
    // ثم نعيد الرسم مباشرة بدل الاعتماد على الحدث
    const newRoute = parseRoute(window.location.hash);
    await renderRoute(newRoute, user);
    return;
  }

  switch (route?.name) {
    case "login":
      // لو وصل login وهو مسجل، نعيده للوحة
      suppressNextHash = true;
      goto(roleToHome(user.role) || "#/home");
      await renderCurrentRoute();
      return;

    case "agent":
      await renderAgentPage(route, user);
      return;

    case "staff":
      await renderStaffPage(route, user);
      return;

    case "admin":
      await renderAdminPage(route, user);
      return;

    default:
      await renderHomePage(route, user);
  }
}

async function renderCurrentRoute() {
  const route = parseRoute(window.location.hash || "#/home");
  const user = await safeMe();
  lastUser = user;

  // حالة الاشعارات
  if (!lastPushStatus) {
    lastPushStatus = await getPushStatus().catch(() => ({ supported: false, enabled: false }));
  }

  await renderRoute(route, user);
}

async function boot() {
  // لا تترك صفحة تحميل بلا نهاية
  setHtml(renderLoading("تحميل الإعدادات..."));

  try {
    await loadAppConfig(); // لديه fallback داخلي
  } catch (e) {
    // لا نوقف التطبيق، نكمل لكن نظهر تنبيه داخل الواجهة
    setHtml(renderLoading("متابعة بدون إعدادات (تعذر تحميل الإعدادات)..."));
  }

  // محاولات تفعيل push (لا يجب أن يعلق التطبيق)
  try {
    await Promise.race([
      initPush(),
      new Promise((resolve) => setTimeout(resolve, 4000)), // لا ننتظر للأبد
    ]);
  } catch {
    // تجاهل
  }

  // تحميل أولي
  await renderCurrentRoute();
}

// حماية إضافية: لا تترك التطبيق في “تحميل” لو صار Unhandled
window.addEventListener("unhandledrejection", (e) => {
  showFatalError(e?.reason || e);
});
window.addEventListener("error", (e) => {
  showFatalError(e?.error || e?.message || e);
});

window.addEventListener("hashchange", () => {
  if (suppressNextHash) {
    suppressNextHash = false;
    return;
  }
  renderCurrentRoute().catch(showFatalError);
});

boot().catch(showFatalError);
