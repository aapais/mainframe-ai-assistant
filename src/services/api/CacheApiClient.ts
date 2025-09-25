/**
 * Cache API Client
 *
 * Handles communication with backend cache endpoints:
 * - Cache operations (get, set, delete, clear)
 * - Performance metrics retrieval
 * - Cache warming and prefetching
 * - Real-time cache status updates
 * - Automatic retry and error handling
 *
 * @author Frontend Cache Team
 * @version 1.0.0
 */

import { CachePerformanceMetrics, CacheStats, IncrementalResult } from '../cache/CacheTypes';

// ========================
// Types & Interfaces
// ========================

export interface CacheApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
  requestId: string;
  cached?: boolean;
  source?: 'cache' | 'database' | 'api';
  performance?: {
    responseTime: number;
    cacheHit: boolean;
    bytesTransferred: number;
  };
}

export interface CacheApiOptions {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  enableMetrics?: boolean;
  enableCompression?: boolean;
  headers?: Record<string, string>;
}

export interface CacheWarmupRequest {
  patterns: string[];
  priority: 'low' | 'normal' | 'high';
  batchSize?: number;
  concurrency?: number;
}

export interface CachePrefetchRequest {
  keys: string[];
  contexts?: Record<string, any>[];
  predictive?: boolean;
}

export interface CacheInvalidationRequest {
  keys?: string[];
  patterns?: string[];
  tags?: string[];
  cascade?: boolean;
}

export interface SearchCacheRequest {
  query: string;
  options?: {
    limit?: number;
    offset?: number;
    includeMetadata?: boolean;
    enablePrediction?: boolean;
    cacheStrategy?: 'aggressive' | 'conservative' | 'adaptive';
  };
}

export interface SearchCacheResponse {
  results: IncrementalResult[];
  totalCount: number;
  hasMore: boolean;
  cacheMetrics: CachePerformanceMetrics;
  suggestions?: any[];
  nextToken?: string;
}

// ========================
// Error Classes
// ========================

export class CacheApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'CacheApiError';
  }
}

// ========================
// API Client Implementation
// ========================

export class CacheApiClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private enableMetrics: boolean;
  private enableCompression: boolean;
  private headers: Record<string, string>;
  private requestId: number = 0;

  constructor(options: CacheApiOptions = {}) {
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

  // ========================
  // Core Cache Operations
  // ========================

  async get<T = any>(key: string): Promise<CacheApiResponse<T>> {
    return this.request<T>('GET', `/entries/${encodeURIComponent(key)}`);
  }

  async set<T = any>(
    key: string,
    value: T,
    options?: {
      ttl?: number;
      tags?: string[];
      priority?: 'low' | 'normal' | 'high';
    }
  ): Promise<CacheApiResponse<boolean>> {
    return this.request<boolean>('PUT', `/entries/${encodeURIComponent(key)}`, {
      value,
      ...options,
    });
  }

  async delete(key: string): Promise<CacheApiResponse<boolean>> {
    return this.request<boolean>('DELETE', `/entries/${encodeURIComponent(key)}`);
  }

  async has(key: string): Promise<CacheApiResponse<boolean>> {
    return this.request<boolean>('HEAD', `/entries/${encodeURIComponent(key)}`);
  }

  async clear(pattern?: string): Promise<CacheApiResponse<number>> {
    const params = pattern ? `?pattern=${encodeURIComponent(pattern)}` : '';
    return this.request<number>('DELETE', `/entries${params}`);
  }

  // ========================
  // Batch Operations
  // ========================

  async getMany<T = any>(keys: string[]): Promise<CacheApiResponse<Array<T | null>>> {
    return this.request<Array<T | null>>('POST', '/entries/batch/get', { keys });
  }

  async setMany<T = any>(
    entries: Array<{
      key: string;
      value: T;
      ttl?: number;
      tags?: string[];
    }>
  ): Promise<CacheApiResponse<number>> {
    return this.request<number>('POST', '/entries/batch/set', { entries });
  }

  async deleteMany(keys: string[]): Promise<CacheApiResponse<number>> {
    return this.request<number>('POST', '/entries/batch/delete', { keys });
  }

  // ========================
  // Search Operations
  // ========================

  async search(request: SearchCacheRequest): Promise<CacheApiResponse<SearchCacheResponse>> {
    return this.request<SearchCacheResponse>('POST', '/search', request);
  }

  async searchIncremental(
    query: string,
    token?: string,
    options?: {
      batchSize?: number;
      enablePrediction?: boolean;
    }
  ): Promise<CacheApiResponse<SearchCacheResponse>> {
    return this.request<SearchCacheResponse>('POST', '/search/incremental', {
      query,
      token,
      ...options,
    });
  }

  async getSuggestions(
    query: string,
    options?: {
      maxSuggestions?: number;
      enableML?: boolean;
      context?: Record<string, any>;
    }
  ): Promise<CacheApiResponse<any[]>> {
    const params = new URLSearchParams({
      q: query,
      ...(options?.maxSuggestions && { limit: options.maxSuggestions.toString() }),
      ...(options?.enableML && { ml: 'true' }),
    });

    return this.request<any[]>(
      'GET',
      `/suggestions?${params}`,
      options?.context ? { context: options.context } : undefined
    );
  }

  // ========================
  // Performance & Monitoring
  // ========================

  async getStats(): Promise<CacheApiResponse<CacheStats>> {
    return this.request<CacheStats>('GET', '/stats');
  }

  async getMetrics(timeframe?: string): Promise<CacheApiResponse<CachePerformanceMetrics>> {
    const params = timeframe ? `?timeframe=${timeframe}` : '';
    return this.request<CachePerformanceMetrics>('GET', `/metrics${params}`);
  }

  async getHealth(): Promise<
    CacheApiResponse<{
      status: 'healthy' | 'degraded' | 'unhealthy';
      checks: Record<string, boolean>;
      uptime: number;
      version: string;
    }>
  > {
    return this.request('GET', '/health');
  }

  // ========================
  // Cache Management
  // ========================

  async warmup(request: CacheWarmupRequest): Promise<
    CacheApiResponse<{
      jobId: string;
      estimatedDuration: number;
      itemsToWarm: number;
    }>
  > {
    return this.request('POST', '/warmup', request);
  }

  async prefetch(request: CachePrefetchRequest): Promise<
    CacheApiResponse<{
      jobId: string;
      prefetchedCount: number;
      failedCount: number;
    }>
  > {
    return this.request('POST', '/prefetch', request);
  }

  async invalidate(request: CacheInvalidationRequest): Promise<
    CacheApiResponse<{
      invalidatedCount: number;
      cascadeCount?: number;
    }>
  > {
    return this.request('POST', '/invalidate', request);
  }

  async optimize(): Promise<
    CacheApiResponse<{
      compactedEntries: number;
      reclaimedMemory: number;
      duration: number;
    }>
  > {
    return this.request('POST', '/optimize');
  }

  // ========================
  // Real-time Updates
  // ========================

  createEventSource(topics: string[] = ['stats', 'metrics']): EventSource | null {
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

  async subscribeToMetrics(
    callback: (metrics: CachePerformanceMetrics) => void
  ): Promise<() => void> {
    const eventSource = this.createEventSource(['metrics']);

    if (!eventSource) {
      // Fallback to polling
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

  // ========================
  // Private Methods
  // ========================

  private async request<T = any>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<CacheApiResponse<T>> {
    const requestId = (++this.requestId).toString();
    const startTime = performance.now();

    let lastError: Error | null = null;

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

        // Handle HEAD requests (has operation)
        if (method === 'HEAD') {
          return {
            success: true,
            data: true as T,
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
          source: response.headers.get('X-Data-Source') as any,
          performance: {
            responseTime,
            cacheHit: response.headers.get('X-Cache-Hit') === 'true',
            bytesTransferred: parseInt(response.headers.get('Content-Length') || '0'),
          },
        };
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (error instanceof CacheApiError) {
          if (error.status === 400 || error.status === 401 || error.status === 403) {
            break;
          }
        }

        // Wait before retry
        if (attempt < this.retries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // All retries failed
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      timestamp: Date.now(),
      requestId,
    };
  }
}

// ========================
// Singleton Instance
// ========================

let cacheApiInstance: CacheApiClient | null = null;

export const createCacheApiClient = (options?: CacheApiOptions): CacheApiClient => {
  if (!cacheApiInstance) {
    cacheApiInstance = new CacheApiClient(options);
  }
  return cacheApiInstance;
};

export const getCacheApiClient = (): CacheApiClient => {
  if (!cacheApiInstance) {
    cacheApiInstance = new CacheApiClient();
  }
  return cacheApiInstance;
};

export default CacheApiClient;
