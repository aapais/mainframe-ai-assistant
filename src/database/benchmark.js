#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseBenchmark = void 0;
const tslib_1 = require("tslib");
const KnowledgeDB_1 = require("./KnowledgeDB");
const perf_hooks_1 = require("perf_hooks");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
class DatabaseBenchmark {
    dbPath;
    db;
    testDataSize;
    results = [];
    constructor(dbPath = ':memory:', testDataSize = 1000) {
        this.dbPath = dbPath;
        this.testDataSize = testDataSize;
    }
    async initialize() {
        console.log('🚀 Initializing benchmark database...');
        this.db = await (0, KnowledgeDB_1.createKnowledgeDB)(this.dbPath, {
            autoBackup: false
        });
        console.log('✅ Database initialized');
    }
    async runAllBenchmarks() {
        console.log(`🏃 Running comprehensive performance benchmarks...`);
        console.log(`📊 Test data size: ${this.testDataSize} entries`);
        console.log('='.repeat(60));
        try {
            await this.runInsertBenchmarks();
            await this.runSearchBenchmarks();
            await this.runUpdateBenchmarks();
            await this.runConcurrencyBenchmarks();
            await this.runScalabilityBenchmarks();
            this.generateReport();
        }
        catch (error) {
            console.error('❌ Benchmark failed:', error);
        }
        finally {
            this.db.close();
        }
    }
    async runInsertBenchmarks() {
        const suite = {
            name: 'Insert Operations',
            description: 'Tests data insertion performance',
            results: [],
            totalDuration: 0,
            summary: { passed: 0, failed: 0, avgOpsPerSecond: 0 }
        };
        console.log('\n📝 Running Insert Benchmarks...');
        suite.results.push(await this.benchmarkOperation('Single Insert', async () => {
            await this.db.addEntry({
                title: `Test Entry ${Math.random()}`,
                problem: 'Benchmark test problem description',
                solution: 'Benchmark test solution with multiple steps',
                category: 'Other',
                tags: ['benchmark', 'test', 'performance']
            });
        }, 100));
        suite.results.push(await this.benchmarkOperation('Batch Insert (100 entries)', async () => {
            const entries = Array.from({ length: 100 }, (_, i) => ({
                title: `Batch Entry ${i}`,
                problem: `Batch problem ${i} with detailed description`,
                solution: `Batch solution ${i} with step-by-step instructions`,
                category: ['JCL', 'VSAM', 'DB2', 'Batch', 'CICS'][i % 5],
                tags: [`tag${i}`, 'batch', 'test']
            }));
            for (const entry of entries) {
                await this.db.addEntry(entry);
            }
        }, 10));
        suite.results.push(await this.benchmarkOperation('Large Entry Insert (10KB content)', async () => {
            await this.db.addEntry({
                title: 'Large Entry Test',
                problem: 'A'.repeat(5000),
                solution: 'B'.repeat(5000),
                category: 'Other',
                tags: ['large', 'test']
            });
        }, 50));
        this.results.push(suite);
    }
    async runSearchBenchmarks() {
        const suite = {
            name: 'Search Operations',
            description: 'Tests search performance under various conditions',
            results: [],
            totalDuration: 0,
            summary: { passed: 0, failed: 0, avgOpsPerSecond: 0 }
        };
        console.log('\n🔍 Running Search Benchmarks...');
        await this.seedSearchTestData();
        suite.results.push(await this.benchmarkOperation('Full-Text Search', async () => {
            await this.db.search('VSAM status error');
        }, 500));
        suite.results.push(await this.benchmarkOperation('Category Search', async () => {
            await this.db.search('', { category: 'VSAM' });
        }, 500));
        suite.results.push(await this.benchmarkOperation('Tag Search', async () => {
            await this.db.search('', { tags: ['error', 'vsam'] });
        }, 500));
        suite.results.push(await this.benchmarkOperation('Complex Search (query + category + tags)', async () => {
            await this.db.search('database error', {
                category: 'DB2',
                tags: ['error', 'connection'],
                limit: 20
            });
        }, 300));
        suite.results.push(await this.benchmarkOperation('Get Popular Entries', async () => {
            await this.db.getPopular(10);
        }, 1000));
        this.results.push(suite);
    }
    async runUpdateBenchmarks() {
        const suite = {
            name: 'Update Operations',
            description: 'Tests update and modification performance',
            results: [],
            totalDuration: 0,
            summary: { passed: 0, failed: 0, avgOpsPerSecond: 0 }
        };
        console.log('\n✏️ Running Update Benchmarks...');
        const testEntryId = await this.db.addEntry({
            title: 'Update Test Entry',
            problem: 'Test problem for updates',
            solution: 'Test solution for updates',
            category: 'Other',
            tags: ['update', 'test']
        });
        suite.results.push(await this.benchmarkOperation('Update Single Field', async () => {
            await this.db.updateEntry(testEntryId, {
                title: `Updated Title ${Math.random()}`
            });
        }, 500));
        suite.results.push(await this.benchmarkOperation('Update Multiple Fields', async () => {
            await this.db.updateEntry(testEntryId, {
                title: `Multi Updated ${Math.random()}`,
                problem: 'Updated problem description',
                tags: ['updated', 'multi', 'test']
            });
        }, 300));
        suite.results.push(await this.benchmarkOperation('Record Usage (Success)', async () => {
            await this.db.recordUsage(testEntryId, true, 'benchmark');
        }, 1000));
        this.results.push(suite);
    }
    async runConcurrencyBenchmarks() {
        const suite = {
            name: 'Concurrency Tests',
            description: 'Tests performance under concurrent operations',
            results: [],
            totalDuration: 0,
            summary: { passed: 0, failed: 0, avgOpsPerSecond: 0 }
        };
        console.log('\n🔄 Running Concurrency Benchmarks...');
        suite.results.push(await this.benchmarkOperation('Concurrent Searches (10 parallel)', async () => {
            const searches = Array.from({ length: 10 }, (_, i) => this.db.search(`search term ${i}`));
            await Promise.all(searches);
        }, 100));
        suite.results.push(await this.benchmarkOperation('Mixed Operations (search + insert + update)', async () => {
            const operations = [
                this.db.search('mixed test'),
                this.db.addEntry({
                    title: 'Concurrent Test',
                    problem: 'Concurrent problem',
                    solution: 'Concurrent solution',
                    category: 'Other'
                }),
                this.db.getPopular(5)
            ];
            await Promise.all(operations);
        }, 50));
        this.results.push(suite);
    }
    async runScalabilityBenchmarks() {
        const suite = {
            name: 'Scalability Tests',
            description: 'Tests performance scaling with data size',
            results: [],
            totalDuration: 0,
            summary: { passed: 0, failed: 0, avgOpsPerSecond: 0 }
        };
        console.log('\n📈 Running Scalability Benchmarks...');
        const currentEntries = this.db.getEntryCount();
        suite.results.push(await this.benchmarkOperation(`Search with ${currentEntries} entries`, async () => {
            await this.db.search('scalability test');
        }, 100));
        suite.results.push(await this.benchmarkOperation('Get Database Statistics', async () => {
            await this.db.getStats();
        }, 100));
        suite.results.push(await this.benchmarkOperation('Database Optimization', async () => {
            await this.db.optimize();
        }, 5));
        this.results.push(suite);
    }
    async benchmarkOperation(name, operation, iterations = 100) {
        console.log(`  ⏱️ ${name} (${iterations} iterations)...`);
        const times = [];
        let success = true;
        let error;
        try {
            await operation();
            for (let i = 0; i < iterations; i++) {
                const start = perf_hooks_1.performance.now();
                await operation();
                const end = perf_hooks_1.performance.now();
                times.push(end - start);
            }
        }
        catch (err) {
            success = false;
            error = err instanceof Error ? err.message : String(err);
            console.log(`    ❌ Failed: ${error}`);
        }
        if (success && times.length > 0) {
            const totalTime = times.reduce((sum, time) => sum + time, 0);
            const avgTime = totalTime / times.length;
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);
            const opsPerSecond = 1000 / avgTime;
            console.log(`    ✅ Avg: ${avgTime.toFixed(2)}ms, Ops/sec: ${opsPerSecond.toFixed(0)}`);
            return {
                operation: name,
                iterations,
                totalTime,
                avgTime,
                minTime,
                maxTime,
                opsPerSecond,
                success,
                error
            };
        }
        return {
            operation: name,
            iterations: 0,
            totalTime: 0,
            avgTime: 0,
            minTime: 0,
            maxTime: 0,
            opsPerSecond: 0,
            success,
            error
        };
    }
    async seedSearchTestData() {
        console.log('  🌱 Seeding search test data...');
        const testEntries = [
            {
                title: 'VSAM Status 35 Error',
                problem: 'VSAM file cannot be opened, status code 35',
                solution: 'Check if file exists and is cataloged',
                category: 'VSAM',
                tags: ['vsam', 'error', 'status-35']
            },
            {
                title: 'DB2 Connection Timeout',
                problem: 'Database connection times out during query execution',
                solution: 'Increase timeout parameters and check network',
                category: 'DB2',
                tags: ['db2', 'connection', 'timeout', 'error']
            },
            {
                title: 'JCL Dataset Not Found',
                problem: 'Job fails because dataset cannot be located',
                solution: 'Verify dataset name and catalog entries',
                category: 'JCL',
                tags: ['jcl', 'dataset', 'not-found']
            }
        ];
        for (const entry of testEntries) {
            await this.db.addEntry(entry);
        }
    }
    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 BENCHMARK REPORT');
        console.log('='.repeat(60));
        let totalPassed = 0;
        let totalFailed = 0;
        let totalOpsPerSecond = 0;
        let suiteCount = 0;
        for (const suite of this.results) {
            console.log(`\n📋 ${suite.name}: ${suite.description}`);
            console.log('-'.repeat(40));
            suite.summary = { passed: 0, failed: 0, avgOpsPerSecond: 0 };
            for (const result of suite.results) {
                const status = result.success ? '✅' : '❌';
                const opsDisplay = result.success ? `${result.opsPerSecond.toFixed(0)} ops/sec` : 'FAILED';
                console.log(`  ${status} ${result.operation.padEnd(30)} ${opsDisplay.padStart(15)}`);
                if (result.success) {
                    suite.summary.passed++;
                    suite.summary.avgOpsPerSecond += result.opsPerSecond;
                }
                else {
                    suite.summary.failed++;
                    console.log(`      Error: ${result.error}`);
                }
            }
            if (suite.summary.passed > 0) {
                suite.summary.avgOpsPerSecond /= suite.summary.passed;
            }
            totalPassed += suite.summary.passed;
            totalFailed += suite.summary.failed;
            totalOpsPerSecond += suite.summary.avgOpsPerSecond;
            suiteCount++;
            console.log(`  📊 Suite Summary: ${suite.summary.passed} passed, ${suite.summary.failed} failed`);
            if (suite.summary.passed > 0) {
                console.log(`  ⚡ Average Performance: ${suite.summary.avgOpsPerSecond.toFixed(0)} ops/sec`);
            }
        }
        console.log('\n' + '='.repeat(60));
        console.log('🎯 OVERALL SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Total Passed: ${totalPassed}`);
        console.log(`❌ Total Failed: ${totalFailed}`);
        console.log(`⚡ Average Performance: ${(totalOpsPerSecond / suiteCount).toFixed(0)} ops/sec`);
        console.log(`📈 Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
        const avgPerformance = totalOpsPerSecond / suiteCount;
        console.log('\n🎯 PERFORMANCE ASSESSMENT:');
        if (avgPerformance > 1000) {
            console.log('🚀 EXCELLENT - Database performance exceeds expectations');
        }
        else if (avgPerformance > 500) {
            console.log('✅ GOOD - Database performance meets requirements');
        }
        else if (avgPerformance > 100) {
            console.log('⚠️ ACCEPTABLE - Database performance is adequate but could be improved');
        }
        else {
            console.log('❌ POOR - Database performance needs optimization');
        }
        console.log('\n💡 RECOMMENDATIONS:');
        const searchSuite = this.results.find(s => s.name === 'Search Operations');
        if (searchSuite && searchSuite.summary.avgOpsPerSecond < 500) {
            console.log('  • Consider adding more indexes for search optimization');
        }
        const insertSuite = this.results.find(s => s.name === 'Insert Operations');
        if (insertSuite && insertSuite.summary.avgOpsPerSecond < 200) {
            console.log('  • Consider batch insert optimizations');
        }
        if (totalFailed > 0) {
            console.log('  • Review failed operations and address underlying issues');
        }
        this.saveDetailedReport();
    }
    saveDetailedReport() {
        const reportPath = path_1.default.join(process.cwd(), 'benchmark-report.json');
        const report = {
            timestamp: new Date().toISOString(),
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                dbPath: this.dbPath,
                testDataSize: this.testDataSize
            },
            suites: this.results
        };
        fs_1.default.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Detailed report saved: ${reportPath}`);
    }
}
exports.DatabaseBenchmark = DatabaseBenchmark;
async function main() {
    const args = process.argv.slice(2);
    const dbPath = args[0] || ':memory:';
    const testDataSize = parseInt(args[1]) || 1000;
    console.log('🧪 SQLite Knowledge Base Performance Benchmark');
    console.log(`📁 Database: ${dbPath}`);
    console.log(`📊 Test Data Size: ${testDataSize}`);
    const benchmark = new DatabaseBenchmark(dbPath, testDataSize);
    try {
        await benchmark.initialize();
        await benchmark.runAllBenchmarks();
    }
    catch (error) {
        console.error('❌ Benchmark execution failed:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=benchmark.js.map