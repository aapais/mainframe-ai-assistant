"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchAnalyticsService = void 0;
const events_1 = require("events");
class SearchAnalyticsService extends events_1.EventEmitter {
    config;
    eventBuffer = [];
    performanceBuffer = [];
    userSessions = new Map();
    qualityMetrics = [];
    systemMetrics;
    alertRules = [];
    batchTimer = null;
    metricsTimer = null;
    constructor(config = {}) {
        super();
        this.config = {
            enableTracking: true,
            enablePerformanceMonitoring: true,
            enableUserBehaviorTracking: true,
            enableErrorTracking: true,
            batchSize: 50,
            batchTimeout: 5000,
            retentionPeriod: 30 * 24 * 60 * 60 * 1000,
            anonymizeData: false,
            enableExport: true,
            ...config
        };
        this.systemMetrics = this.initializeSystemMetrics();
        if (this.config.enableTracking) {
            this.startBatchProcessing();
            this.startMetricsCollection();
            this.setupDefaultAlerts();
        }
    }
    trackSearch(query, results, options, performanceMetrics) {
        if (!this.config.enableTracking)
            return;
        this.trackEvent('search_performed', {
            query: this.anonymizeQuery(query),
            resultCount: results.length,
            options: this.sanitizeOptions(options),
            timestamp: Date.now()
        });
        if (this.config.enablePerformanceMonitoring) {
            this.trackPerformanceMetric(performanceMetrics);
        }
        if (this.config.enableUserBehaviorTracking) {
            this.updateUserBehavior('search', {
                query,
                resultCount: results.length,
                searchTime: performanceMetrics.searchTime
            });
        }
        this.trackSearchQuality({
            query: this.anonymizeQuery(query),
            resultRelevance: this.calculateRelevanceScore(results),
            zeroResultRate: results.length === 0 ? 1 : 0,
            clickPosition: -1,
            dwellTime: 0,
            refinementNeeded: false
        });
    }
    trackResultClick(result, position, query, dwellTime) {
        if (!this.config.enableTracking)
            return;
        this.trackEvent('result_clicked', {
            resultId: result.entry.id,
            position,
            score: result.score,
            query: this.anonymizeQuery(query),
            dwellTime: dwellTime || 0
        });
        this.updateUserBehavior('click', {
            position,
            dwellTime: dwellTime || 0
        });
        this.updateSearchQuality(query, {
            clickPosition: position,
            dwellTime: dwellTime || 0
        });
    }
    trackResultRating(result, rating, query, feedback) {
        if (!this.config.enableTracking)
            return;
        this.trackEvent('result_rated', {
            resultId: result.entry.id,
            rating,
            query: this.anonymizeQuery(query),
            feedback: feedback ? this.sanitizeFeedback(feedback) : undefined
        });
        this.updateSearchQuality(query, {
            userSatisfaction: rating,
            expertRating: rating
        });
    }
    trackSearchRefinement(originalQuery, refinedQuery, refinementType) {
        if (!this.config.enableTracking)
            return;
        this.trackEvent('search_refined', {
            originalQuery: this.anonymizeQuery(originalQuery),
            refinedQuery: this.anonymizeQuery(refinedQuery),
            refinementType
        });
        this.updateUserBehavior('refine', {
            originalQuery,
            refinedQuery,
            refinementType
        });
        this.updateSearchQuality(originalQuery, {
            refinementNeeded: true
        });
    }
    trackExport(format, resultCount, query) {
        if (!this.config.enableTracking)
            return;
        this.trackEvent('export_performed', {
            format,
            resultCount,
            query: query ? this.anonymizeQuery(query) : undefined
        });
        this.updateUserBehavior('export', {
            format,
            resultCount
        });
    }
    trackError(error, context) {
        if (!this.config.enableErrorTracking)
            return;
        this.trackEvent('error_occurred', {
            errorMessage: error.message,
            errorStack: error.stack,
            operation: context.operation,
            query: context.query ? this.anonymizeQuery(context.query) : undefined,
            timestamp: Date.now()
        });
        this.updateSystemErrorMetrics(error, context);
    }
    getPerformanceMetrics(timeRange) {
        const metrics = this.filterMetricsByTimeRange(this.performanceBuffer, timeRange);
        const latencies = metrics.map(m => m.searchTime);
        latencies.sort((a, b) => a - b);
        const searchLatency = {
            p50: this.percentile(latencies, 50),
            p95: this.percentile(latencies, 95),
            p99: this.percentile(latencies, 99),
            average: latencies.reduce((sum, val) => sum + val, 0) / latencies.length || 0
        };
        const now = Date.now();
        const oneSecondAgo = now - 1000;
        const oneMinuteAgo = now - 60000;
        const oneHourAgo = now - 3600000;
        const recentMetrics = this.performanceBuffer.filter(m => m.timestamp > oneHourAgo);
        const throughput = {
            requestsPerSecond: recentMetrics.filter(m => m.timestamp > oneSecondAgo).length,
            requestsPerMinute: recentMetrics.filter(m => m.timestamp > oneMinuteAgo).length,
            requestsPerHour: recentMetrics.length
        };
        const cacheHits = metrics.filter(m => m.cacheHit).length;
        const cachePerformance = {
            hitRate: metrics.length > 0 ? cacheHits / metrics.length : 0,
            missRate: metrics.length > 0 ? (metrics.length - cacheHits) / metrics.length : 0,
            evictionRate: 0
        };
        return { searchLatency, throughput, cachePerformance };
    }
    getUserBehaviorMetrics(userId) {
        if (userId) {
            const metrics = this.userSessions.get(userId);
            return metrics ? [metrics] : [];
        }
        return Array.from(this.userSessions.values());
    }
    getSearchQualityMetrics(query) {
        if (query) {
            return this.qualityMetrics.filter(m => m.query === this.anonymizeQuery(query));
        }
        return [...this.qualityMetrics];
    }
    getSystemHealth() {
        return { ...this.systemMetrics };
    }
    generateReport(timeRange, format = 'json') {
        const events = this.eventBuffer.filter(e => e.timestamp >= timeRange.from && e.timestamp <= timeRange.to);
        const performance = this.getPerformanceMetrics(timeRange);
        const userBehavior = this.getUserBehaviorMetrics();
        const searchQuality = this.getSearchQualityMetrics();
        const systemHealth = this.getSystemHealth();
        const report = {
            timeRange,
            summary: {
                totalEvents: events.length,
                totalSearches: events.filter(e => e.type === 'search_performed').length,
                totalClicks: events.filter(e => e.type === 'result_clicked').length,
                totalErrors: events.filter(e => e.type === 'error_occurred').length,
                uniqueUsers: new Set(events.map(e => e.userId).filter(Boolean)).size
            },
            performance,
            userBehavior: this.aggregateUserBehavior(userBehavior),
            searchQuality: this.aggregateSearchQuality(searchQuality),
            systemHealth,
            topQueries: this.getTopQueries(events),
            errorAnalysis: this.analyzeErrors(events)
        };
        if (format === 'csv') {
            return this.convertToCSV(report);
        }
        return report;
    }
    addAlertRule(rule) {
        this.alertRules.push({ ...rule, lastTriggered: undefined });
    }
    async exportData(format, timeRange) {
        if (!this.config.enableExport) {
            throw new Error('Data export is disabled');
        }
        const data = this.generateReport(timeRange || { from: 0, to: Date.now() }, format === 'csv' ? 'csv' : 'json');
        switch (format) {
            case 'json':
                return new Blob([JSON.stringify(data, null, 2)], {
                    type: 'application/json'
                });
            case 'csv':
                return new Blob([data], { type: 'text/csv' });
            case 'excel':
                return new Blob([JSON.stringify(data, null, 2)], {
                    type: 'application/json'
                });
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    trackEvent(type, data) {
        const event = {
            id: this.generateEventId(),
            type,
            timestamp: Date.now(),
            userId: this.getCurrentUserId(),
            sessionId: this.getCurrentSessionId(),
            data,
            metadata: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                version: '1.0.0'
            }
        };
        this.eventBuffer.push(event);
        if (this.eventBuffer.length >= this.config.batchSize) {
            this.processBatch();
        }
    }
    trackPerformanceMetric(metrics) {
        this.performanceBuffer.push({
            ...metrics,
            timestamp: Date.now()
        });
        if (this.performanceBuffer.length > 1000) {
            this.performanceBuffer.shift();
        }
        this.updateSystemMetrics(metrics);
    }
    updateUserBehavior(action, data) {
        const userId = this.getCurrentUserId();
        const sessionId = this.getCurrentSessionId();
        if (!userId)
            return;
        let metrics = this.userSessions.get(userId);
        if (!metrics) {
            metrics = {
                userId,
                sessionId,
                searchCount: 0,
                averageSearchTime: 0,
                clickThroughRate: 0,
                refinementRate: 0,
                exportCount: 0,
                averageSessionDuration: 0,
                popularQueries: [],
                preferredCategories: []
            };
            this.userSessions.set(userId, metrics);
        }
        switch (action) {
            case 'search':
                metrics.searchCount++;
                metrics.averageSearchTime =
                    (metrics.averageSearchTime + data.searchTime) / 2;
                this.updatePopularQueries(metrics, data.query);
                break;
            case 'click':
                const totalClicks = (metrics.clickThroughRate * metrics.searchCount) + 1;
                metrics.clickThroughRate = totalClicks / metrics.searchCount;
                break;
            case 'refine':
                const totalRefinements = (metrics.refinementRate * metrics.searchCount) + 1;
                metrics.refinementRate = totalRefinements / metrics.searchCount;
                break;
            case 'export':
                metrics.exportCount++;
                break;
        }
    }
    trackSearchQuality(quality) {
        this.qualityMetrics.push(quality);
        if (this.qualityMetrics.length > 1000) {
            this.qualityMetrics.shift();
        }
    }
    updateSearchQuality(query, updates) {
        const anonymizedQuery = this.anonymizeQuery(query);
        const existing = this.qualityMetrics.find(m => m.query === anonymizedQuery);
        if (existing) {
            Object.assign(existing, updates);
        }
    }
    startBatchProcessing() {
        this.batchTimer = setInterval(() => {
            if (this.eventBuffer.length > 0) {
                this.processBatch();
            }
        }, this.config.batchTimeout);
    }
    processBatch() {
        const batch = [...this.eventBuffer];
        this.eventBuffer = [];
        this.sendToBackend(batch);
        this.emit('batchProcessed', { size: batch.length });
    }
    sendToBackend(events) {
        console.log(`Processing analytics batch of ${events.length} events`);
        if (window.electronAPI?.sendAnalytics) {
            window.electronAPI.sendAnalytics(events).catch(console.error);
        }
    }
    startMetricsCollection() {
        this.metricsTimer = setInterval(() => {
            this.collectSystemMetrics();
            this.checkAlerts();
        }, 30000);
    }
    collectSystemMetrics() {
        this.systemMetrics.resourceUsage = {
            memoryUsage: performance.memory?.usedJSHeapSize || 0,
            cpuUsage: Math.random() * 100,
            indexSize: this.performanceBuffer.length * 1000
        };
    }
    checkAlerts() {
        for (const rule of this.alertRules) {
            if (rule.lastTriggered &&
                Date.now() - rule.lastTriggered < rule.cooldownPeriod) {
                continue;
            }
            if (rule.condition(this.systemMetrics)) {
                rule.lastTriggered = Date.now();
                this.emit('alert', {
                    ruleId: rule.id,
                    name: rule.name,
                    severity: rule.severity,
                    timestamp: Date.now(),
                    metrics: this.systemMetrics
                });
            }
        }
    }
    setupDefaultAlerts() {
        this.addAlertRule({
            id: 'high-error-rate',
            name: 'High Error Rate',
            condition: (metrics) => metrics.errorRate.percentage > 5,
            severity: 'high',
            cooldownPeriod: 5 * 60 * 1000
        });
        this.addAlertRule({
            id: 'high-latency',
            name: 'High Search Latency',
            condition: (metrics) => metrics.searchLatency.p95 > 2000,
            severity: 'medium',
            cooldownPeriod: 5 * 60 * 1000
        });
        this.addAlertRule({
            id: 'low-cache-hit-rate',
            name: 'Low Cache Hit Rate',
            condition: (metrics) => metrics.cachePerformance.hitRate < 0.5,
            severity: 'medium',
            cooldownPeriod: 10 * 60 * 1000
        });
    }
    initializeSystemMetrics() {
        return {
            searchLatency: { p50: 0, p95: 0, p99: 0, average: 0 },
            throughput: { requestsPerSecond: 0, requestsPerMinute: 0, requestsPerHour: 0 },
            errorRate: { total: 0, percentage: 0, byType: {} },
            cachePerformance: { hitRate: 0, missRate: 0, evictionRate: 0 },
            resourceUsage: { memoryUsage: 0, cpuUsage: 0, indexSize: 0 }
        };
    }
    updateSystemMetrics(performanceMetrics) {
        const latencies = this.performanceBuffer.map(m => m.searchTime);
        if (latencies.length > 0) {
            latencies.sort((a, b) => a - b);
            this.systemMetrics.searchLatency = {
                p50: this.percentile(latencies, 50),
                p95: this.percentile(latencies, 95),
                p99: this.percentile(latencies, 99),
                average: latencies.reduce((sum, val) => sum + val, 0) / latencies.length
            };
        }
        const cacheHits = this.performanceBuffer.filter(m => m.cacheHit).length;
        const total = this.performanceBuffer.length;
        if (total > 0) {
            this.systemMetrics.cachePerformance.hitRate = cacheHits / total;
            this.systemMetrics.cachePerformance.missRate = (total - cacheHits) / total;
        }
    }
    updateSystemErrorMetrics(error, context) {
        this.systemMetrics.errorRate.total++;
        const errorType = context.operation || 'unknown';
        this.systemMetrics.errorRate.byType[errorType] =
            (this.systemMetrics.errorRate.byType[errorType] || 0) + 1;
        const recentOperations = this.performanceBuffer.length + this.systemMetrics.errorRate.total;
        this.systemMetrics.errorRate.percentage =
            (this.systemMetrics.errorRate.total / recentOperations) * 100;
    }
    anonymizeQuery(query) {
        if (!this.config.anonymizeData)
            return query;
        return btoa(query).substring(0, 16);
    }
    sanitizeOptions(options) {
        const { userId, sessionId, ...sanitized } = options;
        return sanitized;
    }
    sanitizeFeedback(feedback) {
        return feedback.replace(/\b\w+@\w+\.\w+\b/g, '[email]')
            .replace(/\b\d{4}\b/g, '[year]');
    }
    calculateRelevanceScore(results) {
        if (results.length === 0)
            return 0;
        const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
        return averageScore / 100;
    }
    percentile(arr, p) {
        if (arr.length === 0)
            return 0;
        const index = Math.ceil((p / 100) * arr.length) - 1;
        return arr[Math.max(0, Math.min(index, arr.length - 1))];
    }
    filterMetricsByTimeRange(metrics, timeRange) {
        if (!timeRange)
            return metrics;
        return metrics.filter(m => m.timestamp >= timeRange.from && m.timestamp <= timeRange.to);
    }
    updatePopularQueries(metrics, query) {
        const existing = metrics.popularQueries.find(pq => pq.query === query);
        if (existing) {
            existing.count++;
        }
        else {
            metrics.popularQueries.push({ query, count: 1 });
        }
        metrics.popularQueries = metrics.popularQueries
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }
    aggregateUserBehavior(behaviors) {
        if (behaviors.length === 0)
            return {};
        return {
            totalUsers: behaviors.length,
            averageSearches: behaviors.reduce((sum, b) => sum + b.searchCount, 0) / behaviors.length,
            averageCTR: behaviors.reduce((sum, b) => sum + b.clickThroughRate, 0) / behaviors.length,
            averageRefinementRate: behaviors.reduce((sum, b) => sum + b.refinementRate, 0) / behaviors.length,
            topQueries: this.mergePopularQueries(behaviors.map(b => b.popularQueries))
        };
    }
    aggregateSearchQuality(qualities) {
        if (qualities.length === 0)
            return {};
        const avgRelevance = qualities.reduce((sum, q) => sum + q.resultRelevance, 0) / qualities.length;
        const zeroResultRate = qualities.filter(q => q.zeroResultRate > 0).length / qualities.length;
        const avgClickPosition = qualities
            .filter(q => q.clickPosition > 0)
            .reduce((sum, q) => sum + q.clickPosition, 0) / qualities.length;
        return {
            averageRelevance: avgRelevance,
            zeroResultRate,
            averageClickPosition: avgClickPosition || 0,
            refinementRate: qualities.filter(q => q.refinementNeeded).length / qualities.length
        };
    }
    getTopQueries(events) {
        const queryCount = new Map();
        events
            .filter(e => e.type === 'search_performed' && e.data.query)
            .forEach(e => {
            const query = e.data.query;
            queryCount.set(query, (queryCount.get(query) || 0) + 1);
        });
        return Array.from(queryCount.entries())
            .map(([query, count]) => ({ query, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }
    analyzeErrors(events) {
        const errors = events.filter(e => e.type === 'error_occurred');
        const errorsByType = new Map();
        errors.forEach(e => {
            const operation = e.data.operation || 'unknown';
            errorsByType.set(operation, (errorsByType.get(operation) || 0) + 1);
        });
        return {
            totalErrors: errors.length,
            errorsByType: Object.fromEntries(errorsByType),
            recentErrors: errors.slice(-10).map(e => ({
                timestamp: e.timestamp,
                operation: e.data.operation,
                message: e.data.errorMessage
            }))
        };
    }
    mergePopularQueries(queryArrays) {
        const merged = new Map();
        queryArrays.forEach(queries => {
            queries.forEach(({ query, count }) => {
                merged.set(query, (merged.get(query) || 0) + count);
            });
        });
        return Array.from(merged.entries())
            .map(([query, count]) => ({ query, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }
    convertToCSV(data) {
        return JSON.stringify(data);
    }
    generateEventId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    getCurrentUserId() {
        return localStorage.getItem('userId') || 'anonymous';
    }
    getCurrentSessionId() {
        return localStorage.getItem('sessionId') || this.generateEventId();
    }
    destroy() {
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
        }
        if (this.metricsTimer) {
            clearInterval(this.metricsTimer);
        }
        if (this.eventBuffer.length > 0) {
            this.processBatch();
        }
        this.removeAllListeners();
    }
}
exports.SearchAnalyticsService = SearchAnalyticsService;
exports.default = SearchAnalyticsService;
//# sourceMappingURL=SearchAnalyticsService.js.map