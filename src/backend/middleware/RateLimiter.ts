/**
 * Rate Limiter Middleware - Advanced Request Throttling
 * High-performance rate limiting with multiple algorithms and user-specific limits
 */

import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, rateLimitInfo: RateLimitInfo) => void;
  store?: RateLimitStore;
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
}

export interface RateLimitStore {
  increment(key: string): Promise<RateLimitInfo>;
  decrement(key: string): Promise<void>;
  resetKey(key: string): Promise<void>;
  getStats(): Promise<{ totalKeys: number; memoryUsage: number }>;
}

/**
 * Memory-based Rate Limit Store with sliding window algorithm
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<
    string,
    {
      count: number;
      resetTime: number;
      requests: number[];
    }
  >();

  private config: RateLimitConfig;
  private cleanupInterval?: ReturnType<typeof setTimeout>;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.startCleanup();
  }

  async increment(key: string): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
        requests: [],
      };
      this.store.set(key, entry);
    }

    // Clean old requests (sliding window)
    entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);

    // Add current request
    entry.requests.push(now);
    entry.count = entry.requests.length;

    // Update reset time if needed
    if (now >= entry.resetTime) {
      entry.resetTime = now + this.config.windowMs;
    }

    return {
      limit: this.config.max,
      current: entry.count,
      remaining: Math.max(0, this.config.max - entry.count),
      resetTime: new Date(entry.resetTime),
    };
  }

  async decrement(key: string): Promise<void> {
    const entry = this.store.get(key);
    if (entry && entry.requests.length > 0) {
      entry.requests.pop();
      entry.count = entry.requests.length;
    }
  }

  async resetKey(key: string): Promise<void> {
    this.store.delete(key);
  }

  async getStats(): Promise<{ totalKeys: number; memoryUsage: number }> {
    return {
      totalKeys: this.store.size,
      memoryUsage: this.store.size * 1024, // Rough estimate
    };
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(
      () => {
        const now = Date.now();
        const keysToDelete: string[] = [];

        this.store.forEach((entry, key) => {
          if (entry.requests.length === 0 || entry.resetTime < now) {
            const windowStart = now - this.config.windowMs;
            entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);

            if (entry.requests.length === 0) {
              keysToDelete.push(key);
            } else {
              entry.count = entry.requests.length;
            }
          }
        });

        keysToDelete.forEach(key => this.store.delete(key));
      },
      Math.min(this.config.windowMs / 4, 60000)
    ); // Cleanup every quarter window or 1 minute
  }

  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

/**
 * Redis-based Rate Limit Store for distributed systems
 */
export class RedisRateLimitStore implements RateLimitStore {
  private redis: any; // Redis client
  private config: RateLimitConfig;

  constructor(redis: any, config: RateLimitConfig) {
    this.redis = redis;
    this.config = config;
  }

  async increment(key: string): Promise<RateLimitInfo> {
    const now = Date.now();
    const window = Math.floor(now / this.config.windowMs);
    const redisKey = `ratelimit:${key}:${window}`;

    const pipeline = this.redis.pipeline();
    pipeline.incr(redisKey);
    pipeline.expire(redisKey, Math.ceil(this.config.windowMs / 1000));

    const results = await pipeline.exec();
    const current = results[0][1];

    return {
      limit: this.config.max,
      current,
      remaining: Math.max(0, this.config.max - current),
      resetTime: new Date((window + 1) * this.config.windowMs),
    };
  }

  async decrement(key: string): Promise<void> {
    const now = Date.now();
    const window = Math.floor(now / this.config.windowMs);
    const redisKey = `ratelimit:${key}:${window}`;

    await this.redis.decr(redisKey);
  }

  async resetKey(key: string): Promise<void> {
    const pattern = `ratelimit:${key}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async getStats(): Promise<{ totalKeys: number; memoryUsage: number }> {
    const keys = await this.redis.keys('ratelimit:*');
    const memoryInfo = await this.redis.memory('usage', keys[0] || 'dummy');

    return {
      totalKeys: keys.length,
      memoryUsage: memoryInfo || 0,
    };
  }
}

/**
 * Advanced Rate Limiter with multiple algorithms and adaptive limits
 */
export class RateLimiter extends EventEmitter {
  private store: RateLimitStore;
  private config: RateLimitConfig;

  // User-specific limits
  private userLimits = new Map<string, RateLimitConfig>();

  // Adaptive limits based on system load
  private systemLoadFactor = 1.0;
  private lastLoadCheck = 0;

  constructor(config: RateLimitConfig) {
    super();
    this.config = config;
    this.store = config.store || new MemoryRateLimitStore(config);
  }

  /**
   * Check rate limit and throw error if exceeded
   */
  async checkLimit(req: Request, customConfig?: Partial<RateLimitConfig>): Promise<void> {
    const effectiveConfig = { ...this.config, ...customConfig };
    const key = this.generateKey(req, effectiveConfig);

    // Get user-specific limits if available
    const userId = req.headers['x-user-id'] as string;
    const userConfig = userId ? this.userLimits.get(userId) : null;
    const finalConfig = userConfig ? { ...effectiveConfig, ...userConfig } : effectiveConfig;

    // Apply adaptive limits based on system load
    const adaptiveLimit = Math.floor(finalConfig.max * this.getAdaptiveFactor());

    const rateLimitInfo = await this.store.increment(key);

    // Emit metrics
    this.emit('request-checked', {
      key,
      userId,
      current: rateLimitInfo.current,
      limit: adaptiveLimit,
      remaining: rateLimitInfo.remaining,
    });

    if (rateLimitInfo.current > adaptiveLimit) {
      // Rate limit exceeded
      this.emit('limit-exceeded', {
        key,
        userId,
        current: rateLimitInfo.current,
        limit: adaptiveLimit,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      if (finalConfig.onLimitReached) {
        finalConfig.onLimitReached(req, rateLimitInfo);
      }

      const error = new Error('Too many requests');
      (error as any).name = 'RateLimitError';
      (error as any).retryAfter = Math.ceil(
        (rateLimitInfo.resetTime.getTime() - Date.now()) / 1000
      );
      (error as any).rateLimitInfo = rateLimitInfo;

      throw error;
    }

    // Add rate limit headers to request for response
    (req as any).rateLimitInfo = {
      ...rateLimitInfo,
      limit: adaptiveLimit,
      remaining: adaptiveLimit - rateLimitInfo.current,
    };
  }

  /**
   * Express middleware factory
   */
  middleware(customConfig?: Partial<RateLimitConfig>) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        await this.checkLimit(req, customConfig);

        // Add headers to response
        const info = (req as any).rateLimitInfo;
        if (info) {
          res.set({
            'X-RateLimit-Limit': info.limit.toString(),
            'X-RateLimit-Remaining': info.remaining.toString(),
            'X-RateLimit-Reset': info.resetTime.getTime().toString(),
          });
        }

        next();
      } catch (error: any) {
        if (error.name === 'RateLimitError') {
          res.status(429).json({
            error: 'Too Many Requests',
            message: error.message,
            retryAfter: error.retryAfter,
          });
        } else {
          next(error);
        }
      }
    };
  }

  /**
   * Set user-specific rate limits
   */
  setUserLimit(userId: string, config: Partial<RateLimitConfig>): void {
    this.userLimits.set(userId, { ...this.config, ...config });
    this.emit('user-limit-set', { userId, config });
  }

  /**
   * Remove user-specific limits
   */
  removeUserLimit(userId: string): void {
    this.userLimits.delete(userId);
    this.emit('user-limit-removed', { userId });
  }

  /**
   * Reset rate limits for a specific key
   */
  async resetLimit(key: string): Promise<void> {
    await this.store.resetKey(key);
    this.emit('limit-reset', { key });
  }

  /**
   * Reset rate limits for a user
   */
  async resetUserLimit(userId: string): Promise<void> {
    await this.resetLimit(`user:${userId}`);
    this.emit('user-limit-reset', { userId });
  }

  /**
   * Get current rate limit status for a key
   */
  async getStatus(req: Request): Promise<RateLimitInfo | null> {
    const key = this.generateKey(req, this.config);
    try {
      return await this.store.increment(key);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get rate limiter statistics
   */
  async getStats(): Promise<{
    storeStats: { totalKeys: number; memoryUsage: number };
    userLimits: number;
    systemLoadFactor: number;
  }> {
    const storeStats = await this.store.getStats();

    return {
      storeStats,
      userLimits: this.userLimits.size,
      systemLoadFactor: this.systemLoadFactor,
    };
  }

  /**
   * Update system load factor for adaptive limits
   */
  setSystemLoadFactor(factor: number): void {
    this.systemLoadFactor = Math.max(0.1, Math.min(2.0, factor));
    this.emit('load-factor-updated', { factor: this.systemLoadFactor });
  }

  /**
   * Close rate limiter and cleanup resources
   */
  async close(): Promise<void> {
    if (this.store instanceof MemoryRateLimitStore) {
      this.store.close();
    }
    this.removeAllListeners();
  }

  // Private methods

  private generateKey(req: Request, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return config.keyGenerator(req);
    }

    // Default key generation strategy
    const userId = req.headers['x-user-id'];
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (userId) {
      return `user:${userId}`;
    }

    // Fallback to IP-based limiting
    return `ip:${ip}:${this.hashUserAgent(userAgent)}`;
  }

  private hashUserAgent(userAgent?: string): string {
    if (!userAgent) return 'unknown';

    // Simple hash to group similar user agents
    let hash = 0;
    for (let i = 0; i < userAgent.length; i++) {
      const char = userAgent.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private getAdaptiveFactor(): number {
    const now = Date.now();

    // Check system load periodically
    if (now - this.lastLoadCheck > 30000) {
      // Every 30 seconds
      this.updateSystemLoad();
      this.lastLoadCheck = now;
    }

    // Inverse relationship: high load = lower limits
    return Math.max(0.1, Math.min(2.0, 1 / this.systemLoadFactor));
  }

  private updateSystemLoad(): void {
    try {
      // Simple CPU load approximation
      const loadAvg = process.loadavg()[0];
      const cpuCount = require('os').cpus().length;
      this.systemLoadFactor = Math.max(1.0, loadAvg / cpuCount);

      // Memory pressure factor
      const memUsage = process.memoryUsage();
      const memPressure = memUsage.heapUsed / memUsage.heapTotal;
      if (memPressure > 0.8) {
        this.systemLoadFactor *= 1.5;
      }

      this.emit('system-load-updated', {
        loadAvg,
        cpuCount,
        memPressure,
        systemLoadFactor: this.systemLoadFactor,
      });
    } catch (error) {
      console.error('Error updating system load:', error);
    }
  }
}

/**
 * Specialized rate limiters for different operations
 */
export class SearchRateLimiter extends RateLimiter {
  constructor() {
    super({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 searches per minute
      keyGenerator: req => {
        const userId = req.headers['x-user-id'];
        const sessionId = req.headers['x-session-id'];
        return userId ? `search:user:${userId}` : `search:session:${sessionId}`;
      },
      onLimitReached: (req, info) => {
        console.warn('Search rate limit exceeded', {
          ip: req.ip,
          userId: req.headers['x-user-id'],
          current: info.current,
          limit: info.limit,
        });
      },
    });

    // Premium users get higher limits
    this.on('request-checked', event => {
      if (event.userId && this.isPremiumUser(event.userId)) {
        // Dynamically increase limit for premium users
      }
    });
  }

  private isPremiumUser(userId: string): boolean {
    // Implementation would check user subscription status
    return false;
  }
}

export class AutocompleteRateLimiter extends RateLimiter {
  constructor() {
    super({
      windowMs: 10 * 1000, // 10 seconds
      max: 50, // 50 autocomplete requests per 10 seconds
      skipSuccessfulRequests: false,
      keyGenerator: req => {
        const userId = req.headers['x-user-id'];
        const sessionId = req.headers['x-session-id'];
        return userId ? `autocomplete:user:${userId}` : `autocomplete:session:${sessionId}`;
      },
    });
  }
}
