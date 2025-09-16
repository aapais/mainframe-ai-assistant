import { z } from 'zod';
export declare const SearchStrategySchema: any;
export type SearchStrategy = z.infer<typeof SearchStrategySchema>;
export declare const SearchOptionsSchema: any;
export type SearchOptions = z.infer<typeof SearchOptionsSchema>;
export declare const QueryPerformanceMetricsSchema: any;
export type QueryPerformanceMetrics = z.infer<typeof QueryPerformanceMetricsSchema>;
export declare const CacheEntrySchema: any;
export type CacheEntry = z.infer<typeof CacheEntrySchema>;
export declare const CacheStatsSchema: any;
export type CacheStats = z.infer<typeof CacheStatsSchema>;
export declare const IndexAnalysisSchema: any;
export type IndexAnalysis = z.infer<typeof IndexAnalysisSchema>;
export declare const QueryExecutionPlanSchema: any;
export type QueryExecutionPlan = z.infer<typeof QueryExecutionPlanSchema>;
export declare const DatabasePerformanceSchema: any;
export type DatabasePerformance = z.infer<typeof DatabasePerformanceSchema>;
export declare const PerformanceAlertSchema: any;
export type PerformanceAlert = z.infer<typeof PerformanceAlertSchema>;
export declare const OptimizationRecommendationSchema: any;
export type OptimizationRecommendation = z.infer<typeof OptimizationRecommendationSchema>;
export declare const BenchmarkResultSchema: any;
export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>;
export declare class PerformanceSchemaValidator {
    static validateSearchOptions(data: unknown): SearchOptions;
    static validateQueryMetrics(data: unknown): QueryPerformanceMetrics;
    static validateCacheStats(data: unknown): CacheStats;
    static validateOptimizationRecommendation(data: unknown): OptimizationRecommendation;
    static safeParse<T>(schema: z.ZodType<T>, data: unknown): {
        success: boolean;
        data?: T;
        error?: string;
    };
}
export declare const PerformanceSchemas: {
    readonly SearchOptions: any;
    readonly QueryPerformanceMetrics: any;
    readonly CacheEntry: any;
    readonly CacheStats: any;
    readonly IndexAnalysis: any;
    readonly QueryExecutionPlan: any;
    readonly DatabasePerformance: any;
    readonly PerformanceAlert: any;
    readonly OptimizationRecommendation: any;
    readonly BenchmarkResult: any;
};
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
declare const _default: {
    PerformanceSchemaValidator: typeof PerformanceSchemaValidator;
    SearchOptions: any;
    QueryPerformanceMetrics: any;
    CacheEntry: any;
    CacheStats: any;
    IndexAnalysis: any;
    QueryExecutionPlan: any;
    DatabasePerformance: any;
    PerformanceAlert: any;
    OptimizationRecommendation: any;
    BenchmarkResult: any;
};
export default _default;
//# sourceMappingURL=PerformanceOptimization.schema.d.ts.map