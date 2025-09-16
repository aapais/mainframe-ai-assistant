/**
 * Performance Indicators Component
 * 
 * Displays real-time performance metrics and loading states:
 * - Cache hit/miss indicators
 * - Response time metrics
 * - Loading progress with ETA
 * - Network savings indicators
 * - Memory usage visualization
 * 
 * @author Frontend Cache Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap,
  Clock,
  TrendingUp,
  Activity,
  Wifi,
  WifiOff,
  Database,
  HardDrive,
  BarChart3,
  Gauge,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react';
import { CachePerformanceMetrics } from '../../services/cache/CacheTypes';

// ========================
// Types & Interfaces
// ========================

export interface PerformanceMetrics {
  responseTime: number;
  cacheHitRatio: number;
  memoryUsage: number;
  networkSavings: number;
  requestCount: number;
  errorRate: number;
  throughput: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
}

export interface LoadingState {
  isLoading: boolean;
  progress: number;
  stage: string;
  eta?: number;
  message?: string;
}

export interface PerformanceIndicatorsProps {
  metrics?: PerformanceMetrics;
  loadingState?: LoadingState;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'minimal' | 'detailed' | 'dashboard';
  className?: string;
  onMetricsClick?: () => void;
}

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  color: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray';
  trend?: number;
  size?: 'sm' | 'md' | 'lg';
}

export interface LoadingProgressProps {
  progress: number;
  stage: string;
  eta?: number;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export interface CacheStatusProps {
  hitRatio: number;
  responseTime: number;
  networkSavings: number;
  size?: 'sm' | 'md' | 'lg';
}

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

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
};

const getPerformanceColor = (value: number, thresholds: { good: number; warning: number }): 'green' | 'yellow' | 'red' => {
  if (value <= thresholds.good) return 'green';
  if (value <= thresholds.warning) return 'yellow';
  return 'red';
};

const getColorClasses = (color: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray') => {
  const colors = {
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-700 dark:text-green-300',
      icon: 'text-green-600 dark:text-green-400',
      border: 'border-green-200 dark:border-green-800'
    },
    yellow: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-700 dark:text-yellow-300',
      icon: 'text-yellow-600 dark:text-yellow-400',
      border: 'border-yellow-200 dark:border-yellow-800'
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
      icon: 'text-red-600 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800'
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-300',
      icon: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800'
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      text: 'text-purple-700 dark:text-purple-300',
      icon: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-200 dark:border-purple-800'
    },
    gray: {
      bg: 'bg-gray-50 dark:bg-gray-900/20',
      text: 'text-gray-700 dark:text-gray-300',
      icon: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-200 dark:border-gray-800'
    }
  };
  
  return colors[color];
};

// ========================
// Sub-components
// ========================

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit = '',
  icon: Icon,
  color,
  trend,
  size = 'md'
}) => {
  const colorClasses = getColorClasses(color);
  const iconSize = size === 'lg' ? 20 : size === 'sm' ? 14 : 16;
  
  const sizeClasses = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4'
  };
  
  const textSizes = {
    sm: { value: 'text-sm', label: 'text-xs' },
    md: { value: 'text-base', label: 'text-sm' },
    lg: { value: 'text-lg', label: 'text-base' }
  };
  
  return (
    <div className={`
      ${colorClasses.bg} ${colorClasses.border} border rounded-lg ${sizeClasses[size]}
      transition-all duration-200 hover:shadow-sm
    `}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={iconSize} className={colorClasses.icon} />
          <span className={`font-medium ${colorClasses.text} ${textSizes[size].label}`}>
            {label}
          </span>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${
            trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'
          }`}>
            <TrendingUp size={10} className={trend < 0 ? 'rotate-180' : ''} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className={`mt-1 font-bold ${colorClasses.text} ${textSizes[size].value}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}{unit && ` ${unit}`}
      </div>
    </div>
  );
};

const LoadingProgress: React.FC<LoadingProgressProps> = ({
  progress,
  stage,
  eta,
  message,
  size = 'md'
}) => {
  const progressPercentage = Math.min(100, Math.max(0, progress * 100));
  
  const containerClasses = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4'
  };
  
  const textSizes = {
    sm: { primary: 'text-sm', secondary: 'text-xs' },
    md: { primary: 'text-base', secondary: 'text-sm' },
    lg: { primary: 'text-lg', secondary: 'text-base' }
  };
  
  const barHeights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };
  
  return (
    <div className={`
      bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 
      rounded-lg ${containerClasses[size]}
    `}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Loader size={size === 'lg' ? 18 : size === 'sm' ? 14 : 16} className="animate-spin text-primary-600 dark:text-primary-400" />
          <span className={`font-medium text-gray-900 dark:text-gray-100 ${textSizes[size].primary}`}>
            {stage}
          </span>
        </div>
        <div className={`${textSizes[size].secondary} text-gray-500 dark:text-gray-400`}>
          {Math.round(progressPercentage)}%
          {eta && (
            <span className="ml-2">• {formatDuration(eta)} remaining</span>
          )}
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full ${barHeights[size]}`}>
        <div 
          className={`bg-primary-600 dark:bg-primary-400 ${barHeights[size]} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      
      {message && (
        <div className={`mt-2 ${textSizes[size].secondary} text-gray-600 dark:text-gray-400`}>
          {message}
        </div>
      )}
    </div>
  );
};

const CacheStatus: React.FC<CacheStatusProps> = ({
  hitRatio,
  responseTime,
  networkSavings,
  size = 'md'
}) => {
  const iconSize = size === 'lg' ? 16 : size === 'sm' ? 12 : 14;
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };
  
  const getStatusColor = (ratio: number) => {
    if (ratio >= 0.8) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
    if (ratio >= 0.6) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
  };
  
  return (
    <div className="flex items-center gap-2">
      {/* Cache Hit Ratio */}
      <div className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${getStatusColor(hitRatio)} ${sizeClasses[size]}
      `}>
        <Zap size={iconSize} />
        <span>{Math.round(hitRatio * 100)}% cached</span>
      </div>
      
      {/* Response Time */}
      <div className={`
        inline-flex items-center gap-1 rounded-full font-medium
        text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20
        ${sizeClasses[size]}
      `}>
        <Clock size={iconSize} />
        <span>{formatDuration(responseTime)}</span>
      </div>
      
      {/* Network Savings */}
      {networkSavings > 0 && (
        <div className={`
          inline-flex items-center gap-1 rounded-full font-medium
          text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20
          ${sizeClasses[size]}
        `}>
          <WifiOff size={iconSize} />
          <span>{formatBytes(networkSavings)} saved</span>
        </div>
      )}
    </div>
  );
};

// ========================
// Main Component
// ========================

export const PerformanceIndicators: React.FC<PerformanceIndicatorsProps> = ({
  metrics,
  loadingState,
  showDetails = false,
  size = 'md',
  variant = 'minimal',
  className = '',
  onMetricsClick
}) => {
  const [isExpanded, setIsExpanded] = useState(showDetails);
  
  // Compute performance status
  const performanceStatus = useMemo(() => {
    if (!metrics) return 'unknown';
    
    const responseTimeStatus = getPerformanceColor(metrics.responseTime, { good: 100, warning: 500 });
    const errorRateStatus = getPerformanceColor(metrics.errorRate, { good: 0.01, warning: 0.05 });
    const cacheStatus = metrics.cacheHitRatio >= 0.8 ? 'green' : metrics.cacheHitRatio >= 0.6 ? 'yellow' : 'red';
    
    // Overall status based on worst metric
    if (responseTimeStatus === 'red' || errorRateStatus === 'red' || cacheStatus === 'red') return 'red';
    if (responseTimeStatus === 'yellow' || errorRateStatus === 'yellow' || cacheStatus === 'yellow') return 'yellow';
    return 'green';
  }, [metrics]);
  
  const handleToggleExpanded = () => {
    setIsExpanded(!isExpanded);
    onMetricsClick?.();
  };
  
  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Loading State */}
        {loadingState?.isLoading && (
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Loader size={12} className="animate-spin" />
            <span>{loadingState.stage}</span>
            {loadingState.progress > 0 && (
              <span>• {Math.round(loadingState.progress * 100)}%</span>
            )}
          </div>
        )}
        
        {/* Cache Status */}
        {metrics && (
          <CacheStatus
            hitRatio={metrics.cacheHitRatio}
            responseTime={metrics.responseTime}
            networkSavings={metrics.networkSavings}
            size={size}
          />
        )}
        
        {/* Overall Status Indicator */}
        {metrics && (
          <button
            onClick={handleToggleExpanded}
            className={`
              inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
              transition-all duration-200 hover:scale-105
              ${getColorClasses(performanceStatus as any).bg}
              ${getColorClasses(performanceStatus as any).text}
            `}
          >
            {performanceStatus === 'green' && <CheckCircle size={12} />}
            {performanceStatus === 'yellow' && <AlertCircle size={12} />}
            {performanceStatus === 'red' && <AlertCircle size={12} />}
            <span>Performance</span>
          </button>
        )}
      </div>
    );
  }
  
  if (variant === 'detailed') {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* Loading Progress */}
        {loadingState?.isLoading && (
          <LoadingProgress
            progress={loadingState.progress}
            stage={loadingState.stage}
            eta={loadingState.eta}
            message={loadingState.message}
            size={size}
          />
        )}
        
        {/* Metrics Grid */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="Response Time"
              value={formatDuration(metrics.responseTime)}
              icon={Clock}
              color={getPerformanceColor(metrics.responseTime, { good: 100, warning: 500 })}
              size={size}
            />
            
            <MetricCard
              label="Cache Hit Rate"
              value={`${Math.round(metrics.cacheHitRatio * 100)}%`}
              icon={Zap}
              color={metrics.cacheHitRatio >= 0.8 ? 'green' : metrics.cacheHitRatio >= 0.6 ? 'yellow' : 'red'}
              size={size}
            />
            
            <MetricCard
              label="Memory Usage"
              value={formatBytes(metrics.memoryUsage)}
              icon={Database}
              color="blue"
              size={size}
            />
            
            <MetricCard
              label="Throughput"
              value={metrics.throughput.toFixed(1)}
              unit="req/s"
              icon={Activity}
              color="purple"
              size={size}
            />
          </div>
        )}
        
        {/* Expanded Details */}
        {isExpanded && metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MetricCard
              label="Error Rate"
              value={`${(metrics.errorRate * 100).toFixed(2)}%`}
              icon={AlertCircle}
              color={getPerformanceColor(metrics.errorRate, { good: 0.01, warning: 0.05 })}
              size={size}
            />
            
            <MetricCard
              label="P95 Latency"
              value={formatDuration(metrics.latency.p95)}
              icon={Gauge}
              color="gray"
              size={size}
            />
            
            <MetricCard
              label="Network Savings"
              value={formatBytes(metrics.networkSavings)}
              icon={WifiOff}
              color="green"
              size={size}
            />
          </div>
        )}
      </div>
    );
  }
  
  // Dashboard variant
  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Performance Dashboard
        </h3>
        <div className={`
          inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium
          ${getColorClasses(performanceStatus as any).bg}
          ${getColorClasses(performanceStatus as any).text}
        `}>
          {performanceStatus === 'green' && <CheckCircle size={14} />}
          {performanceStatus === 'yellow' && <AlertCircle size={14} />}
          {performanceStatus === 'red' && <AlertCircle size={14} />}
          <span className="capitalize">{performanceStatus}</span>
        </div>
      </div>
      
      {/* Loading State */}
      {loadingState?.isLoading && (
        <div className="mb-6">
          <LoadingProgress
            progress={loadingState.progress}
            stage={loadingState.stage}
            eta={loadingState.eta}
            message={loadingState.message}
            size="lg"
          />
        </div>
      )}
      
      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Response Time"
            value={formatDuration(metrics.responseTime)}
            icon={Clock}
            color={getPerformanceColor(metrics.responseTime, { good: 100, warning: 500 })}
            size="lg"
          />
          
          <MetricCard
            label="Cache Hit Rate"
            value={`${Math.round(metrics.cacheHitRatio * 100)}%`}
            icon={Zap}
            color={metrics.cacheHitRatio >= 0.8 ? 'green' : metrics.cacheHitRatio >= 0.6 ? 'yellow' : 'red'}
            size="lg"
          />
          
          <MetricCard
            label="Memory Usage"
            value={formatBytes(metrics.memoryUsage)}
            icon={Database}
            color="blue"
            size="lg"
          />
          
          <MetricCard
            label="Throughput"
            value={metrics.throughput.toFixed(1)}
            unit="req/s"
            icon={Activity}
            color="purple"
            size="lg"
          />
          
          <MetricCard
            label="Error Rate"
            value={`${(metrics.errorRate * 100).toFixed(2)}%`}
            icon={AlertCircle}
            color={getPerformanceColor(metrics.errorRate, { good: 0.01, warning: 0.05 })}
            size="lg"
          />
          
          <MetricCard
            label="P95 Latency"
            value={formatDuration(metrics.latency.p95)}
            icon={Gauge}
            color="gray"
            size="lg"
          />
          
          <MetricCard
            label="Network Savings"
            value={formatBytes(metrics.networkSavings)}
            icon={WifiOff}
            color="green"
            size="lg"
          />
          
          <MetricCard
            label="Total Requests"
            value={metrics.requestCount.toLocaleString()}
            icon={BarChart3}
            color="gray"
            size="lg"
          />
        </div>
      )}
    </div>
  );
};

export default PerformanceIndicators;