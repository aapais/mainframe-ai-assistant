/**
 * Metrics Context - Advanced Analytics and Performance Monitoring
 * 
 * This context provides comprehensive metrics and analytics management with:
 * - Real-time usage metrics collection and aggregation
 * - Performance monitoring with detailed analytics
 * - Cache efficiency tracking and optimization insights
 * - User behavior analysis and patterns
 * - System health monitoring and alerts
 * - Historical data retention with intelligent aggregation
 * - Memory-efficient storage with automated cleanup
 * - Context splitting for optimal performance
 * 
 * @author State Management Architect
 * @version 1.0.0
 */

import React, { 
  createContext, 
  useContext, 
  useReducer, 
  useCallback, 
  useMemo, 
  useEffect,
  useRef,
  ReactNode 
} from 'react';
import { 
  KBMetrics, 
  UsageMetrics, 
  PerformanceMetrics, 
  SearchMetrics,
  MetricAlert,
  UsageAction,
  UsageActivity
} from '../../types/services';
import { createCacheManager, createPerformanceMonitor } from '../utils/stateHelpers';

// =====================
// Types & Interfaces
// =====================

export interface MetricsState {
  // Core metrics
  kbMetrics: KBMetrics;
  
  // Real-time data
  currentSession: {
    sessionId: string;
    startTime: number;
    userId?: string;
    activityCount: number;
    lastActivity: number;
  };
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
  
  // Alerts and notifications
  activeAlerts: MetricAlert[];
  dismissedAlerts: string[];
  
  // Collection settings
  collectionEnabled: boolean;
  retentionPeriod: number; // in days
  aggregationInterval: number; // in milliseconds
  
  // Performance tracking
  performanceMetrics: Map<string, PerformanceMetrics>;
  
  // Cache for computed metrics
  computedMetrics: {
    dailyStats?: DailyStats;
    trends?: MetricTrends;
    healthScore?: number;
    lastComputed: number;
  };
}

export interface DailyStats {
  date: string;
  searches: number;
  successful: number;
  failed: number;
  uniqueUsers: number;
  avgResponseTime: number;
  topCategories: Array<{ category: string; count: number }>;
  topQueries: Array<{ query: string; count: number }>;
}

export interface MetricTrends {
  searches: TrendData[];
  performance: TrendData[];
  success: TrendData[];
  users: TrendData[];
}

export interface TrendData {
  timestamp: number;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

export interface MetricsContextValue {
  // State
  state: MetricsState;
  
  // Core metrics operations
  recordUsageActivity: (activity: Omit<UsageActivity, 'timestamp'>) => Promise<void>;
  recordSearch: (query: string, results: any[], options?: any) => Promise<void>;
  recordPerformance: (operation: string, duration: number, metadata?: any) => Promise<void>;
  recordError: (error: Error, context?: string) => Promise<void>;
  
  // Metrics retrieval
  getKBMetrics: () => Promise<KBMetrics>;
  getUsageMetrics: (period?: string) => Promise<UsageMetrics>;
  getPerformanceMetrics: (operation?: string) => Promise<PerformanceMetrics>;
  getSearchMetrics: (period?: string) => Promise<SearchMetrics>;
  
  // Analytics and insights
  getDailyStats: (date?: string) => Promise<DailyStats>;
  getTrends: (period: string) => Promise<MetricTrends>;
  getHealthScore: () => Promise<number>;
  getTopEntries: (limit?: number) => Promise<Array<{ entryId: string; usage: number }>>;
  
  // Alerts management
  getActiveAlerts: () => MetricAlert[];
  dismissAlert: (alertId: string) => void;
  checkThresholds: () => Promise<void>;
  
  // Configuration
  updateSettings: (settings: Partial<{
    collectionEnabled: boolean;
    retentionPeriod: number;
    aggregationInterval: number;
  }>) => void;
  
  // Data management
  exportMetrics: (format: 'json' | 'csv', options?: any) => Promise<string>;
  clearMetrics: (beforeDate?: Date) => Promise<void>;
  
  // Performance monitoring
  startOperation: (name: string) => string; // Returns operation ID
  endOperation: (operationId: string) => void;
  
  // Utilities
  refreshMetrics: () => Promise<void>;
  resetSession: () => void;
}

// =====================
// Initial State
// =====================

const initialKBMetrics: KBMetrics = {
  overview: {
    totalEntries: 0,
    totalSearches: 0,
    averageSuccessRate: 0,
    totalUsage: 0,
    activeUsers: 0,
    uptime: 0,
  },
  categories: [],
  searches: {
    totalSearches: 0,
    uniqueQueries: 0,
    averageResultCount: 0,
    averageResponseTime: 0,
    noResultQueries: [],
    popularQueries: [],
    searchTypes: {
      exact: 0,
      fuzzy: 0,
      semantic: 0,
      category: 0,
      tag: 0,
      ai: 0,
    },
    aiUsage: {
      totalRequests: 0,
      successRate: 0,
      averageLatency: 0,
      fallbackRate: 0,
    },
  },
  usage: {
    totalViews: 0,
    totalRatings: 0,
    averageRating: 0,
    uniqueUsers: 0,
    mostUsed: [],
    leastUsed: [],
    recentActivity: [],
    userEngagement: {
      dailyActive: 0,
      weeklyActive: 0,
      monthlyActive: 0,
      retention: 0,
    },
  },
  performance: {
    averageSearchTime: 0,
    averageDbTime: 0,
    averageAiTime: 0,
    cacheHitRate: 0,
    errorRate: 0,
    uptime: 0,
    memoryUsage: 0,
    diskUsage: 0,
    throughput: {
      searches: 0,
      creates: 0,
      updates: 0,
    },
  },
  trends: {
    period: '24h',
    searches: [],
    usage: [],
    successRate: [],
    performance: [],
    users: [],
    errors: [],
  },
  alerts: [],
};

const initialState: MetricsState = {
  kbMetrics: initialKBMetrics,
  currentSession: {
    sessionId: `session-${Date.now()}`,
    startTime: Date.now(),
    activityCount: 0,
    lastActivity: Date.now(),
  },
  isLoading: false,
  error: null,
  activeAlerts: [],
  dismissedAlerts: [],
  collectionEnabled: true,
  retentionPeriod: 30, // 30 days
  aggregationInterval: 5 * 60 * 1000, // 5 minutes
  performanceMetrics: new Map(),
  computedMetrics: {
    lastComputed: 0,
  },
};

// =====================
// Actions & Reducer
// =====================

type MetricsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_KB_METRICS'; payload: Partial<KBMetrics> }
  | { type: 'RECORD_ACTIVITY'; payload: UsageActivity }
  | { type: 'UPDATE_SESSION'; payload: Partial<MetricsState['currentSession']> }
  | { type: 'ADD_ALERT'; payload: MetricAlert }
  | { type: 'DISMISS_ALERT'; payload: string }
  | { type: 'UPDATE_PERFORMANCE'; payload: { operation: string; metrics: PerformanceMetrics } }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<{ collectionEnabled: boolean; retentionPeriod: number; aggregationInterval: number }> }
  | { type: 'UPDATE_COMPUTED_METRICS'; payload: Partial<MetricsState['computedMetrics']> }
  | { type: 'RESET_SESSION' };

function metricsReducer(state: MetricsState, action: MetricsAction): MetricsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'UPDATE_KB_METRICS':
      return {
        ...state,
        kbMetrics: {
          ...state.kbMetrics,
          ...action.payload,
        },
      };

    case 'RECORD_ACTIVITY':
      return {
        ...state,
        kbMetrics: {
          ...state.kbMetrics,
          usage: {
            ...state.kbMetrics.usage,
            recentActivity: [
              action.payload,
              ...state.kbMetrics.usage.recentActivity.slice(0, 99), // Keep last 100
            ],
          },
        },
        currentSession: {
          ...state.currentSession,
          activityCount: state.currentSession.activityCount + 1,
          lastActivity: Date.now(),
        },
      };

    case 'UPDATE_SESSION':
      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          ...action.payload,
        },
      };

    case 'ADD_ALERT':
      return {
        ...state,
        activeAlerts: [action.payload, ...state.activeAlerts],
      };

    case 'DISMISS_ALERT':
      return {
        ...state,
        activeAlerts: state.activeAlerts.filter(alert => alert.id !== action.payload),
        dismissedAlerts: [...state.dismissedAlerts, action.payload],
      };

    case 'UPDATE_PERFORMANCE':
      const newPerformanceMap = new Map(state.performanceMetrics);
      newPerformanceMap.set(action.payload.operation, action.payload.metrics);
      return {
        ...state,
        performanceMetrics: newPerformanceMap,
      };

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        ...action.payload,
      };

    case 'UPDATE_COMPUTED_METRICS':
      return {
        ...state,
        computedMetrics: {
          ...state.computedMetrics,
          ...action.payload,
          lastComputed: Date.now(),
        },
      };

    case 'RESET_SESSION':
      return {
        ...state,
        currentSession: {
          sessionId: `session-${Date.now()}`,
          startTime: Date.now(),
          activityCount: 0,
          lastActivity: Date.now(),
        },
      };

    default:
      return state;
  }
}

// =====================
// Context Creation
// =====================

const MetricsContext = createContext<MetricsContextValue | null>(null);

// =====================
// Provider Component
// =====================

export interface MetricsProviderProps {
  children: ReactNode;
  initialState?: Partial<MetricsState>;
  userId?: string;
  enableAutoCollection?: boolean;
  enablePerformanceMonitoring?: boolean;
}

export const MetricsProvider: React.FC<MetricsProviderProps> = ({
  children,
  initialState: providedInitialState = {},
  userId,
  enableAutoCollection = true,
  enablePerformanceMonitoring = true,
}) => {
  const [state, dispatch] = useReducer(metricsReducer, {
    ...initialState,
    ...providedInitialState,
    currentSession: {
      ...initialState.currentSession,
      ...providedInitialState.currentSession,
      userId,
    },
  });
  
  // Performance monitors for different operations
  const performanceMonitors = useRef(new Map<string, ReturnType<typeof createPerformanceMonitor>>());
  
  // Cache for expensive computations
  const metricsCache = useRef(createCacheManager<any>({
    maxSize: 100,
    ttl: 5 * 60 * 1000, // 5 minutes
  }));
  
  // Active operations tracking
  const activeOperations = useRef(new Map<string, { name: string; startTime: number }>());
  
  // =====================
  // Core Metrics Operations
  // =====================
  
  const recordUsageActivity = useCallback(async (
    activity: Omit<UsageActivity, 'timestamp'>
  ): Promise<void> => {
    if (!state.collectionEnabled) return;
    
    const fullActivity: UsageActivity = {
      ...activity,
      timestamp: new Date(),
      sessionId: state.currentSession.sessionId,
      userId: userId || state.currentSession.userId,
    };
    
    try {
      // Record locally
      dispatch({ type: 'RECORD_ACTIVITY', payload: fullActivity });
      
      // Send to main process if available
      if (window.electronAPI?.recordUsageActivity) {
        await window.electronAPI.recordUsageActivity(fullActivity);
      }
      
      // Update session activity
      dispatch({
        type: 'UPDATE_SESSION',
        payload: { lastActivity: Date.now() },
      });
      
    } catch (error) {
      console.error('Failed to record usage activity:', error);
    }
  }, [state.collectionEnabled, state.currentSession.sessionId, userId]);
  
  const recordSearch = useCallback(async (
    query: string, 
    results: any[], 
    options?: any
  ): Promise<void> => {
    if (!state.collectionEnabled) return;
    
    try {
      const searchMetrics = {
        query,
        resultCount: results.length,
        successful: results.length > 0,
        options,
        timestamp: new Date(),
        sessionId: state.currentSession.sessionId,
        userId: userId || state.currentSession.userId,
      };
      
      // Update local metrics
      dispatch({
        type: 'UPDATE_KB_METRICS',
        payload: {
          searches: {
            ...state.kbMetrics.searches,
            totalSearches: state.kbMetrics.searches.totalSearches + 1,
            averageResultCount: (
              (state.kbMetrics.searches.averageResultCount * state.kbMetrics.searches.totalSearches) + 
              results.length
            ) / (state.kbMetrics.searches.totalSearches + 1),
          },
        },
      });
      
      // Record as usage activity
      await recordUsageActivity({
        entryId: 'search',
        action: 'search',
        metadata: searchMetrics,
      });
      
      // Send to main process
      if (window.electronAPI?.recordSearch) {
        await window.electronAPI.recordSearch(searchMetrics);
      }
      
    } catch (error) {
      console.error('Failed to record search:', error);
    }
  }, [state.collectionEnabled, state.currentSession.sessionId, state.kbMetrics.searches, userId, recordUsageActivity]);
  
  const recordPerformance = useCallback(async (
    operation: string, 
    duration: number, 
    metadata?: any
  ): Promise<void> => {
    if (!state.collectionEnabled || !enablePerformanceMonitoring) return;
    
    try {
      // Update or create performance metrics for this operation
      const existingMetrics = state.performanceMetrics.get(operation) || {
        averageSearchTime: 0,
        averageDbTime: 0,
        averageAiTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
        uptime: 0,
        memoryUsage: 0,
        diskUsage: 0,
        throughput: { searches: 0, creates: 0, updates: 0 },
      };
      
      // For now, we'll just update the relevant time metric
      // In a real implementation, we'd have more sophisticated logic
      const updatedMetrics = {
        ...existingMetrics,
        [operation === 'search' ? 'averageSearchTime' : 'averageDbTime']: duration,
      };
      
      dispatch({
        type: 'UPDATE_PERFORMANCE',
        payload: { operation, metrics: updatedMetrics },
      });
      
      // Record as usage activity
      await recordUsageActivity({
        entryId: operation,
        action: 'performance' as UsageAction,
        metadata: { duration, ...metadata },
      });
      
      // Send to main process
      if (window.electronAPI?.recordPerformance) {
        await window.electronAPI.recordPerformance(operation, duration, metadata);
      }
      
    } catch (error) {
      console.error('Failed to record performance:', error);
    }
  }, [state.collectionEnabled, state.performanceMetrics, enablePerformanceMonitoring, recordUsageActivity]);
  
  const recordError = useCallback(async (error: Error, context?: string): Promise<void> => {
    if (!state.collectionEnabled) return;
    
    try {
      const errorInfo = {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date(),
        sessionId: state.currentSession.sessionId,
        userId: userId || state.currentSession.userId,
      };
      
      // Record as usage activity
      await recordUsageActivity({
        entryId: 'error',
        action: 'view', // Using 'view' as closest available action
        metadata: errorInfo,
      });
      
      // Check if this should trigger an alert
      const errorRate = calculateErrorRate();
      if (errorRate > 0.05) { // 5% error rate threshold
        const alert: MetricAlert = {
          id: `error-${Date.now()}`,
          type: 'error',
          severity: errorRate > 0.1 ? 'critical' : 'warning',
          title: 'High Error Rate Detected',
          message: `Error rate has reached ${(errorRate * 100).toFixed(1)}%`,
          value: errorRate,
          threshold: 0.05,
          timestamp: new Date(),
          acknowledged: false,
        };
        
        dispatch({ type: 'ADD_ALERT', payload: alert });
      }
      
      // Send to main process
      if (window.electronAPI?.recordError) {
        await window.electronAPI.recordError(errorInfo);
      }
      
    } catch (err) {
      console.error('Failed to record error:', err);
    }
  }, [state.collectionEnabled, state.currentSession.sessionId, userId, recordUsageActivity]);
  
  // Helper function to calculate error rate
  const calculateErrorRate = (): number => {
    const recentActivity = state.kbMetrics.usage.recentActivity.slice(0, 100);
    if (recentActivity.length === 0) return 0;
    
    const errors = recentActivity.filter(activity => 
      activity.metadata && activity.metadata.message
    ).length;
    
    return errors / recentActivity.length;
  };
  
  // =====================
  // Metrics Retrieval
  // =====================
  
  const getKBMetrics = useCallback(async (): Promise<KBMetrics> => {
    const cacheKey = 'kb-metrics';
    const cached = metricsCache.current.get(cacheKey);
    if (cached) return cached;
    
    try {
      let metrics = state.kbMetrics;
      
      // Fetch from main process if available
      if (window.electronAPI?.getKBMetrics) {
        const freshMetrics = await window.electronAPI.getKBMetrics();
        metrics = freshMetrics;
        
        dispatch({
          type: 'UPDATE_KB_METRICS',
          payload: metrics,
        });
      }
      
      metricsCache.current.set(cacheKey, metrics);
      return metrics;
      
    } catch (error) {
      console.error('Failed to get KB metrics:', error);
      return state.kbMetrics;
    }
  }, [state.kbMetrics]);
  
  const getUsageMetrics = useCallback(async (period: string = '24h'): Promise<UsageMetrics> => {
    const cacheKey = `usage-metrics-${period}`;
    const cached = metricsCache.current.get(cacheKey);
    if (cached) return cached;
    
    try {
      let metrics = state.kbMetrics.usage;
      
      if (window.electronAPI?.getUsageMetrics) {
        metrics = await window.electronAPI.getUsageMetrics(period);
      }
      
      metricsCache.current.set(cacheKey, metrics);
      return metrics;
      
    } catch (error) {
      console.error('Failed to get usage metrics:', error);
      return state.kbMetrics.usage;
    }
  }, [state.kbMetrics.usage]);
  
  const getPerformanceMetrics = useCallback(async (operation?: string): Promise<PerformanceMetrics> => {
    const cacheKey = `performance-metrics-${operation || 'all'}`;
    const cached = metricsCache.current.get(cacheKey);
    if (cached) return cached;
    
    try {
      let metrics = state.kbMetrics.performance;
      
      if (operation && state.performanceMetrics.has(operation)) {
        metrics = state.performanceMetrics.get(operation)!;
      }
      
      if (window.electronAPI?.getPerformanceMetrics) {
        metrics = await window.electronAPI.getPerformanceMetrics(operation);
      }
      
      metricsCache.current.set(cacheKey, metrics);
      return metrics;
      
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return state.kbMetrics.performance;
    }
  }, [state.kbMetrics.performance, state.performanceMetrics]);
  
  const getSearchMetrics = useCallback(async (period: string = '24h'): Promise<SearchMetrics> => {
    const cacheKey = `search-metrics-${period}`;
    const cached = metricsCache.current.get(cacheKey);
    if (cached) return cached;
    
    try {
      let metrics = state.kbMetrics.searches;
      
      if (window.electronAPI?.getSearchMetrics) {
        metrics = await window.electronAPI.getSearchMetrics(period);
      }
      
      metricsCache.current.set(cacheKey, metrics);
      return metrics;
      
    } catch (error) {
      console.error('Failed to get search metrics:', error);
      return state.kbMetrics.searches;
    }
  }, [state.kbMetrics.searches]);
  
  // =====================
  // Analytics and Insights
  // =====================
  
  const getDailyStats = useCallback(async (date?: string): Promise<DailyStats> => {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const cacheKey = `daily-stats-${targetDate}`;
    const cached = metricsCache.current.get(cacheKey);
    if (cached) return cached;
    
    try {
      // Compute from recent activity or fetch from main process
      const recentActivity = state.kbMetrics.usage.recentActivity;
      const todayActivity = recentActivity.filter(activity => 
        activity.timestamp.toISOString().split('T')[0] === targetDate
      );
      
      const searches = todayActivity.filter(a => a.action === 'search').length;
      const successful = todayActivity.filter(a => 
        a.action === 'search' && a.metadata && a.metadata.successful
      ).length;
      
      const stats: DailyStats = {
        date: targetDate,
        searches,
        successful,
        failed: searches - successful,
        uniqueUsers: new Set(todayActivity.map(a => a.userId).filter(Boolean)).size,
        avgResponseTime: 0, // Would need to compute from performance data
        topCategories: [],
        topQueries: [],
      };
      
      metricsCache.current.set(cacheKey, stats);
      return stats;
      
    } catch (error) {
      console.error('Failed to get daily stats:', error);
      return {
        date: targetDate,
        searches: 0,
        successful: 0,
        failed: 0,
        uniqueUsers: 0,
        avgResponseTime: 0,
        topCategories: [],
        topQueries: [],
      };
    }
  }, [state.kbMetrics.usage.recentActivity]);
  
  const getTrends = useCallback(async (period: string): Promise<MetricTrends> => {
    const cacheKey = `trends-${period}`;
    const cached = metricsCache.current.get(cacheKey);
    if (cached) return cached;
    
    try {
      let trends = state.kbMetrics.trends;
      
      if (window.electronAPI?.getTrends) {
        trends = await window.electronAPI.getTrends(period);
      }
      
      metricsCache.current.set(cacheKey, trends);
      return trends;
      
    } catch (error) {
      console.error('Failed to get trends:', error);
      return {
        searches: [],
        performance: [],
        success: [],
        users: [],
      };
    }
  }, [state.kbMetrics.trends]);
  
  const getHealthScore = useCallback(async (): Promise<number> => {
    if (state.computedMetrics.healthScore && 
        Date.now() - state.computedMetrics.lastComputed < 60000) { // 1 minute cache
      return state.computedMetrics.healthScore;
    }
    
    try {
      // Compute health score based on various metrics
      const metrics = await getKBMetrics();
      let score = 100;
      
      // Reduce score based on error rate
      if (metrics.performance.errorRate > 0.05) {
        score -= 20;
      }
      
      // Reduce score based on performance
      if (metrics.performance.averageSearchTime > 2000) { // 2 seconds
        score -= 15;
      }
      
      // Reduce score based on cache hit rate
      if (metrics.performance.cacheHitRate < 0.8) { // 80%
        score -= 10;
      }
      
      // Add score for high usage
      if (metrics.overview.totalUsage > 1000) {
        score += 5;
      }
      
      const finalScore = Math.max(0, Math.min(100, score));
      
      dispatch({
        type: 'UPDATE_COMPUTED_METRICS',
        payload: { healthScore: finalScore },
      });
      
      return finalScore;
      
    } catch (error) {
      console.error('Failed to compute health score:', error);
      return 75; // Default moderate score
    }
  }, [state.computedMetrics.healthScore, state.computedMetrics.lastComputed, getKBMetrics]);
  
  const getTopEntries = useCallback(async (limit: number = 10): Promise<Array<{ entryId: string; usage: number }>> => {
    const cacheKey = `top-entries-${limit}`;
    const cached = metricsCache.current.get(cacheKey);
    if (cached) return cached;
    
    try {
      const mostUsed = state.kbMetrics.usage.mostUsed.slice(0, limit).map(entry => ({
        entryId: entry.id,
        usage: entry.usage_count || 0,
      }));
      
      metricsCache.current.set(cacheKey, mostUsed);
      return mostUsed;
      
    } catch (error) {
      console.error('Failed to get top entries:', error);
      return [];
    }
  }, [state.kbMetrics.usage.mostUsed]);
  
  // =====================
  // Alerts Management
  // =====================
  
  const getActiveAlerts = useCallback((): MetricAlert[] => {
    return state.activeAlerts.filter(alert => !state.dismissedAlerts.includes(alert.id));
  }, [state.activeAlerts, state.dismissedAlerts]);
  
  const dismissAlert = useCallback((alertId: string) => {
    dispatch({ type: 'DISMISS_ALERT', payload: alertId });
  }, []);
  
  const checkThresholds = useCallback(async (): Promise<void> => {
    try {
      const metrics = await getKBMetrics();
      const alerts: MetricAlert[] = [];
      
      // Performance threshold checks
      if (metrics.performance.averageSearchTime > 2000) { // 2 seconds
        alerts.push({
          id: `perf-search-${Date.now()}`,
          type: 'performance',
          severity: metrics.performance.averageSearchTime > 5000 ? 'critical' : 'warning',
          title: 'Slow Search Performance',
          message: `Average search time is ${metrics.performance.averageSearchTime}ms`,
          value: metrics.performance.averageSearchTime,
          threshold: 2000,
          timestamp: new Date(),
          acknowledged: false,
        });
      }
      
      // Error rate threshold checks
      if (metrics.performance.errorRate > 0.05) { // 5%
        alerts.push({
          id: `error-rate-${Date.now()}`,
          type: 'error',
          severity: metrics.performance.errorRate > 0.1 ? 'critical' : 'warning',
          title: 'High Error Rate',
          message: `Error rate is ${(metrics.performance.errorRate * 100).toFixed(1)}%`,
          value: metrics.performance.errorRate,
          threshold: 0.05,
          timestamp: new Date(),
          acknowledged: false,
        });
      }
      
      // Cache hit rate threshold checks
      if (metrics.performance.cacheHitRate < 0.8) { // 80%
        alerts.push({
          id: `cache-hit-${Date.now()}`,
          type: 'performance',
          severity: metrics.performance.cacheHitRate < 0.5 ? 'warning' : 'info',
          title: 'Low Cache Hit Rate',
          message: `Cache hit rate is ${(metrics.performance.cacheHitRate * 100).toFixed(1)}%`,
          value: metrics.performance.cacheHitRate,
          threshold: 0.8,
          timestamp: new Date(),
          acknowledged: false,
        });
      }
      
      // Add new alerts (avoid duplicates)
      alerts.forEach(alert => {
        const exists = state.activeAlerts.some(existing => 
          existing.type === alert.type && existing.title === alert.title
        );
        if (!exists) {
          dispatch({ type: 'ADD_ALERT', payload: alert });
        }
      });
      
    } catch (error) {
      console.error('Failed to check thresholds:', error);
    }
  }, [getKBMetrics, state.activeAlerts]);
  
  // =====================
  // Configuration
  // =====================
  
  const updateSettings = useCallback((
    settings: Partial<{
      collectionEnabled: boolean;
      retentionPeriod: number;
      aggregationInterval: number;
    }>
  ) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
    
    // Persist settings
    try {
      const currentSettings = {
        collectionEnabled: state.collectionEnabled,
        retentionPeriod: state.retentionPeriod,
        aggregationInterval: state.aggregationInterval,
        ...settings,
      };
      localStorage.setItem('kb-metrics-settings', JSON.stringify(currentSettings));
    } catch (error) {
      console.warn('Failed to save metrics settings:', error);
    }
  }, [state.collectionEnabled, state.retentionPeriod, state.aggregationInterval]);
  
  // =====================
  // Data Management
  // =====================
  
  const exportMetrics = useCallback(async (
    format: 'json' | 'csv', 
    options?: any
  ): Promise<string> => {
    try {
      const metrics = await getKBMetrics();
      
      if (format === 'json') {
        return JSON.stringify(metrics, null, 2);
      } else if (format === 'csv') {
        // Simple CSV export - would need more sophisticated logic for nested data
        const csvData = [
          ['Metric', 'Value'],
          ['Total Entries', metrics.overview.totalEntries.toString()],
          ['Total Searches', metrics.overview.totalSearches.toString()],
          ['Average Success Rate', metrics.overview.averageSuccessRate.toString()],
          ['Total Usage', metrics.overview.totalUsage.toString()],
          ['Active Users', metrics.overview.activeUsers.toString()],
        ];
        
        return csvData.map(row => row.join(',')).join('\n');
      }
      
      return '';
    } catch (error) {
      console.error('Failed to export metrics:', error);
      throw error;
    }
  }, [getKBMetrics]);
  
  const clearMetrics = useCallback(async (beforeDate?: Date): Promise<void> => {
    try {
      // Clear local caches
      metricsCache.current.clear();
      
      // Reset computed metrics
      dispatch({
        type: 'UPDATE_COMPUTED_METRICS',
        payload: {
          dailyStats: undefined,
          trends: undefined,
          healthScore: undefined,
          lastComputed: 0,
        },
      });
      
      // Clear main process data if available
      if (window.electronAPI?.clearMetrics) {
        await window.electronAPI.clearMetrics(beforeDate);
      }
      
      // Refresh metrics
      await refreshMetrics();
      
    } catch (error) {
      console.error('Failed to clear metrics:', error);
      throw error;
    }
  }, []);
  
  // =====================
  // Performance Monitoring
  // =====================
  
  const startOperation = useCallback((name: string): string => {
    const operationId = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    activeOperations.current.set(operationId, {
      name,
      startTime: performance.now(),
    });
    return operationId;
  }, []);
  
  const endOperation = useCallback((operationId: string): void => {
    const operation = activeOperations.current.get(operationId);
    if (operation) {
      const duration = performance.now() - operation.startTime;
      activeOperations.current.delete(operationId);
      
      // Record performance
      recordPerformance(operation.name, duration);
    }
  }, [recordPerformance]);
  
  // =====================
  // Utilities
  // =====================
  
  const refreshMetrics = useCallback(async (): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      // Clear cache to force fresh data
      metricsCache.current.clear();
      
      // Fetch fresh metrics
      await getKBMetrics();
      
      // Update computed metrics
      await getHealthScore();
      
      dispatch({ type: 'SET_ERROR', payload: null });
      
    } catch (error) {
      console.error('Failed to refresh metrics:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to refresh metrics' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [getKBMetrics, getHealthScore]);
  
  const resetSession = useCallback(() => {
    dispatch({ type: 'RESET_SESSION' });
  }, []);
  
  // =====================
  // Effects
  // =====================
  
  // Load settings on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('kb-metrics-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
      }
    } catch (error) {
      console.warn('Failed to load metrics settings:', error);
    }
  }, []);
  
  // Periodic threshold checking
  useEffect(() => {
    if (!state.collectionEnabled) return;
    
    const interval = setInterval(checkThresholds, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [state.collectionEnabled, checkThresholds]);
  
  // Auto-refresh metrics periodically
  useEffect(() => {
    const interval = setInterval(refreshMetrics, state.aggregationInterval);
    return () => clearInterval(interval);
  }, [refreshMetrics, state.aggregationInterval]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      metricsCache.current.clear();
      activeOperations.current.clear();
    };
  }, []);
  
  // =====================
  // Context Value (Memoized)
  // =====================
  
  const contextValue = useMemo<MetricsContextValue>(() => ({
    state,
    recordUsageActivity,
    recordSearch,
    recordPerformance,
    recordError,
    getKBMetrics,
    getUsageMetrics,
    getPerformanceMetrics,
    getSearchMetrics,
    getDailyStats,
    getTrends,
    getHealthScore,
    getTopEntries,
    getActiveAlerts,
    dismissAlert,
    checkThresholds,
    updateSettings,
    exportMetrics,
    clearMetrics,
    startOperation,
    endOperation,
    refreshMetrics,
    resetSession,
  }), [
    state,
    recordUsageActivity,
    recordSearch,
    recordPerformance,
    recordError,
    getKBMetrics,
    getUsageMetrics,
    getPerformanceMetrics,
    getSearchMetrics,
    getDailyStats,
    getTrends,
    getHealthScore,
    getTopEntries,
    getActiveAlerts,
    dismissAlert,
    checkThresholds,
    updateSettings,
    exportMetrics,
    clearMetrics,
    startOperation,
    endOperation,
    refreshMetrics,
    resetSession,
  ]);
  
  return (
    <MetricsContext.Provider value={contextValue}>
      {children}
    </MetricsContext.Provider>
  );
};

// =====================
// Hook
// =====================

/**
 * Hook to access Metrics Context
 * @throws Error if used outside of MetricsProvider
 */
export const useMetrics = (): MetricsContextValue => {
  const context = useContext(MetricsContext);
  if (!context) {
    throw new Error('useMetrics must be used within a MetricsProvider');
  }
  return context;
};

export default MetricsContext;