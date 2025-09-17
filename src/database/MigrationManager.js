"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationGenerator = exports.MigrationManager = void 0;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
const crypto_1 = tslib_1.__importDefault(require("crypto"));
class MigrationManager {
    db;
    migrationsPath;
    constructor(db, migrationsPath = './migrations') {
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
    }
    getCurrentVersion() {
        const result = this.db.prepare(`
      SELECT COALESCE(MAX(version), 0) as version 
      FROM schema_migrations
    `).get();
        return result.version;
    }
    loadMigrations() {
        const migrations = [];
        if (!fs_1.default.existsSync(this.migrationsPath)) {
            fs_1.default.mkdirSync(this.migrationsPath, { recursive: true });
            return migrations;
        }
        const files = fs_1.default.readdirSync(this.migrationsPath)
            .filter(file => file.endsWith('.sql'))
            .sort();
        for (const file of files) {
            const match = file.match(/^(\d+)_(.+)\.sql$/);
            if (!match)
                continue;
            const version = parseInt(match[1]);
            const description = match[2].replace(/_/g, ' ');
            const filePath = path_1.default.join(this.migrationsPath, file);
            const content = fs_1.default.readFileSync(filePath, 'utf8');
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
        const transaction = this.db.transaction(() => {
            try {
                const existing = this.db.prepare(`
          SELECT version FROM schema_migrations WHERE version = ?
        `).get(migration.version);
                if (existing) {
                    throw new Error(`Migration ${migration.version} already applied`);
                }
                this.createMigrationBackup(migration.version);
                this.db.exec(migration.up);
                this.db.prepare(`
          INSERT INTO schema_migrations (version, description, rollback_sql, checksum, duration_ms)
          VALUES (?, ?, ?, ?, ?)
        `).run(migration.version, migration.description, migration.down, migration.checksum, Date.now() - startTime);
                console.log(`✅ Migration ${migration.version}: ${migration.description}`);
            }
            catch (error) {
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
        }
        catch (error) {
            return {
                success: false,
                version: migration.version,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }
    async rollback(targetVersion) {
        const currentVersion = this.getCurrentVersion();
        if (targetVersion >= currentVersion) {
            throw new Error(`Target version ${targetVersion} is not less than current version ${currentVersion}`);
        }
        const migrations = this.db.prepare(`
      SELECT version, description, rollback_sql
      FROM schema_migrations
      WHERE version > ?
      ORDER BY version DESC
    `).all(targetVersion);
        const results = [];
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
    async rollbackMigration(migration) {
        const startTime = Date.now();
        const transaction = this.db.transaction(() => {
            try {
                if (!migration.rollback_sql) {
                    throw new Error(`No rollback SQL for migration ${migration.version}`);
                }
                this.db.exec(migration.rollback_sql);
                this.db.prepare(`
          DELETE FROM schema_migrations WHERE version = ?
        `).run(migration.version);
                console.log(`🔄 Rolled back migration ${migration.version}: ${migration.description}`);
            }
            catch (error) {
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
        }
        catch (error) {
            return {
                success: false,
                version: migration.version,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }
    createMigrationBackup(version) {
        const backupPath = path_1.default.join(path_1.default.dirname(this.db.name), `backup_pre_migration_${version}_${Date.now()}.db`);
        this.db.backup(backupPath);
        this.db.prepare(`
      INSERT INTO backup_log (backup_path, backup_type, entries_count, created_at)
      VALUES (?, 'migration', (SELECT COUNT(*) FROM kb_entries), CURRENT_TIMESTAMP)
    `).run(backupPath);
    }
    generateSchemaDiff(fromVersion, toVersion) {
        const migrations = this.db.prepare(`
      SELECT version, description, rollback_sql as sql
      FROM schema_migrations
      WHERE version > ? AND version <= ?
      ORDER BY version
    `).all(fromVersion, toVersion);
        let diff = `Schema changes from version ${fromVersion} to ${toVersion}:\n\n`;
        for (const migration of migrations) {
            diff += `Version ${migration.version}: ${migration.description}\n`;
            diff += `${'='.repeat(50)}\n`;
            diff += migration.sql + '\n\n';
        }
        return diff;
    }
    validateMigrations() {
        const errors = [];
        const appliedMigrations = this.db.prepare(`
      SELECT version, checksum FROM schema_migrations ORDER BY version
    `).all();
        const fileMigrations = this.loadMigrations();
        for (let i = 1; i < appliedMigrations.length; i++) {
            const prev = appliedMigrations[i - 1];
            const curr = appliedMigrations[i];
            if (curr.version !== prev.version + 1) {
                errors.push(`Migration gap: ${prev.version} -> ${curr.version}`);
            }
        }
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
    calculateChecksum(content) {
        return crypto_1.default.createHash('sha256').update(content).digest('hex');
    }
    getStatus() {
        const currentVersion = this.getCurrentVersion();
        const pendingCount = this.loadMigrations()
            .filter(m => m.version > currentVersion).length;
        const applied = this.db.prepare(`
      SELECT version, description, applied_at, duration_ms
      FROM schema_migrations
      ORDER BY version DESC
      LIMIT 10
    `).all();
        return {
            currentVersion,
            pendingMigrations: pendingCount,
            appliedMigrations: applied
        };
    }
}
exports.MigrationManager = MigrationManager;
class MigrationGenerator {
    static generate(description, migrationsPath) {
        const version = Date.now();
        const filename = `${version}_${description.toLowerCase().replace(/\s+/g, '_')}.sql`;
        const filepath = path_1.default.join(migrationsPath, filename);
        const template = `-- UP
-- Migration: ${description}
-- Version: ${version}
-- Generated: ${new Date().toISOString()}

-- Add your schema changes here


-- DOWN
-- Rollback for: ${description}

-- Add rollback SQL here

`;
        fs_1.default.writeFileSync(filepath, template);
        return filepath;
    }
}
exports.MigrationGenerator = MigrationGenerator;
//# sourceMappingURL=MigrationManager.js.map