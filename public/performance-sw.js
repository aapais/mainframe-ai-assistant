/**
 * Performance Service Worker
 *
 * Implements aggressive caching strategies for optimal performance:
 * - Search result caching
 * - Static asset optimization
 * - Background sync for metrics
 * - Lazy loading optimization
 */

const CACHE_NAME = 'mainframe-kb-performance-v1';
const CACHE_VERSION = '1.0.0';

// Cache strategies
const CACHE_STRATEGIES = {
  SEARCH_RESULTS: 'search-results-v1',
  STATIC_ASSETS: 'static-assets-v1',
  API_RESPONSES: 'api-responses-v1',
  IMAGES: 'images-v1'
};

// Cache TTL in milliseconds
const CACHE_TTL = {
  SEARCH_RESULTS: 5 * 60 * 1000,    // 5 minutes
  STATIC_ASSETS: 7 * 24 * 60 * 60 * 1000, // 7 days
  API_RESPONSES: 2 * 60 * 1000,     // 2 minutes
  IMAGES: 30 * 24 * 60 * 60 * 1000  // 30 days
};

// Performance metrics tracking
let performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  backgroundSyncs: 0,
  averageResponseTime: 0
};

/**
 * Service Worker installation
 */
self.addEventListener('install', (event) => {
  console.log('📱 Performance Service Worker installing...');

  event.waitUntil(
    Promise.all([
      // Pre-cache critical assets
      caches.open(CACHE_STRATEGIES.STATIC_ASSETS).then(cache => {
        return cache.addAll([
          '/',
          '/static/js/bundle.js',
          '/static/css/main.css',
          '/manifest.json'
        ]);
      }),

      // Initialize performance metrics storage
      self.clients.claim()
    ])
  );
});

/**
 * Service Worker activation
 */
self.addEventListener('activate', (event) => {
  console.log('✅ Performance Service Worker activated');

  event.waitUntil(
    // Clean up old caches
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
    })
  );
});

/**
 * Network request interception with intelligent caching
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Determine cache strategy based on request
  if (isSearchRequest(url)) {
    event.respondWith(handleSearchRequest(event.request));
  } else if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(event.request));
  } else if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(event.request));
  } else {
    event.respondWith(handleDefaultRequest(event.request));
  }
});

/**
 * Background sync for performance metrics
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'performance-metrics-sync') {
    event.waitUntil(syncPerformanceMetrics());
  }
});

/**
 * Handle search requests with intelligent caching
 */
async function handleSearchRequest(request) {
  const cacheKey = generateSearchCacheKey(request);
  const cache = await caches.open(CACHE_STRATEGIES.SEARCH_RESULTS);

  try {
    // Check cache first
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse && !isCacheExpired(cachedResponse, CACHE_TTL.SEARCH_RESULTS)) {
      performanceMetrics.cacheHits++;

      // Clone response and add cache hit header
      const response = cachedResponse.clone();
      response.headers.set('X-Cache-Hit', 'true');
      response.headers.set('X-Cache-Source', 'service-worker');

      return response;
    }

    // Cache miss - fetch from network
    performanceMetrics.cacheMisses++;
    performanceMetrics.networkRequests++;

    const networkResponse = await fetchWithTimeout(request, 5000);

    // Cache successful responses
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();

      // Add cache metadata
      const headers = new Headers(responseToCache.headers);
      headers.set('X-Cached-At', Date.now().toString());
      headers.set('X-Cache-TTL', CACHE_TTL.SEARCH_RESULTS.toString());

      const cachedResponse = new Response(await responseToCache.blob(), {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });

      await cache.put(cacheKey, cachedResponse);
    }

    return networkResponse;

  } catch (error) {
    console.error('Search request failed:', error);

    // Try to return stale cache if available
    const staleResponse = await cache.match(cacheKey);
    if (staleResponse) {
      const response = staleResponse.clone();
      response.headers.set('X-Cache-Hit', 'stale');
      return response;
    }

    // Return error response
    return new Response(JSON.stringify({ error: 'Search temporarily unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle static assets with long-term caching
 */
async function handleStaticAsset(request) {
  const cache = await caches.open(CACHE_STRATEGIES.STATIC_ASSETS);

  try {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      performanceMetrics.cacheHits++;
      return cachedResponse;
    }

    performanceMetrics.cacheMisses++;
    performanceMetrics.networkRequests++;

    const networkResponse = await fetchWithTimeout(request, 10000);

    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;

  } catch (error) {
    console.error('Static asset request failed:', error);
    return new Response('Asset unavailable', { status: 503 });
  }
}

/**
 * Handle API requests with short-term caching
 */
async function handleAPIRequest(request) {
  const cache = await caches.open(CACHE_STRATEGIES.API_RESPONSES);

  try {
    const cachedResponse = await cache.match(request);
    if (cachedResponse && !isCacheExpired(cachedResponse, CACHE_TTL.API_RESPONSES)) {
      performanceMetrics.cacheHits++;
      return cachedResponse;
    }

    performanceMetrics.cacheMisses++;
    performanceMetrics.networkRequests++;

    const networkResponse = await fetchWithTimeout(request, 8000);

    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('X-Cached-At', Date.now().toString());

      const cachedResponse = new Response(await responseToCache.blob(), {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });

      await cache.put(request, cachedResponse);
    }

    return networkResponse;

  } catch (error) {
    console.error('API request failed:', error);
    return new Response(JSON.stringify({ error: 'API temporarily unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle default requests
 */
async function handleDefaultRequest(request) {
  try {
    performanceMetrics.networkRequests++;
    return await fetchWithTimeout(request, 5000);
  } catch (error) {
    return new Response('Request failed', { status: 503 });
  }
}

/**
 * Generate cache key for search requests
 */
function generateSearchCacheKey(request) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  // Normalize search parameters for consistent caching
  const normalizedParams = new URLSearchParams();
  const relevantParams = ['q', 'category', 'limit', 'sort'];

  relevantParams.forEach(param => {
    if (searchParams.has(param)) {
      normalizedParams.set(param, searchParams.get(param).toLowerCase().trim());
    }
  });

  const cacheKey = `${url.pathname}?${normalizedParams.toString()}`;
  return new Request(cacheKey, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Check if cached response has expired
 */
function isCacheExpired(response, ttl) {
  const cachedAt = response.headers.get('X-Cached-At');
  if (!cachedAt) return true;

  const cacheAge = Date.now() - parseInt(cachedAt);
  return cacheAge > ttl;
}

/**
 * Fetch with timeout
 */
function fetchWithTimeout(request, timeout) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
}

/**
 * Request type detection helpers
 */
function isSearchRequest(url) {
  return url.pathname.includes('/api/search') ||
         url.pathname.includes('/api/suggest') ||
         url.searchParams.has('q');
}

function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.svg', '.ico', '.woff', '.woff2'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext)) ||
         url.pathname.startsWith('/static/');
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/') && !isSearchRequest(url);
}

/**
 * Background sync for performance metrics
 */
async function syncPerformanceMetrics() {
  try {
    performanceMetrics.backgroundSyncs++;

    // Send metrics to main thread
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'PERFORMANCE_METRICS_UPDATE',
        metrics: { ...performanceMetrics }
      });
    });

    // Reset counters
    performanceMetrics = {
      cacheHits: 0,
      cacheMisses: 0,
      networkRequests: 0,
      backgroundSyncs: performanceMetrics.backgroundSyncs,
      averageResponseTime: 0
    };

  } catch (error) {
    console.error('Failed to sync performance metrics:', error);
  }
}

/**
 * Cache cleanup on memory pressure
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_CLEANUP') {
    cleanupOldCaches().then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }

  if (event.data && event.data.type === 'GET_CACHE_STATS') {
    getCacheStats().then(stats => {
      event.ports[0].postMessage(stats);
    });
  }
});

/**
 * Clean up old cache entries
 */
async function cleanupOldCaches() {
  const cacheNames = Object.values(CACHE_STRATEGIES);

  for (const cacheName of cacheNames) {
    try {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();

      // Clean expired entries
      const cleanupPromises = requests.map(async (request) => {
        const response = await cache.match(request);
        if (response && isCacheExpired(response, CACHE_TTL.SEARCH_RESULTS)) {
          await cache.delete(request);
        }
      });

      await Promise.all(cleanupPromises);

    } catch (error) {
      console.error(`Cache cleanup failed for ${cacheName}:`, error);
    }
  }
}

/**
 * Get cache statistics
 */
async function getCacheStats() {
  const stats = {
    totalCaches: 0,
    totalEntries: 0,
    totalSize: 0,
    performance: { ...performanceMetrics }
  };

  try {
    const cacheNames = await caches.keys();
    stats.totalCaches = cacheNames.length;

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      stats.totalEntries += requests.length;
    }

  } catch (error) {
    console.error('Failed to get cache stats:', error);
  }

  return stats;
}

// Periodic cache cleanup
setInterval(() => {
  cleanupOldCaches();
}, 30 * 60 * 1000); // Every 30 minutes

// Periodic metrics sync
setInterval(() => {
  syncPerformanceMetrics();
}, 60 * 1000); // Every minute

console.log('🚀 Performance Service Worker loaded and ready');