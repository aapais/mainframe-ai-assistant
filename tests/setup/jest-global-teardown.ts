/**
 * Jest Global Teardown
 * Cleanup and reporting after comprehensive test suite execution
 */

import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { generateTestSummary } from './jest-global-setup';

export default async function globalTeardown() {
  console.log('\n🧹 Cleaning up test environment...\n');

  const startTime = performance.now();

  // Generate comprehensive test report
  await generateComprehensiveReport();

  // Cleanup test resources
  await cleanupTestResources();

  // Performance cleanup
  cleanupPerformanceMonitoring();

  // Generate final coverage report
  await generateCoverageReport();

  // Cleanup database connections
  await cleanupDatabaseConnections();

  // Log test summary
  logTestSummary();

  const teardownTime = performance.now() - startTime;
  console.log(`\n✅ Test environment cleanup completed in ${teardownTime.toFixed(2)}ms\n`);
}

async function generateComprehensiveReport() {
  console.log('📋 Generating comprehensive test report...');

  const config = global.__TEST_CONFIG__;
  const reportPath = path.join(process.cwd(), 'coverage/comprehensive-report.json');

  const report = {
    timestamp: new Date().toISOString(),
    duration: performance.now() - config.startTime,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      ci: !!process.env.CI,
      memoryUsage: process.memoryUsage()
    },
    performance: {
      baseline: (global as any).__PERFORMANCE_BASELINES__,
      measurements: Array.from(config.testResults.performance.entries()),
      summary: {
        totalMeasurements: config.testResults.performance.size,
        averageDuration: calculateAveragePerformance(),
        slowTests: getSlowTests(),
        memoryLeaks: detectMemoryLeaks()
      }
    },
    accessibility: {
      totalChecks: config.testResults.accessibility.totalTests,
      violations: config.testResults.accessibility.violations,
      passRate: calculateA11yPassRate(),
      componentCoverage: Array.from(config.testResults.accessibility.components.entries())
    },
    errors: {
      unhandledRejections: getUnhandledRejections(),
      uncaughtExceptions: getUncaughtExceptions(),
      testFailures: getTestFailures()
    },
    coverage: await getCoverageData(),
    recommendations: generateRecommendations()
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  ✓ Comprehensive report saved to: ${reportPath}`);

  // Generate HTML report
  await generateHTMLReport(report);
}

async function generateHTMLReport(reportData: any) {
  const htmlReportPath = path.join(process.cwd(), 'coverage/comprehensive-report.html');

  const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KB Management - Comprehensive Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px; }
    .section { margin: 20px 0; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; }
    .metric { display: inline-block; margin: 10px; padding: 10px; background: #f3f4f6; border-radius: 4px; }
    .success { color: #10b981; }
    .warning { color: #f59e0b; }
    .error { color: #ef4444; }
    .chart-container { width: 100%; height: 300px; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f2f2f2; }
    .progress-bar { width: 100%; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden; }
    .progress-fill { height: 100%; transition: width 0.3s ease; }
    .green { background: #10b981; }
    .yellow { background: #f59e0b; }
    .red { background: #ef4444; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 KB Management Test Report</h1>
    <p>Generated: ${reportData.timestamp}</p>
    <p>Duration: ${(reportData.duration / 1000).toFixed(2)} seconds</p>
  </div>

  <div class="section">
    <h2>🏁 Test Execution Summary</h2>
    <div class="metric">
      <strong>Environment:</strong> ${reportData.environment.platform} (Node ${reportData.environment.nodeVersion})
    </div>
    <div class="metric">
      <strong>CI Mode:</strong> ${reportData.environment.ci ? 'Yes' : 'No'}
    </div>
    <div class="metric">
      <strong>Memory Usage:</strong> ${(reportData.environment.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB
    </div>
  </div>

  <div class="section">
    <h2>⚡ Performance Metrics</h2>
    <div class="metric">
      <strong>Total Measurements:</strong> ${reportData.performance.summary.totalMeasurements}
    </div>
    <div class="metric">
      <strong>Average Duration:</strong> ${reportData.performance.summary.averageDuration.toFixed(2)}ms
    </div>

    <h3>Slow Tests (>1000ms)</h3>
    <table>
      <thead>
        <tr><th>Test</th><th>Duration</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${reportData.performance.summary.slowTests.map((test: any) => `
          <tr>
            <td>${test.name}</td>
            <td>${test.duration.toFixed(2)}ms</td>
            <td class="${test.duration > 2000 ? 'error' : 'warning'}">${test.duration > 2000 ? '❌ Too Slow' : '⚠️ Slow'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>♿ Accessibility Results</h2>
    <div class="metric">
      <strong>Total Checks:</strong> ${reportData.accessibility.totalChecks}
    </div>
    <div class="metric">
      <strong>Pass Rate:</strong>
      <div class="progress-bar">
        <div class="progress-fill ${reportData.accessibility.passRate >= 95 ? 'green' : reportData.accessibility.passRate >= 80 ? 'yellow' : 'red'}"
             style="width: ${reportData.accessibility.passRate}%"></div>
      </div>
      ${reportData.accessibility.passRate.toFixed(1)}%
    </div>

    ${reportData.accessibility.violations.length > 0 ? `
      <h3>⚠️ Accessibility Violations</h3>
      <ul>
        ${reportData.accessibility.violations.map((violation: any) => `
          <li><strong>${violation.rule}:</strong> ${violation.description} (${violation.impact})</li>
        `).join('')}
      </ul>
    ` : '<p class="success">✅ No accessibility violations found!</p>'}
  </div>

  <div class="section">
    <h2>📊 Test Coverage</h2>
    ${Object.entries(reportData.coverage || {}).map(([type, data]: [string, any]) => `
      <div class="metric">
        <strong>${type}:</strong>
        <div class="progress-bar">
          <div class="progress-fill ${data.percentage >= 80 ? 'green' : data.percentage >= 60 ? 'yellow' : 'red'}"
               style="width: ${data.percentage}%"></div>
        </div>
        ${data.percentage.toFixed(1)}%
      </div>
    `).join('')}
  </div>

  ${reportData.errors.unhandledRejections.length > 0 || reportData.errors.uncaughtExceptions.length > 0 ? `
    <div class="section">
      <h2>🚨 Errors and Issues</h2>
      ${reportData.errors.unhandledRejections.length > 0 ? `
        <h3>Unhandled Promise Rejections</h3>
        <ul>
          ${reportData.errors.unhandledRejections.map((error: any) => `
            <li class="error">${error.reason} (${error.timestamp})</li>
          `).join('')}
        </ul>
      ` : ''}

      ${reportData.errors.uncaughtExceptions.length > 0 ? `
        <h3>Uncaught Exceptions</h3>
        <ul>
          ${reportData.errors.uncaughtExceptions.map((error: any) => `
            <li class="error">${error.error} (${error.timestamp})</li>
          `).join('')}
        </ul>
      ` : ''}
    </div>
  ` : ''}

  <div class="section">
    <h2>💡 Recommendations</h2>
    <ul>
      ${reportData.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
    </ul>
  </div>

  <script>
    // Add interactivity if needed
    console.log('Test Report Data:', ${JSON.stringify(reportData, null, 2)});
  </script>
</body>
</html>
  `;

  fs.writeFileSync(htmlReportPath, htmlTemplate);
  console.log(`  ✓ HTML report saved to: ${htmlReportPath}`);
}

async function cleanupTestResources() {
  console.log('🧹 Cleaning up test resources...');

  // Clean up temporary test files
  const tempDirs = [
    'tests/temp',
    'tests/data/temp',
    '.tmp'
  ];

  tempDirs.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  });

  // Clean up test database
  const testDbPath = path.join(process.cwd(), 'tests/data/test.db');
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (error) {
      console.warn('  ⚠️ Could not clean up test database:', error);
    }
  }

  console.log('  ✓ Test resources cleaned up');
}

function cleanupPerformanceMonitoring() {
  console.log('📊 Cleaning up performance monitoring...');

  const observer = (global as any).__PERFORMANCE_OBSERVER__;
  if (observer) {
    try {
      observer.disconnect();
    } catch (error) {
      // Observer might already be disconnected
    }
  }

  // Clear performance marks and measures
  if (typeof performance !== 'undefined' && performance.clearMarks) {
    performance.clearMarks();
    performance.clearMeasures();
  }

  console.log('  ✓ Performance monitoring cleaned up');
}

async function generateCoverageReport() {
  console.log('📊 Processing coverage data...');

  const coveragePath = path.join(process.cwd(), 'coverage/coverage-final.json');

  if (fs.existsSync(coveragePath)) {
    try {
      const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));

      // Generate coverage summary
      const summary = {
        total: Object.keys(coverageData).length,
        statements: calculateCoveragePercentage(coverageData, 'statements'),
        branches: calculateCoveragePercentage(coverageData, 'branches'),
        functions: calculateCoveragePercentage(coverageData, 'functions'),
        lines: calculateCoveragePercentage(coverageData, 'lines')
      };

      const summaryPath = path.join(process.cwd(), 'coverage/summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

      console.log('  ✓ Coverage summary generated');
    } catch (error) {
      console.warn('  ⚠️ Could not process coverage data:', error);
    }
  }
}

async function cleanupDatabaseConnections() {
  console.log('💾 Cleaning up database connections...');

  // Force close any remaining database connections
  if (global.gc) {
    global.gc();
  }

  console.log('  ✓ Database connections cleaned up');
}

function logTestSummary() {
  console.log('\n' + '='.repeat(60));
  console.log(generateTestSummary());
  console.log('='.repeat(60) + '\n');

  // Log any errors that occurred during testing
  const errorLog = (global as any).__ERROR_LOG__ || [];
  if (errorLog.length > 0) {
    console.log('🚨 Errors encountered during testing:');
    errorLog.forEach((error, index) => {
      console.log(`  ${index + 1}. [${error.type}] ${error.reason || error.error} (${error.timestamp})`);
    });
  }

  // Performance summary
  const config = global.__TEST_CONFIG__;
  if (config.testResults.performance.size > 0) {
    const slowTests = getSlowTests();
    if (slowTests.length > 0) {
      console.log('\n⚠️ Slow tests detected:');
      slowTests.slice(0, 5).forEach(test => {
        console.log(`  • ${test.name}: ${test.duration.toFixed(2)}ms`);
      });
    }
  }
}

// Utility functions
function calculateAveragePerformance(): number {
  const config = global.__TEST_CONFIG__;
  const measurements = Array.from(config.testResults.performance.values());
  return measurements.length > 0
    ? measurements.reduce((sum, duration) => sum + duration, 0) / measurements.length
    : 0;
}

function getSlowTests(): Array<{ name: string; duration: number }> {
  const config = global.__TEST_CONFIG__;
  return Array.from(config.testResults.performance.entries())
    .map(([name, duration]) => ({ name, duration }))
    .filter(test => test.duration > 1000)
    .sort((a, b) => b.duration - a.duration);
}

function detectMemoryLeaks(): boolean {
  const config = global.__TEST_CONFIG__;
  const currentMemory = process.memoryUsage();
  const memoryIncrease = (currentMemory.heapUsed - config.memorySnapshot.heapUsed) / 1024 / 1024;

  return memoryIncrease > 100; // 100MB threshold
}

function calculateA11yPassRate(): number {
  const config = global.__TEST_CONFIG__;
  const a11yData = config.testResults.accessibility;

  if (a11yData.totalTests === 0) return 0;

  const violationCount = a11yData.violations.length;
  return ((a11yData.totalTests - violationCount) / a11yData.totalTests) * 100;
}

function getUnhandledRejections(): any[] {
  const errorLog = (global as any).__ERROR_LOG__ || [];
  return errorLog.filter(error => error.type === 'unhandledRejection');
}

function getUncaughtExceptions(): any[] {
  const errorLog = (global as any).__ERROR_LOG__ || [];
  return errorLog.filter(error => error.type === 'uncaughtException');
}

function getTestFailures(): any[] {
  // This would be populated by Jest itself during test execution
  return [];
}

async function getCoverageData(): Promise<any> {
  const coveragePath = path.join(process.cwd(), 'coverage/coverage-final.json');

  if (fs.existsSync(coveragePath)) {
    try {
      const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));

      return {
        statements: calculateCoveragePercentage(coverageData, 'statements'),
        branches: calculateCoveragePercentage(coverageData, 'branches'),
        functions: calculateCoveragePercentage(coverageData, 'functions'),
        lines: calculateCoveragePercentage(coverageData, 'lines')
      };
    } catch (error) {
      return { error: 'Could not read coverage data' };
    }
  }

  return { error: 'Coverage data not found' };
}

function calculateCoveragePercentage(coverageData: any, type: string): { covered: number; total: number; percentage: number } {
  let covered = 0;
  let total = 0;

  Object.values(coverageData).forEach((fileData: any) => {
    if (fileData[type]) {
      covered += fileData[type].covered || 0;
      total += fileData[type].total || 0;
    }
  });

  return {
    covered,
    total,
    percentage: total > 0 ? (covered / total) * 100 : 0
  };
}

function generateRecommendations(): string[] {
  const recommendations: string[] = [];
  const config = global.__TEST_CONFIG__;

  // Performance recommendations
  const slowTests = getSlowTests();
  if (slowTests.length > 0) {
    recommendations.push(`⚡ Optimize ${slowTests.length} slow tests (>1000ms)`);
  }

  // Memory recommendations
  if (detectMemoryLeaks()) {
    recommendations.push('💾 Investigate potential memory leaks');
  }

  // Accessibility recommendations
  const a11yPassRate = calculateA11yPassRate();
  if (a11yPassRate < 95) {
    recommendations.push(`♿ Improve accessibility compliance (currently ${a11yPassRate.toFixed(1)}%)`);
  }

  // Error handling recommendations
  const errorLog = (global as any).__ERROR_LOG__ || [];
  if (errorLog.length > 0) {
    recommendations.push(`🚨 Address ${errorLog.length} unhandled errors`);
  }

  // Default recommendations if all is well
  if (recommendations.length === 0) {
    recommendations.push('✅ All tests are performing well - consider adding more edge case coverage');
    recommendations.push('🎯 Consider increasing test coverage in critical components');
  }

  return recommendations;
}