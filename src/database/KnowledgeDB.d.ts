import { SearchOptions } from './QueryOptimizer';
export interface KBEntry {
  id?: string;
  title: string;
  problem: string;
  solution: string;
  category: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  tags?: string[];
  created_at?: Date;
  updated_at?: Date;
  created_by?: string;
  usage_count?: number;
  success_count?: number;
  failure_count?: number;
  last_used?: Date;
  archived?: boolean;
}
export interface SearchResult {
  entry: KBEntry;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'ai' | 'category' | 'tag';
  highlights?: string[];
}
export interface DatabaseStats {
  totalEntries: number;
  categoryCounts: Record<string, number>;
  recentActivity: number;
  searchesToday: number;
  averageSuccessRate: number;
  topEntries: Array<{
    title: string;
    usage_count: number;
  }>;
  diskUsage: number;
  performance: {
    avgSearchTime: number;
    cacheHitRate: number;
  };
}
export declare class KnowledgeDB {
  private db;
  private migrationManager;
  private queryOptimizer;
  private performanceTuner;
  private backupManager;
  private dataSeeder;
  private advancedIndexStrategy;
  private queryCache;
  private connectionPool;
  private performanceMonitor;
  private initialized;
  constructor(
    dbPath?: string,
    options?: {
      backupDir?: string;
      maxBackups?: number;
      autoBackup?: boolean;
      backupInterval?: number;
    }
  );
  private initialize;
  addEntry(entry: KBEntry, userId?: string): Promise<string>;
  updateEntry(id: string, updates: Partial<KBEntry>, userId?: string): Promise<void>;
  search(
    query: string,
    options?: Partial<
      SearchOptions & {
        streaming?: boolean;
        fuzzyThreshold?: number;
        enableAutoComplete?: boolean;
      }
    >
  ): Promise<SearchResult[]>;
  autoComplete(
    query: string,
    limit?: number
  ): Promise<
    Array<{
      suggestion: string;
      category: string;
      score: number;
    }>
  >;
  searchWithFacets(
    query: string,
    options?: Partial<SearchOptions>
  ): Promise<{
    results: SearchResult[];
    facets: {
      categories: Array<{
        name: string;
        count: number;
      }>;
      tags: Array<{
        name: string;
        count: number;
      }>;
      severities: Array<{
        name: string;
        count: number;
      }>;
    };
    totalCount: number;
  }>;
  getEntry(id: string): Promise<KBEntry | null>;
  recordUsage(entryId: string, successful: boolean, userId?: string): Promise<void>;
  getPopular(limit?: number): Promise<SearchResult[]>;
  getRecent(limit?: number): Promise<SearchResult[]>;
  getStats(): Promise<DatabaseStats>;
  createBackup(): Promise<void>;
  restoreFromBackup(backupPath?: string): Promise<void>;
  exportToJSON(outputPath: string): Promise<void>;
  importFromJSON(jsonPath: string, mergeMode?: boolean): Promise<void>;
  getConfig(key: string): string | null;
  setConfig(key: string, value: string, type?: string, description?: string): Promise<void>;
  getEntryCount(): number;
  optimize(): Promise<void>;
  getRecommendations(): string[];
  getPerformanceStatus(): any;
  generatePerformanceReport(startTime?: number, endTime?: number): any;
  getPerformanceTrends(hours?: number): any;
  getSlowQueries(limit?: number): any;
  getCacheStats(): any;
  getConnectionPoolStats(): any;
  getIndexAnalysis(): any;
  getIndexMaintenanceReport(): any;
  optimizeIndexes(): Promise<any>;
  preWarmCache(): Promise<void>;
  invalidateCache(pattern?: string, tags?: string[]): Promise<number>;
  healthCheck(): Promise<{
    overall: boolean;
    database: boolean;
    cache: boolean;
    connections: boolean;
    performance: boolean;
    issues: string[];
  }>;
  close(): Promise<void>;
  private ensureInitialized;
  private logSearch;
  private normalizeQuery;
  private generateSearchCacheKey;
  private selectSearchStrategy;
  private executeHybridSearch;
  private executeExactSearch;
  private executeFTSSearch;
  private executeFuzzySearch;
  private executeCategorySearch;
  private executeTagSearch;
  private executeMultiStrategySearch;
  private calculateRelevanceScore;
  private generateAdvancedHighlights;
  private calculateQueryComplexity;
  private calculateCacheTTL;
  private generateCacheTags;
  private getCachePriority;
  private calculateFacets;
  private prepareFTSQuery;
  private extractHighlights;
  private getDiskUsage;
  private logInitializationStats;
  private formatBytes;
}
export declare function createKnowledgeDB(
  dbPath?: string,
  options?: {
    backupDir?: string;
    maxBackups?: number;
    autoBackup?: boolean;
    backupInterval?: number;
  }
): Promise<KnowledgeDB>;
//# sourceMappingURL=KnowledgeDB.d.ts.map
