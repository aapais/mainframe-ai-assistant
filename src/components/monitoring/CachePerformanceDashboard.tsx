/**
 * Cache Performance Dashboard Component
 * 
 * Comprehensive cache monitoring dashboard with:
 * - Real-time performance metrics visualization
 * - Cache hit/miss ratio tracking
 * - Memory usage and storage analytics
 * - Performance trends and alerts
 * - Interactive cache management tools
 * 
 * @author Frontend Cache Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  TrendingDown,
  Zap,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
  Settings,
  Play,
  Pause,
  Trash2,
  Optimize
} from 'lucide-react';
import { useCacheManager } from '../../hooks/useCacheManager';
import { getCacheApiClient } from '../../services/api/CacheApiClient';
import { CachePerformanceMetrics, CacheStats } from '../../services/cache/CacheTypes';
import { PerformanceIndicators } from '../common/PerformanceIndicators';

// ========================
// Types & Interfaces
// ========================

export interface CachePerformanceDashboardProps {
  refreshInterval?: number;
  showAdvancedMetrics?: boolean;
  enableRealTimeUpdates?: boolean;
  className?: string;
}

export interface MetricsTrend {
  timestamp: number;
  value: number;
  label: string;
}

export interface DashboardState {
  isLoading: boolean;
  isRealTimeEnabled: boolean;
  lastUpdated: Date;
  error: string | null;
  selectedTimeframe: '1h' | '24h' | '7d' | '30d';
}

export interface CacheOperationLog {
  id: string;
  timestamp: Date;
  operation: 'get' | 'set' | 'delete' | 'clear' | 'evict';
  key?: string;
  success: boolean;
  duration: number;
  size?: number;
}

// ========================
// Constants
// ========================

const REFRESH_INTERVALS = {
  realtime: 1000,
  fast: 5000,
  normal: 15000,
  slow: 60000
};

const TIMEFRAMES = {
  '1h': { label: '1 Hour', duration: 60 * 60 * 1000 },
  '24h': { label: '24 Hours', duration: 24 * 60 * 60 * 1000 },
  '7d': { label: '7 Days', duration: 7 * 24 * 60 * 60 * 1000 },
  '30d': { label: '30 Days', duration: 30 * 24 * 60 * 60 * 1000 }
};

// ========================
// Utility Functions
// ========================

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
};

// ========================
// Sub-components
// ========================

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  trend?: number;
  color: 'green' | 'yellow' | 'red' | 'blue' | 'purple';
  onClick?: () => void;
}> = ({ title, value, unit, icon: Icon, trend, color, onClick }) => {
  const colorClasses = {
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300'
  };
  
  return (
    <div 
      className={`
        p-4 border rounded-lg transition-all duration-200 hover:shadow-md cursor-pointer
        ${colorClasses[color]}
      `}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon size={20} />
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${
            trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'
          }`}>
            {trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : null}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold mb-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
      </div>
      <div className="text-sm opacity-75">{title}</div>
    </div>
  );
};

const CacheHitRatioChart: React.FC<{
  hitRate: number;
  missRate: number;
  size?: 'sm' | 'md' | 'lg';
}> = ({ hitRate, missRate, size = 'md' }) => {
  const radius = size === 'lg' ? 60 : size === 'sm' ? 40 : 50;
  const strokeWidth = size === 'lg' ? 8 : size === 'sm' ? 4 : 6;
  const circumference = 2 * Math.PI * radius;
  const hitOffset = circumference - (hitRate * circumference);
  
  return (
    <div className="relative flex items-center justify-center">
      <svg width={radius * 2 + 20} height={radius * 2 + 20} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={radius + 10}
          cy={radius + 10}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        
        {/* Hit rate arc */}
        <circle
          cx={radius + 10}
          cy={radius + 10}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={hitOffset}
          strokeLinecap="round"
          className="text-green-500 transition-all duration-1000 ease-out"
        />
      </svg>
      
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {formatPercent(hitRate)}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Hit Rate</div>
      </div>
    </div>
  );
};

const TrendChart: React.FC<{
  data: MetricsTrend[];
  title: string;
  color: string;
  unit?: string;
}> = ({ data, title, color, unit }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  
  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * 280;
    const y = 80 - ((point.value - minValue) / range) * 60;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">{title}</h3>
      <svg width="280" height="80" className="w-full">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          points={points}
        />
        {data.map((point, index) => {
          const x = (index / (data.length - 1)) * 280;
          const y = 80 - ((point.value - minValue) / range) * 60;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="3"
              fill={color}
              className="hover:r-4 transition-all"
            >
              <title>{`${point.label}: ${point.value}${unit || ''}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
};

const CacheOperationsLog: React.FC<{
  operations: CacheOperationLog[];
  maxItems?: number;
}> = ({ operations, maxItems = 10 }) => {
  const recentOps = operations.slice(0, maxItems);
  
  const getOperationIcon = (operation: CacheOperationLog['operation']) => {
    switch (operation) {
      case 'get': return <Database size={14} className="text-blue-600" />;
      case 'set': return <Play size={14} className="text-green-600" />;
      case 'delete': return <Trash2 size={14} className="text-red-600" />;
      case 'clear': return <RefreshCw size={14} className="text-orange-600" />;
      case 'evict': return <TrendingDown size={14} className="text-yellow-600" />;
      default: return <Database size={14} className="text-gray-600" />;
    }
  };
  
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Recent Operations</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {recentOps.map((op) => (
          <div key={op.id} className="flex items-center gap-3 text-sm">
            <div className="flex-shrink-0">
              {getOperationIcon(op.operation)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                  {op.operation}
                </span>
                {op.key && (
                  <span className="text-gray-500 dark:text-gray-400 truncate max-w-32">
                    {op.key}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatDuration(op.duration)}
                {op.size && ` • ${formatBytes(op.size)}`}
              </div>
            </div>
            <div className="flex-shrink-0">
              {op.success ? (
                <CheckCircle size={12} className="text-green-600" />
              ) : (
                <AlertTriangle size={12} className="text-red-600" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ========================
// Main Component
// ========================

export const CachePerformanceDashboard: React.FC<CachePerformanceDashboardProps> = ({
  refreshInterval = REFRESH_INTERVALS.normal,
  showAdvancedMetrics = false,
  enableRealTimeUpdates = true,
  className = ''
}) => {
  // Hooks
  const cacheManager = useCacheManager();
  const apiClient = getCacheApiClient();
  
  // State
  const [state, setState] = useState<DashboardState>({
    isLoading: true,
    isRealTimeEnabled: enableRealTimeUpdates,
    lastUpdated: new Date(),
    error: null,
    selectedTimeframe: '24h'
  });
  
  const [metrics, setMetrics] = useState<CachePerformanceMetrics | null>(null);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [trends, setTrends] = useState<{
    hitRate: MetricsTrend[];
    responseTime: MetricsTrend[];
    memoryUsage: MetricsTrend[];
  }>({ hitRate: [], responseTime: [], memoryUsage: [] });
  const [operations, setOperations] = useState<CacheOperationLog[]>([]);
  
  // ========================
  // Data Fetching
  // ========================
  
  const fetchMetrics = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Fetch from API
      const [metricsResponse, statsResponse] = await Promise.all([
        apiClient.getMetrics(state.selectedTimeframe),
        apiClient.getStats()
      ]);
      
      if (metricsResponse.success && metricsResponse.data) {
        setMetrics(metricsResponse.data);
      }
      
      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }
      
      // Get local cache metrics
      const localMetrics = cacheManager.getMetrics();
      const localStats = cacheManager.getStats();
      
      // Update trends
      const now = Date.now();
      setTrends(prev => ({
        hitRate: [...prev.hitRate, {
          timestamp: now,
          value: localMetrics.hitRate,
          label: new Date(now).toLocaleTimeString()
        }].slice(-50), // Keep last 50 points
        responseTime: [...prev.responseTime, {
          timestamp: now,
          value: localMetrics.averageAccessTime,
          label: new Date(now).toLocaleTimeString()
        }].slice(-50),
        memoryUsage: [...prev.memoryUsage, {
          timestamp: now,
          value: localMetrics.memoryUsage,
          label: new Date(now).toLocaleTimeString()
        }].slice(-50)
      }));
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        lastUpdated: new Date()
      }));
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch metrics'
      }));
    }
  }, [apiClient, cacheManager, state.selectedTimeframe]);
  
  // ========================
  // Cache Management Actions
  // ========================
  
  const handleOptimizeCache = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      // Optimize local cache
      await cacheManager.optimize();
      
      // Optimize remote cache
      const response = await apiClient.optimize();
      
      if (response.success) {
        // Refresh metrics after optimization
        await fetchMetrics();
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Cache optimization failed'
      }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [cacheManager, apiClient, fetchMetrics]);
  
  const handleClearCache = useCallback(async () => {
    if (!confirm('Are you sure you want to clear all cache entries?')) return;
    
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      // Clear local cache
      await cacheManager.clear();
      
      // Clear remote cache
      const response = await apiClient.clear();
      
      if (response.success) {
        await fetchMetrics();
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Cache clear failed'
      }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [cacheManager, apiClient, fetchMetrics]);
  
  const handleExportMetrics = useCallback(() => {
    const exportData = {
      timestamp: new Date().toISOString(),
      metrics,
      stats,
      trends,
      operations: operations.slice(0, 100)
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cache-metrics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [metrics, stats, trends, operations]);
  
  // ========================
  // Computed Values
  // ========================
  
  const performanceStatus = useMemo(() => {
    if (!metrics || !stats) return 'unknown';
    
    const hitRate = stats.hitRate;
    const responseTime = metrics.responseTime;
    
    if (hitRate >= 0.8 && responseTime <= 100) return 'excellent';
    if (hitRate >= 0.6 && responseTime <= 500) return 'good';
    if (hitRate >= 0.4 && responseTime <= 1000) return 'fair';
    return 'poor';
  }, [metrics, stats]);
  
  const alerts = useMemo(() => {
    const alerts: Array<{ type: 'error' | 'warning' | 'info'; message: string }> = [];
    
    if (stats) {
      if (stats.hitRate < 0.5) {
        alerts.push({ type: 'warning', message: 'Low cache hit rate detected' });
      }
      if (stats.memoryUsage > stats.maxSize * 0.9) {
        alerts.push({ type: 'error', message: 'Cache memory usage critically high' });
      }
      if (stats.evictions > 100) {
        alerts.push({ type: 'warning', message: 'High eviction rate detected' });
      }
    }
    
    if (metrics) {
      if (metrics.responseTime > 1000) {
        alerts.push({ type: 'warning', message: 'High response times detected' });
      }
    }
    
    return alerts;
  }, [stats, metrics]);
  
  // ========================
  // Effects
  // ========================
  
  // Initial load
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);
  
  // Auto-refresh
  useEffect(() => {
    if (!state.isRealTimeEnabled) return;
    
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval, state.isRealTimeEnabled]);
  
  // Real-time metrics subscription
  useEffect(() => {
    if (!enableRealTimeUpdates || !state.isRealTimeEnabled) return;
    
    const unsubscribe = apiClient.subscribeToMetrics((newMetrics) => {
      setMetrics(newMetrics);
      setState(prev => ({ ...prev, lastUpdated: new Date() }));
    });
    
    return () => {
      unsubscribe.then(fn => fn()).catch(console.warn);
    };
  }, [apiClient, enableRealTimeUpdates, state.isRealTimeEnabled]);
  
  // ========================
  // Render
  // ========================
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Cache Performance Dashboard
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Last updated: {state.lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Timeframe selector */}
          <select
            value={state.selectedTimeframe}
            onChange={(e) => setState(prev => ({ ...prev, selectedTimeframe: e.target.value as any }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            {Object.entries(TIMEFRAMES).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          
          {/* Real-time toggle */}
          <button
            onClick={() => setState(prev => ({ ...prev, isRealTimeEnabled: !prev.isRealTimeEnabled }))}
            className={`p-2 rounded-lg transition-colors ${
              state.isRealTimeEnabled
                ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
            title={state.isRealTimeEnabled ? 'Disable real-time updates' : 'Enable real-time updates'}
          >
            {state.isRealTimeEnabled ? <Pause size={16} /> : <Play size={16} />}
          </button>
          
          {/* Actions */}
          <button
            onClick={fetchMetrics}
            disabled={state.isLoading}
            className="p-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw size={16} className={state.isLoading ? 'animate-spin' : ''} />
          </button>
          
          <button
            onClick={handleExportMetrics}
            className="p-2 bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/40 transition-colors"
            title="Export metrics"
          >
            <Download size={16} />
          </button>
          
          <button
            onClick={handleOptimizeCache}
            disabled={state.isLoading}
            className="p-2 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors"
            title="Optimize cache"
          >
            <Optimize size={16} />
          </button>
        </div>
      </div>
      
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div key={index} className={`p-3 rounded-lg flex items-center gap-2 ${
              alert.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200' :
              alert.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200' :
              'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'
            }`}>
              <AlertTriangle size={16} />
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Error State */}
      {state.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertTriangle size={16} />
            <span>{state.error}</span>
          </div>
        </div>
      )}
      
      {/* Performance Overview */}
      {(metrics || stats) && (
        <PerformanceIndicators
          metrics={metrics ? {
            responseTime: metrics.responseTime,
            cacheHitRatio: stats?.hitRate || 0,
            memoryUsage: stats?.memoryUsage || 0,
            networkSavings: metrics.networkSavings || 0,
            requestCount: stats?.hitCount + stats?.missCount || 0,
            errorRate: 0,
            throughput: 0,
            latency: { p50: 0, p95: 0, p99: 0 }
          } : undefined}
          variant="detailed"
          size="md"
        />
      )}
      
      {/* Key Metrics Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Cache Hit Rate"
            value={formatPercent(stats.hitRate)}
            icon={Zap}
            color={stats.hitRate >= 0.8 ? 'green' : stats.hitRate >= 0.6 ? 'yellow' : 'red'}
          />
          
          <MetricCard
            title="Total Entries"
            value={stats.size}
            icon={Database}
            color="blue"
          />
          
          <MetricCard
            title="Memory Usage"
            value={formatBytes(stats.memoryUsage)}
            icon={BarChart3}
            color={stats.memoryUsage > stats.maxSize * 0.8 ? 'red' : 'purple'}
          />
          
          <MetricCard
            title="Evictions"
            value={stats.evictions}
            icon={TrendingDown}
            color={stats.evictions > 50 ? 'yellow' : 'green'}
          />
        </div>
      )}
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Hit Rate Chart */}
        {stats && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Cache Hit Rate</h3>
            <div className="flex justify-center">
              <CacheHitRatioChart
                hitRate={stats.hitRate}
                missRate={1 - stats.hitRate}
                size="lg"
              />
            </div>
          </div>
        )}
        
        {/* Response Time Trend */}
        {trends.responseTime.length > 0 && (
          <TrendChart
            data={trends.responseTime}
            title="Response Time Trend"
            color="#3b82f6"
            unit="ms"
          />
        )}
        
        {/* Memory Usage Trend */}
        {trends.memoryUsage.length > 0 && (
          <TrendChart
            data={trends.memoryUsage}
            title="Memory Usage Trend"
            color="#8b5cf6"
            unit=" bytes"
          />
        )}
      </div>
      
      {/* Operations Log */}
      <CacheOperationsLog operations={operations} />
      
      {/* Advanced Metrics */}
      {showAdvancedMetrics && metrics && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Advanced Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Memory Pressure</div>
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {formatPercent(metrics.memoryPressure)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Eviction Rate</div>
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {metrics.evictionRate.toFixed(2)}/min
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Storage Utilization</div>
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {formatPercent(metrics.storageUtilization)}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleOptimizeCache}
          disabled={state.isLoading}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <Optimize size={16} className="inline mr-2" />
          Optimize Cache
        </button>
        
        <button
          onClick={handleClearCache}
          disabled={state.isLoading}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <Trash2 size={16} className="inline mr-2" />
          Clear Cache
        </button>
      </div>
    </div>
  );
};

export default CachePerformanceDashboard;