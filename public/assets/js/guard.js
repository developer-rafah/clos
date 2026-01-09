import { gasCall } from './api.js';
import { getSession, setSession, clearSession, goLogin } from './auth.js';

/**
 * requireAuth({ role: 'admin' | 'staff' | 'agent' })
 */
export async function requireAuth({ role } = {}) {
  const session = getSession();
  if (!session?.token) {
    goLogin(window.location.pathname);
    return;
  }

  try {
    // Validate token + get fresh user info
    const res = await gasCall('auth.me', {});
    const user = res.user;

    // Update local session with latest user info
    setSession({ token: session.token, user });

    if (role && user?.role !== role) {
      // Not allowed
      window.location.replace('/login.html');
      return;
    }
  } catch (e) {
    clearSession();
    goLogin(window.location.pathname);
  }
}
