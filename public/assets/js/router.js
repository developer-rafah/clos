// router.js - FULL
export function goto(hash) {
  location.hash = hash;
}

export function getRoute() {
  const h = (location.hash || "#/").replace(/^#/, "");
  if (h === "/" || h === "") return { name: "root" };
  if (h === "/login") return { name: "login" };

  if (h === "/agent") return { name: "agent" };
  if (h === "/staff") return { name: "staff" };
  if (h === "/admin") return { name: "admin" };

  return { name: "unknown" };
}

export function ensureHomeForRole(roleKey) {
  const r = getRoute();
  if (r.name === "login") return;
  const expected = roleKey === "agent" ? "agent" : roleKey === "staff" ? "staff" : "admin";
  if (r.name !== expected) goto(`#/${expected}`);
}
