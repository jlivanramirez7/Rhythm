const CACHE_NAME = 'rhythm-cache-v5';
// Only cache the core app shell files that don't have external dependencies.
// HTML files will be cached on their first visit via the fetch handler.
const urlsToCache = [
  '/styles.css',
  '/app.js',
  '/logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching core assets.');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // If the request is for a different origin, do not handle it. Let the browser do its thing.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Let the browser handle non-GET requests and auth routes directly.
  if (request.method !== 'GET' || url.pathname.startsWith('/auth/') || url.pathname === '/logout') {
    return;
  }

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
    // For all other requests (app shell and HTML pages), use a cache-first strategy.
    // This will cache pages like app.html and index.html as they are visited.
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(request).then(response => {
          return response || fetch(request).then(networkResponse => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  }
});
