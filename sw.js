// Kevball Service Worker
const CACHE_NAME = 'kevball-v1';

// Static assets to pre-cache on install
const PRECACHE = [
  '/',
  '/index.html',
  '/login.html',
  '/profile.html',
  '/shop.html',
  '/referee.html',
  '/scoreboard.html',
  '/history.html',
  '/stream-watch.html',
  '/privacy.html',
  '/tos.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Hosts that should always go to the network (Firebase, CDNs, fonts)
const NETWORK_ONLY_HOSTS = [
  'firebaseapp.com',
  'googleapis.com',
  'firebasestorage.app',
  'gstatic.com',
  'google.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com'
];

// ── INSTALL: pre-cache shell pages ────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE).catch(err => {
        // Don't fail install if some assets aren't available yet
        console.warn('[SW] Pre-cache partial failure:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: clean up old caches ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: smart routing ───────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always network-first for Firebase and external services
  if (NETWORK_ONLY_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // For HTML pages: network-first, fall back to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone and cache fresh version
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // For everything else (CSS, JS, images): cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});

// ── PUSH NOTIFICATIONS (future use) ───────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kevball', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
