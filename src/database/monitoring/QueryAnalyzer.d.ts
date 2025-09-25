import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
export interface QueryPlan {
  id: number;
  parent: number;
  notused: number;
  detail: string;
}
export interface QueryAnalysis {
  query: string;
  queryHash: string;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP' | 'OTHER';
  executionPlan: QueryPlan[];
  indexUsage: {
    indexesUsed: string[];
    indexesAvailable: string[];
    tablesScanned: string[];
    scanType: 'table_scan' | 'index_scan' | 'index_seek' | 'mixed';
  };
  performance: {
    estimatedCost: number;
    estimatedRows: number;
    complexity: 'low' | 'medium' | 'high' | 'very_high';
  };
  optimizationSuggestions: OptimizationSuggestion[];
  timestamp: number;
}
export interface OptimizationSuggestion {
  type: 'index' | 'query_rewrite' | 'schema' | 'configuration';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: number;
}
export interface IndexRecommendation {
  tableName: string;
  columns: string[];
  indexType: 'btree' | 'unique' | 'partial' | 'expression';
  rationale: string;
  estimatedImpact: number;
  queryPatterns: string[];
  creationSQL: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}
export interface SlowQuery {
  query: string;
  queryHash: string;
  occurrences: number;
  totalDuration: number;
  avgDuration: number;
  maxDuration: number;
  lastSeen: number;
  analysis?: QueryAnalysis;
}
export interface AnalyzerConfig {
  enabled: boolean;
  analysisThreshold: number;
  captureSlowQueries: boolean;
  generateRecommendations: boolean;
  trackQueryPatterns: boolean;
  maxQueryHistory: number;
  autoIndexCreation: boolean;
  indexCreationThreshold: number;
}
export declare class QueryAnalyzer extends EventEmitter {
  private db;
  private config;
  private queryHistory;
  private analyzedQueries;
  private indexRecommendations;
  private tableSchemas;
  constructor(db: Database.Database, config?: Partial<AnalyzerConfig>);
  private buildConfig;
  private initializeAnalyzer;
  private createAnalyzerTables;
  private loadTableSchemas;
  private loadQueryHistory;
  analyzeQuery(
    query: string,
    duration: number,
    metadata?: {
      timestamp?: number;
      operationType?: string;
      recordsAffected?: number;
    }
  ): QueryAnalysis;
  private createBasicAnalysis;
  private performFullAnalysis;
  private getExecutionPlan;
  private analyzeIndexUsage;
  private calculatePerformanceMetrics;
  private generateOptimizationSuggestions;
  private getQueryType;
  private updateQueryHistory;
  private logSlowQuery;
  private storeAnalysis;
  private generateOptimizationRecommendations;
  private generateIndexRecommendations;
  private extractTableNames;
  private extractWhereColumns;
  private isValidColumn;
  private trackQueryPattern;
  private normalizeQueryForPattern;
  private addIndexRecommendation;
  private hashQuery;
  getSlowQueries(limit?: number): SlowQuery[];
  getQueryAnalysis(queryHash: string): QueryAnalysis | null;
  getIndexRecommendations(priority?: 'low' | 'medium' | 'high' | 'critical'): IndexRecommendation[];
  getQueryPatterns(limit?: number): Array<{
    pattern: string;
    occurrences: number;
    avgDuration: number;
    tableNames: string[];
    lastSeen: number;
  }>;
  implementIndexRecommendation(
    recommendationId: string,
    execute?: boolean
  ): {
    success: boolean;
    error?: string;
    sql?: string;
  };
  getAnalyzerStats(): {
    totalQueries: number;
    slowQueries: number;
    analyzedQueries: number;
    pendingRecommendations: number;
    implementedRecommendations: number;
    avgAnalysisTime: number;
  };
  destroy(): void;
}
//# sourceMappingURL=QueryAnalyzer.d.ts.map
