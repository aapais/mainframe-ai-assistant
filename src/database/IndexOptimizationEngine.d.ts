import Database from 'better-sqlite3';
export interface IndexAnalysis {
    name: string;
    table: string;
    type: 'UNIQUE' | 'PARTIAL' | 'COMPOSITE' | 'SIMPLE' | 'COVERING';
    optimization_type: 'COVERING' | 'FTS' | 'JOIN' | 'STANDARD';
    usage_count: number;
    effectiveness_score: number;
    size_estimate: number;
    last_used: Date | null;
    avg_query_time_ms: number;
    recommendations: string[];
}
export interface QueryPlan {
    step_id: number;
    parent_id: number;
    detail: string;
    estimated_cost: number;
    uses_index: boolean;
    index_name?: string;
    table_scan: boolean;
}
export interface OptimizationRecommendation {
    type: 'CREATE_INDEX' | 'DROP_INDEX' | 'MODIFY_INDEX' | 'ANALYZE_TABLE' | 'QUERY_REWRITE';
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    sql_statement?: string;
    estimated_improvement: string;
    rationale: string;
}
export interface PerformanceMetrics {
    total_queries: number;
    avg_query_time_ms: number;
    slow_queries_count: number;
    index_usage_rate: number;
    table_scan_rate: number;
    cache_hit_rate: number;
    optimization_score: number;
}
export declare class IndexOptimizationEngine {
    private db;
    private queryCache;
    private performanceStats;
    private readonly CACHE_TTL;
    private readonly SLOW_QUERY_THRESHOLD;
    private readonly TARGET_QUERY_TIME;
    constructor(database: Database.Database);
    private initializeMonitoring;
    private createMonitoringTables;
    analyzeIndexes(): Promise<{
        summary: {
            total_indexes: number;
            effective_indexes: number;
            unused_indexes: number;
            recommendations_count: number;
            optimization_score: number;
        };
        indexes: IndexAnalysis[];
        recommendations: OptimizationRecommendation[];
        performance_metrics: PerformanceMetrics;
    }>;
    analyzeQuery(sql: string): Promise<{
        query_plan: QueryPlan[];
        execution_time_ms: number;
        optimization_opportunities: OptimizationRecommendation[];
        performance_score: number;
    }>;
    createOptimalIndexes(dryRun?: boolean): Promise<{
        created_indexes: string[];
        dropped_indexes: string[];
        estimated_improvement: string;
        sql_statements: string[];
    }>;
    updateIndexStatistics(): Promise<void>;
    generatePerformanceReport(): Promise<{
        overall_score: number;
        query_performance: {
            total_queries: number;
            avg_response_time_ms: number;
            sub_second_queries_percent: number;
            slow_queries_count: number;
        };
        index_effectiveness: {
            total_indexes: number;
            effective_indexes_percent: number;
            unused_indexes_count: number;
            coverage_score: number;
        };
        recommendations: {
            high_priority: OptimizationRecommendation[];
            medium_priority: OptimizationRecommendation[];
            low_priority: OptimizationRecommendation[];
        };
        trends: {
            query_time_trend: string;
            index_usage_trend: string;
            optimization_opportunities: number;
        };
    }>;
    private getAllIndexes;
    private analyzeIndex;
    private getQueryPlan;
    private measureQueryExecutionTime;
    private analyzeQueryOptimizations;
    private calculateQueryPerformanceScore;
    private getSlowQueryPatterns;
    private generateIndexRecommendationsForQuery;
    private getUnusedIndexes;
    private estimatePerformanceImprovement;
    private calculateOverallPerformanceScore;
    private calculatePerformanceTrends;
    private determineIndexType;
    private determineOptimizationType;
    private calculateIndexEffectiveness;
    private estimateIndexSize;
    private generateIndexRecommendations;
    private generateOptimizationRecommendations;
    private calculatePerformanceMetrics;
    private calculateOptimizationScore;
    private extractIndexNamesFromPlan;
    private getTableNameForIndex;
    private calculateIndexCoverageScore;
    private calculateTrend;
    private countOptimizationOpportunities;
    private extractCostFromPlan;
    private extractIndexNameFromPlan;
    private generateIndexSQLForTableScan;
    private couldBenefitFromCoveringIndex;
    private generateCoveringIndexSQL;
    private findInefficientJoins;
    private generateJoinIndexSQL;
    private analyzeQueryStructure;
    private generateCoveringIndexFromAnalysis;
    private generateCompositeIndexFromAnalysis;
    private extractIndexNameFromSQL;
}
export default IndexOptimizationEngine;
//# sourceMappingURL=IndexOptimizationEngine.d.ts.map