import {
  ReportingSystem,
  createReportingSystem,
  getReportingSystem,
  destroyReportingSystem,
  ReportingSystemConfig
} from '../../../src/services/reporting';
import { Logger } from '../../../src/services/logger/Logger';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
} as unknown as Logger;

describe('ReportingSystem', () => {
  let reportingSystem: ReportingSystem;

  beforeEach(() => {
    // Clear any existing instance
    destroyReportingSystem();
  });

  afterEach(() => {
    if (reportingSystem) {
      reportingSystem.shutdown();
    }
    destroyReportingSystem();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create reporting system with default config', () => {
      reportingSystem = new ReportingSystem(mockLogger);

      expect(reportingSystem.reportGenerator).toBeDefined();
      expect(reportingSystem.customReportBuilder).toBeDefined();
      expect(reportingSystem.dataExporter).toBeDefined();
      expect(reportingSystem.reportScheduler).toBeDefined();
      expect(reportingSystem.alertManager).toBeDefined();
    });

    it('should create reporting system with custom config', () => {
      const config: ReportingSystemConfig = {
        outputDirectory: '/custom/exports',
        maxConcurrentExports: 10,
        schedulerCheckInterval: 30000,
        maxCacheSize: 200
      };

      reportingSystem = new ReportingSystem(mockLogger, config);

      const systemConfig = reportingSystem.getConfiguration();
      expect(systemConfig.outputDirectory).toBe('/custom/exports');
      expect(systemConfig.maxConcurrentExports).toBe(10);
      expect(systemConfig.schedulerCheckInterval).toBe(30000);
      expect(systemConfig.maxCacheSize).toBe(200);
    });

    it('should initialize successfully', async () => {
      reportingSystem = new ReportingSystem(mockLogger);

      await reportingSystem.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('Initializing reporting system...');
      expect(mockLogger.info).toHaveBeenCalledWith('Reporting system initialized successfully');
    });

    it('should not initialize twice', async () => {
      reportingSystem = new ReportingSystem(mockLogger);

      await reportingSystem.initialize();
      await reportingSystem.initialize(); // Second call

      expect(mockLogger.warn).toHaveBeenCalledWith('Reporting system is already initialized');
    });

    it('should emit systemInitialized event', async () => {
      reportingSystem = new ReportingSystem(mockLogger);

      const eventListener = jest.fn();
      reportingSystem.on('systemInitialized', eventListener);

      await reportingSystem.initialize();

      expect(eventListener).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      reportingSystem = new ReportingSystem(mockLogger);
      await reportingSystem.initialize();

      await reportingSystem.shutdown();

      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down reporting system...');
      expect(mockLogger.info).toHaveBeenCalledWith('Reporting system shutdown complete');
    });

    it('should emit systemShutdown event', async () => {
      reportingSystem = new ReportingSystem(mockLogger);
      await reportingSystem.initialize();

      const eventListener = jest.fn();
      reportingSystem.on('systemShutdown', eventListener);

      await reportingSystem.shutdown();

      expect(eventListener).toHaveBeenCalled();
    });

    it('should handle shutdown when not initialized', async () => {
      reportingSystem = new ReportingSystem(mockLogger);

      // Should not throw
      await reportingSystem.shutdown();

      expect(mockLogger.info).not.toHaveBeenCalledWith('Shutting down reporting system...');
    });
  });

  describe('data source management', () => {
    it('should register data source', () => {
      reportingSystem = new ReportingSystem(mockLogger);

      const mockConnector = {
        connect: jest.fn(),
        disconnect: jest.fn(),
        executeQuery: jest.fn(),
        getSchema: jest.fn(),
        validateConnection: jest.fn()
      };

      reportingSystem.registerDataSource('test_db', mockConnector);

      expect(mockLogger.info).toHaveBeenCalledWith('Data source registered in reporting system: test_db');
    });
  });

  describe('metrics and health', () => {
    beforeEach(async () => {
      reportingSystem = new ReportingSystem(mockLogger);
      await reportingSystem.initialize();
    });

    it('should get system metrics', () => {
      const metrics = reportingSystem.getSystemMetrics();

      expect(metrics).toHaveProperty('totalReports');
      expect(metrics).toHaveProperty('totalScheduledReports');
      expect(metrics).toHaveProperty('totalAlertRules');
      expect(metrics).toHaveProperty('activeExportJobs');
      expect(metrics).toHaveProperty('activeAlerts');
      expect(metrics).toHaveProperty('systemUptime');
      expect(metrics).toHaveProperty('performance');

      expect(typeof metrics.systemUptime).toBe('number');
      expect(metrics.systemUptime).toBeGreaterThan(0);
    });

    it('should perform health check', async () => {
      const health = await reportingSystem.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details).toHaveProperty('initialized');
      expect(health.details).toHaveProperty('scheduler');
      expect(health.details).toHaveProperty('alertManager');
      expect(health.details).toHaveProperty('dataExporter');
      expect(health.details).toHaveProperty('cache');

      expect(health.details.initialized).toBe(true);
    });

    it('should report unhealthy when not initialized', async () => {
      const uninitializedSystem = new ReportingSystem(mockLogger);
      const health = await uninitializedSystem.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.details.initialized).toBe(false);
    });
  });

  describe('configuration management', () => {
    it('should get configuration', () => {
      reportingSystem = new ReportingSystem(mockLogger);

      const config = reportingSystem.getConfiguration();

      expect(config).toHaveProperty('outputDirectory');
      expect(config).toHaveProperty('maxConcurrentExports');
      expect(config).toHaveProperty('schedulerCheckInterval');
      expect(config).toHaveProperty('alertEvaluationInterval');
    });

    it('should update configuration', () => {
      reportingSystem = new ReportingSystem(mockLogger);

      const eventListener = jest.fn();
      reportingSystem.on('configurationUpdated', eventListener);

      const updates = {
        maxConcurrentExports: 15,
        schedulerCheckInterval: 45000
      };

      reportingSystem.updateConfiguration(updates);

      const config = reportingSystem.getConfiguration();
      expect(config.maxConcurrentExports).toBe(15);
      expect(config.schedulerCheckInterval).toBe(45000);

      expect(eventListener).toHaveBeenCalledWith(expect.objectContaining(updates));
    });
  });

  describe('event forwarding', () => {
    beforeEach(async () => {
      reportingSystem = new ReportingSystem(mockLogger);
      await reportingSystem.initialize();
    });

    it('should forward report generator events', () => {
      const reportStartedListener = jest.fn();
      const reportCompletedListener = jest.fn();

      reportingSystem.on('reportStarted', reportStartedListener);
      reportingSystem.on('reportCompleted', reportCompletedListener);

      // Simulate events from report generator
      reportingSystem.reportGenerator.emit('reportStarted', { reportId: 'test' });
      reportingSystem.reportGenerator.emit('reportCompleted', { reportId: 'test' });

      expect(reportStartedListener).toHaveBeenCalled();
      expect(reportCompletedListener).toHaveBeenCalled();
    });

    it('should forward alert manager events', () => {
      const alertTriggeredListener = jest.fn();
      const alertResolvedListener = jest.fn();

      reportingSystem.on('alertTriggered', alertTriggeredListener);
      reportingSystem.on('alertResolved', alertResolvedListener);

      // Simulate events from alert manager
      reportingSystem.alertManager.emit('alertTriggered', { alertId: 'test' });
      reportingSystem.alertManager.emit('alertResolved', { alertId: 'test' });

      expect(alertTriggeredListener).toHaveBeenCalled();
      expect(alertResolvedListener).toHaveBeenCalled();
    });
  });

  describe('quick access methods', () => {
    beforeEach(async () => {
      reportingSystem = new ReportingSystem(mockLogger);
      await reportingSystem.initialize();

      // Mock the report generator
      reportingSystem.reportGenerator.generateReport = jest.fn().mockResolvedValue({
        id: 'quick-report',
        status: 'success',
        data: [{ id: 1, name: 'Test' }]
      });

      // Mock the data exporter
      reportingSystem.dataExporter.exportData = jest.fn().mockResolvedValue('export-job-123');
    });

    it('should generate quick report', async () => {
      const result = await reportingSystem.generateQuickReport(
        'Quick Test Report',
        'test_db',
        ['id', 'name'],
        'json'
      );

      expect(reportingSystem.reportGenerator.generateReport).toHaveBeenCalledWith({
        id: expect.stringMatching(/^quick_\d+$/),
        name: 'Quick Test Report',
        type: 'custom',
        dataSource: 'test_db',
        format: 'json',
        parameters: {}
      });

      expect(result.status).toBe('success');
    });

    it('should perform quick export', async () => {
      const testData = [{ id: 1, name: 'Test' }];
      const jobId = await reportingSystem.quickExport(testData, 'csv', 'test-export.csv');

      expect(reportingSystem.dataExporter.exportData).toHaveBeenCalledWith(testData, {
        format: 'csv',
        fileName: 'test-export.csv',
        options: {}
      });

      expect(jobId).toBe('export-job-123');
    });

    it('should create quick alert', () => {
      const rule = reportingSystem.createQuickAlert(
        'High CPU Alert',
        'monitoring_db',
        'cpu_usage',
        80,
        'gt',
        ['admin@example.com']
      );

      expect(rule.name).toBe('High CPU Alert');
      expect(rule.dataSource).toBe('monitoring_db');
      expect(rule.condition.metric).toBe('cpu_usage');
      expect(rule.condition.value).toBe(80);
      expect(rule.condition.comparison).toBe('gt');
      expect(rule.notifications).toHaveLength(1);
      expect(rule.notifications[0].recipients).toContain('admin@example.com');
    });
  });

  describe('singleton factory', () => {
    it('should create singleton instance', () => {
      const instance = createReportingSystem(mockLogger);

      expect(instance).toBeInstanceOf(ReportingSystem);
      expect(getReportingSystem()).toBe(instance);
    });

    it('should throw when creating second instance', () => {
      createReportingSystem(mockLogger);

      expect(() => {
        createReportingSystem(mockLogger);
      }).toThrow('Reporting system instance already exists');
    });

    it('should throw when getting non-existent instance', () => {
      expect(() => {
        getReportingSystem();
      }).toThrow('Reporting system not initialized');
    });

    it('should destroy singleton instance', () => {
      const instance = createReportingSystem(mockLogger);
      instance.shutdown = jest.fn();

      destroyReportingSystem();

      expect(instance.shutdown).toHaveBeenCalled();
      expect(() => {
        getReportingSystem();
      }).toThrow('Reporting system not initialized');
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors', async () => {
      reportingSystem = new ReportingSystem(mockLogger);

      // Mock scheduler start to throw error
      reportingSystem.reportScheduler.start = jest.fn().mockImplementation(() => {
        throw new Error('Scheduler start failed');
      });

      const errorListener = jest.fn();
      reportingSystem.on('systemError', errorListener);

      await expect(reportingSystem.initialize()).rejects.toThrow('Scheduler start failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize reporting system',
        expect.any(Error)
      );
      expect(errorListener).toHaveBeenCalled();
    });

    it('should handle shutdown errors', async () => {
      reportingSystem = new ReportingSystem(mockLogger);
      await reportingSystem.initialize();

      // Mock scheduler stop to throw error
      reportingSystem.reportScheduler.stop = jest.fn().mockImplementation(() => {
        throw new Error('Scheduler stop failed');
      });

      const errorListener = jest.fn();
      reportingSystem.on('systemError', errorListener);

      await reportingSystem.shutdown();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during reporting system shutdown',
        expect.any(Error)
      );
      expect(errorListener).toHaveBeenCalled();
    });
  });
});