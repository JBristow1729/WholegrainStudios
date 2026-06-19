(() => {
  const LINK_ENDPOINT = '/.netlify/functions/link-game-account';
  const THEME_KEY = 'wg-theme';
  const PENDING_LINK_KEY = 'wg-pending-account-link';
  const LOADING_REDIRECT_DELAY = 650;
  const LOADING_ASSET_ROOT = '../../images/';
  const LOADING_PHRASES = ['4', '5', '6', '7', '8'].map(id => `${LOADING_ASSET_ROOT}loading-phrase-${id}.png`);
  const params = new URLSearchParams(window.location.search);
  const queryState = {
    game: normalize(params.get('game')),
    gameName: normalize(params.get('gameName')),
    gameAccountId: normalize(params.get('gameAccountId')),
    returnTo: normalize(params.get('returnTo'))
  };
  const state = hasCompleteState(queryState) ? queryState : getStoredLinkState();

  const title = document.getElementById('linkTitle');
  const copy = document.getElementById('linkCopy');
  const linkActions = document.getElementById('linkActions');
  const status = document.getElementById('linkStatus');
  const html = document.documentElement;
  const themeButton = document.getElementById('themeToggle');
  let linkInProgress = false;
  let loadingOverlay;
  let pendingChoice;

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
    title.innerHTML = `Link <span class="game-name">${escapeHtml(displayGameName(state.gameName || state.game))}</span> account`;
    copy.textContent = `Connect this game profile to your Wholegrain account.`;

    renderDefaultActions();
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
      setActionsDisabled(false);
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

    openIdentityDialog();
  }

  async function linkAccount(choice) {
    if (linkInProgress) return;

    const user = getUser();
    if (!user) {
      openIdentityDialog();
      return;
    }

    linkInProgress = true;
    setActionsDisabled(true);
    status.textContent = choice ? 'Applying your choice...' : 'Linking your account...';
    showLoadingOverlay();

    try {
      const token = await getIdentityToken(user);
      if (!token) {
        openIdentityDialog('Please sign in before linking your account.');
        setActionsDisabled(false);
        linkInProgress = false;
        return;
      }

      const response = await fetch(LINK_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...state, ...(choice || {}) })
      });

      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        openIdentityDialog(result.message || 'Please sign in before linking your account.');
        return;
      }
      if (response.status === 409 && result.requiresChoice) {
        showProfileChoice(result);
        return;
      }
      if (!response.ok) throw new Error(result.message || 'Unable to link this account.');

      clearStoredLinkState();
      status.textContent = 'Account linked. Returning to the game...';
      window.setTimeout(() => window.location.assign(result.returnTo), LOADING_REDIRECT_DELAY);
    } catch (error) {
      hideLoadingOverlay();
      status.textContent = error.message || 'Unable to link this account.';
      setActionsDisabled(false);
      linkInProgress = false;
    }
  }

  function renderDefaultActions() {
    pendingChoice = null;
    linkActions.hidden = false;
    linkActions.innerHTML = `
      <button class="hero-cta" type="button" id="linkButton">
        Link account
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    `;
    linkActions.querySelector('#linkButton').addEventListener('click', handleLinkClick);
  }

  function showProfileChoice(result) {
    hideLoadingOverlay();
    linkInProgress = false;
    pendingChoice = result;

    const gameName = result.gameName || displayGameName(state.game);
    const existingUsername = result.existingUsername || 'your existing profile';
    const localUsername = result.localUsername || 'this local profile';

    copy.textContent = `This Wholegrain account is already linked to a ${gameName} profile. Choose which profile should be kept.`;
    status.textContent = '';
    linkActions.hidden = false;
    linkActions.innerHTML = `
      <div class="al-choice" role="group" aria-label="Choose which ${escapeHtml(gameName)} profile to keep">
        <p class="al-choice-copy">Would you like to sign in to your existing linked ${escapeHtml(gameName)} account <strong>${escapeHtml(existingUsername)}</strong>, or overwrite it with your new local ${escapeHtml(gameName)} data <strong>${escapeHtml(localUsername)}</strong>?</p>
        <div class="al-choice-buttons">
          <button class="hero-cta" type="button" data-link-choice="useLinked">Use ${escapeHtml(existingUsername)}</button>
          <button class="hero-cta hero-cta--tan" type="button" data-link-choice="useLocal">Overwrite with ${escapeHtml(localUsername)}</button>
        </div>
      </div>
    `;

    linkActions.querySelectorAll('[data-link-choice]').forEach(button => {
      button.addEventListener('click', () => {
        linkAccount({
          linkChoice: button.dataset.linkChoice,
          conflictToken: pendingChoice && pendingChoice.conflictToken || undefined
        });
      });
    });
  }

  function setActionsDisabled(disabled) {
    linkActions.querySelectorAll('button').forEach(button => {
      button.disabled = disabled;
    });
  }
  function showLoadingOverlay() {
    const overlay = getLoadingOverlay();
    overlay.querySelector('.loading-phrase').src = pickLoadingPhrase();
    overlay.hidden = false;
    window.requestAnimationFrame(() => overlay.classList.add('is-visible'));
  }

  function hideLoadingOverlay() {
    if (!loadingOverlay) return;
    loadingOverlay.classList.remove('is-visible');
    window.setTimeout(() => {
      if (loadingOverlay) loadingOverlay.hidden = true;
    }, 180);
  }

  function getLoadingOverlay() {
    if (loadingOverlay) return loadingOverlay;
    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.hidden = true;
    loadingOverlay.setAttribute('role', 'status');
    loadingOverlay.setAttribute('aria-live', 'polite');
    loadingOverlay.innerHTML = `
      <div class="loading-overlay-inner">
        <img class="loading-toast" src="${LOADING_ASSET_ROOT}toast-loading.gif" alt="Toast loading animation">
        <img class="loading-phrase" src="${pickLoadingPhrase()}" alt="Loading">
      </div>
    `;
    document.body.appendChild(loadingOverlay);
    return loadingOverlay;
  }

  function pickLoadingPhrase() {
    return LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];
  }

  async function getIdentityToken(user) {
    if (user && typeof user.jwt === 'function') return user.jwt();
    return user && user.token && user.token.access_token;
  }

  function openIdentityDialog(message = 'Sign in or create a Wholegrain account to link this profile.') {
    storeLinkState(state);
    status.textContent = message;
    hideLoadingOverlay();
    renderDefaultActions();
    setActionsDisabled(false);
    linkInProgress = false;
    window.netlifyIdentity.open('login');
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
        gameName: normalize(parsed.gameName),
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
    const value = String(game || '').trim();
    return ({ pips: 'Pips', tadoo: 'Tadoo', nom: 'Nom' }[value.toLowerCase()] || state.gameName || value);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
})();
