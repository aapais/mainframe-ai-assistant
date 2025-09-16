import AdvancedSearchEngine from './AdvancedSearchEngine';
export interface BenchmarkConfig {
    testDataSize: number;
    queryVariations: number;
    concurrentUsers: number;
    testDuration: number;
    warmupQueries: number;
    memoryConstraint: number;
    targetResponseTime: number;
}
export interface BenchmarkResult {
    summary: BenchmarkSummary;
    detailed: DetailedMetrics;
    performance: PerformanceProfile;
    recommendations: OptimizationRecommendation[];
    compliance: ComplianceReport;
}
export interface BenchmarkSummary {
    totalQueries: number;
    averageResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    errorRate: number;
    throughput: number;
    cacheHitRate: number;
    memoryUsage: number;
    passed: boolean;
}
export interface DetailedMetrics {
    responseTimeDistribution: {
        [key: string]: number;
    };
    queryTypePerformance: {
        [key: string]: number;
    };
    concurrencyPerformance: {
        [key: string]: number;
    };
    indexPerformance: IndexMetrics;
    cachePerformance: CacheMetrics;
    rankingPerformance: RankingMetrics;
}
export interface IndexMetrics {
    buildTime: number;
    indexSize: number;
    lookupTime: number;
    updateTime: number;
    memoryFootprint: number;
}
export interface CacheMetrics {
    hitRate: number;
    missRate: number;
    evictionRate: number;
    averageAge: number;
    memoryUsage: number;
}
export interface RankingMetrics {
    averageRankingTime: number;
    algorithmsCompared: {
        [key: string]: number;
    };
    relevanceScores: number[];
    complexityHandling: {
        [key: string]: number;
    };
}
export interface PerformanceProfile {
    cpuUsage: number[];
    memoryUsage: number[];
    diskIO: number[];
    networkLatency: number[];
    timestamps: number[];
}
export interface OptimizationRecommendation {
    category: 'index' | 'cache' | 'ranking' | 'query' | 'memory';
    severity: 'low' | 'medium' | 'high' | 'critical';
    issue: string;
    recommendation: string;
    expectedImprovement: string;
    implementationComplexity: 'simple' | 'moderate' | 'complex';
}
export interface ComplianceReport {
    responseTimeCompliance: boolean;
    memoryCompliance: boolean;
    throughputCompliance: boolean;
    accuracyCompliance: boolean;
    failedRequirements: string[];
    passedRequirements: string[];
}
export declare class SearchBenchmark {
    private engine;
    private testData;
    private queries;
    constructor(engine: AdvancedSearchEngine);
    runBenchmark(config?: Partial<BenchmarkConfig>): Promise<BenchmarkResult>;
    quickValidation(): Promise<{
        passed: boolean;
        metrics: BenchmarkSummary;
    }>;
    stressTest(maxConcurrency?: number): Promise<{
        maxSupportedConcurrency: number;
        degradationPoint: number;
        breakdown: BenchmarkSummary[];
    }>;
    private prepareTestEnvironment;
    private generateTestData;
    private generateTestQueries;
    private runWarmupPhase;
    private runPerformancePhase;
    private runLoadTestPhase;
    private simulateUser;
    private runStressTestPhase;
    private simulateStressUser;
    private calculateSummaryMetrics;
    private analyzeResults;
    private analyzeDistribution;
    private generateRecommendations;
    private generateReport;
}
export default SearchBenchmark;
//# sourceMappingURL=SearchBenchmark.d.ts.map