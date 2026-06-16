  // ── Dark mode toggle ──
  const html = document.documentElement;
  const btn = document.getElementById('themeToggle');

  if (btn) {
    const saved = localStorage.getItem('wg-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) html.setAttribute('data-theme', 'dark');

    btn.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('wg-theme', next);
    });
  }
  // ── Progress bar on scroll ──
  const fill = document.getElementById('progress-fill');
  if (fill) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { fill.style.width = '35%'; obs.disconnect(); } });
    }, { threshold: 0.5 });
    obs.observe(fill);
  }

  // ── Service worker ──
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
