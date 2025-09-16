#!/usr/bin/env node

/**
 * Performance Test Runner Script
 * Orchestrates comprehensive performance testing and validation
 */

const PerformanceTestSuite = require('../../tests/performance/performance-test-suite');
const LoadTestRunner = require('../../tests/load/load-test-runner');
const StressTestFramework = require('../../tests/stress/stress-test-framework');
const PerformanceBenchmarks = require('../../tests/benchmarks/performance-benchmarks');
const SLAComplianceTests = require('../../tests/sla-validation/sla-compliance-tests');
const PerformanceRegressionTests = require('../../tests/performance/performance-regression-tests');
const PerformanceReportGenerator = require('./performance-report-generator');
const PerformanceMonitor = require('./performance-monitor');

const fs = require('fs').promises;
const path = require('path');

class PerformanceTestOrchestrator {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || process.env.TEST_BASE_URL || 'http://localhost:3000',
      outputDir: config.outputDir || './performance-test-results',
      enableMonitoring: config.enableMonitoring !== false,
      testSuites: {
        comprehensive: config.testSuites?.comprehensive !== false,
        load: config.testSuites?.load !== false,
        stress: config.testSuites?.stress !== false,
        benchmarks: config.testSuites?.benchmarks !== false,
        sla: config.testSuites?.sla !== false,
        regression: config.testSuites?.regression !== false
      },
      reportFormats: config.reportFormats || ['html', 'json', 'csv'],
      slaTargets: {
        responseTime: 1000, // 1 second
        availability: 99.9,  // 99.9%
        throughput: 100,     // 100 RPS
        errorRate: 1,        // 1%
        ...config.slaTargets
      },
      ...config
    };

    this.results = {};
    this.monitor = null;
  }

  /**
   * Run comprehensive performance testing suite
   */
  async runAllTests() {
    console.log('🚀 Starting Comprehensive Performance Testing Suite');
    console.log(`Target URL: ${this.config.baseUrl}`);
    console.log(`SLA Targets: RT=${this.config.slaTargets.responseTime}ms, AV=${this.config.slaTargets.availability}%, TP=${this.config.slaTargets.throughput}RPS, ER=${this.config.slaTargets.errorRate}%`);

    try {
      await this.ensureOutputDir();

      const orchestrationResults = {
        timestamp: new Date().toISOString(),
        config: this.config,
        testSuites: {},
        overallResults: null,
        monitoring: null,
        reports: []
      };

      // Start monitoring if enabled
      if (this.config.enableMonitoring) {
        await this.startMonitoring();
      }

      // Execute test suites in parallel where possible
      const testPromises = [];

      if (this.config.testSuites.comprehensive) {
        testPromises.push(this.runComprehensiveTests());
      }

      if (this.config.testSuites.load) {
        testPromises.push(this.runLoadTests());
      }

      if (this.config.testSuites.benchmarks) {
        testPromises.push(this.runBenchmarkTests());
      }

      if (this.config.testSuites.sla) {
        testPromises.push(this.runSLATests());
      }

      // Run core tests in parallel
      const coreResults = await Promise.allSettled(testPromises);

      // Process core test results
      coreResults.forEach((result, index) => {
        const testNames = ['comprehensive', 'load', 'benchmarks', 'sla'];
        const testName = testNames[index];

        if (result.status === 'fulfilled') {
          orchestrationResults.testSuites[testName] = result.value;
        } else {
          console.error(`❌ ${testName} tests failed:`, result.reason);
          orchestrationResults.testSuites[testName] = { error: result.reason.message };
        }
      });

      // Run stress tests (high resource usage)
      if (this.config.testSuites.stress) {
        try {
          console.log('🔥 Running stress tests...');
          orchestrationResults.testSuites.stress = await this.runStressTests();
        } catch (error) {
          console.error('❌ Stress tests failed:', error);
          orchestrationResults.testSuites.stress = { error: error.message };
        }
      }

      // Run regression tests (requires baseline)
      if (this.config.testSuites.regression) {
        try {
          console.log('📈 Running regression tests...');
          orchestrationResults.testSuites.regression = await this.runRegressionTests();
        } catch (error) {
          console.error('❌ Regression tests failed:', error);
          orchestrationResults.testSuites.regression = { error: error.message };
        }
      }

      // Stop monitoring and collect results
      if (this.config.enableMonitoring && this.monitor) {
        await this.stopMonitoring();
        orchestrationResults.monitoring = this.monitor.getPerformanceSummary();
      }

      // Analyze overall results
      orchestrationResults.overallResults = this.analyzeOverallResults(orchestrationResults.testSuites);

      // Generate comprehensive reports
      console.log('📊 Generating performance reports...');
      const reportGenerator = new PerformanceReportGenerator({
        outputDir: this.config.outputDir,
        reportFormats: this.config.reportFormats,
        slaTargets: this.config.slaTargets
      });

      const reportResults = await reportGenerator.generateReport(orchestrationResults.overallResults);
      orchestrationResults.reports = reportResults.generatedReports;

      // Save orchestration results
      await this.saveOrchestrationResults(orchestrationResults);

      // Print summary
      this.printTestSummary(orchestrationResults);

      console.log('✅ Performance testing suite completed successfully');
      return orchestrationResults;

    } catch (error) {
      console.error('❌ Performance testing suite failed:', error);
      throw error;
    }
  }

  /**
   * Run comprehensive performance tests
   */
  async runComprehensiveTests() {
    console.log('🔄 Running Comprehensive Performance Tests...');

    const testSuite = new PerformanceTestSuite({
      baseUrl: this.config.baseUrl,
      slaTarget: this.config.slaTargets.responseTime,
      outputDir: path.join(this.config.outputDir, 'comprehensive')
    });

    return await testSuite.runComprehensiveTest();
  }

  /**
   * Run load tests
   */
  async runLoadTests() {
    console.log('📊 Running Load Tests...');

    const scenarios = [
      {
        name: 'typical-user',
        actions: [
          { endpoint: '/api/search', params: { q: 'test' }, weight: 3, thinkTime: 2000 },
          { endpoint: '/api/entries', params: { limit: 10 }, weight: 2, thinkTime: 1500 },
          { endpoint: '/api/entries/1', params: {}, weight: 1, thinkTime: 1000 }
        ]
      },
      {
        name: 'power-user',
        actions: [
          { endpoint: '/api/search', params: { q: 'advanced query', category: 'tech' }, weight: 4, thinkTime: 1000 },
          { endpoint: '/api/entries', params: { page: 2, limit: 20 }, weight: 3, thinkTime: 500 },
          { endpoint: '/api/categories', params: {}, weight: 1, thinkTime: 2000 }
        ]
      },
      {
        name: 'api-consumer',
        actions: [
          { endpoint: '/api/search', params: { q: 'api test' }, weight: 5, thinkTime: 100 },
          { endpoint: '/api/entries', params: { limit: 50 }, weight: 3, thinkTime: 50 }
        ]
      }
    ];

    const loadTestRunner = new LoadTestRunner({
      baseUrl: this.config.baseUrl,
      outputDir: path.join(this.config.outputDir, 'load')
    });

    return await loadTestRunner.runLoadTest(scenarios);
  }

  /**
   * Run stress tests
   */
  async runStressTests() {
    console.log('💪 Running Stress Tests...');

    const stressFramework = new StressTestFramework({
      baseUrl: this.config.baseUrl,
      maxLoad: 500,
      outputDir: path.join(this.config.outputDir, 'stress')
    });

    return await stressFramework.runStressTest();
  }

  /**
   * Run benchmark tests
   */
  async runBenchmarkTests() {
    console.log('🎯 Running Benchmark Tests...');

    const benchmarks = new PerformanceBenchmarks({
      baseUrl: this.config.baseUrl,
      slaTarget: this.config.slaTargets.responseTime,
      outputDir: path.join(this.config.outputDir, 'benchmarks')
    });

    return await benchmarks.runBenchmarkSuite();
  }

  /**
   * Run SLA compliance tests
   */
  async runSLATests() {
    console.log('✅ Running SLA Compliance Tests...');

    const slaTests = new SLAComplianceTests({
      baseUrl: this.config.baseUrl,
      slaTargets: this.config.slaTargets,
      outputDir: path.join(this.config.outputDir, 'sla')
    });

    return await slaTests.validateSLACompliance();
  }

  /**
   * Run regression tests
   */
  async runRegressionTests() {
    console.log('📈 Running Regression Tests...');

    const regressionTests = new PerformanceRegressionTests({
      baseUrl: this.config.baseUrl,
      baselineFile: path.join(this.config.outputDir, 'baselines', 'performance-baseline.json'),
      outputDir: path.join(this.config.outputDir, 'regression')
    });

    return await regressionTests.runRegressionTests();
  }

  /**
   * Start performance monitoring
   */
  async startMonitoring() {
    console.log('📊 Starting performance monitoring...');

    this.monitor = new PerformanceMonitor({
      baseUrl: this.config.baseUrl,
      alertThresholds: {
        responseTime: this.config.slaTargets.responseTime * 1.5,
        errorRate: this.config.slaTargets.errorRate * 2,
        throughput: this.config.slaTargets.throughput * 0.5,
        availability: this.config.slaTargets.availability - 1
      },
      metricsFile: path.join(this.config.outputDir, 'monitoring-metrics.json'),
      alertsFile: path.join(this.config.outputDir, 'monitoring-alerts.json')
    });

    await this.monitor.startMonitoring();
  }

  /**
   * Stop performance monitoring
   */
  async stopMonitoring() {
    if (this.monitor) {
      console.log('📊 Stopping performance monitoring...');
      await this.monitor.stopMonitoring();
    }
  }

  /**
   * Analyze overall results
   */
  analyzeOverallResults(testSuites) {
    const overallResults = {
      summary: {
        testsRun: Object.keys(testSuites).length,
        testsSuccessful: Object.values(testSuites).filter(result => !result.error).length,
        testsFailed: Object.values(testSuites).filter(result => result.error).length,
        overallGrade: 'F',
        slaCompliant: false
      },
      metrics: {
        responseTime: null,
        throughput: null,
        errorRate: null,
        availability: null
      },
      compliance: {
        overallCompliant: false,
        categories: {}
      },
      issues: [],
      recommendations: []
    };

    // Extract key metrics from different test suites
    this.extractMetricsFromResults(testSuites, overallResults);

    // Calculate overall compliance
    overallResults.compliance = this.calculateOverallCompliance(overallResults.metrics);
    overallResults.summary.slaCompliant = overallResults.compliance.overallCompliant;

    // Calculate overall grade
    overallResults.summary.overallGrade = this.calculateOverallGrade(overallResults);

    // Extract issues and recommendations
    overallResults.issues = this.extractIssues(testSuites);
    overallResults.recommendations = this.extractRecommendations(testSuites, overallResults);

    return overallResults;
  }

  /**
   * Extract metrics from test results
   */
  extractMetricsFromResults(testSuites, overallResults) {
    // Try to extract from SLA tests first
    if (testSuites.sla && !testSuites.sla.error) {
      overallResults.metrics.responseTime = testSuites.sla.summary?.keyMetrics?.p95ResponseTime;
      overallResults.metrics.availability = testSuites.sla.summary?.keyMetrics?.availability;
      overallResults.metrics.errorRate = testSuites.sla.summary?.keyMetrics?.errorRate;
      overallResults.metrics.throughput = testSuites.sla.summary?.keyMetrics?.maxThroughput;
    }

    // Fallback to comprehensive tests
    if (!overallResults.metrics.responseTime && testSuites.comprehensive && !testSuites.comprehensive.error) {
      overallResults.metrics.responseTime = testSuites.comprehensive.summary?.keyMetrics?.p95ResponseTime;
    }

    // Fallback to benchmark tests
    if (!overallResults.metrics.responseTime && testSuites.benchmarks && !testSuites.benchmarks.error) {
      overallResults.metrics.responseTime = testSuites.benchmarks.summary?.keyMetrics?.averageP95ResponseTime;
    }

    // Extract throughput from load or stress tests
    if (!overallResults.metrics.throughput) {
      if (testSuites.load && !testSuites.load.error) {
        overallResults.metrics.throughput = testSuites.load.summary?.requestsPerSecond;
      } else if (testSuites.stress && !testSuites.stress.error) {
        overallResults.metrics.throughput = testSuites.stress.summary?.phases?.peak?.totalRequests;
      }
    }
  }

  /**
   * Calculate overall compliance
   */
  calculateOverallCompliance(metrics) {
    const compliance = {
      overallCompliant: true,
      categories: {},
      score: 0
    };

    let compliantCategories = 0;
    let totalCategories = 0;

    // Check response time compliance
    if (metrics.responseTime !== null) {
      totalCategories++;
      const responseTimeCompliant = metrics.responseTime <= this.config.slaTargets.responseTime;
      compliance.categories.responseTime = responseTimeCompliant;
      if (responseTimeCompliant) compliantCategories++;
    }

    // Check throughput compliance
    if (metrics.throughput !== null) {
      totalCategories++;
      const throughputCompliant = metrics.throughput >= this.config.slaTargets.throughput;
      compliance.categories.throughput = throughputCompliant;
      if (throughputCompliant) compliantCategories++;
    }

    // Check error rate compliance
    if (metrics.errorRate !== null) {
      totalCategories++;
      const errorRateCompliant = metrics.errorRate <= this.config.slaTargets.errorRate;
      compliance.categories.errorRate = errorRateCompliant;
      if (errorRateCompliant) compliantCategories++;
    }

    // Check availability compliance
    if (metrics.availability !== null) {
      totalCategories++;
      const availabilityCompliant = metrics.availability >= this.config.slaTargets.availability;
      compliance.categories.availability = availabilityCompliant;
      if (availabilityCompliant) compliantCategories++;
    }

    compliance.score = totalCategories > 0 ? (compliantCategories / totalCategories) * 100 : 0;
    compliance.overallCompliant = compliance.score >= 80; // 80% compliance threshold

    return compliance;
  }

  /**
   * Calculate overall grade
   */
  calculateOverallGrade(overallResults) {
    const complianceScore = overallResults.compliance.score;
    const failedTests = overallResults.summary.testsFailed;

    let grade = 'F';

    if (failedTests === 0) {
      if (complianceScore >= 95) grade = 'A+';
      else if (complianceScore >= 90) grade = 'A';
      else if (complianceScore >= 85) grade = 'A-';
      else if (complianceScore >= 80) grade = 'B+';
      else if (complianceScore >= 75) grade = 'B';
      else if (complianceScore >= 70) grade = 'B-';
      else if (complianceScore >= 65) grade = 'C+';
      else if (complianceScore >= 60) grade = 'C';
      else if (complianceScore >= 55) grade = 'C-';
      else if (complianceScore >= 50) grade = 'D';
    } else if (failedTests === 1) {
      // Downgrade by one level if one test failed
      if (complianceScore >= 90) grade = 'B+';
      else if (complianceScore >= 80) grade = 'B';
      else if (complianceScore >= 70) grade = 'C+';
      else if (complianceScore >= 60) grade = 'C';
      else if (complianceScore >= 50) grade = 'D';
    }

    return grade;
  }

  /**
   * Extract issues from test results
   */
  extractIssues(testSuites) {
    const issues = [];

    Object.entries(testSuites).forEach(([suiteName, results]) => {
      if (results.error) {
        issues.push({
          type: 'test-failure',
          severity: 'high',
          suite: suiteName,
          message: `${suiteName} test suite failed: ${results.error}`
        });
      }

      // Extract specific issues from successful tests
      if (results.violations) {
        results.violations.forEach(violation => {
          issues.push({
            type: 'sla-violation',
            severity: violation.type.includes('critical') ? 'critical' : 'medium',
            suite: suiteName,
            message: `SLA violation: ${violation.type}`,
            details: violation
          });
        });
      }

      if (results.regressions) {
        results.regressions.forEach(regression => {
          issues.push({
            type: 'performance-regression',
            severity: regression.severity || 'medium',
            suite: suiteName,
            message: `Performance regression in ${regression.scenario}: ${regression.changePercent?.toFixed(1)}% slower`,
            details: regression
          });
        });
      }
    });

    return issues;
  }

  /**
   * Extract recommendations from test results
   */
  extractRecommendations(testSuites, overallResults) {
    const recommendations = new Set();

    // SLA-based recommendations
    if (!overallResults.compliance.categories.responseTime) {
      recommendations.add('Optimize response times through caching, database optimization, or infrastructure scaling');
    }

    if (!overallResults.compliance.categories.throughput) {
      recommendations.add('Increase system throughput through horizontal scaling or performance optimization');
    }

    if (!overallResults.compliance.categories.errorRate) {
      recommendations.add('Investigate and reduce error rates through better error handling and monitoring');
    }

    if (!overallResults.compliance.categories.availability) {
      recommendations.add('Improve system availability through redundancy and failover mechanisms');
    }

    // Test-specific recommendations
    Object.values(testSuites).forEach(results => {
      if (results.recommendations) {
        if (Array.isArray(results.recommendations)) {
          results.recommendations.forEach(rec => {
            if (typeof rec === 'string') {
              recommendations.add(rec);
            } else if (rec.recommendation) {
              recommendations.add(rec.recommendation);
            }
          });
        }
      }

      if (results.summary?.recommendations) {
        results.summary.recommendations.forEach(rec => recommendations.add(rec));
      }
    });

    return Array.from(recommendations);
  }

  /**
   * Print test summary
   */
  printTestSummary(orchestrationResults) {
    console.log('\n' + '='.repeat(60));
    console.log('PERFORMANCE TEST SUMMARY');
    console.log('='.repeat(60));

    const overall = orchestrationResults.overallResults.summary;
    console.log(`Overall Grade: ${overall.overallGrade}`);
    console.log(`SLA Compliant: ${overall.slaCompliant ? '✅ YES' : '❌ NO'}`);
    console.log(`Tests Run: ${overall.testsRun}`);
    console.log(`Successful: ${overall.testsSuccessful}`);
    console.log(`Failed: ${overall.testsFailed}`);

    const metrics = orchestrationResults.overallResults.metrics;
    console.log('\nKEY METRICS:');
    console.log(`Response Time (P95): ${metrics.responseTime?.toFixed(2) || 'N/A'}ms (Target: ${this.config.slaTargets.responseTime}ms)`);
    console.log(`Throughput: ${metrics.throughput?.toFixed(2) || 'N/A'} RPS (Target: ${this.config.slaTargets.throughput} RPS)`);
    console.log(`Error Rate: ${metrics.errorRate?.toFixed(2) || 'N/A'}% (Target: ≤${this.config.slaTargets.errorRate}%)`);
    console.log(`Availability: ${metrics.availability?.toFixed(2) || 'N/A'}% (Target: ≥${this.config.slaTargets.availability}%)`);

    if (orchestrationResults.overallResults.issues.length > 0) {
      console.log('\nISSUES FOUND:');
      orchestrationResults.overallResults.issues.slice(0, 5).forEach(issue => {
        console.log(`- [${issue.severity.toUpperCase()}] ${issue.message}`);
      });

      if (orchestrationResults.overallResults.issues.length > 5) {
        console.log(`... and ${orchestrationResults.overallResults.issues.length - 5} more issues`);
      }
    }

    if (orchestrationResults.reports.length > 0) {
      console.log('\nREPORTS GENERATED:');
      orchestrationResults.reports.forEach(report => {
        console.log(`- ${report}`);
      });
    }

    console.log('='.repeat(60));
  }

  /**
   * Save orchestration results
   */
  async saveOrchestrationResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `performance-test-orchestration-${timestamp}.json`;
    const filepath = path.join(this.config.outputDir, filename);

    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    console.log(`📄 Orchestration results saved to: ${filepath}`);
  }

  /**
   * Ensure output directory exists
   */
  async ensureOutputDir() {
    try {
      await fs.access(this.config.outputDir);
    } catch {
      await fs.mkdir(this.config.outputDir, { recursive: true });
    }
  }
}

// CLI execution
if (require.main === module) {
  const config = {
    baseUrl: process.argv[2] || process.env.TEST_BASE_URL || 'http://localhost:3000',
    outputDir: process.argv[3] || './performance-test-results'
  };

  const orchestrator = new PerformanceTestOrchestrator(config);

  orchestrator.runAllTests()
    .then(results => {
      console.log('\n✅ Performance testing completed successfully');
      const grade = results.overallResults.summary.overallGrade;
      const compliant = results.overallResults.summary.slaCompliant;

      if (!compliant || ['D', 'F'].includes(grade)) {
        process.exit(1); // Fail CI/CD if performance is poor
      }
    })
    .catch(error => {
      console.error('\n❌ Performance testing failed:', error.message);
      process.exit(1);
    });
}

module.exports = PerformanceTestOrchestrator;