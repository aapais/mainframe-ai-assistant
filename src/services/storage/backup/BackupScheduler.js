'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.COMMON_SCHEDULES = exports.BackupScheduler = void 0;
exports.createCronExpression = createCronExpression;
exports.validateCronExpression = validateCronExpression;
exports.getNextExecutionTime = getNextExecutionTime;
const events_1 = require('events');
const crypto_1 = require('crypto');
class CronParser {
  static CRON_FIELDS = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'];
  static FIELD_RANGES = {
    minute: [0, 59],
    hour: [0, 23],
    dayOfMonth: [1, 31],
    month: [1, 12],
    dayOfWeek: [0, 6],
  };
  static parse(expression) {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) {
      throw new Error(
        `Invalid cron expression: ${expression}. Expected 5 fields (minute hour day month weekday)`
      );
    }
    const parsedFields = {};
    for (let i = 0; i < parts.length; i++) {
      const fieldName = this.CRON_FIELDS[i];
      const fieldValue = parts[i];
      const [min, max] = this.FIELD_RANGES[fieldName];
      parsedFields[fieldName] = this.parseField(fieldValue, min, max, fieldName);
    }
    return new CronExpression(parsedFields);
  }
  static parseField(field, min, max, fieldName) {
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
    const value = parseInt(field, 10);
    if (isNaN(value) || value < min || value > max) {
      throw new Error(`Invalid ${fieldName} value: ${field}. Must be between ${min} and ${max}`);
    }
    return [value];
  }
  static parseStep(field, min, max) {
    const [range, step] = field.split('/');
    const stepValue = parseInt(step, 10);
    if (isNaN(stepValue) || stepValue <= 0) {
      throw new Error(`Invalid step value: ${step}`);
    }
    const baseRange =
      range === '*' ? this.range(min, max) : this.parseField(range, min, max, 'step');
    return baseRange.filter((_, index) => index % stepValue === 0);
  }
  static parseRange(field, min, max) {
    const [start, end] = field.split('-').map(x => parseInt(x, 10));
    if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
      throw new Error(`Invalid range: ${field}`);
    }
    return this.range(start, end);
  }
  static parseList(field, min, max) {
    const values = field.split(',');
    const result = [];
    for (const value of values) {
      result.push(...this.parseField(value, min, max, 'list'));
    }
    return [...new Set(result)].sort((a, b) => a - b);
  }
  static range(start, end) {
    const result = [];
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    return result;
  }
}
class CronExpression {
  fields;
  constructor(fields) {
    this.fields = fields;
  }
  getNextExecution(after = new Date()) {
    const next = new Date(after);
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);
    for (let i = 0; i < 366 * 24 * 60; i++) {
      if (this.matches(next)) {
        return next;
      }
      next.setMinutes(next.getMinutes() + 1);
    }
    throw new Error('Could not find next execution time within 1 year');
  }
  matches(date) {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1;
    const dayOfWeek = date.getDay();
    return (
      this.fields.minute.includes(minute) &&
      this.fields.hour.includes(hour) &&
      this.fields.dayOfMonth.includes(dayOfMonth) &&
      this.fields.month.includes(month) &&
      this.fields.dayOfWeek.includes(dayOfWeek)
    );
  }
  toString() {
    return [
      this.fields.minute.join(','),
      this.fields.hour.join(','),
      this.fields.dayOfMonth.join(','),
      this.fields.month.join(','),
      this.fields.dayOfWeek.join(','),
    ].join(' ');
  }
}
class BackupScheduler extends events_1.EventEmitter {
  backupService;
  config;
  schedules = new Map();
  executions = new Map();
  activeTimers = new Map();
  executionHistory = new Map();
  isRunning = false;
  masterTimer = null;
  constructor(backupService, config) {
    super();
    this.backupService = backupService;
    this.config = config;
    this.setMaxListeners(100);
  }
  async initialize() {
    try {
      console.log('🚀 Initializing Backup Scheduler...');
      await this.loadSchedules();
      this.startMasterScheduler();
      this.isRunning = true;
      this.emit('scheduler:initialized');
      console.log(`✅ Backup Scheduler initialized with ${this.schedules.size} schedules`);
    } catch (error) {
      console.error('❌ Backup Scheduler initialization failed:', error);
      throw error;
    }
  }
  async stop() {
    if (!this.isRunning) return;
    console.log('🔄 Stopping Backup Scheduler...');
    if (this.masterTimer) {
      clearTimeout(this.masterTimer);
      this.masterTimer = null;
    }
    for (const [scheduleId, timer] of this.activeTimers) {
      clearTimeout(timer);
      console.log(`⏹️ Cancelled timer for schedule: ${scheduleId}`);
    }
    this.activeTimers.clear();
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
  async scheduleBackup(cronExpression, backupRequest, options = {}) {
    try {
      CronParser.parse(cronExpression);
    } catch (error) {
      throw new Error(`Invalid cron expression: ${error.message}`);
    }
    const scheduleId = this.generateScheduleId();
    const schedule = {
      id: scheduleId,
      name: options.name || `Backup Schedule ${scheduleId}`,
      cronExpression,
      backupRequest,
      enabled: options.enabled !== false,
      retryPolicy: {
        maxAttempts: 3,
        retryDelayMs: 60000,
        backoffMultiplier: 2,
        maxRetryDelayMs: 3600000,
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
    await this.saveSchedule(schedule);
    if (schedule.enabled) {
      await this.scheduleNextExecution(scheduleId);
    }
    this.emit('schedule:created', schedule);
    console.log(`📅 Backup scheduled: ${schedule.name} (${cronExpression})`);
    return scheduleId;
  }
  async unscheduleBackup(scheduleId) {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return false;
    }
    const timer = this.activeTimers.get(scheduleId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(scheduleId);
    }
    for (const execution of this.executions.values()) {
      if (execution.scheduleId === scheduleId && execution.status === 'pending') {
        execution.status = 'cancelled';
        this.emit('execution:cancelled', execution);
      }
    }
    await this.deleteSchedule(scheduleId);
    this.schedules.delete(scheduleId);
    this.executionHistory.delete(scheduleId);
    this.emit('schedule:deleted', scheduleId);
    console.log(`🗑️ Backup schedule deleted: ${schedule.name}`);
    return true;
  }
  async updateSchedule(scheduleId, updates) {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return false;
    }
    if (updates.cronExpression) {
      try {
        CronParser.parse(updates.cronExpression);
      } catch (error) {
        throw new Error(`Invalid cron expression: ${error.message}`);
      }
    }
    const updatedSchedule = { ...schedule, ...updates };
    this.schedules.set(scheduleId, updatedSchedule);
    await this.saveSchedule(updatedSchedule);
    if (updates.cronExpression || updates.hasOwnProperty('enabled')) {
      const timer = this.activeTimers.get(scheduleId);
      if (timer) {
        clearTimeout(timer);
        this.activeTimers.delete(scheduleId);
      }
      if (updatedSchedule.enabled) {
        await this.scheduleNextExecution(scheduleId);
      }
    }
    this.emit('schedule:updated', updatedSchedule);
    console.log(`📝 Backup schedule updated: ${updatedSchedule.name}`);
    return true;
  }
  async listSchedules() {
    return Array.from(this.schedules.values());
  }
  async getSchedule(scheduleId) {
    return this.schedules.get(scheduleId) || null;
  }
  async getScheduleStats(scheduleId) {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return null;
    }
    const history = this.executionHistory.get(scheduleId) || [];
    const successful = history.filter(e => e.status === 'completed').length;
    const total = history.length;
    const executionTimes = history
      .filter(e => e.actualStartTime && e.endTime)
      .map(e => e.endTime.getTime() - e.actualStartTime.getTime());
    const averageExecutionTime =
      executionTimes.length > 0
        ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
        : 0;
    const successRate = total > 0 ? (successful / total) * 100 : 100;
    let reliability;
    if (successRate >= 95) reliability = 'excellent';
    else if (successRate >= 85) reliability = 'good';
    else if (successRate >= 70) reliability = 'fair';
    else reliability = 'poor';
    let nextExecution;
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
  async getExecutions(scheduleId, filter) {
    let executions;
    if (scheduleId) {
      executions = this.executionHistory.get(scheduleId) || [];
    } else {
      executions = Array.from(this.executionHistory.values()).flat();
    }
    if (filter?.status) {
      executions = executions.filter(e => e.status === filter.status);
    }
    if (filter?.fromDate) {
      executions = executions.filter(e => e.scheduledTime >= filter.fromDate);
    }
    if (filter?.toDate) {
      executions = executions.filter(e => e.scheduledTime <= filter.toDate);
    }
    executions.sort((a, b) => b.scheduledTime.getTime() - a.scheduledTime.getTime());
    if (filter?.limit) {
      executions = executions.slice(0, filter.limit);
    }
    return executions;
  }
  async cancelExecution(executionId) {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return false;
    }
    if (execution.status !== 'pending' && execution.status !== 'running') {
      return false;
    }
    if (execution.status === 'running' && execution.backupJobId) {
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
  generateScheduleId() {
    return (0, crypto_1.createHash)('sha256')
      .update(`${Date.now()}-${Math.random()}-schedule`)
      .digest('hex')
      .substring(0, 16);
  }
  generateExecutionId() {
    return (0, crypto_1.createHash)('sha256')
      .update(`${Date.now()}-${Math.random()}-execution`)
      .digest('hex')
      .substring(0, 16);
  }
  startMasterScheduler() {
    const checkInterval = 30000;
    const scheduleCheck = () => {
      this.checkSchedules().catch(error => {
        console.error('❌ Schedule check failed:', error);
      });
      this.masterTimer = setTimeout(scheduleCheck, checkInterval);
    };
    scheduleCheck();
  }
  async checkSchedules() {
    if (!this.isRunning) return;
    const now = new Date();
    const activeExecutions = Array.from(this.executions.values()).filter(
      e => e.status === 'running'
    ).length;
    if (activeExecutions >= this.config.maxConcurrentBackups) {
      return;
    }
    for (const execution of this.executions.values()) {
      if (execution.status === 'pending' && execution.scheduledTime <= now) {
        await this.executeScheduledBackup(execution);
      }
    }
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
  async scheduleNextExecution(scheduleId) {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || !schedule.enabled) {
      return;
    }
    try {
      const cronExpr = CronParser.parse(schedule.cronExpression);
      const nextTime = cronExpr.getNextExecution();
      if (await this.shouldSkipExecution(schedule, nextTime)) {
        const afterNext = cronExpr.getNextExecution(nextTime);
        await this.scheduleExecutionAt(scheduleId, afterNext);
        return;
      }
      await this.scheduleExecutionAt(scheduleId, nextTime);
    } catch (error) {
      console.error(`❌ Failed to schedule next execution for ${scheduleId}:`, error);
    }
  }
  async scheduleExecutionAt(scheduleId, time) {
    const executionId = this.generateExecutionId();
    const execution = {
      id: executionId,
      scheduleId,
      scheduledTime: time,
      status: 'pending',
      attempt: 1,
    };
    this.executions.set(executionId, execution);
    const history = this.executionHistory.get(scheduleId) || [];
    history.push(execution);
    this.executionHistory.set(scheduleId, history);
    this.emit('execution:scheduled', execution);
    console.log(`⏰ Execution scheduled: ${scheduleId} at ${time.toISOString()}`);
  }
  async shouldSkipExecution(schedule, time) {
    if (!schedule.conditions) {
      return false;
    }
    const conditions = schedule.conditions;
    if (conditions.blackoutPeriods) {
      for (const period of conditions.blackoutPeriods) {
        if (this.isTimeInWindow(time, period)) {
          console.log(`⏸️ Skipping execution due to blackout period: ${schedule.name}`);
          return true;
        }
      }
    }
    if (conditions.maintenanceWindows && conditions.maintenanceWindows.length > 0) {
      const inMaintenanceWindow = conditions.maintenanceWindows.some(window =>
        this.isTimeInWindow(time, window)
      );
      if (!inMaintenanceWindow) {
        console.log(`⏸️ Skipping execution - outside maintenance window: ${schedule.name}`);
        return true;
      }
    }
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
  isTimeInWindow(time, window) {
    const timeHour = time.getHours();
    const timeMinute = time.getMinutes();
    const timeInMinutes = timeHour * 60 + timeMinute;
    const [startHour, startMinute] = window.start.split(':').map(Number);
    const [endHour, endMinute] = window.end.split(':').map(Number);
    const startInMinutes = startHour * 60 + startMinute;
    const endInMinutes = endHour * 60 + endMinute;
    if (window.weekdays && window.weekdays.length > 0) {
      const dayOfWeek = time.getDay();
      if (!window.weekdays.includes(dayOfWeek)) {
        return false;
      }
    }
    if (startInMinutes <= endInMinutes) {
      return timeInMinutes >= startInMinutes && timeInMinutes <= endInMinutes;
    } else {
      return timeInMinutes >= startInMinutes || timeInMinutes <= endInMinutes;
    }
  }
  async executeScheduledBackup(execution) {
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
      const backupJobId = await this.backupService.createBackup(schedule.backupRequest);
      execution.backupJobId = backupJobId;
      const result = await this.waitForBackupCompletion(backupJobId);
      if (result.success) {
        execution.status = 'completed';
        this.emit('execution:completed', execution);
        if (schedule.notifications?.onSuccess) {
          await this.sendNotification(schedule, execution, 'success');
        }
        await this.scheduleNextExecution(execution.scheduleId);
      } else {
        execution.status = 'failed';
        execution.error = result.error;
        this.emit('execution:failed', execution);
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
  async waitForBackupCompletion(backupJobId) {
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
            setTimeout(checkStatus, 10000);
          }
        } catch (error) {
          resolve({ success: false, error: error.message });
        }
      };
      checkStatus();
    });
  }
  async handleExecutionFailure(execution, schedule) {
    const retryPolicy = schedule.retryPolicy;
    if (schedule.notifications?.onFailure) {
      await this.sendNotification(schedule, execution, 'failure');
    }
    if (retryPolicy.retryOnFailure && execution.attempt < retryPolicy.maxAttempts) {
      const baseDelay = retryPolicy.retryDelayMs;
      const backoffMultiplier = Math.pow(retryPolicy.backoffMultiplier, execution.attempt - 1);
      const delay = Math.min(baseDelay * backoffMultiplier, retryPolicy.maxRetryDelayMs);
      execution.nextRetryTime = new Date(Date.now() + delay);
      execution.status = 'failed';
      this.emit('execution:retry_scheduled', execution);
      console.log(
        `🔄 Retry scheduled for ${execution.scheduleId} in ${delay}ms (attempt ${execution.attempt}/${retryPolicy.maxAttempts})`
      );
      if (schedule.notifications?.onRetry) {
        await this.sendNotification(schedule, execution, 'retry');
      }
    } else {
      console.log(`❌ Execution failed permanently: ${execution.scheduleId} (${execution.error})`);
      await this.scheduleNextExecution(execution.scheduleId);
    }
  }
  async retryFailedExecution(execution) {
    execution.attempt++;
    execution.nextRetryTime = undefined;
    execution.status = 'pending';
    this.executions.set(execution.id, execution);
    console.log(`🔄 Retrying execution: ${execution.scheduleId} (attempt ${execution.attempt})`);
  }
  async sendNotification(schedule, execution, type) {
    if (!schedule.notifications) return;
    const message = this.buildNotificationMessage(schedule, execution, type);
    console.log(`📧 Notification [${type}]: ${message}`);
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
              break;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to send ${channel} notification:`, error);
        }
      }
    }
  }
  buildNotificationMessage(schedule, execution, type) {
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
  async sendWebhookNotification(url, message, type) {
    console.log(`🔗 Webhook notification to ${url}: ${message}`);
  }
  async sendEmailNotification(recipients, message, type) {
    console.log(`📧 Email notification to ${recipients.join(', ')}: ${message}`);
  }
  async loadSchedules() {
    console.log('📂 Loading schedules from storage...');
  }
  async saveSchedule(schedule) {
    console.log(`💾 Saving schedule: ${schedule.name}`);
  }
  async deleteSchedule(scheduleId) {
    console.log(`🗑️ Deleting schedule: ${scheduleId}`);
  }
}
exports.BackupScheduler = BackupScheduler;
function createCronExpression(options) {
  return [
    options.minute || '*',
    options.hour || '*',
    options.dayOfMonth || '*',
    options.month || '*',
    options.dayOfWeek || '*',
  ].join(' ');
}
function validateCronExpression(expression) {
  try {
    CronParser.parse(expression);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
function getNextExecutionTime(cronExpression, after) {
  const cron = CronParser.parse(cronExpression);
  return cron.getNextExecution(after);
}
exports.COMMON_SCHEDULES = {
  EVERY_MINUTE: '* * * * *',
  EVERY_HOUR: '0 * * * *',
  EVERY_DAY_MIDNIGHT: '0 0 * * *',
  EVERY_DAY_2AM: '0 2 * * *',
  EVERY_WEEK_SUNDAY_MIDNIGHT: '0 0 * * 0',
  EVERY_MONTH_FIRST_DAY: '0 0 1 * *',
  WEEKDAYS_6AM: '0 6 * * 1-5',
  BUSINESS_HOURS_EVERY_4H: '0 8,12,16 * * 1-5',
};
//# sourceMappingURL=BackupScheduler.js.map
