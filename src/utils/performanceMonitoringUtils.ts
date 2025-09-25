import { PerformanceMetric, TrendData, RegressionData } from '../types/performance';

/**
 * Utility functions for performance monitoring and analysis
 */

export class PerformanceMonitoringUtils {
  /**
   * Calculate statistical regression analysis
   */
  static analyzeRegression(
    currentData: number[],
    historicalData: number[],
    confidence: number = 0.95
  ): {
    isRegression: boolean;
    changePercent: number;
    significance: 'low' | 'medium' | 'high';
    confidence: number;
  } {
    if (currentData.length === 0 || historicalData.length === 0) {
      return {
        isRegression: false,
        changePercent: 0,
        significance: 'low',
        confidence: 0,
      };
    }

    const currentMean = this.calculateMean(currentData);
    const historicalMean = this.calculateMean(historicalData);
    const changePercent = ((currentMean - historicalMean) / historicalMean) * 100;

    // Simple t-test for regression detection
    const currentStd = this.calculateStandardDeviation(currentData);
    const historicalStd = this.calculateStandardDeviation(historicalData);

    const pooledStd = Math.sqrt(
      ((currentData.length - 1) * Math.pow(currentStd, 2) +
        (historicalData.length - 1) * Math.pow(historicalStd, 2)) /
        (currentData.length + historicalData.length - 2)
    );

    const tStatistic =
      Math.abs(currentMean - historicalMean) /
      (pooledStd * Math.sqrt(1 / currentData.length + 1 / historicalData.length));

    // Critical values for 95% confidence (approximate)
    const criticalValue = 1.96;
    const isSignificant = tStatistic > criticalValue;

    let significance: 'low' | 'medium' | 'high' = 'low';
    if (Math.abs(changePercent) > 50) {
      significance = 'high';
    } else if (Math.abs(changePercent) > 20) {
      significance = 'medium';
    }

    return {
      isRegression: isSignificant && Math.abs(changePercent) > 5,
      changePercent,
      significance,
      confidence: Math.min(1, tStatistic / criticalValue),
    };
  }

  /**
   * Detect anomalies using IQR method
   */
  static detectAnomalies(data: number[]): {
    anomalies: number[];
    threshold: { lower: number; upper: number };
  } {
    if (data.length < 4) {
      return { anomalies: [], threshold: { lower: 0, upper: 0 } };
    }

    const sorted = [...data].sort((a, b) => a - b);
    const q1 = this.calculatePercentile(sorted, 25);
    const q3 = this.calculatePercentile(sorted, 75);
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const anomalies = data.filter(value => value < lowerBound || value > upperBound);

    return {
      anomalies,
      threshold: { lower: lowerBound, upper: upperBound },
    };
  }

  /**
   * Calculate performance budget compliance
   */
  static calculateBudgetCompliance(
    currentValue: number,
    threshold: number,
    condition: 'above' | 'below' | 'equals'
  ): {
    passing: boolean;
    utilizationPercent: number;
    margin: number;
  } {
    let passing = false;
    let utilizationPercent = 0;
    let margin = 0;

    switch (condition) {
      case 'below':
        passing = currentValue <= threshold;
        utilizationPercent = (currentValue / threshold) * 100;
        margin = threshold - currentValue;
        break;
      case 'above':
        passing = currentValue >= threshold;
        utilizationPercent = (currentValue / threshold) * 100;
        margin = currentValue - threshold;
        break;
      case 'equals':
        const tolerance = threshold * 0.05; // 5% tolerance
        passing = Math.abs(currentValue - threshold) <= tolerance;
        utilizationPercent = (currentValue / threshold) * 100;
        margin = currentValue - threshold;
        break;
    }

    return {
      passing,
      utilizationPercent: Math.max(0, utilizationPercent),
      margin,
    };
  }

  /**
   * Generate performance insights and recommendations
   */
  static generateInsights(metrics: PerformanceMetric[]): {
    insights: string[];
    recommendations: string[];
    severity: 'low' | 'medium' | 'high';
  } {
    const insights: string[] = [];
    const recommendations: string[] = [];
    let severity: 'low' | 'medium' | 'high' = 'low';

    if (metrics.length === 0) {
      return { insights: ['No data available'], recommendations: [], severity: 'low' };
    }

    // Group metrics by type
    const metricGroups = metrics.reduce(
      (groups, metric) => {
        if (!groups[metric.metric]) {
          groups[metric.metric] = [];
        }
        groups[metric.metric].push(metric.value);
        return groups;
      },
      {} as Record<string, number[]>
    );

    Object.entries(metricGroups).forEach(([metricName, values]) => {
      const latest = values[values.length - 1];
      const mean = this.calculateMean(values);
      const trend = this.calculateTrend(values);

      // Response time analysis
      if (metricName.includes('response_time') || metricName.includes('latency')) {
        if (latest > 2000) {
          insights.push(`High response time detected: ${latest.toFixed(0)}ms`);
          recommendations.push('Optimize database queries and implement caching');
          severity = 'high';
        } else if (latest > 1000) {
          insights.push(`Elevated response time: ${latest.toFixed(0)}ms`);
          recommendations.push('Review recent changes and monitor closely');
          severity = severity === 'low' ? 'medium' : severity;
        }

        if (trend > 10) {
          insights.push(`Response time trending upward (+${trend.toFixed(1)}%)`);
          recommendations.push('Investigate performance degradation causes');
        }
      }

      // Memory usage analysis
      if (metricName.includes('memory')) {
        if (latest > 500) {
          insights.push(`High memory usage: ${latest.toFixed(0)}MB`);
          recommendations.push('Check for memory leaks and optimize data structures');
          severity = 'high';
        } else if (trend > 15) {
          insights.push(`Memory usage increasing trend (+${trend.toFixed(1)}%)`);
          recommendations.push('Monitor memory allocation patterns');
          severity = severity === 'low' ? 'medium' : severity;
        }
      }

      // Error rate analysis
      if (metricName.includes('error')) {
        if (latest > 0.05) {
          insights.push(`High error rate: ${(latest * 100).toFixed(1)}%`);
          recommendations.push('Investigate error patterns and implement fixes');
          severity = 'high';
        } else if (trend > 20) {
          insights.push(`Error rate increasing (+${trend.toFixed(1)}%)`);
          recommendations.push('Review recent deployments and error logs');
          severity = severity === 'low' ? 'medium' : severity;
        }
      }

      // CPU usage analysis
      if (metricName.includes('cpu')) {
        if (latest > 80) {
          insights.push(`High CPU usage: ${latest.toFixed(1)}%`);
          recommendations.push('Optimize algorithms and consider scaling');
          severity = 'high';
        }
      }

      // Cache hit rate analysis
      if (metricName.includes('cache')) {
        if (latest < 0.7) {
          insights.push(`Low cache hit rate: ${(latest * 100).toFixed(1)}%`);
          recommendations.push('Review caching strategy and cache key patterns');
          severity = severity === 'low' ? 'medium' : severity;
        }
      }
    });

    // General recommendations if no specific issues found
    if (insights.length === 0) {
      insights.push('Performance metrics are within normal ranges');
      recommendations.push('Continue monitoring and consider proactive optimizations');
    }

    return { insights, recommendations, severity };
  }

  /**
   * Calculate SLA compliance
   */
  static calculateSLACompliance(
    metrics: PerformanceMetric[],
    slaThresholds: Record<string, number>
  ): {
    overall: number;
    byMetric: Record<string, number>;
    violations: Array<{ metric: string; value: number; threshold: number; timestamp: number }>;
  } {
    const violations: Array<{
      metric: string;
      value: number;
      threshold: number;
      timestamp: number;
    }> = [];
    const complianceByMetric: Record<string, number> = {};

    Object.keys(slaThresholds).forEach(metricName => {
      const metricData = metrics.filter(m => m.metric === metricName);
      const threshold = slaThresholds[metricName];

      if (metricData.length === 0) {
        complianceByMetric[metricName] = 100;
        return;
      }

      const compliantCount = metricData.filter(m => {
        const isCompliant = this.isMetricCompliant(m.metric, m.value, threshold);
        if (!isCompliant) {
          violations.push({
            metric: m.metric,
            value: m.value,
            threshold,
            timestamp: m.timestamp,
          });
        }
        return isCompliant;
      }).length;

      complianceByMetric[metricName] = (compliantCount / metricData.length) * 100;
    });

    const overall =
      Object.values(complianceByMetric).reduce((sum, compliance) => sum + compliance, 0) /
        Object.values(complianceByMetric).length || 0;

    return {
      overall,
      byMetric: complianceByMetric,
      violations,
    };
  }

  /**
   * Format performance metrics for display
   */
  static formatMetricValue(value: number, metricName: string, unit?: string): string {
    if (unit) {
      if (unit === 'ms') {
        return value < 1000 ? `${value.toFixed(0)}ms` : `${(value / 1000).toFixed(2)}s`;
      }
      if (unit === 'MB') {
        return value < 1024 ? `${value.toFixed(1)}MB` : `${(value / 1024).toFixed(2)}GB`;
      }
      if (unit === '%') {
        return `${(value * 100).toFixed(1)}%`;
      }
      return `${value.toFixed(2)} ${unit}`;
    }

    // Auto-detect format based on metric name
    if (metricName.includes('time') || metricName.includes('latency')) {
      return value < 1000 ? `${value.toFixed(0)}ms` : `${(value / 1000).toFixed(2)}s`;
    }
    if (metricName.includes('memory') || metricName.includes('size')) {
      return value < 1024 ? `${value.toFixed(1)}MB` : `${(value / 1024).toFixed(2)}GB`;
    }
    if (metricName.includes('rate') || metricName.includes('percent')) {
      return `${(value * 100).toFixed(1)}%`;
    }
    if (metricName.includes('throughput') || metricName.includes('rps')) {
      return `${value.toFixed(1)} req/s`;
    }

    return value.toFixed(2);
  }

  // Private helper methods

  private static calculateMean(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private static calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    const variance = this.calculateMean(squaredDifferences);
    return Math.sqrt(variance);
  }

  private static calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private static calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const recent = values.slice(-Math.ceil(values.length / 3));
    const older = values.slice(0, Math.floor(values.length / 3));

    const recentMean = this.calculateMean(recent);
    const olderMean = this.calculateMean(older);

    return ((recentMean - olderMean) / olderMean) * 100;
  }

  private static isMetricCompliant(metricName: string, value: number, threshold: number): boolean {
    // Default compliance rules - can be customized per metric
    if (metricName.includes('time') || metricName.includes('latency')) {
      return value <= threshold; // Lower is better
    }
    if (metricName.includes('error')) {
      return value <= threshold; // Lower is better
    }
    if (metricName.includes('cache')) {
      return value >= threshold; // Higher is better
    }
    if (metricName.includes('throughput')) {
      return value >= threshold; // Higher is better
    }

    // Default: lower is better
    return value <= threshold;
  }
}

/**
 * Performance monitoring hooks and utilities for React components
 */
export class ReactPerformanceUtils {
  /**
   * Measure component render time
   */
  static measureRenderTime(componentName: string, callback: () => void): number {
    const startTime = performance.now();
    callback();
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    console.log(`${componentName} render time: ${renderTime.toFixed(2)}ms`);
    return renderTime;
  }

  /**
   * Create a performance observer for monitoring
   */
  static createPerformanceObserver(
    callback: (entries: PerformanceEntry[]) => void
  ): PerformanceObserver | null {
    if (typeof PerformanceObserver === 'undefined') {
      console.warn('PerformanceObserver not supported');
      return null;
    }

    const observer = new PerformanceObserver(list => {
      callback(list.getEntries());
    });

    observer.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
    return observer;
  }

  /**
   * Monitor memory usage (Chrome only)
   */
  static getMemoryUsage(): {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null {
    if ('memory' in performance) {
      return (performance as any).memory;
    }
    return null;
  }

  /**
   * Monitor Core Web Vitals
   */
  static measureWebVitals(
    callback: (metric: { name: string; value: number; rating: string }) => void
  ): void {
    // This would integrate with web-vitals library in a real implementation
    if (typeof PerformanceObserver !== 'undefined') {
      // Monitor Largest Contentful Paint
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            const lcp = entry.startTime;
            callback({
              name: 'LCP',
              value: lcp,
              rating: lcp <= 2500 ? 'good' : lcp <= 4000 ? 'needs-improvement' : 'poor',
            });
          }
        }
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // Monitor First Input Delay
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'first-input') {
            const fid = (entry as any).processingStart - entry.startTime;
            callback({
              name: 'FID',
              value: fid,
              rating: fid <= 100 ? 'good' : fid <= 300 ? 'needs-improvement' : 'poor',
            });
          }
        }
      }).observe({ entryTypes: ['first-input'] });
    }
  }
}

export default PerformanceMonitoringUtils;
