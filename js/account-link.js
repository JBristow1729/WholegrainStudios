(() => {
  const LINK_ENDPOINT = '/.netlify/functions/link-game-account';
  const params = new URLSearchParams(window.location.search);
  const state = {
    game: normalize(params.get('game')),
    gameAccountId: normalize(params.get('gameAccountId')),
    returnTo: normalize(params.get('returnTo'))
  };

  const title = document.getElementById('linkTitle');
  const copy = document.getElementById('linkCopy');
  const summary = document.getElementById('linkSummary');
  const loginPanel = document.getElementById('loginPanel');
  const loginButton = document.getElementById('loginButton');
  const linkActions = document.getElementById('linkActions');
  const linkButton = document.getElementById('linkButton');
  const logoutButton = document.getElementById('logoutButton');
  const status = document.getElementById('linkStatus');

  window.addEventListener('load', init);

  function init() {
    if (!state.game || !state.gameAccountId || !state.returnTo) {
      showFatal('This account link is missing required information. Return to the game and try again.');
      return;
    }

    title.textContent = `Link ${displayGameName(state.game)} account`;
    copy.textContent = `Sign in or create a Wholegrain account to connect your ${displayGameName(state.game)} profile.`;
    summary.hidden = false;
    summary.innerHTML = `<strong>Game</strong><span>${escapeHtml(displayGameName(state.game))}</span><strong>Profile ID</strong><span>${escapeHtml(state.gameAccountId)}</span>`;

    loginButton.addEventListener('click', () => window.netlifyIdentity && window.netlifyIdentity.open('login'));
    linkButton.addEventListener('click', linkAccount);
    logoutButton.addEventListener('click', () => window.netlifyIdentity && window.netlifyIdentity.logout());

    if (window.netlifyIdentity) {
      window.netlifyIdentity.on('login', renderAuthState);
      window.netlifyIdentity.on('logout', renderAuthState);
    }

    renderAuthState();
  }

  function renderAuthState() {
    const user = getUser();
    loginPanel.hidden = Boolean(user);
    linkActions.hidden = !user;
    if (user) {
      status.textContent = `Signed in as ${user.email || 'your Wholegrain account'}.`;
    } else {
      status.textContent = '';
    }
  }

  async function linkAccount() {
    const user = getUser();
    const token = user && user.token && user.token.access_token;
    if (!token) {
      status.textContent = 'Please sign in first.';
      return;
    }

    linkButton.disabled = true;
    status.textContent = 'Linking your account...';

    try {
      const response = await fetch(LINK_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(state)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Unable to link this account.');

      status.textContent = 'Account linked. Returning to the game...';
      window.location.assign(result.returnTo);
    } catch (error) {
      status.textContent = error.message || 'Unable to link this account.';
      linkButton.disabled = false;
    }
  }

  function showFatal(message) {
    title.textContent = 'Unable to link account';
    copy.textContent = message;
    loginPanel.hidden = true;
    linkActions.hidden = true;
    status.textContent = '';
  }

  function getUser() {
    return window.netlifyIdentity && window.netlifyIdentity.currentUser ? window.netlifyIdentity.currentUser() : null;
  }

  function normalize(value) {
    return String(value || '').trim();
  }

  function displayGameName(game) {
    return ({ pips: 'Pips', kaboo: 'Kaboo', lumi: 'Lumi' }[game] || game);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }
})();