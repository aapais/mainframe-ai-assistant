import { MetricsCollector, QueryMetrics, SLAMetrics, PercentileMetrics } from './MetricsCollector';
export interface PerformanceReport {
  id: string;
  timestamp: number;
  period: {
    start: number;
    end: number;
    duration: number;
  };
  summary: {
    totalRequests: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
    slaCompliance: number;
    availability: number;
  };
  sections: {
    executive: ExecutiveSummary;
    performance: PerformanceAnalysis;
    availability: AvailabilityReport;
    cache: CacheReport;
    queries: QueryReport;
    sla: SLAReport;
    trends: TrendAnalysis;
    recommendations: Recommendation[];
  };
  metadata: {
    generatedBy: string;
    version: string;
    reportType: 'hourly' | 'daily' | 'weekly' | 'monthly';
    exportFormats: string[];
  };
}
export interface ExecutiveSummary {
  healthScore: number;
  keyMetrics: Array<{
    name: string;
    value: string;
    status: 'good' | 'warning' | 'critical';
    trend: 'up' | 'down' | 'stable';
  }>;
  criticalIssues: string[];
  achievements: string[];
}
export interface PerformanceAnalysis {
  responseTime: {
    percentiles: PercentileMetrics;
    distribution: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
    trends: Array<{
      timestamp: number;
      p50: number;
      p95: number;
      p99: number;
    }>;
  };
  throughput: {
    average: number;
    peak: number;
    trends: Array<{
      timestamp: number;
      value: number;
    }>;
  };
  errorAnalysis: {
    totalErrors: number;
    errorRate: number;
    errorTypes: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
    trends: Array<{
      timestamp: number;
      value: number;
    }>;
  };
}
export interface AvailabilityReport {
  uptime: number;
  downtime: number;
  incidents: Array<{
    start: number;
    end: number;
    duration: number;
    impact: 'low' | 'medium' | 'high';
    description: string;
  }>;
  mttr: number;
  mtbf: number;
}
export interface CacheReport {
  effectiveness: {
    hitRate: number;
    missRate: number;
    totalRequests: number;
  };
  performance: {
    avgHitTime: number;
    avgMissTime: number;
    sizeTrends: Array<{
      timestamp: number;
      size: number;
      utilization: number;
    }>;
  };
  optimization: {
    evictionRate: number;
    hotKeys: string[];
    recommendations: string[];
  };
}
export interface QueryReport {
  performance: QueryMetrics;
  analysis: {
    slowestQueries: Array<{
      query: string;
      avgDuration: number;
      count: number;
      impact: number;
    }>;
    queryPatterns: Array<{
      pattern: string;
      count: number;
      avgDuration: number;
    }>;
    optimizationOpportunities: string[];
  };
}
export interface SLAReport {
  compliance: SLAMetrics;
  violations: Array<{
    metric: string;
    count: number;
    totalDuration: number;
    impact: 'low' | 'medium' | 'high';
  }>;
  trends: {
    complianceHistory: Array<{
      timestamp: number;
      compliance: number;
    }>;
    violationTrends: Array<{
      timestamp: number;
      count: number;
    }>;
  };
}
export interface TrendAnalysis {
  performanceTrends: {
    responseTime: 'improving' | 'degrading' | 'stable';
    throughput: 'improving' | 'degrading' | 'stable';
    errorRate: 'improving' | 'degrading' | 'stable';
    cacheHitRate: 'improving' | 'degrading' | 'stable';
  };
  seasonality: {
    dailyPatterns: Array<{
      hour: number;
      avgResponseTime: number;
      requestCount: number;
    }>;
    weeklyPatterns: Array<{
      day: string;
      avgResponseTime: number;
      requestCount: number;
    }>;
  };
  forecasting: {
    expectedLoad: number;
    capacityRecommendations: string[];
    growthProjections: Array<{
      period: string;
      expectedIncrease: number;
    }>;
  };
}
export interface Recommendation {
  id: string;
  category: 'performance' | 'reliability' | 'cost' | 'security';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  implementationSteps: string[];
}
export declare class PerformanceReportGenerator {
  private metricsCollector;
  constructor(metricsCollector: MetricsCollector);
  generateReport(
    type?: 'hourly' | 'daily' | 'weekly' | 'monthly',
    customPeriod?: {
      start: number;
      end: number;
    }
  ): Promise<PerformanceReport>;
  private calculateReportPeriod;
  private generateSummary;
  private generateExecutiveSummary;
  private calculateHealthScore;
  private generatePerformanceAnalysis;
  private calculateResponseTimeDistribution;
  private generateAvailabilityReport;
  private generateCacheReport;
  private generateCacheRecommendations;
  private generateQueryReport;
  private generateQueryOptimizations;
  private generateSLAReport;
  private generateTrendAnalysis;
  private generateRecommendations;
  exportReport(report: PerformanceReport, format: 'json' | 'csv' | 'html' | 'pdf'): Promise<string>;
  private exportToCSV;
  private exportToHTML;
}
//# sourceMappingURL=PerformanceReportGenerator.d.ts.map
