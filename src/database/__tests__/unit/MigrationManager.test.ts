import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { MigrationManager, Migration, MigrationResult } from '../../MigrationManager';
import { TestDatabaseFactory } from '../test-utils/TestDatabaseFactory';
import { PerformanceTestHelper } from '../test-utils/PerformanceTestHelper';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

describe('MigrationManager Unit Tests', () => {
  let db: Database.Database;
  let migrationManager: MigrationManager;
  let migrationsPath: string;
  let performanceHelper: PerformanceTestHelper;

  beforeAll(() => {
    performanceHelper = new PerformanceTestHelper();
    migrationsPath = path.join(__dirname, '..', 'temp', 'migrations');
    
    // Ensure migrations directory exists
    if (!fs.existsSync(migrationsPath)) {
      fs.mkdirSync(migrationsPath, { recursive: true });
    }
  });

  beforeEach(() => {
    db = TestDatabaseFactory.createMemoryDatabase();
    migrationManager = new MigrationManager(db, migrationsPath);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    // Clean up migration files
    if (fs.existsSync(migrationsPath)) {
      const files = fs.readdirSync(migrationsPath);
      files.forEach(file => {
        fs.unlinkSync(path.join(migrationsPath, file));
      });
    }
  });

  afterAll(() => {
    if (fs.existsSync(migrationsPath)) {
      fs.rmSync(migrationsPath, { recursive: true, force: true });
    }
    performanceHelper.clearResults();
  });

  describe('Initialization', () => {
    it('should create migrations table on initialization', () => {
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='schema_migrations'
      `).all();
      
      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe('schema_migrations');
    });

    it('should return version 0 for fresh database', () => {
      const version = migrationManager.getCurrentVersion();
      expect(version).toBe(0);
    });

    it('should handle migrations directory creation', () => {
      const newPath = path.join(__dirname, '..', 'temp', 'new-migrations');
      const newMigrationManager = new MigrationManager(db, newPath);
      
      // This should not throw even if directory doesn't exist
      expect(newMigrationManager.getCurrentVersion()).toBe(0);
    });
  });

  describe('Migration Discovery', () => {
    beforeEach(() => {
      // Create test migration files
      createTestMigrationFile(1, 'initial-schema', `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        );
      `, `
        DROP TABLE users;
      `);

      createTestMigrationFile(2, 'add-timestamps', `
        ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
      `, `
        ALTER TABLE users DROP COLUMN created_at;
      `);

      createTestMigrationFile(3, 'add-index', `
        CREATE INDEX idx_users_email ON users(email);
      `, `
        DROP INDEX idx_users_email;
      `);
    });

    it('should discover migration files', () => {
      const migrations = migrationManager.getMigrations();
      
      expect(migrations).toHaveLength(3);
      expect(migrations[0].version).toBe(1);
      expect(migrations[0].description).toBe('initial-schema');
      expect(migrations[1].version).toBe(2);
      expect(migrations[2].version).toBe(3);
    });

    it('should sort migrations by version', () => {
      // Create migrations in wrong order
      createTestMigrationFile(5, 'future-migration', 'SELECT 1;', 'SELECT 1;');
      createTestMigrationFile(4, 'another-migration', 'SELECT 1;', 'SELECT 1;');

      const migrations = migrationManager.getMigrations();
      
      expect(migrations).toHaveLength(5);
      expect(migrations[3].version).toBe(4);
      expect(migrations[4].version).toBe(5);
    });

    it('should handle malformed migration files', () => {
      // Create invalid migration file
      fs.writeFileSync(
        path.join(migrationsPath, '999_invalid_migration.json'),
        '{ invalid json'
      );

      expect(() => migrationManager.getMigrations()).toThrow();
    });

    it('should validate migration structure', () => {
      // Create migration with missing fields
      const invalidMigration = {
        version: 999,
        // missing description, up, down
      };

      fs.writeFileSync(
        path.join(migrationsPath, '999_invalid_structure.json'),
        JSON.stringify(invalidMigration, null, 2)
      );

      expect(() => migrationManager.getMigrations()).toThrow();
    });
  });

  describe('Migration Execution', () => {
    beforeEach(() => {
      createTestMigrationFile(1, 'create-users-table', `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `, `
        DROP TABLE users;
      `);

      createTestMigrationFile(2, 'create-posts-table', `
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          user_id INTEGER,
          title TEXT NOT NULL,
          content TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        );
      `, `
        DROP TABLE posts;
      `);
    });

    it('should run single migration successfully', async () => {
      const result = await migrationManager.runMigration(1);
      
      expect(result.success).toBe(true);
      expect(result.version).toBe(1);
      expect(result.error).toBeUndefined();
      expect(result.duration).toBeGreaterThan(0);

      // Verify table was created
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='users'
      `).all();
      expect(tables).toHaveLength(1);

      // Verify migration was recorded
      expect(migrationManager.getCurrentVersion()).toBe(1);
    });

    it('should handle migration errors gracefully', async () => {
      createTestMigrationFile(99, 'invalid-migration', `
        INVALID SQL STATEMENT;
      `, `
        SELECT 1;
      `);

      const result = await migrationManager.runMigration(99);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.version).toBe(99);

      // Database version should not change
      expect(migrationManager.getCurrentVersion()).toBe(0);
    });

    it('should measure migration performance', async () => {
      const performanceResult = await performanceHelper.measureOperation(
        'single-migration-execution',
        () => migrationManager.runMigration(1)
      );

      expect(performanceResult.success).toBe(true);
      expect(performanceResult.metrics.executionTime).toHaveExecutedWithin(1000);
    });

    it('should prevent duplicate migrations', async () => {
      // Run migration once
      await migrationManager.runMigration(1);
      
      // Try to run same migration again
      const result = await migrationManager.runMigration(1);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('already applied');
    });

    it('should maintain transaction integrity', async () => {
      createTestMigrationFile(50, 'transaction-test', `
        CREATE TABLE test1 (id INTEGER);
        CREATE TABLE test2 (id INTEGER);
        INVALID SQL STATEMENT; -- This should cause rollback
      `, `
        DROP TABLE test2;
        DROP TABLE test1;
      `);

      const result = await migrationManager.runMigration(50);
      
      expect(result.success).toBe(false);

      // Neither table should exist due to rollback
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('test1', 'test2')
      `).all();
      expect(tables).toHaveLength(0);
    });
  });

  describe('Batch Migration', () => {
    beforeEach(() => {
      for (let i = 1; i <= 5; i++) {
        createTestMigrationFile(i, `migration-${i}`, `
          CREATE TABLE table_${i} (
            id INTEGER PRIMARY KEY,
            name TEXT DEFAULT 'table_${i}'
          );
        `, `
          DROP TABLE table_${i};
        `);
      }
    });

    it('should run all pending migrations', async () => {
      const results = await migrationManager.runPendingMigrations();
      
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.version).toBe(index + 1);
      });

      expect(migrationManager.getCurrentVersion()).toBe(5);

      // Verify all tables were created
      for (let i = 1; i <= 5; i++) {
        const tables = db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name='table_${i}'
        `).all();
        expect(tables).toHaveLength(1);
      }
    });

    it('should stop on first migration error', async () => {
      // Insert an invalid migration in the middle
      createTestMigrationFile(3, 'invalid-migration', `
        INVALID SQL STATEMENT;
      `, `
        SELECT 1;
      `);

      const results = await migrationManager.runPendingMigrations();
      
      // Should run migrations 1 and 2, then fail on 3
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(false);

      expect(migrationManager.getCurrentVersion()).toBe(2);
    });

    it('should run migrations to specific version', async () => {
      const results = await migrationManager.runMigrationsToVersion(3);
      
      expect(results).toHaveLength(3);
      expect(migrationManager.getCurrentVersion()).toBe(3);

      // Verify only first 3 tables exist
      for (let i = 1; i <= 3; i++) {
        const tables = db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name='table_${i}'
        `).all();
        expect(tables).toHaveLength(1);
      }

      // Tables 4 and 5 should not exist
      for (let i = 4; i <= 5; i++) {
        const tables = db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name='table_${i}'
        `).all();
        expect(tables).toHaveLength(0);
      }
    });

    it('should measure batch migration performance', async () => {
      const result = await performanceHelper.measureOperation(
        'batch-migration-execution',
        () => migrationManager.runPendingMigrations()
      );

      expect(result.success).toBe(true);
      expect(result.metrics.executionTime).toHaveExecutedWithin(5000);
    });
  });

  describe('Migration Rollback', () => {
    beforeEach(async () => {
      createTestMigrationFile(1, 'create-users', `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
        INSERT INTO users (name) VALUES ('test_user');
      `, `
        DROP TABLE users;
      `);

      createTestMigrationFile(2, 'add-email-column', `
        ALTER TABLE users ADD COLUMN email TEXT;
        UPDATE users SET email = 'test@example.com' WHERE id = 1;
      `, `
        -- Note: SQLite doesn't support DROP COLUMN, so we recreate table
        CREATE TABLE users_temp AS SELECT id, name FROM users;
        DROP TABLE users;
        ALTER TABLE users_temp RENAME TO users;
      `);

      // Run migrations to set up state
      await migrationManager.runPendingMigrations();
    });

    it('should rollback single migration', async () => {
      expect(migrationManager.getCurrentVersion()).toBe(2);

      const result = await migrationManager.rollbackMigration(2);
      
      expect(result.success).toBe(true);
      expect(result.version).toBe(2);
      expect(migrationManager.getCurrentVersion()).toBe(1);

      // Verify email column is removed
      const columns = db.prepare("PRAGMA table_info(users)").all();
      const emailColumn = columns.find((col: any) => col.name === 'email');
      expect(emailColumn).toBeUndefined();
    });

    it('should rollback to specific version', async () => {
      createTestMigrationFile(3, 'add-another-column', `
        ALTER TABLE users ADD COLUMN age INTEGER DEFAULT 0;
      `, `
        CREATE TABLE users_temp AS SELECT id, name, email FROM users;
        DROP TABLE users;
        ALTER TABLE users_temp RENAME TO users;
      `);

      await migrationManager.runMigration(3);
      expect(migrationManager.getCurrentVersion()).toBe(3);

      const results = await migrationManager.rollbackToVersion(1);
      
      expect(results).toHaveLength(2); // Rollback migrations 3 and 2
      expect(migrationManager.getCurrentVersion()).toBe(1);
    });

    it('should handle rollback errors', async () => {
      createTestMigrationFile(10, 'problematic-rollback', `
        CREATE TABLE temp_table (id INTEGER);
      `, `
        INVALID SQL FOR ROLLBACK;
      `);

      await migrationManager.runMigration(10);
      
      const result = await migrationManager.rollbackMigration(10);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Version should remain unchanged due to rollback failure
      expect(migrationManager.getCurrentVersion()).toBe(10);
    });

    it('should prevent rollback of non-existent migrations', async () => {
      const result = await migrationManager.rollbackMigration(999);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Migration Status and History', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 3; i++) {
        createTestMigrationFile(i, `migration-${i}`, `
          CREATE TABLE table_${i} (id INTEGER);
        `, `
          DROP TABLE table_${i};
        `);
      }
      await migrationManager.runPendingMigrations();
    });

    it('should return migration history', () => {
      const history = migrationManager.getMigrationHistory();
      
      expect(history).toHaveLength(3);
      
      history.forEach((record, index) => {
        expect(record.version).toBe(index + 1);
        expect(record.description).toBe(`migration-${index + 1}`);
        expect(record.applied_at).toBeDefined();
        expect(record.duration_ms).toBeGreaterThan(0);
      });
    });

    it('should return pending migrations', () => {
      // Add more migrations without running them
      for (let i = 4; i <= 6; i++) {
        createTestMigrationFile(i, `pending-migration-${i}`, `
          CREATE TABLE pending_table_${i} (id INTEGER);
        `, `
          DROP TABLE pending_table_${i};
        `);
      }

      const pending = migrationManager.getPendingMigrations();
      
      expect(pending).toHaveLength(3);
      expect(pending[0].version).toBe(4);
      expect(pending[1].version).toBe(5);
      expect(pending[2].version).toBe(6);
    });

    it('should validate migration checksums', async () => {
      // Modify a migration file after it's been applied
      const migration1Path = path.join(migrationsPath, '001_migration-1.json');
      const migration = JSON.parse(fs.readFileSync(migration1Path, 'utf8'));
      migration.up = 'CREATE TABLE modified_table (id INTEGER);';
      fs.writeFileSync(migration1Path, JSON.stringify(migration, null, 2));

      const validation = migrationManager.validateMigrationIntegrity();
      
      expect(validation.valid).toBe(false);
      expect(validation.issues).toHaveLength(1);
      expect(validation.issues[0]).toContain('checksum mismatch');
    });

    it('should detect orphaned migration records', () => {
      // Manually insert a migration record without file
      db.prepare(`
        INSERT INTO schema_migrations (version, description, rollback_sql, checksum, duration_ms)
        VALUES (999, 'orphaned-migration', 'SELECT 1;', 'fake-checksum', 100)
      `).run();

      const validation = migrationManager.validateMigrationIntegrity();
      
      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('orphaned'))).toBe(true);
    });
  });

  describe('Performance and Concurrency', () => {
    beforeEach(() => {
      // Create multiple migrations for testing
      for (let i = 1; i <= 10; i++) {
        createTestMigrationFile(i, `perf-migration-${i}`, `
          CREATE TABLE perf_table_${i} (
            id INTEGER PRIMARY KEY,
            data TEXT DEFAULT '${TestDatabaseFactory.randomString(100)}'
          );
          INSERT INTO perf_table_${i} (data) VALUES ('test_data_${i}');
        `, `
          DROP TABLE perf_table_${i};
        `);
      }
    });

    it('should handle large migrations efficiently', async () => {
      // Create a migration with large data operations
      createTestMigrationFile(100, 'large-migration', `
        CREATE TABLE large_table (
          id INTEGER PRIMARY KEY,
          data TEXT
        );
        ${Array(1000).fill(0).map((_, i) => 
          `INSERT INTO large_table (data) VALUES ('large_data_${i}');`
        ).join('\n')}
      `, `
        DROP TABLE large_table;
      `);

      const result = await performanceHelper.measureOperation(
        'large-migration-execution',
        () => migrationManager.runMigration(100)
      );

      expect(result.success).toBe(true);
      expect(result.metrics.executionTime).toHaveExecutedWithin(10000); // 10 seconds max
    });

    it('should scale with number of migrations', async () => {
      const result = await performanceHelper.measureOperation(
        'multiple-migrations-execution',
        () => migrationManager.runPendingMigrations()
      );

      expect(result.success).toBe(true);
      // Should complete 10 migrations within reasonable time
      expect(result.metrics.executionTime).toHaveExecutedWithin(5000);
    });

    it('should handle migration file I/O efficiently', async () => {
      const result = await performanceHelper.measureOperation(
        'migration-discovery',
        () => migrationManager.getMigrations(),
        100 // Run 100 times to test I/O performance
      );

      expect(result.success).toBe(true);
      expect(result.metrics.operationsPerSecond).toBeGreaterThan(50);
    });
  });

  // Helper function to create test migration files
  function createTestMigrationFile(
    version: number,
    description: string,
    upSql: string,
    downSql: string
  ): void {
    const migration: Migration = {
      version,
      description,
      up: upSql.trim(),
      down: downSql.trim()
    };

    const filename = `${version.toString().padStart(3, '0')}_${description}.json`;
    const filepath = path.join(migrationsPath, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(migration, null, 2));
  }
});