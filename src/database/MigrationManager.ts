import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface Migration {
  version: number;
  description: string;
  up: string;
  down: string;
  checksum?: string;
}

export interface MigrationResult {
  success: boolean;
  version: number;
  error?: string;
  duration: number;
}

export class MigrationManager {
  private db: Database.Database;
  private migrationsPath: string;

  constructor(db: Database.Database, migrationsPath: string = './migrations') {
    this.db = db;
    this.migrationsPath = migrationsPath;
    this.ensureMigrationsTable();
  }

  private ensureMigrationsTable(): void {
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
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(): number {
    const result = this.db.prepare(`
      SELECT COALESCE(MAX(version), 0) as version 
      FROM schema_migrations
    `).get() as { version: number };
    
    return result.version;
  }

  /**
   * Load migration files from disk
   */
  private loadMigrations(): Migration[] {
    const migrations: Migration[] = [];
    
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true });
      return migrations;
    }

    const files = fs.readdirSync(this.migrationsPath)
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
        checksum: this.calculateChecksum(up + down)
      });
    }

    return migrations;
  }

  /**
   * Apply pending migrations
   */
  async migrate(): Promise<MigrationResult[]> {
    const currentVersion = this.getCurrentVersion();
    const migrations = this.loadMigrations()
      .filter(m => m.version > currentVersion)
      .sort((a, b) => a.version - b.version);

    const results: MigrationResult[] = [];

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

  /**
   * Apply a single migration
   */
  private async applyMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();
    
    const transaction = this.db.transaction(() => {
      try {
        // Verify migration hasn't been applied
        const existing = this.db.prepare(`
          SELECT version FROM schema_migrations WHERE version = ?
        `).get(migration.version);
        
        if (existing) {
          throw new Error(`Migration ${migration.version} already applied`);
        }

        // Create backup point
        this.createMigrationBackup(migration.version);

        // Execute migration SQL
        this.db.exec(migration.up);

        // Record migration
        this.db.prepare(`
          INSERT INTO schema_migrations (version, description, rollback_sql, checksum, duration_ms)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          migration.version,
          migration.description,
          migration.down,
          migration.checksum,
          Date.now() - startTime
        );

        console.log(`✅ Migration ${migration.version}: ${migration.description}`);
        
      } catch (error) {
        console.error(`❌ Migration ${migration.version} failed:`, error);
        throw error;
      }
    });

    try {
      transaction();
      return {
        success: true,
        version: migration.version,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        version: migration.version,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Rollback to specific version
   */
  async rollback(targetVersion: number): Promise<MigrationResult[]> {
    const currentVersion = this.getCurrentVersion();
    
    if (targetVersion >= currentVersion) {
      throw new Error(`Target version ${targetVersion} is not less than current version ${currentVersion}`);
    }

    const migrations = this.db.prepare(`
      SELECT version, description, rollback_sql
      FROM schema_migrations
      WHERE version > ?
      ORDER BY version DESC
    `).all(targetVersion) as Array<{
      version: number;
      description: string;
      rollback_sql: string;
    }>;

    const results: MigrationResult[] = [];

    for (const migration of migrations) {
      const result = await this.rollbackMigration(migration);
      results.push(result);
      
      if (!result.success) {
        console.error(`Rollback ${migration.version} failed: ${result.error}`);
        break;
      }
    }

    return results;
  }

  /**
   * Rollback a single migration
   */
  private async rollbackMigration(migration: {
    version: number;
    description: string;
    rollback_sql: string;
  }): Promise<MigrationResult> {
    const startTime = Date.now();
    
    const transaction = this.db.transaction(() => {
      try {
        if (!migration.rollback_sql) {
          throw new Error(`No rollback SQL for migration ${migration.version}`);
        }

        // Execute rollback SQL
        this.db.exec(migration.rollback_sql);

        // Remove migration record
        this.db.prepare(`
          DELETE FROM schema_migrations WHERE version = ?
        `).run(migration.version);

        console.log(`🔄 Rolled back migration ${migration.version}: ${migration.description}`);
        
      } catch (error) {
        console.error(`❌ Rollback ${migration.version} failed:`, error);
        throw error;
      }
    });

    try {
      transaction();
      return {
        success: true,
        version: migration.version,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        version: migration.version,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Create backup before migration
   */
  private createMigrationBackup(version: number): void {
    const backupPath = path.join(
      path.dirname(this.db.name),
      `backup_pre_migration_${version}_${Date.now()}.db`
    );
    
    this.db.backup(backupPath);
    
    this.db.prepare(`
      INSERT INTO backup_log (backup_path, backup_type, entries_count, created_at)
      VALUES (?, 'migration', (SELECT COUNT(*) FROM kb_entries), CURRENT_TIMESTAMP)
    `).run(backupPath);
  }

  /**
   * Generate schema diff between versions
   */
  generateSchemaDiff(fromVersion: number, toVersion: number): string {
    const migrations = this.db.prepare(`
      SELECT version, description, rollback_sql as sql
      FROM schema_migrations
      WHERE version > ? AND version <= ?
      ORDER BY version
    `).all(fromVersion, toVersion) as Array<{
      version: number;
      description: string;
      sql: string;
    }>;

    let diff = `Schema changes from version ${fromVersion} to ${toVersion}:\n\n`;
    
    for (const migration of migrations) {
      diff += `Version ${migration.version}: ${migration.description}\n`;
      diff += `${'='.repeat(50)}\n`;
      diff += migration.sql + '\n\n';
    }

    return diff;
  }

  /**
   * Validate migration integrity
   */
  validateMigrations(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const appliedMigrations = this.db.prepare(`
      SELECT version, checksum FROM schema_migrations ORDER BY version
    `).all() as Array<{ version: number; checksum: string }>;

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
      errors
    };
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get migration status
   */
  getStatus(): {
    currentVersion: number;
    pendingMigrations: number;
    appliedMigrations: Array<{
      version: number;
      description: string;
      applied_at: string;
      duration_ms: number;
    }>;
  } {
    const currentVersion = this.getCurrentVersion();
    const pendingCount = this.loadMigrations()
      .filter(m => m.version > currentVersion).length;
    
    const applied = this.db.prepare(`
      SELECT version, description, applied_at, duration_ms
      FROM schema_migrations
      ORDER BY version DESC
      LIMIT 10
    `).all() as Array<{
      version: number;
      description: string;
      applied_at: string;
      duration_ms: number;
    }>;

    return {
      currentVersion,
      pendingMigrations: pendingCount,
      appliedMigrations: applied
    };
  }
}

// Migration file template generator
export class MigrationGenerator {
  static generate(description: string, migrationsPath: string): string {
    const version = Date.now();
    const filename = `${version}_${description.toLowerCase().replace(/\s+/g, '_')}.sql`;
    const filepath = path.join(migrationsPath, filename);

    const template = `-- UP
-- Migration: ${description}
-- Version: ${version}
-- Generated: ${new Date().toISOString()}

-- Add your schema changes here


-- DOWN
-- Rollback for: ${description}

-- Add rollback SQL here

`;

    fs.writeFileSync(filepath, template);
    return filepath;
  }
}