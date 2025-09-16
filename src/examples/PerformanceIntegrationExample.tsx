/**
 * Performance Integration Example
 *
 * Demonstrates how to integrate all performance monitoring and optimization
 * components in a React application with real-time updates and automated responses.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PerformanceDashboard } from '../monitoring/PerformanceDashboard';
import { PerformanceService } from '../services/PerformanceService';
import { getPerformanceConfig } from '../config/performance.config';
import Database from 'better-sqlite3';

interface PerformanceIntegrationProps {
  database: Database.Database;
}

export const PerformanceIntegrationExample: React.FC<PerformanceIntegrationProps> = ({
  database
}) => {
  const [performanceService, setPerformanceService] = useState<PerformanceService | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'success' | 'warning' | 'error';
    message: string;
    timestamp: Date;
  }>>([]);

  // Initialize performance service
  useEffect(() => {
    const initializeService = async () => {
      try {
        const config = getPerformanceConfig(process.env.NODE_ENV);
        const service = new PerformanceService(database, {
          autoOptimization: config.optimization.autoOptimizationEnabled,
          alertThresholds: {
            responseTime: config.sla.search,
            memoryUsage: config.sla.memoryUsage,
            errorRate: config.sla.errorRate,
            cacheHitRate: 0.7
          },
          monitoringInterval: config.monitoring.interval,
          optimizationCooldown: config.optimization.optimizationCooldown
        });

        // Set up event listeners
        setupPerformanceEventListeners(service);

        setPerformanceService(service);
        setIsLoading(false);

        addNotification('success', 'Performance monitoring initialized successfully');

      } catch (error) {
        console.error('Failed to initialize performance service:', error);
        addNotification('error', 'Failed to initialize performance monitoring');
        setIsLoading(false);
      }
    };

    initializeService();
  }, [database]);

  // Set up event listeners for performance events
  const setupPerformanceEventListeners = (service: PerformanceService) => {
    // Performance alerts
    service.on('performance-alert', (alert) => {
      const type = alert.level === 'critical' ? 'error' : 'warning';
      addNotification(type, `Performance Alert: ${alert.message}`);

      // Auto-respond to critical alerts
      if (alert.level === 'critical' && alert.metric === 'response_time') {
        handleCriticalPerformanceAlert(service, alert);
      }
    });

    // Optimization events
    service.on('optimization-started', (data) => {
      addNotification('info', `Starting optimization: ${data.strategy}`);
    });

    service.on('optimization-completed', (data) => {
      const improvement = data.result.improvement.toFixed(1);
      addNotification('success', `Optimization completed: ${improvement}% improvement`);
    });

    // Service initialization
    service.on('service-initialized', () => {
      addNotification('success', 'Performance service ready');
    });
  };

  // Handle critical performance alerts with automated response
  const handleCriticalPerformanceAlert = async (
    service: PerformanceService,
    alert: any
  ) => {
    try {
      console.log('🚨 Responding to critical performance alert...');

      // Get recommendations for the specific metric
      const recommendations = await service.getOptimizationRecommendations(alert.metric);

      // Execute the highest priority quick win if available
      if (recommendations.quickWins.length > 0) {
        const quickWin = recommendations.quickWins[0];
        addNotification('info', `Auto-executing optimization: ${quickWin.name}`);

        const result = await service.executeOptimization(quickWin.name);

        if (result.success) {
          addNotification('success', `Auto-optimization successful: ${result.improvement.toFixed(1)}% improvement`);
        } else {
          addNotification('error', `Auto-optimization failed: ${result.error}`);
        }
      }

    } catch (error) {
      console.error('Failed to handle critical alert:', error);
      addNotification('error', 'Failed to auto-respond to critical alert');
    }
  };

  // Handle optimization requests from dashboard
  const handleOptimizationRequest = useCallback(async (metric: string) => {
    if (!performanceService) return;

    try {
      addNotification('info', `Getting optimization recommendations for: ${metric}`);

      const recommendations = await performanceService.getOptimizationRecommendations(metric);

      if (recommendations.strategies.length > 0) {
        const strategy = recommendations.strategies[0];
        addNotification('info', `Executing optimization: ${strategy.name}`);

        const result = await performanceService.executeOptimization(strategy.name);

        if (result.success) {
          addNotification('success', `Optimization successful: ${result.improvement.toFixed(1)}% improvement`);
        } else {
          addNotification('error', `Optimization failed: ${result.error}`);
        }
      } else {
        addNotification('warning', `No optimization strategies available for: ${metric}`);
      }

    } catch (error) {
      console.error('Optimization request failed:', error);
      addNotification('error', 'Optimization request failed');
    }
  }, [performanceService]);

  // Add notification helper
  const addNotification = (type: 'success' | 'warning' | 'error' | 'info', message: string) => {
    const notification = {
      id: Date.now().toString(),
      type: type as 'success' | 'warning' | 'error',
      message,
      timestamp: new Date()
    };

    setNotifications(prev => [...prev, notification].slice(-10)); // Keep last 10 notifications

    // Auto-remove after 5 seconds for non-error notifications
    if (type !== 'error') {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 5000);
    }
  };

  // Performance test runner
  const runPerformanceTests = useCallback(async () => {
    if (!performanceService) return;

    try {
      addNotification('info', 'Running performance test suite...');

      const results = await performanceService.runPerformanceTests();

      const passed = results.summary.passed;
      const total = results.summary.totalTests;
      const compliance = (results.summary.slaCompliance * 100).toFixed(1);

      if (results.summary.passed === results.summary.totalTests) {
        addNotification('success', `All ${total} performance tests passed (${compliance}% SLA compliance)`);
      } else {
        addNotification('warning', `${passed}/${total} tests passed (${compliance}% SLA compliance)`);
      }

      // Show regressions if any
      if (results.regressions && results.regressions.length > 0) {
        addNotification('error', `Found ${results.regressions.length} performance regressions`);
      }

    } catch (error) {
      console.error('Performance tests failed:', error);
      addNotification('error', 'Performance tests failed');
    }
  }, [performanceService]);

  // Memory profiling
  const runMemoryProfile = useCallback(async () => {
    if (!performanceService) return;

    try {
      addNotification('info', 'Profiling memory usage...');

      const profile = await performanceService.profileMemory();

      const heapMB = (profile.usage.heapUsed / 1024 / 1024).toFixed(1);
      const leakCount = profile.leaks.length;

      if (leakCount === 0) {
        addNotification('success', `Memory profile clean: ${heapMB}MB heap usage`);
      } else {
        addNotification('warning', `Found ${leakCount} potential memory leaks (${heapMB}MB heap usage)`);
      }

    } catch (error) {
      console.error('Memory profiling failed:', error);
      addNotification('error', 'Memory profiling failed');
    }
  }, [performanceService]);

  if (isLoading) {
    return (
      <div className="performance-integration-loading">
        <div className="loading-spinner"></div>
        <p>Initializing performance monitoring...</p>
      </div>
    );
  }

  return (
    <div className="performance-integration">
      {/* Notifications */}
      <div className="notifications-container">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`notification notification-${notification.type}`}
          >
            <div className="notification-content">
              <span className="notification-message">{notification.message}</span>
              <span className="notification-time">
                {notification.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <button
              className="notification-close"
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Control Panel */}
      <div className="performance-controls">
        <div className="controls-section">
          <h3>Performance Controls</h3>
          <div className="control-buttons">
            <button
              className="btn btn-primary"
              onClick={runPerformanceTests}
              disabled={!performanceService}
            >
              🧪 Run Performance Tests
            </button>

            <button
              className="btn btn-secondary"
              onClick={runMemoryProfile}
              disabled={!performanceService}
            >
              🧠 Profile Memory
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => performanceService?.setAutoOptimization(!performanceService)}
              disabled={!performanceService}
            >
              🤖 Toggle Auto-Optimization
            </button>
          </div>
        </div>

        <div className="status-section">
          <div className="status-item">
            <span className="status-label">Service Status:</span>
            <span className={`status-value ${performanceService ? 'active' : 'inactive'}`}>
              {performanceService ? '✅ Active' : '❌ Inactive'}
            </span>
          </div>

          <div className="status-item">
            <span className="status-label">Auto-Optimization:</span>
            <span className="status-value">
              {performanceService ? '🤖 Enabled' : '📋 Manual'}
            </span>
          </div>

          <div className="status-item">
            <span className="status-label">Notifications:</span>
            <span className="status-value">{notifications.length} active</span>
          </div>
        </div>
      </div>

      {/* Performance Dashboard */}
      {performanceService && (
        <PerformanceDashboard
          performanceService={performanceService}
          searchService={null} // Would be injected in real implementation
          onOptimizationRequired={handleOptimizationRequest}
        />
      )}

      {/* Performance Metrics Summary */}
      <div className="performance-summary">
        <h3>Real-time Performance Summary</h3>
        <PerformanceMetricsSummary performanceService={performanceService} />
      </div>
    </div>
  );
};

/**
 * Real-time performance metrics summary component
 */
const PerformanceMetricsSummary: React.FC<{
  performanceService: PerformanceService | null;
}> = ({ performanceService }) => {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    if (!performanceService) return;

    const updateMetrics = async () => {
      try {
        const data = await performanceService.getMetrics('1h');
        setMetrics(data);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [performanceService]);

  if (!metrics) {
    return <div className="metrics-loading">Loading metrics...</div>;
  }

  const latestMetric = metrics.metrics[metrics.metrics.length - 1];

  return (
    <div className="metrics-summary">
      <div className="metric-card">
        <h4>Response Time</h4>
        <div className="metric-value">
          {latestMetric?.responseTime?.toFixed(0) || 0}ms
        </div>
        <div className="metric-status">
          {(latestMetric?.responseTime || 0) <= 1000 ? '✅ Within SLA' : '⚠️ SLA Violation'}
        </div>
      </div>

      <div className="metric-card">
        <h4>Throughput</h4>
        <div className="metric-value">
          {latestMetric?.throughput?.toFixed(1) || 0} QPS
        </div>
      </div>

      <div className="metric-card">
        <h4>Cache Hit Rate</h4>
        <div className="metric-value">
          {((latestMetric?.cacheHitRate || 0) * 100).toFixed(1)}%
        </div>
        <div className="metric-status">
          {(latestMetric?.cacheHitRate || 0) >= 0.7 ? '✅ Good' : '⚠️ Low'}
        </div>
      </div>

      <div className="metric-card">
        <h4>Memory Usage</h4>
        <div className="metric-value">
          {latestMetric?.memoryUsage?.toFixed(0) || 0}MB
        </div>
        <div className="metric-status">
          {(latestMetric?.memoryUsage || 0) <= 500 ? '✅ Within Limit' : '⚠️ High Usage'}
        </div>
      </div>

      <div className="metric-card">
        <h4>Active Alerts</h4>
        <div className="metric-value">
          {metrics.alerts?.length || 0}
        </div>
        <div className="metric-status">
          {(metrics.alerts?.length || 0) === 0 ? '✅ No Issues' : '🚨 Attention Needed'}
        </div>
      </div>

      <div className="metric-card">
        <h4>SLA Compliance</h4>
        <div className="metric-value">
          {((metrics.slaStatus?.currentCompliance || 0) * 100).toFixed(1)}%
        </div>
        <div className="metric-status">
          {(metrics.slaStatus?.currentCompliance || 0) >= 0.95 ? '✅ Compliant' : '⚠️ Below Target'}
        </div>
      </div>
    </div>
  );
};

export default PerformanceIntegrationExample;