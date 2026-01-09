import { gasCall } from '../api.js';
import { setSession, getSession } from '../auth.js';

const form = document.getElementById('loginForm');
const msg = document.getElementById('msg');

function getNext() {
  const p = new URLSearchParams(location.search);
  return p.get('next') || '';
}

function routeByRole(role) {
  if (role === 'admin') return '/admin/';
  if (role === 'staff') return '/staff/';
  return '/agent/';
}

(async function boot() {
  // If already logged in, try to route quickly
  const s = getSession();
  if (s?.token && s?.user?.role) {
    location.replace(routeByRole(s.user.role));
  }
})();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';

  const fd = new FormData(form);
  const username = (fd.get('username') || '').toString().trim();
  const password = (fd.get('password') || '').toString();

  try {
    const res = await gasCall('auth.login', { username, password });
    // expected: { ok:true, token, user:{id,name,role} }
    setSession({ token: res.token, user: res.user });

    const next = getNext();
    if (next) location.replace(next);
    else location.replace(routeByRole(res.user.role));
  } catch (err) {
    msg.textContent = err?.message || 'فشل تسجيل الدخول';
  }
});
