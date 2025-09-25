/**
 * Performance Configuration
 *
 * Central configuration for all performance-related settings
 * including SLA thresholds, optimization parameters, and monitoring intervals.
 */

export interface PerformanceConfig {
  sla: {
    autocomplete: number;
    search: number;
    availability: number;
    memoryUsage: number;
    errorRate: number;
  };
  monitoring: {
    interval: number;
    retentionDays: number;
    metricsBufferSize: number;
    alertCooldown: number;
  };
  optimization: {
    autoOptimizationEnabled: boolean;
    optimizationCooldown: number;
    aggressivenessLevel: 'conservative' | 'moderate' | 'aggressive';
    maxConcurrentOptimizations: number;
  };
  caching: {
    searchResultsTTL: number;
    instantCacheTTL: number;
    maxCacheSize: number;
    preloadPopularQueries: boolean;
  };
  testing: {
    loadTestDuration: number;
    maxConcurrency: number;
    regressionThreshold: number;
    automatedTestsEnabled: boolean;
  };
  bundling: {
    maxBundleSize: number;
    codeSplittingEnabled: boolean;
    treeshakingEnabled: boolean;
    compressionEnabled: boolean;
  };
  webassembly: {
    enabled: boolean;
    modules: string[];
    fallbackToJS: boolean;
  };
}

/**
 * Default performance configuration
 */
export const defaultPerformanceConfig: PerformanceConfig = {
  sla: {
    autocomplete: 100, // 100ms for autocomplete
    search: 1000, // 1 second for search
    availability: 99.9, // 99.9% availability
    memoryUsage: 500, // 500MB memory limit
    errorRate: 0.05, // 5% error rate
  },

  monitoring: {
    interval: 15000, // 15 seconds monitoring interval
    retentionDays: 7, // 7 days data retention
    metricsBufferSize: 1000, // Buffer 1000 metrics points
    alertCooldown: 300000, // 5 minutes between similar alerts
  },

  optimization: {
    autoOptimizationEnabled: true,
    optimizationCooldown: 600000, // 10 minutes between optimizations
    aggressivenessLevel: 'moderate', // Balanced approach
    maxConcurrentOptimizations: 2,
  },

  caching: {
    searchResultsTTL: 300000, // 5 minutes for search results
    instantCacheTTL: 60000, // 1 minute for instant cache
    maxCacheSize: 100, // 100 entries in instant cache
    preloadPopularQueries: true,
  },

  testing: {
    loadTestDuration: 60, // 60 seconds load test
    maxConcurrency: 50, // Up to 50 concurrent users
    regressionThreshold: 0.1, // 10% performance degradation threshold
    automatedTestsEnabled: false, // Disabled by default in production
  },

  bundling: {
    maxBundleSize: 5 * 1024 * 1024, // 5MB bundle size limit
    codeSplittingEnabled: true,
    treeshakingEnabled: true,
    compressionEnabled: true,
  },

  webassembly: {
    enabled: false, // Disabled by default
    modules: ['search-algorithms', 'text-processing', 'compression'],
    fallbackToJS: true,
  },
};

/**
 * Environment-specific configurations
 */
export const performanceConfigs = {
  development: {
    ...defaultPerformanceConfig,
    monitoring: {
      ...defaultPerformanceConfig.monitoring,
      interval: 30000, // Longer interval in dev
      retentionDays: 1, // Shorter retention in dev
    },
    optimization: {
      ...defaultPerformanceConfig.optimization,
      autoOptimizationEnabled: false, // Disabled in development
    },
    testing: {
      ...defaultPerformanceConfig.testing,
      automatedTestsEnabled: true, // Enabled in development
      loadTestDuration: 30, // Shorter tests in dev
      maxConcurrency: 10,
    },
  },

  test: {
    ...defaultPerformanceConfig,
    sla: {
      ...defaultPerformanceConfig.sla,
      autocomplete: 200, // More lenient in test
      search: 2000,
    },
    monitoring: {
      ...defaultPerformanceConfig.monitoring,
      interval: 5000, // Faster monitoring in tests
      retentionDays: 1,
    },
    optimization: {
      ...defaultPerformanceConfig.optimization,
      autoOptimizationEnabled: false,
    },
  },

  production: {
    ...defaultPerformanceConfig,
    optimization: {
      ...defaultPerformanceConfig.optimization,
      aggressivenessLevel: 'conservative' as const, // More conservative in prod
    },
    webassembly: {
      ...defaultPerformanceConfig.webassembly,
      enabled: true, // Enable WASM in production
    },
  },
};

/**
 * Performance optimization strategies configuration
 */
export const optimizationStrategies = {
  'optimize-indexes': {
    category: 'database',
    priority: 'high',
    estimatedImprovement: 0.6,
    risk: 0.1,
    effort: 0.3,
    prerequisites: ['database-access'],
    timeouts: {
      execution: 30000, // 30 seconds
      rollback: 10000, // 10 seconds
    },
  },

  'cache-tuning': {
    category: 'cache',
    priority: 'medium',
    estimatedImprovement: 0.3,
    risk: 0.1,
    effort: 0.2,
    prerequisites: [],
    timeouts: {
      execution: 5000,
      rollback: 2000,
    },
  },

  'code-splitting': {
    category: 'bundle',
    priority: 'medium',
    estimatedImprovement: 0.35,
    risk: 0.2,
    effort: 0.6,
    prerequisites: ['webpack-config'],
    timeouts: {
      execution: 120000, // 2 minutes for bundle rebuild
      rollback: 30000,
    },
  },

  'memory-pooling': {
    category: 'memory',
    priority: 'low',
    estimatedImprovement: 0.2,
    risk: 0.25,
    effort: 0.5,
    prerequisites: ['memory-profiling'],
    timeouts: {
      execution: 15000,
      rollback: 5000,
    },
  },
};

/**
 * Performance testing configurations
 */
export const testConfigurations = {
  smoke: {
    duration: 30, // 30 seconds
    concurrency: 5,
    queries: 10,
    rampUpTime: 5,
  },

  load: {
    duration: 300, // 5 minutes
    concurrency: 20,
    queries: 100,
    rampUpTime: 30,
  },

  stress: {
    maxConcurrency: 100,
    stepSize: 10,
    stepDuration: 60,
    queries: 50,
  },

  spike: {
    duration: 600, // 10 minutes
    baseConcurrency: 10,
    spikeConcurrency: 50,
    spikeInterval: 120, // 2 minutes
  },

  endurance: {
    duration: 3600, // 1 hour
    concurrency: 15,
    queries: 200,
    rampUpTime: 300, // 5 minutes
  },
};

/**
 * Monitoring thresholds for different environments
 */
export const monitoringThresholds = {
  development: {
    responseTime: {
      warning: 2000, // 2 seconds
      critical: 5000, // 5 seconds
    },
    memoryUsage: {
      warning: 800, // 800MB
      critical: 1200, // 1.2GB
    },
    errorRate: {
      warning: 0.1, // 10%
      critical: 0.2, // 20%
    },
  },

  production: {
    responseTime: {
      warning: 800, // 800ms
      critical: 1500, // 1.5 seconds
    },
    memoryUsage: {
      warning: 400, // 400MB
      critical: 600, // 600MB
    },
    errorRate: {
      warning: 0.02, // 2%
      critical: 0.05, // 5%
    },
  },
};

/**
 * Cache configuration for different data types
 */
export const cacheConfigurations = {
  searchResults: {
    ttl: 300000, // 5 minutes
    maxSize: 500,
    strategy: 'lru',
    compression: true,
  },

  suggestions: {
    ttl: 600000, // 10 minutes
    maxSize: 200,
    strategy: 'lru',
    compression: false,
  },

  staticAssets: {
    ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxSize: 1000,
    strategy: 'fifo',
    compression: true,
  },

  apiResponses: {
    ttl: 120000, // 2 minutes
    maxSize: 100,
    strategy: 'lru',
    compression: true,
  },
};

/**
 * WebAssembly module configurations
 */
export const wasmModules = {
  'search-algorithms': {
    file: 'search-algorithms.wasm',
    exports: ['fuzzySearch', 'semanticMatch'],
    memory: {
      initial: 1, // 64KB pages
      maximum: 10,
    },
    features: ['bulk-memory', 'simd'],
  },

  'text-processing': {
    file: 'text-processing.wasm',
    exports: ['tokenize', 'normalize', 'highlight'],
    memory: {
      initial: 2,
      maximum: 8,
    },
    features: ['bulk-memory'],
  },

  compression: {
    file: 'compression.wasm',
    exports: ['compress', 'decompress'],
    memory: {
      initial: 1,
      maximum: 4,
    },
    features: ['bulk-memory'],
  },
};

/**
 * Get configuration for current environment
 */
export function getPerformanceConfig(env: string = 'production'): PerformanceConfig {
  return (
    performanceConfigs[env as keyof typeof performanceConfigs] || performanceConfigs.production
  );
}

/**
 * Get monitoring thresholds for current environment
 */
export function getMonitoringThresholds(env: string = 'production') {
  return (
    monitoringThresholds[env as keyof typeof monitoringThresholds] ||
    monitoringThresholds.production
  );
}

/**
 * Validate performance configuration
 */
export function validatePerformanceConfig(config: PerformanceConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate SLA thresholds
  if (config.sla.autocomplete > 200) {
    warnings.push('Autocomplete SLA threshold above recommended 200ms');
  }

  if (config.sla.search > 2000) {
    warnings.push('Search SLA threshold above recommended 2000ms');
  }

  if (config.sla.availability < 99.0) {
    errors.push('Availability SLA below minimum 99%');
  }

  if (config.sla.memoryUsage > 1000) {
    warnings.push('Memory usage threshold above recommended 1GB');
  }

  // Validate monitoring configuration
  if (config.monitoring.interval < 5000) {
    warnings.push('Monitoring interval below recommended 5 seconds');
  }

  if (config.monitoring.retentionDays < 1) {
    errors.push('Data retention must be at least 1 day');
  }

  // Validate optimization configuration
  if (config.optimization.optimizationCooldown < 60000) {
    warnings.push('Optimization cooldown below recommended 1 minute');
  }

  // Validate caching configuration
  if (config.caching.searchResultsTTL > 3600000) {
    warnings.push('Search results TTL above recommended 1 hour');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create performance configuration from environment variables
 */
export function createConfigFromEnv(): PerformanceConfig {
  const env = process.env.NODE_ENV || 'production';
  const baseConfig = getPerformanceConfig(env);

  return {
    ...baseConfig,
    sla: {
      autocomplete: parseInt(process.env.PERF_SLA_AUTOCOMPLETE!) || baseConfig.sla.autocomplete,
      search: parseInt(process.env.PERF_SLA_SEARCH!) || baseConfig.sla.search,
      availability: parseFloat(process.env.PERF_SLA_AVAILABILITY!) || baseConfig.sla.availability,
      memoryUsage: parseInt(process.env.PERF_SLA_MEMORY!) || baseConfig.sla.memoryUsage,
      errorRate: parseFloat(process.env.PERF_SLA_ERROR_RATE!) || baseConfig.sla.errorRate,
    },
    optimization: {
      ...baseConfig.optimization,
      autoOptimizationEnabled: process.env.PERF_AUTO_OPTIMIZATION !== 'false',
    },
    webassembly: {
      ...baseConfig.webassembly,
      enabled: process.env.PERF_WASM_ENABLED === 'true',
    },
  };
}
