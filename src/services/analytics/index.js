"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryAnalyticsEventTypes = exports.MetricCalculators = exports.AnalyticsEventTypes = exports.analyticsUtils = exports.developmentAnalyticsConfig = exports.defaultAnalyticsConfig = exports.QueryAnalyticsDashboard = exports.EffectivenessDashboard = exports.AnalyticsOrchestrator = exports.UserBehaviorTracker = exports.FailedSearchDetector = exports.QueryComplexityAnalyzer = exports.SearchIntentClassifier = exports.QueryAnalyzer = exports.ABTestingFramework = exports.ConversionTracker = exports.UserSatisfactionMetrics = exports.RelevanceScorer = exports.ResultEffectivenessTracker = void 0;
exports.createAnalyticsOrchestrator = createAnalyticsOrchestrator;
exports.createDevelopmentAnalyticsOrchestrator = createDevelopmentAnalyticsOrchestrator;
exports.createProductionAnalyticsOrchestrator = createProductionAnalyticsOrchestrator;
const tslib_1 = require("tslib");
var ResultEffectivenessTracker_1 = require("./ResultEffectivenessTracker");
Object.defineProperty(exports, "ResultEffectivenessTracker", { enumerable: true, get: function () { return ResultEffectivenessTracker_1.ResultEffectivenessTracker; } });
var RelevanceScorer_1 = require("./RelevanceScorer");
Object.defineProperty(exports, "RelevanceScorer", { enumerable: true, get: function () { return RelevanceScorer_1.RelevanceScorer; } });
var UserSatisfactionMetrics_1 = require("./UserSatisfactionMetrics");
Object.defineProperty(exports, "UserSatisfactionMetrics", { enumerable: true, get: function () { return UserSatisfactionMetrics_1.UserSatisfactionMetrics; } });
var ConversionTracker_1 = require("./ConversionTracker");
Object.defineProperty(exports, "ConversionTracker", { enumerable: true, get: function () { return ConversionTracker_1.ConversionTracker; } });
var ABTestingFramework_1 = require("./ABTestingFramework");
Object.defineProperty(exports, "ABTestingFramework", { enumerable: true, get: function () { return ABTestingFramework_1.ABTestingFramework; } });
var QueryAnalyzer_1 = require("./QueryAnalyzer");
Object.defineProperty(exports, "QueryAnalyzer", { enumerable: true, get: function () { return QueryAnalyzer_1.QueryAnalyzer; } });
var SearchIntentClassifier_1 = require("./SearchIntentClassifier");
Object.defineProperty(exports, "SearchIntentClassifier", { enumerable: true, get: function () { return SearchIntentClassifier_1.SearchIntentClassifier; } });
var QueryComplexityAnalyzer_1 = require("./QueryComplexityAnalyzer");
Object.defineProperty(exports, "QueryComplexityAnalyzer", { enumerable: true, get: function () { return QueryComplexityAnalyzer_1.QueryComplexityAnalyzer; } });
var FailedSearchDetector_1 = require("./FailedSearchDetector");
Object.defineProperty(exports, "FailedSearchDetector", { enumerable: true, get: function () { return FailedSearchDetector_1.FailedSearchDetector; } });
var UserBehaviorTracker_1 = require("./UserBehaviorTracker");
Object.defineProperty(exports, "UserBehaviorTracker", { enumerable: true, get: function () { return UserBehaviorTracker_1.UserBehaviorTracker; } });
var AnalyticsOrchestrator_1 = require("./AnalyticsOrchestrator");
Object.defineProperty(exports, "AnalyticsOrchestrator", { enumerable: true, get: function () { return AnalyticsOrchestrator_1.AnalyticsOrchestrator; } });
var EffectivenessDashboard_1 = require("../components/analytics/EffectivenessDashboard");
Object.defineProperty(exports, "EffectivenessDashboard", { enumerable: true, get: function () { return tslib_1.__importDefault(EffectivenessDashboard_1).default; } });
var QueryAnalyticsDashboard_1 = require("../components/analytics/QueryAnalyticsDashboard");
Object.defineProperty(exports, "QueryAnalyticsDashboard", { enumerable: true, get: function () { return tslib_1.__importDefault(QueryAnalyticsDashboard_1).default; } });
function createAnalyticsOrchestrator(config) {
    return new AnalyticsOrchestrator(config);
}
function createDevelopmentAnalyticsOrchestrator() {
    return new AnalyticsOrchestrator(exports.developmentAnalyticsConfig);
}
function createProductionAnalyticsOrchestrator() {
    return new AnalyticsOrchestrator(exports.defaultAnalyticsConfig);
}
exports.defaultAnalyticsConfig = {
    enableRealTimeTracking: true,
    enableABTesting: true,
    enablePredictiveAnalytics: true,
    dataRetentionDays: 90,
    samplingRate: 1.0,
    advancedFeatures: {
        enableBayesianAnalysis: true,
        enableMultivariateTesting: true,
        enableCohortAnalysis: true,
        enableStatisticalSignificanceTesting: true
    },
    queryAnalytics: {
        enablePatternDetection: true,
        enableIntentClassification: true,
        enableComplexityAnalysis: true,
        enableFailureDetection: true,
        enableBehaviorTracking: true,
        patternCacheSize: 1000,
        complexityThreshold: 0.7
    }
};
exports.developmentAnalyticsConfig = {
    enableRealTimeTracking: true,
    enableABTesting: false,
    enablePredictiveAnalytics: false,
    dataRetentionDays: 30,
    samplingRate: 0.1,
    advancedFeatures: {
        enableBayesianAnalysis: false,
        enableMultivariateTesting: false,
        enableCohortAnalysis: false,
        enableStatisticalSignificanceTesting: true
    },
    queryAnalytics: {
        enablePatternDetection: true,
        enableIntentClassification: true,
        enableComplexityAnalysis: true,
        enableFailureDetection: true,
        enableBehaviorTracking: false,
        patternCacheSize: 100,
        complexityThreshold: 0.8
    }
};
exports.analyticsUtils = {
    calculateSignificance(controlMean, controlStdDev, controlSize, variantMean, variantStdDev, variantSize) {
        const pooledStdDev = Math.sqrt(((controlSize - 1) * Math.pow(controlStdDev, 2) + (variantSize - 1) * Math.pow(variantStdDev, 2)) /
            (controlSize + variantSize - 2));
        const standardError = pooledStdDev * Math.sqrt((1 / controlSize) + (1 / variantSize));
        const tStatistic = Math.abs(variantMean - controlMean) / standardError;
        const degreesOfFreedom = controlSize + variantSize - 2;
        const pValue = Math.max(0.001, 2 * (1 - Math.min(0.999, tStatistic / 4)));
        const isSignificant = pValue < 0.05;
        const confidenceLevel = (1 - pValue) * 100;
        return { pValue, isSignificant, confidenceLevel };
    },
    calculateProportionConfidenceInterval(successes, trials, confidenceLevel = 0.95) {
        if (trials === 0)
            return [0, 0];
        const proportion = successes / trials;
        const zScore = confidenceLevel >= 0.99 ? 2.576 : confidenceLevel >= 0.95 ? 1.96 : 1.645;
        const standardError = Math.sqrt((proportion * (1 - proportion)) / trials);
        const margin = zScore * standardError;
        return [
            Math.max(0, proportion - margin),
            Math.min(1, proportion + margin)
        ];
    },
    calculateRequiredSampleSize(baselineRate, minimumDetectableEffect, alpha = 0.05, beta = 0.2) {
        const zAlpha = alpha <= 0.01 ? 2.576 : alpha <= 0.05 ? 1.96 : 1.645;
        const zBeta = beta <= 0.1 ? 1.282 : beta <= 0.2 ? 0.842 : 0.674;
        const p1 = baselineRate;
        const p2 = baselineRate * (1 + minimumDetectableEffect);
        const pooledP = (p1 + p2) / 2;
        const numerator = Math.pow(zAlpha * Math.sqrt(2 * pooledP * (1 - pooledP)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2);
        const denominator = Math.pow(p2 - p1, 2);
        return Math.ceil(numerator / denominator);
    },
    detectAnomalies(values, threshold = 2) {
        if (values.length < 3)
            return [];
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
        const stdDev = Math.sqrt(variance);
        return values.map((value, index) => {
            const zscore = stdDev > 0 ? Math.abs(value - mean) / stdDev : 0;
            return {
                index,
                value,
                zscore,
                isAnomaly: zscore > threshold
            };
        });
    },
    calculateCorrelation(x, y) {
        if (x.length !== y.length || x.length === 0)
            return 0;
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
};
exports.AnalyticsEventTypes = {
    SEARCH_PERFORMED: 'search_performed',
    SEARCH_RESULTS_DISPLAYED: 'search_results_displayed',
    SEARCH_REFINED: 'search_refined',
    RESULT_CLICKED: 'result_clicked',
    RESULT_HOVERED: 'result_hovered',
    RESULT_BOOKMARKED: 'result_bookmarked',
    RESULT_SHARED: 'result_shared',
    PAGE_VIEWED: 'page_viewed',
    TIME_SPENT: 'time_spent',
    SCROLL_DEPTH: 'scroll_depth',
    FORM_SUBMITTED: 'form_submitted',
    GOAL_COMPLETED: 'goal_completed',
    CONVERSION: 'conversion',
    PURCHASE: 'purchase',
    SIGNUP: 'signup',
    FEEDBACK_SUBMITTED: 'feedback_submitted',
    RATING_GIVEN: 'rating_given',
    SURVEY_COMPLETED: 'survey_completed',
    VARIANT_ASSIGNED: 'variant_assigned',
    EXPERIMENT_EXPOSED: 'experiment_exposed',
    EXPERIMENT_CONVERTED: 'experiment_converted'
};
exports.MetricCalculators = {
    calculateCTR(clicks, impressions) {
        return impressions > 0 ? clicks / impressions : 0;
    },
    calculateConversionRate(conversions, visitors) {
        return visitors > 0 ? conversions / visitors : 0;
    },
    calculateBounceRate(singlePageSessions, totalSessions) {
        return totalSessions > 0 ? singlePageSessions / totalSessions : 0;
    },
    calculateAvgSessionDuration(sessionDurations) {
        return sessionDurations.length > 0
            ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
            : 0;
    },
    calculatePrecisionAtK(relevantResults, k) {
        const topK = relevantResults.slice(0, k);
        const relevantInTopK = topK.filter(Boolean).length;
        return topK.length > 0 ? relevantInTopK / topK.length : 0;
    },
    calculateNDCG(relevanceScores, k) {
        const scores = k ? relevanceScores.slice(0, k) : relevanceScores;
        const dcg = scores.reduce((sum, score, index) => {
            const discount = index === 0 ? 1 : Math.log2(index + 1);
            return sum + (score / discount);
        }, 0);
        const idealScores = [...scores].sort((a, b) => b - a);
        const idcg = idealScores.reduce((sum, score, index) => {
            const discount = index === 0 ? 1 : Math.log2(index + 1);
            return sum + (score / discount);
        }, 0);
        return idcg > 0 ? dcg / idcg : 0;
    }
};
exports.QueryAnalyticsEventTypes = {
    QUERY_ANALYZED: 'query_analyzed',
    PATTERN_DETECTED: 'pattern_detected',
    CLUSTER_UPDATED: 'cluster_updated',
    INTENT_CLASSIFIED: 'intent_classified',
    INTENT_CONFIDENCE_LOW: 'intent_confidence_low',
    INTENT_LEARNING_UPDATE: 'intent_learning_update',
    COMPLEXITY_ANALYZED: 'complexity_analyzed',
    HIGH_COMPLEXITY_DETECTED: 'high_complexity_detected',
    COMPLEXITY_THRESHOLD_EXCEEDED: 'complexity_threshold_exceeded',
    FAILURE_DETECTED: 'failure_detected',
    FAILURE_PREDICTED: 'failure_predicted',
    FAILURE_PATTERN_IDENTIFIED: 'failure_pattern_identified',
    BEHAVIOR_PATTERN_DETECTED: 'behavior_pattern_detected',
    USER_JOURNEY_ANALYZED: 'user_journey_analyzed',
    ANOMALY_DETECTED: 'anomaly_detected'
};
exports.default = {
    ResultEffectivenessTracker,
    RelevanceScorer,
    UserSatisfactionMetrics,
    ConversionTracker,
    ABTestingFramework,
    QueryAnalyzer,
    SearchIntentClassifier,
    QueryComplexityAnalyzer,
    FailedSearchDetector,
    UserBehaviorTracker,
    AnalyticsOrchestrator,
    createAnalyticsOrchestrator,
    EffectivenessDashboard,
    QueryAnalyticsDashboard,
    defaultAnalyticsConfig: exports.defaultAnalyticsConfig,
    developmentAnalyticsConfig: exports.developmentAnalyticsConfig,
    analyticsUtils: exports.analyticsUtils,
    AnalyticsEventTypes: exports.AnalyticsEventTypes,
    QueryAnalyticsEventTypes: exports.QueryAnalyticsEventTypes,
    MetricCalculators: exports.MetricCalculators
};
//# sourceMappingURL=index.js.map