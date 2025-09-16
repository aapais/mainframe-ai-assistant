/**
 * OptimizationDashboard - Comprehensive optimization insights dashboard
 * Provides real-time optimization metrics, trends, and actionable recommendations
 */

import { EventEmitter } from 'events';
import { OptimizationEngine, OptimizationRecommendation, OptimizationMetrics } from './OptimizationEngine';

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'metric' | 'chart' | 'table' | 'alert' | 'progress' | 'heatmap';
  size: 'small' | 'medium' | 'large' | 'full';
  priority: number;
  data: any;
  refreshInterval: number; // seconds
  lastUpdated: number;
  configuration: Record<string, any>;
}

export interface DashboardAlert {
  id: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  category: string;
  acknowledged: boolean;
  autoResolve: boolean;
  metadata: Record<string, any>;
}

export interface OptimizationInsight {
  id: string;
  timestamp: number;
  type: 'trend' | 'pattern' | 'anomaly' | 'opportunity' | 'prediction';
  title: string;
  description: string;
  confidence: number; // 0-100
  impact: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  data: any;
  actionable: boolean;
  relatedRecommendations: string[];
}

export interface PerformanceReport {
  id: string;
  timestamp: number;
  period: string;
  summary: {
    totalOptimizations: number;
    successfulOptimizations: number;
    averageImprovement: number;
    totalROI: number;
    costSavings: number;
  };
  categoryBreakdown: Record<string, any>;
  trendAnalysis: any;
  topRecommendations: OptimizationRecommendation[];
  insights: OptimizationInsight[];
  futureProjections: any;
}

export class OptimizationDashboard extends EventEmitter {
  private optimizationEngine: OptimizationEngine;
  private widgets: Map<string, DashboardWidget> = new Map();
  private alerts: Map<string, DashboardAlert> = new Map();
  private insights: Map<string, OptimizationInsight> = new Map();
  private reports: Map<string, PerformanceReport> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private metricsHistory: OptimizationMetrics[] = [];

  constructor(optimizationEngine: OptimizationEngine) {
    super();
    this.optimizationEngine = optimizationEngine;
    this.setupEngineEventHandlers();
  }

  /**
   * Initialize the optimization dashboard
   */
  async initialize(): Promise<void> {
    console.log('Initializing OptimizationDashboard...');

    // Create default dashboard widgets
    await this.createDefaultWidgets();

    // Start dashboard monitoring
    this.startDashboardMonitoring();

    // Generate initial insights
    await this.generateInsights();

    console.log('OptimizationDashboard initialized');
  }

  /**
   * Get current dashboard configuration
   */
  getDashboardConfig(): any {
    const widgets = Array.from(this.widgets.values())
      .sort((a, b) => a.priority - b.priority);

    const activeAlerts = Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => b.timestamp - a.timestamp);

    const recentInsights = Array.from(this.insights.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    return {
      widgets,
      alerts: activeAlerts,
      insights: recentInsights,
      lastUpdated: Date.now(),
      summary: this.getDashboardSummary()
    };
  }

  /**
   * Get dashboard summary statistics
   */
  getDashboardSummary(): any {
    const recommendations = this.optimizationEngine.getRecommendations();
    const dashboardData = this.optimizationEngine.getDashboardData();

    return {
      totalRecommendations: recommendations.length,
      criticalIssues: recommendations.filter(r => r.impact === 'critical').length,
      pendingOptimizations: recommendations.filter(r => r.status === 'pending').length,
      completedOptimizations: recommendations.filter(r => r.status === 'completed').length,
      averageROI: dashboardData.summary.averageROI,
      systemHealth: this.calculateSystemHealth(),
      optimizationVelocity: this.calculateOptimizationVelocity(),
      costSavings: this.calculateCostSavings()
    };
  }

  /**
   * Create or update dashboard widget
   */
  createWidget(widget: Partial<DashboardWidget>): DashboardWidget {
    const fullWidget: DashboardWidget = {
      id: widget.id || `widget-${Date.now()}`,
      title: widget.title || 'Untitled Widget',
      type: widget.type || 'metric',
      size: widget.size || 'medium',
      priority: widget.priority || 50,
      data: widget.data || {},
      refreshInterval: widget.refreshInterval || 60,
      lastUpdated: Date.now(),
      configuration: widget.configuration || {}
    };

    this.widgets.set(fullWidget.id, fullWidget);

    // Set up auto-refresh
    this.setupWidgetRefresh(fullWidget);

    this.emit('widget-created', fullWidget);
    return fullWidget;
  }

  /**
   * Update widget data
   */
  updateWidget(widgetId: string, data: any): boolean {
    const widget = this.widgets.get(widgetId);
    if (!widget) return false;

    widget.data = { ...widget.data, ...data };
    widget.lastUpdated = Date.now();

    this.emit('widget-updated', widget);
    return true;
  }

  /**
   * Create dashboard alert
   */
  createAlert(alert: Partial<DashboardAlert>): DashboardAlert {
    const fullAlert: DashboardAlert = {
      id: alert.id || `alert-${Date.now()}`,
      timestamp: Date.now(),
      severity: alert.severity || 'info',
      title: alert.title || 'System Alert',
      message: alert.message || '',
      category: alert.category || 'general',
      acknowledged: false,
      autoResolve: alert.autoResolve || false,
      metadata: alert.metadata || {}
    };

    this.alerts.set(fullAlert.id, fullAlert);

    // Auto-resolve if configured
    if (fullAlert.autoResolve) {
      setTimeout(() => {
        this.resolveAlert(fullAlert.id);
      }, 300000); // 5 minutes
    }

    this.emit('alert-created', fullAlert);
    return fullAlert;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    this.emit('alert-acknowledged', alert);
    return true;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    this.alerts.delete(alertId);
    this.emit('alert-resolved', alert);
    return true;
  }

  /**
   * Generate optimization insights
   */
  async generateInsights(): Promise<OptimizationInsight[]> {
    const insights: OptimizationInsight[] = [];
    const recommendations = this.optimizationEngine.getRecommendations();
    const dashboardData = this.optimizationEngine.getDashboardData();

    // Trend analysis insight
    if (dashboardData.metrics.trends) {
      const degradingTrends = Object.entries(dashboardData.metrics.trends)
        .filter(([, trend]: [string, any]) => trend.direction === 'degrading');

      if (degradingTrends.length > 0) {
        insights.push({
          id: `trend-insight-${Date.now()}`,
          timestamp: Date.now(),
          type: 'trend',
          title: 'Performance Degradation Detected',
          description: `${degradingTrends.length} system components showing performance degradation`,
          confidence: 85,
          impact: degradingTrends.length > 2 ? 'high' : 'medium',
          category: 'performance',
          data: { degradingTrends },
          actionable: true,
          relatedRecommendations: recommendations
            .filter(r => degradingTrends.some(([category]) => r.category === category))
            .map(r => r.id)
        });
      }
    }

    // ROI opportunity insight
    const highROIRecommendations = recommendations.filter(r => r.roi > 70);
    if (highROIRecommendations.length > 0) {
      insights.push({
        id: `roi-insight-${Date.now()}`,
        timestamp: Date.now(),
        type: 'opportunity',
        title: 'High ROI Optimization Opportunities',
        description: `${highROIRecommendations.length} optimizations with >70% ROI available`,
        confidence: 90,
        impact: 'high',
        category: 'optimization',
        data: { recommendations: highROIRecommendations },
        actionable: true,
        relatedRecommendations: highROIRecommendations.map(r => r.id)
      });
    }

    // Pattern recognition insight
    const categoryPatterns = this.analyzeCategoryPatterns(recommendations);
    if (categoryPatterns.dominantCategory && categoryPatterns.concentration > 0.6) {
      insights.push({
        id: `pattern-insight-${Date.now()}`,
        timestamp: Date.now(),
        type: 'pattern',
        title: 'Optimization Pattern Detected',
        description: `${categoryPatterns.concentration * 100}% of issues are ${categoryPatterns.dominantCategory}-related`,
        confidence: 80,
        impact: 'medium',
        category: categoryPatterns.dominantCategory,
        data: { patterns: categoryPatterns },
        actionable: true,
        relatedRecommendations: recommendations
          .filter(r => r.category === categoryPatterns.dominantCategory)
          .map(r => r.id)
      });
    }

    // Performance prediction insight
    const performancePrediction = this.predictPerformanceTrend();
    if (performancePrediction.confidence > 70) {
      insights.push({
        id: `prediction-insight-${Date.now()}`,
        timestamp: Date.now(),
        type: 'prediction',
        title: 'Performance Trend Prediction',
        description: performancePrediction.description,
        confidence: performancePrediction.confidence,
        impact: performancePrediction.impact,
        category: 'prediction',
        data: { prediction: performancePrediction },
        actionable: performancePrediction.actionable,
        relatedRecommendations: []
      });
    }

    // Store insights
    insights.forEach(insight => {
      this.insights.set(insight.id, insight);
    });

    this.emit('insights-generated', insights);
    return insights;
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(period: string = '7d'): Promise<PerformanceReport> {
    const timestamp = Date.now();
    const recommendations = this.optimizationEngine.getRecommendations();
    const completedOptimizations = recommendations.filter(r => r.status === 'completed');

    const report: PerformanceReport = {
      id: `report-${timestamp}`,
      timestamp,
      period,
      summary: {
        totalOptimizations: recommendations.length,
        successfulOptimizations: completedOptimizations.length,
        averageImprovement: this.calculateAverageImprovement(completedOptimizations),
        totalROI: this.calculateTotalROI(completedOptimizations),
        costSavings: this.calculateCostSavings()
      },
      categoryBreakdown: this.generateCategoryBreakdown(recommendations),
      trendAnalysis: this.generateTrendAnalysis(),
      topRecommendations: recommendations
        .filter(r => r.status === 'pending')
        .sort((a, b) => b.roi - a.roi)
        .slice(0, 5),
      insights: Array.from(this.insights.values()).slice(0, 10),
      futureProjections: this.generateFutureProjections()
    };

    this.reports.set(report.id, report);
    this.emit('report-generated', report);
    return report;
  }

  /**
   * Get widget by ID
   */
  getWidget(widgetId: string): DashboardWidget | undefined {
    return this.widgets.get(widgetId);
  }

  /**
   * Get all alerts
   */
  getAlerts(includeAcknowledged: boolean = false): DashboardAlert[] {
    const alerts = Array.from(this.alerts.values());
    return includeAcknowledged ? alerts : alerts.filter(a => !a.acknowledged);
  }

  /**
   * Get insights by type
   */
  getInsights(type?: string): OptimizationInsight[] {
    const insights = Array.from(this.insights.values());
    return type ? insights.filter(i => i.type === type) : insights;
  }

  /**
   * Get performance reports
   */
  getReports(limit: number = 10): PerformanceReport[] {
    return Array.from(this.reports.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Setup event handlers for optimization engine
   */
  private setupEngineEventHandlers(): void {
    this.optimizationEngine.on('analysis-completed', (data) => {
      this.updatePerformanceMetrics(data);
      this.generateRealtimeInsights(data);
    });

    this.optimizationEngine.on('critical-issues-detected', (issues) => {
      issues.forEach((issue: OptimizationRecommendation) => {
        this.createAlert({
          severity: 'critical',
          title: 'Critical Performance Issue',
          message: issue.description,
          category: issue.category,
          autoResolve: false,
          metadata: { recommendationId: issue.id }
        });
      });
    });

    this.optimizationEngine.on('recommendation-applied', (data) => {
      this.createAlert({
        severity: 'info',
        title: 'Optimization Applied',
        message: `Successfully applied: ${data.recommendation.title}`,
        category: 'optimization',
        autoResolve: true,
        metadata: { recommendationId: data.recommendation.id }
      });
    });

    this.optimizationEngine.on('optimization-results-measured', (recommendation) => {
      if (recommendation.results?.success) {
        const improvement = recommendation.results.actualImprovement;
        this.createAlert({
          severity: 'info',
          title: 'Optimization Success',
          message: `${recommendation.title} achieved ${improvement.toFixed(1)}% improvement`,
          category: 'success',
          autoResolve: true,
          metadata: { recommendationId: recommendation.id, improvement }
        });
      }
    });
  }

  /**
   * Create default dashboard widgets
   */
  private async createDefaultWidgets(): Promise<void> {
    // Performance overview widget
    this.createWidget({
      id: 'performance-overview',
      title: 'Performance Overview',
      type: 'metric',
      size: 'large',
      priority: 1,
      refreshInterval: 30,
      data: this.getDashboardSummary()
    });

    // Recommendations widget
    this.createWidget({
      id: 'recommendations',
      title: 'Top Recommendations',
      type: 'table',
      size: 'large',
      priority: 2,
      refreshInterval: 60,
      data: {
        recommendations: this.optimizationEngine.getRecommendations()
          .filter(r => r.status === 'pending')
          .sort((a, b) => b.priority - a.priority)
          .slice(0, 5)
      }
    });

    // System health widget
    this.createWidget({
      id: 'system-health',
      title: 'System Health',
      type: 'heatmap',
      size: 'medium',
      priority: 3,
      refreshInterval: 45,
      data: {
        health: this.calculateSystemHealth(),
        components: ['search', 'database', 'cache', 'network', 'cpu', 'memory']
      }
    });

    // ROI tracking widget
    this.createWidget({
      id: 'roi-tracking',
      title: 'ROI Tracking',
      type: 'chart',
      size: 'medium',
      priority: 4,
      refreshInterval: 300, // 5 minutes
      data: {
        roi: this.calculateTotalROI(this.optimizationEngine.getRecommendations().filter(r => r.status === 'completed')),
        trend: 'improving'
      }
    });

    // Optimization velocity widget
    this.createWidget({
      id: 'optimization-velocity',
      title: 'Optimization Velocity',
      type: 'chart',
      size: 'small',
      priority: 5,
      refreshInterval: 180, // 3 minutes
      data: {
        velocity: this.calculateOptimizationVelocity(),
        target: 10 // Target optimizations per week
      }
    });

    // Alerts widget
    this.createWidget({
      id: 'active-alerts',
      title: 'Active Alerts',
      type: 'alert',
      size: 'medium',
      priority: 6,
      refreshInterval: 15,
      data: {
        alerts: this.getAlerts(false).slice(0, 5)
      }
    });
  }

  /**
   * Setup widget auto-refresh
   */
  private setupWidgetRefresh(widget: DashboardWidget): void {
    // Clear existing interval if any
    const existingInterval = this.updateIntervals.get(widget.id);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Set up new interval
    const interval = setInterval(async () => {
      await this.refreshWidget(widget.id);
    }, widget.refreshInterval * 1000);

    this.updateIntervals.set(widget.id, interval);
  }

  /**
   * Refresh widget data
   */
  private async refreshWidget(widgetId: string): Promise<void> {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;

    let newData: any = {};

    switch (widget.id) {
      case 'performance-overview':
        newData = this.getDashboardSummary();
        break;

      case 'recommendations':
        newData = {
          recommendations: this.optimizationEngine.getRecommendations()
            .filter(r => r.status === 'pending')
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 5)
        };
        break;

      case 'system-health':
        newData = {
          health: this.calculateSystemHealth(),
          components: ['search', 'database', 'cache', 'network', 'cpu', 'memory']
        };
        break;

      case 'roi-tracking':
        newData = {
          roi: this.calculateTotalROI(this.optimizationEngine.getRecommendations().filter(r => r.status === 'completed')),
          trend: 'improving'
        };
        break;

      case 'optimization-velocity':
        newData = {
          velocity: this.calculateOptimizationVelocity(),
          target: 10
        };
        break;

      case 'active-alerts':
        newData = {
          alerts: this.getAlerts(false).slice(0, 5)
        };
        break;

      default:
        // Custom widget refresh logic would go here
        break;
    }

    this.updateWidget(widgetId, newData);
  }

  /**
   * Calculate system health score
   */
  private calculateSystemHealth(): number {
    const recommendations = this.optimizationEngine.getRecommendations();
    const criticalIssues = recommendations.filter(r => r.impact === 'critical').length;
    const highIssues = recommendations.filter(r => r.impact === 'high').length;

    let healthScore = 100;

    // Deduct points for issues
    healthScore -= criticalIssues * 20;
    healthScore -= highIssues * 10;

    return Math.max(0, healthScore);
  }

  /**
   * Calculate optimization velocity (optimizations per week)
   */
  private calculateOptimizationVelocity(): number {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentOptimizations = this.optimizationEngine.getRecommendations()
      .filter(r => r.status === 'completed' && (r.appliedAt || 0) >= oneWeekAgo);

    return recentOptimizations.length;
  }

  /**
   * Calculate cost savings
   */
  private calculateCostSavings(): number {
    const completedOptimizations = this.optimizationEngine.getRecommendations()
      .filter(r => r.status === 'completed' && r.results?.success);

    // Simplified cost savings calculation
    return completedOptimizations.reduce((total, opt) => {
      const improvement = opt.results?.actualImprovement || 0;
      const estimatedSavings = improvement * 100; // $100 per 1% improvement (simplified)
      return total + estimatedSavings;
    }, 0);
  }

  /**
   * Calculate average improvement from completed optimizations
   */
  private calculateAverageImprovement(optimizations: OptimizationRecommendation[]): number {
    if (optimizations.length === 0) return 0;

    const totalImprovement = optimizations.reduce((sum, opt) => {
      return sum + (opt.results?.actualImprovement || 0);
    }, 0);

    return totalImprovement / optimizations.length;
  }

  /**
   * Calculate total ROI
   */
  private calculateTotalROI(optimizations: OptimizationRecommendation[]): number {
    if (optimizations.length === 0) return 0;

    return optimizations.reduce((sum, opt) => sum + opt.roi, 0) / optimizations.length;
  }

  /**
   * Generate category breakdown
   */
  private generateCategoryBreakdown(recommendations: OptimizationRecommendation[]): Record<string, any> {
    const breakdown: Record<string, any> = {};

    recommendations.forEach(rec => {
      if (!breakdown[rec.category]) {
        breakdown[rec.category] = {
          count: 0,
          completed: 0,
          avgROI: 0,
          totalROI: 0
        };
      }

      breakdown[rec.category].count++;
      breakdown[rec.category].totalROI += rec.roi;

      if (rec.status === 'completed') {
        breakdown[rec.category].completed++;
      }
    });

    // Calculate averages
    Object.keys(breakdown).forEach(category => {
      const data = breakdown[category];
      data.avgROI = data.totalROI / data.count;
      data.completionRate = data.completed / data.count;
    });

    return breakdown;
  }

  /**
   * Generate trend analysis
   */
  private generateTrendAnalysis(): any {
    const dashboardData = this.optimizationEngine.getDashboardData();
    const trends = dashboardData.metrics.trends || {};

    return {
      overall: Object.keys(trends).length > 0 ? 'stable' : 'unknown',
      categories: trends,
      improvementVelocity: this.calculateOptimizationVelocity(),
      projectedImpact: this.projectFutureImpact()
    };
  }

  /**
   * Generate future projections
   */
  private generateFutureProjections(): any {
    const currentVelocity = this.calculateOptimizationVelocity();
    const pendingRecommendations = this.optimizationEngine.getRecommendations()
      .filter(r => r.status === 'pending');

    const projectedCompletionWeeks = pendingRecommendations.length / Math.max(1, currentVelocity);
    const projectedROI = pendingRecommendations.reduce((sum, r) => sum + r.roi, 0);

    return {
      timeToComplete: `${Math.ceil(projectedCompletionWeeks)} weeks`,
      projectedROI: projectedROI / pendingRecommendations.length,
      potentialSavings: projectedROI * 50, // Simplified calculation
      riskFactors: this.identifyRiskFactors()
    };
  }

  /**
   * Analyze category patterns
   */
  private analyzeCategoryPatterns(recommendations: OptimizationRecommendation[]): any {
    const categoryCounts: Record<string, number> = {};

    recommendations.forEach(rec => {
      categoryCounts[rec.category] = (categoryCounts[rec.category] || 0) + 1;
    });

    const total = recommendations.length;
    const entries = Object.entries(categoryCounts);
    const dominantEntry = entries.sort((a, b) => b[1] - a[1])[0];

    return {
      categoryCounts,
      dominantCategory: dominantEntry ? dominantEntry[0] : null,
      concentration: dominantEntry ? dominantEntry[1] / total : 0,
      diversity: entries.length / total
    };
  }

  /**
   * Predict performance trend
   */
  private predictPerformanceTrend(): any {
    const healthScore = this.calculateSystemHealth();
    const velocity = this.calculateOptimizationVelocity();
    const pendingCritical = this.optimizationEngine.getRecommendations()
      .filter(r => r.impact === 'critical' && r.status === 'pending').length;

    let confidence = 70;
    let impact: 'low' | 'medium' | 'high' = 'medium';
    let description = 'Performance trend is stable';
    let actionable = false;

    if (healthScore < 70 && velocity < 5) {
      confidence = 85;
      impact = 'high';
      description = 'Performance degradation likely if optimizations are not accelerated';
      actionable = true;
    } else if (healthScore > 90 && velocity > 8) {
      confidence = 80;
      impact = 'low';
      description = 'Performance will continue to improve at current optimization rate';
      actionable = false;
    } else if (pendingCritical > 2) {
      confidence = 90;
      impact = 'high';
      description = 'Critical issues may cause significant performance degradation';
      actionable = true;
    }

    return {
      confidence,
      impact,
      description,
      actionable,
      healthScore,
      velocity,
      criticalIssues: pendingCritical
    };
  }

  /**
   * Project future impact
   */
  private projectFutureImpact(): number {
    const pendingRecommendations = this.optimizationEngine.getRecommendations()
      .filter(r => r.status === 'pending');

    const totalPotentialImprovement = pendingRecommendations.reduce((sum, rec) => {
      // Estimate improvement based on ROI and impact
      const impactMultiplier = { critical: 3, high: 2, medium: 1, low: 0.5 };
      return sum + (rec.roi * (impactMultiplier[rec.impact as keyof typeof impactMultiplier] || 1));
    }, 0);

    return totalPotentialImprovement / Math.max(1, pendingRecommendations.length);
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(): string[] {
    const risks: string[] = [];
    const recommendations = this.optimizationEngine.getRecommendations();

    const criticalCount = recommendations.filter(r => r.impact === 'critical').length;
    const highEffortCount = recommendations.filter(r => r.effort === 'high').length;
    const lowVelocity = this.calculateOptimizationVelocity() < 3;

    if (criticalCount > 3) {
      risks.push('Multiple critical issues requiring immediate attention');
    }

    if (highEffortCount > 5) {
      risks.push('High number of complex optimizations may slow progress');
    }

    if (lowVelocity) {
      risks.push('Low optimization velocity may lead to backlog buildup');
    }

    const healthScore = this.calculateSystemHealth();
    if (healthScore < 60) {
      risks.push('System health below acceptable threshold');
    }

    return risks;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(data: any): void {
    // Store metrics for historical analysis
    if (data.metrics) {
      Object.values(data.metrics).forEach((categoryMetrics: any) => {
        if (Array.isArray(categoryMetrics)) {
          this.metricsHistory.push(...categoryMetrics);
        }
      });

      // Keep only last 10,000 metrics
      if (this.metricsHistory.length > 10000) {
        this.metricsHistory = this.metricsHistory.slice(-10000);
      }
    }
  }

  /**
   * Generate real-time insights
   */
  private generateRealtimeInsights(data: any): void {
    // Generate insights based on new analysis data
    if (data.recommendations && data.recommendations.length > 0) {
      const criticalRecs = data.recommendations.filter((r: OptimizationRecommendation) => r.impact === 'critical');

      if (criticalRecs.length > 0) {
        this.insights.set(`realtime-critical-${Date.now()}`, {
          id: `realtime-critical-${Date.now()}`,
          timestamp: Date.now(),
          type: 'anomaly',
          title: 'Critical Issues Detected',
          description: `${criticalRecs.length} critical optimization opportunities identified`,
          confidence: 95,
          impact: 'critical',
          category: 'urgent',
          data: { recommendations: criticalRecs },
          actionable: true,
          relatedRecommendations: criticalRecs.map((r: OptimizationRecommendation) => r.id)
        });
      }
    }
  }

  /**
   * Start dashboard monitoring
   */
  private startDashboardMonitoring(): void {
    // Generate insights every 10 minutes
    setInterval(async () => {
      await this.generateInsights();
    }, 10 * 60 * 1000);

    // Clean up old insights every hour
    setInterval(() => {
      this.cleanupOldInsights();
    }, 60 * 60 * 1000);

    // Clean up old alerts every 24 hours
    setInterval(() => {
      this.cleanupOldAlerts();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Cleanup old insights
   */
  private cleanupOldInsights(): void {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    for (const [id, insight] of this.insights) {
      if (insight.timestamp < oneWeekAgo) {
        this.insights.delete(id);
      }
    }
  }

  /**
   * Cleanup old alerts
   */
  private cleanupOldAlerts(): void {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

    for (const [id, alert] of this.alerts) {
      if (alert.acknowledged && alert.timestamp < oneDayAgo) {
        this.alerts.delete(id);
      }
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    // Clear all intervals
    for (const interval of this.updateIntervals.values()) {
      clearInterval(interval);
    }

    this.widgets.clear();
    this.alerts.clear();
    this.insights.clear();
    this.reports.clear();
    this.updateIntervals.clear();
    this.metricsHistory.length = 0;

    console.log('OptimizationDashboard destroyed');
  }
}

export default OptimizationDashboard;