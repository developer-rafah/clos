// public/assets/js/ui.js
import { apiGet, apiPost, setToken, clearToken } from "./api.js";
import { go, roleToHome } from "./router.js";

const LS_ME = "CLOS_ME_V1";

function $(sel) {
  return document.querySelector(sel);
}

function setMain(html) {
  const root = $("#app") || document.body;
  root.innerHTML = html;
}

export function renderLoading(text = "Loading...") {
  setMain(`
    <div style="min-height:60vh;display:grid;place-items:center;font-family:Tajawal,Arial,sans-serif;color:#fff">
      <div style="text-align:center;opacity:.9">
        <div style="margin-bottom:10px">${escapeHtml(text)}</div>
        <div style="width:44px;height:44px;border-radius:999px;border:4px solid rgba(255,255,255,.18);border-top-color:#7a5ea8;animation:spin 1s linear infinite"></div>
      </div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `);
}

export function renderError(msg) {
  setMain(`
    <div style="padding:18px;font-family:Tajawal,Arial,sans-serif;color:#fff">
      <div style="max-width:680px;margin:24px auto;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px">
        <h3 style="margin:0 0 10px">حدث خطأ</h3>
        <pre style="white-space:pre-wrap;direction:ltr;background:rgba(0,0,0,.25);padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.12)">${escapeHtml(
          msg || "Unknown error"
        )}</pre>
        <button id="btnBack" style="margin-top:12px;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;cursor:pointer">رجوع</button>
      </div>
    </div>
  `);
  $("#btnBack")?.addEventListener("click", () => history.back());
}

export function renderLogin() {
  setMain(`
    <div style="padding:18px;font-family:Tajawal,Arial,sans-serif;color:#fff">
      <div style="max-width:520px;margin:24px auto;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px">
        <h2 style="margin:0 0 12px">تسجيل الدخول</h2>

        <label>اسم المستخدم</label>
        <input id="username" autocomplete="username" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.18);color:#fff;outline:none" />

        <label style="display:block;margin-top:10px">كلمة المرور</label>
        <input id="password" type="password" autocomplete="current-password" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.18);color:#fff;outline:none" />

        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
          <button id="btnLogin" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(109,76,255,.45);background:#6d4cff;color:#fff;cursor:pointer">دخول</button>
          <button id="btnClear" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;cursor:pointer">مسح الجلسة</button>
        </div>

        <div id="err" style="margin-top:12px;color:#ffb4b4;white-space:pre-wrap"></div>
      </div>
    </div>
  `);

  $("#btnClear")?.addEventListener("click", () => {
    clearToken();
    try { localStorage.removeItem(LS_ME); } catch {}
    $("#err").textContent = "تم مسح الجلسة.";
  });

  $("#btnLogin")?.addEventListener("click", async () => {
    const username = String($("#username")?.value || "").trim();
    const password = String($("#password")?.value || "").trim();
    $("#err").textContent = "";

    if (!username || !password) {
      $("#err").textContent = "الرجاء إدخال اسم المستخدم وكلمة المرور.";
      return;
    }

    try {
      // login endpoint returns { ok, success, user, token }
      const out = await apiPost("/api/auth/login", { username, password });

      const token = String(out?.token || "").trim();
      const user = out?.user || null;

      if (!token || !user) throw new Error("Login response missing token/user");

      setToken(token);
      try { localStorage.setItem(LS_ME, JSON.stringify(user)); } catch {}

      go(roleToHome(user.role));
    } catch (e) {
      $("#err").textContent = e?.message || String(e);
    }
  });
}

export function renderDashboard({ route, me }) {
  // UI بسيطة، تقدر تربطها بواجهتك الحالية
  setMain(`
    <div style="padding:18px;font-family:Tajawal,Arial,sans-serif;color:#fff">
      <div style="max-width:900px;margin:0 auto">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-size:22px;font-weight:700">مرحباً ${escapeHtml(me?.name || me?.username || "")}</div>
            <div style="opacity:.8;margin-top:4px">الدور: ${escapeHtml(me?.role || "")} — الصفحة: ${escapeHtml(route)}</div>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button id="btnRefreshMe" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;cursor:pointer">تحديث</button>
            <button id="btnLogout" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(255,80,80,.35);background:rgba(255,80,80,.12);color:#fff;cursor:pointer">تسجيل الخروج</button>
          </div>
        </div>

        <div style="margin-top:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px">
          <h3 style="margin:0 0 10px">اختبار سريع للـ API</h3>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button id="btnTestMe" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;cursor:pointer">/api/auth/me</button>
            <button id="btnTestRequests" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;cursor:pointer">/api/requests</button>
          </div>

          <pre id="out" style="margin-top:12px;white-space:pre-wrap;direction:ltr;background:rgba(0,0,0,.25);padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.12)"></pre>
        </div>
      </div>
    </div>
  `);

  $("#btnLogout")?.addEventListener("click", async () => {
    try {
      // لو السيرفر يحتاج auth logout
      await apiPost("/api/auth/logout", {}, { auth: true }).catch(() => {});
    } finally {
      clearToken();
      try { localStorage.removeItem(LS_ME); } catch {}
      go("login");
    }
  });

  $("#btnRefreshMe")?.addEventListener("click", async () => {
    try {
      const out = await apiGet("/api/auth/me", { auth: true });
      const user = out?.user || null;
      if (user) {
        try { localStorage.setItem(LS_ME, JSON.stringify(user)); } catch {}
      }
      $("#out").textContent = JSON.stringify(out, null, 2);
    } catch (e) {
      $("#out").textContent = String(e?.message || e);
    }
  });

  $("#btnTestMe")?.addEventListener("click", async () => {
    try {
      const out = await apiGet("/api/auth/me", { auth: true });
      $("#out").textContent = JSON.stringify(out, null, 2);
    } catch (e) {
      $("#out").textContent = String(e?.message || e);
    }
  });

  $("#btnTestRequests")?.addEventListener("click", async () => {
    try {
      const out = await apiGet("/api/requests", { auth: true });
      $("#out").textContent = JSON.stringify(out, null, 2);
    } catch (e) {
      $("#out").textContent = String(e?.message || e);
    }
  });
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (ch) => {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[ch];
  });
}
