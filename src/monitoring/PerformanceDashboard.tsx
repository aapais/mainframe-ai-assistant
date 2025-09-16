/**
 * Performance Monitoring Dashboard
 * Real-time visualization of system performance metrics with alerting
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import './PerformanceDashboard.css';

interface PerformanceMetric {
  timestamp: Date;
  responseTime: number;
  throughput: number;
  cacheHitRate: number;
  slaCompliance: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface AlertData {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'critical';
  metric: string;
  message: string;
  currentValue: number;
  threshold: number;
}

interface DashboardProps {
  performanceService: any;
  searchService: any;
  onOptimizationRequired?: (metric: string) => void;
}

const SLA_THRESHOLDS = {
  AUTOCOMPLETE: 100,
  SEARCH: 1000,
  AVAILABILITY: 99.9,
  MEMORY: 500
};

const COLORS = {
  primary: '#2563eb',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  secondary: '#6b7280'
};

export const PerformanceDashboard: React.FC<DashboardProps> = ({
  performanceService,
  searchService,
  onOptimizationRequired
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d'>('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Real-time metrics collection
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setIsLoading(true);
        const data = await performanceService.getMetrics(selectedTimeRange);
        setMetrics(data.metrics);
        setAlerts(data.alerts);
      } catch (error) {
        console.error('Failed to load performance metrics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetrics();

    if (autoRefresh) {
      const interval = setInterval(loadMetrics, 15000); // 15 second refresh
      return () => clearInterval(interval);
    }
  }, [selectedTimeRange, autoRefresh, performanceService]);

  // SLA compliance calculations
  const slaStatus = useMemo(() => {
    if (metrics.length === 0) return null;

    const latest = metrics[metrics.length - 1];
    const recent = metrics.slice(-20); // Last 20 data points

    const avgResponseTime = recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length;
    const avgThroughput = recent.reduce((sum, m) => sum + m.throughput, 0) / recent.length;
    const avgAvailability = recent.reduce((sum, m) => sum + m.slaCompliance, 0) / recent.length * 100;
    const avgMemoryUsage = recent.reduce((sum, m) => sum + m.memoryUsage, 0) / recent.length;

    return {
      responseTime: {
        current: avgResponseTime,
        threshold: SLA_THRESHOLDS.SEARCH,
        compliance: avgResponseTime <= SLA_THRESHOLDS.SEARCH,
        percentage: Math.max(0, (1 - avgResponseTime / (SLA_THRESHOLDS.SEARCH * 2)) * 100)
      },
      availability: {
        current: avgAvailability,
        threshold: SLA_THRESHOLDS.AVAILABILITY,
        compliance: avgAvailability >= SLA_THRESHOLDS.AVAILABILITY,
        percentage: avgAvailability
      },
      memoryUsage: {
        current: avgMemoryUsage,
        threshold: SLA_THRESHOLDS.MEMORY,
        compliance: avgMemoryUsage <= SLA_THRESHOLDS.MEMORY,
        percentage: Math.max(0, (1 - avgMemoryUsage / (SLA_THRESHOLDS.MEMORY * 2)) * 100)
      },
      overall: (avgResponseTime <= SLA_THRESHOLDS.SEARCH && avgAvailability >= SLA_THRESHOLDS.AVAILABILITY && avgMemoryUsage <= SLA_THRESHOLDS.MEMORY)
    };
  }, [metrics]);

  // Alert severity distribution
  const alertDistribution = useMemo(() => {
    const distribution = alerts.reduce((acc, alert) => {
      acc[alert.level] = (acc[alert.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { name: 'Critical', value: distribution.critical || 0, color: COLORS.danger },
      { name: 'Warning', value: distribution.warning || 0, color: COLORS.warning },
      { name: 'Info', value: distribution.info || 0, color: COLORS.secondary }
    ];
  }, [alerts]);

  // Performance trend analysis
  const performanceTrend = useMemo(() => {
    if (metrics.length < 2) return 'stable';

    const recent = metrics.slice(-10);
    const older = metrics.slice(-20, -10);

    if (recent.length === 0 || older.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.responseTime, 0) / older.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    if (change > 0.1) return 'deteriorating';
    if (change < -0.1) return 'improving';
    return 'stable';
  }, [metrics]);

  const handleOptimizationAction = (metric: string) => {
    onOptimizationRequired?.(metric);
  };

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading performance metrics...</p>
      </div>
    );
  }

  return (
    <div className="performance-dashboard">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Performance Monitoring Dashboard</h1>
          <div className="refresh-controls">
            <label className="auto-refresh">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
              className="time-range-select"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
            </select>
          </div>
        </div>

        <div className="header-right">
          <div className={`overall-status ${slaStatus?.overall ? 'healthy' : 'degraded'}`}>
            <span className="status-indicator"></span>
            {slaStatus?.overall ? 'All Systems Operational' : 'Performance Issues Detected'}
          </div>
        </div>
      </div>

      {/* SLA Compliance Cards */}
      <div className="sla-overview">
        <div className="sla-card">
          <div className="sla-header">
            <h3>Response Time SLA</h3>
            <span className={`sla-status ${slaStatus?.responseTime.compliance ? 'compliant' : 'violation'}`}>
              {slaStatus?.responseTime.compliance ? '✓ Compliant' : '⚠ Violation'}
            </span>
          </div>
          <div className="sla-metrics">
            <div className="current-value">
              {formatDuration(slaStatus?.responseTime.current || 0)}
            </div>
            <div className="threshold">
              Target: {formatDuration(SLA_THRESHOLDS.SEARCH)}
            </div>
            <div className="compliance-bar">
              <div
                className="compliance-fill"
                style={{ width: `${slaStatus?.responseTime.percentage || 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="sla-card">
          <div className="sla-header">
            <h3>Availability SLA</h3>
            <span className={`sla-status ${slaStatus?.availability.compliance ? 'compliant' : 'violation'}`}>
              {slaStatus?.availability.compliance ? '✓ Compliant' : '⚠ Violation'}
            </span>
          </div>
          <div className="sla-metrics">
            <div className="current-value">
              {(slaStatus?.availability.current || 0).toFixed(2)}%
            </div>
            <div className="threshold">
              Target: {SLA_THRESHOLDS.AVAILABILITY}%
            </div>
            <div className="compliance-bar">
              <div
                className="compliance-fill"
                style={{ width: `${slaStatus?.availability.percentage || 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="sla-card">
          <div className="sla-header">
            <h3>Memory Usage</h3>
            <span className={`sla-status ${slaStatus?.memoryUsage.compliance ? 'compliant' : 'violation'}`}>
              {slaStatus?.memoryUsage.compliance ? '✓ Compliant' : '⚠ Violation'}
            </span>
          </div>
          <div className="sla-metrics">
            <div className="current-value">
              {(slaStatus?.memoryUsage.current || 0).toFixed(0)}MB
            </div>
            <div className="threshold">
              Target: &lt;{SLA_THRESHOLDS.MEMORY}MB
            </div>
            <div className="compliance-bar">
              <div
                className="compliance-fill"
                style={{ width: `${slaStatus?.memoryUsage.percentage || 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="sla-card trend-card">
          <div className="sla-header">
            <h3>Performance Trend</h3>
            <span className={`trend-indicator ${performanceTrend}`}>
              {performanceTrend === 'improving' && '↗ Improving'}
              {performanceTrend === 'stable' && '→ Stable'}
              {performanceTrend === 'deteriorating' && '↘ Degrading'}
            </span>
          </div>
        </div>
      </div>

      {/* Performance Charts */}
      <div className="charts-grid">
        {/* Response Time Chart */}
        <div className="chart-container">
          <div className="chart-header">
            <h3>Response Time Trends</h3>
            <button
              className="optimize-btn"
              onClick={() => handleOptimizationAction('response-time')}
            >
              Optimize
            </button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} />
              <YAxis />
              <Tooltip
                labelFormatter={(value) => `Time: ${formatTime(new Date(value))}`}
                formatter={(value: number) => [formatDuration(value), 'Response Time']}
              />
              <Area
                type="monotone"
                dataKey="responseTime"
                stroke={COLORS.primary}
                fill={COLORS.primary}
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Throughput Chart */}
        <div className="chart-container">
          <div className="chart-header">
            <h3>Throughput (Queries/sec)</h3>
            <button
              className="optimize-btn"
              onClick={() => handleOptimizationAction('throughput')}
            >
              Optimize
            </button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} />
              <YAxis />
              <Tooltip
                labelFormatter={(value) => `Time: ${formatTime(new Date(value))}`}
                formatter={(value: number) => [`${value.toFixed(1)} QPS`, 'Throughput']}
              />
              <Line
                type="monotone"
                dataKey="throughput"
                stroke={COLORS.success}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Cache Performance Chart */}
        <div className="chart-container">
          <div className="chart-header">
            <h3>Cache Hit Rate</h3>
            <button
              className="optimize-btn"
              onClick={() => handleOptimizationAction('cache')}
            >
              Optimize
            </button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} />
              <YAxis domain={[0, 1]} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
              <Tooltip
                labelFormatter={(value) => `Time: ${formatTime(new Date(value))}`}
                formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Cache Hit Rate']}
              />
              <Area
                type="monotone"
                dataKey="cacheHitRate"
                stroke={COLORS.warning}
                fill={COLORS.warning}
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Error Rate Chart */}
        <div className="chart-container">
          <div className="chart-header">
            <h3>Error Rate</h3>
            <button
              className="optimize-btn"
              onClick={() => handleOptimizationAction('errors')}
            >
              Investigate
            </button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} />
              <YAxis tickFormatter={(value) => `${(value * 100).toFixed(1)}%`} />
              <Tooltip
                labelFormatter={(value) => `Time: ${formatTime(new Date(value))}`}
                formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, 'Error Rate']}
              />
              <Bar dataKey="errorRate" fill={COLORS.danger} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerts and Recommendations */}
      <div className="alerts-section">
        <div className="alerts-container">
          <div className="alerts-header">
            <h3>Active Alerts</h3>
            <div className="alert-distribution">
              <ResponsiveContainer width={150} height={100}>
                <PieChart>
                  <Pie
                    data={alertDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={40}
                    innerRadius={20}
                  >
                    {alertDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="alerts-list">
            {alerts.length === 0 ? (
              <div className="no-alerts">
                <span className="success-icon">✓</span>
                No active alerts
              </div>
            ) : (
              alerts.slice(0, 5).map(alert => (
                <div key={alert.id} className={`alert-item ${alert.level}`}>
                  <div className="alert-icon">
                    {alert.level === 'critical' && '🚨'}
                    {alert.level === 'warning' && '⚠️'}
                    {alert.level === 'info' && 'ℹ️'}
                  </div>
                  <div className="alert-content">
                    <div className="alert-message">{alert.message}</div>
                    <div className="alert-details">
                      {alert.metric} • Current: {alert.currentValue} • Threshold: {alert.threshold}
                    </div>
                    <div className="alert-timestamp">
                      {formatTime(alert.timestamp)}
                    </div>
                  </div>
                  <button
                    className="alert-action"
                    onClick={() => handleOptimizationAction(alert.metric)}
                  >
                    Fix
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Performance Recommendations */}
        <div className="recommendations-container">
          <h3>Optimization Recommendations</h3>
          <div className="recommendations-list">
            <div className="recommendation-item">
              <div className="recommendation-priority high">High</div>
              <div className="recommendation-content">
                <div className="recommendation-title">Optimize Database Queries</div>
                <div className="recommendation-description">
                  Several queries exceed 500ms response time. Consider adding indexes.
                </div>
              </div>
              <button
                className="recommendation-action"
                onClick={() => handleOptimizationAction('database')}
              >
                Apply
              </button>
            </div>

            <div className="recommendation-item">
              <div className="recommendation-priority medium">Medium</div>
              <div className="recommendation-content">
                <div className="recommendation-title">Increase Cache TTL</div>
                <div className="recommendation-description">
                  Cache hit rate is below optimal. Consider increasing TTL for stable data.
                </div>
              </div>
              <button
                className="recommendation-action"
                onClick={() => handleOptimizationAction('cache-ttl')}
              >
                Apply
              </button>
            </div>

            <div className="recommendation-item">
              <div className="recommendation-priority low">Low</div>
              <div className="recommendation-content">
                <div className="recommendation-title">Bundle Size Optimization</div>
                <div className="recommendation-description">
                  Application bundle could be reduced by implementing code splitting.
                </div>
              </div>
              <button
                className="recommendation-action"
                onClick={() => handleOptimizationAction('bundle')}
              >
                Plan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Stats Footer */}
      <div className="dashboard-footer">
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-label">Avg Response Time</div>
            <div className="stat-value">
              {formatDuration(slaStatus?.responseTime.current || 0)}
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Current QPS</div>
            <div className="stat-value">
              {(metrics[metrics.length - 1]?.throughput || 0).toFixed(1)}
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Cache Hit Rate</div>
            <div className="stat-value">
              {((metrics[metrics.length - 1]?.cacheHitRate || 0) * 100).toFixed(1)}%
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Memory Usage</div>
            <div className="stat-value">
              {(slaStatus?.memoryUsage.current || 0).toFixed(0)}MB
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Uptime</div>
            <div className="stat-value">
              {((metrics[metrics.length - 1]?.slaCompliance || 0) * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;