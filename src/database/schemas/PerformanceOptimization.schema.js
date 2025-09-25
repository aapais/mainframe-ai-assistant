'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PerformanceSchemas =
  exports.PerformanceSchemaValidator =
  exports.BenchmarkResultSchema =
  exports.OptimizationRecommendationSchema =
  exports.PerformanceAlertSchema =
  exports.DatabasePerformanceSchema =
  exports.QueryExecutionPlanSchema =
  exports.IndexAnalysisSchema =
  exports.CacheStatsSchema =
  exports.CacheEntrySchema =
  exports.QueryPerformanceMetricsSchema =
  exports.SearchOptionsSchema =
  exports.SearchStrategySchema =
    void 0;
const zod_1 = require('zod');
exports.SearchStrategySchema = zod_1.z.enum([
  'exact',
  'fts',
  'fuzzy',
  'semantic',
  'category',
  'tag',
  'hybrid',
  'cached',
]);
exports.SearchOptionsSchema = zod_1.z.object({
  query: zod_1.z.string().min(1),
  strategy: exports.SearchStrategySchema.optional(),
  limit: zod_1.z.number().int().min(1).max(1000).default(10),
  offset: zod_1.z.number().int().min(0).default(0),
  sortBy: zod_1.z
    .enum(['relevance', 'usage', 'success_rate', 'created_at', 'updated_at'])
    .default('relevance'),
  sortDirection: zod_1.z.enum(['asc', 'desc']).default('desc'),
  category: zod_1.z.string().optional(),
  tags: zod_1.z.array(zod_1.z.string()).max(10).optional(),
  severity: zod_1.z.enum(['critical', 'high', 'medium', 'low']).optional(),
  includeArchived: zod_1.z.boolean().default(false),
  fuzzyThreshold: zod_1.z.number().min(0).max(1).default(0.7),
  useCache: zod_1.z.boolean().default(true),
  cacheTimeout: zod_1.z.number().int().min(0).max(3600000).default(300000),
  maxExecutionTime: zod_1.z.number().int().min(100).max(30000).default(5000),
  enableHighlighting: zod_1.z.boolean().default(true),
  enableFacets: zod_1.z.boolean().default(false),
  weightings: zod_1.z
    .object({
      title: zod_1.z.number().min(0).max(10).default(3),
      problem: zod_1.z.number().min(0).max(10).default(2),
      solution: zod_1.z.number().min(0).max(10).default(1.5),
      tags: zod_1.z.number().min(0).max(10).default(1),
    })
    .optional(),
});
exports.QueryPerformanceMetricsSchema = zod_1.z.object({
  queryHash: zod_1.z.string().max(64),
  strategy: exports.SearchStrategySchema,
  executionTime: zod_1.z.number().min(0),
  resultsCount: zod_1.z.number().int().min(0),
  cacheHit: zod_1.z.boolean(),
  indexesUsed: zod_1.z.array(zod_1.z.string()),
  rowsExamined: zod_1.z.number().int().min(0),
  rowsReturned: zod_1.z.number().int().min(0),
  memoryUsed: zod_1.z.number().int().min(0).optional(),
  cpuTime: zod_1.z.number().min(0).optional(),
  queryComplexity: zod_1.z.enum(['simple', 'medium', 'complex', 'very_complex']),
  optimizationSuggestions: zod_1.z.array(zod_1.z.string()).optional(),
  timestamp: zod_1.z.date(),
});
exports.CacheEntrySchema = zod_1.z.object({
  key: zod_1.z.string().max(255),
  value: zod_1.z.string(),
  ttl: zod_1.z.number().int().min(0),
  priority: zod_1.z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  tags: zod_1.z.array(zod_1.z.string().max(50)).max(20).optional(),
  size: zod_1.z.number().int().min(0),
  accessCount: zod_1.z.number().int().min(0).default(0),
  lastAccessed: zod_1.z.date(),
  created: zod_1.z.date(),
  compressionEnabled: zod_1.z.boolean().default(false),
  metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.CacheStatsSchema = zod_1.z.object({
  totalEntries: zod_1.z.number().int().min(0),
  totalSize: zod_1.z.number().int().min(0),
  hitRate: zod_1.z.number().min(0).max(100),
  missRate: zod_1.z.number().min(0).max(100),
  evictionRate: zod_1.z.number().min(0).max(100),
  avgAccessTime: zod_1.z.number().min(0),
  memoryUsage: zod_1.z.object({
    used: zod_1.z.number().int().min(0),
    available: zod_1.z.number().int().min(0),
    limit: zod_1.z.number().int().min(0),
    percentage: zod_1.z.number().min(0).max(100),
  }),
  timeWindow: zod_1.z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  topKeys: zod_1.z
    .array(
      zod_1.z.object({
        key: zod_1.z.string(),
        hits: zod_1.z.number().int().min(0),
        lastHit: zod_1.z.date(),
      })
    )
    .max(10),
  timestamp: zod_1.z.date(),
});
exports.IndexAnalysisSchema = zod_1.z.object({
  tableName: zod_1.z.string().max(100),
  indexName: zod_1.z.string().max(100),
  columns: zod_1.z.array(zod_1.z.string()),
  type: zod_1.z.enum(['btree', 'hash', 'fts', 'composite', 'partial']),
  usage: zod_1.z.object({
    queryCount: zod_1.z.number().int().min(0),
    avgSelectivity: zod_1.z.number().min(0).max(1),
    lastUsed: zod_1.z.date().optional(),
    efficiency: zod_1.z.number().min(0).max(100),
  }),
  size: zod_1.z.object({
    rows: zod_1.z.number().int().min(0),
    bytes: zod_1.z.number().int().min(0),
    pages: zod_1.z.number().int().min(0),
  }),
  maintenance: zod_1.z.object({
    lastAnalyzed: zod_1.z.date().optional(),
    fragmentationLevel: zod_1.z.number().min(0).max(100),
    needsRebuild: zod_1.z.boolean(),
    vacuumRequired: zod_1.z.boolean(),
  }),
  recommendations: zod_1.z.array(
    zod_1.z.object({
      type: zod_1.z.enum(['create', 'drop', 'rebuild', 'partial', 'composite']),
      priority: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
      description: zod_1.z.string().max(500),
      estimatedImprovement: zod_1.z.number().min(0).max(100),
      cost: zod_1.z.enum(['low', 'medium', 'high']),
    })
  ),
  queryPatterns: zod_1.z
    .array(
      zod_1.z.object({
        pattern: zod_1.z.string().max(200),
        frequency: zod_1.z.number().int().min(0),
        avgExecutionTime: zod_1.z.number().min(0),
      })
    )
    .max(20),
  timestamp: zod_1.z.date(),
});
exports.QueryExecutionPlanSchema = zod_1.z.object({
  queryHash: zod_1.z.string().max(64),
  query: zod_1.z.string().max(2000),
  plan: zod_1.z.array(
    zod_1.z.object({
      step: zod_1.z.number().int().min(0),
      operation: zod_1.z.string().max(100),
      table: zod_1.z.string().max(100).optional(),
      index: zod_1.z.string().max(100).optional(),
      rows: zod_1.z.number().int().min(0),
      cost: zod_1.z.number().min(0),
      time: zod_1.z.number().min(0),
      details: zod_1.z.string().max(500).optional(),
    })
  ),
  totalCost: zod_1.z.number().min(0),
  totalTime: zod_1.z.number().min(0),
  optimization: zod_1.z.object({
    indexSuggestions: zod_1.z.array(zod_1.z.string()),
    queryRewrite: zod_1.z.string().max(2000).optional(),
    potentialImprovement: zod_1.z.number().min(0).max(100),
  }),
  timestamp: zod_1.z.date(),
});
exports.DatabasePerformanceSchema = zod_1.z.object({
  connections: zod_1.z.object({
    active: zod_1.z.number().int().min(0),
    idle: zod_1.z.number().int().min(0),
    total: zod_1.z.number().int().min(0),
    maxConnections: zod_1.z.number().int().min(0),
    waitingQueries: zod_1.z.number().int().min(0),
  }),
  memory: zod_1.z.object({
    used: zod_1.z.number().int().min(0),
    cached: zod_1.z.number().int().min(0),
    buffers: zod_1.z.number().int().min(0),
    available: zod_1.z.number().int().min(0),
    swapUsed: zod_1.z.number().int().min(0).optional(),
  }),
  storage: zod_1.z.object({
    databaseSize: zod_1.z.number().int().min(0),
    indexSize: zod_1.z.number().int().min(0),
    freeSpace: zod_1.z.number().int().min(0),
    fragmentationLevel: zod_1.z.number().min(0).max(100),
  }),
  queries: zod_1.z.object({
    totalQueries: zod_1.z.number().int().min(0),
    slowQueries: zod_1.z.number().int().min(0),
    avgResponseTime: zod_1.z.number().min(0),
    qps: zod_1.z.number().min(0),
    errorRate: zod_1.z.number().min(0).max(100),
  }),
  locks: zod_1.z.object({
    totalLocks: zod_1.z.number().int().min(0),
    waitingLocks: zod_1.z.number().int().min(0),
    deadlocks: zod_1.z.number().int().min(0),
    avgLockWaitTime: zod_1.z.number().min(0),
  }),
  health: zod_1.z.object({
    status: zod_1.z.enum(['healthy', 'warning', 'critical', 'degraded']),
    uptime: zod_1.z.number().int().min(0),
    issues: zod_1.z.array(
      zod_1.z.object({
        category: zod_1.z.string().max(50),
        severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
        message: zod_1.z.string().max(200),
        timestamp: zod_1.z.date(),
      })
    ),
    recommendations: zod_1.z.array(zod_1.z.string().max(200)),
  }),
  timestamp: zod_1.z.date(),
});
exports.PerformanceAlertSchema = zod_1.z.object({
  id: zod_1.z.string().uuid(),
  type: zod_1.z.enum([
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
  severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
  message: zod_1.z.string().max(500),
  threshold: zod_1.z.number(),
  actualValue: zod_1.z.number(),
  component: zod_1.z.string().max(100),
  metadata: zod_1.z.record(zod_1.z.any()).optional(),
  acknowledged: zod_1.z.boolean().default(false),
  acknowledgedBy: zod_1.z.string().max(100).optional(),
  acknowledgedAt: zod_1.z.date().optional(),
  resolvedAt: zod_1.z.date().optional(),
  created: zod_1.z.date(),
});
exports.OptimizationRecommendationSchema = zod_1.z.object({
  id: zod_1.z.string().uuid(),
  category: zod_1.z.enum([
    'query_optimization',
    'index_optimization',
    'schema_design',
    'cache_strategy',
    'configuration',
    'hardware',
  ]),
  priority: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
  title: zod_1.z.string().max(100),
  description: zod_1.z.string().max(1000),
  impact: zod_1.z.object({
    performance: zod_1.z.number().min(0).max(100),
    resources: zod_1.z.enum(['decrease', 'neutral', 'increase']),
    complexity: zod_1.z.enum(['low', 'medium', 'high']),
    risk: zod_1.z.enum(['low', 'medium', 'high']),
  }),
  implementation: zod_1.z.object({
    effort: zod_1.z.enum(['minimal', 'low', 'medium', 'high']),
    timeEstimate: zod_1.z.string().max(50),
    prerequisites: zod_1.z.array(zod_1.z.string()).optional(),
    steps: zod_1.z.array(zod_1.z.string()),
    rollback: zod_1.z.string().max(500).optional(),
  }),
  evidence: zod_1.z.object({
    queries: zod_1.z.array(zod_1.z.string()).optional(),
    metrics: zod_1.z.record(zod_1.z.number()).optional(),
    benchmarks: zod_1.z
      .array(
        zod_1.z.object({
          metric: zod_1.z.string(),
          before: zod_1.z.number(),
          after: zod_1.z.number(),
          improvement: zod_1.z.number(),
        })
      )
      .optional(),
  }),
  status: zod_1.z.enum(['pending', 'in_progress', 'completed', 'rejected']).default('pending'),
  implementedAt: zod_1.z.date().optional(),
  implementedBy: zod_1.z.string().max(100).optional(),
  results: zod_1.z
    .object({
      actualImprovement: zod_1.z.number().min(0).max(100).optional(),
      issues: zod_1.z.array(zod_1.z.string()).optional(),
      rollbackRequired: zod_1.z.boolean().default(false),
    })
    .optional(),
  created: zod_1.z.date(),
  updated: zod_1.z.date().optional(),
});
exports.BenchmarkResultSchema = zod_1.z.object({
  id: zod_1.z.string().uuid(),
  name: zod_1.z.string().max(100),
  type: zod_1.z.enum(['search', 'insert', 'update', 'delete', 'bulk', 'stress']),
  configuration: zod_1.z.object({
    threads: zod_1.z.number().int().min(1),
    duration: zod_1.z.number().int().min(1),
    operations: zod_1.z.number().int().min(1),
    dataSize: zod_1.z.string().max(50),
  }),
  metrics: zod_1.z.object({
    throughput: zod_1.z.number().min(0),
    latency: zod_1.z.object({
      min: zod_1.z.number().min(0),
      max: zod_1.z.number().min(0),
      avg: zod_1.z.number().min(0),
      p50: zod_1.z.number().min(0),
      p95: zod_1.z.number().min(0),
      p99: zod_1.z.number().min(0),
    }),
    errorRate: zod_1.z.number().min(0).max(100),
    resourceUsage: zod_1.z.object({
      cpu: zod_1.z.number().min(0).max(100),
      memory: zod_1.z.number().int().min(0),
      disk: zod_1.z.number().int().min(0),
      network: zod_1.z.number().int().min(0).optional(),
    }),
  }),
  environment: zod_1.z.object({
    os: zod_1.z.string().max(50),
    hardware: zod_1.z.string().max(200),
    database: zod_1.z.string().max(100),
    version: zod_1.z.string().max(50),
  }),
  baseline: zod_1.z.object({
    isBaseline: zod_1.z.boolean(),
    comparedTo: zod_1.z.string().max(100).optional(),
    improvement: zod_1.z.number().optional(),
  }),
  tags: zod_1.z.array(zod_1.z.string()).max(10),
  notes: zod_1.z.string().max(1000).optional(),
  created: zod_1.z.date(),
});
class PerformanceSchemaValidator {
  static validateSearchOptions(data) {
    return exports.SearchOptionsSchema.parse(data);
  }
  static validateQueryMetrics(data) {
    return exports.QueryPerformanceMetricsSchema.parse(data);
  }
  static validateCacheStats(data) {
    return exports.CacheStatsSchema.parse(data);
  }
  static validateOptimizationRecommendation(data) {
    return exports.OptimizationRecommendationSchema.parse(data);
  }
  static safeParse(schema, data) {
    try {
      const parsed = schema.parse(data);
      return { success: true, data: parsed };
    } catch (error) {
      if (error instanceof zod_1.z.ZodError) {
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
exports.PerformanceSchemaValidator = PerformanceSchemaValidator;
exports.PerformanceSchemas = {
  SearchOptions: exports.SearchOptionsSchema,
  QueryPerformanceMetrics: exports.QueryPerformanceMetricsSchema,
  CacheEntry: exports.CacheEntrySchema,
  CacheStats: exports.CacheStatsSchema,
  IndexAnalysis: exports.IndexAnalysisSchema,
  QueryExecutionPlan: exports.QueryExecutionPlanSchema,
  DatabasePerformance: exports.DatabasePerformanceSchema,
  PerformanceAlert: exports.PerformanceAlertSchema,
  OptimizationRecommendation: exports.OptimizationRecommendationSchema,
  BenchmarkResult: exports.BenchmarkResultSchema,
};
exports.default = {
  ...exports.PerformanceSchemas,
  PerformanceSchemaValidator,
};
//# sourceMappingURL=PerformanceOptimization.schema.js.map
