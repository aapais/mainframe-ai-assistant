import { Request, Response, NextFunction } from 'express';
import { CacheOrchestrator } from '../services/cache/CacheOrchestrator';

export interface CacheMiddlewareOptions {
  ttl?: number;
  tags?: string[];
  varyBy?: string[];
  condition?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
  skipMethods?: string[];
  etag?: boolean;
  lastModified?: boolean;
  maxAge?: number;
  public?: boolean;
  staleWhileRevalidate?: number;
}

export class CacheMiddleware {
  private cacheOrchestrator: CacheOrchestrator;
  private defaultOptions: CacheMiddlewareOptions;

  constructor(cacheOrchestrator: CacheOrchestrator, defaultOptions: CacheMiddlewareOptions = {}) {
    this.cacheOrchestrator = cacheOrchestrator;
    this.defaultOptions = {
      ttl: 300, // 5 minutes
      skipMethods: ['POST', 'PUT', 'DELETE', 'PATCH'],
      etag: true,
      maxAge: 300,
      public: true,
      ...defaultOptions,
    };
  }

  // Main caching middleware
  cache(options: CacheMiddlewareOptions = {}) {
    const opts = { ...this.defaultOptions, ...options };

    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip caching for certain methods
      if (opts.skipMethods?.includes(req.method)) {
        return next();
      }

      // Check condition if provided
      if (opts.condition && !opts.condition(req)) {
        return next();
      }

      const cacheKey = this.generateCacheKey(req, opts.keyGenerator);

      try {
        // Try to get from cache
        const cached = await this.cacheOrchestrator.get(cacheKey);

        if (cached) {
          this.setCacheHeaders(res, opts);
          return this.sendCachedResponse(res, cached);
        }

        // Intercept response to cache it
        this.interceptResponse(req, res, next, cacheKey, opts);
      } catch (error) {
        console.error('Cache middleware error:', error);
        next();
      }
    };
  }

  // API response caching
  apiCache(options: CacheMiddlewareOptions = {}) {
    const opts = {
      ttl: 600, // 10 minutes for API responses
      public: false,
      ...this.defaultOptions,
      ...options,
    };

    return this.cache(opts);
  }

  // Search result caching
  searchCache(options: CacheMiddlewareOptions = {}) {
    const opts = {
      ttl: 1800, // 30 minutes for search results
      varyBy: ['query', 'filters', 'sort'],
      tags: ['search'],
      ...this.defaultOptions,
      ...options,
    };

    return this.cache(opts);
  }

  // Database query caching
  queryCache(options: CacheMiddlewareOptions = {}) {
    const opts = {
      ttl: 3600, // 1 hour for database queries
      tags: ['database'],
      staleWhileRevalidate: 300,
      ...this.defaultOptions,
      ...options,
    };

    return this.cache(opts);
  }

  // Static asset caching
  staticCache(options: CacheMiddlewareOptions = {}) {
    const opts = {
      ttl: 86400, // 24 hours for static assets
      maxAge: 86400,
      public: true,
      etag: true,
      ...this.defaultOptions,
      ...options,
    };

    return this.cache(opts);
  }

  // Cache invalidation middleware
  invalidate(tags?: string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (tags) {
          for (const tag of tags) {
            await this.cacheOrchestrator.invalidateByTag(tag);
          }
        } else {
          // Invalidate based on request path/method
          const pathTags = this.extractTagsFromRequest(req);
          for (const tag of pathTags) {
            await this.cacheOrchestrator.invalidateByTag(tag);
          }
        }
      } catch (error) {
        console.error('Cache invalidation error:', error);
      }
      next();
    };
  }

  // Response compression for caching
  compress(threshold: number = 1024) {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;

      res.send = function (body: any) {
        if (typeof body === 'string' && body.length > threshold) {
          res.set('Content-Encoding', 'gzip');
          // In production, use actual compression
        }
        return originalSend.call(this, body);
      };

      next();
    };
  }

  // Browser cache headers
  browserCache(
    options: {
      maxAge?: number;
      public?: boolean;
      mustRevalidate?: boolean;
      noCache?: boolean;
      noStore?: boolean;
    } = {}
  ) {
    return (req: Request, res: Response, next: NextFunction) => {
      const {
        maxAge = 3600,
        public: isPublic = true,
        mustRevalidate = false,
        noCache = false,
        noStore = false,
      } = options;

      if (noStore) {
        res.set('Cache-Control', 'no-store');
      } else if (noCache) {
        res.set('Cache-Control', 'no-cache');
      } else {
        const directives = [];

        if (isPublic) {
          directives.push('public');
        } else {
          directives.push('private');
        }

        directives.push(`max-age=${maxAge}`);

        if (mustRevalidate) {
          directives.push('must-revalidate');
        }

        res.set('Cache-Control', directives.join(', '));
      }

      next();
    };
  }

  private generateCacheKey(req: Request, keyGenerator?: (req: Request) => string): string {
    if (keyGenerator) {
      return keyGenerator(req);
    }

    const baseKey = `${req.method}:${req.path}`;
    const queryParams = Object.keys(req.query)
      .sort()
      .map(key => `${key}=${req.query[key]}`)
      .join('&');

    return queryParams ? `${baseKey}?${queryParams}` : baseKey;
  }

  private interceptResponse(
    req: Request,
    res: Response,
    next: NextFunction,
    cacheKey: string,
    options: CacheMiddlewareOptions
  ): void {
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = (body: any) => {
      this.cacheResponse(cacheKey, { body, statusCode: res.statusCode }, options);
      return originalSend.call(res, body);
    };

    res.json = (body: any) => {
      this.cacheResponse(cacheKey, { body, statusCode: res.statusCode }, options);
      return originalJson.call(res, body);
    };

    next();
  }

  private async cacheResponse(
    cacheKey: string,
    response: { body: any; statusCode: number },
    options: CacheMiddlewareOptions
  ): Promise<void> {
    try {
      // Only cache successful responses
      if (response.statusCode >= 200 && response.statusCode < 300) {
        await this.cacheOrchestrator.set(cacheKey, response, options.ttl, options.tags);
      }
    } catch (error) {
      console.error('Response caching error:', error);
    }
  }

  private sendCachedResponse(res: Response, cached: any): Response {
    if (cached.statusCode) {
      res.status(cached.statusCode);
    }

    if (cached.body) {
      return res.send(cached.body);
    }

    return res.send(cached);
  }

  private setCacheHeaders(res: Response, options: CacheMiddlewareOptions): void {
    if (options.etag) {
      // Generate ETag based on response (simplified)
      const etag = `"${Date.now()}"`; // In production, use proper ETag generation
      res.set('ETag', etag);
    }

    if (options.lastModified) {
      res.set('Last-Modified', new Date().toUTCString());
    }

    if (options.maxAge) {
      const cacheControl = [];

      if (options.public) {
        cacheControl.push('public');
      } else {
        cacheControl.push('private');
      }

      cacheControl.push(`max-age=${options.maxAge}`);

      if (options.staleWhileRevalidate) {
        cacheControl.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
      }

      res.set('Cache-Control', cacheControl.join(', '));
    }

    // Set cache hit header
    res.set('X-Cache', 'HIT');
  }

  private extractTagsFromRequest(req: Request): string[] {
    const tags: string[] = [];

    // Extract tags from path
    const pathSegments = req.path.split('/').filter(Boolean);
    if (pathSegments.length > 0) {
      tags.push(pathSegments[0]); // First path segment as tag
    }

    // Add method-based tags
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      tags.push('write-operation');
    }

    return tags;
  }
}
