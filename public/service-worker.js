const CACHE_NAME = 'rhythm-cache-v1';
const urlsToCache = [
  '/',
  '/styles.css',
  '/app.js',
  '/app.html',
  '/index.html',
  '/register.html',
  '/admin.html',
  '/logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // For API calls, use a network-first strategy.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // If the network request is successful, clone it, cache it, and return it.
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(request, responseToCache);
            });
          return response;
        })
        .catch(() => {
          // If the network request fails, try to get it from the cache.
          return caches.match(request);
        })
    );
  } else {
    // For all other requests (app shell), use a cache-first strategy.
    event.respondWith(
      caches.match(request)
        .then(response => {
          return response || fetch(request);
        })
    );
  }
});
