/**
 * Advanced Failed Login Detection System
 * Implements adaptive thresholds and intelligent pattern recognition
 */

import { EventEmitter } from 'events';
import { AuditService, AuditEvent } from '../audit/AuditService';

export interface LoginAttempt {
  userId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  metadata: Record<string, any>;
}

export interface LoginPattern {
  ipAddress: string;
  attempts: LoginAttempt[];
  failureCount: number;
  successCount: number;
  firstAttempt: Date;
  lastAttempt: Date;
  riskScore: number;
  isBlocked: boolean;
  blockExpiry?: Date;
}

export interface DetectionConfig {
  maxFailedAttempts: number;
  timeWindowMinutes: number;
  blockDurationMinutes: number;
  adaptiveThresholds: boolean;
  progressiveDelay: boolean;
  ipReputationChecking: boolean;
  userBehaviorAnalysis: boolean;
  whitelistedIPs: string[];
  whitelistedNetworks: string[];
}

export interface FailedLoginAlert {
  id: string;
  timestamp: Date;
  ipAddress: string;
  userId?: string;
  alertType: 'THRESHOLD_EXCEEDED' | 'BRUTE_FORCE' | 'DISTRIBUTED_ATTACK' | 'CREDENTIAL_STUFFING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  attemptCount: number;
  timeWindow: number;
  riskFactors: string[];
  recommendedActions: string[];
  metadata: Record<string, any>;
}

export class FailedLoginDetector extends EventEmitter {
  private patterns: Map<string, LoginPattern> = new Map();
  private userPatterns: Map<string, UserLoginBehavior> = new Map();
  private blockedIPs: Map<string, BlockInfo> = new Map();
  private suspiciousIPs: Set<string> = new Set();
  private cleanupInterval = 15 * 60 * 1000; // 15 minutes
  private analysisInterval = 5 * 60 * 1000; // 5 minutes

  constructor(
    private auditService: AuditService,
    private config: DetectionConfig
  ) {
    super();
    this.setupEventMonitoring();
    this.setupPeriodicCleanup();
    this.setupPeriodicAnalysis();
    this.loadWhitelistedIPs();
  }

  /**
   * Process a login attempt
   */
  async processLoginAttempt(attempt: LoginAttempt): Promise<void> {
    // Skip whitelisted IPs
    if (this.isWhitelisted(attempt.ipAddress)) {
      return;
    }

    // Update patterns
    this.updatePattern(attempt);
    if (attempt.userId) {
      this.updateUserBehavior(attempt);
    }

    // Check for violations
    const pattern = this.patterns.get(attempt.ipAddress);
    if (pattern && !attempt.success) {
      await this.analyzeFailedAttempt(pattern, attempt);
    }

    // Log the analysis
    await this.auditService.logEvent({
      eventType: 'AUTHENTICATION',
      category: 'SECURITY',
      resource: 'login_detector',
      action: 'login_attempt_processed',
      outcome: 'SUCCESS',
      ipAddress: attempt.ipAddress,
      userId: attempt.userId,
      details: {
        success: attempt.success,
        riskScore: pattern?.riskScore || 0,
        isBlocked: pattern?.isBlocked || false,
      },
    });
  }

  /**
   * Check if an IP is currently blocked
   */
  isIPBlocked(ipAddress: string): boolean {
    const blockInfo = this.blockedIPs.get(ipAddress);
    if (!blockInfo) return false;

    if (blockInfo.expiry && new Date() > blockInfo.expiry) {
      this.blockedIPs.delete(ipAddress);
      const pattern = this.patterns.get(ipAddress);
      if (pattern) {
        pattern.isBlocked = false;
        pattern.blockExpiry = undefined;
      }
      return false;
    }

    return true;
  }

  /**
   * Get login pattern for an IP
   */
  getPattern(ipAddress: string): LoginPattern | undefined {
    return this.patterns.get(ipAddress);
  }

  /**
   * Get all current patterns with risk analysis
   */
  getAllPatterns(): Array<LoginPattern & { analysis: PatternAnalysis }> {
    return Array.from(this.patterns.values()).map(pattern => ({
      ...pattern,
      analysis: this.analyzePattern(pattern),
    }));
  }

  /**
   * Manually block an IP address
   */
  async blockIP(
    ipAddress: string,
    durationMinutes: number,
    reason: string,
    blockedBy: string
  ): Promise<void> {
    const expiry = new Date(Date.now() + durationMinutes * 60 * 1000);

    this.blockedIPs.set(ipAddress, {
      blockedAt: new Date(),
      expiry,
      reason,
      blockedBy,
      automatic: false,
    });

    const pattern = this.patterns.get(ipAddress);
    if (pattern) {
      pattern.isBlocked = true;
      pattern.blockExpiry = expiry;
    }

    await this.auditService.logSecurityEvent('ip_manually_blocked', 'HIGH', ipAddress, {
      reason,
      blockedBy,
      durationMinutes,
    });

    this.emit('ipBlocked', { ipAddress, reason, durationMinutes, manual: true });
  }

  /**
   * Unblock an IP address
   */
  async unblockIP(ipAddress: string, unblockedBy: string): Promise<boolean> {
    const wasBlocked = this.blockedIPs.delete(ipAddress);

    if (wasBlocked) {
      const pattern = this.patterns.get(ipAddress);
      if (pattern) {
        pattern.isBlocked = false;
        pattern.blockExpiry = undefined;
      }

      await this.auditService.logSecurityEvent('ip_unblocked', 'MEDIUM', ipAddress, {
        unblockedBy,
      });

      this.emit('ipUnblocked', { ipAddress, unblockedBy });
    }

    return wasBlocked;
  }

  /**
   * Update login pattern for an IP
   */
  private updatePattern(attempt: LoginAttempt): void {
    const pattern = this.patterns.get(attempt.ipAddress) || {
      ipAddress: attempt.ipAddress,
      attempts: [],
      failureCount: 0,
      successCount: 0,
      firstAttempt: attempt.timestamp,
      lastAttempt: attempt.timestamp,
      riskScore: 0,
      isBlocked: false,
    };

    pattern.attempts.push(attempt);
    pattern.lastAttempt = attempt.timestamp;

    if (attempt.success) {
      pattern.successCount++;
    } else {
      pattern.failureCount++;
    }

    // Keep only recent attempts within time window
    const cutoffTime = new Date(
      attempt.timestamp.getTime() - this.config.timeWindowMinutes * 60 * 1000
    );
    pattern.attempts = pattern.attempts.filter(a => a.timestamp > cutoffTime);

    // Recalculate counts from filtered attempts
    pattern.failureCount = pattern.attempts.filter(a => !a.success).length;
    pattern.successCount = pattern.attempts.filter(a => a.success).length;

    // Calculate risk score
    pattern.riskScore = this.calculateRiskScore(pattern);

    this.patterns.set(attempt.ipAddress, pattern);
  }

  /**
   * Update user behavior tracking
   */
  private updateUserBehavior(attempt: LoginAttempt): void {
    if (!attempt.userId) return;

    const behavior = this.userPatterns.get(attempt.userId) || {
      userId: attempt.userId,
      successfulLogins: 0,
      failedLogins: 0,
      uniqueIPs: new Set(),
      uniqueUserAgents: new Set(),
      typicalHours: new Map(),
      firstSeen: attempt.timestamp,
      lastSeen: attempt.timestamp,
    };

    behavior.lastSeen = attempt.timestamp;
    behavior.uniqueIPs.add(attempt.ipAddress);
    behavior.uniqueUserAgents.add(attempt.userAgent);

    const hour = attempt.timestamp.getHours();
    behavior.typicalHours.set(hour, (behavior.typicalHours.get(hour) || 0) + 1);

    if (attempt.success) {
      behavior.successfulLogins++;
    } else {
      behavior.failedLogins++;
    }

    this.userPatterns.set(attempt.userId, behavior);
  }

  /**
   * Analyze failed attempt and trigger alerts if needed
   */
  private async analyzeFailedAttempt(pattern: LoginPattern, attempt: LoginAttempt): Promise<void> {
    const threshold = this.getAdaptiveThreshold(pattern);

    if (pattern.failureCount >= threshold) {
      const alertType = this.determineAlertType(pattern);
      const severity = this.determineSeverity(pattern);

      await this.triggerAlert(pattern, alertType, severity);

      if (severity === 'HIGH' || severity === 'CRITICAL') {
        await this.blockIPAutomatically(pattern);
      }
    }
  }

  /**
   * Calculate adaptive threshold based on pattern analysis
   */
  private getAdaptiveThreshold(pattern: LoginPattern): number {
    if (!this.config.adaptiveThresholds) {
      return this.config.maxFailedAttempts;
    }

    let threshold = this.config.maxFailedAttempts;

    // Adjust based on IP reputation
    if (this.suspiciousIPs.has(pattern.ipAddress)) {
      threshold = Math.ceil(threshold * 0.7); // Lower threshold for suspicious IPs
    }

    // Adjust based on success rate
    const totalAttempts = pattern.successCount + pattern.failureCount;
    if (totalAttempts > 0) {
      const successRate = pattern.successCount / totalAttempts;
      if (successRate < 0.1) {
        threshold = Math.ceil(threshold * 0.8); // Lower threshold for low success rate
      }
    }

    // Adjust based on time distribution
    const timeSpread = this.calculateTimeSpread(pattern.attempts);
    if (timeSpread < 60) {
      // Attempts within 1 minute
      threshold = Math.ceil(threshold * 0.6); // Much lower threshold for rapid attempts
    }

    return Math.max(threshold, 3); // Minimum threshold of 3
  }

  /**
   * Calculate risk score for a pattern
   */
  private calculateRiskScore(pattern: LoginPattern): number {
    let score = 0;

    // Base score from failure rate
    const totalAttempts = pattern.successCount + pattern.failureCount;
    if (totalAttempts > 0) {
      const failureRate = pattern.failureCount / totalAttempts;
      score += failureRate * 40;
    }

    // Volume score
    score += Math.min(pattern.failureCount * 5, 30);

    // Velocity score
    if (pattern.attempts.length > 1) {
      const timeSpan = pattern.lastAttempt.getTime() - pattern.firstAttempt.getTime();
      const velocity = (pattern.attempts.length / (timeSpan / 1000)) * 60; // attempts per minute
      score += Math.min(velocity * 10, 20);
    }

    // Time-based factors
    const hour = pattern.lastAttempt.getHours();
    if (hour < 6 || hour > 22) {
      score += 10; // Off-hours bonus
    }

    // IP reputation
    if (this.suspiciousIPs.has(pattern.ipAddress)) {
      score += 15;
    }

    // User agent diversity
    const uniqueUserAgents = new Set(pattern.attempts.map(a => a.userAgent));
    if (uniqueUserAgents.size > 3) {
      score += 10; // Multiple user agents from same IP
    }

    return Math.min(score, 100);
  }

  /**
   * Determine alert type based on pattern analysis
   */
  private determineAlertType(pattern: LoginPattern): FailedLoginAlert['alertType'] {
    const uniqueUsers = new Set(pattern.attempts.map(a => a.userId).filter(Boolean));

    if (uniqueUsers.size > 5) {
      return 'CREDENTIAL_STUFFING';
    }

    const timeSpread = this.calculateTimeSpread(pattern.attempts);
    if (timeSpread < 120 && pattern.failureCount > 10) {
      return 'BRUTE_FORCE';
    }

    // Check for distributed attack (same user from multiple IPs)
    if (pattern.attempts.length > 0 && pattern.attempts[0].userId) {
      const userBehavior = this.userPatterns.get(pattern.attempts[0].userId);
      if (userBehavior && userBehavior.uniqueIPs.size > 5) {
        return 'DISTRIBUTED_ATTACK';
      }
    }

    return 'THRESHOLD_EXCEEDED';
  }

  /**
   * Determine severity based on risk factors
   */
  private determineSeverity(pattern: LoginPattern): FailedLoginAlert['severity'] {
    if (pattern.riskScore >= 80) return 'CRITICAL';
    if (pattern.riskScore >= 60) return 'HIGH';
    if (pattern.riskScore >= 30) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Trigger security alert
   */
  private async triggerAlert(
    pattern: LoginPattern,
    alertType: FailedLoginAlert['alertType'],
    severity: FailedLoginAlert['severity']
  ): Promise<void> {
    const riskFactors = this.identifyRiskFactors(pattern);
    const recommendations = this.generateRecommendations(pattern, alertType);

    const alert: FailedLoginAlert = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ipAddress: pattern.ipAddress,
      userId: pattern.attempts.find(a => a.userId)?.userId,
      alertType,
      severity,
      attemptCount: pattern.failureCount,
      timeWindow: this.config.timeWindowMinutes,
      riskFactors,
      recommendedActions: recommendations,
      metadata: {
        riskScore: pattern.riskScore,
        uniqueUserAgents: new Set(pattern.attempts.map(a => a.userAgent)).size,
        firstAttempt: pattern.firstAttempt,
        lastAttempt: pattern.lastAttempt,
      },
    };

    this.emit('failedLoginAlert', alert);

    await this.auditService.logSecurityEvent(
      `failed_login_${alertType.toLowerCase()}`,
      severity,
      pattern.ipAddress,
      {
        alertId: alert.id,
        attemptCount: pattern.failureCount,
        riskScore: pattern.riskScore,
        riskFactors,
      }
    );
  }

  /**
   * Automatically block IP based on pattern analysis
   */
  private async blockIPAutomatically(pattern: LoginPattern): Promise<void> {
    const duration = this.calculateBlockDuration(pattern);
    const expiry = new Date(Date.now() + duration * 60 * 1000);

    this.blockedIPs.set(pattern.ipAddress, {
      blockedAt: new Date(),
      expiry,
      reason: `Automatic block: ${pattern.failureCount} failed attempts`,
      blockedBy: 'system',
      automatic: true,
    });

    pattern.isBlocked = true;
    pattern.blockExpiry = expiry;

    this.emit('ipBlocked', {
      ipAddress: pattern.ipAddress,
      reason: 'Failed login threshold exceeded',
      durationMinutes: duration,
      manual: false,
    });
  }

  /**
   * Calculate block duration based on pattern severity
   */
  private calculateBlockDuration(pattern: LoginPattern): number {
    let duration = this.config.blockDurationMinutes;

    // Progressive penalties for repeat offenders
    const blockHistory = this.getBlockHistory(pattern.ipAddress);
    if (blockHistory > 0) {
      duration = Math.min(duration * Math.pow(2, blockHistory), 24 * 60); // Max 24 hours
    }

    // Adjust based on risk score
    if (pattern.riskScore > 80) {
      duration = Math.min(duration * 2, 24 * 60);
    }

    return duration;
  }

  /**
   * Identify risk factors for a pattern
   */
  private identifyRiskFactors(pattern: LoginPattern): string[] {
    const factors: string[] = [];

    if (pattern.failureCount > this.config.maxFailedAttempts * 2) {
      factors.push('Excessive failed attempts');
    }

    const timeSpread = this.calculateTimeSpread(pattern.attempts);
    if (timeSpread < 60) {
      factors.push('Rapid succession attempts');
    }

    const uniqueUsers = new Set(pattern.attempts.map(a => a.userId).filter(Boolean));
    if (uniqueUsers.size > 3) {
      factors.push('Multiple user targets');
    }

    const uniqueUserAgents = new Set(pattern.attempts.map(a => a.userAgent));
    if (uniqueUserAgents.size > 3) {
      factors.push('Multiple user agents');
    }

    const hour = pattern.lastAttempt.getHours();
    if (hour < 6 || hour > 22) {
      factors.push('Off-hours activity');
    }

    if (this.suspiciousIPs.has(pattern.ipAddress)) {
      factors.push('Suspicious IP reputation');
    }

    return factors;
  }

  /**
   * Generate recommended actions
   */
  private generateRecommendations(
    pattern: LoginPattern,
    alertType: FailedLoginAlert['alertType']
  ): string[] {
    const recommendations: string[] = [];

    switch (alertType) {
      case 'BRUTE_FORCE':
        recommendations.push('Block IP immediately');
        recommendations.push('Review user account security');
        recommendations.push('Enable account lockout policies');
        break;

      case 'CREDENTIAL_STUFFING':
        recommendations.push('Implement CAPTCHA');
        recommendations.push('Force password reset for targeted accounts');
        recommendations.push('Enable MFA for affected users');
        break;

      case 'DISTRIBUTED_ATTACK':
        recommendations.push('Implement geo-blocking');
        recommendations.push('Review user behavior patterns');
        recommendations.push('Consider device fingerprinting');
        break;

      default:
        recommendations.push('Monitor closely');
        recommendations.push('Consider temporary IP block');
        break;
    }

    return recommendations;
  }

  /**
   * Utility methods
   */
  private calculateTimeSpread(attempts: LoginAttempt[]): number {
    if (attempts.length < 2) return 0;

    const times = attempts.map(a => a.timestamp.getTime()).sort();
    return (times[times.length - 1] - times[0]) / 1000; // seconds
  }

  private isWhitelisted(ipAddress: string): boolean {
    // Check exact IP matches
    if (this.config.whitelistedIPs.includes(ipAddress)) {
      return true;
    }

    // Check network ranges (simple CIDR check)
    return this.config.whitelistedNetworks.some(network => {
      // Implementation would include proper CIDR matching
      return ipAddress.startsWith(network.split('/')[0].slice(0, -1));
    });
  }

  private getBlockHistory(ipAddress: string): number {
    // Implementation would track historical blocks from database
    return 0;
  }

  private analyzePattern(pattern: LoginPattern): PatternAnalysis {
    return {
      riskLevel: pattern.riskScore > 60 ? 'HIGH' : pattern.riskScore > 30 ? 'MEDIUM' : 'LOW',
      behaviorType: this.classifyBehavior(pattern),
      recommendations: this.generateRecommendations(pattern, 'THRESHOLD_EXCEEDED'),
      nextReviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  private classifyBehavior(pattern: LoginPattern): string {
    const timeSpread = this.calculateTimeSpread(pattern.attempts);

    if (timeSpread < 60 && pattern.failureCount > 10) {
      return 'AUTOMATED_ATTACK';
    }

    if (pattern.successCount > 0) {
      return 'MIXED_BEHAVIOR';
    }

    return 'SUSPICIOUS_ACTIVITY';
  }

  private setupEventMonitoring(): void {
    this.auditService.on('auditEvent', (event: AuditEvent) => {
      if (event.eventType === 'AUTHENTICATION') {
        this.processLoginAttempt({
          userId: event.userId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent || 'unknown',
          timestamp: event.timestamp,
          success: event.outcome === 'SUCCESS',
          metadata: event.details,
        });
      }
    });
  }

  private setupPeriodicCleanup(): void {
    setInterval(() => {
      const cutoffTime = new Date(Date.now() - this.config.timeWindowMinutes * 60 * 1000 * 2);

      for (const [ip, pattern] of this.patterns.entries()) {
        if (pattern.lastAttempt < cutoffTime) {
          this.patterns.delete(ip);
        }
      }
    }, this.cleanupInterval);
  }

  private setupPeriodicAnalysis(): void {
    setInterval(() => {
      this.performPeriodicAnalysis();
    }, this.analysisInterval);
  }

  private async performPeriodicAnalysis(): Promise<void> {
    // Analyze patterns for emerging threats
    const highRiskPatterns = Array.from(this.patterns.values()).filter(
      p => p.riskScore > 50 && !p.isBlocked
    );

    for (const pattern of highRiskPatterns) {
      await this.auditService.logEvent({
        eventType: 'SECURITY_EVENT',
        category: 'WARNING',
        resource: 'login_detector',
        action: 'high_risk_pattern_detected',
        outcome: 'WARNING',
        ipAddress: pattern.ipAddress,
        details: {
          riskScore: pattern.riskScore,
          failureCount: pattern.failureCount,
          timeWindow: this.config.timeWindowMinutes,
        },
      });
    }
  }

  private loadWhitelistedIPs(): void {
    // Load from configuration or database
    this.config.whitelistedIPs = this.config.whitelistedIPs || [];
    this.config.whitelistedNetworks = this.config.whitelistedNetworks || [];
  }
}

// Interfaces
interface UserLoginBehavior {
  userId: string;
  successfulLogins: number;
  failedLogins: number;
  uniqueIPs: Set<string>;
  uniqueUserAgents: Set<string>;
  typicalHours: Map<number, number>;
  firstSeen: Date;
  lastSeen: Date;
}

interface BlockInfo {
  blockedAt: Date;
  expiry?: Date;
  reason: string;
  blockedBy: string;
  automatic: boolean;
}

interface PatternAnalysis {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  behaviorType: string;
  recommendations: string[];
  nextReviewDate: Date;
}
