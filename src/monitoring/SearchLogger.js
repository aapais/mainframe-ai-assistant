"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchLogger = void 0;
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const path_1 = require("path");
class SearchLogger {
    db;
    config;
    logLevels;
    activeTraces = new Map();
    logBuffer = [];
    flushInterval;
    constructor(database, config = {}) {
        this.db = database;
        this.config = this.createDefaultConfig(config);
        this.logLevels = new Map([
            ['trace', 0],
            ['debug', 1],
            ['info', 2],
            ['warn', 3],
            ['error', 4],
            ['fatal', 5]
        ]);
        this.initializeLogTables();
        this.ensureLogDirectories();
        this.startBufferFlush();
        console.log('📝 Search logger initialized');
    }
    logSearch(entry) {
        const logEntry = {
            timestamp: new Date(),
            level: 'info',
            ...entry
        };
        this.log(logEntry);
    }
    logError(operation, error, context = {}) {
        const logEntry = {
            timestamp: new Date(),
            level: 'error',
            operation,
            query: context.query || '',
            normalizedQuery: context.query?.toLowerCase().trim() || '',
            userId: context.userId,
            duration: 0,
            strategy: 'error',
            indexesUsed: [],
            cacheHit: false,
            resultCount: 0,
            metadata: context.metadata || {},
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        };
        this.log(logEntry);
    }
    startTrace(operation, userId) {
        if (!this.config.performance.enableTracing) {
            return '';
        }
        if (Math.random() > this.config.performance.sampleRate) {
            return '';
        }
        const traceId = this.generateTraceId();
        const trace = {
            traceId,
            operation,
            startTime: Date.now(),
            spans: [],
            totalDuration: 0,
            status: 'success'
        };
        this.activeTraces.set(traceId, trace);
        this.logTrace('trace', `Started trace: ${operation}`, { traceId, userId });
        return traceId;
    }
    startSpan(traceId, operation, parentSpanId) {
        if (!traceId || !this.activeTraces.has(traceId)) {
            return '';
        }
        const spanId = this.generateSpanId();
        const span = {
            spanId,
            parentSpanId,
            operation,
            startTime: Date.now(),
            endTime: 0,
            duration: 0,
            tags: {}
        };
        const trace = this.activeTraces.get(traceId);
        trace.spans.push(span);
        return spanId;
    }
    endSpan(traceId, spanId, tags = {}) {
        if (!traceId || !this.activeTraces.has(traceId)) {
            return;
        }
        const trace = this.activeTraces.get(traceId);
        const span = trace.spans.find(s => s.spanId === spanId);
        if (span) {
            span.endTime = Date.now();
            span.duration = span.endTime - span.startTime;
            span.tags = { ...span.tags, ...tags };
        }
    }
    endTrace(traceId, status = 'success') {
        if (!traceId || !this.activeTraces.has(traceId)) {
            return;
        }
        const trace = this.activeTraces.get(traceId);
        trace.totalDuration = Date.now() - trace.startTime;
        trace.status = status;
        if (trace.totalDuration > this.config.performance.slowQueryThreshold) {
            this.logTrace('warn', `Slow operation: ${trace.operation}`, {
                traceId,
                duration: trace.totalDuration,
                spans: trace.spans.length
            });
        }
        this.storeTrace(trace);
        this.activeTraces.delete(traceId);
        this.logTrace('trace', `Ended trace: ${trace.operation}`, {
            traceId,
            duration: trace.totalDuration,
            status
        });
    }
    logAudit(entry) {
        if (!this.config.audit.enabled) {
            return;
        }
        const auditEntry = {
            timestamp: new Date(),
            ...entry
        };
        this.storeAuditEntry(auditEntry);
        this.logTrace('info', `Audit: ${entry.action}`, {
            userId: entry.userId,
            resource: entry.resource,
            success: entry.success
        });
    }
    getPerformanceAnalytics(timeframe = 24 * 60 * 60 * 1000) {
        const cutoff = Date.now() - timeframe;
        try {
            const stats = this.db.prepare(`
        SELECT 
          operation,
          COUNT(*) as count,
          AVG(duration) as avg_duration,
          MIN(duration) as min_duration,
          MAX(duration) as max_duration,
          SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) as error_count
        FROM search_logs 
        WHERE timestamp > datetime('now', '-${timeframe / 1000} seconds')
        GROUP BY operation
        ORDER BY count DESC
        LIMIT 10
      `).all();
            const traces = this.db.prepare(`
        SELECT * FROM performance_traces 
        WHERE start_time > ?
        ORDER BY total_duration DESC
        LIMIT 50
      `).all(cutoff);
            const totalOps = stats.reduce((sum, stat) => sum + stat.count, 0);
            const totalTime = stats.reduce((sum, stat) => sum + (stat.avg_duration * stat.count), 0);
            const totalErrors = stats.reduce((sum, stat) => sum + stat.error_count, 0);
            const slowOps = stats.reduce((sum, stat) => sum + (stat.count * (stat.avg_duration > this.config.performance.slowQueryThreshold ? 1 : 0)), 0);
            return {
                totalOperations: totalOps,
                avgResponseTime: totalOps > 0 ? totalTime / totalOps : 0,
                slowOperations: slowOps,
                errorRate: totalOps > 0 ? totalErrors / totalOps : 0,
                topOperations: stats.map(stat => ({
                    operation: stat.operation,
                    count: stat.count,
                    avgTime: stat.avg_duration
                })),
                traces: traces.map(this.parseTrace)
            };
        }
        catch (error) {
            console.error('Error getting performance analytics:', error);
            return {
                totalOperations: 0,
                avgResponseTime: 0,
                slowOperations: 0,
                errorRate: 0,
                topOperations: [],
                traces: []
            };
        }
    }
    async exportLogs(timeframe = 24 * 60 * 60 * 1000, format = 'json') {
        const cutoff = new Date(Date.now() - timeframe);
        try {
            const logs = this.db.prepare(`
        SELECT * FROM search_logs 
        WHERE timestamp > ?
        ORDER BY timestamp DESC
      `).all(cutoff.toISOString());
            if (format === 'json') {
                return JSON.stringify(logs, null, 2);
            }
            else {
                return this.convertLogsToCSV(logs);
            }
        }
        catch (error) {
            console.error('Error exporting logs:', error);
            throw error;
        }
    }
    searchLogs(filters) {
        const { level, operation, userId, timeframe = 24 * 60 * 60 * 1000, limit = 100 } = filters;
        let query = 'SELECT * FROM search_logs WHERE 1=1';
        const params = [];
        if (level) {
            query += ' AND level = ?';
            params.push(level);
        }
        if (operation) {
            query += ' AND operation LIKE ?';
            params.push(`%${operation}%`);
        }
        if (userId) {
            query += ' AND user_id = ?';
            params.push(userId);
        }
        const cutoff = new Date(Date.now() - timeframe);
        query += ' AND timestamp > ?';
        params.push(cutoff.toISOString());
        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(limit);
        try {
            const rows = this.db.prepare(query).all(...params);
            return rows.map(this.parseLogEntry);
        }
        catch (error) {
            console.error('Error searching logs:', error);
            return [];
        }
    }
    log(entry) {
        const entryLevel = this.logLevels.get(entry.level) || 0;
        const configLevel = this.logLevels.get(this.config.logLevel) || 0;
        if (entryLevel < configLevel) {
            return;
        }
        this.logBuffer.push(entry);
        this.config.outputs.forEach(output => {
            if (!output.levels || output.levels.includes(entry.level)) {
                this.processLogOutput(output, entry);
            }
        });
    }
    logTrace(level, message, metadata) {
        this.log({
            timestamp: new Date(),
            level,
            operation: 'trace',
            query: '',
            normalizedQuery: '',
            duration: 0,
            strategy: 'internal',
            indexesUsed: [],
            cacheHit: false,
            resultCount: 0,
            metadata: { message, ...metadata }
        });
    }
    async processLogOutput(output, entry) {
        try {
            switch (output.type) {
                case 'console':
                    this.outputToConsole(entry);
                    break;
                case 'file':
                    await this.outputToFile(output.config, entry);
                    break;
                case 'database':
                    this.outputToDatabase(entry);
                    break;
                case 'elasticsearch':
                    await this.outputToElasticsearch(output.config, entry);
                    break;
            }
        }
        catch (error) {
            console.error(`Error outputting to ${output.type}:`, error);
        }
    }
    outputToConsole(entry) {
        const timestamp = entry.timestamp.toISOString();
        const level = entry.level.toUpperCase().padEnd(5);
        const operation = entry.operation.padEnd(15);
        let message = `${timestamp} [${level}] ${operation}`;
        if (entry.query) {
            message += ` query="${entry.query}"`;
        }
        if (entry.duration > 0) {
            message += ` duration=${entry.duration}ms`;
        }
        if (entry.resultCount > 0) {
            message += ` results=${entry.resultCount}`;
        }
        if (entry.error) {
            message += ` error="${entry.error.message}"`;
        }
        console.log(message);
    }
    async outputToFile(config, entry) {
        const logDir = config.directory || './logs';
        const filename = config.filename || `search-${new Date().toISOString().split('T')[0]}.log`;
        const filepath = (0, path_1.join)(logDir, filename);
        const logLine = `${JSON.stringify({
            timestamp: entry.timestamp.toISOString(),
            level: entry.level,
            operation: entry.operation,
            query: entry.query,
            duration: entry.duration,
            strategy: entry.strategy,
            cache_hit: entry.cacheHit,
            result_count: entry.resultCount,
            user_id: entry.userId,
            session_id: entry.sessionId,
            trace_id: entry.traceId,
            metadata: entry.metadata,
            error: entry.error
        })  }\n`;
        await (0, promises_1.appendFile)(filepath, logLine);
    }
    outputToDatabase(entry) {
        try {
            this.db.prepare(`
        INSERT INTO search_logs (
          timestamp, level, operation, query, normalized_query,
          user_id, session_id, duration, strategy, indexes_used,
          cache_hit, result_count, metadata, error_name, error_message,
          error_stack, trace_id, span_id, parent_span_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(entry.timestamp.toISOString(), entry.level, entry.operation, entry.query, entry.normalizedQuery, entry.userId, entry.sessionId, entry.duration, entry.strategy, JSON.stringify(entry.indexesUsed), entry.cacheHit ? 1 : 0, entry.resultCount, JSON.stringify(entry.metadata), entry.error?.name, entry.error?.message, entry.error?.stack, entry.traceId, entry.spanId, entry.parentSpanId);
        }
        catch (error) {
            console.error('Failed to store log entry in database:', error);
        }
    }
    async outputToElasticsearch(config, entry) {
        console.log(`📊 Would send to Elasticsearch: ${entry.operation}`);
    }
    storeTrace(trace) {
        try {
            this.db.prepare(`
        INSERT INTO performance_traces (
          trace_id, operation, start_time, total_duration, status, spans
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(trace.traceId, trace.operation, trace.startTime, trace.totalDuration, trace.status, JSON.stringify(trace.spans));
        }
        catch (error) {
            console.error('Failed to store performance trace:', error);
        }
    }
    storeAuditEntry(entry) {
        try {
            this.db.prepare(`
        INSERT INTO audit_logs (
          timestamp, action, user_id, resource, details,
          ip_address, user_agent, success
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(entry.timestamp.toISOString(), entry.action, entry.userId, entry.resource, JSON.stringify(entry.details), entry.ipAddress, entry.userAgent, entry.success ? 1 : 0);
        }
        catch (error) {
            console.error('Failed to store audit entry:', error);
        }
    }
    generateTraceId() {
        return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
    }
    generateSpanId() {
        return `span_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    }
    parseLogEntry(row) {
        return {
            timestamp: new Date(row.timestamp),
            level: row.level,
            operation: row.operation,
            query: row.query,
            normalizedQuery: row.normalized_query,
            userId: row.user_id,
            sessionId: row.session_id,
            duration: row.duration,
            strategy: row.strategy,
            indexesUsed: row.indexes_used ? JSON.parse(row.indexes_used) : [],
            cacheHit: Boolean(row.cache_hit),
            resultCount: row.result_count,
            metadata: row.metadata ? JSON.parse(row.metadata) : {},
            error: row.error_name ? {
                name: row.error_name,
                message: row.error_message,
                stack: row.error_stack
            } : undefined,
            traceId: row.trace_id,
            spanId: row.span_id,
            parentSpanId: row.parent_span_id
        };
    }
    parseTrace(row) {
        return {
            traceId: row.trace_id,
            operation: row.operation,
            startTime: row.start_time,
            spans: row.spans ? JSON.parse(row.spans) : [],
            totalDuration: row.total_duration,
            status: row.status
        };
    }
    convertLogsToCSV(logs) {
        if (logs.length === 0)
            return '';
        const headers = [
            'timestamp', 'level', 'operation', 'query', 'duration',
            'strategy', 'cache_hit', 'result_count', 'user_id', 'error_message'
        ];
        const rows = logs.map(log => [
            log.timestamp,
            log.level,
            log.operation,
            log.query?.replace(/"/g, '""') || '',
            log.duration,
            log.strategy,
            log.cache_hit ? 'true' : 'false',
            log.result_count,
            log.user_id || '',
            log.error_message?.replace(/"/g, '""') || ''
        ]);
        return [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
    }
    createDefaultConfig(config) {
        return {
            logLevel: 'info',
            outputs: [
                { type: 'console', config: {} },
                { type: 'database', config: {} },
                { type: 'file', config: { directory: './logs' } }
            ],
            rotation: {
                enabled: true,
                maxFileSize: 100 * 1024 * 1024,
                maxFiles: 10
            },
            performance: {
                enableTracing: true,
                sampleRate: 0.1,
                slowQueryThreshold: 1000
            },
            audit: {
                enabled: true,
                retentionDays: 90
            },
            ...config
        };
    }
    async ensureLogDirectories() {
        const fileOutputs = this.config.outputs.filter(o => o.type === 'file');
        for (const output of fileOutputs) {
            const logDir = output.config.directory || './logs';
            if (!(0, fs_1.existsSync)(logDir)) {
                await (0, promises_1.mkdir)(logDir, { recursive: true });
            }
        }
    }
    initializeLogTables() {
        try {
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS search_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          level TEXT NOT NULL,
          operation TEXT NOT NULL,
          query TEXT,
          normalized_query TEXT,
          user_id TEXT,
          session_id TEXT,
          duration INTEGER DEFAULT 0,
          strategy TEXT,
          indexes_used TEXT,
          cache_hit INTEGER DEFAULT 0,
          result_count INTEGER DEFAULT 0,
          metadata TEXT,
          error_name TEXT,
          error_message TEXT,
          error_stack TEXT,
          trace_id TEXT,
          span_id TEXT,
          parent_span_id TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_search_logs_timestamp ON search_logs(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_search_logs_level ON search_logs(level);
        CREATE INDEX IF NOT EXISTS idx_search_logs_operation ON search_logs(operation);
        CREATE INDEX IF NOT EXISTS idx_search_logs_user ON search_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_search_logs_trace ON search_logs(trace_id);
        
        CREATE TABLE IF NOT EXISTS performance_traces (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trace_id TEXT UNIQUE NOT NULL,
          operation TEXT NOT NULL,
          start_time INTEGER NOT NULL,
          total_duration INTEGER NOT NULL,
          status TEXT NOT NULL,
          spans TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_traces_start_time ON performance_traces(start_time DESC);
        CREATE INDEX IF NOT EXISTS idx_traces_operation ON performance_traces(operation);
        CREATE INDEX IF NOT EXISTS idx_traces_duration ON performance_traces(total_duration DESC);
        
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          action TEXT NOT NULL,
          user_id TEXT NOT NULL,
          resource TEXT NOT NULL,
          details TEXT,
          ip_address TEXT,
          user_agent TEXT,
          success INTEGER DEFAULT 1
        );
        
        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
      `);
            console.log('✅ Search logging tables initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize logging tables:', error);
        }
    }
    startBufferFlush() {
        this.flushInterval = setInterval(() => {
            if (this.logBuffer.length > 0) {
                const batch = this.logBuffer.splice(0);
                batch.forEach(entry => this.outputToDatabase(entry));
            }
        }, 5000);
    }
    stopBufferFlush() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
    }
}
exports.SearchLogger = SearchLogger;
//# sourceMappingURL=SearchLogger.js.map