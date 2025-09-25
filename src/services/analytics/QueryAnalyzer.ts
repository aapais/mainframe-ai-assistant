/**
 * Advanced Query Analyzer for Pattern Detection and Clustering
 *
 * Provides sophisticated analysis of search queries including:
 * - Query pattern recognition and clustering
 * - Semantic similarity analysis
 * - Query complexity scoring
 * - Intent classification
 * - Behavioral pattern identification
 * - Anomaly detection
 *
 * @version 1.0.0
 */

import { ParsedQuery, QueryTerm, QueryType } from '../search/QueryParser';
import { SearchOptions, SearchResult } from '../../types/services';

export interface QueryPattern {
  id: string;
  type: QueryPatternType;
  pattern: string;
  examples: string[];
  frequency: number;
  successRate: number;
  averageResults: number;
  complexity: QueryComplexity;
  intent: QueryIntent;
  metadata: {
    firstSeen: number;
    lastSeen: number;
    userCount: number;
    avgExecutionTime: number;
    failureRate: number;
  };
}

export type QueryPatternType =
  | 'keyword_search'
  | 'phrase_search'
  | 'boolean_complex'
  | 'field_specific'
  | 'fuzzy_search'
  | 'wildcard_search'
  | 'range_search'
  | 'nested_search'
  | 'technical_lookup'
  | 'troubleshooting'
  | 'procedural_search';

export type QueryComplexity = 'simple' | 'moderate' | 'complex' | 'advanced';
export type QueryIntent = 'informational' | 'navigational' | 'transactional' | 'investigational';

export interface QueryCluster {
  id: string;
  centroid: string;
  queries: string[];
  pattern: QueryPattern;
  cohesion: number;
  size: number;
  avgSimilarity: number;
  representativeQueries: string[];
  metadata: {
    createdAt: number;
    lastUpdated: number;
    stability: number;
    growth: number;
  };
}

export interface QueryAnalysisReport {
  totalQueries: number;
  uniqueQueries: number;
  patternDistribution: Record<QueryPatternType, number>;
  complexityDistribution: Record<QueryComplexity, number>;
  intentDistribution: Record<QueryIntent, number>;
  topPatterns: QueryPattern[];
  clusters: QueryCluster[];
  anomalies: QueryAnomaly[];
  trends: QueryTrend[];
  insights: QueryInsight[];
}

export interface QueryAnomaly {
  type: 'frequency' | 'complexity' | 'performance' | 'pattern';
  query: string;
  score: number;
  description: string;
  detectedAt: number;
  severity: 'low' | 'medium' | 'high';
}

export interface QueryTrend {
  pattern: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  strength: number;
  timeframe: string;
  significance: number;
}

export interface QueryInsight {
  type: 'optimization' | 'user_behavior' | 'content_gap' | 'performance';
  description: string;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  recommendation?: string;
  confidence: number;
}

/**
 * Advanced Query Analyzer for pattern detection and clustering
 */
export class QueryAnalyzer {
  private patterns: Map<string, QueryPattern> = new Map();
  private clusters: Map<string, QueryCluster> = new Map();
  private queryHistory: Array<{
    query: string;
    timestamp: number;
    userId?: string;
    results: number;
    executionTime: number;
    success: boolean;
  }> = [];
  private textProcessor: any;
  private readonly config: {
    maxHistorySize: number;
    clusteringThreshold: number;
    patternMinFrequency: number;
    anomalyThreshold: number;
    trendWindowDays: number;
  };

  constructor(config: Partial<typeof QueryAnalyzer.prototype.config> = {}) {
    this.config = {
      maxHistorySize: 10000,
      clusteringThreshold: 0.7,
      patternMinFrequency: 5,
      anomalyThreshold: 2.0,
      trendWindowDays: 30,
      ...config,
    };

    // Initialize text processor for similarity calculations
    this.initializeTextProcessor();
  }

  /**
   * Analyze a query and update patterns
   */
  public analyzeQuery(
    query: string,
    parsedQuery: ParsedQuery,
    executionTime: number,
    resultCount: number,
    userId?: string
  ): {
    pattern: QueryPattern;
    cluster?: QueryCluster;
    anomalies: QueryAnomaly[];
    insights: QueryInsight[];
  } {
    // Record query in history
    this.recordQuery(query, executionTime, resultCount, userId);

    // Identify or create pattern
    const pattern = this.identifyPattern(query, parsedQuery);

    // Find or create cluster
    const cluster = this.findOrCreateCluster(query, pattern);

    // Detect anomalies
    const anomalies = this.detectAnomalies(query, executionTime, resultCount);

    // Generate insights
    const insights = this.generateQueryInsights(query, pattern, cluster);

    return {
      pattern,
      cluster,
      anomalies,
      insights,
    };
  }

  /**
   * Get comprehensive analysis report
   */
  public generateAnalysisReport(timeRange?: { from: number; to: number }): QueryAnalysisReport {
    const filteredHistory = this.filterHistoryByTimeRange(timeRange);

    const totalQueries = filteredHistory.length;
    const uniqueQueries = new Set(filteredHistory.map(h => h.query)).size;

    // Calculate distributions
    const patternDistribution = this.calculatePatternDistribution(filteredHistory);
    const complexityDistribution = this.calculateComplexityDistribution(filteredHistory);
    const intentDistribution = this.calculateIntentDistribution(filteredHistory);

    // Get top patterns
    const topPatterns = this.getTopPatterns(10);

    // Get current clusters
    const clusters = Array.from(this.clusters.values());

    // Detect anomalies in time range
    const anomalies = this.detectAnomaliesInRange(filteredHistory);

    // Calculate trends
    const trends = this.calculateTrends(filteredHistory);

    // Generate insights
    const insights = this.generateInsights(filteredHistory, patterns, clusters);

    return {
      totalQueries,
      uniqueQueries,
      patternDistribution,
      complexityDistribution,
      intentDistribution,
      topPatterns,
      clusters,
      anomalies,
      trends,
      insights,
    };
  }

  /**
   * Get query patterns by type
   */
  public getPatternsByType(type: QueryPatternType): QueryPattern[] {
    return Array.from(this.patterns.values())
      .filter(pattern => pattern.type === type)
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Get query clusters by similarity
   */
  public getClusters(): QueryCluster[] {
    return Array.from(this.clusters.values()).sort((a, b) => b.size - a.size);
  }

  /**
   * Find similar queries
   */
  public findSimilarQueries(
    query: string,
    limit: number = 10
  ): Array<{
    query: string;
    similarity: number;
    pattern: QueryPattern;
  }> {
    const similarities: Array<{
      query: string;
      similarity: number;
      pattern: QueryPattern;
    }> = [];

    for (const historyItem of this.queryHistory) {
      if (historyItem.query === query) continue;

      const similarity = this.calculateQuerySimilarity(query, historyItem.query);
      if (similarity > 0.3) {
        const pattern = this.findPatternForQuery(historyItem.query);
        if (pattern) {
          similarities.push({
            query: historyItem.query,
            similarity,
            pattern,
          });
        }
      }
    }

    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  /**
   * Optimize query based on patterns
   */
  public optimizeQuery(query: string): {
    optimizedQuery: string;
    suggestions: string[];
    confidence: number;
    reasoning: string;
  } {
    const similarQueries = this.findSimilarQueries(query, 5);
    const pattern = this.identifyPattern(query, this.parseQuery(query));

    let optimizedQuery = query;
    const suggestions: string[] = [];
    let confidence = 0.5;
    let reasoning = 'No optimization patterns found';

    // Find successful similar queries
    const successfulSimilar = similarQueries.filter(sq => sq.pattern.successRate > 0.8);

    if (successfulSimilar.length > 0) {
      const bestPattern = successfulSimilar[0].pattern;

      // Extract optimization suggestions from successful patterns
      if (bestPattern.type === 'boolean_complex' && !query.includes('AND')) {
        suggestions.push('Consider using AND/OR operators for more precise results');
      }

      if (bestPattern.type === 'phrase_search' && !query.includes('"')) {
        suggestions.push('Try using quotes for exact phrase matching');
      }

      if (bestPattern.type === 'field_specific' && !query.includes(':')) {
        suggestions.push('Consider field-specific searches (e.g., title:keyword)');
      }

      confidence = Math.min(0.9, successfulSimilar[0].similarity + 0.1);
      reasoning = `Based on ${successfulSimilar.length} similar successful queries`;
    }

    return {
      optimizedQuery,
      suggestions,
      confidence,
      reasoning,
    };
  }

  /**
   * Export analysis data
   */
  public exportAnalysisData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      patterns: Array.from(this.patterns.values()),
      clusters: Array.from(this.clusters.values()),
      history: this.queryHistory,
      report: this.generateAnalysisReport(),
    };

    if (format === 'csv') {
      return this.convertToCSV(data);
    }

    return JSON.stringify(data, null, 2);
  }

  // Private Methods

  private initializeTextProcessor(): void {
    // Initialize text processing utilities
    this.textProcessor = {
      tokenize: (text: string) => text.toLowerCase().split(/\s+/),
      stemWords: (words: string[]) => words, // Simplified
      calculateJaccardSimilarity: (set1: Set<string>, set2: Set<string>) => {
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return intersection.size / union.size;
      },
    };
  }

  private recordQuery(
    query: string,
    executionTime: number,
    resultCount: number,
    userId?: string
  ): void {
    this.queryHistory.push({
      query,
      timestamp: Date.now(),
      userId,
      results: resultCount,
      executionTime,
      success: resultCount > 0,
    });

    // Maintain history size limit
    if (this.queryHistory.length > this.config.maxHistorySize) {
      this.queryHistory.shift();
    }
  }

  private identifyPattern(query: string, parsedQuery: ParsedQuery): QueryPattern {
    const patternKey = this.generatePatternKey(parsedQuery);

    let pattern = this.patterns.get(patternKey);
    if (!pattern) {
      pattern = this.createNewPattern(query, parsedQuery);
      this.patterns.set(patternKey, pattern);
    } else {
      this.updatePattern(pattern, query);
    }

    return pattern;
  }

  private generatePatternKey(parsedQuery: ParsedQuery): string {
    const components = [
      parsedQuery.type,
      parsedQuery.terms.length.toString(),
      parsedQuery.terms.map(t => t.operator).join('-'),
      parsedQuery.filters.length.toString(),
    ];

    return components.join('|');
  }

  private createNewPattern(query: string, parsedQuery: ParsedQuery): QueryPattern {
    const type = this.determinePatternType(parsedQuery);
    const complexity = this.calculateQueryComplexity(parsedQuery);
    const intent = this.classifyQueryIntent(query, parsedQuery);

    return {
      id: this.generatePatternId(),
      type,
      pattern: this.extractPattern(parsedQuery),
      examples: [query],
      frequency: 1,
      successRate: 1,
      averageResults: 0,
      complexity,
      intent,
      metadata: {
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        userCount: 1,
        avgExecutionTime: 0,
        failureRate: 0,
      },
    };
  }

  private updatePattern(pattern: QueryPattern, query: string): void {
    pattern.frequency++;
    pattern.metadata.lastSeen = Date.now();

    if (!pattern.examples.includes(query)) {
      pattern.examples.push(query);
      if (pattern.examples.length > 10) {
        pattern.examples.shift();
      }
    }
  }

  private determinePatternType(parsedQuery: ParsedQuery): QueryPatternType {
    if (parsedQuery.type === 'phrase') return 'phrase_search';
    if (parsedQuery.type === 'boolean') return 'boolean_complex';
    if (parsedQuery.type === 'field') return 'field_specific';

    if (parsedQuery.terms.some(t => t.fuzzy)) return 'fuzzy_search';
    if (parsedQuery.original.includes('*') || parsedQuery.original.includes('?')) {
      return 'wildcard_search';
    }

    // Technical keyword detection
    const technicalPatterns = /\b(error|exception|debug|troubleshoot|fix|resolve)\b/i;
    if (technicalPatterns.test(parsedQuery.original)) {
      return 'troubleshooting';
    }

    const proceduralPatterns = /\b(how to|step|procedure|process|guide)\b/i;
    if (proceduralPatterns.test(parsedQuery.original)) {
      return 'procedural_search';
    }

    return 'keyword_search';
  }

  private calculateQueryComplexity(parsedQuery: ParsedQuery): QueryComplexity {
    let score = 0;

    // Base complexity from term count
    score += parsedQuery.terms.length;

    // Boolean operators add complexity
    score += parsedQuery.terms.filter(t => t.operator === 'AND' || t.operator === 'OR').length * 2;

    // Field searches add complexity
    score += parsedQuery.terms.filter(t => t.field).length;

    // Filters add complexity
    score += parsedQuery.filters.length * 1.5;

    // Fuzzy searches add complexity
    score += parsedQuery.terms.filter(t => t.fuzzy).length * 1.5;

    if (score <= 3) return 'simple';
    if (score <= 7) return 'moderate';
    if (score <= 12) return 'complex';
    return 'advanced';
  }

  private classifyQueryIntent(query: string, parsedQuery: ParsedQuery): QueryIntent {
    const informationalPatterns = /\b(what|how|why|when|where|define|explain)\b/i;
    const navigationalPatterns = /\b(find|locate|search|show me)\b/i;
    const transactionalPatterns = /\b(download|export|save|generate|create)\b/i;
    const investigationalPatterns = /\b(analyze|compare|investigate|research)\b/i;

    if (investigationalPatterns.test(query)) return 'investigational';
    if (transactionalPatterns.test(query)) return 'transactional';
    if (navigationalPatterns.test(query)) return 'navigational';
    if (informationalPatterns.test(query)) return 'informational';

    // Default based on complexity
    return parsedQuery.terms.length > 3 ? 'investigational' : 'informational';
  }

  private extractPattern(parsedQuery: ParsedQuery): string {
    return parsedQuery.terms.map(t => `${t.field ? t.field + ':' : ''}[${t.operator}]`).join(' ');
  }

  private findOrCreateCluster(query: string, pattern: QueryPattern): QueryCluster {
    // Find existing cluster with high similarity
    for (const cluster of this.clusters.values()) {
      const similarity = this.calculateQuerySimilarity(query, cluster.centroid);
      if (similarity >= this.config.clusteringThreshold) {
        this.updateCluster(cluster, query);
        return cluster;
      }
    }

    // Create new cluster
    const cluster: QueryCluster = {
      id: this.generateClusterId(),
      centroid: query,
      queries: [query],
      pattern,
      cohesion: 1.0,
      size: 1,
      avgSimilarity: 1.0,
      representativeQueries: [query],
      metadata: {
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        stability: 1.0,
        growth: 0,
      },
    };

    this.clusters.set(cluster.id, cluster);
    return cluster;
  }

  private updateCluster(cluster: QueryCluster, query: string): void {
    cluster.queries.push(query);
    cluster.size++;
    cluster.metadata.lastUpdated = Date.now();

    // Update representative queries
    if (cluster.representativeQueries.length < 5) {
      cluster.representativeQueries.push(query);
    }

    // Recalculate centroid and similarities
    this.recalculateClusterMetrics(cluster);
  }

  private recalculateClusterMetrics(cluster: QueryCluster): void {
    // Simple centroid calculation (first query for now)
    // In a more sophisticated implementation, this would use vector averaging

    // Calculate average similarity within cluster
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < cluster.queries.length; i++) {
      for (let j = i + 1; j < cluster.queries.length; j++) {
        totalSimilarity += this.calculateQuerySimilarity(cluster.queries[i], cluster.queries[j]);
        comparisons++;
      }
    }

    cluster.avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 1.0;
    cluster.cohesion = cluster.avgSimilarity;
  }

  private calculateQuerySimilarity(query1: string, query2: string): number {
    const tokens1 = new Set(this.textProcessor.tokenize(query1));
    const tokens2 = new Set(this.textProcessor.tokenize(query2));

    return this.textProcessor.calculateJaccardSimilarity(tokens1, tokens2);
  }

  private detectAnomalies(
    query: string,
    executionTime: number,
    resultCount: number
  ): QueryAnomaly[] {
    const anomalies: QueryAnomaly[] = [];

    // Performance anomaly detection
    const avgExecutionTime = this.calculateAverageExecutionTime();
    if (executionTime > avgExecutionTime * this.config.anomalyThreshold) {
      anomalies.push({
        type: 'performance',
        query,
        score: executionTime / avgExecutionTime,
        description: `Query execution time (${executionTime}ms) is ${Math.round(executionTime / avgExecutionTime)}x above average`,
        detectedAt: Date.now(),
        severity: executionTime > avgExecutionTime * 3 ? 'high' : 'medium',
      });
    }

    // Zero results anomaly
    if (resultCount === 0 && query.length > 3) {
      anomalies.push({
        type: 'pattern',
        query,
        score: 1.0,
        description: 'Query returned no results despite being well-formed',
        detectedAt: Date.now(),
        severity: 'medium',
      });
    }

    // Frequency anomaly (very rare or very common)
    const queryFrequency = this.getQueryFrequency(query);
    const avgFrequency = this.calculateAverageQueryFrequency();

    if (queryFrequency > avgFrequency * 5) {
      anomalies.push({
        type: 'frequency',
        query,
        score: queryFrequency / avgFrequency,
        description: `Query appears much more frequently than average`,
        detectedAt: Date.now(),
        severity: 'low',
      });
    }

    return anomalies;
  }

  private generateQueryInsights(
    query: string,
    pattern: QueryPattern,
    cluster?: QueryCluster
  ): QueryInsight[] {
    const insights: QueryInsight[] = [];

    // Pattern-based insights
    if (pattern.successRate < 0.5) {
      insights.push({
        type: 'optimization',
        description: `Queries with this pattern have low success rate (${Math.round(pattern.successRate * 100)}%)`,
        impact: 'high',
        actionable: true,
        recommendation: 'Consider refining query structure or expanding content coverage',
        confidence: 0.8,
      });
    }

    // Cluster-based insights
    if (cluster && cluster.size > 10) {
      insights.push({
        type: 'user_behavior',
        description: `Query belongs to a popular cluster with ${cluster.size} similar queries`,
        impact: 'medium',
        actionable: true,
        recommendation: 'Consider creating dedicated content or shortcuts for this topic',
        confidence: 0.7,
      });
    }

    // Performance insights
    if (pattern.metadata.avgExecutionTime > 1000) {
      insights.push({
        type: 'performance',
        description: `Queries with this pattern are slow (${pattern.metadata.avgExecutionTime}ms avg)`,
        impact: 'medium',
        actionable: true,
        recommendation: 'Consider optimizing indexes or query structure',
        confidence: 0.9,
      });
    }

    return insights;
  }

  // Utility methods

  private calculateAverageExecutionTime(): number {
    if (this.queryHistory.length === 0) return 100;

    const total = this.queryHistory.reduce((sum, h) => sum + h.executionTime, 0);
    return total / this.queryHistory.length;
  }

  private getQueryFrequency(query: string): number {
    return this.queryHistory.filter(h => h.query === query).length;
  }

  private calculateAverageQueryFrequency(): number {
    const queryFreqs = new Map<string, number>();

    for (const history of this.queryHistory) {
      queryFreqs.set(history.query, (queryFreqs.get(history.query) || 0) + 1);
    }

    const frequencies = Array.from(queryFreqs.values());
    return frequencies.reduce((sum, freq) => sum + freq, 0) / frequencies.length || 1;
  }

  private filterHistoryByTimeRange(timeRange?: { from: number; to: number }) {
    if (!timeRange) return this.queryHistory;

    return this.queryHistory.filter(
      h => h.timestamp >= timeRange.from && h.timestamp <= timeRange.to
    );
  }

  private calculatePatternDistribution(
    history: typeof this.queryHistory
  ): Record<QueryPatternType, number> {
    const distribution: Record<QueryPatternType, number> = {
      keyword_search: 0,
      phrase_search: 0,
      boolean_complex: 0,
      field_specific: 0,
      fuzzy_search: 0,
      wildcard_search: 0,
      range_search: 0,
      nested_search: 0,
      technical_lookup: 0,
      troubleshooting: 0,
      procedural_search: 0,
    };

    for (const item of history) {
      const pattern = this.findPatternForQuery(item.query);
      if (pattern) {
        distribution[pattern.type]++;
      }
    }

    return distribution;
  }

  private calculateComplexityDistribution(
    history: typeof this.queryHistory
  ): Record<QueryComplexity, number> {
    const distribution: Record<QueryComplexity, number> = {
      simple: 0,
      moderate: 0,
      complex: 0,
      advanced: 0,
    };

    for (const item of history) {
      const pattern = this.findPatternForQuery(item.query);
      if (pattern) {
        distribution[pattern.complexity]++;
      }
    }

    return distribution;
  }

  private calculateIntentDistribution(
    history: typeof this.queryHistory
  ): Record<QueryIntent, number> {
    const distribution: Record<QueryIntent, number> = {
      informational: 0,
      navigational: 0,
      transactional: 0,
      investigational: 0,
    };

    for (const item of history) {
      const pattern = this.findPatternForQuery(item.query);
      if (pattern) {
        distribution[pattern.intent]++;
      }
    }

    return distribution;
  }

  private getTopPatterns(limit: number): QueryPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  private detectAnomaliesInRange(history: typeof this.queryHistory): QueryAnomaly[] {
    // Simplified anomaly detection for report
    return [];
  }

  private calculateTrends(history: typeof this.queryHistory): QueryTrend[] {
    // Simplified trend calculation
    return [];
  }

  private generateInsights(
    history: typeof this.queryHistory,
    patterns: any,
    clusters: QueryCluster[]
  ): QueryInsight[] {
    const insights: QueryInsight[] = [];

    // High-level insights based on overall patterns
    const totalQueries = history.length;
    const successfulQueries = history.filter(h => h.success).length;
    const successRate = totalQueries > 0 ? successfulQueries / totalQueries : 0;

    if (successRate < 0.7) {
      insights.push({
        type: 'content_gap',
        description: `Overall search success rate is low (${Math.round(successRate * 100)}%)`,
        impact: 'high',
        actionable: true,
        recommendation: 'Review content coverage and search algorithms',
        confidence: 0.9,
      });
    }

    return insights;
  }

  private findPatternForQuery(query: string): QueryPattern | undefined {
    // Simplified pattern lookup
    const parsedQuery = this.parseQuery(query);
    const patternKey = this.generatePatternKey(parsedQuery);
    return this.patterns.get(patternKey);
  }

  private parseQuery(query: string): ParsedQuery {
    // Simplified query parsing
    return {
      type: 'simple',
      terms: [
        {
          text: query,
          operator: 'AND' as const,
          boost: 1,
          fuzzy: false,
          required: false,
          prohibited: false,
        },
      ],
      filters: [],
      options: {},
      original: query,
      normalized: query.toLowerCase(),
    };
  }

  private convertToCSV(data: any): string {
    // Simplified CSV conversion
    return JSON.stringify(data);
  }

  private generatePatternId(): string {
    return `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateClusterId(): string {
    return `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default QueryAnalyzer;
