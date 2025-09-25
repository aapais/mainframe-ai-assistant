/**
 * Express Cache Middleware - HTTP Layer Caching for Search API
 * Provides intelligent HTTP caching with ETag support and cache headers
 */

import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../services/CacheService';
import { createHash } from 'crypto';

export interface CacheMiddlewareConfig {
  enabled: boolean;
  defaultTTL: number;
  maxAge: number;
  staleWhileRevalidate: number;
  varyHeaders: string[];
  skipCacheFor: {
    methods: string[];
    paths: string[];
    queryParams: string[];
    userAgents: string[];
  };
  compression: {
    enabled: boolean;
    threshold: number;
    algorithm: 'gzip' | 'br';
  };
  conditionalRequests: {
    etag: boolean;
    lastModified: boolean;
    ifNoneMatch: boolean;
  };
  monitoring: {
    enabled: boolean;
    logHits: boolean;
    logMisses: boolean;
    trackPerformance: boolean;
  };
}

export interface CacheEntry {
  data: any;
  headers: Record<string, string>;
  statusCode: number;
  etag: string;
  lastModified: Date;
  compressedData?: Buffer;
  originalSize: number;
  compressedSize?: number;
}

export interface CacheMetrics {
  requests: {
    total: number;
    hits: number;
    misses: number;
    stale: number;
    bypassed: number;
  };
  performance: {
    avgHitTime: number;
    avgMissTime: number;
    avgCompressionRatio: number;
    bandwidthSaved: number;
  };
  storage: {
    entries: number;
    totalSize: number;
    compressionRatio: number;
  };
}

/**
 * High-performance Express cache middleware with intelligent caching strategies
 */
export class CacheMiddleware {
  private cache: CacheService;
  private config: CacheMiddlewareConfig;
  private metrics: CacheMetrics;

  constructor(cache: CacheService, config?: Partial<CacheMiddlewareConfig>) {
    this.cache = cache;
    this.config = this.mergeConfig(config);
    this.initializeMetrics();
  }

  /**
   * Main cache middleware function
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      try {
        // Skip caching if disabled or for certain conditions
        if (!this.config.enabled || this.shouldSkipCache(req)) {
          this.logBypass(req);
          this.metrics.requests.bypassed++;
          return next();
        }

        const cacheKey = this.generateCacheKey(req);
        const cachedEntry = await this.getCachedResponse(cacheKey);

        // Handle conditional requests (304 Not Modified)
        if (cachedEntry && this.handleConditionalRequest(req, res, cachedEntry)) {
          this.recordHit(startTime);
          return;
        }

        // Serve from cache if available and fresh
        if (cachedEntry && this.isEntryFresh(cachedEntry)) {
          await this.serveCachedResponse(res, cachedEntry);
          this.recordHit(startTime);
          return;
        }

        // Handle stale-while-revalidate
        if (cachedEntry && this.config.staleWhileRevalidate > 0) {
          const isStale = this.isEntryStale(cachedEntry);

          if (isStale) {
            // Serve stale content immediately
            await this.serveCachedResponse(res, cachedEntry);
            this.recordStale();

            // Trigger background revalidation
            this.revalidateInBackground(req, cacheKey);
            return;
          }
        }

        // Intercept response to cache it
        this.interceptResponse(req, res, cacheKey, startTime, next);
      } catch (error) {
        console.error('Cache middleware error:', error);
        next();
      }
    };
  }

  /**
   * Cache invalidation middleware for POST/PUT/DELETE operations
   */
  invalidationMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Continue with the request
        const originalSend = res.send;

        res.send = function (data) {
          // Invalidate related cache entries after successful mutations
          if (res.statusCode >= 200 && res.statusCode < 300) {
            setImmediate(async () => {
              try {
                await this.invalidateRelatedEntries(req);
              } catch (error) {
                console.error('Cache invalidation error:', error);
              }
            });
          }

          return originalSend.call(this, data);
        }.bind(this);

        next();
      } catch (error) {
        console.error('Cache invalidation middleware error:', error);
        next();
      }
    };
  }

  /**
   * Get cache statistics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all cached responses
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
    this.initializeMetrics();
  }

  /**
   * Manually invalidate cache entries by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    return await this.cache.deletePattern(pattern);
  }

  /**
   * Pre-warm cache with common requests
   */
  async warmCache(
    requests: Array<{ path: string; query?: Record<string, string> }>
  ): Promise<void> {
    console.log(`🔥 Warming HTTP cache with ${requests.length} requests...`);

    for (const request of requests) {
      try {
        const cacheKey = this.generateCacheKeyFromRequest(request);
        // Mark as warmed (implementation depends on your cache warming strategy)
        await this.cache.set(`${cacheKey}:warmed`, true, 300000); // 5 minutes
      } catch (error) {
        console.warn(`Failed to warm cache for ${request.path}:`, error);
      }
    }
  }

  // =========================
  // Private Implementation
  // =========================

  private mergeConfig(config?: Partial<CacheMiddlewareConfig>): CacheMiddlewareConfig {
    return {
      enabled: true,
      defaultTTL: 300000, // 5 minutes
      maxAge: 600, // 10 minutes in seconds for Cache-Control
      staleWhileRevalidate: 3600, // 1 hour in seconds
      varyHeaders: ['Accept', 'Accept-Encoding', 'User-Agent'],
      skipCacheFor: {
        methods: ['POST', 'PUT', 'DELETE', 'PATCH'],
        paths: ['/api/admin', '/api/auth'],
        queryParams: ['no-cache', 'force-refresh'],
        userAgents: ['Googlebot', 'Bingbot'],
      },
      compression: {
        enabled: true,
        threshold: 1024, // 1KB
        algorithm: 'gzip',
      },
      conditionalRequests: {
        etag: true,
        lastModified: true,
        ifNoneMatch: true,
      },
      monitoring: {
        enabled: true,
        logHits: false, // Set to true for debugging
        logMisses: false,
        trackPerformance: true,
      },
      ...config,
    };
  }

  private initializeMetrics(): void {
    this.metrics = {
      requests: {
        total: 0,
        hits: 0,
        misses: 0,
        stale: 0,
        bypassed: 0,
      },
      performance: {
        avgHitTime: 0,
        avgMissTime: 0,
        avgCompressionRatio: 0,
        bandwidthSaved: 0,
      },
      storage: {
        entries: 0,
        totalSize: 0,
        compressionRatio: 0,
      },
    };
  }

  private shouldSkipCache(req: Request): boolean {
    // Check method
    if (this.config.skipCacheFor.methods.includes(req.method)) {
      return true;
    }

    // Check path
    if (this.config.skipCacheFor.paths.some(path => req.path.startsWith(path))) {
      return true;
    }

    // Check query parameters
    if (this.config.skipCacheFor.queryParams.some(param => req.query[param] !== undefined)) {
      return true;
    }

    // Check user agent
    const userAgent = req.get('User-Agent') || '';
    if (this.config.skipCacheFor.userAgents.some(ua => userAgent.includes(ua))) {
      return true;
    }

    // Check cache control headers
    const cacheControl = req.get('Cache-Control') || '';
    if (cacheControl.includes('no-cache') || cacheControl.includes('no-store')) {
      return true;
    }

    return false;
  }

  private generateCacheKey(req: Request): string {
    const keyParts = [
      req.method,
      req.path,
      JSON.stringify(req.query),
      req.get('Accept') || '',
      req.get('Accept-Encoding') || '',
    ];

    // Add user context if available
    if (req.user?.id) {
      keyParts.push(`user:${req.user.id}`);
    }

    const keyString = keyParts.join('|');
    return `http_cache:${createHash('md5').update(keyString).digest('hex')}`;
  }

  private generateCacheKeyFromRequest(request: {
    path: string;
    query?: Record<string, string>;
  }): string {
    const keyParts = [
      'GET',
      request.path,
      JSON.stringify(request.query || {}),
      'application/json',
      'gzip',
    ];

    const keyString = keyParts.join('|');
    return `http_cache:${createHash('md5').update(keyString).digest('hex')}`;
  }

  private async getCachedResponse(cacheKey: string): Promise<CacheEntry | null> {
    try {
      return await this.cache.get<CacheEntry>(cacheKey);
    } catch (error) {
      console.warn('Failed to get cached response:', error);
      return null;
    }
  }

  private generateETag(data: any): string {
    const hash = createHash('md5').update(JSON.stringify(data)).digest('hex');
    return `"${hash}"`; // ETags should be quoted
  }

  private handleConditionalRequest(req: Request, res: Response, entry: CacheEntry): boolean {
    if (!this.config.conditionalRequests.ifNoneMatch) {
      return false;
    }

    const ifNoneMatch = req.get('If-None-Match');

    if (ifNoneMatch && ifNoneMatch === entry.etag) {
      // Content hasn't changed
      res.status(304);

      // Set cache headers for 304 response
      this.setCacheHeaders(res, entry);
      res.end();

      return true; // Request was handled
    }

    return false; // Continue processing
  }

  private isEntryFresh(entry: CacheEntry): boolean {
    const age = Date.now() - entry.lastModified.getTime();
    return age < this.config.defaultTTL;
  }

  private isEntryStale(entry: CacheEntry): boolean {
    const age = Date.now() - entry.lastModified.getTime();
    const staleThreshold = this.config.defaultTTL + this.config.staleWhileRevalidate * 1000;
    return age > this.config.defaultTTL && age < staleThreshold;
  }

  private async serveCachedResponse(res: Response, entry: CacheEntry): Promise<void> {
    // Set status code
    res.status(entry.statusCode);

    // Set cached headers
    Object.entries(entry.headers).forEach(([key, value]) => {
      res.set(key, value);
    });

    // Set cache control headers
    this.setCacheHeaders(res, entry);

    // Set ETag
    if (this.config.conditionalRequests.etag) {
      res.set('ETag', entry.etag);
    }

    // Set Last-Modified
    if (this.config.conditionalRequests.lastModified) {
      res.set('Last-Modified', entry.lastModified.toUTCString());
    }

    // Serve compressed data if available
    if (entry.compressedData && this.supportsCompression(res)) {
      res.set('Content-Encoding', this.config.compression.algorithm);
      res.set('Content-Length', entry.compressedData.length.toString());
      res.end(entry.compressedData);
    } else {
      res.json(entry.data);
    }
  }

  private setCacheHeaders(res: Response, entry: CacheEntry): void {
    const age = Math.floor((Date.now() - entry.lastModified.getTime()) / 1000);
    const maxAge = Math.max(0, this.config.maxAge - age);

    res.set(
      'Cache-Control',
      [
        `max-age=${maxAge}`,
        `stale-while-revalidate=${this.config.staleWhileRevalidate}`,
        'public',
      ].join(', ')
    );

    res.set('Age', age.toString());
    res.set('X-Cache', 'HIT');

    // Set Vary header
    if (this.config.varyHeaders.length > 0) {
      res.set('Vary', this.config.varyHeaders.join(', '));
    }
  }

  private supportsCompression(res: Response): boolean {
    const req = res.req;
    const acceptEncoding = req.get('Accept-Encoding') || '';

    return acceptEncoding.includes(this.config.compression.algorithm);
  }

  private interceptResponse(
    req: Request,
    res: Response,
    cacheKey: string,
    startTime: number,
    next: NextFunction
  ): void {
    const originalSend = res.send;
    const originalJson = res.json;

    let responseData: any;
    let responseSent = false;

    // Override json method
    res.json = function (data: any) {
      if (!responseSent) {
        responseData = data;
        responseSent = true;

        // Cache the response asynchronously
        setImmediate(async () => {
          try {
            await this.cacheResponse(req, res, cacheKey, data);
          } catch (error) {
            console.error('Failed to cache response:', error);
          }
        });
      }

      return originalJson.call(this, data);
    }.bind(this);

    // Override send method as fallback
    res.send = function (data: any) {
      if (!responseSent) {
        responseData = data;
        responseSent = true;

        // Try to parse JSON data
        let parsedData = data;
        try {
          if (typeof data === 'string') {
            parsedData = JSON.parse(data);
          }
        } catch {
          // Not JSON, cache as-is
        }

        setImmediate(async () => {
          try {
            await this.cacheResponse(req, res, cacheKey, parsedData);
          } catch (error) {
            console.error('Failed to cache response:', error);
          }
        });
      }

      return originalSend.call(this, data);
    }.bind(this);

    // Set cache miss header
    res.set('X-Cache', 'MISS');

    // Record miss
    this.recordMiss(startTime);

    next();
  }

  private async cacheResponse(
    req: Request,
    res: Response,
    cacheKey: string,
    data: any
  ): Promise<void> {
    try {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const etag = this.generateETag(data);
        const lastModified = new Date();

        // Prepare cache entry
        const entry: CacheEntry = {
          data,
          headers: this.getRelevantHeaders(res),
          statusCode: res.statusCode,
          etag,
          lastModified,
          originalSize: JSON.stringify(data).length,
        };

        // Compress data if enabled and above threshold
        if (
          this.config.compression.enabled &&
          entry.originalSize > this.config.compression.threshold
        ) {
          entry.compressedData = await this.compressData(data);
          entry.compressedSize = entry.compressedData.length;
        }

        // Store in cache
        await this.cache.set(cacheKey, entry, this.config.defaultTTL);

        // Update metrics
        this.updateStorageMetrics(entry);

        if (this.config.monitoring.logMisses) {
          console.log(
            `📦 Cached response for ${req.method} ${req.path} (${entry.originalSize} bytes)`
          );
        }
      }
    } catch (error) {
      console.error('Failed to cache response:', error);
    }
  }

  private getRelevantHeaders(res: Response): Record<string, string> {
    const relevantHeaders: Record<string, string> = {};

    const headersToCache = [
      'Content-Type',
      'Content-Language',
      'X-API-Version',
      'X-Rate-Limit-Remaining',
    ];

    headersToCache.forEach(headerName => {
      const value = res.get(headerName);
      if (value) {
        relevantHeaders[headerName] = value;
      }
    });

    return relevantHeaders;
  }

  private async compressData(data: any): Promise<Buffer> {
    const { gzip, brotliCompress } = await import('zlib');
    const { promisify } = await import('util');

    const dataString = JSON.stringify(data);
    const buffer = Buffer.from(dataString, 'utf8');

    if (this.config.compression.algorithm === 'br') {
      const compress = promisify(brotliCompress);
      return await compress(buffer);
    } else {
      const compress = promisify(gzip);
      return await compress(buffer);
    }
  }

  private async revalidateInBackground(req: Request, cacheKey: string): Promise<void> {
    // Create a new request to revalidate the cache entry
    // This is a simplified implementation - in production you'd want to
    // use a proper job queue

    setTimeout(async () => {
      try {
        console.log(`🔄 Background revalidation for ${req.path}`);
        // The actual revalidation would depend on your application architecture
        // You might trigger a new request or directly call the handler
      } catch (error) {
        console.error('Background revalidation failed:', error);
      }
    }, 100); // Small delay to avoid blocking
  }

  private async invalidateRelatedEntries(req: Request): Promise<void> {
    const patterns: string[] = [];

    // Invalidate by path
    patterns.push(`*${req.path}*`);

    // Invalidate by resource type
    if (req.path.includes('/search')) {
      patterns.push('*search*');
    }

    if (req.path.includes('/kb')) {
      patterns.push('*kb*');
    }

    // Execute invalidation
    for (const pattern of patterns) {
      try {
        const invalidated = await this.cache.deletePattern(pattern);
        if (invalidated > 0) {
          console.log(`🗑️ Invalidated ${invalidated} cache entries matching ${pattern}`);
        }
      } catch (error) {
        console.error(`Failed to invalidate pattern ${pattern}:`, error);
      }
    }
  }

  private recordHit(startTime: number): void {
    const duration = Date.now() - startTime;

    this.metrics.requests.total++;
    this.metrics.requests.hits++;

    // Update average hit time
    const hitCount = this.metrics.requests.hits;
    this.metrics.performance.avgHitTime =
      (this.metrics.performance.avgHitTime * (hitCount - 1) + duration) / hitCount;

    if (this.config.monitoring.logHits) {
      console.log(`⚡ Cache HIT in ${duration}ms`);
    }
  }

  private recordMiss(startTime: number): void {
    const duration = Date.now() - startTime;

    this.metrics.requests.total++;
    this.metrics.requests.misses++;

    // Update average miss time
    const missCount = this.metrics.requests.misses;
    this.metrics.performance.avgMissTime =
      (this.metrics.performance.avgMissTime * (missCount - 1) + duration) / missCount;

    if (this.config.monitoring.logMisses) {
      console.log(`❄️ Cache MISS in ${duration}ms`);
    }
  }

  private recordStale(): void {
    this.metrics.requests.total++;
    this.metrics.requests.stale++;
  }

  private logBypass(req: Request): void {
    if (this.config.monitoring.enabled) {
      console.log(`⏭️ Cache bypassed for ${req.method} ${req.path}`);
    }
  }

  private updateStorageMetrics(entry: CacheEntry): void {
    this.metrics.storage.entries++;
    this.metrics.storage.totalSize += entry.originalSize;

    if (entry.compressedSize) {
      const compressionRatio = entry.compressedSize / entry.originalSize;
      this.metrics.performance.avgCompressionRatio =
        (this.metrics.performance.avgCompressionRatio * (this.metrics.storage.entries - 1) +
          compressionRatio) /
        this.metrics.storage.entries;

      this.metrics.performance.bandwidthSaved += entry.originalSize - entry.compressedSize;
    }
  }
}

/**
 * Factory function to create cache middleware
 */
export function createCacheMiddleware(
  cache: CacheService,
  config?: Partial<CacheMiddlewareConfig>
): CacheMiddleware {
  return new CacheMiddleware(cache, config);
}

/**
 * Express middleware factory for easy integration
 */
export function cacheMiddleware(cache: CacheService, config?: Partial<CacheMiddlewareConfig>) {
  const middleware = new CacheMiddleware(cache, config);
  return middleware.middleware();
}

/**
 * Express invalidation middleware factory
 */
export function invalidationMiddleware(
  cache: CacheService,
  config?: Partial<CacheMiddlewareConfig>
) {
  const middleware = new CacheMiddleware(cache, config);
  return middleware.invalidationMiddleware();
}

export default CacheMiddleware;
