/**
 * auth.js — Real API calls. Auto-clears old mock-auth tokens.
 */
const Auth = (() => {
  const TOKEN_KEY = 'fc_token';
  const USER_KEY  = 'fc_user';

  function getToken()      { return localStorage.getItem(TOKEN_KEY); }
  function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY,  JSON.stringify(user));
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  function authHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
  }

  async function register({ name, email, password }) {
    try {
      const res  = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error };
      saveSession(data.token, data.user);
      return { ok: true, user: data.user };
    } catch { return { ok: false, error: 'Cannot connect to server. Is it running?' }; }
  }

  async function login({ email, password }) {
    try {
      const res  = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error };
      saveSession(data.token, data.user);
      return { ok: true, user: data.user };
    } catch { return { ok: false, error: 'Cannot connect to server. Is it running?' }; }
  }

  function logout() { clearSession(); }

  function currentUser() {
    try {
      // Auto-clear old mock-auth tokens (migration)
      if (localStorage.getItem('fc_session')) {
        localStorage.removeItem('fc_session');
        localStorage.removeItem('fc_users');
        clearSession(); // force fresh login
        return null;
      }
      const user = JSON.parse(localStorage.getItem(USER_KEY));
      return (user && getToken()) ? user : null;
    } catch { return null; }
  }

  async function getFavorites() {
    if (!getToken()) return [];
    try {
      const res = await fetch('/api/favorites', { headers: authHeaders() });
      if (res.status === 401) { handleExpired(); return []; }
      return res.ok ? await res.json() : [];
    } catch { return []; }
  }

  async function addFavorite({ id, name, image }) {
    if (!getToken()) return;
    const res = await fetch('/api/favorites', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ id, name, image }),
    });
    if (res.status === 401) handleExpired();
  }

  async function removeFavorite(recipeId) {
    if (!getToken()) return;
    const res = await fetch(`/api/favorites/${recipeId}`, { method: 'DELETE', headers: authHeaders() });
    if (res.status === 401) handleExpired();
  }

  // If the server rejects our token, it's stale — clear it and reload to login
  let expiredHandled = false;
  function handleExpired() {
    if (expiredHandled) return;
    expiredHandled = true;
    clearSession();
    alert('Your session expired. Please sign in again.');
    location.reload();
  }

  return { register, login, logout, currentUser, getFavorites, addFavorite, removeFavorite, getToken };
})();