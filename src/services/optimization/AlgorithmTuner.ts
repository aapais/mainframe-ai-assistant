/**
 * AlgorithmTuner - Intelligent search algorithm parameter optimization
 * Analyzes search performance and provides tuning recommendations
 */

import { EventEmitter } from 'events';

export interface SearchMetrics {
  timestamp: number;
  query: string;
  responseTime: number;
  resultsCount: number;
  relevanceScore: number;
  algorithm: string;
  parameters: Record<string, any>;
  userInteraction?: {
    clickThroughRate: number;
    dwellTime: number;
    refinements: number;
  };
}

export interface AlgorithmConfig {
  fuzzySearch: {
    threshold: number;
    distance: number;
    includeScore: boolean;
    includeMatches: boolean;
  };
  indexing: {
    batchSize: number;
    updateFrequency: number;
    compressionLevel: number;
  };
  scoring: {
    relevanceWeight: number;
    freshnessWeight: number;
    popularityWeight: number;
    personalizedWeight: number;
  };
  performance: {
    maxResults: number;
    cacheSize: number;
    cacheTTL: number;
    timeoutMs: number;
  };
}

export interface TuningRecommendation {
  id: string;
  timestamp: number;
  algorithm: string;
  parameter: string;
  currentValue: any;
  recommendedValue: any;
  reason: string;
  expectedImprovement: number;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  testData: {
    sampleQueries: string[];
    expectedResults: any[];
    benchmarkMetrics: SearchMetrics[];
  };
}

export class AlgorithmTuner extends EventEmitter {
  private metrics: SearchMetrics[] = [];
  private config: AlgorithmConfig;
  private performanceBaselines: Map<string, number> = new Map();
  private tuningHistory: Map<string, TuningRecommendation[]> = new Map();
  private activeTuning: Map<string, any> = new Map();

  constructor() {
    super();

    this.config = {
      fuzzySearch: {
        threshold: 0.6,
        distance: 100,
        includeScore: true,
        includeMatches: true
      },
      indexing: {
        batchSize: 1000,
        updateFrequency: 300, // 5 minutes
        compressionLevel: 6
      },
      scoring: {
        relevanceWeight: 0.4,
        freshnessWeight: 0.2,
        popularityWeight: 0.2,
        personalizedWeight: 0.2
      },
      performance: {
        maxResults: 50,
        cacheSize: 1000,
        cacheTTL: 300, // 5 minutes
        timeoutMs: 5000
      }
    };
  }

  /**
   * Initialize the algorithm tuner
   */
  async initialize(): Promise<void> {
    console.log('Initializing AlgorithmTuner...');

    // Establish performance baselines
    await this.establishBaselines();

    // Start performance monitoring
    this.startPerformanceMonitoring();

    console.log('AlgorithmTuner initialized');
  }

  /**
   * Record search metrics for analysis
   */
  recordSearchMetrics(metrics: SearchMetrics): void {
    this.metrics.push({
      ...metrics,
      timestamp: Date.now()
    });

    // Keep only last 10,000 metrics for memory efficiency
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000);
    }

    // Emit for real-time monitoring
    this.emit('metrics-recorded', metrics);

    // Check for immediate optimization opportunities
    this.checkForImmediateOptimizations(metrics);
  }

  /**
   * Analyze current search performance
   */
  async analyzePerformance(): Promise<any[]> {
    const recentMetrics = this.getRecentMetrics(24 * 60 * 60 * 1000); // Last 24 hours

    if (recentMetrics.length === 0) {
      return [];
    }

    const analysis = {
      averageResponseTime: this.calculateAverageResponseTime(recentMetrics),
      averageRelevanceScore: this.calculateAverageRelevanceScore(recentMetrics),
      queryPatterns: this.analyzeQueryPatterns(recentMetrics),
      performanceTrends: this.analyzePerformanceTrends(recentMetrics),
      algorithmEfficiency: this.analyzeAlgorithmEfficiency(recentMetrics),
      userEngagement: this.analyzeUserEngagement(recentMetrics)
    };

    this.emit('performance-analyzed', analysis);
    return [this.createPerformanceMetric(analysis)];
  }

  /**
   * Get optimization recommendations
   */
  async getOptimizationRecommendations(metrics: any[]): Promise<TuningRecommendation[]> {
    const recommendations: TuningRecommendation[] = [];
    const recentMetrics = this.getRecentMetrics(24 * 60 * 60 * 1000);

    if (recentMetrics.length === 0) {
      return recommendations;
    }

    // Analyze different aspects and generate recommendations
    recommendations.push(...await this.analyzeFuzzySearchParameters(recentMetrics));
    recommendations.push(...await this.analyzeScoringWeights(recentMetrics));
    recommendations.push(...await this.analyzePerformanceParameters(recentMetrics));
    recommendations.push(...await this.analyzeIndexingStrategy(recentMetrics));

    // Sort by expected improvement and confidence
    return recommendations.sort((a, b) => {
      const scoreA = a.expectedImprovement * (a.confidence / 100);
      const scoreB = b.expectedImprovement * (b.confidence / 100);
      return scoreB - scoreA;
    });
  }

  /**
   * Analyze fuzzy search parameters
   */
  private async analyzeFuzzySearchParameters(metrics: SearchMetrics[]): Promise<TuningRecommendation[]> {
    const recommendations: TuningRecommendation[] = [];
    const avgRelevance = this.calculateAverageRelevanceScore(metrics);
    const avgResponseTime = this.calculateAverageResponseTime(metrics);

    // Analyze fuzzy threshold
    if (avgRelevance < 0.7) {
      recommendations.push({
        id: `fuzzy-threshold-${Date.now()}`,
        timestamp: Date.now(),
        algorithm: 'fuzzySearch',
        parameter: 'threshold',
        currentValue: this.config.fuzzySearch.threshold,
        recommendedValue: Math.max(0.4, this.config.fuzzySearch.threshold - 0.1),
        reason: 'Low relevance scores suggest fuzzy threshold is too strict',
        expectedImprovement: 15,
        confidence: 80,
        impact: 'medium',
        effort: 'low',
        testData: {
          sampleQueries: this.extractSampleQueries(metrics, 10),
          expectedResults: [],
          benchmarkMetrics: metrics.slice(-50)
        }
      });
    }

    // Analyze distance parameter
    if (avgResponseTime > 1000) {
      recommendations.push({
        id: `fuzzy-distance-${Date.now()}`,
        timestamp: Date.now(),
        algorithm: 'fuzzySearch',
        parameter: 'distance',
        currentValue: this.config.fuzzySearch.distance,
        recommendedValue: Math.min(50, this.config.fuzzySearch.distance - 20),
        reason: 'High response times suggest distance parameter is too large',
        expectedImprovement: 25,
        confidence: 75,
        impact: 'high',
        effort: 'low',
        testData: {
          sampleQueries: this.extractSampleQueries(metrics, 10),
          expectedResults: [],
          benchmarkMetrics: metrics.slice(-50)
        }
      });
    }

    return recommendations;
  }

  /**
   * Analyze scoring weights
   */
  private async analyzeScoringWeights(metrics: SearchMetrics[]): Promise<TuningRecommendation[]> {
    const recommendations: TuningRecommendation[] = [];
    const engagementData = this.analyzeUserEngagement(metrics);

    // If low click-through rates, adjust relevance weight
    if (engagementData.averageClickThroughRate < 0.3) {
      recommendations.push({
        id: `scoring-relevance-${Date.now()}`,
        timestamp: Date.now(),
        algorithm: 'scoring',
        parameter: 'relevanceWeight',
        currentValue: this.config.scoring.relevanceWeight,
        recommendedValue: Math.min(0.6, this.config.scoring.relevanceWeight + 0.1),
        reason: 'Low click-through rates suggest relevance scoring needs improvement',
        expectedImprovement: 20,
        confidence: 70,
        impact: 'high',
        effort: 'medium',
        testData: {
          sampleQueries: this.extractSampleQueries(metrics, 15),
          expectedResults: [],
          benchmarkMetrics: metrics.slice(-100)
        }
      });
    }

    return recommendations;
  }

  /**
   * Analyze performance parameters
   */
  private async analyzePerformanceParameters(metrics: SearchMetrics[]): Promise<TuningRecommendation[]> {
    const recommendations: TuningRecommendation[] = [];
    const avgResponseTime = this.calculateAverageResponseTime(metrics);

    // If response time is high, suggest reducing max results
    if (avgResponseTime > 2000) {
      recommendations.push({
        id: `performance-maxresults-${Date.now()}`,
        timestamp: Date.now(),
        algorithm: 'performance',
        parameter: 'maxResults',
        currentValue: this.config.performance.maxResults,
        recommendedValue: Math.max(20, this.config.performance.maxResults - 10),
        reason: 'High response times suggest too many results are being processed',
        expectedImprovement: 30,
        confidence: 85,
        impact: 'high',
        effort: 'low',
        testData: {
          sampleQueries: this.extractSampleQueries(metrics, 10),
          expectedResults: [],
          benchmarkMetrics: metrics.slice(-50)
        }
      });
    }

    // Cache optimization
    const cacheHitAnalysis = this.analyzeCacheEfficiency(metrics);
    if (cacheHitAnalysis.hitRate < 0.5) {
      recommendations.push({
        id: `performance-cache-${Date.now()}`,
        timestamp: Date.now(),
        algorithm: 'performance',
        parameter: 'cacheSize',
        currentValue: this.config.performance.cacheSize,
        recommendedValue: this.config.performance.cacheSize * 2,
        reason: 'Low cache hit rate suggests cache size should be increased',
        expectedImprovement: 40,
        confidence: 90,
        impact: 'high',
        effort: 'medium',
        testData: {
          sampleQueries: this.extractSampleQueries(metrics, 20),
          expectedResults: [],
          benchmarkMetrics: metrics.slice(-100)
        }
      });
    }

    return recommendations;
  }

  /**
   * Analyze indexing strategy
   */
  private async analyzeIndexingStrategy(metrics: SearchMetrics[]): Promise<TuningRecommendation[]> {
    const recommendations: TuningRecommendation[] = [];

    // Analyze update frequency vs performance
    const updatePatterns = this.analyzeUpdatePatterns(metrics);
    if (updatePatterns.updateLatency > 10000) {
      recommendations.push({
        id: `indexing-frequency-${Date.now()}`,
        timestamp: Date.now(),
        algorithm: 'indexing',
        parameter: 'updateFrequency',
        currentValue: this.config.indexing.updateFrequency,
        recommendedValue: this.config.indexing.updateFrequency * 2,
        reason: 'High update latency suggests index updates are too frequent',
        expectedImprovement: 25,
        confidence: 75,
        impact: 'medium',
        effort: 'low',
        testData: {
          sampleQueries: this.extractSampleQueries(metrics, 10),
          expectedResults: [],
          benchmarkMetrics: metrics.slice(-50)
        }
      });
    }

    return recommendations;
  }

  /**
   * Apply optimization recommendation
   */
  async applyOptimization(recommendation: any): Promise<boolean> {
    try {
      console.log(`Applying algorithm optimization: ${recommendation.title}`);

      // Store original value for rollback
      const originalValue = this.getConfigValue(recommendation.parameter);

      // Apply the recommendation
      this.setConfigValue(recommendation.parameter, recommendation.recommendedValue);

      // Test the optimization
      const testResults = await this.testOptimization(recommendation);

      if (testResults.success) {
        // Store successful tuning
        const history = this.tuningHistory.get(recommendation.algorithm) || [];
        history.push({
          ...recommendation,
          appliedAt: Date.now(),
          results: testResults
        });
        this.tuningHistory.set(recommendation.algorithm, history);

        this.emit('tuning-applied', {
          recommendation,
          results: testResults
        });

        return true;
      } else {
        // Rollback on failure
        this.setConfigValue(recommendation.parameter, originalValue);
        console.log(`Optimization failed, rolled back: ${recommendation.title}`);
        return false;
      }

    } catch (error) {
      console.error('Error applying algorithm optimization:', error);
      return false;
    }
  }

  /**
   * Test an optimization recommendation
   */
  private async testOptimization(recommendation: TuningRecommendation): Promise<any> {
    const testQueries = recommendation.testData.sampleQueries;
    const results = [];

    // Run test queries and measure performance
    for (const query of testQueries.slice(0, 5)) { // Test with first 5 queries
      const startTime = Date.now();

      // Simulate search execution with new parameters
      const testResult = await this.simulateSearchWithConfig(query);

      const endTime = Date.now();

      results.push({
        query,
        responseTime: endTime - startTime,
        relevanceScore: testResult.relevanceScore,
        resultsCount: testResult.resultsCount
      });
    }

    // Calculate improvement
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
    const avgRelevance = results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length;

    const baselineResponseTime = this.performanceBaselines.get('responseTime') || 1000;
    const baselineRelevance = this.performanceBaselines.get('relevance') || 0.7;

    const responseTimeImprovement = ((baselineResponseTime - avgResponseTime) / baselineResponseTime) * 100;
    const relevanceImprovement = ((avgRelevance - baselineRelevance) / baselineRelevance) * 100;

    return {
      success: responseTimeImprovement > -10 && relevanceImprovement > -5, // Don't degrade too much
      responseTimeImprovement,
      relevanceImprovement,
      testResults: results,
      overallImprovement: (responseTimeImprovement + relevanceImprovement) / 2
    };
  }

  /**
   * Simulate search with current configuration
   */
  private async simulateSearchWithConfig(query: string): Promise<any> {
    // This would integrate with actual search implementation
    // For now, return simulated results based on config

    const baseResponseTime = 500;
    const fuzzinessPenalty = (1 - this.config.fuzzySearch.threshold) * 200;
    const distancePenalty = this.config.fuzzySearch.distance / 10;

    return {
      responseTime: baseResponseTime + fuzzinessPenalty + distancePenalty,
      relevanceScore: this.config.fuzzySearch.threshold + (Math.random() * 0.2),
      resultsCount: Math.floor(Math.random() * this.config.performance.maxResults)
    };
  }

  /**
   * Helper methods for configuration management
   */
  private getConfigValue(parameter: string): any {
    const parts = parameter.split('.');
    let value: any = this.config;
    for (const part of parts) {
      value = value[part];
      if (value === undefined) break;
    }
    return value;
  }

  private setConfigValue(parameter: string, value: any): void {
    const parts = parameter.split('.');
    let obj: any = this.config;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
  }

  /**
   * Utility methods for analysis
   */
  private getRecentMetrics(timeWindowMs: number): SearchMetrics[] {
    const cutoff = Date.now() - timeWindowMs;
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }

  private calculateAverageResponseTime(metrics: SearchMetrics[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
  }

  private calculateAverageRelevanceScore(metrics: SearchMetrics[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.relevanceScore, 0) / metrics.length;
  }

  private analyzeQueryPatterns(metrics: SearchMetrics[]): any {
    const queryLengths = metrics.map(m => m.query.length);
    const avgQueryLength = queryLengths.reduce((sum, len) => sum + len, 0) / queryLengths.length;

    return {
      averageQueryLength: avgQueryLength,
      commonTerms: this.extractCommonTerms(metrics),
      queryTypes: this.categorizeQueries(metrics)
    };
  }

  private analyzePerformanceTrends(metrics: SearchMetrics[]): any {
    const hourlyData = this.groupMetricsByHour(metrics);
    return {
      peakHours: this.identifyPeakHours(hourlyData),
      trendDirection: this.calculateTrendDirection(hourlyData),
      volatility: this.calculateVolatility(hourlyData)
    };
  }

  private analyzeAlgorithmEfficiency(metrics: SearchMetrics[]): any {
    const algorithmGroups = this.groupMetricsByAlgorithm(metrics);
    return Object.entries(algorithmGroups).map(([algorithm, groupMetrics]) => ({
      algorithm,
      averageResponseTime: this.calculateAverageResponseTime(groupMetrics as SearchMetrics[]),
      averageRelevance: this.calculateAverageRelevanceScore(groupMetrics as SearchMetrics[]),
      usageCount: (groupMetrics as SearchMetrics[]).length
    }));
  }

  private analyzeUserEngagement(metrics: SearchMetrics[]): any {
    const engagementMetrics = metrics.filter(m => m.userInteraction);

    if (engagementMetrics.length === 0) {
      return {
        averageClickThroughRate: 0.3, // Default assumption
        averageDwellTime: 30000,
        averageRefinements: 1
      };
    }

    return {
      averageClickThroughRate: engagementMetrics.reduce((sum, m) =>
        sum + (m.userInteraction?.clickThroughRate || 0), 0) / engagementMetrics.length,
      averageDwellTime: engagementMetrics.reduce((sum, m) =>
        sum + (m.userInteraction?.dwellTime || 0), 0) / engagementMetrics.length,
      averageRefinements: engagementMetrics.reduce((sum, m) =>
        sum + (m.userInteraction?.refinements || 0), 0) / engagementMetrics.length
    };
  }

  private analyzeCacheEfficiency(metrics: SearchMetrics[]): any {
    // Simplified cache analysis
    const duplicateQueries = this.findDuplicateQueries(metrics);
    const totalQueries = metrics.length;
    const cacheableQueries = duplicateQueries.length;

    return {
      hitRate: cacheableQueries / totalQueries,
      potentialSavings: (cacheableQueries * 0.8), // Assume 80% time savings from cache
      recommendations: cacheableQueries > totalQueries * 0.3 ? ['increase-cache-size'] : []
    };
  }

  private analyzeUpdatePatterns(metrics: SearchMetrics[]): any {
    // Simulate index update analysis
    return {
      updateLatency: Math.random() * 20000, // 0-20 seconds
      updateFrequency: this.config.indexing.updateFrequency,
      impactOnSearch: Math.random() * 0.3 // 0-30% impact
    };
  }

  private extractSampleQueries(metrics: SearchMetrics[], count: number): string[] {
    return metrics
      .map(m => m.query)
      .filter((query, index, self) => self.indexOf(query) === index) // Unique queries
      .slice(0, count);
  }

  private extractCommonTerms(metrics: SearchMetrics[]): string[] {
    const allTerms = metrics.flatMap(m => m.query.toLowerCase().split(/\s+/));
    const termCounts = new Map<string, number>();

    allTerms.forEach(term => {
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
    });

    return Array.from(termCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term]) => term);
  }

  private categorizeQueries(metrics: SearchMetrics[]): any {
    return {
      short: metrics.filter(m => m.query.length < 10).length,
      medium: metrics.filter(m => m.query.length >= 10 && m.query.length < 30).length,
      long: metrics.filter(m => m.query.length >= 30).length
    };
  }

  private groupMetricsByHour(metrics: SearchMetrics[]): Map<number, SearchMetrics[]> {
    const groups = new Map<number, SearchMetrics[]>();

    metrics.forEach(metric => {
      const hour = new Date(metric.timestamp).getHours();
      if (!groups.has(hour)) {
        groups.set(hour, []);
      }
      groups.get(hour)!.push(metric);
    });

    return groups;
  }

  private groupMetricsByAlgorithm(metrics: SearchMetrics[]): Record<string, SearchMetrics[]> {
    const groups: Record<string, SearchMetrics[]> = {};

    metrics.forEach(metric => {
      if (!groups[metric.algorithm]) {
        groups[metric.algorithm] = [];
      }
      groups[metric.algorithm].push(metric);
    });

    return groups;
  }

  private identifyPeakHours(hourlyData: Map<number, SearchMetrics[]>): number[] {
    const hourCounts = Array.from(hourlyData.entries())
      .map(([hour, metrics]) => ({ hour, count: metrics.length }))
      .sort((a, b) => b.count - a.count);

    return hourCounts.slice(0, 3).map(item => item.hour);
  }

  private calculateTrendDirection(hourlyData: Map<number, SearchMetrics[]>): string {
    const hours = Array.from(hourlyData.keys()).sort();
    if (hours.length < 3) return 'stable';

    const recentHours = hours.slice(-3);
    const olderHours = hours.slice(0, 3);

    const recentAvg = recentHours.reduce((sum, h) => sum + (hourlyData.get(h)?.length || 0), 0) / recentHours.length;
    const olderAvg = olderHours.reduce((sum, h) => sum + (hourlyData.get(h)?.length || 0), 0) / olderHours.length;

    if (recentAvg > olderAvg * 1.1) return 'increasing';
    if (recentAvg < olderAvg * 0.9) return 'decreasing';
    return 'stable';
  }

  private calculateVolatility(hourlyData: Map<number, SearchMetrics[]>): number {
    const counts = Array.from(hourlyData.values()).map(metrics => metrics.length);
    if (counts.length < 2) return 0;

    const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;

    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  private findDuplicateQueries(metrics: SearchMetrics[]): SearchMetrics[] {
    const queryMap = new Map<string, SearchMetrics[]>();

    metrics.forEach(metric => {
      const query = metric.query.toLowerCase().trim();
      if (!queryMap.has(query)) {
        queryMap.set(query, []);
      }
      queryMap.get(query)!.push(metric);
    });

    return Array.from(queryMap.values())
      .filter(group => group.length > 1)
      .flat();
  }

  private createPerformanceMetric(analysis: any): any {
    return {
      timestamp: Date.now(),
      category: 'search',
      metric: 'algorithm_performance',
      value: analysis.averageResponseTime,
      unit: 'ms',
      trend: this.determineTrend(analysis.performanceTrends),
      severity: this.determineSeverity(analysis.averageResponseTime)
    };
  }

  private determineTrend(trends: any): 'improving' | 'degrading' | 'stable' {
    switch (trends.trendDirection) {
      case 'decreasing': return 'improving'; // Lower response time is better
      case 'increasing': return 'degrading';
      default: return 'stable';
    }
  }

  private determineSeverity(responseTime: number): 'low' | 'medium' | 'high' | 'critical' {
    if (responseTime < 500) return 'low';
    if (responseTime < 1000) return 'medium';
    if (responseTime < 2000) return 'high';
    return 'critical';
  }

  private async establishBaselines(): Promise<void> {
    // Set initial performance baselines
    this.performanceBaselines.set('responseTime', 1000);
    this.performanceBaselines.set('relevance', 0.7);
    this.performanceBaselines.set('throughput', 100);
  }

  private startPerformanceMonitoring(): void {
    // Monitor performance continuously
    setInterval(() => {
      this.emit('tuning-recommendation', {
        type: 'monitoring',
        timestamp: Date.now(),
        metrics: this.getRecentMetrics(60000) // Last minute
      });
    }, 60000); // Every minute
  }

  private checkForImmediateOptimizations(metrics: SearchMetrics): void {
    // Check for immediate optimization opportunities
    if (metrics.responseTime > 3000) {
      this.emit('critical-performance-issue', {
        type: 'slow_query',
        query: metrics.query,
        responseTime: metrics.responseTime,
        recommendation: 'Consider query optimization or caching'
      });
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.metrics.length = 0;
    this.performanceBaselines.clear();
    this.tuningHistory.clear();
    this.activeTuning.clear();
    console.log('AlgorithmTuner destroyed');
  }
}

export default AlgorithmTuner;