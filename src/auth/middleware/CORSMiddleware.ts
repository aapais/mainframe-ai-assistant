import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './SSOJWTMiddleware';

export interface CORSConfig {
  origins:
    | string[]
    | boolean
    | ((origin: string, callback: (err: Error | null, allowed?: boolean) => void) => void);
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders?: string[];
  credentials: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
  // SSO-specific options
  ssoOrigins?: string[];
  trustedDomains?: string[];
  allowSubdomains?: boolean;
}

export class CORSMiddleware {
  private config: CORSConfig;
  private trustedDomainRegex: RegExp[];

  constructor(config: Partial<CORSConfig> = {}) {
    this.config = {
      origins: process.env.NODE_ENV === 'production' ? [] : true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key',
        'X-Client-Version',
        'X-Request-ID',
        'X-CSRF-Token',
        'X-SSO-Provider',
        'X-Device-ID',
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-New-Token',
        'X-Token-Expires',
        'X-Session-Renewal-Required',
      ],
      credentials: true,
      maxAge: 86400, // 24 hours
      optionsSuccessStatus: 204,
      ...config,
    };

    this.trustedDomainRegex = this.buildTrustedDomainRegex();
  }

  /**
   * Standard CORS middleware
   */
  apply() {
    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;

      // Handle origin
      if (this.isOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
      }

      // Handle credentials
      if (this.config.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', this.config.methods.join(', '));
        res.setHeader('Access-Control-Allow-Headers', this.config.allowedHeaders.join(', '));

        if (this.config.maxAge) {
          res.setHeader('Access-Control-Max-Age', this.config.maxAge.toString());
        }

        return res.status(this.config.optionsSuccessStatus || 204).end();
      }

      // Expose headers for actual requests
      if (this.config.exposedHeaders && this.config.exposedHeaders.length > 0) {
        res.setHeader('Access-Control-Expose-Headers', this.config.exposedHeaders.join(', '));
      }

      next();
    };
  }

  /**
   * CORS middleware specifically for SSO endpoints
   */
  applyForSSO() {
    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;

      // More permissive for SSO callback URLs
      if (this.isSSOOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin!);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      // SSO-specific headers
      const ssoHeaders = [
        ...this.config.allowedHeaders,
        'X-SSO-State',
        'X-SSO-Code',
        'X-SSO-Provider',
        'X-Redirect-URI',
      ];

      const exposedHeaders = [
        ...(this.config.exposedHeaders || []),
        'X-SSO-Status',
        'X-SSO-Error',
        'X-New-User',
        'Location',
      ];

      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', ssoHeaders.join(', '));
        res.setHeader('Access-Control-Max-Age', '300'); // 5 minutes for SSO
        return res.status(204).end();
      }

      res.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(', '));
      next();
    };
  }

  /**
   * CORS middleware for authentication endpoints
   */
  applyForAuth() {
    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;

      // Strict origin checking for auth endpoints
      if (!this.isAuthOriginAllowed(origin)) {
        return res.status(403).json({
          success: false,
          error: 'CORS_NOT_ALLOWED',
          message: 'Origin not allowed for authentication endpoints',
        });
      }

      res.setHeader('Access-Control-Allow-Origin', origin!);
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      // Auth-specific headers
      const authHeaders = [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-CSRF-Token',
        'X-MFA-Code',
        'X-Device-ID',
        'X-Client-Version',
      ];

      const authExposedHeaders = [
        'X-Auth-Status',
        'X-MFA-Required',
        'X-Token-Expires',
        'X-Rate-Limit-Remaining',
        'X-Account-Status',
      ];

      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', authHeaders.join(', '));
        res.setHeader('Access-Control-Max-Age', '300');
        return res.status(204).end();
      }

      res.setHeader('Access-Control-Expose-Headers', authExposedHeaders.join(', '));
      next();
    };
  }

  /**
   * Dynamic CORS based on request context
   */
  applyDynamic() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      const userAgent = req.headers['user-agent'] || '';
      const path = req.path;

      // Different CORS policies based on context
      if (path.startsWith('/api/auth/sso/')) {
        return this.applyForSSO()(req, res, next);
      }

      if (path.startsWith('/api/auth/')) {
        return this.applyForAuth()(req, res, next);
      }

      if (path.startsWith('/api/')) {
        return this.applyForAPI()(req, res, next);
      }

      // Default CORS for other requests
      return this.apply()(req, res, next);
    };
  }

  /**
   * CORS middleware for API endpoints
   */
  applyForAPI() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;

      // Check if user is authenticated for additional origin validation
      if (req.user && this.isUserOriginTrusted(req.user.id, origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin!);
      } else if (this.isOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin!);
      } else {
        // Allow but log suspicious origins for monitoring
        if (origin) {
          console.warn('Suspicious API origin:', origin, 'for user:', req.user?.id);
        }
      }

      res.setHeader('Access-Control-Allow-Credentials', 'true');

      const apiHeaders = [
        'Content-Type',
        'Authorization',
        'X-API-Key',
        'X-Requested-With',
        'X-Client-Version',
        'X-Request-ID',
      ];

      const apiExposedHeaders = [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-API-Version',
        'X-Response-Time',
      ];

      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', this.config.methods.join(', '));
        res.setHeader('Access-Control-Allow-Headers', apiHeaders.join(', '));
        res.setHeader('Access-Control-Max-Age', this.config.maxAge?.toString() || '86400');
        return res.status(204).end();
      }

      res.setHeader('Access-Control-Expose-Headers', apiExposedHeaders.join(', '));
      next();
    };
  }

  /**
   * Conditional CORS based on environment
   */
  applyConditional() {
    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      const isDevelopment = process.env.NODE_ENV === 'development';
      const isProduction = process.env.NODE_ENV === 'production';

      if (isDevelopment) {
        // Allow all origins in development
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      } else if (isProduction) {
        // Strict origin checking in production
        if (!this.isOriginAllowed(origin)) {
          return res.status(403).json({
            success: false,
            error: 'CORS_FORBIDDEN',
            message: 'Origin not allowed',
          });
        }
        res.setHeader('Access-Control-Allow-Origin', origin!);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', this.config.methods.join(', '));
        res.setHeader('Access-Control-Allow-Headers', this.config.allowedHeaders.join(', '));
        res.setHeader('Access-Control-Max-Age', this.config.maxAge?.toString() || '86400');
        return res.status(204).end();
      }

      if (this.config.exposedHeaders) {
        res.setHeader('Access-Control-Expose-Headers', this.config.exposedHeaders.join(', '));
      }

      next();
    };
  }

  /**
   * Private helper methods
   */
  private isOriginAllowed(origin?: string): boolean {
    if (!origin) return false;

    if (typeof this.config.origins === 'boolean') {
      return this.config.origins;
    }

    if (Array.isArray(this.config.origins)) {
      return this.config.origins.includes(origin) || this.isTrustedDomain(origin);
    }

    // Custom function to determine origin
    if (typeof this.config.origins === 'function') {
      return new Promise(resolve => {
        this.config.origins(origin, (err, allowed) => {
          resolve(!err && !!allowed);
        });
      }) as any; // Type assertion for sync usage
    }

    return false;
  }

  private isSSOOriginAllowed(origin?: string): boolean {
    if (!origin) return false;

    // Check SSO-specific origins first
    if (this.config.ssoOrigins && this.config.ssoOrigins.includes(origin)) {
      return true;
    }

    // Check trusted domains
    if (this.isTrustedDomain(origin)) {
      return true;
    }

    // Fall back to regular origin check
    return this.isOriginAllowed(origin);
  }

  private isAuthOriginAllowed(origin?: string): boolean {
    if (!origin) return false;

    // Auth endpoints are more restrictive
    if (Array.isArray(this.config.origins)) {
      return this.config.origins.includes(origin);
    }

    // In development, allow localhost
    if (process.env.NODE_ENV === 'development') {
      return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(origin);
    }

    return this.isTrustedDomain(origin);
  }

  private isTrustedDomain(origin: string): boolean {
    if (!this.config.trustedDomains) return false;

    return this.trustedDomainRegex.some(regex => regex.test(origin));
  }

  private buildTrustedDomainRegex(): RegExp[] {
    if (!this.config.trustedDomains) return [];

    return this.config.trustedDomains.map(domain => {
      let pattern = domain
        .replace(/\./g, '\\.') // Escape dots
        .replace(/\*/g, '.*'); // Convert wildcards

      if (this.config.allowSubdomains) {
        // Allow subdomains
        pattern = `^https?:\/\/([a-zA-Z0-9-]+\.)*${pattern}(:\\d+)?$`;
      } else {
        pattern = `^https?:\/\/${pattern}(:\\d+)?$`;
      }

      return new RegExp(pattern);
    });
  }

  private async isUserOriginTrusted(userId: string, origin?: string): Promise<boolean> {
    if (!origin || !userId) return false;

    try {
      // TODO: Check user's trusted origins from database
      // This could be based on previous successful logins, etc.
      return false;
    } catch (error) {
      console.error('Error checking user trusted origins:', error);
      return false;
    }
  }

  /**
   * Utility method to add trusted domain
   */
  addTrustedDomain(domain: string): void {
    if (!this.config.trustedDomains) {
      this.config.trustedDomains = [];
    }

    if (!this.config.trustedDomains.includes(domain)) {
      this.config.trustedDomains.push(domain);
      this.trustedDomainRegex = this.buildTrustedDomainRegex();
    }
  }

  /**
   * Utility method to remove trusted domain
   */
  removeTrustedDomain(domain: string): void {
    if (!this.config.trustedDomains) return;

    const index = this.config.trustedDomains.indexOf(domain);
    if (index > -1) {
      this.config.trustedDomains.splice(index, 1);
      this.trustedDomainRegex = this.buildTrustedDomainRegex();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): CORSConfig {
    return { ...this.config };
  }
}

// Export pre-configured instances
export const corsMiddleware = {
  // Standard CORS for web applications
  standard: new CORSMiddleware({
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    trustedDomains: process.env.TRUSTED_DOMAINS?.split(','),
    allowSubdomains: true,
  }),

  // Strict CORS for production
  production: new CORSMiddleware({
    origins: process.env.CORS_ORIGINS?.split(',') || [],
    credentials: true,
    maxAge: 300, // 5 minutes for production
    trustedDomains: process.env.TRUSTED_DOMAINS?.split(','),
    allowSubdomains: false,
  }),

  // Development CORS (permissive)
  development: new CORSMiddleware({
    origins: true,
    credentials: true,
    trustedDomains: ['localhost', '127.0.0.1', '0.0.0.0'],
    allowSubdomains: true,
  }),

  // SSO-specific CORS
  sso: new CORSMiddleware({
    origins: process.env.CORS_ORIGINS?.split(',') || [],
    ssoOrigins: process.env.SSO_ORIGINS?.split(','),
    credentials: true,
    maxAge: 300,
    methods: ['GET', 'POST', 'OPTIONS'],
  }),
};
