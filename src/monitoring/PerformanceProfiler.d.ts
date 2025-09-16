import Database from 'better-sqlite3';
import { SearchLogger } from './SearchLogger';
export interface ProfileSession {
    id: string;
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    queries: QueryProfile[];
    memorySnapshots: MemorySnapshot[];
    cpuProfile: CPUProfile;
    bottlenecks: Bottleneck[];
    recommendations: string[];
    metrics: SessionMetrics;
}
export interface QueryProfile {
    id: string;
    query: string;
    normalizedQuery: string;
    strategy: string;
    totalTime: number;
    parseTime: number;
    executionTime: number;
    resultProcessingTime: number;
    explainPlan?: string;
    indexesUsed: string[];
    rowsExamined: number;
    rowsReturned: number;
    memoryUsed: number;
    cpuTime: number;
    optimizationLevel: 'optimal' | 'good' | 'poor' | 'critical';
    suggestions: string[];
}
export interface MemorySnapshot {
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    cacheMemory: {
        hot: number;
        warm: number;
        cold: number;
        total: number;
    };
    gcEvents: number;
    memoryPressure: 'low' | 'medium' | 'high';
}
export interface CPUProfile {
    totalTime: number;
    userTime: number;
    systemTime: number;
    hotFunctions: Array<{
        name: string;
        inclusiveTime: number;
        exclusiveTime: number;
        callCount: number;
        averageTime: number;
    }>;
    utilizationPattern: Array<{
        timestamp: number;
        usage: number;
    }>;
}
export interface Bottleneck {
    type: 'query' | 'memory' | 'cpu' | 'io' | 'cache';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    impact: string;
    recommendations: string[];
    evidence: {
        metric: string;
        value: number;
        threshold: number;
    };
}
export interface SessionMetrics {
    totalQueries: number;
    averageQueryTime: number;
    slowestQuery: number;
    fastestQuery: number;
    memoryEfficiency: number;
    cpuEfficiency: number;
    cacheEfficiency: number;
    performanceScore: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
}
export interface ProfilingConfig {
    enableQueryProfiling: boolean;
    enableMemoryProfiling: boolean;
    enableCPUProfiling: boolean;
    sampleInterval: number;
    maxSessions: number;
    autoAnalysis: boolean;
}
export declare class PerformanceProfiler {
    private db;
    private logger;
    private config;
    private activeSessions;
    private performanceObserver?;
    private memoryMonitor?;
    private cpuBaseline;
    constructor(database: Database.Database, logger: SearchLogger, config?: Partial<ProfilingConfig>);
    startSession(name: string): string;
    endSession(sessionId: string): ProfileSession | null;
    profileQuery(sessionId: string, query: string, strategy: string, executionFn: () => Promise<any>): Promise<{
        result: any;
        profile: QueryProfile;
    }>;
    takeMemorySnapshot(sessionId: string): MemorySnapshot | null;
    getSessionAnalysis(sessionId: string): ProfileSession | null;
    getRecommendations(sessionId: string): string[];
    generateReport(sessionId: string): any;
    private analyzeSession;
    private analyzeQueryPlan;
    private analyzeQueryPerformance;
    private identifyBottlenecks;
    private calculateMemoryEfficiency;
    private calculateCPUEfficiency;
    private calculateCacheEfficiency;
    private calculatePerformanceScore;
    private calculateGrade;
    private generateSessionRecommendations;
    private groupQueriesByStrategy;
    private analyzeQueryOptimization;
    private analyzeMemoryPressure;
    private normalizeQuery;
    private getCacheMemoryUsage;
    private getGCEventCount;
    private calculateMemoryPressure;
    private generateSessionId;
    private generateQueryId;
    private cleanupOldSessions;
    private setupPerformanceObserver;
    private startMemoryMonitoring;
    private initializeCPUBaseline;
    private storeSession;
    private loadSession;
    private initializeProfilingTables;
}
//# sourceMappingURL=PerformanceProfiler.d.ts.map