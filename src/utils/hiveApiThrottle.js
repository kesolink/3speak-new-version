/**
 * Throttled Hive API request queue
 * Limits concurrent requests to prevent rate limiting (429 errors)
 */

const MAX_CONCURRENT = 3; // Max concurrent requests
const DELAY_BETWEEN_REQUESTS = 100; // ms between starting new requests

let activeRequests = 0;
const requestQueue = [];

// Simple cache to avoid duplicate requests
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

function getCacheKey(method, params) {
  return `${method}:${JSON.stringify(params)}`;
}

function getCachedResponse(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCachedResponse(key, data) {
  cache.set(key, { data, timestamp: Date.now() });

  // Limit cache size
  if (cache.size > 500) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

async function processQueue() {
  if (requestQueue.length === 0 || activeRequests >= MAX_CONCURRENT) {
    return;
  }

  const { request, resolve, reject, cacheKey } = requestQueue.shift();
  activeRequests++;

  try {
    const result = await request();
    if (cacheKey) {
      setCachedResponse(cacheKey, result);
    }
    resolve(result);
  } catch (error) {
    reject(error);
  } finally {
    activeRequests--;
    // Small delay before processing next request
    setTimeout(processQueue, DELAY_BETWEEN_REQUESTS);
  }
}

/**
 * Queue a request with throttling and caching
 * @param {Function} requestFn - Async function that makes the actual request
 * @param {string} method - Method name for cache key
 * @param {object} params - Params for cache key
 * @param {boolean} useCache - Whether to use caching (default true)
 */
export function queueRequest(requestFn, method = '', params = {}, useCache = true) {
  const cacheKey = useCache ? getCacheKey(method, params) : null;

  // Check cache first
  if (cacheKey) {
    const cached = getCachedResponse(cacheKey);
    if (cached !== null) {
      return Promise.resolve(cached);
    }
  }

  return new Promise((resolve, reject) => {
    requestQueue.push({
      request: requestFn,
      resolve,
      reject,
      cacheKey,
    });
    processQueue();
  });
}

/**
 * Clear the request cache
 */
export function clearCache() {
  cache.clear();
}

/**
 * Get queue stats (for debugging)
 */
export function getQueueStats() {
  return {
    activeRequests,
    queueLength: requestQueue.length,
    cacheSize: cache.size,
  };
}
