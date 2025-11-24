const STATIC_CACHE = 'the-link-static-v9';
const API_CACHE = 'the-link-api-v9';
const NETWORK_TIMEOUT = 10000; // 10 seconds (increased from 3s)
const LONG_NETWORK_TIMEOUT = 20000; // 20 seconds for data-heavy endpoints

// Don't precache index.html - always fetch fresh to get latest bundle references
const staticAssets = [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(staticAssets))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Helper: Check if request is for API
function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

// Helper: Check if request is for HTML document (navigation)
function isHtmlNavigation(request) {
  return request.mode === 'navigate' || 
         request.destination === 'document' ||
         request.headers.get('Accept')?.includes('text/html');
}

// Helper: Check if request is HTTP(S)
function isHttpScheme(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

// Helper: Check if request should bypass cache
function shouldBypassCache(request) {
  // Never cache non-HTTP(S) requests (chrome-extension://, etc)
  const url = new URL(request.url);
  if (!isHttpScheme(url)) {
    return true;
  }

  // Never cache mutations
  if (request.method !== 'GET') {
    return true;
  }

  // Never cache auth-sensitive endpoints
  if (request.url.includes('/auth/') ||
      request.url.includes('/login') ||
      request.url.includes('/api/portal/attachments/') ||
      request.url.includes('/api/portal/documents/') ||
      request.url.includes('/api/documents/') ||
      request.url.includes('/api/internal/messages/attachments/') ||
      request.url.includes('/objects/')) {
    return true;
  }

  return false;
}

// Helper: Check if request needs longer timeout for data-heavy operations
function needsLongTimeout(request) {
  return request.url.includes('/api/projects') ||
         request.url.includes('/api/clients') ||
         request.url.includes('/api/people') ||
         request.url.includes('/api/dashboard/');
}

// Helper: Check if response should be cached
function shouldCacheResponse(response) {
  // Don't cache if not successful
  if (!response || response.status !== 200) {
    return false;
  }
  
  // Respect Cache-Control headers
  const cacheControl = response.headers.get('Cache-Control');
  if (cacheControl && (cacheControl.includes('no-store') || cacheControl.includes('private'))) {
    return false;
  }
  
  // Don't cache responses with Set-Cookie
  if (response.headers.has('Set-Cookie')) {
    return false;
  }
  
  return true;
}

// Network-first strategy with timeout for API requests
async function networkFirstWithTimeout(request, timeout = NETWORK_TIMEOUT) {
  const cacheName = API_CACHE;

  // Only cache HTTP(S) requests
  const url = new URL(request.url);
  if (!isHttpScheme(url)) {
    return fetch(request);
  }

  try {
    // Race between network request and timeout
    const networkPromise = fetch(request);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout')), timeout)
    );

    const response = await Promise.race([networkPromise, timeoutPromise]);

    // Update cache with fresh response if cacheable
    if (shouldCacheResponse(response)) {
      const cache = await caches.open(cacheName);
      try {
        cache.put(request, response.clone());
      } catch (error) {
        // Silently ignore cache put errors
        console.warn('Failed to cache API response:', request.url, error);
      }
    }

    return response;
  } catch (error) {
    // Network failed or timed out - try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Add header to indicate stale data
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-From-Cache', 'true');

      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: headers
      });
    }

    // No cache available - return error
    throw error;
  }
}

// Cache-first strategy for static assets
async function cacheFirst(request) {
  // Only cache HTTP(S) requests
  const url = new URL(request.url);
  if (!isHttpScheme(url)) {
    return fetch(request);
  }

  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (shouldCacheResponse(response)) {
    const cache = await caches.open(STATIC_CACHE);
    try {
      cache.put(request, response.clone());
    } catch (error) {
      // Silently ignore cache put errors (e.g., invalid schemes)
      console.warn('Failed to cache:', request.url, error);
    }
  }

  return response;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip caching for certain requests
  if (shouldBypassCache(event.request)) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // HTML navigation requests: always fetch from network to get latest bundle references
  // This ensures users get new features immediately without clearing cache
  if (isHtmlNavigation(event.request)) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // API requests: network-first with offline fallback
  // Use longer timeout for data-heavy endpoints
  if (isApiRequest(url)) {
    const timeout = needsLongTimeout(event.request) ? LONG_NETWORK_TIMEOUT : NETWORK_TIMEOUT;
    event.respondWith(networkFirstWithTimeout(event.request, timeout));
    return;
  }
  
  // Static assets (JS, CSS with content hashes): cache-first for performance
  // These can be cached aggressively since filenames change when content changes
  event.respondWith(cacheFirst(event.request));
});

self.addEventListener('push', (event) => {
  let data = {};
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'New Notification',
        body: event.data.text()
      };
    }
  }
  
  const title = data.title || 'The Link';
  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    tag: data.tag || 'default-notification',
    data: {
      url: data.url || '/',
      ...data.data
    },
    actions: data.actions || [],
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (let client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
