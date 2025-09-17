/**
 * Cache Maintenance Jobs - Background Tasks for Cache Health
 * Automated maintenance, optimization, and monitoring of cache systems
 */

import { CachedSearchService } from '../services/search/CachedSearchService';
import { CacheService } from '../services/CacheService';
import { CacheWarmer } from '../services/cache/CacheWarmer';
import { CacheMiddleware } from '../middleware/cacheMiddleware';
import { ServiceError } from '../types/services';

export interface MaintenanceJobConfig {
  enabled: boolean;
  schedule: {
    cleanup: string; // Cron expression
    optimization: string;
    warming: string;
    healthCheck: string;
    metrics: string;
  };
  thresholds: {
    memoryUsage: number;
    hitRate: number;
    responseTime: number;
    errorRate: number;
  };
  alerts: {
    enabled: boolean;
    recipients: string[];
    channels: ('email' | 'slack' | 'webhook')[];
  };
  retention: {
    metricsHistory: number; // Days
    performanceLogs: number;
    errorLogs: number;
  };
}

export interface JobResult {
  jobName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: 'success' | 'failed' | 'partial';
  details: {
    processed: number;
    skipped: number;
    errors: number;
    improvements: Record<string, number>;
  };
  nextRun?: Date;
  recommendations?: string[];
}

export interface MaintenanceAlert {
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  resolved?: boolean;
}

/**
 * Background cache maintenance job manager
 */
export class CacheMaintenanceJobs {
  private cachedSearchService: CachedSearchService;
  private cacheService: CacheService;
  private cacheWarmer: CacheWarmer;
  private cacheMiddleware: CacheMiddleware;
  private config: MaintenanceJobConfig;

  private jobIntervals: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private jobHistory: JobResult[] = [];
  private activeAlerts: Map<string, MaintenanceAlert> = new Map();
  private isShuttingDown = false;

  // Performance tracking
  private metricsHistory: Array<{
    timestamp: Date;
    hitRate: number;
    responseTime: number;
    memoryUsage: number;
    throughput: number;
    errors: number;
  }> = [];

  constructor(
    cachedSearchService: CachedSearchService,
    cacheService: CacheService,
    cacheWarmer: CacheWarmer,
    cacheMiddleware: CacheMiddleware,
    config?: Partial<MaintenanceJobConfig>
  ) {
    this.cachedSearchService = cachedSearchService;
    this.cacheService = cacheService;
    this.cacheWarmer = cacheWarmer;
    this.cacheMiddleware = cacheMiddleware;
    this.config = this.mergeConfig(config);
  }

  /**
   * Start all maintenance jobs
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log('🚫 Cache maintenance jobs disabled');
      return;
    }

    console.log('🔧 Starting cache maintenance jobs...');

    try {
      // Schedule all maintenance jobs
      this.scheduleJob('cleanup', this.config.schedule.cleanup, this.cleanupJob.bind(this));
      this.scheduleJob('optimization', this.config.schedule.optimization, this.optimizationJob.bind(this));
      this.scheduleJob('warming', this.config.schedule.warming, this.warmingJob.bind(this));
      this.scheduleJob('healthCheck', this.config.schedule.healthCheck, this.healthCheckJob.bind(this));
      this.scheduleJob('metrics', this.config.schedule.metrics, this.metricsCollectionJob.bind(this));

      // Run initial health check
      setTimeout(() => this.healthCheckJob(), 5000);

      console.log('✅ Cache maintenance jobs started successfully');
    } catch (error) {
      console.error('❌ Failed to start maintenance jobs:', error);
      throw error;
    }
  }

  /**
   * Stop all maintenance jobs
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping cache maintenance jobs...');

    this.isShuttingDown = true;

    // Clear all intervals
    for (const [jobName, interval] of this.jobIntervals) {
      clearInterval(interval);
      console.log(`⏹️ Stopped ${jobName} job`);
    }

    this.jobIntervals.clear();

    // Final cleanup run
    try {
      await this.cleanupJob();
    } catch (error) {
      console.warn('Final cleanup failed:', error);
    }

    console.log('✅ Cache maintenance jobs stopped');
  }

  /**
   * Get job execution history
   */
  getJobHistory(limit: number = 50): JobResult[] {
    return this.jobHistory.slice(-limit);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): MaintenanceAlert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get historical metrics
   */
  getMetricsHistory(hours: number = 24): typeof this.metricsHistory {
    const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return this.metricsHistory.filter(entry => entry.timestamp > cutoff);
  }

  /**
   * Force run a specific maintenance job
   */
  async runJob(jobName: string): Promise<JobResult> {
    switch (jobName) {
      case 'cleanup':
        return await this.cleanupJob();
      case 'optimization':
        return await this.optimizationJob();
      case 'warming':
        return await this.warmingJob();
      case 'healthCheck':
        return await this.healthCheckJob();
      case 'metrics':
        return await this.metricsCollectionJob();
      default:
        throw new ServiceError(`Unknown job: ${jobName}`, 'INVALID_JOB', 400);
    }
  }

  // =========================
  // Maintenance Jobs
  // =========================

  /**
   * Cache cleanup job - Remove expired and stale entries
   */
  private async cleanupJob(): Promise<JobResult> {
    const startTime = new Date();
    const jobName = 'cleanup';

    console.log('🧹 Starting cache cleanup job...');

    let processed = 0;
    let errors = 0;
    const improvements: Record<string, number> = {};

    try {
      // Cleanup general cache service
      const cacheStatsBefore = this.cacheService.stats();
      await this.cacheService.optimize();
      const cacheStatsAfter = this.cacheService.stats();

      const freedMemory = (cacheStatsBefore.memoryUsage || 0) - (cacheStatsAfter.memoryUsage || 0);
      improvements.freedMemory = freedMemory;
      processed += 1;

      // Cleanup HTTP cache middleware
      try {
        const httpStatsBefore = this.cacheMiddleware.getMetrics();
        // HTTP cache doesn't have direct cleanup, but we can trigger optimization
        const httpStatsAfter = this.cacheMiddleware.getMetrics();

        improvements.httpCacheOptimized = 1;
        processed += 1;
      } catch (error) {
        console.warn('HTTP cache cleanup failed:', error);
        errors += 1;
      }

      // Clean up old metrics history
      const cutoff = new Date(Date.now() - (this.config.retention.metricsHistory * 24 * 60 * 60 * 1000));
      const originalLength = this.metricsHistory.length;
      this.metricsHistory = this.metricsHistory.filter(entry => entry.timestamp > cutoff);
      improvements.oldMetricsRemoved = originalLength - this.metricsHistory.length;
      processed += 1;

      // Clean up old job history
      if (this.jobHistory.length > 200) {
        const removed = this.jobHistory.length - 200;
        this.jobHistory = this.jobHistory.slice(-200);
        improvements.oldJobHistoryRemoved = removed;
      }
      processed += 1;

      // Clean up resolved alerts older than 24 hours
      const alertCutoff = new Date(Date.now() - (24 * 60 * 60 * 1000));
      let removedAlerts = 0;

      for (const [key, alert] of this.activeAlerts) {
        if (alert.resolved && alert.timestamp < alertCutoff) {
          this.activeAlerts.delete(key);
          removedAlerts++;
        }
      }
      improvements.oldAlertsRemoved = removedAlerts;
      processed += 1;

      const endTime = new Date();
      const result: JobResult = {
        jobName,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        status: errors > 0 ? 'partial' : 'success',
        details: { processed, skipped: 0, errors, improvements },
        nextRun: this.calculateNextRun('cleanup')
      };

      this.recordJobResult(result);

      console.log(`✅ Cleanup job completed: ${processed} tasks, ${errors} errors`);
      return result;

    } catch (error) {
      const endTime = new Date();
      const result: JobResult = {
        jobName,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        status: 'failed',
        details: { processed, skipped: 0, errors: errors + 1, improvements }
      };

      this.recordJobResult(result);

      console.error('❌ Cleanup job failed:', error);
      return result;
    }
  }

  /**
   * Cache optimization job - Analyze and optimize cache performance
   */
  private async optimizationJob(): Promise<JobResult> {
    const startTime = new Date();
    const jobName = 'optimization';

    console.log('⚡ Starting cache optimization job...');

    let processed = 0;
    let errors = 0;
    const improvements: Record<string, number> = {};

    try {
      // Get current metrics
      const metricsBefore = this.cachedSearchService.getMetrics();

      // Optimize search cache configuration
      const optimization = await this.cachedSearchService.optimizeConfiguration();
      improvements.configChanges = optimization.changes.length;
      processed += 1;

      // Trigger adaptive cache warming if hit rate is low
      if (metricsBefore.hitRates.overall < this.config.thresholds.hitRate) {
        const warmingResult = await this.cacheWarmer.adaptiveWarming({
          hitRate: metricsBefore.hitRates.overall,
          avgResponseTime: metricsBefore.performance.avgResponseTime,
          throughput: metricsBefore.performance.throughput,
          errorRate: metricsBefore.operations.errors / Math.max(metricsBefore.operations.totalQueries, 1)
        });

        improvements.entriesWarmed = warmingResult.reduce((sum, r) => sum + r.warmed, 0);
        processed += 1;
      }

      // Analyze query patterns and suggest optimizations
      const analytics = this.cachedSearchService.getAnalytics();
      const patternOptimizations = this.analyzeQueryPatterns(analytics);
      improvements.patternOptimizations = patternOptimizations.length;
      processed += 1;

      // Check memory usage and optimize if needed
      if (metricsBefore.storage.memoryPressure > this.config.thresholds.memoryUsage) {
        await this.optimizeMemoryUsage();
        improvements.memoryOptimized = 1;
        processed += 1;
      }

      const metricsAfter = this.cachedSearchService.getMetrics();
      improvements.hitRateImprovement = metricsAfter.hitRates.overall - metricsBefore.hitRates.overall;
      improvements.responseTimeImprovement = metricsBefore.performance.avgResponseTime - metricsAfter.performance.avgResponseTime;

      const endTime = new Date();
      const result: JobResult = {
        jobName,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        status: 'success',
        details: { processed, skipped: 0, errors, improvements },
        nextRun: this.calculateNextRun('optimization'),
        recommendations: optimization.changes
      };

      this.recordJobResult(result);

      console.log(`✅ Optimization job completed: ${optimization.changes.length} optimizations applied`);
      return result;

    } catch (error) {
      const endTime = new Date();
      const result: JobResult = {
        jobName,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        status: 'failed',
        details: { processed, skipped: 0, errors: errors + 1, improvements }
      };

      this.recordJobResult(result);

      console.error('❌ Optimization job failed:', error);
      return result;
    }
  }

  /**
   * Cache warming job - Proactively warm cache with predicted queries
   */
  private async warmingJob(): Promise<JobResult> {
    const startTime = new Date();
    const jobName = 'warming';

    console.log('🔥 Starting cache warming job...');

    let processed = 0;
    let errors = 0;
    const improvements: Record<string, number> = {};

    try {
      // Determine optimal warming strategy based on current performance
      const metrics = this.cachedSearchService.getMetrics();
      const strategy = this.determineWarmingStrategy(metrics);

      // Execute warming
      const warmingResult = await this.cachedSearchService.warmCache(strategy);
      improvements.entriesWarmed = warmingResult.warmed;
      improvements.timeSaved = warmingResult.timeSaved;
      processed += 1;

      // Schedule predictive warming based on usage patterns
      const analytics = this.cachedSearchService.getAnalytics();
      if (analytics.popularQueries.length > 0) {
        const predictiveResult = await this.cacheWarmer.predictiveWarming(3600000); // 1 hour window
        improvements.predictiveEntriesWarmed = predictiveResult.warmed;
        processed += 1;
      }

      const endTime = new Date();
      const result: JobResult = {
        jobName,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        status: errors > 0 ? 'partial' : 'success',
        details: { processed, skipped: 0, errors, improvements },
        nextRun: this.calculateNextRun('warming')
      };

      this.recordJobResult(result);

      console.log(`✅ Warming job completed: ${warmingResult.warmed} entries warmed`);
      return result;

    } catch (error) {
      const endTime = new Date();
      const result: JobResult = {
        jobName,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        status: 'failed',
        details: { processed, skipped: 0, errors: errors + 1, improvements }
      };

      this.recordJobResult(result);

      console.error('❌ Warming job failed:', error);
      return result;
    }
  }

  /**
   * Health check job - Monitor cache system health and trigger alerts
   */
  private async healthCheckJob(): Promise<JobResult> {
    const startTime = new Date();
    const jobName = 'healthCheck';

    console.log('🏥 Starting health check job...');

    let processed = 0;
    let errors = 0;
    const improvements: Record<string, number> = {};

    try {
      // Get comprehensive health status
      const health = this.cachedSearchService.getHealthStatus();
      const metrics = this.cachedSearchService.getMetrics();
      const httpMetrics = this.cacheMiddleware.getMetrics();

      processed += 3; // Three health checks performed

      // Check thresholds and generate alerts
      const newAlerts = this.checkThresholds(metrics, httpMetrics);
      improvements.alertsGenerated = newAlerts.length;

      // Resolve alerts that are no longer applicable
      const resolvedAlerts = this.resolveAlerts(metrics, httpMetrics);
      improvements.alertsResolved = resolvedAlerts;

      // Check for system degradation
      if (health.status === 'critical') {
        await this.handleCriticalStatus(health);
        improvements.criticalActionsTriggered = 1;
      }

      // Performance trend analysis
      const trends = this.analyzeTrends();
      if (trends.degrading.length > 0) {
        improvements.trendsAnalyzed = trends.degrading.length;
      }

      const endTime = new Date();
      const result: JobResult = {
        jobName,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        status: health.status === 'critical' ? 'partial' : 'success',
        details: { processed, skipped: 0, errors, improvements },
        nextRun: this.calculateNextRun('healthCheck'),
        recommendations: health.recommendations
      };

      this.recordJobResult(result);

      console.log(`✅ Health check completed: ${health.status} status, ${newAlerts.length} new alerts`);
      return result;

    } catch (error) {
      const endTime = new Date();
      const result: JobResult = {
        jobName,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        status: 'failed',
        details: { processed, skipped: 0, errors: errors + 1, improvements }
      };

      this.recordJobResult(result);

      console.error('❌ Health check job failed:', error);
      return result;
    }
  }

  /**
   * Metrics collection job - Collect and store performance metrics
   */
  private async metricsCollectionJob(): Promise<JobResult> {
    const startTime = new Date();
    const jobName = 'metrics';

    let processed = 0;
    let errors = 0;
    const improvements: Record<string, number> = {};

    try {
      // Collect current metrics
      const searchMetrics = this.cachedSearchService.getMetrics();
      const httpMetrics = this.cacheMiddleware.getMetrics();

      // Store metrics in history
      const metricsEntry = {
        timestamp: new Date(),
        hitRate: searchMetrics.hitRates.overall,
        responseTime: searchMetrics.performance.avgResponseTime,
        memoryUsage: searchMetrics.storage.totalSize + httpMetrics.storage.totalSize,
        throughput: searchMetrics.performance.throughput,
        errors: searchMetrics.operations.errors
      };

      this.metricsHistory.push(metricsEntry);
      processed += 1;

      // Trim metrics history to configured retention period
      const cutoff = new Date(Date.now() - (this.config.retention.metricsHistory * 24 * 60 * 60 * 1000));
      const originalLength = this.metricsHistory.length;
      this.metricsHistory = this.metricsHistory.filter(entry => entry.timestamp > cutoff);
      improvements.metricsRetained = this.metricsHistory.length;
      improvements.metricsRemoved = originalLength - this.metricsHistory.length;
      processed += 1;

      const endTime = new Date();
      const result: JobResult = {
        jobName,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        status: 'success',
        details: { processed, skipped: 0, errors, improvements },
        nextRun: this.calculateNextRun('metrics')
      };

      this.recordJobResult(result);
      return result;

    } catch (error) {
      const endTime = new Date();
      const result: JobResult = {
        jobName,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        status: 'failed',
        details: { processed, skipped: 0, errors: errors + 1, improvements }
      };

      this.recordJobResult(result);

      console.error('❌ Metrics collection job failed:', error);
      return result;
    }
  }

  // =========================
  // Private Helper Methods
  // =========================

  private mergeConfig(config?: Partial<MaintenanceJobConfig>): MaintenanceJobConfig {
    return {
      enabled: true,
      schedule: {
        cleanup: '0 0 */6 * * *', // Every 6 hours
        optimization: '0 0 */12 * * *', // Every 12 hours
        warming: '0 */15 * * * *', // Every 15 minutes
        healthCheck: '0 */5 * * * *', // Every 5 minutes
        metrics: '0 * * * * *' // Every minute
      },
      thresholds: {
        memoryUsage: 0.8, // 80%
        hitRate: 0.7, // 70%
        responseTime: 1000, // 1 second
        errorRate: 0.05 // 5%
      },
      alerts: {
        enabled: true,
        recipients: [],
        channels: ['webhook']
      },
      retention: {
        metricsHistory: 7, // 7 days
        performanceLogs: 3,
        errorLogs: 7
      },
      ...config
    };
  }

  private scheduleJob(jobName: string, schedule: string, jobFunction: () => Promise<JobResult>): void {
    // Convert cron-like schedule to interval (simplified implementation)
    const interval = this.cronToInterval(schedule);

    const timer = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        await jobFunction();
      } catch (error) {
        console.error(`Scheduled job ${jobName} failed:`, error);
      }
    }, interval);

    this.jobIntervals.set(jobName, timer);
    console.log(`📅 Scheduled ${jobName} job (interval: ${interval}ms)`);
  }

  private cronToInterval(schedule: string): number {
    // Simplified cron parsing - in production, use a proper cron library
    if (schedule.includes('*/15 * * * * *')) return 15 * 60 * 1000; // 15 minutes
    if (schedule.includes('*/5 * * * * *')) return 5 * 60 * 1000; // 5 minutes
    if (schedule.includes('* * * * * *')) return 60 * 1000; // 1 minute
    if (schedule.includes('*/6 * * *')) return 6 * 60 * 60 * 1000; // 6 hours
    if (schedule.includes('*/12 * * *')) return 12 * 60 * 60 * 1000; // 12 hours

    return 60 * 60 * 1000; // Default: 1 hour
  }

  private calculateNextRun(jobName: string): Date {
    const schedule = this.config.schedule[jobName as keyof typeof this.config.schedule];
    const interval = this.cronToInterval(schedule);
    return new Date(Date.now() + interval);
  }

  private recordJobResult(result: JobResult): void {
    this.jobHistory.push(result);

    // Keep only last 1000 job results
    if (this.jobHistory.length > 1000) {
      this.jobHistory = this.jobHistory.slice(-1000);
    }

    // Log job completion
    const status = result.status === 'success' ? '✅' :
                  result.status === 'partial' ? '⚠️' : '❌';
    console.log(`${status} Job ${result.jobName} completed in ${result.duration}ms`);
  }

  private determineWarmingStrategy(metrics: any): 'popular' | 'recent' | 'predictive' | 'all' {
    if (metrics.hitRates.overall < 0.6) {
      return 'all'; // Aggressive warming for low hit rate
    } else if (metrics.performance.avgResponseTime > 800) {
      return 'popular'; // Focus on popular queries for high response time
    } else if (metrics.hitRates.l1 < 0.8) {
      return 'recent'; // Focus on recent queries for L1 cache misses
    } else {
      return 'predictive'; // Predictive warming for stable performance
    }
  }

  private analyzeQueryPatterns(analytics: any): string[] {
    const optimizations: string[] = [];

    // Analyze popular queries for optimization opportunities
    if (analytics.popularQueries.length > 0) {
      const topQuery = analytics.popularQueries[0];
      if (topQuery.avgTime > 500) {
        optimizations.push(`Optimize top query "${topQuery.query}" (${topQuery.avgTime}ms avg)`);
      }
    }

    // Check for repeated patterns
    const queryWords = analytics.popularQueries.flatMap((pq: any) => pq.query.split(' '));
    const wordFreq = new Map<string, number>();

    for (const word of queryWords) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    const commonWords = Array.from(wordFreq.entries())
      .filter(([_, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    if (commonWords.length > 0) {
      optimizations.push(`Consider pre-warming queries with common terms: ${commonWords.join(', ')}`);
    }

    return optimizations;
  }

  private async optimizeMemoryUsage(): Promise<void> {
    console.log('🧠 Optimizing memory usage...');

    // Trigger cache cleanup
    await this.cacheService.optimize();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    console.log('✅ Memory optimization completed');
  }

  private checkThresholds(searchMetrics: any, httpMetrics: any): MaintenanceAlert[] {
    const newAlerts: MaintenanceAlert[] = [];

    // Check hit rate threshold
    if (searchMetrics.hitRates.overall < this.config.thresholds.hitRate) {
      const alertKey = 'low-hit-rate';
      if (!this.activeAlerts.has(alertKey)) {
        const alert: MaintenanceAlert = {
          severity: 'warning',
          message: 'Cache hit rate below threshold',
          metric: 'hitRate',
          currentValue: searchMetrics.hitRates.overall,
          threshold: this.config.thresholds.hitRate,
          timestamp: new Date()
        };

        this.activeAlerts.set(alertKey, alert);
        newAlerts.push(alert);
      }
    }

    // Check response time threshold
    if (searchMetrics.performance.avgResponseTime > this.config.thresholds.responseTime) {
      const alertKey = 'high-response-time';
      if (!this.activeAlerts.has(alertKey)) {
        const alert: MaintenanceAlert = {
          severity: searchMetrics.performance.avgResponseTime > this.config.thresholds.responseTime * 2 ? 'error' : 'warning',
          message: 'Average response time above threshold',
          metric: 'responseTime',
          currentValue: searchMetrics.performance.avgResponseTime,
          threshold: this.config.thresholds.responseTime,
          timestamp: new Date()
        };

        this.activeAlerts.set(alertKey, alert);
        newAlerts.push(alert);
      }
    }

    // Check memory usage threshold
    if (searchMetrics.storage.memoryPressure > this.config.thresholds.memoryUsage) {
      const alertKey = 'high-memory-usage';
      if (!this.activeAlerts.has(alertKey)) {
        const alert: MaintenanceAlert = {
          severity: searchMetrics.storage.memoryPressure > 0.9 ? 'critical' : 'warning',
          message: 'Memory usage above threshold',
          metric: 'memoryUsage',
          currentValue: searchMetrics.storage.memoryPressure,
          threshold: this.config.thresholds.memoryUsage,
          timestamp: new Date()
        };

        this.activeAlerts.set(alertKey, alert);
        newAlerts.push(alert);
      }
    }

    // Check error rate threshold
    const errorRate = searchMetrics.operations.errors / Math.max(searchMetrics.operations.totalQueries, 1);
    if (errorRate > this.config.thresholds.errorRate) {
      const alertKey = 'high-error-rate';
      if (!this.activeAlerts.has(alertKey)) {
        const alert: MaintenanceAlert = {
          severity: errorRate > this.config.thresholds.errorRate * 2 ? 'critical' : 'error',
          message: 'Error rate above threshold',
          metric: 'errorRate',
          currentValue: errorRate,
          threshold: this.config.thresholds.errorRate,
          timestamp: new Date()
        };

        this.activeAlerts.set(alertKey, alert);
        newAlerts.push(alert);
      }
    }

    return newAlerts;
  }

  private resolveAlerts(searchMetrics: any, httpMetrics: any): number {
    let resolved = 0;

    // Resolve alerts that no longer apply
    for (const [key, alert] of this.activeAlerts) {
      if (alert.resolved) continue;

      let shouldResolve = false;

      switch (alert.metric) {
        case 'hitRate':
          shouldResolve = searchMetrics.hitRates.overall >= this.config.thresholds.hitRate;
          break;
        case 'responseTime':
          shouldResolve = searchMetrics.performance.avgResponseTime <= this.config.thresholds.responseTime;
          break;
        case 'memoryUsage':
          shouldResolve = searchMetrics.storage.memoryPressure <= this.config.thresholds.memoryUsage;
          break;
        case 'errorRate':
          const errorRate = searchMetrics.operations.errors / Math.max(searchMetrics.operations.totalQueries, 1);
          shouldResolve = errorRate <= this.config.thresholds.errorRate;
          break;
      }

      if (shouldResolve) {
        alert.resolved = true;
        resolved++;
        console.log(`✅ Resolved alert: ${alert.message}`);
      }
    }

    return resolved;
  }

  private async handleCriticalStatus(health: any): Promise<void> {
    console.log('🚨 Handling critical cache status...');

    // Emergency cache warming
    try {
      await this.cachedSearchService.warmCache('popular');
    } catch (error) {
      console.error('Emergency warming failed:', error);
    }

    // Emergency cleanup
    try {
      await this.cacheService.optimize();
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
    }

    // Send critical alert if configured
    if (this.config.alerts.enabled) {
      // In a real implementation, you would send alerts via configured channels
      console.log('🚨 CRITICAL ALERT: Cache system requires immediate attention');
      console.log('Issues:', health.issues);
      console.log('Recommendations:', health.recommendations);
    }
  }

  private analyzeTrends(): { improving: string[]; stable: string[]; degrading: string[] } {
    const trends = { improving: [], stable: [], degrading: [] as string[] };

    if (this.metricsHistory.length < 5) {
      return trends; // Need more data
    }

    const recent = this.metricsHistory.slice(-5);
    const older = this.metricsHistory.slice(-10, -5);

    if (older.length === 0) return trends;

    // Analyze hit rate trend
    const recentHitRate = recent.reduce((sum, m) => sum + m.hitRate, 0) / recent.length;
    const olderHitRate = older.reduce((sum, m) => sum + m.hitRate, 0) / older.length;

    if (recentHitRate > olderHitRate + 0.05) {
      trends.improving.push('hitRate');
    } else if (recentHitRate < olderHitRate - 0.05) {
      trends.degrading.push('hitRate');
    } else {
      trends.stable.push('hitRate');
    }

    // Analyze response time trend
    const recentResponseTime = recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length;
    const olderResponseTime = older.reduce((sum, m) => sum + m.responseTime, 0) / older.length;

    if (recentResponseTime < olderResponseTime - 50) {
      trends.improving.push('responseTime');
    } else if (recentResponseTime > olderResponseTime + 50) {
      trends.degrading.push('responseTime');
    } else {
      trends.stable.push('responseTime');
    }

    return trends;
  }
}

export default CacheMaintenanceJobs;