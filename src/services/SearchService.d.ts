import {
  ISearchService,
  SearchResult,
  SearchOptions,
  SearchQuery,
  PopularSearch,
  KBEntry,
  GeminiConfig,
} from '../types/services';
export declare class SearchService implements ISearchService {
  private geminiConfig?;
  private database?;
  private cacheManager?;
  private searchHistory;
  private popularSearches;
  private searchIndex;
  private instantCache;
  private queryOptimizationCache;
  private performanceMetrics;
  constructor(
    geminiConfig?: GeminiConfig | undefined,
    database?: any | undefined,
    cacheManager?: any | undefined
  );
  search(query: string, entries: KBEntry[], options?: SearchOptions): Promise<SearchResult[]>;
  searchWithAI(query: string, entries: KBEntry[], options?: SearchOptions): Promise<SearchResult[]>;
  suggest(query: string, limit?: number): Promise<string[]>;
  explain(query: string, result: SearchResult): Promise<string>;
  getRecentSearches(limit?: number): Promise<SearchQuery[]>;
  getPopularSearches(limit?: number): Promise<PopularSearch[]>;
  buildIndex(entries: KBEntry[]): Promise<void>;
  optimizeIndex(): Promise<void>;
  private initializeOptimizations;
  private startPerformanceMonitoring;
  private generateInstantCacheKey;
  private getFromInstantCache;
  private setInInstantCache;
  private cleanupInstantCache;
  private recordPerformanceMetric;
  private analyzePerformanceMetrics;
  private preWarmOptimizationCache;
  private optimizeFTSQuery;
  getPerformanceMetrics(): {
    instantCacheHitRate: number;
    averageSearchTime: number;
    p95SearchTime: number;
    queryOptimizationCacheSize: number;
    recentPerformance: {
      operation: string;
      avg: number;
      p95: number;
    }[];
  };
  private performOptimizedFTSSearch;
  private parseFTSHighlights;
  private intelligentMergeResults;
  private applyAdvancedRanking;
  private streamOptimizedResults;
  private addEnhancedHighlights;
  private recordEnhancedSearch;
  private detectQueryIntent;
  private calculateRecentSuccessBoost;
  private calculateContextBoost;
  private calculateSemanticBoost;
  private generateContextualHighlights;
  private performLocalSearch;
  private performAISearch;
  private buildAISearchPrompt;
  private parseAIResponse;
  private calculateLocalScore;
  private tokenizeQuery;
  private determineMatchType;
  private findFuzzyMatches;
  private calculateStringSimilarity;
  private levenshteinDistance;
  private mergeSearchResults;
  private filterAndSortResults;
  private addHighlights;
  private findHighlightsInText;
  private recordSearch;
}
export default SearchService;
//# sourceMappingURL=SearchService.d.ts.map
