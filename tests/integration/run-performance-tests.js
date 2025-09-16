#!/usr/bin/env node

/**
 * Performance Test Runner
 * Execute comprehensive performance and load tests
 */

const ComprehensivePerformanceSuite = require('./comprehensive-performance-suite');
const fs = require('fs').promises;
const path = require('path');

async function runPerformanceTests() {
  console.log('🚀 Starting Comprehensive Performance Test Suite');
  console.log('==================================================');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Node.js version: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Memory: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB available`);
  console.log('');

  const startTime = Date.now();

  try {
    // Initialize performance test suite
    const perfSuite = new ComprehensivePerformanceSuite({
      fts5TestEntries: 75, // 50+ KB entries for FTS5 testing
      ipcLatencyTarget: 10, // < 10ms target
      dashboardLogCount: 1200, // 1000+ operation logs
      aiAuthorizationTarget: 100, // < 100ms target
      memoryTestDataSize: 150 * 1024 * 1024, // 150MB test data
      concurrentSearches: 15, // 10+ simultaneous operations
      startupTimeTarget: 5000 // < 5s startup time
    });

    // Add event listeners for progress tracking
    perfSuite.on('testStart', (testName) => {
      console.log(`\n🧪 Starting ${testName}...`);
    });

    perfSuite.on('testComplete', (testName, duration) => {
      console.log(`✅ ${testName} completed in ${duration.toFixed(2)}ms`);
    });

    perfSuite.on('progress', (message) => {
      console.log(`  ${message}`);
    });

    // Run all performance tests
    const results = await perfSuite.runAllTests();

    // Calculate total execution time
    const totalTime = Date.now() - startTime;
    results.executionTime = totalTime;

    // Generate performance report
    await generatePerformanceReport(results);

    // Display summary
    displaySummary(results, totalTime);

    // Exit with appropriate code
    const success = results.summary.testsPassed === results.summary.testsTotal;
    process.exit(success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Performance test suite failed:');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Generate comprehensive performance report
 */
async function generatePerformanceReport(results) {
  const reportDir = path.join(process.cwd(), 'tests/integration');
  const reportPath = path.join(reportDir, 'performance-report.md');

  console.log('\n📊 Generating performance report...');

  const report = generateMarkdownReport(results);

  try {
    await fs.writeFile(reportPath, report, 'utf8');
    console.log(`✅ Performance report saved to: ${reportPath}`);
  } catch (error) {
    console.error('❌ Failed to save performance report:', error);
  }

  // Also save raw JSON data
  const jsonPath = path.join(reportDir, 'performance-results.json');
  try {
    await fs.writeFile(jsonPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`✅ Raw performance data saved to: ${jsonPath}`);
  } catch (error) {
    console.error('❌ Failed to save performance data:', error);
  }
}

/**
 * Generate Markdown performance report
 */
function generateMarkdownReport(results) {
  const timestamp = new Date(results.timestamp).toLocaleString();

  return `# Performance and Load Test Report

**Generated:** ${timestamp}
**Execution Time:** ${(results.executionTime / 1000).toFixed(2)} seconds
**Overall Grade:** ${results.summary.performanceGrade}
**Tests Passed:** ${results.summary.testsPassed}/${results.summary.testsTotal}

## Executive Summary

${results.summary.overallPerformance === 'Good' ? '✅' : results.summary.overallPerformance === 'Acceptable' ? '⚠️' : '❌'} **Overall Performance:** ${results.summary.overallPerformance}

${results.summary.criticalIssues.length === 0 ?
  '✅ No critical performance issues detected.' :
  `❌ **Critical Issues Found:** ${results.summary.criticalIssues.length}\n${results.summary.criticalIssues.map(issue => `- ${issue}`).join('\n')}`
}

## Test Results Summary

| Test | Status | Key Metric | Target | Result |
|------|--------|------------|--------|--------|
| FTS5 Search Performance | ${getTestStatus(results.tests.fts5Performance)} | Avg Response Time | < 1000ms | ${formatTestMetric(results.tests.fts5Performance, 'averageResponseTime')}ms |
| IPC Communication Latency | ${getTestStatus(results.tests.ipcLatency)} | P95 Latency | < ${results.config.ipcLatencyTarget}ms | ${formatTestMetric(results.tests.ipcLatency, 'overallP95')}ms |
| Dashboard Rendering | ${getTestStatus(results.tests.dashboardRendering)} | Max Render Time | < 2000ms | ${formatTestMetric(results.tests.dashboardRendering, 'maxRenderTime')}ms |
| AI Authorization | ${getTestStatus(results.tests.aiAuthorization)} | P95 Decision Time | < ${results.config.aiAuthorizationTarget}ms | ${formatTestMetric(results.tests.aiAuthorization, 'overallP95')}ms |
| Memory Usage | ${getTestStatus(results.tests.memoryUsage)} | Memory Leaks | 0 | ${formatTestMetric(results.tests.memoryUsage, 'memoryLeaksDetected')} |
| Concurrent Operations | ${getTestStatus(results.tests.concurrentOperations)} | Max Concurrent | ${results.config.concurrentSearches}+ | ${formatTestMetric(results.tests.concurrentOperations, 'maxConcurrencyHandled')} |
| Startup Performance | ${getTestStatus(results.tests.startupPerformance)} | P95 Startup | < ${results.config.startupTimeTarget}ms | ${formatTestMetric(results.tests.startupPerformance, 'p95Startup')}ms |

## Detailed Test Results

### 1. FTS5 Search Performance with Large Entries

**Objective:** Test search performance with 50+ KB entries using FTS5 full-text search.

**Configuration:**
- Test entries: ${results.config.fts5TestEntries}
- Average entry size: ${results.tests.fts5Performance?.metrics ? formatBytes(results.tests.fts5Performance.metrics.averageEntrySize) : 'N/A'}
- Total dataset size: ${results.tests.fts5Performance?.metrics ? formatBytes(results.tests.fts5Performance.metrics.totalEntrySize) : 'N/A'}

**Results:**
${results.tests.fts5Performance?.searchResults ? results.tests.fts5Performance.searchResults.map(sr =>
  `- **${sr.query}:** ${sr.responseTime.toFixed(2)}ms (${sr.resultCount} results) ${sr.performsWell ? '✅' : '❌'}`
).join('\n') : '❌ Test failed to execute'}

**Metrics:**
- Average Response Time: ${results.tests.fts5Performance?.metrics?.averageResponseTime?.toFixed(2) || 'N/A'}ms
- P95 Response Time: ${results.tests.fts5Performance?.metrics?.p95ResponseTime?.toFixed(2) || 'N/A'}ms
- Max Response Time: ${results.tests.fts5Performance?.metrics?.maxResponseTime?.toFixed(2) || 'N/A'}ms

### 2. IPC Communication Latency

**Objective:** Measure inter-process communication latency between main and renderer processes.

**Results:**
${results.tests.ipcLatency?.measurements ? results.tests.ipcLatency.measurements.map(m =>
  `- **${m.description}:** Avg ${m.average.toFixed(2)}ms, P95 ${m.p95.toFixed(2)}ms ${m.average < results.config.ipcLatencyTarget ? '✅' : '❌'}`
).join('\n') : '❌ Test failed to execute'}

**Overall Metrics:**
- Average Latency: ${results.tests.ipcLatency?.metrics?.overallAverage?.toFixed(2) || 'N/A'}ms
- P95 Latency: ${results.tests.ipcLatency?.metrics?.overallP95?.toFixed(2) || 'N/A'}ms
- Target Met: ${results.tests.ipcLatency?.metrics?.meetsTarget ? '✅ Yes' : '❌ No'}

### 3. Dashboard Rendering Performance

**Objective:** Test dashboard rendering with 1000+ operation logs.

**Configuration:**
- Operation logs: ${results.config.dashboardLogCount}
- Total data size: ${results.tests.dashboardRendering?.logData ? formatBytes(results.tests.dashboardRendering.logData.totalSize) : 'N/A'}

**Results:**
${results.tests.dashboardRendering?.renderingTests ? results.tests.dashboardRendering.renderingTests.map(rt =>
  `- **${rt.description}:** ${rt.renderTime.toFixed(2)}ms (${rt.logCount} logs) ${rt.performsWell ? '✅' : '❌'}`
).join('\n') : '❌ Test failed to execute'}

**Metrics:**
- Average Render Time: ${results.tests.dashboardRendering?.metrics?.averageRenderTime?.toFixed(2) || 'N/A'}ms
- Max Render Time: ${results.tests.dashboardRendering?.metrics?.maxRenderTime?.toFixed(2) || 'N/A'}ms
- Memory Efficient: ${results.tests.dashboardRendering?.metrics?.memoryEfficient ? '✅ Yes' : '❌ No'}

### 4. AI Authorization Decision Time

**Objective:** Ensure AI authorization decisions complete within 100ms.

**Results:**
${results.tests.aiAuthorization?.authorizationTests ? results.tests.aiAuthorization.authorizationTests.map(at =>
  `- **${at.description}:** Avg ${at.average.toFixed(2)}ms, P95 ${at.p95.toFixed(2)}ms ${at.meetsTarget ? '✅' : '❌'}`
).join('\n') : '❌ Test failed to execute'}

**Metrics:**
- Overall Average: ${results.tests.aiAuthorization?.metrics?.overallAverage?.toFixed(2) || 'N/A'}ms
- Overall P95: ${results.tests.aiAuthorization?.metrics?.overallP95?.toFixed(2) || 'N/A'}ms
- Pass Rate: ${results.tests.aiAuthorization?.metrics?.passRate?.toFixed(1) || 'N/A'}%

### 5. Memory Usage with Large Datasets

**Objective:** Monitor memory usage and detect memory leaks with large datasets.

**Results:**
${results.tests.memoryUsage?.memoryTests ? results.tests.memoryUsage.memoryTests.map(mt =>
  `- **${mt.description}:** ${formatBytes(mt.memoryDelta)} delta, ${formatBytes(mt.memoryRetained)} retained ${mt.leakDetected ? '❌ Leak detected' : '✅'}`
).join('\n') : '❌ Test failed to execute'}

**Metrics:**
- Max Memory Used: ${results.tests.memoryUsage?.metrics ? formatBytes(results.tests.memoryUsage.metrics.totalMemoryUsed) : 'N/A'}
- Memory Leaks Detected: ${results.tests.memoryUsage?.metrics?.memoryLeaksDetected || 'N/A'}
- Average Efficiency: ${results.tests.memoryUsage?.metrics?.averageEfficiency?.toFixed(2) || 'N/A'}%

### 6. Concurrent Operations Stress Test

**Objective:** Handle 10+ simultaneous search operations efficiently.

**Results:**
${results.tests.concurrentOperations?.concurrencyTests ? results.tests.concurrentOperations.concurrencyTests.map(ct =>
  `- **${ct.concurrency} concurrent:** ${ct.successRate.toFixed(1)}% success, ${ct.averageResponseTime.toFixed(2)}ms avg ${ct.performsWell ? '✅' : '❌'}`
).join('\n') : '❌ Test failed to execute'}

**Metrics:**
- Max Concurrency Handled: ${results.tests.concurrentOperations?.metrics?.maxConcurrencyHandled || 'N/A'}
- Best Throughput: ${results.tests.concurrentOperations?.metrics?.bestThroughput?.toFixed(2) || 'N/A'} ops/sec
- Degradation Point: ${results.tests.concurrentOperations?.metrics?.degradationPoint || 'Not found'}

### 7. Startup Time and Initial Load Performance

**Objective:** Achieve consistent startup times under 5 seconds.

**Results:**
${results.tests.startupPerformance?.startupTests ? results.tests.startupPerformance.startupTests.map(st =>
  `- **${st.description}:** ${st.averageStartupTime.toFixed(2)}ms avg ${st.meetsTarget ? '✅' : '❌'}`
).join('\n') : '❌ Test failed to execute'}

**Metrics:**
- Average Startup: ${results.tests.startupPerformance?.metrics?.averageStartup?.toFixed(2) || 'N/A'}ms
- P95 Startup: ${results.tests.startupPerformance?.metrics?.p95Startup?.toFixed(2) || 'N/A'}ms
- Consistency: ${results.tests.startupPerformance?.metrics?.consistentPerformance ? '✅ Good' : '❌ Poor'}

## Performance Bottlenecks and Recommendations

${results.recommendations.length > 0 ?
  results.recommendations.map(rec =>
    `### ${rec.category} (${rec.priority} Priority)

**Issue:** ${rec.issue}
**Recommendation:** ${rec.recommendation}
**Estimated Impact:** ${rec.estimatedImpact}
`).join('\n') :
  '✅ No significant performance bottlenecks identified.'
}

## Optimization Recommendations

### Immediate Actions (High Priority)
${results.recommendations.filter(r => r.priority === 'High').map(r => `- ${r.recommendation}`).join('\n') || '- No high priority actions required'}

### Performance Improvements (Medium Priority)
${results.recommendations.filter(r => r.priority === 'Medium').map(r => `- ${r.recommendation}`).join('\n') || '- No medium priority actions required'}

### Future Optimizations (Low Priority)
${results.recommendations.filter(r => r.priority === 'Low').map(r => `- ${r.recommendation}`).join('\n') || '- No low priority actions required'}

## Test Environment

- **Node.js Version:** ${process.version}
- **Platform:** ${process.platform} ${process.arch}
- **Memory Available:** ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB
- **Test Duration:** ${(results.executionTime / 1000).toFixed(2)} seconds

## Conclusion

${results.summary.overallPerformance === 'Good'
  ? '✅ The system demonstrates good performance across all tested scenarios. Continue monitoring and consider the recommended optimizations for further improvements.'
  : results.summary.overallPerformance === 'Acceptable'
  ? '⚠️ The system shows acceptable performance with some areas for improvement. Address the identified bottlenecks to achieve optimal performance.'
  : '❌ The system has significant performance issues that require immediate attention. Prioritize the high-priority recommendations to improve user experience.'
}

---
*Report generated by Performance Test Suite v1.0*
`;
}

/**
 * Display test summary in console
 */
function displaySummary(results, totalTime) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 PERFORMANCE TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Overall Grade: ${results.summary.performanceGrade}`);
  console.log(`Tests Passed: ${results.summary.testsPassed}/${results.summary.testsTotal}`);
  console.log(`Execution Time: ${(totalTime / 1000).toFixed(2)} seconds`);
  console.log(`Status: ${results.summary.overallPerformance}`);

  if (results.summary.criticalIssues.length > 0) {
    console.log('\n❌ Critical Issues:');
    results.summary.criticalIssues.forEach(issue => {
      console.log(`  - ${issue}`);
    });
  }

  if (results.recommendations.length > 0) {
    console.log('\n💡 Key Recommendations:');
    results.recommendations.slice(0, 3).forEach(rec => {
      console.log(`  - [${rec.priority}] ${rec.recommendation}`);
    });
  }

  console.log('\n✅ Performance report generated successfully!');
  console.log('📄 Check tests/integration/performance-report.md for detailed analysis');
}

// Helper functions
function getTestStatus(testResult) {
  if (!testResult) return '❌ Failed';
  if (testResult.error) return '❌ Error';
  return '✅ Passed';
}

function formatTestMetric(testResult, metricPath) {
  if (!testResult || !testResult.metrics) return 'N/A';

  const value = testResult.metrics[metricPath];
  if (value === undefined || value === null) return 'N/A';

  if (typeof value === 'number') {
    return value.toFixed(2);
  }

  return value.toString();
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run tests if called directly
if (require.main === module) {
  runPerformanceTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  runPerformanceTests,
  generatePerformanceReport
};