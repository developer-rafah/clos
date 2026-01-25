// public/assets/js/router.js
import { getToken } from "./api.js";

let _handlers = new Map();

export function on(route, handler, { auth = false } = {}) {
  _handlers.set(route, { handler, auth });
}

export function currentRoute() {
  const h = location.hash || "#/"; // مثال: #/agent
  return h.startsWith("#") ? h : `#${h}`;
}

export function go(route) {
  if (!route.startsWith("#")) route = `#${route}`;
  location.hash = route;
}

export async function start() {
  window.addEventListener("hashchange", () => void dispatch());
  await dispatch();
}

export async function dispatch() {
  const route = currentRoute();
  const hit = _handlers.get(route) || _handlers.get("#/") || null;

  if (!hit) return;

  if (hit.auth) {
    const token = getToken();
    if (!token) {
      // لا يوجد توكن -> حوّل للدخول
      location.hash = "#/login";
      return;
    }
  }

  await hit.handler();
}

