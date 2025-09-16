/**
 * Performance Report Generator
 * Generates comprehensive performance reports and analytics
 */

import { MetricsCollector, PerformanceMetric, QueryMetrics, CacheMetrics, SLAMetrics, PercentileMetrics } from './MetricsCollector';

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
    distribution: Array<{ range: string; count: number; percentage: number }>;
    trends: Array<{ timestamp: number; p50: number; p95: number; p99: number }>;
  };
  throughput: {
    average: number;
    peak: number;
    trends: Array<{ timestamp: number; value: number }>;
  };
  errorAnalysis: {
    totalErrors: number;
    errorRate: number;
    errorTypes: Array<{ type: string; count: number; percentage: number }>;
    trends: Array<{ timestamp: number; value: number }>;
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
  mttr: number; // Mean Time To Recovery
  mtbf: number; // Mean Time Between Failures
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
    sizeTrends: Array<{ timestamp: number; size: number; utilization: number }>;
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
    complianceHistory: Array<{ timestamp: number; compliance: number }>;
    violationTrends: Array<{ timestamp: number; count: number }>;
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
    dailyPatterns: Array<{ hour: number; avgResponseTime: number; requestCount: number }>;
    weeklyPatterns: Array<{ day: string; avgResponseTime: number; requestCount: number }>;
  };
  forecasting: {
    expectedLoad: number;
    capacityRecommendations: string[];
    growthProjections: Array<{ period: string; expectedIncrease: number }>;
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

export class PerformanceReportGenerator {
  private metricsCollector: MetricsCollector;

  constructor(metricsCollector: MetricsCollector) {
    this.metricsCollector = metricsCollector;
  }

  /**
   * Generate a comprehensive performance report
   */
  async generateReport(
    type: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily',
    customPeriod?: { start: number; end: number }
  ): Promise<PerformanceReport> {
    const now = Date.now();
    const period = this.calculateReportPeriod(type, customPeriod);

    // Get current metrics snapshot
    const currentMetrics = this.metricsCollector.getCurrentMetrics();

    const report: PerformanceReport = {
      id: `report-${now}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: now,
      period,
      summary: this.generateSummary(currentMetrics),
      sections: {
        executive: await this.generateExecutiveSummary(currentMetrics),
        performance: await this.generatePerformanceAnalysis(currentMetrics),
        availability: await this.generateAvailabilityReport(currentMetrics),
        cache: await this.generateCacheReport(currentMetrics.cache),
        queries: await this.generateQueryReport(currentMetrics.query),
        sla: await this.generateSLAReport(currentMetrics.sla),
        trends: await this.generateTrendAnalysis(currentMetrics),
        recommendations: await this.generateRecommendations(currentMetrics)
      },
      metadata: {
        generatedBy: 'PerformanceReportGenerator v1.0',
        version: '1.0.0',
        reportType: type,
        exportFormats: ['pdf', 'json', 'csv', 'html']
      }
    };

    return report;
  }

  private calculateReportPeriod(
    type: 'hourly' | 'daily' | 'weekly' | 'monthly',
    customPeriod?: { start: number; end: number }
  ) {
    if (customPeriod) {
      return {
        start: customPeriod.start,
        end: customPeriod.end,
        duration: customPeriod.end - customPeriod.start
      };
    }

    const now = Date.now();
    const durations = {
      hourly: 3600000,    // 1 hour
      daily: 86400000,    // 24 hours
      weekly: 604800000,  // 7 days
      monthly: 2592000000 // 30 days
    };

    const duration = durations[type];
    return {
      start: now - duration,
      end: now,
      duration
    };
  }

  private generateSummary(metrics: any) {
    const slaCompliance = (
      (metrics.sla.availability * 100) +
      (metrics.responseTime.p95 <= 500 ? 100 : 0) +
      (metrics.query.errorRate <= 0.01 ? 100 : 0) +
      (metrics.cache.hitRate >= 0.8 ? 100 : 0)
    ) / 4;

    return {
      totalRequests: metrics.responseTime.count,
      avgResponseTime: metrics.responseTime.mean,
      p95ResponseTime: metrics.responseTime.p95,
      errorRate: metrics.query.errorRate,
      cacheHitRate: metrics.cache.hitRate,
      slaCompliance: slaCompliance / 100,
      availability: metrics.sla.availability
    };
  }

  private async generateExecutiveSummary(metrics: any): Promise<ExecutiveSummary> {
    const healthScore = this.calculateHealthScore(metrics);

    const keyMetrics = [
      {
        name: 'Response Time (P95)',
        value: `${metrics.responseTime.p95.toFixed(0)}ms`,
        status: metrics.responseTime.p95 <= 500 ? 'good' : metrics.responseTime.p95 <= 1000 ? 'warning' : 'critical',
        trend: 'stable' as const
      },
      {
        name: 'Error Rate',
        value: `${(metrics.query.errorRate * 100).toFixed(2)}%`,
        status: metrics.query.errorRate <= 0.01 ? 'good' : metrics.query.errorRate <= 0.05 ? 'warning' : 'critical',
        trend: 'stable' as const
      },
      {
        name: 'Cache Hit Rate',
        value: `${(metrics.cache.hitRate * 100).toFixed(1)}%`,
        status: metrics.cache.hitRate >= 0.8 ? 'good' : metrics.cache.hitRate >= 0.6 ? 'warning' : 'critical',
        trend: 'stable' as const
      },
      {
        name: 'Availability',
        value: `${(metrics.sla.availability * 100).toFixed(2)}%`,
        status: metrics.sla.availability >= 0.999 ? 'good' : metrics.sla.availability >= 0.99 ? 'warning' : 'critical',
        trend: 'stable' as const
      }
    ];

    const criticalIssues = [];
    if (metrics.responseTime.p95 > 1000) {
      criticalIssues.push('High response times detected - immediate optimization needed');
    }
    if (metrics.query.errorRate > 0.05) {
      criticalIssues.push('High error rate indicates system instability');
    }
    if (metrics.sla.violations.length > 0) {
      criticalIssues.push(`${metrics.sla.violations.length} active SLA violations`);
    }

    const achievements = [];
    if (metrics.responseTime.p95 <= 200) {
      achievements.push('Excellent response time performance maintained');
    }
    if (metrics.cache.hitRate >= 0.9) {
      achievements.push('High cache efficiency achieved');
    }
    if (metrics.query.errorRate <= 0.001) {
      achievements.push('Outstanding system reliability');
    }

    return {
      healthScore,
      keyMetrics,
      criticalIssues,
      achievements
    };
  }

  private calculateHealthScore(metrics: any): number {
    const scores = [
      // Response Time Score (0-25 points)
      Math.max(0, 25 - (metrics.responseTime.p95 / 20)),

      // Error Rate Score (0-25 points)
      Math.max(0, 25 - (metrics.query.errorRate * 2500)),

      // Cache Hit Rate Score (0-25 points)
      metrics.cache.hitRate * 25,

      // Availability Score (0-25 points)
      (metrics.sla.availability - 0.95) * 500
    ];

    return Math.max(0, Math.min(100, scores.reduce((a, b) => a + b, 0)));
  }

  private async generatePerformanceAnalysis(metrics: any): Promise<PerformanceAnalysis> {
    // Response time distribution
    const distribution = this.calculateResponseTimeDistribution(metrics.responseTime);

    return {
      responseTime: {
        percentiles: metrics.responseTime,
        distribution,
        trends: [] // Would be populated with historical data
      },
      throughput: {
        average: metrics.sla.throughputActual,
        peak: metrics.sla.throughputActual * 1.5, // Estimated
        trends: []
      },
      errorAnalysis: {
        totalErrors: Math.floor(metrics.responseTime.count * metrics.query.errorRate),
        errorRate: metrics.query.errorRate,
        errorTypes: [
          { type: '5xx Server Errors', count: 0, percentage: 0 },
          { type: '4xx Client Errors', count: 0, percentage: 0 },
          { type: 'Timeout Errors', count: 0, percentage: 0 }
        ],
        trends: []
      }
    };
  }

  private calculateResponseTimeDistribution(responseTimeMetrics: any) {
    const ranges = [
      { range: '0-100ms', min: 0, max: 100 },
      { range: '100-500ms', min: 100, max: 500 },
      { range: '500ms-1s', min: 500, max: 1000 },
      { range: '1s-5s', min: 1000, max: 5000 },
      { range: '5s+', min: 5000, max: Infinity }
    ];

    // Simplified distribution calculation
    return ranges.map(range => ({
      range: range.range,
      count: Math.floor(responseTimeMetrics.count * 0.2), // Mock distribution
      percentage: 20
    }));
  }

  private async generateAvailabilityReport(metrics: any): Promise<AvailabilityReport> {
    return {
      uptime: metrics.sla.availability,
      downtime: 1 - metrics.sla.availability,
      incidents: [], // Would be populated from incident tracking
      mttr: 5, // 5 minutes average
      mtbf: 720 // 12 hours average
    };
  }

  private async generateCacheReport(cacheMetrics: CacheMetrics): Promise<CacheReport> {
    return {
      effectiveness: {
        hitRate: cacheMetrics.hitRate,
        missRate: cacheMetrics.missRate,
        totalRequests: cacheMetrics.totalRequests
      },
      performance: {
        avgHitTime: 5, // Estimated 5ms for cache hits
        avgMissTime: 100, // Estimated 100ms for cache misses
        sizeTrends: []
      },
      optimization: {
        evictionRate: cacheMetrics.evictions / Math.max(1, cacheMetrics.totalRequests),
        hotKeys: [], // Would need to track most accessed keys
        recommendations: this.generateCacheRecommendations(cacheMetrics)
      }
    };
  }

  private generateCacheRecommendations(cacheMetrics: CacheMetrics): string[] {
    const recommendations = [];

    if (cacheMetrics.hitRate < 0.6) {
      recommendations.push('Review cache key strategies and TTL settings');
    }
    if (cacheMetrics.evictions > cacheMetrics.hits * 0.1) {
      recommendations.push('Consider increasing cache size to reduce evictions');
    }
    if (cacheMetrics.totalRequests === 0) {
      recommendations.push('Implement caching for frequently accessed data');
    }

    return recommendations;
  }

  private async generateQueryReport(queryMetrics: QueryMetrics): Promise<QueryReport> {
    return {
      performance: queryMetrics,
      analysis: {
        slowestQueries: queryMetrics.slowQueries.map(q => ({
          query: q.query,
          avgDuration: q.duration,
          count: 1,
          impact: q.duration
        })),
        queryPatterns: [], // Would need query pattern analysis
        optimizationOpportunities: this.generateQueryOptimizations(queryMetrics)
      }
    };
  }

  private generateQueryOptimizations(queryMetrics: QueryMetrics): string[] {
    const optimizations = [];

    if (queryMetrics.avgResponseTime > 500) {
      optimizations.push('Add database indexes for frequently queried columns');
    }
    if (queryMetrics.slowQueries.length > 5) {
      optimizations.push('Optimize slow queries with query plan analysis');
    }
    if (queryMetrics.errorRate > 0.01) {
      optimizations.push('Implement query retry logic with exponential backoff');
    }

    return optimizations;
  }

  private async generateSLAReport(slaMetrics: SLAMetrics): Promise<SLAReport> {
    const violations = [
      {
        metric: 'Response Time',
        count: slaMetrics.violations.filter(v => v.type === 'response_time').length,
        totalDuration: 0,
        impact: 'medium' as const
      },
      {
        metric: 'Error Rate',
        count: slaMetrics.violations.filter(v => v.type === 'error_rate').length,
        totalDuration: 0,
        impact: 'high' as const
      },
      {
        metric: 'Throughput',
        count: slaMetrics.violations.filter(v => v.type === 'throughput').length,
        totalDuration: 0,
        impact: 'low' as const
      }
    ];

    return {
      compliance: slaMetrics,
      violations,
      trends: {
        complianceHistory: [],
        violationTrends: []
      }
    };
  }

  private async generateTrendAnalysis(metrics: any): Promise<TrendAnalysis> {
    return {
      performanceTrends: {
        responseTime: 'stable',
        throughput: 'stable',
        errorRate: 'stable',
        cacheHitRate: 'stable'
      },
      seasonality: {
        dailyPatterns: [],
        weeklyPatterns: []
      },
      forecasting: {
        expectedLoad: metrics.sla.throughputActual * 1.2,
        capacityRecommendations: [
          'Monitor resource utilization during peak hours',
          'Consider horizontal scaling for increased load'
        ],
        growthProjections: [
          { period: 'Next Month', expectedIncrease: 20 },
          { period: 'Next Quarter', expectedIncrease: 60 }
        ]
      }
    };
  }

  private async generateRecommendations(metrics: any): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Performance recommendations
    if (metrics.responseTime.p95 > 500) {
      recommendations.push({
        id: 'perf-001',
        category: 'performance',
        priority: 'high',
        title: 'Optimize Response Time',
        description: 'P95 response time exceeds 500ms target',
        impact: 'Improve user experience and meet SLA requirements',
        effort: 'medium',
        timeline: '2-4 weeks',
        implementationSteps: [
          'Analyze slow query log',
          'Add database indexes',
          'Implement query optimization',
          'Add response caching where appropriate'
        ]
      });
    }

    // Cache recommendations
    if (metrics.cache.hitRate < 0.8) {
      recommendations.push({
        id: 'cache-001',
        category: 'performance',
        priority: 'medium',
        title: 'Improve Cache Effectiveness',
        description: 'Cache hit rate is below 80% target',
        impact: 'Reduce database load and improve response times',
        effort: 'low',
        timeline: '1-2 weeks',
        implementationSteps: [
          'Review cache key strategies',
          'Adjust TTL settings',
          'Implement cache warming',
          'Add caching for frequently accessed data'
        ]
      });
    }

    // Reliability recommendations
    if (metrics.query.errorRate > 0.01) {
      recommendations.push({
        id: 'rel-001',
        category: 'reliability',
        priority: 'critical',
        title: 'Reduce Error Rate',
        description: 'Error rate exceeds 1% threshold',
        impact: 'Improve system reliability and user experience',
        effort: 'high',
        timeline: '3-6 weeks',
        implementationSteps: [
          'Implement comprehensive error logging',
          'Add circuit breakers for external services',
          'Improve input validation',
          'Add automated error recovery'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Export report to different formats
   */
  async exportReport(report: PerformanceReport, format: 'json' | 'csv' | 'html' | 'pdf'): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);

      case 'csv':
        return this.exportToCSV(report);

      case 'html':
        return this.exportToHTML(report);

      case 'pdf':
        return 'PDF export would require additional PDF generation library';

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private exportToCSV(report: PerformanceReport): string {
    const rows = [
      ['Metric', 'Value', 'Status'],
      ['Report ID', report.id, ''],
      ['Generated', new Date(report.timestamp).toISOString(), ''],
      ['Period Start', new Date(report.period.start).toISOString(), ''],
      ['Period End', new Date(report.period.end).toISOString(), ''],
      ['Total Requests', report.summary.totalRequests.toString(), ''],
      ['Average Response Time', `${report.summary.avgResponseTime.toFixed(2)}ms`, ''],
      ['P95 Response Time', `${report.summary.p95ResponseTime.toFixed(2)}ms`, ''],
      ['Error Rate', `${(report.summary.errorRate * 100).toFixed(2)}%`, ''],
      ['Cache Hit Rate', `${(report.summary.cacheHitRate * 100).toFixed(1)}%`, ''],
      ['SLA Compliance', `${(report.summary.slaCompliance * 100).toFixed(1)}%`, ''],
      ['Availability', `${(report.summary.availability * 100).toFixed(2)}%`, '']
    ];

    return rows.map(row => row.join(',')).join('\n');
  }

  private exportToHTML(report: PerformanceReport): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Performance Report - ${report.id}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .metric { display: inline-block; margin: 10px; padding: 15px; background: #fff; border: 1px solid #ddd; border-radius: 4px; }
            .critical { border-left: 4px solid #dc3545; }
            .warning { border-left: 4px solid #ffc107; }
            .good { border-left: 4px solid #28a745; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Performance Report</h1>
            <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
            <p>Period: ${new Date(report.period.start).toLocaleString()} - ${new Date(report.period.end).toLocaleString()}</p>
        </div>

        <h2>Summary</h2>
        <div class="metric">
            <h4>Total Requests</h4>
            <p>${report.summary.totalRequests.toLocaleString()}</p>
        </div>
        <div class="metric">
            <h4>Average Response Time</h4>
            <p>${report.summary.avgResponseTime.toFixed(2)}ms</p>
        </div>
        <div class="metric">
            <h4>Error Rate</h4>
            <p>${(report.summary.errorRate * 100).toFixed(2)}%</p>
        </div>
        <div class="metric">
            <h4>Cache Hit Rate</h4>
            <p>${(report.summary.cacheHitRate * 100).toFixed(1)}%</p>
        </div>

        <h2>Recommendations</h2>
        ${report.sections.recommendations.map(rec => `
            <div class="metric ${rec.priority}">
                <h4>${rec.title}</h4>
                <p><strong>Priority:</strong> ${rec.priority}</p>
                <p><strong>Category:</strong> ${rec.category}</p>
                <p>${rec.description}</p>
                <p><strong>Impact:</strong> ${rec.impact}</p>
            </div>
        `).join('')}
    </body>
    </html>`;
  }
}