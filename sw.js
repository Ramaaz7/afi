const CACHE_NAME = 'afi-routine-v1';
const assets = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request);
    })
  );
});
