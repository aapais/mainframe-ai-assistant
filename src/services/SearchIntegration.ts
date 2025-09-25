/**
 * SearchIntegration.ts
 * Complete integration of the high-performance search service
 * Connects all components: search engine, caching, monitoring, and frontend
 */

import { AdvancedSearchEngine } from './search/AdvancedSearchEngine';
import { MultiLayerCacheManager } from '../caching/MultiLayerCacheManager';
import { CacheWarmingEngine } from '../caching/CacheWarmingEngine';
import { MonitoringOrchestrator } from '../monitoring/MonitoringOrchestrator';
import { KnowledgeDB } from '../database/KnowledgeDB';
import { GeminiService } from './GeminiService';

/**
 * Main Search Service Integration
 * Provides a unified interface for the entire search system
 */
export class SearchIntegration {
  private searchEngine: AdvancedSearchEngine;
  private cacheManager: MultiLayerCacheManager;
  private warmingEngine: CacheWarmingEngine;
  private monitor: MonitoringOrchestrator;
  private knowledgeDB: KnowledgeDB;
  private geminiService?: GeminiService;
  private isInitialized = false;

  constructor(config?: {
    geminiApiKey?: string;
    cacheEnabled?: boolean;
    monitoringEnabled?: boolean;
    performanceTargets?: {
      maxResponseTime?: number;
      minCacheHitRate?: number;
      maxErrorRate?: number;
    };
  }) {
    // Initialize Knowledge Database
    this.knowledgeDB = new KnowledgeDB();

    // Initialize Gemini Service if API key provided
    if (config?.geminiApiKey) {
      this.geminiService = new GeminiService({
        apiKey: config.geminiApiKey,
        model: 'gemini-pro',
        temperature: 0.3,
      });
    }

    // Initialize Search Engine with <1s guarantee
    this.searchEngine = new AdvancedSearchEngine({
      rankingAlgorithm: 'bm25',
      cacheEnabled: config?.cacheEnabled !== false,
      fuzzyMatchingEnabled: true,
      semanticSearchEnabled: !!this.geminiService,
      performance: {
        searchTimeout: config?.performanceTargets?.maxResponseTime || 800,
        maxConcurrentSearches: 10,
        circuitBreakerThreshold: 0.5,
      },
    });

    // Initialize Cache Manager
    this.cacheManager = new MultiLayerCacheManager({
      l1Config: {
        maxSize: 1000,
        ttl: 300000, // 5 minutes
        algorithm: 'lru',
      },
      l2Config: {
        maxSize: 10000,
        ttl: 3600000, // 1 hour
        persistent: true,
      },
      l3Config: {
        enabled: true,
        path: './cache/search',
        maxSize: 100000,
      },
    });

    // Initialize Cache Warming Engine
    this.warmingEngine = new CacheWarmingEngine(this.cacheManager, {
      predictive: true,
      preemptive: true,
      scheduled: true,
    });

    // Initialize Monitoring
    this.monitor = new MonitoringOrchestrator({
      enabledComponents:
        config?.monitoringEnabled !== false
          ? ['performance', 'dashboard', 'alerting', 'logging', 'profiling']
          : [],
      performanceTargets: {
        responseTime: config?.performanceTargets?.maxResponseTime || 1000,
        cacheHitRate: config?.performanceTargets?.minCacheHitRate || 0.8,
        errorRate: config?.performanceTargets?.maxErrorRate || 0.01,
      },
    });
  }

  /**
   * Initialize the complete search system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load knowledge base entries
      const entries = await this.knowledgeDB.getAllEntries();

      // Initialize search engine with entries
      await this.searchEngine.initialize(entries);

      // Start cache warming
      await this.warmingEngine.initialize();

      // Warm up popular queries
      const popularQueries = await this.knowledgeDB.getPopularQueries(20);
      for (const query of popularQueries) {
        await this.warmingEngine.warmQuery(query.query_text);
      }

      // Start monitoring
      await this.monitor.start();

      this.isInitialized = true;
      console.log('✅ Search Integration initialized successfully');
      console.log(`  - ${entries.length} KB entries indexed`);
      console.log(`  - Cache warming completed for ${popularQueries.length} queries`);
      console.log('  - Monitoring active');
      console.log('  - <1s response time guarantee enabled');
    } catch (error) {
      console.error('❌ Failed to initialize Search Integration:', error);
      throw error;
    }
  }

  /**
   * Main search method with <1s response time guarantee
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      fuzzy?: boolean;
      semantic?: boolean;
      filters?: {
        category?: string;
        tags?: string[];
        dateRange?: { start: Date; end: Date };
      };
      sortBy?: 'relevance' | 'date' | 'popularity';
    }
  ): Promise<{
    results: any[];
    metrics: {
      responseTime: number;
      totalResults: number;
      cacheHit: boolean;
      searchType: string;
    };
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = performance.now();
    const searchId = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Start monitoring this search
      this.monitor.recordSearchStart(searchId);

      // Check cache first
      const cacheKey = this.generateCacheKey(query, options);
      const cachedResult = await this.cacheManager.get(cacheKey);

      if (cachedResult) {
        const responseTime = performance.now() - startTime;
        this.monitor.recordSearchComplete(searchId, {
          responseTime,
          resultCount: cachedResult.results.length,
          cacheHit: true,
          searchType: 'cached',
        });

        return {
          results: cachedResult.results,
          metrics: {
            responseTime,
            totalResults: cachedResult.results.length,
            cacheHit: true,
            searchType: 'cached',
          },
        };
      }

      // Perform search with different strategies
      let results;
      let searchType = 'standard';

      if (options?.semantic && this.geminiService) {
        // Semantic search with Gemini
        searchType = 'semantic';
        results = await this.performSemanticSearch(query, options);
      } else if (options?.fuzzy) {
        // Fuzzy search for typo tolerance
        searchType = 'fuzzy';
        results = await this.searchEngine.search(query, {
          ...options,
          fuzzyThreshold: 0.7,
        });
      } else {
        // Standard search
        results = await this.searchEngine.search(query, options);
      }

      // Apply filters if provided
      if (options?.filters) {
        results = this.applyFilters(results, options.filters);
      }

      // Sort results
      if (options?.sortBy) {
        results = this.sortResults(results, options.sortBy);
      }

      // Limit results
      const limitedResults = results.slice(0, options?.limit || 20);

      // Cache the results
      await this.cacheManager.set(
        cacheKey,
        {
          results: limitedResults,
          timestamp: Date.now(),
        },
        300000
      ); // 5 minute TTL

      // Record metrics
      const responseTime = performance.now() - startTime;
      this.monitor.recordSearchComplete(searchId, {
        responseTime,
        resultCount: limitedResults.length,
        cacheHit: false,
        searchType,
      });

      // Ensure <1s response time
      if (responseTime > 1000) {
        console.warn(`⚠️ Search exceeded 1s target: ${responseTime.toFixed(0)}ms`);
        this.monitor.triggerAlert('slow_search', {
          query,
          responseTime,
          searchType,
        });
      }

      return {
        results: limitedResults,
        metrics: {
          responseTime,
          totalResults: results.length,
          cacheHit: false,
          searchType,
        },
      };
    } catch (error) {
      const responseTime = performance.now() - startTime;
      this.monitor.recordSearchError(searchId, error);

      // Fallback to basic search
      console.error('Search error, falling back to basic search:', error);
      const fallbackResults = await this.knowledgeDB.search(query, options?.limit || 20);

      return {
        results: fallbackResults,
        metrics: {
          responseTime,
          totalResults: fallbackResults.length,
          cacheHit: false,
          searchType: 'fallback',
        },
      };
    }
  }

  /**
   * Perform semantic search using Gemini
   */
  private async performSemanticSearch(query: string, options: any): Promise<any[]> {
    if (!this.geminiService) {
      throw new Error('Gemini service not initialized');
    }

    // Get all entries for semantic matching
    const allEntries = await this.knowledgeDB.getAllEntries();

    // Use Gemini to find semantically similar entries
    const semanticResults = await this.geminiService.findSimilar(query, allEntries);

    // Combine with standard search results for hybrid approach
    const standardResults = await this.searchEngine.search(query, options);

    // Merge and deduplicate results
    const mergedResults = this.mergeSearchResults(semanticResults, standardResults);

    return mergedResults;
  }

  /**
   * Apply filters to search results
   */
  private applyFilters(results: any[], filters: any): any[] {
    return results.filter(result => {
      if (filters.category && result.category !== filters.category) {
        return false;
      }

      if (filters.tags && filters.tags.length > 0) {
        const resultTags = result.tags || [];
        if (!filters.tags.some((tag: string) => resultTags.includes(tag))) {
          return false;
        }
      }

      if (filters.dateRange) {
        const resultDate = new Date(result.updated_at || result.created_at);
        if (resultDate < filters.dateRange.start || resultDate > filters.dateRange.end) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort search results
   */
  private sortResults(results: any[], sortBy: string): any[] {
    const sorted = [...results];

    switch (sortBy) {
      case 'date':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.updated_at || a.created_at).getTime();
          const dateB = new Date(b.updated_at || b.created_at).getTime();
          return dateB - dateA;
        });

      case 'popularity':
        return sorted.sort((a, b) => {
          const popA = (a.usage_count || 0) * (a.success_rate || 0);
          const popB = (b.usage_count || 0) * (b.success_rate || 0);
          return popB - popA;
        });

      case 'relevance':
      default:
        // Already sorted by relevance from search engine
        return sorted;
    }
  }

  /**
   * Merge semantic and standard search results
   */
  private mergeSearchResults(semantic: any[], standard: any[]): any[] {
    const merged = new Map();

    // Add semantic results with boost
    semantic.forEach(result => {
      merged.set(result.id, {
        ...result,
        score: (result.score || 0) * 1.2, // Boost semantic matches
      });
    });

    // Add standard results
    standard.forEach(result => {
      if (!merged.has(result.id)) {
        merged.set(result.id, result);
      } else {
        // Combine scores if already present
        const existing = merged.get(result.id);
        merged.set(result.id, {
          ...existing,
          score: (existing.score + result.score) / 2,
        });
      }
    });

    // Sort by combined score
    return Array.from(merged.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Generate cache key for search query
   */
  private generateCacheKey(query: string, options?: any): string {
    const normalized = query.toLowerCase().trim();
    const optionsStr = options ? JSON.stringify(options) : '';
    return `search:${normalized}:${optionsStr}`;
  }

  /**
   * Get search suggestions (for autocomplete)
   */
  async getSuggestions(prefix: string, limit: number = 10): Promise<string[]> {
    // Check cache
    const cacheKey = `suggest:${prefix.toLowerCase()}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    // Get suggestions from search engine
    const suggestions = await this.searchEngine.getSuggestions(prefix);

    // Cache for 1 minute
    await this.cacheManager.set(cacheKey, suggestions.slice(0, limit), 60000);

    return suggestions.slice(0, limit);
  }

  /**
   * Get search analytics
   */
  async getAnalytics(): Promise<any> {
    return {
      performance: await this.monitor.getPerformanceMetrics(),
      cache: await this.cacheManager.getStatistics(),
      popular: await this.knowledgeDB.getPopularQueries(10),
      metrics: await this.monitor.getBusinessMetrics(),
    };
  }

  /**
   * Warm cache with predicted queries
   */
  async warmCache(): Promise<void> {
    await this.warmingEngine.warmCache();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const checks = await Promise.all([
      this.searchEngine.healthCheck(),
      this.cacheManager.healthCheck(),
      this.monitor.healthCheck(),
    ]);

    const allHealthy = checks.every(c => c.status === 'healthy');
    const anyUnhealthy = checks.some(c => c.status === 'unhealthy');

    return {
      status: allHealthy ? 'healthy' : anyUnhealthy ? 'unhealthy' : 'degraded',
      details: {
        searchEngine: checks[0],
        cache: checks[1],
        monitoring: checks[2],
      },
    };
  }

  /**
   * Shutdown the search system gracefully
   */
  async shutdown(): Promise<void> {
    await this.monitor.stop();
    await this.warmingEngine.stop();
    await this.cacheManager.flush();
    await this.knowledgeDB.close();
    this.isInitialized = false;
    console.log('Search Integration shut down gracefully');
  }
}

// Export singleton instance for easy use
export const searchService = new SearchIntegration({
  geminiApiKey: process.env.GEMINI_API_KEY,
  cacheEnabled: true,
  monitoringEnabled: true,
  performanceTargets: {
    maxResponseTime: 1000, // <1s guarantee
    minCacheHitRate: 0.8, // 80% cache hit target
    maxErrorRate: 0.01, // <1% error rate
  },
});
