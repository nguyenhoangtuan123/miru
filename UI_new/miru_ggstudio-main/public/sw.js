const CACHE_NAME = 'miru-shell-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/miru-icon-192.svg', '/icons/miru-icon-512.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isHttpRequest = requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:';
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isDevAsset =
    isSameOrigin &&
    (requestUrl.pathname.startsWith('/src/') ||
      requestUrl.pathname.startsWith('/node_modules/') ||
      requestUrl.pathname.startsWith('/@vite/') ||
      requestUrl.searchParams.has('t'));

  if (!isHttpRequest || !isSameOrigin || isDevAsset) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/') || caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  const targetUrl = event.notification?.data?.url || '/';
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const matching = clients.find((client) => 'focus' in client && client.url.includes(self.location.origin));
      if (matching) {
        matching.navigate(targetUrl);
        return matching.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Miru',
    body: 'Ban co thong bao moi.',
    tag: 'miru-push',
    url: '/',
    data: {},
  };

  try {
    payload = { ...payload, ...(event.data ? event.data.json() : {}) };
  } catch (error) {
    payload.body = event.data?.text() || payload.body;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/icons/miru-icon-192.svg',
      badge: '/icons/miru-icon-192.svg',
      data: {
        url: payload.url || '/',
        ...(payload.data || {}),
      },
    })
  );
});
