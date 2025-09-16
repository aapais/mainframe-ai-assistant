#!/usr/bin/env ts-node

/**
 * Database Performance Benchmark Suite
 * Comprehensive testing for Mainframe KB Assistant database performance
 */

import { KnowledgeDB, createKnowledgeDB } from '../src/database/KnowledgeDB';
import fs from 'fs';
import path from 'path';

interface BenchmarkResult {
    name: string;
    duration: number;
    success: boolean;
    details: any;
    target: number;
    passed: boolean;
}

interface BenchmarkSuite {
    name: string;
    results: BenchmarkResult[];
    totalTime: number;
    passedTests: number;
    failedTests: number;
}

class PerformanceBenchmark {
    private db: KnowledgeDB;
    private results: BenchmarkSuite[] = [];

    constructor(private dbPath: string = ':memory:') {}

    async runAllBenchmarks(): Promise<void> {
        console.log('🧪 Database Performance Benchmark Suite');
        console.log('=======================================');
        console.log('Target Performance Goals:');
        console.log('  - Search operations: <1000ms (95th percentile)');
        console.log('  - Insert operations: <100ms average');
        console.log('  - Cache hit rate: >70%');
        console.log('  - Memory usage: <200MB');
        console.log('');

        try {
            // Initialize database
            await this.initializeDatabase();

            // Run benchmark suites
            await this.runSearchBenchmarks();
            await this.runInsertBenchmarks();
            await this.runConcurrencyBenchmarks();
            await this.runCacheBenchmarks();
            await this.runScalabilityBenchmarks();

            // Generate final report
            this.generateReport();

        } finally {
            if (this.db) {
                await this.db.close();
            }
        }
    }

    private async initializeDatabase(): Promise<void> {
        console.log('🔧 Initializing test database...');
        
        this.db = await createKnowledgeDB(this.dbPath);
        
        // Wait for initialization and seeding
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const stats = await this.db.getStats();
        console.log(`✅ Database ready with ${stats.totalEntries} entries\n`);
    }

    private async runSearchBenchmarks(): Promise<void> {
        console.log('🔍 Running Search Performance Benchmarks...');
        
        const suite: BenchmarkSuite = {
            name: 'Search Performance',
            results: [],
            totalTime: 0,
            passedTests: 0,
            failedTests: 0
        };

        const searchTests = [
            { query: 'VSAM status 35', target: 1000, description: 'Basic text search' },
            { query: 'S0C7 error', target: 1000, description: 'Error code search' },
            { query: 'category:VSAM', target: 800, description: 'Category filter' },
            { query: 'tag:error', target: 800, description: 'Tag filter' },
            { query: 'DB2 SQLCODE -904 resource unavailable', target: 1200, description: 'Complex query' },
            { query: 'nonexistent query terms', target: 500, description: 'No results query' },
            { query: '', target: 300, description: 'Empty query' },
            { query: 'a', target: 500, description: 'Single character' },
            { query: 'database connection timeout error system', target: 1500, description: 'Multi-term query' }
        ];

        for (const test of searchTests) {
            const result = await this.benchmarkSearch(test.query, test.target, test.description);
            suite.results.push(result);
            suite.totalTime += result.duration;
            
            if (result.passed) {
                suite.passedTests++;
                console.log(`  ✅ ${result.name}: ${result.duration}ms`);
            } else {
                suite.failedTests++;
                console.log(`  ❌ ${result.name}: ${result.duration}ms (target: ${result.target}ms)`);
            }
        }

        // Run repeated search test (cache performance)
        console.log('  🔄 Testing cache performance...');
        const cacheTest = await this.benchmarkCachedSearch();
        suite.results.push(cacheTest);
        
        if (cacheTest.passed) {
            suite.passedTests++;
            console.log(`  ✅ ${cacheTest.name}: ${cacheTest.details.improvement}% improvement`);
        } else {
            suite.failedTests++;
            console.log(`  ❌ ${cacheTest.name}: Cache not effective`);
        }

        this.results.push(suite);
        console.log(`Search benchmarks: ${suite.passedTests}/${suite.results.length} passed\n`);
    }

    private async benchmarkSearch(query: string, target: number, description: string): Promise<BenchmarkResult> {
        const start = performance.now();
        const results = await this.db.search(query, { limit: 20 });
        const duration = performance.now() - start;

        return {
            name: `${description} ("${query}")`,
            duration: Math.round(duration),
            success: true,
            details: { resultCount: results.length, query },
            target,
            passed: duration <= target
        };
    }

    private async benchmarkCachedSearch(): Promise<BenchmarkResult> {
        const query = 'VSAM status error';
        
        // First search (cold)
        const coldStart = performance.now();
        await this.db.search(query);
        const coldDuration = performance.now() - coldStart;

        // Second search (should be cached)
        const warmStart = performance.now();
        await this.db.search(query);
        const warmDuration = performance.now() - warmStart;

        const improvement = ((coldDuration - warmDuration) / coldDuration) * 100;

        return {
            name: 'Cache effectiveness',
            duration: Math.round(warmDuration),
            success: true,
            details: { 
                coldTime: Math.round(coldDuration), 
                warmTime: Math.round(warmDuration),
                improvement: Math.round(improvement)
            },
            target: 50, // 50% improvement expected
            passed: improvement >= 30 // 30% minimum improvement
        };
    }

    private async runInsertBenchmarks(): Promise<void> {
        console.log('📝 Running Insert Performance Benchmarks...');
        
        const suite: BenchmarkSuite = {
            name: 'Insert Performance',
            results: [],
            totalTime: 0,
            passedTests: 0,
            failedTests: 0
        };

        // Single insert test
        const singleInsert = await this.benchmarkSingleInsert();
        suite.results.push(singleInsert);
        
        // Batch insert test
        const batchInsert = await this.benchmarkBatchInsert();
        suite.results.push(batchInsert);

        // Update test
        const updateTest = await this.benchmarkUpdate();
        suite.results.push(updateTest);

        suite.results.forEach(result => {
            suite.totalTime += result.duration;
            if (result.passed) {
                suite.passedTests++;
                console.log(`  ✅ ${result.name}: ${result.duration}ms`);
            } else {
                suite.failedTests++;
                console.log(`  ❌ ${result.name}: ${result.duration}ms (target: ${result.target}ms)`);
            }
        });

        this.results.push(suite);
        console.log(`Insert benchmarks: ${suite.passedTests}/${suite.results.length} passed\n`);
    }

    private async benchmarkSingleInsert(): Promise<BenchmarkResult> {
        const start = performance.now();
        
        await this.db.addEntry({
            title: 'Performance Test Entry',
            problem: 'This is a test problem for performance benchmarking',
            solution: 'This is a test solution with multiple steps and detailed information',
            category: 'Other',
            tags: ['performance', 'test', 'benchmark']
        });
        
        const duration = performance.now() - start;

        return {
            name: 'Single insert',
            duration: Math.round(duration),
            success: true,
            details: {},
            target: 100,
            passed: duration <= 100
        };
    }

    private async benchmarkBatchInsert(): Promise<BenchmarkResult> {
        const batchSize = 50;
        const start = performance.now();
        
        for (let i = 0; i < batchSize; i++) {
            await this.db.addEntry({
                title: `Batch Test Entry ${i}`,
                problem: `Batch test problem ${i} with various details and information`,
                solution: `Batch test solution ${i} with step-by-step instructions`,
                category: 'Other',
                tags: ['batch', 'test', `item-${i}`]
            });
        }
        
        const duration = performance.now() - start;
        const avgDuration = duration / batchSize;

        return {
            name: `Batch insert (${batchSize} entries)`,
            duration: Math.round(duration),
            success: true,
            details: { 
                batchSize, 
                avgPerEntry: Math.round(avgDuration),
                entriesPerSecond: Math.round(1000 / avgDuration)
            },
            target: 5000, // 5 seconds for 50 entries
            passed: duration <= 5000
        };
    }

    private async benchmarkUpdate(): Promise<BenchmarkResult> {
        // First, get an existing entry
        const results = await this.db.search('test', { limit: 1 });
        if (results.length === 0) {
            return {
                name: 'Update entry',
                duration: 0,
                success: false,
                details: { error: 'No entries to update' },
                target: 50,
                passed: false
            };
        }

        const start = performance.now();
        
        await this.db.updateEntry(results[0].entry.id, {
            title: 'Updated Test Entry',
            tags: ['updated', 'performance', 'test']
        });
        
        const duration = performance.now() - start;

        return {
            name: 'Update entry',
            duration: Math.round(duration),
            success: true,
            details: { entryId: results[0].entry.id },
            target: 50,
            passed: duration <= 50
        };
    }

    private async runConcurrencyBenchmarks(): Promise<void> {
        console.log('🔄 Running Concurrency Benchmarks...');
        
        const suite: BenchmarkSuite = {
            name: 'Concurrency Performance',
            results: [],
            totalTime: 0,
            passedTests: 0,
            failedTests: 0
        };

        // Concurrent search test
        const concurrentSearches = await this.benchmarkConcurrentSearches();
        suite.results.push(concurrentSearches);

        // Mixed operations test
        const mixedOperations = await this.benchmarkMixedOperations();
        suite.results.push(mixedOperations);

        suite.results.forEach(result => {
            suite.totalTime += result.duration;
            if (result.passed) {
                suite.passedTests++;
                console.log(`  ✅ ${result.name}: ${result.duration}ms`);
            } else {
                suite.failedTests++;
                console.log(`  ❌ ${result.name}: ${result.duration}ms (target: ${result.target}ms)`);
            }
        });

        this.results.push(suite);
        console.log(`Concurrency benchmarks: ${suite.passedTests}/${suite.results.length} passed\n`);
    }

    private async benchmarkConcurrentSearches(): Promise<BenchmarkResult> {
        const concurrency = 10;
        const queries = [
            'VSAM error',
            'S0C7 abend',
            'DB2 SQLCODE',
            'JCL dataset',
            'CICS ASRA'
        ];

        const start = performance.now();
        
        const promises = [];
        for (let i = 0; i < concurrency; i++) {
            const query = queries[i % queries.length];
            promises.push(this.db.search(query));
        }
        
        await Promise.all(promises);
        const duration = performance.now() - start;

        return {
            name: `${concurrency} concurrent searches`,
            duration: Math.round(duration),
            success: true,
            details: { 
                concurrency,
                avgPerSearch: Math.round(duration / concurrency)
            },
            target: 2000,
            passed: duration <= 2000
        };
    }

    private async benchmarkMixedOperations(): Promise<BenchmarkResult> {
        const start = performance.now();
        
        const promises = [
            // Searches
            this.db.search('error'),
            this.db.search('category:VSAM'),
            this.db.search('performance'),
            
            // Inserts
            this.db.addEntry({
                title: 'Concurrent Test 1',
                problem: 'Problem 1',
                solution: 'Solution 1',
                category: 'Other'
            }),
            this.db.addEntry({
                title: 'Concurrent Test 2',
                problem: 'Problem 2',
                solution: 'Solution 2',
                category: 'Other'
            }),
            
            // Stats
            this.db.getStats(),
            this.db.getPopular(5)
        ];
        
        await Promise.all(promises);
        const duration = performance.now() - start;

        return {
            name: 'Mixed operations (7 concurrent)',
            duration: Math.round(duration),
            success: true,
            details: { operationCount: promises.length },
            target: 3000,
            passed: duration <= 3000
        };
    }

    private async runCacheBenchmarks(): Promise<void> {
        console.log('💾 Running Cache Performance Benchmarks...');
        
        const suite: BenchmarkSuite = {
            name: 'Cache Performance',
            results: [],
            totalTime: 0,
            passedTests: 0,
            failedTests: 0
        };

        // Cache statistics
        const cacheStats = this.db.getCacheStats();
        
        const cacheTest: BenchmarkResult = {
            name: 'Cache hit rate',
            duration: 0,
            success: true,
            details: cacheStats,
            target: 70,
            passed: cacheStats.hitRate >= 70
        };

        suite.results.push(cacheTest);
        
        if (cacheTest.passed) {
            suite.passedTests++;
            console.log(`  ✅ Cache hit rate: ${cacheStats.hitRate.toFixed(1)}%`);
        } else {
            suite.failedTests++;
            console.log(`  ❌ Cache hit rate: ${cacheStats.hitRate.toFixed(1)}% (target: ≥70%)`);
        }

        this.results.push(suite);
        console.log(`Cache benchmarks: ${suite.passedTests}/${suite.results.length} passed\n`);
    }

    private async runScalabilityBenchmarks(): Promise<void> {
        console.log('📈 Running Scalability Benchmarks...');
        
        const suite: BenchmarkSuite = {
            name: 'Scalability Performance',
            results: [],
            totalTime: 0,
            passedTests: 0,
            failedTests: 0
        };

        // Memory usage
        const memoryUsage = process.memoryUsage();
        const memoryTest: BenchmarkResult = {
            name: 'Memory usage',
            duration: 0,
            success: true,
            details: {
                rss: Math.round(memoryUsage.rss / 1024 / 1024),
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024)
            },
            target: 200,
            passed: (memoryUsage.rss / 1024 / 1024) <= 200
        };

        suite.results.push(memoryTest);

        // Database size
        let dbSize = 0;
        if (this.dbPath !== ':memory:' && fs.existsSync(this.dbPath)) {
            dbSize = fs.statSync(this.dbPath).size / 1024 / 1024;
        }

        const sizeTest: BenchmarkResult = {
            name: 'Database size',
            duration: 0,
            success: true,
            details: { sizeMB: Math.round(dbSize * 100) / 100 },
            target: 100,
            passed: dbSize <= 100
        };

        suite.results.push(sizeTest);

        suite.results.forEach(result => {
            if (result.passed) {
                suite.passedTests++;
                if (result.name === 'Memory usage') {
                    console.log(`  ✅ Memory usage: ${result.details.rss}MB RSS`);
                } else {
                    console.log(`  ✅ Database size: ${result.details.sizeMB}MB`);
                }
            } else {
                suite.failedTests++;
                console.log(`  ❌ ${result.name} exceeded target`);
            }
        });

        this.results.push(suite);
        console.log(`Scalability benchmarks: ${suite.passedTests}/${suite.results.length} passed\n`);
    }

    private generateReport(): void {
        console.log('📊 Performance Benchmark Report');
        console.log('==============================');

        let totalPassed = 0;
        let totalTests = 0;

        for (const suite of this.results) {
            console.log(`\n${suite.name}:`);
            console.log(`  Tests: ${suite.passedTests}/${suite.results.length} passed`);
            if (suite.totalTime > 0) {
                console.log(`  Total time: ${suite.totalTime.toFixed(0)}ms`);
            }
            
            totalPassed += suite.passedTests;
            totalTests += suite.results.length;

            // Show failed tests details
            const failedTests = suite.results.filter(r => !r.passed);
            if (failedTests.length > 0) {
                console.log('  Failed tests:');
                failedTests.forEach(test => {
                    console.log(`    - ${test.name}: ${test.duration}ms (target: ${test.target}ms)`);
                });
            }
        }

        const overallScore = (totalPassed / totalTests) * 100;
        
        console.log('\n' + '='.repeat(50));
        console.log(`Overall Results: ${totalPassed}/${totalTests} tests passed`);
        console.log(`Performance Score: ${overallScore.toFixed(1)}%`);

        if (overallScore >= 90) {
            console.log('🎉 EXCELLENT - Database is production ready!');
        } else if (overallScore >= 75) {
            console.log('✅ GOOD - Database performance is acceptable');
        } else if (overallScore >= 60) {
            console.log('⚠️  FAIR - Database needs optimization');
        } else {
            console.log('❌ POOR - Database requires significant optimization');
        }

        // Performance recommendations
        console.log('\nRecommendations:');
        
        if (this.db) {
            const recommendations = this.db.getRecommendations();
            if (recommendations.length > 0) {
                recommendations.forEach(rec => console.log(`  - ${rec}`));
            } else {
                console.log('  - No specific recommendations at this time');
            }
        }

        console.log('\nFor detailed performance monitoring, use:');
        console.log('  - db.getPerformanceStatus()');
        console.log('  - db.generatePerformanceReport()');
        console.log('  - db.getSlowQueries()');
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    let dbPath = ':memory:'; // Default to in-memory for pure performance testing
    
    if (args.includes('--disk')) {
        dbPath = './benchmark-test.db';
    }
    
    if (args.includes('--help')) {
        console.log(`
Database Performance Benchmark Suite

Usage: npm run benchmark [options]

Options:
  --disk    Test with disk-based database (default: memory)
  --help    Show this help message

Examples:
  npm run benchmark
  npm run benchmark -- --disk
`);
        process.exit(0);
    }

    const benchmark = new PerformanceBenchmark(dbPath);
    await benchmark.runAllBenchmarks();

    // Clean up disk test file
    if (dbPath !== ':memory:' && fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
    }
}

// Export for use in tests
export { PerformanceBenchmark };

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Benchmark failed:', error);
        process.exit(1);
    });
}