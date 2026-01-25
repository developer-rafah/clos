// public/assets/js/app.js
import { apiGet, me, logoutApi, debugToken, clearToken } from "./api.js";
import { showLoading, hideLoading, toast, render, escapeHtml } from "./ui.js";
import { on, go, start } from "./router.js";

// ===== Views (خفيفة وبسيطة) =====

function viewLogin() {
  // لو عندك صفحة دخول أصلاً تجاهلها—هذه fallback فقط
  render(`
    <div style="padding:18px;color:#fff;font-family:system-ui,Segoe UI,Tahoma,Arial;max-width:560px;margin:0 auto">
      <h3 style="margin:0 0 8px">تسجيل الدخول</h3>
      <div style="opacity:.85;margin-bottom:12px">لا يوجد جلسة أو انتهت. سجّل دخولك من الواجهة.</div>
      <div style="opacity:.7;font-size:13px">Debug: ${escapeHtml(JSON.stringify(debugToken()))}</div>
    </div>
  `);
}

function viewAgentHome(user) {
  render(`
    <div style="padding:18px;color:#fff;font-family:system-ui,Segoe UI,Tahoma,Arial;max-width:860px;margin:0 auto">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
        <div>
          <div style="font-size:22px;font-weight:700">مرحباً ${escapeHtml(user?.name || user?.username || "")}</div>
          <div style="opacity:.75">الدور: ${escapeHtml(user?.role || "")}</div>
        </div>
        <button id="btnLogout" style="padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.15);
          background:rgba(20,14,30,.55);color:#fff;cursor:pointer">تسجيل الخروج</button>
      </div>

      <hr style="border:none;border-top:1px solid rgba(255,255,255,.12);margin:16px 0"/>

      <div style="display:flex;gap:10px;align-items:center;justify-content:space-between">
        <h4 style="margin:0">الطلبات</h4>
        <button id="btnReload" style="padding:8px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.15);
          background:rgba(20,14,30,.35);color:#fff;cursor:pointer">تحديث</button>
      </div>

      <div id="reqBox" style="margin-top:12px"></div>
    </div>
  `);

  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    showLoading("تسجيل الخروج...");
    await logoutApi();
    hideLoading();
    toast("تم تسجيل الخروج", "success");
    go("#/login");
  });

  document.getElementById("btnReload")?.addEventListener("click", () => {
    void loadRequests();
  });

  void loadRequests();
}

async function loadRequests() {
  const box = document.getElementById("reqBox");
  if (!box) return;

  showLoading("تحميل الطلبات...");
  try {
    // ✅ مهم: auth:true حتى يُرسل Authorization: Bearer <token>
    const data = await apiGet("/api/requests", { auth: true });
    hideLoading();

    const items = Array.isArray(data?.requests) ? data.requests : (Array.isArray(data?.data) ? data.data : []);
    if (!items.length) {
      box.innerHTML = `<div style="opacity:.75">لا توجد طلبات حالياً.</div>`;
      return;
    }

    box.innerHTML = items
      .map((r) => {
        const id = escapeHtml(r?.id ?? "");
        const status = escapeHtml(r?.status ?? "");
        const title = escapeHtml(r?.title ?? r?.name ?? r?.type ?? "طلب");
        return `
          <div style="padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.12);
            background:rgba(20,14,30,.35);margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;gap:10px">
              <div style="font-weight:700">${title}</div>
              <div style="opacity:.75">${status}</div>
            </div>
            <div style="opacity:.65;font-size:13px;margin-top:6px">#${id}</div>
          </div>
        `;
      })
      .join("");
  } catch (e) {
    hideLoading();

    const status = e?.status;
    const msg = e?.message || String(e);

    // ✅ لا نترك اللودر: نعالج 401/403 بشكل واضح
    if (status === 401 || status === 403) {
      toast("انتهت الجلسة أو لا تملك صلاحية. سيتم تحويلك للدخول.", "error", 3200);
      clearToken();
      go("#/login");
      return;
    }

    toast(msg, "error", 4000);
    box.innerHTML = `<div style="opacity:.75;color:#ffb4b4">فشل تحميل الطلبات: ${escapeHtml(msg)}</div>`;
  }
}

// ===== Boot / Routing =====

async function routeAuto() {
  showLoading("التحقق من الجلسة...");

  // لو ما فيه توكن: دخول
  const hasToken = !!debugToken().hasToken;
  if (!hasToken) {
    hideLoading();
    go("#/login");
    return;
  }

  try {
    // ✅ مهم: /api/auth/me يحتاج Authorization
    const out = await me();
    hideLoading();

    const user = out?.user || out?.data?.user || out?.me || out?.data || null;
    const role = String(user?.role || "").trim();

    if (role === "مندوب" || role.toLowerCase?.() === "agent") {
      go("#/agent");
    } else if (role === "موظف" || role.toLowerCase?.() === "staff") {
      go("#/staff");
    } else if (role === "مدير" || role.toLowerCase?.() === "admin") {
      go("#/admin");
    } else {
      // fallback
      go("#/agent");
    }
  } catch (e) {
    hideLoading();
    toast("تعذر التحقق من الجلسة. سيتم تحويلك للدخول.", "error", 3200);
    clearToken();
    go("#/login");
  }
}

async function routeAgent() {
  showLoading("تحميل الصفحة...");
  try {
    const out = await me(); // يثبت أن التوكن صالح
    hideLoading();
    const user = out?.user || out?.data?.user || out?.me || out?.data || {};
    viewAgentHome(user);
  } catch (e) {
    hideLoading();
    clearToken();
    go("#/login");
  }
}

// صفحات placeholder لو تحتاج
async function routeStaff() {
  render(`<div style="padding:18px;color:#fff">صفحة الموظف (قيد الإعداد)</div>`);
}
async function routeAdmin() {
  render(`<div style="padding:18px;color:#fff">صفحة المدير (قيد الإعداد)</div>`);
}

function boot() {
  on("#/", routeAuto);
  on("#/login", async () => viewLogin(), { auth: false });
  on("#/agent", routeAgent, { auth: true });
  on("#/staff", routeStaff, { auth: true });
  on("#/admin", routeAdmin, { auth: true });

  // start router
  void start();
}

boot();
