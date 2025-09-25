/**
 * Advanced Rate Limiter with Threat-Aware Scaling
 * Intelligent rate limiting with dynamic thresholds and behavioral analysis
 */

import { EventEmitter } from 'events';
import { AuditService } from '../audit/AuditService';

export interface RateLimitRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: RateLimitCondition[];
  limits: RateLimit[];
  actions: RateLimitAction[];
  exemptions: string[];
  metadata: Record<string, any>;
}

export interface RateLimitCondition {
  field: string; // 'ip', 'user', 'endpoint', 'user-agent', etc.
  operator: 'equals' | 'contains' | 'regex' | 'in' | 'startsWith';
  value: any;
  weight: number; // For complex conditions
}

export interface RateLimit {
  window: number; // seconds
  maxRequests: number;
  burstLimit: number;
  type: 'sliding' | 'fixed' | 'token-bucket' | 'leaky-bucket';
  resetBehavior: 'immediate' | 'gradual' | 'exponential';
}

export interface RateLimitAction {
  type: 'block' | 'delay' | 'throttle' | 'alert' | 'captcha';
  duration?: number; // seconds
  config: Record<string, any>;
}

export interface RateLimitBucket {
  key: string;
  tokens: number;
  capacity: number;
  refillRate: number;
  lastRefill: Date;
  locked: boolean;
  lockExpiry?: Date;
  requestCount: number;
  firstRequest: Date;
  lastRequest: Date;
  violations: ViolationRecord[];
  riskScore: number;
}

export interface ViolationRecord {
  timestamp: Date;
  violationType: 'RATE_EXCEEDED' | 'BURST_EXCEEDED' | 'SUSPICIOUS_PATTERN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: Record<string, any>;
  action: string;
}

export interface RequestContext {
  ipAddress: string;
  userId?: string;
  endpoint: string;
  method: string;
  userAgent?: string;
  timestamp: Date;
  riskScore?: number;
  metadata?: Record<string, any>;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: Date;
  retryAfter?: number;
  reason?: string;
  ruleId?: string;
  action?: RateLimitAction;
  riskScore: number;
}

export interface ThreatContext {
  ipReputation: number;
  userRiskScore: number;
  recentViolations: number;
  behaviorScore: number;
  geographicRisk: number;
}

export class AdvancedRateLimit extends EventEmitter {
  private rules: Map<string, RateLimitRule> = new Map();
  private buckets: Map<string, RateLimitBucket> = new Map();
  private patternAnalyzer: PatternAnalyzer;
  private threatAdjuster: ThreatAdjuster;
  private cleanupInterval = 5 * 60 * 1000; // 5 minutes
  private analysisInterval = 60 * 1000; // 1 minute

  constructor(
    private auditService: AuditService,
    private config: RateLimitConfig
  ) {
    super();
    this.patternAnalyzer = new PatternAnalyzer();
    this.threatAdjuster = new ThreatAdjuster(config);
    this.setupPeriodicTasks();
    this.loadDefaultRules();
  }

  /**
   * Add a new rate limit rule
   */
  addRule(rule: Omit<RateLimitRule, 'id'>): string {
    const ruleId = crypto.randomUUID();
    const completeRule: RateLimitRule = {
      id: ruleId,
      ...rule,
    };

    this.rules.set(ruleId, completeRule);
    this.emit('ruleAdded', completeRule);

    return ruleId;
  }

  /**
   * Remove a rate limit rule
   */
  removeRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    this.rules.delete(ruleId);
    this.emit('ruleRemoved', { ruleId, rule });

    return true;
  }

  /**
   * Check rate limit for a request
   */
  async checkRateLimit(request: RequestContext): Promise<RateLimitResult> {
    // Find applicable rules
    const applicableRules = this.findApplicableRules(request);

    if (applicableRules.length === 0) {
      return {
        allowed: true,
        remainingRequests: Infinity,
        resetTime: new Date(Date.now() + 3600000),
        riskScore: request.riskScore || 0,
      };
    }

    // Sort by priority
    applicableRules.sort((a, b) => a.priority - b.priority);

    // Check each rule
    for (const rule of applicableRules) {
      const result = await this.checkRule(rule, request);

      if (!result.allowed) {
        // Log violation
        await this.logViolation(rule, request, result);

        // Execute actions
        await this.executeActions(rule, request, result);

        return result;
      }
    }

    // All checks passed
    return {
      allowed: true,
      remainingRequests: this.calculateRemainingRequests(applicableRules, request),
      resetTime: this.calculateResetTime(applicableRules),
      riskScore: request.riskScore || 0,
    };
  }

  /**
   * Get current rate limit status for a key
   */
  getRateLimitStatus(key: string): RateLimitBucket | null {
    return this.buckets.get(key) || null;
  }

  /**
   * Get high-risk buckets
   */
  getHighRiskBuckets(): Array<{ key: string; riskScore: number; violations: number }> {
    return Array.from(this.buckets.entries())
      .filter(([_, bucket]) => bucket.riskScore > 70)
      .map(([key, bucket]) => ({
        key,
        riskScore: bucket.riskScore,
        violations: bucket.violations.length,
      }))
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Reset rate limit for a key
   */
  async resetRateLimit(key: string, resetBy: string): Promise<boolean> {
    const bucket = this.buckets.get(key);
    if (!bucket) return false;

    bucket.tokens = bucket.capacity;
    bucket.requestCount = 0;
    bucket.violations = [];
    bucket.riskScore = 0;
    bucket.locked = false;
    bucket.lockExpiry = undefined;

    await this.auditService.logEvent({
      eventType: 'SECURITY_EVENT',
      category: 'SECURITY',
      resource: 'rate_limiter',
      action: 'rate_limit_reset',
      outcome: 'SUCCESS',
      ipAddress: key.includes(':') ? key.split(':')[0] : key,
      details: {
        bucketKey: key,
        resetBy,
        timestamp: new Date(),
      },
    });

    this.emit('rateLimitReset', { key, resetBy });
    return true;
  }

  /**
   * Block a key temporarily
   */
  async blockKey(key: string, duration: number, reason: string, blockedBy: string): Promise<void> {
    let bucket = this.buckets.get(key) || this.createBucket(key);

    bucket.locked = true;
    bucket.lockExpiry = new Date(Date.now() + duration * 1000);

    const violation: ViolationRecord = {
      timestamp: new Date(),
      violationType: 'SUSPICIOUS_PATTERN',
      severity: 'HIGH',
      details: { reason, blockedBy, duration },
      action: 'BLOCKED',
    };

    bucket.violations.push(violation);
    bucket.riskScore = Math.min(bucket.riskScore + 30, 100);

    this.buckets.set(key, bucket);

    await this.auditService.logSecurityEvent(
      'rate_limit_block',
      'HIGH',
      key.includes(':') ? key.split(':')[0] : key,
      {
        bucketKey: key,
        duration,
        reason,
        blockedBy,
      }
    );

    this.emit('keyBlocked', { key, duration, reason, blockedBy });
  }

  /**
   * Check a specific rule against a request
   */
  private async checkRule(rule: RateLimitRule, request: RequestContext): Promise<RateLimitResult> {
    if (!rule.enabled) {
      return {
        allowed: true,
        remainingRequests: Infinity,
        resetTime: new Date(),
        riskScore: 0,
      };
    }

    // Generate bucket key for this rule
    const bucketKey = this.generateBucketKey(rule, request);
    let bucket = this.buckets.get(bucketKey) || this.createBucket(bucketKey);

    // Check if bucket is locked
    if (bucket.locked && bucket.lockExpiry && new Date() < bucket.lockExpiry) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: bucket.lockExpiry,
        retryAfter: Math.ceil((bucket.lockExpiry.getTime() - Date.now()) / 1000),
        reason: 'Temporarily blocked',
        ruleId: rule.id,
        riskScore: bucket.riskScore,
      };
    }

    // Get threat context
    const threatContext = await this.getThreatContext(request);

    // Apply threat-aware adjustments
    const adjustedLimits = this.threatAdjuster.adjustLimits(rule.limits, threatContext);

    // Check each limit
    for (const limit of adjustedLimits) {
      const result = this.checkLimit(bucket, limit, request, threatContext);

      if (!result.allowed) {
        // Update bucket with violation
        this.updateBucketViolation(bucket, result, rule);
        this.buckets.set(bucketKey, bucket);

        return {
          ...result,
          ruleId: rule.id,
          riskScore: bucket.riskScore,
        };
      }
    }

    // Request allowed - consume tokens
    this.consumeTokens(bucket, request);
    this.buckets.set(bucketKey, bucket);

    return {
      allowed: true,
      remainingRequests: bucket.tokens,
      resetTime: new Date(bucket.lastRefill.getTime() + (rule.limits[0]?.window || 3600) * 1000),
      riskScore: bucket.riskScore,
    };
  }

  /**
   * Check a specific limit
   */
  private checkLimit(
    bucket: RateLimitBucket,
    limit: RateLimit,
    request: RequestContext,
    threatContext: ThreatContext
  ): RateLimitResult {
    const now = new Date();

    // Refill tokens based on limit type
    this.refillTokens(bucket, limit, now);

    // Check burst limit
    if (bucket.requestCount > limit.burstLimit) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: new Date(now.getTime() + limit.window * 1000),
        retryAfter: this.calculateRetryAfter(limit, threatContext),
        reason: 'Burst limit exceeded',
        riskScore: bucket.riskScore + 20,
      };
    }

    // Check rate limit
    if (bucket.tokens <= 0) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: new Date(now.getTime() + limit.window * 1000),
        retryAfter: this.calculateRetryAfter(limit, threatContext),
        reason: 'Rate limit exceeded',
        riskScore: bucket.riskScore + 15,
      };
    }

    return {
      allowed: true,
      remainingRequests: bucket.tokens,
      resetTime: new Date(now.getTime() + limit.window * 1000),
      riskScore: bucket.riskScore,
    };
  }

  /**
   * Refill tokens based on algorithm type
   */
  private refillTokens(bucket: RateLimitBucket, limit: RateLimit, now: Date): void {
    const timeSinceRefill = (now.getTime() - bucket.lastRefill.getTime()) / 1000;

    switch (limit.type) {
      case 'token-bucket':
        const tokensToAdd = Math.floor(timeSinceRefill * bucket.refillRate);
        bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
        break;

      case 'leaky-bucket':
        const leakRate = bucket.capacity / limit.window;
        const tokensToLeak = Math.floor(timeSinceRefill * leakRate);
        bucket.tokens = Math.max(0, bucket.tokens - tokensToLeak);
        bucket.lastRefill = now;
        break;

      case 'sliding':
        // Remove old requests outside the window
        const windowStart = new Date(now.getTime() - limit.window * 1000);
        if (bucket.firstRequest < windowStart) {
          // Reset if outside window
          bucket.tokens = limit.maxRequests;
          bucket.requestCount = 0;
        }
        break;

      case 'fixed':
        // Reset at fixed intervals
        const windowBoundary =
          Math.floor(now.getTime() / (limit.window * 1000)) * limit.window * 1000;
        const bucketWindow =
          Math.floor(bucket.lastRefill.getTime() / (limit.window * 1000)) * limit.window * 1000;

        if (windowBoundary > bucketWindow) {
          bucket.tokens = limit.maxRequests;
          bucket.requestCount = 0;
          bucket.lastRefill = new Date(windowBoundary);
        }
        break;
    }
  }

  /**
   * Consume tokens from bucket
   */
  private consumeTokens(bucket: RateLimitBucket, request: RequestContext): void {
    bucket.tokens = Math.max(0, bucket.tokens - 1);
    bucket.requestCount++;
    bucket.lastRequest = request.timestamp;

    // Analyze request patterns
    const patterns = this.patternAnalyzer.analyzeRequest(bucket, request);
    if (patterns.length > 0) {
      bucket.riskScore = Math.min(bucket.riskScore + patterns.length * 5, 100);
    }
  }

  /**
   * Find applicable rules for a request
   */
  private findApplicableRules(request: RequestContext): RateLimitRule[] {
    const applicableRules: RateLimitRule[] = [];

    for (const rule of this.rules.values()) {
      if (this.matchesRule(rule, request)) {
        applicableRules.push(rule);
      }
    }

    return applicableRules;
  }

  /**
   * Check if request matches rule conditions
   */
  private matchesRule(rule: RateLimitRule, request: RequestContext): boolean {
    // Check exemptions first
    if (this.isExempt(rule, request)) {
      return false;
    }

    // All conditions must match
    return rule.conditions.every(condition => this.matchesCondition(condition, request));
  }

  /**
   * Check if request is exempt from rule
   */
  private isExempt(rule: RateLimitRule, request: RequestContext): boolean {
    return rule.exemptions.some(exemption => {
      if (exemption.startsWith('ip:')) {
        return request.ipAddress === exemption.substring(3);
      }
      if (exemption.startsWith('user:')) {
        return request.userId === exemption.substring(5);
      }
      if (exemption.startsWith('endpoint:')) {
        return request.endpoint.startsWith(exemption.substring(9));
      }
      return false;
    });
  }

  /**
   * Check if condition matches request
   */
  private matchesCondition(condition: RateLimitCondition, request: RequestContext): boolean {
    const fieldValue = this.getFieldValue(request, condition.field);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'regex':
        return new RegExp(condition.value).test(String(fieldValue));
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'startsWith':
        return String(fieldValue).startsWith(String(condition.value));
      default:
        return false;
    }
  }

  /**
   * Get field value from request
   */
  private getFieldValue(request: RequestContext, field: string): any {
    switch (field) {
      case 'ip':
        return request.ipAddress;
      case 'user':
        return request.userId;
      case 'endpoint':
        return request.endpoint;
      case 'method':
        return request.method;
      case 'user-agent':
        return request.userAgent;
      default:
        return request.metadata?.[field];
    }
  }

  /**
   * Generate bucket key for request
   */
  private generateBucketKey(rule: RateLimitRule, request: RequestContext): string {
    const keyParts: string[] = [rule.id];

    for (const condition of rule.conditions) {
      const value = this.getFieldValue(request, condition.field);
      if (value) {
        keyParts.push(`${condition.field}:${value}`);
      }
    }

    return keyParts.join('|');
  }

  /**
   * Create a new bucket
   */
  private createBucket(key: string): RateLimitBucket {
    const now = new Date();

    return {
      key,
      tokens: this.config.defaultCapacity || 100,
      capacity: this.config.defaultCapacity || 100,
      refillRate: this.config.defaultRefillRate || 10,
      lastRefill: now,
      locked: false,
      requestCount: 0,
      firstRequest: now,
      lastRequest: now,
      violations: [],
      riskScore: 0,
    };
  }

  /**
   * Get threat context for request
   */
  private async getThreatContext(request: RequestContext): Promise<ThreatContext> {
    return {
      ipReputation: request.riskScore || 0,
      userRiskScore: 0, // Would be calculated from user behavior
      recentViolations: this.getRecentViolations(request.ipAddress),
      behaviorScore: 0, // Would be calculated from request patterns
      geographicRisk: 0, // Would be calculated from geolocation
    };
  }

  /**
   * Get recent violations for an IP
   */
  private getRecentViolations(ipAddress: string): number {
    let violations = 0;
    const oneHourAgo = new Date(Date.now() - 3600000);

    for (const bucket of this.buckets.values()) {
      if (bucket.key.includes(ipAddress)) {
        violations += bucket.violations.filter(v => v.timestamp > oneHourAgo).length;
      }
    }

    return violations;
  }

  /**
   * Update bucket with violation
   */
  private updateBucketViolation(
    bucket: RateLimitBucket,
    result: RateLimitResult,
    rule: RateLimitRule
  ): void {
    const violation: ViolationRecord = {
      timestamp: new Date(),
      violationType: result.reason?.includes('burst') ? 'BURST_EXCEEDED' : 'RATE_EXCEEDED',
      severity:
        result.riskScore > 80
          ? 'CRITICAL'
          : result.riskScore > 60
            ? 'HIGH'
            : result.riskScore > 30
              ? 'MEDIUM'
              : 'LOW',
      details: {
        reason: result.reason,
        remainingRequests: result.remainingRequests,
        ruleId: rule.id,
      },
      action: rule.actions[0]?.type || 'BLOCK',
    };

    bucket.violations.push(violation);
    bucket.riskScore = Math.min(bucket.riskScore + 10, 100);

    // Keep only recent violations (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 3600000);
    bucket.violations = bucket.violations.filter(v => v.timestamp > oneDayAgo);
  }

  /**
   * Calculate retry after value
   */
  private calculateRetryAfter(limit: RateLimit, threatContext: ThreatContext): number {
    let baseRetryAfter = limit.window;

    // Increase retry time for high-risk requests
    if (threatContext.ipReputation > 70) {
      baseRetryAfter *= 2;
    }

    if (threatContext.recentViolations > 5) {
      baseRetryAfter *= 1.5;
    }

    return Math.min(baseRetryAfter, this.config.maxRetryAfter || 3600);
  }

  /**
   * Execute actions for violated rule
   */
  private async executeActions(
    rule: RateLimitRule,
    request: RequestContext,
    result: RateLimitResult
  ): Promise<void> {
    for (const action of rule.actions) {
      try {
        await this.executeAction(action, rule, request, result);
      } catch (error) {
        console.error(`Failed to execute action ${action.type}:`, error);
      }
    }
  }

  /**
   * Execute a specific action
   */
  private async executeAction(
    action: RateLimitAction,
    rule: RateLimitRule,
    request: RequestContext,
    result: RateLimitResult
  ): Promise<void> {
    switch (action.type) {
      case 'block':
        await this.blockKey(
          this.generateBucketKey(rule, request),
          action.duration || 3600,
          'Rate limit violation',
          'system'
        );
        break;

      case 'alert':
        this.emit('rateLimitAlert', {
          rule,
          request,
          result,
          action,
        });
        break;

      case 'delay':
        // Delay would be implemented at the application level
        break;

      case 'throttle':
        // Throttling would be implemented at the application level
        break;

      case 'captcha':
        // CAPTCHA challenge would be implemented at the application level
        break;
    }
  }

  /**
   * Log rate limit violation
   */
  private async logViolation(
    rule: RateLimitRule,
    request: RequestContext,
    result: RateLimitResult
  ): Promise<void> {
    await this.auditService.logSecurityEvent(
      'rate_limit_violation',
      result.riskScore > 60 ? 'HIGH' : 'MEDIUM',
      request.ipAddress,
      {
        ruleId: rule.id,
        ruleName: rule.name,
        reason: result.reason,
        endpoint: request.endpoint,
        method: request.method,
        userId: request.userId,
        remainingRequests: result.remainingRequests,
        retryAfter: result.retryAfter,
      }
    );
  }

  /**
   * Calculate remaining requests across all rules
   */
  private calculateRemainingRequests(rules: RateLimitRule[], request: RequestContext): number {
    let minRemaining = Infinity;

    for (const rule of rules) {
      const bucketKey = this.generateBucketKey(rule, request);
      const bucket = this.buckets.get(bucketKey);

      if (bucket) {
        minRemaining = Math.min(minRemaining, bucket.tokens);
      }
    }

    return minRemaining === Infinity ? 1000 : minRemaining;
  }

  /**
   * Calculate reset time across all rules
   */
  private calculateResetTime(rules: RateLimitRule[]): Date {
    let earliestReset = new Date(Date.now() + 3600000); // Default 1 hour

    for (const rule of rules) {
      if (rule.limits.length > 0) {
        const ruleReset = new Date(Date.now() + rule.limits[0].window * 1000);
        if (ruleReset < earliestReset) {
          earliestReset = ruleReset;
        }
      }
    }

    return earliestReset;
  }

  /**
   * Setup periodic tasks
   */
  private setupPeriodicTasks(): void {
    // Cleanup expired buckets
    setInterval(() => {
      this.cleanupExpiredBuckets();
    }, this.cleanupInterval);

    // Analyze patterns
    setInterval(() => {
      this.analyzePatterns();
    }, this.analysisInterval);
  }

  /**
   * Cleanup expired buckets and unlock expired locks
   */
  private cleanupExpiredBuckets(): void {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    for (const [key, bucket] of this.buckets.entries()) {
      // Remove old buckets
      if (bucket.lastRequest < cutoffTime) {
        this.buckets.delete(key);
        continue;
      }

      // Unlock expired locks
      if (bucket.locked && bucket.lockExpiry && now > bucket.lockExpiry) {
        bucket.locked = false;
        bucket.lockExpiry = undefined;
      }
    }
  }

  /**
   * Analyze patterns across all buckets
   */
  private analyzePatterns(): void {
    const highRiskBuckets = this.getHighRiskBuckets();

    if (highRiskBuckets.length > 0) {
      this.emit('highRiskDetected', {
        buckets: highRiskBuckets,
        timestamp: new Date(),
      });
    }

    // Analyze for coordinated attacks
    const suspiciousPatterns = this.patternAnalyzer.detectCoordinatedAttacks(
      Array.from(this.buckets.values())
    );

    if (suspiciousPatterns.length > 0) {
      this.emit('coordinatedAttackDetected', {
        patterns: suspiciousPatterns,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Load default rate limiting rules
   */
  private loadDefaultRules(): void {
    // Global rate limit
    this.addRule({
      name: 'Global Rate Limit',
      description: 'General rate limiting for all requests',
      enabled: true,
      priority: 100,
      conditions: [],
      limits: [
        {
          window: 60,
          maxRequests: 1000,
          burstLimit: 100,
          type: 'sliding',
          resetBehavior: 'gradual',
        },
      ],
      actions: [
        {
          type: 'throttle',
          config: { delay: 1000 },
        },
      ],
      exemptions: [],
      metadata: { default: true },
    });

    // Login endpoint protection
    this.addRule({
      name: 'Login Protection',
      description: 'Stricter limits for login attempts',
      enabled: true,
      priority: 10,
      conditions: [
        {
          field: 'endpoint',
          operator: 'contains',
          value: '/login',
          weight: 1,
        },
      ],
      limits: [
        {
          window: 300, // 5 minutes
          maxRequests: 10,
          burstLimit: 5,
          type: 'sliding',
          resetBehavior: 'exponential',
        },
      ],
      actions: [
        {
          type: 'block',
          duration: 900, // 15 minutes
          config: {},
        },
        {
          type: 'alert',
          config: { severity: 'HIGH' },
        },
      ],
      exemptions: [],
      metadata: { critical: true },
    });

    // API endpoint protection
    this.addRule({
      name: 'API Rate Limit',
      description: 'Rate limiting for API endpoints',
      enabled: true,
      priority: 20,
      conditions: [
        {
          field: 'endpoint',
          operator: 'startsWith',
          value: '/api/',
          weight: 1,
        },
      ],
      limits: [
        {
          window: 3600, // 1 hour
          maxRequests: 5000,
          burstLimit: 100,
          type: 'token-bucket',
          resetBehavior: 'immediate',
        },
      ],
      actions: [
        {
          type: 'throttle',
          config: { delay: 2000 },
        },
      ],
      exemptions: [],
      metadata: { api: true },
    });
  }
}

// Helper classes
class PatternAnalyzer {
  analyzeRequest(bucket: RateLimitBucket, request: RequestContext): string[] {
    const patterns: string[] = [];

    // Rapid succession pattern
    if (
      bucket.requestCount > 50 &&
      request.timestamp.getTime() - bucket.firstRequest.getTime() < 60000
    ) {
      patterns.push('rapid_succession');
    }

    // Uniform timing pattern (bot-like)
    // Implementation would analyze request timing patterns

    // Endpoint scanning pattern
    // Implementation would analyze endpoint access patterns

    return patterns;
  }

  detectCoordinatedAttacks(buckets: RateLimitBucket[]): CoordinatedAttackPattern[] {
    const patterns: CoordinatedAttackPattern[] = [];

    // Analyze for distributed attacks
    const highRiskBuckets = buckets.filter(b => b.riskScore > 70);

    if (highRiskBuckets.length > 10) {
      patterns.push({
        type: 'DISTRIBUTED_ATTACK',
        severity: 'HIGH',
        bucketCount: highRiskBuckets.length,
        timestamp: new Date(),
        evidence: {
          affectedBuckets: highRiskBuckets.map(b => b.key),
        },
      });
    }

    return patterns;
  }
}

class ThreatAdjuster {
  constructor(private config: RateLimitConfig) {}

  adjustLimits(limits: RateLimit[], threatContext: ThreatContext): RateLimit[] {
    return limits.map(limit => ({
      ...limit,
      maxRequests: this.adjustMaxRequests(limit.maxRequests, threatContext),
      burstLimit: this.adjustBurstLimit(limit.burstLimit, threatContext),
    }));
  }

  private adjustMaxRequests(baseLimit: number, context: ThreatContext): number {
    let multiplier = 1.0;

    // Reduce limits for high-risk IPs
    if (context.ipReputation > 70) multiplier *= 0.5;
    if (context.recentViolations > 5) multiplier *= 0.7;
    if (context.behaviorScore > 60) multiplier *= 0.8;

    return Math.max(1, Math.floor(baseLimit * multiplier));
  }

  private adjustBurstLimit(baseLimit: number, context: ThreatContext): number {
    let multiplier = 1.0;

    if (context.ipReputation > 80) multiplier *= 0.3;
    if (context.recentViolations > 10) multiplier *= 0.5;

    return Math.max(1, Math.floor(baseLimit * multiplier));
  }
}

// Additional interfaces
interface RateLimitConfig {
  defaultCapacity?: number;
  defaultRefillRate?: number;
  maxRetryAfter?: number;
  enableThreatAdjustment?: boolean;
  enablePatternAnalysis?: boolean;
}

interface CoordinatedAttackPattern {
  type: 'DISTRIBUTED_ATTACK' | 'SYNCHRONIZED_REQUESTS' | 'AMPLIFICATION_ATTACK';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  bucketCount: number;
  timestamp: Date;
  evidence: Record<string, any>;
}
