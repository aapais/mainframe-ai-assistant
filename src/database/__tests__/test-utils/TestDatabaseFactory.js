'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.TestDatabaseFactory = void 0;
const tslib_1 = require('tslib');
const better_sqlite3_1 = tslib_1.__importDefault(require('better-sqlite3'));
const fs_1 = tslib_1.__importDefault(require('fs'));
const path_1 = tslib_1.__importDefault(require('path'));
const uuid_1 = require('uuid');
const DatabaseManager_1 = require('../../DatabaseManager');
const KnowledgeDB_1 = require('../../KnowledgeDB');
class TestDatabaseFactory {
  static createdDatabases = [];
  static createdManagers = [];
  static createMemoryDatabase() {
    return new better_sqlite3_1.default(':memory:');
  }
  static createTempDatabase(name) {
    const dbName = name || `test-${(0, uuid_1.v4)()}.db`;
    const dbPath = path_1.default.join(__dirname, '..', 'temp', dbName);
    this.createdDatabases.push(dbPath);
    return new better_sqlite3_1.default(dbPath);
  }
  static async createTestDatabaseManager(config = {}) {
    const testConfig = {
      path: config.path || ':memory:',
      enableWAL: false,
      enableForeignKeys: true,
      timeout: 5000,
      maxConnections: 5,
      cacheSize: 50,
      enableMonitoring: false,
      backup: {
        enabled: false,
        intervalHours: 24,
        retentionDays: 7,
        path: path_1.default.join(__dirname, '..', 'backups'),
      },
      queryCache: {
        enabled: true,
        maxSize: 100,
        ttlMs: 60000,
      },
      ...config,
    };
    const manager = new DatabaseManager_1.DatabaseManager(testConfig);
    await manager.initialize();
    this.createdManagers.push(manager);
    return manager;
  }
  static createTestKnowledgeDB(dbPath) {
    return new KnowledgeDB_1.KnowledgeDB(dbPath || ':memory:');
  }
  static createTestKBEntries() {
    return [
      {
        id: (0, uuid_1.v4)(),
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
        id: (0, uuid_1.v4)(),
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
        id: (0, uuid_1.v4)(),
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
        id: (0, uuid_1.v4)(),
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
        id: (0, uuid_1.v4)(),
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
  static async seedKnowledgeDB(kb, entries) {
    const testEntries = entries || this.createTestKBEntries();
    for (const entry of testEntries) {
      await kb.addEntry(entry, 'test-user');
    }
  }
  static createLargeTestDataset(size) {
    const entries = [];
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
        id: (0, uuid_1.v4)(),
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
  static createCorruptedData() {
    return [
      { id: null, title: 'Invalid Entry' },
      { title: '', problem: '', solution: '' },
      { title: 'A'.repeat(1000), problem: 'B'.repeat(10000) },
      { category: 'INVALID_CATEGORY' },
      { created_at: 'invalid-date' },
      { usage_count: -1, success_count: -5 },
    ];
  }
  static async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  static async measureExecutionTime(fn) {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const time = Number(end - start) / 1000000;
    return { result, time };
  }
  static randomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  static async corruptDatabase(dbPath) {
    if (dbPath === ':memory:') {
      throw new Error('Cannot corrupt in-memory database');
    }
    const buffer = Buffer.alloc(1024);
    buffer.fill(0xff);
    const fd = fs_1.default.openSync(dbPath, 'r+');
    const stats = fs_1.default.fstatSync(fd);
    const position = Math.floor(stats.size / 2);
    fs_1.default.writeSync(fd, buffer, 0, buffer.length, position);
    fs_1.default.closeSync(fd);
  }
  static async cleanup() {
    for (const manager of this.createdManagers) {
      try {
        await manager.shutdown();
      } catch (error) {
        console.warn('Error shutting down test database manager:', error);
      }
    }
    this.createdManagers.length = 0;
    for (const dbPath of this.createdDatabases) {
      try {
        if (fs_1.default.existsSync(dbPath)) {
          fs_1.default.unlinkSync(dbPath);
        }
      } catch (error) {
        console.warn('Error cleaning up test database:', error);
      }
    }
    this.createdDatabases.length = 0;
  }
}
exports.TestDatabaseFactory = TestDatabaseFactory;
//# sourceMappingURL=TestDatabaseFactory.js.map
