import { requireAuth } from '../guard.js';
import { gasCall } from '../api.js';
import { getSession, clearSession } from '../auth.js';

await requireAuth({ role: 'admin' });

const who = document.getElementById('who');
const logoutBtn = document.getElementById('logoutBtn');

const s = getSession();
who.textContent = s?.user?.name || s?.user?.id || '';

logoutBtn.addEventListener('click', async () => {
  try { await gasCall('auth.logout', {}); } catch {}
  clearSession();
  location.replace('/login.html');
});
