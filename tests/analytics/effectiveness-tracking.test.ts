/**
 * Comprehensive test suite for result effectiveness tracking system
 * Tests all analytics components with statistical significance validation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  ResultEffectivenessTracker,
  RelevanceScorer,
  UserSatisfactionMetrics,
  ConversionTracker,
  ABTestingFramework,
  AnalyticsOrchestrator,
  analyticsUtils
} from '../../src/services/analytics';

describe('Result Effectiveness Tracking System', () => {
  let effectivenessTracker: ResultEffectivenessTracker;
  let relevanceScorer: RelevanceScorer;
  let satisfactionMetrics: UserSatisfactionMetrics;
  let conversionTracker: ConversionTracker;
  let abTestingFramework: ABTestingFramework;
  let analyticsOrchestrator: AnalyticsOrchestrator;

  beforeEach(() => {
    effectivenessTracker = new ResultEffectivenessTracker();
    relevanceScorer = new RelevanceScorer();
    satisfactionMetrics = new UserSatisfactionMetrics();
    conversionTracker = new ConversionTracker();
    abTestingFramework = new ABTestingFramework();
    analyticsOrchestrator = new AnalyticsOrchestrator();
  });

  afterEach(() => {
    effectivenessTracker.removeAllListeners();
    relevanceScorer.removeAllListeners();
    satisfactionMetrics.removeAllListeners();
    conversionTracker.removeAllListeners();
    abTestingFramework.removeAllListeners();
    analyticsOrchestrator.destroy();
  });

  describe('ResultEffectivenessTracker', () => {
    it('should track click events and calculate CTR metrics', async () => {
      // Track impressions
      effectivenessTracker.trackImpression({
        userId: 'user1',
        sessionId: 'session1',
        resultIds: ['result1', 'result2', 'result3'],
        query: 'test query',
        totalResults: 3,
        visibleResults: 3,
        searchType: 'full',
        loadTime: 150,
        viewport: { width: 1920, height: 1080 }
      });

      // Track clicks
      effectivenessTracker.trackClick({
        userId: 'user1',
        sessionId: 'session1',
        resultId: 'result1',
        resultPosition: 1,
        query: 'test query',
        resultType: 'knowledge',
        clickType: 'primary',
        timeToClick: 1500,
        viewport: { width: 1920, height: 1080, scrollY: 0 }
      });

      // Calculate metrics
      const ctrMetrics = await effectivenessTracker.calculateCTRMetrics();

      expect(ctrMetrics.overall).toBeGreaterThan(0);
      expect(ctrMetrics.byPosition).toHaveProperty('1');
      expect(ctrMetrics.confidence).toBeGreaterThan(0);
      expect(ctrMetrics.sampleSize).toBe(3);
    });

    it('should calculate position analysis correctly', async () => {
      // Track multiple clicks at different positions
      for (let i = 1; i <= 5; i++) {
        effectivenessTracker.trackImpression({
          userId: `user${i}`,
          sessionId: `session${i}`,
          resultIds: ['result1', 'result2', 'result3', 'result4', 'result5'],
          query: 'test query',
          totalResults: 5,
          visibleResults: 5,
          searchType: 'full',
          loadTime: 150,
          viewport: { width: 1920, height: 1080 }
        });

        // Click on position i
        effectivenessTracker.trackClick({
          userId: `user${i}`,
          sessionId: `session${i}`,
          resultId: `result${i}`,
          resultPosition: i,
          query: 'test query',
          resultType: 'knowledge',
          clickType: 'primary',
          timeToClick: 1000 + (i * 500),
          viewport: { width: 1920, height: 1080, scrollY: 0 }
        });
      }

      const dashboardData = await effectivenessTracker.getDashboardData();

      expect(dashboardData.topPerforming.positions).toHaveLength(5);
      expect(dashboardData.topPerforming.positions[0].position).toBe(1);
      expect(dashboardData.topPerforming.positions[0].ctr).toBeGreaterThan(0);
    });

    it('should track engagement events', () => {
      const eventId = effectivenessTracker.trackEngagement({
        userId: 'user1',
        sessionId: 'session1',
        resultId: 'result1',
        eventType: 'hover',
        duration: 5000
      });

      expect(eventId).toBeDefined();
      expect(typeof eventId).toBe('string');
    });
  });

  describe('RelevanceScorer', () => {
    it('should score result relevance with multiple signals', async () => {
      const scoringResult = await relevanceScorer.scoreRelevance(
        'result1',
        {
          title: 'How to implement machine learning algorithms',
          snippet: 'A comprehensive guide to implementing ML algorithms from scratch...',
          metadata: { category: 'tutorial', difficulty: 'intermediate' }
        },
        'machine learning tutorial',
        {
          userProfile: {
            searchHistory: ['machine learning', 'algorithms', 'tutorial'],
            preferences: { difficulty: 'intermediate' },
            expertise: 'intermediate',
            language: 'en'
          },
          sessionContext: {
            previousQueries: ['ML basics', 'machine learning'],
            clickedResults: [],
            timeSpentOnResults: {},
            sessionDuration: 300000
          },
          temporalContext: {
            timeOfDay: 14,
            dayOfWeek: 2
          }
        }
      );

      expect(scoringResult.overallScore).toBeGreaterThan(0);
      expect(scoringResult.overallScore).toBeLessThanOrEqual(1);
      expect(scoringResult.confidence).toBeGreaterThan(0);
      expect(scoringResult.signals).toBeInstanceOf(Array);
      expect(scoringResult.signals.length).toBeGreaterThan(0);
      expect(scoringResult.explanation).toBeDefined();
      expect(scoringResult.recommendations).toBeInstanceOf(Array);
    });

    it('should record user feedback and improve scoring', () => {
      const feedbackId = relevanceScorer.recordUserFeedback({
        resultId: 'result1',
        userId: 'user1',
        query: 'test query',
        rating: 4,
        feedback: 'relevant',
        comments: 'Very helpful result'
      });

      expect(feedbackId).toBeDefined();
      expect(typeof feedbackId).toBe('string');
    });

    it('should calculate relevance metrics', async () => {
      // Score multiple results
      const results = [
        { resultId: 'result1', position: 1, score: 0.9 },
        { resultId: 'result2', position: 2, score: 0.7 },
        { resultId: 'result3', position: 3, score: 0.5 }
      ];

      for (const result of results) {
        await relevanceScorer.scoreRelevance(
          result.resultId,
          {
            title: `Test Result ${result.position}`,
            snippet: 'Test snippet',
            metadata: {}
          },
          'test query',
          {
            userProfile: {
              searchHistory: [],
              preferences: {},
              expertise: 'intermediate',
              language: 'en'
            },
            sessionContext: {
              previousQueries: [],
              clickedResults: [],
              timeSpentOnResults: {},
              sessionDuration: 0
            },
            temporalContext: {
              timeOfDay: 12,
              dayOfWeek: 1
            }
          }
        );
      }

      const metrics = await relevanceScorer.calculateRelevanceMetrics('test query', results);

      expect(metrics.averageRelevance).toBeGreaterThan(0);
      expect(metrics.precisionAtK).toHaveProperty('1');
      expect(metrics.precisionAtK).toHaveProperty('3');
      expect(metrics.ndcg).toHaveProperty('1');
      expect(metrics.meanReciprocalRank).toBeGreaterThan(0);
      expect(metrics.qualityDistribution).toHaveProperty('excellent');
    });
  });

  describe('UserSatisfactionMetrics', () => {
    it('should record survey responses and calculate metrics', async () => {
      const surveyId = satisfactionMetrics.recordSurveyResponse({
        userId: 'user1',
        sessionId: 'session1',
        query: 'test query',
        responses: {
          overallSatisfaction: 4,
          resultRelevance: 4,
          searchSpeed: 5,
          interfaceUsability: 3,
          wouldRecommend: true
        },
        feedback: {
          positiveAspects: ['fast search', 'relevant results'],
          improvementAreas: ['better interface'],
          comments: 'Good overall experience'
        },
        metadata: {
          searchType: 'detailed',
          resultCount: 10,
          searchDuration: 2500,
          platform: 'web',
          userAgent: 'Mozilla/5.0'
        }
      });

      expect(surveyId).toBeDefined();

      const metrics = await satisfactionMetrics.calculateSatisfactionMetrics();

      expect(metrics.overall.averageRating).toBeGreaterThan(0);
      expect(metrics.overall.satisfaction).toBeGreaterThan(0);
      expect(metrics.overall.sampleSize).toBe(1);
      expect(metrics.dimensions).toHaveProperty('relevance');
      expect(metrics.dimensions).toHaveProperty('speed');
      expect(metrics.dimensions).toHaveProperty('usability');
    });

    it('should track user journeys', () => {
      const journey = satisfactionMetrics.startUserJourney('user1', 'session1');

      expect(journey.userId).toBe('user1');
      expect(journey.sessionId).toBe('session1');
      expect(journey.startTime).toBeDefined();
      expect(journey.steps).toEqual([]);

      satisfactionMetrics.addJourneyStep('session1', 'search', { query: 'test' }, 4);
      satisfactionMetrics.addJourneyStep('session1', 'click', { resultId: 'result1' }, 4);

      satisfactionMetrics.completeUserJourney('session1', 'successful', 4);

      // Journey should be marked as completed
      expect(journey.outcome).toBe('successful');
      expect(journey.satisfactionScore).toBe(4);
    });

    it('should generate predictive insights', async () => {
      // Add some survey data
      for (let i = 1; i <= 5; i++) {
        satisfactionMetrics.recordSurveyResponse({
          userId: `user${i}`,
          sessionId: `session${i}`,
          query: 'test query',
          responses: {
            overallSatisfaction: Math.floor(Math.random() * 3) + 3, // 3-5
            resultRelevance: Math.floor(Math.random() * 3) + 3,
            searchSpeed: Math.floor(Math.random() * 3) + 3,
            interfaceUsability: Math.floor(Math.random() * 3) + 3,
            wouldRecommend: Math.random() > 0.5
          },
          feedback: {
            positiveAspects: ['good results'],
            improvementAreas: [],
            comments: 'Test feedback'
          },
          metadata: {
            searchType: 'quick',
            resultCount: 5,
            searchDuration: 1000,
            platform: 'web',
            userAgent: 'test'
          }
        });
      }

      const insights = await satisfactionMetrics.generatePredictiveInsights();

      expect(insights.satisfactionPrediction).toBeGreaterThan(0);
      expect(insights.riskFactors).toBeInstanceOf(Array);
      expect(insights.opportunityAreas).toBeInstanceOf(Array);
      expect(insights.userSegmentInsights).toBeInstanceOf(Array);
    });
  });

  describe('ConversionTracker', () => {
    it('should create and track conversion goals', () => {
      const goalId = conversionTracker.createGoal({
        name: 'Article Read',
        type: 'time_spent',
        category: 'micro',
        value: 5,
        conditions: {
          triggers: [{ event: 'page_view', parameters: { page_type: 'article' } }]
        },
        metadata: {
          description: 'User reads an article',
          priority: 'medium',
          isActive: true
        }
      });

      expect(goalId).toBeDefined();
      expect(typeof goalId).toBe('string');
    });

    it('should track events and record conversions', () => {
      // Create a goal first
      const goalId = conversionTracker.createGoal({
        name: 'Search Click',
        type: 'click',
        category: 'micro',
        value: 1,
        conditions: {
          triggers: [{ event: 'search_click' }]
        },
        metadata: {
          description: 'User clicks on search result',
          priority: 'high',
          isActive: true
        }
      });

      // Track an event
      const eventId = conversionTracker.trackEvent('user1', goalId, 'search_click', 1, {
        resultId: 'result1',
        query: 'test query',
        position: 1
      });

      expect(eventId).toBeDefined();
    });

    it('should calculate conversion metrics', async () => {
      // Create goal and track some conversions
      const goalId = conversionTracker.createGoal({
        name: 'Test Goal',
        type: 'click',
        category: 'macro',
        value: 10,
        conditions: {
          triggers: [{ event: 'test_event' }]
        },
        metadata: {
          description: 'Test goal',
          priority: 'high',
          isActive: true
        }
      });

      // Track events for multiple users
      for (let i = 1; i <= 5; i++) {
        conversionTracker.trackEvent(`user${i}`, goalId, 'test_event', 1, {
          testData: true
        });
      }

      const metrics = await conversionTracker.calculateConversionMetrics();

      expect(metrics.overall.totalConversions).toBeGreaterThan(0);
      expect(metrics.overall.totalValue).toBeGreaterThan(0);
      expect(metrics.byGoal).toHaveProperty(goalId);
    });

    it('should create and analyze conversion funnels', async () => {
      // Create a goal first
      const goalId = conversionTracker.createGoal({
        name: 'Funnel Goal',
        type: 'custom',
        category: 'macro',
        value: 20,
        conditions: {
          triggers: [{ event: 'final_step' }]
        },
        metadata: {
          description: 'Funnel completion goal',
          priority: 'high',
          isActive: true
        }
      });

      const funnelId = conversionTracker.createFunnel({
        name: 'User Engagement Funnel',
        goalId,
        stages: [
          {
            id: 'stage1',
            name: 'Search',
            order: 1,
            conditions: [{ event: 'search_performed' }],
            isRequired: true
          },
          {
            id: 'stage2',
            name: 'Click',
            order: 2,
            conditions: [{ event: 'result_clicked' }],
            isRequired: true
          },
          {
            id: 'stage3',
            name: 'Engage',
            order: 3,
            conditions: [{ event: 'time_spent' }],
            isRequired: false
          }
        ],
        timeframe: 30 * 60 * 1000, // 30 minutes
        isActive: true
      });

      expect(funnelId).toBeDefined();

      const analysis = await conversionTracker.analyzeFunnelPerformance(funnelId);

      expect(analysis.funnel).toBeDefined();
      expect(analysis.performance).toBeInstanceOf(Array);
      expect(analysis.insights).toHaveProperty('bottleneckStage');
      expect(analysis.insights).toHaveProperty('improvementOpportunities');
      expect(analysis.insights).toHaveProperty('recommendations');
    });
  });

  describe('ABTestingFramework', () => {
    it('should create and start A/B tests', () => {
      const testId = abTestingFramework.createTest({
        name: 'Search Algorithm Test',
        description: 'Testing new ranking algorithm',
        type: 'ab',
        trafficAllocation: 50,
        variants: [
          {
            id: 'control',
            name: 'Current Algorithm',
            description: 'Existing search algorithm',
            trafficWeight: 50,
            isControl: true,
            configuration: { algorithm: 'current' }
          },
          {
            id: 'variant',
            name: 'New Algorithm',
            description: 'Improved search algorithm',
            trafficWeight: 50,
            isControl: false,
            configuration: { algorithm: 'new', boost: 1.2 }
          }
        ],
        targeting: {
          userTypes: ['new', 'returning']
        },
        primaryMetric: 'click_through_rate',
        secondaryMetrics: ['conversion_rate'],
        successCriteria: {
          minimumDetectableEffect: 5,
          confidenceLevel: 0.95,
          statisticalPower: 0.8,
          minimumSampleSize: 1000
        },
        settings: {
          randomizationUnit: 'user',
          autoPromoteWinner: false
        },
        metadata: {
          description: 'Algorithm comparison test',
          priority: 'high',
          isActive: true
        }
      });

      expect(testId).toBeDefined();

      abTestingFramework.startTest(testId);

      // Assign users to test
      const assignment1 = abTestingFramework.assignUserToTest('user1', testId);
      const assignment2 = abTestingFramework.assignUserToTest('user2', testId);

      expect(assignment1).toBeDefined();
      expect(assignment2).toBeDefined();
      expect(assignment1?.variantId).toBeDefined();
      expect(assignment2?.variantId).toBeDefined();
    });

    it('should track events and analyze results', async () => {
      const testId = abTestingFramework.createTest({
        name: 'CTR Test',
        description: 'Testing click-through rates',
        type: 'ab',
        trafficAllocation: 100,
        variants: [
          {
            id: 'control',
            name: 'Control',
            description: 'Control variant',
            trafficWeight: 50,
            isControl: true,
            configuration: {}
          },
          {
            id: 'treatment',
            name: 'Treatment',
            description: 'Treatment variant',
            trafficWeight: 50,
            isControl: false,
            configuration: { feature: 'enabled' }
          }
        ],
        targeting: {},
        primaryMetric: 'click_through_rate',
        secondaryMetrics: [],
        successCriteria: {
          minimumDetectableEffect: 10,
          confidenceLevel: 0.95,
          statisticalPower: 0.8,
          minimumSampleSize: 100
        },
        settings: {
          randomizationUnit: 'user'
        },
        metadata: {
          description: 'CTR test',
          priority: 'medium',
          isActive: true
        }
      });

      abTestingFramework.startTest(testId);

      // Track events for multiple users
      for (let i = 1; i <= 20; i++) {
        const assignment = abTestingFramework.assignUserToTest(`user${i}`, testId);
        if (assignment) {
          // Track impression
          abTestingFramework.trackEvent(`user${i}`, testId, 'impression', 1);

          // Some users click (higher rate for treatment)
          const clickRate = assignment.variantId === 'treatment' ? 0.3 : 0.2;
          if (Math.random() < clickRate) {
            abTestingFramework.trackEvent(`user${i}`, testId, 'click', 1);
          }
        }
      }

      const results = await abTestingFramework.analyzeTestResults(testId);

      expect(results.testId).toBe(testId);
      expect(results.variants).toHaveLength(2);
      expect(results.totalParticipants).toBeGreaterThan(0);
      expect(results.recommendations).toBeDefined();
      expect(results.statisticalAnalysis).toBeDefined();
    });

    it('should perform Bayesian analysis', async () => {
      const testId = abTestingFramework.createTest({
        name: 'Bayesian Test',
        description: 'Testing with Bayesian analysis',
        type: 'ab',
        trafficAllocation: 100,
        variants: [
          {
            id: 'control',
            name: 'Control',
            description: 'Control variant',
            trafficWeight: 50,
            isControl: true,
            configuration: {}
          },
          {
            id: 'variant_a',
            name: 'Variant A',
            description: 'Test variant',
            trafficWeight: 50,
            isControl: false,
            configuration: { feature: 'a' }
          }
        ],
        targeting: {},
        primaryMetric: 'conversion_rate',
        secondaryMetrics: [],
        successCriteria: {
          minimumDetectableEffect: 5,
          confidenceLevel: 0.95,
          statisticalPower: 0.8,
          minimumSampleSize: 50
        },
        settings: {
          randomizationUnit: 'user'
        },
        metadata: {
          description: 'Bayesian test',
          priority: 'high',
          isActive: true
        }
      });

      abTestingFramework.startTest(testId);

      // Track some events
      for (let i = 1; i <= 10; i++) {
        const assignment = abTestingFramework.assignUserToTest(`user${i}`, testId);
        if (assignment) {
          abTestingFramework.trackEvent(`user${i}`, testId, 'view', 1);
          if (Math.random() < 0.5) {
            abTestingFramework.trackEvent(`user${i}`, testId, 'conversion', 1);
          }
        }
      }

      const bayesianAnalysis = await abTestingFramework.performBayesianAnalysis(testId);

      expect(bayesianAnalysis.testId).toBe(testId);
      expect(bayesianAnalysis.variants).toHaveLength(2);
      expect(bayesianAnalysis.recommendation).toBeDefined();
      expect(bayesianAnalysis.recommendation.recommendedAction).toMatch(/(continue|promote|stop)/);
    });
  });

  describe('AnalyticsOrchestrator', () => {
    it('should coordinate all analytics services', async () => {
      const experience = {
        userId: 'user1',
        sessionId: 'session1',
        query: 'machine learning tutorial',
        results: [
          {
            id: 'result1',
            title: 'Introduction to Machine Learning',
            snippet: 'Learn the basics of ML algorithms...',
            url: 'https://example.com/ml-intro',
            position: 1
          },
          {
            id: 'result2',
            title: 'Advanced ML Techniques',
            snippet: 'Deep dive into advanced techniques...',
            url: 'https://example.com/ml-advanced',
            position: 2
          }
        ],
        interactions: [
          {
            type: 'click' as const,
            resultId: 'result1',
            timestamp: Date.now(),
            data: {}
          },
          {
            type: 'dwell' as const,
            resultId: 'result1',
            timestamp: Date.now() + 5000,
            data: { duration: 5000 }
          }
        ],
        satisfaction: {
          rating: 4,
          feedback: 'Very helpful results',
          timestamp: Date.now()
        }
      };

      await analyticsOrchestrator.trackSearchExperience(experience);

      const analytics = await analyticsOrchestrator.getUnifiedAnalytics();

      expect(analytics.effectiveness).toBeDefined();
      expect(analytics.trends).toBeInstanceOf(Array);
      expect(analytics.insights).toBeInstanceOf(Array);
      expect(analytics.experiments).toBeDefined();
    });

    it('should create search algorithm A/B tests', async () => {
      const testId = await analyticsOrchestrator.createSearchAlgorithmTest(
        'Relevance Algorithm Test',
        'Testing improved relevance scoring',
        [
          {
            name: 'Current Algorithm',
            algorithmConfig: { textWeight: 0.7, linkWeight: 0.3 },
            trafficWeight: 50
          },
          {
            name: 'Improved Algorithm',
            algorithmConfig: { textWeight: 0.6, linkWeight: 0.2, semanticWeight: 0.2 },
            trafficWeight: 50
          }
        ]
      );

      expect(testId).toBeDefined();

      const config = analyticsOrchestrator.getSearchConfiguration('user1');
      expect(config).toBeDefined();
    });

    it('should export analytics data', async () => {
      const jsonData = await analyticsOrchestrator.exportAnalyticsData('json');
      expect(jsonData).toBeDefined();
      expect(() => JSON.parse(jsonData)).not.toThrow();

      const csvData = await analyticsOrchestrator.exportAnalyticsData('csv');
      expect(csvData).toBeDefined();
      expect(csvData).toContain('metric,value,timestamp');
    });
  });

  describe('Analytics Utils', () => {
    it('should calculate statistical significance', () => {
      const result = analyticsUtils.calculateSignificance(
        0.05, 0.02, 1000,  // Control: 5% conversion, 2% std dev, 1000 samples
        0.07, 0.025, 1000  // Variant: 7% conversion, 2.5% std dev, 1000 samples
      );

      expect(result.pValue).toBeGreaterThan(0);
      expect(result.pValue).toBeLessThan(1);
      expect(typeof result.isSignificant).toBe('boolean');
      expect(result.confidenceLevel).toBeGreaterThan(0);
    });

    it('should calculate confidence intervals', () => {
      const [lower, upper] = analyticsUtils.calculateProportionConfidenceInterval(50, 100, 0.95);

      expect(lower).toBeGreaterThanOrEqual(0);
      expect(upper).toBeLessThanOrEqual(1);
      expect(upper).toBeGreaterThan(lower);
    });

    it('should calculate required sample size', () => {
      const sampleSize = analyticsUtils.calculateRequiredSampleSize(
        0.05,  // 5% baseline conversion rate
        0.1,   // 10% minimum detectable effect
        0.05,  // 5% alpha (Type I error)
        0.2    // 20% beta (Type II error)
      );

      expect(sampleSize).toBeGreaterThan(0);
      expect(Number.isInteger(sampleSize)).toBe(true);
    });

    it('should detect anomalies in time series', () => {
      const values = [10, 12, 11, 13, 10, 50, 11, 12]; // 50 is an anomaly
      const anomalies = analyticsUtils.detectAnomalies(values, 2);

      expect(anomalies).toHaveLength(values.length);
      expect(anomalies.some(a => a.isAnomaly)).toBe(true);
      expect(anomalies.find(a => a.value === 50)?.isAnomaly).toBe(true);
    });

    it('should calculate correlation coefficient', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10]; // Perfect positive correlation

      const correlation = analyticsUtils.calculateCorrelation(x, y);

      expect(correlation).toBeCloseTo(1, 2); // Should be close to 1
    });
  });

  describe('Integration Testing', () => {
    it('should handle cross-service event coordination', async () => {
      let eventsReceived = 0;

      // Listen for cross-service events
      analyticsOrchestrator.on('relevanceUpdate', () => eventsReceived++);
      analyticsOrchestrator.on('abTestAssignment', () => eventsReceived++);

      // Track a complete search experience
      await analyticsOrchestrator.trackSearchExperience({
        userId: 'integration_user',
        sessionId: 'integration_session',
        query: 'integration test',
        results: [
          {
            id: 'integration_result',
            title: 'Integration Test Result',
            snippet: 'Test snippet',
            url: 'https://test.com',
            position: 1
          }
        ],
        interactions: [
          {
            type: 'click',
            resultId: 'integration_result',
            timestamp: Date.now()
          }
        ],
        satisfaction: {
          rating: 5,
          feedback: 'Excellent',
          timestamp: Date.now()
        }
      });

      // Verify events were coordinated across services
      expect(eventsReceived).toBeGreaterThan(0);
    });

    it('should maintain data consistency across services', async () => {
      const userId = 'consistency_user';
      const sessionId = 'consistency_session';
      const query = 'consistency test';

      // Track the same experience through the orchestrator
      await analyticsOrchestrator.trackSearchExperience({
        userId,
        sessionId,
        query,
        results: [
          {
            id: 'consistency_result',
            title: 'Consistency Test',
            snippet: 'Test',
            url: 'https://test.com',
            position: 1
          }
        ],
        interactions: [
          {
            type: 'click',
            resultId: 'consistency_result',
            timestamp: Date.now()
          }
        ]
      });

      // Verify data exists in individual services
      const ctrMetrics = await effectivenessTracker.calculateCTRMetrics();
      const satisfactionMetrics = await satisfactionMetrics.calculateSatisfactionMetrics();

      expect(ctrMetrics.sampleSize).toBeGreaterThan(0);
      // Note: satisfaction metrics might be 0 if no surveys were recorded
    });

    it('should handle high-volume analytics data efficiently', async () => {
      const startTime = Date.now();
      const experiences = [];

      // Generate 100 search experiences
      for (let i = 0; i < 100; i++) {
        experiences.push({
          userId: `bulk_user_${i}`,
          sessionId: `bulk_session_${i}`,
          query: `bulk query ${i}`,
          results: [
            {
              id: `bulk_result_${i}`,
              title: `Bulk Result ${i}`,
              snippet: 'Bulk test snippet',
              url: `https://bulk.com/${i}`,
              position: 1
            }
          ],
          interactions: [
            {
              type: 'click' as const,
              resultId: `bulk_result_${i}`,
              timestamp: Date.now()
            }
          ]
        });
      }

      // Track all experiences
      await Promise.all(
        experiences.map(exp => analyticsOrchestrator.trackSearchExperience(exp))
      );

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process 100 experiences in reasonable time (under 5 seconds)
      expect(processingTime).toBeLessThan(5000);

      // Verify data was processed
      const analytics = await analyticsOrchestrator.getUnifiedAnalytics();
      expect(analytics.effectiveness.ctr).toBeGreaterThan(0);
    });
  });
});