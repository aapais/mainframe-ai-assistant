/**
 * Load Test Runner - Realistic Query Pattern Testing
 * Simulates real user behavior patterns with varying loads
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

class LoadTestRunner {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      maxWorkers: config.maxWorkers || os.cpus().length,
      testDuration: config.testDuration || 60000,
      rampUpTime: config.rampUpTime || 30000,
      rampDownTime: config.rampDownTime || 30000,
      reportInterval: config.reportInterval || 5000,
      outputDir: config.outputDir || './test-results',
      ...config
    };

    this.workers = [];
    this.results = {
      startTime: null,
      endTime: null,
      workers: [],
      summary: null
    };

    this.realTimeMetrics = {
      currentRps: 0,
      currentUsers: 0,
      avgResponseTime: 0,
      errorRate: 0
    };
  }

  /**
   * Execute load test with realistic user patterns
   */
  async runLoadTest(scenarios) {
    console.log('🚀 Starting Load Test with Realistic User Patterns');
    console.log(`Scenarios: ${scenarios.length}, Max Workers: ${this.config.maxWorkers}`);

    try {
      await this.ensureOutputDir();

      this.results.startTime = Date.now();

      // Start monitoring
      const monitoringInterval = this.startMonitoring();

      // Execute test scenarios
      await this.executeScenarios(scenarios);

      // Stop monitoring
      clearInterval(monitoringInterval);

      this.results.endTime = Date.now();

      // Generate comprehensive report
      const report = await this.generateReport();

      console.log('✅ Load test completed successfully');
      return report;

    } catch (error) {
      console.error('❌ Load test failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Execute test scenarios
   */
  async executeScenarios(scenarios) {
    const promises = scenarios.map((scenario, index) =>
      this.executeScenario(scenario, index)
    );

    const results = await Promise.all(promises);
    this.results.workers = results;

    return results;
  }

  /**
   * Execute single scenario
   */
  async executeScenario(scenario, scenarioIndex) {
    console.log(`📊 Executing Scenario ${scenarioIndex + 1}: ${scenario.name}`);

    const workerConfig = {
      ...this.config,
      scenario,
      scenarioIndex,
      workerId: `worker-${scenarioIndex}`
    };

    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: workerConfig
      });

      const workerResult = {
        scenarioIndex,
        scenarioName: scenario.name,
        startTime: Date.now(),
        endTime: null,
        requests: [],
        errors: [],
        metrics: {}
      };

      worker.on('message', (message) => {
        switch (message.type) {
          case 'request':
            workerResult.requests.push(message.data);
            this.updateRealTimeMetrics();
            break;

          case 'error':
            workerResult.errors.push(message.data);
            break;

          case 'complete':
            workerResult.endTime = Date.now();
            workerResult.metrics = message.data;
            resolve(workerResult);
            break;
        }
      });

      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });

      this.workers.push(worker);
    });
  }

  /**
   * Start real-time monitoring
   */
  startMonitoring() {
    return setInterval(() => {
      this.logRealTimeMetrics();
    }, this.config.reportInterval);
  }

  /**
   * Update real-time metrics
   */
  updateRealTimeMetrics() {
    const now = Date.now();
    const timeWindow = 5000; // 5 second window

    // Collect recent requests from all workers
    const recentRequests = this.results.workers
      .flatMap(worker => worker.requests)
      .filter(req => now - req.timestamp < timeWindow);

    if (recentRequests.length > 0) {
      this.realTimeMetrics.currentRps = (recentRequests.length / timeWindow) * 1000;
      this.realTimeMetrics.avgResponseTime = recentRequests
        .reduce((sum, req) => sum + req.responseTime, 0) / recentRequests.length;

      const errors = recentRequests.filter(req => !req.success);
      this.realTimeMetrics.errorRate = (errors.length / recentRequests.length) * 100;
    }

    this.realTimeMetrics.currentUsers = this.workers.length;
  }

  /**
   * Log real-time metrics
   */
  logRealTimeMetrics() {
    const { currentRps, currentUsers, avgResponseTime, errorRate } = this.realTimeMetrics;

    console.log(`📈 Live Metrics: ${currentUsers} users | ${currentRps.toFixed(1)} RPS | ${avgResponseTime.toFixed(0)}ms avg | ${errorRate.toFixed(1)}% errors`);
  }

  /**
   * Generate comprehensive report
   */
  async generateReport() {
    console.log('📊 Generating comprehensive load test report...');

    const report = {
      testInfo: {
        startTime: new Date(this.results.startTime).toISOString(),
        endTime: new Date(this.results.endTime).toISOString(),
        duration: this.results.endTime - this.results.startTime,
        scenarios: this.results.workers.length
      },
      summary: this.calculateSummary(),
      scenarios: this.results.workers.map(worker => this.analyzeWorkerResults(worker)),
      recommendations: []
    };

    // Add recommendations
    report.recommendations = this.generateRecommendations(report);

    // Save report
    await this.saveReport(report);

    return report;
  }

  /**
   * Calculate overall summary
   */
  calculateSummary() {
    const allRequests = this.results.workers.flatMap(worker => worker.requests);
    const allErrors = this.results.workers.flatMap(worker => worker.errors);

    if (allRequests.length === 0) {
      return { error: 'No requests completed' };
    }

    const responseTimes = allRequests.map(req => req.responseTime);
    const sortedTimes = responseTimes.sort((a, b) => a - b);

    const duration = (this.results.endTime - this.results.startTime) / 1000;

    return {
      totalRequests: allRequests.length,
      totalErrors: allErrors.length,
      successRate: ((allRequests.length - allErrors.length) / allRequests.length) * 100,
      requestsPerSecond: allRequests.length / duration,
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      percentiles: this.calculatePercentiles(sortedTimes),
      duration: duration,
      concurrentUsers: this.results.workers.length
    };
  }

  /**
   * Analyze individual worker results
   */
  analyzeWorkerResults(worker) {
    const { requests, errors, scenarioName } = worker;

    if (requests.length === 0) {
      return {
        scenarioName,
        error: 'No requests completed',
        requests: 0,
        errors: errors.length
      };
    }

    const responseTimes = requests.map(req => req.responseTime);
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const duration = (worker.endTime - worker.startTime) / 1000;

    return {
      scenarioName,
      requests: requests.length,
      errors: errors.length,
      successRate: ((requests.length - errors.length) / requests.length) * 100,
      requestsPerSecond: requests.length / duration,
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      percentiles: this.calculatePercentiles(sortedTimes),
      duration: duration,
      errorDetails: this.categorizeErrors(errors)
    };
  }

  /**
   * Calculate percentiles
   */
  calculatePercentiles(sortedArray) {
    const percentiles = {};
    const levels = [50, 75, 90, 95, 99];

    levels.forEach(p => {
      const index = Math.ceil((p / 100) * sortedArray.length) - 1;
      percentiles[`p${p}`] = sortedArray[Math.max(0, index)];
    });

    return percentiles;
  }

  /**
   * Categorize errors
   */
  categorizeErrors(errors) {
    const categories = {};

    errors.forEach(error => {
      const category = error.status || error.type || 'unknown';
      categories[category] = (categories[category] || 0) + 1;
    });

    return categories;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(report) {
    const recommendations = [];
    const summary = report.summary;

    if (summary.successRate < 99) {
      recommendations.push({
        category: 'reliability',
        message: `Success rate is ${summary.successRate.toFixed(1)}%. Investigate error causes.`,
        priority: 'high'
      });
    }

    if (summary.percentiles.p95 > 1000) {
      recommendations.push({
        category: 'performance',
        message: `P95 response time is ${summary.percentiles.p95.toFixed(0)}ms. Consider optimization.`,
        priority: 'high'
      });
    }

    if (summary.requestsPerSecond < 100) {
      recommendations.push({
        category: 'throughput',
        message: `Low throughput: ${summary.requestsPerSecond.toFixed(1)} RPS. Consider scaling.`,
        priority: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * Save report to file
   */
  async saveReport(report) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `load-test-report-${timestamp}.json`;
    const filepath = path.join(this.config.outputDir, filename);

    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${filepath}`);

    // Also save a summary CSV
    await this.saveCsvSummary(report, timestamp);
  }

  /**
   * Save CSV summary
   */
  async saveCsvSummary(report, timestamp) {
    const csvData = [
      ['Metric', 'Value'],
      ['Total Requests', report.summary.totalRequests],
      ['Success Rate (%)', report.summary.successRate.toFixed(2)],
      ['Requests/Second', report.summary.requestsPerSecond.toFixed(2)],
      ['Average Response Time (ms)', report.summary.averageResponseTime.toFixed(2)],
      ['P50 (ms)', report.summary.percentiles.p50],
      ['P95 (ms)', report.summary.percentiles.p95],
      ['P99 (ms)', report.summary.percentiles.p99],
      ['Total Errors', report.summary.totalErrors],
      ['Duration (s)', report.summary.duration.toFixed(2)]
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const filename = `load-test-summary-${timestamp}.csv`;
    const filepath = path.join(this.config.outputDir, filename);

    await fs.writeFile(filepath, csvContent);
    console.log(`📊 CSV summary saved to: ${filepath}`);
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

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Terminate all workers
    await Promise.all(this.workers.map(worker => worker.terminate()));
    this.workers = [];
  }
}

// Worker thread implementation
if (!isMainThread) {
  const { scenario, baseUrl, testDuration, workerId } = workerData;
  runWorkerScenario(scenario, baseUrl, testDuration, workerId);
}

async function runWorkerScenario(scenario, baseUrl, testDuration, workerId) {
  const axios = require('axios');
  const { performance } = require('perf_hooks');

  const startTime = performance.now();
  let requestCount = 0;
  let errorCount = 0;

  console.log(`🔄 Worker ${workerId} started: ${scenario.name}`);

  try {
    while (performance.now() - startTime < testDuration) {
      const action = selectAction(scenario.actions);

      try {
        const requestStart = performance.now();
        const response = await axios.get(`${baseUrl}${action.endpoint}`, {
          params: action.params,
          timeout: 5000
        });
        const requestEnd = performance.now();

        const requestData = {
          timestamp: Date.now(),
          endpoint: action.endpoint,
          responseTime: requestEnd - requestStart,
          status: response.status,
          success: true,
          workerId
        };

        parentPort.postMessage({
          type: 'request',
          data: requestData
        });

        requestCount++;

      } catch (error) {
        const errorData = {
          timestamp: Date.now(),
          endpoint: action.endpoint,
          error: error.message,
          status: error.response?.status,
          workerId
        };

        parentPort.postMessage({
          type: 'error',
          data: errorData
        });

        errorCount++;
      }

      // Think time simulation
      await new Promise(resolve => setTimeout(resolve, action.thinkTime || 1000));
    }

    // Send completion message
    parentPort.postMessage({
      type: 'complete',
      data: {
        requestCount,
        errorCount,
        duration: performance.now() - startTime
      }
    });

  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      data: { error: error.message, workerId }
    });
  }
}

function selectAction(actions) {
  const totalWeight = actions.reduce((sum, action) => sum + (action.weight || 1), 0);
  let random = Math.random() * totalWeight;

  for (const action of actions) {
    random -= (action.weight || 1);
    if (random <= 0) {
      return action;
    }
  }

  return actions[0]; // Fallback
}

module.exports = LoadTestRunner;