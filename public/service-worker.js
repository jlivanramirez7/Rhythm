const CACHE_NAME = 'rhythm-cache-v8';
// Only cache the core app shell files that don't have external dependencies.
// HTML files will be cached on their first visit via the fetch handler.
const urlsToCache = [
  '/styles.css',
  '/app.js',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
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
    }).then(() => self.clients.claim())
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
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(request, responseToCache);
            });
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
  } else {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(request, responseToCache);
            });
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
  }
});

// Handle incoming Web Push notifications for cycle phase transitions
self.addEventListener('push', event => {
  let payload = {
    title: 'Rhythm Cycle Update',
    body: 'You have entered a new phase in your cycle.',
    tag: 'rhythm-phase-transition',
    url: '/app'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch (e) {
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'rhythm-phase-transition',
    renotify: true,
    data: { url: payload.url || '/app' }
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/app';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes('/app') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

