(() => {
  const SESSION_ENDPOINT = '/.netlify/functions/admin-session';
  const UPDATE_ENDPOINT = '/.netlify/functions/update-games';
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get('game') || 'new';
  const loginPanel = document.getElementById('loginPanel');
  const loginButton = document.getElementById('loginButton');
  const logoutButton = document.getElementById('logoutButton');
  const form = document.getElementById('gameForm');
  const status = document.getElementById('adminStatus');
  const title = document.getElementById('adminTitle');
  let games = [];
  let currentGame = null;

  window.addEventListener('load', init);

  async function init() {
    loginButton.addEventListener('click', () => window.netlifyIdentity && window.netlifyIdentity.open('login'));
    logoutButton.addEventListener('click', () => window.netlifyIdentity && window.netlifyIdentity.logout());
    form.addEventListener('submit', saveGame);

    if (window.netlifyIdentity) {
      window.netlifyIdentity.on('login', () => checkAccess());
      window.netlifyIdentity.on('logout', () => showLogin());
    }

    await checkAccess();
  }

  async function checkAccess() {
    const user = getUser();
    const token = user && user.token && user.token.access_token;
    if (!token) return showLogin();

    const response = await fetch(SESSION_ENDPOINT, { headers: { Authorization: `Bearer ${token}` } });
    const session = response.ok ? await response.json() : { canEdit: false };
    if (!session.canEdit) return showLogin('This account is not approved for editing.');

    logoutButton.hidden = false;
    loginPanel.hidden = true;
    form.hidden = false;
    await loadForm();
  }

  function showLogin(message = '') {
    loginPanel.hidden = false;
    form.hidden = true;
    logoutButton.hidden = true;
    status.textContent = message;
  }

  async function loadForm() {
    const response = await fetch('data/games.json', { cache: 'no-store' });
    const data = await response.json();
    games = Array.isArray(data.games) ? data.games : [];
    currentGame = gameId === 'new' ? createBlankGame() : games.find(game => game.id === gameId);

    if (!currentGame) {
      status.textContent = 'Game not found.';
      form.hidden = true;
      return;
    }

    title.textContent = gameId === 'new' ? 'Add new game' : `Edit ${currentGame.title}`;
    form.elements.title.value = currentGame.title || '';
    form.elements.description.value = currentGame.description || '';
    form.elements.tags.value = (currentGame.tags || []).join(', ');
    form.elements.coverArt.value = currentGame.coverArt || '';
    form.elements.link.value = currentGame.link || '';
  }

  async function saveGame(event) {
    event.preventDefault();
    status.textContent = 'Saving...';

    const nextGame = {
      ...(currentGame || {}),
      id: currentGame && currentGame.id !== 'new' ? currentGame.id : slugify(form.elements.title.value),
      title: form.elements.title.value.trim(),
      description: form.elements.description.value.trim(),
      tags: form.elements.tags.value.split(',').map(tag => tag.trim()).filter(Boolean),
      coverArt: form.elements.coverArt.value.trim(),
      link: form.elements.link.value.trim(),
      platform: currentGame.platform || 'Browser · Mobile',
      status: currentGame.status || 'live'
    };

    const nextGames = gameId === 'new' ? [...games, nextGame] : games.map(game => game.id === gameId ? nextGame : game);
    const user = getUser();
    const token = user && user.token && user.token.access_token;
    const response = await fetch(UPDATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ games: nextGames })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      status.textContent = error.message || 'Unable to save this game.';
      return;
    }

    status.textContent = 'Saved. Netlify will redeploy the site shortly.';
    window.setTimeout(() => { window.location.href = 'index.html#games'; }, 900);
  }

  function createBlankGame() {
    return { id: 'new', title: '', description: '', tags: [], coverArt: '', link: '', platform: 'Browser · Mobile', status: 'live' };
  }

  function getUser() {
    return window.netlifyIdentity && window.netlifyIdentity.currentUser ? window.netlifyIdentity.currentUser() : null;
  }

  function slugify(value) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `game-${Date.now()}`;
  }
})();