// ui.js
const AR_ROLE = {
  admin: "مدير",
  staff: "موظف",
  agent: "مندوب",
  "مدير": "مدير",
  "موظف": "موظف",
  "مندوب": "مندوب",
};

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizePhone(p) {
  const s = String(p || "").replace(/[^\d]/g, "");
  // لو رقم سعودي بدون 966
  if (s.length === 9 && s.startsWith("5")) return `966${s}`;
  if (s.length === 10 && s.startsWith("05")) return `966${s.slice(1)}`;
  if (s.startsWith("966")) return s;
  return s;
}

function statusLabel(r) {
  if (r?.cancelled_at) return "ملغي";
  if (r?.closed_at) return "مكتمل";
  if (r?.agent_name) return "مسند";
  return "جديد";
}

function pill(label) {
  const cls =
    label === "مكتمل" ? "pill green" :
    label === "مسند" ? "pill blue" :
    label === "ملغي" ? "pill red" :
    "pill gray";
  return `<span class="${cls}">${esc(label)}</span>`;
}

export function renderShell({ user, title, subtitle, body, error }) {
  const role = AR_ROLE[user?.role] || user?.role || "";
  const name = user?.name || user?.username || "";
  return `
  <style>
    :root{
      --bg1:#0b0920; --bg2:#140a17; --card:#2a2540cc; --card2:#332c50cc;
      --txt:#f2f2ff; --muted:#b9b7d2; --stroke:#ffffff1f;
      --pri:#6b4dff; --pri2:#8a7bff;
      --green:#2ecc71; --red:#ff4d6d; --blue:#4d9cff; --gray:#9aa0a6;
    }
    *{box-sizing:border-box}
    body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; color:var(--txt);
      background:radial-gradient(1200px 700px at 70% 10%, #2f1b87 0%, transparent 55%),
                 radial-gradient(900px 600px at 20% 90%, #7a225b 0%, transparent 55%),
                 linear-gradient(180deg,var(--bg1),var(--bg2));
      min-height:100vh;
    }
    .wrap{max-width:1100px;margin:0 auto;padding:28px 18px}
    .card{border:1px solid var(--stroke); background:linear-gradient(180deg,var(--card),var(--card2));
      border-radius:26px; padding:22px; box-shadow:0 25px 70px #00000055;
    }
    .top{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .brand{display:flex;align-items:center;gap:10px}
    .logo{width:44px;height:44px;border-radius:14px;border:1px solid var(--stroke);
      display:grid;place-items:center;background:#ffffff0d}
    .title{font-size:40px;font-weight:800;margin:6px 0 0}
    .sub{color:var(--muted);margin-top:6px}
    .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
    .btn{border:1px solid var(--stroke); background:#ffffff0a;color:var(--txt);
      border-radius:16px;padding:10px 14px;cursor:pointer; font-weight:700;
    }
    .btn.pri{background:linear-gradient(180deg,var(--pri),var(--pri2)); border:none}
    .btn.danger{background:#ff4d6d22;border:1px solid #ff4d6d55}
    .btn:disabled{opacity:.6;cursor:not-allowed}
    .hr{height:1px;background:var(--stroke);margin:16px 0}
    .err{margin-top:14px;padding:12px 14px;border-radius:14px;background:#ff4d6d22;border:1px solid #ff4d6d55;color:#ffd6df}
    .muted{color:var(--muted)}
    .pill{padding:6px 10px;border-radius:999px;font-weight:800;font-size:12px;border:1px solid var(--stroke)}
    .pill.green{background:#2ecc7122;border-color:#2ecc7155}
    .pill.red{background:#ff4d6d22;border-color:#ff4d6d55}
    .pill.blue{background:#4d9cff22;border-color:#4d9cff55}
    .pill.gray{background:#9aa0a622;border-color:#9aa0a655}
    .grid{display:grid;gap:12px}
    .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .kpi{border:1px solid var(--stroke);background:#ffffff0a;border-radius:18px;padding:12px}
    .kpi b{font-size:22px}
    .toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between}
    .search{flex:1;min-width:220px}
    input,select{width:100%;border:1px solid var(--stroke);background:#ffffff0a;color:var(--txt);
      border-radius:16px;padding:12px 14px;outline:none
    }
    .list{display:grid;gap:12px;margin-top:14px}
    .item{border:1px solid var(--stroke);background:#ffffff0a;border-radius:20px;padding:14px}
    .itemTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}
    .id{font-weight:900}
    .meta{display:grid;gap:6px;color:var(--muted);font-size:13px}
    .actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .map{border-radius:16px;overflow:hidden;border:1px solid var(--stroke);margin-top:10px}
    .small{font-size:12px}
    @media (max-width:900px){ .kpis{grid-template-columns:repeat(2,minmax(0,1fr))} .title{font-size:34px}}
  </style>

  <div class="wrap">
    <div class="card">
      <div class="top">
        <div class="brand">
          <div class="logo">😊</div>
          <div>
            <div style="font-weight:900;font-size:22px">Clos <span class="muted" style="font-weight:600">جمعية رفح</span></div>
            <div class="muted small">${esc(title || "")}</div>
          </div>
        </div>
        <div class="row">
          ${user ? `<span class="muted">مرحباً <b>${esc(name)}</b></span>` : ""}
          ${user ? `<span class="pill gray">الدور: ${esc(role)}</span>` : ""}
          ${user ? `<button class="btn danger" data-action="logout">تسجيل الخروج</button>` : ""}
        </div>
      </div>

      ${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ""}
      <div class="hr"></div>

      ${error ? `<div class="err">${esc(error)}</div>` : ""}
      ${body || ""}

      <div class="hr"></div>
      <div class="row" style="justify-content:space-between">
        <div class="muted small">Clos - Rafah ©</div>
        <button class="btn" data-action="enablePush">الإشعارات 🔔</button>
      </div>
    </div>
  </div>
  `;
}

export function renderLoading(msg = "... جاري التحميل") {
  return renderShell({
    user: null,
    title: "",
    subtitle: "",
    body: `<div style="display:grid;place-items:center;min-height:45vh">
      <div style="display:grid;gap:10px;place-items:center">
        <div style="width:44px;height:44px;border-radius:50%;border:5px solid #ffffff22;border-top-color:var(--pri);animation:spin 1s linear infinite"></div>
        <div class="muted">${esc(msg)}</div>
      </div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`,
  });
}

export function renderLogin({ error } = {}) {
  return renderShell({
    user: null,
    title: "تسجيل الدخول",
    subtitle: "أدخل اسم المستخدم وكلمة المرور",
    error: error || "",
    body: `
      <form id="loginForm" class="grid" style="max-width:420px;margin:0 auto">
        <input id="username" name="username" autocomplete="username" placeholder="اسم المستخدم" required />
        <input id="password" name="password" type="password" autocomplete="current-password" placeholder="كلمة المرور" required />
        <div id="loginError" class="err" style="display:none"></div>
        <div class="row" style="justify-content:center">
          <button class="btn pri" type="submit">تسجيل الدخول</button>
        </div>
      </form>
    `,
  });
}

/**
 * ✅ bindLogin متوافق مع كل الاستدعاءات:
 * - bindLogin(rootElement, onSubmit)
 * - bindLogin(onSubmit)
 * - bindLogin({ root, onSubmit })
 */
export function bindLogin(arg1, arg2) {
  let root = document;
  let onSubmit = null;

  if (typeof arg1 === "function") {
    onSubmit = arg1;
  } else if (arg1 && typeof arg1 === "object" && typeof arg1.onSubmit === "function") {
    onSubmit = arg1.onSubmit;
    root = arg1.root && typeof arg1.root.querySelector === "function" ? arg1.root : document;
  } else {
    root = arg1 && typeof arg1.querySelector === "function" ? arg1 : document;
    onSubmit = typeof arg2 === "function" ? arg2 : null;
  }

  const form = root.querySelector("#loginForm");
  if (!form || !onSubmit) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = root.querySelector("#username")?.value?.trim() || "";
    const p = root.querySelector("#password")?.value || "";
    const btn = form.querySelector('button[type="submit"]');
    const errBox = root.querySelector("#loginError");

    try {
      if (btn) btn.disabled = true;
      if (errBox) { errBox.style.display = "none"; errBox.textContent = ""; }
      await onSubmit(u, p);
    } catch (err) {
      const msg = err?.message || "فشل تسجيل الدخول";
      if (errBox) { errBox.style.display = "block"; errBox.textContent = msg; }
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

function renderToolbar({ viewButtons = [], q = "", extraRight = "" }) {
  return `
    <div class="toolbar">
      <div class="row" style="flex:1">
        <div class="search"><input data-role="search" placeholder="بحث (اسم/رقم/حي/رقم طلب)" value="${esc(q)}" /></div>
        <button class="btn pri" data-action="refresh">تحديث</button>
      </div>
      <div class="row">
        ${viewButtons.map(b => `
          <button class="btn ${b.active ? "pri" : ""}" data-action="setView" data-view="${esc(b.view)}">
            ${esc(b.label)}
          </button>`).join("")}
        ${extraRight || ""}
      </div>
    </div>
  `;
}

function renderItem(r, mode, agents = []) {
  const id = r.id || "";
  const customerName = r.customer_name ?? r.customer_nan ?? r.customer_nam ?? "";
  const phone = r.phone ?? "";
  const district = r.district ?? "";
  const lat = r.lat ?? null;
  const lng = r.lng ?? null;
  const w = r.weight ?? "";
  const agentName = r.agent_name ?? "";
  const st = statusLabel(r);

  const phoneNorm = normalizePhone(phone);
  const wa = phoneNorm ? `https://wa.me/${phoneNorm}` : "";
  const tel = phone ? `tel:${esc(phone)}` : "";
  const mapUrl =
    lat != null && lng != null
      ? `https://www.google.com/maps?q=${encodeURIComponent(String(lat))},${encodeURIComponent(String(lng))}`
      : "";

  const mapFrame =
    lat != null && lng != null
      ? `<div class="map">
          <iframe
            width="100%" height="220" style="border:0"
            loading="lazy" allowfullscreen
            referrerpolicy="no-referrer-when-downgrade"
            src="https://maps.google.com/maps?q=${encodeURIComponent(String(lat))},${encodeURIComponent(String(lng))}&z=16&output=embed">
          </iframe>
        </div>`
      : "";

  const assignUI =
    mode === "staff" || mode === "admin"
      ? `
        <div class="row" style="margin-top:10px">
          <select data-role="agentSelect" data-id="${esc(id)}">
            <option value="">اختر مندوب…</option>
            ${agents
              .map((a) => {
                const v = a.username || "";
                const label = `${a.name || a.username} (${a.username})`;
                return `<option value="${esc(v)}" ${v === agentName ? "selected" : ""}>${esc(label)}</option>`;
              })
              .join("")}
          </select>
          <button class="btn pri" data-action="reqAssign" data-id="${esc(id)}">إسناد</button>
        </div>
      `
      : "";

  const agentOps =
    mode === "agent"
      ? `
        <div class="row" style="margin-top:10px">
          <input style="max-width:220px" data-role="weightInput" data-id="${esc(id)}" placeholder="الوزن" value="${esc(w)}" />
          <button class="btn pri" data-action="reqWeight" data-id="${esc(id)}">حفظ الوزن</button>
          <button class="btn danger" data-action="reqClose" data-id="${esc(id)}">إغلاق الطلب ✅</button>
        </div>
      `
      : "";

  return `
    <div class="item" data-id="${esc(id)}">
      <div class="itemTop">
        <div>
          <div class="id">${esc(id)}</div>
          <div class="meta">
            <div><b>${esc(customerName || "—")}</b> ${pill(st)}</div>
            <div>📞 ${esc(phone || "—")}</div>
            <div>📍 ${esc(district || "—")}</div>
            ${agentName ? `<div>👤 المندوب: <b>${esc(agentName)}</b></div>` : ""}
          </div>
        </div>
        <div class="actions">
          <button class="btn" ${tel ? `onclick="location.href='${tel}'"` : "disabled"}>اتصال</button>
          <button class="btn" ${wa ? `onclick="window.open('${wa}','_blank')"` : "disabled"}>واتساب</button>
          <button class="btn" ${mapUrl ? `onclick="window.open('${mapUrl}','_blank')"` : "disabled"}>الخريطة</button>
        </div>
      </div>

      ${assignUI}
      ${agentOps}
      ${mapFrame}
    </div>
  `;
}

function renderList({ items = [], mode, agents = [] }) {
  if (!items.length) return `<div class="muted" style="text-align:center;margin:18px 0">لا توجد طلبات حالياً</div>`;
  return `<div class="list">${items.map((r) => renderItem(r, mode, agents)).join("")}</div>`;
}

export function renderAgent({ user, items, view, q, pagination, error }) {
  const viewButtons = [
    { view: "assigned", label: "المسندة", active: view === "assigned" },
    { view: "closed", label: "المكتملة", active: view === "closed" },
  ];

  const shown = items?.length || 0;
  const total = pagination?.count ?? shown;
  const canMore = pagination && pagination.offset + pagination.limit < total;

  return renderShell({
    user,
    title: "لوحة المندوب",
    subtitle: "تظهر هنا الطلبات المسندة لك فقط (مع إمكانية عرض المكتملة).",
    error,
    body: `
      ${renderToolbar({ viewButtons, q })}
      <div class="muted small" style="margin-top:8px">المعروض: ${shown} / ${total}</div>
      ${renderList({ items, mode: "agent" })}
      ${canMore ? `<div class="row" style="justify-content:center;margin-top:12px">
        <button class="btn" data-action="loadMore">تحميل المزيد</button>
      </div>` : ""}
    `,
  });
}

export function renderStaff({ user, items, view, q, pagination, agents = [], stats = {}, error }) {
  const viewButtons = [
    { view: "new", label: "طلبات جديدة", active: view === "new" },
    { view: "assigned", label: "طلبات مسندة", active: view === "assigned" },
    { view: "closed", label: "مكتملة", active: view === "closed" },
  ];

  const shown = items?.length || 0;
  const total = pagination?.count ?? shown;
  const canMore = pagination && pagination.offset + pagination.limit < total;

  return renderShell({
    user,
    title: "لوحة الموظف",
    subtitle: "استقبال الطلبات الجديدة وإسنادها للمندوبين، مع مؤشرات سريعة.",
    error,
    body: `
      <div class="kpis">
        <div class="kpi"><div class="muted small">جديدة</div><b>${esc(stats.new ?? "0")}</b></div>
        <div class="kpi"><div class="muted small">مسندة</div><b>${esc(stats.assigned ?? "0")}</b></div>
        <div class="kpi"><div class="muted small">مكتملة</div><b>${esc(stats.closed ?? "0")}</b></div>
        <div class="kpi"><div class="muted small">الإجمالي</div><b>${esc(stats.total ?? "0")}</b></div>
      </div>

      <div class="hr"></div>

      ${renderToolbar({ viewButtons, q })}
      <div class="muted small" style="margin-top:8px">المعروض: ${shown} / ${total}</div>

      ${renderList({ items, mode: "staff", agents })}

      ${canMore ? `<div class="row" style="justify-content:center;margin-top:12px">
        <button class="btn" data-action="loadMore">تحميل المزيد</button>
      </div>` : ""}
    `,
  });
}

export function renderAdmin({ user, items, view, q, pagination, agents = [], stats = {}, error }) {
  const viewButtons = [
    { view: "all", label: "الكل", active: view === "all" },
    { view: "new", label: "جديدة", active: view === "new" },
    { view: "assigned", label: "مسندة", active: view === "assigned" },
    { view: "closed", label: "مكتملة", active: view === "closed" },
  ];

  const shown = items?.length || 0;
  const total = pagination?.count ?? shown;
  const canMore = pagination && pagination.offset + pagination.limit < total;

  return renderShell({
    user,
    title: "لوحة المدير",
    subtitle: "متابعة المؤشرات وإدارة الطلبات وإسنادها.",
    error,
    body: `
      <div class="kpis">
        <div class="kpi"><div class="muted small">جديدة</div><b>${esc(stats.new ?? "0")}</b></div>
        <div class="kpi"><div class="muted small">مسندة</div><b>${esc(stats.assigned ?? "0")}</b></div>
        <div class="kpi"><div class="muted small">مكتملة</div><b>${esc(stats.closed ?? "0")}</b></div>
        <div class="kpi"><div class="muted small">الإجمالي</div><b>${esc(stats.total ?? "0")}</b></div>
      </div>

      <div class="hr"></div>

      ${renderToolbar({ viewButtons, q })}
      <div class="muted small" style="margin-top:8px">المعروض: ${shown} / ${total}</div>

      ${renderList({ items, mode: "admin", agents })}

      ${canMore ? `<div class="row" style="justify-content:center;margin-top:12px">
        <button class="btn" data-action="loadMore">تحميل المزيد</button>
      </div>` : ""}
    `,
  });
}
