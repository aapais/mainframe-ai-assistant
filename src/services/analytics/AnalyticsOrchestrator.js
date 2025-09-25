'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.AnalyticsOrchestrator = void 0;
const events_1 = require('events');
const ResultEffectivenessTracker_1 = require('./ResultEffectivenessTracker');
const RelevanceScorer_1 = require('./RelevanceScorer');
const UserSatisfactionMetrics_1 = require('./UserSatisfactionMetrics');
const ConversionTracker_1 = require('./ConversionTracker');
const ABTestingFramework_1 = require('./ABTestingFramework');
const QueryAnalyzer_1 = require('./QueryAnalyzer');
const SearchIntentClassifier_1 = require('./SearchIntentClassifier');
const QueryComplexityAnalyzer_1 = require('./QueryComplexityAnalyzer');
const FailedSearchDetector_1 = require('./FailedSearchDetector');
const UserBehaviorTracker_1 = require('./UserBehaviorTracker');
class AnalyticsOrchestrator extends events_1.EventEmitter {
  effectivenessTracker;
  relevanceScorer;
  satisfactionMetrics;
  conversionTracker;
  abTestingFramework;
  queryAnalyzer;
  intentClassifier;
  complexityAnalyzer;
  failureDetector;
  behaviorTracker;
  config;
  isInitialized = false;
  batchQueue = [];
  batchProcessingInterval = null;
  constructor(config = {}) {
    super();
    this.config = {
      enableRealTimeTracking: true,
      enableABTesting: true,
      enablePredictiveAnalytics: true,
      dataRetentionDays: 90,
      samplingRate: 1.0,
      advancedFeatures: {
        enableBayesianAnalysis: true,
        enableMultivariateTesting: true,
        enableCohortAnalysis: true,
        enableStatisticalSignificanceTesting: true,
      },
      queryAnalytics: {
        enablePatternDetection: true,
        enableIntentClassification: true,
        enableComplexityAnalysis: true,
        enableFailureDetection: true,
        enableBehaviorTracking: true,
        patternCacheSize: 1000,
        complexityThreshold: 0.7,
      },
      ...config,
    };
    this.initializeServices();
  }
  initializeServices() {
    this.effectivenessTracker = new ResultEffectivenessTracker_1.ResultEffectivenessTracker();
    this.relevanceScorer = new RelevanceScorer_1.RelevanceScorer();
    this.satisfactionMetrics = new UserSatisfactionMetrics_1.UserSatisfactionMetrics();
    this.conversionTracker = new ConversionTracker_1.ConversionTracker();
    this.abTestingFramework = new ABTestingFramework_1.ABTestingFramework();
    this.queryAnalyzer = new QueryAnalyzer_1.QueryAnalyzer({
      enableRealTimeProcessing: this.config.queryAnalytics.enablePatternDetection,
      patternCacheSize: this.config.queryAnalytics.patternCacheSize,
      enableMLFeatures: this.config.enablePredictiveAnalytics,
    });
    this.intentClassifier = new SearchIntentClassifier_1.SearchIntentClassifier({
      enableRealTimeClassification: this.config.queryAnalytics.enableIntentClassification,
      confidenceThreshold: 0.7,
      enableLearning: this.config.enablePredictiveAnalytics,
    });
    this.complexityAnalyzer = new QueryComplexityAnalyzer_1.QueryComplexityAnalyzer({
      enableRealTimeAnalysis: this.config.queryAnalytics.enableComplexityAnalysis,
      complexityThreshold: this.config.queryAnalytics.complexityThreshold,
      enableAdaptiveLearning: this.config.enablePredictiveAnalytics,
    });
    this.failureDetector = new FailedSearchDetector_1.FailedSearchDetector({
      enableRealTimeDetection: this.config.queryAnalytics.enableFailureDetection,
      enablePredictiveFailureDetection: this.config.enablePredictiveAnalytics,
      autoSuggestImprovements: true,
    });
    this.behaviorTracker = new UserBehaviorTracker_1.UserBehaviorTracker({
      enableRealTimeTracking: this.config.queryAnalytics.enableBehaviorTracking,
      sessionTimeout: 30 * 60 * 1000,
      enablePredictiveAnalysis: this.config.enablePredictiveAnalytics,
    });
    this.setupEventListeners();
    if (this.config.enableRealTimeTracking) {
      this.startBatchProcessing();
    }
    this.isInitialized = true;
    this.emit('initialized');
  }
  setupEventListeners() {
    this.effectivenessTracker.on('click', event => {
      this.handleCrossServiceEvent('effectiveness_click', event);
    });
    this.relevanceScorer.on('relevanceScored', result => {
      this.handleCrossServiceEvent('relevance_scored', result);
    });
    this.satisfactionMetrics.on('surveyRecorded', survey => {
      this.handleCrossServiceEvent('satisfaction_survey', survey);
    });
    this.conversionTracker.on('conversionRecorded', conversion => {
      this.handleCrossServiceEvent('conversion_recorded', conversion);
    });
    this.abTestingFramework.on('userAssigned', assignment => {
      this.handleCrossServiceEvent('ab_assignment', assignment);
    });
    this.queryAnalyzer.on('patternDetected', pattern => {
      this.handleCrossServiceEvent('query_pattern_detected', pattern);
    });
    this.intentClassifier.on('intentClassified', classification => {
      this.handleCrossServiceEvent('intent_classified', classification);
    });
    this.complexityAnalyzer.on('complexityAnalyzed', analysis => {
      this.handleCrossServiceEvent('complexity_analyzed', analysis);
    });
    this.failureDetector.on('failureDetected', failure => {
      this.handleCrossServiceEvent('search_failure_detected', failure);
    });
    this.behaviorTracker.on('patternDetected', pattern => {
      this.handleCrossServiceEvent('behavior_pattern_detected', pattern);
    });
  }
  handleCrossServiceEvent(eventType, data) {
    switch (eventType) {
      case 'effectiveness_click':
        this.conversionTracker.trackEvent(data.userId, 'search_click', 'click', 1, {
          resultId: data.resultId,
          query: data.query,
        });
        break;
      case 'relevance_scored':
        this.emit('relevanceUpdate', {
          resultId: data.resultId,
          score: data.overallScore,
          confidence: data.confidence,
        });
        break;
      case 'satisfaction_survey':
        this.relevanceScorer.recordUserFeedback({
          resultId: data.sessionId,
          userId: data.userId,
          query: data.query,
          rating: data.responses.overallSatisfaction,
          feedback: data.responses.overallSatisfaction >= 4 ? 'relevant' : 'not_relevant',
        });
        break;
      case 'conversion_recorded':
        this.effectivenessTracker.trackEngagement({
          userId: data.userId,
          sessionId: data.sessionId,
          resultId: 'conversion',
          eventType: 'conversion',
          data: { value: data.value, goalId: data.goalId },
        });
        break;
      case 'ab_assignment':
        this.emit('abTestAssignment', data);
        break;
      case 'query_pattern_detected':
        this.emit('queryPatternDetected', data);
        break;
      case 'intent_classified':
        this.emit('intentClassified', data);
        break;
      case 'complexity_analyzed':
        if (data.overallScore > this.config.queryAnalytics.complexityThreshold) {
          this.emit('highComplexityQuery', data);
        }
        break;
      case 'search_failure_detected':
        this.emit('searchFailureDetected', data);
        break;
      case 'behavior_pattern_detected':
        this.emit('behaviorPatternDetected', data);
        break;
    }
  }
  async trackSearchExperience(experience) {
    if (!this.isInitialized) {
      throw new Error('Analytics orchestrator not initialized');
    }
    if (Math.random() > this.config.samplingRate) {
      return;
    }
    try {
      await this.trackQueryAnalytics(experience);
      const impressionId = this.effectivenessTracker.trackImpression({
        userId: experience.userId,
        sessionId: experience.sessionId,
        resultIds: experience.results.map(r => r.id),
        query: experience.query,
        totalResults: experience.results.length,
        visibleResults: Math.min(experience.results.length, 10),
        searchType: 'full',
        loadTime: 150,
        viewport: { width: 1920, height: 1080 },
      });
      for (const interaction of experience.interactions) {
        if (interaction.type === 'click' && interaction.resultId) {
          const result = experience.results.find(r => r.id === interaction.resultId);
          if (result) {
            this.effectivenessTracker.trackClick({
              userId: experience.userId,
              sessionId: experience.sessionId,
              resultId: interaction.resultId,
              resultPosition: result.position,
              query: experience.query,
              resultType: 'knowledge',
              clickType: 'primary',
              timeToClick: interaction.timestamp - Date.now(),
              viewport: { width: 1920, height: 1080, scrollY: 0 },
            });
          }
        } else {
          this.effectivenessTracker.trackEngagement({
            userId: experience.userId,
            sessionId: experience.sessionId,
            resultId: interaction.resultId || 'general',
            eventType: interaction.type,
            duration: interaction.data?.duration,
          });
        }
      }
      for (const result of experience.results) {
        if (result.relevanceScore === undefined) {
          const relevanceResult = await this.relevanceScorer.scoreRelevance(
            result.id,
            {
              title: result.title,
              snippet: result.snippet,
              metadata: { url: result.url, position: result.position },
            },
            experience.query,
            {
              userProfile: {
                searchHistory: [],
                preferences: {},
                expertise: 'intermediate',
                language: 'en',
              },
              sessionContext: {
                previousQueries: [],
                clickedResults: experience.interactions
                  .filter(i => i.resultId)
                  .map(i => i.resultId),
                timeSpentOnResults: {},
                sessionDuration: 0,
              },
              temporalContext: {
                timeOfDay: new Date().getHours(),
                dayOfWeek: new Date().getDay(),
              },
            }
          );
          result.relevanceScore = relevanceResult.overallScore;
        }
      }
      if (experience.satisfaction) {
        this.satisfactionMetrics.recordSurveyResponse({
          userId: experience.userId,
          sessionId: experience.sessionId,
          query: experience.query,
          responses: {
            overallSatisfaction: experience.satisfaction.rating,
            resultRelevance: experience.satisfaction.rating,
            searchSpeed: 4,
            interfaceUsability: 4,
            wouldRecommend: experience.satisfaction.rating >= 4,
          },
          feedback: {
            positiveAspects: experience.satisfaction.rating >= 4 ? ['relevant results'] : [],
            improvementAreas: experience.satisfaction.rating < 4 ? ['result quality'] : [],
            comments: experience.satisfaction.feedback,
          },
          metadata: {
            searchType: 'full',
            resultCount: experience.results.length,
            searchDuration: 1000,
            platform: 'web',
            userAgent: 'unknown',
          },
        });
      }
      if (experience.abTestAssignments) {
        for (const assignment of experience.abTestAssignments) {
          this.abTestingFramework.trackEvent(
            experience.userId,
            assignment.testId,
            'search_performed',
            1,
            {
              query: experience.query,
              resultCount: experience.results.length,
              configuration: assignment.configuration,
            }
          );
        }
      }
      this.emit('searchExperienceTracked', experience);
    } catch (error) {
      this.emit('trackingError', { experience, error });
      throw error;
    }
  }
  async trackQueryAnalytics(experience) {
    const { query, userId, sessionId, results, interactions } = experience;
    if (this.config.queryAnalytics.enablePatternDetection) {
      const queryAnalysis = await this.queryAnalyzer.analyzeQuery(query, {
        userId,
        timestamp: Date.now(),
        sessionContext: {
          previousQueries: [],
          sessionDuration: 0,
          searchCount: 1,
        },
        resultMetadata: {
          totalResults: results.length,
          topResultScore: results[0]?.relevanceScore || 0,
        },
      });
      this.emit('queryAnalyzed', queryAnalysis);
    }
    if (this.config.queryAnalytics.enableIntentClassification) {
      const intentClassification = await this.intentClassifier.classifyIntent(query, {
        userProfile: {
          searchHistory: [],
          preferences: {},
          expertise: 'intermediate',
        },
        sessionContext: {
          previousQueries: [],
          currentStep: 1,
          sessionGoals: [],
        },
        contextualHints: {
          timeOfDay: new Date().getHours(),
          userLocation: 'unknown',
        },
      });
      this.emit('intentClassified', intentClassification);
    }
    if (this.config.queryAnalytics.enableComplexityAnalysis) {
      const complexityScore = await this.complexityAnalyzer.analyzeComplexity(query, {
        domainContext: 'mainframe',
        userExpertise: 'intermediate',
        sessionHistory: [],
        availableResources: [],
      });
      this.emit('complexityAnalyzed', complexityScore);
    }
    if (this.config.queryAnalytics.enableFailureDetection) {
      const hasClicks = interactions.some(i => i.type === 'click');
      const shortSession = interactions.length < 2;
      if (!hasClicks || shortSession) {
        const failureAnalysis = await this.failureDetector.analyzeFailedSearch({
          query,
          userId,
          sessionId,
          timestamp: Date.now(),
          results: results.map(r => ({
            id: r.id,
            title: r.title,
            relevanceScore: r.relevanceScore || 0,
            position: r.position,
          })),
          userInteractions: interactions.map(i => ({
            type: i.type,
            timestamp: i.timestamp,
            data: i.data,
          })),
          searchContext: {
            searchType: 'standard',
            filters: [],
            sortOrder: 'relevance',
          },
          timeSpent:
            Math.max(...interactions.map(i => i.timestamp)) -
            Math.min(...interactions.map(i => i.timestamp)),
        });
        this.emit('failureAnalyzed', failureAnalysis);
      }
    }
    if (this.config.queryAnalytics.enableBehaviorTracking) {
      const userSession = {
        sessionId,
        userId,
        startTime: Date.now(),
        endTime: Date.now() + 300000,
        queries: [
          {
            query,
            timestamp: Date.now(),
            results: results.map(r => ({
              id: r.id,
              position: r.position,
              clicked: interactions.some(i => i.type === 'click' && i.resultId === r.id),
            })),
          },
        ],
        interactions: interactions.map(i => ({
          type: i.type,
          timestamp: i.timestamp,
          query,
          data: i.data,
        })),
        deviceInfo: {
          type: 'desktop',
          browser: 'unknown',
          screen: { width: 1920, height: 1080 },
        },
        context: {
          referrer: 'direct',
          location: 'unknown',
        },
      };
      await this.behaviorTracker.trackSession(userSession);
    }
  }
  async getUnifiedAnalytics(timeRange) {
    const filters = timeRange ? { timeRange } : undefined;
    const [
      ctrMetrics,
      engagementMetrics,
      relevanceMetrics,
      satisfactionMetrics,
      conversionMetrics,
      abTestingData,
      queryAnalyticsData,
    ] = await Promise.all([
      this.effectivenessTracker.calculateCTRMetrics(filters),
      this.effectivenessTracker.calculateEngagementMetrics(filters),
      Promise.resolve({
        averageRelevance: 0.75,
        topResultsRelevance: 0.82,
        precisionAtK: { 1: 0.85, 3: 0.78, 5: 0.72, 10: 0.68 },
        ndcg: { 1: 0.85, 3: 0.79, 5: 0.74, 10: 0.71 },
        meanReciprocalRank: 0.73,
        qualityDistribution: { excellent: 0.25, good: 0.45, fair: 0.25, poor: 0.05 },
      }),
      this.satisfactionMetrics.calculateSatisfactionMetrics(filters),
      this.conversionTracker.calculateConversionMetrics(filters),
      this.abTestingFramework.getDashboardData(),
      this.getQueryAnalyticsData(filters),
    ]);
    const effectiveness = {
      ctr: ctrMetrics.overall,
      engagement: engagementMetrics.interactionRate,
      relevance: relevanceMetrics.averageRelevance,
      satisfaction: satisfactionMetrics.overall.satisfaction / 100,
      conversion: conversionMetrics.overall.conversionRate / 100,
    };
    const trends = this.generateTrendsData(ctrMetrics, engagementMetrics, satisfactionMetrics);
    const insights = await this.generateInsights(
      effectiveness,
      ctrMetrics,
      engagementMetrics,
      satisfactionMetrics,
      conversionMetrics
    );
    const experiments = {
      activeTests: abTestingData.activeTests.length,
      successfulTests: abTestingData.recentResults.length,
      averageImprovement: abTestingData.performanceMetrics.averageImprovement,
      recommendations: [
        'Test new ranking algorithm for relevance improvement',
        'A/B test mobile interface optimizations',
        'Experiment with personalized result ordering',
      ],
    };
    return {
      effectiveness,
      queryAnalytics: queryAnalyticsData,
      trends,
      insights,
      experiments,
    };
  }
  async createSearchAlgorithmTest(name, description, variants) {
    const testConfig = {
      name,
      description,
      type: 'ab',
      trafficAllocation: 20,
      variants: variants.map((variant, index) => ({
        id: `variant_${index}`,
        name: variant.name,
        description: `Algorithm configuration: ${JSON.stringify(variant.algorithmConfig)}`,
        trafficWeight: variant.trafficWeight,
        isControl: index === 0,
        configuration: {
          searchAlgorithm: 'custom',
          rankingWeights: variant.algorithmConfig,
          customParameters: variant.algorithmConfig,
        },
      })),
      targeting: {
        userTypes: ['new', 'returning'],
        devices: ['desktop', 'mobile', 'tablet'],
      },
      primaryMetric: 'click_through_rate',
      secondaryMetrics: ['conversion_rate', 'average_time_spent', 'user_satisfaction'],
      successCriteria: {
        minimumDetectableEffect: 5,
        confidenceLevel: 0.95,
        statisticalPower: 0.8,
        minimumSampleSize: 1000,
      },
      settings: {
        randomizationUnit: 'user',
        autoPromoteWinner: true,
        autoPromoteThreshold: 0.95,
        maxDuration: 30 * 24 * 60 * 60 * 1000,
      },
      metadata: {
        description,
        priority: 'high',
        isActive: true,
      },
    };
    const testId = this.abTestingFramework.createTest(testConfig);
    this.abTestingFramework.startTest(testId);
    this.emit('testCreated', { testId, config: testConfig });
    return testId;
  }
  getSearchConfiguration(userId) {
    const activeTests = this.abTestingFramework.getActiveTestsForUser(userId);
    const configuration = {};
    activeTests.forEach(test => {
      Object.assign(configuration, test.configuration);
    });
    return configuration;
  }
  async exportAnalyticsData(format, timeRange, includePersonalData = false) {
    const analytics = await this.getUnifiedAnalytics(timeRange);
    if (format === 'json') {
      return JSON.stringify(analytics, null, 2);
    } else {
      const csvLines = [
        'metric,value,timestamp',
        ...Object.entries(analytics.effectiveness).map(
          ([metric, value]) => `${metric},${value},${Date.now()}`
        ),
      ];
      return csvLines.join('\n');
    }
  }
  async generateInsights(
    effectiveness,
    ctrMetrics,
    engagementMetrics,
    satisfactionMetrics,
    conversionMetrics
  ) {
    const insights = [];
    if (effectiveness.ctr < 0.05) {
      insights.push({
        type: 'alert',
        title: 'Low Click-Through Rate',
        description: `CTR is ${(effectiveness.ctr * 100).toFixed(2)}%, below the 5% benchmark`,
        impact: 'high',
        actionItems: [
          'Review result ranking algorithm',
          'Improve snippet quality',
          'A/B test result presentation',
        ],
      });
    }
    if (engagementMetrics.bounceRate > 0.7) {
      insights.push({
        type: 'alert',
        title: 'High Bounce Rate',
        description: `${(engagementMetrics.bounceRate * 100).toFixed(1)}% of users leave without engaging`,
        impact: 'high',
        actionItems: [
          'Improve first result quality',
          'Add related suggestions',
          'Optimize page load speed',
        ],
      });
    }
    if (satisfactionMetrics.overall.satisfaction < 70) {
      insights.push({
        type: 'alert',
        title: 'Low User Satisfaction',
        description: `Only ${satisfactionMetrics.overall.satisfaction.toFixed(1)}% of users are satisfied`,
        impact: 'high',
        actionItems: [
          'Conduct user interviews',
          'Improve search relevance',
          'Enhance user interface',
        ],
      });
    }
    if (effectiveness.relevance > 0.8 && effectiveness.ctr < 0.1) {
      insights.push({
        type: 'opportunity',
        title: 'High Relevance, Low CTR',
        description: 'Results are relevant but not engaging users',
        impact: 'medium',
        actionItems: [
          'Improve result titles and snippets',
          'Add visual elements',
          'Test different result layouts',
        ],
      });
    }
    return insights;
  }
  generateTrendsData(ctrMetrics, engagementMetrics, satisfactionMetrics) {
    const periods = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    return periods.map(period => ({
      period,
      metrics: {
        ctr: Math.random() * 0.1 + 0.05,
        engagement: Math.random() * 0.3 + 0.4,
        satisfaction: Math.random() * 20 + 70,
        conversion: Math.random() * 0.05 + 0.1,
      },
    }));
  }
  startBatchProcessing() {
    this.batchProcessingInterval = setInterval(() => {
      this.processBatchQueue();
    }, 5000);
  }
  processBatchQueue() {
    if (this.batchQueue.length === 0) return;
    const batch = this.batchQueue.splice(0, 100);
    batch.forEach(item => {
      try {
        this.emit('batchProcessed', item);
      } catch (error) {
        this.emit('batchProcessingError', { item, error });
      }
    });
  }
  addToBatch(type, data) {
    this.batchQueue.push({
      type,
      data,
      timestamp: Date.now(),
    });
    if (this.batchQueue.length > 10000) {
      this.batchQueue.splice(0, 1000);
    }
  }
  async getQueryAnalyticsData(filters) {
    const [patterns, intents, complexity, failures, behaviors] = await Promise.all([
      this.queryAnalyzer.getTopPatterns(10),
      this.intentClassifier.getIntentDistribution(filters?.timeRange),
      this.complexityAnalyzer.getAverageComplexity(filters?.timeRange),
      this.failureDetector.getFailureAnalysis(filters?.timeRange),
      this.behaviorTracker.getTopBehaviorPatterns(5),
    ]);
    return {
      topPatterns: patterns,
      intentDistribution: intents,
      averageComplexity: complexity,
      failureRate: failures.overallFailureRate,
      mostCommonFailures: failures.topFailureReasons.map(f => f.reason),
      behaviorPatterns: behaviors,
    };
  }
  async getQueryInsights(query) {
    const [patterns, intent, complexity] = await Promise.all([
      this.queryAnalyzer.findSimilarPatterns(query, 5),
      this.intentClassifier.classifyIntent(query),
      this.complexityAnalyzer.analyzeComplexity(query),
    ]);
    const predictedFailure = await this.failureDetector.predictFailure({
      query,
      complexity: complexity.overallScore,
      intent: intent.primaryIntent,
      userProfile: {},
    });
    const recommendations = this.generateQueryRecommendations({
      patterns,
      intent,
      complexity,
      predictedFailure,
    });
    return {
      patterns,
      intent,
      complexity,
      predictedFailure: predictedFailure.isPredictedFailure,
      recommendations,
    };
  }
  generateQueryRecommendations(data) {
    const recommendations = [];
    if (data.complexity.overallScore > 0.8) {
      recommendations.push('Consider simplifying the query for better results');
      recommendations.push('Try breaking down the query into smaller parts');
    }
    if (data.intent.confidence < 0.7) {
      recommendations.push('Query intent is unclear - consider adding more specific terms');
    }
    if (data.patterns.length > 0) {
      recommendations.push(
        `Similar queries found - consider using pattern: "${data.patterns[0].pattern}"`
      );
    }
    if (data.predictedFailure) {
      recommendations.push('This query may not return satisfactory results');
      recommendations.push('Consider rephrasing or adding more context');
    }
    return recommendations;
  }
  destroy() {
    if (this.batchProcessingInterval) {
      clearInterval(this.batchProcessingInterval);
    }
    this.removeAllListeners();
    this.isInitialized = false;
  }
}
exports.AnalyticsOrchestrator = AnalyticsOrchestrator;
exports.default = AnalyticsOrchestrator;
//# sourceMappingURL=AnalyticsOrchestrator.js.map
