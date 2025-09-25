import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager, DatabaseConfig } from '../../DatabaseManager';
import { KnowledgeDB, KBEntry } from '../../KnowledgeDB';

/**
 * Factory for creating test databases with various configurations
 */
export class TestDatabaseFactory {
  private static createdDatabases: string[] = [];
  private static createdManagers: DatabaseManager[] = [];

  /**
   * Create an in-memory database for unit tests
   */
  static createMemoryDatabase(): Database.Database {
    return new Database(':memory:');
  }

  /**
   * Create a temporary file-based database for integration tests
   */
  static createTempDatabase(name?: string): Database.Database {
    const dbName = name || `test-${uuidv4()}.db`;
    const dbPath = path.join(__dirname, '..', 'temp', dbName);

    this.createdDatabases.push(dbPath);
    return new Database(dbPath);
  }

  /**
   * Create a DatabaseManager instance with test configuration
   */
  static async createTestDatabaseManager(
    config: Partial<DatabaseConfig> = {}
  ): Promise<DatabaseManager> {
    const testConfig: DatabaseConfig = {
      path: config.path || ':memory:',
      enableWAL: false, // Disable WAL for testing
      enableForeignKeys: true,
      timeout: 5000,
      maxConnections: 5,
      cacheSize: 50,
      enableMonitoring: false,
      backup: {
        enabled: false,
        intervalHours: 24,
        retentionDays: 7,
        path: path.join(__dirname, '..', 'backups'),
      },
      queryCache: {
        enabled: true,
        maxSize: 100,
        ttlMs: 60000,
      },
      ...config,
    };

    const manager = new DatabaseManager(testConfig);
    await manager.initialize();

    this.createdManagers.push(manager);
    return manager;
  }

  /**
   * Create a KnowledgeDB instance for testing
   */
  static createTestKnowledgeDB(dbPath?: string): KnowledgeDB {
    return new KnowledgeDB(dbPath || ':memory:');
  }

  /**
   * Create test data for knowledge base
   */
  static createTestKBEntries(): KBEntry[] {
    return [
      {
        id: uuidv4(),
        title: 'VSAM Status 35 Error',
        problem: 'Job fails with VSAM status code 35',
        solution: 'Check if file exists and verify catalog entries',
        category: 'VSAM',
        tags: ['vsam', 'status-35', 'file-error'],
        created_at: new Date(),
        usage_count: 5,
        success_count: 4,
        failure_count: 1,
      },
      {
        id: uuidv4(),
        title: 'S0C7 Data Exception',
        problem: 'Program abends with S0C7 data exception',
        solution: 'Check for invalid numeric data in COMP-3 fields',
        category: 'Batch',
        tags: ['s0c7', 'abend', 'numeric'],
        created_at: new Date(),
        usage_count: 12,
        success_count: 10,
        failure_count: 2,
      },
      {
        id: uuidv4(),
        title: 'JCL Dataset Not Found',
        problem: 'IEF212I dataset not found error in JCL',
        solution: 'Verify dataset name and ensure it exists or is cataloged',
        category: 'JCL',
        tags: ['jcl', 'dataset', 'ief212i'],
        created_at: new Date(),
        usage_count: 8,
        success_count: 7,
        failure_count: 1,
      },
      {
        id: uuidv4(),
        title: 'DB2 SQLCODE -904',
        problem: 'DB2 resource unavailable error',
        solution: 'Check tablespace status and run COPY if needed',
        category: 'DB2',
        tags: ['db2', 'sqlcode', 'resource'],
        created_at: new Date(),
        usage_count: 3,
        success_count: 2,
        failure_count: 1,
      },
      {
        id: uuidv4(),
        title: 'COBOL Compile Error',
        problem: 'COBOL program fails to compile with syntax error',
        solution: 'Check for missing periods and proper indentation',
        category: 'Functional',
        tags: ['cobol', 'compile', 'syntax'],
        created_at: new Date(),
        usage_count: 15,
        success_count: 14,
        failure_count: 1,
      },
    ];
  }

  /**
   * Seed a knowledge database with test data
   */
  static async seedKnowledgeDB(kb: KnowledgeDB, entries?: KBEntry[]): Promise<void> {
    const testEntries = entries || this.createTestKBEntries();

    for (const entry of testEntries) {
      await kb.addEntry(entry, 'test-user');
    }
  }

  /**
   * Create large dataset for performance testing
   */
  static createLargeTestDataset(size: number): KBEntry[] {
    const entries: KBEntry[] = [];
    const categories = ['VSAM', 'JCL', 'DB2', 'Batch', 'Functional'];
    const problems = [
      'System abend with error code',
      'Dataset allocation failure',
      'SQL query performance issue',
      'File processing error',
      'Memory allocation problem',
    ];

    for (let i = 0; i < size; i++) {
      entries.push({
        id: uuidv4(),
        title: `Test Entry ${i + 1}`,
        problem: `${problems[i % problems.length]} ${i + 1}`,
        solution: `Solution for problem ${i + 1}. This is a detailed solution.`,
        category: categories[i % categories.length],
        tags: [`tag${i % 10}`, `category${i % 5}`, `test${i}`],
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        usage_count: Math.floor(Math.random() * 100),
        success_count: Math.floor(Math.random() * 80),
        failure_count: Math.floor(Math.random() * 20),
      });
    }

    return entries;
  }

  /**
   * Create corrupted data for error testing
   */
  static createCorruptedData(): any[] {
    return [
      { id: null, title: 'Invalid Entry' }, // Missing required fields
      { title: '', problem: '', solution: '' }, // Empty strings
      { title: 'A'.repeat(1000), problem: 'B'.repeat(10000) }, // Oversized fields
      { category: 'INVALID_CATEGORY' }, // Invalid category
      { created_at: 'invalid-date' }, // Invalid date
      { usage_count: -1, success_count: -5 }, // Invalid numbers
    ];
  }

  /**
   * Wait for a specified amount of time (for timing tests)
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Measure execution time of a function
   */
  static async measureExecutionTime<T>(
    fn: () => Promise<T> | T
  ): Promise<{ result: T; time: number }> {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const time = Number(end - start) / 1000000; // Convert to milliseconds

    return { result, time };
  }

  /**
   * Generate random string for testing
   */
  static randomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Create database corruption for testing recovery
   */
  static async corruptDatabase(dbPath: string): Promise<void> {
    if (dbPath === ':memory:') {
      throw new Error('Cannot corrupt in-memory database');
    }

    // Write random bytes to the middle of the file
    const buffer = Buffer.alloc(1024);
    buffer.fill(0xff);

    const fd = fs.openSync(dbPath, 'r+');
    const stats = fs.fstatSync(fd);
    const position = Math.floor(stats.size / 2);

    fs.writeSync(fd, buffer, 0, buffer.length, position);
    fs.closeSync(fd);
  }

  /**
   * Cleanup all created test databases and managers
   */
  static async cleanup(): Promise<void> {
    // Close all database managers
    for (const manager of this.createdManagers) {
      try {
        await manager.shutdown();
      } catch (error) {
        console.warn('Error shutting down test database manager:', error);
      }
    }
    this.createdManagers.length = 0;

    // Remove temporary database files
    for (const dbPath of this.createdDatabases) {
      try {
        if (fs.existsSync(dbPath)) {
          fs.unlinkSync(dbPath);
        }
      } catch (error) {
        console.warn('Error cleaning up test database:', error);
      }
    }
    this.createdDatabases.length = 0;
  }
}
