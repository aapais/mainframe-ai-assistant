/**
 * Operation Logger Service
 *
 * Comprehensive audit logging service for all AI operations in the Knowledge Base Assistant.
 * Tracks operations, decisions, errors, and provides analytics and reporting capabilities.
 *
 * Features:
 * - Complete operation lifecycle logging
 * - User decision tracking and analytics
 * - Performance metrics collection
 * - Configurable log retention policies
 * - Export functionality (CSV/JSON)
 * - Real-time event broadcasting
 * - Efficient database schema with proper indexing
 * - Integration with authorization and cost tracking services
 */

import { EventEmitter } from 'events';
import { createWriteStream, WriteStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { Service, ServiceContext, ServiceHealth, ServiceStatus } from './ServiceManager';
import { IBaseService, OperationResult, ServiceMetrics } from '../../backend/core/interfaces/ServiceInterfaces';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export interface Operation {
  id: string;
  type: OperationType;
  subtype?: string;
  userId?: string;
  sessionId?: string;
  query: string;
  context?: OperationContext;
  status: OperationStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  result?: OperationResultData;
  metadata?: Record<string, any>;
  kbEntryId?: string;
  cost?: CostData;
  error?: OperationError;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthorizationDecision {
  id: string;
  operationId: string;
  userId?: string;
  sessionId?: string;
  action: DecisionAction;
  autoApproved: boolean;
  reason?: string;
  timestamp: Date;
  rememberChoice: boolean;
  cost?: number;
  notes?: string;
  scope?: DecisionScope;
  metadata?: Record<string, any>;
}

export interface OperationError {
  id: string;
  operationId?: string;
  errorCode: string;
  errorType: ErrorType;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export interface OperationFilters {
  operationId?: string;
  type?: OperationType;
  subtype?: string;
  userId?: string;
  sessionId?: string;
  status?: OperationStatus;
  dateRange?: DateRange;
  severity?: ErrorSeverity;
  hasError?: boolean;
  autoApproved?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: SortField;
  sortOrder?: 'ASC' | 'DESC';
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface OperationMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  totalCost: number;
  averageCost: number;
  operationsByType: Record<OperationType, number>;
  operationsByStatus: Record<OperationStatus, number>;
  errorsByType: Record<ErrorType, number>;
  decisionsCount: number;
  autoApprovedCount: number;
  userDecisionsCount: number;
  topUsers: Array<{userId: string; operationCount: number}>;
  peakUsageHours: Array<{hour: number; count: number}>;
  costByDay: Array<{date: string; cost: number}>;
  responseTimePercentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  period: DateRange;
  generatedAt: Date;
}

export interface OperationContext {
  sourceComponent?: string;
  userAgent?: string;
  ipAddress?: string;
  sessionData?: Record<string, any>;
  previousOperationId?: string;
  requestId?: string;
}

export interface OperationResultData {
  success: boolean;
  data?: any;
  resultCount?: number;
  resultType?: string;
  cached?: boolean;
  source?: string;
}

export interface CostData {
  estimatedCost: number;
  actualCost?: number;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  model?: string;
  provider?: string;
  currency: string;
}

// Enums
export type OperationType =
  | 'semantic_search'
  | 'explain_error'
  | 'analyze_entry'
  | 'generate_summary'
  | 'extract_keywords'
  | 'classify_content'
  | 'translate_text'
  | 'improve_writing'
  | 'kb_search'
  | 'kb_create'
  | 'kb_update'
  | 'kb_delete'
  | 'autocomplete'
  | 'bulk_operation'
  | 'system_operation';

export type OperationStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export type DecisionAction =
  | 'approve_once'
  | 'approve_always'
  | 'deny'
  | 'use_local_only'
  | 'modify_query';

export type DecisionScope =
  | 'operation'
  | 'session'
  | 'user'
  | 'global';

export type ErrorType =
  | 'authorization_error'
  | 'validation_error'
  | 'database_error'
  | 'network_error'
  | 'ai_service_error'
  | 'cost_limit_error'
  | 'timeout_error'
  | 'system_error'
  | 'user_error';

export type ErrorSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'info';

export type SortField =
  | 'createdAt'
  | 'startTime'
  | 'duration'
  | 'cost'
  | 'type'
  | 'status';

// =============================================================================
// DATABASE SCHEMA INTERFACES
// =============================================================================

interface OperationRow {
  id: string;
  type: string;
  subtype: string | null;
  user_id: string | null;
  session_id: string | null;
  query: string;
  context: string | null; // JSON
  status: string;
  start_time: string; // ISO string
  end_time: string | null; // ISO string
  duration: number | null;
  result: string | null; // JSON
  metadata: string | null; // JSON
  kb_entry_id: string | null;
  cost_data: string | null; // JSON
  error_id: string | null;
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

interface DecisionRow {
  id: string;
  operation_id: string;
  user_id: string | null;
  session_id: string | null;
  action: string;
  auto_approved: number; // SQLite boolean
  reason: string | null;
  timestamp: string; // ISO string
  remember_choice: number; // SQLite boolean
  cost: number | null;
  notes: string | null;
  scope: string | null;
  metadata: string | null; // JSON
}

interface ErrorRow {
  id: string;
  operation_id: string | null;
  error_code: string;
  error_type: string;
  message: string;
  stack: string | null;
  severity: string;
  user_id: string | null;
  session_id: string | null;
  timestamp: string; // ISO string
  resolved: number; // SQLite boolean
  metadata: string | null; // JSON
}

// =============================================================================
// SERVICE EVENTS
// =============================================================================

export interface OperationLoggerEvents {
  'operation:logged': (operation: Operation) => void;
  'decision:logged': (decision: AuthorizationDecision) => void;
  'error:logged': (error: OperationError) => void;
  'operation:completed': (operation: Operation) => void;
  'operation:failed': (operation: Operation, error: OperationError) => void;
  'metrics:updated': (metrics: Partial<OperationMetrics>) => void;
  'cleanup:completed': (deletedCount: number) => void;
  'export:completed': (filePath: string, format: string) => void;
}

// =============================================================================
// OPERATION LOGGER SERVICE IMPLEMENTATION
// =============================================================================

export class OperationLoggerService extends EventEmitter implements IBaseService {
  public readonly name = 'OperationLoggerService';
  public readonly version = '1.0.0';
  public readonly dependencies = ['DatabaseService'];

  private db: Database.Database | null = null;
  private context: ServiceContext | null = null;
  private status: ServiceStatus = {
    status: 'stopped',
    restartCount: 0,
    uptime: 0
  };
  private startTime?: Date;
  private metricsCache: Map<string, any> = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  private exportStreams: Map<string, WriteStream> = new Map();

  // Configuration
  private config = {
    maxLogAge: 90, // days
    batchSize: 1000,
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
    maxExportSize: 100 * 1024 * 1024, // 100MB
    retentionPolicies: {
      operations: 90, // days
      decisions: 180, // days
      errors: 365, // days
    }
  };

  constructor() {
    super();
    this.setupErrorHandling();
  }

  // =============================================================================
  // SERVICE LIFECYCLE METHODS
  // =============================================================================

  async initialize(context: ServiceContext): Promise<void> {
    this.context = context;
    this.startTime = new Date();

    try {
      context.logger.info('Initializing Operation Logger Service...');

      // Initialize database connection
      await this.initializeDatabase(context.dataPath);

      // Create database schema
      await this.createSchema();

      // Create indexes for performance
      await this.createIndexes();

      // Start automatic cleanup process
      this.startCleanupProcess();

      this.status = {
        status: 'running',
        startTime: this.startTime,
        restartCount: 0,
        uptime: 0
      };

      context.logger.info('Operation Logger Service initialized successfully');
    } catch (error) {
      context.logger.error('Failed to initialize Operation Logger Service', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      this.context?.logger.info('Shutting down Operation Logger Service...');

      // Stop cleanup process
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // Close export streams
      for (const [id, stream] of this.exportStreams) {
        stream.end();
        this.exportStreams.delete(id);
      }

      // Close database connection
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      this.status.status = 'stopped';
      this.context?.logger.info('Operation Logger Service shut down successfully');
    } catch (error) {
      this.context?.logger.error('Error during Operation Logger Service shutdown', error);
      throw error;
    }
  }

  async healthCheck(): Promise<ServiceHealth> {
    const healthy = this.db !== null && this.status.status === 'running';
    const lastCheck = new Date();

    if (!healthy) {
      return {
        healthy: false,
        error: 'Database connection not available',
        lastCheck,
        details: { status: this.status.status }
      };
    }

    try {
      // Test database connection
      const testQuery = this.db.prepare('SELECT 1 as test');
      const result = testQuery.get();

      return {
        healthy: result?.test === 1,
        responseTime: Date.now() - lastCheck.getTime(),
        lastCheck,
        details: {
          status: this.status.status,
          uptime: this.getUptime(),
          cacheSize: this.metricsCache.size,
          operationsToday: await this.getTodayOperationsCount()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck,
        details: { status: this.status.status }
      };
    }
  }

  getMetrics(): ServiceMetrics {
    const uptime = this.getUptime();
    return {
      operationsCount: this.metricsCache.get('totalOperations') || 0,
      averageResponseTime: this.metricsCache.get('avgResponseTime') || 0,
      errorRate: this.metricsCache.get('errorRate') || 0,
      uptime,
      memoryUsage: process.memoryUsage().heapUsed,
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  resetMetrics(): void {
    this.metricsCache.clear();
  }

  // =============================================================================
  // CORE LOGGING METHODS
  // =============================================================================

  async logOperation(operation: Omit<Operation, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const now = new Date();
      const fullOperation: Operation = {
        ...operation,
        id: this.generateOperationId(),
        createdAt: now,
        updatedAt: now
      };

      const stmt = this.db.prepare(`
        INSERT INTO operation_logs (
          id, type, subtype, user_id, session_id, query, context, status,
          start_time, end_time, duration, result, metadata, kb_entry_id,
          cost_data, error_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        fullOperation.id,
        fullOperation.type,
        fullOperation.subtype || null,
        fullOperation.userId || null,
        fullOperation.sessionId || null,
        fullOperation.query,
        fullOperation.context ? JSON.stringify(fullOperation.context) : null,
        fullOperation.status,
        fullOperation.startTime.toISOString(),
        fullOperation.endTime?.toISOString() || null,
        fullOperation.duration || null,
        fullOperation.result ? JSON.stringify(fullOperation.result) : null,
        fullOperation.metadata ? JSON.stringify(fullOperation.metadata) : null,
        fullOperation.kbEntryId || null,
        fullOperation.cost ? JSON.stringify(fullOperation.cost) : null,
        fullOperation.error?.id || null,
        fullOperation.createdAt.toISOString(),
        fullOperation.updatedAt.toISOString()
      );

      // Update cache
      this.invalidateMetricsCache();

      // Emit event
      this.emit('operation:logged', fullOperation);

      // Log completion or failure events
      if (fullOperation.status === 'completed') {
        this.emit('operation:completed', fullOperation);
      } else if (fullOperation.status === 'failed' && fullOperation.error) {
        this.emit('operation:failed', fullOperation, fullOperation.error);
      }

    } catch (error) {
      this.context?.logger.error('Failed to log operation', error);
      throw error;
    }
  }

  async logDecision(decision: Omit<AuthorizationDecision, 'id'>): Promise<void> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const fullDecision: AuthorizationDecision = {
        ...decision,
        id: this.generateDecisionId()
      };

      const stmt = this.db.prepare(`
        INSERT INTO operation_decisions (
          id, operation_id, user_id, session_id, action, auto_approved,
          reason, timestamp, remember_choice, cost, notes, scope, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        fullDecision.id,
        fullDecision.operationId,
        fullDecision.userId || null,
        fullDecision.sessionId || null,
        fullDecision.action,
        fullDecision.autoApproved ? 1 : 0,
        fullDecision.reason || null,
        fullDecision.timestamp.toISOString(),
        fullDecision.rememberChoice ? 1 : 0,
        fullDecision.cost || null,
        fullDecision.notes || null,
        fullDecision.scope || null,
        fullDecision.metadata ? JSON.stringify(fullDecision.metadata) : null
      );

      // Emit event
      this.emit('decision:logged', fullDecision);

    } catch (error) {
      this.context?.logger.error('Failed to log decision', error);
      throw error;
    }
  }

  async logError(error: Omit<OperationError, 'id'>): Promise<void> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const fullError: OperationError = {
        ...error,
        id: this.generateErrorId()
      };

      const stmt = this.db.prepare(`
        INSERT INTO operation_errors (
          id, operation_id, error_code, error_type, message, stack,
          severity, user_id, session_id, timestamp, resolved, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        fullError.id,
        fullError.operationId || null,
        fullError.errorCode,
        fullError.errorType,
        fullError.message,
        fullError.stack || null,
        fullError.severity,
        fullError.userId || null,
        fullError.sessionId || null,
        fullError.timestamp.toISOString(),
        fullError.resolved ? 1 : 0,
        fullError.metadata ? JSON.stringify(fullError.metadata) : null
      );

      // Emit event
      this.emit('error:logged', fullError);

    } catch (error) {
      this.context?.logger.error('Failed to log error', error);
      throw error;
    }
  }

  // =============================================================================
  // QUERY INTERFACE METHODS
  // =============================================================================

  async getOperationHistory(filters: OperationFilters = {}): Promise<Operation[]> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      let query = `
        SELECT ol.*, oe.error_code, oe.error_type, oe.message as error_message,
               oe.severity as error_severity
        FROM operation_logs ol
        LEFT JOIN operation_errors oe ON ol.error_id = oe.id
        WHERE 1=1
      `;
      const params: any[] = [];

      // Build WHERE clause
      if (filters.operationId) {
        query += ' AND ol.id = ?';
        params.push(filters.operationId);
      }

      if (filters.type) {
        query += ' AND ol.type = ?';
        params.push(filters.type);
      }

      if (filters.subtype) {
        query += ' AND ol.subtype = ?';
        params.push(filters.subtype);
      }

      if (filters.userId) {
        query += ' AND ol.user_id = ?';
        params.push(filters.userId);
      }

      if (filters.sessionId) {
        query += ' AND ol.session_id = ?';
        params.push(filters.sessionId);
      }

      if (filters.status) {
        query += ' AND ol.status = ?';
        params.push(filters.status);
      }

      if (filters.dateRange) {
        query += ' AND ol.start_time >= ? AND ol.start_time <= ?';
        params.push(filters.dateRange.start.toISOString(), filters.dateRange.end.toISOString());
      }

      if (filters.hasError !== undefined) {
        query += filters.hasError ? ' AND ol.error_id IS NOT NULL' : ' AND ol.error_id IS NULL';
      }

      // Sorting
      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder || 'DESC';
      query += ` ORDER BY ol.${this.mapSortField(sortBy)} ${sortOrder}`;

      // Pagination
      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);

        if (filters.offset) {
          query += ' OFFSET ?';
          params.push(filters.offset);
        }
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as OperationRow[];

      return rows.map(row => this.mapRowToOperation(row));

    } catch (error) {
      this.context?.logger.error('Failed to get operation history', error);
      throw error;
    }
  }

  async getOperationMetrics(period: DateRange): Promise<OperationMetrics> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const cacheKey = `metrics_${period.start.toISOString()}_${period.end.toISOString()}`;
      const cached = this.metricsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
        return cached.data;
      }

      // Get basic operation counts
      const operationStats = this.db.prepare(`
        SELECT
          COUNT(*) as total_operations,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_operations,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_operations,
          AVG(duration) as avg_response_time,
          SUM(CASE WHEN cost_data IS NOT NULL THEN json_extract(cost_data, '$.estimatedCost') ELSE 0 END) as total_cost,
          AVG(CASE WHEN cost_data IS NOT NULL THEN json_extract(cost_data, '$.estimatedCost') ELSE 0 END) as avg_cost
        FROM operation_logs
        WHERE start_time >= ? AND start_time <= ?
      `).get(period.start.toISOString(), period.end.toISOString()) as any;

      // Get operations by type
      const operationsByType = this.db.prepare(`
        SELECT type, COUNT(*) as count
        FROM operation_logs
        WHERE start_time >= ? AND start_time <= ?
        GROUP BY type
      `).all(period.start.toISOString(), period.end.toISOString()) as any[];

      // Get operations by status
      const operationsByStatus = this.db.prepare(`
        SELECT status, COUNT(*) as count
        FROM operation_logs
        WHERE start_time >= ? AND start_time <= ?
        GROUP BY status
      `).all(period.start.toISOString(), period.end.toISOString()) as any[];

      // Get errors by type
      const errorsByType = this.db.prepare(`
        SELECT error_type, COUNT(*) as count
        FROM operation_errors
        WHERE timestamp >= ? AND timestamp <= ?
        GROUP BY error_type
      `).all(period.start.toISOString(), period.end.toISOString()) as any[];

      // Get decision stats
      const decisionStats = this.db.prepare(`
        SELECT
          COUNT(*) as decisions_count,
          COUNT(CASE WHEN auto_approved = 1 THEN 1 END) as auto_approved_count
        FROM operation_decisions
        WHERE timestamp >= ? AND timestamp <= ?
      `).get(period.start.toISOString(), period.end.toISOString()) as any;

      // Get top users
      const topUsers = this.db.prepare(`
        SELECT user_id, COUNT(*) as operation_count
        FROM operation_logs
        WHERE start_time >= ? AND start_time <= ? AND user_id IS NOT NULL
        GROUP BY user_id
        ORDER BY operation_count DESC
        LIMIT 10
      `).all(period.start.toISOString(), period.end.toISOString()) as any[];

      // Get response time percentiles
      const responseTimes = this.db.prepare(`
        SELECT duration
        FROM operation_logs
        WHERE start_time >= ? AND start_time <= ? AND duration IS NOT NULL
        ORDER BY duration
      `).all(period.start.toISOString(), period.end.toISOString()) as any[];

      const percentiles = this.calculatePercentiles(responseTimes.map(r => r.duration));

      // Get peak usage hours
      const peakUsage = this.db.prepare(`
        SELECT
          CAST(strftime('%H', start_time) AS INTEGER) as hour,
          COUNT(*) as count
        FROM operation_logs
        WHERE start_time >= ? AND start_time <= ?
        GROUP BY hour
        ORDER BY count DESC
        LIMIT 5
      `).all(period.start.toISOString(), period.end.toISOString()) as any[];

      // Get cost by day
      const costByDay = this.db.prepare(`
        SELECT
          DATE(start_time) as date,
          SUM(CASE WHEN cost_data IS NOT NULL THEN json_extract(cost_data, '$.estimatedCost') ELSE 0 END) as cost
        FROM operation_logs
        WHERE start_time >= ? AND start_time <= ?
        GROUP BY DATE(start_time)
        ORDER BY date
      `).all(period.start.toISOString(), period.end.toISOString()) as any[];

      const metrics: OperationMetrics = {
        totalOperations: operationStats.total_operations || 0,
        successfulOperations: operationStats.successful_operations || 0,
        failedOperations: operationStats.failed_operations || 0,
        averageResponseTime: operationStats.avg_response_time || 0,
        totalCost: operationStats.total_cost || 0,
        averageCost: operationStats.avg_cost || 0,
        operationsByType: Object.fromEntries(
          operationsByType.map(item => [item.type, item.count])
        ) as Record<OperationType, number>,
        operationsByStatus: Object.fromEntries(
          operationsByStatus.map(item => [item.status, item.count])
        ) as Record<OperationStatus, number>,
        errorsByType: Object.fromEntries(
          errorsByType.map(item => [item.error_type, item.count])
        ) as Record<ErrorType, number>,
        decisionsCount: decisionStats.decisions_count || 0,
        autoApprovedCount: decisionStats.auto_approved_count || 0,
        userDecisionsCount: (decisionStats.decisions_count || 0) - (decisionStats.auto_approved_count || 0),
        topUsers: topUsers.map(user => ({
          userId: user.user_id,
          operationCount: user.operation_count
        })),
        peakUsageHours: peakUsage.map(peak => ({
          hour: peak.hour,
          count: peak.count
        })),
        costByDay: costByDay.map(cost => ({
          date: cost.date,
          cost: cost.cost || 0
        })),
        responseTimePercentiles: percentiles,
        period,
        generatedAt: new Date()
      };

      // Cache the result
      this.metricsCache.set(cacheKey, {
        data: metrics,
        timestamp: Date.now()
      });

      return metrics;

    } catch (error) {
      this.context?.logger.error('Failed to get operation metrics', error);
      throw error;
    }
  }

  async getOperationById(id: string): Promise<Operation | null> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const stmt = this.db.prepare(`
        SELECT ol.*, oe.error_code, oe.error_type, oe.message as error_message,
               oe.severity as error_severity
        FROM operation_logs ol
        LEFT JOIN operation_errors oe ON ol.error_id = oe.id
        WHERE ol.id = ?
      `);

      const row = stmt.get(id) as OperationRow | undefined;
      return row ? this.mapRowToOperation(row) : null;

    } catch (error) {
      this.context?.logger.error('Failed to get operation by ID', error);
      throw error;
    }
  }

  async searchLogs(query: string): Promise<Operation[]> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const stmt = this.db.prepare(`
        SELECT ol.*, oe.error_code, oe.error_type, oe.message as error_message,
               oe.severity as error_severity
        FROM operation_logs ol
        LEFT JOIN operation_errors oe ON ol.error_id = oe.id
        WHERE ol.query LIKE ?
           OR ol.type LIKE ?
           OR ol.metadata LIKE ?
           OR oe.message LIKE ?
        ORDER BY ol.created_at DESC
        LIMIT 100
      `);

      const searchPattern = `%${query}%`;
      const rows = stmt.all(searchPattern, searchPattern, searchPattern, searchPattern) as OperationRow[];

      return rows.map(row => this.mapRowToOperation(row));

    } catch (error) {
      this.context?.logger.error('Failed to search logs', error);
      throw error;
    }
  }

  // =============================================================================
  // EXPORT FUNCTIONALITY
  // =============================================================================

  async exportLogs(format: 'csv' | 'json', period: DateRange, filePath?: string): Promise<string> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const operations = await this.getOperationHistory({
        dateRange: period,
        limit: 10000 // Reasonable limit for exports
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = filePath || path.join(
        this.context?.dataPath || '.',
        'exports',
        `operations_export_${timestamp}.${format}`
      );

      // Ensure export directory exists
      await fs.mkdir(path.dirname(filename), { recursive: true });

      if (format === 'csv') {
        await this.exportToCSV(operations, filename);
      } else {
        await this.exportToJSON(operations, filename);
      }

      this.emit('export:completed', filename, format);
      return filename;

    } catch (error) {
      this.context?.logger.error('Failed to export logs', error);
      throw error;
    }
  }

  // =============================================================================
  // CLEANUP METHODS
  // =============================================================================

  async cleanupOldLogs(daysToKeep?: number): Promise<number> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const retentionDays = daysToKeep || this.config.maxLogAge;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Clean up operations
      const operationsStmt = this.db.prepare(`
        DELETE FROM operation_logs
        WHERE created_at < ?
      `);
      const operationsResult = operationsStmt.run(cutoffDate.toISOString());

      // Clean up orphaned decisions
      const decisionsStmt = this.db.prepare(`
        DELETE FROM operation_decisions
        WHERE operation_id NOT IN (SELECT id FROM operation_logs)
      `);
      const decisionsResult = decisionsStmt.run();

      // Clean up orphaned errors
      const errorsStmt = this.db.prepare(`
        DELETE FROM operation_errors
        WHERE operation_id NOT IN (SELECT id FROM operation_logs)
      `);
      const errorsResult = errorsStmt.run();

      const totalDeleted = operationsResult.changes + decisionsResult.changes + errorsResult.changes;

      // Clear metrics cache
      this.invalidateMetricsCache();

      this.emit('cleanup:completed', totalDeleted);
      this.context?.logger.info(`Cleaned up ${totalDeleted} old log entries`);

      return totalDeleted;

    } catch (error) {
      this.context?.logger.error('Failed to cleanup old logs', error);
      throw error;
    }
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  private async initializeDatabase(dataPath: string): Promise<void> {
    const dbPath = path.join(dataPath, 'operation_logs.db');

    // Ensure directory exists
    await fs.mkdir(path.dirname(dbPath), { recursive: true });

    this.db = new Database(dbPath, {
      verbose: this.context?.isDevelopment ? console.log : undefined
    });

    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000');
    this.db.pragma('temp_store = memory');
  }

  private async createSchema(): Promise<void> {
    if (!this.db) return;

    // Create operations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        subtype TEXT,
        user_id TEXT,
        session_id TEXT,
        query TEXT NOT NULL,
        context TEXT, -- JSON
        status TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration INTEGER,
        result TEXT, -- JSON
        metadata TEXT, -- JSON
        kb_entry_id TEXT,
        cost_data TEXT, -- JSON
        error_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create decisions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operation_decisions (
        id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL,
        user_id TEXT,
        session_id TEXT,
        action TEXT NOT NULL,
        auto_approved INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        timestamp TEXT NOT NULL,
        remember_choice INTEGER NOT NULL DEFAULT 0,
        cost REAL,
        notes TEXT,
        scope TEXT,
        metadata TEXT, -- JSON
        FOREIGN KEY (operation_id) REFERENCES operation_logs(id) ON DELETE CASCADE
      )
    `);

    // Create errors table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operation_errors (
        id TEXT PRIMARY KEY,
        operation_id TEXT,
        error_code TEXT NOT NULL,
        error_type TEXT NOT NULL,
        message TEXT NOT NULL,
        stack TEXT,
        severity TEXT NOT NULL,
        user_id TEXT,
        session_id TEXT,
        timestamp TEXT NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0,
        metadata TEXT, -- JSON
        FOREIGN KEY (operation_id) REFERENCES operation_logs(id) ON DELETE SET NULL
      )
    `);
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    const indexes = [
      // Operation logs indexes
      'CREATE INDEX IF NOT EXISTS idx_operation_logs_type ON operation_logs(type)',
      'CREATE INDEX IF NOT EXISTS idx_operation_logs_status ON operation_logs(status)',
      'CREATE INDEX IF NOT EXISTS idx_operation_logs_user_id ON operation_logs(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_operation_logs_session_id ON operation_logs(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_operation_logs_start_time ON operation_logs(start_time)',
      'CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_operation_logs_kb_entry_id ON operation_logs(kb_entry_id)',
      'CREATE INDEX IF NOT EXISTS idx_operation_logs_duration ON operation_logs(duration)',

      // Decision indexes
      'CREATE INDEX IF NOT EXISTS idx_operation_decisions_operation_id ON operation_decisions(operation_id)',
      'CREATE INDEX IF NOT EXISTS idx_operation_decisions_user_id ON operation_decisions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_operation_decisions_timestamp ON operation_decisions(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_operation_decisions_action ON operation_decisions(action)',

      // Error indexes
      'CREATE INDEX IF NOT EXISTS idx_operation_errors_operation_id ON operation_errors(operation_id)',
      'CREATE INDEX IF NOT EXISTS idx_operation_errors_error_type ON operation_errors(error_type)',
      'CREATE INDEX IF NOT EXISTS idx_operation_errors_severity ON operation_errors(severity)',
      'CREATE INDEX IF NOT EXISTS idx_operation_errors_timestamp ON operation_errors(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_operation_errors_resolved ON operation_errors(resolved)',

      // Composite indexes for common queries
      'CREATE INDEX IF NOT EXISTS idx_operation_logs_type_status ON operation_logs(type, status)',
      'CREATE INDEX IF NOT EXISTS idx_operation_logs_user_time ON operation_logs(user_id, start_time)',
      'CREATE INDEX IF NOT EXISTS idx_operation_logs_session_time ON operation_logs(session_id, start_time)'
    ];

    for (const indexSql of indexes) {
      this.db.exec(indexSql);
    }
  }

  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupOldLogs();
      } catch (error) {
        this.context?.logger.error('Error during automatic cleanup', error);
      }
    }, this.config.cleanupInterval);
  }

  private setupErrorHandling(): void {
    this.on('error', (error) => {
      this.context?.logger.error('OperationLoggerService error', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.context?.logger.error('Unhandled Rejection in OperationLoggerService', reason);
    });
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDecisionId(): string {
    return `dec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapRowToOperation(row: OperationRow): Operation {
    return {
      id: row.id,
      type: row.type as OperationType,
      subtype: row.subtype || undefined,
      userId: row.user_id || undefined,
      sessionId: row.session_id || undefined,
      query: row.query,
      context: row.context ? JSON.parse(row.context) : undefined,
      status: row.status as OperationStatus,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      duration: row.duration || undefined,
      result: row.result ? JSON.parse(row.result) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      kbEntryId: row.kb_entry_id || undefined,
      cost: row.cost_data ? JSON.parse(row.cost_data) : undefined,
      error: row.error_id ? {
        id: row.error_id,
        operationId: row.id,
        errorCode: (row as any).error_code || 'UNKNOWN',
        errorType: (row as any).error_type as ErrorType || 'system_error',
        message: (row as any).error_message || 'Unknown error',
        severity: (row as any).error_severity as ErrorSeverity || 'medium',
        timestamp: new Date(row.start_time),
        resolved: false
      } : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapSortField(field: SortField): string {
    const mapping = {
      createdAt: 'created_at',
      startTime: 'start_time',
      duration: 'duration',
      cost: 'cost_data',
      type: 'type',
      status: 'status'
    };
    return mapping[field] || 'created_at';
  }

  private async exportToCSV(operations: Operation[], filename: string): Promise<void> {
    const headers = [
      'ID', 'Type', 'Subtype', 'User ID', 'Session ID', 'Query', 'Status',
      'Start Time', 'End Time', 'Duration (ms)', 'Cost', 'KB Entry ID',
      'Error Type', 'Error Message', 'Created At'
    ];

    const csvContent = [
      headers.join(','),
      ...operations.map(op => [
        op.id,
        op.type,
        op.subtype || '',
        op.userId || '',
        op.sessionId || '',
        `"${op.query.replace(/"/g, '""')}"`,
        op.status,
        op.startTime.toISOString(),
        op.endTime?.toISOString() || '',
        op.duration || '',
        op.cost?.estimatedCost || '',
        op.kbEntryId || '',
        op.error?.errorType || '',
        op.error?.message ? `"${op.error.message.replace(/"/g, '""')}"` : '',
        op.createdAt.toISOString()
      ].join(','))
    ].join('\n');

    await fs.writeFile(filename, csvContent, 'utf8');
  }

  private async exportToJSON(operations: Operation[], filename: string): Promise<void> {
    const jsonContent = JSON.stringify({
      exportDate: new Date().toISOString(),
      totalOperations: operations.length,
      operations
    }, null, 2);

    await fs.writeFile(filename, jsonContent, 'utf8');
  }

  private calculatePercentiles(values: number[]): OperationMetrics['responseTimePercentiles'] {
    if (values.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const sorted = values.sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    return {
      p50: getPercentile(50),
      p90: getPercentile(90),
      p95: getPercentile(95),
      p99: getPercentile(99)
    };
  }

  private invalidateMetricsCache(): void {
    const now = Date.now();
    for (const [key, value] of this.metricsCache.entries()) {
      if (now - value.timestamp > this.config.cacheTimeout) {
        this.metricsCache.delete(key);
      }
    }
  }

  private calculateCacheHitRate(): number {
    const totalQueries = this.metricsCache.get('totalQueries') || 1;
    const cacheHits = this.metricsCache.get('cacheHits') || 0;
    return cacheHits / totalQueries;
  }

  private getUptime(): number {
    return this.startTime ? Date.now() - this.startTime.getTime() : 0;
  }

  private async getTodayOperationsCount(): Promise<number> {
    if (!this.db) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM operation_logs
      WHERE start_time >= ? AND start_time < ?
    `);

    const result = stmt.get(today.toISOString(), tomorrow.toISOString()) as any;
    return result.count || 0;
  }
}

export default OperationLoggerService;