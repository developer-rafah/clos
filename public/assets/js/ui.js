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

function normalizePhoneDigits(raw) {
  // للتيل/واتساب: نزيل كل شيء غير رقم
  let d = String(raw || "").replace(/\D/g, "");
  // تحويل 05xxxxxxxx إلى 9665xxxxxxx (اختياري ومفيد للواتساب)
  if (d.startsWith("0")) d = "966" + d.slice(1);
  if (d.startsWith("9660")) d = "966" + d.slice(4);
  return d;
}

function buildMapUrl(t) {
  const lat = t?.lat ?? t?.latitude ?? null;
  const lng = t?.lng ?? t?.longitude ?? t?.long ?? null;

  const hasCoords =
    lat !== null && lng !== null &&
    lat !== "" && lng !== "" &&
    !Number.isNaN(Number(lat)) &&
    !Number.isNaN(Number(lng));

  if (hasCoords) {
    const la = Number(lat);
    const ln = Number(lng);
    return {
      link: `https://www.google.com/maps?q=${encodeURIComponent(la + "," + ln)}`,
      embed: `https://www.google.com/maps?q=${encodeURIComponent(la + "," + ln)}&z=16&output=embed`,
      hasCoords: true,
    };
  }

  // fallback: بحث بالحي/الاسم/الجوال
  const q = t?.district || t?.customer_name || t?.customer_nan || t?.phone || "";
  return {
    link: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
    embed: "",
    hasCoords: false,
  };
}

function pickCustomerName(t) {
  return (
    t?.customer_name ??
    t?.customer_nan ??
    t?.customer_nam ??
    t?.customer ??
    t?.client_name ??
    ""
  );
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

        <div class="row" style="margin-top:14px;align-items:center;gap:10px;">
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

/** بطاقة طلب للمندوب */
function renderRequestCard(t) {
  const id = String(t?.id ?? t?.code ?? "").trim();
  const status = String(t?.status ?? t?.state ?? "").trim();
  const customer = String(pickCustomerName(t) || "—");
  const phoneRaw = String(t?.phone ?? t?.mobile ?? t?.customer_phone ?? "").trim();
  const phoneDigits = normalizePhoneDigits(phoneRaw);
  const district = String(t?.district ?? t?.address ?? "—");
  const notes = String(t?.notes ?? "").trim();
  const weight = (t?.weight ?? "") === null ? "" : String(t?.weight ?? "");

  const map = buildMapUrl(t);

  return `
    <div class="list__item" style="padding:14px;">
      <div class="row" style="justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
        <div style="min-width:240px;">
          <div class="strong">${escapeHtml(customer)}</div>
          <div class="small muted" style="margin-top:4px;">
            الحالة: <span class="pill">${escapeHtml(status || "—")}</span>
            <span class="pill" style="margin-inline-start:8px;">${escapeHtml(id)}</span>
          </div>
          <div class="small" style="margin-top:10px;line-height:1.8;">
            <div>📞 الجوال: <span class="strong">${escapeHtml(phoneRaw || "—")}</span></div>
            <div>📍 الحي/العنوان: <span class="strong">${escapeHtml(district)}</span></div>
            ${notes ? `<div>📝 ملاحظات: <span class="strong">${escapeHtml(notes)}</span></div>` : ``}
          </div>
        </div>

        <div style="flex:1;min-width:260px;">
          <div class="row" style="gap:10px;flex-wrap:wrap;justify-content:flex-end;">
            ${phoneDigits
              ? `
                <a class="btn btn--ghost" href="tel:${escapeHtml(phoneDigits)}">اتصال</a>
                <a class="btn btn--ghost" target="_blank" rel="noopener" href="https://wa.me/${escapeHtml(phoneDigits)}">واتساب</a>
              `
              : `<span class="small muted">لا يوجد رقم صالح للاتصال</span>`
            }
            <a class="btn btn--ghost" target="_blank" rel="noopener" href="${escapeHtml(map.link)}">الخريطة</a>
          </div>

          <div class="hr" style="margin:12px 0;"></div>

          <div class="row" style="gap:10px;flex-wrap:wrap;justify-content:flex-end;align-items:center;">
            <input
              class="input"
              style="max-width:140px;"
              inputmode="numeric"
              placeholder="الوزن"
              value="${escapeHtml(weight)}"
              data-weight-input="${escapeHtml(id)}"
            />
            <button class="btn" type="button" data-action="saveWeight" data-id="${escapeHtml(id)}">حفظ الوزن</button>

            <button
              class="btn btn--danger"
              type="button"
              data-action="closeRequest"
              data-id="${escapeHtml(id)}"
              ${status === "مكتمل" ? "disabled" : ""}
            >
              ${status === "مكتمل" ? "مغلق ✅" : "إغلاق الطلب"}
            </button>
          </div>

          <div class="small muted" style="margin-top:8px;text-align:end;" data-msg="${escapeHtml(id)}"></div>

          ${
            map.hasCoords && map.embed
              ? `
                <div style="margin-top:12px;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
                  <iframe
                    title="map-${escapeHtml(id)}"
                    src="${escapeHtml(map.embed)}"
                    width="100%"
                    height="180"
                    style="border:0;"
                    loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade"
                  ></iframe>
                </div>
              `
              : `<div class="small muted" style="margin-top:10px;text-align:end;">لا توجد إحداثيات دقيقة — تم فتح الخريطة بالبحث.</div>`
          }
        </div>
      </div>
    </div>
  `;
}

/** لوحة المندوب */
export function renderAgent({ user, pushStatus = "", tasks = [], tasksError = "" } = {}) {
  const tasksHtml = tasksError
    ? `<div class="alert">${escapeHtml(tasksError)}</div>`
    : (!tasks || tasks.length === 0)
      ? `<div class="muted">لا توجد مهام حالياً.</div>`
      : `
        <div class="list">
          ${tasks.map(renderRequestCard).join("")}
        </div>
      `;

  return renderShell(`
    ${renderTopBar({ user })}

    <div class="hr"></div>

    <h2 class="h2">لوحة المندوب</h2>
    <div class="muted">هنا تظهر مهام المندوب (طلبات/زيارات/تسليمات...)</div>

    <div class="hr"></div>

    <div class="row" style="gap:10px;flex-wrap:wrap;">
      <button id="btnAgentRefresh" class="btn" type="button">تحديث البيانات</button>
      <button id="btnAgentShowTasks" class="btn btn--ghost" type="button">عرض المهام</button>
    </div>

    <div class="hr"></div>

    <div id="agentTasks">
      ${tasksHtml}
    </div>

    <div class="hr"></div>

    <div class="pill">🔔 الإشعارات</div>
    <div class="small" style="margin-top:10px;">${escapeHtml(pushStatus || "—")}</div>
  `);
}

export function renderStaff({ user, pushStatus = "" } = {}) {
  return renderShell(`
    ${renderTopBar({ user })}

    <div class="hr"></div>

    <h2 class="h2">لوحة الموظف</h2>
    <div class="muted">هنا تظهر أدوات الموظف (مثال: استقبال طلبات، إدخال بيانات...)</div>

    <div class="hr"></div>

    <div class="row" style="gap:10px;flex-wrap:wrap;">
      <button id="btnStaffRefresh" class="btn" type="button">تحديث</button>
      <button id="btnStaffAction" class="btn btn--ghost" type="button">إجراء</button>
    </div>

    <div class="hr"></div>

    <div class="pill">🔔 الإشعارات</div>
    <div class="small" style="margin-top:10px;">${escapeHtml(pushStatus || "—")}</div>
  `);
}

export function renderAdmin({ user, pushStatus = "" } = {}) {
  return renderShell(`
    ${renderTopBar({ user })}

    <div class="hr"></div>

    <h2 class="h2">لوحة المدير</h2>
    <div class="muted">هنا تظهر إدارة النظام (مثال: المستخدمين، الصلاحيات، التقارير...)</div>

    <div class="hr"></div>

    <div class="row" style="gap:10px;flex-wrap:wrap;">
      <button id="btnAdminUsers" class="btn" type="button">المستخدمين</button>
      <button id="btnAdminReports" class="btn btn--ghost" type="button">التقارير</button>
    </div>

    <div class="hr"></div>

    <div class="pill">🔔 الإشعارات</div>
    <div class="small" style="margin-top:10px;">${escapeHtml(pushStatus || "—")}</div>
  `);
}

/** fallback */
export function renderHome({ user, pushStatus = "" } = {}) {
  return renderShell(`
    ${renderTopBar({ user })}

    <div class="hr"></div>

    <div class="row">
      <div class="col">
        <div class="pill">✅ متوافق مع الأجهزة اللوحية</div>
        <div class="small" style="margin-top:10px;">
          الواجهة تتكيف تلقائيًا مع أحجام الشاشات (Tablet/Laptop/Mobile) مع RTL كامل.
        </div>
      </div>
      <div class="col">
        <div class="pill">🔔 الإشعارات</div>
        <div class="small" style="margin-top:10px;">${escapeHtml(pushStatus || "—")}</div>
      </div>
    </div>

    <div class="hr"></div>

    <div class="muted">هذه صفحة موحّدة — المحتوى هنا يمكن تخصيصه لكل دور لاحقًا.</div>
  `);
}
