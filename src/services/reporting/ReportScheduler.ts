import { EventEmitter } from 'events';
import { Logger } from '../logger/Logger';
import { ReportConfig, ReportGenerator, ReportResult } from './ReportGenerator';
import { DataExporter, ExportConfig } from './DataExporter';

export interface ScheduledReport {
  id: string;
  name: string;
  description?: string;
  reportConfig: ReportConfig;
  schedule: ScheduleDefinition;
  exportConfig?: ExportConfig;
  notificationSettings: NotificationSettings;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
  lastResult?: ScheduledReportResult;
}

export interface ScheduleDefinition {
  type: 'cron' | 'interval' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  cronExpression?: string;
  intervalMinutes?: number;
  time?: string; // HH:MM format for daily schedules
  dayOfWeek?: number; // 0-6 for weekly schedules
  dayOfMonth?: number; // 1-31 for monthly schedules
  timezone?: string;
  startDate?: Date;
  endDate?: Date;
  maxRuns?: number;
  retryPolicy?: RetryPolicy;
}

export interface RetryPolicy {
  maxRetries: number;
  retryDelayMinutes: number;
  backoffMultiplier?: number;
  maxDelayMinutes?: number;
}

export interface NotificationSettings {
  onSuccess: NotificationConfig[];
  onFailure: NotificationConfig[];
  onRetry?: NotificationConfig[];
  includeReportData?: boolean;
  includeAttachment?: boolean;
}

export interface NotificationConfig {
  type: 'email' | 'webhook' | 'slack' | 'teams' | 'sms';
  recipients: string[];
  template?: string;
  customFields?: Record<string, any>;
}

export interface ScheduledReportResult {
  id: string;
  scheduledReportId: string;
  executionId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'success' | 'failed' | 'cancelled' | 'retrying';
  reportResult?: ReportResult;
  exportResult?: any;
  error?: string;
  retryCount: number;
  duration?: number;
  metadata: Record<string, any>;
}

export interface SchedulerMetrics {
  totalScheduledReports: number;
  activeScheduledReports: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  nextExecutionTime?: Date;
  queuedExecutions: number;
}

export class ReportScheduler extends EventEmitter {
  private readonly logger: Logger;
  private readonly reportGenerator: ReportGenerator;
  private readonly dataExporter: DataExporter;
  private readonly scheduledReports: Map<string, ScheduledReport>;
  private readonly activeExecutions: Map<string, ScheduledReportResult>;
  private readonly executionHistory: Map<string, ScheduledReportResult[]>;
  private readonly maxHistoryPerReport: number;
  private schedulerTimer?: NodeJS.Timeout;
  private readonly checkIntervalMs: number;
  private isRunning: boolean = false;

  constructor(
    logger: Logger,
    reportGenerator: ReportGenerator,
    dataExporter: DataExporter,
    checkIntervalMs: number = 60000, // Check every minute
    maxHistoryPerReport: number = 100
  ) {
    super();
    this.logger = logger;
    this.reportGenerator = reportGenerator;
    this.dataExporter = dataExporter;
    this.scheduledReports = new Map();
    this.activeExecutions = new Map();
    this.executionHistory = new Map();
    this.checkIntervalMs = checkIntervalMs;
    this.maxHistoryPerReport = maxHistoryPerReport;
  }

  public start(): void {
    if (this.isRunning) {
      this.logger.warn('Report scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.schedulerTimer = setInterval(() => {
      this.checkScheduledReports().catch(error => {
        this.logger.error('Error in scheduled report check', error);
      });
    }, this.checkIntervalMs);

    this.logger.info('Report scheduler started');
    this.emit('schedulerStarted');
  }

  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = undefined;
    }

    this.logger.info('Report scheduler stopped');
    this.emit('schedulerStopped');
  }

  public createScheduledReport(
    reportConfig: ReportConfig,
    schedule: ScheduleDefinition,
    notificationSettings: NotificationSettings,
    createdBy: string,
    exportConfig?: ExportConfig,
    name?: string,
    description?: string
  ): ScheduledReport {
    const scheduledReport: ScheduledReport = {
      id: this.generateId(),
      name: name || reportConfig.name,
      description,
      reportConfig,
      schedule,
      exportConfig,
      notificationSettings,
      isActive: true,
      createdBy,
      createdAt: new Date(),
      nextRun: this.calculateNextRun(schedule),
      runCount: 0,
      successCount: 0,
      failureCount: 0
    };

    this.scheduledReports.set(scheduledReport.id, scheduledReport);
    this.executionHistory.set(scheduledReport.id, []);

    this.logger.info(`Scheduled report created: ${scheduledReport.name} (${scheduledReport.id})`);
    this.emit('scheduledReportCreated', scheduledReport);

    return scheduledReport;
  }

  public getScheduledReport(id: string): ScheduledReport | null {
    return this.scheduledReports.get(id) || null;
  }

  public listScheduledReports(activeOnly: boolean = false): ScheduledReport[] {
    const reports = Array.from(this.scheduledReports.values());
    return activeOnly ? reports.filter(r => r.isActive) : reports;
  }

  public updateScheduledReport(id: string, updates: Partial<ScheduledReport>): ScheduledReport | null {
    const report = this.scheduledReports.get(id);
    if (!report) {
      return null;
    }

    // Recalculate next run if schedule was updated
    if (updates.schedule) {
      updates.nextRun = this.calculateNextRun(updates.schedule);
    }

    Object.assign(report, updates);
    this.emit('scheduledReportUpdated', report);

    return report;
  }

  public deleteScheduledReport(id: string): boolean {
    const deleted = this.scheduledReports.delete(id);
    if (deleted) {
      this.executionHistory.delete(id);
      this.logger.info(`Scheduled report deleted: ${id}`);
      this.emit('scheduledReportDeleted', { id });
    }
    return deleted;
  }

  public activateScheduledReport(id: string): boolean {
    const report = this.scheduledReports.get(id);
    if (!report) {
      return false;
    }

    report.isActive = true;
    report.nextRun = this.calculateNextRun(report.schedule);
    this.emit('scheduledReportActivated', report);

    return true;
  }

  public deactivateScheduledReport(id: string): boolean {
    const report = this.scheduledReports.get(id);
    if (!report) {
      return false;
    }

    report.isActive = false;
    report.nextRun = undefined;
    this.emit('scheduledReportDeactivated', report);

    return true;
  }

  private async checkScheduledReports(): Promise<void> {
    const now = new Date();

    for (const report of this.scheduledReports.values()) {
      if (!report.isActive || !report.nextRun) {
        continue;
      }

      if (now >= report.nextRun) {
        try {
          await this.executeScheduledReport(report);
        } catch (error) {
          this.logger.error(`Failed to execute scheduled report: ${report.id}`, error);
        }
      }
    }
  }

  private async executeScheduledReport(scheduledReport: ScheduledReport): Promise<void> {
    const executionId = this.generateId();
    const execution: ScheduledReportResult = {
      id: executionId,
      scheduledReportId: scheduledReport.id,
      executionId,
      startTime: new Date(),
      status: 'running',
      retryCount: 0,
      metadata: {
        scheduledTime: scheduledReport.nextRun,
        actualExecutionTime: new Date()
      }
    };

    this.activeExecutions.set(executionId, execution);
    this.addToHistory(scheduledReport.id, execution);

    // Update scheduled report
    scheduledReport.lastRun = new Date();
    scheduledReport.runCount++;
    scheduledReport.nextRun = this.calculateNextRun(scheduledReport.schedule, scheduledReport.lastRun);

    this.logger.info(`Executing scheduled report: ${scheduledReport.name} (${executionId})`);
    this.emit('executionStarted', execution);

    try {
      // Generate report
      const reportResult = await this.reportGenerator.generateReport(scheduledReport.reportConfig);
      execution.reportResult = reportResult;

      // Export if configured
      if (scheduledReport.exportConfig && reportResult.status === 'success') {
        const exportJobId = await this.dataExporter.exportData(reportResult.data, scheduledReport.exportConfig);
        execution.exportResult = { jobId: exportJobId };
      }

      // Mark as successful
      execution.status = 'success';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      scheduledReport.successCount++;
      scheduledReport.lastResult = execution;

      this.logger.info(`Scheduled report execution completed: ${executionId}`);
      this.emit('executionCompleted', execution);

      // Send success notifications
      await this.sendNotifications(scheduledReport, execution, 'success');

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      execution.error = error instanceof Error ? error.message : String(error);
      scheduledReport.failureCount++;
      scheduledReport.lastResult = execution;

      this.logger.error(`Scheduled report execution failed: ${executionId}`, error);
      this.emit('executionFailed', execution);

      // Handle retries
      if (scheduledReport.schedule.retryPolicy && execution.retryCount < scheduledReport.schedule.retryPolicy.maxRetries) {
        await this.scheduleRetry(scheduledReport, execution);
      } else {
        // Send failure notifications
        await this.sendNotifications(scheduledReport, execution, 'failure');
      }

    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  private async scheduleRetry(scheduledReport: ScheduledReport, execution: ScheduledReportResult): Promise<void> {
    const retryPolicy = scheduledReport.schedule.retryPolicy!;
    const retryDelay = this.calculateRetryDelay(execution.retryCount, retryPolicy);

    this.logger.info(`Scheduling retry for ${scheduledReport.id} in ${retryDelay} minutes`);

    setTimeout(async () => {
      try {
        execution.retryCount++;
        execution.status = 'retrying';
        this.emit('executionRetrying', execution);

        await this.executeScheduledReport(scheduledReport);
      } catch (error) {
        this.logger.error(`Retry failed for scheduled report: ${scheduledReport.id}`, error);
      }
    }, retryDelay * 60 * 1000);

    // Send retry notifications
    await this.sendNotifications(scheduledReport, execution, 'retry');
  }

  private calculateRetryDelay(retryCount: number, retryPolicy: RetryPolicy): number {
    let delay = retryPolicy.retryDelayMinutes;

    if (retryPolicy.backoffMultiplier && retryPolicy.backoffMultiplier > 1) {
      delay = delay * Math.pow(retryPolicy.backoffMultiplier, retryCount);
    }

    if (retryPolicy.maxDelayMinutes) {
      delay = Math.min(delay, retryPolicy.maxDelayMinutes);
    }

    return delay;
  }

  private async sendNotifications(
    scheduledReport: ScheduledReport,
    execution: ScheduledReportResult,
    type: 'success' | 'failure' | 'retry'
  ): Promise<void> {
    let notifications: NotificationConfig[] = [];

    switch (type) {
      case 'success':
        notifications = scheduledReport.notificationSettings.onSuccess;
        break;
      case 'failure':
        notifications = scheduledReport.notificationSettings.onFailure;
        break;
      case 'retry':
        notifications = scheduledReport.notificationSettings.onRetry || [];
        break;
    }

    for (const notification of notifications) {
      try {
        await this.sendNotification(scheduledReport, execution, notification, type);
      } catch (error) {
        this.logger.error(`Failed to send ${type} notification`, error);
      }
    }
  }

  private async sendNotification(
    scheduledReport: ScheduledReport,
    execution: ScheduledReportResult,
    config: NotificationConfig,
    type: string
  ): Promise<void> {
    const notificationData = {
      reportName: scheduledReport.name,
      executionId: execution.id,
      status: execution.status,
      startTime: execution.startTime,
      endTime: execution.endTime,
      duration: execution.duration,
      error: execution.error,
      retryCount: execution.retryCount,
      type
    };

    // In a real implementation, integrate with notification services
    switch (config.type) {
      case 'email':
        await this.sendEmailNotification(config.recipients, notificationData, scheduledReport, execution);
        break;
      case 'webhook':
        await this.sendWebhookNotification(config.recipients[0], notificationData);
        break;
      case 'slack':
        await this.sendSlackNotification(config.recipients[0], notificationData);
        break;
      // Add other notification types as needed
    }

    this.logger.info(`${type} notification sent via ${config.type} for ${scheduledReport.id}`);
  }

  private async sendEmailNotification(recipients: string[], data: any, scheduledReport: ScheduledReport, execution: ScheduledReportResult): Promise<void> {
    // Placeholder for email notification implementation
    this.logger.info(`Email notification would be sent to: ${recipients.join(', ')}`);
  }

  private async sendWebhookNotification(url: string, data: any): Promise<void> {
    // Placeholder for webhook notification implementation
    this.logger.info(`Webhook notification would be sent to: ${url}`);
  }

  private async sendSlackNotification(webhook: string, data: any): Promise<void> {
    // Placeholder for Slack notification implementation
    this.logger.info(`Slack notification would be sent to webhook`);
  }

  private calculateNextRun(schedule: ScheduleDefinition, fromDate?: Date): Date | undefined {
    const baseDate = fromDate || new Date();

    // Check if schedule has ended
    if (schedule.endDate && baseDate >= schedule.endDate) {
      return undefined;
    }

    let nextRun: Date;

    switch (schedule.type) {
      case 'interval':
        if (!schedule.intervalMinutes) {
          throw new Error('Interval minutes required for interval schedule');
        }
        nextRun = new Date(baseDate.getTime() + schedule.intervalMinutes * 60 * 1000);
        break;

      case 'daily':
        nextRun = this.calculateDailyNextRun(baseDate, schedule.time || '09:00');
        break;

      case 'weekly':
        nextRun = this.calculateWeeklyNextRun(baseDate, schedule.dayOfWeek || 1, schedule.time || '09:00');
        break;

      case 'monthly':
        nextRun = this.calculateMonthlyNextRun(baseDate, schedule.dayOfMonth || 1, schedule.time || '09:00');
        break;

      case 'cron':
        if (!schedule.cronExpression) {
          throw new Error('Cron expression required for cron schedule');
        }
        nextRun = this.calculateCronNextRun(baseDate, schedule.cronExpression);
        break;

      default:
        throw new Error(`Unsupported schedule type: ${schedule.type}`);
    }

    // Apply timezone if specified
    if (schedule.timezone) {
      // In a real implementation, use a proper timezone library
      nextRun = new Date(nextRun.toLocaleString('en-US', { timeZone: schedule.timezone }));
    }

    // Ensure next run is not before start date
    if (schedule.startDate && nextRun < schedule.startDate) {
      nextRun = schedule.startDate;
    }

    // Ensure next run is not after end date
    if (schedule.endDate && nextRun > schedule.endDate) {
      return undefined;
    }

    return nextRun;
  }

  private calculateDailyNextRun(baseDate: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const nextRun = new Date(baseDate);
    nextRun.setHours(hours, minutes, 0, 0);

    if (nextRun <= baseDate) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun;
  }

  private calculateWeeklyNextRun(baseDate: Date, dayOfWeek: number, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const nextRun = new Date(baseDate);
    const currentDayOfWeek = nextRun.getDay();

    let daysToAdd = dayOfWeek - currentDayOfWeek;
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }

    nextRun.setDate(nextRun.getDate() + daysToAdd);
    nextRun.setHours(hours, minutes, 0, 0);

    return nextRun;
  }

  private calculateMonthlyNextRun(baseDate: Date, dayOfMonth: number, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const nextRun = new Date(baseDate);
    nextRun.setDate(dayOfMonth);
    nextRun.setHours(hours, minutes, 0, 0);

    if (nextRun <= baseDate) {
      nextRun.setMonth(nextRun.getMonth() + 1);
      nextRun.setDate(dayOfMonth);
    }

    return nextRun;
  }

  private calculateCronNextRun(baseDate: Date, cronExpression: string): Date {
    // This is a simplified implementation
    // In production, use a proper cron parser library like 'node-cron' or 'cron-parser'
    throw new Error('Cron scheduling requires additional dependencies (cron-parser)');
  }

  private addToHistory(scheduledReportId: string, execution: ScheduledReportResult): void {
    let history = this.executionHistory.get(scheduledReportId);
    if (!history) {
      history = [];
      this.executionHistory.set(scheduledReportId, history);
    }

    history.unshift(execution);

    // Limit history size
    if (history.length > this.maxHistoryPerReport) {
      history.splice(this.maxHistoryPerReport);
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for monitoring and management
  public getExecutionHistory(scheduledReportId: string, limit?: number): ScheduledReportResult[] {
    const history = this.executionHistory.get(scheduledReportId) || [];
    return limit ? history.slice(0, limit) : history;
  }

  public getActiveExecutions(): ScheduledReportResult[] {
    return Array.from(this.activeExecutions.values());
  }

  public cancelExecution(executionId: string): boolean {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    execution.status = 'cancelled';
    execution.endTime = new Date();
    execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

    this.activeExecutions.delete(executionId);
    this.emit('executionCancelled', execution);

    return true;
  }

  public getMetrics(): SchedulerMetrics {
    const allReports = Array.from(this.scheduledReports.values());
    const activeReports = allReports.filter(r => r.isActive);

    const totalExecutions = allReports.reduce((sum, r) => sum + r.runCount, 0);
    const successfulExecutions = allReports.reduce((sum, r) => sum + r.successCount, 0);
    const failedExecutions = allReports.reduce((sum, r) => sum + r.failureCount, 0);

    // Calculate average execution time from recent executions
    const recentExecutions = Array.from(this.executionHistory.values())
      .flat()
      .filter(e => e.duration !== undefined)
      .slice(0, 100);

    const averageExecutionTime = recentExecutions.length > 0
      ? recentExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) / recentExecutions.length
      : 0;

    const nextExecutions = activeReports
      .map(r => r.nextRun)
      .filter(d => d !== undefined)
      .sort((a, b) => a!.getTime() - b!.getTime());

    return {
      totalScheduledReports: allReports.length,
      activeScheduledReports: activeReports.length,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      nextExecutionTime: nextExecutions[0],
      queuedExecutions: this.activeExecutions.size
    };
  }
}