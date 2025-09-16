"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MONITORING_CONFIG = exports.MonitoringOrchestrator = void 0;
const SearchPerformanceMonitor_1 = require("./SearchPerformanceMonitor");
const MonitoringDashboard_1 = require("./MonitoringDashboard");
const AlertingEngine_1 = require("./AlertingEngine");
const SearchLogger_1 = require("./SearchLogger");
const PerformanceProfiler_1 = require("./PerformanceProfiler");
const events_1 = require("events");
class MonitoringOrchestrator extends events_1.EventEmitter {
    performanceMonitor;
    dashboard;
    alertingEngine;
    logger;
    profiler;
    config;
    isStarted = false;
    dashboardInterval;
    constructor(config) {
        super();
        this.config = config;
        this.initializeComponents();
        this.setupEventHandlers();
    }
    initializeComponents() {
        this.performanceMonitor = new SearchPerformanceMonitor_1.SearchPerformanceMonitor(this.config.database.path);
        this.dashboard = new MonitoringDashboard_1.MonitoringDashboard();
        this.alertingEngine = new AlertingEngine_1.AlertingEngine();
        this.logger = new SearchLogger_1.SearchLogger();
        this.profiler = new PerformanceProfiler_1.PerformanceProfiler(this.config.database.path);
        this.setupSLAMonitoring();
        this.setupAlertingRules();
        this.setupLogging();
    }
    setupEventHandlers() {
        this.performanceMonitor.on('sla_violation', (violation) => {
            this.logger.logSLAViolation(violation.metric, violation.value, violation.threshold);
            this.emit('sla_violation', violation);
        });
        this.performanceMonitor.on('performance_degradation', (degradation) => {
            this.logger.logPerformanceDegradation(degradation);
            this.emit('performance_degradation', degradation);
        });
        this.alertingEngine.on('alert_triggered', (alert) => {
            this.logger.logAlert(alert);
            this.emit('alert_triggered', alert);
        });
        this.profiler.on('bottleneck_detected', (bottleneck) => {
            this.logger.logBottleneck(bottleneck);
            this.emit('bottleneck_detected', bottleneck);
        });
        this.profiler.on('session_complete', (session) => {
            this.logger.logProfilingSession(session);
            this.emit('profiling_session_complete', session);
        });
    }
    setupSLAMonitoring() {
        const rules = [
            {
                id: 'response_time_sla',
                metric: 'response_time_p95',
                operator: '>',
                threshold: this.config.sla.responseTimeThreshold,
                severity: 'critical',
                channels: this.config.alerting.channels,
                description: 'Search response time SLA violation'
            },
            {
                id: 'error_rate_sla',
                metric: 'error_rate',
                operator: '>',
                threshold: this.config.sla.errorRateThreshold,
                severity: 'warning',
                channels: this.config.alerting.channels,
                description: 'Search error rate threshold exceeded'
            },
            {
                id: 'cache_hit_rate',
                metric: 'cache_hit_rate',
                operator: '<',
                threshold: this.config.sla.cacheHitRateThreshold,
                severity: 'warning',
                channels: this.config.alerting.channels,
                description: 'Cache hit rate below threshold'
            }
        ];
        rules.forEach(rule => this.alertingEngine.addRule(rule));
    }
    setupAlertingRules() {
        const additionalRules = [
            {
                id: 'high_query_volume',
                metric: 'queries_per_second',
                operator: '>',
                threshold: 100,
                severity: 'info',
                channels: ['console'],
                description: 'High query volume detected'
            },
            {
                id: 'memory_usage_high',
                metric: 'memory_usage_mb',
                operator: '>',
                threshold: 500,
                severity: 'warning',
                channels: this.config.alerting.channels,
                description: 'High memory usage detected'
            },
            {
                id: 'index_corruption',
                metric: 'index_integrity_score',
                operator: '<',
                threshold: 95,
                severity: 'critical',
                channels: this.config.alerting.channels,
                description: 'Potential index corruption detected'
            }
        ];
        additionalRules.forEach(rule => this.alertingEngine.addRule(rule));
    }
    setupLogging() {
        this.logger.setLevel(this.config.logging.level);
        this.logger.enableTrace(this.config.logging.enableTrace);
        this.config.logging.destinations.forEach(dest => {
            this.logger.addDestination(dest);
        });
    }
    async start() {
        if (this.isStarted) {
            this.logger.info('Monitoring orchestrator already started');
            return;
        }
        this.logger.info('Starting monitoring orchestrator');
        try {
            await this.performanceMonitor.initialize();
            await this.profiler.initialize();
            if (this.config.dashboard.autoStart) {
                this.startDashboard();
            }
            if (this.config.profiling.enabled && this.config.profiling.autoProfile) {
                this.startAutoProfiling();
            }
            this.isStarted = true;
            this.logger.info('Monitoring orchestrator started successfully');
            this.emit('started');
        }
        catch (error) {
            this.logger.error('Failed to start monitoring orchestrator', { error });
            throw error;
        }
    }
    async stop() {
        if (!this.isStarted)
            return;
        this.logger.info('Stopping monitoring orchestrator');
        if (this.dashboardInterval) {
            clearInterval(this.dashboardInterval);
            this.dashboardInterval = undefined;
        }
        this.profiler.stopSession();
        this.isStarted = false;
        this.logger.info('Monitoring orchestrator stopped');
        this.emit('stopped');
    }
    recordSearch(query, duration, resultCount, cacheHit, strategy, error, indexesUsed = []) {
        const traceId = this.generateTraceId();
        this.performanceMonitor.recordSearch(query, duration, resultCount, cacheHit, strategy, indexesUsed);
        this.logger.logSearch({
            traceId,
            query,
            duration,
            resultCount,
            cacheHit,
            strategy,
            error: error?.message,
            indexesUsed
        });
        this.checkAlerts(duration, !!error, cacheHit);
        if (this.profiler.isSessionActive()) {
            this.profiler.recordQuery(query, duration, strategy, indexesUsed);
        }
    }
    async startProfilingSession(name) {
        const sessionId = await this.profiler.startSession(name);
        this.logger.info(`Profiling session started: ${sessionId}`);
        return sessionId;
    }
    async stopProfilingSession() {
        const session = await this.profiler.stopSession();
        if (session) {
            this.logger.info(`Profiling session completed: ${session.id}`);
        }
        return session;
    }
    async getCurrentMetrics() {
        return this.performanceMonitor.getCurrentMetrics();
    }
    async getDashboardData() {
        const performanceData = await this.performanceMonitor.getCurrentMetrics();
        const profilerData = this.profiler.isSessionActive()
            ? await this.profiler.getCurrentStats()
            : null;
        return this.dashboard.getDashboardData({
            performance: performanceData,
            profiler: profilerData,
            alerts: this.alertingEngine.getActiveAlerts()
        });
    }
    async generateReport(hours = 24) {
        const performanceReport = await this.performanceMonitor.generateReport(hours);
        const profilerReport = await this.profiler.generateReport(hours);
        return {
            timestamp: new Date(),
            period: `${hours} hours`,
            performance: performanceReport,
            profiler: profilerReport,
            alerts: this.alertingEngine.getAlertHistory(hours),
            recommendations: this.generateRecommendations(performanceReport, profilerReport)
        };
    }
    startDashboard() {
        if (this.dashboardInterval)
            return;
        this.dashboardInterval = setInterval(async () => {
            try {
                const dashboardData = await this.getDashboardData();
                this.emit('dashboard_update', dashboardData);
            }
            catch (error) {
                this.logger.error('Dashboard update failed', { error });
            }
        }, this.config.dashboard.refreshInterval * 1000);
    }
    startAutoProfiling() {
        setInterval(async () => {
            try {
                if (!this.profiler.isSessionActive()) {
                    await this.startProfilingSession('auto');
                    setTimeout(async () => {
                        await this.stopProfilingSession();
                    }, this.config.profiling.sessionDuration * 60 * 1000);
                }
            }
            catch (error) {
                this.logger.error('Auto-profiling failed', { error });
            }
        }, (this.config.profiling.sessionDuration + 5) * 60 * 1000);
    }
    checkAlerts(duration, hasError, cacheHit) {
        const metrics = {
            response_time: duration,
            error_occurred: hasError ? 1 : 0,
            cache_hit: cacheHit ? 1 : 0
        };
        this.alertingEngine.checkRules(metrics);
    }
    generateRecommendations(performanceReport, profilerReport) {
        const recommendations = [];
        if (performanceReport.avgResponseTime > this.config.sla.responseTimeThreshold * 0.8) {
            recommendations.push('Response times approaching SLA threshold - consider query optimization');
        }
        if (performanceReport.cacheHitRate < this.config.sla.cacheHitRateThreshold) {
            recommendations.push('Cache hit rate below threshold - review caching strategy');
        }
        if (profilerReport && profilerReport.bottlenecks.length > 0) {
            recommendations.push('Performance bottlenecks detected - review profiling session details');
        }
        return recommendations;
    }
    generateTraceId() {
        return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.MonitoringOrchestrator = MonitoringOrchestrator;
exports.DEFAULT_MONITORING_CONFIG = {
    database: {
        path: './monitoring.db'
    },
    sla: {
        responseTimeThreshold: 1000,
        errorRateThreshold: 5,
        cacheHitRateThreshold: 80
    },
    alerting: {
        enabled: true,
        channels: ['console', 'file'],
        escalationDelay: 15
    },
    logging: {
        level: 'info',
        destinations: ['console', 'file'],
        enableTrace: true
    },
    profiling: {
        enabled: true,
        autoProfile: false,
        sessionDuration: 10
    },
    dashboard: {
        refreshInterval: 30,
        autoStart: true
    }
};
//# sourceMappingURL=MonitoringOrchestrator.js.map