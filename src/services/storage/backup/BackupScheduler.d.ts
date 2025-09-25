import { EventEmitter } from 'events';
export interface ScheduleConfig {
  id?: string;
  name: string;
  cronExpression: string;
  backupRequest: any;
  enabled: boolean;
  retryPolicy: RetryPolicy;
  conditions?: ScheduleConditions;
  notifications?: NotificationConfig;
  priority: 'low' | 'normal' | 'high' | 'critical';
  metadata?: Record<string, any>;
}
export interface RetryPolicy {
  maxAttempts: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  maxRetryDelayMs: number;
  retryOnFailure: boolean;
}
export interface ScheduleConditions {
  maxConcurrentBackups?: number;
  systemLoadThreshold?: number;
  diskSpaceThreshold?: number;
  maintenanceWindows?: TimeWindow[];
  blackoutPeriods?: TimeWindow[];
}
export interface TimeWindow {
  start: string;
  end: string;
  weekdays?: number[];
  timezone?: string;
}
export interface NotificationConfig {
  onSuccess?: boolean;
  onFailure?: boolean;
  onRetry?: boolean;
  channels?: Array<'email' | 'webhook' | 'log'>;
  webhookUrl?: string;
  emailRecipients?: string[];
}
export interface ScheduleExecution {
  id: string;
  scheduleId: string;
  scheduledTime: Date;
  actualStartTime?: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';
  backupJobId?: string;
  attempt: number;
  nextRetryTime?: Date;
  error?: string;
  metadata?: Record<string, any>;
}
export interface ScheduleStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecution?: Date;
  nextExecution?: Date;
  successRate: number;
  reliability: 'excellent' | 'good' | 'fair' | 'poor';
}
export interface PerformanceConfig {
  maxConcurrentBackups: number;
  maxParallelDestinations: number;
  progressReportingInterval: number;
  timeoutMinutes: number;
}
export declare class BackupScheduler extends EventEmitter {
  private backupService;
  private config;
  private schedules;
  private executions;
  private activeTimers;
  private executionHistory;
  private isRunning;
  private masterTimer;
  constructor(backupService: any, config: PerformanceConfig);
  initialize(): Promise<void>;
  stop(): Promise<void>;
  scheduleBackup(
    cronExpression: string,
    backupRequest: any,
    options?: {
      enabled?: boolean;
      name?: string;
      retryPolicy?: Partial<RetryPolicy>;
      conditions?: ScheduleConditions;
      notifications?: NotificationConfig;
      priority?: 'low' | 'normal' | 'high' | 'critical';
    }
  ): Promise<string>;
  unscheduleBackup(scheduleId: string): Promise<boolean>;
  updateSchedule(scheduleId: string, updates: Partial<ScheduleConfig>): Promise<boolean>;
  listSchedules(): Promise<ScheduleConfig[]>;
  getSchedule(scheduleId: string): Promise<ScheduleConfig | null>;
  getScheduleStats(scheduleId: string): Promise<ScheduleStats | null>;
  getExecutions(
    scheduleId?: string,
    filter?: {
      status?: string;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
    }
  ): Promise<ScheduleExecution[]>;
  cancelExecution(executionId: string): Promise<boolean>;
  private generateScheduleId;
  private generateExecutionId;
  private startMasterScheduler;
  private checkSchedules;
  private scheduleNextExecution;
  private scheduleExecutionAt;
  private shouldSkipExecution;
  private isTimeInWindow;
  private executeScheduledBackup;
  private waitForBackupCompletion;
  private handleExecutionFailure;
  private retryFailedExecution;
  private sendNotification;
  private buildNotificationMessage;
  private sendWebhookNotification;
  private sendEmailNotification;
  private loadSchedules;
  private saveSchedule;
  private deleteSchedule;
}
export declare function createCronExpression(options: {
  minute?: string;
  hour?: string;
  dayOfMonth?: string;
  month?: string;
  dayOfWeek?: string;
}): string;
export declare function validateCronExpression(expression: string): {
  valid: boolean;
  error?: string;
};
export declare function getNextExecutionTime(cronExpression: string, after?: Date): Date;
export declare const COMMON_SCHEDULES: {
  EVERY_MINUTE: string;
  EVERY_HOUR: string;
  EVERY_DAY_MIDNIGHT: string;
  EVERY_DAY_2AM: string;
  EVERY_WEEK_SUNDAY_MIDNIGHT: string;
  EVERY_MONTH_FIRST_DAY: string;
  WEEKDAYS_6AM: string;
  BUSINESS_HOURS_EVERY_4H: string;
};
//# sourceMappingURL=BackupScheduler.d.ts.map
