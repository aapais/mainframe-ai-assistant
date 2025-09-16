/**
 * Performance Test Reporter
 * Custom Jest reporter for performance metrics
 */

const fs = require('fs').promises;
const path = require('path');

class PerformanceReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig;
    this.options = options;
    this.testResults = [];
    this.performanceMetrics = {
      suiteStart: Date.now(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      performanceFailures: []
    };
  }

  onRunStart(results, options) {
    console.log('\n📈 Performance Reporter: Starting test monitoring...');
    this.performanceMetrics.suiteStart = Date.now();
  }

  onTestStart(test) {
    // Track individual test start
    test.performanceStartTime = Date.now();
  }

  onTestResult(test, testResult, aggregatedResult) {
    const testDuration = Date.now() - (test.performanceStartTime || Date.now());
    
    this.performanceMetrics.totalTests++;
    
    if (testResult.numFailingTests > 0) {
      this.performanceMetrics.failedTests++;
      
      // Check if failures are performance-related
      testResult.testResults.forEach(result => {
        if (result.status === 'failed') {
          const isPerformanceFailure = this.isPerformanceRelatedFailure(result);
          if (isPerformanceFailure) {
            this.performanceMetrics.performanceFailures.push({
              testName: result.fullName,
              error: result.failureMessages?.[0] || 'Unknown performance failure',
              duration: testDuration
            });
          }
        }
      });
    } else if (testResult.numPendingTests > 0) {
      this.performanceMetrics.skippedTests++;
    } else {
      this.performanceMetrics.passedTests++;
    }

    // Collect detailed test result
    const detailedResult = {
      testPath: testResult.testFilePath,
      testName: path.basename(testResult.testFilePath),
      duration: testDuration,
      status: testResult.numFailingTests > 0 ? 'failed' : 
               testResult.numPendingTests > 0 ? 'skipped' : 'passed',
      numTests: testResult.numPassingTests + testResult.numFailingTests + testResult.numPendingTests,
      passedTests: testResult.numPassingTests,
      failedTests: testResult.numFailingTests,
      skippedTests: testResult.numPendingTests,
      timestamp: new Date().toISOString(),
      performanceMetrics: this.extractPerformanceMetrics(testResult)
    };

    this.testResults.push(detailedResult);

    // Log performance summary for each test file
    this.logTestPerformanceSummary(detailedResult);
  }

  isPerformanceRelatedFailure(testResult) {
    const performanceKeywords = [
      'response time',
      'cache hit rate',
      'concurrent users',
      'database performance',
      'memory usage',
      'p95',
      'throughput',
      'latency'
    ];

    const errorMessage = testResult.failureMessages?.[0] || '';
    return performanceKeywords.some(keyword => 
      errorMessage.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  extractPerformanceMetrics(testResult) {
    // Extract performance-related metrics from test output
    const metrics = {};
    
    testResult.testResults.forEach(result => {
      // Look for performance metrics in test names or output
      if (result.title.includes('response time')) {
        metrics.responseTimeTest = result.status === 'passed';
      }
      if (result.title.includes('cache')) {
        metrics.cacheTest = result.status === 'passed';
      }
      if (result.title.includes('concurrent')) {
        metrics.concurrencyTest = result.status === 'passed';
      }
      if (result.title.includes('database')) {
        metrics.databaseTest = result.status === 'passed';
      }
      if (result.title.includes('memory')) {
        metrics.memoryTest = result.status === 'passed';
      }
    });

    return metrics;
  }

  logTestPerformanceSummary(result) {
    const statusIcon = result.status === 'passed' ? '✓' : 
                      result.status === 'failed' ? '❌' : '⏸️';
    
    console.log(`${statusIcon} ${result.testName}: ${result.passedTests}/${result.numTests} tests passed (${Math.round(result.duration)}ms)`);
    
    if (result.status === 'failed') {
      console.log(`   ⚠️  ${result.failedTests} performance requirement(s) not met`);
    }
  }

  onRunComplete(contexts, results) {
    const suiteDuration = Date.now() - this.performanceMetrics.suiteStart;
    
    console.log('\n📈 Performance Test Suite Complete!');
    console.log('==========================================');
    console.log(`⏱️  Total Duration: ${Math.round(suiteDuration / 1000)}s`);
    console.log(`📄 Total Tests: ${this.performanceMetrics.totalTests}`);
    console.log(`✓ Passed: ${this.performanceMetrics.passedTests}`);
    console.log(`❌ Failed: ${this.performanceMetrics.failedTests}`);
    console.log(`⏸️  Skipped: ${this.performanceMetrics.skippedTests}`);
    
    if (this.performanceMetrics.performanceFailures.length > 0) {
      console.log('\n⚠️  Performance Requirement Failures:');
      this.performanceMetrics.performanceFailures.forEach((failure, index) => {
        console.log(`   ${index + 1}. ${failure.testName}`);
        console.log(`      ${failure.error.split('\n')[0]}`);
      });
    }
    
    // Generate comprehensive performance report
    this.generatePerformanceReport(suiteDuration, results);
  }

  async generatePerformanceReport(suiteDuration, jestResults) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalDuration: suiteDuration,
        totalTests: this.performanceMetrics.totalTests,
        passedTests: this.performanceMetrics.passedTests,
        failedTests: this.performanceMetrics.failedTests,
        skippedTests: this.performanceMetrics.skippedTests,
        successRate: (this.performanceMetrics.passedTests / this.performanceMetrics.totalTests) * 100
      },
      
      performanceRequirements: {
        responseTime: this.analyzeRequirementResults('response time'),
        cacheHitRate: this.analyzeRequirementResults('cache'),
        concurrentUsers: this.analyzeRequirementResults('concurrent'),
        databasePerformance: this.analyzeRequirementResults('database'),
        memoryUsage: this.analyzeRequirementResults('memory')
      },
      
      testResults: this.testResults,
      
      performanceFailures: this.performanceMetrics.performanceFailures,
      
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      
      jestSummary: {
        numTotalTestSuites: jestResults.numTotalTestSuites,
        numPassedTestSuites: jestResults.numPassedTestSuites,
        numFailedTestSuites: jestResults.numFailedTestSuites,
        numTotalTests: jestResults.numTotalTests,
        numPassedTests: jestResults.numPassedTests,
        numFailedTests: jestResults.numFailedTests
      }
    };

    // Save report to file
    if (this.options?.outputFile) {
      try {
        const reportPath = path.resolve(this.options.outputFile);
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Detailed performance report saved: ${reportPath}`);
      } catch (error) {
        console.error('Failed to save performance report:', error.message);
      }
    }

    // Generate human-readable summary
    this.generateHumanReadableSummary(report);

    return report;
  }

  analyzeRequirementResults(requirementType) {
    const relevantTests = this.testResults.filter(test => 
      test.testName.toLowerCase().includes(requirementType) ||
      Object.keys(test.performanceMetrics).some(key => 
        key.toLowerCase().includes(requirementType)
      )
    );

    if (relevantTests.length === 0) {
      return { status: 'not_tested', message: 'No tests found for this requirement' };
    }

    const passedTests = relevantTests.filter(test => test.status === 'passed').length;
    const totalTests = relevantTests.length;
    
    return {
      status: passedTests === totalTests ? 'passed' : 'failed',
      testsRun: totalTests,
      testsPassed: passedTests,
      successRate: (passedTests / totalTests) * 100,
      message: `${passedTests}/${totalTests} tests passed`
    };
  }

  generateHumanReadableSummary(report) {
    console.log('\n📈 Performance Requirements Summary:');
    console.log('===========================================');
    
    Object.entries(report.performanceRequirements).forEach(([requirement, result]) => {
      const icon = result.status === 'passed' ? '✓' : 
                   result.status === 'failed' ? '❌' : '❔';
      const name = requirement.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      
      console.log(`${icon} ${name}: ${result.message}`);
    });
    
    console.log('\n🎆 Overall Result:');
    const overallPass = Object.values(report.performanceRequirements)
      .every(req => req.status === 'passed');
    
    console.log(`${overallPass ? '✓ ALL REQUIREMENTS MET' : '❌ SOME REQUIREMENTS FAILED'}`);
    console.log(`Success Rate: ${Math.round(report.summary.successRate)}%\n`);
  }
}

module.exports = PerformanceReporter;
