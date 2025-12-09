const CACHE_NAME = 'hera-sanctuary-v1';

const ASSETS = [
  '/',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {
        console.log('Pre-cache warning: Check icon paths');
      });
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request).then((newRes) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, newRes.clone());
          return newRes;
        });
      });
    })
  );
});
