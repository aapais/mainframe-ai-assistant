/**
 * Security System Integration
 * Central orchestration of all security components
 */

import { EventEmitter } from 'events';
import { AuditService, AuditStorage, AuditConfig } from './audit/AuditService';
import { SecurityEventMonitor, AlertHandler } from './monitoring/SecurityEventMonitor';
import { FailedLoginDetector, DetectionConfig } from './detection/FailedLoginDetector';
import {
  SuspiciousActivityAlert,
  SuspiciousActivityConfig,
} from './detection/SuspiciousActivityAlert';
import { KeyAccessTracker, KeyTrackerConfig } from './tracking/KeyAccessTracker';
import { SessionMonitor, SessionPolicy, SessionMonitorConfig } from './tracking/SessionMonitor';
import { IPAllowlistManager, AllowlistConfig } from './detection/IPAllowlistManager';
import { AdvancedRateLimit, RateLimitConfig } from './detection/AdvancedRateLimit';
import { ComplianceReporter, ComplianceConfig } from './compliance/ComplianceReporter';

export interface SecuritySystemConfig {
  audit: AuditConfig;
  monitoring: {
    enableRealTimeAlerts: boolean;
    alertChannels: string[];
    escalationRules: EscalationRule[];
  };
  failedLogin: DetectionConfig;
  suspiciousActivity: SuspiciousActivityConfig;
  keyTracking: KeyTrackerConfig;
  sessionPolicy: SessionPolicy;
  sessionMonitor: SessionMonitorConfig;
  ipAllowlist: AllowlistConfig;
  rateLimit: RateLimitConfig;
  compliance: ComplianceConfig;
  integration: IntegrationConfig;
}

export interface EscalationRule {
  id: string;
  condition: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actions: string[];
  timeout: number;
}

export interface IntegrationConfig {
  enableCrossComponentLearning: boolean;
  enableAutomatedResponse: boolean;
  enableThreatIntelligence: boolean;
  enableMetrics: boolean;
  metricsInterval: number;
}

export interface SecurityMetrics {
  timestamp: Date;
  auditEvents: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  alerts: {
    total: number;
    resolved: number;
    pending: number;
    byType: Record<string, number>;
  };
  authentication: {
    totalAttempts: number;
    successfulLogins: number;
    failedLogins: number;
    blockedAttempts: number;
  };
  apiAccess: {
    totalRequests: number;
    blockedRequests: number;
    rateLimitViolations: number;
    keyViolations: number;
  };
  compliance: {
    overallScore: number;
    activeFindings: number;
    resolvedFindings: number;
  };
  performance: {
    averageResponseTime: number;
    throughput: number;
    errorRate: number;
  };
}

export interface ThreatIntelligence {
  ip: string;
  reputation: number;
  sources: string[];
  lastUpdated: Date;
  threatTypes: string[];
  indicators: Record<string, any>;
}

export class SecurityIntegration extends EventEmitter implements AlertHandler {
  private auditService: AuditService;
  private eventMonitor: SecurityEventMonitor;
  private failedLoginDetector: FailedLoginDetector;
  private suspiciousActivityAlert: SuspiciousActivityAlert;
  private keyAccessTracker: KeyAccessTracker;
  private sessionMonitor: SessionMonitor;
  private ipAllowlistManager: IPAllowlistManager;
  private rateLimiter: AdvancedRateLimit;
  private complianceReporter: ComplianceReporter;

  private threatIntelligence: Map<string, ThreatIntelligence> = new Map();
  private securityMetrics: SecurityMetrics[] = [];
  private blockedEntities: Set<string> = new Set();
  private quarantinedUsers: Set<string> = new Set();

  constructor(
    private config: SecuritySystemConfig,
    auditStorage: AuditStorage
  ) {
    super();
    this.initializeComponents(auditStorage);
    this.setupIntegrations();
    this.setupMetricsCollection();
  }

  /**
   * Initialize all security components
   */
  private initializeComponents(auditStorage: AuditStorage): void {
    // Initialize audit service
    this.auditService = new AuditService(auditStorage, this.config.audit);

    // Initialize monitoring
    this.eventMonitor = new SecurityEventMonitor(this.auditService, this);

    // Initialize detection components
    this.failedLoginDetector = new FailedLoginDetector(this.auditService, this.config.failedLogin);
    this.suspiciousActivityAlert = new SuspiciousActivityAlert(
      this.auditService,
      this.config.suspiciousActivity
    );

    // Initialize tracking components
    this.keyAccessTracker = new KeyAccessTracker(this.auditService, this.config.keyTracking);
    this.sessionMonitor = new SessionMonitor(
      this.auditService,
      this.config.sessionPolicy,
      this.config.sessionMonitor
    );

    // Initialize protection components
    this.ipAllowlistManager = new IPAllowlistManager(this.auditService, this.config.ipAllowlist);
    this.rateLimiter = new AdvancedRateLimit(this.auditService, this.config.rateLimit);

    // Initialize compliance reporting
    this.complianceReporter = new ComplianceReporter(this.auditService, this.config.compliance);
  }

  /**
   * Setup cross-component integrations
   */
  private setupIntegrations(): void {
    // Failed login detector integration
    this.failedLoginDetector.on('failedLoginAlert', async alert => {
      // Auto-add to IP allowlist if severe
      if (alert.severity === 'HIGH' || alert.severity === 'CRITICAL') {
        await this.ipAllowlistManager.autoBlockIP(
          alert.ipAddress,
          alert.alertType === 'BRUTE_FORCE' ? 'BRUTE_FORCE' : 'ABUSE',
          { alert },
          60 // 1 hour
        );
      }

      // Update rate limiting
      if (alert.alertType === 'BRUTE_FORCE') {
        await this.rateLimiter.blockKey(
          `ip:${alert.ipAddress}`,
          3600,
          'Brute force attack detected',
          'system'
        );
      }

      this.emit('integratedThreatResponse', {
        type: 'failed_login',
        alert,
        actions: ['ip_blocked', 'rate_limited'],
      });
    });

    // Suspicious activity integration
    this.suspiciousActivityAlert.on('suspiciousActivity', async alert => {
      // Terminate all user sessions if critical
      if (alert.severity === 'CRITICAL') {
        await this.sessionMonitor.terminateAllUserSessions(
          alert.userId,
          'Suspicious activity detected',
          'security_system'
        );

        // Quarantine user
        await this.quarantineUser(alert.userId, 'Critical suspicious activity');
      }

      this.emit('integratedThreatResponse', {
        type: 'suspicious_activity',
        alert,
        actions: ['sessions_terminated', 'user_quarantined'],
      });
    });

    // Key access tracker integration
    this.keyAccessTracker.on('keyAlert', async alert => {
      // Block IP if key violation is severe
      if (alert.severity === 'HIGH' || alert.severity === 'CRITICAL') {
        await this.ipAllowlistManager.autoBlockIP(
          'unknown', // Would extract IP from alert context
          'ABUSE',
          { keyAlert: alert },
          120 // 2 hours
        );
      }
    });

    // Session monitor integration
    this.sessionMonitor.on('sessionAlert', async alert => {
      // Block IP for session hijacking
      if (alert.alertType === 'SESSION_HIJACK') {
        await this.ipAllowlistManager.autoBlockIP(
          alert.session.ipAddress,
          'ABUSE',
          { sessionHijack: true },
          240 // 4 hours
        );
      }
    });

    // IP allowlist integration with rate limiter
    this.ipAllowlistManager.on('allowlistEvent', event => {
      if (event.eventType === 'BLOCKED') {
        this.blockedEntities.add(event.ipAddress);
      }
    });

    // Rate limiter integration
    this.rateLimiter.on('keyBlocked', event => {
      this.blockedEntities.add(event.key);
    });

    // Cross-component learning
    if (this.config.integration.enableCrossComponentLearning) {
      this.setupCrossComponentLearning();
    }

    // Automated response
    if (this.config.integration.enableAutomatedResponse) {
      this.setupAutomatedResponse();
    }
  }

  /**
   * Public API methods
   */

  /**
   * Process a security event
   */
  async processSecurityEvent(
    eventType: string,
    data: Record<string, any>,
    context: SecurityContext
  ): Promise<SecurityResponse> {
    const startTime = Date.now();

    try {
      // Log the event
      const eventId = await this.auditService.logEvent({
        eventType: eventType as any,
        category: 'SECURITY',
        resource: context.resource || 'security_system',
        action: context.action || 'process_event',
        outcome: 'SUCCESS',
        ipAddress: context.ipAddress,
        userId: context.userId,
        details: data,
      });

      // Check IP allowlist
      const ipCheckResult = await this.ipAllowlistManager.checkIP(context.ipAddress, {
        endpoint: context.resource,
        method: context.action,
        timestamp: new Date(),
      });

      if (ipCheckResult.action === 'BLOCK') {
        return {
          allowed: false,
          reason: 'IP blocked',
          riskScore: ipCheckResult.riskScore,
          actions: ['blocked'],
          processingTime: Date.now() - startTime,
        };
      }

      // Check rate limits
      const rateLimitResult = await this.rateLimiter.checkRateLimit({
        ipAddress: context.ipAddress,
        userId: context.userId,
        endpoint: context.resource || 'unknown',
        method: context.action || 'unknown',
        timestamp: new Date(),
        riskScore: ipCheckResult.riskScore,
      });

      if (!rateLimitResult.allowed) {
        return {
          allowed: false,
          reason: 'Rate limit exceeded',
          riskScore: rateLimitResult.riskScore,
          actions: ['rate_limited'],
          retryAfter: rateLimitResult.retryAfter,
          processingTime: Date.now() - startTime,
        };
      }

      // Process through other components based on event type
      const actions: string[] = [];
      let riskScore = Math.max(ipCheckResult.riskScore, rateLimitResult.riskScore);

      switch (eventType) {
        case 'LOGIN_ATTEMPT':
          if (context.userId && data.success === false) {
            await this.failedLoginDetector.processLoginAttempt({
              userId: context.userId,
              ipAddress: context.ipAddress,
              userAgent: context.userAgent || 'unknown',
              timestamp: new Date(),
              success: false,
              metadata: data,
            });
          }
          break;

        case 'API_ACCESS':
          if (data.apiKey) {
            const keyResult = await this.keyAccessTracker.trackKeyUsage(data.apiKey, {
              endpoint: context.resource || 'unknown',
              method: context.action || 'GET',
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
              statusCode: data.statusCode || 200,
              responseTime: data.responseTime,
              timestamp: new Date(),
            });

            if (!keyResult.allowed) {
              return {
                allowed: false,
                reason: keyResult.reason || 'API key access denied',
                riskScore: keyResult.riskScore,
                actions: ['api_key_blocked'],
                processingTime: Date.now() - startTime,
              };
            }

            riskScore = Math.max(riskScore, keyResult.riskScore);
          }
          break;

        case 'SESSION_ACTIVITY':
          if (context.sessionId) {
            await this.sessionMonitor.updateSessionActivity(context.sessionId, {
              action: context.action || 'unknown',
              resource: context.resource || 'unknown',
              outcome: data.success ? 'SUCCESS' : 'FAILURE',
              details: data,
            });
          }
          break;
      }

      return {
        allowed: true,
        riskScore,
        actions,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Error processing security event:', error);

      return {
        allowed: false,
        reason: 'Internal security error',
        riskScore: 100,
        actions: ['error'],
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get comprehensive security status
   */
  getSecurityStatus(): SecurityStatus {
    return {
      systemHealth: 'HEALTHY', // Would be calculated based on component status
      threatLevel: this.calculateOverallThreatLevel(),
      activeThreats: this.getActiveThreats(),
      blockedEntities: this.blockedEntities.size,
      quarantinedUsers: this.quarantinedUsers.size,
      complianceScore: 85, // Would get from compliance reporter
      recentMetrics: this.getRecentMetrics(),
      componentStatus: {
        audit: 'OPERATIONAL',
        monitoring: 'OPERATIONAL',
        failedLogin: 'OPERATIONAL',
        suspiciousActivity: 'OPERATIONAL',
        keyTracking: 'OPERATIONAL',
        sessionMonitor: 'OPERATIONAL',
        ipAllowlist: 'OPERATIONAL',
        rateLimit: 'OPERATIONAL',
        compliance: 'OPERATIONAL',
      },
    };
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(
    period: { start: Date; end: Date },
    format: 'JSON' | 'PDF' | 'CSV' = 'JSON'
  ): Promise<Buffer> {
    const report = {
      period,
      generatedAt: new Date(),
      summary: {
        totalEvents: await this.getTotalEvents(period),
        securityIncidents: await this.getSecurityIncidents(period),
        blockedThreats: await this.getBlockedThreats(period),
        complianceScore: await this.getComplianceScore(period),
      },
      metrics: this.getMetricsForPeriod(period),
      threats: await this.getThreatAnalysis(period),
      recommendations: await this.generateSecurityRecommendations(),
    };

    switch (format) {
      case 'JSON':
        return Buffer.from(JSON.stringify(report, null, 2));
      case 'CSV':
        return this.generateReportCSV(report);
      case 'PDF':
        return this.generateReportPDF(report);
      default:
        return Buffer.from(JSON.stringify(report, null, 2));
    }
  }

  /**
   * AlertHandler interface implementation
   */
  async sendAlert(alert: any, config: Record<string, any>): Promise<void> {
    const alertData = {
      timestamp: new Date(),
      type: alert.ruleName || alert.type || 'SECURITY_ALERT',
      severity: alert.severity,
      description: alert.description,
      metadata: alert.metadata || {},
    };

    // Send to configured channels
    for (const channel of this.config.monitoring.alertChannels) {
      await this.sendAlertToChannel(alertData, channel, config);
    }

    this.emit('alertSent', alertData);
  }

  async sendNotification(alert: any, config: Record<string, any>): Promise<void> {
    // Send notification (less urgent than alert)
    await this.sendAlert(alert, { ...config, priority: 'low' });
  }

  async blockEntity(identifier: string, duration: number, reason: string): Promise<void> {
    this.blockedEntities.add(identifier);

    // Set timeout to unblock
    setTimeout(() => {
      this.blockedEntities.delete(identifier);
      this.emit('entityUnblocked', { identifier, reason: 'Timeout expired' });
    }, duration * 1000);

    this.emit('entityBlocked', { identifier, duration, reason });
  }

  async quarantineUser(userId: string, reason: string): Promise<void> {
    this.quarantinedUsers.add(userId);

    // Terminate all user sessions
    await this.sessionMonitor.terminateAllUserSessions(
      userId,
      `User quarantined: ${reason}`,
      'security_system'
    );

    await this.auditService.logSecurityEvent('user_quarantined', 'HIGH', 'system', {
      userId,
      reason,
    });

    this.emit('userQuarantined', { userId, reason });
  }

  /**
   * Private helper methods
   */
  private setupCrossComponentLearning(): void {
    // Implement machine learning integration for cross-component insights
    // This would analyze patterns across all components to improve detection
  }

  private setupAutomatedResponse(): void {
    // Setup automated response rules
    this.on('integratedThreatResponse', async response => {
      // Implement automated response logic
      if (response.alert.severity === 'CRITICAL') {
        // Escalate to security team
        await this.escalateToSecurityTeam(response);
      }
    });
  }

  private setupMetricsCollection(): void {
    if (!this.config.integration.enableMetrics) return;

    setInterval(async () => {
      const metrics = await this.collectSecurityMetrics();
      this.securityMetrics.push(metrics);

      // Keep only recent metrics (last 30 days)
      const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      this.securityMetrics = this.securityMetrics.filter(m => m.timestamp > cutoffTime);

      this.emit('metricsCollected', metrics);
    }, this.config.integration.metricsInterval || 300000); // 5 minutes
  }

  private async collectSecurityMetrics(): Promise<SecurityMetrics> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Collect metrics from all components
    const auditEvents = await this.auditService.queryEvents({
      startDate: oneHourAgo,
      endDate: now,
      limit: 10000,
    });

    return {
      timestamp: now,
      auditEvents: {
        total: auditEvents.length,
        byType: this.groupEventsByType(auditEvents),
        bySeverity: this.groupEventsBySeverity(auditEvents),
      },
      alerts: {
        total: 0, // Would be calculated from alert history
        resolved: 0,
        pending: 0,
        byType: {},
      },
      authentication: {
        totalAttempts: this.countAuthenticationEvents(auditEvents),
        successfulLogins: this.countSuccessfulLogins(auditEvents),
        failedLogins: this.countFailedLogins(auditEvents),
        blockedAttempts: 0, // Would be calculated
      },
      apiAccess: {
        totalRequests: this.countApiRequests(auditEvents),
        blockedRequests: 0,
        rateLimitViolations: 0,
        keyViolations: 0,
      },
      compliance: {
        overallScore: 85, // Would get from compliance reporter
        activeFindings: 0,
        resolvedFindings: 0,
      },
      performance: {
        averageResponseTime: 150, // Would be calculated
        throughput: auditEvents.length,
        errorRate: 0.05,
      },
    };
  }

  private calculateOverallThreatLevel(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    // Calculate based on recent metrics and active threats
    if (this.blockedEntities.size > 100) return 'CRITICAL';
    if (this.blockedEntities.size > 50) return 'HIGH';
    if (this.blockedEntities.size > 10) return 'MEDIUM';
    return 'LOW';
  }

  private getActiveThreats(): Array<{ type: string; count: number; severity: string }> {
    // Return summary of active threats
    return [
      { type: 'BLOCKED_IPS', count: this.blockedEntities.size, severity: 'MEDIUM' },
      { type: 'QUARANTINED_USERS', count: this.quarantinedUsers.size, severity: 'HIGH' },
    ];
  }

  private getRecentMetrics(): SecurityMetrics | null {
    return this.securityMetrics.length > 0
      ? this.securityMetrics[this.securityMetrics.length - 1]
      : null;
  }

  private async sendAlertToChannel(
    alert: any,
    channel: string,
    config: Record<string, any>
  ): Promise<void> {
    // Implementation would send to actual channels (email, Slack, etc.)
    console.log(`Sending alert to ${channel}:`, alert);
  }

  private async escalateToSecurityTeam(response: any): Promise<void> {
    // Implementation would escalate to security team
    console.log('Escalating to security team:', response);
  }

  // Helper methods for metrics
  private groupEventsByType(events: any[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const event of events) {
      grouped[event.eventType] = (grouped[event.eventType] || 0) + 1;
    }
    return grouped;
  }

  private groupEventsBySeverity(events: any[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const event of events) {
      grouped[event.severity] = (grouped[event.severity] || 0) + 1;
    }
    return grouped;
  }

  private countAuthenticationEvents(events: any[]): number {
    return events.filter(e => e.eventType === 'AUTHENTICATION').length;
  }

  private countSuccessfulLogins(events: any[]): number {
    return events.filter(e => e.eventType === 'AUTHENTICATION' && e.outcome === 'SUCCESS').length;
  }

  private countFailedLogins(events: any[]): number {
    return events.filter(e => e.eventType === 'AUTHENTICATION' && e.outcome === 'FAILURE').length;
  }

  private countApiRequests(events: any[]): number {
    return events.filter(e => e.eventType === 'API_ACCESS').length;
  }

  private getMetricsForPeriod(period: { start: Date; end: Date }): SecurityMetrics[] {
    return this.securityMetrics.filter(
      m => m.timestamp >= period.start && m.timestamp <= period.end
    );
  }

  private async getTotalEvents(period: { start: Date; end: Date }): Promise<number> {
    const events = await this.auditService.queryEvents({
      startDate: period.start,
      endDate: period.end,
      limit: 100000,
    });
    return events.length;
  }

  private async getSecurityIncidents(period: { start: Date; end: Date }): Promise<number> {
    // Count security incidents in period
    return 5; // Mock data
  }

  private async getBlockedThreats(period: { start: Date; end: Date }): Promise<number> {
    // Count blocked threats in period
    return 25; // Mock data
  }

  private async getComplianceScore(period: { start: Date; end: Date }): Promise<number> {
    // Get compliance score for period
    return 85; // Mock data
  }

  private async getThreatAnalysis(period: { start: Date; end: Date }): Promise<any> {
    // Analyze threats for period
    return {
      topThreats: [],
      threatTrends: [],
      mitigationEffectiveness: {},
    };
  }

  private async generateSecurityRecommendations(): Promise<string[]> {
    return [
      'Implement additional MFA requirements for high-risk users',
      'Review and update IP allowlist rules',
      'Enhance rate limiting for API endpoints',
      'Conduct security awareness training',
    ];
  }

  private generateReportCSV(report: any): Buffer {
    // Generate CSV format of report
    return Buffer.from(JSON.stringify(report));
  }

  private generateReportPDF(report: any): Buffer {
    // Generate PDF format of report
    return Buffer.from(JSON.stringify(report));
  }
}

// Additional interfaces
export interface SecurityContext {
  ipAddress: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  timestamp?: Date;
}

export interface SecurityResponse {
  allowed: boolean;
  reason?: string;
  riskScore: number;
  actions: string[];
  retryAfter?: number;
  processingTime: number;
}

export interface SecurityStatus {
  systemHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  activeThreats: Array<{ type: string; count: number; severity: string }>;
  blockedEntities: number;
  quarantinedUsers: number;
  complianceScore: number;
  recentMetrics: SecurityMetrics | null;
  componentStatus: Record<string, 'OPERATIONAL' | 'DEGRADED' | 'FAILED'>;
}
