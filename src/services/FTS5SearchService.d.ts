import { EventEmitter } from 'events';
import { FTS5SearchOptions, PaginatedSearchResponse, SearchServiceConfig } from '../types/services';
export interface FTS5DatabaseSchema {
  kb_entries: {
    id: string;
    title: string;
    problem: string;
    solution: string;
    category: string;
    tags: string;
    created_at: string;
    updated_at: string;
    usage_count: number;
    success_count: number;
    failure_count: number;
  };
  kb_fts: {
    id: string;
    title: string;
    problem: string;
    solution: string;
    tags: string;
    category: string;
  };
}
export interface RankingWeights {
  title: number;
  problem: number;
  solution: number;
  tags: number;
  category: number;
  usage: number;
  recency: number;
  success_rate: number;
}
export interface SearchDebugInfo {
  query_parsing_time: number;
  fts_execution_time: number;
  ranking_time: number;
  total_time: number;
  cache_hit: boolean;
  query_rewrite: string;
  results_count: number;
  index_used: string;
}
export declare class FTS5SearchService extends EventEmitter {
  private db;
  private queryParser;
  private config;
  private cache;
  private stats;
  private statements;
  constructor(config: SearchServiceConfig);
  search(query: string, options?: FTS5SearchOptions): Promise<PaginatedSearchResponse>;
  getSuggestions(partialQuery: string, limit?: number): Promise<string[]>;
  getSearchStats(): {
    total_searches: number;
    cache_hit_rate: number;
    avg_response_time: number;
    error_rate: number;
    index_stats: any;
  };
  rebuildIndex(): Promise<void>;
  close(): Promise<void>;
  private initializeDatabase;
  private createFTSSchema;
  private prepareStatements;
  private normalizeOptions;
  private executeSearch;
  private buildRankedFTSQuery;
  private processSearchResults;
  private calculateEnhancedScore;
  private analyzeFieldMatches;
  private generateSnippet;
  private determineMatchType;
  private extractHighlights;
  private calculatePagination;
  private generateFacets;
  private generateCacheKey;
  private getFromCache;
  private setInCache;
  private setupCacheCleanup;
  private updateAverageResponseTime;
  private getIndexStats;
}
//# sourceMappingURL=FTS5SearchService.d.ts.map
