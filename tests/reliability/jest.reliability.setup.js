/**
 * Jest Setup for Reliability Tests
 * Global setup and configuration for reliability testing environment
 */

const path = require('path');
const fs = require('fs').promises;

// Global setup for reliability tests
beforeAll(async () => {
  console.log('🔧 Setting up Reliability Test Environment...\n');
  
  // Create reports directory
  const reportsDir = path.join(__dirname, 'reports');
  try {
    await fs.mkdir(reportsDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  // Set up global test environment
  global.RELIABILITY_TEST_START = Date.now();
  global.RELIABILITY_TEMP_FILES = [];
  
  // Enable garbage collection for memory leak detection
  if (global.gc) {
    console.log('✅ Garbage collection enabled for memory leak detection');
  } else {
    console.log('⚠️  Garbage collection not available (run with --expose-gc for better memory testing)');
  }
  
  // Set up memory monitoring
  global.INITIAL_MEMORY = process.memoryUsage();
  
  // Set up error tracking
  global.UNHANDLED_ERRORS = [];
  process.on('uncaughtException', (error) => {
    global.UNHANDLED_ERRORS.push(error);
    console.error('Uncaught exception during reliability test:', error);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    global.UNHANDLED_ERRORS.push(reason);
    console.error('Unhandled rejection during reliability test:', reason);
  });
  
  console.log('🚀 Reliability Test Environment Ready\n');
});

// Global teardown for reliability tests
afterAll(async () => {
  console.log('\n🧹 Cleaning up Reliability Test Environment...');
  
  const testDuration = Date.now() - global.RELIABILITY_TEST_START;
  const finalMemory = process.memoryUsage();
  const memoryIncrease = finalMemory.heapUsed - global.INITIAL_MEMORY.heapUsed;
  
  console.log(`⏱️  Total test duration: ${(testDuration / 1000).toFixed(2)} seconds`);
  console.log(`💾 Memory increase during tests: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
  
  if (global.UNHANDLED_ERRORS.length > 0) {
    console.log(`❌ Unhandled errors detected: ${global.UNHANDLED_ERRORS.length}`);
    global.UNHANDLED_ERRORS.forEach((error, index) => {
      console.error(`  ${index + 1}. ${error.message || error}`);
    });
  } else {
    console.log('✅ No unhandled errors detected');
  }
  
  // Clean up temporary files
  if (global.RELIABILITY_TEMP_FILES.length > 0) {
    console.log(`🗑️  Cleaning up ${global.RELIABILITY_TEMP_FILES.length} temporary files...`);
    for (const filePath of global.RELIABILITY_TEMP_FILES) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File might already be deleted
      }
    }
  }
  
  // Generate final reliability report
  if (global.RELIABILITY_TEST_CONFIG?.GENERATE_REPORTS) {
    await generateReliabilityReport();
  }
  
  console.log('✅ Reliability Test Environment cleaned up\n');
});

// Helper function to track temporary files
global.addTempFile = (filePath) => {
  if (!global.RELIABILITY_TEMP_FILES.includes(filePath)) {
    global.RELIABILITY_TEMP_FILES.push(filePath);
  }
};

// Helper function to generate reliability summary report
async function generateReliabilityReport() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      testDuration: Date.now() - global.RELIABILITY_TEST_START,
      memoryUsage: {
        initial: global.INITIAL_MEMORY,
        final: process.memoryUsage(),
        increase: process.memoryUsage().heapUsed - global.INITIAL_MEMORY.heapUsed
      },
      unhandledErrors: global.UNHANDLED_ERRORS.length,
      tempFilesCreated: global.RELIABILITY_TEMP_FILES.length,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
    
    const reportPath = path.join(__dirname, 'reports', 'reliability-summary.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Reliability summary report saved to: ${reportPath}`);
  } catch (error) {
    console.error('Failed to generate reliability report:', error);
  }
}

// Configure Jest for reliability testing
const originalConsoleError = console.error;
console.error = (...args) => {
  // Track console errors during tests
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Test failed')) {
    global.TEST_FAILURES = (global.TEST_FAILURES || 0) + 1;
  }
  originalConsoleError.apply(console, args);
};

// Memory leak detection helper
global.detectMemoryLeak = (testName, threshold = 50 * 1024 * 1024) => { // 50MB default threshold
  if (!global.gc) {
    console.warn(`Memory leak detection for '${testName}' skipped (--expose-gc not available)`);
    return false;
  }
  
  const beforeGC = process.memoryUsage();
  global.gc();
  global.gc(); // Run twice to ensure cleanup
  const afterGC = process.memoryUsage();
  
  const leakSize = afterGC.heapUsed - beforeGC.heapUsed;
  const hasLeak = Math.abs(leakSize) > threshold;
  
  if (hasLeak) {
    console.warn(`⚠️  Potential memory leak detected in '${testName}': ${(leakSize / 1024 / 1024).toFixed(2)}MB`);
  }
  
  return hasLeak;
};

// Performance monitoring helper
global.measurePerformance = async (testName, operation) => {
  const start = process.hrtime.bigint();
  const memBefore = process.memoryUsage();
  
  try {
    const result = await operation();
    
    const end = process.hrtime.bigint();
    const memAfter = process.memoryUsage();
    
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    const memoryDelta = memAfter.heapUsed - memBefore.heapUsed;
    
    console.log(`📈 Performance for '${testName}': ${duration.toFixed(2)}ms, memory: ${(memoryDelta / 1024).toFixed(2)}KB`);
    
    return {
      result,
      duration,
      memoryDelta,
      success: true
    };
  } catch (error) {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000;
    
    console.error(`📉 Performance for '${testName}' failed: ${duration.toFixed(2)}ms, error: ${error.message}`);
    
    return {
      result: null,
      duration,
      memoryDelta: 0,
      success: false,
      error
    };
  }
};