import {
  ReportScheduler,
  ScheduledReport,
  ScheduleDefinition,
  NotificationSettings,
  ScheduledReportResult,
  RetryPolicy
} from '../../../src/services/reporting/ReportScheduler';
import { ReportGenerator, ReportConfig, ReportResult } from '../../../src/services/reporting/ReportGenerator';
import { DataExporter, ExportConfig } from '../../../src/services/reporting/DataExporter';
import { Logger } from '../../../src/services/logger/Logger';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
} as unknown as Logger;

// Mock ReportGenerator
const mockReportGenerator = {
  generateReport: jest.fn()
} as unknown as ReportGenerator;

// Mock DataExporter
const mockDataExporter = {
  exportData: jest.fn()
} as unknown as DataExporter;

describe('ReportScheduler', () => {
  let scheduler: ReportScheduler;

  beforeEach(() => {
    scheduler = new ReportScheduler(
      mockLogger,
      mockReportGenerator,
      mockDataExporter,
      100, // 100ms check interval for testing
      10 // Max 10 history items per report
    );

    // Mock successful report generation
    (mockReportGenerator.generateReport as jest.Mock).mockResolvedValue({
      id: 'report-123',
      reportId: 'test-report',
      generatedAt: new Date(),
      status: 'success',
      data: [{ id: 1, value: 100 }],
      metadata: {
        rowCount: 1,
        executionTime: 500,
        dataSourceVersion: '1.0',
        parameters: {}
      }
    } as ReportResult);

    // Mock successful export
    (mockDataExporter.exportData as jest.Mock).mockResolvedValue('export-job-123');
  });

  afterEach(() => {
    scheduler.stop();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('lifecycle management', () => {
    it('should start and stop scheduler', () => {
      expect(scheduler['isRunning']).toBe(false);

      scheduler.start();
      expect(scheduler['isRunning']).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Report scheduler started');

      scheduler.stop();
      expect(scheduler['isRunning']).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Report scheduler stopped');
    });

    it('should not start if already running', () => {
      scheduler.start();
      scheduler.start(); // Second start should be ignored

      expect(mockLogger.warn).toHaveBeenCalledWith('Report scheduler is already running');
    });

    it('should emit lifecycle events', () => {
      const startedListener = jest.fn();
      const stoppedListener = jest.fn();

      scheduler.on('schedulerStarted', startedListener);
      scheduler.on('schedulerStopped', stoppedListener);

      scheduler.start();
      expect(startedListener).toHaveBeenCalled();

      scheduler.stop();
      expect(stoppedListener).toHaveBeenCalled();
    });
  });

  describe('scheduled report management', () => {
    const sampleReportConfig: ReportConfig = {
      id: 'test-report',
      name: 'Test Report',
      type: 'analytics',
      dataSource: 'test_db',
      format: 'json',
      parameters: {}
    };

    const sampleSchedule: ScheduleDefinition = {
      type: 'daily',
      time: '09:00',
      timezone: 'UTC'
    };

    const sampleNotifications: NotificationSettings = {
      onSuccess: [
        {
          type: 'email',
          recipients: ['admin@example.com']
        }
      ],
      onFailure: [
        {
          type: 'email',
          recipients: ['admin@example.com']
        }
      ]
    };

    describe('createScheduledReport', () => {
      it('should create a new scheduled report', () => {
        const scheduledReport = scheduler.createScheduledReport(
          sampleReportConfig,
          sampleSchedule,
          sampleNotifications,
          'test-user'
        );

        expect(scheduledReport.id).toBeDefined();
        expect(scheduledReport.name).toBe('Test Report');
        expect(scheduledReport.isActive).toBe(true);
        expect(scheduledReport.nextRun).toBeDefined();
        expect(scheduledReport.runCount).toBe(0);
        expect(scheduledReport.createdBy).toBe('test-user');
      });

      it('should calculate next run time', () => {
        const scheduledReport = scheduler.createScheduledReport(
          sampleReportConfig,
          sampleSchedule,
          sampleNotifications,
          'test-user'
        );

        expect(scheduledReport.nextRun).toBeDefined();
        // For daily schedule at 09:00, next run should be tomorrow at 09:00 or today if it's before 09:00
      });

      it('should emit scheduledReportCreated event', () => {
        const eventListener = jest.fn();
        scheduler.on('scheduledReportCreated', eventListener);

        const scheduledReport = scheduler.createScheduledReport(
          sampleReportConfig,
          sampleSchedule,
          sampleNotifications,
          'test-user'
        );

        expect(eventListener).toHaveBeenCalledWith(scheduledReport);
      });
    });

    describe('getScheduledReport', () => {
      it('should retrieve scheduled report by ID', () => {
        const created = scheduler.createScheduledReport(
          sampleReportConfig,
          sampleSchedule,
          sampleNotifications,
          'test-user'
        );

        const retrieved = scheduler.getScheduledReport(created.id);

        expect(retrieved).toBeTruthy();
        expect(retrieved?.id).toBe(created.id);
      });

      it('should return null for non-existent report', () => {
        const result = scheduler.getScheduledReport('non-existent');
        expect(result).toBeNull();
      });
    });

    describe('listScheduledReports', () => {
      beforeEach(() => {
        // Create test reports
        scheduler.createScheduledReport(
          sampleReportConfig,
          sampleSchedule,
          sampleNotifications,
          'user1'
        );

        const inactiveReport = scheduler.createScheduledReport(
          { ...sampleReportConfig, id: 'inactive-report' },
          sampleSchedule,
          sampleNotifications,
          'user2'
        );

        scheduler.updateScheduledReport(inactiveReport.id, { isActive: false });
      });

      it('should list all scheduled reports', () => {
        const reports = scheduler.listScheduledReports();
        expect(reports).toHaveLength(2);
      });

      it('should list only active reports when requested', () => {
        const activeReports = scheduler.listScheduledReports(true);
        expect(activeReports).toHaveLength(1);
        expect(activeReports[0].isActive).toBe(true);
      });
    });

    describe('updateScheduledReport', () => {
      it('should update scheduled report', () => {
        const created = scheduler.createScheduledReport(
          sampleReportConfig,
          sampleSchedule,
          sampleNotifications,
          'test-user'
        );

        const updated = scheduler.updateScheduledReport(created.id, {
          name: 'Updated Report Name',
          description: 'New description'
        });

        expect(updated).toBeTruthy();
        expect(updated?.name).toBe('Updated Report Name');
        expect(updated?.description).toBe('New description');
      });

      it('should recalculate next run when schedule is updated', () => {
        const created = scheduler.createScheduledReport(
          sampleReportConfig,
          sampleSchedule,
          sampleNotifications,
          'test-user'
        );

        const originalNextRun = created.nextRun;

        const newSchedule: ScheduleDefinition = {
          type: 'weekly',
          dayOfWeek: 1,
          time: '10:00'
        };

        const updated = scheduler.updateScheduledReport(created.id, {
          schedule: newSchedule
        });

        expect(updated?.nextRun).not.toEqual(originalNextRun);
      });
    });

    describe('deleteScheduledReport', () => {
      it('should delete scheduled report', () => {
        const created = scheduler.createScheduledReport(
          sampleReportConfig,
          sampleSchedule,
          sampleNotifications,
          'test-user'
        );

        const deleted = scheduler.deleteScheduledReport(created.id);
        expect(deleted).toBe(true);

        const retrieved = scheduler.getScheduledReport(created.id);
        expect(retrieved).toBeNull();
      });

      it('should return false for non-existent report', () => {
        const deleted = scheduler.deleteScheduledReport('non-existent');
        expect(deleted).toBe(false);
      });
    });

    describe('activate/deactivate', () => {
      it('should activate scheduled report', () => {
        const created = scheduler.createScheduledReport(
          sampleReportConfig,
          sampleSchedule,
          sampleNotifications,
          'test-user'
        );

        scheduler.updateScheduledReport(created.id, { isActive: false });

        const activated = scheduler.activateScheduledReport(created.id);
        expect(activated).toBe(true);

        const report = scheduler.getScheduledReport(created.id);
        expect(report?.isActive).toBe(true);
        expect(report?.nextRun).toBeDefined();
      });

      it('should deactivate scheduled report', () => {
        const created = scheduler.createScheduledReport(
          sampleReportConfig,
          sampleSchedule,
          sampleNotifications,
          'test-user'
        );

        const deactivated = scheduler.deactivateScheduledReport(created.id);
        expect(deactivated).toBe(true);

        const report = scheduler.getScheduledReport(created.id);
        expect(report?.isActive).toBe(false);
        expect(report?.nextRun).toBeUndefined();
      });
    });
  });

  describe('schedule execution', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should execute scheduled report when due', async () => {
      const futureDate = new Date(Date.now() + 1000); // 1 second in future
      const schedule: ScheduleDefinition = {
        type: 'interval',
        intervalMinutes: 1
      };

      const scheduledReport = scheduler.createScheduledReport(
        {
          id: 'test-report',
          name: 'Test Report',
          type: 'analytics',
          dataSource: 'test_db',
          format: 'json',
          parameters: {}
        },
        schedule,
        {
          onSuccess: [],
          onFailure: []
        },
        'test-user'
      );

      // Update nextRun to be now
      scheduler.updateScheduledReport(scheduledReport.id, {
        nextRun: new Date()
      });

      scheduler.start();

      // Fast-forward time to trigger execution
      jest.advanceTimersByTime(200);

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockReportGenerator.generateReport).toHaveBeenCalled();
    });

    it('should not execute inactive reports', async () => {
      const scheduledReport = scheduler.createScheduledReport(
        {
          id: 'inactive-report',
          name: 'Inactive Report',
          type: 'analytics',
          dataSource: 'test_db',
          format: 'json',
          parameters: {}
        },
        {
          type: 'interval',
          intervalMinutes: 1
        },
        {
          onSuccess: [],
          onFailure: []
        },
        'test-user'
      );

      scheduler.deactivateScheduledReport(scheduledReport.id);
      scheduler.start();

      jest.advanceTimersByTime(200);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockReportGenerator.generateReport).not.toHaveBeenCalled();
    });

    it('should update report statistics after execution', async () => {
      const scheduledReport = scheduler.createScheduledReport(
        {
          id: 'stats-report',
          name: 'Stats Report',
          type: 'analytics',
          dataSource: 'test_db',
          format: 'json',
          parameters: {}
        },
        {
          type: 'interval',
          intervalMinutes: 1
        },
        {
          onSuccess: [],
          onFailure: []
        },
        'test-user'
      );

      scheduler.updateScheduledReport(scheduledReport.id, {
        nextRun: new Date()
      });

      scheduler.start();
      jest.advanceTimersByTime(200);
      await new Promise(resolve => setTimeout(resolve, 50));

      const updated = scheduler.getScheduledReport(scheduledReport.id);
      expect(updated?.runCount).toBe(1);
      expect(updated?.successCount).toBe(1);
      expect(updated?.lastRun).toBeDefined();
    });

    it('should export report when export config is provided', async () => {
      const exportConfig: ExportConfig = {
        format: 'csv',
        options: {}
      };

      const scheduledReport = scheduler.createScheduledReport(
        {
          id: 'export-report',
          name: 'Export Report',
          type: 'analytics',
          dataSource: 'test_db',
          format: 'json',
          parameters: {}
        },
        {
          type: 'interval',
          intervalMinutes: 1
        },
        {
          onSuccess: [],
          onFailure: []
        },
        'test-user',
        exportConfig
      );

      scheduler.updateScheduledReport(scheduledReport.id, {
        nextRun: new Date()
      });

      scheduler.start();
      jest.advanceTimersByTime(200);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockDataExporter.exportData).toHaveBeenCalled();
    });
  });

  describe('error handling and retries', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should handle report generation failures', async () => {
      (mockReportGenerator.generateReport as jest.Mock).mockRejectedValueOnce(
        new Error('Report generation failed')
      );

      const scheduledReport = scheduler.createScheduledReport(
        {
          id: 'failing-report',
          name: 'Failing Report',
          type: 'analytics',
          dataSource: 'test_db',
          format: 'json',
          parameters: {}
        },
        {
          type: 'interval',
          intervalMinutes: 1
        },
        {
          onSuccess: [],
          onFailure: []
        },
        'test-user'
      );

      scheduler.updateScheduledReport(scheduledReport.id, {
        nextRun: new Date()
      });

      scheduler.start();
      jest.advanceTimersByTime(200);
      await new Promise(resolve => setTimeout(resolve, 100));

      const updated = scheduler.getScheduledReport(scheduledReport.id);
      expect(updated?.failureCount).toBe(1);
      expect(updated?.lastResult?.status).toBe('failed');
    });

    it('should retry failed reports according to retry policy', async () => {
      const retryPolicy: RetryPolicy = {
        maxRetries: 2,
        retryDelayMinutes: 1
      };

      (mockReportGenerator.generateReport as jest.Mock)
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce({
          id: 'retry-success',
          status: 'success',
          data: []
        } as ReportResult);

      const scheduledReport = scheduler.createScheduledReport(
        {
          id: 'retry-report',
          name: 'Retry Report',
          type: 'analytics',
          dataSource: 'test_db',
          format: 'json',
          parameters: {}
        },
        {
          type: 'interval',
          intervalMinutes: 1,
          retryPolicy
        },
        {
          onSuccess: [],
          onFailure: []
        },
        'test-user'
      );

      scheduler.updateScheduledReport(scheduledReport.id, {
        nextRun: new Date()
      });

      scheduler.start();

      // First execution (fails)
      jest.advanceTimersByTime(200);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Advance time for retry
      jest.advanceTimersByTime(60 * 1000); // 1 minute
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockReportGenerator.generateReport).toHaveBeenCalledTimes(2);
    });
  });

  describe('next run calculation', () => {
    it('should calculate daily next run correctly', () => {
      const schedule: ScheduleDefinition = {
        type: 'daily',
        time: '09:00'
      };

      const scheduledReport = scheduler.createScheduledReport(
        {
          id: 'daily-report',
          name: 'Daily Report',
          type: 'analytics',
          dataSource: 'test_db',
          format: 'json',
          parameters: {}
        },
        schedule,
        {
          onSuccess: [],
          onFailure: []
        },
        'test-user'
      );

      expect(scheduledReport.nextRun).toBeDefined();
      const nextRun = scheduledReport.nextRun!;
      expect(nextRun.getHours()).toBe(9);
      expect(nextRun.getMinutes()).toBe(0);
    });

    it('should calculate weekly next run correctly', () => {
      const schedule: ScheduleDefinition = {
        type: 'weekly',
        dayOfWeek: 1, // Monday
        time: '10:30'
      };

      const scheduledReport = scheduler.createScheduledReport(
        {
          id: 'weekly-report',
          name: 'Weekly Report',
          type: 'analytics',
          dataSource: 'test_db',
          format: 'json',
          parameters: {}
        },
        schedule,
        {
          onSuccess: [],
          onFailure: []
        },
        'test-user'
      );

      expect(scheduledReport.nextRun).toBeDefined();
      const nextRun = scheduledReport.nextRun!;
      expect(nextRun.getDay()).toBe(1); // Monday
      expect(nextRun.getHours()).toBe(10);
      expect(nextRun.getMinutes()).toBe(30);
    });

    it('should calculate interval next run correctly', () => {
      const schedule: ScheduleDefinition = {
        type: 'interval',
        intervalMinutes: 30
      };

      const now = new Date();
      const scheduledReport = scheduler.createScheduledReport(
        {
          id: 'interval-report',
          name: 'Interval Report',
          type: 'analytics',
          dataSource: 'test_db',
          format: 'json',
          parameters: {}
        },
        schedule,
        {
          onSuccess: [],
          onFailure: []
        },
        'test-user'
      );

      expect(scheduledReport.nextRun).toBeDefined();
      const nextRun = scheduledReport.nextRun!;
      const expectedTime = now.getTime() + (30 * 60 * 1000);
      expect(Math.abs(nextRun.getTime() - expectedTime)).toBeLessThan(1000); // Within 1 second
    });

    it('should respect start and end dates', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Next week

      const schedule: ScheduleDefinition = {
        type: 'daily',
        time: '09:00',
        startDate: futureDate,
        endDate: endDate
      };

      const scheduledReport = scheduler.createScheduledReport(
        {
          id: 'bounded-report',
          name: 'Bounded Report',
          type: 'analytics',
          dataSource: 'test_db',
          format: 'json',
          parameters: {}
        },
        schedule,
        {
          onSuccess: [],
          onFailure: []
        },
        'test-user'
      );

      expect(scheduledReport.nextRun).toBeDefined();
      expect(scheduledReport.nextRun!.getTime()).toBeGreaterThanOrEqual(futureDate.getTime());
    });
  });

  describe('execution history', () => {
    it('should track execution history', async () => {
      jest.useFakeTimers();

      const scheduledReport = scheduler.createScheduledReport(
        {
          id: 'history-report',
          name: 'History Report',
          type: 'analytics',
          dataSource: 'test_db',
          format: 'json',
          parameters: {}
        },
        {
          type: 'interval',
          intervalMinutes: 1
        },
        {
          onSuccess: [],
          onFailure: []
        },
        'test-user'
      );

      scheduler.updateScheduledReport(scheduledReport.id, {
        nextRun: new Date()
      });

      scheduler.start();
      jest.advanceTimersByTime(200);
      await new Promise(resolve => setTimeout(resolve, 50));

      const history = scheduler.getExecutionHistory(scheduledReport.id);
      expect(history).toHaveLength(1);
      expect(history[0].scheduledReportId).toBe(scheduledReport.id);
    });

    it('should limit execution history size', async () => {
      const smallHistoryScheduler = new ReportScheduler(
        mockLogger,
        mockReportGenerator,
        mockDataExporter,
        100,
        2 // Max 2 history items
      );

      const scheduledReport = smallHistoryScheduler.createScheduledReport(
        {
          id: 'limited-history',
          name: 'Limited History Report',
          type: 'analytics',
          dataSource: 'test_db',
          format: 'json',
          parameters: {}
        },
        {
          type: 'interval',
          intervalMinutes: 1
        },
        {
          onSuccess: [],
          onFailure: []
        },
        'test-user'
      );

      // Simulate 3 executions
      for (let i = 0; i < 3; i++) {
        const execution: ScheduledReportResult = {
          id: `exec-${i}`,
          scheduledReportId: scheduledReport.id,
          executionId: `exec-${i}`,
          startTime: new Date(),
          status: 'success',
          retryCount: 0,
          metadata: {}
        };

        smallHistoryScheduler['addToHistory'](scheduledReport.id, execution);
      }

      const history = smallHistoryScheduler.getExecutionHistory(scheduledReport.id);
      expect(history).toHaveLength(2); // Should be limited to 2
    });
  });

  describe('metrics', () => {
    beforeEach(() => {
      // Create test reports
      scheduler.createScheduledReport(
        {
          id: 'metrics-report-1',
          name: 'Metrics Report 1',
          type: 'analytics',
          dataSource: 'test_db',
          format: 'json',
          parameters: {}
        },
        {
          type: 'daily',
          time: '09:00'
        },
        {
          onSuccess: [],
          onFailure: []
        },
        'test-user'
      );

      const inactiveReport = scheduler.createScheduledReport(
        {
          id: 'metrics-report-2',
          name: 'Metrics Report 2',
          type: 'analytics',
          dataSource: 'test_db',
          format: 'json',
          parameters: {}
        },
        {
          type: 'weekly',
          dayOfWeek: 1,
          time: '10:00'
        },
        {
          onSuccess: [],
          onFailure: []
        },
        'test-user'
      );

      scheduler.deactivateScheduledReport(inactiveReport.id);
    });

    it('should calculate metrics correctly', () => {
      const metrics = scheduler.getMetrics();

      expect(metrics.totalScheduledReports).toBe(2);
      expect(metrics.activeScheduledReports).toBe(1);
      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.successfulExecutions).toBe(0);
      expect(metrics.failedExecutions).toBe(0);
      expect(metrics.queuedExecutions).toBe(0);
    });
  });

  describe('active execution management', () => {
    it('should track active executions', () => {
      const activeExecutions = scheduler.getActiveExecutions();
      expect(activeExecutions).toEqual([]);
    });

    it('should cancel active execution', () => {
      // This would require mocking an active execution
      // For now, test that cancelling non-existent execution returns false
      const cancelled = scheduler.cancelExecution('non-existent');
      expect(cancelled).toBe(false);
    });
  });
});