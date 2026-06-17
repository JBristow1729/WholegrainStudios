(() => {
  const THEME_KEY = 'wg-theme';
  const PENDING_LINK_KEY = 'wg-pending-account-link';
  const ACCOUNT_LINK_PATH = 'accounts/link/';
  const IDENTITY_HASH_KEYS = ['confirmation_token', 'invite_token', 'recovery_token', 'access_token', 'error'];
  const LOADING_REDIRECT_DELAY = 650;
  const LOADING_ASSET_ROOT = 'images/';
  const LOADING_PHRASES = ['4', '5', '6', '7', '8'].map(id => `${LOADING_ASSET_ROOT}loading-phrase-${id}.png`);

  const html = document.documentElement;
  const themeButton = document.getElementById('themeToggle');
  let accountLinkRedirecting = false;
  let loadingOverlay;

  initThemeToggle();
  initIdentityHandoff();
  initCards();
  initServiceWorker();

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

  function initIdentityHandoff() {
    if (!window.netlifyIdentity) return;

    window.netlifyIdentity.on('init', user => {
      if (user) redirectToAccountLinkIfPending();
    });
    window.netlifyIdentity.on('login', () => {
      redirectToAccountLinkIfPending();
    });
    window.netlifyIdentity.init();

    if (hasPendingLink()) watchForConfirmedIdentity();
  }

  function watchForConfirmedIdentity() {
    let attempts = 0;
    const maxAttempts = 80;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (redirectToAccountLinkIfPending()) {
        window.clearInterval(timer);
        return;
      }
      if (attempts >= maxAttempts || !hasPendingLink()) window.clearInterval(timer);
    }, 250);
  }

  function redirectToAccountLinkIfPending() {
    if (accountLinkRedirecting || !hasPendingLink() || !getIdentityUser()) return false;
    accountLinkRedirecting = true;
    redirectToAccountLink();
    return true;
  }

  function redirectToAccountLink() {
    const hash = hasIdentityHash() ? window.location.hash : '';
    showLoadingOverlay();
    window.setTimeout(() => {
      window.location.replace(`${ACCOUNT_LINK_PATH}${hash}`);
    }, LOADING_REDIRECT_DELAY);
  }

  function showLoadingOverlay() {
    const overlay = getLoadingOverlay();
    overlay.querySelector('.loading-phrase').src = pickLoadingPhrase();
    overlay.hidden = false;
    window.requestAnimationFrame(() => overlay.classList.add('is-visible'));
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

  function hasPendingLink() {
    return Boolean(localStorage.getItem(PENDING_LINK_KEY) || sessionStorage.getItem(PENDING_LINK_KEY));
  }

  function getIdentityUser() {
    return window.netlifyIdentity && window.netlifyIdentity.currentUser ? window.netlifyIdentity.currentUser() : null;
  }

  function hasIdentityHash() {
    const hash = window.location.hash || '';
    return IDENTITY_HASH_KEYS.some(key => hash.includes(key));
  }

  function initCards() {
    document.querySelectorAll('.game-card[data-href]').forEach(card => {
      const open = () => window.open(card.dataset.href, '_blank', 'noopener');
      card.addEventListener('click', open);
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function initServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    }
  }
})();
