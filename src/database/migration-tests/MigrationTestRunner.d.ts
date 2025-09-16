import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
export interface TestScenario {
    id: string;
    name: string;
    description: string;
    setup: () => Promise<void>;
    execute: () => Promise<TestResult>;
    cleanup: () => Promise<void>;
    expectedOutcome: 'success' | 'failure' | 'warning';
    tags: string[];
    timeout?: number;
}
export interface TestResult {
    scenario: string;
    success: boolean;
    duration: number;
    message?: string;
    details?: any;
    metrics?: {
        [key: string]: number;
    };
    errors?: string[];
    warnings?: string[];
}
export interface TestSuite {
    id: string;
    name: string;
    description: string;
    scenarios: TestScenario[];
    setup?: () => Promise<void>;
    teardown?: () => Promise<void>;
}
export interface TestRunConfig {
    suites?: string[];
    scenarios?: string[];
    tags?: string[];
    parallel?: boolean;
    maxConcurrency?: number;
    failFast?: boolean;
    generateReport?: boolean;
    reportPath?: string;
}
export declare class MigrationTestRunner extends EventEmitter {
    private testSuites;
    private testResults;
    private isRunning;
    private tempDatabases;
    constructor();
    registerTestSuite(suite: TestSuite): void;
    runTests(config?: TestRunConfig): Promise<{
        totalTests: number;
        passed: number;
        failed: number;
        skipped: number;
        duration: number;
        results: TestResult[];
    }>;
    createTestDatabase(scenario: string, mvpVersion?: number): Promise<Database.Database>;
    validateDataIntegrity(sourceDb: Database.Database, targetDb: Database.Database, tables?: string[]): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
        metrics: {
            tablesChecked: number;
            rowsCompared: number;
            discrepancies: number;
        };
    }>;
    benchmarkMigration(fromVersion: number, toVersion: number, recordCounts?: {
        [table: string]: number;
    }): Promise<{
        migrationTime: number;
        throughput: number;
        memoryUsage: {
            before: number;
            peak: number;
            after: number;
        };
        diskSpace: {
            before: number;
            after: number;
        };
    }>;
    private registerBuiltInTestSuites;
    private selectTestSuites;
    private selectScenarios;
    private runScenariosSequential;
    private runScenariosParallel;
    private runScenario;
    private hasFailures;
    private calculateTestSummary;
    private generateTestReport;
    private cleanup;
    private applySchemaUpToVersion;
    private populateTestData;
    private generateSampleData;
    private getAllTables;
    private getIdColumn;
    private compareRows;
    private getDatabaseSize;
    private populateTableWithRecords;
}
//# sourceMappingURL=MigrationTestRunner.d.ts.map