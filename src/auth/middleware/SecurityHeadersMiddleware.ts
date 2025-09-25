import { Request, Response, NextFunction } from 'express';

export interface SecurityHeadersConfig {
  // Content Security Policy
  csp?: {
    enabled: boolean;
    policy: string;
    reportUri?: string;
    reportOnly?: boolean;
  };

  // HTTP Strict Transport Security
  hsts?: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };

  // X-Frame-Options
  frameOptions?: {
    enabled: boolean;
    policy: 'DENY' | 'SAMEORIGIN' | string;
  };

  // X-Content-Type-Options
  noSniff?: boolean;

  // X-XSS-Protection
  xssProtection?: {
    enabled: boolean;
    mode: 'block' | 'report';
    reportUri?: string;
  };

  // Referrer Policy
  referrerPolicy?: {
    enabled: boolean;
    policy: string;
  };

  // Permissions Policy (formerly Feature Policy)
  permissionsPolicy?: {
    enabled: boolean;
    policy: Record<string, string[]>;
  };

  // Cross-Origin settings
  crossOrigin?: {
    embedderPolicy?: 'unsafe-none' | 'require-corp';
    openerPolicy?: 'unsafe-none' | 'same-origin-allow-popups' | 'same-origin';
    resourcePolicy?: 'same-site' | 'same-origin' | 'cross-origin';
  };

  // Custom headers
  customHeaders?: Record<string, string>;
}

export class SecurityHeadersMiddleware {
  private config: SecurityHeadersConfig;

  constructor(config: Partial<SecurityHeadersConfig> = {}) {
    this.config = this.getDefaultConfig();
    this.mergeConfig(config);
  }

  private getDefaultConfig(): SecurityHeadersConfig {
    return {
      csp: {
        enabled: true,
        policy:
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: ws:; frame-ancestors 'none';",
        reportOnly: false,
      },
      hsts: {
        enabled: true,
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      frameOptions: {
        enabled: true,
        policy: 'DENY',
      },
      noSniff: true,
      xssProtection: {
        enabled: true,
        mode: 'block',
      },
      referrerPolicy: {
        enabled: true,
        policy: 'strict-origin-when-cross-origin',
      },
      permissionsPolicy: {
        enabled: true,
        policy: {
          camera: [],
          microphone: [],
          geolocation: [],
          payment: [],
          usb: [],
          magnetometer: [],
          gyroscope: [],
          accelerometer: [],
        },
      },
      crossOrigin: {
        embedderPolicy: 'require-corp',
        openerPolicy: 'same-origin',
        resourcePolicy: 'same-origin',
      },
      customHeaders: {},
    };
  }

  private mergeConfig(userConfig: Partial<SecurityHeadersConfig>): void {
    if (userConfig.csp) {
      this.config.csp = { ...this.config.csp!, ...userConfig.csp };
    }
    if (userConfig.hsts) {
      this.config.hsts = { ...this.config.hsts!, ...userConfig.hsts };
    }
    if (userConfig.frameOptions) {
      this.config.frameOptions = { ...this.config.frameOptions!, ...userConfig.frameOptions };
    }
    if (userConfig.xssProtection) {
      this.config.xssProtection = { ...this.config.xssProtection!, ...userConfig.xssProtection };
    }
    if (userConfig.referrerPolicy) {
      this.config.referrerPolicy = { ...this.config.referrerPolicy!, ...userConfig.referrerPolicy };
    }
    if (userConfig.permissionsPolicy) {
      this.config.permissionsPolicy = {
        ...this.config.permissionsPolicy!,
        ...userConfig.permissionsPolicy,
      };
    }
    if (userConfig.crossOrigin) {
      this.config.crossOrigin = { ...this.config.crossOrigin!, ...userConfig.crossOrigin };
    }
    if (userConfig.customHeaders) {
      this.config.customHeaders = { ...this.config.customHeaders!, ...userConfig.customHeaders };
    }
    if (userConfig.noSniff !== undefined) {
      this.config.noSniff = userConfig.noSniff;
    }
  }

  /**
   * Apply all security headers
   */
  apply() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Content Security Policy
      this.applyCSP(res);

      // HTTP Strict Transport Security
      this.applyHSTS(res);

      // X-Frame-Options
      this.applyFrameOptions(res);

      // X-Content-Type-Options
      this.applyNoSniff(res);

      // X-XSS-Protection
      this.applyXSSProtection(res);

      // Referrer Policy
      this.applyReferrerPolicy(res);

      // Permissions Policy
      this.applyPermissionsPolicy(res);

      // Cross-Origin headers
      this.applyCrossOriginHeaders(res);

      // Custom headers
      this.applyCustomHeaders(res);

      // Remove potentially revealing headers
      this.removeRevealingHeaders(res);

      next();
    };
  }

  /**
   * Apply security headers specifically for authentication endpoints
   */
  applyForAuth() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Strict CSP for auth pages
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self';"
      );

      // Additional auth-specific headers
      res.setHeader('X-Auth-Security', 'strict');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Clear-Site-Data', '"cache", "storage"');

      // Apply base security headers
      this.apply()(req, res, next);
    };
  }

  /**
   * Apply security headers for SSO endpoints
   */
  applyForSSO() {
    return (req: Request, res: Response, next: NextFunction) => {
      // More permissive CSP for SSO redirects
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none';"
      );

      // SSO-specific headers
      res.setHeader('X-SSO-Security', 'enabled');
      res.setHeader('Referrer-Policy', 'strict-origin');

      // Apply base security headers with modifications
      const modifiedConfig = {
        ...this.config,
        frameOptions: { enabled: true, policy: 'DENY' as const },
        crossOrigin: {
          ...this.config.crossOrigin!,
          openerPolicy: 'same-origin-allow-popups' as const,
        },
      };

      const middleware = new SecurityHeadersMiddleware(modifiedConfig);
      middleware.apply()(req, res, next);
    };
  }

  /**
   * Apply security headers for API endpoints
   */
  applyForAPI() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Minimal CSP for API responses
      res.setHeader('Content-Security-Policy', "default-src 'none';");

      // API-specific headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-API-Security', 'enabled');

      // No cache for sensitive API responses
      if (req.path.includes('/auth/') || req.path.includes('/user/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
      }

      next();
    };
  }

  private applyCSP(res: Response): void {
    if (!this.config.csp?.enabled) return;

    const headerName = this.config.csp.reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

    let policy = this.config.csp.policy;

    if (this.config.csp.reportUri) {
      policy += `; report-uri ${this.config.csp.reportUri}`;
    }

    res.setHeader(headerName, policy);
  }

  private applyHSTS(res: Response): void {
    if (!this.config.hsts?.enabled) return;

    let value = `max-age=${this.config.hsts.maxAge}`;

    if (this.config.hsts.includeSubDomains) {
      value += '; includeSubDomains';
    }

    if (this.config.hsts.preload) {
      value += '; preload';
    }

    res.setHeader('Strict-Transport-Security', value);
  }

  private applyFrameOptions(res: Response): void {
    if (!this.config.frameOptions?.enabled) return;

    res.setHeader('X-Frame-Options', this.config.frameOptions.policy);
  }

  private applyNoSniff(res: Response): void {
    if (!this.config.noSniff) return;

    res.setHeader('X-Content-Type-Options', 'nosniff');
  }

  private applyXSSProtection(res: Response): void {
    if (!this.config.xssProtection?.enabled) return;

    let value = '1';

    if (this.config.xssProtection.mode === 'block') {
      value += '; mode=block';
    } else if (this.config.xssProtection.mode === 'report' && this.config.xssProtection.reportUri) {
      value += `; report=${this.config.xssProtection.reportUri}`;
    }

    res.setHeader('X-XSS-Protection', value);
  }

  private applyReferrerPolicy(res: Response): void {
    if (!this.config.referrerPolicy?.enabled) return;

    res.setHeader('Referrer-Policy', this.config.referrerPolicy.policy);
  }

  private applyPermissionsPolicy(res: Response): void {
    if (!this.config.permissionsPolicy?.enabled) return;

    const policies: string[] = [];

    Object.entries(this.config.permissionsPolicy.policy).forEach(([feature, allowlist]) => {
      if (allowlist.length === 0) {
        policies.push(`${feature}=()`);
      } else {
        const origins = allowlist.map(origin => (origin === 'self' ? '"self"' : origin)).join(' ');
        policies.push(`${feature}=(${origins})`);
      }
    });

    if (policies.length > 0) {
      res.setHeader('Permissions-Policy', policies.join(', '));
    }
  }

  private applyCrossOriginHeaders(res: Response): void {
    if (!this.config.crossOrigin) return;

    if (this.config.crossOrigin.embedderPolicy) {
      res.setHeader('Cross-Origin-Embedder-Policy', this.config.crossOrigin.embedderPolicy);
    }

    if (this.config.crossOrigin.openerPolicy) {
      res.setHeader('Cross-Origin-Opener-Policy', this.config.crossOrigin.openerPolicy);
    }

    if (this.config.crossOrigin.resourcePolicy) {
      res.setHeader('Cross-Origin-Resource-Policy', this.config.crossOrigin.resourcePolicy);
    }
  }

  private applyCustomHeaders(res: Response): void {
    if (!this.config.customHeaders) return;

    Object.entries(this.config.customHeaders).forEach(([name, value]) => {
      res.setHeader(name, value);
    });
  }

  private removeRevealingHeaders(res: Response): void {
    // Remove headers that might reveal server information
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    // Add generic server identification
    res.setHeader('Server', 'Mainframe-AI-Assistant');
  }

  /**
   * Create CSP nonce for inline scripts
   */
  static createCSPNonce(): string {
    return require('crypto').randomBytes(16).toString('base64');
  }

  /**
   * Middleware to add CSP nonce to requests
   */
  static withCSPNonce() {
    return (req: Request, res: Response, next: NextFunction) => {
      const nonce = SecurityHeadersMiddleware.createCSPNonce();
      (req as any).cspNonce = nonce;

      // Make nonce available in response locals for templates
      res.locals.cspNonce = nonce;

      next();
    };
  }

  /**
   * Update CSP to include nonce
   */
  withNonce(nonce: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (this.config.csp?.enabled) {
        let policy = this.config.csp.policy;

        // Add nonce to script-src and style-src
        policy = policy.replace(/(script-src[^;]*)/, `$1 'nonce-${nonce}'`);
        policy = policy.replace(/(style-src[^;]*)/, `$1 'nonce-${nonce}'`);

        const headerName = this.config.csp.reportOnly
          ? 'Content-Security-Policy-Report-Only'
          : 'Content-Security-Policy';

        res.setHeader(headerName, policy);
      }

      // Apply other security headers
      this.applyHSTS(res);
      this.applyFrameOptions(res);
      this.applyNoSniff(res);
      this.applyXSSProtection(res);
      this.applyReferrerPolicy(res);
      this.applyPermissionsPolicy(res);
      this.applyCrossOriginHeaders(res);
      this.applyCustomHeaders(res);
      this.removeRevealingHeaders(res);

      next();
    };
  }
}

// Export pre-configured instances
export const securityHeaders = {
  // Standard security headers for web pages
  standard: new SecurityHeadersMiddleware(),

  // Strict headers for authentication pages
  auth: new SecurityHeadersMiddleware({
    csp: {
      enabled: true,
      policy:
        "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self';",
    },
    frameOptions: {
      enabled: true,
      policy: 'DENY',
    },
  }),

  // API-specific headers
  api: new SecurityHeadersMiddleware({
    csp: {
      enabled: true,
      policy: "default-src 'none';",
    },
    frameOptions: {
      enabled: true,
      policy: 'DENY',
    },
  }),

  // Development headers (less strict)
  development: new SecurityHeadersMiddleware({
    csp: {
      enabled: true,
      policy:
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self' ws: wss:;",
      reportOnly: true,
    },
    hsts: {
      enabled: false,
    },
  }),
};
