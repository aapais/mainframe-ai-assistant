/**
 * SSO Configuration Validator
 * Validates all SSO-related environment variables and configurations
 * Provides secure fallbacks and initialization checks
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

class SSOConfigValidator {
    constructor() {
        this.validationErrors = [];
        this.warnings = [];
        this.config = {};
        this.logger = this.initializeLogger();
    }

    initializeLogger() {
        return winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: process.env.SECURITY_LOG_PATH || './logs/security.log'
                })
            ]
        });
    }

    /**
     * Main validation function - validates all SSO configurations
     */
    async validateConfiguration() {
        this.logger.info('Starting SSO configuration validation');

        try {
            // Basic application settings
            this.validateBasicSettings();

            // Security settings validation
            this.validateSecuritySettings();

            // SSO Providers validation
            this.validateSSOProviders();

            // Rate limiting and session settings
            this.validateRateLimiting();

            // Monitoring and logging
            this.validateMonitoring();

            // CORS and security headers
            this.validateSecurity();

            // Compliance settings
            this.validateCompliance();

            // Generate validation report
            const report = this.generateValidationReport();

            if (this.validationErrors.length > 0) {
                this.logger.error('SSO configuration validation failed', {
                    errors: this.validationErrors
                });
                throw new Error(`Configuration validation failed: ${this.validationErrors.join(', ')}`);
            }

            this.logger.info('SSO configuration validation completed successfully', {
                warnings: this.warnings.length,
                validatedProviders: this.getEnabledProviders()
            });

            return { success: true, warnings: this.warnings, config: this.config, report };

        } catch (error) {
            this.logger.error('Configuration validation error', { error: error.message });
            throw error;
        }
    }

    validateBasicSettings() {
        const required = ['NODE_ENV', 'PORT', 'APP_URL'];

        required.forEach(key => {
            if (!process.env[key]) {
                this.validationErrors.push(`Missing required environment variable: ${key}`);
            }
        });

        // Validate NODE_ENV
        const validEnvironments = ['development', 'staging', 'production'];
        if (process.env.NODE_ENV && !validEnvironments.includes(process.env.NODE_ENV)) {
            this.validationErrors.push(`Invalid NODE_ENV: ${process.env.NODE_ENV}. Must be one of: ${validEnvironments.join(', ')}`);
        }

        // Validate PORT
        const port = parseInt(process.env.PORT);
        if (isNaN(port) || port < 1 || port > 65535) {
            this.validationErrors.push(`Invalid PORT: ${process.env.PORT}. Must be a number between 1-65535`);
        }

        // Validate APP_URL format
        if (process.env.APP_URL && !this.isValidUrl(process.env.APP_URL)) {
            this.validationErrors.push(`Invalid APP_URL format: ${process.env.APP_URL}`);
        }

        // Production-specific validations
        if (process.env.NODE_ENV === 'production') {
            if (process.env.APP_URL && !process.env.APP_URL.startsWith('https://')) {
                this.validationErrors.push('APP_URL must use HTTPS in production');
            }
        }
    }

    validateSecuritySettings() {
        // JWT Secret validation
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            this.validationErrors.push('JWT_SECRET is required');
        } else if (jwtSecret.length < 32) {
            this.validationErrors.push('JWT_SECRET must be at least 32 characters long');
        } else if (this.isWeakSecret(jwtSecret)) {
            this.validationErrors.push('JWT_SECRET is too weak. Use a cryptographically secure random string');
        }

        // Refresh token secret
        const refreshSecret = process.env.JWT_REFRESH_SECRET;
        if (!refreshSecret) {
            this.validationErrors.push('JWT_REFRESH_SECRET is required');
        } else if (refreshSecret.length < 32) {
            this.validationErrors.push('JWT_REFRESH_SECRET must be at least 32 characters long');
        }

        // Master encryption key
        const masterKey = process.env.MASTER_KEY;
        if (!masterKey) {
            this.validationErrors.push('MASTER_KEY is required for data encryption');
        } else if (masterKey.length !== 64) { // 32 bytes = 64 hex chars
            this.validationErrors.push('MASTER_KEY must be exactly 64 hexadecimal characters (32 bytes)');
        } else if (!/^[0-9a-fA-F]{64}$/.test(masterKey)) {
            this.validationErrors.push('MASTER_KEY must be a valid hexadecimal string');
        }

        // Session secret
        const sessionSecret = process.env.SESSION_SECRET;
        if (!sessionSecret) {
            this.validationErrors.push('SESSION_SECRET is required');
        } else if (sessionSecret.length < 32) {
            this.validationErrors.push('SESSION_SECRET must be at least 32 characters long');
        }

        // CSRF secret
        if (process.env.FEATURE_CSRF_ENABLED === 'true' && !process.env.CSRF_SECRET) {
            this.validationErrors.push('CSRF_SECRET is required when CSRF protection is enabled');
        }

        // Validate JWT expiration times
        const jwtExpiry = process.env.JWT_EXPIRES_IN || '15m';
        const refreshExpiry = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

        if (!this.isValidTimeExpression(jwtExpiry)) {
            this.validationErrors.push(`Invalid JWT_EXPIRES_IN format: ${jwtExpiry}`);
        }

        if (!this.isValidTimeExpression(refreshExpiry)) {
            this.validationErrors.push(`Invalid JWT_REFRESH_EXPIRES_IN format: ${refreshExpiry}`);
        }
    }

    validateSSOProviders() {
        const enabledProviders = [];

        // Google SSO validation
        if (this.isProviderConfigured('GOOGLE')) {
            const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
            if (this.validateProviderConfig('Google', required)) {
                enabledProviders.push('google');

                // Validate Google Client ID format
                if (!process.env.GOOGLE_CLIENT_ID.includes('.apps.googleusercontent.com')) {
                    this.warnings.push('Google Client ID should end with .apps.googleusercontent.com');
                }

                // Validate redirect URI
                if (!this.isValidCallbackUrl(process.env.GOOGLE_REDIRECT_URI, 'google')) {
                    this.validationErrors.push('Invalid Google redirect URI format');
                }
            }
        }

        // Microsoft Azure AD validation
        if (this.isProviderConfigured('AZURE')) {
            const required = ['AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_TENANT_ID', 'AZURE_REDIRECT_URI'];
            if (this.validateProviderConfig('Azure AD', required)) {
                enabledProviders.push('azure');

                // Validate tenant ID format (UUID)
                if (!this.isValidUUID(process.env.AZURE_TENANT_ID)) {
                    this.validationErrors.push('AZURE_TENANT_ID must be a valid UUID');
                }
            }
        }

        // Okta validation
        if (this.isProviderConfigured('OKTA')) {
            const required = ['OKTA_DOMAIN', 'OKTA_CLIENT_ID', 'OKTA_CLIENT_SECRET', 'OKTA_REDIRECT_URI'];
            if (this.validateProviderConfig('Okta', required)) {
                enabledProviders.push('okta');

                // Validate Okta domain format
                if (!process.env.OKTA_DOMAIN.includes('.okta.com')) {
                    this.warnings.push('Okta domain should typically end with .okta.com');
                }
            }
        }

        // Auth0 validation
        if (this.isProviderConfigured('AUTH0')) {
            const required = ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'AUTH0_CALLBACK_URL'];
            if (this.validateProviderConfig('Auth0', required)) {
                enabledProviders.push('auth0');

                // Validate Auth0 domain format
                if (!process.env.AUTH0_DOMAIN.includes('.auth0.com')) {
                    this.warnings.push('Auth0 domain should typically end with .auth0.com');
                }
            }
        }

        // SAML validation
        if (this.isProviderConfigured('SAML')) {
            const required = ['SAML_ENTRY_POINT', 'SAML_ISSUER', 'SAML_CALLBACK_URL'];
            if (this.validateProviderConfig('SAML', required)) {
                enabledProviders.push('saml');

                // Check certificate files exist
                const certPaths = ['SAML_CERT_PATH', 'SAML_PRIVATE_KEY_PATH', 'SAML_IDP_CERT_PATH'];
                certPaths.forEach(pathVar => {
                    const certPath = process.env[pathVar];
                    if (certPath && !fs.existsSync(certPath)) {
                        this.validationErrors.push(`SAML certificate file not found: ${certPath}`);
                    }
                });
            }
        }

        // LDAP validation
        if (this.isProviderConfigured('LDAP')) {
            const required = ['LDAP_URL', 'LDAP_BIND_DN', 'LDAP_BIND_CREDENTIALS', 'LDAP_SEARCH_BASE'];
            if (this.validateProviderConfig('LDAP', required)) {
                enabledProviders.push('ldap');

                // Validate LDAP URL format
                if (!process.env.LDAP_URL.match(/^ldaps?:\/\/.+:\d+$/)) {
                    this.validationErrors.push('LDAP_URL must be in format ldap://host:port or ldaps://host:port');
                }
            }
        }

        // Ensure at least one provider is configured
        if (enabledProviders.length === 0 && process.env.FEATURE_SSO_ENABLED === 'true') {
            this.validationErrors.push('No SSO providers are properly configured, but SSO is enabled');
        }

        this.config.enabledProviders = enabledProviders;
    }

    validateRateLimiting() {
        // General rate limiting
        const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS);
        const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS);

        if (isNaN(windowMs) || windowMs < 1000) {
            this.warnings.push('RATE_LIMIT_WINDOW_MS should be at least 1000ms');
        }

        if (isNaN(maxRequests) || maxRequests < 1) {
            this.warnings.push('RATE_LIMIT_MAX_REQUESTS should be a positive number');
        }

        // Auth rate limiting
        const authWindowMs = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS);
        const authMaxAttempts = parseInt(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS);

        if (isNaN(authWindowMs) || authWindowMs < 60000) {
            this.warnings.push('AUTH_RATE_LIMIT_WINDOW_MS should be at least 60000ms (1 minute)');
        }

        if (isNaN(authMaxAttempts) || authMaxAttempts > 10) {
            this.warnings.push('AUTH_RATE_LIMIT_MAX_ATTEMPTS should not exceed 10 for security');
        }

        // Session configuration
        const sessionMaxAge = parseInt(process.env.SESSION_MAX_AGE);
        if (isNaN(sessionMaxAge) || sessionMaxAge < 60000) {
            this.warnings.push('SESSION_MAX_AGE should be at least 60000ms (1 minute)');
        }

        // Production-specific rate limiting checks
        if (process.env.NODE_ENV === 'production') {
            if (maxRequests > 1000) {
                this.warnings.push('Consider lowering RATE_LIMIT_MAX_REQUESTS in production for better security');
            }

            if (authMaxAttempts > 5) {
                this.warnings.push('Consider lowering AUTH_RATE_LIMIT_MAX_ATTEMPTS in production');
            }
        }
    }

    validateMonitoring() {
        // Logging configuration
        const logLevel = process.env.LOG_LEVEL;
        const validLogLevels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];

        if (logLevel && !validLogLevels.includes(logLevel)) {
            this.validationErrors.push(`Invalid LOG_LEVEL: ${logLevel}. Must be one of: ${validLogLevels.join(', ')}`);
        }

        // Check log file paths exist or can be created
        const logPaths = [
            'LOG_FILE_PATH',
            'SECURITY_LOG_PATH',
            'AUDIT_LOG_PATH'
        ];

        logPaths.forEach(pathVar => {
            const logPath = process.env[pathVar];
            if (logPath) {
                const logDir = path.dirname(logPath);
                if (!fs.existsSync(logDir)) {
                    try {
                        fs.mkdirSync(logDir, { recursive: true });
                    } catch (error) {
                        this.validationErrors.push(`Cannot create log directory: ${logDir}`);
                    }
                }
            }
        });

        // External monitoring services
        const monitoringServices = ['SENTRY_DSN', 'NEW_RELIC_LICENSE_KEY', 'DATADOG_API_KEY'];
        let configuredServices = 0;

        monitoringServices.forEach(service => {
            if (process.env[service]) {
                configuredServices++;
            }
        });

        if (process.env.NODE_ENV === 'production' && configuredServices === 0) {
            this.warnings.push('No external monitoring services configured for production');
        }
    }

    validateSecurity() {
        // CORS validation
        const corsOrigin = process.env.CORS_ORIGIN;
        if (corsOrigin) {
            const origins = corsOrigin.split(',');
            origins.forEach(origin => {
                if (origin.trim() !== '*' && !this.isValidUrl(origin.trim())) {
                    this.validationErrors.push(`Invalid CORS origin: ${origin.trim()}`);
                }
            });

            if (process.env.NODE_ENV === 'production' && corsOrigin.includes('*')) {
                this.warnings.push('Wildcard CORS origins should be avoided in production');
            }
        }

        // Security headers validation
        if (process.env.SECURITY_HEADERS_ENABLED === 'true') {
            const hstsMaxAge = parseInt(process.env.HSTS_MAX_AGE);
            if (isNaN(hstsMaxAge) || hstsMaxAge < 300) {
                this.warnings.push('HSTS_MAX_AGE should be at least 300 seconds');
            }
        }

        // Content Security Policy
        if (process.env.CSP_ENABLED === 'true' && !process.env.CSP_REPORT_URI) {
            this.warnings.push('CSP_REPORT_URI should be configured when CSP is enabled');
        }

        // Cookie security settings
        if (process.env.NODE_ENV === 'production') {
            if (process.env.SESSION_COOKIE_SECURE !== 'true') {
                this.validationErrors.push('SESSION_COOKIE_SECURE must be true in production');
            }

            if (process.env.SESSION_COOKIE_HTTPONLY !== 'true') {
                this.validationErrors.push('SESSION_COOKIE_HTTPONLY must be true for security');
            }
        }
    }

    validateCompliance() {
        // GDPR compliance checks
        if (process.env.GDPR_COMPLIANCE_ENABLED === 'true') {
            const required = ['PRIVACY_POLICY_URL', 'TERMS_OF_SERVICE_URL'];
            required.forEach(url => {
                if (!process.env[url]) {
                    this.validationErrors.push(`${url} is required when GDPR compliance is enabled`);
                } else if (!this.isValidUrl(process.env[url])) {
                    this.validationErrors.push(`Invalid URL format for ${url}`);
                }
            });

            // Data retention validation
            const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS);
            if (isNaN(retentionDays) || retentionDays < 1) {
                this.validationErrors.push('DATA_RETENTION_DAYS must be a positive number');
            }
        }
    }

    // Helper methods
    isProviderConfigured(prefix) {
        const requiredVars = this.getProviderVars(prefix);
        return requiredVars.some(varName => process.env[varName]);
    }

    getProviderVars(prefix) {
        const allEnvVars = Object.keys(process.env);
        return allEnvVars.filter(varName => varName.startsWith(prefix + '_'));
    }

    validateProviderConfig(providerName, requiredVars) {
        const missing = requiredVars.filter(varName => !process.env[varName]);
        if (missing.length > 0) {
            this.validationErrors.push(`${providerName} SSO: Missing required variables: ${missing.join(', ')}`);
            return false;
        }
        return true;
    }

    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    isValidUUID(str) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
    }

    isValidCallbackUrl(url, provider) {
        if (!this.isValidUrl(url)) return false;

        const expectedPath = `/auth/${provider}/callback`;
        const urlObj = new URL(url);
        return urlObj.pathname === expectedPath;
    }

    isValidTimeExpression(timeStr) {
        // Validates expressions like "15m", "1h", "7d", "30s"
        const timeRegex = /^\d+[smhd]$/;
        return timeRegex.test(timeStr);
    }

    isWeakSecret(secret) {
        // Check for common weak patterns
        const weakPatterns = [
            /^(password|secret|key|token|auth)/i,
            /123456/,
            /qwerty/i,
            /abc/i,
            /^(.)\1+$/, // repeated characters
        ];

        return weakPatterns.some(pattern => pattern.test(secret));
    }

    getEnabledProviders() {
        return this.config.enabledProviders || [];
    }

    generateValidationReport() {
        return {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            validationStatus: this.validationErrors.length === 0 ? 'PASSED' : 'FAILED',
            errorsCount: this.validationErrors.length,
            warningsCount: this.warnings.length,
            enabledProviders: this.getEnabledProviders(),
            errors: this.validationErrors,
            warnings: this.warnings,
            securityFeatures: {
                rateLimiting: process.env.FEATURE_RATE_LIMITING === 'true',
                mfa: process.env.FEATURE_MFA_ENABLED === 'true',
                auditLogging: process.env.FEATURE_AUDIT_LOGGING === 'true',
                emailVerification: process.env.FEATURE_EMAIL_VERIFICATION === 'true',
                passwordComplexity: process.env.FEATURE_PASSWORD_COMPLEXITY === 'true',
                sessionManagement: process.env.FEATURE_SESSION_MANAGEMENT === 'true',
                gdprCompliance: process.env.GDPR_COMPLIANCE_ENABLED === 'true'
            }
        };
    }

    /**
     * Generate secure fallback configurations for missing values
     */
    generateSecureFallbacks() {
        const fallbacks = {};

        // Generate secure JWT secrets if missing
        if (!process.env.JWT_SECRET) {
            fallbacks.JWT_SECRET = this.generateSecureSecret(64);
            this.warnings.push('Generated fallback JWT_SECRET - should be replaced with permanent value');
        }

        if (!process.env.JWT_REFRESH_SECRET) {
            fallbacks.JWT_REFRESH_SECRET = this.generateSecureSecret(64);
            this.warnings.push('Generated fallback JWT_REFRESH_SECRET - should be replaced with permanent value');
        }

        // Generate master encryption key if missing
        if (!process.env.MASTER_KEY) {
            fallbacks.MASTER_KEY = crypto.randomBytes(32).toString('hex');
            this.warnings.push('Generated fallback MASTER_KEY - should be replaced with permanent value');
        }

        // Generate session secret if missing
        if (!process.env.SESSION_SECRET) {
            fallbacks.SESSION_SECRET = this.generateSecureSecret(32);
            this.warnings.push('Generated fallback SESSION_SECRET - should be replaced with permanent value');
        }

        // Generate CSRF secret if needed
        if (process.env.FEATURE_CSRF_ENABLED === 'true' && !process.env.CSRF_SECRET) {
            fallbacks.CSRF_SECRET = this.generateSecureSecret(32);
            this.warnings.push('Generated fallback CSRF_SECRET - should be replaced with permanent value');
        }

        return fallbacks;
    }

    generateSecureSecret(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
}

module.exports = SSOConfigValidator;