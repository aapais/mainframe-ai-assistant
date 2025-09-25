import { EventEmitter } from 'events';
import { Logger } from '../logger/Logger';
import { ReportResult } from './ReportGenerator';

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  dataSource: string;
  isActive: boolean;
  condition: AlertCondition;
  thresholds: AlertThreshold[];
  notifications: AlertNotification[];
  schedule: AlertSchedule;
  suppressions?: AlertSuppression[];
  createdBy: string;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
  metadata: Record<string, any>;
}

export interface AlertCondition {
  type: 'threshold' | 'trend' | 'anomaly' | 'missing_data' | 'custom';
  metric: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';
  timeWindow?: number; // minutes
  comparison?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne' | 'between';
  value?: number | string;
  customExpression?: string;
  filters?: Record<string, any>;
}

export interface AlertThreshold {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  condition: AlertCondition;
  message: string;
  escalationDelay?: number; // minutes
  autoResolve?: boolean;
  actions?: AlertAction[];
}

export interface AlertNotification {
  type: 'email' | 'webhook' | 'slack' | 'teams' | 'sms' | 'push';
  recipients: string[];
  template?: string;
  throttling?: NotificationThrottling;
  customFields?: Record<string, any>;
}

export interface NotificationThrottling {
  enabled: boolean;
  intervalMinutes: number;
  maxNotificationsPerInterval: number;
  escalationRules?: EscalationRule[];
}

export interface EscalationRule {
  afterMinutes: number;
  additionalRecipients: string[];
  changeNotificationType?: string;
}

export interface AlertSchedule {
  timezone: string;
  activeHours?: TimeRange;
  activeDays?: number[]; // 0-6, Sunday=0
  excludedDates?: Date[];
  quietHours?: TimeRange;
}

export interface TimeRange {
  start: string; // HH:MM
  end: string; // HH:MM
}

export interface AlertSuppression {
  reason: string;
  startTime: Date;
  endTime?: Date;
  suppressionRules?: SuppressionRule[];
}

export interface SuppressionRule {
  field: string;
  operator: 'eq' | 'ne' | 'contains' | 'regex';
  value: string;
}

export interface AlertAction {
  type: 'script' | 'webhook' | 'api_call' | 'restart_service' | 'scale_resource';
  parameters: Record<string, any>;
  retryPolicy?: ActionRetryPolicy;
}

export interface ActionRetryPolicy {
  maxRetries: number;
  retryDelaySeconds: number;
  backoffMultiplier?: number;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  severity: string;
  status: 'triggered' | 'resolved' | 'acknowledged' | 'suppressed';
  message: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  actualValue: any;
  thresholdValue: any;
  context: Record<string, any>;
  notifications: NotificationHistory[];
  actions: ActionHistory[];
}

export interface NotificationHistory {
  id: string;
  type: string;
  recipients: string[];
  sentAt: Date;
  status: 'sent' | 'failed' | 'throttled';
  error?: string;
  deliveryTime?: number;
}

export interface ActionHistory {
  id: string;
  type: string;
  executedAt: Date;
  status: 'success' | 'failed' | 'retrying';
  result?: any;
  error?: string;
  retryCount: number;
}

export interface AlertMetrics {
  totalRules: number;
  activeRules: number;
  triggeredAlertsLast24h: number;
  resolvedAlertsLast24h: number;
  averageResolutionTime: number;
  topTriggeredRules: Array<{ ruleId: string; name: string; count: number }>;
  alertsByseverity: Record<string, number>;
  notificationSuccessRate: number;
}

export class AlertManager extends EventEmitter {
  private readonly logger: Logger;
  private readonly alertRules: Map<string, AlertRule>;
  private readonly activeAlerts: Map<string, AlertEvent>;
  private readonly alertHistory: Map<string, AlertEvent[]>;
  private readonly notificationThrottleState: Map<string, NotificationThrottleState>;
  private readonly evaluationTimer?: ReturnType<typeof setTimeout>;
  private readonly evaluationIntervalMs: number;
  private readonly maxHistoryPerRule: number;
  private isRunning: boolean = false;

  constructor(
    logger: Logger,
    evaluationIntervalMs: number = 60000, // Check every minute
    maxHistoryPerRule: number = 1000
  ) {
    super();
    this.logger = logger;
    this.alertRules = new Map();
    this.activeAlerts = new Map();
    this.alertHistory = new Map();
    this.notificationThrottleState = new Map();
    this.evaluationIntervalMs = evaluationIntervalMs;
    this.maxHistoryPerRule = maxHistoryPerRule;
  }

  public start(): void {
    if (this.isRunning) {
      this.logger.warn('Alert manager is already running');
      return;
    }

    this.isRunning = true;
    this.scheduleEvaluation();

    this.logger.info('Alert manager started');
    this.emit('alertManagerStarted');
  }

  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.evaluationTimer) {
      clearTimeout(this.evaluationTimer);
    }

    this.logger.info('Alert manager stopped');
    this.emit('alertManagerStopped');
  }

  private scheduleEvaluation(): void {
    if (!this.isRunning) {
      return;
    }

    setTimeout(async () => {
      try {
        await this.evaluateAlertRules();
      } catch (error) {
        this.logger.error('Error evaluating alert rules', error);
      }

      this.scheduleEvaluation();
    }, this.evaluationIntervalMs);
  }

  // Alert Rule Management
  public createAlertRule(
    name: string,
    dataSource: string,
    condition: AlertCondition,
    thresholds: AlertThreshold[],
    notifications: AlertNotification[],
    schedule: AlertSchedule,
    createdBy: string,
    description?: string,
    suppressions?: AlertSuppression[]
  ): AlertRule {
    const rule: AlertRule = {
      id: this.generateId(),
      name,
      description,
      dataSource,
      isActive: true,
      condition,
      thresholds,
      notifications,
      schedule,
      suppressions,
      createdBy,
      createdAt: new Date(),
      triggerCount: 0,
      metadata: {},
    };

    this.alertRules.set(rule.id, rule);
    this.alertHistory.set(rule.id, []);

    this.logger.info(`Alert rule created: ${rule.name} (${rule.id})`);
    this.emit('alertRuleCreated', rule);

    return rule;
  }

  public getAlertRule(id: string): AlertRule | null {
    return this.alertRules.get(id) || null;
  }

  public listAlertRules(activeOnly: boolean = false): AlertRule[] {
    const rules = Array.from(this.alertRules.values());
    return activeOnly ? rules.filter(r => r.isActive) : rules;
  }

  public updateAlertRule(id: string, updates: Partial<AlertRule>): AlertRule | null {
    const rule = this.alertRules.get(id);
    if (!rule) {
      return null;
    }

    Object.assign(rule, updates);
    this.emit('alertRuleUpdated', rule);

    return rule;
  }

  public deleteAlertRule(id: string): boolean {
    const deleted = this.alertRules.delete(id);
    if (deleted) {
      this.alertHistory.delete(id);
      this.notificationThrottleState.delete(id);

      // Resolve any active alerts for this rule
      this.resolveActiveAlertsForRule(id);

      this.logger.info(`Alert rule deleted: ${id}`);
      this.emit('alertRuleDeleted', { id });
    }
    return deleted;
  }

  public activateAlertRule(id: string): boolean {
    const rule = this.alertRules.get(id);
    if (!rule) {
      return false;
    }

    rule.isActive = true;
    this.emit('alertRuleActivated', rule);
    return true;
  }

  public deactivateAlertRule(id: string): boolean {
    const rule = this.alertRules.get(id);
    if (!rule) {
      return false;
    }

    rule.isActive = false;
    this.resolveActiveAlertsForRule(id);
    this.emit('alertRuleDeactivated', rule);
    return true;
  }

  // Alert Evaluation
  private async evaluateAlertRules(): Promise<void> {
    const now = new Date();

    for (const rule of this.alertRules.values()) {
      if (!rule.isActive) {
        continue;
      }

      // Check if rule should be evaluated at this time
      if (!this.shouldEvaluateRule(rule, now)) {
        continue;
      }

      try {
        await this.evaluateRule(rule, now);
      } catch (error) {
        this.logger.error(`Failed to evaluate alert rule: ${rule.id}`, error);
      }
    }
  }

  private shouldEvaluateRule(rule: AlertRule, now: Date): boolean {
    const schedule = rule.schedule;

    // Check timezone (simplified implementation)
    // In production, use a proper timezone library

    // Check active hours
    if (schedule.activeHours) {
      const currentTime = now.toTimeString().substring(0, 5); // HH:MM
      if (currentTime < schedule.activeHours.start || currentTime > schedule.activeHours.end) {
        return false;
      }
    }

    // Check active days
    if (schedule.activeDays && schedule.activeDays.length > 0) {
      const dayOfWeek = now.getDay();
      if (!schedule.activeDays.includes(dayOfWeek)) {
        return false;
      }
    }

    // Check excluded dates
    if (schedule.excludedDates) {
      const currentDate = now.toDateString();
      if (schedule.excludedDates.some(date => date.toDateString() === currentDate)) {
        return false;
      }
    }

    // Check quiet hours
    if (schedule.quietHours) {
      const currentTime = now.toTimeString().substring(0, 5);
      if (currentTime >= schedule.quietHours.start && currentTime <= schedule.quietHours.end) {
        return false;
      }
    }

    // Check suppressions
    if (rule.suppressions) {
      for (const suppression of rule.suppressions) {
        if (this.isActiveSuppressionTime(suppression, now)) {
          return false;
        }
      }
    }

    return true;
  }

  private isActiveSuppressionTime(suppression: AlertSuppression, now: Date): boolean {
    if (now < suppression.startTime) {
      return false;
    }

    if (suppression.endTime && now > suppression.endTime) {
      return false;
    }

    return true;
  }

  private async evaluateRule(rule: AlertRule, evaluationTime: Date): Promise<void> {
    try {
      // Get data for evaluation
      const data = await this.fetchDataForRule(rule);

      // Apply condition logic
      const evaluationResult = this.evaluateCondition(rule.condition, data);

      // Check thresholds
      for (const threshold of rule.thresholds) {
        const thresholdMet = this.evaluateThreshold(threshold, evaluationResult, data);

        if (thresholdMet) {
          await this.triggerAlert(rule, threshold, evaluationResult, evaluationTime);
        }
      }

      // Check for alert resolution
      await this.checkAlertResolution(rule, evaluationResult, evaluationTime);
    } catch (error) {
      this.logger.error(`Error evaluating rule ${rule.id}`, error);
    }
  }

  private async fetchDataForRule(rule: AlertRule): Promise<any> {
    // In a real implementation, this would query the data source
    // For now, return mock data based on the rule configuration
    return {
      value: Math.random() * 100,
      timestamp: new Date(),
      metadata: {
        dataSource: rule.dataSource,
        metric: rule.condition.metric,
      },
    };
  }

  private evaluateCondition(condition: AlertCondition, data: any): any {
    switch (condition.type) {
      case 'threshold':
        return this.evaluateThresholdCondition(condition, data);
      case 'trend':
        return this.evaluateTrendCondition(condition, data);
      case 'anomaly':
        return this.evaluateAnomalyCondition(condition, data);
      case 'missing_data':
        return this.evaluateMissingDataCondition(condition, data);
      case 'custom':
        return this.evaluateCustomCondition(condition, data);
      default:
        throw new Error(`Unsupported condition type: ${condition.type}`);
    }
  }

  private evaluateThresholdCondition(condition: AlertCondition, data: any): any {
    const actualValue = this.extractMetricValue(data, condition.metric, condition.aggregation);
    const thresholdValue = condition.value;

    return {
      type: 'threshold',
      actualValue,
      thresholdValue,
      comparison: condition.comparison,
      metricName: condition.metric,
    };
  }

  private evaluateTrendCondition(condition: AlertCondition, data: any): any {
    // Implement trend analysis logic
    return {
      type: 'trend',
      direction: 'increasing',
      magnitude: 5.2,
      confidence: 0.85,
    };
  }

  private evaluateAnomalyCondition(condition: AlertCondition, data: any): any {
    // Implement anomaly detection logic
    return {
      type: 'anomaly',
      anomalyScore: 0.9,
      expectedValue: 50,
      actualValue: 85,
    };
  }

  private evaluateMissingDataCondition(condition: AlertCondition, data: any): any {
    // Check if expected data is missing
    return {
      type: 'missing_data',
      lastDataTimestamp: new Date(Date.now() - 3600000), // 1 hour ago
      expectedInterval: condition.timeWindow || 60,
    };
  }

  private evaluateCustomCondition(condition: AlertCondition, data: any): any {
    // Evaluate custom expression
    // In production, use a safe expression evaluator
    return {
      type: 'custom',
      expression: condition.customExpression,
      result: true,
      variables: data,
    };
  }

  private extractMetricValue(data: any, metric: string, aggregation?: string): number {
    let value = data.value;

    if (typeof value === 'object' && metric in value) {
      value = value[metric];
    }

    if (aggregation && Array.isArray(value)) {
      switch (aggregation) {
        case 'sum':
          return value.reduce((a, b) => a + b, 0);
        case 'avg':
          return value.reduce((a, b) => a + b, 0) / value.length;
        case 'count':
          return value.length;
        case 'min':
          return Math.min(...value);
        case 'max':
          return Math.max(...value);
        case 'median': {
          const sorted = [...value].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        }
        default:
          return value;
      }
    }

    return typeof value === 'number' ? value : 0;
  }

  private evaluateThreshold(threshold: AlertThreshold, evaluationResult: any, data: any): boolean {
    if (evaluationResult.type !== 'threshold') {
      return false;
    }

    const { actualValue, thresholdValue, comparison } = evaluationResult;

    switch (comparison) {
      case 'gt':
        return actualValue > thresholdValue;
      case 'gte':
        return actualValue >= thresholdValue;
      case 'lt':
        return actualValue < thresholdValue;
      case 'lte':
        return actualValue <= thresholdValue;
      case 'eq':
        return actualValue === thresholdValue;
      case 'ne':
        return actualValue !== thresholdValue;
      case 'between':
        return (
          Array.isArray(thresholdValue) &&
          actualValue >= thresholdValue[0] &&
          actualValue <= thresholdValue[1]
        );
      default:
        return false;
    }
  }

  private async triggerAlert(
    rule: AlertRule,
    threshold: AlertThreshold,
    evaluationResult: any,
    triggeredAt: Date
  ): Promise<void> {
    // Check if alert is already active
    const existingAlert = this.findActiveAlert(rule.id, threshold.severity);
    if (existingAlert) {
      return; // Alert already active
    }

    const alertEvent: AlertEvent = {
      id: this.generateId(),
      ruleId: rule.id,
      severity: threshold.severity,
      status: 'triggered',
      message: this.formatAlertMessage(threshold.message, evaluationResult, rule),
      triggeredAt,
      actualValue: evaluationResult.actualValue,
      thresholdValue: evaluationResult.thresholdValue,
      context: {
        ruleName: rule.name,
        dataSource: rule.dataSource,
        evaluationResult,
        threshold,
      },
      notifications: [],
      actions: [],
    };

    this.activeAlerts.set(alertEvent.id, alertEvent);
    this.addToHistory(rule.id, alertEvent);

    // Update rule statistics
    rule.lastTriggered = triggeredAt;
    rule.triggerCount++;

    this.logger.warn(`Alert triggered: ${rule.name} - ${threshold.severity}`, {
      alertId: alertEvent.id,
      ruleId: rule.id,
      actualValue: evaluationResult.actualValue,
      thresholdValue: evaluationResult.thresholdValue,
    });

    this.emit('alertTriggered', alertEvent);

    // Send notifications
    await this.sendAlertNotifications(rule, alertEvent);

    // Execute actions
    if (threshold.actions) {
      await this.executeAlertActions(threshold.actions, alertEvent);
    }
  }

  private findActiveAlert(ruleId: string, severity: string): AlertEvent | null {
    for (const alert of this.activeAlerts.values()) {
      if (alert.ruleId === ruleId && alert.severity === severity && alert.status === 'triggered') {
        return alert;
      }
    }
    return null;
  }

  private formatAlertMessage(template: string, evaluationResult: any, rule: AlertRule): string {
    return template
      .replace('{ruleName}', rule.name)
      .replace('{actualValue}', String(evaluationResult.actualValue))
      .replace('{thresholdValue}', String(evaluationResult.thresholdValue))
      .replace('{metric}', rule.condition.metric)
      .replace('{dataSource}', rule.dataSource)
      .replace('{timestamp}', new Date().toISOString());
  }

  private async checkAlertResolution(
    rule: AlertRule,
    evaluationResult: any,
    evaluationTime: Date
  ): Promise<void> {
    // Find active alerts for this rule that might be resolved
    const activeAlertsForRule = Array.from(this.activeAlerts.values()).filter(
      alert => alert.ruleId === rule.id && alert.status === 'triggered'
    );

    for (const alert of activeAlertsForRule) {
      const threshold = rule.thresholds.find(t => t.severity === alert.severity);
      if (!threshold || !threshold.autoResolve) {
        continue;
      }

      // Check if threshold condition is no longer met
      const thresholdMet = this.evaluateThreshold(threshold, evaluationResult, null);
      if (!thresholdMet) {
        await this.resolveAlert(alert, evaluationTime, 'auto-resolved');
      }
    }
  }

  private async resolveAlert(
    alert: AlertEvent,
    resolvedAt: Date,
    reason: string = 'manual'
  ): Promise<void> {
    alert.status = 'resolved';
    alert.resolvedAt = resolvedAt;
    alert.context.resolutionReason = reason;

    this.activeAlerts.delete(alert.id);

    this.logger.info(`Alert resolved: ${alert.id} - ${reason}`);
    this.emit('alertResolved', alert);

    // Send resolution notifications if configured
    const rule = this.alertRules.get(alert.ruleId);
    if (rule) {
      await this.sendResolutionNotifications(rule, alert);
    }
  }

  private async sendAlertNotifications(rule: AlertRule, alert: AlertEvent): Promise<void> {
    for (const notification of rule.notifications) {
      try {
        // Check throttling
        if (this.isNotificationThrottled(rule.id, notification)) {
          continue;
        }

        const history = await this.sendNotification(notification, alert, rule);
        alert.notifications.push(history);

        // Update throttling state
        this.updateNotificationThrottleState(rule.id, notification);
      } catch (error) {
        this.logger.error(`Failed to send alert notification`, error);

        const failedHistory: NotificationHistory = {
          id: this.generateId(),
          type: notification.type,
          recipients: notification.recipients,
          sentAt: new Date(),
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        };
        alert.notifications.push(failedHistory);
      }
    }
  }

  private async sendResolutionNotifications(rule: AlertRule, alert: AlertEvent): Promise<void> {
    // Similar to sendAlertNotifications but for resolution
    // Implementation would be similar but with different message templates
  }

  private isNotificationThrottled(ruleId: string, notification: AlertNotification): boolean {
    if (!notification.throttling?.enabled) {
      return false;
    }

    const throttleKey = `${ruleId}_${notification.type}_${notification.recipients.join(',')}`;
    const state = this.notificationThrottleState.get(throttleKey);

    if (!state) {
      return false;
    }

    const now = Date.now();
    const intervalMs = notification.throttling.intervalMinutes * 60 * 1000;

    // Reset if interval has passed
    if (now - state.windowStart > intervalMs) {
      state.windowStart = now;
      state.count = 0;
      return false;
    }

    // Check if we've exceeded the limit
    return state.count >= notification.throttling.maxNotificationsPerInterval;
  }

  private updateNotificationThrottleState(ruleId: string, notification: AlertNotification): void {
    if (!notification.throttling?.enabled) {
      return;
    }

    const throttleKey = `${ruleId}_${notification.type}_${notification.recipients.join(',')}`;
    let state = this.notificationThrottleState.get(throttleKey);

    if (!state) {
      state = { windowStart: Date.now(), count: 0 };
      this.notificationThrottleState.set(throttleKey, state);
    }

    state.count++;
  }

  private async sendNotification(
    notification: AlertNotification,
    alert: AlertEvent,
    rule: AlertRule
  ): Promise<NotificationHistory> {
    const startTime = Date.now();

    // Implement actual notification sending based on type
    switch (notification.type) {
      case 'email':
        await this.sendEmailAlert(notification.recipients, alert, rule);
        break;
      case 'webhook':
        await this.sendWebhookAlert(notification.recipients[0], alert, rule);
        break;
      case 'slack':
        await this.sendSlackAlert(notification.recipients[0], alert, rule);
        break;
      // Add other notification types
    }

    const deliveryTime = Date.now() - startTime;

    return {
      id: this.generateId(),
      type: notification.type,
      recipients: notification.recipients,
      sentAt: new Date(),
      status: 'sent',
      deliveryTime,
    };
  }

  private async sendEmailAlert(
    recipients: string[],
    alert: AlertEvent,
    rule: AlertRule
  ): Promise<void> {
    // Placeholder for email implementation
    this.logger.info(`Email alert sent to: ${recipients.join(', ')}`);
  }

  private async sendWebhookAlert(url: string, alert: AlertEvent, rule: AlertRule): Promise<void> {
    // Placeholder for webhook implementation
    this.logger.info(`Webhook alert sent to: ${url}`);
  }

  private async sendSlackAlert(webhook: string, alert: AlertEvent, rule: AlertRule): Promise<void> {
    // Placeholder for Slack implementation
    this.logger.info(`Slack alert sent`);
  }

  private async executeAlertActions(actions: AlertAction[], alert: AlertEvent): Promise<void> {
    for (const action of actions) {
      try {
        const history = await this.executeAction(action, alert);
        alert.actions.push(history);
      } catch (error) {
        const failedHistory: ActionHistory = {
          id: this.generateId(),
          type: action.type,
          executedAt: new Date(),
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          retryCount: 0,
        };
        alert.actions.push(failedHistory);
      }
    }
  }

  private async executeAction(action: AlertAction, alert: AlertEvent): Promise<ActionHistory> {
    const history: ActionHistory = {
      id: this.generateId(),
      type: action.type,
      executedAt: new Date(),
      status: 'success',
      retryCount: 0,
    };

    switch (action.type) {
      case 'script':
        history.result = await this.executeScript(action.parameters);
        break;
      case 'webhook':
        history.result = await this.callWebhook(action.parameters);
        break;
      // Add other action types
      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }

    return history;
  }

  private async executeScript(parameters: Record<string, any>): Promise<any> {
    // Placeholder for script execution
    return { success: true, output: 'Script executed successfully' };
  }

  private async callWebhook(parameters: Record<string, any>): Promise<any> {
    // Placeholder for webhook call
    return { success: true, response: 'Webhook called successfully' };
  }

  private resolveActiveAlertsForRule(ruleId: string): void {
    const activeAlertsForRule = Array.from(this.activeAlerts.values()).filter(
      alert => alert.ruleId === ruleId
    );

    for (const alert of activeAlertsForRule) {
      this.resolveAlert(alert, new Date(), 'rule-deleted');
    }
  }

  private addToHistory(ruleId: string, alert: AlertEvent): void {
    let history = this.alertHistory.get(ruleId);
    if (!history) {
      history = [];
      this.alertHistory.set(ruleId, history);
    }

    history.unshift(alert);

    // Limit history size
    if (history.length > this.maxHistoryPerRule) {
      history.splice(this.maxHistoryPerRule);
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for alert management
  public getActiveAlerts(ruleId?: string): AlertEvent[] {
    const alerts = Array.from(this.activeAlerts.values());
    return ruleId ? alerts.filter(a => a.ruleId === ruleId) : alerts;
  }

  public getAlertHistory(ruleId: string, limit?: number): AlertEvent[] {
    const history = this.alertHistory.get(ruleId) || [];
    return limit ? history.slice(0, limit) : history;
  }

  public acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    this.emit('alertAcknowledged', alert);
    return true;
  }

  public manualResolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    this.resolveAlert(alert, new Date(), 'manual');
    return true;
  }

  public getMetrics(): AlertMetrics {
    const allRules = Array.from(this.alertRules.values());
    const activeRules = allRules.filter(r => r.isActive);

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAlerts = Array.from(this.alertHistory.values())
      .flat()
      .filter(a => a.triggeredAt >= last24h);

    const triggeredAlertsLast24h = recentAlerts.filter(a => a.status === 'triggered').length;
    const resolvedAlertsLast24h = recentAlerts.filter(a => a.status === 'resolved').length;

    const resolvedAlerts = recentAlerts.filter(a => a.status === 'resolved' && a.resolvedAt);
    const averageResolutionTime =
      resolvedAlerts.length > 0
        ? resolvedAlerts.reduce(
            (sum, a) => sum + (a.resolvedAt!.getTime() - a.triggeredAt.getTime()),
            0
          ) / resolvedAlerts.length
        : 0;

    const topTriggeredRules = this.getTopTriggeredRules(10);

    const alertsBySevertiy = recentAlerts.reduce(
      (acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalNotifications = recentAlerts.reduce((sum, a) => sum + a.notifications.length, 0);
    const successfulNotifications = recentAlerts.reduce(
      (sum, a) => sum + a.notifications.filter(n => n.status === 'sent').length,
      0
    );
    const notificationSuccessRate =
      totalNotifications > 0 ? successfulNotifications / totalNotifications : 1;

    return {
      totalRules: allRules.length,
      activeRules: activeRules.length,
      triggeredAlertsLast24h,
      resolvedAlertsLast24h,
      averageResolutionTime,
      topTriggeredRules,
      alertsBySeverity: alertsBySevertiy,
      notificationSuccessRate,
    };
  }

  private getTopTriggeredRules(
    limit: number
  ): Array<{ ruleId: string; name: string; count: number }> {
    const ruleCounts = Array.from(this.alertRules.values())
      .map(rule => ({
        ruleId: rule.id,
        name: rule.name,
        count: rule.triggerCount,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return ruleCounts;
  }
}

interface NotificationThrottleState {
  windowStart: number;
  count: number;
}
