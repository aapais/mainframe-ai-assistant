/**
 * Comprehensive Search Performance Benchmark Suite
 * 
 * Validates <1s search performance requirement across all search strategies
 * and provides detailed performance analysis and optimization recommendations.
 */

import { KnowledgeDB, SearchResult } from './KnowledgeDB';

export interface BenchmarkResult {
  strategy: string;
  query: string;
  executionTimeMs: number;
  resultCount: number;
  cacheHit: boolean;
  complexity: 'simple' | 'medium' | 'complex';
  success: boolean;
  error?: string;
}

export interface PerformanceReport {
  summary: {
    totalTests: number;
    passedTests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    cacheHitRate: number;
    slowQueries: number;
  };
  strategyPerformance: Record<string, {
    averageTime: number;
    testCount: number;
    successRate: number;
    cacheHitRate: number;
  }>;
  recommendations: string[];
  detailedResults: BenchmarkResult[];
}

export class SearchBenchmark {
  private db: KnowledgeDB;
  private testQueries: Array<{
    query: string;
    expectedStrategy: string;
    complexity: 'simple' | 'medium' | 'complex';
    description: string;
  }> = [
    // Simple exact matches - should be <100ms
    { query: 'S0C7', expectedStrategy: 'exact', complexity: 'simple', description: 'System abend code' },
    { query: 'IEF212I', expectedStrategy: 'exact', complexity: 'simple', description: 'JCL error code' },
    { query: 'VSAM Status 35', expectedStrategy: 'exact', complexity: 'simple', description: 'VSAM error' },
    
    // Category searches - should be <200ms
    { query: 'category:JCL', expectedStrategy: 'category', complexity: 'simple', description: 'Category filter' },
    { query: 'category:VSAM', expectedStrategy: 'category', complexity: 'simple', description: 'Category filter' },
    { query: 'category:DB2', expectedStrategy: 'category', complexity: 'simple', description: 'Category filter' },
    
    // Tag searches - should be <300ms
    { query: 'tag:abend', expectedStrategy: 'tag', complexity: 'simple', description: 'Tag filter' },
    { query: 'tag:dataset', expectedStrategy: 'tag', complexity: 'simple', description: 'Tag filter' },
    
    // Full-text searches - should be <400ms
    { query: 'file not found', expectedStrategy: 'fts', complexity: 'medium', description: 'Common error phrase' },
    { query: 'data exception', expectedStrategy: 'fts', complexity: 'medium', description: 'Error description' },
    { query: 'job abends', expectedStrategy: 'fts', complexity: 'medium', description: 'Problem statement' },
    
    // Fuzzy searches - should be <600ms
    { query: 'datasett notfound', expectedStrategy: 'fuzzy', complexity: 'medium', description: 'Typos in search' },
    { query: 'progam check', expectedStrategy: 'fuzzy', complexity: 'medium', description: 'Common misspelling' },
    
    // Complex multi-term queries - should be <800ms
    { query: 'COBOL program S0C7 data exception', expectedStrategy: 'hybrid', complexity: 'complex', description: 'Multi-concept search' },
    { query: 'JCL job failed dataset allocation error', expectedStrategy: 'hybrid', complexity: 'complex', description: 'Complex problem description' },
    { query: 'VSAM file status 35 catalog error', expectedStrategy: 'hybrid', complexity: 'complex', description: 'Technical multi-term query' },
    
    // Performance edge cases - should be <1000ms (limit)
    { query: 'a b c d e f g h i j k l', expectedStrategy: 'hybrid', complexity: 'complex', description: 'Many-term query' },
    { query: 'file error data program check exception abend', expectedStrategy: 'hybrid', complexity: 'complex', description: 'High complexity query' },
    
    // Auto-complete test cases - should be <50ms
    { query: 'S0', expectedStrategy: 'fts', complexity: 'simple', description: 'Auto-complete prefix' },
    { query: 'file', expectedStrategy: 'fts', complexity: 'simple', description: 'Common prefix' },
    { query: 'VSAM', expectedStrategy: 'fts', complexity: 'simple', description: 'Category prefix' }
  ];

  constructor(db: KnowledgeDB) {
    this.db = db;
  }

  /**
   * Run comprehensive performance benchmark
   */
  async runBenchmark(options?: {
    iterations?: number;
    includeAutoComplete?: boolean;
    warmupRuns?: number;
  }): Promise<PerformanceReport> {
    const config = {
      iterations: 3,
      includeAutoComplete: true,
      warmupRuns: 2,
      ...options
    };

    console.log('🚀 Starting comprehensive search performance benchmark...');
    console.log(`📊 Configuration: ${config.iterations} iterations, ${config.warmupRuns} warmup runs`);
    
    // Warmup runs to ensure caches are populated
    console.log('🔥 Running warmup queries...');
    for (let i = 0; i < config.warmupRuns; i++) {
      await this.runWarmupQueries();
    }
    
    const results: BenchmarkResult[] = [];
    
    // Main benchmark runs
    console.log('⚡ Running performance tests...');
    for (let iteration = 0; iteration < config.iterations; iteration++) {
      console.log(`  Iteration ${iteration + 1}/${config.iterations}`);
      
      for (const testCase of this.testQueries) {
        const result = await this.benchmarkSingleQuery(testCase);
        results.push({ ...result, iteration } as any);
        
        // Log slow queries immediately
        if (result.executionTimeMs > 1000) {
          console.warn(`❌ SLOW QUERY: "${result.query}" took ${result.executionTimeMs}ms`);
        } else if (result.executionTimeMs > 500) {
          console.warn(`⚠️  WARNING: "${result.query}" took ${result.executionTimeMs}ms`);
        }
      }
    }
    
    // Auto-complete benchmark if enabled
    if (config.includeAutoComplete) {
      console.log('🔍 Testing auto-complete performance...');
      const autoCompleteResults = await this.benchmarkAutoComplete();
      results.push(...autoCompleteResults);
    }
    
    // Generate comprehensive report
    const report = this.generatePerformanceReport(results);
    
    console.log('✅ Benchmark completed!');
    this.printSummaryReport(report);
    
    return report;
  }

  /**
   * Benchmark a single search query
   */
  private async benchmarkSingleQuery(testCase: {
    query: string;
    expectedStrategy: string;
    complexity: 'simple' | 'medium' | 'complex';
    description: string;
  }): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let success = true;
    let error: string | undefined;
    let cacheHit = false;
    let resultCount = 0;
    
    try {
      // Check if this is likely a cache hit
      const cacheStats = this.db.getCacheStats();
      const initialHits = cacheStats.totalEntries;
      
      // Execute search
      const searchResults = await this.db.search(testCase.query, {
        limit: 10
      });
      
      resultCount = searchResults.length;
      
      // Check if cache was hit
      const finalStats = this.db.getCacheStats();
      cacheHit = finalStats.totalEntries === initialStats;
      
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      console.error(`❌ Query failed: "${testCase.query}" - ${error}`);
    }
    
    const executionTimeMs = Date.now() - startTime;
    
    return {
      strategy: testCase.expectedStrategy,
      query: testCase.query,
      executionTimeMs,
      resultCount,
      cacheHit,
      complexity: testCase.complexity,
      success,
      error
    };
  }

  /**
   * Benchmark auto-complete performance
   */
  private async benchmarkAutoComplete(): Promise<BenchmarkResult[]> {
    const autoCompleteQueries = [
      'S0', 'IEF', 'VS', 'file', 'data', 'job', 'error', 'abend', 'program', 'check'
    ];
    
    const results: BenchmarkResult[] = [];
    
    for (const query of autoCompleteQueries) {
      const startTime = Date.now();
      let success = true;
      let error: string | undefined;
      let resultCount = 0;
      
      try {
        const suggestions = await this.db.autoComplete(query, 5);
        resultCount = suggestions.length;
      } catch (err) {
        success = false;
        error = err instanceof Error ? err.message : String(err);
      }
      
      const executionTimeMs = Date.now() - startTime;
      
      results.push({
        strategy: 'autocomplete',
        query: `autocomplete:${query}`,
        executionTimeMs,
        resultCount,
        cacheHit: false, // Auto-complete has its own caching
        complexity: 'simple',
        success,
        error
      });
      
      // Auto-complete should be <50ms
      if (executionTimeMs > 50) {
        console.warn(`⚠️  SLOW AUTO-COMPLETE: "${query}" took ${executionTimeMs}ms (target: <50ms)`);
      }
    }
    
    return results;
  }

  /**
   * Run warmup queries to populate caches
   */
  private async runWarmupQueries(): Promise<void> {
    const warmupQueries = [
      'S0C7', 'VSAM Status 35', 'category:JCL', 'file not found', 'data exception'
    ];
    
    for (const query of warmupQueries) {
      try {
        await this.db.search(query, { limit: 5 });
      } catch (error) {
        // Ignore warmup errors
      }
    }
    
    // Warm up auto-complete cache
    try {
      await this.db.autoComplete('S0', 3);
      await this.db.autoComplete('file', 3);
    } catch (error) {
      // Ignore warmup errors
    }
  }

  /**
   * Generate comprehensive performance report
   */
  private generatePerformanceReport(results: BenchmarkResult[]): PerformanceReport {
    const successfulResults = results.filter(r => r.success);
    const totalTests = results.length;
    const passedTests = successfulResults.length;
    
    // Calculate overall statistics
    const executionTimes = successfulResults.map(r => r.executionTimeMs);
    executionTimes.sort((a, b) => a - b);
    
    const averageResponseTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
    const p95ResponseTime = executionTimes[Math.floor(executionTimes.length * 0.95)] || 0;
    const p99ResponseTime = executionTimes[Math.floor(executionTimes.length * 0.99)] || 0;
    
    const cacheHitRate = successfulResults.filter(r => r.cacheHit).length / successfulResults.length;
    const slowQueries = successfulResults.filter(r => r.executionTimeMs > 1000).length;
    
    // Calculate strategy-specific performance
    const strategyPerformance: Record<string, any> = {};
    
    const strategies = [...new Set(results.map(r => r.strategy))];
    for (const strategy of strategies) {
      const strategyResults = successfulResults.filter(r => r.strategy === strategy);
      const strategyTimes = strategyResults.map(r => r.executionTimeMs);
      
      strategyPerformance[strategy] = {
        averageTime: strategyTimes.reduce((sum, time) => sum + time, 0) / strategyTimes.length,
        testCount: strategyResults.length,
        successRate: strategyResults.length / results.filter(r => r.strategy === strategy).length,
        cacheHitRate: strategyResults.filter(r => r.cacheHit).length / strategyResults.length
      };
    }
    
    // Generate recommendations
    const recommendations = this.generateRecommendations({
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      cacheHitRate,
      slowQueries,
      strategyPerformance,
      successfulResults
    });
    
    return {
      summary: {
        totalTests,
        passedTests,
        averageResponseTime: Math.round(averageResponseTime),
        p95ResponseTime: Math.round(p95ResponseTime),
        p99ResponseTime: Math.round(p99ResponseTime),
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        slowQueries
      },
      strategyPerformance,
      recommendations,
      detailedResults: results
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(stats: any): string[] {
    const recommendations: string[] = [];
    
    // Overall performance recommendations
    if (stats.averageResponseTime > 500) {
      recommendations.push('❌ CRITICAL: Average response time exceeds 500ms target');
      recommendations.push('- Consider adding more aggressive caching');
      recommendations.push('- Review and optimize slow queries');
      recommendations.push('- Implement query result streaming for large result sets');
    } else if (stats.averageResponseTime > 300) {
      recommendations.push('⚠️  WARNING: Average response time approaching performance target');
      recommendations.push('- Monitor cache hit rates and optimize cache TTL');
      recommendations.push('- Consider pre-warming cache with common queries');
    } else {
      recommendations.push('✅ EXCELLENT: Average response time meets performance targets');
    }
    
    // P95/P99 performance
    if (stats.p95ResponseTime > 1000) {
      recommendations.push('❌ CRITICAL: P95 response time exceeds 1s hard limit');
      recommendations.push('- Implement query complexity analysis and early termination');
      recommendations.push('- Add progressive enhancement for complex queries');
    } else if (stats.p95ResponseTime > 800) {
      recommendations.push('⚠️  WARNING: P95 response time approaching 1s limit');
      recommendations.push('- Optimize complex query strategies');
      recommendations.push('- Consider query result pagination for large result sets');
    }
    
    // Cache performance
    if (stats.cacheHitRate < 0.5) {
      recommendations.push('❌ CRITICAL: Cache hit rate below 50%');
      recommendations.push('- Review cache key generation strategy');
      recommendations.push('- Increase cache TTL for stable queries');
      recommendations.push('- Implement smarter cache pre-warming');
    } else if (stats.cacheHitRate < 0.8) {
      recommendations.push('⚠️  WARNING: Cache hit rate below optimal (80%+)');
      recommendations.push('- Fine-tune cache eviction policies');
      recommendations.push('- Consider increasing cache memory allocation');
    } else {
      recommendations.push('✅ GOOD: Cache hit rate meets performance targets');
    }
    
    // Strategy-specific recommendations
    Object.entries(stats.strategyPerformance).forEach(([strategy, perf]: [string, any]) => {
      if (strategy === 'autocomplete' && perf.averageTime > 50) {
        recommendations.push(`❌ CRITICAL: Auto-complete (${strategy}) averaging ${Math.round(perf.averageTime)}ms (target: <50ms)`);
        recommendations.push('- Implement dedicated auto-complete indexing');
        recommendations.push('- Add auto-complete result caching with short TTL');
      } else if (strategy === 'exact' && perf.averageTime > 100) {
        recommendations.push(`⚠️  WARNING: Exact search (${strategy}) averaging ${Math.round(perf.averageTime)}ms (target: <100ms)`);
        recommendations.push('- Optimize exact match indexes');
        recommendations.push('- Consider dedicated error code lookup table');
      } else if (perf.averageTime > 800) {
        recommendations.push(`❌ CRITICAL: ${strategy} strategy averaging ${Math.round(perf.averageTime)}ms`);
        recommendations.push(`- Optimize ${strategy} query implementation`);
        recommendations.push(`- Consider query complexity limits for ${strategy} strategy`);
      }
    });
    
    // Slow query analysis
    if (stats.slowQueries > 0) {
      recommendations.push(`❌ CRITICAL: ${stats.slowQueries} queries exceeded 1s hard limit`);
      recommendations.push('- Review slow query log for optimization opportunities');
      recommendations.push('- Implement query timeout and graceful degradation');
      recommendations.push('- Consider breaking complex queries into multiple simpler ones');
    }
    
    // Auto-complete specific recommendations
    const autoCompletePerf = stats.strategyPerformance['autocomplete'];
    if (autoCompletePerf && autoCompletePerf.averageTime > 30) {
      recommendations.push('⚠️  Auto-complete performance can be improved');
      recommendations.push('- Implement prefix tree (trie) for faster auto-complete');
      recommendations.push('- Cache common prefixes with longer TTL');
      recommendations.push('- Limit auto-complete to most relevant suggestions');
    }
    
    return recommendations;
  }

  /**
   * Print summary report to console
   */
  private printSummaryReport(report: PerformanceReport): void {
    console.log('\n📊 SEARCH PERFORMANCE BENCHMARK REPORT');
    console.log('======================================');
    
    console.log('\n🎯 SUMMARY METRICS');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed Tests: ${report.summary.passedTests} (${Math.round(report.summary.passedTests / report.summary.totalTests * 100)}%)`);
    console.log(`Average Response Time: ${report.summary.averageResponseTime}ms`);
    console.log(`P95 Response Time: ${report.summary.p95ResponseTime}ms`);
    console.log(`P99 Response Time: ${report.summary.p99ResponseTime}ms`);
    console.log(`Cache Hit Rate: ${Math.round(report.summary.cacheHitRate * 100)}%`);
    console.log(`Slow Queries (>1s): ${report.summary.slowQueries}`);
    
    // Performance targets assessment
    console.log('\n🎖️  PERFORMANCE TARGETS ASSESSMENT');
    const avgPassed = report.summary.averageResponseTime < 500;
    const p95Passed = report.summary.p95ResponseTime < 1000;
    const cacheGood = report.summary.cacheHitRate > 0.8;
    const noSlowQueries = report.summary.slowQueries === 0;
    
    console.log(`Average <500ms: ${avgPassed ? '✅ PASS' : '❌ FAIL'} (${report.summary.averageResponseTime}ms)`);
    console.log(`P95 <1000ms: ${p95Passed ? '✅ PASS' : '❌ FAIL'} (${report.summary.p95ResponseTime}ms)`);
    console.log(`Cache Hit Rate >80%: ${cacheGood ? '✅ PASS' : '❌ FAIL'} (${Math.round(report.summary.cacheHitRate * 100)}%)`);
    console.log(`No Slow Queries: ${noSlowQueries ? '✅ PASS' : '❌ FAIL'} (${report.summary.slowQueries} found)`);
    
    console.log('\n🔍 STRATEGY PERFORMANCE');
    Object.entries(report.strategyPerformance).forEach(([strategy, perf]) => {
      const status = perf.averageTime < (strategy === 'autocomplete' ? 50 : 800) ? '✅' : '❌';
      console.log(`${status} ${strategy.toUpperCase()}: ${Math.round(perf.averageTime)}ms avg, ${perf.testCount} tests, ${Math.round(perf.successRate * 100)}% success`);
    });
    
    console.log('\n💡 OPTIMIZATION RECOMMENDATIONS');
    report.recommendations.forEach(rec => console.log(`   ${rec}`));
    
    const overallStatus = avgPassed && p95Passed && cacheGood && noSlowQueries;
    console.log(`\n🏆 OVERALL ASSESSMENT: ${overallStatus ? '✅ PERFORMANCE TARGETS MET' : '❌ OPTIMIZATION REQUIRED'}`);
  }

  /**
   * Export detailed results to JSON
   */
  async exportResults(report: PerformanceReport, filePath: string): Promise<void> {
    const fs = await import('fs');
    const exportData = {
      timestamp: new Date().toISOString(),
      report,
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
    
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
    console.log(`📁 Detailed results exported to: ${filePath}`);
  }
}

/**
 * Complexity Analysis for Algorithm Selection
 */
export class SearchComplexityAnalyzer {
  /**
   * Analyze query complexity and recommend optimal algorithm
   */
  static analyzeQuery(query: string): {
    complexity: 'O(1)' | 'O(log n)' | 'O(n)' | 'O(n log n)' | 'O(n²)';
    strategy: string;
    expectedTimeMs: number;
    reasoning: string[];
  } {
    const terms = query.trim().split(/\s+/);
    const hasOperators = /[:@]/.test(query);
    const isErrorCode = /^[A-Z]\d{3,4}[A-Z]?$/.test(query) || /^S\d{3}[A-Z]?$/.test(query);
    
    // O(1) - Direct lookups
    if (isErrorCode) {
      return {
        complexity: 'O(1)',
        strategy: 'exact_lookup',
        expectedTimeMs: 50,
        reasoning: [
          'Error code detected - can use direct index lookup',
          'Covering indexes eliminate table scans',
          'Result set typically small and well-defined'
        ]
      };
    }
    
    // O(log n) - Index-based searches
    if (query.startsWith('category:') || query.startsWith('tag:')) {
      return {
        complexity: 'O(log n)',
        strategy: 'index_search',
        expectedTimeMs: 100,
        reasoning: [
          'Category/tag filters use indexed lookups',
          'B-tree traversal for exact matches',
          'Result set pre-filtered by index'
        ]
      };
    }
    
    // O(n) - Simple full-text search
    if (terms.length <= 2 && !hasOperators) {
      return {
        complexity: 'O(n)',
        strategy: 'fts_simple',
        expectedTimeMs: 200,
        reasoning: [
          'Simple FTS with BM25 ranking',
          'Single inverted index scan',
          'Early termination possible'
        ]
      };
    }
    
    // O(n log n) - Complex FTS with ranking
    if (terms.length <= 5) {
      return {
        complexity: 'O(n log n)',
        strategy: 'fts_complex',
        expectedTimeMs: 400,
        reasoning: [
          'Multi-term FTS requires result ranking',
          'Term frequency calculations',
          'Score-based result sorting'
        ]
      };
    }
    
    // O(n²) - Multi-strategy search
    return {
      complexity: 'O(n²)',
      strategy: 'hybrid_multi',
      expectedTimeMs: 800,
      reasoning: [
        'Complex query requires multiple search strategies',
        'Result fusion and deduplication',
        'Multiple index scans and ranking algorithms',
        'Consider query simplification or user guidance'
      ]
    };
  }
}