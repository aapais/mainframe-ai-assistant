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

export class ReportGenerator extends EventEmitter {
  private readonly logger: Logger;
  private readonly dataConnectors: Map<string, DataSourceConnector>;
  private readonly activeReports: Map<string, Promise<ReportResult>>;
  private readonly reportCache: Map<string, ReportResult>;
  private readonly maxCacheSize: number;

  constructor(logger: Logger, maxCacheSize: number = 100) {
    super();
    this.logger = logger;
    this.dataConnectors = new Map();
    this.activeReports = new Map();
    this.reportCache = new Map();
    this.maxCacheSize = maxCacheSize;
  }

  public registerDataSource(name: string, connector: DataSourceConnector): void {
    this.dataConnectors.set(name, connector);
    this.logger.info(`Data source registered: ${name}`);
  }

  public async generateReport(config: ReportConfig): Promise<ReportResult> {
    const reportId = `${config.id}_${Date.now()}`;

    try {
      this.logger.info(`Starting report generation: ${config.name} (${reportId})`);
      this.emit('reportStarted', { reportId, config });

      // Check if report is already being generated
      if (this.activeReports.has(config.id)) {
        this.logger.warn(`Report ${config.id} is already being generated`);
        return await this.activeReports.get(config.id)!;
      }

      // Start report generation
      const reportPromise = this.executeReportGeneration(reportId, config);
      this.activeReports.set(config.id, reportPromise);

      const result = await reportPromise;

      // Cache successful results
      if (result.status === 'success') {
        this.cacheReport(result);
      }

      this.activeReports.delete(config.id);
      this.emit('reportCompleted', result);

      return result;

    } catch (error) {
      this.activeReports.delete(config.id);
      const errorResult: ReportResult = {
        id: reportId,
        reportId: config.id,
        generatedAt: new Date(),
        status: 'error',
        data: null,
        metadata: {
          rowCount: 0,
          executionTime: 0,
          dataSourceVersion: 'unknown',
          parameters: config.parameters
        },
        errors: [error instanceof Error ? error.message : String(error)]
      };

      this.emit('reportError', errorResult);
      this.logger.error(`Report generation failed: ${config.name}`, error);
      return errorResult;
    }
  }

  private async executeReportGeneration(reportId: string, config: ReportConfig): Promise<ReportResult> {
    const startTime = Date.now();
    const connector = this.dataConnectors.get(config.dataSource);

    if (!connector) {
      throw new Error(`Data source not found: ${config.dataSource}`);
    }

    await connector.connect();

    try {
      // Build query based on configuration
      const query = this.buildQuery(config);
      const data = await connector.executeQuery(query, config.parameters);

      // Apply post-processing
      const processedData = await this.processData(data, config);

      // Generate visualizations if needed
      const visualizations = config.visualizations
        ? await this.generateVisualizations(processedData, config.visualizations)
        : [];

      const executionTime = Date.now() - startTime;

      return {
        id: reportId,
        reportId: config.id,
        generatedAt: new Date(),
        status: 'success',
        data: processedData,
        metadata: {
          rowCount: Array.isArray(processedData) ? processedData.length : 1,
          executionTime,
          dataSourceVersion: await this.getDataSourceVersion(connector),
          parameters: config.parameters
        },
        warnings: this.validateReportData(processedData, config)
      };

    } finally {
      await connector.disconnect();
    }
  }

  private buildQuery(config: ReportConfig): string {
    let query = `SELECT * FROM ${config.dataSource}`;

    // Apply filters
    if (config.filters && config.filters.length > 0) {
      const whereClause = this.buildWhereClause(config.filters);
      query += ` WHERE ${whereClause}`;
    }

    // Apply aggregations
    if (config.aggregations && config.aggregations.length > 0) {
      const selectClause = this.buildSelectClause(config.aggregations);
      const groupByClause = this.buildGroupByClause(config.aggregations);

      query = `SELECT ${selectClause} FROM ${config.dataSource}`;

      if (config.filters && config.filters.length > 0) {
        query += ` WHERE ${this.buildWhereClause(config.filters)}`;
      }

      if (groupByClause) {
        query += ` GROUP BY ${groupByClause}`;
      }
    }

    return query;
  }

  private buildWhereClause(filters: FilterConfig[]): string {
    return filters.map((filter, index) => {
      let clause = '';

      if (index > 0 && filter.logicalOperator) {
        clause += ` ${filter.logicalOperator} `;
      }

      clause += this.buildFilterClause(filter);
      return clause;
    }).join('');
  }

  private buildFilterClause(filter: FilterConfig): string {
    const { field, operator, value } = filter;

    switch (operator) {
      case 'eq': return `${field} = '${value}'`;
      case 'ne': return `${field} != '${value}'`;
      case 'gt': return `${field} > ${value}`;
      case 'gte': return `${field} >= ${value}`;
      case 'lt': return `${field} < ${value}`;
      case 'lte': return `${field} <= ${value}`;
      case 'in': return `${field} IN (${Array.isArray(value) ? value.map(v => `'${v}'`).join(',') : value})`;
      case 'like': return `${field} LIKE '%${value}%'`;
      case 'between': return `${field} BETWEEN '${value.start}' AND '${value.end}'`;
      default: throw new Error(`Unsupported filter operator: ${operator}`);
    }
  }

  private buildSelectClause(aggregations: AggregationConfig[]): string {
    return aggregations.map(agg => {
      const func = agg.function.toUpperCase();
      return `${func}(${agg.field}) as ${agg.field}_${agg.function}`;
    }).join(', ');
  }

  private buildGroupByClause(aggregations: AggregationConfig[]): string | null {
    const groupByFields = aggregations
      .filter(agg => agg.groupBy && agg.groupBy.length > 0)
      .flatMap(agg => agg.groupBy!)
      .filter((field, index, arr) => arr.indexOf(field) === index);

    return groupByFields.length > 0 ? groupByFields.join(', ') : null;
  }

  private async processData(data: any[], config: ReportConfig): Promise<any[]> {
    let processedData = [...data];

    // Apply data transformations based on report type
    switch (config.type) {
      case 'analytics':
        processedData = await this.applyAnalyticsTransformations(processedData, config);
        break;
      case 'performance':
        processedData = await this.applyPerformanceTransformations(processedData, config);
        break;
      case 'usage':
        processedData = await this.applyUsageTransformations(processedData, config);
        break;
    }

    return processedData;
  }

  private async applyAnalyticsTransformations(data: any[], config: ReportConfig): Promise<any[]> {
    // Add calculated fields for analytics
    return data.map(row => ({
      ...row,
      calculated_metrics: this.calculateMetrics(row, config.parameters),
      trend_indicators: this.calculateTrends(row, data)
    }));
  }

  private async applyPerformanceTransformations(data: any[], config: ReportConfig): Promise<any[]> {
    // Add performance indicators
    return data.map(row => ({
      ...row,
      performance_score: this.calculatePerformanceScore(row),
      benchmark_comparison: this.compareToBenchmark(row, config.parameters)
    }));
  }

  private async applyUsageTransformations(data: any[], config: ReportConfig): Promise<any[]> {
    // Add usage patterns and insights
    return data.map(row => ({
      ...row,
      usage_patterns: this.identifyUsagePatterns(row),
      activity_classification: this.classifyActivity(row)
    }));
  }

  private calculateMetrics(row: any, parameters: Record<string, any>): Record<string, number> {
    // Implement metric calculations based on parameters
    return {
      growth_rate: 0,
      conversion_rate: 0,
      efficiency_score: 0
    };
  }

  private calculateTrends(row: any, allData: any[]): Record<string, any> {
    // Implement trend analysis
    return {
      direction: 'stable',
      magnitude: 0,
      confidence: 0.5
    };
  }

  private calculatePerformanceScore(row: any): number {
    // Implement performance scoring algorithm
    return Math.random() * 100; // Placeholder
  }

  private compareToBenchmark(row: any, parameters: Record<string, any>): Record<string, any> {
    // Compare to benchmark values
    return {
      vs_benchmark: 0,
      percentile: 50,
      category: 'average'
    };
  }

  private identifyUsagePatterns(row: any): string[] {
    // Identify usage patterns
    return ['peak_hours', 'regular_user', 'mobile_preferred'];
  }

  private classifyActivity(row: any): string {
    // Classify activity type
    return 'normal';
  }

  private async generateVisualizations(data: any[], configs: VisualizationConfig[]): Promise<any[]> {
    const visualizations = [];

    for (const config of configs) {
      try {
        const visualization = await this.createVisualization(data, config);
        visualizations.push(visualization);
      } catch (error) {
        this.logger.warn(`Failed to create visualization: ${config.title}`, error);
      }
    }

    return visualizations;
  }

  private async createVisualization(data: any[], config: VisualizationConfig): Promise<any> {
    // Implementation would depend on chosen visualization library
    return {
      type: config.type,
      title: config.title,
      data: this.mapDataForVisualization(data, config.dataMapping),
      config: config.styling || {}
    };
  }

  private mapDataForVisualization(data: any[], mapping: Record<string, string>): any[] {
    return data.map(row => {
      const mappedRow: Record<string, any> = {};
      for (const [vizField, dataField] of Object.entries(mapping)) {
        mappedRow[vizField] = row[dataField];
      }
      return mappedRow;
    });
  }

  private async getDataSourceVersion(connector: DataSourceConnector): Promise<string> {
    try {
      const schema = await connector.getSchema();
      return schema.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private validateReportData(data: any, config: ReportConfig): string[] {
    const warnings: string[] = [];

    if (Array.isArray(data) && data.length === 0) {
      warnings.push('No data returned for the specified criteria');
    }

    if (Array.isArray(data) && data.length > 10000) {
      warnings.push('Large dataset returned - consider adding filters for better performance');
    }

    return warnings;
  }

  private cacheReport(result: ReportResult): void {
    if (this.reportCache.size >= this.maxCacheSize) {
      // Remove oldest cached report
      const oldestKey = this.reportCache.keys().next().value;
      this.reportCache.delete(oldestKey);
    }

    this.reportCache.set(result.id, result);
  }

  public getCachedReport(reportId: string): ReportResult | null {
    return this.reportCache.get(reportId) || null;
  }

  public clearCache(): void {
    this.reportCache.clear();
    this.logger.info('Report cache cleared');
  }

  public getActiveReports(): string[] {
    return Array.from(this.activeReports.keys());
  }
}