/**
 * Automated Performance Regression Test Runner
 * Main orchestrator for executing and managing performance tests
 */

const EventEmitter = require('events');
const fs = require('fs/promises');
const path = require('path');
const { PerformanceObserver, performance } = require('perf_hooks');
const BaselineComparator = require('./baseline-comparator');
const RegressionDetector = require('../algorithms/regression-detector');
const AlertManager = require('../alerts/alert-manager');
const ReportGenerator = require('../reports/report-generator');
const TestMetrics = require('../utils/test-metrics');

class PerformanceTestRunner extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      baselineDir: config.baselineDir || './baselines',
      resultsDir: config.resultsDir || './results',
      environments: config.environments || ['development', 'staging', 'production'],
      testSuites: config.testSuites || [],
      alertThresholds: config.alertThresholds || {
        performance: { slow: 20, critical: 50 }, // percentage increases
        memory: { warning: 15, critical: 30 },
        error: { warning: 5, critical: 10 }
      },
      parallelTests: config.parallelTests || 4,
      retryAttempts: config.retryAttempts || 3,
      warmupRuns: config.warmupRuns || 2,
      measurementRuns: config.measurementRuns || 10,
      ...config
    };
    
    this.baseline = new BaselineComparator(this.config);
    this.detector = new RegressionDetector(this.config);
    this.alerts = new AlertManager(this.config);
    this.reports = new ReportGenerator(this.config);
    this.metrics = new TestMetrics();
    
    this.runResults = new Map();
    this.activeTests = new Set();
    this.testQueue = [];
    
    this.setupPerformanceObserver();
  }

  setupPerformanceObserver() {
    this.perfObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        this.metrics.recordEntry(entry);
      });
    });
    
    this.perfObserver.observe({ entryTypes: ['measure', 'mark'] });
  }

  /**
   * Execute complete regression test suite
   */
  async executeRegressionSuite(suiteConfig = {}) {
    const startTime = Date.now();
    const runId = `run-${startTime}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      this.emit('suite:start', { runId, config: suiteConfig });
      
      // Initialize run
      await this.initializeRun(runId);
      
      // Execute test suites in parallel
      const results = await this.executeTestSuites(runId, suiteConfig);
      
      // Analyze results for regressions
      const regressionAnalysis = await this.analyzeRegressions(runId, results);
      
      // Generate comprehensive report
      const report = await this.generateReport(runId, results, regressionAnalysis);
      
      // Handle alerts if regressions detected
      await this.handleAlerts(regressionAnalysis, report);
      
      // Store results for future baselines
      await this.storeResults(runId, results, regressionAnalysis);
      
      this.emit('suite:complete', {
        runId,
        duration: Date.now() - startTime,
        results,
        regressions: regressionAnalysis,
        report
      });
      
      return {
        success: true,
        runId,
        results,
        regressions: regressionAnalysis,
        report
      };
      
    } catch (error) {
      this.emit('suite:error', { runId, error });
      await this.handleTestFailure(runId, error);
      throw error;
    }
  }

  /**
   * Initialize test run environment
   */
  async initializeRun(runId) {
    // Create run directory
    const runDir = path.join(this.config.resultsDir, runId);
    await fs.mkdir(runDir, { recursive: true });
    
    // Initialize metrics collection
    this.metrics.startRun(runId);
    
    // Clear previous results
    this.runResults.clear();
    this.activeTests.clear();
    
    // Load baseline data
    await this.baseline.loadBaselines();
    
    this.emit('run:initialized', { runId });
  }

  /**
   * Execute all configured test suites
   */
  async executeTestSuites(runId, suiteConfig) {
    const suites = suiteConfig.suites || this.config.testSuites;
    const environments = suiteConfig.environments || this.config.environments;
    
    const allResults = new Map();
    
    for (const environment of environments) {
      this.emit('environment:start', { environment });
      
      const envResults = await this.executeEnvironmentTests(runId, environment, suites);
      allResults.set(environment, envResults);
      
      this.emit('environment:complete', { environment, results: envResults });
    }
    
    return allResults;
  }

  /**
   * Execute tests for specific environment
   */
  async executeEnvironmentTests(runId, environment, suites) {
    const results = new Map();
    
    // Execute suites in parallel batches
    const batches = this.createTestBatches(suites, this.config.parallelTests);
    
    for (const batch of batches) {
      const batchPromises = batch.map(suite => 
        this.executeSingleSuite(runId, environment, suite)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        const suite = batch[index];
        if (result.status === 'fulfilled') {
          results.set(suite.name, result.value);
        } else {
          results.set(suite.name, {
            error: result.reason,
            status: 'failed',
            metrics: {}
          });
        }
      });
    }
    
    return results;
  }

  /**
   * Execute single test suite with retries
   */
  async executeSingleSuite(runId, environment, suite) {
    const testId = `${runId}-${environment}-${suite.name}`;
    this.activeTests.add(testId);
    
    try {
      this.emit('test:start', { testId, suite, environment });
      
      let lastError = null;
      let result = null;
      
      for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
        try {
          result = await this.runSuiteWithMeasurement(testId, environment, suite);
          break;
        } catch (error) {
          lastError = error;
          if (attempt < this.config.retryAttempts) {
            this.emit('test:retry', { testId, attempt, error });
            await this.delay(1000 * (attempt + 1)); // Exponential backoff
          }
        }
      }
      
      if (!result) {
        throw lastError || new Error('Test failed after all retry attempts');
      }
      
      this.emit('test:complete', { testId, result });
      return result;
      
    } finally {
      this.activeTests.delete(testId);
    }
  }

  /**
   * Run suite with performance measurement
   */
  async runSuiteWithMeasurement(testId, environment, suite) {
    const measurements = [];
    
    // Warmup runs
    for (let i = 0; i < this.config.warmupRuns; i++) {
      await this.executeSuiteFunction(suite, environment, true);
    }
    
    // Measurement runs
    for (let i = 0; i < this.config.measurementRuns; i++) {
      const measurement = await this.executeSuiteFunction(suite, environment, false);
      measurements.push(measurement);
    }
    
    // Calculate statistics
    const stats = this.calculateStatistics(measurements);
    
    return {
      testId,
      suite: suite.name,
      environment,
      measurements,
      statistics: stats,
      timestamp: new Date().toISOString(),
      metadata: {
        warmupRuns: this.config.warmupRuns,
        measurementRuns: this.config.measurementRuns,
        ...suite.metadata
      }
    };
  }

  /**
   * Execute actual test suite function
   */
  async executeSuiteFunction(suite, environment, isWarmup = false) {
    const startMark = `test-start-${Date.now()}`;
    const endMark = `test-end-${Date.now()}`;
    
    performance.mark(startMark);
    
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    try {
      // Execute the actual test function
      const result = await suite.testFunction(environment, {
        isWarmup,
        metrics: this.metrics
      });
      
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      performance.mark(endMark);
      performance.measure(`test-${suite.name}`, startMark, endMark);
      
      return {
        success: true,
        duration: Number(endTime - startTime) / 1000000, // Convert to ms
        memory: {
          heap: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external,
          rss: endMemory.rss - startMemory.rss
        },
        result,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const endTime = process.hrtime.bigint();
      performance.mark(endMark);
      
      return {
        success: false,
        duration: Number(endTime - startTime) / 1000000,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Calculate statistical metrics from measurements
   */
  calculateStatistics(measurements) {
    const durations = measurements.filter(m => m.success).map(m => m.duration);
    const heapUsages = measurements.filter(m => m.success).map(m => m.memory.heap);
    
    if (durations.length === 0) {
      return { error: 'No successful measurements' };
    }
    
    return {
      duration: {
        mean: this.mean(durations),
        median: this.median(durations),
        min: Math.min(...durations),
        max: Math.max(...durations),
        stdDev: this.standardDeviation(durations),
        p95: this.percentile(durations, 95),
        p99: this.percentile(durations, 99)
      },
      memory: {
        heap: {
          mean: this.mean(heapUsages),
          median: this.median(heapUsages),
          min: Math.min(...heapUsages),
          max: Math.max(...heapUsages)
        }
      },
      successRate: (measurements.filter(m => m.success).length / measurements.length) * 100,
      errorRate: (measurements.filter(m => !m.success).length / measurements.length) * 100
    };
  }

  /**
   * Analyze results for performance regressions
   */
  async analyzeRegressions(runId, results) {
    const analysis = {
      runId,
      timestamp: new Date().toISOString(),
      regressions: [],
      improvements: [],
      summary: {
        totalTests: 0,
        regressionCount: 0,
        improvementCount: 0,
        criticalRegressions: 0
      }
    };
    
    for (const [environment, envResults] of results) {
      for (const [suiteName, suiteResult] of envResults) {
        analysis.summary.totalTests++;
        
        if (suiteResult.error) continue;
        
        const regressionResult = await this.detector.detectRegression(
          environment,
          suiteName,
          suiteResult,
          await this.baseline.getBaseline(environment, suiteName)
        );
        
        if (regressionResult.isRegression) {
          analysis.regressions.push(regressionResult);
          analysis.summary.regressionCount++;
          
          if (regressionResult.severity === 'critical') {
            analysis.summary.criticalRegressions++;
          }
        } else if (regressionResult.isImprovement) {
          analysis.improvements.push(regressionResult);
          analysis.summary.improvementCount++;
        }
      }
    }
    
    return analysis;
  }

  /**
   * Generate comprehensive test report
   */
  async generateReport(runId, results, regressionAnalysis) {
    return await this.reports.generate({
      runId,
      results,
      regressionAnalysis,
      timestamp: new Date().toISOString(),
      config: this.config
    });
  }

  /**
   * Handle alerts for detected regressions
   */
  async handleAlerts(regressionAnalysis, report) {
    if (regressionAnalysis.summary.criticalRegressions > 0) {
      await this.alerts.sendAlert({
        type: 'critical_regression',
        severity: 'critical',
        regressions: regressionAnalysis.regressions.filter(r => r.severity === 'critical'),
        report
      });
    } else if (regressionAnalysis.summary.regressionCount > 0) {
      await this.alerts.sendAlert({
        type: 'performance_regression',
        severity: 'warning',
        regressions: regressionAnalysis.regressions,
        report
      });
    }
  }

  /**
   * Store results for future baseline comparisons
   */
  async storeResults(runId, results, regressionAnalysis) {
    const storageDir = path.join(this.config.resultsDir, runId);
    
    // Store raw results
    await fs.writeFile(
      path.join(storageDir, 'results.json'),
      JSON.stringify(Array.from(results.entries()), null, 2)
    );
    
    // Store regression analysis
    await fs.writeFile(
      path.join(storageDir, 'regression-analysis.json'),
      JSON.stringify(regressionAnalysis, null, 2)
    );
    
    // Update baselines if no critical regressions
    if (regressionAnalysis.summary.criticalRegressions === 0) {
      await this.baseline.updateBaselines(results);
    }
  }

  /**
   * Create test batches for parallel execution
   */
  createTestBatches(suites, batchSize) {
    const batches = [];
    for (let i = 0; i < suites.length; i += batchSize) {
      batches.push(suites.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Utility methods for statistics
   */
  mean(values) {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  standardDeviation(values) {
    const avg = this.mean(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  percentile(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    return lower === upper ? sorted[lower] : sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle test failures
   */
  async handleTestFailure(runId, error) {
    await this.alerts.sendAlert({
      type: 'test_suite_failure',
      severity: 'critical',
      runId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.perfObserver) {
      this.perfObserver.disconnect();
    }
    this.removeAllListeners();
  }
}

module.exports = PerformanceTestRunner;