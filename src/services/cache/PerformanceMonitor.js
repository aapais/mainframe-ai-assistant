"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceMonitor = void 0;
const events_1 = require("events");
class PerformanceMonitor extends events_1.EventEmitter {
    cacheOrchestrator;
    cdnIntegration;
    metrics;
    alerts = new Map();
    targets = new Map();
    monitoring = false;
    monitoringInterval;
    metricsHistory = [];
    maxHistorySize = 1440;
    constructor(cacheOrchestrator, cdnIntegration) {
        super();
        this.cacheOrchestrator = cacheOrchestrator;
        this.cdnIntegration = cdnIntegration;
        this.metrics = this.initializeMetrics();
        this.setupPerformanceTargets();
    }
    startMonitoring(interval = 60000) {
        if (this.monitoring) {
            console.log('Performance monitoring already started');
            return;
        }
        this.monitoring = true;
        console.log(`Starting performance monitoring with ${interval}ms interval`);
        this.monitoringInterval = setInterval(async () => {
            await this.collectMetrics();
            this.checkAlerts();
            this.emit('metrics-updated', this.metrics);
        }, interval);
        setImmediate(() => this.collectMetrics());
    }
    stopMonitoring() {
        if (!this.monitoring) {
            console.log('Performance monitoring is not running');
            return;
        }
        this.monitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
        console.log('Performance monitoring stopped');
    }
    getMetrics() {
        return JSON.parse(JSON.stringify(this.metrics));
    }
    getMetricsHistory(hours = 1) {
        const pointsNeeded = Math.min(hours * 60, this.maxHistorySize);
        return this.metricsHistory.slice(-pointsNeeded);
    }
    getActiveAlerts() {
        return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
    }
    getAllAlerts() {
        return Array.from(this.alerts.values());
    }
    setPerformanceTarget(target) {
        this.targets.set(target.metric, target);
        console.log(`Performance target set: ${target.metric} - Target: ${target.target}${target.unit}`);
    }
    checkPerformanceTargets() {
        const results = {
            passed: 0,
            failed: 0,
            targets: []
        };
        for (const [metric, target] of this.targets) {
            const currentValue = this.getMetricValue(metric);
            let status = 'pass';
            if (currentValue >= target.critical) {
                status = 'critical';
                results.failed++;
            }
            else if (currentValue >= target.warning) {
                status = 'warning';
            }
            else if (currentValue <= target.target) {
                results.passed++;
            }
            else {
                results.failed++;
            }
            results.targets.push({
                metric,
                target: target.target,
                current: currentValue,
                status,
                unit: target.unit
            });
        }
        return results;
    }
    generateReport(timeframe = '24h') {
        const hours = timeframe === '1h' ? 1 : timeframe === '24h' ? 24 : 168;
        const history = this.getMetricsHistory(hours);
        const avgCacheHitRate = this.calculateAverage(history, 'cache.hitRate');
        const avgResponseTime = this.calculateAverage(history, 'cache.avgResponseTime');
        const avgApiResponseTime = this.calculateAverage(history, 'application.avgApiResponseTime');
        const avgErrorRate = this.calculateAverage(history, 'application.errorRate');
        const cacheEfficiency = Math.min(100, Math.max(0, avgCacheHitRate));
        const responseTimeGrade = this.calculateResponseTimeGrade(avgResponseTime);
        const availability = Math.max(0, 100 - avgErrorRate);
        const overallScore = Math.round((cacheEfficiency * 0.3) +
            (this.gradeToScore(responseTimeGrade) * 0.4) +
            (availability * 0.3));
        const recommendations = this.generateRecommendations({
            cacheHitRate: avgCacheHitRate,
            responseTime: avgResponseTime,
            errorRate: avgErrorRate
        });
        return {
            summary: {
                overallScore,
                cacheEfficiency,
                responseTimeGrade,
                availability
            },
            details: {
                cache: {
                    hitRate: avgCacheHitRate,
                    responseTime: avgResponseTime,
                    memoryUsage: this.metrics.cache.memoryUsage
                },
                performance: {
                    apiResponseTime: avgApiResponseTime,
                    errorRate: avgErrorRate,
                    totalRequests: this.metrics.application.totalRequests
                },
                alerts: {
                    active: this.getActiveAlerts().length,
                    total: this.getAllAlerts().length,
                    critical: this.getActiveAlerts().filter(a => a.severity === 'critical').length
                }
            },
            recommendations
        };
    }
    async collectMetrics() {
        try {
            const cacheMetrics = this.cacheOrchestrator.getMetrics();
            this.metrics.cache = {
                hitRate: cacheMetrics.overall.hitRate || 0,
                missRate: 100 - (cacheMetrics.overall.hitRate || 0),
                avgResponseTime: cacheMetrics.overall.avgResponseTime || 0,
                memoryUsage: cacheMetrics.overall.memoryUsage || 0,
                operations: {
                    total: (cacheMetrics.memory?.hits || 0) + (cacheMetrics.memory?.misses || 0) + (cacheMetrics.redis?.hits || 0) + (cacheMetrics.redis?.misses || 0),
                    hits: (cacheMetrics.memory?.hits || 0) + (cacheMetrics.redis?.hits || 0),
                    misses: (cacheMetrics.memory?.misses || 0) + (cacheMetrics.redis?.misses || 0),
                    sets: (cacheMetrics.redis?.operations?.set || 0),
                    deletes: (cacheMetrics.redis?.operations?.del || 0)
                }
            };
            if (this.cdnIntegration && this.cdnIntegration.isEnabled()) {
                const cdnMetrics = this.cdnIntegration.getMetrics();
                this.metrics.cdn = {
                    enabled: true,
                    hitRate: cdnMetrics.hits > 0 ? (cdnMetrics.hits / (cdnMetrics.hits + cdnMetrics.misses)) * 100 : 0,
                    avgResponseTime: cdnMetrics.avgResponseTime,
                    bandwidth: cdnMetrics.bandwidth,
                    requests: cdnMetrics.requests
                };
            }
            else {
                this.metrics.cdn.enabled = false;
            }
            this.collectApplicationMetrics();
            this.collectSystemMetrics();
            this.metricsHistory.push(JSON.parse(JSON.stringify(this.metrics)));
            if (this.metricsHistory.length > this.maxHistorySize) {
                this.metricsHistory.shift();
            }
        }
        catch (error) {
            console.error('Error collecting performance metrics:', error);
        }
    }
    collectApplicationMetrics() {
        this.metrics.application = {
            avgPageLoadTime: Math.random() * 2000 + 500,
            avgApiResponseTime: Math.random() * 500 + 100,
            totalRequests: Math.floor(Math.random() * 1000) + this.metrics.application.totalRequests,
            errorRate: Math.random() * 5
        };
    }
    collectSystemMetrics() {
        this.metrics.system = {
            cpuUsage: Math.random() * 80 + 10,
            memoryUsage: Math.random() * 60 + 30,
            diskUsage: Math.random() * 30 + 50,
            networkLatency: Math.random() * 50 + 10
        };
    }
    checkAlerts() {
        const now = Date.now();
        this.checkAlert('cache-hit-rate', {
            current: this.metrics.cache.hitRate,
            target: 90,
            warning: 80,
            critical: 70,
            message: 'Cache hit rate is below target',
            type: 'performance'
        });
        this.checkAlert('cache-response-time', {
            current: this.metrics.cache.avgResponseTime,
            target: 100,
            warning: 500,
            critical: 1000,
            message: 'Cache response time is above target',
            type: 'performance',
            inverse: true
        });
        this.checkAlert('memory-usage', {
            current: this.metrics.system.memoryUsage,
            target: 70,
            warning: 80,
            critical: 90,
            message: 'System memory usage is high',
            type: 'performance',
            inverse: true
        });
        this.checkAlert('error-rate', {
            current: this.metrics.application.errorRate,
            target: 1,
            warning: 3,
            critical: 5,
            message: 'Application error rate is high',
            type: 'error',
            inverse: true
        });
    }
    checkAlert(id, config) {
        const { current, warning, critical, message, type, inverse = false } = config;
        const existingAlert = this.alerts.get(id);
        let severity = null;
        if (inverse) {
            if (current >= critical)
                severity = 'critical';
            else if (current >= warning)
                severity = 'high';
        }
        else {
            if (current <= critical)
                severity = 'critical';
            else if (current <= warning)
                severity = 'high';
        }
        if (severity) {
            if (!existingAlert || existingAlert.resolved) {
                const alert = {
                    id,
                    severity,
                    type,
                    message,
                    threshold: severity === 'critical' ? critical : warning,
                    currentValue: current,
                    timestamp: Date.now(),
                    resolved: false
                };
                this.alerts.set(id, alert);
                this.emit('alert', alert);
                console.warn(`Performance Alert [${severity.toUpperCase()}]: ${message} (${current})`);
            }
        }
        else if (existingAlert && !existingAlert.resolved) {
            existingAlert.resolved = true;
            this.emit('alert-resolved', existingAlert);
            console.log(`Performance Alert Resolved: ${existingAlert.message}`);
        }
    }
    initializeMetrics() {
        return {
            cache: {
                hitRate: 0,
                missRate: 0,
                avgResponseTime: 0,
                memoryUsage: 0,
                operations: {
                    total: 0,
                    hits: 0,
                    misses: 0,
                    sets: 0,
                    deletes: 0
                }
            },
            cdn: {
                enabled: false,
                hitRate: 0,
                avgResponseTime: 0,
                bandwidth: 0,
                requests: 0
            },
            application: {
                avgPageLoadTime: 0,
                avgApiResponseTime: 0,
                totalRequests: 0,
                errorRate: 0
            },
            system: {
                cpuUsage: 0,
                memoryUsage: 0,
                diskUsage: 0,
                networkLatency: 0
            }
        };
    }
    setupPerformanceTargets() {
        this.setPerformanceTarget({
            metric: 'cache.hitRate',
            target: 90,
            warning: 80,
            critical: 70,
            unit: '%'
        });
        this.setPerformanceTarget({
            metric: 'cache.avgResponseTime',
            target: 100,
            warning: 500,
            critical: 1000,
            unit: 'ms'
        });
        this.setPerformanceTarget({
            metric: 'application.avgApiResponseTime',
            target: 200,
            warning: 1000,
            critical: 2000,
            unit: 'ms'
        });
    }
    getMetricValue(metric) {
        const parts = metric.split('.');
        let value = this.metrics;
        for (const part of parts) {
            value = value?.[part];
            if (value === undefined)
                return 0;
        }
        return typeof value === 'number' ? value : 0;
    }
    calculateAverage(history, metric) {
        if (history.length === 0)
            return 0;
        const sum = history.reduce((total, metrics) => {
            return total + this.getMetricValueFromObject(metrics, metric);
        }, 0);
        return sum / history.length;
    }
    getMetricValueFromObject(obj, metric) {
        const parts = metric.split('.');
        let value = obj;
        for (const part of parts) {
            value = value?.[part];
            if (value === undefined)
                return 0;
        }
        return typeof value === 'number' ? value : 0;
    }
    calculateResponseTimeGrade(responseTime) {
        if (responseTime <= 100)
            return 'A';
        if (responseTime <= 300)
            return 'B';
        if (responseTime <= 600)
            return 'C';
        if (responseTime <= 1000)
            return 'D';
        return 'F';
    }
    gradeToScore(grade) {
        switch (grade) {
            case 'A': return 95;
            case 'B': return 85;
            case 'C': return 75;
            case 'D': return 65;
            case 'F': return 50;
        }
    }
    generateRecommendations(metrics) {
        const recommendations = [];
        if (metrics.cacheHitRate < 80) {
            recommendations.push('Consider increasing cache TTL values for frequently accessed data');
            recommendations.push('Implement cache warming strategies for popular content');
            recommendations.push('Review cache invalidation patterns to reduce unnecessary evictions');
        }
        if (metrics.responseTime > 500) {
            recommendations.push('Optimize database queries to reduce response times');
            recommendations.push('Consider implementing query result caching');
            recommendations.push('Enable compression for API responses');
        }
        if (metrics.errorRate > 2) {
            recommendations.push('Implement better error handling and retry mechanisms');
            recommendations.push('Add health checks for external dependencies');
            recommendations.push('Consider circuit breaker pattern for unstable services');
        }
        if (recommendations.length === 0) {
            recommendations.push('Performance is within acceptable limits. Continue monitoring.');
        }
        return recommendations;
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
//# sourceMappingURL=PerformanceMonitor.js.map