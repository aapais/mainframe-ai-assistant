/**
 * Real-time Security Event Monitor
 * Provides continuous monitoring and threat detection
 */

import { EventEmitter } from 'events';
import { AuditService, AuditEvent } from '../audit/AuditService';

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  conditions: SecurityCondition[];
  actions: SecurityAction[];
  cooldownPeriod: number; // seconds
  lastTriggered?: Date;
}

export interface SecurityCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'regex' | 'in';
  value: any;
  timeWindow?: number; // seconds for time-based conditions
}

export interface SecurityAction {
  type: 'alert' | 'block' | 'log' | 'notify' | 'quarantine';
  config: Record<string, any>;
}

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  ruleId: string;
  ruleName: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  triggerEvent: AuditEvent;
  matchedConditions: SecurityCondition[];
  description: string;
  metadata: Record<string, any>;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_POSITIVE';
}

export class SecurityEventMonitor extends EventEmitter {
  private rules: Map<string, SecurityRule> = new Map();
  private eventBuffer: Map<string, AuditEvent[]> = new Map();
  private ruleMetrics: Map<string, RuleMetrics> = new Map();
  private bufferCleanupInterval = 60000; // 1 minute
  private maxBufferSize = 1000;

  constructor(
    private auditService: AuditService,
    private alertHandler: AlertHandler
  ) {
    super();
    this.setupEventMonitoring();
    this.setupBufferCleanup();
    this.loadDefaultRules();
  }

  /**
   * Add or update a security rule
   */
  addRule(rule: SecurityRule): void {
    this.rules.set(rule.id, rule);
    this.ruleMetrics.set(rule.id, {
      triggers: 0,
      lastTriggered: null,
      averageResponseTime: 0,
      falsePositives: 0
    });
    this.emit('ruleAdded', rule);
  }

  /**
   * Remove a security rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    this.ruleMetrics.delete(ruleId);
    if (removed) {
      this.emit('ruleRemoved', ruleId);
    }
    return removed;
  }

  /**
   * Enable or disable a rule
   */
  toggleRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      this.emit('ruleToggled', { ruleId, enabled });
      return true;
    }
    return false;
  }

  /**
   * Get all rules with their metrics
   */
  getRules(): Array<SecurityRule & { metrics: RuleMetrics }> {
    return Array.from(this.rules.values()).map(rule => ({
      ...rule,
      metrics: this.ruleMetrics.get(rule.id) || {
        triggers: 0,
        lastTriggered: null,
        averageResponseTime: 0,
        falsePositives: 0
      }
    }));
  }

  /**
   * Process a security event
   */
  private async processEvent(event: AuditEvent): Promise<void> {
    const startTime = Date.now();

    try {
      // Add to event buffer for time-window analysis
      this.addToBuffer(event);

      // Check each enabled rule
      for (const rule of this.rules.values()) {
        if (!rule.enabled || this.isInCooldown(rule)) continue;

        const matchResult = await this.evaluateRule(rule, event);
        if (matchResult.matches) {
          await this.triggerRule(rule, event, matchResult.matchedConditions);
        }
      }

      // Update processing metrics
      const processingTime = Date.now() - startTime;
      this.emit('eventProcessed', { event, processingTime });

    } catch (error) {
      console.error('Error processing security event:', error);
      this.emit('processingError', { event, error });
    }
  }

  /**
   * Evaluate a rule against an event
   */
  private async evaluateRule(
    rule: SecurityRule,
    event: AuditEvent
  ): Promise<{ matches: boolean; matchedConditions: SecurityCondition[] }> {
    const matchedConditions: SecurityCondition[] = [];

    for (const condition of rule.conditions) {
      const matches = await this.evaluateCondition(condition, event);
      if (matches) {
        matchedConditions.push(condition);
      }
    }

    // All conditions must match (AND logic)
    return {
      matches: matchedConditions.length === rule.conditions.length,
      matchedConditions
    };
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(
    condition: SecurityCondition,
    event: AuditEvent
  ): Promise<boolean> {
    const fieldValue = this.getFieldValue(event, condition.field);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;

      case 'contains':
        return String(fieldValue).toLowerCase().includes(
          String(condition.value).toLowerCase()
        );

      case 'greaterThan':
        return Number(fieldValue) > Number(condition.value);

      case 'lessThan':
        return Number(fieldValue) < Number(condition.value);

      case 'regex':
        return new RegExp(condition.value).test(String(fieldValue));

      case 'in':
        return Array.isArray(condition.value) &&
               condition.value.includes(fieldValue);

      default:
        return false;
    }
  }

  /**
   * Get field value from event
   */
  private getFieldValue(event: AuditEvent, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let value: any = event;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Trigger a rule and execute its actions
   */
  private async triggerRule(
    rule: SecurityRule,
    event: AuditEvent,
    matchedConditions: SecurityCondition[]
  ): Promise<void> {
    const alert: SecurityAlert = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      triggerEvent: event,
      matchedConditions,
      description: `Security rule '${rule.name}' triggered`,
      metadata: {
        riskScore: event.riskScore,
        eventId: event.id
      },
      status: 'OPEN'
    };

    // Update rule metrics
    const metrics = this.ruleMetrics.get(rule.id)!;
    metrics.triggers++;
    metrics.lastTriggered = new Date();
    rule.lastTriggered = new Date();

    // Execute actions
    for (const action of rule.actions) {
      await this.executeAction(action, alert);
    }

    // Emit alert
    this.emit('securityAlert', alert);

    // Log the alert
    await this.auditService.logSecurityEvent(
      'rule_triggered',
      rule.severity,
      event.ipAddress,
      {
        ruleId: rule.id,
        ruleName: rule.name,
        alertId: alert.id,
        triggerEvent: event.id
      }
    );
  }

  /**
   * Execute a security action
   */
  private async executeAction(action: SecurityAction, alert: SecurityAlert): Promise<void> {
    try {
      switch (action.type) {
        case 'alert':
          await this.alertHandler.sendAlert(alert, action.config);
          break;

        case 'block':
          await this.alertHandler.blockEntity(
            alert.triggerEvent.ipAddress,
            action.config.duration || 3600,
            `Blocked by security rule: ${alert.ruleName}`
          );
          break;

        case 'log':
          console.log(`Security Alert: ${alert.description}`, {
            alert,
            config: action.config
          });
          break;

        case 'notify':
          await this.alertHandler.sendNotification(alert, action.config);
          break;

        case 'quarantine':
          await this.alertHandler.quarantineUser(
            alert.triggerEvent.userId!,
            action.config.reason || 'Security policy violation'
          );
          break;
      }
    } catch (error) {
      console.error(`Failed to execute action ${action.type}:`, error);
    }
  }

  /**
   * Check if rule is in cooldown period
   */
  private isInCooldown(rule: SecurityRule): boolean {
    if (!rule.lastTriggered || rule.cooldownPeriod === 0) return false;

    const cooldownEnd = new Date(rule.lastTriggered.getTime() + rule.cooldownPeriod * 1000);
    return new Date() < cooldownEnd;
  }

  /**
   * Add event to buffer for time-window analysis
   */
  private addToBuffer(event: AuditEvent): void {
    const key = `${event.eventType}_${event.ipAddress}`;

    if (!this.eventBuffer.has(key)) {
      this.eventBuffer.set(key, []);
    }

    const buffer = this.eventBuffer.get(key)!;
    buffer.push(event);

    // Maintain buffer size
    if (buffer.length > this.maxBufferSize) {
      buffer.shift();
    }
  }

  /**
   * Setup event monitoring from audit service
   */
  private setupEventMonitoring(): void {
    this.auditService.on('auditEvent', (event: AuditEvent) => {
      this.processEvent(event);
    });
  }

  /**
   * Setup buffer cleanup to prevent memory leaks
   */
  private setupBufferCleanup(): void {
    setInterval(() => {
      const cutoffTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      for (const [key, buffer] of this.eventBuffer.entries()) {
        const filtered = buffer.filter(event => event.timestamp > cutoffTime);

        if (filtered.length === 0) {
          this.eventBuffer.delete(key);
        } else {
          this.eventBuffer.set(key, filtered);
        }
      }
    }, this.bufferCleanupInterval);
  }

  /**
   * Load default security rules
   */
  private loadDefaultRules(): void {
    const defaultRules: SecurityRule[] = [
      {
        id: 'multiple_failed_logins',
        name: 'Multiple Failed Logins',
        description: 'Detect multiple failed login attempts from same IP',
        enabled: true,
        severity: 'HIGH',
        cooldownPeriod: 300, // 5 minutes
        conditions: [
          {
            field: 'eventType',
            operator: 'equals',
            value: 'AUTHENTICATION'
          },
          {
            field: 'outcome',
            operator: 'equals',
            value: 'FAILURE'
          }
        ],
        actions: [
          { type: 'alert', config: { channels: ['email', 'slack'] } },
          { type: 'block', config: { duration: 1800 } } // 30 minutes
        ]
      },
      {
        id: 'suspicious_api_access',
        name: 'Suspicious API Access',
        description: 'Detect unusual API access patterns',
        enabled: true,
        severity: 'MEDIUM',
        cooldownPeriod: 600,
        conditions: [
          {
            field: 'eventType',
            operator: 'equals',
            value: 'API_ACCESS'
          },
          {
            field: 'riskScore',
            operator: 'greaterThan',
            value: 70
          }
        ],
        actions: [
          { type: 'alert', config: { channels: ['log'] } },
          { type: 'log', config: {} }
        ]
      },
      {
        id: 'privileged_access_off_hours',
        name: 'Off-Hours Privileged Access',
        description: 'Detect privileged operations outside business hours',
        enabled: true,
        severity: 'HIGH',
        cooldownPeriod: 0,
        conditions: [
          {
            field: 'details.privilegedUser',
            operator: 'equals',
            value: true
          },
          {
            field: 'eventType',
            operator: 'in',
            value: ['ADMIN_ACTION', 'CONFIGURATION_CHANGE']
          }
        ],
        actions: [
          { type: 'alert', config: { channels: ['email', 'sms'] } },
          { type: 'notify', config: { escalate: true } }
        ]
      }
    ];

    defaultRules.forEach(rule => this.addRule(rule));
  }
}

// Interfaces
export interface AlertHandler {
  sendAlert(alert: SecurityAlert, config: Record<string, any>): Promise<void>;
  sendNotification(alert: SecurityAlert, config: Record<string, any>): Promise<void>;
  blockEntity(identifier: string, duration: number, reason: string): Promise<void>;
  quarantineUser(userId: string, reason: string): Promise<void>;
}

export interface RuleMetrics {
  triggers: number;
  lastTriggered: Date | null;
  averageResponseTime: number;
  falsePositives: number;
}