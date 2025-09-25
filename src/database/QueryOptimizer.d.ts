import Database from 'better-sqlite3';
export interface QueryStats {
  query: string;
  executionTimeMs: number;
  rowsExamined: number;
  rowsReturned: number;
  planSteps: string[];
}
export interface SearchOptions {
  query: string;
  category?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'usage' | 'date' | 'success_rate';
  includeArchived?: boolean;
}
export declare class QueryOptimizer {
  private db;
  private preparedQueries;
  constructor(db: Database.Database);
  private initializePreparedStatements;
  search(options: SearchOptions): Promise<{
    results: any[];
    totalCount: number;
    executionTime: number;
    strategy: string;
  }>;
  findSimilar(entryId: string, content: string, limit?: number): any[];
  getById(id: string): any | null;
  getPopular(limit?: number): any[];
  getRecent(limit?: number): any[];
  analyzeQuery(sql: string): QueryStats;
  optimize(): void;
  private prepareFTSQuery;
  private getTotalCount;
  private extractRowsExamined;
  private checkIndexUsage;
  getPerformanceStats(): {
    avgSearchTime: number;
    slowQueries: number;
    totalSearches: number;
    cacheHitRate: number;
  };
}
//# sourceMappingURL=QueryOptimizer.d.ts.map
