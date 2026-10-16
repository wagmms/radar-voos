const CACHE_NAME = 'radar-voos-v3.6.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/js/card_rota.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Estratégia Stale-While-Revalidate para assets estáticos e estritamente Network-First para a API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Requisições para API de voos: estritamente pela rede (zero cache de dados defasados)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
    );
    return;
  }

  // Assets estáticos: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
