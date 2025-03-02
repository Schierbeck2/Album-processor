// Service worker for Album Processor PWA
const CACHE_NAME = 'album-processor-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests and requests to n8n webhook
  if (event.request.method !== 'GET' || 
      event.request.url.includes('webhook/google-photo-link')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Share target handler
self.addEventListener('fetch', event => {
  if (event.request.url.endsWith('/share-target') && 
      event.request.method === 'POST') {
    
    event.respondWith((async () => {
      // Clone the request to extract form data
      const formData = await event.request.formData();
      const link = formData.get('link') || '';
      const text = formData.get('text') || '';
      
      // Redirect to index page with the shared link as a query parameter
      let redirectUrl = '/index.html';
      
      if (link && link.includes('photos.google.com')) {
        redirectUrl += `?link=${encodeURIComponent(link)}`;
      } else if (text && text.includes('photos.google.com')) {
        redirectUrl += `?text=${encodeURIComponent(text)}`;
      }
      
      return Response.redirect(redirectUrl, 303);
    })());
  }
});
