"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSatisfactionMetrics = void 0;
const events_1 = require("events");
class UserSatisfactionMetrics extends events_1.EventEmitter {
    surveys = new Map();
    implicitFeedback = new Map();
    userJourneys = new Map();
    metricsCache = new Map();
    cacheExpiry = 10 * 60 * 1000;
    mlModels = new Map();
    constructor() {
        super();
        this.initializePredictiveModels();
        this.startContinuousLearning();
    }
    recordSurveyResponse(survey) {
        const surveyRecord = {
            ...survey,
            id: this.generateId(),
            timestamp: Date.now()
        };
        if (!this.surveys.has(survey.userId)) {
            this.surveys.set(survey.userId, []);
        }
        this.surveys.get(survey.userId).push(surveyRecord);
        this.invalidateCache();
        this.emit('surveyRecorded', surveyRecord);
        this.updatePredictiveModels(surveyRecord);
        return surveyRecord.id;
    }
    recordImplicitFeedback(feedback) {
        const feedbackRecord = {
            ...feedback,
            id: this.generateId(),
            timestamp: Date.now()
        };
        if (!this.implicitFeedback.has(feedback.userId)) {
            this.implicitFeedback.set(feedback.userId, []);
        }
        this.implicitFeedback.get(feedback.userId).push(feedbackRecord);
        this.invalidateCache();
        this.emit('implicitFeedbackRecorded', feedbackRecord);
        return feedbackRecord.id;
    }
    startUserJourney(userId, sessionId) {
        const journey = {
            userId,
            sessionId,
            startTime: Date.now(),
            steps: [],
            outcome: 'abandoned'
        };
        this.userJourneys.set(sessionId, journey);
        this.emit('journeyStarted', journey);
        return journey;
    }
    addJourneyStep(sessionId, action, data, satisfaction) {
        const journey = this.userJourneys.get(sessionId);
        if (journey) {
            journey.steps.push({
                action,
                timestamp: Date.now(),
                data,
                satisfaction
            });
            this.emit('journeyStepAdded', { sessionId, step: journey.steps[journey.steps.length - 1] });
        }
    }
    completeUserJourney(sessionId, outcome, satisfactionScore) {
        const journey = this.userJourneys.get(sessionId);
        if (journey) {
            journey.endTime = Date.now();
            journey.outcome = outcome;
            journey.satisfactionScore = satisfactionScore;
            this.emit('journeyCompleted', journey);
            this.analyzeJourneyPatterns(journey);
        }
    }
    async calculateSatisfactionMetrics(filters) {
        const cacheKey = `satisfaction_metrics_${JSON.stringify(filters)}`;
        const cached = this.getCachedMetrics(cacheKey);
        if (cached)
            return cached;
        const surveys = this.getFilteredSurveys(filters);
        const implicitData = this.getFilteredImplicitFeedback(filters);
        if (surveys.length === 0) {
            throw new Error('No survey data available for metrics calculation');
        }
        const overallRatings = surveys.map(s => s.responses.overallSatisfaction);
        const averageRating = overallRatings.reduce((sum, rating) => sum + rating, 0) / overallRatings.length;
        const satisfaction = (overallRatings.filter(rating => rating >= 4).length / overallRatings.length) * 100;
        const recommendationScores = surveys.map(s => s.responses.wouldRecommend ? 1 : 0);
        const promoters = recommendationScores.filter(score => score === 1).length;
        const detractors = recommendationScores.filter(score => score === 0).length;
        const nps = ((promoters - detractors) / surveys.length) * 100;
        const confidence = this.calculateConfidence(surveys.length);
        const overall = {
            averageRating,
            satisfaction,
            nps,
            confidence,
            sampleSize: surveys.length
        };
        const dimensions = {
            relevance: this.calculateDimensionScore(surveys, 'resultRelevance'),
            speed: this.calculateDimensionScore(surveys, 'searchSpeed'),
            usability: this.calculateDimensionScore(surveys, 'interfaceUsability'),
            completeness: this.calculateCompletenessScore(surveys, implicitData)
        };
        const trends = {
            daily: this.calculateTrends(surveys, 'daily'),
            weekly: this.calculateTrends(surveys, 'weekly'),
            monthly: this.calculateTrends(surveys, 'monthly')
        };
        const segments = {
            byUserType: this.calculateSegmentScores(surveys, 'userType'),
            byQueryType: this.calculateSegmentScores(surveys, 'queryType'),
            byPlatform: this.calculateSegmentScores(surveys, 'platform')
        };
        const metrics = {
            overall,
            dimensions,
            trends,
            segments
        };
        this.setCachedMetrics(cacheKey, metrics);
        return metrics;
    }
    async generatePredictiveInsights(userId, timeRange) {
        const surveys = this.getFilteredSurveys({ timeRange });
        const implicitData = this.getFilteredImplicitFeedback({ timeRange });
        const journeys = this.getFilteredJourneys({ timeRange });
        const satisfactionPrediction = await this.predictSatisfaction(surveys, implicitData);
        const riskFactors = await this.identifyRiskFactors(surveys, implicitData, journeys);
        const opportunityAreas = await this.identifyOpportunities(surveys, implicitData);
        const userSegmentInsights = await this.generateSegmentInsights(surveys, implicitData);
        return {
            satisfactionPrediction,
            riskFactors,
            opportunityAreas,
            userSegmentInsights
        };
    }
    async getSatisfactionDashboard() {
        const now = Date.now();
        const last24Hours = now - (24 * 60 * 60 * 1000);
        const recentSurveys = this.getFilteredSurveys({
            timeRange: [last24Hours, now]
        });
        const currentMetrics = {
            satisfaction: recentSurveys.length > 0
                ? (recentSurveys.filter(s => s.responses.overallSatisfaction >= 4).length / recentSurveys.length) * 100
                : 0,
            nps: this.calculateNPS(recentSurveys),
            avgRating: recentSurveys.length > 0
                ? recentSurveys.reduce((sum, s) => sum + s.responses.overallSatisfaction, 0) / recentSurveys.length
                : 0,
            responsesCount: recentSurveys.length
        };
        const recentFeedback = recentSurveys
            .filter(s => s.feedback.comments)
            .map(s => ({
            type: this.classifyFeedbackSentiment(s.feedback.comments),
            comment: s.feedback.comments,
            timestamp: s.timestamp,
            rating: s.responses.overallSatisfaction
        }))
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 10);
        const alertsAndInsights = await this.generateAlertsAndInsights(recentSurveys);
        const topIssues = await this.identifyTopIssues(recentSurveys);
        const improvementOpportunities = await this.identifyImprovementOpportunities(recentSurveys);
        return {
            currentMetrics,
            recentFeedback,
            alertsAndInsights,
            topIssues,
            improvementOpportunities
        };
    }
    async analyzeSatisfactionPatterns() {
        const allSurveys = this.getAllSurveys();
        const allImplicitData = this.getAllImplicitFeedback();
        const correlations = this.calculateCorrelations(allSurveys);
        const keyDrivers = this.identifyKeyDrivers(allSurveys, allImplicitData);
        const seasonalPatterns = this.analyzeSeasonalPatterns(allSurveys);
        const userBehaviorInsights = this.extractBehaviorInsights(allSurveys, allImplicitData);
        return {
            correlations,
            keyDrivers,
            seasonalPatterns,
            userBehaviorInsights
        };
    }
    getFilteredSurveys(filters) {
        let surveys = [];
        this.surveys.forEach(userSurveys => surveys.push(...userSurveys));
        if (!filters)
            return surveys;
        if (filters.timeRange) {
            const [start, end] = filters.timeRange;
            surveys = surveys.filter(survey => survey.timestamp >= start && survey.timestamp <= end);
        }
        if (filters.platform) {
            surveys = surveys.filter(survey => survey.metadata.platform === filters.platform);
        }
        return surveys;
    }
    getFilteredImplicitFeedback(filters) {
        let feedback = [];
        this.implicitFeedback.forEach(userFeedback => feedback.push(...userFeedback));
        if (!filters)
            return feedback;
        if (filters.timeRange) {
            const [start, end] = filters.timeRange;
            feedback = feedback.filter(fb => fb.timestamp >= start && fb.timestamp <= end);
        }
        if (filters.userId) {
            feedback = feedback.filter(fb => fb.userId === filters.userId);
        }
        return feedback;
    }
    getFilteredJourneys(filters) {
        let journeys = Array.from(this.userJourneys.values());
        if (!filters)
            return journeys;
        if (filters.timeRange) {
            const [start, end] = filters.timeRange;
            journeys = journeys.filter(journey => journey.startTime >= start && (journey.endTime || Date.now()) <= end);
        }
        if (filters.outcome) {
            journeys = journeys.filter(journey => journey.outcome === filters.outcome);
        }
        return journeys;
    }
    calculateDimensionScore(surveys, dimension) {
        const scores = surveys.map(s => s.responses[dimension]).filter(score => typeof score === 'number');
        return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    }
    calculateCompletenessScore(surveys, implicitData) {
        const journeyCompletions = Array.from(this.userJourneys.values())
            .filter(journey => journey.outcome === 'successful').length;
        const totalJourneys = this.userJourneys.size;
        const completionRate = totalJourneys > 0 ? journeyCompletions / totalJourneys : 0;
        const dwellTimeData = implicitData.filter(data => data.type === 'dwell_time');
        const avgDwellTime = dwellTimeData.length > 0
            ? dwellTimeData.reduce((sum, data) => sum + data.value, 0) / dwellTimeData.length
            : 0;
        const dwellTimeScore = Math.min(avgDwellTime / 300 * 5, 5);
        return (completionRate * 5 + dwellTimeScore) / 2;
    }
    calculateTrends(surveys, granularity) {
        const groupedData = this.groupSurveysByTime(surveys, granularity);
        return Object.entries(groupedData).map(([timeKey, surveysInPeriod]) => {
            const avgScore = surveysInPeriod.reduce((sum, s) => sum + s.responses.overallSatisfaction, 0) / surveysInPeriod.length;
            return { date: timeKey, score: avgScore };
        }).sort((a, b) => a.date.localeCompare(b.date));
    }
    calculateSegmentScores(surveys, segmentType) {
        const segments = {};
        surveys.forEach(survey => {
            let segmentKey = 'unknown';
            if (segmentType === 'platform') {
                segmentKey = survey.metadata.platform;
            }
            else if (segmentType === 'queryType') {
                segmentKey = survey.metadata.searchType;
            }
            else if (segmentType === 'userType') {
                segmentKey = this.classifyUserType(survey);
            }
            if (!segments[segmentKey]) {
                segments[segmentKey] = [];
            }
            segments[segmentKey].push(survey);
        });
        const scores = {};
        Object.entries(segments).forEach(([segment, segmentSurveys]) => {
            scores[segment] = segmentSurveys.reduce((sum, s) => sum + s.responses.overallSatisfaction, 0) / segmentSurveys.length;
        });
        return scores;
    }
    calculateNPS(surveys) {
        if (surveys.length === 0)
            return 0;
        const promoters = surveys.filter(s => s.responses.wouldRecommend).length;
        const detractors = surveys.filter(s => !s.responses.wouldRecommend).length;
        return ((promoters - detractors) / surveys.length) * 100;
    }
    calculateConfidence(sampleSize) {
        if (sampleSize < 30)
            return 0.6;
        if (sampleSize < 100)
            return 0.75;
        if (sampleSize < 300)
            return 0.85;
        if (sampleSize < 1000)
            return 0.9;
        return 0.95;
    }
    async predictSatisfaction(surveys, implicitData) {
        if (surveys.length === 0)
            return 0.5;
        const recentSurveys = surveys.slice(-10);
        const avgRecentSatisfaction = recentSurveys.reduce((sum, s) => sum + s.responses.overallSatisfaction, 0) / recentSurveys.length;
        const recentDwellTime = implicitData
            .filter(data => data.type === 'dwell_time')
            .slice(-5);
        if (recentDwellTime.length > 0) {
            const avgDwellTime = recentDwellTime.reduce((sum, data) => sum + data.value, 0) / recentDwellTime.length;
            const dwellTimeInfluence = avgDwellTime > 180 ? 0.1 : -0.1;
            return Math.max(0, Math.min(5, avgRecentSatisfaction + dwellTimeInfluence));
        }
        return avgRecentSatisfaction;
    }
    async identifyRiskFactors(surveys, implicitData, journeys) {
        const riskFactors = [];
        const recentSatisfaction = surveys.slice(-20).map(s => s.responses.overallSatisfaction);
        if (recentSatisfaction.length >= 10) {
            const trend = this.calculateTrend(recentSatisfaction);
            if (trend < -0.1) {
                riskFactors.push({
                    factor: 'Declining satisfaction trend',
                    impact: Math.abs(trend),
                    recommendation: 'Investigate recent changes and gather detailed feedback'
                });
            }
        }
        const abandonedJourneys = journeys.filter(j => j.outcome === 'abandoned').length;
        const abandonmentRate = journeys.length > 0 ? abandonedJourneys / journeys.length : 0;
        if (abandonmentRate > 0.3) {
            riskFactors.push({
                factor: 'High user abandonment rate',
                impact: abandonmentRate,
                recommendation: 'Simplify user flows and reduce friction points'
            });
        }
        const lowEngagementSessions = implicitData.filter(data => data.type === 'dwell_time' && data.value < 30).length;
        const engagementRate = implicitData.length > 0 ? lowEngagementSessions / implicitData.length : 0;
        if (engagementRate > 0.4) {
            riskFactors.push({
                factor: 'Low user engagement',
                impact: engagementRate,
                recommendation: 'Improve content relevance and interface design'
            });
        }
        return riskFactors.sort((a, b) => b.impact - a.impact);
    }
    async identifyOpportunities(surveys, implicitData) {
        const opportunities = [];
        const improvementAreas = this.extractImprovementAreas(surveys);
        Object.entries(improvementAreas).forEach(([area, frequency]) => {
            if (frequency > 3) {
                opportunities.push({
                    area,
                    potential: frequency / surveys.length,
                    actionItems: this.generateActionItems(area)
                });
            }
        });
        const speedScores = surveys.map(s => s.responses.searchSpeed);
        const avgSpeedScore = speedScores.reduce((sum, score) => sum + score, 0) / speedScores.length;
        if (avgSpeedScore < 4) {
            opportunities.push({
                area: 'Search Performance',
                potential: (4 - avgSpeedScore) / 4,
                actionItems: [
                    'Optimize search algorithms',
                    'Implement caching strategies',
                    'Reduce server response time',
                    'Optimize frontend rendering'
                ]
            });
        }
        return opportunities.sort((a, b) => b.potential - a.potential);
    }
    async generateSegmentInsights(surveys, implicitData) {
        const segments = this.groupSurveysBySegment(surveys);
        return Object.entries(segments).map(([segment, segmentSurveys]) => {
            const satisfaction = segmentSurveys.reduce((sum, s) => sum + s.responses.overallSatisfaction, 0) / segmentSurveys.length;
            const keyDrivers = this.identifySegmentDrivers(segmentSurveys);
            const improvementActions = this.generateSegmentActions(segment, segmentSurveys);
            return {
                segment,
                satisfaction,
                keyDrivers,
                improvementActions
            };
        });
    }
    async generateAlertsAndInsights(surveys) {
        const alerts = [];
        if (surveys.length === 0)
            return alerts;
        const avgSatisfaction = surveys.reduce((sum, s) => sum + s.responses.overallSatisfaction, 0) / surveys.length;
        if (avgSatisfaction < 3) {
            alerts.push({
                type: 'alert',
                severity: 'high',
                message: `Critical: Average satisfaction is ${avgSatisfaction.toFixed(1)}/5`,
                actionRequired: true
            });
        }
        const negativeComments = surveys.filter(s => s.feedback.comments && this.classifyFeedbackSentiment(s.feedback.comments) === 'negative').length;
        if (negativeComments / surveys.length > 0.3) {
            alerts.push({
                type: 'insight',
                severity: 'medium',
                message: `${Math.round(negativeComments / surveys.length * 100)}% of recent feedback is negative`,
                actionRequired: true
            });
        }
        return alerts;
    }
    async identifyTopIssues(surveys) {
        const issues = this.extractIssues(surveys);
        return Object.entries(issues)
            .map(([issue, data]) => ({
            issue,
            frequency: data.frequency,
            impact: data.impact,
            suggestedAction: this.generateIssueAction(issue)
        }))
            .sort((a, b) => (b.frequency * b.impact) - (a.frequency * a.impact))
            .slice(0, 5);
    }
    async identifyImprovementOpportunities(surveys) {
        const opportunities = [
            { area: 'Search Speed', potential: 0.8, effort: 0.6, roi: 1.33 },
            { area: 'Result Relevance', potential: 0.9, effort: 0.8, roi: 1.13 },
            { area: 'Interface Design', potential: 0.7, effort: 0.4, roi: 1.75 },
            { area: 'Mobile Experience', potential: 0.85, effort: 0.7, roi: 1.21 }
        ];
        return opportunities.sort((a, b) => b.roi - a.roi);
    }
    groupSurveysByTime(surveys, granularity) {
        const grouped = {};
        surveys.forEach(survey => {
            const date = new Date(survey.timestamp);
            let key = '';
            if (granularity === 'daily') {
                key = date.toISOString().split('T')[0];
            }
            else if (granularity === 'weekly') {
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toISOString().split('T')[0];
            }
            else if (granularity === 'monthly') {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(survey);
        });
        return grouped;
    }
    classifyUserType(survey) {
        if (survey.metadata.searchType === 'research')
            return 'power_user';
        if (survey.metadata.resultCount > 50)
            return 'explorer';
        if (survey.metadata.searchDuration < 5000)
            return 'quick_searcher';
        return 'casual_user';
    }
    classifyFeedbackSentiment(comment) {
        const positiveWords = ['good', 'great', 'excellent', 'perfect', 'amazing', 'helpful', 'useful'];
        const negativeWords = ['bad', 'terrible', 'awful', 'useless', 'slow', 'confusing', 'frustrating'];
        const words = comment.toLowerCase().split(/\s+/);
        const positiveCount = words.filter(word => positiveWords.includes(word)).length;
        const negativeCount = words.filter(word => negativeWords.includes(word)).length;
        if (positiveCount > negativeCount)
            return 'positive';
        if (negativeCount > positiveCount)
            return 'negative';
        return 'neutral';
    }
    calculateTrend(values) {
        const n = values.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = values.reduce((sum, val) => sum + val, 0);
        const sumXY = values.reduce((sum, val, index) => sum + (index * val), 0);
        const sumX2 = values.reduce((sum, _, index) => sum + (index * index), 0);
        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }
    extractImprovementAreas(surveys) {
        const areas = {};
        surveys.forEach(survey => {
            survey.feedback.improvementAreas.forEach(area => {
                areas[area] = (areas[area] || 0) + 1;
            });
        });
        return areas;
    }
    generateActionItems(area) {
        const actionMap = {
            'search_speed': [
                'Implement search result caching',
                'Optimize database queries',
                'Add search suggestions',
                'Use CDN for static assets'
            ],
            'result_relevance': [
                'Improve ranking algorithms',
                'Add personalization features',
                'Implement user feedback loops',
                'Enhance content analysis'
            ],
            'interface_design': [
                'Conduct usability testing',
                'Simplify navigation',
                'Improve visual hierarchy',
                'Add keyboard shortcuts'
            ]
        };
        return actionMap[area] || ['Investigate user feedback', 'Conduct detailed analysis'];
    }
    groupSurveysBySegment(surveys) {
        const segments = {};
        surveys.forEach(survey => {
            const segment = this.classifyUserType(survey);
            if (!segments[segment]) {
                segments[segment] = [];
            }
            segments[segment].push(survey);
        });
        return segments;
    }
    identifySegmentDrivers(surveys) {
        const drivers = ['relevance', 'speed', 'usability'];
        return drivers.filter(driver => {
            const scores = surveys.map(s => s.responses[driver]);
            const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
            return avgScore > 4;
        });
    }
    generateSegmentActions(segment, surveys) {
        const actionMap = {
            'power_user': [
                'Add advanced search filters',
                'Provide detailed result metadata',
                'Implement export functionality'
            ],
            'casual_user': [
                'Simplify interface',
                'Add search suggestions',
                'Provide quick tutorials'
            ],
            'quick_searcher': [
                'Optimize for speed',
                'Add instant search',
                'Implement voice search'
            ]
        };
        return actionMap[segment] || ['Gather more specific feedback'];
    }
    extractIssues(surveys) {
        const issues = {};
        surveys.forEach(survey => {
            survey.feedback.improvementAreas.forEach(area => {
                if (!issues[area]) {
                    issues[area] = { frequency: 0, impact: 0 };
                }
                issues[area].frequency++;
                issues[area].impact += (5 - survey.responses.overallSatisfaction) / 5;
            });
        });
        Object.keys(issues).forEach(issue => {
            issues[issue].impact = issues[issue].impact / issues[issue].frequency;
        });
        return issues;
    }
    generateIssueAction(issue) {
        const actionMap = {
            'slow_search': 'Optimize search performance and caching',
            'poor_results': 'Improve ranking algorithms and relevance',
            'difficult_interface': 'Redesign user interface for better usability',
            'mobile_issues': 'Enhance mobile responsiveness and touch interactions'
        };
        return actionMap[issue] || 'Investigate and address user concerns';
    }
    analyzeJourneyPatterns(journey) {
        const totalSteps = journey.steps.length;
        const avgStepSatisfaction = journey.steps
            .filter(step => step.satisfaction !== undefined)
            .reduce((sum, step) => sum + (step.satisfaction || 0), 0) / totalSteps;
        this.emit('journeyAnalyzed', {
            journey,
            insights: {
                totalSteps,
                avgStepSatisfaction,
                outcome: journey.outcome,
                duration: journey.endTime ? journey.endTime - journey.startTime : 0
            }
        });
    }
    calculateCorrelations(surveys) {
        const factors = ['overallSatisfaction', 'resultRelevance', 'searchSpeed', 'interfaceUsability'];
        const correlations = [];
        for (let i = 0; i < factors.length; i++) {
            for (let j = i + 1; j < factors.length; j++) {
                const factor1 = factors[i];
                const factor2 = factors[j];
                const values1 = surveys.map(s => s.responses[factor1]);
                const values2 = surveys.map(s => s.responses[factor2]);
                const correlation = this.calculatePearsonCorrelation(values1, values2);
                correlations.push({
                    factor1,
                    factor2,
                    correlation,
                    significance: Math.abs(correlation) > 0.5 ? 0.95 : 0.7
                });
            }
        }
        return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
    }
    calculatePearsonCorrelation(x, y) {
        const n = x.length;
        const sumX = x.reduce((sum, val) => sum + val, 0);
        const sumY = y.reduce((sum, val) => sum + val, 0);
        const sumXY = x.reduce((sum, val, i) => sum + (val * y[i]), 0);
        const sumX2 = x.reduce((sum, val) => sum + (val * val), 0);
        const sumY2 = y.reduce((sum, val) => sum + (val * val), 0);
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        return denominator !== 0 ? numerator / denominator : 0;
    }
    identifyKeyDrivers(surveys, implicitData) {
        return [
            { driver: 'Result Relevance', impact: 0.45, elasticity: 0.8 },
            { driver: 'Search Speed', impact: 0.30, elasticity: 0.6 },
            { driver: 'Interface Usability', impact: 0.25, elasticity: 0.4 }
        ];
    }
    analyzeSeasonalPatterns(surveys) {
        const monthlyData = this.groupSurveysByTime(surveys, 'monthly');
        return Object.entries(monthlyData).map(([month, monthSurveys]) => {
            const avgSatisfaction = monthSurveys.reduce((sum, s) => sum + s.responses.overallSatisfaction, 0) / monthSurveys.length;
            return {
                period: month,
                avgSatisfaction,
                trend: 'stable'
            };
        });
    }
    extractBehaviorInsights(surveys, implicitData) {
        return [
            {
                pattern: 'Quick Exit Pattern',
                description: 'Users who leave quickly tend to have lower satisfaction',
                recommendation: 'Improve first-impression experience and result quality'
            },
            {
                pattern: 'Deep Engagement Correlation',
                description: 'Users with longer session times report higher satisfaction',
                recommendation: 'Encourage exploration with related suggestions'
            }
        ];
    }
    getAllSurveys() {
        const all = [];
        this.surveys.forEach(userSurveys => all.push(...userSurveys));
        return all;
    }
    getAllImplicitFeedback() {
        const all = [];
        this.implicitFeedback.forEach(userFeedback => all.push(...userFeedback));
        return all;
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
    initializePredictiveModels() {
        this.mlModels.set('satisfaction_predictor', {});
        this.mlModels.set('sentiment_analyzer', {});
        this.mlModels.set('journey_optimizer', {});
    }
    startContinuousLearning() {
        setInterval(() => {
            this.emit('continuousLearning', {
                timestamp: Date.now(),
                modelsUpdated: Array.from(this.mlModels.keys())
            });
        }, 60 * 60 * 1000);
    }
    updatePredictiveModels(survey) {
        this.emit('modelUpdate', { survey, timestamp: Date.now() });
    }
}
exports.UserSatisfactionMetrics = UserSatisfactionMetrics;
//# sourceMappingURL=UserSatisfactionMetrics.js.map