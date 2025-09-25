// Export all reporting system components
export * from './ReportGenerator';
export * from './CustomReportBuilder';
export * from './DataExporter';
export * from './ReportScheduler';
export * from './AlertManager';

// Main reporting system class
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

/**
 * Main reporting system that orchestrates all reporting components
 */
export class ReportingSystem extends EventEmitter {
  private readonly logger: Logger;
  private readonly config: Required<ReportingSystemConfig>;
  private readonly startTime: Date;

  public readonly reportGenerator: ReportGenerator;
  public readonly customReportBuilder: CustomReportBuilder;
  public readonly dataExporter: DataExporter;
  public readonly reportScheduler: ReportScheduler;
  public readonly alertManager: AlertManager;

  private isInitialized: boolean = false;

  constructor(logger: Logger, config: ReportingSystemConfig = {}) {
    super();
    this.logger = logger;
    this.startTime = new Date();

    // Set default configuration
    this.config = {
      outputDirectory: config.outputDirectory || './exports',
      maxConcurrentExports: config.maxConcurrentExports || 5,
      schedulerCheckInterval: config.schedulerCheckInterval || 60000, // 1 minute
      alertEvaluationInterval: config.alertEvaluationInterval || 60000, // 1 minute
      maxHistoryPerReport: config.maxHistoryPerReport || 100,
      maxCacheSize: config.maxCacheSize || 100,
    };

    // Initialize components
    this.reportGenerator = new ReportGenerator(logger, this.config.maxCacheSize);
    this.customReportBuilder = new CustomReportBuilder(logger);
    this.dataExporter = new DataExporter(
      logger,
      this.config.outputDirectory,
      this.config.maxConcurrentExports
    );
    this.reportScheduler = new ReportScheduler(
      logger,
      this.reportGenerator,
      this.dataExporter,
      this.config.schedulerCheckInterval,
      this.config.maxHistoryPerReport
    );
    this.alertManager = new AlertManager(
      logger,
      this.config.alertEvaluationInterval,
      this.config.maxHistoryPerReport
    );

    this.setupEventHandlers();
  }

  /**
   * Initialize the reporting system
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Reporting system is already initialized');
      return;
    }

    try {
      this.logger.info('Initializing reporting system...');

      // Start scheduler and alert manager
      this.reportScheduler.start();
      this.alertManager.start();

      this.isInitialized = true;
      this.logger.info('Reporting system initialized successfully');
      this.emit('systemInitialized');
    } catch (error) {
      this.logger.error('Failed to initialize reporting system', error);
      this.emit('systemError', error);
      throw error;
    }
  }

  /**
   * Shutdown the reporting system gracefully
   */
  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      this.logger.info('Shutting down reporting system...');

      // Stop scheduler and alert manager
      this.reportScheduler.stop();
      this.alertManager.stop();

      // Clear caches
      this.reportGenerator.clearCache();

      this.isInitialized = false;
      this.logger.info('Reporting system shutdown complete');
      this.emit('systemShutdown');
    } catch (error) {
      this.logger.error('Error during reporting system shutdown', error);
      this.emit('systemError', error);
    }
  }

  /**
   * Register a data source connector
   */
  public registerDataSource(name: string, connector: DataSourceConnector): void {
    this.reportGenerator.registerDataSource(name, connector);
    this.logger.info(`Data source registered in reporting system: ${name}`);
  }

  /**
   * Get comprehensive system metrics
   */
  public getSystemMetrics(): ReportingSystemMetrics {
    const schedulerMetrics = this.reportScheduler.getMetrics();
    const alertMetrics = this.alertManager.getMetrics();

    const activeExportJobs = this.dataExporter.listJobs('processing').length;
    const activeReports = this.reportGenerator.getActiveReports().length;

    return {
      totalReports: this.reportGenerator['reportCache'].size + activeReports,
      totalScheduledReports: schedulerMetrics.totalScheduledReports,
      totalAlertRules: alertMetrics.totalRules,
      activeExportJobs,
      activeAlerts: alertMetrics.triggeredAlertsLast24h,
      systemUptime: Date.now() - this.startTime.getTime(),
      performance: {
        averageReportGenerationTime: 0, // Would need to track this
        averageExportTime: 0, // Would need to track this
        averageAlertResponseTime: alertMetrics.averageResolutionTime,
      },
    };
  }

  /**
   * Perform health check on all components
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const health = {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      details: {
        initialized: this.isInitialized,
        scheduler: {
          running: this.reportScheduler['isRunning'],
          activeReports: this.reportScheduler.getActiveReports().length,
          queuedExecutions: this.reportScheduler.getMetrics().queuedExecutions,
        },
        alertManager: {
          running: this.alertManager['isRunning'],
          activeRules: this.alertManager.listAlertRules(true).length,
          activeAlerts: this.alertManager.getActiveAlerts().length,
        },
        dataExporter: {
          supportedFormats: this.dataExporter.getSupportedFormats(),
          activeJobs: this.dataExporter.listJobs('processing').length,
        },
        cache: {
          reportCacheSize: this.reportGenerator['reportCache'].size,
          maxCacheSize: this.config.maxCacheSize,
        },
      },
    };

    // Determine overall health status
    if (!this.isInitialized) {
      health.status = 'unhealthy';
    } else if (
      health.details.scheduler.queuedExecutions > 10 ||
      health.details.dataExporter.activeJobs > this.config.maxConcurrentExports ||
      health.details.cache.reportCacheSize >= this.config.maxCacheSize
    ) {
      health.status = 'degraded';
    }

    return health;
  }

  /**
   * Get configuration information
   */
  public getConfiguration(): ReportingSystemConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (non-destructive)
   */
  public updateConfiguration(updates: Partial<ReportingSystemConfig>): void {
    Object.assign(this.config, updates);
    this.logger.info('Reporting system configuration updated', updates);
    this.emit('configurationUpdated', this.config);
  }

  private setupEventHandlers(): void {
    // Report Generator events
    this.reportGenerator.on('reportStarted', event => {
      this.emit('reportStarted', event);
    });

    this.reportGenerator.on('reportCompleted', event => {
      this.emit('reportCompleted', event);
    });

    this.reportGenerator.on('reportError', event => {
      this.emit('reportError', event);
    });

    // Custom Report Builder events
    this.customReportBuilder.on('templateCreated', event => {
      this.emit('templateCreated', event);
    });

    this.customReportBuilder.on('builderCreated', event => {
      this.emit('builderCreated', event);
    });

    // Data Exporter events
    this.dataExporter.on('jobCreated', event => {
      this.emit('exportJobCreated', event);
    });

    this.dataExporter.on('jobCompleted', event => {
      this.emit('exportJobCompleted', event);
    });

    this.dataExporter.on('jobFailed', event => {
      this.emit('exportJobFailed', event);
    });

    // Report Scheduler events
    this.reportScheduler.on('scheduledReportCreated', event => {
      this.emit('scheduledReportCreated', event);
    });

    this.reportScheduler.on('executionStarted', event => {
      this.emit('scheduledExecutionStarted', event);
    });

    this.reportScheduler.on('executionCompleted', event => {
      this.emit('scheduledExecutionCompleted', event);
    });

    this.reportScheduler.on('executionFailed', event => {
      this.emit('scheduledExecutionFailed', event);
    });

    // Alert Manager events
    this.alertManager.on('alertRuleCreated', event => {
      this.emit('alertRuleCreated', event);
    });

    this.alertManager.on('alertTriggered', event => {
      this.emit('alertTriggered', event);
    });

    this.alertManager.on('alertResolved', event => {
      this.emit('alertResolved', event);
    });

    this.alertManager.on('alertAcknowledged', event => {
      this.emit('alertAcknowledged', event);
    });
  }

  /**
   * Quick access methods for common operations
   */

  // Quick report generation
  public async generateQuickReport(
    name: string,
    dataSource: string,
    fields: string[],
    format: 'json' | 'csv' | 'excel' = 'json'
  ) {
    const config = {
      id: `quick_${Date.now()}`,
      name,
      type: 'custom' as const,
      dataSource,
      format,
      parameters: {},
    };

    return await this.reportGenerator.generateReport(config);
  }

  // Quick export
  public async quickExport(data: any[], format: 'csv' | 'json' | 'excel', fileName?: string) {
    const config = {
      format,
      fileName,
      options: {},
    };

    return await this.dataExporter.exportData(data, config);
  }

  // Quick alert rule
  public createQuickAlert(
    name: string,
    dataSource: string,
    metric: string,
    threshold: number,
    comparison: 'gt' | 'lt' | 'eq' = 'gt',
    notificationEmails: string[] = []
  ) {
    return this.alertManager.createAlertRule(
      name,
      dataSource,
      {
        type: 'threshold',
        metric,
        comparison,
        value: threshold,
      },
      [
        {
          severity: 'high',
          condition: {
            type: 'threshold',
            metric,
            comparison,
            value: threshold,
          },
          message: `${metric} ${comparison} ${threshold}`,
          autoResolve: true,
        },
      ],
      notificationEmails.map(email => ({
        type: 'email',
        recipients: [email],
      })),
      {
        timezone: 'UTC',
      },
      'system'
    );
  }
}

// Export singleton instance factory
let reportingSystemInstance: ReportingSystem | null = null;

export function createReportingSystem(
  logger: Logger,
  config?: ReportingSystemConfig
): ReportingSystem {
  if (reportingSystemInstance) {
    throw new Error(
      'Reporting system instance already exists. Use getReportingSystem() to access it.'
    );
  }

  reportingSystemInstance = new ReportingSystem(logger, config);
  return reportingSystemInstance;
}

export function getReportingSystem(): ReportingSystem {
  if (!reportingSystemInstance) {
    throw new Error('Reporting system not initialized. Call createReportingSystem() first.');
  }

  return reportingSystemInstance;
}

export function destroyReportingSystem(): void {
  if (reportingSystemInstance) {
    reportingSystemInstance.shutdown();
    reportingSystemInstance = null;
  }
}
