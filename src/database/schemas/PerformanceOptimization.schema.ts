/**
 * Performance Optimization Schema Definitions
 * Advanced search performance and database optimization schemas
 */

import { z } from 'zod';

// ===========================
// SEARCH OPTIMIZATION SCHEMAS
// ===========================

/**
 * Search strategy enumeration for optimal query routing
 */
export const SearchStrategySchema = z.enum([
  'exact', // Exact text matching
  'fts', // Full-text search with BM25
  'fuzzy', // Fuzzy/approximate matching
  'semantic', // AI semantic search
  'category', // Category-based filtering
  'tag', // Tag-based filtering
  'hybrid', // Multi-strategy combination
  'cached', // Cached result retrieval
]);

export type SearchStrategy = z.infer<typeof SearchStrategySchema>;

/**
 * Advanced search options for performance tuning
 */
export const SearchOptionsSchema = z.object({
  query: z.string().min(1),
  strategy: SearchStrategySchema.optional(),
  limit: z.number().int().min(1).max(1000).default(10),
  offset: z.number().int().min(0).default(0),
  sortBy: z
    .enum(['relevance', 'usage', 'success_rate', 'created_at', 'updated_at'])
    .default('relevance'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  category: z.string().optional(),
  tags: z.array(z.string()).max(10).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  includeArchived: z.boolean().default(false),
  fuzzyThreshold: z.number().min(0).max(1).default(0.7),
  useCache: z.boolean().default(true),
  cacheTimeout: z.number().int().min(0).max(3600000).default(300000), // 5 minutes
  maxExecutionTime: z.number().int().min(100).max(30000).default(5000), // 5 seconds
  enableHighlighting: z.boolean().default(true),
  enableFacets: z.boolean().default(false),
  weightings: z
    .object({
      title: z.number().min(0).max(10).default(3),
      problem: z.number().min(0).max(10).default(2),
      solution: z.number().min(0).max(10).default(1.5),
      tags: z.number().min(0).max(10).default(1),
    })
    .optional(),
});

export type SearchOptions = z.infer<typeof SearchOptionsSchema>;

/**
 * Query performance metrics for monitoring and optimization
 */
export const QueryPerformanceMetricsSchema = z.object({
  queryHash: z.string().max(64),
  strategy: SearchStrategySchema,
  executionTime: z.number().min(0),
  resultsCount: z.number().int().min(0),
  cacheHit: z.boolean(),
  indexesUsed: z.array(z.string()),
  rowsExamined: z.number().int().min(0),
  rowsReturned: z.number().int().min(0),
  memoryUsed: z.number().int().min(0).optional(),
  cpuTime: z.number().min(0).optional(),
  queryComplexity: z.enum(['simple', 'medium', 'complex', 'very_complex']),
  optimizationSuggestions: z.array(z.string()).optional(),
  timestamp: z.date(),
});

export type QueryPerformanceMetrics = z.infer<typeof QueryPerformanceMetricsSchema>;

// ===========================
// CACHE MANAGEMENT SCHEMAS
// ===========================

/**
 * Cache entry schema with TTL and metadata
 */
export const CacheEntrySchema = z.object({
  key: z.string().max(255),
  value: z.string(), // Serialized JSON
  ttl: z.number().int().min(0),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  tags: z.array(z.string().max(50)).max(20).optional(),
  size: z.number().int().min(0),
  accessCount: z.number().int().min(0).default(0),
  lastAccessed: z.date(),
  created: z.date(),
  compressionEnabled: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
});

export type CacheEntry = z.infer<typeof CacheEntrySchema>;

/**
 * Cache statistics for monitoring
 */
export const CacheStatsSchema = z.object({
  totalEntries: z.number().int().min(0),
  totalSize: z.number().int().min(0),
  hitRate: z.number().min(0).max(100),
  missRate: z.number().min(0).max(100),
  evictionRate: z.number().min(0).max(100),
  avgAccessTime: z.number().min(0),
  memoryUsage: z.object({
    used: z.number().int().min(0),
    available: z.number().int().min(0),
    limit: z.number().int().min(0),
    percentage: z.number().min(0).max(100),
  }),
  timeWindow: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  topKeys: z
    .array(
      z.object({
        key: z.string(),
        hits: z.number().int().min(0),
        lastHit: z.date(),
      })
    )
    .max(10),
  timestamp: z.date(),
});

export type CacheStats = z.infer<typeof CacheStatsSchema>;

// ===========================
// INDEX OPTIMIZATION SCHEMAS
// ===========================

/**
 * Index analysis and recommendations
 */
export const IndexAnalysisSchema = z.object({
  tableName: z.string().max(100),
  indexName: z.string().max(100),
  columns: z.array(z.string()),
  type: z.enum(['btree', 'hash', 'fts', 'composite', 'partial']),
  usage: z.object({
    queryCount: z.number().int().min(0),
    avgSelectivity: z.number().min(0).max(1),
    lastUsed: z.date().optional(),
    efficiency: z.number().min(0).max(100), // Percentage
  }),
  size: z.object({
    rows: z.number().int().min(0),
    bytes: z.number().int().min(0),
    pages: z.number().int().min(0),
  }),
  maintenance: z.object({
    lastAnalyzed: z.date().optional(),
    fragmentationLevel: z.number().min(0).max(100),
    needsRebuild: z.boolean(),
    vacuumRequired: z.boolean(),
  }),
  recommendations: z.array(
    z.object({
      type: z.enum(['create', 'drop', 'rebuild', 'partial', 'composite']),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      description: z.string().max(500),
      estimatedImprovement: z.number().min(0).max(100),
      cost: z.enum(['low', 'medium', 'high']),
    })
  ),
  queryPatterns: z
    .array(
      z.object({
        pattern: z.string().max(200),
        frequency: z.number().int().min(0),
        avgExecutionTime: z.number().min(0),
      })
    )
    .max(20),
  timestamp: z.date(),
});

export type IndexAnalysis = z.infer<typeof IndexAnalysisSchema>;

/**
 * Query execution plan analysis
 */
export const QueryExecutionPlanSchema = z.object({
  queryHash: z.string().max(64),
  query: z.string().max(2000),
  plan: z.array(
    z.object({
      step: z.number().int().min(0),
      operation: z.string().max(100),
      table: z.string().max(100).optional(),
      index: z.string().max(100).optional(),
      rows: z.number().int().min(0),
      cost: z.number().min(0),
      time: z.number().min(0),
      details: z.string().max(500).optional(),
    })
  ),
  totalCost: z.number().min(0),
  totalTime: z.number().min(0),
  optimization: z.object({
    indexSuggestions: z.array(z.string()),
    queryRewrite: z.string().max(2000).optional(),
    potentialImprovement: z.number().min(0).max(100),
  }),
  timestamp: z.date(),
});

export type QueryExecutionPlan = z.infer<typeof QueryExecutionPlanSchema>;

// ===========================
// SYSTEM PERFORMANCE SCHEMAS
// ===========================

/**
 * Database performance monitoring
 */
export const DatabasePerformanceSchema = z.object({
  connections: z.object({
    active: z.number().int().min(0),
    idle: z.number().int().min(0),
    total: z.number().int().min(0),
    maxConnections: z.number().int().min(0),
    waitingQueries: z.number().int().min(0),
  }),
  memory: z.object({
    used: z.number().int().min(0),
    cached: z.number().int().min(0),
    buffers: z.number().int().min(0),
    available: z.number().int().min(0),
    swapUsed: z.number().int().min(0).optional(),
  }),
  storage: z.object({
    databaseSize: z.number().int().min(0),
    indexSize: z.number().int().min(0),
    freeSpace: z.number().int().min(0),
    fragmentationLevel: z.number().min(0).max(100),
  }),
  queries: z.object({
    totalQueries: z.number().int().min(0),
    slowQueries: z.number().int().min(0),
    avgResponseTime: z.number().min(0),
    qps: z.number().min(0), // Queries per second
    errorRate: z.number().min(0).max(100),
  }),
  locks: z.object({
    totalLocks: z.number().int().min(0),
    waitingLocks: z.number().int().min(0),
    deadlocks: z.number().int().min(0),
    avgLockWaitTime: z.number().min(0),
  }),
  health: z.object({
    status: z.enum(['healthy', 'warning', 'critical', 'degraded']),
    uptime: z.number().int().min(0), // seconds
    issues: z.array(
      z.object({
        category: z.string().max(50),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        message: z.string().max(200),
        timestamp: z.date(),
      })
    ),
    recommendations: z.array(z.string().max(200)),
  }),
  timestamp: z.date(),
});

export type DatabasePerformance = z.infer<typeof DatabasePerformanceSchema>;

/**
 * Real-time performance alerts
 */
export const PerformanceAlertSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'slow_query',
    'high_cpu',
    'high_memory',
    'connection_limit',
    'disk_space',
    'cache_miss_rate',
    'index_scan',
    'lock_contention',
    'error_rate',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  message: z.string().max(500),
  threshold: z.number(),
  actualValue: z.number(),
  component: z.string().max(100),
  metadata: z.record(z.any()).optional(),
  acknowledged: z.boolean().default(false),
  acknowledgedBy: z.string().max(100).optional(),
  acknowledgedAt: z.date().optional(),
  resolvedAt: z.date().optional(),
  created: z.date(),
});

export type PerformanceAlert = z.infer<typeof PerformanceAlertSchema>;

// ===========================
// OPTIMIZATION RECOMMENDATIONS
// ===========================

/**
 * Performance optimization recommendations
 */
export const OptimizationRecommendationSchema = z.object({
  id: z.string().uuid(),
  category: z.enum([
    'query_optimization',
    'index_optimization',
    'schema_design',
    'cache_strategy',
    'configuration',
    'hardware',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string().max(100),
  description: z.string().max(1000),
  impact: z.object({
    performance: z.number().min(0).max(100), // Expected improvement %
    resources: z.enum(['decrease', 'neutral', 'increase']),
    complexity: z.enum(['low', 'medium', 'high']),
    risk: z.enum(['low', 'medium', 'high']),
  }),
  implementation: z.object({
    effort: z.enum(['minimal', 'low', 'medium', 'high']),
    timeEstimate: z.string().max(50), // e.g., "2-4 hours"
    prerequisites: z.array(z.string()).optional(),
    steps: z.array(z.string()),
    rollback: z.string().max(500).optional(),
  }),
  evidence: z.object({
    queries: z.array(z.string()).optional(),
    metrics: z.record(z.number()).optional(),
    benchmarks: z
      .array(
        z.object({
          metric: z.string(),
          before: z.number(),
          after: z.number(),
          improvement: z.number(),
        })
      )
      .optional(),
  }),
  status: z.enum(['pending', 'in_progress', 'completed', 'rejected']).default('pending'),
  implementedAt: z.date().optional(),
  implementedBy: z.string().max(100).optional(),
  results: z
    .object({
      actualImprovement: z.number().min(0).max(100).optional(),
      issues: z.array(z.string()).optional(),
      rollbackRequired: z.boolean().default(false),
    })
    .optional(),
  created: z.date(),
  updated: z.date().optional(),
});

export type OptimizationRecommendation = z.infer<typeof OptimizationRecommendationSchema>;

// ===========================
// BENCHMARKING SCHEMAS
// ===========================

/**
 * Performance benchmark results
 */
export const BenchmarkResultSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(100),
  type: z.enum(['search', 'insert', 'update', 'delete', 'bulk', 'stress']),
  configuration: z.object({
    threads: z.number().int().min(1),
    duration: z.number().int().min(1), // seconds
    operations: z.number().int().min(1),
    dataSize: z.string().max(50), // e.g., "1000 entries"
  }),
  metrics: z.object({
    throughput: z.number().min(0), // operations per second
    latency: z.object({
      min: z.number().min(0),
      max: z.number().min(0),
      avg: z.number().min(0),
      p50: z.number().min(0),
      p95: z.number().min(0),
      p99: z.number().min(0),
    }),
    errorRate: z.number().min(0).max(100),
    resourceUsage: z.object({
      cpu: z.number().min(0).max(100),
      memory: z.number().int().min(0),
      disk: z.number().int().min(0),
      network: z.number().int().min(0).optional(),
    }),
  }),
  environment: z.object({
    os: z.string().max(50),
    hardware: z.string().max(200),
    database: z.string().max(100),
    version: z.string().max(50),
  }),
  baseline: z.object({
    isBaseline: z.boolean(),
    comparedTo: z.string().max(100).optional(),
    improvement: z.number().optional(), // percentage
  }),
  tags: z.array(z.string()).max(10),
  notes: z.string().max(1000).optional(),
  created: z.date(),
});

export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>;

// ===========================
// VALIDATION UTILITIES
// ===========================

/**
 * Performance schema validator
 */
export class PerformanceSchemaValidator {
  /**
   * Validate search options
   */
  static validateSearchOptions(data: unknown): SearchOptions {
    return SearchOptionsSchema.parse(data);
  }

  /**
   * Validate query performance metrics
   */
  static validateQueryMetrics(data: unknown): QueryPerformanceMetrics {
    return QueryPerformanceMetricsSchema.parse(data);
  }

  /**
   * Validate cache stats
   */
  static validateCacheStats(data: unknown): CacheStats {
    return CacheStatsSchema.parse(data);
  }

  /**
   * Validate optimization recommendation
   */
  static validateOptimizationRecommendation(data: unknown): OptimizationRecommendation {
    return OptimizationRecommendationSchema.parse(data);
  }

  /**
   * Safe parse with error handling
   */
  static safeParse<T>(
    schema: z.ZodType<T>,
    data: unknown
  ): {
    success: boolean;
    data?: T;
    error?: string;
  } {
    try {
      const parsed = schema.parse(data);
      return { success: true, data: parsed };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        };
      }
      return {
        success: false,
        error: 'Unknown validation error',
      };
    }
  }
}

// ===========================
// SCHEMA EXPORT MAP
// ===========================

export const PerformanceSchemas = {
  SearchOptions: SearchOptionsSchema,
  QueryPerformanceMetrics: QueryPerformanceMetricsSchema,
  CacheEntry: CacheEntrySchema,
  CacheStats: CacheStatsSchema,
  IndexAnalysis: IndexAnalysisSchema,
  QueryExecutionPlan: QueryExecutionPlanSchema,
  DatabasePerformance: DatabasePerformanceSchema,
  PerformanceAlert: PerformanceAlertSchema,
  OptimizationRecommendation: OptimizationRecommendationSchema,
  BenchmarkResult: BenchmarkResultSchema,
} as const;

export type PerformanceSchemaTypes = {
  SearchOptions: SearchOptions;
  QueryPerformanceMetrics: QueryPerformanceMetrics;
  CacheEntry: CacheEntry;
  CacheStats: CacheStats;
  IndexAnalysis: IndexAnalysis;
  QueryExecutionPlan: QueryExecutionPlan;
  DatabasePerformance: DatabasePerformance;
  PerformanceAlert: PerformanceAlert;
  OptimizationRecommendation: OptimizationRecommendation;
  BenchmarkResult: BenchmarkResult;
};

export default {
  ...PerformanceSchemas,
  PerformanceSchemaValidator,
};
