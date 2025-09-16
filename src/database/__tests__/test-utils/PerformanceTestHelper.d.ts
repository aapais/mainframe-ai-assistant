import { EventEmitter } from 'events';
export interface PerformanceMetrics {
    executionTime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage | null;
    operationsPerSecond?: number;
    throughput?: number;
}
export interface BenchmarkResult {
    name: string;
    metrics: PerformanceMetrics;
    iterations: number;
    success: boolean;
    error?: string;
    timestamp: Date;
}
export interface LoadTestConfig {
    concurrentUsers: number;
    duration: number;
    rampUpTime: number;
    operations: (() => Promise<void>)[];
}
export declare class PerformanceTestHelper extends EventEmitter {
    private benchmarkResults;
    measureOperation<T>(name: string, operation: () => Promise<T> | T, iterations?: number): Promise<BenchmarkResult>;
    runLoadTest(config: LoadTestConfig): Promise<BenchmarkResult[]>;
    private runWorker;
    benchmarkQueryScaling(setupData: (size: number) => Promise<void>, query: () => Promise<any>, sizes?: number[]): Promise<BenchmarkResult[]>;
    testMemoryUsage(operation: () => Promise<void>, duration?: number, interval?: number): Promise<PerformanceMetrics[]>;
    compareImplementations(implementations: {
        name: string;
        fn: () => Promise<any>;
    }[], iterations?: number): Promise<{
        [key: string]: BenchmarkResult;
    }>;
    analyzeRegression(baseline: BenchmarkResult[], current: BenchmarkResult[], threshold?: number): Array<{
        test: string;
        degradation: number;
        isRegression: boolean;
    }>;
    generateReport(): string;
    clearResults(): void;
    getResults(): BenchmarkResult[];
    private sleep;
}
//# sourceMappingURL=PerformanceTestHelper.d.ts.map