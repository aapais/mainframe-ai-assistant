/**
 * API Key Access Tracker
 * Comprehensive monitoring and analysis of API key usage patterns
 */

import { EventEmitter } from 'events';
import { AuditService, AuditEvent } from '../audit/AuditService';

export interface APIKeyInfo {
  keyId: string;
  keyHash: string;
  userId: string;
  name: string;
  permissions: string[];
  createdAt: Date;
  lastUsed?: Date;
  expiresAt?: Date;
  isActive: boolean;
  rateLimit?: RateLimitConfig;
  ipWhitelist?: string[];
  metadata: Record<string, any>;
}

export interface KeyUsagePattern {
  keyId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  firstUsed: Date;
  lastUsed: Date;
  requestFrequency: Map<number, number>; // hour -> count
  endpointUsage: Map<string, EndpointUsage>;
  ipAddresses: Map<string, IPUsage>;
  userAgents: Set<string>;
  errorPatterns: Map<string, number>;
  riskScore: number;
  anomalies: KeyAnomaly[];
}

export interface EndpointUsage {
  endpoint: string;
  requestCount: number;
  successRate: number;
  averageResponseTime: number;
  lastAccessed: Date;
  methods: Set<string>;
}

export interface IPUsage {
  ipAddress: string;
  requestCount: number;
  successRate: number;
  firstSeen: Date;
  lastSeen: Date;
  location?: string;
  suspicious: boolean;
}

export interface KeyAnomaly {
  id: string;
  keyId: string;
  type: KeyAnomalyType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: Date;
  description: string;
  evidence: Record<string, any>;
  riskScore: number;
  actionTaken?: string;
}

export enum KeyAnomalyType {
  UNUSUAL_VOLUME = 'UNUSUAL_VOLUME',
  UNUSUAL_ENDPOINT = 'UNUSUAL_ENDPOINT',
  UNUSUAL_IP = 'UNUSUAL_IP',
  UNUSUAL_TIME = 'UNUSUAL_TIME',
  PERMISSION_VIOLATION = 'PERMISSION_VIOLATION',
  RATE_LIMIT_ABUSE = 'RATE_LIMIT_ABUSE',
  SUSPICIOUS_PATTERN = 'SUSPICIOUS_PATTERN',
  EXPIRED_KEY_USAGE = 'EXPIRED_KEY_USAGE',
  REVOKED_KEY_USAGE = 'REVOKED_KEY_USAGE',
}

export interface KeyAlert {
  id: string;
  keyId: string;
  userId: string;
  timestamp: Date;
  alertType: KeyAnomalyType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  anomalies: KeyAnomaly[];
  triggerEvent: AuditEvent;
  recommendedActions: string[];
  metadata: Record<string, any>;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

export class KeyAccessTracker extends EventEmitter {
  private keyPatterns: Map<string, KeyUsagePattern> = new Map();
  private keyInfo: Map<string, APIKeyInfo> = new Map();
  private suspiciousKeys: Set<string> = new Set();
  private revokedKeys: Set<string> = new Set();
  private analysisWindow = 24 * 60 * 60 * 1000; // 24 hours
  private cleanupInterval = 60 * 60 * 1000; // 1 hour

  constructor(
    private auditService: AuditService,
    private config: KeyTrackerConfig
  ) {
    super();
    this.setupEventMonitoring();
    this.setupPeriodicAnalysis();
    this.loadKeyInformation();
  }

  /**
   * Register a new API key
   */
  async registerKey(keyInfo: APIKeyInfo): Promise<void> {
    this.keyInfo.set(keyInfo.keyId, keyInfo);

    // Initialize usage pattern
    this.keyPatterns.set(keyInfo.keyId, {
      keyId: keyInfo.keyId,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      firstUsed: new Date(),
      lastUsed: new Date(),
      requestFrequency: new Map(),
      endpointUsage: new Map(),
      ipAddresses: new Map(),
      userAgents: new Set(),
      errorPatterns: new Map(),
      riskScore: 0,
      anomalies: [],
    });

    await this.auditService.logEvent({
      eventType: 'API_ACCESS',
      category: 'SECURITY',
      resource: 'api_key_management',
      action: 'key_registered',
      outcome: 'SUCCESS',
      ipAddress: 'system',
      details: {
        keyId: keyInfo.keyId,
        userId: keyInfo.userId,
        permissions: keyInfo.permissions,
      },
    });

    this.emit('keyRegistered', keyInfo);
  }

  /**
   * Track API key usage
   */
  async trackKeyUsage(keyId: string, request: KeyUsageRequest): Promise<KeyUsageResult> {
    const keyInfo = this.keyInfo.get(keyId);
    const pattern = this.keyPatterns.get(keyId);

    if (!keyInfo || !pattern) {
      return {
        allowed: false,
        reason: 'UNKNOWN_KEY',
        riskScore: 100,
      };
    }

    // Check if key is active
    if (!keyInfo.isActive || this.revokedKeys.has(keyId)) {
      await this.recordAnomaly(keyId, {
        type: KeyAnomalyType.REVOKED_KEY_USAGE,
        severity: 'HIGH',
        description: 'Attempt to use revoked API key',
        evidence: { request },
      });

      return {
        allowed: false,
        reason: 'REVOKED_KEY',
        riskScore: 90,
      };
    }

    // Check expiration
    if (keyInfo.expiresAt && new Date() > keyInfo.expiresAt) {
      await this.recordAnomaly(keyId, {
        type: KeyAnomalyType.EXPIRED_KEY_USAGE,
        severity: 'MEDIUM',
        description: 'Attempt to use expired API key',
        evidence: { expiresAt: keyInfo.expiresAt, request },
      });

      return {
        allowed: false,
        reason: 'EXPIRED_KEY',
        riskScore: 60,
      };
    }

    // Check IP whitelist
    if (keyInfo.ipWhitelist && keyInfo.ipWhitelist.length > 0) {
      if (!keyInfo.ipWhitelist.includes(request.ipAddress)) {
        await this.recordAnomaly(keyId, {
          type: KeyAnomalyType.UNUSUAL_IP,
          severity: 'HIGH',
          description: 'Request from non-whitelisted IP',
          evidence: {
            requestIP: request.ipAddress,
            whitelist: keyInfo.ipWhitelist,
          },
        });

        return {
          allowed: false,
          reason: 'IP_NOT_WHITELISTED',
          riskScore: 80,
        };
      }
    }

    // Check permissions
    if (!this.hasPermission(keyInfo, request.endpoint, request.method)) {
      await this.recordAnomaly(keyId, {
        type: KeyAnomalyType.PERMISSION_VIOLATION,
        severity: 'HIGH',
        description: 'Insufficient permissions for endpoint',
        evidence: {
          endpoint: request.endpoint,
          method: request.method,
          permissions: keyInfo.permissions,
        },
      });

      return {
        allowed: false,
        reason: 'INSUFFICIENT_PERMISSIONS',
        riskScore: 70,
      };
    }

    // Check rate limits
    const rateLimitResult = await this.checkRateLimit(keyId, keyInfo);
    if (!rateLimitResult.allowed) {
      await this.recordAnomaly(keyId, {
        type: KeyAnomalyType.RATE_LIMIT_ABUSE,
        severity: 'MEDIUM',
        description: 'Rate limit exceeded',
        evidence: {
          currentRate: rateLimitResult.currentRate,
          limit: rateLimitResult.limit,
        },
      });

      return {
        allowed: false,
        reason: 'RATE_LIMIT_EXCEEDED',
        riskScore: 40,
      };
    }

    // Update usage pattern
    await this.updateUsagePattern(keyId, request);

    // Analyze for anomalies
    const anomalies = await this.analyzeUsagePattern(keyId, request);

    const riskScore = this.calculateRequestRiskScore(keyId, request, anomalies);

    // Log successful usage
    await this.auditService.logApiAccess(
      keyInfo.userId,
      request.endpoint,
      request.method,
      request.statusCode,
      request.ipAddress,
      keyId,
      {
        responseTime: request.responseTime,
        riskScore,
        anomalies: anomalies.length,
      }
    );

    return {
      allowed: true,
      riskScore,
      anomalies: anomalies.length > 0 ? anomalies : undefined,
    };
  }

  /**
   * Get key usage statistics
   */
  getKeyStatistics(keyId: string): KeyStatistics | null {
    const keyInfo = this.keyInfo.get(keyId);
    const pattern = this.keyPatterns.get(keyId);

    if (!keyInfo || !pattern) {
      return null;
    }

    return {
      keyId,
      keyInfo,
      pattern,
      statistics: {
        totalRequests: pattern.totalRequests,
        successRate:
          pattern.totalRequests > 0
            ? (pattern.successfulRequests / pattern.totalRequests) * 100
            : 0,
        averageRequestsPerHour: this.calculateAverageRequestsPerHour(pattern),
        uniqueIPs: pattern.ipAddresses.size,
        uniqueEndpoints: pattern.endpointUsage.size,
        riskScore: pattern.riskScore,
        anomalyCount: pattern.anomalies.length,
        lastUsed: pattern.lastUsed,
      },
    };
  }

  /**
   * Get all keys with high risk scores
   */
  getHighRiskKeys(): Array<{ keyId: string; riskScore: number; anomalies: number }> {
    return Array.from(this.keyPatterns.entries())
      .filter(([_, pattern]) => pattern.riskScore > 50)
      .map(([keyId, pattern]) => ({
        keyId,
        riskScore: pattern.riskScore,
        anomalies: pattern.anomalies.length,
      }))
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Revoke an API key
   */
  async revokeKey(keyId: string, reason: string, revokedBy: string): Promise<boolean> {
    const keyInfo = this.keyInfo.get(keyId);
    if (!keyInfo) {
      return false;
    }

    keyInfo.isActive = false;
    this.revokedKeys.add(keyId);

    await this.auditService.logEvent({
      eventType: 'API_ACCESS',
      category: 'SECURITY',
      resource: 'api_key_management',
      action: 'key_revoked',
      outcome: 'SUCCESS',
      ipAddress: 'system',
      details: {
        keyId,
        reason,
        revokedBy,
      },
    });

    this.emit('keyRevoked', { keyId, reason, revokedBy });
    return true;
  }

  /**
   * Update usage pattern for a key
   */
  private async updateUsagePattern(keyId: string, request: KeyUsageRequest): Promise<void> {
    const pattern = this.keyPatterns.get(keyId)!;
    const keyInfo = this.keyInfo.get(keyId)!;

    // Update basic counters
    pattern.totalRequests++;
    pattern.lastUsed = new Date();

    if (request.statusCode < 400) {
      pattern.successfulRequests++;
    } else {
      pattern.failedRequests++;

      // Track error patterns
      const errorKey = `${request.statusCode}`;
      pattern.errorPatterns.set(errorKey, (pattern.errorPatterns.get(errorKey) || 0) + 1);
    }

    // Update hourly frequency
    const hour = new Date().getHours();
    pattern.requestFrequency.set(hour, (pattern.requestFrequency.get(hour) || 0) + 1);

    // Update endpoint usage
    this.updateEndpointUsage(pattern, request);

    // Update IP usage
    this.updateIPUsage(pattern, request);

    // Update user agents
    if (request.userAgent) {
      pattern.userAgents.add(request.userAgent);
    }

    // Update key info
    keyInfo.lastUsed = new Date();

    // Recalculate risk score
    pattern.riskScore = this.calculatePatternRiskScore(pattern);
  }

  /**
   * Update endpoint usage statistics
   */
  private updateEndpointUsage(pattern: KeyUsagePattern, request: KeyUsageRequest): void {
    const endpointUsage = pattern.endpointUsage.get(request.endpoint) || {
      endpoint: request.endpoint,
      requestCount: 0,
      successRate: 1.0,
      averageResponseTime: 0,
      lastAccessed: new Date(),
      methods: new Set(),
    };

    endpointUsage.requestCount++;
    endpointUsage.lastAccessed = new Date();
    endpointUsage.methods.add(request.method);

    // Update success rate
    const isSuccess = request.statusCode < 400 ? 1 : 0;
    endpointUsage.successRate =
      (endpointUsage.successRate * (endpointUsage.requestCount - 1) + isSuccess) /
      endpointUsage.requestCount;

    // Update average response time
    if (request.responseTime) {
      endpointUsage.averageResponseTime =
        (endpointUsage.averageResponseTime * (endpointUsage.requestCount - 1) +
          request.responseTime) /
        endpointUsage.requestCount;
    }

    pattern.endpointUsage.set(request.endpoint, endpointUsage);
  }

  /**
   * Update IP usage statistics
   */
  private updateIPUsage(pattern: KeyUsagePattern, request: KeyUsageRequest): void {
    const ipUsage = pattern.ipAddresses.get(request.ipAddress) || {
      ipAddress: request.ipAddress,
      requestCount: 0,
      successRate: 1.0,
      firstSeen: new Date(),
      lastSeen: new Date(),
      suspicious: false,
    };

    ipUsage.requestCount++;
    ipUsage.lastSeen = new Date();

    // Update success rate
    const isSuccess = request.statusCode < 400 ? 1 : 0;
    ipUsage.successRate =
      (ipUsage.successRate * (ipUsage.requestCount - 1) + isSuccess) / ipUsage.requestCount;

    pattern.ipAddresses.set(request.ipAddress, ipUsage);
  }

  /**
   * Analyze usage pattern for anomalies
   */
  private async analyzeUsagePattern(
    keyId: string,
    request: KeyUsageRequest
  ): Promise<KeyAnomaly[]> {
    const pattern = this.keyPatterns.get(keyId)!;
    const anomalies: KeyAnomaly[] = [];

    // Volume anomaly
    const volumeAnomaly = this.detectVolumeAnomaly(pattern, request);
    if (volumeAnomaly) anomalies.push(volumeAnomaly);

    // Unusual endpoint access
    const endpointAnomaly = this.detectUnusualEndpoint(pattern, request);
    if (endpointAnomaly) anomalies.push(endpointAnomaly);

    // Unusual IP address
    const ipAnomaly = this.detectUnusualIP(pattern, request);
    if (ipAnomaly) anomalies.push(ipAnomaly);

    // Time-based anomalies
    const timeAnomaly = this.detectTimeAnomaly(pattern, request);
    if (timeAnomaly) anomalies.push(timeAnomaly);

    // Suspicious patterns
    const suspiciousAnomaly = this.detectSuspiciousPattern(pattern, request);
    if (suspiciousAnomaly) anomalies.push(suspiciousAnomaly);

    // Store anomalies
    pattern.anomalies.push(...anomalies);

    // Keep only recent anomalies
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    pattern.anomalies = pattern.anomalies.filter(a => a.timestamp > cutoffTime);

    // Generate alerts for significant anomalies
    if (anomalies.some(a => a.severity === 'HIGH' || a.severity === 'CRITICAL')) {
      await this.generateKeyAlert(keyId, anomalies, request);
    }

    return anomalies;
  }

  /**
   * Detect volume-based anomalies
   */
  private detectVolumeAnomaly(
    pattern: KeyUsagePattern,
    request: KeyUsageRequest
  ): KeyAnomaly | null {
    const currentHour = new Date().getHours();
    const hourlyCount = pattern.requestFrequency.get(currentHour) || 0;
    const averageHourly = this.calculateAverageRequestsPerHour(pattern);

    if (hourlyCount > averageHourly * 5 && averageHourly > 0) {
      return {
        id: crypto.randomUUID(),
        keyId: pattern.keyId,
        type: KeyAnomalyType.UNUSUAL_VOLUME,
        severity: hourlyCount > averageHourly * 10 ? 'HIGH' : 'MEDIUM',
        timestamp: new Date(),
        description: `Unusual request volume: ${hourlyCount} requests this hour`,
        evidence: {
          currentHourlyCount: hourlyCount,
          averageHourly,
          multiplier: hourlyCount / averageHourly,
        },
        riskScore: Math.min((hourlyCount / averageHourly) * 10, 40),
      };
    }

    return null;
  }

  /**
   * Detect unusual endpoint access
   */
  private detectUnusualEndpoint(
    pattern: KeyUsagePattern,
    request: KeyUsageRequest
  ): KeyAnomaly | null {
    const endpointUsage = pattern.endpointUsage.get(request.endpoint);

    // First time accessing this endpoint
    if (!endpointUsage) {
      // Check if it's a sensitive endpoint
      const sensitivePatterns = ['/admin/', '/api/admin/', '/system/', '/internal/'];
      const isSensitive = sensitivePatterns.some(p => request.endpoint.includes(p));

      if (isSensitive) {
        return {
          id: crypto.randomUUID(),
          keyId: pattern.keyId,
          type: KeyAnomalyType.UNUSUAL_ENDPOINT,
          severity: 'HIGH',
          timestamp: new Date(),
          description: `First access to sensitive endpoint: ${request.endpoint}`,
          evidence: {
            endpoint: request.endpoint,
            method: request.method,
            firstAccess: true,
          },
          riskScore: 35,
        };
      }
    }

    return null;
  }

  /**
   * Detect unusual IP addresses
   */
  private detectUnusualIP(pattern: KeyUsagePattern, request: KeyUsageRequest): KeyAnomaly | null {
    const ipUsage = pattern.ipAddresses.get(request.ipAddress);

    // New IP address
    if (!ipUsage && pattern.ipAddresses.size > 0) {
      return {
        id: crypto.randomUUID(),
        keyId: pattern.keyId,
        type: KeyAnomalyType.UNUSUAL_IP,
        severity: 'MEDIUM',
        timestamp: new Date(),
        description: `New IP address accessing API: ${request.ipAddress}`,
        evidence: {
          newIP: request.ipAddress,
          knownIPs: Array.from(pattern.ipAddresses.keys()),
          totalUniqueIPs: pattern.ipAddresses.size + 1,
        },
        riskScore: 20,
      };
    }

    return null;
  }

  /**
   * Detect time-based anomalies
   */
  private detectTimeAnomaly(pattern: KeyUsagePattern, request: KeyUsageRequest): KeyAnomaly | null {
    const currentHour = new Date().getHours();
    const totalRequests = Array.from(pattern.requestFrequency.values()).reduce((a, b) => a + b, 0);

    if (totalRequests > 50) {
      // Only analyze if we have enough data
      const hourlyPercentage = (pattern.requestFrequency.get(currentHour) || 0) / totalRequests;

      // Less than 2% of typical activity at this hour
      if (hourlyPercentage < 0.02) {
        return {
          id: crypto.randomUUID(),
          keyId: pattern.keyId,
          type: KeyAnomalyType.UNUSUAL_TIME,
          severity: 'LOW',
          timestamp: new Date(),
          description: `Unusual time for API access: ${currentHour}:00`,
          evidence: {
            hour: currentHour,
            typicalPercentage: hourlyPercentage * 100,
            totalRequests,
          },
          riskScore: 10,
        };
      }
    }

    return null;
  }

  /**
   * Detect suspicious patterns
   */
  private detectSuspiciousPattern(
    pattern: KeyUsagePattern,
    request: KeyUsageRequest
  ): KeyAnomaly | null {
    const recentFailures = Array.from(pattern.errorPatterns.values()).reduce((a, b) => a + b, 0);
    const failureRate = recentFailures / pattern.totalRequests;

    // High failure rate might indicate abuse or misconfiguration
    if (failureRate > 0.5 && pattern.totalRequests > 20) {
      return {
        id: crypto.randomUUID(),
        keyId: pattern.keyId,
        type: KeyAnomalyType.SUSPICIOUS_PATTERN,
        severity: failureRate > 0.8 ? 'HIGH' : 'MEDIUM',
        timestamp: new Date(),
        description: `High failure rate detected: ${(failureRate * 100).toFixed(1)}%`,
        evidence: {
          failureRate: failureRate * 100,
          totalRequests: pattern.totalRequests,
          recentFailures,
          errorPatterns: Object.fromEntries(pattern.errorPatterns),
        },
        riskScore: failureRate * 30,
      };
    }

    return null;
  }

  /**
   * Record anomaly
   */
  private async recordAnomaly(keyId: string, anomalyData: Partial<KeyAnomaly>): Promise<void> {
    const anomaly: KeyAnomaly = {
      id: crypto.randomUUID(),
      keyId,
      severity: 'MEDIUM',
      timestamp: new Date(),
      riskScore: 20,
      ...anomalyData,
      type: anomalyData.type!,
      description: anomalyData.description!,
      evidence: anomalyData.evidence!,
    };

    const pattern = this.keyPatterns.get(keyId);
    if (pattern) {
      pattern.anomalies.push(anomaly);
    }

    await this.auditService.logSecurityEvent(
      `api_key_${anomaly.type.toLowerCase()}`,
      anomaly.severity,
      anomaly.evidence.request?.ipAddress || 'unknown',
      {
        keyId,
        anomalyId: anomaly.id,
        anomalyType: anomaly.type,
        evidence: anomaly.evidence,
      }
    );

    this.emit('keyAnomaly', anomaly);
  }

  /**
   * Generate alert for key anomalies
   */
  private async generateKeyAlert(
    keyId: string,
    anomalies: KeyAnomaly[],
    request: KeyUsageRequest
  ): Promise<void> {
    const keyInfo = this.keyInfo.get(keyId)!;
    const maxSeverity = anomalies.reduce(
      (max, a) => (this.compareSeverity(a.severity, max) > 0 ? a.severity : max),
      'LOW'
    );

    const alert: KeyAlert = {
      id: crypto.randomUUID(),
      keyId,
      userId: keyInfo.userId,
      timestamp: new Date(),
      alertType: anomalies[0].type,
      severity: maxSeverity,
      anomalies,
      triggerEvent: {} as AuditEvent, // Would be populated with actual event
      recommendedActions: this.generateAlertRecommendations(anomalies),
      metadata: {
        requestCount: anomalies.length,
        riskScoreTotal: anomalies.reduce((sum, a) => sum + a.riskScore, 0),
      },
    };

    this.emit('keyAlert', alert);
  }

  /**
   * Helper methods
   */
  private hasPermission(keyInfo: APIKeyInfo, endpoint: string, method: string): boolean {
    // Implement permission checking logic
    return (
      keyInfo.permissions.includes('*') ||
      keyInfo.permissions.includes(`${method}:${endpoint}`) ||
      keyInfo.permissions.some(p => endpoint.startsWith(p.replace('*', '')))
    );
  }

  private async checkRateLimit(keyId: string, keyInfo: APIKeyInfo): Promise<RateLimitResult> {
    if (!keyInfo.rateLimit) {
      return { allowed: true };
    }

    // Implementation would check actual rate limit buckets
    // For now, return allowed
    return {
      allowed: true,
      currentRate: 10,
      limit: keyInfo.rateLimit.requestsPerMinute,
    };
  }

  private calculateRequestRiskScore(
    keyId: string,
    request: KeyUsageRequest,
    anomalies: KeyAnomaly[]
  ): number {
    let score = 0;

    // Base score from anomalies
    score += anomalies.reduce((sum, a) => sum + a.riskScore, 0);

    // Status code factor
    if (request.statusCode >= 400) {
      score += 5;
    }

    // Off-hours factor
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      score += 5;
    }

    return Math.min(score, 100);
  }

  private calculatePatternRiskScore(pattern: KeyUsagePattern): number {
    let score = 0;

    // Anomaly score
    score += pattern.anomalies.length * 5;

    // Failure rate score
    const failureRate = pattern.failedRequests / pattern.totalRequests;
    score += failureRate * 30;

    // IP diversity score
    if (pattern.ipAddresses.size > 10) {
      score += 20;
    }

    // User agent diversity score
    if (pattern.userAgents.size > 5) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  private calculateAverageRequestsPerHour(pattern: KeyUsagePattern): number {
    const hourlyTotals = Array.from(pattern.requestFrequency.values());
    return hourlyTotals.length > 0
      ? hourlyTotals.reduce((a, b) => a + b, 0) / hourlyTotals.length
      : 0;
  }

  private compareSeverity(a: string, b: string): number {
    const levels = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    return levels[a] - levels[b];
  }

  private generateAlertRecommendations(anomalies: KeyAnomaly[]): string[] {
    const recommendations = new Set<string>();

    for (const anomaly of anomalies) {
      switch (anomaly.type) {
        case KeyAnomalyType.UNUSUAL_VOLUME:
          recommendations.add('Review rate limits');
          recommendations.add('Monitor key usage closely');
          break;
        case KeyAnomalyType.PERMISSION_VIOLATION:
          recommendations.add('Review key permissions');
          recommendations.add('Consider key revocation');
          break;
        case KeyAnomalyType.UNUSUAL_IP:
          recommendations.add('Verify IP whitelist');
          recommendations.add('Confirm legitimate usage');
          break;
        default:
          recommendations.add('Investigate further');
      }
    }

    return Array.from(recommendations);
  }

  private setupEventMonitoring(): void {
    this.auditService.on('auditEvent', (event: AuditEvent) => {
      if (event.eventType === 'API_ACCESS' && event.details.apiKey) {
        // Convert audit event to key usage request
        const request: KeyUsageRequest = {
          endpoint: event.resource,
          method: event.action,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          statusCode: event.outcome === 'SUCCESS' ? 200 : 400,
          responseTime: event.details.responseTime,
          timestamp: event.timestamp,
        };

        this.trackKeyUsage(event.details.apiKey, request);
      }
    });
  }

  private setupPeriodicAnalysis(): void {
    setInterval(() => {
      this.performPeriodicCleanup();
    }, this.cleanupInterval);
  }

  private performPeriodicCleanup(): void {
    const cutoffTime = new Date(Date.now() - this.analysisWindow);

    for (const pattern of this.keyPatterns.values()) {
      // Clean old anomalies
      pattern.anomalies = pattern.anomalies.filter(a => a.timestamp > cutoffTime);
    }
  }

  private loadKeyInformation(): void {
    // Implementation would load key information from database
    // For now, we'll start with empty maps
  }
}

// Interfaces
export interface KeyUsageRequest {
  endpoint: string;
  method: string;
  ipAddress: string;
  userAgent?: string;
  statusCode: number;
  responseTime?: number;
  timestamp: Date;
}

export interface KeyUsageResult {
  allowed: boolean;
  reason?: string;
  riskScore: number;
  anomalies?: KeyAnomaly[];
}

export interface RateLimitResult {
  allowed: boolean;
  currentRate?: number;
  limit?: number;
}

export interface KeyStatistics {
  keyId: string;
  keyInfo: APIKeyInfo;
  pattern: KeyUsagePattern;
  statistics: {
    totalRequests: number;
    successRate: number;
    averageRequestsPerHour: number;
    uniqueIPs: number;
    uniqueEndpoints: number;
    riskScore: number;
    anomalyCount: number;
    lastUsed: Date;
  };
}

export interface KeyTrackerConfig {
  analysisWindow?: number;
  enableAnomalyDetection?: boolean;
  enableRateLimiting?: boolean;
  maxKeysPerUser?: number;
}
