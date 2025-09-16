/**
 * Memory Management System Usage Examples
 * Demonstrates how to use MemoryManager, ConnectionPool, and CacheManager
 */

import { getServiceManager } from '../services/ServiceManager';
import { registerMemoryService, MemoryService } from './MemoryService';
import { MemoryManager } from './MemoryManager';

/**
 * Example 1: Basic ServiceManager Integration
 */
export async function exampleBasicIntegration() {
  console.log('=== Example 1: Basic ServiceManager Integration ===');

  // Get ServiceManager instance
  const serviceManager = getServiceManager({
    enableHealthChecks: true,
    healthCheckInterval: 30000,
    logging: {
      level: 'info',
      console: true
    }
  });

  // Register MemoryManager as a service
  const memoryService = registerMemoryService(serviceManager, {
    checkInterval: 15000, // Check every 15 seconds
    thresholds: {
      warning: 300,  // 300MB
      critical: 500, // 500MB
      cleanup: 600   // 600MB
    },
    enableAutoCleanup: true,
    maxCacheSize: 100 // 100MB cache
  });

  // Initialize all services
  const result = await serviceManager.initialize({
    parallelInitialization: true,
    failFast: false,
    enableRetries: true,
    retryAttempts: 2
  });

  console.log('Services initialized:', result.initialized);
  console.log('Failed services:', result.failed.map(f => f.name));

  // Get memory report
  const memoryReport = await memoryService.getMemoryReport();
  console.log('Initial memory usage:', {
    heapUsed: `${(memoryReport.metrics.heapUsed / 1024 / 1024).toFixed(1)}MB`,
    status: memoryReport.status,
    recommendations: memoryReport.recommendations
  });

  return { serviceManager, memoryService };
}

/**
 * Example 2: Database Connection Pool Usage
 */
export async function exampleConnectionPool(memoryService: MemoryService) {
  console.log('=== Example 2: Database Connection Pool Usage ===');

  // Execute simple queries
  console.log('Executing database queries...');

  // Create test table
  await memoryService.executeQuery(`
    CREATE TABLE IF NOT EXISTS test_data (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      value INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert test data
  for (let i = 1; i <= 10; i++) {
    await memoryService.executeQuery(
      'INSERT INTO test_data (name, value) VALUES (?, ?)',
      [`Test Item ${i}`, Math.floor(Math.random() * 1000)]
    );
  }

  // Query data
  const results = await memoryService.executeQuery<any[]>(
    'SELECT * FROM test_data ORDER BY created_at DESC LIMIT 5'
  );

  console.log('Recent test data:', results);

  // Get connection pool metrics
  const poolMetrics = memoryService.getConnectionPool().getMetrics();
  console.log('Connection pool metrics:', {
    totalConnections: poolMetrics.totalConnections,
    activeConnections: poolMetrics.activeConnections,
    totalQueries: poolMetrics.totalQueries,
    avgQueryTime: `${poolMetrics.avgQueryTime.toFixed(2)}ms`
  });

  return results;
}

/**
 * Example 3: Cache Manager Usage
 */
export async function exampleCacheManager(memoryService: MemoryService) {
  console.log('=== Example 3: Cache Manager Usage ===');

  const cache = memoryService.getCacheManager();

  // Cache some data
  console.log('Storing data in cache...');
  await cache.set('user:123', {
    id: 123,
    name: 'John Doe',
    email: 'john@example.com',
    preferences: { theme: 'dark', language: 'en' }
  }, 300000); // 5 minutes TTL

  await cache.set('settings:app', {
    version: '1.0.0',
    debugMode: false,
    features: ['search', 'analytics', 'cache']
  });

  // Cache with tags
  await memoryService.cacheSet('kb:entry:1', {
    title: 'VSAM Error Solution',
    content: 'Steps to resolve VSAM errors...',
    category: 'mainframe',
    tags: ['vsam', 'error', 'solution']
  });

  // Retrieve cached data
  console.log('Retrieving cached data...');
  const user = await cache.get('user:123');
  const settings = await cache.get('settings:app');
  
  console.log('Cached user:', user);
  console.log('Cached settings:', settings);

  // Test cache hit/miss
  const nonExistent = await cache.get('non:existent');
  console.log('Non-existent key result:', nonExistent); // Should be null

  // Get cache metrics
  const cacheMetrics = cache.getMetrics();
  console.log('Cache metrics:', {
    memoryEntries: cacheMetrics.memory.entries,
    memorySize: `${(cacheMetrics.memory.size / 1024).toFixed(1)}KB`,
    hitRatio: `${(cacheMetrics.total.hitRatio * 100).toFixed(1)}%`,
    totalHits: cacheMetrics.total.hits,
    totalMisses: cacheMetrics.total.misses
  });

  return cacheMetrics;
}

/**
 * Example 4: Memory Monitoring and Cleanup
 */
export async function exampleMemoryMonitoring(memoryService: MemoryService) {
  console.log('=== Example 4: Memory Monitoring and Cleanup ===');

  const memoryManager = memoryService.getMemoryManager();

  // Setup event listeners
  memoryManager.on('memory:warning', (report) => {
    console.log('⚠️  Memory warning received:', {
      heapUsed: `${(report.metrics.heapUsed / 1024 / 1024).toFixed(1)}MB`,
      recommendations: report.recommendations.slice(0, 2) // First 2 recommendations
    });
  });

  memoryManager.on('memory:cleanup', (result) => {
    console.log('🧹 Memory cleanup completed:', {
      memoryFreed: `${result.freed.toFixed(1)}MB`,
      duration: `${result.duration}ms`
    });
  });

  memoryManager.on('memory:leaks-detected', (leaks) => {
    console.log('🚨 Memory leaks detected:', leaks.map(leak => ({
      type: leak.type,
      size: `${(leak.size / 1024 / 1024).toFixed(1)}MB`
    })));
  });

  // Simulate memory usage
  console.log('Simulating memory usage...');
  const largeObjects: any[] = [];
  
  for (let i = 0; i < 50; i++) {
    // Create large objects to increase memory usage
    largeObjects.push({
      id: i,
      data: new Array(10000).fill(`test data ${i}`),
      timestamp: new Date()
    });

    // Cache some objects
    await memoryService.cacheSet(`large:object:${i}`, largeObjects[i], 60000);
  }

  // Get memory report
  const report = await memoryService.getMemoryReport();
  console.log('Memory report after simulation:', {
    heapUsed: `${(report.metrics.heapUsed / 1024 / 1024).toFixed(1)}MB`,
    heapTotal: `${(report.metrics.heapTotal / 1024 / 1024).toFixed(1)}MB`,
    status: report.status,
    recommendations: report.recommendations.length
  });

  // Force cleanup
  console.log('Forcing memory cleanup...');
  await memoryService.forceCleanup();

  // Force garbage collection if available
  const gcPerformed = await memoryManager.forceGarbageCollection();
  console.log('Garbage collection performed:', gcPerformed);

  // Get final memory report
  const finalReport = await memoryService.getMemoryReport();
  console.log('Memory report after cleanup:', {
    heapUsed: `${(finalReport.metrics.heapUsed / 1024 / 1024).toFixed(1)}MB`,
    status: finalReport.status
  });

  return finalReport;
}

/**
 * Example 5: System Health Monitoring
 */
export async function exampleHealthMonitoring(memoryService: MemoryService) {
  console.log('=== Example 5: System Health Monitoring ===');

  // Get comprehensive health status
  const health = await memoryService.getSystemHealth();
  
  console.log('System Health Status:');
  console.log('Overall Healthy:', health.overall);
  
  console.log('\nMemory Manager:');
  console.log('- Healthy:', health.memory.healthy);
  console.log('- Status:', health.memory.status);
  if (health.memory.details) {
    console.log('- Memory Usage:', health.memory.details.memoryUsage);
    console.log('- Issues:', health.memory.details.issues || 'None');
  }

  console.log('\nConnection Pool:');
  console.log('- Healthy:', health.connectionPool.healthy);
  console.log('- Total Connections:', health.connectionPool.connections.total);
  console.log('- Healthy Connections:', health.connectionPool.connections.healthy);
  if (health.connectionPool.errors.length > 0) {
    console.log('- Errors:', health.connectionPool.errors);
  }

  console.log('\nCache Manager:');
  console.log('- Healthy:', health.cache.healthy);
  console.log('- Memory Usage:', `${health.cache.memoryUsage.toFixed(1)}%`);
  if (health.cache.diskUsage !== undefined) {
    console.log('- Disk Usage:', `${health.cache.diskUsage.toFixed(1)}%`);
  }
  if (health.cache.issues.length > 0) {
    console.log('- Issues:', health.cache.issues);
  }

  return health;
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  try {
    console.log('🚀 Starting Memory Management System Examples\n');

    // Example 1: Basic integration
    const { serviceManager, memoryService } = await exampleBasicIntegration();
    console.log('');

    // Example 2: Database operations
    await exampleConnectionPool(memoryService);
    console.log('');

    // Example 3: Cache operations
    await exampleCacheManager(memoryService);
    console.log('');

    // Example 4: Memory monitoring
    await exampleMemoryMonitoring(memoryService);
    console.log('');

    // Example 5: Health monitoring
    await exampleHealthMonitoring(memoryService);
    console.log('');

    console.log('✅ All examples completed successfully');

    // Cleanup
    console.log('🧹 Shutting down services...');
    await serviceManager.shutdown();
    console.log('✅ Services shut down successfully');

  } catch (error) {
    console.error('❌ Error running examples:', error);
    throw error;
  }
}

// Export for use in tests or main application
export default {
  exampleBasicIntegration,
  exampleConnectionPool,
  exampleCacheManager,
  exampleMemoryMonitoring,
  exampleHealthMonitoring,
  runAllExamples
};