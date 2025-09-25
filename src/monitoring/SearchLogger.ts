/**
 * Search Logger
 *
 * Comprehensive logging strategy for search operations with
 * structured logging, performance traces, error tracking,
 * and audit capabilities.
 */

import { writeFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import Database from 'better-sqlite3';

export interface LogLevel {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  priority: number;
}

export interface SearchLogEntry {
  timestamp: Date;
  level: LogLevel['level'];
  operation: string;

  // Request details
  query: string;
  normalizedQuery: string;
  userId?: string;
  sessionId?: string;

  // Performance metrics
  duration: number;
  strategy: string;
  indexesUsed: string[];
  cacheHit: boolean;

  // Results
  resultCount: number;
  relevanceScores?: number[];

  // Context
  metadata: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };

  // Trace information
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
    maxFileSize: number; // bytes
    maxFiles: number;
  };
  performance: {
    enableTracing: boolean;
    sampleRate: number; // 0.0 to 1.0
    slowQueryThreshold: number; // milliseconds
  };
  audit: {
    enabled: boolean;
    retentionDays: number;
  };
}

export class SearchLogger {
  private db: Database.Database;
  private config: LoggerConfig;
  private logLevels: Map<string, number>;
  private activeTraces: Map<string, PerformanceTrace> = new Map();
  private logBuffer: SearchLogEntry[] = [];
  private flushInterval: ReturnType<typeof setTimeout>;

  constructor(database: Database.Database, config: Partial<LoggerConfig> = {}) {
    this.db = database;
    this.config = this.createDefaultConfig(config);

    this.logLevels = new Map([
      ['trace', 0],
      ['debug', 1],
      ['info', 2],
      ['warn', 3],
      ['error', 4],
      ['fatal', 5],
    ]);

    this.initializeLogTables();
    this.ensureLogDirectories();
    this.startBufferFlush();

    console.log('📝 Search logger initialized');
  }

  /**
   * Log a search operation
   */
  logSearch(entry: Omit<SearchLogEntry, 'timestamp' | 'level'>): void {
    const logEntry: SearchLogEntry = {
      timestamp: new Date(),
      level: 'info',
      ...entry,
    };

    this.log(logEntry);
  }

  /**
   * Log an error with search context
   */
  logError(
    operation: string,
    error: Error,
    context: {
      query?: string;
      userId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): void {
    const logEntry: SearchLogEntry = {
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
        stack: error.stack,
      },
    };

    this.log(logEntry);
  }

  /**
   * Start a performance trace
   */
  startTrace(operation: string, userId?: string): string {
    if (!this.config.performance.enableTracing) {
      return '';
    }

    // Sample based on configuration
    if (Math.random() > this.config.performance.sampleRate) {
      return '';
    }

    const traceId = this.generateTraceId();
    const trace: PerformanceTrace = {
      traceId,
      operation,
      startTime: Date.now(),
      spans: [],
      totalDuration: 0,
      status: 'success',
    };

    this.activeTraces.set(traceId, trace);

    this.logTrace('trace', `Started trace: ${operation}`, { traceId, userId });
    return traceId;
  }

  /**
   * Start a span within a trace
   */
  startSpan(traceId: string, operation: string, parentSpanId?: string): string {
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
      tags: {},
    };

    const trace = this.activeTraces.get(traceId)!;
    trace.spans.push(span);

    return spanId;
  }

  /**
   * End a span with optional tags
   */
  endSpan(traceId: string, spanId: string, tags: Record<string, any> = {}): void {
    if (!traceId || !this.activeTraces.has(traceId)) {
      return;
    }

    const trace = this.activeTraces.get(traceId)!;
    const span = trace.spans.find(s => s.spanId === spanId);

    if (span) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
      span.tags = { ...span.tags, ...tags };
    }
  }

  /**
   * End a trace
   */
  endTrace(traceId: string, status: 'success' | 'error' = 'success'): void {
    if (!traceId || !this.activeTraces.has(traceId)) {
      return;
    }

    const trace = this.activeTraces.get(traceId)!;
    trace.totalDuration = Date.now() - trace.startTime;
    trace.status = status;

    // Log slow operations
    if (trace.totalDuration > this.config.performance.slowQueryThreshold) {
      this.logTrace('warn', `Slow operation: ${trace.operation}`, {
        traceId,
        duration: trace.totalDuration,
        spans: trace.spans.length,
      });
    }

    // Store trace
    this.storeTrace(trace);
    this.activeTraces.delete(traceId);

    this.logTrace('trace', `Ended trace: ${trace.operation}`, {
      traceId,
      duration: trace.totalDuration,
      status,
    });
  }

  /**
   * Log an audit event
   */
  logAudit(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    if (!this.config.audit.enabled) {
      return;
    }

    const auditEntry: AuditLogEntry = {
      timestamp: new Date(),
      ...entry,
    };

    this.storeAuditEntry(auditEntry);

    this.logTrace('info', `Audit: ${entry.action}`, {
      userId: entry.userId,
      resource: entry.resource,
      success: entry.success,
    });
  }

  /**
   * Get performance analytics
   */
  getPerformanceAnalytics(timeframe: number = 24 * 60 * 60 * 1000): {
    totalOperations: number;
    avgResponseTime: number;
    slowOperations: number;
    errorRate: number;
    topOperations: Array<{ operation: string; count: number; avgTime: number }>;
    traces: PerformanceTrace[];
  } {
    const cutoff = Date.now() - timeframe;

    try {
      // Get operation statistics
      const stats = this.db
        .prepare(
          `
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
      `
        )
        .all() as any[];

      // Get traces
      const traces = this.db
        .prepare(
          `
        SELECT * FROM performance_traces 
        WHERE start_time > ?
        ORDER BY total_duration DESC
        LIMIT 50
      `
        )
        .all(cutoff) as any[];

      const totalOps = stats.reduce((sum, stat) => sum + stat.count, 0);
      const totalTime = stats.reduce((sum, stat) => sum + stat.avg_duration * stat.count, 0);
      const totalErrors = stats.reduce((sum, stat) => sum + stat.error_count, 0);
      const slowOps = stats.reduce(
        (sum, stat) =>
          sum +
          stat.count * (stat.avg_duration > this.config.performance.slowQueryThreshold ? 1 : 0),
        0
      );

      return {
        totalOperations: totalOps,
        avgResponseTime: totalOps > 0 ? totalTime / totalOps : 0,
        slowOperations: slowOps,
        errorRate: totalOps > 0 ? totalErrors / totalOps : 0,
        topOperations: stats.map(stat => ({
          operation: stat.operation,
          count: stat.count,
          avgTime: stat.avg_duration,
        })),
        traces: traces.map(this.parseTrace),
      };
    } catch (error) {
      console.error('Error getting performance analytics:', error);
      return {
        totalOperations: 0,
        avgResponseTime: 0,
        slowOperations: 0,
        errorRate: 0,
        topOperations: [],
        traces: [],
      };
    }
  }

  /**
   * Export logs for analysis
   */
  async exportLogs(
    timeframe: number = 24 * 60 * 60 * 1000,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const cutoff = new Date(Date.now() - timeframe);

    try {
      const logs = this.db
        .prepare(
          `
        SELECT * FROM search_logs 
        WHERE timestamp > ?
        ORDER BY timestamp DESC
      `
        )
        .all(cutoff.toISOString()) as any[];

      if (format === 'json') {
        return JSON.stringify(logs, null, 2);
      } else {
        return this.convertLogsToCSV(logs);
      }
    } catch (error) {
      console.error('Error exporting logs:', error);
      throw error;
    }
  }

  /**
   * Search logs with filters
   */
  searchLogs(filters: {
    level?: string;
    operation?: string;
    userId?: string;
    timeframe?: number;
    limit?: number;
  }): SearchLogEntry[] {
    const { level, operation, userId, timeframe = 24 * 60 * 60 * 1000, limit = 100 } = filters;

    let query = 'SELECT * FROM search_logs WHERE 1=1';
    const params: any[] = [];

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
      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map(this.parseLogEntry);
    } catch (error) {
      console.error('Error searching logs:', error);
      return [];
    }
  }

  // Private implementation methods

  private log(entry: SearchLogEntry): void {
    // Check log level
    const entryLevel = this.logLevels.get(entry.level) || 0;
    const configLevel = this.logLevels.get(this.config.logLevel) || 0;

    if (entryLevel < configLevel) {
      return; // Skip this log entry
    }

    // Add to buffer
    this.logBuffer.push(entry);

    // Process through outputs
    this.config.outputs.forEach(output => {
      if (!output.levels || output.levels.includes(entry.level)) {
        this.processLogOutput(output, entry);
      }
    });
  }

  private logTrace(level: LogLevel['level'], message: string, metadata: Record<string, any>): void {
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
      metadata: { message, ...metadata },
    });
  }

  private async processLogOutput(output: any, entry: SearchLogEntry): Promise<void> {
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
    } catch (error) {
      console.error(`Error outputting to ${output.type}:`, error);
    }
  }

  private outputToConsole(entry: SearchLogEntry): void {
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

  private async outputToFile(config: any, entry: SearchLogEntry): Promise<void> {
    const logDir = config.directory || './logs';
    const filename = config.filename || `search-${new Date().toISOString().split('T')[0]}.log`;
    const filepath = join(logDir, filename);

    const logLine =
      JSON.stringify({
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
        error: entry.error,
      }) + '\n';

    await appendFile(filepath, logLine);
  }

  private outputToDatabase(entry: SearchLogEntry): void {
    try {
      this.db
        .prepare(
          `
        INSERT INTO search_logs (
          timestamp, level, operation, query, normalized_query,
          user_id, session_id, duration, strategy, indexes_used,
          cache_hit, result_count, metadata, error_name, error_message,
          error_stack, trace_id, span_id, parent_span_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          entry.timestamp.toISOString(),
          entry.level,
          entry.operation,
          entry.query,
          entry.normalizedQuery,
          entry.userId,
          entry.sessionId,
          entry.duration,
          entry.strategy,
          JSON.stringify(entry.indexesUsed),
          entry.cacheHit ? 1 : 0,
          entry.resultCount,
          JSON.stringify(entry.metadata),
          entry.error?.name,
          entry.error?.message,
          entry.error?.stack,
          entry.traceId,
          entry.spanId,
          entry.parentSpanId
        );
    } catch (error) {
      console.error('Failed to store log entry in database:', error);
    }
  }

  private async outputToElasticsearch(config: any, entry: SearchLogEntry): Promise<void> {
    // Elasticsearch implementation would require additional dependencies
    console.log(`📊 Would send to Elasticsearch: ${entry.operation}`);
  }

  private storeTrace(trace: PerformanceTrace): void {
    try {
      this.db
        .prepare(
          `
        INSERT INTO performance_traces (
          trace_id, operation, start_time, total_duration, status, spans
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          trace.traceId,
          trace.operation,
          trace.startTime,
          trace.totalDuration,
          trace.status,
          JSON.stringify(trace.spans)
        );
    } catch (error) {
      console.error('Failed to store performance trace:', error);
    }
  }

  private storeAuditEntry(entry: AuditLogEntry): void {
    try {
      this.db
        .prepare(
          `
        INSERT INTO audit_logs (
          timestamp, action, user_id, resource, details,
          ip_address, user_agent, success
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          entry.timestamp.toISOString(),
          entry.action,
          entry.userId,
          entry.resource,
          JSON.stringify(entry.details),
          entry.ipAddress,
          entry.userAgent,
          entry.success ? 1 : 0
        );
    } catch (error) {
      console.error('Failed to store audit entry:', error);
    }
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }

  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private parseLogEntry(row: any): SearchLogEntry {
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
      error: row.error_name
        ? {
            name: row.error_name,
            message: row.error_message,
            stack: row.error_stack,
          }
        : undefined,
      traceId: row.trace_id,
      spanId: row.span_id,
      parentSpanId: row.parent_span_id,
    };
  }

  private parseTrace(row: any): PerformanceTrace {
    return {
      traceId: row.trace_id,
      operation: row.operation,
      startTime: row.start_time,
      spans: row.spans ? JSON.parse(row.spans) : [],
      totalDuration: row.total_duration,
      status: row.status,
    };
  }

  private convertLogsToCSV(logs: any[]): string {
    if (logs.length === 0) return '';

    const headers = [
      'timestamp',
      'level',
      'operation',
      'query',
      'duration',
      'strategy',
      'cache_hit',
      'result_count',
      'user_id',
      'error_message',
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
      log.error_message?.replace(/"/g, '""') || '',
    ]);

    return [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join(
      '\n'
    );
  }

  private createDefaultConfig(config: Partial<LoggerConfig>): LoggerConfig {
    return {
      logLevel: 'info',
      outputs: [
        { type: 'console', config: {} },
        { type: 'database', config: {} },
        { type: 'file', config: { directory: './logs' } },
      ],
      rotation: {
        enabled: true,
        maxFileSize: 100 * 1024 * 1024, // 100MB
        maxFiles: 10,
      },
      performance: {
        enableTracing: true,
        sampleRate: 0.1, // 10% sampling
        slowQueryThreshold: 1000,
      },
      audit: {
        enabled: true,
        retentionDays: 90,
      },
      ...config,
    };
  }

  private async ensureLogDirectories(): Promise<void> {
    const fileOutputs = this.config.outputs.filter(o => o.type === 'file');

    for (const output of fileOutputs) {
      const logDir = output.config.directory || './logs';
      if (!existsSync(logDir)) {
        await mkdir(logDir, { recursive: true });
      }
    }
  }

  private initializeLogTables(): void {
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
    } catch (error) {
      console.error('❌ Failed to initialize logging tables:', error);
    }
  }

  private startBufferFlush(): void {
    this.flushInterval = setInterval(() => {
      if (this.logBuffer.length > 0) {
        // Process buffered logs in batch
        const batch = this.logBuffer.splice(0);
        batch.forEach(entry => this.outputToDatabase(entry));
      }
    }, 5000); // Flush every 5 seconds
  }

  private stopBufferFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }
}
