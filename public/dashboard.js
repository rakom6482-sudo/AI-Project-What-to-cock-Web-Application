const Dashboard = (() => {

  // ══════════════════════════════════════════════════════════════
  // MUSIC CONFIG
  // 1. Create a folder: public/music/
  // 2. Put your MP3 files inside it
  // 3. List the filenames below (just the name, not the full path)
  // ══════════════════════════════════════════════════════════════
  const TRACK_FILES = [
    '1941_002.mp3',
    '1942_002.mp3',
    '14198-Begin-the-Beguine.mp3',
    '30441 Dont sit under the apple tree.mp3',
    'Benny Goodman - Beyond The Moon.mp3',
    'Benny Goodman - Busy As A Bee.mp3',
    'Benny Goodman - I Thought About You.mp3',
    'Benny Goodman - Lets Dance.mp3',
    'Benny Goodman - That Lucky Fellow.mp3',
    'COLHCO912.mp3',
    'on the sunny side of the street_tommy dorsey aho_mono_2024.mp3',
    'Paper Doll.mp3',
    'BLUB-10075-B.mp3',
    // add more filenames here...
  ];
  const TRACKS = TRACK_FILES.map(f => `/music/${f}`);
  // ══════════════════════════════════════════════════════════════

  const COOKING_TIPS = [
    '💡 Salt pasta water until it tastes like the sea.',
    '💡 Pat meat dry before searing — moisture is the enemy of a crust.',
    '💡 Let meat rest 5 min after cooking before cutting.',
    '💡 Bloom spices in oil for 30 sec to unlock their full aroma.',
    '💡 Cold butter in pastry = flakier results. Keep it chilled!',
    '💡 Deglaze the pan after searing — that brown crust is pure flavour.',
    '💡 Add pasta water to sauce. The starch makes it cling.',
    '💡 Preheat your pan before adding oil for a better sear.',
    '💡 Acids (lemon, vinegar) brighten a dish and balance richness.',
    '💡 Toast nuts in a dry pan — deeper flavour, 3 minutes.',
    '💡 Season in layers throughout cooking, not just at the end.',
    '💡 Ripe bananas? Freeze them for smoothies or banana bread.',
    '💡 A pinch of sugar balances acidity in tomato-based sauces.',
    '💡 Room-temperature eggs emulsify better in baking.',
    '💡 Taste everything before serving — then adjust salt and acid.',
  ];

  // ── State ─────────────────────────────────────────────────────
  let currentUser  = null;
  let activePanel  = null;
  let volume       = 0.7;
  let musicActive  = false;
  let audioA       = null;   // currently playing audio
  let shuffled     = [];
  let trackIndex   = 0;
  let tipInterval  = null;
  let currentTip   = 0;
  let lastQuery    = '';
  let currentPage  = 0;        // 0-based
  let totalResults = 0;
  let pendingAvatar = null;    // base64 data URL waiting to be saved
  const PAGE_SIZE  = 12;

  const filters = { time: 'any', equip: new Set(['any']) };

  const $ = id  => document.getElementById(id);
  const Q = sel => document.querySelector(sel);

  // ── Init ──────────────────────────────────────────────────────
  async function init(user) {
    currentUser = user;
    await populateUserInfo();
    initNavButtons();
    initMusicDrag();
    startConnectionMonitor();
    initFilterChips();
    initSearch();
    initSettings();
    initModals();
    initClickOutside();
    initScrollNav();
    initAvatarUpload();
    $('dashboard-page').classList.add('visible');
    $('auth-page').classList.add('hidden');

    // If opened via a shared link (?recipe=ID), open that recipe
    const sharedId = new URLSearchParams(location.search).get('recipe');
    if (sharedId) setTimeout(() => openRecipeModal(sharedId), 400);
  }

  // ── Nav shrinks to circles + moves to edges on scroll ─────────
  function initScrollNav() {
    const overlay = $('results-overlay');
    const dash    = $('dashboard-page');
    if (!overlay) return;
    overlay.addEventListener('scroll', () => {
      dash.classList.toggle('nav-shrink', overlay.scrollTop > 60);
    });
  }

  // ── User info ─────────────────────────────────────────────────
  async function populateUserInfo() {
    applyAvatar(currentUser.avatar, currentUser.name);
    const nameEl   = $('panel-name');
    const emailEl  = $('panel-email');
    const joinedEl = $('panel-joined');
    if (nameEl)   nameEl.textContent  = currentUser.name;
    if (emailEl)  emailEl.textContent = currentUser.email;
    if (joinedEl && currentUser.createdAt) {
      joinedEl.textContent = `Member since ${new Date(currentUser.createdAt)
        .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
    }
    await updateFavoritesBadge();
  }

  // Apply avatar image (or initials fallback) everywhere
  function applyAvatar(avatar, name) {
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.querySelectorAll('.avatar, .panel-avatar').forEach(el => {
      if (avatar) {
        el.textContent = '';
        el.style.backgroundImage = `url(${avatar})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
      } else {
        el.textContent = initials;
        el.style.backgroundImage = '';
      }
    });
  }

  async function updateFavoritesBadge() {
    const favs  = await Auth.getFavorites();
    const badge = Q('.favorites-btn .badge');
    if (badge) badge.textContent = favs.length;
  }

  // ── Nav buttons ───────────────────────────────────────────────
  function initNavButtons() {
    Q('.account-btn')?.addEventListener('click',   e => { e.stopPropagation(); togglePanel('account-panel'); });
    Q('.favorites-btn')?.addEventListener('click', e => { e.stopPropagation(); renderFavorites(); togglePanel('favorites-panel'); });
    Q('.settings-btn')?.addEventListener('click',  e => { e.stopPropagation(); togglePanel('settings-panel'); });
    Q('.support-btn')?.addEventListener('click',   e => { e.stopPropagation(); togglePanel('support-panel'); });
    $('btn-logout')?.addEventListener('click', () => { Auth.logout(); location.reload(); });
    $('btn-edit-profile')?.addEventListener('click', () => { closeAllPanels(); openEditProfile(); });
    $('btn-my-recipes')?.addEventListener('click',   () => { closeAllPanels(); openMyRecipes(); });
    $('btn-support-send')?.addEventListener('click', sendSupportMessage);
  }

  function togglePanel(id) {
    const panel = $(id);
    if (!panel) return;
    if (activePanel && activePanel !== panel) activePanel.classList.remove('open');
    panel.classList.toggle('open');
    activePanel = panel.classList.contains('open') ? panel : null;
  }

  function closeAllPanels() {
    document.querySelectorAll('.dropdown-panel').forEach(p => p.classList.remove('open'));
    activePanel = null;
  }

  function initClickOutside() {
    document.addEventListener('click', e => {
      if (!e.target.closest('.dropdown-panel') && !e.target.closest('.nav-btn'))
        closeAllPanels();
    });
  }

  // ── Favorites panel ───────────────────────────────────────────
  async function renderFavorites() {
    const list = Q('#favorites-panel .favorites-list');
    if (!list) return;
    list.innerHTML = '<div class="fav-loading">Loading…</div>';
    const favs = await Auth.getFavorites();
    list.innerHTML = '';
    if (!favs.length) {
      list.innerHTML = `<div class="favorites-empty"><span class="empty-icon">🥗</span>Click 🤍 on any recipe card to save it here.</div>`;
      return;
    }
    favs.forEach(r => {
      const item = document.createElement('div');
      item.className = 'panel-menu-item';
      item.style.cursor = 'pointer';
      item.innerHTML = `
        <img src="${r.image||''}" style="width:32px;height:32px;border-radius:6px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'"/>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.name}</span>`;
      item.addEventListener('click', () => { closeAllPanels(); openRecipeModal(r.id); });
      list.appendChild(item);
    });
  }

  // ── Settings — save, load, and actually apply ─────────────────
  function initSettings() {
    const saved = JSON.parse(localStorage.getItem('fc_settings') || '{}');

    document.querySelectorAll('.toggle[data-setting]').forEach(toggle => {
      const key = toggle.dataset.setting;
      if (key in saved) toggle.classList.toggle('on', saved[key]);

      toggle.addEventListener('click', () => {
        const s = JSON.parse(localStorage.getItem('fc_settings') || '{}');
        s[key] = toggle.classList.contains('on');
        localStorage.setItem('fc_settings', JSON.stringify(s));
        applySettings(s);
      });
    });

    applySettings(saved);
  }

  function applySettings(s) {
    // Compact view: shorter card images
    document.body.classList.toggle('compact-view', !!s.compactView);

    // Cooking tips: rotating tip below search bar
    const existing = $('cooking-tip');
    if (s.cookingTips !== false) {
      if (!existing) createCookingTip();
      startTipRotation();
    } else {
      if (existing) existing.style.display = 'none';
      clearInterval(tipInterval);
    }

    // Notifications: request browser permission
    if (s.notifications && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function createCookingTip() {
    const searchArea = Q('.search-area') || Q('.search-area.in-overlay');
    if (!searchArea) return;
    const tip = document.createElement('div');
    tip.id = 'cooking-tip';
    tip.className = 'cooking-tip';
    tip.innerHTML = `<span id="tip-text"></span><button id="tip-next" title="Next tip">›</button>`;
    searchArea.appendChild(tip);
    showTip(0);
    $('tip-next')?.addEventListener('click', () => {
      currentTip = (currentTip + 1) % COOKING_TIPS.length;
      showTip(currentTip);
    });
  }

  function showTip(index) {
    const el = $('tip-text');
    if (el) {
      el.style.opacity = '0';
      setTimeout(() => { el.textContent = COOKING_TIPS[index]; el.style.opacity = '1'; }, 200);
    }
  }

  function startTipRotation() {
    clearInterval(tipInterval);
    const tipEl = $('cooking-tip');
    if (!tipEl) { setTimeout(startTipRotation, 500); return; }
    tipEl.style.display = '';
    showTip(currentTip);
    tipInterval = setInterval(() => {
      currentTip = (currentTip + 1) % COOKING_TIPS.length;
      showTip(currentTip);
    }, 25000);
  }

  // ── Connection monitor ────────────────────────────────────────
  function startConnectionMonitor() {
    const dot   = Q('.status-dot');
    const label = Q('.status-label');
    async function ping() {
      if (!navigator.onLine) {
        dot.className = 'status-dot bad';
        if (label) label.textContent = 'Offline'; return;
      }
      const t0 = performance.now();
      try {
        await fetch('/api/ping', { cache: 'no-store' });
        const ms = Math.round(performance.now() - t0);
        dot.className = ms < 120 ? 'status-dot good' : ms < 350 ? 'status-dot mid' : 'status-dot bad';
        if (label) label.textContent = `${ms} ms`;
      } catch {
        dot.className = 'status-dot bad';
        if (label) label.textContent = 'Error';
      }
    }
    ping();
    setInterval(ping, 8000);
    window.addEventListener('online', ping);
    window.addEventListener('offline', ping);
  }

  // ── Music — random shuffle + crossfade ────────────────────────
  function initMusicDrag() {
    const btn   = Q('.music-btn');
    const popup = btn?.querySelector('.volume-popup');
    const bar   = btn?.querySelector('.volume-bar');
    if (!btn) return;

    function applyVolume(v) {
      volume = Math.min(1, Math.max(0, v));
      if (audioA) audioA.volume = volume;
      if (bar)    bar.style.width = `${volume * 100}%`;
      if (popup)  popup.textContent = `Volume ${Math.round(volume * 100)}%`;
    }
    applyVolume(volume);

    let dragging = false, startY = 0, startVol = volume;
    btn.addEventListener('click', () => { if (!dragging) toggleMusic(); });
    btn.addEventListener('mousedown', startDrag);
    btn.addEventListener('touchstart', startDrag, { passive: false });

    function startDrag(e) {
      dragging = false; startY = cy(e); startVol = volume;
      const mv = ev => {
        const dy = startY - cy(ev); dragging = Math.abs(dy) > 4;
        if (dragging) { btn.classList.add('dragging'); applyVolume(startVol + dy / 120); }
      };
      const up = () => {
        btn.classList.remove('dragging');
        setTimeout(() => { dragging = false; }, 60);
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
        document.removeEventListener('touchmove', mv);
        document.removeEventListener('touchend', up);
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
      document.addEventListener('touchmove', mv, { passive: false });
      document.addEventListener('touchend', up);
    }
    function cy(e) { return e.touches ? e.touches[0].clientY : e.clientY; }
  }

  // Fisher-Yates shuffle
  function shuffleTracks() {
    shuffled = [...Array(TRACKS.length).keys()];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    trackIndex = 0;
  }

  function nextUrl() {
    if (!TRACKS.length) return null;
    if (!shuffled.length || trackIndex >= shuffled.length) shuffleTracks();
    return TRACKS[shuffled[trackIndex++]];
  }

  function crossfadeTo(url) {
    if (!url) return;

    const incoming = new Audio(url);
    incoming.volume = 0;

    // If the file can't be loaded, tell the user clearly
    incoming.addEventListener('error', () => {
      const btn   = Q('.music-btn');
      const icon  = btn?.querySelector('.music-icon');
      const label = btn?.querySelector('.nav-label');
      const popup = btn?.querySelector('.volume-popup');
      const file  = url.split('/').pop();
      console.error(`Music file not found: ${url}`);
      if (popup) popup.textContent = `Missing: ${file}`;
      btn?.classList.add('dragging');
      setTimeout(() => btn?.classList.remove('dragging'), 3500);
      musicActive = false;
      btn?.classList.remove('playing');
      if (icon)  icon.textContent  = '🔇';
      if (label) label.textContent = 'Music';
      audioA = null;
    });

    incoming.play().catch(() => {});

    const outgoing = audioA;
    audioA = incoming;

    // Show track name in button label
    const label = Q('.music-btn .nav-label');
    const name  = url.split('/').pop().replace(/\.\w+$/, '').replace(/[-_]+/g, ' ');
    if (label) label.textContent = `♪ ${name}`;

    const FADE_MS = 2000;
    const t0 = performance.now();

    function step(now) {
      const p = Math.min((now - t0) / FADE_MS, 1);
      if (outgoing) outgoing.volume = Math.max(0, volume * (1 - p));
      incoming.volume = Math.min(volume, volume * p);
      if (p < 1) { requestAnimationFrame(step); return; }
      if (outgoing) { outgoing.pause(); outgoing.src = ''; }
      // Auto-advance to next track when this one ends
      incoming.addEventListener('ended', () => crossfadeTo(nextUrl()), { once: true });
    }
    requestAnimationFrame(step);
  }

  function toggleMusic() {
    const btn   = Q('.music-btn');
    const icon  = btn?.querySelector('.music-icon');
    const label = btn?.querySelector('.nav-label');
    const popup = btn?.querySelector('.volume-popup');

    if (!TRACKS.length) {
      // No tracks yet — still flip the icon so the button feels alive, plus a hint
      musicActive = !musicActive;
      if (icon) icon.textContent = musicActive ? '🔊' : '🔇';
      btn?.classList.toggle('playing', musicActive);
      if (popup) popup.textContent = 'Add MP3s to public/music/';
      btn?.classList.add('dragging');
      setTimeout(() => btn?.classList.remove('dragging'), 2500);
      return;
    }

    if (musicActive) {
      if (audioA) { audioA.pause(); audioA.src = ''; audioA = null; }
      musicActive = false;
      btn?.classList.remove('playing');
      if (icon)  icon.textContent  = '🔇';
      if (label) label.textContent = 'Music';
    } else {
      crossfadeTo(nextUrl());
      musicActive = true;
      btn?.classList.add('playing');
      if (icon) icon.textContent = '🔊';
    }
  }

  // ── Filter chips ──────────────────────────────────────────────
  function initFilterChips() {
    $('time-chips')?.addEventListener('click', e => {
      const chip = e.target.closest('.chip'); if (!chip) return;
      $('time-chips').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active'); filters.time = chip.dataset.value;
    });
    $('equip-chips')?.addEventListener('click', e => {
      const chip = e.target.closest('.chip'); if (!chip) return;
      const anyChip = $('equip-chips').querySelector('[data-value="any"]');
      if (chip.dataset.value === 'any') {
        $('equip-chips').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active'); filters.equip = new Set(['any']);
      } else {
        anyChip?.classList.remove('active'); chip.classList.toggle('active');
        const sel = [...$('equip-chips').querySelectorAll('.chip.active')].map(c => c.dataset.value);
        if (!sel.length) { anyChip?.classList.add('active'); filters.equip = new Set(['any']); }
        else filters.equip = new Set(sel);
      }
    });
  }

  // ── Search ────────────────────────────────────────────────────
  function initSearch() {
    const input = $('ingredient-search');
    const icon  = Q('.search-icon');
    const go    = () => { const q = input?.value.trim(); if (q) performSearch(q); };
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    if (icon) { icon.style.cursor = 'pointer'; icon.style.pointerEvents = 'all'; icon.addEventListener('click', go); }
    Q('.search-area')?.addEventListener('wheel', e => {
      const ov = $('results-overlay');
      if (ov?.classList.contains('visible')) { e.preventDefault(); ov.scrollTop += e.deltaY; }
    }, { passive: false });
  }

  async function performSearch(query, page = 0) {
    lastQuery = query;
    currentPage = page;
    const overlay  = $('results-overlay');
    const inner    = $('results-inner');
    const grid     = $('results-grid');
    const statusEl = $('results-status');
    const searchArea = Q('.search-area');

    if (searchArea && inner && !inner.contains(searchArea)) {
      inner.insertBefore(searchArea, inner.firstChild);
      searchArea.classList.add('in-overlay');
      inner.classList.add('search-inside');
    }

    $('dashboard-page').classList.add('has-results');
    overlay.classList.add('visible');
    overlay.scrollTop = 0;
    grid.innerHTML = '';
    const pagEl = $('pagination'); if (pagEl) pagEl.innerHTML = '';
    if (statusEl) { statusEl.textContent = 'Searching…'; statusEl.className = 'results-status'; }

    const params = new URLSearchParams({ query });
    if (filters.time !== 'any') params.set('time', filters.time);
    const equip = [...filters.equip].filter(e => e !== 'any');
    if (equip.length) params.set('equip', equip.join(','));
    params.set('offset', page * PAGE_SIZE);

    const settings = JSON.parse(localStorage.getItem('fc_settings') || '{}');
    if (settings.vegetarian) params.set('diet', 'vegetarian');

    try {
      const res     = await fetch(`/api/recipes/search?${params}`);
      const data    = await res.json();
      if (!res.ok)  throw new Error(data.error);
      const recipes = data.results || [];
      totalResults  = Math.min(data.totalResults || 0, 900); // Spoonacular caps paging ~900

      if (statusEl)
        statusEl.textContent = recipes.length
          ? `${totalResults.toLocaleString()} recipes for "${query}"${settings.vegetarian ? ' (vegetarian)' : ''}`
          : 'No recipes found — try different ingredients or relax the filters.';

      if (settings.notifications && window.Notification && Notification.permission === 'granted' && recipes.length && page === 0) {
        new Notification('FridgeChef 🥬', { body: `Found ${totalResults} recipes for "${query}"` });
      }

      const favs   = await Auth.getFavorites();
      const favIds = new Set(favs.map(f => String(f.id)));
      recipes.forEach((r, i) => grid.appendChild(buildCard(r, favIds.has(String(r.id)), i)));
      renderPagination();
    } catch (err) {
      if (statusEl) { statusEl.textContent = err.message || 'Search failed.'; statusEl.className = 'results-status error'; }
    }
  }

  // ── Numbered pagination (1, 2, 3, Next) ───────────────────────
  function renderPagination() {
    const pagEl = $('pagination');
    if (!pagEl) return;
    pagEl.innerHTML = '';
    const totalPages = Math.ceil(totalResults / PAGE_SIZE);
    if (totalPages <= 1) return;

    const mk = (label, page, opts = {}) => {
      const b = document.createElement('button');
      b.className = 'page-btn' + (opts.active ? ' active' : '') + (opts.nav ? ' nav' : '');
      b.textContent = label;
      if (opts.disabled) { b.disabled = true; }
      else b.onclick = () => performSearch(lastQuery, page);
      return b;
    };

    // Prev
    pagEl.appendChild(mk('‹ Prev', currentPage - 1, { nav: true, disabled: currentPage === 0 }));

    // Window of page numbers around current
    const maxBtns = 7;
    let start = Math.max(0, currentPage - 3);
    let end   = Math.min(totalPages - 1, start + maxBtns - 1);
    start = Math.max(0, end - maxBtns + 1);

    if (start > 0) {
      pagEl.appendChild(mk('1', 0));
      if (start > 1) { const d = document.createElement('span'); d.className = 'page-dots'; d.textContent = '…'; pagEl.appendChild(d); }
    }
    for (let p = start; p <= end; p++) pagEl.appendChild(mk(String(p + 1), p, { active: p === currentPage }));
    if (end < totalPages - 1) {
      if (end < totalPages - 2) { const d = document.createElement('span'); d.className = 'page-dots'; d.textContent = '…'; pagEl.appendChild(d); }
      pagEl.appendChild(mk(String(totalPages), totalPages - 1));
    }

    // Next
    pagEl.appendChild(mk('Next ›', currentPage + 1, { nav: true, disabled: currentPage >= totalPages - 1 }));
  }

  function buildCard(recipe, isSaved, index) {
    const ingredients = recipe.extendedIngredients || [];
    const shown = ingredients.slice(0, 4);
    const extra = ingredients.length - shown.length;
    const card  = document.createElement('div');
    card.className = 'recipe-card';
    card.style.animationDelay = `${index * 0.04}s`;
    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="${recipe.image||''}" alt="${recipe.title}" loading="lazy" onerror="this.parentElement.classList.add('no-img')"/>
        <button class="card-fav-btn ${isSaved?'saved':''}" data-id="${recipe.id}" data-name="${recipe.title}" data-img="${recipe.image||''}">
          ${isSaved?'❤️':'🤍'}
        </button>
        <div class="card-time">⏱ ${recipe.readyInMinutes??'?'} min</div>
      </div>
      <div class="card-body">
        <h3 class="card-title">${recipe.title}</h3>
        <div class="card-ingredients">
          ${shown.map(i=>`<span class="ing-tag">${i.name}</span>`).join('')}
          ${extra>0?`<span class="ing-tag more">+${extra} more</span>`:''}
        </div>
        <button class="card-view-btn">View recipe →</button>
      </div>`;

    card.querySelector('.card-fav-btn').addEventListener('click', async e => {
      e.stopPropagation();
      const btn = e.currentTarget;
      if (btn.classList.contains('saved')) {
        await Auth.removeFavorite(btn.dataset.id); btn.classList.remove('saved'); btn.textContent = '🤍';
      } else {
        await Auth.addFavorite({ id: btn.dataset.id, name: btn.dataset.name, image: btn.dataset.img });
        btn.classList.add('saved'); btn.textContent = '❤️';
      }
      await updateFavoritesBadge();
    });

    card.querySelector('.card-view-btn').addEventListener('click', () => openRecipeModal(recipe.id));
    return card;
  }

  // ── Recipe modal ──────────────────────────────────────────────
  function initModals() {
    $('modal-close')?.addEventListener('click', closeRecipeModal);
    $('modal-backdrop')?.addEventListener('click', closeRecipeModal);
    $('profile-modal-close')?.addEventListener('click', () => { $('profile-modal').classList.remove('open'); document.body.style.overflow = ''; });
    $('profile-backdrop')?.addEventListener('click', () => { $('profile-modal').classList.remove('open'); document.body.style.overflow = ''; });
    $('btn-save-profile')?.addEventListener('click', saveProfile);
  }

  async function openRecipeModal(id) {
    const modal = $('recipe-modal');
    const body  = $('modal-body');
    $('modal-img').src = ''; $('modal-title').textContent = 'Loading…'; $('modal-meta').innerHTML = '';
    body.innerHTML = '<div class="modal-loading">Fetching recipe details…</div>';
    modal.classList.add('open'); document.body.style.overflow = 'hidden';

    try {
      const res = await fetch(`/api/recipes/${id}`);
      const r   = await res.json();
      if (!res.ok) throw new Error(r.error);

      $('modal-img').src = r.image || ''; $('modal-img').alt = r.title;
      $('modal-title').textContent = r.title;
      $('modal-meta').innerHTML = `
        <span class="meta-pill">⏱ ${r.readyInMinutes??'?'} min</span>
        <span class="meta-pill">👥 ${r.servings??'?'} servings</span>
        ${r.vegetarian ?'<span class="meta-pill green">🌿 Vegetarian</span>':''}
        ${r.vegan      ?'<span class="meta-pill green">🌱 Vegan</span>':''}
        ${r.glutenFree ?'<span class="meta-pill amber">🌾 Gluten-free</span>':''}`;

      const ings  = r.extendedIngredients || [];
      const steps = r.analyzedInstructions?.[0]?.steps || [];
      const yt    = `https://www.youtube.com/results?search_query=${encodeURIComponent(r.title+' recipe')}`;

      body.innerHTML = `
        <section class="social-bar" id="social-bar">
          <button class="social-btn like-btn" id="like-btn">🤍 <span id="like-count">0</span></button>
          <button class="social-btn" id="share-btn">🔗 Share</button>
          <button class="social-btn" id="repost-btn">♻ Repost</button>
          <span class="share-feedback" id="share-feedback"></span>
        </section>
        ${ings.length?`<section class="modal-section">
          <h3 class="modal-section-title">🛒 Ingredients</h3>
          <ul class="ingredient-list">${ings.map(i=>`<li>${i.original||i.name}</li>`).join('')}</ul>
        </section>`:''}
        <section class="modal-section">
          <h3 class="modal-section-title">👨‍🍳 Instructions</h3>
          ${steps.length
            ? `<ol class="steps-list">${steps.map(s=>`<li><span class="step-num">${s.number}</span><p>${s.step}</p></li>`).join('')}</ol>`
            : '<p style="color:var(--text-secondary);font-size:.9rem;">No step-by-step instructions available for this recipe.</p>'}
        </section>
        <section class="modal-section modal-links">
          <a href="${yt}" target="_blank" class="modal-link-btn yt">▶ Watch on YouTube</a>
          ${r.sourceUrl?`<a href="${r.sourceUrl}" target="_blank" class="modal-link-btn src">📄 Full recipe source</a>`:''}
        </section>
        <section class="modal-section comments-section">
          <h3 class="modal-section-title">💬 Comments (<span id="comment-count">0</span>)</h3>
          <div id="comment-form"></div>
          <div class="comments-list" id="comments-list"></div>
        </section>`;

      // Wire social buttons
      $('share-btn').onclick  = () => shareRecipe(r, 'link');
      $('repost-btn').onclick = () => shareRecipe(r, 'repost');
      $('like-btn').onclick   = () => toggleLike(id);
      buildCommentForm(id);
      loadSocial(id);
    } catch (err) {
      body.innerHTML = `<p style="color:var(--status-bad);padding:2rem;">${err.message||'Failed to load recipe.'}</p>`;
    }
  }

  function closeRecipeModal() {
    $('recipe-modal').classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── Social: likes + comments + share ──────────────────────────
  async function loadSocial(id) {
    try {
      const res  = await fetch(`/api/recipes/${id}/social`, {
        headers: Auth.getToken() ? { Authorization: `Bearer ${Auth.getToken()}` } : {},
      });
      const data = await res.json();
      updateLikeUI(data.likes, data.likedByMe);
      renderComments(data.comments || []);
    } catch { /* leave defaults */ }
  }

  function updateLikeUI(count, liked) {
    const btn = $('like-btn'); const c = $('like-count');
    if (c) c.textContent = count;
    if (btn) { btn.classList.toggle('liked', liked); btn.firstChild.textContent = liked ? '❤️ ' : '🤍 '; }
  }

  async function toggleLike(id) {
    if (!Auth.getToken()) { flashShare('Sign in to like recipes'); return; }
    try {
      const res = await fetch(`/api/recipes/${id}/like`, {
        method: 'POST', headers: { Authorization: `Bearer ${Auth.getToken()}` },
      });
      const data = await res.json();
      if (res.ok) updateLikeUI(data.likes, data.liked);
    } catch {}
  }

  function buildCommentForm(id) {
    const wrap = $('comment-form');
    if (!wrap) return;
    if (!Auth.getToken()) {
      wrap.innerHTML = '<p class="comment-login-note">Sign in to leave a comment.</p>';
      return;
    }
    wrap.innerHTML = `
      <div class="comment-input-row">
        <textarea id="comment-text" rows="2" placeholder="Share your thoughts…" maxlength="500"></textarea>
        <button class="comment-send" id="comment-send">Post</button>
      </div>`;
    $('comment-send').onclick = async () => {
      const text = $('comment-text').value.trim();
      if (!text) return;
      $('comment-send').disabled = true;
      try {
        const res = await fetch(`/api/recipes/${id}/comment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Auth.getToken()}` },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (res.ok) { $('comment-text').value = ''; await loadSocial(id); }
      } catch {}
      $('comment-send').disabled = false;
    };
  }

  function renderComments(comments) {
    const list = $('comments-list'); const cc = $('comment-count');
    if (cc) cc.textContent = comments.length;
    if (!list) return;
    if (!comments.length) { list.innerHTML = '<p class="no-comments">No comments yet — be the first!</p>'; return; }
    list.innerHTML = comments.slice().reverse().map(c => {
      const ini = c.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      const when = new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      return `<div class="comment">
        <div class="comment-avatar">${ini}</div>
        <div class="comment-content">
          <div class="comment-head"><strong>${escapeHtml(c.userName)}</strong><span>${when}</span></div>
          <p>${escapeHtml(c.text)}</p>
        </div>
      </div>`;
    }).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }

  // Share: copy a working link, or use the native share sheet for "repost"
  async function shareRecipe(recipe, mode) {
    const url = `${location.origin}/?recipe=${recipe.id}`;
    if (mode === 'repost' && navigator.share) {
      try { await navigator.share({ title: recipe.title, text: `Check out this recipe: ${recipe.title}`, url }); return; }
      catch { /* user cancelled — fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      flashShare(mode === 'repost' ? 'Link copied — paste it anywhere!' : 'Link copied to clipboard!');
    } catch {
      flashShare(url);
    }
  }

  function flashShare(text) {
    const el = $('share-feedback');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2600);
  }

  // ── My recipes ────────────────────────────────────────────────
  async function openMyRecipes() {
    const modal = $('recipe-modal');
    $('modal-img').src = ''; $('modal-title').textContent = 'My saved recipes'; $('modal-meta').innerHTML = '';
    const body = $('modal-body');
    body.innerHTML = '<div class="modal-loading">Loading…</div>';
    modal.classList.add('open'); document.body.style.overflow = 'hidden';

    const favs = await Auth.getFavorites();
    if (!favs.length) {
      body.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-secondary);">
        <div style="font-size:3rem;margin-bottom:1rem;">🥗</div>
        <p>No saved recipes yet.</p>
        <p style="margin-top:.5rem;font-size:.85rem;">Click 🤍 on any recipe card to save it here.</p>
      </div>`; return;
    }

    body.innerHTML = `<section class="modal-section">
      <div class="my-recipes-grid">
        ${favs.map(r=>`<div class="my-recipe-item" data-id="${r.id}">
          <img src="${r.image||''}" alt="${r.name}" onerror="this.style.display='none'"/>
          <span>${r.name}</span>
        </div>`).join('')}
      </div></section>`;

    body.querySelectorAll('.my-recipe-item').forEach(item => {
      item.addEventListener('click', () => openRecipeModal(item.dataset.id));
    });
  }

  // ── Edit profile ──────────────────────────────────────────────
  function openEditProfile() {
    if ($('edit-name-input')) $('edit-name-input').value = currentUser.name;
    if ($('edit-bio-input'))  $('edit-bio-input').value  = currentUser.bio || '';
    pendingAvatar = null;
    const prev = $('avatar-preview');
    if (prev) {
      if (currentUser.avatar) {
        prev.textContent = '';
        prev.style.backgroundImage = `url(${currentUser.avatar})`;
        prev.style.backgroundSize = 'cover'; prev.style.backgroundPosition = 'center';
      } else {
        prev.textContent = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        prev.style.backgroundImage = '';
      }
    }
    const msgEl = $('profile-msg'); if (msgEl) msgEl.textContent = '';
    $('profile-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function initAvatarUpload() {
    $('btn-upload-avatar')?.addEventListener('click', () => $('avatar-file')?.click());
    $('btn-remove-avatar')?.addEventListener('click', () => {
      pendingAvatar = '';   // empty string = remove on save
      const prev = $('avatar-preview');
      if (prev) { prev.style.backgroundImage = ''; prev.textContent = currentUser.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2); }
    });
    $('avatar-file')?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2.5 * 1024 * 1024) { setProfileMsg('Image too large (max ~2MB).', false); return; }
      // Resize to max 256px to keep storage small
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const max = 256;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const cv = document.createElement('canvas');
          cv.width = img.width * scale; cv.height = img.height * scale;
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          pendingAvatar = cv.toDataURL('image/jpeg', 0.85);
          const prev = $('avatar-preview');
          if (prev) { prev.textContent = ''; prev.style.backgroundImage = `url(${pendingAvatar})`; prev.style.backgroundSize='cover'; prev.style.backgroundPosition='center'; }
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function setProfileMsg(text, ok) {
    const msgEl = $('profile-msg');
    if (msgEl) { msgEl.textContent = text; msgEl.style.color = ok ? 'var(--status-good)' : 'var(--status-bad)'; }
  }

  async function saveProfile() {
    const name = $('edit-name-input')?.value.trim();
    const bio  = $('edit-bio-input')?.value || '';
    if (!name) { setProfileMsg('Name cannot be empty.', false); return; }
    const payload = { name, bio };
    if (pendingAvatar !== null) payload.avatar = pendingAvatar;
    try {
      const res  = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Auth.getToken()}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      currentUser = data.user;
      localStorage.setItem('fc_user', JSON.stringify(data.user));
      applyAvatar(data.user.avatar, data.user.name);
      const nameEl = $('panel-name'); if (nameEl) nameEl.textContent = data.user.name;
      setProfileMsg('Saved ✓', true);
      setTimeout(() => { $('profile-modal').classList.remove('open'); document.body.style.overflow = ''; }, 800);
    } catch (err) {
      setProfileMsg(err.message, false);
    }
  }

  // ── Support form ──────────────────────────────────────────────
  async function sendSupportMessage() {
    const name    = $('sup-name')?.value.trim();
    const email   = $('sup-email')?.value.trim();
    const message = $('sup-message')?.value.trim();
    const msgEl   = $('support-msg');
    if (!name || !email || !message) {
      if (msgEl) { msgEl.textContent = 'Please fill in all fields.'; msgEl.style.color = 'var(--status-bad)'; } return;
    }
    try {
      const res  = await fetch('/api/support', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (msgEl) { msgEl.textContent = "Message sent! We'll get back to you soon."; msgEl.style.color = 'var(--status-good)'; }
      $('sup-name').value = ''; $('sup-email').value = ''; $('sup-message').value = '';
    } catch (err) {
      if (msgEl) { msgEl.textContent = err.message; msgEl.style.color = 'var(--status-bad)'; }
    }
  }

  return { init, updateFavoritesBadge, getFilters: () => ({ time: filters.time, equip: [...filters.equip] }) };
})();