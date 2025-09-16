"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationTestRunner = void 0;
const tslib_1 = require("tslib");
const better_sqlite3_1 = tslib_1.__importDefault(require("better-sqlite3"));
const MigrationOrchestrator_1 = require("../migration-utils/MigrationOrchestrator");
const PostgresMigrator_1 = require("../postgres-migration/PostgresMigrator");
const events_1 = require("events");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
class MigrationTestRunner extends events_1.EventEmitter {
    testSuites = new Map();
    testResults = [];
    isRunning = false;
    tempDatabases = [];
    constructor() {
        super();
        this.registerBuiltInTestSuites();
    }
    registerTestSuite(suite) {
        this.testSuites.set(suite.id, suite);
    }
    async runTests(config = {}) {
        if (this.isRunning) {
            throw new Error('Test run already in progress');
        }
        this.isRunning = true;
        this.testResults = [];
        const startTime = Date.now();
        try {
            this.emit('testRunStarted', { config });
            const suitesToRun = this.selectTestSuites(config);
            const scenariosToRun = this.selectScenarios(suitesToRun, config);
            this.emit('testPlanCreated', {
                suites: suitesToRun.length,
                scenarios: scenariosToRun.length
            });
            if (config.parallel && scenariosToRun.length > 1) {
                await this.runScenariosParallel(scenariosToRun, config);
            }
            else {
                await this.runScenariosSequential(scenariosToRun, config);
            }
            if (config.generateReport) {
                await this.generateTestReport(config.reportPath);
            }
        }
        finally {
            await this.cleanup();
            this.isRunning = false;
        }
        const duration = Date.now() - startTime;
        const summary = this.calculateTestSummary(duration);
        this.emit('testRunCompleted', summary);
        return summary;
    }
    async createTestDatabase(scenario, mvpVersion = 1) {
        const dbPath = path_1.default.join(__dirname, `test_${scenario}_${Date.now()}.db`);
        this.tempDatabases.push(dbPath);
        const db = new better_sqlite3_1.default(dbPath);
        await this.applySchemaUpToVersion(db, mvpVersion);
        await this.populateTestData(db, mvpVersion);
        return db;
    }
    async validateDataIntegrity(sourceDb, targetDb, tables) {
        const errors = [];
        const warnings = [];
        let tablesChecked = 0;
        let rowsCompared = 0;
        let discrepancies = 0;
        const tablesToCheck = tables || this.getAllTables(sourceDb);
        for (const table of tablesToCheck) {
            try {
                tablesChecked++;
                const sourceCount = sourceDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
                const targetCount = targetDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
                if (sourceCount.count !== targetCount.count) {
                    errors.push(`Row count mismatch in table ${table}: source=${sourceCount.count}, target=${targetCount.count}`);
                    discrepancies++;
                    continue;
                }
                const sampleSize = Math.min(sourceCount.count, 1000);
                const sourceRows = sourceDb.prepare(`
          SELECT * FROM ${table} 
          ORDER BY RANDOM() 
          LIMIT ?
        `).all(sampleSize);
                rowsCompared += sourceRows.length;
                for (const sourceRow of sourceRows) {
                    const idColumn = this.getIdColumn(table, sourceDb);
                    if (!idColumn) {
                        warnings.push(`No ID column found for table ${table}, skipping row-level validation`);
                        continue;
                    }
                    const targetRow = targetDb.prepare(`
            SELECT * FROM ${table} WHERE ${idColumn} = ?
          `).get(sourceRow[idColumn]);
                    if (!targetRow) {
                        errors.push(`Missing row in target table ${table} with ${idColumn}=${sourceRow[idColumn]}`);
                        discrepancies++;
                        continue;
                    }
                    const differences = this.compareRows(sourceRow, targetRow, ['created_at', 'updated_at']);
                    if (differences.length > 0) {
                        errors.push(`Data mismatch in table ${table}, ${idColumn}=${sourceRow[idColumn]}: ${differences.join(', ')}`);
                        discrepancies++;
                    }
                }
            }
            catch (error) {
                errors.push(`Error validating table ${table}: ${error.message}`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            metrics: {
                tablesChecked,
                rowsCompared,
                discrepancies
            }
        };
    }
    async benchmarkMigration(fromVersion, toVersion, recordCounts = {}) {
        const db = await this.createTestDatabase('benchmark', fromVersion);
        for (const [table, count] of Object.entries(recordCounts)) {
            await this.populateTableWithRecords(db, table, count);
        }
        const initialMemory = process.memoryUsage().heapUsed;
        const initialSize = this.getDatabaseSize(db);
        let peakMemory = initialMemory;
        const memoryMonitor = setInterval(() => {
            peakMemory = Math.max(peakMemory, process.memoryUsage().heapUsed);
        }, 100);
        const startTime = Date.now();
        try {
            const orchestrator = new MigrationOrchestrator_1.MigrationOrchestrator(db);
            const plan = await orchestrator.createMigrationPlan(toVersion);
            await orchestrator.executeMigrationPlan(plan);
        }
        finally {
            clearInterval(memoryMonitor);
        }
        const migrationTime = Date.now() - startTime;
        const totalRecords = Object.values(recordCounts).reduce((sum, count) => sum + count, 0);
        const throughput = totalRecords / (migrationTime / 1000);
        const finalMemory = process.memoryUsage().heapUsed;
        const finalSize = this.getDatabaseSize(db);
        db.close();
        return {
            migrationTime,
            throughput,
            memoryUsage: {
                before: initialMemory,
                peak: peakMemory,
                after: finalMemory
            },
            diskSpace: {
                before: initialSize,
                after: finalSize
            }
        };
    }
    registerBuiltInTestSuites() {
        this.registerTestSuite({
            id: 'mvp1_to_mvp2',
            name: 'MVP1 to MVP2 Migration Tests',
            description: 'Test migration from Knowledge Base to Pattern Detection',
            scenarios: [
                {
                    id: 'mvp1_to_mvp2_basic',
                    name: 'Basic MVP1 to MVP2 Migration',
                    description: 'Test successful migration with existing KB entries',
                    setup: async () => {
                    },
                    execute: async () => {
                        const startTime = Date.now();
                        let db = null;
                        try {
                            db = await this.createTestDatabase('mvp1_to_mvp2_basic', 1);
                            db.exec(`
                INSERT INTO kb_entries (id, title, problem, solution, category) VALUES
                ('test1', 'Test Entry 1', 'Test problem 1', 'Test solution 1', 'VSAM'),
                ('test2', 'Test Entry 2', 'Test problem 2', 'Test solution 2', 'JCL'),
                ('test3', 'Test Entry 3', 'Test problem 3', 'Test solution 3', 'DB2');
              `);
                            const orchestrator = new MigrationOrchestrator_1.MigrationOrchestrator(db);
                            const plan = await orchestrator.createMigrationPlan(2);
                            const results = await orchestrator.executeMigrationPlan(plan);
                            const allSuccessful = results.every(r => r.success);
                            if (!allSuccessful) {
                                throw new Error('Some migrations failed: ' + results.filter(r => !r.success).map(r => r.error).join(', '));
                            }
                            const tables = db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type = 'table' AND name IN ('incidents', 'detected_patterns', 'component_health')
              `).all();
                            if (tables.length !== 3) {
                                throw new Error(`Expected 3 new tables, found ${tables.length}`);
                            }
                            return {
                                scenario: 'mvp1_to_mvp2_basic',
                                success: true,
                                duration: Date.now() - startTime,
                                message: 'Migration completed successfully',
                                metrics: {
                                    migrations_applied: results.length,
                                    total_duration: results.reduce((sum, r) => sum + r.duration, 0)
                                }
                            };
                        }
                        catch (error) {
                            return {
                                scenario: 'mvp1_to_mvp2_basic',
                                success: false,
                                duration: Date.now() - startTime,
                                message: error.message,
                                errors: [error.message]
                            };
                        }
                        finally {
                            if (db) {
                                db.close();
                            }
                        }
                    },
                    cleanup: async () => {
                    },
                    expectedOutcome: 'success',
                    tags: ['mvp2', 'basic', 'upgrade'],
                    timeout: 30000
                },
                {
                    id: 'mvp1_to_mvp2_rollback',
                    name: 'MVP1 to MVP2 Rollback Test',
                    description: 'Test rollback functionality when migration fails',
                    setup: async () => { },
                    execute: async () => {
                        const startTime = Date.now();
                        let db = null;
                        try {
                            db = await this.createTestDatabase('mvp1_to_mvp2_rollback', 1);
                            db.exec(`DROP TABLE IF EXISTS kb_entries`);
                            const orchestrator = new MigrationOrchestrator_1.MigrationOrchestrator(db);
                            try {
                                const plan = await orchestrator.createMigrationPlan(2);
                                await orchestrator.executeMigrationPlan(plan);
                                throw new Error('Migration should have failed but succeeded');
                            }
                            catch (migrationError) {
                                const currentVersion = orchestrator['migrationManager'].getCurrentVersion();
                                if (currentVersion !== 1) {
                                    throw new Error(`Expected version 1 after rollback, got ${currentVersion}`);
                                }
                                return {
                                    scenario: 'mvp1_to_mvp2_rollback',
                                    success: true,
                                    duration: Date.now() - startTime,
                                    message: 'Rollback executed successfully after migration failure',
                                    details: {
                                        migration_error: migrationError.message,
                                        final_version: currentVersion
                                    }
                                };
                            }
                        }
                        catch (error) {
                            return {
                                scenario: 'mvp1_to_mvp2_rollback',
                                success: false,
                                duration: Date.now() - startTime,
                                message: error.message,
                                errors: [error.message]
                            };
                        }
                        finally {
                            if (db) {
                                db.close();
                            }
                        }
                    },
                    cleanup: async () => { },
                    expectedOutcome: 'success',
                    tags: ['mvp2', 'rollback', 'error_handling'],
                    timeout: 30000
                }
            ]
        });
        this.registerTestSuite({
            id: 'performance',
            name: 'Migration Performance Tests',
            description: 'Test migration performance under various loads',
            scenarios: [
                {
                    id: 'large_dataset_migration',
                    name: 'Large Dataset Migration',
                    description: 'Test migration performance with large datasets',
                    setup: async () => { },
                    execute: async () => {
                        const startTime = Date.now();
                        try {
                            const benchmark = await this.benchmarkMigration(1, 2, {
                                kb_entries: 10000,
                                search_history: 50000,
                                usage_metrics: 100000
                            });
                            const maxMigrationTime = 60000;
                            const minThroughput = 1000;
                            const success = benchmark.migrationTime <= maxMigrationTime &&
                                benchmark.throughput >= minThroughput;
                            return {
                                scenario: 'large_dataset_migration',
                                success,
                                duration: Date.now() - startTime,
                                message: success ? 'Performance test passed' : 'Performance test failed',
                                metrics: {
                                    migration_time_ms: benchmark.migrationTime,
                                    throughput_rps: benchmark.throughput,
                                    memory_peak_mb: benchmark.memoryUsage.peak / 1024 / 1024,
                                    disk_growth_mb: (benchmark.diskSpace.after - benchmark.diskSpace.before) / 1024 / 1024
                                }
                            };
                        }
                        catch (error) {
                            return {
                                scenario: 'large_dataset_migration',
                                success: false,
                                duration: Date.now() - startTime,
                                message: error.message,
                                errors: [error.message]
                            };
                        }
                    },
                    cleanup: async () => { },
                    expectedOutcome: 'success',
                    tags: ['performance', 'stress', 'large_data'],
                    timeout: 120000
                }
            ]
        });
        this.registerTestSuite({
            id: 'postgres_migration',
            name: 'PostgreSQL Migration Tests',
            description: 'Test migration from SQLite to PostgreSQL',
            scenarios: [
                {
                    id: 'postgres_migration_dry_run',
                    name: 'PostgreSQL Migration Dry Run',
                    description: 'Test PostgreSQL migration analysis without actual migration',
                    setup: async () => { },
                    execute: async () => {
                        const startTime = Date.now();
                        let db = null;
                        try {
                            db = await this.createTestDatabase('postgres_dry_run', 2);
                            const migrator = new PostgresMigrator_1.PostgresMigrator({
                                sourceDb: db,
                                targetConfig: {
                                    host: 'localhost',
                                    port: 5432,
                                    database: 'test_db',
                                    username: 'test_user',
                                    password: 'test_pass'
                                },
                                options: {
                                    dryRun: true,
                                    validateData: false
                                }
                            });
                            const plan = await migrator.analyzeMigration();
                            const schema = await migrator.generatePostgresSchema();
                            const success = plan.schemaMapping.length > 0 &&
                                schema.length > 0 &&
                                plan.compatibility.fullyCompatible.length > 0;
                            return {
                                scenario: 'postgres_migration_dry_run',
                                success,
                                duration: Date.now() - startTime,
                                message: success ? 'PostgreSQL analysis completed' : 'PostgreSQL analysis failed',
                                metrics: {
                                    tables_analyzed: plan.schemaMapping.length,
                                    fully_compatible: plan.compatibility.fullyCompatible.length,
                                    requires_transformation: plan.compatibility.requiresTransformation.length,
                                    estimated_duration_minutes: plan.estimatedDuration,
                                    estimated_size_mb: plan.estimatedSize
                                }
                            };
                        }
                        catch (error) {
                            return {
                                scenario: 'postgres_migration_dry_run',
                                success: false,
                                duration: Date.now() - startTime,
                                message: error.message,
                                errors: [error.message]
                            };
                        }
                        finally {
                            if (db) {
                                db.close();
                            }
                        }
                    },
                    cleanup: async () => { },
                    expectedOutcome: 'success',
                    tags: ['postgres', 'analysis', 'dry_run'],
                    timeout: 30000
                }
            ]
        });
    }
    selectTestSuites(config) {
        if (config.suites && config.suites.length > 0) {
            return config.suites
                .map(id => this.testSuites.get(id))
                .filter(suite => suite !== undefined);
        }
        return Array.from(this.testSuites.values());
    }
    selectScenarios(suites, config) {
        let scenarios = [];
        for (const suite of suites) {
            scenarios.push(...suite.scenarios);
        }
        if (config.scenarios && config.scenarios.length > 0) {
            scenarios = scenarios.filter(s => config.scenarios.includes(s.id));
        }
        if (config.tags && config.tags.length > 0) {
            scenarios = scenarios.filter(s => config.tags.some(tag => s.tags.includes(tag)));
        }
        return scenarios;
    }
    async runScenariosSequential(scenarios, config) {
        for (const scenario of scenarios) {
            if (config.failFast && this.hasFailures()) {
                this.emit('testSkipped', { scenario: scenario.id, reason: 'fail_fast' });
                continue;
            }
            await this.runScenario(scenario);
        }
    }
    async runScenariosParallel(scenarios, config) {
        const concurrency = config.maxConcurrency || 3;
        const promises = [];
        for (let i = 0; i < scenarios.length; i += concurrency) {
            const batch = scenarios.slice(i, i + concurrency);
            const batchPromises = batch.map(scenario => this.runScenario(scenario));
            promises.push(...batchPromises);
            await Promise.all(batchPromises);
            if (config.failFast && this.hasFailures()) {
                break;
            }
        }
    }
    async runScenario(scenario) {
        this.emit('testStarted', { scenario: scenario.id });
        try {
            await scenario.setup();
            const timeoutPromise = scenario.timeout
                ? new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Test timeout')), scenario.timeout);
                })
                : null;
            const testPromise = scenario.execute();
            const result = timeoutPromise
                ? await Promise.race([testPromise, timeoutPromise])
                : await testPromise;
            this.testResults.push(result);
            this.emit('testCompleted', result);
            await scenario.cleanup();
        }
        catch (error) {
            const result = {
                scenario: scenario.id,
                success: false,
                duration: 0,
                message: error.message,
                errors: [error.message]
            };
            this.testResults.push(result);
            this.emit('testFailed', result);
        }
    }
    hasFailures() {
        return this.testResults.some(r => !r.success);
    }
    calculateTestSummary(duration) {
        const passed = this.testResults.filter(r => r.success).length;
        const failed = this.testResults.filter(r => !r.success).length;
        return {
            totalTests: this.testResults.length,
            passed,
            failed,
            skipped: 0,
            duration,
            results: this.testResults
        };
    }
    async generateTestReport(reportPath) {
        const report = {
            generated: new Date().toISOString(),
            summary: this.calculateTestSummary(0),
            results: this.testResults
        };
        const outputPath = reportPath || path_1.default.join(__dirname, 'test-report.json');
        fs_1.default.writeFileSync(outputPath, JSON.stringify(report, null, 2));
        this.emit('reportGenerated', { path: outputPath });
    }
    async cleanup() {
        for (const dbPath of this.tempDatabases) {
            try {
                if (fs_1.default.existsSync(dbPath)) {
                    fs_1.default.unlinkSync(dbPath);
                }
            }
            catch (error) {
                console.warn(`Failed to cleanup temp database: ${dbPath}`);
            }
        }
        this.tempDatabases = [];
    }
    async applySchemaUpToVersion(db, version) {
        const schemaPath = path_1.default.join(__dirname, '../schema.sql');
        if (fs_1.default.existsSync(schemaPath)) {
            const schema = fs_1.default.readFileSync(schemaPath, 'utf8');
            db.exec(schema);
        }
        for (let v = 2; v <= version; v++) {
            const migrationPath = path_1.default.join(__dirname, `../migrations/mvp-upgrades/${v.toString().padStart(3, '0')}_*.sql`);
        }
    }
    async populateTestData(db, version) {
        const sampleData = this.generateSampleData(version);
        for (const [table, records] of Object.entries(sampleData)) {
            for (const record of records) {
                const columns = Object.keys(record).join(', ');
                const values = Object.values(record);
                const placeholders = values.map(() => '?').join(', ');
                db.prepare(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`).run(...values);
            }
        }
    }
    generateSampleData(version) {
        const data = {
            kb_entries: [
                {
                    id: 'sample1',
                    title: 'Sample Entry 1',
                    problem: 'Sample problem description',
                    solution: 'Sample solution description',
                    category: 'VSAM',
                    created_by: 'test'
                }
            ]
        };
        if (version >= 2) {
            data.incidents = [
                {
                    id: 'inc1',
                    ticket_id: 'T001',
                    title: 'Sample Incident',
                    description: 'Sample incident description',
                    severity: 'medium',
                    created_at: new Date().toISOString()
                }
            ];
        }
        return data;
    }
    getAllTables(db) {
        const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `).all();
        return tables.map(t => t.name);
    }
    getIdColumn(table, db) {
        const columns = db.prepare(`PRAGMA table_info(${table})`).all();
        const pkColumn = columns.find(col => col.pk === 1);
        if (pkColumn) {
            return pkColumn.name;
        }
        const idColumn = columns.find(col => col.name.toLowerCase() === 'id');
        if (idColumn) {
            return idColumn.name;
        }
        return null;
    }
    compareRows(row1, row2, excludeColumns = []) {
        const differences = [];
        for (const [key, value1] of Object.entries(row1)) {
            if (excludeColumns.includes(key))
                continue;
            const value2 = row2[key];
            if (value1 !== value2) {
                differences.push(`${key}: ${value1} !== ${value2}`);
            }
        }
        return differences;
    }
    getDatabaseSize(db) {
        try {
            const stats = fs_1.default.statSync(db.name);
            return stats.size;
        }
        catch {
            return 0;
        }
    }
    async populateTableWithRecords(db, table, count) {
        console.log(`Populating ${table} with ${count} records`);
    }
}
exports.MigrationTestRunner = MigrationTestRunner;
//# sourceMappingURL=MigrationTestRunner.js.map