'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.BACKUP_CONSTANTS =
  exports.ScheduleError =
  exports.RestoreError =
  exports.BackupValidationError =
  exports.BackupServiceError =
  exports.BackupConfigurations =
  exports.BackupServiceFactory =
  exports.formatValidationReport =
  exports.createQuickValidationConfig =
  exports.createDefaultValidationConfig =
  exports.StandardValidationRules =
  exports.formatRestoreEstimate =
  exports.getRestoreComplexity =
  exports.calculateRestoreTime =
  exports.COMMON_SCHEDULES =
  exports.getNextExecutionTime =
  exports.validateCronExpression =
  exports.createCronExpression =
  exports.getRecommendedStrategy =
  exports.getBackupStrategyDescription =
  exports.isValidBackupStrategyType =
  exports.createBackupStrategy =
  exports.DifferentialBackupStrategy =
  exports.IncrementalBackupStrategy =
  exports.FullBackupStrategy =
  exports.AbstractBackupStrategy =
  exports.BackupStrategy =
  exports.BackupValidator =
  exports.BackupScheduler =
  exports.RestoreService =
  exports.BackupService =
    void 0;
const BackupService_1 = require('./BackupService');
Object.defineProperty(exports, 'BackupService', {
  enumerable: true,
  get() {
    return BackupService_1.BackupService;
  },
});
const RestoreService_1 = require('./RestoreService');
Object.defineProperty(exports, 'RestoreService', {
  enumerable: true,
  get() {
    return RestoreService_1.RestoreService;
  },
});
const BackupScheduler_1 = require('./BackupScheduler');
Object.defineProperty(exports, 'BackupScheduler', {
  enumerable: true,
  get() {
    return BackupScheduler_1.BackupScheduler;
  },
});
const BackupValidator_1 = require('./BackupValidator');
Object.defineProperty(exports, 'BackupValidator', {
  enumerable: true,
  get() {
    return BackupValidator_1.BackupValidator;
  },
});
const BackupStrategy_1 = require('./BackupStrategy');
Object.defineProperty(exports, 'BackupStrategy', {
  enumerable: true,
  get() {
    return BackupStrategy_1.BackupStrategy;
  },
});
Object.defineProperty(exports, 'AbstractBackupStrategy', {
  enumerable: true,
  get() {
    return BackupStrategy_1.AbstractBackupStrategy;
  },
});
Object.defineProperty(exports, 'FullBackupStrategy', {
  enumerable: true,
  get() {
    return BackupStrategy_1.FullBackupStrategy;
  },
});
Object.defineProperty(exports, 'IncrementalBackupStrategy', {
  enumerable: true,
  get() {
    return BackupStrategy_1.IncrementalBackupStrategy;
  },
});
Object.defineProperty(exports, 'DifferentialBackupStrategy', {
  enumerable: true,
  get() {
    return BackupStrategy_1.DifferentialBackupStrategy;
  },
});
Object.defineProperty(exports, 'createBackupStrategy', {
  enumerable: true,
  get() {
    return BackupStrategy_1.createBackupStrategy;
  },
});
Object.defineProperty(exports, 'isValidBackupStrategyType', {
  enumerable: true,
  get() {
    return BackupStrategy_1.isValidBackupStrategyType;
  },
});
Object.defineProperty(exports, 'getBackupStrategyDescription', {
  enumerable: true,
  get() {
    return BackupStrategy_1.getBackupStrategyDescription;
  },
});
Object.defineProperty(exports, 'getRecommendedStrategy', {
  enumerable: true,
  get() {
    return BackupStrategy_1.getRecommendedStrategy;
  },
});
const BackupScheduler_2 = require('./BackupScheduler');
Object.defineProperty(exports, 'createCronExpression', {
  enumerable: true,
  get() {
    return BackupScheduler_2.createCronExpression;
  },
});
Object.defineProperty(exports, 'validateCronExpression', {
  enumerable: true,
  get() {
    return BackupScheduler_2.validateCronExpression;
  },
});
Object.defineProperty(exports, 'getNextExecutionTime', {
  enumerable: true,
  get() {
    return BackupScheduler_2.getNextExecutionTime;
  },
});
Object.defineProperty(exports, 'COMMON_SCHEDULES', {
  enumerable: true,
  get() {
    return BackupScheduler_2.COMMON_SCHEDULES;
  },
});
const RestoreService_2 = require('./RestoreService');
Object.defineProperty(exports, 'calculateRestoreTime', {
  enumerable: true,
  get() {
    return RestoreService_2.calculateRestoreTime;
  },
});
Object.defineProperty(exports, 'getRestoreComplexity', {
  enumerable: true,
  get() {
    return RestoreService_2.getRestoreComplexity;
  },
});
Object.defineProperty(exports, 'formatRestoreEstimate', {
  enumerable: true,
  get() {
    return RestoreService_2.formatRestoreEstimate;
  },
});
const BackupValidator_2 = require('./BackupValidator');
Object.defineProperty(exports, 'StandardValidationRules', {
  enumerable: true,
  get() {
    return BackupValidator_2.StandardValidationRules;
  },
});
Object.defineProperty(exports, 'createDefaultValidationConfig', {
  enumerable: true,
  get() {
    return BackupValidator_2.createDefaultValidationConfig;
  },
});
Object.defineProperty(exports, 'createQuickValidationConfig', {
  enumerable: true,
  get() {
    return BackupValidator_2.createQuickValidationConfig;
  },
});
Object.defineProperty(exports, 'formatValidationReport', {
  enumerable: true,
  get() {
    return BackupValidator_2.formatValidationReport;
  },
});
exports.BackupServiceFactory = {
  createDefault: adapter => {
    const defaultConfig = {
      destinations: [
        {
          id: 'local-default',
          name: 'Local Default',
          type: 'local',
          path: './backups',
          priority: 1,
          enabled: true,
          config: {
            maxRetentionDays: 30,
            maxBackupCount: 100,
            compressionLevel: 6,
            encryptionEnabled: false,
          },
        },
      ],
      defaultStrategy: 'full',
      globalRetentionPolicy: {
        keepDaily: 7,
        keepWeekly: 4,
        keepMonthly: 12,
        keepYearly: 5,
      },
      performance: {
        maxConcurrentBackups: 3,
        maxParallelDestinations: 2,
        progressReportingInterval: 5000,
        timeoutMinutes: 60,
      },
      validation: {
        enableIntegrityChecks: true,
        enableChecksumValidation: true,
        enableRestoreValidation: false,
        validationSamplePercent: 100,
      },
      monitoring: {
        enableMetrics: true,
        enableAlerting: true,
        alertThresholds: {
          failureRate: 85,
          responseTime: 300000,
          storageUsage: 90,
        },
      },
    };
    return new BackupService(adapter, defaultConfig);
  },
  createEnterprise: (adapter, primaryDestination, secondaryDestination) => {
    const destinations = [primaryDestination];
    if (secondaryDestination) {
      destinations.push(secondaryDestination);
    }
    const enterpriseConfig = {
      destinations,
      defaultStrategy: 'differential',
      globalRetentionPolicy: {
        keepDaily: 30,
        keepWeekly: 12,
        keepMonthly: 24,
        keepYearly: 10,
      },
      performance: {
        maxConcurrentBackups: 5,
        maxParallelDestinations: destinations.length,
        progressReportingInterval: 2000,
        timeoutMinutes: 120,
      },
      validation: {
        enableIntegrityChecks: true,
        enableChecksumValidation: true,
        enableRestoreValidation: true,
        validationSamplePercent: 100,
      },
      monitoring: {
        enableMetrics: true,
        enableAlerting: true,
        alertThresholds: {
          failureRate: 95,
          responseTime: 180000,
          storageUsage: 85,
        },
      },
    };
    return new BackupService(adapter, enterpriseConfig);
  },
  createDevelopment: adapter => {
    const devConfig = {
      destinations: [
        {
          id: 'dev-local',
          name: 'Development Local',
          type: 'local',
          path: './dev-backups',
          priority: 1,
          enabled: true,
          config: {
            maxRetentionDays: 7,
            maxBackupCount: 20,
            compressionLevel: 1,
            encryptionEnabled: false,
          },
        },
      ],
      defaultStrategy: 'full',
      globalRetentionPolicy: {
        keepDaily: 3,
        keepWeekly: 2,
        keepMonthly: 1,
        keepYearly: 0,
      },
      performance: {
        maxConcurrentBackups: 1,
        maxParallelDestinations: 1,
        progressReportingInterval: 10000,
        timeoutMinutes: 30,
      },
      validation: {
        enableIntegrityChecks: true,
        enableChecksumValidation: true,
        enableRestoreValidation: false,
        validationSamplePercent: 50,
      },
      monitoring: {
        enableMetrics: false,
        enableAlerting: false,
        alertThresholds: {
          failureRate: 70,
          responseTime: 600000,
          storageUsage: 95,
        },
      },
    };
    return new BackupService(adapter, devConfig);
  },
};
exports.BackupConfigurations = {
  NIGHTLY_FULL: {
    cronExpression: '0 2 * * *',
    strategy: 'full',
    description: 'Full backup nightly at 2 AM',
  },
  BUSINESS_HOURS_DIFFERENTIAL: {
    cronExpression: '0 6,12,18 * * 1-5',
    strategy: 'differential',
    description: 'Differential backup every 6 hours on weekdays',
  },
  HOURLY_INCREMENTAL: {
    cronExpression: '0 * * * *',
    strategy: 'incremental',
    description: 'Incremental backup every hour',
  },
  WEEKLY_FULL_DAILY_DIFF: [
    {
      cronExpression: '0 2 * * 0',
      strategy: 'full',
      description: 'Full backup Sunday 2 AM',
    },
    {
      cronExpression: '0 2 * * 1-6',
      strategy: 'differential',
      description: 'Differential backup weekdays 2 AM',
    },
  ],
};
class BackupServiceError extends Error {
  code;
  details;
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'BackupServiceError';
  }
}
exports.BackupServiceError = BackupServiceError;
class BackupValidationError extends BackupServiceError {
  validationResult;
  constructor(message, validationResult) {
    super(message, 'VALIDATION_FAILED', validationResult);
    this.validationResult = validationResult;
    this.name = 'BackupValidationError';
  }
}
exports.BackupValidationError = BackupValidationError;
class RestoreError extends BackupServiceError {
  restoreJob;
  constructor(message, restoreJob) {
    super(message, 'RESTORE_FAILED', restoreJob);
    this.restoreJob = restoreJob;
    this.name = 'RestoreError';
  }
}
exports.RestoreError = RestoreError;
class ScheduleError extends BackupServiceError {
  schedule;
  constructor(message, schedule) {
    super(message, 'SCHEDULE_ERROR', schedule);
    this.schedule = schedule;
    this.name = 'ScheduleError';
  }
}
exports.ScheduleError = ScheduleError;
exports.BACKUP_CONSTANTS = {
  EXTENSIONS: {
    COMPRESSED: '.gz',
    ENCRYPTED: '.enc',
    BACKUP: '.bak',
    DATABASE: '.db',
  },
  TIMEOUTS: {
    DEFAULT_BACKUP: 30 * 60 * 1000,
    DEFAULT_RESTORE: 60 * 60 * 1000,
    DEFAULT_VALIDATION: 5 * 60 * 1000,
    QUICK_VALIDATION: 60 * 1000,
  },
  LIMITS: {
    MAX_BACKUP_SIZE: 10 * 1024 * 1024 * 1024,
    MIN_BACKUP_SIZE: 1024,
    MAX_RETENTION_DAYS: 3650,
    MAX_CONCURRENT_BACKUPS: 10,
    MAX_SCHEDULE_COUNT: 100,
  },
  PERFORMANCE: {
    GOOD_BACKUP_TIME: 5 * 60 * 1000,
    ACCEPTABLE_BACKUP_TIME: 30 * 60 * 1000,
    GOOD_COMPRESSION_RATIO: 0.3,
    MIN_TRANSFER_RATE: 1024 * 1024,
  },
};
//# sourceMappingURL=index.js.map
