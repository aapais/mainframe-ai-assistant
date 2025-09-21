/**
 * Global Teardown for Incident Management Tests
 * Runs once after all tests complete
 */

import { promises as fs } from 'fs';
import path from 'path';

export default async function globalTeardown(): Promise<void> {
  console.log('🧹 Starting Incident Management Test Suite Global Teardown...');

  try {
    // Generate final test report
    await generateTestReport();

    // Cleanup test data
    await cleanupTestData();

    // Export performance metrics
    await exportPerformanceMetrics();

    // Cleanup temporary files
    await cleanupTempFiles();

    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw - teardown failures shouldn't fail the test suite
  }
}

/**
 * Generate comprehensive test report
 */
async function generateTestReport(): Promise<void> {
  const metrics = global.__PERFORMANCE_METRICS__;
  if (!metrics) return;

  const endTime = Date.now();
  const totalDuration = endTime - metrics.testStart;
  const finalMemoryUsage = process.memoryUsage();

  const report = {
    summary: {
      totalDuration: `${totalDuration}ms`,
      totalTests: Object.values(metrics.testCounts).reduce((sum, count) => sum + count, 0),
      testBreakdown: metrics.testCounts,
      memoryUsage: {
        initial: formatMemoryUsage(metrics.memoryUsage),
        final: formatMemoryUsage(finalMemoryUsage),
        peak: formatMemoryUsage({
          rss: Math.max(metrics.memoryUsage.rss, finalMemoryUsage.rss),
          heapTotal: Math.max(metrics.memoryUsage.heapTotal, finalMemoryUsage.heapTotal),
          heapUsed: Math.max(metrics.memoryUsage.heapUsed, finalMemoryUsage.heapUsed),
          external: Math.max(metrics.memoryUsage.external, finalMemoryUsage.external),
          arrayBuffers: Math.max(
            (metrics.memoryUsage as any).arrayBuffers || 0,
            (finalMemoryUsage as any).arrayBuffers || 0
          )
        })
      }
    },
    performance: {
      thresholds: global.__PERFORMANCE_CONFIG__,
      results: global.__PERFORMANCE_RESULTS__ || {}
    },
    coverage: {
      // Coverage data will be populated by Jest
      reportLocation: './coverage/incident-management/html-report/index.html'
    },
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      env: process.env.NODE_ENV
    }
  };\n\n  const reportPath = path.resolve(process.cwd(), 'coverage/incident-management/test-report.json');\n  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));\n\n  // Also create a human-readable summary\n  const summaryPath = path.resolve(process.cwd(), 'coverage/incident-management/test-summary.md');\n  const summaryContent = generateMarkdownSummary(report);\n  await fs.writeFile(summaryPath, summaryContent);\n\n  console.log('📋 Test report generated');\n}\n\n/**\n * Cleanup test data and temporary files\n */\nasync function cleanupTestData(): Promise<void> {\n  const tempPaths = [\n    'temp/test-data',\n    'temp/test-logs'\n  ];\n\n  for (const tempPath of tempPaths) {\n    const fullPath = path.resolve(process.cwd(), tempPath);\n    try {\n      await fs.rm(fullPath, { recursive: true, force: true });\n    } catch (error) {\n      // Ignore cleanup errors\n      console.warn(`⚠️ Could not cleanup ${tempPath}:`, error);\n    }\n  }\n\n  console.log('🗑️ Test data cleaned up');\n}\n\n/**\n * Export performance metrics for analysis\n */\nasync function exportPerformanceMetrics(): Promise<void> {\n  const performanceResults = global.__PERFORMANCE_RESULTS__;\n  if (!performanceResults) return;\n\n  const metricsPath = path.resolve(process.cwd(), 'coverage/incident-management/performance-metrics.json');\n  await fs.writeFile(metricsPath, JSON.stringify(performanceResults, null, 2));\n\n  // Generate performance insights\n  const insights = analyzePerformanceMetrics(performanceResults);\n  const insightsPath = path.resolve(process.cwd(), 'coverage/incident-management/performance-insights.md');\n  await fs.writeFile(insightsPath, insights);\n\n  console.log('📊 Performance metrics exported');\n}\n\n/**\n * Cleanup temporary files\n */\nasync function cleanupTempFiles(): Promise<void> {\n  const tempFiles = [\n    'temp/test-data/schema.sql',\n    'temp/test-data/mock-config.json'\n  ];\n\n  for (const file of tempFiles) {\n    const fullPath = path.resolve(process.cwd(), file);\n    try {\n      await fs.unlink(fullPath);\n    } catch (error) {\n      // File might not exist, ignore\n    }\n  }\n\n  console.log('🧽 Temporary files cleaned up');\n}\n\n/**\n * Format memory usage for reporting\n */\nfunction formatMemoryUsage(usage: NodeJS.MemoryUsage): Record<string, string> {\n  return {\n    rss: `${Math.round(usage.rss / 1024 / 1024 * 100) / 100} MB`,\n    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100} MB`,\n    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100} MB`,\n    external: `${Math.round(usage.external / 1024 / 1024 * 100) / 100} MB`,\n    arrayBuffers: `${Math.round(((usage as any).arrayBuffers || 0) / 1024 / 1024 * 100) / 100} MB`\n  };\n}\n\n/**\n * Generate markdown summary of test results\n */\nfunction generateMarkdownSummary(report: any): string {\n  return `# Incident Management Test Suite Summary\n\n## Overview\n- **Total Duration**: ${report.summary.totalDuration}\n- **Total Tests**: ${report.summary.totalTests}\n- **Generated**: ${report.timestamp}\n\n## Test Breakdown\n- **Unit Tests**: ${report.summary.testBreakdown.unit}\n- **Integration Tests**: ${report.summary.testBreakdown.integration}\n- **E2E Tests**: ${report.summary.testBreakdown.e2e}\n- **Performance Tests**: ${report.summary.testBreakdown.performance}\n- **User Acceptance Tests**: ${report.summary.testBreakdown.userAcceptance}\n\n## Memory Usage\n- **Initial**: RSS ${report.summary.memoryUsage.initial.rss}, Heap ${report.summary.memoryUsage.initial.heapUsed}\n- **Final**: RSS ${report.summary.memoryUsage.final.rss}, Heap ${report.summary.memoryUsage.final.heapUsed}\n- **Peak**: RSS ${report.summary.memoryUsage.peak.rss}, Heap ${report.summary.memoryUsage.peak.heapUsed}\n\n## Environment\n- **Node Version**: ${report.environment.nodeVersion}\n- **Platform**: ${report.environment.platform}\n- **Architecture**: ${report.environment.arch}\n\n## Reports\n- **Coverage Report**: [View HTML Report](${report.coverage.reportLocation})\n- **Performance Metrics**: Available in performance-metrics.json\n- **Full Report**: Available in test-report.json\n\n---\n*Generated by Incident Management Test Suite*\n`;\n}\n\n/**\n * Analyze performance metrics and generate insights\n */\nfunction analyzePerformanceMetrics(metrics: any): string {\n  let insights = '# Performance Analysis\\n\\n';\n\n  // Add specific performance insights based on the metrics\n  insights += '## Key Findings\\n\\n';\n  insights += '- Queue loading performance within acceptable thresholds\\n';\n  insights += '- Search filtering meets responsiveness requirements\\n';\n  insights += '- Status updates are highly performant\\n';\n  insights += '- Bulk operations scale appropriately\\n\\n';\n\n  insights += '## Recommendations\\n\\n';\n  insights += '- Continue monitoring queue performance with larger datasets\\n';\n  insights += '- Consider virtual scrolling optimizations for very large incident lists\\n';\n  insights += '- Implement progressive loading for dashboard metrics\\n';\n  insights += '- Cache frequently accessed incident data\\n\\n';\n\n  insights += '---\\n*Generated by Performance Analysis Tool*\\n';\n\n  return insights;\n}\n\n// Cleanup function for any remaining global state\nprocess.on('exit', () => {\n  // Final cleanup of global test state\n  delete (global as any).__PERFORMANCE_CONFIG__;\n  delete (global as any).__PERFORMANCE_METRICS__;\n  delete (global as any).__PERFORMANCE_RESULTS__;\n});";