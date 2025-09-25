'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.DatabaseSchemas =
  exports.SchemaValidator =
  exports.QueryPerformanceSchema =
  exports.DatabaseStatsSchema =
  exports.AuditLogSchema =
  exports.BackupLogSchema =
  exports.SystemConfigSchema =
  exports.SearchHistorySchema =
  exports.UsageMetricSchema =
  exports.EntryFeedbackSchema =
  exports.SearchWithFacetsSchema =
  exports.SearchQuerySchema =
  exports.SearchResultSchema =
  exports.UpdateKBEntrySchema =
  exports.CreateKBEntrySchema =
  exports.KBEntrySchema =
  exports.SearchMatchTypeSchema =
  exports.SeverityLevelSchema =
  exports.KBCategorySchema =
    void 0;
const zod_1 = require('zod');
exports.KBCategorySchema = zod_1.z.enum([
  'JCL',
  'VSAM',
  'DB2',
  'Batch',
  'Functional',
  'IMS',
  'CICS',
  'System',
  'Other',
]);
exports.SeverityLevelSchema = zod_1.z.enum(['critical', 'high', 'medium', 'low']);
exports.SearchMatchTypeSchema = zod_1.z.enum([
  'exact',
  'fuzzy',
  'ai',
  'semantic',
  'category',
  'tag',
  'popular',
  'recent',
  'hybrid',
]);
exports.KBEntrySchema = zod_1.z.object({
  id: zod_1.z.string().uuid().optional(),
  title: zod_1.z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title cannot exceed 255 characters')
    .trim(),
  problem: zod_1.z
    .string()
    .min(10, 'Problem description must be at least 10 characters')
    .max(5000, 'Problem description cannot exceed 5000 characters')
    .trim(),
  solution: zod_1.z
    .string()
    .min(10, 'Solution must be at least 10 characters')
    .max(10000, 'Solution cannot exceed 10000 characters')
    .trim(),
  category: exports.KBCategorySchema,
  severity: exports.SeverityLevelSchema.optional().default('medium'),
  tags: zod_1.z
    .array(zod_1.z.string().trim().min(1).max(50))
    .max(20, 'Maximum 20 tags allowed')
    .optional(),
  created_at: zod_1.z.date().optional(),
  updated_at: zod_1.z.date().optional(),
  created_by: zod_1.z.string().max(100).optional(),
  usage_count: zod_1.z.number().int().min(0).optional().default(0),
  success_count: zod_1.z.number().int().min(0).optional().default(0),
  failure_count: zod_1.z.number().int().min(0).optional().default(0),
  last_used: zod_1.z.date().optional(),
  archived: zod_1.z.boolean().optional().default(false),
  confidence_score: zod_1.z.number().min(0).max(100).optional(),
});
exports.CreateKBEntrySchema = exports.KBEntrySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  usage_count: true,
  success_count: true,
  failure_count: true,
  last_used: true,
});
exports.UpdateKBEntrySchema = exports.KBEntrySchema.partial().omit({
  id: true,
  created_at: true,
  created_by: true,
});
exports.SearchResultSchema = zod_1.z.object({
  entry: exports.KBEntrySchema,
  score: zod_1.z.number().min(0).max(100),
  matchType: exports.SearchMatchTypeSchema,
  highlights: zod_1.z.array(zod_1.z.string()).optional(),
  explanation: zod_1.z.string().optional(),
  matchedFields: zod_1.z.array(zod_1.z.enum(['title', 'problem', 'solution', 'tags'])).optional(),
  executionTime: zod_1.z.number().min(0).optional(),
});
exports.SearchQuerySchema = zod_1.z.object({
  query: zod_1.z.string().trim().min(1, 'Search query cannot be empty'),
  category: exports.KBCategorySchema.optional(),
  severity: exports.SeverityLevelSchema.optional(),
  tags: zod_1.z.array(zod_1.z.string().trim().min(1)).max(10).optional(),
  useAI: zod_1.z.boolean().optional().default(true),
  limit: zod_1.z.number().int().min(1).max(100).optional().default(10),
  offset: zod_1.z.number().int().min(0).optional().default(0),
  sortBy: zod_1.z
    .enum(['relevance', 'usage', 'success_rate', 'created_at', 'updated_at'])
    .optional()
    .default('relevance'),
  sortDirection: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
  includeArchived: zod_1.z.boolean().optional().default(false),
  fuzzyThreshold: zod_1.z.number().min(0).max(1).optional().default(0.7),
  dateRange: zod_1.z
    .object({
      from: zod_1.z.date().optional(),
      to: zod_1.z.date().optional(),
    })
    .optional(),
});
exports.SearchWithFacetsSchema = zod_1.z.object({
  results: zod_1.z.array(exports.SearchResultSchema),
  facets: zod_1.z.object({
    categories: zod_1.z.array(
      zod_1.z.object({
        name: zod_1.z.string(),
        count: zod_1.z.number().int().min(0),
      })
    ),
    tags: zod_1.z.array(
      zod_1.z.object({
        name: zod_1.z.string(),
        count: zod_1.z.number().int().min(0),
      })
    ),
    severities: zod_1.z.array(
      zod_1.z.object({
        name: zod_1.z.string(),
        count: zod_1.z.number().int().min(0),
      })
    ),
  }),
  totalCount: zod_1.z.number().int().min(0),
  executionTime: zod_1.z.number().min(0).optional(),
});
exports.EntryFeedbackSchema = zod_1.z.object({
  id: zod_1.z.string().uuid().optional(),
  entry_id: zod_1.z.string().uuid(),
  user_id: zod_1.z.string().max(100).optional(),
  rating: zod_1.z.number().int().min(1).max(5),
  successful: zod_1.z.boolean(),
  comment: zod_1.z.string().max(1000).optional(),
  session_id: zod_1.z.string().max(100).optional(),
  timestamp: zod_1.z.date().optional(),
  resolution_time: zod_1.z.number().int().min(0).optional(),
});
exports.UsageMetricSchema = zod_1.z.object({
  id: zod_1.z.number().int().optional(),
  entry_id: zod_1.z.string().uuid(),
  action: zod_1.z.enum([
    'view',
    'copy',
    'rate_success',
    'rate_failure',
    'export',
    'print',
    'share',
  ]),
  user_id: zod_1.z.string().max(100).optional(),
  session_id: zod_1.z.string().max(100).optional(),
  timestamp: zod_1.z.date().optional(),
  metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.SearchHistorySchema = zod_1.z.object({
  id: zod_1.z.number().int().optional(),
  query: zod_1.z.string().max(500),
  normalized_query: zod_1.z.string().max(500).optional(),
  results_count: zod_1.z.number().int().min(0),
  selected_entry_id: zod_1.z.string().uuid().optional(),
  user_id: zod_1.z.string().max(100).optional(),
  session_id: zod_1.z.string().max(100).optional(),
  search_time_ms: zod_1.z.number().int().min(0).optional(),
  filters_used: zod_1.z.record(zod_1.z.any()).optional(),
  ai_used: zod_1.z.boolean().optional().default(false),
  timestamp: zod_1.z.date().optional(),
});
exports.SystemConfigSchema = zod_1.z.object({
  key: zod_1.z.string().max(100),
  value: zod_1.z.string().max(2000),
  type: zod_1.z.enum(['string', 'number', 'boolean', 'json']).default('string'),
  description: zod_1.z.string().max(500).optional(),
  category: zod_1.z.string().max(50).optional().default('general'),
  created_at: zod_1.z.date().optional(),
  updated_at: zod_1.z.date().optional(),
});
exports.BackupLogSchema = zod_1.z.object({
  id: zod_1.z.number().int().optional(),
  backup_path: zod_1.z.string().max(500),
  backup_type: zod_1.z.enum(['manual', 'scheduled', 'migration', 'export']),
  entries_count: zod_1.z.number().int().min(0),
  file_size: zod_1.z.number().int().min(0).optional(),
  checksum: zod_1.z.string().max(64).optional(),
  created_at: zod_1.z.date().optional(),
  status: zod_1.z.enum(['created', 'verified', 'corrupted', 'deleted']).default('created'),
});
exports.AuditLogSchema = zod_1.z.object({
  id: zod_1.z.number().int().optional(),
  table_name: zod_1.z.string().max(50),
  record_id: zod_1.z.string().max(100),
  operation: zod_1.z.enum(['INSERT', 'UPDATE', 'DELETE']),
  old_values: zod_1.z.record(zod_1.z.any()).optional(),
  new_values: zod_1.z.record(zod_1.z.any()).optional(),
  user_id: zod_1.z.string().max(100).optional(),
  session_id: zod_1.z.string().max(100).optional(),
  ip_address: zod_1.z.string().max(45).optional(),
  user_agent: zod_1.z.string().max(500).optional(),
  timestamp: zod_1.z.date().optional(),
});
exports.DatabaseStatsSchema = zod_1.z.object({
  totalEntries: zod_1.z.number().int().min(0),
  categoryCounts: zod_1.z.record(zod_1.z.number().int().min(0)),
  recentActivity: zod_1.z.number().int().min(0),
  searchesToday: zod_1.z.number().int().min(0),
  averageSuccessRate: zod_1.z.number().min(0).max(100),
  topEntries: zod_1.z.array(
    zod_1.z.object({
      id: zod_1.z.string().uuid(),
      title: zod_1.z.string(),
      usage_count: zod_1.z.number().int().min(0),
      success_rate: zod_1.z.number().min(0).max(100),
    })
  ),
  diskUsage: zod_1.z.number().int().min(0),
  performance: zod_1.z.object({
    avgSearchTime: zod_1.z.number().min(0),
    cacheHitRate: zod_1.z.number().min(0).max(100),
    slowQueries: zod_1.z.number().int().min(0),
    errorRate: zod_1.z.number().min(0).max(100),
  }),
  healthStatus: zod_1.z.object({
    overall: zod_1.z.enum(['healthy', 'warning', 'critical']),
    database: zod_1.z.boolean(),
    cache: zod_1.z.boolean(),
    indexes: zod_1.z.boolean(),
    backup: zod_1.z.boolean(),
    issues: zod_1.z.array(zod_1.z.string()),
  }),
  timestamp: zod_1.z.date().optional(),
});
exports.QueryPerformanceSchema = zod_1.z.object({
  id: zod_1.z.number().int().optional(),
  query_hash: zod_1.z.string().max(64),
  query_text: zod_1.z.string().max(1000),
  execution_time_ms: zod_1.z.number().int().min(0),
  rows_examined: zod_1.z.number().int().min(0),
  rows_returned: zod_1.z.number().int().min(0),
  cache_hit: zod_1.z.boolean().default(false),
  index_used: zod_1.z.boolean().default(false),
  query_plan: zod_1.z.string().max(2000).optional(),
  timestamp: zod_1.z.date().optional(),
  user_id: zod_1.z.string().max(100).optional(),
});
class SchemaValidator {
  static validateKBEntry(data) {
    return exports.CreateKBEntrySchema.parse(data);
  }
  static validateKBEntryUpdate(data) {
    return exports.UpdateKBEntrySchema.parse(data);
  }
  static validateSearchQuery(data) {
    return exports.SearchQuerySchema.parse(data);
  }
  static validateFeedback(data) {
    return exports.EntryFeedbackSchema.parse(data);
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
exports.SchemaValidator = SchemaValidator;
exports.DatabaseSchemas = {
  KBEntry: exports.KBEntrySchema,
  CreateKBEntry: exports.CreateKBEntrySchema,
  UpdateKBEntry: exports.UpdateKBEntrySchema,
  SearchResult: exports.SearchResultSchema,
  SearchQuery: exports.SearchQuerySchema,
  SearchWithFacets: exports.SearchWithFacetsSchema,
  EntryFeedback: exports.EntryFeedbackSchema,
  UsageMetric: exports.UsageMetricSchema,
  SearchHistory: exports.SearchHistorySchema,
  SystemConfig: exports.SystemConfigSchema,
  BackupLog: exports.BackupLogSchema,
  AuditLog: exports.AuditLogSchema,
  DatabaseStats: exports.DatabaseStatsSchema,
  QueryPerformance: exports.QueryPerformanceSchema,
};
//# sourceMappingURL=KnowledgeBase.schema.js.map
