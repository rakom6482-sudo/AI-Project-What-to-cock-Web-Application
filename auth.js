/**
 * auth.js
 * Mock registration & login. Data stored in localStorage.
 * Replace the `Auth.register` / `Auth.login` methods with real API calls later.
 */

const Auth = (() => {
  const USERS_KEY    = 'fc_users';
  const SESSION_KEY  = 'fc_session';

  // ── Storage helpers ──────────────────────────────────────────────
  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
    catch { return {}; }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  }

  function saveSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  // ── Simple hash (NOT cryptographically safe — mock only) ─────────
  async function hashPassword(pass) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  // ── Public API ───────────────────────────────────────────────────
  async function register({ name, email, password }) {
    const users = getUsers();

    if (users[email]) {
      return { ok: false, error: 'An account with this email already exists.' };
    }

    const hash = await hashPassword(password);
    const user = { name, email, hash, createdAt: Date.now(), favorites: [] };
    users[email] = user;
    saveUsers(users);
    saveSession({ name, email, favorites: [] });
    return { ok: true, user: { name, email, favorites: [] } };
  }

  async function login({ email, password }) {
    const users = getUsers();
    const user  = users[email];

    if (!user) {
      return { ok: false, error: 'No account found with this email.' };
    }

    const hash = await hashPassword(password);
    if (hash !== user.hash) {
      return { ok: false, error: 'Incorrect password.' };
    }

    const session = { name: user.name, email: user.email, favorites: user.favorites || [] };
    saveSession(session);
    return { ok: true, user: session };
  }

  function logout() {
    clearSession();
  }

  function currentUser() {
    return getSession();
  }

  function addFavorite(recipe) {
    const session = getSession();
    if (!session) return;
    const users = getUsers();
    const user  = users[session.email];
    if (!user) return;

    const already = user.favorites.some(f => f.id === recipe.id);
    if (!already) {
      user.favorites.push(recipe);
      saveUsers(users);
      session.favorites = user.favorites;
      saveSession(session);
    }
  }

  function removeFavorite(recipeId) {
    const session = getSession();
    if (!session) return;
    const users = getUsers();
    const user  = users[session.email];
    if (!user) return;

    user.favorites = user.favorites.filter(f => f.id !== recipeId);
    saveUsers(users);
    session.favorites = user.favorites;
    saveSession(session);
  }

  function getFavorites() {
    const session = getSession();
    return session ? session.favorites || [] : [];
  }

  return { register, login, logout, currentUser, addFavorite, removeFavorite, getFavorites };
})();