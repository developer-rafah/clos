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

function renderShell(inner) {
  return `
    <div class="card">
      ${inner}
    </div>
  `;
}

function renderTopBar({ user } = {}) {
  const role = escapeHtml(user?.role || "");
  const name = escapeHtml(user?.name || user?.username || "");
  return `
    <div class="row" style="justify-content:space-between;align-items:center;gap:12px;">
      <div>
        <h1 class="h1">مرحبًا ${name}</h1>
        <div class="muted">الدور: <span class="pill">${role}</span></div>
      </div>

      <div class="row" style="gap:10px;flex-wrap:wrap;">
        <button class="btn btn--ghost" type="button" data-action="push.enable">تفعيل الإشعارات</button>
        <button class="btn btn--danger" type="button" data-action="auth.logout">تسجيل الخروج</button>
      </div>
    </div>
  `;
}

export function renderLoading(msg = "جاري التحميل...") {
  return renderShell(`
    <div style="text-align:center;padding:30px 10px;">
      <div class="spinner" style="margin:0 auto 14px auto;"></div>
      <div class="muted">${escapeHtml(msg)}</div>
    </div>
  `);
}

export function renderLogin({ error = "", debug = null } = {}) {
  return renderShell(`
    <div>
      <h1 class="h1">تسجيل الدخول</h1>
      <div class="muted">سجّل دخولك من الواجهة، سيتم التوجيه تلقائيًا حسب الصلاحية.</div>

      <div class="hr"></div>

      <form id="loginForm">
        <div class="label">اسم المستخدم</div>
        <input class="input" name="username" autocomplete="username" inputmode="text" />

        <div class="label">كلمة المرور</div>
        <input class="input" name="password" type="password" autocomplete="current-password" />

        <div class="row" style="margin-top:14px;align-items:center;gap:10px;">
          <button class="btn" type="submit">دخول</button>
          <span class="small muted">لن يتم تسجيل الخروج إلا عند اختيار ذلك يدويًا</span>
        </div>

        ${error ? `<div class="alert" style="margin-top:12px;">${escapeHtml(error)}</div>` : ``}
        ${debug ? `<div class="small muted" style="margin-top:10px;">Debug: ${escapeHtml(JSON.stringify(debug))}</div>` : ``}
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

export function renderAgent({ user, pushStatus = "", tasksHtml = "" } = {}) {
  return renderShell(`
    ${renderTopBar({ user })}

    <div class="hr"></div>

    <h2 class="h2">لوحة المندوب</h2>
    <div class="muted">هنا تظهر مهام المندوب (طلبات/زيارات/تسليمات...)</div>

    <div class="hr"></div>

    <div class="row" style="gap:10px;flex-wrap:wrap;">
      <button class="btn" type="button" data-action="agent.refresh">تحديث البيانات</button>
      <button class="btn btn--ghost" type="button" data-action="agent.tasks">عرض المهام</button>
    </div>

    <div class="hr"></div>

    <div id="agentTasks">${tasksHtml}</div>

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
      <button class="btn" type="button" data-action="staff.refresh">تحديث</button>
      <button class="btn btn--ghost" type="button" data-action="staff.action">إجراء</button>
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
      <button class="btn" type="button" data-action="admin.users">المستخدمين</button>
      <button class="btn btn--ghost" type="button" data-action="admin.reports">التقارير</button>
    </div>

    <div class="hr"></div>

    <div class="pill">🔔 الإشعارات</div>
    <div class="small" style="margin-top:10px;">${escapeHtml(pushStatus || "—")}</div>
  `);
}
