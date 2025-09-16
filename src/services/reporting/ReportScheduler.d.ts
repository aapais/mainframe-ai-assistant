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
    time?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
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
export declare class ReportScheduler extends EventEmitter {
    private readonly logger;
    private readonly reportGenerator;
    private readonly dataExporter;
    private readonly scheduledReports;
    private readonly activeExecutions;
    private readonly executionHistory;
    private readonly maxHistoryPerReport;
    private schedulerTimer?;
    private readonly checkIntervalMs;
    private isRunning;
    constructor(logger: Logger, reportGenerator: ReportGenerator, dataExporter: DataExporter, checkIntervalMs?: number, maxHistoryPerReport?: number);
    start(): void;
    stop(): void;
    createScheduledReport(reportConfig: ReportConfig, schedule: ScheduleDefinition, notificationSettings: NotificationSettings, createdBy: string, exportConfig?: ExportConfig, name?: string, description?: string): ScheduledReport;
    getScheduledReport(id: string): ScheduledReport | null;
    listScheduledReports(activeOnly?: boolean): ScheduledReport[];
    updateScheduledReport(id: string, updates: Partial<ScheduledReport>): ScheduledReport | null;
    deleteScheduledReport(id: string): boolean;
    activateScheduledReport(id: string): boolean;
    deactivateScheduledReport(id: string): boolean;
    private checkScheduledReports;
    private executeScheduledReport;
    private scheduleRetry;
    private calculateRetryDelay;
    private sendNotifications;
    private sendNotification;
    private sendEmailNotification;
    private sendWebhookNotification;
    private sendSlackNotification;
    private calculateNextRun;
    private calculateDailyNextRun;
    private calculateWeeklyNextRun;
    private calculateMonthlyNextRun;
    private calculateCronNextRun;
    private addToHistory;
    private generateId;
    getExecutionHistory(scheduledReportId: string, limit?: number): ScheduledReportResult[];
    getActiveExecutions(): ScheduledReportResult[];
    cancelExecution(executionId: string): boolean;
    getMetrics(): SchedulerMetrics;
}
//# sourceMappingURL=ReportScheduler.d.ts.map