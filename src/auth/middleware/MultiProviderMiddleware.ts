import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './SSOJWTMiddleware';
import { SSOService } from '../sso/SSOService';
import { SSOProvider, SSOConfiguration } from '../../database/schemas/auth/UserSchema';
import { DatabaseManager } from '../../database/DatabaseManager';
import { RedisCache } from '../../services/cache/RedisCache';
import crypto from 'crypto';

export interface ProviderConfig {
  id: string;
  name: string;
  provider: SSOProvider;
  priority: number;
  enabled: boolean;
  domainRestriction?: string[];
  roleMapping?: Record<string, string>;
  claimsMapping?: Record<string, string>;
}

export interface ProviderSelection {
  provider: ProviderConfig;
  reason: string;
  confidence: number;
}

export class MultiProviderMiddleware {
  private ssoService: SSOService;
  private db: DatabaseManager;
  private cache: RedisCache;
  private providerConfigs: Map<string, ProviderConfig> = new Map();

  constructor() {
    this.ssoService = SSOService.getInstance();
    this.db = DatabaseManager.getInstance();
    this.cache = new RedisCache();
    this.loadProviderConfigs();
  }

  /**
   * Load provider configurations from database
   */
  private async loadProviderConfigs(): Promise<void> {
    try {
      const configs = await this.db.all(`
        SELECT * FROM sso_configurations 
        WHERE is_enabled = 1 
        ORDER BY priority ASC
      `);

      this.providerConfigs.clear();
      for (const config of configs) {
        this.providerConfigs.set(config.id, {
          id: config.id,
          name: config.name,
          provider: config.provider,
          priority: config.priority,
          enabled: Boolean(config.is_enabled),
          domainRestriction: config.domain_restriction
            ? JSON.parse(config.domain_restriction)
            : undefined,
          roleMapping: config.role_mapping ? JSON.parse(config.role_mapping) : undefined,
          claimsMapping: config.claims_mapping ? JSON.parse(config.claims_mapping) : undefined,
        });
      }
    } catch (error) {
      console.error('Failed to load provider configurations:', error);
    }
  }

  /**
   * Get available providers for user
   */
  getAvailableProviders() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const email = req.query.email as string;
        const domain = req.query.domain as string;

        const availableProviders = await this.getProvidersForUser(email, domain);

        res.json({
          success: true,
          data: {
            providers: availableProviders.map(config => ({
              id: config.id,
              name: config.name,
              provider: config.provider,
              priority: config.priority,
            })),
          },
        });
      } catch (error) {
        console.error('Get available providers error:', error);
        res.status(500).json({
          success: false,
          error: 'PROVIDER_FETCH_ERROR',
          message: 'Failed to fetch available providers',
        });
      }
    };
  }

  /**
   * Auto-select provider based on email domain
   */
  autoSelectProvider() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const email = req.body.email || req.query.email;

        if (!email) {
          return res.status(400).json({
            success: false,
            error: 'EMAIL_REQUIRED',
            message: 'Email is required for provider auto-selection',
          });
        }

        const selection = await this.selectProviderForEmail(email);

        if (!selection) {
          return res.status(404).json({
            success: false,
            error: 'NO_PROVIDER_FOUND',
            message: 'No suitable provider found for this email domain',
          });
        }

        // Store selection in request for next middleware
        (req as any).selectedProvider = selection.provider;
        (req as any).providerSelection = selection;

        next();
      } catch (error) {
        console.error('Auto select provider error:', error);
        res.status(500).json({
          success: false,
          error: 'PROVIDER_SELECTION_ERROR',
          message: 'Failed to auto-select provider',
        });
      }
    };
  }

  /**
   * Validate provider is available and configured
   */
  validateProvider() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const providerId = req.params.providerId || req.body.providerId || req.query.providerId;

        if (!providerId) {
          return res.status(400).json({
            success: false,
            error: 'PROVIDER_ID_REQUIRED',
            message: 'Provider ID is required',
          });
        }

        const providerConfig = this.providerConfigs.get(providerId);

        if (!providerConfig) {
          return res.status(404).json({
            success: false,
            error: 'PROVIDER_NOT_FOUND',
            message: 'Provider not found or not configured',
          });
        }

        if (!providerConfig.enabled) {
          return res.status(403).json({
            success: false,
            error: 'PROVIDER_DISABLED',
            message: 'Provider is currently disabled',
          });
        }

        // Check domain restrictions
        const email = req.body.email || req.query.email;
        if (email && providerConfig.domainRestriction) {
          const domain = email.split('@')[1];
          if (!providerConfig.domainRestriction.includes(domain)) {
            return res.status(403).json({
              success: false,
              error: 'DOMAIN_NOT_ALLOWED',
              message: 'Email domain not allowed for this provider',
              allowedDomains: providerConfig.domainRestriction,
            });
          }
        }

        // Store validated provider in request
        (req as any).validatedProvider = providerConfig;

        next();
      } catch (error) {
        console.error('Validate provider error:', error);
        res.status(500).json({
          success: false,
          error: 'PROVIDER_VALIDATION_ERROR',
          message: 'Failed to validate provider',
        });
      }
    };
  }

  /**
   * Route requests to appropriate provider handler
   */
  routeToProvider() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const provider = (req as any).validatedProvider || (req as any).selectedProvider;

        if (!provider) {
          return res.status(400).json({
            success: false,
            error: 'NO_PROVIDER_SELECTED',
            message: 'No provider selected or validated',
          });
        }

        // Add provider info to request
        req.ssoProvider = provider.provider;
        (req as any).providerConfig = provider;

        // Route based on provider type
        switch (provider.provider) {
          case 'google':
            return this.handleGoogleProvider(req, res, next);
          case 'microsoft':
          case 'azure_ad':
            return this.handleMicrosoftProvider(req, res, next);
          case 'okta':
            return this.handleOktaProvider(req, res, next);
          case 'auth0':
            return this.handleAuth0Provider(req, res, next);
          case 'saml':
            return this.handleSAMLProvider(req, res, next);
          case 'ldap':
            return this.handleLDAPProvider(req, res, next);
          default:
            return this.handleGenericOIDCProvider(req, res, next);
        }
      } catch (error) {
        console.error('Route to provider error:', error);
        res.status(500).json({
          success: false,
          error: 'PROVIDER_ROUTING_ERROR',
          message: 'Failed to route to provider',
        });
      }
    };
  }

  /**
   * Handle provider-specific callback processing
   */
  handleProviderCallback() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const providerId = req.params.providerId;
        const providerConfig = this.providerConfigs.get(providerId);

        if (!providerConfig) {
          return res.status(404).json({
            success: false,
            error: 'PROVIDER_NOT_FOUND',
            message: 'Provider not found for callback',
          });
        }

        // Store provider config for callback processing
        (req as any).providerConfig = providerConfig;

        // Log callback attempt
        await this.logProviderEvent(providerId, 'callback_received', {
          ip: this.getClientIP(req),
          userAgent: req.headers['user-agent'],
          state: req.query.state || req.body.state,
          hasCode: !!(req.query.code || req.body.code),
          hasError: !!(req.query.error || req.body.error),
        });

        next();
      } catch (error) {
        console.error('Handle provider callback error:', error);
        res.status(500).json({
          success: false,
          error: 'CALLBACK_ERROR',
          message: 'Failed to handle provider callback',
        });
      }
    };
  }

  /**
   * Provider health check middleware
   */
  checkProviderHealth() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const results: Record<string, any> = {};

        for (const [id, config] of this.providerConfigs) {
          results[id] = {
            name: config.name,
            provider: config.provider,
            enabled: config.enabled,
            healthy: await this.checkProviderEndpoints(config),
          };
        }

        res.json({
          success: true,
          data: {
            providers: results,
            totalProviders: this.providerConfigs.size,
            healthyProviders: Object.values(results).filter(p => p.healthy).length,
          },
        });
      } catch (error) {
        console.error('Provider health check error:', error);
        res.status(500).json({
          success: false,
          error: 'HEALTH_CHECK_ERROR',
          message: 'Failed to check provider health',
        });
      }
    };
  }

  /**
   * Provider-specific handlers
   */
  private async handleGoogleProvider(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    // Google-specific logic
    req.headers['x-provider-type'] = 'google';
    next();
  }

  private async handleMicrosoftProvider(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    // Microsoft/Azure AD-specific logic
    req.headers['x-provider-type'] = 'microsoft';
    next();
  }

  private async handleOktaProvider(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    // Okta-specific logic
    req.headers['x-provider-type'] = 'okta';
    next();
  }

  private async handleAuth0Provider(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    // Auth0-specific logic
    req.headers['x-provider-type'] = 'auth0';
    next();
  }

  private async handleSAMLProvider(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    // SAML-specific logic
    req.headers['x-provider-type'] = 'saml';
    next();
  }

  private async handleLDAPProvider(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    // LDAP-specific logic
    req.headers['x-provider-type'] = 'ldap';
    next();
  }

  private async handleGenericOIDCProvider(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    // Generic OIDC provider logic
    req.headers['x-provider-type'] = 'oidc';
    next();
  }

  /**
   * Helper methods
   */
  private async getProvidersForUser(email?: string, domain?: string): Promise<ProviderConfig[]> {
    const providers = Array.from(this.providerConfigs.values()).filter(config => config.enabled);

    if (!email && !domain) {
      return providers.sort((a, b) => a.priority - b.priority);
    }

    const userDomain = domain || (email ? email.split('@')[1] : null);

    if (!userDomain) {
      return providers.sort((a, b) => a.priority - b.priority);
    }

    // Filter by domain restrictions
    const filteredProviders = providers.filter(config => {
      if (!config.domainRestriction || config.domainRestriction.length === 0) {
        return true; // No domain restriction
      }
      return config.domainRestriction.includes(userDomain);
    });

    return filteredProviders.sort((a, b) => a.priority - b.priority);
  }

  private async selectProviderForEmail(email: string): Promise<ProviderSelection | null> {
    const domain = email.split('@')[1];
    const availableProviders = await this.getProvidersForUser(email);

    if (availableProviders.length === 0) {
      return null;
    }

    // Try to find provider with domain restriction first
    const domainSpecificProvider = availableProviders.find(
      config => config.domainRestriction && config.domainRestriction.includes(domain)
    );

    if (domainSpecificProvider) {
      return {
        provider: domainSpecificProvider,
        reason: 'domain_match',
        confidence: 0.9,
      };
    }

    // Check for company domain patterns
    const companyProvider = await this.detectCompanyProvider(domain);
    if (companyProvider) {
      return {
        provider: companyProvider,
        reason: 'company_detection',
        confidence: 0.8,
      };
    }

    // Fall back to highest priority provider
    return {
      provider: availableProviders[0],
      reason: 'default_priority',
      confidence: 0.5,
    };
  }

  private async detectCompanyProvider(domain: string): Promise<ProviderConfig | null> {
    // Common corporate domain patterns
    const corporatePatterns = {
      microsoft: /\.(microsoft|msft|office|outlook)\.com$/,
      google: /\.(google|gmail|googlemail)\.com$/,
      okta: /\.(okta|oktapreview)\.com$/,
    };

    for (const [providerType, pattern] of Object.entries(corporatePatterns)) {
      if (pattern.test(domain)) {
        const provider = Array.from(this.providerConfigs.values()).find(
          config => config.provider === providerType && config.enabled
        );
        if (provider) {
          return provider;
        }
      }
    }

    return null;
  }

  private async checkProviderEndpoints(config: ProviderConfig): Promise<boolean> {
    try {
      // This would typically check if the provider's endpoints are responding
      // For now, return true for enabled providers
      return config.enabled;
    } catch (error) {
      console.error(`Health check failed for provider ${config.name}:`, error);
      return false;
    }
  }

  private async logProviderEvent(
    providerId: string,
    eventType: string,
    metadata: any
  ): Promise<void> {
    try {
      await this.db.run(
        `
        INSERT INTO provider_events (id, provider_id, event_type, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `,
        [
          crypto.randomUUID(),
          providerId,
          eventType,
          JSON.stringify(metadata),
          new Date().toISOString(),
        ]
      );
    } catch (error) {
      console.error('Failed to log provider event:', error);
    }
  }

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

  /**
   * Refresh provider configurations
   */
  async refreshProviders(): Promise<void> {
    await this.loadProviderConfigs();
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(providerId: string): ProviderConfig | undefined {
    return this.providerConfigs.get(providerId);
  }

  /**
   * Get all provider configurations
   */
  getAllProviderConfigs(): ProviderConfig[] {
    return Array.from(this.providerConfigs.values());
  }
}

export const multiProviderMiddleware = new MultiProviderMiddleware();
