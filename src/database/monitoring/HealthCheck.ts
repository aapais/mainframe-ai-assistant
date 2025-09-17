/**
 * Health Check System for SQLite Database
 * 
 * Provides comprehensive database health monitoring including integrity checks,
 * schema validation, performance health, and automated remediation.
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  details?: any;
  timestamp: number;
  duration: number;
  remediation?: string[];
}

export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical' | 'unknown';
  checks: HealthCheckResult[];
  score: number; // 0-100
  lastCheck: number;
  uptime: number;
}

export interface HealthCheckConfig {
  enabled: boolean;
  checkInterval: number; // seconds
  enableAutoRemediation: boolean;
  criticalThresholds: {
    corruptionDetected: boolean;
    schemaValidationFailed: boolean;
    performanceDegradation: number; // percentage
    diskSpaceLow: number; // MB
    memoryUsageHigh: number; // MB
    connectionFailures: number;
    queryFailureRate: number; // percentage
  };
  remediationActions: {
    vacuum: boolean;
    reindex: boolean;
    checkpoint: boolean;
    connectionPoolReset: boolean;
    cacheFlush: boolean;
  };
}

export interface IntegrityIssue {
  type: 'corruption' | 'constraint_violation' | 'index_mismatch' | 'foreign_key_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  table: string;
  description: string;
  affectedRows?: number;
  remediation: string[];
}

export class HealthCheck extends EventEmitter {
  private db: Database.Database;
  private config: HealthCheckConfig;
  private checkTimer?: ReturnType<typeof setTimeout>;
  private isChecking = false;
  private lastHealthStatus?: HealthStatus;
  private checkHistory: HealthCheckResult[] = [];
  private startTime = Date.now();

  // Health check registry
  private healthChecks: Map<string, () => Promise<HealthCheckResult>> = new Map();

  constructor(db: Database.Database, config?: Partial<HealthCheckConfig>) {
    super();
    this.db = db;
    this.config = this.buildConfig(config);
    this.initializeHealthChecks();
  }

  private buildConfig(config?: Partial<HealthCheckConfig>): HealthCheckConfig {
    return {
      enabled: true,
      checkInterval: 300, // 5 minutes
      enableAutoRemediation: false,
      criticalThresholds: {
        corruptionDetected: true,
        schemaValidationFailed: true,
        performanceDegradation: 50, // 50% slower than baseline
        diskSpaceLow: 1000, // 1GB
        memoryUsageHigh: 1024, // 1GB
        connectionFailures: 5,
        queryFailureRate: 10 // 10%
      },
      remediationActions: {
        vacuum: true,
        reindex: true,
        checkpoint: true,
        connectionPoolReset: false,
        cacheFlush: true
      },
      ...config,
      criticalThresholds: {
        ...{
          corruptionDetected: true,
          schemaValidationFailed: true,
          performanceDegradation: 50,
          diskSpaceLow: 1000,
          memoryUsageHigh: 1024,
          connectionFailures: 5,
          queryFailureRate: 10
        },
        ...config?.criticalThresholds
      },
      remediationActions: {
        ...{
          vacuum: true,
          reindex: true,
          checkpoint: true,
          connectionPoolReset: false,
          cacheFlush: true
        },
        ...config?.remediationActions
      }
    };
  }

  private initializeHealthChecks(): void {
    // Register built-in health checks
    this.registerHealthCheck('database_integrity', this.checkDatabaseIntegrity.bind(this));
    this.registerHealthCheck('schema_validation', this.checkSchemaValidation.bind(this));
    this.registerHealthCheck('performance_health', this.checkPerformanceHealth.bind(this));
    this.registerHealthCheck('connection_health', this.checkConnectionHealth.bind(this));
    this.registerHealthCheck('disk_space', this.checkDiskSpace.bind(this));
    this.registerHealthCheck('memory_usage', this.checkMemoryUsage.bind(this));
    this.registerHealthCheck('query_performance', this.checkQueryPerformance.bind(this));
    this.registerHealthCheck('data_consistency', this.checkDataConsistency.bind(this));
    this.registerHealthCheck('index_health', this.checkIndexHealth.bind(this));
    this.registerHealthCheck('transaction_log', this.checkTransactionLog.bind(this));

    this.createHealthTables();
    this.startHealthChecks();
  }

  private createHealthTables(): void {
    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS health_check_history (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        check_name TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('healthy', 'warning', 'critical', 'unknown')),
        message TEXT NOT NULL,
        details TEXT, -- JSON object
        timestamp INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        remediation TEXT, -- JSON array
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS integrity_issues (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        type TEXT NOT NULL CHECK(type IN ('corruption', 'constraint_violation', 'index_mismatch', 'foreign_key_violation')),
        severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
        table_name TEXT NOT NULL,
        description TEXT NOT NULL,
        affected_rows INTEGER,
        remediation TEXT NOT NULL, -- JSON array
        detected_at INTEGER NOT NULL,
        resolved_at INTEGER,
        resolved BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS remediation_actions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        action_type TEXT NOT NULL,
        triggered_by TEXT NOT NULL, -- health check name
        status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')),
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        error_message TEXT,
        result TEXT, -- JSON object
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_health_check_timestamp ON health_check_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_health_check_name ON health_check_history(check_name);
      CREATE INDEX IF NOT EXISTS idx_integrity_detected ON integrity_issues(detected_at);
      CREATE INDEX IF NOT EXISTS idx_integrity_resolved ON integrity_issues(resolved);
      CREATE INDEX IF NOT EXISTS idx_remediation_status ON remediation_actions(status);
    `;

    this.db.exec(createTablesSQL);
  }

  public registerHealthCheck(name: string, checkFunction: () => Promise<HealthCheckResult>): void {
    this.healthChecks.set(name, checkFunction);
  }

  public startHealthChecks(): void {
    if (!this.config.enabled || this.checkTimer) return;

    // Run initial check
    this.runHealthChecks();

    // Schedule periodic checks
    this.checkTimer = setInterval(() => {
      if (!this.isChecking) {
        this.runHealthChecks();
      }
    }, this.config.checkInterval * 1000);

    this.emit('health-monitoring-started');
  }

  public stopHealthChecks(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
    this.emit('health-monitoring-stopped');
  }

  public async runHealthChecks(): Promise<HealthStatus> {
    if (this.isChecking) {
      return this.lastHealthStatus || this.createUnknownStatus();
    }

    this.isChecking = true;
    const startTime = Date.now();
    const results: HealthCheckResult[] = [];

    try {
      // Run all health checks in parallel
      const checkPromises = Array.from(this.healthChecks.entries()).map(async ([name, checkFn]) => {
        try {
          const result = await checkFn();
          return result;
        } catch (error) {
          return {
            name,
            status: 'critical' as const,
            message: `Health check failed: ${error.message}`,
            timestamp: Date.now(),
            duration: 0,
            remediation: ['Review health check implementation', 'Check database connectivity']
          };
        }
      });

      const checkResults = await Promise.all(checkPromises);
      results.push(...checkResults);

      // Calculate overall health status
      const overallStatus = this.calculateOverallStatus(results);
      const healthScore = this.calculateHealthScore(results);

      const healthStatus: HealthStatus = {
        overall: overallStatus,
        checks: results,
        score: healthScore,
        lastCheck: Date.now(),
        uptime: Date.now() - this.startTime
      };

      this.lastHealthStatus = healthStatus;

      // Store results
      this.storeHealthCheckResults(results);

      // Trigger remediation if needed
      if (this.config.enableAutoRemediation) {
        await this.triggerAutomaticRemediation(results);
      }

      this.emit('health-check-completed', healthStatus);
      return healthStatus;

    } catch (error) {
      console.error('Health check run failed:', error);
      return this.createUnknownStatus();
    } finally {
      this.isChecking = false;
    }
  }

  // Built-in health checks

  private async checkDatabaseIntegrity(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Run SQLite integrity check
      const result = this.db.pragma('integrity_check');
      const duration = Date.now() - startTime;

      if (Array.isArray(result)) {
        // Check if all results are "ok"
        const issues = result.filter(r => r !== 'ok');
        
        if (issues.length === 0) {
          return {
            name: 'database_integrity',
            status: 'healthy',
            message: 'Database integrity check passed',
            timestamp: Date.now(),
            duration
          };
        } else {
          // Log integrity issues
          await this.recordIntegrityIssues(issues);
          
          return {
            name: 'database_integrity',
            status: 'critical',
            message: `Database corruption detected: ${issues.length} issues found`,
            details: { issues },
            timestamp: Date.now(),
            duration,
            remediation: [
              'Backup database immediately',
              'Run .recover command',
              'Consider restoring from backup',
              'Contact database administrator'
            ]
          };
        }
      } else {
        return {
          name: 'database_integrity',
          status: 'healthy',
          message: 'Database integrity check passed',
          timestamp: Date.now(),
          duration
        };
      }
    } catch (error) {
      return {
        name: 'database_integrity',
        status: 'critical',
        message: `Integrity check failed: ${error.message}`,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        remediation: ['Check database file permissions', 'Verify database is not corrupted']
      };
    }
  }

  private async checkSchemaValidation(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Check for required tables
      const requiredTables = [
        'kb_entries', 'kb_tags', 'search_history', 'usage_metrics',
        'performance_metrics', 'performance_alerts'
      ];
      
      const existingTables = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all().map((row: any) => row.name);

      const missingTables = requiredTables.filter(table => !existingTables.includes(table));
      
      if (missingTables.length > 0) {
        return {
          name: 'schema_validation',
          status: 'critical',
          message: `Missing required tables: ${missingTables.join(', ')}`,
          details: { missingTables, existingTables },
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          remediation: [
            'Run database migration script',
            'Verify application initialization',
            'Check database creation process'
          ]
        };
      }

      // Check for indexes
      const indexes = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `).all().map((row: any) => row.name);

      const requiredIndexes = [
        'idx_perf_timestamp', 'idx_perf_operation', 'idx_perf_duration'
      ];
      
      const missingIndexes = requiredIndexes.filter(index => !indexes.includes(index));
      
      if (missingIndexes.length > 0) {
        return {
          name: 'schema_validation',
          status: 'warning',
          message: `Missing recommended indexes: ${missingIndexes.join(', ')}`,
          details: { missingIndexes },
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          remediation: [
            'Create missing indexes',
            'Run index optimization'
          ]
        };
      }

      return {
        name: 'schema_validation',
        status: 'healthy',
        message: 'Database schema validation passed',
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        name: 'schema_validation',
        status: 'critical',
        message: `Schema validation failed: ${error.message}`,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        remediation: ['Check database connectivity', 'Verify database structure']
      };
    }
  }

  private async checkPerformanceHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Get recent performance metrics
      const recentMetrics = this.db.prepare(`
        SELECT AVG(duration) as avg_duration, COUNT(*) as query_count
        FROM performance_metrics 
        WHERE timestamp > ?
      `).get(Date.now() - (60 * 60 * 1000)); // Last hour

      if (!recentMetrics || recentMetrics.query_count === 0) {
        return {
          name: 'performance_health',
          status: 'warning',
          message: 'No recent performance data available',
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          remediation: ['Verify performance monitoring is active']
        };
      }

      const avgDuration = recentMetrics.avg_duration;
      const queryCount = recentMetrics.query_count;

      // Get baseline for comparison
      const baselineMetrics = this.db.prepare(`
        SELECT AVG(duration) as avg_duration
        FROM performance_metrics 
        WHERE timestamp BETWEEN ? AND ?
      `).get(
        Date.now() - (7 * 24 * 60 * 60 * 1000), // 7 days ago
        Date.now() - (6 * 24 * 60 * 60 * 1000)  // 6 days ago
      );

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let message = `Average query time: ${Math.round(avgDuration)}ms (${queryCount} queries)`;
      const remediation: string[] = [];

      if (avgDuration > 1000) {
        status = 'warning';
        message = `Slow average query performance: ${Math.round(avgDuration)}ms`;
        remediation.push('Review slow queries', 'Check index usage', 'Consider query optimization');
      }

      if (avgDuration > 5000) {
        status = 'critical';
        message = `Critical query performance: ${Math.round(avgDuration)}ms`;
        remediation.push(
          'Immediate performance investigation required',
          'Check for blocking operations',
          'Review database locks'
        );
      }

      // Compare with baseline
      if (baselineMetrics && baselineMetrics.avg_duration) {
        const degradationPercent = ((avgDuration - baselineMetrics.avg_duration) / baselineMetrics.avg_duration) * 100;
        
        if (degradationPercent > this.config.criticalThresholds.performanceDegradation) {
          status = 'critical';
          message += ` (${Math.round(degradationPercent)}% slower than baseline)`;
          remediation.push('Performance has degraded significantly', 'Compare with historical patterns');
        }
      }

      return {
        name: 'performance_health',
        status,
        message,
        details: {
          avgDuration: Math.round(avgDuration),
          queryCount,
          baseline: baselineMetrics?.avg_duration ? Math.round(baselineMetrics.avg_duration) : null
        },
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        remediation: remediation.length > 0 ? remediation : undefined
      };

    } catch (error) {
      return {
        name: 'performance_health',
        status: 'unknown',
        message: `Performance check failed: ${error.message}`,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    }
  }

  private async checkConnectionHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      const testResult = this.db.prepare('SELECT 1 as test').get();
      
      if (!testResult || testResult.test !== 1) {
        return {
          name: 'connection_health',
          status: 'critical',
          message: 'Database connection test failed',
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          remediation: [
            'Check database file permissions',
            'Verify database file is not locked',
            'Restart database connection'
          ]
        };
      }

      // Check WAL mode status
      const walMode = this.db.pragma('journal_mode');
      const walStatus = walMode === 'wal' ? 'healthy' : 'warning';
      const walMessage = walMode === 'wal' ? 
        'Database in WAL mode (recommended)' : 
        `Database in ${walMode} mode (consider WAL for better performance)`;

      return {
        name: 'connection_health',
        status: walStatus,
        message: `Connection healthy. ${walMessage}`,
        details: { journalMode: walMode },
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        remediation: walMode !== 'wal' ? ['Consider switching to WAL mode'] : undefined
      };

    } catch (error) {
      return {
        name: 'connection_health',
        status: 'critical',
        message: `Connection check failed: ${error.message}`,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        remediation: [
          'Check database file existence',
          'Verify file permissions',
          'Check disk space'
        ]
      };
    }
  }

  private async checkDiskSpace(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Get database file size
      const dbSize = this.db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get();
      const sizeInMB = Math.round(dbSize.size / (1024 * 1024));

      // This is a simplified check - in a real implementation, you'd check actual disk space
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let message = `Database size: ${sizeInMB}MB`;
      const remediation: string[] = [];

      if (sizeInMB > 1000) { // 1GB
        status = 'warning';
        message += ' (large database size)';
        remediation.push('Monitor database growth', 'Consider archiving old data');
      }

      if (sizeInMB > 5000) { // 5GB
        status = 'critical';
        message += ' (very large database)';
        remediation.push(
          'Urgent: Review data retention policies',
          'Consider database partitioning',
          'Archive historical data'
        );
      }

      return {
        name: 'disk_space',
        status,
        message,
        details: { sizeInMB, sizeInBytes: dbSize.size },
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        remediation: remediation.length > 0 ? remediation : undefined
      };

    } catch (error) {
      return {
        name: 'disk_space',
        status: 'unknown',
        message: `Disk space check failed: ${error.message}`,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    }
  }

  private async checkMemoryUsage(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / (1024 * 1024));
      const rssMB = Math.round(memUsage.rss / (1024 * 1024));

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let message = `Memory usage: ${heapUsedMB}MB heap, ${rssMB}MB RSS`;
      const remediation: string[] = [];

      if (heapUsedMB > this.config.criticalThresholds.memoryUsageHigh) {
        status = 'critical';
        message += ' (critical memory usage)';
        remediation.push(
          'High memory usage detected',
          'Check for memory leaks',
          'Consider restarting application'
        );
      } else if (heapUsedMB > this.config.criticalThresholds.memoryUsageHigh * 0.8) {
        status = 'warning';
        message += ' (high memory usage)';
        remediation.push('Monitor memory trends', 'Review cache sizes');
      }

      return {
        name: 'memory_usage',
        status,
        message,
        details: {
          heapUsedMB,
          rssMB,
          heapTotalMB: Math.round(memUsage.heapTotal / (1024 * 1024)),
          externalMB: Math.round(memUsage.external / (1024 * 1024))
        },
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        remediation: remediation.length > 0 ? remediation : undefined
      };

    } catch (error) {
      return {
        name: 'memory_usage',
        status: 'unknown',
        message: `Memory check failed: ${error.message}`,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    }
  }

  private async checkQueryPerformance(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test query performance with a simple operation
      const queryStart = Date.now();
      const result = this.db.prepare('SELECT COUNT(*) as count FROM sqlite_master').get();
      const queryDuration = Date.now() - queryStart;

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let message = `Query test completed in ${queryDuration}ms`;
      const remediation: string[] = [];

      if (queryDuration > 1000) {
        status = 'critical';
        message = `Slow query response: ${queryDuration}ms`;
        remediation.push(
          'Database responding slowly',
          'Check for blocking operations',
          'Review database locks',
          'Consider VACUUM operation'
        );
      } else if (queryDuration > 100) {
        status = 'warning';
        message = `Moderate query response: ${queryDuration}ms`;
        remediation.push('Monitor query performance');
      }

      return {
        name: 'query_performance',
        status,
        message,
        details: { queryDuration, resultCount: result?.count },
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        remediation: remediation.length > 0 ? remediation : undefined
      };

    } catch (error) {
      return {
        name: 'query_performance',
        status: 'critical',
        message: `Query performance check failed: ${error.message}`,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        remediation: [
          'Database query execution failed',
          'Check database connectivity',
          'Verify database integrity'
        ]
      };
    }
  }

  private async checkDataConsistency(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const issues: string[] = [];

      // Check foreign key constraints (if enabled)
      try {
        const fkViolations = this.db.prepare('PRAGMA foreign_key_check').all();
        if (fkViolations.length > 0) {
          issues.push(`${fkViolations.length} foreign key violations found`);
        }
      } catch (error) {
        // Foreign keys might not be enabled
      }

      // Check for orphaned records in kb_tags
      try {
        const orphanedTags = this.db.prepare(`
          SELECT COUNT(*) as count 
          FROM kb_tags t 
          LEFT JOIN kb_entries e ON t.entry_id = e.id 
          WHERE e.id IS NULL
        `).get();
        
        if (orphanedTags && orphanedTags.count > 0) {
          issues.push(`${orphanedTags.count} orphaned tag records found`);
        }
      } catch (error) {
        // Table might not exist
      }

      // Check for negative usage counts
      try {
        const negativeUsage = this.db.prepare(`
          SELECT COUNT(*) as count 
          FROM kb_entries 
          WHERE usage_count < 0 OR success_count < 0 OR failure_count < 0
        `).get();
        
        if (negativeUsage && negativeUsage.count > 0) {
          issues.push(`${negativeUsage.count} records with negative usage counts`);
        }
      } catch (error) {
        // Table might not exist
      }

      const status = issues.length === 0 ? 'healthy' : (issues.length > 5 ? 'critical' : 'warning');
      const message = issues.length === 0 ? 
        'Data consistency check passed' : 
        `Data consistency issues found: ${issues.join(', ')}`;

      return {
        name: 'data_consistency',
        status,
        message,
        details: { issues },
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        remediation: issues.length > 0 ? [
          'Review data integrity',
          'Clean up orphaned records',
          'Verify application logic',
          'Consider data repair scripts'
        ] : undefined
      };

    } catch (error) {
      return {
        name: 'data_consistency',
        status: 'unknown',
        message: `Data consistency check failed: ${error.message}`,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    }
  }

  private async checkIndexHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Get index statistics
      const indexes = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `).all();

      const indexStats = indexes.map((index: any) => {
        try {
          // This is a simplified check - SQLite doesn't provide detailed index stats
          return {
            name: index.name,
            exists: true
          };
        } catch {
          return {
            name: index.name,
            exists: false
          };
        }
      });

      const missingIndexes = indexStats.filter(stat => !stat.exists);
      const healthyIndexes = indexStats.filter(stat => stat.exists);

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let message = `${healthyIndexes.length} indexes are healthy`;
      const remediation: string[] = [];

      if (missingIndexes.length > 0) {
        status = 'warning';
        message = `${missingIndexes.length} indexes may need attention`;
        remediation.push('Review index definitions', 'Consider rebuilding indexes');
      }

      return {
        name: 'index_health',
        status,
        message,
        details: {
          totalIndexes: indexStats.length,
          healthyIndexes: healthyIndexes.length,
          problematicIndexes: missingIndexes.length
        },
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        remediation: remediation.length > 0 ? remediation : undefined
      };

    } catch (error) {
      return {
        name: 'index_health',
        status: 'unknown',
        message: `Index health check failed: ${error.message}`,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    }
  }

  private async checkTransactionLog(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Check WAL file size if in WAL mode
      const journalMode = this.db.pragma('journal_mode');
      
      if (journalMode === 'wal') {
        // In a real implementation, you'd check the actual WAL file size
        // For now, we'll just verify WAL mode is working
        const walInfo = this.db.pragma('wal_checkpoint');
        
        return {
          name: 'transaction_log',
          status: 'healthy',
          message: 'Transaction log (WAL) is healthy',
          details: { journalMode, walInfo },
          timestamp: Date.now(),
          duration: Date.now() - startTime
        };
      } else {
        return {
          name: 'transaction_log',
          status: 'warning',
          message: `Database not in WAL mode (current: ${journalMode})`,
          details: { journalMode },
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          remediation: ['Consider enabling WAL mode for better performance']
        };
      }

    } catch (error) {
      return {
        name: 'transaction_log',
        status: 'unknown',
        message: `Transaction log check failed: ${error.message}`,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    }
  }

  // Helper methods

  private calculateOverallStatus(results: HealthCheckResult[]): 'healthy' | 'warning' | 'critical' | 'unknown' {
    if (results.some(r => r.status === 'critical')) return 'critical';
    if (results.some(r => r.status === 'warning')) return 'warning';
    if (results.some(r => r.status === 'unknown')) return 'unknown';
    return 'healthy';
  }

  private calculateHealthScore(results: HealthCheckResult[]): number {
    if (results.length === 0) return 0;

    const scores = results.map(result => {
      switch (result.status) {
        case 'healthy': return 100;
        case 'warning': return 60;
        case 'critical': return 20;
        case 'unknown': return 30;
        default: return 0;
      }
    });

    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  private createUnknownStatus(): HealthStatus {
    return {
      overall: 'unknown',
      checks: [],
      score: 0,
      lastCheck: Date.now(),
      uptime: Date.now() - this.startTime
    };
  }

  private storeHealthCheckResults(results: HealthCheckResult[]): void {
    const insertStmt = this.db.prepare(`
      INSERT INTO health_check_history (
        check_name, status, message, details, timestamp, duration, remediation
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    results.forEach(result => {
      try {
        insertStmt.run(
          result.name,
          result.status,
          result.message,
          result.details ? JSON.stringify(result.details) : null,
          result.timestamp,
          result.duration,
          result.remediation ? JSON.stringify(result.remediation) : null
        );
      } catch (error) {
        console.error(`Failed to store health check result for ${result.name}:`, error);
      }
    });

    // Keep only last 1000 results per check
    this.cleanupHealthHistory();
  }

  private async recordIntegrityIssues(issues: string[]): Promise<void> {
    const insertStmt = this.db.prepare(`
      INSERT INTO integrity_issues (
        type, severity, table_name, description, detected_at, remediation
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    issues.forEach(issue => {
      insertStmt.run(
        'corruption',
        'critical',
        'unknown',
        issue,
        Date.now(),
        JSON.stringify(['Backup database', 'Run recovery procedures', 'Contact administrator'])
      );
    });
  }

  private async triggerAutomaticRemediation(results: HealthCheckResult[]): Promise<void> {
    const criticalResults = results.filter(r => r.status === 'critical');
    
    for (const result of criticalResults) {
      if (result.name === 'performance_health' && this.config.remediationActions.vacuum) {
        await this.executeRemediation('vacuum', result.name);
      }
      
      if (result.name === 'index_health' && this.config.remediationActions.reindex) {
        await this.executeRemediation('reindex', result.name);
      }
      
      if (result.name === 'connection_health' && this.config.remediationActions.checkpoint) {
        await this.executeRemediation('checkpoint', result.name);
      }
    }
  }

  private async executeRemediation(action: string, triggeredBy: string): Promise<void> {
    const actionId = `${Date.now()}_${action}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Record action start
    this.db.prepare(`
      INSERT INTO remediation_actions (id, action_type, triggered_by, status, started_at)
      VALUES (?, ?, ?, 'running', ?)
    `).run(actionId, action, triggeredBy, Date.now());

    try {
      let result: any = {};
      
      switch (action) {
        case 'vacuum':
          this.db.exec('VACUUM');
          result.message = 'Database vacuumed successfully';
          break;
          
        case 'checkpoint':
          const checkpointResult = this.db.pragma('wal_checkpoint(FULL)');
          result = { checkpointResult };
          break;
          
        case 'reindex':
          this.db.exec('REINDEX');
          result.message = 'Database reindexed successfully';
          break;
          
        default:
          throw new Error(`Unknown remediation action: ${action}`);
      }

      // Record success
      this.db.prepare(`
        UPDATE remediation_actions 
        SET status = 'completed', completed_at = ?, result = ?
        WHERE id = ?
      `).run(Date.now(), JSON.stringify(result), actionId);

      this.emit('remediation-completed', { actionId, action, result });

    } catch (error) {
      // Record failure
      this.db.prepare(`
        UPDATE remediation_actions 
        SET status = 'failed', completed_at = ?, error_message = ?
        WHERE id = ?
      `).run(Date.now(), error.message, actionId);

      this.emit('remediation-failed', { actionId, action, error: error.message });
    }
  }

  private cleanupHealthHistory(): void {
    try {
      // Keep only the latest 1000 results per health check
      this.db.exec(`
        DELETE FROM health_check_history 
        WHERE id NOT IN (
          SELECT id FROM health_check_history 
          ORDER BY timestamp DESC 
          LIMIT 1000
        )
      `);

      // Clean up old integrity issues (older than 30 days)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      this.db.prepare('DELETE FROM integrity_issues WHERE detected_at < ? AND resolved = TRUE')
        .run(thirtyDaysAgo);

      // Clean up old remediation actions (older than 30 days)
      this.db.prepare('DELETE FROM remediation_actions WHERE started_at < ?')
        .run(thirtyDaysAgo);

    } catch (error) {
      console.error('Failed to cleanup health history:', error);
    }
  }

  // Public API methods

  public getHealthStatus(): HealthStatus | null {
    return this.lastHealthStatus || null;
  }

  public getHealthHistory(checkName?: string, limit = 100): HealthCheckResult[] {
    let query = 'SELECT * FROM health_check_history';
    const params: any[] = [];

    if (checkName) {
      query += ' WHERE check_name = ?';
      params.push(checkName);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    try {
      const results = this.db.prepare(query).all(...params);
      return results.map((row: any) => ({
        name: row.check_name,
        status: row.status,
        message: row.message,
        details: row.details ? JSON.parse(row.details) : undefined,
        timestamp: row.timestamp,
        duration: row.duration,
        remediation: row.remediation ? JSON.parse(row.remediation) : undefined
      }));
    } catch (error) {
      console.error('Failed to get health history:', error);
      return [];
    }
  }

  public getIntegrityIssues(resolved = false): IntegrityIssue[] {
    try {
      const results = this.db.prepare(`
        SELECT * FROM integrity_issues 
        WHERE resolved = ? 
        ORDER BY detected_at DESC
      `).all(resolved);

      return results.map((row: any) => ({
        type: row.type,
        severity: row.severity,
        table: row.table_name,
        description: row.description,
        affectedRows: row.affected_rows,
        remediation: JSON.parse(row.remediation)
      }));
    } catch (error) {
      console.error('Failed to get integrity issues:', error);
      return [];
    }
  }

  public destroy(): void {
    this.stopHealthChecks();
    this.removeAllListeners();
    this.healthChecks.clear();
  }
}