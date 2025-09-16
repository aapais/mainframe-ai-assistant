"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportingSystem = void 0;
exports.createReportingSystem = createReportingSystem;
exports.getReportingSystem = getReportingSystem;
exports.destroyReportingSystem = destroyReportingSystem;
const tslib_1 = require("tslib");
tslib_1.__exportStar(require("./ReportGenerator"), exports);
tslib_1.__exportStar(require("./CustomReportBuilder"), exports);
tslib_1.__exportStar(require("./DataExporter"), exports);
tslib_1.__exportStar(require("./ReportScheduler"), exports);
tslib_1.__exportStar(require("./AlertManager"), exports);
const events_1 = require("events");
const ReportGenerator_1 = require("./ReportGenerator");
const CustomReportBuilder_1 = require("./CustomReportBuilder");
const DataExporter_1 = require("./DataExporter");
const ReportScheduler_1 = require("./ReportScheduler");
const AlertManager_1 = require("./AlertManager");
class ReportingSystem extends events_1.EventEmitter {
    logger;
    config;
    startTime;
    reportGenerator;
    customReportBuilder;
    dataExporter;
    reportScheduler;
    alertManager;
    isInitialized = false;
    constructor(logger, config = {}) {
        super();
        this.logger = logger;
        this.startTime = new Date();
        this.config = {
            outputDirectory: config.outputDirectory || './exports',
            maxConcurrentExports: config.maxConcurrentExports || 5,
            schedulerCheckInterval: config.schedulerCheckInterval || 60000,
            alertEvaluationInterval: config.alertEvaluationInterval || 60000,
            maxHistoryPerReport: config.maxHistoryPerReport || 100,
            maxCacheSize: config.maxCacheSize || 100
        };
        this.reportGenerator = new ReportGenerator_1.ReportGenerator(logger, this.config.maxCacheSize);
        this.customReportBuilder = new CustomReportBuilder_1.CustomReportBuilder(logger);
        this.dataExporter = new DataExporter_1.DataExporter(logger, this.config.outputDirectory, this.config.maxConcurrentExports);
        this.reportScheduler = new ReportScheduler_1.ReportScheduler(logger, this.reportGenerator, this.dataExporter, this.config.schedulerCheckInterval, this.config.maxHistoryPerReport);
        this.alertManager = new AlertManager_1.AlertManager(logger, this.config.alertEvaluationInterval, this.config.maxHistoryPerReport);
        this.setupEventHandlers();
    }
    async initialize() {
        if (this.isInitialized) {
            this.logger.warn('Reporting system is already initialized');
            return;
        }
        try {
            this.logger.info('Initializing reporting system...');
            this.reportScheduler.start();
            this.alertManager.start();
            this.isInitialized = true;
            this.logger.info('Reporting system initialized successfully');
            this.emit('systemInitialized');
        }
        catch (error) {
            this.logger.error('Failed to initialize reporting system', error);
            this.emit('systemError', error);
            throw error;
        }
    }
    async shutdown() {
        if (!this.isInitialized) {
            return;
        }
        try {
            this.logger.info('Shutting down reporting system...');
            this.reportScheduler.stop();
            this.alertManager.stop();
            this.reportGenerator.clearCache();
            this.isInitialized = false;
            this.logger.info('Reporting system shutdown complete');
            this.emit('systemShutdown');
        }
        catch (error) {
            this.logger.error('Error during reporting system shutdown', error);
            this.emit('systemError', error);
        }
    }
    registerDataSource(name, connector) {
        this.reportGenerator.registerDataSource(name, connector);
        this.logger.info(`Data source registered in reporting system: ${name}`);
    }
    getSystemMetrics() {
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
                averageReportGenerationTime: 0,
                averageExportTime: 0,
                averageAlertResponseTime: alertMetrics.averageResolutionTime
            }
        };
    }
    async healthCheck() {
        const health = {
            status: 'healthy',
            details: {
                initialized: this.isInitialized,
                scheduler: {
                    running: this.reportScheduler['isRunning'],
                    activeReports: this.reportScheduler.getActiveReports().length,
                    queuedExecutions: this.reportScheduler.getMetrics().queuedExecutions
                },
                alertManager: {
                    running: this.alertManager['isRunning'],
                    activeRules: this.alertManager.listAlertRules(true).length,
                    activeAlerts: this.alertManager.getActiveAlerts().length
                },
                dataExporter: {
                    supportedFormats: this.dataExporter.getSupportedFormats(),
                    activeJobs: this.dataExporter.listJobs('processing').length
                },
                cache: {
                    reportCacheSize: this.reportGenerator['reportCache'].size,
                    maxCacheSize: this.config.maxCacheSize
                }
            }
        };
        if (!this.isInitialized) {
            health.status = 'unhealthy';
        }
        else if (health.details.scheduler.queuedExecutions > 10 ||
            health.details.dataExporter.activeJobs > this.config.maxConcurrentExports ||
            health.details.cache.reportCacheSize >= this.config.maxCacheSize) {
            health.status = 'degraded';
        }
        return health;
    }
    getConfiguration() {
        return { ...this.config };
    }
    updateConfiguration(updates) {
        Object.assign(this.config, updates);
        this.logger.info('Reporting system configuration updated', updates);
        this.emit('configurationUpdated', this.config);
    }
    setupEventHandlers() {
        this.reportGenerator.on('reportStarted', (event) => {
            this.emit('reportStarted', event);
        });
        this.reportGenerator.on('reportCompleted', (event) => {
            this.emit('reportCompleted', event);
        });
        this.reportGenerator.on('reportError', (event) => {
            this.emit('reportError', event);
        });
        this.customReportBuilder.on('templateCreated', (event) => {
            this.emit('templateCreated', event);
        });
        this.customReportBuilder.on('builderCreated', (event) => {
            this.emit('builderCreated', event);
        });
        this.dataExporter.on('jobCreated', (event) => {
            this.emit('exportJobCreated', event);
        });
        this.dataExporter.on('jobCompleted', (event) => {
            this.emit('exportJobCompleted', event);
        });
        this.dataExporter.on('jobFailed', (event) => {
            this.emit('exportJobFailed', event);
        });
        this.reportScheduler.on('scheduledReportCreated', (event) => {
            this.emit('scheduledReportCreated', event);
        });
        this.reportScheduler.on('executionStarted', (event) => {
            this.emit('scheduledExecutionStarted', event);
        });
        this.reportScheduler.on('executionCompleted', (event) => {
            this.emit('scheduledExecutionCompleted', event);
        });
        this.reportScheduler.on('executionFailed', (event) => {
            this.emit('scheduledExecutionFailed', event);
        });
        this.alertManager.on('alertRuleCreated', (event) => {
            this.emit('alertRuleCreated', event);
        });
        this.alertManager.on('alertTriggered', (event) => {
            this.emit('alertTriggered', event);
        });
        this.alertManager.on('alertResolved', (event) => {
            this.emit('alertResolved', event);
        });
        this.alertManager.on('alertAcknowledged', (event) => {
            this.emit('alertAcknowledged', event);
        });
    }
    async generateQuickReport(name, dataSource, fields, format = 'json') {
        const config = {
            id: `quick_${Date.now()}`,
            name,
            type: 'custom',
            dataSource,
            format,
            parameters: {}
        };
        return await this.reportGenerator.generateReport(config);
    }
    async quickExport(data, format, fileName) {
        const config = {
            format,
            fileName,
            options: {}
        };
        return await this.dataExporter.exportData(data, config);
    }
    createQuickAlert(name, dataSource, metric, threshold, comparison = 'gt', notificationEmails = []) {
        return this.alertManager.createAlertRule(name, dataSource, {
            type: 'threshold',
            metric,
            comparison,
            value: threshold
        }, [
            {
                severity: 'high',
                condition: {
                    type: 'threshold',
                    metric,
                    comparison,
                    value: threshold
                },
                message: `${metric} ${comparison} ${threshold}`,
                autoResolve: true
            }
        ], notificationEmails.map(email => ({
            type: 'email',
            recipients: [email]
        })), {
            timezone: 'UTC'
        }, 'system');
    }
}
exports.ReportingSystem = ReportingSystem;
let reportingSystemInstance = null;
function createReportingSystem(logger, config) {
    if (reportingSystemInstance) {
        throw new Error('Reporting system instance already exists. Use getReportingSystem() to access it.');
    }
    reportingSystemInstance = new ReportingSystem(logger, config);
    return reportingSystemInstance;
}
function getReportingSystem() {
    if (!reportingSystemInstance) {
        throw new Error('Reporting system not initialized. Call createReportingSystem() first.');
    }
    return reportingSystemInstance;
}
function destroyReportingSystem() {
    if (reportingSystemInstance) {
        reportingSystemInstance.shutdown();
        reportingSystemInstance = null;
    }
}
//# sourceMappingURL=index.js.map