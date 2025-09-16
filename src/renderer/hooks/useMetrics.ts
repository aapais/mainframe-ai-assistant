/**
 * React Hook for Metrics and Analytics
 * Provides real-time metrics with auto-refresh and performance tracking
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { DatabaseMetrics } from '../../types';
import { ipcBridge } from '../ipc/IPCBridge';

// Extended metrics interface with computed values
export interface ExtendedMetrics extends DatabaseMetrics {
  // Computed metrics
  success_rate: number;
  queries_per_hour: number;
  avg_entries_per_search: number;
  storage_usage_percent: number;
  performance_score: number;
  
  // Trend indicators
  trends: {
    searches: 'up' | 'down' | 'stable';
    success_rate: 'up' | 'down' | 'stable';
    response_time: 'up' | 'down' | 'stable';
  };
}

// Metrics state interface
export interface UseMetricsState {
  metrics: ExtendedMetrics | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isAutoRefreshing: boolean;
  refreshInterval: number;
}

// Historical data for trend calculation
interface MetricsSnapshot {
  metrics: DatabaseMetrics;
  timestamp: number;
}

// Hook options
export interface UseMetricsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
  enableTrends?: boolean;
  maxHistorySize?: number;
}

// Hook return interface
export interface UseMetricsReturn extends UseMetricsState {
  // Data operations
  loadMetrics: () => Promise<void>;
  refreshMetrics: () => Promise<void>;
  
  // Auto-refresh control
  startAutoRefresh: (interval?: number) => void;
  stopAutoRefresh: () => void;
  setRefreshInterval: (seconds: number) => void;
  
  // Utilities
  clearError: () => void;
  retryLastOperation: () => Promise<void>;
  getMetricsHistory: () => MetricsSnapshot[];
  
  // Performance analysis
  getPerformanceInsights: () => string[];
  getHealthStatus: () => 'excellent' | 'good' | 'warning' | 'critical';
  
  // Data validation
  isDataStale: () => boolean;
  isMetricsAvailable: () => boolean;
}

/**
 * Metrics Hook with auto-refresh and trend analysis
 */
export function useMetrics(options: UseMetricsOptions = {}): UseMetricsReturn {
  const {
    autoRefresh = true,
    refreshInterval = 30, // 30 seconds
    enableTrends = true,
    maxHistorySize = 100
  } = options;

  // State
  const [state, setState] = useState<UseMetricsState>({
    metrics: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
    isAutoRefreshing: false,
    refreshInterval
  });

  // Refs
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout>();
  const lastOperationRef = useRef<() => Promise<void>>();
  const mountedRef = useRef(true);
  const metricsHistoryRef = useRef<MetricsSnapshot[]>([]);

  // Safe state update
  const safeSetState = useCallback((update: Partial<UseMetricsState> | ((prev: UseMetricsState) => UseMetricsState)) => {
    if (mountedRef.current) {
      setState(update);
    }
  }, []);

  // Error handling
  const handleError = useCallback((error: Error, operation?: () => Promise<void>) => {
    console.error('Metrics Error:', error);
    
    if (operation) {
      lastOperationRef.current = operation;
    }
    
    safeSetState(prev => ({
      ...prev,
      error: error.message,
      isLoading: false
    }));
  }, [safeSetState]);

  // Add metrics to history for trend analysis
  const addToHistory = useCallback((rawMetrics: DatabaseMetrics) => {
    const snapshot: MetricsSnapshot = {
      metrics: rawMetrics,
      timestamp: Date.now()
    };
    
    metricsHistoryRef.current.push(snapshot);
    
    // Limit history size
    if (metricsHistoryRef.current.length > maxHistorySize) {
      metricsHistoryRef.current = metricsHistoryRef.current.slice(-maxHistorySize);
    }
  }, [maxHistorySize]);

  // Calculate trends from historical data
  const calculateTrends = useCallback((current: DatabaseMetrics): ExtendedMetrics['trends'] => {
    if (!enableTrends || metricsHistoryRef.current.length < 2) {
      return {
        searches: 'stable',
        success_rate: 'stable',
        response_time: 'stable'
      };
    }

    const history = metricsHistoryRef.current;
    const previous = history[history.length - 2]?.metrics;
    
    if (!previous) {
      return {
        searches: 'stable',
        success_rate: 'stable',
        response_time: 'stable'
      };
    }

    const getTrend = (current: number, previous: number, threshold = 0.05): 'up' | 'down' | 'stable' => {
      const change = (current - previous) / (previous || 1);
      if (change > threshold) return 'up';
      if (change < -threshold) return 'down';
      return 'stable';
    };

    return {
      searches: getTrend(current.searches_today, previous.searches_today, 0.1),
      success_rate: getTrend(current.cache_hit_rate, previous.cache_hit_rate, 0.05),
      response_time: getTrend(current.avg_response_time, previous.avg_response_time, 0.1)
    };
  }, [enableTrends]);

  // Enhance raw metrics with computed values
  const enhanceMetrics = useCallback((rawMetrics: DatabaseMetrics): ExtendedMetrics => {
    const trends = calculateTrends(rawMetrics);
    
    // Calculate success rate (using cache hit rate as proxy)
    const success_rate = rawMetrics.cache_hit_rate || 0;
    
    // Calculate queries per hour
    const queries_per_hour = rawMetrics.searches_today * (24 / (new Date().getHours() + 1));
    
    // Calculate average entries per search (estimated)
    const avg_entries_per_search = rawMetrics.total_entries > 0 ? 
      Math.min(10, Math.max(1, rawMetrics.total_entries / Math.max(1, rawMetrics.searches_today))) : 0;
    
    // Calculate storage usage percentage (assume 100MB max for MVP1)
    const storage_usage_percent = Math.min(100, (rawMetrics.storage_used_mb / 100) * 100);
    
    // Calculate overall performance score (0-100)
    const response_time_score = Math.max(0, 100 - (rawMetrics.avg_response_time / 10));
    const cache_score = rawMetrics.cache_hit_rate || 0;
    const storage_score = Math.max(0, 100 - storage_usage_percent);
    
    const performance_score = (response_time_score + cache_score + storage_score) / 3;

    return {
      ...rawMetrics,
      success_rate,
      queries_per_hour,
      avg_entries_per_search,
      storage_usage_percent,
      performance_score,
      trends
    };
  }, [calculateTrends]);

  // Load metrics
  const loadMetrics = useCallback(async () => {
    safeSetState(prev => ({ ...prev, isLoading: true, error: null }));

    const operation = async () => {
      try {
        const rawMetrics = await ipcBridge.getMetrics();
        addToHistory(rawMetrics);
        
        const enhancedMetrics = enhanceMetrics(rawMetrics);
        
        safeSetState(prev => ({
          ...prev,
          metrics: enhancedMetrics,
          lastUpdated: new Date(),
          isLoading: false,
          error: null
        }));
      } catch (error) {
        handleError(error as Error, loadMetrics);
      }
    };

    lastOperationRef.current = operation;
    await operation();
  }, [safeSetState, addToHistory, enhanceMetrics, handleError]);

  // Refresh metrics (force reload)
  const refreshMetrics = useCallback(async () => {
    // Clear cache before loading
    ipcBridge.clearCache();
    await loadMetrics();
  }, [loadMetrics]);

  // Start auto-refresh
  const startAutoRefresh = useCallback((interval?: number) => {
    const actualInterval = interval || state.refreshInterval;
    
    // Clear existing interval
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
    }

    // Start new interval
    autoRefreshIntervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        loadMetrics();
      }
    }, actualInterval * 1000);

    safeSetState(prev => ({
      ...prev,
      isAutoRefreshing: true,
      refreshInterval: actualInterval
    }));
  }, [state.refreshInterval, loadMetrics, safeSetState]);

  // Stop auto-refresh
  const stopAutoRefresh = useCallback(() => {
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
      autoRefreshIntervalRef.current = undefined;
    }

    safeSetState(prev => ({ ...prev, isAutoRefreshing: false }));
  }, [safeSetState]);

  // Set refresh interval
  const setRefreshInterval = useCallback((seconds: number) => {
    safeSetState(prev => ({ ...prev, refreshInterval: seconds }));
    
    // Restart auto-refresh with new interval if it was running
    if (state.isAutoRefreshing) {
      startAutoRefresh(seconds);
    }
  }, [safeSetState, state.isAutoRefreshing, startAutoRefresh]);

  // Clear error
  const clearError = useCallback(() => {
    safeSetState(prev => ({ ...prev, error: null }));
  }, [safeSetState]);

  // Retry last operation
  const retryLastOperation = useCallback(async () => {
    if (lastOperationRef.current) {
      await lastOperationRef.current();
    }
  }, []);

  // Get metrics history
  const getMetricsHistory = useCallback((): MetricsSnapshot[] => {
    return [...metricsHistoryRef.current];
  }, []);

  // Get performance insights
  const getPerformanceInsights = useCallback((): string[] => {
    const insights: string[] = [];
    const metrics = state.metrics;
    
    if (!metrics) return insights;

    // Response time insights
    if (metrics.avg_response_time > 2000) {
      insights.push('Search response time is slower than optimal (>2s)');
    } else if (metrics.avg_response_time < 500) {
      insights.push('Excellent search response time (<0.5s)');
    }

    // Cache insights
    if (metrics.cache_hit_rate < 50) {
      insights.push('Low cache hit rate - consider increasing cache size');
    } else if (metrics.cache_hit_rate > 80) {
      insights.push('High cache efficiency - good performance');
    }

    // Storage insights
    if (metrics.storage_usage_percent > 90) {
      insights.push('Storage nearly full - consider archiving old entries');
    }

    // Usage insights
    if (metrics.searches_today === 0) {
      insights.push('No searches performed today');
    } else if (metrics.searches_today > 100) {
      insights.push('High search activity - system is well adopted');
    }

    // Trend insights
    if (metrics.trends.searches === 'up') {
      insights.push('Search activity is increasing');
    }
    
    if (metrics.trends.response_time === 'up') {
      insights.push('Response times are getting slower - may need optimization');
    }

    return insights;
  }, [state.metrics]);

  // Get health status
  const getHealthStatus = useCallback((): 'excellent' | 'good' | 'warning' | 'critical' => {
    const metrics = state.metrics;
    
    if (!metrics) return 'warning';

    const score = metrics.performance_score;
    
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'warning';
    return 'critical';
  }, [state.metrics]);

  // Check if data is stale
  const isDataStale = useCallback((): boolean => {
    if (!state.lastUpdated) return true;
    
    const staleThreshold = state.refreshInterval * 2 * 1000; // 2x refresh interval
    return Date.now() - state.lastUpdated.getTime() > staleThreshold;
  }, [state.lastUpdated, state.refreshInterval]);

  // Check if metrics are available
  const isMetricsAvailable = useCallback((): boolean => {
    return state.metrics !== null && !state.error;
  }, [state.metrics, state.error]);

  // Auto-load metrics on mount
  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Setup auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      startAutoRefresh();
    }

    return () => {
      stopAutoRefresh();
    };
  }, [autoRefresh, startAutoRefresh, stopAutoRefresh]);

  // Listen for IPC events that might affect metrics
  useEffect(() => {
    const handleKBUpdated = () => {
      // Refresh metrics when KB is updated
      if (mountedRef.current && !state.isLoading) {
        loadMetrics();
      }
    };

    ipcBridge.on('optimistic:confirmed', handleKBUpdated);

    return () => {
      ipcBridge.removeAllListeners('optimistic:confirmed');
    };
  }, [state.isLoading, loadMetrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,
    
    // Data operations
    loadMetrics,
    refreshMetrics,
    
    // Auto-refresh control
    startAutoRefresh,
    stopAutoRefresh,
    setRefreshInterval,
    
    // Utilities
    clearError,
    retryLastOperation,
    getMetricsHistory,
    
    // Performance analysis
    getPerformanceInsights,
    getHealthStatus,
    
    // Data validation
    isDataStale,
    isMetricsAvailable
  };
}

export default useMetrics;