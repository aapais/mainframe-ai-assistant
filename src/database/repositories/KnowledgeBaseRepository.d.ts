import Database from 'better-sqlite3';
import {
  KBEntry,
  CreateKBEntry,
  UpdateKBEntry,
  SearchQuery,
  SearchResult,
  SearchWithFacets,
  EntryFeedback,
  UsageMetric,
  SearchHistory,
  DatabaseStats,
  KBCategory,
} from '../schemas/KnowledgeBase.schema';
import { SearchOptions } from '../schemas/PerformanceOptimization.schema';
import { AppError } from '../../core/errors/AppError';
export interface RepositoryResult<T> {
  success: boolean;
  data?: T;
  error?: AppError;
  metadata?: {
    executionTime: number;
    cacheHit: boolean;
    affectedRows?: number;
    queryHash?: string;
  };
}
export interface IRepository<T, CreateT = Omit<T, 'id'>, UpdateT = Partial<T>> {
  findById(id: string): Promise<RepositoryResult<T>>;
  findAll(options?: { limit?: number; offset?: number }): Promise<RepositoryResult<T[]>>;
  create(data: CreateT): Promise<RepositoryResult<T>>;
  update(id: string, data: UpdateT): Promise<RepositoryResult<T>>;
  delete(id: string): Promise<RepositoryResult<void>>;
  count(filters?: any): Promise<RepositoryResult<number>>;
}
export interface IKnowledgeBaseRepository
  extends IRepository<KBEntry, CreateKBEntry, UpdateKBEntry> {
  search(query: SearchQuery): Promise<RepositoryResult<SearchResult[]>>;
  searchWithFacets(query: SearchQuery): Promise<RepositoryResult<SearchWithFacets>>;
  autoComplete(
    query: string,
    limit?: number
  ): Promise<
    RepositoryResult<
      Array<{
        suggestion: string;
        category: string;
        score: number;
      }>
    >
  >;
  findByCategory(
    category: KBCategory,
    options?: SearchOptions
  ): Promise<RepositoryResult<SearchResult[]>>;
  findByTags(tags: string[], options?: SearchOptions): Promise<RepositoryResult<SearchResult[]>>;
  getAllCategories(): Promise<
    RepositoryResult<
      Array<{
        name: string;
        count: number;
      }>
    >
  >;
  getAllTags(): Promise<
    RepositoryResult<
      Array<{
        name: string;
        count: number;
      }>
    >
  >;
  getStatistics(): Promise<RepositoryResult<DatabaseStats>>;
  getPopularEntries(limit?: number): Promise<RepositoryResult<SearchResult[]>>;
  getRecentEntries(limit?: number): Promise<RepositoryResult<SearchResult[]>>;
  recordFeedback(feedback: EntryFeedback): Promise<RepositoryResult<string>>;
  recordUsage(metric: UsageMetric): Promise<RepositoryResult<void>>;
  recordSearch(history: SearchHistory): Promise<RepositoryResult<void>>;
  bulkCreate(entries: CreateKBEntry[]): Promise<RepositoryResult<string[]>>;
  bulkUpdate(
    updates: Array<{
      id: string;
      data: UpdateKBEntry;
    }>
  ): Promise<RepositoryResult<void>>;
  bulkDelete(ids: string[]): Promise<RepositoryResult<void>>;
}
export declare class KnowledgeBaseRepository implements IKnowledgeBaseRepository {
  private db;
  private readonly statements;
  constructor(database: Database.Database);
  private initializePreparedStatements;
  findById(id: string): Promise<RepositoryResult<KBEntry>>;
  findAll(options?: { limit?: number; offset?: number }): Promise<RepositoryResult<KBEntry[]>>;
  create(data: CreateKBEntry): Promise<RepositoryResult<KBEntry>>;
  update(id: string, data: UpdateKBEntry): Promise<RepositoryResult<KBEntry>>;
  delete(id: string): Promise<RepositoryResult<void>>;
  count(filters?: any): Promise<RepositoryResult<number>>;
  search(query: SearchQuery): Promise<RepositoryResult<SearchResult[]>>;
  searchWithFacets(query: SearchQuery): Promise<RepositoryResult<SearchWithFacets>>;
  autoComplete(
    query: string,
    limit?: number
  ): Promise<
    RepositoryResult<
      Array<{
        suggestion: string;
        category: string;
        score: number;
      }>
    >
  >;
  findByCategory(
    category: KBCategory,
    options?: SearchOptions
  ): Promise<RepositoryResult<SearchResult[]>>;
  findByTags(tags: string[], options?: SearchOptions): Promise<RepositoryResult<SearchResult[]>>;
  getAllCategories(): Promise<
    RepositoryResult<
      Array<{
        name: string;
        count: number;
      }>
    >
  >;
  getAllTags(): Promise<
    RepositoryResult<
      Array<{
        name: string;
        count: number;
      }>
    >
  >;
  getStatistics(): Promise<RepositoryResult<DatabaseStats>>;
  getPopularEntries(limit?: number): Promise<RepositoryResult<SearchResult[]>>;
  getRecentEntries(limit?: number): Promise<RepositoryResult<SearchResult[]>>;
  recordFeedback(feedback: EntryFeedback): Promise<RepositoryResult<string>>;
  recordUsage(metric: UsageMetric): Promise<RepositoryResult<void>>;
  recordSearch(history: SearchHistory): Promise<RepositoryResult<void>>;
  bulkCreate(entries: CreateKBEntry[]): Promise<RepositoryResult<string[]>>;
  bulkUpdate(
    updates: Array<{
      id: string;
      data: UpdateKBEntry;
    }>
  ): Promise<RepositoryResult<void>>;
  bulkDelete(ids: string[]): Promise<RepositoryResult<void>>;
  private executeWithMetrics;
  private transformRowToKBEntry;
  private updateFTSIndex;
  private determineSearchStrategy;
  private executeFTSSearch;
  private prepareFTSQuery;
  private generateHighlights;
  private normalizeQuery;
  private extractFilters;
  private calculateFacets;
  private getBasicStats;
  private getSeverityStats;
  private arrayToRecord;
  private getDiskUsage;
  private generateQueryHash;
  cleanup(): Promise<void>;
}
export default KnowledgeBaseRepository;
//# sourceMappingURL=KnowledgeBaseRepository.d.ts.map
