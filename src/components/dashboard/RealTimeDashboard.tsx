import React, { useState, useEffect, useCallback } from 'react';
import {
  PerformanceMetric,
  PerformanceAlert,
  DashboardConfig,
  TeamNotification
} from '../../types/performance';
import { MetricsGrid } from './MetricsGrid';
import { AlertPanel } from '../alerts/AlertPanel';
import { TrendChart } from '../charts/TrendChart';
import { NotificationCenter } from '../team/NotificationCenter';
import { DashboardControls } from './DashboardControls';

interface RealTimeDashboardProps {
  performanceService: any;
  initialConfig?: Partial<DashboardConfig>;
  className?: string;
}

export const RealTimeDashboard: React.FC<RealTimeDashboardProps> = ({
  performanceService,
  initialConfig,
  className = ''
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [notifications, setNotifications] = useState<TeamNotification[]>([]);
  const [config, setConfig] = useState<DashboardConfig>({
    refreshInterval: 5000,
    timeRange: '1h',
    metrics: ['response_time', 'throughput', 'memory_usage', 'error_rate'],
    layout: 'grid',
    theme: 'light',
    enableRealtime: true,
    alertsEnabled: true,
    ...initialConfig
  });
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize real-time connection
  useEffect(() => {
    const initializeService = async () => {
      try {
        setLoading(true);

        // Set up event listeners
        performanceService.on('connected', setIsConnected);
        performanceService.on('metric', handleNewMetric);
        performanceService.on('alert', handleNewAlert);
        performanceService.on('notification', handleNewNotification);
        performanceService.on('error', handleError);

        // Initialize real-time streaming if enabled
        if (config.enableRealtime) {
          await performanceService.initializeRealtime();
        }

        // Load initial data
        await loadInitialData();

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    initializeService();

    return () => {
      // Cleanup listeners
      performanceService.off('connected', setIsConnected);
      performanceService.off('metric', handleNewMetric);
      performanceService.off('alert', handleNewAlert);
      performanceService.off('notification', handleNewNotification);
      performanceService.off('error', handleError);
    };
  }, [performanceService, config.enableRealtime]);

  // Set up refresh interval for non-realtime mode
  useEffect(() => {
    if (!config.enableRealtime && config.refreshInterval > 0) {
      const interval = setInterval(loadInitialData, config.refreshInterval);
      return () => clearInterval(interval);
    }
  }, [config.refreshInterval, config.enableRealtime]);

  const loadInitialData = useCallback(async () => {
    try {
      const [metricsData, alertsData, notificationsData] = await Promise.all([
        performanceService.getMetrics(config.timeRange, config.metrics),
        performanceService.getAlerts('active'),
        performanceService.getNotifications(true, 20)
      ]);

      setMetrics(metricsData);
      setAlerts(alertsData);
      setNotifications(notificationsData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message);
    }
  }, [performanceService, config.timeRange, config.metrics]);

  const handleNewMetric = useCallback((metric: PerformanceMetric) => {
    setMetrics(prev => {
      // Add new metric and keep only last 1000 entries
      const updated = [...prev, metric].slice(-1000);
      return updated;
    });
  }, []);

  const handleNewAlert = useCallback((alert: PerformanceAlert) => {
    setAlerts(prev => {
      const existing = prev.find(a => a.id === alert.id);
      if (existing) {
        return prev.map(a => a.id === alert.id ? alert : a);
      }
      return [alert, ...prev];
    });
  }, []);

  const handleNewNotification = useCallback((notification: TeamNotification) => {
    setNotifications(prev => [notification, ...prev.slice(0, 19)]);
  }, []);

  const handleError = useCallback((error: any) => {
    console.error('Dashboard error:', error);
    setError(error.message || 'Unknown error occurred');
    setIsConnected(false);
  }, []);

  const handleConfigChange = useCallback(async (newConfig: Partial<DashboardConfig>) => {
    try {
      const updatedConfig = { ...config, ...newConfig };
      setConfig(updatedConfig);

      // Save to service
      await performanceService.updateDashboardConfig(updatedConfig);

      // Reload data if time range or metrics changed
      if (newConfig.timeRange || newConfig.metrics) {
        await loadInitialData();
      }
    } catch (err) {
      console.error('Failed to update dashboard config:', err);
      setError(err.message);
    }
  }, [config, performanceService, loadInitialData]);

  const handleAlertAction = useCallback(async (alertId: string, action: string) => {
    try {
      switch (action) {
        case 'resolve':
          await performanceService.resolveAlert(alertId);
          break;
        case 'mute':
          await performanceService.updateAlert(alertId, { status: 'muted' });
          break;
        default:
          console.warn(`Unknown alert action: ${action}`);
      }
    } catch (err) {
      console.error('Failed to handle alert action:', err);
      setError(err.message);
    }
  }, [performanceService]);

  const handleNotificationRead = useCallback(async (notificationId: string) => {
    try {
      await performanceService.markNotificationRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, [performanceService]);

  // Filter metrics by selected time range
  const filteredMetrics = React.useMemo(() => {
    const now = Date.now();
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    }[config.timeRange];

    return metrics.filter(m => now - m.timestamp <= timeRangeMs);
  }, [metrics, config.timeRange]);

  // Calculate current stats
  const currentStats = React.useMemo(() => {
    if (filteredMetrics.length === 0) return {};

    const latestMetrics = filteredMetrics.slice(-10);
    const stats: Record<string, number> = {};

    config.metrics.forEach(metricName => {
      const metricData = latestMetrics
        .filter(m => m.metric === metricName)
        .map(m => m.value);

      if (metricData.length > 0) {
        stats[metricName] = metricData[metricData.length - 1];
      }
    });

    return stats;
  }, [filteredMetrics, config.metrics]);

  if (loading) {
    return (
      <div className={`performance-dashboard loading ${className}`}>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading performance dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`performance-dashboard ${config.theme} ${className}`}>
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Performance Dashboard</h1>
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
            {config.enableRealtime && (
              <span className="realtime-badge">Real-time</span>
            )}
          </div>
        </div>

        <DashboardControls
          config={config}
          onConfigChange={handleConfigChange}
          isConnected={isConnected}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button
            className="error-dismiss"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Dashboard Content */}
      <div className={`dashboard-content layout-${config.layout}`}>
        {/* Metrics Grid */}
        <section className="metrics-section">
          <MetricsGrid
            metrics={filteredMetrics}
            currentStats={currentStats}
            config={config}
            onMetricClick={(metric) => {
              // Handle metric drill-down
              console.log('Metric clicked:', metric);
            }}
          />
        </section>

        {/* Trend Charts */}
        <section className="charts-section">
          <TrendChart
            metrics={filteredMetrics}
            timeRange={config.timeRange}
            selectedMetrics={config.metrics}
            chartConfig={{
              type: 'line',
              timeRange: config.timeRange,
              aggregation: 'avg',
              showBaseline: true,
              showPercentiles: true,
              smoothing: true
            }}
          />
        </section>

        {/* Alerts Panel */}
        {config.alertsEnabled && (
          <section className="alerts-section">
            <AlertPanel
              alerts={alerts}
              onAlertAction={handleAlertAction}
              compact={config.layout === 'compact'}
            />
          </section>
        )}

        {/* Notifications */}
        <section className="notifications-section">
          <NotificationCenter
            notifications={notifications}
            onNotificationRead={handleNotificationRead}
            compact={config.layout === 'compact'}
          />
        </section>
      </div>

      {/* Dashboard Footer */}
      <div className="dashboard-footer">
        <div className="footer-stats">
          <span>Metrics: {filteredMetrics.length}</span>
          <span>Alerts: {alerts.filter(a => a.status === 'active').length}</span>
          <span>Last Update: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

export default RealTimeDashboard;