/**
 * Complete Cache System Usage Example
 * 
 * Demonstrates how to integrate the multi-layer caching architecture
 * with the existing Knowledge Database for optimal performance.
 */

import Database from 'better-sqlite3';
import { KnowledgeDB } from '../database/KnowledgeDB';
import { CacheSystemIntegration, createCacheSystem, MVPConfigurations } from './CacheSystemIntegration';

/**
 * Enhanced Knowledge Database with integrated caching
 */
export class CachedKnowledgeDB extends KnowledgeDB {
  private cacheSystem: CacheSystemIntegration;
  private mvpLevel: 1 | 2 | 3 | 4 | 5;

  constructor(
    dbPath: string = './knowledge.db',
    mvpLevel: 1 | 2 | 3 | 4 | 5 = 1,
    options?: {
      backupDir?: string;
      maxBackups?: number;
      autoBackup?: boolean;
      backupInterval?: number;
      enableCaching?: boolean;
    }
  ) {
    super(dbPath, options);
    this.mvpLevel = mvpLevel;
    
    if (options?.enableCaching !== false) {
      this.initializeCaching().catch(error => {
        console.error('Failed to initialize caching:', error);
      });
    }
  }

  private async initializeCaching(): Promise<void> {
    try {
      const config = MVPConfigurations[`MVP${this.mvpLevel}` as keyof typeof MVPConfigurations];
      this.cacheSystem = await createCacheSystem(this['db'], config);
      
      console.log(`🚀 Cached Knowledge DB initialized for MVP${this.mvpLevel}`);
    } catch (error) {
      console.error('Cache system initialization failed:', error);
    }
  }

  /**
   * Enhanced search with multi-layer caching
   */
  async search(query: string, options?: any): Promise<any[]> {
    // If caching is available, use it
    if (this.cacheSystem) {
      return this.cacheSystem.searchKB(query, {
        limit: options?.limit,
        category: options?.category,
        userContext: options?.userId,
        useAI: options?.useAI
      });
    }
    
    // Fallback to original search
    return super.search(query, options);
  }

  /**
   * Pattern analysis with caching (MVP2+)
   */
  async getPatterns(timeWindow: string = '24h', userId?: string): Promise<any[]> {
    if (!this.cacheSystem || this.mvpLevel < 2) {
      throw new Error('Pattern analysis requires MVP2+ with caching enabled');
    }
    
    return this.cacheSystem.analyzePatterns(timeWindow, { userContext: userId });
  }

  /**
   * Code analysis with caching (MVP3+)
   */
  async analyzeCode(filePath: string, analysisType?: string, userId?: string): Promise<any> {
    if (!this.cacheSystem || this.mvpLevel < 3) {
      throw new Error('Code analysis requires MVP3+ with caching enabled');
    }
    
    return this.cacheSystem.analyzeCode(filePath, {
      analysisType: analysisType as any,
      userContext: userId
    });
  }

  /**
   * Get system performance statistics
   */
  getCacheStats(): any {
    return this.cacheSystem?.getSystemStats() || null;
  }

  /**
   * Manual cache warming
   */
  async warmCache(strategy?: string, userId?: string): Promise<number> {
    if (!this.cacheSystem) return 0;
    return this.cacheSystem.warmCache(strategy as any, userId);
  }

  /**
   * Cache invalidation when data changes
   */
  async invalidateRelatedCache(entryId?: string, category?: string): Promise<void> {
    if (!this.cacheSystem) return;
    
    const tags = ['search', 'kb-entries'];
    if (category) tags.push(category.toLowerCase());
    
    await this.cacheSystem.invalidateCache(
      entryId ? `*${entryId}*` : undefined,
      tags,
      'data-updated'
    );
  }

  /**
   * Enhanced addEntry with cache invalidation
   */
  async addEntry(entry: any, userId?: string): Promise<string> {
    const entryId = await super.addEntry(entry, userId);
    
    // Invalidate relevant cache entries
    await this.invalidateRelatedCache(entryId, entry.category);
    
    return entryId;
  }

  /**
   * Enhanced updateEntry with cache invalidation
   */
  async updateEntry(id: string, updates: any, userId?: string): Promise<void> {
    await super.updateEntry(id, updates, userId);
    
    // Invalidate relevant cache entries
    await this.invalidateRelatedCache(id, updates.category);
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport(timeframe?: 'hourly' | 'daily' | 'weekly'): any {
    if (!this.cacheSystem) {
      return { error: 'Caching not enabled' };
    }
    
    return this.cacheSystem.generatePerformanceReport(timeframe);
  }

  /**
   * Shutdown with cache cleanup
   */
  async close(): Promise<void> {
    if (this.cacheSystem) {
      await this.cacheSystem.shutdown();
    }
    
    await super.close();
  }
}

/**
 * Performance testing and benchmarking utilities
 */
export class CachePerformanceTester {
  private db: CachedKnowledgeDB;
  private testQueries: string[] = [
    'VSAM Status 35',
    'S0C7 data exception',
    'JCL error dataset not found',
    'DB2 SQLCODE -904',
    'IMS U0778 database unavailable'
  ];

  constructor(db: CachedKnowledgeDB) {
    this.db = db;
  }

  /**
   * Run comprehensive cache performance tests
   */
  async runPerformanceTest(iterations: number = 100): Promise<{
    cacheEnabled: any;
    cacheDisabled: any;
    improvement: any;
  }> {
    console.log(`🧪 Running cache performance test with ${iterations} iterations...`);
    
    // Test with cache enabled
    const cacheEnabledResults = await this.runTestSuite(iterations, true);
    
    // Test with cache disabled (direct DB calls)
    const cacheDisabledResults = await this.runTestSuite(iterations, false);
    
    // Calculate improvements
    const improvement = {
      responseTime: ((cacheDisabledResults.avgResponseTime - cacheEnabledResults.avgResponseTime) / cacheDisabledResults.avgResponseTime) * 100,
      throughput: ((cacheEnabledResults.requestsPerSecond - cacheDisabledResults.requestsPerSecond) / cacheDisabledResults.requestsPerSecond) * 100,
      hitRate: cacheEnabledResults.cacheHitRate,
      memoryUsage: cacheEnabledResults.memoryUsage
    };
    
    console.log('📊 Performance test completed:');
    console.log(`  Cache enabled: ${cacheEnabledResults.avgResponseTime.toFixed(2)}ms avg`);
    console.log(`  Cache disabled: ${cacheDisabledResults.avgResponseTime.toFixed(2)}ms avg`);
    console.log(`  Improvement: ${improvement.responseTime.toFixed(1)}% faster`);
    console.log(`  Hit rate: ${(improvement.hitRate * 100).toFixed(1)}%`);
    
    return {
      cacheEnabled: cacheEnabledResults,
      cacheDisabled: cacheDisabledResults,
      improvement
    };
  }

  private async runTestSuite(iterations: number, useCache: boolean): Promise<any> {
    const startTime = Date.now();
    const responseTimes: number[] = [];
    let cacheHits = 0;
    
    for (let i = 0; i < iterations; i++) {
      const query = this.testQueries[i % this.testQueries.length];
      const queryStart = performance.now();
      
      try {
        if (useCache) {
          await this.db.search(query, { userId: 'test-user' });
        } else {
          // Direct database call bypassing cache
          await super.search.call(this.db, query);
        }
        
        const queryTime = performance.now() - queryStart;
        responseTimes.push(queryTime);
        
        // Assume cache hit if response time < 10ms
        if (useCache && queryTime < 10) {
          cacheHits++;
        }
        
      } catch (error) {
        console.error(`Test query failed: ${query}`, error);
      }
      
      // Small delay to avoid overwhelming the system
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
    
    const totalTime = Date.now() - startTime;
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const p95ResponseTime = this.calculatePercentile(responseTimes, 95);
    const p99ResponseTime = this.calculatePercentile(responseTimes, 99);
    const requestsPerSecond = (iterations * 1000) / totalTime;
    
    return {
      iterations,
      totalTime,
      avgResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      requestsPerSecond,
      cacheHitRate: useCache ? cacheHits / iterations : 0,
      memoryUsage: useCache ? (this.db.getCacheStats()?.performance?.memoryUsage || 0) : 0
    };
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    const sorted = [...sortedArray].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sorted[lower];
    }
    
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
}

/**
 * Complete usage example
 */
export async function demonstrateFullCacheIntegration(): Promise<void> {
  console.log('🚀 Starting comprehensive cache system demonstration...');
  
  // Initialize cached Knowledge DB for MVP3
  const db = new CachedKnowledgeDB('./demo_knowledge.db', 3, {
    enableCaching: true,
    autoBackup: true
  });
  
  try {
    // Wait for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 1. Demonstrate basic cached search
    console.log('\n📁 Testing cached search operations...');
    const searchResults = await db.search('VSAM Status 35', {
      userId: 'demo-user',
      category: 'VSAM'
    });
    console.log(`Found ${searchResults.length} results`);
    
    // 2. Demonstrate pattern analysis (MVP2+)
    console.log('\n📊 Testing pattern analysis...');
    try {
      const patterns = await db.getPatterns('24h', 'demo-user');
      console.log(`Found ${patterns.length} patterns`);
    } catch (error) {
      console.log('Pattern analysis not available:', error.message);
    }
    
    // 3. Demonstrate code analysis (MVP3+)
    console.log('\n💻 Testing code analysis...');
    try {
      const codeAnalysis = await db.analyzeCode('/path/to/cobol/file.cbl', 'syntax', 'demo-user');
      console.log('Code analysis completed:', Object.keys(codeAnalysis));
    } catch (error) {
      console.log('Code analysis not available:', error.message);
    }
    
    // 4. Manual cache warming
    console.log('\n🔥 Testing cache warming...');
    const warmedEntries = await db.warmCache('popular', 'demo-user');
    console.log(`Warmed ${warmedEntries} cache entries`);
    
    // 5. Performance statistics
    console.log('\n📊 Cache performance statistics:');
    const stats = db.getCacheStats();
    if (stats) {
      console.log(`  Overall hit rate: ${(stats.performance.overallHitRate * 100).toFixed(1)}%`);
      console.log(`  Average response time: ${stats.performance.avgResponseTime.toFixed(2)}ms`);
      console.log(`  SLA compliance: ${(stats.performance.slaCompliance * 100).toFixed(1)}%`);
      console.log(`  Performance grade: ${stats.performance.grade}`);
    }
    
    // 6. Run performance benchmark
    console.log('\n🧪 Running performance benchmark...');
    const tester = new CachePerformanceTester(db);
    const benchmarkResults = await tester.runPerformanceTest(50);
    
    console.log('\n📈 Benchmark Results:');
    console.log(`  Performance improvement: ${benchmarkResults.improvement.responseTime.toFixed(1)}%`);
    console.log(`  Throughput improvement: ${benchmarkResults.improvement.throughput.toFixed(1)}%`);
    console.log(`  Cache hit rate: ${(benchmarkResults.improvement.hitRate * 100).toFixed(1)}%`);
    
    // 7. Generate comprehensive report
    console.log('\n📋 Generating performance report...');
    const report = db.generatePerformanceReport('hourly');
    console.log(`  Report generated with ${report.period?.dataPoints || 0} data points`);
    console.log(`  Performance grade: ${report.sla?.performanceGrade || 'N/A'}`);
    console.log(`  Recommendations: ${report.recommendations?.performance?.length || 0}`);
    
    console.log('\n✅ Cache system demonstration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during demonstration:', error);
  } finally {
    // Clean up
    await db.close();
  }
}

/**
 * MVP-specific configuration examples
 */
export const MVPUsageExamples = {
  /**
   * MVP1: Basic Knowledge Base with simple caching
   */
  MVP1: async () => {
    const db = new CachedKnowledgeDB('./kb_mvp1.db', 1);
    
    // Simple search operations
    const results = await db.search('error handling');
    console.log(`MVP1 - Found ${results.length} results`);
    
    return db;
  },
  
  /**
   * MVP2: Pattern detection with enhanced caching
   */
  MVP2: async () => {
    const db = new CachedKnowledgeDB('./kb_mvp2.db', 2);
    
    // Search + pattern analysis
    const results = await db.search('batch processing');
    const patterns = await db.getPatterns('weekly');
    
    console.log(`MVP2 - Found ${results.length} results, ${patterns.length} patterns`);
    return db;
  },
  
  /**
   * MVP3: Code integration with comprehensive caching
   */
  MVP3: async () => {
    const db = new CachedKnowledgeDB('./kb_mvp3.db', 3);
    
    // Search + patterns + code analysis
    const results = await db.search('COBOL errors');
    const patterns = await db.getPatterns('daily');
    const codeAnalysis = await db.analyzeCode('program.cbl');
    
    console.log(`MVP3 - Full integration: ${results.length} results, ${patterns.length} patterns`);
    return db;
  },
  
  /**
   * MVP5: Enterprise with distributed caching
   */
  MVP5: async () => {
    const db = new CachedKnowledgeDB('./kb_mvp5.db', 5);
    
    // Full enterprise features
    await db.warmCache('predictive', 'enterprise-user');
    const stats = db.getCacheStats();
    
    console.log(`MVP5 - Enterprise grade: ${(stats.performance.slaCompliance * 100).toFixed(1)}% SLA`);
    return db;
  }
};

// Export for testing
export { CachedKnowledgeDB };

// Run demonstration if this file is executed directly
if (require.main === module) {
  demonstrateFullCacheIntegration().catch(console.error);
}