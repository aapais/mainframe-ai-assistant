'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ReportScheduler = void 0;
const events_1 = require('events');
class ReportScheduler extends events_1.EventEmitter {
  logger;
  reportGenerator;
  dataExporter;
  scheduledReports;
  activeExecutions;
  executionHistory;
  maxHistoryPerReport;
  schedulerTimer;
  checkIntervalMs;
  isRunning = false;
  constructor(
    logger,
    reportGenerator,
    dataExporter,
    checkIntervalMs = 60000,
    maxHistoryPerReport = 100
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
  start() {
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
  stop() {
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
  createScheduledReport(
    reportConfig,
    schedule,
    notificationSettings,
    createdBy,
    exportConfig,
    name,
    description
  ) {
    const scheduledReport = {
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
      failureCount: 0,
    };
    this.scheduledReports.set(scheduledReport.id, scheduledReport);
    this.executionHistory.set(scheduledReport.id, []);
    this.logger.info(`Scheduled report created: ${scheduledReport.name} (${scheduledReport.id})`);
    this.emit('scheduledReportCreated', scheduledReport);
    return scheduledReport;
  }
  getScheduledReport(id) {
    return this.scheduledReports.get(id) || null;
  }
  listScheduledReports(activeOnly = false) {
    const reports = Array.from(this.scheduledReports.values());
    return activeOnly ? reports.filter(r => r.isActive) : reports;
  }
  updateScheduledReport(id, updates) {
    const report = this.scheduledReports.get(id);
    if (!report) {
      return null;
    }
    if (updates.schedule) {
      updates.nextRun = this.calculateNextRun(updates.schedule);
    }
    Object.assign(report, updates);
    this.emit('scheduledReportUpdated', report);
    return report;
  }
  deleteScheduledReport(id) {
    const deleted = this.scheduledReports.delete(id);
    if (deleted) {
      this.executionHistory.delete(id);
      this.logger.info(`Scheduled report deleted: ${id}`);
      this.emit('scheduledReportDeleted', { id });
    }
    return deleted;
  }
  activateScheduledReport(id) {
    const report = this.scheduledReports.get(id);
    if (!report) {
      return false;
    }
    report.isActive = true;
    report.nextRun = this.calculateNextRun(report.schedule);
    this.emit('scheduledReportActivated', report);
    return true;
  }
  deactivateScheduledReport(id) {
    const report = this.scheduledReports.get(id);
    if (!report) {
      return false;
    }
    report.isActive = false;
    report.nextRun = undefined;
    this.emit('scheduledReportDeactivated', report);
    return true;
  }
  async checkScheduledReports() {
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
  async executeScheduledReport(scheduledReport) {
    const executionId = this.generateId();
    const execution = {
      id: executionId,
      scheduledReportId: scheduledReport.id,
      executionId,
      startTime: new Date(),
      status: 'running',
      retryCount: 0,
      metadata: {
        scheduledTime: scheduledReport.nextRun,
        actualExecutionTime: new Date(),
      },
    };
    this.activeExecutions.set(executionId, execution);
    this.addToHistory(scheduledReport.id, execution);
    scheduledReport.lastRun = new Date();
    scheduledReport.runCount++;
    scheduledReport.nextRun = this.calculateNextRun(
      scheduledReport.schedule,
      scheduledReport.lastRun
    );
    this.logger.info(`Executing scheduled report: ${scheduledReport.name} (${executionId})`);
    this.emit('executionStarted', execution);
    try {
      const reportResult = await this.reportGenerator.generateReport(scheduledReport.reportConfig);
      execution.reportResult = reportResult;
      if (scheduledReport.exportConfig && reportResult.status === 'success') {
        const exportJobId = await this.dataExporter.exportData(
          reportResult.data,
          scheduledReport.exportConfig
        );
        execution.exportResult = { jobId: exportJobId };
      }
      execution.status = 'success';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      scheduledReport.successCount++;
      scheduledReport.lastResult = execution;
      this.logger.info(`Scheduled report execution completed: ${executionId}`);
      this.emit('executionCompleted', execution);
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
      if (
        scheduledReport.schedule.retryPolicy &&
        execution.retryCount < scheduledReport.schedule.retryPolicy.maxRetries
      ) {
        await this.scheduleRetry(scheduledReport, execution);
      } else {
        await this.sendNotifications(scheduledReport, execution, 'failure');
      }
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }
  async scheduleRetry(scheduledReport, execution) {
    const retryPolicy = scheduledReport.schedule.retryPolicy;
    const retryDelay = this.calculateRetryDelay(execution.retryCount, retryPolicy);
    this.logger.info(`Scheduling retry for ${scheduledReport.id} in ${retryDelay} minutes`);
    setTimeout(
      async () => {
        try {
          execution.retryCount++;
          execution.status = 'retrying';
          this.emit('executionRetrying', execution);
          await this.executeScheduledReport(scheduledReport);
        } catch (error) {
          this.logger.error(`Retry failed for scheduled report: ${scheduledReport.id}`, error);
        }
      },
      retryDelay * 60 * 1000
    );
    await this.sendNotifications(scheduledReport, execution, 'retry');
  }
  calculateRetryDelay(retryCount, retryPolicy) {
    let delay = retryPolicy.retryDelayMinutes;
    if (retryPolicy.backoffMultiplier && retryPolicy.backoffMultiplier > 1) {
      delay = delay * Math.pow(retryPolicy.backoffMultiplier, retryCount);
    }
    if (retryPolicy.maxDelayMinutes) {
      delay = Math.min(delay, retryPolicy.maxDelayMinutes);
    }
    return delay;
  }
  async sendNotifications(scheduledReport, execution, type) {
    let notifications = [];
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
  async sendNotification(scheduledReport, execution, config, type) {
    const notificationData = {
      reportName: scheduledReport.name,
      executionId: execution.id,
      status: execution.status,
      startTime: execution.startTime,
      endTime: execution.endTime,
      duration: execution.duration,
      error: execution.error,
      retryCount: execution.retryCount,
      type,
    };
    switch (config.type) {
      case 'email':
        await this.sendEmailNotification(
          config.recipients,
          notificationData,
          scheduledReport,
          execution
        );
        break;
      case 'webhook':
        await this.sendWebhookNotification(config.recipients[0], notificationData);
        break;
      case 'slack':
        await this.sendSlackNotification(config.recipients[0], notificationData);
        break;
    }
    this.logger.info(`${type} notification sent via ${config.type} for ${scheduledReport.id}`);
  }
  async sendEmailNotification(recipients, data, scheduledReport, execution) {
    this.logger.info(`Email notification would be sent to: ${recipients.join(', ')}`);
  }
  async sendWebhookNotification(url, data) {
    this.logger.info(`Webhook notification would be sent to: ${url}`);
  }
  async sendSlackNotification(webhook, data) {
    this.logger.info(`Slack notification would be sent to webhook`);
  }
  calculateNextRun(schedule, fromDate) {
    const baseDate = fromDate || new Date();
    if (schedule.endDate && baseDate >= schedule.endDate) {
      return undefined;
    }
    let nextRun;
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
        nextRun = this.calculateWeeklyNextRun(
          baseDate,
          schedule.dayOfWeek || 1,
          schedule.time || '09:00'
        );
        break;
      case 'monthly':
        nextRun = this.calculateMonthlyNextRun(
          baseDate,
          schedule.dayOfMonth || 1,
          schedule.time || '09:00'
        );
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
    if (schedule.timezone) {
      nextRun = new Date(nextRun.toLocaleString('en-US', { timeZone: schedule.timezone }));
    }
    if (schedule.startDate && nextRun < schedule.startDate) {
      nextRun = schedule.startDate;
    }
    if (schedule.endDate && nextRun > schedule.endDate) {
      return undefined;
    }
    return nextRun;
  }
  calculateDailyNextRun(baseDate, time) {
    const [hours, minutes] = time.split(':').map(Number);
    const nextRun = new Date(baseDate);
    nextRun.setHours(hours, minutes, 0, 0);
    if (nextRun <= baseDate) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    return nextRun;
  }
  calculateWeeklyNextRun(baseDate, dayOfWeek, time) {
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
  calculateMonthlyNextRun(baseDate, dayOfMonth, time) {
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
  calculateCronNextRun(baseDate, cronExpression) {
    throw new Error('Cron scheduling requires additional dependencies (cron-parser)');
  }
  addToHistory(scheduledReportId, execution) {
    let history = this.executionHistory.get(scheduledReportId);
    if (!history) {
      history = [];
      this.executionHistory.set(scheduledReportId, history);
    }
    history.unshift(execution);
    if (history.length > this.maxHistoryPerReport) {
      history.splice(this.maxHistoryPerReport);
    }
  }
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  getExecutionHistory(scheduledReportId, limit) {
    const history = this.executionHistory.get(scheduledReportId) || [];
    return limit ? history.slice(0, limit) : history;
  }
  getActiveExecutions() {
    return Array.from(this.activeExecutions.values());
  }
  cancelExecution(executionId) {
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
  getMetrics() {
    const allReports = Array.from(this.scheduledReports.values());
    const activeReports = allReports.filter(r => r.isActive);
    const totalExecutions = allReports.reduce((sum, r) => sum + r.runCount, 0);
    const successfulExecutions = allReports.reduce((sum, r) => sum + r.successCount, 0);
    const failedExecutions = allReports.reduce((sum, r) => sum + r.failureCount, 0);
    const recentExecutions = Array.from(this.executionHistory.values())
      .flat()
      .filter(e => e.duration !== undefined)
      .slice(0, 100);
    const averageExecutionTime =
      recentExecutions.length > 0
        ? recentExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) / recentExecutions.length
        : 0;
    const nextExecutions = activeReports
      .map(r => r.nextRun)
      .filter(d => d !== undefined)
      .sort((a, b) => a.getTime() - b.getTime());
    return {
      totalScheduledReports: allReports.length,
      activeScheduledReports: activeReports.length,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      nextExecutionTime: nextExecutions[0],
      queuedExecutions: this.activeExecutions.size,
    };
  }
}
exports.ReportScheduler = ReportScheduler;
//# sourceMappingURL=ReportScheduler.js.map
