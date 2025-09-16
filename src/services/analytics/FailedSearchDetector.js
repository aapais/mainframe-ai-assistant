"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FailedSearchDetector = void 0;
class FailedSearchDetector {
    failedSearches = new Map();
    failurePatterns = new Map();
    contentGaps = new Map();
    resolutionStrategies = new Map();
    userSessions = new Map();
    config;
    constructor(config = {}) {
        this.config = {
            failureThresholds: {
                zeroResults: 0,
                lowRelevance: 0.3,
                timeoutMs: 30000,
                abandonmentMs: 180000
            },
            patternDetection: {
                minFrequency: 3,
                confidenceThreshold: 0.7
            },
            realTimeAnalysis: true,
            autoResolution: true,
            maxHistorySize: 10000,
            ...config
        };
        this.initializeFailurePatterns();
        this.initializeResolutionStrategies();
    }
    detectFailure(query, parsedQuery, results, processingTime, options, userId, sessionId) {
        const failureType = this.determineFailureType(results, processingTime, query);
        if (!failureType) {
            return { isFailed: false };
        }
        const failedSearch = this.createFailedSearchRecord(query, parsedQuery, failureType, userId, sessionId, results, processingTime);
        this.failedSearches.set(failedSearch.id, failedSearch);
        this.updateSessionTracking(sessionId || 'anonymous', query, failedSearch.id);
        const failureReasons = this.analyzeFailureReasons(failedSearch, results);
        failedSearch.failureReasons = failureReasons;
        const suggestions = this.generateFailureSuggestions(failedSearch);
        let autoResolution;
        if (this.config.autoResolution) {
            autoResolution = this.attemptAutoResolution(failedSearch);
        }
        if (this.config.realTimeAnalysis) {
            this.updateFailurePatterns(failedSearch);
        }
        return {
            isFailed: true,
            failedSearch,
            suggestions,
            autoResolution
        };
    }
    recordUserAction(failureId, action, details) {
        const failedSearch = this.failedSearches.get(failureId);
        if (!failedSearch)
            return;
        const userAction = {
            type: action,
            timestamp: Date.now(),
            details
        };
        failedSearch.userActions.push(userAction);
        if (this.isResolutionAction(action, details)) {
            this.markAsResolved(failureId, this.getResolutionMethod(action, details));
        }
    }
    markAsResolved(failureId, resolutionMethod, resolutionTime) {
        const failedSearch = this.failedSearches.get(failureId);
        if (!failedSearch)
            return;
        failedSearch.resolved = true;
        failedSearch.resolutionMethod = resolutionMethod;
        failedSearch.resolutionTime = resolutionTime || (Date.now() - failedSearch.timestamp);
        this.updateResolutionEffectiveness(resolutionMethod, true);
    }
    generateFailureReport(timeRange) {
        const failures = this.getFailuresInRange(timeRange);
        if (failures.length === 0) {
            return this.getEmptyReport(timeRange);
        }
        const summary = this.calculateSummaryStats(failures);
        const failureDistribution = this.calculateFailureDistribution(failures);
        const reasonDistribution = this.calculateReasonDistribution(failures);
        const topFailurePatterns = this.getTopFailurePatterns();
        const contentGaps = this.identifyContentGaps(failures);
        const systemIssues = this.identifySystemIssues(failures);
        const userBehaviorInsights = this.analyzeUserBehavior(failures);
        const recommendations = this.generateRecommendations(failures);
        const trends = this.calculateFailureTrends(failures);
        return {
            timeRange: timeRange || { from: 0, to: Date.now() },
            summary,
            failureDistribution,
            reasonDistribution,
            topFailurePatterns,
            contentGaps,
            systemIssues,
            userBehaviorInsights,
            recommendations,
            trends
        };
    }
    getRecoverySuggestions(query, failureType, context) {
        const suggestions = [];
        const similarFailures = this.findSimilarFailures(query, failureType);
        for (const failure of similarFailures) {
            if (failure.resolved && failure.resolutionMethod) {
                const strategy = this.getResolutionStrategy(failure.resolutionMethod);
                if (strategy) {
                    suggestions.push({
                        type: failure.resolutionMethod,
                        suggestion: strategy.description,
                        confidence: strategy.effectiveness,
                        effort: strategy.automationLevel === 'automatic' ? 'low' :
                            strategy.automationLevel === 'semi-automatic' ? 'medium' : 'high'
                    });
                }
            }
        }
        const generalSuggestions = this.getGeneralRecoverySuggestions(failureType, query);
        suggestions.push(...generalSuggestions);
        return suggestions
            .sort((a, b) => b.confidence - a.confidence)
            .filter((suggestion, index, arr) => index === arr.findIndex(s => s.suggestion === suggestion.suggestion))
            .slice(0, 5);
    }
    exportFailureData() {
        return {
            failures: Array.from(this.failedSearches.values()),
            patterns: Array.from(this.failurePatterns.values()),
            contentGaps: Array.from(this.contentGaps.values()),
            report: this.generateFailureReport()
        };
    }
    initializeFailurePatterns() {
        const patterns = [
            {
                id: 'empty-query',
                pattern: /^\s*$/,
                failureType: 'zero_results',
                commonReasons: ['syntax_error'],
                frequency: 0,
                successRate: 0,
                resolutionStrategies: [{
                        method: 'user_guidance',
                        description: 'Prompt user to enter search terms',
                        effectiveness: 0.9,
                        automationLevel: 'automatic',
                        requiredResources: ['UI guidance']
                    }],
                examples: ['', ' ', '  ']
            },
            {
                id: 'single-letter',
                pattern: /^[a-zA-Z]$/,
                failureType: 'zero_results',
                commonReasons: ['scope_too_broad'],
                frequency: 0,
                successRate: 0.1,
                resolutionStrategies: [{
                        method: 'query_suggestion',
                        description: 'Suggest completing the term or using more specific keywords',
                        effectiveness: 0.7,
                        automationLevel: 'automatic',
                        requiredResources: ['Autocomplete system']
                    }],
                examples: ['a', 'j', 'c']
            },
            {
                id: 'all-caps-technical',
                pattern: /^[A-Z]{2,}\s*$/,
                failureType: 'poor_relevance',
                commonReasons: ['terminology_mismatch'],
                frequency: 0,
                successRate: 0.3,
                resolutionStrategies: [{
                        method: 'query_suggestion',
                        description: 'Suggest expanded acronym or related terms',
                        effectiveness: 0.8,
                        automationLevel: 'semi-automatic',
                        requiredResources: ['Acronym dictionary']
                    }],
                examples: ['JCL', 'COBOL', 'VSAM']
            }
        ];
        for (const pattern of patterns) {
            this.failurePatterns.set(pattern.id, pattern);
        }
    }
    initializeResolutionStrategies() {
        const strategies = [
            ['query_suggestion', [{
                        method: 'query_suggestion',
                        description: 'Provide alternative query suggestions',
                        effectiveness: 0.75,
                        automationLevel: 'automatic',
                        requiredResources: ['Query suggestion engine']
                    }]],
            ['content_creation', [{
                        method: 'content_creation',
                        description: 'Create missing content based on user demand',
                        effectiveness: 0.9,
                        automationLevel: 'manual',
                        requiredResources: ['Subject matter experts', 'Content management system']
                    }]],
            ['user_guidance', [{
                        method: 'user_guidance',
                        description: 'Provide contextual help and search tips',
                        effectiveness: 0.6,
                        automationLevel: 'automatic',
                        requiredResources: ['Help system', 'UI components']
                    }]]
        ];
        for (const [method, strategyList] of strategies) {
            this.resolutionStrategies.set(method, strategyList);
        }
    }
    determineFailureType(results, processingTime, query) {
        if (results.length === 0) {
            return 'zero_results';
        }
        if (processingTime > this.config.failureThresholds.timeoutMs) {
            return 'timeout';
        }
        const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
        if (avgScore < this.config.failureThresholds.lowRelevance) {
            return 'poor_relevance';
        }
        if (query.trim().length === 0) {
            return 'zero_results';
        }
        return null;
    }
    createFailedSearchRecord(query, parsedQuery, failureType, userId, sessionId, results = [], processingTime = 0) {
        const id = this.generateFailureId();
        return {
            id,
            query,
            parsedQuery,
            timestamp: Date.now(),
            userId,
            sessionId,
            failureType,
            failureReasons: [],
            context: this.buildSearchContext(userId, sessionId, processingTime),
            attemptedSolutions: [],
            userActions: [],
            resolved: false
        };
    }
    buildSearchContext(userId, sessionId, processingTime = 0) {
        const session = sessionId ? this.userSessions.get(sessionId) : undefined;
        return {
            previousQueries: session?.queries.slice(-5) || [],
            searchSession: {
                startTime: session?.startTime || Date.now(),
                queryCount: session?.queries.length || 1,
                refinementCount: 0,
                clickThroughRate: 0
            },
            userProfile: userId ? this.getUserProfile(userId) : undefined,
            systemState: {
                indexHealth: 0.95,
                responseTime: processingTime,
                errorRate: 0.02
            }
        };
    }
    analyzeFailureReasons(failedSearch, results) {
        const reasons = [];
        switch (failedSearch.failureType) {
            case 'zero_results':
                reasons.push(...this.analyzeZeroResultsReasons(failedSearch));
                break;
            case 'poor_relevance':
                reasons.push(...this.analyzePoorRelevanceReasons(failedSearch, results));
                break;
            case 'timeout':
                reasons.push({
                    type: 'system_performance',
                    description: 'Search operation timed out',
                    confidence: 0.9,
                    impact: 'high',
                    actionable: true,
                    suggestedFix: 'Optimize query or improve system performance'
                });
                break;
        }
        reasons.push(...this.checkCommonIssues(failedSearch));
        return reasons.sort((a, b) => b.confidence - a.confidence);
    }
    analyzeZeroResultsReasons(failedSearch) {
        const reasons = [];
        const query = failedSearch.query.toLowerCase().trim();
        if (query.length === 0) {
            reasons.push({
                type: 'syntax_error',
                description: 'Empty search query',
                confidence: 1.0,
                impact: 'low',
                actionable: true,
                suggestedFix: 'Enter search terms'
            });
        }
        else if (query.length < 3) {
            reasons.push({
                type: 'scope_too_broad',
                description: 'Query too short or general',
                confidence: 0.8,
                impact: 'medium',
                actionable: true,
                suggestedFix: 'Use more specific terms'
            });
        }
        if (this.hasPotentialSpellingErrors(query)) {
            reasons.push({
                type: 'spelling_error',
                description: 'Possible spelling errors in query',
                confidence: 0.7,
                impact: 'medium',
                actionable: true,
                suggestedFix: 'Check spelling or use alternative terms'
            });
        }
        if (this.isOverlySpecific(query)) {
            reasons.push({
                type: 'scope_too_narrow',
                description: 'Query may be too specific',
                confidence: 0.6,
                impact: 'medium',
                actionable: true,
                suggestedFix: 'Try broader or alternative terms'
            });
        }
        if (this.indicatesContentGap(query)) {
            reasons.push({
                type: 'content_gap',
                description: 'Content may not exist for this topic',
                confidence: 0.8,
                impact: 'high',
                actionable: true,
                suggestedFix: 'Consider creating content for this topic'
            });
        }
        return reasons;
    }
    analyzePoorRelevanceReasons(failedSearch, results) {
        const reasons = [];
        const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
        if (avgScore < 0.2) {
            reasons.push({
                type: 'terminology_mismatch',
                description: 'User terminology does not match content vocabulary',
                confidence: 0.8,
                impact: 'high',
                actionable: true,
                suggestedFix: 'Use synonym expansion or query reformulation'
            });
        }
        if (failedSearch.parsedQuery.terms.length > 10) {
            reasons.push({
                type: 'query_complexity',
                description: 'Query is too complex, reducing relevance',
                confidence: 0.7,
                impact: 'medium',
                actionable: true,
                suggestedFix: 'Simplify query or break into multiple searches'
            });
        }
        return reasons;
    }
    checkCommonIssues(failedSearch) {
        const reasons = [];
        if (this.hasSyntaxErrors(failedSearch.query)) {
            reasons.push({
                type: 'syntax_error',
                description: 'Invalid search syntax detected',
                confidence: 0.9,
                impact: 'medium',
                actionable: true,
                suggestedFix: 'Correct search syntax or use simpler terms'
            });
        }
        if (failedSearch.context.systemState.responseTime > 5000) {
            reasons.push({
                type: 'system_performance',
                description: 'Slow system response time',
                confidence: 0.8,
                impact: 'medium',
                actionable: false,
                suggestedFix: 'System optimization needed'
            });
        }
        return reasons;
    }
    generateFailureSuggestions(failedSearch) {
        const suggestions = [];
        for (const reason of failedSearch.failureReasons) {
            if (reason.suggestedFix) {
                suggestions.push(reason.suggestedFix);
            }
        }
        switch (failedSearch.failureType) {
            case 'zero_results':
                suggestions.push('Try using different keywords', 'Use broader search terms', 'Check spelling and try alternatives');
                break;
            case 'poor_relevance':
                suggestions.push('Use more specific terms', 'Try exact phrase search with quotes', 'Add context to your search');
                break;
        }
        return [...new Set(suggestions)];
    }
    attemptAutoResolution(failedSearch) {
        for (const reason of failedSearch.failureReasons) {
            if (reason.actionable && reason.confidence > 0.8) {
                switch (reason.type) {
                    case 'spelling_error':
                        return 'query_suggestion';
                    case 'syntax_error':
                        return 'user_guidance';
                    case 'scope_too_broad':
                        return 'query_suggestion';
                }
            }
        }
        return undefined;
    }
    updateSessionTracking(sessionId, query, failureId) {
        let session = this.userSessions.get(sessionId);
        if (!session) {
            session = {
                queries: [],
                failures: [],
                startTime: Date.now(),
                lastActivity: Date.now()
            };
        }
        session.queries.push(query);
        session.failures.push(failureId);
        session.lastActivity = Date.now();
        this.userSessions.set(sessionId, session);
    }
    updateFailurePatterns(failedSearch) {
        for (const pattern of this.failurePatterns.values()) {
            if (this.matchesPattern(failedSearch.query, pattern.pattern)) {
                pattern.frequency++;
                if (failedSearch.resolved) {
                    pattern.successRate = (pattern.successRate + 1) / 2;
                }
                break;
            }
        }
    }
    hasPotentialSpellingErrors(query) {
        const words = query.split(/\s+/);
        const suspiciousPatterns = [
            /[a-z]{3,}[0-9]/,
            /[a-z]*[aeiou]{3,}/,
            /[bcdfghjklmnpqrstvwxyz]{4,}/
        ];
        return words.some(word => suspiciousPatterns.some(pattern => pattern.test(word.toLowerCase())));
    }
    isOverlySpecific(query) {
        const specificPatterns = [
            /v\d+\.\d+\.\d+/,
            /\b[A-Z]{2,}\d+\b/,
            /\b\w+\.exe\b/,
        ];
        return specificPatterns.some(pattern => pattern.test(query));
    }
    indicatesContentGap(query) {
        const contentGapIndicators = [
            'tutorial', 'guide', 'how to', 'example', 'sample',
            'documentation', 'manual', 'reference'
        ];
        return contentGapIndicators.some(indicator => query.toLowerCase().includes(indicator));
    }
    hasSyntaxErrors(query) {
        const syntaxErrors = [
            /\(\)/,
            /\"\s*\"/,
            /[()]{3,}/,
            /["']{3,}/
        ];
        return syntaxErrors.some(pattern => pattern.test(query));
    }
    matchesPattern(query, pattern) {
        if (pattern instanceof RegExp) {
            return pattern.test(query);
        }
        return query.toLowerCase().includes(pattern.toLowerCase());
    }
    isResolutionAction(action, details) {
        switch (action) {
            case 'result_clicked':
                return details.relevance > 0.7;
            case 'result_rated':
                return details.rating > 3;
            case 'feedback_provided':
                return details.satisfaction > 0.7;
            default:
                return false;
        }
    }
    getResolutionMethod(action, details) {
        switch (action) {
            case 'query_refinement':
                return 'query_suggestion';
            case 'help_requested':
                return 'user_guidance';
            case 'feedback_provided':
                return 'user_education';
            default:
                return 'manual_intervention';
        }
    }
    updateResolutionEffectiveness(method, successful) {
        const strategies = this.resolutionStrategies.get(method);
        if (strategies) {
            for (const strategy of strategies) {
                if (successful) {
                    strategy.effectiveness = Math.min(1.0, strategy.effectiveness + 0.05);
                }
                else {
                    strategy.effectiveness = Math.max(0.1, strategy.effectiveness - 0.02);
                }
            }
        }
    }
    getUserProfile(userId) {
        return {
            expertise: 'intermediate',
            frequentTopics: [],
            successfulPatterns: []
        };
    }
    getFailuresInRange(timeRange) {
        const failures = Array.from(this.failedSearches.values());
        if (!timeRange)
            return failures;
        return failures.filter(failure => failure.timestamp >= timeRange.from && failure.timestamp <= timeRange.to);
    }
    calculateSummaryStats(failures) {
        const totalFailures = failures.length;
        const uniqueFailures = new Set(failures.map(f => f.query)).size;
        const resolvedFailures = failures.filter(f => f.resolved).length;
        const resolutionRate = totalFailures > 0 ? resolvedFailures / totalFailures : 0;
        const resolutionTimes = failures
            .filter(f => f.resolved && f.resolutionTime)
            .map(f => f.resolutionTime);
        const avgResolutionTime = resolutionTimes.length > 0 ?
            resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length : 0;
        return {
            totalFailures,
            uniqueFailures,
            resolutionRate,
            avgResolutionTime
        };
    }
    calculateFailureDistribution(failures) {
        const distribution = {
            zero_results: 0,
            poor_relevance: 0,
            timeout: 0,
            error: 0,
            incomplete_results: 0,
            user_abandoned: 0,
            refinement_loop: 0
        };
        for (const failure of failures) {
            distribution[failure.failureType]++;
        }
        return distribution;
    }
    calculateReasonDistribution(failures) {
        const distribution = {
            content_gap: 0,
            query_complexity: 0,
            terminology_mismatch: 0,
            scope_too_broad: 0,
            scope_too_narrow: 0,
            spelling_error: 0,
            syntax_error: 0,
            index_issue: 0,
            system_performance: 0,
            user_expectation: 0
        };
        for (const failure of failures) {
            for (const reason of failure.failureReasons) {
                distribution[reason.type]++;
            }
        }
        return distribution;
    }
    getTopFailurePatterns() {
        return Array.from(this.failurePatterns.values())
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 10);
    }
    identifyContentGaps(failures) {
        const gaps = new Map();
        for (const failure of failures) {
            if (failure.failureReasons.some(r => r.type === 'content_gap')) {
                const topic = this.extractTopic(failure.query);
                const existing = gaps.get(topic);
                if (existing) {
                    existing.queries.push(failure.query);
                    existing.frequency++;
                }
                else {
                    gaps.set(topic, {
                        topic,
                        queries: [failure.query],
                        frequency: 1,
                        userDemand: 1,
                        priority: 'medium',
                        suggestedContent: [`Create content about ${topic}`],
                        relatedTopics: []
                    });
                }
            }
        }
        return Array.from(gaps.values())
            .sort((a, b) => b.frequency - a.frequency);
    }
    identifySystemIssues(failures) {
        const issues = [];
        const timeoutFailures = failures.filter(f => f.failureType === 'timeout');
        if (timeoutFailures.length > failures.length * 0.1) {
            issues.push({
                type: 'performance',
                description: 'High rate of timeout failures',
                impact: 0.8,
                frequency: timeoutFailures.length,
                affectedQueries: timeoutFailures.map(f => f.query),
                recommendedFix: 'Optimize search algorithms and infrastructure'
            });
        }
        return issues;
    }
    analyzeUserBehavior(failures) {
        const insights = [];
        const refinementPatterns = failures.filter(f => f.userActions.some(a => a.type === 'query_refinement'));
        if (refinementPatterns.length > failures.length * 0.3) {
            insights.push({
                pattern: 'High refinement rate',
                description: 'Users frequently need to refine their queries',
                prevalence: refinementPatterns.length / failures.length,
                impact: 'negative',
                recommendation: 'Improve initial query suggestions and search guidance'
            });
        }
        return insights;
    }
    generateRecommendations(failures) {
        const recommendations = [];
        const zeroResultsRate = failures.filter(f => f.failureType === 'zero_results').length / failures.length;
        if (zeroResultsRate > 0.3) {
            recommendations.push({
                type: 'immediate',
                category: 'system',
                description: 'Implement better query suggestion system',
                priority: 0.9,
                estimatedImpact: 0.8,
                requiredEffort: 'medium'
            });
        }
        return recommendations.sort((a, b) => b.priority - a.priority);
    }
    calculateFailureTrends(failures) {
        return [
            {
                metric: 'Overall failure rate',
                direction: 'stable',
                rate: 0.02,
                significance: 0.6,
                timeframe: '30 days'
            }
        ];
    }
    findSimilarFailures(query, failureType) {
        return Array.from(this.failedSearches.values())
            .filter(failure => failure.failureType === failureType &&
            this.calculateQuerySimilarity(query, failure.query) > 0.7)
            .slice(0, 5);
    }
    calculateQuerySimilarity(query1, query2) {
        const tokens1 = new Set(query1.toLowerCase().split(/\s+/));
        const tokens2 = new Set(query2.toLowerCase().split(/\s+/));
        const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
        const union = new Set([...tokens1, ...tokens2]);
        return intersection.size / union.size;
    }
    getResolutionStrategy(method) {
        const strategies = this.resolutionStrategies.get(method);
        return strategies?.[0];
    }
    getGeneralRecoverySuggestions(failureType, query) {
        const suggestions = [];
        switch (failureType) {
            case 'zero_results':
                suggestions.push({
                    type: 'query_suggestion',
                    suggestion: 'Try using broader or alternative keywords',
                    confidence: 0.7,
                    effort: 'low'
                });
                break;
            case 'poor_relevance':
                suggestions.push({
                    type: 'query_suggestion',
                    suggestion: 'Use more specific terms or exact phrases',
                    confidence: 0.6,
                    effort: 'low'
                });
                break;
        }
        return suggestions;
    }
    extractTopic(query) {
        const words = query.toLowerCase().split(/\s+/);
        const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        const meaningfulWords = words.filter(word => !stopWords.includes(word) && word.length > 2);
        return meaningfulWords.slice(0, 3).join(' ') || 'unknown';
    }
    getEmptyReport(timeRange) {
        return {
            timeRange: timeRange || { from: 0, to: Date.now() },
            summary: {
                totalFailures: 0,
                uniqueFailures: 0,
                resolutionRate: 0,
                avgResolutionTime: 0
            },
            failureDistribution: {
                zero_results: 0,
                poor_relevance: 0,
                timeout: 0,
                error: 0,
                incomplete_results: 0,
                user_abandoned: 0,
                refinement_loop: 0
            },
            reasonDistribution: {
                content_gap: 0,
                query_complexity: 0,
                terminology_mismatch: 0,
                scope_too_broad: 0,
                scope_too_narrow: 0,
                spelling_error: 0,
                syntax_error: 0,
                index_issue: 0,
                system_performance: 0,
                user_expectation: 0
            },
            topFailurePatterns: [],
            contentGaps: [],
            systemIssues: [],
            userBehaviorInsights: [],
            recommendations: [],
            trends: []
        };
    }
    generateFailureId() {
        return `failure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.FailedSearchDetector = FailedSearchDetector;
exports.default = FailedSearchDetector;
//# sourceMappingURL=FailedSearchDetector.js.map