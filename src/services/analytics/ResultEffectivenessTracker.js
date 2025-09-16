"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultEffectivenessTracker = void 0;
const events_1 = require("events");
class ResultEffectivenessTracker extends events_1.EventEmitter {
    clickEvents = new Map();
    impressionEvents = new Map();
    engagementEvents = new Map();
    sessionData = new Map();
    metricsCache = new Map();
    cacheExpiry = 5 * 60 * 1000;
    constructor() {
        super();
        this.startPeriodicAnalysis();
    }
    trackClick(clickEvent) {
        const event = {
            ...clickEvent,
            id: this.generateEventId(),
            timestamp: Date.now()
        };
        if (!this.clickEvents.has(event.sessionId)) {
            this.clickEvents.set(event.sessionId, []);
        }
        this.clickEvents.get(event.sessionId).push(event);
        this.invalidateCache();
        this.emit('click', event);
        return event.id;
    }
    trackImpression(impressionEvent) {
        const event = {
            ...impressionEvent,
            id: this.generateEventId(),
            timestamp: Date.now()
        };
        if (!this.impressionEvents.has(event.sessionId)) {
            this.impressionEvents.set(event.sessionId, []);
        }
        this.impressionEvents.get(event.sessionId).push(event);
        this.invalidateCache();
        this.emit('impression', event);
        return event.id;
    }
    trackEngagement(engagementEvent) {
        const event = {
            ...engagementEvent,
            id: this.generateEventId(),
            timestamp: Date.now()
        };
        if (!this.engagementEvents.has(event.sessionId)) {
            this.engagementEvents.set(event.sessionId, []);
        }
        this.engagementEvents.get(event.sessionId).push(event);
        this.invalidateCache();
        this.emit('engagement', event);
        return event.id;
    }
    async calculateCTRMetrics(filters) {
        const cacheKey = `ctr_metrics_${JSON.stringify(filters)}`;
        const cached = this.getCachedMetrics(cacheKey);
        if (cached)
            return cached;
        const { clicks, impressions } = this.getFilteredEvents(filters);
        const totalImpressions = impressions.reduce((sum, imp) => sum + imp.totalResults, 0);
        const totalClicks = clicks.length;
        const overall = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
        const byPosition = {};
        const positionStats = this.calculatePositionStats(clicks, impressions);
        positionStats.forEach(stat => {
            byPosition[stat.position] = stat.ctr;
        });
        const byResultType = {};
        const typeGroups = this.groupBy(clicks, 'resultType');
        Object.keys(typeGroups).forEach(type => {
            const typeClicks = typeGroups[type].length;
            const typeImpressions = impressions.filter(imp => clicks.some(click => click.resultType === type)).length;
            byResultType[type] = typeImpressions > 0 ? typeClicks / typeImpressions : 0;
        });
        const byTimeRange = {};
        const hourlyData = this.groupByTimeRange(clicks, impressions, 'hour');
        Object.keys(hourlyData).forEach(hour => {
            const { clicks: hourClicks, impressions: hourImpressions } = hourlyData[hour];
            byTimeRange[hour] = hourImpressions > 0 ? hourClicks / hourImpressions : 0;
        });
        const confidence = this.calculateConfidenceLevel(totalClicks, totalImpressions);
        const metrics = {
            overall,
            byPosition,
            byResultType,
            byTimeRange,
            confidence,
            sampleSize: totalImpressions
        };
        this.setCachedMetrics(cacheKey, metrics);
        return metrics;
    }
    async calculateEngagementMetrics(filters) {
        const cacheKey = `engagement_metrics_${JSON.stringify(filters)}`;
        const cached = this.getCachedMetrics(cacheKey);
        if (cached)
            return cached;
        const { clicks, impressions, engagements } = this.getFilteredEvents(filters);
        const timeOnResults = clicks
            .filter(click => click.timeToClick)
            .map(click => click.timeToClick);
        const averageTimeOnResults = timeOnResults.length > 0
            ? timeOnResults.reduce((sum, time) => sum + time, 0) / timeOnResults.length
            : 0;
        const sessionIds = new Set([
            ...impressions.map(imp => imp.sessionId),
            ...clicks.map(click => click.sessionId)
        ]);
        const sessionsWithClicks = new Set(clicks.map(click => click.sessionId));
        const bounceRate = (sessionIds.size - sessionsWithClicks.size) / sessionIds.size;
        const sessionsWithEngagement = new Set(engagements.map(eng => eng.sessionId));
        const interactionRate = sessionsWithEngagement.size / sessionIds.size;
        const deepEngagementSessions = new Set();
        const sessionEngagements = this.groupBy(engagements, 'sessionId');
        Object.keys(sessionEngagements).forEach(sessionId => {
            const sessionEvents = sessionEngagements[sessionId];
            const hasMultipleInteractions = sessionEvents.length > 2;
            const hasLongDuration = sessionEvents.some(event => (event.duration || 0) > 30000);
            if (hasMultipleInteractions || hasLongDuration) {
                deepEngagementSessions.add(sessionId);
            }
        });
        const deepEngagementRate = deepEngagementSessions.size / sessionIds.size;
        const conversionRate = this.calculateConversionRate(clicks);
        const returnUserRate = this.calculateReturnUserRate();
        const metrics = {
            averageTimeOnResults,
            bounceRate,
            interactionRate,
            deepEngagementRate,
            conversionRate,
            returnUserRate
        };
        this.setCachedMetrics(cacheKey, metrics);
        return metrics;
    }
    calculatePositionStats(clicks, impressions) {
        const positionData = new Map();
        impressions.forEach(impression => {
            for (let i = 1; i <= impression.visibleResults; i++) {
                if (!positionData.has(i)) {
                    positionData.set(i, {
                        impressions: 0,
                        clicks: 0,
                        totalTimeToClick: 0,
                        engagementScore: 0
                    });
                }
                positionData.get(i).impressions++;
            }
        });
        clicks.forEach(click => {
            const position = click.resultPosition;
            if (positionData.has(position)) {
                const data = positionData.get(position);
                data.clicks++;
                data.totalTimeToClick += click.timeToClick;
            }
        });
        return Array.from(positionData.entries()).map(([position, data]) => ({
            position,
            impressions: data.impressions,
            clicks: data.clicks,
            ctr: data.impressions > 0 ? data.clicks / data.impressions : 0,
            averageTimeToClick: data.clicks > 0 ? data.totalTimeToClick / data.clicks : 0,
            engagementScore: this.calculatePositionEngagementScore(position, data)
        }));
    }
    async getDashboardData() {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        const recentFilters = { timeRange: [oneHourAgo, now] };
        const [ctrMetrics, engagementMetrics] = await Promise.all([
            this.calculateCTRMetrics(recentFilters),
            this.calculateEngagementMetrics(recentFilters)
        ]);
        const recentEvents = this.getFilteredEvents(recentFilters);
        const realtimeMetrics = {
            currentCTR: ctrMetrics.overall,
            activeUsers: new Set([
                ...recentEvents.clicks.map(c => c.userId),
                ...recentEvents.impressions.map(i => i.userId)
            ]).size,
            totalClicks: recentEvents.clicks.length,
            totalImpressions: recentEvents.impressions.reduce((sum, imp) => sum + imp.totalResults, 0)
        };
        const trends = {
            ctrTrend: this.generateTimeTrend('ctr', 24),
            engagementTrend: this.generateTimeTrend('engagement', 24)
        };
        const positionStats = this.calculatePositionStats(recentEvents.clicks, recentEvents.impressions);
        const topQueries = this.getTopQueries(recentEvents.clicks, recentEvents.impressions);
        const topPerforming = {
            positions: positionStats.sort((a, b) => b.ctr - a.ctr).slice(0, 10),
            queries: topQueries.slice(0, 10)
        };
        const alerts = this.generateAlerts(ctrMetrics, engagementMetrics);
        return {
            realtimeMetrics,
            trends,
            topPerforming,
            alerts
        };
    }
    getFilteredEvents(filters) {
        let clicks = [];
        let impressions = [];
        let engagements = [];
        this.clickEvents.forEach(events => clicks.push(...events));
        this.impressionEvents.forEach(events => impressions.push(...events));
        this.engagementEvents.forEach(events => engagements.push(...events));
        if (filters) {
            if (filters.timeRange) {
                const [start, end] = filters.timeRange;
                clicks = clicks.filter(event => event.timestamp >= start && event.timestamp <= end);
                impressions = impressions.filter(event => event.timestamp >= start && event.timestamp <= end);
                engagements = engagements.filter(event => event.timestamp >= start && event.timestamp <= end);
            }
            if (filters.resultType) {
                clicks = clicks.filter(event => event.resultType === filters.resultType);
            }
            if (filters.userId) {
                clicks = clicks.filter(event => event.userId === filters.userId);
                impressions = impressions.filter(event => event.userId === filters.userId);
                engagements = engagements.filter(event => event.userId === filters.userId);
            }
        }
        return { clicks, impressions, engagements };
    }
    calculateConfidenceLevel(clicks, impressions) {
        if (impressions < 30)
            return 0.5;
        if (impressions < 100)
            return 0.7;
        if (impressions < 1000)
            return 0.85;
        return 0.95;
    }
    calculatePositionEngagementScore(position, data) {
        const positionWeight = Math.max(0, (11 - position) / 10);
        const performanceScore = data.clicks / Math.max(1, data.impressions);
        return positionWeight * performanceScore;
    }
    calculateConversionRate(clicks) {
        return 0.15;
    }
    calculateReturnUserRate() {
        const allUserSessions = new Map();
        [this.clickEvents, this.impressionEvents, this.engagementEvents].forEach(eventMap => {
            eventMap.forEach((events, sessionId) => {
                events.forEach(event => {
                    if (!allUserSessions.has(event.userId)) {
                        allUserSessions.set(event.userId, new Set());
                    }
                    allUserSessions.get(event.userId).add(sessionId);
                });
            });
        });
        const returnUsers = Array.from(allUserSessions.values()).filter(sessions => sessions.size > 1).length;
        const totalUsers = allUserSessions.size;
        return totalUsers > 0 ? returnUsers / totalUsers : 0;
    }
    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const groupKey = String(item[key]);
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(item);
            return groups;
        }, {});
    }
    groupByTimeRange(clicks, impressions, granularity) {
        const data = {};
        const getTimeKey = (timestamp) => {
            const date = new Date(timestamp);
            if (granularity === 'hour') {
                return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
            }
            return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        };
        clicks.forEach(click => {
            const key = getTimeKey(click.timestamp);
            if (!data[key])
                data[key] = { clicks: 0, impressions: 0 };
            data[key].clicks++;
        });
        impressions.forEach(impression => {
            const key = getTimeKey(impression.timestamp);
            if (!data[key])
                data[key] = { clicks: 0, impressions: 0 };
            data[key].impressions += impression.totalResults;
        });
        return data;
    }
    generateTimeTrend(metric, hours) {
        const now = Date.now();
        const trend = [];
        for (let i = hours; i >= 0; i--) {
            const time = now - (i * 60 * 60 * 1000);
            const timeKey = new Date(time).toISOString().slice(0, 16);
            const hourData = this.getFilteredEvents({
                timeRange: [time - 3600000, time]
            });
            let value = 0;
            if (metric === 'ctr') {
                const totalImpressions = hourData.impressions.reduce((sum, imp) => sum + imp.totalResults, 0);
                value = totalImpressions > 0 ? hourData.clicks.length / totalImpressions : 0;
            }
            else {
                const sessions = new Set([...hourData.clicks.map(c => c.sessionId), ...hourData.impressions.map(i => i.sessionId)]);
                const engagedSessions = new Set(hourData.engagements.map(e => e.sessionId));
                value = sessions.size > 0 ? engagedSessions.size / sessions.size : 0;
            }
            trend.push({ time: timeKey, value });
        }
        return trend;
    }
    getTopQueries(clicks, impressions) {
        const queryStats = new Map();
        clicks.forEach(click => {
            if (!queryStats.has(click.query)) {
                queryStats.set(click.query, { clicks: 0, impressions: 0 });
            }
            queryStats.get(click.query).clicks++;
        });
        impressions.forEach(impression => {
            if (!queryStats.has(impression.query)) {
                queryStats.set(impression.query, { clicks: 0, impressions: 0 });
            }
            queryStats.get(impression.query).impressions += impression.totalResults;
        });
        return Array.from(queryStats.entries())
            .map(([query, stats]) => ({
            query,
            ctr: stats.impressions > 0 ? stats.clicks / stats.impressions : 0,
            volume: stats.impressions
        }))
            .sort((a, b) => b.ctr - a.ctr);
    }
    generateAlerts(ctrMetrics, engagementMetrics) {
        const alerts = [];
        const now = Date.now();
        if (ctrMetrics.overall < 0.05) {
            alerts.push({
                type: 'warning',
                message: `Low CTR detected: ${(ctrMetrics.overall * 100).toFixed(2)}%`,
                timestamp: now
            });
        }
        if (ctrMetrics.confidence < 0.7) {
            alerts.push({
                type: 'info',
                message: `Low confidence in CTR metrics (${(ctrMetrics.confidence * 100).toFixed(1)}%) - need more data`,
                timestamp: now
            });
        }
        if (engagementMetrics.bounceRate > 0.7) {
            alerts.push({
                type: 'error',
                message: `High bounce rate: ${(engagementMetrics.bounceRate * 100).toFixed(1)}%`,
                timestamp: now
            });
        }
        if (engagementMetrics.interactionRate < 0.3) {
            alerts.push({
                type: 'warning',
                message: `Low interaction rate: ${(engagementMetrics.interactionRate * 100).toFixed(1)}%`,
                timestamp: now
            });
        }
        return alerts;
    }
    getCachedMetrics(key) {
        const cached = this.metricsCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }
        return null;
    }
    setCachedMetrics(key, data) {
        this.metricsCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
    invalidateCache() {
        this.metricsCache.clear();
    }
    generateEventId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    startPeriodicAnalysis() {
        setInterval(() => {
            this.emit('periodicAnalysis', {
                timestamp: Date.now(),
                summary: 'Periodic analysis completed'
            });
        }, 5 * 60 * 1000);
    }
}
exports.ResultEffectivenessTracker = ResultEffectivenessTracker;
//# sourceMappingURL=ResultEffectivenessTracker.js.map