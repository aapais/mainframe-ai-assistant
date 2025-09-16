/**
 * Memory Management System Tests
 * Unit tests for MemoryManager, ConnectionPool, and CacheManager
 */

import { MemoryManager } from '../MemoryManager';
import { ConnectionPool } from '../ConnectionPool';
import { CacheManager } from '../CacheManager';
import { ServiceContext } from '../../services/types';

// Mock ServiceContext for testing
const createMockContext = (): ServiceContext => ({
  app: {} as any,
  dataPath: './test-data',
  isDevelopment: true,
  config: {},
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  metrics: {
    increment: jest.fn(),
    gauge: jest.fn(),
    histogram: jest.fn(),
    timer: jest.fn(() => jest.fn())
  },
  getService: jest.fn()
});

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  let mockContext: ServiceContext;

  beforeEach(() => {
    memoryManager = new MemoryManager({
      checkInterval: 1000,
      thresholds: {
        warning: 100,
        critical: 200,
        cleanup: 250
      },
      enableAutoCleanup: true
    });
    mockContext = createMockContext();
  });

  afterEach(async () => {
    if (memoryManager) {
      await memoryManager.shutdown();
    }
  });

  test('should initialize successfully', async () => {
    await memoryManager.initialize(mockContext);
    
    expect(memoryManager.getConnectionPool()).toBeDefined();
    expect(memoryManager.getCacheManager()).toBeDefined();
  });

  test('should generate memory report', async () => {
    await memoryManager.initialize(mockContext);
    
    const report = await memoryManager.getMemoryReport();
    
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('status');
    expect(report).toHaveProperty('recommendations');
    expect(report.metrics).toHaveProperty('heapUsed');
    expect(report.metrics).toHaveProperty('heapTotal');
    expect(report.metrics).toHaveProperty('rss');
  });

  test('should perform health check', async () => {
    await memoryManager.initialize(mockContext);
    
    const health = await memoryManager.healthCheck();
    
    expect(health).toHaveProperty('healthy');
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('lastCheck');
    expect(health).toHaveProperty('details');
  });

  test('should handle cleanup', async () => {
    await memoryManager.initialize(mockContext);
    
    // This should not throw
    await memoryManager.performCleanup();
  });

  test('should shutdown gracefully', async () => {
    await memoryManager.initialize(mockContext);
    
    // This should not throw
    await memoryManager.shutdown();
  });
});

describe('ConnectionPool', () => {
  let connectionPool: ConnectionPool;

  beforeEach(() => {
    connectionPool = new ConnectionPool({
      maxConnections: 5,
      idleTimeout: 30000,
      checkInterval: 5000
    });
  });

  afterEach(async () => {
    if (connectionPool) {
      await connectionPool.shutdown();
    }
  });

  test('should initialize successfully', async () => {
    await connectionPool.initialize();
    
    expect(connectionPool.getConnectionCount()).toBeGreaterThanOrEqual(0);
  });

  test('should create and release connections', async () => {
    await connectionPool.initialize();
    
    const connection = await connectionPool.getConnection();
    expect(connection).toHaveProperty('id');
    expect(connection).toHaveProperty('db');
    expect(connection.inUse).toBe(true);
    
    connectionPool.releaseConnection(connection.id);
    expect(connection.inUse).toBe(false);
  });

  test('should execute queries', async () => {
    await connectionPool.initialize();
    
    // Create a test table
    const createResult = await connectionPool.executeQuery(
      'CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)'
    );
    expect(createResult).toBeDefined();
    
    // Insert test data
    const insertResult = await connectionPool.executeQuery(
      'INSERT INTO test (name) VALUES (?)',
      ['Test Name']
    );
    expect(insertResult).toBeDefined();
    
    // Query test data
    const selectResult = await connectionPool.executeQuery(
      'SELECT * FROM test WHERE name = ?',
      ['Test Name']
    );
    expect(Array.isArray(selectResult)).toBe(true);
  });

  test('should provide health status', async () => {
    await connectionPool.initialize();
    
    const health = connectionPool.getHealth();
    
    expect(health).toHaveProperty('healthy');
    expect(health).toHaveProperty('connections');
    expect(health).toHaveProperty('errors');
    expect(health.connections).toHaveProperty('total');
    expect(health.connections).toHaveProperty('healthy');
  });

  test('should provide metrics', async () => {
    await connectionPool.initialize();
    
    const metrics = connectionPool.getMetrics();
    
    expect(metrics).toHaveProperty('totalConnections');
    expect(metrics).toHaveProperty('activeConnections');
    expect(metrics).toHaveProperty('idleConnections');
    expect(metrics).toHaveProperty('totalQueries');
  });
});

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager({
      maxMemorySize: 10 * 1024 * 1024, // 10MB
      defaultTTL: 60000, // 1 minute
      enableDiskCache: false, // Disable for testing
      cleanupInterval: 5000
    });
  });

  afterEach(async () => {
    if (cacheManager) {
      await cacheManager.shutdown();
    }
  });

  test('should initialize successfully', async () => {
    await cacheManager.initialize();
    
    expect(cacheManager.getEntryCount()).toBe(0);
    expect(cacheManager.getSize()).toBe(0);
  });

  test('should store and retrieve data', async () => {
    await cacheManager.initialize();
    
    const testData = { id: 1, name: 'Test', value: 42 };
    
    await cacheManager.set('test-key', testData);
    const retrieved = await cacheManager.get('test-key');
    
    expect(retrieved).toEqual(testData);
    expect(cacheManager.getEntryCount()).toBe(1);
  });

  test('should handle TTL expiration', async () => {
    await cacheManager.initialize();
    
    const testData = { id: 1, name: 'Expires Soon' };
    
    // Set with very short TTL
    await cacheManager.set('expire-key', testData, 100); // 100ms
    
    // Should exist immediately
    const immediate = await cacheManager.get('expire-key');
    expect(immediate).toEqual(testData);
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Should be expired now
    const expired = await cacheManager.get('expire-key');
    expect(expired).toBeNull();
  });

  test('should delete entries', async () => {
    await cacheManager.initialize();
    
    await cacheManager.set('delete-me', { data: 'test' });
    
    const exists = await cacheManager.has('delete-me');
    expect(exists).toBe(true);
    
    const deleted = await cacheManager.delete('delete-me');
    expect(deleted).toBe(true);
    
    const stillExists = await cacheManager.has('delete-me');
    expect(stillExists).toBe(false);
  });

  test('should clear all entries', async () => {
    await cacheManager.initialize();
    
    await cacheManager.set('key1', { data: 'test1' });
    await cacheManager.set('key2', { data: 'test2' });
    await cacheManager.set('key3', { data: 'test3' });
    
    expect(cacheManager.getEntryCount()).toBe(3);
    
    await cacheManager.clear();
    
    expect(cacheManager.getEntryCount()).toBe(0);
  });

  test('should provide health status', async () => {
    await cacheManager.initialize();
    
    const health = await cacheManager.getHealth();
    
    expect(health).toHaveProperty('healthy');
    expect(health).toHaveProperty('memoryUsage');
    expect(health).toHaveProperty('issues');
    expect(typeof health.memoryUsage).toBe('number');
  });

  test('should provide metrics', async () => {
    await cacheManager.initialize();
    
    // Add some data to generate metrics
    await cacheManager.set('metrics-test', { data: 'test' });
    await cacheManager.get('metrics-test'); // Hit
    await cacheManager.get('non-existent'); // Miss
    
    const metrics = cacheManager.getMetrics();
    
    expect(metrics).toHaveProperty('memory');
    expect(metrics).toHaveProperty('total');
    expect(metrics.memory).toHaveProperty('hits');
    expect(metrics.memory).toHaveProperty('misses');
    expect(metrics.total).toHaveProperty('hitRatio');
  });

  test('should handle memory cleanup when limit is reached', async () => {
    // Create cache with very small memory limit
    const smallCache = new CacheManager({
      maxMemorySize: 1024, // 1KB
      defaultTTL: 60000,
      enableDiskCache: false
    });
    
    await smallCache.initialize();
    
    try {
      // Add data that should trigger eviction
      for (let i = 0; i < 10; i++) {
        await smallCache.set(`key-${i}`, {
          data: new Array(200).fill(`data-${i}`).join('') // ~200 chars each
        });
      }
      
      // Should have evicted some entries to stay under limit
      const entryCount = smallCache.getEntryCount();
      expect(entryCount).toBeLessThan(10);
      
    } finally {
      await smallCache.shutdown();
    }
  });
});

describe('Integration Tests', () => {
  test('should work together as a system', async () => {
    const memoryManager = new MemoryManager({
      checkInterval: 5000,
      enableAutoCleanup: true,
      maxCacheSize: 10 // 10MB
    });
    
    const mockContext = createMockContext();
    
    try {
      await memoryManager.initialize(mockContext);
      
      // Test database operations
      const pool = memoryManager.getConnectionPool();
      await pool.executeQuery('CREATE TABLE IF NOT EXISTS integration_test (id INTEGER PRIMARY KEY, data TEXT)');
      await pool.executeQuery('INSERT INTO integration_test (data) VALUES (?)', ['test data']);
      const results = await pool.executeQuery('SELECT * FROM integration_test');
      expect(Array.isArray(results)).toBe(true);
      
      // Test cache operations
      const cache = memoryManager.getCacheManager();
      await cache.set('integration-key', { test: 'data' });
      const cachedData = await cache.get('integration-key');
      expect(cachedData).toEqual({ test: 'data' });
      
      // Test memory reporting
      const report = await memoryManager.getMemoryReport();
      expect(report.status).toMatch(/healthy|warning|critical/);
      
      // Test health check
      const health = await memoryManager.healthCheck();
      expect(health).toHaveProperty('healthy');
      
    } finally {
      await memoryManager.shutdown();
    }
  });
});