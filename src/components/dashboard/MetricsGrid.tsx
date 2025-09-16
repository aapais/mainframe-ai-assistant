import React from 'react';
import { PerformanceMetric, DashboardConfig } from '../../types/performance';

interface MetricsGridProps {
  metrics: PerformanceMetric[];
  currentStats: Record<string, number>;
  config: DashboardConfig;
  onMetricClick?: (metric: string) => void;
}

interface MetricCardProps {
  title: string;
  value: number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
  status?: 'good' | 'warning' | 'critical';
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  trend = 'stable',
  trendValue = 0,
  status = 'good',
  onClick
}) => {
  const formatValue = (val: number, unit: string): string => {
    if (unit === 'ms') {
      return val < 1000 ? `${val.toFixed(0)}ms` : `${(val / 1000).toFixed(2)}s`;
    }
    if (unit === 'MB') {
      return val < 1024 ? `${val.toFixed(1)}MB` : `${(val / 1024).toFixed(2)}GB`;
    }
    if (unit === '%') {
      return `${(val * 100).toFixed(1)}%`;
    }
    if (unit === 'rps') {
      return `${val.toFixed(1)} req/s`;
    }
    return `${val.toFixed(2)} ${unit}`;
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#10b981';
    }
  };

  return (
    <div
      className={`metric-card status-${status} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      style={{ borderLeftColor: getStatusColor() }}
    >
      <div className="metric-header">
        <h3 className="metric-title">{title}</h3>
        <span className="metric-status-indicator" style={{ color: getStatusColor() }}>
          ●
        </span>
      </div>

      <div className="metric-value">
        <span className="value">{formatValue(value, unit)}</span>
      </div>

      {trendValue !== 0 && (
        <div className="metric-trend">
          <span className="trend-icon">{getTrendIcon()}</span>
          <span className={`trend-value ${trend}`}>
            {Math.abs(trendValue).toFixed(1)}%
          </span>
        </div>
      )}

      <div className="metric-sparkline">
        {/* Mini sparkline chart would go here */}
        <div className="sparkline-placeholder"></div>
      </div>
    </div>
  );
};

export const MetricsGrid: React.FC<MetricsGridProps> = ({
  metrics,
  currentStats,
  config,
  onMetricClick
}) => {
  // Calculate trends and status for each metric
  const getMetricInfo = (metricName: string) => {
    const currentValue = currentStats[metricName] || 0;

    // Get historical data for trend calculation
    const metricHistory = metrics
      .filter(m => m.metric === metricName)
      .slice(-20) // Last 20 data points
      .map(m => m.value);

    let trend: 'up' | 'down' | 'stable' = 'stable';
    let trendValue = 0;
    let status: 'good' | 'warning' | 'critical' = 'good';

    if (metricHistory.length >= 2) {
      const recent = metricHistory.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const previous = metricHistory.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;

      if (previous > 0) {
        trendValue = ((recent - previous) / previous) * 100;
        trend = trendValue > 5 ? 'up' : trendValue < -5 ? 'down' : 'stable';
      }
    }

    // Determine status based on metric type and thresholds
    switch (metricName) {
      case 'response_time':
        status = currentValue > 2000 ? 'critical' : currentValue > 1000 ? 'warning' : 'good';
        break;
      case 'memory_usage':
        status = currentValue > 500 ? 'critical' : currentValue > 300 ? 'warning' : 'good';
        break;
      case 'error_rate':
        status = currentValue > 0.05 ? 'critical' : currentValue > 0.02 ? 'warning' : 'good';
        break;
      case 'cpu_usage':
        status = currentValue > 80 ? 'critical' : currentValue > 60 ? 'warning' : 'good';
        break;
      default:
        status = 'good';
    }

    return { trend, trendValue, status };
  };

  const getMetricConfig = (metricName: string) => {
    const configs = {
      response_time: { title: 'Response Time', unit: 'ms' },
      throughput: { title: 'Throughput', unit: 'rps' },
      memory_usage: { title: 'Memory Usage', unit: 'MB' },
      cpu_usage: { title: 'CPU Usage', unit: '%' },
      error_rate: { title: 'Error Rate', unit: '%' },
      cache_hit_rate: { title: 'Cache Hit Rate', unit: '%' },
      disk_io: { title: 'Disk I/O', unit: 'MB/s' },
      network_io: { title: 'Network I/O', unit: 'MB/s' },
      active_connections: { title: 'Active Connections', unit: '' },
      queue_depth: { title: 'Queue Depth', unit: '' }
    };

    return configs[metricName] || { title: metricName, unit: '' };
  };

  const gridClass = config.layout === 'compact' ? 'metrics-grid-compact' : 'metrics-grid';

  return (
    <div className={gridClass}>
      <div className="metrics-header">
        <h2>Performance Metrics</h2>
        <div className="metrics-summary">
          <span className="total-metrics">{config.metrics.length} metrics</span>
          <span className="last-update">
            Updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="metrics-cards">
        {config.metrics.map(metricName => {
          const metricConfig = getMetricConfig(metricName);
          const metricInfo = getMetricInfo(metricName);
          const currentValue = currentStats[metricName] || 0;

          return (
            <MetricCard
              key={metricName}
              title={metricConfig.title}
              value={currentValue}
              unit={metricConfig.unit}
              trend={metricInfo.trend}
              trendValue={metricInfo.trendValue}
              status={metricInfo.status}
              onClick={() => onMetricClick?.(metricName)}
            />
          );
        })}
      </div>

      {/* Additional summary cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <h4>System Health</h4>
          <div className="health-indicator">
            {(() => {
              const criticalCount = config.metrics
                .map(m => getMetricInfo(m).status)
                .filter(s => s === 'critical').length;

              if (criticalCount > 0) {
                return <span className="health-critical">🔴 {criticalCount} Critical</span>;
              }

              const warningCount = config.metrics
                .map(m => getMetricInfo(m).status)
                .filter(s => s === 'warning').length;

              if (warningCount > 0) {
                return <span className="health-warning">🟡 {warningCount} Warning</span>;
              }

              return <span className="health-good">🟢 All Good</span>;
            })()}
          </div>
        </div>

        <div className="summary-card">
          <h4>Data Points</h4>
          <div className="data-info">
            <span className="data-count">{metrics.length}</span>
            <span className="data-timespan">
              Last {config.timeRange}
            </span>
          </div>
        </div>

        <div className="summary-card">
          <h4>Refresh Rate</h4>
          <div className="refresh-info">
            <span className="refresh-rate">
              {config.enableRealtime ? 'Real-time' : `${config.refreshInterval / 1000}s`}
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .metrics-grid {
          padding: 1rem;
          background: var(--bg-primary);
        }

        .metrics-grid-compact {
          padding: 0.5rem;
          background: var(--bg-primary);
        }

        .metrics-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border-color);
        }

        .metrics-header h2 {
          margin: 0;
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 600;
        }

        .metrics-summary {
          display: flex;
          gap: 1rem;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .metrics-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .metrics-grid-compact .metrics-cards {
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.75rem;
        }

        .metric-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-left: 4px solid var(--color-success);
          border-radius: 8px;
          padding: 1.25rem;
          transition: all 0.2s ease;
        }

        .metric-card.clickable {
          cursor: pointer;
        }

        .metric-card.clickable:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .metric-card.status-warning {
          border-left-color: var(--color-warning);
        }

        .metric-card.status-critical {
          border-left-color: var(--color-error);
        }

        .metric-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .metric-title {
          margin: 0;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .metric-status-indicator {
          font-size: 0.75rem;
        }

        .metric-value {
          margin-bottom: 0.5rem;
        }

        .metric-value .value {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .metric-trend {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          margin-bottom: 0.75rem;
        }

        .trend-icon {
          font-size: 0.875rem;
        }

        .trend-value {
          font-size: 0.75rem;
          font-weight: 600;
        }

        .trend-value.up {
          color: var(--color-error);
        }

        .trend-value.down {
          color: var(--color-success);
        }

        .trend-value.stable {
          color: var(--text-secondary);
        }

        .sparkline-placeholder {
          height: 20px;
          background: linear-gradient(90deg, var(--color-success) 0%, var(--color-warning) 100%);
          border-radius: 2px;
          opacity: 0.3;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .summary-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 1rem;
          text-align: center;
        }

        .summary-card h4 {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
          text-transform: uppercase;
        }

        .health-indicator, .data-info, .refresh-info {
          font-size: 1rem;
          font-weight: 600;
        }

        .health-good {
          color: var(--color-success);
        }

        .health-warning {
          color: var(--color-warning);
        }

        .health-critical {
          color: var(--color-error);
        }

        .data-count {
          display: block;
          font-size: 1.5rem;
          color: var(--text-primary);
        }

        .data-timespan {
          font-size: 0.75rem;
          color: var(--text-secondary);
          font-weight: normal;
        }

        .refresh-rate {
          color: var(--color-primary);
        }
      `}</style>
    </div>
  );
};

export default MetricsGrid;