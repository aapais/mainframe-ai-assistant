# SSO Middleware System

Complete Express.js SSO middleware system with OAuth2/OIDC support, JWT authentication, route protection, rate limiting, session management, security headers, CORS configuration, and multi-provider support.

## Features

- **JWT Authentication**: Complete JWT token validation with refresh token handling
- **Multi-Provider SSO**: Support for Google, Microsoft, Azure AD, Okta, Auth0, SAML, LDAP, and generic OIDC
- **Route Protection**: Role-based and permission-based access control
- **Rate Limiting**: Comprehensive rate limiting for authentication endpoints
- **Session Management**: Advanced session management with device tracking and security monitoring
- **Security Headers**: Complete set of security headers (CSP, HSTS, etc.)
- **CORS Configuration**: Flexible CORS handling for SSO and API endpoints
- **Error Handling**: Comprehensive error handling with logging and security event tracking
- **Middleware Composition**: Easy-to-use middleware chain composition utilities

## Quick Start

```typescript
import express from 'express';
import { createAuthChain, createSSOChain, createAPIChain } from './auth/middleware';

const app = express();

// Apply SSO middleware to auth routes
app.use('/api/auth/sso', ...createSSOChain());

// Apply login middleware
app.use('/api/auth/login', ...createLoginChain());

// Apply API protection to protected routes
app.use('/api/protected', ...createAPIChain({
  roles: ['user', 'admin'],
  permissions: ['read', 'write']
}));

// Apply admin-only protection
app.use('/api/admin', ...createAdminChain());
```

## Middleware Components

### 1. SSOJWTMiddleware

Core JWT authentication middleware with OAuth2/OIDC support.

```typescript
import { ssoJWTMiddleware } from './auth/middleware';

// Required authentication
app.use(ssoJWTMiddleware.authenticate());

// Optional authentication
app.use(ssoJWTMiddleware.optionalAuth());

// Refresh token endpoint
app.post('/auth/refresh', ssoJWTMiddleware.refreshToken());
```

### 2. TokenValidationMiddleware

Advanced token validation with custom options.

```typescript
import { tokenValidation } from './auth/middleware';

// Standard validation
app.use(tokenValidation.validate());

// Strict validation with MFA requirement
app.use(tokenValidation.validate({
  requireMFA: true,
  maxAge: 3600,
  validateScope: ['read', 'write']
}));

// Refresh token validation
app.use(tokenValidation.validateRefreshToken());
```

### 3. RouteProtectionMiddleware

Role-based and permission-based access control.

```typescript
import { routeProtection } from './auth/middleware';

// Role-based protection
app.use(routeProtection.requireRole('admin'));
app.use(routeProtection.requireRole(['user', 'analyst']));

// Permission-based protection
app.use(routeProtection.requirePermission('incidents:read'));

// Combined protection
app.use(routeProtection.requireRoleAndPermission(['admin'], ['system:admin']));

// Ownership-based protection
app.use(routeProtection.requireOwnership('userId'));

// Admin-only access
app.use(routeProtection.requireAdmin());

// MFA requirement
app.use(routeProtection.requireMFA());
```

### 4. AuthRateLimitMiddleware

Comprehensive rate limiting for authentication endpoints.

```typescript
import { authRateLimit } from './auth/middleware';

// General auth rate limiting
app.use(authRateLimit.auth());

// Login attempts rate limiting
app.use('/auth/login', authRateLimit.login());

// Password reset rate limiting
app.use('/auth/reset', authRateLimit.passwordReset());

// MFA attempts rate limiting
app.use('/auth/mfa', authRateLimit.mfa());

// Token refresh rate limiting
app.use('/auth/refresh', authRateLimit.tokenRefresh());

// SSO callback rate limiting
app.use('/auth/sso/callback', authRateLimit.ssoCallback());

// User-specific rate limiting
app.use(authRateLimit.userSpecific(1000, 60000)); // 1000 requests per minute

// Role-based rate limiting
app.use(authRateLimit.roleBasedLimit({
  user: { max: 100, windowMs: 60000 },
  admin: { max: 1000, windowMs: 60000 }
}));
```

### 5. SessionMiddleware

Advanced session management with device tracking and security monitoring.

```typescript
import { sessionMiddleware } from './auth/middleware';

// Standard session management
app.use(sessionMiddleware().manage());

// Strict session management
app.use(sessionMiddleware({
  strictIpValidation: true,
  logoutOnSuspiciousActivity: true,
  maxConcurrentSessions: 1,
  trackDevices: true,
  trackLocation: true
}).manage());
```

### 6. SecurityHeadersMiddleware

Comprehensive security headers configuration.

```typescript
import { securityHeaders } from './auth/middleware';

// Standard security headers
app.use(securityHeaders.standard.apply());

// Auth-specific headers
app.use('/auth', securityHeaders.auth.applyForAuth());

// API-specific headers
app.use('/api', securityHeaders.api.applyForAPI());

// Development headers (less strict)
app.use(securityHeaders.development.apply());
```

### 7. CORSMiddleware

Flexible CORS configuration for different endpoint types.

```typescript
import { corsMiddleware } from './auth/middleware';

// Standard CORS
app.use(corsMiddleware.standard.apply());

// SSO-specific CORS
app.use('/auth/sso', corsMiddleware.sso.applyForSSO());

// Auth-specific CORS
app.use('/auth', corsMiddleware.standard.applyForAuth());

// API-specific CORS
app.use('/api', corsMiddleware.standard.applyForAPI());
```

### 8. MultiProviderMiddleware

Multi-provider SSO support with automatic provider selection.

```typescript
import { multiProviderMiddleware } from './auth/middleware';

// Get available providers
app.get('/auth/providers', multiProviderMiddleware.getAvailableProviders());

// Auto-select provider based on email domain
app.use(multiProviderMiddleware.autoSelectProvider());

// Validate provider configuration
app.use(multiProviderMiddleware.validateProvider());

// Route to appropriate provider handler
app.use(multiProviderMiddleware.routeToProvider());

// Handle provider-specific callbacks
app.use('/auth/sso/callback/:providerId', multiProviderMiddleware.handleProviderCallback());

// Provider health check
app.get('/auth/providers/health', multiProviderMiddleware.checkProviderHealth());
```

### 9. ErrorHandlingMiddleware

Comprehensive error handling with logging and security event tracking.

```typescript
import { errorHandling } from './auth/middleware';

// Main error handler (should be last middleware)
app.use(errorHandling.handle());

// JWT-specific error handler
app.use(errorHandling.handleJWTErrors());

// SSO-specific error handler
app.use(errorHandling.handleSSOErrors());

// Rate limit error handler
app.use(errorHandling.handleRateLimitErrors());

// 404 handler
app.use(errorHandling.handleNotFound());
```

## Middleware Composition

Use the `MiddlewareComposer` for easy middleware chain creation:

```typescript
import { MiddlewareComposer, createAuthChain } from './auth/middleware';

// Custom middleware chain
const customChain = createAuthChain({
  cors: 'api',
  security: 'standard',
  rateLimit: 'auth',
  authentication: 'required',
  validation: 'strict',
  session: 'standard',
  protection: {
    roles: ['admin'],
    requireMFA: true
  },
  errors: true
});

app.use('/secure-endpoint', ...customChain);

// Pre-configured chains
app.use('/api/auth/sso', ...createSSOChain());
app.use('/api/auth/login', ...createLoginChain());
app.use('/api/protected', ...createAPIChain());
app.use('/api/admin', ...createAdminChain());
app.use('/public', ...createPublicChain());
app.use('/auth/refresh', ...createRefreshChain());
app.use('/mfa-protected', ...createMFAChain());
```

## Configuration

### Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
TRUSTED_DOMAINS=yourdomain.com,*.yourdomain.com
SSO_ORIGINS=https://accounts.google.com,https://login.microsoftonline.com

# Rate Limiting
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME=900000

# Security
MASTER_KEY=your-master-encryption-key
KEY_SALT=your-key-salt

# Session Configuration
SESSION_SECRET=your-session-secret
SESSION_MAX_AGE=86400000
```

### Database Setup

The middleware system requires several database tables. Run the setup methods:

```typescript
import { ssoService } from './auth/sso/SSOService';
import { secureKeyManager } from './auth/services/SecureKeyManager';

// Setup database tables
await ssoService.setupDatabase();
await secureKeyManager.setupDatabase();
```

## Integration with Existing Services

The middleware integrates seamlessly with existing services:

- **SecureKeyManager**: For API key encryption and user preferences
- **SSOService**: For SSO provider configuration and user management
- **UserSchema**: For user validation and type safety
- **DatabaseManager**: For database operations
- **RedisCache**: For caching and session storage

## Security Features

- **JWT Security**: Secure token generation with proper expiration and blacklisting
- **Session Security**: Device tracking, IP validation, and suspicious activity detection
- **Rate Limiting**: Multiple rate limiting strategies to prevent abuse
- **CORS Protection**: Flexible CORS policies for different endpoint types
- **Security Headers**: Complete set of security headers following best practices
- **Error Handling**: Secure error responses that don't leak sensitive information
- **Audit Logging**: Comprehensive logging of all authentication events

## Performance Features

- **Caching**: Redis-based caching for sessions and frequently accessed data
- **Connection Pooling**: Efficient database connection management
- **Token Validation**: Fast token validation with caching
- **Rate Limiting**: Efficient rate limiting with minimal overhead
- **Middleware Composition**: Optimized middleware chains to reduce processing overhead

## Testing

The middleware system includes comprehensive testing utilities:

```typescript
import { testAuthMiddleware } from './auth/middleware/testing';

// Test middleware chains
const testResult = await testAuthMiddleware({
  middleware: createAPIChain(),
  user: mockUser,
  request: mockRequest
});
```

## Monitoring and Metrics

- **Authentication Metrics**: Track login success rates, token usage, provider performance
- **Security Events**: Monitor suspicious activities, rate limit violations, failed attempts
- **Performance Metrics**: Track middleware performance, response times, error rates
- **Provider Health**: Monitor SSO provider availability and response times

## Best Practices

1. **Always use HTTPS** in production environments
2. **Configure proper CORS** policies for your domains
3. **Set up proper rate limiting** to prevent abuse
4. **Enable security headers** for all endpoints
5. **Monitor authentication metrics** and security events
6. **Regularly rotate JWT secrets** and API keys
7. **Use strict session validation** for sensitive operations
8. **Implement proper error handling** to avoid information leakage
9. **Test middleware chains** thoroughly before deployment
10. **Keep provider configurations** up to date

## Troubleshooting

### Common Issues

1. **CORS Errors**: Check your CORS configuration and allowed origins
2. **JWT Errors**: Verify JWT secrets and token expiration settings
3. **Rate Limit Issues**: Adjust rate limits for your use case
4. **Provider Errors**: Check SSO provider configurations and credentials
5. **Session Issues**: Verify session configuration and Redis connectivity

### Debug Mode

Enable debug logging by setting `DEBUG=auth:*` environment variable.

## License

This middleware system is part of the Mainframe AI Assistant project.
