// ui.js - FULL (safe + compatible)

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusBadge(status) {
  const st = String(status || "").trim();
  const map = {
    "جديد": "badge badge-new",
    "مسند": "badge badge-assigned",
    "مكتمل": "badge badge-closed",
    "مكتملة": "badge badge-closed",
    "مغلق": "badge badge-closed",
    "ملغي": "badge badge-cancelled",
    "ملغى": "badge badge-cancelled",
    "مرفوض": "badge badge-cancelled",
  };
  const cls = map[st] || "badge";
  return `<span class="${cls}">${esc(st || "—")}</span>`;
}

function kpiCard(title, value) {
  return `
    <div class="kpi">
      <div class="kpi-title">${esc(title)}</div>
      <div class="kpi-value">${Number(value || 0)}</div>
    </div>
  `;
}

function renderTopBar({ user, roleLabel }) {
  return `
    <div class="topbar">
      <div class="brand">
        <div class="logo">Clos</div>
        <div class="sub">جمعية رفح</div>
      </div>
      <div class="user">
        <div class="hello">مرحباً ${esc(user?.name || user?.username || "")}</div>
        <div class="role">الدور: <span class="pill">${esc(roleLabel)}</span></div>
      </div>
      <div class="actions">
        <button class="btn danger" data-action="logout">تسجيل الخروج</button>
      </div>
    </div>
  `;
}

function renderSearchRow({ q, viewButtonsHtml, rightButtonsHtml }) {
  return `
    <div class="row">
      <div class="views">${viewButtonsHtml || ""}</div>
      <div class="search">
        <input id="searchInput" placeholder="بحث (اسم/رقم/حي/رقم طلب)" value="${esc(q || "")}" />
        <button class="btn primary" data-action="search">بحث</button>
      </div>
      <div class="right">${rightButtonsHtml || ""}</div>
    </div>
  `;
}

function renderPagination(pagination, itemsLen) {
  const shown = Number(itemsLen || 0);
  const total = Number(pagination?.total || pagination?.count || 0);
  const canMore = shown < total;
  return `
    <div class="pagination">
      <div class="muted">المعروض: ${shown} / ${total}</div>
      ${canMore ? `<button class="btn" data-action="loadMore">تحميل المزيد</button>` : ""}
      <button class="btn" data-action="refresh">تحديث</button>
    </div>
  `;
}

function mapEmbed(lat, lng) {
  const la = Number(lat), ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return "";
  const src = `https://www.google.com/maps?q=${la},${ln}&z=15&output=embed`;
  return `
    <div class="map">
      <iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade"
        src="${src}" width="100%" height="220" style="border:0;border-radius:12px"></iframe>
    </div>
  `;
}

function requestCardAgent(item) {
  const id = item.id;
  const phone = item.phone || "";
  const wa = phone ? `https://wa.me/${String(phone).replace(/\D/g, "")}` : "";
  const canMap = Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng));

  return `
    <div class="card">
      <div class="card-head">
        <div class="id">${esc(id)}</div>
        <div class="meta">
          <div class="name">${esc(item.customer_name || "—")}</div>
          ${statusBadge(item.status)}
        </div>
      </div>

      <div class="card-body">
        <div class="info">
          <div>📞 ${esc(phone || "—")}</div>
          <div>📍 ${esc(item.district || "—")}</div>
          <div>⚖️ الوزن: <b>${esc(item.weight ?? "—")}</b></div>
        </div>

        <div class="btns">
          ${phone ? `<a class="btn" href="tel:${esc(phone)}">اتصال</a>` : `<button class="btn" disabled>اتصال</button>`}
          ${wa ? `<a class="btn" target="_blank" href="${wa}">واتساب</a>` : `<button class="btn" disabled>واتساب</button>`}
          ${canMap ? `<a class="btn" target="_blank" href="https://www.google.com/maps?q=${esc(item.lat)},${esc(item.lng)}">الخريطة</a>` : `<button class="btn" disabled>الخريطة</button>`}
        </div>

        <div class="actions-row">
          <input id="weight-${esc(id)}" class="weight" type="number" min="1" step="1" placeholder="الوزن"
            value="${esc(item.weight ?? "")}">
          <button class="btn primary" data-action="saveWeight" data-id="${esc(id)}">حفظ الوزن</button>
          <button class="btn success" data-action="closeRequest" data-id="${esc(id)}">إغلاق الطلب</button>
        </div>

        ${mapEmbed(item.lat, item.lng)}
      </div>
    </div>
  `;
}

function requestCardStaffAdmin(item, agents = []) {
  const id = item.id;
  const phone = item.phone || "";
  const wa = phone ? `https://wa.me/${String(phone).replace(/\D/g, "")}` : "";
  const canMap = Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng));
  const current = item.agent_name || "";

  const agentsOptions = agents
    .map((a) => {
      const label = a.name ? `${a.name} (${a.username})` : a.username;
      const val = a.name || a.username; // نكتب agent_name (كما طلبت)
      const sel = val === current ? "selected" : "";
      return `<option value="${esc(val)}" ${sel}>${esc(label)}</option>`;
    })
    .join("");

  return `
    <div class="card">
      <div class="card-head">
        <div class="id">${esc(id)}</div>
        <div class="meta">
          <div class="name">${esc(item.customer_name || "—")}</div>
          ${statusBadge(item.status)}
        </div>
      </div>

      <div class="card-body">
        <div class="info">
          <div>📞 ${esc(phone || "—")}</div>
          <div>📍 ${esc(item.district || "—")}</div>
          <div>👤 المندوب: <b>${esc(item.agent_name || "—")}</b></div>
        </div>

        <div class="btns">
          ${phone ? `<a class="btn" href="tel:${esc(phone)}">اتصال</a>` : `<button class="btn" disabled>اتصال</button>`}
          ${wa ? `<a class="btn" target="_blank" href="${wa}">واتساب</a>` : `<button class="btn" disabled>واتساب</button>`}
          ${canMap ? `<a class="btn" target="_blank" href="https://www.google.com/maps?q=${esc(item.lat)},${esc(item.lng)}">الخريطة</a>` : `<button class="btn" disabled>الخريطة</button>`}
        </div>

        <div class="actions-row">
          <select id="agent-${esc(id)}" class="select">
            <option value="">اختر مندوب...</option>
            ${agentsOptions}
          </select>
          <button class="btn primary" data-action="assign" data-id="${esc(id)}">إسناد</button>
        </div>

        ${mapEmbed(item.lat, item.lng)}
      </div>
    </div>
  `;
}

function shell({ user, roleLabel, content, error }) {
  return `
  <div class="page">
    ${renderTopBar({ user, roleLabel })}
    ${error ? `<div class="banner error">${esc(error)}</div>` : ""}
    <div class="container">
      ${content}
    </div>
  </div>

  <style>
    /* Minimal styling helpers (لا يكسر ستايلك الحالي) */
    .page{direction:rtl;font-family:system-ui}
    .topbar{display:flex;gap:16px;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08)}
    .brand .logo{font-weight:800;font-size:18px}
    .brand .sub{opacity:.7;font-size:13px;margin-top:2px}
    .pill{padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.15)}
    .container{padding:18px;max-width:1050px;margin:0 auto}
    .row{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:12px 0 18px}
    .search{display:flex;gap:10px;align-items:center;flex:1;min-width:280px;justify-content:flex-end}
    #searchInput{flex:1;min-width:260px;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.18);color:#fff}
    .views{display:flex;gap:10px;flex-wrap:wrap}
    .kpis{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:12px;margin:12px 0 16px}
    .kpi{padding:14px;border-radius:18px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.14);text-align:center}
    .kpi-title{opacity:.8;font-size:13px}
    .kpi-value{font-size:26px;font-weight:800;margin-top:6px}
    .cards{display:flex;flex-direction:column;gap:14px}
    .card{padding:14px;border-radius:22px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.14)}
    .card-head{display:flex;justify-content:space-between;gap:12px;align-items:center}
    .id{font-weight:800;opacity:.95}
    .meta{display:flex;gap:10px;align-items:center}
    .name{font-weight:700}
    .info{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0;color:rgba(255,255,255,.9)}
    .btns{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
    .actions-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:8px 0 10px}
    .weight,.select{padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.18);color:#fff;min-width:160px}
    .btn{padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
    .btn.primary{background:#6b5cff;border-color:transparent}
    .btn.success{background:#2aa36b;border-color:transparent}
    .btn.danger{background:#8b2b3d;border-color:transparent}
    .btn[disabled]{opacity:.5;cursor:not-allowed}
    .badge{padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.18);opacity:.95}
    .badge-new{background:rgba(91,173,255,.14)}
    .badge-assigned{background:rgba(123,97,255,.16)}
    .badge-closed{background:rgba(42,163,107,.16)}
    .badge-cancelled{background:rgba(255,99,132,.14)}
    .pagination{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:14px 0}
    .muted{opacity:.75}
    .banner{padding:12px 14px;border-radius:14px;margin:12px auto;max-width:1050px}
    .banner.error{background:rgba(255,99,132,.16);border:1px solid rgba(255,99,132,.35)}
  </style>
  `;
}

export function renderLogin({ error } = {}) {
  return `
  <div class="page">
    <div class="container" style="max-width:520px">
      <h2 style="margin:16px 0;color:#fff">تسجيل الدخول</h2>
      ${error ? `<div class="banner error">${esc(error)}</div>` : ""}
      <form id="loginForm" class="card">
        <div style="display:flex;flex-direction:column;gap:10px">
          <input name="username" placeholder="اسم المستخدم" class="select" autocomplete="username" />
          <input name="password" placeholder="كلمة المرور" class="select" type="password" autocomplete="current-password" />
          <button class="btn primary" type="submit">دخول</button>
          <button class="btn" type="button" data-action="retry">إعادة المحاولة</button>
        </div>
      </form>
    </div>
  </div>`;
}

export function renderAgent({ user, view, q, items, pagination, kpis }) {
  const roleLabel = "مندوب";
  const v = view || "assigned";
  const views = `
    <button class="btn ${v === "assigned" ? "primary" : ""}" data-action="setView" data-view="assigned">المسندة</button>
    <button class="btn ${v === "closed" ? "primary" : ""}" data-action="setView" data-view="closed">المكتملة</button>
  `;

  const content = `
    <div class="kpis">
      ${kpiCard("الإجمالي", kpis?.total)}
      ${kpiCard("جديدة", kpis?.new)}
      ${kpiCard("مسندة", kpis?.assigned)}
      ${kpiCard("مكتملة", kpis?.closed)}
      ${kpiCard("ملغاة", kpis?.cancelled)}
    </div>

    ${renderSearchRow({ q, viewButtonsHtml: views })}

    ${renderPagination(pagination, items?.length || 0)}

    <div class="cards">
      ${(items || []).length ? (items || []).map(requestCardAgent).join("") : `<div class="muted">لا توجد طلبات حالياً</div>`}
    </div>
  `;

  return shell({ user, roleLabel, content });
}

export function renderStaff({ user, view, q, items, pagination, kpis, agents, error }) {
  const roleLabel = "موظف";
  const v = view || "new";
  const views = `
    <button class="btn ${v === "new" ? "primary" : ""}" data-action="setView" data-view="new">طلبات جديدة</button>
    <button class="btn ${v === "assigned" ? "primary" : ""}" data-action="setView" data-view="assigned">طلبات مسندة</button>
    <button class="btn ${v === "closed" ? "primary" : ""}" data-action="setView" data-view="closed">مكتملة</button>
  `;

  const content = `
    <div class="kpis">
      ${kpiCard("الإجمالي", kpis?.total)}
      ${kpiCard("جديدة", kpis?.new)}
      ${kpiCard("مسندة", kpis?.assigned)}
      ${kpiCard("مكتملة", kpis?.closed)}
      ${kpiCard("ملغاة", kpis?.cancelled)}
    </div>

    ${renderSearchRow({ q, viewButtonsHtml: views })}

    ${renderPagination(pagination, items?.length || 0)}

    <div class="cards">
      ${(items || []).length
        ? (items || []).map((x) => requestCardStaffAdmin(x, agents)).join("")
        : `<div class="muted">لا توجد طلبات حالياً</div>`}
    </div>
  `;

  return shell({ user, roleLabel, content, error });
}

export function renderAdmin({ user, view, q, items, pagination, kpis, agents, error }) {
  const roleLabel = "مدير";
  const v = view || "all";
  const views = `
    <button class="btn ${v === "all" ? "primary" : ""}" data-action="setView" data-view="all">الكل</button>
    <button class="btn ${v === "new" ? "primary" : ""}" data-action="setView" data-view="new">جديدة</button>
    <button class="btn ${v === "assigned" ? "primary" : ""}" data-action="setView" data-view="assigned">مسندة</button>
    <button class="btn ${v === "closed" ? "primary" : ""}" data-action="setView" data-view="closed">مكتملة</button>
  `;

  const content = `
    <div class="kpis">
      ${kpiCard("الإجمالي", kpis?.total)}
      ${kpiCard("جديدة", kpis?.new)}
      ${kpiCard("مسندة", kpis?.assigned)}
      ${kpiCard("مكتملة", kpis?.closed)}
      ${kpiCard("ملغاة", kpis?.cancelled)}
    </div>

    ${renderSearchRow({ q, viewButtonsHtml: views })}

    ${renderPagination(pagination, items?.length || 0)}

    <div class="cards">
      ${(items || []).length
        ? (items || []).map((x) => requestCardStaffAdmin(x, agents)).join("")
        : `<div class="muted">لا توجد طلبات حالياً</div>`}
    </div>
  `;

  return shell({ user, roleLabel, content, error });
}

/** Toast */
export function ensureToastRoot() {
  if (document.getElementById("toastRoot")) return;
  const el = document.createElement("div");
  el.id = "toastRoot";
  el.style.cssText = `
    position:fixed;bottom:18px;left:18px;z-index:10000;display:flex;flex-direction:column;gap:10px;
  `;
  document.body.appendChild(el);
}

export function toast(msg, type = "error") {
  ensureToastRoot();
  const root = document.getElementById("toastRoot");
  if (!root) return;

  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = `
    padding:12px 14px;border-radius:14px;max-width:360px;
    background:${type === "success" ? "rgba(42,163,107,.18)" : "rgba(255,99,132,.18)"};
    border:1px solid ${type === "success" ? "rgba(42,163,107,.35)" : "rgba(255,99,132,.35)"};
    color:#fff;backdrop-filter: blur(6px);
  `;
  root.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
