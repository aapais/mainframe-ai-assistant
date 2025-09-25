import { ParsedQuery } from '../search/QueryParser';
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
export declare class QueryAnalyzer {
  private patterns;
  private clusters;
  private queryHistory;
  private textProcessor;
  private readonly config;
  constructor(config?: Partial<typeof QueryAnalyzer.prototype.config>);
  analyzeQuery(
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
  };
  generateAnalysisReport(timeRange?: { from: number; to: number }): QueryAnalysisReport;
  getPatternsByType(type: QueryPatternType): QueryPattern[];
  getClusters(): QueryCluster[];
  findSimilarQueries(
    query: string,
    limit?: number
  ): Array<{
    query: string;
    similarity: number;
    pattern: QueryPattern;
  }>;
  optimizeQuery(query: string): {
    optimizedQuery: string;
    suggestions: string[];
    confidence: number;
    reasoning: string;
  };
  exportAnalysisData(format?: 'json' | 'csv'): string;
  private initializeTextProcessor;
  private recordQuery;
  private identifyPattern;
  private generatePatternKey;
  private createNewPattern;
  private updatePattern;
  private determinePatternType;
  private calculateQueryComplexity;
  private classifyQueryIntent;
  private extractPattern;
  private findOrCreateCluster;
  private updateCluster;
  private recalculateClusterMetrics;
  private calculateQuerySimilarity;
  private detectAnomalies;
  private generateQueryInsights;
  private calculateAverageExecutionTime;
  private getQueryFrequency;
  private calculateAverageQueryFrequency;
  private filterHistoryByTimeRange;
  private calculatePatternDistribution;
  private calculateComplexityDistribution;
  private calculateIntentDistribution;
  private getTopPatterns;
  private detectAnomaliesInRange;
  private calculateTrends;
  private generateInsights;
  private findPatternForQuery;
  private parseQuery;
  private convertToCSV;
  private generatePatternId;
  private generateClusterId;
}
export default QueryAnalyzer;
//# sourceMappingURL=QueryAnalyzer.d.ts.map
