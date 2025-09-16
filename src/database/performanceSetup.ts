/**
 * Performance Optimization Setup Script
 * 
 * This script demonstrates how to integrate all performance optimization components
 * for optimal search performance with 1000+ KB entries.
 * 
 * Usage:
 *   import { setupPerformanceOptimizedDB } from './performanceSetup';
 *   const { db, manager } = await setupPerformanceOptimizedDB();
 */

import { KnowledgeDB } from './KnowledgeDB';
import { ConnectionPool } from './ConnectionPool';
import { QueryCache } from './QueryCache';
import { PerformanceManager, PerformanceManagerFactory } from './PerformanceManager';
import { AdvancedIndexStrategy } from './AdvancedIndexStrategy';
import path from 'path';

export interface PerformanceSetupOptions {
  dbPath?: string;
  maxConnections?: number;
  cacheSize?: number;
  enableBenchmarking?: boolean;
  customThresholds?: {
    maxQueryTime?: number;
    minCacheHitRate?: number;
    maxSlowQueryPercent?: number;
  };
}

/**
 * Complete performance optimization setup
 * Returns fully configured and optimized database with performance management
 */
export async function setupPerformanceOptimizedDB(
  options: PerformanceSetupOptions = {}
): Promise<{
  db: KnowledgeDB;
  connectionPool: ConnectionPool;
  cache: QueryCache;
  manager: PerformanceManager;
}> {
  console.log('🚀 Setting up performance-optimized Knowledge Base...');
  
  const {
    dbPath = './knowledge_optimized.db',
    maxConnections = 10,
    cacheSize = 1000,
    enableBenchmarking = true,
    customThresholds = {}
  } = options;

  try {
    // 1. Initialize Connection Pool with optimized settings
    console.log('📊 Initializing optimized connection pool...');
    const connectionPool = new ConnectionPool({
      database: dbPath,
      maxReaders: Math.floor(maxConnections * 0.8), // 80% readers
      maxWriters: Math.ceil(maxConnections * 0.2),  // 20% writers
      busyTimeout: 30000,
      enableWAL: true,
      enableOptimizations: true
    });

    await connectionPool.initialize();
    console.log(`✅ Connection pool initialized (${maxConnections} max connections)`);

    // 2. Setup Query Cache with intelligent pre-warming
    console.log('🗃️ Setting up intelligent query cache...');
    const cache = new QueryCache({
      maxSize: cacheSize,
      ttl: 600000, // 10 minutes default
      enablePreWarming: true,
      compressionThreshold: 1000,
      compressionRatio: 0.7
    });

    await cache.initialize();
    console.log(`✅ Query cache initialized (${cacheSize} entries max)`);

    // 3. Initialize Knowledge Database
    console.log('🧠 Initializing Knowledge Database...');
    const db = new KnowledgeDB(connectionPool, {
      cache,
      enableFullTextSearch: true,
      enableSemanticSearch: true,
      batchSize: 100,
      maxConcurrentSearches: 5
    });

    await db.initialize();
    console.log('✅ Knowledge Database initialized');

    // 4. Apply Advanced Indexing Strategy
    console.log('📈 Applying advanced indexing strategy...');
    const indexStrategy = new AdvancedIndexStrategy();
    await indexStrategy.createOptimizedIndexes(connectionPool.getWriterConnection());
    console.log('✅ Advanced indexes created');

    // 5. Initialize Performance Manager
    console.log('📊 Setting up performance management system...');
    const manager = await PerformanceManagerFactory.create(db, connectionPool, cache, {
      thresholds: {
        maxQueryTime: 1000, // 1 second
        minCacheHitRate: 0.8, // 80%
        maxSlowQueryPercent: 0.05, // 5%
        benchmarkIntervalHours: 24,
        ...customThresholds
      },
      autoInitialize: true
    });

    console.log('✅ Performance Manager initialized');

    // 6. Setup monitoring and alerts
    setupPerformanceMonitoring(manager);

    // 7. Pre-warm cache with common queries if enabled
    if (enableBenchmarking) {
      console.log('🔥 Pre-warming cache with common search patterns...');
      await preWarmCache(db, cache);
      console.log('✅ Cache pre-warmed');
    }

    console.log('🎉 Performance-optimized Knowledge Base setup complete!');
    console.log('📊 Performance targets:');
    console.log(`   • Search latency: < ${customThresholds.maxQueryTime || 1000}ms`);
    console.log(`   • Cache hit rate: > ${(customThresholds.minCacheHitRate || 0.8) * 100}%`);
    console.log(`   • Slow query rate: < ${(customThresholds.maxSlowQueryPercent || 0.05) * 100}%`);

    return { db, connectionPool, cache, manager };

  } catch (error) {
    console.error('❌ Performance optimization setup failed:', error);
    throw error;
  }
}

/**
 * Setup performance monitoring and alerting
 */
function setupPerformanceMonitoring(manager: PerformanceManager): void {
  // Performance alerts
  manager.on('alert', (alert) => {
    const emoji = {
      low: '💡',
      medium: '⚠️',
      high: '🚨',
      critical: '🔥'
    }[alert.severity];
    
    console.log(`${emoji} Performance Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);
    console.log(`   Recommendation: ${alert.recommendation}`);
  });

  // Optimization completion
  manager.on('optimization_applied', (result) => {
    console.log(`✅ Applied optimization: ${result.strategy.name} (${result.result.improvement}% improvement)`);
  });

  // Benchmark completion
  manager.on('benchmark_completed', (result) => {
    console.log(`📈 Benchmark completed: Score ${result.score.toFixed(2)}/100`);
  });

  // Slow query detection
  manager.on('slow_query', (data) => {
    console.log(`🐌 Slow query detected: ${data.queryTime}ms (threshold: ${data.threshold}ms)`);
  });

  // Metrics updates (every 5 minutes)
  let lastMetricsLog = 0;
  manager.on('metrics_updated', (metrics) => {
    const now = Date.now();
    if (now - lastMetricsLog > 300000) { // 5 minutes
      console.log('📊 Performance Metrics Update:');
      console.log(`   • Avg Query Time: ${metrics.avgQueryTime.toFixed(2)}ms`);
      console.log(`   • Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
      console.log(`   • Total Queries: ${metrics.totalQueries}`);
      console.log(`   • Connection Pool: ${(metrics.connectionPoolUtilization * 100).toFixed(1)}%`);
      lastMetricsLog = now;
    }
  });
}

/**
 * Pre-warm cache with common search patterns
 */
async function preWarmCache(db: KnowledgeDB, cache: QueryCache): Promise<void> {
  const commonQueries = [
    // Category-based searches
    'category:VSAM',
    'category:JCL',
    'category:DB2',
    'category:Batch',
    'category:Functional',
    
    // Common error patterns
    'S0C7',
    'S0C4',
    'VSAM status',
    'dataset not found',
    'JCL error',
    'DB2 error',
    
    // Frequent problem types
    'abend',
    'error',
    'failure',
    'timeout',
    'performance',
    'connection',
    
    // System components
    'CICS',
    'IMS',
    'TSO',
    'ISPF',
    'FTP',
    'sort'
  ];

  console.log(`🔥 Pre-warming cache with ${commonQueries.length} common queries...`);
  
  const preWarmPromises = commonQueries.map(async (query, index) => {
    try {
      // Add small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, index * 50));
      await db.search(query, { limit: 10, useCache: true });
    } catch (error) {
      console.warn(`⚠️ Failed to pre-warm query "${query}":`, error.message);
    }
  });

  await Promise.all(preWarmPromises);
  console.log('✅ Cache pre-warming completed');
}

/**
 * Quick setup for development/testing
 * Uses in-memory database and reduced settings for fast startup
 */
export async function setupDevelopmentDB(): Promise<{
  db: KnowledgeDB;
  connectionPool: ConnectionPool;
  cache: QueryCache;
  manager: PerformanceManager;
}> {
  return setupPerformanceOptimizedDB({
    dbPath: ':memory:',
    maxConnections: 5,
    cacheSize: 500,
    enableBenchmarking: false,
    customThresholds: {
      maxQueryTime: 500, // Stricter for development
      minCacheHitRate: 0.7,
      maxSlowQueryPercent: 0.1
    }
  });
}

/**
 * Production setup with enterprise-grade settings
 */
export async function setupProductionDB(dbPath: string): Promise<{
  db: KnowledgeDB;
  connectionPool: ConnectionPool;
  cache: QueryCache;
  manager: PerformanceManager;
}> {
  return setupPerformanceOptimizedDB({
    dbPath,
    maxConnections: 20,
    cacheSize: 5000,
    enableBenchmarking: true,
    customThresholds: {
      maxQueryTime: 800, // Slightly more lenient for production load
      minCacheHitRate: 0.85, // Higher cache requirements
      maxSlowQueryPercent: 0.03 // Stricter slow query limits
    }
  });
}

/**
 * Performance validation script
 * Runs comprehensive tests to validate optimization effectiveness
 */
export async function validatePerformanceOptimizations(
  db: KnowledgeDB,
  manager: PerformanceManager
): Promise<{
  passed: boolean;
  results: any[];
  recommendations: string[];
}> {
  console.log('🧪 Running performance validation tests...');
  
  const results: any[] = [];
  const recommendations: string[] = [];
  
  try {
    // Test 1: Search latency under load
    console.log('🔍 Testing search latency...');
    const searchStartTime = Date.now();
    const searchPromises = Array.from({ length: 50 }, (_, i) => 
      db.search(`test query ${i}`, { limit: 10 })
    );
    
    const searchResults = await Promise.all(searchPromises);
    const searchDuration = Date.now() - searchStartTime;
    const avgSearchTime = searchDuration / searchPromises.length;
    
    results.push({
      test: 'concurrent_search_latency',
      passed: avgSearchTime < 1000,
      value: avgSearchTime,
      threshold: 1000
    });
    
    if (avgSearchTime > 800) {
      recommendations.push('Consider adding more specific indexes for common query patterns');
    }
    
    // Test 2: Cache effectiveness
    console.log('🗃️ Testing cache effectiveness...');
    const cacheQuery = 'category:VSAM';
    
    // First query (cache miss)
    const firstQueryStart = Date.now();
    await db.search(cacheQuery);
    const firstQueryTime = Date.now() - firstQueryStart;
    
    // Second query (should be cache hit)
    const secondQueryStart = Date.now();
    await db.search(cacheQuery);
    const secondQueryTime = Date.now() - secondQueryStart;
    
    const cacheSpeedup = firstQueryTime / Math.max(secondQueryTime, 1);
    
    results.push({
      test: 'cache_speedup',
      passed: cacheSpeedup > 2, // Cache should be at least 2x faster
      value: cacheSpeedup,
      threshold: 2
    });
    
    if (cacheSpeedup < 3) {
      recommendations.push('Cache may need tuning - consider adjusting TTL or pre-warming strategy');
    }
    
    // Test 3: Memory efficiency
    console.log('💾 Testing memory usage...');
    const memUsage = process.memoryUsage();
    const memoryEfficient = memUsage.heapUsed < 500 * 1024 * 1024; // Less than 500MB
    
    results.push({
      test: 'memory_efficiency',
      passed: memoryEfficient,
      value: Math.round(memUsage.heapUsed / 1024 / 1024),
      threshold: 500
    });
    
    if (!memoryEfficient) {
      recommendations.push('Memory usage is high - consider optimizing cache size or query patterns');
    }
    
    // Generate overall result
    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;
    const overallPassed = passedTests === totalTests;
    
    console.log(`📊 Validation Results: ${passedTests}/${totalTests} tests passed`);
    results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.test}: ${result.value} (threshold: ${result.threshold})`);
    });
    
    if (recommendations.length > 0) {
      console.log('💡 Recommendations:');
      recommendations.forEach(rec => console.log(`   • ${rec}`));
    }
    
    return {
      passed: overallPassed,
      results,
      recommendations
    };
    
  } catch (error) {
    console.error('❌ Performance validation failed:', error);
    return {
      passed: false,
      results: [],
      recommendations: ['Performance validation failed - check system health']
    };
  }
}

/**
 * Export helper for easy import in other modules
 */
export * from './PerformanceManager';
export { KnowledgeDB } from './KnowledgeDB';
export { ConnectionPool } from './ConnectionPool';
export { QueryCache } from './QueryCache';
export { AdvancedIndexStrategy } from './AdvancedIndexStrategy';
export { SearchOptimizationEngine } from './SearchOptimizationEngine';
export { SearchPerformanceBenchmark } from './SearchPerformanceBenchmark';