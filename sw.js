const CACHE_NAME = 'album-processor-v1';
const API_TIMEOUT = 8000; // 8 second timeout for API calls
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png', // TODO: Add icon
  '/icons/icon-512.png', // TODO: Add icon
  '/images/*',
];

// Helper to determine if URL is API call
const isApiCall = (url) => url.includes('n8n.sputnik.sh');

// Helper to determine if request should be cached
const isCacheableRequest = (request) => {
  return request.method === 'GET' && !isApiCall(request.url);
};

// Timeout function for fetch requests
const timeoutFetch = (request, timeout) => {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
};

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(error => console.error('Cache installation failed:', error))
  );
});

// Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => caches.delete(cacheName))
        );
      })
      .catch(error => console.error('Cache cleanup failed:', error))
  );
});

// Handle fetch events
self.addEventListener('fetch', event => {
  // Handle share target separately
  if (event.request.url.endsWith('/share-target') && event.request.method === 'POST') {
    handleShareTarget(event);
    return;
  }

  // Handle regular requests
  if (isCacheableRequest(event.request)) {
    event.respondWith(handleStaticAsset(event.request));
  } else if (isApiCall(event.request.url)) {
    event.respondWith(handleApiCall(event.request));
  }
});

// Handle push events
async function handleStaticAsset(request) {
  try {
    // Try network first for fresh content
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    // Fall back to cache if network fails
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Handle API calls
async function handleApiCall(request) {
  try {
    return await timeoutFetch(request, API_TIMEOUT);
  } catch (error) {
    console.error('API call failed:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }), 
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle share target
async function handleShareTarget(event) {
  try {
    const formData = await event.request.formData();
    const link = formData.get('link') || '';
    const text = formData.get('text') || '';
    
    let redirectUrl = '/index.html';
    
    if (link?.includes('photos.google.com')) {
      redirectUrl += `?link=${encodeURIComponent(link)}`;
    } else if (text?.includes('photos.google.com')) {
      redirectUrl += `?text=${encodeURIComponent(text)}`;
    }
    
    return Response.redirect(redirectUrl, 303);
  } catch (error) {
    console.error('Share target handling failed:', error);
    return Response.redirect('/index.html?error=share-failed', 303);
  }
}
