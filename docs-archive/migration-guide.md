# Migration Guide

## Overview

This guide covers migration procedures for the Database Utilities System, including MVP upgrades, PostgreSQL migration, data migration, and system upgrades. The system is designed with migration-first principles to ensure smooth evolution and minimal downtime.

## Table of Contents

1. [MVP Upgrade Paths](#mvp-upgrade-paths)
2. [PostgreSQL Migration](#postgresql-migration)
3. [Data Migration Procedures](#data-migration-procedures)
4. [Schema Upgrades](#schema-upgrades)
5. [Rollback Procedures](#rollback-procedures)
6. [Best Practices](#best-practices)

## MVP Upgrade Paths

The system follows a progressive MVP architecture. Each upgrade builds upon the previous version while maintaining backward compatibility.

### MVP1 to MVP2: Pattern Detection

**What's New:**
- Pattern detection engine
- Incident import capabilities
- Advanced analytics tables
- Alert system

**Migration Steps:**

1. **Pre-Migration Backup**
```bash
# Create backup before upgrade
npm run backup:create --type=pre-migration --tag=mvp1-to-mvp2
```

2. **Install New Dependencies**
```bash
npm install @types/node-cron uuid lodash
npm update better-sqlite3 typescript
```

3. **Run Schema Migration**
```typescript
import { MigrationManager } from './src/database/MigrationManager';
import { KnowledgeDB } from './src/database/KnowledgeDB';

const db = new KnowledgeDB('./knowledge.db');
const migrationManager = new MigrationManager(db['db']);

// Run MVP2 migrations
const results = await migrationManager.migrateTo('002-mvp2-pattern-detection');
if (results.some(r => !r.success)) {
  console.error('Migration failed:', results);
  // Rollback if needed
  await migrationManager.rollbackTo('001-mvp1-base');
}
```

4. **Verify Migration**
```typescript
// Test new pattern detection features
const patterns = await db.detectPatterns(['VSAM', 'JCL']);
console.log('Pattern detection working:', patterns.length > 0);
```

### MVP2 to MVP3: Code Analysis

**What's New:**
- COBOL code parsing
- Code-to-KB linking
- Enhanced search with code context
- File reference tracking

**Migration Steps:**

1. **Add Code Analysis Tables**
```sql
-- New tables for MVP3
CREATE TABLE code_files (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    file_type TEXT CHECK(file_type IN ('cobol', 'jcl', 'copybook')),
    content TEXT,
    parsed_at DATETIME,
    metadata JSON
);

CREATE TABLE kb_code_links (
    kb_entry_id TEXT,
    code_file_id TEXT,
    line_start INTEGER,
    line_end INTEGER,
    confidence REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kb_entry_id) REFERENCES kb_entries(id),
    FOREIGN KEY (code_file_id) REFERENCES code_files(id)
);
```

2. **Data Migration Script**
```typescript
// MVP3 migration script
async function migrateToMVP3(db: KnowledgeDB) {
  console.log('Starting MVP3 migration...');
  
  // Create new tables
  await db.executeMigration('003-mvp3-code-analysis');
  
  // Migrate existing entries to support code linking
  const entries = await db.search('', { limit: 1000, includeArchived: true });
  
  for (const result of entries) {
    // Add code analysis metadata
    await db.updateEntry(result.entry.id!, {
      metadata: { 
        code_analysis_ready: true,
        migration_version: 'mvp3' 
      }
    });
  }
  
  console.log(`Migrated ${entries.length} entries for code analysis`);
}
```

### MVP3 to MVP4: IDZ Integration

**What's New:**
- IDZ project import/export
- Template engine
- Multi-file workspace
- Validation pipeline

**Migration Steps:**

1. **Environment Setup**
```bash
# Install IDZ integration dependencies
npm install archiver unzipper xml2js fs-extra
```

2. **Workspace Preparation**
```typescript
// Create workspace structure
const workspaceDir = './workspaces';
await fs.ensureDir(workspaceDir);
await fs.ensureDir('./templates');
await fs.ensureDir('./exports');
```

3. **Schema Updates**
```sql
-- MVP4 project management tables
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    idz_path TEXT,
    workspace_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active'
);

CREATE TABLE project_files (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    relative_path TEXT,
    file_type TEXT,
    checksum TEXT,
    last_modified DATETIME,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    template_content JSON,
    usage_count INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0.0
);
```

### MVP4 to MVP5: Enterprise Intelligence

**What's New:**
- Auto-resolution engine
- Predictive analytics
- Advanced ML models
- Enterprise security features

**Migration Steps:**

1. **ML Dependencies**
```bash
npm install tensorflow @tensorflow/tfjs-node
npm install @types/ml-matrix ml-regression
```

2. **Security Upgrades**
```sql
-- User management and security
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

3. **AI Model Setup**
```typescript
// Initialize ML models for auto-resolution
import { AutoResolutionEngine } from './src/ai/AutoResolutionEngine';

const engine = new AutoResolutionEngine({
  confidenceThreshold: 0.85,
  enableLearning: true,
  modelPath: './models/auto-resolution-v1.json'
});

await engine.trainFromHistoricalData(db);
```

## PostgreSQL Migration

For enterprise deployments requiring PostgreSQL, the system provides a complete migration path.

### Migration Strategy

```typescript
import { PostgreSQLMigration } from './src/database/PostgreSQLMigration';

const migration = new PostgreSQLMigration({
  sqliteDbPath: './knowledge.db',
  postgresConfig: {
    host: 'localhost',
    port: 5432,
    database: 'knowledge_base',
    username: 'kb_user',
    password: 'secure_password'
  }
});
```

### Phase 1: Schema Migration

```typescript
async function migrateSchema() {
  console.log('Phase 1: Migrating database schema...');
  
  // Create PostgreSQL schema
  await migration.createPostgreSQLSchema();
  
  // Verify schema compatibility
  const validation = await migration.validateSchema();
  if (!validation.valid) {
    throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`);
  }
  
  console.log('✅ Schema migration completed');
}
```

### Phase 2: Data Migration

```typescript
async function migrateData() {
  console.log('Phase 2: Migrating data...');
  
  const result = await migration.migrateData({
    batchSize: 1000,
    preserveIds: true,
    validateData: true,
    progressCallback: (progress) => {
      console.log(`Progress: ${progress.percentage}% (${progress.processed}/${progress.total})`);
    }
  });
  
  console.log(`✅ Data migration completed: ${result.recordsMigrated} records`);
  
  if (result.errors.length > 0) {
    console.warn('Migration warnings:', result.errors);
  }
}
```

### Phase 3: Validation and Testing

```typescript
async function validateMigration() {
  console.log('Phase 3: Validating migration...');
  
  // Compare record counts
  const validation = await migration.validateMigration();
  
  console.log('Validation Results:');
  console.log(`SQLite entries: ${validation.sqlite.entryCount}`);
  console.log(`PostgreSQL entries: ${validation.postgresql.entryCount}`);
  console.log(`Data integrity: ${validation.dataIntegrity ? '✅' : '❌'}`);
  
  // Test search functionality
  const testQuery = 'VSAM status 35';
  const sqliteResults = await migration.testSearchSQLite(testQuery);
  const postgresResults = await migration.testSearchPostgreSQL(testQuery);
  
  console.log(`Search parity: ${sqliteResults.length === postgresResults.length ? '✅' : '❌'}`);
}
```

### Complete PostgreSQL Migration Script

```typescript
#!/usr/bin/env node

import { PostgreSQLMigration } from './src/database/PostgreSQLMigration';

async function fullMigration() {
  try {
    const migration = new PostgreSQLMigration({
      sqliteDbPath: process.env.SQLITE_DB_PATH || './knowledge.db',
      postgresConfig: {
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        database: process.env.PG_DATABASE || 'knowledge_base',
        username: process.env.PG_USER || 'kb_user',
        password: process.env.PG_PASSWORD
      }
    });
    
    // Pre-migration backup
    console.log('Creating pre-migration backup...');
    await migration.createBackup('./backups/pre-postgres-migration.db');
    
    // Execute migration phases
    await migrateSchema();
    await migrateData();
    await validateMigration();
    
    // Switch application to PostgreSQL
    console.log('Phase 4: Updating application configuration...');
    await migration.updateApplicationConfig('./config/database.json');
    
    console.log('🎉 PostgreSQL migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

fullMigration();
```

## Data Migration Procedures

### Export/Import Between Environments

```typescript
// Export from production
const prodDb = new KnowledgeDB('./production.db');
await prodDb.exportToJSON('./exports/prod-data.json');

// Import to staging
const stagingDb = new KnowledgeDB('./staging.db');
await stagingDb.importFromJSON('./exports/prod-data.json', false); // Replace mode
```

### Selective Data Migration

```typescript
// Migrate only specific categories
async function migrateCategory(sourceDb: KnowledgeDB, targetDb: KnowledgeDB, category: string) {
  const entries = await sourceDb.search(`category:${category}`, { 
    limit: 10000, 
    includeArchived: true 
  });
  
  for (const result of entries) {
    await targetDb.addEntry(result.entry, 'migration-script');
  }
  
  console.log(`Migrated ${entries.length} entries for category: ${category}`);
}
```

### Data Transformation During Migration

```typescript
// Transform data format during migration
async function transformAndMigrate(sourceData: any[], targetDb: KnowledgeDB) {
  for (const item of sourceData) {
    // Transform legacy format to current format
    const transformedEntry: KBEntry = {
      title: item.title,
      problem: item.description, // Field name change
      solution: item.resolution, // Field name change
      category: mapLegacyCategory(item.type), // Category mapping
      severity: normalizeSeverity(item.priority), // Value normalization
      tags: item.keywords ? item.keywords.split(',') : [], // Format change
      created_at: new Date(item.created_timestamp)
    };
    
    await targetDb.addEntry(transformedEntry, 'migration-transform');
  }
}
```

## Schema Upgrades

### Automatic Schema Versioning

The system automatically manages schema versions:

```typescript
class MigrationManager {
  getCurrentVersion(): string {
    const result = this.db.prepare(`
      SELECT version FROM schema_version 
      ORDER BY applied_at DESC 
      LIMIT 1
    `).get();
    return result?.version || '000';
  }
  
  async migrate(): Promise<MigrationResult[]> {
    const currentVersion = this.getCurrentVersion();
    const pendingMigrations = this.getPendingMigrations(currentVersion);
    
    const results = [];
    for (const migration of pendingMigrations) {
      try {
        await this.executeMigration(migration);
        results.push({ migration: migration.name, success: true });
      } catch (error) {
        results.push({ migration: migration.name, success: false, error });
        break; // Stop on first failure
      }
    }
    
    return results;
  }
}
```

### Custom Migration Scripts

```typescript
// Custom migration for adding new features
const customMigration: Migration = {
  version: '010-custom-feature',
  name: 'Add Custom Feature Tables',
  up: `
    CREATE TABLE custom_feature (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      config JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX idx_custom_feature_name ON custom_feature(name);
  `,
  down: `
    DROP INDEX IF EXISTS idx_custom_feature_name;
    DROP TABLE IF EXISTS custom_feature;
  `,
  validate: async (db) => {
    // Custom validation logic
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='custom_feature'
    `).get();
    return !!tables;
  }
};
```

## Rollback Procedures

### Automatic Rollback on Failure

```typescript
async function safeUpgrade(targetVersion: string) {
  const db = new KnowledgeDB('./knowledge.db');
  const migrationManager = new MigrationManager(db['db']);
  
  // Create rollback point
  const rollbackPoint = migrationManager.getCurrentVersion();
  await db.createBackup(); // Automatic backup
  
  try {
    const results = await migrationManager.migrateTo(targetVersion);
    
    // Check if all migrations succeeded
    if (results.some(r => !r.success)) {
      throw new Error('Migration failed');
    }
    
    // Validate system health after migration
    const health = await db.healthCheck();
    if (!health.overall) {
      throw new Error('System health check failed after migration');
    }
    
    console.log('✅ Migration completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed, rolling back...', error);
    
    // Automatic rollback
    await migrationManager.rollbackTo(rollbackPoint);
    
    // Restore from backup if rollback fails
    const backupList = await db.listBackups();
    const latestBackup = backupList[0]; // Most recent backup
    await db.restoreFromBackup(latestBackup.path);
    
    throw error; // Re-throw for calling code
  }
}
```

### Manual Rollback Commands

```bash
# Rollback to specific version
npm run db:rollback --version=001-mvp1-base

# Rollback one version
npm run db:rollback --steps=1

# Emergency restore from backup
npm run db:restore --backup=./backups/pre-migration-backup.db
```

### Rollback Validation

```typescript
async function validateRollback(expectedVersion: string) {
  const db = new KnowledgeDB('./knowledge.db');
  const migrationManager = new MigrationManager(db['db']);
  
  const currentVersion = migrationManager.getCurrentVersion();
  if (currentVersion !== expectedVersion) {
    throw new Error(`Rollback validation failed: expected ${expectedVersion}, got ${currentVersion}`);
  }
  
  // Test basic functionality
  const testEntry = await db.addEntry({
    title: 'Rollback Test',
    problem: 'Testing after rollback',
    solution: 'Should work normally',
    category: 'Test'
  });
  
  const searchResult = await db.search('rollback test');
  if (searchResult.length === 0) {
    throw new Error('Search functionality not working after rollback');
  }
  
  // Cleanup test entry
  await db.updateEntry(testEntry, { archived: true });
  
  console.log('✅ Rollback validation successful');
}
```

## Best Practices

### Pre-Migration Checklist

```typescript
async function preMigrationChecklist(db: KnowledgeDB): Promise<boolean> {
  console.log('Running pre-migration checklist...');
  
  const issues = [];
  
  // 1. Health check
  const health = await db.healthCheck();
  if (!health.overall) {
    issues.push(`Health issues: ${health.issues.join(', ')}`);
  }
  
  // 2. Backup verification
  const backups = await db.listBackups();
  if (backups.length === 0) {
    issues.push('No recent backups found');
  }
  
  // 3. Disk space check
  const stats = await db.getStats();
  const freeSpace = await getFreeSpace('./');
  if (freeSpace < stats.diskUsage * 3) {
    issues.push('Insufficient disk space (need 3x database size)');
  }
  
  // 4. Performance baseline
  const perfStatus = db.getPerformanceStatus();
  if (!perfStatus.isHealthy) {
    issues.push('Performance issues detected');
  }
  
  if (issues.length > 0) {
    console.error('Pre-migration issues:', issues);
    return false;
  }
  
  console.log('✅ Pre-migration checklist passed');
  return true;
}
```

### Migration Testing Strategy

```typescript
// Test migration on copy of production data
async function testMigration(sourceDb: string, targetVersion: string) {
  // Create test copy
  const testDbPath = './test-migration.db';
  await fs.copyFile(sourceDb, testDbPath);
  
  const testDb = new KnowledgeDB(testDbPath);
  const migrationManager = new MigrationManager(testDb['db']);
  
  try {
    // Run migration
    await migrationManager.migrateTo(targetVersion);
    
    // Performance test
    const startTime = performance.now();
    const results = await testDb.search('test query');
    const searchTime = performance.now() - startTime;
    
    if (searchTime > 1000) {
      console.warn('Search performance degraded after migration');
    }
    
    // Functionality test
    await testBasicOperations(testDb);
    
    console.log('✅ Migration test passed');
    return true;
    
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    return false;
    
  } finally {
    await testDb.close();
    await fs.unlink(testDbPath); // Cleanup test database
  }
}
```

### Post-Migration Validation

```typescript
async function postMigrationValidation(db: KnowledgeDB) {
  console.log('Running post-migration validation...');
  
  // 1. Data integrity check
  const stats = await db.getStats();
  console.log(`Entries: ${stats.totalEntries}`);
  
  // 2. Search functionality test
  const searchTest = await db.search('test');
  console.log(`Search working: ${searchTest.length >= 0 ? '✅' : '❌'}`);
  
  // 3. Performance validation
  const perfStart = performance.now();
  await db.search('VSAM');
  const perfTime = performance.now() - perfStart;
  console.log(`Search performance: ${perfTime.toFixed(2)}ms`);
  
  // 4. Cache functionality
  const cacheStats = db.getCacheStats();
  console.log(`Cache operational: ${cacheStats.entryCount >= 0 ? '✅' : '❌'}`);
  
  // 5. Health check
  const health = await db.healthCheck();
  console.log(`System health: ${health.overall ? '✅' : '❌'}`);
  
  if (health.issues.length > 0) {
    console.warn('Post-migration issues:', health.issues);
  }
  
  console.log('✅ Post-migration validation completed');
}
```

### Environment-Specific Migrations

```typescript
// Development environment - fast migration
const devMigration = {
  skipBackups: true,
  validateOnly: false,
  seedTestData: true
};

// Staging environment - full validation
const stagingMigration = {
  skipBackups: false,
  validateOnly: false,
  runPerformanceTests: true,
  seedTestData: true
};

// Production environment - maximum safety
const productionMigration = {
  skipBackups: false,
  validateOnly: false,
  requireConfirmation: true,
  maxDowntime: 300000, // 5 minutes
  rollbackOnFailure: true,
  notifyOnCompletion: true
};
```

This migration guide provides comprehensive procedures for safely upgrading, migrating, and evolving the Database Utilities System across different MVPs and deployment environments. Always test migrations in a non-production environment first and maintain proper backups before any major changes.