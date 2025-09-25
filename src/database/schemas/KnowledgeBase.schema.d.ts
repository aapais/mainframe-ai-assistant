import { z } from 'zod';
export declare const KBCategorySchema: any;
export type KBCategory = z.infer<typeof KBCategorySchema>;
export declare const SeverityLevelSchema: any;
export type SeverityLevel = z.infer<typeof SeverityLevelSchema>;
export declare const SearchMatchTypeSchema: any;
export type SearchMatchType = z.infer<typeof SearchMatchTypeSchema>;
export declare const KBEntrySchema: any;
export type KBEntry = z.infer<typeof KBEntrySchema>;
export declare const CreateKBEntrySchema: any;
export type CreateKBEntry = z.infer<typeof CreateKBEntrySchema>;
export declare const UpdateKBEntrySchema: any;
export type UpdateKBEntry = z.infer<typeof UpdateKBEntrySchema>;
export declare const SearchResultSchema: any;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export declare const SearchQuerySchema: any;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export declare const SearchWithFacetsSchema: any;
export type SearchWithFacets = z.infer<typeof SearchWithFacetsSchema>;
export declare const EntryFeedbackSchema: any;
export type EntryFeedback = z.infer<typeof EntryFeedbackSchema>;
export declare const UsageMetricSchema: any;
export type UsageMetric = z.infer<typeof UsageMetricSchema>;
export declare const SearchHistorySchema: any;
export type SearchHistory = z.infer<typeof SearchHistorySchema>;
export declare const SystemConfigSchema: any;
export type SystemConfig = z.infer<typeof SystemConfigSchema>;
export declare const BackupLogSchema: any;
export type BackupLog = z.infer<typeof BackupLogSchema>;
export declare const AuditLogSchema: any;
export type AuditLog = z.infer<typeof AuditLogSchema>;
export declare const DatabaseStatsSchema: any;
export type DatabaseStats = z.infer<typeof DatabaseStatsSchema>;
export declare const QueryPerformanceSchema: any;
export type QueryPerformance = z.infer<typeof QueryPerformanceSchema>;
export declare class SchemaValidator {
  static validateKBEntry(data: unknown): CreateKBEntry;
  static validateKBEntryUpdate(data: unknown): UpdateKBEntry;
  static validateSearchQuery(data: unknown): SearchQuery;
  static validateFeedback(data: unknown): EntryFeedback;
  static safeParse<T>(
    schema: z.ZodType<T>,
    data: unknown
  ): {
    success: boolean;
    data?: T;
    error?: string;
  };
}
export declare const DatabaseSchemas: {
  readonly KBEntry: any;
  readonly CreateKBEntry: any;
  readonly UpdateKBEntry: any;
  readonly SearchResult: any;
  readonly SearchQuery: any;
  readonly SearchWithFacets: any;
  readonly EntryFeedback: any;
  readonly UsageMetric: any;
  readonly SearchHistory: any;
  readonly SystemConfig: any;
  readonly BackupLog: any;
  readonly AuditLog: any;
  readonly DatabaseStats: any;
  readonly QueryPerformance: any;
};
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
//# sourceMappingURL=KnowledgeBase.schema.d.ts.map
