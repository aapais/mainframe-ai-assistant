/**
 * Metrics IPC Handler
 * 
 * Comprehensive system metrics collection, performance monitoring,
 * and health check functionality with real-time analytics.
 */

import { 
  IPCHandlerFunction,
  SystemMetricsRequest,
  SystemMetricsResponse,
  DatabaseStatusRequest,
  DatabaseStatusResponse,
  HealthCheckRequest,
  HealthCheckResponse,
  IPCErrorCode,
  BaseIPCResponse,
  SystemMetrics,
  DatabaseStatus,
  HealthStatus,
  ComponentHealth,
  ChannelMetrics
} from '../../../types/ipc';
import { DatabaseManager } from '../../../database/DatabaseManager';
import { MultiLayerCacheManager } from '../../../caching/MultiLayerCacheManager';
import { IPCSecurityManager } from '../security/IPCSecurityManager';
import { AppError } from '../../../core/errors/AppError';
import os from 'os';
import fs from 'fs';
import path from 'path';

interface SystemHealthSnapshot {
  timestamp: number;
  cpuUsage: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  diskUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  networkActivity: {
    bytesReceived: number;
    bytesSent: number;
  };
}

interface MetricsAggregator {
  hourly: Map<string, any>;
  daily: Map<string, any>;
  weekly: Map<string, any>;
}

/**
 * Advanced Metrics Handler with real-time monitoring
 */
export class MetricsHandler {
  private healthSnapshots: SystemHealthSnapshot[] = [];
  private metricsAggregator: MetricsAggregator;
  private monitoringInterval?: ReturnType<typeof setTimeout>;
  private isMonitoring = false;
  private performanceBaseline?: SystemHealthSnapshot;

  constructor(
    private dbManager: DatabaseManager,
    private cacheManager: MultiLayerCacheManager,
    private securityManager: IPCSecurityManager,
    private ipcMetrics?: () => Record<string, ChannelMetrics>
  ) {
    this.metricsAggregator = {
      hourly: new Map(),
      daily: new Map(),
      weekly: new Map()
    };

    this.startSystemMonitoring();
    this.startMetricsAggregation();
  }

  /**
   * Handle system metrics requests
   */
  handleSystemMetrics: IPCHandlerFunction<'system:metrics:get'> = async (request) => {
    const startTime = Date.now();
    
    try {
      const { scope = 'all', timeRange, aggregation = 'raw' } = request;
      
      // Check cache first for non-real-time requests
      const cacheKey = `system_metrics:${scope}:${aggregation}:${JSON.stringify(timeRange)}`;
      
      if (aggregation !== 'raw') {
        const cached = await this.cacheManager.get<SystemMetrics>(cacheKey);
        if (cached) {
          return {
            success: true,
            requestId: request.requestId,
            timestamp: Date.now(),
            executionTime: Date.now() - startTime,
            data: cached,
            metadata: {
              cached: true,
              batched: false,
              streamed: false,
              fromCache: 'memory',
              metricsAge: Date.now() - (cached as any).lastUpdated || 0,
              nextUpdateIn: this.getNextUpdateTime()
            }
          } as SystemMetricsResponse;
        }
      }

      // Collect metrics based on scope
      const metrics = await this.collectSystemMetrics(scope, timeRange, aggregation);
      
      // Cache non-real-time metrics
      if (aggregation !== 'raw') {
        await this.cacheManager.set(cacheKey, metrics, {
          ttl: this.getCacheTTLForScope(scope),
          layer: 'memory',
          tags: ['system-metrics', `scope:${scope}`]
        });
      }

      return {
        success: true,
        requestId: request.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,
        data: metrics,
        metadata: {
          cached: false,
          batched: false,
          streamed: false,
          metricsAge: 0,
          nextUpdateIn: this.getNextUpdateTime()
        }
      } as SystemMetricsResponse;

    } catch (error) {
      console.error('System metrics collection error:', error);
      return this.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.HANDLER_ERROR,
        `Failed to collect system metrics: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  };

  /**
   * Handle database status requests
   */
  handleDatabaseStatus: IPCHandlerFunction<'system:database:status'> = async (request) => {
    const startTime = Date.now();
    
    try {
      const { includeDetails = false } = request;
      
      // Get database health from manager
      const dbHealth = await this.dbManager.getHealth();
      
      // Collect additional database metrics
      const additionalMetrics = await this.collectDatabaseMetrics(includeDetails);
      
      const status: DatabaseStatus = {
        connected: dbHealth.connected,
        healthy: dbHealth.issues.length === 0,
        version: dbHealth.version,
        totalEntries: await this.getTotalKBEntries(),
        lastBackup: this.getLastBackupTime(),
        schemaVersion: await this.getSchemaVersion(),
        integrityCheck: await this.performIntegrityCheck(),
        performance: {
          averageQueryTime: dbHealth.performance.avgQueryTime,
          slowQueries: await this.countSlowQueries(),
          activeConnections: dbHealth.connections.active,
          connectionPoolHealth: this.assessConnectionPoolHealth(dbHealth.connections)
        }
      };

      return {
        success: true,
        requestId: request.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,
        data: status
      } as DatabaseStatusResponse;

    } catch (error) {
      console.error('Database status check error:', error);
      return this.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Failed to get database status: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  };

  /**
   * Handle comprehensive health checks
   */
  handleHealthCheck: IPCHandlerFunction<'system:health:check'> = async (request) => {
    const startTime = Date.now();
    
    try {
      const { includeDetails = false } = request;
      
      // Perform health checks for all components
      const [
        databaseHealth,
        cacheHealth,
        ipcHealth,
        fileSystemHealth,
        externalServicesHealth
      ] = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkCacheHealth(),
        this.checkIPCHealth(),
        this.checkFileSystemHealth(),
        this.checkExternalServicesHealth()
      ]);

      const components = {
        database: this.extractHealthResult(databaseHealth),
        cache: this.extractHealthResult(cacheHealth),
        ipc: this.extractHealthResult(ipcHealth),
        fileSystem: this.extractHealthResult(fileSystemHealth),
        externalServices: this.extractHealthResult(externalServicesHealth)
      };

      // Calculate overall health
      const healthScores = Object.values(components).map(c => this.getHealthScore(c.status));
      const overallScore = healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length;
      
      const overall = overallScore >= 80 ? 'healthy' : overallScore >= 60 ? 'warning' : 'critical';

      // Generate recommendations
      const recommendations = this.generateHealthRecommendations(components);

      const healthStatus: HealthStatus = {
        overall,
        components,
        recommendations: includeDetails ? recommendations : recommendations.slice(0, 3)
      };

      return {
        success: true,
        requestId: request.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,
        data: healthStatus
      } as HealthCheckResponse;

    } catch (error) {
      console.error('Health check error:', error);
      return this.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.HANDLER_ERROR,
        `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  };

  /**
   * Get performance report with trends and insights
   */
  async getPerformanceReport(timeframe: '1h' | '24h' | '7d' = '24h'): Promise<{
    summary: SystemMetrics;
    trends: any;
    insights: string[];
    alerts: any[];
  }> {
    const now = Date.now();
    const timeframeMs = this.parseTimeframe(timeframe);
    const snapshots = this.healthSnapshots.filter(s => now - s.timestamp <= timeframeMs);

    if (snapshots.length === 0) {
      throw new Error('Insufficient data for performance report');
    }

    // Calculate summary metrics
    const summary = await this.collectSystemMetrics('all');
    
    // Calculate trends
    const trends = this.calculateTrends(snapshots);
    
    // Generate insights
    const insights = this.generatePerformanceInsights(snapshots, trends);
    
    // Check for alerts
    const alerts = this.generatePerformanceAlerts(snapshots, trends);

    return {
      summary,
      trends,
      insights,
      alerts
    };
  }

  /**
   * Shutdown metrics collection
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Metrics Handler...');
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Clear aggregated data
    this.metricsAggregator.hourly.clear();
    this.metricsAggregator.daily.clear();
    this.metricsAggregator.weekly.clear();
    
    // Clear health snapshots (keep last 100 for graceful degradation)
    this.healthSnapshots = this.healthSnapshots.slice(-100);
    
    console.log('✅ Metrics Handler shut down successfully');
  }

  // Private methods

  private async collectSystemMetrics(
    scope: string,
    timeRange?: { start: number; end: number },
    aggregation?: string
  ): Promise<SystemMetrics> {
    const currentSnapshot = await this.getCurrentSystemSnapshot();
    
    // Database metrics
    const dbHealth = await this.dbManager.getHealth();
    const databaseMetrics = {
      totalEntries: await this.getTotalKBEntries(),
      totalSearches: await this.getTotalSearches(timeRange),
      averageQueryTime: dbHealth.performance.avgQueryTime,
      connectionPoolStatus: {
        active: dbHealth.connections.active,
        idle: dbHealth.connections.idle,
        max: dbHealth.connections.total
      },
      cacheHitRate: dbHealth.performance.cacheHitRate,
      diskUsage: {
        used: currentSnapshot.diskUsage.used,
        available: currentSnapshot.diskUsage.total - currentSnapshot.diskUsage.used,
        percentage: currentSnapshot.diskUsage.percentage
      }
    };

    // IPC metrics
    const ipcMetrics = {
      totalRequests: 0,
      totalResponses: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      errorRate: 0,
      channelMetrics: this.ipcMetrics ? this.ipcMetrics() : {}
    };

    if (this.ipcMetrics) {
      const channelData = this.ipcMetrics();
      Object.values(channelData).forEach(channel => {
        ipcMetrics.totalRequests += channel.totalRequests;
        ipcMetrics.totalErrors += channel.errorCount;
        ipcMetrics.averageResponseTime += channel.averageExecutionTime;
      });
      
      const channelCount = Object.keys(channelData).length;
      if (channelCount > 0) {
        ipcMetrics.averageResponseTime /= channelCount;
        ipcMetrics.errorRate = ipcMetrics.totalRequests > 0 ? 
          ipcMetrics.totalErrors / ipcMetrics.totalRequests : 0;
      }
      
      ipcMetrics.totalResponses = ipcMetrics.totalRequests - ipcMetrics.totalErrors;
    }

    // Cache metrics
    const cacheStats = await this.getCacheMetrics();
    
    // Performance metrics
    const performanceMetrics = {
      cpuUsage: currentSnapshot.cpuUsage,
      memoryUsage: currentSnapshot.memoryUsage,
      uptime: process.uptime(),
      responseTimePercentiles: this.calculateResponseTimePercentiles()
    };

    return {
      database: databaseMetrics,
      ipc: ipcMetrics,
      cache: cacheStats,
      performance: performanceMetrics
    };
  }

  private async getCurrentSystemSnapshot(): Promise<SystemHealthSnapshot> {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    // Calculate CPU usage (simplified)
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
      const idle = cpu.times.idle;
      return acc + (100 - (idle / total) * 100);
    }, 0) / cpus.length;

    // Get disk usage for the application directory
    const appPath = process.cwd();
    const diskUsage = await this.getDiskUsage(appPath);

    return {
      timestamp: Date.now(),
      cpuUsage: Math.round(cpuUsage * 100) / 100,
      memoryUsage: {
        used: totalMem - freeMem,
        total: totalMem,
        percentage: Math.round(((totalMem - freeMem) / totalMem) * 100)
      },
      diskUsage,
      networkActivity: {
        bytesReceived: 0, // Simplified - would need network monitoring
        bytesSent: 0
      }
    };
  }

  private async getDiskUsage(dirPath: string): Promise<{ used: number; total: number; percentage: number }> {
    try {
      const stats = await fs.promises.stat(dirPath);
      // This is a simplified version - in production you'd want to use a library like 'diskusage'
      const size = stats.size || 0;
      return {
        used: size,
        total: size * 10, // Approximation
        percentage: 10 // Approximation
      };
    } catch (error) {
      return { used: 0, total: 0, percentage: 0 };
    }
  }

  private async collectDatabaseMetrics(includeDetails: boolean): Promise<any> {
    const metrics = {
      tableStats: includeDetails ? await this.getTableStatistics() : undefined,
      indexStats: includeDetails ? await this.getIndexStatistics() : undefined,
      queryStats: includeDetails ? await this.getQueryStatistics() : undefined
    };

    return metrics;
  }

  private async getTotalKBEntries(): Promise<number> {
    try {
      const result = await this.dbManager.query<[{ count: number }]>('SELECT COUNT(*) as count FROM kb_entries');
      return result.data?.[0]?.count || 0;
    } catch (error) {
      console.warn('Failed to get total KB entries:', error);
      return 0;
    }
  }

  private async getTotalSearches(timeRange?: { start: number; end: number }): Promise<number> {
    try {
      let sql = 'SELECT COUNT(*) as count FROM search_history';
      const params: any[] = [];

      if (timeRange) {
        sql += ' WHERE timestamp BETWEEN ? AND ?';
        params.push(new Date(timeRange.start).toISOString(), new Date(timeRange.end).toISOString());
      }

      const result = await this.dbManager.query<[{ count: number }]>(sql, params);
      return result.data?.[0]?.count || 0;
    } catch (error) {
      console.warn('Failed to get total searches:', error);
      return 0;
    }
  }

  private getLastBackupTime(): number | undefined {
    // This would integrate with the backup manager
    // For now, return undefined
    return undefined;
  }

  private async getSchemaVersion(): Promise<string> {
    try {
      const result = await this.dbManager.query<[{ version: string }]>('PRAGMA user_version');
      return result.data?.[0]?.version || '1.0.0';
    } catch (error) {
      return 'unknown';
    }
  }

  private async performIntegrityCheck(): Promise<{ passed: boolean; issues?: string[] }> {
    try {
      const result = await this.dbManager.query<any[]>('PRAGMA integrity_check');
      const issues = result.data?.filter(row => row.integrity_check !== 'ok').map(row => row.integrity_check) || [];
      
      return {
        passed: issues.length === 0,
        issues: issues.length > 0 ? issues : undefined
      };
    } catch (error) {
      return {
        passed: false,
        issues: [`Integrity check failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  private async countSlowQueries(): Promise<number> {
    // This would require query logging to be enabled
    // For now, return 0
    return 0;
  }

  private assessConnectionPoolHealth(connections: { active: number; idle: number; total: number }): 'good' | 'warning' | 'critical' {
    const utilization = connections.active / connections.total;
    
    if (utilization > 0.9) return 'critical';
    if (utilization > 0.7) return 'warning';
    return 'good';
  }

  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    try {
      const dbHealth = await this.dbManager.getHealth();
      
      return {
        status: dbHealth.connected && dbHealth.issues.length === 0 ? 'healthy' : 'warning',
        message: dbHealth.issues.length > 0 ? `Issues found: ${dbHealth.issues.join(', ')}` : undefined,
        metrics: {
          connectionPoolUtilization: dbHealth.connections.active / dbHealth.connections.total,
          averageQueryTime: dbHealth.performance.avgQueryTime,
          cacheHitRate: dbHealth.performance.cacheHitRate
        },
        lastCheck: Date.now()
      };
    } catch (error) {
      return {
        status: 'critical',
        message: `Database health check failed: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: Date.now()
      };
    }
  }

  private async checkCacheHealth(): Promise<ComponentHealth> {
    try {
      const cacheMetrics = await this.getCacheMetrics();
      const hitRateThreshold = 0.5; // 50%
      
      const status = cacheMetrics.hitRate >= hitRateThreshold ? 'healthy' : 'warning';
      
      return {
        status,
        message: status === 'warning' ? `Low cache hit rate: ${(cacheMetrics.hitRate * 100).toFixed(1)}%` : undefined,
        metrics: {
          hitRate: cacheMetrics.hitRate,
          memoryUsage: cacheMetrics.memoryUsage,
          totalKeys: cacheMetrics.totalKeys
        },
        lastCheck: Date.now()
      };
    } catch (error) {
      return {
        status: 'critical',
        message: `Cache health check failed: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: Date.now()
      };
    }
  }

  private async checkIPCHealth(): Promise<ComponentHealth> {
    try {
      if (!this.ipcMetrics) {
        return {
          status: 'warning',
          message: 'IPC metrics not available',
          lastCheck: Date.now()
        };
      }

      const channelData = this.ipcMetrics();
      const totalErrors = Object.values(channelData).reduce((sum, channel) => sum + channel.errorCount, 0);
      const totalRequests = Object.values(channelData).reduce((sum, channel) => sum + channel.totalRequests, 0);
      const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
      
      const status = errorRate < 0.05 ? 'healthy' : errorRate < 0.1 ? 'warning' : 'critical';
      
      return {
        status,
        message: status !== 'healthy' ? `High IPC error rate: ${(errorRate * 100).toFixed(1)}%` : undefined,
        metrics: {
          errorRate,
          totalRequests,
          totalErrors,
          channelCount: Object.keys(channelData).length
        },
        lastCheck: Date.now()
      };
    } catch (error) {
      return {
        status: 'critical',
        message: `IPC health check failed: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: Date.now()
      };
    }
  }

  private async checkFileSystemHealth(): Promise<ComponentHealth> {
    try {
      const snapshot = await this.getCurrentSystemSnapshot();
      const diskUsageThreshold = 0.85; // 85%
      
      const status = snapshot.diskUsage.percentage / 100 < diskUsageThreshold ? 'healthy' : 'warning';
      
      return {
        status,
        message: status === 'warning' ? `High disk usage: ${snapshot.diskUsage.percentage}%` : undefined,
        metrics: {
          diskUsagePercentage: snapshot.diskUsage.percentage,
          availableSpace: snapshot.diskUsage.total - snapshot.diskUsage.used,
          totalSpace: snapshot.diskUsage.total
        },
        lastCheck: Date.now()
      };
    } catch (error) {
      return {
        status: 'critical',
        message: `File system health check failed: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: Date.now()
      };
    }
  }

  private async checkExternalServicesHealth(): Promise<ComponentHealth> {
    // For MVP1, this is mainly checking if AI service is available
    try {
      // Simple check - could be expanded to actually ping services
      const hasGeminiKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 0);
      
      return {
        status: 'healthy',
        message: !hasGeminiKey ? 'AI service not configured (optional)' : undefined,
        metrics: {
          aiServiceAvailable: hasGeminiKey ? 1 : 0,
          lastServiceCheck: Date.now()
        },
        lastCheck: Date.now()
      };
    } catch (error) {
      return {
        status: 'warning',
        message: `External services check failed: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: Date.now()
      };
    }
  }

  private async getCacheMetrics(): Promise<{
    memoryUsage: number;
    hitRate: number;
    missRate: number;
    evictionRate: number;
    totalKeys: number;
  }> {
    try {
      // This would integrate with the actual cache manager
      // For now, return mock data
      return {
        memoryUsage: 50 * 1024 * 1024, // 50MB
        hitRate: 0.75,
        missRate: 0.25,
        evictionRate: 0.05,
        totalKeys: 1000
      };
    } catch (error) {
      return {
        memoryUsage: 0,
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        totalKeys: 0
      };
    }
  }

  private calculateResponseTimePercentiles(): { p50: number; p95: number; p99: number } {
    // This would calculate from actual response time data
    // For now, return approximations based on health snapshots
    const recentSnapshots = this.healthSnapshots.slice(-100);
    
    if (recentSnapshots.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }
    
    // Simplified calculation
    return {
      p50: 100, // 100ms
      p95: 500, // 500ms
      p99: 1000 // 1s
    };
  }

  private extractHealthResult(result: PromiseSettledResult<ComponentHealth>): ComponentHealth {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    
    return {
      status: 'critical',
      message: `Health check failed: ${result.reason}`,
      lastCheck: Date.now()
    };
  }

  private getHealthScore(status: 'healthy' | 'warning' | 'critical'): number {
    switch (status) {
      case 'healthy': return 100;
      case 'warning': return 70;
      case 'critical': return 30;
      default: return 0;
    }
  }

  private generateHealthRecommendations(components: Record<string, ComponentHealth>): string[] {
    const recommendations: string[] = [];
    
    Object.entries(components).forEach(([componentName, health]) => {
      if (health.status === 'critical') {
        recommendations.push(`URGENT: ${componentName} requires immediate attention - ${health.message}`);
      } else if (health.status === 'warning') {
        recommendations.push(`Monitor ${componentName} closely - ${health.message}`);
      }
    });
    
    // System-wide recommendations
    const currentSnapshot = this.healthSnapshots[this.healthSnapshots.length - 1];
    if (currentSnapshot) {
      if (currentSnapshot.cpuUsage > 80) {
        recommendations.push('High CPU usage detected - consider optimizing performance-intensive operations');
      }
      
      if (currentSnapshot.memoryUsage.percentage > 85) {
        recommendations.push('High memory usage - consider implementing memory optimization strategies');
      }
    }
    
    return recommendations;
  }

  private calculateTrends(snapshots: SystemHealthSnapshot[]): any {
    if (snapshots.length < 2) return {};
    
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    
    return {
      cpuUsage: {
        trend: last.cpuUsage > first.cpuUsage ? 'increasing' : 'decreasing',
        change: last.cpuUsage - first.cpuUsage
      },
      memoryUsage: {
        trend: last.memoryUsage.percentage > first.memoryUsage.percentage ? 'increasing' : 'decreasing',
        change: last.memoryUsage.percentage - first.memoryUsage.percentage
      }
    };
  }

  private generatePerformanceInsights(snapshots: SystemHealthSnapshot[], trends: any): string[] {
    const insights: string[] = [];
    
    // CPU insights
    if (trends.cpuUsage?.trend === 'increasing' && trends.cpuUsage.change > 10) {
      insights.push(`CPU usage has increased by ${trends.cpuUsage.change.toFixed(1)}% - investigate high-usage processes`);
    }
    
    // Memory insights
    if (trends.memoryUsage?.trend === 'increasing' && trends.memoryUsage.change > 10) {
      insights.push(`Memory usage trending upward by ${trends.memoryUsage.change.toFixed(1)}% - check for memory leaks`);
    }
    
    // Performance baseline comparison
    if (this.performanceBaseline && snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      const cpuDiff = latest.cpuUsage - this.performanceBaseline.cpuUsage;
      
      if (Math.abs(cpuDiff) > 20) {
        insights.push(`CPU usage ${cpuDiff > 0 ? 'significantly higher' : 'lower'} than baseline`);
      }
    }
    
    return insights;
  }

  private generatePerformanceAlerts(snapshots: SystemHealthSnapshot[], trends: any): any[] {
    const alerts: any[] = [];
    
    const latest = snapshots[snapshots.length - 1];
    if (!latest) return alerts;
    
    // High resource usage alerts
    if (latest.cpuUsage > 90) {
      alerts.push({
        level: 'critical',
        message: `Critical CPU usage: ${latest.cpuUsage.toFixed(1)}%`,
        timestamp: latest.timestamp
      });
    }
    
    if (latest.memoryUsage.percentage > 90) {
      alerts.push({
        level: 'critical',
        message: `Critical memory usage: ${latest.memoryUsage.percentage}%`,
        timestamp: latest.timestamp
      });
    }
    
    return alerts;
  }

  private startSystemMonitoring(): void {
    this.isMonitoring = true;
    
    // Collect initial baseline
    this.getCurrentSystemSnapshot().then(snapshot => {
      this.performanceBaseline = snapshot;
      this.healthSnapshots.push(snapshot);
    }).catch(error => {
      console.error('Failed to collect initial system snapshot:', error);
    });

    // Monitor system health every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      if (!this.isMonitoring) return;
      
      try {
        const snapshot = await this.getCurrentSystemSnapshot();
        this.healthSnapshots.push(snapshot);
        
        // Keep only last 1000 snapshots (about 8 hours at 30s intervals)
        if (this.healthSnapshots.length > 1000) {
          this.healthSnapshots = this.healthSnapshots.slice(-1000);
        }
      } catch (error) {
        console.error('System monitoring error:', error);
      }
    }, 30000);
  }

  private startMetricsAggregation(): void {
    // Aggregate metrics every hour
    setInterval(() => {
      this.aggregateMetrics();
    }, 60 * 60 * 1000);
  }

  private aggregateMetrics(): void {
    const now = Date.now();
    const hourKey = Math.floor(now / (60 * 60 * 1000)).toString();
    
    // Aggregate hourly data from recent snapshots
    const hourlySnapshots = this.healthSnapshots.filter(
      s => Math.floor(s.timestamp / (60 * 60 * 1000)).toString() === hourKey
    );
    
    if (hourlySnapshots.length > 0) {
      const aggregated = {
        timestamp: now,
        avgCpuUsage: hourlySnapshots.reduce((sum, s) => sum + s.cpuUsage, 0) / hourlySnapshots.length,
        avgMemoryUsage: hourlySnapshots.reduce((sum, s) => sum + s.memoryUsage.percentage, 0) / hourlySnapshots.length,
        maxCpuUsage: Math.max(...hourlySnapshots.map(s => s.cpuUsage)),
        maxMemoryUsage: Math.max(...hourlySnapshots.map(s => s.memoryUsage.percentage))
      };
      
      this.metricsAggregator.hourly.set(hourKey, aggregated);
      
      // Clean up old hourly data (keep 24 hours)
      const cutoff = Math.floor((now - 24 * 60 * 60 * 1000) / (60 * 60 * 1000)).toString();
      Array.from(this.metricsAggregator.hourly.keys()).forEach(key => {
        if (key < cutoff) {
          this.metricsAggregator.hourly.delete(key);
        }
      });
    }
  }

  private parseTimeframe(timeframe: string): number {
    switch (timeframe) {
      case '1h': return 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  private getCacheTTLForScope(scope: string): number {
    switch (scope) {
      case 'performance': return 30000; // 30 seconds
      case 'database': return 60000; // 1 minute
      case 'cache': return 60000; // 1 minute
      default: return 300000; // 5 minutes
    }
  }

  private getNextUpdateTime(): number {
    // Return time until next monitoring cycle (30 seconds)
    return 30000;
  }

  private async getTableStatistics(): Promise<any> {
    try {
      const tables = ['kb_entries', 'kb_tags', 'search_history', 'usage_metrics'];
      const stats = {};
      
      for (const table of tables) {
        const result = await this.dbManager.query<[{ count: number }]>(`SELECT COUNT(*) as count FROM ${table}`);
        stats[table] = { rowCount: result.data?.[0]?.count || 0 };
      }
      
      return stats;
    } catch (error) {
      console.warn('Failed to get table statistics:', error);
      return {};
    }
  }

  private async getIndexStatistics(): Promise<any> {
    try {
      const result = await this.dbManager.query<any[]>('PRAGMA index_list(kb_entries)');
      return { indexCount: result.data?.length || 0 };
    } catch (error) {
      console.warn('Failed to get index statistics:', error);
      return {};
    }
  }

  private async getQueryStatistics(): Promise<any> {
    // This would require query logging to be enabled
    return { slowQueryCount: 0 };
  }

  private createErrorResponse(
    requestId: string,
    startTime: number,
    code: IPCErrorCode,
    message: string,
    details?: any
  ): BaseIPCResponse {
    return {
      success: false,
      requestId,
      timestamp: Date.now(),
      executionTime: Date.now() - startTime,
      error: {
        code,
        message,
        details,
        severity: 'medium',
        retryable: false
      }
    };
  }
}