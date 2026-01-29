// ui.js

function elRoot(root) {
  // ✅ يمنع root.querySelector is not a function
  if (!root) return document;
  if (root instanceof Element || root === document) return root;
  if (root instanceof NodeList || Array.isArray(root)) return root[0] || document;
  return document;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function phoneClean(p) {
  const s = String(p || "").trim();
  return s.replace(/[^\d+]/g, "");
}

function mapsUrl(lat, lng) {
  if (lat == null || lng == null) return "";
  return `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&z=16`;
}

function mapsEmbed(lat, lng) {
  if (lat == null || lng == null) return "";
  return `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&z=15&output=embed`;
}

export function renderLoading(msg = "جاري التحميل ...") {
  return `
  <div class="card">
    <div style="text-align:center;padding:40px">
      <div class="spinner" style="margin:0 auto 12px;width:46px;height:46px;border-radius:50%;border:5px solid rgba(255,255,255,.15);border-top-color:#7c5cff;animation:spin 1s linear infinite"></div>
      <div style="opacity:.9">${esc(msg)}</div>
    </div>
  </div>
  <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;
}

export function renderLogin({ error = "" } = {}) {
  return `
  <div class="card">
    <h2 style="margin:0 0 10px">تسجيل الدخول</h2>
    ${error ? `<div class="alert alert-error" style="margin:10px 0">${esc(error)}</div>` : ""}
    <form id="loginForm">
      <input id="username" placeholder="اسم المستخدم" autocomplete="username" required />
      <input id="password" type="password" placeholder="كلمة المرور" autocomplete="current-password" required />
      <button id="btnLogin" type="submit">دخول</button>
      <button id="btnRetry" type="button">إعادة المحاولة</button>
    </form>
    <div id="loginMsg" style="margin-top:10px;opacity:.9"></div>
  </div>
  `;
}

export function bindLogin(root, { onLogin, onRetry } = {}) {
  root = elRoot(root);
  const form = root.querySelector("#loginForm");
  const msg = root.querySelector("#loginMsg");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      msg && (msg.textContent = "جاري الدخول...");
      const u = root.querySelector("#username")?.value?.trim() || "";
      const p = root.querySelector("#password")?.value || "";
      await onLogin?.(u, p);
    } catch (err) {
      msg && (msg.textContent = err?.message || "فشل تسجيل الدخول");
    }
  });

  root.querySelector("#btnRetry")?.addEventListener("click", () => onRetry?.());
}

function header(user) {
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px">
    <div>
      <div style="font-size:26px;font-weight:700">مرحباً ${esc(user?.name || user?.username || "")}</div>
      <div style="opacity:.85">الدور: <b>${esc(user?.role || "")}</b></div>
    </div>
    <div style="display:flex;gap:10px;align-items:center">
      <button id="btnRefresh">تحديث</button>
      <button id="btnLogout" class="danger">تسجيل الخروج</button>
    </div>
  </div>
  <hr style="opacity:.25" />
  `;
}

function kpiBox(label, val) {
  return `<div class="kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-val">${esc(val)}</div></div>`;
}

function requestCard(item, role) {
  const id = item.id;
  const name = item.customer_name || item.customer_nam || "—";
  const phone = item.phone || "—";
  const district = item.district || "—";
  const status = item.status || "مسند";
  const lat = item.lat;
  const lng = item.lng;
  const weight = item.weight ?? "";

  const tel = phoneClean(phone);
  const wa = tel ? `https://wa.me/${tel}` : "";
  const map = mapsUrl(lat, lng);
  const emb = mapsEmbed(lat, lng);

  return `
  <div class="req" data-id="${esc(id)}">
    <div class="req-top">
      <div>
        <div class="req-id">${esc(id)}</div>
        <div class="req-name">${esc(name)} <span class="badge">${esc(status)}</span></div>
        <div class="req-meta">📞 ${esc(phone)} • 📍 ${esc(district)}</div>
      </div>
      <div class="req-actions">
        ${tel !== "—" ? `<a class="btn" href="tel:${esc(tel)}">اتصال</a>` : ""}
        ${wa ? `<a class="btn" target="_blank" href="${esc(wa)}">واتساب</a>` : ""}
        ${map ? `<a class="btn" target="_blank" href="${esc(map)}">الخريطة</a>` : ""}
      </div>
    </div>

    ${emb ? `<div class="map"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(emb)}"></iframe></div>` : ""}

    ${
      role === "agent"
        ? `
      <div class="req-bottom">
        <input class="inpWeight" type="number" min="0" step="1" placeholder="الوزن" value="${esc(weight)}" />
        <button class="btnSaveWeight">حفظ الوزن</button>
        <button class="btnClose danger">إغلاق الطلب</button>
      </div>`
        : ""
    }

    ${
      role === "staff" || role === "admin"
        ? `
      <div class="req-bottom">
        <select class="selAgent"></select>
        <button class="btnAssign">إسناد</button>
        <button class="btnMarkDone danger">إغلاق</button>
      </div>`
        : ""
    }
  </div>
  `;
}

export function renderAgentPage({ user, items = [], view = "assigned", q = "", kpis = null, error = "" } = {}) {
  const assignedActive = view === "assigned" ? "active" : "";
  const closedActive = view === "closed" ? "active" : "";
  return `
  ${header(user)}
  ${error ? `<div class="alert alert-error">${esc(error)}</div>` : ""}

  <div class="kpis">
    ${kpis ? kpiBox("المسندة", kpis.assigned) + kpiBox("المكتملة", kpis.closed) + kpiBox("الإجمالي", kpis.total) : ""}
  </div>

  <div class="toolbar">
    <input id="q" value="${esc(q)}" placeholder="بحث (اسم/رقم/حي/رقم طلب)" />
    <button id="tabAssigned" class="${assignedActive}">المسندة</button>
    <button id="tabClosed" class="${closedActive}">المكتملة</button>
  </div>

  <div id="list">
    ${items.length ? items.map((it) => requestCard(it, "agent")).join("") : `<div class="empty">لا توجد طلبات حالياً</div>`}
  </div>

  <style>
    .card{padding:22px;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}
    input,select,button,.btn{border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.15);color:#fff;padding:12px 14px}
    button,.btn{cursor:pointer}
    button.active{background:#6d59ff;border-color:#6d59ff}
    button.danger{background:rgba(255,80,80,.18);border-color:rgba(255,80,80,.35)}
    .alert{padding:12px 14px;border-radius:14px;margin:10px 0}
    .alert-error{background:rgba(255,80,80,.18);border:1px solid rgba(255,80,80,.35)}
    .toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:14px 0}
    .toolbar input{flex:1;min-width:240px}
    .kpis{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
    .kpi{flex:1;min-width:140px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);padding:14px;border-radius:16px}
    .kpi-label{opacity:.85;font-size:14px}
    .kpi-val{font-size:28px;font-weight:800;margin-top:6px}
    .req{margin:12px 0;padding:14px;border-radius:16px;background:rgba(0,0,0,.14);border:1px solid rgba(255,255,255,.08)}
    .req-top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .req-actions{display:flex;gap:8px;flex-wrap:wrap}
    .req-id{font-weight:800;letter-spacing:.2px}
    .req-name{margin-top:6px;font-size:18px;font-weight:700}
    .req-meta{margin-top:6px;opacity:.85}
    .badge{margin-inline-start:8px;padding:4px 10px;border-radius:999px;font-size:12px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.12)}
    .req-bottom{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
    .req-bottom .inpWeight{width:140px}
    .map{margin-top:10px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.10)}
    .map iframe{width:100%;height:220px;border:0}
    .empty{padding:18px;text-align:center;opacity:.85}
  </style>
  `;
}

export function bindCommon(root, { onLogout, onRefresh } = {}) {
  root = elRoot(root);
  root.querySelector("#btnLogout")?.addEventListener("click", () => onLogout?.());
  root.querySelector("#btnRefresh")?.addEventListener("click", () => onRefresh?.());
}

export function bindAgent(root, handlers = {}) {
  root = elRoot(root);

  root.querySelector("#tabAssigned")?.addEventListener("click", () => handlers.onSwitchView?.("assigned"));
  root.querySelector("#tabClosed")?.addEventListener("click", () => handlers.onSwitchView?.("closed"));

  root.querySelector("#q")?.addEventListener("input", (e) => handlers.onSearch?.(e.target.value));

  root.querySelectorAll(".req").forEach((card) => {
    const id = card.getAttribute("data-id");

    card.querySelector(".btnSaveWeight")?.addEventListener("click", () => {
      const w = card.querySelector(".inpWeight")?.value;
      handlers.onSaveWeight?.(id, w);
    });

    card.querySelector(".btnClose")?.addEventListener("click", () => handlers.onClose?.(id));
  });
}
