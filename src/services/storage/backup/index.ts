/**
 * Backup Services Index
 *
 * Comprehensive backup system exports for the Mainframe AI Assistant.
 * Provides enterprise-grade backup, restore, scheduling, and validation capabilities.
 */

// Core Services
export { BackupService } from './BackupService';
export { RestoreService } from './RestoreService';
export { BackupScheduler } from './BackupScheduler';
export { BackupValidator } from './BackupValidator';

// Strategy Pattern Implementation
export {
  BackupStrategy,
  AbstractBackupStrategy,
  FullBackupStrategy,
  IncrementalBackupStrategy,
  DifferentialBackupStrategy,
  createBackupStrategy,
  isValidBackupStrategyType,
  getBackupStrategyDescription,
  getRecommendedStrategy,
} from './BackupStrategy';

// Type Definitions - BackupService
export type {
  BackupDestination,
  BackupConfig,
  BackupRequest,
  BackupJob,
  BackupJobResult,
  BackupMetrics,
  ValidationResult,
  RestoreRequest,
  BackupInventory,
} from './BackupService';

// Type Definitions - BackupStrategy
export type {
  BackupStrategyType,
  BackupProgress,
  BackupExecutionContext,
  BackupMetadata,
  BackupDelta,
} from './BackupStrategy';

// Type Definitions - BackupScheduler
export type {
  ScheduleConfig,
  RetryPolicy,
  ScheduleConditions,
  TimeWindow,
  NotificationConfig,
  ScheduleExecution,
  ScheduleStats,
  PerformanceConfig,
} from './BackupScheduler';

// Type Definitions - RestoreService
export type {
  RestoreRequest,
  RestoreOptions,
  RestoreProgress,
  RestoreJob,
  RestoreValidationResult,
  RestoreMetrics,
  RestorePoint,
  BackupChain,
} from './RestoreService';

// Type Definitions - BackupValidator
export type {
  ValidationConfig,
  ValidationRule,
  ValidationContext,
  ValidationProgress,
  ValidationResult as ValidatorResult,
  ValidationSummary,
  ValidationRuleResult,
  ValidationPerformance,
  ValidationReport,
  ValidationIssue,
} from './BackupValidator';

// Utility Functions
export {
  createCronExpression,
  validateCronExpression,
  getNextExecutionTime,
  COMMON_SCHEDULES,
} from './BackupScheduler';

export {
  calculateRestoreTime,
  getRestoreComplexity,
  formatRestoreEstimate,
} from './RestoreService';

export {
  StandardValidationRules,
  createDefaultValidationConfig,
  createQuickValidationConfig,
  formatValidationReport,
} from './BackupValidator';

// Factory Functions and Builders
export const BackupServiceFactory = {
  /**
   * Create a BackupService with default configuration
   */
  createDefault: (adapter: any): BackupService => {
    const defaultConfig = {
      destinations: [
        {
          id: 'local-default',
          name: 'Local Default',
          type: 'local' as const,
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
      defaultStrategy: 'full' as const,
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

  /**
   * Create a BackupService optimized for enterprise use
   */
  createEnterprise: (
    adapter: any,
    primaryDestination: any,
    secondaryDestination?: any
  ): BackupService => {
    const destinations = [primaryDestination];
    if (secondaryDestination) {
      destinations.push(secondaryDestination);
    }

    const enterpriseConfig = {
      destinations,
      defaultStrategy: 'differential' as const,
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

  /**
   * Create a lightweight BackupService for development/testing
   */
  createDevelopment: (adapter: any): BackupService => {
    const devConfig = {
      destinations: [
        {
          id: 'dev-local',
          name: 'Development Local',
          type: 'local' as const,
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
      defaultStrategy: 'full' as const,
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

// Common Backup Configurations
export const BackupConfigurations = {
  /**
   * Full backup every night at 2 AM
   */
  NIGHTLY_FULL: {
    cronExpression: '0 2 * * *',
    strategy: 'full' as const,
    description: 'Full backup nightly at 2 AM',
  },

  /**
   * Differential backup every 6 hours during business days
   */
  BUSINESS_HOURS_DIFFERENTIAL: {
    cronExpression: '0 6,12,18 * * 1-5',
    strategy: 'differential' as const,
    description: 'Differential backup every 6 hours on weekdays',
  },

  /**
   * Incremental backup every hour
   */
  HOURLY_INCREMENTAL: {
    cronExpression: '0 * * * *',
    strategy: 'incremental' as const,
    description: 'Incremental backup every hour',
  },

  /**
   * Weekly full backup on Sunday, daily differential during week
   */
  WEEKLY_FULL_DAILY_DIFF: [
    {
      cronExpression: '0 2 * * 0',
      strategy: 'full' as const,
      description: 'Full backup Sunday 2 AM',
    },
    {
      cronExpression: '0 2 * * 1-6',
      strategy: 'differential' as const,
      description: 'Differential backup weekdays 2 AM',
    },
  ],
};

// Error Classes
export class BackupServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'BackupServiceError';
  }
}

export class BackupValidationError extends BackupServiceError {
  constructor(
    message: string,
    public readonly validationResult: any
  ) {
    super(message, 'VALIDATION_FAILED', validationResult);
    this.name = 'BackupValidationError';
  }
}

export class RestoreError extends BackupServiceError {
  constructor(
    message: string,
    public readonly restoreJob?: any
  ) {
    super(message, 'RESTORE_FAILED', restoreJob);
    this.name = 'RestoreError';
  }
}

export class ScheduleError extends BackupServiceError {
  constructor(
    message: string,
    public readonly schedule?: any
  ) {
    super(message, 'SCHEDULE_ERROR', schedule);
    this.name = 'ScheduleError';
  }
}

// Constants
export const BACKUP_CONSTANTS = {
  // File extensions
  EXTENSIONS: {
    COMPRESSED: '.gz',
    ENCRYPTED: '.enc',
    BACKUP: '.bak',
    DATABASE: '.db',
  },

  // Default timeouts (in milliseconds)
  TIMEOUTS: {
    DEFAULT_BACKUP: 30 * 60 * 1000, // 30 minutes
    DEFAULT_RESTORE: 60 * 60 * 1000, // 1 hour
    DEFAULT_VALIDATION: 5 * 60 * 1000, // 5 minutes
    QUICK_VALIDATION: 60 * 1000, // 1 minute
  },

  // Size limits
  LIMITS: {
    MAX_BACKUP_SIZE: 10 * 1024 * 1024 * 1024, // 10 GB
    MIN_BACKUP_SIZE: 1024, // 1 KB
    MAX_RETENTION_DAYS: 3650, // 10 years
    MAX_CONCURRENT_BACKUPS: 10,
    MAX_SCHEDULE_COUNT: 100,
  },

  // Performance thresholds
  PERFORMANCE: {
    GOOD_BACKUP_TIME: 5 * 60 * 1000, // 5 minutes
    ACCEPTABLE_BACKUP_TIME: 30 * 60 * 1000, // 30 minutes
    GOOD_COMPRESSION_RATIO: 0.3, // 30% reduction
    MIN_TRANSFER_RATE: 1024 * 1024, // 1 MB/s
  },
};

/**
 * Comprehensive backup system usage example:
 *
 * ```typescript
 * import { BackupServiceFactory, BackupConfigurations } from './backup';
 *
 * // Create service
 * const backupService = BackupServiceFactory.createEnterprise(adapter, primaryDest, secondaryDest);
 * await backupService.initialize();
 *
 * // Schedule regular backups
 * await backupService.scheduleBackup(
 *   BackupConfigurations.NIGHTLY_FULL.cronExpression,
 *   {
 *     strategy: BackupConfigurations.NIGHTLY_FULL.strategy,
 *     description: 'Automated nightly full backup'
 *   }
 * );
 *
 * // Manual backup
 * const jobId = await backupService.createBackup({
 *   strategy: 'full',
 *   description: 'Pre-migration backup',
 *   validateAfterBackup: true
 * });
 *
 * // Monitor progress
 * const job = await backupService.getBackupJob(jobId);
 * console.log(`Progress: ${job.progress.percentage}%`);
 *
 * // Restore when needed
 * const restoreService = new RestoreService(adapter, config);
 * const restoreJobId = await restoreService.restore({
 *   backupId: job.results[0].backupPath,
 *   destinationPath: './restored.db',
 *   includeValidation: true
 * });
 * ```
 */
