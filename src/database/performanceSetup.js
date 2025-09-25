'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SearchPerformanceBenchmark =
  exports.SearchOptimizationEngine =
  exports.AdvancedIndexStrategy =
  exports.QueryCache =
  exports.ConnectionPool =
  exports.KnowledgeDB =
    void 0;
exports.setupPerformanceOptimizedDB = setupPerformanceOptimizedDB;
exports.setupDevelopmentDB = setupDevelopmentDB;
exports.setupProductionDB = setupProductionDB;
exports.validatePerformanceOptimizations = validatePerformanceOptimizations;
const tslib_1 = require('tslib');
const KnowledgeDB_1 = require('./KnowledgeDB');
const ConnectionPool_1 = require('./ConnectionPool');
const QueryCache_1 = require('./QueryCache');
const PerformanceManager_1 = require('./PerformanceManager');
const AdvancedIndexStrategy_1 = require('./AdvancedIndexStrategy');
async function setupPerformanceOptimizedDB(options = {}) {
  console.log('🚀 Setting up performance-optimized Knowledge Base...');
  const {
    dbPath = './knowledge_optimized.db',
    maxConnections = 10,
    cacheSize = 1000,
    enableBenchmarking = true,
    customThresholds = {},
  } = options;
  try {
    console.log('📊 Initializing optimized connection pool...');
    const connectionPool = new ConnectionPool_1.ConnectionPool({
      database: dbPath,
      maxReaders: Math.floor(maxConnections * 0.8),
      maxWriters: Math.ceil(maxConnections * 0.2),
      busyTimeout: 30000,
      enableWAL: true,
      enableOptimizations: true,
    });
    await connectionPool.initialize();
    console.log(`✅ Connection pool initialized (${maxConnections} max connections)`);
    console.log('🗃️ Setting up intelligent query cache...');
    const cache = new QueryCache_1.QueryCache({
      maxSize: cacheSize,
      ttl: 600000,
      enablePreWarming: true,
      compressionThreshold: 1000,
      compressionRatio: 0.7,
    });
    await cache.initialize();
    console.log(`✅ Query cache initialized (${cacheSize} entries max)`);
    console.log('🧠 Initializing Knowledge Database...');
    const db = new KnowledgeDB_1.KnowledgeDB(connectionPool, {
      cache,
      enableFullTextSearch: true,
      enableSemanticSearch: true,
      batchSize: 100,
      maxConcurrentSearches: 5,
    });
    await db.initialize();
    console.log('✅ Knowledge Database initialized');
    console.log('📈 Applying advanced indexing strategy...');
    const indexStrategy = new AdvancedIndexStrategy_1.AdvancedIndexStrategy();
    await indexStrategy.createOptimizedIndexes(connectionPool.getWriterConnection());
    console.log('✅ Advanced indexes created');
    console.log('📊 Setting up performance management system...');
    const manager = await PerformanceManager_1.PerformanceManagerFactory.create(
      db,
      connectionPool,
      cache,
      {
        thresholds: {
          maxQueryTime: 1000,
          minCacheHitRate: 0.8,
          maxSlowQueryPercent: 0.05,
          benchmarkIntervalHours: 24,
          ...customThresholds,
        },
        autoInitialize: true,
      }
    );
    console.log('✅ Performance Manager initialized');
    setupPerformanceMonitoring(manager);
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
function setupPerformanceMonitoring(manager) {
  manager.on('alert', alert => {
    const emoji = {
      low: '💡',
      medium: '⚠️',
      high: '🚨',
      critical: '🔥',
    }[alert.severity];
    console.log(`${emoji} Performance Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);
    console.log(`   Recommendation: ${alert.recommendation}`);
  });
  manager.on('optimization_applied', result => {
    console.log(
      `✅ Applied optimization: ${result.strategy.name} (${result.result.improvement}% improvement)`
    );
  });
  manager.on('benchmark_completed', result => {
    console.log(`📈 Benchmark completed: Score ${result.score.toFixed(2)}/100`);
  });
  manager.on('slow_query', data => {
    console.log(`🐌 Slow query detected: ${data.queryTime}ms (threshold: ${data.threshold}ms)`);
  });
  let lastMetricsLog = 0;
  manager.on('metrics_updated', metrics => {
    const now = Date.now();
    if (now - lastMetricsLog > 300000) {
      console.log('📊 Performance Metrics Update:');
      console.log(`   • Avg Query Time: ${metrics.avgQueryTime.toFixed(2)}ms`);
      console.log(`   • Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
      console.log(`   • Total Queries: ${metrics.totalQueries}`);
      console.log(`   • Connection Pool: ${(metrics.connectionPoolUtilization * 100).toFixed(1)}%`);
      lastMetricsLog = now;
    }
  });
}
async function preWarmCache(db, cache) {
  const commonQueries = [
    'category:VSAM',
    'category:JCL',
    'category:DB2',
    'category:Batch',
    'category:Functional',
    'S0C7',
    'S0C4',
    'VSAM status',
    'dataset not found',
    'JCL error',
    'DB2 error',
    'abend',
    'error',
    'failure',
    'timeout',
    'performance',
    'connection',
    'CICS',
    'IMS',
    'TSO',
    'ISPF',
    'FTP',
    'sort',
  ];
  console.log(`🔥 Pre-warming cache with ${commonQueries.length} common queries...`);
  const preWarmPromises = commonQueries.map(async (query, index) => {
    try {
      await new Promise(resolve => setTimeout(resolve, index * 50));
      await db.search(query, { limit: 10, useCache: true });
    } catch (error) {
      console.warn(`⚠️ Failed to pre-warm query "${query}":`, error.message);
    }
  });
  await Promise.all(preWarmPromises);
  console.log('✅ Cache pre-warming completed');
}
async function setupDevelopmentDB() {
  return setupPerformanceOptimizedDB({
    dbPath: ':memory:',
    maxConnections: 5,
    cacheSize: 500,
    enableBenchmarking: false,
    customThresholds: {
      maxQueryTime: 500,
      minCacheHitRate: 0.7,
      maxSlowQueryPercent: 0.1,
    },
  });
}
async function setupProductionDB(dbPath) {
  return setupPerformanceOptimizedDB({
    dbPath,
    maxConnections: 20,
    cacheSize: 5000,
    enableBenchmarking: true,
    customThresholds: {
      maxQueryTime: 800,
      minCacheHitRate: 0.85,
      maxSlowQueryPercent: 0.03,
    },
  });
}
async function validatePerformanceOptimizations(db, manager) {
  console.log('🧪 Running performance validation tests...');
  const results = [];
  const recommendations = [];
  try {
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
      threshold: 1000,
    });
    if (avgSearchTime > 800) {
      recommendations.push('Consider adding more specific indexes for common query patterns');
    }
    console.log('🗃️ Testing cache effectiveness...');
    const cacheQuery = 'category:VSAM';
    const firstQueryStart = Date.now();
    await db.search(cacheQuery);
    const firstQueryTime = Date.now() - firstQueryStart;
    const secondQueryStart = Date.now();
    await db.search(cacheQuery);
    const secondQueryTime = Date.now() - secondQueryStart;
    const cacheSpeedup = firstQueryTime / Math.max(secondQueryTime, 1);
    results.push({
      test: 'cache_speedup',
      passed: cacheSpeedup > 2,
      value: cacheSpeedup,
      threshold: 2,
    });
    if (cacheSpeedup < 3) {
      recommendations.push(
        'Cache may need tuning - consider adjusting TTL or pre-warming strategy'
      );
    }
    console.log('💾 Testing memory usage...');
    const memUsage = process.memoryUsage();
    const memoryEfficient = memUsage.heapUsed < 500 * 1024 * 1024;
    results.push({
      test: 'memory_efficiency',
      passed: memoryEfficient,
      value: Math.round(memUsage.heapUsed / 1024 / 1024),
      threshold: 500,
    });
    if (!memoryEfficient) {
      recommendations.push(
        'Memory usage is high - consider optimizing cache size or query patterns'
      );
    }
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
      recommendations,
    };
  } catch (error) {
    console.error('❌ Performance validation failed:', error);
    return {
      passed: false,
      results: [],
      recommendations: ['Performance validation failed - check system health'],
    };
  }
}
tslib_1.__exportStar(require('./PerformanceManager'), exports);
const KnowledgeDB_2 = require('./KnowledgeDB');
Object.defineProperty(exports, 'KnowledgeDB', {
  enumerable: true,
  get() {
    return KnowledgeDB_2.KnowledgeDB;
  },
});
const ConnectionPool_2 = require('./ConnectionPool');
Object.defineProperty(exports, 'ConnectionPool', {
  enumerable: true,
  get() {
    return ConnectionPool_2.ConnectionPool;
  },
});
const QueryCache_2 = require('./QueryCache');
Object.defineProperty(exports, 'QueryCache', {
  enumerable: true,
  get() {
    return QueryCache_2.QueryCache;
  },
});
const AdvancedIndexStrategy_2 = require('./AdvancedIndexStrategy');
Object.defineProperty(exports, 'AdvancedIndexStrategy', {
  enumerable: true,
  get() {
    return AdvancedIndexStrategy_2.AdvancedIndexStrategy;
  },
});
const SearchOptimizationEngine_1 = require('./SearchOptimizationEngine');
Object.defineProperty(exports, 'SearchOptimizationEngine', {
  enumerable: true,
  get() {
    return SearchOptimizationEngine_1.SearchOptimizationEngine;
  },
});
const SearchPerformanceBenchmark_1 = require('./SearchPerformanceBenchmark');
Object.defineProperty(exports, 'SearchPerformanceBenchmark', {
  enumerable: true,
  get() {
    return SearchPerformanceBenchmark_1.SearchPerformanceBenchmark;
  },
});
//# sourceMappingURL=performanceSetup.js.map
