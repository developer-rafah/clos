export function roleToHome(role) {
  const r = String(role || "").trim();
  if (r === "مدير") return "#/admin";
  if (r === "موظف") return "#/staff";
  if (r === "مندوب") return "#/agent";
  return "#/staff";
}

export function getRoute() {
  const h = location.hash || "#/";
  return h;
}

export function goto(hash) {
  if (location.hash === hash) return;
  location.hash = hash;
}
