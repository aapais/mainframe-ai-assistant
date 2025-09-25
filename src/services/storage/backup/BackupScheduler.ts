/**
 * Backup Scheduler
 *
 * Advanced scheduling system for automated backups with cron-like expressions,
 * intelligent retry logic, and adaptive scheduling based on system conditions.
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';

// ===========================
// Types and Interfaces
// ===========================

export interface ScheduleConfig {
  id?: string;
  name: string;
  cronExpression: string;
  backupRequest: any; // BackupRequest from BackupService
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
  start: string; // HH:MM format
  end: string; // HH:MM format
  weekdays?: number[]; // 0-6, 0 = Sunday
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

// ===========================
// Cron Expression Parser
// ===========================

class CronParser {
  private static readonly CRON_FIELDS = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'];
  private static readonly FIELD_RANGES = {
    minute: [0, 59],
    hour: [0, 23],
    dayOfMonth: [1, 31],
    month: [1, 12],
    dayOfWeek: [0, 6], // 0 = Sunday
  };

  static parse(expression: string): CronExpression {
    const parts = expression.trim().split(/\s+/);

    if (parts.length !== 5) {
      throw new Error(
        `Invalid cron expression: ${expression}. Expected 5 fields (minute hour day month weekday)`
      );
    }

    const parsedFields: Record<string, number[]> = {};

    for (let i = 0; i < parts.length; i++) {
      const fieldName = this.CRON_FIELDS[i];
      const fieldValue = parts[i];
      const [min, max] = this.FIELD_RANGES[fieldName];

      parsedFields[fieldName] = this.parseField(fieldValue, min, max, fieldName);
    }

    return new CronExpression(parsedFields);
  }

  private static parseField(field: string, min: number, max: number, fieldName: string): number[] {
    if (field === '*') {
      return this.range(min, max);
    }

    if (field.includes('/')) {
      return this.parseStep(field, min, max);
    }

    if (field.includes('-')) {
      return this.parseRange(field, min, max);
    }

    if (field.includes(',')) {
      return this.parseList(field, min, max);
    }

    // Single value
    const value = parseInt(field, 10);
    if (isNaN(value) || value < min || value > max) {
      throw new Error(`Invalid ${fieldName} value: ${field}. Must be between ${min} and ${max}`);
    }

    return [value];
  }

  private static parseStep(field: string, min: number, max: number): number[] {
    const [range, step] = field.split('/');
    const stepValue = parseInt(step, 10);

    if (isNaN(stepValue) || stepValue <= 0) {
      throw new Error(`Invalid step value: ${step}`);
    }

    const baseRange =
      range === '*' ? this.range(min, max) : this.parseField(range, min, max, 'step');
    return baseRange.filter((_, index) => index % stepValue === 0);
  }

  private static parseRange(field: string, min: number, max: number): number[] {
    const [start, end] = field.split('-').map(x => parseInt(x, 10));

    if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
      throw new Error(`Invalid range: ${field}`);
    }

    return this.range(start, end);
  }

  private static parseList(field: string, min: number, max: number): number[] {
    const values = field.split(',');
    const result: number[] = [];

    for (const value of values) {
      result.push(...this.parseField(value, min, max, 'list'));
    }

    return [...new Set(result)].sort((a, b) => a - b);
  }

  private static range(start: number, end: number): number[] {
    const result: number[] = [];
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    return result;
  }
}

class CronExpression {
  private fields: Record<string, number[]>;

  constructor(fields: Record<string, number[]>) {
    this.fields = fields;
  }

  getNextExecution(after: Date = new Date()): Date {
    const next = new Date(after);
    next.setSeconds(0, 0); // Reset seconds and milliseconds
    next.setMinutes(next.getMinutes() + 1); // Start from next minute

    // Find next valid time
    for (let i = 0; i < 366 * 24 * 60; i++) {
      // Max 1 year ahead
      if (this.matches(next)) {
        return next;
      }
      next.setMinutes(next.getMinutes() + 1);
    }

    throw new Error('Could not find next execution time within 1 year');
  }

  private matches(date: Date): boolean {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1; // Date uses 0-based months
    const dayOfWeek = date.getDay();

    return (
      this.fields.minute.includes(minute) &&
      this.fields.hour.includes(hour) &&
      this.fields.dayOfMonth.includes(dayOfMonth) &&
      this.fields.month.includes(month) &&
      this.fields.dayOfWeek.includes(dayOfWeek)
    );
  }

  toString(): string {
    return [
      this.fields.minute.join(','),
      this.fields.hour.join(','),
      this.fields.dayOfMonth.join(','),
      this.fields.month.join(','),
      this.fields.dayOfWeek.join(','),
    ].join(' ');
  }
}

// ===========================
// Main Backup Scheduler
// ===========================

export class BackupScheduler extends EventEmitter {
  private backupService: any; // BackupService
  private config: PerformanceConfig;
  private schedules: Map<string, ScheduleConfig> = new Map();
  private executions: Map<string, ScheduleExecution> = new Map();
  private activeTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private executionHistory: Map<string, ScheduleExecution[]> = new Map();
  private isRunning = false;
  private masterTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(backupService: any, config: PerformanceConfig) {
    super();
    this.backupService = backupService;
    this.config = config;
    this.setMaxListeners(100);
  }

  // ===========================
  // Lifecycle Management
  // ===========================

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Backup Scheduler...');

      // Load existing schedules from storage
      await this.loadSchedules();

      // Start the master scheduler
      this.startMasterScheduler();

      this.isRunning = true;
      this.emit('scheduler:initialized');

      console.log(`✅ Backup Scheduler initialized with ${this.schedules.size} schedules`);
    } catch (error) {
      console.error('❌ Backup Scheduler initialization failed:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('🔄 Stopping Backup Scheduler...');

    // Stop master timer
    if (this.masterTimer) {
      clearTimeout(this.masterTimer);
      this.masterTimer = null;
    }

    // Cancel all active timers
    for (const [scheduleId, timer] of this.activeTimers) {
      clearTimeout(timer);
      console.log(`⏹️ Cancelled timer for schedule: ${scheduleId}`);
    }
    this.activeTimers.clear();

    // Cancel pending executions
    for (const execution of this.executions.values()) {
      if (execution.status === 'pending') {
        execution.status = 'cancelled';
        this.emit('execution:cancelled', execution);
      }
    }

    this.isRunning = false;
    this.emit('scheduler:stopped');
    console.log('✅ Backup Scheduler stopped');
  }

  // ===========================
  // Schedule Management
  // ===========================

  async scheduleBackup(
    cronExpression: string,
    backupRequest: any,
    options: {
      enabled?: boolean;
      name?: string;
      retryPolicy?: Partial<RetryPolicy>;
      conditions?: ScheduleConditions;
      notifications?: NotificationConfig;
      priority?: 'low' | 'normal' | 'high' | 'critical';
    } = {}
  ): Promise<string> {
    // Validate cron expression
    try {
      CronParser.parse(cronExpression);
    } catch (error) {
      throw new Error(`Invalid cron expression: ${error.message}`);
    }

    const scheduleId = this.generateScheduleId();

    const schedule: ScheduleConfig = {
      id: scheduleId,
      name: options.name || `Backup Schedule ${scheduleId}`,
      cronExpression,
      backupRequest,
      enabled: options.enabled !== false,
      retryPolicy: {
        maxAttempts: 3,
        retryDelayMs: 60000, // 1 minute
        backoffMultiplier: 2,
        maxRetryDelayMs: 3600000, // 1 hour
        retryOnFailure: true,
        ...options.retryPolicy,
      },
      conditions: options.conditions,
      notifications: options.notifications,
      priority: options.priority || 'normal',
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: 'system',
      },
    };

    this.schedules.set(scheduleId, schedule);
    this.executionHistory.set(scheduleId, []);

    // Save to storage
    await this.saveSchedule(schedule);

    // Schedule next execution
    if (schedule.enabled) {
      await this.scheduleNextExecution(scheduleId);
    }

    this.emit('schedule:created', schedule);
    console.log(`📅 Backup scheduled: ${schedule.name} (${cronExpression})`);

    return scheduleId;
  }

  async unscheduleBackup(scheduleId: string): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return false;
    }

    // Cancel any active timer
    const timer = this.activeTimers.get(scheduleId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(scheduleId);
    }

    // Cancel pending executions
    for (const execution of this.executions.values()) {
      if (execution.scheduleId === scheduleId && execution.status === 'pending') {
        execution.status = 'cancelled';
        this.emit('execution:cancelled', execution);
      }
    }

    // Remove from storage
    await this.deleteSchedule(scheduleId);

    this.schedules.delete(scheduleId);
    this.executionHistory.delete(scheduleId);

    this.emit('schedule:deleted', scheduleId);
    console.log(`🗑️ Backup schedule deleted: ${schedule.name}`);

    return true;
  }

  async updateSchedule(scheduleId: string, updates: Partial<ScheduleConfig>): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return false;
    }

    // Validate cron expression if being updated
    if (updates.cronExpression) {
      try {
        CronParser.parse(updates.cronExpression);
      } catch (error) {
        throw new Error(`Invalid cron expression: ${error.message}`);
      }
    }

    // Update schedule
    const updatedSchedule = { ...schedule, ...updates };
    this.schedules.set(scheduleId, updatedSchedule);

    // Save to storage
    await this.saveSchedule(updatedSchedule);

    // Reschedule if cron expression or enabled state changed
    if (updates.cronExpression || updates.hasOwnProperty('enabled')) {
      // Cancel existing timer
      const timer = this.activeTimers.get(scheduleId);
      if (timer) {
        clearTimeout(timer);
        this.activeTimers.delete(scheduleId);
      }

      // Schedule next execution if enabled
      if (updatedSchedule.enabled) {
        await this.scheduleNextExecution(scheduleId);
      }
    }

    this.emit('schedule:updated', updatedSchedule);
    console.log(`📝 Backup schedule updated: ${updatedSchedule.name}`);

    return true;
  }

  async listSchedules(): Promise<ScheduleConfig[]> {
    return Array.from(this.schedules.values());
  }

  async getSchedule(scheduleId: string): Promise<ScheduleConfig | null> {
    return this.schedules.get(scheduleId) || null;
  }

  async getScheduleStats(scheduleId: string): Promise<ScheduleStats | null> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return null;
    }

    const history = this.executionHistory.get(scheduleId) || [];
    const successful = history.filter(e => e.status === 'completed').length;
    const total = history.length;

    const executionTimes = history
      .filter(e => e.actualStartTime && e.endTime)
      .map(e => e.endTime!.getTime() - e.actualStartTime!.getTime());

    const averageExecutionTime =
      executionTimes.length > 0
        ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
        : 0;

    const successRate = total > 0 ? (successful / total) * 100 : 100;

    let reliability: 'excellent' | 'good' | 'fair' | 'poor';
    if (successRate >= 95) reliability = 'excellent';
    else if (successRate >= 85) reliability = 'good';
    else if (successRate >= 70) reliability = 'fair';
    else reliability = 'poor';

    // Calculate next execution
    let nextExecution: Date | undefined;
    try {
      const cronExpr = CronParser.parse(schedule.cronExpression);
      nextExecution = cronExpr.getNextExecution();
    } catch (error) {
      console.warn(`Could not calculate next execution for ${scheduleId}:`, error);
    }

    return {
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: total - successful,
      averageExecutionTime,
      lastExecution: history.length > 0 ? history[history.length - 1].scheduledTime : undefined,
      nextExecution,
      successRate,
      reliability,
    };
  }

  // ===========================
  // Execution Management
  // ===========================

  async getExecutions(
    scheduleId?: string,
    filter?: {
      status?: string;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
    }
  ): Promise<ScheduleExecution[]> {
    let executions: ScheduleExecution[];

    if (scheduleId) {
      executions = this.executionHistory.get(scheduleId) || [];
    } else {
      executions = Array.from(this.executionHistory.values()).flat();
    }

    // Apply filters
    if (filter?.status) {
      executions = executions.filter(e => e.status === filter.status);
    }

    if (filter?.fromDate) {
      executions = executions.filter(e => e.scheduledTime >= filter.fromDate!);
    }

    if (filter?.toDate) {
      executions = executions.filter(e => e.scheduledTime <= filter.toDate!);
    }

    // Sort by scheduled time (newest first)
    executions.sort((a, b) => b.scheduledTime.getTime() - a.scheduledTime.getTime());

    // Apply limit
    if (filter?.limit) {
      executions = executions.slice(0, filter.limit);
    }

    return executions;
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return false;
    }

    if (execution.status !== 'pending' && execution.status !== 'running') {
      return false;
    }

    if (execution.status === 'running' && execution.backupJobId) {
      // Cancel the backup job
      try {
        await this.backupService.cancelBackup(execution.backupJobId);
      } catch (error) {
        console.warn(`Could not cancel backup job ${execution.backupJobId}:`, error);
      }
    }

    execution.status = 'cancelled';
    execution.endTime = new Date();

    this.executions.delete(executionId);
    this.emit('execution:cancelled', execution);

    return true;
  }

  // ===========================
  // Private Implementation
  // ===========================

  private generateScheduleId(): string {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}-schedule`)
      .digest('hex')
      .substring(0, 16);
  }

  private generateExecutionId(): string {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}-execution`)
      .digest('hex')
      .substring(0, 16);
  }

  private startMasterScheduler(): void {
    const checkInterval = 30000; // Check every 30 seconds

    const scheduleCheck = () => {
      this.checkSchedules().catch(error => {
        console.error('❌ Schedule check failed:', error);
      });

      this.masterTimer = setTimeout(scheduleCheck, checkInterval);
    };

    scheduleCheck();
  }

  private async checkSchedules(): Promise<void> {
    if (!this.isRunning) return;

    const now = new Date();
    const activeExecutions = Array.from(this.executions.values()).filter(
      e => e.status === 'running'
    ).length;

    // Check if we're at max concurrent backup limit
    if (activeExecutions >= this.config.maxConcurrentBackups) {
      return;
    }

    // Check for executions that should start
    for (const execution of this.executions.values()) {
      if (execution.status === 'pending' && execution.scheduledTime <= now) {
        await this.executeScheduledBackup(execution);
      }
    }

    // Check for failed executions that should retry
    for (const execution of this.executions.values()) {
      if (
        execution.status === 'failed' &&
        execution.nextRetryTime &&
        execution.nextRetryTime <= now
      ) {
        await this.retryFailedExecution(execution);
      }
    }
  }

  private async scheduleNextExecution(scheduleId: string): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || !schedule.enabled) {
      return;
    }

    try {
      const cronExpr = CronParser.parse(schedule.cronExpression);
      const nextTime = cronExpr.getNextExecution();

      // Check if we should skip this execution due to conditions
      if (await this.shouldSkipExecution(schedule, nextTime)) {
        // Schedule the one after this
        const afterNext = cronExpr.getNextExecution(nextTime);
        await this.scheduleExecutionAt(scheduleId, afterNext);
        return;
      }

      await this.scheduleExecutionAt(scheduleId, nextTime);
    } catch (error) {
      console.error(`❌ Failed to schedule next execution for ${scheduleId}:`, error);
    }
  }

  private async scheduleExecutionAt(scheduleId: string, time: Date): Promise<void> {
    const executionId = this.generateExecutionId();

    const execution: ScheduleExecution = {
      id: executionId,
      scheduleId,
      scheduledTime: time,
      status: 'pending',
      attempt: 1,
    };

    this.executions.set(executionId, execution);

    // Also add to history
    const history = this.executionHistory.get(scheduleId) || [];
    history.push(execution);
    this.executionHistory.set(scheduleId, history);

    this.emit('execution:scheduled', execution);

    console.log(`⏰ Execution scheduled: ${scheduleId} at ${time.toISOString()}`);
  }

  private async shouldSkipExecution(schedule: ScheduleConfig, time: Date): Promise<boolean> {
    if (!schedule.conditions) {
      return false;
    }

    const conditions = schedule.conditions;

    // Check blackout periods
    if (conditions.blackoutPeriods) {
      for (const period of conditions.blackoutPeriods) {
        if (this.isTimeInWindow(time, period)) {
          console.log(`⏸️ Skipping execution due to blackout period: ${schedule.name}`);
          return true;
        }
      }
    }

    // Check maintenance windows (only execute during these periods)
    if (conditions.maintenanceWindows && conditions.maintenanceWindows.length > 0) {
      const inMaintenanceWindow = conditions.maintenanceWindows.some(window =>
        this.isTimeInWindow(time, window)
      );
      if (!inMaintenanceWindow) {
        console.log(`⏸️ Skipping execution - outside maintenance window: ${schedule.name}`);
        return true;
      }
    }

    // Check system load (simplified check)
    if (conditions.systemLoadThreshold) {
      const activeBackups = Array.from(this.executions.values()).filter(
        e => e.status === 'running'
      ).length;

      if (activeBackups >= (conditions.maxConcurrentBackups || this.config.maxConcurrentBackups)) {
        console.log(`⏸️ Skipping execution due to concurrent backup limit: ${schedule.name}`);
        return true;
      }
    }

    return false;
  }

  private isTimeInWindow(time: Date, window: TimeWindow): boolean {
    const timeHour = time.getHours();
    const timeMinute = time.getMinutes();
    const timeInMinutes = timeHour * 60 + timeMinute;

    const [startHour, startMinute] = window.start.split(':').map(Number);
    const [endHour, endMinute] = window.end.split(':').map(Number);
    const startInMinutes = startHour * 60 + startMinute;
    const endInMinutes = endHour * 60 + endMinute;

    // Check weekdays if specified
    if (window.weekdays && window.weekdays.length > 0) {
      const dayOfWeek = time.getDay();
      if (!window.weekdays.includes(dayOfWeek)) {
        return false;
      }
    }

    // Handle time window
    if (startInMinutes <= endInMinutes) {
      // Same day window
      return timeInMinutes >= startInMinutes && timeInMinutes <= endInMinutes;
    } else {
      // Overnight window
      return timeInMinutes >= startInMinutes || timeInMinutes <= endInMinutes;
    }
  }

  private async executeScheduledBackup(execution: ScheduleExecution): Promise<void> {
    const schedule = this.schedules.get(execution.scheduleId);
    if (!schedule) {
      execution.status = 'failed';
      execution.error = 'Schedule not found';
      execution.endTime = new Date();
      return;
    }

    try {
      execution.status = 'running';
      execution.actualStartTime = new Date();

      this.emit('execution:started', execution);

      // Create backup job
      const backupJobId = await this.backupService.createBackup(schedule.backupRequest);
      execution.backupJobId = backupJobId;

      // Wait for backup completion
      const result = await this.waitForBackupCompletion(backupJobId);

      if (result.success) {
        execution.status = 'completed';
        this.emit('execution:completed', execution);

        // Send success notification if configured
        if (schedule.notifications?.onSuccess) {
          await this.sendNotification(schedule, execution, 'success');
        }

        // Schedule next execution
        await this.scheduleNextExecution(execution.scheduleId);
      } else {
        execution.status = 'failed';
        execution.error = result.error;
        this.emit('execution:failed', execution);

        // Handle retry logic
        await this.handleExecutionFailure(execution, schedule);
      }
    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      this.emit('execution:failed', execution);

      await this.handleExecutionFailure(execution, schedule);
    } finally {
      execution.endTime = new Date();
      this.executions.delete(execution.id);
    }
  }

  private async waitForBackupCompletion(
    backupJobId: string
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise(resolve => {
      const checkStatus = async () => {
        try {
          const job = await this.backupService.getBackupJob(backupJobId);

          if (!job) {
            resolve({ success: false, error: 'Backup job not found' });
            return;
          }

          if (job.status === 'completed') {
            resolve({ success: true });
          } else if (job.status === 'failed' || job.status === 'cancelled') {
            resolve({ success: false, error: job.error || 'Backup failed' });
          } else {
            // Still running, check again in 10 seconds
            setTimeout(checkStatus, 10000);
          }
        } catch (error) {
          resolve({ success: false, error: error.message });
        }
      };

      checkStatus();
    });
  }

  private async handleExecutionFailure(
    execution: ScheduleExecution,
    schedule: ScheduleConfig
  ): Promise<void> {
    const retryPolicy = schedule.retryPolicy;

    // Send failure notification if configured
    if (schedule.notifications?.onFailure) {
      await this.sendNotification(schedule, execution, 'failure');
    }

    // Check if we should retry
    if (retryPolicy.retryOnFailure && execution.attempt < retryPolicy.maxAttempts) {
      // Calculate retry delay with exponential backoff
      const baseDelay = retryPolicy.retryDelayMs;
      const backoffMultiplier = Math.pow(retryPolicy.backoffMultiplier, execution.attempt - 1);
      const delay = Math.min(baseDelay * backoffMultiplier, retryPolicy.maxRetryDelayMs);

      execution.nextRetryTime = new Date(Date.now() + delay);
      execution.status = 'failed'; // Keep as failed but with retry scheduled

      this.emit('execution:retry_scheduled', execution);

      console.log(
        `🔄 Retry scheduled for ${execution.scheduleId} in ${delay}ms (attempt ${execution.attempt}/${retryPolicy.maxAttempts})`
      );

      // Send retry notification if configured
      if (schedule.notifications?.onRetry) {
        await this.sendNotification(schedule, execution, 'retry');
      }
    } else {
      // No more retries, schedule next execution
      console.log(`❌ Execution failed permanently: ${execution.scheduleId} (${execution.error})`);
      await this.scheduleNextExecution(execution.scheduleId);
    }
  }

  private async retryFailedExecution(execution: ScheduleExecution): Promise<void> {
    execution.attempt++;
    execution.nextRetryTime = undefined;
    execution.status = 'pending';

    // Add back to active executions for processing
    this.executions.set(execution.id, execution);

    console.log(`🔄 Retrying execution: ${execution.scheduleId} (attempt ${execution.attempt})`);
  }

  private async sendNotification(
    schedule: ScheduleConfig,
    execution: ScheduleExecution,
    type: 'success' | 'failure' | 'retry'
  ): Promise<void> {
    if (!schedule.notifications) return;

    const message = this.buildNotificationMessage(schedule, execution, type);

    // Log notification (always enabled)
    console.log(`📧 Notification [${type}]: ${message}`);

    // Send to configured channels
    if (schedule.notifications.channels) {
      for (const channel of schedule.notifications.channels) {
        try {
          switch (channel) {
            case 'webhook':
              if (schedule.notifications.webhookUrl) {
                await this.sendWebhookNotification(
                  schedule.notifications.webhookUrl,
                  message,
                  type
                );
              }
              break;
            case 'email':
              if (schedule.notifications.emailRecipients) {
                await this.sendEmailNotification(
                  schedule.notifications.emailRecipients,
                  message,
                  type
                );
              }
              break;
            case 'log':
              // Already logged above
              break;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to send ${channel} notification:`, error);
        }
      }
    }
  }

  private buildNotificationMessage(
    schedule: ScheduleConfig,
    execution: ScheduleExecution,
    type: 'success' | 'failure' | 'retry'
  ): string {
    const duration =
      execution.endTime && execution.actualStartTime
        ? execution.endTime.getTime() - execution.actualStartTime.getTime()
        : 0;

    switch (type) {
      case 'success':
        return `✅ Backup completed successfully: ${schedule.name} (${duration}ms)`;
      case 'failure':
        return `❌ Backup failed: ${schedule.name} - ${execution.error}`;
      case 'retry':
        return `🔄 Backup retry scheduled: ${schedule.name} (attempt ${execution.attempt}/${schedule.retryPolicy.maxAttempts})`;
      default:
        return `📊 Backup notification: ${schedule.name}`;
    }
  }

  private async sendWebhookNotification(url: string, message: string, type: string): Promise<void> {
    // TODO: Implement webhook notification
    console.log(`🔗 Webhook notification to ${url}: ${message}`);
  }

  private async sendEmailNotification(
    recipients: string[],
    message: string,
    type: string
  ): Promise<void> {
    // TODO: Implement email notification
    console.log(`📧 Email notification to ${recipients.join(', ')}: ${message}`);
  }

  private async loadSchedules(): Promise<void> {
    // TODO: Load schedules from persistent storage
    console.log('📂 Loading schedules from storage...');
  }

  private async saveSchedule(schedule: ScheduleConfig): Promise<void> {
    // TODO: Save schedule to persistent storage
    console.log(`💾 Saving schedule: ${schedule.name}`);
  }

  private async deleteSchedule(scheduleId: string): Promise<void> {
    // TODO: Delete schedule from persistent storage
    console.log(`🗑️ Deleting schedule: ${scheduleId}`);
  }
}

// ===========================
// Utility Functions
// ===========================

export function createCronExpression(options: {
  minute?: string;
  hour?: string;
  dayOfMonth?: string;
  month?: string;
  dayOfWeek?: string;
}): string {
  return [
    options.minute || '*',
    options.hour || '*',
    options.dayOfMonth || '*',
    options.month || '*',
    options.dayOfWeek || '*',
  ].join(' ');
}

export function validateCronExpression(expression: string): { valid: boolean; error?: string } {
  try {
    CronParser.parse(expression);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export function getNextExecutionTime(cronExpression: string, after?: Date): Date {
  const cron = CronParser.parse(cronExpression);
  return cron.getNextExecution(after);
}

// Common cron expressions
export const COMMON_SCHEDULES = {
  EVERY_MINUTE: '* * * * *',
  EVERY_HOUR: '0 * * * *',
  EVERY_DAY_MIDNIGHT: '0 0 * * *',
  EVERY_DAY_2AM: '0 2 * * *',
  EVERY_WEEK_SUNDAY_MIDNIGHT: '0 0 * * 0',
  EVERY_MONTH_FIRST_DAY: '0 0 1 * *',
  WEEKDAYS_6AM: '0 6 * * 1-5',
  BUSINESS_HOURS_EVERY_4H: '0 8,12,16 * * 1-5',
};
