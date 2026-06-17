(() => {
  const THEME_KEY = 'wg-theme';
  const PENDING_LINK_KEY = 'wg-pending-account-link';
  const ACCOUNT_LINK_PATH = 'accounts/link/';
  const IDENTITY_HASH_KEYS = ['confirmation_token', 'invite_token', 'recovery_token', 'access_token', 'error'];

  const html = document.documentElement;
  const themeButton = document.getElementById('themeToggle');

  initThemeToggle();
  routeIdentityCallback();
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

  function routeIdentityCallback() {
    if (!hasIdentityHash()) return;

    const pendingLink = localStorage.getItem(PENDING_LINK_KEY) || sessionStorage.getItem(PENDING_LINK_KEY);
    if (pendingLink) {
      window.location.replace(`${ACCOUNT_LINK_PATH}${window.location.hash}`);
      return;
    }

    if (window.netlifyIdentity) window.netlifyIdentity.init();
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