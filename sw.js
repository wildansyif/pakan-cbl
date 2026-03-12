const CACHE_NAME = 'pakan-cbl-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Jika ada di memori HP, tampilkan itu. Jika tidak, ambil dari internet.
      return response || fetch(event.request);
    })
  );
});
