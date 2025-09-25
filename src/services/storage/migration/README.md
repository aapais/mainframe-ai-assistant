# Migration Framework

A comprehensive database migration framework supporting schema evolution across
MVPs with rollback capabilities, data transformations, and extensive validation.

## Overview

This migration framework provides enterprise-grade database migration
capabilities specifically designed for the Mainframe AI Assistant project's
progressive MVP evolution. It supports safe schema migrations, data
transformations, rollback procedures, and comprehensive validation at every
step.

## Key Features

- **Progressive MVP Evolution**: Structured migrations from MVP1 through MVP5
- **Comprehensive Rollback Support**: Safe rollback with data preservation
- **Data Transformation Pipelines**: Automated data migration and enrichment
- **Extensive Validation**: Pre/post migration validation with integrity checks
- **Emergency Recovery**: Emergency rollback procedures for critical failures
- **Performance Monitoring**: Migration performance tracking and optimization
- **Schema Evolution Tracking**: Complete history and compatibility analysis

## Architecture

### Core Services

1. **MigrationService** - Main orchestration service
2. **MigrationPlanner** - Migration planning and optimization
3. **SchemaEvolution** - Schema version management and compatibility
4. **DataTransformer** - Data migration and transformation utilities
5. **RollbackManager** - Rollback planning and execution
6. **ValidationService** - Comprehensive validation and integrity checks

### Service Dependencies

```
MigrationService
├── MigrationPlanner
├── SchemaEvolution
├── DataTransformer
├── RollbackManager
└── ValidationService
```

## Quick Start

### Basic Setup

```typescript
import { createMigrationFramework } from './src/services/storage/migration';
import Database from 'better-sqlite3';

// Initialize database
const db = new Database('./knowledge.db');

// Create migration framework
const framework = createMigrationFramework({
  database: db,
  migrationsPath: './src/database/migrations/mvp-upgrades',
  enableLogging: true,
  enableMetrics: true,
});

// Health check
const health = await MigrationUtils.healthCheck(framework);
console.log('Framework Health:', health);
```

### MVP Migration

```typescript
// Analyze upgrade path
const upgradePath = await framework.migrationService.analyzeMVPUpgradePath(3);
console.log('Upgrade Analysis:', upgradePath);

// Execute migration to MVP3
const results = await framework.migrationService.executeMVPMigration(3, {
  dryRun: false,
  validateIntegrity: true,
  createCheckpoints: true,
  enableRollback: true,
});

console.log('Migration Results:', results);
```

### Rollback Example

```typescript
// Create rollback plan
const rollbackPlan = await framework.rollbackManager.createRollbackPlan(20);

// Execute rollback
const rollbackResults = await framework.rollbackManager.executeRollbackPlan(
  rollbackPlan,
  {
    preserveUserData: true,
    validateRollback: true,
  }
);

console.log('Rollback Results:', rollbackResults);
```

## MVP Migration Paths

### MVP1 → MVP2: Pattern Detection

- Add incident tracking tables
- Create pattern detection indexes
- Migrate existing KB entries to incident format
- **Risk Level**: Low
- **Estimated Duration**: 5 minutes
- **Downtime Required**: No

### MVP2 → MVP3: Code Analysis

- Add code analysis tables
- Create KB-code linking system
- Initialize code references
- **Risk Level**: Medium
- **Estimated Duration**: 10 minutes
- **Downtime Required**: No

### MVP3 → MVP4: IDZ Integration

- Add project management tables
- Create template system
- Initialize workspace management
- **Risk Level**: High
- **Estimated Duration**: 20 minutes
- **Downtime Required**: Yes

### MVP4 → MVP5: Enterprise Features

- Add ML model storage
- Create auto-resolution system
- Initialize enterprise security
- **Risk Level**: Critical
- **Estimated Duration**: 30 minutes
- **Downtime Required**: Yes

## Data Transformations

### Transformation Types

1. **Copy**: Simple data copying between tables
2. **Convert**: Data format conversion with validation
3. **Merge**: Combining data from multiple sources
4. **Split**: Dividing data into multiple targets
5. **Enrich**: Adding computed or derived data
6. **Migrate**: Complex multi-step data migration

### Example Transformation

```typescript
const transformation: DataTransformation = {
  id: 'kb_to_incident_mapping',
  name: 'Map KB entries to incident structure',
  description: 'Transform existing KB entries to work with incident patterns',
  sourceTable: 'kb_entries',
  targetTable: 'incidents',
  transformationType: 'convert',
  sql: `
    INSERT INTO incidents (ticket_id, timestamp, title, description, component, severity)
    SELECT 
      'KB-' || id as ticket_id,
      created_at as timestamp,
      title,
      problem as description,
      category as component,
      'medium' as severity
    FROM kb_entries
    WHERE created_at IS NOT NULL
  `,
  reversible: true,
  estimatedRows: 100,
  estimatedDuration: 30,
  dependencies: [],
  validationQueries: [
    'SELECT COUNT(*) FROM incidents WHERE ticket_id LIKE "KB-%"',
  ],
};
```

## Validation Framework

### Validation Types

- **Schema Validation**: Table structure, indexes, constraints
- **Data Integrity**: Null constraints, duplicates, orphaned records
- **Referential Integrity**: Foreign key constraints, broken references
- **Index Integrity**: Index corruption, missing recommended indexes
- **Performance Validation**: Query performance, resource utilization
- **MVP Compliance**: Feature completeness, required components

### Comprehensive Validation

```typescript
const validationReport =
  await framework.validation.performComprehensiveValidation();

console.log('Overall Health:', validationReport.summary.overallHealth);
console.log('Critical Issues:', validationReport.summary.criticalIssues);
console.log('Migration Safety:', validationReport.summary.migrationSafety);
```

## Rollback Strategies

### Rollback Types

1. **Single MVP Rollback**: Roll back one MVP version
2. **Staged Rollback**: Roll back through multiple versions with validation
3. **Full Restore**: Complete database restore from backup
4. **Emergency Rollback**: Immediate rollback with minimal validation

### Emergency Procedures

```typescript
// Emergency rollback for data corruption
const emergencyResult =
  await framework.rollbackManager.executeEmergencyRollback('corruption');

console.log('Emergency Actions:', emergencyResult.actionsPerformed);
console.log('Restored to Version:', emergencyResult.restoredToVersion);
console.log('Emergency Contacts:', emergencyResult.emergencyContacts);
```

## Migration Planning

### Creating Migration Plans

```typescript
const plan = await framework.planner.createComprehensiveMigrationPlan(4);

console.log('Migration Plan:');
console.log('- Current MVP:', plan.currentMVP);
console.log('- Target MVP:', plan.targetMVP);
console.log('- Risk Level:', plan.riskLevel);
console.log('- Estimated Duration:', plan.estimatedDuration, 'minutes');
console.log('- Downtime Required:', plan.requiresDowntime);
```

### Resource Estimation

```typescript
const resources = await framework.planner.estimateResourceRequirements(plan);

console.log('Resource Requirements:');
console.log(
  '- Additional Storage:',
  resources.storage.additionalSpaceRequired,
  'bytes'
);
console.log('- Backup Space:', resources.storage.backupSpaceRequired, 'bytes');
console.log('- Peak Memory:', resources.memory.peakMemoryUsage, 'bytes');
console.log('- Recommended Cores:', resources.cpu.recommendedCores);
```

## Error Handling

### Migration Errors

```typescript
try {
  const results = await framework.migrationService.executeMVPMigration(3);
} catch (error) {
  console.error('Migration failed:', error.message);

  // Check if rollback was performed
  const progress = framework.migrationService.getCurrentProgress();
  if (progress?.status === 'rolled_back') {
    console.log('System was safely rolled back');
  } else {
    // Manual intervention may be required
    console.log('Manual recovery may be needed');
  }
}
```

### Validation Errors

```typescript
const validation = await framework.validation.validatePreMigrationState();

if (!validation.isValid) {
  console.log('Validation Errors:');
  validation.errors.forEach(error => {
    console.log(`- ${error.severity}: ${error.message}`);
    console.log(`  Suggestion: ${error.suggestion}`);
  });
}
```

## Best Practices

### Before Migration

1. **Always run validation** before attempting migrations
2. **Create backups** for any non-trivial migration
3. **Test on copy** of production data first
4. **Review migration plan** and resource requirements
5. **Ensure adequate disk space** for backups and temp operations

### During Migration

1. **Monitor progress** through event listeners
2. **Enable checkpoints** for long-running migrations
3. **Watch for warnings** and performance issues
4. **Have rollback plan** ready
5. **Monitor system resources** during execution

### After Migration

1. **Run comprehensive validation** to verify success
2. **Check application functionality** with new schema
3. **Monitor performance** for any degradation
4. **Clean up** temporary files and old backups
5. **Document** any issues or unexpected behavior

## Monitoring and Metrics

### Progress Monitoring

```typescript
// Listen for migration events
framework.migrationService.on('migrationStepCompleted', data => {
  console.log(`Step ${data.step} completed in ${data.duration}ms`);
});

framework.migrationService.on('progressUpdated', progress => {
  const percent = (progress.currentStep / progress.totalSteps) * 100;
  console.log(`Migration ${percent.toFixed(1)}% complete`);
});
```

### Performance Metrics

```typescript
const progress = framework.migrationService.getCurrentProgress();

if (progress) {
  console.log('Migration Progress:');
  console.log('- Status:', progress.status);
  console.log('- Steps:', `${progress.currentStep}/${progress.totalSteps}`);
  console.log('- Elapsed Time:', progress.elapsedTime, 'ms');
  console.log('- Estimated Completion:', progress.estimatedCompletion);
  console.log('- Memory Usage:', progress.performance.memoryUsage, 'bytes');
}
```

## Configuration

### Environment Variables

```bash
# Migration configuration
MIGRATION_PATH=./src/database/migrations/mvp-upgrades
BACKUP_PATH=./backups
ENABLE_METRICS=true
ENABLE_LOGGING=true

# Validation settings
VALIDATION_TIMEOUT=300000
INTEGRITY_CHECK_LEVEL=comprehensive

# Rollback settings
ROLLBACK_SAFETY_CHECKS=true
EMERGENCY_CONTACTS=dba@company.com,admin@company.com
```

### Framework Configuration

```typescript
const config: MigrationFrameworkConfig = {
  database: db,
  migrationsPath: process.env.MIGRATION_PATH || './migrations',
  enableLogging: process.env.ENABLE_LOGGING === 'true',
  enableMetrics: process.env.ENABLE_METRICS === 'true',
  backupPath: process.env.BACKUP_PATH || './backups',
};
```

## Troubleshooting

### Common Issues

1. **Migration Hangs**: Check for active transactions or locks
2. **Validation Fails**: Review specific error messages and suggestions
3. **Rollback Fails**: May require manual intervention or restore from backup
4. **Performance Issues**: Check disk space and memory availability
5. **Checksum Mismatches**: Migration files may have been modified

### Debug Mode

```typescript
// Enable detailed logging
const framework = createMigrationFramework({
  database: db,
  enableLogging: true,
});

// Add debug listeners
framework.migrationService.on('*', (event, data) => {
  console.log(`DEBUG: ${event}`, data);
});
```

### Recovery Procedures

1. **Stop Migration**: Use Ctrl+C or application shutdown
2. **Check Database State**: Run validation to assess current state
3. **Review Logs**: Check migration logs for specific errors
4. **Resume or Rollback**: Use checkpoint resume or execute rollback
5. **Manual Fixes**: Apply manual corrections if needed

## API Reference

### MigrationService

- `analyzeMVPUpgradePath(targetMVP)` - Analyze upgrade requirements
- `executeMVPMigration(targetMVP, options)` - Execute MVP migration
- `rollbackMVPMigration(targetVersion, options)` - Rollback migration
- `validateMigrationIntegrity()` - Validate current state
- `getCurrentProgress()` - Get current migration progress
- `resumeFromCheckpoint(checkpointPath)` - Resume from checkpoint
- `createCheckpoint(migrationId)` - Create migration checkpoint

### ValidationService

- `performComprehensiveValidation()` - Full database validation
- `validateMigrationPlan(plan)` - Validate migration plan
- `validatePreMigrationState()` - Pre-migration validation
- `validatePostMigration(migration)` - Post-migration validation
- `validateRollbackResult(targetVersion)` - Rollback validation

### RollbackManager

- `createRollbackPlan(targetVersion)` - Create rollback plan
- `executeRollbackPlan(plan, options)` - Execute rollback
- `executeEmergencyRollback(type)` - Emergency rollback
- `validateRollbackCapability(targetVersion)` - Check rollback safety

## License

This migration framework is part of the Mainframe AI Assistant project and
follows the same license terms.

## Support

For issues, questions, or contributions related to the migration framework:

1. Check this documentation first
2. Review the troubleshooting section
3. Examine the code examples
4. Contact the development team
