/**
 * Performance Alerts System
 *
 * Real-time performance monitoring alerts for React components
 * with configurable thresholds, notification system, and alert management
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePerformanceStore, RenderMetrics, PerformanceThresholds } from '../../hooks/useReactProfiler';
import { useMemoryTracking, useInteractionTracking } from '../../hooks/usePerformanceMonitoring';

// =========================
// TYPES AND INTERFACES
// =========================

export interface PerformanceAlert {
  id: string;
  timestamp: number;
  type: 'render' | 'memory' | 'interaction' | 'threshold' | 'system';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  componentName?: string;
  metrics: {
    renderTime?: number;
    memoryUsage?: number;
    interactionDelay?: number;
    threshold?: number;
  };
  acknowledged?: boolean;
  acknowledgedAt?: number;
  autoResolve?: boolean;
  resolvedAt?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  type: PerformanceAlert['type'];
  condition: 'exceeds' | 'below' | 'equals' | 'pattern';
  threshold: number;
  severity: PerformanceAlert['severity'];
  enabled: boolean;
  componentFilter?: string;
  cooldown?: number; // Minutes before same alert can fire again
  autoResolve?: boolean;
  notifications?: {
    desktop?: boolean;
    console?: boolean;
    callback?: (alert: PerformanceAlert) => void;
  };
}

export interface AlertManagerProps {
  /** Custom alert rules */
  rules?: AlertRule[];
  /** Maximum number of alerts to keep */
  maxAlerts?: number;
  /** Enable desktop notifications */
  enableDesktopNotifications?: boolean;
  /** Auto-clear resolved alerts after minutes */
  autoClearAfter?: number;
  /** Position for alert toast */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Custom alert renderer */
  customAlertRenderer?: (alert: PerformanceAlert) => React.ReactNode;
}

// =========================
// DEFAULT ALERT RULES
// =========================

const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'slow-render',
    name: 'Slow Render Detection',
    type: 'render',
    condition: 'exceeds',
    threshold: 16,
    severity: 'warning',
    enabled: true,
    cooldown: 1,
    autoResolve: false,
    notifications: {
      desktop: true,
      console: true
    }
  },
  {
    id: 'critical-render',
    name: 'Critical Render Time',
    type: 'render',
    condition: 'exceeds',
    threshold: 50,
    severity: 'critical',
    enabled: true,
    cooldown: 0.5,
    autoResolve: false,
    notifications: {
      desktop: true,
      console: true
    }
  },
  {
    id: 'memory-leak',
    name: 'Memory Leak Detection',
    type: 'memory',
    condition: 'exceeds',
    threshold: 50 * 1024 * 1024, // 50MB increase
    severity: 'critical',
    enabled: true,
    cooldown: 5,
    autoResolve: false,
    notifications: {
      desktop: true,
      console: true
    }
  },
  {
    id: 'slow-interaction',
    name: 'Slow User Interaction',
    type: 'interaction',
    condition: 'exceeds',
    threshold: 100,
    severity: 'warning',
    enabled: true,
    cooldown: 2,
    autoResolve: true,
    notifications: {
      desktop: false,
      console: true
    }
  },
  {
    id: 'excessive-renders',
    name: 'Excessive Re-renders',
    type: 'threshold',
    condition: 'exceeds',
    threshold: 10, // More than 10 renders in 5 seconds
    severity: 'warning',
    enabled: true,
    cooldown: 3,
    autoResolve: true,
    notifications: {
      desktop: false,
      console: true
    }
  }
];

// =========================
// ALERT MANAGER CLASS
// =========================

class PerformanceAlertManager {
  private alerts: PerformanceAlert[] = [];
  private rules: AlertRule[] = [...DEFAULT_ALERT_RULES];
  private listeners = new Set<(alerts: PerformanceAlert[]) => void>();
  private cooldowns = new Map<string, number>();
  private renderCounts = new Map<string, { count: number; timestamp: number }>();

  addRule(rule: AlertRule) {
    this.rules.push(rule);
  }

  removeRule(ruleId: string) {
    this.rules = this.rules.filter(rule => rule.id !== ruleId);
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>) {
    const ruleIndex = this.rules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex !== -1) {
      this.rules[ruleIndex] = { ...this.rules[ruleIndex], ...updates };
    }
  }

  getRules(): AlertRule[] {
    return [...this.rules];
  }

  checkMetric(metric: RenderMetrics | any, type: PerformanceAlert['type']) {
    const applicableRules = this.rules.filter(rule =>
      rule.enabled &&
      rule.type === type &&
      (!rule.componentFilter || metric.id?.includes(rule.componentFilter))
    );

    applicableRules.forEach(rule => {
      if (this.isInCooldown(rule.id, metric.id)) return;

      let shouldAlert = false;
      let alertValue: number;

      switch (type) {
        case 'render':
          alertValue = metric.actualDuration;
          shouldAlert = this.evaluateCondition(rule.condition, alertValue, rule.threshold);
          break;

        case 'memory':
          alertValue = metric.jsMemoryDelta || metric.memoryUsage;
          shouldAlert = this.evaluateCondition(rule.condition, alertValue, rule.threshold);
          break;

        case 'interaction':
          alertValue = metric.duration;
          shouldAlert = this.evaluateCondition(rule.condition, alertValue, rule.threshold);
          break;

        case 'threshold':
          // Check for excessive renders
          if (rule.name.includes('Re-renders')) {
            shouldAlert = this.checkExcessiveRenders(metric.id, rule.threshold);
            alertValue = this.renderCounts.get(metric.id)?.count || 0;
          }
          break;
      }

      if (shouldAlert) {
        this.createAlert(rule, metric, alertValue!);
        this.setCooldown(rule.id, metric.id, rule.cooldown || 1);
      }
    });
  }

  private evaluateCondition(condition: string, value: number, threshold: number): boolean {
    switch (condition) {
      case 'exceeds': return value > threshold;
      case 'below': return value < threshold;
      case 'equals': return value === threshold;
      default: return false;
    }
  }

  private checkExcessiveRenders(componentId: string, threshold: number): boolean {
    const now = Date.now();
    const entry = this.renderCounts.get(componentId);

    if (!entry || now - entry.timestamp > 5000) {
      // Reset or create new entry
      this.renderCounts.set(componentId, { count: 1, timestamp: now });
      return false;
    }

    entry.count++;
    return entry.count > threshold;
  }

  private isInCooldown(ruleId: string, componentId: string): boolean {
    const key = `${ruleId}-${componentId}`;
    const cooldownUntil = this.cooldowns.get(key);
    return cooldownUntil ? Date.now() < cooldownUntil : false;
  }

  private setCooldown(ruleId: string, componentId: string, minutes: number) {
    const key = `${ruleId}-${componentId}`;
    this.cooldowns.set(key, Date.now() + (minutes * 60 * 1000));
  }

  private createAlert(rule: AlertRule, metric: any, value: number) {
    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: rule.type,
      severity: rule.severity,
      title: rule.name,
      message: this.generateAlertMessage(rule, metric, value),
      componentName: this.extractComponentName(metric.id),
      metrics: this.buildMetrics(rule.type, metric, value),
      autoResolve: rule.autoResolve
    };

    this.alerts.unshift(alert);

    // Trim alerts if needed
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }

    this.notifyListeners();
    this.handleNotifications(alert, rule);
  }

  private generateAlertMessage(rule: AlertRule, metric: any, value: number): string {
    const componentName = this.extractComponentName(metric.id) || 'Component';

    switch (rule.type) {
      case 'render':
        return `${componentName} render time (${value.toFixed(2)}ms) exceeded ${rule.threshold}ms threshold`;

      case 'memory':
        return `Memory usage increased by ${(value / 1024 / 1024).toFixed(2)}MB in ${componentName}`;

      case 'interaction':
        return `User interaction in ${componentName} took ${value.toFixed(2)}ms`;

      case 'threshold':
        return `${componentName} exceeded render count threshold: ${value} renders in 5 seconds`;

      default:
        return `Performance alert triggered in ${componentName}`;
    }
  }

  private buildMetrics(type: PerformanceAlert['type'], metric: any, value: number) {
    const metrics: PerformanceAlert['metrics'] = {};

    switch (type) {
      case 'render':
        metrics.renderTime = value;
        break;
      case 'memory':
        metrics.memoryUsage = value;
        break;
      case 'interaction':
        metrics.interactionDelay = value;
        break;
      case 'threshold':
        metrics.threshold = value;
        break;
    }

    return metrics;
  }

  private extractComponentName(id: string): string | undefined {
    return id?.split('-')[0];
  }

  private handleNotifications(alert: PerformanceAlert, rule: AlertRule) {
    if (rule.notifications?.console) {
      const method = alert.severity === 'critical' ? 'error' :
                    alert.severity === 'warning' ? 'warn' : 'info';
      console[method](`🚨 Performance Alert: ${alert.title}`, alert);
    }

    if (rule.notifications?.desktop && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(`Performance Alert: ${alert.title}`, {
          body: alert.message,
          icon: alert.severity === 'critical' ? '🔴' : '⚠️'
        });
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            this.handleNotifications(alert, rule); // Retry
          }
        });
      }
    }

    if (rule.notifications?.callback) {
      rule.notifications.callback(alert);
    }
  }

  acknowledgeAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      this.notifyListeners();
    }
  }

  resolveAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolvedAt = Date.now();
      this.notifyListeners();
    }
  }

  clearAlert(alertId: string) {
    this.alerts = this.alerts.filter(a => a.id !== alertId);
    this.notifyListeners();
  }

  clearAllAlerts() {
    this.alerts = [];
    this.notifyListeners();
  }

  getAlerts(filter?: { severity?: PerformanceAlert['severity']; acknowledged?: boolean }): PerformanceAlert[] {
    let filtered = [...this.alerts];

    if (filter?.severity) {
      filtered = filtered.filter(a => a.severity === filter.severity);
    }

    if (filter?.acknowledged !== undefined) {
      filtered = filtered.filter(a => !!a.acknowledged === filter.acknowledged);
    }

    return filtered;
  }

  subscribe(listener: (alerts: PerformanceAlert[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.alerts]));
  }

  // Auto-resolve alerts
  processAutoResolve() {
    const now = Date.now();
    let hasChanges = false;

    this.alerts.forEach(alert => {
      if (alert.autoResolve && !alert.resolvedAt && now - alert.timestamp > 30000) { // 30 seconds
        alert.resolvedAt = now;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.notifyListeners();
    }
  }
}

// =========================
// SINGLETON INSTANCE
// =========================

const alertManager = new PerformanceAlertManager();

// =========================
// REACT COMPONENTS
// =========================

const AlertItem: React.FC<{
  alert: PerformanceAlert;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onClear: (id: string) => void;
}> = ({ alert, onAcknowledge, onResolve, onClear }) => {
  const severityStyles = {
    info: 'border-blue-500 bg-blue-50',
    warning: 'border-yellow-500 bg-yellow-50',
    critical: 'border-red-500 bg-red-50'
  };

  const severityIcons = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨'
  };

  return (
    <div className={`p-3 border-l-4 rounded shadow-sm ${severityStyles[alert.severity]}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center">
          <span className="mr-2 text-lg">{severityIcons[alert.severity]}</span>
          <div>
            <h4 className="font-medium text-sm">{alert.title}</h4>
            <p className="text-xs opacity-75">{alert.componentName}</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-xs opacity-75">
            {new Date(alert.timestamp).toLocaleTimeString()}
          </span>
          <button
            onClick={() => onClear(alert.id)}
            className="text-gray-400 hover:text-gray-600 ml-2"
            title="Clear alert"
          >
            ×
          </button>
        </div>
      </div>

      <p className="text-sm mb-3">{alert.message}</p>

      {/* Metrics display */}
      <div className="text-xs opacity-75 mb-3">
        {alert.metrics.renderTime && (
          <span className="mr-3">Render: {alert.metrics.renderTime.toFixed(2)}ms</span>
        )}
        {alert.metrics.memoryUsage && (
          <span className="mr-3">Memory: {(alert.metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB</span>
        )}
        {alert.metrics.interactionDelay && (
          <span className="mr-3">Interaction: {alert.metrics.interactionDelay.toFixed(2)}ms</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        {!alert.acknowledged && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Acknowledge
          </button>
        )}
        {!alert.resolvedAt && (
          <button
            onClick={() => onResolve(alert.id)}
            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            Resolve
          </button>
        )}
      </div>

      {/* Status indicators */}
      <div className="flex justify-between items-center mt-2 text-xs opacity-50">
        <div>
          {alert.acknowledged && <span className="text-blue-600">✓ Acknowledged</span>}
          {alert.resolvedAt && <span className="text-green-600 ml-2">✓ Resolved</span>}
        </div>
        {alert.autoResolve && <span>Auto-resolve enabled</span>}
      </div>
    </div>
  );
};

export const PerformanceAlerts: React.FC<AlertManagerProps> = ({
  rules = [],
  maxAlerts = 50,
  enableDesktopNotifications = false,
  autoClearAfter = 60,
  position = 'top-right',
  customAlertRenderer
}) => {
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [showAll, setShowAll] = useState(false);
  const { store } = usePerformanceStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Add custom rules
  useEffect(() => {
    rules.forEach(rule => alertManager.addRule(rule));
  }, [rules]);

  // Subscribe to alerts
  useEffect(() => {
    const unsubscribe = alertManager.subscribe(setAlerts);
    return unsubscribe;
  }, []);

  // Monitor performance metrics
  useEffect(() => {
    const unsubscribe = store ? (() => {
      // Check recent metrics for alerts
      const recentMetrics = store.metrics.slice(0, 10);
      recentMetrics.forEach(metric => {
        alertManager.checkMetric(metric, 'render');
      });
    }) : () => {};

    return unsubscribe;
  }, [store]);

  // Auto-resolve processing
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      alertManager.processAutoResolve();
    }, 10000); // Every 10 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Desktop notification permissions
  useEffect(() => {
    if (enableDesktopNotifications && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [enableDesktopNotifications]);

  const handleAcknowledge = useCallback((id: string) => {
    alertManager.acknowledgeAlert(id);
  }, []);

  const handleResolve = useCallback((id: string) => {
    alertManager.resolveAlert(id);
  }, []);

  const handleClear = useCallback((id: string) => {
    alertManager.clearAlert(id);
  }, []);

  const handleClearAll = useCallback(() => {
    alertManager.clearAllAlerts();
  }, []);

  const visibleAlerts = showAll ? alerts : alerts.slice(0, 5);
  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className={`fixed z-50 w-80 max-h-96 overflow-hidden ${
      position === 'top-right' ? 'top-4 right-4' :
      position === 'top-left' ? 'top-4 left-4' :
      position === 'bottom-right' ? 'bottom-4 right-4' :
      'bottom-4 left-4'
    }`}>
      <div className="bg-white rounded-lg shadow-lg border">
        {/* Header */}
        <div className="p-3 border-b bg-gray-50 rounded-t-lg">
          <div className="flex justify-between items-center">
            <h3 className="font-medium text-sm flex items-center">
              🚨 Performance Alerts
              {unacknowledgedCount > 0 && (
                <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                  {unacknowledgedCount}
                </span>
              )}
              {criticalCount > 0 && (
                <span className="ml-1 px-2 py-1 bg-red-600 text-white text-xs rounded-full">
                  {criticalCount} Critical
                </span>
              )}
            </h3>

            <div className="flex space-x-1">
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showAll ? 'Show Less' : `Show All (${alerts.length})`}
              </button>
              <button
                onClick={handleClearAll}
                className="text-xs text-gray-600 hover:text-gray-800 ml-2"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>

        {/* Alerts List */}
        <div className="max-h-80 overflow-y-auto">
          <div className="p-2 space-y-2">
            {visibleAlerts.map(alert => (
              customAlertRenderer ? (
                <div key={alert.id}>{customAlertRenderer(alert)}</div>
              ) : (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={handleAcknowledge}
                  onResolve={handleResolve}
                  onClear={handleClear}
                />
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================
// HOOKS
// =========================

/**
 * Hook to use the alert manager
 */
export function usePerformanceAlerts() {
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);

  useEffect(() => {
    const unsubscribe = alertManager.subscribe(setAlerts);
    return unsubscribe;
  }, []);

  return {
    alerts,
    acknowledgeAlert: alertManager.acknowledgeAlert.bind(alertManager),
    resolveAlert: alertManager.resolveAlert.bind(alertManager),
    clearAlert: alertManager.clearAlert.bind(alertManager),
    clearAllAlerts: alertManager.clearAllAlerts.bind(alertManager),
    addRule: alertManager.addRule.bind(alertManager),
    removeRule: alertManager.removeRule.bind(alertManager),
    updateRule: alertManager.updateRule.bind(alertManager),
    getRules: alertManager.getRules.bind(alertManager)
  };
}

// =========================
// EXPORTS
// =========================

export { alertManager };
export type { PerformanceAlert, AlertRule, AlertManagerProps };