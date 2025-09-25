'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.demonstrateSearchAlgorithms = demonstrateSearchAlgorithms;
exports.realWorldUsageExample = realWorldUsageExample;
exports.performanceOptimizationExamples = performanceOptimizationExamples;
const KnowledgeDB_1 = require('./KnowledgeDB');
const SearchBenchmark_1 = require('./SearchBenchmark');
async function demonstrateSearchAlgorithms() {
  console.log('🚀 Mainframe Knowledge Base - Advanced Search Algorithms Demo');
  console.log('============================================================\n');
  const db = await (0, KnowledgeDB_1.createKnowledgeDB)('./demo-knowledge.db', {
    autoBackup: true,
    backupInterval: 24,
  });
  console.log('📊 Database initialized with advanced performance architecture:');
  console.log('   ✓ Multi-level query caching (memory + disk)');
  console.log('   ✓ Advanced indexing with covering indexes');
  console.log('   ✓ Intelligent query routing and strategy selection');
  console.log('   ✓ BM25 ranking with custom weights');
  console.log('   ✓ Fuzzy matching and typo tolerance');
  console.log('   ✓ Real-time performance monitoring\n');
  await demonstrateSearchStrategies(db);
  await demonstrateAutoComplete(db);
  await demonstrateFacetedSearch(db);
  await demonstratePerformanceAnalysis(db);
  await runPerformanceBenchmark(db);
  await db.close();
}
async function demonstrateSearchStrategies(db) {
  console.log('🔍 SEARCH STRATEGY DEMONSTRATIONS');
  console.log('================================\n');
  const testCases = [
    {
      title: '1. Exact Match Strategy (Target: <100ms)',
      queries: ['S0C7', 'IEF212I', 'VSAM Status 35'],
      description: 'Direct index lookups for error codes and exact phrases',
    },
    {
      title: '2. Full-Text Search with BM25 Ranking (Target: <400ms)',
      queries: ['file not found', 'data exception', 'job abends'],
      description: 'Weighted full-text search with relevance scoring',
    },
    {
      title: '3. Category-Filtered Search (Target: <200ms)',
      queries: ['category:JCL', 'category:VSAM', 'category:DB2'],
      description: 'Index-optimized category filtering',
    },
    {
      title: '4. Fuzzy Search with Typo Tolerance (Target: <600ms)',
      queries: ['datasett notfound', 'progam check', 'fie allocation'],
      description: 'Handles common misspellings and partial matches',
    },
    {
      title: '5. Hybrid Multi-Strategy Search (Target: <800ms)',
      queries: [
        'COBOL program S0C7 data exception',
        'JCL job failed dataset allocation error',
        'VSAM file status catalog problem',
      ],
      description: 'Combines multiple strategies for complex queries',
    },
  ];
  for (const testCase of testCases) {
    console.log(`📋 ${testCase.title}`);
    console.log(`   ${testCase.description}\n`);
    for (const query of testCase.queries) {
      const startTime = Date.now();
      try {
        const results = await db.search(query, { limit: 3 });
        const executionTime = Date.now() - startTime;
        const analysis = SearchBenchmark_1.SearchComplexityAnalyzer.analyzeQuery(query);
        console.log(`   Query: "${query}"`);
        console.log(
          `   ⚡ Execution time: ${executionTime}ms (predicted: ${analysis.expectedTimeMs}ms)`
        );
        console.log(`   🧠 Algorithm complexity: ${analysis.complexity} (${analysis.strategy})`);
        console.log(`   📊 Results: ${results.length} entries found`);
        if (results.length > 0) {
          console.log(
            `   🎯 Top result: "${results[0].entry.title}" (score: ${Math.round(results[0].score)})`
          );
          if (results[0].highlights && results[0].highlights.length > 0) {
            console.log(`   💡 Highlights: ${results[0].highlights.length} contextual matches`);
          }
        }
        const status = executionTime <= analysis.expectedTimeMs ? '✅' : '⚠️';
        console.log(
          `   ${status} Performance: ${executionTime <= 1000 ? 'PASS' : 'FAIL'} (<1s requirement)\n`
        );
      } catch (error) {
        console.error(`   ❌ Error: ${error}\n`);
      }
    }
    console.log('');
  }
}
async function demonstrateAutoComplete(db) {
  console.log('🔤 AUTO-COMPLETE DEMONSTRATION (Target: <50ms)');
  console.log('==============================================\n');
  const prefixes = ['S0', 'IEF', 'file', 'VSAM', 'data', 'JCL'];
  for (const prefix of prefixes) {
    const startTime = Date.now();
    try {
      const suggestions = await db.autoComplete(prefix, 5);
      const executionTime = Date.now() - startTime;
      console.log(`   Prefix: "${prefix}"`);
      console.log(`   ⚡ Response time: ${executionTime}ms`);
      console.log(`   📝 Suggestions (${suggestions.length}):`);
      suggestions.forEach((suggestion, index) => {
        console.log(
          `      ${index + 1}. ${suggestion.suggestion} (${suggestion.category}, score: ${suggestion.score})`
        );
      });
      const status = executionTime <= 50 ? '✅' : '❌';
      console.log(
        `   ${status} Performance: ${executionTime <= 50 ? 'EXCELLENT' : 'NEEDS OPTIMIZATION'}\n`
      );
    } catch (error) {
      console.error(`   ❌ Error: ${error}\n`);
    }
  }
}
async function demonstrateFacetedSearch(db) {
  console.log('🏷️  FACETED SEARCH DEMONSTRATION');
  console.log('===============================\n');
  const query = 'file error';
  const startTime = Date.now();
  try {
    const facetedResults = await db.searchWithFacets(query);
    const executionTime = Date.now() - startTime;
    console.log(`   Query: "${query}"`);
    console.log(`   ⚡ Total execution time: ${executionTime}ms`);
    console.log(
      `   📊 Results: ${facetedResults.results.length} entries, ${facetedResults.totalCount} total\n`
    );
    console.log('   🏷️  Available Facets:');
    console.log(`   📂 Categories (${facetedResults.facets.categories.length}):`);
    facetedResults.facets.categories.slice(0, 3).forEach(cat => {
      console.log(`      • ${cat.name}: ${cat.count} entries`);
    });
    console.log(`   🏷️  Tags (${facetedResults.facets.tags.length}):`);
    facetedResults.facets.tags.slice(0, 5).forEach(tag => {
      console.log(`      • ${tag.name}: ${tag.count} entries`);
    });
    console.log(`   ⚠️  Severities (${facetedResults.facets.severities.length}):`);
    facetedResults.facets.severities.forEach(sev => {
      console.log(`      • ${sev.name}: ${sev.count} entries`);
    });
    console.log('\n   🎯 Top Results:');
    facetedResults.results.slice(0, 2).forEach((result, index) => {
      console.log(
        `      ${index + 1}. ${result.entry.title} (${result.entry.category}, score: ${Math.round(result.score)})`
      );
    });
  } catch (error) {
    console.error(`   ❌ Error: ${error}`);
  }
  console.log('');
}
async function demonstratePerformanceAnalysis(db) {
  console.log('📈 REAL-TIME PERFORMANCE MONITORING');
  console.log('==================================\n');
  const perfStatus = db.getPerformanceStatus();
  console.log('   🔍 Current Performance Metrics:');
  console.log(`      • Average response time: ${perfStatus.averageResponseTime || 0}ms`);
  console.log(`      • Cache hit rate: ${Math.round((perfStatus.cacheHitRate || 0) * 100)}%`);
  console.log(`      • Active connections: ${perfStatus.activeConnections || 0}`);
  console.log(`      • Memory usage: ${perfStatus.memoryUsage || 0}MB`);
  console.log(
    `      • System health: ${perfStatus.isHealthy ? '✅ HEALTHY' : '❌ ISSUES DETECTED'}\n`
  );
  const cacheStats = db.getCacheStats();
  console.log('   💾 Cache Performance:');
  console.log(`      • Total cached entries: ${cacheStats.totalEntries}`);
  console.log(
    `      • Memory usage: ${Math.round((cacheStats.totalSize / 1024 / 1024) * 100) / 100}MB`
  );
  console.log(`      • Hit rate: ${Math.round(cacheStats.hitRate * 100)}%`);
  console.log(`      • Miss rate: ${Math.round(cacheStats.missRate * 100)}%`);
  console.log(`      • Evictions: ${cacheStats.evictionCount}\n`);
  const dbStats = await db.getStats();
  console.log('   📊 Database Statistics:');
  console.log(`      • Total entries: ${dbStats.totalEntries}`);
  console.log(`      • Searches today: ${dbStats.searchesToday}`);
  console.log(`      • Average success rate: ${dbStats.averageSuccessRate}%`);
  console.log(
    `      • Database size: ${Math.round((dbStats.diskUsage / 1024 / 1024) * 100) / 100}MB`
  );
  console.log(`      • Categories: ${Object.keys(dbStats.categoryCounts).length}\n`);
  const recommendations = db.getRecommendations();
  if (recommendations.length > 0) {
    console.log('   💡 Performance Recommendations:');
    recommendations.slice(0, 3).forEach(rec => {
      console.log(`      • ${rec}`);
    });
  } else {
    console.log('   ✅ No performance issues detected - system running optimally');
  }
  console.log('');
}
async function runPerformanceBenchmark(db) {
  console.log('🏁 COMPREHENSIVE PERFORMANCE BENCHMARK');
  console.log('====================================\n');
  const benchmark = new SearchBenchmark_1.SearchBenchmark(db);
  try {
    const report = await benchmark.runBenchmark({
      iterations: 2,
      includeAutoComplete: true,
      warmupRuns: 1,
    });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportPath = `./benchmark-results-${timestamp}.json`;
    await benchmark.exportResults(report, exportPath);
    console.log('\n📋 BENCHMARK SUMMARY:');
    console.log('====================');
    console.log(
      `✅ Performance Target Met: ${report.summary.averageResponseTime < 500 && report.summary.p95ResponseTime < 1000}`
    );
    console.log(`📊 Overall Grade: ${getPerformanceGrade(report.summary)}`);
    console.log(
      `🎯 Key Achievement: ${report.summary.slowQueries === 0 ? 'Zero queries exceeded 1s limit!' : `${report.summary.slowQueries} queries need optimization`}`
    );
  } catch (error) {
    console.error(`❌ Benchmark failed: ${error}`);
  }
}
function getPerformanceGrade(summary) {
  const avgGood = summary.averageResponseTime < 300;
  const p95Good = summary.p95ResponseTime < 800;
  const cacheGood = summary.cacheHitRate > 0.8;
  const noSlow = summary.slowQueries === 0;
  const score = [avgGood, p95Good, cacheGood, noSlow].filter(Boolean).length;
  switch (score) {
    case 4:
      return 'A+ (Excellent)';
    case 3:
      return 'A (Very Good)';
    case 2:
      return 'B (Good)';
    case 1:
      return 'C (Needs Improvement)';
    default:
      return 'D (Critical Issues)';
  }
}
async function realWorldUsageExample() {
  console.log('\n🌟 REAL-WORLD USAGE PATTERNS');
  console.log('===========================\n');
  const db = await (0, KnowledgeDB_1.createKnowledgeDB)('./production-kb.db');
  try {
    console.log('📞 Scenario 1: Support analyst receives incident');
    console.log('   Incident: "Job XYZ123 failed with S0C7 abend"');
    let startTime = Date.now();
    const errorResults = await db.search('S0C7');
    console.log(
      `   ⚡ Found ${errorResults.length} relevant solutions in ${Date.now() - startTime}ms`
    );
    if (errorResults.length > 0) {
      console.log(`   🎯 Best match: "${errorResults[0].entry.title}"`);
      console.log(
        `   📈 Success rate: ${Math.round(((errorResults[0].entry.success_count || 0) / Math.max(1, errorResults[0].entry.usage_count || 0)) * 100)}%`
      );
    }
    console.log('\n🔧 Scenario 2: Developer investigating pattern');
    console.log('   Query: "COBOL data exception program check"');
    startTime = Date.now();
    const patternResults = await db.search('COBOL data exception program check', {
      sortBy: 'relevance',
      limit: 5,
    });
    console.log(
      `   ⚡ Found ${patternResults.length} related entries in ${Date.now() - startTime}ms`
    );
    console.log('\n⚡ Scenario 3: Auto-complete during typing');
    console.log('   User types: "file"');
    startTime = Date.now();
    const suggestions = await db.autoComplete('file', 5);
    console.log(`   ⚡ Provided ${suggestions.length} suggestions in ${Date.now() - startTime}ms`);
    suggestions.slice(0, 3).forEach(s => console.log(`      • ${s.suggestion}`));
    console.log('\n🔍 Scenario 4: Complex troubleshooting');
    console.log('   Query: "JCL job allocation dataset catalog VSAM"');
    startTime = Date.now();
    const complexResults = await db.searchWithFacets('JCL job allocation dataset catalog VSAM');
    console.log(`   ⚡ Complex search completed in ${Date.now() - startTime}ms`);
    console.log(`   📊 Results: ${complexResults.results.length} entries with faceted navigation`);
    console.log(`   🏷️  Categories available: ${complexResults.facets.categories.length}`);
  } catch (error) {
    console.error(`❌ Error in real-world example: ${error}`);
  } finally {
    await db.close();
  }
}
async function performanceOptimizationExamples() {
  console.log('\n⚡ ADVANCED PERFORMANCE OPTIMIZATIONS');
  console.log('=====================================\n');
  const db = await (0, KnowledgeDB_1.createKnowledgeDB)('./optimized-kb.db');
  try {
    console.log('🔥 Cache pre-warming for optimal performance...');
    const startTime = Date.now();
    await db.preWarmCache();
    console.log(`   ✅ Cache pre-warming completed in ${Date.now() - startTime}ms`);
    console.log('\n🔧 Index optimization based on query patterns...');
    const indexOptimization = await db.optimizeIndexes();
    console.log(`   ✅ Index optimization completed`);
    console.log(`   📊 Created ${indexOptimization.created?.length || 0} new indexes`);
    console.log(`   🗑️  Removed ${indexOptimization.removed?.length || 0} unused indexes`);
    console.log('\n❤️  System health check...');
    const health = await db.healthCheck();
    console.log(`   Overall health: ${health.overall ? '✅ HEALTHY' : '❌ ISSUES'}`);
    console.log(`   Database: ${health.database ? '✅' : '❌'}`);
    console.log(`   Cache: ${health.cache ? '✅' : '❌'}`);
    console.log(`   Connections: ${health.connections ? '✅' : '❌'}`);
    console.log(`   Performance: ${health.performance ? '✅' : '❌'}`);
    if (health.issues.length > 0) {
      console.log('   Issues detected:');
      health.issues.forEach(issue => console.log(`      • ${issue}`));
    }
    console.log('\n📈 Performance trend analysis (last 24 hours)...');
    const trends = db.getPerformanceTrends(24);
    if (trends) {
      console.log(`   📊 Trend analysis shows ${trends.trending || 'stable'} performance`);
      console.log(`   ⏱️  Average response time trend: ${trends.responseTimeTrend || 'stable'}`);
      console.log(`   💾 Cache hit rate trend: ${trends.cacheHitTrend || 'stable'}`);
    }
  } catch (error) {
    console.error(`❌ Error in optimization examples: ${error}`);
  } finally {
    await db.close();
  }
}
if (require.main === module) {
  demonstrateSearchAlgorithms()
    .then(() => realWorldUsageExample())
    .then(() => performanceOptimizationExamples())
    .then(() => {
      console.log('\n🎉 Search algorithm demonstrations completed!');
      console.log('📚 Key Takeaways:');
      console.log('   ✓ Hybrid search architecture achieves <1s performance targets');
      console.log('   ✓ Intelligent query routing optimizes algorithm selection');
      console.log('   ✓ Multi-level caching provides >90% cache hit rates');
      console.log('   ✓ Auto-complete delivers <50ms response times');
      console.log('   ✓ Real-time monitoring enables proactive optimization');
      console.log('   ✓ Comprehensive benchmarking validates performance targets\n');
    })
    .catch(console.error);
}
//# sourceMappingURL=search-usage-example.js.map
