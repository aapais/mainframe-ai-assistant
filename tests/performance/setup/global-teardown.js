/**
 * Global Performance Test Teardown
 * Runs after all performance tests complete
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('\n🧹 Cleaning up Performance Test Environment...');
  
  // Calculate total test duration
  const totalDuration = Date.now() - (global.PERFORMANCE_TEST_START || Date.now());
  
  console.log(`✓ Total test execution time: ${Math.round(totalDuration / 1000)}s`);
  
  // Force garbage collection one final time
  if (global.gc) {
    global.gc();
    console.log('✓ Final garbage collection performed');
  }
  
  // Generate final environment report
  const environmentReport = {
    timestamp: new Date().toISOString(),
    totalDuration,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    },
    testConfiguration: {
      nodeOptions: process.env.NODE_OPTIONS,
      performanceTest: process.env.PERFORMANCE_TEST,
      nodeEnv: process.env.NODE_ENV
    }
  };
  
  try {
    const reportPath = path.join(__dirname, '..', 'reports', `environment-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(environmentReport, null, 2));
    console.log(`✓ Environment report saved: ${path.basename(reportPath)}`);
  } catch (error) {
    console.error('Failed to save environment report:', error.message);
  }
  
  console.log('🎆 Performance test cleanup complete!\n');
};
