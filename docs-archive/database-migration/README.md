# Database Migration System - Complete Guide

## Overview

This comprehensive database migration system provides safe, reliable, and reversible database upgrades across all MVP phases of the Mainframe KB Assistant. The system includes:

- **MVP Evolution Migrations**: Structured upgrade paths from MVP1 through MVP5
- **Zero-Downtime Strategies**: Minimize service interruption during upgrades
- **Data Transformation Pipelines**: Handle complex data migrations with integrity guarantees
- **PostgreSQL Migration Path**: Complete migration from SQLite to PostgreSQL
- **Automated Testing Framework**: Comprehensive validation and rollback testing
- **Rollback Capabilities**: Safe recovery from failed migrations

## Architecture

```
src/database/
├── migrations/
│   ├── mvp-upgrades/           # MVP evolution migrations
│   │   ├── 002_mvp2_pattern_detection.sql
│   │   ├── 003_mvp3_code_analysis.sql
│   │   ├── 004_mvp4_idz_integration.sql
│   │   └── 005_mvp5_enterprise_ai.sql
│   └── schema.sql              # Base schema (MVP1)
├── migration-utils/            # Migration orchestration tools
│   ├── MigrationOrchestrator.ts
│   ├── DataTransformer.ts
│   ├── MigrationValidator.ts
│   ├── RollbackManager.ts
│   └── ProgressTracker.ts
├── postgres-migration/         # PostgreSQL migration tools
│   ├── PostgresMigrator.ts
│   ├── SchemaMapper.ts
│   └── DataTypeConverter.ts
└── migration-tests/           # Testing framework
    ├── MigrationTestRunner.ts
    ├── IntegrityValidator.ts
    └── PerformanceBenchmark.ts
```

## Quick Start

### 1. Basic MVP Migration

```typescript
import { MigrationOrchestrator } from './src/database/migration-utils/MigrationOrchestrator';

const db = new Database('./knowledge.db');
const orchestrator = new MigrationOrchestrator(db);

// Plan migration from current version to MVP3
const plan = await orchestrator.createMigrationPlan(3);
console.log(`Migration will take ~${plan.estimatedDuration} minutes`);
console.log(`Risk level: ${plan.riskLevel}`);

// Execute migration
const results = await orchestrator.executeMigrationPlan(plan);
console.log(`Migration completed: ${results.every(r => r.success)}`);
```

### 2. PostgreSQL Migration

```typescript
import { PostgresMigrator } from './src/database/postgres-migration/PostgresMigrator';

const migrator = new PostgresMigrator({
  sourceDb: sqliteDb,
  targetConfig: {
    host: 'localhost',
    port: 5432,
    database: 'mainframe_kb',
    username: 'kb_user',
    password: 'secure_password'
  },
  options: {
    validateData: true,
    createIndexesLast: true
  }
});

// Analyze migration compatibility
const plan = await migrator.analyzeMigration();
console.log(`${plan.compatibility.fullyCompatible.length} tables fully compatible`);

// Execute migration
const result = await migrator.executeMigration(plan);
console.log(`Migrated ${result.migratedTables.length} tables successfully`);
```

### 3. Migration Testing

```typescript
import { MigrationTestRunner } from './src/database/migration-tests/MigrationTestRunner';

const testRunner = new MigrationTestRunner();

// Run all migration tests
const results = await testRunner.runTests({
  generateReport: true,
  reportPath: './test-results.json'
});

console.log(`Tests: ${results.passed}/${results.totalTests} passed`);
```

## MVP Migration Paths

### MVP1 → MVP2: Pattern Detection

**What's Added:**
- Incident management tables
- Pattern detection engine
- Root cause analysis
- Component health tracking
- Alert system

**Migration Highlights:**
```sql
-- New tables for incident tracking
CREATE TABLE incidents (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    component TEXT,
    severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    status TEXT CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at DATETIME NOT NULL
);

-- Pattern detection results
CREATE TABLE detected_patterns (
    id TEXT PRIMARY KEY,
    pattern_type TEXT CHECK(pattern_type IN ('temporal', 'component', 'error', 'mixed')),
    confidence REAL CHECK(confidence >= 0 AND confidence <= 1),
    severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    frequency INTEGER DEFAULT 1,
    first_seen DATETIME NOT NULL,
    last_seen DATETIME NOT NULL
);
```

**Data Transformations:**
- Link existing KB entries with potential incident patterns
- Populate component health baselines
- Initialize pattern detection configuration

### MVP2 → MVP3: Code Analysis Integration

**What's Added:**
- Code file management
- COBOL parser results storage
- KB-Code linking system
- AI analysis results
- Code quality metrics

**Migration Highlights:**
```sql
-- Code file storage
CREATE TABLE code_files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_type TEXT CHECK(file_type IN ('cobol', 'cbl', 'cob', 'jcl', 'proc', 'copybook', 'other')),
    content_hash TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    analysis_status TEXT CHECK(analysis_status IN ('pending', 'analyzing', 'completed', 'failed'))
);

-- Link KB entries to code sections
CREATE TABLE kb_code_links (
    id TEXT PRIMARY KEY,
    kb_entry_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    line_start INTEGER NOT NULL,
    line_end INTEGER,
    code_snippet TEXT,
    link_type TEXT CHECK(link_type IN ('manual', 'auto', 'pattern', 'error_location')),
    confidence REAL DEFAULT 1.0,
    FOREIGN KEY (kb_entry_id) REFERENCES kb_entries(id)
);
```

**Data Transformations:**
- Extract error codes from existing KB entries for auto-linking
- Prepare KB entries for code association
- Initialize code analysis configuration

### MVP3 → MVP4: IDZ Integration & Templates

**What's Added:**
- IDZ project management
- Template engine
- Multi-file workspaces
- Export/import validation
- Change tracking

**Migration Highlights:**
```sql
-- IDZ project tracking
CREATE TABLE idz_projects (
    id TEXT PRIMARY KEY,
    project_name TEXT NOT NULL,
    idz_workspace_path TEXT,
    local_workspace_path TEXT NOT NULL,
    project_type TEXT CHECK(project_type IN ('cobol', 'pli', 'assembler', 'mixed')),
    status TEXT CHECK(status IN ('active', 'imported', 'exported', 'archived', 'error'))
);

-- Code templates
CREATE TABLE code_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK(category IN ('error_handling', 'data_validation', 'file_operations', 'calculations', 'reports', 'common_patterns', 'other')),
    template_content TEXT NOT NULL,
    parameters TEXT, -- JSON array of parameter definitions
    success_rate REAL DEFAULT 0.0,
    usage_count INTEGER DEFAULT 0
);
```

**Data Transformations:**
- Enhance code files with project metadata
- Generate initial templates from successful patterns
- Initialize workspace configuration

### MVP4 → MVP5: Enterprise AI

**What's Added:**
- Auto-resolution engine
- Machine learning models
- Predictive analytics
- Enterprise governance
- Compliance tracking

**Migration Highlights:**
```sql
-- Auto-resolution rules
CREATE TABLE auto_resolution_rules (
    id TEXT PRIMARY KEY,
    rule_name TEXT NOT NULL,
    incident_pattern TEXT NOT NULL, -- JSON pattern matching criteria
    kb_entry_id TEXT, -- Preferred KB solution
    resolution_script TEXT, -- Automated resolution steps
    confidence_threshold REAL DEFAULT 0.85,
    success_rate REAL DEFAULT 0.0
);

-- ML models for prediction
CREATE TABLE ml_models (
    id TEXT PRIMARY KEY,
    model_name TEXT NOT NULL,
    model_type TEXT CHECK(model_type IN ('classification', 'regression', 'clustering', 'time_series', 'anomaly_detection')),
    purpose TEXT CHECK(purpose IN ('incident_prediction', 'component_health', 'failure_prediction', 'pattern_detection', 'resource_optimization')),
    model_data BLOB, -- Serialized model data
    performance_metrics TEXT -- JSON object with accuracy, precision, recall, etc.
);
```

**Data Transformations:**
- Extract ML features from historical incidents
- Prepare data for predictive models
- Initialize enterprise governance policies

## Zero-Downtime Migration Strategies

### 1. Online Schema Changes

For migrations that can be performed without downtime:

```typescript
const plan = await orchestrator.createMigrationPlan(targetVersion);

if (!plan.requiresDowntime) {
  // Execute with minimal impact
  await orchestrator.executeMigrationPlan(plan, {
    pauseBetweenSteps: 1000, // 1 second pause between steps
    continueOnWarning: true
  });
}
```

### 2. Dual-Write Pattern (For PostgreSQL Migration)

```typescript
// 1. Setup dual-write to both SQLite and PostgreSQL
const migrator = new PostgresMigrator(config);
await migrator.setupDualWrite();

// 2. Migrate data in background
await migrator.executeMigration(plan);

// 3. Switch to PostgreSQL once validated
await migrator.switchover();
```

### 3. Blue-Green Deployment

```typescript
// Create backup database for rollback
const backupPath = await orchestrator.createPreMigrationBackup(plan);

try {
  await orchestrator.executeMigrationPlan(plan);
  // Validate new version
  const validation = await validator.validateMigratedData();
  if (!validation.isValid) {
    throw new Error('Validation failed');
  }
} catch (error) {
  // Rollback to backup
  await orchestrator.restoreFromBackup(backupPath);
  throw error;
}
```

## Data Transformation Pipelines

### Built-in Transformation Rules

The system includes predefined transformation rules for each MVP migration:

```typescript
// Get transformation rules for specific MVP
const rules = DataTransformer.createMVPTransformationRules();

// Execute MVP2 transformations
const transformer = new DataTransformer(db);
const plan = await transformer.createTransformationPlan(rules.mvp2);
const results = await transformer.executeTransformationPlan(plan, {
  validateEach: true,
  continueOnError: false
});
```

### Custom Transformations

Create custom transformation rules:

```typescript
const customRule: TransformationRule = {
  id: 'custom_kb_enhancement',
  description: 'Enhance KB entries with extracted metadata',
  sourceTable: 'kb_entries',
  transformFunction: (row) => ({
    ...row,
    extracted_keywords: extractKeywords(row.problem),
    complexity_score: calculateComplexity(row.solution),
    updated_at: new Date().toISOString()
  }),
  validation: (original, transformed) => {
    return transformed.id === original.id && transformed.extracted_keywords.length > 0;
  },
  batchSize: 100
};

await transformer.executeTransformationRule(customRule);
```

## PostgreSQL Migration

### Complete Migration Process

```typescript
// 1. Analysis Phase
const migrator = new PostgresMigrator(config);
const plan = await migrator.analyzeMigration();

console.log('Migration Analysis:');
console.log(`- Fully compatible: ${plan.compatibility.fullyCompatible.length} tables`);
console.log(`- Require transformation: ${plan.compatibility.requiresTransformation.length} tables`);
console.log(`- Estimated duration: ${plan.estimatedDuration} minutes`);
console.log(`- Estimated size: ${plan.estimatedSize} MB`);

// 2. Schema Generation
const schema = await migrator.generatePostgresSchema();
fs.writeFileSync('postgres_schema.sql', schema);

// 3. Test Connection
const connected = await migrator.testConnection();
if (!connected) {
  throw new Error('Cannot connect to PostgreSQL');
}

// 4. Execute Migration
const result = await migrator.executeMigration(plan);
console.log(`Migration completed: ${result.success}`);
console.log(`Tables migrated: ${result.migratedTables.join(', ')}`);
```

### Schema Mapping

The PostgreSQL migrator automatically handles:

- **Data Type Mapping**: SQLite → PostgreSQL type conversion
- **Constraint Translation**: Foreign keys, unique constraints, checks
- **Index Conversion**: B-tree indexes, partial indexes
- **Trigger Rewriting**: SQLite triggers → PostgreSQL functions + triggers

### Data Type Conversions

| SQLite Type | PostgreSQL Type | Notes |
|-------------|-----------------|--------|
| `INTEGER` | `INTEGER` | Direct mapping |
| `TEXT` | `TEXT` | Direct mapping |
| `REAL` | `REAL` | Direct mapping |
| `BLOB` | `BYTEA` | Binary data conversion |
| `BOOLEAN` | `BOOLEAN` | 0/1 → false/true |
| `DATETIME` | `TIMESTAMP` | ISO string → timestamp |

## Testing Framework

### Automated Test Suites

The migration system includes comprehensive test suites:

1. **MVP Evolution Tests**: Validate each migration step
2. **Performance Tests**: Benchmark migration speed and resource usage
3. **Data Integrity Tests**: Verify data consistency after migration
4. **Rollback Tests**: Ensure safe recovery from failures
5. **PostgreSQL Compatibility Tests**: Validate PostgreSQL migration

### Running Tests

```bash
# Run all migration tests
npm run test:migration

# Run specific test suite
npm run test:migration -- --suites mvp1_to_mvp2

# Run performance benchmarks
npm run test:migration -- --tags performance

# Generate detailed report
npm run test:migration -- --generateReport --reportPath ./migration-report.json
```

### Custom Test Scenarios

Create custom test scenarios:

```typescript
const customScenario: TestScenario = {
  id: 'custom_data_validation',
  name: 'Custom Data Validation Test',
  description: 'Validate custom business rules after migration',
  setup: async () => {
    // Setup test data
  },
  execute: async (): Promise<TestResult> => {
    // Execute test logic
    const db = await createTestDatabase('custom_test', 3);
    
    // Validate business rules
    const violations = db.prepare(`
      SELECT COUNT(*) as count 
      FROM kb_entries 
      WHERE success_count + failure_count = 0 AND usage_count > 0
    `).get();
    
    return {
      scenario: 'custom_data_validation',
      success: violations.count === 0,
      duration: Date.now() - startTime,
      message: violations.count === 0 ? 'All rules validated' : `${violations.count} rule violations`
    };
  },
  cleanup: async () => {
    // Cleanup test resources
  },
  expectedOutcome: 'success',
  tags: ['custom', 'validation'],
  timeout: 30000
};

testRunner.registerTestSuite({
  id: 'custom_tests',
  name: 'Custom Test Suite',
  description: 'Custom business rule validation tests',
  scenarios: [customScenario]
});
```

## Rollback Procedures

### Automatic Rollback

The system automatically creates rollback points and can recover from failures:

```typescript
// Automatic rollback on migration failure
try {
  await orchestrator.executeMigrationPlan(plan);
} catch (error) {
  // System automatically rolled back to previous state
  console.log('Migration failed and was automatically rolled back');
  console.log(`Current version: ${migrationManager.getCurrentVersion()}`);
}
```

### Manual Rollback

```typescript
// Rollback to specific version
await orchestrator.rollback(previousVersion);

// Rollback using backup
await orchestrator.restoreFromBackup('./backup_pre_migration_v2_to_v3.db');
```

### Rollback Validation

```typescript
// Validate rollback was successful
const validation = await validator.validateDataIntegrity(
  originalDb, 
  rolledBackDb
);

if (validation.isValid) {
  console.log('Rollback validated successfully');
} else {
  console.error('Rollback validation failed:', validation.errors);
}
```

## Performance Optimization

### Migration Performance

- **Batch Processing**: Large datasets processed in configurable batches
- **Index Management**: Indexes created after data migration for speed
- **Memory Management**: Memory usage monitoring and optimization
- **Progress Tracking**: Real-time progress reporting with ETA

### Benchmarking

```typescript
// Benchmark migration performance
const benchmark = await testRunner.benchmarkMigration(1, 2, {
  kb_entries: 10000,
  search_history: 50000,
  usage_metrics: 100000
});

console.log(`Migration time: ${benchmark.migrationTime}ms`);
console.log(`Throughput: ${benchmark.throughput} records/second`);
console.log(`Peak memory: ${benchmark.memoryUsage.peak / 1024 / 1024}MB`);
```

## Monitoring and Observability

### Migration Events

The orchestrator emits detailed events for monitoring:

```typescript
orchestrator.on('migrationStarted', (data) => {
  console.log(`Starting migration with ${data.plan.migrations.length} steps`);
});

orchestrator.on('migrationStepStarted', (data) => {
  console.log(`Executing migration ${data.migration}: ${data.description}`);
});

orchestrator.on('migrationStepCompleted', (data) => {
  console.log(`Completed migration ${data.migration} in ${data.duration}ms`);
});

orchestrator.on('migrationCompleted', (data) => {
  console.log(`Migration completed successfully in ${data.totalDuration}ms`);
});

orchestrator.on('migrationFailed', (data) => {
  console.error(`Migration failed: ${data.error}`);
  console.log(`Rollback performed: ${data.rollbackPerformed}`);
});
```

### Progress Tracking

```typescript
// Monitor migration progress
const progress = orchestrator.getCurrentProgress();
if (progress) {
  console.log(`Progress: ${progress.currentStep}/${progress.totalSteps}`);
  console.log(`Current migration: ${progress.currentMigration}`);
  console.log(`Status: ${progress.status}`);
  console.log(`Errors: ${progress.errors.length}`);
}
```

## Troubleshooting

### Common Issues

#### 1. Migration Timeout
```typescript
// Increase timeout for long-running migrations
await orchestrator.executeMigrationPlan(plan, {
  timeout: 300000 // 5 minutes
});
```

#### 2. Memory Issues
```typescript
// Reduce batch size for memory-constrained environments
await transformer.executeTransformationPlan(plan, {
  batchSize: 500 // Smaller batches
});
```

#### 3. Lock Contention
```typescript
// Add delays between migration steps
await orchestrator.executeMigrationPlan(plan, {
  pauseBetweenSteps: 2000 // 2 second pause
});
```

#### 4. Data Validation Failures
```typescript
// Skip validation for non-critical warnings
await orchestrator.executeMigrationPlan(plan, {
  continueOnWarning: true
});
```

### Debugging Migration Issues

```typescript
// Enable detailed logging
process.env.MIGRATION_DEBUG = 'true';

// Dry run to test without changes
await orchestrator.executeMigrationPlan(plan, { dryRun: true });

// Validate migration plan before execution
const validation = await validator.validateMigrationPlan(plan);
if (!validation.isValid) {
  console.error('Migration plan validation failed:', validation.errors);
}
```

## Best Practices

### 1. Pre-Migration Checklist

- ✅ **Backup**: Always create backup before migration
- ✅ **Test**: Run migration on copy of production data
- ✅ **Validate**: Verify migration plan and dependencies
- ✅ **Schedule**: Plan migration during low-usage periods
- ✅ **Monitor**: Set up monitoring and alerting
- ✅ **Rollback**: Prepare and test rollback procedures

### 2. During Migration

- ✅ **Monitor Progress**: Watch for errors and warnings
- ✅ **Resource Usage**: Monitor CPU, memory, disk usage
- ✅ **Log Everything**: Maintain detailed logs
- ✅ **Be Patient**: Don't interrupt long-running operations
- ✅ **Have Support Ready**: Keep technical support available

### 3. Post-Migration

- ✅ **Validate Data**: Run integrity checks
- ✅ **Test Functionality**: Verify all features work
- ✅ **Monitor Performance**: Check for performance regressions
- ✅ **Update Documentation**: Document any issues or learnings
- ✅ **Plan Next Steps**: Prepare for future migrations

### 4. PostgreSQL Migration Best Practices

- ✅ **Connection Pooling**: Use connection pooling for better performance
- ✅ **Batch Size**: Optimize batch size for your environment
- ✅ **Index Strategy**: Create indexes after data migration
- ✅ **Constraint Validation**: Validate constraints incrementally
- ✅ **Character Encoding**: Ensure proper UTF-8 handling

## Support and Maintenance

### Log Analysis

Migration logs are stored in structured format for analysis:

```typescript
// Analyze migration logs
const logs = await migrationManager.getDetailedLogs();
const failedMigrations = logs.filter(log => !log.success);
const performanceMetrics = logs.map(log => ({
  version: log.version,
  duration: log.duration,
  recordsProcessed: log.recordsProcessed
}));
```

### Health Checks

```typescript
// Validate system health after migration
const healthCheck = await validator.performHealthCheck();
console.log(`Database integrity: ${healthCheck.integrity ? 'OK' : 'FAILED'}`);
console.log(`Performance: ${healthCheck.performance ? 'OK' : 'DEGRADED'}`);
console.log(`Features: ${healthCheck.features ? 'OK' : 'PARTIAL'}`);
```

### Maintenance Tasks

```typescript
// Regular maintenance after migrations
await migrationManager.performMaintenance({
  vacuum: true,          // Reclaim disk space
  analyze: true,         // Update statistics
  reindex: true,         // Rebuild indexes
  cleanupLogs: true      // Clean old logs
});
```

## Contributing

### Adding New Migrations

1. Create migration file: `006_mvp6_new_feature.sql`
2. Follow established naming conventions
3. Include comprehensive UP and DOWN sections
4. Add data transformation rules if needed
5. Create test scenarios
6. Update documentation

### Testing New Features

1. Add test scenarios to appropriate test suite
2. Test rollback functionality
3. Validate performance impact
4. Test with various data sizes
5. Verify PostgreSQL compatibility

## Conclusion

This migration system provides a robust, tested, and reliable foundation for evolving the Mainframe KB Assistant database through all MVP phases. The combination of automated testing, validation, and rollback capabilities ensures safe upgrades with minimal risk to production data.

Key benefits:

- **Safe Migrations**: Comprehensive validation and rollback capabilities
- **Zero Downtime**: Strategies to minimize service interruption
- **Data Integrity**: Multiple validation layers ensure data consistency
- **Performance Optimized**: Efficient processing of large datasets
- **PostgreSQL Ready**: Complete migration path to enterprise database
- **Well Tested**: Comprehensive test coverage for all scenarios
- **Fully Documented**: Complete documentation and troubleshooting guides

For additional support or questions, refer to the troubleshooting section or contact the development team.