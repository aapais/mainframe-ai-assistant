import Database from 'better-sqlite3';
import {
  KBEntry,
  CreateKBEntry,
  UpdateKBEntry,
  SearchQuery,
  SearchResult,
  SearchWithFacets,
  EntryFeedback,
  DatabaseStats,
} from '../schemas/KnowledgeBase.schema';
import { AppError } from '../../core/errors/AppError';
import { PerformanceMonitor } from '../PerformanceMonitor';
import { QueryOptimizer } from '../QueryOptimizer';
export interface DatabaseResult<T> {
  success: boolean;
  data?: T;
  error?: AppError;
  performance?: {
    executionTime: number;
    queriesExecuted: number;
    cacheHit: boolean;
  };
}
export declare class KnowledgeBaseModel {
  private db;
  private performanceMonitor;
  private queryOptimizer;
  private readonly statements;
  constructor(
    db: Database.Database,
    performanceMonitor: PerformanceMonitor,
    queryOptimizer: QueryOptimizer
  );
  private initializePreparedStatements;
  createEntry(entryData: CreateKBEntry, userId?: string): Promise<DatabaseResult<string>>;
  updateEntry(id: string, updates: UpdateKBEntry, userId?: string): Promise<DatabaseResult<void>>;
  getEntryById(id: string): Promise<DatabaseResult<KBEntry>>;
  deleteEntry(id: string, userId?: string): Promise<DatabaseResult<void>>;
  search(searchQuery: SearchQuery): Promise<DatabaseResult<SearchResult[]>>;
  searchWithFacets(searchQuery: SearchQuery): Promise<DatabaseResult<SearchWithFacets>>;
  recordFeedback(feedback: EntryFeedback): Promise<DatabaseResult<string>>;
  private logUsageMetric;
  private logSearchHistory;
  getStatistics(): Promise<DatabaseResult<DatabaseStats>>;
  private executeWithPerformanceTracking;
  private transformRowToKBEntry;
  private updateFTSIndex;
  private updateEntryMetrics;
  private determineMatchType;
  private generateHighlights;
  private normalizeQuery;
  private extractFilters;
  private calculateFacets;
  private getDiskUsage;
  private checkHealth;
  cleanup(): Promise<void>;
}
export default KnowledgeBaseModel;
//# sourceMappingURL=KnowledgeBaseModel.d.ts.map
