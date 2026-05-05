const CACHE_NAME = 'rehab-masterlist-v2';

// App shell files to pre-cache (non-HTML only)
const SHELL = [
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap',
];

// Install — cache static assets, skip waiting immediately
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate — remove ALL old caches and claim clients immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
//   HTML navigation   → network-first (always fresh), fall back to cache
//   Supabase API      → network only (never cache live data)
//   Google Fonts API  → network only
//   Other assets      → cache-first, fall back to network
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Always go straight to network for Supabase and font APIs
  if (url.includes('supabase.co') || url.includes('fonts.gstatic.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for HTML navigation (index.html, root)
  if (event.request.mode === 'navigate' ||
      url.endsWith('.html') || url.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh HTML for offline fallback
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else (fonts, icons, manifest)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => null);
    })
  );
});
