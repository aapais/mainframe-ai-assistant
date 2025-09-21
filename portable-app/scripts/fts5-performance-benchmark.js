#!/usr/bin/env node
/**
 * FTS5 Performance Benchmark Script
 *
 * Comprehensive performance testing for Enhanced FTS5 search implementation.
 * Compares performance between standard search and enhanced FTS5 search
 * across various query types and data volumes.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class FTS5PerformanceBenchmark {
  constructor() {
    this.results = {
      standardSearch: [],
      enhancedFTS5: [],
      comparison: {},
      recommendations: []
    };

    this.testQueries = [
      // Error code searches (high precision required)
      { query: 'S0C7', type: 'error_code', expectedResults: 1 },
      { query: 'IEF212I', type: 'error_code', expectedResults: 1 },
      { query: 'WER027A', type: 'error_code', expectedResults: 1 },

      // Mainframe terminology searches
      { query: 'VSAM status', type: 'mainframe_terms', expectedResults: 2 },
      { query: 'JCL dataset allocation', type: 'mainframe_terms', expectedResults: 2 },
      { query: 'COBOL arithmetic', type: 'mainframe_terms', expectedResults: 1 },
      { query: 'DB2 SQLCODE', type: 'mainframe_terms', expectedResults: 1 },
      { query: 'CICS transaction', type: 'mainframe_terms', expectedResults: 1 },

      // Complex multi-term searches
      { query: 'abend completion code error', type: 'complex', expectedResults: 3 },
      { query: 'dataset allocation space parameter', type: 'complex', expectedResults: 2 },
      { query: 'batch job step execution failure', type: 'complex', expectedResults: 2 },

      // Fuzzy/partial searches
      { query: 'arithmeti', type: 'fuzzy', expectedResults: 1 },
      { query: 'allocat', type: 'fuzzy', expectedResults: 2 },
      { query: 'complet', type: 'fuzzy', expectedResults: 3 },

      // Category searches
      { query: 'error', type: 'category', category: 'Batch', expectedResults: 2 },
      { query: 'status', type: 'category', category: 'VSAM', expectedResults: 1 },
      { query: 'problem', type: 'category', category: 'JCL', expectedResults: 2 },

      // Common terms (high volume)
      { query: 'error', type: 'common', expectedResults: 5 },
      { query: 'dataset', type: 'common', expectedResults: 3 },
      { query: 'job', type: 'common', expectedResults: 4 },

      // Empty and edge cases
      { query: '', type: 'edge_case', expectedResults: 0 },
      { query: 'xyz123nonexistent', type: 'edge_case', expectedResults: 0 },
      { query: 'a'.repeat(100), type: 'edge_case', expectedResults: 0 }
    ];
  }

  async initializeDatabase() {
    console.log('🔧 Initializing test database...');

    this.db = new Database(':memory:');

    // Load schema
    const schemaPath = path.join(__dirname, '../src/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    this.db.exec(schema);

    // Apply FTS5 migration
    const migrationPath = path.join(__dirname, '../src/database/migrations/003_enhanced_fts5.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    this.db.exec(migration);

    // Generate test data
    await this.generateTestData();

    console.log('✅ Database initialized with test data');
  }

  async generateTestData() {
    console.log('📊 Generating performance test data...');

    const testEntries = [
      {
        id: '1', title: 'S0C7 Data Exception Error',
        problem: 'Job MYJOB01 abends with system completion code S0C7 during arithmetic operation in COBOL program. The error occurs when processing numeric fields.',
        solution: '1. Check for uninitialized COMP-3 fields\\n2. Validate numeric data before arithmetic\\n3. Use INITIALIZE statement for working storage\\n4. Review field definitions in COBOL program',
        category: 'Batch', severity: 'high', usage_count: 45, success_count: 38, failure_count: 7
      },
      {
        id: '2', title: 'VSAM Status 35 File Not Found',
        problem: 'VSAM KSDS access returns status code 35 indicating file not found during batch processing. Dataset appears to be uncataloged or unavailable.',
        solution: '1. Verify dataset exists in catalog\\n2. Check file allocation in JCL\\n3. Ensure proper DISP parameter\\n4. Review dataset naming conventions',
        category: 'VSAM', severity: 'medium', usage_count: 32, success_count: 28, failure_count: 4
      },
      {
        id: '3', title: 'IEF212I Step Not Executed',
        problem: 'Job step //STEP01 not executed, message IEF212I appears in job output. Previous step may have failed or COND parameter preventing execution.',
        solution: '1. Check JCL syntax for step\\n2. Verify program name in EXEC statement\\n3. Review COND parameter on job or previous steps\\n4. Examine return codes',
        category: 'JCL', severity: 'medium', usage_count: 28, success_count: 25, failure_count: 3
      },
      {
        id: '4', title: 'DB2 SQLCODE -904 Resource Unavailable',
        problem: 'DB2 application receives SQLCODE -904 indicating resource limit exceeded. Thread pool may be exhausted or connection limit reached.',
        solution: '1. Check thread limits in DB2\\n2. Review connection pooling\\n3. Optimize SQL queries for efficiency\\n4. Monitor resource usage patterns',
        category: 'DB2', severity: 'high', usage_count: 22, success_count: 18, failure_count: 4
      },
      {
        id: '5', title: 'CICS Transaction ABEND AEY9',
        problem: 'CICS transaction TRAN01 abends with code AEY9 during COMMAREA processing. Length mismatch or invalid data structure suspected.',
        solution: '1. Check COMMAREA length\\n2. Verify program linkage\\n3. Review transaction definition\\n4. Validate data structure mapping',
        category: 'CICS', severity: 'medium', usage_count: 15, success_count: 12, failure_count: 3
      },
      {
        id: '6', title: 'JCL Dataset Allocation Error',
        problem: 'Dataset allocation fails with message about insufficient space or invalid SPACE parameter. Volume may be full or unit unavailable.',
        solution: '1. Increase SPACE allocation\\n2. Check unit specification\\n3. Verify volume availability\\n4. Review dataset placement policies',
        category: 'JCL', severity: 'low', usage_count: 18, success_count: 16, failure_count: 2
      },
      {
        id: '7', title: 'WER027A Sort Insufficient Storage',
        problem: 'Sort utility fails with WER027A message indicating insufficient storage for sort operation. Work datasets may be inadequate.',
        solution: '1. Increase REGION parameter\\n2. Add SORTWK datasets\\n3. Review sort input size\\n4. Optimize sort parameters',
        category: 'Batch', severity: 'medium', usage_count: 12, success_count: 10, failure_count: 2
      },
      {
        id: '8', title: 'COBOL MOVE Statement Error',
        problem: 'COBOL program fails during MOVE operation with data truncation or conversion error. Field size mismatch suspected.',
        solution: '1. Check field sizes in MOVE statement\\n2. Verify data types compatibility\\n3. Use INSPECT for data validation\\n4. Review PICTURE clauses',
        category: 'Batch', severity: 'low', usage_count: 8, success_count: 7, failure_count: 1
      }
    ];

    const tags = [
      ['s0c7', 'abend', 'cobol', 'arithmetic'],
      ['vsam', 'status-35', 'ksds', 'catalog'],
      ['ief212i', 'jcl', 'step', 'execution'],
      ['db2', 'sqlcode', 'resource', 'thread'],
      ['cics', 'abend', 'aey9', 'commarea'],
      ['jcl', 'dataset', 'allocation', 'space'],
      ['wer027a', 'sort', 'storage', 'batch'],
      ['cobol', 'move', 'conversion', 'data']
    ];

    const insertStmt = this.db.prepare(`
      INSERT INTO kb_entries (id, title, problem, solution, category, severity, usage_count, success_count, failure_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTagStmt = this.db.prepare(`
      INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)
    `);

    testEntries.forEach((entry, index) => {
      insertStmt.run(
        entry.id, entry.title, entry.problem, entry.solution,
        entry.category, entry.severity, entry.usage_count,
        entry.success_count, entry.failure_count
      );

      // Insert tags
      tags[index].forEach(tag => {
        insertTagStmt.run(entry.id, tag);
      });
    });

    console.log(`✅ Generated ${testEntries.length} test entries with tags`);
  }

  async runStandardSearchBenchmark() {
    console.log('🏃 Running standard search benchmarks...');

    for (const test of this.testQueries) {
      const times = [];
      const resultCounts = [];

      // Run each query multiple times for statistical accuracy
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const results = this.executeStandardSearch(test.query, test);
        const end = performance.now();

        times.push(end - start);
        resultCounts.push(results.length);
      }

      this.results.standardSearch.push({
        query: test.query,
        type: test.type,
        times,
        avgTime: times.reduce((a, b) => a + b, 0) / times.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        p95Time: this.calculatePercentile(times, 95),
        avgResults: resultCounts.reduce((a, b) => a + b, 0) / resultCounts.length,
        expectedResults: test.expectedResults
      });
    }

    console.log('✅ Standard search benchmarks completed');
  }

  async runEnhancedFTS5Benchmark() {
    console.log('🚀 Running enhanced FTS5 benchmarks...');

    for (const test of this.testQueries) {
      const times = [];
      const resultCounts = [];

      // Run each query multiple times for statistical accuracy
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const results = this.executeEnhancedFTS5Search(test.query, test);
        const end = performance.now();

        times.push(end - start);
        resultCounts.push(results.length);
      }

      this.results.enhancedFTS5.push({
        query: test.query,
        type: test.type,
        times,
        avgTime: times.reduce((a, b) => a + b, 0) / times.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        p95Time: this.calculatePercentile(times, 95),
        avgResults: resultCounts.reduce((a, b) => a + b, 0) / resultCounts.length,
        expectedResults: test.expectedResults
      });
    }

    console.log('✅ Enhanced FTS5 benchmarks completed');
  }

  executeStandardSearch(query, options = {}) {
    if (!query.trim()) return [];

    let sql = `
      SELECT e.*, GROUP_CONCAT(DISTINCT t.tag, ', ') as tags
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE (e.title LIKE ? OR e.problem LIKE ? OR e.solution LIKE ?)
        AND e.archived = FALSE
    `;

    const params = [`%${query}%`, `%${query}%`, `%${query}%`];

    if (options.category) {
      sql += ` AND e.category = ?`;
      params.push(options.category);
    }

    sql += `
      GROUP BY e.id
      ORDER BY e.usage_count DESC, e.success_count DESC
      LIMIT 20
    `;

    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      console.warn('Standard search failed:', error.message);
      return [];
    }
  }

  executeEnhancedFTS5Search(query, options = {}) {
    if (!query.trim()) return [];

    // Simplified FTS5 query for benchmark
    let ftsQuery = query.trim();

    // Handle error codes and specific terms
    if (/^[A-Z]\d{3,4}[A-Z]?$/.test(query) || /^S\d{3}[A-Z]?$/.test(query)) {
      ftsQuery = `"${query}"`;
    } else {
      // Add prefix matching for general terms
      const terms = query.split(/\\s+/).filter(t => t.length > 2);
      if (terms.length > 0) {
        ftsQuery = terms.map(t => `${t}*`).join(' AND ');
      }
    }

    let sql = `
      SELECT
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        bm25(kb_fts_enhanced, 3.0, 2.0, 1.5, 1.0, 1.0) as relevance_score
      FROM kb_fts_enhanced f
      JOIN kb_entries e ON f.rowid = e.rowid
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE kb_fts_enhanced MATCH ?
        AND e.archived = FALSE
    `;

    const params = [ftsQuery];

    if (options.category) {
      sql += ` AND e.category = ?`;
      params.push(options.category);
    }

    sql += `
      GROUP BY e.id
      ORDER BY (
        ABS(relevance_score) * 0.6 +
        LOG(e.usage_count + 1) * 0.2 +
        (CASE WHEN (e.success_count + e.failure_count) > 0
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) * 0.2
             ELSE 0 END)
      ) DESC
      LIMIT 20
    `;

    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      console.warn('Enhanced FTS5 search failed:', error.message);
      return [];
    }
  }

  calculatePercentile(arr, percentile) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[index] || 0;
  }

  generateComparison() {
    console.log('📊 Generating performance comparison...');

    const comparison = {
      byQueryType: {},
      overall: {
        standardAvg: 0,
        enhancedAvg: 0,
        improvement: 0,
        accuracyComparison: {}
      }
    };

    // Group results by query type
    const types = [...new Set(this.testQueries.map(q => q.type))];

    types.forEach(type => {
      const standardResults = this.results.standardSearch.filter(r => r.type === type);
      const enhancedResults = this.results.enhancedFTS5.filter(r => r.type === type);

      const standardAvg = standardResults.reduce((sum, r) => sum + r.avgTime, 0) / standardResults.length;
      const enhancedAvg = enhancedResults.reduce((sum, r) => sum + r.avgTime, 0) / enhancedResults.length;

      const standardP95 = standardResults.reduce((sum, r) => sum + r.p95Time, 0) / standardResults.length;
      const enhancedP95 = enhancedResults.reduce((sum, r) => sum + r.p95Time, 0) / enhancedResults.length;

      comparison.byQueryType[type] = {
        standard: { avg: standardAvg, p95: standardP95 },
        enhanced: { avg: enhancedAvg, p95: enhancedP95 },
        improvement: ((standardAvg - enhancedAvg) / standardAvg * 100).toFixed(1),
        p95Improvement: ((standardP95 - enhancedP95) / standardP95 * 100).toFixed(1)
      };
    });

    // Overall comparison
    const overallStandardAvg = this.results.standardSearch.reduce((sum, r) => sum + r.avgTime, 0) / this.results.standardSearch.length;
    const overallEnhancedAvg = this.results.enhancedFTS5.reduce((sum, r) => sum + r.avgTime, 0) / this.results.enhancedFTS5.length;

    comparison.overall.standardAvg = overallStandardAvg;
    comparison.overall.enhancedAvg = overallEnhancedAvg;
    comparison.overall.improvement = ((overallStandardAvg - overallEnhancedAvg) / overallStandardAvg * 100).toFixed(1);

    // Accuracy comparison
    this.results.standardSearch.forEach((standard, index) => {
      const enhanced = this.results.enhancedFTS5[index];
      const query = standard.query;

      comparison.overall.accuracyComparison[query] = {
        standardResults: standard.avgResults,
        enhancedResults: enhanced.avgResults,
        expectedResults: standard.expectedResults,
        standardAccuracy: this.calculateAccuracy(standard.avgResults, standard.expectedResults),
        enhancedAccuracy: this.calculateAccuracy(enhanced.avgResults, enhanced.expectedResults)
      };
    });

    this.results.comparison = comparison;
    console.log('✅ Performance comparison generated');
  }

  calculateAccuracy(actual, expected) {
    if (expected === 0) {
      return actual === 0 ? 100 : 0;
    }
    return Math.max(0, 100 - Math.abs(actual - expected) / expected * 100).toFixed(1);
  }

  generateRecommendations() {
    console.log('💡 Generating performance recommendations...');

    const recommendations = [];
    const comparison = this.results.comparison;

    // Overall performance recommendation
    if (parseFloat(comparison.overall.improvement) > 20) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: 'Significant Performance Improvement',
        description: `Enhanced FTS5 shows ${comparison.overall.improvement}% performance improvement over standard search`,
        action: 'Deploy enhanced FTS5 search immediately'
      });
    } else if (parseFloat(comparison.overall.improvement) > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'Moderate Performance Improvement',
        description: `Enhanced FTS5 shows ${comparison.overall.improvement}% performance improvement`,
        action: 'Consider deploying enhanced FTS5 search'
      });
    }

    // Query type specific recommendations
    Object.entries(comparison.byQueryType).forEach(([type, data]) => {
      if (parseFloat(data.improvement) > 30) {
        recommendations.push({
          type: 'query_optimization',
          priority: 'high',
          title: `Excellent Performance for ${type} Queries`,
          description: `${data.improvement}% improvement for ${type} queries`,
          action: `Prioritize enhanced FTS5 for ${type} search patterns`
        });
      } else if (parseFloat(data.improvement) < 0) {
        recommendations.push({
          type: 'query_optimization',
          priority: 'medium',
          title: `Performance Regression for ${type} Queries`,
          description: `${Math.abs(data.improvement)}% slower for ${type} queries`,
          action: `Investigate and optimize ${type} query handling`
        });
      }
    });

    // Accuracy recommendations
    const accuracyIssues = Object.entries(comparison.overall.accuracyComparison)
      .filter(([query, data]) => parseFloat(data.enhancedAccuracy) < parseFloat(data.standardAccuracy))
      .length;

    if (accuracyIssues > 0) {
      recommendations.push({
        type: 'accuracy',
        priority: 'high',
        title: 'Accuracy Concerns Detected',
        description: `${accuracyIssues} queries show reduced accuracy with enhanced FTS5`,
        action: 'Review tokenizer configuration and ranking algorithms'
      });
    }

    // Resource utilization recommendations
    recommendations.push({
      type: 'resource',
      priority: 'low',
      title: 'Index Maintenance',
      description: 'Enhanced FTS5 requires periodic index optimization',
      action: 'Schedule regular FTS5 index maintenance (weekly OPTIMIZE)'
    });

    this.results.recommendations = recommendations;
    console.log(`✅ Generated ${recommendations.length} recommendations`);
  }

  async generateReport() {
    console.log('📋 Generating performance report...');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalQueries: this.testQueries.length,
        overallImprovement: this.results.comparison.overall.improvement,
        averageStandardTime: this.results.comparison.overall.standardAvg.toFixed(2),
        averageEnhancedTime: this.results.comparison.overall.enhancedAvg.toFixed(2),
        recommendationCount: this.results.recommendations.length
      },
      detailed: this.results,
      conclusions: this.generateConclusions()
    };

    // Save report to file
    const reportPath = path.join(__dirname, '../performance-reports', `fts5-benchmark-${Date.now()}.json`);
    const reportDir = path.dirname(reportPath);

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate summary report
    this.generateSummaryReport(report);

    console.log(`📊 Performance report saved to: ${reportPath}`);
    return report;
  }

  generateConclusions() {
    const improvement = parseFloat(this.results.comparison.overall.improvement);
    const conclusions = [];

    if (improvement > 30) {
      conclusions.push('Enhanced FTS5 shows exceptional performance improvements and should be deployed immediately.');
    } else if (improvement > 10) {
      conclusions.push('Enhanced FTS5 shows significant performance benefits and is recommended for production use.');
    } else if (improvement > 0) {
      conclusions.push('Enhanced FTS5 shows modest improvements. Consider deploying based on accuracy improvements.');
    } else {
      conclusions.push('Enhanced FTS5 performance is comparable to standard search. Focus on accuracy and feature benefits.');
    }

    // Add specific conclusions based on query types
    const bestType = Object.entries(this.results.comparison.byQueryType)
      .sort(([,a], [,b]) => parseFloat(b.improvement) - parseFloat(a.improvement))[0];

    if (bestType && parseFloat(bestType[1].improvement) > 20) {
      conclusions.push(`Enhanced FTS5 excels particularly with ${bestType[0]} queries (${bestType[1].improvement}% improvement).`);
    }

    return conclusions;
  }

  generateSummaryReport(report) {
    const summary = `
# FTS5 Performance Benchmark Report

**Generated:** ${new Date().toLocaleString()}

## Executive Summary

- **Total Queries Tested:** ${report.summary.totalQueries}
- **Overall Performance Improvement:** ${report.summary.overallImprovement}%
- **Average Standard Search Time:** ${report.summary.averageStandardTime}ms
- **Average Enhanced FTS5 Time:** ${report.summary.averageEnhancedTime}ms
- **Recommendations Generated:** ${report.summary.recommendationCount}

## Key Findings

${report.conclusions.map(c => `- ${c}`).join('\\n')}

## Performance by Query Type

${Object.entries(this.results.comparison.byQueryType).map(([type, data]) => `
### ${type.replace('_', ' ').toUpperCase()}
- **Standard Search:** ${data.standard.avg.toFixed(2)}ms avg, ${data.standard.p95.toFixed(2)}ms p95
- **Enhanced FTS5:** ${data.enhanced.avg.toFixed(2)}ms avg, ${data.enhanced.p95.toFixed(2)}ms p95
- **Improvement:** ${data.improvement}% (${data.p95Improvement}% p95)
`).join('')}

## Recommendations

${this.results.recommendations.map((rec, i) => `
${i + 1}. **${rec.title}** (${rec.priority.toUpperCase()})
   - ${rec.description}
   - *Action:* ${rec.action}
`).join('')}

## Next Steps

1. Review detailed benchmark results in JSON report
2. Implement high-priority recommendations
3. Plan deployment strategy for enhanced FTS5
4. Schedule regular performance monitoring

---
*Report generated by FTS5 Performance Benchmark Tool*
    `.trim();

    const summaryPath = path.join(__dirname, '../performance-reports', 'fts5-benchmark-summary.md');
    fs.writeFileSync(summaryPath, summary);
    console.log(`📝 Summary report saved to: ${summaryPath}`);
  }

  async run() {
    console.log('🚀 Starting FTS5 Performance Benchmark');
    console.log('=====================================');

    try {
      await this.initializeDatabase();
      await this.runStandardSearchBenchmark();
      await this.runEnhancedFTS5Benchmark();
      this.generateComparison();
      this.generateRecommendations();
      const report = await this.generateReport();

      console.log('\\n🎉 Benchmark completed successfully!');
      console.log(`Overall improvement: ${report.summary.overallImprovement}%`);
      console.log(`Average times: ${report.summary.averageStandardTime}ms → ${report.summary.averageEnhancedTime}ms`);

    } catch (error) {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    } finally {
      if (this.db) {
        this.db.close();
      }
    }
  }
}

// Run benchmark if called directly
if (require.main === module) {
  const benchmark = new FTS5PerformanceBenchmark();
  benchmark.run().catch(console.error);
}

module.exports = FTS5PerformanceBenchmark;