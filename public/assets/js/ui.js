// public/assets/js/ui.js

export function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[ch]));
}

export function renderShell(contentHtml) {
  return `
    <div class="app">
      <div class="card">
        ${contentHtml}
      </div>
    </div>
  `;
}

export function renderLoading(msg = "جاري التحميل...") {
  return renderShell(`
    <div class="center">
      <div class="spinner"></div>
      <div class="muted">${escapeHtml(msg)}</div>
    </div>
  `);
}

export function renderLogin({ error = "" } = {}) {
  return renderShell(`
    <div>
      <h1 class="h1">تسجيل الدخول</h1>
      <div class="muted">سجّل دخولك للوصول للطلبات.</div>

      <div class="hr"></div>

      <form id="loginForm">
        <div class="label">اسم المستخدم</div>
        <input class="input" name="username" autocomplete="username" inputmode="text" />

        <div class="label">كلمة المرور</div>
        <input class="input" name="password" type="password" autocomplete="current-password" />

        <div class="row" style="margin-top:14px;align-items:center;gap:10px;">
          <button class="btn" type="submit">دخول</button>
          <span class="small">سيتم حفظ الجلسة تلقائيًا.</span>
        </div>

        ${error ? `<div class="alert" style="margin-top:14px;">${escapeHtml(error)}</div>` : ``}
      </form>
    </div>
  `);
}

export function bindLogin(root, onSubmit) {
  const form = root.querySelector("#loginForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    onSubmit({
      username: String(fd.get("username") || "").trim(),
      password: String(fd.get("password") || "").trim(),
    });
  });
}

function pillStatus(status) {
  const s = String(status || "").trim();
  const color =
    s === "مكتمل" ? "#22c55e" :
    s === "ملغي"  ? "#ef4444" :
    s === "جديد"  ? "#3b82f6" : "#a855f7";

  return `<span class="pill" style="border-color:${color};color:${color}">${escapeHtml(s || "—")}</span>`;
}

function googleMapEmbed(lat, lng) {
  const la = Number(lat), ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return "";
  const q = encodeURIComponent(`${la},${ln}`);
  return `
    <div style="margin-top:10px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.12)">
      <iframe
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        style="width:100%;height:220px;border:0"
        src="https://www.google.com/maps?q=${q}&z=15&output=embed">
      </iframe>
    </div>
  `;
}

function toE164SA(phone) {
  const p = String(phone || "").replace(/\D+/g, "");
  if (!p) return "";
  if (p.startsWith("966")) return p;
  if (p.startsWith("05") && p.length === 10) return "966" + p.slice(1);
  if (p.startsWith("5") && p.length === 9) return "966" + p;
  return "";
}

function renderTopBar({ user }) {
  const role = escapeHtml(user?.role || "");
  const name = escapeHtml(user?.name || user?.username || "");
  return `
    <div class="row" style="justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
      <div>
        <h1 class="h1">مرحبًا ${name}</h1>
        <div class="muted">الدور: <span class="pill">${role}</span></div>
      </div>

      <div class="row" style="gap:10px;flex-wrap:wrap;">
        <button id="btnEnablePush" class="btn btn--ghost" type="button">تفعيل الإشعارات</button>
        <button id="btnLogout" class="btn btn--danger" type="button">تسجيل الخروج</button>
      </div>
    </div>
  `;
}

function renderKpis(kpis = {}) {
  const box = (title, val) => `
    <div class="col" style="min-width:160px;padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px">
      <div class="small muted">${escapeHtml(title)}</div>
      <div class="strong" style="font-size:22px;margin-top:6px">${escapeHtml(val)}</div>
    </div>
  `;
  return `
    <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:10px">
      ${box("الإجمالي", kpis.total ?? "—")}
      ${box("الجديد", kpis.new ?? "—")}
      ${box("المسند", kpis.assigned ?? "—")}
      ${box("المكتمل", kpis.closed ?? "—")}
    </div>
  `;
}

/** ====== AGENT ====== */
export function renderAgent({
  user,
  pushStatus = "",
  view = "assigned",
  q = "",
  kpis = {},
  items = [],
  error = "",
  pagination = { limit: 50, offset: 0, count: 0 },
} = {}) {
  const tabs = `
    <div class="row" style="gap:10px;flex-wrap:wrap;justify-content:flex-end">
      <button class="btn ${view === "assigned" ? "" : "btn--ghost"}" data-action="agentTab" data-view="assigned">المسندة</button>
      <button class="btn ${view === "closed" ? "" : "btn--ghost"}" data-action="agentTab" data-view="closed">المكتملة</button>
      <button class="btn ${view === "all" ? "" : "btn--ghost"}" data-action="agentTab" data-view="all">الكل</button>
    </div>
  `;

  const list =
    error
      ? `<div class="alert">${escapeHtml(error)}</div>`
      : items.length === 0
        ? `<div class="muted">لا توجد طلبات حالياً.</div>`
        : `
          <div class="list">
            ${items.map((r) => {
              const id = r.id ?? "";
              const name = r.customer_name ?? r.customer_nam ?? "—";
              const phone = r.phone ?? "";
              const e164 = toE164SA(phone);
              const district = r.district ?? "—";
              const status = r.status ?? "—";
              const weight = (r.weight ?? "").toString();
              const mapsBtn = (Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)))
                ? `<a class="btn btn--ghost" target="_blank" rel="noreferrer" href="https://www.google.com/maps?q=${encodeURIComponent(r.lat + "," + r.lng)}">الخريطة</a>`
                : `<button class="btn btn--ghost" disabled>الخريطة</button>`;

              return `
                <div class="list__item" style="padding:14px">
                  <div class="row" style="justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
                    <div>
                      <div class="strong" style="font-size:18px">${escapeHtml(name)}</div>
                      <div class="small muted" style="margin-top:6px">الحي: ${escapeHtml(district)}</div>
                      <div class="small muted">الجوال: ${escapeHtml(phone || "—")}</div>
                    </div>
                    <div style="text-align:left">
                      ${pillStatus(status)}
                      <div class="pill" style="margin-top:8px">${escapeHtml(id)}</div>
                    </div>
                  </div>

                  <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:12px">
                    <a class="btn btn--ghost" href="${phone ? `tel:${escapeHtml(phone)}` : "#"}" ${phone ? "" : "disabled"}>اتصال</a>
                    <a class="btn btn--ghost" target="_blank" rel="noreferrer" href="${e164 ? `https://wa.me/${e164}` : "#"}" ${e164 ? "" : "disabled"}>واتساب</a>
                    ${mapsBtn}
                  </div>

                  <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px">
                    <input class="input" style="max-width:160px" inputmode="numeric" placeholder="الوزن" value="${escapeHtml(weight)}" data-weight-input="${escapeHtml(id)}" />
                    <button class="btn" data-action="saveWeight" data-id="${escapeHtml(id)}">حفظ الوزن</button>
                    <button class="btn btn--danger" data-action="closeReq" data-id="${escapeHtml(id)}">إغلاق الطلب</button>
                  </div>

                  ${googleMapEmbed(r.lat, r.lng)}
                </div>
              `;
            }).join("")}
          </div>
        `;

  const shown = Math.min(pagination.offset + items.length, pagination.count || (pagination.offset + items.length));
  const canLoadMore = pagination.count != null && (pagination.offset + items.length) < pagination.count;

  return renderShell(`
    ${renderTopBar({ user })}

    <div class="hr"></div>

    <h2 class="h2">لوحة المندوب</h2>
    <div class="muted">تظهر هنا طلباتك المسندة فقط (مع إمكانية عرض المكتملة).</div>

    ${renderKpis(kpis)}

    <div class="hr"></div>

    ${tabs}

    <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:12px;align-items:center">
      <input id="agentSearch" class="input" placeholder="بحث (اسم/رقم/جوال/حي...)" value="${escapeHtml(q)}" />
      <button class="btn" data-action="agentRefresh">تحديث</button>
      <div class="small muted" style="margin-inline-start:auto">المعروض: ${shown}/${escapeHtml(pagination.count ?? "—")}</div>
    </div>

    <div class="hr"></div>

    <div id="agentList">
      ${list}
    </div>

    ${canLoadMore ? `
      <div class="hr"></div>
      <button class="btn btn--ghost" data-action="loadMore">تحميل المزيد</button>
    ` : ``}

    <div class="hr"></div>
    <div class="pill">🔔 الإشعارات</div>
    <div class="small" style="margin-top:10px;">${escapeHtml(pushStatus || "—")}</div>
  `);
}

/** ====== STAFF ====== */
export function renderStaff({
  user,
  pushStatus = "",
  view = "new",
  q = "",
  kpis = {},
  agents = [],
  items = [],
  error = "",
  pagination = { limit: 50, offset: 0, count: 0 },
} = {}) {
  const tabs = `
    <div class="row" style="gap:10px;flex-wrap:wrap;justify-content:flex-end">
      <button class="btn ${view === "new" ? "" : "btn--ghost"}" data-action="staffTab" data-view="new">طلبات جديدة</button>
      <button class="btn ${view === "assigned" ? "" : "btn--ghost"}" data-action="staffTab" data-view="assigned">طلبات مسندة</button>
      <button class="btn ${view === "closed" ? "" : "btn--ghost"}" data-action="staffTab" data-view="closed">مكتملة</button>
      <button class="btn ${view === "all" ? "" : "btn--ghost"}" data-action="staffTab" data-view="all">الكل</button>
    </div>
  `;

  const agentOptions = [`<option value="">— اختر مندوب —</option>`]
    .concat(agents.map((a) => `<option value="${escapeHtml(a.username)}">${escapeHtml(a.name || a.username)} (${escapeHtml(a.username)})</option>`))
    .join("");

  const list =
    error
      ? `<div class="alert">${escapeHtml(error)}</div>`
      : items.length === 0
        ? `<div class="muted">لا توجد طلبات.</div>`
        : `
          <div class="list">
            ${items.map((r) => {
              const id = r.id ?? "";
              const name = r.customer_name ?? "—";
              const phone = r.phone ?? "";
              const district = r.district ?? "—";
              const status = r.status ?? "—";
              const agentName = r.agent_name ?? "";
              return `
                <div class="list__item" style="padding:14px">
                  <div class="row" style="justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
                    <div>
                      <div class="strong">${escapeHtml(name)}</div>
                      <div class="small muted">الحي: ${escapeHtml(district)} | الجوال: ${escapeHtml(phone || "—")}</div>
                      <div class="small muted">المندوب: <b>${escapeHtml(agentName || "—")}</b></div>
                    </div>
                    <div style="text-align:left">
                      ${pillStatus(status)}
                      <div class="pill" style="margin-top:8px">${escapeHtml(id)}</div>
                    </div>
                  </div>

                  <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px">
                    <select class="input" style="max-width:260px" data-assign-select="${escapeHtml(id)}">
                      ${agentOptions}
                    </select>
                    <button class="btn" data-action="assign" data-id="${escapeHtml(id)}">إسناد</button>
                    <button class="btn btn--danger" data-action="unassign" data-id="${escapeHtml(id)}">إلغاء الإسناد</button>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `;

  const shown = Math.min(pagination.offset + items.length, pagination.count || (pagination.offset + items.length));
  const canLoadMore = pagination.count != null && (pagination.offset + items.length) < pagination.count;

  return renderShell(`
    ${renderTopBar({ user })}

    <div class="hr"></div>

    <h2 class="h2">لوحة الموظف</h2>
    <div class="muted">استقبال الطلبات وإسنادها للمندوبين.</div>

    ${renderKpis(kpis)}

    <div class="hr"></div>
    ${tabs}

    <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:12px;align-items:center">
      <input id="staffSearch" class="input" placeholder="بحث..." value="${escapeHtml(q)}" />
      <button class="btn" data-action="staffRefresh">تحديث</button>
      <div class="small muted" style="margin-inline-start:auto">المعروض: ${shown}/${escapeHtml(pagination.count ?? "—")}</div>
    </div>

    <div class="hr"></div>

    <div id="staffList">${list}</div>

    ${canLoadMore ? `
      <div class="hr"></div>
      <button class="btn btn--ghost" data-action="staffLoadMore">تحميل المزيد</button>
    ` : ``}

    <div class="hr"></div>
    <div class="pill">🔔 الإشعارات</div>
    <div class="small" style="margin-top:10px;">${escapeHtml(pushStatus || "—")}</div>
  `);
}

/** ====== ADMIN ====== */
export function renderAdmin({
  user,
  pushStatus = "",
  view = "all",
  q = "",
  kpis = {},
  items = [],
  error = "",
} = {}) {
  const list =
    error
      ? `<div class="alert">${escapeHtml(error)}</div>`
      : items.length === 0
        ? `<div class="muted">لا توجد بيانات.</div>`
        : `
          <div class="list">
            ${items.slice(0, 20).map((r) => `
              <div class="list__item">
                <div class="row" style="justify-content:space-between;gap:10px;align-items:center">
                  <div>
                    <div class="strong">${escapeHtml(r.customer_name || "—")}</div>
                    <div class="small muted">الحالة: ${escapeHtml(r.status || "—")} | المندوب: ${escapeHtml(r.agent_name || "—")}</div>
                  </div>
                  <div class="pill">${escapeHtml(r.id || "")}</div>
                </div>
              </div>
            `).join("")}
          </div>
        `;

  return renderShell(`
    ${renderTopBar({ user })}

    <div class="hr"></div>

    <h2 class="h2">لوحة المدير</h2>
    <div class="muted">مؤشرات سريعة + آخر الطلبات (20).</div>

    ${renderKpis(kpis)}

    <div class="hr"></div>

    <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center">
      <input id="adminSearch" class="input" placeholder="بحث..." value="${escapeHtml(q)}" />
      <button class="btn" data-action="adminRefresh">تحديث</button>
      <button class="btn btn--ghost" data-action="adminTab" data-view="new">جديد</button>
      <button class="btn btn--ghost" data-action="adminTab" data-view="assigned">مسند</button>
      <button class="btn btn--ghost" data-action="adminTab" data-view="closed">مكتمل</button>
      <button class="btn" data-action="adminTab" data-view="all">الكل</button>
    </div>

    <div class="hr"></div>

    ${list}

    <div class="hr"></div>
    <div class="pill">🔔 الإشعارات</div>
    <div class="small" style="margin-top:10px;">${escapeHtml(pushStatus || "—")}</div>
  `);
}
