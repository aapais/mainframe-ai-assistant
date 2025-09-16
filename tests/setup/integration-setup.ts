/**
 * Integration Test Setup
 * Configuration and utilities for testing component interactions and API endpoints
 */

import { jest } from '@jest/globals';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { TestDataFactory } from './test-setup';

// Test database configuration
export const testDbConfig = {
  path: ':memory:', // Use in-memory database for tests
  options: {
    verbose: process.env.DEBUG_SQL === 'true' ? console.log : undefined,
    fileMustExist: false,
    timeout: 5000
  }
};

// Mock IPC handlers for Electron integration tests
export const mockIPCHandlers = {
  // Knowledge Base operations
  'kb:search': jest.fn(),
  'kb:add': jest.fn(),
  'kb:update': jest.fn(),
  'kb:delete': jest.fn(),
  'kb:get-all': jest.fn(),
  'kb:get-stats': jest.fn(),
  'kb:export': jest.fn(),
  'kb:import': jest.fn(),

  // Search operations
  'search:query': jest.fn(),
  'search:suggest': jest.fn(),
  'search:correct': jest.fn(),
  'search:clear-cache': jest.fn(),
  'search:get-stats': jest.fn(),

  // AI services
  'ai:gemini-search': jest.fn(),
  'ai:explain-error': jest.fn(),

  // Performance monitoring
  'performance:get-metrics': jest.fn(),
  'performance:start-monitoring': jest.fn(),
  'performance:stop-monitoring': jest.fn(),

  // System operations
  'system:get-info': jest.fn(),
  'system:backup': jest.fn(),
  'system:restore': jest.fn(),
  'system:optimize': jest.fn()
};

// Database test utilities
export class TestDatabaseManager {
  private db: Database.Database | null = null;
  private initialized = false;

  async initialize(): Promise<Database.Database> {
    if (this.db && this.initialized) {
      return this.db;
    }

    this.db = new Database(testDbConfig.path, testDbConfig.options);

    // Enable foreign keys and other pragmas
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 268435456'); // 256MB

    // Load schema
    await this.loadSchema();

    this.initialized = true;
    return this.db;
  }

  private async loadSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Knowledge Base schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kb_entries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        problem TEXT NOT NULL,
        solution TEXT NOT NULL,
        category TEXT CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        usage_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS kb_tags (
        entry_id TEXT,
        tag TEXT,
        PRIMARY KEY (entry_id, tag),
        FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        results_count INTEGER,
        selected_entry_id TEXT,
        user_id TEXT,
        response_time_ms INTEGER,
        cache_hit BOOLEAN DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS usage_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id TEXT,
        action TEXT CHECK(action IN ('view', 'copy', 'rate_success', 'rate_failure')),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id TEXT,
        session_id TEXT,
        FOREIGN KEY (entry_id) REFERENCES kb_entries(id)
      );

      -- FTS table for full-text search testing
      CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(
        id UNINDEXED,
        title,
        problem,
        solution,
        tags,
        content='',
        contentless_delete=1
      );

      -- Performance indexes
      CREATE INDEX IF NOT EXISTS idx_category ON kb_entries(category);
      CREATE INDEX IF NOT EXISTS idx_usage ON kb_entries(usage_count DESC);
      CREATE INDEX IF NOT EXISTS idx_success_rate ON kb_entries(success_count, failure_count);
      CREATE INDEX IF NOT EXISTS idx_created_at ON kb_entries(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_search_timestamp ON search_history(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_usage_metrics_entry ON usage_metrics(entry_id);
      CREATE INDEX IF NOT EXISTS idx_usage_metrics_action ON usage_metrics(action);
    `);
  }

  async seedTestData(count: number = 50): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const entries = [];
    const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'];

    const problems = [
      'Job abends with S0C7 data exception in COBOL program',
      'VSAM file status 35 - file not found during open',
      'DB2 SQLCODE -904 resource unavailable error',
      'JCL error IEF212I dataset not cataloged',
      'Memory allocation failure in batch processing',
      'CICS transaction timeout ABEND AEI7',
      'Sort utility WER027A insufficient storage',
      'FTP transfer failed with EDC8128I connection refused',
      'IMS database not available U0778 error',
      'Dataset organization error ABEND S013'
    ];

    const solutions = [
      'Check numeric field initialization and COMP-3 fields. Use NUMPROC(NOPFD) compile option.',
      'Verify file exists in catalog using LISTCAT. Check RACF permissions and dataset name.',
      'Check tablespace status and run IMAGE COPY if needed. Verify DB2 resource availability.',
      'Validate dataset name spelling and ensure proper allocation with correct DCB parameters.',
      'Increase REGION parameter to 0M and optimize memory usage in program logic.',
      'Increase CICS transaction timeout values and check for deadlock conditions.',
      'Add DYNALLOC parameters and increase REGION. Use OPTION MAINSIZE=MAX in sort.',
      'Verify FTP server status and firewall rules. Test with PING first.',
      'Check IMS database status with /DIS DB command. Start database if stopped.',
      'Verify member exists in PDS and check for correct dataset organization.'
    ];

    const stmt = this.db.prepare(`
      INSERT INTO kb_entries (id, title, problem, solution, category, created_by, usage_count, success_count, failure_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tagStmt = this.db.prepare(`
      INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)
    `);

    for (let i = 0; i < count; i++) {
      const entry = {
        id: `test-kb-${i + 1}`,
        title: `Issue ${i + 1}: ${problems[i % problems.length].split(' ').slice(0, 6).join(' ')}`,
        problem: problems[i % problems.length],
        solution: solutions[i % solutions.length],
        category: categories[i % categories.length],
        created_by: 'test-system',
        usage_count: Math.floor(Math.random() * 100),
        success_count: Math.floor(Math.random() * 80),
        failure_count: Math.floor(Math.random() * 20)
      };

      stmt.run(
        entry.id,
        entry.title,
        entry.problem,
        entry.solution,
        entry.category,
        entry.created_by,
        entry.usage_count,
        entry.success_count,
        entry.failure_count
      );

      // Add tags
      const tags = [
        entry.category.toLowerCase(),
        'test',
        `issue${i % 5}`,
        problems[i % problems.length].split(' ')[0].toLowerCase()
      ];

      tags.forEach(tag => {
        try {
          tagStmt.run(entry.id, tag);
        } catch (err) {
          // Ignore duplicate tag errors
        }
      });

      entries.push(entry);
    }

    // Update FTS index
    this.db.exec(`
      INSERT INTO kb_fts(id, title, problem, solution, tags)
      SELECT
        e.id,
        e.title,
        e.problem,
        e.solution,
        GROUP_CONCAT(t.tag, ' ') as tags
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      GROUP BY e.id
    `);

    return entries;
  }

  async clearTestData(): Promise<void> {
    if (!this.db) return;

    this.db.exec(`
      DELETE FROM kb_fts;
      DELETE FROM usage_metrics;
      DELETE FROM search_history;
      DELETE FROM kb_tags;
      DELETE FROM kb_entries;
    `);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  getDatabase(): Database.Database {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  // Query helpers for tests
  async getEntryCount(): Promise<number> {
    if (!this.db) return 0;
    const result = this.db.prepare('SELECT COUNT(*) as count FROM kb_entries').get() as any;
    return result.count;
  }

  async getSearchHistory(): Promise<any[]> {
    if (!this.db) return [];
    return this.db.prepare('SELECT * FROM search_history ORDER BY timestamp DESC').all();
  }

  async getUsageMetrics(): Promise<any[]> {
    if (!this.db) return [];
    return this.db.prepare('SELECT * FROM usage_metrics ORDER BY timestamp DESC').all();
  }
}

// Mock Gemini API for integration tests
export class MockGeminiIntegration {
  private delay: number = 100;
  private shouldFail: boolean = false;
  private responses: Map<string, any> = new Map();

  constructor() {
    this.setupDefaultResponses();
  }

  async findSimilar(query: string, entries: any[]): Promise<any[]> {
    if (this.shouldFail) {
      throw new Error('Mock Gemini API failure');
    }

    // Simulate network delay
    await this.simulateDelay();

    // Generate realistic similarity scores
    const results = entries.slice(0, 5).map((entry, index) => ({
      entry,
      score: Math.max(95 - (index * 15) + Math.random() * 10, 20),
      matchType: 'ai' as const,
      explanation: `AI similarity match #${index + 1} for query: "${query}"`
    }));

    return results.sort((a, b) => b.score - a.score);
  }

  async explainError(errorCode: string): Promise<string> {
    if (this.shouldFail) {
      throw new Error('Mock Gemini API failure');
    }

    await this.simulateDelay();

    const explanations = {
      'S0C7': 'Data exception - Invalid numeric data in arithmetic operation',
      'S0C4': 'Protection exception - Invalid memory address access',
      'IEF212I': 'Dataset not found - Check dataset name and catalog',
      'SQLCODE -904': 'Resource unavailable - Database object not accessible'
    };

    return explanations[errorCode as keyof typeof explanations] ||
           `Mock explanation for error code: ${errorCode}`;
  }

  // Test control methods
  setDelay(ms: number): void {
    this.delay = ms;
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  setMockResponse(key: string, response: any): void {
    this.responses.set(key, response);
  }

  private async simulateDelay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.delay));
  }

  private setupDefaultResponses(): void {
    this.responses.set('findSimilar', {
      scores: [95, 87, 73, 65, 52],
      explanations: [
        'Exact match on error code and context',
        'Strong similarity in problem description',
        'Partial match on solution approach',
        'Similar category and tags',
        'Related error pattern'
      ]
    });
  }
}

// Performance monitoring for integration tests
export class IntegrationPerformanceMonitor {
  private metrics: Array<{ operation: string; duration: number; timestamp: number }> = [];

  async measure<T>(operation: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage?.();

    try {
      const result = await fn();
      const duration = performance.now() - startTime;

      this.metrics.push({
        operation,
        duration,
        timestamp: Date.now()
      });

      return { result, duration };
    } catch (error) {
      const duration = performance.now() - startTime;
      this.metrics.push({
        operation: `${operation} (failed)`,
        duration,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  getMetrics(): typeof this.metrics {
    return [...this.metrics];
  }

  getAverageTime(operation: string): number {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);
    if (operationMetrics.length === 0) return 0;

    const total = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / operationMetrics.length;
  }

  clear(): void {
    this.metrics = [];
  }

  generateReport(): string {
    const operations = [...new Set(this.metrics.map(m => m.operation))];
    let report = 'Integration Performance Report\n';
    report += '================================\n\n';

    operations.forEach(op => {
      const metrics = this.metrics.filter(m => m.operation === op);
      const avg = this.getAverageTime(op);
      const min = Math.min(...metrics.map(m => m.duration));
      const max = Math.max(...metrics.map(m => m.duration));

      report += `${op}:\n`;
      report += `  Count: ${metrics.length}\n`;
      report += `  Average: ${avg.toFixed(2)}ms\n`;
      report += `  Min: ${min.toFixed(2)}ms\n`;
      report += `  Max: ${max.toFixed(2)}ms\n\n`;
    });

    return report;
  }
}

// Test data generators for integration tests
export const integrationTestData = {
  createSearchScenarios: () => [
    { query: 'VSAM Status 35', expectedMinResults: 1, category: 'VSAM' },
    { query: 'S0C7 data exception', expectedMinResults: 1, category: 'Batch' },
    { query: 'DB2 SQLCODE -904', expectedMinResults: 1, category: 'DB2' },
    { query: 'JCL dataset not found', expectedMinResults: 1, category: 'JCL' },
    { query: 'memory allocation', expectedMinResults: 1, category: 'Batch' },
    { query: 'error', expectedMinResults: 5, category: null }, // Broad search
    { query: 'nonexistent xyz123', expectedMinResults: 0, category: null } // No results
  ],

  createPerformanceScenarios: () => [
    { name: 'fast_search', query: 'error', maxTime: 100 },
    { name: 'medium_search', query: 'VSAM status error', maxTime: 500 },
    { name: 'complex_search', query: 'data exception OR memory allocation', maxTime: 1000 },
    { name: 'fuzzy_search', query: 'VSAM staus 35', maxTime: 1000 } // Typo
  ],

  createStressScenarios: () => [
    { name: 'concurrent_searches', concurrent: 10, query: 'stress test' },
    { name: 'rapid_fire', count: 50, interval: 10, query: 'rapid' },
    { name: 'large_result_set', query: 'test', limit: 100 }
  ]
};

// Global setup
let testDbManager: TestDatabaseManager;
let performanceMonitor: IntegrationPerformanceMonitor;
let geminiMock: MockGeminiIntegration;

export const getTestDatabase = async (): Promise<TestDatabaseManager> => {
  if (!testDbManager) {
    testDbManager = new TestDatabaseManager();
    await testDbManager.initialize();
  }
  return testDbManager;
};

export const getPerformanceMonitor = (): IntegrationPerformanceMonitor => {
  if (!performanceMonitor) {
    performanceMonitor = new IntegrationPerformanceMonitor();
  }
  return performanceMonitor;
};

export const getGeminiMock = (): MockGeminiIntegration => {
  if (!geminiMock) {
    geminiMock = new MockGeminiIntegration();
  }
  return geminiMock;
};

// Cleanup function
export const cleanupIntegrationTests = async (): Promise<void> => {
  if (testDbManager) {
    await testDbManager.clearTestData();
    await testDbManager.close();
  }

  if (performanceMonitor) {
    performanceMonitor.clear();
  }

  jest.clearAllMocks();
};

export default {
  TestDatabaseManager,
  MockGeminiIntegration,
  IntegrationPerformanceMonitor,
  mockIPCHandlers,
  integrationTestData,
  getTestDatabase,
  getPerformanceMonitor,
  getGeminiMock,
  cleanupIntegrationTests
};