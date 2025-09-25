/**
 * Comprehensive Audit Service
 * Provides centralized audit logging with advanced security event tracking
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent?: string;
  eventType: AuditEventType;
  category: AuditCategory;
  resource: string;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'WARNING';
  details: Record<string, any>;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  metadata?: Record<string, any>;
}

export enum AuditEventType {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  SYSTEM_ACCESS = 'SYSTEM_ACCESS',
  API_ACCESS = 'API_ACCESS',
  SECURITY_EVENT = 'SECURITY_EVENT',
  ADMIN_ACTION = 'ADMIN_ACTION',
  CONFIGURATION_CHANGE = 'CONFIGURATION_CHANGE',
  COMPLIANCE_EVENT = 'COMPLIANCE_EVENT'
}

export enum AuditCategory {
  SECURITY = 'SECURITY',
  COMPLIANCE = 'COMPLIANCE',
  PERFORMANCE = 'PERFORMANCE',
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO'
}

export class AuditService extends EventEmitter {
  private auditQueue: AuditEvent[] = [];
  private batchSize = 100;
  private flushInterval = 5000; // 5 seconds
  private retentionDays = 90;
  private isFlushingBatch = false;

  constructor(
    private storage: AuditStorage,
    private config: AuditConfig
  ) {
    super();
    this.setupBatchProcessing();
    this.setupRetentionCleanup();
  }

  /**
   * Log audit event with automatic risk scoring
   */
  async logEvent(event: Partial<AuditEvent>): Promise<string> {
    const auditEvent: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      severity: 'LOW',
      riskScore: 0,
      outcome: 'SUCCESS',
      ...event,
      ipAddress: event.ipAddress || 'unknown',
      eventType: event.eventType || AuditEventType.SYSTEM_ACCESS,
      category: event.category || AuditCategory.INFO,
      resource: event.resource || 'unknown',
      action: event.action || 'unknown'
    };

    // Calculate risk score
    auditEvent.riskScore = this.calculateRiskScore(auditEvent);
    auditEvent.severity = this.determineSeverity(auditEvent.riskScore);

    // Add to queue
    this.auditQueue.push(auditEvent);

    // Emit for real-time monitoring
    this.emit('auditEvent', auditEvent);

    // Trigger immediate flush for critical events
    if (auditEvent.severity === 'CRITICAL' || auditEvent.riskScore > 80) {
      await this.flushBatch();
      this.emit('criticalEvent', auditEvent);
    }

    return auditEvent.id;
  }

  /**
   * Log authentication events
   */
  async logAuthentication(
    userId: string,
    outcome: 'SUCCESS' | 'FAILURE',
    ipAddress: string,
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent({
      userId,
      eventType: AuditEventType.AUTHENTICATION,
      category: AuditCategory.SECURITY,
      resource: 'authentication',
      action: 'login_attempt',
      outcome,
      ipAddress,
      details: {
        ...details,
        attemptTime: new Date().toISOString()
      }
    });
  }

  /**
   * Log API access events
   */
  async logApiAccess(
    userId: string | undefined,
    endpoint: string,
    method: string,
    statusCode: number,
    ipAddress: string,
    apiKey?: string,
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent({
      userId,
      eventType: AuditEventType.API_ACCESS,
      category: statusCode >= 400 ? AuditCategory.ERROR : AuditCategory.INFO,
      resource: endpoint,
      action: method,
      outcome: statusCode < 400 ? 'SUCCESS' : 'FAILURE',
      ipAddress,
      details: {
        ...details,
        statusCode,
        apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : undefined,
        responseTime: details.responseTime
      }
    });
  }

  /**
   * Log data access events
   */
  async logDataAccess(
    userId: string,
    resource: string,
    action: string,
    outcome: 'SUCCESS' | 'FAILURE',
    ipAddress: string,
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent({
      userId,
      eventType: AuditEventType.DATA_ACCESS,
      category: AuditCategory.COMPLIANCE,
      resource,
      action,
      outcome,
      ipAddress,
      details
    });
  }

  /**
   * Log security events
   */
  async logSecurityEvent(
    eventType: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    ipAddress: string,
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent({
      eventType: AuditEventType.SECURITY_EVENT,
      category: AuditCategory.SECURITY,
      resource: 'security_system',
      action: eventType,
      outcome: severity === 'CRITICAL' ? 'FAILURE' : 'WARNING',
      severity,
      ipAddress,
      details
    });
  }

  /**
   * Query audit events with filters
   */
  async queryEvents(filters: AuditQueryFilters): Promise<AuditEvent[]> {
    await this.flushBatch(); // Ensure latest events are persisted
    return this.storage.query(filters);
  }

  /**
   * Get audit statistics
   */
  async getStatistics(timeRange: TimeRange): Promise<AuditStatistics> {
    return this.storage.getStatistics(timeRange);
  }

  /**
   * Export audit events for compliance
   */
  async exportEvents(
    filters: AuditQueryFilters,
    format: 'JSON' | 'CSV' | 'PDF' = 'JSON'
  ): Promise<Buffer> {
    const events = await this.queryEvents(filters);

    switch (format) {
      case 'CSV':
        return this.exportToCsv(events);
      case 'PDF':
        return this.exportToPdf(events);
      default:
        return Buffer.from(JSON.stringify(events, null, 2));
    }
  }

  /**
   * Calculate risk score based on event characteristics
   */
  private calculateRiskScore(event: AuditEvent): number {
    let score = 0;

    // Base scores by event type
    const eventTypeScores: Record<AuditEventType, number> = {
      [AuditEventType.AUTHENTICATION]: 20,
      [AuditEventType.AUTHORIZATION]: 15,
      [AuditEventType.DATA_ACCESS]: 25,
      [AuditEventType.DATA_MODIFICATION]: 35,
      [AuditEventType.SYSTEM_ACCESS]: 30,
      [AuditEventType.API_ACCESS]: 10,
      [AuditEventType.SECURITY_EVENT]: 40,
      [AuditEventType.ADMIN_ACTION]: 45,
      [AuditEventType.CONFIGURATION_CHANGE]: 50,
      [AuditEventType.COMPLIANCE_EVENT]: 20
    };

    score += eventTypeScores[event.eventType] || 0;

    // Outcome multiplier
    if (event.outcome === 'FAILURE') score *= 1.5;
    if (event.outcome === 'WARNING') score *= 1.2;

    // Time-based factors
    const hour = event.timestamp.getHours();
    if (hour < 6 || hour > 22) score *= 1.3; // Off-hours activity

    // IP reputation (if available)
    if (event.details.suspiciousIp) score += 20;
    if (event.details.knownBadIp) score += 40;

    // User context
    if (!event.userId) score += 10; // Anonymous access
    if (event.details.newUser) score += 15;
    if (event.details.privilegedUser) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Determine severity based on risk score
   */
  private determineSeverity(riskScore: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (riskScore >= 80) return 'CRITICAL';
    if (riskScore >= 60) return 'HIGH';
    if (riskScore >= 30) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Setup batch processing for efficient storage
   */
  private setupBatchProcessing(): void {
    setInterval(async () => {
      if (this.auditQueue.length >= this.batchSize ||
          (this.auditQueue.length > 0 && !this.isFlushingBatch)) {
        await this.flushBatch();
      }
    }, this.flushInterval);
  }

  /**
   * Flush current batch to storage
   */
  private async flushBatch(): Promise<void> {
    if (this.isFlushingBatch || this.auditQueue.length === 0) return;

    this.isFlushingBatch = true;
    const batch = this.auditQueue.splice(0, this.batchSize);

    try {
      await this.storage.storeBatch(batch);
      this.emit('batchStored', { count: batch.length });
    } catch (error) {
      console.error('Failed to store audit batch:', error);
      // Re-queue failed events at the beginning
      this.auditQueue.unshift(...batch);
      this.emit('batchError', { error, count: batch.length });
    } finally {
      this.isFlushingBatch = false;
    }
  }

  /**
   * Setup retention cleanup
   */
  private setupRetentionCleanup(): void {
    // Run cleanup daily
    setInterval(async () => {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
        const deleted = await this.storage.cleanup(cutoffDate);
        this.emit('retentionCleanup', { deleted, cutoffDate });
      } catch (error) {
        console.error('Retention cleanup failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // Daily
  }

  /**
   * Export events to CSV format
   */
  private exportToCsv(events: AuditEvent[]): Buffer {
    const headers = [
      'ID', 'Timestamp', 'User ID', 'IP Address', 'Event Type',
      'Category', 'Resource', 'Action', 'Outcome', 'Severity', 'Risk Score'
    ];

    const rows = events.map(event => [
      event.id,
      event.timestamp.toISOString(),
      event.userId || '',
      event.ipAddress,
      event.eventType,
      event.category,
      event.resource,
      event.action,
      event.outcome,
      event.severity,
      event.riskScore.toString()
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return Buffer.from(csv);
  }

  /**
   * Export events to PDF format (placeholder)
   */
  private exportToPdf(events: AuditEvent[]): Buffer {
    // Implementation would use a PDF library like PDFKit
    return Buffer.from(JSON.stringify(events, null, 2));
  }
}

// Interfaces
export interface AuditStorage {
  storeBatch(events: AuditEvent[]): Promise<void>;
  query(filters: AuditQueryFilters): Promise<AuditEvent[]>;
  getStatistics(timeRange: TimeRange): Promise<AuditStatistics>;
  cleanup(cutoffDate: Date): Promise<number>;
}

export interface AuditConfig {
  batchSize?: number;
  flushInterval?: number;
  retentionDays?: number;
  enableRealTimeAlerts?: boolean;
  storage?: 'database' | 'file' | 'elasticsearch';
}

export interface AuditQueryFilters {
  userId?: string;
  eventType?: AuditEventType;
  category?: AuditCategory;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  severity?: string;
  outcome?: string;
  limit?: number;
  offset?: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface AuditStatistics {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsByCategory: Record<AuditCategory, number>;
  eventsBySeverity: Record<string, number>;
  topUsers: Array<{ userId: string; count: number }>;
  topIpAddresses: Array<{ ip: string; count: number }>;
  riskScoreDistribution: Record<string, number>;
  timelineData: Array<{ timestamp: Date; count: number }>;
}