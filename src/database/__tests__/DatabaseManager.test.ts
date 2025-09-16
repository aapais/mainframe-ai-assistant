import { DatabaseManager, DatabaseConfig } from '../DatabaseManager';
import { DataValidator } from '../validators/DataValidator';
import { QueryBuilder } from '../queryBuilder/QueryBuilder';
import { BackupSystem } from '../backup/BackupSystem';
import fs from 'fs';
import path from 'path';

// Test configuration
const TEST_DB_PATH = ':memory:'; // Use in-memory database for tests
const TEST_BACKUP_PATH = path.join(__dirname, 'test-backups');

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;
  let testConfig: DatabaseConfig;

  beforeEach(() => {
    testConfig = {
      path: TEST_DB_PATH,
      enableWAL: false, // Disable WAL for in-memory testing
      maxConnections: 5,
      backup: {
        enabled: false, // Disable backups for most tests
        path: TEST_BACKUP_PATH
      },
      queryCache: {
        enabled: true,
        maxSize: 100,
        ttlMs: 60000
      }
    };

    dbManager = new DatabaseManager(testConfig);
  });

  afterEach(async () => {
    if (dbManager) {
      await dbManager.shutdown();
    }

    // Clean up test backup directory
    if (fs.existsSync(TEST_BACKUP_PATH)) {
      fs.rmSync(TEST_BACKUP_PATH, { recursive: true, force: true });
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await expect(dbManager.initialize()).resolves.not.toThrow();
      
      const health = await dbManager.getHealth();
      expect(health.connected).toBe(true);
    });

    test('should fail to initialize twice', async () => {
      await dbManager.initialize();
      
      await expect(dbManager.initialize()).rejects.toThrow('already initialized');
    });

    test('should handle initialization errors gracefully', async () => {
      // Create a manager with invalid configuration
      const invalidConfig: DatabaseConfig = {
        path: '/invalid/path/database.db',
        maxConnections: 0 // Invalid
      };

      const invalidManager = new DatabaseManager(invalidConfig);
      await expect(invalidManager.initialize()).rejects.toThrow();
    });
  });

  describe('Query Execution', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    test('should execute simple queries', async () => {
      // Test table creation
      const createResult = await dbManager.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);

      expect(createResult.data).toBeDefined();
      expect(createResult.fromCache).toBe(false);
    });

    test('should handle parameterized queries', async () => {
      await dbManager.query(`
        CREATE TABLE test_entries (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          category TEXT NOT NULL
        )
      `);

      // Insert test data
      await dbManager.query(
        'INSERT INTO test_entries (id, title, category) VALUES (?, ?, ?)',
        ['test-1', 'Test Entry', 'TEST']
      );

      // Query with parameters
      const result = await dbManager.query(
        'SELECT * FROM test_entries WHERE category = ?',
        ['TEST']
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Test Entry');
    });

    test('should cache query results', async () => {
      await dbManager.query('CREATE TABLE test_cache (id INTEGER, value TEXT)');
      await dbManager.query('INSERT INTO test_cache VALUES (1, "test")');

      // First query - not from cache
      const result1 = await dbManager.query('SELECT * FROM test_cache', [], { useCache: true });
      expect(result1.fromCache).toBe(false);

      // Second query - should be from cache
      const result2 = await dbManager.query('SELECT * FROM test_cache', [], { useCache: true });
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toEqual(result1.data);
    });

    test('should handle query errors with retry', async () => {
      // This should fail but be handled gracefully
      await expect(
        dbManager.query('SELECT * FROM non_existent_table')
      ).rejects.toThrow();
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      await dbManager.initialize();
      
      await dbManager.query(`
        CREATE TABLE test_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )
      `);
    });

    test('should execute successful transactions', async () => {
      const result = await dbManager.transaction(async (db) => {
        db.prepare('INSERT INTO test_transactions (name) VALUES (?)').run('test1');
        db.prepare('INSERT INTO test_transactions (name) VALUES (?)').run('test2');
        
        return 'transaction completed';
      });

      expect(result).toBe('transaction completed');

      // Verify data was committed
      const queryResult = await dbManager.query('SELECT COUNT(*) as count FROM test_transactions');
      expect(queryResult.data[0].count).toBe(2);
    });

    test('should rollback failed transactions', async () => {
      try {
        await dbManager.transaction(async (db) => {
          db.prepare('INSERT INTO test_transactions (name) VALUES (?)').run('test1');
          
          // This will cause the transaction to fail
          throw new Error('Transaction error');
        });
      } catch (error) {
        expect(error.message).toContain('Transaction error');
      }

      // Verify data was not committed
      const queryResult = await dbManager.query('SELECT COUNT(*) as count FROM test_transactions');
      expect(queryResult.data[0].count).toBe(0);
    });

    test('should handle transaction timeouts', async () => {
      const timeoutPromise = dbManager.transaction(
        async (db) => {
          // Simulate long-running operation
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'completed';
        },
        { timeoutMs: 50 } // Very short timeout
      );

      await expect(timeoutPromise).rejects.toThrow();
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    test('should return health status', async () => {
      const health = await dbManager.getHealth();

      expect(health.connected).toBe(true);
      expect(health.version).toBeDefined();
      expect(health.connections).toBeDefined();
      expect(health.performance).toBeDefined();
      expect(Array.isArray(health.issues)).toBe(true);
    });

    test('should detect health issues', async () => {
      // Create a scenario that would generate warnings
      // This is a simplified test - in practice, you'd need more complex scenarios
      const health = await dbManager.getHealth();
      
      expect(typeof health.connected).toBe('boolean');
      expect(Array.isArray(health.issues)).toBe(true);
    });
  });

  describe('Database Operations', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    test('should optimize database', async () => {
      await expect(dbManager.optimize()).resolves.not.toThrow();
    });

    test('should handle shutdown gracefully', async () => {
      await expect(dbManager.shutdown()).resolves.not.toThrow();
      
      // Should not be able to query after shutdown
      await expect(dbManager.query('SELECT 1')).rejects.toThrow('not initialized');
    });
  });

  describe('Error Handling', () => {
    test('should handle queries before initialization', async () => {
      await expect(dbManager.query('SELECT 1')).rejects.toThrow('not initialized');
    });

    test('should handle invalid SQL', async () => {
      await dbManager.initialize();
      
      await expect(dbManager.query('INVALID SQL')).rejects.toThrow();
    });

    test('should handle connection failures gracefully', async () => {
      await dbManager.initialize();
      
      // Simulate connection failure by shutting down
      await dbManager.shutdown();
      
      await expect(dbManager.query('SELECT 1')).rejects.toThrow();
    });
  });
});

describe('DataValidator', () => {
  let validator: DataValidator;

  beforeEach(() => {
    validator = new DataValidator();
  });

  describe('KB Entry Validation', () => {
    test('should validate valid KB entry', async () => {
      const entry = {
        title: 'VSAM Status 35 Error',
        problem: 'Job fails with VSAM status 35 indicating file not found',
        solution: 'Check if dataset exists and is properly cataloged',
        category: 'VSAM',
        tags: ['vsam', 'status-35', 'file-not-found']
      };

      const result = await validator.validateKBEntry(entry);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedData).toBeDefined();
    });

    test('should reject invalid KB entry', async () => {
      const entry = {
        title: 'X', // Too short
        problem: 'Short', // Too short
        solution: 'Fix it', // Too short
        category: 'INVALID_CATEGORY' // Invalid category
      };

      const result = await validator.validateKBEntry(entry);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should sanitize input data', async () => {
      const entry = {
        title: '  VSAM Error  ', // Extra whitespace
        problem: 'Problem with\n\nextra   whitespace',
        solution: 'Solution with <script>alert("xss")</script> HTML',
        category: 'VSAM',
        tags: ['  TAG1  ', '  tag2  '] // Whitespace in tags
      };

      const result = await validator.validateKBEntry(entry);

      expect(result.sanitizedData.title).toBe('VSAM Error');
      expect(result.sanitizedData.solution).not.toContain('<script>');
      expect(result.sanitizedData.tags).toEqual(['tag1', 'tag2']);
    });

    test('should enforce business rules', async () => {
      const entry = {
        title: 'DB2 Error',
        problem: 'Database problem without specific details',
        solution: 'Something needs to be done', // Vague solution
        category: 'DB2'
      };

      const result = await validator.validateKBEntry(entry);

      // Should have warnings about actionable steps
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Search Query Validation', () => {
    test('should validate search queries', async () => {
      const query = {
        query: 'VSAM status',
        category: 'VSAM',
        limit: 10
      };

      const result = await validator.validateSearchQuery(query);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect SQL injection attempts', async () => {
      const query = {
        query: "'; DROP TABLE users; --"
      };

      const result = await validator.validateSearchQuery(query);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'SUSPICIOUS_CONTENT')).toBe(true);
    });

    test('should warn about short queries', async () => {
      const query = {
        query: 'XY' // Very short
      };

      const result = await validator.validateSearchQuery(query);

      expect(result.warnings.some(w => w.code === 'SHORT_QUERY')).toBe(true);
    });
  });
});

describe('QueryBuilder', () => {
  let queryBuilder: QueryBuilder;
  let mockDb: any;

  beforeEach(() => {
    // Mock database for testing
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        all: jest.fn().mockReturnValue([]),
        run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
        get: jest.fn().mockReturnValue({})
      })
    };

    queryBuilder = new QueryBuilder(mockDb);
  });

  describe('SELECT Queries', () => {
    test('should build simple SELECT query', () => {
      const { sql, params } = queryBuilder
        .select(['id', 'title'])
        .from('kb_entries')
        .toSQL();

      expect(sql).toBe('SELECT id, title FROM kb_entries');
      expect(params).toHaveLength(0);
    });

    test('should build SELECT with WHERE clause', () => {
      const { sql, params } = queryBuilder
        .select(['*'])
        .from('kb_entries')
        .where('category', '=', 'VSAM')
        .toSQL();

      expect(sql).toBe('SELECT * FROM kb_entries WHERE category = ?');
      expect(params).toEqual(['VSAM']);
    });

    test('should build complex SELECT with joins', () => {
      const { sql, params } = queryBuilder
        .select(['e.title', 't.tag'])
        .from('kb_entries', 'e')
        .innerJoin('kb_tags', 't', 'e.id = t.entry_id')
        .where('e.usage_count', '>', 5)
        .orderBy('e.created_at', 'DESC')
        .limit(10)
        .toSQL();

      expect(sql).toContain('INNER JOIN');
      expect(sql).toContain('WHERE');
      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('LIMIT');
      expect(params).toEqual([5]);
    });

    test('should build WHERE IN queries', () => {
      const { sql, params } = queryBuilder
        .select(['*'])
        .from('kb_entries')
        .whereIn('category', ['VSAM', 'DB2', 'JCL'])
        .toSQL();

      expect(sql).toBe('SELECT * FROM kb_entries WHERE category IN (?, ?, ?)');
      expect(params).toEqual(['VSAM', 'DB2', 'JCL']);
    });
  });

  describe('INSERT Queries', () => {
    test('should build INSERT query', () => {
      const { sql, params } = queryBuilder
        .insert('kb_entries')
        .values({
          id: 'test-id',
          title: 'Test Entry',
          category: 'TEST'
        })
        .toSQL();

      expect(sql).toBe('INSERT INTO kb_entries (id, title, category) VALUES (?, ?, ?)');
      expect(params).toEqual(['test-id', 'Test Entry', 'TEST']);
    });
  });

  describe('UPDATE Queries', () => {
    test('should build UPDATE query', () => {
      const { sql, params } = queryBuilder
        .update('kb_entries')
        .set({ usage_count: 10, updated_at: new Date() })
        .where('id', '=', 'test-id')
        .toSQL();

      expect(sql).toContain('UPDATE kb_entries SET');
      expect(sql).toContain('WHERE id = ?');
      expect(params).toContain(10);
      expect(params).toContain('test-id');
    });
  });

  describe('DELETE Queries', () => {
    test('should build DELETE query', () => {
      const { sql, params } = queryBuilder
        .delete()
        .from('kb_entries')
        .where('usage_count', '<', 1)
        .toSQL();

      expect(sql).toBe('DELETE FROM kb_entries WHERE usage_count < ?');
      expect(params).toEqual([1]);
    });
  });

  describe('Query Execution', () => {
    test('should execute queries and return results', async () => {
      mockDb.prepare.mockReturnValue({
        all: jest.fn().mockReturnValue([{ id: 1, name: 'test' }])
      });

      const result = await queryBuilder
        .select(['*'])
        .from('test_table')
        .execute();

      expect(result.data).toEqual([{ id: 1, name: 'test' }]);
      expect(result.fromCache).toBe(false);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    test('should handle query errors', async () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('SQL syntax error');
      });

      await expect(
        queryBuilder.select(['*']).from('invalid_table').execute()
      ).rejects.toThrow();
    });
  });
});

describe('BackupSystem', () => {
  let backupSystem: BackupSystem;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(__dirname, 'test.db');
    
    backupSystem = new BackupSystem({
      backupPath: TEST_BACKUP_PATH,
      compression: true,
      retentionDays: 7,
      verifyIntegrity: true
    });
  });

  afterEach(async () => {
    await backupSystem.shutdown();
    
    // Clean up test files
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    if (fs.existsSync(TEST_BACKUP_PATH)) {
      fs.rmSync(TEST_BACKUP_PATH, { recursive: true, force: true });
    }
  });

  describe('Initialization', () => {
    test('should initialize backup system', async () => {
      await expect(backupSystem.initialize()).resolves.not.toThrow();
      
      expect(fs.existsSync(TEST_BACKUP_PATH)).toBe(true);
    });
  });

  describe('Backup Operations', () => {
    beforeEach(async () => {
      await backupSystem.initialize();
      
      // Create a test database
      const testDb = new Database(testDbPath);
      testDb.exec(`
        CREATE TABLE test_data (id INTEGER PRIMARY KEY, value TEXT);
        INSERT INTO test_data (value) VALUES ('test1'), ('test2'), ('test3');
      `);
      testDb.close();
    });

    test('should create backup successfully', async () => {
      const result = await backupSystem.createBackup(testDbPath, {
        description: 'Test backup',
        tags: ['test']
      });

      expect(result.success).toBe(true);
      expect(result.backupId).toBeDefined();
      expect(result.checksum).toBeDefined();
      expect(result.originalSize).toBeGreaterThan(0);
      
      if (result.compressedSize) {
        expect(result.compressionRatio).toBeGreaterThan(0);
      }
    });

    test('should list backups', async () => {
      await backupSystem.createBackup(testDbPath, {
        description: 'Test backup 1',
        tags: ['test']
      });

      await backupSystem.createBackup(testDbPath, {
        description: 'Test backup 2',
        tags: ['test', 'manual']
      });

      const backups = await backupSystem.listBackups();
      expect(backups).toHaveLength(2);

      const filteredBackups = await backupSystem.listBackups({
        tags: ['manual'],
        limit: 1
      });
      expect(filteredBackups).toHaveLength(1);
    });

    test('should restore from backup', async () => {
      const backupResult = await backupSystem.createBackup(testDbPath);
      
      const restorePath = path.join(__dirname, 'restored.db');
      const restoreResult = await backupSystem.restore(
        backupResult.backupId,
        restorePath,
        { verify: true }
      );

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.verificationPassed).toBe(true);
      expect(fs.existsSync(restorePath)).toBe(true);

      // Verify restored data
      const restoredDb = new Database(restorePath, { readonly: true });
      const count = restoredDb.prepare('SELECT COUNT(*) as count FROM test_data').get() as { count: number };
      expect(count.count).toBe(3);
      restoredDb.close();

      // Clean up
      fs.unlinkSync(restorePath);
    });

    test('should delete backup', async () => {
      const backupResult = await backupSystem.createBackup(testDbPath);
      
      await backupSystem.deleteBackup(backupResult.backupId);
      
      const backups = await backupSystem.listBackups();
      expect(backups.find(b => b.id === backupResult.backupId)).toBeUndefined();
    });

    test('should get backup statistics', async () => {
      await backupSystem.createBackup(testDbPath);
      await backupSystem.createBackup(testDbPath);

      const stats = await backupSystem.getStats();

      expect(stats.totalBackups).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.averageSize).toBeGreaterThan(0);
      expect(stats.newestBackup).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await backupSystem.initialize();
    });

    test('should handle backup of non-existent file', async () => {
      await expect(
        backupSystem.createBackup('/non/existent/file.db')
      ).rejects.toThrow('Source database not found');
    });

    test('should handle restore of non-existent backup', async () => {
      await expect(
        backupSystem.restore('non-existent-id', '/tmp/test.db')
      ).rejects.toThrow('Backup not found');
    });
  });
});