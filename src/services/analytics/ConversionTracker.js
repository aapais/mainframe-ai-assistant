"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversionTracker = void 0;
const events_1 = require("events");
class ConversionTracker extends events_1.EventEmitter {
    goals = new Map();
    events = new Map();
    conversions = new Map();
    funnels = new Map();
    attributionModels = new Map();
    metricsCache = new Map();
    cacheExpiry = 5 * 60 * 1000;
    activeUserSessions = new Map();
    constructor() {
        super();
        this.initializeDefaultGoals();
        this.initializeAttributionModels();
        this.startSessionMonitoring();
    }
    createGoal(goal) {
        const goalRecord = {
            ...goal,
            id: this.generateId(),
            metadata: {
                ...goal.metadata,
                createdAt: Date.now()
            }
        };
        this.goals.set(goalRecord.id, goalRecord);
        this.invalidateCache();
        this.emit('goalCreated', goalRecord);
        return goalRecord.id;
    }
    trackEvent(event) {
        const eventRecord = {
            ...event,
            id: this.generateId(),
            timestamp: Date.now()
        };
        if (!this.events.has(event.userId)) {
            this.events.set(event.userId, []);
        }
        this.events.get(event.userId).push(eventRecord);
        this.updateActiveSession(event.sessionId, event.userId, eventRecord);
        this.invalidateCache();
        this.emit('eventTracked', eventRecord);
        this.checkGoalCompletions(event.userId, eventRecord);
        return eventRecord.id;
    }
    async checkGoalCompletions(userId, triggerEvent) {
        const userEvents = this.events.get(userId) || [];
        const activeGoals = Array.from(this.goals.values()).filter(goal => goal.metadata.isActive);
        for (const goal of activeGoals) {
            const isCompleted = await this.evaluateGoalCompletion(goal, userEvents, triggerEvent);
            if (isCompleted) {
                await this.recordConversion(userId, goal, userEvents, triggerEvent);
            }
        }
    }
    async evaluateGoalCompletion(goal, userEvents, triggerEvent) {
        const { triggers, timeframe, sequence } = goal.conditions;
        const matchingTrigger = triggers.find(trigger => this.eventMatchesTrigger(triggerEvent, trigger));
        if (!matchingTrigger && triggers.length > 0) {
            return false;
        }
        if (sequence) {
            return this.validateEventSequence(triggers, userEvents, timeframe);
        }
        return this.validateAllTriggers(triggers, userEvents, timeframe);
    }
    async recordConversion(userId, goal, userEvents, completionEvent) {
        const existingConversions = this.conversions.get(userId) || [];
        const isDuplicate = existingConversions.some(conv => conv.goalId === goal.id &&
            Math.abs(conv.completedAt - completionEvent.timestamp) < 5000);
        if (isDuplicate) {
            return;
        }
        const touchpoints = this.findRelevantTouchpoints(userEvents, goal, completionEvent);
        const attribution = this.calculateAttribution(touchpoints, 'last_touch');
        const funnel = await this.calculateFunnelPosition(userId, goal, touchpoints);
        const firstTouchTime = touchpoints.length > 0 ? touchpoints[0].timestamp : completionEvent.timestamp;
        const timeToConvert = completionEvent.timestamp - firstTouchTime;
        const conversion = {
            id: this.generateId(),
            userId,
            sessionId: completionEvent.sessionId,
            goalId: goal.id,
            goalName: goal.name,
            completedAt: completionEvent.timestamp,
            value: goal.value,
            timeToConvert,
            touchpoints,
            attribution,
            funnel
        };
        if (!this.conversions.has(userId)) {
            this.conversions.set(userId, []);
        }
        this.conversions.get(userId).push(conversion);
        this.invalidateCache();
        this.emit('conversionRecorded', conversion);
        this.updateFunnelAnalytics(conversion);
    }
    async calculateConversionMetrics(filters) {
        const cacheKey = `conversion_metrics_${JSON.stringify(filters)}`;
        const cached = this.getCachedMetrics(cacheKey);
        if (cached)
            return cached;
        const { conversions, events } = this.getFilteredData(filters);
        const totalConversions = conversions.length;
        const totalValue = conversions.reduce((sum, conv) => sum + conv.value, 0);
        const averageValue = totalConversions > 0 ? totalValue / totalConversions : 0;
        const timeToConvertValues = conversions.map(conv => conv.timeToConvert);
        const averageTimeToConvert = timeToConvertValues.length > 0
            ? timeToConvertValues.reduce((sum, time) => sum + time, 0) / timeToConvertValues.length
            : 0;
        const uniqueUsers = new Set([
            ...conversions.map(conv => conv.userId),
            ...events.map(event => event.userId)
        ]).size;
        const conversionRate = uniqueUsers > 0 ? (new Set(conversions.map(conv => conv.userId)).size / uniqueUsers) * 100 : 0;
        const overall = {
            conversionRate,
            totalConversions,
            totalValue,
            averageValue,
            averageTimeToConvert
        };
        const byGoal = this.calculateGoalMetrics(conversions, events);
        const bySource = this.calculateSourceMetrics(conversions);
        const byTimeframe = this.calculateTimeframeMetrics(conversions);
        const funnelAnalysis = await this.calculateFunnelAnalysis(conversions, events);
        const metrics = {
            overall,
            byGoal,
            bySource,
            byTimeframe,
            funnelAnalysis
        };
        this.setCachedMetrics(cacheKey, metrics);
        return metrics;
    }
    createFunnel(funnel) {
        const funnelRecord = {
            ...funnel,
            id: this.generateId(),
            createdAt: Date.now()
        };
        this.funnels.set(funnelRecord.id, funnelRecord);
        this.emit('funnelCreated', funnelRecord);
        return funnelRecord.id;
    }
    async analyzeFunnelPerformance(funnelId, timeRange) {
        const funnel = this.funnels.get(funnelId);
        if (!funnel) {
            throw new Error(`Funnel with ID ${funnelId} not found`);
        }
        const { events } = this.getFilteredData({ timeRange });
        const performance = await Promise.all(funnel.stages.map(async (stage, index) => {
            const stageUsers = this.getUsersInStage(stage, events);
            const stageCompletions = this.getStageCompletions(stage, events);
            const conversionRate = stageUsers.size > 0 ? (stageCompletions.size / stageUsers.size) * 100 : 0;
            const dropoffRate = 100 - conversionRate;
            const averageTimeInStage = this.calculateAverageTimeInStage(stage, events);
            return {
                stage,
                users: stageUsers.size,
                completions: stageCompletions.size,
                conversionRate,
                dropoffRate,
                averageTimeInStage
            };
        }));
        const insights = this.generateFunnelInsights(performance);
        return {
            funnel,
            performance,
            insights
        };
    }
    async getAttributionAnalysis(modelType = 'last_touch', timeRange) {
        const { conversions } = this.getFilteredData({ timeRange });
        const model = this.attributionModels.get(modelType);
        if (!model) {
            throw new Error(`Attribution model ${modelType} not found`);
        }
        const attributionData = {};
        conversions.forEach(conversion => {
            const attribution = this.calculateAttribution(conversion.touchpoints, modelType);
            Object.entries(attribution.weights).forEach(([source, weight]) => {
                if (!attributionData[source]) {
                    attributionData[source] = { conversions: 0, value: 0 };
                }
                attributionData[source].conversions += weight;
                attributionData[source].value += conversion.value * weight;
            });
        });
        const totalConversions = Object.values(attributionData).reduce((sum, data) => sum + data.conversions, 0);
        const attribution = {};
        Object.entries(attributionData).forEach(([source, data]) => {
            attribution[source] = {
                ...data,
                percentage: totalConversions > 0 ? (data.conversions / totalConversions) * 100 : 0
            };
        });
        const comparison = await this.compareAttributionModels(conversions);
        return {
            model,
            attribution,
            comparison
        };
    }
    async getConversionDashboard() {
        const now = Date.now();
        const todayStart = new Date(now).setHours(0, 0, 0, 0);
        const todayConversions = this.getFilteredData({
            timeRange: [todayStart, now]
        }).conversions;
        const realtimeMetrics = {
            conversionsToday: todayConversions.length,
            conversionRateToday: await this.calculateTodayConversionRate(),
            valueToday: todayConversions.reduce((sum, conv) => sum + conv.value, 0),
            activeGoals: Array.from(this.goals.values()).filter(goal => goal.metadata.isActive).length
        };
        const topConvertingGoals = await this.getTopConvertingGoals(5);
        const conversionTrends = this.generateConversionTrends(24);
        const funnelHealth = await this.assessFunnelHealth();
        const alerts = await this.generateConversionAlerts();
        return {
            realtimeMetrics,
            topConvertingGoals,
            conversionTrends,
            funnelHealth,
            alerts
        };
    }
    getFilteredData(filters) {
        let conversions = [];
        let events = [];
        this.conversions.forEach(userConversions => conversions.push(...userConversions));
        this.events.forEach(userEvents => events.push(...userEvents));
        if (filters) {
            if (filters.timeRange) {
                const [start, end] = filters.timeRange;
                conversions = conversions.filter(conv => conv.completedAt >= start && conv.completedAt <= end);
                events = events.filter(event => event.timestamp >= start && event.timestamp <= end);
            }
            if (filters.goalIds) {
                conversions = conversions.filter(conv => filters.goalIds.includes(conv.goalId));
            }
        }
        return { conversions, events };
    }
    eventMatchesTrigger(event, trigger) {
        if (event.eventType !== trigger.event) {
            return false;
        }
        if (trigger.parameters) {
            return Object.entries(trigger.parameters).every(([key, expectedValue]) => {
                const actualValue = event.properties[key];
                const operator = trigger.operator || 'equals';
                switch (operator) {
                    case 'equals':
                        return actualValue === expectedValue;
                    case 'contains':
                        return String(actualValue).includes(String(expectedValue));
                    case 'greater_than':
                        return Number(actualValue) > Number(expectedValue);
                    case 'less_than':
                        return Number(actualValue) < Number(expectedValue);
                    default:
                        return actualValue === expectedValue;
                }
            });
        }
        return true;
    }
    validateEventSequence(triggers, userEvents, timeframe) {
        let triggerIndex = 0;
        const startTime = timeframe ? Date.now() - timeframe : 0;
        for (const event of userEvents) {
            if (event.timestamp < startTime)
                continue;
            if (triggerIndex < triggers.length && this.eventMatchesTrigger(event, triggers[triggerIndex])) {
                triggerIndex++;
                if (triggerIndex === triggers.length) {
                    return true;
                }
            }
        }
        return false;
    }
    validateAllTriggers(triggers, userEvents, timeframe) {
        const startTime = timeframe ? Date.now() - timeframe : 0;
        const relevantEvents = userEvents.filter(event => event.timestamp >= startTime);
        return triggers.every(trigger => relevantEvents.some(event => this.eventMatchesTrigger(event, trigger)));
    }
    findRelevantTouchpoints(userEvents, goal, completionEvent) {
        const lookbackTime = goal.conditions.timeframe || (30 * 24 * 60 * 60 * 1000);
        const startTime = completionEvent.timestamp - lookbackTime;
        return userEvents
            .filter(event => event.timestamp >= startTime && event.timestamp <= completionEvent.timestamp)
            .sort((a, b) => a.timestamp - b.timestamp);
    }
    calculateAttribution(touchpoints, modelType) {
        if (touchpoints.length === 0) {
            return {
                firstTouch: touchpoints[0],
                lastTouch: touchpoints[0],
                assistingTouches: [],
                model: modelType,
                weights: {}
            };
        }
        const firstTouch = touchpoints[0];
        const lastTouch = touchpoints[touchpoints.length - 1];
        const assistingTouches = touchpoints.slice(1, -1);
        const weights = {};
        switch (modelType) {
            case 'first_touch':
                weights[this.getTouchpointSource(firstTouch)] = 1;
                break;
            case 'last_touch':
                weights[this.getTouchpointSource(lastTouch)] = 1;
                break;
            case 'linear':
                touchpoints.forEach(touchpoint => {
                    const source = this.getTouchpointSource(touchpoint);
                    weights[source] = (weights[source] || 0) + (1 / touchpoints.length);
                });
                break;
            case 'time_decay':
                const decayRate = 0.5;
                const totalWeight = touchpoints.reduce((sum, touchpoint, index) => {
                    const timeFromEnd = touchpoints.length - 1 - index;
                    return sum + Math.pow(decayRate, timeFromEnd);
                }, 0);
                touchpoints.forEach((touchpoint, index) => {
                    const timeFromEnd = touchpoints.length - 1 - index;
                    const weight = Math.pow(decayRate, timeFromEnd) / totalWeight;
                    const source = this.getTouchpointSource(touchpoint);
                    weights[source] = (weights[source] || 0) + weight;
                });
                break;
            case 'position_based':
                if (touchpoints.length === 1) {
                    weights[this.getTouchpointSource(firstTouch)] = 1;
                }
                else {
                    weights[this.getTouchpointSource(firstTouch)] = 0.4;
                    weights[this.getTouchpointSource(lastTouch)] = (weights[this.getTouchpointSource(lastTouch)] || 0) + 0.4;
                    if (assistingTouches.length > 0) {
                        const middleWeight = 0.2 / assistingTouches.length;
                        assistingTouches.forEach(touchpoint => {
                            const source = this.getTouchpointSource(touchpoint);
                            weights[source] = (weights[source] || 0) + middleWeight;
                        });
                    }
                }
                break;
            default:
                weights[this.getTouchpointSource(lastTouch)] = 1;
        }
        return {
            firstTouch,
            lastTouch,
            assistingTouches,
            model: modelType,
            weights
        };
    }
    getTouchpointSource(touchpoint) {
        return touchpoint.source.campaign || touchpoint.source.referrer || touchpoint.source.page || 'direct';
    }
    async calculateFunnelPosition(userId, goal, touchpoints) {
        const funnel = Array.from(this.funnels.values()).find(f => f.goalId === goal.id);
        if (!funnel) {
            return {
                stage: 'conversion',
                completionRate: 1,
            };
        }
        let completedStages = 0;
        let dropoffPoint;
        for (const stage of funnel.stages) {
            const stageCompleted = stage.conditions.every(condition => touchpoints.some(touchpoint => this.eventMatchesTrigger(touchpoint, condition)));
            if (stageCompleted) {
                completedStages++;
            }
            else if (stage.isRequired) {
                dropoffPoint = stage.name;
                break;
            }
        }
        const completionRate = completedStages / funnel.stages.length;
        return {
            stage: funnel.stages[Math.min(completedStages, funnel.stages.length - 1)].name,
            completionRate,
            dropoffPoint
        };
    }
    calculateGoalMetrics(conversions, events) {
        const goalMetrics = {};
        const conversionsByGoal = this.groupBy(conversions, 'goalId');
        const usersByGoal = {};
        events.forEach(event => {
            const goal = Array.from(this.goals.values()).find(g => g.conditions.triggers.some(trigger => trigger.event === event.eventType));
            if (goal) {
                if (!usersByGoal[goal.id]) {
                    usersByGoal[goal.id] = new Set();
                }
                usersByGoal[goal.id].add(event.userId);
            }
        });
        Object.entries(conversionsByGoal).forEach(([goalId, goalConversions]) => {
            const uniqueConverters = new Set(goalConversions.map(conv => conv.userId)).size;
            const totalEligibleUsers = usersByGoal[goalId]?.size || uniqueConverters;
            goalMetrics[goalId] = {
                conversions: goalConversions.length,
                conversionRate: totalEligibleUsers > 0 ? (uniqueConverters / totalEligibleUsers) * 100 : 0,
                value: goalConversions.reduce((sum, conv) => sum + conv.value, 0),
                averageTimeToConvert: goalConversions.length > 0
                    ? goalConversions.reduce((sum, conv) => sum + conv.timeToConvert, 0) / goalConversions.length
                    : 0
            };
        });
        return goalMetrics;
    }
    calculateSourceMetrics(conversions) {
        const sourceMetrics = {};
        conversions.forEach(conversion => {
            const source = this.getTouchpointSource(conversion.attribution.lastTouch);
            if (!sourceMetrics[source]) {
                sourceMetrics[source] = { conversions: 0, conversionRate: 0, value: 0 };
            }
            sourceMetrics[source].conversions++;
            sourceMetrics[source].value += conversion.value;
        });
        Object.keys(sourceMetrics).forEach(source => {
            sourceMetrics[source].conversionRate = sourceMetrics[source].conversions;
        });
        return sourceMetrics;
    }
    calculateTimeframeMetrics(conversions) {
        const timeframeMetrics = [];
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const periodStart = date.setHours(0, 0, 0, 0);
            const periodEnd = date.setHours(23, 59, 59, 999);
            const periodConversions = conversions.filter(conv => conv.completedAt >= periodStart && conv.completedAt <= periodEnd);
            timeframeMetrics.push({
                period: date.toISOString().split('T')[0],
                conversions: periodConversions.length,
                conversionRate: periodConversions.length,
                value: periodConversions.reduce((sum, conv) => sum + conv.value, 0)
            });
        }
        return timeframeMetrics;
    }
    async calculateFunnelAnalysis(conversions, events) {
        const funnelAnalysis = [];
        for (const funnel of this.funnels.values()) {
            if (!funnel.isActive)
                continue;
            let previousStageUsers = new Set();
            let isFirstStage = true;
            for (const stage of funnel.stages) {
                const stageUsers = this.getUsersInStage(stage, events);
                const stageConversions = conversions.filter(conv => conv.goalId === funnel.goalId);
                const eligibleUsers = isFirstStage ? stageUsers : previousStageUsers;
                const conversionRate = eligibleUsers.size > 0 ? (stageUsers.size / eligibleUsers.size) * 100 : 0;
                const dropoffRate = 100 - conversionRate;
                funnelAnalysis.push({
                    stage: stage.name,
                    users: stageUsers.size,
                    conversions: stageConversions.length,
                    conversionRate,
                    dropoffRate
                });
                previousStageUsers = stageUsers;
                isFirstStage = false;
            }
        }
        return funnelAnalysis;
    }
    getUsersInStage(stage, events) {
        const users = new Set();
        events.forEach(event => {
            const meetsConditions = stage.conditions.every(condition => this.eventMatchesTrigger(event, condition));
            if (meetsConditions) {
                users.add(event.userId);
            }
        });
        return users;
    }
    getStageCompletions(stage, events) {
        return this.getUsersInStage(stage, events);
    }
    calculateAverageTimeInStage(stage, events) {
        return 60000;
    }
    generateFunnelInsights(performance) {
        const bottleneckStage = performance.reduce((max, current) => current.dropoffRate > max.dropoffRate ? current : max).stage.name;
        const improvementOpportunities = performance
            .filter(p => p.dropoffRate > 20)
            .map(p => ({
            stage: p.stage.name,
            currentRate: p.conversionRate,
            potentialRate: Math.min(p.conversionRate * 1.5, 95),
            impact: p.users * 0.5 * (p.dropoffRate / 100)
        }))
            .sort((a, b) => b.impact - a.impact);
        const recommendations = [
            `Focus on optimizing ${bottleneckStage} stage to reduce dropoff`,
            'A/B test different approaches for high-dropoff stages',
            'Implement exit-intent surveys to understand user friction points',
            'Add progress indicators to improve user confidence'
        ];
        return {
            bottleneckStage,
            improvementOpportunities,
            recommendations
        };
    }
    async compareAttributionModels(conversions) {
        const models = ['first_touch', 'last_touch', 'linear', 'time_decay', 'position_based'];
        const comparison = {};
        models.forEach(model => {
            comparison[model] = {};
            conversions.forEach(conversion => {
                const attribution = this.calculateAttribution(conversion.touchpoints, model);
                Object.entries(attribution.weights).forEach(([source, weight]) => {
                    comparison[model][source] = (comparison[model][source] || 0) + (conversion.value * weight);
                });
            });
        });
        return comparison;
    }
    async calculateTodayConversionRate() {
        const now = Date.now();
        const todayStart = new Date(now).setHours(0, 0, 0, 0);
        const { conversions, events } = this.getFilteredData({
            timeRange: [todayStart, now]
        });
        const uniqueUsers = new Set([
            ...conversions.map(conv => conv.userId),
            ...events.map(event => event.userId)
        ]).size;
        const convertedUsers = new Set(conversions.map(conv => conv.userId)).size;
        return uniqueUsers > 0 ? (convertedUsers / uniqueUsers) * 100 : 0;
    }
    async getTopConvertingGoals(limit) {
        const { conversions } = this.getFilteredData();
        const goalStats = {};
        conversions.forEach(conversion => {
            if (!goalStats[conversion.goalId]) {
                goalStats[conversion.goalId] = { conversions: 0, value: 0 };
            }
            goalStats[conversion.goalId].conversions++;
            goalStats[conversion.goalId].value += conversion.value;
        });
        return Object.entries(goalStats)
            .map(([goalId, stats]) => {
            const goal = this.goals.get(goalId);
            return {
                goalId,
                goalName: goal?.name || 'Unknown Goal',
                conversions: stats.conversions,
                conversionRate: stats.conversions,
                value: stats.value
            };
        })
            .sort((a, b) => b.conversions - a.conversions)
            .slice(0, limit);
    }
    generateConversionTrends(hours) {
        const trends = [];
        const now = Date.now();
        for (let i = hours - 1; i >= 0; i--) {
            const hourStart = now - (i * 60 * 60 * 1000);
            const hourEnd = hourStart + (60 * 60 * 1000);
            const { conversions } = this.getFilteredData({
                timeRange: [hourStart, hourEnd]
            });
            trends.push({
                time: new Date(hourStart).toISOString().slice(0, 16),
                conversions: conversions.length,
                conversionRate: conversions.length
            });
        }
        return trends;
    }
    async assessFunnelHealth() {
        const health = [];
        for (const funnel of this.funnels.values()) {
            if (!funnel.isActive)
                continue;
            const analysis = await this.analyzeFunnelPerformance(funnel.id);
            const overallConversionRate = analysis.performance.length > 0
                ? analysis.performance[analysis.performance.length - 1].conversionRate
                : 0;
            let status = 'healthy';
            if (overallConversionRate < 5)
                status = 'critical';
            else if (overallConversionRate < 15)
                status = 'warning';
            health.push({
                funnelId: funnel.id,
                funnelName: funnel.name,
                overallConversionRate,
                bottleneckStage: analysis.insights.bottleneckStage,
                status
            });
        }
        return health;
    }
    async generateConversionAlerts() {
        const alerts = [];
        const now = Date.now();
        const metrics = await this.calculateConversionMetrics();
        Object.entries(metrics.byGoal).forEach(([goalId, goalMetrics]) => {
            if (goalMetrics.conversionRate < 5) {
                const goal = this.goals.get(goalId);
                alerts.push({
                    type: 'goal_underperforming',
                    severity: 'high',
                    message: `Goal "${goal?.name}" has low conversion rate: ${goalMetrics.conversionRate.toFixed(1)}%`,
                    timestamp: now
                });
            }
        });
        return alerts;
    }
    updateActiveSession(sessionId, userId, event) {
        if (!this.activeUserSessions.has(sessionId)) {
            this.activeUserSessions.set(sessionId, {
                userId,
                startTime: Date.now(),
                events: []
            });
        }
        this.activeUserSessions.get(sessionId).events.push(event);
    }
    updateFunnelAnalytics(conversion) {
        this.emit('funnelAnalyticsUpdated', { conversion, timestamp: Date.now() });
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
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    initializeDefaultGoals() {
        const defaultGoals = [
            {
                name: 'Search Result Click',
                type: 'click',
                category: 'micro',
                value: 1,
                conditions: {
                    triggers: [{ event: 'result_click' }]
                },
                metadata: {
                    description: 'User clicks on a search result',
                    priority: 'medium',
                    isActive: true
                }
            },
            {
                name: 'Knowledge Base Article View',
                type: 'pageview',
                category: 'micro',
                value: 2,
                conditions: {
                    triggers: [{ event: 'page_view', parameters: { page_type: 'article' } }]
                },
                metadata: {
                    description: 'User views a knowledge base article',
                    priority: 'high',
                    isActive: true
                }
            },
            {
                name: 'Deep Engagement',
                type: 'time_spent',
                category: 'macro',
                value: 10,
                conditions: {
                    triggers: [{ event: 'time_spent', operator: 'greater_than', value: 300000 }]
                },
                metadata: {
                    description: 'User spends significant time engaging with content',
                    priority: 'high',
                    isActive: true
                }
            }
        ];
        defaultGoals.forEach(goal => this.createGoal(goal));
    }
    initializeAttributionModels() {
        const models = [
            {
                name: 'First Touch',
                type: 'first_touch'
            },
            {
                name: 'Last Touch',
                type: 'last_touch'
            },
            {
                name: 'Linear',
                type: 'linear'
            },
            {
                name: 'Time Decay',
                type: 'time_decay',
                decayRate: 0.5
            },
            {
                name: 'Position Based',
                type: 'position_based',
                weights: [0.4, 0.2, 0.4]
            }
        ];
        models.forEach(model => {
            this.attributionModels.set(model.type, model);
        });
    }
    startSessionMonitoring() {
        setInterval(() => {
            const now = Date.now();
            const sessionTimeout = 30 * 60 * 1000;
            for (const [sessionId, session] of this.activeUserSessions.entries()) {
                if (now - session.startTime > sessionTimeout) {
                    this.activeUserSessions.delete(sessionId);
                }
            }
        }, 60 * 60 * 1000);
        this.emit('sessionMonitoringStarted', { timestamp: Date.now() });
    }
}
exports.ConversionTracker = ConversionTracker;
//# sourceMappingURL=ConversionTracker.js.map