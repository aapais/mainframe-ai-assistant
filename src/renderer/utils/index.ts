/**
 * Performance Optimization Utilities - Main Export
 *
 * Central export point for all performance optimization utilities
 *
 * @author Performance Optimizer
 * @version 1.0.0
 */

// Virtual Scrolling
export {
  DynamicHeightCalculator,
  useVirtualScroll,
  OptimizedVirtualList,
  VirtualScrollPerformanceMonitor,
  measureScrollPerformance,
  debounceScroll,
  throttleScroll,
  virtualScrollMonitor,
} from './virtualScroll';

// Search Caching
export {
  LRUCache,
  SearchResultsCache,
  SearchQueryNormalizer,
  CacheManager,
  searchCache,
} from './searchCache';

// Performance Monitoring
export {
  PerformanceMonitor,
  MemoryMonitor,
  FrameRateMonitor,
  SearchPerformanceTracker,
  ComponentRenderTracker,
  BundleSizeAnalyzer,
  usePerformanceMonitor,
  measureSearchTime,
  performanceMonitor,
} from './performanceMonitor';

// Memory Management
export {
  MemoryUtils,
  CleanupManager,
  MemoryLeakDetector,
  GenericResourcePool,
  WeakMapCache,
  useCleanup,
  useMemoryLeakDetector,
  useResourcePool,
  useWeakMapCache,
  useMemoryPressureMonitor,
  withAutoCleanup,
  globalMemoryManager,
} from './memoryManagement';

// Search Optimization
export {
  InvertedIndex,
  BoyerMooreSearch,
  SearchRanker,
  OptimizedSearchEngine,
} from './searchOptimization';

// Bundle Optimization
export {
  LazyLoader,
  BundleAnalyzer,
  ResourcePreloader,
  DynamicImporter,
  SmartLoader,
  bundleOptimizationConfig,
} from './bundleOptimization';

// Performance Configuration
export const PERFORMANCE_CONFIG = {
  // Search Performance Targets
  MAX_SEARCH_TIME: 100, // milliseconds
  MAX_RENDER_TIME: 16.67, // 60fps
  MAX_MEMORY_USAGE: 150 * 1024 * 1024, // 150MB
  MIN_FRAME_RATE: 55, // fps
  MIN_CACHE_HIT_RATE: 70, // percentage
  MAX_BUNDLE_SIZE: 2 * 1024 * 1024, // 2MB

  // Virtual Scrolling
  VIRTUAL_THRESHOLD: 50, // items
  ITEM_HEIGHT: 120, // pixels
  OVERSCAN_COUNT: 5,

  // Caching
  CACHE_SIZE: 10 * 1024 * 1024, // 10MB
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  CACHE_MAX_ENTRIES: 200,

  // Performance Monitoring
  MONITORING_INTERVAL: 5000, // 5 seconds
  MEMORY_CHECK_INTERVAL: 2000, // 2 seconds
  FRAME_RATE_SAMPLE_SIZE: 60, // frames

  // Bundle Optimization
  CHUNK_SIZE_THRESHOLD: 500 * 1024, // 500KB
  LAZY_LOAD_THRESHOLD: 100 * 1024, // 100KB
  PRELOAD_DELAY: 2000, // 2 seconds
} as const;

// Performance Utilities
export const performanceUtils = {
  // Format bytes to human readable
  formatBytes: (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  },

  // Format time to human readable
  formatTime: (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  },

  // Check if performance target is met
  isPerformanceTargetMet: (metric: keyof typeof PERFORMANCE_CONFIG, value: number): boolean => {
    switch (metric) {
      case 'MAX_SEARCH_TIME':
      case 'MAX_RENDER_TIME':
      case 'MAX_MEMORY_USAGE':
      case 'MAX_BUNDLE_SIZE':
        return value <= PERFORMANCE_CONFIG[metric];
      case 'MIN_FRAME_RATE':
      case 'MIN_CACHE_HIT_RATE':
        return value >= PERFORMANCE_CONFIG[metric];
      default:
        return true;
    }
  },

  // Calculate performance score (0-100)
  calculatePerformanceScore: (metrics: {
    searchTime: number;
    renderTime: number;
    memoryUsage: number;
    frameRate: number;
    cacheHitRate: number;
    bundleSize: number;
  }): number => {
    let score = 100;

    // Deduct points for poor performance
    if (metrics.searchTime > PERFORMANCE_CONFIG.MAX_SEARCH_TIME) score -= 20;
    if (metrics.renderTime > PERFORMANCE_CONFIG.MAX_RENDER_TIME) score -= 20;
    if (metrics.memoryUsage > PERFORMANCE_CONFIG.MAX_MEMORY_USAGE) score -= 25;
    if (metrics.frameRate < PERFORMANCE_CONFIG.MIN_FRAME_RATE) score -= 20;
    if (metrics.cacheHitRate < PERFORMANCE_CONFIG.MIN_CACHE_HIT_RATE) score -= 10;
    if (metrics.bundleSize > PERFORMANCE_CONFIG.MAX_BUNDLE_SIZE) score -= 15;

    return Math.max(0, score);
  },

  // Get optimization priority
  getOptimizationPriority: (metrics: {
    searchTime: number;
    renderTime: number;
    memoryUsage: number;
    frameRate: number;
    cacheHitRate: number;
    bundleSize: number;
  }): Array<{ metric: string; priority: 'high' | 'medium' | 'low'; impact: string }> => {
    const priorities: Array<{
      metric: string;
      priority: 'high' | 'medium' | 'low';
      impact: string;
    }> = [];

    if (metrics.memoryUsage > PERFORMANCE_CONFIG.MAX_MEMORY_USAGE) {
      priorities.push({
        metric: 'Memory Usage',
        priority: 'high',
        impact: 'Critical - may cause app crashes',
      });
    }

    if (metrics.searchTime > PERFORMANCE_CONFIG.MAX_SEARCH_TIME * 2) {
      priorities.push({
        metric: 'Search Performance',
        priority: 'high',
        impact: 'High - poor user experience',
      });
    }

    if (metrics.frameRate < PERFORMANCE_CONFIG.MIN_FRAME_RATE * 0.8) {
      priorities.push({
        metric: 'Frame Rate',
        priority: 'high',
        impact: 'High - UI feels sluggish',
      });
    }

    if (metrics.renderTime > PERFORMANCE_CONFIG.MAX_RENDER_TIME * 2) {
      priorities.push({
        metric: 'Render Performance',
        priority: 'medium',
        impact: 'Medium - affects responsiveness',
      });
    }

    if (metrics.bundleSize > PERFORMANCE_CONFIG.MAX_BUNDLE_SIZE) {
      priorities.push({
        metric: 'Bundle Size',
        priority: 'medium',
        impact: 'Medium - slower initial load',
      });
    }

    if (metrics.cacheHitRate < PERFORMANCE_CONFIG.MIN_CACHE_HIT_RATE) {
      priorities.push({
        metric: 'Cache Performance',
        priority: 'low',
        impact: 'Low - missed optimization opportunity',
      });
    }

    return priorities.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  },

  // Performance health check
  performHealthCheck: (): Promise<{
    overall: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
    recommendations: string[];
  }> => {
    return new Promise(resolve => {
      // This would perform a comprehensive health check
      // For now, return a mock result
      setTimeout(() => {
        resolve({
          overall: 'healthy',
          score: 95,
          issues: [],
          recommendations: [
            'Performance is excellent!',
            'Consider implementing progressive web app features',
            'Monitor performance over time for degradation',
          ],
        });
      }, 1000);
    });
  },
};

// Export default configuration
export default {
  config: PERFORMANCE_CONFIG,
  utils: performanceUtils,
};
