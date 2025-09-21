"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MIGRATION_CONFIG = exports.SUPPORTED_FEATURES = exports.MIGRATION_FRAMEWORK_VERSION = exports.MigrationUtils = exports.ValidationService = exports.RollbackManager = exports.DataTransformer = exports.SchemaEvolution = exports.MigrationPlanner = exports.MigrationService = void 0;
exports.createMigrationFramework = createMigrationFramework;
const MigrationService_1 = require("./MigrationService");
Object.defineProperty(exports, "MigrationService", { enumerable: true, get () { return MigrationService_1.MigrationService; } });
const MigrationPlanner_1 = require("./MigrationPlanner");
Object.defineProperty(exports, "MigrationPlanner", { enumerable: true, get () { return MigrationPlanner_1.MigrationPlanner; } });
const SchemaEvolution_1 = require("./SchemaEvolution");
Object.defineProperty(exports, "SchemaEvolution", { enumerable: true, get () { return SchemaEvolution_1.SchemaEvolution; } });
const DataTransformer_1 = require("./DataTransformer");
Object.defineProperty(exports, "DataTransformer", { enumerable: true, get () { return DataTransformer_1.DataTransformer; } });
const RollbackManager_1 = require("./RollbackManager");
Object.defineProperty(exports, "RollbackManager", { enumerable: true, get () { return RollbackManager_1.RollbackManager; } });
const ValidationService_1 = require("./ValidationService");
Object.defineProperty(exports, "ValidationService", { enumerable: true, get () { return ValidationService_1.ValidationService; } });
const MigrationService_2 = require("./MigrationService");
const MigrationPlanner_2 = require("./MigrationPlanner");
const SchemaEvolution_2 = require("./SchemaEvolution");
const DataTransformer_2 = require("./DataTransformer");
const RollbackManager_2 = require("./RollbackManager");
const ValidationService_2 = require("./ValidationService");
function createMigrationFramework(config) {
    const { database, migrationsPath = './src/database/migrations/mvp-upgrades', enableLogging = true, enableMetrics = true } = config;
    const validation = new ValidationService_2.ValidationService(database);
    const schemaEvolution = new SchemaEvolution_2.SchemaEvolution(database);
    const dataTransformer = new DataTransformer_2.DataTransformer(database);
    const rollbackManager = new RollbackManager_2.RollbackManager(database);
    const planner = new MigrationPlanner_2.MigrationPlanner(database, migrationsPath);
    const migrationService = new MigrationService_2.MigrationService(database, migrationsPath);
    if (enableLogging) {
        setupFrameworkLogging({
            migrationService,
            planner,
            schemaEvolution,
            dataTransformer,
            rollbackManager,
            validation
        });
    }
    if (enableMetrics) {
        setupFrameworkMetrics({
            migrationService,
            planner,
            schemaEvolution,
            dataTransformer,
            rollbackManager,
            validation
        });
    }
    return {
        migrationService,
        planner,
        schemaEvolution,
        dataTransformer,
        rollbackManager,
        validation
    };
}
function setupFrameworkLogging(framework) {
    const logger = (service, event, data) => {
        console.log(`[${new Date().toISOString()}] [${service}] ${event}:`, data);
    };
    framework.migrationService.on('migrationStarted', (data) => logger('MigrationService', 'Migration Started', data));
    framework.migrationService.on('migrationStepCompleted', (data) => logger('MigrationService', 'Step Completed', data));
    framework.migrationService.on('migrationCompleted', (data) => logger('MigrationService', 'Migration Completed', data));
    framework.migrationService.on('migrationFailed', (data) => logger('MigrationService', 'Migration Failed', data));
    framework.rollbackManager.on('rollbackStarted', (data) => logger('RollbackManager', 'Rollback Started', data));
    framework.rollbackManager.on('rollbackCompleted', (data) => logger('RollbackManager', 'Rollback Completed', data));
    framework.rollbackManager.on('emergencyRollbackStarted', (data) => logger('RollbackManager', 'Emergency Rollback Started', data));
    framework.dataTransformer.on('transformationCompleted', (data) => logger('DataTransformer', 'Transformation Completed', data));
    framework.validation.on('validationStarted', (data) => logger('ValidationService', 'Validation Started', data));
    framework.validation.on('validationCompleted', (data) => logger('ValidationService', 'Validation Completed', data));
}
function setupFrameworkMetrics(framework) {
    const metrics = {
        migrationsExecuted: 0,
        rollbacksPerformed: 0,
        transformationsCompleted: 0,
        validationsRun: 0,
        totalMigrationTime: 0,
        errorCount: 0
    };
    framework.migrationService.on('migrationCompleted', (data) => {
        metrics.migrationsExecuted++;
        metrics.totalMigrationTime += data.totalDuration || 0;
    });
    framework.migrationService.on('migrationFailed', () => {
        metrics.errorCount++;
    });
    framework.rollbackManager.on('rollbackCompleted', () => {
        metrics.rollbacksPerformed++;
    });
    framework.dataTransformer.on('transformationCompleted', () => {
        metrics.transformationsCompleted++;
    });
    framework.validation.on('validationCompleted', () => {
        metrics.validationsRun++;
    });
    framework.getMetrics = () => ({ ...metrics });
}
exports.MigrationUtils = {
    async healthCheck(framework) {
        const issues = [];
        const recommendations = [];
        try {
            const validationResult = await framework.validation.validatePreMigrationState();
            if (!validationResult.isValid) {
                issues.push('Pre-migration validation failed');
                recommendations.push('Fix validation errors before proceeding');
            }
            const currentMVP = framework.schemaEvolution.detectCurrentMVP();
            if (currentMVP === 0) {
                issues.push('Unable to detect current MVP version');
                recommendations.push('Initialize database with MVP1 schema');
            }
            return {
                healthy: issues.length === 0,
                issues,
                recommendations
            };
        }
        catch (error) {
            return {
                healthy: false,
                issues: ['Migration framework health check failed'],
                recommendations: ['Check database connectivity and framework configuration']
            };
        }
    },
    async generateMigrationReport(framework) {
        const currentMVP = framework.schemaEvolution.detectCurrentMVP();
        const validationResult = await framework.validation.performComprehensiveValidation();
        return {
            currentState: {
                mvp: currentMVP,
                overallHealth: validationResult.summary.overallHealth,
                criticalIssues: validationResult.summary.criticalIssues,
                warnings: validationResult.summary.warnings
            },
            capabilities: [
                'Schema evolution management',
                'Data transformation pipelines',
                'Comprehensive rollback support',
                'Migration validation and safety checks',
                'MVP progression tracking'
            ],
            recommendations: validationResult.summary.recommendationsCount > 0
                ? ['Review validation report for specific recommendations']
                : ['System is healthy for migrations']
        };
    }
};
exports.MIGRATION_FRAMEWORK_VERSION = '1.0.0';
exports.SUPPORTED_FEATURES = {
    schemaEvolution: true,
    dataTransformation: true,
    rollbackSupport: true,
    validationChecks: true,
    mvpProgression: true,
    emergencyRecovery: true,
    performanceMonitoring: true,
    integrityValidation: true
};
exports.DEFAULT_MIGRATION_CONFIG = {
    migrationsPath: './src/database/migrations/mvp-upgrades',
    enableLogging: true,
    enableMetrics: true
};
//# sourceMappingURL=index.js.map