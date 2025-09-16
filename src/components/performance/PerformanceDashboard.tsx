/**
 * Real-time Performance Dashboard Component
 *
 * Comprehensive performance monitoring dashboard using React DevTools Profiler API
 * with real-time metrics, alerts, and performance analysis
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { usePerformanceStore, RenderMetrics, PerformanceThresholds } from '../../hooks/useReactProfiler';
import { useComponentHealth, usePerformanceComparison, ComponentHealthScore } from '../../hooks/usePerformanceMonitoring';

// =========================
// TYPES AND INTERFACES
// =========================

interface DashboardProps {
  /** Dashboard title */
  title?: string;
  /** Show detailed metrics */
  showDetails?: boolean;
  /** Enable real-time updates */
  realTime?: boolean;
  /** Update interval in ms */
  updateInterval?: number;
  /** Components to monitor */
  monitoredComponents?: string[];
  /** Custom thresholds */
  customThresholds?: Partial<PerformanceThresholds>;
  /** Dashboard theme */
  theme?: 'light' | 'dark';
  /** Enable export functionality */
  enableExport?: boolean;
}

interface MetricCardProps {
  title: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  status?: 'good' | 'warning' | 'critical';
  icon?: string;
  onClick?: () => void;
}

interface AlertItem {
  id: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  componentName?: string;
  renderTime?: number;
}

// =========================
// UTILITY FUNCTIONS
// =========================

const formatDuration = (ms: number): string => {
  return `${ms.toFixed(2)}ms`;
};

const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString();
};

const getStatusColor = (status: 'good' | 'warning' | 'critical'): string => {
  switch (status) {
    case 'good': return 'text-green-600 bg-green-100';
    case 'warning': return 'text-yellow-600 bg-yellow-100';
    case 'critical': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};

const getTrendIcon = (trend: 'up' | 'down' | 'stable'): string => {
  switch (trend) {
    case 'up': return '↗️';
    case 'down': return '↘️';
    case 'stable': return '➡️';
    default: return '';
  }
};

// =========================
// COMPONENTS
// =========================

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit = '',
  trend = 'stable',
  status = 'good',
  icon = '📊',
  onClick
}) => {
  const statusClasses = getStatusColor(status);
  const trendIcon = getTrendIcon(trend);

  return (
    <div
      className={`p-4 rounded-lg border shadow-sm cursor-pointer transition-all hover:shadow-md ${statusClasses}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium opacity-75">{title}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold">
          {typeof value === 'number' ? formatDuration(value) : value}
          {unit && <span className="text-sm ml-1">{unit}</span>}
        </span>
        <span className="text-lg" title={`Trend: ${trend}`}>
          {trendIcon}
        </span>
      </div>
    </div>
  );
};

const AlertsList: React.FC<{ alerts: AlertItem[] }> = ({ alerts }) => {
  if (alerts.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <span className="text-2xl mb-2 block">✅</span>
        No performance alerts
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`p-3 rounded border-l-4 ${
            alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
            alert.severity === 'warning' ? 'border-yellow-500 bg-yellow-50' :
            'border-blue-500 bg-blue-50'
          }`}
        >
          <div className="flex justify-between items-start mb-1">
            <span className="font-medium text-sm">
              {alert.componentName || 'System'}
            </span>
            <span className="text-xs opacity-75">
              {formatTimestamp(alert.timestamp)}
            </span>
          </div>
          <p className="text-sm">{alert.message}</p>
          {alert.renderTime && (
            <span className="text-xs opacity-75">
              Render time: {formatDuration(alert.renderTime)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

const PerformanceChart: React.FC<{
  metrics: RenderMetrics[];
  thresholds: PerformanceThresholds;
  height?: number;
}> = ({ metrics, thresholds, height = 200 }) => {
  const chartData = useMemo(() => {
    const recent = metrics.slice(0, 50).reverse(); // Last 50 renders
    return recent.map((metric, index) => ({
      x: index,
      y: metric.actualDuration,
      exceeds: metric.actualDuration > thresholds.critical,
      phase: metric.phase,
      timestamp: metric.timestamp
    }));
  }, [metrics, thresholds]);

  const maxY = Math.max(...chartData.map(d => d.y), thresholds.critical * 1.2);

  return (
    <div className="relative" style={{ height }}>
      <svg width="100%" height={height} className="border rounded">
        {/* Threshold lines */}
        <line
          x1="0"
          y1={height - (thresholds.critical / maxY) * height}
          x2="100%"
          y2={height - (thresholds.critical / maxY) * height}
          stroke="#ef4444"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
        <line
          x1="0"
          y1={height - (thresholds.warning / maxY) * height}
          x2="100%"
          y2={height - (thresholds.warning / maxY) * height}
          stroke="#f59e0b"
          strokeWidth="1"
          strokeDasharray="3,3"
        />

        {/* Data points */}
        {chartData.map((point, index) => (
          <circle
            key={index}
            cx={`${(point.x / (chartData.length - 1)) * 100}%`}
            cy={height - (point.y / maxY) * height}
            r="3"
            fill={point.exceeds ? '#ef4444' : point.y > thresholds.warning ? '#f59e0b' : '#10b981'}
            title={`${formatDuration(point.y)} (${point.phase})`}
          />
        ))}

        {/* Connect points with line */}
        {chartData.length > 1 && (
          <polyline
            fill="none"
            stroke="#6b7280"
            strokeWidth="1"
            points={chartData.map(point =>
              `${(point.x / (chartData.length - 1)) * 100}%,${height - (point.y / maxY) * height}`
            ).join(' ')}
          />
        )}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex justify-center space-x-4 text-xs">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-500 rounded mr-1"></div>
          Critical (&gt;{thresholds.critical}ms)
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-yellow-500 rounded mr-1"></div>
          Warning (&gt;{thresholds.warning}ms)
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded mr-1"></div>
          Good (&lt;{thresholds.warning}ms)
        </div>
      </div>
    </div>
  );
};

const ComponentHealthCard: React.FC<{
  componentName: string;
  health: ComponentHealthScore;
}> = ({ componentName, health }) => {
  const gradeColor = {
    A: 'text-green-600 bg-green-100',
    B: 'text-blue-600 bg-blue-100',
    C: 'text-yellow-600 bg-yellow-100',
    D: 'text-orange-600 bg-orange-100',
    F: 'text-red-600 bg-red-100'
  };

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-medium truncate mr-2">{componentName}</h4>
        <div className={`px-2 py-1 rounded text-sm font-bold ${gradeColor[health.grade]}`}>
          {health.grade}
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span>Health Score</span>
          <span>{health.score}/100</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              health.score >= 80 ? 'bg-green-500' :
              health.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${health.score}%` }}
          ></div>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Avg Render:</span>
          <span>{formatDuration(health.metrics.avgRenderTime)}</span>
        </div>
        <div className="flex justify-between">
          <span>Slow Renders:</span>
          <span>{(health.metrics.slowRenderRatio * 100).toFixed(1)}%</span>
        </div>
        {health.metrics.memoryLeaks && (
          <div className="text-red-600">⚠️ Memory leak detected</div>
        )}
        {health.metrics.excessiveReRenders && (
          <div className="text-yellow-600">⚠️ Excessive re-renders</div>
        )}
      </div>

      {health.issues.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="text-xs font-medium mb-1">Issues:</div>
          <ul className="text-xs space-y-1">
            {health.issues.slice(0, 2).map((issue, index) => (
              <li key={index} className="text-red-600">• {issue}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// =========================
// MAIN DASHBOARD COMPONENT
// =========================

export const PerformanceDashboard: React.FC<DashboardProps> = ({
  title = 'React Performance Dashboard',
  showDetails = true,
  realTime = true,
  updateInterval = 1000,
  monitoredComponents = [],
  customThresholds,
  theme = 'light',
  enableExport = true
}) => {
  const { store, clearMetrics, setThresholds, thresholds } = usePerformanceStore();
  const { compareComponents } = usePerformanceComparison();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string>('');
  const [showChart, setShowChart] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Apply custom thresholds
  useEffect(() => {
    if (customThresholds) {
      setThresholds(customThresholds);
    }
  }, [customThresholds, setThresholds]);

  // Generate alerts from metrics
  useEffect(() => {
    const recentMetrics = store.metrics.filter(m =>
      Date.now() - m.timestamp < 60000 && m.exceededThreshold
    );

    const newAlerts: AlertItem[] = recentMetrics.slice(0, 10).map(metric => ({
      id: `alert-${metric.timestamp}-${metric.id}`,
      timestamp: metric.timestamp,
      severity: metric.actualDuration > thresholds.critical * 2 ? 'critical' : 'warning',
      message: `Slow render detected: ${formatDuration(metric.actualDuration)} (${metric.phase})`,
      componentName: metric.id.split('-')[0],
      renderTime: metric.actualDuration
    }));

    setAlerts(newAlerts);
  }, [store.metrics, thresholds]);

  // Get unique components
  const uniqueComponents = useMemo(() => {
    const components = new Set<string>();
    store.metrics.forEach(metric => {
      const componentName = metric.id.split('-')[0];
      components.add(componentName);
    });

    return Array.from(components).filter(comp =>
      monitoredComponents.length === 0 || monitoredComponents.includes(comp)
    );
  }, [store.metrics, monitoredComponents]);

  // Get filtered metrics for selected component
  const filteredMetrics = useMemo(() => {
    if (!selectedComponent) return store.metrics;
    return store.metrics.filter(m => m.id.includes(selectedComponent));
  }, [store.metrics, selectedComponent]);

  // Calculate trends
  const trends = useMemo(() => {
    const recent = store.metrics.slice(0, 10);
    const older = store.metrics.slice(10, 20);

    if (recent.length === 0 || older.length === 0) {
      return { avgRenderTime: 'stable', slowRenders: 'stable' };
    }

    const recentAvg = recent.reduce((sum, m) => sum + m.actualDuration, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.actualDuration, 0) / older.length;

    const recentSlowCount = recent.filter(m => m.exceededThreshold).length;
    const olderSlowCount = older.filter(m => m.exceededThreshold).length;

    return {
      avgRenderTime: recentAvg > olderAvg ? 'up' : recentAvg < olderAvg ? 'down' : 'stable',
      slowRenders: recentSlowCount > olderSlowCount ? 'up' :
                   recentSlowCount < olderSlowCount ? 'down' : 'stable'
    };
  }, [store.metrics]);

  // Export functionality
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        summary: store.stats,
        thresholds,
        alerts,
        metrics: filteredMetrics.slice(0, 100), // Export last 100 metrics
        components: uniqueComponents
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `performance-report-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [store.stats, thresholds, alerts, filteredMetrics, uniqueComponents]);

  const getPerformanceStatus = (avgTime: number): 'good' | 'warning' | 'critical' => {
    if (avgTime > thresholds.critical) return 'critical';
    if (avgTime > thresholds.warning) return 'warning';
    return 'good';
  };

  return (
    <div className={`p-6 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          ⚡ {title}
          {realTime && (
            <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
              LIVE
            </span>
          )}
        </h1>

        <div className="flex space-x-2">
          <select
            value={selectedComponent}
            onChange={(e) => setSelectedComponent(e.target.value)}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="">All Components</option>
            {uniqueComponents.map(comp => (
              <option key={comp} value={comp}>{comp}</option>
            ))}
          </select>

          {enableExport && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isExporting ? '⏳' : '📊'} Export
            </button>
          )}

          <button
            onClick={clearMetrics}
            className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Renders"
          value={store.stats.totalRenders}
          icon="🔄"
          trend={trends.avgRenderTime}
        />

        <MetricCard
          title="Avg Render Time"
          value={store.stats.averageRenderTime}
          status={getPerformanceStatus(store.stats.averageRenderTime)}
          trend={trends.avgRenderTime}
          icon="⏱️"
        />

        <MetricCard
          title="Slow Renders"
          value={store.stats.slowRenderCount}
          status={store.stats.slowRenderCount > 0 ? 'warning' : 'good'}
          trend={trends.slowRenders}
          icon="🐌"
        />

        <MetricCard
          title="Max Render Time"
          value={store.stats.maxRenderTime}
          status={getPerformanceStatus(store.stats.maxRenderTime)}
          icon="📈"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Render Performance Timeline</h3>
              <button
                onClick={() => setShowChart(!showChart)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showChart ? 'Hide' : 'Show'} Chart
              </button>
            </div>
            {showChart && filteredMetrics.length > 0 ? (
              <PerformanceChart
                metrics={filteredMetrics}
                thresholds={thresholds}
                height={250}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                {filteredMetrics.length === 0 ? 'No performance data available' : 'Chart hidden'}
              </div>
            )}
          </div>
        </div>

        {/* Alerts Panel */}
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="text-lg font-medium mb-4 flex items-center">
            🚨 Recent Alerts
            {alerts.length > 0 && (
              <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                {alerts.length}
              </span>
            )}
          </h3>
          <AlertsList alerts={alerts} />
        </div>
      </div>

      {/* Component Health Cards */}
      {showDetails && uniqueComponents.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-4">Component Health Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uniqueComponents.slice(0, 6).map(componentName => (
              <ComponentHealthWrapper
                key={componentName}
                componentName={componentName}
              />
            ))}
          </div>
        </div>
      )}

      {/* Performance Thresholds */}
      <div className="mt-6 bg-white rounded-lg p-4 shadow">
        <h3 className="text-lg font-medium mb-4">Performance Thresholds</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl text-green-600 font-bold">&lt; {thresholds.good}ms</div>
            <div className="text-sm text-green-600">Excellent Performance</div>
          </div>
          <div className="text-center">
            <div className="text-2xl text-yellow-600 font-bold">{thresholds.warning}ms</div>
            <div className="text-sm text-yellow-600">Warning Threshold</div>
          </div>
          <div className="text-center">
            <div className="text-2xl text-red-600 font-bold">{thresholds.critical}ms</div>
            <div className="text-sm text-red-600">Critical Threshold (60fps)</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrapper component for individual component health
const ComponentHealthWrapper: React.FC<{ componentName: string }> = ({ componentName }) => {
  const health = useComponentHealth(componentName);
  return <ComponentHealthCard componentName={componentName} health={health} />;
};

export default PerformanceDashboard;