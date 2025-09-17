import { EventEmitter } from 'events';
import { CacheOrchestrator } from './CacheOrchestrator';
import { CDNIntegration } from './CDNIntegration';

export interface PerformanceMetrics {
  cache: {
    hitRate: number;
    missRate: number;
    avgResponseTime: number;
    memoryUsage: number;
    operations: {
      total: number;
      hits: number;
      misses: number;
      sets: number;
      deletes: number;
    };
  };
  cdn: {
    enabled: boolean;
    hitRate: number;
    avgResponseTime: number;
    bandwidth: number;
    requests: number;
  };
  application: {
    avgPageLoadTime: number;
    avgApiResponseTime: number;
    totalRequests: number;
    errorRate: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
  };
}

export interface PerformanceAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'performance' | 'availability' | 'error';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: number;
  resolved: boolean;
}

export interface PerformanceTarget {
  metric: string;
  target: number;
  warning: number;
  critical: number;
  unit: string;
}

export class PerformanceMonitor extends EventEmitter {
  private cacheOrchestrator: CacheOrchestrator;
  private cdnIntegration?: CDNIntegration;
  private metrics: PerformanceMetrics;
  private alerts: Map<string, PerformanceAlert> = new Map();
  private targets: Map<string, PerformanceTarget> = new Map();
  private monitoring = false;
  private monitoringInterval?: ReturnType<typeof setTimeout>;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 1440; // 24 hours at 1-minute intervals

  constructor(
    cacheOrchestrator: CacheOrchestrator,
    cdnIntegration?: CDNIntegration
  ) {
    super();
    this.cacheOrchestrator = cacheOrchestrator;
    this.cdnIntegration = cdnIntegration;
    this.metrics = this.initializeMetrics();
    this.setupPerformanceTargets();
  }

  // Start performance monitoring
  startMonitoring(interval: number = 60000): void { // Default: 1 minute
    if (this.monitoring) {
      console.log('Performance monitoring already started');
      return;
    }

    this.monitoring = true;
    console.log(`Starting performance monitoring with ${interval}ms interval`);

    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
      this.checkAlerts();
      this.emit('metrics-updated', this.metrics);
    }, interval);

    // Initial metrics collection
    setImmediate(() => this.collectMetrics());
  }

  // Stop performance monitoring
  stopMonitoring(): void {
    if (!this.monitoring) {
      console.log('Performance monitoring is not running');
      return;
    }

    this.monitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('Performance monitoring stopped');
  }

  // Get current performance metrics
  getMetrics(): PerformanceMetrics {
    return JSON.parse(JSON.stringify(this.metrics));
  }

  // Get performance metrics history
  getMetricsHistory(hours: number = 1): PerformanceMetrics[] {
    const pointsNeeded = Math.min(hours * 60, this.maxHistorySize);
    return this.metricsHistory.slice(-pointsNeeded);
  }

  // Get active alerts
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  // Get all alerts (including resolved)
  getAllAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values());
  }

  // Set performance target
  setPerformanceTarget(target: PerformanceTarget): void {
    this.targets.set(target.metric, target);
    console.log(`Performance target set: ${target.metric} - Target: ${target.target}${target.unit}`);
  }

  // Check if performance targets are met
  checkPerformanceTargets(): {
    passed: number;
    failed: number;
    targets: Array<{
      metric: string;
      target: number;
      current: number;
      status: 'pass' | 'warning' | 'critical';
      unit: string;
    }>;
  } {
    const results = {
      passed: 0,
      failed: 0,
      targets: [] as Array<{
        metric: string;
        target: number;
        current: number;
        status: 'pass' | 'warning' | 'critical';
        unit: string;
      }>
    };

    for (const [metric, target] of this.targets) {
      const currentValue = this.getMetricValue(metric);
      let status: 'pass' | 'warning' | 'critical' = 'pass';

      if (currentValue >= target.critical) {
        status = 'critical';
        results.failed++;
      } else if (currentValue >= target.warning) {
        status = 'warning';
      } else if (currentValue <= target.target) {
        results.passed++;
      } else {
        results.failed++;
      }

      results.targets.push({
        metric,
        target: target.target,
        current: currentValue,
        status,
        unit: target.unit
      });
    }

    return results;
  }

  // Generate performance report
  generateReport(timeframe: '1h' | '24h' | '7d' = '24h'): {
    summary: {
      overallScore: number;
      cacheEfficiency: number;
      responseTimeGrade: 'A' | 'B' | 'C' | 'D' | 'F';
      availability: number;
    };
    details: {
      cache: any;
      performance: any;
      alerts: any;
    };
    recommendations: string[];
  } {
    const hours = timeframe === '1h' ? 1 : timeframe === '24h' ? 24 : 168;
    const history = this.getMetricsHistory(hours);
    
    // Calculate averages
    const avgCacheHitRate = this.calculateAverage(history, 'cache.hitRate');
    const avgResponseTime = this.calculateAverage(history, 'cache.avgResponseTime');
    const avgApiResponseTime = this.calculateAverage(history, 'application.avgApiResponseTime');
    const avgErrorRate = this.calculateAverage(history, 'application.errorRate');

    // Calculate grades
    const cacheEfficiency = Math.min(100, Math.max(0, avgCacheHitRate));
    const responseTimeGrade = this.calculateResponseTimeGrade(avgResponseTime);
    const availability = Math.max(0, 100 - avgErrorRate);
    
    // Overall score (weighted average)
    const overallScore = Math.round(
      (cacheEfficiency * 0.3) +
      (this.gradeToScore(responseTimeGrade) * 0.4) +
      (availability * 0.3)
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      cacheHitRate: avgCacheHitRate,
      responseTime: avgResponseTime,
      errorRate: avgErrorRate
    });

    return {
      summary: {
        overallScore,
        cacheEfficiency,
        responseTimeGrade,
        availability
      },
      details: {
        cache: {
          hitRate: avgCacheHitRate,
          responseTime: avgResponseTime,
          memoryUsage: this.metrics.cache.memoryUsage
        },
        performance: {
          apiResponseTime: avgApiResponseTime,
          errorRate: avgErrorRate,
          totalRequests: this.metrics.application.totalRequests
        },
        alerts: {
          active: this.getActiveAlerts().length,
          total: this.getAllAlerts().length,
          critical: this.getActiveAlerts().filter(a => a.severity === 'critical').length
        }
      },
      recommendations
    };
  }

  private async collectMetrics(): Promise<void> {
    try {
      // Collect cache metrics
      const cacheMetrics = this.cacheOrchestrator.getMetrics();
      this.metrics.cache = {
        hitRate: cacheMetrics.overall.hitRate || 0,
        missRate: 100 - (cacheMetrics.overall.hitRate || 0),
        avgResponseTime: cacheMetrics.overall.avgResponseTime || 0,
        memoryUsage: cacheMetrics.overall.memoryUsage || 0,
        operations: {
          total: (cacheMetrics.memory?.hits || 0) + (cacheMetrics.memory?.misses || 0) + (cacheMetrics.redis?.hits || 0) + (cacheMetrics.redis?.misses || 0),
          hits: (cacheMetrics.memory?.hits || 0) + (cacheMetrics.redis?.hits || 0),
          misses: (cacheMetrics.memory?.misses || 0) + (cacheMetrics.redis?.misses || 0),
          sets: (cacheMetrics.redis?.operations?.set || 0),
          deletes: (cacheMetrics.redis?.operations?.del || 0)
        }
      };

      // Collect CDN metrics
      if (this.cdnIntegration && this.cdnIntegration.isEnabled()) {
        const cdnMetrics = this.cdnIntegration.getMetrics();
        this.metrics.cdn = {
          enabled: true,
          hitRate: cdnMetrics.hits > 0 ? (cdnMetrics.hits / (cdnMetrics.hits + cdnMetrics.misses)) * 100 : 0,
          avgResponseTime: cdnMetrics.avgResponseTime,
          bandwidth: cdnMetrics.bandwidth,
          requests: cdnMetrics.requests
        };
      } else {
        this.metrics.cdn.enabled = false;
      }

      // Collect application metrics (simulated)
      this.collectApplicationMetrics();

      // Collect system metrics (simulated)
      this.collectSystemMetrics();

      // Store in history
      this.metricsHistory.push(JSON.parse(JSON.stringify(this.metrics)));
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }

    } catch (error) {
      console.error('Error collecting performance metrics:', error);
    }
  }

  private collectApplicationMetrics(): void {
    // Simulate application metrics collection
    this.metrics.application = {
      avgPageLoadTime: Math.random() * 2000 + 500, // 500-2500ms
      avgApiResponseTime: Math.random() * 500 + 100, // 100-600ms
      totalRequests: Math.floor(Math.random() * 1000) + this.metrics.application.totalRequests,
      errorRate: Math.random() * 5 // 0-5%
    };
  }

  private collectSystemMetrics(): void {
    // Simulate system metrics collection
    this.metrics.system = {
      cpuUsage: Math.random() * 80 + 10, // 10-90%
      memoryUsage: Math.random() * 60 + 30, // 30-90%
      diskUsage: Math.random() * 30 + 50, // 50-80%
      networkLatency: Math.random() * 50 + 10 // 10-60ms
    };
  }

  private checkAlerts(): void {
    const now = Date.now();

    // Check cache hit rate
    this.checkAlert('cache-hit-rate', {
      current: this.metrics.cache.hitRate,
      target: 90,
      warning: 80,
      critical: 70,
      message: 'Cache hit rate is below target',
      type: 'performance'
    });

    // Check response time
    this.checkAlert('cache-response-time', {
      current: this.metrics.cache.avgResponseTime,
      target: 100,
      warning: 500,
      critical: 1000,
      message: 'Cache response time is above target',
      type: 'performance',
      inverse: true // Higher values are worse
    });

    // Check memory usage
    this.checkAlert('memory-usage', {
      current: this.metrics.system.memoryUsage,
      target: 70,
      warning: 80,
      critical: 90,
      message: 'System memory usage is high',
      type: 'performance',
      inverse: true
    });

    // Check error rate
    this.checkAlert('error-rate', {
      current: this.metrics.application.errorRate,
      target: 1,
      warning: 3,
      critical: 5,
      message: 'Application error rate is high',
      type: 'error',
      inverse: true
    });
  }

  private checkAlert(id: string, config: {
    current: number;
    target: number;
    warning: number;
    critical: number;
    message: string;
    type: 'performance' | 'availability' | 'error';
    inverse?: boolean;
  }): void {
    const { current, warning, critical, message, type, inverse = false } = config;
    const existingAlert = this.alerts.get(id);
    
    let severity: 'low' | 'medium' | 'high' | 'critical' | null = null;
    
    if (inverse) {
      if (current >= critical) severity = 'critical';
      else if (current >= warning) severity = 'high';
    } else {
      if (current <= critical) severity = 'critical';
      else if (current <= warning) severity = 'high';
    }
    
    if (severity) {
      if (!existingAlert || existingAlert.resolved) {
        const alert: PerformanceAlert = {
          id,
          severity,
          type,
          message,
          threshold: severity === 'critical' ? critical : warning,
          currentValue: current,
          timestamp: Date.now(),
          resolved: false
        };
        
        this.alerts.set(id, alert);
        this.emit('alert', alert);
        console.warn(`Performance Alert [${severity.toUpperCase()}]: ${message} (${current})`);
      }
    } else if (existingAlert && !existingAlert.resolved) {
      // Resolve the alert
      existingAlert.resolved = true;
      this.emit('alert-resolved', existingAlert);
      console.log(`Performance Alert Resolved: ${existingAlert.message}`);
    }
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      cache: {
        hitRate: 0,
        missRate: 0,
        avgResponseTime: 0,
        memoryUsage: 0,
        operations: {
          total: 0,
          hits: 0,
          misses: 0,
          sets: 0,
          deletes: 0
        }
      },
      cdn: {
        enabled: false,
        hitRate: 0,
        avgResponseTime: 0,
        bandwidth: 0,
        requests: 0
      },
      application: {
        avgPageLoadTime: 0,
        avgApiResponseTime: 0,
        totalRequests: 0,
        errorRate: 0
      },
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkLatency: 0
      }
    };
  }

  private setupPerformanceTargets(): void {
    this.setPerformanceTarget({
      metric: 'cache.hitRate',
      target: 90,
      warning: 80,
      critical: 70,
      unit: '%'
    });

    this.setPerformanceTarget({
      metric: 'cache.avgResponseTime',
      target: 100,
      warning: 500,
      critical: 1000,
      unit: 'ms'
    });

    this.setPerformanceTarget({
      metric: 'application.avgApiResponseTime',
      target: 200,
      warning: 1000,
      critical: 2000,
      unit: 'ms'
    });
  }

  private getMetricValue(metric: string): number {
    const parts = metric.split('.');
    let value: any = this.metrics;
    
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) return 0;
    }
    
    return typeof value === 'number' ? value : 0;
  }

  private calculateAverage(history: PerformanceMetrics[], metric: string): number {
    if (history.length === 0) return 0;
    
    const sum = history.reduce((total, metrics) => {
      return total + this.getMetricValueFromObject(metrics, metric);
    }, 0);
    
    return sum / history.length;
  }

  private getMetricValueFromObject(obj: any, metric: string): number {
    const parts = metric.split('.');
    let value = obj;
    
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) return 0;
    }
    
    return typeof value === 'number' ? value : 0;
  }

  private calculateResponseTimeGrade(responseTime: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (responseTime <= 100) return 'A';
    if (responseTime <= 300) return 'B';
    if (responseTime <= 600) return 'C';
    if (responseTime <= 1000) return 'D';
    return 'F';
  }

  private gradeToScore(grade: 'A' | 'B' | 'C' | 'D' | 'F'): number {
    switch (grade) {
      case 'A': return 95;
      case 'B': return 85;
      case 'C': return 75;
      case 'D': return 65;
      case 'F': return 50;
    }
  }

  private generateRecommendations(metrics: {
    cacheHitRate: number;
    responseTime: number;
    errorRate: number;
  }): string[] {
    const recommendations: string[] = [];

    if (metrics.cacheHitRate < 80) {
      recommendations.push('Consider increasing cache TTL values for frequently accessed data');
      recommendations.push('Implement cache warming strategies for popular content');
      recommendations.push('Review cache invalidation patterns to reduce unnecessary evictions');
    }

    if (metrics.responseTime > 500) {
      recommendations.push('Optimize database queries to reduce response times');
      recommendations.push('Consider implementing query result caching');
      recommendations.push('Enable compression for API responses');
    }

    if (metrics.errorRate > 2) {
      recommendations.push('Implement better error handling and retry mechanisms');
      recommendations.push('Add health checks for external dependencies');
      recommendations.push('Consider circuit breaker pattern for unstable services');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable limits. Continue monitoring.');
    }

    return recommendations;
  }
}