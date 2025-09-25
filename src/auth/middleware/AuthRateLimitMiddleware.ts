import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './SSOJWTMiddleware';
import { RedisCache } from '../../services/cache/RedisCache';
import crypto from 'crypto';

export interface RateLimitRule {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  skipIf?: (req: Request) => boolean;
  onLimitReached?: (req: Request, res: Response) => void;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

export class AuthRateLimitMiddleware {
  private cache: RedisCache;

  constructor() {
    this.cache = new RedisCache();
  }

  /**
   * General authentication rate limiting
   */
  auth(options: Partial<RateLimitRule> = {}) {
    const config: RateLimitRule = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
      keyGenerator: req => this.getClientIP(req),
      ...options,
    };

    return this.createRateLimit(config, 'auth');
  }

  /**
   * Login attempts rate limiting
   */
  login(options: Partial<RateLimitRule> = {}) {
    const config: RateLimitRule = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 login attempts per window
      keyGenerator: req => {
        const ip = this.getClientIP(req);
        const email = req.body?.email || 'unknown';
        return `${ip}:${email.toLowerCase()}`;
      },
      skipSuccessfulRequests: true,
      ...options,
    };

    return this.createRateLimit(config, 'login');
  }

  /**
   * Password reset rate limiting
   */
  passwordReset(options: Partial<RateLimitRule> = {}) {
    const config: RateLimitRule = {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 reset attempts per hour
      keyGenerator: req => {
        const ip = this.getClientIP(req);
        const email = req.body?.email || 'unknown';
        return `reset:${ip}:${email.toLowerCase()}`;
      },
      ...options,
    };

    return this.createRateLimit(config, 'password_reset');
  }

  /**
   * MFA attempts rate limiting
   */
  mfa(options: Partial<RateLimitRule> = {}) {
    const config: RateLimitRule = {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10, // 10 MFA attempts per 5 minutes
      keyGenerator: req => {
        const userId = (req as AuthenticatedRequest).user?.id || this.getClientIP(req);
        return `mfa:${userId}`;
      },
      skipSuccessfulRequests: true,
      ...options,
    };

    return this.createRateLimit(config, 'mfa');
  }

  /**
   * Token refresh rate limiting
   */
  tokenRefresh(options: Partial<RateLimitRule> = {}) {
    const config: RateLimitRule = {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 20, // 20 refresh requests per 5 minutes
      keyGenerator: req => {
        const userId = (req as AuthenticatedRequest).user?.id || this.getClientIP(req);
        return `refresh:${userId}`;
      },
      ...options,
    };

    return this.createRateLimit(config, 'token_refresh');
  }

  /**
   * SSO callback rate limiting
   */
  ssoCallback(options: Partial<RateLimitRule> = {}) {
    const config: RateLimitRule = {
      windowMs: 10 * 60 * 1000, // 10 minutes
      max: 10, // 10 SSO callbacks per 10 minutes
      keyGenerator: req => {
        const ip = this.getClientIP(req);
        const state = req.query.state || req.body.state || 'unknown';
        return `sso:${ip}:${state}`;
      },
      ...options,
    };

    return this.createRateLimit(config, 'sso_callback');
  }

  /**
   * API key usage rate limiting
   */
  apiKey(options: Partial<RateLimitRule> = {}) {
    const config: RateLimitRule = {
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
      keyGenerator: req => {
        const apiKey = req.headers['x-api-key'] as string;
        if (apiKey) {
          // Hash the API key for privacy
          return `api:${crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 16)}`;
        }
        return `api:${this.getClientIP(req)}`;
      },
      ...options,
    };

    return this.createRateLimit(config, 'api_key');
  }

  /**
   * User-specific rate limiting (for authenticated users)
   */
  userSpecific(maxPerWindow: number, windowMs: number = 60 * 1000) {
    const config: RateLimitRule = {
      windowMs,
      max: maxPerWindow,
      keyGenerator: req => {
        const userId = (req as AuthenticatedRequest).user?.id;
        if (!userId) {
          return `anonymous:${this.getClientIP(req)}`;
        }
        return `user:${userId}`;
      },
      skipIf: req => !(req as AuthenticatedRequest).user, // Skip rate limiting for unauthenticated requests
    };

    return this.createRateLimit(config, 'user_specific');
  }

  /**
   * Role-based rate limiting
   */
  roleBasedLimit(limits: Record<string, { max: number; windowMs?: number }>) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const user = req.user;
      if (!user) {
        return next(); // Skip rate limiting for unauthenticated users
      }

      const roleLimit = limits[user.role] || limits['default'];
      if (!roleLimit) {
        return next(); // No limit defined for this role
      }

      const config: RateLimitRule = {
        windowMs: roleLimit.windowMs || 60 * 1000,
        max: roleLimit.max,
        keyGenerator: () => `role:${user.role}:${user.id}`,
      };

      const rateLimitMiddleware = this.createRateLimit(config, `role_${user.role}`);
      return rateLimitMiddleware(req, res, next);
    };
  }

  /**
   * Burst protection - allows burst of requests but limits sustained rate
   */
  burstProtection(
    burstMax: number,
    sustainedMax: number,
    burstWindowMs: number = 10000,
    sustainedWindowMs: number = 60000
  ) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const key = this.getClientIP(req);
      const now = Date.now();

      // Check burst limit
      const burstKey = `burst:${key}`;
      const burstCount = await this.incrementCounter(burstKey, burstWindowMs);

      if (burstCount > burstMax) {
        return this.sendRateLimitResponse(
          res,
          {
            limit: burstMax,
            remaining: 0,
            reset: new Date(now + burstWindowMs),
            retryAfter: Math.ceil(burstWindowMs / 1000),
          },
          'Burst limit exceeded'
        );
      }

      // Check sustained limit
      const sustainedKey = `sustained:${key}`;
      const sustainedCount = await this.incrementCounter(sustainedKey, sustainedWindowMs);

      if (sustainedCount > sustainedMax) {
        return this.sendRateLimitResponse(
          res,
          {
            limit: sustainedMax,
            remaining: 0,
            reset: new Date(now + sustainedWindowMs),
            retryAfter: Math.ceil(sustainedWindowMs / 1000),
          },
          'Sustained rate limit exceeded'
        );
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Burst-Limit', burstMax.toString());
      res.setHeader('X-RateLimit-Burst-Remaining', (burstMax - burstCount).toString());
      res.setHeader('X-RateLimit-Sustained-Limit', sustainedMax.toString());
      res.setHeader('X-RateLimit-Sustained-Remaining', (sustainedMax - sustainedCount).toString());

      next();
    };
  }

  /**
   * Adaptive rate limiting - adjusts limits based on system load
   */
  adaptive(baseMax: number, windowMs: number = 60000) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Get current system load (simplified example)
      const systemLoad = await this.getSystemLoad();

      // Adjust rate limit based on load
      const adjustedMax = Math.floor(baseMax * (1 - systemLoad));

      const config: RateLimitRule = {
        windowMs,
        max: Math.max(1, adjustedMax), // Ensure at least 1 request is allowed
        keyGenerator: req => this.getClientIP(req),
      };

      const rateLimitMiddleware = this.createRateLimit(config, 'adaptive');
      return rateLimitMiddleware(req, res, next);
    };
  }

  /**
   * Main rate limit factory
   */
  private createRateLimit(config: RateLimitRule, type: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Skip if condition is met
        if (config.skipIf && config.skipIf(req)) {
          return next();
        }

        const key = config.keyGenerator ? config.keyGenerator(req) : this.getClientIP(req);
        const rateLimitKey = `ratelimit:${type}:${key}`;

        const now = Date.now();
        const windowStart = now - config.windowMs;

        // Get current count
        const count = await this.incrementCounter(rateLimitKey, config.windowMs);

        if (count > config.max) {
          // Rate limit exceeded
          await this.logRateLimitViolation(req, type, key, count, config.max);

          if (config.onLimitReached) {
            config.onLimitReached(req, res);
          }

          return this.sendRateLimitResponse(
            res,
            {
              limit: config.max,
              remaining: 0,
              reset: new Date(now + config.windowMs),
              retryAfter: Math.ceil(config.windowMs / 1000),
            },
            `Rate limit exceeded for ${type}`
          );
        }

        // Set rate limit headers
        const remaining = Math.max(0, config.max - count);
        res.setHeader('X-RateLimit-Limit', config.max.toString());
        res.setHeader('X-RateLimit-Remaining', remaining.toString());
        res.setHeader('X-RateLimit-Reset', new Date(now + config.windowMs).toISOString());
        res.setHeader('X-RateLimit-Type', type);

        next();
      } catch (error) {
        console.error('Rate limit middleware error:', error);
        next(); // Continue on error to not block the request
      }
    };
  }

  /**
   * Increment counter with sliding window
   */
  private async incrementCounter(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Remove old entries (sliding window)
      await this.cache.del(`${key}:*`); // Simplified - in practice, use ZREMRANGEBYSCORE

      // Add current request
      const requestKey = `${key}:${now}`;
      await this.cache.set(requestKey, '1', Math.ceil(windowMs / 1000));

      // Count requests in current window (simplified)
      // In practice, use Redis sorted sets for accurate sliding window
      const pattern = `${key}:*`;
      const keys = await this.cache.keys(pattern);

      // Filter keys within window
      const validKeys = keys.filter(k => {
        const timestamp = parseInt(k.split(':').pop() || '0');
        return timestamp > windowStart;
      });

      return validKeys.length;
    } catch (error) {
      console.error('Counter increment error:', error);
      return 1; // Return 1 on error to allow the request
    }
  }

  /**
   * Get system load (simplified example)
   */
  private async getSystemLoad(): Promise<number> {
    try {
      // This would typically check CPU, memory, active connections, etc.
      // For now, return a random value between 0 and 0.5
      return Math.random() * 0.5;
    } catch (error) {
      return 0; // Return 0 load on error (no throttling)
    }
  }

  /**
   * Log rate limit violation
   */
  private async logRateLimitViolation(
    req: Request,
    type: string,
    key: string,
    current: number,
    limit: number
  ) {
    try {
      console.warn('Rate limit violation:', {
        type,
        key,
        current,
        limit,
        ip: this.getClientIP(req),
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to log rate limit violation:', error);
    }
  }

  /**
   * Send rate limit response
   */
  private sendRateLimitResponse(res: Response, info: RateLimitInfo, message: string) {
    res.setHeader('X-RateLimit-Limit', info.limit.toString());
    res.setHeader('X-RateLimit-Remaining', info.remaining.toString());
    res.setHeader('X-RateLimit-Reset', info.reset.toISOString());

    if (info.retryAfter) {
      res.setHeader('Retry-After', info.retryAfter.toString());
    }

    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message,
      rateLimitInfo: {
        limit: info.limit,
        remaining: info.remaining,
        resetTime: info.reset.toISOString(),
        retryAfter: info.retryAfter,
      },
    });
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req as any).ip ||
      'unknown'
    );
  }
}

export const authRateLimit = new AuthRateLimitMiddleware();
