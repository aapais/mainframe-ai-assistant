import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Global setup for performance tests
 * This runs once before all performance tests
 */
export default async function globalSetup() {
  console.log('🔧 Setting up global performance test environment...');
  
  // Create temporary directory for performance test artifacts
  const tempDir = path.join(os.tmpdir(), 'mvp1-performance-tests');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Store temp directory path for tests
  process.env.PERFORMANCE_TEST_TEMP_DIR = tempDir;
  
  // Set up performance monitoring environment
  process.env.NODE_ENV = 'performance-test';
  process.env.PERFORMANCE_MONITORING_ENABLED = 'true';
  
  // Configure garbage collection for performance testing
  if (global.gc) {
    // Run initial garbage collection
    global.gc();
    console.log('✅ Garbage collection enabled and initialized');
  } else {
    console.log('⚠️  Garbage collection not available - run with --expose-gc for better memory testing');
  }
  
  // Set up memory monitoring
  const initialMemory = process.memoryUsage();
  console.log(`📊 Initial memory usage: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  
  // Configure test database settings for performance
  process.env.TEST_DB_PATH = path.join(tempDir, 'performance-test.db');
  process.env.TEST_DB_MEMORY = 'false'; // Use file-based DB for realistic performance
  process.env.TEST_DB_CACHE_SIZE = '100'; // 100MB cache
  
  // Set up performance thresholds from environment or defaults
  const performanceConfig = {
    SEARCH_LOCAL_TIMEOUT: parseInt(process.env.SEARCH_LOCAL_TIMEOUT || '1000'),
    SEARCH_AI_TIMEOUT: parseInt(process.env.SEARCH_AI_TIMEOUT || '2000'),
    DATABASE_QUERY_TIMEOUT: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '50'),
    UI_RENDER_TIMEOUT: parseInt(process.env.UI_RENDER_TIMEOUT || '100'),
    APP_STARTUP_TIMEOUT: parseInt(process.env.APP_STARTUP_TIMEOUT || '5000'),
    MAX_MEMORY_USAGE_MB: parseInt(process.env.MAX_MEMORY_USAGE_MB || '500'),
    MIN_THROUGHPUT_OPS: parseInt(process.env.MIN_THROUGHPUT_OPS || '100')
  };
  
  // Store config for tests
  global.__PERFORMANCE_CONFIG__ = performanceConfig;
  
  console.log('📈 Performance thresholds configured:');
  Object.entries(performanceConfig).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}${key.includes('TIMEOUT') ? 'ms' : key.includes('MEMORY') ? 'MB' : key.includes('THROUGHPUT') ? ' ops/sec' : ''}`);
  });
  
  // Create performance results directory
  const resultsDir = path.join(__dirname, '..', '..', 'performance-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  process.env.PERFORMANCE_RESULTS_DIR = resultsDir;
  
  // Set up system monitoring
  const systemInfo = {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024), // GB
    nodeVersion: process.version,
    electronVersion: process.versions.electron || 'N/A'
  };
  
  console.log('💻 System information:');
  Object.entries(systemInfo).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  
  global.__SYSTEM_INFO__ = systemInfo;
  
  // Validate system meets minimum requirements for performance testing
  if (systemInfo.cpus < 2) {
    console.warn('⚠️  Warning: Less than 2 CPU cores detected. Performance tests may not be reliable.');
  }
  
  if (systemInfo.totalMemory < 4) {
    console.warn('⚠️  Warning: Less than 4GB RAM detected. Performance tests may not be reliable.');
  }
  
  // Set up test timeouts
  const testTimeouts = {
    DEFAULT: 120000, // 2 minutes
    LOAD_TEST: 300000, // 5 minutes
    UI_TEST: 120000, // 2 minutes
    DATABASE_TEST: 90000, // 1.5 minutes
    SEARCH_TEST: 60000 // 1 minute
  };
  
  global.__TEST_TIMEOUTS__ = testTimeouts;
  
  console.log('⏱️  Test timeouts configured:');
  Object.entries(testTimeouts).forEach(([key, value]) => {
    console.log(`  ${key}: ${value / 1000}s`);
  });
  
  // Create benchmark results file
  const benchmarkFile = path.join(resultsDir, `benchmark-${Date.now()}.json`);
  const benchmarkData = {
    startTime: new Date().toISOString(),
    systemInfo,
    performanceConfig,
    results: []
  };
  
  fs.writeFileSync(benchmarkFile, JSON.stringify(benchmarkData, null, 2));
  process.env.BENCHMARK_RESULTS_FILE = benchmarkFile;
  
  console.log(`📁 Benchmark results will be saved to: ${benchmarkFile}`);
  
  // Enable detailed error reporting
  process.env.PERFORMANCE_DETAILED_ERRORS = 'true';
  
  // Set up memory leak detection
  process.env.DETECT_MEMORY_LEAKS = 'true';
  
  // Configure for CI environment if detected
  if (process.env.CI) {
    console.log('🏗️  CI environment detected - adjusting performance thresholds');
    
    // Increase thresholds slightly for CI environment variability
    Object.keys(performanceConfig).forEach(key => {
      if (key.includes('TIMEOUT')) {
        (performanceConfig as any)[key] *= 1.5; // 50% more time in CI
      }
      if (key.includes('THROUGHPUT')) {
        (performanceConfig as any)[key] *= 0.8; // 20% lower throughput expectations in CI
      }
    });
    
    global.__PERFORMANCE_CONFIG__ = performanceConfig;
  }
  
  console.log('✅ Global performance test setup completed\n');
}