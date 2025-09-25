import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ssoJWTMiddleware } from './SSOJWTMiddleware';
import { tokenValidation } from './TokenValidationMiddleware';
import { routeProtection } from './RouteProtectionMiddleware';
import { authRateLimit } from './AuthRateLimitMiddleware';
import { sessionMiddleware } from './SessionMiddleware';
import { securityHeaders } from './SecurityHeadersMiddleware';
import { corsMiddleware } from './CORSMiddleware';
import { multiProviderMiddleware } from './MultiProviderMiddleware';
import { errorHandling } from './ErrorHandlingMiddleware';
import { UserRole } from '../../database/schemas/auth/UserSchema';

export interface MiddlewareChainConfig {
  cors?: boolean | 'standard' | 'auth' | 'sso' | 'api';
  security?: boolean | 'standard' | 'auth' | 'api' | 'development';
  rateLimit?: boolean | 'auth' | 'login' | 'mfa' | 'refresh' | 'api';
  authentication?: boolean | 'required' | 'optional';
  validation?: boolean | 'standard' | 'strict';
  session?: boolean | 'standard' | 'strict';
  protection?: {
    roles?: UserRole[];
    permissions?: string[];
    requireOwnership?: boolean;
    requireMFA?: boolean;
  };
  provider?: boolean | 'auto' | 'validate';
  errors?: boolean;
}

export class MiddlewareComposer {
  /**
   * Create a complete authentication middleware chain
   */
  static createAuthChain(config: MiddlewareChainConfig = {}): RequestHandler[] {
    const middlewares: RequestHandler[] = [];

    // 1. CORS (if enabled)
    if (config.cors !== false) {
      const corsType = typeof config.cors === 'string' ? config.cors : 'standard';
      switch (corsType) {
        case 'auth':
          middlewares.push(corsMiddleware.standard.applyForAuth());
          break;
        case 'sso':
          middlewares.push(corsMiddleware.sso.applyForSSO());
          break;
        case 'api':
          middlewares.push(corsMiddleware.standard.applyForAPI());
          break;
        default:
          middlewares.push(corsMiddleware.standard.apply());
      }
    }

    // 2. Security Headers (if enabled)
    if (config.security !== false) {
      const securityType = typeof config.security === 'string' ? config.security : 'standard';
      switch (securityType) {
        case 'auth':
          middlewares.push(securityHeaders.auth.applyForAuth());
          break;
        case 'api':
          middlewares.push(securityHeaders.api.applyForAPI());
          break;
        case 'development':
          middlewares.push(securityHeaders.development.apply());
          break;
        default:
          middlewares.push(securityHeaders.standard.apply());
      }
    }

    // 3. Rate Limiting (if enabled)
    if (config.rateLimit !== false) {
      const rateLimitType = typeof config.rateLimit === 'string' ? config.rateLimit : 'auth';
      switch (rateLimitType) {
        case 'login':
          middlewares.push(authRateLimit.login());
          break;
        case 'mfa':
          middlewares.push(authRateLimit.mfa());
          break;
        case 'refresh':
          middlewares.push(authRateLimit.tokenRefresh());
          break;
        case 'api':
          middlewares.push(authRateLimit.apiKey());
          break;
        default:
          middlewares.push(authRateLimit.auth());
      }
    }

    // 4. Provider Support (if enabled)
    if (config.provider) {
      const providerType = typeof config.provider === 'string' ? config.provider : 'validate';
      switch (providerType) {
        case 'auto':
          middlewares.push(multiProviderMiddleware.autoSelectProvider());
          break;
        default:
          middlewares.push(multiProviderMiddleware.validateProvider());
      }
    }

    // 5. Authentication (if enabled)
    if (config.authentication !== false) {
      const authType =
        typeof config.authentication === 'string' ? config.authentication : 'required';
      switch (authType) {
        case 'optional':
          middlewares.push(ssoJWTMiddleware.optionalAuth());
          break;
        default:
          middlewares.push(ssoJWTMiddleware.authenticate());
      }
    }

    // 6. Token Validation (if enabled)
    if (config.validation !== false) {
      const validationType = typeof config.validation === 'string' ? config.validation : 'standard';
      switch (validationType) {
        case 'strict':
          middlewares.push(
            tokenValidation.validate({
              requireMFA: true,
              maxAge: 3600, // 1 hour
            })
          );
          break;
        default:
          middlewares.push(tokenValidation.validate());
      }
    }

    // 7. Session Management (if enabled)
    if (config.session !== false) {
      const sessionType = typeof config.session === 'string' ? config.session : 'standard';
      switch (sessionType) {
        case 'strict':
          middlewares.push(
            sessionMiddleware({
              strictIpValidation: true,
              logoutOnSuspiciousActivity: true,
              maxConcurrentSessions: 1,
            }).manage()
          );
          break;
        default:
          middlewares.push(sessionMiddleware().manage());
      }
    }

    // 8. Route Protection (if configured)
    if (config.protection) {
      const { roles, permissions, requireOwnership, requireMFA } = config.protection;

      if (roles || permissions) {
        middlewares.push(
          routeProtection.protect({
            roles,
            permissions,
            allowOwner: requireOwnership,
          })
        );
      }

      if (requireMFA) {
        middlewares.push(routeProtection.requireMFA());
      }
    }

    // 9. Error Handling (if enabled)
    if (config.errors !== false) {
      middlewares.push(errorHandling.handle());
    }

    return middlewares;
  }

  /**
   * Create SSO-specific middleware chain
   */
  static createSSOChain(): RequestHandler[] {
    return this.createAuthChain({
      cors: 'sso',
      security: 'standard',
      rateLimit: 'auth',
      provider: 'auto',
      authentication: false, // SSO handles its own auth
      validation: false,
      session: false,
      errors: true,
    });
  }

  /**
   * Create login-specific middleware chain
   */
  static createLoginChain(): RequestHandler[] {
    return this.createAuthChain({
      cors: 'auth',
      security: 'auth',
      rateLimit: 'login',
      authentication: false, // Login creates auth
      validation: false,
      session: false,
      errors: true,
    });
  }

  /**
   * Create API protection middleware chain
   */
  static createAPIChain(
    options: {
      roles?: UserRole[];
      permissions?: string[];
      requireMFA?: boolean;
    } = {}
  ): RequestHandler[] {
    return this.createAuthChain({
      cors: 'api',
      security: 'api',
      rateLimit: 'api',
      authentication: 'required',
      validation: 'standard',
      session: 'standard',
      protection: {
        roles: options.roles,
        permissions: options.permissions,
        requireMFA: options.requireMFA,
      },
      errors: true,
    });
  }

  /**
   * Create admin-only middleware chain
   */
  static createAdminChain(): RequestHandler[] {
    return this.createAuthChain({
      cors: 'standard',
      security: 'standard',
      rateLimit: 'auth',
      authentication: 'required',
      validation: 'strict',
      session: 'strict',
      protection: {
        roles: ['admin', 'super_admin'],
        requireMFA: true,
      },
      errors: true,
    });
  }

  /**
   * Create public endpoint middleware chain
   */
  static createPublicChain(): RequestHandler[] {
    return this.createAuthChain({
      cors: 'standard',
      security: 'standard',
      rateLimit: 'auth',
      authentication: 'optional',
      validation: false,
      session: false,
      protection: undefined,
      errors: true,
    });
  }

  /**
   * Create refresh token middleware chain
   */
  static createRefreshChain(): RequestHandler[] {
    return [
      corsMiddleware.standard.applyForAuth(),
      securityHeaders.auth.applyForAuth(),
      authRateLimit.tokenRefresh(),
      tokenValidation.validateRefreshToken(),
      ssoJWTMiddleware.refreshToken(),
      errorHandling.handleJWTErrors(),
    ];
  }

  /**
   * Create MFA-protected middleware chain
   */
  static createMFAChain(): RequestHandler[] {
    return this.createAuthChain({
      cors: 'auth',
      security: 'auth',
      rateLimit: 'mfa',
      authentication: 'required',
      validation: 'strict',
      session: 'standard',
      protection: {
        requireMFA: true,
      },
      errors: true,
    });
  }

  /**
   * Utility method to compose custom middleware chains
   */
  static compose(...middlewares: RequestHandler[]): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      let index = 0;

      const dispatch = (i: number): void => {
        if (i <= index) {
          throw new Error('next() called multiple times');
        }

        index = i;
        const middleware = middlewares[i];

        if (!middleware) {
          return next();
        }

        try {
          middleware(req, res, (err?: any) => {
            if (err) {
              return next(err);
            }
            dispatch(i + 1);
          });
        } catch (err) {
          next(err);
        }
      };

      dispatch(0);
    };
  }

  /**
   * Apply middleware conditionally based on environment
   */
  static conditional(
    condition: boolean | (() => boolean),
    middleware: RequestHandler
  ): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const shouldApply = typeof condition === 'function' ? condition() : condition;

      if (shouldApply) {
        return middleware(req, res, next);
      }

      next();
    };
  }

  /**
   * Apply middleware only in development
   */
  static development(middleware: RequestHandler): RequestHandler {
    return this.conditional(() => process.env.NODE_ENV === 'development', middleware);
  }

  /**
   * Apply middleware only in production
   */
  static production(middleware: RequestHandler): RequestHandler {
    return this.conditional(() => process.env.NODE_ENV === 'production', middleware);
  }
}

// Export convenience functions
export const createAuthChain = MiddlewareComposer.createAuthChain;
export const createSSOChain = MiddlewareComposer.createSSOChain;
export const createLoginChain = MiddlewareComposer.createLoginChain;
export const createAPIChain = MiddlewareComposer.createAPIChain;
export const createAdminChain = MiddlewareComposer.createAdminChain;
export const createPublicChain = MiddlewareComposer.createPublicChain;
export const createRefreshChain = MiddlewareComposer.createRefreshChain;
export const createMFAChain = MiddlewareComposer.createMFAChain;

// Export utility functions
export const composeMiddleware = MiddlewareComposer.compose;
export const conditionalMiddleware = MiddlewareComposer.conditional;
export const developmentOnly = MiddlewareComposer.development;
export const productionOnly = MiddlewareComposer.production;
