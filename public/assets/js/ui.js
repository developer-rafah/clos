export function renderLogin({ onSubmit, error = "" } = {}) {
  return `
    <div>
      <h1 class="h1">تسجيل الدخول</h1>
      <div class="muted">شاشة موحّدة للجميع — سيتم التوجيه تلقائيًا حسب الصلاحية.</div>

      <div class="hr"></div>

      <form id="loginForm">
        <div class="label">اسم المستخدم</div>
        <input class="input" name="username" autocomplete="username" inputmode="text" />

        <div class="label">كلمة المرور</div>
        <input class="input" name="password" type="password" autocomplete="current-password" />

        <div class="row" style="margin-top:14px;align-items:center;">
          <button class="btn" type="submit">دخول</button>
          <span class="small">لن يتم تسجيل الخروج إلا عند اختيار ذلك يدويًا.</span>
        </div>

        ${error ? `<div class="alert">${escapeHtml(error)}</div>` : ``}
      </form>
    </div>
  `;
}

export function bindLogin(root, onSubmit) {
  const form = root.querySelector("#loginForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    onSubmit({
      username: String(fd.get("username") || "").trim(),
      password: String(fd.get("password") || "").trim(),
    });
  });
}

export function renderHome({ user, pushStatus = "" } = {}) {
  const role = escapeHtml(user?.role || "");
  const name = escapeHtml(user?.name || user?.username || "");
  return `
    <div>
      <div class="row" style="justify-content:space-between;align-items:center;">
        <div>
          <h1 class="h1">مرحبًا ${name}</h1>
          <div class="muted">الدور: <span class="pill">${role}</span></div>
        </div>
        <div class="row" style="gap:10px;">
          <button id="btnEnablePush" class="btn btn--ghost" type="button">تفعيل الإشعارات</button>
          <button id="btnLogout" class="btn btn--danger" type="button">تسجيل الخروج</button>
        </div>
      </div>

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
    </div>
  `;
}

export function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (ch) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[ch]));
}
