/**
 * dashboard.js
 * Handles all dashboard interactivity:
 *   - Top nav (account, favorites, settings) panels
 *   - Left sidebar (status, music, support)
 *   - Music button drag-to-volume
 *   - Connection status simulation
 */

const Dashboard = (() => {

  // ── State ────────────────────────────────────────────────────────
  let currentUser   = null;
  let musicPlaying  = false;
  let volume        = 0.7;      // 0–1
  let audioEl       = null;
  let activePanel   = null;

  // ── DOM refs (populated on init) ────────────────────────────────
  const $ = id => document.getElementById(id);
  const Q = sel => document.querySelector(sel);

  // ── Init ─────────────────────────────────────────────────────────
  function init(user) {
    currentUser = user;

    populateUserInfo();
    initNavButtons();
    initSidebarButtons();
    initMusicDrag();
    startConnectionMonitor();
    initClickOutside();

    // Show dashboard
    $('dashboard-page').classList.add('visible');
    $('auth-page').classList.add('hidden');
  }

  // ── Populate user data ───────────────────────────────────────────
  function populateUserInfo() {
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    // Nav avatar
    document.querySelectorAll('.avatar').forEach(el => el.textContent = initials);
    document.querySelectorAll('.panel-avatar').forEach(el => el.textContent = initials);

    // Panel user info
    const nameEl  = Q('#account-panel .panel-user-info h4');
    const emailEl = Q('#account-panel .panel-user-info p');
    if (nameEl)  nameEl.textContent  = currentUser.name;
    if (emailEl) emailEl.textContent = currentUser.email;

    // Favorites badge
    updateFavoritesBadge();
  }

  function updateFavoritesBadge() {
    const favs  = Auth.getFavorites();
    const badge = Q('.nav-btn.favorites-btn .badge');
    if (badge) badge.textContent = favs.length;
  }

  // ── Nav buttons & panels ─────────────────────────────────────────
  function initNavButtons() {
    Q('.account-btn').addEventListener('click', e => {
      e.stopPropagation();
      togglePanel('account-panel');
    });

    Q('.favorites-btn').addEventListener('click', e => {
      e.stopPropagation();
      renderFavorites();
      togglePanel('favorites-panel');
    });

    Q('.settings-btn').addEventListener('click', e => {
      e.stopPropagation();
      togglePanel('settings-panel');
    });

    // Account panel items
    Q('#btn-logout').addEventListener('click', () => {
      Auth.logout();
      location.reload();
    });

    // Settings toggles
    document.querySelectorAll('.toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('on');
      });
    });
  }

  function togglePanel(id) {
    const panel = $(id);
    if (!panel) return;

    if (activePanel && activePanel !== panel) {
      activePanel.classList.remove('open');
    }

    panel.classList.toggle('open');
    activePanel = panel.classList.contains('open') ? panel : null;
  }

  function closeAllPanels() {
    document.querySelectorAll('.dropdown-panel').forEach(p => p.classList.remove('open'));
    activePanel = null;
  }

  function initClickOutside() {
    document.addEventListener('click', e => {
      if (!e.target.closest('.dropdown-panel') && !e.target.closest('.nav-btn') && !e.target.closest('.side-btn')) {
        closeAllPanels();
      }
    });
  }

  // ── Favorites panel render ────────────────────────────────────────
  function renderFavorites() {
    const panel = $('favorites-panel');
    const list  = panel.querySelector('.favorites-list');
    const favs  = Auth.getFavorites();

    list.innerHTML = '';

    if (favs.length === 0) {
      list.innerHTML = `
        <div class="favorites-empty">
          <span class="empty-icon">🥗</span>
          Save recipes here and find them later.<br>Start by searching for ingredients!
        </div>`;
      return;
    }

    favs.forEach(recipe => {
      const item = document.createElement('div');
      item.className = 'panel-menu-item';
      item.innerHTML = `<span>🍽</span><span>${recipe.name}</span>`;
      list.appendChild(item);
    });
  }

  // ── Sidebar buttons ───────────────────────────────────────────────
  function initSidebarButtons() {
    // Support button
    Q('.support-btn').addEventListener('click', e => {
      e.stopPropagation();
      togglePanel('support-panel');
    });
  }

  // ── Connection status monitor ─────────────────────────────────────
  function startConnectionMonitor() {
    const dot = Q('.status-dot');
    const btn = Q('.status-btn');

    function updateStatus() {
      if (!navigator.onLine) {
        dot.className = 'status-dot bad';
        btn.setAttribute('data-tooltip', 'Offline');
        return;
      }
      // Simulate latency check (in a real app: ping your API)
      const latency = Math.random();
      if (latency > 0.85) {
        dot.className = 'status-dot mid';
        btn.setAttribute('data-tooltip', 'Slow connection');
      } else {
        dot.className = 'status-dot good';
        btn.setAttribute('data-tooltip', 'Connected');
      }
    }

    updateStatus();
    setInterval(updateStatus, 8000);
    window.addEventListener('online',  updateStatus);
    window.addEventListener('offline', updateStatus);
  }

  // ── Music button + volume drag ────────────────────────────────────
  function initMusicDrag() {
    const btn     = Q('.music-btn');
    const popup   = btn.querySelector('.volume-popup');
    const svgFill = btn.querySelector('.volume-ring circle.fill');

    // Circumference for the SVG ring (r=25 → c≈157)
    const CIRCUMFERENCE = 2 * Math.PI * 25;
    svgFill.style.strokeDasharray  = CIRCUMFERENCE;
    updateVolumeRing();

    let isDragging  = false;
    let dragStartY  = 0;
    let dragStartVol = volume;

    // Click = toggle play/pause (if not dragging)
    btn.addEventListener('click', e => {
      if (isDragging) return;
      toggleMusic();
    });

    // Drag start
    btn.addEventListener('mousedown', startDrag);
    btn.addEventListener('touchstart', startDrag, { passive: false });

    function startDrag(e) {
      isDragging    = false;
      dragStartY    = getClientY(e);
      dragStartVol  = volume;

      function onMove(ev) {
        const dy    = dragStartY - getClientY(ev); // up = positive
        const delta = dy / 120; // 120px = full range
        isDragging  = Math.abs(dy) > 4;

        if (isDragging) {
          btn.classList.add('dragging');
          volume = Math.min(1, Math.max(0, dragStartVol + delta));
          applyVolume();
          updateVolumeRing();
          updatePopup();
        }
      }

      function onEnd() {
        btn.classList.remove('dragging');
        // Delay reset so click doesn't fire after drag
        setTimeout(() => { isDragging = false; }, 60);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend',  onEnd);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend',  onEnd);
    }

    function getClientY(e) {
      return e.touches ? e.touches[0].clientY : e.clientY;
    }

    function updateVolumeRing() {
      const offset = CIRCUMFERENCE * (1 - volume);
      svgFill.style.strokeDashoffset = offset;
    }

    function updatePopup() {
      popup.textContent = `Volume ${Math.round(volume * 100)}%`;
    }

    function applyVolume() {
      if (audioEl) audioEl.volume = volume;
    }
  }

  // ── Music toggle ──────────────────────────────────────────────────
  function toggleMusic() {
    const btn  = Q('.music-btn');
    const icon = btn.querySelector('.music-icon');

    // ─────────────────────────────────────────────────────────────
    // TODO: Replace the URL below with your actual audio source.
    // Example: const MUSIC_URL = 'https://yourdomain.com/audio/track.mp3';
    // Supports: mp3, ogg, wav, or any URL a browser <audio> can play.
    const MUSIC_URL = ''; // ← paste URL here
    // ─────────────────────────────────────────────────────────────

    if (!MUSIC_URL) {
      // No URL yet — just animate the icon as a visual placeholder
      musicPlaying = !musicPlaying;
      btn.classList.toggle('playing', musicPlaying);
      icon.textContent = musicPlaying ? '🔊' : '🔇';
      return;
    }

    if (!audioEl) {
      audioEl = new Audio(MUSIC_URL);
      audioEl.loop   = true;
      audioEl.volume = volume;
    }

    if (musicPlaying) {
      audioEl.pause();
      musicPlaying = false;
      btn.classList.remove('playing');
      icon.textContent = '🔇';
    } else {
      audioEl.play().catch(() => {});
      musicPlaying = true;
      btn.classList.add('playing');
      icon.textContent = '🔊';
    }
  }

  return { init, updateFavoritesBadge };
})();