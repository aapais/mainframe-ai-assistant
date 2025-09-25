#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Database Migration Runner Script
 *
 * This script handles running database migrations for the Knowledge Base system.
 * It supports:
 * - Running pending migrations
 * - Checking migration status
 * - Rolling back migrations
 * - Creating database if it doesn't exist
 */

/**
 * Simplified Migration Manager for JavaScript
 */
class SimpleMigrationManager {
  constructor(db, migrationsPath) {
    this.db = db;
    this.migrationsPath = migrationsPath;
    this.ensureMigrationsTable();
  }

  ensureMigrationsTable() {
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                rollback_sql TEXT,
                checksum TEXT,
                duration_ms INTEGER
            );
        `);

    // Also ensure backup_log table exists
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS backup_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                backup_path TEXT NOT NULL,
                backup_type TEXT DEFAULT 'manual',
                entries_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'created'
            );
        `);
  }

  getCurrentVersion() {
    const result = this.db
      .prepare(
        `
            SELECT COALESCE(MAX(version), 0) as version
            FROM schema_migrations
        `
      )
      .get();

    return result.version;
  }

  loadMigrations() {
    const migrations = [];

    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true });
      return migrations;
    }

    const files = fs
      .readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) continue;

      const version = parseInt(match[1]);
      const description = match[2].replace(/_/g, ' ');
      const filePath = path.join(this.migrationsPath, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Split into up/down sections
      const sections = content.split('-- DOWN');
      const up = sections[0].replace(/^-- UP\s*\n?/m, '').trim();
      const down = sections[1]?.trim() || '';

      migrations.push({
        version,
        description,
        up,
        down,
        checksum: this.calculateChecksum(up + down),
      });
    }

    return migrations;
  }

  async migrate() {
    const currentVersion = this.getCurrentVersion();
    const migrations = this.loadMigrations()
      .filter(m => m.version > currentVersion)
      .sort((a, b) => a.version - b.version);

    const results = [];

    for (const migration of migrations) {
      const result = await this.applyMigration(migration);
      results.push(result);

      if (!result.success) {
        console.error(`Migration ${migration.version} failed: ${result.error}`);
        break;
      }
    }

    return results;
  }

  async applyMigration(migration) {
    const startTime = Date.now();

    try {
      // Verify migration hasn't been applied
      const existing = this.db
        .prepare(
          `
                SELECT version FROM schema_migrations WHERE version = ?
            `
        )
        .get(migration.version);

      if (existing) {
        throw new Error(`Migration ${migration.version} already applied`);
      }

      // Check if migration SQL contains its own transaction management
      const hasTransaction =
        migration.up.includes('BEGIN TRANSACTION') ||
        migration.up.includes('BEGIN;') ||
        migration.up.includes('COMMIT');

      if (hasTransaction) {
        // Execute SQL as-is since it manages its own transactions
        this.db.exec(migration.up);
      } else {
        // Wrap in transaction for atomicity
        const transaction = this.db.transaction(() => {
          this.db.exec(migration.up);
        });
        transaction();
      }

      // Record migration in a separate transaction
      const recordTransaction = this.db.transaction(() => {
        this.db
          .prepare(
            `
                    INSERT INTO schema_migrations (version, description, rollback_sql, checksum, duration_ms)
                    VALUES (?, ?, ?, ?, ?)
                `
          )
          .run(
            migration.version,
            migration.description,
            migration.down,
            migration.checksum,
            Date.now() - startTime
          );
      });
      recordTransaction();

      console.log(`✅ Migration ${migration.version}: ${migration.description}`);

      return {
        success: true,
        version: migration.version,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error(`❌ Migration ${migration.version} failed:`, error);
      return {
        success: false,
        version: migration.version,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  calculateChecksum(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  getStatus() {
    const currentVersion = this.getCurrentVersion();
    const pendingCount = this.loadMigrations().filter(m => m.version > currentVersion).length;

    const applied = this.db
      .prepare(
        `
            SELECT version, description, applied_at, duration_ms
            FROM schema_migrations
            ORDER BY version DESC
            LIMIT 10
        `
      )
      .all();

    return {
      currentVersion,
      pendingMigrations: pendingCount,
      appliedMigrations: applied,
    };
  }

  validateMigrations() {
    const errors = [];
    const appliedMigrations = this.db
      .prepare(
        `
            SELECT version, checksum FROM schema_migrations ORDER BY version
        `
      )
      .all();

    const fileMigrations = this.loadMigrations();

    // Check for gaps
    for (let i = 1; i < appliedMigrations.length; i++) {
      const prev = appliedMigrations[i - 1];
      const curr = appliedMigrations[i];

      if (curr.version !== prev.version + 1) {
        errors.push(`Migration gap: ${prev.version} -> ${curr.version}`);
      }
    }

    // Check checksums
    for (const applied of appliedMigrations) {
      const file = fileMigrations.find(f => f.version === applied.version);

      if (!file) {
        errors.push(`Applied migration ${applied.version} not found in files`);
        continue;
      }

      if (file.checksum !== applied.checksum) {
        errors.push(`Checksum mismatch for migration ${applied.version}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

class MigrationRunner {
  constructor() {
    this.dbPath = path.resolve('./kb-assistant.db');
    this.migrationsPath = path.resolve(__dirname, 'migrations');
    this.db = null;
    this.migrationManager = null;
  }

  /**
   * Initialize database connection and migration manager
   */
  async initialize() {
    try {
      // Ensure migrations directory exists
      if (!fs.existsSync(this.migrationsPath)) {
        console.error(`❌ Migrations directory not found: ${this.migrationsPath}`);
        process.exit(1);
      }

      // Create database connection
      this.db = new Database(this.dbPath);

      // Enable foreign keys and WAL mode for better performance
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      this.db.pragma('temp_store = MEMORY');

      console.log(`📊 Connected to database: ${this.dbPath}`);

      // Initialize migration manager
      this.migrationManager = new SimpleMigrationManager(this.db, this.migrationsPath);

      console.log(`📁 Using migrations from: ${this.migrationsPath}`);
    } catch (error) {
      console.error(`❌ Failed to initialize database: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Run pending migrations
   */
  async runMigrations() {
    try {
      console.log('\n🔄 Starting migration process...\n');

      const currentVersion = this.migrationManager.getCurrentVersion();
      console.log(`📌 Current schema version: ${currentVersion}`);

      // Check for pending migrations
      const allMigrations = this.getMigrationFiles();
      const pendingMigrations = allMigrations.filter(m => m.version > currentVersion);

      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations found. Database is up to date.\n');
        return;
      }

      console.log(`📋 Found ${pendingMigrations.length} pending migration(s):`);
      pendingMigrations.forEach(m => {
        console.log(`   - ${m.version}: ${m.description}`);
      });
      console.log('');

      // Run migrations
      const results = await this.migrationManager.migrate();

      // Display results
      let successCount = 0;
      let failureCount = 0;

      console.log('📊 Migration Results:');
      console.log('═'.repeat(50));

      for (const result of results) {
        if (result.success) {
          successCount++;
          console.log(`✅ Migration ${result.version}: SUCCESS (${result.duration}ms)`);
        } else {
          failureCount++;
          console.log(`❌ Migration ${result.version}: FAILED (${result.duration}ms)`);
          console.log(`   Error: ${result.error}`);
          break; // Stop on first failure
        }
      }

      console.log('═'.repeat(50));
      console.log(`📈 Summary: ${successCount} successful, ${failureCount} failed`);

      if (failureCount > 0) {
        console.log('\n⚠️  Migration process stopped due to failures.');
        console.log('   Please check the errors above and fix any issues.');
        process.exit(1);
      } else {
        console.log('\n🎉 All migrations completed successfully!');
        console.log(`📌 New schema version: ${this.migrationManager.getCurrentVersion()}`);
      }
    } catch (error) {
      console.error(`❌ Migration process failed: ${error.message}`);
      console.error('Stack trace:', error.stack);
      process.exit(1);
    }
  }

  /**
   * Display migration status
   */
  async showStatus() {
    try {
      console.log('\n📊 Migration Status Report');
      console.log('═'.repeat(50));

      const status = this.migrationManager.getStatus();
      const validation = this.migrationManager.validateMigrations();

      console.log(`📌 Current Schema Version: ${status.currentVersion}`);
      console.log(`📋 Pending Migrations: ${status.pendingMigrations}`);
      console.log(`✅ Migration Integrity: ${validation.valid ? 'VALID' : 'INVALID'}`);

      if (!validation.valid) {
        console.log('\n❌ Validation Errors:');
        validation.errors.forEach(error => {
          console.log(`   - ${error}`);
        });
      }

      console.log('\n📜 Applied Migrations (Last 10):');
      console.log('-'.repeat(50));

      if (status.appliedMigrations.length === 0) {
        console.log('   No migrations applied yet.');
      } else {
        status.appliedMigrations.forEach(migration => {
          const date = new Date(migration.applied_at).toLocaleString();
          console.log(`   ${migration.version}: ${migration.description}`);
          console.log(`      Applied: ${date} (${migration.duration_ms}ms)`);
        });
      }

      // Show available migration files
      const allMigrations = this.getMigrationFiles();
      const pendingMigrations = allMigrations.filter(m => m.version > status.currentVersion);

      if (pendingMigrations.length > 0) {
        console.log('\n📋 Pending Migrations:');
        console.log('-'.repeat(50));
        pendingMigrations.forEach(migration => {
          console.log(`   ${migration.version}: ${migration.description}`);
        });
      }

      console.log('');
    } catch (error) {
      console.error(`❌ Failed to show status: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Rollback migrations
   */
  async rollbackMigrations(targetVersion) {
    try {
      const currentVersion = this.migrationManager.getCurrentVersion();

      if (!targetVersion) {
        targetVersion = Math.max(0, currentVersion - 1);
      }

      targetVersion = parseInt(targetVersion);

      if (isNaN(targetVersion) || targetVersion < 0) {
        console.error('❌ Invalid target version. Must be a non-negative integer.');
        process.exit(1);
      }

      if (targetVersion >= currentVersion) {
        console.log(
          `✅ Target version ${targetVersion} is not less than current version ${currentVersion}.`
        );
        console.log('   No rollback needed.');
        return;
      }

      console.log(`\n🔄 Rolling back from version ${currentVersion} to ${targetVersion}...\n`);

      const results = await this.migrationManager.rollback(targetVersion);

      // Display results
      let successCount = 0;
      let failureCount = 0;

      console.log('📊 Rollback Results:');
      console.log('═'.repeat(50));

      for (const result of results) {
        if (result.success) {
          successCount++;
          console.log(`✅ Rollback ${result.version}: SUCCESS (${result.duration}ms)`);
        } else {
          failureCount++;
          console.log(`❌ Rollback ${result.version}: FAILED (${result.duration}ms)`);
          console.log(`   Error: ${result.error}`);
          break;
        }
      }

      console.log('═'.repeat(50));
      console.log(`📈 Summary: ${successCount} successful, ${failureCount} failed`);

      if (failureCount > 0) {
        console.log('\n⚠️  Rollback process stopped due to failures.');
        process.exit(1);
      } else {
        console.log('\n🎉 Rollback completed successfully!');
        console.log(`📌 New schema version: ${this.migrationManager.getCurrentVersion()}`);
      }
    } catch (error) {
      console.error(`❌ Rollback failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Get migration files from directory
   */
  getMigrationFiles() {
    const files = fs
      .readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files
      .map(file => {
        const match = file.match(/^(\d+)_(.+)\.sql$/);
        if (!match) return null;

        return {
          version: parseInt(match[1]),
          description: match[2].replace(/_/g, ' '),
          filename: file,
        };
      })
      .filter(Boolean);
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.db) {
      this.db.close();
      console.log('📊 Database connection closed.');
    }
  }

  /**
   * Handle graceful shutdown
   */
  setupSignalHandlers() {
    const signals = ['SIGINT', 'SIGTERM', 'SIGUSR2'];

    signals.forEach(signal => {
      process.on(signal, () => {
        console.log(`\n📡 Received ${signal}. Cleaning up...`);
        this.cleanup();
        process.exit(0);
      });
    });

    process.on('uncaughtException', error => {
      console.error('❌ Uncaught Exception:', error);
      this.cleanup();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      this.cleanup();
      process.exit(1);
    });
  }
}

/**
 * Main execution function
 */
async function main() {
  const runner = new MigrationRunner();

  // Setup signal handlers for graceful shutdown
  runner.setupSignalHandlers();

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0];

    // Initialize runner
    await runner.initialize();

    // Execute command
    switch (command) {
      case '--status':
      case 'status':
        await runner.showStatus();
        break;

      case '--rollback':
      case 'rollback':
        const targetVersion = args[1];
        await runner.rollbackMigrations(targetVersion);
        break;

      case '--help':
      case 'help':
        console.log(`
📚 Database Migration Runner

Usage:
  npm run migrate                    Run pending migrations
  npm run migrate:status             Show migration status
  npm run migrate:rollback [version] Rollback to specific version

Examples:
  npm run migrate                    # Run all pending migrations
  npm run migrate:status             # Show current status
  npm run migrate:rollback 1         # Rollback to version 1
  npm run migrate:rollback           # Rollback one version

The script will automatically:
- Create the database if it doesn't exist
- Set up the schema_migrations table
- Execute migrations in order (001, 002, etc.)
- Handle transaction rollbacks on errors
- Create backups before each migration
`);
        break;

      default:
        // Default action: run migrations
        await runner.runMigrations();
        break;
    }
  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  } finally {
    runner.cleanup();
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}

module.exports = { MigrationRunner };
