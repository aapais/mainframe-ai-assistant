import Database from 'better-sqlite3';
export interface LogLevel {
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    priority: number;
}
export interface SearchLogEntry {
    timestamp: Date;
    level: LogLevel['level'];
    operation: string;
    query: string;
    normalizedQuery: string;
    userId?: string;
    sessionId?: string;
    duration: number;
    strategy: string;
    indexesUsed: string[];
    cacheHit: boolean;
    resultCount: number;
    relevanceScores?: number[];
    metadata: Record<string, any>;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
    traceId?: string;
    spanId?: string;
    parentSpanId?: string;
}
export interface PerformanceTrace {
    traceId: string;
    operation: string;
    startTime: number;
    spans: Array<{
        spanId: string;
        parentSpanId?: string;
        operation: string;
        startTime: number;
        endTime: number;
        duration: number;
        tags: Record<string, any>;
    }>;
    totalDuration: number;
    status: 'success' | 'error';
}
export interface AuditLogEntry {
    timestamp: Date;
    action: string;
    userId: string;
    resource: string;
    details: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
}
export interface LoggerConfig {
    logLevel: LogLevel['level'];
    outputs: Array<{
        type: 'console' | 'file' | 'database' | 'elasticsearch';
        config: Record<string, any>;
        levels?: LogLevel['level'][];
    }>;
    rotation: {
        enabled: boolean;
        maxFileSize: number;
        maxFiles: number;
    };
    performance: {
        enableTracing: boolean;
        sampleRate: number;
        slowQueryThreshold: number;
    };
    audit: {
        enabled: boolean;
        retentionDays: number;
    };
}
export declare class SearchLogger {
    private db;
    private config;
    private logLevels;
    private activeTraces;
    private logBuffer;
    private flushInterval;
    constructor(database: Database.Database, config?: Partial<LoggerConfig>);
    logSearch(entry: Omit<SearchLogEntry, 'timestamp' | 'level'>): void;
    logError(operation: string, error: Error, context?: {
        query?: string;
        userId?: string;
        metadata?: Record<string, any>;
    }): void;
    startTrace(operation: string, userId?: string): string;
    startSpan(traceId: string, operation: string, parentSpanId?: string): string;
    endSpan(traceId: string, spanId: string, tags?: Record<string, any>): void;
    endTrace(traceId: string, status?: 'success' | 'error'): void;
    logAudit(entry: Omit<AuditLogEntry, 'timestamp'>): void;
    getPerformanceAnalytics(timeframe?: number): {
        totalOperations: number;
        avgResponseTime: number;
        slowOperations: number;
        errorRate: number;
        topOperations: Array<{
            operation: string;
            count: number;
            avgTime: number;
        }>;
        traces: PerformanceTrace[];
    };
    exportLogs(timeframe?: number, format?: 'json' | 'csv'): Promise<string>;
    searchLogs(filters: {
        level?: string;
        operation?: string;
        userId?: string;
        timeframe?: number;
        limit?: number;
    }): SearchLogEntry[];
    private log;
    private logTrace;
    private processLogOutput;
    private outputToConsole;
    private outputToFile;
    private outputToDatabase;
    private outputToElasticsearch;
    private storeTrace;
    private storeAuditEntry;
    private generateTraceId;
    private generateSpanId;
    private parseLogEntry;
    private parseTrace;
    private convertLogsToCSV;
    private createDefaultConfig;
    private ensureLogDirectories;
    private initializeLogTables;
    private startBufferFlush;
    private stopBufferFlush;
}
//# sourceMappingURL=SearchLogger.d.ts.map