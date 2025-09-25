import { EventEmitter } from 'events';
import { Logger } from '../logger/Logger';
export interface ReportConfig {
  id: string;
  name: string;
  description?: string;
  type: 'analytics' | 'performance' | 'usage' | 'custom';
  dataSource: string;
  format: 'pdf' | 'excel' | 'csv' | 'json';
  parameters: Record<string, any>;
  schedule?: ScheduleConfig;
  filters?: FilterConfig[];
  aggregations?: AggregationConfig[];
  visualizations?: VisualizationConfig[];
}
export interface ScheduleConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  cronExpression?: string;
  startDate?: Date;
  endDate?: Date;
  timezone?: string;
}
export interface FilterConfig {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'between';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}
export interface AggregationConfig {
  field: string;
  function: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' | 'distinct';
  groupBy?: string[];
  having?: FilterConfig;
}
export interface VisualizationConfig {
  type: 'table' | 'chart' | 'graph' | 'metric';
  chartType?: 'line' | 'bar' | 'pie' | 'scatter' | 'area';
  title: string;
  dataMapping: Record<string, string>;
  styling?: Record<string, any>;
}
export interface ReportResult {
  id: string;
  reportId: string;
  generatedAt: Date;
  status: 'success' | 'error' | 'partial';
  data: any;
  metadata: {
    rowCount: number;
    executionTime: number;
    dataSourceVersion: string;
    parameters: Record<string, any>;
  };
  errors?: string[];
  warnings?: string[];
  filePaths?: string[];
}
export interface DataSourceConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  executeQuery(query: string, parameters?: Record<string, any>): Promise<any[]>;
  getSchema(): Promise<Record<string, any>>;
  validateConnection(): Promise<boolean>;
}
export declare class ReportGenerator extends EventEmitter {
  private readonly logger;
  private readonly dataConnectors;
  private readonly activeReports;
  private readonly reportCache;
  private readonly maxCacheSize;
  constructor(logger: Logger, maxCacheSize?: number);
  registerDataSource(name: string, connector: DataSourceConnector): void;
  generateReport(config: ReportConfig): Promise<ReportResult>;
  private executeReportGeneration;
  private buildQuery;
  private buildWhereClause;
  private buildFilterClause;
  private buildSelectClause;
  private buildGroupByClause;
  private processData;
  private applyAnalyticsTransformations;
  private applyPerformanceTransformations;
  private applyUsageTransformations;
  private calculateMetrics;
  private calculateTrends;
  private calculatePerformanceScore;
  private compareToBenchmark;
  private identifyUsagePatterns;
  private classifyActivity;
  private generateVisualizations;
  private createVisualization;
  private mapDataForVisualization;
  private getDataSourceVersion;
  private validateReportData;
  private cacheReport;
  getCachedReport(reportId: string): ReportResult | null;
  clearCache(): void;
  getActiveReports(): string[];
}
//# sourceMappingURL=ReportGenerator.d.ts.map
