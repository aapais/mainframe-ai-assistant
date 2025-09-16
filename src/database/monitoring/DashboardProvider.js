"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardProvider = void 0;
const events_1 = require("events");
class DashboardProvider extends events_1.EventEmitter {
    db;
    config;
    performanceMonitor;
    metricsCollector;
    healthCheck;
    queryAnalyzer;
    refreshTimer;
    isRunning = false;
    lastMetrics;
    metricsHistory = [];
    constructor(db, performanceMonitor, metricsCollector, healthCheck, queryAnalyzer, config) {
        super();
        this.db = db;
        this.performanceMonitor = performanceMonitor;
        this.metricsCollector = metricsCollector;
        this.healthCheck = healthCheck;
        this.queryAnalyzer = queryAnalyzer;
        this.config = this.buildConfig(config);
        this.initializeProvider();
    }
    buildConfig(config) {
        return {
            refreshInterval: 30,
            retentionPeriod: 7,
            enableRealTime: true,
            enableAlerts: true,
            enableTrends: true,
            enableCapacityPlanning: true,
            customMetrics: [],
            alertThresholds: {
                responseTime: 1000,
                errorRate: 0.05,
                memoryUsage: 0.8,
                diskUsage: 0.9
            },
            ...config,
            alertThresholds: {
                responseTime: 1000,
                errorRate: 0.05,
                memoryUsage: 0.8,
                diskUsage: 0.9,
                ...config?.alertThresholds
            }
        };
    }
    initializeProvider() {
        this.createDashboardTables();
        this.loadMetricsHistory();
        this.startDataCollection();
    }
    createDashboardTables() {
        const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS dashboard_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        metrics_data TEXT NOT NULL, -- JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dashboard_alerts (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'critical')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        value REAL,
        threshold REAL,
        triggered_at INTEGER NOT NULL,
        resolved_at INTEGER,
        resolved BOOLEAN DEFAULT FALSE,
        metadata TEXT, -- JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS capacity_planning (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        current_value REAL NOT NULL,
        projected_value REAL NOT NULL,
        projection_days INTEGER NOT NULL,
        confidence REAL NOT NULL, -- 0-1
        growth_rate REAL NOT NULL,
        calculation_date INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_timestamp ON dashboard_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_dashboard_alerts_triggered ON dashboard_alerts(triggered_at);
      CREATE INDEX IF NOT EXISTS idx_dashboard_alerts_resolved ON dashboard_alerts(resolved);
      CREATE INDEX IF NOT EXISTS idx_capacity_planning_metric ON capacity_planning(metric_name);
    `;
        this.db.exec(createTablesSQL);
    }
    loadMetricsHistory() {
        try {
            const results = this.db.prepare(`
        SELECT timestamp, metrics_data 
        FROM dashboard_metrics 
        WHERE timestamp > ?
        ORDER BY timestamp DESC 
        LIMIT 100
      `).all(Date.now() - (24 * 60 * 60 * 1000));
            this.metricsHistory = results.map((row) => ({
                timestamp: row.timestamp,
                ...JSON.parse(row.metrics_data)
            }));
        }
        catch (error) {
            console.error('Failed to load metrics history:', error);
            this.metricsHistory = [];
        }
    }
    startDataCollection() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        this.collectMetrics();
        if (this.config.enableRealTime) {
            this.refreshTimer = setInterval(() => {
                this.collectMetrics();
            }, this.config.refreshInterval * 1000);
        }
        this.emit('data-collection-started');
    }
    stopDataCollection() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
        }
        this.emit('data-collection-stopped');
    }
    async collectMetrics() {
        try {
            const timestamp = Date.now();
            const performanceMetrics = this.performanceMonitor.getRealtimeMetrics();
            const healthStatus = this.healthCheck.getHealthStatus();
            const queryStats = this.queryAnalyzer.getAnalyzerStats();
            const slowQueries = this.queryAnalyzer.getSlowQueries(5);
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            const metrics = {
                timestamp,
                performance: {
                    avgResponseTime: performanceMetrics.avgResponseTime,
                    throughput: performanceMetrics.queriesPerSecond,
                    errorRate: 0,
                    cacheHitRate: performanceMetrics.cacheHitRate,
                    activeConnections: performanceMetrics.currentConnections,
                    memoryUsage: performanceMetrics.memoryUsage
                },
                health: {
                    overall: healthStatus?.overall || 'unknown',
                    score: healthStatus?.score || 0,
                    activeAlerts: healthStatus?.checks.filter(c => c.status !== 'healthy').length || 0,
                    lastCheck: healthStatus?.lastCheck || timestamp
                },
                queries: {
                    totalQueries: queryStats.totalQueries,
                    slowQueries: queryStats.slowQueries,
                    topSlowQueries: slowQueries.slice(0, 5).map(q => ({
                        query: q.query.substring(0, 100) + (q.query.length > 100 ? '...' : ''),
                        avgDuration: q.avgDuration,
                        occurrences: q.occurrences
                    }))
                },
                system: {
                    cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000,
                    memoryUsage: memUsage.heapUsed,
                    diskUsage: 0,
                    uptime: process.uptime()
                }
            };
            this.lastMetrics = metrics;
            this.metricsHistory.push(metrics);
            if (this.metricsHistory.length > 1000) {
                this.metricsHistory = this.metricsHistory.slice(-500);
            }
            if (Math.random() < 0.1) {
                this.storeMetrics(metrics);
            }
            if (this.config.enableAlerts) {
                this.checkForAlerts(metrics);
            }
            if (this.config.enableCapacityPlanning) {
                this.updateCapacityPlanning(metrics);
            }
            this.emit('metrics-collected', metrics);
        }
        catch (error) {
            console.error('Failed to collect dashboard metrics:', error);
        }
    }
    storeMetrics(metrics) {
        try {
            this.db.prepare(`
        INSERT INTO dashboard_metrics (timestamp, metrics_data)
        VALUES (?, ?)
      `).run(metrics.timestamp, JSON.stringify({
                performance: metrics.performance,
                health: metrics.health,
                queries: metrics.queries,
                system: metrics.system
            }));
        }
        catch (error) {
            console.error('Failed to store dashboard metrics:', error);
        }
    }
    checkForAlerts(metrics) {
        const alerts = [];
        if (metrics.performance.avgResponseTime > this.config.alertThresholds.responseTime) {
            const severity = metrics.performance.avgResponseTime > this.config.alertThresholds.responseTime * 2
                ? 'critical' : 'warning';
            alerts.push({
                type: 'response_time',
                severity,
                title: 'High Response Time',
                message: `Average response time is ${metrics.performance.avgResponseTime}ms`,
                value: metrics.performance.avgResponseTime,
                threshold: this.config.alertThresholds.responseTime
            });
        }
        if (metrics.performance.errorRate > this.config.alertThresholds.errorRate) {
            alerts.push({
                type: 'error_rate',
                severity: 'critical',
                title: 'High Error Rate',
                message: `Error rate is ${(metrics.performance.errorRate * 100).toFixed(1)}%`,
                value: metrics.performance.errorRate,
                threshold: this.config.alertThresholds.errorRate
            });
        }
        const memoryUtilization = metrics.performance.memoryUsage / (1024 * 1024 * 1024);
        if (memoryUtilization > this.config.alertThresholds.memoryUsage) {
            alerts.push({
                type: 'memory_usage',
                severity: memoryUtilization > 0.95 ? 'critical' : 'warning',
                title: 'High Memory Usage',
                message: `Memory usage is ${(memoryUtilization * 100).toFixed(1)}%`,
                value: memoryUtilization,
                threshold: this.config.alertThresholds.memoryUsage
            });
        }
        alerts.forEach(alert => {
            this.createAlert(alert);
        });
    }
    createAlert(alert) {
        try {
            const alertId = `${Date.now()}_${alert.type}_${Math.random().toString(36).substr(2, 9)}`;
            this.db.prepare(`
        INSERT INTO dashboard_alerts (
          id, alert_type, severity, title, message, value, threshold, triggered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(alertId, alert.type, alert.severity, alert.title, alert.message, alert.value, alert.threshold, Date.now());
            this.emit('alert-triggered', {
                id: alertId,
                ...alert,
                timestamp: Date.now()
            });
        }
        catch (error) {
            console.error('Failed to create alert:', error);
        }
    }
    updateCapacityPlanning(metrics) {
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        const historicalData = this.metricsHistory.filter(m => m.timestamp > oneDayAgo);
        if (historicalData.length < 2)
            return;
        const oldestData = historicalData[0];
        const newestData = historicalData[historicalData.length - 1];
        const timeDiff = (newestData.timestamp - oldestData.timestamp) / (1000 * 60 * 60);
        if (timeDiff > 0) {
            const memoryGrowthRate = (newestData.performance.memoryUsage - oldestData.performance.memoryUsage) / timeDiff;
            const queryGrowthRate = (newestData.performance.throughput - oldestData.performance.throughput) / timeDiff;
            this.storeCapacityProjection('memory_usage', newestData.performance.memoryUsage, memoryGrowthRate);
            this.storeCapacityProjection('query_throughput', newestData.performance.throughput, queryGrowthRate);
        }
    }
    storeCapacityProjection(metricName, currentValue, growthRate) {
        try {
            const projectionDays = 30;
            const projectedValue = currentValue + (growthRate * 24 * projectionDays);
            const confidence = Math.max(0.1, Math.min(1.0, 1.0 - Math.abs(growthRate) / currentValue));
            this.db.prepare(`
        INSERT INTO capacity_planning (
          metric_name, current_value, projected_value, projection_days,
          confidence, growth_rate, calculation_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(metricName, currentValue, projectedValue, projectionDays, confidence, growthRate, Date.now());
        }
        catch (error) {
            console.error('Failed to store capacity projection:', error);
        }
    }
    getCurrentMetrics() {
        return this.lastMetrics || null;
    }
    getMetricsHistory(hours = 24) {
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        return this.metricsHistory.filter(m => m.timestamp > cutoff);
    }
    getTimeSeriesData(metric, hours = 24) {
        const history = this.getMetricsHistory(hours);
        const data = history.map(m => {
            let value;
            switch (metric) {
                case 'responseTime':
                    value = m.performance.avgResponseTime;
                    break;
                case 'throughput':
                    value = m.performance.throughput;
                    break;
                case 'errorRate':
                    value = m.performance.errorRate * 100;
                    break;
                case 'cacheHitRate':
                    value = m.performance.cacheHitRate * 100;
                    break;
                case 'memoryUsage':
                    value = m.performance.memoryUsage / (1024 * 1024);
                    break;
                default:
                    value = 0;
            }
            return { x: m.timestamp, y: value };
        });
        return {
            labels: data.map(d => new Date(d.x).toISOString()),
            datasets: [{
                    label: metric,
                    data,
                    borderColor: this.getMetricColor(metric),
                    backgroundColor: this.getMetricColor(metric) + '20',
                    fill: false
                }]
        };
    }
    getMetricColor(metric) {
        const colors = {
            responseTime: '#ff6b6b',
            throughput: '#4ecdc4',
            errorRate: '#ff8e53',
            cacheHitRate: '#45b7d1',
            memoryUsage: '#96ceb4'
        };
        return colors[metric] || '#999999';
    }
    getAlertSummary(hours = 24) {
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        try {
            const alerts = this.db.prepare(`
        SELECT * FROM dashboard_alerts 
        WHERE triggered_at > ?
        ORDER BY triggered_at DESC
      `).all(cutoff);
            const summary = alerts.reduce((acc, alert) => {
                acc.total++;
                acc[alert.severity]++;
                return acc;
            }, { total: 0, critical: 0, warning: 0, info: 0 });
            const recent = alerts.slice(0, 10).map((alert) => ({
                id: alert.id,
                severity: alert.severity,
                message: alert.message,
                timestamp: alert.triggered_at,
                resolved: alert.resolved
            }));
            return { ...summary, recent };
        }
        catch (error) {
            console.error('Failed to get alert summary:', error);
            return { total: 0, critical: 0, warning: 0, info: 0, recent: [] };
        }
    }
    getCapacityPlanningData() {
        try {
            const projections = this.db.prepare(`
        SELECT 
          metric_name,
          current_value,
          projected_value,
          projection_days,
          confidence,
          growth_rate
        FROM capacity_planning 
        WHERE calculation_date > ?
        ORDER BY calculation_date DESC
      `).all(Date.now() - (24 * 60 * 60 * 1000));
            const recommendations = [];
            projections.forEach((proj) => {
                if (proj.growth_rate > 0) {
                    const growthPercent = (proj.growth_rate / proj.current_value) * 100;
                    if (growthPercent > 10) {
                        recommendations.push({
                            type: proj.metric_name.includes('memory') ? 'scaling' : 'performance',
                            urgency: growthPercent > 50 ? 'high' : 'medium',
                            description: `${proj.metric_name} is growing at ${growthPercent.toFixed(1)}% per day`,
                            timeline: proj.projection_days > 30 ? 'Long term' : 'Short term'
                        });
                    }
                }
            });
            const memoryProjection = projections.find(p => p.metric_name === 'memory_usage');
            const queryProjection = projections.find(p => p.metric_name === 'query_throughput');
            return {
                projections: {
                    storage: {
                        current: 0,
                        projected30Days: 0,
                        projected90Days: 0,
                        growthRate: 0
                    },
                    connections: {
                        current: this.lastMetrics?.performance.activeConnections || 0,
                        peak: 0,
                        projected: 0,
                        utilization: 0
                    },
                    queries: {
                        currentQPS: this.lastMetrics?.performance.throughput || 0,
                        peakQPS: 0,
                        projectedQPS: queryProjection?.projected_value || 0,
                        growthTrend: (queryProjection?.growth_rate || 0) > 0 ? 'increasing' : 'stable'
                    }
                },
                recommendations
            };
        }
        catch (error) {
            console.error('Failed to get capacity planning data:', error);
            return {
                projections: {
                    storage: { current: 0, projected30Days: 0, projected90Days: 0, growthRate: 0 },
                    connections: { current: 0, peak: 0, projected: 0, utilization: 0 },
                    queries: { currentQPS: 0, peakQPS: 0, projectedQPS: 0, growthTrend: 'stable' }
                },
                recommendations: []
            };
        }
    }
    getPrometheusMetrics() {
        const metrics = this.getCurrentMetrics();
        if (!metrics)
            return '';
        const prometheusData = [
            `# HELP sqlite_dashboard_response_time_ms Average response time in milliseconds`,
            `# TYPE sqlite_dashboard_response_time_ms gauge`,
            `sqlite_dashboard_response_time_ms ${metrics.performance.avgResponseTime}`,
            ``,
            `# HELP sqlite_dashboard_throughput_qps Queries per second`,
            `# TYPE sqlite_dashboard_throughput_qps gauge`,
            `sqlite_dashboard_throughput_qps ${metrics.performance.throughput}`,
            ``,
            `# HELP sqlite_dashboard_cache_hit_ratio Cache hit ratio`,
            `# TYPE sqlite_dashboard_cache_hit_ratio gauge`,
            `sqlite_dashboard_cache_hit_ratio ${metrics.performance.cacheHitRate}`,
            ``,
            `# HELP sqlite_dashboard_memory_usage_bytes Memory usage in bytes`,
            `# TYPE sqlite_dashboard_memory_usage_bytes gauge`,
            `sqlite_dashboard_memory_usage_bytes ${metrics.performance.memoryUsage}`,
            ``,
            `# HELP sqlite_dashboard_health_score Health score (0-100)`,
            `# TYPE sqlite_dashboard_health_score gauge`,
            `sqlite_dashboard_health_score ${metrics.health.score}`,
            ``,
            `# HELP sqlite_dashboard_active_alerts Number of active alerts`,
            `# TYPE sqlite_dashboard_active_alerts gauge`,
            `sqlite_dashboard_active_alerts ${metrics.health.activeAlerts}`,
            ``,
            `# HELP sqlite_dashboard_slow_queries Number of slow queries`,
            `# TYPE sqlite_dashboard_slow_queries gauge`,
            `sqlite_dashboard_slow_queries ${metrics.queries.slowQueries}`
        ];
        return prometheusData.join('\n');
    }
    getGrafanaDataSource() {
        return {
            name: 'SQLite Performance Monitor',
            type: 'json',
            url: '/api/dashboard/metrics',
            access: 'proxy',
            basicAuth: false,
            jsonData: {
                timeField: 'timestamp',
                httpMethod: 'GET'
            }
        };
    }
    handleGrafanaQuery(query) {
        try {
            const { range, targets } = query;
            const startTime = new Date(range.from).getTime();
            const endTime = new Date(range.to).getTime();
            const results = targets.map((target) => {
                const history = this.metricsHistory.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
                const datapoints = history.map(m => {
                    let value;
                    switch (target.target) {
                        case 'response_time':
                            value = m.performance.avgResponseTime;
                            break;
                        case 'throughput':
                            value = m.performance.throughput;
                            break;
                        case 'cache_hit_rate':
                            value = m.performance.cacheHitRate * 100;
                            break;
                        case 'memory_usage':
                            value = m.performance.memoryUsage / (1024 * 1024);
                            break;
                        case 'health_score':
                            value = m.health.score;
                            break;
                        default:
                            value = 0;
                    }
                    return [value, m.timestamp];
                });
                return {
                    target: target.target,
                    datapoints
                };
            });
            return results;
        }
        catch (error) {
            console.error('Failed to handle Grafana query:', error);
            return [];
        }
    }
    resolveAlert(alertId) {
        try {
            const result = this.db.prepare(`
        UPDATE dashboard_alerts 
        SET resolved = TRUE, resolved_at = ?
        WHERE id = ?
      `).run(Date.now(), alertId);
            if (result.changes > 0) {
                this.emit('alert-resolved', { alertId });
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Failed to resolve alert:', error);
            return false;
        }
    }
    getDashboardConfig() {
        return { ...this.config };
    }
    updateDashboardConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (newConfig.refreshInterval && this.isRunning) {
            this.stopDataCollection();
            this.startDataCollection();
        }
        this.emit('config-updated', this.config);
    }
    cleanupOldData() {
        const retentionCutoff = Date.now() - (this.config.retentionPeriod * 24 * 60 * 60 * 1000);
        try {
            this.db.prepare('DELETE FROM dashboard_metrics WHERE timestamp < ?').run(retentionCutoff);
            this.db.prepare(`
        DELETE FROM dashboard_alerts 
        WHERE resolved = TRUE AND resolved_at < ?
      `).run(retentionCutoff);
            this.db.prepare('DELETE FROM capacity_planning WHERE calculation_date < ?').run(retentionCutoff);
        }
        catch (error) {
            console.error('Failed to cleanup old dashboard data:', error);
        }
    }
    destroy() {
        this.stopDataCollection();
        this.removeAllListeners();
        this.metricsHistory.length = 0;
    }
}
exports.DashboardProvider = DashboardProvider;
//# sourceMappingURL=DashboardProvider.js.map