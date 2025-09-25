import Database from 'better-sqlite3';
export interface OptimizedQuery {
  original_sql: string;
  optimized_sql: string;
  optimization_techniques: string[];
  estimated_improvement: number;
  explanation: string;
}
export interface JoinOptimization {
  join_type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  table_order: string[];
  index_recommendations: string[];
  estimated_cost_reduction: number;
}
export interface SubqueryOptimization {
  original_subquery: string;
  optimized_version: string;
  optimization_type: 'EXISTS_TO_JOIN' | 'IN_TO_JOIN' | 'CORRELATED_TO_WINDOW' | 'MATERIALIZATION';
  performance_gain: number;
}
export interface QueryPerformanceAnalysis {
  execution_time_ms: number;
  rows_examined: number;
  rows_returned: number;
  index_usage: string[];
  table_scans: string[];
  optimization_score: number;
  bottlenecks: string[];
  recommendations: string[];
}
export declare class QueryOptimizationService {
  private db;
  private queryCache;
  private performanceStats;
  private optimizationPatterns;
  private readonly CACHE_TTL;
  private readonly PERFORMANCE_TARGET;
  private readonly SLOW_QUERY_THRESHOLD;
  constructor(database: Database.Database);
  private initializeOptimizationEngine;
  private createAnalysisTables;
  optimizeQuery(sql: string): Promise<OptimizedQuery>;
  optimizeJOINs(sql: string): Promise<{
    optimized_sql: string;
    improvements: string[];
  }>;
  optimizeSubqueries(sql: string): Promise<{
    optimized_sql: string;
    improvements: string[];
  }>;
  analyzeQueryPerformance(sql: string): Promise<QueryPerformanceAnalysis>;
  executeOptimizedQuery<T = any>(
    sql: string,
    params?: any[]
  ): Promise<{
    results: T[];
    execution_time_ms: number;
    cache_hit: boolean;
    optimization_applied: boolean;
  }>;
  getPerformanceDashboard(): {
    overview: {
      total_queries: number;
      avg_execution_time_ms: number;
      cache_hit_rate: number;
      optimization_rate: number;
    };
    slow_queries: Array<{
      sql: string;
      execution_time_ms: number;
      optimization_suggestions: string[];
    }>;
    optimization_impact: {
      queries_optimized: number;
      avg_improvement_percent: number;
      total_time_saved_ms: number;
    };
    recommendations: string[];
  };
  private loadOptimizationPatterns;
  private setupPerformanceMonitoring;
  private generateQueryHash;
  private generateQueryKey;
  private analyzeJOINPatterns;
  private optimizeJOINOrder;
  private convertToExplicitJOINs;
  private optimizeJOINConditions;
  private addJOINHints;
  private convertCorrelatedSubqueriesToJOINs;
  private optimizeEXISTSSubqueries;
  private optimizeINSubqueries;
  private materializeExpensiveSubqueries;
  private optimizeWhereClauses;
  private optimizeSelectClauses;
  private addPerformanceHints;
  private extractIndexUsage;
  private extractTableScans;
  private extractRowsExamined;
  private identifyBottlenecks;
  private calculateOptimizationScore;
  private generatePerformanceRecommendations;
  private calculateImprovement;
  private generateOptimizationExplanation;
  private storeOptimization;
  private assessQueryComplexity;
  private recordPerformanceMetrics;
  private cleanQueryCache;
  private analyzeSystemPerformance;
  private generateQuickOptimizationSuggestions;
  private generateSystemRecommendations;
}
export default QueryOptimizationService;
//# sourceMappingURL=QueryOptimizationService.d.ts.map
