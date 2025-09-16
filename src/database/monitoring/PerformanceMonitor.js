"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceMonitor = void 0;
const events_1 = require("events");
class PerformanceMonitor extends events_1.EventEmitter {
    db;
    config;
    metricsBuffer = [];
    alertsBuffer = [];
    activeConnections = new Map();
    runningQueries = new Map();
    aggregationTimer;
    cleanupTimer;
    isMonitoring = false;
    baseline = {
        avgQueryTime: 0,
        avgMemoryUsage: 0,
        avgCpuUsage: 0,
        cacheHitRate: 0,
        queryCount: 0,
        lastUpdated: 0
    };
    constructor(db, config) {
        super();
        this.db = db;
        this.config = this.buildConfig(config);
        this.initializeMonitoring();
    }
    buildConfig(config) {
        const defaultThresholds = {
            slowQueryMs: 1000,
            criticalQueryMs: 5000,
            memoryLimitMB: 512,
            cpuLimitPercent: 80,
            ioWaitLimitMs: 2000,
            cacheHitRateMin: 0.8,
            connectionTimeoutMs: 30000,
            maxConcurrentQueries: 100
        };
        const defaultRules = [
            {
                id: 'slow-query',
                name: 'Slow Query Detection',
                metric: 'query_duration',
                operator: 'gt',
                threshold: 1000,
                duration: 0,
                severity: 'warning',
                enabled: true,
                actions: ['log', 'metric']
            },
            {
                id: 'critical-query',
                name: 'Critical Query Performance',
                metric: 'query_duration',
                operator: 'gt',
                threshold: 5000,
                duration: 0,
                severity: 'critical',
                enabled: true,
                actions: ['log', 'metric', 'alert']
            },
            {
                id: 'high-memory',
                name: 'High Memory Usage',
                metric: 'memory_usage',
                operator: 'gt',
                threshold: 512 * 1024 * 1024,
                duration: 60,
                severity: 'warning',
                enabled: true,
                actions: ['log', 'metric']
            },
            {
                id: 'low-cache-hit-rate',
                name: 'Low Cache Hit Rate',
                metric: 'cache_hit_rate',
                operator: 'lt',
                threshold: 0.8,
                duration: 300,
                severity: 'warning',
                enabled: true,
                actions: ['log', 'metric']
            }
        ];
        return {
            enabled: true,
            samplingRate: 1.0,
            metricsRetentionDays: 7,
            alertRetentionDays: 30,
            slowQueryCapture: true,
            queryPlanCapture: true,
            realtimeAlerts: true,
            aggregationInterval: 60,
            batchSize: 100,
            thresholds: defaultThresholds,
            alertRules: defaultRules,
            ...config,
            thresholds: { ...defaultThresholds, ...config?.thresholds }
        };
    }
    initializeMonitoring() {
        if (!this.config.enabled)
            return;
        this.createMonitoringTables();
        this.loadBaseline();
        this.startMonitoring();
    }
    createMonitoringTables() {
        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        timestamp INTEGER NOT NULL,
        operation TEXT NOT NULL,
        query TEXT,
        duration INTEGER NOT NULL,
        records_affected INTEGER DEFAULT 0,
        memory_usage INTEGER NOT NULL,
        cpu_time INTEGER DEFAULT 0,
        io_wait_time INTEGER DEFAULT 0,
        cache_hit BOOLEAN DEFAULT FALSE,
        indexes_used TEXT, -- JSON array
        query_plan TEXT,
        connection_id TEXT NOT NULL,
        user_id TEXT,
        error_code TEXT,
        warning_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS performance_alerts (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        timestamp INTEGER NOT NULL,
        rule_id TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'critical')),
        message TEXT NOT NULL,
        value REAL NOT NULL,
        threshold REAL NOT NULL,
        duration INTEGER DEFAULT 0,
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at INTEGER,
        metadata TEXT, -- JSON object
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS query_performance_summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hour_bucket INTEGER NOT NULL, -- Unix timestamp rounded to hour
        operation TEXT NOT NULL,
        query_hash TEXT, -- Hash of normalized query
        total_count INTEGER DEFAULT 0,
        avg_duration REAL DEFAULT 0,
        min_duration INTEGER DEFAULT 0,
        max_duration INTEGER DEFAULT 0,
        p50_duration INTEGER DEFAULT 0,
        p95_duration INTEGER DEFAULT 0,
        p99_duration INTEGER DEFAULT 0,
        total_records INTEGER DEFAULT 0,
        cache_hits INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(hour_bucket, operation, query_hash)
      );

      CREATE TABLE IF NOT EXISTS connection_metrics (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        timestamp INTEGER NOT NULL,
        connection_id TEXT NOT NULL,
        connection_time INTEGER NOT NULL,
        active_queries INTEGER DEFAULT 0,
        memory_usage INTEGER NOT NULL,
        idle_time INTEGER DEFAULT 0,
        total_queries INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_perf_timestamp ON performance_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_perf_operation ON performance_metrics(operation);
      CREATE INDEX IF NOT EXISTS idx_perf_duration ON performance_metrics(duration DESC);
      CREATE INDEX IF NOT EXISTS idx_perf_connection ON performance_metrics(connection_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON performance_alerts(timestamp);
      CREATE INDEX IF NOT EXISTS idx_alerts_severity ON performance_alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON performance_alerts(resolved);
      CREATE INDEX IF NOT EXISTS idx_summary_hour ON query_performance_summary(hour_bucket);
      CREATE INDEX IF NOT EXISTS idx_connection_timestamp ON connection_metrics(timestamp);
    `;
        this.db.exec(createTableSQL);
    }
    startMonitoring() {
        if (this.isMonitoring)
            return;
        this.isMonitoring = true;
        this.aggregationTimer = setInterval(() => {
            this.processMetricsBuffer();
            this.checkAlertRules();
            this.updateBaseline();
        }, this.config.aggregationInterval * 1000);
        this.cleanupTimer = setInterval(() => {
            this.cleanupOldData();
        }, 24 * 60 * 60 * 1000);
        this.emit('monitoring-started');
    }
    stopMonitoring() {
        if (!this.isMonitoring)
            return;
        this.isMonitoring = false;
        if (this.aggregationTimer) {
            clearInterval(this.aggregationTimer);
            this.aggregationTimer = undefined;
        }
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
        this.processMetricsBuffer();
        this.emit('monitoring-stopped');
    }
    recordMetric(metric) {
        if (!this.config.enabled || Math.random() > this.config.samplingRate) {
            return;
        }
        const fullMetric = {
            ...metric,
            id: this.generateId(),
            timestamp: Date.now()
        };
        this.metricsBuffer.push(fullMetric);
        this.emit('metric', fullMetric);
        if (this.metricsBuffer.length >= this.config.batchSize) {
            this.processMetricsBuffer();
        }
        if (this.config.realtimeAlerts) {
            this.checkMetricAlerts(fullMetric);
        }
    }
    async measureQuery(operation, query, connectionId, executor, options) {
        const startTime = Date.now();
        const startMemory = process.memoryUsage().heapUsed;
        const startCpu = process.cpuUsage();
        this.runningQueries.set(connectionId, { query, startTime });
        let result;
        let error;
        let recordsAffected = 0;
        let queryPlan;
        try {
            if (this.config.queryPlanCapture && options?.captureQueryPlan) {
                queryPlan = this.captureQueryPlan(query);
            }
            result = await executor();
            if (typeof result === 'object' && result && 'length' in result) {
                recordsAffected = result.length;
            }
        }
        catch (err) {
            error = err;
            throw err;
        }
        finally {
            this.runningQueries.delete(connectionId);
            const endTime = Date.now();
            const endMemory = process.memoryUsage().heapUsed;
            const endCpu = process.cpuUsage(startCpu);
            const duration = endTime - startTime;
            const memoryDelta = endMemory - startMemory;
            const cpuTime = (endCpu.user + endCpu.system) / 1000;
            this.recordMetric({
                operation,
                query: this.config.slowQueryCapture && duration > this.config.thresholds.slowQueryMs ? query : undefined,
                duration,
                recordsAffected,
                memoryUsage: endMemory,
                cpuTime,
                ioWaitTime: 0,
                cacheHit: duration < 10,
                indexesUsed: this.extractIndexesFromPlan(queryPlan),
                queryPlan: queryPlan,
                connectionId,
                userId: options?.userId,
                errorCode: error ? error.name : undefined,
                warningCount: 0
            });
        }
        return result;
    }
    getRealtimeMetrics() {
        const now = Date.now();
        const lastMinute = now - 60000;
        const recentMetrics = this.metricsBuffer.filter(m => m.timestamp > lastMinute);
        const avgResponseTime = recentMetrics.length > 0
            ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
            : 0;
        const cacheHits = recentMetrics.filter(m => m.cacheHit).length;
        const cacheHitRate = recentMetrics.length > 0 ? cacheHits / recentMetrics.length : 0;
        const queriesPerSecond = recentMetrics.length / 60;
        const recentAlerts = this.alertsBuffer.filter(a => a.timestamp > lastMinute && !a.resolved);
        const alertsCount = {
            info: recentAlerts.filter(a => a.severity === 'info').length,
            warning: recentAlerts.filter(a => a.severity === 'warning').length,
            critical: recentAlerts.filter(a => a.severity === 'critical').length
        };
        return {
            currentConnections: this.activeConnections.size,
            activeQueries: this.runningQueries.size,
            avgResponseTime: Math.round(avgResponseTime),
            memoryUsage: process.memoryUsage().heapUsed,
            cacheHitRate: Math.round(cacheHitRate * 100) / 100,
            queriesPerSecond: Math.round(queriesPerSecond * 100) / 100,
            alertsCount
        };
    }
    getSlowQueries(limit = 10, hoursBack = 24) {
        const cutoff = Date.now() - (hoursBack * 60 * 60 * 1000);
        try {
            const results = this.db.prepare(`
        SELECT 
          operation,
          query,
          AVG(duration) as avg_duration,
          COUNT(*) as count,
          MAX(timestamp) as last_seen,
          query_plan
        FROM performance_metrics 
        WHERE timestamp > ? 
          AND duration > ?
          AND query IS NOT NULL
        GROUP BY operation, query
        ORDER BY avg_duration DESC
        LIMIT ?
      `).all(cutoff, this.config.thresholds.slowQueryMs, limit);
            return results.map((row) => ({
                query: row.query,
                operation: row.operation,
                avgDuration: Math.round(row.avg_duration),
                count: row.count,
                lastSeen: row.last_seen,
                queryPlan: row.query_plan
            }));
        }
        catch (error) {
            console.error('Failed to get slow queries:', error);
            return [];
        }
    }
    getPerformanceTrends(hoursBack = 24) {
        const cutoff = Date.now() - (hoursBack * 60 * 60 * 1000);
        const bucketSize = (hoursBack * 60 * 60 * 1000) / 50;
        try {
            const results = this.db.prepare(`
        SELECT 
          (timestamp / ?) * ? as bucket,
          AVG(duration) as avg_duration,
          COUNT(*) as count,
          AVG(memory_usage) as avg_memory,
          AVG(CASE WHEN cache_hit THEN 1.0 ELSE 0.0 END) as cache_hit_rate,
          AVG(CASE WHEN error_code IS NOT NULL THEN 1.0 ELSE 0.0 END) as error_rate
        FROM performance_metrics 
        WHERE timestamp > ?
        GROUP BY bucket
        ORDER BY bucket
      `).all(bucketSize, bucketSize, cutoff);
            const trends = {
                responseTime: [],
                throughput: [],
                memoryUsage: [],
                cacheHitRate: [],
                errorRate: []
            };
            results.forEach((row) => {
                const timestamp = Math.round(row.bucket);
                trends.responseTime.push({ timestamp, value: Math.round(row.avg_duration) });
                trends.throughput.push({ timestamp, value: row.count });
                trends.memoryUsage.push({ timestamp, value: Math.round(row.avg_memory) });
                trends.cacheHitRate.push({ timestamp, value: Math.round(row.cache_hit_rate * 100) / 100 });
                trends.errorRate.push({ timestamp, value: Math.round(row.error_rate * 100) / 100 });
            });
            return trends;
        }
        catch (error) {
            console.error('Failed to get performance trends:', error);
            return {
                responseTime: [],
                throughput: [],
                memoryUsage: [],
                cacheHitRate: [],
                errorRate: []
            };
        }
    }
    processMetricsBuffer() {
        if (this.metricsBuffer.length === 0)
            return;
        const metrics = this.metricsBuffer.splice(0);
        try {
            const insertStmt = this.db.prepare(`
        INSERT INTO performance_metrics (
          timestamp, operation, query, duration, records_affected,
          memory_usage, cpu_time, io_wait_time, cache_hit, indexes_used,
          query_plan, connection_id, user_id, error_code, warning_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            const transaction = this.db.transaction((metrics) => {
                metrics.forEach(metric => {
                    insertStmt.run(metric.timestamp, metric.operation, metric.query, metric.duration, metric.recordsAffected, metric.memoryUsage, metric.cpuTime, metric.ioWaitTime, metric.cacheHit, JSON.stringify(metric.indexesUsed), metric.queryPlan, metric.connectionId, metric.userId, metric.errorCode, metric.warningCount);
                });
            });
            transaction(metrics);
            this.updateHourlySummaries(metrics);
        }
        catch (error) {
            console.error('Failed to process metrics buffer:', error);
            this.metricsBuffer.unshift(...metrics);
        }
    }
    updateHourlySummaries(metrics) {
        const summaries = new Map();
        metrics.forEach(metric => {
            const hourBucket = Math.floor(metric.timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
            const queryHash = this.hashQuery(metric.query || '');
            const key = `${hourBucket}-${metric.operation}-${queryHash}`;
            if (!summaries.has(key)) {
                summaries.set(key, {
                    hour_bucket: hourBucket,
                    operation: metric.operation,
                    query_hash: queryHash,
                    durations: [],
                    total_records: 0,
                    cache_hits: 0,
                    error_count: 0
                });
            }
            const summary = summaries.get(key);
            summary.durations.push(metric.duration);
            summary.total_records += metric.recordsAffected;
            if (metric.cacheHit)
                summary.cache_hits++;
            if (metric.errorCode)
                summary.error_count++;
        });
        const upsertStmt = this.db.prepare(`
      INSERT INTO query_performance_summary (
        hour_bucket, operation, query_hash, total_count, avg_duration,
        min_duration, max_duration, p50_duration, p95_duration, p99_duration,
        total_records, cache_hits, error_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(hour_bucket, operation, query_hash) DO UPDATE SET
        total_count = total_count + excluded.total_count,
        avg_duration = (avg_duration * total_count + excluded.avg_duration * excluded.total_count) / (total_count + excluded.total_count),
        min_duration = MIN(min_duration, excluded.min_duration),
        max_duration = MAX(max_duration, excluded.max_duration),
        total_records = total_records + excluded.total_records,
        cache_hits = cache_hits + excluded.cache_hits,
        error_count = error_count + excluded.error_count
    `);
        summaries.forEach(summary => {
            const durations = summary.durations.sort((a, b) => a - b);
            const count = durations.length;
            const p50 = durations[Math.floor(count * 0.5)];
            const p95 = durations[Math.floor(count * 0.95)];
            const p99 = durations[Math.floor(count * 0.99)];
            const avg = durations.reduce((sum, d) => sum + d, 0) / count;
            upsertStmt.run(summary.hour_bucket, summary.operation, summary.query_hash, count, avg, Math.min(...durations), Math.max(...durations), p50, p95, p99, summary.total_records, summary.cache_hits, summary.error_count);
        });
    }
    checkAlertRules() {
        this.config.alertRules
            .filter(rule => rule.enabled)
            .forEach(rule => this.evaluateAlertRule(rule));
    }
    evaluateAlertRule(rule) {
        const now = Date.now();
        const cutoff = now - (rule.duration * 1000);
        let currentValue;
        switch (rule.metric) {
            case 'query_duration':
                const recentMetrics = this.metricsBuffer.filter(m => m.timestamp > cutoff);
                currentValue = recentMetrics.length > 0
                    ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
                    : 0;
                break;
            case 'memory_usage':
                currentValue = process.memoryUsage().heapUsed;
                break;
            case 'cache_hit_rate':
                const metrics = this.metricsBuffer.filter(m => m.timestamp > cutoff);
                const hits = metrics.filter(m => m.cacheHit).length;
                currentValue = metrics.length > 0 ? hits / metrics.length : 1;
                break;
            default:
                return;
        }
        const shouldAlert = this.checkThreshold(currentValue, rule.operator, rule.threshold);
        if (shouldAlert) {
            this.createAlert(rule, currentValue, now);
        }
    }
    checkThreshold(value, operator, threshold) {
        switch (operator) {
            case 'gt': return value > threshold;
            case 'gte': return value >= threshold;
            case 'lt': return value < threshold;
            case 'lte': return value <= threshold;
            case 'eq': return value === threshold;
            default: return false;
        }
    }
    createAlert(rule, value, timestamp) {
        const alert = {
            id: this.generateId(),
            timestamp,
            ruleId: rule.id,
            severity: rule.severity,
            message: `${rule.name}: ${rule.metric} ${rule.operator} ${rule.threshold} (current: ${value})`,
            value,
            threshold: rule.threshold,
            duration: rule.duration,
            resolved: false,
            metadata: { rule: rule.name }
        };
        this.alertsBuffer.push(alert);
        if (alert.severity === 'critical') {
            this.persistAlert(alert);
        }
        this.emit('alert', alert);
    }
    persistAlert(alert) {
        try {
            this.db.prepare(`
        INSERT INTO performance_alerts (
          timestamp, rule_id, severity, message, value, threshold,
          duration, resolved, resolved_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(alert.timestamp, alert.ruleId, alert.severity, alert.message, alert.value, alert.threshold, alert.duration, alert.resolved, alert.resolvedAt, JSON.stringify(alert.metadata));
        }
        catch (error) {
            console.error('Failed to persist alert:', error);
        }
    }
    checkMetricAlerts(metric) {
        if (metric.duration > this.config.thresholds.criticalQueryMs) {
            const alert = {
                id: this.generateId(),
                timestamp: metric.timestamp,
                ruleId: 'critical-query-immediate',
                severity: 'critical',
                message: `Critical query performance: ${metric.operation} took ${metric.duration}ms`,
                value: metric.duration,
                threshold: this.config.thresholds.criticalQueryMs,
                duration: 0,
                resolved: false,
                metadata: { operation: metric.operation, connectionId: metric.connectionId }
            };
            this.alertsBuffer.push(alert);
            this.emit('alert', alert);
        }
    }
    loadBaseline() {
        try {
            const result = this.db.prepare(`
        SELECT 
          AVG(duration) as avg_query_time,
          AVG(memory_usage) as avg_memory_usage,
          AVG(CASE WHEN cache_hit THEN 1.0 ELSE 0.0 END) as cache_hit_rate,
          COUNT(*) as query_count
        FROM performance_metrics 
        WHERE timestamp > ?
      `).get(Date.now() - (7 * 24 * 60 * 60 * 1000));
            if (result) {
                this.baseline = {
                    avgQueryTime: result.avg_query_time || 0,
                    avgMemoryUsage: result.avg_memory_usage || 0,
                    avgCpuUsage: 0,
                    cacheHitRate: result.cache_hit_rate || 0,
                    queryCount: result.query_count || 0,
                    lastUpdated: Date.now()
                };
            }
        }
        catch (error) {
            console.error('Failed to load baseline:', error);
        }
    }
    updateBaseline() {
        if (Date.now() - this.baseline.lastUpdated < 24 * 60 * 60 * 1000) {
            return;
        }
        this.loadBaseline();
    }
    cleanupOldData() {
        const metricsRetention = Date.now() - (this.config.metricsRetentionDays * 24 * 60 * 60 * 1000);
        const alertsRetention = Date.now() - (this.config.alertRetentionDays * 24 * 60 * 60 * 1000);
        try {
            const deleteMetrics = this.db.prepare('DELETE FROM performance_metrics WHERE timestamp < ?');
            const deleteAlerts = this.db.prepare('DELETE FROM performance_alerts WHERE timestamp < ?');
            const deleteSummaries = this.db.prepare('DELETE FROM query_performance_summary WHERE hour_bucket < ?');
            deleteMetrics.run(metricsRetention);
            deleteAlerts.run(alertsRetention);
            deleteSummaries.run(metricsRetention);
            this.db.exec('VACUUM');
        }
        catch (error) {
            console.error('Failed to cleanup old data:', error);
        }
    }
    captureQueryPlan(query) {
        try {
            const plan = this.db.prepare(`EXPLAIN QUERY PLAN ${query}`).all();
            return JSON.stringify(plan);
        }
        catch {
            return undefined;
        }
    }
    extractIndexesFromPlan(queryPlan) {
        if (!queryPlan)
            return [];
        try {
            const plan = JSON.parse(queryPlan);
            const indexes = [];
            plan.forEach((step) => {
                if (step.detail && step.detail.includes('USING INDEX')) {
                    const match = step.detail.match(/USING INDEX (\w+)/);
                    if (match) {
                        indexes.push(match[1]);
                    }
                }
            });
            return indexes;
        }
        catch {
            return [];
        }
    }
    hashQuery(query) {
        let hash = 0;
        for (let i = 0; i < query.length; i++) {
            const char = query.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    exportPrometheusMetrics() {
        const metrics = this.getRealtimeMetrics();
        return [
            `# HELP sqlite_query_duration_seconds Query execution time`,
            `# TYPE sqlite_query_duration_seconds gauge`,
            `sqlite_query_duration_seconds ${metrics.avgResponseTime / 1000}`,
            ``,
            `# HELP sqlite_cache_hit_ratio Cache hit ratio`,
            `# TYPE sqlite_cache_hit_ratio gauge`,
            `sqlite_cache_hit_ratio ${metrics.cacheHitRate}`,
            ``,
            `# HELP sqlite_memory_usage_bytes Memory usage`,
            `# TYPE sqlite_memory_usage_bytes gauge`,
            `sqlite_memory_usage_bytes ${metrics.memoryUsage}`,
            ``,
            `# HELP sqlite_queries_per_second Queries per second`,
            `# TYPE sqlite_queries_per_second gauge`,
            `sqlite_queries_per_second ${metrics.queriesPerSecond}`,
            ``,
            `# HELP sqlite_active_connections Active connections`,
            `# TYPE sqlite_active_connections gauge`,
            `sqlite_active_connections ${metrics.currentConnections}`,
            ``,
            `# HELP sqlite_active_queries Active queries`,
            `# TYPE sqlite_active_queries gauge`,
            `sqlite_active_queries ${metrics.activeQueries}`
        ].join('\n');
    }
    destroy() {
        this.stopMonitoring();
        this.removeAllListeners();
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
//# sourceMappingURL=PerformanceMonitor.js.map