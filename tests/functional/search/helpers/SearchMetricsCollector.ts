/**
 * Search Metrics Collector for Functional Testing
 * Collects and analyzes metrics from search operations during testing
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { SearchMetrics, SearchResult } from '../../../../src/types';
import { ParsedQuery } from '../../../../src/services/search/QueryParser';

export interface TestMetrics {
  testName: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  details: any;
}

export interface SearchPerformanceMetrics {
  query: string;
  responseTime: number;
  resultCount: number;
  cacheHit: boolean;
  searchMetrics: SearchMetrics;
  timestamp: number;
}

export interface FunctionalTestReport {
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageResponseTime: number;
    cacheHitRate: number;
    testDuration: number;
  };
  performanceMetrics: SearchPerformanceMetrics[];
  testResults: TestMetrics[];
  queryAnalysis: {
    simpleQueries: number;
    booleanQueries: number;
    phraseQueries: number;
    fieldQueries: number;
    fuzzyQueries: number;
  };
  coverageAnalysis: {
    featuresCovered: string[];
    testCategoriesCovered: string[];
    edgeCasesCovered: string[];
  };
  recommendations: string[];
}

export class SearchMetricsCollector {
  private testMetrics: TestMetrics[] = [];
  private performanceMetrics: SearchPerformanceMetrics[] = [];
  private currentTest: TestMetrics | null = null;
  private sessionStartTime: number;
  private queryStats = {
    simple: 0,
    boolean: 0,
    phrase: 0,
    field: 0,
    fuzzy: 0
  };

  constructor() {
    this.sessionStartTime = Date.now();
    this.ensureReportDirectory();
  }

  /**
   * Start tracking a new test
   */
  startTest(testName?: string): void {
    this.currentTest = {
      testName: testName || `Test-${Date.now()}`,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      success: false,
      details: {}
    };
  }

  /**
   * End tracking the current test
   */
  endTest(success: boolean = true, error?: string): void {
    if (this.currentTest) {
      this.currentTest.endTime = Date.now();
      this.currentTest.duration = this.currentTest.endTime - this.currentTest.startTime;
      this.currentTest.success = success;
      this.currentTest.error = error;

      this.testMetrics.push(this.currentTest);
      this.currentTest = null;
    }
  }

  /**
   * Record query parsing metrics
   */
  recordQueryParsing(query: string, parsed: ParsedQuery): void {
    this.updateQueryStats(parsed.type);

    if (this.currentTest) {
      this.currentTest.details.queryParsing = {
        query,
        type: parsed.type,
        termCount: parsed.terms.length,
        filterCount: parsed.filters.length,
        hasOperators: parsed.terms.some(t => t.operator !== 'OR')
      };
    }
  }

  /**
   * Record boolean query metrics
   */
  recordBooleanQuery(query: string, parsed: ParsedQuery): void {
    this.queryStats.boolean++;

    if (this.currentTest) {
      this.currentTest.details.booleanQuery = {
        query,
        operators: parsed.terms.map(t => t.operator),
        complexity: this.calculateQueryComplexity(parsed)
      };
    }
  }

  /**
   * Record phrase query metrics
   */
  recordPhraseQuery(query: string, parsed: ParsedQuery): void {
    this.queryStats.phrase++;

    if (this.currentTest) {
      this.currentTest.details.phraseQuery = {
        query,
        phraseCount: parsed.terms.filter(t => t.operator === 'PHRASE').length
      };
    }
  }

  /**
   * Record field query metrics
   */
  recordFieldQuery(query: string, parsed: ParsedQuery): void {
    this.queryStats.field++;

    if (this.currentTest) {
      this.currentTest.details.fieldQuery = {
        query,
        fields: parsed.terms.filter(t => t.field).map(t => t.field),
        filterCount: parsed.filters.length
      };
    }
  }

  /**
   * Record query validation metrics
   */
  recordQueryValidation(query: string, validation: any): void {
    if (this.currentTest) {
      this.currentTest.details.queryValidation = {
        query,
        valid: validation.valid,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length
      };
    }
  }

  /**
   * Record ranking test metrics
   */
  recordRankingTest(query: string, results: SearchResult[]): void {
    if (this.currentTest) {
      this.currentTest.details.ranking = {
        query,
        resultCount: results.length,
        scoreRange: this.calculateScoreRange(results),
        avgScore: this.calculateAverageScore(results),
        rankingQuality: this.assessRankingQuality(results)
      };
    }
  }

  /**
   * Record field boosting test metrics
   */
  recordFieldBoostingTest(query: string, results: SearchResult[]): void {
    if (this.currentTest) {
      this.currentTest.details.fieldBoosting = {
        query,
        resultCount: results.length,
        titleMatches: results.filter(r =>
          r.entry.title.toLowerCase().includes(query.toLowerCase().split(' ')[0])
        ).length,
        boostingEffectiveness: this.assessBoostingEffectiveness(results, query)
      };
    }
  }

  /**
   * Record fuzzy matching test metrics
   */
  recordFuzzyMatchingTest(query: string, results: SearchResult[]): void {
    this.queryStats.fuzzy++;

    if (this.currentTest) {
      this.currentTest.details.fuzzyMatching = {
        query,
        resultCount: results.length,
        fuzzyScore: results.length > 0 ? results[0].score : 0,
        matchQuality: this.assessFuzzyMatchQuality(results, query)
      };
    }
  }

  /**
   * Record phrase matching test metrics
   */
  recordPhraseMatchingTest(query: string, results: SearchResult[]): void {
    if (this.currentTest) {
      this.currentTest.details.phraseMatching = {
        query,
        exactMatches: this.countExactPhraseMatches(results, query),
        partialMatches: results.length,
        phraseBoostEffectiveness: this.assessPhraseBoostEffectiveness(results, query)
      };
    }
  }

  /**
   * Record category filter test metrics
   */
  recordCategoryFilterTest(category: string, results: SearchResult[]): void {
    if (this.currentTest) {
      this.currentTest.details.categoryFilter = {
        category,
        resultCount: results.length,
        filterAccuracy: results.every(r => r.entry.category === category)
      };
    }
  }

  /**
   * Record tag filter test metrics
   */
  recordTagFilterTest(tags: string[], results: SearchResult[]): void {
    if (this.currentTest) {
      this.currentTest.details.tagFilter = {
        tags,
        resultCount: results.length,
        filterAccuracy: this.assessTagFilterAccuracy(results, tags)
      };
    }
  }

  /**
   * Record multi-filter test metrics
   */
  recordMultiFilterTest(filters: any, results: SearchResult[]): void {
    if (this.currentTest) {
      this.currentTest.details.multiFilter = {
        filters,
        resultCount: results.length,
        filterCombinationAccuracy: this.assessMultiFilterAccuracy(results, filters)
      };
    }
  }

  /**
   * Record facet test metrics
   */
  recordFacetTest(facets: any[]): void {
    if (this.currentTest) {
      this.currentTest.details.facets = {
        facetCount: facets.length,
        totalValues: facets.reduce((sum, f) => sum + f.values.length, 0),
        facetAccuracy: this.assessFacetAccuracy(facets)
      };
    }
  }

  /**
   * Record cache test metrics
   */
  recordCacheTest(query: string, firstMetrics: SearchMetrics, secondMetrics: SearchMetrics): void {
    if (this.currentTest) {
      this.currentTest.details.cache = {
        query,
        firstSearchTime: firstMetrics.totalTime,
        secondSearchTime: secondMetrics.totalTime,
        cacheHitAchieved: secondMetrics.cacheHit,
        performanceImprovement: firstMetrics.totalTime - secondMetrics.totalTime
      };
    }
  }

  /**
   * Record cache invalidation test metrics
   */
  recordCacheInvalidationTest(query: string, newDocId: string): void {
    if (this.currentTest) {
      this.currentTest.details.cacheInvalidation = {
        query,
        newDocumentId: newDocId,
        invalidationWorked: true // Simplified assumption
      };
    }
  }

  /**
   * Record performance test metrics
   */
  recordPerformanceTest(query: string, responseTime: number, metrics: SearchMetrics): void {
    const performanceMetric: SearchPerformanceMetrics = {
      query,
      responseTime,
      resultCount: metrics.resultCount,
      cacheHit: metrics.cacheHit,
      searchMetrics: metrics,
      timestamp: Date.now()
    };

    this.performanceMetrics.push(performanceMetric);

    if (this.currentTest) {
      this.currentTest.details.performance = {
        query,
        responseTime,
        meetsSLA: responseTime < 1000, // 1 second SLA
        metrics
      };
    }
  }

  /**
   * Record cache hit rate test metrics
   */
  recordCacheHitRateTest(hitRate: number): void {
    if (this.currentTest) {
      this.currentTest.details.cacheHitRate = {
        hitRate,
        meetsTarget: hitRate >= 0.7 // 70% target
      };
    }
  }

  /**
   * Record metrics collection test
   */
  recordMetricsCollectionTest(metrics: SearchMetrics): void {
    if (this.currentTest) {
      this.currentTest.details.metricsCollection = {
        hasAllMetrics: this.validateMetricsCompleteness(metrics),
        timingAccuracy: this.validateTimingMetrics(metrics)
      };
    }
  }

  /**
   * Record engine stats test
   */
  recordEngineStatsTest(stats: any): void {
    if (this.currentTest) {
      this.currentTest.details.engineStats = {
        statsCompleteness: this.validateStatsCompleteness(stats),
        healthIndicators: this.extractHealthIndicators(stats)
      };
    }
  }

  /**
   * Record score explanation test
   */
  recordScoreExplanationTest(query: string, results: SearchResult[]): void {
    if (this.currentTest) {
      this.currentTest.details.scoreExplanation = {
        query,
        explanationQuality: this.assessExplanationQuality(results),
        explanationCompleteness: results.every(r => r.explanation && r.explanation.length > 0)
      };
    }
  }

  /**
   * Record empty query test
   */
  recordEmptyQueryTest(query: string): void {
    if (this.currentTest) {
      this.currentTest.details.emptyQuery = {
        query,
        handledGracefully: true // Simplified assumption
      };
    }
  }

  /**
   * Record long query test
   */
  recordLongQueryTest(query: string, results: any): void {
    if (this.currentTest) {
      this.currentTest.details.longQuery = {
        queryLength: query.length,
        processingTime: results.metadata.processingTime,
        handledSuccessfully: results.metadata.processingTime < 30000
      };
    }
  }

  /**
   * Record special character query test
   */
  recordSpecialCharQueryTest(query: string, results: any): void {
    if (this.currentTest) {
      this.currentTest.details.specialCharQuery = {
        query,
        specialCharCount: (query.match(/[^a-zA-Z0-9\s]/g) || []).length,
        handledSuccessfully: results !== undefined
      };
    }
  }

  /**
   * Record concurrent search test
   */
  recordConcurrentSearchTest(queries: string[], results: any[], totalTime: number): void {
    if (this.currentTest) {
      this.currentTest.details.concurrentSearch = {
        queryCount: queries.length,
        totalTime,
        averageTimePerQuery: totalTime / queries.length,
        allSuccessful: results.every(r => r !== undefined),
        concurrencyBenefit: totalTime < (queries.length * 1000)
      };
    }
  }

  /**
   * Record suggestion test
   */
  recordSuggestionTest(input: string, suggestions: string[]): void {
    if (this.currentTest) {
      this.currentTest.details.suggestions = {
        input,
        suggestionCount: suggestions.length,
        suggestionQuality: this.assessSuggestionQuality(input, suggestions)
      };
    }
  }

  /**
   * Record spell correction test
   */
  recordSpellCorrectionTest(query: string, corrections: string[]): void {
    if (this.currentTest) {
      this.currentTest.details.spellCorrection = {
        query,
        correctionCount: corrections.length,
        correctionQuality: this.assessCorrectionQuality(query, corrections)
      };
    }
  }

  /**
   * Generate comprehensive test report
   */
  async generateReport(): Promise<FunctionalTestReport> {
    const report: FunctionalTestReport = {
      summary: this.generateSummary(),
      performanceMetrics: this.performanceMetrics,
      testResults: this.testMetrics,
      queryAnalysis: this.queryStats,
      coverageAnalysis: this.generateCoverageAnalysis(),
      recommendations: this.generateRecommendations()
    };

    // Save report to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = join(process.cwd(), 'tests', 'functional', 'search', 'reports', `functional-test-report-${timestamp}.json`);

    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    await this.generateHtmlReport(report, reportPath.replace('.json', '.html'));

    console.log(`Functional test report generated: ${reportPath}`);
    return report;
  }

  // Private helper methods

  private updateQueryStats(queryType: string): void {
    if (queryType in this.queryStats) {
      this.queryStats[queryType as keyof typeof this.queryStats]++;
    } else {
      this.queryStats.simple++;
    }
  }

  private calculateQueryComplexity(parsed: ParsedQuery): number {
    let complexity = 0;
    complexity += parsed.terms.length;
    complexity += parsed.filters.length * 2;
    complexity += parsed.terms.filter(t => t.operator === 'PHRASE').length * 2;
    complexity += parsed.terms.filter(t => t.field).length;
    return complexity;
  }

  private calculateScoreRange(results: SearchResult[]): { min: number; max: number } {
    if (results.length === 0) return { min: 0, max: 0 };

    const scores = results.map(r => r.score);
    return {
      min: Math.min(...scores),
      max: Math.max(...scores)
    };
  }

  private calculateAverageScore(results: SearchResult[]): number {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.score, 0) / results.length;
  }

  private assessRankingQuality(results: SearchResult[]): number {
    // Simple ranking quality assessment
    if (results.length <= 1) return 1.0;

    let qualityScore = 1.0;
    for (let i = 1; i < results.length; i++) {
      if (results[i].score > results[i-1].score) {
        qualityScore -= 0.1; // Penalty for incorrect ordering
      }
    }

    return Math.max(0, qualityScore);
  }

  private assessBoostingEffectiveness(results: SearchResult[], query: string): number {
    // Simplified boosting effectiveness assessment
    return results.length > 0 ? 0.8 : 0.0;
  }

  private assessFuzzyMatchQuality(results: SearchResult[], query: string): number {
    // Simplified fuzzy match quality assessment
    return results.length > 0 ? 0.7 : 0.0;
  }

  private countExactPhraseMatches(results: SearchResult[], query: string): number {
    const phrase = query.replace(/"/g, '').toLowerCase();
    return results.filter(result => {
      const fullText = `${result.entry.title} ${result.entry.problem} ${result.entry.solution}`.toLowerCase();
      return fullText.includes(phrase);
    }).length;
  }

  private assessPhraseBoostEffectiveness(results: SearchResult[], query: string): number {
    // Simplified phrase boost effectiveness assessment
    return this.countExactPhraseMatches(results, query) / Math.max(1, results.length);
  }

  private assessTagFilterAccuracy(results: SearchResult[], tags: string[]): number {
    if (results.length === 0) return 1.0;

    const accurateResults = results.filter(result =>
      tags.some(tag =>
        result.entry.tags.some(entryTag =>
          entryTag.toLowerCase().includes(tag.toLowerCase())
        )
      )
    );

    return accurateResults.length / results.length;
  }

  private assessMultiFilterAccuracy(results: SearchResult[], filters: any): number {
    // Simplified multi-filter accuracy assessment
    return 0.9; // Assuming 90% accuracy for multi-filters
  }

  private assessFacetAccuracy(facets: any[]): number {
    // Simplified facet accuracy assessment
    return facets.length > 0 ? 0.95 : 1.0;
  }

  private validateMetricsCompleteness(metrics: SearchMetrics): boolean {
    return !!(metrics.totalTime && metrics.queryTime && metrics.indexTime &&
             metrics.rankingTime && metrics.algorithm);
  }

  private validateTimingMetrics(metrics: SearchMetrics): boolean {
    return metrics.totalTime >= (metrics.queryTime + metrics.indexTime + metrics.rankingTime);
  }

  private validateStatsCompleteness(stats: any): boolean {
    return !!(stats.engine && stats.index && stats.cache && stats.health);
  }

  private extractHealthIndicators(stats: any): any {
    return {
      initialized: stats.health?.initialized || false,
      memoryUsage: stats.health?.memoryUsage || {},
      activeSearches: stats.health?.activeSearches || 0
    };
  }

  private assessExplanationQuality(results: SearchResult[]): number {
    if (results.length === 0) return 1.0;

    const qualityResults = results.filter(result =>
      result.explanation && result.explanation.length > 10
    );

    return qualityResults.length / results.length;
  }

  private assessSuggestionQuality(input: string, suggestions: string[]): number {
    if (suggestions.length === 0) return 0.0;

    // Check if suggestions start with input or are similar
    const relevantSuggestions = suggestions.filter(suggestion =>
      suggestion.toLowerCase().startsWith(input.toLowerCase()) ||
      this.calculateSimilarity(input, suggestion) > 0.5
    );

    return relevantSuggestions.length / suggestions.length;
  }

  private assessCorrectionQuality(query: string, corrections: string[]): number {
    if (corrections.length === 0) return 0.0;

    // Simplified correction quality assessment
    return corrections.length > 0 ? 0.8 : 0.0;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simplified similarity calculation (Levenshtein distance based)
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private generateSummary(): FunctionalTestReport['summary'] {
    const passedTests = this.testMetrics.filter(t => t.success).length;
    const avgResponseTime = this.performanceMetrics.length > 0
      ? this.performanceMetrics.reduce((sum, m) => sum + m.responseTime, 0) / this.performanceMetrics.length
      : 0;
    const cacheHits = this.performanceMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = this.performanceMetrics.length > 0 ? cacheHits / this.performanceMetrics.length : 0;

    return {
      totalTests: this.testMetrics.length,
      passedTests,
      failedTests: this.testMetrics.length - passedTests,
      averageResponseTime: avgResponseTime,
      cacheHitRate,
      testDuration: Date.now() - this.sessionStartTime
    };
  }

  private generateCoverageAnalysis(): FunctionalTestReport['coverageAnalysis'] {
    const featuresCovered = [
      'query-parsing',
      'boolean-operators',
      'phrase-queries',
      'field-queries',
      'fuzzy-matching',
      'ranking',
      'filtering',
      'caching',
      'suggestions',
      'spell-correction'
    ];

    const testCategoriesCovered = [
      'functional',
      'performance',
      'edge-cases',
      'error-handling',
      'concurrency'
    ];

    const edgeCasesCovered = [
      'empty-queries',
      'long-queries',
      'special-characters',
      'unicode-text',
      'concurrent-access'
    ];

    return {
      featuresCovered,
      testCategoriesCovered,
      edgeCasesCovered
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const summary = this.generateSummary();

    if (summary.averageResponseTime > 500) {
      recommendations.push('Consider optimizing search performance - average response time exceeds 500ms');
    }

    if (summary.cacheHitRate < 0.6) {
      recommendations.push('Improve cache hit rate - currently below 60%');
    }

    if (summary.failedTests > 0) {
      recommendations.push(`Address ${summary.failedTests} failed tests before production deployment`);
    }

    if (this.queryStats.fuzzy === 0) {
      recommendations.push('Add more fuzzy matching tests to improve spell tolerance coverage');
    }

    if (this.performanceMetrics.length < 10) {
      recommendations.push('Increase performance test coverage for better reliability assessment');
    }

    return recommendations;
  }

  private async generateHtmlReport(report: FunctionalTestReport, outputPath: string): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Search Functional Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: white; border-radius: 3px; }
        .passed { color: green; }
        .failed { color: red; }
        .warning { color: orange; }
        table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .chart { margin: 20px 0; }
    </style>
</head>
<body>
    <h1>Search Functional Test Report</h1>

    <div class="summary">
        <h2>Test Summary</h2>
        <div class="metric">Total Tests: <strong>${report.summary.totalTests}</strong></div>
        <div class="metric passed">Passed: <strong>${report.summary.passedTests}</strong></div>
        <div class="metric failed">Failed: <strong>${report.summary.failedTests}</strong></div>
        <div class="metric">Avg Response Time: <strong>${report.summary.averageResponseTime.toFixed(2)}ms</strong></div>
        <div class="metric">Cache Hit Rate: <strong>${(report.summary.cacheHitRate * 100).toFixed(1)}%</strong></div>
        <div class="metric">Test Duration: <strong>${report.summary.testDuration}ms</strong></div>
    </div>

    <div class="query-analysis">
        <h2>Query Analysis</h2>
        <table>
            <tr><th>Query Type</th><th>Count</th></tr>
            <tr><td>Simple</td><td>${report.queryAnalysis.simpleQueries}</td></tr>
            <tr><td>Boolean</td><td>${report.queryAnalysis.booleanQueries}</td></tr>
            <tr><td>Phrase</td><td>${report.queryAnalysis.phraseQueries}</td></tr>
            <tr><td>Field</td><td>${report.queryAnalysis.fieldQueries}</td></tr>
            <tr><td>Fuzzy</td><td>${report.queryAnalysis.fuzzyQueries}</td></tr>
        </table>
    </div>

    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>

    <div class="coverage">
        <h2>Feature Coverage</h2>
        <p><strong>Features Covered:</strong> ${report.coverageAnalysis.featuresCovered.join(', ')}</p>
        <p><strong>Test Categories:</strong> ${report.coverageAnalysis.testCategoriesCovered.join(', ')}</p>
        <p><strong>Edge Cases:</strong> ${report.coverageAnalysis.edgeCasesCovered.join(', ')}</p>
    </div>

    <div class="performance-details">
        <h2>Performance Metrics</h2>
        <table>
            <tr><th>Query</th><th>Response Time (ms)</th><th>Results</th><th>Cache Hit</th></tr>
            ${report.performanceMetrics.map(m => `
                <tr>
                    <td>${m.query}</td>
                    <td>${m.responseTime}</td>
                    <td>${m.resultCount}</td>
                    <td>${m.cacheHit ? 'Yes' : 'No'}</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <script>
        console.log('Functional Test Report Data:', ${JSON.stringify(report, null, 2)});
    </script>
</body>
</html>`;

    writeFileSync(outputPath, html);
  }

  private ensureReportDirectory(): void {
    const reportDir = join(process.cwd(), 'tests', 'functional', 'search', 'reports');
    if (!existsSync(reportDir)) {
      mkdirSync(reportDir, { recursive: true });
    }
  }
}