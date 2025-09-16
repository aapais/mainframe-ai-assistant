/**
 * Stress Test Framework - Peak Load Testing
 * Tests system behavior under extreme load conditions
 */

const cluster = require('cluster');
const os = require('os');
const { performance } = require('perf_hooks');
const axios = require('axios');
const fs = require('fs').promises;

class StressTestFramework {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      maxWorkers: config.maxWorkers || os.cpus().length * 2,
      initialLoad: config.initialLoad || 10,
      maxLoad: config.maxLoad || 1000,
      loadIncrement: config.loadIncrement || 50,
      testDuration: config.testDuration || 30000, // 30 seconds per level
      breakingPointThreshold: config.breakingPointThreshold || 5, // 5% error rate
      responseTimeThreshold: config.responseTimeThreshold || 5000, // 5 seconds
      outputDir: config.outputDir || './stress-test-results',
      ...config
    };

    this.workers = new Map();
    this.currentLoad = this.config.initialLoad;
    this.testResults = [];
    this.breakingPoint = null;
    this.systemMetrics = [];
  }

  /**
   * Execute comprehensive stress test
   */
  async runStressTest() {
    console.log('💪 Starting Comprehensive Stress Test');
    console.log(`Load range: ${this.config.initialLoad} → ${this.config.maxLoad} users`);
    console.log(`Increment: ${this.config.loadIncrement} users every ${this.config.testDuration}ms`);

    try {
      await this.ensureOutputDir();
      await this.initializeMonitoring();

      // Execute stress test phases
      const results = {
        timestamp: new Date().toISOString(),
        config: this.config,
        phases: {
          rampUp: await this.executeRampUpPhase(),
          peak: await this.executePeakLoadPhase(),
          breakingPoint: await this.findBreakingPoint(),
          recovery: await this.executeRecoveryPhase()
        },
        summary: null
      };

      // Generate summary and recommendations
      results.summary = this.generateStressSummary(results);
      results.recommendations = this.generateStressRecommendations(results);

      // Save results
      await this.saveStressResults(results);

      console.log('✅ Stress test completed successfully');
      return results;

    } catch (error) {
      console.error('❌ Stress test failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Execute ramp-up phase
   */
  async executeRampUpPhase() {
    console.log('📈 Executing Ramp-Up Phase...');

    const rampUpResults = [];
    const steps = Math.ceil((this.config.maxLoad - this.config.initialLoad) / this.config.loadIncrement);

    for (let step = 0; step < steps; step++) {
      const targetLoad = this.config.initialLoad + (step * this.config.loadIncrement);

      if (targetLoad > this.config.maxLoad) break;

      console.log(`  Step ${step + 1}/${steps}: Testing ${targetLoad} concurrent users`);

      const stepResult = await this.executeLoadStep(targetLoad, this.config.testDuration);
      stepResult.phase = 'rampUp';
      stepResult.step = step + 1;

      rampUpResults.push(stepResult);

      // Check if we hit breaking point early
      if (this.isBreakingPoint(stepResult)) {
        console.log(`⚠️  Breaking point detected at ${targetLoad} users`);
        this.breakingPoint = targetLoad;
        break;
      }

      // Brief cooldown between steps
      await this.cooldown(2000);
    }

    return rampUpResults;
  }

  /**
   * Execute peak load phase
   */
  async executePeakLoadPhase() {
    console.log('🔥 Executing Peak Load Phase...');

    const peakLoad = this.breakingPoint || this.config.maxLoad;
    const sustainedDuration = this.config.testDuration * 3; // 3x normal duration

    console.log(`  Sustaining ${peakLoad} users for ${sustainedDuration}ms`);

    const peakResult = await this.executeLoadStep(peakLoad, sustainedDuration);
    peakResult.phase = 'peak';

    return [peakResult];
  }

  /**
   * Find breaking point with binary search
   */
  async findBreakingPoint() {
    if (this.breakingPoint) {
      console.log(`💥 Breaking point already found: ${this.breakingPoint} users`);
      return [];
    }

    console.log('🔍 Finding Breaking Point with Binary Search...');

    let low = this.config.initialLoad;
    let high = this.config.maxLoad;
    let lastStableLoad = low;
    const results = [];

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      console.log(`  Testing ${mid} users (range: ${low}-${high})`);

      const result = await this.executeLoadStep(mid, this.config.testDuration);
      result.phase = 'breakingPoint';
      result.searchRange = { low, high, tested: mid };

      results.push(result);

      if (this.isBreakingPoint(result)) {
        high = mid - 1;
        this.breakingPoint = mid;
      } else {
        low = mid + 1;
        lastStableLoad = mid;
      }

      await this.cooldown(1000);
    }

    console.log(`🎯 Breaking point analysis complete. Last stable: ${lastStableLoad} users`);
    return results;
  }

  /**
   * Execute recovery phase
   */
  async executeRecoveryPhase() {
    console.log('🔄 Executing Recovery Phase...');

    const recoverySteps = [
      { load: Math.floor(this.config.maxLoad * 0.5), label: '50% load' },
      { load: Math.floor(this.config.maxLoad * 0.25), label: '25% load' },
      { load: this.config.initialLoad, label: 'baseline load' }
    ];

    const recoveryResults = [];

    for (const step of recoverySteps) {
      console.log(`  Recovery test: ${step.label} (${step.load} users)`);

      const result = await this.executeLoadStep(step.load, this.config.testDuration);
      result.phase = 'recovery';
      result.recoveryStep = step.label;

      recoveryResults.push(result);

      await this.cooldown(1000);
    }

    return recoveryResults;
  }

  /**
   * Execute single load step
   */
  async executeLoadStep(targetLoad, duration) {
    const startTime = performance.now();
    const workers = [];
    const results = {
      targetLoad,
      actualLoad: 0,
      duration,
      startTime: Date.now(),
      endTime: null,
      requests: [],
      errors: [],
      systemMetrics: [],
      metrics: {}
    };

    try {
      // Spawn workers
      for (let i = 0; i < targetLoad; i++) {
        const worker = this.spawnStressWorker(i, duration);
        workers.push(worker);
      }

      results.actualLoad = workers.length;

      // Collect results from workers
      const workerPromises = workers.map(worker => this.collectWorkerResults(worker));

      // Start system monitoring
      const monitoringInterval = this.startSystemMonitoring(results);

      // Wait for all workers to complete
      const workerResults = await Promise.all(workerPromises);

      // Stop monitoring
      clearInterval(monitoringInterval);

      // Aggregate results
      workerResults.forEach(workerResult => {
        results.requests.push(...workerResult.requests);
        results.errors.push(...workerResult.errors);
      });

      results.endTime = Date.now();
      results.metrics = this.calculateStepMetrics(results);

      console.log(`    Results: ${results.requests.length} requests, ${results.errors.length} errors, ${results.metrics.averageResponseTime.toFixed(2)}ms avg`);

      return results;

    } catch (error) {
      console.error(`    Step failed: ${error.message}`);
      results.error = error.message;
      return results;
    } finally {
      // Cleanup workers
      workers.forEach(worker => {
        try {
          worker.kill();
        } catch (e) {
          // Ignore cleanup errors
        }
      });
    }
  }

  /**
   * Spawn stress worker process
   */
  spawnStressWorker(workerId, duration) {
    if (cluster.isMaster) {
      const worker = cluster.fork({
        WORKER_ID: workerId,
        DURATION: duration,
        BASE_URL: this.config.baseUrl
      });

      return worker;
    }
  }

  /**
   * Collect results from worker
   */
  collectWorkerResults(worker) {
    return new Promise((resolve) => {
      const workerResults = {
        requests: [],
        errors: []
      };

      worker.on('message', (message) => {
        switch (message.type) {
          case 'request':
            workerResults.requests.push(message.data);
            break;
          case 'error':
            workerResults.errors.push(message.data);
            break;
          case 'complete':
            resolve(workerResults);
            break;
        }
      });

      worker.on('exit', () => {
        resolve(workerResults);
      });
    });
  }

  /**
   * Start system monitoring
   */
  startSystemMonitoring(results) {
    return setInterval(() => {
      const metrics = {
        timestamp: Date.now(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        activeRequests: results.requests.length,
        errorCount: results.errors.length
      };

      results.systemMetrics.push(metrics);
    }, 1000);
  }

  /**
   * Calculate step metrics
   */
  calculateStepMetrics(stepResult) {
    const { requests, errors, duration } = stepResult;

    if (requests.length === 0) {
      return {
        requestsPerSecond: 0,
        averageResponseTime: 0,
        errorRate: 100,
        percentiles: {}
      };
    }

    const responseTimes = requests.map(req => req.responseTime);
    const sortedTimes = responseTimes.sort((a, b) => a - b);

    return {
      requestsPerSecond: (requests.length / duration) * 1000,
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      errorRate: (errors.length / (requests.length + errors.length)) * 100,
      percentiles: this.calculatePercentiles(sortedTimes),
      totalRequests: requests.length,
      totalErrors: errors.length,
      successRate: (requests.length / (requests.length + errors.length)) * 100
    };
  }

  /**
   * Check if current load represents breaking point
   */
  isBreakingPoint(stepResult) {
    const metrics = stepResult.metrics;

    if (!metrics) return false;

    // Check error rate threshold
    if (metrics.errorRate >= this.config.breakingPointThreshold) {
      return true;
    }

    // Check response time threshold
    if (metrics.averageResponseTime >= this.config.responseTimeThreshold) {
      return true;
    }

    // Check if requests per second is dropping significantly
    if (this.testResults.length > 0) {
      const previousRps = this.testResults[this.testResults.length - 1].metrics.requestsPerSecond;
      const currentRps = metrics.requestsPerSecond;
      const degradation = ((previousRps - currentRps) / previousRps) * 100;

      if (degradation > 30) { // 30% degradation
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate percentiles
   */
  calculatePercentiles(sortedArray) {
    if (sortedArray.length === 0) return {};

    const percentiles = {};
    const levels = [50, 75, 90, 95, 99];

    levels.forEach(p => {
      const index = Math.ceil((p / 100) * sortedArray.length) - 1;
      percentiles[`p${p}`] = sortedArray[Math.max(0, index)];
    });

    return percentiles;
  }

  /**
   * Generate stress test summary
   */
  generateStressSummary(results) {
    const allPhases = Object.values(results.phases).flat();
    const maxLoad = Math.max(...allPhases.map(phase => phase.targetLoad));

    const summary = {
      maxConcurrentUsers: maxLoad,
      breakingPoint: this.breakingPoint,
      totalRequests: allPhases.reduce((sum, phase) => sum + (phase.requests?.length || 0), 0),
      totalErrors: allPhases.reduce((sum, phase) => sum + (phase.errors?.length || 0), 0),
      testDuration: allPhases.reduce((sum, phase) => sum + (phase.duration || 0), 0),
      phases: {}
    };

    // Analyze each phase
    Object.entries(results.phases).forEach(([phaseName, phaseResults]) => {
      if (phaseResults.length > 0) {
        const phaseMetrics = phaseResults.map(result => result.metrics).filter(Boolean);

        if (phaseMetrics.length > 0) {
          summary.phases[phaseName] = {
            steps: phaseResults.length,
            maxLoad: Math.max(...phaseResults.map(r => r.targetLoad)),
            avgResponseTime: phaseMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / phaseMetrics.length,
            avgErrorRate: phaseMetrics.reduce((sum, m) => sum + m.errorRate, 0) / phaseMetrics.length,
            totalRequests: phaseMetrics.reduce((sum, m) => sum + m.totalRequests, 0)
          };
        }
      }
    });

    summary.overallSuccessRate = ((summary.totalRequests - summary.totalErrors) / summary.totalRequests) * 100;

    return summary;
  }

  /**
   * Generate stress test recommendations
   */
  generateStressRecommendations(results) {
    const recommendations = [];
    const summary = results.summary;

    if (this.breakingPoint && this.breakingPoint < this.config.maxLoad * 0.5) {
      recommendations.push({
        category: 'scalability',
        severity: 'high',
        message: `Low breaking point detected: ${this.breakingPoint} users. Consider scaling infrastructure.`
      });
    }

    if (summary.overallSuccessRate < 95) {
      recommendations.push({
        category: 'reliability',
        severity: 'high',
        message: `Low success rate: ${summary.overallSuccessRate.toFixed(1)}%. Investigate error sources.`
      });
    }

    if (summary.phases.peak?.avgResponseTime > 2000) {
      recommendations.push({
        category: 'performance',
        severity: 'medium',
        message: `High response times under peak load: ${summary.phases.peak.avgResponseTime.toFixed(0)}ms avg.`
      });
    }

    if (summary.phases.recovery?.avgErrorRate > 1) {
      recommendations.push({
        category: 'recovery',
        severity: 'medium',
        message: 'System shows slow recovery. Consider implementing circuit breakers.'
      });
    }

    return recommendations;
  }

  /**
   * Initialize monitoring
   */
  async initializeMonitoring() {
    console.log('📊 Initializing system monitoring...');
    // Setup system monitoring if needed
  }

  /**
   * Cooldown period between tests
   */
  async cooldown(duration) {
    console.log(`❄️  Cooldown period: ${duration}ms`);
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * Save stress test results
   */
  async saveStressResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `stress-test-${timestamp}.json`;
    const filepath = require('path').join(this.config.outputDir, filename);

    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    console.log(`📄 Stress test results saved to: ${filepath}`);
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
    if (cluster.isMaster) {
      // Kill any remaining workers
      Object.values(cluster.workers).forEach(worker => {
        try {
          worker.kill();
        } catch (e) {
          // Ignore cleanup errors
        }
      });
    }
  }
}

// Worker process implementation
if (cluster.isWorker) {
  const workerId = process.env.WORKER_ID;
  const duration = parseInt(process.env.DURATION);
  const baseUrl = process.env.BASE_URL;

  runStressWorker(workerId, duration, baseUrl);
}

async function runStressWorker(workerId, duration, baseUrl) {
  const startTime = performance.now();

  try {
    while (performance.now() - startTime < duration) {
      const requestStart = performance.now();

      try {
        const response = await axios.get(`${baseUrl}/api/search`, {
          params: { q: `stress-test-${workerId}`, limit: 10 },
          timeout: 5000
        });

        const requestEnd = performance.now();

        process.send({
          type: 'request',
          data: {
            workerId,
            responseTime: requestEnd - requestStart,
            status: response.status,
            timestamp: Date.now()
          }
        });

      } catch (error) {
        process.send({
          type: 'error',
          data: {
            workerId,
            error: error.message,
            status: error.response?.status,
            timestamp: Date.now()
          }
        });
      }

      // Small delay to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    process.send({ type: 'complete' });

  } catch (error) {
    process.send({
      type: 'error',
      data: { workerId, error: error.message }
    });
  }
}

module.exports = StressTestFramework;