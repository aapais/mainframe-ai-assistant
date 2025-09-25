'use strict';
const __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        let desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get() {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
const __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
const __importStar =
  (this && this.__importStar) ||
  (function () {
    let ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          const ar = [];
          for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      const result = {};
      if (mod != null)
        for (let k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.AlertingEngine = void 0;
const events_1 = require('events');
class AlertingEngine extends events_1.EventEmitter {
  db;
  searchMonitor;
  performanceMonitor;
  rules = new Map();
  channels = new Map();
  activeAlerts = new Map();
  lastNotifications = new Map();
  evaluationInterval = 15000;
  evaluationTimer;
  constructor(database, searchMonitor, performanceMonitor) {
    super();
    this.db = database;
    this.searchMonitor = searchMonitor;
    this.performanceMonitor = performanceMonitor;
    this.initializeAlertingTables();
    this.loadDefaultRules();
    this.loadDefaultChannels();
    this.startEvaluation();
    console.log('🚨 Alerting engine initialized');
  }
  addRule(rule) {
    const id = this.generateId();
    const fullRule = {
      id,
      created_at: new Date(),
      updated_at: new Date(),
      ...rule,
    };
    this.rules.set(id, fullRule);
    this.storeRule(fullRule);
    console.log(`✅ Alert rule added: ${rule.name}`);
    return id;
  }
  updateRule(id, updates) {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Alert rule ${id} not found`);
    }
    const updatedRule = {
      ...rule,
      ...updates,
      updated_at: new Date(),
    };
    this.rules.set(id, updatedRule);
    this.storeRule(updatedRule);
    console.log(`✅ Alert rule updated: ${rule.name}`);
  }
  deleteRule(id) {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Alert rule ${id} not found`);
    }
    this.rules.delete(id);
    this.db.prepare('DELETE FROM alert_rules WHERE id = ?').run(id);
    console.log(`🗑️ Alert rule deleted: ${rule.name}`);
  }
  addChannel(channel) {
    const id = this.generateId();
    const fullChannel = {
      id,
      ...channel,
    };
    this.channels.set(id, fullChannel);
    this.storeChannel(fullChannel);
    console.log(`✅ Notification channel added: ${channel.name}`);
    return id;
  }
  getRules() {
    return Array.from(this.rules.values());
  }
  getChannels() {
    return Array.from(this.channels.values());
  }
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values()).filter(alert => alert.status === 'active');
  }
  acknowledgeAlert(alertId, acknowledgedBy) {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }
    alert.status = 'acknowledged';
    alert.acknowledged_by = acknowledgedBy;
    alert.acknowledged_at = new Date();
    this.updateAlert(alert);
    this.emit('alert-acknowledged', alert);
    console.log(`✅ Alert acknowledged: ${alert.message}`);
  }
  resolveAlert(alertId) {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }
    alert.status = 'resolved';
    alert.resolved_at = new Date();
    this.updateAlert(alert);
    this.activeAlerts.delete(alertId);
    this.emit('alert-resolved', alert);
    console.log(`✅ Alert resolved: ${alert.message}`);
  }
  async testChannel(channelId) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }
    const testAlert = {
      id: 'test',
      rule_id: 'test',
      message: 'Test notification from AlertingEngine',
      severity: 'info',
      metric: 'test',
      current_value: 0,
      threshold: 0,
      status: 'active',
      triggered_at: new Date(),
      last_notification: new Date(),
      notification_count: 1,
      tags: ['test'],
      context: {},
    };
    await this.sendNotification(channel, testAlert);
    console.log(`📧 Test notification sent to ${channel.name}`);
  }
  getStatistics() {
    const activeAlerts = this.getActiveAlerts();
    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const alertsLast24h = this.db
      .prepare(
        `
      SELECT COUNT(*) as count FROM alerts 
      WHERE triggered_at > datetime('now', '-24 hours')
    `
      )
      .get();
    const topMetrics = this.db
      .prepare(
        `
      SELECT metric, COUNT(*) as count FROM alerts 
      WHERE triggered_at > datetime('now', '-7 days')
      GROUP BY metric 
      ORDER BY count DESC 
      LIMIT 5
    `
      )
      .all();
    return {
      totalRules: this.rules.size,
      enabledRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      activeAlerts: activeAlerts.length,
      alertsLast24h: alertsLast24h.count,
      topAlertMetrics: topMetrics,
      channelHealth: Array.from(this.channels.values()).map(channel => ({
        name: channel.name,
        status: channel.enabled ? 'enabled' : 'disabled',
        lastUsed: this.getChannelLastUsed(channel.id),
      })),
    };
  }
  async evaluateRules() {
    try {
      const currentMetrics = this.searchMonitor.getCurrentMetrics();
      const performanceStatus = this.performanceMonitor.getRealTimeStatus();
      if (!currentMetrics) {
        return;
      }
      const allMetrics = {
        ...currentMetrics,
        memoryUsage: performanceStatus.memoryUsage,
        currentLoad: performanceStatus.currentLoad,
        isHealthy: performanceStatus.isHealthy,
      };
      for (const rule of this.rules.values()) {
        if (!rule.enabled || !this.isRuleScheduleActive(rule)) {
          continue;
        }
        await this.evaluateRule(rule, allMetrics);
      }
    } catch (error) {
      console.error('Error evaluating alert rules:', error);
    }
  }
  async evaluateRule(rule, metrics) {
    const metricValue = this.getMetricValue(metrics, rule.metric);
    if (metricValue === undefined) {
      return;
    }
    const conditionMet = this.evaluateCondition(metricValue, rule.operator, rule.threshold);
    const existingAlert = this.findActiveAlert(rule.id);
    if (conditionMet && !existingAlert) {
      await this.triggerAlert(rule, metricValue, metrics);
    } else if (!conditionMet && existingAlert) {
      this.resolveAlert(existingAlert.id);
    } else if (conditionMet && existingAlert) {
      existingAlert.current_value = metricValue;
      existingAlert.context = { ...metrics };
      this.updateAlert(existingAlert);
      await this.checkEscalation(existingAlert, rule);
    }
  }
  async triggerAlert(rule, currentValue, metrics) {
    const alert = {
      id: this.generateId(),
      rule_id: rule.id,
      message: this.buildAlertMessage(rule, currentValue),
      severity: rule.severity,
      metric: rule.metric,
      current_value: currentValue,
      threshold: rule.threshold,
      status: 'active',
      triggered_at: new Date(),
      last_notification: new Date(),
      notification_count: 0,
      tags: rule.tags,
      context: { ...metrics },
      query: metrics.query || undefined,
    };
    this.activeAlerts.set(alert.id, alert);
    this.storeAlert(alert);
    await this.notifyChannels(rule.channels, alert);
    this.emit('alert-triggered', alert);
    console.log(`🚨 Alert triggered: ${alert.message}`);
  }
  async notifyChannels(channelIds, alert) {
    for (const channelId of channelIds) {
      const channel = this.channels.get(channelId);
      if (!channel || !channel.enabled) {
        continue;
      }
      try {
        await this.sendNotification(channel, alert);
        alert.notification_count++;
        alert.last_notification = new Date();
      } catch (error) {
        console.error(`Failed to send notification to ${channel.name}:`, error);
      }
    }
    this.updateAlert(alert);
  }
  async sendNotification(channel, alert) {
    if (!this.checkRateLimit(channel)) {
      console.warn(`Rate limit exceeded for channel ${channel.name}`);
      return;
    }
    switch (channel.type) {
      case 'console':
        this.sendConsoleNotification(alert);
        break;
      case 'file':
        await this.sendFileNotification(channel, alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(channel, alert);
        break;
      case 'email':
        await this.sendEmailNotification(channel, alert);
        break;
      default:
        console.warn(`Unsupported channel type: ${channel.type}`);
    }
    this.recordNotification(channel.id);
  }
  sendConsoleNotification(alert) {
    const prefix =
      alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵';
    console.log(`${prefix} [${alert.severity.toUpperCase()}] ${alert.message}`);
    console.log(
      `   Metric: ${alert.metric} = ${alert.current_value} (threshold: ${alert.threshold})`
    );
    console.log(`   Time: ${alert.triggered_at.toISOString()}`);
  }
  async sendFileNotification(channel, alert) {
    const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
    const logEntry = {
      timestamp: new Date().toISOString(),
      alert_id: alert.id,
      severity: alert.severity,
      message: alert.message,
      metric: alert.metric,
      current_value: alert.current_value,
      threshold: alert.threshold,
      context: alert.context,
    };
    const logFile = channel.config.file_path || './alerts.log';
    await fs.appendFile(logFile, `${JSON.stringify(logEntry)}\n`);
  }
  async sendWebhookNotification(channel, alert) {
    const payload = {
      alert_id: alert.id,
      severity: alert.severity,
      message: alert.message,
      metric: alert.metric,
      current_value: alert.current_value,
      threshold: alert.threshold,
      triggered_at: alert.triggered_at.toISOString(),
      tags: alert.tags,
      context: alert.context,
    };
    const response = await fetch(channel.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...channel.config.headers,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }
  async sendEmailNotification(channel, alert) {
    console.log(`📧 Email notification to ${channel.config.to}: ${alert.message}`);
  }
  checkRateLimit(channel) {
    if (!channel.rate_limit) return true;
    const now = Date.now();
    const key = `${channel.id}_notifications`;
    const lastCheck = this.lastNotifications.get(key) || 0;
    if (now - lastCheck < 60000) {
      return false;
    }
    return true;
  }
  recordNotification(channelId) {
    const key = `${channelId}_notifications`;
    this.lastNotifications.set(key, Date.now());
  }
  buildAlertMessage(rule, currentValue) {
    return `${rule.name}: ${rule.metric} is ${currentValue} (threshold: ${rule.threshold})`;
  }
  getMetricValue(metrics, metricPath) {
    const parts = metricPath.split('.');
    let value = metrics;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    return typeof value === 'number' ? value : undefined;
  }
  evaluateCondition(value, operator, threshold) {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      case '!=':
        return value !== threshold;
      default:
        return false;
    }
  }
  findActiveAlert(ruleId) {
    return Array.from(this.activeAlerts.values()).find(
      alert => alert.rule_id === ruleId && alert.status === 'active'
    );
  }
  isRuleScheduleActive(rule) {
    if (!rule.schedule) return true;
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentTime = now.toTimeString().slice(0, 5);
    return rule.schedule.active_periods.some(period => {
      const isDayActive = period.days.includes(currentDay);
      const isTimeActive = currentTime >= period.start_time && currentTime <= period.end_time;
      return isDayActive && isTimeActive;
    });
  }
  async checkEscalation(alert, rule) {
    if (!rule.escalation) return;
    const timeSinceTriggered = Date.now() - alert.triggered_at.getTime();
    for (const stage of rule.escalation.stages) {
      if (timeSinceTriggered >= stage.delay) {
        console.log(
          `📈 Escalating alert ${alert.id} to stage with channels: ${stage.channels.join(', ')}`
        );
        await this.notifyChannels(stage.channels, alert);
      }
    }
  }
  loadDefaultRules() {
    const defaultRules = [
      {
        name: 'SLA Violation',
        description: 'Alert when SLA compliance drops below 95%',
        enabled: true,
        metric: 'slaCompliance',
        operator: '<',
        threshold: 0.95,
        duration: 60000,
        severity: 'critical',
        channels: ['console', 'file'],
        cooldown: 300000,
        tags: ['sla', 'performance'],
      },
      {
        name: 'High Response Time',
        description: 'Alert when P95 response time exceeds SLA',
        enabled: true,
        metric: 'p95ResponseTime',
        operator: '>',
        threshold: 1000,
        duration: 120000,
        severity: 'warning',
        channels: ['console'],
        cooldown: 300000,
        tags: ['performance', 'response-time'],
      },
      {
        name: 'Low Cache Hit Rate',
        description: 'Alert when cache hit rate drops below 70%',
        enabled: true,
        metric: 'cacheHitRate',
        operator: '<',
        threshold: 0.7,
        duration: 300000,
        severity: 'warning',
        channels: ['console'],
        cooldown: 600000,
        tags: ['cache', 'performance'],
      },
    ];
    defaultRules.forEach(rule => this.addRule(rule));
    console.log(`✅ Loaded ${defaultRules.length} default alert rules`);
  }
  loadDefaultChannels() {
    const defaultChannels = [
      {
        name: 'Console',
        type: 'console',
        config: {},
        enabled: true,
      },
      {
        name: 'Log File',
        type: 'file',
        config: {
          file_path: './monitoring/alerts.log',
        },
        enabled: true,
      },
    ];
    defaultChannels.forEach(channel => this.addChannel(channel));
    console.log(`✅ Loaded ${defaultChannels.length} default notification channels`);
  }
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  getChannelLastUsed(channelId) {
    const lastUsed = this.lastNotifications.get(`${channelId}_notifications`);
    return lastUsed ? new Date(lastUsed) : undefined;
  }
  storeRule(rule) {
    try {
      this.db
        .prepare(
          `
        INSERT OR REPLACE INTO alert_rules (
          id, name, description, enabled, metric, operator, threshold,
          duration, severity, channels, escalation, cooldown, schedule,
          tags, runbook, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          rule.id,
          rule.name,
          rule.description,
          rule.enabled ? 1 : 0,
          rule.metric,
          rule.operator,
          rule.threshold,
          rule.duration,
          rule.severity,
          JSON.stringify(rule.channels),
          rule.escalation ? JSON.stringify(rule.escalation) : null,
          rule.cooldown,
          rule.schedule ? JSON.stringify(rule.schedule) : null,
          JSON.stringify(rule.tags),
          rule.runbook,
          rule.created_at.toISOString(),
          rule.updated_at.toISOString()
        );
    } catch (error) {
      console.error('Failed to store alert rule:', error);
    }
  }
  storeChannel(channel) {
    try {
      this.db
        .prepare(
          `
        INSERT OR REPLACE INTO notification_channels (
          id, name, type, config, enabled, rate_limit
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          channel.id,
          channel.name,
          channel.type,
          JSON.stringify(channel.config),
          channel.enabled ? 1 : 0,
          channel.rate_limit ? JSON.stringify(channel.rate_limit) : null
        );
    } catch (error) {
      console.error('Failed to store notification channel:', error);
    }
  }
  storeAlert(alert) {
    try {
      this.db
        .prepare(
          `
        INSERT OR REPLACE INTO alerts (
          id, rule_id, message, severity, metric, current_value, threshold,
          status, acknowledged_by, acknowledged_at, resolved_at,
          triggered_at, last_notification, notification_count,
          query, tags, context
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          alert.id,
          alert.rule_id,
          alert.message,
          alert.severity,
          alert.metric,
          alert.current_value,
          alert.threshold,
          alert.status,
          alert.acknowledged_by,
          alert.acknowledged_at?.toISOString() || null,
          alert.resolved_at?.toISOString() || null,
          alert.triggered_at.toISOString(),
          alert.last_notification.toISOString(),
          alert.notification_count,
          alert.query,
          JSON.stringify(alert.tags),
          JSON.stringify(alert.context)
        );
    } catch (error) {
      console.error('Failed to store alert:', error);
    }
  }
  updateAlert(alert) {
    this.storeAlert(alert);
  }
  initializeAlertingTables() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS alert_rules (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          enabled INTEGER DEFAULT 1,
          metric TEXT NOT NULL,
          operator TEXT NOT NULL,
          threshold REAL NOT NULL,
          duration INTEGER DEFAULT 0,
          severity TEXT NOT NULL,
          channels TEXT NOT NULL,
          escalation TEXT,
          cooldown INTEGER DEFAULT 300000,
          schedule TEXT,
          tags TEXT,
          runbook TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS notification_channels (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          config TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          rate_limit TEXT
        );
        
        CREATE TABLE IF NOT EXISTS alerts (
          id TEXT PRIMARY KEY,
          rule_id TEXT NOT NULL,
          message TEXT NOT NULL,
          severity TEXT NOT NULL,
          metric TEXT NOT NULL,
          current_value REAL NOT NULL,
          threshold REAL NOT NULL,
          status TEXT DEFAULT 'active',
          acknowledged_by TEXT,
          acknowledged_at TEXT,
          resolved_at TEXT,
          triggered_at TEXT NOT NULL,
          last_notification TEXT NOT NULL,
          notification_count INTEGER DEFAULT 0,
          query TEXT,
          tags TEXT,
          context TEXT,
          FOREIGN KEY (rule_id) REFERENCES alert_rules(id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
        CREATE INDEX IF NOT EXISTS idx_alerts_triggered ON alerts(triggered_at DESC);
        CREATE INDEX IF NOT EXISTS idx_alerts_rule ON alerts(rule_id);
      `);
      console.log('✅ Alerting tables initialized');
    } catch (error) {
      console.error('❌ Failed to initialize alerting tables:', error);
    }
  }
  startEvaluation() {
    this.evaluationTimer = setInterval(() => {
      this.evaluateRules().catch(error => {
        console.error('Error in rule evaluation:', error);
      });
    }, this.evaluationInterval);
    console.log('🔄 Alert rule evaluation started');
  }
  stopEvaluation() {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = undefined;
    }
    console.log('⏹️ Alert rule evaluation stopped');
  }
}
exports.AlertingEngine = AlertingEngine;
//# sourceMappingURL=AlertingEngine.js.map
