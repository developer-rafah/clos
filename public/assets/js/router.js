// public/assets/js/router.js

export function roleToHome(role) {
  const r = String(role || "").trim();
  if (r === "مدير") return "#/admin";
  if (r === "موظف") return "#/staff";
  if (r === "مندوب") return "#/agent";
  return "#/staff";
}

export function getRoute() {
  const h = location.hash || "#/";
  return h === "#" ? "#/" : h;
}

export function goto(hash) {
  const target = String(hash || "#/").trim() || "#/";
  if (location.hash === target) return;
  location.hash = target;
}

/**
 * "#/"            => { name:"root",  path:"/" }
 * "#/login"       => { name:"login", path:"/login" }
 * "#/agent?id=1"  => { name:"agent", path:"/agent", query:{id:"1"} }
 */
export function parseRoute(hash = getRoute()) {
  const h = String(hash || "#/").trim();
  const noHash = h.startsWith("#") ? h.slice(1) : h;
  const [pathRaw, queryRaw] = noHash.split("?");
  const path = pathRaw || "/";
  const name = path === "/" ? "root" : path.replace(/^\//, "").split("/")[0] || "root";

  const query = {};
  if (queryRaw) {
    const params = new URLSearchParams(queryRaw);
    for (const [k, v] of params.entries()) query[k] = v;
  }

  return { name, path, query, hash: h };
}
