/**
 * FTS5 Integration Service
 *
 * Integrates SQLite FTS5 engine with the existing search service architecture.
 * Provides seamless fallback, caching, and performance optimization.
 *
 * @author Database Architect
 * @version 1.0.0
 */

import Database from 'better-sqlite3';
import FTS5Engine, { FTS5Config, FTS5SearchResult } from './FTS5Engine';
import AdvancedSearchEngine from './AdvancedSearchEngine';
import { KBEntry, SearchResult, SearchOptions } from '../../types';

/**
 * FTS5 Integration configuration
 */
export interface FTS5IntegrationConfig {
  /** Enable FTS5 integration */
  enabled: boolean;

  /** Fallback to legacy search on FTS5 failure */
  fallbackEnabled: boolean;

  /** Minimum query length for FTS5 (shorter queries use legacy search) */
  minQueryLength: number;

  /** Performance thresholds */
  performance: {
    /** Maximum FTS5 search time before fallback (ms) */
    maxSearchTime: number;

    /** Maximum acceptable FTS5 initialization time (ms) */
    maxInitTime: number;

    /** Enable performance monitoring */
    enableMonitoring: boolean;
  };

  /** Cache configuration */
  cache: {
    /** Enable FTS5 result caching */
    enabled: boolean;

    /** Cache TTL for FTS5 results (ms) */
    ttl: number;

    /** Maximum cache size (number of entries) */
    maxSize: number;
  };

  /** Feature flags */
  features: {
    /** Enable hybrid search (combine FTS5 with legacy) */
    hybridSearch: boolean;

    /** Enable auto-complete with FTS5 */
    autoComplete: boolean;

    /** Enable snippet generation */
    snippets: boolean;

    /** Enable query expansion */
    queryExpansion: boolean;
  };
}

/**
 * Search strategy selection result
 */
export interface SearchStrategy {
  /** Selected strategy */
  strategy: 'fts5' | 'legacy' | 'hybrid';

  /** Reason for strategy selection */
  reason: string;

  /** Confidence level (0-1) */
  confidence: number;

  /** Estimated performance */
  estimatedTime: number;
}

/**
 * FTS5 Integration Service
 *
 * Intelligently routes search queries between FTS5 and legacy search engines
 * based on query characteristics, performance requirements, and system health.
 */
export class FTS5Integration {
  private db: Database.Database;
  private fts5Engine: FTS5Engine;
  private legacyEngine: AdvancedSearchEngine;
  private config: FTS5IntegrationConfig;
  private initialized: boolean = false;
  private performanceMetrics: Map<string, number[]> = new Map();
  private resultCache: Map<string, { result: SearchResult[]; timestamp: number }> = new Map();

  /**
   * Default integration configuration
   */
  private static readonly DEFAULT_CONFIG: FTS5IntegrationConfig = {
    enabled: true,
    fallbackEnabled: true,
    minQueryLength: 2,
    performance: {
      maxSearchTime: 1000,
      maxInitTime: 5000,
      enableMonitoring: true
    },
    cache: {
      enabled: true,
      ttl: 300000, // 5 minutes
      maxSize: 1000
    },
    features: {
      hybridSearch: true,
      autoComplete: true,
      snippets: true,
      queryExpansion: false
    }
  };

  constructor(
    db: Database.Database,
    legacyEngine: AdvancedSearchEngine,
    fts5Config: Partial<FTS5Config> = {},
    integrationConfig: Partial<FTS5IntegrationConfig> = {}
  ) {
    this.db = db;
    this.legacyEngine = legacyEngine;
    this.config = this.mergeConfig(FTS5Integration.DEFAULT_CONFIG, integrationConfig);
    this.fts5Engine = new FTS5Engine(db, fts5Config);
  }

  /**
   * Initialize FTS5 integration with performance monitoring
   */
  async initialize(): Promise<void> {
    console.log('🔧 Initializing FTS5 Integration...');

    if (!this.config.enabled) {
      console.log('⚠️ FTS5 integration disabled, using legacy search only');
      this.initialized = true;
      return;
    }

    const startTime = Date.now();

    try {
      // Initialize FTS5 engine with timeout
      await this.initializeWithTimeout();

      const initTime = Date.now() - startTime;
      console.log(`✅ FTS5 Integration initialized in ${initTime}ms`);

      // Validate initialization performance
      if (initTime > this.config.performance.maxInitTime) {
        console.warn(`⚠️ FTS5 initialization took ${initTime}ms (threshold: ${this.config.performance.maxInitTime}ms)`);
      }

      this.initialized = true;

      // Start performance monitoring if enabled
      if (this.config.performance.enableMonitoring) {
        this.startPerformanceMonitoring();
      }

      // Pre-warm cache if configured
      if (this.config.cache.enabled) {
        await this.preWarmCache();
      }

    } catch (error) {
      console.error('❌ FTS5 Integration initialization failed:', error);

      if (this.config.fallbackEnabled) {
        console.log('🔄 Falling back to legacy search engine');
        this.config.enabled = false;
        this.initialized = true;
      } else {
        throw error;
      }
    }
  }

  /**
   * Intelligent search with automatic strategy selection
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    this.ensureInitialized();

    const startTime = Date.now();

    try {
      // Select optimal search strategy
      const strategy = await this.selectSearchStrategy(query, options);

      // Execute search with selected strategy
      const results = await this.executeSearch(query, options, strategy);

      // Record performance metrics
      const executionTime = Date.now() - startTime;
      this.recordPerformanceMetric(strategy.strategy, executionTime);

      // Log search analytics
      if (this.config.performance.enableMonitoring) {
        console.log(
          `🔍 Search: "${query}" | Strategy: ${strategy.strategy} | ` +
          `Time: ${executionTime}ms | Results: ${results.length} | ` +
          `Confidence: ${(strategy.confidence * 100).toFixed(1)}%`
        );
      }

      return results;

    } catch (error) {
      console.error('❌ Integrated search failed:', error);

      // Fallback to legacy search on any error
      if (this.config.fallbackEnabled) {
        console.log('🔄 Falling back to legacy search due to error');
        return await this.legacyEngine.search(query, options);
      }

      throw error;
    }
  }

  /**
   * Auto-complete with FTS5 optimization
   */
  async autoComplete(prefix: string, limit: number = 5): Promise<string[]> {
    this.ensureInitialized();

    if (!this.config.features.autoComplete || !this.config.enabled) {
      return await this.legacyEngine.suggest(prefix, limit);
    }

    try {
      // Check cache first
      const cacheKey = `autocomplete:${prefix}:${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached as string[];
      }

      // Use hybrid approach for auto-complete
      const [fts5Results, legacyResults] = await Promise.allSettled([
        this.getFTS5AutoComplete(prefix, Math.ceil(limit * 0.7)),
        this.legacyEngine.suggest(prefix, Math.ceil(limit * 0.3))
      ]);

      // Merge results intelligently
      const suggestions = this.mergeAutoCompleteResults(
        fts5Results.status === 'fulfilled' ? fts5Results.value : [],
        legacyResults.status === 'fulfilled' ? legacyResults.value : [],
        limit
      );

      // Cache results
      this.addToCache(cacheKey, suggestions);

      return suggestions;

    } catch (error) {
      console.error('Auto-complete error:', error);
      return await this.legacyEngine.suggest(prefix, limit);
    }
  }

  /**
   * Get search performance metrics
   */
  getPerformanceMetrics(): {
    fts5: { averageTime: number; callCount: number; successRate: number };
    legacy: { averageTime: number; callCount: number; successRate: number };
    hybrid: { averageTime: number; callCount: number; successRate: number };
    overall: { totalSearches: number; averageTime: number; cacheHitRate: number };
  } {
    const calculateMetrics = (strategy: string) => {
      const times = this.performanceMetrics.get(strategy) || [];
      return {
        averageTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
        callCount: times.length,
        successRate: times.length > 0 ? 1.0 : 0.0 // Simplified - would track failures in production
      };
    };

    const allTimes = Array.from(this.performanceMetrics.values()).flat();
    const cacheHits = this.resultCache.size;
    const totalRequests = allTimes.length + cacheHits;

    return {
      fts5: calculateMetrics('fts5'),
      legacy: calculateMetrics('legacy'),
      hybrid: calculateMetrics('hybrid'),
      overall: {
        totalSearches: totalRequests,
        averageTime: allTimes.length > 0 ? allTimes.reduce((a, b) => a + b, 0) / allTimes.length : 0,
        cacheHitRate: totalRequests > 0 ? cacheHits / totalRequests : 0
      }
    };
  }

  /**
   * Get integration health status
   */
  getHealthStatus(): {
    fts5Available: boolean;
    legacyAvailable: boolean;
    cacheStatus: string;
    performanceStatus: string;
    recommendations: string[];
  } {
    const metrics = this.getPerformanceMetrics();
    const recommendations: string[] = [];

    // Check FTS5 performance
    if (metrics.fts5.averageTime > this.config.performance.maxSearchTime) {
      recommendations.push('FTS5 search times are above threshold - consider optimization');
    }

    // Check cache effectiveness
    if (metrics.overall.cacheHitRate < 0.3) {
      recommendations.push('Low cache hit rate - consider adjusting cache TTL or size');
    }

    // Check strategy distribution
    const fts5Usage = metrics.fts5.callCount / Math.max(1, metrics.overall.totalSearches);
    if (fts5Usage < 0.5 && this.config.enabled) {
      recommendations.push('Low FTS5 usage - review strategy selection criteria');
    }

    return {
      fts5Available: this.config.enabled && this.initialized,
      legacyAvailable: true, // Legacy engine is always available
      cacheStatus: this.config.cache.enabled ? 'enabled' : 'disabled',
      performanceStatus: metrics.overall.averageTime < this.config.performance.maxSearchTime ? 'good' : 'degraded',
      recommendations
    };
  }

  /**
   * Optimize integration performance
   */
  async optimize(): Promise<void> {
    console.log('🔧 Optimizing FTS5 integration...');

    try {
      // Optimize FTS5 index
      if (this.config.enabled) {
        await this.fts5Engine.optimize();
      }

      // Clean cache of expired entries
      this.cleanExpiredCache();

      // Reset performance metrics (optional - keeps recent performance data)
      // this.performanceMetrics.clear();

      console.log('✅ FTS5 integration optimization completed');

    } catch (error) {
      console.error('❌ Integration optimization failed:', error);
      throw error;
    }
  }

  // =========================
  // Private Implementation
  // =========================

  /**
   * Initialize FTS5 with timeout protection
   */
  private async initializeWithTimeout(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`FTS5 initialization timeout (${this.config.performance.maxInitTime}ms)`));
      }, this.config.performance.maxInitTime);

      this.fts5Engine.initialize()
        .then(() => {
          clearTimeout(timeout);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Intelligent search strategy selection
   */
  private async selectSearchStrategy(
    query: string,
    options: SearchOptions
  ): Promise<SearchStrategy> {
    // Rule 1: Check if FTS5 is available
    if (!this.config.enabled) {
      return {
        strategy: 'legacy',
        reason: 'FTS5 disabled',
        confidence: 1.0,
        estimatedTime: 200
      };
    }

    // Rule 2: Query length check
    if (query.length < this.config.minQueryLength) {
      return {
        strategy: 'legacy',
        reason: 'Query too short for FTS5',
        confidence: 0.9,
        estimatedTime: 150
      };
    }

    // Rule 3: Check for error codes (exact matching better with legacy)
    if (/^[A-Z]{2,4}\d{3,4}[A-Z]?$/.test(query) || /^S\d{3}[A-Z]?$/.test(query)) {
      return {
        strategy: 'legacy',
        reason: 'Error code pattern detected',
        confidence: 0.95,
        estimatedTime: 100
      };
    }

    // Rule 4: Category/tag searches (both engines handle well)
    if (query.startsWith('category:') || query.startsWith('tag:') || options.category) {
      return {
        strategy: 'legacy',
        reason: 'Structured query - legacy optimized',
        confidence: 0.8,
        estimatedTime: 150
      };
    }

    // Rule 5: Complex natural language queries (FTS5 excels)
    const wordCount = query.split(/\s+/).length;
    if (wordCount >= 3 && this.config.features.hybridSearch) {
      return {
        strategy: 'hybrid',
        reason: 'Complex query - hybrid approach',
        confidence: 0.9,
        estimatedTime: 300
      };
    }

    // Rule 6: Performance-based selection
    const fts5Metrics = this.performanceMetrics.get('fts5') || [];
    const avgFTS5Time = fts5Metrics.length > 0 ?
      fts5Metrics.reduce((a, b) => a + b, 0) / fts5Metrics.length : 200;

    if (avgFTS5Time > this.config.performance.maxSearchTime) {
      return {
        strategy: 'legacy',
        reason: 'FTS5 performance degraded',
        confidence: 0.7,
        estimatedTime: 200
      };
    }

    // Default: Use FTS5 for general searches
    return {
      strategy: 'fts5',
      reason: 'General text search - FTS5 optimal',
      confidence: 0.85,
      estimatedTime: avgFTS5Time || 250
    };
  }

  /**
   * Execute search with selected strategy
   */
  private async executeSearch(
    query: string,
    options: SearchOptions,
    strategy: SearchStrategy
  ): Promise<SearchResult[]> {
    // Check cache first
    const cacheKey = this.generateCacheKey(query, options, strategy.strategy);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached as SearchResult[];
    }

    let results: SearchResult[];

    switch (strategy.strategy) {
      case 'fts5':
        results = await this.executeFTS5Search(query, options);
        break;

      case 'legacy':
        results = await this.legacyEngine.search(query, options);
        break;

      case 'hybrid':
        results = await this.executeHybridSearch(query, options);
        break;

      default:
        throw new Error(`Unknown search strategy: ${strategy.strategy}`);
    }

    // Cache results
    this.addToCache(cacheKey, results);

    return results;
  }

  /**
   * Execute FTS5 search with timeout protection
   */
  private async executeFTS5Search(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`FTS5 search timeout (${this.config.performance.maxSearchTime}ms)`));
      }, this.config.performance.maxSearchTime);

      this.fts5Engine.search(query, options)
        .then((results) => {
          clearTimeout(timeout);
          // Convert FTS5SearchResult to SearchResult
          resolve(results.map(r => ({
            entry: r.entry,
            score: r.score,
            matchType: r.matchType,
            highlights: r.highlights,
            explanation: `FTS5 BM25 Score: ${r.bm25Score.toFixed(2)}`,
            metadata: {
              processingTime: 0, // Would be calculated in production
              source: 'fts5',
              confidence: r.bm25Score / 100,
              fallback: false
            }
          })));
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Execute hybrid search combining FTS5 and legacy
   */
  private async executeHybridSearch(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const limit = options.limit || 10;

    // Execute both searches in parallel
    const [fts5Results, legacyResults] = await Promise.allSettled([
      this.executeFTS5Search(query, { ...options, limit: Math.ceil(limit * 0.7) }),
      this.legacyEngine.search(query, { ...options, limit: Math.ceil(limit * 0.5) })
    ]);

    // Merge results intelligently
    const merged = this.mergeSearchResults(
      fts5Results.status === 'fulfilled' ? fts5Results.value : [],
      legacyResults.status === 'fulfilled' ? legacyResults.value : [],
      limit
    );

    return merged;
  }

  /**
   * Merge search results from different engines
   */
  private mergeSearchResults(
    fts5Results: SearchResult[],
    legacyResults: SearchResult[],
    limit: number
  ): SearchResult[] {
    const resultMap = new Map<string, SearchResult>();

    // Add FTS5 results with boost
    fts5Results.forEach(result => {
      resultMap.set(result.entry.id!, {
        ...result,
        score: result.score * 1.1, // Slight boost for FTS5 results
        matchType: 'fts5' as any
      });
    });

    // Add legacy results, boosting if they appear in both
    legacyResults.forEach(result => {
      const existing = resultMap.get(result.entry.id!);
      if (existing) {
        // Result appears in both - significant boost
        existing.score = Math.max(existing.score, result.score) * 1.2;
        existing.matchType = 'hybrid' as any;
      } else {
        resultMap.set(result.entry.id!, result);
      }
    });

    // Sort by score and return top results
    return Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get FTS5-specific auto-complete suggestions
   */
  private async getFTS5AutoComplete(prefix: string, limit: number): Promise<string[]> {
    // Simplified implementation - would use FTS5 prefix matching in production
    const ftsQuery = `${prefix}*`;

    try {
      const results = await this.fts5Engine.search(ftsQuery, { limit: limit * 2 });

      // Extract unique terms from results
      const suggestions = new Set<string>();

      results.forEach(result => {
        // Extract terms from title and problem that start with prefix
        const text = `${result.entry.title} ${result.entry.problem}`.toLowerCase();
        const words = text.split(/\s+/);

        words.forEach(word => {
          if (word.startsWith(prefix.toLowerCase()) && word.length > prefix.length) {
            suggestions.add(word);
          }
        });
      });

      return Array.from(suggestions).slice(0, limit);

    } catch (error) {
      console.error('FTS5 auto-complete error:', error);
      return [];
    }
  }

  /**
   * Merge auto-complete results from different sources
   */
  private mergeAutoCompleteResults(
    fts5Results: string[],
    legacyResults: string[],
    limit: number
  ): string[] {
    const merged = new Set<string>();

    // Add FTS5 results first (they're likely more relevant)
    fts5Results.forEach(suggestion => merged.add(suggestion));

    // Add legacy results
    legacyResults.forEach(suggestion => merged.add(suggestion));

    return Array.from(merged).slice(0, limit);
  }

  /**
   * Cache management methods
   */
  private generateCacheKey(query: string, options: SearchOptions, strategy: string): string {
    const keyParts = [
      strategy,
      query.toLowerCase(),
      options.category || '',
      options.sortBy || '',
      options.limit || 10,
      options.offset || 0
    ];
    return keyParts.join(':');
  }

  private getFromCache(key: string): any {
    if (!this.config.cache.enabled) return null;

    const cached = this.resultCache.get(key);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.config.cache.ttl) {
      this.resultCache.delete(key);
      return null;
    }

    return cached.result;
  }

  private addToCache(key: string, result: any): void {
    if (!this.config.cache.enabled) return;

    // Clean cache if too large
    if (this.resultCache.size >= this.config.cache.maxSize) {
      const oldestKey = this.resultCache.keys().next().value;
      this.resultCache.delete(oldestKey);
    }

    this.resultCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.resultCache.entries()) {
      if (now - cached.timestamp > this.config.cache.ttl) {
        this.resultCache.delete(key);
      }
    }
  }

  /**
   * Performance monitoring methods
   */
  private recordPerformanceMetric(strategy: string, time: number): void {
    if (!this.config.performance.enableMonitoring) return;

    const metrics = this.performanceMetrics.get(strategy) || [];
    metrics.push(time);

    // Keep only last 100 measurements per strategy
    if (metrics.length > 100) {
      metrics.shift();
    }

    this.performanceMetrics.set(strategy, metrics);
  }

  private startPerformanceMonitoring(): void {
    // Log performance stats every 5 minutes
    setInterval(() => {
      const metrics = this.getPerformanceMetrics();
      console.log(
        `📊 Search Performance: FTS5: ${metrics.fts5.averageTime.toFixed(1)}ms ` +
        `(${metrics.fts5.callCount} calls), Legacy: ${metrics.legacy.averageTime.toFixed(1)}ms ` +
        `(${metrics.legacy.callCount} calls), Cache hit rate: ${(metrics.overall.cacheHitRate * 100).toFixed(1)}%`
      );
    }, 300000); // 5 minutes
  }

  private async preWarmCache(): Promise<void> {
    console.log('🔥 Pre-warming search cache...');

    // Common search terms for mainframe environments
    const commonQueries = [
      'JCL error',
      'VSAM status',
      'DB2 deadlock',
      'S0C7 abend',
      'CICS transaction',
      'IMS database',
      'batch job failure',
      'dataset not found'
    ];

    try {
      await Promise.all(
        commonQueries.map(query =>
          this.search(query, { limit: 5 }).catch(() => {}) // Ignore errors during pre-warming
        )
      );

      console.log(`✅ Cache pre-warmed with ${commonQueries.length} common queries`);

    } catch (error) {
      console.warn('⚠️ Cache pre-warming partially failed:', error);
    }
  }

  /**
   * Configuration merging
   */
  private mergeConfig(
    defaults: FTS5IntegrationConfig,
    config: Partial<FTS5IntegrationConfig>
  ): FTS5IntegrationConfig {
    return {
      enabled: config.enabled ?? defaults.enabled,
      fallbackEnabled: config.fallbackEnabled ?? defaults.fallbackEnabled,
      minQueryLength: config.minQueryLength ?? defaults.minQueryLength,
      performance: {
        ...defaults.performance,
        ...config.performance
      },
      cache: {
        ...defaults.cache,
        ...config.cache
      },
      features: {
        ...defaults.features,
        ...config.features
      }
    };
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('FTS5Integration not initialized. Call initialize() first.');
    }
  }
}

export default FTS5Integration;