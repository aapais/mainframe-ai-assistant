"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringSystem = exports.DashboardProvider = exports.QueryAnalyzer = exports.HealthCheck = exports.MetricsCollector = exports.PerformanceMonitor = void 0;
exports.createMonitoringSystem = createMonitoringSystem;
const events_1 = require("events");
var PerformanceMonitor_1 = require("./PerformanceMonitor");
Object.defineProperty(exports, "PerformanceMonitor", { enumerable: true, get: function () { return PerformanceMonitor_1.PerformanceMonitor; } });
var MetricsCollector_1 = require("./MetricsCollector");
Object.defineProperty(exports, "MetricsCollector", { enumerable: true, get: function () { return MetricsCollector_1.MetricsCollector; } });
var HealthCheck_1 = require("./HealthCheck");
Object.defineProperty(exports, "HealthCheck", { enumerable: true, get: function () { return HealthCheck_1.HealthCheck; } });
var QueryAnalyzer_1 = require("./QueryAnalyzer");
Object.defineProperty(exports, "QueryAnalyzer", { enumerable: true, get: function () { return QueryAnalyzer_1.QueryAnalyzer; } });
var DashboardProvider_1 = require("./DashboardProvider");
Object.defineProperty(exports, "DashboardProvider", { enumerable: true, get: function () { return DashboardProvider_1.DashboardProvider; } });
const PerformanceMonitor_2 = require("./PerformanceMonitor");
const MetricsCollector_2 = require("./MetricsCollector");
const HealthCheck_2 = require("./HealthCheck");
const QueryAnalyzer_2 = require("./QueryAnalyzer");
const DashboardProvider_2 = require("./DashboardProvider");
class MonitoringSystem extends events_1.EventEmitter {
    db;
    config;
    performanceMonitor;
    metricsCollector;
    healthCheck;
    queryAnalyzer;
    dashboardProvider;
    isInitialized = false;
    startTime = Date.now();
    constructor(db, config) {
        super();
        this.db = db;
        this.config = {
            enableAllFeatures: true,
            enablePrometheusExport: true,
            enableGrafanaIntegration: false,
            ...config
        };
        this.initializeComponents();
        this.setupEventHandlers();
    }
    initializeComponents() {
        this.performanceMonitor = new PerformanceMonitor_2.PerformanceMonitor(this.db, this.config.performance);
        this.metricsCollector = new MetricsCollector_2.MetricsCollector(this.db, this.config.metrics);
        this.healthCheck = new HealthCheck_2.HealthCheck(this.db, this.config.health);
        this.queryAnalyzer = new QueryAnalyzer_2.QueryAnalyzer(this.db, this.config.analyzer);
        this.dashboardProvider = new DashboardProvider_2.DashboardProvider(this.db, this.performanceMonitor, this.metricsCollector, this.healthCheck, this.queryAnalyzer, this.config.dashboard);
    }
    setupEventHandlers() {
        this.performanceMonitor.on('metric', (metric) => {
            this.metricsCollector.recordMetric('sqlite_query_duration_ms', metric.duration, {
                operation: metric.operation,
                connection: metric.connectionId
            });
            this.metricsCollector.recordMetric('sqlite_memory_usage_bytes', metric.memoryUsage, { connection: metric.connectionId });
            if (metric.cacheHit) {
                this.metricsCollector.recordMetric('sqlite_cache_hit_ratio', 1);
            }
            else {
                this.metricsCollector.recordMetric('sqlite_cache_hit_ratio', 0);
            }
        });
        this.performanceMonitor.on('alert', (alert) => {
            this.emit('performance-alert', alert);
        });
        this.healthCheck.on('health-check-completed', (status) => {
            this.emit('health-status-updated', status);
        });
        this.queryAnalyzer.on('query-analyzed', (analysis) => {
            this.emit('query-analyzed', analysis);
        });
        this.queryAnalyzer.on('index-recommendation', (recommendation) => {
            this.emit('index-recommendation', recommendation);
        });
        this.dashboardProvider.on('alert-triggered', (alert) => {
            this.emit('dashboard-alert', alert);
        });
        this.metricsCollector.on('alert-triggered', (alert) => {
            this.emit('metrics-alert', alert);
        });
    }
    async initialize() {
        if (this.isInitialized) {
            throw new Error('Monitoring system already initialized');
        }
        try {
            this.performanceMonitor.startMonitoring();
            this.metricsCollector.startCollection();
            this.healthCheck.startHealthChecks();
            this.dashboardProvider.startDataCollection();
            this.isInitialized = true;
            this.emit('monitoring-system-initialized');
            console.log('🎯 SQLite monitoring system initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize monitoring system:', error);
            throw error;
        }
    }
    async shutdown() {
        if (!this.isInitialized)
            return;
        try {
            this.performanceMonitor.stopMonitoring();
            this.metricsCollector.stopCollection();
            this.healthCheck.stopHealthChecks();
            this.dashboardProvider.stopDataCollection();
            this.performanceMonitor.destroy();
            this.metricsCollector.destroy();
            this.healthCheck.destroy();
            this.queryAnalyzer.destroy();
            this.dashboardProvider.destroy();
            this.isInitialized = false;
            this.removeAllListeners();
            this.emit('monitoring-system-shutdown');
            console.log('🔌 SQLite monitoring system shut down');
        }
        catch (error) {
            console.error('Error during monitoring system shutdown:', error);
            throw error;
        }
    }
    async measureQuery(operation, query, connectionId, executor, options) {
        const startTime = Date.now();
        try {
            const result = await this.performanceMonitor.measureQuery(operation, query, connectionId, executor, {
                userId: options?.userId,
                captureQueryPlan: options?.captureQueryPlan
            });
            const duration = Date.now() - startTime;
            if (options?.enableAnalysis !== false && duration > 100) {
                try {
                    this.queryAnalyzer.analyzeQuery(query, duration, {
                        timestamp: startTime,
                        operationType: operation
                    });
                }
                catch (analysisError) {
                    console.warn('Query analysis failed:', analysisError);
                }
            }
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.metricsCollector.recordMetric('sqlite_error_count', 1, {
                operation,
                error_type: error.name
            });
            throw error;
        }
    }
    recordMetric(operation, duration, options) {
        this.performanceMonitor.recordMetric(operation, duration, {
            recordsProcessed: options?.recordsProcessed,
            cacheHit: options?.cacheHit,
            indexesUsed: options?.indexesUsed
        });
        this.metricsCollector.recordMetric('sqlite_query_duration_ms', duration, {
            operation,
            connection: options?.connectionId || 'unknown'
        });
    }
    getStats() {
        const performanceStats = this.performanceMonitor.getRealTimeStatus();
        const healthStatus = this.healthCheck.getHealthStatus();
        const queryStats = this.queryAnalyzer.getAnalyzerStats();
        const dashboardMetrics = this.dashboardProvider.getCurrentMetrics();
        return {
            uptime: Date.now() - this.startTime,
            totalQueries: queryStats.totalQueries,
            slowQueries: queryStats.slowQueries,
            totalAlerts: 0,
            activeAlerts: performanceStats.activeAlerts.info +
                performanceStats.activeAlerts.warning +
                performanceStats.activeAlerts.critical,
            healthScore: healthStatus?.score || 0,
            performanceScore: performanceStats.isHealthy ? 100 :
                (performanceStats.activeAlerts.critical > 0 ? 20 : 60),
            systemStatus: this.getOverallSystemStatus()
        };
    }
    getOverallSystemStatus() {
        const performanceStatus = this.performanceMonitor.getRealTimeStatus();
        const healthStatus = this.healthCheck.getHealthStatus();
        if (!healthStatus || !performanceStatus.isHealthy) {
            return 'unknown';
        }
        if (performanceStatus.activeAlerts.critical > 0 || healthStatus.overall === 'critical') {
            return 'critical';
        }
        if (performanceStatus.activeAlerts.warning > 0 || healthStatus.overall === 'warning') {
            return 'warning';
        }
        return 'healthy';
    }
    getDashboardData() {
        return {
            metrics: this.dashboardProvider.getCurrentMetrics(),
            alerts: this.dashboardProvider.getAlertSummary(),
            capacity: this.dashboardProvider.getCapacityPlanningData(),
            health: this.healthCheck.getHealthStatus(),
            performance: this.performanceMonitor.getRealTimeStatus(),
            queries: {
                slow: this.queryAnalyzer.getSlowQueries(10),
                patterns: this.queryAnalyzer.getQueryPatterns(20),
                recommendations: this.queryAnalyzer.getIndexRecommendations()
            }
        };
    }
    exportPrometheusMetrics() {
        const performanceMetrics = this.performanceMonitor.exportPrometheusMetrics();
        const collectorMetrics = this.metricsCollector.exportPrometheusFormat();
        const dashboardMetrics = this.dashboardProvider.getPrometheusMetrics();
        return [
            '# SQLite Performance Monitoring System',
            '# Generated by MonitoringSystem',
            '',
            performanceMetrics,
            '',
            collectorMetrics,
            '',
            dashboardMetrics
        ].join('\n');
    }
    getGrafanaConfig() {
        return this.dashboardProvider.getGrafanaDataSource();
    }
    handleGrafanaQuery(query) {
        return this.dashboardProvider.handleGrafanaQuery(query);
    }
    async runHealthCheck() {
        return this.healthCheck.runHealthChecks();
    }
    generatePerformanceReport(startTime, endTime) {
        return this.performanceMonitor.generateReport(startTime, endTime);
    }
    getOptimizationRecommendations() {
        return {
            indexes: this.queryAnalyzer.getIndexRecommendations(),
            slowQueries: this.queryAnalyzer.getSlowQueries(),
            patterns: this.queryAnalyzer.getQueryPatterns()
        };
    }
    async implementIndexRecommendation(recommendationId, execute = false) {
        return this.queryAnalyzer.implementIndexRecommendation(recommendationId, execute);
    }
    get performance() {
        return this.performanceMonitor;
    }
    get metrics() {
        return this.metricsCollector;
    }
    get health() {
        return this.healthCheck;
    }
    get analyzer() {
        return this.queryAnalyzer;
    }
    get dashboard() {
        return this.dashboardProvider;
    }
}
exports.MonitoringSystem = MonitoringSystem;
function createMonitoringSystem(db, config) {
    return new MonitoringSystem(db, config);
}
exports.default = MonitoringSystem;
//# sourceMappingURL=index.js.map