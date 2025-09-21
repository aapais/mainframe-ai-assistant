# Knowledge Base Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Migration Scripts](#migration-scripts)
4. [Configuration Options](#configuration-options)
5. [Performance Monitoring Setup](#performance-monitoring-setup)
6. [Deployment Steps](#deployment-steps)
7. [Troubleshooting](#troubleshooting)
8. [Rollback Procedures](#rollback-procedures)

---

## Overview

This guide provides comprehensive instructions for deploying the Knowledge Base listing and filtering interface, including database migrations, configuration options, monitoring setup, and troubleshooting procedures.

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Environment                    │
├─────────────────────────────────────────────────────────────┤
│ Frontend (Electron)                                         │
│ ├── React Components                                        │
│ ├── Virtual Scrolling                                       │
│ └── Real-time Updates                                       │
│                                                             │
│ Backend Services                                            │
│ ├── Knowledge Database (SQLite)                            │
│ ├── Full-text Search (FTS5)                               │
│ └── Performance Monitoring                                  │
│                                                             │
│ Infrastructure                                              │
│ ├── Local File System                                      │
│ ├── Backup Systems                                         │
│ └── Monitoring Tools                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### System Requirements

- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher
- **Operating System**: Windows 10+, macOS 10.15+, or Linux
- **Memory**: Minimum 4GB RAM, recommended 8GB+
- **Storage**: 2GB free space for application and data
- **SQLite**: v3.38.0+ (bundled with application)

### Development Tools

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Install required global packages
npm install -g electron-builder
```

---

## Migration Scripts

### Database Schema Migrations

#### Migration Script Template

Create migration files in `/migrations/` directory:

```javascript
// migrations/001_initial_kb_schema.js
const fs = require('fs');
const path = require('path');

module.exports = {
  up: async (db) => {
    console.log('Running migration: Initial KB Schema');

    const schemaPath = path.join(__dirname, '../src/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema creation
    db.exec(schema);

    console.log('✅ Initial schema created');
  },

  down: async (db) => {
    console.log('Rolling back: Initial KB Schema');

    const tables = [
      'kb_entries',
      'kb_tags',
      'kb_attachments',
      'kb_usage_metrics',
      'kb_search_history',
      'kb_categories',
      'kb_performance_logs'
    ];

    tables.forEach(table => {
      try {
        db.exec(`DROP TABLE IF EXISTS ${table}`);
        console.log(`Dropped table: ${table}`);
      } catch (error) {
        console.warn(`Warning dropping ${table}:`, error.message);
      }
    });

    console.log('✅ Schema rollback complete');
  }
};
```

#### Virtual Scrolling Optimization Migration

```javascript
// migrations/002_virtual_scrolling_indexes.js
module.exports = {
  up: async (db) => {
    console.log('Running migration: Virtual Scrolling Indexes');

    const indexes = [
      {
        name: 'idx_kb_entries_created_desc',
        sql: 'CREATE INDEX IF NOT EXISTS idx_kb_entries_created_desc ON kb_entries(created_at DESC)'
      },
      {
        name: 'idx_kb_entries_usage_desc',
        sql: 'CREATE INDEX IF NOT EXISTS idx_kb_entries_usage_desc ON kb_entries(usage_count DESC)'
      },
      {
        name: 'idx_kb_entries_category_created',
        sql: 'CREATE INDEX IF NOT EXISTS idx_kb_entries_category_created ON kb_entries(category, created_at DESC)'
      },
      {
        name: 'idx_kb_tags_entry_tag',
        sql: 'CREATE INDEX IF NOT EXISTS idx_kb_tags_entry_tag ON kb_tags(entry_id, tag)'
      },
      {
        name: 'idx_kb_search_timestamp',
        sql: 'CREATE INDEX IF NOT EXISTS idx_kb_search_timestamp ON kb_search_history(timestamp DESC)'
      }
    ];

    indexes.forEach(index => {
      try {
        db.exec(index.sql);
        console.log(`✅ Created index: ${index.name}`);
      } catch (error) {
        console.error(`❌ Failed to create index ${index.name}:`, error.message);
        throw error;
      }
    });

    // Update statistics
    db.exec('ANALYZE');

    console.log('✅ Virtual scrolling optimization complete');
  },

  down: async (db) => {
    const indexes = [
      'idx_kb_entries_created_desc',
      'idx_kb_entries_usage_desc',
      'idx_kb_entries_category_created',
      'idx_kb_tags_entry_tag',
      'idx_kb_search_timestamp'
    ];

    indexes.forEach(index => {
      try {
        db.exec(`DROP INDEX IF EXISTS ${index}`);
        console.log(`Dropped index: ${index}`);
      } catch (error) {
        console.warn(`Warning dropping ${index}:`, error.message);
      }
    });
  }
};
```

#### Full-Text Search Enhancement Migration

```javascript
// migrations/003_fts_enhancements.js
module.exports = {
  up: async (db) => {
    console.log('Running migration: FTS Enhancements');

    // Drop existing FTS table if exists
    db.exec('DROP TABLE IF EXISTS kb_entries_fts');

    // Create enhanced FTS table
    db.exec(`
      CREATE VIRTUAL TABLE kb_entries_fts USING fts5(
        entry_id UNINDEXED,
        title,
        problem,
        solution,
        tags,
        category UNINDEXED,
        prefix='2 3 4',
        content_rowid=entry_id
      )
    `);

    // Populate FTS table
    db.exec(`
      INSERT INTO kb_entries_fts(entry_id, title, problem, solution, tags, category)
      SELECT
        e.id,
        e.title,
        e.problem,
        e.solution,
        COALESCE(GROUP_CONCAT(t.tag, ' '), ''),
        e.category
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      GROUP BY e.id
    `);

    // Create triggers to maintain FTS sync
    db.exec(`
      CREATE TRIGGER kb_entries_fts_insert AFTER INSERT ON kb_entries BEGIN
        INSERT INTO kb_entries_fts(entry_id, title, problem, solution, category)
        VALUES (new.id, new.title, new.problem, new.solution, new.category);
      END
    `);

    db.exec(`
      CREATE TRIGGER kb_entries_fts_delete AFTER DELETE ON kb_entries BEGIN
        DELETE FROM kb_entries_fts WHERE entry_id = old.id;
      END
    `);

    db.exec(`
      CREATE TRIGGER kb_entries_fts_update AFTER UPDATE ON kb_entries BEGIN
        DELETE FROM kb_entries_fts WHERE entry_id = old.id;
        INSERT INTO kb_entries_fts(entry_id, title, problem, solution, category)
        VALUES (new.id, new.title, new.problem, new.solution, new.category);
      END
    `);

    console.log('✅ FTS enhancements complete');
  },

  down: async (db) => {
    // Drop triggers
    const triggers = [
      'kb_entries_fts_insert',
      'kb_entries_fts_delete',
      'kb_entries_fts_update'
    ];

    triggers.forEach(trigger => {
      try {
        db.exec(`DROP TRIGGER IF EXISTS ${trigger}`);
      } catch (error) {
        console.warn(`Warning dropping trigger ${trigger}:`, error.message);
      }
    });

    // Drop FTS table
    db.exec('DROP TABLE IF EXISTS kb_entries_fts');
  }
};
```

#### Migration Runner

```javascript
// scripts/migrate.js
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

class MigrationRunner {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.migrationsDir = path.join(__dirname, '../migrations');

    // Create migrations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async run() {
    console.log('🚀 Starting database migrations...');

    const migrationFiles = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort();

    const executedMigrations = this.db.prepare(
      'SELECT filename FROM migrations'
    ).all().map(row => row.filename);

    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📝 Found ${pendingMigrations.length} pending migrations`);

    for (const filename of pendingMigrations) {
      console.log(`\n📋 Executing: ${filename}`);

      try {
        const migrationPath = path.join(this.migrationsDir, filename);
        const migration = require(migrationPath);

        // Start transaction
        const transaction = this.db.transaction(() => {
          // Execute migration
          migration.up(this.db);

          // Record execution
          this.db.prepare(
            'INSERT INTO migrations (filename) VALUES (?)'
          ).run(filename);
        });

        transaction();

        console.log(`✅ Completed: ${filename}`);
      } catch (error) {
        console.error(`❌ Failed: ${filename}`);
        console.error(error);
        throw error;
      }
    }

    console.log('\n🎉 All migrations completed successfully!');
  }

  async rollback(targetMigration) {
    console.log(`🔄 Rolling back to: ${targetMigration}`);

    const executedMigrations = this.db.prepare(`
      SELECT filename FROM migrations
      ORDER BY executed_at DESC
    `).all();

    const migrationsToRollback = [];

    for (const migration of executedMigrations) {
      migrationsToRollback.push(migration.filename);
      if (migration.filename === targetMigration) {
        break;
      }
    }

    for (const filename of migrationsToRollback) {
      console.log(`📋 Rolling back: ${filename}`);

      try {
        const migrationPath = path.join(this.migrationsDir, filename);
        const migration = require(migrationPath);

        const transaction = this.db.transaction(() => {
          if (migration.down) {
            migration.down(this.db);
          }

          this.db.prepare(
            'DELETE FROM migrations WHERE filename = ?'
          ).run(filename);
        });

        transaction();

        console.log(`✅ Rolled back: ${filename}`);
      } catch (error) {
        console.error(`❌ Rollback failed: ${filename}`);
        console.error(error);
        throw error;
      }
    }

    console.log('🎉 Rollback completed!');
  }

  close() {
    this.db.close();
  }
}

// CLI usage
if (require.main === module) {
  const command = process.argv[2];
  const dbPath = process.argv[3] || './knowledge.db';

  const runner = new MigrationRunner(dbPath);

  switch (command) {
    case 'up':
      runner.run()
        .then(() => process.exit(0))
        .catch(error => {
          console.error('Migration failed:', error);
          process.exit(1);
        });
      break;

    case 'rollback':
      const target = process.argv[4];
      if (!target) {
        console.error('Please specify target migration');
        process.exit(1);
      }
      runner.rollback(target)
        .then(() => process.exit(0))
        .catch(error => {
          console.error('Rollback failed:', error);
          process.exit(1);
        });
      break;

    default:
      console.log('Usage:');
      console.log('  node migrate.js up [db_path]');
      console.log('  node migrate.js rollback [db_path] [target_migration]');
      process.exit(1);
  }
}

module.exports = MigrationRunner;
```

---

## Configuration Options

### Application Configuration

Create `config/production.json`:

```json
{
  "database": {
    "path": "./data/knowledge.db",
    "options": {
      "verbose": false,
      "fileMustExist": false,
      "timeout": 5000,
      "readonly": false
    },
    "pragma": {
      "journal_mode": "WAL",
      "synchronous": "NORMAL",
      "cache_size": "-64000",
      "temp_store": "MEMORY",
      "mmap_size": "268435456"
    }
  },
  "search": {
    "defaultLimit": 50,
    "maxLimit": 1000,
    "ftsRankThreshold": 0.1,
    "fuzzyMatchThreshold": 0.3,
    "cacheSize": 100,
    "cacheTTL": 300000
  },
  "virtualScrolling": {
    "itemHeight": 120,
    "overscan": 5,
    "bufferSize": 10,
    "scrollDebounce": 16
  },
  "performance": {
    "enableMetrics": true,
    "logSlowQueries": true,
    "slowQueryThreshold": 1000,
    "batchSize": 100,
    "maxConcurrentOperations": 5
  },
  "ui": {
    "theme": "system",
    "animations": true,
    "compactMode": false,
    "showLineNumbers": true,
    "highlightMatches": true
  },
  "accessibility": {
    "announceChanges": true,
    "keyboardNavigation": true,
    "highContrast": false,
    "reducedMotion": false
  },
  "backup": {
    "enabled": true,
    "interval": 3600000,
    "maxBackups": 10,
    "path": "./backups"
  },
  "logging": {
    "level": "info",
    "file": "./logs/kb-app.log",
    "maxSize": "10MB",
    "maxFiles": 5
  }
}
```

### Environment Configuration

Create `.env.production`:

```bash
# Application Environment
NODE_ENV=production
ELECTRON_ENV=production

# Database Configuration
DB_PATH=./data/knowledge.db
DB_BACKUP_PATH=./backups
DB_LOG_QUERIES=false

# Performance Tuning
SEARCH_CACHE_SIZE=100
VIRTUAL_SCROLL_BUFFER=10
MAX_CONCURRENT_OPERATIONS=5

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_EXPORT=true
ENABLE_BATCH_OPERATIONS=true
ENABLE_INLINE_EDITING=true

# Security
ENABLE_AUDIT_LOG=true
MAX_EXPORT_SIZE=1000
RATE_LIMIT_REQUESTS=100

# UI Configuration
DEFAULT_THEME=system
ENABLE_ANIMATIONS=true
SHOW_PERFORMANCE_METRICS=false
```

### Runtime Configuration Loader

```typescript
// src/config/ConfigManager.ts
import fs from 'fs';
import path from 'path';

interface AppConfig {
  database: DatabaseConfig;
  search: SearchConfig;
  virtualScrolling: VirtualScrollConfig;
  performance: PerformanceConfig;
  ui: UIConfig;
  accessibility: AccessibilityConfig;
  backup: BackupConfig;
  logging: LoggingConfig;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;
  private configPath: string;

  private constructor() {
    this.configPath = this.getConfigPath();
    this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private getConfigPath(): string {
    const env = process.env.NODE_ENV || 'development';
    return path.join(__dirname, `../../config/${env}.json`);
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(configData);
      } else {
        console.warn(`Config file not found: ${this.configPath}, using defaults`);
        this.config = this.getDefaultConfig();
      }

      // Override with environment variables
      this.applyEnvironmentOverrides();

      console.log('✅ Configuration loaded successfully');
    } catch (error) {
      console.error('Failed to load configuration:', error);
      this.config = this.getDefaultConfig();
    }
  }

  private applyEnvironmentOverrides(): void {
    if (process.env.DB_PATH) {
      this.config.database.path = process.env.DB_PATH;
    }

    if (process.env.SEARCH_CACHE_SIZE) {
      this.config.search.cacheSize = parseInt(process.env.SEARCH_CACHE_SIZE);
    }

    if (process.env.ENABLE_ANALYTICS === 'false') {
      this.config.performance.enableMetrics = false;
    }

    // Add more environment overrides as needed
  }

  private getDefaultConfig(): AppConfig {
    return {
      database: {
        path: './data/knowledge.db',
        options: {
          verbose: false,
          timeout: 5000
        },
        pragma: {
          journal_mode: 'WAL',
          synchronous: 'NORMAL'
        }
      },
      search: {
        defaultLimit: 50,
        maxLimit: 1000,
        cacheSize: 100,
        cacheTTL: 300000
      },
      virtualScrolling: {
        itemHeight: 120,
        overscan: 5
      },
      performance: {
        enableMetrics: true,
        logSlowQueries: false
      },
      ui: {
        theme: 'system',
        animations: true
      },
      accessibility: {
        announceChanges: true,
        keyboardNavigation: true
      },
      backup: {
        enabled: false,
        interval: 3600000
      },
      logging: {
        level: 'info',
        file: './logs/kb-app.log'
      }
    };
  }

  getConfig(): AppConfig {
    return { ...this.config }; // Return copy to prevent mutations
  }

  get<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return this.config[section];
  }

  updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  private saveConfig(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2)
      );

      console.log('✅ Configuration saved');
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }
}
```

---

## Performance Monitoring Setup

### Performance Metrics Collector

```typescript
// src/monitoring/PerformanceMonitor.ts
export class PerformanceMonitor {
  private metrics: Map<string, MetricData> = new Map();
  private enabled: boolean = true;

  constructor(config: PerformanceConfig) {
    this.enabled = config.enableMetrics;
  }

  startTimer(operation: string): PerformanceTimer {
    if (!this.enabled) return new NoOpTimer();

    const startTime = performance.now();

    return {
      end: (metadata?: any) => {
        const duration = performance.now() - startTime;
        this.recordMetric(operation, duration, metadata);
      }
    };
  }

  recordMetric(operation: string, duration: number, metadata?: any): void {
    if (!this.enabled) return;

    const existing = this.metrics.get(operation) || {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      recentSamples: []
    };

    existing.count++;
    existing.totalDuration += duration;
    existing.avgDuration = existing.totalDuration / existing.count;
    existing.minDuration = Math.min(existing.minDuration, duration);
    existing.maxDuration = Math.max(existing.maxDuration, duration);

    // Keep recent samples for trend analysis
    existing.recentSamples.push({ duration, timestamp: Date.now(), metadata });
    if (existing.recentSamples.length > 100) {
      existing.recentSamples.shift();
    }

    this.metrics.set(operation, existing);

    // Log slow operations
    if (duration > 1000) { // 1 second threshold
      console.warn(`Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`, metadata);
    }
  }

  getMetrics(): Map<string, MetricData> {
    return new Map(this.metrics);
  }

  getReport(): PerformanceReport {
    const operations = Array.from(this.metrics.entries()).map(([name, data]) => ({
      name,
      ...data,
      trend: this.calculateTrend(data.recentSamples)
    }));

    return {
      timestamp: new Date(),
      operations,
      summary: {
        totalOperations: operations.reduce((sum, op) => sum + op.count, 0),
        avgResponseTime: operations.reduce((sum, op) => sum + op.avgDuration, 0) / operations.length,
        slowOperations: operations.filter(op => op.avgDuration > 1000).length
      }
    };
  }

  private calculateTrend(samples: PerformanceSample[]): 'improving' | 'stable' | 'degrading' {
    if (samples.length < 10) return 'stable';

    const recent = samples.slice(-10);
    const earlier = samples.slice(-20, -10);

    const recentAvg = recent.reduce((sum, s) => sum + s.duration, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, s) => sum + s.duration, 0) / earlier.length;

    const change = (recentAvg - earlierAvg) / earlierAvg;

    if (change < -0.1) return 'improving';
    if (change > 0.1) return 'degrading';
    return 'stable';
  }

  reset(): void {
    this.metrics.clear();
  }
}
```

### Health Check Endpoint

```typescript
// src/monitoring/HealthChecker.ts
export class HealthChecker {
  private db: KnowledgeDB;
  private performanceMonitor: PerformanceMonitor;

  constructor(db: KnowledgeDB, monitor: PerformanceMonitor) {
    this.db = db;
    this.performanceMonitor = monitor;
  }

  async checkHealth(): Promise<HealthStatus> {
    const checks: HealthCheck[] = [];

    // Database connectivity
    checks.push(await this.checkDatabase());

    // Search performance
    checks.push(await this.checkSearchPerformance());

    // Memory usage
    checks.push(await this.checkMemoryUsage());

    // Disk space
    checks.push(await this.checkDiskSpace());

    const overallStatus = checks.every(c => c.status === 'healthy')
      ? 'healthy'
      : checks.some(c => c.status === 'critical')
      ? 'critical'
      : 'warning';

    return {
      status: overallStatus,
      timestamp: new Date(),
      checks,
      performance: this.performanceMonitor.getReport()
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    try {
      const timer = this.performanceMonitor.startTimer('health_check_db');

      // Simple query to test connectivity
      const result = this.db.prepare('SELECT COUNT(*) as count FROM kb_entries').get();

      timer.end();

      return {
        name: 'database',
        status: 'healthy',
        message: `Database operational with ${result.count} entries`,
        details: { entryCount: result.count }
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'critical',
        message: 'Database connection failed',
        error: error.message
      };
    }
  }

  private async checkSearchPerformance(): Promise<HealthCheck> {
    try {
      const timer = this.performanceMonitor.startTimer('health_check_search');

      // Test search performance
      await this.db.search('test query', { limit: 10 });

      const duration = timer.end();

      const status = duration > 2000 ? 'warning' : duration > 5000 ? 'critical' : 'healthy';

      return {
        name: 'search_performance',
        status,
        message: `Search completed in ${duration}ms`,
        details: { responseTime: duration }
      };
    } catch (error) {
      return {
        name: 'search_performance',
        status: 'critical',
        message: 'Search functionality failed',
        error: error.message
      };
    }
  }

  private async checkMemoryUsage(): Promise<HealthCheck> {
    const usage = process.memoryUsage();
    const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(usage.heapTotal / 1024 / 1024);

    const status = usedMB > 512 ? 'warning' : usedMB > 1024 ? 'critical' : 'healthy';

    return {
      name: 'memory_usage',
      status,
      message: `Using ${usedMB}MB of ${totalMB}MB heap`,
      details: {
        heapUsed: usedMB,
        heapTotal: totalMB,
        external: Math.round(usage.external / 1024 / 1024)
      }
    };
  }

  private async checkDiskSpace(): Promise<HealthCheck> {
    try {
      const fs = require('fs');
      const stats = fs.statSync('./');

      return {
        name: 'disk_space',
        status: 'healthy',
        message: 'Disk space sufficient',
        details: { available: 'Unknown' } // Platform-specific implementation needed
      };
    } catch (error) {
      return {
        name: 'disk_space',
        status: 'warning',
        message: 'Could not check disk space',
        error: error.message
      };
    }
  }
}
```

---

## Deployment Steps

### Pre-deployment Checklist

```bash
#!/bin/bash
# scripts/pre-deploy-check.sh

echo "🚀 Pre-deployment Health Check"
echo "================================"

# Check Node.js version
NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"

if [[ ! $NODE_VERSION =~ v1[8-9]\. ]] && [[ ! $NODE_VERSION =~ v2[0-9]\. ]]; then
  echo "❌ Node.js version must be 18.0.0 or higher"
  exit 1
fi

# Check disk space
AVAILABLE_SPACE=$(df -h . | tail -1 | awk '{print $4}')
echo "Available disk space: $AVAILABLE_SPACE"

# Check dependencies
echo "📦 Checking dependencies..."
npm audit --audit-level=high
if [ $? -ne 0 ]; then
  echo "⚠️  Security vulnerabilities found. Please run 'npm audit fix'"
fi

# Run tests
echo "🧪 Running tests..."
npm test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Please fix before deploying."
  exit 1
fi

# Build application
echo "🏗️  Building application..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed."
  exit 1
fi

echo "✅ Pre-deployment checks passed!"
```

### Deployment Script

```bash
#!/bin/bash
# scripts/deploy.sh

set -e  # Exit on any error

echo "🚀 Starting Knowledge Base Application Deployment"
echo "=================================================="

# Configuration
APP_NAME="mainframe-kb-assistant"
DEPLOY_DIR="/opt/$APP_NAME"
BACKUP_DIR="/opt/$APP_NAME/backups"
SERVICE_USER="kbapp"
LOG_FILE="/var/log/$APP_NAME/deploy.log"

# Create log directory
sudo mkdir -p "$(dirname "$LOG_FILE")"
sudo touch "$LOG_FILE"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | sudo tee -a "$LOG_FILE"
}

log "Starting deployment process..."

# Stop existing service if running
if systemctl is-active --quiet $APP_NAME; then
  log "Stopping existing service..."
  sudo systemctl stop $APP_NAME
fi

# Create backup of current installation
if [ -d "$DEPLOY_DIR" ]; then
  log "Creating backup of current installation..."
  BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
  sudo cp -r "$DEPLOY_DIR" "$BACKUP_DIR/$BACKUP_NAME"

  # Keep only last 5 backups
  sudo find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup-*" | sort -r | tail -n +6 | xargs sudo rm -rf
fi

# Create directories
log "Creating application directories..."
sudo mkdir -p "$DEPLOY_DIR"
sudo mkdir -p "$DEPLOY_DIR/data"
sudo mkdir -p "$DEPLOY_DIR/logs"
sudo mkdir -p "$DEPLOY_DIR/config"
sudo mkdir -p "$BACKUP_DIR"

# Copy application files
log "Copying application files..."
sudo cp -r dist/* "$DEPLOY_DIR/"
sudo cp -r config/* "$DEPLOY_DIR/config/"
sudo cp package.json "$DEPLOY_DIR/"

# Install dependencies (production only)
log "Installing dependencies..."
cd "$DEPLOY_DIR"
sudo npm install --production --silent

# Set up permissions
log "Setting up permissions..."
sudo useradd -r -s /bin/false $SERVICE_USER 2>/dev/null || true
sudo chown -R $SERVICE_USER:$SERVICE_USER "$DEPLOY_DIR"
sudo chmod -R 755 "$DEPLOY_DIR"

# Run database migrations
log "Running database migrations..."
sudo -u $SERVICE_USER node scripts/migrate.js up "$DEPLOY_DIR/data/knowledge.db"

# Create systemd service
log "Creating systemd service..."
sudo tee /etc/systemd/system/$APP_NAME.service > /dev/null << EOF
[Unit]
Description=Mainframe Knowledge Base Assistant
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$DEPLOY_DIR
ExecStart=/usr/bin/node main/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
StandardOutput=append:$LOG_FILE
StandardError=append:$LOG_FILE

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DEPLOY_DIR

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start service
log "Starting service..."
sudo systemctl daemon-reload
sudo systemctl enable $APP_NAME
sudo systemctl start $APP_NAME

# Wait for service to start
sleep 5

# Check service status
if systemctl is-active --quiet $APP_NAME; then
  log "✅ Service started successfully"
else
  log "❌ Service failed to start"
  sudo systemctl status $APP_NAME
  exit 1
fi

# Run health check
log "Running post-deployment health check..."
sleep 10

# Create monitoring cron job
log "Setting up monitoring..."
sudo tee /etc/cron.d/$APP_NAME > /dev/null << EOF
# Knowledge Base Application Monitoring
*/5 * * * * $SERVICE_USER cd $DEPLOY_DIR && node scripts/health-check.js >> $LOG_FILE 2>&1
0 2 * * * $SERVICE_USER cd $DEPLOY_DIR && node scripts/backup.js >> $LOG_FILE 2>&1
EOF

log "🎉 Deployment completed successfully!"
log "Service status: $(sudo systemctl is-active $APP_NAME)"
log "Service URL: http://localhost:3000"
log "Logs: tail -f $LOG_FILE"
```

### Health Check Script

```javascript
// scripts/health-check.js
const { KnowledgeDB } = require('../src/database/KnowledgeDB');
const { HealthChecker } = require('../src/monitoring/HealthChecker');
const { PerformanceMonitor } = require('../src/monitoring/PerformanceMonitor');

async function runHealthCheck() {
  try {
    const db = new KnowledgeDB(process.env.DB_PATH || './data/knowledge.db');
    const monitor = new PerformanceMonitor({ enableMetrics: true });
    const healthChecker = new HealthChecker(db, monitor);

    const health = await healthChecker.checkHealth();

    console.log(`Health Status: ${health.status}`);

    if (health.status === 'critical') {
      console.error('Critical health issues detected:');
      health.checks
        .filter(check => check.status === 'critical')
        .forEach(check => console.error(`- ${check.name}: ${check.message}`));

      process.exit(1);
    }

    if (health.status === 'warning') {
      console.warn('Health warnings detected:');
      health.checks
        .filter(check => check.status === 'warning')
        .forEach(check => console.warn(`- ${check.name}: ${check.message}`));
    }

    db.close();
    console.log('Health check completed');

  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runHealthCheck();
}
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Database Lock Errors

**Symptoms:**
```
Error: SQLITE_BUSY: database is locked
```

**Solutions:**
```bash
# Check for zombie processes
ps aux | grep node

# Check database lock
lsof | grep knowledge.db

# Force unlock (as last resort)
sqlite3 knowledge.db "BEGIN IMMEDIATE; ROLLBACK;"

# Enable WAL mode
sqlite3 knowledge.db "PRAGMA journal_mode=WAL;"
```

#### Issue: Slow Search Performance

**Symptoms:**
- Search takes >2 seconds
- UI becomes unresponsive

**Diagnosis:**
```javascript
// Enable query logging
const db = new Database(dbPath, { verbose: console.log });

// Check indexes
db.exec('ANALYZE');
const indexes = db.prepare('SELECT * FROM sqlite_master WHERE type="index"').all();
console.log('Available indexes:', indexes);
```

**Solutions:**
```sql
-- Rebuild FTS index
DROP TABLE kb_entries_fts;
-- Re-run FTS migration

-- Update statistics
ANALYZE;

-- Check query plan
EXPLAIN QUERY PLAN SELECT * FROM kb_entries WHERE title MATCH 'search term';
```

#### Issue: Virtual Scrolling Performance

**Symptoms:**
- Laggy scrolling
- Memory usage increasing

**Solutions:**
```typescript
// Reduce overscan in configuration
virtualScrolling: {
  overscan: 3,  // Reduced from 5
  bufferSize: 5  // Reduced from 10
}

// Enable scroll debouncing
const debouncedScroll = debounce(handleScroll, 16);

// Monitor memory usage
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === 'measure') {
      console.log(`${entry.name}: ${entry.duration}ms`);
    }
  }
});
observer.observe({entryTypes: ['measure']});
```

#### Issue: High Memory Usage

**Symptoms:**
```
Warning: Possible EventEmitter memory leak detected
Memory usage over 1GB
```

**Diagnosis:**
```javascript
// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory usage:', {
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB'
  });
}, 30000);

// Check for listeners
console.log('Event listeners:', process.listenerCount('uncaughtException'));
```

**Solutions:**
```typescript
// Implement proper cleanup
useEffect(() => {
  const cleanup = () => {
    // Remove event listeners
    // Clear intervals/timeouts
    // Cancel pending requests
  };

  return cleanup;
}, []);

// Use weak references where appropriate
const searchCache = new WeakMap();

// Implement garbage collection hints
if (global.gc) {
  setInterval(() => global.gc(), 60000);
}
```

### Debugging Guide

#### Enable Debug Logging

```bash
# Environment variable
DEBUG=kb:* npm start

# Or in application
export NODE_ENV=development
export DEBUG_KB=true
```

#### Database Debugging

```javascript
// Enable SQL logging
const db = new Database(dbPath, {
  verbose: (sql, params) => {
    console.log(`SQL: ${sql}`);
    if (params) console.log(`Params:`, params);
  }
});

// Profile queries
const startTime = Date.now();
const result = stmt.all();
console.log(`Query took ${Date.now() - startTime}ms`);
```

#### Performance Profiling

```javascript
// Use Node.js built-in profiler
node --prof app.js
# Generate report
node --prof-process isolate-*.log > profiling-report.txt

// Browser performance profiling
performance.mark('search-start');
// ... search operation
performance.mark('search-end');
performance.measure('search-duration', 'search-start', 'search-end');
```

---

## Rollback Procedures

### Automatic Rollback Script

```bash
#!/bin/bash
# scripts/rollback.sh

APP_NAME="mainframe-kb-assistant"
DEPLOY_DIR="/opt/$APP_NAME"
BACKUP_DIR="/opt/$APP_NAME/backups"
LOG_FILE="/var/log/$APP_NAME/rollback.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | sudo tee -a "$LOG_FILE"
}

# Get latest backup
LATEST_BACKUP=$(sudo find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup-*" | sort -r | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
  log "❌ No backup found for rollback"
  exit 1
fi

log "🔄 Starting rollback to: $(basename "$LATEST_BACKUP")"

# Stop current service
log "Stopping service..."
sudo systemctl stop $APP_NAME

# Create backup of failed deployment
log "Backing up failed deployment..."
FAILED_BACKUP="failed-$(date +%Y%m%d-%H%M%S)"
sudo mv "$DEPLOY_DIR" "$BACKUP_DIR/$FAILED_BACKUP"

# Restore from backup
log "Restoring from backup..."
sudo cp -r "$LATEST_BACKUP" "$DEPLOY_DIR"

# Start service
log "Starting service..."
sudo systemctl start $APP_NAME

# Wait and check
sleep 5

if systemctl is-active --quiet $APP_NAME; then
  log "✅ Rollback completed successfully"
else
  log "❌ Rollback failed - service not running"
  exit 1
fi

log "Service status: $(sudo systemctl is-active $APP_NAME)"
```

### Database Rollback

```javascript
// scripts/rollback-database.js
const MigrationRunner = require('./migrate.js');
const path = require('path');

async function rollbackDatabase(targetMigration) {
  const dbPath = process.env.DB_PATH || './data/knowledge.db';
  const backupPath = `${dbPath}.backup-${Date.now()}`;

  console.log('🔄 Starting database rollback...');

  try {
    // Create backup before rollback
    const fs = require('fs');
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Database backup created: ${backupPath}`);

    // Run rollback
    const runner = new MigrationRunner(dbPath);
    await runner.rollback(targetMigration);

    console.log('✅ Database rollback completed');

  } catch (error) {
    console.error('❌ Database rollback failed:', error);

    // Restore from backup
    console.log('🔄 Restoring from backup...');
    fs.copyFileSync(backupPath, dbPath);
    console.log('✅ Database restored from backup');

    process.exit(1);
  }
}

// CLI usage
if (require.main === module) {
  const targetMigration = process.argv[2];
  if (!targetMigration) {
    console.error('Usage: node rollback-database.js <target_migration>');
    process.exit(1);
  }

  rollbackDatabase(targetMigration);
}
```

---

This deployment guide provides comprehensive instructions for deploying, configuring, monitoring, and maintaining the Knowledge Base application. The migration scripts ensure safe database updates, while the monitoring setup helps maintain optimal performance in production.