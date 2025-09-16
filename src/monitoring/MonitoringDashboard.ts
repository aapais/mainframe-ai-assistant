/**
 * Monitoring Dashboard for Search Performance
 * 
 * Real-time dashboard for monitoring search service performance,
 * ensuring <1s response time SLA compliance and providing
 * actionable insights for optimization.
 */

import { EventEmitter } from 'events';
import { SearchPerformanceMonitor } from './SearchPerformanceMonitor';
import { PerformanceMonitor } from '../database/PerformanceMonitor';
import { CachePerformanceMonitor } from '../caching/CachePerformanceMonitor';

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'metric' | 'chart' | 'table' | 'alert' | 'gauge';
  size: 'small' | 'medium' | 'large';
  refreshInterval: number;
  data: any;
  thresholds?: {
    warning: number;
    critical: number;
  };
}

export interface DashboardConfig {
  title: string;
  refreshInterval: number;
  widgets: DashboardWidget[];
  alerts: {
    enabled: boolean;
    soundEnabled: boolean;
    notificationTypes: string[];
  };
}

export interface DashboardData {
  timestamp: Date;
  summary: {
    slaCompliance: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    queriesPerSecond: number;
    cacheHitRate: number;
    activeAlerts: number;
  };
  widgets: Record<string, any>;
  alerts: any[];
  trends: {
    responseTime: any[];
    throughput: any[];
    slaCompliance: any[];
  };
}

export class MonitoringDashboard extends EventEmitter {
  private searchMonitor: SearchPerformanceMonitor;
  private performanceMonitor: PerformanceMonitor;
  private cacheMonitor: CachePerformanceMonitor;
  
  private config: DashboardConfig;
  private currentData: DashboardData | null = null;
  private refreshTimer?: NodeJS.Timeout;
  
  constructor(
    searchMonitor: SearchPerformanceMonitor,
    performanceMonitor: PerformanceMonitor,
    cacheMonitor: CachePerformanceMonitor
  ) {
    super();
    
    this.searchMonitor = searchMonitor;
    this.performanceMonitor = performanceMonitor;
    this.cacheMonitor = cacheMonitor;
    
    this.config = this.createDefaultConfig();
    this.setupEventListeners();
    
    console.log('📊 Monitoring dashboard initialized');
  }

  /**
   * Start the dashboard with real-time updates
   */
  start(): void {
    this.refreshData();
    this.refreshTimer = setInterval(() => {
      this.refreshData();
    }, this.config.refreshInterval);
    
    console.log('🚀 Dashboard started with refresh interval:', this.config.refreshInterval);
  }

  /**
   * Stop the dashboard
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    console.log('⏹️ Dashboard stopped');
  }

  /**
   * Get current dashboard data
   */
  getCurrentData(): DashboardData | null {
    return this.currentData;
  }

  /**
   * Update dashboard configuration
   */
  updateConfig(config: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.refreshInterval && this.refreshTimer) {
      this.stop();
      this.start();
    }
    
    this.emit('config-updated', this.config);
  }

  /**
   * Get dashboard configuration for UI
   */
  getConfig(): DashboardConfig {
    return { ...this.config };
  }

  /**
   * Export dashboard data for reporting
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    if (!this.currentData) {
      throw new Error('No dashboard data available');
    }
    
    if (format === 'json') {
      return JSON.stringify(this.currentData, null, 2);
    } else {
      return this.convertToCSV(this.currentData);
    }
  }

  /**
   * Get performance health summary
   */
  getHealthSummary(): {
    overall: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    if (!this.currentData) {
      return {
        overall: 'warning',
        score: 0,
        issues: ['No monitoring data available'],
        recommendations: ['Check monitoring services']
      };
    }
    
    const { summary } = this.currentData;
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;
    
    // SLA compliance check
    if (summary.slaCompliance < 0.95) {
      issues.push(`SLA compliance: ${(summary.slaCompliance * 100).toFixed(1)}%`);
      recommendations.push('Investigate slow queries and optimize performance');
      score -= 30;
    }
    
    // Response time check
    if (summary.avgResponseTime > 800) {
      issues.push(`High average response time: ${summary.avgResponseTime}ms`);
      recommendations.push('Optimize query execution and caching');
      score -= 20;
    }
    
    if (summary.p95ResponseTime > 1500) {
      issues.push(`P95 response time: ${summary.p95ResponseTime}ms`);
      recommendations.push('Address outlier performance issues');
      score -= 15;
    }
    
    // Cache performance check
    if (summary.cacheHitRate < 0.8) {
      issues.push(`Low cache hit rate: ${(summary.cacheHitRate * 100).toFixed(1)}%`);
      recommendations.push('Review cache strategy and TTL settings');
      score -= 10;
    }
    
    // Active alerts check
    if (summary.activeAlerts > 0) {
      issues.push(`${summary.activeAlerts} active alerts`);
      recommendations.push('Review and resolve active alerts');
      score -= 5;
    }
    
    let overall: 'healthy' | 'warning' | 'critical';
    if (score >= 85) {
      overall = 'healthy';
    } else if (score >= 70) {
      overall = 'warning';
    } else {
      overall = 'critical';
    }
    
    return {
      overall,
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  // Private implementation methods

  private async refreshData(): Promise<void> {
    try {
      const timestamp = new Date();
      
      // Collect data from all monitors
      const searchMetrics = this.searchMonitor.getCurrentMetrics();
      const searchDashboard = this.searchMonitor.getDashboardData();
      const performanceStatus = this.performanceMonitor.getRealTimeStatus();
      const cacheMetrics = this.cacheMonitor.getCurrentMetrics();
      
      // Build summary
      const summary = {
        slaCompliance: searchMetrics?.slaCompliance || 0,
        avgResponseTime: searchMetrics?.avgResponseTime || 0,
        p95ResponseTime: searchMetrics?.p95ResponseTime || 0,
        queriesPerSecond: searchMetrics?.queriesPerSecond || 0,
        cacheHitRate: searchMetrics?.cacheHitRate || 0,
        activeAlerts: searchDashboard.activeAlerts.length
      };
      
      // Build widget data
      const widgets = {
        slaGauge: this.buildSLAGaugeWidget(summary),
        responseTimeChart: this.buildResponseTimeChartWidget(searchDashboard.recentTrends),
        throughputMetric: this.buildThroughputWidget(summary),
        cacheMetrics: this.buildCacheMetricsWidget(cacheMetrics),
        topQueries: this.buildTopQueriesWidget(searchDashboard.topQueries),
        slowQueries: this.buildSlowQueriesWidget(searchDashboard.slowQueries),
        alertsTable: this.buildAlertsTableWidget(searchDashboard.activeAlerts),
        systemHealth: this.buildSystemHealthWidget(performanceStatus)
      };
      
      // Build trends data
      const trends = {
        responseTime: searchDashboard.recentTrends?.responseTime || [],
        throughput: searchDashboard.recentTrends?.throughput || [],
        slaCompliance: searchDashboard.recentTrends?.slaCompliance || []
      };
      
      this.currentData = {
        timestamp,
        summary,
        widgets,
        alerts: searchDashboard.activeAlerts,
        trends
      };
      
      this.emit('data-updated', this.currentData);
      
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
      this.emit('refresh-error', error);
    }
  }

  private buildSLAGaugeWidget(summary: any): DashboardWidget {
    const compliance = summary.slaCompliance * 100;
    
    return {
      id: 'sla_gauge',
      title: 'SLA Compliance',
      type: 'gauge',
      size: 'medium',
      refreshInterval: 15000,
      data: {
        value: compliance,
        label: `${compliance.toFixed(1)}%`,
        color: compliance >= 95 ? 'green' : compliance >= 90 ? 'yellow' : 'red',
        target: 95,
        ranges: [
          { from: 0, to: 90, color: 'red', label: 'Critical' },
          { from: 90, to: 95, color: 'yellow', label: 'Warning' },
          { from: 95, to: 100, color: 'green', label: 'Healthy' }
        ]
      },
      thresholds: {
        warning: 95,
        critical: 90
      }
    };
  }

  private buildResponseTimeChartWidget(trends: any): DashboardWidget {
    return {
      id: 'response_time_chart',
      title: 'Response Time Trends',
      type: 'chart',
      size: 'large',
      refreshInterval: 30000,
      data: {
        type: 'line',
        series: [
          {
            name: 'Average',
            data: trends?.responseTime?.map((point: any) => ({
              x: point.time,
              y: point.avg
            })) || [],
            color: 'blue'
          },
          {
            name: 'P95',
            data: trends?.responseTime?.map((point: any) => ({
              x: point.time,
              y: point.p95
            })) || [],
            color: 'orange'
          },
          {
            name: 'P99',
            data: trends?.responseTime?.map((point: any) => ({
              x: point.time,
              y: point.p99
            })) || [],
            color: 'red'
          }
        ],
        xAxis: { type: 'datetime' },
        yAxis: { 
          title: 'Response Time (ms)',
          min: 0,
          plotLines: [
            { value: 1000, color: 'red', width: 2, label: 'SLA Threshold' }
          ]
        }
      },
      thresholds: {
        warning: 800,
        critical: 1000
      }
    };
  }

  private buildThroughputWidget(summary: any): DashboardWidget {
    return {
      id: 'throughput_metric',
      title: 'Query Throughput',
      type: 'metric',
      size: 'small',
      refreshInterval: 15000,
      data: {
        value: summary.queriesPerSecond,
        label: 'QPS',
        format: '0.1f',
        trend: {
          direction: 'neutral', // Would need historical data to calculate
          percentage: 0
        }
      }
    };
  }

  private buildCacheMetricsWidget(cacheMetrics: any): DashboardWidget {
    return {
      id: 'cache_metrics',
      title: 'Cache Performance',
      type: 'metric',
      size: 'medium',
      refreshInterval: 30000,
      data: {
        metrics: [
          {
            label: 'Hit Rate',
            value: cacheMetrics?.overallHitRate * 100 || 0,
            format: '0.1f%',
            color: (cacheMetrics?.overallHitRate || 0) >= 0.8 ? 'green' : 'yellow'
          },
          {
            label: 'Memory Usage',
            value: cacheMetrics?.memoryUsage || 0,
            format: 'bytes',
            color: 'blue'
          },
          {
            label: 'Efficiency',
            value: cacheMetrics?.memoryEfficiency * 100 || 0,
            format: '0.1f%',
            color: 'purple'
          }
        ]
      },
      thresholds: {
        warning: 80,
        critical: 70
      }
    };
  }

  private buildTopQueriesWidget(topQueries: any[]): DashboardWidget {
    return {
      id: 'top_queries',
      title: 'Top Queries',
      type: 'table',
      size: 'medium',
      refreshInterval: 60000,
      data: {
        columns: [
          { field: 'query', title: 'Query', width: '60%' },
          { field: 'executions', title: 'Count', width: '20%' },
          { field: 'avgTime', title: 'Avg Time (ms)', width: '20%', format: '0.0f' }
        ],
        rows: topQueries.slice(0, 5).map(q => ({
          query: q.normalizedQuery.substring(0, 50) + (q.normalizedQuery.length > 50 ? '...' : ''),
          executions: q.executions,
          avgTime: q.avgTime
        }))
      }
    };
  }

  private buildSlowQueriesWidget(slowQueries: any[]): DashboardWidget {
    return {
      id: 'slow_queries',
      title: 'Slow Queries',
      type: 'table',
      size: 'medium',
      refreshInterval: 30000,
      data: {
        columns: [
          { field: 'query', title: 'Query', width: '60%' },
          { field: 'avgTime', title: 'Avg Time (ms)', width: '25%', format: '0.0f' },
          { field: 'executions', title: 'Count', width: '15%' }
        ],
        rows: slowQueries.slice(0, 5).map(q => ({
          query: q.normalizedQuery.substring(0, 50) + (q.normalizedQuery.length > 50 ? '...' : ''),
          avgTime: q.avgTime,
          executions: q.executions,
          color: q.avgTime > 1000 ? 'red' : 'orange'
        }))
      },
      thresholds: {
        warning: 500,
        critical: 1000
      }
    };
  }

  private buildAlertsTableWidget(alerts: any[]): DashboardWidget {
    return {
      id: 'alerts_table',
      title: 'Active Alerts',
      type: 'alert',
      size: 'large',
      refreshInterval: 10000,
      data: {
        alerts: alerts.map(alert => ({
          id: alert.id,
          level: alert.level,
          message: alert.message,
          metric: alert.metric,
          timestamp: alert.timestamp,
          age: this.formatAge(alert.timestamp)
        }))
      }
    };
  }

  private buildSystemHealthWidget(performanceStatus: any): DashboardWidget {
    return {
      id: 'system_health',
      title: 'System Health',
      type: 'metric',
      size: 'small',
      refreshInterval: 30000,
      data: {
        status: performanceStatus.isHealthy ? 'healthy' : 'degraded',
        metrics: [
          {
            label: 'Memory Usage',
            value: performanceStatus.memoryUsage,
            format: 'bytes'
          },
          {
            label: 'Current Load',
            value: performanceStatus.currentLoad,
            format: '0'
          }
        ]
      }
    };
  }

  private createDefaultConfig(): DashboardConfig {
    return {
      title: 'Search Performance Monitor',
      refreshInterval: 15000, // 15 seconds
      widgets: [],
      alerts: {
        enabled: true,
        soundEnabled: false,
        notificationTypes: ['critical', 'warning']
      }
    };
  }

  private setupEventListeners(): void {
    // Listen for search alerts
    this.searchMonitor.on('search-alert', (alert) => {
      this.emit('alert-received', alert);
      
      if (this.config.alerts.enabled && 
          this.config.alerts.notificationTypes.includes(alert.level)) {
        this.emit('notification', {
          type: 'alert',
          level: alert.level,
          message: alert.message,
          timestamp: alert.timestamp
        });
      }
    });
    
    // Listen for performance alerts
    this.performanceMonitor.on('alert', (alert) => {
      this.emit('performance-alert', alert);
    });
    
    // Listen for cache alerts
    this.cacheMonitor.on('performance-alert', (alert) => {
      this.emit('cache-alert', alert);
    });
  }

  private formatAge(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  private convertToCSV(data: DashboardData): string {
    const headers = [
      'Timestamp',
      'SLA Compliance',
      'Avg Response Time',
      'P95 Response Time',
      'Queries Per Second',
      'Cache Hit Rate',
      'Active Alerts'
    ];
    
    const row = [
      data.timestamp.toISOString(),
      data.summary.slaCompliance.toFixed(3),
      data.summary.avgResponseTime.toFixed(1),
      data.summary.p95ResponseTime.toFixed(1),
      data.summary.queriesPerSecond.toFixed(2),
      data.summary.cacheHitRate.toFixed(3),
      data.summary.activeAlerts.toString()
    ];
    
    return headers.join(',') + '\n' + row.join(',');
  }
}

// Export utility functions for dashboard UI components
export const DashboardUtils = {
  formatMetric: (value: number, format: string): string => {
    switch (format) {
      case 'bytes':
        return DashboardUtils.formatBytes(value);
      case '0.1f':
        return value.toFixed(1);
      case '0.1f%':
        return value.toFixed(1) + '%';
      case '0':
        return Math.round(value).toString();
      default:
        return value.toString();
    }
  },
  
  formatBytes: (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },
  
  getStatusColor: (value: number, thresholds: { warning: number; critical: number }): string => {
    if (value < thresholds.critical) return 'red';
    if (value < thresholds.warning) return 'yellow';
    return 'green';
  },
  
  calculateTrend: (current: number, previous: number): { direction: string; percentage: number } => {
    if (previous === 0) return { direction: 'neutral', percentage: 0 };
    
    const change = ((current - previous) / previous) * 100;
    const direction = change > 5 ? 'up' : change < -5 ? 'down' : 'neutral';
    
    return { direction, percentage: Math.abs(change) };
  }
};