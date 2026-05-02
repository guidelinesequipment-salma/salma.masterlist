const CACHE_NAME = 'rehab-masterlist-v1';

// App shell files to cache for offline use
const SHELL = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap',
];

// Install — cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate — remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//   Supabase API calls → network only (always fresh data)
//   Everything else   → cache first, fall back to network
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Let Supabase and Google Fonts API calls go straight to network
  if (url.includes('supabase.co') || url.includes('fonts.gstatic.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for app shell (HTML, CSS, fonts stylesheet)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache valid responses for future offline use
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // If both cache and network fail, return the cached index for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
