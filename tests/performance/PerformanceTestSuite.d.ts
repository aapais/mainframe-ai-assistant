import Database from 'better-sqlite3';
interface LoadTestConfig {
    duration: number;
    concurrency: number;
    rampUpTime: number;
    queries: string[];
    targetThroughput?: number;
}
interface StressTestConfig {
    maxConcurrency: number;
    stepSize: number;
    stepDuration: number;
    memoryThreshold: number;
    responseTimeThreshold: number;
}
interface PerformanceMetrics {
    throughput: number;
    responseTime: {
        mean: number;
        p50: number;
        p95: number;
        p99: number;
        min: number;
        max: number;
    };
    memoryUsage: {
        initial: number;
        peak: number;
        final: number;
    };
    errorRate: number;
    slaCompliance: number;
    cpuUsage: {
        mean: number;
        peak: number;
    };
}
interface TestResult {
    testName: string;
    config: any;
    metrics: PerformanceMetrics;
    passed: boolean;
    failures: string[];
    duration: number;
    timestamp: Date;
}
export declare class PerformanceTestSuite {
    private db;
    private searchService;
    private optimizer;
    private testResults;
    private readonly SLA_THRESHOLDS;
    constructor(database: Database.Database);
    runFullTestSuite(): Promise<{
        results: TestResult[];
        summary: {
            totalTests: number;
            passed: number;
            failed: number;
            slaCompliance: number;
            recommendations: string[];
        };
    }>;
    runBaselineTest(): Promise<TestResult>;
    runLoadTest(config: LoadTestConfig): Promise<TestResult>;
    runStressTest(config: StressTestConfig): Promise<TestResult>;
    runAutocompleteTest(): Promise<TestResult>;
    runMemoryLeakTest(): Promise<TestResult>;
    runDatabaseStressTest(): Promise<TestResult>;
    runCachePerformanceTest(): Promise<TestResult>;
    runBundleSizeTest(): Promise<TestResult>;
    generateRegressionReport(baselineResults: TestResult[]): {
        regressions: Array<{
            testName: string;
            metric: string;
            baseline: number;
            current: number;
            change: number;
        }>;
        improvements: Array<{
            testName: string;
            metric: string;
            baseline: number;
            current: number;
            change: number;
        }>;
    };
    private setupTestData;
    private generateTestQueries;
    private getTestEntries;
    private runConcurrentQueries;
    private calculateMetrics;
    private percentile;
    private evaluateBaslinePerformance;
    private evaluateLoadTestPerformance;
    private getPerformanceFailures;
    private getLoadTestFailures;
    private getDatabaseStressFailures;
    private aggregateStressTestMetrics;
    private generateTestSummary;
}
export {};
//# sourceMappingURL=PerformanceTestSuite.d.ts.map