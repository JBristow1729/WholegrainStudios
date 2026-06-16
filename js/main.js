(() => {
  const html = document.documentElement;
  const themeButton = document.getElementById('themeToggle');

  initThemeToggle();
  initCards();
  initServiceWorker();

  function initThemeToggle() {
    if (!themeButton) return;
    const saved = localStorage.getItem('wg-theme');
    html.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');

    themeButton.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('wg-theme', next);
    });
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
