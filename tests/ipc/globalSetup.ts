/**
 * Global Setup for IPC Test Suite
 * Runs once before all IPC tests
 */

export default async function globalSetup() {
  console.log('\n🔧 Setting up IPC Test Environment...');
  
  // Set up environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
  process.env.ELECTRON_ENABLE_LOGGING = 'false';
  
  // Configure test timeouts
  jest.setTimeout(30000); // 30 seconds global timeout
  
  // Memory configuration for testing
  if (global.gc) {
    console.log('✅ Garbage collection available for memory testing');
  } else {
    console.log('⚠️  Garbage collection not available - run with --expose-gc for memory tests');
  }
  
  // Set up performance monitoring
  const performanceConfig = {
    maxTestTime: 10000, // 10 seconds per test
    maxMemoryIncrease: 100 * 1024 * 1024, // 100MB
    maxConcurrentRequests: 1000
  };
  
  (global as any).performanceConfig = performanceConfig;
  
  // Create test data directory if needed
  const path = require('path');
  const fs = require('fs');
  
  const testDataDir = path.join(process.cwd(), 'tests', 'ipc', 'data');
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
    console.log(`📁 Created test data directory: ${testDataDir}`);
  }
  
  // Generate test data files for complex scenarios
  const testData = {
    largeDataset: Array.from({ length: 10000 }, (_, i) => ({
      id: `large-${i}`,
      title: `Large Dataset Entry ${i}`,
      content: 'Content '.repeat(100), // ~800 bytes per entry
      metadata: {
        index: i,
        timestamp: Date.now() + i * 1000,
        tags: Array.from({ length: 10 }, (_, j) => `tag-${i}-${j}`)
      }
    })),
    
    complexObjects: {
      nested: {
        deep: {
          data: Array.from({ length: 1000 }, (_, i) => ({ value: i })),
          binary: Array.from({ length: 1024 }, (_, i) => i % 256),
          dates: Array.from({ length: 100 }, () => new Date().toISOString())
        }
      },
      arrays: {
        strings: Array.from({ length: 500 }, (_, i) => `string-${i}`),
        numbers: Array.from({ length: 500 }, (_, i) => Math.random() * 1000),
        objects: Array.from({ length: 200 }, (_, i) => ({ id: i, value: Math.random() }))
      }
    }
  };
  
  fs.writeFileSync(
    path.join(testDataDir, 'large-dataset.json'),
    JSON.stringify(testData.largeDataset, null, 2)
  );
  
  fs.writeFileSync(
    path.join(testDataDir, 'complex-objects.json'),
    JSON.stringify(testData.complexObjects, null, 2)
  );
  
  console.log('📊 Generated test data files');
  
  // Set up mock database for testing
  const mockDatabase = {
    entries: new Map(),
    searches: new Map(),
    stats: {
      totalEntries: 0,
      totalSearches: 0,
      totalUsage: 0
    }
  };
  
  // Populate with sample data
  for (let i = 0; i < 100; i++) {
    const entry = {
      id: `sample-${i}`,
      title: `Sample Entry ${i}`,
      content: `This is sample content for entry ${i}`,
      category: ['COBOL', 'JCL', 'DB2', 'CICS', 'VSAM'][i % 5],
      tags: [`tag-${i}`, `category-${i % 5}`, 'sample'],
      created: Date.now() - (i * 86400000), // Spread over days
      updated: Date.now() - (i * 3600000), // Spread over hours
      usageCount: Math.floor(Math.random() * 100),
      successfulUses: Math.floor(Math.random() * 80),
      unsuccessfulUses: Math.floor(Math.random() * 20)
    };
    mockDatabase.entries.set(entry.id, entry);
  }
  
  mockDatabase.stats.totalEntries = mockDatabase.entries.size;
  
  (global as any).mockDatabase = mockDatabase;
  
  console.log(`📚 Created mock database with ${mockDatabase.entries.size} entries`);
  
  // Set up test metrics collection
  const testMetrics = {
    startTime: Date.now(),
    testsRun: 0,
    testsPassed: 0,
    testsFailed: 0,
    totalExecutionTime: 0,
    memoryUsage: {
      start: process.memoryUsage(),
      peak: process.memoryUsage(),
      current: process.memoryUsage()
    },
    ipcOperations: {
      total: 0,
      successful: 0,
      failed: 0,
      avgResponseTime: 0,
      responseTimes: []
    }
  };
  
  (global as any).testMetrics = testMetrics;
  
  // Set up error tracking
  const errorTracker = {
    errors: [],
    warnings: [],
    performance: []
  };
  
  (global as any).errorTracker = errorTracker;
  
  // Override console methods to track issues
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  console.error = (...args: any[]) => {
    errorTracker.errors.push({
      timestamp: Date.now(),
      message: args.join(' '),
      stack: new Error().stack
    });
    originalConsoleError(...args);
  };
  
  console.warn = (...args: any[]) => {
    errorTracker.warnings.push({
      timestamp: Date.now(),
      message: args.join(' ')
    });
    originalConsoleWarn(...args);
  };
  
  // Restore original console methods on cleanup
  (global as any).restoreConsole = () => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  };
  
  console.log('🎯 IPC test environment setup complete');
  console.log(`   - Performance config: ${JSON.stringify(performanceConfig)}`);
  console.log(`   - Mock database: ${mockDatabase.entries.size} entries`);
  console.log(`   - Test data files generated`);
  console.log(`   - Error tracking enabled`);
  
  return Promise.resolve();
}
