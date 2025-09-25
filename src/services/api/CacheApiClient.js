'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getCacheApiClient =
  exports.createCacheApiClient =
  exports.CacheApiClient =
  exports.CacheApiError =
    void 0;
class CacheApiError extends Error {
  code;
  status;
  details;
  constructor(message, code, status, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = 'CacheApiError';
  }
}
exports.CacheApiError = CacheApiError;
class CacheApiClient {
  baseUrl;
  timeout;
  retries;
  enableMetrics;
  enableCompression;
  headers;
  requestId = 0;
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '/api/cache';
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.enableMetrics = options.enableMetrics ?? true;
    this.enableCompression = options.enableCompression ?? true;
    this.headers = {
      'Content-Type': 'application/json',
      ...(this.enableCompression && { 'Accept-Encoding': 'gzip, deflate, br' }),
      ...options.headers,
    };
  }
  async get(key) {
    return this.request('GET', `/entries/${encodeURIComponent(key)}`);
  }
  async set(key, value, options) {
    return this.request('PUT', `/entries/${encodeURIComponent(key)}`, {
      value,
      ...options,
    });
  }
  async delete(key) {
    return this.request('DELETE', `/entries/${encodeURIComponent(key)}`);
  }
  async has(key) {
    return this.request('HEAD', `/entries/${encodeURIComponent(key)}`);
  }
  async clear(pattern) {
    const params = pattern ? `?pattern=${encodeURIComponent(pattern)}` : '';
    return this.request('DELETE', `/entries${params}`);
  }
  async getMany(keys) {
    return this.request('POST', '/entries/batch/get', { keys });
  }
  async setMany(entries) {
    return this.request('POST', '/entries/batch/set', { entries });
  }
  async deleteMany(keys) {
    return this.request('POST', '/entries/batch/delete', { keys });
  }
  async search(request) {
    return this.request('POST', '/search', request);
  }
  async searchIncremental(query, token, options) {
    return this.request('POST', '/search/incremental', {
      query,
      token,
      ...options,
    });
  }
  async getSuggestions(query, options) {
    const params = new URLSearchParams({
      q: query,
      ...(options?.maxSuggestions && { limit: options.maxSuggestions.toString() }),
      ...(options?.enableML && { ml: 'true' }),
    });
    return this.request(
      'GET',
      `/suggestions?${params}`,
      options?.context ? { context: options.context } : undefined
    );
  }
  async getStats() {
    return this.request('GET', '/stats');
  }
  async getMetrics(timeframe) {
    const params = timeframe ? `?timeframe=${timeframe}` : '';
    return this.request('GET', `/metrics${params}`);
  }
  async getHealth() {
    return this.request('GET', '/health');
  }
  async warmup(request) {
    return this.request('POST', '/warmup', request);
  }
  async prefetch(request) {
    return this.request('POST', '/prefetch', request);
  }
  async invalidate(request) {
    return this.request('POST', '/invalidate', request);
  }
  async optimize() {
    return this.request('POST', '/optimize');
  }
  createEventSource(topics = ['stats', 'metrics']) {
    if (typeof EventSource === 'undefined') {
      console.warn('EventSource not supported in this environment');
      return null;
    }
    const params = new URLSearchParams();
    topics.forEach(topic => params.append('topic', topic));
    const eventSource = new EventSource(`${this.baseUrl}/events?${params}`);
    eventSource.onerror = error => {
      console.error('Cache API EventSource error:', error);
    };
    return eventSource;
  }
  async subscribeToMetrics(callback) {
    const eventSource = this.createEventSource(['metrics']);
    if (!eventSource) {
      const interval = setInterval(async () => {
        try {
          const response = await this.getMetrics();
          if (response.success && response.data) {
            callback(response.data);
          }
        } catch (error) {
          console.error('Error polling cache metrics:', error);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
    eventSource.addEventListener('metrics', event => {
      try {
        const metrics = JSON.parse(event.data);
        callback(metrics);
      } catch (error) {
        console.error('Error parsing metrics event:', error);
      }
    });
    return () => eventSource.close();
  }
  async request(method, endpoint, body) {
    const requestId = (++this.requestId).toString();
    const startTime = performance.now();
    let lastError = null;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method,
          headers: {
            ...this.headers,
            'X-Request-ID': requestId,
            ...(this.enableMetrics && { 'X-Enable-Metrics': 'true' }),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const responseTime = performance.now() - startTime;
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new CacheApiError(
            errorData.message || `HTTP ${response.status}`,
            errorData.code || 'HTTP_ERROR',
            response.status,
            errorData
          );
        }
        if (method === 'HEAD') {
          return {
            success: true,
            data: true,
            timestamp: Date.now(),
            requestId,
            cached: response.headers.get('X-Cache-Hit') === 'true',
            performance: {
              responseTime,
              cacheHit: response.headers.get('X-Cache-Hit') === 'true',
              bytesTransferred: parseInt(response.headers.get('Content-Length') || '0'),
            },
          };
        }
        const data = await response.json();
        return {
          success: true,
          data: data.data || data,
          timestamp: Date.now(),
          requestId,
          cached: response.headers.get('X-Cache-Hit') === 'true',
          source: response.headers.get('X-Data-Source'),
          performance: {
            responseTime,
            cacheHit: response.headers.get('X-Cache-Hit') === 'true',
            bytesTransferred: parseInt(response.headers.get('Content-Length') || '0'),
          },
        };
      } catch (error) {
        lastError = error;
        if (error instanceof CacheApiError) {
          if (error.status === 400 || error.status === 401 || error.status === 403) {
            break;
          }
        }
        if (attempt < this.retries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      timestamp: Date.now(),
      requestId,
    };
  }
}
exports.CacheApiClient = CacheApiClient;
let cacheApiInstance = null;
const createCacheApiClient = options => {
  if (!cacheApiInstance) {
    cacheApiInstance = new CacheApiClient(options);
  }
  return cacheApiInstance;
};
exports.createCacheApiClient = createCacheApiClient;
const getCacheApiClient = () => {
  if (!cacheApiInstance) {
    cacheApiInstance = new CacheApiClient();
  }
  return cacheApiInstance;
};
exports.getCacheApiClient = getCacheApiClient;
exports.default = CacheApiClient;
//# sourceMappingURL=CacheApiClient.js.map
