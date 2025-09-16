import { performance } from 'perf_hooks';
import { performanceMonitor } from './performance-monitor';

// Global performance test setup
beforeAll(async () => {
  // Start performance monitoring
  performanceMonitor.start();
  
  // Set up global performance tracking
  (global as any).performanceTestStart = performance.now();
  
  // Configure Node.js for optimal performance testing
  process.env.NODE_ENV = 'test';
  
  // Increase memory limit warnings
  process.setMaxListeners(0);
  
  console.log('🚀 Performance test environment initialized');
});

afterAll(async () => {
  // Stop performance monitoring
  performanceMonitor.stop();
  
  const totalTestTime = performance.now() - (global as any).performanceTestStart;
  console.log(`📊 Total performance test execution time: ${totalTestTime.toFixed(2)}ms`);
  
  // Generate final performance report
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 300000); // Last 5 minutes
  
  try {
    const report = performanceMonitor.generateReport({
      start: startTime,
      end: endTime
    });
    
    console.log('\n📈 Performance Test Summary:');
    console.log(`  Total Metrics Collected: ${report.summary?.totalMetrics || 0}`);
    console.log(`  Active Alerts: ${report.alerts?.length || 0}`);
    console.log(`  Overall Status: ${report.alerts?.length > 0 ? '⚠️  Warning' : '✅ Good'}`);
    
    if (report.recommendations?.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec: string, index: number) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }
  } catch (error) {
    console.log('⚠️  Could not generate performance report:', error.message);
  }
});

// Set up test-specific timeouts and cleanup
beforeEach(async () => {
  // Clear any cached data that might affect performance
  if (global.gc) {
    global.gc();
  }
  
  // Record test start metrics
  const testName = expect.getState()?.currentTestName || 'unknown-test';
  performanceMonitor.recordMetric({
    type: 'custom',
    name: 'test.started',
    value: performance.now(),
    unit: 'ms',
    tags: { testName }
  });
});

afterEach(async () => {
  // Record test completion metrics
  const testName = expect.getState()?.currentTestName || 'unknown-test';
  performanceMonitor.recordMetric({
    type: 'custom',
    name: 'test.completed',
    value: performance.now(),
    unit: 'ms',
    tags: { testName }
  });
  
  // Allow async cleanup
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Global error handling for performance tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in performance test:', reason);
  
  performanceMonitor.recordMetric({
    type: 'custom',
    name: 'test.error.unhandledRejection',
    value: 1,
    unit: 'count',
    metadata: { reason: String(reason) }
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in performance test:', error);
  
  performanceMonitor.recordMetric({
    type: 'custom',
    name: 'test.error.uncaughtException',
    value: 1,
    unit: 'count',
    metadata: { error: error.message }
  });
});

// Memory monitoring for performance tests
const memoryCheckInterval = setInterval(() => {
  const memUsage = process.memoryUsage();
  const memoryUsageMB = memUsage.heapUsed / 1024 / 1024;
  
  // Alert if memory usage is too high
  if (memoryUsageMB > 1000) { // 1GB
    console.warn(`⚠️  High memory usage detected: ${memoryUsageMB.toFixed(2)}MB`);
    
    performanceMonitor.recordMetric({
      type: 'memory',
      name: 'test.memory.warning',
      value: memoryUsageMB,
      unit: 'MB'
    });
  }
}, 10000); // Check every 10 seconds

// Cleanup memory monitoring on exit
process.on('exit', () => {
  clearInterval(memoryCheckInterval);
});