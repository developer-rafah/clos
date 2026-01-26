// UI MODULE

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
      <div class="muted">لا يوجد جلسة أو انتهت.. سجل دخولك من الواجهة.</div>

      <div class="hr"></div>

      <form id="loginForm">
        <div class="label">اسم المستخدم</div>
        <input class="input" name="username" autocomplete="username" inputmode="text" />

        <div class="label">كلمة المرور</div>
        <input class="input" name="password" type="password" autocomplete="current-password" />

        <div class="row" style="margin-top:14px;align-items:center;gap:10px;flex-wrap:wrap;">
          <button class="btn" type="submit">دخول</button>
          <span class="small">لن يتم تسجيل الخروج إلا عند اختيار ذلك يدويًا.</span>
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

function normalizePhone(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  // إزالة كل ما عدا الأرقام
  let p = raw.replace(/[^\d]/g, "");
  // السعودية: لو 9 أرقام يبدأ 5 => أضف 966
  if (p.length === 9 && p.startsWith("5")) p = "966" + p;
  // لو يبدأ 05 => 9665...
  if (p.length === 10 && p.startsWith("05")) p = "966" + p.slice(1);
  return p;
}

function isClosedStatus(status) {
  const s = String(status || "").trim();
  return /مكتمل|مغلق|منجز|تم|مغلقه|منتهي/i.test(s);
}

function statusPill(status) {
  const s = String(status || "").trim() || "—";
  const closed = isClosedStatus(s);
  const bg = closed ? "rgba(70,200,120,.18)" : "rgba(120,140,255,.18)";
  const bd = closed ? "rgba(70,200,120,.35)" : "rgba(120,140,255,.35)";
  return `<span class="pill" style="border-color:${bd};background:${bg};">${escapeHtml(s)}</span>`;
}

function mapEmbed(lat, lng) {
  const la = Number(lat), ln = Number(lng);
  if (!isFinite(la) || !isFinite(ln)) return "";
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(`${la},${ln}`)}&z=16&output=embed`;
  return `
    <div style="margin-top:10px;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.12);">
      <iframe
        title="map"
        width="100%"
        height="220"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        src="${src}"></iframe>
    </div>
  `;
}

function renderAgentRequestCard(t) {
  const id = escapeHtml(t?.id || "");
  const customer = escapeHtml(t?.customer_name || t?.customer || "عميل");
  const district = escapeHtml(t?.district || "—");
  const phone = String(t?.phone || "").trim();
  const phoneEN = normalizePhone(phone);
  const phoneLabel = escapeHtml(phone || "—");
  const status = t?.status || "";
  const weightVal = (t?.weight ?? "");
  const lat = t?.lat, lng = t?.lng;
  const notes = escapeHtml(t?.notes || "");
  const closed = !!t?.closed_at || isClosedStatus(status);

  const callHref = phoneEN ? `tel:${phoneEN}` : "#";
  const waHref = phoneEN ? `https://wa.me/${phoneEN}` : "#";
  const mapHref = (isFinite(Number(lat)) && isFinite(Number(lng)))
    ? `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`
    : "";

  return `
    <div class="list__item" style="padding:14px;">
      <div class="row" style="justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
        <div style="min-width:220px;">
          <div class="strong" style="font-size:16px;">${customer}</div>
          <div class="small muted" style="margin-top:4px;">${id}</div>
        </div>
        <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;">
          ${statusPill(status)}
          <span class="pill">${escapeHtml(district)}</span>
        </div>
      </div>

      <div class="row" style="margin-top:12px;gap:10px;flex-wrap:wrap;">
        <a class="btn btn--ghost" ${phoneEN ? `href="${callHref}"` : `aria-disabled="true"`} target="_self">اتصال</a>
        <a class="btn btn--ghost" ${phoneEN ? `href="${waHref}"` : `aria-disabled="true"`} target="_blank" rel="noopener">واتساب</a>
        <a class="btn btn--ghost" ${mapHref ? `href="${mapHref}"` : `aria-disabled="true"`} target="_blank" rel="noopener">الخريطة</a>
      </div>

      <div class="row" style="margin-top:10px;gap:10px;flex-wrap:wrap;align-items:center;">
        <div class="small muted">الجوال: <span style="color:#fff">${phoneLabel}</span></div>
        <div class="small muted">الحي/العنوان: <span style="color:#fff">${district}</span></div>
      </div>

      ${notes ? `<div class="small muted" style="margin-top:8px;">ملاحظات: <span style="color:#fff">${notes}</span></div>` : ``}

      <div class="row" style="margin-top:12px;gap:10px;flex-wrap:wrap;align-items:center;">
        <input
          class="input"
          style="max-width:160px;"
          inputmode="numeric"
          placeholder="الوزن"
          data-weight-input="1"
          data-id="${id}"
          value="${escapeHtml(weightVal)}" />
        <button class="btn" type="button" data-act="saveWeight" data-id="${id}">حفظ الوزن</button>

        <button class="btn ${closed ? "btn--ghost" : "btn--danger"}" type="button"
          data-act="closeRequest"
          data-id="${id}"
          ${closed ? "disabled" : ""}>
          ${closed ? "مغلق ✅" : "إغلاق الطلب"}
        </button>
      </div>

      ${mapEmbed(lat, lng)}
    </div>
  `;
}

export function renderAgent({
  user,
  pushStatus = "",
  tasks = [],
  tasksError = "",
  view = "assigned",
  q = "",
  stats = { loaded: 0, total: null },
} = {}) {
  const tabs = `
    <div class="row" style="gap:10px;flex-wrap:wrap;">
      <button id="tabAssigned" class="btn ${view === "assigned" ? "" : "btn--ghost"}" type="button">المسندة</button>
      <button id="tabClosed" class="btn ${view === "closed" ? "" : "btn--ghost"}" type="button">المكتملة</button>
    </div>
  `;

  const tasksHtml = tasksError
    ? `<div class="alert">${escapeHtml(tasksError)}</div>`
    : (!tasks || tasks.length === 0)
      ? `<div class="muted">لا توجد طلبات حالياً.</div>`
      : `<div class="list">${tasks.map(renderAgentRequestCard).join("")}</div>`;

  const totalTxt = (stats?.total == null) ? "—" : String(stats.total);
  const loadedTxt = String(stats?.loaded ?? (tasks?.length ?? 0));

  return renderShell(`
    ${renderTopBar({ user })}

    <div class="hr"></div>

    <h2 class="h2">لوحة المندوب</h2>
    <div class="muted">تظهر هنا الطلبات المسندة لك فقط (مع إمكانية عرض المكتملة).</div>

    <div class="hr"></div>

    <div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
      ${tabs}

      <div class="row" style="gap:10px;align-items:center;flex-wrap:wrap;">
        <input id="agentSearch" class="input" style="min-width:220px;" placeholder="بحث (اسم/رقم/حي/رقم طلب)" value="${escapeHtml(q)}" />
        <button id="btnAgentRefresh" class="btn" type="button">تحديث</button>
        <span class="small muted">المعروض: ${escapeHtml(loadedTxt)} / ${escapeHtml(totalTxt)}</span>
      </div>
    </div>

    <div class="hr"></div>

    <div id="agentTasks">${tasksHtml}</div>

    <div class="hr"></div>

    <div class="pill">🔔 الإشعارات</div>
    <div class="small" style="margin-top:10px;">${escapeHtml(pushStatus || "—")}</div>
  `);
}

function renderSelectOptions(items, selectedValue) {
  const sel = String(selectedValue ?? "");
  return (items || []).map((x) => {
    const v = String(x.value ?? x.username ?? "");
    const label = String(x.label ?? x.name ?? x.username ?? "");
    return `<option value="${escapeHtml(v)}" ${v === sel ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function renderStaffRequestCard(t, agents) {
  const id = escapeHtml(t?.id || "");
  const customer = escapeHtml(t?.customer_name || t?.customer || "عميل");
  const district = escapeHtml(t?.district || "—");
  const phone = escapeHtml(t?.phone || "—");
  const status = t?.status || "—";

  return `
    <div class="list__item" style="padding:14px;">
      <div class="row" style="justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <div class="strong">${customer}</div>
          <div class="small muted">${id}</div>
        </div>
        ${statusPill(status)}
      </div>

      <div class="row" style="margin-top:10px;gap:10px;flex-wrap:wrap;">
        <div class="small muted">الجوال: <span style="color:#fff">${phone}</span></div>
        <div class="small muted">الحي: <span style="color:#fff">${district}</span></div>
      </div>

      <div class="row" style="margin-top:12px;gap:10px;flex-wrap:wrap;align-items:center;">
        <select class="input" data-agent-select="1" data-id="${id}" style="min-width:220px;">
          <option value="">اختر مندوب...</option>
          ${renderSelectOptions(agents, "")}
        </select>
        <button class="btn" type="button" data-act="assignRequest" data-id="${id}">إسناد</button>
      </div>
    </div>
  `;
}

export function renderStaff({
  user,
  pushStatus = "",
  view = "new",
  q = "",
  requests = [],
  agents = [],
  err = "",
  stats = { loaded: 0, total: null },
} = {}) {
  const tabs = `
    <div class="row" style="gap:10px;flex-wrap:wrap;">
      <button id="tabStaffNew" class="btn ${view === "new" ? "" : "btn--ghost"}" type="button">طلبات جديدة</button>
      <button id="tabStaffAssigned" class="btn ${view === "assigned" ? "" : "btn--ghost"}" type="button">طلبات مسندة</button>
      <button id="tabStaffClosed" class="btn ${view === "closed" ? "" : "btn--ghost"}" type="button">مكتملة</button>
    </div>
  `;

  const listHtml = err
    ? `<div class="alert">${escapeHtml(err)}</div>`
    : (!requests || requests.length === 0)
      ? `<div class="muted">لا توجد بيانات.</div>`
      : `<div class="list">${
          view === "new"
            ? requests.map((t) => renderStaffRequestCard(t, agents)).join("")
            : requests.map((t) => `
                <div class="list__item" style="padding:14px;">
                  <div class="row" style="justify-content:space-between;gap:12px;flex-wrap:wrap;">
                    <div>
                      <div class="strong">${escapeHtml(t.customer_name || t.customer || "عميل")}</div>
                      <div class="small muted">${escapeHtml(t.id || "")}</div>
                    </div>
                    <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center;">
                      ${statusPill(t.status)}
                      <span class="pill">${escapeHtml(t.agent_name || t.agent_username || "—")}</span>
                    </div>
                  </div>
                </div>
              `).join("")
        }</div>`;

  const totalTxt = (stats?.total == null) ? "—" : String(stats.total);
  const loadedTxt = String(stats?.loaded ?? (requests?.length ?? 0));

  return renderShell(`
    ${renderTopBar({ user })}

    <div class="hr"></div>

    <h2 class="h2">لوحة الموظف</h2>
    <div class="muted">استقبال الطلبات الجديدة وإسنادها للمندوبين، مع عرض المسند/المكتمل.</div>

    <div class="hr"></div>

    <div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
      ${tabs}
      <div class="row" style="gap:10px;align-items:center;flex-wrap:wrap;">
        <input id="staffSearch" class="input" style="min-width:220px;" placeholder="بحث..." value="${escapeHtml(q)}" />
        <button id="btnStaffRefresh" class="btn" type="button">تحديث</button>
        <span class="small muted">المعروض: ${escapeHtml(loadedTxt)} / ${escapeHtml(totalTxt)}</span>
      </div>
    </div>

    <div class="hr"></div>

    <div id="staffList">${listHtml}</div>

    <div class="hr"></div>

    <div class="pill">🔔 الإشعارات</div>
    <div class="small" style="margin-top:10px;">${escapeHtml(pushStatus || "—")}</div>
  `);
}

export function renderAdmin({
  user,
  pushStatus = "",
  q = "",
  view = "all",
  requests = [],
  err = "",
  stats = { loaded: 0, total: null },
} = {}) {
  const tabs = `
    <div class="row" style="gap:10px;flex-wrap:wrap;">
      <button id="tabAdminAll" class="btn ${view === "all" ? "" : "btn--ghost"}" type="button">الكل</button>
      <button id="tabAdminNew" class="btn ${view === "new" ? "" : "btn--ghost"}" type="button">جديد</button>
      <button id="tabAdminAssigned" class="btn ${view === "assigned" ? "" : "btn--ghost"}" type="button">مسند</button>
      <button id="tabAdminClosed" class="btn ${view === "closed" ? "" : "btn--ghost"}" type="button">مكتمل</button>
    </div>
  `;

  const listHtml = err
    ? `<div class="alert">${escapeHtml(err)}</div>`
    : (!requests || requests.length === 0)
      ? `<div class="muted">لا توجد بيانات.</div>`
      : `<div class="list">${requests.map((t) => `
          <div class="list__item" style="padding:14px;">
            <div class="row" style="justify-content:space-between;gap:12px;flex-wrap:wrap;">
              <div>
                <div class="strong">${escapeHtml(t.customer_name || t.customer || "عميل")}</div>
                <div class="small muted">${escapeHtml(t.id || "")}</div>
              </div>
              <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;">
                ${statusPill(t.status)}
                <span class="pill">${escapeHtml(t.agent_name || t.agent_username || "غير مسند")}</span>
              </div>
            </div>
          </div>
        `).join("")}</div>`;

  const totalTxt = (stats?.total == null) ? "—" : String(stats.total);
  const loadedTxt = String(stats?.loaded ?? (requests?.length ?? 0));

  return renderShell(`
    ${renderTopBar({ user })}

    <div class="hr"></div>

    <h2 class="h2">لوحة المدير</h2>
    <div class="muted">عرض شامل للطلبات مع فلاتر (الكل/جديد/مسند/مكتمل).</div>

    <div class="hr"></div>

    <div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
      ${tabs}
      <div class="row" style="gap:10px;align-items:center;flex-wrap:wrap;">
        <input id="adminSearch" class="input" style="min-width:220px;" placeholder="بحث..." value="${escapeHtml(q)}" />
        <button id="btnAdminRefresh" class="btn" type="button">تحديث</button>
        <span class="small muted">المعروض: ${escapeHtml(loadedTxt)} / ${escapeHtml(totalTxt)}</span>
      </div>
    </div>

    <div class="hr"></div>

    <div id="adminList">${listHtml}</div>

    <div class="hr"></div>

    <div class="pill">🔔 الإشعارات</div>
    <div class="small" style="margin-top:10px;">${escapeHtml(pushStatus || "—")}</div>
  `);
}

export function renderHome({ user, pushStatus = "" } = {}) {
  return renderShell(`
    ${renderTopBar({ user })}

    <div class="hr"></div>

    <div class="row">
      <div class="col">
        <div class="pill">✅ الواجهة جاهزة</div>
        <div class="small" style="margin-top:10px;">
          استخدم القائمة حسب الدور لعرض الصفحات.
        </div>
      </div>
      <div class="col">
        <div class="pill">🔔 الإشعارات</div>
        <div class="small" style="margin-top:10px;">${escapeHtml(pushStatus || "—")}</div>
      </div>
    </div>

    <div class="hr"></div>

    <div class="muted">هذه صفحة عامة.</div>
  `);
}
