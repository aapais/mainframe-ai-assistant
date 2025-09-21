# Database Migration Quick Reference

## 🚀 Quick Start Commands

### MVP Upgrades
```typescript
// Basic upgrade to next MVP version
import { MigrationOrchestrator } from './src/database/migration-utils/MigrationOrchestrator';

const db = new Database('./knowledge.db');
const orchestrator = new MigrationOrchestrator(db);

// Upgrade to MVP3
const plan = await orchestrator.createMigrationPlan(3);
await orchestrator.executeMigrationPlan(plan);
```

### PostgreSQL Migration
```typescript
import { PostgresMigrator } from './src/database/postgres-migration/PostgresMigrator';

const migrator = new PostgresMigrator({
  sourceDb: db,
  targetConfig: {
    host: 'localhost', port: 5432, database: 'kb', 
    username: 'user', password: 'pass'
  },
  options: { validateData: true }
});

await migrator.executeMigration();
```

### Run Tests
```typescript
import { MigrationTestRunner } from './src/database/migration-tests/MigrationTestRunner';

const runner = new MigrationTestRunner();
const results = await runner.runTests({ generateReport: true });
```

## 📋 Migration Checklist

### Pre-Migration
- [ ] **Backup Database**: `orchestrator.createPreMigrationBackup()`
- [ ] **Validate Plan**: `validator.validateMigrationPlan(plan)`
- [ ] **Test Migration**: Run on copy of production data
- [ ] **Check Dependencies**: Ensure all prerequisites are met
- [ ] **Schedule Downtime**: If `plan.requiresDowntime === true`

### During Migration
- [ ] **Monitor Progress**: `orchestrator.getCurrentProgress()`
- [ ] **Watch Resources**: Monitor CPU, memory, disk usage
- [ ] **Log Events**: Enable detailed logging
- [ ] **Avoid Interruption**: Don't stop long-running operations

### Post-Migration
- [ ] **Validate Data**: `validator.validateDataIntegrity()`
- [ ] **Test Features**: Verify all functionality works
- [ ] **Check Performance**: Monitor for regressions
- [ ] **Update Version**: Confirm `getCurrentVersion()`

## 🛠️ Common Commands

### Check Current Status
```typescript
const version = migrationManager.getCurrentVersion();
const status = migrationManager.getStatus();
const analysis = await orchestrator.analyzeUpgradePath();
```

### Create Migration Plan
```typescript
const plan = await orchestrator.createMigrationPlan(targetVersion);
console.log(`Duration: ${plan.estimatedDuration} min`);
console.log(`Risk: ${plan.riskLevel}`);
console.log(`Downtime: ${plan.requiresDowntime ? 'Yes' : 'No'}`);
```

### Execute with Options
```typescript
await orchestrator.executeMigrationPlan(plan, {
  dryRun: true,              // Test without changes
  pauseBetweenSteps: 1000,   // Pause 1s between steps
  continueOnWarning: true,   // Don't stop on warnings
  maxRetries: 3              // Retry failed steps
});
```

### Rollback
```typescript
// Rollback to previous version
await rollbackManager.rollbackToVersion(previousVersion);

// Rollback single migration
await rollbackManager.rollbackMigration(migrationVersion);

// Restore from backup
await rollbackManager.restoreFromBackup('./backup.db');
```

## 📊 MVP Migration Matrix

| From | To | Duration | Risk | Downtime | Key Changes |
|------|----|---------:|------|----------|-------------|
| 1 | 2 | 2-5 min | Low | No | + Pattern detection tables |
| 2 | 3 | 5-10 min | Medium | No | + Code analysis tables |
| 3 | 4 | 10-15 min | Medium | Optional | + IDZ integration, templates |
| 4 | 5 | 15-25 min | High | Yes | + Enterprise AI, governance |
| 1 | 5 | 30-45 min | High | Yes | All changes combined |

## 🔧 Troubleshooting

### Common Issues & Solutions

#### Migration Timeout
```typescript
// Increase timeout
await orchestrator.executeMigrationPlan(plan, { 
  timeout: 600000 // 10 minutes
});
```

#### Memory Issues
```typescript
// Reduce batch size
await transformer.executeTransformationPlan(plan, {
  batchSize: 500
});
```

#### Lock Contention
```typescript
// Add delays between steps
await orchestrator.executeMigrationPlan(plan, {
  pauseBetweenSteps: 2000
});
```

#### Validation Failures
```typescript
// Continue on warnings only
await orchestrator.executeMigrationPlan(plan, {
  continueOnWarning: true,
  continueOnError: false
});
```

### Debug Mode
```typescript
process.env.MIGRATION_DEBUG = 'true';
```

## 📈 Performance Tuning

### Large Datasets (>100k records)
```typescript
const config = {
  batchSize: 1000,
  maxConcurrency: 3,
  createIndexesLast: true,
  useTransactions: true
};
```

### Memory Constrained
```typescript
const config = {
  batchSize: 250,
  maxConcurrency: 1,
  pauseBetweenSteps: 1000
};
```

### Time Critical
```typescript
const config = {
  parallel: true,
  maxConcurrency: 5,
  continueOnWarning: true
};
```

## 🔄 PostgreSQL Migration Workflow

### 1. Analysis
```typescript
const plan = await migrator.analyzeMigration();
console.log(`Compatible: ${plan.compatibility.fullyCompatible.length} tables`);
```

### 2. Schema Generation
```typescript
const schema = await migrator.generatePostgresSchema();
fs.writeFileSync('postgres_schema.sql', schema);
```

### 3. Test Connection
```typescript
if (!(await migrator.testConnection())) {
  throw new Error('Cannot connect to PostgreSQL');
}
```

### 4. Execute Migration
```typescript
const result = await migrator.executeMigration(plan);
console.log(`Success: ${result.success}`);
```

## 🧪 Testing Reference

### Test Suites Available
- `mvp1_to_mvp2` - MVP1→2 migration tests
- `mvp2_to_mvp3` - MVP2→3 migration tests  
- `mvp3_to_mvp4` - MVP3→4 migration tests
- `mvp4_to_mvp5` - MVP4→5 migration tests
- `performance` - Performance benchmarks
- `postgres_migration` - PostgreSQL compatibility

### Run Specific Tests
```typescript
// Run performance tests only
await runner.runTests({ tags: ['performance'] });

// Run MVP2 tests only  
await runner.runTests({ suites: ['mvp1_to_mvp2'] });

// Generate detailed report
await runner.runTests({ 
  generateReport: true,
  reportPath: './test-results.json'
});
```

### Benchmark Performance
```typescript
const benchmark = await runner.benchmarkMigration(1, 3, {
  kb_entries: 10000,
  search_history: 50000
});

console.log(`Throughput: ${benchmark.throughput} rec/sec`);
```

## 📝 Configuration Templates

### Production Migration Config
```typescript
const productionConfig = {
  dryRun: false,
  validateData: true,
  createIndexesLast: true,
  pauseBetweenSteps: 2000,
  maxRetries: 3,
  continueOnWarning: true,
  continueOnError: false,
  generateReport: true
};
```

### Development Migration Config
```typescript
const devConfig = {
  dryRun: false,
  validateData: false,
  createIndexesLast: false,
  pauseBetweenSteps: 0,
  maxRetries: 1,
  continueOnWarning: true,
  continueOnError: true
};
```

### Testing Migration Config
```typescript
const testConfig = {
  dryRun: true,
  validateData: true,
  parallel: true,
  maxConcurrency: 2,
  failFast: true
};
```

## 🚨 Emergency Procedures

### Immediate Rollback
```typescript
// Stop current migration (if possible)
orchestrator.cancel();

// Rollback to last stable version
const currentVersion = migrationManager.getCurrentVersion();
await rollbackManager.rollbackToVersion(currentVersion - 1);
```

### Restore from Backup
```typescript
// Find latest backup
const backups = await backupManager.listBackups();
const latest = backups[0];

// Restore
await rollbackManager.restoreFromBackup(latest.path);
```

### Validate After Emergency Recovery
```typescript
const validation = await validator.validateDataIntegrity();
if (!validation.isValid) {
  console.error('Recovery failed:', validation.errors);
  // Contact support immediately
}
```

## 📞 Support Contacts

| Issue Type | Action | Command |
|------------|--------|---------|
| Migration Stuck | Check progress | `orchestrator.getCurrentProgress()` |
| Data Corruption | Validate integrity | `validator.validateDataIntegrity()` |
| Performance Issues | Run benchmark | `runner.benchmarkMigration()` |
| Rollback Needed | Emergency rollback | `rollbackManager.rollbackToVersion()` |
| Test Failures | Generate report | `runner.runTests({ generateReport: true })` |

---

**⚠️ Remember**: Always test migrations on a copy of production data before applying to production systems!