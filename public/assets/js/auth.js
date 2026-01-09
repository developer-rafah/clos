const KEY = 'clos.session.v1';

export function setSession(session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function getSession() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

/** Redirect helper */
export function goLogin(next = '') {
  const url = next ? `/login.html?next=${encodeURIComponent(next)}` : '/login.html';
  window.location.replace(url);
}
