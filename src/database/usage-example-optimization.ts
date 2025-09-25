/**
 * Database Index Optimization Usage Examples
 *
 * This file demonstrates how to use the advanced index optimization features
 * to achieve sub-1 second database performance across all operations.
 *
 * @author Database Performance Team
 * @version 2.0.0
 */

import Database from 'better-sqlite3';
import { IndexOptimizationEngine } from './IndexOptimizationEngine';
import { QueryOptimizationService } from './QueryOptimizationService';
import { AdvancedIndexStrategy } from './AdvancedIndexStrategy';
import { QueryOptimizer } from './QueryOptimizer';

/**
 * Complete database optimization setup and usage examples
 */
export async function demonstrateIndexOptimization(): Promise<void> {
  console.log('🚀 Starting Database Index Optimization Demo...\n');

  // Initialize database connection
  const db = new Database(':memory:'); // Use ':memory:' for demo, file path in production

  // Set up database configuration for optimal performance
  setupDatabaseConfiguration(db);

  // Create sample schema and data
  await createSampleSchema(db);
  await populateSampleData(db);

  // Initialize optimization engines
  const indexEngine = new IndexOptimizationEngine(db);
  const queryService = new QueryOptimizationService(db);
  const indexStrategy = new AdvancedIndexStrategy(db);
  const queryOptimizer = new QueryOptimizer(db);

  console.log('✅ Optimization engines initialized\n');

  // Demonstrate index analysis and optimization
  await demonstrateIndexAnalysis(indexEngine);

  // Demonstrate query optimization
  await demonstrateQueryOptimization(queryService, queryOptimizer);

  // Demonstrate performance monitoring
  await demonstratePerformanceMonitoring(queryService);

  // Demonstrate adaptive indexing
  await demonstrateAdaptiveIndexing(indexStrategy);

  // Show final performance results
  await showPerformanceResults(indexEngine, queryService);

  console.log('🎉 Database Index Optimization Demo completed!');

  db.close();
}

/**
 * Set up database configuration for optimal performance
 */
function setupDatabaseConfiguration(db: Database.Database): void {
  console.log('📊 Configuring database for optimal performance...');

  // SQLite performance optimizations
  db.pragma('journal_mode = WAL'); // Write-Ahead Logging
  db.pragma('synchronous = NORMAL'); // Balance safety and speed
  db.pragma('cache_size = -64000'); // 64MB cache
  db.pragma('temp_store = MEMORY'); // Store temp tables in memory
  db.pragma('mmap_size = 268435456'); // 256MB memory map
  db.pragma('optimize'); // Analyze and optimize

  console.log('✅ Database configuration optimized\n');
}

/**
 * Create sample schema for demonstration
 */
async function createSampleSchema(db: Database.Database): Promise<void> {
  console.log('🏗️ Creating sample schema...');

  // Create main knowledge base table
  db.exec(`
    CREATE TABLE kb_entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      problem TEXT NOT NULL,
      solution TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT DEFAULT 'medium',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      usage_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      last_used DATETIME,
      archived BOOLEAN DEFAULT FALSE
    )
  `);

  // Create tags table
  db.exec(`
    CREATE TABLE kb_tags (
      entry_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (entry_id, tag),
      FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
    )
  `);

  // Create usage metrics table
  db.exec(`
    CREATE TABLE usage_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id TEXT NOT NULL,
      action TEXT NOT NULL,
      user_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
    )
  `);

  // Create search history table
  db.exec(`
    CREATE TABLE search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      results_count INTEGER DEFAULT 0,
      search_time_ms INTEGER DEFAULT 0,
      user_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create query performance table
  db.exec(`
    CREATE TABLE query_performance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query_hash TEXT NOT NULL,
      query_text TEXT NOT NULL,
      execution_time_ms INTEGER NOT NULL,
      rows_examined INTEGER DEFAULT 0,
      rows_returned INTEGER DEFAULT 0,
      cache_hit BOOLEAN DEFAULT FALSE,
      index_used BOOLEAN DEFAULT FALSE,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Sample schema created\n');
}

/**
 * Populate sample data for testing
 */
async function populateSampleData(db: Database.Database): Promise<void> {
  console.log('📝 Populating sample data...');

  const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'CICS', 'IMS'];
  const severities = ['critical', 'high', 'medium', 'low'];
  const sampleTags = [
    'error',
    'performance',
    'memory',
    'timeout',
    'configuration',
    'batch',
    'online',
  ];

  // Insert sample entries
  const insertEntry = db.prepare(`
    INSERT INTO kb_entries (id, title, problem, solution, category, severity, usage_count, success_count, failure_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTag = db.prepare(`
    INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)
  `);

  // Generate 1000 sample entries
  for (let i = 1; i <= 1000; i++) {
    const id = `KB${i.toString().padStart(4, '0')}`;
    const category = categories[Math.floor(Math.random() * categories.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];

    insertEntry.run(
      id,
      `Sample ${category} Issue ${i}`,
      `This is a sample problem description for entry ${i}. It demonstrates various ${category} issues that might occur in mainframe environments.`,
      `This is the solution for ${category} issue ${i}. Follow these steps to resolve the problem: 1) Check configuration, 2) Verify parameters, 3) Restart services if needed.`,
      category,
      severity,
      Math.floor(Math.random() * 100),
      Math.floor(Math.random() * 50),
      Math.floor(Math.random() * 10)
    );

    // Add random tags
    const numTags = Math.floor(Math.random() * 3) + 1;
    const shuffledTags = [...sampleTags].sort(() => 0.5 - Math.random());

    for (let j = 0; j < numTags; j++) {
      insertTag.run(id, shuffledTags[j]);
    }
  }

  // Insert sample usage metrics
  const insertUsage = db.prepare(`
    INSERT INTO usage_metrics (entry_id, action, user_id) VALUES (?, ?, ?)
  `);

  for (let i = 0; i < 5000; i++) {
    const entryId = `KB${(Math.floor(Math.random() * 1000) + 1).toString().padStart(4, '0')}`;
    const actions = ['view', 'copy', 'rate_success', 'rate_failure'];
    const action = actions[Math.floor(Math.random() * actions.length)];

    insertUsage.run(entryId, action, `user${Math.floor(Math.random() * 50) + 1}`);
  }

  // Insert sample search history
  const insertSearch = db.prepare(`
    INSERT INTO search_history (query, results_count, search_time_ms, user_id) VALUES (?, ?, ?, ?)
  `);

  const sampleQueries = [
    'JCL error',
    'DB2 performance',
    'VSAM configuration',
    'batch timeout',
    'CICS memory issue',
    'IMS deadlock',
  ];

  for (let i = 0; i < 2000; i++) {
    const query = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];
    const resultsCount = Math.floor(Math.random() * 20) + 1;
    const searchTime = Math.floor(Math.random() * 500) + 50;

    insertSearch.run(query, resultsCount, searchTime, `user${Math.floor(Math.random() * 50) + 1}`);
  }

  console.log('✅ Sample data populated (1000 entries, 5000 usage records, 2000 searches)\n');
}

/**
 * Demonstrate index analysis and optimization
 */
async function demonstrateIndexAnalysis(indexEngine: IndexOptimizationEngine): Promise<void> {
  console.log('🔍 DEMONSTRATING INDEX ANALYSIS');
  console.log('================================\n');

  try {
    // Analyze current index state
    const analysis = await indexEngine.analyzeIndexes();

    console.log('📊 Index Analysis Summary:');
    console.log(`   Total Indexes: ${analysis.summary.total_indexes}`);
    console.log(`   Effective Indexes: ${analysis.summary.effective_indexes}`);
    console.log(`   Unused Indexes: ${analysis.summary.unused_indexes}`);
    console.log(`   Optimization Score: ${analysis.summary.optimization_score}/100`);
    console.log(`   Recommendations: ${analysis.summary.recommendations_count}\n`);

    // Show top recommendations
    if (analysis.recommendations.length > 0) {
      console.log('🔧 Top Optimization Recommendations:');
      analysis.recommendations.slice(0, 3).forEach((rec, idx) => {
        console.log(`   ${idx + 1}. [${rec.priority}] ${rec.description}`);
        console.log(`      ${rec.rationale}`);
        console.log(`      Estimated Improvement: ${rec.estimated_improvement}\n`);
      });
    }

    // Create optimal indexes
    console.log('🚀 Creating Optimal Indexes (Dry Run):');
    const optimization = await indexEngine.createOptimalIndexes(true);
    console.log(`   Would create: ${optimization.created_indexes.length} indexes`);
    console.log(`   Would drop: ${optimization.dropped_indexes.length} indexes`);
    console.log(`   Expected improvement: ${optimization.estimated_improvement}\n`);
  } catch (error) {
    console.error('❌ Index analysis failed:', error);
  }
}

/**
 * Demonstrate query optimization
 */
async function demonstrateQueryOptimization(
  queryService: QueryOptimizationService,
  queryOptimizer: QueryOptimizer
): Promise<void> {
  console.log('⚡ DEMONSTRATING QUERY OPTIMIZATION');
  console.log('===================================\n');

  try {
    // Test queries with different complexity levels
    const testQueries = [
      {
        name: 'Simple Category Search',
        sql: `SELECT id, title, usage_count FROM kb_entries WHERE category = 'JCL' AND archived = FALSE ORDER BY usage_count DESC LIMIT 10`,
      },
      {
        name: 'Complex Multi-Table Join',
        sql: `
          SELECT DISTINCT e.id, e.title, e.category, GROUP_CONCAT(t.tag) as tags
          FROM kb_entries e
          LEFT JOIN kb_tags t ON e.id = t.entry_id
          WHERE e.archived = FALSE
            AND e.usage_count > 10
          GROUP BY e.id
          ORDER BY e.usage_count DESC, e.success_count DESC
          LIMIT 20
        `,
      },
      {
        name: 'Analytics Query with Subquery',
        sql: `
          SELECT category, COUNT(*) as total_entries,
                 AVG(usage_count) as avg_usage,
                 (SELECT COUNT(*) FROM usage_metrics WHERE entry_id = e.id AND action = 'view') as total_views
          FROM kb_entries e
          WHERE archived = FALSE
          GROUP BY category
          HAVING total_entries > 5
          ORDER BY avg_usage DESC
        `,
      },
    ];

    for (const testQuery of testQueries) {
      console.log(`🔍 Analyzing: ${testQuery.name}`);

      // Analyze original query
      const analysis = await queryService.analyzeQueryPerformance(testQuery.sql);
      console.log(`   Original execution time: ${analysis.execution_time_ms}ms`);
      console.log(`   Optimization score: ${analysis.optimization_score}/100`);

      if (analysis.bottlenecks.length > 0) {
        console.log(`   Bottlenecks: ${analysis.bottlenecks.join(', ')}`);
      }

      // Optimize the query
      const optimization = await queryService.optimizeQuery(testQuery.sql);
      if (optimization.estimated_improvement > 0) {
        console.log(`   ✅ Optimized with ${optimization.estimated_improvement}% improvement`);
        console.log(`   Techniques: ${optimization.optimization_techniques.join(', ')}`);
      } else {
        console.log(`   ✅ Query already optimal`);
      }

      console.log();
    }

    // Test optimized query execution
    console.log('🚀 Testing Optimized Query Execution:');
    const result = await queryService.executeOptimizedQuery(testQueries[0].sql, []);

    console.log(`   Results: ${result.results.length} rows`);
    console.log(`   Execution time: ${result.execution_time_ms}ms`);
    console.log(`   Cache hit: ${result.cache_hit ? 'Yes' : 'No'}`);
    console.log(`   Optimization applied: ${result.optimization_applied ? 'Yes' : 'No'}\n`);
  } catch (error) {
    console.error('❌ Query optimization failed:', error);
  }
}

/**
 * Demonstrate performance monitoring
 */
async function demonstratePerformanceMonitoring(
  queryService: QueryOptimizationService
): Promise<void> {
  console.log('📊 DEMONSTRATING PERFORMANCE MONITORING');
  console.log('=======================================\n');

  try {
    // Run some queries to generate performance data
    const queries = [
      "SELECT * FROM kb_entries WHERE category = 'JCL' LIMIT 10",
      'SELECT COUNT(*) FROM kb_entries GROUP BY category',
      'SELECT * FROM kb_entries WHERE usage_count > 50 ORDER BY last_used DESC LIMIT 5',
    ];

    console.log('🔄 Executing test queries to generate performance data...');
    for (const query of queries) {
      await queryService.executeOptimizedQuery(query);
    }

    // Get performance dashboard
    const dashboard = queryService.getPerformanceDashboard();

    console.log('📈 Performance Dashboard:');
    console.log('   Overview:');
    console.log(`     Total Queries: ${dashboard.overview.total_queries}`);
    console.log(`     Avg Execution Time: ${dashboard.overview.avg_execution_time_ms}ms`);
    console.log(`     Cache Hit Rate: ${dashboard.overview.cache_hit_rate}%`);
    console.log(`     Optimization Rate: ${dashboard.overview.optimization_rate}%\n`);

    if (dashboard.slow_queries.length > 0) {
      console.log('🐌 Slow Queries Detected:');
      dashboard.slow_queries.forEach((query, idx) => {
        console.log(`   ${idx + 1}. ${query.sql} (${query.execution_time_ms}ms)`);
        if (query.optimization_suggestions.length > 0) {
          console.log(`      Suggestions: ${query.optimization_suggestions.join(', ')}`);
        }
      });
      console.log();
    }

    console.log('💡 System Recommendations:');
    dashboard.recommendations.forEach((rec, idx) => {
      console.log(`   ${idx + 1}. ${rec}`);
    });
    console.log();
  } catch (error) {
    console.error('❌ Performance monitoring failed:', error);
  }
}

/**
 * Demonstrate adaptive indexing
 */
async function demonstrateAdaptiveIndexing(indexStrategy: AdvancedIndexStrategy): Promise<void> {
  console.log('🧠 DEMONSTRATING ADAPTIVE INDEXING');
  console.log('===================================\n');

  try {
    console.log('📊 Analyzing index effectiveness...');
    const metrics = indexStrategy.analyzeIndexEffectiveness();

    console.log(`Found ${metrics.length} indexes to analyze:`);
    metrics.slice(0, 5).forEach((metric, idx) => {
      console.log(`   ${idx + 1}. ${metric.name} (${metric.table})`);
      console.log(
        `      Type: ${metric.type}, Usage: ${metric.usage}, Effectiveness: ${(metric.effectiveness * 100).toFixed(1)}%`
      );
      if (metric.recommendations.length > 0) {
        console.log(`      Recommendations: ${metric.recommendations.join(', ')}`);
      }
    });
    console.log();

    console.log('🔧 Creating adaptive indexes based on usage patterns...');
    indexStrategy.createAdaptiveIndexes();

    console.log('📈 Generating maintenance report...');
    const report = indexStrategy.generateMaintenanceReport();

    console.log('   Maintenance Summary:');
    console.log(`     Total Indexes: ${report.summary.totalIndexes}`);
    console.log(`     Used Indexes: ${report.summary.usedIndexes}`);
    console.log(`     Effectiveness: ${report.summary.effectiveness}%`);

    if (report.actions.length > 0) {
      console.log('   Recommended Actions:');
      report.actions.forEach((action, idx) => {
        console.log(`     ${idx + 1}. ${action}`);
      });
    }
    console.log();
  } catch (error) {
    console.error('❌ Adaptive indexing failed:', error);
  }
}

/**
 * Show final performance results
 */
async function showPerformanceResults(
  indexEngine: IndexOptimizationEngine,
  queryService: QueryOptimizationService
): Promise<void> {
  console.log('🏆 FINAL PERFORMANCE RESULTS');
  console.log('=============================\n');

  try {
    // Test search performance with common queries
    const searchQueries = [
      "SELECT * FROM kb_entries WHERE category = 'JCL' AND archived = FALSE ORDER BY usage_count DESC LIMIT 10",
      "SELECT e.*, GROUP_CONCAT(t.tag) as tags FROM kb_entries e LEFT JOIN kb_tags t ON e.id = t.entry_id WHERE e.category = 'DB2' GROUP BY e.id LIMIT 5",
      'SELECT category, COUNT(*) FROM kb_entries WHERE archived = FALSE GROUP BY category ORDER BY COUNT(*) DESC',
    ];

    console.log('⚡ Performance Test Results:');

    let totalTime = 0;
    let subSecondQueries = 0;

    for (let i = 0; i < searchQueries.length; i++) {
      const query = searchQueries[i];
      const startTime = Date.now();

      try {
        const result = await queryService.executeOptimizedQuery(query);
        const executionTime = Date.now() - startTime;
        totalTime += executionTime;

        if (executionTime < 1000) subSecondQueries++;

        console.log(
          `   Query ${i + 1}: ${executionTime}ms (${result.results.length} results) ${executionTime < 100 ? '🟢' : executionTime < 1000 ? '🟡' : '🔴'}`
        );
      } catch (error) {
        console.log(`   Query ${i + 1}: FAILED 🔴`);
      }
    }

    const avgTime = totalTime / searchQueries.length;
    const subSecondRate = (subSecondQueries / searchQueries.length) * 100;

    console.log('\n📊 Performance Summary:');
    console.log(`   Average Query Time: ${avgTime.toFixed(2)}ms`);
    console.log(`   Sub-1s Query Rate: ${subSecondRate.toFixed(1)}%`);
    console.log(
      `   Target Achievement: ${avgTime < 100 ? '✅ EXCELLENT' : avgTime < 1000 ? '✅ GOOD' : '❌ NEEDS IMPROVEMENT'}`
    );

    if (avgTime < 100) {
      console.log('\n🎉 CONGRATULATIONS! Database is optimized for sub-100ms performance!');
    } else if (avgTime < 1000) {
      console.log('\n✅ SUCCESS! Database achieved sub-1s performance target!');
    } else {
      console.log('\n⚠️ Performance target not met. Consider applying recommended optimizations.');
    }
  } catch (error) {
    console.error('❌ Performance testing failed:', error);
  }
}

/**
 * Demonstration of specific optimization scenarios
 */
export async function demonstrateSpecificOptimizations(): Promise<void> {
  console.log('\n🎯 SPECIFIC OPTIMIZATION SCENARIOS');
  console.log('==================================\n');

  const db = new Database(':memory:');
  setupDatabaseConfiguration(db);
  await createSampleSchema(db);

  // Scenario 1: Large table scan optimization
  console.log('📋 Scenario 1: Optimizing Large Table Scans');
  console.log("Before: SELECT * FROM kb_entries WHERE category = 'JCL'");
  console.log('Problem: Full table scan on large table');
  console.log('Solution: CREATE INDEX idx_category_archived ON kb_entries(category, archived);');
  console.log('Expected improvement: 80-95% faster queries\n');

  // Scenario 2: JOIN optimization
  console.log('📋 Scenario 2: Optimizing Complex JOINs');
  console.log('Before: Multiple table JOINs without proper indexes');
  console.log('Problem: Nested loop joins instead of hash/merge joins');
  console.log('Solution: CREATE INDEX idx_tags_entry_id ON kb_tags(entry_id);');
  console.log('Expected improvement: 50-70% faster JOINs\n');

  // Scenario 3: Sorting optimization
  console.log('📋 Scenario 3: Optimizing ORDER BY Queries');
  console.log('Before: SELECT * FROM kb_entries ORDER BY usage_count DESC, created_at DESC');
  console.log('Problem: External sorting required');
  console.log(
    'Solution: CREATE INDEX idx_usage_created ON kb_entries(usage_count DESC, created_at DESC);'
  );
  console.log('Expected improvement: 60-80% faster sorting\n');

  // Scenario 4: Covering index optimization
  console.log('📋 Scenario 4: Implementing Covering Indexes');
  console.log('Before: Index lookup + table lookup for each result');
  console.log('Problem: Double I/O for each row returned');
  console.log(
    'Solution: CREATE INDEX idx_covering ON kb_entries(category, id, title, usage_count);'
  );
  console.log('Expected improvement: 40-60% faster queries with no table lookups\n');

  db.close();
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateIndexOptimization()
    .then(() => demonstrateSpecificOptimizations())
    .catch(error => {
      console.error('Demo failed:', error);
      process.exit(1);
    });
}

export default {
  demonstrateIndexOptimization,
  demonstrateSpecificOptimizations,
};
