/**
 * ABTestingFramework - Comprehensive A/B testing system for search algorithms
 * Supports multivariate testing, statistical analysis, and automated decision making
 */

import { EventEmitter } from 'events';

export interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  type: 'ab' | 'multivariate' | 'multi_armed_bandit';
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  createdAt: number;
  startDate?: number;
  endDate?: number;

  // Test configuration
  trafficAllocation: number; // Percentage of traffic to include (0-100)
  variants: ABTestVariant[];

  // Targeting
  targeting: {
    userSegments?: string[];
    devices?: ('desktop' | 'mobile' | 'tablet')[];
    locations?: string[];
    userTypes?: ('new' | 'returning')[];
    customRules?: Array<{
      property: string;
      operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
      value: any;
    }>;
  };

  // Metrics and goals
  primaryMetric: string;
  secondaryMetrics: string[];
  successCriteria: {
    minimumDetectableEffect: number; // Percentage improvement
    confidenceLevel: number; // 0.95 for 95%
    statisticalPower: number; // 0.8 for 80%
    minimumSampleSize: number;
  };

  // Advanced settings
  settings: {
    randomizationUnit: 'user' | 'session';
    holdoutGroup?: number; // Percentage for holdout group
    autoPromoteWinner?: boolean;
    autoPromoteThreshold?: number;
    maxDuration?: number; // Maximum test duration in ms
  };
}

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  trafficWeight: number; // Percentage of test traffic (0-100)
  isControl: boolean;

  // Configuration for this variant
  configuration: {
    searchAlgorithm?: string;
    rankingWeights?: Record<string, number>;
    filterSettings?: Record<string, any>;
    uiElements?: Record<string, any>;
    customParameters?: Record<string, any>;
  };
}

export interface ABTestAssignment {
  userId: string;
  testId: string;
  variantId: string;
  assignedAt: number;
  sessionId?: string;
  isHoldout?: boolean;
}

export interface ABTestEvent {
  id: string;
  testId: string;
  variantId: string;
  userId: string;
  sessionId: string;
  eventType: string;
  eventValue?: number;
  timestamp: number;
  properties: Record<string, any>;
}

export interface ABTestResults {
  testId: string;
  status: 'running' | 'completed' | 'inconclusive';
  duration: number;
  totalParticipants: number;

  variants: Array<{
    variantId: string;
    name: string;
    participants: number;

    metrics: Record<string, {
      value: number;
      standardError: number;
      confidenceInterval: [number, number];
      sampleSize: number;
    }>;

    // Statistical significance vs control
    significance: Record<string, {
      pValue: number;
      isSignificant: boolean;
      effectSize: number;
      confidenceInterval: [number, number];
    }>;
  }>;

  recommendations: {
    winningVariant?: string;
    confidence: number;
    reasoning: string;
    nextSteps: string[];
  };

  statisticalAnalysis: {
    hasReachedSignificance: boolean;
    hasReachedMinimumSampleSize: boolean;
    estimatedTimeToSignificance?: number;
    powerAnalysis: {
      achievedPower: number;
      requiredSampleSize: number;
      currentSampleSize: number;
    };
  };
}

export interface BayesianAnalysis {
  testId: string;
  variants: Array<{
    variantId: string;
    probabilityOfBeingBest: number;
    expectedLoss: number;
    credibleInterval: [number, number];
    posteriorDistribution: {
      mean: number;
      variance: number;
      alpha: number;
      beta: number;
    };
  }>;
  recommendation: {
    recommendedAction: 'continue' | 'promote' | 'stop';
    variant?: string;
    confidence: number;
  };
}

export interface MultiArmedBanditConfig {
  algorithm: 'epsilon_greedy' | 'thompson_sampling' | 'ucb1';
  explorationRate?: number; // For epsilon-greedy
  decayRate?: number;
  updateFrequency: number; // How often to update allocation (ms)
}

export class ABTestingFramework extends EventEmitter {
  private tests: Map<string, ABTestConfig> = new Map();
  private assignments: Map<string, ABTestAssignment[]> = new Map(); // userId -> assignments
  private events: Map<string, ABTestEvent[]> = new Map(); // testId -> events
  private results: Map<string, ABTestResults> = new Map();
  private banditConfig: Map<string, MultiArmedBanditConfig> = new Map();
  private variantPerformance: Map<string, Map<string, number[]>> = new Map(); // testId -> variantId -> values

  constructor() {
    super();
    this.startPeriodicAnalysis();
  }

  /**
   * Create a new A/B test
   */
  createTest(config: Omit<ABTestConfig, 'id' | 'createdAt' | 'status'>): string {
    const test: ABTestConfig = {
      ...config,
      id: this.generateId(),
      createdAt: Date.now(),
      status: 'draft'
    };

    // Validate configuration
    this.validateTestConfig(test);

    this.tests.set(test.id, test);
    this.events.set(test.id, []);

    if (test.type === 'multi_armed_bandit') {
      this.initializeBandit(test.id);
    }

    this.emit('testCreated', test);
    return test.id;
  }

  /**
   * Start an A/B test
   */
  startTest(testId: string): void {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    if (test.status !== 'draft' && test.status !== 'paused') {
      throw new Error(`Cannot start test in status: ${test.status}`);
    }

    test.status = 'running';
    test.startDate = Date.now();

    // Set end date if max duration is specified
    if (test.settings.maxDuration) {
      test.endDate = test.startDate + test.settings.maxDuration;
    }

    this.tests.set(testId, test);
    this.emit('testStarted', test);
  }

  /**
   * Stop an A/B test
   */
  stopTest(testId: string, reason?: string): void {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    test.status = 'completed';
    test.endDate = Date.now();

    this.tests.set(testId, test);
    this.emit('testStopped', { test, reason });

    // Generate final results
    this.analyzeTestResults(testId);
  }

  /**
   * Assign user to test variant
   */
  assignUserToTest(userId: string, testId: string, sessionId?: string): ABTestAssignment | null {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'running') {
      return null;
    }

    // Check if user already assigned
    const existingAssignments = this.assignments.get(userId) || [];
    const existingAssignment = existingAssignments.find(a => a.testId === testId);
    if (existingAssignment) {
      return existingAssignment;
    }

    // Check if user meets targeting criteria
    if (!this.meetsTargetingCriteria(userId, test.targeting)) {
      return null;
    }

    // Check traffic allocation
    if (Math.random() * 100 > test.trafficAllocation) {
      return null;
    }

    // Check for holdout group
    const isHoldout = test.settings.holdoutGroup &&
      Math.random() * 100 < test.settings.holdoutGroup;

    let variantId: string;

    if (isHoldout) {
      // Assign to control for holdout
      variantId = test.variants.find(v => v.isControl)?.id || test.variants[0].id;
    } else if (test.type === 'multi_armed_bandit') {
      // Use bandit algorithm for assignment
      variantId = this.getBanditAssignment(testId);
    } else {
      // Standard random assignment based on weights
      variantId = this.getRandomVariantAssignment(test.variants, userId);
    }

    const assignment: ABTestAssignment = {
      userId,
      testId,
      variantId,
      assignedAt: Date.now(),
      sessionId,
      isHoldout
    };

    if (!this.assignments.has(userId)) {
      this.assignments.set(userId, []);
    }
    this.assignments.get(userId)!.push(assignment);

    this.emit('userAssigned', assignment);
    return assignment;
  }

  /**
   * Track event for A/B test
   */
  trackEvent(
    userId: string,
    testId: string,
    eventType: string,
    eventValue?: number,
    properties: Record<string, any> = {}
  ): string {
    const assignment = this.getUserAssignment(userId, testId);
    if (!assignment || assignment.isHoldout) {
      return '';
    }

    const event: ABTestEvent = {
      id: this.generateId(),
      testId,
      variantId: assignment.variantId,
      userId,
      sessionId: assignment.sessionId || 'unknown',
      eventType,
      eventValue,
      timestamp: Date.now(),
      properties
    };

    if (!this.events.has(testId)) {
      this.events.set(testId, []);
    }
    this.events.get(testId)!.push(event);

    // Update bandit performance if applicable
    if (this.tests.get(testId)?.type === 'multi_armed_bandit' && eventValue !== undefined) {
      this.updateBanditPerformance(testId, assignment.variantId, eventValue);
    }

    this.emit('eventTracked', event);
    return event.id;
  }

  /**
   * Get user's assignment for a test
   */
  getUserAssignment(userId: string, testId: string): ABTestAssignment | null {
    const userAssignments = this.assignments.get(userId) || [];
    return userAssignments.find(a => a.testId === testId) || null;
  }

  /**
   * Analyze test results with statistical significance
   */
  async analyzeTestResults(testId: string): Promise<ABTestResults> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const events = this.events.get(testId) || [];
    const testDuration = test.endDate ? test.endDate - (test.startDate || 0) : Date.now() - (test.startDate || 0);

    // Calculate metrics for each variant
    const variantResults = await Promise.all(
      test.variants.map(async variant => {
        const variantEvents = events.filter(e => e.variantId === variant.id);
        const participants = new Set(variantEvents.map(e => e.userId)).size;

        // Calculate metrics
        const metrics: Record<string, any> = {};
        const significance: Record<string, any> = {};

        // Primary metric
        const primaryMetricValue = this.calculateMetric(test.primaryMetric, variantEvents);
        metrics[test.primaryMetric] = {
          value: primaryMetricValue.value,
          standardError: primaryMetricValue.standardError,
          confidenceInterval: this.calculateConfidenceInterval(
            primaryMetricValue.value,
            primaryMetricValue.standardError,
            test.successCriteria.confidenceLevel
          ),
          sampleSize: participants
        };

        // Secondary metrics
        for (const metricName of test.secondaryMetrics) {
          const metricValue = this.calculateMetric(metricName, variantEvents);
          metrics[metricName] = {
            value: metricValue.value,
            standardError: metricValue.standardError,
            confidenceInterval: this.calculateConfidenceInterval(
              metricValue.value,
              metricValue.standardError,
              test.successCriteria.confidenceLevel
            ),
            sampleSize: participants
          };
        }

        return {
          variantId: variant.id,
          name: variant.name,
          participants,
          metrics,
          significance
        };
      })
    );

    // Calculate statistical significance vs control
    const controlVariant = variantResults.find(v =>
      test.variants.find(tv => tv.id === v.variantId)?.isControl
    );

    if (controlVariant) {
      variantResults.forEach(variant => {
        if (variant.variantId === controlVariant.variantId) return;

        // Calculate significance for primary metric
        const significance = this.calculateStatisticalSignificance(
          controlVariant.metrics[test.primaryMetric],
          variant.metrics[test.primaryMetric]
        );

        variant.significance[test.primaryMetric] = significance;

        // Calculate significance for secondary metrics
        test.secondaryMetrics.forEach(metricName => {
          const metricSignificance = this.calculateStatisticalSignificance(
            controlVariant.metrics[metricName],
            variant.metrics[metricName]
          );
          variant.significance[metricName] = metricSignificance;
        });
      });
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(test, variantResults);

    // Statistical analysis
    const statisticalAnalysis = this.performStatisticalAnalysis(test, variantResults);

    const results: ABTestResults = {
      testId,
      status: test.status === 'completed' ? 'completed' : 'running',
      duration: testDuration,
      totalParticipants: variantResults.reduce((sum, v) => sum + v.participants, 0),
      variants: variantResults,
      recommendations,
      statisticalAnalysis
    };

    this.results.set(testId, results);
    this.emit('resultsAnalyzed', results);

    // Auto-promote winner if configured
    if (test.settings.autoPromoteWinner && recommendations.winningVariant) {
      this.autoPromoteWinner(testId, recommendations.winningVariant);
    }

    return results;
  }

  /**
   * Perform Bayesian analysis for more nuanced insights
   */
  async performBayesianAnalysis(testId: string): Promise<BayesianAnalysis> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const events = this.events.get(testId) || [];

    const variants = await Promise.all(
      test.variants.map(async variant => {
        const variantEvents = events.filter(e => e.variantId === variant.id);
        const primaryMetricValues = this.getMetricValues(test.primaryMetric, variantEvents);

        // Calculate Bayesian posterior using Beta distribution
        const prior = { alpha: 1, beta: 1 }; // Uniform prior
        const successes = primaryMetricValues.filter(v => v > 0).length;
        const trials = primaryMetricValues.length;

        const posterior = {
          alpha: prior.alpha + successes,
          beta: prior.beta + trials - successes
        };

        const mean = posterior.alpha / (posterior.alpha + posterior.beta);
        const variance = (posterior.alpha * posterior.beta) /
          (Math.pow(posterior.alpha + posterior.beta, 2) * (posterior.alpha + posterior.beta + 1));

        // Monte Carlo simulation for probability of being best
        const samples = this.sampleBetaDistribution(posterior.alpha, posterior.beta, 10000);

        return {
          variantId: variant.id,
          probabilityOfBeingBest: 0, // Will be calculated after comparing all variants
          expectedLoss: 0, // Will be calculated
          credibleInterval: this.calculateCredibleInterval(samples, 0.95),
          posteriorDistribution: {
            mean,
            variance,
            alpha: posterior.alpha,
            beta: posterior.beta
          }
        };
      })
    );

    // Calculate probability of being best for each variant
    const allSamples = variants.map(v =>
      this.sampleBetaDistribution(v.posteriorDistribution.alpha, v.posteriorDistribution.beta, 10000)
    );

    variants.forEach((variant, index) => {
      let wins = 0;
      for (let i = 0; i < 10000; i++) {
        const variantSample = allSamples[index][i];
        const isWinner = allSamples.every((samples, idx) =>
          idx === index || variantSample > samples[i]
        );
        if (isWinner) wins++;
      }
      variant.probabilityOfBeingBest = wins / 10000;

      // Calculate expected loss
      const maxSample = Math.max(...allSamples.map(samples => Math.max(...samples)));
      variant.expectedLoss = maxSample - variant.posteriorDistribution.mean;
    });

    // Generate recommendation
    const bestVariant = variants.reduce((best, current) =>
      current.probabilityOfBeingBest > best.probabilityOfBeingBest ? current : best
    );

    const recommendation = {
      recommendedAction: bestVariant.probabilityOfBeingBest > 0.95 ? 'promote' as const :
                        bestVariant.probabilityOfBeingBest > 0.8 ? 'continue' as const : 'stop' as const,
      variant: bestVariant.probabilityOfBeingBest > 0.8 ? bestVariant.variantId : undefined,
      confidence: bestVariant.probabilityOfBeingBest
    };

    return {
      testId,
      variants,
      recommendation
    };
  }

  /**
   * Get test configuration for a variant
   */
  getVariantConfiguration(userId: string, testId: string): Record<string, any> | null {
    const assignment = this.getUserAssignment(userId, testId);
    if (!assignment) {
      return null;
    }

    const test = this.tests.get(testId);
    if (!test) {
      return null;
    }

    const variant = test.variants.find(v => v.id === assignment.variantId);
    return variant?.configuration || null;
  }

  /**
   * Get all active tests for a user
   */
  getActiveTestsForUser(userId: string): Array<{
    testId: string;
    testName: string;
    variantId: string;
    variantName: string;
    configuration: Record<string, any>;
  }> {
    const userAssignments = this.assignments.get(userId) || [];

    return userAssignments
      .filter(assignment => {
        const test = this.tests.get(assignment.testId);
        return test && test.status === 'running' && !assignment.isHoldout;
      })
      .map(assignment => {
        const test = this.tests.get(assignment.testId)!;
        const variant = test.variants.find(v => v.id === assignment.variantId)!;

        return {
          testId: assignment.testId,
          testName: test.name,
          variantId: assignment.variantId,
          variantName: variant.name,
          configuration: variant.configuration
        };
      });
  }

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData(): Promise<{
    activeTests: Array<{
      testId: string;
      name: string;
      status: string;
      participants: number;
      duration: number;
      confidence: number;
      leadingVariant?: string;
    }>;
    recentResults: Array<{
      testId: string;
      name: string;
      winner: string;
      improvement: number;
      confidence: number;
      completedAt: number;
    }>;
    performanceMetrics: {
      totalTests: number;
      activeTests: number;
      successfulTests: number;
      averageImprovement: number;
    };
    alerts: Array<{
      type: 'low_traffic' | 'no_significance' | 'high_variance' | 'test_ended';
      testId: string;
      message: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  }> {
    const allTests = Array.from(this.tests.values());
    const activeTests = allTests.filter(test => test.status === 'running');

    // Active tests summary
    const activeTestsData = await Promise.all(
      activeTests.map(async test => {
        const results = await this.analyzeTestResults(test.id);
        const leadingVariant = results.recommendations.winningVariant;

        return {
          testId: test.id,
          name: test.name,
          status: test.status,
          participants: results.totalParticipants,
          duration: results.duration,
          confidence: results.recommendations.confidence,
          leadingVariant
        };
      })
    );

    // Recent completed tests
    const completedTests = allTests
      .filter(test => test.status === 'completed')
      .sort((a, b) => (b.endDate || 0) - (a.endDate || 0))
      .slice(0, 5);

    const recentResults = await Promise.all(
      completedTests.map(async test => {
        const results = this.results.get(test.id);
        if (!results || !results.recommendations.winningVariant) {
          return null;
        }

        const winnerResults = results.variants.find(v => v.variantId === results.recommendations.winningVariant);
        const controlResults = results.variants.find(v =>
          test.variants.find(tv => tv.id === v.variantId)?.isControl
        );

        const improvement = winnerResults && controlResults
          ? ((winnerResults.metrics[test.primaryMetric].value - controlResults.metrics[test.primaryMetric].value)
             / controlResults.metrics[test.primaryMetric].value) * 100
          : 0;

        return {
          testId: test.id,
          name: test.name,
          winner: test.variants.find(v => v.id === results.recommendations.winningVariant)?.name || 'Unknown',
          improvement,
          confidence: results.recommendations.confidence,
          completedAt: test.endDate || 0
        };
      })
    );

    // Performance metrics
    const successfulTests = completedTests.filter(test => {
      const results = this.results.get(test.id);
      return results && results.recommendations.winningVariant;
    }).length;

    const averageImprovement = recentResults
      .filter(r => r !== null)
      .reduce((sum, r) => sum + r!.improvement, 0) / Math.max(recentResults.length, 1);

    const performanceMetrics = {
      totalTests: allTests.length,
      activeTests: activeTests.length,
      successfulTests,
      averageImprovement
    };

    // Generate alerts
    const alerts = await this.generateTestAlerts(activeTests);

    return {
      activeTests: activeTestsData,
      recentResults: recentResults.filter(r => r !== null) as any,
      performanceMetrics,
      alerts
    };
  }

  // Private helper methods

  private validateTestConfig(test: ABTestConfig): void {
    if (test.variants.length < 2) {
      throw new Error('Test must have at least 2 variants');
    }

    const totalWeight = test.variants.reduce((sum, variant) => sum + variant.trafficWeight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error('Variant weights must sum to 100%');
    }

    const controlVariants = test.variants.filter(v => v.isControl);
    if (controlVariants.length !== 1) {
      throw new Error('Test must have exactly one control variant');
    }

    if (test.successCriteria.confidenceLevel < 0.8 || test.successCriteria.confidenceLevel > 0.99) {
      throw new Error('Confidence level must be between 80% and 99%');
    }
  }

  private meetsTargetingCriteria(userId: string, targeting: ABTestConfig['targeting']): boolean {
    // Simplified targeting logic - would integrate with actual user data
    return true;
  }

  private getRandomVariantAssignment(variants: ABTestVariant[], userId: string): string {
    // Use user ID for consistent assignment
    const hash = this.hashString(userId);
    const random = (hash % 10000) / 10000; // 0-1 range

    let cumulativeWeight = 0;
    for (const variant of variants) {
      cumulativeWeight += variant.trafficWeight / 100;
      if (random <= cumulativeWeight) {
        return variant.id;
      }
    }

    return variants[0].id; // Fallback
  }

  private getBanditAssignment(testId: string): string {
    const banditConfig = this.banditConfig.get(testId);
    const test = this.tests.get(testId);

    if (!banditConfig || !test) {
      return test?.variants[0].id || '';
    }

    const performance = this.variantPerformance.get(testId) || new Map();

    switch (banditConfig.algorithm) {
      case 'epsilon_greedy':
        return this.epsilonGreedySelection(test.variants, performance, banditConfig.explorationRate || 0.1);

      case 'thompson_sampling':
        return this.thompsonSamplingSelection(test.variants, performance);

      case 'ucb1':
        return this.ucb1Selection(test.variants, performance);

      default:
        return test.variants[0].id;
    }
  }

  private epsilonGreedySelection(
    variants: ABTestVariant[],
    performance: Map<string, number[]>,
    epsilon: number
  ): string {
    if (Math.random() < epsilon) {
      // Explore: random selection
      return variants[Math.floor(Math.random() * variants.length)].id;
    } else {
      // Exploit: select best performing variant
      let bestVariant = variants[0];
      let bestMean = 0;

      variants.forEach(variant => {
        const values = performance.get(variant.id) || [];
        if (values.length > 0) {
          const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
          if (mean > bestMean) {
            bestMean = mean;
            bestVariant = variant;
          }
        }
      });

      return bestVariant.id;
    }
  }

  private thompsonSamplingSelection(variants: ABTestVariant[], performance: Map<string, number[]>): string {
    const samples = variants.map(variant => {
      const values = performance.get(variant.id) || [];
      if (values.length === 0) {
        return Math.random(); // Uniform sampling for new variants
      }

      // Use Beta distribution sampling for Thompson Sampling
      const successes = values.filter(v => v > 0).length;
      const trials = values.length;
      const alpha = 1 + successes;
      const beta = 1 + trials - successes;

      return this.sampleBeta(alpha, beta);
    });

    const bestIndex = samples.indexOf(Math.max(...samples));
    return variants[bestIndex].id;
  }

  private ucb1Selection(variants: ABTestVariant[], performance: Map<string, number[]>): string {
    const totalPlays = variants.reduce((total, variant) => {
      return total + (performance.get(variant.id)?.length || 0);
    }, 0);

    if (totalPlays === 0) {
      return variants[0].id;
    }

    let bestVariant = variants[0];
    let bestUcb = -Infinity;

    variants.forEach(variant => {
      const values = performance.get(variant.id) || [];
      if (values.length === 0) {
        // Infinite UCB for unplayed arms
        bestVariant = variant;
        return;
      }

      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const confidence = Math.sqrt((2 * Math.log(totalPlays)) / values.length);
      const ucb = mean + confidence;

      if (ucb > bestUcb) {
        bestUcb = ucb;
        bestVariant = variant;
      }
    });

    return bestVariant.id;
  }

  private calculateMetric(metricName: string, events: ABTestEvent[]): { value: number; standardError: number } {
    switch (metricName) {
      case 'conversion_rate':
        const conversions = events.filter(e => e.eventType === 'conversion').length;
        const totalUsers = new Set(events.map(e => e.userId)).size;
        const rate = totalUsers > 0 ? conversions / totalUsers : 0;
        const standardError = totalUsers > 0 ? Math.sqrt(rate * (1 - rate) / totalUsers) : 0;
        return { value: rate, standardError };

      case 'click_through_rate':
        const clicks = events.filter(e => e.eventType === 'click').length;
        const impressions = events.filter(e => e.eventType === 'impression').length;
        const ctr = impressions > 0 ? clicks / impressions : 0;
        const ctrStandardError = impressions > 0 ? Math.sqrt(ctr * (1 - ctr) / impressions) : 0;
        return { value: ctr, standardError: ctrStandardError };

      case 'average_time_spent':
        const timeEvents = events.filter(e => e.eventType === 'time_spent' && e.eventValue);
        const avgTime = timeEvents.length > 0
          ? timeEvents.reduce((sum, e) => sum + (e.eventValue || 0), 0) / timeEvents.length
          : 0;
        const timeVariance = timeEvents.length > 1
          ? timeEvents.reduce((sum, e) => sum + Math.pow((e.eventValue || 0) - avgTime, 2), 0) / (timeEvents.length - 1)
          : 0;
        const timeStandardError = timeEvents.length > 0 ? Math.sqrt(timeVariance / timeEvents.length) : 0;
        return { value: avgTime, standardError: timeStandardError };

      default:
        return { value: 0, standardError: 0 };
    }
  }

  private getMetricValues(metricName: string, events: ABTestEvent[]): number[] {
    switch (metricName) {
      case 'conversion_rate':
        const userConversions = new Map<string, boolean>();
        events.forEach(e => {
          if (e.eventType === 'conversion') {
            userConversions.set(e.userId, true);
          } else if (!userConversions.has(e.userId)) {
            userConversions.set(e.userId, false);
          }
        });
        return Array.from(userConversions.values()).map(converted => converted ? 1 : 0);

      case 'click_through_rate':
        // Simplified - would need proper impression/click pairing
        return events.filter(e => e.eventType === 'click').map(() => 1);

      default:
        return events.filter(e => e.eventValue !== undefined).map(e => e.eventValue!);
    }
  }

  private calculateConfidenceInterval(value: number, standardError: number, confidenceLevel: number): [number, number] {
    const z = this.getZScore(confidenceLevel);
    const margin = z * standardError;
    return [value - margin, value + margin];
  }

  private calculateStatisticalSignificance(
    control: { value: number; standardError: number; sampleSize: number },
    variant: { value: number; standardError: number; sampleSize: number }
  ): { pValue: number; isSignificant: boolean; effectSize: number; confidenceInterval: [number, number] } {
    const pooledStandardError = Math.sqrt(
      Math.pow(control.standardError, 2) + Math.pow(variant.standardError, 2)
    );

    const effectSize = variant.value - control.value;
    const zScore = pooledStandardError > 0 ? effectSize / pooledStandardError : 0;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));

    const isSignificant = pValue < 0.05; // 95% confidence level

    const margin = 1.96 * pooledStandardError; // 95% CI
    const confidenceInterval: [number, number] = [effectSize - margin, effectSize + margin];

    return {
      pValue,
      isSignificant,
      effectSize,
      confidenceInterval
    };
  }

  private generateRecommendations(test: ABTestConfig, variants: ABTestResults['variants']): ABTestResults['recommendations'] {
    let winningVariant: string | undefined;
    let confidence = 0;
    let reasoning = '';
    const nextSteps: string[] = [];

    // Find variant with best primary metric performance
    const controlVariant = variants.find(v =>
      test.variants.find(tv => tv.id === v.variantId)?.isControl
    );

    if (!controlVariant) {
      return {
        confidence: 0,
        reasoning: 'No control variant found',
        nextSteps: ['Review test configuration']
      };
    }

    let bestVariant = controlVariant;
    let bestImprovement = 0;

    variants.forEach(variant => {
      if (variant.variantId === controlVariant.variantId) return;

      const significance = variant.significance[test.primaryMetric];
      if (significance && significance.isSignificant) {
        const improvement = (variant.metrics[test.primaryMetric].value - controlVariant.metrics[test.primaryMetric].value) / controlVariant.metrics[test.primaryMetric].value;

        if (improvement > bestImprovement) {
          bestImprovement = improvement;
          bestVariant = variant;
          winningVariant = variant.variantId;
          confidence = 1 - significance.pValue;
        }
      }
    });

    if (winningVariant) {
      reasoning = `Variant ${bestVariant.name} shows a ${(bestImprovement * 100).toFixed(1)}% improvement over control with ${(confidence * 100).toFixed(1)}% confidence`;
      nextSteps.push(
        'Implement winning variant',
        'Monitor post-launch metrics',
        'Plan follow-up tests based on learnings'
      );
    } else {
      reasoning = 'No variant achieved statistical significance';
      nextSteps.push(
        'Continue test to reach significance',
        'Review test design and metrics',
        'Consider increasing traffic allocation'
      );
    }

    return {
      winningVariant,
      confidence,
      reasoning,
      nextSteps
    };
  }

  private performStatisticalAnalysis(test: ABTestConfig, variants: ABTestResults['variants']): ABTestResults['statisticalAnalysis'] {
    const totalParticipants = variants.reduce((sum, v) => sum + v.participants, 0);
    const hasReachedMinimumSampleSize = totalParticipants >= test.successCriteria.minimumSampleSize;

    const hasReachedSignificance = variants.some(variant => {
      const significance = variant.significance[test.primaryMetric];
      return significance && significance.isSignificant;
    });

    // Estimate time to significance (simplified)
    const currentSampleSize = totalParticipants;
    const requiredSampleSize = test.successCriteria.minimumSampleSize;
    const estimatedTimeToSignificance = hasReachedSignificance ? 0 :
      (requiredSampleSize - currentSampleSize) * 24 * 60 * 60 * 1000; // Assume 1 day per sample

    // Calculate achieved power (simplified)
    const achievedPower = Math.min(currentSampleSize / requiredSampleSize, 1) * test.successCriteria.statisticalPower;

    return {
      hasReachedSignificance,
      hasReachedMinimumSampleSize,
      estimatedTimeToSignificance: hasReachedSignificance ? undefined : estimatedTimeToSignificance,
      powerAnalysis: {
        achievedPower,
        requiredSampleSize,
        currentSampleSize
      }
    };
  }

  private autoPromoteWinner(testId: string, winningVariantId: string): void {
    const test = this.tests.get(testId);
    if (!test) return;

    this.stopTest(testId, 'Auto-promoted winner');

    this.emit('winnerPromoted', {
      testId,
      winningVariantId,
      timestamp: Date.now()
    });
  }

  private initializeBandit(testId: string): void {
    const defaultConfig: MultiArmedBanditConfig = {
      algorithm: 'thompson_sampling',
      updateFrequency: 60000, // 1 minute
      explorationRate: 0.1
    };

    this.banditConfig.set(testId, defaultConfig);
    this.variantPerformance.set(testId, new Map());

    // Start periodic updates
    const updateInterval = setInterval(() => {
      const test = this.tests.get(testId);
      if (!test || test.status !== 'running') {
        clearInterval(updateInterval);
        return;
      }

      this.updateBanditAllocations(testId);
    }, defaultConfig.updateFrequency);
  }

  private updateBanditPerformance(testId: string, variantId: string, value: number): void {
    const performance = this.variantPerformance.get(testId);
    if (!performance) return;

    if (!performance.has(variantId)) {
      performance.set(variantId, []);
    }

    performance.get(variantId)!.push(value);

    // Keep only last 1000 values to prevent memory issues
    const values = performance.get(variantId)!;
    if (values.length > 1000) {
      values.shift();
    }
  }

  private updateBanditAllocations(testId: string): void {
    // Update traffic allocation based on performance
    this.emit('banditAllocationUpdated', { testId, timestamp: Date.now() });
  }

  private async generateTestAlerts(activeTests: ABTestConfig[]): Promise<Array<{
    type: 'low_traffic' | 'no_significance' | 'high_variance' | 'test_ended';
    testId: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>> {
    const alerts: Array<{
      type: 'low_traffic' | 'no_significance' | 'high_variance' | 'test_ended';
      testId: string;
      message: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    for (const test of activeTests) {
      const results = await this.analyzeTestResults(test.id);

      // Low traffic alert
      if (results.totalParticipants < test.successCriteria.minimumSampleSize * 0.1) {
        alerts.push({
          type: 'low_traffic',
          testId: test.id,
          message: `Test "${test.name}" has low traffic (${results.totalParticipants} participants)`,
          severity: 'medium'
        });
      }

      // No significance after sufficient time
      const testDuration = Date.now() - (test.startDate || 0);
      if (testDuration > 14 * 24 * 60 * 60 * 1000 && !results.statisticalAnalysis.hasReachedSignificance) { // 14 days
        alerts.push({
          type: 'no_significance',
          testId: test.id,
          message: `Test "${test.name}" has run for 2+ weeks without reaching significance`,
          severity: 'high'
        });
      }

      // Test ended
      if (test.endDate && test.endDate < Date.now()) {
        alerts.push({
          type: 'test_ended',
          testId: test.id,
          message: `Test "${test.name}" has ended and should be reviewed`,
          severity: 'high'
        });
      }
    }

    return alerts;
  }

  // Statistical utility methods

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private getZScore(confidenceLevel: number): number {
    // Simplified Z-score lookup
    if (confidenceLevel >= 0.99) return 2.576;
    if (confidenceLevel >= 0.95) return 1.96;
    if (confidenceLevel >= 0.90) return 1.645;
    return 1.96; // Default to 95%
  }

  private normalCDF(z: number): number {
    // Approximation of normal cumulative distribution function
    return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private sampleBeta(alpha: number, beta: number): number {
    // Simple beta distribution sampling using gamma distributions
    const gamma1 = this.sampleGamma(alpha, 1);
    const gamma2 = this.sampleGamma(beta, 1);
    return gamma1 / (gamma1 + gamma2);
  }

  private sampleGamma(shape: number, scale: number): number {
    // Simplified gamma distribution sampling
    if (shape < 1) {
      return this.sampleGamma(1 + shape, scale) * Math.pow(Math.random(), 1 / shape);
    }

    const d = shape - 1/3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let x, v;
      do {
        x = this.sampleNormal(0, 1);
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = Math.random();

      if (u < 1 - 0.0331 * x * x * x * x) {
        return d * v * scale;
      }

      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v * scale;
      }
    }
  }

  private sampleNormal(mean: number, stddev: number): number {
    // Box-Muller transform
    const u = 0.5 - Math.random();
    const v = 0.5 - Math.random();
    const normal = Math.sqrt(-2.0 * Math.log(Math.abs(u))) * Math.cos(2.0 * Math.PI * v);
    return mean + stddev * normal;
  }

  private sampleBetaDistribution(alpha: number, beta: number, samples: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < samples; i++) {
      result.push(this.sampleBeta(alpha, beta));
    }
    return result;
  }

  private calculateCredibleInterval(samples: number[], credibility: number): [number, number] {
    const sorted = samples.sort((a, b) => a - b);
    const tail = (1 - credibility) / 2;
    const lowerIndex = Math.floor(tail * sorted.length);
    const upperIndex = Math.floor((1 - tail) * sorted.length);
    return [sorted[lowerIndex], sorted[upperIndex]];
  }

  private startPeriodicAnalysis(): void {
    // Analyze running tests every 5 minutes
    setInterval(async () => {
      const runningTests = Array.from(this.tests.values()).filter(test => test.status === 'running');

      for (const test of runningTests) {
        try {
          await this.analyzeTestResults(test.id);
        } catch (error) {
          this.emit('analysisError', { testId: test.id, error });
        }
      }
    }, 5 * 60 * 1000);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}