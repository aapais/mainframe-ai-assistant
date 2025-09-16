"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserBehaviorTracker = void 0;
class UserBehaviorTracker {
    activeSessions = new Map();
    userProfiles = new Map();
    behaviorPatterns = new Map();
    sessionHistory = [];
    patternDetectors = [];
    config;
    constructor(config = {}) {
        this.config = {
            sessionTimeout: 30 * 60 * 1000,
            trackingEnabled: true,
            anonymizeData: false,
            realTimeAnalysis: true,
            patternDetection: {
                minSessions: 5,
                confidenceThreshold: 0.7,
                updateFrequency: 60000
            },
            storage: {
                maxSessions: 10000,
                retentionPeriod: 90 * 24 * 60 * 60 * 1000
            },
            ...config
        };
        this.initializePatternDetectors();
        if (this.config.realTimeAnalysis) {
            this.startRealTimeAnalysis();
        }
    }
    startSession(sessionId, userId, deviceInfo, locationInfo) {
        if (!this.config.trackingEnabled) {
            return this.createEmptySession(sessionId);
        }
        this.endSession(sessionId);
        const session = {
            id: sessionId,
            userId: this.config.anonymizeData ? this.anonymizeUserId(userId) : userId,
            startTime: Date.now(),
            lastActivity: Date.now(),
            duration: 0,
            isActive: true,
            device: this.buildDeviceInfo(deviceInfo),
            location: locationInfo,
            queries: [],
            interactions: [],
            outcomes: [],
            metrics: this.initializeSessionMetrics(),
            patterns: [],
            flags: []
        };
        this.activeSessions.set(sessionId, session);
        if (userId) {
            this.updateUserProfile(userId, 'session_started', session);
        }
        return session;
    }
    trackQuery(sessionId, query, parsedQuery, complexity, intent, results, processingTime) {
        const session = this.activeSessions.get(sessionId);
        if (!session || !this.config.trackingEnabled)
            return;
        const sessionQuery = {
            id: this.generateQueryId(),
            query: this.config.anonymizeData ? this.anonymizeQuery(query) : query,
            parsedQuery,
            timestamp: Date.now(),
            complexity,
            intent,
            results: {
                count: results.length,
                relevanceScore: this.calculateAverageRelevance(results),
                processingTime
            },
            userReaction: {
                clickedResults: [],
                dwellTime: 0,
                refinementFollowed: false
            }
        };
        session.queries.push(sessionQuery);
        session.lastActivity = Date.now();
        this.trackInteraction(sessionId, 'search_initiated', query, {
            queryId: sessionQuery.id,
            timeFromQuery: 0,
            userState: this.assessUserState(session)
        });
        this.updateSessionMetrics(session);
        if (this.config.realTimeAnalysis) {
            this.detectRealTimePatterns(session, sessionQuery);
        }
    }
    trackInteraction(sessionId, type, target, context, outcome) {
        const session = this.activeSessions.get(sessionId);
        if (!session || !this.config.trackingEnabled)
            return;
        const interaction = {
            id: this.generateInteractionId(),
            type,
            timestamp: Date.now(),
            target,
            details: {},
            context: {
                timeFromQuery: this.calculateTimeFromLastQuery(session),
                userState: this.assessUserState(session),
                ...context
            },
            outcome: {
                successful: true,
                value: 0.5,
                satisfaction: 0.5,
                efficiency: 0.5,
                ...outcome
            }
        };
        session.interactions.push(interaction);
        session.lastActivity = Date.now();
        if (context.queryId) {
            this.updateQueryReaction(session, context.queryId, type, interaction);
        }
        this.checkBehavioralFlags(session, interaction);
        this.updateSessionMetrics(session);
    }
    recordOutcome(sessionId, outcome) {
        const session = this.activeSessions.get(sessionId);
        if (!session || !this.config.trackingEnabled)
            return;
        const sessionOutcome = {
            type: 'task_completed',
            achieved: false,
            value: 0,
            effort: 'moderate',
            satisfaction: 0.5,
            description: '',
            ...outcome
        };
        if (sessionOutcome.achieved && !sessionOutcome.timeToAchieve) {
            sessionOutcome.timeToAchieve = Date.now() - session.startTime;
        }
        session.outcomes.push(sessionOutcome);
        session.lastActivity = Date.now();
        this.updateSessionMetrics(session);
    }
    endSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session)
            return null;
        session.isActive = false;
        session.duration = Date.now() - session.startTime;
        this.finalizeSessionMetrics(session);
        this.detectSessionPatterns(session);
        this.sessionHistory.push(session);
        this.activeSessions.delete(sessionId);
        if (session.userId) {
            this.updateUserProfile(session.userId, 'session_ended', session);
        }
        this.cleanupSessionHistory();
        return session;
    }
    getSession(sessionId) {
        return this.activeSessions.get(sessionId) || null;
    }
    getUserProfile(userId) {
        return this.userProfiles.get(userId) || null;
    }
    generateBehaviorReport(timeRange) {
        const sessions = this.getSessionsInRange(timeRange);
        if (sessions.length === 0) {
            return this.getEmptyBehaviorReport(timeRange);
        }
        return {
            timeRange: timeRange || { from: 0, to: Date.now() },
            userMetrics: this.calculateUserMetrics(sessions),
            sessionMetrics: this.calculateSessionMetrics(sessions),
            engagementMetrics: this.calculateEngagementMetrics(sessions),
            behaviorPatterns: this.categorizeBehaviorPatterns(),
            userSegments: this.identifyUserSegments(sessions),
            trends: this.calculateBehaviorTrends(sessions),
            insights: this.generateBehaviorInsights(sessions),
            recommendations: this.generateBehaviorRecommendations(sessions)
        };
    }
    getPersonalizationRecommendations(userId) {
        const profile = this.userProfiles.get(userId);
        if (!profile)
            return [];
        const recommendations = [];
        if (profile.patterns.queryTypes.informational > 0.7) {
            recommendations.push({
                type: 'query_suggestion',
                recommendation: 'Provide more explanatory content and definitions',
                confidence: 0.8,
                impact: 0.7
            });
        }
        if (profile.expertise.level === 'expert') {
            recommendations.push({
                type: 'interface_adaptation',
                recommendation: 'Enable advanced search features by default',
                confidence: 0.9,
                impact: 0.6
            });
        }
        for (const topicPref of profile.preferences.topics.slice(0, 3)) {
            recommendations.push({
                type: 'content_recommendation',
                recommendation: `Suggest content related to ${topicPref.topic}`,
                confidence: topicPref.interest,
                impact: 0.5
            });
        }
        return recommendations.sort((a, b) => (b.confidence * b.impact) - (a.confidence * a.impact));
    }
    exportBehaviorData() {
        return {
            sessions: [...this.sessionHistory, ...Array.from(this.activeSessions.values())],
            profiles: Array.from(this.userProfiles.values()),
            patterns: Array.from(this.behaviorPatterns.values()),
            report: this.generateBehaviorReport()
        };
    }
    initializePatternDetectors() {
        this.patternDetectors = [
            {
                id: 'refinement-cycle',
                detect: (session) => this.detectRefinementCycle(session)
            },
            {
                id: 'browsing-pattern',
                detect: (session) => this.detectBrowsingPattern(session)
            },
            {
                id: 'learning-progression',
                detect: (session) => this.detectLearningProgression(session)
            },
            {
                id: 'efficiency-optimization',
                detect: (session) => this.detectEfficiencyOptimization(session)
            }
        ];
    }
    startRealTimeAnalysis() {
        setInterval(() => {
            this.performRealTimeAnalysis();
        }, this.config.patternDetection.updateFrequency);
    }
    performRealTimeAnalysis() {
        this.cleanupInactiveSessions();
        for (const session of this.activeSessions.values()) {
            this.detectRealTimePatterns(session);
        }
        this.updateAllUserProfiles();
    }
    cleanupInactiveSessions() {
        const now = Date.now();
        const inactiveSessions = [];
        for (const [sessionId, session] of this.activeSessions.entries()) {
            if (now - session.lastActivity > this.config.sessionTimeout) {
                inactiveSessions.push(sessionId);
            }
        }
        for (const sessionId of inactiveSessions) {
            this.endSession(sessionId);
        }
    }
    buildDeviceInfo(partial) {
        return {
            type: 'desktop',
            os: 'unknown',
            browser: 'unknown',
            screenSize: { width: 1920, height: 1080 },
            userAgent: '',
            ...partial
        };
    }
    initializeSessionMetrics() {
        return {
            queryCount: 0,
            refinementRate: 0,
            clickThroughRate: 0,
            avgQueryComplexity: 0,
            timePerQuery: 0,
            successRate: 0,
            bounceRate: 0,
            engagementScore: 0,
            efficiencyScore: 0,
            satisfactionScore: 0
        };
    }
    calculateAverageRelevance(results) {
        if (results.length === 0)
            return 0;
        return results.reduce((sum, r) => sum + r.score, 0) / results.length;
    }
    assessUserState(session) {
        const recentInteractions = session.interactions.slice(-5);
        const timeSpan = recentInteractions.length > 1 ?
            recentInteractions[recentInteractions.length - 1].timestamp - recentInteractions[0].timestamp : 0;
        const focus = timeSpan > 0 && (recentInteractions.length / timeSpan * 1000) > 0.1 ? 'high' : 'medium';
        const engagement = session.interactions.length > 10 ? 'active' : 'passive';
        const expertise = session.queries.some(q => q.complexity.overall > 0.7) ? 'expert' : 'intermediate';
        return {
            focus: focus,
            engagement: engagement,
            expertise: expertise,
            taskUrgency: 'medium',
            sessionGoal: this.inferSessionGoal(session)
        };
    }
    inferSessionGoal(session) {
        if (session.queries.length === 0)
            return 'information_seeking';
        const intents = session.queries.map(q => q.intent.primary);
        const mostCommon = this.getMostCommonIntent(intents);
        const intentToGoalMap = {
            'informational': 'information_seeking',
            'troubleshooting': 'problem_solving',
            'procedural': 'learning',
            'verification': 'verification',
            'exploratory': 'exploration',
            'transactional': 'task_completion',
            'investigational': 'research'
        };
        return intentToGoalMap[mostCommon] || 'information_seeking';
    }
    getMostCommonIntent(intents) {
        const counts = new Map();
        for (const intent of intents) {
            counts.set(intent, (counts.get(intent) || 0) + 1);
        }
        let maxCount = 0;
        let mostCommon = 'informational';
        for (const [intent, count] of counts.entries()) {
            if (count > maxCount) {
                maxCount = count;
                mostCommon = intent;
            }
        }
        return mostCommon;
    }
    calculateTimeFromLastQuery(session) {
        if (session.queries.length === 0)
            return 0;
        return Date.now() - session.queries[session.queries.length - 1].timestamp;
    }
    updateQueryReaction(session, queryId, interactionType, interaction) {
        const query = session.queries.find(q => q.id === queryId);
        if (!query)
            return;
        switch (interactionType) {
            case 'result_clicked':
                if (interaction.context.resultPosition !== undefined) {
                    query.userReaction.clickedResults.push(interaction.context.resultPosition);
                }
                break;
            case 'search_initiated':
                if (session.queries.length > 1) {
                    const prevQuery = session.queries[session.queries.length - 2];
                    if (this.isRefinement(prevQuery.query, query.query)) {
                        prevQuery.userReaction.refinementFollowed = true;
                    }
                }
                break;
        }
    }
    isRefinement(prevQuery, currentQuery) {
        const prevTokens = new Set(prevQuery.toLowerCase().split(/\s+/));
        const currentTokens = new Set(currentQuery.toLowerCase().split(/\s+/));
        const intersection = new Set([...prevTokens].filter(x => currentTokens.has(x)));
        const similarity = intersection.size / Math.max(prevTokens.size, currentTokens.size);
        return similarity > 0.5 && similarity < 1.0;
    }
    checkBehavioralFlags(session, interaction) {
        if (session.queries.length > 10) {
            const recentQueries = session.queries.slice(-10);
            const timeSpan = recentQueries[9].timestamp - recentQueries[0].timestamp;
            if (timeSpan < 30000) {
                session.flags.push({
                    type: 'potential_bot',
                    severity: 'warning',
                    description: 'Rapid query submission detected',
                    timestamp: Date.now(),
                    autoResolvable: false
                });
            }
        }
        if (session.interactions.length > 20 &&
            session.interactions.filter(i => i.type === 'result_clicked').length === 0) {
            session.flags.push({
                type: 'zero_engagement',
                severity: 'warning',
                description: 'No result clicks despite many interactions',
                timestamp: Date.now(),
                autoResolvable: false
            });
        }
    }
    updateSessionMetrics(session) {
        session.metrics.queryCount = session.queries.length;
        if (session.queries.length > 0) {
            let refinements = 0;
            for (let i = 1; i < session.queries.length; i++) {
                if (this.isRefinement(session.queries[i - 1].query, session.queries[i].query)) {
                    refinements++;
                }
            }
            session.metrics.refinementRate = refinements / session.queries.length;
            session.metrics.avgQueryComplexity = session.queries
                .reduce((sum, q) => sum + q.complexity.overall, 0) / session.queries.length;
            const queriesWithClicks = session.queries.filter(q => q.userReaction.clickedResults.length > 0).length;
            session.metrics.clickThroughRate = queriesWithClicks / session.queries.length;
            const successfulOutcomes = session.outcomes.filter(o => o.achieved).length;
            session.metrics.successRate = session.outcomes.length > 0 ?
                successfulOutcomes / session.outcomes.length : 0;
        }
        session.metrics.engagementScore = this.calculateEngagementScore(session);
        session.metrics.efficiencyScore = this.calculateEfficiencyScore(session);
        session.metrics.satisfactionScore = this.calculateSatisfactionScore(session);
    }
    calculateEngagementScore(session) {
        let score = 0;
        score += Math.min(0.4, session.interactions.length / 50);
        const interactionTypes = new Set(session.interactions.map(i => i.type));
        score += Math.min(0.3, interactionTypes.size / 10);
        const resultClicks = session.interactions.filter(i => i.type === 'result_clicked').length;
        score += Math.min(0.3, resultClicks / 10);
        return Math.min(1.0, score);
    }
    calculateEfficiencyScore(session) {
        if (session.queries.length === 0)
            return 0;
        let score = 1.0;
        if (session.queries.length > 10) {
            score -= (session.queries.length - 10) * 0.05;
        }
        score -= session.metrics.refinementRate * 0.3;
        const avgTimePerQuery = session.duration / session.queries.length;
        if (avgTimePerQuery < 30000) {
            score += 0.2;
        }
        return Math.max(0, Math.min(1.0, score));
    }
    calculateSatisfactionScore(session) {
        if (session.outcomes.length === 0)
            return 0.5;
        return session.outcomes.reduce((sum, o) => sum + o.satisfaction, 0) / session.outcomes.length;
    }
    finalizeSessionMetrics(session) {
        if (session.queries.length > 0) {
            session.metrics.timePerQuery = session.duration / session.queries.length;
        }
        if (session.queries.length === 1 &&
            session.queries[0].userReaction.clickedResults.length === 0) {
            session.metrics.bounceRate = 1.0;
        }
    }
    detectRealTimePatterns(session, query) {
        for (const detector of this.patternDetectors) {
            const pattern = detector.detect(session);
            if (pattern && pattern.confidence > this.config.patternDetection.confidenceThreshold) {
                this.addSessionPattern(session, pattern);
            }
        }
    }
    detectSessionPatterns(session) {
        this.detectRealTimePatterns(session);
        const completionPattern = this.detectCompletionPattern(session);
        if (completionPattern) {
            this.addSessionPattern(session, completionPattern);
        }
    }
    addSessionPattern(session, pattern) {
        const existing = session.patterns.find(p => p.type === pattern.type);
        if (existing) {
            existing.confidence = Math.max(existing.confidence, pattern.confidence);
            existing.frequency++;
        }
        else {
            session.patterns.push(pattern);
            const globalPattern = this.behaviorPatterns.get(pattern.id);
            if (globalPattern) {
                globalPattern.frequency++;
            }
            else {
                this.behaviorPatterns.set(pattern.id, { ...pattern, frequency: 1 });
            }
        }
    }
    detectRefinementCycle(session) {
        if (session.queries.length < 3)
            return null;
        const recentQueries = session.queries.slice(-5);
        let refinements = 0;
        for (let i = 1; i < recentQueries.length; i++) {
            if (this.isRefinement(recentQueries[i - 1].query, recentQueries[i].query)) {
                refinements++;
            }
        }
        if (refinements >= 2) {
            return {
                id: `refinement-cycle-${session.id}`,
                type: 'query_refinement_cycle',
                description: 'User is iteratively refining queries',
                confidence: Math.min(1.0, refinements / 3),
                frequency: 1,
                impact: 'neutral',
                recommendation: 'Provide query suggestions or search tips'
            };
        }
        return null;
    }
    detectBrowsingPattern(session) {
        const resultClicks = session.interactions.filter(i => i.type === 'result_clicked');
        if (resultClicks.length < 3)
            return null;
        let sequential = 0;
        for (let i = 1; i < resultClicks.length; i++) {
            const prevPos = resultClicks[i - 1].context.resultPosition || 0;
            const currPos = resultClicks[i].context.resultPosition || 0;
            if (currPos === prevPos + 1) {
                sequential++;
            }
        }
        if (sequential >= 2) {
            return {
                id: `browsing-pattern-${session.id}`,
                type: 'result_browsing_pattern',
                description: 'User browses results systematically',
                confidence: sequential / resultClicks.length,
                frequency: 1,
                impact: 'positive',
                recommendation: 'Optimize result ordering and presentation'
            };
        }
        return null;
    }
    detectLearningProgression(session) {
        if (session.queries.length < 3)
            return null;
        const complexities = session.queries.map(q => q.complexity.overall);
        let increasing = 0;
        for (let i = 1; i < complexities.length; i++) {
            if (complexities[i] > complexities[i - 1]) {
                increasing++;
            }
        }
        if (increasing >= complexities.length * 0.6) {
            return {
                id: `learning-progression-${session.id}`,
                type: 'learning_progression',
                description: 'User is progressing to more complex queries',
                confidence: increasing / complexities.length,
                frequency: 1,
                impact: 'positive',
                recommendation: 'Provide advanced search features and tutorials'
            };
        }
        return null;
    }
    detectEfficiencyOptimization(session) {
        if (session.queries.length < 5)
            return null;
        const times = [];
        for (let i = 0; i < session.queries.length; i++) {
            const query = session.queries[i];
            const firstClick = session.interactions.find(interaction => interaction.context.queryId === query.id && interaction.type === 'result_clicked');
            if (firstClick) {
                times.push(firstClick.timestamp - query.timestamp);
            }
        }
        if (times.length >= 3) {
            const firstHalf = times.slice(0, Math.floor(times.length / 2));
            const secondHalf = times.slice(Math.floor(times.length / 2));
            const firstAvg = firstHalf.reduce((sum, t) => sum + t, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((sum, t) => sum + t, 0) / secondHalf.length;
            if (secondAvg < firstAvg * 0.8) {
                return {
                    id: `efficiency-optimization-${session.id}`,
                    type: 'efficiency_optimization',
                    description: 'User is becoming more efficient at finding results',
                    confidence: (firstAvg - secondAvg) / firstAvg,
                    frequency: 1,
                    impact: 'positive',
                    recommendation: 'Recognize user expertise and offer advanced features'
                };
            }
        }
        return null;
    }
    detectCompletionPattern(session) {
        const successful = session.outcomes.filter(o => o.achieved).length;
        const total = session.outcomes.length;
        if (total === 0)
            return null;
        const successRate = successful / total;
        if (successRate >= 0.8) {
            return {
                id: `success-pattern-${session.id}`,
                type: 'success_pattern',
                description: 'User successfully completed most tasks',
                confidence: successRate,
                frequency: 1,
                impact: 'positive'
            };
        }
        return null;
    }
    updateUserProfile(userId, event, data) {
        let profile = this.userProfiles.get(userId);
        if (!profile) {
            profile = this.createUserProfile(userId);
            this.userProfiles.set(userId, profile);
        }
        profile.lastSeen = Date.now();
        if (event === 'session_started') {
            profile.totalSessions++;
        }
        else if (event === 'session_ended') {
            this.updateProfileFromSession(profile, data);
        }
    }
    createUserProfile(userId) {
        return {
            userId,
            created: Date.now(),
            lastSeen: Date.now(),
            totalSessions: 0,
            totalQueries: 0,
            expertise: {
                level: 'novice',
                domains: {},
                progression: []
            },
            preferences: {
                queryComplexity: 'simple',
                resultFormat: [],
                topics: [],
                searchStyle: {
                    approach: 'systematic',
                    refinementStrategy: 'additive',
                    resultExamination: 'thorough',
                    decisionMaking: 'deliberate'
                }
            },
            patterns: {
                searchTiming: {
                    preferredTimes: [],
                    sessionFrequency: 'occasional',
                    urgencyDistribution: {}
                },
                sessionDuration: {
                    typical: 300000,
                    range: { min: 60000, max: 1800000 },
                    efficiency: 0.5,
                    focusLevel: 0.5
                },
                queryTypes: {
                    informational: 0.5,
                    navigational: 0.2,
                    transactional: 0.1,
                    investigational: 0.2
                },
                successFactors: []
            },
            metrics: {
                avgSessionLength: 0,
                avgQueriesPerSession: 0,
                successRate: 0.5,
                satisfactionScore: 0.5,
                learningVelocity: 0
            }
        };
    }
    updateProfileFromSession(profile, session) {
        profile.totalQueries += session.queries.length;
        const sessionCount = profile.totalSessions;
        profile.metrics.avgSessionLength = (profile.metrics.avgSessionLength * (sessionCount - 1) + session.duration) / sessionCount;
        profile.metrics.avgQueriesPerSession = profile.totalQueries / sessionCount;
        profile.metrics.successRate = (profile.metrics.successRate * (sessionCount - 1) + session.metrics.successRate) / sessionCount;
        profile.metrics.satisfactionScore = (profile.metrics.satisfactionScore * (sessionCount - 1) + session.metrics.satisfactionScore) / sessionCount;
        const avgComplexity = session.metrics.avgQueryComplexity;
        if (avgComplexity > 0.7 && session.metrics.successRate > 0.7) {
            profile.expertise.level = 'expert';
        }
        else if (avgComplexity > 0.4 && session.metrics.successRate > 0.5) {
            profile.expertise.level = 'intermediate';
        }
        const intentCounts = new Map();
        for (const query of session.queries) {
            const intent = query.intent.primary;
            intentCounts.set(intent, (intentCounts.get(intent) || 0) + 1);
        }
        for (const [intent, count] of intentCounts.entries()) {
            const proportion = count / session.queries.length;
            switch (intent) {
                case 'informational':
                    profile.patterns.queryTypes.informational = (profile.patterns.queryTypes.informational + proportion) / 2;
                    break;
                case 'navigational':
                    profile.patterns.queryTypes.navigational = (profile.patterns.queryTypes.navigational + proportion) / 2;
                    break;
                case 'transactional':
                    profile.patterns.queryTypes.transactional = (profile.patterns.queryTypes.transactional + proportion) / 2;
                    break;
                case 'investigational':
                    profile.patterns.queryTypes.investigational = (profile.patterns.queryTypes.investigational + proportion) / 2;
                    break;
            }
        }
    }
    updateAllUserProfiles() {
        for (const profile of this.userProfiles.values()) {
            this.updateUserProgression(profile);
        }
    }
    updateUserProgression(profile) {
        const now = Date.now();
        const recentProgression = profile.expertise.progression.filter(p => now - p.timestamp < 30 * 24 * 60 * 60 * 1000);
        if (recentProgression.length < 30) {
            profile.expertise.progression.push({
                timestamp: now,
                metric: 'success_rate',
                value: profile.metrics.successRate,
                trend: 'stable'
            });
        }
    }
    cleanupSessionHistory() {
        const now = Date.now();
        const cutoff = now - this.config.storage.retentionPeriod;
        this.sessionHistory = this.sessionHistory.filter(session => session.startTime > cutoff);
        if (this.sessionHistory.length > this.config.storage.maxSessions) {
            this.sessionHistory.sort((a, b) => b.startTime - a.startTime);
            this.sessionHistory = this.sessionHistory.slice(0, this.config.storage.maxSessions);
        }
    }
    getSessionsInRange(timeRange) {
        const allSessions = [...this.sessionHistory, ...Array.from(this.activeSessions.values())];
        if (!timeRange)
            return allSessions;
        return allSessions.filter(session => session.startTime >= timeRange.from && session.startTime <= timeRange.to);
    }
    calculateUserMetrics(sessions) {
        const userIds = new Set(sessions.map(s => s.userId).filter(Boolean));
        const now = Date.now();
        const dayAgo = now - 24 * 60 * 60 * 1000;
        const activeSessions = sessions.filter(s => s.lastActivity > dayAgo);
        const activeUsers = new Set(activeSessions.map(s => s.userId).filter(Boolean)).size;
        const newUsers = Math.floor(userIds.size * 0.3);
        const returningUsers = userIds.size - newUsers;
        return {
            totalUsers: userIds.size,
            activeUsers,
            newUsers,
            returningUsers
        };
    }
    calculateSessionMetrics(sessions) {
        if (sessions.length === 0) {
            return {
                totalSessions: 0,
                avgSessionDuration: 0,
                avgQueriesPerSession: 0,
                bounceRate: 0
            };
        }
        const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
        const totalQueries = sessions.reduce((sum, s) => sum + s.queries.length, 0);
        const bouncedSessions = sessions.filter(s => s.metrics.bounceRate > 0).length;
        return {
            totalSessions: sessions.length,
            avgSessionDuration: totalDuration / sessions.length,
            avgQueriesPerSession: totalQueries / sessions.length,
            bounceRate: bouncedSessions / sessions.length
        };
    }
    calculateEngagementMetrics(sessions) {
        if (sessions.length === 0) {
            return {
                clickThroughRate: 0,
                timeOnResults: 0,
                interactionDepth: 0,
                returnRate: 0
            };
        }
        const totalCTR = sessions.reduce((sum, s) => sum + s.metrics.clickThroughRate, 0);
        const totalInteractions = sessions.reduce((sum, s) => sum + s.interactions.length, 0);
        const userIds = new Set(sessions.map(s => s.userId).filter(Boolean));
        const multiSessionUsers = new Set();
        for (const userId of userIds) {
            const userSessions = sessions.filter(s => s.userId === userId);
            if (userSessions.length > 1) {
                multiSessionUsers.add(userId);
            }
        }
        return {
            clickThroughRate: totalCTR / sessions.length,
            timeOnResults: 30000,
            interactionDepth: totalInteractions / sessions.length,
            returnRate: multiSessionUsers.size / userIds.size
        };
    }
    categorizeBehaviorPatterns() {
        const allPatterns = Array.from(this.behaviorPatterns.values());
        return {
            common: allPatterns.filter(p => p.frequency > 10).slice(0, 5),
            emerging: allPatterns.filter(p => p.frequency > 2 && p.frequency <= 10).slice(0, 5),
            concerning: allPatterns.filter(p => p.impact === 'negative').slice(0, 3)
        };
    }
    identifyUserSegments(sessions) {
        const segments = [
            {
                id: 'power-users',
                name: 'Power Users',
                description: 'Users with high query complexity and engagement',
                size: Math.floor(sessions.length * 0.15),
                characteristics: [
                    { dimension: 'query_complexity', value: 'high', importance: 0.9 },
                    { dimension: 'session_duration', value: 'long', importance: 0.8 }
                ],
                behavior: {
                    searchFrequency: 0.8,
                    sessionDuration: 1800000,
                    queryComplexity: 0.8,
                    successRate: 0.9,
                    satisfactionScore: 0.8,
                    preferredTopics: ['advanced', 'technical']
                },
                value: 0.9,
                growth: 0.1
            },
            {
                id: 'casual-users',
                name: 'Casual Users',
                description: 'Users with simple queries and moderate engagement',
                size: Math.floor(sessions.length * 0.6),
                characteristics: [
                    { dimension: 'query_complexity', value: 'simple', importance: 0.7 },
                    { dimension: 'session_frequency', value: 'occasional', importance: 0.6 }
                ],
                behavior: {
                    searchFrequency: 0.3,
                    sessionDuration: 600000,
                    queryComplexity: 0.3,
                    successRate: 0.6,
                    satisfactionScore: 0.7,
                    preferredTopics: ['basic', 'how-to']
                },
                value: 0.5,
                growth: 0.05
            }
        ];
        return segments;
    }
    calculateBehaviorTrends(sessions) {
        return [
            {
                metric: 'session_duration',
                direction: 'increasing',
                magnitude: 0.1,
                significance: 0.7,
                timeframe: '30 days',
                drivers: ['user_engagement', 'content_quality']
            }
        ];
    }
    generateBehaviorInsights(sessions) {
        const insights = [];
        const avgDuration = sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length;
        if (avgDuration > 1800000) {
            insights.push({
                category: 'user_experience',
                insight: 'Users are spending significant time in search sessions, indicating either high engagement or difficulty finding information',
                confidence: 0.8,
                impact: 'medium',
                actionability: 0.7,
                supportingData: [{ metric: 'avg_duration', value: avgDuration }]
            });
        }
        return insights;
    }
    generateBehaviorRecommendations(sessions) {
        const recommendations = [];
        const avgComplexity = sessions.reduce((sum, s) => sum + s.metrics.avgQueryComplexity, 0) / sessions.length;
        if (avgComplexity < 0.3) {
            recommendations.push({
                category: 'features',
                recommendation: 'Introduce advanced search features gradually to help users create more effective queries',
                priority: 0.7,
                expectedImpact: 0.6,
                implementation: 'moderate'
            });
        }
        return recommendations;
    }
    getEmptyBehaviorReport(timeRange) {
        return {
            timeRange: timeRange || { from: 0, to: Date.now() },
            userMetrics: {
                totalUsers: 0,
                activeUsers: 0,
                newUsers: 0,
                returningUsers: 0
            },
            sessionMetrics: {
                totalSessions: 0,
                avgSessionDuration: 0,
                avgQueriesPerSession: 0,
                bounceRate: 0
            },
            engagementMetrics: {
                clickThroughRate: 0,
                timeOnResults: 0,
                interactionDepth: 0,
                returnRate: 0
            },
            behaviorPatterns: {
                common: [],
                emerging: [],
                concerning: []
            },
            userSegments: [],
            trends: [],
            insights: [],
            recommendations: []
        };
    }
    createEmptySession(sessionId) {
        return {
            id: sessionId,
            startTime: Date.now(),
            lastActivity: Date.now(),
            duration: 0,
            isActive: false,
            device: this.buildDeviceInfo(),
            queries: [],
            interactions: [],
            outcomes: [],
            metrics: this.initializeSessionMetrics(),
            patterns: [],
            flags: []
        };
    }
    anonymizeUserId(userId) {
        if (!userId)
            return undefined;
        return `user_${btoa(userId).substring(0, 8)}`;
    }
    anonymizeQuery(query) {
        return query.replace(/\b\d+\b/g, '[NUM]').replace(/\b[A-Z]{2,}\b/g, '[ACRONYM]');
    }
    generateQueryId() {
        return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateInteractionId() {
        return `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.UserBehaviorTracker = UserBehaviorTracker;
exports.default = UserBehaviorTracker;
//# sourceMappingURL=UserBehaviorTracker.js.map