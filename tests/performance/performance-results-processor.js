/**
 * Performance Test Results Processor
 * Processes Jest test results for performance reporting
 */

const fs = require('fs');
const path = require('path');

/**
 * Process test results and generate performance metrics
 */
function processResults(testResults) {
  const performanceReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: testResults.numTotalTests,
      passedTests: testResults.numPassedTests,
      failedTests: testResults.numFailedTests,
      testSuites: testResults.numTotalTestSuites,
      duration: testResults.testResults.reduce((sum, suite) => sum + (suite.endTime - suite.startTime), 0)
    },
    suites: [],
    performance: {
      responseTime: {
        measurements: [],
        statistics: null
      },
      throughput: {
        measurements: [],
        statistics: null
      },
      slaCompliance: {
        overall: true,
        violations: []
      }
    },
    recommendations: []
  };

  // Process each test suite
  testResults.testResults.forEach(suiteResult => {
    const suite = {
      name: suiteResult.testFilePath.split('/').pop(),
      status: suiteResult.status,
      duration: suiteResult.endTime - suiteResult.startTime,
      tests: [],
      performance: {
        responseTime: [],
        throughput: [],
        errorRate: 0
      }
    };

    // Process individual tests
    suiteResult.assertionResults.forEach(testResult => {
      const test = {
        name: testResult.title,
        status: testResult.status,
        duration: testResult.duration || 0,
        failureMessages: testResult.failureMessages
      };

      // Extract performance metrics from test titles and messages
      extractPerformanceMetrics(testResult, suite.performance);

      suite.tests.push(test);
    });

    // Calculate suite-level statistics
    if (suite.performance.responseTime.length > 0) {
      suite.performance.responseTimeStats = calculateStatistics(suite.performance.responseTime);
    }

    if (suite.performance.throughput.length > 0) {
      suite.performance.throughputStats = calculateStatistics(suite.performance.throughput);
    }

    performanceReport.suites.push(suite);
  });

  // Aggregate performance data
  aggregatePerformanceData(performanceReport);

  // Check SLA compliance
  checkSLACompliance(performanceReport);

  // Generate recommendations
  generateRecommendations(performanceReport);

  // Save performance report
  savePerformanceReport(performanceReport);

  return testResults;
}

/**
 * Extract performance metrics from test results
 */
function extractPerformanceMetrics(testResult, suitePerformance) {
  const title = testResult.title.toLowerCase();
  const messages = testResult.failureMessages.join(' ').toLowerCase();

  // Look for response time metrics in test titles
  const responseTimeMatch = title.match(/(\d+(?:\.\d+)?)\s*ms/);
  if (responseTimeMatch) {
    suitePerformance.responseTime.push(parseFloat(responseTimeMatch[1]));
  }

  // Look for throughput metrics
  const throughputMatch = title.match(/(\d+(?:\.\d+)?)\s*rps/);
  if (throughputMatch) {
    suitePerformance.throughput.push(parseFloat(throughputMatch[1]));
  }

  // Look for error rate metrics
  const errorRateMatch = title.match /(\d+(?:\.\d+)?)\s*%\s*error/);
  if (errorRateMatch) {
    suitePerformance.errorRate = Math.max(suitePerformance.errorRate, parseFloat(errorRateMatch[1]));
  }

  // Extract metrics from failure messages (for failed assertions)
  if (testResult.status === 'failed') {
    messages.forEach(message => {
      // Extract actual vs expected values from matcher failures
      const slaMatch = message.match(/expected (\d+(?:\.\d+)?ms) to be within sla target (\d+ms)/);
      if (slaMatch) {
        suitePerformance.responseTime.push(parseFloat(slaMatch[1]));
      }

      const throughputFailMatch = message.match(/expected (\d+(?:\.\d+)?) rps to meet throughput target/);
      if (throughputFailMatch) {
        suitePerformance.throughput.push(parseFloat(throughputFailMatch[1]));
      }
    });
  }
}

/**
 * Aggregate performance data across all suites
 */
function aggregatePerformanceData(report) {
  const allResponseTimes = [];
  const allThroughput = [];
  let totalErrorRate = 0;
  let suiteCount = 0;

  report.suites.forEach(suite => {
    if (suite.performance.responseTime.length > 0) {
      allResponseTimes.push(...suite.performance.responseTime);
    }

    if (suite.performance.throughput.length > 0) {
      allThroughput.push(...suite.performance.throughput);
    }

    if (suite.performance.errorRate > 0) {
      totalErrorRate += suite.performance.errorRate;
      suiteCount++;
    }
  });

  // Calculate aggregate statistics
  if (allResponseTimes.length > 0) {
    report.performance.responseTime.measurements = allResponseTimes;
    report.performance.responseTime.statistics = calculateStatistics(allResponseTimes);
  }

  if (allThroughput.length > 0) {
    report.performance.throughput.measurements = allThroughput;
    report.performance.throughput.statistics = calculateStatistics(allThroughput);
  }

  if (suiteCount > 0) {
    report.performance.errorRate = totalErrorRate / suiteCount;
  }
}

/**
 * Check SLA compliance
 */
function checkSLACompliance(report) {
  const slaTargets = {
    responseTime: 1000,  // 1 second P95
    throughput: 100,     // 100 RPS
    errorRate: 1,        // 1%
    availability: 99.9   // 99.9%
  };

  let violations = 0;

  // Check response time SLA
  if (report.performance.responseTime.statistics) {
    const p95 = report.performance.responseTime.statistics.p95;
    if (p95 > slaTargets.responseTime) {
      report.performance.slaCompliance.violations.push({
        type: 'responseTime',
        metric: 'P95',
        actual: p95,
        target: slaTargets.responseTime,
        severity: p95 > slaTargets.responseTime * 2 ? 'critical' : 'high'
      });
      violations++;
    }
  }

  // Check throughput SLA
  if (report.performance.throughput.statistics) {
    const maxThroughput = report.performance.throughput.statistics.max;
    if (maxThroughput < slaTargets.throughput) {
      report.performance.slaCompliance.violations.push({
        type: 'throughput',
        metric: 'maximum',
        actual: maxThroughput,
        target: slaTargets.throughput,
        severity: maxThroughput < slaTargets.throughput * 0.5 ? 'critical' : 'high'
      });
      violations++;
    }
  }

  // Check error rate SLA
  if (report.performance.errorRate > slaTargets.errorRate) {
    report.performance.slaCompliance.violations.push({
      type: 'errorRate',
      metric: 'average',
      actual: report.performance.errorRate,
      target: slaTargets.errorRate,
      severity: report.performance.errorRate > 10 ? 'critical' : 'medium'
    });
    violations++;
  }

  report.performance.slaCompliance.overall = violations === 0;
  report.performance.slaCompliance.violationCount = violations;
}

/**
 * Generate performance recommendations
 */
function generateRecommendations(report) {
  const recommendations = [];

  // Response time recommendations
  if (report.performance.responseTime.statistics) {
    const stats = report.performance.responseTime.statistics;

    if (stats.p95 > 1000) {
      recommendations.push({
        category: 'Performance',
        priority: stats.p95 > 2000 ? 'High' : 'Medium',
        message: `P95 response time is ${stats.p95.toFixed(2)}ms. Consider caching, database optimization, or scaling infrastructure.`
      });
    }

    if (stats.max > stats.mean * 3) {
      recommendations.push({
        category: 'Performance',
        priority: 'Medium',
        message: 'High response time variance detected. Investigate outliers and system stability.'
      });
    }
  }

  // Throughput recommendations
  if (report.performance.throughput.statistics) {
    const stats = report.performance.throughput.statistics;

    if (stats.max < 100) {
      recommendations.push({
        category: 'Scalability',
        priority: 'High',
        message: `Maximum throughput is ${stats.max.toFixed(2)} RPS. Consider horizontal scaling or performance optimization.`
      });
    }
  }

  // Error rate recommendations
  if (report.performance.errorRate > 1) {
    recommendations.push({
      category: 'Reliability',
      priority: report.performance.errorRate > 5 ? 'High' : 'Medium',
      message: `Error rate is ${report.performance.errorRate.toFixed(2)}%. Investigate error sources and improve error handling.`
    });
  }

  // Test failure recommendations
  if (report.summary.failedTests > 0) {
    const failureRate = (report.summary.failedTests / report.summary.totalTests) * 100;
    recommendations.push({
      category: 'Testing',
      priority: failureRate > 20 ? 'High' : 'Medium',
      message: `${report.summary.failedTests} performance tests failed (${failureRate.toFixed(1)}%). Review test failures and fix underlying issues.`
    });
  }

  report.recommendations = recommendations;
}

/**
 * Calculate statistics from array of numbers
 */
function calculateStatistics(values) {
  if (values.length === 0) return null;

  const sorted = values.sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);

  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
    p90: sorted[Math.floor(sorted.length * 0.9)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  };
}

/**
 * Save performance report to file
 */
function savePerformanceReport(report) {
  const outputDir = './performance-test-results';

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `performance-report-${timestamp}.json`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  // Also save a summary
  const summary = {
    timestamp: report.timestamp,
    slaCompliant: report.performance.slaCompliance.overall,
    violations: report.performance.slaCompliance.violationCount,
    recommendations: report.recommendations.length,
    testResults: {
      total: report.summary.totalTests,
      passed: report.summary.passedTests,
      failed: report.summary.failedTests
    },
    performance: {
      responseTime: report.performance.responseTime.statistics?.p95,
      throughput: report.performance.throughput.statistics?.max,
      errorRate: report.performance.errorRate
    }
  };

  const summaryFilename = `performance-summary-${timestamp}.json`;
  const summaryFilepath = path.join(outputDir, summaryFilename);
  fs.writeFileSync(summaryFilepath, JSON.stringify(summary, null, 2));

  console.log(`\n📊 Performance report saved to: ${filepath}`);
  console.log(`📋 Performance summary saved to: ${summaryFilepath}`);

  if (!report.performance.slaCompliance.overall) {
    console.log(`❌ SLA compliance: FAILED (${report.performance.slaCompliance.violationCount} violations)`);
  } else {
    console.log(`✅ SLA compliance: PASSED`);
  }
}

module.exports = processResults;