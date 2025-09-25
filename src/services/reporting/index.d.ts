export * from './ReportGenerator';
export * from './CustomReportBuilder';
export * from './DataExporter';
export * from './ReportScheduler';
export * from './AlertManager';
import { EventEmitter } from 'events';
import { Logger } from '../logger/Logger';
import { ReportGenerator, DataSourceConnector } from './ReportGenerator';
import { CustomReportBuilder } from './CustomReportBuilder';
import { DataExporter } from './DataExporter';
import { ReportScheduler } from './ReportScheduler';
import { AlertManager } from './AlertManager';
export interface ReportingSystemConfig {
  outputDirectory?: string;
  maxConcurrentExports?: number;
  schedulerCheckInterval?: number;
  alertEvaluationInterval?: number;
  maxHistoryPerReport?: number;
  maxCacheSize?: number;
}
export interface ReportingSystemMetrics {
  totalReports: number;
  totalScheduledReports: number;
  totalAlertRules: number;
  activeExportJobs: number;
  activeAlerts: number;
  systemUptime: number;
  performance: {
    averageReportGenerationTime: number;
    averageExportTime: number;
    averageAlertResponseTime: number;
  };
}
export declare class ReportingSystem extends EventEmitter {
  private readonly logger;
  private readonly config;
  private readonly startTime;
  readonly reportGenerator: ReportGenerator;
  readonly customReportBuilder: CustomReportBuilder;
  readonly dataExporter: DataExporter;
  readonly reportScheduler: ReportScheduler;
  readonly alertManager: AlertManager;
  private isInitialized;
  constructor(logger: Logger, config?: ReportingSystemConfig);
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  registerDataSource(name: string, connector: DataSourceConnector): void;
  getSystemMetrics(): ReportingSystemMetrics;
  healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }>;
  getConfiguration(): ReportingSystemConfig;
  updateConfiguration(updates: Partial<ReportingSystemConfig>): void;
  private setupEventHandlers;
  generateQuickReport(
    name: string,
    dataSource: string,
    fields: string[],
    format?: 'json' | 'csv' | 'excel'
  ): Promise<import('./ReportGenerator').ReportResult>;
  quickExport(data: any[], format: 'csv' | 'json' | 'excel', fileName?: string): Promise<string>;
  createQuickAlert(
    name: string,
    dataSource: string,
    metric: string,
    threshold: number,
    comparison?: 'gt' | 'lt' | 'eq',
    notificationEmails?: string[]
  ): import('./AlertManager').AlertRule;
}
export declare function createReportingSystem(
  logger: Logger,
  config?: ReportingSystemConfig
): ReportingSystem;
export declare function getReportingSystem(): ReportingSystem;
export declare function destroyReportingSystem(): void;
//# sourceMappingURL=index.d.ts.map
