'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.AlertManager = void 0;
const events_1 = require('events');
class AlertManager extends events_1.EventEmitter {
  logger;
  alertRules;
  activeAlerts;
  alertHistory;
  notificationThrottleState;
  evaluationTimer;
  evaluationIntervalMs;
  maxHistoryPerRule;
  isRunning = false;
  constructor(logger, evaluationIntervalMs = 60000, maxHistoryPerRule = 1000) {
    super();
    this.logger = logger;
    this.alertRules = new Map();
    this.activeAlerts = new Map();
    this.alertHistory = new Map();
    this.notificationThrottleState = new Map();
    this.evaluationIntervalMs = evaluationIntervalMs;
    this.maxHistoryPerRule = maxHistoryPerRule;
  }
  start() {
    if (this.isRunning) {
      this.logger.warn('Alert manager is already running');
      return;
    }
    this.isRunning = true;
    this.scheduleEvaluation();
    this.logger.info('Alert manager started');
    this.emit('alertManagerStarted');
  }
  stop() {
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
  scheduleEvaluation() {
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
  createAlertRule(
    name,
    dataSource,
    condition,
    thresholds,
    notifications,
    schedule,
    createdBy,
    description,
    suppressions
  ) {
    const rule = {
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
  getAlertRule(id) {
    return this.alertRules.get(id) || null;
  }
  listAlertRules(activeOnly = false) {
    const rules = Array.from(this.alertRules.values());
    return activeOnly ? rules.filter(r => r.isActive) : rules;
  }
  updateAlertRule(id, updates) {
    const rule = this.alertRules.get(id);
    if (!rule) {
      return null;
    }
    Object.assign(rule, updates);
    this.emit('alertRuleUpdated', rule);
    return rule;
  }
  deleteAlertRule(id) {
    const deleted = this.alertRules.delete(id);
    if (deleted) {
      this.alertHistory.delete(id);
      this.notificationThrottleState.delete(id);
      this.resolveActiveAlertsForRule(id);
      this.logger.info(`Alert rule deleted: ${id}`);
      this.emit('alertRuleDeleted', { id });
    }
    return deleted;
  }
  activateAlertRule(id) {
    const rule = this.alertRules.get(id);
    if (!rule) {
      return false;
    }
    rule.isActive = true;
    this.emit('alertRuleActivated', rule);
    return true;
  }
  deactivateAlertRule(id) {
    const rule = this.alertRules.get(id);
    if (!rule) {
      return false;
    }
    rule.isActive = false;
    this.resolveActiveAlertsForRule(id);
    this.emit('alertRuleDeactivated', rule);
    return true;
  }
  async evaluateAlertRules() {
    const now = new Date();
    for (const rule of this.alertRules.values()) {
      if (!rule.isActive) {
        continue;
      }
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
  shouldEvaluateRule(rule, now) {
    const schedule = rule.schedule;
    if (schedule.activeHours) {
      const currentTime = now.toTimeString().substring(0, 5);
      if (currentTime < schedule.activeHours.start || currentTime > schedule.activeHours.end) {
        return false;
      }
    }
    if (schedule.activeDays && schedule.activeDays.length > 0) {
      const dayOfWeek = now.getDay();
      if (!schedule.activeDays.includes(dayOfWeek)) {
        return false;
      }
    }
    if (schedule.excludedDates) {
      const currentDate = now.toDateString();
      if (schedule.excludedDates.some(date => date.toDateString() === currentDate)) {
        return false;
      }
    }
    if (schedule.quietHours) {
      const currentTime = now.toTimeString().substring(0, 5);
      if (currentTime >= schedule.quietHours.start && currentTime <= schedule.quietHours.end) {
        return false;
      }
    }
    if (rule.suppressions) {
      for (const suppression of rule.suppressions) {
        if (this.isActiveSuppressionTime(suppression, now)) {
          return false;
        }
      }
    }
    return true;
  }
  isActiveSuppressionTime(suppression, now) {
    if (now < suppression.startTime) {
      return false;
    }
    if (suppression.endTime && now > suppression.endTime) {
      return false;
    }
    return true;
  }
  async evaluateRule(rule, evaluationTime) {
    try {
      const data = await this.fetchDataForRule(rule);
      const evaluationResult = this.evaluateCondition(rule.condition, data);
      for (const threshold of rule.thresholds) {
        const thresholdMet = this.evaluateThreshold(threshold, evaluationResult, data);
        if (thresholdMet) {
          await this.triggerAlert(rule, threshold, evaluationResult, evaluationTime);
        }
      }
      await this.checkAlertResolution(rule, evaluationResult, evaluationTime);
    } catch (error) {
      this.logger.error(`Error evaluating rule ${rule.id}`, error);
    }
  }
  async fetchDataForRule(rule) {
    return {
      value: Math.random() * 100,
      timestamp: new Date(),
      metadata: {
        dataSource: rule.dataSource,
        metric: rule.condition.metric,
      },
    };
  }
  evaluateCondition(condition, data) {
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
  evaluateThresholdCondition(condition, data) {
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
  evaluateTrendCondition(condition, data) {
    return {
      type: 'trend',
      direction: 'increasing',
      magnitude: 5.2,
      confidence: 0.85,
    };
  }
  evaluateAnomalyCondition(condition, data) {
    return {
      type: 'anomaly',
      anomalyScore: 0.9,
      expectedValue: 50,
      actualValue: 85,
    };
  }
  evaluateMissingDataCondition(condition, data) {
    return {
      type: 'missing_data',
      lastDataTimestamp: new Date(Date.now() - 3600000),
      expectedInterval: condition.timeWindow || 60,
    };
  }
  evaluateCustomCondition(condition, data) {
    return {
      type: 'custom',
      expression: condition.customExpression,
      result: true,
      variables: data,
    };
  }
  extractMetricValue(data, metric, aggregation) {
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
  evaluateThreshold(threshold, evaluationResult, data) {
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
  async triggerAlert(rule, threshold, evaluationResult, triggeredAt) {
    const existingAlert = this.findActiveAlert(rule.id, threshold.severity);
    if (existingAlert) {
      return;
    }
    const alertEvent = {
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
    rule.lastTriggered = triggeredAt;
    rule.triggerCount++;
    this.logger.warn(`Alert triggered: ${rule.name} - ${threshold.severity}`, {
      alertId: alertEvent.id,
      ruleId: rule.id,
      actualValue: evaluationResult.actualValue,
      thresholdValue: evaluationResult.thresholdValue,
    });
    this.emit('alertTriggered', alertEvent);
    await this.sendAlertNotifications(rule, alertEvent);
    if (threshold.actions) {
      await this.executeAlertActions(threshold.actions, alertEvent);
    }
  }
  findActiveAlert(ruleId, severity) {
    for (const alert of this.activeAlerts.values()) {
      if (alert.ruleId === ruleId && alert.severity === severity && alert.status === 'triggered') {
        return alert;
      }
    }
    return null;
  }
  formatAlertMessage(template, evaluationResult, rule) {
    return template
      .replace('{ruleName}', rule.name)
      .replace('{actualValue}', String(evaluationResult.actualValue))
      .replace('{thresholdValue}', String(evaluationResult.thresholdValue))
      .replace('{metric}', rule.condition.metric)
      .replace('{dataSource}', rule.dataSource)
      .replace('{timestamp}', new Date().toISOString());
  }
  async checkAlertResolution(rule, evaluationResult, evaluationTime) {
    const activeAlertsForRule = Array.from(this.activeAlerts.values()).filter(
      alert => alert.ruleId === rule.id && alert.status === 'triggered'
    );
    for (const alert of activeAlertsForRule) {
      const threshold = rule.thresholds.find(t => t.severity === alert.severity);
      if (!threshold || !threshold.autoResolve) {
        continue;
      }
      const thresholdMet = this.evaluateThreshold(threshold, evaluationResult, null);
      if (!thresholdMet) {
        await this.resolveAlert(alert, evaluationTime, 'auto-resolved');
      }
    }
  }
  async resolveAlert(alert, resolvedAt, reason = 'manual') {
    alert.status = 'resolved';
    alert.resolvedAt = resolvedAt;
    alert.context.resolutionReason = reason;
    this.activeAlerts.delete(alert.id);
    this.logger.info(`Alert resolved: ${alert.id} - ${reason}`);
    this.emit('alertResolved', alert);
    const rule = this.alertRules.get(alert.ruleId);
    if (rule) {
      await this.sendResolutionNotifications(rule, alert);
    }
  }
  async sendAlertNotifications(rule, alert) {
    for (const notification of rule.notifications) {
      try {
        if (this.isNotificationThrottled(rule.id, notification)) {
          continue;
        }
        const history = await this.sendNotification(notification, alert, rule);
        alert.notifications.push(history);
        this.updateNotificationThrottleState(rule.id, notification);
      } catch (error) {
        this.logger.error(`Failed to send alert notification`, error);
        const failedHistory = {
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
  async sendResolutionNotifications(rule, alert) {}
  isNotificationThrottled(ruleId, notification) {
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
    if (now - state.windowStart > intervalMs) {
      state.windowStart = now;
      state.count = 0;
      return false;
    }
    return state.count >= notification.throttling.maxNotificationsPerInterval;
  }
  updateNotificationThrottleState(ruleId, notification) {
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
  async sendNotification(notification, alert, rule) {
    const startTime = Date.now();
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
  async sendEmailAlert(recipients, alert, rule) {
    this.logger.info(`Email alert sent to: ${recipients.join(', ')}`);
  }
  async sendWebhookAlert(url, alert, rule) {
    this.logger.info(`Webhook alert sent to: ${url}`);
  }
  async sendSlackAlert(webhook, alert, rule) {
    this.logger.info(`Slack alert sent`);
  }
  async executeAlertActions(actions, alert) {
    for (const action of actions) {
      try {
        const history = await this.executeAction(action, alert);
        alert.actions.push(history);
      } catch (error) {
        const failedHistory = {
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
  async executeAction(action, alert) {
    const history = {
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
      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
    return history;
  }
  async executeScript(parameters) {
    return { success: true, output: 'Script executed successfully' };
  }
  async callWebhook(parameters) {
    return { success: true, response: 'Webhook called successfully' };
  }
  resolveActiveAlertsForRule(ruleId) {
    const activeAlertsForRule = Array.from(this.activeAlerts.values()).filter(
      alert => alert.ruleId === ruleId
    );
    for (const alert of activeAlertsForRule) {
      this.resolveAlert(alert, new Date(), 'rule-deleted');
    }
  }
  addToHistory(ruleId, alert) {
    let history = this.alertHistory.get(ruleId);
    if (!history) {
      history = [];
      this.alertHistory.set(ruleId, history);
    }
    history.unshift(alert);
    if (history.length > this.maxHistoryPerRule) {
      history.splice(this.maxHistoryPerRule);
    }
  }
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  getActiveAlerts(ruleId) {
    const alerts = Array.from(this.activeAlerts.values());
    return ruleId ? alerts.filter(a => a.ruleId === ruleId) : alerts;
  }
  getAlertHistory(ruleId, limit) {
    const history = this.alertHistory.get(ruleId) || [];
    return limit ? history.slice(0, limit) : history;
  }
  acknowledgeAlert(alertId, acknowledgedBy) {
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
  manualResolveAlert(alertId) {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }
    this.resolveAlert(alert, new Date(), 'manual');
    return true;
  }
  getMetrics() {
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
            (sum, a) => sum + (a.resolvedAt.getTime() - a.triggeredAt.getTime()),
            0
          ) / resolvedAlerts.length
        : 0;
    const topTriggeredRules = this.getTopTriggeredRules(10);
    const alertsBySevertiy = recentAlerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {});
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
  getTopTriggeredRules(limit) {
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
exports.AlertManager = AlertManager;
//# sourceMappingURL=AlertManager.js.map
