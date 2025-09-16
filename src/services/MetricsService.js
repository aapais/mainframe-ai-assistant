"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const tslib_1 = require("tslib");
const events_1 = require("events");
const better_sqlite3_1 = tslib_1.__importDefault(require("better-sqlite3"));
const services_1 = require("../types/services");
class MetricsService extends events_1.EventEmitter {
    config;
    dbPath;
    db;
    aggregationInterval;
    alertCheckInterval;
    alerts = new Map();
    statements;
    constructor(config, dbPath = ':memory:') {
        super();
        this.config = config;
        this.dbPath = dbPath;
        this.initializeDatabase();
        this.setupPeriodicTasks();
    }
    async recordSearch(query, results) {
        try {
            const searchRecord = {
                query: query.text,
                timestamp: query.timestamp.toISOString(),
                results_count: results.length,
                user_id: query.user_id,
                session_id: query.session_id,
                search_type: this.determineSearchType(results),
                response_time: this.calculateAverageResponseTime(results),
                success: results.length > 0,
                metadata: JSON.stringify({
                    options: query.options,
                    topScore: results.length > 0 ? results[0].score : 0,
                    hasAIResults: results.some(r => r.matchType === 'ai' || r.matchType === 'semantic')
                })
            };
            this.statements.insertSearch.run(searchRecord.query, searchRecord.timestamp, searchRecord.results_count, searchRecord.selected_entry_id, searchRecord.user_id, searchRecord.session_id, searchRecord.search_type, searchRecord.response_time, searchRecord.success ? 1 : 0, searchRecord.metadata);
            await this.recordPerformance('search_response_time', searchRecord.response_time);
            await this.recordPerformance('search_result_count', results.length);
            this.checkSearchAlerts(searchRecord, results);
            this.emit('search:recorded', query, results);
        }
        catch (error) {
            console.error('Failed to record search:', error);
            throw new services_1.DatabaseError('Failed to record search metrics', 'recordSearch', { query, error });
        }
    }
    async recordUsage(entryId, action, userId, metadata) {
        try {
            const usageRecord = {
                entry_id: entryId,
                action,
                timestamp: new Date().toISOString(),
                user_id: userId,
                metadata: metadata ? JSON.stringify(metadata) : undefined
            };
            this.statements.insertUsage.run(usageRecord.entry_id, usageRecord.action, usageRecord.timestamp, usageRecord.user_id, usageRecord.session_id, usageRecord.metadata, usageRecord.value);
            await this.recordPerformance('usage_frequency', 1);
            this.emit('usage:recorded', entryId, action, userId, metadata);
        }
        catch (error) {
            console.error('Failed to record usage:', error);
            throw new services_1.DatabaseError('Failed to record usage metrics', 'recordUsage', { entryId, action, error });
        }
    }
    async recordError(error) {
        try {
            const errorRecord = {
                entry_id: 'system',
                action: 'error',
                timestamp: new Date().toISOString(),
                metadata: JSON.stringify({
                    type: error.name,
                    code: error.code,
                    message: error.message,
                    statusCode: error.statusCode,
                    recoverable: error.recoverable,
                    details: error.details
                }),
                value: error.statusCode
            };
            this.statements.insertUsage.run(errorRecord.entry_id, errorRecord.action, errorRecord.timestamp, null, null, errorRecord.metadata, errorRecord.value);
            await this.recordPerformance('error_rate', 1);
            if (error.statusCode >= 500) {
                await this.createAlert({
                    id: `error-${Date.now()}`,
                    type: 'error',
                    severity: 'error',
                    title: 'System Error Detected',
                    message: `${error.name}: ${error.message}`,
                    value: error.statusCode,
                    threshold: 500,
                    timestamp: new Date(),
                    acknowledged: false
                });
            }
            this.emit('error:recorded', error);
        }
        catch (recordError) {
            console.error('Failed to record error metrics:', recordError);
        }
    }
    async recordPerformance(operation, duration, metadata) {
        try {
            const snapshot = {
                timestamp: new Date().toISOString(),
                metric_type: 'performance',
                metric_name: operation,
                value: duration,
                metadata: metadata ? JSON.stringify(metadata) : undefined
            };
            this.statements.insertSnapshot.run(snapshot.timestamp, snapshot.metric_type, snapshot.metric_name, snapshot.value, snapshot.metadata);
            await this.checkPerformanceAlerts(operation, duration);
            this.emit('performance:recorded', operation, duration, metadata);
        }
        catch (error) {
            console.error('Failed to record performance metric:', error);
        }
    }
    async getMetrics(period = '24h') {
        try {
            const timeRange = this.getPeriodTimeRange(period);
            const [overview, categories, searches, usage, performance, trends] = await Promise.all([
                this.getOverviewMetrics(timeRange),
                this.getCategoryMetrics(timeRange),
                this.getSearchMetrics(timeRange),
                this.getUsageMetrics(timeRange),
                this.getPerformanceMetrics(timeRange),
                this.getTrends(period)
            ]);
            const alerts = Array.from(this.alerts.values())
                .filter(alert => !alert.acknowledged)
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, 10);
            return {
                overview,
                categories,
                searches,
                usage,
                performance,
                trends,
                alerts
            };
        }
        catch (error) {
            throw new services_1.DatabaseError('Failed to get metrics', 'getMetrics', { period, error });
        }
    }
    async getTrends(period = '24h') {
        try {
            const timeRange = this.getPeriodTimeRange(period);
            const intervalSize = this.getIntervalSize(period);
            const trends = await Promise.all([
                this.getTrendData('searches', 'search', timeRange, intervalSize),
                this.getTrendData('usage', 'usage', timeRange, intervalSize),
                this.getTrendData('success_rate', 'search', timeRange, intervalSize),
                this.getTrendData('performance', 'performance', timeRange, intervalSize),
                this.getTrendData('users', 'usage', timeRange, intervalSize),
                this.getTrendData('errors', 'error', timeRange, intervalSize)
            ]);
            return {
                period,
                searches: trends[0],
                usage: trends[1],
                successRate: trends[2],
                performance: trends[3],
                users: trends[4],
                errors: trends[5]
            };
        }
        catch (error) {
            throw new services_1.DatabaseError('Failed to get trends', 'getTrends', { period, error });
        }
    }
    async getAlerts() {
        return Array.from(this.alerts.values())
            .sort((a, b) => {
            if (a.acknowledged !== b.acknowledged) {
                return a.acknowledged ? 1 : -1;
            }
            return b.timestamp.getTime() - a.timestamp.getTime();
        });
    }
    async acknowledgeAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (!alert) {
            return;
        }
        alert.acknowledged = true;
        this.alerts.set(alertId, alert);
        try {
            this.statements.updateAlert.run(1, new Date().toISOString(), 'system', alertId);
        }
        catch (error) {
            console.error('Failed to update alert in database:', error);
        }
        this.emit('alert:acknowledged', alertId);
    }
    async exportMetrics(format = 'json') {
        const metrics = await this.getMetrics('7d');
        switch (format) {
            case 'json':
                return JSON.stringify(metrics, null, 2);
            case 'csv':
                return this.exportToCSV(metrics);
            case 'prometheus':
                return this.exportToPrometheus(metrics);
            default:
                throw new services_1.ServiceError(`Unsupported export format: ${format}`, 'INVALID_FORMAT');
        }
    }
    initializeDatabase() {
        this.db = new better_sqlite3_1.default(this.dbPath);
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        results_count INTEGER DEFAULT 0,
        selected_entry_id TEXT,
        user_id TEXT,
        session_id TEXT,
        search_type TEXT DEFAULT 'fuzzy',
        response_time INTEGER DEFAULT 0,
        success BOOLEAN DEFAULT 1,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS usage_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        user_id TEXT,
        session_id TEXT,
        metadata TEXT,
        value REAL
      );

      CREATE TABLE IF NOT EXISTS metric_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        value REAL NOT NULL,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        value REAL NOT NULL,
        threshold REAL NOT NULL,
        timestamp TEXT NOT NULL,
        acknowledged BOOLEAN DEFAULT 0,
        acknowledged_at TEXT,
        acknowledged_by TEXT,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_search_timestamp ON search_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_usage_entry_id ON usage_metrics(entry_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON metric_snapshots(timestamp, metric_type);
      CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged, timestamp);
    `);
        this.prepareStatements();
        this.loadExistingAlerts();
    }
    prepareStatements() {
        this.statements = {
            insertSearch: this.db.prepare(`
        INSERT INTO search_history (query, timestamp, results_count, selected_entry_id, user_id, session_id, search_type, response_time, success, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
            insertUsage: this.db.prepare(`
        INSERT INTO usage_metrics (entry_id, action, timestamp, user_id, session_id, metadata, value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
            insertSnapshot: this.db.prepare(`
        INSERT INTO metric_snapshots (timestamp, metric_type, metric_name, value, metadata)
        VALUES (?, ?, ?, ?, ?)
      `),
            insertAlert: this.db.prepare(`
        INSERT OR REPLACE INTO alerts (id, type, severity, title, message, value, threshold, timestamp, acknowledged, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
            updateAlert: this.db.prepare(`
        UPDATE alerts SET acknowledged = ?, acknowledged_at = ?, acknowledged_by = ? WHERE id = ?
      `),
            selectRecentSearches: this.db.prepare(`
        SELECT * FROM search_history 
        WHERE timestamp >= ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `),
            selectPopularSearches: this.db.prepare(`
        SELECT query, COUNT(*) as count, AVG(results_count) as avg_results,
               SUM(CASE WHEN success THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as success_rate,
               MAX(timestamp) as last_used
        FROM search_history 
        WHERE timestamp >= ?
        GROUP BY query 
        ORDER BY count DESC 
        LIMIT ?
      `),
            selectUsageActivity: this.db.prepare(`
        SELECT * FROM usage_metrics 
        WHERE timestamp >= ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `),
            selectMetricSnapshots: this.db.prepare(`
        SELECT * FROM metric_snapshots 
        WHERE timestamp >= ? AND metric_type = ? 
        ORDER BY timestamp DESC
      `)
        };
    }
    loadExistingAlerts() {
        try {
            const alertRows = this.db.prepare(`
        SELECT * FROM alerts WHERE acknowledged = 0 ORDER BY timestamp DESC
      `).all();
            alertRows.forEach(row => {
                const alert = {
                    id: row.id,
                    type: row.type,
                    severity: row.severity,
                    title: row.title,
                    message: row.message,
                    value: row.value,
                    threshold: row.threshold,
                    timestamp: new Date(row.timestamp),
                    acknowledged: Boolean(row.acknowledged),
                    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
                };
                this.alerts.set(alert.id, alert);
            });
        }
        catch (error) {
            console.warn('Failed to load existing alerts:', error);
        }
    }
    setupPeriodicTasks() {
        if (this.config.aggregation.enabled) {
            this.aggregationInterval = setInterval(() => this.performAggregation(), this.config.aggregation.interval);
        }
        this.alertCheckInterval = setInterval(() => this.checkSystemAlerts(), 5 * 60 * 1000);
    }
    async performAggregation() {
        try {
            const now = new Date();
            const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const searchStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_searches,
          AVG(results_count) as avg_results,
          AVG(response_time) as avg_response_time,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as success_rate
        FROM search_history 
        WHERE timestamp >= ?
      `).get(hourAgo.toISOString());
            if (searchStats && searchStats.total_searches > 0) {
                await this.recordPerformance('hourly_searches', searchStats.total_searches);
                await this.recordPerformance('hourly_avg_response_time', searchStats.avg_response_time);
                await this.recordPerformance('hourly_success_rate', searchStats.success_rate);
            }
            const usageStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_actions,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT entry_id) as unique_entries
        FROM usage_metrics 
        WHERE timestamp >= ?
      `).get(hourAgo.toISOString());
            if (usageStats && usageStats.total_actions > 0) {
                await this.recordPerformance('hourly_usage', usageStats.total_actions);
                await this.recordPerformance('hourly_active_users', usageStats.unique_users);
            }
            console.debug('Metrics aggregation completed');
        }
        catch (error) {
            console.error('Failed to perform metrics aggregation:', error);
        }
    }
    async checkSystemAlerts() {
        try {
            const now = new Date();
            const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
            const errorCount = this.db.prepare(`
        SELECT COUNT(*) as count FROM usage_metrics 
        WHERE action = 'error' AND timestamp >= ?
      `).get(fiveMinAgo.toISOString());
            if (errorCount.count > 10) {
                await this.createAlert({
                    id: `high-error-rate-${Date.now()}`,
                    type: 'error',
                    severity: 'warning',
                    title: 'High Error Rate',
                    message: `${errorCount.count} errors in the last 5 minutes`,
                    value: errorCount.count,
                    threshold: 10,
                    timestamp: now,
                    acknowledged: false
                });
            }
            const avgResponseTime = this.db.prepare(`
        SELECT AVG(response_time) as avg_time FROM search_history 
        WHERE timestamp >= ?
      `).get(fiveMinAgo.toISOString());
            if (avgResponseTime.avg_time > 2000) {
                await this.createAlert({
                    id: `slow-response-${Date.now()}`,
                    type: 'performance',
                    severity: 'warning',
                    title: 'Slow Response Times',
                    message: `Average response time: ${Math.round(avgResponseTime.avg_time)}ms`,
                    value: avgResponseTime.avg_time,
                    threshold: 2000,
                    timestamp: now,
                    acknowledged: false
                });
            }
        }
        catch (error) {
            console.error('Failed to check system alerts:', error);
        }
    }
    async createAlert(alert) {
        this.alerts.set(alert.id, alert);
        try {
            this.statements.insertAlert.run(alert.id, alert.type, alert.severity, alert.title, alert.message, alert.value, alert.threshold, alert.timestamp.toISOString(), alert.acknowledged ? 1 : 0, alert.metadata ? JSON.stringify(alert.metadata) : null);
        }
        catch (error) {
            console.error('Failed to save alert to database:', error);
        }
        this.emit('alert:created', alert);
    }
    determineSearchType(results) {
        if (results.length === 0)
            return 'no_results';
        const hasAI = results.some(r => r.matchType === 'ai' || r.matchType === 'semantic');
        const hasExact = results.some(r => r.matchType === 'exact');
        if (hasAI)
            return 'ai_enhanced';
        if (hasExact)
            return 'exact_match';
        return 'fuzzy_match';
    }
    calculateAverageResponseTime(results) {
        if (results.length === 0)
            return 0;
        const times = results
            .map(r => r.metadata?.processingTime || 0)
            .filter(t => t > 0);
        return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    }
    checkSearchAlerts(search, results) {
        if (!search.success) {
        }
        if (search.response_time > 3000) {
            this.createAlert({
                id: `slow-search-${Date.now()}`,
                type: 'performance',
                severity: 'info',
                title: 'Slow Search Detected',
                message: `Search "${search.query}" took ${search.response_time}ms`,
                value: search.response_time,
                threshold: 3000,
                timestamp: new Date(),
                acknowledged: false
            });
        }
    }
    async checkPerformanceAlerts(operation, value) {
        const thresholds = this.config.alerts?.thresholds || {};
        const threshold = thresholds[operation];
        if (!threshold || value <= threshold)
            return;
        await this.createAlert({
            id: `perf-${operation}-${Date.now()}`,
            type: 'performance',
            severity: value > threshold * 2 ? 'error' : 'warning',
            title: 'Performance Threshold Exceeded',
            message: `${operation}: ${value} exceeds threshold of ${threshold}`,
            value,
            threshold,
            timestamp: new Date(),
            acknowledged: false
        });
    }
    getPeriodTimeRange(period) {
        const end = new Date();
        let start;
        switch (period) {
            case '1h':
                start = new Date(end.getTime() - 60 * 60 * 1000);
                break;
            case '24h':
                start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        }
        return { start, end };
    }
    getIntervalSize(period) {
        switch (period) {
            case '1h': return 5 * 60 * 1000;
            case '24h': return 60 * 60 * 1000;
            case '7d': return 24 * 60 * 60 * 1000;
            case '30d': return 24 * 60 * 60 * 1000;
            default: return 60 * 60 * 1000;
        }
    }
    async getOverviewMetrics(timeRange) {
        const searches = this.db.prepare(`
      SELECT COUNT(*) as count FROM search_history 
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString());
        const usage = this.db.prepare(`
      SELECT COUNT(*) as count, COUNT(DISTINCT user_id) as users FROM usage_metrics 
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString());
        const successRate = this.db.prepare(`
      SELECT AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as rate FROM search_history
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString());
        return {
            totalEntries: 0,
            totalSearches: searches.count || 0,
            averageSuccessRate: successRate.rate || 0,
            totalUsage: usage.count || 0,
            activeUsers: usage.users || 0,
            uptime: Date.now() - this.config.aggregation.interval
        };
    }
    async getCategoryMetrics(timeRange) {
        return [];
    }
    async getSearchMetrics(timeRange) {
        const totalSearches = this.db.prepare(`
      SELECT COUNT(*) as count FROM search_history 
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString());
        const avgResults = this.db.prepare(`
      SELECT AVG(results_count) as avg FROM search_history 
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString());
        const avgResponseTime = this.db.prepare(`
      SELECT AVG(response_time) as avg FROM search_history 
      WHERE timestamp >= ? AND timestamp <= ? AND response_time > 0
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString());
        const noResultQueries = this.db.prepare(`
      SELECT query FROM search_history 
      WHERE timestamp >= ? AND timestamp <= ? AND results_count = 0
      GROUP BY query 
      ORDER BY COUNT(*) DESC 
      LIMIT 10
    `).all(timeRange.start.toISOString(), timeRange.end.toISOString());
        const popularQueries = this.statements.selectPopularSearches.all(timeRange.start.toISOString(), 20);
        const searchTypes = this.db.prepare(`
      SELECT search_type, COUNT(*) as count FROM search_history 
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY search_type
    `).all(timeRange.start.toISOString(), timeRange.end.toISOString());
        const searchTypesMap = {
            exact: 0,
            fuzzy: 0,
            semantic: 0,
            category: 0,
            tag: 0,
            ai: 0
        };
        searchTypes.forEach(st => {
            if (searchTypesMap.hasOwnProperty(st.search_type)) {
                searchTypesMap[st.search_type] = st.count;
            }
        });
        return {
            totalSearches: totalSearches.count || 0,
            uniqueQueries: 0,
            averageResultCount: avgResults.avg || 0,
            averageResponseTime: avgResponseTime.avg || 0,
            noResultQueries: noResultQueries.map(q => q.query),
            popularQueries: popularQueries.map(pq => ({
                query: pq.query,
                count: pq.count,
                averageResults: pq.avg_results,
                successRate: pq.success_rate,
                lastUsed: new Date(pq.last_used)
            })),
            searchTypes: searchTypesMap,
            aiUsage: {
                totalRequests: searchTypesMap.ai || 0,
                successRate: 0,
                averageLatency: 0,
                fallbackRate: 0
            }
        };
    }
    async getUsageMetrics(timeRange) {
        const totalActivity = this.db.prepare(`
      SELECT COUNT(*) as count FROM usage_metrics 
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString());
        const uniqueUsers = this.db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count FROM usage_metrics 
      WHERE timestamp >= ? AND timestamp <= ? AND user_id IS NOT NULL
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString());
        const recentActivity = this.statements.selectUsageActivity.all(timeRange.start.toISOString(), 50);
        return {
            totalViews: 0,
            totalRatings: 0,
            averageRating: 0,
            uniqueUsers: uniqueUsers.count || 0,
            mostUsed: [],
            leastUsed: [],
            recentActivity: recentActivity.map(ra => ({
                timestamp: new Date(ra.timestamp),
                entryId: ra.entry_id,
                action: ra.action,
                userId: ra.user_id
            })),
            userEngagement: {
                dailyActive: 0,
                weeklyActive: 0,
                monthlyActive: 0,
                retention: 0
            }
        };
    }
    async getPerformanceMetrics(timeRange) {
        const searchTimes = this.db.prepare(`
      SELECT AVG(response_time) as avg FROM search_history 
      WHERE timestamp >= ? AND timestamp <= ? AND response_time > 0
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString());
        const errorRate = this.db.prepare(`
      SELECT COUNT(*) as errors FROM usage_metrics 
      WHERE timestamp >= ? AND timestamp <= ? AND action = 'error'
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString());
        const totalActions = this.db.prepare(`
      SELECT COUNT(*) as count FROM usage_metrics 
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString());
        return {
            averageSearchTime: searchTimes.avg || 0,
            averageDbTime: 0,
            averageAiTime: 0,
            cacheHitRate: 0,
            errorRate: totalActions.count > 0 ? errorRate.errors / totalActions.count : 0,
            uptime: Date.now() - this.config.aggregation.interval,
            memoryUsage: process.memoryUsage().heapUsed,
            diskUsage: 0,
            throughput: {
                searches: 0,
                creates: 0,
                updates: 0
            }
        };
    }
    async getTrendData(type, metricType, timeRange, intervalSize) {
        const trends = [];
        const current = new Date(timeRange.start);
        while (current < timeRange.end) {
            const intervalEnd = new Date(current.getTime() + intervalSize);
            let value = 0;
            switch (type) {
                case 'searches':
                    const searchCount = this.db.prepare(`
            SELECT COUNT(*) as count FROM search_history 
            WHERE timestamp >= ? AND timestamp < ?
          `).get(current.toISOString(), intervalEnd.toISOString());
                    value = searchCount.count;
                    break;
                case 'usage':
                    const usageCount = this.db.prepare(`
            SELECT COUNT(*) as count FROM usage_metrics 
            WHERE timestamp >= ? AND timestamp < ?
          `).get(current.toISOString(), intervalEnd.toISOString());
                    value = usageCount.count;
                    break;
                case 'errors':
                    const errorCount = this.db.prepare(`
            SELECT COUNT(*) as count FROM usage_metrics 
            WHERE timestamp >= ? AND timestamp < ? AND action = 'error'
          `).get(current.toISOString(), intervalEnd.toISOString());
                    value = errorCount.count;
                    break;
            }
            trends.push({
                timestamp: new Date(current),
                value,
                trend: trends.length > 0 ? (value > trends[trends.length - 1].value ? 'up' : value < trends[trends.length - 1].value ? 'down' : 'stable') : 'stable'
            });
            current.setTime(current.getTime() + intervalSize);
        }
        return trends;
    }
    exportToCSV(metrics) {
        const lines = [
            'Metric,Value,Timestamp',
            `Total Entries,${metrics.overview.totalEntries},${new Date().toISOString()}`,
            `Total Searches,${metrics.overview.totalSearches},${new Date().toISOString()}`,
            `Average Success Rate,${metrics.overview.averageSuccessRate},${new Date().toISOString()}`,
            `Total Usage,${metrics.overview.totalUsage},${new Date().toISOString()}`,
            `Active Users,${metrics.overview.activeUsers},${new Date().toISOString()}`
        ];
        return lines.join('\n');
    }
    exportToPrometheus(metrics) {
        const timestamp = Date.now();
        return [
            `# HELP kb_total_entries Total number of knowledge base entries`,
            `# TYPE kb_total_entries gauge`,
            `kb_total_entries ${metrics.overview.totalEntries} ${timestamp}`,
            '',
            `# HELP kb_total_searches Total number of searches performed`,
            `# TYPE kb_total_searches counter`,
            `kb_total_searches ${metrics.overview.totalSearches} ${timestamp}`,
            '',
            `# HELP kb_average_success_rate Average success rate of searches`,
            `# TYPE kb_average_success_rate gauge`,
            `kb_average_success_rate ${metrics.overview.averageSuccessRate} ${timestamp}`,
            ''
        ].join('\n');
    }
    async close() {
        if (this.aggregationInterval) {
            clearInterval(this.aggregationInterval);
        }
        if (this.alertCheckInterval) {
            clearInterval(this.alertCheckInterval);
        }
        if (this.db) {
            this.db.close();
        }
        this.removeAllListeners();
    }
}
exports.MetricsService = MetricsService;
exports.default = MetricsService;
//# sourceMappingURL=MetricsService.js.map