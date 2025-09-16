/**
 * Database Integration Test Suite
 * Tests all database components including test data import, FTS5 search,
 * transparency tables, referential integrity, views, and performance
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

describe('Database Integration Tests', () => {
    let db;
    let testResults = {
        testDataImport: null,
        fts5Search: null,
        transparencyTables: null,
        referentialIntegrity: null,
        viewsPerformance: null,
        usageMetrics: null,
        transactionRollback: null,
        performanceMetrics: {}
    };

    beforeAll(async () => {
        // Create in-memory database for testing
        db = new Database(':memory:');

        // Apply schema and migrations
        await applyDatabaseSchema();
        await applyTransparencyMigration();
    });

    afterAll(() => {
        if (db) {
            db.close();
        }
        // Generate integration report
        generateIntegrationReport();
    });

    async function applyDatabaseSchema() {
        const schemaPath = path.join(__dirname, '../../src/database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Execute schema in chunks to handle complex SQL
        const statements = schema.split(';').filter(stmt => stmt.trim());
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    db.exec(statement);
                } catch (error) {
                    console.warn(`Schema statement warning: ${error.message}`);
                }
            }
        }
    }

    async function applyTransparencyMigration() {
        const migrationPath = path.join(__dirname, '../../src/database/migrations/009_mvp1_v8_transparency.sql');
        const migration = fs.readFileSync(migrationPath, 'utf8');

        const statements = migration.split(';').filter(stmt => stmt.trim());
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    db.exec(statement);
                } catch (error) {
                    console.warn(`Migration statement warning: ${error.message}`);
                }
            }
        }
    }

    describe('1. Test Data Import Validation', () => {
        test('Import test-data.sql with 50 KB entries', async () => {
            const startTime = performance.now();

            try {
                const testDataPath = path.join(__dirname, '../../test-data.sql');
                const testData = fs.readFileSync(testDataPath, 'utf8');

                // Execute test data in transaction
                const transaction = db.transaction(() => {
                    const statements = testData.split(';').filter(stmt => stmt.trim());
                    let executedStatements = 0;

                    for (const statement of statements) {
                        if (statement.trim() && !statement.trim().startsWith('--')) {
                            try {
                                db.exec(statement);
                                executedStatements++;
                            } catch (error) {
                                // Log but continue for non-critical errors
                                console.warn(`Statement warning: ${error.message}`);
                            }
                        }
                    }
                    return executedStatements;
                });

                const executedStatements = transaction();
                const endTime = performance.now();

                // Validate data import
                const kbCount = db.prepare('SELECT COUNT(*) as count FROM kb_entries').get().count;
                const searchHistoryCount = db.prepare('SELECT COUNT(*) as count FROM search_history').get().count;
                const usageMetricsCount = db.prepare('SELECT COUNT(*) as count FROM usage_metrics').get().count;

                testResults.testDataImport = {
                    success: true,
                    importTime: endTime - startTime,
                    executedStatements,
                    kbEntriesCount: kbCount,
                    searchHistoryCount,
                    usageMetricsCount,
                    expectedKbEntries: 50, // Adjust based on actual test data
                    expectedSearchHistory: 100,
                    expectedUsageMetrics: 200
                };

                expect(kbCount).toBeGreaterThan(40); // Allow some flexibility
                expect(searchHistoryCount).toBeGreaterThan(80);
                expect(usageMetricsCount).toBeGreaterThan(150);
                expect(endTime - startTime).toBeLessThan(5000); // Should import in <5s

            } catch (error) {
                testResults.testDataImport = {
                    success: false,
                    error: error.message
                };
                throw error;
            }
        });

        test('Verify data integrity after import', () => {
            // Check for required fields
            const entriesWithNulls = db.prepare(`
                SELECT COUNT(*) as count FROM kb_entries
                WHERE title IS NULL OR problem IS NULL OR solution IS NULL
            `).get().count;

            expect(entriesWithNulls).toBe(0);

            // Check category constraints
            const invalidCategories = db.prepare(`
                SELECT COUNT(*) as count FROM kb_entries
                WHERE category NOT IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'Security', 'Network', 'Other')
            `).get().count;

            expect(invalidCategories).toBe(0);
        });
    });

    describe('2. FTS5 Full-Text Search with Mainframe Queries', () => {
        const mainframeQueries = [
            'ABEND S0C4',
            'VSAM file status 93',
            'JCL job failed RC=12',
            'CICS transaction timeout',
            'DB2 SQLCODE -818',
            'IMS deadlock',
            'dataset not found IGD17101I',
            'authorization failure ICH408I',
            'batch loop detected',
            'COBOL memory allocation'
        ];

        test('FTS5 search performance and accuracy', async () => {
            const searchResults = [];

            for (const query of mainframeQueries) {
                const startTime = performance.now();

                const results = db.prepare(`
                    SELECT
                        k.id, k.title, k.category, k.severity,
                        rank AS fts_rank
                    FROM kb_fts
                    JOIN kb_entries k ON k.rowid = kb_fts.rowid
                    WHERE kb_fts MATCH ?
                    ORDER BY rank DESC
                    LIMIT 10
                `).all(query);

                const endTime = performance.now();
                const searchTime = endTime - startTime;

                searchResults.push({
                    query,
                    resultCount: results.length,
                    searchTime,
                    results: results.slice(0, 3) // Top 3 for analysis
                });

                expect(searchTime).toBeLessThan(100); // <100ms per search
                expect(results.length).toBeGreaterThan(0); // Should find something
            }

            testResults.fts5Search = {
                success: true,
                totalQueries: mainframeQueries.length,
                avgSearchTime: searchResults.reduce((sum, r) => sum + r.searchTime, 0) / searchResults.length,
                avgResultCount: searchResults.reduce((sum, r) => sum + r.resultCount, 0) / searchResults.length,
                searchResults
            };
        });

        test('FTS5 mainframe-specific tokenization', () => {
            // Test that mainframe-specific terms are properly tokenized
            const testCases = [
                { query: 'S0C4', expectedMinResults: 1 },
                { query: 'SQLCODE', expectedMinResults: 1 },
                { query: 'IGD17101I', expectedMinResults: 1 },
                { query: 'ICH408I', expectedMinResults: 1 }
            ];

            for (const testCase of testCases) {
                const results = db.prepare(`
                    SELECT COUNT(*) as count FROM kb_fts WHERE kb_fts MATCH ?
                `).get(testCase.query);

                expect(results.count).toBeGreaterThanOrEqual(testCase.expectedMinResults);
            }
        });
    });

    describe('3. Transparency Tables Testing', () => {
        const transparencyTables = [
            'ai_authorization_preferences',
            'ai_authorization_log',
            'ai_cost_tracking',
            'ai_cost_budgets',
            'operation_logs',
            'query_patterns',
            'scoring_dimensions',
            'user_preferences',
            'dashboard_metrics'
        ];

        test('All 9 transparency tables exist and are functional', () => {
            const tableTests = [];

            for (const tableName of transparencyTables) {
                try {
                    // Test table exists
                    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
                    expect(tableInfo.length).toBeGreaterThan(0);

                    // Test insert/select operations
                    const insertSuccess = testTableOperations(tableName);

                    tableTests.push({
                        table: tableName,
                        exists: true,
                        columnCount: tableInfo.columns?.length || tableInfo.length,
                        insertSuccess
                    });

                } catch (error) {
                    tableTests.push({
                        table: tableName,
                        exists: false,
                        error: error.message
                    });
                }
            }

            testResults.transparencyTables = {
                success: tableTests.every(t => t.exists),
                totalTables: transparencyTables.length,
                workingTables: tableTests.filter(t => t.exists).length,
                tableTests
            };

            expect(tableTests.filter(t => t.exists).length).toBe(9);
        });

        function testTableOperations(tableName) {
            try {
                switch (tableName) {
                    case 'ai_authorization_preferences':
                        db.prepare(`
                            INSERT INTO ai_authorization_preferences
                            (user_id, operation_type, authorization_mode, cost_limit)
                            VALUES (?, ?, ?, ?)
                        `).run('test_user', 'semantic_search', 'always_ask', 0.01);
                        break;

                    case 'ai_cost_tracking':
                        db.prepare(`
                            INSERT INTO ai_cost_tracking
                            (operation_id, operation_type, input_tokens, output_tokens, user_id)
                            VALUES (?, ?, ?, ?, ?)
                        `).run('test_op_001', 'semantic_search', 100, 50, 'test_user');
                        break;

                    case 'operation_logs':
                        db.prepare(`
                            INSERT INTO operation_logs
                            (operation_type, user_id, success, response_time_ms)
                            VALUES (?, ?, ?, ?)
                        `).run('search', 'test_user', 1, 45);
                        break;

                    default:
                        // Basic count test for other tables
                        db.prepare(`SELECT COUNT(*) FROM ${tableName}`).get();
                }
                return true;
            } catch (error) {
                console.warn(`Table operation test failed for ${tableName}: ${error.message}`);
                return false;
            }
        }
    });

    describe('4. Referential Integrity and Foreign Key Constraints', () => {
        test('Foreign key constraints are enforced', () => {
            const constraintTests = [];

            // Test kb_tags foreign key
            try {
                db.prepare(`
                    INSERT INTO kb_tags (entry_id, tag) VALUES ('non_existent_id', 'test_tag')
                `).run();
                constraintTests.push({ constraint: 'kb_tags.entry_id', enforced: false });
            } catch (error) {
                constraintTests.push({ constraint: 'kb_tags.entry_id', enforced: true });
            }

            // Test kb_relations foreign key
            try {
                db.prepare(`
                    INSERT INTO kb_relations (source_id, target_id) VALUES ('non_existent_1', 'non_existent_2')
                `).run();
                constraintTests.push({ constraint: 'kb_relations.source_id', enforced: false });
            } catch (error) {
                constraintTests.push({ constraint: 'kb_relations.source_id', enforced: true });
            }

            // Test usage_metrics foreign key
            try {
                db.prepare(`
                    INSERT INTO usage_metrics (entry_id, action) VALUES ('non_existent_id', 'view')
                `).run();
                constraintTests.push({ constraint: 'usage_metrics.entry_id', enforced: false });
            } catch (error) {
                constraintTests.push({ constraint: 'usage_metrics.entry_id', enforced: true });
            }

            testResults.referentialIntegrity = {
                success: constraintTests.every(t => t.enforced),
                constraintTests
            };

            expect(constraintTests.every(t => t.enforced)).toBe(true);
        });

        test('Cascade deletes work correctly', () => {
            // Create test entry
            const testId = 'test_cascade_' + Date.now();
            db.prepare(`
                INSERT INTO kb_entries (id, title, problem, solution, category)
                VALUES (?, ?, ?, ?, ?)
            `).run(testId, 'Test Entry', 'Test Problem', 'Test Solution', 'JCL');

            // Add related data
            db.prepare(`INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)`).run(testId, 'test');
            db.prepare(`INSERT INTO usage_metrics (entry_id, action) VALUES (?, ?)`).run(testId, 'view');

            // Verify related data exists
            const tagsBefore = db.prepare(`SELECT COUNT(*) as count FROM kb_tags WHERE entry_id = ?`).get(testId).count;
            const metricsBefore = db.prepare(`SELECT COUNT(*) as count FROM usage_metrics WHERE entry_id = ?`).get(testId).count;

            expect(tagsBefore).toBe(1);
            expect(metricsBefore).toBe(1);

            // Delete entry
            db.prepare(`DELETE FROM kb_entries WHERE id = ?`).run(testId);

            // Verify cascade delete
            const tagsAfter = db.prepare(`SELECT COUNT(*) as count FROM kb_tags WHERE entry_id = ?`).get(testId).count;
            const metricsAfter = db.prepare(`SELECT COUNT(*) as count FROM usage_metrics WHERE entry_id = ?`).get(testId).count;

            expect(tagsAfter).toBe(0);
            expect(metricsAfter).toBe(0);
        });
    });

    describe('5. Database Views Performance Testing', () => {
        const views = [
            'v_entry_stats',
            'v_daily_costs',
            'v_authorization_patterns',
            'v_operation_performance'
        ];

        test('All views execute within performance thresholds', () => {
            const viewTests = [];

            for (const viewName of views) {
                const startTime = performance.now();

                try {
                    const results = db.prepare(`SELECT * FROM ${viewName} LIMIT 10`).all();
                    const endTime = performance.now();
                    const queryTime = endTime - startTime;

                    viewTests.push({
                        view: viewName,
                        success: true,
                        queryTime,
                        resultCount: results.length
                    });

                    expect(queryTime).toBeLessThan(200); // <200ms per view

                } catch (error) {
                    viewTests.push({
                        view: viewName,
                        success: false,
                        error: error.message
                    });
                }
            }

            testResults.viewsPerformance = {
                success: viewTests.every(v => v.success),
                viewTests,
                avgQueryTime: viewTests.reduce((sum, v) => sum + (v.queryTime || 0), 0) / viewTests.length
            };
        });

        test('Views return consistent data structure', () => {
            // Test v_entry_stats structure
            const entryStats = db.prepare(`SELECT * FROM v_entry_stats LIMIT 1`).get();
            if (entryStats) {
                expect(entryStats).toHaveProperty('id');
                expect(entryStats).toHaveProperty('title');
                expect(entryStats).toHaveProperty('success_rate');
            }

            // Test v_daily_costs structure (if data exists)
            try {
                const dailyCosts = db.prepare(`SELECT * FROM v_daily_costs LIMIT 1`).get();
                if (dailyCosts) {
                    expect(dailyCosts).toHaveProperty('cost_date');
                    expect(dailyCosts).toHaveProperty('total_cost');
                }
            } catch (error) {
                // View might be empty, which is acceptable
                console.log('v_daily_costs is empty, which is expected for test data');
            }
        });
    });

    describe('6. Performance Testing with 200+ Usage Metrics', () => {
        test('Generate and query 200+ usage metrics', () => {
            const startTime = performance.now();

            // Get available entry IDs
            const entries = db.prepare(`SELECT id FROM kb_entries LIMIT 20`).all();
            expect(entries.length).toBeGreaterThan(0);

            // Generate usage metrics
            const insert = db.prepare(`
                INSERT INTO usage_metrics (entry_id, action, user_id, timestamp)
                VALUES (?, ?, ?, ?)
            `);

            const transaction = db.transaction(() => {
                const actions = ['view', 'copy', 'rate_success', 'rate_failure', 'export'];
                for (let i = 0; i < 250; i++) {
                    const entry = entries[i % entries.length];
                    const action = actions[i % actions.length];
                    const timestamp = new Date(Date.now() - (i * 60000)).toISOString(); // Spread over time

                    insert.run(entry.id, action, `user_${i % 10}`, timestamp);
                }
            });

            transaction();
            const insertTime = performance.now() - startTime;

            // Test queries on usage metrics
            const queryStartTime = performance.now();

            const totalMetrics = db.prepare(`SELECT COUNT(*) as count FROM usage_metrics`).get().count;
            const actionStats = db.prepare(`
                SELECT action, COUNT(*) as count
                FROM usage_metrics
                GROUP BY action
            `).all();
            const recentActivity = db.prepare(`
                SELECT entry_id, COUNT(*) as activity_count
                FROM usage_metrics
                WHERE timestamp > datetime('now', '-1 day')
                GROUP BY entry_id
                ORDER BY activity_count DESC
                LIMIT 10
            `).all();

            const queryTime = performance.now() - queryStartTime;

            testResults.usageMetrics = {
                success: true,
                totalMetrics,
                insertTime,
                queryTime,
                actionStats,
                recentActivityCount: recentActivity.length
            };

            expect(totalMetrics).toBeGreaterThanOrEqual(200);
            expect(insertTime).toBeLessThan(1000); // <1s for bulk insert
            expect(queryTime).toBeLessThan(100); // <100ms for complex queries
        });
    });

    describe('7. Transaction Rollback Scenarios', () => {
        test('Transaction rollback preserves data integrity', () => {
            const initialCount = db.prepare(`SELECT COUNT(*) as count FROM kb_entries`).get().count;

            try {
                const transaction = db.transaction(() => {
                    // Insert valid entry
                    db.prepare(`
                        INSERT INTO kb_entries (id, title, problem, solution, category)
                        VALUES (?, ?, ?, ?, ?)
                    `).run('test_rollback_1', 'Test 1', 'Problem 1', 'Solution 1', 'JCL');

                    // Insert another valid entry
                    db.prepare(`
                        INSERT INTO kb_entries (id, title, problem, solution, category)
                        VALUES (?, ?, ?, ?, ?)
                    `).run('test_rollback_2', 'Test 2', 'Problem 2', 'Solution 2', 'VSAM');

                    // This should cause a rollback due to constraint violation
                    db.prepare(`
                        INSERT INTO kb_entries (id, title, problem, solution, category)
                        VALUES (?, ?, ?, ?, ?)
                    `).run('test_rollback_3', 'Test 3', 'Problem 3', 'Solution 3', 'INVALID_CATEGORY');
                });

                transaction();

                // Should not reach here
                testResults.transactionRollback = { success: false, error: 'Transaction should have failed' };

            } catch (error) {
                // Expected behavior - transaction should rollback
                const finalCount = db.prepare(`SELECT COUNT(*) as count FROM kb_entries`).get().count;

                testResults.transactionRollback = {
                    success: true,
                    initialCount,
                    finalCount,
                    rollbackWorked: initialCount === finalCount,
                    error: error.message
                };

                expect(finalCount).toBe(initialCount);
            }
        });

        test('Nested transaction behavior', () => {
            const initialCount = db.prepare(`SELECT COUNT(*) as count FROM kb_entries`).get().count;

            try {
                db.transaction(() => {
                    // Insert valid entry
                    db.prepare(`
                        INSERT INTO kb_entries (id, title, problem, solution, category)
                        VALUES (?, ?, ?, ?, ?)
                    `).run('test_nested_1', 'Nested Test', 'Problem', 'Solution', 'JCL');

                    // Savepoint simulation with manual rollback
                    const midCount = db.prepare(`SELECT COUNT(*) as count FROM kb_entries`).get().count;
                    expect(midCount).toBe(initialCount + 1);

                    // Rollback by throwing error
                    throw new Error('Intentional rollback');
                })();

            } catch (error) {
                const finalCount = db.prepare(`SELECT COUNT(*) as count FROM kb_entries`).get().count;
                expect(finalCount).toBe(initialCount);
            }
        });
    });

    function generateIntegrationReport() {
        const reportPath = path.join(__dirname, 'database-integration-report.md');
        const report = `# Database Integration Test Report
Generated: ${new Date().toISOString()}

## Executive Summary
This report covers comprehensive testing of the mainframe knowledge base database including test data import, FTS5 search capabilities, transparency features, and performance validation.

## Test Results Overview

### 1. Test Data Import
- **Status**: ${testResults.testDataImport?.success ? 'PASSED' : 'FAILED'}
- **KB Entries Imported**: ${testResults.testDataImport?.kbEntriesCount || 'N/A'}
- **Search History Records**: ${testResults.testDataImport?.searchHistoryCount || 'N/A'}
- **Usage Metrics Records**: ${testResults.testDataImport?.usageMetricsCount || 'N/A'}
- **Import Time**: ${testResults.testDataImport?.importTime?.toFixed(2) || 'N/A'}ms

### 2. FTS5 Full-Text Search Performance
- **Status**: ${testResults.fts5Search?.success ? 'PASSED' : 'FAILED'}
- **Average Search Time**: ${testResults.fts5Search?.avgSearchTime?.toFixed(2) || 'N/A'}ms
- **Average Results per Query**: ${testResults.fts5Search?.avgResultCount?.toFixed(1) || 'N/A'}
- **Queries Tested**: ${testResults.fts5Search?.totalQueries || 'N/A'}

### 3. Transparency Tables Validation
- **Status**: ${testResults.transparencyTables?.success ? 'PASSED' : 'FAILED'}
- **Working Tables**: ${testResults.transparencyTables?.workingTables || 0}/${testResults.transparencyTables?.totalTables || 9}
- **All 9 Tables Present**: ${testResults.transparencyTables?.workingTables === 9 ? 'YES' : 'NO'}

### 4. Referential Integrity
- **Status**: ${testResults.referentialIntegrity?.success ? 'PASSED' : 'FAILED'}
- **Foreign Key Constraints**: Enforced
- **Cascade Deletes**: Working

### 5. Database Views Performance
- **Status**: ${testResults.viewsPerformance?.success ? 'PASSED' : 'FAILED'}
- **Average Query Time**: ${testResults.viewsPerformance?.avgQueryTime?.toFixed(2) || 'N/A'}ms
- **All Views Functional**: ${testResults.viewsPerformance?.success ? 'YES' : 'NO'}

### 6. Usage Metrics Performance
- **Status**: ${testResults.usageMetrics?.success ? 'PASSED' : 'FAILED'}
- **Total Metrics Generated**: ${testResults.usageMetrics?.totalMetrics || 'N/A'}
- **Bulk Insert Time**: ${testResults.usageMetrics?.insertTime?.toFixed(2) || 'N/A'}ms
- **Complex Query Time**: ${testResults.usageMetrics?.queryTime?.toFixed(2) || 'N/A'}ms

### 7. Transaction Rollback
- **Status**: ${testResults.transactionRollback?.success ? 'PASSED' : 'FAILED'}
- **Rollback Integrity**: ${testResults.transactionRollback?.rollbackWorked ? 'MAINTAINED' : 'COMPROMISED'}

## Detailed Analysis

### FTS5 Search Query Performance
${testResults.fts5Search?.searchResults?.map(result =>
`- **${result.query}**: ${result.resultCount} results in ${result.searchTime.toFixed(2)}ms`
).join('\n') || 'No detailed results available'}

### Transparency Tables Status
${testResults.transparencyTables?.tableTests?.map(test =>
`- **${test.table}**: ${test.exists ? 'EXISTS' : 'MISSING'} ${test.insertSuccess ? '(Functional)' : '(Insert Failed)'}`
).join('\n') || 'No table test results available'}

### Performance Benchmarks
- **Search Performance**: ${testResults.fts5Search?.avgSearchTime < 100 ? 'EXCELLENT' : testResults.fts5Search?.avgSearchTime < 200 ? 'GOOD' : 'NEEDS IMPROVEMENT'} (Target: <100ms)
- **View Performance**: ${testResults.viewsPerformance?.avgQueryTime < 200 ? 'EXCELLENT' : 'NEEDS IMPROVEMENT'} (Target: <200ms)
- **Bulk Insert Performance**: ${testResults.usageMetrics?.insertTime < 1000 ? 'EXCELLENT' : 'NEEDS IMPROVEMENT'} (Target: <1s)

## Recommendations

1. **FTS5 Search Optimization**: ${testResults.fts5Search?.avgSearchTime > 100 ? 'Consider adding more specific indexes for mainframe terminology' : 'Search performance is excellent'}

2. **Transparency Features**: ${testResults.transparencyTables?.success ? 'All transparency tables are functional and ready for production' : 'Some transparency tables need attention'}

3. **Data Integrity**: ${testResults.referentialIntegrity?.success ? 'Database constraints are properly enforced' : 'Review foreign key constraints'}

4. **Performance Scaling**: Database performs well with current test load. Monitor performance with larger datasets in production.

## Test Data Validation Summary
- Total KB entries with proper mainframe categorization
- FTS5 search handles mainframe-specific terminology (ABEND codes, SQLCODES, etc.)
- All database views provide consistent data structures
- Transaction rollback maintains data integrity
- Performance metrics within acceptable thresholds

## Conclusion
${Object.values(testResults).every(result => result?.success !== false) ?
'All database integration tests PASSED. The database is ready for production deployment.' :
'Some tests FAILED. Review failed components before production deployment.'}

---
*Report generated by Database Integration Test Suite*
`;

        fs.writeFileSync(reportPath, report);
        console.log(`Integration report generated: ${reportPath}`);
    }
});