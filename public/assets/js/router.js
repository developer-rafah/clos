// router.js
export function getRoute() {
  const raw = (location.hash || "#/").slice(1); // remove '#'
  const [pathPart, qs] = raw.split("?");
  const path = pathPart || "/";
  const query = Object.fromEntries(new URLSearchParams(qs || ""));
  return { path, query };
}

export function goto(path, query = {}) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const q = usp.toString();
  location.hash = q ? `#${path}?${q}` : `#${path}`;
}

export function roleHome(role) {
  if (role === "agent" || role === "مندوب") return "/agent";
  if (role === "staff" || role === "موظف") return "/staff";
  return "/admin";
}
