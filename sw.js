const CACHE_NAME = 'wholegrain-studios-v9';
const APP_SHELL = [
  './',
  './index.html',
  './about/',
  './about/index.html',
  './bakery/',
  './bakery/index.html',
  './css/styles.css',
  './js/main.js',
  './manifest.json',
  './data/account-apps.json',
  './js/account-link.js',
  './images/toast-logo.png',
  './images/wordmark.png',
  './images/toast-mascot.png',
  './images/toast-idle-wave.gif',
  './images/toast-loading.gif',
  './images/loading-phrase-4.png',
  './images/loading-phrase-5.png',
  './images/loading-phrase-6.png',
  './images/loading-phrase-7.png',
  './images/loading-phrase-8.png',
  './images/hero-wordmark.png',
  './images/cover-pips.png',
  './images/cover-kaboo.png',
  './images/cover-lumi.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => (key === CACHE_NAME ? undefined : caches.delete(key)))))
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
