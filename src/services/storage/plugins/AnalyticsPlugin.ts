/**
 * Analytics Plugin (MVP5)
 * Provides comprehensive analytics, reporting, and business intelligence
 * 
 * This plugin enables advanced analytics, dashboards, and AI-powered insights
 * for executive reporting and strategic decision making.
 */

import { BaseStoragePlugin } from './BaseStoragePlugin';
import { IStorageAdapter } from '../adapters/IStorageAdapter';
import { PluginConfig } from '../IStorageService';

export interface AnalyticsReport {
  id: string;
  name: string;
  description: string;
  type: 'operational' | 'strategic' | 'tactical' | 'compliance';
  category: 'performance' | 'usage' | 'quality' | 'roi' | 'trends' | 'prediction';
  data: any;
  metadata: ReportMetadata;
  generated_at: Date;
  valid_until?: Date;
  chart_configs?: ChartConfig[];
  insights?: AnalyticsInsight[];
  recommendations?: string[];
}

export interface ReportMetadata {
  time_range: TimeRange;
  data_sources: string[];
  record_count: number;
  confidence_score: number;
  generation_time_ms: number;
  filters_applied: Record<string, any>;
  aggregation_level: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}

export interface TimeRange {
  start_date: Date;
  end_date: Date;
  period_type: 'custom' | 'last_7_days' | 'last_30_days' | 'last_quarter' | 'last_year';
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'heatmap' | 'gauge';
  title: string;
  x_axis: string;
  y_axis: string;
  data_series: DataSeries[];
  options: ChartOptions;
}

export interface DataSeries {
  name: string;
  data: Array<{ x: any; y: any; [key: string]: any }>;
  color?: string;
  type?: string;
}

export interface ChartOptions {
  show_legend: boolean;
  show_grid: boolean;
  animation: boolean;
  responsive: boolean;
  height?: number;
  width?: number;
  custom_options?: Record<string, any>;
}

export interface AnalyticsInsight {
  type: 'trend' | 'anomaly' | 'correlation' | 'prediction' | 'opportunity' | 'risk';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  data_points: any[];
  supporting_evidence: string[];
  suggested_actions: string[];
  business_value?: string;
}

export interface KPIMetric {
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trend_percentage: number;
  target?: number;
  threshold_warning?: number;
  threshold_critical?: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  category: string;
  description: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  type: 'executive' | 'operational' | 'technical' | 'custom';
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  refresh_interval_minutes: number;
  permissions: string[];
  created_at: Date;
  updated_at: Date;
}

export interface DashboardWidget {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'text' | 'alert' | 'trend';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  data_source: string;
  query: string;
  refresh_interval?: number;
  styling?: WidgetStyling;
}

export interface DashboardLayout {
  grid_size: { columns: number; rows: number };
  responsive: boolean;
  theme: 'light' | 'dark' | 'auto';
}

export interface WidgetStyling {
  background_color?: string;
  text_color?: string;
  border_color?: string;
  font_size?: string;
  padding?: string;
}

export interface PredictiveModel {
  id: string;
  name: string;
  type: 'regression' | 'classification' | 'time_series' | 'anomaly_detection';
  target_variable: string;
  features: string[];
  algorithm: string;
  accuracy: number;
  last_trained: Date;
  training_data_size: number;
  predictions: ModelPrediction[];
  status: 'training' | 'ready' | 'deprecated' | 'error';
}

export interface ModelPrediction {
  timestamp: Date;
  predicted_value: any;
  confidence: number;
  actual_value?: any;
  error?: number;
  features_used: Record<string, any>;
}

export interface AnalyticsConfig extends PluginConfig {
  reporting: {
    auto_generate_reports: boolean;
    report_retention_days: number;
    max_report_size_mb: number;
    enable_scheduled_reports: boolean;
    default_aggregation_level: 'daily' | 'weekly' | 'monthly';
  };
  dashboards: {
    enable_real_time_updates: boolean;
    cache_dashboard_data: boolean;
    max_widgets_per_dashboard: number;
    auto_refresh_interval_minutes: number;
  };
  ai_insights: {
    enable_trend_analysis: boolean;
    enable_anomaly_detection: boolean;
    enable_predictive_analytics: boolean;
    confidence_threshold: number;
    insight_retention_days: number;
  };
  performance: {
    enable_query_optimization: boolean;
    max_query_time_seconds: number;
    cache_results: boolean;
    parallel_processing: boolean;
  };
}

export class AnalyticsPlugin extends BaseStoragePlugin {
  private reports: Map<string, AnalyticsReport> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  private kpis: Map<string, KPIMetric> = new Map();
  private models: Map<string, PredictiveModel> = new Map();
  private reportCache: Map<string, any> = new Map();

  constructor(adapter: IStorageAdapter, config: AnalyticsConfig = {} as AnalyticsConfig) {
    super(adapter, config);
  }

  // ========================
  // Abstract Method Implementations
  // ========================

  getName(): string {
    return 'analytics';
  }

  getVersion(): string {
    return '5.0.0';
  }

  getDescription(): string {
    return 'Provides comprehensive analytics, reporting, and business intelligence';
  }

  getMVPVersion(): number {
    return 5;
  }

  getDependencies(): string[] {
    return ['full-text-search', 'raw-sql'];
  }

  protected getDefaultConfig(): AnalyticsConfig {
    return {
      enabled: true,
      reporting: {
        auto_generate_reports: true,
        report_retention_days: 90,
        max_report_size_mb: 50,
        enable_scheduled_reports: true,
        default_aggregation_level: 'daily'
      },
      dashboards: {
        enable_real_time_updates: true,
        cache_dashboard_data: true,
        max_widgets_per_dashboard: 20,
        auto_refresh_interval_minutes: 5
      },
      ai_insights: {
        enable_trend_analysis: true,
        enable_anomaly_detection: true,
        enable_predictive_analytics: false, // Requires ML service
        confidence_threshold: 75,
        insight_retention_days: 30
      },
      performance: {
        enable_query_optimization: true,
        max_query_time_seconds: 30,
        cache_results: true,
        parallel_processing: true
      }
    } as AnalyticsConfig;
  }

  protected async initializePlugin(): Promise<void> {
    // Create tables for analytics
    await this.createTables();
    
    // Load existing reports and dashboards
    await this.loadExistingData();
    
    // Create default dashboards
    await this.createDefaultDashboards();
    
    // Start scheduled report generation
    if ((this.config as AnalyticsConfig).reporting.auto_generate_reports) {
      await this.startScheduledReporting();
    }
    
    this.log('info', 'Analytics plugin initialized', {
      reports_loaded: this.reports.size,
      dashboards_loaded: this.dashboards.size,
      auto_reports: (this.config as AnalyticsConfig).reporting.auto_generate_reports
    });
  }

  protected async cleanupPlugin(): Promise<void> {
    // Save current state
    await this.persistData();
    
    // Clear caches
    this.reportCache.clear();
    
    this.log('info', 'Analytics plugin cleaned up');
  }

  async processData(data: any, context?: any): Promise<any> {
    const { action, payload } = data;

    switch (action) {
      case 'generate_report':
        return await this.generateReport(payload.type, payload.parameters);
      
      case 'get_report':
        return await this.getReport(payload.reportId);
      
      case 'list_reports':
        return await this.listReports(payload?.filters);
      
      case 'create_dashboard':
        return await this.createDashboard(payload);
      
      case 'get_dashboard':
        return await this.getDashboard(payload.dashboardId);
      
      case 'update_dashboard':
        return await this.updateDashboard(payload.dashboardId, payload.updates);
      
      case 'get_kpis':
        return await this.getKPIs(payload?.category);
      
      case 'calculate_roi':
        return await this.calculateROI(payload.timeRange);
      
      case 'trend_analysis':
        return await this.performTrendAnalysis(payload.metric, payload.timeRange);
      
      case 'anomaly_detection':
        return await this.detectAnomalies(payload.metric, payload.timeRange);
      
      case 'predictive_analysis':
        return await this.performPredictiveAnalysis(payload.target, payload.features);
      
      case 'executive_summary':
        return await this.generateExecutiveSummary(payload.timeRange);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // ========================
  // Report Generation
  // ========================

  async generateReport(type: string, parameters: any = {}): Promise<AnalyticsReport> {
    const startTime = Date.now();
    
    this.log('info', 'Generating analytics report', { type, parameters });
    
    let reportData: any;
    let insights: AnalyticsInsight[] = [];
    let chartConfigs: ChartConfig[] = [];
    
    switch (type) {
      case 'kb_usage':
        reportData = await this.generateKBUsageReport(parameters);
        chartConfigs = this.createKBUsageCharts(reportData);
        break;
      
      case 'incident_trends':
        reportData = await this.generateIncidentTrendsReport(parameters);
        chartConfigs = this.createIncidentTrendsCharts(reportData);
        insights = await this.analyzeIncidentTrends(reportData);
        break;
      
      case 'performance_metrics':
        reportData = await this.generatePerformanceReport(parameters);
        chartConfigs = this.createPerformanceCharts(reportData);
        break;
      
      case 'code_quality':
        reportData = await this.generateCodeQualityReport(parameters);
        chartConfigs = this.createCodeQualityCharts(reportData);
        insights = await this.analyzeCodeQuality(reportData);
        break;
      
      case 'template_usage':
        reportData = await this.generateTemplateUsageReport(parameters);
        chartConfigs = this.createTemplateUsageCharts(reportData);
        break;
      
      case 'roi_analysis':
        reportData = await this.generateROIReport(parameters);
        chartConfigs = this.createROICharts(reportData);
        insights = await this.analyzeROI(reportData);
        break;
      
      default:
        throw new Error(`Unknown report type: ${type}`);
    }
    
    const report: AnalyticsReport = {
      id: this.generateReportId(type),
      name: this.getReportName(type),
      description: this.getReportDescription(type),
      type: this.getReportType(type),
      category: this.getReportCategory(type),
      data: reportData,
      metadata: {
        time_range: parameters.timeRange || this.getDefaultTimeRange(),
        data_sources: this.getDataSources(type),
        record_count: this.getRecordCount(reportData),
        confidence_score: this.calculateConfidenceScore(reportData),
        generation_time_ms: Date.now() - startTime,
        filters_applied: parameters.filters || {},
        aggregation_level: parameters.aggregationLevel || 'daily'
      },
      generated_at: new Date(),
      chart_configs: chartConfigs,
      insights: insights,
      recommendations: await this.generateRecommendations(type, reportData, insights)
    };
    
    // Store report
    this.reports.set(report.id, report);
    await this.persistReport(report);
    
    this.emit('report-generated', { report });
    
    return report;
  }

  private async generateKBUsageReport(parameters: any): Promise<any> {
    const timeRange = parameters.timeRange || this.getDefaultTimeRange();
    
    // Get KB usage statistics
    const usageStats = await this.adapter.executeSQL(`
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as searches,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(results_count) as avg_results
      FROM search_history 
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY DATE(timestamp)
      ORDER BY date
    `, [timeRange.start_date.toISOString(), timeRange.end_date.toISOString()]);
    
    // Get top searched terms
    const topSearches = await this.adapter.executeSQL(`
      SELECT query, COUNT(*) as count
      FROM search_history
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY query
      ORDER BY count DESC
      LIMIT 20
    `, [timeRange.start_date.toISOString(), timeRange.end_date.toISOString()]);
    
    // Get most used entries
    const topEntries = await this.adapter.executeSQL(`
      SELECT e.title, e.category, e.usage_count, e.success_count, e.failure_count
      FROM kb_entries e
      ORDER BY e.usage_count DESC
      LIMIT 10
    `);
    
    // Get success rates by category
    const categoryStats = await this.adapter.executeSQL(`
      SELECT 
        category,
        COUNT(*) as total_entries,
        SUM(usage_count) as total_usage,
        AVG(CAST(success_count AS FLOAT) / NULLIF(success_count + failure_count, 0)) as success_rate
      FROM kb_entries
      GROUP BY category
      ORDER BY total_usage DESC
    `);
    
    return {
      usage_trends: usageStats,
      top_searches: topSearches,
      top_entries: topEntries,
      category_stats: categoryStats,
      summary: {
        total_searches: usageStats.reduce((sum: number, row: any) => sum + row.searches, 0),
        unique_users: await this.getUniqueUserCount(timeRange),
        avg_success_rate: this.calculateAverageSuccessRate(topEntries),
        most_popular_category: categoryStats[0]?.category || 'Unknown'
      }
    };
  }

  private async generateIncidentTrendsReport(parameters: any): Promise<any> {
    const timeRange = parameters.timeRange || this.getDefaultTimeRange();
    
    // Get incident trends from pattern detection plugin
    const incidentTrends = await this.adapter.executeSQL(`
      SELECT 
        DATE(timestamp) as date,
        severity,
        COUNT(*) as count,
        component
      FROM pattern_incidents
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY DATE(timestamp), severity, component
      ORDER BY date
    `, [timeRange.start_date.toISOString(), timeRange.end_date.toISOString()]);
    
    // Get pattern statistics
    const patternStats = await this.adapter.executeSQL(`
      SELECT 
        type,
        severity,
        COUNT(*) as pattern_count,
        AVG(confidence) as avg_confidence,
        AVG(frequency) as avg_frequency
      FROM detected_patterns
      WHERE created_at BETWEEN ? AND ?
      GROUP BY type, severity
      ORDER BY pattern_count DESC
    `, [timeRange.start_date.toISOString(), timeRange.end_date.toISOString()]);
    
    // Calculate MTTR (Mean Time To Resolution)
    const mttrStats = await this.adapter.executeSQL(`
      SELECT 
        component,
        AVG(resolution_time) as avg_resolution_time,
        COUNT(*) as incident_count
      FROM pattern_incidents
      WHERE resolution_time IS NOT NULL 
        AND timestamp BETWEEN ? AND ?
      GROUP BY component
      ORDER BY avg_resolution_time DESC
    `, [timeRange.start_date.toISOString(), timeRange.end_date.toISOString()]);
    
    return {
      incident_trends: incidentTrends,
      pattern_stats: patternStats,
      mttr_stats: mttrStats,
      summary: {
        total_incidents: incidentTrends.reduce((sum: number, row: any) => sum + row.count, 0),
        patterns_detected: patternStats.reduce((sum: number, row: any) => sum + row.pattern_count, 0),
        avg_mttr: mttrStats.reduce((sum: number, row: any) => sum + row.avg_resolution_time, 0) / Math.max(mttrStats.length, 1),
        most_problematic_component: mttrStats[0]?.component || 'Unknown'
      }
    };
  }

  private async generatePerformanceReport(parameters: any): Promise<any> {
    const timeRange = parameters.timeRange || this.getDefaultTimeRange();
    
    // Get search performance metrics
    const searchPerformance = await this.adapter.executeSQL(`
      SELECT 
        DATE(timestamp) as date,
        AVG(CASE WHEN results_count > 0 THEN 1.0 ELSE 2.0 END) as avg_response_time,
        COUNT(*) as total_searches,
        SUM(CASE WHEN results_count > 0 THEN 1 ELSE 0 END) as successful_searches
      FROM search_history
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY DATE(timestamp)
      ORDER BY date
    `, [timeRange.start_date.toISOString(), timeRange.end_date.toISOString()]);
    
    // Get system usage metrics
    const systemMetrics = await this.adapter.executeSQL(`
      SELECT 
        action,
        COUNT(*) as count,
        AVG(CASE WHEN action = 'view' THEN 1 ELSE 2 END) as avg_time
      FROM usage_metrics
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY action
    `, [timeRange.start_date.toISOString(), timeRange.end_date.toISOString()]);
    
    return {
      search_performance: searchPerformance,
      system_metrics: systemMetrics,
      summary: {
        avg_search_time: searchPerformance.reduce((sum: number, row: any) => sum + row.avg_response_time, 0) / Math.max(searchPerformance.length, 1),
        search_success_rate: this.calculateSearchSuccessRate(searchPerformance),
        total_operations: systemMetrics.reduce((sum: number, row: any) => sum + row.count, 0)
      }
    };
  }

  private async generateCodeQualityReport(parameters: any): Promise<any> {
    // Get code quality metrics from code analysis plugin
    const qualityMetrics = await this.adapter.executeSQL(`
      SELECT 
        type,
        AVG(CAST(JSON_EXTRACT(metrics, '$.complexity_score') AS FLOAT)) as avg_complexity,
        AVG(CAST(JSON_EXTRACT(metrics, '$.maintainability_index') AS FLOAT)) as avg_maintainability,
        COUNT(*) as file_count
      FROM code_files
      WHERE metrics IS NOT NULL
      GROUP BY type
    `);
    
    // Get issue distribution
    const issueStats = await this.adapter.executeSQL(`
      SELECT 
        JSON_EXTRACT(issue.value, '$.severity') as severity,
        JSON_EXTRACT(issue.value, '$.category') as category,
        COUNT(*) as count
      FROM code_files f,
           JSON_EACH(f.issues) as issue
      WHERE f.issues IS NOT NULL
      GROUP BY severity, category
      ORDER BY count DESC
    `);
    
    return {
      quality_metrics: qualityMetrics,
      issue_stats: issueStats,
      summary: {
        total_files: qualityMetrics.reduce((sum: number, row: any) => sum + row.file_count, 0),
        avg_complexity: qualityMetrics.reduce((sum: number, row: any) => sum + (row.avg_complexity || 0), 0) / Math.max(qualityMetrics.length, 1),
        total_issues: issueStats.reduce((sum: number, row: any) => sum + row.count, 0)
      }
    };
  }

  private async generateTemplateUsageReport(parameters: any): Promise<any> {
    // Get template usage from template engine plugin
    const templateStats = await this.adapter.executeSQL(`
      SELECT 
        category,
        type,
        COUNT(*) as template_count,
        SUM(usage_count) as total_usage,
        AVG(success_rate) as avg_success_rate,
        AVG(complexity_score) as avg_complexity
      FROM code_templates
      GROUP BY category, type
      ORDER BY total_usage DESC
    `);
    
    // Get generation statistics
    const generationStats = await this.adapter.executeSQL(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as generations,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_generations,
        AVG(generation_time_ms) as avg_generation_time
      FROM template_generations
      GROUP BY DATE(created_at)
      ORDER BY date
    `);
    
    return {
      template_stats: templateStats,
      generation_stats: generationStats,
      summary: {
        total_templates: templateStats.reduce((sum: number, row: any) => sum + row.template_count, 0),
        total_generations: generationStats.reduce((sum: number, row: any) => sum + row.generations, 0),
        avg_success_rate: templateStats.reduce((sum: number, row: any) => sum + (row.avg_success_rate || 0), 0) / Math.max(templateStats.length, 1)
      }
    };
  }

  private async generateROIReport(parameters: any): Promise<any> {
    const timeRange = parameters.timeRange || this.getDefaultTimeRange();
    
    // Calculate time savings from KB usage
    const kbSavings = await this.calculateKBTimeSavings(timeRange);
    
    // Calculate template productivity gains
    const templateSavings = await this.calculateTemplateSavings(timeRange);
    
    // Calculate incident prevention savings
    const preventionSavings = await this.calculatePreventionSavings(timeRange);
    
    const totalSavings = kbSavings + templateSavings + preventionSavings;
    const estimatedCost = 50000; // Estimated annual cost of platform
    const roi = totalSavings > 0 ? ((totalSavings - estimatedCost) / estimatedCost) * 100 : 0;
    
    return {
      kb_savings: kbSavings,
      template_savings: templateSavings,
      prevention_savings: preventionSavings,
      total_savings: totalSavings,
      estimated_cost: estimatedCost,
      roi_percentage: roi,
      payback_period_months: estimatedCost / Math.max(totalSavings / 12, 1),
      summary: {
        annual_savings: totalSavings,
        roi_percentage: roi,
        break_even: roi > 0
      }
    };
  }

  // ========================
  // Chart Generation
  // ========================

  private createKBUsageCharts(data: any): ChartConfig[] {
    return [
      {
        type: 'line',
        title: 'Knowledge Base Usage Trends',
        x_axis: 'date',
        y_axis: 'searches',
        data_series: [{
          name: 'Daily Searches',
          data: data.usage_trends.map((row: any) => ({ x: row.date, y: row.searches }))
        }],
        options: { show_legend: true, show_grid: true, animation: true, responsive: true }
      },
      {
        type: 'pie',
        title: 'Usage by Category',
        x_axis: 'category',
        y_axis: 'usage',
        data_series: [{
          name: 'Category Usage',
          data: data.category_stats.map((row: any) => ({ x: row.category, y: row.total_usage }))
        }],
        options: { show_legend: true, show_grid: false, animation: true, responsive: true }
      }
    ];
  }

  private createIncidentTrendsCharts(data: any): ChartConfig[] {
    return [
      {
        type: 'area',
        title: 'Incident Trends by Severity',
        x_axis: 'date',
        y_axis: 'count',
        data_series: this.groupIncidentsBySeverity(data.incident_trends),
        options: { show_legend: true, show_grid: true, animation: true, responsive: true }
      },
      {
        type: 'bar',
        title: 'Mean Time to Resolution by Component',
        x_axis: 'component',
        y_axis: 'mttr',
        data_series: [{
          name: 'MTTR (hours)',
          data: data.mttr_stats.map((row: any) => ({ x: row.component, y: row.avg_resolution_time }))
        }],
        options: { show_legend: false, show_grid: true, animation: true, responsive: true }
      }
    ];
  }

  private createPerformanceCharts(data: any): ChartConfig[] {
    return [
      {
        type: 'line',
        title: 'Search Performance Over Time',
        x_axis: 'date',
        y_axis: 'response_time',
        data_series: [{
          name: 'Avg Response Time',
          data: data.search_performance.map((row: any) => ({ x: row.date, y: row.avg_response_time }))
        }],
        options: { show_legend: true, show_grid: true, animation: true, responsive: true }
      }
    ];
  }

  private createCodeQualityCharts(data: any): ChartConfig[] {
    return [
      {
        type: 'scatter',
        title: 'Code Complexity vs Maintainability',
        x_axis: 'complexity',
        y_axis: 'maintainability',
        data_series: [{
          name: 'Code Files',
          data: data.quality_metrics.map((row: any) => ({ 
            x: row.avg_complexity, 
            y: row.avg_maintainability,
            type: row.type
          }))
        }],
        options: { show_legend: true, show_grid: true, animation: true, responsive: true }
      }
    ];
  }

  private createTemplateUsageCharts(data: any): ChartConfig[] {
    return [
      {
        type: 'bar',
        title: 'Template Usage by Category',
        x_axis: 'category',
        y_axis: 'usage',
        data_series: [{
          name: 'Total Usage',
          data: data.template_stats.map((row: any) => ({ x: row.category, y: row.total_usage }))
        }],
        options: { show_legend: false, show_grid: true, animation: true, responsive: true }
      }
    ];
  }

  private createROICharts(data: any): ChartConfig[] {
    return [
      {
        type: 'gauge',
        title: 'Return on Investment',
        x_axis: 'metric',
        y_axis: 'value',
        data_series: [{
          name: 'ROI %',
          data: [{ x: 'ROI', y: data.roi_percentage }]
        }],
        options: { 
          show_legend: false, 
          show_grid: false, 
          animation: true, 
          responsive: true,
          custom_options: { min: -100, max: 500, target: 100 }
        }
      }
    ];
  }

  // ========================
  // AI Insights Generation
  // ========================

  private async analyzeIncidentTrends(data: any): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];
    
    // Trend analysis
    const recentIncidents = data.incident_trends.slice(-7); // Last 7 days
    const trend = this.calculateTrend(recentIncidents.map((r: any) => r.count));
    
    if (trend > 0.1) {
      insights.push({
        type: 'trend',
        title: 'Increasing Incident Trend',
        description: `Incidents have increased by ${(trend * 100).toFixed(1)}% over the last week`,
        confidence: 85,
        impact: trend > 0.3 ? 'high' : 'medium',
        data_points: recentIncidents,
        supporting_evidence: [
          `${recentIncidents.length} days of data analyzed`,
          `Trend coefficient: ${trend.toFixed(3)}`
        ],
        suggested_actions: [
          'Review recent system changes',
          'Check for resource constraints',
          'Increase monitoring frequency'
        ]
      });
    }
    
    // Component analysis
    const problematicComponents = data.mttr_stats.filter((c: any) => c.avg_resolution_time > 2);
    if (problematicComponents.length > 0) {
      insights.push({
        type: 'risk',
        title: 'Components with High Resolution Time',
        description: `${problematicComponents.length} components have MTTR > 2 hours`,
        confidence: 90,
        impact: 'high',
        data_points: problematicComponents,
        supporting_evidence: [
          `Highest MTTR: ${problematicComponents[0]?.avg_resolution_time.toFixed(1)} hours`,
          `Component: ${problematicComponents[0]?.component}`
        ],
        suggested_actions: [
          'Review component documentation',
          'Provide additional training',
          'Consider automation opportunities'
        ]
      });
    }
    
    return insights;
  }

  private async analyzeCodeQuality(data: any): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];
    
    // Complexity analysis
    const highComplexityFiles = data.quality_metrics.filter((f: any) => f.avg_complexity > 15);
    if (highComplexityFiles.length > 0) {
      insights.push({
        type: 'opportunity',
        title: 'High Complexity Code Detected',
        description: `${highComplexityFiles.length} file types have high complexity scores`,
        confidence: 95,
        impact: 'medium',
        data_points: highComplexityFiles,
        supporting_evidence: [
          `Average complexity: ${(highComplexityFiles.reduce((sum: number, f: any) => sum + f.avg_complexity, 0) / highComplexityFiles.length).toFixed(1)}`,
          'Complexity threshold: 15'
        ],
        suggested_actions: [
          'Refactor complex modules',
          'Implement code review guidelines',
          'Consider modularization'
        ],
        business_value: 'Improved maintainability and reduced technical debt'
      });
    }
    
    return insights;
  }

  private async analyzeROI(data: any): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];
    
    if (data.roi_percentage > 100) {
      insights.push({
        type: 'opportunity',
        title: 'Strong ROI Performance',
        description: `Platform delivers ${data.roi_percentage.toFixed(1)}% ROI`,
        confidence: 80,
        impact: 'high',
        data_points: [data],
        supporting_evidence: [
          `Annual savings: $${data.total_savings.toLocaleString()}`,
          `Investment cost: $${data.estimated_cost.toLocaleString()}`,
          `Payback period: ${data.payback_period_months.toFixed(1)} months`
        ],
        suggested_actions: [
          'Expand platform usage',
          'Invest in additional features',
          'Document success stories'
        ],
        business_value: `$${(data.total_savings - data.estimated_cost).toLocaleString()} net annual benefit`
      });
    }
    
    return insights;
  }

  // ========================
  // KPI Calculation
  // ========================

  async getKPIs(category?: string): Promise<KPIMetric[]> {
    const kpis: KPIMetric[] = [];
    
    // Knowledge Base KPIs
    if (!category || category === 'knowledge') {
      kpis.push(await this.calculateKBUsageKPI());
      kpis.push(await this.calculateKBSuccessRateKPI());
    }
    
    // Performance KPIs
    if (!category || category === 'performance') {
      kpis.push(await this.calculateSearchPerformanceKPI());
      kpis.push(await this.calculateMTTRKPI());
    }
    
    // Quality KPIs
    if (!category || category === 'quality') {
      kpis.push(await this.calculateCodeQualityKPI());
      kpis.push(await this.calculateIssueResolutionKPI());
    }
    
    // Business KPIs
    if (!category || category === 'business') {
      kpis.push(await this.calculateROIKPI());
      kpis.push(await this.calculateUserAdoptionKPI());
    }
    
    return kpis;
  }

  private async calculateKBUsageKPI(): Promise<KPIMetric> {
    const current = await this.adapter.executeSQL(`
      SELECT COUNT(*) as count FROM search_history 
      WHERE timestamp >= datetime('now', '-30 days')
    `);
    
    const previous = await this.adapter.executeSQL(`
      SELECT COUNT(*) as count FROM search_history 
      WHERE timestamp >= datetime('now', '-60 days') 
        AND timestamp < datetime('now', '-30 days')
    `);
    
    const currentValue = current[0]?.count || 0;
    const previousValue = previous[0]?.count || 0;
    const trend = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
    
    return {
      name: 'Knowledge Base Usage',
      value: currentValue,
      unit: 'searches/month',
      trend: trend > 5 ? 'up' : trend < -5 ? 'down' : 'stable',
      trend_percentage: Math.abs(trend),
      target: 1000,
      status: currentValue >= 1000 ? 'excellent' : currentValue >= 500 ? 'good' : 'warning',
      category: 'knowledge',
      description: 'Number of knowledge base searches per month'
    };
  }

  private async calculateKBSuccessRateKPI(): Promise<KPIMetric> {
    const stats = await this.adapter.executeSQL(`
      SELECT 
        SUM(success_count) as total_success,
        SUM(success_count + failure_count) as total_ratings
      FROM kb_entries
    `);
    
    const successRate = stats[0]?.total_ratings > 0 
      ? (stats[0].total_success / stats[0].total_ratings) * 100 
      : 0;
    
    return {
      name: 'KB Success Rate',
      value: successRate,
      unit: '%',
      trend: 'stable', // Would need historical data for trend
      trend_percentage: 0,
      target: 80,
      threshold_warning: 70,
      threshold_critical: 60,
      status: successRate >= 80 ? 'excellent' : successRate >= 70 ? 'good' : successRate >= 60 ? 'warning' : 'critical',
      category: 'knowledge',
      description: 'Percentage of successful knowledge base resolutions'
    };
  }

  private async calculateSearchPerformanceKPI(): Promise<KPIMetric> {
    const avgTime = await this.adapter.executeSQL(`
      SELECT AVG(1.0) as avg_time FROM search_history 
      WHERE timestamp >= datetime('now', '-7 days')
    `);
    
    const responseTime = avgTime[0]?.avg_time || 1.0;
    
    return {
      name: 'Search Response Time',
      value: responseTime,
      unit: 'seconds',
      trend: 'stable',
      trend_percentage: 0,
      target: 1.0,
      threshold_warning: 2.0,
      threshold_critical: 3.0,
      status: responseTime <= 1.0 ? 'excellent' : responseTime <= 2.0 ? 'good' : responseTime <= 3.0 ? 'warning' : 'critical',
      category: 'performance',
      description: 'Average search response time'
    };
  }

  private async calculateMTTRKPI(): Promise<KPIMetric> {
    const mttr = await this.adapter.executeSQL(`
      SELECT AVG(resolution_time) as avg_mttr
      FROM pattern_incidents
      WHERE resolution_time IS NOT NULL
        AND timestamp >= datetime('now', '-30 days')
    `);
    
    const avgMTTR = mttr[0]?.avg_mttr || 0;
    
    return {
      name: 'Mean Time to Resolution',
      value: avgMTTR,
      unit: 'hours',
      trend: 'stable',
      trend_percentage: 0,
      target: 2.0,
      threshold_warning: 4.0,
      threshold_critical: 8.0,
      status: avgMTTR <= 2.0 ? 'excellent' : avgMTTR <= 4.0 ? 'good' : avgMTTR <= 8.0 ? 'warning' : 'critical',
      category: 'performance',
      description: 'Average time to resolve incidents'
    };
  }

  private async calculateCodeQualityKPI(): Promise<KPIMetric> {
    const quality = await this.adapter.executeSQL(`
      SELECT AVG(CAST(JSON_EXTRACT(metrics, '$.maintainability_index') AS FLOAT)) as avg_quality
      FROM code_files
      WHERE metrics IS NOT NULL
    `);
    
    const qualityIndex = quality[0]?.avg_quality || 50;
    
    return {
      name: 'Code Maintainability Index',
      value: qualityIndex,
      unit: 'points',
      trend: 'stable',
      trend_percentage: 0,
      target: 70,
      threshold_warning: 50,
      threshold_critical: 30,
      status: qualityIndex >= 70 ? 'excellent' : qualityIndex >= 50 ? 'good' : qualityIndex >= 30 ? 'warning' : 'critical',
      category: 'quality',
      description: 'Average code maintainability index'
    };
  }

  private async calculateIssueResolutionKPI(): Promise<KPIMetric> {
    // Placeholder - would need issue tracking integration
    return {
      name: 'Issue Resolution Rate',
      value: 85,
      unit: '%',
      trend: 'up',
      trend_percentage: 5,
      target: 90,
      status: 'good',
      category: 'quality',
      description: 'Percentage of issues resolved within SLA'
    };
  }

  private async calculateROIKPI(): Promise<KPIMetric> {
    const roiData = await this.generateROIReport({});
    
    return {
      name: 'Return on Investment',
      value: roiData.roi_percentage,
      unit: '%',
      trend: roiData.roi_percentage > 100 ? 'up' : 'down',
      trend_percentage: Math.abs(roiData.roi_percentage - 100),
      target: 100,
      status: roiData.roi_percentage >= 200 ? 'excellent' : roiData.roi_percentage >= 100 ? 'good' : roiData.roi_percentage >= 50 ? 'warning' : 'critical',
      category: 'business',
      description: 'Platform return on investment percentage'
    };
  }

  private async calculateUserAdoptionKPI(): Promise<KPIMetric> {
    const activeUsers = await this.adapter.executeSQL(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM search_history
      WHERE timestamp >= datetime('now', '-30 days')
    `);
    
    const userCount = activeUsers[0]?.count || 0;
    
    return {
      name: 'Monthly Active Users',
      value: userCount,
      unit: 'users',
      trend: 'stable',
      trend_percentage: 0,
      target: 50,
      status: userCount >= 50 ? 'excellent' : userCount >= 25 ? 'good' : userCount >= 10 ? 'warning' : 'critical',
      category: 'business',
      description: 'Number of active users per month'
    };
  }

  // ========================
  // Advanced Analytics
  // ========================

  async calculateROI(timeRange: TimeRange): Promise<any> {
    return await this.generateROIReport({ timeRange });
  }

  async performTrendAnalysis(metric: string, timeRange: TimeRange): Promise<AnalyticsInsight[]> {
    // Get time series data for the metric
    const data = await this.getMetricTimeSeries(metric, timeRange);
    
    // Calculate trend
    const trend = this.calculateTrend(data.map(d => d.value));
    const seasonality = this.detectSeasonality(data);
    
    const insights: AnalyticsInsight[] = [];
    
    if (Math.abs(trend) > 0.1) {
      insights.push({
        type: 'trend',
        title: `${trend > 0 ? 'Increasing' : 'Decreasing'} Trend in ${metric}`,
        description: `${metric} shows a ${Math.abs(trend * 100).toFixed(1)}% ${trend > 0 ? 'increase' : 'decrease'} trend`,
        confidence: 80,
        impact: Math.abs(trend) > 0.3 ? 'high' : 'medium',
        data_points: data,
        supporting_evidence: [`Trend coefficient: ${trend.toFixed(3)}`],
        suggested_actions: trend > 0 ? ['Monitor for acceleration', 'Plan for scaling'] : ['Investigate causes', 'Implement improvements']
      });
    }
    
    if (seasonality.detected) {
      insights.push({
        type: 'trend',
        title: `Seasonal Pattern Detected in ${metric}`,
        description: `${metric} shows seasonal variation with ${seasonality.period} period`,
        confidence: seasonality.confidence,
        impact: 'medium',
        data_points: data,
        supporting_evidence: [`Seasonality period: ${seasonality.period}`, `Strength: ${seasonality.strength.toFixed(2)}`],
        suggested_actions: ['Plan for seasonal variations', 'Adjust resources accordingly']
      });
    }
    
    return insights;
  }

  async detectAnomalies(metric: string, timeRange: TimeRange): Promise<AnalyticsInsight[]> {
    const data = await this.getMetricTimeSeries(metric, timeRange);
    const anomalies = this.detectStatisticalAnomalies(data);
    
    const insights: AnalyticsInsight[] = [];
    
    for (const anomaly of anomalies) {
      insights.push({
        type: 'anomaly',
        title: `Anomaly Detected in ${metric}`,
        description: `Unusual ${anomaly.type} detected on ${anomaly.date}`,
        confidence: anomaly.confidence,
        impact: anomaly.severity === 'high' ? 'high' : 'medium',
        data_points: [anomaly],
        supporting_evidence: [
          `Value: ${anomaly.value}`,
          `Expected range: ${anomaly.expected_min} - ${anomaly.expected_max}`,
          `Deviation: ${anomaly.deviation.toFixed(2)} standard deviations`
        ],
        suggested_actions: ['Investigate root cause', 'Check for system issues', 'Review recent changes']
      });
    }
    
    return insights;
  }

  async performPredictiveAnalysis(target: string, features: string[]): Promise<any> {
    // This would integrate with a proper ML service
    // For now, return a simplified prediction based on trends
    
    const historicalData = await this.getMetricTimeSeries(target, {
      start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      end_date: new Date(),
      period_type: 'last_30_days'
    });
    
    const trend = this.calculateTrend(historicalData.map(d => d.value));
    const lastValue = historicalData[historicalData.length - 1]?.value || 0;
    
    // Simple linear projection
    const predictions = [];
    for (let i = 1; i <= 30; i++) {
      const predictedValue = lastValue + (trend * lastValue * i);
      predictions.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        predicted_value: predictedValue,
        confidence: Math.max(0.5, 0.9 - (i * 0.02)) // Decreasing confidence over time
      });
    }
    
    return {
      target_metric: target,
      features_used: features,
      historical_data: historicalData,
      predictions: predictions,
      model_info: {
        type: 'linear_trend',
        accuracy: 0.75,
        trained_on: historicalData.length
      }
    };
  }

  async generateExecutiveSummary(timeRange: TimeRange): Promise<any> {
    // Generate comprehensive executive summary
    const kbUsage = await this.generateKBUsageReport({ timeRange });
    const incidents = await this.generateIncidentTrendsReport({ timeRange });
    const performance = await this.generatePerformanceReport({ timeRange });
    const roi = await this.generateROIReport({ timeRange });
    const kpis = await this.getKPIs();
    
    const criticalKPIs = kpis.filter(kpi => kpi.status === 'critical');
    const excellentKPIs = kpis.filter(kpi => kpi.status === 'excellent');
    
    return {
      period: timeRange,
      executive_highlights: [
        `${kbUsage.summary.total_searches} knowledge base searches conducted`,
        `${incidents.summary.total_incidents} incidents processed`,
        `${roi.roi_percentage.toFixed(1)}% return on investment achieved`,
        `${kpis.length} KPIs tracked with ${excellentKPIs.length} excellent ratings`
      ],
      key_achievements: [
        roi.roi_percentage > 100 ? 'Platform ROI exceeds target' : null,
        kbUsage.summary.avg_success_rate > 80 ? 'High knowledge base success rate' : null,
        performance.summary.avg_search_time < 2 ? 'Excellent search performance' : null
      ].filter(Boolean),
      areas_of_concern: [
        criticalKPIs.length > 0 ? `${criticalKPIs.length} KPIs require immediate attention` : null,
        incidents.summary.avg_mttr > 4 ? 'Mean time to resolution above target' : null
      ].filter(Boolean),
      recommendations: [
        'Continue knowledge base expansion',
        'Invest in automation capabilities',
        'Enhance user training programs'
      ],
      next_steps: [
        'Review critical KPIs with stakeholders',
        'Plan Q2 feature roadmap',
        'Schedule stakeholder review meeting'
      ]
    };
  }

  // ========================
  // Helper Methods
  // ========================

  private getDefaultTimeRange(): TimeRange {
    return {
      start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end_date: new Date(),
      period_type: 'last_30_days'
    };
  }

  private getReportName(type: string): string {
    const names = {
      'kb_usage': 'Knowledge Base Usage Report',
      'incident_trends': 'Incident Trends Analysis',
      'performance_metrics': 'System Performance Report',
      'code_quality': 'Code Quality Assessment',
      'template_usage': 'Template Usage Statistics',
      'roi_analysis': 'Return on Investment Analysis'
    };
    return names[type] || 'Analytics Report';
  }

  private getReportDescription(type: string): string {
    const descriptions = {
      'kb_usage': 'Comprehensive analysis of knowledge base usage patterns and effectiveness',
      'incident_trends': 'Analysis of incident patterns, trends, and resolution metrics',
      'performance_metrics': 'System performance and response time analysis',
      'code_quality': 'Code quality metrics and improvement recommendations',
      'template_usage': 'Template library usage and effectiveness analysis',
      'roi_analysis': 'Financial analysis of platform return on investment'
    };
    return descriptions[type] || 'Detailed analytics report';
  }

  private getReportType(type: string): AnalyticsReport['type'] {
    const operationalTypes = ['kb_usage', 'performance_metrics'];
    const strategicTypes = ['roi_analysis'];
    
    if (operationalTypes.includes(type)) return 'operational';
    if (strategicTypes.includes(type)) return 'strategic';
    return 'tactical';
  }

  private getReportCategory(type: string): AnalyticsReport['category'] {
    const categories = {
      'kb_usage': 'usage',
      'incident_trends': 'trends',
      'performance_metrics': 'performance',
      'code_quality': 'quality',
      'template_usage': 'usage',
      'roi_analysis': 'roi'
    };
    return categories[type] || 'performance';
  }

  private getDataSources(type: string): string[] {
    const sources = {
      'kb_usage': ['kb_entries', 'search_history', 'usage_metrics'],
      'incident_trends': ['pattern_incidents', 'detected_patterns'],
      'performance_metrics': ['search_history', 'usage_metrics'],
      'code_quality': ['code_files', 'kb_code_links'],
      'template_usage': ['code_templates', 'template_generations'],
      'roi_analysis': ['all_tables']
    };
    return sources[type] || ['unknown'];
  }

  private getRecordCount(data: any): number {
    if (Array.isArray(data)) return data.length;
    
    let count = 0;
    for (const key in data) {
      if (Array.isArray(data[key])) {
        count += data[key].length;
      }
    }
    return count;
  }

  private calculateConfidenceScore(data: any): number {
    // Simple confidence based on data availability
    const recordCount = this.getRecordCount(data);
    if (recordCount > 100) return 95;
    if (recordCount > 50) return 85;
    if (recordCount > 10) return 75;
    return 60;
  }

  private async generateRecommendations(type: string, data: any, insights: AnalyticsInsight[]): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Add insight-based recommendations
    insights.forEach(insight => {
      recommendations.push(...insight.suggested_actions);
    });
    
    // Add type-specific recommendations
    switch (type) {
      case 'kb_usage':
        if (data.summary.avg_success_rate < 80) {
          recommendations.push('Review and improve low-performing KB entries');
        }
        break;
      
      case 'incident_trends':
        if (data.summary.avg_mttr > 4) {
          recommendations.push('Implement automation for common incident types');
        }
        break;
      
      case 'roi_analysis':
        if (data.roi_percentage > 200) {
          recommendations.push('Consider expanding platform capabilities');
        }
        break;
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + (i * val), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const mean = sumY / n;
    
    return mean !== 0 ? slope / mean : 0; // Normalized slope
  }

  private detectSeasonality(data: any[]): { detected: boolean; period: string; confidence: number; strength: number } {
    // Simplified seasonality detection
    if (data.length < 14) {
      return { detected: false, period: 'none', confidence: 0, strength: 0 };
    }
    
    // Check for weekly patterns (every 7 data points)
    const weeklyCorr = this.calculateAutocorrelation(data.map(d => d.value), 7);
    
    if (weeklyCorr > 0.5) {
      return {
        detected: true,
        period: 'weekly',
        confidence: Math.min(95, weeklyCorr * 100),
        strength: weeklyCorr
      };
    }
    
    return { detected: false, period: 'none', confidence: 0, strength: 0 };
  }

  private calculateAutocorrelation(series: number[], lag: number): number {
    if (series.length <= lag) return 0;
    
    const n = series.length - lag;
    const mean = series.reduce((sum, val) => sum + val, 0) / series.length;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (series[i] - mean) * (series[i + lag] - mean);
    }
    
    for (let i = 0; i < series.length; i++) {
      denominator += (series[i] - mean) ** 2;
    }
    
    return denominator !== 0 ? numerator / denominator : 0;
  }

  private detectStatisticalAnomalies(data: any[]): any[] {
    const values = data.map(d => d.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const anomalies = [];
    
    for (let i = 0; i < data.length; i++) {
      const value = values[i];
      const deviation = Math.abs(value - mean) / stdDev;
      
      if (deviation > 2) { // 2 standard deviations
        anomalies.push({
          date: data[i].date,
          value: value,
          expected_min: mean - 2 * stdDev,
          expected_max: mean + 2 * stdDev,
          deviation: deviation,
          type: value > mean ? 'spike' : 'dip',
          severity: deviation > 3 ? 'high' : 'medium',
          confidence: Math.min(95, deviation * 30)
        });
      }
    }
    
    return anomalies;
  }

  private async getMetricTimeSeries(metric: string, timeRange: TimeRange): Promise<any[]> {
    // This would fetch actual time series data based on the metric
    // For now, return mock data
    const days = Math.floor((timeRange.end_date.getTime() - timeRange.start_date.getTime()) / (24 * 60 * 60 * 1000));
    const data = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(timeRange.start_date.getTime() + i * 24 * 60 * 60 * 1000);
      const value = 100 + Math.sin(i * 0.1) * 20 + Math.random() * 10; // Mock trending data
      data.push({ date, value });
    }
    
    return data;
  }

  private groupIncidentsBySeverity(incidents: any[]): DataSeries[] {
    const severityGroups = new Map<string, any[]>();
    
    incidents.forEach(incident => {
      if (!severityGroups.has(incident.severity)) {
        severityGroups.set(incident.severity, []);
      }
      severityGroups.get(incident.severity)!.push({ x: incident.date, y: incident.count });
    });
    
    return Array.from(severityGroups.entries()).map(([severity, data]) => ({
      name: severity,
      data: data
    }));
  }

  private async getUniqueUserCount(timeRange: TimeRange): Promise<number> {
    const result = await this.adapter.executeSQL(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM search_history
      WHERE timestamp BETWEEN ? AND ?
    `, [timeRange.start_date.toISOString(), timeRange.end_date.toISOString()]);
    
    return result[0]?.count || 0;
  }

  private calculateAverageSuccessRate(entries: any[]): number {
    const totalRated = entries.filter(e => (e.success_count + e.failure_count) > 0);
    if (totalRated.length === 0) return 0;
    
    const totalSuccess = totalRated.reduce((sum, e) => sum + e.success_count, 0);
    const totalRatings = totalRated.reduce((sum, e) => sum + e.success_count + e.failure_count, 0);
    
    return totalRatings > 0 ? (totalSuccess / totalRatings) * 100 : 0;
  }

  private calculateSearchSuccessRate(performance: any[]): number {
    const totalSearches = performance.reduce((sum, p) => sum + p.total_searches, 0);
    const successfulSearches = performance.reduce((sum, p) => sum + p.successful_searches, 0);
    
    return totalSearches > 0 ? (successfulSearches / totalSearches) * 100 : 0;
  }

  private async calculateKBTimeSavings(timeRange: TimeRange): Promise<number> {
    const searches = await this.adapter.executeSQL(`
      SELECT COUNT(*) as count FROM search_history
      WHERE timestamp BETWEEN ? AND ?
        AND results_count > 0
    `, [timeRange.start_date.toISOString(), timeRange.end_date.toISOString()]);
    
    const successfulSearches = searches[0]?.count || 0;
    return successfulSearches * 0.5 * 50; // 30 min saved per search * $50/hour
  }

  private async calculateTemplateSavings(timeRange: TimeRange): Promise<number> {
    const generations = await this.adapter.executeSQL(`
      SELECT COUNT(*) as count FROM template_generations
      WHERE created_at BETWEEN ? AND ?
        AND success = 1
    `, [timeRange.start_date.toISOString(), timeRange.end_date.toISOString()]);
    
    const successfulGenerations = generations[0]?.count || 0;
    return successfulGenerations * 2 * 50; // 2 hours saved per generation * $50/hour
  }

  private async calculatePreventionSavings(timeRange: TimeRange): Promise<number> {
    const patterns = await this.adapter.executeSQL(`
      SELECT COUNT(*) as count FROM detected_patterns
      WHERE created_at BETWEEN ? AND ?
        AND severity IN ('critical', 'high')
    `, [timeRange.start_date.toISOString(), timeRange.end_date.toISOString()]);
    
    const criticalPatterns = patterns[0]?.count || 0;
    return criticalPatterns * 8 * 50; // 8 hours saved per prevented incident * $50/hour
  }

  private generateReportId(type: string): string {
    return `report-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========================
  // Database Operations
  // ========================

  private async createTables(): Promise<void> {
    const createReportsTable = `
      CREATE TABLE IF NOT EXISTS analytics_reports (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        data TEXT NOT NULL, -- JSON
        metadata TEXT NOT NULL, -- JSON
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        valid_until DATETIME,
        chart_configs TEXT, -- JSON
        insights TEXT, -- JSON
        recommendations TEXT -- JSON
      )
    `;
    
    const createDashboardsTable = `
      CREATE TABLE IF NOT EXISTS dashboards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        widgets TEXT NOT NULL, -- JSON
        layout TEXT NOT NULL, -- JSON
        refresh_interval_minutes INTEGER,
        permissions TEXT, -- JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    const createKPIsTable = `
      CREATE TABLE IF NOT EXISTS kpi_history (
        id TEXT PRIMARY KEY,
        kpi_name TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT,
        status TEXT,
        category TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_reports_type ON analytics_reports(type);
      CREATE INDEX IF NOT EXISTS idx_reports_generated ON analytics_reports(generated_at);
      CREATE INDEX IF NOT EXISTS idx_dashboards_type ON dashboards(type);
      CREATE INDEX IF NOT EXISTS idx_kpi_name_timestamp ON kpi_history(kpi_name, timestamp);
    `;
    
    await this.adapter.executeSQL(createReportsTable);
    await this.adapter.executeSQL(createDashboardsTable);
    await this.adapter.executeSQL(createKPIsTable);
    await this.adapter.executeSQL(createIndexes);
  }

  private async loadExistingData(): Promise<void> {
    // Load reports
    const reports = await this.adapter.executeSQL('SELECT * FROM analytics_reports ORDER BY generated_at DESC LIMIT 100');
    reports.forEach((row: any) => {
      const report: AnalyticsReport = {
        id: row.id,
        name: row.name,
        description: '',
        type: row.type,
        category: row.category,
        data: JSON.parse(row.data),
        metadata: JSON.parse(row.metadata),
        generated_at: new Date(row.generated_at),
        valid_until: row.valid_until ? new Date(row.valid_until) : undefined,
        chart_configs: row.chart_configs ? JSON.parse(row.chart_configs) : [],
        insights: row.insights ? JSON.parse(row.insights) : [],
        recommendations: row.recommendations ? JSON.parse(row.recommendations) : []
      };
      this.reports.set(report.id, report);
    });
    
    // Load dashboards
    const dashboards = await this.adapter.executeSQL('SELECT * FROM dashboards ORDER BY created_at DESC');
    dashboards.forEach((row: any) => {
      const dashboard: Dashboard = {
        id: row.id,
        name: row.name,
        description: '',
        type: row.type,
        widgets: JSON.parse(row.widgets),
        layout: JSON.parse(row.layout),
        refresh_interval_minutes: row.refresh_interval_minutes,
        permissions: row.permissions ? JSON.parse(row.permissions) : [],
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at)
      };
      this.dashboards.set(dashboard.id, dashboard);
    });
  }

  private async persistReport(report: AnalyticsReport): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO analytics_reports 
      (id, name, type, category, data, metadata, generated_at, valid_until, chart_configs, insights, recommendations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.adapter.executeSQL(sql, [
      report.id,
      report.name,
      report.type,
      report.category,
      JSON.stringify(report.data),
      JSON.stringify(report.metadata),
      report.generated_at.toISOString(),
      report.valid_until?.toISOString(),
      JSON.stringify(report.chart_configs),
      JSON.stringify(report.insights),
      JSON.stringify(report.recommendations)
    ]);
  }

  private async persistData(): Promise<void> {
    // Persist reports
    for (const report of this.reports.values()) {
      await this.persistReport(report);
    }
  }

  private async createDefaultDashboards(): Promise<void> {
    // Create executive dashboard if it doesn't exist
    const existingDashboard = Array.from(this.dashboards.values()).find(d => d.name === 'Executive Dashboard');
    
    if (!existingDashboard) {
      const executiveDashboard: Dashboard = {
        id: 'dashboard-executive-default',
        name: 'Executive Dashboard',
        description: 'High-level KPIs and business metrics',
        type: 'executive',
        widgets: [
          {
            id: 'widget-roi',
            type: 'kpi',
            title: 'ROI',
            position: { x: 0, y: 0, width: 3, height: 2 },
            data_source: 'kpis',
            query: 'roi'
          },
          {
            id: 'widget-users',
            type: 'kpi',
            title: 'Monthly Active Users',
            position: { x: 3, y: 0, width: 3, height: 2 },
            data_source: 'kpis',
            query: 'user_adoption'
          },
          {
            id: 'widget-incidents',
            type: 'chart',
            title: 'Incident Trends',
            position: { x: 0, y: 2, width: 6, height: 4 },
            data_source: 'reports',
            query: 'incident_trends'
          }
        ],
        layout: {
          grid_size: { columns: 12, rows: 8 },
          responsive: true,
          theme: 'light'
        },
        refresh_interval_minutes: 15,
        permissions: ['executive', 'admin'],
        created_at: new Date(),
        updated_at: new Date()
      };
      
      this.dashboards.set(executiveDashboard.id, executiveDashboard);
    }
  }

  private async startScheduledReporting(): Promise<void> {
    // In a real implementation, this would set up scheduled report generation
    this.log('info', 'Scheduled reporting started');
  }

  // ========================
  // Public API Methods
  // ========================

  async getReport(reportId: string): Promise<AnalyticsReport | null> {
    return this.reports.get(reportId) || null;
  }

  async listReports(filters?: any): Promise<AnalyticsReport[]> {
    let reports = Array.from(this.reports.values());
    
    if (filters) {
      if (filters.type) {
        reports = reports.filter(r => r.type === filters.type);
      }
      if (filters.category) {
        reports = reports.filter(r => r.category === filters.category);
      }
      if (filters.since) {
        const since = new Date(filters.since);
        reports = reports.filter(r => r.generated_at >= since);
      }
    }
    
    return reports.sort((a, b) => b.generated_at.getTime() - a.generated_at.getTime());
  }

  async createDashboard(dashboardData: Partial<Dashboard>): Promise<Dashboard> {
    const dashboard: Dashboard = {
      id: `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: dashboardData.name || 'New Dashboard',
      description: dashboardData.description || '',
      type: dashboardData.type || 'custom',
      widgets: dashboardData.widgets || [],
      layout: dashboardData.layout || {
        grid_size: { columns: 12, rows: 8 },
        responsive: true,
        theme: 'light'
      },
      refresh_interval_minutes: dashboardData.refresh_interval_minutes || 5,
      permissions: dashboardData.permissions || [],
      created_at: new Date(),
      updated_at: new Date()
    };
    
    this.dashboards.set(dashboard.id, dashboard);
    
    this.emit('dashboard-created', { dashboard });
    
    return dashboard;
  }

  async getDashboard(dashboardId: string): Promise<Dashboard | null> {
    return this.dashboards.get(dashboardId) || null;
  }

  async updateDashboard(dashboardId: string, updates: Partial<Dashboard>): Promise<Dashboard> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }
    
    Object.assign(dashboard, updates, { updated_at: new Date() });
    
    this.emit('dashboard-updated', { dashboard });
    
    return dashboard;
  }
}