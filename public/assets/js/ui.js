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

export function renderLogin({ error = "" } = {}) {
  return renderShell(`
    <div>
      <h1 class="h1">تسجيل الدخول</h1>
      <div class="muted">شاشة موحّدة للجميع — سيتم التوجيه تلقائيًا حسب الصلاحية.</div>

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
    <div class="row" style="justify-content:space-between;align-items:center;gap:12px;">
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

export function renderAgent({ user, pushStatus = "" } = {}) {
  return renderShell(`
    ${renderTopBar({ user })}

    <div class="hr"></div>

    <h2 class="h2">لوحة المندوب</h2>
    <div class="muted">هنا تظهر مهام المندوب (مثال: زيارات، تسليمات، تقارير...)</div>

    <div class="hr"></div>

    <div class="row" style="gap:10px;flex-wrap:wrap;">
      <button id="btnAgentRefresh" class="btn" type="button">تحديث البيانات</button>
      <button id="btnAgentTasks" class="btn btn--ghost" type="button">عرض المهام</button>
    </div>

    <div class="hr"></div>

    <div class="row">
      <div class="col">
        <div class="pill">🔔 الإشعارات</div>
        <div class="small" style="margin-top:10px;">${escapeHtml(pushStatus || "—")}</div>
      </div>
      <div class="col">
        <div class="pill">📍 مثال</div>
        <div class="small" style="margin-top:10px;">يمكنك إضافة خرائط/تتبع/زر بدء زيارة...</div>
      </div>
    </div>
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

/** fallback لو حصل شيء غير متوقع */
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
