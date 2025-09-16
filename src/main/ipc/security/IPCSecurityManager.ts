/**
 * IPC Security Manager
 * 
 * Provides comprehensive security validation, input sanitization,
 * and access control for IPC communications.
 */

import { z } from 'zod';
import { AppError } from '../../../core/errors/AppError';
import { 
  IPCChannel, 
  IPCErrorCode, 
  IPCError, 
  IPCSchemas,
  BaseIPCRequest
} from '../../../types/ipc';

// ===========================
// Security Configuration
// ===========================

interface SecurityConfig {
  enableChannelWhitelist: boolean;
  enableRateLimiting: boolean;
  enableInputSanitization: boolean;
  enableSchemaValidation: boolean;
  logSecurityEvents: boolean;
  maxRequestSize: number; // in bytes
  requestTimeoutMs: number;
}

interface RateLimitConfig {
  requests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface ValidationResult {
  valid: boolean;
  error?: {
    code: IPCErrorCode;
    message: string;
    details?: any;
  };
  sanitizedArgs?: any[];
  warnings?: string[];
}

// ===========================
// Rate Limiter
// ===========================

class RateLimiter {
  private readonly requests = new Map<string, number[]>();
  
  constructor(private config: RateLimitConfig) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Get existing requests for this key
    let requests = this.requests.get(key) || [];
    
    // Remove expired requests
    requests = requests.filter(time => time > windowStart);
    
    // Check if limit exceeded
    if (requests.length >= this.config.requests) {
      return false;
    }
    
    // Add current request
    requests.push(now);
    this.requests.set(key, requests);
    
    return true;
  }

  getRemainingRequests(key: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(time => time > windowStart);
    
    return Math.max(0, this.config.requests - validRequests.length);
  }

  getResetTime(key: string): number {
    const requests = this.requests.get(key) || [];
    if (requests.length === 0) {
      return Date.now();
    }
    
    return requests[0] + this.config.windowMs;
  }

  clear(key?: string): void {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }
}

// ===========================
// Input Sanitizer
// ===========================

class InputSanitizer {
  private readonly dangerousPatterns = [
    // Script injection
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    // Event handlers
    /on\w+\s*=/gi,
    // JavaScript protocol
    /javascript:/gi,
    // Data URLs (potentially dangerous)
    /data:(?!image\/(?:gif|jpe?g|png|svg|webp))[^,]*,/gi,
    // SQL injection patterns
    /('|(\\)|;|\/\*|\*\/|--|\bor\b|\band\b|\bunion\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bcreate\b|\balter\b)/gi,
    // Path traversal
    /(\.\.[\/\\]){1,}/gi,
    // Command injection
    /[;&|`$(){}[\]]/g
  ];

  private readonly allowedTags = new Set([
    'b', 'i', 'u', 'strong', 'em', 'code', 'pre', 'br', 'p'
  ]);

  sanitize(value: any): { sanitized: any; warnings: string[] } {
    const warnings: string[] = [];
    
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }
    
    if (Array.isArray(value)) {
      return this.sanitizeArray(value);
    }
    
    if (typeof value === 'object' && value !== null) {
      return this.sanitizeObject(value);
    }
    
    return { sanitized: value, warnings };
  }

  private sanitizeString(str: string): { sanitized: string; warnings: string[] } {
    const warnings: string[] = [];
    let sanitized = str;
    
    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(sanitized)) {
        warnings.push(`Potentially dangerous content detected and removed`);
        sanitized = sanitized.replace(pattern, '');
      }
    }
    
    // Limit string length
    if (sanitized.length > 100000) {
      warnings.push('Input truncated due to excessive length');
      sanitized = sanitized.substring(0, 100000) + '...';
    }
    
    // Basic HTML sanitization for user content
    sanitized = this.sanitizeHTML(sanitized);
    
    return { sanitized, warnings };
  }

  private sanitizeHTML(html: string): string {
    // Remove all HTML tags except allowed ones
    return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tagName) => {
      return this.allowedTags.has(tagName.toLowerCase()) ? match : '';
    });
  }

  private sanitizeArray(arr: any[]): { sanitized: any[]; warnings: string[] } {
    const warnings: string[] = [];
    const sanitized: any[] = [];
    
    // Limit array size
    const maxLength = 1000;
    if (arr.length > maxLength) {
      warnings.push(`Array truncated from ${arr.length} to ${maxLength} items`);
      arr = arr.slice(0, maxLength);
    }
    
    for (const item of arr) {
      const result = this.sanitize(item);
      sanitized.push(result.sanitized);
      warnings.push(...result.warnings);
    }
    
    return { sanitized, warnings };
  }

  private sanitizeObject(obj: any): { sanitized: any; warnings: string[] } {
    const warnings: string[] = [];
    const sanitized: any = {};
    
    // Limit object depth and size
    const maxKeys = 100;
    const keys = Object.keys(obj).slice(0, maxKeys);
    
    if (Object.keys(obj).length > maxKeys) {
      warnings.push(`Object keys limited to ${maxKeys}`);
    }
    
    for (const key of keys) {
      // Sanitize key name
      const cleanKey = this.sanitizePropertyName(key);
      
      if (cleanKey !== key) {
        warnings.push(`Property name sanitized: ${key} -> ${cleanKey}`);
      }
      
      // Sanitize value
      const result = this.sanitize(obj[key]);
      sanitized[cleanKey] = result.sanitized;
      warnings.push(...result.warnings);
    }
    
    return { sanitized, warnings };
  }

  private sanitizePropertyName(name: string): string {
    // Only allow alphanumeric characters, underscores, and hyphens
    return name.replace(/[^\w-]/g, '');
  }
}

// ===========================
// Schema Validator
// ===========================

class SchemaValidator {
  private readonly schemas = IPCSchemas;
  
  validateRequest(channel: string, args: any[]): ValidationResult {
    try {
      const schema = this.getSchemaForChannel(channel);
      
      if (!schema) {
        return { valid: true }; // No schema defined, allow request
      }
      
      // Validate the first argument (request payload)
      const payload = args[0] || {};
      schema.parse(payload);
      
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          error: {
            code: IPCErrorCode.VALIDATION_FAILED,
            message: 'Request validation failed',
            details: {
              issues: error.issues.map(issue => ({
                path: issue.path.join('.'),
                message: issue.message,
                code: issue.code
              }))
            }
          }
        };
      }
      
      return {
        valid: false,
        error: {
          code: IPCErrorCode.VALIDATION_FAILED,
          message: 'Validation error occurred',
          details: { originalError: error }
        }
      };
    }
  }

  private getSchemaForChannel(channel: string): z.ZodSchema | null {
    switch (channel) {
      case 'kb:search:local':
      case 'kb:search:ai':
        return this.schemas.KBSearch;
      
      case 'kb:entry:create':
        return this.schemas.KBEntryCreate;
      
      case 'kb:entry:update':
        return this.schemas.KBEntryUpdate;
      
      case 'kb:entry:get':
      case 'kb:entry:delete':
        return this.schemas.EntityId;
      
      case 'system:metrics:get':
        return this.schemas.SystemMetrics;
      
      case 'patterns:detect:run':
        return this.schemas.PatternDetection;
      
      default:
        return null;
    }
  }
}

// ===========================
// Main Security Manager
// ===========================

export class IPCSecurityManager {
  private readonly allowedChannels: Set<IPCChannel>;
  private readonly rateLimiters = new Map<string, RateLimiter>();
  private readonly inputSanitizer: InputSanitizer;
  private readonly schemaValidator: SchemaValidator;
  private readonly securityEvents: Array<{
    timestamp: number;
    type: string;
    channel?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: any;
  }> = [];

  constructor(private config: SecurityConfig = this.getDefaultConfig()) {
    this.allowedChannels = this.initializeAllowedChannels();
    this.inputSanitizer = new InputSanitizer();
    this.schemaValidator = new SchemaValidator();
    
    // Initialize default rate limiters
    this.initializeRateLimiters();
    
    // Start security event cleanup
    this.startSecurityEventCleanup();
  }

  /**
   * Main security validation entry point
   */
  async validateRequest(channel: string, args: any[], context?: {
    userId?: string;
    sessionId?: string;
    clientInfo?: any;
  }): Promise<ValidationResult> {
    const validationStart = Date.now();
    const warnings: string[] = [];
    
    try {
      // 1. Channel whitelist validation
      if (this.config.enableChannelWhitelist && !this.isChannelAllowed(channel)) {
        this.logSecurityEvent('channel_blocked', 'high', {
          channel,
          context
        });
        
        return {
          valid: false,
          error: {
            code: IPCErrorCode.INVALID_CHANNEL,
            message: `Channel '${channel}' is not allowed`
          }
        };
      }

      // 2. Rate limiting check
      if (this.config.enableRateLimiting) {
        const rateLimitResult = this.checkRateLimit(channel, context);
        if (!rateLimitResult.allowed) {
          this.logSecurityEvent('rate_limit_exceeded', 'medium', {
            channel,
            context,
            remainingRequests: rateLimitResult.remainingRequests,
            resetTime: rateLimitResult.resetTime
          });
          
          return {
            valid: false,
            error: {
              code: IPCErrorCode.RATE_LIMIT_EXCEEDED,
              message: `Rate limit exceeded for channel '${channel}'`,
              details: {
                remainingRequests: rateLimitResult.remainingRequests,
                resetTime: rateLimitResult.resetTime
              }
            }
          };
        }
      }

      // 3. Input size validation
      const requestSize = JSON.stringify(args).length;
      if (requestSize > this.config.maxRequestSize) {
        this.logSecurityEvent('request_too_large', 'medium', {
          channel,
          requestSize,
          maxSize: this.config.maxRequestSize
        });
        
        return {
          valid: false,
          error: {
            code: IPCErrorCode.VALIDATION_FAILED,
            message: 'Request payload too large',
            details: { size: requestSize, maxSize: this.config.maxRequestSize }
          }
        };
      }

      // 4. Input sanitization
      let sanitizedArgs = args;
      if (this.config.enableInputSanitization) {
        const sanitizationResult = this.sanitizeInputs(args);
        sanitizedArgs = sanitizationResult.sanitized;
        warnings.push(...sanitizationResult.warnings);
        
        if (sanitizationResult.warnings.length > 0) {
          this.logSecurityEvent('input_sanitized', 'low', {
            channel,
            warnings: sanitizationResult.warnings
          });
        }
      }

      // 5. Schema validation
      if (this.config.enableSchemaValidation) {
        const schemaResult = this.schemaValidator.validateRequest(channel, sanitizedArgs);
        if (!schemaResult.valid) {
          this.logSecurityEvent('schema_validation_failed', 'medium', {
            channel,
            error: schemaResult.error
          });
          
          return schemaResult;
        }
      }

      // 6. Business logic validation
      const businessLogicResult = await this.validateBusinessLogic(channel, sanitizedArgs, context);
      if (!businessLogicResult.valid) {
        return businessLogicResult;
      }

      const validationTime = Date.now() - validationStart;
      
      // Log successful validation if it took too long
      if (validationTime > 100) {
        this.logSecurityEvent('slow_validation', 'low', {
          channel,
          validationTime
        });
      }

      return {
        valid: true,
        sanitizedArgs,
        warnings: warnings.length > 0 ? warnings : undefined
      };
      
    } catch (error) {
      this.logSecurityEvent('validation_error', 'critical', {
        channel,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return {
        valid: false,
        error: {
          code: IPCErrorCode.HANDLER_ERROR,
          message: 'Security validation failed',
          details: { originalError: error }
        }
      };
    }
  }

  /**
   * Check if a channel is allowed
   */
  private isChannelAllowed(channel: string): boolean {
    return this.allowedChannels.has(channel as IPCChannel);
  }

  /**
   * Check rate limits for a request
   */
  private checkRateLimit(channel: string, context?: any): {
    allowed: boolean;
    remainingRequests: number;
    resetTime: number;
  } {
    const key = this.getRateLimitKey(channel, context);
    const limiter = this.rateLimiters.get(channel);
    
    if (!limiter) {
      return { allowed: true, remainingRequests: Infinity, resetTime: 0 };
    }
    
    const allowed = limiter.isAllowed(key);
    const remainingRequests = limiter.getRemainingRequests(key);
    const resetTime = limiter.getResetTime(key);
    
    return { allowed, remainingRequests, resetTime };
  }

  /**
   * Generate rate limit key based on context
   */
  private getRateLimitKey(channel: string, context?: any): string {
    if (context?.userId) {
      return `user:${context.userId}:${channel}`;
    }
    
    if (context?.sessionId) {
      return `session:${context.sessionId}:${channel}`;
    }
    
    return `global:${channel}`;
  }

  /**
   * Sanitize input arguments
   */
  private sanitizeInputs(args: any[]): { sanitized: any[]; warnings: string[] } {
    const warnings: string[] = [];
    const sanitized: any[] = [];
    
    for (const arg of args) {
      const result = this.inputSanitizer.sanitize(arg);
      sanitized.push(result.sanitized);
      warnings.push(...result.warnings);
    }
    
    return { sanitized, warnings };
  }

  /**
   * Business logic validation (override per channel)
   */
  private async validateBusinessLogic(
    channel: string, 
    args: any[], 
    context?: any
  ): Promise<ValidationResult> {
    // Channel-specific business validation
    switch (channel) {
      case 'kb:entry:delete':
        return this.validateEntryDeletion(args, context);
      
      case 'system:database:reset':
        return this.validateDatabaseReset(context);
      
      default:
        return { valid: true };
    }
  }

  /**
   * Validate entry deletion permissions
   */
  private async validateEntryDeletion(args: any[], context?: any): Promise<ValidationResult> {
    // Example business logic: only allow users to delete their own entries
    // or admins to delete any entry
    
    if (!context?.userId) {
      return {
        valid: false,
        error: {
          code: IPCErrorCode.INSUFFICIENT_PERMISSIONS,
          message: 'User authentication required for entry deletion'
        }
      };
    }
    
    // Additional checks would go here...
    return { valid: true };
  }

  /**
   * Validate database reset permissions (should be very restricted)
   */
  private async validateDatabaseReset(context?: any): Promise<ValidationResult> {
    if (!context?.userId || !context?.isAdmin) {
      return {
        valid: false,
        error: {
          code: IPCErrorCode.INSUFFICIENT_PERMISSIONS,
          message: 'Administrative privileges required for database reset'
        }
      };
    }
    
    return { valid: true };
  }

  /**
   * Log security events
   */
  private logSecurityEvent(
    type: string, 
    severity: 'low' | 'medium' | 'high' | 'critical', 
    details: any
  ): void {
    if (!this.config.logSecurityEvents) {
      return;
    }
    
    const event = {
      timestamp: Date.now(),
      type,
      severity,
      details
    };
    
    this.securityEvents.push(event);
    
    // Console logging based on severity
    const logMessage = `Security Event: ${type} (${severity})`;
    switch (severity) {
      case 'critical':
        console.error(logMessage, details);
        break;
      case 'high':
        console.warn(logMessage, details);
        break;
      case 'medium':
        console.info(logMessage, details);
        break;
      case 'low':
        console.debug(logMessage, details);
        break;
    }
  }

  /**
   * Get security metrics and events
   */
  getSecurityMetrics(): {
    totalEvents: number;
    eventsBySeverity: Record<string, number>;
    recentEvents: typeof this.securityEvents;
    rateLimiterStats: Record<string, any>;
  } {
    const eventsBySeverity = this.securityEvents.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const recentEvents = this.securityEvents
      .filter(event => Date.now() - event.timestamp < 24 * 60 * 60 * 1000) // Last 24 hours
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100);
    
    return {
      totalEvents: this.securityEvents.length,
      eventsBySeverity,
      recentEvents,
      rateLimiterStats: this.getRateLimiterStats()
    };
  }

  /**
   * Initialize allowed channels
   */
  private initializeAllowedChannels(): Set<IPCChannel> {
    return new Set([
      // Knowledge Base
      'kb:search:local',
      'kb:search:ai',
      'kb:entry:create',
      'kb:entry:get',
      'kb:entry:update',
      'kb:entry:delete',
      'kb:feedback:rate',
      'kb:templates:load',
      
      // System
      'system:metrics:get',
      'system:database:status',
      'system:cache:invalidate',
      'system:health:check',
      'system:performance:report',
      
      // Patterns (MVP2)
      'patterns:detect:run',
      'patterns:incidents:import',
      'patterns:alerts:get',
      'patterns:rootcause:analyze',
      
      // Import/Export (MVP4)
      'io:export:kb',
      'io:import:kb',
      'io:project:import',
      'io:project:export',
      
      // Window Management
      'window:state:get',
      'window:state:update',
      'window:control:minimize',
      'window:control:maximize',
      'window:control:restore',
      'window:control:close',
      
      // Application
      'app:version:get',
      'app:theme:get',
      'app:theme:set',
      'app:close',
      'app:restart',
      
      // Development (only in dev mode)
      ...(process.env.NODE_ENV === 'development' ? [
        'dev:tools:open',
        'dev:logs:get',
        'dev:cache:clear',
        'dev:database:reset'
      ] as IPCChannel[] : [])
    ]);
  }

  /**
   * Initialize rate limiters for different channels
   */
  private initializeRateLimiters(): void {
    // High-frequency operations
    this.rateLimiters.set('kb:search:local', new RateLimiter({
      requests: 100,
      windowMs: 60 * 1000 // 100 requests per minute
    }));
    
    this.rateLimiters.set('kb:search:ai', new RateLimiter({
      requests: 30,
      windowMs: 60 * 1000 // 30 AI searches per minute
    }));
    
    // Medium-frequency operations
    this.rateLimiters.set('kb:entry:get', new RateLimiter({
      requests: 200,
      windowMs: 60 * 1000 // 200 gets per minute
    }));
    
    // Low-frequency operations
    this.rateLimiters.set('kb:entry:create', new RateLimiter({
      requests: 10,
      windowMs: 60 * 1000 // 10 creates per minute
    }));
    
    this.rateLimiters.set('kb:entry:update', new RateLimiter({
      requests: 20,
      windowMs: 60 * 1000 // 20 updates per minute
    }));
    
    this.rateLimiters.set('kb:entry:delete', new RateLimiter({
      requests: 5,
      windowMs: 60 * 1000 // 5 deletes per minute
    }));
    
    // System operations
    this.rateLimiters.set('system:metrics:get', new RateLimiter({
      requests: 60,
      windowMs: 60 * 1000 // 60 per minute (once per second)
    }));
    
    // Very restricted operations
    this.rateLimiters.set('dev:database:reset', new RateLimiter({
      requests: 1,
      windowMs: 60 * 60 * 1000 // 1 per hour
    }));
  }

  /**
   * Get rate limiter statistics
   */
  private getRateLimiterStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [channel, limiter] of this.rateLimiters.entries()) {
      stats[channel] = {
        // This would be more detailed in a real implementation
        hasLimiter: true
      };
    }
    
    return stats;
  }

  /**
   * Start background cleanup of old security events
   */
  private startSecurityEventCleanup(): void {
    setInterval(() => {
      const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
      const originalLength = this.securityEvents.length;
      
      // Remove events older than cutoff
      const filtered = this.securityEvents.filter(event => event.timestamp > cutoff);
      this.securityEvents.splice(0, this.securityEvents.length, ...filtered);
      
      if (originalLength !== this.securityEvents.length) {
        console.debug(`Cleaned up ${originalLength - this.securityEvents.length} old security events`);
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Get default security configuration
   */
  private getDefaultConfig(): SecurityConfig {
    return {
      enableChannelWhitelist: true,
      enableRateLimiting: true,
      enableInputSanitization: true,
      enableSchemaValidation: true,
      logSecurityEvents: true,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      requestTimeoutMs: 30 * 1000 // 30 seconds
    };
  }

  /**
   * Update security configuration
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Clear rate limiters (useful for testing)
   */
  clearRateLimiters(): void {
    for (const limiter of this.rateLimiters.values()) {
      limiter.clear();
    }
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this.rateLimiters.clear();
    this.securityEvents.length = 0;
  }
}