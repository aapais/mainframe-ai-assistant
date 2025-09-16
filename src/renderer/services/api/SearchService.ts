/**
 * Search Service
 * Handles all search-related operations with AI fallback and performance optimization
 */

import { BaseService, ServiceResponse, ServiceOptions } from './BaseService';
import { SearchResult, SearchOptions, KBCategory } from '../../../types/services';

export interface SearchQuery {
  query: string;
  category?: KBCategory;
  tags?: string[];
  useAI?: boolean;
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  queryTime: number;
  aiUsed: boolean;
  cacheHit: boolean;
  suggestions?: string[];
}

export interface SearchSuggestion {
  text: string;
  type: 'recent' | 'popular' | 'ai' | 'category' | 'tag';
  frequency?: number;
}

export interface SearchHealthStatus {
  healthy: boolean;
  localSearchAvailable: boolean;
  aiSearchAvailable: boolean;
  averageQueryTime: number;
  message?: string;
}

export class SearchService extends BaseService {
  private searchHistory: string[] = [];
  private popularQueries: Map<string, number> = new Map();

  constructor() {
    super('SearchService');
    this.loadSearchHistory();
    this.setupPerformanceTracking();
  }

  /**
   * Perform search with AI fallback
   */
  async search(
    searchQuery: SearchQuery,
    options: SearchOptions = {},
    serviceOptions: ServiceOptions = {}
  ): Promise<ServiceResponse<SearchResponse>> {
    const startTime = Date.now();
    const { query, category, tags, useAI = true } = searchQuery;
    
    if (!query.trim()) {
      return {
        success: false,
        error: 'Search query cannot be empty',
        metadata: {
          timestamp: new Date(),
          source: 'fallback',
          processingTime: Date.now() - startTime,
        },
      };
    }

    const cacheKey = `search:${JSON.stringify({ query, category, tags, useAI, ...options })}`;
    
    return this.executeWithRetry(
      async () => {
        let results: SearchResult[] = [];
        let aiUsed = false;
        let totalResults = 0;
        let suggestions: string[] = [];

        const electronAPI = this.getElectronAPI();

        // Try AI search first if enabled
        if (useAI && electronAPI.searchWithAI) {
          try {
            const aiResponse = await electronAPI.searchWithAI(query, {
              category,
              tags,
              ...options,
            });

            if (aiResponse?.results) {
              results = aiResponse.results;
              totalResults = aiResponse.totalResults || results.length;
              suggestions = aiResponse.suggestions || [];
              aiUsed = true;
            } else if (Array.isArray(aiResponse)) {
              results = aiResponse;
              totalResults = results.length;
              aiUsed = true;
            }
          } catch (aiError) {
            console.warn('AI search failed, falling back to local:', aiError);
            this.emit('ai-search-failed', { query, error: aiError });
          }
        }

        // Fallback to local search if AI failed or not used
        if (results.length === 0 && electronAPI.searchLocal) {
          try {
            const localResponse = await electronAPI.searchLocal(query, {
              category,
              tags,
              ...options,
            });

            if (localResponse?.results) {
              results = localResponse.results;
              totalResults = localResponse.totalResults || results.length;
            } else if (Array.isArray(localResponse)) {
              results = localResponse;
              totalResults = results.length;
            }
          } catch (localError) {
            throw new Error(`Both AI and local search failed: ${localError instanceof Error ? localError.message : localError}`);
          }
        }

        const queryTime = Date.now() - startTime;

        // Update search history and popularity
        this.addToHistory(query);
        this.updatePopularity(query);

        // Generate additional suggestions if none provided
        if (suggestions.length === 0) {
          suggestions = this.generateSuggestions(query, results);
        }

        const searchResponse: SearchResponse = {
          results,
          totalResults,
          queryTime,
          aiUsed,
          cacheHit: false,
          suggestions,
        };

        this.emit('search-completed', {
          query,
          resultCount: results.length,
          queryTime,
          aiUsed,
        });

        return searchResponse;
      },
      {
        ...serviceOptions,
        cacheOptions: {
          key: cacheKey,
          ttl: useAI ? 300000 : 120000, // 5min for AI, 2min for local
          ...serviceOptions.cacheOptions,
        },
      }
    );
  }

  /**
   * Get search suggestions based on query
   */
  async getSuggestions(
    partialQuery: string,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<SearchSuggestion[]>> {
    const cacheKey = `suggestions:${partialQuery.toLowerCase()}`;
    
    return this.executeWithRetry(
      async () => {
        const suggestions: SearchSuggestion[] = [];
        const query = partialQuery.toLowerCase().trim();

        if (query.length === 0) {
          return this.getDefaultSuggestions();
        }

        // Add matching history items
        const historyMatches = this.searchHistory
          .filter(h => h.toLowerCase().includes(query))
          .slice(0, 5)
          .map(text => ({ text, type: 'recent' as const }));
        suggestions.push(...historyMatches);

        // Add popular queries
        const popularMatches = Array.from(this.popularQueries.entries())
          .filter(([q]) => q.toLowerCase().includes(query))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([text, frequency]) => ({ text, type: 'popular' as const, frequency }));
        suggestions.push(...popularMatches);

        // Add category suggestions
        const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'];
        const categoryMatches = categories
          .filter(cat => cat.toLowerCase().includes(query))
          .map(text => ({ text: `category:${text}`, type: 'category' as const }));
        suggestions.push(...categoryMatches);

        // Get AI suggestions if available
        const electronAPI = this.getElectronAPI();
        if (electronAPI.getSearchSuggestions) {
          try {
            const aiSuggestions = await electronAPI.getSearchSuggestions(partialQuery);
            const mappedSuggestions = aiSuggestions.map(text => ({ 
              text, 
              type: 'ai' as const 
            }));
            suggestions.push(...mappedSuggestions);
          } catch (error) {
            console.warn('Failed to get AI suggestions:', error);
          }
        }

        // Remove duplicates and limit results
        const uniqueSuggestions = suggestions
          .filter((s, i, arr) => arr.findIndex(x => x.text === s.text) === i)
          .slice(0, 10);

        return uniqueSuggestions;
      },
      {
        ...options,
        cacheOptions: {
          key: cacheKey,
          ttl: 60000, // 1 minute cache for suggestions
          ...options.cacheOptions,
        },
      }
    );
  }

  /**
   * Get search history
   */
  getSearchHistory(): string[] {
    return [...this.searchHistory];
  }

  /**
   * Clear search history
   */
  clearSearchHistory(): void {
    this.searchHistory = [];
    this.popularQueries.clear();
    this.saveSearchHistory();
    this.clearCache();
    
    this.emit('history-cleared');
  }

  /**
   * Get popular search queries
   */
  getPopularQueries(limit: number = 10): Array<{ query: string; count: number }> {
    return Array.from(this.popularQueries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }));
  }

  /**
   * Perform semantic search analysis
   */
  async analyzeQuery(
    query: string,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<{
    intent: 'problem-solving' | 'information-seeking' | 'debugging' | 'learning';
    entities: string[];
    keywords: string[];
    confidence: number;
    suggestedCategories: KBCategory[];
  }>> {
    const cacheKey = `analysis:${query}`;
    
    return this.executeWithRetry(
      async () => {
        const electronAPI = this.getElectronAPI();
        
        if (!electronAPI.analyzeSearchQuery) {
          // Fallback to basic analysis
          return this.basicQueryAnalysis(query);
        }

        return await electronAPI.analyzeSearchQuery(query);
      },
      {
        ...options,
        cacheOptions: {
          key: cacheKey,
          ttl: 600000, // 10 minutes cache for analysis
          ...options.cacheOptions,
        },
      }
    );
  }

  /**
   * Health check for search service
   */
  async healthCheck(): Promise<ServiceResponse<SearchHealthStatus>> {
    return this.executeWithRetry(
      async () => {
        if (!this.isElectronAPIAvailable()) {
          return {
            healthy: false,
            localSearchAvailable: false,
            aiSearchAvailable: false,
            averageQueryTime: 0,
            message: 'Electron API not available',
          };
        }

        const electronAPI = this.getElectronAPI();
        const healthStatus: SearchHealthStatus = {
          healthy: false,
          localSearchAvailable: false,
          aiSearchAvailable: false,
          averageQueryTime: 0,
        };

        try {
          // Test local search
          if (electronAPI.searchLocal) {
            await electronAPI.searchLocal('test', { pageSize: 1 });
            healthStatus.localSearchAvailable = true;
          }

          // Test AI search
          if (electronAPI.searchWithAI) {
            try {
              await electronAPI.searchWithAI('test', { pageSize: 1 });
              healthStatus.aiSearchAvailable = true;
            } catch (aiError) {
              console.warn('AI search not available:', aiError);
            }
          }

          healthStatus.healthy = healthStatus.localSearchAvailable;
          healthStatus.averageQueryTime = this.getAverageQueryTime();
          healthStatus.message = healthStatus.healthy ? 
            'Search service operational' : 
            'Search service unavailable';

        } catch (error) {
          healthStatus.message = error instanceof Error ? error.message : 'Health check failed';
        }

        return healthStatus;
      },
      {
        timeout: 5000,
        retries: 1,
        cacheOptions: { skipCache: true },
      }
    );
  }

  /**
   * Private helper methods
   */
  private addToHistory(query: string): void {
    const trimmedQuery = query.trim();
    if (trimmedQuery && !this.searchHistory.includes(trimmedQuery)) {
      this.searchHistory.unshift(trimmedQuery);
      this.searchHistory = this.searchHistory.slice(0, 50); // Keep last 50
      this.saveSearchHistory();
    }
  }

  private updatePopularity(query: string): void {
    const trimmedQuery = query.trim().toLowerCase();
    const current = this.popularQueries.get(trimmedQuery) || 0;
    this.popularQueries.set(trimmedQuery, current + 1);
  }

  private generateSuggestions(query: string, results: SearchResult[]): string[] {
    const suggestions: string[] = [];
    
    // Extract common terms from successful results
    if (results.length > 0) {
      const terms = new Set<string>();
      
      results.slice(0, 5).forEach(result => {
        // Extract keywords from titles and problems
        const text = `${result.entry.title} ${result.entry.problem}`.toLowerCase();
        const words = text.match(/\b[a-z]{3,}\b/g) || [];
        words.forEach(word => {
          if (word !== query.toLowerCase() && word.length > 3) {
            terms.add(word);
          }
        });
      });
      
      suggestions.push(...Array.from(terms).slice(0, 3));
    }

    return suggestions;
  }

  private getDefaultSuggestions(): SearchSuggestion[] {
    const defaultQueries = [
      'S0C7 abend',
      'VSAM Status 35',
      'JCL error',
      'DB2 sqlcode',
      'Batch job failed',
      'File not found',
    ];

    return defaultQueries.map(text => ({ text, type: 'popular' as const }));
  }

  private basicQueryAnalysis(query: string) {
    const intent = this.determineIntent(query);
    const entities = this.extractEntities(query);
    const keywords = this.extractKeywords(query);
    const suggestedCategories = this.suggestCategories(query);
    
    return {
      intent,
      entities,
      keywords,
      confidence: 0.7, // Basic analysis has lower confidence
      suggestedCategories,
    };
  }

  private determineIntent(query: string): 'problem-solving' | 'information-seeking' | 'debugging' | 'learning' {
    const problemWords = ['error', 'abend', 'fail', 'issue', 'problem', 'fix', 'solve'];
    const debugWords = ['debug', 'trace', 'step', 'analyze'];
    const learnWords = ['how', 'what', 'why', 'learn', 'understand'];
    
    const lowerQuery = query.toLowerCase();
    
    if (problemWords.some(word => lowerQuery.includes(word))) return 'problem-solving';
    if (debugWords.some(word => lowerQuery.includes(word))) return 'debugging';
    if (learnWords.some(word => lowerQuery.includes(word))) return 'learning';
    
    return 'information-seeking';
  }

  private extractEntities(query: string): string[] {
    const errorCodes = query.match(/S0C\d|U\d{4}|IEF\d{3}[A-Z]|SQLCODE\s*-?\d+/gi) || [];
    const systems = query.match(/\b(VSAM|DB2|JCL|COBOL|CICS|IMS|TSO|ISPF)\b/gi) || [];
    
    return [...errorCodes, ...systems];
  }

  private extractKeywords(query: string): string[] {
    return query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !['the', 'and', 'for', 'with', 'are', 'this'].includes(word))
      .slice(0, 10);
  }

  private suggestCategories(query: string): KBCategory[] {
    const categoryKeywords: Record<KBCategory, string[]> = {
      'JCL': ['jcl', 'job', 'step', 'dd', 'dsn', 'disp'],
      'VSAM': ['vsam', 'file', 'dataset', 'status'],
      'DB2': ['db2', 'sql', 'table', 'cursor', 'sqlcode'],
      'Batch': ['batch', 'abend', 'program', 'cobol'],
      'Functional': ['functional', 'business', 'process'],
      'Other': [],
    };

    const lowerQuery = query.toLowerCase();
    const suggestions: KBCategory[] = [];

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        suggestions.push(category as KBCategory);
      }
    }

    return suggestions.length > 0 ? suggestions : ['Other'];
  }

  private loadSearchHistory(): void {
    try {
      const saved = localStorage.getItem('search-history');
      if (saved) {
        this.searchHistory = JSON.parse(saved);
      }
      
      const savedPopular = localStorage.getItem('popular-queries');
      if (savedPopular) {
        const popular = JSON.parse(savedPopular);
        this.popularQueries = new Map(popular);
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
    }
  }

  private saveSearchHistory(): void {
    try {
      localStorage.setItem('search-history', JSON.stringify(this.searchHistory));
      localStorage.setItem('popular-queries', JSON.stringify(Array.from(this.popularQueries.entries())));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }

  private queryTimes: number[] = [];

  private setupPerformanceTracking(): void {
    this.on('search-completed', ({ queryTime }) => {
      this.queryTimes.push(queryTime);
      if (this.queryTimes.length > 100) {
        this.queryTimes = this.queryTimes.slice(-50); // Keep last 50 measurements
      }
    });
  }

  private getAverageQueryTime(): number {
    if (this.queryTimes.length === 0) return 0;
    return this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.saveSearchHistory();
    super.cleanup();
  }
}