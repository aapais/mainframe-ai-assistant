/**
 * usePerformanceMonitoring - Hook for tracking search performance
 *
 * Features:
 * - Real-time performance metrics collection
 * - SLA monitoring with alerts
 * - Memory usage tracking
 * - Performance trend analysis
 * - Automated reporting
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  context?: Record<string, any>;
}

export interface PerformanceThreshold {
  warning: number;
  error: number;
  unit: string;
}

export interface PerformanceAlert {
  id: string;
  metric: string;
  level: 'warning' | 'error';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

interface PerformanceMonitoringOptions {
  maxMetricsCount?: number;
  alertThresholds?: Record<string, PerformanceThreshold>;
  enableAutoReporting?: boolean;
  reportingInterval?: number;
  enableMemoryTracking?: boolean;
}

const DEFAULT_THRESHOLDS: Record<string, PerformanceThreshold> = {
  autocomplete_response_time: { warning: 50, error: 100, unit: 'ms' },
  search_execution_time: { warning: 500, error: 1000, unit: 'ms' },
  cache_hit_rate: { warning: 0.6, error: 0.4, unit: '%' },
  memory_usage: { warning: 100, error: 200, unit: 'MB' }
};

export const usePerformanceMonitoring = (options: PerformanceMonitoringOptions = {}) => {
  const {
    maxMetricsCount = 100,
    alertThresholds = DEFAULT_THRESHOLDS,
    enableAutoReporting = true,
    reportingInterval = 60000, // 1 minute
    enableMemoryTracking = true
  } = options;

  // State
  const [metrics, setMetrics] = useState<Map<string, PerformanceMetric[]>>(new Map());
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Refs
  const reportingTimer = useRef<ReturnType<typeof setTimeout>>();
  const memoryTimer = useRef<ReturnType<typeof setTimeout>>();
  const alertIdCounter = useRef(0);

  // Start monitoring
  useEffect(() => {
    setIsMonitoring(true);

    // Start auto-reporting if enabled
    if (enableAutoReporting) {
      reportingTimer.current = setInterval(() => {
        generatePerformanceReport();
      }, reportingInterval);
    }

    // Start memory tracking if enabled
    if (enableMemoryTracking) {
      const trackMemory = () => {
        if ('memory' in performance) {
          const memInfo = (performance as any).memory;
          recordMetric('memory_usage', memInfo.usedJSHeapSize / 1024 / 1024); // MB
        }
      };

      memoryTimer.current = setInterval(trackMemory, 5000); // Every 5 seconds
      trackMemory(); // Initial measurement
    }

    return () => {
      setIsMonitoring(false);
      if (reportingTimer.current) {
        clearInterval(reportingTimer.current);
      }
      if (memoryTimer.current) {
        clearInterval(memoryTimer.current);
      }
    };
  }, [enableAutoReporting, enableMemoryTracking, reportingInterval]);

  // Record a performance metric
  const recordMetric = useCallback((name: string, value: number, context?: Record<string, any>) => {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      context
    };

    setMetrics(prev => {
      const newMetrics = new Map(prev);
      const existing = newMetrics.get(name) || [];
      const updated = [...existing, metric].slice(-maxMetricsCount);
      newMetrics.set(name, updated);
      return newMetrics;
    });

    // Check for threshold violations
    checkThresholds(name, value);

    // Log to console if performance is poor
    const threshold = alertThresholds[name];
    if (threshold && value > threshold.warning) {
      console.warn(`Performance warning: ${name} = ${value}${threshold.unit} (threshold: ${threshold.warning}${threshold.unit})`);
    }
  }, [maxMetricsCount, alertThresholds]);

  // Check thresholds and generate alerts
  const checkThresholds = useCallback((metricName: string, value: number) => {
    const threshold = alertThresholds[metricName];
    if (!threshold) return;

    let alertLevel: 'warning' | 'error' | null = null;
    let message = '';

    if (value >= threshold.error) {
      alertLevel = 'error';
      message = `${metricName} is critically high: ${value}${threshold.unit} (threshold: ${threshold.error}${threshold.unit})`;
    } else if (value >= threshold.warning) {
      alertLevel = 'warning';
      message = `${metricName} is above warning threshold: ${value}${threshold.unit} (threshold: ${threshold.warning}${threshold.unit})`;
    }

    if (alertLevel) {
      const alert: PerformanceAlert = {
        id: `alert-${++alertIdCounter.current}`,
        metric: metricName,
        level: alertLevel,
        message,
        timestamp: Date.now(),
        acknowledged: false
      };

      setAlerts(prev => [alert, ...prev.slice(0, 49)]); // Keep last 50 alerts

      // Send to analytics if available
      if (window.electronAPI?.analytics) {
        window.electronAPI.analytics.trackEvent('performance_alert', {
          metric: metricName,
          level: alertLevel,
          value,
          threshold: alertLevel === 'error' ? threshold.error : threshold.warning
        });
      }
    }
  }, [alertThresholds]);

  // Get metrics for a specific metric name
  const getMetrics = useCallback((metricName?: string) => {
    if (metricName) {
      return metrics.get(metricName) || [];
    }

    // Return all metrics as an object
    const result: Record<string, number[]> = {};
    metrics.forEach((values, name) => {
      result[name] = values.map(m => m.value);
    });
    return result;
  }, [metrics]);

  // Calculate statistics for a metric
  const getMetricStats = useCallback((metricName: string) => {
    const metricData = metrics.get(metricName) || [];
    if (metricData.length === 0) {
      return {
        count: 0,
        current: 0,
        average: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        trend: 'stable' as 'up' | 'down' | 'stable'
      };
    }

    const values = metricData.map(m => m.value);
    const sorted = [...values].sort((a, b) => a - b);

    const current = values[values.length - 1];
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    // Calculate trend (comparing last 25% vs previous 25%)
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (values.length >= 8) {
      const quarterSize = Math.floor(values.length / 4);
      const recent = values.slice(-quarterSize).reduce((a, b) => a + b, 0) / quarterSize;
      const previous = values.slice(-quarterSize * 2, -quarterSize).reduce((a, b) => a + b, 0) / quarterSize;

      if (previous > 0) {
        const change = (recent - previous) / previous;
        if (change > 0.1) trend = 'up';
        else if (change < -0.1) trend = 'down';
      }
    }

    return {
      count: values.length,
      current: Math.round(current * 100) / 100,
      average: Math.round(average * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      p50: Math.round(p50 * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      trend
    };
  }, [metrics]);

  // Acknowledge an alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert =>
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  }, []);

  // Clear acknowledged alerts
  const clearAcknowledgedAlerts = useCallback(() => {
    setAlerts(prev => prev.filter(alert => !alert.acknowledged));
  }, []);

  // Generate performance report
  const generatePerformanceReport = useCallback(() => {
    const report: Record<string, any> = {
      timestamp: new Date().toISOString(),
      monitoring_duration: Date.now() - (metrics.values().next().value?.[0]?.timestamp || Date.now()),
      metrics: {}
    };

    // Add stats for each metric
    metrics.forEach((_, metricName) => {
      report.metrics[metricName] = getMetricStats(metricName);
    });

    // Add alert summary
    report.alerts = {
      total: alerts.length,
      unacknowledged: alerts.filter(a => !a.acknowledged).length,
      by_level: {
        error: alerts.filter(a => a.level === 'error').length,
        warning: alerts.filter(a => a.level === 'warning').length
      }
    };

    // Log report
    console.log('Performance Report:', report);

    // Send to analytics if available
    if (window.electronAPI?.analytics) {
      window.electronAPI.analytics.trackEvent('performance_report_generated', {
        metric_count: metrics.size,
        alert_count: alerts.length,
        monitoring_duration: report.monitoring_duration
      });
    }

    return report;
  }, [metrics, alerts, getMetricStats]);

  // Reset all metrics and alerts
  const reset = useCallback(() => {
    setMetrics(new Map());
    setAlerts([]);
  }, []);

  // Export performance data
  const exportData = useCallback(() => {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      metrics: Object.fromEntries(metrics),
      alerts,
      thresholds: alertThresholds,
      summary: generatePerformanceReport()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [metrics, alerts, alertThresholds, generatePerformanceReport]);

  // Computed values
  const unacknowledgedAlerts = useMemo(() =>
    alerts.filter(alert => !alert.acknowledged),
    [alerts]
  );

  const criticalAlerts = useMemo(() =>
    alerts.filter(alert => alert.level === 'error' && !alert.acknowledged),
    [alerts]
  );

  const overallHealth = useMemo(() => {
    if (criticalAlerts.length > 0) return 'critical';
    if (unacknowledgedAlerts.length > 0) return 'warning';
    return 'good';
  }, [criticalAlerts, unacknowledgedAlerts]);

  return {
    // State
    isMonitoring,
    metrics: getMetrics(),
    alerts,
    unacknowledgedAlerts,
    criticalAlerts,
    overallHealth,

    // Actions
    recordMetric,
    acknowledgeAlert,
    clearAcknowledgedAlerts,
    reset,

    // Queries
    getMetrics,
    getMetricStats,
    generatePerformanceReport,
    exportData
  };
};