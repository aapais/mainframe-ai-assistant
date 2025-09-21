/**
 * Performance Monitoring Dashboard
 *
 * Real-time performance monitoring interface:
 * - Search performance metrics
 * - Memory usage tracking
 * - Bundle analysis visualization
 * - Performance alerts
 * - Optimization recommendations
 *
 * @author Performance Optimizer
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePerformanceMonitor } from '../../utils/performanceMonitor';
import { useMemoryLeakDetector } from '../../utils/memoryManagement';
import { BundleAnalyzer } from '../../utils/bundleOptimization';
import { searchCache } from '../../utils/searchCache';
import './PerformanceDashboard.css';

// ===========================================
// Types and Interfaces
// ===========================================

interface PerformanceMetrics {
  searchTime: number;
  renderTime: number;
  memoryUsage: number;
  frameRate: number;
  cacheHitRate: number;
  bundleSize: number;
}

interface AlertLevel {
  type: 'success' | 'warning' | 'error';
  message: string;
  metric: string;
  value: number;
  threshold: number;
}

// ===========================================
// Performance Metric Card Component
// ===========================================

interface MetricCardProps {
  title: string;
  value: number;
  unit: string;
  threshold: number;
  format?: (value: number) => string;
  description?: string;
  trend?: 'up' | 'down' | 'stable';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  threshold,
  format = (v) => v.toFixed(1),
  description,
  trend = 'stable',
}) => {
  const isHealthy = value <= threshold;
  const percentage = Math.min((value / threshold) * 100, 100);

  const getStatusColor = () => {
    if (isHealthy) return '#16a34a'; // green
    if (value <= threshold * 1.2) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  return (
    <div className="metric-card" style={{
      padding: '20px',
      backgroundColor: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <h3 style={{
          fontSize: '0.875rem',
          fontWeight: '600',
          color: '#374151',
          margin: 0,
        }}>
          {title}
        </h3>
        <span style={{ fontSize: '1rem' }}>{getTrendIcon()}</span>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '4px',
        marginBottom: '16px',
      }}>
        <span style={{
          fontSize: '2rem',
          fontWeight: '700',
          color: getStatusColor(),
        }}>
          {format(value)}
        </span>
        <span style={{
          fontSize: '0.875rem',
          color: '#6b7280',
          fontWeight: '500',
        }}>
          {unit}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '4px',
        backgroundColor: '#f3f4f6',
        borderRadius: '2px',
        overflow: 'hidden',
        marginBottom: '8px',
      }}>
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: getStatusColor(),
            transition: 'width 300ms ease-in-out',
          }}
        />
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.75rem',
        color: '#6b7280',
      }}>
        <span>Target: {format(threshold)}{unit}</span>
        <span className={isHealthy ? 'status-healthy' : 'status-warning'}>
          {isHealthy ? '✅ Healthy' : '⚠️ Needs Attention'}
        </span>
      </div>

      {description && (
        <p style={{
          fontSize: '0.75rem',
          color: '#6b7280',
          margin: '8px 0 0 0',
          lineHeight: '1.4',
        }}>
          {description}
        </p>
      )}
    </div>
  );
};

// ===========================================
// Alerts Panel Component
// ===========================================

interface AlertsPanelProps {
  alerts: AlertLevel[];
  onDismiss: (index: number) => void;
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts, onDismiss }) => {
  if (alerts.length === 0) {
    return (
      <div className="alerts-panel" style={{
        padding: '20px',
        backgroundColor: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: '12px',
        textAlign: 'center',
      }}>
        <span style={{ fontSize: '2rem', marginBottom: '8px', display: 'block' }}>✅</span>
        <p style={{ margin: 0, color: '#16a34a', fontWeight: '500' }}>
          All performance metrics are healthy!
        </p>
      </div>
    );
  }

  return (
    <div className="alerts-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {alerts.map((alert, index) => (
        <div
          key={index}
          className={`alert alert-${alert.type}`}
          style={{
            padding: '16px',
            borderRadius: '8px',
            border: `1px solid ${
              alert.type === 'error' ? '#fecaca' :
              alert.type === 'warning' ? '#fed7aa' : '#bbf7d0'
            }`,
            backgroundColor:
              alert.type === 'error' ? '#fef2f2' :
              alert.type === 'warning' ? '#fffbeb' : '#f0fdf4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.25rem' }}>
              {alert.type === 'error' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <div>
              <h4 style={{
                margin: 0,
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#111827',
              }}>
                {alert.metric}
              </h4>
              <p style={{
                margin: 0,
                fontSize: '0.75rem',
                color: '#6b7280',
              }}>
                {alert.message}
              </p>
              <span style={{
                fontSize: '0.75rem',
                color: '#6b7280',
              }}>
                Current: {alert.value.toFixed(1)} | Threshold: {alert.threshold.toFixed(1)}
              </span>
            </div>
          </div>
          <button
            onClick={() => onDismiss(index)}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              color: '#6b7280',
            }}
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

// ===========================================
// Cache Statistics Component
// ===========================================

const CacheStatistics: React.FC = () => {
  const [cacheStats, setCacheStats] = useState(searchCache.getStats());
  const [cacheEfficiency, setCacheEfficiency] = useState(searchCache.getCacheEfficiency());

  useEffect(() => {
    const interval = setInterval(() => {
      setCacheStats(searchCache.getStats());
      setCacheEfficiency(searchCache.getCacheEfficiency());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="cache-statistics" style={{
      padding: '20px',
      backgroundColor: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
    }}>
      <h3 style={{
        fontSize: '1rem',
        fontWeight: '600',
        color: '#111827',
        margin: '0 0 16px 0',
      }}>
        Search Cache Performance
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#7c3aed' }}>
            {cacheStats.hitRate.toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Hit Rate</div>
        </div>

        <div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#16a34a' }}>
            {cacheStats.totalEntries}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Cached Entries</div>
        </div>

        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>
            {(cacheStats.memoryUsage / 1024 / 1024).toFixed(1)}MB
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Memory Usage</div>
        </div>

        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#059669' }}>
            {cacheEfficiency.averageResponseTime.toFixed(0)}ms
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Avg Response</div>
        </div>
      </div>

      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
        fontSize: '0.75rem',
        color: '#6b7280',
      }}>
        <strong>Memory Savings:</strong> {(cacheEfficiency.memorySavings / 1024 / 1024).toFixed(1)}MB
        from {cacheEfficiency.totalQueries} queries
      </div>
    </div>
  );
};

// ===========================================
// Recommendations Panel Component
// ===========================================

interface RecommendationsPanelProps {
  recommendations: string[];
}

const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({ recommendations }) => {
  return (
    <div className="recommendations-panel" style={{
      padding: '20px',
      backgroundColor: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
    }}>
      <h3 style={{
        fontSize: '1rem',
        fontWeight: '600',
        color: '#111827',
        margin: '0 0 16px 0',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span>💡</span>
        Performance Recommendations
      </h3>

      {recommendations.length === 0 ? (
        <p style={{
          color: '#16a34a',
          fontSize: '0.875rem',
          margin: 0,
          fontStyle: 'italic',
        }}>
          No optimization recommendations at this time. Great job!
        </p>
      ) : (
        <ul style={{
          margin: 0,
          paddingLeft: '20px',
          fontSize: '0.875rem',
          lineHeight: '1.6',
        }}>
          {recommendations.map((recommendation, index) => (
            <li key={index} style={{ marginBottom: '8px', color: '#374151' }}>
              {recommendation}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ===========================================
// Main Performance Dashboard Component
// ===========================================

export const PerformanceDashboard: React.FC = () => {
  const performanceMonitor = usePerformanceMonitor();
  const { detectLeaks, getMemoryTrend } = useMemoryLeakDetector();

  // State
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    searchTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    frameRate: 60,
    cacheHitRate: 0,
    bundleSize: 0,
  });

  const [alerts, setAlerts] = useState<AlertLevel[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Update metrics periodically
  useEffect(() => {
    const updateMetrics = () => {
      const currentMetrics = performanceMonitor.getCurrentMetrics();
      const cacheStats = searchCache.getStats();

      setMetrics({
        searchTime: currentMetrics.searchTime,
        renderTime: currentMetrics.renderTime,
        memoryUsage: currentMetrics.memoryUsage / 1024 / 1024, // Convert to MB
        frameRate: currentMetrics.frameRate,
        cacheHitRate: cacheStats.hitRate,
        bundleSize: 0, // Will be updated by bundle analysis
      });

      // Check for alerts
      const newAlerts: AlertLevel[] = [];

      if (currentMetrics.searchTime > 100) {
        newAlerts.push({
          type: 'warning',
          message: 'Search performance is slower than optimal',
          metric: 'Search Time',
          value: currentMetrics.searchTime,
          threshold: 100,
        });
      }

      if (currentMetrics.frameRate < 55) {
        newAlerts.push({
          type: 'warning',
          message: 'Frame rate is below optimal',
          metric: 'Frame Rate',
          value: currentMetrics.frameRate,
          threshold: 55,
        });
      }

      if (currentMetrics.memoryUsage > 150 * 1024 * 1024) {
        newAlerts.push({
          type: 'error',
          message: 'Memory usage is high',
          metric: 'Memory Usage',
          value: currentMetrics.memoryUsage / 1024 / 1024,
          threshold: 150,
        });
      }

      // Check for memory leaks
      const leakDetection = detectLeaks();
      if (leakDetection.hasLeak) {
        newAlerts.push({
          type: 'error',
          message: 'Potential memory leak detected',
          metric: 'Memory Leak',
          value: leakDetection.growthRate,
          threshold: 10,
        });
      }

      setAlerts(newAlerts);

      // Update recommendations
      setRecommendations(performanceMonitor.getOptimizationSuggestions());
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);

    return () => clearInterval(interval);
  }, [performanceMonitor, detectLeaks]);

  // Analyze bundle size
  useEffect(() => {
    const analyzeBundles = async () => {
      setIsAnalyzing(true);
      try {
        const analysis = await BundleAnalyzer.analyzeBundles();
        setMetrics(prev => ({
          ...prev,
          bundleSize: analysis.totalSize / 1024 / 1024, // Convert to MB
        }));

        const bundleRecommendations = BundleAnalyzer.generateRecommendations(analysis);
        setRecommendations(prev => [...prev, ...bundleRecommendations]);
      } catch (error) {
        console.warn('Bundle analysis failed:', error);
      } finally {
        setIsAnalyzing(false);
      }
    };

    analyzeBundles();
  }, []);

  // Handle alert dismissal
  const handleDismissAlert = useCallback((index: number) => {
    setAlerts(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Format functions
  const formatBytes = (bytes: number) => `${bytes.toFixed(1)}`;
  const formatMs = (ms: number) => `${ms.toFixed(1)}`;
  const formatPercent = (percent: number) => `${percent.toFixed(1)}`;
  const formatFps = (fps: number) => `${fps.toFixed(0)}`;

  return (
    <div className="performance-dashboard" style={{
      padding: '24px',
      backgroundColor: '#f9fafb',
      minHeight: '100vh',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '1.875rem',
          fontWeight: '700',
          color: '#111827',
          margin: '0 0 8px 0',
        }}>
          Performance Dashboard
        </h1>
        <p style={{
          fontSize: '1rem',
          color: '#6b7280',
          margin: 0,
        }}>
          Real-time monitoring of search and application performance
        </p>
      </div>

      {/* Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        marginBottom: '32px',
      }}>
        <MetricCard
          title="Search Response Time"
          value={metrics.searchTime}
          unit="ms"
          threshold={100}
          format={formatMs}
          description="Time to complete search operations"
        />

        <MetricCard
          title="Render Performance"
          value={metrics.renderTime}
          unit="ms"
          threshold={16.67}
          format={formatMs}
          description="Component render time (60fps target)"
        />

        <MetricCard
          title="Memory Usage"
          value={metrics.memoryUsage}
          unit="MB"
          threshold={150}
          format={formatBytes}
          description="Current JavaScript heap usage"
        />

        <MetricCard
          title="Frame Rate"
          value={metrics.frameRate}
          unit="fps"
          threshold={55}
          format={formatFps}
          description="Current animation frame rate"
        />

        <MetricCard
          title="Cache Hit Rate"
          value={metrics.cacheHitRate}
          unit="%"
          threshold={70}
          format={formatPercent}
          description="Search result cache effectiveness"
        />

        <MetricCard
          title="Bundle Size"
          value={metrics.bundleSize}
          unit="MB"
          threshold={2}
          format={formatBytes}
          description="Total JavaScript bundle size"
        />
      </div>

      {/* Alerts and Cache Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '24px',
        marginBottom: '32px',
      }}>
        <div>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#111827',
            margin: '0 0 16px 0',
          }}>
            Performance Alerts
          </h2>
          <AlertsPanel alerts={alerts} onDismiss={handleDismissAlert} />
        </div>

        <CacheStatistics />
      </div>

      {/* Recommendations */}
      <RecommendationsPanel recommendations={recommendations} />

      {/* Analysis Status */}
      {isAnalyzing && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          padding: '12px 16px',
          backgroundColor: '#7c3aed',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          fontSize: '0.875rem',
          fontWeight: '500',
        }}>
          Analyzing bundle performance...
        </div>
      )}
    </div>
  );
};

export default PerformanceDashboard;