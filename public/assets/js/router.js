// public/assets/js/router.js
// Simple hash router: #/login, #/agent, #/staff, #/admin

export function getRoute() {
  const h = String(location.hash || "").trim();
  // supports "#/agent" or "#agent"
  const cleaned = h.replace(/^#\/?/, "");
  return cleaned || "login";
}

export function go(route) {
  const r = String(route || "").trim() || "login";
  location.hash = `#/${r}`;
}

export function roleToHome(role) {
  const r = String(role || "").trim();

  // عدّلها حسب أدوارك الفعلية
  if (r === "مندوب") return "agent";
  if (r === "موظف") return "staff";
  if (r === "مدير" || r === "مشرف" || r === "Admin") return "admin";

  return "login";
}

export function guardRoute(route, me) {
  // routes that require login
  const protectedRoutes = new Set(["agent", "staff", "admin"]);

  if (!protectedRoutes.has(route)) return { ok: true };

  if (!me) return { ok: false, redirect: "login" };

  // role-based protection
  if (route === "agent" && me.role !== "مندوب") return { ok: false, redirect: roleToHome(me.role) };
  if (route === "staff" && me.role !== "موظف") return { ok: false, redirect: roleToHome(me.role) };
  if (route === "admin" && !(me.role === "مدير" || me.role === "مشرف" || me.role === "Admin"))
    return { ok: false, redirect: roleToHome(me.role) };

  return { ok: true };
}
