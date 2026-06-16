(() => {
  const ADMIN_SESSION_ENDPOINT = '/.netlify/functions/admin-session';
  const UPDATE_GAMES_ENDPOINT = '/.netlify/functions/update-games';
  const TAG_CLASSES = ['ctag-red', 'ctag-tan', 'ctag-yellow', 'ctag-green', 'ctag-blue'];

  const html = document.documentElement;
  const themeButton = document.getElementById('themeToggle');
  const gameGrid = document.getElementById('gameGrid');
  let games = [];
  let adminSession = { canEdit: false };

  initThemeToggle();
  initGames();
  initProgressObserver();
  initServiceWorker();

  function initThemeToggle() {
    if (!themeButton) return;
    const saved = localStorage.getItem('wg-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) html.setAttribute('data-theme', 'dark');

    themeButton.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('wg-theme', next);
    });
  }

  async function initGames() {
    if (!gameGrid) return;
    games = await loadGames();
    await refreshAdminSession();
    renderGames();
    initIdentityListeners();
  }

  async function loadGames() {
    try {
      const response = await fetch('data/games.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load games');
      const data = await response.json();
      return Array.isArray(data.games) ? data.games : [];
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  function renderGames() {
    gameGrid.innerHTML = '';
    games.forEach(game => gameGrid.appendChild(createGameCard(game)));
    if (adminSession.canEdit) gameGrid.appendChild(createAddGameCard());
  }

  function createGameCard(game) {
    const card = document.createElement('div');
    card.className = `game-card${game.status === 'coming-soon' ? ' wip' : ''}`;
    card.dataset.gameId = game.id;
    if (game.link && game.status !== 'coming-soon') {
      card.classList.add('is-clickable');
      card.setAttribute('role', 'link');
      card.tabIndex = 0;
      card.addEventListener('click', () => window.open(game.link, '_blank', 'noopener'));
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          window.open(game.link, '_blank', 'noopener');
        }
      });
    }

    const art = document.createElement('div');
    art.className = 'card-art';
    art.innerHTML = `<img class="card-cover" src="${escapeAttr(game.coverArt)}" alt="${escapeAttr(game.title)} cover art">`;
    if (game.badge) art.insertAdjacentHTML('beforeend', `<span class="wip-badge">${escapeHtml(game.badge)}</span>`);
    card.appendChild(art);

    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML = `
      <div class="card-tags">${renderTags(game.tags || [])}</div>
      <h3 class="card-title">${escapeHtml(game.title)}</h3>
      <p class="card-desc">${escapeHtml(game.description)}</p>
    `;

    if (game.status === 'coming-soon') {
      body.insertAdjacentHTML('beforeend', `
        <div class="card-progress">
          <div class="progress-label"><span>${escapeHtml(game.progressLabel || 'Baking progress')}</span><span>${escapeHtml(game.progressValue || 'Dough Rising')}</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width: ${Number(game.progressPercent || 0)}%"></div></div>
        </div>
      `);
    } else {
      body.insertAdjacentHTML('beforeend', `
        <div class="card-footer">
          <span class="card-play">Play now <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span class="card-platform">${escapeHtml(game.platform || 'Browser · Mobile')}</span>
        </div>
      `);
    }

    card.appendChild(body);
    if (adminSession.canEdit) addAdminMenu(card, game);
    return card;
  }

  function createAddGameCard() {
    const card = document.createElement('a');
    card.className = 'game-card add-game-card';
    card.href = 'admin.html?game=new';
    card.innerHTML = '<span class="add-game-plus">+</span><span class="add-game-text">Add new game</span>';
    return card;
  }

  function addAdminMenu(card, game) {
    const controls = document.createElement('div');
    controls.className = 'card-admin-controls';
    controls.innerHTML = `
      <button class="card-menu-button" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Open menu for ${escapeAttr(game.title)}">...</button>
      <div class="card-menu" role="menu">
        <a role="menuitem" href="admin.html?game=${encodeURIComponent(game.id)}">Edit</a>
        <button role="menuitem" type="button" data-delete-game="${escapeAttr(game.id)}">Delete</button>
      </div>
    `;

    controls.addEventListener('click', event => event.stopPropagation());
    const button = controls.querySelector('.card-menu-button');
    const menu = controls.querySelector('.card-menu');
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      closeMenus(menu);
      const isOpen = menu.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(isOpen));
    });

    controls.querySelector('[data-delete-game]').addEventListener('click', async event => {
      event.preventDefault();
      const confirmed = window.confirm(`Delete ${game.title} from the site?`);
      if (!confirmed) return;
      const previousGames = games;
      games = games.filter(item => item.id !== game.id);
      try {
        await saveGames(games);
        renderGames();
      } catch (error) {
        games = previousGames;
        window.alert(error.message || 'Unable to delete this game.');
      }
    });

    card.appendChild(controls);
  }

  async function saveGames(nextGames) {
    const user = getIdentityUser();
    const token = user && user.token && user.token.access_token;
    if (!token) throw new Error('You must be logged in to save changes.');

    const response = await fetch(UPDATE_GAMES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ games: nextGames })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Unable to save changes.');
    }
  }

  async function refreshAdminSession() {
    const user = getIdentityUser();
    const token = user && user.token && user.token.access_token;
    if (!token) {
      adminSession = { canEdit: false };
      document.body.classList.remove('is-admin');
      return;
    }

    try {
      const response = await fetch(ADMIN_SESSION_ENDPOINT, { headers: { Authorization: `Bearer ${token}` } });
      adminSession = response.ok ? await response.json() : { canEdit: false };
    } catch (error) {
      adminSession = { canEdit: false };
    }

    document.body.classList.toggle('is-admin', Boolean(adminSession.canEdit));
  }

  function initIdentityListeners() {
    if (!window.netlifyIdentity) return;
    window.netlifyIdentity.on('login', async () => { await refreshAdminSession(); renderGames(); });
    window.netlifyIdentity.on('logout', async () => { await refreshAdminSession(); renderGames(); });
  }

  function getIdentityUser() {
    return window.netlifyIdentity && window.netlifyIdentity.currentUser ? window.netlifyIdentity.currentUser() : null;
  }

  function closeMenus(exceptMenu) {
    document.querySelectorAll('.card-menu.is-open').forEach(menu => {
      if (menu === exceptMenu) return;
      menu.classList.remove('is-open');
      const button = menu.parentElement && menu.parentElement.querySelector('.card-menu-button');
      if (button) button.setAttribute('aria-expanded', 'false');
    });
  }

  document.addEventListener('click', () => closeMenus());
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenus(); });

  function renderTags(tags) {
    return tags.map((tag, index) => `<span class="ctag ${TAG_CLASSES[index % TAG_CLASSES.length]}">${escapeHtml(tag)}</span>`).join('');
  }

  function initProgressObserver() {
    const fills = document.querySelectorAll('.progress-fill');
    if (!fills.length) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.width = entry.target.style.width || '35%';
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    fills.forEach(fill => obs.observe(fill));
  }

  function initServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    }
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
  }
})();