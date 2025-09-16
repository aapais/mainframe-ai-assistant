/**
 * SLA Compliance Testing Framework
 * Validates adherence to Service Level Agreements
 */

const { performance } = require('perf_hooks');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class SLAComplianceTests {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      slaTargets: {
        responseTime: {
          p50: 500,  // 500ms for 50th percentile
          p95: 1000, // 1000ms for 95th percentile
          p99: 2000  // 2000ms for 99th percentile
        },
        availability: 99.9,     // 99.9% uptime
        throughput: 100,        // 100 requests per second minimum
        errorRate: 1,           // Maximum 1% error rate
        maxResponseTime: 5000   // Absolute maximum response time
      },
      testDuration: config.testDuration || 300000, // 5 minutes
      monitoringInterval: config.monitoringInterval || 5000, // 5 seconds
      complianceThreshold: config.complianceThreshold || 95, // 95% compliance required
      outputDir: config.outputDir || './sla-validation-results',
      ...config
    };

    this.metrics = {
      responseTimes: [],
      errors: [],
      uptimeChecks: [],
      throughputMeasurements: [],
      availabilityEvents: []
    };

    this.violations = [];
    this.complianceReport = null;
  }

  /**
   * Execute comprehensive SLA compliance validation
   */
  async validateSLACompliance() {
    console.log('✅ Starting SLA Compliance Validation');
    console.log('SLA Targets:');
    console.log(`  - Response Time P95: ${this.config.slaTargets.responseTime.p95}ms`);
    console.log(`  - Availability: ${this.config.slaTargets.availability}%`);
    console.log(`  - Minimum Throughput: ${this.config.slaTargets.throughput} RPS`);
    console.log(`  - Maximum Error Rate: ${this.config.slaTargets.errorRate}%`);

    try {
      await this.ensureOutputDir();

      const validationResults = {
        timestamp: new Date().toISOString(),
        duration: this.config.testDuration,
        slaTargets: this.config.slaTargets,
        tests: {},
        compliance: {},
        violations: [],
        summary: null
      };

      // Run comprehensive SLA tests
      console.log('🔄 Running SLA validation tests...');

      // Parallel execution of different SLA test categories
      const [
        responseTimeResults,
        availabilityResults,
        throughputResults,
        errorRateResults,
        enduranceResults
      ] = await Promise.all([
        this.validateResponseTimeSLA(),
        this.validateAvailabilitySLA(),
        this.validateThroughputSLA(),
        this.validateErrorRateSLA(),
        this.validateEnduranceSLA()
      ]);

      validationResults.tests = {
        responseTime: responseTimeResults,
        availability: availabilityResults,
        throughput: throughputResults,
        errorRate: errorRateResults,
        endurance: enduranceResults
      };

      // Analyze overall compliance
      validationResults.compliance = this.analyzeOverallCompliance(validationResults.tests);
      validationResults.violations = this.violations;
      validationResults.summary = this.generateComplianceSummary(validationResults);

      // Save results
      await this.saveComplianceResults(validationResults);

      console.log(`${validationResults.compliance.overallCompliant ? '✅' : '❌'} SLA validation completed`);
      console.log(`Overall compliance: ${validationResults.compliance.complianceScore.toFixed(1)}%`);

      return validationResults;

    } catch (error) {
      console.error('❌ SLA validation failed:', error);
      throw error;
    }
  }

  /**
   * Validate response time SLA
   */
  async validateResponseTimeSLA() {
    console.log('⏱️  Validating Response Time SLA...');

    const testScenarios = [
      { name: 'search-simple', endpoint: '/api/search', params: { q: 'test' }, weight: 40 },
      { name: 'search-complex', endpoint: '/api/search', params: { q: 'complex query', category: 'tech' }, weight: 20 },
      { name: 'entry-detail', endpoint: '/api/entries/1', params: {}, weight: 25 },
      { name: 'entry-list', endpoint: '/api/entries', params: { limit: 20 }, weight: 15 }
    ];

    const results = {
      scenarios: {},
      aggregated: {},
      compliance: {},
      violations: []
    };

    // Test each scenario
    for (const scenario of testScenarios) {
      console.log(`  Testing scenario: ${scenario.name}`);

      const scenarioResults = await this.testScenarioResponseTime(scenario);
      results.scenarios[scenario.name] = scenarioResults;

      // Check compliance for this scenario
      const scenarioCompliance = this.checkResponseTimeCompliance(scenarioResults, scenario.name);
      results.compliance[scenario.name] = scenarioCompliance;

      if (!scenarioCompliance.compliant) {
        results.violations.push(...scenarioCompliance.violations);
        this.violations.push(...scenarioCompliance.violations);
      }
    }

    // Aggregate all response times
    const allResponseTimes = Object.values(results.scenarios)
      .flatMap(scenario => scenario.responseTimes);

    results.aggregated = {
      totalRequests: allResponseTimes.length,
      statistics: this.calculateStatistics(allResponseTimes),
      percentiles: this.calculatePercentiles(allResponseTimes.sort((a, b) => a - b))
    };

    // Overall response time compliance
    results.compliance.overall = this.checkResponseTimeCompliance(results.aggregated, 'overall');

    return results;
  }

  /**
   * Test scenario response time
   */
  async testScenarioResponseTime(scenario) {
    const iterations = 100;
    const responseTimes = [];
    const errors = [];

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = performance.now();
        const response = await axios.get(`${this.config.baseUrl}${scenario.endpoint}`, {
          params: scenario.params,
          timeout: 10000
        });
        const endTime = performance.now();

        const responseTime = endTime - startTime;
        responseTimes.push(responseTime);

        // Check for maximum response time violation
        if (responseTime > this.config.slaTargets.maxResponseTime) {
          this.violations.push({
            type: 'maxResponseTime',
            scenario: scenario.name,
            value: responseTime,
            target: this.config.slaTargets.maxResponseTime,
            timestamp: new Date().toISOString()
          });
        }

      } catch (error) {
        errors.push({
          scenario: scenario.name,
          error: error.message,
          status: error.response?.status,
          timestamp: new Date().toISOString()
        });
      }

      // Progress indicator
      if ((i + 1) % 20 === 0) {
        process.stdout.write('.');
      }
    }
    console.log(); // New line after progress

    return {
      scenario: scenario.name,
      iterations,
      responseTimes,
      errors,
      statistics: this.calculateStatistics(responseTimes),
      percentiles: responseTimes.length > 0 ? this.calculatePercentiles(responseTimes.sort((a, b) => a - b)) : {},
      errorRate: (errors.length / iterations) * 100
    };
  }

  /**
   * Check response time compliance
   */
  checkResponseTimeCompliance(results, scenarioName) {
    const compliance = {
      scenario: scenarioName,
      compliant: true,
      violations: [],
      metrics: {}
    };

    if (!results.percentiles || Object.keys(results.percentiles).length === 0) {
      compliance.compliant = false;
      compliance.violations.push({
        type: 'noData',
        message: 'No response time data available'
      });
      return compliance;
    }

    // Check P50 compliance
    if (results.percentiles.p50 > this.config.slaTargets.responseTime.p50) {
      compliance.compliant = false;
      compliance.violations.push({
        type: 'p50Violation',
        scenario: scenarioName,
        value: results.percentiles.p50,
        target: this.config.slaTargets.responseTime.p50,
        excess: results.percentiles.p50 - this.config.slaTargets.responseTime.p50
      });
    }

    // Check P95 compliance (main SLA metric)
    if (results.percentiles.p95 > this.config.slaTargets.responseTime.p95) {
      compliance.compliant = false;
      compliance.violations.push({
        type: 'p95Violation',
        scenario: scenarioName,
        value: results.percentiles.p95,
        target: this.config.slaTargets.responseTime.p95,
        excess: results.percentiles.p95 - this.config.slaTargets.responseTime.p95
      });
    }

    // Check P99 compliance
    if (results.percentiles.p99 > this.config.slaTargets.responseTime.p99) {
      compliance.compliant = false;
      compliance.violations.push({
        type: 'p99Violation',
        scenario: scenarioName,
        value: results.percentiles.p99,
        target: this.config.slaTargets.responseTime.p99,
        excess: results.percentiles.p99 - this.config.slaTargets.responseTime.p99
      });
    }

    compliance.metrics = {
      p50: results.percentiles.p50,
      p95: results.percentiles.p95,
      p99: results.percentiles.p99,
      mean: results.statistics?.mean
    };

    return compliance;
  }

  /**
   * Validate availability SLA
   */
  async validateAvailabilitySLA() {
    console.log('🌐 Validating Availability SLA...');

    const monitoringDuration = this.config.testDuration;
    const checkInterval = 10000; // 10 seconds
    const totalChecks = Math.floor(monitoringDuration / checkInterval);

    const availabilityResults = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      downtime: 0,
      uptimePercentage: 0,
      compliance: {},
      incidents: []
    };

    console.log(`  Monitoring availability for ${monitoringDuration / 1000} seconds...`);

    const startTime = Date.now();
    let checkCount = 0;

    while (Date.now() - startTime < monitoringDuration && checkCount < totalChecks) {
      checkCount++;
      const checkStartTime = Date.now();

      try {
        const response = await axios.get(`${this.config.baseUrl}/api/health`, {
          timeout: 5000
        });

        if (response.status === 200) {
          availabilityResults.successfulChecks++;
        } else {
          availabilityResults.failedChecks++;
          availabilityResults.incidents.push({
            timestamp: new Date().toISOString(),
            type: 'unhealthy',
            status: response.status,
            responseTime: Date.now() - checkStartTime
          });
        }

      } catch (error) {
        availabilityResults.failedChecks++;
        availabilityResults.downtime += checkInterval;

        availabilityResults.incidents.push({
          timestamp: new Date().toISOString(),
          type: 'unreachable',
          error: error.message,
          responseTime: Date.now() - checkStartTime
        });
      }

      availabilityResults.totalChecks++;

      // Progress indicator
      if (checkCount % 10 === 0) {
        process.stdout.write('.');
      }

      // Wait for next check interval
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    console.log(); // New line after progress

    // Calculate uptime percentage
    availabilityResults.uptimePercentage = (availabilityResults.successfulChecks / availabilityResults.totalChecks) * 100;

    // Check compliance
    availabilityResults.compliance = {
      compliant: availabilityResults.uptimePercentage >= this.config.slaTargets.availability,
      target: this.config.slaTargets.availability,
      actual: availabilityResults.uptimePercentage,
      difference: availabilityResults.uptimePercentage - this.config.slaTargets.availability
    };

    if (!availabilityResults.compliance.compliant) {
      this.violations.push({
        type: 'availabilityViolation',
        target: this.config.slaTargets.availability,
        actual: availabilityResults.uptimePercentage,
        incidents: availabilityResults.incidents.length
      });
    }

    return availabilityResults;
  }

  /**
   * Validate throughput SLA
   */
  async validateThroughputSLA() {
    console.log('📊 Validating Throughput SLA...');

    const testDuration = 60000; // 1 minute intensive test
    const concurrencyLevels = [10, 25, 50];

    const throughputResults = {
      tests: {},
      maxThroughput: 0,
      compliance: {}
    };

    for (const concurrency of concurrencyLevels) {
      console.log(`  Testing throughput with ${concurrency} concurrent users...`);

      const testResult = await this.measureThroughput(concurrency, testDuration);
      throughputResults.tests[`concurrency_${concurrency}`] = testResult;

      if (testResult.requestsPerSecond > throughputResults.maxThroughput) {
        throughputResults.maxThroughput = testResult.requestsPerSecond;
      }
    }

    // Check compliance
    throughputResults.compliance = {
      compliant: throughputResults.maxThroughput >= this.config.slaTargets.throughput,
      target: this.config.slaTargets.throughput,
      actual: throughputResults.maxThroughput,
      difference: throughputResults.maxThroughput - this.config.slaTargets.throughput
    };

    if (!throughputResults.compliance.compliant) {
      this.violations.push({
        type: 'throughputViolation',
        target: this.config.slaTargets.throughput,
        actual: throughputResults.maxThroughput,
        deficit: this.config.slaTargets.throughput - throughputResults.maxThroughput
      });
    }

    return throughputResults;
  }

  /**
   * Measure throughput at specific concurrency
   */
  async measureThroughput(concurrency, duration) {
    const results = {
      concurrency,
      duration,
      totalRequests: 0,
      successfulRequests: 0,
      errors: 0,
      requestsPerSecond: 0,
      averageResponseTime: 0
    };

    const startTime = Date.now();
    const requests = [];

    // Create worker promises
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(this.throughputWorker(i, duration, requests));
    }

    await Promise.all(workers);

    const endTime = Date.now();
    const actualDuration = endTime - startTime;

    // Calculate metrics
    results.totalRequests = requests.length;
    results.successfulRequests = requests.filter(r => r.success).length;
    results.errors = requests.filter(r => !r.success).length;
    results.requestsPerSecond = (results.totalRequests / actualDuration) * 1000;

    const responseTimes = requests.filter(r => r.success).map(r => r.responseTime);
    if (responseTimes.length > 0) {
      results.averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    }

    return results;
  }

  /**
   * Throughput worker
   */
  async throughputWorker(workerId, duration, results) {
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      const requestStart = performance.now();

      try {
        const response = await axios.get(`${this.config.baseUrl}/api/search`, {
          params: { q: `throughput-test-${workerId}` },
          timeout: 5000
        });

        const requestEnd = performance.now();

        results.push({
          workerId,
          responseTime: requestEnd - requestStart,
          success: true,
          status: response.status,
          timestamp: Date.now()
        });

      } catch (error) {
        const requestEnd = performance.now();

        results.push({
          workerId,
          responseTime: requestEnd - requestStart,
          success: false,
          error: error.message,
          status: error.response?.status || 0,
          timestamp: Date.now()
        });
      }

      // Brief pause to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Validate error rate SLA
   */
  async validateErrorRateSLA() {
    console.log('❌ Validating Error Rate SLA...');

    const testRequests = 500;
    const errorResults = {
      totalRequests: 0,
      errors: 0,
      errorRate: 0,
      errorTypes: {},
      compliance: {}
    };

    console.log(`  Making ${testRequests} requests to measure error rate...`);

    for (let i = 0; i < testRequests; i++) {
      try {
        const response = await axios.get(`${this.config.baseUrl}/api/search`, {
          params: { q: `error-test-${i}` },
          timeout: 5000
        });

        errorResults.totalRequests++;

        // Consider non-2xx responses as errors
        if (response.status < 200 || response.status >= 300) {
          errorResults.errors++;
          const errorType = `status_${response.status}`;
          errorResults.errorTypes[errorType] = (errorResults.errorTypes[errorType] || 0) + 1;
        }

      } catch (error) {
        errorResults.totalRequests++;
        errorResults.errors++;

        const errorType = error.response?.status ? `status_${error.response.status}` : 'network_error';
        errorResults.errorTypes[errorType] = (errorResults.errorTypes[errorType] || 0) + 1;
      }

      // Progress indicator
      if ((i + 1) % 50 === 0) {
        process.stdout.write('.');
      }
    }
    console.log(); // New line after progress

    // Calculate error rate
    errorResults.errorRate = (errorResults.errors / errorResults.totalRequests) * 100;

    // Check compliance
    errorResults.compliance = {
      compliant: errorResults.errorRate <= this.config.slaTargets.errorRate,
      target: this.config.slaTargets.errorRate,
      actual: errorResults.errorRate,
      excess: Math.max(0, errorResults.errorRate - this.config.slaTargets.errorRate)
    };

    if (!errorResults.compliance.compliant) {
      this.violations.push({
        type: 'errorRateViolation',
        target: this.config.slaTargets.errorRate,
        actual: errorResults.errorRate,
        excess: errorResults.errorRate - this.config.slaTargets.errorRate,
        errorTypes: errorResults.errorTypes
      });
    }

    return errorResults;
  }

  /**
   * Validate endurance SLA
   */
  async validateEnduranceSLA() {
    console.log('🏃 Validating Endurance SLA...');

    const enduranceDuration = 180000; // 3 minutes
    const checkInterval = 15000; // 15 seconds
    const intervals = Math.floor(enduranceDuration / checkInterval);

    const enduranceResults = {
      intervals: [],
      degradation: {
        responseTime: 0,
        throughput: 0,
        errorRate: 0
      },
      compliance: {}
    };

    console.log(`  Running endurance test for ${enduranceDuration / 1000} seconds...`);

    let baselineMetrics = null;

    for (let i = 0; i < intervals; i++) {
      console.log(`    Interval ${i + 1}/${intervals}...`);

      const intervalResult = await this.measureInterval(checkInterval);
      intervalResult.interval = i + 1;
      intervalResult.timestamp = new Date().toISOString();

      enduranceResults.intervals.push(intervalResult);

      // Set baseline from first interval
      if (i === 0) {
        baselineMetrics = intervalResult;
      }
    }

    // Calculate degradation
    if (baselineMetrics && enduranceResults.intervals.length > 1) {
      const finalInterval = enduranceResults.intervals[enduranceResults.intervals.length - 1];

      enduranceResults.degradation = {
        responseTime: ((finalInterval.averageResponseTime - baselineMetrics.averageResponseTime) / baselineMetrics.averageResponseTime) * 100,
        throughput: ((baselineMetrics.requestsPerSecond - finalInterval.requestsPerSecond) / baselineMetrics.requestsPerSecond) * 100,
        errorRate: finalInterval.errorRate - baselineMetrics.errorRate
      };
    }

    // Check compliance (degradation should be < 20%)
    enduranceResults.compliance = {
      compliant: enduranceResults.degradation.responseTime < 20 && enduranceResults.degradation.throughput < 20,
      responseTimeDegradation: enduranceResults.degradation.responseTime,
      throughputDegradation: enduranceResults.degradation.throughput,
      errorRateIncrease: enduranceResults.degradation.errorRate
    };

    if (!enduranceResults.compliance.compliant) {
      this.violations.push({
        type: 'enduranceViolation',
        responseTimeDegradation: enduranceResults.degradation.responseTime,
        throughputDegradation: enduranceResults.degradation.throughput
      });
    }

    return enduranceResults;
  }

  /**
   * Measure performance for a specific interval
   */
  async measureInterval(duration) {
    const startTime = Date.now();
    const requests = [];
    let errors = 0;

    while (Date.now() - startTime < duration) {
      const requestStart = performance.now();

      try {
        const response = await axios.get(`${this.config.baseUrl}/api/search`, {
          params: { q: 'endurance-test' },
          timeout: 5000
        });

        const requestEnd = performance.now();
        requests.push(requestEnd - requestStart);

      } catch (error) {
        errors++;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const actualDuration = Date.now() - startTime;

    return {
      duration: actualDuration,
      totalRequests: requests.length + errors,
      successfulRequests: requests.length,
      errors,
      errorRate: (errors / (requests.length + errors)) * 100,
      requestsPerSecond: ((requests.length + errors) / actualDuration) * 1000,
      averageResponseTime: requests.length > 0 ? requests.reduce((sum, time) => sum + time, 0) / requests.length : 0
    };
  }

  /**
   * Analyze overall compliance
   */
  analyzeOverallCompliance(tests) {
    const compliance = {
      overallCompliant: true,
      complianceScore: 0,
      categories: {},
      summary: {}
    };

    const categories = ['responseTime', 'availability', 'throughput', 'errorRate', 'endurance'];
    let totalCategories = 0;
    let compliantCategories = 0;

    categories.forEach(category => {
      if (tests[category] && tests[category].compliance) {
        totalCategories++;
        const categoryCompliant = tests[category].compliance.compliant !== false;

        compliance.categories[category] = {
          compliant: categoryCompliant,
          details: tests[category].compliance
        };

        if (categoryCompliant) {
          compliantCategories++;
        } else {
          compliance.overallCompliant = false;
        }
      }
    });

    compliance.complianceScore = totalCategories > 0 ? (compliantCategories / totalCategories) * 100 : 0;
    compliance.overallCompliant = compliance.complianceScore >= this.config.complianceThreshold;

    return compliance;
  }

  /**
   * Generate compliance summary
   */
  generateComplianceSummary(results) {
    return {
      overallCompliant: results.compliance.overallCompliant,
      complianceScore: results.compliance.complianceScore,
      totalViolations: results.violations.length,
      criticalViolations: results.violations.filter(v => v.type.includes('p95') || v.type.includes('availability')).length,
      recommendations: this.generateSLARecommendations(results),
      keyMetrics: {
        responseTimeP95: results.tests.responseTime?.aggregated?.percentiles?.p95,
        availability: results.tests.availability?.uptimePercentage,
        maxThroughput: results.tests.throughput?.maxThroughput,
        errorRate: results.tests.errorRate?.errorRate
      }
    };
  }

  /**
   * Generate SLA recommendations
   */
  generateSLARecommendations(results) {
    const recommendations = [];

    results.violations.forEach(violation => {
      switch (violation.type) {
        case 'p95Violation':
          recommendations.push('Optimize response times: implement caching, database indexing, or scale infrastructure');
          break;
        case 'availabilityViolation':
          recommendations.push('Improve availability: implement health checks, redundancy, and failover mechanisms');
          break;
        case 'throughputViolation':
          recommendations.push('Increase throughput capacity: consider horizontal scaling or performance optimization');
          break;
        case 'errorRateViolation':
          recommendations.push('Reduce error rate: implement better error handling and system monitoring');
          break;
        case 'enduranceViolation':
          recommendations.push('Address performance degradation: investigate memory leaks and resource management');
          break;
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Calculate statistics
   */
  calculateStatistics(values) {
    if (values.length === 0) return { error: 'No data' };

    const sorted = values.sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      median: sorted[Math.floor(sorted.length / 2)]
    };
  }

  /**
   * Calculate percentiles
   */
  calculatePercentiles(sortedArray) {
    if (sortedArray.length === 0) return {};

    const percentiles = {};
    const levels = [50, 90, 95, 99];

    levels.forEach(p => {
      const index = Math.ceil((p / 100) * sortedArray.length) - 1;
      percentiles[`p${p}`] = sortedArray[Math.max(0, index)];
    });

    return percentiles;
  }

  /**
   * Save compliance results
   */
  async saveComplianceResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `sla-compliance-${timestamp}.json`;
    const filepath = path.join(this.config.outputDir, filename);

    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    console.log(`📄 SLA compliance results saved to: ${filepath}`);

    // Also save a summary report
    await this.saveSummaryReport(results, timestamp);
  }

  /**
   * Save summary report
   */
  async saveSummaryReport(results, timestamp) {
    const summary = `SLA Compliance Report - ${new Date().toISOString()}

Overall Compliance: ${results.compliance.overallCompliant ? 'PASS' : 'FAIL'}
Compliance Score: ${results.compliance.complianceScore.toFixed(1)}%
Total Violations: ${results.violations.length}

Response Time SLA:
- P95 Target: ${this.config.slaTargets.responseTime.p95}ms
- P95 Actual: ${results.tests.responseTime?.aggregated?.percentiles?.p95?.toFixed(2) || 'N/A'}ms
- Status: ${results.compliance.categories.responseTime?.compliant ? 'PASS' : 'FAIL'}

Availability SLA:
- Target: ${this.config.slaTargets.availability}%
- Actual: ${results.tests.availability?.uptimePercentage?.toFixed(2) || 'N/A'}%
- Status: ${results.compliance.categories.availability?.compliant ? 'PASS' : 'FAIL'}

Throughput SLA:
- Target: ${this.config.slaTargets.throughput} RPS
- Actual: ${results.tests.throughput?.maxThroughput?.toFixed(2) || 'N/A'} RPS
- Status: ${results.compliance.categories.throughput?.compliant ? 'PASS' : 'FAIL'}

Error Rate SLA:
- Target: ${this.config.slaTargets.errorRate}%
- Actual: ${results.tests.errorRate?.errorRate?.toFixed(2) || 'N/A'}%
- Status: ${results.compliance.categories.errorRate?.compliant ? 'PASS' : 'FAIL'}

Recommendations:
${results.summary.recommendations.map(rec => `- ${rec}`).join('\n')}
`;

    const summaryFilename = `sla-summary-${timestamp}.txt`;
    const summaryFilepath = path.join(this.config.outputDir, summaryFilename);

    await fs.writeFile(summaryFilepath, summary);
    console.log(`📋 SLA summary saved to: ${summaryFilepath}`);
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

module.exports = SLAComplianceTests;