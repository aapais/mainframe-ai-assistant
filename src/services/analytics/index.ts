/**
 * Analytics Services - Comprehensive result effectiveness tracking
 * Central export for all analytics components
 */

// Core analytics services
export { ResultEffectivenessTracker } from './ResultEffectivenessTracker';
export type {
  ClickEvent,
  ImpressionEvent,
  EngagementEvent,
  CTRMetrics,
  EngagementMetrics,
  PositionAnalysis
} from './ResultEffectivenessTracker';

export { RelevanceScorer } from './RelevanceScorer';
export type {
  RelevanceSignal,
  ScoringResult,
  RelevanceMetrics,
  UserFeedback,
  ContextualFactors
} from './RelevanceScorer';

export { UserSatisfactionMetrics } from './UserSatisfactionMetrics';
export type {
  SatisfactionSurvey,
  ImplicitFeedback,
  SatisfactionMetrics,
  UserJourney,
  PredictiveInsights
} from './UserSatisfactionMetrics';

export { ConversionTracker } from './ConversionTracker';
export type {
  ConversionGoal,
  ConversionEvent,
  Conversion,
  ConversionMetrics,
  FunnelStage,
  ConversionFunnel,
  AttributionModel
} from './ConversionTracker';

export { ABTestingFramework } from './ABTestingFramework';
export type {
  ABTestConfig,
  ABTestVariant,
  ABTestAssignment,
  ABTestEvent,
  ABTestResults,
  BayesianAnalysis,
  MultiArmedBanditConfig
} from './ABTestingFramework';

// Enhanced query analytics services
export { QueryAnalyzer } from './QueryAnalyzer';
export type {
  QueryPattern,
  QueryCluster,
  QueryAnalysisReport,
  PatternMatch,
  ClusteringResult
} from './QueryAnalyzer';

export { SearchIntentClassifier } from './SearchIntentClassifier';
export type {
  SearchIntent,
  IntentClassification,
  IntentFeatures,
  IntentLearningData,
  ClassificationResult
} from './SearchIntentClassifier';

export { QueryComplexityAnalyzer } from './QueryComplexityAnalyzer';
export type {
  ComplexityDimension,
  ComplexityScore,
  ComplexityFactor,
  ComplexityAnalysisReport
} from './QueryComplexityAnalyzer';

export { FailedSearchDetector } from './FailedSearchDetector';
export type {
  FailedSearch,
  FailureType,
  FailureReason,
  FailureAnalysisReport,
  ResolutionSuggestion
} from './FailedSearchDetector';

export { UserBehaviorTracker } from './UserBehaviorTracker';
export type {
  UserSession,
  BehaviorPattern,
  BehaviorAnalysisReport,
  SessionAnalytics,
  PatternType
} from './UserBehaviorTracker';

// Orchestrator and unified interface
export { AnalyticsOrchestrator } from './AnalyticsOrchestrator';
export type {
  AnalyticsConfig,
  UnifiedAnalytics,
  SearchExperience
} from './AnalyticsOrchestrator';

// Analytics dashboard components
export { default as EffectivenessDashboard } from '../components/analytics/EffectivenessDashboard';
export { default as QueryAnalyticsDashboard } from '../components/analytics/QueryAnalyticsDashboard';

/**
 * Create a configured analytics orchestrator instance
 */
export function createAnalyticsOrchestrator(config?: Partial<import('./AnalyticsOrchestrator').AnalyticsConfig>) {
  return new AnalyticsOrchestrator(config);
}

/**
 * Create a development-optimized analytics orchestrator
 */
export function createDevelopmentAnalyticsOrchestrator() {
  return new AnalyticsOrchestrator(developmentAnalyticsConfig);
}

/**
 * Create a production-optimized analytics orchestrator
 */
export function createProductionAnalyticsOrchestrator() {
  return new AnalyticsOrchestrator(defaultAnalyticsConfig);
}

/**
 * Default analytics configuration for production use
 */
export const defaultAnalyticsConfig: import('./AnalyticsOrchestrator').AnalyticsConfig = {
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

/**
 * Analytics configuration for development/testing
 */
export const developmentAnalyticsConfig: import('./AnalyticsOrchestrator').AnalyticsConfig = {
  enableRealTimeTracking: true,
  enableABTesting: false, // Disable A/B testing in development
  enablePredictiveAnalytics: false,
  dataRetentionDays: 30,
  samplingRate: 0.1, // Sample 10% of events
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
    enableBehaviorTracking: false, // Disable in development
    patternCacheSize: 100,
    complexityThreshold: 0.8
  }
};

/**
 * Utility functions for analytics
 */
export const analyticsUtils = {
  /**
   * Calculate statistical significance between two samples
   */
  calculateSignificance(
    controlMean: number,
    controlStdDev: number,
    controlSize: number,
    variantMean: number,
    variantStdDev: number,
    variantSize: number
  ): { pValue: number; isSignificant: boolean; confidenceLevel: number } {
    // Simplified t-test calculation
    const pooledStdDev = Math.sqrt(
      ((controlSize - 1) * Math.pow(controlStdDev, 2) + (variantSize - 1) * Math.pow(variantStdDev, 2)) /
      (controlSize + variantSize - 2)
    );

    const standardError = pooledStdDev * Math.sqrt((1 / controlSize) + (1 / variantSize));
    const tStatistic = Math.abs(variantMean - controlMean) / standardError;
    const degreesOfFreedom = controlSize + variantSize - 2;

    // Simplified p-value calculation (would use proper t-distribution in production)
    const pValue = Math.max(0.001, 2 * (1 - Math.min(0.999, tStatistic / 4)));
    const isSignificant = pValue < 0.05;
    const confidenceLevel = (1 - pValue) * 100;

    return { pValue, isSignificant, confidenceLevel };
  },

  /**
   * Calculate confidence interval for a proportion
   */
  calculateProportionConfidenceInterval(
    successes: number,
    trials: number,
    confidenceLevel: number = 0.95
  ): [number, number] {
    if (trials === 0) return [0, 0];

    const proportion = successes / trials;
    const zScore = confidenceLevel >= 0.99 ? 2.576 : confidenceLevel >= 0.95 ? 1.96 : 1.645;
    const standardError = Math.sqrt((proportion * (1 - proportion)) / trials);
    const margin = zScore * standardError;

    return [
      Math.max(0, proportion - margin),
      Math.min(1, proportion + margin)
    ];
  },

  /**
   * Calculate sample size needed for A/B test
   */
  calculateRequiredSampleSize(
    baselineRate: number,
    minimumDetectableEffect: number,
    alpha: number = 0.05,
    beta: number = 0.2
  ): number {
    const zAlpha = alpha <= 0.01 ? 2.576 : alpha <= 0.05 ? 1.96 : 1.645;
    const zBeta = beta <= 0.1 ? 1.282 : beta <= 0.2 ? 0.842 : 0.674;

    const p1 = baselineRate;
    const p2 = baselineRate * (1 + minimumDetectableEffect);
    const pooledP = (p1 + p2) / 2;

    const numerator = Math.pow(zAlpha * Math.sqrt(2 * pooledP * (1 - pooledP)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2);
    const denominator = Math.pow(p2 - p1, 2);

    return Math.ceil(numerator / denominator);
  },

  /**
   * Detect anomalies in time series data
   */
  detectAnomalies(
    values: number[],
    threshold: number = 2
  ): Array<{ index: number; value: number; zscore: number; isAnomaly: boolean }> {
    if (values.length < 3) return [];

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

  /**
   * Calculate correlation coefficient between two variables
   */
  calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

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

/**
 * Event types for analytics tracking
 */
export const AnalyticsEventTypes = {
  // Search events
  SEARCH_PERFORMED: 'search_performed',
  SEARCH_RESULTS_DISPLAYED: 'search_results_displayed',
  SEARCH_REFINED: 'search_refined',

  // Interaction events
  RESULT_CLICKED: 'result_clicked',
  RESULT_HOVERED: 'result_hovered',
  RESULT_BOOKMARKED: 'result_bookmarked',
  RESULT_SHARED: 'result_shared',

  // Engagement events
  PAGE_VIEWED: 'page_viewed',
  TIME_SPENT: 'time_spent',
  SCROLL_DEPTH: 'scroll_depth',
  FORM_SUBMITTED: 'form_submitted',

  // Conversion events
  GOAL_COMPLETED: 'goal_completed',
  CONVERSION: 'conversion',
  PURCHASE: 'purchase',
  SIGNUP: 'signup',

  // Satisfaction events
  FEEDBACK_SUBMITTED: 'feedback_submitted',
  RATING_GIVEN: 'rating_given',
  SURVEY_COMPLETED: 'survey_completed',

  // A/B test events
  VARIANT_ASSIGNED: 'variant_assigned',
  EXPERIMENT_EXPOSED: 'experiment_exposed',
  EXPERIMENT_CONVERTED: 'experiment_converted'
} as const;

/**
 * Metric calculation helpers
 */
export const MetricCalculators = {
  /**
   * Calculate Click-Through Rate
   */
  calculateCTR(clicks: number, impressions: number): number {
    return impressions > 0 ? clicks / impressions : 0;
  },

  /**
   * Calculate Conversion Rate
   */
  calculateConversionRate(conversions: number, visitors: number): number {
    return visitors > 0 ? conversions / visitors : 0;
  },

  /**
   * Calculate Bounce Rate
   */
  calculateBounceRate(singlePageSessions: number, totalSessions: number): number {
    return totalSessions > 0 ? singlePageSessions / totalSessions : 0;
  },

  /**
   * Calculate Average Session Duration
   */
  calculateAvgSessionDuration(sessionDurations: number[]): number {
    return sessionDurations.length > 0
      ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
      : 0;
  },

  /**
   * Calculate Precision at K
   */
  calculatePrecisionAtK(relevantResults: boolean[], k: number): number {
    const topK = relevantResults.slice(0, k);
    const relevantInTopK = topK.filter(Boolean).length;
    return topK.length > 0 ? relevantInTopK / topK.length : 0;
  },

  /**
   * Calculate NDCG (Normalized Discounted Cumulative Gain)
   */
  calculateNDCG(relevanceScores: number[], k?: number): number {
    const scores = k ? relevanceScores.slice(0, k) : relevanceScores;

    // Calculate DCG
    const dcg = scores.reduce((sum, score, index) => {
      const discount = index === 0 ? 1 : Math.log2(index + 1);
      return sum + (score / discount);
    }, 0);

    // Calculate IDCG (ideal DCG)
    const idealScores = [...scores].sort((a, b) => b - a);
    const idcg = idealScores.reduce((sum, score, index) => {
      const discount = index === 0 ? 1 : Math.log2(index + 1);
      return sum + (score / discount);
    }, 0);

    return idcg > 0 ? dcg / idcg : 0;
  }
};

/**
 * Enhanced event types for query analytics
 */
export const QueryAnalyticsEventTypes = {
  // Query analysis events
  QUERY_ANALYZED: 'query_analyzed',
  PATTERN_DETECTED: 'pattern_detected',
  CLUSTER_UPDATED: 'cluster_updated',

  // Intent classification events
  INTENT_CLASSIFIED: 'intent_classified',
  INTENT_CONFIDENCE_LOW: 'intent_confidence_low',
  INTENT_LEARNING_UPDATE: 'intent_learning_update',

  // Complexity analysis events
  COMPLEXITY_ANALYZED: 'complexity_analyzed',
  HIGH_COMPLEXITY_DETECTED: 'high_complexity_detected',
  COMPLEXITY_THRESHOLD_EXCEEDED: 'complexity_threshold_exceeded',

  // Failure detection events
  FAILURE_DETECTED: 'failure_detected',
  FAILURE_PREDICTED: 'failure_predicted',
  FAILURE_PATTERN_IDENTIFIED: 'failure_pattern_identified',

  // Behavior tracking events
  BEHAVIOR_PATTERN_DETECTED: 'behavior_pattern_detected',
  USER_JOURNEY_ANALYZED: 'user_journey_analyzed',
  ANOMALY_DETECTED: 'anomaly_detected'
} as const;

/**
 * Export everything for easy import
 */
export default {
  // Core services
  ResultEffectivenessTracker,
  RelevanceScorer,
  UserSatisfactionMetrics,
  ConversionTracker,
  ABTestingFramework,

  // Query analytics services
  QueryAnalyzer,
  SearchIntentClassifier,
  QueryComplexityAnalyzer,
  FailedSearchDetector,
  UserBehaviorTracker,

  // Orchestration
  AnalyticsOrchestrator,
  createAnalyticsOrchestrator,

  // Dashboard components
  EffectivenessDashboard,
  QueryAnalyticsDashboard,

  // Configuration
  defaultAnalyticsConfig,
  developmentAnalyticsConfig,

  // Utilities
  analyticsUtils,
  AnalyticsEventTypes,
  QueryAnalyticsEventTypes,
  MetricCalculators
};