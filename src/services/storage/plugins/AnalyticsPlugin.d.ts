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
  data: Array<{
    x: any;
    y: any;
    [key: string]: any;
  }>;
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
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  data_source: string;
  query: string;
  refresh_interval?: number;
  styling?: WidgetStyling;
}
export interface DashboardLayout {
  grid_size: {
    columns: number;
    rows: number;
  };
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
export declare class AnalyticsPlugin extends BaseStoragePlugin {
  private reports;
  private dashboards;
  private kpis;
  private models;
  private reportCache;
  constructor(adapter: IStorageAdapter, config?: AnalyticsConfig);
  getName(): string;
  getVersion(): string;
  getDescription(): string;
  getMVPVersion(): number;
  getDependencies(): string[];
  protected getDefaultConfig(): AnalyticsConfig;
  protected initializePlugin(): Promise<void>;
  protected cleanupPlugin(): Promise<void>;
  processData(data: any, context?: any): Promise<any>;
  generateReport(type: string, parameters?: any): Promise<AnalyticsReport>;
  private generateKBUsageReport;
  private generateIncidentTrendsReport;
  private generatePerformanceReport;
  private generateCodeQualityReport;
  private generateTemplateUsageReport;
  private generateROIReport;
  private createKBUsageCharts;
  private createIncidentTrendsCharts;
  private createPerformanceCharts;
  private createCodeQualityCharts;
  private createTemplateUsageCharts;
  private createROICharts;
  private analyzeIncidentTrends;
  private analyzeCodeQuality;
  private analyzeROI;
  getKPIs(category?: string): Promise<KPIMetric[]>;
  private calculateKBUsageKPI;
  private calculateKBSuccessRateKPI;
  private calculateSearchPerformanceKPI;
  private calculateMTTRKPI;
  private calculateCodeQualityKPI;
  private calculateIssueResolutionKPI;
  private calculateROIKPI;
  private calculateUserAdoptionKPI;
  calculateROI(timeRange: TimeRange): Promise<any>;
  performTrendAnalysis(metric: string, timeRange: TimeRange): Promise<AnalyticsInsight[]>;
  detectAnomalies(metric: string, timeRange: TimeRange): Promise<AnalyticsInsight[]>;
  performPredictiveAnalysis(target: string, features: string[]): Promise<any>;
  generateExecutiveSummary(timeRange: TimeRange): Promise<any>;
  private getDefaultTimeRange;
  private getReportName;
  private getReportDescription;
  private getReportType;
  private getReportCategory;
  private getDataSources;
  private getRecordCount;
  private calculateConfidenceScore;
  private generateRecommendations;
  private calculateTrend;
  private detectSeasonality;
  private calculateAutocorrelation;
  private detectStatisticalAnomalies;
  private getMetricTimeSeries;
  private groupIncidentsBySeverity;
  private getUniqueUserCount;
  private calculateAverageSuccessRate;
  private calculateSearchSuccessRate;
  private calculateKBTimeSavings;
  private calculateTemplateSavings;
  private calculatePreventionSavings;
  private generateReportId;
  private createTables;
  private loadExistingData;
  private persistReport;
  private persistData;
  private createDefaultDashboards;
  private startScheduledReporting;
  getReport(reportId: string): Promise<AnalyticsReport | null>;
  listReports(filters?: any): Promise<AnalyticsReport[]>;
  createDashboard(dashboardData: Partial<Dashboard>): Promise<Dashboard>;
  getDashboard(dashboardId: string): Promise<Dashboard | null>;
  updateDashboard(dashboardId: string, updates: Partial<Dashboard>): Promise<Dashboard>;
}
//# sourceMappingURL=AnalyticsPlugin.d.ts.map
