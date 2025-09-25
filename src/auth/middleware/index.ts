// Export all middleware components
export { 
  SSOJWTMiddleware, 
  ssoJWTMiddleware, 
  AuthenticatedRequest, 
  SSOJWTPayload 
} from './SSOJWTMiddleware';

export { 
  TokenValidationMiddleware, 
  tokenValidation, 
  TokenValidationOptions, 
  TokenValidationResult 
} from './TokenValidationMiddleware';

export { 
  RouteProtectionMiddleware, 
  routeProtection, 
  RoutePermission, 
  ProtectionOptions 
} from './RouteProtectionMiddleware';

export { 
  AuthRateLimitMiddleware, 
  authRateLimit, 
  RateLimitRule, 
  RateLimitInfo 
} from './AuthRateLimitMiddleware';

export { 
  SessionMiddleware, 
  sessionMiddleware, 
  SessionConfig, 
  SessionInfo, 
  DeviceInfo, 
  LocationInfo 
} from './SessionMiddleware';

export { 
  SecurityHeadersMiddleware, 
  securityHeaders, 
  SecurityHeadersConfig 
} from './SecurityHeadersMiddleware';

export { 
  CORSMiddleware, 
  corsMiddleware, 
  CORSConfig 
} from './CORSMiddleware';

export { 
  MultiProviderMiddleware, 
  multiProviderMiddleware, 
  ProviderConfig, 
  ProviderSelection 
} from './MultiProviderMiddleware';

export { 
  ErrorHandlingMiddleware, 
  errorHandling, 
  AuthError, 
  ErrorContext 
} from './ErrorHandlingMiddleware';

// Export middleware composition utilities
export * from './MiddlewareComposer';