export interface PerformanceMetric {
    operation: string;
    startTime: number;
    endTime: number;
    duration: number;
    metadata?: Record<string, any>;
}
export interface PerformanceBenchmark {
    name: string;
    threshold: number;
    samples: number[];
    average: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
    passed: boolean;
}
export interface PerformanceReport {
    totalOperations: number;
    totalTime: number;
    averageTime: number;
    benchmarks: PerformanceBenchmark[];
    summary: {
        passed: number;
        failed: number;
        overall: 'PASS' | 'FAIL';
    };
}
export declare class PerformanceValidator {
    private metrics;
    private benchmarks;
    startMeasurement(operation: string): string;
    endMeasurement(measurementId: string, metadata?: Record<string, any>): PerformanceMetric;
    measureAsync<T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<{
        result: T;
        metric: PerformanceMetric;
    }>;
    measureSync<T>(operation: string, fn: () => T, metadata?: Record<string, any>): {
        result: T;
        metric: PerformanceMetric;
    };
    setBenchmark(operation: string, threshold: number): void;
    validatePerformance(operation: string, duration: number, threshold: number): boolean;
    getOperationStats(operation: string): {
        count: number;
        total: number;
        average: number;
        min: number;
        max: number;
        p95: number;
        p99: number;
    };
    generateReport(): PerformanceReport;
    clear(): void;
    getMetrics(): PerformanceMetric[];
    exportMetrics(): string;
    validateSearchPerformance(searchTime: number, resultCount?: number): {
        passed: boolean;
        message: string;
        metrics: {
            searchTime: number;
            resultCount: number;
            timePerResult: number;
            thresholdMet: boolean;
        };
    };
    monitorPerformance<T>(operation: string, fn: () => Promise<T>, options?: {
        maxDuration?: number;
        sampleInterval?: number;
        onSample?: (metric: PerformanceMetric) => void;
    }): Promise<T>;
    stressTest(operation: string, fn: () => Promise<any>, options: {
        iterations: number;
        concurrency: number;
        threshold: number;
        warmupIterations?: number;
    }): Promise<{
        success: boolean;
        results: {
            totalIterations: number;
            completedIterations: number;
            failedIterations: number;
            averageTime: number;
            minTime: number;
            maxTime: number;
            p95: number;
            p99: number;
            throughput: number;
        };
        errors: string[];
    }>;
    private calculatePercentile;
}
//# sourceMappingURL=PerformanceValidator.d.ts.map