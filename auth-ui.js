/**
 * auth-ui.js
 * Handles auth form interaction: tab switching, validation,
 * password strength meter, form submission with loading state.
 */

(function () {

  // ── Password strength scorer ─────────────────────────────────────
  function scorePassword(pass) {
    let score = 0;
    if (pass.length >= 8)  score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score; // 0–5
  }

  function strengthMeta(score) {
    if (score <= 1) return { label: 'Weak',      pct: 20,  color: '#e05c5c' };
    if (score <= 2) return { label: 'Fair',       pct: 45,  color: '#f5c842' };
    if (score <= 3) return { label: 'Good',       pct: 70,  color: '#7cc8b0' };
                    return { label: 'Strong',     pct: 100, color: '#4ecca3' };
  }

  // ── Validate email ───────────────────────────────────────────────
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ── DOM refs ─────────────────────────────────────────────────────
  const tabRegister = document.getElementById('tab-register');
  const tabLogin    = document.getElementById('tab-login');
  const panelReg    = document.getElementById('panel-register');
  const panelLog    = document.getElementById('panel-login');

  const regName     = document.getElementById('reg-name');
  const regEmail    = document.getElementById('reg-email');
  const regPass     = document.getElementById('reg-password');
  const regPassConf = document.getElementById('reg-password-confirm');
  const regMsg      = document.getElementById('reg-message');
  const regBtn      = document.getElementById('btn-register');

  const logEmail    = document.getElementById('log-email');
  const logPass     = document.getElementById('log-password');
  const logMsg      = document.getElementById('log-message');
  const logBtn      = document.getElementById('btn-login');

  const strengthFill  = document.getElementById('strength-fill');
  const strengthLabel = document.getElementById('strength-label');

  // ── Tab switching ────────────────────────────────────────────────
  function switchTab(tab) {
    if (tab === 'register') {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      panelReg.classList.add('active');
      panelLog.classList.remove('active');
    } else {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      panelLog.classList.add('active');
      panelReg.classList.remove('active');
    }
    // Clear messages on tab switch
    clearMessage(regMsg);
    clearMessage(logMsg);
  }

  tabRegister.addEventListener('click', () => switchTab('register'));
  tabLogin.addEventListener('click',    () => switchTab('login'));

  // ── Password strength meter ───────────────────────────────────────
  regPass.addEventListener('input', () => {
    const pass  = regPass.value;
    if (!pass) {
      strengthFill.style.width = '0%';
      strengthLabel.textContent = '';
      return;
    }
    const meta = strengthMeta(scorePassword(pass));
    strengthFill.style.width      = meta.pct + '%';
    strengthFill.style.background = meta.color;
    strengthLabel.style.color     = meta.color;
    strengthLabel.textContent     = meta.label;
  });

  // ── Password visibility toggles ───────────────────────────────────
  document.querySelectorAll('.btn-toggle-pass').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      if (!input) return;
      const show = input.type === 'password';
      input.type  = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁';
    });
  });

  // ── Messages ──────────────────────────────────────────────────────
  function showMessage(el, type, text) {
    el.className = `form-message ${type}`;
    el.textContent = text;
  }

  function clearMessage(el) {
    el.className = 'form-message';
    el.textContent = '';
  }

  // ── Loading state ─────────────────────────────────────────────────
  function setLoading(btn, loading) {
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
  }

  // ── Register ──────────────────────────────────────────────────────
  regBtn.addEventListener('click', handleRegister);

  async function handleRegister() {
    clearMessage(regMsg);

    const name     = regName.value.trim();
    const email    = regEmail.value.trim();
    const pass     = regPass.value;
    const passConf = regPassConf.value;

    // Validation
    if (!name)
      return showMessage(regMsg, 'error', 'Please enter your name.');
    if (!isValidEmail(email))
      return showMessage(regMsg, 'error', 'Please enter a valid email address.');
    if (pass.length < 6)
      return showMessage(regMsg, 'error', 'Password must be at least 6 characters.');
    if (pass !== passConf)
      return showMessage(regMsg, 'error', 'Passwords do not match.');

    setLoading(regBtn, true);

    const result = await Auth.register({ name, email, password: pass });

    setLoading(regBtn, false);

    if (!result.ok) {
      return showMessage(regMsg, 'error', result.error);
    }

    showMessage(regMsg, 'success', 'Account created! Welcome 🎉');
    setTimeout(() => Dashboard.init(result.user), 800);
  }

  // ── Login ─────────────────────────────────────────────────────────
  logBtn.addEventListener('click', handleLogin);

  // Allow Enter key to submit
  [logEmail, logPass].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  });
  [regName, regEmail, regPass, regPassConf].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') handleRegister(); });
  });

  async function handleLogin() {
    clearMessage(logMsg);

    const email = logEmail.value.trim();
    const pass  = logPass.value;

    if (!isValidEmail(email))
      return showMessage(logMsg, 'error', 'Please enter a valid email address.');
    if (!pass)
      return showMessage(logMsg, 'error', 'Please enter your password.');

    setLoading(logBtn, true);

    const result = await Auth.login({ email, password: pass });

    setLoading(logBtn, false);

    if (!result.ok) {
      return showMessage(logMsg, 'error', result.error);
    }

    showMessage(logMsg, 'success', 'Welcome back! 👋');
    setTimeout(() => Dashboard.init(result.user), 600);
  }

  // ── Footer links (switch tab) ─────────────────────────────────────
  document.querySelectorAll('[data-switch-tab]').forEach(link => {
    link.addEventListener('click', () => switchTab(link.dataset.switchTab));
  });

  // ── Auto-login if session exists ──────────────────────────────────
  const existing = Auth.currentUser();
  if (existing) {
    // Small delay so background renders first
    setTimeout(() => Dashboard.init(existing), 300);
  }

})();