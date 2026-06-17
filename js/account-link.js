(() => {
  const LINK_ENDPOINT = '/.netlify/functions/link-game-account';
  const THEME_KEY = 'wg-theme';
  const PENDING_LINK_KEY = 'wg-pending-account-link';
  const params = new URLSearchParams(window.location.search);
  const queryState = {
    game: normalize(params.get('game')),
    gameAccountId: normalize(params.get('gameAccountId')),
    returnTo: normalize(params.get('returnTo'))
  };
  const state = hasCompleteState(queryState) ? queryState : getStoredLinkState();

  const title = document.getElementById('linkTitle');
  const copy = document.getElementById('linkCopy');
  const linkActions = document.getElementById('linkActions');
  const linkButton = document.getElementById('linkButton');
  const status = document.getElementById('linkStatus');
  const html = document.documentElement;
  const themeButton = document.getElementById('themeToggle');
  let linkInProgress = false;

  window.addEventListener('load', init);

  function init() {
    initThemeToggle();

    if (!window.netlifyIdentity) {
      showFatal('Account linking is unavailable right now. Please try again in a moment.');
      return;
    }

    if (!hasCompleteState(state)) {
      showFatal('This account link is missing required information. Return to the game and try again.');
      return;
    }

    storeLinkState(state);
    title.innerHTML = `Link <span class="game-name">${escapeHtml(displayGameName(state.game))}</span> account`;
    copy.textContent = `Connect this game profile to your Wholegrain account.`;

    linkButton.addEventListener('click', handleLinkClick);
    window.netlifyIdentity.on('init', user => {
      if (user) linkAccount();
    });
    window.netlifyIdentity.on('login', () => {
      window.netlifyIdentity.close();
      linkAccount();
    });
    window.netlifyIdentity.on('signup', () => {
      status.textContent = 'Check your email to verify your Wholegrain account. This browser will finish linking after verification.';
    });
    window.netlifyIdentity.on('error', error => {
      status.textContent = error && error.message ? error.message : 'Unable to complete account sign in.';
      linkButton.disabled = false;
      linkInProgress = false;
    });
    window.netlifyIdentity.init();

    if (getUser()) {
      status.textContent = `Signed in as ${getUser().email || 'your Wholegrain account'}. Linking now...`;
      linkAccount();
    } else if (!hasCompleteState(queryState) && hasCompleteState(state)) {
      status.textContent = 'Sign in to finish linking your account.';
    }
  }

  function initThemeToggle() {
    applyStoredTheme();

    if (themeButton) {
      themeButton.addEventListener('click', () => {
        const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        setTheme(next);
      });
    }

    window.addEventListener('storage', event => {
      if (event.key === THEME_KEY) applyStoredTheme();
    });
  }

  function applyStoredTheme() {
    setTheme(localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light', false);
  }

  function setTheme(theme, persist = true) {
    html.setAttribute('data-theme', theme);
    if (themeButton) {
      themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
      themeButton.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
    if (persist) localStorage.setItem(THEME_KEY, theme);
  }

  function handleLinkClick() {
    if (getUser()) {
      linkAccount();
      return;
    }

    storeLinkState(state);
    status.textContent = 'Sign in or create a Wholegrain account to link this profile.';
    window.netlifyIdentity.open();
  }

  async function linkAccount() {
    if (linkInProgress) return;

    const user = getUser();
    const token = user && user.token && user.token.access_token;
    if (!token) {
      handleLinkClick();
      return;
    }

    linkInProgress = true;
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

      clearStoredLinkState();
      status.textContent = 'Account linked. Returning to the game...';
      window.location.assign(result.returnTo);
    } catch (error) {
      status.textContent = error.message || 'Unable to link this account.';
      linkButton.disabled = false;
      linkInProgress = false;
    }
  }

  function showFatal(message) {
    title.textContent = 'Unable to link account';
    copy.textContent = message;
    linkActions.hidden = true;
    status.textContent = '';
  }

  function getUser() {
    return window.netlifyIdentity && window.netlifyIdentity.currentUser ? window.netlifyIdentity.currentUser() : null;
  }

  function storeLinkState(value) {
    const serialized = JSON.stringify(value);
    sessionStorage.setItem(PENDING_LINK_KEY, serialized);
    localStorage.setItem(PENDING_LINK_KEY, serialized);
  }

  function getStoredLinkState() {
    return parseStoredLinkState(sessionStorage.getItem(PENDING_LINK_KEY)) || parseStoredLinkState(localStorage.getItem(PENDING_LINK_KEY)) || queryState;
  }

  function parseStoredLinkState(value) {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      const stored = {
        game: normalize(parsed.game),
        gameAccountId: normalize(parsed.gameAccountId),
        returnTo: normalize(parsed.returnTo)
      };
      return hasCompleteState(stored) ? stored : null;
    } catch (error) {
      return null;
    }
  }

  function clearStoredLinkState() {
    sessionStorage.removeItem(PENDING_LINK_KEY);
    localStorage.removeItem(PENDING_LINK_KEY);
  }

  function hasCompleteState(value) {
    return Boolean(value && value.game && value.gameAccountId && value.returnTo);
  }

  function normalize(value) {
    return String(value || '').trim();
  }

  function displayGameName(game) {
    return ({ pips: 'Pips' }[game] || game);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
})();