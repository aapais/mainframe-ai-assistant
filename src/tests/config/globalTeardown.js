/**
 * Global Jest Teardown for SSO Tests
 */

const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('🧹 Cleaning up test environment...');

  // Generate performance report
  if (global.__TEST_PERFORMANCE__) {
    const performanceData = global.__TEST_PERFORMANCE__;
    performanceData.endTime = Date.now();
    performanceData.totalDuration = performanceData.endTime - performanceData.startTime;
    performanceData.memory.final = process.memoryUsage();
    performanceData.memory.difference = {
      heapUsed: performanceData.memory.final.heapUsed - performanceData.memory.initial.heapUsed,
      heapTotal: performanceData.memory.final.heapTotal - performanceData.memory.initial.heapTotal,
      external: performanceData.memory.final.external - performanceData.memory.initial.external
    };

    const reportPath = path.join(__dirname, '..', 'test-artifacts', 'performance-report.json');
    try {
      fs.writeFileSync(reportPath, JSON.stringify(performanceData, null, 2));
      console.log(`📊 Performance report generated: ${reportPath}`);
    } catch (error) {
      console.warn('⚠️  Could not generate performance report:', error.message);
    }
  }

  // Clean up temporary test files
  const tempDir = path.join(__dirname, '..', 'temp');
  if (fs.existsSync(tempDir)) {
    try {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);

        // Remove files older than 1 hour or with specific test patterns
        const isOld = Date.now() - stats.mtime.getTime() > 3600000;
        const isTestFile = file.startsWith('test-') || file.includes('temp-');

        if (isOld || isTestFile) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not clean temporary files:', error.message);
    }
  }

  // Generate test summary report
  const summaryData = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    },
    testSession: {
      duration: global.__TEST_PERFORMANCE__?.totalDuration || 0,
      memoryUsage: global.__TEST_PERFORMANCE__?.memory || {},
      environment: 'test'
    },
    coverage: {
      // This would be populated by Jest coverage data
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90
      }
    }
  };

  const summaryPath = path.join(__dirname, '..', 'test-artifacts', 'test-summary.json');
  try {
    fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
    console.log(`📋 Test summary generated: ${summaryPath}`);
  } catch (error) {
    console.warn('⚠️  Could not generate test summary:', error.message);
  }

  // Clean up global test variables
  delete global.__TEST_PERFORMANCE__;
  delete global.__TEST_KEYS__;

  // Reset environment variables
  delete process.env.JWT_SECRET;
  delete process.env.OAUTH_CLIENT_ID;
  delete process.env.OAUTH_CLIENT_SECRET;
  delete process.env.TEST_DATABASE_URL;

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  console.log('✅ Test environment cleanup complete');
};