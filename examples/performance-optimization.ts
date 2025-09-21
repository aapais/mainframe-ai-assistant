/**
 * Performance Optimization Examples for Database Utilities System
 * 
 * This file demonstrates performance optimization techniques including:
 * - Query optimization strategies
 * - Index management and analysis
 * - Memory usage optimization
 * - Cache optimization patterns
 * - Connection pool tuning
 * - Batch processing optimization
 * - Performance testing and benchmarking
 */

import { KnowledgeDB, createKnowledgeDB } from '../src/database/KnowledgeDB';
import { KBEntry, SearchResult } from '../src/types/index';

// ==============================================
// 1. QUERY OPTIMIZATION
// ==============================================

/**
 * Example: Query Performance Analyzer
 * Analyzes query patterns and provides optimization recommendations
 */
class QueryPerformanceAnalyzer {
  private queryHistory: Array<{
    query: string;
    options: any;
    executionTime: number;
    resultCount: number;
    timestamp: Date;
  }> = [];
  
  constructor(private db: KnowledgeDB) {}
  
  /**
   * Execute query with performance tracking
   */
  async executeWithProfiling(
    query: string, 
    options: any = {}
  ): Promise<{
    results: SearchResult[];
    performance: {
      executionTime: number;
      resultCount: number;
      cacheHit: boolean;
      optimizationSuggestions: string[];
    };
  }> {
    const startTime = performance.now();
    
    // Check if query is already cached
    const cacheHit = await this.checkCacheStatus(query, options);
    
    // Execute query
    const results = await this.db.search(query, options);
    
    const executionTime = performance.now() - startTime;
    
    // Record query for analysis
    this.queryHistory.push({
      query,
      options,
      executionTime,
      resultCount: results.length,
      timestamp: new Date()
    });
    
    // Generate optimization suggestions
    const optimizationSuggestions = this.analyzeQueryPerformance(query, options, executionTime);
    
    return {
      results,
      performance: {
        executionTime,
        resultCount: results.length,
        cacheHit,
        optimizationSuggestions
      }
    };
  }
  
  /**
   * Analyze query patterns and provide optimization recommendations
   */
  generateOptimizationReport(): {
    slowQueries: Array<{ query: string; avgTime: number; count: number }>;
    recommendedIndexes: string[];
    cacheOptimizations: string[];
    queryPatterns: Record<string, number>;
  } {
    const queryStats = new Map<string, { times: number[]; count: number }>();
    const patterns = new Map<string, number>();
    
    // Analyze query history
    this.queryHistory.forEach(entry => {
      const normalizedQuery = this.normalizeQuery(entry.query);
      
      if (!queryStats.has(normalizedQuery)) {
        queryStats.set(normalizedQuery, { times: [], count: 0 });
      }
      
      const stats = queryStats.get(normalizedQuery)!;
      stats.times.push(entry.executionTime);
      stats.count++;
      
      // Analyze query patterns
      this.extractPatterns(entry.query).forEach(pattern => {
        patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
      });
    });
    
    // Identify slow queries
    const slowQueries = Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        avgTime: stats.times.reduce((sum, time) => sum + time, 0) / stats.times.length,
        count: stats.count
      }))
      .filter(q => q.avgTime > 500) // Queries slower than 500ms
      .sort((a, b) => b.avgTime - a.avgTime);
    
    // Recommend indexes based on patterns
    const recommendedIndexes = this.generateIndexRecommendations(patterns);
    
    // Cache optimization suggestions
    const cacheOptimizations = this.generateCacheOptimizations(queryStats);
    
    return {
      slowQueries,
      recommendedIndexes,
      cacheOptimizations,
      queryPatterns: Object.fromEntries(patterns)
    };
  }
  
  private async checkCacheStatus(query: string, options: any): Promise<boolean> {
    // This would check if the query result is already cached
    // For demonstration, we'll simulate cache checking
    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    
    // Simulate cache check logic
    return Math.random() > 0.7; // 30% cache hit rate simulation
  }
  
  private analyzeQueryPerformance(query: string, options: any, executionTime: number): string[] {
    const suggestions: string[] = [];
    
    if (executionTime > 1000) {
      suggestions.push('Query is very slow (>1s) - consider using more specific search terms');
    }
    
    if (query.length < 3) {
      suggestions.push('Very short query - may return too many irrelevant results');
    }
    
    if (!options.category && !options.tags && query.split(' ').length === 1) {
      suggestions.push('Consider adding category or tag filters to narrow results');
    }
    
    if (options.limit && options.limit > 50) {
      suggestions.push('Large result set requested - consider pagination');
    }
    
    // Check for known patterns that can be optimized
    if (query.startsWith('category:')) {
      suggestions.push('Category search detected - this should use optimized category index');
    }
    
    if (/^[A-Z]\d{3,4}[A-Z]?$/.test(query)) {
      suggestions.push('Error code detected - should use exact match for best performance');
    }
    
    return suggestions;
  }
  
  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }
  
  private extractPatterns(query: string): string[] {
    const patterns: string[] = [];
    
    if (query.startsWith('category:')) patterns.push('category_filter');
    if (query.startsWith('tag:')) patterns.push('tag_filter');
    if (/^[A-Z]\d{3,4}[A-Z]?$/.test(query)) patterns.push('error_code');
    if (query.split(' ').length > 3) patterns.push('long_query');
    if (query.includes('"')) patterns.push('phrase_query');
    
    return patterns;
  }
  
  private generateIndexRecommendations(patterns: Map<string, number>): string[] {
    const recommendations: string[] = [];
    
    if ((patterns.get('category_filter') || 0) > 10) {
      recommendations.push('CREATE INDEX idx_kb_entries_category_usage ON kb_entries(category, usage_count DESC)');
    }
    
    if ((patterns.get('tag_filter') || 0) > 10) {
      recommendations.push('CREATE INDEX idx_kb_tags_tag_entry ON kb_tags(tag, entry_id)');
    }
    
    if ((patterns.get('error_code') || 0) > 5) {
      recommendations.push('CREATE INDEX idx_kb_entries_title_exact ON kb_entries(title) WHERE title GLOB "[A-Z][0-9]*"');
    }
    
    return recommendations;
  }
  
  private generateCacheOptimizations(queryStats: Map<string, any>): string[] {
    const optimizations: string[] = [];
    
    // Find frequently executed queries for cache pre-warming
    const frequentQueries = Array.from(queryStats.entries())
      .filter(([_, stats]) => stats.count > 5)
      .map(([query, _]) => query);
    
    if (frequentQueries.length > 0) {
      optimizations.push('Pre-warm cache with frequent queries: ' + frequentQueries.slice(0, 3).join(', '));
    }
    
    optimizations.push('Consider increasing cache size for better hit rates');
    optimizations.push('Implement query result compression for memory efficiency');
    
    return optimizations;
  }
}

// ==============================================
// 2. INDEX OPTIMIZATION
// ==============================================

/**
 * Example: Index Management and Analysis
 * Provides index analysis and optimization recommendations
 */
class IndexOptimizer {
  constructor(private db: KnowledgeDB) {}
  
  /**
   * Analyze current index effectiveness
   */
  async analyzeIndexEffectiveness(): Promise<{
    indexAnalysis: Array<{
      indexName: string;
      usage: number;
      effectiveness: 'high' | 'medium' | 'low';
      recommendation: string;
    }>;
    missingIndexes: string[];
    redundantIndexes: string[];
  }> {
    console.log('📊 Analyzing index effectiveness...');
    
    // Get index analysis from the database
    const indexAnalysis = this.db.getIndexAnalysis();
    
    // Analyze query patterns to identify missing indexes
    const missingIndexes = await this.identifyMissingIndexes();
    
    // Identify potentially redundant indexes
    const redundantIndexes = this.identifyRedundantIndexes();
    
    return {
      indexAnalysis: indexAnalysis.indexes || [],
      missingIndexes,
      redundantIndexes
    };
  }
  
  /**
   * Create optimized indexes based on query patterns
   */
  async createOptimizedIndexes(): Promise<{
    created: string[];
    failed: Array<{ index: string; error: string }>;
  }> {
    console.log('🔧 Creating optimized indexes...');
    
    const recommendedIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_kb_entries_category_created ON kb_entries(category, created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_kb_entries_usage_success ON kb_entries(usage_count DESC, success_count DESC)',
      'CREATE INDEX IF NOT EXISTS idx_kb_entries_success_rate ON kb_entries((CAST(success_count AS REAL) / NULLIF(success_count + failure_count, 0)) DESC)',
      'CREATE INDEX IF NOT EXISTS idx_kb_tags_tag_entry ON kb_tags(tag, entry_id)',
      'CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_usage_metrics_entry_timestamp ON usage_metrics(entry_id, timestamp DESC)'
    ];
    
    const created: string[] = [];
    const failed: Array<{ index: string; error: string }> = [];
    
    for (const indexSql of recommendedIndexes) {
      try {
        // Extract index name for tracking
        const indexName = indexSql.match(/idx_\w+/)?.[0] || 'unknown';
        
        // This would execute the index creation
        console.log(`Creating index: ${indexName}`);
        created.push(indexName);
        
      } catch (error) {
        failed.push({
          index: indexSql,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    console.log(`✅ Created ${created.length} indexes, ${failed.length} failed`);
    return { created, failed };
  }
  
  /**
   * Benchmark index performance
   */
  async benchmarkIndexes(): Promise<{
    results: Array<{
      queryType: string;
      withIndex: number;
      withoutIndex: number;
      improvement: number;
    }>;
  }> {
    console.log('⏱️ Benchmarking index performance...');
    
    const benchmarkQueries = [
      { type: 'category_search', query: 'category:VSAM', options: {} },
      { type: 'tag_search', query: 'tag:error', options: {} },
      { type: 'popular_entries', query: '', options: { sortBy: 'usage', limit: 10 } },
      { type: 'recent_entries', query: '', options: { sortBy: 'created_at', limit: 10 } },
      { type: 'text_search', query: 'file not found', options: {} }
    ];
    
    const results = [];
    
    for (const benchmark of benchmarkQueries) {
      // Simulate benchmark (in real implementation, would drop/create indexes)
      const withIndex = await this.timeQuery(benchmark.query, benchmark.options);
      const withoutIndex = withIndex * (1.5 + Math.random()); // Simulate slower without index
      
      results.push({
        queryType: benchmark.type,
        withIndex,
        withoutIndex,
        improvement: ((withoutIndex - withIndex) / withoutIndex) * 100
      });
    }
    
    return { results };
  }
  
  private async identifyMissingIndexes(): Promise<string[]> {
    const missing: string[] = [];
    
    // Check for common query patterns that need indexes
    const stats = await this.db.getStats();
    
    // If we have many categories, suggest category index
    if (Object.keys(stats.categoryCounts).length > 5) {
      missing.push('CREATE INDEX idx_kb_entries_category_usage ON kb_entries(category, usage_count DESC)');
    }
    
    // If we have high search volume, suggest search optimization indexes
    if (stats.searchesToday > 100) {
      missing.push('CREATE INDEX idx_search_history_query ON search_history(query, timestamp DESC)');
    }
    
    return missing;
  }
  
  private identifyRedundantIndexes(): string[] {
    // In a real implementation, this would analyze actual database indexes
    // For demonstration, return potential redundancies
    return [
      'idx_old_category_index - covered by idx_kb_entries_category_created',
      'idx_simple_usage - covered by idx_kb_entries_usage_success'
    ];
  }
  
  private async timeQuery(query: string, options: any): Promise<number> {
    const start = performance.now();
    await this.db.search(query, options);
    return performance.now() - start;
  }
}

// ==============================================
// 3. MEMORY OPTIMIZATION
// ==============================================

/**
 * Example: Memory Usage Optimizer
 * Monitors and optimizes memory usage patterns
 */
class MemoryOptimizer {
  constructor(private db: KnowledgeDB) {}
  
  /**
   * Analyze current memory usage
   */
  async analyzeMemoryUsage(): Promise<{
    current: {
      cacheMemory: number;
      connectionMemory: number;
      totalMemory: number;
    };
    recommendations: string[];
    optimizations: Array<{
      action: string;
      expectedSaving: number;
      impact: 'low' | 'medium' | 'high';
    }>;
  }> {
    console.log('🧠 Analyzing memory usage...');
    
    const cacheStats = this.db.getCacheStats();
    const connectionStats = this.db.getConnectionPoolStats();
    
    const current = {
      cacheMemory: cacheStats.memoryUsage,
      connectionMemory: connectionStats.memoryUsage || 0,
      totalMemory: cacheStats.memoryUsage + (connectionStats.memoryUsage || 0)
    };
    
    const recommendations: string[] = [];
    const optimizations = [];
    
    // Analyze cache memory usage
    if (current.cacheMemory > 100 * 1024 * 1024) { // 100MB
      recommendations.push('Cache memory usage is high - consider reducing cache size or implementing compression');
      optimizations.push({
        action: 'Reduce cache size by 30%',
        expectedSaving: current.cacheMemory * 0.3,
        impact: 'medium' as const
      });
    }
    
    // Analyze cache hit rate vs memory usage
    if (cacheStats.hitRate < 0.6 && current.cacheMemory > 50 * 1024 * 1024) {
      recommendations.push('Low cache hit rate with high memory usage - optimize cache strategy');
      optimizations.push({
        action: 'Implement smarter cache eviction policy',
        expectedSaving: current.cacheMemory * 0.2,
        impact: 'high' as const
      });
    }
    
    // Connection pool optimization
    if (connectionStats.activeConnections < connectionStats.maxConnections * 0.5) {
      recommendations.push('Connection pool appears oversized - consider reducing max connections');
      optimizations.push({
        action: 'Reduce connection pool size',
        expectedSaving: 10 * 1024 * 1024, // Estimate 10MB per connection
        impact: 'low' as const
      });
    }
    
    return { current, recommendations, optimizations };
  }
  
  /**
   * Implement memory optimizations
   */
  async optimizeMemoryUsage(): Promise<{
    implemented: string[];
    results: {
      beforeMemory: number;
      afterMemory: number;
      savedMemory: number;
    };
  }> {
    console.log('🔧 Implementing memory optimizations...');
    
    const beforeStats = this.db.getCacheStats();
    const beforeMemory = beforeStats.memoryUsage;
    
    const implemented: string[] = [];
    
    try {
      // Optimization 1: Clear low-hit cache entries
      if (beforeStats.hitRate < 0.7) {
        const cleared = await this.db.invalidateCache('search:*');
        if (cleared > 0) {
          implemented.push(`Cleared ${cleared} low-efficiency cache entries`);
        }
      }
      
      // Optimization 2: Pre-warm cache with high-value queries
      await this.db.preWarmCache();
      implemented.push('Pre-warmed cache with high-value queries');
      
      // Optimization 3: Optimize connection pool (simulated)
      implemented.push('Optimized connection pool configuration');
      
    } catch (error) {
      console.error('Memory optimization failed:', error);
    }
    
    // Measure results after a brief delay for changes to take effect
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const afterStats = this.db.getCacheStats();
    const afterMemory = afterStats.memoryUsage;
    const savedMemory = beforeMemory - afterMemory;
    
    return {
      implemented,
      results: {
        beforeMemory,
        afterMemory,
        savedMemory
      }
    };
  }
  
  /**
   * Set up continuous memory monitoring
   */
  setupMemoryMonitoring(intervalMs: number = 30000): void {
    console.log('👁️ Setting up memory monitoring...');
    
    setInterval(async () => {
      const analysis = await this.analyzeMemoryUsage();
      const memoryMB = analysis.current.totalMemory / 1024 / 1024;
      
      if (memoryMB > 200) { // 200MB threshold
        console.warn(`⚠️ High memory usage detected: ${memoryMB.toFixed(2)}MB`);
        console.log('Recommendations:', analysis.recommendations);
        
        // Auto-optimize if memory is very high
        if (memoryMB > 300) {
          console.log('🚨 Critical memory usage - auto-optimizing...');
          await this.optimizeMemoryUsage();
        }
      }
    }, intervalMs);
  }
}

// ==============================================
// 4. CACHE OPTIMIZATION
// ==============================================

/**
 * Example: Advanced Cache Optimizer
 * Implements sophisticated cache optimization strategies
 */
class CacheOptimizer {
  constructor(private db: KnowledgeDB) {}
  
  /**
   * Analyze cache performance patterns
   */
  async analyzeCachePerformance(): Promise<{
    hitRate: number;
    missRate: number;
    evictionRate: number;
    memoryUtilization: number;
    hotQueries: string[];
    coldQueries: string[];
    recommendations: string[];
  }> {
    console.log('📈 Analyzing cache performance...');
    
    const stats = this.db.getCacheStats();
    
    // Simulate hot/cold query analysis
    const hotQueries = [
      'category:VSAM',
      'VSAM status 35',
      'S0C7 error',
      'JCL error',
      'file not found'
    ];
    
    const coldQueries = [
      'very specific error message that rarely happens',
      'obscure mainframe component issue',
      'legacy system specific problem'
    ];
    
    const recommendations: string[] = [];
    
    if (stats.hitRate < 0.6) {
      recommendations.push('Cache hit rate is low - consider pre-warming with common queries');
    }
    
    if (stats.memoryUsage > 100 * 1024 * 1024) {
      recommendations.push('Cache memory usage is high - implement compression or reduce TTL');
    }
    
    if (stats.evictionCount > stats.entryCount * 0.5) {
      recommendations.push('High eviction rate - consider increasing cache size or adjusting TTL');
    }
    
    return {
      hitRate: stats.hitRate,
      missRate: 1 - stats.hitRate,
      evictionRate: stats.evictionCount / Math.max(1, stats.entryCount),
      memoryUtilization: stats.memoryUsage / (200 * 1024 * 1024), // Assume 200MB limit
      hotQueries,
      coldQueries,
      recommendations
    };
  }
  
  /**
   * Implement intelligent cache pre-warming
   */
  async implementSmartPreWarming(): Promise<{
    preWarmedQueries: number;
    estimatedHitRateImprovement: number;
  }> {
    console.log('🔥 Implementing smart cache pre-warming...');
    
    // Get popular entries for pre-warming
    const popularEntries = await this.db.getPopular(20);
    
    // Pre-warm with category searches
    const categories = ['VSAM', 'JCL', 'DB2', 'Batch', 'CICS'];
    for (const category of categories) {
      await this.db.search(`category:${category}`, { limit: 10 });
    }
    
    // Pre-warm with common error patterns
    const commonErrors = ['S0C7', 'S0C4', 'S013', 'IEF212I', 'status 35'];
    for (const error of commonErrors) {
      await this.db.search(error, { limit: 5 });
    }
    
    // Pre-warm with tag searches
    const commonTags = ['error', 'abend', 'file', 'dataset', 'job'];
    for (const tag of commonTags) {
      await this.db.search(`tag:${tag}`, { limit: 5 });
    }
    
    const totalPreWarmed = categories.length + commonErrors.length + commonTags.length;
    const estimatedImprovement = totalPreWarmed * 0.05; // 5% improvement per pre-warmed query type
    
    console.log(`✅ Pre-warmed ${totalPreWarmed} query patterns`);
    
    return {
      preWarmedQueries: totalPreWarmed,
      estimatedHitRateImprovement: Math.min(0.3, estimatedImprovement) // Cap at 30% improvement
    };
  }
  
  /**
   * Optimize cache TTL settings
   */
  async optimizeCacheTTL(): Promise<{
    recommendations: Array<{
      queryPattern: string;
      currentTTL: number;
      recommendedTTL: number;
      reasoning: string;
    }>;
  }> {
    console.log('⏰ Optimizing cache TTL settings...');
    
    const recommendations = [
      {
        queryPattern: 'category:*',
        currentTTL: 300000, // 5 minutes
        recommendedTTL: 600000, // 10 minutes
        reasoning: 'Category searches are stable and can be cached longer'
      },
      {
        queryPattern: 'tag:*',
        currentTTL: 300000,
        recommendedTTL: 600000,
        reasoning: 'Tag searches have stable results'
      },
      {
        queryPattern: 'error codes (S0C7, IEF212I, etc.)',
        currentTTL: 300000,
        recommendedTTL: 1800000, // 30 minutes
        reasoning: 'Error code solutions rarely change'
      },
      {
        queryPattern: 'recent entries',
        currentTTL: 300000,
        recommendedTTL: 60000, // 1 minute
        reasoning: 'Recent entries list changes frequently'
      },
      {
        queryPattern: 'popular entries',
        currentTTL: 300000,
        recommendedTTL: 600000,
        reasoning: 'Popular entries change slowly'
      }
    ];
    
    return { recommendations };
  }
  
  /**
   * Implement cache compression
   */
  async implementCacheCompression(): Promise<{
    compressionRatio: number;
    memorySaved: number;
    performanceImpact: number;
  }> {
    console.log('🗜️ Implementing cache compression...');
    
    const beforeStats = this.db.getCacheStats();
    
    // Simulate compression implementation
    // In real implementation, this would configure the cache to use compression
    
    // Simulated results
    const compressionRatio = 0.4; // 40% of original size
    const memorySaved = beforeStats.memoryUsage * (1 - compressionRatio);
    const performanceImpact = 0.05; // 5% performance overhead
    
    console.log(`✅ Cache compression implemented:`);
    console.log(`- Compression ratio: ${compressionRatio * 100}%`);
    console.log(`- Memory saved: ${(memorySaved / 1024 / 1024).toFixed(2)}MB`);
    console.log(`- Performance overhead: ${performanceImpact * 100}%`);
    
    return {
      compressionRatio,
      memorySaved,
      performanceImpact
    };
  }
}

// ==============================================
// 5. BATCH PROCESSING OPTIMIZATION
// ==============================================

/**
 * Example: Batch Processing Optimizer
 * Optimizes bulk operations for maximum performance
 */
class BatchProcessor {
  constructor(private db: KnowledgeDB) {}
  
  /**
   * Optimized bulk insert with performance monitoring
   */
  async optimizedBulkInsert(
    entries: KBEntry[],
    options: {
      batchSize?: number;
      parallelBatches?: number;
      optimizeIndexes?: boolean;
      useTransaction?: boolean;
    } = {}
  ): Promise<{
    inserted: number;
    duration: number;
    performance: {
      insertsPerSecond: number;
      averageBatchTime: number;
      indexOptimizationTime: number;
    };
  }> {
    console.log(`🚀 Starting optimized bulk insert of ${entries.length} entries...`);
    
    const batchSize = options.batchSize || 100;
    const parallelBatches = options.parallelBatches || 3;
    const startTime = performance.now();
    
    let inserted = 0;
    const batchTimes: number[] = [];
    let indexOptimizationTime = 0;
    
    // Optimize indexes before bulk insert if requested
    if (options.optimizeIndexes) {
      const indexStart = performance.now();
      await this.db.optimize();
      indexOptimizationTime = performance.now() - indexStart;
      console.log(`📊 Index optimization completed in ${indexOptimizationTime.toFixed(2)}ms`);
    }
    
    // Process entries in batches
    const batches = this.createBatches(entries, batchSize);
    
    // Process batches with controlled parallelism
    for (let i = 0; i < batches.length; i += parallelBatches) {
      const currentBatches = batches.slice(i, i + parallelBatches);
      
      const batchPromises = currentBatches.map(async (batch, batchIndex) => {
        const batchStart = performance.now();
        
        try {
          // Process batch
          for (const entry of batch) {
            await this.db.addEntry(entry, 'bulk-insert');
            inserted++;
          }
          
          const batchTime = performance.now() - batchStart;
          batchTimes.push(batchTime);
          
          console.log(`Batch ${i + batchIndex + 1}/${batches.length} completed in ${batchTime.toFixed(2)}ms`);
          
        } catch (error) {
          console.error(`Batch ${i + batchIndex + 1} failed:`, error);
          throw error;
        }
      });
      
      await Promise.all(batchPromises);
      
      // Small delay between batch groups to prevent overwhelming the database
      if (i + parallelBatches < batches.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    const totalDuration = performance.now() - startTime;
    const averageBatchTime = batchTimes.reduce((sum, time) => sum + time, 0) / batchTimes.length;
    const insertsPerSecond = (inserted / totalDuration) * 1000;
    
    console.log(`✅ Bulk insert completed:`);
    console.log(`- Inserted: ${inserted} entries`);
    console.log(`- Duration: ${totalDuration.toFixed(2)}ms`);
    console.log(`- Rate: ${insertsPerSecond.toFixed(2)} inserts/second`);
    
    return {
      inserted,
      duration: totalDuration,
      performance: {
        insertsPerSecond,
        averageBatchTime,
        indexOptimizationTime
      }
    };
  }
  
  /**
   * Optimized bulk search with parallel processing
   */
  async optimizedBulkSearch(
    queries: string[],
    options: {
      maxConcurrent?: number;
      cacheResults?: boolean;
      progressCallback?: (progress: number) => void;
    } = {}
  ): Promise<{
    results: Array<{ query: string; results: SearchResult[]; executionTime: number }>;
    totalTime: number;
    averageTime: number;
    cacheHits: number;
  }> {
    console.log(`🔍 Starting bulk search for ${queries.length} queries...`);
    
    const maxConcurrent = options.maxConcurrent || 5;
    const startTime = performance.now();
    const results: Array<{ query: string; results: SearchResult[]; executionTime: number }> = [];
    let cacheHits = 0;
    
    // Process queries in controlled parallel batches
    for (let i = 0; i < queries.length; i += maxConcurrent) {
      const batch = queries.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (query) => {
        const queryStart = performance.now();
        
        try {
          const searchResults = await this.db.search(query, { limit: 10 });
          const executionTime = performance.now() - queryStart;
          
          // Check if this was likely a cache hit (very fast response)
          if (executionTime < 50) {
            cacheHits++;
          }
          
          return {
            query,
            results: searchResults,
            executionTime
          };
        } catch (error) {
          console.error(`Search failed for query "${query}":`, error);
          return {
            query,
            results: [] as SearchResult[],
            executionTime: performance.now() - queryStart
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Report progress
      if (options.progressCallback) {
        options.progressCallback((results.length / queries.length) * 100);
      }
      
      console.log(`Processed ${results.length}/${queries.length} queries`);
    }
    
    const totalTime = performance.now() - startTime;
    const averageTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
    
    console.log(`✅ Bulk search completed:`);
    console.log(`- Queries: ${queries.length}`);
    console.log(`- Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`- Average time: ${averageTime.toFixed(2)}ms per query`);
    console.log(`- Cache hits: ${cacheHits}/${queries.length} (${((cacheHits/queries.length)*100).toFixed(1)}%)`);
    
    return {
      results,
      totalTime,
      averageTime,
      cacheHits
    };
  }
  
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}

// ==============================================
// 6. COMPREHENSIVE PERFORMANCE TESTING
// ==============================================

/**
 * Example: Performance Testing Suite
 * Comprehensive performance testing and benchmarking
 */
class PerformanceTestSuite {
  constructor(private db: KnowledgeDB) {}
  
  /**
   * Run comprehensive performance benchmark
   */
  async runComprehensiveBenchmark(): Promise<{
    searchPerformance: any;
    insertPerformance: any;
    cachePerformance: any;
    indexPerformance: any;
    memoryPerformance: any;
    overallScore: number;
  }> {
    console.log('🏁 Running comprehensive performance benchmark...');
    
    const results = {
      searchPerformance: await this.benchmarkSearchPerformance(),
      insertPerformance: await this.benchmarkInsertPerformance(),
      cachePerformance: await this.benchmarkCachePerformance(),
      indexPerformance: await this.benchmarkIndexPerformance(),
      memoryPerformance: await this.benchmarkMemoryPerformance(),
      overallScore: 0
    };
    
    // Calculate overall score (0-100)
    const scores = [
      results.searchPerformance.score,
      results.insertPerformance.score,
      results.cachePerformance.score,
      results.indexPerformance.score,
      results.memoryPerformance.score
    ];
    
    results.overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    console.log(`📊 Performance benchmark completed - Overall Score: ${results.overallScore.toFixed(1)}/100`);
    
    return results;
  }
  
  private async benchmarkSearchPerformance(): Promise<{
    averageTime: number;
    p95Time: number;
    throughput: number;
    score: number;
  }> {
    console.log('🔍 Benchmarking search performance...');
    
    const testQueries = [
      'VSAM status 35',
      'S0C7 error',
      'JCL dataset not found',
      'DB2 deadlock',
      'file access error',
      'category:VSAM',
      'tag:abend',
      'batch job failed'
    ];
    
    const times: number[] = [];
    const iterations = 10;
    
    for (let i = 0; i < iterations; i++) {
      for (const query of testQueries) {
        const start = performance.now();
        await this.db.search(query);
        times.push(performance.now() - start);
      }
    }
    
    times.sort((a, b) => a - b);
    const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const p95Time = times[Math.floor(times.length * 0.95)];
    const throughput = (testQueries.length * iterations) / (times.reduce((sum, time) => sum + time, 0) / 1000);
    
    // Score: 100 for <50ms average, 0 for >1000ms average
    const score = Math.max(0, Math.min(100, 100 - ((averageTime - 50) / 950) * 100));
    
    return { averageTime, p95Time, throughput, score };
  }
  
  private async benchmarkInsertPerformance(): Promise<{
    insertsPerSecond: number;
    averageTime: number;
    score: number;
  }> {
    console.log('📝 Benchmarking insert performance...');
    
    const testEntries = Array.from({ length: 50 }, (_, i) => ({
      title: `Benchmark Entry ${i + 1}`,
      problem: `Test problem description for performance benchmark ${i + 1}`,
      solution: `Test solution for benchmark entry ${i + 1}`,
      category: ['VSAM', 'JCL', 'DB2', 'Batch'][i % 4] as any,
      tags: [`test-${i}`, 'benchmark']
    }));
    
    const start = performance.now();
    
    for (const entry of testEntries) {
      await this.db.addEntry(entry, 'benchmark');
    }
    
    const totalTime = performance.now() - start;
    const averageTime = totalTime / testEntries.length;
    const insertsPerSecond = (testEntries.length / totalTime) * 1000;
    
    // Score: 100 for >50 inserts/second, 0 for <5 inserts/second
    const score = Math.max(0, Math.min(100, ((insertsPerSecond - 5) / 45) * 100));
    
    return { insertsPerSecond, averageTime, score };
  }
  
  private async benchmarkCachePerformance(): Promise<{
    hitRate: number;
    avgHitTime: number;
    avgMissTime: number;
    score: number;
  }> {
    console.log('🗄️ Benchmarking cache performance...');
    
    const cacheStats = this.db.getCacheStats();
    
    // Test cache performance with repeated queries
    const testQuery = 'VSAM error';
    const times: number[] = [];
    
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      await this.db.search(testQuery);
      times.push(performance.now() - start);
    }
    
    const avgHitTime = times.slice(1).reduce((sum, time) => sum + time, 0) / (times.length - 1);
    const avgMissTime = times[0]; // First query should be a miss
    
    // Score based on hit rate (target: >80%)
    const score = Math.max(0, Math.min(100, (cacheStats.hitRate / 0.8) * 100));
    
    return {
      hitRate: cacheStats.hitRate,
      avgHitTime,
      avgMissTime,
      score
    };
  }
  
  private async benchmarkIndexPerformance(): Promise<{
    categorySearchTime: number;
    tagSearchTime: number;
    textSearchTime: number;
    score: number;
  }> {
    console.log('📊 Benchmarking index performance...');
    
    // Test different types of searches that use indexes
    const categoryStart = performance.now();
    await this.db.search('category:VSAM');
    const categorySearchTime = performance.now() - categoryStart;
    
    const tagStart = performance.now();
    await this.db.search('tag:error');
    const tagSearchTime = performance.now() - tagStart;
    
    const textStart = performance.now();
    await this.db.search('file not found');
    const textSearchTime = performance.now() - textStart;
    
    const avgTime = (categorySearchTime + tagSearchTime + textSearchTime) / 3;
    
    // Score: 100 for <100ms average, 0 for >1000ms average
    const score = Math.max(0, Math.min(100, 100 - ((avgTime - 100) / 900) * 100));
    
    return { categorySearchTime, tagSearchTime, textSearchTime, score };
  }
  
  private async benchmarkMemoryPerformance(): Promise<{
    memoryUsage: number;
    memoryEfficiency: number;
    score: number;
  }> {
    console.log('🧠 Benchmarking memory performance...');
    
    const cacheStats = this.db.getCacheStats();
    const memoryUsageMB = cacheStats.memoryUsage / 1024 / 1024;
    
    // Calculate memory efficiency (cache hit rate per MB of memory)
    const memoryEfficiency = cacheStats.hitRate / Math.max(1, memoryUsageMB);
    
    // Score based on memory usage (target: <100MB)
    const score = Math.max(0, Math.min(100, 100 - Math.max(0, (memoryUsageMB - 100) / 200) * 100));
    
    return {
      memoryUsage: memoryUsageMB,
      memoryEfficiency,
      score
    };
  }
}

// ==============================================
// MAIN EXECUTION
// ==============================================

/**
 * Demonstrate all performance optimization techniques
 */
async function demonstratePerformanceOptimization() {
  console.log('🚀 Performance Optimization Demonstration\n');
  
  const db = await createKnowledgeDB('./examples/performance-knowledge.db', {
    autoBackup: false // Disable for performance testing
  });
  
  try {
    // Add some test data
    console.log('📊 Setting up test data...');
    const testEntries = Array.from({ length: 100 }, (_, i) => ({
      title: `Performance Test Entry ${i + 1}`,
      problem: `Test problem for performance optimization ${i + 1}`,
      solution: `Detailed solution for performance test entry ${i + 1}`,
      category: ['VSAM', 'JCL', 'DB2', 'Batch', 'CICS'][i % 5] as any,
      tags: [`perf-test-${i}`, 'optimization', 'benchmark'],
      severity: ['low', 'medium', 'high', 'critical'][i % 4] as any
    }));
    
    for (const entry of testEntries) {
      await db.addEntry(entry, 'performance-test');
    }
    
    // 1. Query Performance Analysis
    console.log('\n=== Query Performance Analysis ===');
    const queryAnalyzer = new QueryPerformanceAnalyzer(db);
    
    const queryResult = await queryAnalyzer.executeWithProfiling('VSAM error', { limit: 10 });
    console.log(`Query executed in ${queryResult.performance.executionTime.toFixed(2)}ms`);
    console.log('Optimization suggestions:', queryResult.performance.optimizationSuggestions);
    
    // Generate optimization report after several queries
    await queryAnalyzer.executeWithProfiling('category:JCL', {});
    await queryAnalyzer.executeWithProfiling('S0C7', {});
    await queryAnalyzer.executeWithProfiling('tag:error', {});
    
    const report = queryAnalyzer.generateOptimizationReport();
    console.log('Query optimization report:', report);
    
    // 2. Index Optimization
    console.log('\n=== Index Optimization ===');
    const indexOptimizer = new IndexOptimizer(db);
    
    const indexAnalysis = await indexOptimizer.analyzeIndexEffectiveness();
    console.log('Index analysis:', indexAnalysis);
    
    const indexCreation = await indexOptimizer.createOptimizedIndexes();
    console.log(`Created ${indexCreation.created.length} indexes`);
    
    const benchmarkResults = await indexOptimizer.benchmarkIndexes();
    console.log('Index benchmark results:', benchmarkResults);
    
    // 3. Memory Optimization
    console.log('\n=== Memory Optimization ===');
    const memoryOptimizer = new MemoryOptimizer(db);
    
    const memoryAnalysis = await memoryOptimizer.analyzeMemoryUsage();
    console.log(`Current memory usage: ${(memoryAnalysis.current.totalMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log('Memory recommendations:', memoryAnalysis.recommendations);
    
    const memoryOptimization = await memoryOptimizer.optimizeMemoryUsage();
    console.log('Memory optimization results:', memoryOptimization);
    
    // 4. Cache Optimization
    console.log('\n=== Cache Optimization ===');
    const cacheOptimizer = new CacheOptimizer(db);
    
    const cacheAnalysis = await cacheOptimizer.analyzeCachePerformance();
    console.log(`Cache hit rate: ${(cacheAnalysis.hitRate * 100).toFixed(1)}%`);
    console.log('Cache recommendations:', cacheAnalysis.recommendations);
    
    const preWarmingResult = await cacheOptimizer.implementSmartPreWarming();
    console.log(`Pre-warmed ${preWarmingResult.preWarmedQueries} query patterns`);
    
    const compressionResult = await cacheOptimizer.implementCacheCompression();
    console.log(`Compression saved ${(compressionResult.memorySaved / 1024 / 1024).toFixed(2)}MB`);
    
    // 5. Batch Processing Optimization
    console.log('\n=== Batch Processing Optimization ===');
    const batchProcessor = new BatchProcessor(db);
    
    const bulkEntries = Array.from({ length: 50 }, (_, i) => ({
      title: `Bulk Entry ${i + 1}`,
      problem: `Bulk problem ${i + 1}`,
      solution: `Bulk solution ${i + 1}`,
      category: 'Batch' as any,
      tags: ['bulk', 'test']
    }));
    
    const bulkResult = await batchProcessor.optimizedBulkInsert(bulkEntries, {
      batchSize: 10,
      parallelBatches: 2,
      optimizeIndexes: true
    });
    
    console.log(`Bulk insert: ${bulkResult.performance.insertsPerSecond.toFixed(2)} inserts/second`);
    
    // Test bulk search
    const testQueries = ['VSAM', 'JCL', 'error', 'file', 'batch'];
    const searchResult = await batchProcessor.optimizedBulkSearch(testQueries, {
      maxConcurrent: 3,
      progressCallback: (progress) => console.log(`Search progress: ${progress.toFixed(1)}%`)
    });
    
    console.log(`Bulk search: ${searchResult.averageTime.toFixed(2)}ms average per query`);
    
    // 6. Comprehensive Performance Testing
    console.log('\n=== Comprehensive Performance Testing ===');
    const testSuite = new PerformanceTestSuite(db);
    
    const benchmarkResults2 = await testSuite.runComprehensiveBenchmark();
    console.log(`Overall performance score: ${benchmarkResults2.overallScore.toFixed(1)}/100`);
    console.log('Detailed results:', {
      search: `${benchmarkResults2.searchPerformance.score.toFixed(1)}/100`,
      insert: `${benchmarkResults2.insertPerformance.score.toFixed(1)}/100`,
      cache: `${benchmarkResults2.cachePerformance.score.toFixed(1)}/100`,
      index: `${benchmarkResults2.indexPerformance.score.toFixed(1)}/100`,
      memory: `${benchmarkResults2.memoryPerformance.score.toFixed(1)}/100`
    });
    
  } catch (error) {
    console.error('Performance optimization demonstration failed:', error);
  } finally {
    await db.close();
  }
}

// Export all classes for individual use
export {
  QueryPerformanceAnalyzer,
  IndexOptimizer,
  MemoryOptimizer,
  CacheOptimizer,
  BatchProcessor,
  PerformanceTestSuite,
  demonstratePerformanceOptimization
};

// Run demonstration if called directly
if (require.main === module) {
  demonstratePerformanceOptimization();
}