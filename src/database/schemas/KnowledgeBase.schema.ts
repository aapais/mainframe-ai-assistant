/**
 * Knowledge Base Database Schema Definitions
 * Comprehensive TypeScript interfaces for all KB entities with full type safety
 */

import { z } from 'zod';

// ===========================
// CORE SCHEMA INTERFACES
// ===========================

/**
 * Knowledge Base Category enumeration with mainframe-specific categories
 */
export const KBCategorySchema = z.enum([
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

export type KBCategory = z.infer<typeof KBCategorySchema>;

/**
 * Severity levels for incidents and solutions
 */
export const SeverityLevelSchema = z.enum(['critical', 'high', 'medium', 'low']);

export type SeverityLevel = z.infer<typeof SeverityLevelSchema>;

/**
 * Search match types for result classification
 */
export const SearchMatchTypeSchema = z.enum([
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

export type SearchMatchType = z.infer<typeof SearchMatchTypeSchema>;

// ===========================
// KNOWLEDGE BASE ENTRY SCHEMA
// ===========================

/**
 * Core Knowledge Base Entry schema with comprehensive validation
 */
export const KBEntrySchema = z.object({
  id: z.string().uuid().optional(),
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title cannot exceed 255 characters')
    .trim(),
  problem: z
    .string()
    .min(10, 'Problem description must be at least 10 characters')
    .max(5000, 'Problem description cannot exceed 5000 characters')
    .trim(),
  solution: z
    .string()
    .min(10, 'Solution must be at least 10 characters')
    .max(10000, 'Solution cannot exceed 10000 characters')
    .trim(),
  category: KBCategorySchema,
  severity: SeverityLevelSchema.optional().default('medium'),
  tags: z.array(z.string().trim().min(1).max(50)).max(20, 'Maximum 20 tags allowed').optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  created_by: z.string().max(100).optional(),
  usage_count: z.number().int().min(0).optional().default(0),
  success_count: z.number().int().min(0).optional().default(0),
  failure_count: z.number().int().min(0).optional().default(0),
  last_used: z.date().optional(),
  archived: z.boolean().optional().default(false),
  confidence_score: z.number().min(0).max(100).optional(),
});

export type KBEntry = z.infer<typeof KBEntrySchema>;

/**
 * KB Entry creation schema (omits auto-generated fields)
 */
export const CreateKBEntrySchema = KBEntrySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  usage_count: true,
  success_count: true,
  failure_count: true,
  last_used: true,
});

export type CreateKBEntry = z.infer<typeof CreateKBEntrySchema>;

/**
 * KB Entry update schema (partial fields)
 */
export const UpdateKBEntrySchema = KBEntrySchema.partial().omit({
  id: true,
  created_at: true,
  created_by: true,
});

export type UpdateKBEntry = z.infer<typeof UpdateKBEntrySchema>;

// ===========================
// SEARCH RELATED SCHEMAS
// ===========================

/**
 * Search result with enhanced metadata
 */
export const SearchResultSchema = z.object({
  entry: KBEntrySchema,
  score: z.number().min(0).max(100),
  matchType: SearchMatchTypeSchema,
  highlights: z.array(z.string()).optional(),
  explanation: z.string().optional(),
  matchedFields: z.array(z.enum(['title', 'problem', 'solution', 'tags'])).optional(),
  executionTime: z.number().min(0).optional(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * Advanced search query with filtering and sorting options
 */
export const SearchQuerySchema = z.object({
  query: z.string().trim().min(1, 'Search query cannot be empty'),
  category: KBCategorySchema.optional(),
  severity: SeverityLevelSchema.optional(),
  tags: z.array(z.string().trim().min(1)).max(10).optional(),
  useAI: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(100).optional().default(10),
  offset: z.number().int().min(0).optional().default(0),
  sortBy: z
    .enum(['relevance', 'usage', 'success_rate', 'created_at', 'updated_at'])
    .optional()
    .default('relevance'),
  sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
  includeArchived: z.boolean().optional().default(false),
  fuzzyThreshold: z.number().min(0).max(1).optional().default(0.7),
  dateRange: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
    })
    .optional(),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

/**
 * Search with facets response
 */
export const SearchWithFacetsSchema = z.object({
  results: z.array(SearchResultSchema),
  facets: z.object({
    categories: z.array(
      z.object({
        name: z.string(),
        count: z.number().int().min(0),
      })
    ),
    tags: z.array(
      z.object({
        name: z.string(),
        count: z.number().int().min(0),
      })
    ),
    severities: z.array(
      z.object({
        name: z.string(),
        count: z.number().int().min(0),
      })
    ),
  }),
  totalCount: z.number().int().min(0),
  executionTime: z.number().min(0).optional(),
});

export type SearchWithFacets = z.infer<typeof SearchWithFacetsSchema>;

// ===========================
// FEEDBACK AND USAGE SCHEMAS
// ===========================

/**
 * Entry feedback schema for user ratings
 */
export const EntryFeedbackSchema = z.object({
  id: z.string().uuid().optional(),
  entry_id: z.string().uuid(),
  user_id: z.string().max(100).optional(),
  rating: z.number().int().min(1).max(5),
  successful: z.boolean(),
  comment: z.string().max(1000).optional(),
  session_id: z.string().max(100).optional(),
  timestamp: z.date().optional(),
  resolution_time: z.number().int().min(0).optional(), // in milliseconds
});

export type EntryFeedback = z.infer<typeof EntryFeedbackSchema>;

/**
 * Usage metrics schema
 */
export const UsageMetricSchema = z.object({
  id: z.number().int().optional(),
  entry_id: z.string().uuid(),
  action: z.enum(['view', 'copy', 'rate_success', 'rate_failure', 'export', 'print', 'share']),
  user_id: z.string().max(100).optional(),
  session_id: z.string().max(100).optional(),
  timestamp: z.date().optional(),
  metadata: z.record(z.any()).optional(), // Additional context
});

export type UsageMetric = z.infer<typeof UsageMetricSchema>;

// ===========================
// SEARCH HISTORY SCHEMAS
// ===========================

/**
 * Search history tracking
 */
export const SearchHistorySchema = z.object({
  id: z.number().int().optional(),
  query: z.string().max(500),
  normalized_query: z.string().max(500).optional(),
  results_count: z.number().int().min(0),
  selected_entry_id: z.string().uuid().optional(),
  user_id: z.string().max(100).optional(),
  session_id: z.string().max(100).optional(),
  search_time_ms: z.number().int().min(0).optional(),
  filters_used: z.record(z.any()).optional(),
  ai_used: z.boolean().optional().default(false),
  timestamp: z.date().optional(),
});

export type SearchHistory = z.infer<typeof SearchHistorySchema>;

// ===========================
// SYSTEM CONFIGURATION SCHEMAS
// ===========================

/**
 * System configuration schema
 */
export const SystemConfigSchema = z.object({
  key: z.string().max(100),
  value: z.string().max(2000),
  type: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional().default('general'),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;

// ===========================
// BACKUP AND AUDIT SCHEMAS
// ===========================

/**
 * Backup log schema
 */
export const BackupLogSchema = z.object({
  id: z.number().int().optional(),
  backup_path: z.string().max(500),
  backup_type: z.enum(['manual', 'scheduled', 'migration', 'export']),
  entries_count: z.number().int().min(0),
  file_size: z.number().int().min(0).optional(),
  checksum: z.string().max(64).optional(),
  created_at: z.date().optional(),
  status: z.enum(['created', 'verified', 'corrupted', 'deleted']).default('created'),
});

export type BackupLog = z.infer<typeof BackupLogSchema>;

/**
 * Audit log schema for tracking all database changes
 */
export const AuditLogSchema = z.object({
  id: z.number().int().optional(),
  table_name: z.string().max(50),
  record_id: z.string().max(100),
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  old_values: z.record(z.any()).optional(),
  new_values: z.record(z.any()).optional(),
  user_id: z.string().max(100).optional(),
  session_id: z.string().max(100).optional(),
  ip_address: z.string().max(45).optional(),
  user_agent: z.string().max(500).optional(),
  timestamp: z.date().optional(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

// ===========================
// DATABASE STATISTICS SCHEMAS
// ===========================

/**
 * Comprehensive database statistics
 */
export const DatabaseStatsSchema = z.object({
  totalEntries: z.number().int().min(0),
  categoryCounts: z.record(z.number().int().min(0)),
  recentActivity: z.number().int().min(0),
  searchesToday: z.number().int().min(0),
  averageSuccessRate: z.number().min(0).max(100),
  topEntries: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      usage_count: z.number().int().min(0),
      success_rate: z.number().min(0).max(100),
    })
  ),
  diskUsage: z.number().int().min(0),
  performance: z.object({
    avgSearchTime: z.number().min(0),
    cacheHitRate: z.number().min(0).max(100),
    slowQueries: z.number().int().min(0),
    errorRate: z.number().min(0).max(100),
  }),
  healthStatus: z.object({
    overall: z.enum(['healthy', 'warning', 'critical']),
    database: z.boolean(),
    cache: z.boolean(),
    indexes: z.boolean(),
    backup: z.boolean(),
    issues: z.array(z.string()),
  }),
  timestamp: z.date().optional(),
});

export type DatabaseStats = z.infer<typeof DatabaseStatsSchema>;

// ===========================
// PERFORMANCE MONITORING SCHEMAS
// ===========================

/**
 * Query performance metrics
 */
export const QueryPerformanceSchema = z.object({
  id: z.number().int().optional(),
  query_hash: z.string().max(64),
  query_text: z.string().max(1000),
  execution_time_ms: z.number().int().min(0),
  rows_examined: z.number().int().min(0),
  rows_returned: z.number().int().min(0),
  cache_hit: z.boolean().default(false),
  index_used: z.boolean().default(false),
  query_plan: z.string().max(2000).optional(),
  timestamp: z.date().optional(),
  user_id: z.string().max(100).optional(),
});

export type QueryPerformance = z.infer<typeof QueryPerformanceSchema>;

// ===========================
// VALIDATION UTILITIES
// ===========================

/**
 * Validation utility class for database schemas
 */
export class SchemaValidator {
  /**
   * Validate KB entry creation data
   */
  static validateKBEntry(data: unknown): CreateKBEntry {
    return CreateKBEntrySchema.parse(data);
  }

  /**
   * Validate KB entry update data
   */
  static validateKBEntryUpdate(data: unknown): UpdateKBEntry {
    return UpdateKBEntrySchema.parse(data);
  }

  /**
   * Validate search query
   */
  static validateSearchQuery(data: unknown): SearchQuery {
    return SearchQuerySchema.parse(data);
  }

  /**
   * Validate entry feedback
   */
  static validateFeedback(data: unknown): EntryFeedback {
    return EntryFeedbackSchema.parse(data);
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

/**
 * Centralized schema export for easy access
 */
export const DatabaseSchemas = {
  KBEntry: KBEntrySchema,
  CreateKBEntry: CreateKBEntrySchema,
  UpdateKBEntry: UpdateKBEntrySchema,
  SearchResult: SearchResultSchema,
  SearchQuery: SearchQuerySchema,
  SearchWithFacets: SearchWithFacetsSchema,
  EntryFeedback: EntryFeedbackSchema,
  UsageMetric: UsageMetricSchema,
  SearchHistory: SearchHistorySchema,
  SystemConfig: SystemConfigSchema,
  BackupLog: BackupLogSchema,
  AuditLog: AuditLogSchema,
  DatabaseStats: DatabaseStatsSchema,
  QueryPerformance: QueryPerformanceSchema,
} as const;

export type DatabaseSchemaTypes = {
  KBEntry: KBEntry;
  CreateKBEntry: CreateKBEntry;
  UpdateKBEntry: UpdateKBEntry;
  SearchResult: SearchResult;
  SearchQuery: SearchQuery;
  SearchWithFacets: SearchWithFacets;
  EntryFeedback: EntryFeedback;
  UsageMetric: UsageMetric;
  SearchHistory: SearchHistory;
  SystemConfig: SystemConfig;
  BackupLog: BackupLog;
  AuditLog: AuditLog;
  DatabaseStats: DatabaseStats;
  QueryPerformance: QueryPerformance;
};
