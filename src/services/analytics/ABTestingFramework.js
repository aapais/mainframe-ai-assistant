'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ABTestingFramework = void 0;
const events_1 = require('events');
class ABTestingFramework extends events_1.EventEmitter {
  tests = new Map();
  assignments = new Map();
  events = new Map();
  results = new Map();
  banditConfig = new Map();
  variantPerformance = new Map();
  constructor() {
    super();
    this.startPeriodicAnalysis();
  }
  createTest(config) {
    const test = {
      ...config,
      id: this.generateId(),
      createdAt: Date.now(),
      status: 'draft',
    };
    this.validateTestConfig(test);
    this.tests.set(test.id, test);
    this.events.set(test.id, []);
    if (test.type === 'multi_armed_bandit') {
      this.initializeBandit(test.id);
    }
    this.emit('testCreated', test);
    return test.id;
  }
  startTest(testId) {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }
    if (test.status !== 'draft' && test.status !== 'paused') {
      throw new Error(`Cannot start test in status: ${test.status}`);
    }
    test.status = 'running';
    test.startDate = Date.now();
    if (test.settings.maxDuration) {
      test.endDate = test.startDate + test.settings.maxDuration;
    }
    this.tests.set(testId, test);
    this.emit('testStarted', test);
  }
  stopTest(testId, reason) {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }
    test.status = 'completed';
    test.endDate = Date.now();
    this.tests.set(testId, test);
    this.emit('testStopped', { test, reason });
    this.analyzeTestResults(testId);
  }
  assignUserToTest(userId, testId, sessionId) {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'running') {
      return null;
    }
    const existingAssignments = this.assignments.get(userId) || [];
    const existingAssignment = existingAssignments.find(a => a.testId === testId);
    if (existingAssignment) {
      return existingAssignment;
    }
    if (!this.meetsTargetingCriteria(userId, test.targeting)) {
      return null;
    }
    if (Math.random() * 100 > test.trafficAllocation) {
      return null;
    }
    const isHoldout =
      test.settings.holdoutGroup && Math.random() * 100 < test.settings.holdoutGroup;
    let variantId;
    if (isHoldout) {
      variantId = test.variants.find(v => v.isControl)?.id || test.variants[0].id;
    } else if (test.type === 'multi_armed_bandit') {
      variantId = this.getBanditAssignment(testId);
    } else {
      variantId = this.getRandomVariantAssignment(test.variants, userId);
    }
    const assignment = {
      userId,
      testId,
      variantId,
      assignedAt: Date.now(),
      sessionId,
      isHoldout,
    };
    if (!this.assignments.has(userId)) {
      this.assignments.set(userId, []);
    }
    this.assignments.get(userId).push(assignment);
    this.emit('userAssigned', assignment);
    return assignment;
  }
  trackEvent(userId, testId, eventType, eventValue, properties = {}) {
    const assignment = this.getUserAssignment(userId, testId);
    if (!assignment || assignment.isHoldout) {
      return '';
    }
    const event = {
      id: this.generateId(),
      testId,
      variantId: assignment.variantId,
      userId,
      sessionId: assignment.sessionId || 'unknown',
      eventType,
      eventValue,
      timestamp: Date.now(),
      properties,
    };
    if (!this.events.has(testId)) {
      this.events.set(testId, []);
    }
    this.events.get(testId).push(event);
    if (this.tests.get(testId)?.type === 'multi_armed_bandit' && eventValue !== undefined) {
      this.updateBanditPerformance(testId, assignment.variantId, eventValue);
    }
    this.emit('eventTracked', event);
    return event.id;
  }
  getUserAssignment(userId, testId) {
    const userAssignments = this.assignments.get(userId) || [];
    return userAssignments.find(a => a.testId === testId) || null;
  }
  async analyzeTestResults(testId) {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }
    const events = this.events.get(testId) || [];
    const testDuration = test.endDate
      ? test.endDate - (test.startDate || 0)
      : Date.now() - (test.startDate || 0);
    const variantResults = await Promise.all(
      test.variants.map(async variant => {
        const variantEvents = events.filter(e => e.variantId === variant.id);
        const participants = new Set(variantEvents.map(e => e.userId)).size;
        const metrics = {};
        const significance = {};
        const primaryMetricValue = this.calculateMetric(test.primaryMetric, variantEvents);
        metrics[test.primaryMetric] = {
          value: primaryMetricValue.value,
          standardError: primaryMetricValue.standardError,
          confidenceInterval: this.calculateConfidenceInterval(
            primaryMetricValue.value,
            primaryMetricValue.standardError,
            test.successCriteria.confidenceLevel
          ),
          sampleSize: participants,
        };
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
            sampleSize: participants,
          };
        }
        return {
          variantId: variant.id,
          name: variant.name,
          participants,
          metrics,
          significance,
        };
      })
    );
    const controlVariant = variantResults.find(
      v => test.variants.find(tv => tv.id === v.variantId)?.isControl
    );
    if (controlVariant) {
      variantResults.forEach(variant => {
        if (variant.variantId === controlVariant.variantId) return;
        const significance = this.calculateStatisticalSignificance(
          controlVariant.metrics[test.primaryMetric],
          variant.metrics[test.primaryMetric]
        );
        variant.significance[test.primaryMetric] = significance;
        test.secondaryMetrics.forEach(metricName => {
          const metricSignificance = this.calculateStatisticalSignificance(
            controlVariant.metrics[metricName],
            variant.metrics[metricName]
          );
          variant.significance[metricName] = metricSignificance;
        });
      });
    }
    const recommendations = this.generateRecommendations(test, variantResults);
    const statisticalAnalysis = this.performStatisticalAnalysis(test, variantResults);
    const results = {
      testId,
      status: test.status === 'completed' ? 'completed' : 'running',
      duration: testDuration,
      totalParticipants: variantResults.reduce((sum, v) => sum + v.participants, 0),
      variants: variantResults,
      recommendations,
      statisticalAnalysis,
    };
    this.results.set(testId, results);
    this.emit('resultsAnalyzed', results);
    if (test.settings.autoPromoteWinner && recommendations.winningVariant) {
      this.autoPromoteWinner(testId, recommendations.winningVariant);
    }
    return results;
  }
  async performBayesianAnalysis(testId) {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }
    const events = this.events.get(testId) || [];
    const variants = await Promise.all(
      test.variants.map(async variant => {
        const variantEvents = events.filter(e => e.variantId === variant.id);
        const primaryMetricValues = this.getMetricValues(test.primaryMetric, variantEvents);
        const prior = { alpha: 1, beta: 1 };
        const successes = primaryMetricValues.filter(v => v > 0).length;
        const trials = primaryMetricValues.length;
        const posterior = {
          alpha: prior.alpha + successes,
          beta: prior.beta + trials - successes,
        };
        const mean = posterior.alpha / (posterior.alpha + posterior.beta);
        const variance =
          (posterior.alpha * posterior.beta) /
          (Math.pow(posterior.alpha + posterior.beta, 2) * (posterior.alpha + posterior.beta + 1));
        const samples = this.sampleBetaDistribution(posterior.alpha, posterior.beta, 10000);
        return {
          variantId: variant.id,
          probabilityOfBeingBest: 0,
          expectedLoss: 0,
          credibleInterval: this.calculateCredibleInterval(samples, 0.95),
          posteriorDistribution: {
            mean,
            variance,
            alpha: posterior.alpha,
            beta: posterior.beta,
          },
        };
      })
    );
    const allSamples = variants.map(v =>
      this.sampleBetaDistribution(
        v.posteriorDistribution.alpha,
        v.posteriorDistribution.beta,
        10000
      )
    );
    variants.forEach((variant, index) => {
      let wins = 0;
      for (let i = 0; i < 10000; i++) {
        const variantSample = allSamples[index][i];
        const isWinner = allSamples.every(
          (samples, idx) => idx === index || variantSample > samples[i]
        );
        if (isWinner) wins++;
      }
      variant.probabilityOfBeingBest = wins / 10000;
      const maxSample = Math.max(...allSamples.map(samples => Math.max(...samples)));
      variant.expectedLoss = maxSample - variant.posteriorDistribution.mean;
    });
    const bestVariant = variants.reduce((best, current) =>
      current.probabilityOfBeingBest > best.probabilityOfBeingBest ? current : best
    );
    const recommendation = {
      recommendedAction:
        bestVariant.probabilityOfBeingBest > 0.95
          ? 'promote'
          : bestVariant.probabilityOfBeingBest > 0.8
            ? 'continue'
            : 'stop',
      variant: bestVariant.probabilityOfBeingBest > 0.8 ? bestVariant.variantId : undefined,
      confidence: bestVariant.probabilityOfBeingBest,
    };
    return {
      testId,
      variants,
      recommendation,
    };
  }
  getVariantConfiguration(userId, testId) {
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
  getActiveTestsForUser(userId) {
    const userAssignments = this.assignments.get(userId) || [];
    return userAssignments
      .filter(assignment => {
        const test = this.tests.get(assignment.testId);
        return test && test.status === 'running' && !assignment.isHoldout;
      })
      .map(assignment => {
        const test = this.tests.get(assignment.testId);
        const variant = test.variants.find(v => v.id === assignment.variantId);
        return {
          testId: assignment.testId,
          testName: test.name,
          variantId: assignment.variantId,
          variantName: variant.name,
          configuration: variant.configuration,
        };
      });
  }
  async getDashboardData() {
    const allTests = Array.from(this.tests.values());
    const activeTests = allTests.filter(test => test.status === 'running');
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
          leadingVariant,
        };
      })
    );
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
        const winnerResults = results.variants.find(
          v => v.variantId === results.recommendations.winningVariant
        );
        const controlResults = results.variants.find(
          v => test.variants.find(tv => tv.id === v.variantId)?.isControl
        );
        const improvement =
          winnerResults && controlResults
            ? ((winnerResults.metrics[test.primaryMetric].value -
                controlResults.metrics[test.primaryMetric].value) /
                controlResults.metrics[test.primaryMetric].value) *
              100
            : 0;
        return {
          testId: test.id,
          name: test.name,
          winner:
            test.variants.find(v => v.id === results.recommendations.winningVariant)?.name ||
            'Unknown',
          improvement,
          confidence: results.recommendations.confidence,
          completedAt: test.endDate || 0,
        };
      })
    );
    const successfulTests = completedTests.filter(test => {
      const results = this.results.get(test.id);
      return results && results.recommendations.winningVariant;
    }).length;
    const averageImprovement =
      recentResults.filter(r => r !== null).reduce((sum, r) => sum + r.improvement, 0) /
      Math.max(recentResults.length, 1);
    const performanceMetrics = {
      totalTests: allTests.length,
      activeTests: activeTests.length,
      successfulTests,
      averageImprovement,
    };
    const alerts = await this.generateTestAlerts(activeTests);
    return {
      activeTests: activeTestsData,
      recentResults: recentResults.filter(r => r !== null),
      performanceMetrics,
      alerts,
    };
  }
  validateTestConfig(test) {
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
  meetsTargetingCriteria(userId, targeting) {
    return true;
  }
  getRandomVariantAssignment(variants, userId) {
    const hash = this.hashString(userId);
    const random = (hash % 10000) / 10000;
    let cumulativeWeight = 0;
    for (const variant of variants) {
      cumulativeWeight += variant.trafficWeight / 100;
      if (random <= cumulativeWeight) {
        return variant.id;
      }
    }
    return variants[0].id;
  }
  getBanditAssignment(testId) {
    const banditConfig = this.banditConfig.get(testId);
    const test = this.tests.get(testId);
    if (!banditConfig || !test) {
      return test?.variants[0].id || '';
    }
    const performance = this.variantPerformance.get(testId) || new Map();
    switch (banditConfig.algorithm) {
      case 'epsilon_greedy':
        return this.epsilonGreedySelection(
          test.variants,
          performance,
          banditConfig.explorationRate || 0.1
        );
      case 'thompson_sampling':
        return this.thompsonSamplingSelection(test.variants, performance);
      case 'ucb1':
        return this.ucb1Selection(test.variants, performance);
      default:
        return test.variants[0].id;
    }
  }
  epsilonGreedySelection(variants, performance, epsilon) {
    if (Math.random() < epsilon) {
      return variants[Math.floor(Math.random() * variants.length)].id;
    } else {
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
  thompsonSamplingSelection(variants, performance) {
    const samples = variants.map(variant => {
      const values = performance.get(variant.id) || [];
      if (values.length === 0) {
        return Math.random();
      }
      const successes = values.filter(v => v > 0).length;
      const trials = values.length;
      const alpha = 1 + successes;
      const beta = 1 + trials - successes;
      return this.sampleBeta(alpha, beta);
    });
    const bestIndex = samples.indexOf(Math.max(...samples));
    return variants[bestIndex].id;
  }
  ucb1Selection(variants, performance) {
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
  calculateMetric(metricName, events) {
    switch (metricName) {
      case 'conversion_rate':
        const conversions = events.filter(e => e.eventType === 'conversion').length;
        const totalUsers = new Set(events.map(e => e.userId)).size;
        const rate = totalUsers > 0 ? conversions / totalUsers : 0;
        const standardError = totalUsers > 0 ? Math.sqrt((rate * (1 - rate)) / totalUsers) : 0;
        return { value: rate, standardError };
      case 'click_through_rate':
        const clicks = events.filter(e => e.eventType === 'click').length;
        const impressions = events.filter(e => e.eventType === 'impression').length;
        const ctr = impressions > 0 ? clicks / impressions : 0;
        const ctrStandardError = impressions > 0 ? Math.sqrt((ctr * (1 - ctr)) / impressions) : 0;
        return { value: ctr, standardError: ctrStandardError };
      case 'average_time_spent':
        const timeEvents = events.filter(e => e.eventType === 'time_spent' && e.eventValue);
        const avgTime =
          timeEvents.length > 0
            ? timeEvents.reduce((sum, e) => sum + (e.eventValue || 0), 0) / timeEvents.length
            : 0;
        const timeVariance =
          timeEvents.length > 1
            ? timeEvents.reduce((sum, e) => sum + Math.pow((e.eventValue || 0) - avgTime, 2), 0) /
              (timeEvents.length - 1)
            : 0;
        const timeStandardError =
          timeEvents.length > 0 ? Math.sqrt(timeVariance / timeEvents.length) : 0;
        return { value: avgTime, standardError: timeStandardError };
      default:
        return { value: 0, standardError: 0 };
    }
  }
  getMetricValues(metricName, events) {
    switch (metricName) {
      case 'conversion_rate':
        const userConversions = new Map();
        events.forEach(e => {
          if (e.eventType === 'conversion') {
            userConversions.set(e.userId, true);
          } else if (!userConversions.has(e.userId)) {
            userConversions.set(e.userId, false);
          }
        });
        return Array.from(userConversions.values()).map(converted => (converted ? 1 : 0));
      case 'click_through_rate':
        return events.filter(e => e.eventType === 'click').map(() => 1);
      default:
        return events.filter(e => e.eventValue !== undefined).map(e => e.eventValue);
    }
  }
  calculateConfidenceInterval(value, standardError, confidenceLevel) {
    const z = this.getZScore(confidenceLevel);
    const margin = z * standardError;
    return [value - margin, value + margin];
  }
  calculateStatisticalSignificance(control, variant) {
    const pooledStandardError = Math.sqrt(
      Math.pow(control.standardError, 2) + Math.pow(variant.standardError, 2)
    );
    const effectSize = variant.value - control.value;
    const zScore = pooledStandardError > 0 ? effectSize / pooledStandardError : 0;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
    const isSignificant = pValue < 0.05;
    const margin = 1.96 * pooledStandardError;
    const confidenceInterval = [effectSize - margin, effectSize + margin];
    return {
      pValue,
      isSignificant,
      effectSize,
      confidenceInterval,
    };
  }
  generateRecommendations(test, variants) {
    let winningVariant;
    let confidence = 0;
    let reasoning = '';
    const nextSteps = [];
    const controlVariant = variants.find(
      v => test.variants.find(tv => tv.id === v.variantId)?.isControl
    );
    if (!controlVariant) {
      return {
        confidence: 0,
        reasoning: 'No control variant found',
        nextSteps: ['Review test configuration'],
      };
    }
    let bestVariant = controlVariant;
    let bestImprovement = 0;
    variants.forEach(variant => {
      if (variant.variantId === controlVariant.variantId) return;
      const significance = variant.significance[test.primaryMetric];
      if (significance && significance.isSignificant) {
        const improvement =
          (variant.metrics[test.primaryMetric].value -
            controlVariant.metrics[test.primaryMetric].value) /
          controlVariant.metrics[test.primaryMetric].value;
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
      nextSteps,
    };
  }
  performStatisticalAnalysis(test, variants) {
    const totalParticipants = variants.reduce((sum, v) => sum + v.participants, 0);
    const hasReachedMinimumSampleSize = totalParticipants >= test.successCriteria.minimumSampleSize;
    const hasReachedSignificance = variants.some(variant => {
      const significance = variant.significance[test.primaryMetric];
      return significance && significance.isSignificant;
    });
    const currentSampleSize = totalParticipants;
    const requiredSampleSize = test.successCriteria.minimumSampleSize;
    const estimatedTimeToSignificance = hasReachedSignificance
      ? 0
      : (requiredSampleSize - currentSampleSize) * 24 * 60 * 60 * 1000;
    const achievedPower =
      Math.min(currentSampleSize / requiredSampleSize, 1) * test.successCriteria.statisticalPower;
    return {
      hasReachedSignificance,
      hasReachedMinimumSampleSize,
      estimatedTimeToSignificance: hasReachedSignificance ? undefined : estimatedTimeToSignificance,
      powerAnalysis: {
        achievedPower,
        requiredSampleSize,
        currentSampleSize,
      },
    };
  }
  autoPromoteWinner(testId, winningVariantId) {
    const test = this.tests.get(testId);
    if (!test) return;
    this.stopTest(testId, 'Auto-promoted winner');
    this.emit('winnerPromoted', {
      testId,
      winningVariantId,
      timestamp: Date.now(),
    });
  }
  initializeBandit(testId) {
    const defaultConfig = {
      algorithm: 'thompson_sampling',
      updateFrequency: 60000,
      explorationRate: 0.1,
    };
    this.banditConfig.set(testId, defaultConfig);
    this.variantPerformance.set(testId, new Map());
    const updateInterval = setInterval(() => {
      const test = this.tests.get(testId);
      if (!test || test.status !== 'running') {
        clearInterval(updateInterval);
        return;
      }
      this.updateBanditAllocations(testId);
    }, defaultConfig.updateFrequency);
  }
  updateBanditPerformance(testId, variantId, value) {
    const performance = this.variantPerformance.get(testId);
    if (!performance) return;
    if (!performance.has(variantId)) {
      performance.set(variantId, []);
    }
    performance.get(variantId).push(value);
    const values = performance.get(variantId);
    if (values.length > 1000) {
      values.shift();
    }
  }
  updateBanditAllocations(testId) {
    this.emit('banditAllocationUpdated', { testId, timestamp: Date.now() });
  }
  async generateTestAlerts(activeTests) {
    const alerts = [];
    for (const test of activeTests) {
      const results = await this.analyzeTestResults(test.id);
      if (results.totalParticipants < test.successCriteria.minimumSampleSize * 0.1) {
        alerts.push({
          type: 'low_traffic',
          testId: test.id,
          message: `Test "${test.name}" has low traffic (${results.totalParticipants} participants)`,
          severity: 'medium',
        });
      }
      const testDuration = Date.now() - (test.startDate || 0);
      if (
        testDuration > 14 * 24 * 60 * 60 * 1000 &&
        !results.statisticalAnalysis.hasReachedSignificance
      ) {
        alerts.push({
          type: 'no_significance',
          testId: test.id,
          message: `Test "${test.name}" has run for 2+ weeks without reaching significance`,
          severity: 'high',
        });
      }
      if (test.endDate && test.endDate < Date.now()) {
        alerts.push({
          type: 'test_ended',
          testId: test.id,
          message: `Test "${test.name}" has ended and should be reviewed`,
          severity: 'high',
        });
      }
    }
    return alerts;
  }
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  getZScore(confidenceLevel) {
    if (confidenceLevel >= 0.99) return 2.576;
    if (confidenceLevel >= 0.95) return 1.96;
    if (confidenceLevel >= 0.9) return 1.645;
    return 1.96;
  }
  normalCDF(z) {
    return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
  }
  erf(x) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }
  sampleBeta(alpha, beta) {
    const gamma1 = this.sampleGamma(alpha, 1);
    const gamma2 = this.sampleGamma(beta, 1);
    return gamma1 / (gamma1 + gamma2);
  }
  sampleGamma(shape, scale) {
    if (shape < 1) {
      return this.sampleGamma(1 + shape, scale) * Math.pow(Math.random(), 1 / shape);
    }
    const d = shape - 1 / 3;
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
  sampleNormal(mean, stddev) {
    const u = 0.5 - Math.random();
    const v = 0.5 - Math.random();
    const normal = Math.sqrt(-2.0 * Math.log(Math.abs(u))) * Math.cos(2.0 * Math.PI * v);
    return mean + stddev * normal;
  }
  sampleBetaDistribution(alpha, beta, samples) {
    const result = [];
    for (let i = 0; i < samples; i++) {
      result.push(this.sampleBeta(alpha, beta));
    }
    return result;
  }
  calculateCredibleInterval(samples, credibility) {
    const sorted = samples.sort((a, b) => a - b);
    const tail = (1 - credibility) / 2;
    const lowerIndex = Math.floor(tail * sorted.length);
    const upperIndex = Math.floor((1 - tail) * sorted.length);
    return [sorted[lowerIndex], sorted[upperIndex]];
  }
  startPeriodicAnalysis() {
    setInterval(
      async () => {
        const runningTests = Array.from(this.tests.values()).filter(
          test => test.status === 'running'
        );
        for (const test of runningTests) {
          try {
            await this.analyzeTestResults(test.id);
          } catch (error) {
            this.emit('analysisError', { testId: test.id, error });
          }
        }
      },
      5 * 60 * 1000
    );
  }
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
exports.ABTestingFramework = ABTestingFramework;
//# sourceMappingURL=ABTestingFramework.js.map
