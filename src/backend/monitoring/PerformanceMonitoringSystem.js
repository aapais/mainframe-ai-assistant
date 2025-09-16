"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.PerformanceMonitor = void 0;
const events_1 = require("events");
class PerformanceMonitor extends events_1.EventEmitter {
    name = 'performance-monitor';
    version = '1.0.0';
    dependencies = [];
    metricsStore;
    alertManager;
    config;
    collectors = new Map();
    alertRules = new Map();
    context;
    metricsCollectionInterval;
    healthCheckInterval;
    constructor(config) {
        super();
        this.config = config;
        this.metricsStore = new MetricsStore(config.storage);
        this.alertManager = new AlertManager(config.alerts);
        this.initializeCollectors();
        this.setupDefaultAlertRules();
    }
    async initialize(context) {
        this.context = context;
        await this.metricsStore.initialize();
        await this.alertManager.initialize();
        if (this.config.collection.enabled) {
            this.startMetricsCollection();
        }
        if (this.config.healthChecks.enabled) {
            this.startHealthChecks();
        }
        this.emit('monitor:initialized');
    }
    async shutdown() {
        if (this.metricsCollectionInterval) {
            clearInterval(this.metricsCollectionInterval);
        }
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        await this.metricsStore.shutdown();
        this.emit('monitor:shutdown');
    }
    async healthCheck() {
        const details = {};
        let healthy = true;
        try {
            details.metricsStore = await this.metricsStore.healthCheck();
            if (!details.metricsStore.healthy)
                healthy = false;
            details.alertManager = await this.alertManager.healthCheck();
            if (!details.alertManager.healthy)
                healthy = false;
            details.collectors = {};
            for (const [name, collector] of this.collectors) {
                details.collectors[name] = collector.isHealthy();
                if (!details.collectors[name])
                    healthy = false;
            }
        }
        catch (error) {
            healthy = false;
            details.error = error.message;
        }
        return {
            healthy,
            details,
            lastCheck: new Date()
        };
    }
    recordOperation(operation, success, duration, metadata) {
        const metric = {
            operation,
            success,
            duration,
            timestamp: Date.now(),
            metadata
        };
        this.metricsStore.addMetric('operations', metric);
        const collector = this.getOrCreateCollector(operation);
        collector.recordOperation(success, duration);
        this.checkOperationAlerts(operation, success, duration);
        this.emit('operation:recorded', metric);
    }
    recordError(operation, error, metadata) {
        const errorMetric = {
            operation,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            timestamp: Date.now(),
            metadata
        };
        this.metricsStore.addMetric('errors', errorMetric);
        const collector = this.getOrCreateCollector(operation);
        collector.recordError();
        this.emit('error:recorded', errorMetric);
    }
    recordSlowQuery(operation, duration, metadata) {
        const slowQueryMetric = {
            operation,
            duration,
            threshold: this.config.slowQueryThreshold,
            timestamp: Date.now(),
            metadata
        };
        this.metricsStore.addMetric('slow_queries', slowQueryMetric);
        this.triggerAlert('slow-query', 'warning', `Slow query detected: ${operation} took ${duration}ms`, slowQueryMetric);
        this.emit('slow-query:recorded', slowQueryMetric);
    }
    recordMetric(name, value, tags) {
        const metric = {
            name,
            value,
            tags: tags || {},
            timestamp: Date.now()
        };
        this.metricsStore.addMetric('custom', metric);
        this.emit('metric:recorded', metric);
    }
    recordCounter(name, increment = 1, tags) {
        const existing = this.metricsStore.getLatestMetric(`counter_${name}`);
        const newValue = (existing?.value || 0) + increment;
        this.recordMetric(`counter_${name}`, newValue, tags);
    }
    recordHistogram(name, value, tags) {
        this.recordMetric(`histogram_${name}`, value, tags);
        const histogramCollector = this.getOrCreateHistogramCollector(name);
        histogramCollector.addValue(value);
    }
    recordGauge(name, value, tags) {
        this.recordMetric(`gauge_${name}`, value, tags);
    }
    recordCacheHit(operation, layer) {
        const tags = { operation, ...(layer && { layer }) };
        this.recordCounter('cache.hits', 1, tags);
        const collector = this.getOrCreateCollector(`cache.${operation}`);
        collector.recordCacheHit();
    }
    recordCacheMiss(operation) {
        this.recordCounter('cache.misses', 1, { operation });
        const collector = this.getOrCreateCollector(`cache.${operation}`);
        collector.recordCacheMiss();
    }
    recordDatabaseQuery(query, duration, rowCount) {
        const dbMetric = {
            query: this.sanitizeQuery(query),
            duration,
            rowCount,
            timestamp: Date.now()
        };
        this.metricsStore.addMetric('database', dbMetric);
        if (duration > this.config.slowQueryThreshold) {
            this.recordSlowQuery('database.query', duration, { query });
        }
        this.emit('database:query-recorded', dbMetric);
    }
    recordConnectionPoolStats(stats) {
        this.recordGauge('database.pool.active', stats.active);
        this.recordGauge('database.pool.idle', stats.idle);
        this.recordGauge('database.pool.total', stats.total);
        this.recordGauge('database.pool.waiting', stats.waiting);
    }
    recordMemoryUsage(usage) {
        this.recordGauge('system.memory.used', usage.used);
        this.recordGauge('system.memory.total', usage.total);
        this.recordGauge('system.memory.percentage', (usage.used / usage.total) * 100);
        const percentage = (usage.used / usage.total) * 100;
        if (percentage > this.config.alerts.memoryThreshold) {
            this.triggerAlert('high-memory', 'warning', `High memory usage: ${percentage.toFixed(2)}%`, usage);
        }
    }
    recordCPUUsage(usage) {
        this.recordGauge('system.cpu.percentage', usage);
        if (usage > this.config.alerts.cpuThreshold) {
            this.triggerAlert('high-cpu', 'warning', `High CPU usage: ${usage.toFixed(2)}%`, { usage });
        }
    }
    recordDiskUsage(usage) {
        this.recordGauge('system.disk.used', usage.used);
        this.recordGauge('system.disk.total', usage.total);
        this.recordGauge('system.disk.percentage', (usage.used / usage.total) * 100);
        const percentage = (usage.used / usage.total) * 100;
        if (percentage > this.config.alerts.diskThreshold) {
            this.triggerAlert('high-disk', 'warning', `High disk usage: ${percentage.toFixed(2)}%`, usage);
        }
    }
    async getMetrics(timeRange) {
        const range = timeRange || {
            start: new Date(Date.now() - 3600000),
            end: new Date()
        };
        const operationMetrics = await this.metricsStore.getMetrics('operations', range);
        const errorMetrics = await this.metricsStore.getMetrics('errors', range);
        const slowQueryMetrics = await this.metricsStore.getMetrics('slow_queries', range);
        const customMetrics = await this.metricsStore.getMetrics('custom', range);
        return {
            timeRange: range,
            operations: this.aggregateOperationMetrics(operationMetrics),
            errors: this.aggregateErrorMetrics(errorMetrics),
            slowQueries: slowQueryMetrics.length,
            custom: this.aggregateCustomMetrics(customMetrics),
            summary: {
                totalOperations: operationMetrics.length,
                totalErrors: errorMetrics.length,
                errorRate: operationMetrics.length > 0
                    ? (errorMetrics.length / operationMetrics.length) * 100
                    : 0,
                averageResponseTime: this.calculateAverageResponseTime(operationMetrics)
            },
            generatedAt: new Date()
        };
    }
    async getOperationStats(operation) {
        const collector = this.collectors.get(operation);
        if (!collector) {
            return {
                count: 0,
                averageDuration: 0,
                minDuration: 0,
                maxDuration: 0,
                errorRate: 0,
                successRate: 0,
                throughput: 0
            };
        }
        return collector.getStats();
    }
    async getSystemHealth() {
        const systemMetrics = await this.collectSystemMetrics();
        const alerts = await this.alertManager.getActiveAlerts();
        let overallHealth = 'healthy';
        const criticalAlerts = alerts.filter(a => a.severity === 'critical');
        const warningAlerts = alerts.filter(a => a.severity === 'warning');
        if (criticalAlerts.length > 0) {
            overallHealth = 'unhealthy';
        }
        else if (warningAlerts.length > 0) {
            overallHealth = 'degraded';
        }
        return {
            overall: overallHealth,
            services: await this.getServicesHealth(),
            resources: systemMetrics,
            alerts,
            timestamp: new Date()
        };
    }
    async exportMetrics(format) {
        const metrics = await this.getMetrics();
        switch (format) {
            case 'json':
                return JSON.stringify(metrics, null, 2);
            case 'csv':
                return this.exportToCSV(metrics);
            case 'prometheus':
                return this.exportToPrometheus(metrics);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    async checkAlerts() {
        const activeAlerts = [];
        for (const [ruleId, rule] of this.alertRules) {
            const alertTriggered = await this.evaluateAlertRule(rule);
            if (alertTriggered) {
                const alert = await this.alertManager.triggerAlert(rule.type, rule.severity, rule.message, { ruleId, ...alertTriggered.data });
                activeAlerts.push(alert);
            }
        }
        return activeAlerts;
    }
    addAlertRule(rule) {
        this.alertRules.set(rule.id, rule);
    }
    removeAlertRule(ruleId) {
        this.alertRules.delete(ruleId);
    }
    getMetrics() {
        const collectorStats = Object.fromEntries(Array.from(this.collectors.entries()).map(([name, collector]) => [
            name,
            collector.getStats()
        ]));
        return {
            collectors: collectorStats,
            alertRules: this.alertRules.size,
            activeAlerts: this.alertManager.getActiveAlerts(),
            uptime: process.uptime()
        };
    }
    resetMetrics() {
        this.collectors.clear();
        this.metricsStore.clear();
    }
    initializeCollectors() {
        const defaultOperations = [
            'kb.search', 'kb.create', 'kb.update', 'kb.delete',
            'cache.get', 'cache.set', 'database.query'
        ];
        defaultOperations.forEach(operation => {
            this.collectors.set(operation, new MetricCollector(operation));
        });
    }
    setupDefaultAlertRules() {
        const defaultRules = [
            {
                id: 'high-error-rate',
                name: 'High Error Rate',
                type: 'error-rate',
                severity: 'critical',
                condition: {
                    metric: 'error_rate',
                    operator: '>',
                    threshold: 5,
                    timeWindow: 300000
                },
                message: 'Error rate is above 5% in the last 5 minutes'
            },
            {
                id: 'slow-response-time',
                name: 'Slow Response Time',
                type: 'response-time',
                severity: 'warning',
                condition: {
                    metric: 'average_response_time',
                    operator: '>',
                    threshold: 2000,
                    timeWindow: 300000
                },
                message: 'Average response time is above 2 seconds'
            },
            {
                id: 'low-cache-hit-rate',
                name: 'Low Cache Hit Rate',
                type: 'cache-performance',
                severity: 'warning',
                condition: {
                    metric: 'cache_hit_rate',
                    operator: '<',
                    threshold: 70,
                    timeWindow: 600000
                },
                message: 'Cache hit rate is below 70%'
            }
        ];
        defaultRules.forEach(rule => this.addAlertRule(rule));
    }
    getOrCreateCollector(operation) {
        if (!this.collectors.has(operation)) {
            this.collectors.set(operation, new MetricCollector(operation));
        }
        return this.collectors.get(operation);
    }
    getOrCreateHistogramCollector(name) {
        const key = `histogram_${name}`;
        if (!this.collectors.has(key)) {
            this.collectors.set(key, new HistogramCollector(name));
        }
        return this.collectors.get(key);
    }
    startMetricsCollection() {
        this.metricsCollectionInterval = setInterval(() => {
            this.collectSystemMetrics();
        }, this.config.collection.interval);
    }
    startHealthChecks() {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthChecks();
        }, this.config.healthChecks.interval);
    }
    async collectSystemMetrics() {
        const process = require('process');
        const memoryUsage = process.memoryUsage();
        const systemMetrics = {
            memory: {
                used: memoryUsage.heapUsed,
                total: memoryUsage.heapTotal,
                percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
            },
            cpu: {
                percentage: await this.getCPUUsage()
            },
            disk: {
                used: 0,
                total: 0,
                percentage: 0
            }
        };
        this.recordMemoryUsage(systemMetrics.memory);
        this.recordCPUUsage(systemMetrics.cpu.percentage);
        return systemMetrics;
    }
    async getCPUUsage() {
        const cpus = require('os').cpus();
        let totalIdle = 0;
        let totalTick = 0;
        cpus.forEach((cpu) => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        const idle = totalIdle / cpus.length;
        const total = totalTick / cpus.length;
        return 100 - (idle / total * 100);
    }
    async performHealthChecks() {
        try {
            const health = await this.getSystemHealth();
            if (health.overall === 'unhealthy') {
                this.triggerAlert('system-unhealthy', 'critical', 'System health is unhealthy', health);
            }
            else if (health.overall === 'degraded') {
                this.triggerAlert('system-degraded', 'warning', 'System health is degraded', health);
            }
        }
        catch (error) {
            this.context.logger?.error('Health check failed', error);
        }
    }
    checkOperationAlerts(operation, success, duration) {
        if (!success) {
            const collector = this.getOrCreateCollector(operation);
            const stats = collector.getStats();
            if (stats.errorRate > this.config.alerts.errorRateThreshold) {
                this.triggerAlert('high-error-rate', 'critical', `High error rate for ${operation}: ${stats.errorRate.toFixed(2)}%`, { operation, errorRate: stats.errorRate });
            }
        }
        if (duration > this.config.slowQueryThreshold) {
            this.recordSlowQuery(operation, duration);
        }
    }
    async triggerAlert(type, severity, message, data) {
        try {
            await this.alertManager.triggerAlert(type, severity, message, data);
        }
        catch (error) {
            this.context.logger?.error('Failed to trigger alert', error);
        }
    }
    sanitizeQuery(query) {
        return query.replace(/('[^']*'|"[^"]*"|\b\d{4,}\b)/g, '?');
    }
    async getServicesHealth() {
        return {};
    }
    aggregateOperationMetrics(metrics) {
        return {};
    }
    aggregateErrorMetrics(metrics) {
        return {};
    }
    aggregateCustomMetrics(metrics) {
        return {};
    }
    calculateAverageResponseTime(metrics) {
        if (metrics.length === 0)
            return 0;
        const total = metrics.reduce((sum, m) => sum + (m.duration || 0), 0);
        return total / metrics.length;
    }
    async evaluateAlertRule(rule) {
        return null;
    }
    exportToCSV(metrics) {
        return '';
    }
    exportToPrometheus(metrics) {
        return '';
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
exports.default = PerformanceMonitor;
class MetricsStore {
    config;
    metrics = new Map();
    constructor(config) {
        this.config = config;
    }
    async initialize() {
    }
    async shutdown() {
    }
    async healthCheck() {
        return { healthy: true };
    }
    addMetric(type, metric) {
        if (!this.metrics.has(type)) {
            this.metrics.set(type, []);
        }
        this.metrics.get(type).push(metric);
    }
    async getMetrics(type, timeRange) {
        const metrics = this.metrics.get(type) || [];
        return metrics.filter(m => m.timestamp >= timeRange.start.getTime() &&
            m.timestamp <= timeRange.end.getTime());
    }
    getLatestMetric(name) {
        const metrics = this.metrics.get('custom') || [];
        return metrics.filter(m => m.name === name).pop();
    }
    clear() {
        this.metrics.clear();
    }
}
class AlertManager {
    config;
    alerts = new Map();
    alertHistory = [];
    constructor(config) {
        this.config = config;
    }
    async initialize() {
    }
    async healthCheck() {
        return { healthy: true };
    }
    async triggerAlert(type, severity, message, data) {
        const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            severity,
            message,
            data,
            timestamp: new Date(),
            resolved: false
        };
        this.alerts.set(alert.id, alert);
        this.alertHistory.push(alert);
        if (this.config.notifications.enabled) {
            await this.sendNotification(alert);
        }
        return alert;
    }
    async resolveAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.resolved = true;
            alert.resolvedAt = new Date();
            this.alerts.delete(alertId);
        }
    }
    async getActiveAlerts() {
        return Array.from(this.alerts.values());
    }
    async getAlertHistory(timeRange) {
        if (!timeRange)
            return this.alertHistory;
        return this.alertHistory.filter(alert => alert.timestamp >= timeRange.start &&
            alert.timestamp <= timeRange.end);
    }
    async sendNotification(alert) {
        console.log(`ALERT [${alert.severity}]: ${alert.message}`);
    }
}
class MetricCollector {
    name;
    operationCount = 0;
    successCount = 0;
    errorCount = 0;
    totalDuration = 0;
    minDuration = Infinity;
    maxDuration = 0;
    cacheHits = 0;
    cacheMisses = 0;
    lastResetTime = Date.now();
    constructor(name) {
        this.name = name;
    }
    recordOperation(success, duration) {
        this.operationCount++;
        this.totalDuration += duration;
        this.minDuration = Math.min(this.minDuration, duration);
        this.maxDuration = Math.max(this.maxDuration, duration);
        if (success) {
            this.successCount++;
        }
        else {
            this.errorCount++;
        }
    }
    recordError() {
        this.errorCount++;
    }
    recordCacheHit() {
        this.cacheHits++;
    }
    recordCacheMiss() {
        this.cacheMisses++;
    }
    getStats() {
        const windowSeconds = (Date.now() - this.lastResetTime) / 1000;
        return {
            count: this.operationCount,
            averageDuration: this.operationCount > 0 ? this.totalDuration / this.operationCount : 0,
            minDuration: this.minDuration === Infinity ? 0 : this.minDuration,
            maxDuration: this.maxDuration,
            errorRate: this.operationCount > 0 ? (this.errorCount / this.operationCount) * 100 : 0,
            successRate: this.operationCount > 0 ? (this.successCount / this.operationCount) * 100 : 0,
            throughput: windowSeconds > 0 ? this.operationCount / windowSeconds : 0,
            cacheHitRate: (this.cacheHits + this.cacheMisses) > 0
                ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100
                : 0
        };
    }
    isHealthy() {
        const stats = this.getStats();
        return stats.errorRate < 10 && stats.averageDuration < 5000;
    }
    reset() {
        this.operationCount = 0;
        this.successCount = 0;
        this.errorCount = 0;
        this.totalDuration = 0;
        this.minDuration = Infinity;
        this.maxDuration = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.lastResetTime = Date.now();
    }
}
class HistogramCollector {
    name;
    values = [];
    buckets = new Map();
    constructor(name) {
        this.name = name;
        [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000].forEach(bucket => {
            this.buckets.set(bucket, 0);
        });
    }
    addValue(value) {
        this.values.push(value);
        for (const [bucket, count] of this.buckets) {
            if (value <= bucket) {
                this.buckets.set(bucket, count + 1);
            }
        }
        if (this.values.length > 1000) {
            this.values = this.values.slice(-1000);
        }
    }
    getStats() {
        if (this.values.length === 0) {
            return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
        }
        const sorted = [...this.values].sort((a, b) => a - b);
        const count = sorted.length;
        return {
            count,
            min: sorted[0],
            max: sorted[count - 1],
            avg: sorted.reduce((sum, val) => sum + val, 0) / count,
            p50: sorted[Math.floor(count * 0.5)],
            p95: sorted[Math.floor(count * 0.95)],
            p99: sorted[Math.floor(count * 0.99)],
            buckets: Object.fromEntries(this.buckets)
        };
    }
}
//# sourceMappingURL=PerformanceMonitoringSystem.js.map